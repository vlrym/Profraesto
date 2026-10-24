# Understanding and changing Profraesto

## 1. Project map

```text
index.html                     Page entry and the three original CDN dependencies
config/settings.js             Buildings, departments, labels and scheduling defaults
config/demo-data.js             Optional fictional faculty, created only on request
styles/app.css                 Color, spacing, typography, components and breakpoints
src/ui.js                      React hooks and the htm template helper
src/app.js                     Application state, actions, role navigation and layout
src/helpers.js                 Names, IDs, consultation-hour and status-expiry text
src/storage.js                 Browser persistence, validation and old-data recovery
src/components/shared.js       Status badge and accessible modal
src/components/directory.js    Student search, favorites and compact faculty cards
src/components/booking.js      Booking/rescheduling and alternative-time dialogs
src/components/appointments.js Request lists, statuses and role-specific actions
src/components/professor.js    Manual status, class/consultation editor and exceptions
src/components/admin.js        Faculty editor and deactivation
src/components/notifications.js Small local alert list; legacy Knock replies remain readable
utils/time.js                  Manila time, date arithmetic and display formatting
utils/scheduling.js            Availability, overlap rules, slots and booking validation
scripts/serve.js               Small local static-file server
tests/scheduling.test.js       Deterministic domain and storage tests
tests/ui.cjs                   Optional real browser workflow and responsive checks
docs/                         Audit, change report, test report and screenshots
```

JavaScript is sufficient here: the application already used React and `htm`, and a TypeScript build would add setup without solving a current requirement. Components stay as functions. There is no router, state framework, ORM or authentication layer.

## 2. How the page starts

`npm start` serves the folder at `http://127.0.0.1:4173`. `index.html` loads the original pinned React, ReactDOM and `htm` scripts, then loads `src/app.js` as a browser module. Imports load the other files automatically. React mounts `App` inside `#root`.

`src/ui.js` binds `htm` to `React.createElement`. A template such as `html\`<p>${name}</p>\`` describes a component without needing JSX compilation. Insert plain text through template expressions; React escapes it. Do not introduce `innerHTML` for user input.

`App` loads browser data once. It keeps role, current tab, selected professor, dialogs, theme and clock as separate state variables. Each component receives `app`, a small object containing the data and actions it needs.

## 3. Where each role lives

`TABS_BY_ROLE` in settings determines the navigation. `App` decides which component to show. Changing roles changes only the demonstration view; it does not authenticate or authorize anyone.

Students use `Directory`, `BookingDialog` and `AppointmentList`. The faculty card reads the derived status, rather than writing one. The booking dialog knows the demo student's name and selected professor, so it never asks for them again. It preselects the first bookable time and keeps form values when validation fails.

Professors select a faculty record once. `StatusPanel` confirms a status for a limited duration. `SchedulePanel` edits recurring entries and date exceptions. `AppointmentList` shows approve, decline, alternative-time, cancel and completion controls as appropriate. A consultation cannot be marked complete before it starts.

Administrators use `ManageFaculty`. Subjects are entered one per line, so a subject such as “Signals, Systems and Control” stays one subject. Faculty records are deactivated instead of deleted. No account records are created.

## 4. Availability is calculated, not saved as Teaching

Start with `getProfessorAvailability(professor, timestamp, appointments)` in `utils/scheduling.js`. The supplied timestamp makes the function easy to test. It returns an object such as:

```js
{ status: 'busy', reason: 'Teaching in SHL 305', activity: classEntry }
```

It applies the following order:

1. Missing or inactive faculty are unavailable.
2. Active date/time blocks, unexpired legacy Do Not Disturb, and a current manual Unavailable confirmation override other activities.
3. A recurring class currently in progress means Teaching, with its room. A matching one-date cancellation skips that occurrence.
4. An approved consultation currently in progress means Busy.
5. An unexpired manual Available or Busy confirmation supplies the status.
6. Otherwise, show Not confirmed.

Manual confirmations without an explicit expiry become stale after `MANUAL_STATUS_MINUTES`. The current UI always records an expiry. Expiring a timer never proves the professor is present. A class ending may reveal an existing recent manual confirmation; it does not create a new one.

`App` updates the clock every five seconds. Changing schedules updates React state immediately, so availability is recalculated during the next render. The displayed room exists only in the active class explanation; office and future-class details have separate labels.

## 5. Dates, midnight and cancelled classes

`getPhilippineNow()` uses `Intl.DateTimeFormat` with `Asia/Manila`. `toTimestamp(date, time)` explicitly uses `+08:00`. Day-of-week calculations use the date with UTC methods to avoid the host computer's timezone.

Intervals include the start and exclude the end: `[09:00, 10:30)`. Therefore 10:30 is free from that class. Adjacent activities do not overlap. Recurring entries cannot cross midnight; enter separate date/day entries for overnight activities. The editor uses minute precision and does not accept `24:00` as an end time. Overnight teaching is a remaining limitation; do not represent an exact midnight-ending class with a fictitious 23:59 end time.

An exception has `kind: 'block'` or `kind: 'cancel-class'`. A block can cover whole dates or one continuous date/time interval. A cancellation references a saved class ID and one matching weekday date. It removes only that class occurrence; it does not imply Available or automatically publish consultation hours there.

## 6. Buildings and room validation

Edit `BUILDINGS` in `config/settings.js` to add or rename SHL/JPL. `SchedulePanel` builds its dropdown from that list. `formatRoomLocation(building, room)` in `utils/scheduling.js` is the single room validator/formatter. It requires a configured building and exactly three digits, then returns `SHL 305`.

`validateScheduleEntry()` calls that function for classes. The UI has a numeric keyboard hint and a three-character limit, but the domain validation remains necessary. Updating room rules belongs in the shared function, not in every card. Rooms remain strings so leading zeroes are preserved.

## 7. Consultation conflict checking

`getOpenSlots()` walks the next `BOOKING_HORIZON_DAYS` dates, divides consultation windows into `CONSULTATION_MINUTES` slots, and removes past times, classes and blocked periods.

`validateConsultationRequest()` checks the date, time, reason, current faculty schedule and existing reservations. `appointmentConflicts()` checks schedule-based reasons. `isSlotTaken()` checks interval overlap, including different start times, for both the professor and demo student. Pending and Approved records reserve their requested time; Proposed records reserve the alternative time. Cancelled, declined, expired, completed and Needs action records do not reserve time.

The appointment ID is excluded when validating its own reschedule. The new request must use another time and goes back to Pending. A professor's proposed alternative needs student acceptance before becoming Approved. Slots are rechecked when requesting, approving and accepting a proposal.

When faculty details, schedules or exceptions change, `updateProfessor()` calls `reconcileAppointments()`. Future or ongoing affected reservations become Needs action, preserve their original details and receive a clear explanation. A local alert is created in the same state update. Removing a block never silently restores approval.

## 8. How state and storage update

The data object contains `professors`, `appointments`, `notifications` and `favoriteIds`. `updateData()` changes one list. `updateProfessor()` also reconciles affected reservations. `setData()` maintains a synchronous `dataRef` before asking React to render; a second Submit click sees the reservation just created by the first click.

This prevents duplicates within this running app instance. It does not coordinate other tabs or computers. Server transactions would be needed for reliable shared booking.

An effect saves changed data to local storage. The loader checks nested records, retains valid legacy classes needing room edits, removes unsafe malformed entries, and resolves duplicate legacy reservations to Needs action. Repairs keep the raw input under a backup key where storage permits. If the backup cannot be saved, writes pause instead of destroying the original. See the README for backup/recovery steps.

## 9. Changing appearance

Edit `styles/app.css`. `:root` holds colors, `--space-1` through `--space-5`, and `--radius`. The dark-theme block overrides colors. Typography starts with `body`, `h1`, `h2` and `h3`.

Component classes follow the same names used in templates: `.card`, `.faculty-card`, `.form-grid`, `.pill`, `.modal` and `.toast`. Responsive blocks adjust cards, forms and navigation at narrower widths. Some inherited component-specific dimensions remain explicit to preserve the existing design; shared tokens govern the refined layouts.

`Modal` uses native `<dialog>` for focus containment and Escape handling, restores focus on close, and prevents background scrolling. Errors remain inline; successes use a polite live-region toast. Destructive actions use the same modal component for confirmation.

## 10. Making a small feature change

For example, to add a building: edit `BUILDINGS`, run tests, start the app, and check the building dropdown and displayed room. For a booking rule: modify the scheduling module and add a controlled-time test before changing UI text. For a new faculty field: add it to the admin form, the saved record and storage normalization, then decide whether students actually need to see it.

To remove a feature, remove its control, action and unused imports, check old saved records still load, and update the guide. Avoid copying schedule comparisons into components. Reuse `hasScheduleConflict()` and `validateConsultationRequest()`.

## 11. Running and testing

Run `npm start` for the app and `npm test` for the core suite. No package download is needed for either. Tests use Node's built-in `node:test` and supply exact PHT timestamps, so there is no waiting for a real class to begin.

The optional Playwright test follows real role workflows, advances the browser clock across class boundaries, tests mobile dialog handling, and captures screenshots. Setup and commands are in the README. See `docs/TEST_RESULTS.md` for what was actually executed, rather than assuming an unrun check passed.

## 12. Sensible next steps

Keep using the local prototype for evaluation. If multiple real users must share bookings, first agree on server storage, authenticated identities and atomic reservation rules. A backend is justified then; adding a login screen to the existing browser-only data would not provide security. Offline packaging of the three pinned dependencies and a user-facing export/import flow are smaller possible future improvements.
