/***** CONFIG + GLOBALS *****/
export const SUPABASE_URL = "https://kulgncyhgksjdvprgfdy.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1bGduY3loZ2tzamR2cHJnZmR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5OTA1ODQsImV4cCI6MjA3MDU2NjU4NH0.XA6R7qZDO1jypaCEeIfGJKo8DmUdpxcYBnB0Ih3K8ms";
export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const $ = (id)=>document.getElementById(id);
export const state = { tab:'files', layout:'grid', currentFolder:null, folders:[], mfa:{enrolling:null, activeFactors:[]} };

export const ext = n => (n?.split('.').pop()||'').toLowerCase();
export const isImg = e => ['png','jpg','jpeg','webp','gif','avif'].includes(e);
export const isVid = e => ['mp4','webm','mov','m4v'].includes(e);
export const isAud = e => ['mp3','wav','m4a','aac','ogg','flac'].includes(e);
export const isPdf = e => e==='pdf';
export const bucketFor = row => row.deleted_at ? 'user-trash' : 'user-files';

export function esc(s){ return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
export function toast(msg,type='info',detail=''){
  const box=$('toasts'); if(!box) return alert(msg+(detail?`\n${detail}`:''));
  const t=document.createElement('div'); t.className='toast '+type;
  t.innerHTML=esc(msg)+(detail?`<small>${esc(detail)}</small>`:'');
  box.appendChild(t);
  setTimeout(()=>t.remove(),4500);
}

/* Theme */
export function applySavedTheme(){
  const saved = localStorage.getItem('streambox-theme');
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
