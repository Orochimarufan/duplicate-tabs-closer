const tabsInfo = new Tracker();

type RemainingTabActions = {
    tabId: TabId,
    reloadTab: boolean,         ///< Reload tab to ensure it's up-to-date
    observedTabClosed: boolean, ///< Remaining tab isn't triggering tab
    tabIndex?: number,          ///< Triggering tab index
    active: boolean,            ///< Tab group had focus
    bulk: boolean,             ///< Is bulk operation, don't focus even if enabled
};


async function closeDuplicateTabsGroup(group: Set<TabId>, observedTab?: WeTab, bulk?: boolean): Promise<void> {
    const [retain, close] = tabsInfo.rateGroupTabs(group, {
        preferAge: (options.keepNewerTab) ? "newest" : "oldest",
        preferPinned: options.keepPinnedTab,
        preferHttps: options.keepTabWithHttps,
    });
    if (close.length > 0) {
        const keepInfo = {
            tabId: retain,
            observedTabClosed: (observedTab && retain !== observedTab.id),
            tabIndex: observedTab?.index,
            active: observedTab?.active ?? false,
            reloadTab: options.keepReloadOlderTab,
            bulk: bulk ?? false,
        };
        await Promise.all(close.map(removeTab));
        handleRemainingTab(keepInfo);
    }
}

async function handleRemainingTab(details: RemainingTabActions): Promise<void> {
    if (options.defaultTabBehavior && details.observedTabClosed) {
        if (details.tabIndex)
            moveTab(details.tabId, { index: details.tabIndex });
        if (details.active)
            activateTab(details.tabId);
    } else if (options.activateKeptTab && !details.bulk) {
        activateTab(details.tabId);
        //focusTab(details.tabId, details.windowId);
    }
    if (details.reloadTab) {
        tabsInfo.ignoreTab(details.tabId, true);
        await reloadTab(details.tabId);
        tabsInfo.ignoreTab(details.tabId, false);
    }
}

async function closeDuplicateTabs(windowId?: WindowId): Promise<void> {
    const window = tabsInfo.getWindow(windowId);
    for (const group of window.groups.values()) {
        await closeDuplicateTabsGroup(group, undefined, true);
    }
}

async function getDuplicateTabsForPanel(windowId: WindowId) {
    return (await Promise.all(Array.from(tabsInfo.getDuplicateTabs(windowId), async(id) => {
        const tab = await getTab(id);
        if (!tab)
            return null;
        let containerColor = "";
        if (environment.isFirefox && (!tab.incognito && tab.cookieStoreId !== "firefox-default")) {
            const context = await browser.contextualIdentities.get(tab.cookieStoreId);
            if (context)
                containerColor = context.color;
        }
        return {
            id: tab.id,
            url: tab.url,
            title: tab.title || tab.url,
            windowId: tab.windowId,
            containerColor: containerColor,
            icon: tab.favIconUrl || "../images/default-favicon.png"
        };
    }))).filter(tab => tab !== null);
};

async function sendDuplicateTabsToPanel(windowId: WindowId): Promise<void> {
    const duplicateTabs = await getDuplicateTabsForPanel(windowId);
    chrome.runtime.sendMessage({
        action: "updateDuplicateTabsTable",
        data: { "duplicateTabs": duplicateTabs }
    });
}

async function requestDuplicateTabsFromPanel(windowId: WindowId): Promise<void> {
    // Refresh information just in case
    await tabsInfo.refresh(windowId);
    updateBadges(windowId);
    await sendDuplicateTabsToPanel(windowId);
};

async function refreshDuplicateTabsInfo(windowId?: WindowId): Promise<void> {
    await tabsInfo.refresh(windowId);
    updateBadges(windowId);
    if (isPanelOptionOpen()) {
        let refreshPanel = options.searchInAllWindows;
        if (!refreshPanel || windowId === undefined) {
            const activeWindowId = await getActiveWindowId();
            if (windowId === undefined) {
                windowId = activeWindowId;
                refreshPanel = true;
            } else {
                refreshPanel = activeWindowId == windowId;
            }
        }
        if (refreshPanel)
            sendDuplicateTabsToPanel(windowId);
    }
};
