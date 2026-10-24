# Profraesto

A compact faculty availability and consultation prototype for LPU Davao. It keeps the original burgundy identity, React 18.3.1 and `htm` 3.1.1, with readable JavaScript modules and no build step.

## Start locally

Install Node.js 20 or newer, open a terminal in this folder, and run:

```sh
npm start
```

Open [Profraesto](http://127.0.0.1:4173). On Windows, use `npm.cmd start` if PowerShell blocks `npm.ps1`. Stop the server with Ctrl+C. Do not double-click `index.html`: browser modules need an HTTP server.

There is no dependency installation for normal use. Internet access is required for the same pinned React, ReactDOM and `htm` CDN scripts used by the original. The Node server only serves files on your computer; it is not an application backend.

## Demonstrate the roles

Choose **Load sample faculty** on an empty workspace, or switch to **Admin** and add a professor. Sample faculty are fictional and start **Not confirmed**.

- **Student:** search/filter faculty, save favorites, book the first suitable slot, and review, cancel or reschedule appointments.
- **Professor:** select a faculty member, confirm manual availability, edit weekly classes and consultation hours, add temporary exceptions, and respond to requests. Pending requests have a count in the navigation.
- **Admin:** add/edit faculty and deactivate/reactivate records. Deactivation preserves history and flags affected reservations.

Requests need professor approval. Time proposals require student acceptance. A schedule change, unavailability block or deactivation that invalidates a reservation changes it to **Needs action**, releases the slot and adds an in-app alert. Restoring the schedule does not automatically reapprove it.

## Scheduling rules

All dates and times use **Asia/Manila**, including on devices in other timezones. Status refreshes every five seconds while the page is active. Browsers can delay background timers; the current time is recalculated when the timer runs.

Priority: inactive/missing faculty → active exception or explicit unavailability → ongoing class → approved ongoing consultation → recent manual confirmation → Not confirmed. A cancelled class occurrence is ignored on that date. The absence of a class never means Available.

Classes have a subject, weekday, start/end, building and three-digit room. A class beginning at 09:00 includes 09:00 and ends at exactly its end time. Recurring entries must start and end on the same day. Whole-day exceptions include their final date and stop at the following midnight; a timed multi-day exception is one continuous interval.

Consultations use one reservation per 30-minute slot within posted consultation hours, up to 14 days ahead. Pending requests and proposed alternatives reserve time. Both student and professor overlaps are checked. Change building options, slot length, booking horizon, departments and defaults in [config/settings.js](config/settings.js).

## Data and prototype limits

This is a **single-browser, single-tab local demonstration**, not a shared booking system. Role switching is **not authentication**. The browser clock is trusted. Local storage is readable/editable by the person using the browser; do not store sensitive student information.

Data uses the original `profraesto-demo-v2` local-storage key. Storage belongs to the exact origin: opening the original as a file, changing the host/port, or using another browser does not transfer data. There is no cross-device sync, transactional server lock, email, SMS or push notification. Multiple tabs can overwrite one another; use one tab for demonstrations. Clearing browser data removes records. Storage failures show a warning, and in-memory edits may disappear on reload.

Old saved records are validated before rendering. Invalid records and conflicting legacy reservations are repaired or set aside, and the raw pre-repair value is saved as `profraesto-demo-v2-backup` where possible. A visible message asks you to review repairs. If saving that backup fails, persistent writes pause to protect the original. Legacy classes with no room stay visible and need editing; no real location is invented.

For a manual backup, use the browser's Developer Tools → Application → Local Storage and copy the main key's JSON into a file. Before restoring a backup, copy the current value elsewhere. Restore only trusted JSON under the same key, then reload; validation still runs. The backup key holds the latest repair snapshot, not a permanent archive.

## Tests

```sh
npm test
```

Core tests use Node's built-in test runner and need no packages. They supply controlled times to test class boundaries, midnight, conflicts, exceptions and persistence recovery.

Optional rendered UI tests require Playwright and Chromium:

```sh
npm install --no-save playwright
npx playwright install chromium
node tests/ui.cjs
```

The UI test starts and stops its own local server on port 4174, uses an isolated browser profile, and saves screenshots in `docs/screenshots`. If Edge is already installed, Chromium download is optional: in PowerShell set `$env:PROFRAESTO_BROWSER='msedge'` before running it. Test dependencies are optional and are not used by the application.

See [CODE_GUIDE.md](CODE_GUIDE.md), [the audit](docs/AUDIT.md), [changes and remaining work](docs/CHANGES.md), and [executed test results](docs/TEST_RESULTS.md).

The supplied `Profraesto_v1,1.html` is untouched. `docs/original.html` is the pre-change checkpoint. This is an academic prototype, not an official LPU Davao service.
