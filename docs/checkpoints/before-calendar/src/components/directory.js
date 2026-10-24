import { DEPARTMENTS, DAY_NAMES, STATUS_INFO } from '../../config/settings.js';
import { getDayOfWeek, formatTime12h } from '../../utils/time.js';
import { formatRoomLocation, getNextScheduledClass } from '../../utils/scheduling.js';
import { displayName, returnText } from '../helpers.js';
import { useState, html } from '../ui.js';
import { StatusPill } from './shared.js';
export function FacultyCard({ professor, app }) {
  const availability = app.getAvailability(professor);
  const status = availability.status;
  const isFavorite = app.data.favoriteIds.includes(professor.id);
  const nextClass = getNextScheduledClass(professor, app.now);

  return html`
    <article class="card faculty-card">
      <div class="faculty-top">
        <div class="faculty-avatar" aria-hidden="true">${professor.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div>
        <div class="fill">
          <b class="faculty-name">${displayName(professor)}</b>
          <div class="faculty-department">${professor.department} · ${professor.subjects.join(", ")}</div>
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
        <${StatusPill} status=${status} />
        <span class="small muted">${returnText(professor, app.now)}</span>
      </div>
      <div class="small muted" aria-label="Availability explanation">${availability.reason}</div>
      
      <div class="faculty-details">
        <div class="detail-row"><span class="detail-icon" aria-hidden="true">⌖</span><span>${professor.office}</span></div>
        
        <div class="detail-row"><span class="detail-icon" aria-hidden="true">◷</span><span>${app.nextSlotText(professor)}</span></div>
        ${nextClass && html`<details class="small"><summary>Next class · ${DAY_NAMES[getDayOfWeek(nextClass.date)]} ${formatTime12h(nextClass.start)}</summary>${nextClass.label} · ${formatRoomLocation(nextClass.building, nextClass.room) || "Room not specified"}</details>`}
      </div>
      <div class="faculty-bottom">
              <span class="faculty-updated">${professor.updatedAt ? "Last faculty update: " + new Date(professor.updatedAt).toLocaleString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " PHT" : "No manual availability confirmed yet"}</span>
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
        <div class="toolbar-top">
          <div><h2>Find a professor</h2></div>
          <span class="count-badge">${visibleProfessors.length} found</span>
        </div>
        <div class="filter-grid">
          <label class="search-wrap">
            <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6"></circle><path d="m16 16 5 5"></path></svg>
            <input aria-label="Search faculty by name, subject, department or office" placeholder="Search name, subject or room…" value=${searchText}
              onInput=${(event) => setSearchText(event.target.value)} />
          </label>
          <select aria-label="Filter by department" value=${departmentFilter} onChange=${(event) => setDepartmentFilter(event.target.value)}>
            <option value="">All departments</option>
            ${departmentsInUse.map((code) => html`<option key=${code}>${code}</option>`)}
          </select>
          <select aria-label="Filter by status" value=${statusFilter} onChange=${(event) => setStatusFilter(event.target.value)}>
            <option value="">Any status</option>
            ${Object.entries(STATUS_INFO).map(
              ([key, info]) => html`<option key=${key} value=${key}>${info.label}</option>`,
            )}
          </select>
          <button class=${"favorites-toggle" + (favoritesOnly ? " primary is-active" : "")}
            aria-pressed=${favoritesOnly} onClick=${() => setFavoritesOnly(!favoritesOnly)}>★ Favorites</button>
        </div>
      </section>
      <div class="results-heading"><h2>Faculty members</h2></div>
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


