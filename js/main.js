/***** MAIN: wiring + views (StreamBox) *****/
import { sb, $, state, applySavedTheme, toggleTheme, toast } from './config.js';
import { signIn, signUp, signOut, oauth } from './auth.js';
import { loadFolders, newFolder, renameFolder, deleteFolder } from './folders.js';
import { listFiles, handleFiles, fetchRecent } from './files.js';
import { ensureProfile, loadProfile, saveProfile, initTOTPUI, refreshTOTPStatus } from './profile.js';
import { setupPWA } from './pwa.js';

let APP_INITED = false;

/* -------- Views -------- */
export function showAuth(){
  $('auth-wrap').style.display = 'block';
  $('home-box').style.display = 'none';
  $('app-box').style.display = 'none';
  $('profile-box').style.display = 'none';
}
export function showApp(){           // Files page
  $('auth-wrap').style.display = 'none';
  $('home-box').style.display = 'none';
  $('app-box').style.display = 'block';
  $('profile-box').style.display = 'none';
}
export function showProfile(){
  $('auth-wrap').style.display = 'none';
  $('home-box').style.display = 'none';
  $('app-box').style.display = 'none';
  $('profile-box').style.display = 'block';
  loadProfile();
  refreshTOTPStatus();
}
export function showDashboard(){     // New dashboard
  $('auth-wrap').style.display = 'none';
  $('home-box').style.display = 'block';
  $('app-box').style.display = 'none';
  $('profile-box').style.display = 'none';
  $('user-email-home').textContent = $('user-email').textContent || '';
}

/* -------- App bootstrap -------- */
export function initAppOnce(){
  if (APP_INITED) return;
  APP_INITED = true;

  showDashboard();              // land on Dashboard
  applySavedTheme();

  // prep data used across pages
  loadFolders();                // used on Files page
  listFiles();                  // keeps cache fresh; also needed by recent
  ensureProfile();
  initTOTPUI();
  refreshTOTPStatus();

  loadRecent();                 // dashboard widget
}

/* -------- Auth state watcher (must live here) -------- */
sb.auth.onAuthStateChange((_e, session) => {
  const logged = !!session?.user;
  $('user-email').textContent = logged ? (session.user.email || '') : '';
  if (logged) initAppOnce(); else showAuth();
});
sb.auth.getUser().then(({ data }) => {
  if (data?.user) {
    $('user-email').textContent = data.user.email || '';
    initAppOnce();
  } else {
    showAuth();
  }
});

/* -------- Wire UI -------- */
(function wire(){
  // Theme
  $('btn-theme')?.addEventListener('click', toggleTheme);
  $('btn-theme-auth')?.addEventListener('click', toggleTheme);

  // Auth
  $('btn-signin')?.addEventListener('click', signIn);
  $('btn-signup')?.addEventListener('click', signUp);
  $('btn-signout')?.addEventListener('click', signOut);
  $('btn-apple')?.addEventListener('click', () => oauth('apple'));
  $('btn-google')?.addEventListener('click', () => oauth('google'));

  // Main nav
  $('nav-dashboard')?.addEventListener('click', showDashboard);
  $('nav-files')?.addEventListener('click', showApp);
  $('nav-share')?.addEventListener('click', () => toast('Share page coming soon','info'));
  $('nav-chat') ?.addEventListener('click', () => toast('Chat coming soon','info'));
  $('nav-public')?.addEventListener('click', () => toast('Public feed coming soon','info'));

  // Files topbar (inside Files page)
  $('btn-files')?.addEventListener('click', () => { state.tab = 'files'; listFiles(); });
  $('btn-trash')?.addEventListener('click', () => { state.tab = 'trash'; listFiles(); });
  $('btn-cards')?.addEventListener('click', () => { state.layout = 'grid'; listFiles(); });
  $('btn-rows') ?.addEventListener('click', () => { state.layout = 'rows'; listFiles(); });
  $('btn-profile')?.addEventListener('click', showProfile);

  // Folders (Files page)
  $('btn-folder-new')?.addEventListener('click', newFolder);
  $('btn-folder-rename')?.addEventListener('click', renameFolder);
  $('btn-folder-delete')?.addEventListener('click', deleteFolder);

  // Profile
  $('btn-save-profile')?.addEventListener('click', saveProfile);
  $('btn-back')?.addEventListener('click', showApp);

  // Files upload (Files page)
  const drop = $('drop-area');
  drop?.addEventListener('click', () => $('fileElem').click());
  drop?.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); });
  drop?.addEventListener('drop', e => { e.preventDefault(); handleFiles(e.dataTransfer.files); });
  // Input onchange needs global
  window.handleFiles = handleFiles;

  // PWA
  setupPWA();
})();

/* -------- Dashboard: Recent -------- */
async function loadRecent(){
  const ul = $('recent-list'); if (!ul) return;
  ul.innerHTML = '';
  const { data, error } = await fetchRecent(6);
  if (error) { ul.innerHTML = '<li class="muted">Could not load recent.</li>'; return; }
  if (!data.length) { ul.innerHTML = '<li class="muted">Nothing yet.</li>'; return; }
  data.forEach(item => {
    const li = document.createElement('li');
    const d = new Date(item.created_at);
    li.textContent = `${item.filename} — ${d.toLocaleString()}${item.deleted_at ? ' (trashed)' : ''}`;
    ul.appendChild(li);
  });
}

/* -------- Dashboard: Quick Upload -------- */
(function wireQuickUpload(){
  const qDrop = $('quick-drop');
  const qInput = $('quick-file');
  const qBtn = $('quick-upload-btn');
  let pending = [];

  qDrop?.addEventListener('click', () => qInput?.click());
  qDrop?.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); });
  qDrop?.addEventListener('drop', e => {
    e.preventDefault();
    pending = Array.from(e.dataTransfer.files || []);
    toast(`${pending.length} file(s) ready`, 'info');
  });
  qInput?.addEventListener('change', e => {
    pending = Array.from(e.target.files || []);
    toast(`${pending.length} file(s) ready`, 'info');
  });
  qBtn?.addEventListener('click', async () => {
    if (!pending.length) return toast('Choose files first', 'info');
    await handleFiles(pending);
    pending = [];
    qInput.value = '';
    loadRecent();
    toast('Uploaded', 'success');
  });
})();

/* -------- Dashboard: Vault (placeholder demo) -------- */
(function wireVault(){
  const btn = $('vault-unlock'); const stateEl = $('vault-state');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    try{
      if (!window.PublicKeyCredential) throw new Error('WebAuthn not supported');
      // Later: real WebAuthn challenge flow here.
      stateEl.textContent = 'Unlocked (demo)';
      toast('Vault unlocked (demo)', 'success');
    }catch(e){
      toast('Biometric failed', 'error', e.message || '');
    }
  });
})();
