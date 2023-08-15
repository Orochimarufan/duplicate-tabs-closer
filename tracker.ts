// Window and Tab tracking

type TabInfo = {
    // Identifier
    id: TabId,
    // Cached from API
    windowId: WindowId,
    url: string,
    pinned: boolean,
    // Own properties
    timestamp: number,
    ignored: boolean,
    // Window group key
    key: string,
};

type WindowInfo = {
    id: WindowId,
    groups: Map<string, Set<TabId>>,
    // Number of tabs that are duplicates of another tab
    ndupes: number,
};

type _MatchOptions = {
    key: "url"|"title",
    granularity: "fragment"|"search"|"path"|"origin",
    ignoreHttp: boolean,
    ignoreWww: boolean,
    caseInsensitive: boolean,
    container: boolean,
};

type _KeepOptions = {
    preferAge: "newest"|"oldest",
    preferPinned: boolean,
    preferHttps: boolean,
    active?: number,
}

// Iterable helpers
// Move somewhere else
function *iterFilter<T>(iter: Iterable<T>, filterFn: (x: T) => boolean): Iterable<T> {
    for (const item of iter) {
        if (filterFn(item))
            yield item;
    }
}

function *iterFilterMap<T, U>(iter: Iterable<T>, filterMapFn: (x: T) => U|undefined): Iterable<U> {
    for (const item of iter) {
        const mapped = filterMapFn(item);
        if (mapped !== undefined)
            yield mapped;
    }
}

function *iterFlat<T>(iter: Iterable<Iterable<T>>): Iterable<T> {
    for (const inter of iter) {
        for (const item of inter) {
            yield item;
        }
    }
}

class Tracker {
    #tabs: Map<TabId, TabInfo>;
    #windows: Map<WindowId, WindowInfo>;
    #global: WindowInfo|null;
    #matchOptions: _MatchOptions;

    constructor() {
        this.#tabs = new Map();
        this.#windows = new Map();
        this.#global = null;
        this.#matchOptions = {
            key: "url",
            granularity: "fragment",
            ignoreHttp: true,
            ignoreWww: false,
            caseInsensitive: true,
            container: false,
        };
    }

    // Return previous state
    async #useGlobalWindow(global?: boolean): Promise<boolean> {
        if (this.#global === null) {
            if (global === true) {
                this.#windows.clear();
                this.#global = this.#newWindowInfo(-1);
                await this.refresh();
            }
            return false;
        } else {
            if (global === false) {
                this.#global = null;
                await this.refresh();
            }
            return true;
        }
    }

    /// @brief Apply extension options
    /// TODO: move out of tracker.ts?
    async setOptions(options: any): Promise<void> {
        const new_options: _MatchOptions = {
            key: options.compareWithTitle?"title":"url",
            granularity: options.ignorePathPart?"origin":options.ignoreSearchPart?"path":options.ignoreHashPart?"search":"fragment",
            ignoreHttp: options.keepTabWithHttps,
            ignoreWww: options.ignore3w,
            caseInsensitive: options.caseInsensitive,
            container: options.searchPerContainer,
        };
        let invalidate = new_options !== this.#matchOptions;
        this.#matchOptions = new_options;
        const oldGlobalWindow = this.#global !== null;
        if (await this.#useGlobalWindow(options.searchInAllWindows) !== options.searchInAllWindows)
            // already invalidates
            invalidate = false;
        if (invalidate)
            return this.refresh();
    }

    // Accessors
    #newWindowInfo(id: WindowId): WindowInfo {
        return {
            id,
            groups: new Map(),
            ndupes: 0,
        };
    }

    #getExistingWindow(id: WindowId, window?: WindowInfo): WindowInfo|undefined {
        if (this.#global !== null)
            return this.#global;
        if (window !== undefined && window.id === id)
            return window;
        return this.#windows.get(id);
    }

    /// @brief Get stored information about a window
    getWindow(id: WindowId, window?: WindowInfo): WindowInfo {
        window = this.#getExistingWindow(id, window);
        if (window === undefined) {
            window = this.#newWindowInfo(id);
            this.#windows.set(id, window);
        }
        return window;
    }

    /// @brief Get the number of extraneous tabs in a window
    getCloseableTabCount(windowId: WindowId): number {
        return this.getWindow(windowId).ndupes;
    }

    /// @brief Get a list of all tabs that have duplicates
    /// @note It includes the "real" tabs
    getDuplicateTabs(windowId: WindowId): TabId[] {
        return Array.from(iterFlat(iterFilter(this.getWindow(windowId).groups.values(),
                                              g => g.size > 1)));
    }

    /// @brief Get a list of the duplication groups
    getDuplicateGroups(windowId: WindowId): Set<TabId>[] {
        return Array.from(iterFilter(this.getWindow(windowId).groups.values(),
                                     g => g.size > 1));
    }

    /// @brief Get a list of the duplication groups
    getDuplicateGroupsWithKeys(windowId: WindowId): [string, Set<TabId>][] {
        return Array.from(iterFilter(this.getWindow(windowId).groups.entries(),
                                     ([k, g]) => g.size > 1));
    }

    /// @brief Get WebExtension Tab objects for all duplicate groups
    /// @note This is mostly useful for debugging
    async fetchDuplicateGroupTabs(windowId: WindowId): Promise<[string, WeTab[]][]> {
        return Promise.all(iterFilterMap(this.getWindow(windowId).groups.entries(),
                ([k, g]) => g.size <= 1 ? undefined :
                    Promise.all(Array.from(g, id => getTab(id)))
                        .then(ts => [k, ts] as [string, WeTab[]])));
    }

    #newTabInfo(id: TabId, lastAccessed?: number): TabInfo {
        return {
            id,
            windowId: -2,
            url: "",
            key: "",
            timestamp: lastAccessed ?? Date.now(),
            pinned: false,
            ignored: false,
        };
    }

    /// @brief Get the stored information for a group
    getTabs(ids: Iterable<TabId>): TabInfo[] {
        const res: TabInfo[] = [];
        for (const id of ids) {
            const tab = this.#tabs.get(id);
            if (tab)
                res.push(tab);
        }
        return res;
    }

    // --------------------------- Matching -----------------------------------
    #computeMatchUrl(tab: WeTab): string {
        const url = new URL(tab.url);
        switch(this.#matchOptions.granularity) {
            case "path":
                url.search = "";
            case "search":
                url.hash = "";
            case "fragment":
            case "origin": // done below
        }
        if (this.#matchOptions.ignoreHttp) {
            if (url.protocol.toLowerCase() === "http:")
                url.protocol = "https:";
        }
        if (this.#matchOptions.ignoreWww) {
            if (url.hostname.startsWith("www."))
                url.hostname = url.hostname.substring(4);
        }
        return this.#matchOptions.granularity === "origin" ? url.origin : url.toString();
    }

    /// @brief Compute the deduplication key for a tab
    computeKey(tab: WeTab): string {
        const source = this.#matchOptions.key;
        let key = (source === "url") ? this.#computeMatchUrl(tab)
                : (source === "title") ? tab.title
                : (() => {throw new Error(`Unknown match key: ${this.#matchOptions.key}`); })();
        if (this.#matchOptions.caseInsensitive)
            key = key.toLowerCase();
        if (this.#matchOptions.container)
            key = `{${tab.cookieStoreId}}${key}`;
        return key;
    }

    // --------------------------- Ignored Tabs -------------------------------
    /// @brief Set a tab to be ignored
    ignoreTab(id: TabId, ignore: boolean = true) {
        const tab = this.#tabs.get(id);
        if (tab) {
            tab.ignored = ignore;
            if (ignore)
                this.#dropTabFromGroup(tab);
            else
                this.updateTab(id);
        }
    }

    /// @brief Check if a tab id is ignored
    isIgnoredTab(id: TabId): boolean {
        const tab = this.#tabs.get(id);
        return !tab || tab.ignored;
    }

    // --------------------------- Update Tabs --------------------------------
    #dropTabFromGroup(tab: TabInfo, window?: WindowInfo) {
        window = this.#getExistingWindow(tab.windowId, window);
        if (window) {
            const oldGroup = window.groups.get(tab.key);
            if (oldGroup) {
                if (oldGroup.size <= 1)
                    window.groups.delete(tab.key);
                else {
                    oldGroup.delete(tab.id);
                    window.ndupes -= 1;
                }
            }
        }
        tab.key = "";
    }

    #addTabToGroup(tab: TabInfo, key: string, window?: WindowInfo): Set<TabId> {
        if (key === "")
            return new Set([tab.id]);
        window = this.getWindow(tab.windowId, window);
        let group = window.groups.get(key);
        if (!group) {
            group = new Set();
            window.groups.set(key, group);
        }
        if (!group.has(tab.id)) {
            group.add(tab.id);
            if (group.size >= 2)
                window.ndupes += 1;
        }
        tab.key = key;
        return group;
    }

    #updateTab(tab: WeTab, window?: WindowInfo, timestamp?: boolean): Set<TabId> {
        let info = this.#tabs.get(tab.id);
        const key = (!info?.ignored)? this.computeKey(tab) : "";
        if (info) {
            if (info.key !== key && info.key !== "" || info.windowId !== tab.windowId)
                this.#dropTabFromGroup(info, window);
        } else {
            // New tab
            info = this.#newTabInfo(tab.id, tab.lastAccessed);
            this.#tabs.set(tab.id, info);
        }
        // Update info from tab object
        info.windowId = tab.windowId;
        info.url = tab.url;
        info.pinned = tab.pinned;
        if (timestamp)
            info.timestamp = Date.now();
        // Add to group
        return this.#addTabToGroup(info, key, window);
    }

    /// @brief Update the stored information for a tab
    /// @param options.timestamp Also update the last modified timestamp
    /// @param options.tab Pass the WebExtension Tab object so it doesn't have to be retrieved
    async updateTab(id: TabId, options?: {timestamp?: boolean, tab?: WeTab, windowInfo?: WindowInfo}): Promise<Set<TabId>> {
        return this.#updateTab(options?.tab ?? await getTab(id), options?.windowInfo, options?.timestamp);
    }

    /// @brief Drop all stored information about a tab (or window)
    /// @param windowClosing Indicate that the whole window is about to be closed and can be discarded
    removeTab(id: TabId, windowClosing?: number) {
        const tab = this.#tabs.get(id);
        if (tab) {
            if (windowClosing !== undefined && !this.#global) {
                this.#windows.delete(windowClosing);
            } else {
                this.#dropTabFromGroup(tab);
            }
            this.#tabs.delete(id);
        }
    }

    /// @brief Refresh all tab information
    /// @param windowId Only refresh tabs from a specific window if given
    async refresh(windowId?: WindowId) {
        if (this.#global)
            windowId = undefined;
        const queryInfo = { windowType: "normal", windowId };
        const openTabs = await getTabs(queryInfo);
        let window: WindowInfo|undefined = undefined;
        if (this.#global) {
            this.#tabs.clear();
            window = this.#global;
        } else if (windowId === undefined) {
            this.#tabs.clear();
            this.#windows.clear();
        } else {
            window = this.#getExistingWindow(windowId);
        }
        if (window) {
            window.groups.clear();
            window.ndupes = 0;
        }
        for (const tab of openTabs) {
            this.#updateTab(tab, window);
        }
    }

    // --------------------------- Tab rating ---------------------------------
    /// @brief Rate tabs in a group
    /// @param options Options for rating tabs
    /// @return One tab to keep and a list of tabs to close
    rateGroupTabs(group: Set<TabId>, options: _KeepOptions): [TabId, TabId[]] {
        // No-op if only one element in group
        if (group.size == 1) {
            for (const id of group) {
                return [id, []];
            }
        }
        // Calculate scores
        const tabs = this.getTabs(group);
        const now = Date.now();
        let best = 0;
        let best_score = -Infinity;
        for (const tab of tabs) {
            let score = (options.preferAge === "newest") ? tab.timestamp : -tab.timestamp;
            if (options.active !== undefined && options.active == tab.id)
                score += 3*now;
            if (options.preferPinned && tab.pinned)
                score += 2*now;
            if (options.preferHttps && tab.url.startsWith("https:"))
                score += now;
            if (score >= best_score) {
                best_score = score;
                best = tab.id;
            }
        }
        // Grab IDs to close
        const close: TabId[] = [];
        for (const id of group) {
            if (id !== best)
                close.push(id);
        }
        return [best, close];
    }
}
