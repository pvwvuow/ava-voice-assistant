/**
 * آوا — دستیار صوتی ویندوز
 * Electron main process (نسخه ۰.۴ — آپدیت خودکار، تنظیمات سیستمی، ضبط صدا)
 */
const { app, BrowserWindow, ipcMain, globalShortcut, session, screen, shell } = require('electron');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/* electron-updater (فقط وقتی پکیج نصب باشد — خطا را ساکت رد می‌کنیم) */
let autoUpdater = null;
try { ({ autoUpdater } = require('electron-updater')); } catch (_) { autoUpdater = null; }

let win = null;

/* ---------- CPU / RAM sampling ---------- */
function cpuSample() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const c of cpus) {
    for (const k of Object.keys(c.times)) total += c.times[k];
    idle += c.times.idle;
  }
  return { idle, total };
}
let prevCpu = cpuSample();

function cpuUsage() {
  const cur = cpuSample();
  const idleD = cur.idle - prevCpu.idle;
  const totalD = cur.total - prevCpu.total;
  prevCpu = cur;
  if (totalD <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - idleD / totalD) * 100)));
}

/* ---------- Window ---------- */
function createWindow() {
  /* پنجره دستیار: حدود یک‌سوم عرض صفحه، باز می‌شود سمت راست دسکتاپ */
  const wa = screen.getPrimaryDisplay().workArea;
  const W = Math.max(400, Math.min(680, Math.round(wa.width / 3)));
  const H = Math.max(540, Math.min(780, Math.round(wa.height * 0.92)));

  win = new BrowserWindow({
    width: W,
    height: H,
    x: wa.x + wa.width - W - 24,           // چسبیده به لبه راست دسکتاپ
    y: wa.y + Math.max(0, Math.round((wa.height - H) / 2)),
    minWidth: 360,
    minHeight: 520,
    frame: false, // نوار عنوان سفارشی
    backgroundColor: '#0a0e10',
    show: false,
    title: 'آوا — دستیار صوتی ویندوز',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());

  win.on('maximize', () => win.webContents.send('win:maximized-changed', true));
  win.on('unmaximize', () => win.webContents.send('win:maximized-changed', false));
  win.on('closed', () => { win = null; });

  // برای دیباگ رابط کاربری، خط زیر را از کامنت خارج کنید:
  // win.webContents.openDevTools({ mode: 'detach' });
}

/* ---------- IPC: window controls ---------- */
ipcMain.handle('win:minimize', () => { if (win) win.minimize(); });
ipcMain.handle('win:toggle-maximize', () => {
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});
ipcMain.handle('win:close', () => { if (win) win.close(); });
ipcMain.handle('win:is-maximized', () => (win ? win.isMaximized() : false));

/* ---------- مجوز میکروفون (برای تشخیص گفتار) ---------- */
function setupMicPermission() {
  const allow = ['media', 'audioCapture', 'notifications', 'fullscreen'];
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(allow.includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allow.includes(permission));
}

/* ---------- اجراکننده واقعی فرمان‌ها (فهرست سفید امن) ----------
   رندرر فقط «شناسه» فرمان را می‌فرستد؛ خودِ دستور در همین‌جا نگه‌داری می‌شود
   تا هیچ ورودی دلخواهی به شل ویندوز تزریق نشود. */
const PS_KEY = (vk, times = 1) => {
  const presses = Array.from({ length: times }, () => `[W.N]::keybd_event(0x${vk},0,0,0); [W.N]::keybd_event(0x${vk},0,2,0);`).join(' ');
  return `powershell -NoProfile -Command "Add-Type -Namespace W -Name N -MemberDefinition '[DllImport(\"user32.dll\")] public static extern void keybd_event(byte vk, byte sc, uint fl, uint ex);'; ${presses}"`;
};

const SCREENSHOT_PS =
  'powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms,System.Drawing; ' +
  '$b=[System.Windows.Forms.SystemInformation]::VirtualScreen; ' +
  '$bmp=New-Object Drawing.Bitmap $b.Width,$b.Height; ' +
  '$g=[Drawing.Graphics]::FromImage($bmp); ' +
  '$g.CopyFromScreen($b.Left,$b.Top,0,0,$bmp.Size); ' +
  '$p=\\"$env:USERPROFILE\\Pictures\\AVA-$(Get-Date -Format yyyyMMdd-HHmmss).png\\"; ' +
  '$bmp.Save($p); $g.Dispose(); $bmp.Dispose(); Write-Output $p"';

const safeUrl = (u) => {
  const s = String(u || '').trim();
  return /^https?:\/\//i.test(s) ? s.replace(/["^&|<>]/g, '') : null;
};

const COMMANDS = {
  /* برنامه‌های ویندوز */
  open_chrome:   { cmd: 'start chrome',                fa: 'مرورگر کروم' },
  open_notepad:  { cmd: 'start notepad',               fa: 'نت‌پد' },
  open_calc:     { cmd: 'start calc',                  fa: 'ماشین‌حساب' },
  open_explorer: { cmd: 'start explorer',              fa: 'فایل اکسپلورر' },
  open_vscode:   { cmd: 'start code',                  fa: 'وی‌اس کد' },
  open_taskmgr:  { cmd: 'start taskmgr',               fa: 'تسک‌منیجر' },
  open_settings: { cmd: 'start ms-settings:',          fa: 'تنظیمات ویندوز' },
  open_paint:    { cmd: 'start mspaint',               fa: 'پینت' },
  open_music:    { cmd: 'start https://music.youtube.com', fa: 'یوتیوب موزیک' },
  open_youtube:  { cmd: 'start https://www.youtube.com',   fa: 'یوتیوب' },
  open_downloads: { cmd: 'start "" "shell:Downloads"',  fa: 'پوشه دانلودها' },
  open_documents: { cmd: 'start "" "shell:Personal"',     fa: 'پوشه اسناد' },

  /* وب */
  web_open:   { cmd: (a) => { const u = safeUrl(a); return u ? `start "" "${u}"` : null; }, fa: 'سایت' },
  web_search: { cmd: (a) => `start "" "https://www.google.com/search?q=${encodeURIComponent(String(a || '').slice(0, 200))}"`, fa: 'جستجو' },

  /* پنجره‌ها و سیستم */
  minimize_all: { cmd: 'powershell -NoProfile -Command "(New-Object -ComObject Shell.Application).MinimizeAll()"', fa: 'دسکتاپ' },
  lock:         { cmd: 'rundll32.exe user32.dll,LockWorkStation', fa: 'قفل صفحه' },
  screenshot:   { cmd: SCREENSHOT_PS, fa: 'اسکرین‌شات' },
  recycle_empty: { cmd: 'powershell -NoProfile -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue; Write-Output done"', fa: 'سطل بازیافت' },

  /* صدا (کلیدهای مجازی ویندوز) */
  vol_up:   { cmd: PS_KEY('AF', 6),  fa: 'بلندی صدا +' },
  vol_down: { cmd: PS_KEY('AE', 6),  fa: 'بلندی صدا -' },
  vol_mute: { cmd: PS_KEY('AD', 1),  fa: 'بی‌صدا' },
};

ipcMain.handle('sys:run', (_e, id, arg) => {
  const c = COMMANDS[id];
  if (!c) return { ok: false, error: 'فرمان ناشناخته' };
  const cmdStr = typeof c.cmd === 'function' ? c.cmd(arg) : c.cmd;
  if (!cmdStr) return { ok: false, error: 'ورودی نامعتبر است' };
  return new Promise((resolve) => {
    exec(cmdStr, { windowsHide: true, timeout: 20000 }, (err, stdout) => {
      if (err) {
        resolve({ ok: false, error: 'اجرا نشد — مطمئن شو روی ویندوز و برنامه‌ها نصب هستند', fa: c.fa });
      } else {
        resolve({ ok: true, out: (stdout || '').trim(), fa: c.fa });
      }
    });
  });
});

/* ---------- IPC: system stats (برای مانیتور و نوار وضعیت) ---------- */
ipcMain.handle('sys:stats', () => ({
  cpu: cpuUsage(),
  ram: Math.round((1 - os.freemem() / os.totalmem()) * 100),
  uptime: Math.round(os.uptime()),
  totalMemGB: +(os.totalmem() / 1073741824).toFixed(1),
  freeMemGB: +(os.freemem() / 1073741824).toFixed(1),
  platform: os.platform(),
  release: os.release(),
  hostname: os.hostname(),
}));

/* ---------- IPC: اطلاعات برنامه (نسخه واقعی) ---------- */
ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  packaged: app.isPackaged,
  electron: process.versions.electron,
}));

/* ---------- به‌روزرسان خودکار (electron-updater + GitHub Releases) ---------- */
const sendUI = (ch, payload) => {
  if (win && !win.isDestroyed()) win.webContents.send(ch, payload);
};

let autoCheckEnabled = true; // از تنظیمات UI قابل خاموش‌کردن است

function setupAutoUpdater() {
  if (!autoUpdater || !app.isPackaged) return; // در حالت dev (npm start) غیرفعال
  try {
    autoUpdater.autoDownload = true;        // دانلود خودکار پس از پیدا شدن نسخه جدید
    autoUpdater.autoInstallOnAppQuit = true; // نصب هنگام بستن برنامه اگر کاربر نصب فوری نزند
    autoUpdater.on('checking-for-update', () => sendUI('updater:status', { state: 'checking' }));
    autoUpdater.on('update-available', (i) => sendUI('updater:status', { state: 'available', version: i && i.version }));
    autoUpdater.on('update-not-available', () => sendUI('updater:status', { state: 'none' }));
    autoUpdater.on('download-progress', (p) => sendUI('updater:status', { state: 'downloading', percent: Math.round(p.percent || 0) }));
    autoUpdater.on('update-downloaded', (i) => sendUI('updater:status', { state: 'ready', version: i && i.version }));
    autoUpdater.on('error', (e) => sendUI('updater:status', { state: 'error', message: String((e && e.message) || e) }));
    /* بررسی خودکار ۱۲ ثانیه بعد از باز شدن برنامه (اگر کاربر خاموشش نکرده باشد) */
    setTimeout(() => {
      if (autoCheckEnabled) autoUpdater.checkForUpdates().catch(() => {});
    }, 12000);
  } catch (_) { /* noop */ }
}

ipcMain.handle('updater:set-auto', (_e, on) => {
  autoCheckEnabled = !!on;
  return autoCheckEnabled;
});

ipcMain.handle('updater:check', async () => {
  if (!autoUpdater) return { ok: false, error: 'ماژول electron-updater نصب نیست' };
  if (!app.isPackaged) return { ok: false, dev: true, error: 'در حالت توسعه به‌روزرسان غیرفعال است' };
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

ipcMain.handle('updater:install', () => {
  if (autoUpdater && app.isPackaged) autoUpdater.quitAndInstall(false, true);
});

/* ---------- IPC: تنظیمات سیستمی ---------- */
ipcMain.handle('app:flags', () => ({
  alwaysOnTop: win ? !!win.isAlwaysOnTop() : false,
  loginItem: (() => { try { return app.getLoginItemSettings().openAtLogin; } catch (_) { return false; } })(),
}));

ipcMain.handle('app:set-always-on-top', (_e, on) => {
  if (win) win.setAlwaysOnTop(!!on, 'screen-saver');
  return win ? !!win.isAlwaysOnTop() : false;
});

ipcMain.handle('app:set-login-item', (_e, on) => {
  try {
    app.setLoginItemSettings({ openAtLogin: !!on });
    return app.getLoginItemSettings().openAtLogin;
  } catch (_) {
    return null;
  }
});

/* ---------- IPC: باز کردن لینک خارجی (فقط https امن) ---------- */
ipcMain.handle('sys:open-url', (_e, u) => {
  const s = safeUrl(u);
  if (!s) return { ok: false, error: 'آدرس نامعتبر است' };
  shell.openExternal(s);
  return { ok: true };
});

/* ---------- IPC: ذخیره فایل ضبط صدا در Music/AVA ---------- */
ipcMain.handle('sys:save-audio', async (_e, data) => {
  try {
    const buf = Buffer.from(new Uint8Array(data));
    if (!buf.length) return { ok: false, error: 'فایل خالی است' };
    const dir = path.join(os.homedir(), 'Music', 'AVA');
    await fs.promises.mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const file = path.join(dir, `AVA-Record-${stamp}.webm`);
    await fs.promises.writeFile(file, buf);
    return { ok: true, path: file };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

/* ============================================================
   هوش مصنوعی GLM — چت + تشخیص گفتار ابری (GLM-ASR)
   کلید API فقط در همین پروسه استفاده می‌شود و جایی لاگ نمی‌شود.
   base پیش‌فرض: https://api.z.ai/api/paas/v4  (سازگار با open.bigmodel.cn)
   ============================================================ */
const trimBase = (b) => String(b || 'https://api.z.ai/api/paas/v4').replace(/\/+$/, '');
const netErr = (e) => {
  const m = String((e && e.message) || e);
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN/i.test(m)) {
    return 'اتصال به سرور برقرار نشد — اینترنت یا فیلترشکن را بررسی کن';
  }
  return m.slice(0, 140);
};

ipcMain.handle('ai:chat', async (_e, p) => {
  const { base, key, model, messages, temperature } = p || {};
  if (!key) return { ok: false, error: 'کلید GLM تنظیم نشده — از تنظیمات واردش کن' };
  if (!Array.isArray(messages) || !messages.length) return { ok: false, error: 'پیام خالی است' };
  try {
    const r = await fetch(trimBase(base) + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${String(key).trim()}` },
      body: JSON.stringify({
        model: model || 'glm-4.6',
        messages: messages.slice(-16), // فقط ۸ رد و بدل آخر
        temperature: typeof temperature === 'number' ? temperature : 0.6,
        max_tokens: 1024,
        stream: false,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (j && j.error && (j.error.message || j.error.code)) || `HTTP ${r.status}`;
      return { ok: false, error: `GLM: ${msg}` };
    }
    const text = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!text) return { ok: false, error: 'پاسخ خالی از سرور رسید' };
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: netErr(e) };
  }
});

ipcMain.handle('stt:transcribe', async (_e, p) => {
  const { buf, base, key, model } = p || {};
  if (!key) return { ok: false, error: 'کلید GLM تنظیم نشده — از تنظیمات واردش کن' };
  if (!buf || !buf.length) return { ok: false, error: 'صدایی برای تبدیل وجود ندارد' };
  try {
    const form = new FormData();
    form.append('file', new Blob([Buffer.from(buf)], { type: 'audio/webm' }), 'ava-audio.webm');
    form.append('model', model || 'glm-asr-2512');
    const r = await fetch(trimBase(base) + '/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${String(key).trim()}` },
      body: form,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (j && j.error && (j.error.message || j.error.code)) || `HTTP ${r.status}`;
      return { ok: false, error: `GLM-ASR: ${msg}` };
    }
    const text = String((j && j.text) || (j && j.data && j.data.text) || '').trim();
    return { ok: !!text, text, error: text ? undefined : 'متنی از صدا استخراج نشد' };
  } catch (e) {
    return { ok: false, error: netErr(e) };
  }
});

/* ---------- فرمان‌های سفارشی (پیشنهاد هوش مصنوعی + تأیید صریح کاربر) ----------
   رندرر قبلاً یک مودال تأیید با متن کامل اسکریپت نشان می‌دهد؛
   این‌جا فقط اجرای مهاربندی‌شده PowerShell انجام می‌شود. */
ipcMain.handle('custom:run', (_e, script) => {
  const s = String(script || '')
    .replace(/\r?\n/g, '; ')
    .slice(0, 2000);
  if (!s.trim()) return { ok: false, error: 'اسکریپت خالی است' };
  const cmdStr = `powershell -NoProfile -NonInteractive -Command "${s.replace(/"/g, '\\\\"')}"`;
  return new Promise((resolve) => {
    exec(cmdStr, { windowsHide: true, timeout: 30000, maxBuffer: 1024 * 512 }, (err, stdout, stderr) => {
      if (err && !stdout) {
        resolve({ ok: false, error: String((err.message || stderr || 'اجرا نشد')).slice(0, 200) });
      } else {
        resolve({ ok: true, out: ((stdout || '') + (stderr ? `\n${stderr}` : '')).trim().slice(0, 500) });
      }
    });
  });
});

/* ---------- App lifecycle ---------- */
app.whenReady().then(() => {
  setupMicPermission();
  createWindow();
  setupAutoUpdater();

  // میانبر سراسری گوش دادن (Push-to-talk)
  try {
    globalShortcut.register('CommandOrControl+Shift+Space', () => {
      if (win) {
        if (win.isMinimized()) win.restore();
        win.show();
        win.webContents.send('ava:toggle-listen');
      }
    });
  } catch (e) {
    /* noop */
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit(); // رفتار استاندارد ویندوز
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
