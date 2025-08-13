/***** FILES (list, upload, rename/move/trash/restore) *****/
import { sb, $, state, ext, isImg, isVid, isAud, isPdf, bucketFor, toast } from './config.js';
import { loadFolders } from './folders.js';
import { openMenu } from './menu.js';

export async function handleFiles(files){
  const {data:sess}=await sb.auth.getSession(); if(!sess?.session) return toast('Not logged in','error');
  const uid=sess.session.user.id;
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

export async function listFiles(){
  const list=$('file-list'); if(!list) return;
  list.className = state.layout==='grid' ? 'grid' : 'row-list';
  list.innerHTML='';
  let q=sb.from('files').select('*').order('created_at',{ascending:false});
  q = state.tab==='files' ? q.is('deleted_at',null) : q.not('deleted_at','is',null);
  if(state.currentFolder?.id) q=q.eq('folder_id',state.currentFolder.id);
  const {data,error}=await q; if(error) return toast('List error','error',error.message);
  if(!data?.length){ updateSectionTitle(); return; }

  for(const f of data){
    const bucket=bucketFor(f);
    const sig=await sb.storage.from(bucket).createSignedUrl(f.filepath,180);
    const url=sig.data?.signedUrl||null;
    const e=ext(f.filename);

    if(state.layout==='grid'){
      const li=document.createElement('li'); li.className='file-card';
      const keb=document.createElement('div'); keb.className='kebab'; keb.onclick=(ev)=>{ev.stopPropagation(); openMenu(ev,f,url);};
      const thumb=document.createElement('div'); thumb.className='thumb';
      if(url && isImg(e)) thumb.innerHTML=`<img src="${url}" alt="${f.filename}" loading="lazy">`;
      else if(url && isVid(e)) thumb.innerHTML=`<video src="${url}" controls></video>`;
      else if(url && isAud(e)) thumb.innerHTML=`<audio src="${url}" controls></audio>`;
      else if(isPdf(e)) thumb.innerHTML=`<div>PDF</div>`;
      else thumb.innerHTML=`<div>${(e||'FILE').toUpperCase()}</div>`;
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
  updateSectionTitle();
}

export function updateSectionTitle(){
  const base=state.tab==='files'?'Your Files':'Trash';
  const suffix=state.currentFolder?.id?` — ${state.currentFolder.name}`:'';
  const el=$('section-title'); if(el) el.textContent=base+suffix;
}

/* Move modal */
let MOVE_CTX = { file:null, selectedId:null };
export function openMoveModal(fileRow){
  MOVE_CTX.file = fileRow; MOVE_CTX.selectedId = fileRow.folder_id ?? null;
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
export function closeMoveModal(){ $('move-overlay').style.display='none'; MOVE_CTX={file:null,selectedId:null}; }

export async function performMove(){
  const f = MOVE_CTX.file; const targetId = MOVE_CTX.selectedId;
  if(!f) return closeMoveModal();
  if ((f.folder_id ?? null) === (targetId ?? null)) { toast('Already in that folder','info'); return closeMoveModal(); }
  const uid = f.filepath.split('/')[0];
  const destFolder = targetId ? (state.folders.find(x=>x.id===targetId)?.name || '') + '/' : '';
  const newPath = `${uid}/${destFolder}${f.filename}`;
  const mv = await sb.storage.from('user-files').move(f.filepath, newPath);
  if (mv.error){ return toast('Move error','error',mv.error.message); }
  const upd = await sb.from('files').update({ folder_id: targetId || null, filepath:newPath }).eq('id', f.id);
  if (upd.error){ return toast('DB update error','error',upd.error.message); }
  closeMoveModal(); toast('Moved','success'); listFiles();
}

/* Rename */
export async function renameFile(f){
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

/* Trash flow */
export async function moveToTrash(f){
  if(!confirm('Move to Trash?')) return;
  const dl=await sb.storage.from('user-files').download(f.filepath); if(dl.error) return toast('Download error','error',dl.error.message);
  const up=await sb.storage.from('user-trash').upload(f.filepath,dl.data,{upsert:true}); if(up.error) return toast('Upload to trash error','error',up.error.message);
  await sb.storage.from('user-files').remove([f.filepath]);
  const upd=await sb.from('files').update({deleted_at:new Date().toISOString()}).eq('id',f.id); if(upd.error) return toast('DB update error','error',upd.error.message);
  toast('Moved to Trash','success'); listFiles();
}
export async function restoreFile(f){
  const dl=await sb.storage.from('user-trash').download(f.filepath); if(dl.error) return toast('Trash download error','error',dl.error.message);
  const up=await sb.storage.from('user-files').upload(f.filepath,dl.data,{upsert:true}); if(up.error) return toast('Restore upload error','error',up.error.message);
  await sb.storage.from('user-trash').remove([f.filepath]);
  const upd=await sb.from('files').update({deleted_at:null}).eq('id',f.id); if(upd.error) return toast('DB update error','error',upd.error.message);
  toast('Restored','success'); listFiles();
}
export async function deleteForever(f){
  if(!confirm('Delete forever?')) return;
  const rm=await sb.storage.from('user-trash').remove([f.filepath]); if(rm.error) return toast('Storage delete error','error',rm.error.message);
  const del=await sb.from('files').delete().eq('id',f.id); if(del.error) return toast('DB delete error','error',del.error.message);
  toast('Deleted forever','success'); listFiles();
}
import { sb } from './config.js';
export async function fetchRecent(limit=6){
  const { data, error } = await sb.from('files')
    .select('id, filename, created_at, deleted_at')
    .order('created_at',{ascending:false})
    .limit(limit);
  return { data: data||[], error };
}
