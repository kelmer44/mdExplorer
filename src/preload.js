const { contextBridge, ipcRenderer, webUtils } = require('electron');

const invoke = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
  getPathForFile: (file) => webUtils.getPathForFile(file),
  listDir: invoke('fs:list'),
  roots: invoke('fs:roots'),
  parentDir: invoke('fs:parent'),
  stat: invoke('fs:stat'),
  openFolderDialog: invoke('dialog:openFolder'),
  openFileDialog: invoke('dialog:openFile'),
  render: invoke('md:render'),
  watch: invoke('md:watch'),
  unwatch: invoke('md:unwatch'),
  openExternal: invoke('shell:openExternal'),
  openPath: invoke('shell:openPath'),
  reveal: invoke('shell:reveal'),
  getSettings: invoke('settings:getAll'),
  setSetting: invoke('settings:set'),
  customThemes: invoke('themes:custom'),
  openThemesFolder: invoke('themes:openFolder'),
  codeThemes: invoke('themes:codeThemes'),
  codeThemeCss: invoke('themes:codeThemeCss'),
  consumePendingPath: invoke('app:consumePendingPath'),
  onMenu: (cb) => ipcRenderer.on('menu', (_e, action) => cb(action)),
  onFileChanged: (cb) => ipcRenderer.on('md:changed', (_e, p) => cb(p)),
  onOpenPath: (cb) => ipcRenderer.on('open-path', (_e, p) => cb(p)),
});
