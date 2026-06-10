# Network & Security

## How your data stays private

Skylite-UX runs entirely on the Raspberry Pi. No Skylite company server, no cloud sync, no account to create anywhere. Family data never leaves the house.

- The PostgreSQL database lives on the Pi's SD card (or attached USB drive for backups).
- The app is only reachable inside the home WiFi by default — nobody outside can access it.
- Apple iCal sync is one-way: the Pi fetches the iCal URL on a schedule. Apple ID and password never touch the Pi. (Optional Google Calendar OAuth is read-write and stores a refresh token in the DB — no Google password on the Pi, but unlike iCal it is a stored credential.)
- **Built (our fork; upstream ships none):** each family member logs in with a PIN (hashed, never stored in plain text). Every API route requires a session; user/integration management requires an admin role. iCal calendar URLs are SSRF-guarded — the server refuses to fetch private/LAN addresses unless `FH_ALLOW_PRIVATE_URLS=true` is set in `.env`.

## Network setup

| Step | What to do |
|---|---|
| Give Pi a fixed IP | In router settings, assign the Pi a static local IP (e.g. 192.168.1.100). Address never changes; bookmarks keep working. |
| Keep it LAN-only | Do NOT forward port 3000 at the router. Also note Docker publishes `3000` on `0.0.0.0` (all interfaces) by default — fine on a trusted LAN, but to harden, bind it (`127.0.0.1:3000:3000` + a reverse proxy) or add a `ufw` rule scoped to your LAN subnet. Guest-WiFi devices cannot reach it. |
| Access on phones/tablets | Open a browser on any home device and go to `http://192.168.1.100:3000` (your Pi's actual IP). Bookmark or add to home screen. |
| Calendar source | iCal (Apple/Google/any `.ics`): right-click a calendar > Share > Copy Link, paste into calendar settings; Pi pulls on a schedule (read-only). Or authorize Google Calendar via OAuth for read-write sync. |
| Optional: Tailscale | For adding events from outside home, install Tailscale on the **Pi's host OS** (not inside Docker) and on your phone. The container uses the host's Tailscale. Free, end-to-end encrypted, no ports opened. |

## Guest network isolation

Put the Pi on the main WiFi SSID; put guest devices on a separate guest SSID. The router keeps them separated — guests cannot see the Pi or Family Hub even when in the house.
