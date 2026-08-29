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
    /* آب‌وهوا از Open-Meteo (بدون کلید) */
    weather: (city) => ipcRenderer.invoke('sys:weather', city),
    /* تایپ متن در برنامه فعال — حالت تایپ صوتی با خروجی پیست (Ctrl+V) */
    typeText: (text) => ipcRenderer.invoke('sys:type-text', text),
  },

  /* مدیریت DNS ویندوز (اعمال با تأیید مدیر/UAC) + پنجره کوچک «DNS جدید» */
  dns: {
    interfaces: () => ipcRenderer.invoke('dns:interfaces'),
    current: () => ipcRenderer.invoke('dns:current'),
    apply: (p) => ipcRenderer.invoke('dns:apply', p),
    reset: () => ipcRenderer.invoke('dns:reset'),
    quickOpen: () => ipcRenderer.invoke('dns:quick-open'),
    quickSave: (p) => ipcRenderer.invoke('dns:quick-save', p),
    quickClose: () => ipcRenderer.invoke('dns:quick-close'),
    onProfilesUpdated: (cb) => ipcRenderer.on('dns:profiles-updated', (_e, list) => cb(list)),
  },

  /* تنظیمات سیستمی برنامه + ماندگاری تنظیمات در فایل */
  settings: {
    flags: () => ipcRenderer.invoke('app:flags'),
    setAlwaysOnTop: (on) => ipcRenderer.invoke('app:set-always-on-top', on),
    setLoginItem: (on) => ipcRenderer.invoke('app:set-login-item', on),
    load: () => ipcRenderer.invoke('settings:load'),
    save: (obj) => ipcRenderer.invoke('settings:save', obj),
  },

  /* به‌روزرسان خودکار (electron-updater) */
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    install: () => ipcRenderer.invoke('updater:install'),
    setAuto: (on) => ipcRenderer.invoke('updater:set-auto', on),
    onStatus: (cb) => ipcRenderer.on('updater:status', (_e, s) => cb(s)),
  },

  /* هوش مصنوعی GLM (چت) — کلید از تنظیمات رندرر می‌آید ولی درخواست از پروسه اصلی */
  ai: {
    chat: (payload) => ipcRenderer.invoke('ai:chat', payload),
    /* چت بدون کلید API — با توکن نشست حساب z.ai کاربر (از webview) */
    zaiChat: (payload) => ipcRenderer.invoke('ai:zaiChat', payload),
  },

  /* تشخیص گفتار: GLM-ASR (کلید‌دار) + موتور رایگان گوگل (بدون کلید) */
  stt: {
    transcribe: (payload) => ipcRenderer.invoke('stt:transcribe', payload),
    google: (payload) => ipcRenderer.invoke('stt:google', payload),
  },

  /* فرمان‌های سفارشی پیشنهاد هوش مصنوعی — اجرا فقط پس از تأیید کاربر در UI */
  custom: {
    run: (script) => ipcRenderer.invoke('custom:run', script),
  },

  /* رویدادهای صوتی — میانبرهای سراسری */
  voice: {
    onToggleListen: (cb) => ipcRenderer.on('ava:toggle-listen', () => cb()),
    onToggleHandsFree: (cb) => ipcRenderer.on('ava:toggle-handsfree', () => cb()),
  },
});
