# Text Editor Overlay — mobile-only (no Mac, no Xcode)

This is the **iPhone/iPad-only** way to run the text editor: as a **userscript**
inside a Safari userscript-manager app you install straight from the App Store.
No computer, no build step, no developer account.

Same behaviour as the extension: tap text to edit it, edits are saved locally
and re-applied on every refresh/visit **until you disable them**. Everything
stays on your device (`localStorage`).

## Install (all on the phone)

1. **Get a userscript manager from the App Store.** Any of these work:
   - **Userscripts** — free & open source (recommended)
   - **Tampermonkey** — paid
   - **Stay** — paid
2. **Enable it in Safari:** Settings → Apps → Safari → Extensions → turn on the
   app → set its permission for **All Websites** to **Allow**. (On older iOS:
   Settings → Safari → Extensions.)
3. **Add the script:**
   - **Userscripts app:** open the app once and pick a scripts folder if asked.
     Then in Safari, tap the extensions (`ᴬA`/puzzle) button → **Userscripts**
     → the **+** / **New** menu → paste the contents of
     `text-editor-overlay.user.js` → **Save**. (You can also drop the `.user.js`
     file into the app's Files folder.)
   - **Tampermonkey:** open Safari to the raw `.user.js` file (e.g. from a
     GitHub "Raw" link) and Tampermonkey offers an **Install** screen — tap
     **Install**. Or use its dashboard → **+** → paste → save.
4. That's it. Open any web page.

## Use

- A small **orange ✎ button** appears at the bottom-right of every page.
- Tap it → **Start editing**. A banner shows at the bottom.
- Tap any text, edit it, tap elsewhere (or press Return) to save. Tap **Done**.
- Reload — your edits are still there.
- Reopen the ✎ panel to toggle **Apply my edits here** on/off (off restores the
  original text; on brings your edits back) or to **Reset page** / **Reset site**.

## Getting the script onto the phone

Easiest options:
- Push this repo and open the file's **Raw** view in Safari, then Install
  (Tampermonkey) or copy-paste (Userscripts).
- AirDrop / email / Files the `text-editor-overlay.user.js` to yourself and
  open it with the Userscripts app.

## Trade-offs vs. the Safari extension

| | Userscript (this) | Safari extension |
|---|---|---|
| Needs a Mac | ❌ no | ✅ yes (Xcode) |
| Install effort | App Store app + paste script | Build & sideload |
| Persists across refresh | ✅ | ✅ |
| Controls | on-page ✎ button | Safari toolbar popup |
| Storage | site `localStorage` | extension `storage.local` |

A **bookmarklet** is the only truly zero-install option, but it can't
auto-run on refresh — you'd have to tap it on every page load — so it doesn't
meet the "stays if refreshed" requirement. The userscript route above is the
lightest option that does.
