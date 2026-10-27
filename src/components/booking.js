import { REQUEST_CATEGORIES, BOOKING_HORIZON_DAYS } from '../../config/settings.js';
import { formatTime12h, formatDate } from '../../utils/time.js';
import { displayName, consultationHoursText } from '../helpers.js';
import { useState, html } from '../ui.js';
import { Modal } from './shared.js';
export function BookingDialog({ professor, app, onClose, appointment = null }) {
  const openSlots = app.getOpenSlots(professor);
  const availableDates = [...new Set(openSlots.map((slot) => slot.date))];

  const [selectedDate, setSelectedDate] = useState(() => openSlots.find(slot => !app.isSlotTaken(professor.id, slot.date, slot.time, 1, appointment?.id))?.date || availableDates[0] || "");
  const [selectedTime, setSelectedTime] = useState(() => openSlots.find(slot => !app.isSlotTaken(professor.id, slot.date, slot.time, 1, appointment?.id))?.time || "");
  const [category, setCategory] = useState(appointment ? appointment.category : REQUEST_CATEGORIES[0]);
  const [description, setDescription] = useState(appointment ? appointment.description : "");
  const [errorMessage, setErrorMessage] = useState("");

  function submit() {
    const error = app.requestAppointment(
      professor,
      selectedDate,
      selectedTime,
      category,
      description,
      appointment && appointment.id,
    );
    if (error) setErrorMessage(error);
    else onClose();
  }

  return html`
    <${Modal} onClose=${onClose}>
      <h3>${appointment ? "Request a different time" : "Book a consultation"}</h3>
      <div class="info-banner">A request is <b>not confirmed</b> until the professor approves it. Your chosen time is held while you wait for a reply.</div>
      ${appointment && html`<p class="small muted">Your current time stays reserved until you send this request. The professor will then review your new time.</p>`}
      <p class="modal-subtitle">With <b>${displayName(professor)}</b> · ${consultationHoursText(professor)} (Philippine Time)</p>

      ${availableDates.length
        ? html`
            <label class="field-block">
              <span class="form-label">Select a date</span>
              <select value=${selectedDate} onChange=${(event) => {
                setSelectedDate(event.target.value);
                setSelectedTime("");
              }}>
                ${availableDates.map(
                  (date) => html`<option key=${date} value=${date}>${formatDate(date)}</option>`,
                )}
              </select>
            </label>
            <div class="field-block"><span class="form-label">Available time slots</span>
            <div class="slot-grid">
              ${openSlots
                .filter((slot) => slot.date === selectedDate)
                .map((slot) => {
                  const isTaken = app.isSlotTaken(
                    professor.id,
                    slot.date,
                    slot.time,
                    slot.capacity,
                    appointment && appointment.id,
                  );
                  return html`
                    <button
                      key=${slot.time}
                      disabled=${isTaken}
                      class=${"chip" + (selectedTime === slot.time ? " selected" : "")}
                      onClick=${() => setSelectedTime(slot.time)}
                    >
                      ${formatTime12h(slot.time)}${isTaken ? " · Reserved" : ""}
                    </button>
                  `;
                })}
            </div><p class="small muted">Classes, meetings and unavailable periods are excluded.</p></div>
          `
        : html`<div class="error-text">${professor.schedule.some(x => ['consult','office'].includes(x.type)) ? `No consultation times are available in the next ${BOOKING_HORIZON_DAYS} days. Please check back later or contact the professor.` : 'No consultation or office hours have been posted.'}</div>`}

      <label class="field-block"><span class="form-label">Reason for consultation</span>
        <select value=${category} onChange=${(event) => setCategory(event.target.value)}>
          ${REQUEST_CATEGORIES.map((name) => html`<option key=${name}>${name}</option>`)}
        </select>
      </label>
      <label class="field-block"><span class="form-label">Description</span>
        <textarea maxLength="1000" rows="3" placeholder="Briefly describe your concern…" value=${description}
          onInput=${(event) => setDescription(event.target.value)}></textarea>
      </label>

      ${errorMessage && html`<div class="error-text">${errorMessage}</div>`}

      <div class="modal-actions">
        <button onClick=${onClose}>Cancel</button>
        <button class="primary" disabled=${!selectedDate || !selectedTime} onClick=${submit}>${appointment ? "Request reschedule" : "Submit request"}</button>
      </div>
    <//>
  `;
}

export function ProposalDialog({ appointment, professor, app, onClose }) {
  const slots = app.getOpenSlots(professor).filter(s => !app.isSlotTaken(professor.id, s.date, s.time, s.capacity, appointment.id));
  const dates = [...new Set(slots.map(s => s.date))];
  const [date, setDate] = useState(dates[0] || "");
  const [time, setTime] = useState("");
  const [error, setError] = useState("");
  return html`<${Modal} onClose=${onClose}>
    <h3>Suggest another consultation time</h3>
    <p class="modal-subtitle">Choose a time that works for you. The consultation will be confirmed once the student accepts.</p>
    ${dates.length ? html`
      <label class="field-block"><span class="form-label">Date</span><select value=${date} onChange=${e => { setDate(e.target.value); setTime(""); }}>
        ${dates.map(d => html`<option key=${d} value=${d}>${formatDate(d)}</option>`)}
      </select></label>
      <div class="field-block"><span class="form-label">Time</span><div class="slot-grid">
        ${slots.filter(s => s.date === date).map(s => html`<button key=${s.time} class=${"chip" + (s.time === time ? " selected" : "")} onClick=${() => setTime(s.time)}>${formatTime12h(s.time)}</button>`)}
      </div></div>` : html`<div class="error-text">There are no other consultation times available right now.</div>`}
    ${error && html`<div class="error-text">${error}</div>`}
    <div class="modal-actions"><button onClick=${onClose}>Cancel</button>
      <button class="primary" disabled=${!date || !time} onClick=${() => { const msg = app.proposeTime(appointment, date, time); if (msg) setError(msg); else onClose(); }}>Send suggested time</button>
    </div>
  <//>`;
}


