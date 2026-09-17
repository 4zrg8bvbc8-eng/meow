/* Text Editor Overlay — popup controller */
(function () {
  "use strict";
  const api = typeof browser !== "undefined" ? browser : chrome;

  const el = (id) => document.getElementById(id);
  const controls = el("controls");
  const unsupported = el("unsupported");
  const editBtn = el("editBtn");
  const enabledToggle = el("enabledToggle");
  const hostLabel = el("host");
  const pageCount = el("pageCount");
  const totalCount = el("totalCount");

  let tabId = null;

  async function activeTab() {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  function send(type, extra) {
    return new Promise((resolve) => {
      api.tabs.sendMessage(tabId, Object.assign({ type }, extra), (resp) => {
        // Ignore lastError (e.g. content script not present on this page).
        void api.runtime.lastError;
        resolve(resp);
      });
    });
  }

  function render(status) {
    if (!status) {
      unsupported.hidden = false;
      controls.hidden = true;
      return;
    }
    unsupported.hidden = true;
    controls.hidden = false;
    hostLabel.textContent = status.host;
    enabledToggle.checked = status.enabled;
    pageCount.textContent = status.editCount;
    totalCount.textContent = status.totalCount;
    editBtn.textContent = status.editMode ? "Stop editing" : "Start editing";
    editBtn.classList.toggle("active", status.editMode);
  }

  async function init() {
    const tab = await activeTab();
    if (!tab || !/^https?:/.test(tab.url || "")) {
      render(null);
      return;
    }
    tabId = tab.id;
    const status = await send("getStatus");
    render(status);
  }

  editBtn.addEventListener("click", async () => {
    const status = await send("getStatus");
    const next = await send("setEditMode", { value: !(status && status.editMode) });
    render(next);
    // Editing happens on the page; close the popup so the page is visible.
    if (next && next.editMode) window.close();
  });

  enabledToggle.addEventListener("change", async () => {
    await send("setEnabled", { value: enabledToggle.checked });
    window.close(); // page reloads to apply/restore
  });

  el("clearPageBtn").addEventListener("click", async () => {
    await send("clearThisPage");
    window.close();
  });

  el("clearAllBtn").addEventListener("click", async () => {
    await send("clearAll");
    window.close();
  });

  init();
})();
