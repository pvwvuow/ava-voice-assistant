'use strict';
/**
 * آوا — پل امن پنجرهٔ PiP (v0.37)
 * فقط همین چند تابع کوچک در اختیار صفحهٔ pip.html قرار می‌گیرد؛
 * contextIsolation روشن و nodeIntegration خاموش است.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pipHost', {
  /* صفحهٔ PiP اعلام می‌کند بالا آمده → وضعیت + منبع ویدیو برمی‌گردد */
  ready: () => ipcRenderer.send('pip:host:ready'),
  /* دکمهٔ بستن */
  close: () => ipcRenderer.send('pip:host:close'),
  /* hover روی نوار کنترل — وقتی click-through است فقط همین نوار کلیک‌پذیر می‌ماند */
  hoverUi: (on) => ipcRenderer.send('pip:host:hover-ui', !!on),
  /* درگ دستی — شروع/پایان (حلقهٔ حرکت در پروسهٔ اصلی با مختصات واقعی ماوس) */
  dragStart: () => ipcRenderer.send('pip:host:drag-start'),
  dragEnd: () => ipcRenderer.send('pip:host:drag-end'),
  /* دکمه‌های کنترل: close | clickthrough | opacity | size */
  ctl: (type) => ipcRenderer.send('pip:host:ctl', String(type || '')),
  /* منبع ویدیو از پروسهٔ اصلی */
  onSource: (cb) => ipcRenderer.on('pip:source', (_e, s) => cb(s)),
  /* تغییر وضعیت (شفافیت/قفل/اندازه از صدا یا میانبر) */
  onState: (cb) => ipcRenderer.on('pip:state', (_e, s) => cb(s)),
});
