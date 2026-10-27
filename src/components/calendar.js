import { html, useState } from '../ui.js';
import { DAY_NAMES, CALENDAR_TYPES } from '../../config/settings.js';
import { addDays, getPhilippineNow, getDayOfWeek, formatDate, formatTime12h, formatClock, timeToMinutes, minutesToTime } from '../../utils/time.js';
import { getCalendarRange, getCalendarEvents, navigateCalendar, layoutTimedEvents } from '../../utils/calendar.js';
import { formatRoomLocation } from '../../utils/scheduling.js';
import { Modal } from './shared.js';
import { EventEditor } from './event-editor.js';
import { OverridePanel } from './override-panel.js';
import { AppointmentRow } from './appointments.js';

export function FacultyCalendar({ app, professor }) {
  const today = getPhilippineNow(app.now);
  const [date, setDate] = useState(today.date);
  const [view, setView] = useState('week');
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const range = getCalendarRange(date, view);
  const events = getCalendarEvents(professor, range.start, range.end, app.data.appointments);
  const availability = app.getAvailability(professor);
  const selectedEvent = selected && events.find(event => event.key === selected.key && event.source === selected.source);
  const timed = events.filter(event => !isAllDay(event));
  const includesToday = range.days.includes(today.date);
  const currentHour = Math.floor(today.minutes / 60);
  const startHour = Math.min(7, includesToday ? currentHour : 7, ...timed.map(event => Math.floor(timeToMinutes(event.start) / 60)));
  const endHour = Math.max(19, includesToday ? Math.min(24, currentHour + 1) : 19, ...timed.map(event => Math.ceil(timeToMinutes(event.end) / 60)));
  const hours = Array.from({ length:endHour - startHour }, (_, i) => startHour + i);
  const height = (endHour - startHour) * 60;

  function isAllDay(event) {
    return event.allDay || event.start === '00:00' && event.end === '24:00';
  }
  function addEvent(targetDate = date, start = '09:00') {
    setEditing({ date:targetDate, start, end:minutesToTime(Math.min(timeToMinutes(start) + 60, 1439)) });
  }
  function editEvent(event) {
    let original;
    if (event.source === 'schedule') original = professor.schedule.find(x => x.id === event.id);
    else if (event.source === 'event') original = professor.events.find(x => x.id === event.id);
    else {
      const exception = professor.exceptions.find(x => x.id === event.id);
      original = { ...exception, type:'unavailable', label:exception.reason, date:exception.startDate,
        endDate:exception.start ? exception.endDate : addDays(exception.endDate,1), allDay:!exception.start };
    }
    setSelected(null);
    setEditing({ ...original, source:event.source, date:original.date || event.date });
  }
  function deleteEvent(event) {
    setSelected(null);
    app.askToConfirm(`${event.source === 'schedule' ? 'Delete this event from every week' : 'Delete this event'}: “${event.label}”? Any consultations that no longer fit your schedule will need a new time.`, () => {
      const collection = event.source === 'schedule' ? 'schedule' : event.source === 'exception' ? 'exceptions' : 'events';
      app.updateProfessor(professor.id, { [collection]:(professor[collection] || []).filter(x => x.id !== event.id) });
      app.showToast('Calendar event deleted.');
    });
  }
  function eventButton(event, compact = false, style = {}) {
    const room = event.type === 'class' ? formatRoomLocation(event.building, event.room) : '';
    const label = event.type === 'appointment' ? `${event.status} · ${event.label}` : event.type === 'cancelled-class' ? `Cancelled · ${event.label}` : ['consult','office'].includes(event.type) ? `${CALENDAR_TYPES[event.type]} · ${event.label}` : event.label;
    return html`<button key=${event.key} class=${`calendar-event event-${event.type} ${event.status && event.status !== 'Approved' ? 'event-pending' : ''} ${compact ? 'event-compact' : ''} ${timeToMinutes(event.end)-timeToMinutes(event.start) < 45 ? 'event-short' : ''}`}
      style=${style} aria-label=${`${label}, ${formatDate(event.date)}, ${event.start}–${event.end}${room ? ', ' + room : ''}`}
      title=${`${label} · ${event.start}–${event.end}${room ? ' · ' + room : ''}`} onClick=${() => setSelected(event)}>
      <span class="event-title">${label}</span><span class="event-time">${event.start}–${event.end}${room ? ' · ' + room : ''}</span>
    </button>`;
  }

  return html`<section class="faculty-calendar" aria-label="Faculty calendar">
    <div class="calendar-status"><div><strong class=${'live-availability status-' + availability.status}>${availability.reason}</strong>
      <span class="small muted">${availability.until ? 'Until ' + formatClock(availability.until) + ' · ' : ''}${availability.detail}</span></div>
      <button onClick=${() => setOverrideOpen(true)}>Update my availability</button></div>
    <div class="calendar-toolbar">
      <div class="row"><button onClick=${() => setDate(today.date)}>Today</button><button aria-label="Previous period" onClick=${() => setDate(navigateCalendar(date,view,-1))}>‹</button><button aria-label="Next period" onClick=${() => setDate(navigateCalendar(date,view,1))}>›</button>
      <h2>${view === 'month' ? new Date(date + 'T00:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',month:'long',year:'numeric'}) : view === 'day' ? formatDate(date) : `${formatDate(range.start)} – ${formatDate(range.end)}`}</h2></div>
      <div class="row"><div class="view-switch" aria-label="Calendar view">${['day','week','month'].map(mode => html`<button key=${mode} aria-pressed=${view === mode} class=${view === mode ? 'active' : ''} onClick=${() => setView(mode)}>${mode[0].toUpperCase()+mode.slice(1)}</button>`)}</div><button class="primary" onClick=${() => addEvent()}>Add event</button></div>
    </div>
    <div class="calendar-legend"><span class="legend-class">Class</span><span class="legend-consult">Consultation hours</span><span class="legend-appointment">Approved consultation</span><span class="legend-meeting">Meeting</span><span class="legend-unavailable">Unavailable</span><span class="legend-office">Office hours</span><span class="legend-pending">Pending / needs action</span><span class="timezone-label">Philippine Time</span></div>
    ${view === 'month' ? html`<div class="month-scroll"><div class="month-calendar">
      ${[1,2,3,4,5,6,0].map(day => html`<div class="month-weekday" key=${day}>${DAY_NAMES[day]}</div>`)}
      ${range.days.map(day => html`<div key=${day} class=${`month-day ${day === today.date ? 'is-today' : ''} ${day.slice(0,7) !== date.slice(0,7) ? 'outside-month' : ''}`}>
        <button class="month-date" aria-label=${'Open ' + day} onClick=${() => {setDate(day);setView('day');}}>${Number(day.slice(8))}</button>
        ${events.filter(event => event.date === day).slice(0,3).map(event => eventButton(event,true))}
        ${events.filter(event => event.date === day).length > 3 && html`<button class="more-events" onClick=${() => {setDate(day);setView('day');}}>+${events.filter(event => event.date === day).length - 3} more</button>`}
        <button class="month-add" aria-label=${'Add event on ' + day} onClick=${() => addEvent(day)}>+</button>
      </div>`)}
    </div></div>` : html`<div class="calendar-scroll" tabIndex="0" aria-label="Scrollable time calendar"><div class=${'time-calendar ' + (view === 'day' ? 'day-view' : 'week-view')} style=${{'--days':range.days.length}}>
      <div class="time-corner">PHT</div>${range.days.map(day => html`<div key=${day} class=${'day-heading ' + (day === today.date ? 'is-today' : '')}><button onClick=${() => {setDate(day);setView('day');}}>${DAY_NAMES[getDayOfWeek(day)]}<strong>${Number(day.slice(8))}</strong></button></div>`)}
      <div class="all-day-label">All day</div>${range.days.map(day => html`<div key=${day} class="all-day-cell">${events.filter(event => event.date === day && isAllDay(event)).map(event => eventButton(event,true))}</div>`)}
      <div class="time-axis" style=${{height}}>${hours.map(hour => html`<span key=${hour} style=${{top:(hour-startHour)*60}}>${formatTime12h(minutesToTime(hour*60))}</span>`)}</div>
      ${range.days.map(day => {
        const dayEvents = events.filter(event => event.date === day && !isAllDay(event));
        const windows = dayEvents.filter(event => ['office','consult'].includes(event.type));
        const commitments = layoutTimedEvents(dayEvents.filter(event => !['office','consult'].includes(event.type)));
        const position = event => ({ top:timeToMinutes(event.start)-startHour*60, height:Math.max(24,timeToMinutes(event.end)-timeToMinutes(event.start)-2) });
        return html`<div key=${day} class=${'calendar-day ' + (day === today.date ? 'is-today' : '')} style=${{height}}>
          ${hours.flatMap(hour => [0,30].map(minute => html`<button key=${hour*60+minute} class="time-slot" style=${{top:(hour-startHour)*60+minute}} aria-label=${'Add event ' + day + ' ' + minutesToTime(hour*60+minute)} onClick=${() => addEvent(day,minutesToTime(hour*60+minute))}></button>`))}
          ${windows.map(event => eventButton(event,false,{...position(event),left:'2%',width:'96%'}))}
          ${commitments.map(event => eventButton(event,false,{...position(event),left:`${event.lane*100/event.lanes+1}%`,width:`${100/event.lanes-2}%`}))}
          ${day === today.date && today.minutes >= startHour*60 && today.minutes < endHour*60 && html`<div class="current-time-line" aria-label=${'Current time ' + minutesToTime(today.minutes)} style=${{top:today.minutes-startHour*60}}></div>`}
        </div>`;
      })}
    </div></div>`}
    ${events.length === 0 && html`<p class="calendar-empty small muted">No events in this ${view}. Select a time or use Add event.</p>`}
    ${editing && html`<${Modal} onClose=${() => setEditing(null)}><${EventEditor} app=${app} professor=${professor} selection=${editing} onClose=${() => setEditing(null)} /><//>`}
    ${overrideOpen && html`<${Modal} onClose=${() => setOverrideOpen(false)}><${OverridePanel} app=${app} professor=${professor} onClose=${() => setOverrideOpen(false)} /><//>`}
    ${selectedEvent && html`<${Modal} onClose=${() => setSelected(null)}>
      ${selectedEvent.source === 'appointment' ? html`<h3>Consultation request</h3><${AppointmentRow} appointment=${selectedEvent.appointment} app=${app} professorView=${true} />` : html`
        <h3>${selectedEvent.label}</h3><p>${CALENDAR_TYPES[selectedEvent.type] || 'Cancelled class'} · ${formatDate(selectedEvent.date)} · ${selectedEvent.start}–${selectedEvent.end}</p>
        ${selectedEvent.type === 'class' && html`<p>${formatRoomLocation(selectedEvent.building,selectedEvent.room) || 'Room not specified'}</p>`}
        <div class="row"><button class="primary" onClick=${() => editEvent(selectedEvent)}>Edit event</button><button onClick=${() => deleteEvent(selectedEvent)}>Delete event</button></div>
        ${selectedEvent.type === 'class' && html`<button onClick=${() => {app.blockDates(professor,{kind:'cancel-class',classId:selectedEvent.id,startDate:selectedEvent.date,endDate:selectedEvent.date,reason:'Class cancelled'});setSelected(null);app.showToast('This class has been cancelled for the selected date.');}}>Cancel class on this date</button>`}
        ${selectedEvent.type === 'cancelled-class' && html`<button class="primary" onClick=${() => {app.updateProfessor(professor.id,{exceptions:professor.exceptions.filter(x => !(x.kind === 'cancel-class' && x.classId === selectedEvent.id && x.startDate === selectedEvent.date))});setSelected(null);app.showToast('This class is back on your calendar.');}}>Restore class on this date</button>`}
      `}
    <//>`}
  </section>`;
}
