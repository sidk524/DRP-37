# Tether browser extension

Blocks websites in Chrome or Edge during an active Tether desktop focus session.

## Install (unpacked, for development)

1. Start the desktop app: `npm run dev` from `WindowsApp/`.
2. Open Chrome at `chrome://extensions` or Edge at `edge://extensions`.
3. Enable **Developer mode**.
4. **Load unpacked** → select this folder (`WindowsApp/chrome-extension`).
5. Pin the extension. The popup should show **Connected** when the desktop app is running.
6. Check `http://127.0.0.1:17894/health` if the popup says the desktop app is not reachable.

## How it connects

- The desktop app serves `GET http://127.0.0.1:17894/api/block-state` and a live stream at `/api/block-state/stream`.
- The extension applies `declarativeNetRequest` rules when `active` is true and redirects blocked sites to the friction page in `blocked.html`.
- Breathing and reflect modes can continue after a short grace; hard mode stays blocked until the session ends.
- The extension polls the desktop app as a fallback if the live stream is unavailable.

## Notes

- Blocking applies only in browser profiles where this extension is installed.
- Keep the Tether desktop app running while a session is active.
- Firefox is not supported by this extension.
