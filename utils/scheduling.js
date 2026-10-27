import { BUILDINGS, MANUAL_STATUS_MINUTES, AVAILABILITY_CONFIRMATION, MINUTE, CONSULTATION_MINUTES, BOOKING_HORIZON_DAYS } from '../config/settings.js';
import { getPhilippineNow, getDayOfWeek, addDays, timeToMinutes, minutesToTime } from './time.js';
import { getCalendarEvents } from './calendar.js';

export const isValidTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export const formatRoomLocation = (building, room) => BUILDINGS.includes(building) && /^\d{3}$/.test(room) ? `${building} ${room}` : '';
export const overlaps = (start, end, otherStart, otherEnd) => start < otherEnd && otherStart < end;
export const toTimestamp = (date, time) => new Date(`${date}T${time}:00+08:00`).getTime();

export function validateScheduleEntry(entry) {
  if (!entry || !['class', 'consult', 'office'].includes(entry.type) || !Number.isInteger(entry.day) || entry.day < 0 || entry.day > 6) return 'Choose an event type and a day of the week.';
  if (!isValidTime(entry.start) || !isValidTime(entry.end) || entry.start >= entry.end) return 'Choose an end time later than the start time. For a class that continues past midnight, add a separate event for each day.';
  if (typeof entry.label !== 'string' || !entry.label.trim() || entry.label.length > 120) return 'Enter a subject or location of 1–120 characters.';
  if (entry.type === 'class' && !formatRoomLocation(entry.building, entry.room)) return 'Choose a building and enter exactly three room digits.';
  return '';
}
export function hasScheduleConflict(schedule, entry) {
  // Availability windows may contain commitments; booking subtracts those commitments.
  return schedule.some(other => other.id !== entry.id && other.day === entry.day && other.type === entry.type && overlaps(entry.start, entry.end, other.start, other.end));
}
export function validateCalendarEvent(professor, event) {
  if (!event || !['meeting', 'unavailable'].includes(event.type)) return 'Choose a valid event type.';
  if (typeof event.label !== 'string' || !event.label.trim() || event.label.length > 120) return 'Enter a title of 1–120 characters.';
  if (!isValidDate(event.date) || !isValidDate(event.endDate || event.date)) return 'Choose valid dates.';
  if (!isValidTime(event.start) || !isValidTime(event.end) || toTimestamp(event.date, event.start) >= toTimestamp(event.endDate || event.date, event.end)) return 'Choose an end time later than the start time.';
  if (event.type === 'unavailable') return '';
  const start = toTimestamp(event.date, event.start);
  const end = toTimestamp(event.endDate || event.date, event.end);
  if (end - start > 24 * 60 * MINUTE) return 'For time away longer than 24 hours, choose Unavailable instead of Meeting.';
  const conflict = getCalendarEvents(professor, event.date, event.endDate || event.date).find(other =>
    !(other.source === 'event' && other.id === event.id) && ['class', 'meeting'].includes(other.type) && overlaps(start, end, other.startAt, other.endAt));
  return conflict ? `This overlaps ${conflict.label}. Choose another time.` : '';
}
export function getAvailabilityConfirmationExpiry(setAt, policy = AVAILABILITY_CONFIRMATION) {
  if (!Number.isFinite(setAt)) return NaN;
  // A confirmation made before the cutoff counts for that date: no exact-time action required.
  const nextDay = addDays(getPhilippineNow(setAt).date, 1);
  return Math.min(setAt + policy.inactivityMinutes * MINUTE, toTimestamp(nextDay, policy.dayStart));
}
export function getManualOverride(professor, timestamp = Date.now(), policy = AVAILABILITY_CONFIRMATION) {
  const override = professor.override;
  if (override && ['available', 'unavailable', 'busy', 'meeting'].includes(override.status)) {
    const until = override.status === 'available'
      ? Math.min(override.until ?? Infinity, getAvailabilityConfirmationExpiry(override.setAt, policy)) : override.until;
    if (override.setAt <= timestamp && (until === null || timestamp < until)) return { ...override, until };
  }
  // Legacy Available follows the same policy; other legacy statuses retain their expiry.
  if (!override && professor.updatedAt <= timestamp) {
    const until = professor.status === 'available'
      ? Math.min(professor.returnAt || Infinity, getAvailabilityConfirmationExpiry(professor.updatedAt, policy))
      : professor.returnAt || professor.updatedAt + MANUAL_STATUS_MINUTES * MINUTE;
    if (timestamp < until && ['available', 'busy', 'unavailable'].includes(professor.status)) return { status: professor.status, setAt: professor.updatedAt, until };
  }
  return null;
}
export function isClassCancelled(professor, entry, date) {
  return (professor.exceptions || []).some(x => x.kind === 'cancel-class' && x.classId === entry.id && x.startDate === date);
}
function exceptionOverlaps(exception, date, start, end) {
  if (exception.kind === 'cancel-class') return false;
  const from = toTimestamp(exception.startDate, exception.start || '00:00');
  const through = exception.end ? toTimestamp(exception.endDate, exception.end) : toTimestamp(addDays(exception.endDate, 1), '00:00');
  return overlaps(toTimestamp(date, '00:00') + start * MINUTE, toTimestamp(date, '00:00') + end * MINUTE, from, through);
}
export function blocksDate(professor, date, start = 0, end = 1440) {
  return (professor.exceptions || []).some(x => exceptionOverlaps(x, date, start, end));
}
export function classOverlaps(professor, weekday, start, end, date = null) {
  return (professor.schedule || []).some(x => x.type === 'class' && x.day === weekday && (!date || !isClassCancelled(professor, x, date)) && overlaps(timeToMinutes(x.start), timeToMinutes(x.end), start, end));
}
export function appointmentConflicts(professor, appointment) {
  if (!professor || professor.active === false) return 'Faculty listing is inactive or missing';
  const start = timeToMinutes(appointment.time);
  const manual = professor.override || (professor.status === 'unavailable' ? { status: 'unavailable', setAt: professor.updatedAt, until: professor.returnAt || professor.updatedAt + MANUAL_STATUS_MINUTES * MINUTE } : null);
  if (manual?.status === 'unavailable' && overlaps(toTimestamp(appointment.date, appointment.time), toTimestamp(appointment.date, appointment.time) + CONSULTATION_MINUTES * MINUTE, manual.setAt, manual.until ?? Infinity)) return 'Faculty has confirmed unavailability';
  if (blocksDate(professor, appointment.date, start, start + CONSULTATION_MINUTES)) return 'Faculty is unavailable at this time';
  if (classOverlaps(professor, getDayOfWeek(appointment.date), start, start + CONSULTATION_MINUTES, appointment.date)) return 'This appointment overlaps a class';
  const event = getCalendarEvents(professor, appointment.date, appointment.date).find(x => ['meeting', 'unavailable'].includes(x.type) && overlaps(toTimestamp(appointment.date, appointment.time), toTimestamp(appointment.date, appointment.time) + CONSULTATION_MINUTES * MINUTE, x.startAt, x.endAt));
  if (event) return event.type === 'meeting' ? `Meeting: ${event.label}` : `Unavailable: ${event.label}`;
  const window = professor.schedule.some(x => ['consult', 'office'].includes(x.type) && x.day === getDayOfWeek(appointment.date) && timeToMinutes(x.start) <= start && start + CONSULTATION_MINUTES <= timeToMinutes(x.end) && (start - timeToMinutes(x.start)) % CONSULTATION_MINUTES === 0);
  return window ? '' : 'This time is outside the current consultation hours';
}
export function slotStartsInPast(date, time, timestamp = Date.now()) {
  return !isValidDate(date) || !isValidTime(time) || toTimestamp(date, time) <= timestamp;
}
export function isSlotTaken(appointments, professorId, date, time, excludeId = null, student = null) {
  const start = toTimestamp(date, time);
  return appointments.some(a => {
    if (a.id === excludeId || (a.professorId !== professorId && (!student || a.student !== student))) return false;
    const slot = a.status === 'Proposed' ? a.proposal : a;
    return slot && ['Pending', 'Approved', 'Proposed'].includes(a.status) && overlaps(start, start + CONSULTATION_MINUTES * MINUTE, toTimestamp(slot.date, slot.time), toTimestamp(slot.date, slot.time) + CONSULTATION_MINUTES * MINUTE);
  });
}
export function getOpenSlots(professor, timestamp = Date.now()) {
  if (!professor || professor.active === false) return [];
  const slots = [];
  const today = getPhilippineNow(timestamp);
  for (let offset = 0; offset < BOOKING_HORIZON_DAYS; offset++) {
    const date = addDays(today.date, offset);
    for (const entry of professor.schedule.filter(x => ['consult', 'office'].includes(x.type) && x.day === getDayOfWeek(date))) {
      for (let start = timeToMinutes(entry.start); start + CONSULTATION_MINUTES <= timeToMinutes(entry.end); start += CONSULTATION_MINUTES) {
        const slot = { date, time: minutesToTime(start), capacity: 1 };
        if (!slots.some(x => x.date === date && x.time === slot.time) && !slotStartsInPast(date, slot.time, timestamp) && !appointmentConflicts(professor, slot)) slots.push(slot);
      }
    }
  }
  return slots.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}
export function validateConsultationRequest(professor, appointment, appointments, timestamp = Date.now(), excludeId = null) {
  if (slotStartsInPast(appointment.date, appointment.time, timestamp)) return 'Choose a future date and time.';
  if (!appointment.description?.trim() || appointment.description.trim().length < 5 || appointment.description.length > 1000) return 'Describe your concern in 5–1000 characters.';
  const conflict = appointmentConflicts(professor, appointment);
  if (conflict) return conflict;
  if (isSlotTaken(appointments, professor.id, appointment.date, appointment.time, excludeId, appointment.student)) return 'This time is already reserved for the professor or student. Please choose another time.';
  return '';
}

// Intervals include their start and exclude their end. Never infer Available from a free timetable.
export function getProfessorAvailability(professor, timestamp = Date.now(), appointments = [], policy = AVAILABILITY_CONFIRMATION) {
  if (!professor || professor.active === false) return { status: 'unavailable', reason: 'Faculty listing inactive or missing' };
  const now = getPhilippineNow(timestamp);
  const manual = getManualOverride(professor, timestamp, policy);
  if (professor.dnd && (!professor.dnd.until || timestamp < professor.dnd.until)) return { status: 'dnd', reason: 'Do Not Disturb enabled' };
  const exception = (professor.exceptions || []).find(x => exceptionOverlaps(x, now.date, now.minutes, now.minutes + 1));
  if (exception) return { status: 'unavailable', reason: 'Unavailable', detail: exception.reason, until: exception.end ? toTimestamp(exception.endDate, exception.end) : toTimestamp(addDays(exception.endDate, 1), '00:00') };
  if (manual?.status === 'unavailable') return { status: 'unavailable', reason: 'Unavailable', detail: 'Set by faculty', until: manual.until };
  const events = getCalendarEvents(professor, now.date, now.date, appointments).filter(event => event.startAt <= timestamp && timestamp < event.endAt);
  const unavailable = events.find(event => event.type === 'unavailable');
  if (unavailable) return { status:'unavailable', reason:'Unavailable', detail:unavailable.label, until:unavailable.endAt };
  const currentClass = events.find(event => event.type === 'class');
  if (currentClass) {
    const location = formatRoomLocation(currentClass.building, currentClass.room);
    return { status: 'teaching', reason: location ? `Teaching at ${location}` : 'Teaching · room not yet specified', detail: currentClass.label, activity: currentClass, until:toTimestamp(now.date, currentClass.end) };
  }
  const meeting = events.find(event => event.type === 'meeting');
  if (meeting) return { status:'meeting', reason:'In a Meeting', detail:meeting.label, until:meeting.endAt };
  const consultation = events.find(event => event.type === 'appointment' && event.status === 'Approved');
  if (consultation) return { status:'consultation', reason:'In a Consultation', detail:'Confirmed appointment', until:consultation.endAt };
  if (manual && ['available', 'busy', 'meeting'].includes(manual.status)) return { status:manual.status, reason:manual.status === 'available' ? 'Available' : manual.status === 'meeting' ? 'In a Meeting' : 'Busy', detail:'Confirmed by faculty', confirmedAt:manual.setAt, until:manual.until };
  return { status:'unknown', reason:'Status Unconfirmed', detail:'Availability has not been confirmed recently.' };
}
export const availabilityFor = getProfessorAvailability;
export function getNextScheduledClass(professor, timestamp = Date.now()) {
  const today = getPhilippineNow(timestamp);
  for (let offset = 0; offset < 8; offset++) {
    const date = addDays(today.date, offset);
    const entry = professor.schedule.filter(x => x.type === 'class' && x.day === getDayOfWeek(date) && toTimestamp(date, x.start) > timestamp && !isClassCancelled(professor, x, date) && !blocksDate(professor, date, timeToMinutes(x.start), timeToMinutes(x.end))).sort((a, b) => a.start.localeCompare(b.start))[0];
    if (entry) return { ...entry, date };
  }
  return null;
}
// History stays intact; an affected booking loses confirmation and releases its reservation.
export function reconcileAppointments(professor, appointments, timestamp = Date.now()) {
  return appointments.map(a => {
    if (a.professorId !== professor.id || !['Pending', 'Approved', 'Proposed'].includes(a.status)) return a;
    const slot = a.status === 'Proposed' ? a.proposal : a;
    if (!slot || toTimestamp(slot.date, slot.time) + CONSULTATION_MINUTES * MINUTE <= timestamp) return a;
    const reason = appointmentConflicts(professor, slot);
    return reason ? { ...a, status: 'Needs action', proposal: null, response: `${reason}. Please request a new time.` } : a;
  });
}
