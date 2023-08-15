// Browser API
type TabId = number;
type WindowId = number;

type WeTab = {
    id: TabId,
    windowId: WindowId,
    url: string,
    title: string,
    cookieStoreId: string,
    pinned: boolean,
    active: boolean,
    index: number,
    incognito: boolean,
    favIconUrl: string,
    status: "complete"|"loading",
    lastAccessed?: number, // Firefox only
};

type WeWindow = {
    id: WindowId,
};

type WeTabsEventFilter = {
    urls?: string[],
    properties: ("attention"|"autoDiscardable"|"audible"|"discarded"|"favIconUrl"|"hidden"|"isArticle"|"mutedInfo"|"pinned"|"status"|"title"|"url")[],
};

type WeEvent<callback, filter=WeTabsEventFilter> = {
    addListener(listener: callback, filter?: filter, tabId?: TabId, windowId?: WindowId): void;
    removeListener(listener: callback): void;
    hasListener(listener: callback): boolean;
};

declare const chrome: {
    browserAction: {
        setTitle(details: {title: string|null, tabId?: TabId}): void,
        setIcon(details: {imageData?: ImageData|Record<number,ImageData>, path?: string, tabId?: TabId}): Promise<void>,
        setPopup(details: {tabId?: TabId, popup: string|null}): void,
        openPopup(): Promise<void>,
        setBadgeText(details: {text: string|null, tabId?: TabId}): void,
        setBadgeBackgroundColor(details: {color: string|null|[number,number,number], tabId?: TabId}): void,
    },
    tabs: {
        onActivated: WeEvent<(activeInfo: {previousTabId: TabId, tabId: TabId, windowId: WindowId})=>void>,
        onActiveChanged: WeEvent<(tabId: TabId, selectInfo: {windowId: WindowId})=>void>,
        onAttached: WeEvent<(tabId: TabId, attachInfo: {newWindowId: WindowId, newPosition: number})=>void>,
        onCreated: WeEvent<(tab: WeTab)=>void>,
        onDetached: WeEvent<(tabId: TabId, detachInfo: {oldWindowId: WindowId, oldPosition: number})=>void>,
        onRemoved: WeEvent<(tabId: TabId, removeInfo: {windowId: WindowId, isWindowClosing: boolean})=>void>,
        onUpdated: WeEvent<(tabId: TabId, changeInfo: Partial<WeTab>, tab: WeTab)=>void>,
    },
    commands: {
        onCommand: WeEvent<(name: string)=>void>,
    },
    runtime: {
        sendMessage(extensionId: string, message: any, options: any): void,
        sendMessage(message: any, options?: any): void,
    }
};

// Firefox-Specific
type WeContextualIdentity = {
    cookieStoreId: string,
    color: "blue"|"turquoise"|"green"|"yellow"|"orange"|"red"|"pink"|"purple"|"toolbar",
    colorCode: string,
    icon: "fingerprint"|"briefcase"|"dollar"|"cart"|"circle"|"gift"|"vacation"|"food"|"fruit"|"pet"|"tree"|"chill"|"fence",
    iconUrl: string,
    name: string,
};

declare const browser: typeof chrome & {
    contextualIdentities: {
        get(cookieStoreId: string): Promise<WeContextualIdentity>,
    },
    browserAction: {
        setTitle(details: {title: string|null, tabId?: TabId, windowId?: WindowId}): void,
        setIcon(details: {imageData?: ImageData|Record<number,ImageData>, path?: string, tabId?: TabId, windowId?: WindowId}): Promise<void>,
        setPopup(details: {tabId?: TabId, windowId?: WindowId, popup: string|null}): void,
        setBadgeText(details: {text: string|null, tabId?: TabId, windowId?: WindowId}): void,
        setBadgeBackgroundColor(details: {color: string|null|[number,number,number], tabId?: TabId, windowId?: WindowId}): void,
        setBadgeTextColor(details: {color: string|null|[number,number,number], tabId?: TabId, windowId?: WindowId}): void,
    },
};

// helper.js
declare const getTab: (arg0: TabId) => Promise<WeTab>;
declare const getTabs: (arg0: { windowType?: string; windowId: WindowId; active?: boolean; }) => Promise<WeTab[]>;
declare const removeTab: (arg0: TabId) => Promise<void>;
declare const moveTab: (arg0: TabId, arg1: { index: number; }) => Promise<void>;
declare const activateTab: (arg0: TabId) => Promise<void>;
declare const reloadTab: (arg0: TabId) => Promise<void>;
declare const getActiveWindowId: () => Promise<WindowId>;
declare const getActiveTabId: (arg0: WindowId) => Promise<number>;
declare const getWindows: () => Promise<WeWindow[]>;

// options.js
declare const isPanelOptionOpen: () => boolean;
declare const initializeOptions: () => Promise<void>;
declare const options: {
    autoCloseTab: boolean,
    defaultTabBehavior: boolean;
    activateKeptTab: boolean,
    keepNewerTab: boolean,
    keepReloadOlderTab: boolean,
    keepTabWithHttps: boolean,
    keepPinnedTab: boolean, 
    ignoreHashPart: boolean,
    ignoreSearchPart: boolean,
    ignorePathPart: boolean,
    compareWithTitle: boolean,
    ignore3w: boolean,
    caseInsensitive: boolean,
    searchInAllWindows: boolean,
    searchPerContainer: boolean,
    whiteList: string,
    badgeColorDuplicateTabs: string,
    badgeColorNoDuplicateTabs: string,
    showBadgeIfNoDuplicateTabs: boolean,
};
declare const environment: {
    isFirefox: boolean,
    isChrome: boolean,
    isAndroid: boolean,
};

// urlUtils.js
declare const isBlankURL: (arg0: string) => boolean;
