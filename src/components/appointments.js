import { MINUTE, CONSULTATION_MINUTES, APPOINTMENT_STATUS_COLORS } from '../../config/settings.js';
import { formatTime12h, formatDate } from '../../utils/time.js';
import { appointmentConflicts, slotStartsInPast } from '../../utils/scheduling.js';
import { displayName } from '../helpers.js';
import { useState, html } from '../ui.js';
import * as domain from '../../utils/scheduling.js';
export function AppointmentRow({ appointment, app, professorView }) {
  const professor = app.findProfessor(appointment.professorId);
  const [responseText, setResponseText] = useState("");

  const title = professorView ? appointment.student : displayName(professor);
  const details = [
    formatDate(appointment.date),
    formatTime12h(appointment.time),
    appointment.category,
  ];
  if (!professorView) details.push(professor?.office || "Office unavailable");
  if (appointment.status === "Proposed") details.unshift("Original request:");

  return html`
    <article class="card appointment-card">
      <div class="row">
        <b class="fill appointment-title">${title}</b>
        <span class="pill" style=${{ "--color": APPOINTMENT_STATUS_COLORS[appointment.status] }}>
          ${appointment.status}
        </span>
      </div>
      <div class="muted small appointment-details">${details.join(" · ")}</div>
      ${appointment.status === "Pending" && html`<div class="info-banner">${professorView ? 'Waiting for your reply. You can approve, decline or suggest another time.' : 'Waiting for the professor to reply. Your consultation will be confirmed once approved.'}</div>`}
      ${appointment.status === "Approved" && html`<div class="success-note">Confirmed consultation · ${formatDate(appointment.date)} at ${formatTime12h(appointment.time)}</div>`}
      ${["Pending", "Approved", "Needs action"].includes(appointment.status) && appointmentConflicts(professor, appointment) && html`<div class="error-text">${appointmentConflicts(professor, appointment)}. ${professorView ? 'Please arrange a new time with the student.' : 'Please contact the professor or request another time.'}</div>`}
      ${appointment.status === "Needs action" && html`<div class="error-text">${professorView ? 'This consultation needs a new time. The student has been notified.' : 'Your consultation needs a new time. Please send another request.'}</div>`}
      ${appointment.status === "Expired" && html`<div class="muted small">This request passed without a response. Please choose another time.</div>`}
      ${appointment.status === "Proposed" && appointment.proposal && html`<div class="info-banner">${professorView ? 'You suggested' : 'The professor suggested'} <b>${formatDate(appointment.proposal.date)} at ${formatTime12h(appointment.proposal.time)}</b>. ${professorView ? 'Waiting for the student to accept.' : 'Accept this time to confirm your consultation.'}</div>`}
      <div class="appointment-description">${appointment.description}</div>
      ${appointment.response && html`<div class="appointment-response"><b>Response:</b> ${appointment.response}</div>`}

      ${professorView &&
      appointment.status === "Pending" &&
      html`
        <div class="row appointment-actions">
          <input
            aria-label="Add a message (optional)" placeholder="Add a message (optional)"
            value=${responseText}
            onInput=${(event) => setResponseText(event.target.value)}
          />
          <button class="primary" onClick=${() => app.decide(appointment, "Approved", responseText)}>
            Approve
          </button>
          <button onClick=${() => app.decide(appointment, "Rejected", responseText)}>Decline</button>
          <button onClick=${() => app.openProposal(appointment)}>Suggest time</button>
        </div>
      `}
      ${professorView &&
      appointment.status === "Approved" &&
      html`<div><button disabled=${domain.toTimestamp(appointment.date, appointment.time) > app.now} onClick=${() => app.complete(appointment)}>Mark as completed</button><button onClick=${() => app.cancel(appointment)}>Cancel consultation</button></div>`}
      ${!professorView && appointment.status === "Proposed" && html`<div class="row appointment-actions">
        <button class="primary" onClick=${() => app.answerProposal(appointment, true)}>Accept proposed time</button>
        <button onClick=${() => app.answerProposal(appointment, false)}>Decline</button>
      </div>`}
      ${!professorView && professor && professor.active !== false &&
      ["Pending", "Approved", "Needs action"].includes(appointment.status) && (appointment.status === 'Needs action' || domain.toTimestamp(appointment.date, appointment.time) + CONSULTATION_MINUTES * MINUTE > app.now) &&
      html`<div class="row appointment-actions">
        <button onClick=${() => app.openBooking(appointment.professorId, appointment.id)}>Reschedule</button>
        <button onClick=${() => app.cancel(appointment)}>Cancel ${appointment.status === "Approved" ? "consultation" : "request"}</button>
      </div>`}
    </article>
  `;
}

// Splits appointments into "Upcoming" (pending/approved) and "History" (everything else).
export function AppointmentList({ app, appointments, professorView }) {
  function renderSection(isUpcoming, soonestFirst, emptyMessage) {
    const sectionAppointments = appointments
      .filter((a) => (["Pending", "Approved", "Needs action"].includes(a.status) && domain.toTimestamp(a.date, a.time) + CONSULTATION_MINUTES * MINUTE > app.now || a.status === "Proposed" && a.proposal && !slotStartsInPast(a.proposal.date, a.proposal.time, app.now)) === isUpcoming)
      .sort((a, b) => {
        const order = (a.date + a.time).localeCompare(b.date + b.time);
        return soonestFirst ? order : -order;
      });

    if (sectionAppointments.length === 0) return html`<div class="empty-state">${emptyMessage}</div>`;
    return sectionAppointments.map(
      (appointment) =>
        html`<${AppointmentRow}
          key=${appointment.id}
          appointment=${appointment}
          app=${app}
          professorView=${professorView}
        />`,
    );
  }

  return html`
    <div class="stack appointment-view">
      <section class="appointment-section">
        <div class="section-heading"><h3>Upcoming</h3><span class="section-caption">Pending, proposed & confirmed consultations</span></div>
        ${renderSection(true, true, "No upcoming consultations yet.")}
      </section>
      <section class="appointment-section">
        <div class="section-heading"><h3>History</h3><span class="section-caption">Previous requests and consultations</span></div>
        ${renderSection(false, false, "No past consultations yet.")}
      </section>
    </div>
  `;
}


