/* StreamBox Nova — with Global Search (Enter to search) */

const SUPABASE_URL = "https://kulgncyhgksjdvprgfdy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1bGduY3loZ2tzamR2cHJnZmR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5OTA1ODQsImV4cCI6MjA3MDU2NjU4NH0.XA6R7qZDO1jypaCEeIfGJKo8DmUdpxcYBnB0Ih3K8ms";

if (!window.supabase) alert("Supabase not loaded");
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (id)=>document.getElementById(id);
const toastBox = $('toasts');
function toast(msg,type='info',detail=''){
  const t=document.createElement('div'); t.className='toast '+type;
  t.innerHTML = esc(msg) + (detail?`<small>${esc(detail)}</small>`:'');
  toastBox.appendChild(t); setTimeout(()=>t.remove(),4500);
}
const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function show(id){ ['auth','home','files','profile'].forEach(s=>($(s).classList.remove('show'))); $(id).classList.add('show'); }
function setEmail(u){ $('user-email').textContent = u?.email || ''; $('p-email').textContent = u?.email || ''; }
function applyTheme(){ const saved=localStorage.getItem('nova-theme'); if(saved) document.body.setAttribute('data-theme',saved); }
function toggleTheme(){ const cur=document.body.getAttribute('data-theme'); const next = cur==='dark'?'light':'dark'; document.body.setAttribute('data-theme',next); localStorage.setItem('nova-theme',next); }

window.addEventListener('error', e=>toast('JS error','error', e.message||''));
window.addEventListener('unhandledrejection', e=>toast('Promise error','error', String(e?.reason?.message||e?.reason||'')));

/* ---------- Auth ---------- */
async function signUp(){
  const email=$('email').value.trim(), pw=$('password').value;
  if(!email||!pw) return toast('Enter email + password','error');
  const { error } = await sb.auth.signUp({ email, password: pw });
  if(error) return toast('Sign up failed','error', error.message);
  toast('Check your email to confirm','success');
}
async function signIn(){
  const email=$('email').value.trim(), pw=$('password').value;
  if(!email||!pw) return toast('Enter email + password','error');
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
  if (error) return toast('Login failed','error', error.message);
  setEmail(data.user); initOnce(); show('home'); await refresh(); toast('Welcome','success');
}
async function signOut(){ await sb.auth.signOut(); toast('Signed out','info'); show('auth'); }
async function oauth(provider){
  const redirectTo = window.location.origin + (window.location.pathname || '');
  const { error } = await sb.auth.signInWithOAuth({ provider, options:{ redirectTo } });
  if (error) toast('OAuth error','error', error.message); else toast('Redirecting…','info');
}

/* Session watcher */
let INIT=false;
sb.auth.onAuthStateChange((_e,session)=>{ if(session?.user){ setEmail(session.user); if(!INIT){initOnce();} show('home'); refresh(); } else { show('auth'); } });
sb.auth.getUser().then(({data})=>{ if(data?.user){ setEmail(data.user); if(!INIT){initOnce();} show('home'); refresh(); } else show('auth'); });

/* ---------- Files / Folders ---------- */
const ext = n => (n?.split('.').pop()||'').toLowerCase();
const isImg=e=>['png','jpg','jpeg','webp','gif','avif'].includes(e);
let state = { layout:'grid', tab:'files', folder:null, folders:[], search:null };

async function loadFolders(){
  const { data, error } = await sb.from('folders').select('*').order('created_at',{ascending:true});
  state.folders = [{id:null,name:'All Files'}, ...(data||[])];
  renderFolders();
}
function renderFolders(){
  const ul = $('folders'); if(!ul) return;
  ul.innerHTML = '';
  state.folders.forEach(f=>{
    const li=document.createElement('li'); li.textContent=f.name;
    if(state.folder?.id===f.id) li.classList.add('active');
    li.onclick=()=>{ state.folder=f; listFiles(); renderFolders(); };
    ul.appendChild(li);
  });
  const base = state.tab==='files' ? 'Your Files' : 'Trash';
  $('files-title').textContent = base + (state.folder?.id?` — ${state.folder.name}`:'') + (state.search?` — “${state.search}”`:'' );
}
async function newFolder(){
  const name=prompt('Folder name:'); if(name===null) return; if(!name.trim()) return;
  const { data:{user} } = await sb.auth.getUser(); if(!user) return;
  const { data, error } = await sb.from('folders').insert([{ user_id:user.id, name:name.trim() }]).select().single();
  if(error) return toast('New folder error','error',error.message);
  state.folder=data; await loadFolders(); await listFiles();
}
async function renameFolder(){
  if(!state.folder?.id) return toast('Select a folder','info');
  const name=prompt('New folder name:', state.folder.name); if(name===null||!name.trim()) return;
  const { error } = await sb.from('folders').update({ name:name.trim() }).eq('id',state.folder.id);
  if(error) return toast('Rename error','error',error.message);
  state.folder.name = name.trim(); renderFolders(); listFiles();
}
async function deleteFolder(){
  if(!state.folder?.id) return toast('Select a folder','info');
  const { data:has, error:e1 } = await sb.from('files').select('id').eq('folder_id',state.folder.id).limit(1);
  if(e1) return toast('Check error','error',e1.message);
  if(has?.length) return toast('Folder not empty','error','Move or delete files first');
  const { error } = await sb.from('folders').delete().eq('id',state.folder.id);
  if(error) return toast('Delete folder error','error',error.message);
  state.folder=null; await loadFolders(); await listFiles();
}

async function handleFiles(fileList){
  const { data:{user} } = await sb.auth.getUser(); if(!user) return;
  const files = Array.from(fileList||[]);
  for (const f of files){
    const seg = state.folder?.id ? `${state.folder.name}/` : '';
    const path = `${user.id}/${seg}${f.name}`;
    const up = await sb.storage.from('user-files').upload(path, f, { upsert:true });
    if (up.error){ toast('Upload error','error',up.error.message); continue; }
    const ins = await sb.from('files').insert([{ user_id:user.id, folder_id:state.folder?.id||null, filename:f.name, filepath:path }]);
    if (ins.error){ await sb.storage.from('user-files').remove([path]); toast('DB insert error','error',ins.error.message); }
  }
  await refresh();
}

/* ===== Global search ===== */
async function listFiles(){
  const list = $('list'); if(!list) return;
  list.className = state.layout==='grid' ? 'grid' : 'row';
  list.innerHTML='';

  let q = sb.from('files').select('*').order('created_at',{ascending:false});
  // tab
  q = state.tab==='files' ? q.is('deleted_at',null) : q.not('deleted_at','is',null);
  // folder
  if(state.folder?.id) q = q.eq('folder_id',state.folder.id);
  // search
  if (state.search && state.search.trim().length >= 2){
    q = q.ilike('filename', `%${state.search.trim()}%`);
  }

  const { data, error } = await q;
  if(error) return toast('List error','error',error.message);
  if(!data?.length){
    const empty=document.createElement('div');
    empty.className='muted'; empty.style.margin='8px 10px';
    empty.textContent = state.search ? 'No results.' : 'No files yet.';
    list.appendChild(empty);
    renderFolders();
    return;
  }

  for(const f of data){
    const bucket = f.deleted_at ? 'user-trash' : 'user-files';
    const sig = await sb.storage.from(bucket).createSignedUrl(f.filepath, 180);
    const url = sig.data?.signedUrl || null;
    const e = ext(f.filename);

    if(state.layout==='grid'){
      const li=document.createElement('li'); li.className='item';
      const ph=document.createElement('div'); ph.className='ph';
      if(url && isImg(e)) ph.innerHTML=`<img src="${url}" alt="${f.filename}" loading="lazy">`;
      else ph.innerHTML=`<div class="chip">${(e||'FILE').toUpperCase()}</div>`;
      const nm=document.createElement('div'); nm.className='nm'; nm.textContent=f.filename; nm.title=f.filename;
      const keb=document.createElement('div'); keb.className='kebab'; keb.onclick=(ev)=>openMenu(ev,f,url);
      li.appendChild(ph); li.appendChild(nm); li.appendChild(keb); list.appendChild(li);
    } else {
      const li=document.createElement('li'); li.className='row-item';
      const th=document.createElement('div'); th.className='row-thumb';
      if(url && isImg(e)) th.innerHTML=`<img src="${url}" alt="${f.filename}" loading="lazy">`;
      const nm=document.createElement('div'); nm.textContent=f.filename; nm.title=f.filename;
      const keb=document.createElement('div'); keb.className='kebab-row'; keb.onclick=(ev)=>openMenu(ev,f,url);
      li.appendChild(th); li.appendChild(nm); li.appendChild(keb); list.appendChild(li);
    }
  }
  renderFolders();
}

/* context menu */
function openMenu(ev,f,url){
  document.querySelectorAll('.menu').forEach(m=>m.remove());
  const m=document.createElement('div'); m.className='menu'; m.addEventListener('click',e=>e.stopPropagation());
  const add=(label,fn)=>{ const b=document.createElement('button'); b.textContent=label; b.onclick=()=>{ m.remove(); fn(); }; m.appendChild(b); };
  if(!f.deleted_at){
    add('Open', ()=>{ if(url) window.open(url,'_blank'); else toast('No preview','info'); });
    add('Download', ()=>{ if(!url) return; const a=document.createElement('a'); a.href=url; a.download=f.filename; a.click(); });
    add('Move to Trash', ()=> moveToTrash(f));
  } else {
    add('Restore', ()=> restoreFile(f));
    add('Delete Forever', ()=> deleteForever(f));
  }
  document.body.appendChild(m); m.style.left=ev.pageX+'px'; m.style.top=ev.pageY+'px'; m.style.position='absolute'; m.style.zIndex=9999;
  document.addEventListener('click',()=>m.remove(),{once:true});
}

async function moveToTrash(f){
  if(!confirm('Trash this file?')) return;
  const d=await sb.storage.from('user-files').download(f.filepath); if(d.error) return toast('Download error','error',d.error.message);
  const u=await sb.storage.from('user-trash').upload(f.filepath, d.data, { upsert:true }); if(u.error) return toast('Move error','error',u.error.message);
  await sb.storage.from('user-files').remove([f.filepath]);
  const x=await sb.from('files').update({deleted_at:new Date().toISOString()}).eq('id',f.id); if(x.error) return toast('DB error','error',x.error.message);
  refresh();
}
async function restoreFile(f){
  const d=await sb.storage.from('user-trash').download(f.filepath); if(d.error) return toast('Trash download error','error',d.error.message);
  const u=await sb.storage.from('user-files').upload(f.filepath, d.data, { upsert:true }); if(u.error) return toast('Restore error','error',u.error.message);
  await sb.storage.from('user-trash').remove([f.filepath]);
  const x=await sb.from('files').update({deleted_at:null}).eq('id',f.id); if(x.error) return toast('DB error','error',x.error.message);
  refresh();
}
async function deleteForever(f){
  if(!confirm('Delete forever?')) return;
  const r=await sb.storage.from('user-trash').remove([f.filepath]); if(r.error) return toast('Storage error','error',r.error.message);
  const d=await sb.from('files').delete().eq('id',f.id); if(d.error) return toast('DB error','error',d.error.message);
  refresh();
}

/* ---------- Dashboard helpers ---------- */
async function stats(){
  const a = await sb.from('files').select('*',{ count:'exact', head:true }).is('deleted_at', null);
  const b = await sb.from('files').select('*',{ count:'exact', head:true }).not('deleted_at','is',null);
  $('stat-files').textContent = typeof a.count==='number' ? a.count : '—';
  $('stat-trash').textContent = typeof b.count==='number' ? b.count : '—';
}
async function recent(){
  const ul=$('recent'); if(!ul) return; ul.innerHTML='';
  const { data, error } = await sb.from('files').select('id,filename,filepath,created_at,deleted_at').order('created_at',{ascending:false}).limit(8);
  if (error){ ul.innerHTML='<li class="muted">Could not load.</li>'; return; }
  if (!data.length){ ul.innerHTML='<li class="muted">Nothing yet.</li>'; return; }
  for (const f of data){
    const li=document.createElement('li');
    const left=document.createElement('div'); left.className='row';
    const th=document.createElement('div'); th.className='thumb';
    const e=ext(f.filename); let set=false;
    if(isImg(e)){
      const b=f.deleted_at?'user-trash':'user-files';
      const s=await sb.storage.from(b).createSignedUrl(f.filepath,120);
      const url=s.data?.signedUrl||null;
      if(url){ const img=document.createElement('img'); img.src=url; img.alt=f.filename; th.appendChild(img); set=true; }
    }
    if(!set){ const chip=document.createElement('div'); chip.className='chip'; chip.textContent=(e||'FILE').toUpperCase(); th.appendChild(chip); }
    const meta=document.createElement('div'); meta.className='meta';
    const name=document.createElement('div'); name.className='name'; name.textContent=f.filename; name.title=f.filename;
    const time=document.createElement('div'); time.className='time'; time.textContent=new Date(f.created_at).toLocaleString();
    meta.appendChild(name); meta.appendChild(time);
    left.appendChild(th); left.appendChild(meta);
    const right=document.createElement('div'); if(f.deleted_at){ const tag=document.createElement('div'); tag.className='chip'; tag.textContent='TRASHED'; right.appendChild(tag); }
    li.appendChild(left); li.appendChild(right); ul.appendChild(li);
  }
}
async function refresh(){ await Promise.all([stats(), recent(), listFiles(), loadFolders()]); }

/* ---------- Profile ---------- */
async function saveProfile(){
  const { data:{user} } = await sb.auth.getUser(); if(!user) return;
  const updates={ id:user.id, full_name:$('p-name').value.trim()||null, birthday:$('p-bday').value||null };
  const { error } = await sb.from('profiles').upsert(updates,{onConflict:'id'});
  if(error) return toast('Profile save error','error',error.message);
  toast('Profile saved','success'); show('home');
}

/* ---------- PWA (install button) ---------- */
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferredPrompt=e; const b=$('btn-install'); if(b){ b.style.display='inline-block'; b.onclick=async()=>{ deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; }; } });

/* ---------- Wire once ---------- */
function initOnce(){
  if(INIT) return; INIT=true; applyTheme();

  // Auth buttons
  $('btn-signin').onclick=signIn; $('btn-signup').onclick=signUp; $('btn-signout').onclick=signOut;
  $('btn-apple').onclick=()=>oauth('apple'); $('btn-google').onclick=()=>oauth('google');
  $('btn-theme').onclick=toggleTheme;

  // Nav
  $('nav-files').onclick=()=>{ show('files'); listFiles(); };
  $('nav-home').onclick=()=>{ show('home'); recent(); };
  $('btn-profile').onclick=()=>{ show('profile'); };
  $('back-home').onclick=()=>{ show('home'); };

  // Files controls
  $('btn-cards').onclick=()=>{ state.layout='grid'; listFiles(); };
  $('btn-rows').onclick=()=>{ state.layout='row'; listFiles(); };
  $('btn-trash').onclick=()=>{ state.tab = (state.tab==='files'?'trash':'files'); listFiles(); };

  // Folders
  $('btn-folder-new').onclick=newFolder;
  $('btn-folder-rename').onclick=renameFolder;
  $('btn-folder-del').onclick=deleteFolder;

  // Uploads
  const browse=$('browse'), fi=$('file-input'), drop=$('drop');
  browse.onclick=(e)=>{ e.preventDefault(); fi.click(); };
  fi.onchange=(e)=> handleFiles(e.target.files);
  drop.addEventListener('dragover',e=>{ e.preventDefault(); });
  drop.addEventListener('drop',e=>{ e.preventDefault(); handleFiles(e.dataTransfer.files); });

  // Quick upload
  const qb=$('quick-browse'), qi=$('quick-input'), qd=$('quick');
  qb.onclick=(e)=>{ e.preventDefault(); qi.click(); };
  qi.onchange=(e)=> handleFiles(e.target.files);
  qd.addEventListener('dragover',e=>{ e.preventDefault(); });
  qd.addEventListener('drop',e=>{ e.preventDefault(); handleFiles(e.dataTransfer.files); });

  // SEARCH (Enter to search, Esc to clear)
  const search=$('search');
  if(search){
    let lastTerm='';
    search.addEventListener('keydown', async (e)=>{
      if(e.key==='Enter'){
        const term = search.value.trim();
        state.search = term.length>=2 ? term : null;
        show('files');
        await listFiles();
        toast(state.search ? `Search: “${state.search}”` : 'Search cleared','info');
      }
      if(e.key==='Escape'){
        search.value=''; state.search=null; await listFiles();
        toast('Search cleared','info');
      }
    });
    search.addEventListener('input', ()=>{
      const term = search.value.trim();
      if(term==='' && lastTerm!==''){
        lastTerm=''; state.search=null; listFiles();
      } else {
        lastTerm=term;
      }
    });
  }
}

/* ---------- DOM ready ---------- */
document.addEventListener('DOMContentLoaded', applyTheme);
