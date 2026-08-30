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
    /* کپی متن در کلیپ‌بورد ویندوز (گزارش خطاها) */
    copyText: (t) => ipcRenderer.invoke('sys:copy-text', t),
    /* ذخیره فایل ضبط صدا در Music/AVA */
    saveAudio: (buf) => ipcRenderer.invoke('sys:save-audio', buf),
    /* نسخه واقعی برنامه */
    info: () => ipcRenderer.invoke('app:info'),
    /* آب‌وهوا از Open-Meteo (بدون کلید) */
    weather: (city) => ipcRenderer.invoke('sys:weather', city),
    /* تایپ متن در برنامه فعال — حالت تایپ صوتی با خروجی پیست (Ctrl+V) */
    typeText: (text) => ipcRenderer.invoke('sys:type-text', text),
  },

  /* مدیریت DNS ویندوز (اعمال با تأیید مدیر/UAC)
     فرم «DNS جدید» حالا داخل خود صفحه اصلی است — رویداد dns:quick-request
     از پروسه اصلی به رندرر می‌آید */
  dns: {
    interfaces: () => ipcRenderer.invoke('dns:interfaces'),
    current: () => ipcRenderer.invoke('dns:current'),
    apply: (p) => ipcRenderer.invoke('dns:apply', p),
    reset: () => ipcRenderer.invoke('dns:reset'),
    /* پینگ DNSها (v0.13) — «آوا پینگ dns هامو نشون بده» */
    ping: (list) => ipcRenderer.invoke('dns:ping', list),
    quickOpen: () => ipcRenderer.invoke('dns:quick-open'),
    onQuickRequest: (cb) => ipcRenderer.on('dns:quick-request', () => cb()),
  },

  /* تنظیمات سیستمی برنامه + ماندگاری تنظیمات در فایل */
  settings: {
    flags: () => ipcRenderer.invoke('app:flags'),
    setAlwaysOnTop: (on) => ipcRenderer.invoke('app:set-always-on-top', on),
    setLoginItem: (on) => ipcRenderer.invoke('app:set-login-item', on),
    load: () => ipcRenderer.invoke('settings:load'),
    save: (obj) => ipcRenderer.invoke('settings:save', obj),
  },

  /* به‌روزرسان خودکار (electron-updater + دانلود مستقیم پشتیبان) */
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    install: () => ipcRenderer.invoke('updater:install'),
    setAuto: (on) => ipcRenderer.invoke('updater:set-auto', on),
    downloadManual: () => ipcRenderer.invoke('updater:download-manual'),
    /* v0.21 — دانلود به اختیار کاربر + توقف/لغو */
    download: () => ipcRenderer.invoke('updater:download'),
    cancel: (pause) => ipcRenderer.invoke('updater:cancel', pause),
    onStatus: (cb) => ipcRenderer.on('updater:status', (_e, s) => cb(s)),
  },

  /* هوش مصنوعی GLM (چت) — کلید از تنظیمات رندرر می‌آید ولی درخواست از پروسه اصلی */
  ai: {
    chat: (payload) => ipcRenderer.invoke('ai:chat', payload),
    /* چت بدون کلید API — با توکن نشست حساب z.ai کاربر (از webview) */
    zaiChat: (payload) => ipcRenderer.invoke('ai:zaiChat', payload),
    /* پرووایدرهای دیگر (v0.11): Gemini (با سرچ گوگل) و OpenAI — v0.12: چرخش چندکلیدی */
    gemini: (payload) => ipcRenderer.invoke('ai:gemini', payload),
    openai: (payload) => ipcRenderer.invoke('ai:openai', payload),
  },

  /* اسکنر برنامه‌های نصب‌شده (v0.12) — Start Menu + بازی‌های Steam
     «کروم رو باز کن» → دیکشنری فونتیک + فازی → اجرای واقعی .exe */
  apps: {
    list: () => ipcRenderer.invoke('apps:list'),
    scan: () => ipcRenderer.invoke('apps:scan'),
    launch: (app) => ipcRenderer.invoke('apps:launch', app),
  },

  /* افزونهٔ کنترل دیسکورد (v0.16) */
  discord: {
    cmd: (p) => ipcRenderer.invoke('discord:cmd', p),
  },

  /* پلیر موزیک ماندگار (v0.22) — انتخاب پوشه با دیالوگ ویندوز، اسکن فایل‌سیستم
     در پروسهٔ اصلی، خواندن هدر فایل برای تگ‌های ID3 (عنوان/خواننده/کاور) */
  music: {
    pickDirs: () => ipcRenderer.invoke('music:pickDirs'),
    scan: (dirs) => ipcRenderer.invoke('music:scan', dirs),
    readHead: (path, max) => ipcRenderer.invoke('music:readHead', path, max),
  },

  /* یادآوری‌ها (v0.12) — تیک پس‌زمینه در پروسه اصلی؛ رویداد due به رندرر می‌آید */
  reminders: {
    add: (p) => ipcRenderer.invoke('reminders:add', p),
    list: () => ipcRenderer.invoke('reminders:list'),
    remove: (id) => ipcRenderer.invoke('reminders:remove', id),
    clear: () => ipcRenderer.invoke('reminders:clear'),
    onDue: (cb) => ipcRenderer.on('reminders:due', (_e, r) => cb(r)),
  },

  /* صدای گوینده (TTS) — صدای زن گوگل برای فارسی (v0.11) */
  tts: {
    google: (payload) => ipcRenderer.invoke('tts:google', payload),
  },

  /* تشخیص گفتار: GLM-ASR (کلید‌دار) + موتور رایگان گوگل (بدون کلید)
     v0.17: موتورهای کلاس AI — جمنای (با کلید جمنای خودت) و Whisper سازگار
     با OpenAI (Groq/OpenAI/سرور محلی) — همان الگوی سایت‌های تایپ صوتی حرفه‌ای */
  stt: {
    transcribe: (payload) => ipcRenderer.invoke('stt:transcribe', payload),
    google: (payload) => ipcRenderer.invoke('stt:google', payload),
    gemini: (payload) => ipcRenderer.invoke('stt:gemini', payload),
    whisper: (payload) => ipcRenderer.invoke('stt:whisper', payload),
  },

  /* لاگ عملکرد (v0.18) — ثبت واکنش‌های برنامه در userData/logs/activity.log
     log.get برای ارسال گزارش به گیت‌هاب (فرمان صوتی «گزارش بفرست») */
  log: {
    act: (msg) => ipcRenderer.invoke('log:act', msg),
    get: () => ipcRenderer.invoke('log:get'),
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
