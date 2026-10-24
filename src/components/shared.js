import { STATUS_INFO } from '../../config/settings.js';
import { useEffect, useRef, html } from '../ui.js';
export function StatusPill({ status, label }) {
  const { color, icon } = STATUS_INFO[status];
  return html`<span class="pill" style=${{ "--color": color }}>${icon} ${label || STATUS_INFO[status].label}</span>`;
}

export function Modal({ onClose, children }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const dialog = dialogRef.current;
    dialog.showModal();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = oldOverflow;
      previouslyFocused?.focus();
    };
  }, []);
  return html`
    <dialog ref=${dialogRef} class="overlay" aria-label="Profraesto dialog" onCancel=${e => { e.preventDefault(); closeRef.current(); }} onClick=${e => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="modal"><button class="dialog-close" aria-label="Close dialog" onClick=${onClose}>×</button>${children}</div>
    </dialog>
  `;
}


