/***** MAIN: wiring + views *****/
import { $, state, applySavedTheme, toggleTheme } from './config.js';
import { signIn, signUp, signOut, oauth } from './auth.js';
import { loadFolders, newFolder, renameFolder, deleteFolder } from './folders.js';
import { listFiles, handleFiles } from './files.js';
import { ensureProfile, loadProfile, saveProfile, initTOTPUI, refreshTOTPStatus } from './profile.js';
import { setupPWA } from './pwa.js';

let APP_INITED=false;

export function showAuth(){ $('auth-wrap').style.display='block'; $('app-box').style.display='none'; $('profile-box').style.display='none'; }
export function showApp(){  $('auth-wrap').style.display='none';  $('app-box').style.display='block'; $('profile-box').style.display='none'; }
export function showProfile(){ $('auth-wrap').style.display='none'; $('app-box').style.display='none'; $('profile-box').style.display='block'; loadProfile(); refreshTOTPStatus(); }

export function initAppOnce(){
  if(APP_INITED) return;
  APP_INITED=true;
  showApp();
  applySavedTheme();
  loadFolders();
  listFiles();
  ensureProfile();
  initTOTPUI();
  refreshTOTPStatus();
}

(function wire(){
  // theme
  $('btn-theme')?.addEventListener('click', toggleTheme);
  $('btn-theme-auth')?.addEventListener('click', toggleTheme);

  // auth
  $('btn-signin')?.addEventListener('click',signIn);
  $('btn-signup')?.addEventListener('click',signUp);
  $('btn-signout')?.addEventListener('click',signOut);
  $('btn-apple')?.addEventListener('click',()=>oauth('apple'));
  $('btn-google')?.addEventListener('click',()=>oauth('google'));

  // topbar
  $('btn-files')?.addEventListener('click',()=>{state.tab='files'; listFiles();});
  $('btn-trash')?.addEventListener('click',()=>{state.tab='trash'; listFiles();});
  $('btn-cards')?.addEventListener('click',()=>{state.layout='grid'; listFiles();});
  $('btn-rows') ?.addEventListener('click',()=>{state.layout='rows'; listFiles();});
  $('btn-profile')?.addEventListener('click',showProfile);

  // folders
  $('btn-folder-new')?.addEventListener('click',newFolder);
  $('btn-folder-rename')?.addEventListener('click',renameFolder);
  $('btn-folder-delete')?.addEventListener('click',deleteFolder);

  // profile
  $('btn-save-profile')?.addEventListener('click',saveProfile);
  $('btn-back')?.addEventListener('click',showApp);

  // uploads
  const drop=$('drop-area');
  drop?.addEventListener('click',()=>$('fileElem').click());
  drop?.addEventListener('dragover',e=>{e.preventDefault();e.stopPropagation();});
  drop?.addEventListener('drop',e=>{e.preventDefault();handleFiles(e.dataTransfer.files);});
  window.handleFiles = handleFiles; // for input onchange

  // PWA
  setupPWA();
})();
