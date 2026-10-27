import { html, useState } from '../ui.js';
import { getPhilippineNow, addDays, formatClock } from '../../utils/time.js';
import { getManualOverride, toTimestamp, isValidTime } from '../../utils/scheduling.js';
import { AVAILABILITY_CONFIRMATION, STATUS_INFO } from '../../config/settings.js';

export function OverridePanel({ app, professor, onClose }) {
  const current = getManualOverride(professor, app.now);
  const [status, setStatus] = useState(current?.status || 'unavailable');
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
    app.showToast('Your availability has been updated.');
    onClose();
  }
  return html`<h3>Update my availability</h3>
    <p class="small muted">Let students know when you can meet. When you choose Available, your classes, meetings and confirmed consultations will still show as busy time.</p>
    ${current && html`<p class="small">Your current availability: ${STATUS_INFO[current.status].label} · ${current.until ? 'until ' + formatClock(current.until) : 'until changed'}</p>`}
    <label class="field-block"><span class="form-label">Status</span><select value=${status} onChange=${e => setStatus(e.target.value)}>${['unavailable', 'available', 'meeting', 'busy'].map(key => html`<option key=${key} value=${key}>${STATUS_INFO[key].label}</option>`)}</select></label>
    <label class="field-block"><span class="form-label">Keep this status</span><select value=${duration} onChange=${e => setDuration(e.target.value)}><option value="today">For the rest of today</option><option value="changed">${status === 'available' ? `For the next ${AVAILABILITY_CONFIRMATION.inactivityMinutes / 60} hours` : 'Until I change it'}</option><option value="time">Until a specific time today</option></select></label>
    ${status === 'available' && html`<p class="small muted">Please check in again within ${AVAILABILITY_CONFIRMATION.inactivityMinutes / 60} hours to keep showing Available. Each new day, check in by ${formatClock(toTimestamp(getPhilippineNow(app.now).date, AVAILABILITY_CONFIRMATION.dayStart))} (Philippine Time); checking in earlier that day is fine. If you choose an earlier end time, we will use that instead.</p>`}
    ${duration === 'time' && html`<label class="field-block"><span class="form-label">Until</span><input type="time" value=${time} onInput=${e => setTime(e.target.value)} /></label>`}
    ${status === 'unavailable' && html`<p class="small muted">Consultations during this time will need to be rescheduled. Students will see an update.</p>`}
    ${error && html`<div class="error-text" role="alert">${error}</div>`}
    <div class="modal-actions">
      ${(current || professor.dnd) && html`<button onClick=${() => { app.updateProfessor(professor.id, { override:null, status:'unknown', returnAt:null, dnd:null }); app.showToast('Your availability now follows your calendar.'); onClose(); }}>Follow my calendar</button>`}
      <button class="primary" onClick=${save}>Save availability</button>
    </div>`;
}
