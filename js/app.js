/*************************************************
 * StreamBox — single-file app (with redesigned dashboard)
 * Auth (Email/OAuth/MFA) + Dashboard + Files + Trash + Profile
 * Clean wiring, immediate navigation on sign-in.
 *************************************************/

/* ====== CONFIG ====== */
const SUPABASE_URL = "https://kulgncyhgksjdvprgfdy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1bGduY3loZ2tzamR2cHJnZmR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5OTA1ODQsImV4cCI6MjA3MDU2NjU4NH0.XA6R7qZDO1jypaCEeIfGJKo8DmUdpxcYBnB0Ih3K8ms";

if (!window.supabase) alert("Supabase SDK failed to load. Check the <script> tag in <head>.");
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (id)=>document.getElementById(id);
const state = { tab:'files', layout:'grid', currentFolder:null, folders:[] };

function toast(msg,type='info',detail=''){
  const box=$('toasts'); if(!box) return alert(msg+(detail?`\n${detail}`:''));
  const t=document.createElement('div'); t.className='toast '+type;
  t.innerHTML = esc(msg) + (detail?`<small>${esc(detail)}</small>`:'');
  box.appendChild(t); setTimeout(()=>t.remove(),5000);
}
const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

/* Theme */
function applySavedTheme(){
  const saved=localStorage.getItem('streambox-theme');
  if(saved==='light') document.body.setAttribute('data-theme','light');
  else if(saved==='dark') document.body.setAttribute('data-theme','dark');
  else document.body.removeAttribute('data-theme');
  setThemeMeta();
}
function toggleTheme(){
  const cur=document.body.getAttribute('data-theme');
  const next = cur ? (cur==='dark'?'light':'dark')
                   : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark');
  document.body.setAttribute('data-theme',next);
  localStorage.setItem('streambox-theme',next);
  setThemeMeta();
  toast(`Theme: ${next}`,'info');
}
function setThemeMeta(){
  const meta=document.querySelector('meta[name="theme-color"]');
  const cur=document.body.getAttribute('data-theme');
  if(meta) meta.setAttribute('content', cur==='dark' ? '#0c0d11' : '#f6f7fb');
}

/* Surface JS errors */
window.addEventListener('error', e=>toast('JS error','error', e.message||'Unknown'));
window.addEventListener('unhandledrejection', e=>toast('Promise error','error', String(e?.reason?.message||e?.reason||'Rejected')));

/* ====== VIEWS ====== */
function showAuth(){ vis('auth-wrap',true); vis('home-box',false); vis('app-box',false); vis('profile-box',false); }
function showDashboard(){ 
  vis('auth-wrap',false); vis('home-box',true); vis('app-box',false); vis('profile-box',false); 
  const e=$('user-email'); $('user-email-home').textContent = e? e.textContent : ''; $('user-email-right').textContent = e? e.textContent : '';
  loadRecent(); updateStats();
}
function showFiles(){ vis('auth-wrap',false); vis('home-box',false); vis('app-box',true); vis('profile-box',false); listFiles(); }
function showProfile(){ vis('auth-wrap',false); vis('home-box',false); vis('app-box',false); vis('profile-box',true); loadProfile(); refreshTOTPStatus(); }
function vis(id, on){ const el=$(id); if(el) el.style.display = on?'block':'none'; }

/* ====== AUTH ====== */
async function signUp(){
  const email=$('email')?.value?.trim(); const pw=$('password')?.value||'';
  if(!email||!pw) return toast('Enter email and password','error');
  const { error } = await sb.auth.signUp({ email, password: pw });
  if (error) return toast('Sign up failed','error', error.message);
  toast('Sign up success','success','Confirm by email, then sign in');
}

async function signIn(){
  const email=$('email')?.value?.trim(); const pw=$('password')?.value||'';
  if(!email||!pw) return toast('Enter email and password','error');

  const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });

  if (error) {
    // MFA branch
    if (/MFA|multi[- ]?factor|factor/i.test(error.message||'')) {
      try{
        const lf=await sb.auth.mfa.listFactors();
        const totp=(lf.data?.totp?.factors||[]).find(f=>f.status==='verified') || (lf.data?.totp?.factors||[])[0];
        if(!totp) return toast('MFA required but no TOTP factor found','error');
        const ch=await sb.auth.mfa.challenge({factorId:totp.id}); if(ch.error) return toast('MFA challenge error','error',ch.error.message);
        const code=prompt('Enter 6-digit code:'); if(!code?.trim()) return toast('MFA canceled','info');
        const ver=await sb.auth.mfa.verify({factorId:totp.id, code:code.trim(), challengeId:ch.data.id});
        if(ver.error) return toast('MFA verify error','error',ver.error.message);
      }catch(e){ return toast('MFA flow crashed','error', e.message||'Unknown'); }
    } else {
      return toast('Login failed','error', error.message);
    }
  }

  // Immediate navigation to dashboard
  const me = (await sb.auth.getUser())?.data?.user;
  if (me) {
    $('user-email').textContent = me.email || '';
    if (!INIT) { INIT = true; appInit(); }
    toast('Login success','success');
    showDashboard();
  } else {
    toast('Signed in but no user session found','error');
  }
}

async function signOut(){ await sb.auth.signOut(); toast('Signed out','info'); showAuth(); }

async function oauth(provider){
  const redirectTo = window.location.origin + (window.location.pathname || '');
  const { error } = await sb.auth.signInWithOAuth({ provider, options:{ redirectTo } });
  if (error) toast('OAuth error','error', error.message); else toast('Redirecting…','info');
}

/* Auth state → route (still present for refreshes) */
let INIT=false;
sb.auth.onAuthStateChange((_e,session)=>{
  const logged=!!session?.user;
  $('user-email').textContent = logged ? (session.user.email||'') : '';
  if(logged){ if(!INIT){ INIT=true; appInit(); } showDashboard(); }
  else{ showAuth(); }
});
sb.auth.getUser().then(({data})=>{
  if(data?.user){ $('user-email').textContent=data.user.email||''; if(!INIT){ INIT=true; appInit(); } showDashboard(); }
  else{ showAuth(); }
});

/* ====== APP INIT (wire everything once) ====== */
function appInit(){
  applySavedTheme();

  // Theme
  $('btn-theme')?.addEventListener('click',toggleTheme);
  $('btn-theme-auth')?.addEventListener('click',toggleTheme);
  $('btn-theme-side')?.addEventListener('click',toggleTheme);

  // Auth buttons
  $('btn-signin')?.addEventListener('click',signIn);
  $('btn-signup')?.addEventListener('click',signUp);
  $('btn-signout')?.addEventListener('click',signOut);
  $('btn-apple')?.addEventListener('click',()=>oauth('apple'));
  $('btn-google')?.addEventListener('click',()=>oauth('google'));

  // Main nav (dashboard layout)
  $('nav-dashboard')?.addEventListener('click',showDashboard);
  $('nav-files')?.addEventListener('click',showFiles);
  $('nav-share')?.addEventListener('click',()=>toast('Share page coming soon','info'));
  $('nav-chat') ?.addEventListener('click',()=>toast('Chat coming soon','info'));
  $('nav-public')?.addEventListener('click',()=>toast('Public feed coming soon','info'));
  $('btn-profile')?.addEventListener('click',showProfile);

  // Files (topbar on Files page)
  $('btn-files')?.addEventListener('click',()=>{ state.tab='files'; listFiles(); });
  $('btn-trash')?.addEventListener('click',()=>{ state.tab='trash'; listFiles(); });
  $('btn-cards')?.addEventListener('click',()=>{ state.layout='grid'; listFiles(); });
  $('btn-rows') ?.addEventListener('click',()=>{ state.layout='rows'; listFiles(); });
  $('btn-profile')?.addEventListener('click',showProfile);

  // Folders (Files page)
  $('btn-folder-new')?.addEventListener('click',newFolder);
  $('btn-folder-rename')?.addEventListener('click',renameFolder);
  $('btn-folder-delete')?.addEventListener('click',deleteFolder);

  // Profile
  $('btn-save-profile')?.addEventListener('click',saveProfile);
  $('btn-back')?.addEventListener('click',showDashboard);

  // Upload (Files page)
  const drop=$('drop-area');
  drop?.addEventListener('click',()=>$('fileElem').click());
  drop?.addEventListener('dragover',e=>{e.preventDefault();e.stopPropagation();});
  drop?.addEventListener('drop',e=>{e.preventDefault();handleFiles(e.dataTransfer.files);});
  window.handleFiles = handleFiles; // for input onchange

  // Quick upload (Dashboard)
  (function wireQuick(){
    const qDrop=$('quick-drop'); const qInput=$('quick-file'); const qBtn=$('quick-upload-btn');
    let pending=[];
    qDrop?.addEventListener('click',()=>qInput?.click());
    qDrop?.addEventListener('dragover',e=>{e.preventDefault();e.stopPropagation();});
    qDrop?.addEventListener('drop',e=>{e.preventDefault(); pending=Array.from(e.dataTransfer.files||[]); toast(`${pending.length} file(s) ready`,'info');});
    qInput?.addEventListener('change',e=>{ pending=Array.from(e.target.files||[]); toast(`${pending.length} file(s) ready`,'info'); });
    qBtn?.addEventListener('click',async()=>{ if(!pending.length) return toast('Choose files first','info'); await handleFiles(pending); pending=[]; qInput.value=''; loadRecent(); toast('Uploaded','success'); });
  })();

  // Vault demo
  $('vault-unlock')?.addEventListener('click', async ()=>{
    try{
      if(!window.PublicKeyCredential) throw new Error('WebAuthn not supported');
      $('vault-state').textContent='Unlocked (demo)'; toast('Vault unlocked (demo)','success');
    }catch(e){ toast('Biometric failed','error', e.message||''); }
  });

  // Add diagnostics button on auth
  addDiagnostics();

  console.log('StreamBox ready');
  toast('App ready','info');
}

/* ====== FOLDERS ====== */
async function loadFolders(){
  const virtualAll={id:null,name:'All Files'};
  const {data,error}=await sb.from('folders').select('*').order('created_at',{ascending:true});
  state.folders = error ? [virtualAll] : [virtualAll, ...(data||[])];
  if(!state.currentFolder || !state.folders.some(f=>f.id===state.currentFolder.id)) state.currentFolder=virtualAll;
  renderFolders();
}
function renderFolders(){
  const ul=$('folder-list'); if(!ul) return; ul.innerHTML='';
  state.folders.forEach(f=>{
    const li=document.createElement('li'); li.textContent=f.name;
    if(state.currentFolder?.id===f.id) li.classList.add('active');
    li.onclick=()=>{state.currentFolder=f; listFiles(); renderFolders();};
    ul.appendChild(li);
  });
  updateSectionTitle();
}
function updateSectionTitle(){
  const base=state.tab==='files'?'Your Files':'Trash';
  const suffix=state.currentFolder?.id?` — ${state.currentFolder.name}`:'';
  const el=$('section-title'); if(el) el.textContent=base+suffix;
}
async function newFolder(){
  const name=prompt('Folder name:'); if(name===null) return;
  const clean=name.trim(); if(!clean) return toast('Folder name cannot be empty','error');
  const {data:sess}=await sb.auth.getSession(); if(!sess?.session) return toast('Not logged in','error');
  const uid=sess.session.user.id;
  const {data,error}=await sb.from('folders').insert([{user_id:uid,name:clean}]).select().single();
  if(error) return toast('Create folder error','error',error.message);
  toast('Folder created','success'); state.currentFolder=data;
  await loadFolders(); await listFiles();
}
async function renameFolder(){
  if(!state.currentFolder?.id) return toast('Select a folder (not "All Files")','info');
  let name=prompt('New folder name:',state.currentFolder.name); if(name===null) return;
  name=name.trim(); if(!name) return toast('Folder name cannot be empty','error');
  const {error}=await sb.from('folders').update({name}).eq('id',state.currentFolder.id);
  if(error) return toast('Rename folder error','error',error.message);
  toast('Folder renamed','success'); state.currentFolder.name=name;
  renderFolders(); listFiles();
}
async function deleteFolder(){
  if(!state.currentFolder?.id) return toast('Select a folder (not "All Files")','info');
  if(!confirm('Delete this folder? Move or delete files first.')) return;
  const {data:filesIn,error:qErr}=await sb.from('files').select('id').eq('folder_id',state.currentFolder.id).limit(1);
  if(qErr) return toast('Check folder error','error',qErr.message);
  if(filesIn?.length) return toast('Folder not empty','error','Move or delete files first');
  const {error}=await sb.from('folders').delete().eq('id',state.currentFolder.id);
  if(error) return toast('Delete folder error','error',error.message);
  toast('Folder deleted','success'); state.currentFolder={id:null,name:'All Files'};
  await loadFolders(); await listFiles();
}

/* ====== FILES ====== */
const ext = n => (n?.split('.').pop()||'').toLowerCase();
const isImg = e => ['png','jpg','jpeg','webp','gif','avif'].includes(e);
const isVid = e => ['mp4','webm','mov','m4v'].includes(e);
const isAud = e => ['mp3','wav','m4a','aac','ogg','flac'].includes(e);
const isPdf = e => e==='pdf';

async function handleFiles(files){
  const { data:{user} } = await sb.auth.getUser(); if(!user) return toast('Not logged in','error');
  for(const file of files){
    const folderSeg = state.currentFolder?.id ? `${state.currentFolder.name}/` : '';
    const path = `${user.id}/${folderSeg}${file.name}`;
    const up = await sb.storage.from('user-files').upload(path, file, { upsert:true });
    if(up.error){ toast('Upload error','error', up.error.message); continue; }
    const ins = await sb.from('files').insert([{ user_id:user.id, folder_id:state.currentFolder?.id||null, filename:file.name, filepath:path }]);
    if(ins.error){ await sb.storage.from('user-files').remove([path]); toast('DB insert error','error', ins.error.message); }
  }
  listFiles(); loadRecent(); updateStats();
}
async function listFiles(){
  const list=$('file-list'); if(!list) return;
  list.className = state.layout==='grid' ? 'grid' : 'row-list';
  list.innerHTML='';
  let q=sb.from('files').select('*').order('created_at',{ascending:false});
  q = state.tab==='files' ? q.is('deleted_at',null) : q.not('deleted_at','is',null);
  if(state.currentFolder?.id) q=q.eq('folder_id',state.currentFolder.id);
  const {data,error}=await q; if(error) return toast('List error','error',error.message);
  if(!data?.length){ updateSectionTitle(); return; }

  for(const f of data){
    const bucket = f.deleted_at ? 'user-trash' : 'user-files';
    const sig=await sb.storage.from(bucket).createSignedUrl(f.filepath,180);
    const url=sig.data?.signedUrl||null; const e=ext(f.filename);

    if(state.layout==='grid'){
      const li=document.createElement('li'); li.className='file-card';
      const keb=document.createElement('div'); keb.className='kebab'; keb.onclick=(ev)=>{ev.stopPropagation(); openMenu(ev,f,url);};
      const thumb=document.createElement('div'); thumb.className='thumb';
      if(url && isImg(e)) thumb.innerHTML=`<img src="${url}" alt="${f.filename}" loading="lazy">`;
      else if(url && isVid(e)) thumb.innerHTML=`<video src="${url}" controls></video>`;
      else if(url && isAud(e)) thumb.innerHTML=`<audio src="${url}" controls></audio>`;
      else if(isPdf(e))      thumb.innerHTML=`<div>PDF</div>`;
      else                   thumb.innerHTML=`<div>${(e||'FILE').toUpperCase()}</div>`;
      const name=document.createElement('div'); name.className='file-name'; name.textContent=f.filename; name.title=f.filename;
      li.appendChild(thumb); li.appendChild(name); li.appendChild(keb); list.appendChild(li);
    } else {
      const row=document.createElement('li'); row.className='row-item';
      const th=document.createElement('div'); th.className='row-thumb';
      if(url && isImg(e)) th.innerHTML=`<img src="${url}" alt="${f.filename}" loading="lazy">`;
      const nm=document.createElement('div'); nm.className='row-name'; nm.textContent=f.filename; nm.title=f.filename;
      const keb=document.createElement('div'); keb.className='kebab-row'; keb.onclick=(ev)=>{ev.stopPropagation(); openMenu(ev,f,url);};
      row.appendChild(th); row.appendChild(nm); row.appendChild(keb); list.appendChild(row);
    }
  }
  updateStats();
}

/* file item menu */
function openMenu(ev,f,url){
  document.querySelectorAll('.menu').forEach(m=>m.remove());
  const m=document.createElement('div'); m.className='menu'; m.addEventListener('click',e=>e.stopPropagation());
  const add=(label,fn)=>{ const b=document.createElement('button'); b.textContent=label; b.onclick=()=>{ m.remove(); fn(); }; m.appendChild(b); };
  if(!f.deleted_at){
    add('Open', ()=>{ if(url) window.open(url,'_blank'); else toast('No preview','info'); });
    add('Download', ()=>{ if(!url) return; const a=document.createElement('a'); a.href=url; a.download=f.filename; a.click(); });
    add('Move to Trash', ()=> moveToTrash(f));
  }else{
    add('Restore', ()=> restoreFile(f));
    add('Delete Forever', ()=> deleteForever(f));
  }
  document.body.appendChild(m); m.style.position='absolute'; m.style.left=ev.pageX+'px'; m.style.top=ev.pageY+'px'; m.style.zIndex=9999;
  document.addEventListener('click',()=>m.remove(),{once:true});
}
async function moveToTrash(f){
  if(!confirm('Move to Trash?')) return;
  const dl=await sb.storage.from('user-files').download(f.filepath); if(dl.error) return toast('Download error','error',dl.error.message);
  const up=await sb.storage.from('user-trash').upload(f.filepath,dl.data,{upsert:true}); if(up.error) return toast('Upload to trash error','error',up.error.message);
  await sb.storage.from('user-files').remove([f.filepath]);
  const upd=await sb.from('files').update({deleted_at:new Date().toISOString()}).eq('id',f.id); if(upd.error) return toast('DB update error','error',upd.error.message);
  toast('Moved to Trash','success'); listFiles(); loadRecent(); updateStats();
}
async function restoreFile(f){
  const dl=await sb.storage.from('user-trash').download(f.filepath); if(dl.error) return toast('Trash download error','error',dl.error.message);
  const up=await sb.storage.from('user-files').upload(f.filepath,dl.data,{upsert:true}); if(up.error) return toast('Restore upload error','error',up.error.message);
  await sb.storage.from('user-trash').remove([f.filepath]);
  const upd=await sb.from('files').update({deleted_at:null}).eq('id',f.id); if(upd.error) return toast('DB update error','error',upd.error.message);
  toast('Restored','success'); listFiles(); loadRecent(); updateStats();
}
async function deleteForever(f){
  if(!confirm('Delete forever?')) return;
  const rm=await sb.storage.from('user-trash').remove([f.filepath]); if(rm.error) return toast('Storage delete error','error',rm.error.message);
  const del=await sb.from('files').delete().eq('id',f.id); if(del.error) return toast('DB delete error','error',del.error.message);
  toast('Deleted forever','success'); listFiles(); loadRecent(); updateStats();
}

/* ====== DASHBOARD helpers ====== */
async function fetchRecent(limit=6){
  const { data, error } = await sb.from('files').select('id, filename, created_at, deleted_at').order('created_at',{ascending:false}).limit(limit);
  return { data: data||[], error };
}
async function loadRecent(){
  const ul=$('recent-list'); if(!ul) return; ul.innerHTML='';
  const { data, error } = await fetchRecent(6);
  if(error){ ul.innerHTML='<li class="muted">Could not load recent.</li>'; return; }
  if(!data.length){ ul.innerHTML='<li class="muted">Nothing yet.</li>'; return; }
  data.forEach(item=>{
    const li=document.createElement('li');
    const d=new Date(item.created_at);
    li.textContent=`${item.filename} — ${d.toLocaleString()}${item.deleted_at?' (trashed)':''}`;
    ul.appendChild(li);
  });
}
async function updateStats(){
  const filesNum=$('stat-files'); const storageEl=$('stat-storage');
  const { count } = await sb.from('files').select('*', { count:'exact', head:true }).is('deleted_at', null);
  if(filesNum) filesNum.textContent = (typeof count==='number') ? count : '—';
  // Storage size estimation could be added via Edge Function; for now, placeholder:
  if(storageEl) storageEl.textContent = '—';
}

/* ====== PROFILE ====== */
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
  toast('Profile saved','success'); showDashboard();
}
async function refreshTOTPStatus(){ /* keep UI happy for now (enable later) */ }

/* ====== AUTH DIAGNOSTICS BUTTON ====== */
function addDiagnostics(){
  const authBox=$('auth-box'); if(!authBox) return;
  if (document.getElementById('btn-diag')) return;
  const b=document.createElement('button'); b.id='btn-diag'; b.textContent='Check Supabase'; b.style.marginTop='10px';
  b.onclick = async ()=>{
    try{
      const { error } = await sb.auth.signInWithPassword({ email:`debug_${Date.now()}@example.com`, password:'x' });
      if(!error || /invalid|email|user/i.test(error.message)) return toast('Supabase OK','success','URL/key valid');
      if(/invalid api key|jwt/i.test(error.message)) return toast('Invalid anon key','error','Paste the latest ANON KEY in app.js');
      if(/disabled|provider/i.test(error.message)) return toast('Email provider disabled','error','Enable Email in Supabase → Auth → Providers');
      return toast('Auth error','error', error.message);
    }catch(e){ toast('Diag failed','error', e.message||''); }
  };
  authBox.appendChild(b);
}

/* ====== DOM READY (for very first load) ====== */
document.addEventListener('DOMContentLoaded', ()=>{
  applySavedTheme();
});
