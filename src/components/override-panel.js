import { html, useState } from '../ui.js';
import { getPhilippineNow, addDays, formatClock } from '../../utils/time.js';
import { getManualOverride, toTimestamp, isValidTime } from '../../utils/scheduling.js';

export function OverridePanel({ app, professor, onClose }) {
  const current = getManualOverride(professor, app.now);
  const [status, setStatus] = useState(current?.status === 'available' ? 'available' : 'unavailable');
  const [duration, setDuration] = useState('today');
  const [time, setTime] = useState('17:00');
  const [error, setError] = useState('');
  function save() {
    const now = Date.now();
    const today = getPhilippineNow(now).date;
    const until = duration === 'changed' ? null : duration === 'today'
      ? toTimestamp(addDays(today, 1), '00:00') : toTimestamp(today, time);
    if (duration === 'time' && (!isValidTime(time) || until <= now)) return setError('Choose a time later today.');
    app.updateProfessor(professor.id, { override: { status, setAt:now, until }, status:'unknown', returnAt:null, dnd:null });
    app.showToast('Availability override saved.');
    onClose();
  }
  return html`<h3>Availability override</h3>
    <p class="small muted">Use for an unexpected change. Classes, meetings and confirmed consultations still take priority over Available.</p>
    ${current && html`<p class="small">Current override: ${current.status === 'available' ? 'Available' : 'Unavailable'} · ${current.until ? 'until ' + formatClock(current.until) : 'until changed'}</p>`}
    <label class="field-block"><span class="form-label">Status</span><select value=${status} onChange=${e => setStatus(e.target.value)}><option value="unavailable">Unavailable</option><option value="available">Available</option></select></label>
    <label class="field-block"><span class="form-label">Keep this override</span><select value=${duration} onChange=${e => setDuration(e.target.value)}><option value="today">For the rest of today</option><option value="changed">Until I change it</option><option value="time">Until a time today</option></select></label>
    ${duration === 'time' && html`<label class="field-block"><span class="form-label">Until</span><input type="time" value=${time} onInput=${e => setTime(e.target.value)} /></label>`}
    ${status === 'unavailable' && html`<p class="small muted">Existing consultations within this override will need a new time.</p>`}
    ${error && html`<div class="error-text" role="alert">${error}</div>`}
    <div class="modal-actions">
      ${(current || professor.dnd) && html`<button onClick=${() => { app.updateProfessor(professor.id, { override:null, status:'unknown', returnAt:null, dnd:null }); app.showToast('Calendar availability restored.'); onClose(); }}>Use calendar again</button>`}
      <button class="primary" onClick=${save}>Save override</button>
    </div>`;
}
