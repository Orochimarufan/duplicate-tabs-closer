// Browser API Hooks

async function onCreatedTab(tab: WeTab): Promise<void> {
	const group = await tabsInfo.updateTab(tab.id, {tab, timestamp: true})
	if (group.size > 1) {
		updateBadges(tab.windowId);
		if (tab.status === "complete" && !isBlankURL(tab.url) && options.autoCloseTab) {
			await closeDuplicateTabsGroup(group, tab);
		}
	}
}

async function onUpdatedTab(tabId: TabId, changeInfo: Partial<WeTab>, tab: WeTab): Promise<void> {
	const group = await tabsInfo.updateTab(tab.id, {tab, timestamp: true})
	updateBadges(tab.windowId);
	if (group.size > 1) {
		if (!isBlankURL(tab.url) && options.autoCloseTab) {
			await closeDuplicateTabsGroup(group, tab);
		}
	}
}

async function onRemovedTab(tabId: TabId, removeInfo: {windowId: WindowId, isWindowClosing: boolean}): Promise<void> {
	if (removeInfo.isWindowClosing) 
		tabsInfo.removeTab(tabId, removeInfo.windowId);
	else
		tabsInfo.removeTab(tabId);
	updateBadges(removeInfo.windowId);
}

// Re-Attaching
async function onAttached(tabId: TabId): Promise<void> {
	const tab = await getTab(tabId);
	if (tab) {
		const group = await tabsInfo.updateTab(tab.id, {tab, timestamp: true});
		updateBadges(tab.windowId);
		if (group.size > 1) {

			if (tab.status === "complete" && !isBlankURL(tab.url) && options.autoCloseTab) {
				closeDuplicateTabsGroup(group, tab);
			}
		}
	}
}

async function onActivatedTab(activeInfo: {tabId: TabId, windowId: WindowId}): Promise<void> {
	// for Chrome only
	if (tabsInfo.isIgnoredTab(activeInfo.tabId))
		return;
	setBadge(activeInfo.windowId, activeInfo.tabId);
};

// Shortcuts
async function onCommand(name: string): Promise<void> {
	if (name == "close-duplicate-tabs")
		closeDuplicateTabs();
};


(async() => {
	// eslint-disable-next-line no-unused-vars
	await initializeOptions();
	setBadgeIcon();
	await refreshDuplicateTabsInfo();
	chrome.tabs.onCreated.addListener(onCreatedTab);
	chrome.tabs.onUpdated.addListener(onUpdatedTab, {properties: ["status"]});
	chrome.tabs.onRemoved.addListener(onRemovedTab);
	chrome.tabs.onAttached.addListener(onAttached);
	if (!environment.isFirefox)
		chrome.tabs.onActivated.addListener(onActivatedTab);
	chrome.commands.onCommand.addListener(onCommand);
})();

