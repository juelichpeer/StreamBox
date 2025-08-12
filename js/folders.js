/***** FOLDERS *****/
import { sb, $, state, toast } from './config.js';
import { listFiles, updateSectionTitle } from './files.js';

export async function loadFolders(){
  const virtualAll={id:null,name:'All Files'};
  const {data,error}=await sb.from('folders').select('*').order('created_at',{ascending:true});
  state.folders = error ? [virtualAll] : [virtualAll, ...(data||[])];
  if(!state.currentFolder || !state.folders.some(f=>f.id===state.currentFolder.id)) state.currentFolder=virtualAll;
  renderFolders();
}
export function renderFolders(){
  const ul=$('folder-list'); if(!ul) return; ul.innerHTML='';
  state.folders.forEach(f=>{
    const li=document.createElement('li'); li.textContent=f.name;
    if(state.currentFolder?.id===f.id) li.classList.add('active');
    li.onclick=()=>{state.currentFolder=f; listFiles(); renderFolders();};
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
export async function renameFolder(){
  if(!state.currentFolder?.id) return toast('Select a folder (not "All Files")','info');
  let name=prompt('New folder name:',state.currentFolder.name); if(name===null) return;
  name=name.trim(); if(!name) return toast('Folder name cannot be empty','error');
  const {error}=await sb.from('folders').update({name}).eq('id',state.currentFolder.id);
  if(error) return toast('Rename folder error','error',error.message);
  toast('Folder renamed','success'); state.currentFolder.name=name;
  renderFolders(); listFiles();
}
export async function deleteFolder(){
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
