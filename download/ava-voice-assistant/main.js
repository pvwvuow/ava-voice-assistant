/**
 * آوا — دستیار صوتی ویندوز
 * Electron main process (نسخه ۰.۱۰ — موتور وب گوگل با کلید کرومیوم داخل Electron
 * فعال می‌شود، فرمان‌های پاور (خواب/خاموش/مانیتور)، فرم «DNS جدید» داخل صفحه
 * اصلی با انیمیشن، پل چت GLM با نشست واقعی کاربر، تنظیمات فایلی)
 */
const { app, BrowserWindow, ipcMain, globalShortcut, session, screen, shell, protocol, net, clipboard } = require('electron');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/* ---------- پروتکل امن ava:// ----------
   رابط کاربری از ava://app بارگذاری می‌شود تا فایل‌های برنامه
   با MIME درست و بدون مجوز اضافه سرو شوند.
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
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': type,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (_) {
    return new Response('not found', { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}

/* ---------- کلید Speech گوگل برای موتور وب داخل Electron ----------
   بدون این کلید، webkitSpeechRecognition در Electron با خطای network بلافاصله
   می‌میرد و هر بار چند ثانیه تلف می‌شد؛ با کلید عمومی خود کرومیوم
   (همان کلیدی که درخواست‌های HTTP هم استفاده می‌کنند) موتور وب واقعی و
   استریمی گوگل داخل برنامه بالا می‌آید. باید قبل از ready ثبت شود. */
const GOOGLE_KEY_DEFAULT = 'AIzaSyBOti4mM-6x9WDnZIjIeyEU21OpBXqWBgw';
try {
  app.commandLine.appendSwitch('google-api-key', GOOGLE_KEY_DEFAULT);
  app.commandLine.appendSwitch('google-default-client-id', '446115136242-2p92k6onon4tnnd434e2f8sdcp8o9fr8.apps.googleusercontent.com');
  app.commandLine.appendSwitch('google-default-client-secret', 'uFBboTQBEsseYMwbGjXAcRYF');
} catch (_) { /* noop */ }

/* electron-updater (فقط وقتی پکیج نصب باشد — خطا را ساکت رد می‌کنیم) */
/* v0.21 — CancellationToken هم برمی‌داریم تا کاربر بتواند دانلود آپدیت را
   هر وقت خواست «توقف» یا «لغو» کند (خواست صریح کاربر) */
let autoUpdater = null;
let CancellationToken = null;
try { ({ autoUpdater, CancellationToken } = require('electron-updater')); } catch (_) { autoUpdater = null; CancellationToken = null; }

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

  /* پاور: خواب / خاموش / ریستارت / مانیتور (فرمان‌های صوتی) */
  sys_sleep: {
    cmd: 'powershell -NoProfile -Command "Add-Type -Namespace P -Name S -MemberDefinition \'[DllImport(\"powrprof.dll\")] public static extern bool SetSuspendState(bool hiber, bool force, bool wake);\'; [P.S]::SetSuspendState($false,$false,$false); Write-Output ok"',
    fa: 'حالت خواب',
  },
  sys_shutdown: { cmd: 'shutdown /s /t 10 /c "AVA"', fa: 'خاموش کردن کامپیوتر' },
  sys_restart:  { cmd: 'shutdown /r /t 10 /c "AVA"', fa: 'راه‌اندازی مجدد' },
  shutdown_abort: { cmd: 'shutdown /a', fa: 'لغو خاموش شدن' },
  monitor_off: {
    /* فیکس v0.13: امضای درست SendMessageW با IntPtr (در x64 امضای int قابل اعتماد نیست)
       + ارسال دوبار با فاصله (بعضی درایورها فقط یک بروکست را می‌گیرند)
       + تاخیر اولیه تا رندرر فرصت کند جوابش را آماده کند */
    cmd:
      'powershell -NoProfile -Command "' +
      'Start-Sleep -m 350; ' +
      'Add-Type -Namespace W -Name N -MemberDefinition \'[DllImport(\"user32.dll\")] public static extern IntPtr SendMessageW(IntPtr h, uint m, IntPtr w, IntPtr l);\'; ' +
      '[W.N]::SendMessageW([IntPtr]0xffff,[uint32]0x0112,[IntPtr]0xf170,[IntPtr]2); ' +
      'Start-Sleep -m 450; ' +
      '[W.N]::SendMessageW([IntPtr]0xffff,[uint32]0x0112,[IntPtr]0xf170,[IntPtr]2); ' +
      'Write-Output ok"',
    fa: 'خاموش کردن مانیتور',
  },

  /* کلیدهای مدیای سیستم — پخش/توقف/بعدی/قبلی هر پلیری (Spotify، مرورگر و…)
     معادل keybd_event در system_actions.py — بدون هیچ کتابخانه سنگین */
  media_toggle: { cmd: PS_KEY('B3', 1), fa: 'پخش/توقف مدیا' },
  media_next:   { cmd: PS_KEY('B0', 1), fa: 'مدیای بعدی' },
  media_prev:   { cmd: PS_KEY('B1', 1), fa: 'مدیای قبلی' },

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
  /* فرمان‌های پاور: سیستم می‌خوابد/خاموش می‌شود و پروسه exec ممکن است
     timeout بخورد یا با کد غیرصفر بسته شود — ولی خودِ فرمان درست اجرا شده */
  const fireAndForget = ['sys_sleep', 'sys_shutdown', 'sys_restart', 'monitor_off', 'lock'].includes(id);
  return new Promise((resolve) => {
    exec(cmdStr, { windowsHide: true, timeout: 20000 }, (err, stdout) => {
      if (err && !fireAndForget) {
        resolve({ ok: false, error: 'اجرا نشد — مطمئن شو روی ویندوز و برنامه‌ها نصب هستند', fa: c.fa });
      } else {
        resolve({ ok: true, out: (stdout || '').trim(), fa: c.fa });
      }
    });
  });
});

/* ============================================================
   اسکنر برنامه‌های نصب‌شده (v0.12) — معادل app_scanner.py
   • Start Menu: همه فایل‌های .lnk در ProgramData و AppData
     با WScript.Shell به مسیر واقعی .exe ترجمه می‌شوند
   • بازی‌های Steam: خواندن SteamPath از رجیستری + پارس
     libraryfolders.vdf و فایل‌های .acf هر کتابخانه
   • نتیجه در userData/discovered_apps.json کش می‌شود (اعتبار ۲۴ ساعت)
   ============================================================ */
const APPS_FILE = () => { try { return path.join(app.getPath('userData'), 'discovered_apps.json'); } catch (_) { return null; } };
const APPS_TTL = 24 * 60 * 60 * 1000;
const APP_NAME_JUNK = /(unins|uninst|setup|install(?!er\.exe)|update|upgrade|license|readme|help|crash|report|uninstall|حذف|نصب)/i;
let appsCache = null;
let appsScanning = null; /* Promise جریان اسکن — از اسکن موازی جلوگیری می‌کند */

function readAppsCache() {
  if (appsCache) return appsCache;
  const f = APPS_FILE();
  if (!f) return null;
  try { appsCache = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { appsCache = null; }
  return appsCache;
}

function saveAppsCache() {
  const f = APPS_FILE();
  if (!f || !appsCache) return;
  try {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(appsCache, 'utf8'));
  } catch (_) { /* noop */ }
}

/* اسکن Start Menu با یک فایل ps1 موقت — بدون وابستگی خارجی */
function scanStartMenu() {
  return new Promise((resolve) => {
    try {
      const psBody = [
        "$ErrorActionPreference = 'SilentlyContinue'",
        "$dirs = @($env:ProgramData + '\\Microsoft\\Windows\\Start Menu\\Programs', $env:AppData + '\\Microsoft\\Windows\\Start Menu\\Programs')",
        "$sh = New-Object -ComObject WScript.Shell",
        "foreach ($d in $dirs) {",
        "  if (Test-Path $d) {",
        "    Get-ChildItem -Path $d -Recurse -Filter *.lnk | ForEach-Object {",
        "      try {",
        "        $lnk = $sh.CreateShortcut($_.FullName)",
        "        $t = $lnk.TargetPath",
        "        if ($t -and $t -match '\\.(exe|bat|cmd)$') {",
        "          Write-Output ($_.BaseName + '|' + $t + '|' + $_.FullName)",
        "        }",
        "      } catch {}",
        "    }",
        "  }",
        "}",
      ].join('\r\n');
      const file = path.join(os.tmpdir(), `ava-scan-${Date.now()}.ps1`);
      fs.writeFileSync(file, psBody, 'utf8');
      exec(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${file}"`,
        { windowsHide: true, timeout: 60000, maxBuffer: 1024 * 1024 * 4 },
        (err, stdout) => {
          try { fs.unlinkSync(file); } catch (_) { /* noop */ }
          const out = [];
          if (!err && stdout) {
            for (const line of String(stdout).split(/\r?\n/)) {
              const s = line.trim();
              if (!s) continue;
              const parts = s.split('|');
              if (parts.length < 3) continue;
              const [name, exe, lnk] = [parts[0].trim(), parts.slice(1, parts.length - 1).join('|').trim(), parts[parts.length - 1].trim()];
              if (!name || !exe || APP_NAME_JUNK.test(name)) continue;
              if (exe.length > 260) continue;
              out.push({ name, exe, lnk, kind: 'app' });
            }
          }
          resolve(out);
        }
      );
    } catch (_) { resolve([]); }
  });
}

/* اسکن بازی‌های Steam — خواندن رجیستری + libraryfolders.vdf + .acf */
function scanSteam() {
  return new Promise((resolve) => {
    exec(
      'reg query HKCU\\Software\\Valve\\Steam /v SteamPath',
      { windowsHide: true, timeout: 8000 },
      (err, stdout) => {
        if (err || !stdout) return resolve([]);
        const m = String(stdout).match(/SteamPath\s+REG_SZ\s+(.+)/i);
        const steamRoot = m && m[1].trim().replace(/\\$/, '');
        if (!steamRoot) return resolve([]);
        try {
          /* کتابخانه‌ها از libraryfolders.vdf */
          const libs = [steamRoot];
          try {
            const vdf = fs.readFileSync(path.join(steamRoot, 'steamapps', 'libraryfolders.vdf'), 'utf8');
            for (const mm of vdf.matchAll(/"path"\s+"([^"]+)"/g)) {
              const p = mm[1].replace(/\\\\/g, '\\');
              if (!libs.includes(p)) libs.push(p);
            }
          } catch (_) { /* noop */ }
          const games = [];
          for (const lib of libs) {
            const dir = path.join(lib, 'steamapps');
            let files = [];
            try { files = fs.readdirSync(dir).filter((x) => x.toLowerCase().endsWith('.acf')); } catch (_) { continue; }
            for (const acf of files) {
              try {
                const txt = fs.readFileSync(path.join(dir, acf), 'utf8');
                const nm = txt.match(/"name"\s+"([^"]+)"/);
                const id = acf.match(/appmanifest_(\d+)\.acf/i);
                if (nm && id && !APP_NAME_JUNK.test(nm[1])) {
                  games.push({ name: nm[1], exe: `steam://rungameid/${id[1]}`, lnk: '', kind: 'steam', appid: id[1] });
                }
              } catch (_) { /* noop */ }
            }
          }
          resolve(games);
        } catch (_) { resolve([]); }
      }
    );
  });
}

/* نرمال‌سازی نام برنامه برای مچ سریع */
const normAppName = (s) =>
  String(s || '').toLowerCase()
    .replace(/[\u064A]/g, '\u06CC').replace(/[\u0643]/g, '\u06A9')
    .replace(/[\s\u200C_.\-()\[\]]+/g, ' ')
    .replace(/[^a-z0-9\u0600-\u06FF ]/g, '')
    .replace(/\s+/g, ' ').trim();

async function scanAllApps(force = false) {
  const cache = readAppsCache();
  if (!force && cache && cache.at && Date.now() - cache.at < APPS_TTL && Array.isArray(cache.apps)) return cache.apps;
  if (appsScanning) return appsScanning;
  appsScanning = (async () => {
    const [menu, steam] = await Promise.all([scanStartMenu(), scanSteam()]);
    /* حذف تکراری بر اساس نام نرمال‌شده — اولویت با .exe واقعی */
    const seen = new Map();
    for (const a of [...menu, ...steam]) {
      const k = normAppName(a.name);
      if (!k) continue;
      const prev = seen.get(k);
      if (!prev || (prev.kind === 'steam' && a.kind === 'app')) seen.set(k, a);
    }
    const apps = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
    appsCache = { at: Date.now(), apps };
    saveAppsCache();
    return apps;
  })();
  try { return await appsScanning; } finally { appsScanning = null; }
}

ipcMain.handle('apps:list', async () => {
  try {
    const cache = readAppsCache();
    const stale = !cache || !cache.at || Date.now() - cache.at >= APPS_TTL || !Array.isArray(cache.apps);
    if (stale) {
      /* اسکن در پس‌زمینه؛ اول لیست کش (اگر هست) برگردد */
      scanAllApps().catch(() => {});
      return { ok: true, apps: (cache && cache.apps) || [], stale: true };
    }
    return { ok: true, apps: cache.apps, stale: false };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e), apps: [] };
  }
});

ipcMain.handle('apps:scan', async () => {
  try {
    const apps = await scanAllApps(true);
    return { ok: true, apps, count: apps.length };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e), apps: [] };
  }
});

/* اجرای برنامه اسکن‌شده — فقط مسیرهایی که واقعا در نتیجه اسکن بودند
   (فهرست سفید امن؛ هیچ ورودی دلخواهی به شل تزریق نمی‌شود) */
ipcMain.handle('apps:launch', async (_e, p) => {
  try {
    const apps = await scanAllApps();
    const k = normAppName(p && p.name);
    const hit = apps.find((a) => normAppName(a.name) === k && a.exe === (p && p.exe));
    if (!hit) return { ok: false, error: 'این برنامه در نتیجه اسکن نبود — اول اسکن انجام شود' };
    const cmdStr = hit.kind === 'steam'
      ? `start "" "${hit.exe}"`
      : `start "" "${String(hit.exe).replace(/"/g, '')}"`;
    return new Promise((resolve) => {
      exec(cmdStr, { windowsHide: true, timeout: 10000 }, (err) => {
        resolve(err ? { ok: false, error: 'اجرا نشد — فایل ممکن است جابه‌جا شده باشد' } : { ok: true, name: hit.name });
      });
    });
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

/* ============================================================
   یادآوری‌ها (v0.12) — معادل reminders.py
   ذخیره در ava-reminders.json + ترد تیک پس‌زمینه (۴ ثانیه)
   که زمان رسیده را به رندرر می‌فرستد تا آوا آن را بلند بگوید.
   ============================================================ */
const REM_FILE = () => { try { return path.join(app.getPath('userData'), 'ava-reminders.json'); } catch (_) { return null; } };
let reminders = [];
function loadReminders() {
  const f = REM_FILE();
  if (!f) return;
  try { reminders = JSON.parse(fs.readFileSync(f, 'utf8')) || []; } catch (_) { reminders = []; }
  if (!Array.isArray(reminders)) reminders = [];
}
function saveReminders() {
  const f = REM_FILE();
  if (!f) return;
  try {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(reminders, null, 2));
  } catch (_) { /* noop */ }
}
loadReminders();
setInterval(() => {
  const now = Date.now();
  const due = reminders.filter((r) => !r.done && r.at <= now);
  if (!due.length) return;
  for (const r of due) r.done = true;
  reminders = reminders.filter((r) => !r.done);
  saveReminders();
  for (const r of due) sendUI('reminders:due', { id: r.id, text: r.text, at: r.at });
}, 4000);

ipcMain.handle('reminders:add', (_e, p) => {
  const text = String((p && p.text) || '').trim().slice(0, 300);
  const at = Number(p && p.at);
  if (!text) return { ok: false, error: 'متن یادآوری خالی است' };
  if (!Number.isFinite(at) || at <= Date.now() + 3000) return { ok: false, error: 'زمان یادآوری باید در آینده باشد' };
  if (reminders.length >= 100) return { ok: false, error: 'فهرست یادآوری‌ها پر است' };
  const rem = { id: Date.now() + Math.floor(Math.random() * 999), text, at };
  reminders.push(rem);
  saveReminders();
  return { ok: true, reminder: rem };
});
ipcMain.handle('reminders:list', () => ({ ok: true, reminders: reminders.filter((r) => !r.done).sort((a, b) => a.at - b.at) }));
ipcMain.handle('reminders:remove', (_e, id) => {
  reminders = reminders.filter((r) => r.id !== Number(id));
  saveReminders();
  return { ok: true };
});
ipcMain.handle('reminders:clear', () => { reminders = []; saveReminders(); return { ok: true }; });

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

/* ---------- به‌روزرسان خودکار چندلایه (electron-updater + GitHub) ----------
   لایه ۱: electron-updater — بررسی، دانلود دلتا و نصب خودکار
   لایه ۲: بررسی مستقیم GitHub با سه مسیر (api.github.com → JSON صفحهٔ
           releases/latest → فید releases.atom) تا اگر لایهٔ اول به هر دلیل
           (شبکه/تحریم/کش) «نسخهٔ جدید نیست» گفت یا خطا داد، ما خودمان
           نسخهٔ واقعی را پیدا کنیم.
   لایه ۳: دانلود مستقیم نصّاب داخل برنامه (بدون electron-updater) و اجرای آن.
   همهٔ تلاش‌ها در فایل updater.log ثبت می‌شود تا خطاها قابل ردیابی باشند. */
const UPD_REPO = { owner: 'pvwvuow', repo: 'ava-voice-assistant' };

const sendUI = (ch, payload) => {
  if (win && !win.isDestroyed()) win.webContents.send(ch, payload);
};

let autoCheckEnabled = true; // از تنظیمات UI قابل خاموش‌کردن است

function updLog(msg) {
  try {
    fs.appendFileSync(path.join(app.getPath('userData'), 'updater.log'), `[${new Date().toISOString()}] ${msg}\n`);
  } catch (_) { /* noop */ }
}

function cmpVersions(a, b) {
  const pa = String(a || '').replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '').replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

/* درخواست HTTP ساده با مهلت زمانی (برای پاسخ‌های کوچک: JSON/XML/YML) */
function ghRequest(url, headers, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    try {
      const req = net.request({ url, redirect: 'follow' });
      req.setHeader('User-Agent', 'AVA-Voice-Assistant-Updater');
      Object.entries(headers || {}).forEach(([k, v]) => req.setHeader(k, v));
      let done = false;
      const chunks = [];
      let size = 0;
      const finish = (err, data) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { req.abort(); } catch (_) { /* noop */ }
        err ? reject(err) : resolve(data);
      };
      const timer = setTimeout(() => finish(new Error('timeout')), timeoutMs);
      req.on('response', (res) => {
        res.on('data', (c) => {
          size += c.length;
          if (size > 8 * 1024 * 1024) return finish(new Error('response too large'));
          chunks.push(c);
        });
        res.on('end', () => finish(null, Buffer.concat(chunks).toString('utf8')));
        res.on('error', (e) => finish(e));
      });
      req.on('error', (e) => finish(e));
      req.end();
    } catch (e) { reject(e); }
  });
}

/* آخرین نسخهٔ منتشرشده را با ۳ مسیر مختلف بررسی می‌کنیم؛
   کافی است یکی جواب بدهد تا «نسخهٔ جدید» از قلم نیفتد. */
async function manualCheckLatest() {
  const { owner, repo } = UPD_REPO;
  /* مسیر ۱: API رسمی — assets را هم می‌دهد (برای دانلود مستقیم) */
  try {
    const txt = await ghRequest(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, { Accept: 'application/vnd.github+json' });
    const j = JSON.parse(txt);
    if (j && j.tag_name) {
      let exeUrl = null;
      let exeSize = 0;
      (j.assets || []).forEach((a) => {
        if (/AVA-Setup-.+\.exe$/i.test(a.name || '')) { exeUrl = a.browser_download_url; exeSize = a.size || 0; }
      });
      return { version: String(j.tag_name).replace(/^v/, ''), url: exeUrl, size: exeSize, via: 'api' };
    }
  } catch (e) { updLog(`manual check via api failed: ${(e && e.message) || e}`); }
  /* مسیر ۲: صفحهٔ releases/latest در github.com — پاسخ JSON، بدون سهمیهٔ API */
  try {
    const txt = await ghRequest(`https://github.com/${owner}/${repo}/releases/latest`, { Accept: 'application/json' });
    const j = JSON.parse(txt);
    if (j && j.tag_name) return { version: String(j.tag_name).replace(/^v/, ''), url: null, size: 0, via: 'web-json' };
  } catch (e) { updLog(`manual check via web-json failed: ${(e && e.message) || e}`); }
  /* مسیر ۳: فید اتم — همیشه در دسترس */
  try {
    const xml = await ghRequest(`https://github.com/${owner}/${repo}/releases.atom`, { Accept: 'application/atom+xml, application/xml, text/xml, */*' });
    const m = /\/tag\/(v?\d+\.\d+\.\d+)</.exec(xml);
    if (m) return { version: m[1].replace(/^v/, ''), url: null, size: 0, via: 'atom' };
  } catch (e) { updLog(`manual check via atom failed: ${(e && e.message) || e}`); }
  return { version: null, url: null, size: 0, via: 'none' };
}

/* بررسی هوشمند: اول electron-updater، بعد بررسی مستقیم به‌عنوان پشتیبان */
let updCheckBusy = false;
async function smartUpdateCheck(trigger) {
  if (updCheckBusy) return { ok: true, busy: true };
  updCheckBusy = true;
  try {
    updLog(`check (${trigger}) — current v${app.getVersion()}`);
    let updaterError = null;
    try {
      const r = await autoUpdater.checkForUpdates();
      const info = r && r.updateInfo;
      if (info && cmpVersions(info.version, app.getVersion()) > 0) {
        /* v0.21 — دیگر دانلود خودکار در پس‌زمینه انجام نمی‌شود! دانلودِ خودکارِ
       بی‌اجازه (۸۰+ مگابایت) پهنای باند کاربر را اشباع می‌کرد و همین باعث
       «کندی شدید» دستیار صوتی، دیسکورد و همهٔ درخواست‌های ابری می‌شد.
       حالا فقط «پیدا» می‌شود و دانلود هر وقت خود کاربر خواست شروع می‌شود. */
        updLog(`updater found v${info.version} → waiting for user to download`);
        return { ok: true, found: info.version, manual: false };
      }
      updLog(`updater says not-available (info v${(info && info.version) || '?'}) — double-checking via direct GitHub`);
    } catch (e) {
      updaterError = String((e && e.message) || e);
      updLog(`updater error: ${updaterError}`);
    }
    const m = await manualCheckLatest();
    if (!m.version) {
      const msg = updaterError || 'اتصال به GitHub ممکن نشد';
      updLog(`no route could fetch the latest version`);
      sendUI('updater:status', { state: 'error', message: msg.slice(0, 160) });
      return { ok: false, error: msg };
    }
    if (cmpVersions(m.version, app.getVersion()) <= 0) {
      updLog(`direct check (${m.via}): latest v${m.version} → no update`);
      sendUI('updater:status', { state: 'none' });
      return { ok: true, found: null };
    }
    updLog(`direct check (${m.via}) found v${m.version} → offering direct download`);
    sendUI('updater:status', { state: 'available-manual', version: m.version, size: m.size });
    return { ok: true, found: m.version, manual: true };
  } finally {
    updCheckBusy = false;
  }
}

function setupAutoUpdater() {
  if (!autoUpdater || !app.isPackaged) return; // در حالت dev (npm start) غیرفعال
  try {
    /* v0.21 — دانلود دیگر «هرگز» خودکار نیست: دانلودِ پشت‌زمینه‌ایِ بی‌اجازه
       پهنای باند را می‌خورد و دستیار صوتی/دیسکورد را روی شبکه‌های عادی
       فلج می‌کرد (گلهٔ اصلی کاربر: «نزدیک یک دقیقه طول می‌کشد»).
       آپدیت پیدا می‌شود → کاربر خبردار می‌شود → دانلود فقط با کلیک خودش. */
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true; // نصب هنگام بستن برنامه اگر کاربر نصب فوری نزند
    autoUpdater.allowPrerelease = false;
    autoUpdater.allowDowngrade = false;
    /* v0.16.1 — آپدیت دلتا غیرفعال شد: آپدیت‌های پلکانی از نسخه‌های خیلی عقب
       (مثل 0.13 → 0.16) می‌توانستند فایل ناقص/خراب نصب کنند و برنامه «هیچ‌کاره» شود.
       از این به بعد همیشه نصّاب کامل دانلود می‌شود — مطمئن‌تر. */
    /* v0.18 — آپدیت دلتا دوباره فعال شد (خواست کاربر): فقط بخش‌های تغییر
       کردهٔ نصّاب دانلود می‌شود (blockmap-based) — بعد از سرهم، SHA512 فایل
       توسط electron-updater تأیید می‌شود و اگر خراب بود خودکار دانلود کامل
       انجام می‌گیرد؛ لایه‌های ۲ و ۳ به‌روزرسان هم همچنان پشتیبان هستند. */
    try { autoUpdater.disableDifferentialDownload = false; } catch (_) { /* noop */ }
    /* v0.19 — لاگ تفصیلی electron-updater (دلتا یا کامل؟ چند بایت؟) در updater.log */
    try {
      autoUpdater.logger = {
        info: (m) => updLog('updater: ' + m),
        warn: (m) => updLog('updater warn: ' + m),
        error: (m) => updLog('updater error: ' + m),
        debug: (m) => updLog('updater debug: ' + m),
      };
    } catch (_) { /* noop */ }
    autoUpdater.on('checking-for-update', () => sendUI('updater:status', { state: 'checking' }));
    autoUpdater.on('update-available', (i) => { actLog(`updater available v${i && i.version}`, 'update'); sendUI('updater:status', { state: 'available', version: i && i.version }); });
    autoUpdater.on('update-not-available', () => { actLog('updater: already latest', 'update'); sendUI('updater:status', { state: 'none' }); });
    let lastUpdMile = 0;
    let updLastPct = 0; /* v0.21 — برای نشان دادن «توقف در چند٪» */
    autoUpdater.on('download-progress', (p) => {
      updLastPct = Math.round(p.percent || 0);
      try { updLastProgress = p; } catch (_) { /* noop */ } /* v0.21 — برای «توقف در چند٪» */
      const mb = (n) => Math.max(0, Math.round(((n || 0) / 1048576) * 10) / 10);
      sendUI('updater:status', {
        state: 'downloading',
        percent: updLastPct,
        transferred: mb(p.transferred),
        total: mb(p.total),
        delta: p.transferred > 0 && p.total > 0 && p.transferred < p.total * 0.8,
      });
      /* ثبت بایت واقعی منتقل‌شده — اگر دلتا کار کند transferred ≪ total است */
      const mile = Math.floor((p.percent || 0) / 20);
      if (mile > lastUpdMile) {
        lastUpdMile = mile;
        actLog(`updater download ${updLastPct}% transferred=${mb(p.transferred)}MB / total=${mb(p.total)}MB ${p.transferred < (p.total || 0) * 0.8 ? '(DELTA)' : ''}`, 'update');
      }
    });
    autoUpdater.on('update-downloaded', (i) => { actLog(`updater downloaded v${i && i.version}`, 'update'); sendUI('updater:status', { state: 'ready', version: i && i.version }); });
    autoUpdater.on('error', (e) => {
      const msg = String((e && e.message) || e);
      updLog(`updater event error: ${msg}`);
      sendUI('updater:status', { state: 'error', message: msg.slice(0, 160) });
    });
    /* بررسی خودکار ۱۲ ثانیه بعد از باز شدن برنامه (اگر کاربر خاموشش نکرده باشد) */
    setTimeout(() => {
      if (autoCheckEnabled) smartUpdateCheck('auto').catch(() => {});
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
  return smartUpdateCheck('manual');
});

/* ---------- v0.21 — دانلود به اختیار کاربر: شروع / توقف / ادامه / لغو ----------
   توقف = قطع جریان دانلود (CancellationToken) و به‌خاطر سپردن درصد؛
   ادامه = دانلود دوباره (اگر نصاب قدیمی در کش باشد، دلتا فقط اختلاف را می‌گیرد)؛
   لغو = قطع و پاک کردن وضعیت. برای دانلود مستقیم (لایهٔ ۳) هم لغو وصل است. */
let updToken = null;
let updBusy = false;
let updPausedPct = -1;
ipcMain.handle('updater:download', async () => {
  if (!autoUpdater || !app.isPackaged) return { ok: false, dev: true };
  if (updBusy) return { ok: false, error: 'دانلود در جریان است' };
  /* اگر دانلود مستقیم (لایهٔ ۳) در جریان است، اول لغو شود */
  if (manualDl && manualDl.active) { manualDl.cancel = true; }
  updBusy = true;
  updPausedPct = -1;
  try {
    updLog('user-triggered download start');
    actLog('updater download start (user)', 'update');
    /* مطمئن شو updateInfo آماده است (اگر check قبلی نبود، خودمان می‌گیریم؛
       autoDownload=false است پس چیزی دانلود نمی‌شود) */
    try { await autoUpdater.checkForUpdates(); } catch (_) { /* خطا → downloadUpdate خودش خطای واضح می‌دهد */ }
    updToken = CancellationToken ? new CancellationToken() : null;
    await autoUpdater.downloadUpdate(updToken || undefined);
    sendUI('updater:status', { state: 'ready' }); /* اگر event خودش نرسیده بود */
    return { ok: true };
  } catch (e) {
    const msg = String((e && e.message) || e);
    const wasCancel = !!(updToken && updToken.cancelled) || /cancel|abort/i.test(msg);
    updLog(`download ended: ${wasCancel ? 'stopped by user' : msg}`);
    if (wasCancel) {
      sendUI('updater:status', { state: updPausedPct >= 0 ? 'paused' : 'canceled', percent: Math.max(0, updPausedPct) });
      return { ok: false, cancelled: true };
    }
    sendUI('updater:status', { state: 'error', message: msg.slice(0, 160) });
    return { ok: false, error: msg };
  } finally {
    updBusy = false;
    try { if (updToken) updToken.cancel(); } catch (_) { /* noop */ }
    updToken = null;
  }
});
ipcMain.handle('updater:cancel', (_e, pause) => {
  try {
    if (updToken && !updToken.cancelled) {
      updPausedPct = pause ? updLastPctSafe() : -1;
      try { updToken.cancel(); } catch (_) { /* noop */ }
      updLog(pause ? 'download PAUSED by user' : 'download CANCELLED by user');
      actLog(`updater ${pause ? 'pause' : 'cancel'} (user)`, 'update');
    }
    if (manualDl && manualDl.active) {
      manualDl.cancel = true;
      updLog('manual (direct) download cancel requested');
    }
    sendUI('updater:status', pause ? { state: 'paused', percent: updPausedPct < 0 ? 0 : updPausedPct } : { state: 'canceled' });
    return { ok: true };
  } catch (_) { return { ok: false };
  }
});
function updLastPctSafe() {
  /* آخرین درصد دانلود — از متغیر بستهٔ event handler قابل دسترس نیست،
     پس از progress event آخر ذخیره‌شده روی خود autoUpdater استفاده می‌کنیم */
  try { return Math.round((updLastProgress && updLastProgress.percent) || 0); } catch (_) { return 0; }
}
/* لایه ۳: دانلود مستقیم نصّاب داخل برنامه (بدون electron-updater) */
let manualDl = null; // { file, version, url, active }
let updLastProgress = null; /* v0.21 — آخرین progress برای محاسبهٔ درصد هنگام توقف */

/* v0.21 — پارامتر cancelFlag: دانلود مستقیم هم قابل لغو شد (خواست کاربر) */
function ghDownloadToFile(url, file, onPercent, cancelFlag) {
  return new Promise((resolve, reject) => {
    const req = net.request({ url, redirect: 'follow' });
    req.setHeader('User-Agent', 'AVA-Voice-Assistant-Updater');
    let done = false;
    let received = 0;
    let total = 0;
    let lastPct = -1;
    const ws = fs.createWriteStream(file);
    const finish = (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (err) {
        try { req.abort(); } catch (_) { /* noop */ }
        try { ws.destroy(); } catch (_) { /* noop */ }
        reject(err);
      } else resolve();
    };
    const timer = setTimeout(() => finish(new Error('timeout')), 1000 * 60 * 30); // ۳۰ دقیقه سقف
    req.on('response', (res) => {
      total = parseInt(res.headers['content-length'] || '0', 10);
      res.on('data', (c) => {
        if (cancelFlag && cancelFlag.cancel) {
          finish(new Error('cancelled'));
          return;
        }
        received += c.length;
        ws.write(c);
        if (total) {
          const pct = Math.floor((received * 100) / total);
          if (pct !== lastPct) { lastPct = pct; try { onPercent && onPercent(pct); } catch (_) { /* noop */ } }
        }
      });
      res.on('end', () => ws.end(() => finish(null)));
      res.on('error', (e) => finish(e));
    });
    req.on('error', (e) => finish(e));
    req.end();
  });
}

ipcMain.handle('updater:download-manual', async () => {
  if (manualDl && manualDl.active) return { ok: false, error: 'دانلود در جریان است' };
  try {
    if (!app.isPackaged) return { ok: false, dev: true };
    const meta = await manualCheckLatest();
    if (!meta.version) return { ok: false, error: 'یافتن نسخهٔ جدید ممکن نشد' };
    if (cmpVersions(meta.version, app.getVersion()) <= 0) return { ok: true, latest: true };
    const url = meta.url || `https://github.com/${UPD_REPO.owner}/${UPD_REPO.repo}/releases/download/v${meta.version}/AVA-Setup-${meta.version}.exe`;
    const file = path.join(app.getPath('downloads'), `AVA-Setup-${meta.version}.exe`);
    manualDl = { file, version: meta.version, url, active: true, cancel: false };
    sendUI('updater:status', { state: 'downloading', percent: 0 });
    await ghDownloadToFile(url, file, (pct) => sendUI('updater:status', { state: 'downloading', percent: pct, manual: true }), manualDl);
    manualDl.active = false;
    updLog(`manual download complete: ${file} (${meta.via})`);
    sendUI('updater:status', { state: 'ready-manual', version: meta.version });
    return { ok: true, file };
  } catch (e) {
    if (manualDl) manualDl.active = false;
    const msg = String((e && e.message) || e);
    if (/cancel/i.test(msg)) {
      updLog('manual download cancelled by user');
      sendUI('updater:status', { state: 'canceled' });
      return { ok: false, cancelled: true };
    }
    updLog(`manual download failed: ${msg}`);
    sendUI('updater:status', { state: 'error', message: msg.slice(0, 160) });
    return { ok: false, error: msg };
  }
});

ipcMain.handle('updater:install', () => {
  /* اگر نصّاب به‌صورت مستقیم دانلود شده، همان را اجرا کن */
  if (manualDl && manualDl.file && fs.existsSync(manualDl.file)) {
    updLog(`install via manually downloaded installer: ${manualDl.file}`);
    shell.openPath(manualDl.file).then(() => setTimeout(() => app.quit(), 1500));
    return true;
  }
  if (autoUpdater && app.isPackaged) autoUpdater.quitAndInstall(false, true);
  return false;
});

/* ---------- IPC: تنظیمات سیستمی ---------- */
/* کپی متن در کلیپ‌بورد ویندوز (گزارش خطاها — v0.16.1) */
ipcMain.handle('sys:copy-text', (_e, txt) => {
  try { clipboard.writeText(String(txt || '')); return true; } catch (_) { return false; }
});

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
   پینگ DNSها (v0.13) — برای هر پروفایل، آی‌پی اول (و در صورت
   شکست آی‌پی دوم) پینگ می‌شود. خروجی مرتب بر اساس سریع‌ترین.
   ============================================================ */
ipcMain.handle('dns:ping', async (_e, list) => {
  const targets = (Array.isArray(list) ? list : [])
    .filter((p) => p && p.name && Array.isArray(p.ips) && p.ips.length)
    .slice(0, 40);

  const pingIp = (ip) =>
    new Promise((res) => {
      const clean = String(ip || '').replace(/[^0-9.]/g, '');
      if (!clean) return res({ ok: false, ms: null });
      exec(
        `ping -n 1 -w 1500 ${clean}`,
        { windowsHide: true, timeout: 4500 },
        (err, stdout) => {
          const s = String(stdout || '');
          if (/(unreachable|could not find host|timed out|General failure|ناموفق|غیرقابل دسترسی|توقف زمان)/i.test(s) || (err && !s)) {
            return res({ ok: false, ms: null });
          }
          const m = s.match(/(?:time|زمان)[=<]\s*(\d+)\s*ms/i);
          if (m) return res({ ok: true, ms: Number(m[1]) || (s.includes('<') ? 1 : 0) });
          /* «time<1ms» — کمتر از یک میلی‌ثانیه */
          if (/<\s*1\s*ms/i.test(s)) return res({ ok: true, ms: 1 });
          res({ ok: false, ms: null });
        }
      );
    });

  const results = await Promise.all(
    targets.map(async (p) => {
      let r = await pingIp(p.ips[0]);
      if (!r.ok && p.ips[1]) {
        const r2 = await pingIp(p.ips[1]);
        if (r2.ok) r = { ok: true, ms: r2.ms, alt: true };
      }
      return { name: String(p.name).slice(0, 40), ip: p.ips[0], ms: r.ms, ok: r.ok };
    })
  );
  results.sort((a, b) => (a.ok === b.ok ? (a.ms ?? 9999) - (b.ms ?? 9999) : a.ok ? -1 : 1));
  return { ok: true, results };
});

/* ============================================================
   «DNS جدید» — نسخه ۰.۱۰: دیگر پنجره جدا نیست؛ فرم شیشه‌ای
   کوچک داخل خود صفحه اصلی باز می‌شود (با انیمیشن). ذخیره هم
   مستقیم از رندرر با settings:save انجام می‌شود؛ فقط رویداد
   درخواست باز شدن از این‌جا می‌آید (برای همگام‌بودن).
   ============================================================ */
ipcMain.handle('dns:quick-open', () => {
  try {
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.webContents.send('dns:quick-request');
      return { ok: true };
    }
    return { ok: false, error: 'پنجره اصلی در دسترس نیست' };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
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
const WMO_EN = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Foggy', 48: 'Freezing fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Freezing drizzle', 57: 'Heavy freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Heavy freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Light showers', 81: 'Showers', 82: 'Violent showers', 85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Severe thunderstorm',
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
      descEn: WMO_EN[cur.weather_code] || 'Unknown',
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
  const keys = splitKeys(key);
  if (!keys.length) return { ok: false, error: 'کلید GLM تنظیم نشده — از تنظیمات واردش کن' };
  if (!Array.isArray(messages) || !messages.length) return { ok: false, error: 'پیام خالی است' };
  let lastErr = null;
  /* v0.21 — سریع‌تر: بدون «فکر کردن» (GLM-4.5/4.6 از پارامتر thinking
       پشتیبانی می‌کنند؛ مدل‌های قدیمی‌تر آن را نادیده می‌گیرند) + سقف ۳۵ ثانیه */
  const body = {
    model: model || 'glm-4.6',
    messages: messages.slice(-16), // فقط ۸ رد و بدل آخر
    temperature: typeof temperature === 'number' ? temperature : 0.6,
    max_tokens: 700, /* v0.19 — پاسخ کوتاه‌تر = سریع‌تر (حداکثر ۳ جمله در راهنمای سیستم) */
    stream: false,
  };
  if (/4\.[56]|4\.5|air|flash|plus/i.test(String(body.model))) body.thinking = { type: 'disabled' };
  /* چرخش چندکلیدی: اگر کلیدی محدود شد، بلافاصله سراغ بعدی */
  for (const k of keys) {
    try {
      const r = await fetch(trimBase(base) + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${k}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(35000), /* v0.21: ۶۰→۳۵ ثانیه */
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = (j && j.error && (j.error.message || j.error.code)) || `HTTP ${r.status}`;
        lastErr = `GLM: ${msg}`;
        /* کلید نامعتبر/محدود → مدل‌ها بی‌فایده‌اند، فقط کلید بعدی (v0.21) */
        continue;
      }
      const text = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (!text) { lastErr = 'پاسخ خالی از سرور رسید'; continue; }
      return { ok: true, text };
    } catch (e) {
      lastErr = netErr(e);
    }
  }
  return { ok: false, error: lastErr || 'هیچ کلید GLM جواب نداد' };
});

/* ---------- موتور رایگان گوگل برای تشخیص گفتار (بدون هیچ کلیدی) ----------
   رندرر PCM ۱۶کیلوهرتز تک‌کاناله می‌فرستد؛ این‌جا مستقیم به سرور
   تشخیص گفتار گوگل (همان موتور داخلی کروم) POST می‌شود. کلید پیش‌فرض،
   کلید عمومی خود کرومیوم است — کاربر هیچ توکنی لازم ندارد.
   (تعریف کلید در بالای فایل، قبل از ready انجام شده تا موتور وب هم فعال شود) */

/* ---------- چت با GLM بدون کلید API — با نشست حساب z.ai کاربر ----------
   مسیر اصلی (v0.9): یک پنجره مخفی با همان نشست دائمی «persist:ai»
   (همان پارتیشن webview صفحه چت) chat.z.ai را باز نگه می‌دارد و
   درخواست از «داخل خود صفحه» فرستاده می‌شود؛ یعنی کوکی‌ها، توکن
   localStorage، هدرهای Origin/Referer و هویت مرورگر دقیقاً همان
   چیزی است که خود سایت z.ai می‌فرستد — مثل این که کاربر خودش در
   همان چت تایپ کرده باشد. پیام کاربر بی‌هیچ تغییری به z.ai می‌رود
   و جوابش هم عیناً به آوا برمی‌گردد.
   فالبک: اگر پنجره مخفی آماده نبود، درخواست مستقیم با توکن
   (که رندرر از webview خوانده) تکرار می‌شود. */
let zaiWin = null;          /* پنجره پل مخفی */
let zaiWinLoading = null;   /* آخرین لود در جریان */

function ensureZaiBridge() {
  try {
    if (zaiWin && !zaiWin.isDestroyed()) return zaiWin;
    zaiWinLoading = null;
    zaiWin = new BrowserWindow({
      show: false,
      width: 480,
      height: 600,
      webPreferences: {
        partition: 'persist:ai',
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false,
        backgroundThrottling: false,
      },
    });
    zaiWin.loadURL('https://chat.z.ai/');
    zaiWinLoading = new Promise((res) => {
      const to = setTimeout(res, 20000); /* حتی اگر لود کند شد، ادامه بده */
      zaiWin.webContents.once('did-finish-load', () => { clearTimeout(to); res(); });
      zaiWin.webContents.once('did-fail-load', () => { clearTimeout(to); res(); });
    });
    zaiWin.on('closed', () => { zaiWin = null; zaiWinLoading = null; });
    return zaiWin;
  } catch (_) {
    return null;
  }
}

/* اسکریپتی که داخل صفحه z.ai اجرا می‌شود: توکن نشست را می‌خواند،
   مدل را انتخاب می‌کند و SSE جواب را جمع می‌کند — همه در همان Origin */
function buildZaiPageScript(messages, model) {
  const payload = JSON.stringify({ messages, model: String(model || '') });
  return `(async () => {
    const CFG = ${payload};
    try {
      const token = String(localStorage.getItem('token') || localStorage.getItem('sessionToken') || '').trim();
      if (!token) return { ok: false, needLogin: true, error: 'no-token' };
      let mdl = String(CFG.model || '').trim();
      if (!mdl) {
        try {
          const mr = await fetch('/api/models', { headers: { Authorization: 'Bearer ' + token } });
          const mj = await mr.json().catch(function () { return {}; });
          const ids = (((mj && mj.data) || []))
            .filter(function (m) { return !m || !m.info || m.info.is_active !== false; })
            .map(function (m) { return String(m && m.id); }).filter(Boolean);
          mdl = ids.find(function (i) { return /glm[-_]?4\\.6/i.test(i); })
            || ids.find(function (i) { return /glm/i.test(i); })
            || ids[0] || 'GLM-4.6';
        } catch (e) { mdl = 'GLM-4.6'; }
      }
      const uuid = function () { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.floor(Math.random() * 1e6); };
      const r = await fetch('/api/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          stream: true,
          chat_id: uuid(),
          id: uuid(),
          model: mdl,
          messages: CFG.messages,
          features: { enable_thinking: false },
        }),
      });
      if (r.status === 401) return { ok: false, needLogin: true, error: 'expired' };
      if (!r.ok) return { ok: false, error: 'HTTP ' + r.status };
      const ct = String(r.headers.get('content-type') || '');
      let text = '';
      const feed = function (raw) {
        raw.split('\\n').forEach(function (line) {
          const s = line.trim();
          if (!s.startsWith('data:')) return;
          const d = s.slice(5).trim();
          if (!d || d === '[DONE]') return;
          try {
            const j = JSON.parse(d);
            const c = j && j.choices && j.choices[0];
            if (c && (c.delta || c.message)) {
              const dv = (c.delta && c.delta.content) || (c.message && c.message.content) || '';
              if (dv) text += dv;
              return;
            }
            const dd = j && typeof j.data === 'object' ? j.data : null;
            if (!dd) return;
            if (dd.phase && dd.phase !== 'answer') return;
            let piece = String(dd.delta_content || dd.edit_content || '');
            if (piece && /<summary>/i.test(piece)) piece = piece.replace(/<details[^>]*>[\\s\\S]*?<\\/details>/gi, '');
            if (piece) text += piece;
          } catch (e) {}
        });
      };
      if (ct.indexOf('text/event-stream') !== -1 || ct.indexOf('json') === -1) {
        feed(await r.text());
      } else {
        const j = await r.json().catch(function () { return {}; });
        text = (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
      }
      text = text.replace(/\\n{3,}/g, '\\n\\n').trim();
      return { ok: !!text, text: text, model: mdl };
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) };
    }
  })()`;
}

async function zaiInPageChat(messages, model) {
  const w = ensureZaiBridge();
  if (!w) return null;
  try {
    if (zaiWinLoading) await zaiWinLoading;
    const js = buildZaiPageScript(messages, model);
    const out = await Promise.race([
      w.webContents.executeJavaScript(js, true),
      new Promise((res) => setTimeout(() => res(null), 100000)),
    ]);
    return out || null;
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

ipcMain.handle('ai:zaiChat', async (_e, p) => {
  const { token, messages, model } = p || {};
  if (!Array.isArray(messages) || !messages.length) return { ok: false, error: 'پیام خالی است' };

  /* ۱) مسیر اصلی: fetch از داخل صفحه z.ai با نشست واقعی حساب کاربر */
  const inPage = await zaiInPageChat(messages, model);
  if (inPage && inPage.ok) return { ok: true, text: inPage.text, model: inPage.model };
  if (inPage && inPage.needLogin) {
    return { ok: false, needLogin: true, error: 'برای چت، اول در تب «صفحه چت GLM» وارد حسابت شو' };
  }

  /* ۲) فالبک: درخواست مستقیم با توکن رندرر (اگر باشد) */
  if (!token) {
    return { ok: false, error: (inPage && inPage.error) || 'اتصال به z.ai برقرار نشد — در تب «صفحه چت GLM» وارد حسابت شو' };
  }
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
      signal: AbortSignal.timeout(45000), /* v0.21: ۹۰→۴۵ ثانیه */
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
      signal: AbortSignal.timeout(20000), /* v0.21 — قبلاً هیچ سقفی نداشت؛ شبکه گیر می‌کرد و هرچیزی معطل می‌شد */
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

/* ---------- موتورهای STT کلاس AI (v0.17) ----------
   الگویی که سایت‌های تایپ صوتی حرفه‌ای (مثل typeo/iotype) استفاده می‌کنند:
   ترنسکریپت با مدل هوش مصنوعی، نه تشخیص مرورگری.
   ۱) stt:gemini  — صدا (WAV) داخل generateContent به جمنای می‌رود؛
      با همان کلید جمنای کاربر کار می‌کند (بدون ثبت‌نام اضافه) و برای فارسی
      خیلی دقیق است. زنجیرهٔ مدل مثل ai:gemini: مدل کاربر → flash-latest → …
   ۲) stt:whisper — هر سرور سازگار با OpenAI /audio/transcriptions:
      Groq (whisper-large-v3-turbo — سریع‌ترین، پلن رایگان)، OpenAI،
      یا سرور محلی whisper.cpp — کاربر آدرس/کلید/مدل را در تنظیمات می‌گذارد. */
function geminiModelChain(userModel) {
  return [...new Set([
    String(userModel || '').trim(),
    'gemini-flash-latest',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
  ])].filter(Boolean);
}

/* v0.21 — حافظهٔ مدل کارا: اولین درخواست هر جلسه ممکن است چند مدل را امتحان کند
   (تا جواب بگیرد)، اما بعد از اولین موفقیت، همان مدل در اول زنجیرهٔ دفعات بعد
   قرار می‌گیرد — یعنی «دومین سوال به بعد» همیشه با سریع‌ترین مسیر جواب می‌گیرد. */
let gemWorkingModel = ''; // آخرین مدل کاری چت
let gemSttWorkingModel = ''; // آخرین مدل کاری STT

ipcMain.handle('stt:gemini', async (_e, p) => {
  const { buf, key, model, lang } = p || {};
  const keys = splitKeys(key);
  if (!keys.length) return { ok: false, error: 'کلید Gemini تنظیم نشده — از تنظیمات › هوش مصنوعی واردش کن' };
  if (!buf || !buf.length) return { ok: false, error: 'صدایی برای تبدیل وجود ندارد' };
  const b64 = Buffer.from(buf).toString('base64');
  const prompt =
    'Transcribe this audio recording verbatim. ' +
    `The spoken language is ${String(lang || 'fa-IR')} unless it is clearly another language. ` +
    'Return ONLY the transcription text with correct punctuation and Persian spacing (نیم‌فاصله where appropriate). No commentary, no quotes.';
  let lastErr = null;
  /* v0.21 — مدل کاری اول + کلید خراب → کلید بعدی (نه همهٔ مدل‌ها) */
  const models = [...new Set([gemSttWorkingModel, ...geminiModelChain(model)].filter(Boolean))];
  for (const k of keys) {
    for (const mdl of models) {
      try {
        const body = {
          contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: 'audio/wav', data: b64 } }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 2048 },
        };
        /* thinkingConfig فقط برای نسل 2.5/3 معتبر است — بقیه بدونش */
        if (/2\.5|^gemini-3|latest/.test(mdl)) body.generationConfig.thinkingConfig = { thinkingBudget: 0 };
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(mdl)}:generateContent?key=${encodeURIComponent(k)}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) } /* v0.21: ۴۵→۱۵ ثانیه */
        );
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          const msg = (j && j.error && (j.error.message || j.error.status)) || `HTTP ${r.status}`;
          lastErr = `Gemini-ASR: ${String(msg).slice(0, 120)}`;
          /* کلید نامعتبر/محدود → امتحان بقیهٔ مدل‌ها با همین کلید بی‌فایده است */
          if ([401, 403, 429].includes(r.status)) break;
          continue;
        }
        const cand = j && j.candidates && j.candidates[0];
        const text = cand && cand.content && cand.content.parts
          ? cand.content.parts.map((x) => x.text || '').join('').trim()
          : '';
        if (!text) { lastErr = 'Gemini-ASR: پاسخ خالی بود'; continue; }
        gemSttWorkingModel = mdl; /* v0.21 — دفعه بعد اول همین امتحان می‌شود */
        return { ok: true, text, model: mdl };
      } catch (e) { lastErr = netErr(e); }
    }
  }
  return { ok: false, error: (lastErr || 'Gemini-ASR پاسخ نداد') };
});

ipcMain.handle('stt:whisper', async (_e, p) => {
  const { buf, base, key, model, lang } = p || {};
  if (!key) return { ok: false, error: 'کلید Whisper تنظیم نشده — از تنظیمات › تشخیص گفتار واردش کن' };
  if (!buf || !buf.length) return { ok: false, error: 'صدایی برای تبدیل وجود ندارد' };
  const url = trimBase(base) + '/audio/transcriptions';
  try {
    const form = new FormData();
    form.append('file', new Blob([Buffer.from(buf)], { type: 'audio/wav' }), 'ava-audio.wav');
    form.append('model', String(model || 'whisper-large-v3-turbo').trim());
    form.append('response_format', 'json');
    if (lang) form.append('language', String(lang).split('-')[0]);
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${String(key).trim()}` },
      body: form,
      signal: AbortSignal.timeout(12000), /* v0.21: ۴۵→۱۲ ثانیه */
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (j && j.error && (j.error.message || j.error.code)) || `HTTP ${r.status}`;
      return { ok: false, error: `Whisper: ${msg}` };
    }
    const text = String((j && j.text) || '').trim();
    return { ok: !!text, text, error: text ? undefined : 'متنی از صدا استخراج نشد' };
  } catch (e) { return { ok: false, error: netErr(e) }; }
});

/* ============================================================
   TTS گوگل (v0.11) — صدای زن طبیعی برای خواندن پاسخ‌های آوا
   از موتور رسمی ترجمه گوگل استفاده می‌کنیم (همان صدایی که در
   Google Translate می‌شنوید) — برای فارسی صدای زن گرم و طبیعی.
   متن به تکه‌های ≤۱۹۰ کاراکتر شکسته می‌شود (محدودیت سرور)،
   MP3 تکه‌ها برمی‌گردد و رندرر پشت‌سرهم پخش می‌کند.
   ============================================================ */
const TTS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';

function splitTtsChunks(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  /* اول روی مرز جمله بشکن، بعد در صورت نیاز روی ویرگول/فاصله */
  const sentences = clean.split(/(?<=[.!?؟。…])\s+/);
  const chunks = [];
  let cur = '';
  const pushCur = () => { if (cur.trim()) chunks.push(cur.trim()); cur = ''; };
  const addPiece = (piece) => {
    piece = piece.trim();
    if (!piece) return;
    if (piece.length > 190) {
      /* جمله خیلی طولانی → شکستن روی فاصله */
      const words = piece.split(' ');
      for (const w of words) {
        if ((cur + ' ' + w).trim().length > 190) pushCur();
        cur = (cur ? cur + ' ' : '') + w;
      }
      pushCur();
      return;
    }
    if ((cur + ' ' + piece).trim().length > 190) pushCur();
    cur = (cur ? cur + ' ' : '') + piece;
  };
  for (const s of sentences) addPiece(s);
  pushCur();
  return chunks.slice(0, 12); /* حداکثر ۱۲ تکه (~۲۳۰۰ کاراکتر) */
}

ipcMain.handle('tts:google', async (_e, p) => {
  const { text, lang } = p || {};
  const tl = String(lang || 'fa').slice(0, 5);
  const chunks = splitTtsChunks(text).slice(0, 8); /* v0.21 — بیشینه ۸ تکه */
  if (!chunks.length) return { ok: false, error: 'متنی برای خواندن نیست' };
  try {
    /* v0.21 — تکه‌ها «موازی» گرفته می‌شوند (قبلاً پشت‌سرهم؛ برای پاسخ‌های
       بلند تا ۲۰ ثانیه تأخیر صدا می‌گذاشت). ترتیب تکه‌ها حفظ می‌شود. */
    const parts = new Array(chunks.length).fill(null);
    let firstFail = null;
    await Promise.all(chunks.map(async (chunk, i) => {
      const q = encodeURIComponent(chunk);
      const url =
        `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob` +
        `&tl=${encodeURIComponent(tl)}&q=${q}&total=${chunks.length}&idx=${i}` +
        `&textlen=${chunk.length}&ttsspeed=1`;
      try {
        const r = await fetch(url, {
          headers: {
            'User-Agent': TTS_UA,
            'Referer': 'https://translate.google.com/',
            'Accept': 'audio/mpeg, audio/*;q=0.9, */*;q=0.5',
            'Accept-Language': 'fa,en;q=0.8',
          },
          signal: AbortSignal.timeout(12000),
        });
        if (!r.ok) {
          if (i === 0) firstFail = `گوگل: HTTP ${r.status}`;
          return;
        }
        const ab = await r.arrayBuffer();
        if (ab.byteLength > 100) parts[i] = Buffer.from(ab);
      } catch (e) {
        if (i === 0) firstFail = netErr(e);
      }
    }));
    if (!parts.some(Boolean)) return { ok: false, error: firstFail || 'صدایی از گوگل نرسید' };
    return { ok: true, mime: 'audio/mpeg', chunks: parts.filter(Boolean).map((b) => b.toString('base64')) };
  } catch (e) {
    return { ok: false, error: netErr(e) };
  }
});

/* ============================================================
   پرووایدرهای دیگر هوش مصنوعی (v0.11) — Gemini و OpenAI
   کاربر می‌تواند توکن خودش را در تنظیمات بگذارد؛ برای Gemini
   ابزار جستجوی گوگل (google_search grounding) هم فعال می‌شود تا
   سوالات «سرچ» با اطلاعات لحظه‌ای جواب بگیرند.
   ============================================================ */
/* ---------- چرخش چندکلیدی (v0.12 — استراتژی API Rotation) ----------
   کاربر می‌تواند چند کلید را با ویرگول بگذارد؛ اگر کلیدی محدود شد
   (429/quota) یا خطای شبکه داد، خودکار سراغ کلید بعدی می‌رویم —
   برای Gemini فالبک مدل هم انجام می‌شود (flash → flash-lite). */
const splitKeys = (k) =>
  String(k || '').split(/[\s,;،\n]+/).map((s) => s.trim()).filter((s) => s.length > 8);

/* v0.18 — سوال‌هایی که واقعاً به جستجوی زنده نیاز دارند (گران‌ترین و کندترین مسیر) */
const SEARCH_INTENT_RE = new RegExp(
  '(سرچ|جستجو|جستجو کن|گوگل کن|اخبار|خبر|قیمت|نرخ|دلار|تومان|ارز|بورس|ارز دیجیتال|بیت کوین|تتر|آب و هوا|هواشناسی|دموا|برفی|بارون|امروز|فردا|الان|چه خبر|جدیدترین|آخرین|نتایج|نتیجه|مسابقه|امتیاز|لیگ|هفته|[؛؟?]\\s*(کی|کجاست|چند|چقدر)|who won|latest news|price of|weather|today|current|score)',
  'i'
);

ipcMain.handle('ai:gemini', async (_e, p) => {
  const { key, model, messages, search } = p || {};
  const keys = splitKeys(key);
  if (!keys.length) return { ok: false, error: 'کلید Gemini تنظیم نشده' };
  if (!Array.isArray(messages) || !messages.length) return { ok: false, error: 'پیام خالی است' };
  /* زنجیرهٔ مدل: اول مدلِ انتخابی کاربر، بعد جدیدترین فلاش (نام مستعار همیشه‌سبز)
     و بعد نسل‌های قدیمی‌تر به‌عنوان فالبک — اگر مدلی منسوخ شده باشد (404)، خودکار
     مدل بعدی امتحان می‌شود تا «دیگر در دسترس نیست» دیگر به کاربر نرسد.
     v0.21 — مدل کاریِ آخر در اول زنجیره (دومین سوال به بعد = سریع‌ترین مسیر) */
  const models = [...new Set([
    gemWorkingModel,
    String(model || '').trim(),
    'gemini-flash-latest',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
  ])].filter(Boolean);
  let lastErr = null;
  /* چرخش کلید × مدل: کلید محدود/خراب → کلید بعدی؛ مدل نبود → مدل بعدی */
  for (const k of keys) {
    for (const mdl of models) {
      try {
        const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
        const contents = messages
          .filter((m) => m.role !== 'system')
          .slice(-16)
          .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content || '') }] }));
        const body = {
          contents,
          generationConfig: { temperature: 0.6, maxOutputTokens: 700 },
        };
        /* v0.18 — سرعت: مدل‌های نسل 2.5/3 بدون «فکر کردن» جواب می‌دهند
           (thinkingBudget=0 — تا ۵۰-۷۰٪ سریع‌تر) */
        if (/2\.5|^gemini-3|latest/.test(mdl)) body.generationConfig.thinkingConfig = { thinkingBudget: 0 };
        if (sys) body.systemInstruction = { parts: [{ text: sys }] };
        /* v0.18 — جستجوی گوگل فقط وقتی سوال واقعاً «سرچی» است وصل می‌شود؛
           ابزار سرچ ۲ تا ۶ ثانیه تأخیر اضافه دارد — سوال‌های معمولی را سریع جواب بده
           v0.21 — فرمان‌های موزیک/مدیا هرگز سرچ نمی‌گیرند («آهنگ امروزو پخش کن»
           شامل «امروز» است و قبلاً بی‌دلیل سرچی می‌شد و کند) */
        const lastUserText = [...messages].reverse().find((m) => m.role === 'user');
        const ut = String((lastUserText && lastUserText.content) || '');
        const mediaCmd = /(پخش|آهنگ|موزیک|ترانه|آلبوم|بعدی|قبلی|پاز|توقف آهنگ)/.test(ut);
        const wantsSearch = !mediaCmd && lastUserText && SEARCH_INTENT_RE.test(ut);
        if (search && wantsSearch) body.tools = [{ google_search: {} }];
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(mdl)}:generateContent?key=${encodeURIComponent(k)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(35000), /* v0.21: ۶۰→۳۵ ثانیه */
          }
        );
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          const msg = (j && j.error && (j.error.message || j.error.status)) || `HTTP ${r.status}`;
          lastErr = `Gemini: ${String(msg).slice(0, 140)}`;
          /* v0.21 — کلید بی‌اعتبار/محدود (401/403/429) → بقیهٔ مدل‌ها با همین کلید
             بی‌فایده‌اند؛ بلافاصله کلید بعدی (قبلاً تا ۶ مدل × ۶۰ ثانیه معطل می‌شد) */
          if ([401, 403, 429].includes(r.status)) break;
          continue; /* مدل ناموجود (400/404) → مدل بعدی */
        }
        const cand = j && j.candidates && j.candidates[0];
        const text = cand && cand.content && cand.content.parts
          ? cand.content.parts.map((x) => x.text || '').join('').trim()
          : '';
        if (!text) { lastErr = 'پاسخ خالی از Gemini رسید'; continue; }
        gemWorkingModel = mdl; /* v0.21 — حافظهٔ مدل کارا */
        return { ok: true, text, model: mdl, keyIndex: keys.indexOf(k) };
      } catch (e) {
        lastErr = netErr(e);
      }
    }
  }
  return { ok: false, error: (lastErr || 'هیچ کلید Gemini جواب نداد') + ` (مدل‌های امتحان‌شده: ${models.join('، ')})` };
});

ipcMain.handle('ai:openai', async (_e, p) => {
  const { key, model, messages } = p || {};
  const keys = splitKeys(key);
  if (!keys.length) return { ok: false, error: 'کلید OpenAI تنظیم نشده' };
  if (!Array.isArray(messages) || !messages.length) return { ok: false, error: 'پیام خالی است' };
  let lastErr = null;
  for (const k of keys) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${k}` },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: messages.slice(-16),
          temperature: 0.6,
          max_tokens: 700, /* v0.19 — سریع‌تر */
        }),
        signal: AbortSignal.timeout(40000), /* v0.21: ۶۰→۴۰ ثانیه */
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = (j && j.error && (j.error.message || j.error.code)) || `HTTP ${r.status}`;
        lastErr = `OpenAI: ${String(msg).slice(0, 140)}`;
        continue; /* کلید بعدی */
      }
      const text = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (!text) { lastErr = 'پاسخ خالی از OpenAI رسید'; continue; }
      return { ok: true, text };
    } catch (e) {
      lastErr = netErr(e);
    }
  }
  return { ok: false, error: lastErr || 'هیچ کلید OpenAI جواب نداد' };
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

/* ---------- افزونهٔ کنترل دیسکورد (v0.17 — بازنویسی کامل) ----------
   دو حالت اجرا:
   • fg (فورگراند): فوکوس به دیسکورد → اکشن → فوکوس به پنجرهٔ قبلی برمی‌گردد
     (وسط بازی فقط چند ثانیه فوکوس جابه‌جا می‌شود و برمی‌گردد)
   • bg (بک‌گراند — بدون به‌هم‌ریختن بازی): کلیدها/کلیک با PostMessage به
     «Chrome_RenderWidgetHostHWND» پنجرهٔ دیسکورد فرستاده می‌شوند؛ پنجره اصلاً
     فعال نمی‌شود. UIAutomation هم بدون فوکوس کار می‌کند.
   تماس واقعی (فیکس «به صفحه مخاطب می‌رود ولی تماس نمی‌گیرد»):
   • اگر آی‌دی مخاطب را داشته باشیم (از مدیریت مخاطبین): دیپ‌لینک
     discord://discord.com/channels/@me/<id> صفحهٔ DM را مستقیم باز می‌کند و
     بعد دکمهٔ «Start Voice Call» با UIA پیدا و کلیک می‌شود (اول Invoke، بعد
     کلیک روی مرکز مستطیل دکمه، بعد فالبک مختصات دستی dx/dy).
   • بدون آی‌دی: Quick Switcher (Ctrl+K) با نام.
   دکمهٔ تماس هم با نام انگلیسی و هم فارسی («تماس صوتی/شروع تماس») پیدا می‌شود. */
function discordPsScript(action, mode, name, dx, dy, waitMs, clickRetries) {
  const nm = String(name || '').replace(/['’`]/g, '');
  return `
$ErrorActionPreference = 'Stop'
try {
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace AvaDc2 {
  public struct RECT { public int Left, Top, Right, Bottom; }
  public struct POINT { public int X, Y; }
  public class W {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, UIntPtr dwExtraInfo);
    [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern IntPtr FindWindowEx(IntPtr p, IntPtr c, string cls, string win);
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wp, IntPtr lp);
    [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd, ref POINT p);
  }
}
'@
$proc = Get-Process -Name Discord,DiscordCanary,DiscordPTB -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $proc) {
  # v0.18 — اگر دیسکورد با دیپ‌لینک در حال بالا آمدن است، تا ${waitMs}ms صبر کن
  $waited = 0
  while ($waited -lt ${waitMs}) {
    Start-Sleep -Milliseconds 600
    $waited += 600
    $proc = Get-Process -Name Discord,DiscordCanary,DiscordPTB -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
    if ($proc) { break }
  }
}
if (-not $proc) { Write-Output 'ERR:NO_DISCORD'; exit }
$hwnd = $proc.MainWindowHandle
$child = [AvaDc2.W]::FindWindowEx($hwnd, [IntPtr]::Zero, 'Chrome_RenderWidgetHostHWND', [IntPtr]::Zero)
if ($child -eq [IntPtr]::Zero) { $child = $hwnd }
Write-Output "DBG:PROC=$($proc.ProcessName) CHILD=$(if ($child -ne [IntPtr]::Zero) { 1 } else { 0 }) MODE=${mode} ACT=${action}"
$mode = '${mode}'
$bg = ($mode -eq 'bg')
$prevFg = [AvaDc2.W]::GetForegroundWindow()
$sc = @{ 0x11 = 0x1D; 0x10 = 0x2A; 0x4D = 0x32; 0x44 = 0x20; 0x48 = 0x23; 0x41 = 0x1E; 0x45 = 0x12; 0x4B = 0x25; 0x56 = 0x2F; 0x0D = 0x1C }
function Send-BgCombo([int[]]$vks) {
  foreach ($v in $vks) {
    $s = $sc[$v]; if (-not $s) { $s = 0 }
    $lp = [long]1 -bor ([long]$s -shl 16)
    [AvaDc2.W]::PostMessage($child, 0x100, [IntPtr]$v, [IntPtr]$lp) | Out-Null
  }
  Start-Sleep -Milliseconds 60
  for ($i = $vks.Length - 1; $i -ge 0; $i--) {
    $s = $sc[$vks[$i]]; if (-not $s) { $s = 0 }
    $lp = [long]0xC0000001 -bor ([long]$s -shl 16)
    [AvaDc2.W]::PostMessage($child, 0x101, [IntPtr]$vks[$i], [IntPtr]$lp) | Out-Null
  }
}
function Send-BgClick([int]$sx, [int]$sy) {
  $o = New-Object AvaDc2.POINT; $o.X = 0; $o.Y = 0
  [AvaDc2.W]::ClientToScreen($child, [ref]$o) | Out-Null
  $lp = [long](($sy - $o.Y) -shl 16) -bor [long](($sx - $o.X) -band 0xFFFF)
  [AvaDc2.W]::PostMessage($child, 0x201, [IntPtr]1, [IntPtr]$lp) | Out-Null
  Start-Sleep -Milliseconds 90
  [AvaDc2.W]::PostMessage($child, 0x202, [IntPtr]0, [IntPtr]$lp) | Out-Null
}
function Send-FgClick([int]$sx, [int]$sy) {
  [AvaDc2.W]::SetCursorPos($sx, $sy) | Out-Null
  Start-Sleep -Milliseconds 70
  [AvaDc2.W]::mouse_event(0x02, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 60
  [AvaDc2.W]::mouse_event(0x04, 0, 0, 0, [UIntPtr]::Zero)
}
function Click-At([int]$sx, [int]$sy) { if ($bg) { Send-BgClick $sx $sy } else { Send-FgClick $sx $sy } }
function Focus-Discord {
  [AvaDc2.W]::ShowWindow($hwnd, 9) | Out-Null
  [AvaDc2.W]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero); [AvaDc2.W]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 120
  [AvaDc2.W]::SetForegroundWindow($hwnd) | Out-Null
  Start-Sleep -Milliseconds 450
}
function Restore-Focus {
  if ($bg) { return }
  if ($prevFg -ne [IntPtr]::Zero -and $prevFg -ne $hwnd) {
    [AvaDc2.W]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero); [AvaDc2.W]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 100
    [AvaDc2.W]::SetForegroundWindow($prevFg) | Out-Null
  }
}
function Try-CallClick {
  # دکمهٔ تماس: اول UIA (بدون فوکوس هم کار می‌کند)، بعد مختصات دستی
  # v0.18 — چند بار تلاش می‌شود (بارگذاری DM ممکن است چند ثانیه طول بکشد)
  for ($tryN = 1; $tryN -le ${clickRetries}; $tryN++) {
    try {
      Add-Type -AssemblyName UIAutomationClient | Out-Null
      Add-Type -AssemblyName UIAutomationTypes | Out-Null
      $root = [System.Windows.Automation.AutomationElement]::RootElement
      $hwndCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NativeWindowHandleProperty, $hwnd)
      $win = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $hwndCond)
      if ($win) {
        $btnCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)
        $btns = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, $btnCond)
        Write-Output "DBG:TRY=$tryN BTNS=$($btns.Count)"
        foreach ($pass in 1, 2) {
          foreach ($b in $btns) {
            $bn = ''
            try { $bn = $b.Current.Name } catch {}
            if (-not $bn) { continue }
            if ($bn -match 'Video|ویدیو|دوربین|End|قطع|Screen|اشتراک') { continue }
            $ok = $false
            if ($pass -eq 1) { $ok = ($bn -match 'Start Voice Call|Voice Call|Voice|تماس صوتی|شروع تماس|صوتی') }
            else { $ok = ($bn -match 'Call|تماس') }
            if (-not $ok) { continue }
            Write-Output "DBG:HIT=$bn PASS=$pass"
            try { ($b.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)).Invoke(); Restore-Focus; return 'OK:CALLING' } catch {}
            try {
              $r = $b.Current.BoundingRectangle
              $cx = [int]($r.X + $r.Width / 2); $cy = [int]($r.Y + $r.Height / 2)
              Click-At $cx $cy
              Restore-Focus
              return 'OK:CALLING'
            } catch {}
          }
        }
      }
    } catch {}
    Start-Sleep -Milliseconds 1100
  }
  # فالبک مختصات دستی: گوشهٔ بالا-راست پنجره (سرستون DM)
  Write-Output 'DBG:UIA_MISS'
  $r2 = New-Object AvaDc2.RECT
  [AvaDc2.W]::GetWindowRect($hwnd, [ref]$r2) | Out-Null
  $tx = $r2.Right - ${dx}
  $ty = $r2.Top + ${dy}
  if ($tx -gt $r2.Left -and $ty -gt $r2.Top) {
    Click-At $tx $ty
    Restore-Focus
    return 'OK:CALL_CLICKED'
  }
  Restore-Focus
  return 'ERR:NOBTN'
}
$action = '${action}'
switch ($action) {
  'focus'    { if (-not $bg) { Focus-Discord }; Write-Output 'OK' }
  'mute'     { if ($bg) { Send-BgCombo @(0x11, 0x10, 0x4D) } else { Focus-Discord; $ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('^+m'); Start-Sleep -Milliseconds 250 }; Write-Output 'OK:MUTE' }
  'deafen'   { if ($bg) { Send-BgCombo @(0x11, 0x10, 0x44) } else { Focus-Discord; $ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('^+d'); Start-Sleep -Milliseconds 250 }; Write-Output 'OK:DEAFEN' }
  'hangup'   { if ($bg) { Send-BgCombo @(0x11, 0x10, 0x48) } else { Focus-Discord; $ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('^+h'); Start-Sleep -Milliseconds 250 }; Restore-Focus; Write-Output 'OK:HANGUP' }
  'answer'   { if ($bg) { Send-BgCombo @(0x11, 0x10, 0x41) } else { Focus-Discord; $ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('^+a'); Start-Sleep -Milliseconds 250 }; Restore-Focus; Write-Output 'OK:ANSWER' }
  'decline'  { if ($bg) { Send-BgCombo @(0x11, 0x10, 0x45) } else { Focus-Discord; $ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('^+e'); Start-Sleep -Milliseconds 250 }; Restore-Focus; Write-Output 'OK:DECLINE' }
  'probe' {
    # آزمایش مکان‌یابی دکمهٔ تماس — فقط نشانگر موس حرکت می‌کند، کلیکی در کار نیست
    try {
      Add-Type -AssemblyName UIAutomationClient | Out-Null
      Add-Type -AssemblyName UIAutomationTypes | Out-Null
      $root = [System.Windows.Automation.AutomationElement]::RootElement
      $hwndCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NativeWindowHandleProperty, $hwnd)
      $win = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $hwndCond)
      if ($win) {
        $btnCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)
        $btns = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, $btnCond)
        foreach ($b in $btns) {
          $bn = ''
          try { $bn = $b.Current.Name } catch {}
          if ($bn -match 'Video|ویدیو|End|قطع') { continue }
          if ($bn -match 'Start Voice Call|Voice Call|تماس صوتی|شروع تماس|Call|تماس') {
            $r = $b.Current.BoundingRectangle
            $cx = [int]($r.X + $r.Width / 2); $cy = [int]($r.Y + $r.Height / 2)
            [AvaDc2.W]::SetCursorPos($cx, $cy) | Out-Null
            Write-Output "OK:PROBE:$cx,$cy"
            exit
          }
        }
      }
    } catch {}
    $r2 = New-Object AvaDc2.RECT
    [AvaDc2.W]::GetWindowRect($hwnd, [ref]$r2) | Out-Null
    $tx = $r2.Right - ${dx}; $ty = $r2.Top + ${dy}
    [AvaDc2.W]::SetCursorPos($tx, $ty) | Out-Null
    Write-Output "OK:PROBE-FB:$tx,$ty"
  }
  'clickcall' {
    # DM از قبل با دیپ‌لینک باز شده — فقط دکمهٔ تماس را بزن
    Start-Sleep -Milliseconds 900
    Write-Output (Try-CallClick)
  }
  'callswitch' {
    $name = '${nm.replace(/'/g, "")}'
    if (-not $name) { Write-Output 'ERR:NONAME'; exit }
    try { Set-Clipboard -Value $name -ErrorAction Stop | Out-Null } catch { Write-Output 'DBG:CLIP_FAIL' }
    if ($bg) {
      Send-BgCombo @(0x11, 0x4B)
      Start-Sleep -Milliseconds 1100
      Send-BgCombo @(0x11, 0x56)
      Start-Sleep -Milliseconds 900
      Send-BgCombo @(0x0D)
      Start-Sleep -Milliseconds 1700
    } else {
      Focus-Discord
      $ws = New-Object -ComObject WScript.Shell
      $ws.SendKeys('^k'); Start-Sleep -Milliseconds 1000
      $ws.SendKeys('^v'); Start-Sleep -Milliseconds 900
      $ws.SendKeys('{ENTER}'); Start-Sleep -Milliseconds 1700
    }
    Write-Output (Try-CallClick)
  }
  default { Write-Output 'ERR:UNKNOWN' }
}
} catch {
  # v0.21 — هر خطای پاورشل (حتی Add-Type/UIA) به‌عنوان نتیجهٔ قابل‌فهم برمی‌گردد
  # و در لاگ عملکرد ثبت می‌شود — دیگر «ارور پاورشل» گم نمی‌شود
  Write-Output ('ERR:PS:' + ($_.Exception.Message -replace '\s+', ' '))
}`.trim();
}

ipcMain.handle('discord:cmd', async (_e, p) => {
  const { action, name, userId, bg, dx, dy, assist } = p || {};
  const A = String(action || '');
  const mode = bg ? 'bg' : 'fg';
  const dxN = Math.max(10, Math.min(320, Number(dx) || 46));
  const dyN = Math.max(10, Math.min(220, Number(dy) || 52));
  /* v0.20 — حالت «کمکی»: صفر ورودی شبیه‌سازی‌شده؛ فقط باز کردن صفحهٔ مخاطب
     با دیپ‌لینک رسمی (یا فوکوس دیسکورد) — کاملاً مطابق قوانین دیسکورد */
  if (A === 'call' && assist === true) {
    if (userId && /^\d{5,25}$/.test(String(userId).trim())) {
      actLog(`discord call(assist) userId=${String(userId).trim().slice(0, 4)}…`, 'discord');
      try { await shell.openExternal(`discord://discord.com/channels/@me/${String(userId).trim()}`); } catch (_) { /* noop */ }
      return { ok: true, result: 'OK:ASSIST' };
    }
    actLog('discord call(assist) no-userId → focus only', 'discord');
    const r = await runDiscordPs('focus', 'fg', '', dxN, dyN);
    return { ok: r && r.ok, result: 'OK:ASSIST', error: r && r.error };
  }
  /* تماس با مخاطب ثبت‌شده: دیپ‌لینک مستقیم DM را باز می‌کند (بدون Ctrl+K)،
     بعد دکمهٔ «شروع تماس» کلیک می‌شود — فیکس «به صفحه می‌رود ولی زنگ نمی‌زند» */
  if (A === 'call' && userId && /^\d{5,25}$/.test(String(userId).trim())) {
    actLog(`discord call userId=${String(userId).trim().slice(0, 4)}… mode=${mode}`, 'discord');
    try { await shell.openExternal(`discord://discord.com/channels/@me/${String(userId).trim()}`); } catch (_) { /* noop */ }
    await new Promise((r) => setTimeout(r, 2600));
    return runDiscordPs('clickcall', mode, '', dxN, dyN);
  }
  const psAction = A === 'call' ? 'callswitch' : A;
  return runDiscordPs(psAction, mode, String(name || ''), dxN, dyN);
});

function runDiscordPs(psAction, mode, nm, dxN, dyN) {
  const ps = discordPsScript(psAction, mode, nm, dxN, dyN,
    (psAction === 'clickcall' || psAction === 'callswitch') ? 25000 : 6000,
    (psAction === 'clickcall' || psAction === 'callswitch') ? 12 : 1); /* v0.21: ۸→۱۲ تلاش */
  const encoded = Buffer.from(ps, 'utf16le').toString('base64');
  const t0 = Date.now();
  return new Promise((resolve) => {
    exec(`powershell -NoProfile -STA -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
      { windowsHide: true, timeout: 60000, maxBuffer: 1024 * 512 },
      (err, stdout, stderr) => {
        /* v0.21 — خطای پاورشل دیگر گم نمی‌شود: stderr در لاگ عملکرد می‌رود
           (با «آوا گزارش بفرست» قابل ارسال است — گلهٔ کاربر: «ارور پاورشل میده») */
        const errTxt = String(stderr || '').trim();
        if (errTxt) actLog(`discord ps stderr: ${errTxt.slice(0, 260)}`, 'discord');
        /* خطوط DBG: تشخیصی‌اند و نتیجه نیستند — فقط لاگ می‌شوند؛
           نتیجه = آخرین خط OK/ERR (اسکریپت ممکن است چند خط چاپ کند) */
        const lines = String(stdout || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
        lines.filter((l) => /^DBG:/i.test(l)).forEach((l) => actLog(`discord ${l.slice(0, 140)}`, 'discord'));
        const out = lines.filter((l) => !/^DBG:/i.test(l)).pop() || '';
        actLog(`discord ${psAction} mode=${mode} -> ${out || (err ? 'PS-FAIL' : 'EMPTY')} (${Date.now() - t0}ms)`, 'discord');
        if (/^ERR:PS:/.test(out)) {
          return resolve({ ok: false, error: ('خطای اسکریپت: ' + out.replace(/^ERR:PS:/, '')).slice(0, 160) });
        }
        if (err && !out) {
          const t = err.killed || /timeout/i.test(String(err.message || ''))
            ? 'اسکریپت دیسکورد بیش از حد طول کشید — دیسکورد را یک‌بار باز/بسته کن و دوباره امتحان کن'
            : String(err.message || 'PowerShell اجرا نشد');
          return resolve({ ok: false, error: String(t).slice(0, 160) });
        }
        if (/^ERR:/.test(out)) {
          const msgs = {
            'ERR:NO_DISCORD': 'دیسکورد باز نیست — اول دیسکورد را باز کن',
            'ERR:UNKNOWN': 'فرمان دیسکورد شناخته نشد',
            'ERR:NONAME': 'نام مخاطب پیدا نشد — در تنظیمات دیسکورد مخاطب بساز یا نام را کامل بگو',
            'ERR:NOBTN': 'دکمهٔ تماس پیدا نشد — صفحهٔ مخاطب باز شد ولی تماس نگرفت؛ مختصات دستی را با «آزمایش مکان» تنظیم کن یا حالت کمکی را امتحان کن',
          };
          return resolve({ ok: false, error: msgs[out.trim()] || out.trim() });
        }
        resolve({ ok: true, result: out || 'OK' });
      });
  });
}

/* ---------- لاگ عملکرد (v0.18) — برای عیب‌یابی از راه دور ----------
   واکنش‌های برنامه (فرمان‌ها، موتورها، دیسکورد، به‌روزرسان، خطاها) در
   userData/logs/activity.log ثبت می‌شود؛ کاربر نیازی به دیدنش ندارد.
   فایل خودکار روتِیت می‌شود (بیشینه ~۴۰۰KB → activity.old.log).
   ارسال به گیت‌هاب: فرمان صوتی «آوا گزارش بفرست» → صفحهٔ GitHub Issues
   با خلاصهٔ لاگ پیش‌پرشده باز می‌شود (بدون توکن داخل برنامه — امن). */
const ACT_MAX = 400 * 1024;
function actLog(line, tag = 'app') {
  try {
    const dir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, 'activity.log');
    try {
      const st = fs.statSync(f);
      if (st.size > ACT_MAX) fs.renameSync(f, path.join(dir, 'activity.old.log'));
    } catch (_) { /* هنوز فایلی نیست */ }
    fs.appendFileSync(f, `[${new Date().toISOString()}] [${tag}] ${String(line).replace(/\s+/g, ' ').slice(0, 400)}\n`);
  } catch (_) { /* لاگ هرگز نباید برنامه را بکشد */ }
}
ipcMain.handle('log:act', (_e, msg) => { actLog(String(msg || ''), 'ui'); return true; });
ipcMain.handle('log:get', () => {
  try {
    const f = path.join(app.getPath('userData'), 'logs', 'activity.log');
    const lines = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean);
    return { ok: true, lines: lines.slice(-80) };
  } catch (e) { return { ok: false, lines: [], error: netErr(e) }; }
});

/* ---------- App lifecycle ---------- */
app.whenReady().then(() => {
  actLog(`boot v${app.getVersion()} electron=${process.versions.electron} packaged=${app.isPackaged}`);
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
