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
    /* اجرای واقعی فرمان‌ها — فقط شناسه‌های فهرست سفید در main.js */
    run: (id, arg) => ipcRenderer.invoke('sys:run', id, arg),
    /* باز کردن لینک خارجی در مرورگر پیش‌فرض (فقط https) */
    openUrl: (u) => ipcRenderer.invoke('sys:open-url', u),
    /* ذخیره فایل ضبط صدا در Music/AVA */
    saveAudio: (buf) => ipcRenderer.invoke('sys:save-audio', buf),
    /* نسخه واقعی برنامه */
    info: () => ipcRenderer.invoke('app:info'),
  },

  /* تنظیمات سیستمی برنامه */
  settings: {
    flags: () => ipcRenderer.invoke('app:flags'),
    setAlwaysOnTop: (on) => ipcRenderer.invoke('app:set-always-on-top', on),
    setLoginItem: (on) => ipcRenderer.invoke('app:set-login-item', on),
  },

  /* به‌روزرسان خودکار (electron-updater) */
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    install: () => ipcRenderer.invoke('updater:install'),
    setAuto: (on) => ipcRenderer.invoke('updater:set-auto', on),
    onStatus: (cb) => ipcRenderer.on('updater:status', (_e, s) => cb(s)),
  },

  /* رویدادهای صوتی — نقطه اتصال موتور صوتی در نسخه‌های بعد */
  voice: {
    onToggleListen: (cb) => ipcRenderer.on('ava:toggle-listen', () => cb()),
  },
});
