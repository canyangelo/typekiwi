# TypeKiwi

Write in your language, send in theirs. TypeKiwi is a Chrome extension that translates what you type in any chat
or text box into the other person's language while you type, and shows a translation under the messages you
receive.

## What it does

- **Live outgoing translation.** Stop typing for a moment and the box switches to the target language. Press
  Enter and the translated text is sent. A small label above the box shows your original text; click it or press
  Esc to send this one message untranslated.
- **Incoming translation.** On FunPay, Discord and Telegram Web, messages from others get a translation line
  underneath them, in your reading language.
- **Names stay names.** Usernames, links, emails and personal names are kept as they are instead of being
  transliterated.
- **Works in most text boxes.** Plain text fields and rich editors (Discord, Telegram, WhatsApp Web). Password,
  email and search fields are never touched. You can turn TypeKiwi off per site from its popup.
  A page can also opt a box out by putting `data-typekiwi="off"` on it or on a parent element.

## Translation engines

- **What you send** is translated with Google first, because it reads most naturally. If Google is busy or
  rate-limits the connection, Chrome's built-in on-device translator takes over at once.
- **What you receive** is translated on the device (Chrome 138 and later): fast, no limits, and the text never
  leaves the computer. Click a translated line to get Google's translation of that message instead.
- A language pack for the on-device translator is downloaded once per direction, on the first keystroke in a
  chat box or from the **Offline translation** row in the popup.

## Install (development build)

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this folder.
3. Under the extension's **Details**, set **Site access** to **On all sites**.
4. After every update press the reload button on the extension card, then reload open tabs.

## Development

```bash
npm test
```

Pure logic lives in `src/*.js` and is covered by `node --test`. `test/harness/` has pages that imitate FunPay and
a rich-text chat editor so the content script can be tried without the extension.

## License

TypeKiwi is **source-available, not open source**. You can read the code and contribute improvements, but you may
not copy, redistribute or publish your own version, and you may not use it for any commercial purpose. See
[LICENSE](LICENSE) and [CONTRIBUTING.md](CONTRIBUTING.md).

The name "TypeKiwi" and the TypeKiwi logo are not covered by the license. They may not be used for other
products, extensions, websites or store listings.
