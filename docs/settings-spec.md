# Settings Panel Spec

> ℹ️ **Status:** this was the target design; most of it is now **built** (Phase 8 + Phase 9): Family Profiles with admin/member roles + PINs, Your Account (sign out / change PIN), Calendar/Integrations (admin-gated), screensaver photo upload, and Network & Access (QR code). Deliberately not built: per-feature toggles beyond roles, display/sleep scheduling in-UI (Pi cron instead — `docs/pi-hardware.md`), and parental controls beyond admin/member gating.

The settings tab gives parents full control over all features. Recommended structure:

## Family Profiles
- Add or remove family members
- Assign display name, avatar color, and profile photo
- Set account type: Admin (parent) or Member (child) — *requires Priority-0 auth*
- Set PIN or password for each account — *built as part of Priority-0 auth*

## Calendar Settings
- Add iCal URL(s) for Apple Calendar or Google Calendar
- Set sync frequency (every 15 min, 30 min, 1 hour)
- Assign a color to each calendar source
- Enable or disable calendar on the main dashboard view

## Chores & Points
- Create, edit, or delete chores
- Set point value per chore
- Set recurrence: one-time, daily, weekly, or custom days
- Set chore reset time (default: midnight)
- Enable or disable streak tracking

## Rewards Store
- Create rewards with names, point costs, and optional photos
- Toggle whether kids can see the rewards store
- Approve or reject redemption requests

## Display & Sleep
- Set wake time and sleep time for auto screen on/off
- Set screensaver idle timeout (e.g. 5 minutes)
- Upload photos for screensaver slideshow
- Set screensaver transition speed

## Network & Access
- View the Pi's local IP address (for sharing with family)
- QR code that phones can scan to open the app in their browser
- Tailscale connection status (if enabled)

## Parental Controls
- Set time limits on specific app sections for child accounts
- Require parent approval for reward redemptions
- Hide or show specific tabs for child accounts
- View full chore history and point log per child
