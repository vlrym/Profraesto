import { MINUTE, DAY_NAMES, STATUS_INFO, BUILDINGS, CONSULTATION_MINUTES } from '../../config/settings.js';
import { getDayOfWeek, timeToMinutes, formatTime12h, formatDate } from '../../utils/time.js';
import { formatRoomLocation, validateScheduleEntry, hasScheduleConflict } from '../../utils/scheduling.js';
import { newId, returnText } from '../helpers.js';
import { useState, html } from '../ui.js';
import * as domain from '../../utils/scheduling.js';
import { StatusPill } from './shared.js';
export function StatusPanel({ app, professor }) {
  const availability = app.getAvailability(professor);
  const [duration, setDuration] = useState('120');
  return html`<div class="card"><h3>Current availability</h3>
    <div class="status-live"><${StatusPill} status=${availability.status} /><span>${availability.reason}</span></div>
    <p class="small muted">Classes, approved consultations and temporary exceptions update this status automatically.</p>
    <label class="field-block"><span class="form-label">Confirm manual status for</span>
      <select value=${duration} onChange=${e => setDuration(e.target.value)}><option value="30">30 minutes</option><option value="60">1 hour</option><option value="120">2 hours</option></select>
    </label>
    <div class="row status-buttons">${['available', 'busy', 'unavailable'].map(status => html`<button class=${status === 'available' ? 'primary' : ''} onClick=${() => { app.updateProfessor(professor.id, { status, updatedAt: Date.now(), returnAt: Date.now() + Number(duration) * MINUTE, dnd: null }); app.showToast('Manual status confirmed.'); }}>${STATUS_INFO[status].label}</button>`)}
    <button onClick=${() => { app.updateProfessor(professor.id, { status: 'unknown', returnAt: null, dnd: null }); app.showToast('Manual confirmation cleared.'); }}>Clear confirmation</button></div>
    <p class="small muted">${returnText(professor, app.now)} · When confirmation expires, status returns to Not confirmed unless a scheduled activity is underway.</p>
  </div>`;
}

export function SchedulePanel({ app, professor }) {
  const emptyForm = { type: "class", day: 1, start: "09:00", end: "10:00", label: "", building: BUILDINGS[0], room: "" };
  const [form, setForm] = useState(emptyForm);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [absence, setAbsence] = useState({ startDate: "", endDate: "", reason: "Leave", kind: "block", start: "", end: "", classId: "" });
  const [absenceError, setAbsenceError] = useState("");
  const setField = (field, value) => setForm({ ...form, [field]: value });
  function addAbsence() {
    if (!absence.startDate || !absence.endDate || absence.endDate < absence.startDate) return setAbsenceError("Choose a valid start and end date.");
    const dateError = !domain.isValidDate(absence.startDate) || !domain.isValidDate(absence.endDate);
    if (dateError) return setAbsenceError('Enter valid dates.');
    if (!!absence.start !== !!absence.end || (absence.start && (!domain.isValidTime(absence.start) || !domain.isValidTime(absence.end))) || (absence.startDate === absence.endDate && absence.start && absence.start >= absence.end)) return setAbsenceError('Enter both times, with end after start. Leave both blank for whole days.');
    if (absence.kind === 'cancel-class' && (!absence.classId || absence.startDate !== absence.endDate || !professor.schedule.some(x => x.id === absence.classId && x.day === getDayOfWeek(absence.startDate)))) return setAbsenceError('Choose one date matching the selected class day.');
    app.blockDates(professor, absence.kind === 'cancel-class' ? { ...absence, start: '', end: '', reason: 'Class cancelled' } : absence);
    setAbsenceError("");
    setAbsence({ startDate: "", endDate: "", reason: "Leave", kind: "block", start: "", end: "", classId: "" });
    app.showToast("Exception saved. Affected bookings now need a new time.");
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingEntryId(null);
    setErrorMessage("");
  }

  function saveEntry() {
    if (!form.label.trim())
      return setErrorMessage(
        form.type === "class" ? "Enter a subject or class label." : "Enter an office location.",
      );
    const entry = {
      id: editingEntryId || newId(),
      type: form.type,
      day: Number(form.day),
      start: form.start,
      end: form.end,
      label: form.label.trim(),
      capacity: 1, building: form.type === "class" ? form.building : null, room: form.type === "class" ? form.room : null,
    };
    const validation = validateScheduleEntry(entry);
    if (validation) return setErrorMessage(validation);
    const newSchedule = editingEntryId
      ? professor.schedule.map((existing) => (existing.id === editingEntryId ? entry : existing))
      : [...professor.schedule, entry];

    // Warn about overlapping entries rather than silently accepting conflicting hours.
    if (hasScheduleConflict(professor.schedule, entry))
      return setErrorMessage("This time overlaps another schedule entry. Please adjust the hours.");
    app.changeSchedule(professor, newSchedule);
    app.showToast(editingEntryId ? "Entry updated." : "Entry added.");
    setEditingEntryId(null);
    setErrorMessage("");
    // Keep the last class details to make adding another day quicker.
    setForm({ ...form, day: Number(form.day) === 0 ? 1 : (Number(form.day) + 1) % 7 });
  }

  function startEditing(entry) {
    setForm({
      type: entry.type,
      day: entry.day,
      start: entry.start,
      end: entry.end,
      label: entry.label,
      capacity: 1, building: entry.building || BUILDINGS[0], room: entry.room || "",
    });
    setEditingEntryId(entry.id);
    scrollTo(0, 0);
  }

  function askToDelete(entry) {
    app.askToConfirm(
      `Delete “${entry.label}” (${DAY_NAMES[entry.day]} ${formatTime12h(entry.start)})?`,
      () => {
        app.changeSchedule(professor, professor.schedule.filter(existing => existing.id !== entry.id));
        app.showToast("Entry deleted.");
      },
    );
  }

  const sortedSchedule = [...professor.schedule].sort(
    (a, b) => a.day - b.day || timeToMinutes(a.start) - timeToMinutes(b.start),
  );

  return html`
    <div class="stack schedule-panel">
      <div class="card editor-card">
        <h3>${editingEntryId ? "Edit entry" : "Add entry"}</h3>
        <div class="form-grid">
          <label class="field-block"><span class="form-label">Entry type</span>
            <select value=${form.type} onChange=${(event) => setField("type", event.target.value)}>
              <option value="consult">Consultation hours</option>
              <option value="class">Class hours</option>
            </select>
          </label>
          <label class="field-block"><span class="form-label">Day of the week</span>
            <select value=${form.day} onChange=${(event) => setField("day", event.target.value)}>
              ${[1, 2, 3, 4, 5, 6, 0].map(
                (day) => html`<option key=${day} value=${day}>${DAY_NAMES[day]}</option>`,
              )}
            </select>
          </label>
          <label class="field-block"><span class="form-label">Start time</span>
            <input type="time" value=${form.start} onInput=${(event) => setField("start", event.target.value)} />
          </label>
          <label class="field-block"><span class="form-label">End time</span>
            <input type="time" value=${form.end} onInput=${(event) => setField("end", event.target.value)} />
          </label>
        </div>
        <div class="form-grid">
          <label class="field-block"><span class="form-label">${form.type === "class" ? "Subject or class label" : "Office location"}</span>
            <input placeholder=${form.type === "class" ? "Subject / class label" : "Office location"}
              value=${form.label} onInput=${(event) => setField("label", event.target.value)} />
          </label>
          ${form.type === "class" && html`<div class="form-grid">
          <label class="field-block"><span class="form-label">Building</span><select value=${form.building} onChange=${e => setField('building', e.target.value)}>${BUILDINGS.map(b => html`<option key=${b}>${b}</option>`)}</select></label>
          <label class="field-block"><span class="form-label">Room number</span><input inputMode="numeric" maxLength="3" placeholder="305" value=${form.room} onInput=${e => setField('room', e.target.value)} /></label>
        </div>`}
      </div>
        ${errorMessage && html`<div class="error-text">${errorMessage}</div>`}
        <div class="row">
          <button class="primary" onClick=${saveEntry}>
            ${editingEntryId ? "Save changes" : "Add entry"}
          </button>
          ${editingEntryId && html`<button onClick=${resetForm}>Cancel</button>`}
        </div>
      </div>

      <details class="card editor-card exception-editor">
        <summary><h3>Temporary exceptions</h3></summary>
        <div class="exception-fields">
        <p class="hint-text">Students cannot request new consultations on blocked dates. Affected bookings become Needs action and can be rescheduled. Leave times blank to block whole days.</p>
        <div class="form-grid">
          <label class="field-block"><span class="form-label">Exception</span><select value=${absence.kind} onChange=${e => setAbsence({ ...absence, kind: e.target.value })}><option value="block">Temporary unavailability</option><option value="cancel-class">Cancel one class occurrence</option></select></label>
        ${absence.kind === 'cancel-class' && html`<label class="field-block"><span class="form-label">Class</span><select value=${absence.classId} onChange=${e => setAbsence({ ...absence, classId: e.target.value })}><option value="">Choose class</option>${professor.schedule.filter(x => x.type === 'class').map(x => html`<option key=${x.id} value=${x.id}>${DAY_NAMES[x.day]} · ${x.label} · ${x.start}</option>`)}</select></label>`}
        <label class="field-block"><span class="form-label">From</span><input type="date" value=${absence.startDate} onInput=${e => setAbsence({ ...absence, startDate: e.target.value })} /></label>
          <label class="field-block"><span class="form-label">Through</span><input type="date" min=${absence.startDate} value=${absence.endDate} onInput=${e => setAbsence({ ...absence, endDate: e.target.value })} /></label>
          ${absence.kind === 'block' && html`<label class="field-block"><span class="form-label">Start time (optional)</span><input type="time" value=${absence.start} onInput=${e => setAbsence({ ...absence, start: e.target.value })} /></label><label class="field-block"><span class="form-label">End time (optional)</span><input type="time" value=${absence.end} onInput=${e => setAbsence({ ...absence, end: e.target.value })} /></label>`}
        <label class="field-block"><span class="form-label">Reason</span><select value=${absence.reason} onChange=${e => setAbsence({ ...absence, reason: e.target.value })}>
            ${["Leave", "Holiday", "Meeting", "Off campus", "Unavailable"].map(x => html`<option key=${x}>${x}</option>`)}
          </select></label>
        </div>
        ${absenceError && html`<div class="error-text">${absenceError}</div>`}
        <div><button class="primary" onClick=${addAbsence}>Save exception</button></div>
        ${(professor.exceptions || []).map(x => html`<div class="row exception-row" key=${x.id}>
          <div class="fill"><b>${formatDate(x.startDate)} – ${formatDate(x.endDate)}</b><div class="small muted">${x.kind === 'cancel-class' ? 'Class cancelled' : x.reason} ${x.start && x.end ? x.start + '–' + x.end : ''}</div></div>
          <button onClick=${() => app.updateProfessor(professor.id, { exceptions: (professor.exceptions || []).filter(e => e.id !== x.id) })}>Remove block</button>
        </div>`)}
        </div>
      </details>
      <div class="section-heading"><h3>Weekly schedule</h3><span class="section-caption">Philippine Time (PHT)</span></div>
      <div class="weekly-list">${sortedSchedule.length
        ? sortedSchedule.map(
            (entry) => html`
              <div class="card schedule-entry" key=${entry.id}>
                <div class="row">
                  <div class="fill">
                    <b>${DAY_NAMES[entry.day]} · ${formatTime12h(entry.start)}–${formatTime12h(entry.end)}</b>
                    <div class="small muted">
                      ${entry.type === "class" ? "Class" : "Consultation"} · ${entry.label}
                      ${entry.type === "class" ? " · " + (formatRoomLocation(entry.building, entry.room) || "Room needed — edit entry") : ` · ${CONSULTATION_MINUTES}-minute slots`}
                    </div>
                  </div>
                  <button onClick=${() => startEditing(entry)}>Edit</button>
                  <button onClick=${() => askToDelete(entry)}>Delete</button>
                </div>
              </div>
            `,
          )
        : html`<div class="card muted">No schedule entries yet.</div>`}</div>
    </div>
  `;
}


