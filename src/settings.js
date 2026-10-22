const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  theme: 'github-light',
  codeTheme: 'auto', // follow the UI theme's light/dark flavour
  fontFamily: 'system',
  fontSize: 16,
  contentWidth: 860,
  showAllFiles: false,
  sidebarWidth: 280,
  sidebarVisible: true,
  lastFolder: null,
  lastFile: null,
  windowBounds: null,
};

let file = null;
let data = { ...DEFAULTS };
let saveTimer = null;

function load(userDataDir) {
  file = path.join(userDataDir, 'settings.json');
  try {
    data = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    data = { ...DEFAULTS };
  }
}

function save() {
  if (!file) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  }, 200);
}

module.exports = {
  load,
  get: (key) => data[key],
  getAll: () => ({ ...data }),
  set(key, value) {
    data[key] = value;
    save();
  },
};
