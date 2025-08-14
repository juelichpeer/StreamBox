// File extensions for previews
const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'];
const docExts = ['pdf', 'txt', 'md', 'html', 'css', 'js'];

// Get file extension
function getExt(name) {
  return name.split('.').pop().toLowerCase();
}

// Create file card with preview + menu
function createFileItem(file) {
  const li = document.createElement('li');
  li.className = 'file-item';

  const ext = getExt(file.filename);
  const isImage = imageExts.includes(ext);
  const isDoc = docExts.includes(ext);

  li.innerHTML = `
    <div class="file-card">
      <div class="file-thumb">
        ${
          isImage
            ? `<img src="${file.url}" alt="${file.filename}" />`
            : `<span class="file-icon">${ext.toUpperCase()}</span>`
        }
      </div>
      <div class="file-meta">
        <strong>${truncateName(file.filename)}</strong>
        <small>${new Date(file.created_at).toLocaleString()}</small>
      </div>
      <button class="file-menu-btn">⋮</button>
    </div>
  `;

  // Open preview when clicking the thumbnail
  li.querySelector('.file-thumb').addEventListener('click', () => {
    openPreview(file, isImage, isDoc);
  });

  // Open menu
  li.querySelector('.file-menu-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openFileMenu(file);
  });

  return li;
}

// Preview modal
function openPreview(file, isImage, isDoc) {
  const modal = document.createElement('div');
  modal.className = 'preview-modal';
  modal.innerHTML = `
    <div class="preview-content">
      <button class="close-preview">✖</button>
      ${
        isImage
          ? `<img src="${file.url}" alt="${file.filename}" />`
          : isDoc
          ? `<iframe src="${file.url}" frameborder="0"></iframe>`
          : `<p>No preview available for this file type.</p>`
      }
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('.close-preview').addEventListener('click', () => {
    modal.remove();
  });
}

// File actions menu
function openFileMenu(file) {
  const menu = document.createElement('div');
  menu.className = 'file-menu';
  menu.innerHTML = `
    <button onclick="window.open('${file.url}', '_blank')">Download</button>
    <button onclick="renameFile('${file.id}')">Rename</button>
    <button onclick="deleteFile('${file.id}')">Delete</button>
  `;
  document.body.appendChild(menu);

  // Close when clicking outside
  document.addEventListener('click', () => menu.remove(), { once: true });
}

// Render file list
export async function listFiles() {
  const container = $('file-list');
  if (!container) return;
  container.innerHTML = '';

  const { data, error } = await sb.from('files').select('*').order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<li class="muted">Could not load files.</li>`;
    return;
  }

  if (!data.length) {
    container.innerHTML = `<li class="muted">No files found.</li>`;
    return;
  }

  data.forEach(file => {
    // Ensure file.url exists
    file.url = sb.storage.from('files').getPublicUrl(file.filename).data.publicUrl;
    container.appendChild(createFileItem(file));
  });
}
