import { STUDENT_NAME, MINUTE, CONSULTATION_MINUTES, TABS_BY_ROLE } from '../config/settings.js';
import { getPhilippineNow, timeToMinutes, formatTime12h, formatDate } from '../utils/time.js';
import { slotStartsInPast, availabilityFor, isSlotTaken as slotTaken, reconcileAppointments } from '../utils/scheduling.js';
import { newId, displayName } from './helpers.js';
import { useState, useEffect, useRef, html } from './ui.js';
import * as domain from '../utils/scheduling.js';
import { createRoot } from 'react-dom/client';
import { Directory } from './components/directory.js';
import { BookingDialog, ProposalDialog } from './components/booking.js';
import { AppointmentList } from './components/appointments.js';
import { FacultyCalendar } from './components/calendar.js';
import { Notifications } from './components/notifications.js';
import { ManageFaculty } from './components/admin.js';
import { createDemoData } from '../config/demo-data.js';
import { Modal } from './components/shared.js';
function App() {
  // ---- State ----
  // One shared data object per page load; navigation never recreates it.
  const [data, setCurrentData] = useState(createDemoData);
  // Update the reference synchronously so a second click sees the first reservation.
  const dataRef = useRef(data);
  const setData = updater => {
    const next = typeof updater === 'function' ? updater(dataRef.current) : updater;
    dataRef.current = next;
    setCurrentData(next);
  };
  const [role, setRole] = useState("student"); // "student" | "professor" | "admin"
  const [tab, setTab] = useState("directory");
  const [selectedProfessorId, setSelectedProfessorId] = useState(""); // for the Professor view
  const [now, setNow] = useState(Date.now());
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimer = useRef(null);
  const [confirmDialog, setConfirmDialog] = useState(null); // { message, onConfirm }
  const [booking, setBooking] = useState(null); // { professorId, appointmentId? }
  const [proposalId, setProposalId] = useState(null);
  const [isDark, setIsDark] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches);

  // ---- Dark mode ----
  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
  }, [isDark]);

  // Recalculate from the current Manila time; no manual Teaching status is stored.
  useEffect(() => {
    const refreshClock = () => {
      const currentTime = Date.now();
      setNow(currentTime);
      setData((previous) => {
        let somethingChanged = false;
        const professors = previous.professors.map((professor) => {
          let updated = professor;
          if (professor.returnAt && professor.returnAt < currentTime) {
            // Expiry never implies presence; require fresh confirmation.
            updated = { ...updated, returnAt: null, status: "unknown", updatedAt: currentTime };
            somethingChanged = true;
          }
          if (professor.dnd && professor.dnd.until && professor.dnd.until < currentTime) {
            updated = { ...updated, dnd: null };
            somethingChanged = true;
          }
          return updated;
        });
        let appointments = previous.appointments;
        const today = getPhilippineNow(currentTime);
        appointments = appointments.map(a => {
          if ((a.status === "Pending" && slotStartsInPast(a.date, a.time, currentTime)) || (a.status === "Proposed" && a.proposal && slotStartsInPast(a.proposal.date, a.proposal.time, currentTime))) {
            somethingChanged = true;
            return { ...a, status: "Expired" };
          }
          return a;
        });
        let notifications = previous.notifications;
        // A reminder appears when this browser is open within 60 minutes of an approved visit.
        appointments.filter(a => a.status === "Approved" && a.student === STUDENT_NAME && a.date === today.date
          && timeToMinutes(a.time) > today.minutes && timeToMinutes(a.time) - today.minutes <= 60).forEach(a => {
            if (!notifications.some(n => n.reminderFor === a.id && n.reminderDate === a.date && n.reminderTime === a.time)) {
              notifications = [{ id: newId(), to: "student", professorId: a.professorId, text: `Reminder: your confirmed consultation is today at ${formatTime12h(a.time)}.`, read: false, createdAt: currentTime, reminderFor: a.id, reminderDate: a.date, reminderTime: a.time }, ...notifications];
              somethingChanged = true;
            }
          });
        return somethingChanged ? { ...previous, professors, appointments, notifications } : previous;
      });
    };
    const intervalId = setInterval(refreshClock, 1000);
    const refreshWhenVisible = () => { if (!document.hidden) refreshClock(); };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshClock);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshClock);
    };
  }, []);

  // ---- Small data helpers ----
  const showToast = (message) => {
    clearTimeout(toastTimer.current);
    setToastMessage(message);
    toastTimer.current = setTimeout(() => setToastMessage(null), 3500);
  };
  const updateData = (key, updater) =>
    setData((previous) => ({ ...previous, [key]: updater(previous[key]) }));
  const findProfessor = (id) => data.professors.find((professor) => professor.id === id);
  const updateProfessor = (id, changes) => {
    setNow(Date.now());
    setData(previous => {
      const professors = previous.professors.map(p => p.id === id ? { ...p, ...changes } : p);
      const changed = professors.find(p => p.id === id);
      const appointments = changed ? reconcileAppointments(changed, previous.appointments) : previous.appointments;
      const affected = appointments.filter(a => a.status === 'Needs action' && previous.appointments.find(old => old.id === a.id)?.status !== 'Needs action');
      const notices = affected.map(a => ({ id:newId(), to:'student', professorId:id, text:`${displayName(changed)} · ${formatDate(a.date)} at ${formatTime12h(a.time)}: ${a.response}`, read:false, createdAt:Date.now() }));
      return { ...previous, professors, appointments, notifications:[...notices, ...previous.notifications] };
    });
  };
  const updateAppointment = (id, changes) =>
    updateData("appointments", (list) => list.map((a) => (a.id === id ? { ...a, ...changes } : a)));
  const notify = (to, professorId, text) =>
    updateData("notifications", (list) => [
      { id: newId(), to, professorId, text, read: false, createdAt: Date.now() },
      ...list,
    ]);

  // The professor currently shown in the Professor view (defaults to the first one).
  const currentProfessor = (findProfessor(selectedProfessorId)?.active !== false ? findProfessor(selectedProfessorId) : null) || data.professors.find(p => p.active !== false);
  const currentProfessorId = currentProfessor && currentProfessor.id;

  // ---- Booking helpers ----

  // All open 30-minute consultation slots for the next 14 days (Philippine Time).
  function getOpenSlots(professor) { return domain.getOpenSlots(professor); }
  function isSlotTaken(professorId, date, time, capacity, excludeId = null) {
    return slotTaken(dataRef.current.appointments, professorId, date, time, excludeId, STUDENT_NAME);
  }

  // Validates and creates a request. Returns an error message, or null on success.
  function requestAppointment(professor, date, time, category, description, rescheduleId = null) {
    professor = dataRef.current.professors.find(p => p.id === professor?.id);
    const validation = domain.validateConsultationRequest(professor, { date, time, description, student: STUDENT_NAME }, dataRef.current.appointments, Date.now(), rescheduleId);
    if (validation) return validation;
    const slot = getOpenSlots(professor).find((s) => s.date === date && s.time === time);
    if (!slot) return "That time is outside consultation hours.";

    const original = rescheduleId && data.appointments.find(a => a.id === rescheduleId && a.professorId === professor.id && a.student === STUDENT_NAME && ["Pending", "Approved", "Needs action"].includes(a.status));
    if (rescheduleId && !original) return "This appointment can no longer be rescheduled.";
    if (original && original.date === date && original.time === time) return "Choose a different time to reschedule.";
    const record = { id: rescheduleId || newId(), student: STUDENT_NAME, professorId: professor.id, date, time, category, description: description.trim(), status: "Pending", response: "", createdAt: Date.now() };
    updateData("appointments", list => rescheduleId ? list.map(a => a.id === rescheduleId ? record : a) : [record, ...list]);
    notify(
      "professor",
      professor.id,
      `${STUDENT_NAME} ${rescheduleId ? "requested a reschedule" : "requested a " + category + " consultation"} on ${formatDate(date)} at ${formatTime12h(time)}.`,
    );
    showToast(`${rescheduleId ? "Reschedule" : "Booking"} request sent — awaiting professor approval.`);
    return null;
  }

  // ---- Everything the child components can call ----
  const app = {
    data,
    role,
    now,
    currentProfessorId,
    setTab,
    showToast,
    updateData,
    findProfessor,
    updateProfessor,
    getOpenSlots,
    isSlotTaken,
    requestAppointment,
    getAvailability: professor => availabilityFor(professor, now, data.appointments),
    openBooking: (professorId, appointmentId = null) => setBooking({ professorId, appointmentId }),
    openProposal: appointment => setProposalId(appointment.id),
    proposeTime: (appointment, date, time) => {
      if (appointment.status !== "Pending") return "You can suggest a new time while a request is waiting for your reply.";
      const prof = findProfessor(appointment.professorId);
      const slot = getOpenSlots(prof).find(s => s.date === date && s.time === time);
      if (!slot || isSlotTaken(prof.id, date, time, slot.capacity, appointment.id)) return "That time is no longer available.";
      if (appointment.date === date && appointment.time === time) return "Choose a different time.";
      updateAppointment(appointment.id, { status: "Proposed", proposal: { date, time } });
      notify("student", prof.id, `${displayName(prof)} offered ${formatDate(date)} at ${formatTime12h(time)} instead. Accept or decline in My appointments.`);
      showToast("Alternative time proposed to student.");
      return null;
    },
    answerProposal: (appointment, accepted) => {
      if (appointment.status !== "Proposed" || !appointment.proposal) return;
      const professor = findProfessor(appointment.professorId);
      const { date, time } = appointment.proposal;
      if (accepted) {
        const slot = getOpenSlots(professor).find(s => s.date === date && s.time === time);
        if (!slot || isSlotTaken(professor.id, date, time, slot.capacity, appointment.id)) return showToast("That suggested time is no longer available. Please contact the professor for another time.");
      }
      updateAppointment(appointment.id, accepted ? { date, time, status: "Approved", proposal: null, response: "Student accepted alternative time." } : { status: "Rejected", proposal: null, response: "Student declined proposed time." });
      notify("professor", appointment.professorId, `${STUDENT_NAME} ${accepted ? "accepted" : "declined"} the proposed consultation time.`);
      showToast(accepted ? "Consultation confirmed." : "Suggested time declined.");
    },
    askToConfirm: (message, onConfirm) => setConfirmDialog({ message, onConfirm }),
    blockDates: (professor, absence) => {
      updateProfessor(professor.id, { exceptions: [...(professor.exceptions || []), { ...absence, id: newId() }] });
    },

    toggleFavorite: (id) =>
      updateData("favoriteIds", (ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])),

    // Professor approves or rejects a pending request.
    decide: (appointment, newStatus, response) => {
      if (appointment.status !== "Pending" || slotStartsInPast(appointment.date, appointment.time)) return showToast("This request can no longer be approved.");
      const prof = findProfessor(appointment.professorId);
      if (newStatus === "Approved" && !getOpenSlots(prof).some(s => s.date === appointment.date && s.time === appointment.time))
        return showToast("This time no longer fits your calendar. Please suggest another time or decline the request.");
      if (newStatus === "Approved" && isSlotTaken(prof.id, appointment.date, appointment.time, 1, appointment.id)) return showToast("This time is already reserved.");
    updateAppointment(appointment.id, { status: newStatus, response: response.trim() });
      notify(
        "student",
        null,
        `${displayName(findProfessor(appointment.professorId))} ${newStatus.toLowerCase()} your ${appointment.category} request for ${formatDate(appointment.date)}, ${formatTime12h(appointment.time)}.`,
      );
      showToast(`Request ${newStatus.toLowerCase()}.`);
    },

    // Student cancels their own pending request.
    cancel: (appointment) =>
      ["Pending", "Approved", "Needs action"].includes(appointment.status) && domain.toTimestamp(appointment.date, appointment.time) + CONSULTATION_MINUTES * MINUTE > Date.now()
        ? setConfirmDialog({
        message: `Cancel your request to ${displayName(findProfessor(appointment.professorId))} on ${formatDate(appointment.date)}, ${formatTime12h(appointment.time)}?`,
        onConfirm: () => {
          updateAppointment(appointment.id, { status: "Cancelled" });
          notify(
            "professor",
            appointment.professorId,
            `${appointment.student} cancelled the request for ${formatDate(appointment.date)}, ${formatTime12h(appointment.time)}.`,
          );
          showToast("Request cancelled.");
        },
      }) : showToast("This appointment can no longer be cancelled."),

    // Professor marks an approved consultation as done.
    complete: (appointment) => {
      if (domain.toTimestamp(appointment.date, appointment.time) > Date.now()) return showToast("You can mark completion once the consultation starts.");
    updateAppointment(appointment.id, { status: "Completed" });
      notify(
        "student",
        null,
        `Your consultation with ${displayName(findProfessor(appointment.professorId))} was marked completed.`,
      );
      showToast("Consultation marked as completed.");
    },

    respondToKnock: (notification, response) => {
      if (notification.response) return;
      updateData("notifications", list => list.map(n => n.id === notification.id ? { ...n, response, read: true } : n));
      notify("student", notification.professorId, `${displayName(findProfessor(notification.professorId))} replied to your Knock: ${response}.`);
      showToast("Knock response sent.");
    },

  };

  // ---- Layout ----
  const unreadCount = data.notifications.filter(
    (n) =>
      !n.read &&
      (role === "student" ? n.to === "student" : role === "professor" && n.to === "professor" && n.professorId === currentProfessorId),
  ).length;

  function switchRole(newRole) {
    setRole(newRole);
    setBooking(null);
    setProposalId(null);
    setTab(TABS_BY_ROLE[newRole][0][0]); // open that role's first tab
  }

  const professorViewHasNoProfessor = role === "professor" && !currentProfessor;
  const bookingProfessor = booking && findProfessor(booking.professorId);
  const bookingAppointment = booking && booking.appointmentId && data.appointments.find(a => a.id === booking.appointmentId);
  const proposalAppointment = proposalId && data.appointments.find(a => a.id === proposalId);

  return html`
    <div>
      <header class="app-header">
        <div class="header-inner">
          <div class="brand-mark" aria-hidden="true">P</div>
          <div class="brand-copy"><b class="app-title">Profraesto</b><span class="brand-subtitle">Faculty availability & consultations</span></div>
          <div class="header-actions">
            <select class="role-select" aria-label="Switch user role" value=${role} onChange=${(event) => switchRole(event.target.value)}>
              <option value="student">Student</option>
              <option value="professor">Professor</option>
              <option value="admin">Admin</option>
            </select>
            <button class="theme-toggle" title="Dark mode" aria-label="Toggle dark mode" onClick=${() => setIsDark(!isDark)}>${isDark ? "☀" : "☾"}</button>
          </div>
        </div>
      </header>
      <nav class="tabs" aria-label="Main navigation"><div class="tabs-inner">
        ${TABS_BY_ROLE[role].map(
          ([tabId, tabLabel]) => html`
            <button key=${tabId} class=${tab === tabId ? "active" : ""} aria-current=${tab === tabId ? "page" : undefined} onClick=${() => setTab(tabId)}>
              ${tabLabel}${tabId === "alerts" && unreadCount > 0 ? ` (${unreadCount})` : ""}${tabId === "requests" && data.appointments.some(a => a.professorId === currentProfessorId && a.status === "Pending") ? ` (${data.appointments.filter(a => a.professorId === currentProfessorId && a.status === "Pending").length})` : ""}
            </button>
          `,
        )}
      </div></nav>

      <main>
      <div class="page-intro">
          <div>
            <h1>${({ directory: "Find a professor", appointments: "My appointments", alerts: "Updates", requests: "Consultation requests", calendar: "My calendar", manage: "Manage faculty" })[tab] || "Dashboard"}</h1>
          </div>
        </div>
        ${professorViewHasNoProfessor
          ? html`<div class="empty-state">No professors yet. Switch to Admin to add one.</div>`
          : html`
              <div class="stack page-content">
                ${role === "professor" &&
                html`
                  <div class="professor-picker">
                    <label for="professor-view-select">Faculty</label>
                    <select id="professor-view-select" value=${currentProfessorId}
                      onChange=${(event) => setSelectedProfessorId(event.target.value)}>
                      ${data.professors.filter(p => p.active !== false).map(
                        (professor) => html`<option key=${professor.id} value=${professor.id}>${displayName(professor)}</option>`,
                      )}
                    </select>
                  </div>
                `}

              ${tab === "directory" && html`<${Directory} app=${app} />`}
                ${role === "student" &&
                tab === "appointments" &&
                html`<${AppointmentList}
                  app=${app}
                  professorView=${false}
                  appointments=${data.appointments.filter((a) => a.student === STUDENT_NAME)}
                />`}
                ${tab === "alerts" && html`<${Notifications} app=${app} />`}
                ${role === "professor" &&
                tab === "requests" &&
                html`<${AppointmentList}
                  app=${app}
                  professorView=${true}
                  appointments=${data.appointments.filter((a) => a.professorId === currentProfessorId)}
                />`}
                ${role === "professor" &&
                tab === "calendar" &&
                html`<${FacultyCalendar} key=${currentProfessorId} app=${app} professor=${currentProfessor} />`}
                ${tab === "manage" && html`<${ManageFaculty} app=${app} />`}

              </div>
            `}
      </main>

      ${bookingProfessor &&
      html`<${BookingDialog}
        key=${bookingProfessor.id + (bookingAppointment ? bookingAppointment.id : "new")}
        professor=${bookingProfessor}
        appointment=${bookingAppointment}
        app=${app}
        onClose=${() => setBooking(null)}
      />`}

      ${proposalAppointment && findProfessor(proposalAppointment.professorId) && html`<${ProposalDialog}
        appointment=${proposalAppointment}
        professor=${findProfessor(proposalAppointment.professorId)}
        app=${app}
        onClose=${() => setProposalId(null)}
      />`}

      ${confirmDialog &&
      html`
        <${Modal} onClose=${() => setConfirmDialog(null)}>
            <h3>Confirm action</h3>
            <div>${confirmDialog.message}</div>
            <div class="modal-actions">
              <button onClick=${() => setConfirmDialog(null)}>Cancel</button>
              <button
                class="primary"
                onClick=${() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
              >
                Confirm
              </button>
            </div>
        <//>
      `}
      ${toastMessage && html`<div class="toast" role="status" aria-live="polite">${toastMessage}</div>`}
    </div>
  `;
}

createRoot(document.getElementById("root")).render(html`<${App} />`);
