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
    /* v0.31.0 — مختصات شهر از دیکشنری آفلاین (برای محاسبهٔ محلی اوقات شرعی) */
    geo: (city) => ipcRenderer.invoke('sys:geo', city),
    /* v0.31.0 — قیمت لحظه‌ای ارز/طلا/سکه/رمزارز (tgju، بدون کلید) */
    rates: () => ipcRenderer.invoke('sys:rates'),
    /* v0.34 — تایپ صوتی در هر برنامهٔ ویندوز:
       saveFg = ثبت پنجرهٔ فعال در لحظهٔ شروع؛ typeText = تایپ SendInput UNICODE
       در همان پنجره با فوکوس تاییدشده (مستقل از layout کیبورد، بدون دست‌زدن به
       کلیپ‌بورد — قبلی پیست Ctrl+V بود و در پنجرهٔ اشتباه می‌نشست) */
    saveFg: () => ipcRenderer.invoke('sys:savefg'),
    typeText: (text, hwnd) => ipcRenderer.invoke('sys:typeText', { text, hwnd }),
    /* v0.61 — خواندن کلیپ‌بورد (جایگزین pip:clip پس از حذف پنجرهٔ شناور) */
    clipboard: () => ipcRenderer.invoke('sys:clipboard'),
    /* v0.35 — بیدارباش در مینیمایز/بازی: جلوگیری از suspend شدن اپ تا حلقهٔ
       «آوا» حتی وقتی پنجره مخفی است یا کاربر در بازی است زنده بماند */
    wakePsb: (on) => ipcRenderer.invoke('wake:psb', !!on),
  },

  /* v0.31.0 — یادداشت‌های صوتی (ava-notes.json در پوشهٔ خود برنامه) */
  notes: {
    load: () => ipcRenderer.invoke('notes:load'),
    save: (arr) => ipcRenderer.invoke('notes:save', arr),
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
    /* v0.47 B13 — اعلان شکست ثبت میانبرهای سراسری */
    onShortcutFailed: (cb) => ipcRenderer.on('ava:shortcut-failed', (_e, p) => cb(p)),
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
    /* v0.29 — تست اتصال جمنای از تنظیمات (درخواست واقعی کوچک + خطای فارسی دقیق) */
    gemTest: (payload) => ipcRenderer.invoke('ai:gemtest', payload),
    /* v0.39 — فهرست کامل مدل‌های چتِ جمنای برای انتخابگر تنظیمات */
    gemModels: (payload) => ipcRenderer.invoke('ai:gemmodels', payload),
    openai: (payload) => ipcRenderer.invoke('ai:openai', payload),
    /* v0.51 — فاز تحقیق: وب‌گردی واقعی (DuckDuckGo) برای دور دوم AI */
    research: (q) => ipcRenderer.invoke('ai:research', q),
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
    ack: (id) => ipcRenderer.invoke('reminders:ack', id), /* v0.47 B01 */
  },

  /* v0.47 — حافظهٔ یادگیری آوا (SELF-LEARNING) */
  learnings: {
    load: () => ipcRenderer.invoke('learnings:load'),
    save: (data) => ipcRenderer.invoke('learnings:save', data),
  },

  /* صدای گوینده (TTS) — v0.42: موتور عصبی مایکروسافت اِج (رایگان) + گوگل */
  tts: {
    google: (payload) => ipcRenderer.invoke('tts:google', payload),
    edge: (payload) => ipcRenderer.invoke('tts:edge', payload),
  },

  /* v0.43 — مدیای سیستم: وضعیت پخش (SMTC)، پخش‌کنندهٔ یوتیوب آوا، کنترل پلیرها */
  media: {
    /* چی همین حالا در سیستم/مرورگر پخش می‌شود؟ (System Media Transport Controls) */
    now: () => ipcRenderer.invoke('media:now'),
  },
  yt: {
    /* عبارت → ویدیوی یوتیوب (اولین نتیجه) — v0.61: برای پخش با پلیر پیش‌فرض */
    resolve: (query) => ipcRenderer.invoke('yt:resolve', { query }),
  },
  player: {
    scan: () => ipcRenderer.invoke('player:scan'),
    default: () => ipcRenderer.invoke('player:default'), /* v0.61 — پلیر ویدیوی پیش‌فرض کاربر */
    open: (p) => ipcRenderer.invoke('player:open', p),
    ctl: (p) => ipcRenderer.invoke('player:ctl', p),
  },

  /* تشخیص گفتار: GLM-ASR (کلید‌دار) + موتور رایگان گوگل (بدون کلید)
     v0.17: موتورهای کلاس AI — جمنای (با کلید جمنای خودت) و Whisper سازگار
     با OpenAI (Groq/OpenAI/سرور محلی) — همان الگوی سایت‌های تایپ صوتی حرفه‌ای
     v0.27: موتور آفلاین همیشه-کار (sherpa-onnx + Whisper int8) — ۱۰۰٪ داخل ویندوز */
  stt: {
    transcribe: (payload) => ipcRenderer.invoke('stt:transcribe', payload),
    google: (payload) => ipcRenderer.invoke('stt:google', payload),
    gemini: (payload) => ipcRenderer.invoke('stt:gemini', payload),
    whisper: (payload) => ipcRenderer.invoke('stt:whisper', payload),
    local: (payload) => ipcRenderer.invoke('stt:local', payload),
    localStatus: () => ipcRenderer.invoke('stt:local:status'),
    localDownload: () => ipcRenderer.invoke('stt:local:download'),
    onLocalProgress: (cb) => ipcRenderer.on('stt:local:progress', (_e, s) => cb(s)),
  },

  /* لاگ عملکرد (v0.18) — ثبت واکنش‌های برنامه در userData/logs/activity.log
     log.get برای ارسال گزارش به گیت‌هاب (فرمان صوتی «گزارش بفرست»)
     v0.48 — act(msg, extra) لاگ ساخت‌یافته می‌فرستد (JSONL) و logs.* وضعیت/
     ارسال دستی تله‌متری (گیت‌هاب) را در اختیار UI می‌گذارد */
  log: {
    act: (msg, extra) => ipcRenderer.invoke('log:act', msg, extra),
    get: () => ipcRenderer.invoke('log:get'),
  },
  logs: {
    openFolder: () => ipcRenderer.invoke('log:openFolder'),
  },

  /* v0.24 — وضعیت شبکه (سلف‌چک TCP از پروسهٔ اصلی بعد از بوت) */
  net: {
    onStatus: (cb) => ipcRenderer.on('ava:net-status', (_e, s) => cb(s)),
  },

  /* v0.61 — پنجرهٔ ویدیوی شناور حذف شد؛ پخش با پلیر پیش‌فرض کاربر.
     خواندن کلیپ‌بورد («لینک کپی‌کردم رو پخش کن») حالا از sys.clipboard است. */

  /* فرمان‌های سفارشی پیشنهاد هوش مصنوعی — اجرا فقط پس از تأیید کاربر در UI */
  custom: {
    run: (script) => ipcRenderer.invoke('custom:run', script),
  },

  /* رویدادهای صوتی — میانبرهای سراسری */
  voice: {
    onToggleListen: (cb) => ipcRenderer.on('ava:toggle-listen', () => cb()),
    onToggleHandsFree: (cb) => ipcRenderer.on('ava:toggle-handsfree', () => cb()),
    /* v0.51 — Push-to-Talk: پایین‌آوردن/رهاکردن دکمه (hold mode) */
    onPttDown: (cb) => ipcRenderer.on('ava:ptt-down', () => cb()),
    onPttUp: (cb) => ipcRenderer.on('ava:ptt-up', () => cb()),
  },

  /* v0.51 — تنظیمات Push-to-Talk: ثبت دوبارهٔ میانبر سراسری بعد از تغییر */
  ptt: {
    reconfig: () => ipcRenderer.invoke('ptt:reconfig'),
    get: () => ipcRenderer.invoke('ptt:get'),
  },
});
