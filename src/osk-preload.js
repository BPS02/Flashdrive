const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('osk', {
  onFocus: (cb) => ipcRenderer.on('osk:focus', (_e, row, col) => cb(row, col)),
});
