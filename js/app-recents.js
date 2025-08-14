/* app-recents.js — dashboard stats + recent list */

async function stats() {
  const a = await sb.from("files").select("*", { count: "exact", head: true }).is("deleted_at", null);
  const b = await sb.from("files").select("*", { count: "exact", head: true }).not("deleted_at", "is", null);
  if ($("stat-files")) $("stat-files").textContent = typeof a.count === "number" ? a.count : "—";
  if ($("stat-trash")) $("stat-trash").textContent = typeof b.count === "number" ? b.count : "—";
}

async function recent() {
  const ul = $("recent");
  if (!ul) return;
  ul.innerHTML = "";
  const { data, error } = await sb
    .from("files")
    .select("id,filename,filepath,created_at,deleted_at")
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) { ul.innerHTML = '<li class="muted">Could not load.</li>'; return; }
  if (!data?.length) { ul.innerHTML = '<li class="muted">Nothing yet.</li>'; return; }

  for (const f of data) {
    const li = document.createElement("li");

    const left = document.createElement("div"); left.className = "row";
    const th = document.createElement("div"); th.className = "thumb";

    const e = ext(f.filename); let set = false;
    if (isImg(e)) {
      const b = f.deleted_at ? "user-trash" : "user-files";
      const s = await sb.storage.from(b).createSignedUrl(f.filepath, 120);
      const url = s.data?.signedUrl || null;
      if (url) { const img = document.createElement("img"); img.src = url; img.alt = f.filename; th.appendChild(img); set = true; }
    }
    if (!set) { const chip = document.createElement("div"); chip.className = "chip"; chip.textContent = (e || "FILE").toUpperCase(); th.appendChild(chip); }

    const meta = document.createElement("div"); meta.className = "meta";
    const name = document.createElement("div"); name.className = "name"; name.textContent = truncateName(f.filename, 28); name.title = f.filename;
    const time = document.createElement("div"); time.className = "time"; time.textContent = new Date(f.created_at).toLocaleString();
    meta.appendChild(name); meta.appendChild(time);
    left.appendChild(th); left.appendChild(meta);

    const right = document.createElement("div");
    if (f.deleted_at) { const tag = document.createElement("div"); tag.className = "chip"; tag.textContent = "TRASHED"; right.appendChild(tag); }

    li.appendChild(left); li.appendChild(right);
    ul.appendChild(li);
  }
}
