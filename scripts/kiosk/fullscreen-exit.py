#!/usr/bin/env python3
"""Family Hub kiosk — always-on-top "exit fullscreen" touch button (X11).

A tiny, semi-transparent, always-on-top button parked in a screen corner. Tap
it to send Escape to the Chromium window, which leaves page fullscreen (HTML5
video, YouTube, PDF viewer, F11). It does NOT exit `chromium --kiosk` itself
(Escape doesn't affect kiosk mode), so Family Hub stays full-screen.

Config via environment (see fsexit.env.example):
  FSEXIT_CORNER          top-left | top-right | bottom-left | bottom-right  (default top-right)
  FSEXIT_SIZE            button size in px (default 64)
  FSEXIT_MARGIN          gap from the screen edge in px (default 16)
  FSEXIT_OPACITY_IDLE    0..1 when idle (default 0.35)
  FSEXIT_OPACITY_ACTIVE  0..1 when touched/hovered (default 1.0)
  FSEXIT_KEY             key(s) xdotool sends on tap (default "Escape")
  FSEXIT_LABEL           button glyph/text (default "✕")

Requires: python3-tk, xdotool, an X11 session.
UNTESTED on real Pi hardware — validate on the device (see docs/installation.md).
"""
import os
import shutil
import subprocess
import sys
import tkinter as tk


def _env(name, default):
    value = os.environ.get(name)
    return value if value not in (None, "") else default


def _env_float(name, default):
    try:
        return float(_env(name, default))
    except (TypeError, ValueError):
        return float(default)


def _env_int(name, default):
    try:
        return int(_env(name, default))
    except (TypeError, ValueError):
        return int(default)


CORNER = _env("FSEXIT_CORNER", "top-right").lower()
SIZE = _env_int("FSEXIT_SIZE", 64)
MARGIN = _env_int("FSEXIT_MARGIN", 16)
OPACITY_IDLE = _env_float("FSEXIT_OPACITY_IDLE", 0.35)
OPACITY_ACTIVE = _env_float("FSEXIT_OPACITY_ACTIVE", 1.0)
KEY = _env("FSEXIT_KEY", "Escape")
LABEL = _env("FSEXIT_LABEL", "✕")  # ✕


def send_key():
    """Focus Chromium, then send the configured key to it (real key event)."""
    if not shutil.which("xdotool"):
        print("fullscreen-exit: xdotool not found on PATH", file=sys.stderr)
        return
    # Bring Chromium to focus so the key lands on it even if the tap briefly
    # focused the overlay. A missing match is harmless (no-op).
    subprocess.run(
        ["xdotool", "search", "--onlyvisible", "--class", "chromium",
         "windowactivate", "--sync"],
        check=False,
    )
    subprocess.run(["xdotool", "key", "--clearmodifiers", *KEY.split()], check=False)


def main():
    root = tk.Tk()
    root.title("fs-exit")
    root.overrideredirect(True)        # no border / WM decorations
    root.attributes("-topmost", True)  # float above other windows
    try:
        root.attributes("-alpha", OPACITY_IDLE)
    except tk.TclError:
        pass

    screen_w = root.winfo_screenwidth()
    screen_h = root.winfo_screenheight()
    x = MARGIN if "left" in CORNER else screen_w - SIZE - MARGIN
    y = MARGIN if "top" in CORNER else screen_h - SIZE - MARGIN
    root.geometry(f"{SIZE}x{SIZE}+{x}+{y}")

    button = tk.Label(
        root, text=LABEL, fg="white", bg="#111111",
        font=("DejaVu Sans", max(10, int(SIZE * 0.42))),
    )
    button.pack(fill="both", expand=True)

    def set_alpha(alpha):
        try:
            root.attributes("-alpha", alpha)
        except tk.TclError:
            pass

    def on_enter(_event=None):
        set_alpha(OPACITY_ACTIVE)

    def on_leave(_event=None):
        set_alpha(OPACITY_IDLE)

    def on_tap(_event=None):
        set_alpha(OPACITY_ACTIVE)
        send_key()
        root.after(400, on_leave)

    for widget in (root, button):
        widget.bind("<Enter>", on_enter)
        widget.bind("<Leave>", on_leave)
        widget.bind("<ButtonRelease-1>", on_tap)

    # Re-assert always-on-top so a window that JUST went fullscreen can't cover us.
    def keep_on_top():
        try:
            root.attributes("-topmost", True)
            root.lift()
        except tk.TclError:
            pass
        root.after(2000, keep_on_top)

    keep_on_top()
    root.mainloop()


if __name__ == "__main__":
    main()
