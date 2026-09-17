// ==UserScript==
// @name         Text Editor Overlay
// @namespace    local.text-editor-overlay
// @version      1.0.0
// @description  Edit the displayed text on any web page. Edits are saved locally and re-applied on every visit/refresh until you turn them off. Works on iOS Safari via a userscript manager — no Mac needed.
// @author       you
// @match        *://*/*
// @run-at       document-start
// @grant        none
// @noframes
// ==/UserScript==

/*
 * Mobile-only version of the extension. Install a userscript manager on your
 * iPhone/iPad (e.g. the free open-source "Userscripts" app from the App Store,
 * or Tampermonkey / Stay), enable it in Settings > Apps > Safari > Extensions,
 * then add this file. See README-mobile.md for step-by-step instructions.
 *
 * Everything is stored in this site's localStorage on your device — nothing is
 * uploaded. A small floating button (bottom-right) is the control panel, since
 * userscripts have no toolbar popup.
 */
(function () {
  "use strict";
  if (window.top !== window.self) return; // top frame only

  const HOST = location.hostname;
  const KEY = "teo:host:" + HOST;

  const APPLYING = { active: false };
  let state = { enabled: true, edits: [] };
  let editMode = false;
  let activeEl = null;
  let fab = null;
  let panel = null;
  let banner = null;

  /* ---------------------------------------------------------------- storage */

  function loadState() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        state = {
          enabled: s.enabled !== false,
          edits: Array.isArray(s.edits) ? s.edits : [],
        };
      }
    } catch (_) {}
  }

  function saveState() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (_) {}
  }

  /* ------------------------------------------------------------- selectors */

  function cssEscape(str) {
    if (window.CSS && CSS.escape) return CSS.escape(str);
    return String(str).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function cssPath(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el === document.body) return "body";
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.documentElement) {
      if (node.id) {
        parts.unshift("#" + cssEscape(node.id));
        break;
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
    saveState();
  }

  function applyEdits() {
    if (!state.enabled || !state.edits.length) return;
    const path = location.pathname;
    APPLYING.active = true;
    try {
      for (const edit of state.edits) {
        if (edit.path !== path) continue;
        let el = null;
        try {
          el = document.querySelector(edit.selector);
        } catch (_) {}
        if (el && !isOurUi(el) && el.innerHTML !== edit.html) {
          el.innerHTML = edit.html;
        }
      }
    } finally {
      APPLYING.active = false;
    }
  }

  /* ------------------------------------------------------------- edit mode */

  function isOurUi(el) {
    return !!(el && el.closest && el.closest('[data-teo="1"]'));
  }

  function setEditMode(on) {
    editMode = !!on;
    document.documentElement.classList.toggle("teo-edit-mode", editMode);
    if (editMode) showBanner();
    else {
      finishEditing();
      hideBanner();
    }
    renderPanel();
  }

  function beginEditing(el) {
    if (!el || el.nodeType !== 1 || isOurUi(el)) return;
    if (activeEl && activeEl !== el) finishEditing();
    activeEl = el;
    el.setAttribute("data-teo-editing", "1");
    el.setAttribute("contenteditable", "true");
    el.focus();
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
    renderPanel();
  }

  function onTapCapture(e) {
    if (!editMode) return;
    const target = e.target;
    if (isOurUi(target)) return; // our own buttons work normally
    if (activeEl && activeEl.contains(target)) return; // typing in current

    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function")
      e.stopImmediatePropagation();

    finishEditing();
    beginEditing(target);
  }

  function onFocusOut(e) {
    if (activeEl && e.target === activeEl) {
      setTimeout(() => {
        if (activeEl === e.target) finishEditing();
      }, 0);
    }
  }

  /* -------------------------------------------------------------------- UI */

  function el(tag, props, kids) {
    const n = document.createElement(tag);
    n.setAttribute("data-teo", "1");
    if (props) Object.assign(n, props);
    (kids || []).forEach((k) =>
      n.appendChild(typeof k === "string" ? document.createTextNode(k) : k)
    );
    return n;
  }

  function buildUi() {
    if (fab) return;
    injectStyles();

    fab = el("button", { id: "teo-fab", type: "button", title: "Text Editor" });
    fab.textContent = "✎";
    fab.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePanel();
      },
      true
    );

    panel = el("div", { id: "teo-panel", hidden: true });

    document.body.appendChild(fab);
    document.body.appendChild(panel);
    renderPanel();
  }

  function togglePanel() {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) renderPanel();
  }

  function renderPanel() {
    if (!panel) return;
    const pageCount = state.edits.filter(
      (e) => e.path === location.pathname
    ).length;
    panel.textContent = "";

    const title = el("div", { className: "teo-title" }, [HOST]);

    const editBtn = el("button", {
      className: "teo-btn teo-primary" + (editMode ? " teo-active" : ""),
      type: "button",
    });
    editBtn.textContent = editMode ? "Stop editing" : "Start editing";
    editBtn.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        setEditMode(!editMode);
        if (editMode) panel.hidden = true; // reveal the page to edit
      },
      true
    );

    const toggleWrap = el("label", { className: "teo-row teo-toggle" });
    const toggleTxt = el("span", {}, ["Apply my edits here"]);
    const toggle = el("input", { type: "checkbox", checked: state.enabled });
    toggle.addEventListener(
      "change",
      (e) => {
        e.stopPropagation();
        state.enabled = toggle.checked;
        saveState();
        location.reload(); // apply / restore original
      },
      true
    );
    toggleWrap.appendChild(toggleTxt);
    toggleWrap.appendChild(toggle);

    const stats = el("div", { className: "teo-stats" }, [
      pageCount + " edits on this page · " + state.edits.length + " on site",
    ]);

    const resetPage = el("button", { className: "teo-btn teo-ghost", type: "button" });
    resetPage.textContent = "Reset page";
    resetPage.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        state.edits = state.edits.filter((x) => x.path !== location.pathname);
        saveState();
        location.reload();
      },
      true
    );

    const resetAll = el("button", { className: "teo-btn teo-danger", type: "button" });
    resetAll.textContent = "Reset site";
    resetAll.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        state.edits = [];
        saveState();
        location.reload();
      },
      true
    );

    const btnRow = el("div", { className: "teo-row teo-buttons" }, [
      resetPage,
      resetAll,
    ]);

    [title, editBtn, toggleWrap, stats, btnRow].forEach((c) =>
      panel.appendChild(c)
    );
  }

  function showBanner() {
    if (banner) return;
    banner = el("div", { id: "teo-banner" });
    const dot = el("span", { className: "teo-dot" });
    const txt = el("span", { className: "teo-banner-txt" }, [
      "Edit mode — tap any text to change it.",
    ]);
    const done = el("button", { id: "teo-done", type: "button" });
    done.textContent = "Done";
    done.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        setEditMode(false);
      },
      true
    );
    [dot, txt, done].forEach((c) => banner.appendChild(c));
    document.body.appendChild(banner);
  }

  function hideBanner() {
    if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
    banner = null;
  }

  function injectStyles() {
    if (document.getElementById("teo-style")) return;
    const css = `
      html.teo-edit-mode [data-teo-editing="1"]{
        outline:2px solid #ff9500 !important;outline-offset:2px;
        background:rgba(255,149,0,.08) !important;border-radius:3px;}
      #teo-fab{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));
        z-index:2147483646;width:48px;height:48px;border-radius:50%;border:0;
        background:#ff9500;color:#000;font-size:22px;line-height:48px;text-align:center;
        box-shadow:0 3px 10px rgba(0,0,0,.35);padding:0;}
      #teo-panel{position:fixed;right:16px;bottom:calc(74px + env(safe-area-inset-bottom,0px));
        z-index:2147483646;width:250px;background:#1c1c1e;color:#fff;border-radius:14px;
        padding:14px;box-shadow:0 6px 24px rgba(0,0,0,.4);
        font:14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}
      #teo-panel[hidden]{display:none;}
      #teo-panel .teo-title{font-size:12px;color:#9a9aa0;margin-bottom:10px;word-break:break-all;}
      #teo-panel .teo-btn{display:block;width:100%;border:0;border-radius:10px;padding:11px;
        font:600 14px -apple-system,sans-serif;margin-bottom:8px;}
      #teo-panel .teo-primary{background:#ff9500;color:#000;}
      #teo-panel .teo-primary.teo-active{background:#ff3b30;color:#fff;}
      #teo-panel .teo-ghost,#teo-panel .teo-danger{background:#2c2c2e;color:#fff;flex:1;}
      #teo-panel .teo-danger{color:#ff453a;}
      #teo-panel .teo-row{display:flex;align-items:center;gap:8px;}
      #teo-panel .teo-toggle{justify-content:space-between;background:#2c2c2e;
        border-radius:10px;padding:10px 12px;margin:4px 0 10px;}
      #teo-panel .teo-buttons{margin-bottom:0;}
      #teo-panel .teo-stats{color:#9a9aa0;font-size:12px;margin-bottom:10px;}
      #teo-panel input[type=checkbox]{appearance:none;width:44px;height:26px;background:#48484a;
        border-radius:13px;position:relative;flex:0 0 auto;}
      #teo-panel input[type=checkbox]::after{content:"";position:absolute;top:2px;left:2px;
        width:22px;height:22px;border-radius:50%;background:#fff;transition:transform .15s;}
      #teo-panel input[type=checkbox]:checked{background:#34c759;}
      #teo-panel input[type=checkbox]:checked::after{transform:translateX(18px);}
      #teo-banner{position:fixed;left:0;right:0;bottom:0;z-index:2147483645;display:flex;
        align-items:center;gap:10px;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));
        background:#1c1c1e;color:#fff;
        font:500 14px/1.3 -apple-system,BlinkMacSystemFont,sans-serif;
        box-shadow:0 -2px 12px rgba(0,0,0,.3);}
      #teo-banner .teo-dot{width:10px;height:10px;border-radius:50%;background:#ff9500;flex:0 0 auto;}
      #teo-banner .teo-banner-txt{flex:1;}
      #teo-banner #teo-done{border:0;border-radius:8px;padding:8px 16px;
        font:600 14px -apple-system,sans-serif;color:#000;background:#ff9500;}
    `;
    const style = document.createElement("style");
    style.id = "teo-style";
    style.setAttribute("data-teo", "1");
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  /* -------------------------------------------------------------- lifecycle */

  const observer = new MutationObserver((mutations) => {
    if (APPLYING.active || !state.enabled || !state.edits.length) return;
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
    document.addEventListener("click", onTapCapture, true);
    document.addEventListener("focusout", onFocusOut, true);
    document.addEventListener(
      "keydown",
      (e) => {
        if (activeEl && e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          finishEditing();
        }
      },
      true
    );
    applyEdits();
    buildUi();
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  loadState();
  try {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  } catch (_) {}

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
    scheduleApply();
  } else {
    boot();
  }
})();
