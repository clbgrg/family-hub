# Installation

Assumes a fresh Raspberry Pi 5 with Pi OS Lite (64-bit) on a microSD card. Whole setup ~45-90 min, mostly download waits.

## Step-by-step setup

| Step | Commands / Notes |
|---|---|
| 1. Flash Pi OS | Raspberry Pi Imager on Mac/PC. Choose Pi OS Lite 64-bit. In settings, enable SSH and set WiFi credentials before flashing. |
| 2. Boot and connect | Insert card, power on. SSH in: `ssh pi@raspberrypi.local` — or use the IP from your router's device list. |
| 3. Install Docker | `curl -fsSL https://get.docker.com \| sh` then `sudo usermod -aG docker pi` |
| 4. Clone Skylite-UX | `git clone https://github.com/Wetzel402/Skylite-UX.git` then `cd Skylite-UX` |
| 5. Configure .env | `cp .env.example .env` then edit with nano — set DB password, secret key, port (3000). |
| 6. Start the app | `docker compose up -d` — downloads and starts everything. First run 5-10 min. |
| 7. Open in browser | On any WiFi device, go to `http://[pi-ip]:3000` — Skylite-UX setup screen. |
| 8. Set static IP | In router admin, find the Pi's MAC and assign a fixed local IP. Note it for the family. |
| 9. Chromium kiosk | On the Pi: install Chromium, add a startup script to open `http://localhost:3000` fullscreen kiosk at boot. |
| 10. Configure sleep | **Pi-specific (skip on dev machines).** Two cron jobs: `vcgencmd display_power 0` at bedtime, `display_power 1` in the morning. `vcgencmd` exists only on Pi OS — these won't run on a Mac/PC/other-SBC dev box; validate on a real Pi. |

## Kiosk mode — fullscreen at boot

To show the app fullscreen at boot (no browser chrome, no taskbar):

1. Install Chromium: `sudo apt install chromium-browser`
2. Create autostart dir: `mkdir -p ~/.config/autostart`
3. Add a `.desktop` file that runs: `chromium-browser --kiosk --noerrdialogs http://localhost:3000`
4. Reboot — the Pi boots directly into Family Hub fullscreen.

Touchscreen tap and scroll work automatically in Chromium kiosk mode; the USB touch cable provides input.
