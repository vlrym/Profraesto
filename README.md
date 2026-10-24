# Profraesto

A calendar-driven faculty availability and consultation prototype developed for academic evaluation in the LPU Davao context. It is not an officially deployed or endorsed university service.

## Run locally

Use Node.js 22.12 or later (Node 24 is used in deployment). From this folder:

```sh
npm ci
npm start
```

Open the URL printed by Vite, normally [Profraesto](http://127.0.0.1:5173/Profraesto/). Use `npm.cmd` instead of `npm` if Windows PowerShell blocks `npm.ps1`. Stop with Ctrl+C. Serve the site over HTTP instead of double-clicking `index.html`.

The existing React 18.3.1 and htm 3.1.1 components are preserved. Vite bundles these dependencies and CSS into static files; the deployed app needs no CDN, backend, API, database, credentials or external service. Internet access is needed to install dependencies and deploy, not to run an already downloaded production build.

## Use the application

Every page load starts with fictional faculty Maria Santos and Paolo Reyes, their weekday classes and consultation hours, and sample student Alex Mendoza. Appointment, notification and favorite lists begin empty so visitors can follow the workflows themselves. The unobtrusive role selector provides student, professor and administrator views; it is **not authentication**.

- **Students:** search/filter faculty, read current calendar-derived status and its end time, see the next scheduled commitment, and book a consultation. Appointments retain approval, cancellation, alternative-time and rescheduling workflows.
- **Professors:** Calendar opens in Week view. Use Day/Week/Month, Today, previous/next, or select a date from Month. Click a time slot or Add event. Click an existing event to view, edit or delete it, or handle a consultation request directly in the dialog. The Requests tab remains for reviewing the full queue.
- **Administrators:** add/edit faculty and deactivate/reactivate records without deleting consultation history.

The calendar supports recurring classes, consultation windows and office hours; one-time meetings; timed or whole-day unavailable periods; and single-date class cancellations. Selecting multiple weekdays creates independent recurring entries; edit each through its calendar occurrence. Editing or deleting a recurring entry affects all its weekly occurrences. Cancel only this occurrence leaves the weekly series intact, and its dashed cancelled entry can be restored.

Week and Month retain readable column widths on small screens and scroll horizontally **inside** the calendar. Day view fits the available phone width. Keyboard-accessible time buttons and Add event provide alternatives to pointer interaction. No drag-and-drop is used.

## Availability rules

Everything uses **Asia/Manila**. The display recalculates each second while active and refreshes when the tab regains visibility/focus. Background browser timers can be delayed; returning to the app recalculates from the current clock.

Priority, highest first:

1. Missing/inactive faculty, explicit Unavailable override, or active unavailable period/exception. Unexpired legacy Do Not Disturb is treated as explicit unavailability.
2. Current class — **Teaching at SHL 401**, with its scheduled subject and end time.
3. Current meeting — **In a Meeting**.
4. Approved ongoing consultation — **In Consultation**.
5. Explicit manual Available confirmation.
6. Configured office hours — **Available**, accompanied by “Scheduled office hours · presence not confirmed.”
7. **Status Unconfirmed**.

Ordinary consultation windows advertise bookable times; they do not assert Available. Pending, proposed and Needs action consultations do not assert In Consultation. A gap between classes never proves that the professor is available.

Manual overrides are optional: until changed, through the end of today, or until a chosen time today. They have no mandatory two-hour expiry. Available never overrides a commitment; Unavailable can interrupt one. Manual confirmation dates are shown when relevant.

**A calendar cannot track physical whereabouts.** If a professor leaves unexpectedly without updating it, the app cannot know. Planned office hours and faculty confirmations describe their source; no location sensing is implied.

## Booking and conflicts

Slots use configured consultation/office windows and default to 30 minutes, up to 14 days ahead. Classes, meetings, explicit unavailability, blocked periods, past times and existing reservations are excluded or rejected. Pending requests reserve their time; proposed alternatives reserve the alternative time. Student and professor overlaps are checked, including different start times.

Overlapping classes or meetings are rejected. Availability windows can contain commitments, which are subtracted when calculating bookable slots. Unavailable periods can intentionally overlap an activity and take priority. A class/meeting/window change, override or deactivation that invalidates a future or ongoing consultation moves it to **Needs action**, releases the reservation and creates a contextual update. Restoring a schedule never silently reapproves it.

Intervals include their start and exclude their end: a 09:00–10:30 class ends at 10:30. Recurring entries must start and end on one day and use minute precision; exact midnight-ending/overnight recurring classes remain unsupported. One-time meetings can cross midnight, up to 24 hours. Use Unavailable for longer blocks. All-day blocks include the selected Through date and end at the following midnight.

Buildings, three-digit room handling, departments, slot length and booking horizon have central configuration. See [CODE_GUIDE.md](CODE_GUIDE.md).

## In-memory architecture and project scope

`App` owns one React state object containing professors, appointments, notifications and favorite IDs. It initializes once with `createDemoData()` from `config/demo-data.js`. All role views read and update this shared object. Faculty edits, schedule changes, approvals, cancellations and notifications remain consistent through navigation, dialogs, calendar view changes and role switching.

A full page refresh or reopening the site creates fresh sample data. There are no localStorage, sessionStorage, IndexedDB, storage backups, restoration effects or backend writes. Existing browser data from older versions is ignored. Each tab is independent; changes are never shared across tabs, browsers or devices. Theme and role selections are also temporary.

This project showcases interface and scheduling behavior, not actual university records. It is not an officially deployed or endorsed university service. The device clock is trusted. Notifications appear inside the app while it is open; email, SMS, push notifications and background services are not included.

## Build and deploy to GitHub Pages

```sh
npm run build
npm run preview
```

Preview normally opens at `http://127.0.0.1:4173/Profraesto/`. Deploy only the generated `dist/` contents. `dist/`, dependencies and test screenshots are ignored by Git; commit `package-lock.json` for reproducible installs.

`vite.config.js` defaults to `/Profraesto/`. In GitHub Actions it derives the exact, case-sensitive repository name from `GITHUB_REPOSITORY`, so renaming the repository updates the build path automatically. A `<username>.github.io` repository uses `/`. For a custom domain or another hosting prefix, set `PAGES_BASE_PATH` to `/` or the desired `/prefix/` in the build environment. Navigation stays within the page and requires no server rewrites.

1. Push the source and lockfile to the repository's `main` branch (adjust the workflow branch if needed).
2. In **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source.
3. The included `.github/workflows/deploy.yml` installs dependencies, runs unit and production browser tests, uploads `dist/` and deploys Pages. It also supports manual runs from Actions.

The workflow follows [Vite's GitHub Pages deployment guidance](https://vite.dev/guide/static-deploy.html#github-pages). No generated build files need committing. Historical HTML and `docs/checkpoints/` are reference material only and are excluded from the Vite build.

## Tests

```sh
npm test
```

Core tests use Node's built-in runner, including controlled times for class, meeting, consultation, override and midnight transitions.

Production browser checks:

```sh
npx playwright install chromium
npm run test:ui
```

The test builds the app and starts/stops a plain static test server on port 4174, serving the repository subpath without rewrite fallbacks. It blocks browser storage and external requests, exercises real role/calendar/consultation/faculty workflows, verifies refresh resets, and saves screenshots in ignored `test-results/screenshots/`. To use installed Edge instead, set `$env:PROFRAESTO_BROWSER='msedge'` in PowerShell. Playwright is a development dependency only.

See [executed results](docs/TEST_RESULTS.md) and [the code guide](CODE_GUIDE.md). Older audit reports, original HTML and `docs/checkpoints/before-calendar/` describe historical versions and may refer to the removed persistence design.
