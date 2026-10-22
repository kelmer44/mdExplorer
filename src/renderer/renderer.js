/* global api, BUILTIN_THEMES, FONT_STACKS */
'use strict';

const $ = (sel) => document.querySelector(sel);
const MD_RE = /\.(md|markdown|mdown|mkd|mdx|txt)$/i;

const state = {
  settings: {},
  root: null,
  currentFile: null,
  customThemes: [],
  codeThemes: [],
};

const el = {
  tree: $('#tree'),
  content: $('#content'),
  contentWrap: $('#content-wrap'),
  roots: $('#roots'),
  currentPath: $('#current-path'),
  filter: $('#filter'),
  showAll: $('#show-all'),
  docTitle: $('#doc-title'),
  statusPath: $('#status-path'),
  statusInfo: $('#status-info'),
  toc: $('#toc'),
  themeQuick: $('#theme-quick'),
  themeGrid: $('#theme-grid'),
  codeThemeSelect: $('#code-theme-select'),
  fontSelect: $('#font-select'),
  fontSize: $('#font-size'),
  contentWidth: $('#content-width'),
  settingsOverlay: $('#settings-overlay'),
};

function setSetting(key, value) {
  state.settings[key] = value;
  api.setSetting(key, value);
}

function sep() {
  return api.platform === 'win32' ? '\\' : '/';
}

function basename(p) {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || p;
}

function dirname(p) {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  if (i <= 0) return p.slice(0, i + 1) || p;
  // keep "C:\" as a root on Windows
  if (/^[A-Za-z]:$/.test(p.slice(0, i))) return p.slice(0, i + 1);
  return p.slice(0, i);
}

function isInside(child, parent) {
  if (!parent) return false;
  const norm = (s) => (api.platform === 'win32' ? s.toLowerCase() : s);
  const c = norm(child);
  let p = norm(parent);
  if (!p.endsWith(sep())) p += sep();
  return c.startsWith(p);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ---- Themes -----------------------------------------------------------------

function allThemes() {
  return [
    ...BUILTIN_THEMES,
    ...state.customThemes.map((t) => ({
      id: t.id,
      name: t.name + ' (custom)',
      dark: /color-scheme\s*:\s*dark/i.test(t.css) || /dark/i.test(t.name),
      custom: true,
      css: t.css,
    })),
  ];
}

function findTheme(id) {
  return allThemes().find((t) => t.id === id) || BUILTIN_THEMES[0];
}

async function applyTheme() {
  const theme = findTheme(state.settings.theme);
  const root = document.documentElement;

  // Reset any variables a previous built-in theme put on :root.
  for (const key of Object.keys(BUILTIN_THEMES[0].vars)) root.style.removeProperty('--' + key);
  if (theme.custom) {
    $('#custom-theme').textContent = theme.css;
  } else {
    $('#custom-theme').textContent = '';
    for (const [k, v] of Object.entries(theme.vars)) root.style.setProperty('--' + k, v);
  }
  root.style.colorScheme = theme.dark ? 'dark' : 'light';

  let code = state.settings.codeTheme;
  if (!code || code === 'auto') code = theme.code || (theme.dark ? 'github-dark' : 'github');
  $('#code-theme').textContent = await api.codeThemeCss(code);

  el.themeQuick.value = theme.id;
  document.querySelectorAll('.theme-card').forEach((c) => c.classList.toggle('selected', c.dataset.id === theme.id));
}

function applyTypography() {
  const s = state.settings;
  const root = document.documentElement.style;
  root.setProperty('--content-font', FONT_STACKS[s.fontFamily] || FONT_STACKS.system);
  root.setProperty('--content-size', s.fontSize + 'px');
  root.setProperty('--content-width', s.contentWidth + 'px');
  root.setProperty('--sidebar-width', s.sidebarWidth + 'px');
  $('#font-size-val').textContent = s.fontSize + 'px';
  $('#content-width-val').textContent = s.contentWidth + 'px';
}

function populateThemeControls() {
  const themes = allThemes();
  el.themeQuick.innerHTML = themes.map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join('');

  el.themeGrid.innerHTML = '';
  for (const t of themes) {
    const v = t.vars || {};
    const card = document.createElement('button');
    card.className = 'theme-card';
    card.dataset.id = t.id;
    card.innerHTML = `
      <div class="theme-swatch" style="background:${v.bg || '#888'};color:${v.fg || '#000'}">
        <div class="bar" style="background:${v.fg || '#000'};width:70%;opacity:.8"></div>
        <div class="bar" style="background:${v.link || '#06c'};width:40%"></div>
        <div class="bar" style="background:${v['code-bg'] || '#ccc'};width:85%"></div>
      </div>
      <span class="label">${escapeHtml(t.name)}</span>`;
    card.addEventListener('click', () => {
      setSetting('theme', t.id);
      applyTheme();
    });
    el.themeGrid.appendChild(card);
  }

  el.codeThemeSelect.innerHTML =
    '<option value="auto">Auto (match theme)</option>' +
    state.codeThemes.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  el.codeThemeSelect.value = state.settings.codeTheme || 'auto';
}

async function loadCustomThemes() {
  state.customThemes = await api.customThemes();
  populateThemeControls();
  await applyTheme();
}

// ---- Explorer tree ----------------------------------------------------------

function makeNode(entry) {
  const node = document.createElement('div');
  node.className = 'node';
  node.dataset.path = entry.path;
  node.dataset.dir = entry.isDir ? '1' : '';
  node.setAttribute('role', 'treeitem');

  const row = document.createElement('div');
  row.className = 'node-row';
  const icon = entry.isDir ? '📁' : MD_RE.test(entry.name) ? '📄' : '·';
  row.innerHTML = `<span class="twisty">${entry.isDir ? '▶' : ''}</span><span class="node-icon">${icon}</span><span class="node-name"></span>`;
  row.querySelector('.node-name').textContent = entry.name;
  row.title = entry.path;
  node.appendChild(row);

  if (entry.isDir) {
    const children = document.createElement('div');
    children.className = 'node-children';
    node.appendChild(children);
  }
  if (entry.path === state.currentFile) row.classList.add('active');
  return node;
}

async function fillChildren(container, dirPath, depth) {
  container.innerHTML = '<div class="tree-msg">Loading…</div>';
  let entries;
  try {
    entries = await api.listDir(dirPath, state.settings.showAllFiles);
  } catch (err) {
    container.innerHTML = `<div class="tree-msg">Cannot read folder</div>`;
    return;
  }
  container.innerHTML = '';
  if (!entries.length) {
    container.innerHTML = `<div class="tree-msg" style="padding-left:${12 + depth * 14}px">Empty</div>`;
    return;
  }
  const frag = document.createDocumentFragment();
  for (const e of entries) {
    const node = makeNode(e);
    node.querySelector('.node-row').style.paddingLeft = 8 + depth * 14 + 'px';
    node.dataset.depth = depth;
    frag.appendChild(node);
  }
  container.appendChild(frag);
  applyFilter();
}

async function toggleDir(node, forceOpen) {
  const open = forceOpen ?? !node.classList.contains('open');
  node.classList.toggle('open', open);
  node.querySelector('.node-icon').textContent = open ? '📂' : '📁';
  const children = node.querySelector('.node-children');
  if (open && !node.dataset.loaded) {
    node.dataset.loaded = '1';
    await fillChildren(children, node.dataset.path, Number(node.dataset.depth) + 1);
  }
}

async function setRoot(dirPath) {
  state.root = dirPath;
  setSetting('lastFolder', dirPath);
  el.currentPath.textContent = dirPath;
  el.currentPath.title = dirPath;
  el.filter.value = '';
  await fillChildren(el.tree, dirPath, 0);
}

async function refreshTree() {
  if (!state.root) return;
  const openDirs = [...el.tree.querySelectorAll('.node.open')].map((n) => n.dataset.path);
  await fillChildren(el.tree, state.root, 0);
  for (const p of openDirs) {
    const node = findNode(p);
    if (node) await toggleDir(node, true);
  }
}

function findNode(p) {
  return [...el.tree.querySelectorAll('.node')].find((n) => n.dataset.path === p);
}

// Expand the tree down to `filePath` and highlight it.
async function revealInTree(filePath) {
  if (!state.root || !isInside(filePath, state.root)) return;
  const rel = filePath.slice(state.root.length).split(/[\\/]/).filter(Boolean);
  let cur = state.root;
  for (let i = 0; i < rel.length - 1; i++) {
    cur = cur.endsWith(sep()) ? cur + rel[i] : cur + sep() + rel[i];
    const node = findNode(cur);
    if (!node) return;
    await toggleDir(node, true);
  }
  markActive(filePath);
  const node = findNode(filePath);
  if (node) node.querySelector('.node-row').scrollIntoView({ block: 'nearest' });
}

function markActive(filePath) {
  el.tree.querySelectorAll('.node-row.active').forEach((r) => r.classList.remove('active'));
  const node = findNode(filePath);
  if (node) node.querySelector('.node-row').classList.add('active');
}

function applyFilter() {
  const q = el.filter.value.trim().toLowerCase();
  const walk = (container) => {
    let any = false;
    for (const node of container.children) {
      if (!node.classList.contains('node')) continue;
      const name = node.querySelector('.node-name').textContent.toLowerCase();
      let match = !q || name.includes(q);
      if (node.dataset.dir) {
        const childMatch = walk(node.querySelector('.node-children'));
        match = match || childMatch;
      }
      node.style.display = match ? '' : 'none';
      any = any || match;
    }
    return any;
  };
  walk(el.tree);
}

el.tree.addEventListener('click', async (e) => {
  const row = e.target.closest('.node-row');
  if (!row) return;
  const node = row.parentElement;
  setFocused(row);
  if (node.dataset.dir) await toggleDir(node);
  else openFile(node.dataset.path);
});

el.tree.addEventListener('dblclick', (e) => {
  const row = e.target.closest('.node-row');
  if (row && row.parentElement.dataset.dir) setRoot(row.parentElement.dataset.path);
});

// Keyboard navigation in the tree.
function visibleRows() {
  return [...el.tree.querySelectorAll('.node-row')].filter((r) => r.offsetParent !== null);
}
function setFocused(row) {
  el.tree.querySelectorAll('.node-row.focused').forEach((r) => r.classList.remove('focused'));
  if (row) {
    row.classList.add('focused');
    row.scrollIntoView({ block: 'nearest' });
  }
}
el.tree.addEventListener('keydown', async (e) => {
  const rows = visibleRows();
  if (!rows.length) return;
  let row = el.tree.querySelector('.node-row.focused') || el.tree.querySelector('.node-row.active') || rows[0];
  let i = rows.indexOf(row);
  const node = row.parentElement;
  switch (e.key) {
    case 'ArrowDown':
      setFocused(rows[Math.min(i + 1, rows.length - 1)]);
      break;
    case 'ArrowUp':
      setFocused(rows[Math.max(i - 1, 0)]);
      break;
    case 'ArrowRight':
      if (node.dataset.dir) await toggleDir(node, true);
      break;
    case 'ArrowLeft':
      if (node.dataset.dir && node.classList.contains('open')) await toggleDir(node, false);
      else {
        const parent = node.parentElement.closest('.node');
        if (parent) setFocused(parent.querySelector('.node-row'));
      }
      break;
    case 'Enter':
      if (node.dataset.dir) await toggleDir(node);
      else openFile(node.dataset.path);
      break;
    default:
      return;
  }
  e.preventDefault();
});

el.filter.addEventListener('input', applyFilter);

el.showAll.addEventListener('change', () => {
  setSetting('showAllFiles', el.showAll.checked);
  refreshTree();
});

el.roots.addEventListener('change', () => {
  if (el.roots.value) setRoot(el.roots.value);
  el.roots.selectedIndex = 0;
});

$('#btn-up').addEventListener('click', async () => {
  if (!state.root) return;
  const parent = await api.parentDir(state.root);
  if (parent) setRoot(parent);
});
$('#btn-refresh').addEventListener('click', refreshTree);

async function loadRoots() {
  const roots = await api.roots();
  el.roots.innerHTML =
    '<option value="">Go to location…</option>' +
    roots.map((r) => `<option value="${escapeHtml(r.path)}">${escapeHtml(r.name)}</option>`).join('');
}

// ---- Sidebar resize/toggle ---------------------------------------------------

function setSidebarVisible(v) {
  setSetting('sidebarVisible', v);
  document.body.classList.toggle('sidebar-hidden', !v);
  $('#btn-toggle-sidebar').classList.toggle('active', v);
}

(() => {
  const resizer = $('#resizer');
  let startX, startW;
  const move = (e) => {
    const w = Math.max(180, Math.min(window.innerWidth * 0.6, startW + e.clientX - startX));
    document.documentElement.style.setProperty('--sidebar-width', w + 'px');
    state.settings.sidebarWidth = Math.round(w);
  };
  const up = () => {
    resizer.classList.remove('dragging');
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    document.body.style.cursor = '';
    setSetting('sidebarWidth', state.settings.sidebarWidth);
  };
  resizer.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    startW = $('#sidebar').getBoundingClientRect().width;
    resizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    e.preventDefault();
  });
})();

// ---- Document rendering -------------------------------------------------------

function showWelcome() {
  el.content.className = 'markdown-body empty';
  el.content.innerHTML = `
    <h1>MD Explorer</h1>
    <p>Open a folder to browse its Markdown files, or open a single file.</p>
    <p><kbd>${api.platform === 'darwin' ? '⌘' : 'Ctrl'}</kbd> + <kbd>O</kbd> open file ·
       <kbd>${api.platform === 'darwin' ? '⌘' : 'Ctrl'}</kbd> + <kbd>Shift</kbd> + <kbd>O</kbd> open folder</p>
    <p>You can also drag files or folders onto this window.</p>`;
  el.docTitle.textContent = '';
  el.statusPath.textContent = '';
  el.statusInfo.textContent = '';
  el.toc.innerHTML = '';
}

async function openFile(filePath, { hash, keepScroll } = {}) {
  const scroll = el.contentWrap.scrollTop;
  let result;
  try {
    result = await api.render(filePath);
  } catch (err) {
    el.content.className = 'markdown-body';
    el.content.innerHTML = `<div class="error-box"><strong>Could not open file</strong><br>${escapeHtml(filePath)}<br><small>${escapeHtml(
      err.message
    )}</small></div>`;
    return;
  }

  const switching = state.currentFile !== filePath;
  state.currentFile = filePath;
  setSetting('lastFile', filePath);

  el.content.className = 'markdown-body';
  el.content.innerHTML = result.html;
  el.docTitle.textContent = result.title;
  document.title = `${result.title} — MD Explorer`;
  el.statusPath.textContent = filePath;
  el.statusInfo.textContent = `${result.words.toLocaleString()} words · ~${Math.max(1, Math.round(result.words / 230))} min read`;
  buildToc(result.toc);

  if (keepScroll && !switching) el.contentWrap.scrollTop = scroll;
  else if (hash) scrollToAnchor(hash);
  else el.contentWrap.scrollTop = 0;

  if (switching) {
    api.watch(filePath);
    if (!state.root || !isInside(filePath, state.root)) await setRoot(dirname(filePath));
    await revealInTree(filePath);
  }
  if (!$('#find-bar').hidden) runFind();
}

function buildToc(toc) {
  el.toc.innerHTML = toc.length
    ? toc.map((h) => `<a href="#${escapeHtml(h.id || '')}" class="l${h.level}">${escapeHtml(h.text)}</a>`).join('')
    : '<div class="tree-msg">No headings</div>';
}

function scrollToAnchor(id) {
  let decoded = id;
  try {
    decoded = decodeURIComponent(id);
  } catch {}
  const target = document.getElementById(id) || document.getElementById(decoded) || document.getElementById(encodeURIComponent(decoded));
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function fileUrlToPath(href) {
  const url = new URL(href);
  let p = decodeURIComponent(url.pathname);
  if (api.platform === 'win32') {
    p = p.replace(/^\/([A-Za-z]:)/, '$1').replace(/\//g, '\\');
    if (url.host) p = `\\\\${url.host}${p}`; // UNC path
  }
  return { path: p, hash: url.hash ? url.hash.slice(1) : null };
}

el.content.addEventListener('click', (e) => {
  const copy = e.target.closest('.copy-btn');
  if (copy) {
    const code = copy.parentElement.querySelector('code');
    navigator.clipboard.writeText(code.innerText);
    copy.textContent = 'Copied!';
    setTimeout(() => (copy.textContent = 'Copy'), 1200);
    return;
  }

  const a = e.target.closest('a[href]');
  if (!a) return;
  e.preventDefault();
  const href = a.getAttribute('href');
  if (href.startsWith('#')) return scrollToAnchor(href.slice(1));
  if (/^(https?|mailto):/i.test(href)) return api.openExternal(href);
  if (href.startsWith('file:')) {
    const { path, hash } = fileUrlToPath(href);
    if (MD_RE.test(path)) openFile(path, { hash });
    else api.openPath(path);
  }
});

el.toc.addEventListener('click', (e) => {
  const a = e.target.closest('a');
  if (!a) return;
  e.preventDefault();
  scrollToAnchor(a.getAttribute('href').slice(1));
});

// Task-list checkboxes are rendered disabled; also block clicks on any stray inputs.
el.content.addEventListener('change', (e) => e.preventDefault());

api.onFileChanged((p) => {
  if (p === state.currentFile) openFile(p, { keepScroll: true });
});

// ---- Find in page -------------------------------------------------------------

const find = { hits: [], index: -1 };

function clearFind() {
  for (const m of el.content.querySelectorAll('mark.find-hit')) {
    m.replaceWith(document.createTextNode(m.textContent));
  }
  el.content.normalize();
  find.hits = [];
  find.index = -1;
}

function runFind() {
  clearFind();
  const q = $('#find-input').value;
  if (!q) {
    $('#find-count').textContent = '';
    return;
  }
  const needle = q.toLowerCase();
  const walker = document.createTreeWalker(el.content, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  for (const node of textNodes) {
    const text = node.nodeValue;
    const lower = text.toLowerCase();
    let idx = lower.indexOf(needle);
    if (idx < 0) continue;
    const frag = document.createDocumentFragment();
    let last = 0;
    while (idx >= 0) {
      frag.appendChild(document.createTextNode(text.slice(last, idx)));
      const mark = document.createElement('mark');
      mark.className = 'find-hit';
      mark.textContent = text.slice(idx, idx + q.length);
      frag.appendChild(mark);
      find.hits.push(mark);
      last = idx + q.length;
      idx = lower.indexOf(needle, last);
    }
    frag.appendChild(document.createTextNode(text.slice(last)));
    node.replaceWith(frag);
  }
  stepFind(1);
}

function stepFind(dir) {
  if (!find.hits.length) {
    $('#find-count').textContent = 'No results';
    return;
  }
  if (find.index >= 0) find.hits[find.index].classList.remove('current');
  find.index = (find.index + dir + find.hits.length) % find.hits.length;
  const hit = find.hits[find.index];
  hit.classList.add('current');
  hit.scrollIntoView({ block: 'center' });
  $('#find-count').textContent = `${find.index + 1} / ${find.hits.length}`;
}

function openFind() {
  $('#find-bar').hidden = false;
  $('#find-input').focus();
  $('#find-input').select();
}
function closeFind() {
  $('#find-bar').hidden = true;
  clearFind();
}

$('#find-input').addEventListener('input', runFind);
$('#find-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') stepFind(e.shiftKey ? -1 : 1);
  if (e.key === 'Escape') closeFind();
});
$('#find-next').addEventListener('click', () => stepFind(1));
$('#find-prev').addEventListener('click', () => stepFind(-1));
$('#find-close').addEventListener('click', closeFind);

// ---- Toolbar, settings, menu ------------------------------------------------------

async function openFolderDialog() {
  const dir = await api.openFolderDialog();
  if (dir) setRoot(dir);
}
async function openFileDialog() {
  const f = await api.openFileDialog();
  if (f) openFile(f);
}

async function openAnyPath(p) {
  const s = await api.stat(p);
  if (!s.exists) return;
  if (s.isDir) await setRoot(p);
  else await openFile(p);
}

function toggleSettings(show) {
  el.settingsOverlay.hidden = !(show ?? el.settingsOverlay.hidden);
}

function changeFontSize(delta) {
  const size = Math.max(12, Math.min(24, state.settings.fontSize + delta));
  setSetting('fontSize', size);
  el.fontSize.value = size;
  applyTypography();
}

$('#btn-open-folder').addEventListener('click', openFolderDialog);
$('#btn-open-file').addEventListener('click', openFileDialog);
$('#btn-toggle-sidebar').addEventListener('click', () => setSidebarVisible(!state.settings.sidebarVisible));
$('#btn-settings').addEventListener('click', () => toggleSettings(true));
$('#settings-close').addEventListener('click', () => toggleSettings(false));
el.settingsOverlay.addEventListener('click', (e) => {
  if (e.target === el.settingsOverlay) toggleSettings(false);
});
$('#btn-toc').addEventListener('click', () => {
  el.toc.hidden = !el.toc.hidden;
  $('#btn-toc').classList.toggle('active', !el.toc.hidden);
});

el.themeQuick.addEventListener('change', () => {
  setSetting('theme', el.themeQuick.value);
  applyTheme();
});
el.codeThemeSelect.addEventListener('change', () => {
  setSetting('codeTheme', el.codeThemeSelect.value);
  applyTheme();
});
el.fontSelect.addEventListener('change', () => {
  setSetting('fontFamily', el.fontSelect.value);
  applyTypography();
});
el.fontSize.addEventListener('input', () => {
  setSetting('fontSize', Number(el.fontSize.value));
  applyTypography();
});
el.contentWidth.addEventListener('input', () => {
  setSetting('contentWidth', Number(el.contentWidth.value));
  applyTypography();
});
$('#btn-themes-folder').addEventListener('click', () => api.openThemesFolder());
$('#btn-themes-reload').addEventListener('click', loadCustomThemes);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!el.settingsOverlay.hidden) toggleSettings(false);
    else if (!el.toc.hidden) $('#btn-toc').click();
  }
});

api.onMenu((action) => {
  switch (action) {
    case 'open-file': return openFileDialog();
    case 'open-folder': return openFolderDialog();
    case 'reload': return state.currentFile && openFile(state.currentFile, { keepScroll: true });
    case 'reveal': return state.currentFile && api.reveal(state.currentFile);
    case 'toggle-sidebar': return setSidebarVisible(!state.settings.sidebarVisible);
    case 'settings': return toggleSettings();
    case 'font-up': return changeFontSize(1);
    case 'font-down': return changeFontSize(-1);
    case 'find': return openFind();
  }
});

api.onOpenPath(openAnyPath);

// Drag & drop files/folders onto the window.
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) openAnyPath(api.getPathForFile(file));
});

// ---- Startup --------------------------------------------------------------------

(async function init() {
  state.settings = await api.getSettings();
  state.codeThemes = await api.codeThemes();
  state.customThemes = await api.customThemes();

  el.showAll.checked = state.settings.showAllFiles;
  el.fontSelect.value = state.settings.fontFamily;
  el.fontSize.value = state.settings.fontSize;
  el.contentWidth.value = state.settings.contentWidth;
  setSidebarVisible(state.settings.sidebarVisible);
  applyTypography();
  populateThemeControls();
  await applyTheme();
  await loadRoots();

  const pending = await api.consumePendingPath();
  const { lastFolder, lastFile } = state.settings;
  showWelcome();

  if (pending) {
    await openAnyPath(pending);
  } else {
    if (lastFolder && (await api.stat(lastFolder)).isDir) await setRoot(lastFolder);
    if (lastFile && (await api.stat(lastFile)).exists) await openFile(lastFile);
  }
})();
