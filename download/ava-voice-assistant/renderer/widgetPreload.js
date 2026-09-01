'use strict';
/* preload سبک ویجت شناور — فقط دو پل امن */
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('AVAWidget', {
  onUpdate: (cb) => ipcRenderer.on('widget:update', (_e, p) => { try { cb(p); } catch (_) { /* noop */ } }),
  openMain: () => ipcRenderer.send('widget:open-main'),
});
