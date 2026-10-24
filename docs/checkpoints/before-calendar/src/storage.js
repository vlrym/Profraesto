import { STATUS_INFO, APPOINTMENT_STATUS_COLORS, BUILDINGS } from '../config/settings.js';
import { isValidDate, isValidTime, validateScheduleEntry, hasScheduleConflict, isSlotTaken } from '../utils/scheduling.js';

export const STORE_KEY = 'profraesto-demo-v2'; // Keep the original key to migrate existing browser data.
export let storageNotice = '';
let preserveOriginal = false;
export const blankData = () => ({ professors: [], appointments: [], notifications: [], favoriteIds: [] });

function validException(exception, schedule) {
  if (!exception || typeof exception.id !== 'string' || typeof exception.reason !== 'string') return false;
  if (!isValidDate(exception.startDate) || !isValidDate(exception.endDate) || exception.startDate > exception.endDate) return false;
  if ((exception.start && !isValidTime(exception.start)) || (exception.end && !isValidTime(exception.end))) return false;
  if (!!exception.start !== !!exception.end) return false;
  if (exception.startDate === exception.endDate && exception.start && exception.start >= exception.end) return false;
  if (exception.kind && !['block', 'cancel-class'].includes(exception.kind)) return false;
  return exception.kind !== 'cancel-class' || schedule.some(entry => entry.type === 'class' && entry.id === exception.classId);
}

function safeSchedule(schedule) {
  const accepted = [];
  for (const entry of Array.isArray(schedule) ? schedule : []) {
    if (!entry || typeof entry.id !== 'string' || typeof entry.label !== 'string') continue;
    // Old class records have no room. Preserve them until the professor supplies it.
    const validationEntry = entry.type === 'class' && !entry.building ? { ...entry, building: BUILDINGS[0], room: '000' } : entry;
    if (!validateScheduleEntry(validationEntry) && !hasScheduleConflict(accepted, entry) && !accepted.some(x => x.id === entry.id)) accepted.push({ ...entry, capacity: 1 });
  }
  return accepted;
}
export function normalizeData(stored) {
  if (!stored || !['professors', 'appointments', 'notifications', 'favoriteIds'].every(key => Array.isArray(stored[key]))) throw new Error('Invalid saved data');
  const professors = [];
  for (const p of stored.professors) {
    if (!p || typeof p.id !== 'string' || !p.id || typeof p.name !== 'string' || !p.name.trim() || professors.some(x => x.id === p.id)) continue;
    const schedule = safeSchedule(p.schedule);
    const exceptions = (Array.isArray(p.exceptions) ? p.exceptions : []).filter(x => validException(x, schedule));
    professors.push({
      ...p,
      prefix: typeof p.prefix === 'string' ? p.prefix : 'Prof.',
      name: p.name.slice(0, 100),
      department: typeof p.department === 'string' ? p.department : '',
      office: typeof p.office === 'string' ? p.office : 'Office not specified',
      subjects: Array.isArray(p.subjects) ? p.subjects.filter(x => typeof x === 'string') : [],
      status: Object.hasOwn(STATUS_INFO, p.status) ? p.status : 'unknown',
      updatedAt: Number.isFinite(p.updatedAt) ? p.updatedAt : 0,
      returnAt: Number.isFinite(p.returnAt) ? p.returnAt : null,
      dnd: p.dnd && (p.dnd.until === null || Number.isFinite(p.dnd.until)) ? p.dnd : null,
      schedule,
      exceptions
    });
  }
  const appointments = [];
  for (const a of stored.appointments) {
    if (!a || typeof a.id !== 'string' || appointments.some(x => x.id === a.id)) continue;
    if (typeof a.professorId !== 'string' || typeof a.student !== 'string') continue;
    if (!isValidDate(a.date) || !isValidTime(a.time) || !Object.hasOwn(APPOINTMENT_STATUS_COLORS, a.status)) continue;
    if (a.status === 'Proposed' && (!a.proposal || !isValidDate(a.proposal.date) || !isValidTime(a.proposal.time))) continue;
    appointments.push({
      ...a,
      category: typeof a.category === 'string' ? a.category : 'Academic Concern',
      description: typeof a.description === 'string' ? a.description.slice(0, 1000) : '',
      response: typeof a.response === 'string' ? a.response : ''
    });
  }
  // Older versions allowed group capacities. Keep history, but do not keep duplicate confirmations.
  const reservations = [];
  for (const a of [...appointments].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))) {
    if (!['Pending', 'Approved', 'Proposed'].includes(a.status)) continue;
    const slot = a.status === 'Proposed' ? a.proposal : a;
    const missingFaculty = !professors.some(p => p.id === a.professorId);
    if (missingFaculty || isSlotTaken(reservations, a.professorId, slot.date, slot.time, null, a.student)) {
      a.status = 'Needs action';
      a.response = missingFaculty ? 'Faculty record unavailable. Contact your department.' : 'Overlapping saved reservation. Please request a new time.';
      a.proposal = null;
    } else reservations.push(a);
  }
  return {
    professors,
    appointments,
    notifications: stored.notifications.filter(n => n && typeof n.id === 'string' &&
      typeof n.text === 'string' && ['student', 'professor'].includes(n.to) && Number.isFinite(n.createdAt)),
    favoriteIds: stored.favoriteIds.filter(id => professors.some(p => p.id === id))
  };
}
export function loadData(storage) {
  storageNotice = '';
  preserveOriginal = false;
  let raw;
  try {
    storage = storage || globalThis.localStorage;
    raw = storage.getItem(STORE_KEY);
    if (!raw) return blankData();
    const parsed = JSON.parse(raw);
    const result = normalizeData(parsed);
    if (JSON.stringify(parsed) !== JSON.stringify(result)) {
      try {
        storage.setItem(STORE_KEY + '-backup', raw);
        storageNotice = 'Saved data was normalized. The original is retained in the browser backup; review schedules and rooms.';
      } catch {
        preserveOriginal = true;
        storageNotice = 'Saved data was repaired in memory, but its backup could not be saved. Persistent writes are paused to protect the original.';
      }
    }
    return result;
  } catch {
    if (raw) {
      try { storage.setItem(STORE_KEY + '-backup', raw); } catch { preserveOriginal = true; }
      storageNotice = 'Saved data could not be read. An empty workspace is shown; the original was retained where storage permits.';
    } else storageNotice = 'Browser storage is unavailable. Changes will last only for this visit.';
    return blankData();
  }
}
export function saveData(data, storage) {
  if (preserveOriginal) return false;
  try { (storage || globalThis.localStorage).setItem(STORE_KEY, JSON.stringify(data)); return true; }
  catch { return false; }
}
