# Network & Security

## How your data stays private

Skylite-UX runs entirely on the Raspberry Pi. No Skylite company server, no cloud sync, no account to create anywhere. Family data never leaves the house.

- The PostgreSQL database lives on the Pi's SD card (or attached USB drive for backups).
- The app is only reachable inside the home WiFi by default — nobody outside can access it.
- Apple Calendar sync is one-way: the Pi fetches the iCal URL on a schedule. Apple ID and password never touch the Pi.
- Each family member has their own login. Passwords are hashed, never stored in plain text.

## Network setup

| Step | What to do |
|---|---|
| Give Pi a fixed IP | In router settings, assign the Pi a static local IP (e.g. 192.168.1.100). Address never changes; bookmarks keep working. |
| Keep it LAN-only | Do NOT forward port 3000. App reachable only inside the house. Guest-WiFi devices cannot reach it. |
| Access on phones/tablets | Open a browser on any home device and go to `http://192.168.1.100:3000` (your Pi's actual IP). Bookmark or add to home screen. |
| Apple iCal URL | Apple Calendar: right-click a calendar > Share > Copy Link. Paste into Skylite-UX calendar settings. Pi pulls on a schedule. |
| Optional: Tailscale | For adding events from outside home, install Tailscale on Pi and phone. Free, end-to-end encrypted, no ports opened. |

## Guest network isolation

Put the Pi on the main WiFi SSID; put guest devices on a separate guest SSID. The router keeps them separated — guests cannot see the Pi or Family Hub even when in the house.
