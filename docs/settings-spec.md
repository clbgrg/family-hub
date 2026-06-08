# Settings Panel Spec

> ⚠️ **Target design, not current state.** Upstream Skylite-UX today implements only **Family Profiles** (partial — name/color/avatar, no roles) and **Calendar Settings** (partial). Everything else below (Chores, Rewards, Display & Sleep, Network & Access, Parental Controls) is to-build per `docs/build-order.md`. Account type (Admin/Member) and PIN/password are **Priority 0 auth work** (`docs/features-to-build.md`), not standalone settings — the rest of Family Profiles and all Parental Controls depend on them.

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
