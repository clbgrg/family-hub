# Pi Hardware Add-ons (sleep + motion wake)

> ⚠️ **UNTESTED, REQUIRES PI HARDWARE.** Everything in this file runs on the
> Raspberry Pi's host OS and depends on `vcgencmd` (Pi OS only) and, for motion
> wake, a wired PIR sensor on the GPIO header. None of it has been run or
> verified — it can't be, off-Pi. Treat these as starting points to test on the
> actual device, not as working/verified code like the rest of the app.

These are the Phase 9 polish items that are inherently Pi-hardware-dependent, so
they live outside the Docker app (which is platform-agnostic). The screensaver
and the QR access code are in the app itself and work anywhere.

## Sleep mode (display on/off on a schedule)

Turn the screen off at night and back on in the morning. Two cron jobs on the
Pi (also referenced in `docs/installation.md`, step 10):

```cron
# Screen off at 9:00pm, on at 6:30am (Pi OS, requires vcgencmd)
0 21 * * *  /usr/bin/vcgencmd display_power 0
30 6 * * *  /usr/bin/vcgencmd display_power 1
```

`vcgencmd display_power 0` blanks the HDMI output; `1` restores it. The desired
times would ideally come from the app's settings, but wiring a kiosk-local
config file that the cron reads is future work — for now they're hardcoded in
crontab.

## Motion wake (PIR sensor → wake the display)

Wake the screen when someone walks up, instead of waiting for the morning cron.

**Wiring (example, HC-SR501 PIR):** VCC → 5V (pin 2), GND → GND (pin 6),
OUT → GPIO17 (pin 11). Adjust the BCM pin below to match.

`/opt/family-hub/motion-wake.py`:

```python
#!/usr/bin/env python3
# UNTESTED — requires a Pi with a PIR sensor on the GPIO header.
import subprocess
import time

from gpiozero import MotionSensor  # pip install gpiozero

PIR_PIN = 17  # BCM numbering

def wake():
    subprocess.run(["/usr/bin/vcgencmd", "display_power", "1"], check=False)

def main():
    pir = MotionSensor(PIR_PIN)
    while True:
        pir.wait_for_motion()
        wake()
        time.sleep(2)  # debounce

if __name__ == "__main__":
    main()
```

Run it at boot with a systemd service, `/etc/systemd/system/motion-wake.service`:

```ini
[Unit]
Description=Family Hub motion wake
After=multi-user.target

[Service]
ExecStart=/usr/bin/python3 /opt/family-hub/motion-wake.py
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now motion-wake.service
```

**To verify on the Pi:** blank the screen (`vcgencmd display_power 0`), wave at
the sensor, confirm it powers back on; check `systemctl status motion-wake` and
`journalctl -u motion-wake` for errors.
