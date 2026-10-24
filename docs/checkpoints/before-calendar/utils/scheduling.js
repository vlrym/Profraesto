import { BUILDINGS, MANUAL_STATUS_MINUTES, MINUTE, CONSULTATION_MINUTES, BOOKING_HORIZON_DAYS } from '../config/settings.js';
import { getPhilippineNow, getDayOfWeek, addDays, timeToMinutes, minutesToTime } from './time.js';

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
  if (!['class', 'consult'].includes(entry.type) || !Number.isInteger(entry.day) || entry.day < 0 || entry.day > 6) return 'Choose a valid entry type and day.';
  if (!isValidTime(entry.start) || !isValidTime(entry.end) || entry.start >= entry.end) return 'Enter valid times; end must be after start. Split overnight classes into two entries.';
  if (!entry.label?.trim() || entry.label.length > 120) return 'Enter a subject or location of 1–120 characters.';
  if (entry.type === 'class' && !formatRoomLocation(entry.building, entry.room)) return 'Choose a building and enter exactly three room digits.';
  return '';
}
export function hasScheduleConflict(schedule, entry) {
  return schedule.some(other => other.id !== entry.id && other.day === entry.day && overlaps(entry.start, entry.end, other.start, other.end));
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
  const endOfManualBlock = professor.returnAt || professor.updatedAt + MANUAL_STATUS_MINUTES * MINUTE;
  if (professor.status === 'unavailable' && overlaps(toTimestamp(appointment.date, appointment.time), toTimestamp(appointment.date, appointment.time) + CONSULTATION_MINUTES * MINUTE, professor.updatedAt, endOfManualBlock)) return 'Faculty has confirmed temporary unavailability';
  if (blocksDate(professor, appointment.date, start, start + CONSULTATION_MINUTES)) return 'Faculty is unavailable at this time';
  if (classOverlaps(professor, getDayOfWeek(appointment.date), start, start + CONSULTATION_MINUTES, appointment.date)) return 'This appointment overlaps a class';
  const window = professor.schedule.some(x => x.type === 'consult' && x.day === getDayOfWeek(appointment.date) && timeToMinutes(x.start) <= start && start + CONSULTATION_MINUTES <= timeToMinutes(x.end) && (start - timeToMinutes(x.start)) % CONSULTATION_MINUTES === 0);
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
    for (const entry of professor.schedule.filter(x => x.type === 'consult' && x.day === getDayOfWeek(date))) {
      for (let start = timeToMinutes(entry.start); start + CONSULTATION_MINUTES <= timeToMinutes(entry.end); start += CONSULTATION_MINUTES) {
        const slot = { date, time: minutesToTime(start), capacity: 1 };
        if (!slotStartsInPast(date, slot.time, timestamp) && !appointmentConflicts(professor, slot)) slots.push(slot);
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
  if (isSlotTaken(appointments, professor.id, appointment.date, appointment.time, excludeId, appointment.student)) return 'This time is already reserved for the professor or student. Choose another slot.';
  return '';
}

// Intervals include their start and exclude their end. Never infer Available from a free timetable.
export function getProfessorAvailability(professor, timestamp = Date.now(), appointments = []) {
  if (!professor || professor.active === false) return { status: 'unavailable', reason: 'Faculty listing inactive or missing' };
  const now = getPhilippineNow(timestamp);
  const recent = timestamp >= professor.updatedAt && timestamp - professor.updatedAt < MANUAL_STATUS_MINUTES * MINUTE;
  const manualActive = professor.returnAt ? timestamp < professor.returnAt : recent;
  if (professor.dnd && (!professor.dnd.until || timestamp < professor.dnd.until)) return { status: 'dnd', reason: 'Do Not Disturb enabled' };
  const exception = (professor.exceptions || []).find(x => exceptionOverlaps(x, now.date, now.minutes, now.minutes + 1));
  if (exception) return { status: 'unavailable', reason: exception.reason || 'Temporarily unavailable' };
  if (manualActive && professor.status === 'unavailable') return { status: 'unavailable', reason: 'Unavailability confirmed by faculty' };
  const currentClass = professor.schedule.find(x => x.type === 'class' && x.day === getDayOfWeek(now.date) && x.start <= minutesToTime(now.minutes) && minutesToTime(now.minutes) < x.end && !isClassCancelled(professor, x, now.date));
  if (currentClass) {
    const location = formatRoomLocation(currentClass.building, currentClass.room);
    return { status: 'busy', reason: location ? `Teaching in ${location}` : 'Teaching · room not yet specified', activity: currentClass };
  }
  if (appointments.some(a => a.professorId === professor.id && a.status === 'Approved' && toTimestamp(a.date, a.time) <= timestamp && timestamp < toTimestamp(a.date, a.time) + CONSULTATION_MINUTES * MINUTE)) return { status: 'busy', reason: 'In a confirmed consultation' };
  if (manualActive && ['available', 'busy'].includes(professor.status)) return { status: professor.status, reason: 'Recently confirmed by faculty' };
  return { status: 'unknown', reason: 'Availability has not been confirmed recently' };
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
