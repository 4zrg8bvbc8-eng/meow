/*
 * Text Editor Overlay — content script
 *
 * Responsibilities:
 *   - Load this host's saved edits and re-apply them on every page load,
 *     including for content that is injected dynamically after load.
 *   - Provide a touch-friendly "edit mode" where tapping a piece of text
 *     makes it editable inline; the new text is saved on blur.
 *   - Respond to popup messages (enable/disable, toggle edit mode, clear).
 *
 * Everything is stored locally via the extension's storage.local. Nothing
 * ever leaves the device.
 */
(function () {
  "use strict";

  const api = typeof browser !== "undefined" ? browser : chrome;
  const HOST = location.hostname;
  const STORE_KEY = "host:" + HOST;

  // Attribute we stamp onto elements we are actively touching so that our
  // own DOM writes don't cause the MutationObserver to loop.
  const APPLYING = { active: false };

  let state = { enabled: true, edits: [] }; // loaded from storage
  let editMode = false; // transient; does NOT persist across reloads
  let banner = null;

  /* ---------------------------------------------------------------- storage */

  function loadState() {
    return api.storage.local.get(STORE_KEY).then((res) => {
      const s = res && res[STORE_KEY];
      if (s && typeof s === "object") {
        state = {
          enabled: s.enabled !== false, // default enabled
          edits: Array.isArray(s.edits) ? s.edits : [],
        };
      }
      return state;
    });
  }

  function saveState() {
    return api.storage.local.set({ [STORE_KEY]: state });
  }

  /* ------------------------------------------------------------- selectors */

  // Build a reasonably stable CSS path for an element (id shortcut when
  // available, otherwise tag + :nth-of-type up the tree).
  function cssPath(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el === document.body) return "body";
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.documentElement) {
      if (node.id) {
        parts.unshift("#" + cssEscape(node.id));
        break; // an id is unique enough to anchor the path
      }
      let sel = node.nodeName.toLowerCase();
      let nth = 1;
      let sib = node;
      while ((sib = sib.previousElementSibling)) {
        if (sib.nodeName === node.nodeName) nth++;
      }
      sel += ":nth-of-type(" + nth + ")";
      if (node === document.body) {
        parts.unshift("body");
        break;
      }
      parts.unshift(sel);
      node = node.parentElement;
    }
    return parts.join(" > ");
  }

  function cssEscape(str) {
    if (window.CSS && CSS.escape) return CSS.escape(str);
    return String(str).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  /* --------------------------------------------------------------- applying */

  function findEditFor(selector, path) {
    return state.edits.find((e) => e.selector === selector && e.path === path);
  }

  function upsertEdit(selector, html) {
    const path = location.pathname;
    const existing = findEditFor(selector, path);
    if (existing) {
      existing.html = html;
      existing.ts = Date.now();
    } else {
      state.edits.push({ selector, path, html, ts: Date.now() });
    }
    return saveState();
  }

  // Re-apply every saved edit whose selector currently resolves on this page.
  function applyEdits() {
    if (!state.enabled || !state.edits.length) return;
    const path = location.pathname;
    APPLYING.active = true;
    try {
      for (const edit of state.edits) {
        if (edit.path !== path) continue;
        let el;
        try {
          el = document.querySelector(edit.selector);
        } catch (_) {
          el = null;
        }
        if (el && el.innerHTML !== edit.html) {
          el.innerHTML = edit.html;
        }
      }
    } finally {
      APPLYING.active = false;
    }
  }

  /* ------------------------------------------------------------- edit mode */

  function setEditMode(on) {
    editMode = !!on;
    document.documentElement.classList.toggle("teo-edit-mode", editMode);
    if (editMode) showBanner();
    else hideBanner();
  }

  function showBanner() {
    if (banner) return;
    banner = document.createElement("div");
    banner.id = "teo-banner";
    banner.setAttribute("data-teo", "1");
    banner.innerHTML =
      '<span class="teo-dot"></span>' +
      "<span>Edit mode — tap any text to change it. Tap Done when finished.</span>" +
      '<button type="button" id="teo-done">Done</button>';
    (document.body || document.documentElement).appendChild(banner);
    banner.querySelector("#teo-done").addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        setEditMode(false);
      },
      true
    );
  }

  function hideBanner() {
    if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
    banner = null;
  }

  function isOurUi(el) {
    return !!(el && el.closest && el.closest('[data-teo="1"]'));
  }

  let activeEl = null;

  function beginEditing(el) {
    if (!el || el.nodeType !== 1 || isOurUi(el)) return;
    if (activeEl && activeEl !== el) finishEditing();
    activeEl = el;
    el.setAttribute("data-teo-editing", "1");
    el.setAttribute("contenteditable", "true");
    el.focus();
    // Place the caret where possible.
    try {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (_) {}
  }

  function finishEditing() {
    if (!activeEl) return;
    const el = activeEl;
    activeEl = null;
    el.removeAttribute("contenteditable");
    el.removeAttribute("data-teo-editing");
    const selector = cssPath(el);
    if (selector) upsertEdit(selector, el.innerHTML);
  }

  // Capture-phase tap handler. In edit mode we intercept the tap so links /
  // buttons don't navigate, and turn the tapped element into an editor.
  function onTapCapture(e) {
    if (!editMode) return;
    const target = e.target;
    if (isOurUi(target)) return; // let our own buttons work

    // If tapping inside the element already being edited, allow normal
    // caret placement / typing.
    if (activeEl && activeEl.contains(target)) return;

    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function")
      e.stopImmediatePropagation();

    finishEditing();
    beginEditing(target);
  }

  function onFocusOut(e) {
    if (activeEl && e.target === activeEl) {
      // Defer so a tap moving to another element is handled first.
      setTimeout(() => {
        if (activeEl === e.target) finishEditing();
      }, 0);
    }
  }

  /* -------------------------------------------------------------- messaging */

  function status() {
    return {
      host: HOST,
      enabled: state.enabled,
      editMode: editMode,
      editCount: state.edits.filter((e) => e.path === location.pathname).length,
      totalCount: state.edits.length,
    };
  }

  api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg && msg.type) {
      case "getStatus":
        sendResponse(status());
        return true;
      case "setEnabled":
        state.enabled = !!msg.value;
        saveState().then(() => {
          // Reload so disabling restores original text and enabling re-applies.
          location.reload();
        });
        sendResponse(status());
        return true;
      case "setEditMode":
        setEditMode(!!msg.value);
        sendResponse(status());
        return true;
      case "clearThisPage":
        state.edits = state.edits.filter(
          (e) => e.path !== location.pathname
        );
        saveState().then(() => location.reload());
        sendResponse(status());
        return true;
      case "clearAll":
        state.edits = [];
        saveState().then(() => location.reload());
        sendResponse(status());
        return true;
      default:
        return false;
    }
  });

  /* -------------------------------------------------------------- lifecycle */

  const observer = new MutationObserver((mutations) => {
    if (APPLYING.active || !state.enabled || !state.edits.length) return;
    // Only bother if real nodes were added.
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length) {
        scheduleApply();
        break;
      }
    }
  });

  let applyTimer = null;
  function scheduleApply() {
    if (applyTimer) return;
    applyTimer = setTimeout(() => {
      applyTimer = null;
      applyEdits();
    }, 60);
  }

  function boot() {
    // Global listeners live for the whole page lifetime.
    document.addEventListener("click", onTapCapture, true);
    document.addEventListener("focusout", onFocusOut, true);
    // Enter should not create newlines that break inline elements; let the
    // user blur to save instead by leaving default behavior — but block the
    // implicit form submit path when editing.
    document.addEventListener(
      "keydown",
      (e) => {
        if (activeEl && e.key === "Enter" && !e.shiftKey) {
          // allow multiline with shift+enter; plain enter finishes.
          e.preventDefault();
          finishEditing();
        }
      },
      true
    );

    applyEdits();
    if (document.body) {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }
  }

  // We run at document_start: state must be loaded before we can apply.
  loadState().then(() => {
    if (
      document.readyState === "loading" &&
      !document.documentElement.firstChild
    ) {
      // very early — wait a tick for the root to exist
    }
    // Observe as early as possible to catch streamed markup.
    try {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    } catch (_) {}

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot, { once: true });
      // Also try an early application pass for already-parsed nodes.
      scheduleApply();
    } else {
      boot();
    }
  });
})();
