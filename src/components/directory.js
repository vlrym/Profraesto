import { DEPARTMENTS, STATUS_INFO } from '../../config/settings.js';
import { formatDate, formatClock, getPhilippineNow } from '../../utils/time.js';
import { getNextScheduledActivity } from '../../utils/calendar.js';
import { displayName } from '../helpers.js';
import { useState, html } from '../ui.js';
import { StatusPill } from './shared.js';
export function FacultyCard({ professor, app }) {
  const availability = app.getAvailability(professor);
  const status = availability.status;
  const isFavorite = app.data.favoriteIds.includes(professor.id);
  const next = getNextScheduledActivity(professor, app.now, app.data.appointments);
  const nextLabel = next?.type === 'appointment' ? 'Consultation' : next?.type === 'class' ? 'Class' : next?.type === 'meeting' ? 'Meeting' : 'Unavailable';

  return html`
    <article class="card faculty-card">
      <div class="faculty-top">
        <div class="faculty-avatar" aria-hidden="true">${professor.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div>
        <div class="fill">
          <b class="faculty-name">${displayName(professor)}</b>
          <div class="faculty-department">${professor.department} · ${professor.office}</div>
        </div>
        <button
          class="icon-button"
          title=${isFavorite ? "Remove from favorites" : "Add to favorites"}
          aria-label=${isFavorite ? "Remove from favorites" : "Add to favorites"}
          aria-pressed=${isFavorite}
          onClick=${() => app.toggleFavorite(professor.id)}
        >
          ${isFavorite ? "★" : "☆"}
        </button>
      </div>
      <div class="status-line">
        <${StatusPill} status=${status} label=${availability.reason} />
        ${availability.until && html`<span class="small muted">Until ${formatClock(availability.until)}</span>`}
      </div>
      <div class="availability-detail small muted" aria-label="Availability explanation">${availability.detail || ''}</div>
      
      <div class="faculty-details">
        ${next ? html`<div class="small">Next: ${nextLabel} · ${next.date !== getPhilippineNow(app.now).date ? formatDate(next.date) + ', ' : ''}${formatClock(next.startAt)}</div>` : html`<div class="small muted">No upcoming scheduled activity</div>`}
      </div>
      <div class="faculty-bottom">
        ${availability.confirmedAt && html`<span class="faculty-updated">Confirmed ${formatDate(getPhilippineNow(availability.confirmedAt).date)} at ${formatClock(availability.confirmedAt)}</span>`}
        <div class="faculty-actions">
          <button class="primary" onClick=${() => app.openBooking(professor.id)}>Book consultation</button>
          
        </div>
      </div>
    </article>
  `;
}


export function Directory({ app }) {
  const [searchText, setSearchText] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const { favoriteIds } = app.data;
  const professors = app.data.professors.filter(p => p.active !== false);
  const departmentsInUse = DEPARTMENTS.filter((code) =>
    professors.some((professor) => professor.department === code),
  );

  const visibleProfessors = professors
    .filter((professor) => {
      const searchable = (professor.name + " " + professor.subjects.join(" ") + " " + professor.department + " " + professor.office).toLowerCase();
      return (
        (!searchText || searchable.includes(searchText.toLowerCase())) &&
        (!departmentFilter || professor.department === departmentFilter) &&
        (!statusFilter || app.getAvailability(professor).status === statusFilter) &&
        (!favoritesOnly || favoriteIds.includes(professor.id))
      );
    })
    // favorites first, then alphabetical
    .sort(
      (a, b) =>
        favoriteIds.includes(b.id) - favoriteIds.includes(a.id) ||
        (app.getAvailability(a).status === "available" ? -1 : 0) - (app.getAvailability(b).status === "available" ? -1 : 0) ||
        a.name.localeCompare(b.name),
    );

  let emptyMessage = "No faculty match your search.";
  if (professors.length === 0) emptyMessage = "No professors yet. Switch to Admin to add some.";
  else if (favoritesOnly && favoriteIds.length === 0)
    emptyMessage = "No favorites yet — tap ☆ on a card.";

  return html`
    <div class="stack directory-view">
      <section class="card filter-panel" aria-label="Faculty search and filters">
        <div class="filter-grid">
          <label class="search-wrap">
            <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6"></circle><path d="m16 16 5 5"></path></svg>
            <input aria-label="Search faculty by name, subject, department or office" placeholder="Search name, subject or room…" value=${searchText}
              onInput=${(event) => setSearchText(event.target.value)} />
          </label>
          <select aria-label="Filter by department" value=${departmentFilter} onChange=${(event) => setDepartmentFilter(event.target.value)}>
            <option value="">Department</option>
            ${departmentsInUse.map((code) => html`<option key=${code}>${code}</option>`)}
          </select>
          <select aria-label="Filter by status" value=${statusFilter} onChange=${(event) => setStatusFilter(event.target.value)}>
            <option value="">Any status</option>
            ${Object.entries(STATUS_INFO).filter(([key]) => !['busy','dnd'].includes(key)).map(
              ([key, info]) => html`<option key=${key} value=${key}>${info.label}</option>`,
            )}
          </select>
          <button class=${"favorites-toggle" + (favoritesOnly ? " primary is-active" : "")}
            aria-pressed=${favoritesOnly} onClick=${() => setFavoritesOnly(!favoritesOnly)}>★ Favorites</button>
        </div>
      </section>
      <div class="results-heading"><span>${visibleProfessors.length} faculty member${visibleProfessors.length === 1 ? '' : 's'}</span></div>
      ${visibleProfessors.length
        ? html`<div class="card-grid">
            ${visibleProfessors.map(
              (professor) => html`<${FacultyCard} key=${professor.id} professor=${professor} app=${app} />`,
            )}
          </div>`
        : html`<div class="empty-state">${emptyMessage}</div>`}
    </div>
  `;
}


