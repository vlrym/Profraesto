# Audit and checkpoint

This is the original single-file audit. The subsequent calendar-stage audit and checkpoint are recorded in [Calendar refinement](CALENDAR_REFINEMENT.md).

The supplied `Profraesto_v1,1.html` was the source of truth. It contains roughly 1,900 lines of inline CSS and JavaScript, uses React 18.3.1, ReactDOM 18.3.1 and `htm` 3.1.1 from jsDelivr, and has no application backend. No existing separate source files or Git repository were present. `original.html` is an unchanged copy made before refactoring; the supplied root file also remains untouched.

## Preserve

- Profraesto branding, burgundy palette, dark mode, demo role switching and explicit local-prototype notice.
- Student search, department/status filters, favorites, bookable consultation slots and appointment history.
- Pending approval, student rescheduling/cancellation, professor decisions and useful alternative-time proposals.
- Weekly classes/consultation windows, date blocks, faculty CRUD through add/edit/deactivation and browser persistence.
- Existing dependencies; a bundler, TypeScript conversion and backend are unnecessary for this demonstration.

## Simplify

- Separate settings, styles, components, time helpers, scheduling rules and persistence.
- Replace the three-panel manual status/timer/Do Not Disturb editor with one short status confirmation panel.
- Remove new Knock submissions: this second visit-request workflow needs more dialogs and alert handling but never reserves a consultation. Old stored Knock alerts remain readable and replyable for compatibility.
- Use one consultation per slot rather than an optional capacity that permits overlapping bookings.
- Keep one small local Alerts view for existing request updates; do not add external messaging or notification infrastructure.

## Improve

- Class records lack building/room fields and live status cannot identify teaching location.
- Default new faculty are marked Available without faculty confirmation; expired timers also become Available.
- Reservation checks compare exact starting times instead of intervals.
- Schedule changes warn students while leaving affected consultations Approved. Removing consultation windows is not treated as a booking conflict.
- Nested stored records are not validated, so malformed schedules, missing faculty or invalid statuses can break rendering.
- Comma-separated faculty subjects split valid subject names containing commas.
- Professor cancellation is missing; future consultations can be marked completed prematurely.
- Modals lack focus containment and Escape handling. Routine feedback has limited accessibility semantics.
- Tall cards, duplicate descriptive text/counts and full-width schedule rows increase scrolling. Narrow forms and the schedule overview need better density.

The refactor preserves the application's components and interaction model. The reusable scheduling and storage modules replace the fragile rules; the project remains a local academic prototype.
