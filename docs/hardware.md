# Hardware

## Required parts

| Part | Notes | Est. Price |
|---|---|---|
| Raspberry Pi 5 (4GB) | 4GB is the sweet spot for the app stack. 1GB too tight with Docker + PostgreSQL. Official Pi 5 4GB model. | ~$95 |
| MicroSD card (64GB) | Samsung Pro Endurance or SanDisk Endurance — rated for continuous writes (24/7 device). Avoid no-name cards. | ~$15 |
| Official Pi 5 Power Supply | 27W USB-C. Do not use third-party — causes throttling and random reboots. | ~$12 |
| Portable touchscreen (10.1") | UPERFECT 10.1", built-in 10,000 mAh battery, capacitive 5-point touch, HDMI + USB-C, ~4-6 hrs untethered. Pi mounts to back. | ~$110-130 |
| Short HDMI cable (6-12 in) | Micro HDMI to HDMI — Pi to screen. Short keeps it tidy when mounted together. | ~$8 |
| Pi 5 case / back mount | Slim case that bolts Pi to back of screen via VESA or adhesive. Or 3D print (STL on Thingiverse). | ~$10-20 |

## Optional parts

| Part | Notes | Est. Price |
|---|---|---|
| PIR motion sensor | Wires into Pi GPIO. Wakes display when someone walks by. 3-wire connection. | ~$6 |
| Small USB speaker | Chore alerts, timers, dinner announcements. Pi has no built-in speaker. | ~$12-20 |
| USB drive (128GB) | Screensaver photos + database backups. Pi USB 3.0 port. | ~$15 |
| Pi Camera Module 3 | Optional motion detection without GPIO sensor, or future video-call features. | ~$25 |

## Total cost

Required only: ~$250-290 | With all optional parts: ~$350-380 | vs. Skylight commercial: $300-600 + annual subscription.

## Screen setup: carry-around + wall mount

The portable screen with built-in battery is the key to this build.

- The Pi 5 mounts to the back of the UPERFECT 10.1" screen using the included VESA holes and a bracket or 3D-printed mount.
- Pi connects to the screen via a short micro-HDMI to HDMI cable plus a USB-A cable for touch input.
- The screen's internal battery powers both display and Pi for 4-6 hours without a wall outlet.
- Wall mount: a single adhesive Command strip or small picture hook. Built-in kickstand for table use.
- Charging: one USB-C cable into the screen's charge port charges the battery and provides pass-through power to the Pi.

## Phone & tablet access

Any device on the home WiFi can open Family Hub in a browser — no app install. Go to `http://[pi-ip-address]:3000`. On iPhone: Safari > Share > Add to Home Screen for a native-app feel.
