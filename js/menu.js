/***** CONTEXT MENU (files + folders unified) *****/
import { toast } from './config.js';
import { renameFile, openMoveModal, moveToTrash, restoreFile, deleteForever } from './files.js';
import { openFolder, renameFolderById, deleteFolderById } from './folders.js';

/**
 * openMenu(ev, item, url?)
 * - Files: pass the file row as `item` (has id, filename, deleted_at, etc.)
 * - Folders: pass an object { _type:'folder', id, name }
 */
export function openMenu(ev, item, url) {
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

  // Folder menu
  if (item && item._type === 'folder') {
    add('Open', () => openFolder({ id: item.id, name: item.name }));
    add('Rename', () => renameFolderById(item));
    add('Delete', () => deleteFolderById(item));
  }
  // File menu
  else {
    if (!item.deleted_at) {
      add('Open', () => { if (url) window.open(url, '_blank'); else toast('No preview', 'info'); });
      add('Download', () => {
        if (!url) return;
        const a = document.createElement('a');
        a.href = url; a.download = item.filename;
        document.body.appendChild(a); a.click(); a.remove();
      });
      add('Rename', () => renameFile(item));
      add('Move to…', () => openMoveModal(item));
      add('Move to Trash', () => moveToTrash(item));
    } else {
      add('Restore', () => restoreFile(item));
      add('Delete Forever', () => deleteForever(item));
    }
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
