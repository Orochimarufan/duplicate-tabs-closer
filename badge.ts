// Extension toolbar button

function setBadgeIcon(): void {
	chrome.browserAction.setIcon({ path: options.autoCloseTab ? "images/auto_close_16.png" : "images/manual_close_16.png" });
	if (environment.isFirefox)
		browser.browserAction.setBadgeTextColor({ color: "white" });
};

async function setBadge(windowId: WindowId, activeTabId?: TabId): Promise<void> {
	let nbDuplicateTabs: string = tabsInfo.getCloseableTabCount(windowId).toString();
	if (nbDuplicateTabs === "0" && !options.showBadgeIfNoDuplicateTabs)
		nbDuplicateTabs = "";
	const backgroundColor = (nbDuplicateTabs !== "0") ? options.badgeColorDuplicateTabs : options.badgeColorNoDuplicateTabs;
	if (environment.isFirefox) {
		browser.browserAction.setBadgeText({text: nbDuplicateTabs, windowId: windowId});
		browser.browserAction.setBadgeBackgroundColor({color: backgroundColor, windowId: windowId});
	}
	else {
		// eslint-disable-next-line no-param-reassign
		activeTabId = activeTabId || await getActiveTabId(windowId);
		if (activeTabId) {
			chrome.browserAction.setBadgeText({text: nbDuplicateTabs, tabId: activeTabId});
			chrome.browserAction.setBadgeBackgroundColor({color: backgroundColor, tabId: activeTabId});
		}
	}
};

async function updateBadges(windowId?: WindowId) {
	if (windowId === undefined || options.searchInAllWindows)
		(await getWindows()).forEach(window => setBadge(window.id));
	else
		setBadge(windowId);
};
