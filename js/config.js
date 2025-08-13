/***** CONFIG / CORE HELPERS (StreamBox) *****/

// ——— Supabase ———
export const SUPABASE_URL = "https://kulgncyhgksjdvprgfdy.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1bGduY3loZ2tzamR2cHJnZmR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5OTA1ODQsImV4cCI6MjA3MDU2NjU4NH0.XA6R7qZDO1jypaCEeIfGJKo8DmUdpxcYBnB0Ih3K8ms";

if (!window.supabase) {
  alert("Supabase SDK failed to load. Check the <script> tag in index.html.");
}
export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ——— DOM + state ———
export const $ = (id) => document.getElementById(id);
export const state = { tab: 'files', layout: 'grid', currentFolder: null };

// ——— Toasts ———
export function toast(msg, type='info', detail='') {
  const box = $('toasts');
  if (!box) return alert(msg + (detail ? `\n${detail}` : ''));
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = esc(msg) + (detail ? `<small>${esc(detail)}</small>` : '');
  box.appendChild(t);
  setTimeout(() => t.remove(), 4500);
}
const esc = s => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

// ——— Theme ———
export function applySavedTheme(){
  const saved = localStorage.getItem('streambox-theme'); // 'light'|'dark'|null
  if (saved === 'light') document.body.setAttribute('data-theme','light');
  else if (saved === 'dark') document.body.setAttribute('data-theme','dark');
  else document.body.removeAttribute('data-theme');
}
export function toggleTheme(){
  const cur = document.body.getAttribute('data-theme');
  let next;
  if (!cur) {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    next = prefersDark ? 'light' : 'dark';
  } else {
    next = cur === 'dark' ? 'light' : 'dark';
  }
  document.body.setAttribute('data-theme', next);
  localStorage.setItem('streambox-theme', next);
  toast(`Theme: ${next}`, 'info');
}

// ——— Crash catcher (show errors as toast so you SEE them) ———
window.addEventListener('error', (e) => {
  toast('JS error', 'error', (e?.message || 'Unknown') + '');
});
window.addEventListener('unhandledrejection', (e) => {
  const msg = e?.reason?.message || e?.reason || 'Promise rejected';
  toast('JS promise error', 'error', String(msg));
});
