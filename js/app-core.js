/* app-core.js — globals, Supabase init, helpers, theme */

const SUPABASE_URL = "https://kulgncyhgksjdvprgfdy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1bGduY3loZ2tzamR2cHJnZmR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5OTA1ODQsImV4cCI6MjA3MDU2NjU4NH0.XA6R7qZDO1jypaCEeIfGJKo8DmUdpxcYBnB0Ih3K8ms";

if (!window.supabase) alert("Supabase not loaded");
window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.$ = (id) => document.getElementById(id);

const toastBox = $("toasts");
window.toast = function (msg, type = "info", detail = "") {
  if (!toastBox) return alert(msg + (detail ? "\n" + detail : ""));
  const t = document.createElement("div");
  t.className = "toast " + type;
  t.innerHTML = esc(msg) + (detail ? `<small>${esc(detail)}</small>` : "");
  toastBox.appendChild(t);
  setTimeout(() => t.remove(), 4500);
};

window.esc = (s) =>
  String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));

window.show = function (id) {
  ["auth", "home", "files", "profile"].forEach((s) =>
    $(s)?.classList.remove("show")
  );
  $(id)?.classList.add("show");
};

window.setEmail = function (u) {
  if ($("user-email")) $("user-email").textContent = u?.email || "";
  if ($("p-email")) $("p-email").textContent = u?.email || "";
};

window.applyTheme = function () {
  const saved = localStorage.getItem("nova-theme");
  if (saved) document.body.setAttribute("data-theme", saved);
};
window.toggleTheme = function () {
  const cur = document.body.getAttribute("data-theme");
  const next = cur === "dark" ? "light" : "dark";
  document.body.setAttribute("data-theme", next);
  localStorage.setItem("nova-theme", next);
};

window.ext = (n) => (n?.split(".").pop() || "").toLowerCase();
window.isImg = (e) => ["png", "jpg", "jpeg", "webp", "gif", "avif"].includes(e);
window.truncateName = (name, max = 20) =>
  name && name.length > max ? name.slice(0, max - 1) + "…" : (name || "");

window.state = {
  layout: "grid",     // 'grid' | 'row'
  tab: "files",       // 'files' | 'trash'
  folder: null,       // current folder object
  folders: [],        // all folders
  search: null        // search term
};

window.addEventListener("error", (e) =>
  toast("JS error", "error", e.message || "")
);
window.addEventListener("unhandledrejection", (e) =>
  toast("Promise error", "error", String(e?.reason?.message || e?.reason || ""))
);

document.addEventListener("DOMContentLoaded", applyTheme);
