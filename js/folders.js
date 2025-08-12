/***** FOLDERS *****/
import { sb, $, state, toast } from './config.js';
import { listFiles, updateSectionTitle } from './files.js';
import { openMenu } from './menu.js';

export async function loadFolders(){
  const virtualAll={id:null,name:'All Files'};
  const {data,error}=await sb.from('folders').select('*').order('created_at',{ascending:true});
  state.folders = error ? [virtualAll] : [virtualAll, ...(data||[])];
  if(!state.currentFolder || !state.folders.some(f=>f.id===state.currentFolder.id)) state.currentFolder=virtualAll;
  renderFolders();
}

export function openFolder(folder){
  state.currentFolder = folder?.id === undefined ? { id:null, name:'All Files' } : folder;
  listFiles();
  renderFolders();
}

export function renderFolders(){
  const ul=$('folder-list'); if(!ul) return; ul.innerHTML='';
  state.folders.forEach(f=>{
    const li=document.createElement('li');
    li.className='folder-item';
    if(state.currentFolder?.id===f.id) li.classList.add('active');

    // name
    const name=document.createElement('span');
    name.className='folder-name';
    name.textContent=f.name;
    name.title=f.name;
    name.onclick=()=>openFolder(f);

    li.appendChild(name);

    // kebab (only for real folders)
    if (f.id !== null) {
      const keb=document.createElement('div');
      keb.className='kebab folder-kebab';
      keb.setAttribute('role','button');
      keb.setAttribute('title','More');
      keb.onclick=(ev)=>{ ev.stopPropagation(); openMenu(ev, { _type:'folder', id:f.id, name:f.name }); };
      li.appendChild(keb);
    }

    ul.appendChild(li);
  });
  updateSectionTitle();
}

export async function newFolder(){
  const name=prompt('Folder name:'); if(name===null) return;
  const clean=name.trim(); if(!clean) return toast('Folder name cannot be empty','error');
  const {data:sess}=await sb.auth.getSession(); if(!sess?.session) return toast('Not logged in','error');
  const uid=sess.session.user.id;
  const {data,error}=await sb.from('folders').insert([{user_id:uid,name:clean}]).select().single();
  if(error) return toast('Create folder error','error',error.message);
  toast('Folder created','success'); state.currentFolder=data;
  await loadFolders(); await listFiles();
}

/* old "current folder" actions kept for buttons */
export async function renameFolder(){
  if(!state.currentFolder?.id) return toast('Select a folder (not "All Files")','info');
  return renameFolderById(state.currentFolder);
}
export async function deleteFolder(){
  if(!state.currentFolder?.id) return toast('Select a folder (not "All Files")','info');
  return deleteFolderById(state.currentFolder);
}

/* new specific-folder actions used by menu */
export async function renameFolderById(folder){
  let name=prompt('New folder name:', folder.name); if(name===null) return;
  name=name.trim(); if(!name) return toast('Folder name cannot be empty','error');
  const {error}=await sb.from('folders').update({name}).eq('id',folder.id);
  if(error) return toast('Rename folder error','error',error.message);
  toast('Folder renamed','success');
  if (state.currentFolder?.id === folder.id) state.currentFolder.name = name;
  await loadFolders(); await listFiles();
}

export async function deleteFolderById(folder){
  if(!confirm(`Delete folder “${folder.name}”? Move or delete files first.`)) return;
  const {data:filesIn,error:qErr}=await sb.from('files').select('id').eq('folder_id',folder.id).limit(1);
  if(qErr) return toast('Check folder error','error',qErr.message);
  if(filesIn?.length) return toast('Folder not empty','error','Move or delete files first');
  const {error}=await sb.from('folders').delete().eq('id',folder.id);
  if(error) return toast('Delete folder error','error',error.message);
  toast('Folder deleted','success');
  if (state.currentFolder?.id === folder.id) state.currentFolder = { id:null, name:'All Files' };
  await loadFolders(); await listFiles();
}
