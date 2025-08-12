/***** CONTEXT MENU (3-dots) *****/
import { toast } from './config.js';
import { renameFile, openMoveModal, moveToTrash, restoreFile, deleteForever } from './files.js';

export function openMenu(ev, f, url) {
  document.querySelectorAll('.menu').forEach(m => m.remove());

  const m = document.createElement('div');
  m.className = 'menu';
  m.addEventListener('click', e => e.stopPropagation());

  const add = (label, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = () => { m.remove(); fn(); };
    m.appendChild(b);
  };

  if (!f.deleted_at) {
    add('Open', () => { if (url) window.open(url, '_blank'); else toast('No preview', 'info'); });
    add('Download', () => {
      if (!url) return;
      const a = document.createElement('a');
      a.href = url; a.download = f.filename; document.body.appendChild(a); a.click(); a.remove();
    });
    add('Rename', () => renameFile(f));
    add('Move to…', () => openMoveModal(f));
    add('Move to Trash', () => moveToTrash(f));
  } else {
    add('Restore', () => restoreFile(f));
    add('Delete Forever', () => deleteForever(f));
  }

  document.body.appendChild(m);

  const PAD = 10;
  const mw = Math.min(360, window.innerWidth * 0.92);
  const clickX = (ev.clientX ?? 12) + window.scrollX;
  const clickY = (ev.clientY ?? 12) + window.scrollY;
  let mh = m.getBoundingClientRect().height || 160;

  let left = clickX + 6;
  let top  = clickY + 6;

  if (left + mw + PAD > window.scrollX + window.innerWidth) left = Math.max(PAD, clickX - mw - 6);
  if (top + mh + PAD > window.scrollY + window.innerHeight) top = Math.max(PAD, clickY - mh - 6);

  const isMobile = window.innerWidth <= 680;
  if (isMobile) {
    m.classList.add('sheet');
    m.style.left   = '12px';
    m.style.right  = '12px';
    m.style.bottom = 'max(12px, env(safe-area-inset-bottom))';
    m.style.top    = 'auto';
  } else {
    m.style.left = `${left}px`;
    m.style.top  = `${top}px`;
  }

  const close = () => { m.remove(); document.removeEventListener('click', onDoc, true); document.removeEventListener('keydown', onKey, true); };
  const onDoc = (e) => { if (!e.target.closest('.menu') && !e.target.closest('.kebab') && !e.target.closest('.kebab-row')) close(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  setTimeout(() => { document.addEventListener('click', onDoc, true); document.addEventListener('keydown', onKey, true); }, 0);
}
