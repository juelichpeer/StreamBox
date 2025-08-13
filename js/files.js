import { sb, $, state, toast } from './config.js';

// Fetch recent files
export async function fetchRecent(limit = 6) {
  const { data, error } = await sb
    .from('files')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return { data: data || [], error };
}

// Apply truncation to filenames
function truncateName(name, maxLength = 20) {
  if (!name) return '';
  return name.length > maxLength ? name.slice(0, maxLength) + '…' : name;
}

// Render files into the main file browser
export async function listFiles() {
  const container = $('file-list');
  if (!container) return;
  container.innerHTML = '';

  const { data, error } = await sb
    .from('files')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<li class="muted">Could not load files.</li>`;
    return;
  }

  if (!data.length) {
    container.innerHTML = `<li class="muted">No files found.</li>`;
    return;
  }

  data.forEach(file => {
    const li = document.createElement('li');
    li.className = 'file-item';

    li.innerHTML = `
      <span class="filename" title="${file.filename}">${truncateName(file.filename)}</span>
      <span class="file-date">${new Date(file.created_at).toLocaleString()}</span>
    `;
    container.appendChild(li);
  });
}

// Load recent files into dashboard
export async function loadRecent() {
  const ul = $('recent-list');
  if (!ul) return;
  ul.innerHTML = '';

  const { data, error } = await fetchRecent(6);

  if (error) {
    ul.innerHTML = '<li class="muted">Could not load recent.</li>';
    return;
  }
  if (!data.length) {
    ul.innerHTML = '<li class="muted">Nothing yet.</li>';
    return;
  }

  data.forEach(item => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="filename" title="${item.filename}">${truncateName(item.filename)}</span>
      <span class="file-date">${new Date(item.created_at).toLocaleString()}</span>
    `;
    ul.appendChild(li);
  });
}

// Upload handler
export async function handleFiles(files) {
  if (!files.length) return;

  for (const file of files) {
    const { data, error } = await sb.storage.from('files').upload(file.name, file, {
      upsert: true
    });

    if (error) {
      toast(`Error uploading ${file.name}`, 'error');
    } else {
      toast(`${file.name} uploaded`, 'success');
    }
  }
  listFiles();
  loadRecent();
}
