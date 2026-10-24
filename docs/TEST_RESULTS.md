# Executed verification — in-memory state and GitHub Pages

Verified on **24 October 2026 (Asia/Singapore)** using Node 24.22.1, Vite 8.3.5 and Playwright Chromium.

These results supersede the historical calendar-redesign and storage-recovery reports.

## Automated tests: 49 passed, 0 failed

`npm.cmd test` passed all scheduling, calendar, sample-state and deployment-path tests with no skipped tests.

Coverage includes precise class/meeting/consultation boundaries, Manila date arithmetic, unavailable periods, class cancellations, room and input validation, booking overlaps, duplicate reservations, schedule reconciliation, calendar navigation, independent fresh sample objects, and Pages bases for local, renamed-repository, user-site and custom-domain hosting.

Tests for the removed browser-storage recovery and migration mechanisms were removed. Live input validation remains tested in the scheduling and calendar suites.

## Production build and browser workflows: passed

`npm.cmd run test:ui` builds the production bundle and exercises it through `scripts/serve.js`, a plain static-file test host with no application API or rewrite fallback. The final full browser run also passed with `GITHUB_REPOSITORY=example/FacultyPortal`, serving at `/FacultyPortal/`; a normal production build was then restored at `/Profraesto/`.

Verified through actual controls and rendered results:

- Sample faculty and weekday schedules appear automatically on initial load.
- Faculty department/status filtering, search and favorites work; favorites survive role navigation.
- Day/Week/Month, Today, previous/next, time-slot creation and multiple weekdays work.
- Calendar events can be created, edited, deleted, cancelled for one occurrence and restored; invalid rooms, conflicting times and invalid override expiries retain form feedback.
- Calendar-driven class, meeting, office-hour, consultation and unavailable states update at the simulated current time.
- Student requests remain visible across navigation and professor/student switches. Double submission creates one request.
- Approval, rejection, cancellation, conflict reconciliation, rescheduling and alternative-time acceptance work through calendar/request/appointment controls.
- Faculty addition, editing and deactivation work. Office edits immediately appear in the student directory; deactivated faculty disappear from it. Notification feedback appears in Alerts.
- Reload restores the original faculty, offices, empty appointment lists and favorites, and removes newly created events/faculty. A newly opened page also starts with fresh sample data.
- Storage getters for localStorage, sessionStorage and IndexedDB throw and record attempted access. The app made **zero accesses** during the tested workflows.
- External requests were blocked and recorded: **zero requests**. The bundle loads all runtime dependencies locally, with no backend or CDN.
- No browser runtime errors occurred.
- Student, professor and administrator layouts were checked at 1440, 768, 390 and 320 pixels; no document-wide horizontal overflow. Calendar internal scrolling, dialog Escape dismissal and theme switching work.

Screenshots are generated in ignored `test-results/screenshots/`. Desktop faculty and mobile calendar screenshots were visually inspected; the existing branding, layout and colors are preserved.

## Deployment configuration: passed locally

- `npm.cmd run build` succeeds and produces only `dist/index.html` and bundled assets.
- `.github/workflows/deploy.yml` passes YAML syntax validation using the `yaml` CLI and follows Vite's documented Pages workflow.
- The workflow installs from the committed lockfile, runs unit and production browser tests, uploads `dist/` and uses the Pages deployment action with Pages/OIDC permissions and a deployment environment.
- Repository path casing is derived from `GITHUB_REPOSITORY`; root/custom prefixes are covered by automated configuration tests.
- Generated build output, dependencies and test artifacts are ignored by Git.

No remote deployment was performed: this workspace has no configured Git repository or remote. Enable GitHub Actions as the repository's Pages source and push the source to the workflow's `main` branch to deploy.

Historical HTML/checkpoints remain reference files and are not included in the production bundle. Their older storage code is not used by the current app.
