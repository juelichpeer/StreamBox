/***** CONTEXT MENU (3-dots) *****/
import { toast } from './config.js';
import { renameFile, openMoveModal, moveToTrash, restoreFile, deleteForever } from './files.js';

export function openMenu(ev, f, url) {
  // cleanup
  document.querySelectorAll('.menu, .menu-overlay').forEach(n => n.remove());

  // overlay to catch taps & lock scroll
  const overlay = document.createElement('div');
  overlay.className = 'menu-overlay';
  overlay.addEventListener('click', close);
  document.body.appendChild(overlay);
  document.body.classList.add('no-scroll');

  // menu
  const m = document.createElement('div');
  m.className = 'menu';
  m.addEventListener('click', e => e.stopPropagation());

  const add = (label, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = () => { close(); fn(); };
    m.appendChild(b);
  };

  if (!f.deleted_at) {
    add('Open', () => { if (url) window.open(url, '_blank'); else toast('No preview', 'info'); });
    add('Download', () => {
      if (!url) return;
      const a = document.createElement('a');
      a.href = url; a.download = f.filename;
      document.body.appendChild(a); a.click(); a.remove();
    });
    add('Rename', () => renameFile(f));
    add('Move to…', () => openMoveModal(f));
    add('Move to Trash', () => moveToTrash(f));
  } else {
    add('Restore', () => restoreFile(f));
    add('Delete Forever', () => deleteForever(f));
  }

  document.body.appendChild(m);

  // position relative to the kebab button (robust in PWA)
  const anchor = ev.currentTarget || ev.target;
  const r = anchor.getBoundingClientRect();
  const mw = Math.min(360, window.innerWidth * 0.92);
  const PAD = 10;

  // default: below-right
  let left = r.left + window.scrollX - (mw - r.width);
  let top  = r.bottom + window.scrollY + 6;

  // constrain horizontally
  if (left < PAD) left = PAD;
  if (left + mw + PAD > window.scrollX + window.innerWidth) {
    left = Math.max(PAD, window.scrollX + window.innerWidth - mw - PAD);
  }

  // set to measure height, then possibly flip
  m.style.left = `${left}px`;
  m.style.top  = `${top}px`;
  const mh = m.getBoundingClientRect().height || 160;

  // flip above if would overflow bottom
  if (top + mh + PAD > window.scrollY + window.innerHeight) {
    top = Math.max(PAD, r.top + window.scrollY - mh - 6);
  }

  const isMobile = window.innerWidth <= 680;
  if (isMobile) {
    // bottom sheet on phones
    m.classList.add('sheet');
    m.style.left   = '12px';
    m.style.right  = '12px';
    m.style.bottom = 'max(12px, env(safe-area-inset-bottom))';
    m.style.top    = 'auto';
  } else {
    m.style.left = `${left}px`;
    m.style.top  = `${top}px`;
  }

  // close helpers
  function close(){
    m.remove();
    overlay.remove();
    document.body.classList.remove('no-scroll');
    document.removeEventListener('keydown', onKey, true);
  }
  function onKey(e){ if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey, true);
}
