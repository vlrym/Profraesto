import { CONSULTATION_MINUTES, MINUTE } from '../config/settings.js';
import { addDays, getDayOfWeek, getPhilippineNow, minutesToTime, timeToMinutes } from './time.js';

export function getWeekStart(date) {
  return addDays(date, -((getDayOfWeek(date) + 6) % 7));
}

export function getCalendarRange(date, view) {
  if (view === 'day') return { start: date, end: date, days: [date] };
  const start = view === 'month' ? getWeekStart(date.slice(0, 8) + '01') : getWeekStart(date);
  const days = Array.from({ length: view === 'month' ? 42 : 7 }, (_, index) => addDays(start, index));
  return { start, end: days.at(-1), days };
}

export function navigateCalendar(date, view, direction) {
  if (view !== 'month') return addDays(date, direction * (view === 'day' ? 1 : 7));
  const current = new Date(date + 'T00:00:00Z');
  current.setUTCDate(1);
  current.setUTCMonth(current.getUTCMonth() + direction);
  return current.toISOString().slice(0, 10);
}

export function isCancelledClass(professor, entryId, date) {
  return (professor.exceptions || []).some(x => x.kind === 'cancel-class' && x.classId === entryId && x.startDate === date);
}

const timestamp = (date, time) => Date.parse(`${date}T${time}:00+08:00`);

// Expand recurring entries and project appointments into occurrences without copying domain records.
export function getCalendarEvents(professor, startDate, endDate, appointments = []) {
  if (!professor) return [];
  const events = [];
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    for (const entry of professor.schedule || []) {
      if (entry.day !== getDayOfWeek(date)) continue;
      const cancelled = entry.type === 'class' && isCancelledClass(professor, entry.id, date);
      events.push({ ...entry, type:cancelled ? 'cancelled-class' : entry.type, date, key: `${entry.id}-${date}`, source: 'schedule', startAt: timestamp(date, entry.start), endAt: timestamp(date, entry.end) });
    }
    const dated = [
      ...(professor.events || []).map(event => ({ ...event, source: 'event' })),
      ...(professor.exceptions || []).filter(x => x.kind !== 'cancel-class').map(x => ({
        ...x, type: 'unavailable', date: x.startDate, endDate: x.endDate,
        label: x.reason, source: 'exception'
      }))
    ];
    for (const event of dated) {
      const startAt = timestamp(event.date, event.start || '00:00');
      const endAt = event.end ? timestamp(event.endDate || event.date, event.end) : timestamp(addDays(event.endDate || event.date, 1), '00:00');
      const dayStart = timestamp(date, '00:00');
      const dayEnd = dayStart + 1440 * MINUTE;
      if (startAt >= dayEnd || endAt <= dayStart) continue;
      events.push({ ...event, date, key: `${event.id}-${date}`, startAt, endAt,
        start: minutesToTime(Math.max(0, (startAt - dayStart) / MINUTE)),
        end: minutesToTime(Math.min(1440, (endAt - dayStart) / MINUTE)) });
    }
    for (const appointment of appointments) {
      if (appointment.professorId !== professor.id || !['Pending', 'Approved', 'Proposed', 'Needs action'].includes(appointment.status)) continue;
      const slot = appointment.status === 'Proposed' ? appointment.proposal : appointment;
      if (!slot || slot.date !== date) continue;
      const startAt = timestamp(date, slot.time);
      events.push({ id: appointment.id, key: appointment.id, source: 'appointment', type: 'appointment',
        label: `${appointment.student} · ${appointment.category}`, status: appointment.status,
        date, start: slot.time, end: minutesToTime(timeToMinutes(slot.time) + CONSULTATION_MINUTES),
        startAt, endAt: startAt + CONSULTATION_MINUTES * MINUTE, appointment });
    }
  }
  return events.sort((a, b) => a.startAt - b.startAt || a.endAt - b.endAt);
}

export function getNextScheduledActivity(professor, now, appointments = []) {
  const date = getPhilippineNow(now).date;
  // Only actual commitments are summarized; empty consultation windows are not appointments.
  return getCalendarEvents(professor, date, addDays(date, 14), appointments).find(event =>
    event.startAt > now && (['class', 'meeting', 'unavailable'].includes(event.type) || event.type === 'appointment' && event.status === 'Approved')) || null;
}

// Pack intersecting foreground events into lanes, keeping every event clickable.
export function layoutTimedEvents(events) {
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end));
  const result = [];
  let group = [];
  let groupEnd = '';
  function finishGroup() {
    const lanes = [];
    for (const event of group) {
      let lane = lanes.findIndex(end => end <= event.start);
      if (lane === -1) lane = lanes.length;
      lanes[lane] = event.end;
      event.lane = lane;
    }
    result.push(...group.map(event => ({ ...event, lanes:lanes.length })));
    group = [];
  }
  for (const original of sorted) {
    const event = { ...original };
    if (group.length && event.start >= groupEnd) finishGroup();
    if (!group.length) groupEnd = event.end;
    else if (event.end > groupEnd) groupEnd = event.end;
    group.push(event);
  }
  finishGroup();
  return result;
}
