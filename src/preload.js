const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('flashdrive', {
  mouseMoveBy: (dx, dy) => ipcRenderer.invoke('mouse:move-by', dx, dy),
  mouseClick: (which) => ipcRenderer.invoke('mouse:click', which),
  mousePress: (which) => ipcRenderer.invoke('mouse:press', which),
  mouseRelease: (which) => ipcRenderer.invoke('mouse:release', which),
  mouseScroll: (direction, amount) => ipcRenderer.invoke('mouse:scroll', direction, amount),
  keysHold: (names) => ipcRenderer.invoke('keys:hold', names),
  keysRelease: (names) => ipcRenderer.invoke('keys:release', names),
  keysTap: (names) => ipcRenderer.invoke('keys:tap', names),
  oskToggle: () => ipcRenderer.invoke('osk:toggle'),
  oskFocus: (row, col) => ipcRenderer.invoke('osk:focus', row, col),
  oskTypeChar: (char) => ipcRenderer.invoke('osk:type-char', char),
});
