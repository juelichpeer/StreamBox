/* app-folders.js — loadFolders, renderFolders, newFolder, renameFolder, deleteFolder */

async function loadFolders() {
  const { data, error } = await sb.from("folders").select("*").order("created_at", { ascending: true });
  if (error) { toast("Folders load error", "error", error.message); return; }
  state.folders = [{ id: null, name: "All Files" }, ...(data || [])];
  renderFolders();
}

function renderFolders() {
  const ul = $("folders");
  if (!ul) return;
  ul.innerHTML = "";
  state.folders.forEach((f) => {
    const li = document.createElement("li");
    li.textContent = f.name;
    if (state.folder?.id === f.id) li.classList.add("active");
    li.onclick = () => { state.folder = f; listFiles(); renderFolders(); };
    ul.appendChild(li);
  });
  const base = state.tab === "files" ? "Your Files" : "Trash";
  const title = base + (state.folder?.id ? ` — ${state.folder.name}` : "") + (state.search ? ` — “${state.search}”` : "");
  if ($("files-title")) $("files-title").textContent = title;
}

async function newFolder() {
  const name = prompt("Folder name:");
  if (name === null) return;
  if (!name.trim()) return;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return toast("Not logged in", "error");
  const { data, error } = await sb.from("folders").insert([{ user_id: user.id, name: name.trim() }]).select().single();
  if (error) return toast("New folder error", "error", error.message);
  state.folder = data;
  await loadFolders();
  await listFiles();
}

async function renameFolder() {
  if (!state.folder?.id) return toast("Select a folder", "info");
  const name = prompt("New folder name:", state.folder.name);
  if (name === null || !name.trim()) return;
  const { error } = await sb.from("folders").update({ name: name.trim() }).eq("id", state.folder.id);
  if (error) return toast("Rename error", "error", error.message);
  await loadFolders();
}

async function deleteFolder() {
  if (!state.folder?.id) return toast("Select a folder", "info");
  if (!confirm("Delete this folder?")) return;
  // Optional: ensure empty first (uncomment to enforce)
  // const { data: has } = await sb.from("files").select("id").eq("folder_id", state.folder.id).limit(1);
  // if (has?.length) return toast("Folder not empty", "error", "Move or delete files first");

  const { error } = await sb.from("folders").delete().eq("id", state.folder.id);
  if (error) return toast("Delete folder error", "error", error.message);
  state.folder = null;
  await loadFolders();
  await listFiles();
}
