/* app-files.js — listFiles + render (backward-compatible), preview, menu, uploads, trash/restore/delete, share */

function fileNameOf(row){ return row.filename ?? row.name ?? ""; }
function isTrashed(row){
  // support either deleted_at (timestamp) or trashed (boolean)
  if (typeof row.trashed === "boolean") return row.trashed;
  return !!row.deleted_at;
}

async function listFiles() {
  const container = $("list");
  if (!container) return;

  container.className = state.layout === "grid" ? "grid" : "row";
  container.innerHTML = "";

  // Build a query that works with either schema variant
  let q = sb.from("files").select("*").order("created_at", { ascending: false });

  // Filter tab (files vs trash) in a compatible way
  if (state.tab === "files") {
    q = q.or("trashed.eq.false,deleted_at.is.null"); // match either
  } else {
    q = q.or("trashed.eq.true,deleted_at.not.is.null");
  }

  if (state.folder?.id) q = q.eq("folder_id", state.folder.id);

  // Search across filename OR name
  if (state.search && state.search.trim().length >= 2) {
    const term = state.search.trim();
    q = q.or(`filename.ilike.%${term}%,name.ilike.%${term}%`);
  }

  const { data, error } = await q;
  if (error) { container.innerHTML = `<li class="muted">List error: ${esc(error.message)}</li>`; return; }
  if (!data?.length) { container.innerHTML = `<li class="muted">${state.search ? "No results." : "No files yet."}</li>`; renderFolders(); return; }

  for (const f of data) {
    const fname = fileNameOf(f);
    const bucket = isTrashed(f) ? "user-trash" : "user-files";
    const sig = await sb.storage.from(bucket).createSignedUrl(f.filepath, 180);
    const url = sig.data?.signedUrl || null;
    const e = ext(fname);

    if (state.layout === "grid") {
      const li = document.createElement("li"); li.className = "item";

      const ph = document.createElement("div"); ph.className = "ph";
      if (url && isImg(e)) ph.innerHTML = `<img src="${url}" alt="${esc(fname)}" loading="lazy">`;
      else ph.innerHTML = `<div class="chip">${(e || "FILE").toUpperCase()}</div>`;

      const nm = document.createElement("div"); nm.className = "nm"; nm.textContent = truncateName(fname, 24); nm.title = fname;

      const keb = document.createElement("div"); keb.className = "kebab";
      keb.onclick = (ev) => openFileMenu(ev, f, url);

      ph.onclick = () => openPreview({ ...f, filename: fname }, url);

      li.appendChild(ph); li.appendChild(nm); li.appendChild(keb);
      container.appendChild(li);
    } else {
      const li = document.createElement("li"); li.className = "row-item";

      const th = document.createElement("div"); th.className = "row-thumb";
      if (url && isImg(e)) th.innerHTML = `<img src="${url}" alt="${esc(fname)}" loading="lazy">`;

      const nm = document.createElement("div"); nm.textContent = truncateName(fname, 36); nm.title = fname;

      const keb = document.createElement("div"); keb.className = "kebab-row";
      keb.onclick = (ev) => openFileMenu(ev, f, url);

      th.onclick = () => openPreview({ ...f, filename: fname }, url);

      li.appendChild(th); li.appendChild(nm); li.appendChild(keb);
      container.appendChild(li);
    }
  }
  renderFolders();
}

/* In-app preview */
function openPreview(fileRow, signedUrl) {
  const fname = fileNameOf(fileRow) || fileRow.filename || "File";
  if (!signedUrl) return toast("No preview", "info");
  const modal = document.createElement("div");
  modal.className = "overlay";
  modal.innerHTML = `
    <div class="modal" style="max-width:900px; width:90vw; height:80vh; display:flex; flex-direction:column;">
      <div class="row between" style="margin-bottom:10px;">
        <strong>${esc(fname)}</strong>
        <button class="ghost" id="pv-close">Close</button>
      </div>
      <div style="flex:1; overflow:auto; display:flex; align-items:center; justify-content:center;">
        ${isImg(ext(fname))
          ? `<img src="${signedUrl}" style="max-width:100%; max-height:100%; object-fit:contain;">`
          : `<iframe src="${signedUrl}" style="width:100%; height:100%; border:none;"></iframe>`}
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.querySelector("#pv-close").onclick = () => modal.remove();
}

/* Kebab actions */
function openFileMenu(ev, f, url) {
  document.querySelectorAll(".menu").forEach((m) => m.remove());
  const m = document.createElement("div");
  m.className = "menu";
  m.addEventListener("click", (e) => e.stopPropagation());
  const add = (label, fn) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.onclick = () => { m.remove(); fn(); };
    m.appendChild(b);
  };

  const fname = fileNameOf(f);
  if (!isTrashed(f)) {
    add("Open", () => { if (url) window.open(url, "_blank"); else toast("No preview", "info"); });
    add("Preview", () => openPreview({ ...f, filename: fname }, url));
    add("Download", () => { if (!url) return; const a = document.createElement("a"); a.href = url; a.download = fname; a.click(); });
    add("Share link…", () => shareLinkCreate({ ...f, filename: fname }));
    add("Move to Trash", () => moveToTrash(f));
  } else {
    add("Restore", () => restoreFile(f));
    add("Delete Forever", () => deleteForever(f));
  }
  document.body.appendChild(m);
  m.style.left = ev.pageX + "px";
  m.style.top  = ev.pageY + "px";
  m.style.position = "absolute";
  m.style.zIndex = 9999;
  document.addEventListener("click", () => m.remove(), { once: true });
}

/* Uploads */
async function handleFiles(fileList) {
  const { data: sess } = await sb.auth.getSession();
  const user = sess?.session?.user;
  if (!user) return toast("Not logged in", "error");

  const files = Array.from(fileList || []);
  for (const file of files) {
    const seg = state.folder?.id ? `${state.folder.name}/` : "";
    const path = `${user.id}/${seg}${file.name}`;

    const up = await sb.storage.from("user-files").upload(path, file, { upsert: true });
    if (up.error) { toast("Upload error", "error", up.error.message); continue; }

    const ins = await sb.from("files").insert([{
      user_id: user.id,
      folder_id: state.folder?.id || null,
      filename: file.name,           // preferred column
      name: file.name,               // fallback column (if your table uses 'name')
      filepath: path,
      deleted_at: null,              // ensure visible in 'files' tab
      trashed: false                 // for boolean schema
    }]);
    if (ins.error) {
      await sb.storage.from("user-files").remove([path]);
      toast("DB insert error", "error", ins.error.message);
    }
  }
  refresh();
}

/* Trash / Restore / Delete */
async function moveToTrash(f) {
  if (!confirm("Trash this file?")) return;
  const d = await sb.storage.from("user-files").download(f.filepath);
  if (d.error) return toast("Download error", "error", d.error.message);
  const u = await sb.storage.from("user-trash").upload(f.filepath, d.data, { upsert: true });
  if (u.error) return toast("Move error", "error", u.error.message);
  await sb.storage.from("user-files").remove([f.filepath]);

  // update either schema
  const upd = await sb.from("files").update({
    deleted_at: new Date().toISOString(),
    trashed: true
  }).eq("id", f.id);
  if (upd.error) return toast("DB error", "error", upd.error.message);
  refresh();
}

async function restoreFile(f) {
  const d = await sb.storage.from("user-trash").download(f.filepath);
  if (d.error) return toast("Trash download error", "error", d.error.message);
  const u = await sb.storage.from("user-files").upload(f.filepath, d.data, { upsert: true });
  if (u.error) return toast("Restore error", "error", u.error.message);
  await sb.storage.from("user-trash").remove([f.filepath]);

  const upd = await sb.from("files").update({
    deleted_at: null,
    trashed: false
  }).eq("id", f.id);
  if (upd.error) return toast("DB error", "error", upd.error.message);
  refresh();
}

async function deleteForever(f) {
  if (!confirm("Delete forever?")) return;
  const r = await sb.storage.from("user-trash").remove([f.filepath]);
  if (r.error) return toast("Storage error", "error", r.error.message);
  const d = await sb.from("files").delete().eq("id", f.id);
  if (d.error) return toast("DB error", "error", d.error.message);
  refresh();
}

/* Shares (unchanged) */
async function shareLinkCreate(f) {
  if (isTrashed(f)) return toast("Restore file before sharing", "info");

  let mins = prompt("Link expires in minutes (default 60):", "60");
  if (mins === null) return;
  mins = parseInt(mins, 10);
  if (isNaN(mins) || mins < 1) mins = 60;
  if (mins > 10080) mins = 10080;

  const restrict = confirm("Restrict to specific emails? OK = Yes, Cancel = Public");
  let emails = [];
  if (restrict) {
    const raw = prompt("Enter allowed emails, comma-separated:", "");
    if (raw === null) return;
    emails = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!emails.length) alert("No emails entered, making it public instead.");
  }

  const { data: sess } = await sb.auth.getSession();
  const user = sess?.session?.user;
  if (!user) return toast("Not logged in", "error");

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + mins * 60 * 1000).toISOString();

  const ins = await sb.from("shares").insert([{
    token,
    file_id: f.id,
    owner_id: user.id,
    restricted: restrict && emails.length > 0,
    allow_emails: restrict && emails.length > 0 ? emails : null,
    expires_at: expiresAt
  }]).select().single();

  if (ins.error) return toast("Share create error", "error", ins.error.message);

  const appUrl = `${location.origin}/share.html#${token}`;
  try { await navigator.clipboard.writeText(appUrl); toast("Share created (copied)", "success", appUrl); }
  catch { alert("Share URL:\n\n" + appUrl); toast("Share created", "success"); }
}
