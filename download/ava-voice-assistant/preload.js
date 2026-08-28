/**
 * آوا — preload bridge
 * ارتباط امن بین رندرر (UI) و پروسه اصلی الکترون.
 * در مرورگر (پیش‌نمایش وب) این آبجکت وجود ندارد و UI به حالت شبیه‌سازی می‌رود.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ava', {
  isElectron: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
  },

  /* کنترل پنجره (نوار عنوان سفارشی) */
  window: {
    minimize: () => ipcRenderer.invoke('win:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('win:toggle-maximize'),
    close: () => ipcRenderer.invoke('win:close'),
    isMaximized: () => ipcRenderer.invoke('win:is-maximized'),
    onMaximizeChange: (cb) => ipcRenderer.on('win:maximized-changed', (_e, v) => cb(v)),
  },

  /* آمار سیستم (CPU / RAM / آپ‌تایم) */
  system: {
    stats: () => ipcRenderer.invoke('sys:stats'),
  },

  /* رویدادهای صوتی — نقطه اتصال موتور صوتی در نسخه‌های بعد */
  voice: {
    onToggleListen: (cb) => ipcRenderer.on('ava:toggle-listen', () => cb()),
  },
});
