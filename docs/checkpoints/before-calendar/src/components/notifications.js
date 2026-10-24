import { getPhilippineNow, formatClock, formatDate } from '../../utils/time.js';
import { useState, html } from '../ui.js';
export function Notifications({ app }) {
  const [openNotificationId, setOpenNotificationId] = useState(null);

  const myNotifications = app.data.notifications.filter((notification) =>
    app.role === "student"
      ? notification.to === "student"
      : notification.to === "professor" && notification.professorId === app.currentProfessorId,
  );

  function markAsRead(ids) {
    app.updateData("notifications", (list) =>
      list.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)),
    );
  }

  return html`
    <div class="stack">
      <div class="notice-top">
        <span class="muted small fill">In-app demo alerts — no real emails are sent.</span>
        <button
          disabled=${!myNotifications.some((n) => !n.read)}
          onClick=${() => markAsRead(myNotifications.map((n) => n.id))}
        >
          Mark all read
        </button>
      </div>

      ${myNotifications.length
        ? myNotifications.map(
            (notification) => html`
              <div
                key=${notification.id}
                role="button" tabIndex="0" onKeyDown=${e => { if (e.target === e.currentTarget && ["Enter", " "].includes(e.key)) { e.preventDefault(); e.currentTarget.click(); } }}
                class=${"card notification" + (notification.read ? "" : " unread")}
                onClick=${() => {
                  setOpenNotificationId(openNotificationId === notification.id ? null : notification.id);
                  markAsRead([notification.id]);
                }}
              >
                <b style=${{ fontWeight: notification.read ? 400 : 700 }}>${notification.text}</b>
                <span class="muted small">
                  ${formatDate(getPhilippineNow(notification.createdAt).date)}
                  ${formatClock(notification.createdAt)}
                </span>
                ${notification.kind === "knock" && !notification.response && app.role === "professor" && html`<div class="small muted">Open this alert to reply to the student.</div>`}
                ${openNotificationId === notification.id &&
                html`<div>
                  <button
                    onClick=${(event) => {
                      event.stopPropagation();
                      app.setTab(app.role === "student" ? "appointments" : "requests");
                    }}
                  >
                    Open appointments
                  </button>
                  ${app.role === "professor" && notification.kind === "knock" && !notification.response && html`
                    <div class="row" style=${{ marginTop: "10px" }}>
                      ${["Come in", "Please wait", "Not available"].map(answer => html`<button key=${answer} onClick=${e => { e.stopPropagation(); app.respondToKnock(notification, answer); }}>${answer}</button>`)}
                    </div>
                  `}
                  ${notification.response && html`<div class="small muted">Response: ${notification.response}</div>`}
                </div>`}
              </div>
            `,
          )
        : html`<div class="empty-state">You’re all caught up.</div>`}
    </div>
  `;
}


