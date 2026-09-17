# Text Editor Overlay — Safari Web Extension for iOS

A **client-side** browser extension that lets you edit the text shown on any
web page. Your edits are stored locally on your device and are **re-applied
every time you visit the page** (including after a refresh) until you turn
them off. Nothing is uploaded anywhere.

> **iOS reality check:** Only **Safari** supports extensions on iOS/iPadOS
> (16.4+). Chrome, Edge, Firefox and every other browser on iOS are required
> by Apple to use WebKit and **cannot run extensions**. So on iPhone/iPad this
> ships as a *Safari Web Extension* wrapped in a tiny app. The same
> `Resources/` folder is a standard Manifest V3 extension, so it also loads
> unchanged in desktop Chrome, Edge, Firefox and Safari.

## What it does

- **Edit any text in place.** Turn on edit mode, tap a piece of text, and type.
- **Persists across refreshes and navigations.** Edits are keyed by
  hostname + page path and re-applied on every load, even for text that a site
  injects dynamically (handled via a `MutationObserver`).
- **Stays until disabled.** A per-site toggle applies or suspends your edits;
  "Reset this page" / "Reset whole site" delete them.
- **Fully local & private.** Uses `storage.local` only — no network, no
  accounts, no analytics.

## How to use (once installed)

1. Open a page in Safari, tap the extensions button (the **puzzle/`ᴬA`**
   menu in the address bar) and open **Text Editor Overlay**.
2. Tap **Start editing**. A banner appears at the bottom of the page.
3. Tap any text, edit it, then tap elsewhere (or press Return) to save. Tap
   **Done** to leave edit mode.
4. Reload the page — your changes are still there.
5. To temporarily hide your edits, open the popup and turn off **Apply my
   edits here** (the page reloads to its original text). Turn it back on to
   restore them. Use the reset buttons to delete edits permanently.

## Repository layout

```
safari-ios-text-editor/
├─ Resources/                 ← the actual web extension (MV3)
│  ├─ manifest.json
│  ├─ content.js              ← editing + persistence engine
│  ├─ editor.css              ← injected page styles / banner
│  ├─ background.js           ← toolbar badge sync
│  ├─ popup.html / .css / .js ← the control popup
│  └─ images/                 ← icon-48…512.png
├─ SafariWebExtensionHandler.swift  ← native bridge (Xcode template boilerplate)
└─ README.md
```

## Building the iOS app (Xcode)

You need a Mac with Xcode. iOS extensions cannot be built or side-loaded from
a phone alone.

### Option A — let Xcode scaffold the project (recommended)

1. **File → New → Project… → Multiplatform/iOS → Safari Extension App**
   (older Xcode: *Safari Web Extension App*). Set Product Name e.g.
   `TextEditorOverlay`, language **Swift**, and choose **iOS** (also tick
   macOS if you want the desktop app too). When asked for a "Type", pick
   **None / no boilerplate** so it doesn't overwrite the JS below.
2. Xcode creates two targets: the **App** and the **Extension**. In the
   Extension target there is a `Resources/` group.
3. **Delete** the placeholder files Xcode put in that `Resources/` group and
   **drag in every file from this repo's `Resources/` folder**
   (`manifest.json`, the three `popup.*`, `content.js`, `editor.css`,
   `background.js`, and the `images/` folder). Choose **Copy items if needed**
   and add them to the **Extension** target.
4. Replace the generated `SafariWebExtensionHandler.swift` with the one in
   this repo (they're equivalent; ours just carries comments).
5. Select the **App** target → **Signing & Capabilities** → pick your Apple ID
   team. Do the same for the **Extension** target. A free personal Apple ID is
   enough for on-device testing (the app expires after 7 days and must be
   re-installed; a paid Apple Developer account removes that limit).
6. Choose your iPhone as the run destination and press **▶ Run**. The
   container app installs on the phone.

### Option B — reuse this folder as the extension resources

If you already have a Safari Web Extension app, just point its extension
target's resources at this `Resources/` directory (or copy the files in) and
rebuild. The `manifest.json` here is complete and self-contained.

## Enabling it on the iPhone

1. On the phone, open **Settings → Apps → Safari → Extensions**
   (older iOS: **Settings → Safari → Extensions**).
2. Turn on **Text Editor Overlay**.
3. Tap it → **Permissions** → set **All Websites** to **Allow** (needed so it
   can read and rewrite page text). You can restrict this to specific sites if
   you prefer.
4. In Safari, tap the page-settings button in the address bar → **Manage
   Extensions**, and make sure it's enabled there too.

If you don't see it, fully quit and reopen Safari after the first install.

## Notes, limits & tips

- **Element targeting.** Each edit is saved against a CSS path
  (`#id` when present, otherwise `tag:nth-of-type(n)`) plus the page's path.
  This is stable for most sites. Sites that completely re-shuffle their DOM
  between loads (some heavy single-page apps) may occasionally not find the
  original element — re-doing the edit fixes it.
- **What gets saved.** Editing an element saves its resulting HTML, so styling
  inside the edited element is preserved. Keep edits to the smallest text
  element you can for the most reliable re-application.
- **Scope.** Edits apply on the site + path where you made them; the same edit
  won't leak onto unrelated pages.
- **Privacy.** All data lives in the extension's local storage on your device.
  Removing the app or using the reset buttons deletes it.
- **Cross-browser.** For desktop Chrome/Edge: `chrome://extensions` → enable
  Developer mode → **Load unpacked** → select the `Resources/` folder. For
  desktop Firefox: `about:debugging` → **Load Temporary Add-on** → pick
  `Resources/manifest.json`.
