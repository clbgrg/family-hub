# Installation

Assumes a fresh Raspberry Pi 5 with Pi OS Lite (64-bit) on a microSD card. Whole setup ~45-90 min, mostly download waits.

## Step-by-step setup

| Step | Commands / Notes |
|---|---|
| 1. Flash Pi OS | Raspberry Pi Imager on Mac/PC. Choose Pi OS Lite 64-bit. In settings, enable SSH and set WiFi credentials before flashing. |
| 2. Boot and connect | Insert card, power on. SSH in: `ssh pi@raspberrypi.local` — or use the IP from your router's device list. |
| 3. Install Docker | `curl -fsSL https://get.docker.com \| sh` then `sudo usermod -aG docker pi` |
| 4. Clone Skylite-UX | `git clone https://github.com/Wetzel402/Skylite-UX.git` then `cd Skylite-UX` |
| 5. Configure .env | `cp .env.example .env` then edit with nano — set DB password, secret key, port (3000), and `APP_PUBLIC_URL=http://[pi-ip]:3000` (what the Settings QR code encodes — Docker can't detect the Pi's LAN IP itself). |
| 6. Start the app | `docker compose up -d` — downloads and starts everything. First run 5-10 min. |
| 7. Open in browser | On any WiFi device, go to `http://[pi-ip]:3000` — Skylite-UX setup screen. |
| 8. Set static IP | In router admin, find the Pi's MAC and assign a fixed local IP. Note it for the family. |
| 9. Chromium kiosk | On the Pi: install the X11 kiosk packages, drop in the session + exit-fullscreen button from `scripts/kiosk/`, and boot to `http://localhost:3000` fullscreen. See "Kiosk mode" below. |
| 10. Configure sleep | **Pi-specific (skip on dev machines).** Two cron jobs: `vcgencmd display_power 0` at bedtime, `display_power 1` in the morning. `vcgencmd` exists only on Pi OS — these won't run on a Mac/PC/other-SBC dev box; validate on a real Pi. |

## Kiosk mode — fullscreen at boot (X11)

The kiosk runs Chromium fullscreen under **X11** (Xorg), deliberately — so an
always-on-top touch overlay can sit above page-fullscreen content (see
"Exit-fullscreen touch button" below), which is much harder under Wayland.

1. Install the kiosk packages:
   ```bash
   sudo apt install --no-install-recommends \
     xserver-xorg xinit x11-xserver-utils unclutter xdotool python3-tk chromium-browser
   ```
   (On Pi OS Bookworm the browser may be packaged as `chromium`; adjust the launch command in `~/.xinitrc`.)
2. Copy the session + button files from this repo's `scripts/kiosk/` to the Pi:
   ```bash
   mkdir -p ~/family-hub-kiosk ~/.config/family-hub
   cp scripts/kiosk/fullscreen-exit.py  ~/family-hub-kiosk/
   cp scripts/kiosk/family-hub.xinitrc  ~/.xinitrc
   cp scripts/kiosk/fsexit.env.example  ~/.config/family-hub/fsexit.env
   ```
3. Start X at boot: enable console autologin (`sudo raspi-config` → System → Boot / Auto Login → Console Autologin), then append to `~/.bash_profile`:
   ```sh
   if [ "$(tty)" = "/dev/tty1" ]; then exec startx; fi
   ```
4. Reboot — the Pi boots to console, autostarts X, and `~/.xinitrc` launches the exit-fullscreen button + the Chromium kiosk on `http://localhost:3000`.

Touchscreen tap and scroll work automatically in Chromium kiosk mode; the USB touch cable provides input.

### Exit-fullscreen touch button

Pages can go fullscreen (F11, HTML5 video, YouTube, the PDF viewer) and hide their own controls, leaving no way back on a touchscreen. `scripts/kiosk/fullscreen-exit.py` (launched by `~/.xinitrc`) parks a small, semi-transparent, always-on-top button in a screen corner; tapping it sends **Escape** to Chromium to leave page fullscreen — without exiting `chromium --kiosk`. It becomes fully opaque while touched.

Configure it by editing `~/.config/family-hub/fsexit.env` — corner placement, size, opacity, key, and glyph (see `scripts/kiosk/fsexit.env.example`). A systemd **user** unit (`scripts/kiosk/fullscreen-exit.service`) is provided as an alternative launch method for systemd-managed graphical sessions.

> ⚠️ **Untested on hardware.** Like the motion-wake sensor (see `pi-hardware.md`), the kiosk session and the exit-fullscreen overlay are documented and scripted but **not yet validated on a real Pi 5 + touchscreen** (no hardware). The Python passes a syntax check and the logic runs on any Linux X11 desktop, but always-on-top-over-fullscreen stacking, touch input, and autostart need on-device validation. **Acceptance test:** boot to kiosk → open a YouTube video → fullscreen → tap the corner button → it returns to windowed; repeat for an HTML5 `<video>`, a PDF, and F11; flip `FSEXIT_CORNER` and confirm the button moves.
