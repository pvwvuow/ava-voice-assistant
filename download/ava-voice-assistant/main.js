/**
 * آوا — دستیار صوتی ویندوز
 * Electron main process (نسخه ۰.۷ — تشخیص گفتار آفلاین، حالت بی‌دست، آب‌وهوا، تنظیمات فایلی)
 */
const { app, BrowserWindow, ipcMain, globalShortcut, session, screen, shell, protocol, net } = require('electron');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/* ---------- پروتکل امن ava:// ----------
   رابط کاربری از ava://app بارگذاری می‌شود تا:
   ۱) Web Worker موتور آفلاین هم‌مبعا باشد (فایل:// ورکر را می‌بندد)
   ۲) مدل تشخیص گفتار و WASM با MIME درست سرو شود
   باید «قبل از» آماده شدن اپ ثبت شود. */
protocol.registerSchemesAsPrivileged([
  { scheme: 'ava', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function serveAvaFile(reqUrl) {
  try {
    const u = new URL(reqUrl);
    if (u.host !== 'app') return new Response('not found', { status: 404 });
    const root = __dirname;
    const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '');
    const file = path.normalize(path.join(root, rel || 'renderer/index.html'));
    if (!file.startsWith(root)) return new Response('forbidden', { status: 403 });
    const data = fs.readFileSync(file);
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const headers = {
      'Content-Type': type,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    };
    /* فقط برای سند اصلی: COOP/COEP → crossOriginIsolated=true →
       SharedArrayBuffer در دسترس → WASM چندنخی و تشخیص گفتار ۲ تا ۴ برابر سریع‌تر.
       بقیه فایل‌ها (و پاپ‌آپ‌های https مثل ورود گوگل) تحت تأثیر قرار نمی‌گیرند. */
    if (file.endsWith('index.html')) {
      headers['Cross-Origin-Opener-Policy'] = 'same-origin';
      headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
    }
    return new Response(data, { status: 200, headers });
  } catch (_) {
    return new Response('not found', { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}

/* electron-updater (فقط وقتی پکیج نصب باشد — خطا را ساکت رد می‌کنیم) */
let autoUpdater = null;
try { ({ autoUpdater } = require('electron-updater')); } catch (_) { autoUpdater = null; }

/* ---------- هویت مرورگر واقعی ----------
   گوگل ورود از مرورگرهای «غیرمطمئن» (UA حاوی Electron) را می‌بندد:
   «Couldn't sign you in — This browser or app may not be secure».
   راه‌حل: همه‌جا (پنجره‌ها، webview، پاپ‌آپ‌های OAuth) هویت کروم واقعی ویندوز. */
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
const CHROME_SEC_CH_UA = '"Chromium";v="136", "Google Chrome";v="136", "Not:A-Brand";v="24"';
app.userAgentFallback = CHROME_UA;

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
      webviewTag: true, // برای پنل چت داخلی z.ai
    },
  });

  win.loadURL('ava://app/renderer/index.html');
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

/* ---------- مجوز میکروفون + هویت کروم برای هر دو نشست ---------- */
function setupMicPermission() {
  const allow = ['media', 'audioCapture', 'notifications', 'fullscreen', 'clipboard-sanitized-write'];
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(allow.includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allow.includes(permission));

  /* نشست دائمی پنل چت z.ai — لاگین یک بار برای همیشه می‌ماند */
  let aiSes = null;
  try { aiSes = session.fromPartition('persist:ai'); } catch (_) { /* noop */ }
  if (aiSes) {
    try {
      aiSes.setPermissionRequestHandler((_wc, permission, callback) => {
        callback(['media', 'audioCapture', 'notifications', 'fullscreen', 'clipboard-sanitized-write'].includes(permission));
      });
      aiSes.setPermissionCheckHandler((_wc, permission) =>
        ['media', 'audioCapture', 'notifications', 'fullscreen', 'clipboard-sanitized-write'].includes(permission));
    } catch (_) { /* noop */ }
  }

  /* ضد خطای «This browser or app may not be secure»:
     هر درخواست https هدر User-Agent و sec-ch-ua کروم واقعی بفرستد،
     نه برند Electron — برای ورود گوگل و هم برای z.ai که UAهای اتومات را می‌بندد. */
  for (const ses of [session.defaultSession, aiSes]) {
    if (!ses) continue;
    try {
      ses.setUserAgent(CHROME_UA);
      ses.webRequest.onBeforeSendHeaders((details, cb) => {
        try {
          const h = details.requestHeaders;
          if (/^https:\/\//i.test(details.url)) {
            h['User-Agent'] = CHROME_UA;
            h['sec-ch-ua'] = CHROME_SEC_CH_UA;
            h['sec-ch-ua-platform'] = '"Windows"';
            h['sec-ch-ua-mobile'] = '?0';
          }
          cb({ requestHeaders: h });
        } catch (_) { cb({}); }
      });
    } catch (_) { /* noop */ }
  }
}

/* ---------- پاپ‌آپ‌های webview (لاگین گوگل/z.ai) ----------
   لاگین حساب‌های معتبر داخل برنامه باز می‌شود؛
   بقیه لینک‌ها به مرورگر پیش‌فرض سیستم می‌روند. */
app.on('web-contents-created', (_ev, wc) => {
  try {
    wc.setWindowOpenHandler(({ url }) => {
      const u = String(url || '');
      if (/^https:\/\/([^\/]*\.)?(z\.ai|zhipu\.ai|bigmodel\.cn|google\.com|googleusercontent\.com|accounts\.google\.[a-z.]+)/i.test(u)) {
        /* پاپ‌آپ لاگین OAuth از داخل webview z.ai → همان نشست دائمی persist:ai
           تا کوکی‌های گوگل و z.ai در همان پارتیشن بمانند و ورود کامل شود؛
           UA پاپ‌آپ هم از userAgentFallback (کروم واقعی) به ارث می‌رسد. */
        const opts = wc.hostWebContents ? { webPreferences: { partition: 'persist:ai' } } : {};
        return { action: 'allow', overrideBrowserWindowOptions: opts };
      }
      if (/^https?:\/\//i.test(u)) shell.openExternal(u);
      return { action: 'deny' };
    });
  } catch (_) { /* noop */ }
});

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
  /* تنظیم دقیق درصد صدا: ۵۰ پله پایین (هر پله ٪۲) + بالا آوردن تا درصد خواسته */
  vol_set: {
    cmd: (a) => {
      const pct = Math.max(0, Math.min(100, Math.round(Number(a) || 0)));
      const steps = Math.min(50, Math.round(pct / 2));
      return (
        'powershell -NoProfile -Command "' +
        `Add-Type -Namespace W -Name N -MemberDefinition '[DllImport(\"user32.dll\")] public static extern void keybd_event(byte vk, byte sc, uint fl, uint ex);'; ` +
        '1..50 | ForEach-Object { [W.N]::keybd_event(0xAE,0,0,0); [W.N]::keybd_event(0xAE,0,2,0) }; ' +
        (steps > 0 ? `1..${steps} | ForEach-Object { [W.N]::keybd_event(0xAF,0,0,0); [W.N]::keybd_event(0xAF,0,2,0) }; ` : '') +
        'Write-Output ok"'
      );
    },
    fa: 'تنظیم دقیق صدا',
  },
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
   تنظیمات ماندگار در فایل (userData/ava-settings.json)
   — منبع حقیقت تنظیمات فایل است تا آپدیت و تعویض مببع UI چیزی از دست نرود
   ============================================================ */
function settingsFile() {
  try { return path.join(app.getPath('userData'), 'ava-settings.json'); } catch (_) { return null; }
}
ipcMain.handle('settings:load', () => {
  const f = settingsFile();
  if (!f) return {};
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return {}; }
});
ipcMain.handle('settings:save', (_e, obj) => {
  const f = settingsFile();
  if (!f || !obj || typeof obj !== 'object') return false;
  try {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(obj, null, 2));
    return true;
  } catch (_) { return false; }
});

/* ============================================================
   تایپ در برنامه فعال (حالت تایپ صوتی → خروجی پیست در هر برنامه)
   متن به کلیپ‌بورد می‌رود و Ctrl+V در پنجره فعال زده می‌شود.
   ============================================================ */
ipcMain.handle('sys:type-text', (_e, text) => {
  const t = String(text || '');
  if (!t.trim()) return { ok: false, error: 'متن خالی است' };
  if (t.length > 4000) return { ok: false, error: 'متن بیش از حد طولانی است' };
  try {
    const b64 = Buffer.from(t, 'utf16le').toString('base64');
    const ps =
      'powershell -NoProfile -Command "' +
      `$t=[System.Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${b64}')); ` +
      'Set-Clipboard -Value $t; ' +
      "Add-Type -Namespace W -Name N -MemberDefinition '[DllImport(\"user32.dll\")] public static extern void keybd_event(byte vk, byte sc, uint fl, uint ex);'; " +
      '[W.N]::keybd_event(0x11,0,0,0); [W.N]::keybd_event(0x56,0,0,0); Start-Sleep -m 80; ' +
      '[W.N]::keybd_event(0x56,0,2,0); [W.N]::keybd_event(0x11,0,2,0); Write-Output ok"';
    return new Promise((resolve) => {
      exec(ps, { windowsHide: true, timeout: 8000 }, (err) => {
        resolve(err ? { ok: false, error: 'تایپ در برنامه فعال ممکن نشد' } : { ok: true });
      });
    });
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

/* ============================================================
   مدیریت DNS ویندوز — با فرمان صوتی یا رابط کاربری
   تغییر DNS واقعی نیاز به دسترسی مدیر دارد؛ اسکریپت PowerShell
   با Start-Process -Verb RunAs اجرا می‌شود (پنجره UAC ویندوز باز می‌شود
   و خود کاربر تأیید می‌کند — آوا هیچ دسترسی مدیریتی انبار نمی‌کند).
   ============================================================ */
const PS_RUN = (cmdStr, timeout = 40000) =>
  new Promise((resolve) => {
    exec(cmdStr, { windowsHide: true, timeout }, (err, stdout) => {
      resolve({ ok: !err, out: (stdout || '').trim(), err: err ? String(err.message || err) : '' });
    });
  });

const DNS_IP_OK = (v) =>
  typeof v === 'string' && /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(v.trim());

/* اسکریپت موقت در پوشه Temp نوشته و با دسترسی مدیر اجرا می‌شود */
function runElevatedPs(scriptBody) {
  return new Promise((resolve) => {
    try {
      const file = path.join(os.tmpdir(), `ava-dns-${Date.now()}.ps1`);
      fs.writeFileSync(file, scriptBody, 'utf8');
      const launcher =
        'powershell -NoProfile -Command "' +
        `$p = Start-Process powershell -Verb RunAs -Wait -PassThru -WindowStyle Hidden ` +
        `-ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','${file.replace(/'/g, "''")}'; ` +
        `exit $p.ExitCode"`;
      exec(launcher, { windowsHide: true, timeout: 120000 }, (err, stdout, stderr) => {
        try { fs.unlinkSync(file); } catch (_) { /* noop */ }
        if (err) {
          /* کاربر پنجره UAC را لغو کرد یا اجرا شکست خورد */
          const cancelled = /canceled|cancelled|operated by the user/i.test(String((err && err.message) || '') + stderr);
          resolve({ ok: false, cancelled, error: cancelled ? 'تأیید مدیر لغو شد' : 'اجرا با دسترسی مدیر ممکن نشد' });
        } else {
          resolve({ ok: true });
        }
      });
    } catch (e) {
      resolve({ ok: false, error: String((e && e.message) || e) });
    }
  });
}

async function activeAdapters() {
  const r = await PS_RUN(
    'powershell -NoProfile -Command "Get-NetAdapter | Where-Object { $_.Status -eq \'Up\' } | ForEach-Object { Write-Output ($_.ifIndex.ToString() + \'|\' + $_.Name) }"'
  );
  if (!r.ok) return { ok: false, error: 'خواندن کارت‌های شبکه ممکن نشد', adapters: [] };
  const adapters = r.out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.indexOf('|');
    return { ifIndex: Number(l.slice(0, i)), name: l.slice(i + 1) };
  }).filter((a) => Number.isFinite(a.ifIndex));
  return { ok: true, adapters };
}

ipcMain.handle('dns:interfaces', () => activeAdapters());

ipcMain.handle('dns:current', async () => {
  const r = await PS_RUN(
    'powershell -NoProfile -Command "Get-DnsClientServerAddress -AddressFamily IPv4 | Where-Object { $_.ServerAddresses.Count -gt 0 } | ForEach-Object { $a = Get-NetAdapter -InterfaceIndex $_.InterfaceIndices[0] -ErrorAction SilentlyContinue; if ($a) { Write-Output ($a.Name + \'|\' + ($_.ServerAddresses -join \',\')) } }"'
  );
  if (!r.ok) return { ok: false, error: 'خواندن DNS فعلی ممکن نشد', entries: [] };
  const entries = r.out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.indexOf('|');
    return { name: l.slice(0, i), ips: l.slice(i + 1).split(',').filter(Boolean) };
  });
  return { ok: true, entries };
});

ipcMain.handle('dns:apply', async (_e, p) => {
  const { primary, secondary, ifIndex } = p || {};
  const p1 = DNS_IP_OK(primary) ? String(primary).trim() : null;
  const p2 = DNS_IP_OK(secondary) ? String(secondary).trim() : null;
  if (!p1) return { ok: false, error: 'آی‌پی DNS اول معتبر نیست (مثال: 78.157.42.100)' };
  let targets = [];
  if (Number.isFinite(Number(ifIndex)) && ifIndex !== null && ifIndex !== undefined && ifIndex !== '') {
    targets = [{ ifIndex: Number(ifIndex) }];
  } else {
    const a = await activeAdapters();
    targets = (a.adapters || []).map((x) => ({ ifIndex: x.ifIndex }));
    if (!targets.length) return { ok: false, error: 'هیچ کارت شبکه فعالی پیدا نشد' };
  }
  const idx = targets.map((t) => String(t.ifIndex)).join(',');
  const body =
    `$ErrorActionPreference = 'Stop'\n` +
    `$ips = @('${p1}'${p2 ? `,'${p2}'` : ''})\n` +
    `Set-DnsClientServerAddress -InterfaceIndex @(${idx}) -ServerAddresses $ips\n` +
    `Clear-DnsClientCache\n` +
    `exit 0\n`;
  const r = await runElevatedPs(body);
  if (!r.ok) return r;
  /* اعتبارسنجی واقعی: بعد از اعمال، DNS فعلی را می‌خوانیم */
  await new Promise((res) => setTimeout(res, 1200));
  const cur = await PS_RUN(
    'powershell -NoProfile -Command "(Get-DnsClientServerAddress -AddressFamily IPv4 | Where-Object { $_.ServerAddresses.Count -gt 0 } | Select-Object -First 1).ServerAddresses -join \',\'"'
  );
  const applied = cur.ok && cur.out && cur.out.includes(p1);
  return applied ? { ok: true, ips: p2 ? `${p1} , ${p2}` : p1 } : { ok: true, ips: p2 ? `${p1} , ${p2}` : p1, unverified: true };
});

ipcMain.handle('dns:reset', async () => {
  const a = await activeAdapters();
  if (!a.adapters || !a.adapters.length) return { ok: false, error: 'هیچ کارت شبکه فعالی پیدا نشد' };
  const idx = a.adapters.map((t) => String(t.ifIndex)).join(',');
  const body =
    `$ErrorActionPreference = 'Stop'\n` +
    `Set-DnsClientServerAddress -InterfaceIndex @(${idx}) -ResetServerAddresses\n` +
    `Clear-DnsClientCache\n` +
    `exit 0\n`;
  return runElevatedPs(body);
});

/* ============================================================
   آب‌وهوا — Open-Meteo (بدون هیچ کلید API)
   ============================================================ */
const WMO_FA = {
  0: 'صاف', 1: 'عمدتاً صاف', 2: 'کمی ابری', 3: 'ابری', 45: 'مه‌آلود', 48: 'مه یخ‌زده',
  51: 'نم‌نم سبک', 53: 'نم‌نم', 55: 'نم‌نم سنگین', 56: 'نم‌نم یخ‌زده', 57: 'نم‌نم یخ‌زده سنگین',
  61: 'باران سبک', 63: 'باران', 65: 'باران شدید', 66: 'باران یخ‌زده', 67: 'باران یخ‌زده شدید',
  71: 'برف سبک', 73: 'برف', 75: 'برف سنگین', 77: 'دانه‌های برف',
  80: 'رگبار سبک', 81: 'رگبار', 82: 'رگبار شدید', 85: 'رگبار برف', 86: 'رگبار برف سنگین',
  95: 'رعد و برق', 96: 'رعد و برق با تندباز', 99: 'رعد و برق شدید',
};
ipcMain.handle('sys:weather', async (_e, city) => {
  const c = String(city || 'تهران').trim().slice(0, 60) || 'تهران';
  try {
    const gr = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(c)}&count=1&language=fa&format=json`,
      { signal: AbortSignal.timeout(10000) }
    );
    const gj = await gr.json().catch(() => ({}));
    const g = gj && gj.results && gj.results[0];
    if (!g) return { ok: false, error: `شهری به نام «${c}» پیدا نشد — نام شهر را واضح‌تر بگو` };
    const fr = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`,
      { signal: AbortSignal.timeout(10000) }
    );
    const fj = await fr.json().catch(() => ({}));
    const cur = fj && fj.current;
    if (!cur) return { ok: false, error: 'داده آب‌وهوا نرسید — چند لحظه بعد دوباره امتحان کن' };
    return {
      ok: true,
      name: g.name || c,
      temp: Math.round(cur.temperature_2m),
      feels: Math.round(cur.apparent_temperature),
      hum: Math.round(cur.relative_humidity_2m),
      wind: Math.round(cur.wind_speed_10m),
      desc: WMO_FA[cur.weather_code] || 'نامشخص',
    };
  } catch (e) {
    return { ok: false, error: netErr(e) };
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
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|aborted|timed?\s?out/i.test(m)) {
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
      signal: AbortSignal.timeout(60000),
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

/* ---------- موتور رایگان گوگل برای تشخیص گفتار (بدون هیچ کلیدی) ----------
   رندرر PCM ۱۶کیلوهرتز تک‌کاناله می‌فرستد؛ این‌جا مستقیم به سرور
   تشخیص گفتار گوگل (همان موتور داخلی کروم) POST می‌شود. کلید پیش‌فرض،
   کلید عمومی خود کرومیوم است — کاربر هیچ توکنی لازم ندارد. */
const GOOGLE_KEY_DEFAULT = 'AIzaSyBOti4mM-6x9WDnZIjIeyEU21OpBXqWBgw';

/* ---------- چت با GLM بدون کلید API — با نشست حساب z.ai کاربر ----------
   کاربر یک بار در تب «صفحه چت» وارد chat.z.ai می‌شود؛ توکن نشستش
   خوانده می‌شود و درخواست‌ها از این‌جا با همان حساب انجام می‌شود.
   نکات مهم (بر اساس رفتار واقعی وب z.ai):
   › درخواست باید هدرهای مرورگر واقعی بگیرد: X-FE-Version، Origin، Referer
   › بدنه باید stream:true و chat_id و id داشته باشد
   › پاسخ SSE است: محتوا در data.delta_content با phase=answer؛
     phase=thinking زنجیره فکر است و باید حذف شود. */
ipcMain.handle('ai:zaiChat', async (_e, p) => {
  const { token, messages, model } = p || {};
  if (!token) return { ok: false, error: 'برای چت بدون کلید، اول در تب «صفحه چت» وارد حسابت شو' };
  if (!Array.isArray(messages) || !messages.length) return { ok: false, error: 'پیام خالی است' };
  const ZAI = 'https://chat.z.ai';
  const chatId = crypto.randomUUID();
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${String(token).trim()}`,
    Accept: '*/*',
    'User-Agent': CHROME_UA,
    'X-FE-Version': 'prod-fe-1.0.76',
    Origin: ZAI,
    Referer: `${ZAI}/c/${chatId}`,
    'sec-ch-ua': CHROME_SEC_CH_UA,
    'sec-ch-ua-platform': '"Windows"',
    'sec-ch-ua-mobile': '?0',
  };
  try {
    /* انتخاب مدل: از فهرست مدل‌های حساب کاربر */
    let mdl = String(model || '').trim();
    if (!mdl) {
      try {
        const mr = await fetch(`${ZAI}/api/models`, { headers, signal: AbortSignal.timeout(15000) });
        const mj = await mr.json().catch(() => ({}));
        const ids = ((mj && mj.data) || [])
          .filter((m) => !m || !m.info || m.info.is_active !== false)
          .map((m) => String(m && m.id)).filter(Boolean);
        mdl =
          ids.find((i) => /^glm[-_]?4\.6$/i.test(i)) ||
          ids.find((i) => /glm[-_]?4\.6/i.test(i)) ||
          ids.find((i) => /glm[-_]?4\.5(?![-_]?air)/i.test(i)) ||
          ids.find((i) => /glm/i.test(i)) ||
          ids[0] || 'GLM-4.6';
      } catch (_) { mdl = 'GLM-4.6'; }
    }
    const r = await fetch(`${ZAI}/api/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        stream: true,
        chat_id: chatId,
        id: crypto.randomUUID(),
        model: mdl,
        messages: messages.slice(-16),
        features: { enable_thinking: false },
      }),
      signal: AbortSignal.timeout(90000),
    });
    if (!r.ok && r.status === 401) {
      return { ok: false, needLogin: true, error: 'نشست منقضی شده — در تب «صفحه چت» دوباره وارد شو' };
    }
    const ct = String(r.headers.get('content-type') || '');
    let text = '';
    if (ct.includes('text/event-stream') || !ct.includes('json')) {
      /* پاسخ SSE است — فرمت z.ai: data.  {  {phase, delta_content, done}  */
      const raw = await r.text();
      for (const line of raw.split('\n')) {
        const s = line.trim();
        if (!s.startsWith('data:')) continue;
        const d = s.slice(5).trim();
        if (!d || d === '[DONE]') continue;
        try {
          const j = JSON.parse(d);
          /* فرمت OpenAI استاندارد (فالبک) */
          const c = j && j.choices && j.choices[0];
          if (c && (c.delta || c.message)) {
            const delta = (c.delta && c.delta.content) || (c.message && c.message.content) || '';
            if (delta) text += delta;
            continue;
          }
          /* فرمت واقعی z.ai */
          const dd = j && typeof j.data === 'object' ? j.data : null;
          if (!dd) continue;
          if (dd.phase && dd.phase !== 'answer') continue; /* زنجیره فکر → حذف */
          let piece = String(dd.delta_content || dd.edit_content || '');
          if (piece && /<summary>/i.test(piece)) {
            /* اولین تکه پاسخ ممکن است تفکر را هم داخل <details> داشته باشد */
            piece = piece.replace(/<details[^>]*>[\s\S]*?<\/details>/gi, '');
          }
          if (piece) text += piece;
          if (dd.done) break;
        } catch (_) { /* noop */ }
      }
    } else {
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = (j && ((j.error && (j.error.message || j.error.code)) || j.detail || j.message)) || `HTTP ${r.status}`;
        return { ok: false, error: `z.ai: ${String(msg).slice(0, 140)}` };
      }
      text = (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
    }
    text = text.replace(/\n{3,}/g, '\n\n').trim();
    if (!text) return { ok: false, error: 'پاسخ خالی از z.ai رسید — چند لحظه بعد دوباره امتحان کن' };
    return { ok: true, text, model: mdl };
  } catch (e) {
    return { ok: false, error: netErr(e) };
  }
});

ipcMain.handle('stt:google', async (_e, p) => {
  const { pcm, rate, key, lang } = p || {};
  if (!pcm || !pcm.length) return { ok: false, error: 'صدایی برای تبدیل وجود ندارد' };
  const k = String(key || GOOGLE_KEY_DEFAULT).trim() || GOOGLE_KEY_DEFAULT;
  const url =
    'https://www.google.com/speech-api/v2/recognize?output=json' +
    `&lang=${encodeURIComponent(lang || 'fa-IR')}` +
    `&key=${encodeURIComponent(k)}&client=chromium&maxalternatives=1`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': `audio/l16; rate=${Number(rate) || 16000}` },
      body: Buffer.from(pcm),
      signal: AbortSignal.timeout(15000), /* شبکه گیر کرد → پیام واضح، نه انتظار بی‌پایان */
    });
    const raw = await r.text();
    if (!r.ok) {
      let msg = `HTTP ${r.status}`;
      try { const j = JSON.parse(raw); msg = (j.error && j.error.message) || msg; } catch (_) { /* noop */ }
      if (r.status === 403) msg = 'دسترسی گوگل رد شد (403) — فیلترشکن/VPN را روشن کن یا در تنظیمات کلید اختصاصی بگذار';
      if (r.status >= 500) msg = 'سرور گوگل موقتا در دسترس نیست — چند لحظه بعد دوباره امتحان کن';
      return { ok: false, error: `گوگل: ${String(msg).slice(0, 140)}` };
    }
    /* پاسخ چند خط JSON پشت‌سرهم است */
    let text = '';
    for (const line of raw.split('\n')) {
      const s = line.trim();
      if (!s) continue;
      try {
        const j = JSON.parse(s);
        if (j && j.result && j.result.length) {
          const alt = j.result[0].alternative && j.result[0].alternative[0];
          if (alt && alt.transcript) { text = alt.transcript; break; }
        }
      } catch (_) { /* noop */ }
    }
    text = String(text).trim();
    return {
      ok: !!text,
      text,
      error: text ? undefined : 'گوگل متنی برنگرداند — کمی بلندتر و واضح‌تر حرف بزن',
    };
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
  /* سرو کردن رابط کاربری و مدل‌ها از ava://app */
  try { protocol.handle('ava', (req) => { try { console.log('AVA_REQ:' + req.url); } catch (_) {} return serveAvaFile(req.url); }); } catch (e) { console.error('ava protocol:', e); }

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
    // میانبر سراسری حالت بی‌دست (گوش دائمی + کلمه بیدارباش)
    globalShortcut.register('CommandOrControl+Alt+A', () => {
      if (win) {
        if (win.isMinimized()) win.restore();
        win.show();
        win.webContents.send('ava:toggle-handsfree');
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
