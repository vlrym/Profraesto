# Calendar refinement — 22 October 2026

## Audit and preserved work

The current modules and saved screenshots were inspected before editing. The first refinement had centralized teaching status, booking guards and storage recovery, but professor navigation still opened a manual status panel, with arbitrary 30/60/120-minute choices and a long schedule editor. The directory repeated status explanations and headings, and prominent prototype banners consumed useful space.

The refactor retains React/htm, room validation, existing faculty IDs, role access, search/favorites, request approval and alternative times, rescheduling, cancellation, history-preserving faculty deactivation, toasts/dialogs and browser persistence. No new runtime package or backend was added.

Before substantial edits, the working source, styles, configuration, tests, entry point and guides were copied to `checkpoints/before-calendar/`. The original standalone HTML is still untouched.

## Changes

- Professor Calendar is the default workspace with Day, Week and Month views, Today, navigation, current-day highlighting, a live time line and restrained event colors.
- One calendar shows weekly classes, consultation/office windows, one-time meetings, unavailable periods and real appointment records. Pending/Needs action and cancelled events have explicit labels/dashed borders.
- Time slots open the event editor; event dialogs support editing/deleting and direct consultation decisions. Classes can be added on several weekdays, cancelled once and restored.
- Optional availability overrides support until changed, rest of today or a chosen time. Fixed two-hour timers are no longer the main interface or data model.
- Office hours explicitly permit scheduled Available; ordinary consultation windows do not. Student cards show Teaching at the correct room, end time, source information and the next commitment.
- Meeting and unavailable periods participate in booking exclusion and affected-appointment reconciliation. Invalid confirmations become Needs action and receive a contextual update.
- Student layout has one short search/filter row and compact cards. Repeated headings, descriptions, routine prototype banners, role labels and institutional disclaimers are removed from normal pages; limitations remain in README.
- Calendar logic and event editor are separate, readable modules, with no calendar framework, drag-and-drop or recurrence infrastructure.

## Conflict and priority decisions

Explicit unavailability wins, followed by teaching, meetings, approved consultations, explicit manual availability, configured office hours, then Status Unconfirmed. Only one current status is returned. Planned commitments never claim physical whereabouts.

Same-type recurring overlaps and class/meeting conflicts are rejected. Booking windows can contain commitments, which are excluded from slots. Unavailable periods may interrupt commitments intentionally. Changes affecting existing visits flag them for resolution; they never remain deceptively approved. Cancelled/restored dates do not silently change visit approval.

## Limits retained honestly

Data is still local to one browser origin and one tab; there is no authentication or cross-device lock/synchronization. Device time is trusted and background timers may be delayed. Internet is required for the original CDN dependencies. Overnight recurring classes are unsupported; one-time meetings support midnight crossings up to 24 hours. Multi-day unavailability is supported. Different selected weekdays become independent recurring entries. Month/Week use internal horizontal scrolling on phones, with Day as the narrow-screen alternative. Compact event titles may abbreviate, with full accessible labels, tooltips and details.

For real shared deployment, authentication and atomic server-side booking would be necessary. That infrastructure was deliberately not introduced into this academic prototype.
