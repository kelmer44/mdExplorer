const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { renderMarkdown } = require('./markdown');
const settings = require('./settings');

const MD_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkd', '.mdx', '.txt']);

let mainWindow = null;
const watchers = new Map(); // filePath -> fs.FSWatcher
let pendingOpenPath = null; // file/folder requested before the window was ready

function isMarkdown(p) {
  return MD_EXTENSIONS.has(path.extname(p).toLowerCase());
}

function createWindow() {
  const bounds = settings.get('windowBounds') || { width: 1280, height: 820 };
  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 640,
    minHeight: 400,
    title: 'MD Explorer',
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Never let rendered content navigate the app window away.
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:|^mailto:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', () => settings.set('windowBounds', mainWindow.getBounds()));
  mainWindow.on('closed', () => {
    mainWindow = null;
    stopWatching();
  });
}

function send(channel, ...args) {
  if (mainWindow) mainWindow.webContents.send(channel, ...args);
}

function stopWatching(filePath) {
  const paths = filePath ? [filePath] : [...watchers.keys()];
  for (const p of paths) {
    const w = watchers.get(p);
    if (w) {
      w.close();
      watchers.delete(p);
    }
  }
}

// ---- Menu -------------------------------------------------------------------

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Open File…', accelerator: 'CmdOrCtrl+O', click: () => send('menu', 'open-file') },
        { label: 'Open Folder…', accelerator: 'CmdOrCtrl+Shift+O', click: () => send('menu', 'open-folder') },
        { type: 'separator' },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => send('menu', 'close-tab') },
        { label: 'Next Tab', accelerator: 'Ctrl+Tab', click: () => send('menu', 'next-tab') },
        { label: 'Previous Tab', accelerator: 'Ctrl+Shift+Tab', click: () => send('menu', 'prev-tab') },
        { type: 'separator' },
        { label: 'Reload File', accelerator: 'CmdOrCtrl+R', click: () => send('menu', 'reload') },
        { label: 'Reveal in File Manager', click: () => send('menu', 'reveal') },
        { type: 'separator' },
        isMac ? { role: 'close', accelerator: 'CmdOrCtrl+Shift+W' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Explorer', accelerator: 'CmdOrCtrl+B', click: () => send('menu', 'toggle-sidebar') },
        { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => send('menu', 'settings') },
        { type: 'separator' },
        { label: 'Increase Text Size', accelerator: 'CmdOrCtrl+=', click: () => send('menu', 'font-up') },
        { label: 'Decrease Text Size', accelerator: 'CmdOrCtrl+-', click: () => send('menu', 'font-down') },
        { label: 'Find in Page', accelerator: 'CmdOrCtrl+F', click: () => send('menu', 'find') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---- IPC: filesystem --------------------------------------------------------

ipcMain.handle('fs:list', async (_e, dirPath, showAll) => {
  const dirents = await fs.promises.readdir(dirPath, { withFileTypes: true });
  const entries = [];
  for (const d of dirents) {
    if (d.name.startsWith('.') && !showAll) continue;
    const full = path.join(dirPath, d.name);
    let isDir = d.isDirectory();
    if (d.isSymbolicLink()) {
      try {
        isDir = (await fs.promises.stat(full)).isDirectory();
      } catch {
        continue; // broken link
      }
    }
    if (!isDir && !showAll && !isMarkdown(d.name)) continue;
    entries.push({ name: d.name, path: full, isDir });
  }
  entries.sort((a, b) =>
    a.isDir === b.isDir ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) : a.isDir ? -1 : 1
  );
  return entries;
});

ipcMain.handle('fs:roots', async () => {
  const home = os.homedir();
  const roots = [{ name: 'Home', path: home }];
  for (const sub of ['Desktop', 'Documents', 'Downloads']) {
    const p = path.join(home, sub);
    if (fs.existsSync(p)) roots.push({ name: sub, path: p });
  }
  if (process.platform === 'win32') {
    for (let c = 65; c <= 90; c++) {
      const drive = `${String.fromCharCode(c)}:\\`;
      if (fs.existsSync(drive)) roots.push({ name: `Drive ${drive}`, path: drive });
    }
  } else {
    roots.push({ name: 'Computer (/)', path: '/' });
    const mountDir = process.platform === 'darwin' ? '/Volumes' : '/media';
    try {
      for (const v of fs.readdirSync(mountDir)) roots.push({ name: v, path: path.join(mountDir, v) });
    } catch {}
  }
  return roots;
});

ipcMain.handle('fs:parent', (_e, p) => {
  const parent = path.dirname(p);
  return parent === p ? null : parent;
});

ipcMain.handle('fs:stat', async (_e, p) => {
  try {
    const s = await fs.promises.stat(p);
    return { exists: true, isDir: s.isDirectory() };
  } catch {
    return { exists: false, isDir: false };
  }
});

ipcMain.handle('dialog:openFolder', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('dialog:openFile', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'mdx'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  return r.canceled ? null : r.filePaths[0];
});

// ---- IPC: markdown ----------------------------------------------------------

const MAX_RENDER_BYTES = 10 * 1024 * 1024;

ipcMain.handle('md:render', async (_e, filePath) => {
  const { size } = await fs.promises.stat(filePath);
  if (size > MAX_RENDER_BYTES) throw new Error('File is too large to render (over 10 MB)');
  const source = await fs.promises.readFile(filePath, 'utf8');
  return renderMarkdown(source, filePath);
});

ipcMain.handle('md:watch', (_e, filePath) => {
  if (watchers.has(filePath)) return;
  let timer = null;
  try {
    watchers.set(
      filePath,
      fs.watch(filePath, () => {
        // Editors often write files in several steps; debounce.
        clearTimeout(timer);
        timer = setTimeout(() => send('md:changed', filePath), 150);
      })
    );
  } catch {}
});

ipcMain.handle('md:unwatch', (_e, filePath) => stopWatching(filePath));

// ---- IPC: shell -------------------------------------------------------------

ipcMain.handle('shell:openExternal', (_e, url) => {
  if (/^(https?|mailto):/i.test(url)) return shell.openExternal(url);
});
ipcMain.handle('shell:openPath', (_e, p) => shell.openPath(p));
ipcMain.handle('shell:reveal', (_e, p) => shell.showItemInFolder(p));

// ---- IPC: settings & themes -------------------------------------------------

ipcMain.handle('settings:getAll', () => settings.getAll());
ipcMain.handle('settings:set', (_e, key, value) => settings.set(key, value));

function customThemesDir() {
  const dir = path.join(app.getPath('userData'), 'themes');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

ipcMain.handle('themes:custom', async () => {
  const dir = customThemesDir();
  const files = (await fs.promises.readdir(dir)).filter((f) => f.endsWith('.css'));
  return Promise.all(
    files.map(async (f) => ({
      id: 'custom:' + f,
      name: path.basename(f, '.css'),
      css: await fs.promises.readFile(path.join(dir, f), 'utf8'),
    }))
  );
});

ipcMain.handle('themes:openFolder', () => shell.openPath(customThemesDir()));

ipcMain.handle('themes:codeThemes', async () => {
  const dir = path.join(path.dirname(require.resolve('highlight.js/package.json')), 'styles');
  const strip = (f) => f.replace(/\.min\.css$/, '');
  const top = (await fs.promises.readdir(dir)).filter((f) => f.endsWith('.min.css')).map(strip).sort();
  const base16 = (await fs.promises.readdir(path.join(dir, 'base16')))
    .filter((f) => f.endsWith('.min.css'))
    .map((f) => 'base16/' + strip(f))
    .sort();
  return [...top, ...base16];
});

ipcMain.handle('themes:codeThemeCss', async (_e, name) => {
  if (!/^(base16\/)?[\w.-]+$/.test(name)) return '';
  const file = path.join(path.dirname(require.resolve('highlight.js/package.json')), 'styles', `${name}.min.css`);
  try {
    return await fs.promises.readFile(file, 'utf8');
  } catch {
    return '';
  }
});

// ---- Opening files from the OS / command line ------------------------------

function openPathInApp(p) {
  if (!p) return;
  p = path.resolve(p);
  if (mainWindow && mainWindow.webContents.isLoading() === false) send('open-path', p);
  else pendingOpenPath = p;
}

ipcMain.handle('app:consumePendingPath', () => {
  const p = pendingOpenPath;
  pendingOpenPath = null;
  return p;
});

// macOS: double-click a .md file in Finder / drag onto the dock icon.
app.on('open-file', (e, p) => {
  e.preventDefault();
  openPathInApp(p);
});

function pathFromArgv(argv) {
  const args = argv.slice(app.isPackaged ? 1 : 2).filter((a) => !a.startsWith('-'));
  const found = args.find((a) => fs.existsSync(a));
  return found ? path.resolve(found) : null;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    openPathInApp(pathFromArgv(argv));
  });

  app.whenReady().then(() => {
    settings.load(app.getPath('userData'));
    pendingOpenPath = pendingOpenPath || pathFromArgv(process.argv);
    buildMenu();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
