/* app-init.js — wiring DOM events + refresh */

function initOnce() {
  if (window.__INIT_DONE__) return;
  window.__INIT_DONE__ = true;
  applyTheme();

  // Auth buttons
  $("btn-signup")?.addEventListener("click", signUp);
  $("btn-signin")?.addEventListener("click", signIn);
  $("btn-signout")?.addEventListener("click", signOut);
  $("btn-apple")?.addEventListener("click", () => oauth("apple"));
  $("btn-google")?.addEventListener("click", () => oauth("google"));
  $("btn-theme")?.addEventListener("click", toggleTheme);

  // Nav
  $("nav-files")?.addEventListener("click", () => { show("files"); listFiles(); });
  $("nav-home")?.addEventListener("click", () => { show("home"); recent(); });
  $("btn-profile")?.addEventListener("click", () => { show("profile"); });
  $("back-home")?.addEventListener("click", () => { show("home"); });

  // Files topbar
  $("btn-cards")?.addEventListener("click", () => { state.layout = "grid"; listFiles(); });
  $("btn-rows") ?.addEventListener("click", () => { state.layout = "row";  listFiles(); });
  $("btn-trash")?.addEventListener("click", () => {
    state.tab = (state.tab === "files" ? "trash" : "files");
    listFiles();
  });

  // Folders
  $("btn-folder-new")   ?.addEventListener("click", newFolder);
  $("btn-folder-rename")?.addEventListener("click", renameFolder);
  $("btn-folder-del")   ?.addEventListener("click", deleteFolder);

  // Uploads – Files page
  const browse = $("browse"), fi = $("file-input"), drop = $("drop");
  browse?.addEventListener("click", (e) => { e.preventDefault(); fi?.click(); });
  fi   ?.addEventListener("change", (e) => handleFiles(e.target.files));
  drop ?.addEventListener("dragover", (e) => e.preventDefault());
  drop ?.addEventListener("drop", (e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); });

  // Quick upload – Dashboard
  const qb = $("quick-browse"), qi = $("quick-input"), qd = $("quick");
  qb?.addEventListener("click", (e) => { e.preventDefault(); qi?.click(); });
  qi?.addEventListener("change", (e) => handleFiles(e.target.files));
  qd?.addEventListener("dragover", (e) => e.preventDefault());
  qd?.addEventListener("drop", (e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); });

  // Search
  const search = $("search");
  if (search) {
    let lastTerm = "";
    search.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        const term = search.value.trim();
        state.search = term.length >= 2 ? term : null;
        show("files");
        await listFiles();
        toast(state.search ? `Search: “${state.search}”` : "Search cleared", "info");
      }
      if (e.key === "Escape") {
        search.value = "";
        state.search = null;
        await listFiles();
        toast("Search cleared", "info");
      }
    });
    search.addEventListener("input", () => {
      const term = search.value.trim();
      if (term === "" && lastTerm !== "") {
        lastTerm = "";
        state.search = null;
        listFiles();
      } else {
        lastTerm = term;
      }
    });
  }

  // PWA install button
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); deferredPrompt = e;
    const b = $("btn-install");
    if (b) {
      b.style.display = "inline-block";
      b.onclick = async () => {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
      };
    }
  });
}

async function refresh() {
  await Promise.all([loadFolders(), listFiles(), recent(), stats()]);
}

