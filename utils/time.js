import { MINUTE } from '../config/settings.js';
const philippineTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// Returns today's date ("2026-10-13") and minutes since midnight, in Philippine Time.
export function getPhilippineNow(timestamp = Date.now()) {
  const parts = {};
  philippineTimeFormatter.formatToParts(timestamp).forEach((part) => {
    parts[part.type] = part.value;
  });
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function getDayOfWeek(dateString) {
  return new Date(dateString + "T00:00:00Z").getUTCDay(); // 0 = Sunday
}

export function addDays(dateString, numberOfDays) {
  const start = new Date(dateString + "T00:00:00Z").getTime();
  return new Date(start + numberOfDays * 24 * 60 * MINUTE).toISOString().slice(0, 10);
}

export function timeToMinutes(time) {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3)); // "13:30" -> 810
}

export function minutesToTime(totalMinutes) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`; // 810 -> "13:30"
}

export function formatTime12h(time) {
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours < 12 ? "AM" : "PM";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${suffix}`; // "13:30" -> "1:30 PM"
}

export function formatClock(timestamp) {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(dateString) {
  return new Date(dateString + "T00:00:00Z").toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}


