'use strict';
/* preload ویجت شناور — v0.56 — پل‌های امن (بدون nodeIntegration) */
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('AVAWidget', {
  onUpdate: (cb) => ipcRenderer.on('widget:update', (_e, p) => { try { cb(p); } catch (_) { /* noop */ } }),
  onLook: (cb) => ipcRenderer.on('widget:look', (_e, p) => { try { cb(p); } catch (_) { /* noop */ } }),
  openMain: () => ipcRenderer.send('widget:open-main'),
  menu: () => ipcRenderer.send('widget:menu'),
  act: (name) => ipcRenderer.send('widget:act', { name: String(name || '').slice(0, 24) }),
});
