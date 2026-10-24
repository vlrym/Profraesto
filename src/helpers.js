import { DAY_NAMES } from '../config/settings.js';
import { formatTime12h } from '../utils/time.js';
export function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}
// "Dr." + "Maria Santos" -> "Dr. Maria Santos"
export function displayName(professor) {
  return professor ? `${professor.prefix} ${professor.name}` : "Faculty record unavailable";
}

// [1,2,3,4,5] -> "Mon–Fri"; [2,4] -> "Tue, Thu"
export function formatDayRange(days) {
  const isConsecutive = days.length > 1 && days[days.length - 1] - days[0] === days.length - 1;
  if (isConsecutive) return `${DAY_NAMES[days[0]]}–${DAY_NAMES[days[days.length - 1]]}`;
  return days.map((day) => DAY_NAMES[day]).join(", ");
}

// "Mon–Fri, 1:00 PM–3:00 PM" (separate time windows are joined with ";")
export function consultationHoursText(professor) {
  const daysByTimeWindow = {};
  professor.schedule
    .filter((entry) => ['consult','office'].includes(entry.type))
    .sort((a, b) => a.day - b.day)
    .forEach((entry) => {
      const windowKey = entry.start + "-" + entry.end;
      if (!daysByTimeWindow[windowKey]) daysByTimeWindow[windowKey] = [];
      if (!daysByTimeWindow[windowKey].includes(entry.day)) daysByTimeWindow[windowKey].push(entry.day);
    });

  const windows = Object.entries(daysByTimeWindow);
  if (windows.length === 0) return "No consultation hours posted";

  return windows
    .map(([windowKey, days]) => {
      const [start, end] = windowKey.split("-");
      return `${formatDayRange(days)}, ${formatTime12h(start)}–${formatTime12h(end)}`;
    })
    .join("; ");
}

/* =====================================================================
   5. SMALL SHARED UI PIECES
   ===================================================================== */
