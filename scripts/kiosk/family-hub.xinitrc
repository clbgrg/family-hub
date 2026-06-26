#!/bin/sh
# Family Hub kiosk — X11 session.
#
# Copy to ~/.xinitrc on the Pi and start X from a console autologin, e.g. add to
# ~/.bash_profile:
#   if [ "$(tty)" = "/dev/tty1" ]; then exec startx; fi
#
# Pi OS Lite (X11) deps: xserver-xorg xinit unclutter xdotool python3-tk chromium-browser
# (On Pi OS Bookworm the browser binary may be `chromium` instead of `chromium-browser`.)

# No X screen blanking / DPMS — display sleep is handled by the app + cron, not X.
xset s off
xset -dpms
xset s noblank

# Hide the mouse cursor (touchscreen only).
command -v unclutter >/dev/null 2>&1 && unclutter -idle 0.5 -root &

# Load the exit-fullscreen button config, if present, and export it for the script.
if [ -f "$HOME/.config/family-hub/fsexit.env" ]; then
  . "$HOME/.config/family-hub/fsexit.env"
  export FSEXIT_CORNER FSEXIT_SIZE FSEXIT_MARGIN \
    FSEXIT_OPACITY_IDLE FSEXIT_OPACITY_ACTIVE FSEXIT_KEY FSEXIT_LABEL
fi

# Always-on-top exit-fullscreen touch button (background). Adjust the path to
# wherever you copied the script (e.g. /opt/family-hub/fullscreen-exit.py).
python3 "$HOME/family-hub-kiosk/fullscreen-exit.py" &

# The kiosk browser in the foreground; when it exits, the X session ends.
exec chromium-browser --kiosk --noerrdialogs --disable-infobars \
  --check-for-update-interval=31536000 \
  http://localhost:3000
