import { html, useState } from '../ui.js';
import { BUILDINGS, DAY_NAMES, CALENDAR_TYPES } from '../../config/settings.js';
import { addDays, getDayOfWeek } from '../../utils/time.js';
import { isValidDate, validateScheduleEntry, hasScheduleConflict, validateCalendarEvent } from '../../utils/scheduling.js';
import { newId } from '../helpers.js';

export function EventEditor({ app, professor, selection, onClose }) {
  const original = selection.source ? selection : null;
  const [form, setForm] = useState({
    type: original?.type || 'class', label: original?.label || '',
    date: selection.date, endDate: original?.allDay ? addDays(original.endDate, -1) : original?.endDate || selection.date,
    days: [original?.day ?? getDayOfWeek(selection.date)],
    start: original?.start || selection.start || '09:00', end: original?.end || selection.end || '10:00',
    building: original?.building || BUILDINGS[0], room: original?.room || '', allDay: original?.allDay || false
  });
  const [error, setError] = useState('');
  const recurring = ['class', 'consult', 'office'].includes(form.type);
  const setField = (key, value) => setForm(previous => ({ ...previous, [key]:value }));

  function save(event) {
    event.preventDefault();
    if (recurring) {
      if (!form.days.length) return setError('Select at least one recurring day.');
      const entries = form.days.map((day, index) => ({
        id: index === 0 && original?.source === 'schedule' ? original.id : newId(),
        type:form.type, day, start:form.start, end:form.end,
        label:form.label.trim(), building:form.type === 'class' ? form.building : null,
        room:form.type === 'class' ? form.room : null, capacity:1
      }));
      const retained = professor.schedule.filter(x => !(original?.source === 'schedule' && x.id === original.id));
      for (const entry of entries) {
        const validation = validateScheduleEntry(entry);
        if (validation) return setError(validation);
        if (hasScheduleConflict(retained, entry)) return setError('This overlaps another recurring entry of the same type.');
      }
      const schedule = [...retained, ...entries];
      for (const meeting of (professor.events || []).filter(x => x.type === 'meeting')) {
        const conflict = validateCalendarEvent({ ...professor, schedule }, meeting);
        if (conflict) return setError(conflict);
      }
      app.updateProfessor(professor.id, { schedule });
    } else {
      if (!isValidDate(form.date) || !isValidDate(form.endDate)) return setError('Choose valid dates.');
      if (form.endDate < form.date) return setError('End date must not precede the start date.');
      const saved = {
        id: original?.source === 'event' ? original.id : newId(), type:form.type, label:form.label.trim(),
        date:form.date, endDate:form.allDay ? addDays(form.endDate, 1) : form.endDate,
        start:form.allDay ? '00:00' : form.start, end:form.allDay ? '00:00' : form.end,
        allDay:form.type === 'unavailable' && form.allDay
      };
      const validation = validateCalendarEvent(professor, saved);
      if (validation) return setError(validation);
      app.updateProfessor(professor.id, {
        events:[...(professor.events || []).filter(x => x.id !== saved.id), saved],
        exceptions:(professor.exceptions || []).filter(x => !(original?.source === 'exception' && x.id === original.id))
      });
    }
    app.showToast('Event saved.');
    onClose();
  }

  return html`<h3>${original ? 'Edit event' : 'Add event'}</h3>
    <form class="event-form" onSubmit=${save} noValidate>
      <label class="field-block"><span class="form-label">Event type</span><select value=${form.type} disabled=${Boolean(original)} onChange=${e => { setField('type', e.target.value); setField('allDay', false); }}>${Object.entries(CALENDAR_TYPES).map(([value,label]) => html`<option key=${value} value=${value}>${label}</option>`)}</select></label>
      <label class="field-block"><span class="form-label">${form.type === 'class' ? 'Subject' : 'Title or location'}</span><input maxLength="120" value=${form.label} onInput=${e => setField('label', e.target.value)} placeholder=${form.type === 'class' ? 'Engineering Mathematics' : form.type === 'meeting' ? 'Department meeting' : form.type === 'unavailable' ? 'Off campus' : professor.office} /></label>
      ${recurring ? html`<fieldset class="weekday-picker"><legend>Repeat weekly on</legend>${[1,2,3,4,5,6,0].map(day => html`<label key=${day}><input type="checkbox" checked=${form.days.includes(day)} onChange=${e => setField('days', e.target.checked ? [...form.days,day] : form.days.filter(x => x !== day))} />${DAY_NAMES[day]}</label>`)}</fieldset>` : html`
        <div class="form-grid"><label class="field-block"><span class="form-label">Date</span><input type="date" value=${form.date} onInput=${e => { setField('date',e.target.value); setField('endDate',e.target.value); }} /></label>
        <label class="field-block"><span class="form-label">${form.allDay ? 'Through' : 'End date'}</span><input type="date" min=${form.date} value=${form.endDate} onInput=${e => setField('endDate',e.target.value)} /></label></div>`}
      ${form.type === 'unavailable' && html`<label class="check-row"><input type="checkbox" checked=${form.allDay} onChange=${e => setField('allDay',e.target.checked)} />All day</label>`}
      ${!form.allDay && html`<div class="form-grid"><label class="field-block"><span class="form-label">Start time</span><input type="time" value=${form.start} onInput=${e => setField('start',e.target.value)} /></label><label class="field-block"><span class="form-label">End time</span><input type="time" value=${form.end} onInput=${e => setField('end',e.target.value)} /></label></div>`}
      ${form.type === 'class' && html`<div class="form-grid"><label class="field-block"><span class="form-label">Building</span><select value=${form.building} onChange=${e => setField('building',e.target.value)}>${BUILDINGS.map(building => html`<option key=${building}>${building}</option>`)}</select></label><label class="field-block"><span class="form-label">Room number</span><input inputMode="numeric" maxLength="3" value=${form.room} onInput=${e => setField('room',e.target.value)} placeholder="401" /></label></div>`}
      ${form.type === 'office' && html`<p class="small muted">These hours permit Available and consultation booking. This describes planned availability, not verified presence.</p>`}
      ${original?.source === 'schedule' && html`<p class="small muted">Changes apply to this recurring entry every week.</p>`}
      ${error && html`<div class="error-text" role="alert">${error}</div>`}
      <div class="modal-actions"><button type="button" onClick=${onClose}>Cancel</button><button class="primary" type="submit">Save event</button></div>
    </form>`;
}
