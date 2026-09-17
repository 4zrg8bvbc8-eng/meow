/*
 * Text Editor Overlay — background service worker.
 *
 * The extension is almost entirely driven by the content script and popup.
 * This worker exists to keep the badge in sync with whether the active tab's
 * host has edits enabled, which gives the toolbar icon a useful state hint.
 */
const api = typeof browser !== "undefined" ? browser : chrome;

async function hostKeyFor(tabId) {
  try {
    const tab = await api.tabs.get(tabId);
    if (!tab || !tab.url) return null;
    const url = new URL(tab.url);
    if (!/^https?:$/.test(url.protocol)) return null;
    return { key: "host:" + url.hostname, host: url.hostname };
  } catch (_) {
    return null;
  }
}

async function refreshBadge(tabId) {
  const info = await hostKeyFor(tabId);
  if (!info) {
    setBadge(tabId, "");
    return;
  }
  const res = await api.storage.local.get(info.key);
  const s = res && res[info.key];
  const enabled = s ? s.enabled !== false : true;
  const count = s && Array.isArray(s.edits) ? s.edits.length : 0;
  setBadge(tabId, count && enabled ? String(count) : "");
}

function setBadge(tabId, text) {
  try {
    if (api.action && api.action.setBadgeText) {
      api.action.setBadgeText({ tabId, text });
      if (api.action.setBadgeBackgroundColor)
        api.action.setBadgeBackgroundColor({ color: "#ff9500" });
    }
  } catch (_) {}
}

api.tabs.onActivated.addListener(({ tabId }) => refreshBadge(tabId));
api.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete") refreshBadge(tabId);
});
api.storage.onChanged.addListener(async () => {
  try {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (tab) refreshBadge(tab.id);
  } catch (_) {}
});
