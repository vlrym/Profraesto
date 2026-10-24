# Profraesto code guide

## Project structure and startup

```text
index.html                          CSS and Vite app module entry
config/settings.js                  Buildings, labels, event types and booking defaults
config/demo-data.js                 Fresh fictional faculty on each page load
styles/app.css                      Base visual system and shared components
styles/calendar.css                 Calendar plus compact layout refinements
src/app.js                          Shared in-memory state, role views and actions
src/ui.js                           React hooks and htm helper
src/helpers.js                      IDs, faculty names and consultation-hours text
src/components/calendar.js          Professor's Day/Week/Month workspace and event dialogs
src/components/event-editor.js      Short type-specific event form
src/components/override-panel.js    Flexible optional availability override
src/components/directory.js         Student faculty search and status cards
src/components/booking.js           Booking, rescheduling and alternative-time dialogs
src/components/appointments.js      Shared appointment display and decision controls
src/components/admin.js             Faculty management
src/components/notifications.js     Small local update list
src/components/shared.js            Status badge and accessible modal
utils/time.js                       Manila dates, formatting and date arithmetic
utils/calendar.js                   Calendar ranges, occurrences, navigation and event lanes
utils/scheduling.js                 Status priority, validation, booking and reconciliation
vite.config.js                     Repository-aware GitHub Pages base path
.github/workflows/deploy.yml        Tests, static build and Pages deployment
scripts/serve.js                    Test-only static host for dist/ (no rewrites)
tests/*.test.js                     Pure scheduling/calendar/state tests
tests/ui.cjs                        Production browser workflows and screenshots
docs/checkpoints/before-calendar/  Saved version before this redesign
```

Run `npm ci`, then `npm start` to serve the project with Vite. `index.html` imports `src/app.js`; `src/ui.js` imports React and htm from npm, and `src/app.js` imports ReactDOM's `createRoot`. React renders `App` into `#root`. `npm run build` bundles the reachable modules and styles into `dist/`; `npm run preview` serves that production build. There is no application backend or runtime CDN dependency.

The existing React function components remain. `html` from `src/ui.js` is an htm template tag: `html\`<p>${name}</p>\`` works without JSX compilation. Text expressions are escaped by React; do not add `innerHTML` for user-entered values.

## The data model

Top-level data still has four lists: professors, appointments, notifications and favoriteIds. New calendar information lives on each professor, so existing IDs and consultation history remain usable.

```js
// Recurring weekly entry: class, consult or office
professor.schedule = [{
  id: 'weekly-1', type: 'class', day: 1,
  start: '09:00', end: '10:30', label: 'Engineering Mathematics',
  building: 'SHL', room: '401'
}];

// One-time event: meeting or unavailable
professor.events = [{
  id: 'meeting-1', type: 'meeting', label: 'Department meeting',
  date: '2026-10-26', endDate: '2026-10-26', start: '15:00', end: '16:00'
}];

// Optional override, independent of recurring commitments
professor.override = { status: 'unavailable', setAt: 1792998000000, until: null };
```

`day` uses Sunday 0 through Saturday 6. Class subjects are ordinary strings, so commas are safe. Room numbers remain strings to preserve leading zeroes.

`exceptions` retains date-specific legacy blocks and `cancel-class` records referencing a recurring class ID and a date. The new editor creates unavailable events; it can also convert an edited legacy block. A cancelled class remains a dashed calendar occurrence with a Restore action.

Approved, pending and proposed consultations remain in `appointments`. They are projected into the calendar when displayed; they are never copied into a professor's saved schedule. Needs action records remain visible for resolution but do not reserve time or assert a live consultation.

## How the calendar works

`FacultyCalendar` stores the selected date, view and open dialog. Week is the default. `getCalendarRange()` returns one day, a Monday-based week or a 42-cell month grid. `navigateCalendar()` moves by the correct unit; month navigation starts on day 1 to avoid skipping February from January 31.

`getCalendarEvents()` expands recurring entries over the visible dates, includes one-time events and date exceptions, and projects relevant appointments. Each occurrence records its source: schedule, event, exception or appointment. That source tells the UI which saved record to edit. Multi-day events are clipped into daily display pieces while retaining their real start/end timestamps.

Day/Week use time columns, half-hour add buttons, a current-time line and current-day highlighting. Month uses date cells with a short event list and a More action that opens Day. Views keep scroll inside the calendar. Day fits phones; Week/Month preserve readable columns with horizontal scrolling. No drag-and-drop is needed.

`layoutTimedEvents()` gives overlapping foreground events separate lanes. Office/consultation windows use pale backgrounds. Text color alone is not the only distinction: event labels and pending/cancelled dashed borders also communicate meaning. Full event names/times are available through accessible names, tooltips and the event dialog when compact cells abbreviate them.

The event editor shows only relevant inputs. Classes have subject, recurring weekday checkboxes, times and structured room controls. Consultation/office windows have recurring days, times and a location/title. Meetings and unavailable periods have dates and times; only unavailable periods expose All day. Selecting multiple weekdays creates separate weekly entries, making later edits straightforward rather than introducing a complex recurrence-series model.

Editing a recurring occurrence changes that weekday entry every week. Cancel only this occurrence creates an exception; it does not delete the recurring record. Delete event asks for confirmation and explicitly describes whether the entire weekly entry is affected.

## How automatic status is calculated

`getProfessorAvailability(professor, timestamp, appointments)` in `utils/scheduling.js` is the single status calculation function. It uses the same expanded calendar information shown by the UI and returns one object:

```js
{ status: 'teaching', reason: 'Teaching at SHL 401', detail: 'Engineering Mathematics', until: endTimestamp }
```

The priority is explicit unavailability/exception → class → meeting → approved ongoing consultation → manual availability → configured office hours → Status Unconfirmed. Inactive or missing faculty are unavailable. Classes and meetings cannot overlap when entered through the editor; the priority still makes imported conflicting data deterministic.

Pending/proposed/Needs action visits do not set In Consultation. Consultation windows do not set Available: they advertise request times. Office hours explicitly permit Available and disclose that presence is unconfirmed. Free time alone never proves availability. A timetable and manual confirmations cannot detect an unexpected departure.

Manual overrides support until changed (`until: null`), the rest of the Manila day (next midnight), or a selected time today. Unavailable overrides scheduled activities; Available yields to them. The confirmation timestamp is retained and shown when relevant. The old `status`, `updatedAt`, `returnAt` and DND fields are read only for backward compatibility, and new override controls clear them appropriately. `MANUAL_STATUS_MINUTES` applies only to old records, not new override durations.

`App` refreshes time each second and on visibility/focus return. Changing a professor updates the clock immediately too. Teaching is derived rather than saved as state. Browsers may delay background timers, but the next refresh computes from the current time rather than counting missed ticks.

## Dates and boundaries

`getPhilippineNow()` formats using Asia/Manila. `toTimestamp()` uses an explicit `+08:00` offset. Date-only arithmetic uses UTC methods, so the computer's timezone does not move events to another day.

All intervals include their start and exclude their end. A class stops at 10:30 exactly; an adjacent activity can start at 10:30. Recurring entries must end later on the same day and do not accept `24:00`. Overnight recurring classes are not supported. One-time meetings can cross midnight but are limited to 24 hours; longer absences use Unavailable.

An All day block stores 00:00 on its first date through 00:00 on the day after the chosen Through date. The editor converts that exclusive stored end back to an inclusive date when reopened. This avoids 23:59 approximations and missing the last minute of the day.

## Room/building changes

Edit `BUILDINGS` in `config/settings.js` to add another building. The event editor generates its dropdown from this array. `formatRoomLocation()` is the one formatter/validator in `utils/scheduling.js`: it checks a configured building and exactly three digits, then returns `SHL 401`.

`validateScheduleEntry()` uses it for class entries. The UI limits input length and requests a numeric keyboard, but validation remains in the reusable function. A legacy class with no room stays editable and displays Room not specified, rather than inventing one.

## Booking rules and changes that affect visits

`getOpenSlots()` walks `BOOKING_HORIZON_DAYS` dates and divides consultation/office windows into `CONSULTATION_MINUTES` slots. Availability windows can overlap classes or meetings: those commitments are subtracted. Identical slots from overlapping office/consultation windows are deduplicated.

`appointmentConflicts()` checks faculty state, explicit overrides, exceptions, classes, meetings, unavailable events and posted booking windows. `isSlotTaken()` checks interval overlap for both professor and student. `validateConsultationRequest()` also validates future time and the concern text. Pending visits reserve their requested time; Proposed reserves the alternative time. An appointment's own ID is excluded when rescheduling or approving it.

`validateScheduleEntry()` and `hasScheduleConflict()` reject overlapping entries of the same recurring type. `validateCalendarEvent()` rejects class/meeting conflicts for one-time meetings. Unavailable can overlap intentionally. A meeting may overlap an approved visit when added, because that change is handled visibly through reconciliation rather than silently retained as a conflicting confirmation.

`updateProfessor()` calls `reconcileAppointments()` on every faculty update. Affected future/ongoing Pending, Approved or Proposed visits become Needs action, preserve their details and receive an explanatory local update. The student can choose another time. Restoring a class or removing a block never automatically restores approval.

To change slot length, booking horizon or labels, start with settings. To change conflict behavior, edit the scheduling module and add a controlled-time test. Avoid putting separate overlap rules in directory or calendar rendering code.

## In-memory state and reliability

`App` owns data and role navigation. `updateData()` changes a list; `updateProfessor()` additionally reconciles consultations. `setData()` updates a synchronous reference before React renders, so a second Submit click sees the first reservation. This protects one running app instance, not other tabs or computers.

`useState(createDemoData)` initializes the shared data once when `App` mounts. The factory returns fresh nested objects and arrays, so mutations never change a reusable seed singleton. Role switching and tab/calendar navigation do not remount `App` or rerun the factory. A full page reload or a newly opened tab creates a fresh instance. Do not call the seed factory from navigation effects or move domain data into child views.

The storage module, migration logic, automatic save effects and storage notices were removed. No application code reads or writes browser storage, databases or APIs. Runtime validation stays in `utils/scheduling.js` and the input forms. Role selection chooses a view, not an authenticated identity. Each tab is independent; this project is for fictional records and interface evaluation.

To modify sample faculty or recurring schedules, edit `config/demo-data.js`; each professor needs unique IDs, arrays for schedule/events/exceptions and an optional override. To change the sample student, edit `STUDENT_NAME` in settings. Keep appointments, notifications and favorites in the same top-level data object so every role sees updates immediately. Use `updateProfessor()` for timetable changes so appointment reconciliation and student feedback also run.

## Static hosting

`vite.config.js` uses `GITHUB_REPOSITORY` to derive `/<repository>/`, with `/Profraesto/` as the local default. User/organization Pages repositories ending in `.github.io` use `/`. `PAGES_BASE_PATH` overrides the prefix for custom hosting. Keep asset imports relative to the module or HTML entry so Vite can rewrite and fingerprint them. The app uses state-based navigation; no history router or rewrite rules are needed.

The Pages workflow builds and tests with Node 24, then uploads only `dist/`. Source archives and documentation checkpoints are not build inputs. Set the repository's Pages source to GitHub Actions; see README for deployment steps. Commit the lockfile, not generated build files.

## UI and styling

Edit shared colors, typography and spacing tokens in `styles/app.css`. Calendar grids, event colors, compact directory refinements and responsive rules are in `styles/calendar.css`, loaded after the base styles.

Student cards display the same calculated status as the professor calendar. The end time, source detail and next real commitment are concise. Subjects remain searchable but are not repeated on every card. `Modal` uses native dialog focus containment, Escape and focus restoration. Routine feedback uses toasts; invalid input stays in the form with an inline error.

## Adding another event type

1. Decide whether it recurs weekly or belongs to a specific date. Add its label in `CALENDAR_TYPES`.
2. Add only the necessary editor fields in `EventEditor`, and validate them in the scheduling module.
3. Include the type in `getCalendarEvents()` projection and sample data where appropriate.
4. Decide its live status priority, booking effect and reconciliation behavior in `utils/scheduling.js`.
5. Add restrained calendar styling, tests and documentation. Do not add a new system when an existing type already describes the activity.

## Testing simulated time

Run `npm test`. Tests call the pure functions with exact timestamps, for example:

```js
const now = toTimestamp('2026-10-26', '09:00');
const status = getProfessorAvailability(professor, now, appointments);
```

Check just before start, exactly at start, and exactly at end. Tests cover Manila midnight, overnight meetings, recurring cancellations, manual overrides and calendar navigation without waiting in real time.

`npm run test:ui` builds production files and runs `tests/ui.cjs` with Playwright's controlled browser clock. It serves `dist/` through a plain static server at the configured Vite base path, follows real student/professor/admin flows and captures desktop/mobile layouts in ignored `test-results/screenshots/`. Storage getters throw and record access attempts; off-origin requests are blocked. Tests assert no such accesses occur, changes survive navigation/role switching, and reload restores samples. Build and browser tests read the same repository/base environment variables, including on Actions. Setup is in README; executed outcomes are in `docs/TEST_RESULTS.md`.
