# Refinement report

This records the first refactoring stage. For the current calendar redesign, availability rules and limitations, see [Calendar refinement](CALENDAR_REFINEMENT.md) and the updated README.

## UI and workflow improvements

- Separate CSS, browser modules and centralized settings; no build process or new application framework.
- Consistent burgundy visual identity, spacing tokens, compact cards and inputs, clear primary booking actions and a two-column weekly overview on larger screens.
- Less repeated directory text; first bookable slot is selected automatically. Forms retain values on validation errors.
- One compact faculty status panel with timed confirmation instead of multiple overlapping manual controls.
- Structured class subject, day, time, building and room fields. All seven weekdays are supported.
- Class details stay in the form for adding another weekday quickly.
- Temporary time/date blocks and single-date class cancellation, with feedback for affected appointments.
- Native dialogs with keyboard focus, Escape and focus restoration; inline errors and accessible toasts.
- Optional sample faculty make evaluation possible without repetitive initial data entry.

## Removed or simplified

- New Knock submissions and their confirmation step; use consultation booking. Historical Knock alerts remain compatible.
- Optional group capacity; one reservation per consultation interval.
- Separate Back-at timer and Do Not Disturb editors; explicit timed manual status plus schedule exceptions cover current use cases. Legacy DND remains honored until cleared/expired.
- Automatic Available on new faculty and timer expiry.
- Repeated filter descriptions/result counts and unnecessary card details. Next-class information is expandable.

Favorites, dark mode, useful alternative-time proposals and the small local alert list remain because they support direct workflows already present in the source.

## Bugs and edge cases addressed

- Scheduled Teaching appears with the appropriate room and stops at the exact class end.
- No timetable gap is interpreted as confirmed presence; stale and expired confirmations become Not confirmed.
- Time calculations consistently use Manila and handle date changes independently of device timezone.
- Empty/invalid times, invalid dates, invalid room digits, overlapping recurring entries and mismatched class-cancellation dates are rejected.
- Past bookings, interval overlaps with different starting times, student double-booking, duplicate clicks, classes and blocked periods are checked.
- Professor approval and student proposal acceptance recheck availability.
- Schedule edits, consultation-window removal, temporary unavailability and faculty deactivation revoke invalid confirmations with Needs action and a local alert.
- Professor cancellation, rescheduling and completion restrictions are explicit.
- Long names/subjects/offices/descriptions are bounded, and long text wraps. Commas in subjects are retained through line-based entry.
- Missing faculty render safely. Empty searches/directories have clear next actions.
- Corrupt/nested invalid storage, legacy classes without rooms, old overlapping reservations, blocked storage and backup quota failures have recovery behavior.
- Consequential deletion/deactivation/cancellation uses a confirmation dialog; faculty history is retained.

## Remaining limits and future improvements

The prototype has browser-only persistence, one demo student, no authenticated identities, no shared transactional booking, and last-writer-wins behavior across tabs. Use one tab. It trusts the device clock and needs Internet for its original CDN dependencies. Background timers can be delayed, and mobile checks were browser emulation rather than physical-device testing.

Recurring classes must end later on the same day; exact midnight-ending/overnight teaching needs a future model extension. Class cancellations do not automatically publish new consultation windows. The latest raw repair backup is retained where possible, not a permanent audit history. Browser storage can still be cleared externally.

Potential next steps are offline dependency packaging, a simple export/import interface, and more physical-device/accessibility testing. Introduce authenticated server storage and atomic booking transactions only when real shared use is required. No production security or synchronization is implied by demo role switching.
