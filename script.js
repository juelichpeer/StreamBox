/*************************************************
 * STREAMBOX – Full app with Theme Toggle + Auth + Files + Folders + 2FA + Move modal
 *************************************************/

/* ===== Setup ===== */
const SUPABASE_URL = "https://kulgncyhgksjdvprgfdy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1bGduY3loZ2tzamR2cHJnZmR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5OTA1ODQsImV4cCI6MjA3MDU2NjU4NH0.XA6R7qZDO1jypaCEeIfGJKo8DmUdpxcYBnB0Ih3K8ms";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (id)=>document.getElementById(id);
const state = { tab:'files', layout:'grid', currentFolder:null, folders:[], mfa: { enrolling: null, activeFactors: [] } };
let APP_INITED = false;
function initAppOnce(){ if(APP_INITED) return; APP_INITED=true; showApp(); loadFolders(); listFiles(); ensureProfile(); initTOTPUI(); refreshTOTPStatus(); }

/* ===== Theme Toggle ===== */
function applySavedTheme(){
  const saved = localStorage.getItem('streambox-theme'); // 'light' | 'dark' | null
  if (saved === 'light') document.body.setAttribute('data-theme','light');
  else if (saved === 'dark') document.body.setAttribute('data-theme','dark');
  else document.body.removeAttribute('data-theme'); // follow system
}
function toggleTheme(){
  const cur = document.body.getAttribute('data-theme'); // null | 'light' | 'dark'
  let next;
  if (!cur) { // currently following system — flip to explicit dark or light based on system
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    next = prefersDark ? 'light' : 'dark';
  } else {
    next = cur === 'dark' ? 'light' : 'dark';
  }
  document.body.setAttribute('data-theme', next);
  localStorage.setItem('streambox-theme', next);
  toast(`Theme: ${next}`, 'info');
}
applySavedTheme();

/* ===== Helpers ===== */
const ext = n => (n?.split('.').pop()||'').toLowerCase();
const isImg = e => ['png','jpg','jpeg','webp','gif','avif'].includes(e);
const isVid = e => ['mp4','webm','mov','m4v'].includes(e);
const isAud = e => ['mp3','wav','m4a','aac','ogg','flac'].includes(e);
const isPdf = e => e==='pdf';
const bucketFor = row => row.deleted_at ? 'user-trash' : 'user-files';

/* ===== Toasts ===== */
function toast(msg,type='info',detail=''){ const box=$('toasts'); const t=document.createElement('div'); t.className='toast '+type; t.innerHTML=esc(msg)+(detail?`<small>${esc(detail)}</small>`:''); box.appendChild(t); setTimeout(()=>t.remove(),4500); }
const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

/* ===== Navigation ===== */
function showAuth(){ $('auth-wrap').style.display='block'; $('app-box').style.display='none'; $('profile-box').style.display='none'; }
function showApp(){  $('auth-wrap').style.display='none';  $('app-box').style.display='block'; $('profile-box').style.display='none'; }
function showProfile(){ $('auth-wrap').style.display='none'; $('app-box').style.display='none'; $('profile-box').style.display='block'; loadProfile(); refreshTOTPStatus(); }

/* ===== Auth (email/pass + OAuth) ===== */
async function signUp(){ const email=$('email')?.value?.trim(), pw=$('password')?.value||''; if(!email||!pw) return toast('Enter email and password','error'); const {error}=await sb.auth.signUp({email,password:pw}); if(error) return toast('Sign up failed','error',error.message); toast('Sign up success','success','Confirm by email, then sign in'); }

async function signIn(){
  const email=$('email')?.value?.trim(), pw=$('password')?.value||'';
  if(!email||!pw) return toast('Enter email and password','error');

  const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });

  if (data?.session) { toast('Login success','success'); return; }

  if (error && /MFA|multi[- ]?factor|factor/i.test(error.message||'')) {
    try {
      const lf = await sb.auth.mfa.listFactors();
      const totp = (lf.data?.totp?.factors || []).find(f => f.status === 'verified') || (lf.data?.totp?.factors || [])[0];
      if (!totp) return toast('MFA required but no TOTP factor found','error');
      const ch = await sb.auth.mfa.challenge({ factorId: totp.id });
      if (ch.error) return toast('MFA challenge error','error', ch.error.message);
      const code = prompt('Enter 6-digit code from your authenticator app:');
      if (code === null || !code.trim()) return toast('MFA canceled','info');
      const ver = await sb.auth.mfa.verify({ factorId: totp.id, code: code.trim(), challengeId: ch.data.id });
      if (ver.error) return toast('MFA verify error','error', ver.error.message);
      toast('MFA success','success');
      return;
    } catch (e) { return toast('MFA flow crashed','error', e.message||'Unknown'); }
  }

  if (error) return toast('Login failed','error',error.message);
}

async function signOut(){ await sb.auth.signOut(); toast('Signed out','info'); }
async function oauth(provider){
  const redirectTo = window.location.origin;
  const { error } = await sb.auth.signInWithOAuth({ provider, options:{ redirectTo } });
  if (error) toast('OAuth error','error',error.message); else toast('Redirecting…','info');
}

sb.auth.onAuthStateChange((_e,session)=>{ const logged=!!session?.user; $('user-email').textContent = logged ? (session.user.email||'') : ''; if(logged) initAppOnce(); else showAuth(); });
sb.auth.getUser().then(({data})=>{ if(data?.user){ $('user-email').textContent=data.user.email||''; initAppOnce(); } });

/* ===== Folders ===== */
async function loadFolders(){
  const virtualAll={id:null,name:'All Files'};
  const {data,error}=await sb.from('folders').select('*').order('created_at',{ascending:true});
  state.folders = error ? [virtualAll] : [virtualAll, ...(data||[])];
  if(!state.currentFolder || !state.folders.some(f=>f.id===state.currentFolder.id)) state.currentFolder=virtualAll;
  renderFolders();
}
function renderFolders(){
  const ul=$('folder-list'); if(!ul) return; ul.innerHTML='';
  state.folders.forEach(f=>{ const li=document.createElement('li'); li.textContent=f.name; if(state.currentFolder?.id===f.id) li.classList.add('active'); li.onclick=()=>{state.currentFolder=f; listFiles(); renderFolders();}; ul.appendChild(li); });
  updateSectionTitle();
}
function updateSectionTitle(){ const base=state.tab==='files'?'Your Files':'Trash'; const suffix=state.currentFolder?.id?` — ${state.currentFolder.name}`:''; const el=$('section-title'); if(el) el.textContent=base+suffix; }
async function newFolder(){ const name=prompt('Folder name:'); if(name===null) return; const clean=name.trim(); if(!clean) return toast('Folder name cannot be empty','error'); const {data:sess}=await sb.auth.getSession(); if(!sess?.session) return toast('Not logged in','error'); const uid=sess.session.user.id; const {data,error}=await sb.from('folders').insert([{user_id:uid,name:clean}]).select().single(); if(error) return toast('Create folder error','error',error.message); toast('Folder created','success'); state.currentFolder=data; await loadFolders(); await listFiles(); }
async function renameFolder(){ if(!state.currentFolder?.id) return toast('Select a folder (not "All Files")','info'); let name=prompt('New folder name:',state.currentFolder.name); if(name===null) return; name=name.trim(); if(!name) return toast('Folder name cannot be empty','error'); const {error}=await sb.from('folders').update({name}).eq('id',state.currentFolder.id); if(error) return toast('Rename folder error','error',error.message); toast('Folder renamed','success'); state.currentFolder.name=name; renderFolders(); listFiles(); }
async function deleteFolder(){ if(!state.currentFolder?.id) return toast('Select a folder (not "All Files")','info'); if(!confirm('Delete this folder? Move or delete files first.')) return; const {data:filesIn,error:qErr}=await sb.from('files').select('id').eq('folder_id',state.currentFolder.id).limit(1); if(qErr) return toast('Check folder error','error',qErr.message); if(filesIn?.length) return toast('Folder not empty','error','Move or delete files first'); const {error}=await sb.from('folders').delete().eq('id',state.currentFolder.id); if(error) return toast('Delete folder error','error',error.message); toast('Folder deleted','success'); state.currentFolder={id:null,name:'All Files'}; await loadFolders(); await listFiles(); }

/* ===== Files ===== */
async function handleFiles(files){
  const {data:sess}=await sb.auth.getSession(); if(!sess?.session) return toast('Not logged in','error'); const uid=sess.session.user.id;
  for(const file of files){
    const folderSeg = state.currentFolder?.id ? `${state.currentFolder.name}/` : '';
    const path = `${uid}/${folderSeg}${file.name}`;
    const up=await sb.storage.from('user-files').upload(path,file,{upsert:true});
    if(up.error){ toast('Upload error','error',up.error.message); continue; }
    const ins=await sb.from('files').insert([{ user_id:uid, folder_id:state.currentFolder?.id||null, filename:file.name, filepath:path }]);
    if(ins.error){ await sb.storage.from('user-files').remove([path]); toast('DB insert error','error',ins.error.message); }
  }
  listFiles();
}
async function listFiles(){
  const list=$('file-list'); if(!list) return;
  list.className = state.layout==='grid' ? 'grid' : 'row-list'; list.innerHTML='';
  let q=sb.from('files').select('*').order('created_at',{ascending:false});
  q = state.tab==='files' ? q.is('deleted_at',null) : q.not('deleted_at','is',null);
  if(state.currentFolder?.id) q=q.eq('folder_id',state.currentFolder.id);
  const {data,error}=await q; if(error) return toast('List error','error',error.message);
  if(!data?.length){ updateSectionTitle(); return; }
  for(const f of data){
    const bucket=bucketFor(f); const sig=await sb.storage.from(bucket).createSignedUrl(f.filepath,180); const url=sig.data?.signedUrl||null;
    const e=ext(f.filename);
    if(state.layout==='grid'){
      const li=document.createElement('li'); li.className='file-card';
      const keb=document.createElement('div'); keb.className='kebab'; keb.onclick=(ev)=>{ev.stopPropagation(); openMenu(ev,f,url);};
      const thumb=document.createElement('div'); thumb.className='thumb';
      if(url && isImg(e)) thumb.innerHTML=`<img src="${url}" alt="${f.filename}" loading="lazy">`;
      else if(url && isVid(e)) thumb.innerHTML=`<video src="${url}" controls></video>`;
      else if(url && isAud(e)) thumb.innerHTML=`<audio src="${url}" controls></audio>`;
      else if(isPdf(e)) thumb.innerHTML=`<div>PDF</div>`; else thumb.innerHTML=`<div>${(e||'FILE').toUpperCase()}</div>`;
      const name=document.createElement('div'); name.className='file-name'; name.textContent=f.filename; name.title=f.filename;
      li.appendChild(thumb); li.appendChild(name); li.appendChild(keb); list.appendChild(li);
    } else {
      const row=document.createElement('li'); row.className='row-item';
      const th=document.createElement('div'); th.className='row-thumb'; if(url && isImg(e)) th.innerHTML=`<img src="${url}" alt="${f.filename}" loading="lazy">`;
      const nm=document.createElement('div'); nm.className='row-name'; nm.textContent=f.filename; nm.title=f.filename;
      const keb=document.createElement('div'); keb.className='kebab-row'; keb.onclick=(ev)=>{ev.stopPropagation(); openMenu(ev,f,url);};
      row.appendChild(th); row.appendChild(nm); row.appendChild(keb); list.appendChild(row);
    }
  }
  updateSectionTitle();
}

/* ===== Move modal + actions ===== */
let MOVE_CTX = { file:null, selectedId:null };
function openMenu(ev,f,url){
  document.querySelectorAll('.menu').forEach(m=>m.remove());
  const m=document.createElement('div'); m.className='menu'; m.addEventListener('click',e=>e.stopPropagation());
  const add=(label,fn)=>{ const b=document.createElement('button'); b.textContent=label; b.onclick=()=>{ m.remove(); fn(); }; m.appendChild(b); };
  if(!f.deleted_at){
    add('Open', ()=>{ if(url) window.open(url,'_blank'); else toast('No preview','info'); });
    add('Download', ()=>{ if(!url) return; const a=document.createElement('a'); a.href=url; a.download=f.filename; a.click(); });
    add('Rename', ()=> renameFile(f));
    add('Move to…', ()=> openMoveModal(f));
    add('Move to Trash', ()=> moveToTrash(f));
  }else{
    add('Restore', ()=> restoreFile(f));
    add('Delete Forever', ()=> deleteForever(f));
  }
  document.body.appendChild(m); m.style.left=ev.pageX+'px'; m.style.top=ev.pageY+'px'; m.style.position='absolute'; m.style.zIndex=9999;
  document.addEventListener('click',()=>m.remove(),{once:true});
}
function openMoveModal(fileRow){
  MOVE_CTX.file = fileRow;
  MOVE_CTX.selectedId = fileRow.folder_id ?? null;
  $('move-file').textContent = fileRow.filename;
  const box = $('move-options'); box.innerHTML='';
  state.folders.forEach(f=>{
    const id = f.id === null ? 'root' : f.id;
    const wrap = document.createElement('label'); wrap.className='opt';
    const r = document.createElement('input'); r.type='radio'; r.name='move-dest'; r.value = id;
    if (MOVE_CTX.selectedId === f.id) r.checked = true;
    const text = document.createElement('span'); text.textContent = f.name;
    wrap.appendChild(r); wrap.appendChild(text);
    wrap.onclick = ()=>{ r.checked = true; MOVE_CTX.selectedId = (id==='root'? null : f.id); };
    box.appendChild(wrap);
  });
  $('move-overlay').style.display='flex';
  $('move-cancel').onclick = closeMoveModal;
  $('move-confirm').onclick = performMove;
  $('move-overlay').onclick = (e)=>{ if(e.target.id==='move-overlay') closeMoveModal(); };
}
function closeMoveModal(){ $('move-overlay').style.display='none'; MOVE_CTX={file:null,selectedId:null}; }
async function performMove(){
  const f = MOVE_CTX.file; const targetId = MOVE_CTX.selectedId;
  if(!f) return closeMoveModal();
  if ((f.folder_id ?? null) === (targetId ?? null)) { toast('Already in that folder','info'); return closeMoveModal(); }
  const uid = f.filepath.split('/')[0];
  const newPath = targetId ? `${uid}/${state.folders.find(x=>x.id===targetId).name}/${f.filename}` : `${uid}/${f.filename}`;
  const mv = await sb.storage.from('user-files').move(f.filepath, newPath);
  if (mv.error){ return toast('Move error','error',mv.error.message); }
  const upd = await sb.from('files').update({ folder_id: targetId || null, filepath:newPath }).eq('id', f.id);
  if (upd.error){ return toast('DB update error','error',upd.error.message); }
  closeMoveModal(); toast('Moved','success'); listFiles();
}
async function renameFile(f){
  if(f.deleted_at) return toast('Restore first, then rename','info');
  const base=f.filename.replace(/\.[^/.]+$/,''); let newBase=prompt('New name (no extension):',base);
  if(newBase===null) return; newBase=newBase.trim(); if(!newBase) return toast('Name cannot be empty','error');
  const extPart=f.filename.slice(f.filename.lastIndexOf('.'))||''; const newName=`${newBase}${extPart}`;
  const segments=f.filepath.split('/'); const uid=segments[0]; const maybeFolder=segments.length>2?segments[1]+'/':'';
  const newPath=`${uid}/${maybeFolder}${newName}`;
  const mv=await sb.storage.from('user-files').move(f.filepath,newPath);
  if(mv.error){ if(mv.error.message?.includes('already exists')) return toast('That name already exists','error'); return toast('Rename error','error',mv.error.message); }
  const upd=await sb.from('files').update({ filename:newName, filepath:newPath }).eq('id',f.id);
  if(upd.error){ await sb.storage.from('user-files').move(newPath,f.filepath); return toast('Rename DB error','error',upd.error.message); }
  toast('Renamed','success'); listFiles();
}
async function moveToTrash(f){
  if(!confirm('Move to Trash?')) return;
  const dl=await sb.storage.from('user-files').download(f.filepath); if(dl.error) return toast('Download error','error',dl.error.message);
  const up=await sb.storage.from('user-trash').upload(f.filepath,dl.data,{upsert:true}); if(up.error) return toast('Upload to trash error','error',up.error.message);
  await sb.storage.from('user-files').remove([f.filepath]);
  const upd=await sb.from('files').update({deleted_at:new Date().toISOString()}).eq('id',f.id); if(upd.error) return toast('DB update error','error',upd.error.message);
  toast('Moved to Trash','success'); listFiles();
}
async function restoreFile(f){
  const dl=await sb.storage.from('user-trash').download(f.filepath); if(dl.error) return toast('Trash download error','error',dl.error.message);
  const up=await sb.storage.from('user-files').upload(f.filepath,dl.data,{upsert:true}); if(up.error) return toast('Restore upload error','error',up.error.message);
  await sb.storage.from('user-trash').remove([f.filepath]);
  const upd=await sb.from('files').update({deleted_at:null}).eq('id',f.id); if(upd.error) return toast('DB update error','error',upd.error.message);
  toast('Restored','success'); listFiles();
}
async function deleteForever(f){
  if(!confirm('Delete forever?')) return;
  const rm=await sb.storage.from('user-trash').remove([f.filepath]); if(rm.error) return toast('Storage delete error','error',rm.error.message);
  const del=await sb.from('files').delete().eq('id',f.id); if(del.error) return toast('DB delete error','error',del.error.message);
  toast('Deleted forever','success'); listFiles();
}

/* ===== TOTP 2FA ===== */
function initTOTPUI(){
  $('btn-2fa-enable')?.addEventListener('click', startTOTPEnroll);
  $('btn-2fa-verify')?.addEventListener('click', verifyTOTPEnroll);
  $('btn-2fa-disable')?.addEventListener('click', disableTOTP);
}
async function refreshTOTPStatus(){
  try{
    const lf = await sb.auth.mfa.listFactors();
    const factors = lf.data?.totp?.factors || [];
    state.mfa.activeFactors = factors.filter(f => f.status === 'verified');
    const active = state.mfa.activeFactors.length>0;
    $('totp-status').textContent = active ? '2FA is ENABLED for this account.' : '2FA is OFF.';
    $('btn-2fa-enable').style.display = active ? 'none' : 'inline-block';
    $('btn-2fa-disable').style.display = active ? 'inline-block' : 'none';
    $('totp-enroll').style.display = 'none';
  }catch(e){
    $('totp-status').textContent = 'Unable to check 2FA status.';
  }
}
async function startTOTPEnroll(){
  try{
    const en = await sb.auth.mfa.enroll({ factorType:'totp' });
    if (en.error) return toast('Enroll error','error',en.error.message);
    state.mfa.enrolling = en.data;
    $('totp-enroll').style.display = 'block';
    const qr = en.data.totp?.qr_code;
    if (qr) $('totp-qr').src = qr;
    $('totp-secret').value = en.data.totp?.secret || '';
    $('totp-status').textContent = 'Scan the QR or enter the secret, then enter the 6-digit code.';
  }catch(e){
    toast('Enroll crashed','error', e.message||'Unknown');
  }
}
async function verifyTOTPEnroll(){
  const code = $('totp-code').value.trim();
  if (!code) return toast('Enter the 6-digit code','error');
  const factorId = state.mfa.enrolling?.id;
  if (!factorId) return toast('Missing enrollment','error');
  const vr = await sb.auth.mfa.verify({ factorId, code });
  if (vr.error) return toast('Verify error','error',vr.error.message);
  toast('2FA enabled','success');
  $('totp-code').value = '';
  state.mfa.enrolling = null;
  await refreshTOTPStatus();
}
async function disableTOTP(){
  if (!confirm('Turn OFF 2FA for this account?')) return;
  try{
    const lf = await sb.auth.mfa.listFactors();
    const factors = lf.data?.totp?.factors || [];
    for (const f of factors) {
      if (f.status === 'verified') {
        const un = await sb.auth.mfa.unenroll({ factorId: f.id });
        if (un.error) return toast('Disable error','error',un.error.message);
      }
    }
    toast('2FA disabled','success');
    await refreshTOTPStatus();
  }catch(e){
    toast('Disable crashed','error', e.message||'Unknown');
  }
}

/* ===== Wire UI ===== */
function wire(){
  // Theme buttons
  $('btn-theme')?.addEventListener('click', toggleTheme);
  $('btn-theme-auth')?.addEventListener('click', toggleTheme);

  // Email/Password + OAuth
  $('btn-signin')?.addEventListener('click',signIn);
  $('btn-signup')?.addEventListener('click',signUp);
  $('btn-signout')?.addEventListener('click',signOut);
  $('btn-apple')?.addEventListener('click',()=>oauth('apple'));
  $('btn-google')?.addEventListener('click',()=>oauth('google'));

  // Topbar
  $('btn-files')?.addEventListener('click',()=>{state.tab='files';updateSectionTitle();listFiles();});
  $('btn-trash')?.addEventListener('click',()=>{state.tab='trash';updateSectionTitle();listFiles();});
  $('btn-cards')?.addEventListener('click',()=>{state.layout='grid';listFiles();});
  $('btn-rows') ?.addEventListener('click',()=>{state.layout='rows';listFiles();});
  $('btn-profile')?.addEventListener('click',showProfile);

  // Folders
  $('btn-folder-new')?.addEventListener('click',newFolder);
  $('btn-folder-rename')?.addEventListener('click',renameFolder);
  $('btn-folder-delete')?.addEventListener('click',deleteFolder);

  // Profile + TOTP
  $('btn-save-profile')?.addEventListener('click',saveProfile);
  $('btn-back')?.addEventListener('click',showApp);
  initTOTPUI();

  // Upload dropzone
  const drop=$('drop-area');
  drop?.addEventListener('click',()=>$('fileElem').click());
  drop?.addEventListener('dragover',e=>{e.preventDefault();e.stopPropagation();});
  drop?.addEventListener('drop',e=>{e.preventDefault();handleFiles(e.dataTransfer.files);});
}
wire();

/* ===== Profile helpers ===== */
async function ensureProfile(){ const {data:{user}}=await sb.auth.getUser(); if(!user) return;
  const {data,error}=await sb.from('profiles').select('id').eq('id',user.id).maybeSingle();
  if(!data && !error){ await sb.from('profiles').insert([{id:user.id}]); }
}
async function loadProfile(){ const {data:{user}}=await sb.auth.getUser(); if(!user) return;
  const {data,error}=await sb.from('profiles').select('*').eq('id',user.id).maybeSingle();
  if(error && error.code!=='PGRST116') return toast('Load profile error','error',error.message);
  $('profile-email').textContent=user.email||''; $('profile-name').value=data?.full_name||''; $('profile-birthday').value=data?.birthday||'';
}
async function saveProfile(){ const {data:{user}}=await sb.auth.getUser(); if(!user) return;
  const updates={id:user.id, full_name:$('profile-name').value.trim()||null, birthday:$('profile-birthday').value||null};
  const {error}=await sb.from('profiles').upsert(updates,{onConflict:'id'}); if(error) return toast('Save profile error','error',error.message);
  toast('Profile saved','success'); showApp();
}
/*************************************************
 * STREAMBOX – PWA install + SW register + theme-color sync
 *************************************************/
(function PWASetup(){
  // Register SW
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  }

  // Create install buttons if they don't exist
  function ensureInstallButtons(){
    // Dashboard topbar
    let topbarInstall = document.getElementById('btn-install');
    if (!topbarInstall) {
      const actions = document.querySelector('.topbar .actions');
      if (actions) {
        topbarInstall = document.createElement('button');
        topbarInstall.id = 'btn-install';
        topbarInstall.type = 'button';
        topbarInstall.textContent = 'Install';
        actions.insertBefore(topbarInstall, actions.firstChild); // put near left of actions
      }
    }
    // Auth header
    let authInstall = document.getElementById('btn-install-auth');
    if (!authInstall) {
      const brand = document.querySelector('#auth-box .brand');
      if (brand) {
        authInstall = document.createElement('button');
        authInstall.id = 'btn-install-auth';
        authInstall.type = 'button';
        authInstall.textContent = 'Install';
        brand.appendChild(authInstall);
      }
    }
  }
  ensureInstallButtons();

  // Handle beforeinstallprompt
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Show buttons
    const b1 = document.getElementById('btn-install');
    const b2 = document.getElementById('btn-install-auth');
    [b1,b2].forEach((btn)=>{
      if (!btn) return;
      btn.style.display = 'inline-block';
      btn.onclick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (typeof toast === 'function') {
          toast(outcome === 'accepted' ? 'Installing…' : 'Install dismissed', 'info');
        }
      };
    });
  });

  // Hide install buttons if app is already installed
  function hideInstallIfStandalone(){
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) {
      const b1 = document.getElementById('btn-install');
      const b2 = document.getElementById('btn-install-auth');
      if (b1) b1.style.display = 'none';
      if (b2) b2.style.display = 'none';
    }
  }
  hideInstallIfStandalone();
  window.matchMedia('(display-mode: standalone)').addEventListener?.('change', hideInstallIfStandalone);

  // Keep <meta name="theme-color"> in sync with current theme
  function setThemeColor(){
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const explicit = document.body.getAttribute('data-theme'); // 'light' | 'dark' | null
    const dark = explicit ? (explicit === 'dark') : systemDark;
    meta.setAttribute('content', dark ? '#0c0d11' : '#f6f7fb');
  }
  setThemeColor();

  // If your toggleTheme is defined above, wrap it to also update the theme-color meta
  if (typeof window.toggleTheme === 'function') {
    const _origToggle = window.toggleTheme;
    window.toggleTheme = function(){
      _origToggle();
      setThemeColor();
    };
  }
})();
