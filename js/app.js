/* StreamBox Nova — Global Search + Revocable Share Links with Filename Truncation */

const SUPABASE_URL = "https://kulgncyhgksjdvprgfdy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1bGduY3loZ2tzamR2cHJnZmR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5OTA1ODQsImV4cCI6MjA3MDU2NjU4NH0.XA6R7qZDO1jypaCEeIfGJKo8DmUdpxcYBnB0Ih3K8ms";

if (!window.supabase) alert("Supabase not loaded");
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (id) => document.getElementById(id);
const toastBox = $("toasts");

function toast(msg, type = "info", detail = "") {
  const t = document.createElement("div");
  t.className = "toast " + type;
  t.innerHTML = esc(msg) + (detail ? `<small>${esc(detail)}</small>` : "");
  toastBox.appendChild(t);
  setTimeout(() => t.remove(), 4500);
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));

function show(id) {
  ["auth", "home", "files", "profile"].forEach((s) =>
    $(s).classList.remove("show")
  );
  $(id).classList.add("show");
}

function setEmail(u) {
  $("user-email").textContent = u?.email || "";
  $("p-email").textContent = u?.email || "";
}

function applyTheme() {
  const saved = localStorage.getItem("nova-theme");
  if (saved) document.body.setAttribute("data-theme", saved);
}

function toggleTheme() {
  const cur = document.body.getAttribute("data-theme");
  const next = cur === "dark" ? "light" : "dark";
  document.body.setAttribute("data-theme", next);
  localStorage.setItem("nova-theme", next);
}

window.addEventListener("error", (e) =>
  toast("JS error", "error", e.message || "")
);
window.addEventListener("unhandledrejection", (e) =>
  toast(
    "Promise error",
    "error",
    String(e?.reason?.message || e?.reason || "")
  )
);

/* ---------- Auth ---------- */
async function signUp() {
  const email = $("email").value.trim(),
    pw = $("password").value;
  if (!email || !pw) return toast("Enter email + password", "error");
  const { error } = await sb.auth.signUp({ email, password: pw });
  if (error) return toast("Sign up failed", "error", error.message);
  toast("Check your email to confirm", "success");
}

async function signIn() {
  const email = $("email").value.trim(),
    pw = $("password").value;
  if (!email || !pw) return toast("Enter email + password", "error");
  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password: pw,
  });
  if (error) return toast("Login failed", "error", error.message);
  setEmail(data.user);
  initOnce();
  show("home");
  await refresh();
  toast("Welcome", "success");
}

async function signOut() {
  await sb.auth.signOut();
  toast("Signed out", "info");
  show("auth");
}

async function oauth(provider) {
  const redirectTo =
    window.location.origin + (window.location.pathname || "");
  const { error } = await sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  });
  if (error) toast("OAuth error", "error", error.message);
  else toast("Redirecting…", "info");
}

/* Session watcher */
let INIT = false;
sb.auth.onAuthStateChange((_e, session) => {
  if (session?.user) {
    setEmail(session.user);
    if (!INIT) {
      initOnce();
    }
    show("home");
    refresh();
  } else {
    show("auth");
  }
});
sb.auth.getUser().then(({ data }) => {
  if (data?.user) {
    setEmail(data.user);
    if (!INIT) {
      initOnce();
    }
    show("home");
    refresh();
  } else show("auth");
});

/* ---------- Files / Folders ---------- */
// =============================
// 📂 FOLDER & FILE MANAGEMENT
// =============================

// --- Helpers ---
const ext = (n) => (n?.split(".").pop() || "").toLowerCase();
const isImg = (e) => ["png", "jpg", "jpeg", "webp", "gif", "avif"].includes(e);

function truncateName(name, max = 20) {
  return name.length > max ? name.slice(0, max - 3) + "..." : name;
}

let state = {
  layout: "grid",
  tab: "files",       // 'files' or 'trash'
  folder: null,       // current folder object
  folders: [],        // all folders
  search: null        // search string
};

// --- Load Folders ---
async function loadFolders() {
  const { data } = await sb
    .from("folders")
    .select("*")
    .order("created_at", { ascending: true });

  state.folders = [{ id: null, name: "All Files" }, ...(data || [])];
  renderFolders();
}

// --- Render Folders ---
function renderFolders() {
  const ul = $("folders");
  if (!ul) return;

  ul.innerHTML = "";
  state.folders.forEach((f) => {
    const li = document.createElement("li");
    li.textContent = f.name;
    if (state.folder?.id === f.id) li.classList.add("active");

    li.onclick = () => {
      state.folder = f;
      listFiles();
      renderFolders();
    };
    ul.appendChild(li);
  });

  const base = state.tab === "files" ? "Your Files" : "Trash";
  $("files-title").textContent =
    base +
    (state.folder?.id ? ` — ${state.folder.name}` : "") +
    (state.search ? ` — “${state.search}”` : "");
}

// --- Create Folder ---
async function newFolder() {
  const name = prompt("Folder name:");
  if (name === null) return;
  if (!name.trim()) return;

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  const { data, error } = await sb
    .from("folders")
    .insert([{ user_id: user.id, name: name.trim() }])
    .select()
    .single();

  if (error) return toast("New folder error", "error", error.message);

  state.folder = data;
  await loadFolders();
  await listFiles();
}

// --- Rename Folder ---
async function renameFolder() {
  if (!state.folder?.id) return toast("Select a folder to rename", "error");

  const name = prompt("New folder name:", state.folder.name);
  if (!name) return;

  const { error } = await sb
    .from("folders")
    .update({ name: name.trim() })
    .eq("id", state.folder.id);

  if (error) return toast("Rename error", "error", error.message);

  await loadFolders();
}

// --- Delete Folder ---
async function deleteFolder() {
  if (!state.folder?.id) return toast("Select a folder to delete", "error");
  if (!confirm("Delete this folder?")) return;

  const { error } = await sb
    .from("folders")
    .delete()
    .eq("id", state.folder.id);

  if (error) return toast("Delete folder error", "error", error.message);

  state.folder = null;
  await loadFolders();
  await listFiles();
}

// --- List Files ---
async function listFiles() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  let q = sb.from("files").select("*").eq("user_id", user.id);
  if (state.folder?.id) q = q.eq("folder_id", state.folder.id);
  if (state.tab === "trash") q = q.eq("trashed", true);
  else q = q.eq("trashed", false);
  if (state.search) q = q.ilike("name", `%${state.search}%`);

  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) return toast("List error", "error", error.message);

  renderFiles(data || []);
}

// --- Render Files ---
function renderFiles(arr) {
  const ul = $("list");
  if (!ul) return;
  ul.innerHTML = "";

  arr.forEach((f) => {
    const li = document.createElement("li");
    li.className = state.layout;

    const truncated = truncateName(f.name, 22);

    li.innerHTML = `
      <div class="file">
        <div class="thumb">
          ${isImg(ext(f.name))
            ? `<img src="${f.url}" alt="${esc(f.name)}">`
            : `<span>${ext(f.name).toUpperCase()}</span>`}
        </div>
        <div class="meta">
          <strong title="${esc(f.name)}">${truncated}</strong>
          <small>${new Date(f.created_at).toLocaleString()}</small>
        </div>
      </div>
    `;
    ul.appendChild(li);
  });
}

// --- Recent Files ---
async function recent() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  const { data, error } = await sb
    .from("files")
    .select("*")
    .eq("user_id", user.id)
    .eq("trashed", false)
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) return toast("Recent error", "error", error.message);

  renderRecent(data || []);
}

// --- Render Recent Files ---
function renderRecent(arr) {
  const ul = $("recent");
  if (!ul) return;

  ul.innerHTML = "";
  arr.forEach((f) => {
    const truncated = truncateName(f.name, 20);
    ul.innerHTML += `
      <li>
        <a href="${f.url}" target="_blank" title="${esc(f.name)}">
          ${truncated}
        </a>
      </li>
    `;
  });
}


/* Init */
function initOnce() {
  if (INIT) return;
  INIT = true;
  applyTheme();
  $("btn-signup").onclick = signUp;
  $("btn-signin").onclick = signIn;
  $("btn-signout").onclick = signOut;
  $("btn-folder-new").onclick = newFolder;
  $("btn-folder-rename").onclick = renameFolder;
  $("btn-folder-del").onclick = deleteFolder;
  $("btn-trash").onclick = () => {
    state.tab = "trash";
    listFiles();
  };
  $("btn-cards").onclick = () => {
    state.layout = "grid";
    listFiles();
  };
  $("btn-rows").onclick = () => {
    state.layout = "row";
    listFiles();
  };
  $("search").oninput = (e) => {
    state.search = e.target.value.trim() || null;
    listFiles();
  };
}

async function refresh() {
  await loadFolders();
  await listFiles();
  await recent();
}
