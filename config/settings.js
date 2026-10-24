export const DEPARTMENTS = ["CABM", "CAS", "CFLS", "CEA", "CHS", "CITHM-ICI", "JC"];

// Name prefixes shown in the "Add a professor" dropdown. Add new ones here.
export const NAME_PREFIXES = ["Prof.", "Dr.", "Atty.", "Chef", "Engr.", "Ms.", "Mrs.", "Mr."];

// The sample student shown in the Student view.
export const STUDENT_NAME = "Alex Mendoza";

export const REQUEST_CATEGORIES = ["Academic Concern", "Grade Inquiry", "Thesis Advising", "Other"];

// Default consultation hours given to every newly added professor.
export const DEFAULT_CONSULT_DAYS = [1, 2, 3, 4, 5]; // Monday to Friday
export const DEFAULT_CONSULT_START = "13:00";
export const DEFAULT_CONSULT_END = "15:00";

/* =====================================================================
   2. CONSTANTS
   ===================================================================== */
export const MINUTE = 60 * 1000;
export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Label, color and icon for each availability status.
export const STATUS_INFO = {
  available: { label: "Available", color: "var(--ok)", icon: "●" },
  busy: { label: "Busy", color: "var(--warn)", icon: "●" },
  unavailable: { label: "Unavailable", color: "var(--gray)", icon: "●" },
  unknown: { label: "Status Unconfirmed", color: "var(--unknown)", icon: "?" },
  teaching: { label: "Teaching", color: "var(--primary)", icon: "●" },
  consultation: { label: "In Consultation", color: "var(--ok)", icon: "●" },
  meeting: { label: "In a Meeting", color: "var(--warn)", icon: "●" },
  dnd: { label: "Do Not Disturb", color: "var(--dnd)", icon: "⛔" },
};

export const APPOINTMENT_STATUS_COLORS = {
  Pending: "var(--warn)",
  Approved: "var(--ok)",
  Rejected: "var(--danger)",
  Cancelled: "var(--gray)",
  Completed: "var(--unknown)",
  Expired: "var(--gray)",
  Proposed: "var(--unknown)",
  "Needs action": "var(--danger)",
};

// [tab id, tab label] for each role.
export const TABS_BY_ROLE = {
  student: [
    ["directory", "Faculty"],
    ["appointments", "My appointments"],
    ["alerts", "Alerts"],
  ],
  professor: [
    ["calendar", "Calendar"],
    ["requests", "Requests"],
    ["alerts", "Alerts"],
  ],
  admin: [["manage", "Manage faculty"]],
};

export const BUILDINGS = ["SHL", "JPL"];
export const MANUAL_STATUS_MINUTES = 120; // Compatibility only: expiry of old saved confirmations.
export const CONSULTATION_MINUTES = 30;
export const BOOKING_HORIZON_DAYS = 14;
export const CALENDAR_TYPES = {
  class: 'Class', consult: 'Consultation hours', office: 'Office hours',
  meeting: 'Meeting', unavailable: 'Unavailable'
};
