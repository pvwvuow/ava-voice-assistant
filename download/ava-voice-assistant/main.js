/**
 * آوا — دستیار صوتی ویندوز
 * Electron main process (نسخه ۰.۱۰ — موتور وب گوگل با کلید کرومیوم داخل Electron
 * فعال می‌شود، فرمان‌های پاور (خواب/خاموش/مانیتور)، فرم «DNS جدید» داخل صفحه
 * اصلی با انیمیشن، پل چت GLM با نشست واقعی کاربر، تنظیمات فایلی)
 */
const { app, BrowserWindow, ipcMain, globalShortcut, session, screen, shell, protocol, net, clipboard, dialog, powerSaveBlocker } = require('electron');
const { exec, spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto'); /* v0.42 — توکن Sec-MS-GEC برای TTS اِج */
const { Readable } = require('stream');

/* v0.48 — شناسهٔ نشست: همهٔ خط‌های JSONL یک اجرا با همین b برچسب می‌خورند
   تا ممیزی «کرش بین boot و quit» دقیق شود (بوت بدون quit قبلی = کرش) */
const AVA_BOOT_ID = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* v0.44 — سبک‌سازی RAM (خواستهٔ صریح کاربر: «برنامه رم زیادی مصرف می‌کنه…
   باید سبک سازی بشه»): سقف هیپ V8 برای هر پروسهٔ آوا — جلوی رشد بی‌سقف
   heap رندرر/مین را می‌گیرد؛ مصرف عادی آوا خیلی زیر این سقف است */
try { app.commandLine.appendSwitch('js-flags', '--max-old-space-size=512'); } catch (_) { /* noop */ }

/* v0.47 — B13: قفل تک‌نمونه‌ای — بدون این، اجرای دوبارهٔ آوا (خودکار + دستی)
   هر دو shortcut را «occupied» می‌کند (لاگ v0.46 کاربر: هر دو FAILED)، صدای
   دوگانه و دو حلقهٔ wake می‌سازد. نمونهٔ دوم بلافاصله می‌رود؛ نمونهٔ اول
   پنجره‌اش بالا می‌آید و فوکوس می‌گیرد. */
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    try {
      const w = BrowserWindow.getAllWindows()[0];
      if (w) { if (w.isMinimized()) w.restore(); w.show(); w.focus(); }
    } catch (_) { /* noop */ }
  });
}

/* v0.61 — پنجرهٔ شناور PiP (پلیر خودساختهٔ آوا) حذف شد؛ ویدیو با پلیر
   پیش‌فرضِ خود کاربر پخش می‌شود (player:open / player:default پایین‌تر). */

/* ---------- پروتکل امن ava:// ----------
   رابط کاربری از ava://app بارگذاری می‌شود تا فایل‌های برنامه
   با MIME درست و بدون مجوز اضافه سرو شوند.
   باید «قبل از» آماده شدن اپ ثبت شود. */
protocol.registerSchemesAsPrivileged([
  { scheme: 'ava', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
  /* v0.22 — استریم فایل‌های موزیک کاربر برای پلیر (با پشتیبانی Range برای سیک) */
  { scheme: 'ava-media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
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

/* ---------- v0.22 — استریم فایل‌های موزیک کاربر (ava-media://m/<مسیر>) ----------
   آدرس کامل فایل به‌صورت encodeURIComponent در pathname می‌آید؛
   پشتیبانی Range (۲۰۶) برای سیک/جلو-عقب پلیر و MIME درست برای هر فرمت. */
const MEDIA_MIME = {
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.wav': 'audio/wav',
  '.flac': 'audio/flac', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg',
  '.weba': 'audio/webm', '.webm': 'audio/webm', '.wma': 'audio/x-ms-wma',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
};
/* v0.60 (B5) — allowlist «مشترکِ» پوشه‌های مجاز مدیا: userData + پوشه‌های
   موزیک انتخابی کاربر (settings.musicDirs/musicDir). هم ava-media:// و هم
   music:readHead از همین یک تابع استفاده می‌کنند تا دو مسیر هرگز واگرا نشوند. */
function mediaDirAllowed(p) {
  try {
    const allowed = [];
    try { allowed.push(app.getPath('userData')); } catch (_) { /* noop */ }
    try {
      const st0 = loadedSettings();
      if (Array.isArray(st0.musicDirs)) allowed.push(...st0.musicDirs);
      if (st0.musicDir) allowed.push(String(st0.musicDir));
    } catch (_) { /* noop */ }
    return allowed.some((d) => d && path.normalize(p).toLowerCase().startsWith(path.normalize(d).toLowerCase() + path.sep));
  } catch (_) {
    return false;
  }
}
function serveMediaFile(reqUrl, req) {
  try {
    const u = new URL(reqUrl);
    if (u.host !== 'm') return new Response('not found', { status: 404 });
    const p = decodeURIComponent(u.pathname).replace(/^\/+/, '');
    if (!path.isAbsolute(p)) return new Response('forbidden', { status: 403 });
    /* v0.47 — B21: allowlist — فقط پوشه‌های موزیک اسکن‌شدهٔ خود کاربر + userData؛
       قبلاً هر path مطلقی استریم می‌شد (هرگز نباید از رندرر به فایل‌سیستم کامل برسد)
       v0.60 (B5) — همان allowlist اکنون در mediaDirAllowed() مشترک است و
       music:readHead هم از آن استفاده می‌کند */
    if (!mediaDirAllowed(p)) return new Response('forbidden', { status: 403 });
    let st;
    try { st = fs.statSync(p); } catch (_) { return new Response('not found', { status: 404 }); }
    if (!st.isFile()) return new Response('not found', { status: 404 });
    const type = MEDIA_MIME[path.extname(p).toLowerCase()] || 'application/octet-stream';
    const range = (req && req.headers && req.headers.get && req.headers.get('range')) || '';
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      let start = m && m[1] ? parseInt(m[1], 10) : 0;
      let end = m && m[2] ? parseInt(m[2], 10) : st.size - 1;
      if (!Number.isFinite(start) || start < 0) start = 0;
      if (!Number.isFinite(end) || end >= st.size) end = st.size - 1;
      if (start > end) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${st.size}` } });
      }
      return new Response(Readable.toWeb(fs.createReadStream(p, { start, end })), {
        status: 206,
        headers: {
          'Content-Type': type,
          'Content-Length': String(end - start + 1),
          'Content-Range': `bytes ${start}-${end}/${st.size}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-cache',
        },
      });
    }
    return new Response(Readable.toWeb(fs.createReadStream(p)), {
      status: 200,
      headers: { 'Content-Type': type, 'Content-Length': String(st.size), 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' },
    });
  } catch (_) {
    return new Response('error', { status: 500 });
  }
}

/* ---------- کلید Speech گوگل برای موتور وب داخل Electron ----------
   بدون این کلید، webkitSpeechRecognition در Electron با خطای network بلافاصله
   می‌میرد و هر بار چند ثانیه تلف می‌شد؛ با کلید عمومی خود کرومیوم
   (همان کلیدی که درخواست‌های HTTP هم استفاده می‌کنند) موتور وب واقعی و
   استریمی گوگل داخل برنامه بالا می‌آید. باید قبل از ready ثبت شود. */
const GOOGLE_KEY_DEFAULT = 'AIzaSyBOti4mM-6x9WDnZIjIeyEU21OpBXqWBgw';
const GOOGLE_CLIENT_ID_DEFAULT = '446115136242-2p92k6onon4tnnd434e2f8sdcp8o9fr8.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET_DEFAULT = 'uFBboTQBEsseYMwbGjXAcRYF';
/* v0.27 — علاوه بر سوییچ‌های خط فرمان، متغیرهای محیطی هم ست می‌شوند؛
   کرومیوم در برخی مسیرها فقط env را می‌خواند (سند رسمی Electron:
   GOOGLE_API_KEY / GOOGLE_DEFAULT_CLIENT_ID / GOOGLE_DEFAULT_CLIENT_SECRET).
   با هر دو مسیر، webkitSpeechRecognition دقیقاً مثل خود کروم (dictation.io) زنده می‌شود. */
try {
  process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || GOOGLE_KEY_DEFAULT;
  process.env.GOOGLE_DEFAULT_CLIENT_ID = process.env.GOOGLE_DEFAULT_CLIENT_ID || GOOGLE_CLIENT_ID_DEFAULT;
  process.env.GOOGLE_DEFAULT_CLIENT_SECRET = process.env.GOOGLE_DEFAULT_CLIENT_SECRET || GOOGLE_CLIENT_SECRET_DEFAULT;
} catch (_) { /* noop */ }
try {
  app.commandLine.appendSwitch('google-api-key', GOOGLE_KEY_DEFAULT);
  app.commandLine.appendSwitch('google-default-client-id', GOOGLE_CLIENT_ID_DEFAULT);
  app.commandLine.appendSwitch('google-default-client-secret', GOOGLE_CLIENT_SECRET_DEFAULT);
} catch (_) { /* noop */ }

/* v0.35 — بیدارباش وقتی آوا مینیمایز است یا کاربر وسط بازی است:
   کرومیوم به‌طور پیش‌فرض تایمر/صدا پنجرهٔ مخفی و پوشیده‌شده را throttle و
   suspend می‌کند — دقیقاً همان «گاهی کار میکنه گاهی نه» و «توی بازی گوش نمیده».
   این سه سوییچ باید قبل از ready ثبت شوند تا حلقهٔ بیدارباش در مینیمایز/
   فول‌اسکرینِ بازی هم بدون هیچ گسستی فریم بگیرد. */
try {
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-background-timer-throttling');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
  /* v0.51 — پلیر خود آوا: autoplay با صدا بدون نیاز به کلیک (پلی یعنی همان
     لحظه پخش؛ قبلاً embed یوتیوب گاهی پاز شروع می‌شد) */
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
} catch (_) { /* noop */ }

/* ---------- v0.24 — دور زدن DNS فیلترشدهٔ ایران (شکن/الکترو) بدون UAC ----------
   ریشهٔ «نشنیدن صدا در برنامهٔ نصب‌شده» (گزارش کاربر: در کروم/پیش‌نمایش عالی
   می‌شنود ولی در برنامه هنوز مشکل داریم):
   • کروم به‌خاطر DNS امنِ خودش گوگل را راحت می‌بیند؛ برنامه از DNS سیستم
     استفاده می‌کند که روی شبکهٔ ایران میزبان‌های گوگل را فیلتر می‌کند.
   • نتیجه: موتور وب (همان شنوندهٔ کروم داخل برنامه) با خطای network می‌میرد
     و موتورهای ابری هم «اتصال به سرور برقرار نشد» می‌دهند.
   راه‌حل: قبل از باز شدن پنجره، آی‌پی واقعی میزبان‌های مهم از DNS شکن/الکترو
   پرسیده و فقط «داخل برنامه» پین می‌شود — بدون تغییر DNS ویندوز، بدون UAC:
   ۱) host-resolver-rules → موتور وب کرومیوم (webkitSpeechRecognition) مثل
      خود کروم زنده می‌شود؛
   ۲) پچ dns.lookup نود → همهٔ fetchهای پروسهٔ اصلی (گوگل/جمنای/Whisper/GLM)
      از همان آی‌پی‌ها می‌روند.
   باید قطعاً «قبل از ready» ثبت شود → پرس‌وجو با spawnSync سنکرون است؛
   نتیجه در dns-map.json کش می‌شود تا بوت‌های بعدی آنی باشند. */
const dnsBypass = require('./lib/dns-bypass');
const DNS_HOSTS = dnsBypass.DEFAULT_HOSTS;
const DNS_BOOT = { off: false, applied: false, cached: false, count: 0, rules: '' };
let nodeDnsMap = new Map();

function applyNodeDnsMap(map) {
  nodeDnsMap = new Map(Object.entries(map || {}));
  DNS_BOOT.count = nodeDnsMap.size;
  DNS_BOOT.rules = dnsBypass.hostResolverRules(map);
}

/* پچ dns.lookup نود: میزبان‌های پین‌شده بدون DNS سیستم resolve می‌شوند.
   نام میزبان دست‌نخورده می‌ماند → SNI/اعتبارسنجی گواهی درست انجام می‌شود. */
(function patchNodeDns() {
  try {
    const dnsMod = require('dns');
    if (dnsMod.__avaPatched) return;
    const orig = dnsMod.lookup;
    dnsMod.lookup = function (hostname, options, callback) {
      const ip = nodeDnsMap.get(String(hostname));
      if (ip) {
        const cb = typeof options === 'function' ? options : callback;
        if (typeof cb === 'function') { setTimeout(() => cb(null, ip, 4), 0); return; }
      }
      return orig.apply(this, typeof options === 'function' ? [hostname, options] : [hostname, options, callback]);
    };
    dnsMod.__avaPatched = true;
  } catch (_) { /* noop */ }
})();

/* v0.29.1 — cloudFetch: مسیر دوگانهٔ ترافیک ابری
   ریشهٔ «اتصال به جمینی حتی تو تنظیمات هم امکان‌پذیر نیست» این بود:
   • selfcheck فقط TCP:443 را می‌سنجید و «ok» می‌گفت، ولی TLS/HTTP واقعی
     روی همان مسیر ریست می‌شد (فیلترینگ SNI ایران) → «fetch failed» فوری؛
   • فیلترشکن‌های پراکسی‌ساز (v2ray/هیدیفای/وارپ) پراکسیِ سیستم ویندوز
     می‌سازند که کرومیوم (موتور وب/وب‌اسپیچ) رعایت می‌کند ولی fetch نود
     هیچ‌وقت — برای همین وب کار می‌کرد و جمینی در پروسهٔ اصلی نه.
   راه‌حل: اول net.fetch (استک شبکهٔ کرومیوم → پراکسی سیستم + پین DNS
   host-resolver-rules هر دو رعایت می‌شود)، اگر مسیر شبکه‌ای مرد فالبک به
   fetch نود (dns.lookup پچ‌شده). خطای HTTP (۴xx/۵xx) استثنا نیست — پاسخ
   همان‌طور برمی‌گردد تا منطق کلید/کوتا بالادستی درست کار کند. */
let __cloudVia = '';
let __cloudViaLogged = false;
function __logCloudVia() {
  if (__cloudViaLogged) return;
  __cloudViaLogged = true;
  try { actLog('cloud fetch path: ' + (__cloudVia === 'chromium' ? 'chromium stack (system proxy + pinned DNS honored)' : 'node fetch (pinned DNS)')); } catch (_) { /* noop */ }
}
async function cloudFetch(url, opts) {
  const o = opts || {};
  try {
    const r = await net.fetch(url, o);
    __cloudVia = 'chromium';
    __logCloudVia();
    return r;
  } catch (eCh) {
    const r = await fetch(url, o); /* فالبک: مسیر نود با DNS پین‌شده */
    __cloudVia = 'node';
    __logCloudVia();
    return r;
  }
}

(function bootDnsBypass() {
  try {
    const ud = app.getPath('userData');
    let cfg = {};
    try { cfg = JSON.parse(fs.readFileSync(path.join(ud, 'ava-settings.json'), 'utf8')) || {}; } catch (_) { /* فایل نیست → پیش‌فرض روشن */ }
    /* v0.26 — این دورزنی «خط زندگیِ اتصال» کاربر ایرانی است و دیگر به گزینهٔ
       extDns ربطی ندارد (آن فقط «تغییر DNS ویندوز» است). همیشه روشن می‌ماند؛
       فقط انصراف صریح با کلید اختصاصی dnsBypass=false خاموشش می‌کند.
       (ava-settings.json کاربر extDns=false داشت و دورزنی از کار می‌افتاد!) */
    if (cfg.dnsBypass === false) { DNS_BOOT.off = true; return; }
    const cachePath = path.join(ud, 'dns-map.json');
    const readCache = () => {
      try {
        const c = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        if (c && c.map && Object.keys(c.map).length) return c;
      } catch (_) { /* noop */ }
      return null;
    };
    /* کش تازهٔ ۱۰ دقیقه‌ای → بوت آنی بدون درخواست شبکه */
    const fresh = readCache();
    if (fresh && Date.now() - (fresh.t || 0) < 600000) {
      applyNodeDnsMap(fresh.map);
      DNS_BOOT.applied = true; DNS_BOOT.cached = true;
      try { app.commandLine.appendSwitch('host-resolver-rules', DNS_BOOT.rules); } catch (_) { /* noop */ }
      return;
    }
    /* پرس‌وجوی سنکرون از شکن/الکترو (حداکثر ~۲ ثانیه) — اسکریپت پروش باید
       بیرون از asar باشد (پروسهٔ نود خالص asar را نمی‌خواند) */
    const probePath = path.join(ud, 'dns-probe.js');
    const cfgPath = path.join(ud, 'dns-probe.json');
    try { fs.writeFileSync(probePath, fs.readFileSync(path.join(__dirname, 'lib', 'dns-bypass.js'))); } catch (_) { /* noop */ }
    /* v0.26 — dohTimeoutMs هم داده می‌شود تا اگر UDPها بسته بودند، DoH
       (TCP:443) در همین پرس‌وجوی سنکرون فرصت نجات بدهد؛
       v0.60 (B6) — با اضافه‌شدن retry، بودجهٔ زمانی DoH ۱۵۰۰ms شد تا
       بدترین حالت (۱۳۰۰ UDP + ۱۵۰۰ DoH + retry) زیر سقف ۴s کل CLI بماند */
    try { fs.writeFileSync(cfgPath, JSON.stringify({ hosts: DNS_HOSTS, timeoutMs: 1300, dohTimeoutMs: 1500 })); } catch (_) { /* noop */ }
    let out = '';
    try {
      const r = spawnSync(process.execPath, [probePath, cfgPath], {
        env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: '1' }),
        timeout: 4600, /* v0.26: ۲.۲→۴.۶ ثانیه — فرصت فالبک DoH بعد از شکست UDP */
        encoding: 'utf8', windowsHide: true,
      });
      out = String((r && r.stdout) || '');
    } catch (_) { /* noop */ }
    let map = null;
    try {
      const j = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1) || '{}');
      if (j && j.ok && j.map && Object.keys(j.map).length) map = j.map;
    } catch (_) { /* noop */ }
    if (map) {
      applyNodeDnsMap(map);
      DNS_BOOT.applied = true;
      try { app.commandLine.appendSwitch('host-resolver-rules', DNS_BOOT.rules); } catch (_) { /* noop */ }
      try { fs.writeFileSync(cachePath, JSON.stringify({ t: Date.now(), map })); } catch (_) { /* noop */ }
    } else {
      /* پروش شکست خورد → اگر کش کهنه‌ای هست، از آن استفاده کن (بهتر از DNS فیلتر) */
      const stale = readCache();
      if (stale) {
        applyNodeDnsMap(stale.map);
        DNS_BOOT.applied = true; DNS_BOOT.cached = true;
        try { app.commandLine.appendSwitch('host-resolver-rules', DNS_BOOT.rules); } catch (_) { /* noop */ }
      }
    }
  } catch (_) { /* هیچ‌وقت بوت را نسُزان */ }
})();

/* نوسازی هر ۱۰ دقیقه (غیرمسدودکننده) — آی‌پی‌های تازه برای fetchهای نود */
setInterval(() => {
  if (DNS_BOOT.off) return;
  try {
    const ud = app.getPath('userData');
    const probePath = path.join(ud, 'dns-probe.js');
    const cfgPath = path.join(ud, 'dns-probe.json');
    if (!fs.existsSync(probePath)) return;
    try { fs.writeFileSync(cfgPath, JSON.stringify({ hosts: DNS_HOSTS, timeoutMs: 1300, dohTimeoutMs: 1500 })); } catch (_) { /* noop */ } /* v0.60 B6: هم‌بودجه با بوت (retry-safe) */
    const ch = spawn(process.execPath, [probePath, cfgPath], {
      env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: '1' }), windowsHide: true,
    });
    let out = '';
    ch.stdout.on('data', (d) => { out += d; });
    ch.on('error', () => { /* noop */ });
    ch.on('close', () => {
      try {
        const j = JSON.parse(String(out || '').slice(String(out).indexOf('{'), String(out).lastIndexOf('}') + 1) || '{}');
        if (j && j.ok && j.map && Object.keys(j.map).length) {
          const before = JSON.stringify([...nodeDnsMap.entries()]);
          applyNodeDnsMap(j.map);
          try { writeJsonAtomic(path.join(ud, 'dns-map.json'), { t: Date.now(), map: j.map }); } catch (_) { /* noop */ } /* v0.47 B21: اتمیک */
          if (before !== JSON.stringify([...nodeDnsMap.entries()])) {
            actLog('dns map refreshed: ' + nodeDnsMap.size + ' hosts pinned via shekan/electro');
          }
        }
      } catch (_) { /* noop */ }
    });
  } catch (_) { /* noop */ }
}, 600000).unref();

/* v0.24 — سلف‌چک شبکه: TCP:443 به هر میزبان پین‌شده — نتیجه در activity.log
   و برای رندرر (توست هشدار اگر گوگل در دسترس نباشد) */
function netSelfCheck() {
  try {
    const nodeNet = require('node:net');
    const items = DNS_HOSTS.map((h) => ({ host: h, ip: nodeDnsMap.get(h) || null, ok: false, ms: 0 }));
    let pending = items.length;
    if (!pending) return;
    const done = () => {
      try {
        actLog('net selfcheck: ' + items.map((i) => i.host + ' ' + (i.ok ? 'ok ' + i.ms + 'ms' : 'FAIL')).join(' | '));
        if (win && !win.isDestroyed()) win.webContents.send('ava:net-status', { at: Date.now(), items });
      } catch (_) { /* noop */ }
    };
    for (const it of items) {
      const t0 = Date.now();
      let settled = false;
      const fin = (okv) => {
        if (settled) return;
        settled = true;
        it.ok = okv; it.ms = Date.now() - t0;
        if (--pending <= 0) done();
      };
      const s = nodeNet.connect({ host: it.ip || it.host, port: 443 });
      s.setTimeout(2500, () => { try { s.destroy(); } catch (_) { /* noop */ } fin(false); });
      s.on('connect', () => { try { s.destroy(); } catch (_) { /* noop */ } fin(true); });
      s.on('error', () => fin(false));
    }
  } catch (_) { /* noop */ }
}

/* v0.29.1 — تشخیص‌های سطح واقعی شبکه (به‌جای TCP خام):
   ۱) پراکسی سیستم ویندوز (فیلترشکن‌های پراکسی‌ساز) — اگر باشد، مسیر
      chromiumِ cloudFetch همان‌جا می‌رود و «اتصال ممکن نیست» بی‌معناست؛
   ۲) https-check واقعی به generativelanguage (TLS + HTTP کامل) — selfcheck
      قدیمی فقط TCP بود و «ok» می‌گفت حتی وقتی TLS ریست می‌شد. */
function netDeepDiag() {
  try {
    session.defaultSession.resolveProxy('https://generativelanguage.googleapis.com/')
      .then((p) => {
        try {
          const s = String(p || 'DIRECT').trim();
          actLog('net system proxy for googleapis: ' + s.slice(0, 100) + (s === 'DIRECT' ? ' — no VPN proxy detected' : ' — system proxy active (chromium path will use it)'));
        } catch (_) { /* noop */ }
      })
      .catch(() => { /* noop */ });
  } catch (_) { /* noop */ }
  (async () => {
    const t0 = Date.now();
    try {
      const r = await cloudFetch('https://generativelanguage.googleapis.com/', { method: 'GET', signal: AbortSignal.timeout(7000) });
      /* هر وضعیت HTTP (حتی 404) یعنی TLS+HTTP سالم است؛ مهم فقط «پاسخ رسید» */
      actLog('net https-check generativelanguage: HTTP ' + r.status + ' (' + (Date.now() - t0) + 'ms) via=' + (__cloudVia || '?') + ' → TLS path ' + (r.status ? 'WORKS' : '?'));
    } catch (e) {
      actLog('net https-check generativelanguage: FAIL (' + (Date.now() - t0) + 'ms) ' + String((e && e.message) || e).slice(0, 80) + ' → Gemini/Google APIs unreachable from main process (وب کار می‌کند ولی ابر نه) — فیلترشکن روشن یا رله');
    }
  })();
}

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
/* v0.43 — پخش خودکار ویدیوی یوتیوب داخل خود آوا (پنجرهٔ Watch) */
try { app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required'); } catch (_) { /* noop */ }

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
  win.on('closed', () => {
    win = null;
    /* v0.60 (A20) — شبح‌شدن اپ: بستن پنجرهٔ اصلی قبلاً پنجرهٔ مخفیِ helper
       (zaiWin پل z.ai) را زنده نگه می‌داشت → helperها destroy می‌شوند.
       v0.61 — پنجره‌های ویدیوی خودساختهٔ آوا (یوتیوب/شناور)
       حذف شدند؛ پخش ویدیو با پلیر پیش‌فرضِ خود کاربر است (player:open). */
    try { if (zaiWin && !zaiWin.isDestroyed()) zaiWin.destroy(); } catch (_) { /* noop */ }
    try { app.quit(); } catch (_2) { /* noop */ }
  });

  /* v0.60 (B1) — گارد will-attach-webview برای پنجرهٔ اصلی (هم‌الگوی
     pipWindowManager:189). webviewTag:true فقط برای «یک» webview مشروع است:
     پنل چت z.ai در index.html (src=https://chat.z.ai/، partition persist:ai).
     هر webview دیگر با هر src دیگری preventDefault می‌شود و مهمانِ مجاز هم
     همیشه بدون nodeIntegration/preload وصل می‌شود. */
  win.webContents.on('will-attach-webview', (e, webPreferences, params) => {
    try {
      webPreferences.nodeIntegration = false;
      webPreferences.contextIsolation = true;
      delete webPreferences.preload;
      let src = '';
      try { src = String((params && params.src) || ''); } catch (_) { src = ''; }
      let okSrc = false;
      try {
        const u = new URL(src);
        const h = u.hostname.toLowerCase();
        okSrc = u.protocol === 'ava:' || h === 'chat.z.ai' || h.endsWith('.z.ai');
      } catch (_) { okSrc = false; }
      if (!okSrc) {
        try { e.preventDefault(); } catch (_) { /* noop */ }
        try { actLog('main webview attach BLOCKED: ' + src.slice(0, 120)); } catch (_) { /* noop */ }
      }
    } catch (_) { try { e.preventDefault(); } catch (_2) { /* noop */ } }
  });

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
  /* v0.60 (B4) — media/audioCapture فقط برای مببع برنامه (ava://app)؛
     قبلاً هر سایتی (هر صفحهٔ خارجیِ نشست پیش‌فرض) هم
     بی‌قید مجاز بود. صفحات پارتیشن z.ai (persist:ai) هندلر اختصاصی خودشان
     را در ادامه دارند و مثل قبل مجاز می‌مانند. بقیه با لاگ صادقانه رد می‌شوند. */
  const originOf = (wc, details, requestingOrigin) => {
    try {
      if (typeof requestingOrigin === 'string' && requestingOrigin) return requestingOrigin;
      if (details && typeof details === 'object') {
        if (details.requestOrigin) return String(details.requestOrigin);
        if (details.requestingUrl) return String(details.requestingUrl);
      }
      if (wc && !wc.isDestroyed() && typeof wc.getURL === 'function') return String(wc.getURL() || '');
    } catch (_) { /* noop */ }
    return '';
  };
  const mediaOriginOk = (wc, details, requestingOrigin) =>
    /^ava:\/\//i.test(originOf(wc, details, requestingOrigin));
  const mediaRefused = (wc, permission, details, requestingOrigin) => {
    try {
      actLog('permission DENIED (' + permission + ') for non-app origin: ' +
        String(originOf(wc, details, requestingOrigin) || '?').slice(0, 120));
    } catch (_) { /* noop */ }
  };
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
    if ((permission === 'media' || permission === 'audioCapture') && !mediaOriginOk(wc, details)) {
      mediaRefused(wc, permission, details);
      callback(false);
      return;
    }
    callback(allow.includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((wc, permission, requestingOrigin, details) => {
    if ((permission === 'media' || permission === 'audioCapture') && !mediaOriginOk(wc, details, requestingOrigin)) return false;
    return allow.includes(permission);
  });

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
      /* v0.60 (B2) — تطبیق «دقیقِ» hostname با new URL + مرز نقطه:
         regex پیشوندیِ قبلی https://google.com.evil.com و https://google.com@evil.com
         را هم می‌پذیرفت (پسوند/@ بعد از دامنه به regex ربطی نداشت)؛ حالا
         فقط زیردامنهٔ واقعی (dot-boundary) می‌گذرد. بقیهٔ رفتار عین قبل:
         پاپ‌آپ مجاز = پنجرهٔ درون‌برنامه‌ای با نشست persist:ai؛ بقیهٔ لینک‌ها
         به مرورگر پیش‌فرض سیستم می‌روند. */
      let host = '';
      try { host = new URL(u).hostname.toLowerCase(); } catch (_) { host = ''; }
      const POPUP_HOSTS = ['z.ai', 'zhipu.ai', 'bigmodel.cn', 'google.com', 'googleusercontent.com'];
      const hostOk = POPUP_HOSTS.some((h) => host === h || host.endsWith('.' + h)) ||
        /^accounts\.google\.[a-z.]+$/.test(host);
      if (hostOk && /^https:\/\//i.test(u)) {
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
  /* v0.38.1 — «&» حذف نمی‌شود: لینک‌های یوتیوب با پارامتر (?v=X&list=Y)
     قبلاً خراب می‌شدند؛ در openExternal و داخل کوتیشنِ cmd هر دو امن است */
  return /^https?:\/\//i.test(s) ? s.replace(/["^|<>]/g, '') : null;
};

/* v0.60 (B8) — باز کردن لینک‌های https از مسیر shell.openExternal (هم‌الگوی
   sys:open-url). قبلاً فرمان‌های فقط-URL با `start "" "URL"` از cmd.exe می‌گذشتند
   (متاکراکترهای cmd سطح حملهٔ اضافی بود)؛ حالا خودِ main لینک را باز می‌کند و
   یک فرمان بی‌آزار «ok» برمی‌گرداند تا قرارداد خروجی sys:run دست نخورد.
   باز کردن پوشه‌ها (shell:Downloads)، فایل‌ها (hit.exe) و برنامه‌ها (start chrome)
   عمداً روی `start` ماندند — فقط لینک‌های خالص https مهاجرت شدند. */
const URL_OPEN_MARKER = 'powershell -NoProfile -Command "Write-Output ok"';

/* v0.50 — اولین ویدیوی نتایج یوتیوب («پلی کن» = پخش واقعی، نه فقط صفحهٔ نتایج):
   صفحهٔ نتایج بدون جاوااسکریپت هم ytInitialData با videoId دارد؛
   با استک شبکهٔ کرومیوم (net.fetch) می‌رویم تا پراکسی سیستم و DNS مثل
   بقیهٔ ترافیک عمل کند. sp=EgIQAQ== فقط ویدیوها (نه کانال/پلی‌لیست).
   هر شکستی = '' → فراخواننده صادقانه صفحهٔ نتایج را باز می‌کند */
async function ytFirstVideoId(q) {
  try {
    const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(String(q || '').slice(0, 120)) + '&hl=en&gl=US&sp=EgIQAQ%3D%3D';
    const ac = new AbortController();
    const tId = setTimeout(() => ac.abort(), 8000);
    const r = await net.fetch(url, { signal: ac.signal, headers: { 'accept-language': 'en-US,en;q=0.9' } });
    const t = await r.text();
    clearTimeout(tId);
    const m = t.match(/"videoId":"([A-Za-z0-9_-]{11})"/);
    return m ? m[1] : '';
  } catch (_) { return ''; }
}

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
  open_music:    { cmd: () => { try { shell.openExternal('https://music.youtube.com'); } catch (_) { return null; } return URL_OPEN_MARKER; }, fa: 'یوتیوب موزیک' }, /* v0.60 B8 */
  open_youtube:  { cmd: () => { try { shell.openExternal('https://www.youtube.com'); } catch (_) { return null; } return URL_OPEN_MARKER; }, fa: 'یوتیوب' }, /* v0.60 B8 */
  /* v0.38 — جستجوی مستقیم یوتیوب: «تو یوتیوب آهنگ X رو سرچ کن» */
  /* v0.60 (B8) — بازکردن URL از shell.openExternal (بدون cmd.exe) */
  youtube_search: { cmd: (a) => { try { shell.openExternal(`https://www.youtube.com/results?search_query=${encodeURIComponent(String(a || '').trim().slice(0, 120))}`); } catch (_) { return null; } return URL_OPEN_MARKER; }, fa: 'جستجوی یوتیوب' },
  /* v0.50 — «پلی/پخش کن» = پخشِ واقعی اولین نتیجه (لاگ کاربر v0.49:
     «آهنگ جدید شادمهر تو یوتیوب برام پلی کن» فقط صفحهٔ نتایج باز می‌شد).
     v0.61 — پلیرِ خودساختهٔ آوا حذف شد: پخش با «پلیر پیش‌فرضِ کاربر» است
     (خواستهٔ صریح: «ببین ویدیو پلیر پیش فرض کاربر چیه، با همون پلی کنه»);
     اگر پلیر پیش‌فرض استریم‌پذیر نبود → همان ویدیو در مرورگر باز می‌شود. */
  youtube_play: {
    cmd: (a) => { try { shell.openExternal(`https://www.youtube.com/results?search_query=${encodeURIComponent(String(a || '').trim().slice(0, 120))}`); } catch (_) { return null; } return URL_OPEN_MARKER; }, /* v0.60 B8 */
    asyncCmd: async (a) => {
      const q = String(a || '').trim().slice(0, 120);
      if (!q) { try { shell.openExternal('https://www.youtube.com'); } catch (_) { return null; } return URL_OPEN_MARKER; }
      const vid = await ytFirstVideoId(q);
      const watch = vid ? ('https://www.youtube.com/watch?v=' + vid)
        : `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
      const r = await openWithDefaultPlayer(watch);
      if (r && r.ok) return 'powershell -NoProfile -Command "Write-Output ava_player"';
      try { shell.openExternal(watch); } catch (_) { return null; } /* فالبک مرورگر */
      return URL_OPEN_MARKER;
    },
    fa: 'پخش یوتیوب',
  },
  open_downloads: { cmd: 'start "" "shell:Downloads"',  fa: 'پوشه دانلودها' },
  open_documents: { cmd: 'start "" "shell:Personal"',     fa: 'پوشه اسناد' },

  /* وب */
  /* v0.60 (B8) — web_open/web_search از shell.openExternal(safeUrl(u)) —
     هم‌الگوی sys:open-url؛ دیگر هیچ `start` لختِ URL از cmd.exe رد نمی‌شود */
  web_open:   { cmd: (a) => { const u = safeUrl(a); if (!u) return null; try { shell.openExternal(u); } catch (_) { return null; } return URL_OPEN_MARKER; }, fa: 'سایت' },
  /* v0.42 — «سرچ کن» بدون عبارت دیگر صفحهٔ خالی نتایج گوگل باز نمی‌کند
     (گزارش کاربر: «میگه سرچ کن انجام نده») — خود گوگل باز می‌شود تا کاربر
     عبارتش را تایپ کند؛ عبارت‌دار مثل قبل مستقیم نتایج می‌رود */
  web_search: { cmd: (a) => {
    const q = String(a || '').trim();
    try {
      if (q) shell.openExternal(`https://www.google.com/search?q=${encodeURIComponent(q.slice(0, 200))}`);
      else shell.openExternal('https://www.google.com');
    } catch (_) { return null; }
    return URL_OPEN_MARKER;
  }, fa: 'جستجو' },

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
    /* فیکس v0.43 — گزارش کاربر: «مانیتور خاموش نمیشه». SendMessageW به
       HWND_BROADCAST تا هر پنجرهٔ هنگ‌شده‌ای گیر می‌کرد (تایم‌اوت کل فرمان).
       حالا: PostMessageW (بدون انتظار) + SendMessageTimeoutW (۵۰۰ms،
       SMTO_ABORTIFHUNG) — دو روش مکمل با امضای درست IntPtr در x64 */
    cmd:
      'powershell -NoProfile -Command "' +
      'Start-Sleep -m 350; ' +
      'Add-Type -Namespace W -Name N -MemberDefinition \'[DllImport(\"user32.dll\")] public static extern IntPtr PostMessageW(IntPtr h, uint m, IntPtr w, IntPtr l); [DllImport(\"user32.dll\")] public static extern IntPtr SendMessageTimeoutW(IntPtr h, uint m, IntPtr w, IntPtr l, uint f, uint t, ref IntPtr r);\'; ' +
      '$r = [IntPtr]::Zero; ' +
      '[W.N]::PostMessageW([IntPtr]0xffff,[uint32]0x0112,[IntPtr]0xf170,[IntPtr]2) | Out-Null; ' +
      'Start-Sleep -m 250; ' +
      '[W.N]::SendMessageTimeoutW([IntPtr]0xffff,[uint32]0x0112,[IntPtr]0xf170,[IntPtr]2,2,500,[ref]$r) | Out-Null; ' +
      'Write-Output ok"',
    fa: 'خاموش کردن مانیتور',
  },
  /* v0.43 — خروج از حساب ویندوز («اقدامات این چنینی») */
  sys_logoff: { cmd: 'shutdown /l /f', fa: 'خروج از حساب کاربری' },

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

ipcMain.handle('sys:run', async (_e, id, arg) => {
  const c = COMMANDS[id];
  if (!c) return { ok: false, error: 'فرمان ناشناخته' };
  let cmdStr = typeof c.cmd === 'function' ? c.cmd(arg) : c.cmd;
  /* v0.50 — سازندهٔ ناهمگام (youtube_play اول اولین ویدیو را از شبکه می‌گیرد) */
  if (!cmdStr && typeof c.asyncCmd === 'function') {
    try { cmdStr = await c.asyncCmd(arg); } catch (_) { cmdStr = null; }
  }
  if (!cmdStr) return { ok: false, error: 'ورودی نامعتبر است' };
  /* فرمان‌های پاور: سیستم می‌خوابد/خاموش می‌شود و پروسه exec ممکن است
     timeout بخورد یا با کد غیرصفر بسته شود — ولی خودِ فرمان درست اجرا شده */
  const fireAndForget = ['sys_sleep', 'sys_shutdown', 'sys_restart', 'sys_logoff', 'monitor_off', 'lock'].includes(id);
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
  writeJsonAtomic(f, appsCache); /* v0.38.1 — اتمیک */
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


/* v0.43 — اسکن اپ‌های UWP/Store (Get-StartApps) — «باز کن ماشین‌حساب» بدون
   شورتکات Start Menu هم جواب می‌دهد؛ اجرا با shell:appsFolder\<AppID> */
function scanUwpApps() {
  return new Promise((resolve) => {
    exec(
      "powershell -NoProfile -Command \"Get-StartApps | ForEach-Object { $_.Name + '|' + $_.AppID }\"",
      { windowsHide: true, timeout: 20000, maxBuffer: 1024 * 1024 },
      (err, stdout) => {
        const out = [];
        if (!err && stdout) {
          for (const line of String(stdout).split(/\r?\n/)) {
            const s = line.trim();
            const ix = s.lastIndexOf('|');
            if (ix < 1) continue;
            const name = s.slice(0, ix).trim();
            const appId = s.slice(ix + 1).trim();
            if (!name || !appId || !appId.includes('!') || APP_NAME_JUNK.test(name)) continue;
            out.push({ name, exe: 'shell:appsFolder\\' + appId, lnk: '', kind: 'uwp', appId });
          }
        }
        resolve(out);
      }
    );
  });
}

async function scanAllApps(force = false) {
  const cache = readAppsCache();
  if (!force && cache && cache.at && Date.now() - cache.at < APPS_TTL && Array.isArray(cache.apps)) return cache.apps;
  if (appsScanning) return appsScanning;
  appsScanning = (async () => {
    /* v0.43 — + UWP (Get-StartApps) */
    const [menu, steam, uwp] = await Promise.all([scanStartMenu(), scanSteam(), scanUwpApps()]);
    /* حذف تکراری بر اساس نام نرمال‌شده — اولویت با .exe واقعی */
    const seen = new Map();
    for (const a of [...menu, ...uwp, ...steam]) {
      const k = normAppName(a.name);
      if (!k) continue;
      const prev = seen.get(k);
      if (!prev || (prev.kind === 'steam' && a.kind === 'app') || (prev.kind === 'uwp' && a.kind === 'app')) seen.set(k, a);
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
  writeJsonAtomic(f, reminders); /* v0.38.1 — اتمیک */
}
loadReminders();
setInterval(() => {
  const now = Date.now();
  const due = reminders.filter((r) => !r.done && r.at <= now);
  /* v0.47 — B01: حذفِ فوری حذف شد — یادآوری تا ack رندرر (یا ۳۰ ثانیه) نگه داشته
     و در صورت نشدن ack دوباره ارسال می‌شود؛ قبلاً اگر رندرر در لحظهٔ شلیک
     reload بود، یادآوری برای همیشه گم می‌شد (ریشهٔ «یادآوری‌ام کجا رفت») */
  for (const r of due) { r.done = true; r.doneAt = now; r.sentAt = 0; }
  const pendingAck = reminders.filter((r) => r.done && !r.acked);
  let dirty = due.length > 0;
  for (const r of pendingAck) {
    if (!r.sentAt) { sendUI('reminders:due', { id: r.id, text: r.text, at: r.at, kind: r.kind || 'reminder' }); r.sentAt = now; dirty = true; }
    else if (now - r.sentAt >= 8000 && now - (r.doneAt || now) < 30000) { sendUI('reminders:due', { id: r.id, text: r.text, at: r.at, kind: r.kind || 'reminder' }); r.sentAt = now; } /* یک تکرار نجات‌دهنده */
  }
  reminders = reminders.filter((r) => !r.done || (!r.acked && now - (r.doneAt || now) < 30000));
  if (dirty) saveReminders();
  /* v0.47 — B01: تا وقتی یادآوری/تایمر در انتظار است، ویندوز جلسه را معلق نکند
     (Modern Standby تایمرهای جاوااسکریپت را قایم می‌کند — یکی از ریشه‌های شلیک‌نشدن) */
  const hasPending = reminders.some((r) => !r.done);
  if (hasPending && !powerSaveBlocker.isStarted(remPsbId)) remPsbId = powerSaveBlocker.start('prevent-app-suspension');
  else if (!hasPending && remPsbId !== null && powerSaveBlocker.isStarted(remPsbId)) { powerSaveBlocker.stop(remPsbId); remPsbId = null; }
}, 4000);
let remPsbId = null;

ipcMain.handle('reminders:add', (_e, p) => {
  const text = String((p && p.text) || '').trim().slice(0, 300);
  const at = Number(p && p.at);
  /* v0.47 — B01: kind/label/unit برای تایمرهای پایدار (kind=timer) */
  const kind = (p && p.kind === 'timer') ? 'timer' : 'reminder';
  const label = String((p && p.label) || '').slice(0, 40);
  const unit = String((p && p.unit) || '').slice(0, 20);
  if (!text) return { ok: false, error: 'متن یادآوری خالی است' };
  if (!Number.isFinite(at) || at <= Date.now() + 3000) return { ok: false, error: 'زمان یادآوری باید در آینده باشد' };
  if (reminders.length >= 100) return { ok: false, error: 'فهرست یادآوری‌ها پر است' };
  const rem = { id: Date.now() + Math.floor(Math.random() * 999), text, at, kind, label, unit };
  reminders.push(rem);
  saveReminders();
  return { ok: true, reminder: rem };
});
/* v0.47 — B01: رندرر شلیک را تأیید می‌کند → حذف قطعی */
ipcMain.handle('reminders:ack', (_e, id) => {
  reminders = reminders.filter((r) => r.id !== Number(id));
  saveReminders();
  return { ok: true };
});
ipcMain.handle('reminders:list', () => ({ ok: true, reminders: reminders.filter((r) => !r.done).sort((a, b) => a.at - b.at) }));

/* ============================================================
   v0.47 — حافظهٔ یادگیری آوا (SELF-LEARNING — درخواست صریح کاربر)
   «اگ از ai یک درخواستی کرد کاربر ava خودش اون رو یاد بگیره و دفعات
   بعد افلاین انجام بده» — ذخیرهٔ پایدار و اتمیک در ava-learnings.json
   منطق یادگیری/فازی/نارضایتی در renderer/js/voiceLearn.js است؛
   اینجا فقط نگهداریِ فایل است (writeJsonAtomic).
   ============================================================ */
const LEARN_FILE = () => path.join(app.getPath('userData'), 'ava-learnings.json');
let learningsCache = null;
function loadLearnings() {
  if (learningsCache) return learningsCache;
  try { learningsCache = JSON.parse(fs.readFileSync(LEARN_FILE(), 'utf8')) || null; } catch (_) { learningsCache = null; }
  if (!learningsCache || typeof learningsCache !== 'object' || !Array.isArray(learningsCache.items)) learningsCache = { v: 1, items: [] };
  return learningsCache;
}
ipcMain.handle('learnings:load', () => ({ ok: true, data: loadLearnings() }));
ipcMain.handle('learnings:save', (_e, data) => {
  try {
    if (!data || typeof data !== 'object' || !Array.isArray(data.items)) return { ok: false, error: 'bad-shape' };
    if (data.items.length > 200) data.items = data.items.slice(0, 200);
    learningsCache = data;
    writeJsonAtomic(LEARN_FILE(), data);
    return { ok: true };
  } catch (e) { return { ok: false, error: String((e && e.message) || e).slice(0, 120) }; }
});
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
    const m = /\/tag\/(v?[0-9A-Za-z.+-]+)</.exec(xml);
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
let manualDl = null; // v0.60 (A19): { file, partFile, version, url, size, active, cancel, complete, received }
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
    /* v0.38.1 — خطای دیسک (پر شدن/IO) قبلاً promise را معلق می‌گذاشت و UI در
       «در حال دانلود» گیر می‌کرد */
    ws.on('error', (e) => finish(e));
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
    /* v0.60 (A19) — دانلود در فایل «.part» نوشته می‌شود و فقط بعد از کامل‌شدن
       به نام نهایی rename می‌شود. قبلاً مستقیم روی مسیر نهایی می‌نوشت؛ لغو/قطعی
       وسط راه یک نصّاب ناقص جا می‌گذاشت و updater:install فقط با existsSync
       همان فایل شکسته را «سالم» می‌پنداشت و اجرا می‌کرد. سایز رسمی (از API)
       هم برای صحت‌سنجی بعد از دانلود نگه داشته می‌شود. */
    const partFile = file + '.part';
    manualDl = { file, partFile, version: meta.version, url, size: meta.size || 0, active: true, cancel: false, complete: false };
    sendUI('updater:status', { state: 'downloading', percent: 0 });
    await ghDownloadToFile(url, partFile, (pct) => sendUI('updater:status', { state: 'downloading', percent: pct, manual: true }), manualDl);
    /* A19 — صحت‌سنجی سایز قبل از rename: اگر سایز رسمی از API آمده باید دقیقاً
       بخورد؛ وگرنه حداقل نصّاب واقعی ده‌ها مگابایت است (نه پاسخ خطای HTML) */
    const st = fs.statSync(partFile);
    if (manualDl.size && st.size !== manualDl.size) throw new Error(`incomplete download: got ${st.size} of ${manualDl.size} bytes`);
    if (!manualDl.size && st.size < 1024) throw new Error('incomplete download: file too small');
    fs.renameSync(partFile, file);
    manualDl.active = false;
    manualDl.complete = true;
    manualDl.received = st.size;
    updLog(`manual download complete: ${file} (${meta.via}${manualDl.size ? ', size verified ' + st.size : ', ' + st.size + ' bytes'})`);
    sendUI('updater:status', { state: 'ready-manual', version: meta.version });
    return { ok: true, file };
  } catch (e) {
    /* A19 — پاکسازی: فایل نیمه‌کاره حذف و manualDl.file خالی می‌شود تا
       updater:install هرگز نصّاب شکسته را اجرا نکند */
    if (manualDl) {
      manualDl.active = false;
      if (manualDl.partFile) { try { fs.unlinkSync(manualDl.partFile); } catch (_) { /* noop */ } }
      manualDl.file = null;
      manualDl.partFile = null;
      manualDl.complete = false;
    }
    const msg = String((e && e.message) || e);
    if (/cancel/i.test(msg)) {
      updLog('manual download cancelled by user — partial file removed');
      sendUI('updater:status', { state: 'canceled' });
      return { ok: false, cancelled: true };
    }
    updLog(`manual download failed: ${msg} — partial file removed`);
    sendUI('updater:status', { state: 'error', message: msg.slice(0, 160) });
    return { ok: false, error: msg };
  }
});

ipcMain.handle('updater:install', () => {
  /* اگر نصّاب به‌صورت مستقیم دانلود شده، همان را اجرا کن
     v0.60 (A19) — فقط نصّابِ «کامل» (پرچم complete + سایز درست) اجرا می‌شود؛
     نصّاب ناقص/خراب حذف و وضعیت پاک می‌شود تا مسیر autoUpdater برود */
  if (manualDl && manualDl.file && manualDl.complete && fs.existsSync(manualDl.file)) {
    let sizeOk = true;
    try { sizeOk = !manualDl.size || fs.statSync(manualDl.file).size === manualDl.size; } catch (_) { sizeOk = false; }
    if (!sizeOk) {
      updLog('manual installer failed size verification — discarding');
      try { fs.unlinkSync(manualDl.file); } catch (_) { /* noop */ }
      manualDl.file = null;
      manualDl.complete = false;
    } else {
      updLog(`install via manually downloaded installer: ${manualDl.file}`);
      /* v0.38.1 — openPath خطا را به‌صورت رشته resolve می‌کند؛ قبلاً در هر حال
         ۱.۵ ثانیه بعد quit می‌شد — حتی وقتی نصّاب بلاک شده بود */
      shell.openPath(manualDl.file).then((res) => {
        const errStr = String(res || '');
        if (errStr) {
          updLog('installer open failed: ' + errStr.slice(0, 120));
          actLog('updater: installer open failed: ' + errStr.slice(0, 120));
          if (win && !win.isDestroyed()) {
            try { win.show(); win.webContents.send('updater:status', { state: 'error', message: 'اجرای نصّاب ناموفق بود: ' + errStr.slice(0, 90) }); } catch (_) { /* noop */ }
          }
        } else {
          setTimeout(() => app.quit(), 1500);
        }
      });
      return true;
    }
  }
  if (autoUpdater && app.isPackaged) autoUpdater.quitAndInstall(false, true);
  return false;
});

/* ---------- IPC: تنظیمات سیستمی ---------- */
/* کپی متن در کلیپ‌بورد ویندوز (گزارش خطاها — v0.16.1) */
ipcMain.handle('sys:copy-text', (_e, txt) => {
  try { clipboard.writeText(String(txt || '')); return true; } catch (_) { return false; }
});

/* v0.61 — خواندن کلیپ‌بورد (جایگزین pip:clip بعد از حذف پنجرهٔ شناور):
   «لینکی که کپی کردم رو باز کن» / «با وی‌ال‌سی پخش کن» از همین می‌خواند */
ipcMain.handle('sys:clipboard', () => {
  try { return { ok: true, text: String(clipboard.readText() || '').slice(0, 2000) }; }
  catch (_) { return { ok: false, text: '' }; }
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
/* خواندن مستقیم تنظیمات از فایل — برای پروسهٔ اصلی (موتور آفلاین و…) */
function loadedSettings() {
  const f = settingsFile();
  try { return JSON.parse(fs.readFileSync(f, 'utf8')) || {}; } catch (_) { return {}; }
}
ipcMain.handle('settings:load', () => {
  const f = settingsFile();
  if (!f) return {};
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return {}; }
});
/* v0.38.1 — نوشتن اتمیک JSON: قطع برق/کرش وسط نوشتن فایل settings را نیمه‌کاره
   نمی‌گذارد (قبلاً ava-settings.json خراب می‌شد و همهٔ کلیدها/تنظیمات می‌پرید) */
function writeJsonAtomic(file, obj) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
    fs.renameSync(tmp, file);
    return true;
  } catch (_) { return false; }
}

ipcMain.handle('settings:save', (_e, obj) => {
  const f = settingsFile();
  if (!f || !obj || typeof obj !== 'object') return false;
  return writeJsonAtomic(f, obj);
});

/* v0.31.0 — یادداشت‌های صوتی: فایل مستقل ava-notes.json (جدای settings تا
   ذخیرهٔ تنظیمات هرگز یادداشت‌ها را نبلعد) — آرایهٔ {t, x}، جدیدترین اول */
function notesFile() {
  try { return path.join(app.getPath('userData'), 'ava-notes.json'); } catch (_) { return ''; }
}
ipcMain.handle('notes:load', () => {
  const f = notesFile();
  if (!f) return [];
  try {
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    return Array.isArray(j) ? j.slice(0, 200) : [];
  } catch (_) { return []; }
});
ipcMain.handle('notes:save', (_e, arr) => {
  const f = notesFile();
  if (!f || !Array.isArray(arr)) return false;
  return writeJsonAtomic(f, arr.slice(0, 200)); /* v0.38.1 — اتمیک */
});

/* v0.60 (A22) — هندلر مردهٔ 'sys:type-text' (با خط تیره) حذف شد؛ کانال زندهٔ
   همین قابلیت 'sys:typeText' است (main.js/preload.js/renderer) و هیچ
   فراخوانی‌کننده‌ای برای نسخهٔ خط‌تیره وجود نداشت (grep-راستی‌آزمایی شد).
   منطق تایپ در برنامهٔ فعال حالا فقط در هندلر زنده است. */

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
/* v0.31.0 — دیکشنری آفلاین شهرهای ایران (مختصات رسمی) — حالا در سطح ماژول تا
   هم آب‌وهوا و هم اوقات شرعی/مختصات (sys:geo) از یک منبع مشترک استفاده کنند.
   اگر geocoding در فیلترینگ از دسترس خارج شود یا جواب ندهد، شهرهای اصلی ایران
   بدون هیچ سرور کمکی کار می‌کنند. بجنورد (گزارش کاربر) در فهرست است. */
const IR_CITIES = {
  'تهران': [35.6892, 51.389], 'مشهد': [36.2605, 59.6168], 'اصفهان': [32.6539, 51.666],
  'تبریز': [38.08, 46.2919], 'شیراز': [29.5918, 52.5837], 'کرج': [35.8355, 50.9915],
  'اهواز': [31.3183, 48.6706], 'قم': [34.6416, 50.8746], 'کرمانشاه': [34.3142, 47.065],
  'ارومیه': [37.5527, 45.0761], 'رشت': [37.2808, 49.5832], 'زاهدان': [29.4963, 60.8629],
  'همدان': [34.7992, 48.5146], 'کرمان': [30.2839, 57.0834], 'یزد': [31.8974, 54.3569],
  'اردبیل': [38.2498, 48.2933], 'بندرعباس': [27.1865, 56.2808], 'اراک': [34.0917, 48.463],
  'زنجان': [36.6736, 48.4787], 'سنندج': [35.3219, 46.9862], 'قزوین': [36.2688, 50.0041],
  'بجنورد': [37.4747, 57.329], 'بیرجند': [32.8663, 59.2211], 'ایلام': [33.6374, 46.4227],
  'یاسوج': [30.6684, 51.588], 'شهرکرد': [32.3256, 50.8644], 'ساری': [36.5633, 53.0601],
  'گرگان': [36.8427, 54.4441], 'خرمآباد': [33.4878, 48.3558], 'سمنان': [35.5729, 53.3971],
  'بوشهر': [28.9234, 50.8203], 'آبادان': [30.3392, 48.3043], 'دزفول': [32.3814, 48.4056],
  'کیش': [26.5578, 54.0229], 'قشم': [26.9581, 56.2719], 'نیشابور': [36.2133, 58.7958],
  'سبزوار': [36.2127, 57.6819], 'ملایر': [34.2993, 48.8184], 'مراغه': [37.3895, 46.2382],
  'مرند': [38.4329, 45.7749], 'لنگرود': [37.1961, 50.1536], 'چالوس': [36.6515, 51.4273],
};
const cityNorm = (s) => String(s || '').replace(/[\s\u200C]+/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک');

/* v0.31.0 — مختصات شهر برای محاسبه‌های محلی رندرر (اوقات شرعی آفلاین) */
ipcMain.handle('sys:geo', (_e, city) => {
  const c = String(city || '').trim().slice(0, 60);
  if (!c) return { ok: false };
  const local = IR_CITIES[cityNorm(c)];
  if (local) return { ok: true, name: c, lat: local[0], lng: local[1] };
  return { ok: false, name: c };
});

/* v0.31.0 — قیمت لحظه‌ای ارز/طلا/سکه/رمزارز — بدون کلید، از tgju (سایت رسمی
   بازار ایران؛ در فیلترینگ هم در دسترس است) با زنجیرهٔ mirror. اعداد «ریال»
   هستند و رندرر به تومان (÷۱۰) تبدیل می‌کند؛ رمزارز دو رقم دارد: دلاری (plain)
   و ریالی (-irr). پاسخ صادقانه: هر کی غایب بود همان جا گزارش می‌شود. */
const TGFETCH_TIMEOUT = 12000;
async function tgjuFetch() {
  const mirrors = [
    'https://call.tgju.org/ajax.json',
    'https://call3.tgju.org/ajax.json',
    'https://call4.tgju.org/ajax.json',
  ];
  let lastErr = '';
  for (const u of mirrors) {
    try {
      const r = await cloudFetch(u, { signal: AbortSignal.timeout(TGFETCH_TIMEOUT) });
      if (!r.ok) { lastErr = `HTTP ${r.status} @ ${u}`; continue; }
      const j = await r.json().catch(() => null);
      if (j && j.current && Object.keys(j.current).length > 50) return j.current;
      lastErr = 'payload unreadable @ ' + u;
    } catch (e) {
      lastErr = String((e && e.message) || e).slice(0, 100) + ' @ ' + u;
    }
  }
  throw new Error(lastErr || 'all tgju mirrors failed');
}
const RATED_KEYS = [
  'price_dollar_rl', 'price_eur', 'price_gbp', 'price_aed',
  'geram18', 'mesghal', 'ons',
  'sekee', 'sekeb', 'nim', 'rob', 'gerami',
  'crypto-bitcoin', 'crypto-bitcoin-irr', 'crypto-ethereum', 'crypto-ethereum-irr',
  'crypto-tether', 'crypto-tether-irr', 'crypto-solana', 'crypto-solana-irr',
  'crypto-dogecoin', 'crypto-dogecoin-irr', 'crypto-binance-coin', 'crypto-binance-coin-irr',
];
ipcMain.handle('sys:rates', async () => {
  try {
    const cur = await tgjuFetch();
    const q = {};
    for (const k of RATED_KEYS) {
      const it = cur[k];
      if (!it || it.p == null) continue;
      const p = parseFloat(String(it.p).replace(/,/g, ''));
      if (!isFinite(p) || p <= 0) continue;
      q[k] = { p, dp: parseFloat(String(it.dp || '0').replace(/,/g, '')) || 0, dt: String(it.dt || '') };
    }
    if (!Object.keys(q).length) return { ok: false, error: 'سرویس قیمت پاسخ خالی داد', netFail: true };
    return { ok: true, q };
  } catch (e) {
    return { ok: false, error: netErr(e), netFail: isNetFail(e && e.message) };
  }
});

ipcMain.handle('sys:weather', async (_e, city) => {
  const c = String(city || 'تهران').trim().slice(0, 60) || 'تهران';
  const local = IR_CITIES[cityNorm(c)];
  const wFail = (msg, netFail) => (netFail ? { ok: false, error: msg, netFail: true } : { ok: false, error: msg });
  try {
    let g = local ? { latitude: local[0], longitude: local[1], name: c } : null;
    if (!g) {
      const gr = await cloudFetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(c)}&count=1&language=fa&format=json`,
        { signal: AbortSignal.timeout(10000) }
      );
      /* v0.29.2 — ریشهٔ «شهری به نام بجنورد پیدا نشد» در فیلترینگ: gr.ok هرگز
         بررسی نمی‌شد و json().catch(()=>({})) پاسخ HTML فیلتر را به {}
         تبدیل می‌کرد → شکست شبکه دروغ «شهر پیدا نشد» می‌گفت. حالا صادقانه
         netFail برمی‌گردد و رندرر درخواست را به هوش مصنوعی ارجاع می‌دهد. */
      if (!gr.ok) return wFail(`سرویس آب‌وهوا پاسخ نداد (HTTP ${gr.status})`, true);
      const gj = await gr.json().catch(() => null);
      if (!gj) return wFail('پاسخ سرویس شهرها خوانده نشد — شبکه فیلترشده است', true);
      g = gj && gj.results && gj.results[0];
    }
    if (!g || g.latitude == null || g.longitude == null) {
      /* شهر واقعاً در سرویس نبود — بن‌بست نیست؛ رندرر به هوش مصنوعی ارجاع می‌دهد */
      return wFail(`شهری به نام «${c}» در سرویس آب‌وهوا پیدا نشد`);
    }
    const fr = await cloudFetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!fr.ok) return wFail(`سرویس پیش‌بینی پاسخ نداد (HTTP ${fr.status})`, true);
    const fj = await fr.json().catch(() => null);
    const cur = fj && fj.current;
    if (!cur) return wFail('داده آب‌وهوا نرسید — پاسخ سرویس ناخوانا بود', true);
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
    return { ok: false, error: netErr(e), netFail: true };
  }
});

/* ============================================================
   هوش مصنوعی GLM — چت + تشخیص گفتار ابری (GLM-ASR)
   کلید API فقط در همین پروسه استفاده می‌شود و جایی لاگ نمی‌شود.
   base پیش‌فرض: https://api.z.ai/api/paas/v4  (سازگار با open.bigmodel.cn)
   ============================================================ */
const trimBase = (b) => String(b || 'https://api.z.ai/api/paas/v4').replace(/\/+$/, '');
const isNetFail = (m) => /fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|aborted|timed?\s?out|اتصال به سرور برقرار نشد/i.test(String(m || ''));
const netErr = (e) => {
  const m = String((e && e.message) || e);
  if (isNetFail(m)) {
    /* v0.27 — دیگر هیچ پیامی دربارهٔ DNS/فیلترشکن به کاربر نشان داده نمی‌شود
       (درخواست صریح کاربر). جزئیات فنی فقط در activity.log می‌رود؛ پیام کاربر
       خنثی است و راه‌حل واقعی (بستهٔ آفلاین) را تنظیمات پیشنهاد می‌دهد. */
    actLog('net-level failure (technical, not shown to user): ' + m.slice(0, 120));
    return 'اتصال به سرور برقرار نشد — چند لحظه بعد دوباره امتحان کن';
  }
  return m.slice(0, 140);
};
/* ============================================================
   v0.51 — تحقیقِ وبِ واقعی برای فاز research هوش مصنوعی
   (ریشهٔ توهم «نازنین» در لاگ v0.50: AI اسم آهنگ را از حافظهٔ
   کهنه‌اش ساخت چون ابزار تحقیق نداشت. حالا نتایج واقعی وب به
   دور دوم AI تزریق می‌شود تا اکشن نهایی داده‌محور باشد.)
   DuckDuckGo HTML endpoint — بدون JS، پارسِ رجکسی پایدار، بدون کلید.
   هر شکستی = '' → دور دوم صادقانه می‌گوید تحقیق ناموفق بود.
   ============================================================ */
function ddgDecode(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
async function aiWebResearch(q) {
  try {
    const qq = encodeURIComponent(String(q || '').trim().slice(0, 150));
    if (!qq) return '';
    const ac = new AbortController();
    const tId = setTimeout(() => ac.abort(), 9000);
    const headers = {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'accept-language': 'fa,en;q=0.8',
    };
    let rows = [];
    /* پیش‌فرض: DuckDuckGo HTML endpoint */
    try {
      const r = await net.fetch('https://html.duckduckgo.com/html/?q=' + qq + '&kl=wt-wt', { signal: ac.signal, headers });
      const t = await r.text();
      const re = /<a[^>]+class="result__a"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=<a[^>]+class="result__a"|$)/g;
      let m;
      while ((m = re.exec(t)) && rows.length < 6) {
        const title = ddgDecode(m[1]);
        const sn = m[2].match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
        const snippet = sn ? ddgDecode(sn[1]) : '';
        if (title) rows.push(title + (snippet ? ' — ' + snippet.slice(0, 160) : ''));
      }
    } catch (_) { /* DDG ناموفق → Bing */ }
    /* جایگزین: Bing RSS — خروجی XML تمیز و پایدار */
    if (!rows.length) {
      try {
        const ac2 = new AbortController();
        const t2id = setTimeout(() => ac2.abort(), 9000);
        const r2 = await net.fetch('https://www.bing.com/search?q=' + qq + '&format=rss&count=8', { signal: ac2.signal, headers });
        const x = await r2.text();
        clearTimeout(t2id);
        const itemRe = /<item>([\s\S]*?)<\/item>/g;
        let it;
        while ((it = itemRe.exec(x)) && rows.length < 6) {
          const ti = ddgDecode((it[1].match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
          const de = ddgDecode((it[1].match(/<description>([\s\S]*?)<\/description>/) || [])[1]);
          if (ti) rows.push(ti + (de ? ' — ' + de.slice(0, 160) : ''));
        }
      } catch (_) { /* هر دو ناموفق */ }
    }
    clearTimeout(tId);
    return rows.slice(0, 6).map((s, i) => (i + 1) + ') ' + s).join('\n').slice(0, 1600);
  } catch (_) { return ''; }
}
ipcMain.handle('ai:research', async (_e, q) => {
  const out = await aiWebResearch(q);
  return { ok: !!out, text: out };
});
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
      const r = await cloudFetch(trimBase(base) + '/chat/completions', {
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
      /* v0.29.3 — z.ai مسیر v1 را کاملاً بست (۴۰۴ برای همه؛ لاگ کاربر: «z.ai: Not Found»).
         نسخهٔ v2 زنده است (۴۰۱ با توکن بدهکار). الگوریتم امضا از باندل فرانت‌اند
         z.ai بازسازی شده: v = HMAC('key-…',''+floor(ts/300000))؛ sig = HMAC(v,
         sortedPayload|base64(prompt)|ts) — js-sha256 hmac(key,msg) → WebCrypto همان. */
      let uid = '';
      try {
        const ui = JSON.parse(localStorage.getItem('user') || localStorage.getItem('user_info') || '{}');
        uid = String((ui && (ui.id || ui.user_id)) || '');
      } catch (e) {}
      const hexHmac = async function (keyStr, msgStr) {
        const enc = new TextEncoder();
        const k = await crypto.subtle.importKey('raw', enc.encode(keyStr), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const sb = await crypto.subtle.sign('HMAC', k, enc.encode(msgStr));
        return Array.from(new Uint8Array(sb)).map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      };
      const sigTs = String(Date.now());
      const sigBucket = String(Math.floor(Number(sigTs) / 300000));
      const sigRid = uuid();
      const sigPrompt = String((CFG.messages[CFG.messages.length - 1] && CFG.messages[CFG.messages.length - 1].content) || '').trim().slice(0, 2000);
      const sigBytes = new TextEncoder().encode(sigPrompt);
      let sigBin = '';
      for (let si = 0; si < sigBytes.length; si++) sigBin += String.fromCharCode(sigBytes[si]);
      const sigB64 = btoa(sigBin);
      const sigV = await hexHmac('key-@@@@)))()((9))-xxxx&&&%%%%%', sigBucket);
      const sigX = await hexHmac(sigV, 'requestId,' + sigRid + ',timestamp,' + sigTs + ',user_id,' + uid + '|' + sigB64 + '|' + sigTs);
      const zq = 'timestamp=' + encodeURIComponent(sigTs) + '&requestId=' + encodeURIComponent(sigRid) + '&user_id=' + encodeURIComponent(uid) + '&signature_timestamp=' + encodeURIComponent(sigTs);
      const zbody = JSON.stringify({
        stream: true,
        chat_id: uuid(),
        id: uuid(),
        model: mdl,
        messages: CFG.messages,
        signature_prompt: sigPrompt,
        features: { enable_thinking: false },
      });
      const zfetch = function (base) {
        return fetch(base + '/chat/completions?' + zq, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
            'X-FE-Version': 'prod-fe-1.1.92',
            'X-Signature': sigX,
          },
          body: zbody,
        });
      };
      let r = await zfetch('/api/v2');
      if (r.status === 404) r = await zfetch('/api'); /* فالبک v1 در استقرارهای قدیمی */
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
      new Promise((res) => setTimeout(() => res(null), 35000)), /* v0.47 B30: ۱۰۰ثانیه→۳۵ — یک صفحهٔ هنگ‌کرده زنجیرهٔ auto را قفل نمی‌کند */
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
  /* v0.29.3 — امضای HMAC برای مسیر v2 (بازسازی الگوریتم باندل z.ai؛
     js-sha256 hmac(key,msg) = createHmac(key).update(msg).hex). v1 مرده است
     (۴۰۴ برای همه) — لاگ کاربر: «z.ai: Not Found» بعد از ۲۹ ثانیه. */
  const zSigTs = String(Date.now());
  const zSigBucket = String(Math.floor(Number(zSigTs) / 300000));
  const zSigRid = crypto.randomUUID();
  const zSigPrompt = String((messages[messages.length - 1] && messages[messages.length - 1].content) || '').trim().slice(0, 2000);
  const zSigB64 = Buffer.from(zSigPrompt, 'utf8').toString('base64');
  const zHmac = (k, m) => crypto.createHmac('sha256', k).update(m, 'utf8').digest('hex');
  const zSigV = zHmac('key-@@@@)))()((9))-xxxx&&&%%%%%', zSigBucket);
  const zSigX = zHmac(zSigV, 'requestId,' + zSigRid + ',timestamp,' + zSigTs + ',user_id,|' + zSigB64 + '|' + zSigTs);
  const zQs = 'timestamp=' + encodeURIComponent(zSigTs) + '&requestId=' + encodeURIComponent(zSigRid)
    + '&user_id=' + '&signature_timestamp=' + encodeURIComponent(zSigTs);
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${String(token).trim()}`,
    Accept: '*/*',
    'User-Agent': CHROME_UA,
    'X-FE-Version': 'prod-fe-1.1.92',
    'X-Signature': zSigX,
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
        const mr = await cloudFetch(`${ZAI}/api/models`, { headers, signal: AbortSignal.timeout(15000) });
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
    const r = await cloudFetch(`${ZAI}/api/v2/chat/completions?${zQs}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        stream: true,
        chat_id: chatId,
        id: crypto.randomUUID(),
        model: mdl,
        messages: messages.slice(-16),
        signature_prompt: zSigPrompt,
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
    const r = await cloudFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': `audio/l16; rate=${Number(rate) || 16000}` },
      body: Buffer.from(pcm),
      signal: AbortSignal.timeout(15000), /* شبکه گیر کرد → پیام واضح، نه انتظار بی‌پایان */
    });
    const raw = await r.text();
    if (!r.ok) {
      let msg = `HTTP ${r.status}`;
      try { const j = JSON.parse(raw); msg = (j.error && j.error.message) || msg; } catch (_) { /* noop */ }
      /* v0.27 — پیام خنثی؛ بدون فیلترشکن/DNS (جزئیات فنی فقط در لاگ) */
      if (r.status === 403) { msg = 'دسترسی گوگل موقتا برقرار نشد — با بستهٔ آفلاین، صدای تو همیشه تبدیل می‌شود'; actLog('stt:google 403 — key=' + (key ? 'custom' : 'builtin')); }
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

/* ============================================================
   v0.27 — موتور آفلاین همیشه-کار (sherpa-onnx + Whisper int8)
   ============================================================
   درخواست صریح کاربر: «اصلاً چرا باید برای برقراری ارتباط به اینترنت/DNS
   وابسته باشیم؟» — این موتور ۱۰۰٪ داخل ویندوز اجرا می‌شود: بدون اینترنت،
   بدون فیلترینگ، بدون کلید، بدون DNS. حتی اگر همه‌چیز فیلتر باشد صدای
   کاربر تبدیل می‌شود.
   • پروژهٔ متن‌باز: https://github.com/k2-fsa/sherpa-onnx (Apache-2.0)
   • مدل: Whisper base چندزبانهٔ OpenAI، کوانتیزه int8، زبان فارسی
   • بسته: یک‌بار دانلود ~۲۱۰MB از GitHub/HF → اجرای همیشگی آفلاین
   ⚠ قیدهای سخت Electron (با تست واقعی ثابت شد):
     - هرگز sherpa.readWave صدا نزن (external buffer → Electron اجازه
       نمی‌دهد: «External buffers are not allowed»)؛ PCM را خودمان از
       Int16 به Float32 تبدیل می‌کنیم؛
     - addon فقط از مسیرهای asar-unpacked/ماژول‌محلی لود شود. */

let sherpaNode = null;        /* ماژول sherpa-onnx-node */
let sherpaFailed = '';        /* اگر لود نشد — دلیل، برای لاگ */
let offlineRec = null;        /* OfflineRecognizer آماده */
let offlineLang = '';         /* زبان ساخته‌شدهٔ فعلی */
let offlineBusy = false;      /* decode در جریان است (تک‌نفره) */
let offlineDl = null;         /* { on, pct } دانلود جاری */
let lastLocalSttAt = Date.now(); /* v0.44 — برای تخلیهٔ خودکار موتور آفلاینِ بیکار */
const OFFLINE_FILES = ['base-encoder.int8.onnx', 'base-decoder.int8.onnx', 'base-tokens.txt'];
const offlineDir = () => path.join(app.getPath('userData'), 'models', 'whisper-base-int8');

const offlineInstalled = () => {
  try {
    const d = offlineDir();
    return OFFLINE_FILES.every((f) => { try { return fs.statSync(path.join(d, f)).size > 1000; } catch (_) { return false; } });
  } catch (_) { return false; }
};

/* تبدیل Int16 → Float32 در [-1,1] — همان قرارداد شکل‌موج؛ بدون بافر خارجی */
function i16ToF32(buf) {
  const n = Math.floor(buf.length / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(i * 2) / 32768;
  return out;
}

function offlineLangCode(settings) {
  const l = String((settings && settings.sttLang) || 'fa-IR');
  return /^en/i.test(l) ? 'en' : 'fa';
}

function loadOfflineEngine(settings, force) {
  if (offlineRec && !force && offlineLang === offlineLangCode(settings)) return offlineRec ? { ok: true } : { ok: false, error: sherpaFailed };
  offlineLang = offlineLangCode(settings);
  if (!sherpaNode) {
    try { sherpaNode = require('sherpa-onnx-node'); }
    catch (e) {
      sherpaFailed = 'sherpa-onnx-node load failed: ' + String(e && e.message).slice(0, 90);
      actLog('offline engine: ' + sherpaFailed);
      return { ok: false, error: sherpaFailed };
    }
  }
  if (!offlineInstalled()) return { ok: false, error: 'offline-pack-missing' };
  try {
    const d = offlineDir();
    offlineRec = new sherpaNode.OfflineRecognizer({
      modelConfig: {
        whisper: {
          encoder: path.join(d, 'base-encoder.int8.onnx'),
          decoder: path.join(d, 'base-decoder.int8.onnx'),
          language: offlineLang,
          task: 'transcribe',
          tailPaddings: -1,
          enableTokenTimestamps: 0,
          enableSegmentTimestamps: 0,
        },
        tokens: path.join(d, 'base-tokens.txt'),
        numThreads: 2,
        debug: 0,
        provider: 'cpu',
      },
    });
    actLog('offline engine ready (whisper-base int8, lang=' + offlineLang + ')');
    return { ok: true };
  } catch (e) {
    offlineRec = null;
    sherpaFailed = 'recognizer init failed: ' + String(e && e.message).slice(0, 90);
    actLog('offline engine: ' + sherpaFailed);
    return { ok: false, error: sherpaFailed };
  }
}

ipcMain.handle('stt:local:status', () => {
  const inst = offlineInstalled();
  /* v0.47 — B19: status دیگر موتور ~۲۰۰MB را sync لود نمی‌کند (لاگ: ۱۸ بار
     «offline engine ready» در ~۱۰ بوت — کاربرانی که هرگز آفلاین/wake ندارند
     هم RAM و بوت می‌پرداختند). لود تنبل فقط با اولین stt:local واقعی رخ می‌دهد. */
  return { installed: inst, ready: !!(inst && offlineRec), busy: offlineBusy, downloading: !!(offlineDl && offlineDl.on), error: sherpaFailed || undefined };
});

ipcMain.handle('stt:local', async (_e, p) => {
  const { pcm, rate, lang } = p || {};
  if (!pcm || !pcm.length) return { ok: false, error: 'صدایی برای تبدیل وجود ندارد' };
  if (offlineBusy) return { ok: false, error: 'موتور آفلاین مشغول است' };
  if (offlineDl && offlineDl.on) return { ok: false, error: 'بستهٔ آفلاین در حال دانلود است' };
  const init = loadOfflineEngine({ sttLang: lang }, false);
  if (!init.ok) return { ok: false, error: init.error === 'offline-pack-missing' ? 'بستهٔ آفلاین نصب نیست' : (init.error || 'offline-unavailable') };
  lastLocalSttAt = Date.now(); /* v0.44 — موتور در حال استفاده است؛ تخلیه نشود */
  offlineBusy = true;
  const t0 = Date.now();
  try {
    const f32 = i16ToF32(Buffer.from(pcm));
    if (f32.length < 1600) return { ok: false, error: 'صدا خیلی کوتاه است' };
    const stream = offlineRec.createStream();
    stream.acceptWaveform({ sampleRate: Number(rate) || 16000, samples: f32 });
    offlineRec.decode(stream);
    const res = offlineRec.getResult(stream);
    const text = String((res && res.text) || '').trim();
    actLog('stt local ok (' + (Date.now() - t0) + 'ms, ' + Math.round(f32.length / 16000) + 's audio)');
    return { ok: !!text, text, offline: true, error: text ? undefined : 'موتور آفلاین متنی برنگرداند — کمی بلندتر حرف بزن' };
  } catch (e) {
    actLog('stt local fail: ' + String(e && e.message).slice(0, 120));
    return { ok: false, error: 'تبدیل آفلاین ناموفق بود — چند لحظه بعد دوباره امتحان کن' };
  } finally {
    offlineBusy = false;
  }
});

/* v0.44 — سبک‌سازی RAM: موتور آفلاین (whisper-base int8) بعد از ۱۰ دقیقه
   بی‌کارِی آزاد می‌شود (~۲۰۰مگابایت). هر تماس stt:local آن را همان‌جا و
   شفاف دوباره می‌سازد؛ حلقهٔ wake-always که پیوسته صدا می‌فرستد هرگز
   نمی‌گذارد تخلیه شود — فقط کاربرانی که wake/handsFree خاموش دارند
   این حافظه را پس می‌گیرند. */
setInterval(() => {
  try {
    if (offlineRec && !offlineBusy && Date.now() - lastLocalSttAt > 10 * 60 * 1000) {
      offlineRec = null;
      actLog('offline engine unloaded (10min idle — RAM freed, reloads on demand)');
    }
  } catch (_) { /* noop */ }
}, 300000).unref();

/* دانلود بستهٔ آفلاین: GitHub (اصلی) → HuggingFace (فایل‌به‌فایل، فالبک) */
const OFFLINE_URLS = {
  archive: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-base.tar.bz2',
  files: 'https://huggingface.co/csukuangfj/sherpa-onnx-whisper-base/resolve/main/',
};

function offlineProgress(win, pct, stage) {
  try { if (win && !win.isDestroyed()) win.webContents.send('stt:local:progress', { pct: Math.round(pct), stage: stage || 'dl' }); } catch (_) { /* noop */ }
}

async function offlineDownloadFile(url, dest, onPct, absFrom, absTo) {
  const r = await cloudFetch(url, { redirect: 'follow', signal: AbortSignal.timeout(1800000) });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url.slice(0, 80));
  const total = Number(r.headers.get('content-length')) || 0;
  const tmp = dest + '.part';
  const ws = fs.createWriteStream(tmp);
  /* v0.38.1 — خطای نوشتن نباید حلقهٔ خواندن را معلق کند */
  let wsErr = null;
  ws.on('error', (e) => { wsErr = e; try { reader.cancel(); } catch (_) { /* noop */ } });
  const reader = r.body.getReader();
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (wsErr) throw wsErr;
    got += value.length;
    ws.write(Buffer.from(value));
    if (total && onPct) onPct(absFrom + (got / total) * (absTo - absFrom));
  }
  await new Promise((res) => ws.end(res));
  fs.renameSync(tmp, dest);
  return got;
}

/* v0.35 — استخراج ناهمگام آرشیو: ریشهٔ واقعی «گاهی اوقات اوا کرش میکنه»
   (اسکرین‌شات: «Not Responding» و دیالوگ بستن ویندوز). spawnSync داخل هندلر
   async، حلقهٔ رویداد پروسهٔ اصلی را تا ۳۰۰ ثانیه به ازای هر فایل قفل می‌کرد؛
   چون v0.34 دانلود بسته را خودکار شروع می‌کند، فریز بی‌دلیل وسط کاربر می‌آمد
   و ویندوز پیشنهاد Close the program می‌داد = همان «کرش». حالا با spawn
   ناهمگام: هیچ فریزی، هیچ Not Responding، دانلود/استخراج همزمان با کار عادی. */
function extractTarFile(archPath, destDir, member) {
  return new Promise((resolve, reject) => {
    let child = null;
    try { child = spawn('tar', ['-xjf', archPath, '-C', destDir, '--strip-components=1', member], { windowsHide: true }); }
    catch (e) { return reject(e); }
    let stderr = '', killed = false;
    const killer = setTimeout(() => { killed = true; try { child.kill(); } catch (_) { /* noop */ } }, 300000);
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (e) => { clearTimeout(killer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(killer);
      if (killed) return reject(new Error('extract timeout: ' + member));
      if (code !== 0) return reject(new Error('extract failed: ' + member + ' ' + String(stderr || '').slice(0, 80)));
      resolve(true);
    });
  });
}

ipcMain.handle('stt:local:download', async (e) => {
  if (offlineDl && offlineDl.on) return { ok: false, error: 'دانلود از قبل در جریان است' };
  if (offlineInstalled()) { const r = loadOfflineEngine(loadedSettings(), true); return { ok: true, already: true, ready: r.ok }; }
  const win = (() => { try { return BrowserWindow.fromWebContents(e.sender); } catch (_) { return null; } })();
  offlineDl = { on: true, pct: 0 };
  const d = offlineDir();
  const archPath = path.join(app.getPath('temp'), 'ava-whisper-base.tar.bz2');
  try {
    fs.mkdirSync(d, { recursive: true });
    actLog('offline pack download started');
    /* مسیر ۱: آرشیو کامل از GitHub */
    try {
      await offlineDownloadFile(OFFLINE_URLS.archive, archPath, (p) => offlineProgress(win, p * 100, 'dl'), 0, 0.85);
      offlineProgress(win, 86, 'extract');
      /* فقط فایل‌های int8 استخراج می‌شوند — v0.35: ناهمگام، بدون قفل کردن پروسهٔ اصلی */
      for (const f of OFFLINE_FILES) {
        await extractTarFile(archPath, d, 'sherpa-onnx-whisper-base/' + f);
        if (!fs.existsSync(path.join(d, f))) throw new Error('extract failed: ' + f);
      }
    } catch (archErr) {
      /* مسیر ۲: فایل‌به‌فایل از HuggingFace */
      actLog('offline pack archive path failed (' + String(archErr && archErr.message).slice(0, 80) + ') — trying HF file-by-file');
      let done = 0;
      for (const f of OFFLINE_FILES) {
        const from = 0.4 + done / OFFLINE_FILES.length * 0.45;
        const to = 0.4 + (done + 1) / OFFLINE_FILES.length * 0.45;
        await offlineDownloadFile(OFFLINE_URLS.files + f, path.join(d, f), (p) => offlineProgress(win, p * 100, 'dl'), from, to);
        done += 1;
      }
    }
    try { fs.unlinkSync(archPath); } catch (_) { /* noop */ }
    if (!offlineInstalled()) throw new Error('files incomplete after download');
    offlineProgress(win, 97, 'load');
    const r = loadOfflineEngine(loadedSettings(), true);
    offlineProgress(win, 100, 'done');
    actLog('offline pack installed + engine ready=' + r.ok);
    return { ok: true, ready: r.ok };
  } catch (err) {
    actLog('offline pack download failed: ' + String(err && err.message).slice(0, 140));
    try { fs.unlinkSync(archPath); } catch (_) { /* noop */ }
    return { ok: false, error: 'دانلود ناموفق بود — اتصال را چک کن و دوباره بزن' };
  } finally {
    offlineDl = { on: false, pct: 0 };
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
    const r = await cloudFetch(trimBase(base) + '/audio/transcriptions', {
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
  /* v0.39 — تست زنده با کلید واقعی نشان داد نسل ۲.۵ برای «کلیدهای جدید» بازنشسته
     شده است (پیام رسمی گوگل: "no longer available to new users … use
     models/gemini-3.5-flash-lite") — یعنی زنجیرهٔ قبلی (flash-latest اول، ۲.۵ آخر)
     برای کاربر تازه‌وارد نصفش مرده بود. ترتیب تازه: نام‌های مستعار همیشه‌سبز
     (نسلِ روز را نشان می‌دهند) → فلاش‌های ۳.۷/۳.۶/۳.۵ → لایت ۳.۱ → و فقط به‌عنوان
     آخرین فالبک ۲.۵ برای کلیدهای قدیمی. مدل‌های واقعاً زنده علاوه بر این‌ها با
     gemDiscoverModels پویا پیدا می‌شوند و اولِ صف می‌نشینند. */
  return [...new Set([
    String(userModel || '').trim(),
    'gemini-flash-lite-latest',
    'gemini-flash-latest',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
  ])].filter(Boolean);
}

/* v0.21 — حافظهٔ مدل کارا: اولین درخواست هر جلسه ممکن است چند مدل را امتحان کند
   (تا جواب بگیرد)، اما بعد از اولین موفقیت، همان مدل در اول زنجیرهٔ دفعات بعد
   قرار می‌گیرد — یعنی «دومین سوال به بعد» همیشه با سریع‌ترین مسیر جواب می‌گیرد. */
let gemWorkingModel = ''; // آخرین مدل کاری چت
let gemSttWorkingModel = ''; // آخرین مدل کاری STT

/* v0.26 — حافظهٔ منفی مدل‌ها: مدلی که ۴۰۴ «پیدا نشد» داد دیگر امتحان نمی‌شود
   (مثلاً مدل اشتباه تایپ‌شدهٔ کاربر مثل gemini-3.5-flash) تا هر درخواست یک
   اسلات اضافه و چند ثانیه هدر ندهد */
const gemBadModels = new Set();
const gemChainPruned = (list) => {
  const kept = list.filter((m) => !gemBadModels.has(String(m)));
  return kept.length ? kept : list.slice(0, 1); /* هرگز زنجیره را خالی نگذار */
};
const gemMarkBad = (m) => {
  try { if (gemBadModels.size < 16) gemBadModels.add(String(m)); } catch (_) { /* noop */ }
};
const gemIsModel404 = (status, msg) =>
  status === 404 || (status === 400 && /not found|not supported|is not a valid model/i.test(String(msg || '')));

/* v0.39 — خودِ گوگل در خطای 404 نامِ مدل جایگزین را می‌گوید:
   "no longer available … Please update your code to use models/gemini-3.5-flash-lite"
   این نام را می‌گیریم و بی‌درنگ اولِ صف می‌گذاریم — یعنی برنامه برای هر
   بازنشستگیِ «آینده» هم خودترمیم است؛ دیگر نیازی به آپدیت زنجیره نیست. */
const gemHintModel = (msg) => {
  const s = String(msg || '');
  /* اول الگوی رسمی: "Please update your code to use models/X" — چون پیام گوگل
     دو بار models/ دارد (اولی خودِ مدلِ مرده!) */
  let m = s.match(/use models\/([a-z0-9][a-z0-9.\-_]+)/i);
  if (!m) {
    const all = [...s.matchAll(/models\/([a-z0-9][a-z0-9.\-_]+)/gi)];
    m = all.length ? all[all.length - 1] : null; /* آخرین اشاره = جایگزین */
  }
  return m ? m[1] : '';
};
/* v0.39 — خطای «location not supported» مدل‌به‌مدل نیست؛ کل مسیر است.
   امتحانِ ۱۰ مدلِ بعدی فقط ۱۰ بار همان خطا را تکرار می‌کند — اولین بار
   حلقه را با پیام رله قطع می‌کنیم. */
const gemIsLocationErr = (status, msg) =>
  /location is not supported|not supported for the API use/i.test(String(msg || ''));

/* v0.32 — پشتیبانی از «فکر نکردن» فقط برای نسل ۲.۵ به بعد؛ نسخهٔ قبل یک regex
   ثابت بود که با آمدن نسل‌های جدید (۳ و بعد) باید هر بار دستی عوض می‌شد.
   حالا از خودِ شمارهٔ نسل در نام مدل خوانده می‌شود — برای هر نسل آینده کار می‌کند. */
const gemSupportsThinking = (mdl) => {
  if (/latest/i.test(String(mdl))) return true; /* نام مستعار همیشه‌سبز = نسل روز */
  const m = String(mdl || '').match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) >= 2.5 : false;
};

/* v0.32 — کشف پویای مدل‌های جمنای (ریشه‌ای‌ترین فیکس زنجیرهٔ مدل):
   درخواست کاربر: «همهٔ مدل‌های زنجیره 404 می‌دهند» — گوگل نسل‌های قدیمی را
   بازنشسته می‌کند (طبق سند رسمی: نسل ۲.۰ از ۲۰۲۶/۰۳/۱۲ خاموش شد) و زنجیرهٔ
   ثابتِ داخل برنامه هر بار با یک آپدیت پیر می‌شود. راه‌حل: خودِ گوگل فهرست
   مدل‌های سالم هر کلید را با ListModels می‌دهد — هر ۳۰ دقیقه یک‌بار می‌پرسیم،
   بهترین‌های فلاش را رتبه می‌زنیم و اول زنجیره می‌گذاریم. از این به بعد هر
   نام/نسلی که گوگل بیاورد (۳.۶، ۳.۵، ۴ و...) بدون آپدیت برنامه پیدا می‌شود.
   حافظهٔ منفی (gemBadModels) هم برای مدل‌هایی که گوگل زنده اعلام‌شان می‌کند
   پاک می‌شود — وگرنه یک 404 گذرا برای همیشه مدل خوب را مسدود می‌کرد. */
const gemDiscoverCache = { at: 0, models: [], all: [], inflight: null, failAt: 0 };
function gemRankModels(names, cap) {
  /* امتیازدهی: فلاش سریع‌تر از پرو → اول؛ نسل جدیدتر → اول؛ نام مستعار
     همیشه‌سبز (latest) بالای همه؛ مدل‌های تصویری/زنده/آزمایشی حذف.
     v0.39 — با cap=8 برای زنجیرهٔ چت؛ بدون cap برای فهرست کاملِ انتخابگر مدل. */
  const uniq = [...new Set((names || []).map((n) => String(n).trim()).filter(Boolean))];
  const usable = uniq.filter((n) =>
    !/embedding|aqa|imagen|veo|tts|image|native-audio|live|banana|robotics|computer-use|(^|[-.])exp([-._]|$)/i.test(n));
  const verOf = (n) => { const m = n.match(/(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; };
  const score = (n) => {
    let s = 0;
    if (/flash/i.test(n)) s += 100;
    if (/latest/i.test(n)) s += 500; /* همیشه‌سبز — هرگز با بازنشستگی نمی‌میرد */
    if (/lite/i.test(n)) s += 25;
    if (/preview/i.test(n)) s -= 20; /* پیش‌نمایش = عمر کوتاه */
    return s + verOf(n) * 10;
  };
  const sorted = usable.sort((a, b) => score(b) - score(a));
  return cap ? sorted.slice(0, cap) : sorted;
}
async function gemDiscoverModels(key, gbase) {
  const now = Date.now();
  if (gemDiscoverCache.models.length && now - gemDiscoverCache.at < 30 * 60 * 1000) return gemDiscoverCache.models;
  /* v0.38.1 — کش منفی: وقتی discovery شکست خورده (فیلترینگ/شبکه)، هر فرمان
     یک تلاش ۹ ثانیه‌ای بیهوده پشت خود نداشته باشد — ۳ دقیقه صبر */
  if (gemDiscoverCache.failAt && now - gemDiscoverCache.failAt < 3 * 60 * 1000) return [];
  if (gemDiscoverCache.inflight) return gemDiscoverCache.inflight;
  gemDiscoverCache.inflight = (async () => {
    try {
      const r = await cloudFetch(
        `${gbase}/v1beta/models?pageSize=200`,
        /* v0.39 — کلید در هدر می‌رود نه کوئری: هر دو فرمت کلید (AIza قدیمی و
           AQ. جدیدِ AI Studio) با هدر x-goog-api-key کار می‌کنند */
        { method: 'GET', headers: { 'x-goog-api-key': String(key || '').trim() }, signal: AbortSignal.timeout(9000) }
      );
      const j = await r.json().catch(() => null);
      if (r.ok && j && Array.isArray(j.models)) {
        const chat = j.models
          .filter((m) => m && m.name && Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map((m) => String(m.name).replace(/^models\//, ''));
        const ranked = gemRankModels(chat, 8);
        if (ranked.length) {
          gemDiscoverCache.at = Date.now();
          gemDiscoverCache.models = ranked;
          gemDiscoverCache.all = gemRankModels(chat, 0); /* v0.39 — فهرست کامل برای انتخابگر مدل */
          gemDiscoverCache.inflight = null; /* انقضای کش باید دوباره بپرسد — Promise قدیمی نچسبد */
          for (const n of ranked) gemBadModels.delete(n); /* 404 گذرا مسدودی دائمی نسازد */
          actLog('gemini discover: ' + ranked.slice(0, 6).join(', ') + (ranked.length > 6 ? ' +' + (ranked.length - 6) : ''));
          return ranked;
        }
        actLog('gemini discover: list ok but no chat-capable model found (' + chat.length + ' raw)');
      } else {
        actLog('gemini discover failed: HTTP ' + r.status + ' ' + String((j && j.error && j.error.message) || '').slice(0, 90));
      }
    } catch (e) {
      actLog('gemini discover error: ' + String((e && e.message) || e).slice(0, 90));
    }
    gemDiscoverCache.failAt = Date.now(); /* v0.38.1 — کش منفی ۳ دقیقه‌ای */
    gemDiscoverCache.inflight = null;
    return [];
  })();
  return gemDiscoverCache.inflight;
}

/* v0.28 — پیام‌های سرور جمنای به فارسیِ قابل‌فهم:
   کاربر گزارش کرد «کلید را ثبت کردم ولی می‌گوید ثبت نشده» — ریشه: خطای
   انگلیسیِ خام سرور (API key not valid / location not supported). حالا
   این خطاها ترجمهٔ روشن دارند؛ جزئیات فنی همچون خودش در activity.log می‌ماند. */
const gemErrHuman = (status, raw) => {
  const s = String(raw || '');
  if (/API_?KEY_?INVALID|API key not valid|Please pass a valid API key/i.test(s)) {
    return 'کلید جمنای معتبر نیست — کلید را کامل و درست وارد کن؛ از aistudio.google.com رایگان می‌شود (با AIza شروع می‌شود)';
  }
  if (/location is not supported|not supported for the API use|user location/i.test(s)) {
    /* v0.39 — راهنمای واقعی به‌جای پیام بی‌خروجی: اپ «آدرس رلهٔ جمنای» دارد؛
       کاربر باید بداند راه‌حل همین است (درخواست از سرور شخصی خودش رد می‌شود) */
    return 'گوگل جمنای را برای موقعیت فعلی سیستم محدود کرده — در تنظیمات › هوش مصنوعی، «آدرس رلهٔ جمنای» را با آدرس رلهٔ شخصی خودت پر کن تا درخواست‌ها از سرور خودت رد شوند؛ تا آن‌هنگاه موتورهای دیگر آوا (خودکار/GLM/بستهٔ آفلاین) جواب می‌دهند';
  }
  if (status === 429 || /quota|RESOURCE_EXHAUSTED|rate limit/i.test(s)) {
    /* v0.38 — پیام محترمانه و راهنما به‌جای «سهمیه تمام شده» */
    return 'سرویس هوش مصنوعی موقتاً شلوغ است یا سهمیهٔ این کلید به سقف مجاز رسیده — چند دقیقه دیگر دوباره تلاش کن یا کلید اختصاصی خودت را در تنظیمات وارد کن.';
  }
  if (status === 403) {
    return 'کلید جمنای به این سرویس اجازهٔ کار نداد — در گوگل کلاود «Generative Language API» را برای همین کلید فعال کن';
  }
  return null;
};

ipcMain.handle('stt:gemini', async (_e, p) => {
  const { buf, key, model, lang, base } = p || {};
  /* v0.29 — رلهٔ اختیاری: اگر گوگل منطقه را محدود کرده باشد، درخواست از پروکسی شخصی کاربر رد می‌شود */
  const gbase = String(base || '').trim().replace(/\/+$/, '') || 'https://generativelanguage.googleapis.com';
  const keys = splitKeys(key);
  if (!keys.length) return { ok: false, error: 'کلید Gemini تنظیم نشده — از تنظیمات › هوش مصنوعی واردش کن' };
  if (!buf || !buf.length) return { ok: false, error: 'صدایی برای تبدیل وجود ندارد' };
  /* v0.47 — B09/B11: کول‌داون ASR — gemini هرگز مسابقه را نمی‌برد؛ در قطعی
     شبکه/سهمیه نباید در هر utterance کل گانگستر را بچرخاند */
  const _nowS = Date.now();
  if (_nowS < gemCooldown.netUntil) return { ok: false, error: gemCooldown.sttReason || 'network-down' };
  if (_nowS < gemCooldown.sttUntil) return { ok: false, error: gemCooldown.sttReason || 'quota-cooling' };
  const b64 = Buffer.from(buf).toString('base64');
  const prompt =
    'Transcribe this audio recording verbatim. ' +
    `The spoken language is ${String(lang || 'fa-IR')} unless it is clearly another language. ` +
    'Return ONLY the transcription text with correct punctuation and Persian spacing (نیم‌فاصله where appropriate). No commentary, no quotes.';
  let lastErr = null;
  let sawNetFail = false; /* v0.26 — اگر همهٔ خطاها شبکه‌ای بود، پیام دقیق‌تر */
  /* v0.21 — مدل کاری اول + کلید خراب → کلید بعدی (نه همهٔ مدل‌ها)
     v0.26 — مدل‌های ۴۰۴شده از حافظهٔ منفی حذف می‌شوند */
  /* v0.32 — اول کشف پویا: هرچه گوگل همین حالا واقعاً برای این کلید دارد */
  const disc = await gemDiscoverModels(keys[0], gbase);
  const baseModels = gemChainPruned([...new Set([gemSttWorkingModel, ...disc, ...geminiModelChain(model)].filter(Boolean))].slice(0, 12));
  /* v0.39 — صف پویا: 404ِ «مدل بازنشسته شده» خودش مدل جایگزین را معرفی می‌کند
     و همان بی‌درنگ اولِ صف می‌نشیند (خودترمیمی برای هر بازنشستگی آینده)؛
     خطای «موقعیت» هم کل مسیر است نه یک مدل → اولین بار حلقه را قطع می‌کند */
  let locBlocked = false;
  for (const k of keys) {
    if (locBlocked) break;
    const queue = baseModels.slice();
    const hinted = new Set();
    let guard = 0;
    while (queue.length && guard++ < 24) {
      const mdl = queue.shift();
      try {
        const body = {
          contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: 'audio/wav', data: b64 } }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 2048 },
        };
        /* v0.32 — thinkingConfig فقط نسل ۲.۵ به بعد — از روی نام مدل خوانده می‌شود */
        if (gemSupportsThinking(mdl)) body.generationConfig.thinkingConfig = { thinkingBudget: 0 };
        const r = await cloudFetch(
          `${gbase}/v1beta/models/${encodeURIComponent(mdl)}:generateContent`,
          { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) } /* v0.21: ۴۵→۱۵ ثانیه */
        );
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          const msg = (j && j.error && (j.error.message || j.error.status)) || `HTTP ${r.status}`;
          lastErr = `Gemini-ASR: ${String(msg).slice(0, 120)}`;
          if (gemIsModel404(r.status, msg)) {
            gemMarkBad(mdl); /* v0.26 */
            const hint = gemHintModel(msg); /* v0.39 — جایگزینِ رسمیِ گوگل، اول صف */
            if (hint && !hinted.has(hint) && !gemBadModels.has(hint)) { hinted.add(hint); gemBadModels.delete(hint); queue.unshift(hint); }
          }
          if (isNetFail(String(msg))) sawNetFail = true;
          /* v0.39 — محدودیت منطقه‌ای = کل مسیر؛ ۱۲ مدلِ بعدی همان خطا را می‌دهند */
          if (gemIsLocationErr(r.status, msg)) { lastErr = 'Gemini-ASR: ' + (gemErrHuman(r.status, msg) || lastErr); locBlocked = true; break; }
          /* v0.39 — 401/403 کلید را دور می‌زند (کلید بعدی)؛ 429 سهمیهٔ «این مدل» است
             → مدل بعدی سهمیهٔ جدا دارد (گزارش کاربر: «اگر یک مدل کار نکرد خودت برو مدل بعدی») */
          if ([401, 403].includes(r.status)) { lastErr = gemErrHuman(r.status, msg) || lastErr; break; }
          if (r.status === 429) { lastErr = gemErrHuman(r.status, msg) || lastErr; continue; }
          const hum = gemErrHuman(r.status, msg);
          if (hum) lastErr = 'Gemini-ASR: ' + hum;
          continue;
        }
        const cand = j && j.candidates && j.candidates[0];
        const text = cand && cand.content && cand.content.parts
          ? cand.content.parts.map((x) => x.text || '').join('').trim()
          : '';
        if (!text) { lastErr = 'Gemini-ASR: پاسخ خالی بود'; continue; }
        gemSttWorkingModel = mdl; /* v0.21 — دفعه بعد اول همین امتحان می‌شود */
        gemCoolClear(); /* v0.47 — B09 */
        return { ok: true, text, model: mdl };
      } catch (e) {
        lastErr = netErr(e); sawNetFail = sawNetFail || isNetFail(String(lastErr));
        /* v0.47 — B11: قطعی آنی شبکه → گانگستر را قطع کن */
        if (isNetFail(String(lastErr))) { gemNetCool(lastErr); break; }
      }
    }
  }
  /* v0.26 — همهٔ شکست‌ها شبکه‌ای بود → در لاگ هم صریح بنویس (تشنخیص آسان) */
  if (sawNetFail) actLog('gemini-asr: all attempts failed at NETWORK level — dns bypass ' + (DNS_BOOT.applied ? 'active' : 'INACTIVE') + ', hosts pinned=' + DNS_BOOT.count);
  if (sawNetFail) gemNetCool(lastErr);
  else { gemCooldown.sttUntil = Date.now() + 60000; gemCooldown.sttReason = lastErr || ''; }
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
    const r = await cloudFetch(url, {
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
        const r = await cloudFetch(url, {
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
   v0.42 — TTS عصبی مایکروسافت اِج — همان موتورِ پروژهٔ متن‌باز
   openai-edge-tts (https://github.com/travisvn/openai-edge-tts)
   ------------------------------------------------------------
   کاربر این پروژه را فرستاد و گفت «اگه خوبه و رایگانه برای صدای
   آوا استفاده کن». آن پروژه یک «سرور پایتون» است؛ راه‌انداختن
   سرور کنار آوا یعنی مصرف رم و سنگینی بیشتر (برخلاف خواستهٔ
   سبک‌سازی). پس «همان موتورِ» آن پروژه — صداهای عصبی رایگان
   Microsoft Edge (fa-IR-DilaraNeural / en-US-AriaNeural) — را
   مستقیم و بدون هیچ سروری اینجا پیاده کردیم؛ همان کیفیت، صفر
   هزینهٔ اضافه. مزیت نسبت به TTS گوگل: هر تکه تا ۳۰۰۰ نویسه در
   «یک» درخواست خوانده می‌شود (جمله وسط راه عوض نمی‌شود) و تلفظ
   فارسی بسیار طبیعی‌تر است. آفلاین → فالبک خودکار به گوگل/ویندوز.
   ============================================================ */
const EDGE_TRUSTED_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const EDGE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/130.0.0.0 Safari/537.36 Edg/130.0.2849.68';
const EDGE_VOICES = { fa: 'fa-IR-DilaraNeural', en: 'en-US-AriaNeural' };
/* v0.43 — صدای مذکر هم اضافه شد تا «تغییر TTS در تنظیمات» واقعاً شنیده شود
   (گزارش کاربر: «TTS رو تغییر میدم ولی هیچی تغییر نمیکنه» — چون فالبک گوگل
   همیشه جای اِج حرف می‌زد، دو موتور یک صدا شنیده می‌شد) */
const EDGE_VOICE_ALT = { fa: 'fa-IR-FaridNeural', en: 'en-US-GuyNeural' };

/* توکن DRM رایگان اِج: SHA-256(تیک‌های ویندوز در واحد ۱۰۰ نانوثانیه،
   رُند به پایین نزدیک‌ترین ۵ دقیقه + توکن ثابت) به حروف بزرگ — همان
   الگوریتم رسمی edge-tts/msedge-tts؛ بدون آن endpoint خطای 403 می‌دهد */
function edgeSecMsGec() {
  let ticks = Math.floor(Date.now() / 1000) + 11644473600;
  ticks -= ticks % 300;
  ticks *= 10000000; /* 100-ns intervals */
  return crypto.createHash('sha256').update(String(ticks) + EDGE_TRUSTED_TOKEN).digest('hex').toUpperCase();
}

const edgeEscaped = (t) =>
  String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/* اِج کل متنِ هر تکه را در «یک» درخواست می‌خواند — سقف تکه ۳۰۰۰ نویسه است
   (قبلاً در مسیر گوگل ۱۹۰ نویسه بود و جمله وسط راه تکه می‌شد) */
function splitEdgeChunks(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const sentences = clean.split(/(?<=[.!?؟。…])\s+/);
  const chunks = [];
  let cur = '';
  const pushCur = () => { if (cur.trim()) chunks.push(cur.trim()); cur = ''; };
  const addPiece = (piece) => {
    piece = piece.trim();
    if (!piece) return;
    if (piece.length > 3000) {
      const words = piece.split(' ');
      for (const w of words) {
        if ((cur + ' ' + w).trim().length > 3000) pushCur();
        cur = (cur ? cur + ' ' : '') + w;
      }
      pushCur();
      return;
    }
    if ((cur + ' ' + piece).trim().length > 3000) pushCur();
    cur = (cur ? cur + ' ' : '') + piece;
  };
  for (const s of sentences) addPiece(s);
  pushCur();
  return chunks.slice(0, 8);
}

/* یک تکه → یک اتصال WebSocket کوتاه به endpoint عصبی اِج → MP3 کامل همان تکه */
function edgeSynthChunk(text, lang, voiceOverride) {
  return new Promise((resolve) => {
    let WebSocketCtor;
    try { WebSocketCtor = require('ws'); } catch (e) { return resolve({ error: 'ws module missing' }); }
    const isEn = String(lang) === 'en';
    /* v0.43 — صدای انتخابی کاربر (dilara=مؤنث پیش‌فرض / farid=مذکر) */
    const voice = String(voiceOverride || '').trim() || EDGE_VOICES[isEn ? 'en' : 'fa'];
    const vLang = /^fa/i.test(voice) ? 'fa-IR' : 'en-US';
    const reqId = crypto.randomBytes(16).toString('hex');
    const ts = new Date().toISOString();
    const url =
      'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1' +
      '?TrustedClientToken=' + EDGE_TRUSTED_TOKEN +
      '&Sec-MS-GEC=' + edgeSecMsGec() +
      '&Sec-MS-GEC-Version=1-130.0.2849.68';
    let ws = null, settled = false;
    const audio = [];
    const done = (res) => {
      if (settled) return;
      settled = true;
      clearTimeout(tmo);
      try { if (ws) ws.close(); } catch (_) { /* noop */ }
      resolve(res);
    };
    const tmo = setTimeout(() => done({ error: 'edge tts: timeout' }), 15000);
    try {
      ws = new WebSocketCtor(url, {
        headers: {
          Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
          'User-Agent': EDGE_UA,
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': 'fa,en;q=0.8',
        },
        handshakeTimeout: 8000,
      });
    } catch (e) { return done({ error: netErr(e) }); }
    ws.on('open', () => {
      try {
        const cfg =
          'X-Timestamp:' + ts + '\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n' +
          '{"context":{"synthesis":{"audio":{"metadataoptions":' +
          '{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},' +
          '"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}';
        ws.send(cfg);
        const ssml =
          "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='" +
          vLang + "'><voice name='" + voice +
          "'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>" + edgeEscaped(text) + '</prosody></voice></speak>';
        ws.send('X-RequestId:' + reqId + '\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:' + ts + 'Z\r\nPath:ssml\r\n\r\n' + ssml);
      } catch (e) { done({ error: netErr(e) }); }
    });
    ws.on('message', (data, isBinary) => {
      if (settled) return;
      try {
        if (isBinary) {
          const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
          if (buf.length <= 2) return;
          /* فرمت فریم باینری اِج: ۲ بایت اول = طول هدر (big-endian)، بعد هدر، بعد MP3 خام */
          const hlen = buf.readUInt16BE(0);
          if (2 + hlen < buf.length) audio.push(buf.subarray(2 + hlen));
        } else if (String(data).includes('Path:turn.end')) {
          done(audio.length ? { ok: true, buffer: Buffer.concat(audio) } : { error: 'edge: بدون صدا' });
        }
      } catch (_) { /* noop */ }
    });
    ws.on('error', (e) => done({ error: netErr(e) }));
    ws.on('close', () => done(audio.length ? { ok: true, buffer: Buffer.concat(audio) } : { error: 'edge: اتصال بدون صدا بسته شد' }));
  });
}

/* قطع‌کنٔ مدار (v0.42) — اگر endpoint اِج برای IP کاربر بسته باشد (برخی
   شبکه‌ها/کشورها)، دو شکست پیاپی اِج را ۱۰ دقیقه از جاده خارج می‌کند تا
   هر فرمان ۱۵ ثانیه معطل نشود؛ فالبک گوگل/ویندوز بی‌درنگ جایگزین می‌شود */
const edgeHealth = { fails: 0, until: 0 };

ipcMain.handle('tts:edge', async (_e, p) => {
  const { text, lang, voice, probe } = p || {};
  /* v0.47 — B12: کول‌داون ۱۰ دقیقه‌ای → ۹۰ ثانیه (لاگ کاربر: «چرا صدا تغییر نمیکنه
     پس» — تغییر صدا وسط کول‌داون هیچ تغییری شنیدنی نمی‌داد و هیچ بازخوردی نبود)
     + probe=true (تغییر صدا/موتور در تنظیمات) یک‌بار از کول‌داون می‌گذرد */
  if (!probe && Date.now() < edgeHealth.until) return { ok: false, error: 'edge cooling down', cooling: true };
  const chunks = splitEdgeChunks(String(text || '').slice(0, 24000));
  if (!chunks.length) return { ok: false, error: 'متنی برای خواندن نیست' };
  try {
    /* تکه‌ها موازی (هر تکه یک اتصال کوتاه) — ترتیب حفظ می‌شود */
    const res = await Promise.all(chunks.map((c) => edgeSynthChunk(c, lang, voice)));
    const parts = [];
    for (const r of res) {
      if (!(r && r.ok)) {
        edgeHealth.fails++;
        if (edgeHealth.fails >= 2) { edgeHealth.until = Date.now() + 90 * 1000; edgeHealth.fails = 0; } /* v0.47 B12: ۱۰دقیقه→۹۰ثانیه */
        return { ok: false, error: String((r && r.error) || 'edge tts failed').slice(0, 160) };
      }
      parts.push(r.buffer);
    }
    if (!parts.length) return { ok: false, error: 'صدایی از اِج نرسید' };
    edgeHealth.fails = 0; edgeHealth.until = 0;
    return { ok: true, mime: 'audio/mpeg', chunks: parts.map((b) => b.toString('base64')) };
  } catch (e) {
    return { ok: false, error: netErr(e) };
  }
});

/* ============================================================
   v0.43 — مدیای ویندوز: «ویدیویی که همین حالا پخش می‌شود»، پخش‌کنندهٔ
   یوتیوب داخل خود آوا، و سیستم کنترل حرفه‌ای پلیرها
   ------------------------------------------------------------
   درخواست‌های کاربر:
   • «کاربر خودش کپی نکنه؛ اگه ویدیویی در حال پلی بود همونو بیار — توی هر
     مرورگری» → SMTC ویندوز (System Media Transport Controls) — همهٔ
     مرورگرها/پلیرها وضعیت پخش خود را آنجا اعلام می‌کنند.
   • «با نرم‌افزار ما نمیشه دید؛ میگه برو توی خودت یوتیوب ببین» → پنجرهٔ
     Watch واقعی آوا (صفحهٔ کامل یوتیوب، نه iframe امبدِ «Watch on YouTube»).
   • «سیستم کنترل خیلی قوی برای همهٔ video player های معروف با هر کامندی»
     → کنترل مستقیم VLC (HTTP API) و mpv (IPC pipe) + کلیدهای مدیای جهانی
     + کلیدهای جلو/عقب روی پنجرهٔ فعال + پخش یوتیوب داخل خود پلیرها.
   ============================================================ */

/* ---------- ۱) وضعیت پخش سیستم (SMTC) ---------- */
let smtcFile = null;
function smtcScriptFile() {
  if (smtcFile) return smtcFile;
  try {
    const ps = [
      "$ErrorActionPreference = 'SilentlyContinue'",
      "Add-Type -AssemblyName System.Runtime.WindowsRuntime",
      "$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]",
      "$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]",
      "function Await($op, $t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(-1) | Out-Null; return $task.Result }",
      "$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])",
      "$rows = @()",
      "foreach ($s in $mgr.GetSessions()) {",
      "  try {",
      "    $mp = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])",
      "    $rows += [PSCustomObject]@{ app = [string]$s.SourceAppUserModelId; title = [string]$mp.Title; artist = [string]$mp.Artist; status = [string]$s.GetPlaybackInfo().PlaybackStatus }",
      "  } catch {}",
      "}",
      "$rows | ConvertTo-Json -Compress",
    ].join('\r\n');
    smtcFile = path.join(os.tmpdir(), 'ava-smtc.ps1');
    fs.writeFileSync(smtcFile, ps, 'utf8');
  } catch (_) { smtcFile = null; }
  return smtcFile;
}
/* انتخاب جلسهٔ در حال پخش — مرورگرها اولویت دارند (خواستهٔ کاربر: یوتیوب در
   هر مرورگری) */
const SMTC_BROWSER_RE = /chrome|msedge|edge|firefox|brave|opera|vivaldi|youtube|ytdl|potplayer|vlc|mpv/i;
function parseSmtcOutput(stdout) {
  let rows = [];
  try {
    const j = JSON.parse(String(stdout || '').trim() || '[]');
    rows = Array.isArray(j) ? j : [j];
  } catch (_) { return null; }
  rows = rows.filter((r) => r && (r.title || r.artist));
  if (!rows.length) return null;
  const playing = rows.filter((r) => /playing/i.test(String(r.status || '')));
  const pool = playing.length ? playing : rows;
  pool.sort((a, b) => {
    const ab = SMTC_BROWSER_RE.test(String(a.app || '')) ? 0 : 1;
    const bb = SMTC_BROWSER_RE.test(String(b.app || '')) ? 0 : 1;
    return ab - bb;
  });
  const s = pool[0];
  let app = String(s.app || '');
  /* نام کوتاه و خوانا: UWP (Microsoft.ZuneMusic_8wekyb3d8bbwe!X) و مسیر .exe */
  app = app.split('!')[0];
  app = app.replace(/\.exe$/i, '');
  app = app.replace(/_[0-9a-z]{8,13}$/i, '');
  app = app.split(/[\\/.]/).pop() || app;
  return { ok: true, title: String(s.title || ''), artist: String(s.artist || ''), app, playing: playing.length > 0 };
}
function smtcNowPlaying() {
  return new Promise((resolve) => {
    const f = smtcScriptFile();
    if (!f) return resolve({ ok: false, error: 'اسکریپت SMTC ساخته نشد' });
    exec(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${f}"`,
      { windowsHide: true, timeout: 9000, maxBuffer: 1024 * 512 },
      (err, stdout) => {
        if (err || !stdout) return resolve({ ok: false, error: 'هیچ منبع پخشی فعال نیست' });
        const parsed = parseSmtcOutput(stdout);
        resolve(parsed || { ok: false, error: 'هیچ منبع پخشی فعال نیست' });
      }
    );
  });
}
ipcMain.handle('media:now', () => smtcNowPlaying());

/* ---------- ۲) حل عبارت → ویدیوی یوتیوب ---------- */
async function ytResolve(query) {
  const q = String(query || '').trim();
  if (!q) return { ok: false, error: 'عبارت خالی است' };
  try {
    const r = await cloudFetch(
      'https://www.youtube.com/results?search_query=' + encodeURIComponent(q.slice(0, 120)),
      { headers: { 'User-Agent': CHROME_UA, 'Accept-Language': 'fa,en;q=0.8' }, signal: AbortSignal.timeout(9000) }
    );
    const html = await r.text();
    const m = html.match(/"videoId":"([A-Za-z0-9_-]{11})"/);
    if (!m) return { ok: false, error: 'ویدیویی پیدا نشد' };
    let title = '';
    const tm = html.slice(m.index).match(/"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/);
    if (tm) { try { title = JSON.parse('"' + tm[1] + '"'); } catch (_) { title = tm[1]; } }
    return { ok: true, videoId: m[1], title: String(title).slice(0, 140) };
  } catch (e) {
    return { ok: false, error: netErr(e) };
  }
}
ipcMain.handle('yt:resolve', (_e, p) => ytResolve(p && p.query));

/* ---------- ۳) نرمال‌سازی لینک یوتیوب (v0.61 — پنجرهٔ پخش خود آوا حذف شد) ----------
   پلیرِ خودساختهٔ آوا (پنجرهٔ یوتیوب + پنجرهٔ شناور PiP) برچیده شد؛ ویدیو با
   «پلیر پیش‌فرضِ کاربر» پخش می‌شود (player:open v2 پایین). این تابع فقط
   لینک را تمیز می‌کند تا به پلیر/مرورگر داده شود. */
function ytNormalizeUrl(raw) {
  let u = String(raw || '').trim();
  if (!u) return null;
  const idm = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/))([A-Za-z0-9_-]{11})/);
  if (idm) {
    let extra = '';
    try { const q = new URL(u); const t = q.searchParams.get('t') || q.searchParams.get('start'); if (t) extra = '&t=' + encodeURIComponent(t); } catch (_) { /* noop */ }
    return 'https://www.youtube.com/watch?v=' + idm[1] + '&autoplay=1' + extra;
  }
  return /^https?:\/\/([a-z0-9-]+\.)*youtube\.com\//i.test(u) ? u : null;
}

/* ---------- ۴) اسکن پلیرهای نصب‌شده (v0.61 — + KMPlayer + پلیر پیش‌فرض) ---------- */
const PF = () => process.env.ProgramFiles || 'C:\\Program Files';
const PF86 = () => process.env['ProgramFiles(x86)'] || PF();
const PLAYER_DEFS = [
  { id: 'vlc', fa: 'وی‌ال‌سی', paths: ['VideoLAN/VLC/vlc.exe'] },
  { id: 'mpv', fa: 'mpv', paths: ['mpv/mpv.exe', 'mpv.net/mpv.exe'] },
  { id: 'potplayer', fa: 'پت‌پلیر', paths: ['DAUM/PotPlayer/PotPlayerMini64.exe', 'DAUM/PotPlayer/PotPlayerMini.exe', 'DAUM/PotPlayer64/PotPlayerMini64.exe'] },
  { id: 'kmplayer', fa: 'کی‌ام‌پلیر', paths: ['KMPlayer/KMPlayer64.exe', 'KMPlayer/KMPlayer.exe', 'KMP/KMPlayer.exe', 'KMPlayer64/KMPlayer64.exe'] },
  { id: 'mpc', fa: 'ام‌پی‌سی', paths: ['MPC-HC/mpc-hc64.exe', 'MPC-HC/mpc-hc.exe', 'MPC-BE/mpc-be64.exe'] },
  { id: 'wmplayer', fa: 'ویندوز مدیا پلیر', paths: ['Windows Media Player/wmplayer.exe'] },
];
let playerScanCache = { at: 0, list: null, ytdl: false };
function execWhere(name) {
  return new Promise((resolve) => {
    exec(`where ${name}`, { windowsHide: true, timeout: 4000 }, (err, stdout) => {
      if (err || !stdout) return resolve('');
      const first = String(stdout).split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0] || '';
      resolve(first);
    });
  });
}
async function playersScan(force = false) {
  if (!force && playerScanCache.list && Date.now() - playerScanCache.at < 10 * 60 * 1000) return playerScanCache;
  const list = [];
  for (const d of PLAYER_DEFS) {
    let exe = '';
    for (const rel of d.paths) {
      const cand = path.join(PF(), rel);
      if (fs.existsSync(cand)) { exe = cand; break; }
      const cand86 = path.join(PF86(), rel);
      if (fs.existsSync(cand86)) { exe = cand86; break; }
    }
    if (!exe && d.id === 'mpv') exe = await execWhere('mpv.exe');
    if (exe) list.push({ id: d.id, fa: d.fa, exe });
  }
  const ytdl = await execWhere('yt-dlp');
  playerScanCache = { at: Date.now(), list, ytdl };
  return playerScanCache;
}
ipcMain.handle('player:scan', () => playersScan());

/* ---------- ۴ب) پلیر ویدیوی «پیش‌فرض» کاربر (v0.61) ----------
   خواستهٔ صریح کاربر: «آوا ببینه ویدیو پلیر پیش‌فرض کاربر چیه، با همون پلی کنه».
   ویندوز انتخاب پیش‌فرض را در رجیستری FileExts\.ext\UserChoice\ProgId نگه
   می‌دارد؛ ما ProgId را برای mp4/mkv/avi می‌خوانیم و به شناسهٔ پلیر وصل
   می‌کنیم (تفسیر ProgId در playerProgIdToId — تابع خالص، تست‌پذیر). */
function playerProgIdToId(progId) {
  const s = String(progId || '');
  if (!s) return '';
  if (/vlc/i.test(s)) return 'vlc';
  if (/potplayer/i.test(s)) return 'potplayer';
  if (/kmplayer/i.test(s)) return 'kmplayer';
  if (/mpv/i.test(s)) return 'mpv';
  if (/mpc|mediaplayerclassic/i.test(s)) return 'mpc';
  if (/wmplayer|windows\.media\.|wmp/i.test(s)) return 'wmplayer';
  if (/^appx?/i.test(s)) return 'uwp'; /* Media Player / Films&TV مایکروسافت */
  return '';
}
let defaultPlayerCache = { at: 0, id: '', progId: '' };
function defaultVideoPlayer(force = false) {
  if (!force && defaultPlayerCache.id && Date.now() - defaultPlayerCache.at < 10 * 60 * 1000) return defaultPlayerCache;
  return new Promise((resolve) => {
    const ps = 'powershell -NoProfile -Command "'
      + '$out=@(); '
      + 'foreach($ext in \'.mp4\',\'.mkv\',\'.avi\'){ '
      + '$k=\"HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\\' + $ext + \'\\UserChoice\"; '
      + 'try{ $p=(Get-ItemProperty -Path $k -ErrorAction Stop).ProgId; if($p){ $out += ($ext + \'=\' + $p) } }catch{} }; '
      + 'Write-Output ($out -join \';\')"';
    exec(ps, { windowsHide: true, timeout: 6000 }, (err, stdout) => {
      let id = '', progId = '';
      if (!err && stdout) {
        for (const pair of String(stdout).trim().split(';')) {
          const ix = pair.indexOf('=');
          if (ix <= 0) continue;
          const pg = pair.slice(ix + 1).trim();
          const mapped = playerProgIdToId(pg);
          if (mapped) { id = mapped; progId = pg; break; }
        }
      }
      defaultPlayerCache = { at: Date.now(), id, progId };
      resolve(defaultPlayerCache);
    });
  });
}
ipcMain.handle('player:default', () => defaultVideoPlayer());

/* پلیرهایی که لینک یوتیوب را خودشان می‌فهمند یا با yt-dlp استریم می‌شود */
const STREAM_NATIVE = new Set(['potplayer', 'kmplayer']);
const STREAM_YTDLP = new Set(['vlc', 'mpv']);
/* تصمیمِ «چه چیزی با چه پلیری باز شود» — تابع خالص v0.61 برای تست بدون ویندوز */
function playerOpenDecision(kind, src, wanted, scan, def) {
  const isUrl = /^https?:\/\//i.test(String(src || ''));
  const isYt = isUrl && /youtube\.com|youtu\.be/i.test(src);
  const isFile = kind === 'file' || (!isUrl && !!src);
  if (wanted && wanted !== 'default' && !scan.list.some((x) => x.id === wanted)) {
    /* پلیر خواسته‌شده نصب نیست */
    const alt = (scan.list.find((x) => x.id !== 'wmplayer') || scan.list[0] || {}).id || '';
    if (!alt) return { action: 'fail', error: 'هیچ پلیری (VLC/KMPlayer/PotPlayer/mpv/MPC) روی سیستم نصب نیست' };
    return { action: 'substitute', player: alt, wanted };
  }
  let player = wanted;
  if (!player || player === 'default') {
    const defId = (def && def.id) || '';
    if (defId === 'uwp') {
      /* Media Player/Films&TV مایکروسافت: فایل محلی را خود OS با آن باز می‌کند؛
         لینک یوتیوب را نمی‌فهمد → مرورگر */
      return { action: isYt ? 'browser' : 'os-default', player: 'uwp' };
    }
    if (defId && scan.list.some((x) => x.id === defId)) player = defId;
    else player = (scan.list.find((x) => x.id !== 'wmplayer') || scan.list[0] || {}).id || '';
    if (!player) {
      /* هیچ پلیر دسکتاپی: فایل محلی را OS باز می‌کند؛ لینک → مرورگر */
      return { action: isYt ? 'browser' : 'os-default', player: '' };
    }
  }
  if (isYt) {
    if (STREAM_NATIVE.has(player)) return { action: 'spawn', player };
    if (STREAM_YTDLP.has(player)) {
      return scan.ytdl ? { action: 'spawn-ytdlp', player } : { action: 'no-ytdlp', player };
    }
    return { action: 'browser', player };
  }
  if (isFile) return { action: 'spawn', player };
  return { action: 'spawn', player }; /* هر منبع دیگری (لینک مستقیم ویدیو و…) */
}
/* باز کردن لینک ویدیو (یوتیوب یا مستقیم) با پلیر پیش‌فرض کاربر —
   مستقل از IPC تا youtube_play/sys-run هم از همین یک مسیر برود */
async function openWithDefaultPlayer(url) {
  try {
    const scan = await playersScan();
    const def = await defaultVideoPlayer();
    const d = playerOpenDecision('url', String(url || ''), 'default', scan, def);
    if (d.action === 'browser') { try { shell.openExternal(url); return { ok: true, via: 'browser' }; } catch (_) { return { ok: false }; } }
    if (d.action === 'os-default') { try { shell.openExternal(url); return { ok: true, via: 'browser' }; } catch (_) { return { ok: false }; } }
    if (d.action === 'no-ytdlp') return { ok: false, noYtdl: true, player: d.player };
    if (d.action === 'spawn' || d.action === 'spawn-ytdlp') {
      return playerLaunch(d.player, url, { ytdl: d.action === 'spawn-ytdlp' });
    }
    return { ok: false, error: d.error || 'پخش ممکن نشد' };
  } catch (e) { return { ok: false, error: netErr(e) }; }
}

/* ---------- ۵) کنترل پلیرها ---------- */
const playerCtl = { player: null, vlcPort: 0, vlcPass: '', vlcBase: '', mpvPipe: '\\\\.\\pipe\\ava-mpv', ytUrl: '', exe: '' };
function vlcHttp(command) {
  const url = `${playerCtl.vlcBase}/requests/status.xml?command=${command}`;
  const auth = Buffer.from(':' + playerCtl.vlcPass).toString('base64');
  return cloudFetch(url, { headers: { Authorization: 'Basic ' + auth }, signal: AbortSignal.timeout(1500) })
    .then((r) => r.ok).catch(() => false);
}
function vlcSeek(delta) {
  return cloudFetch('requests/status.xml', {}).then(async (r) => {
    let cur = 0;
    try {
      const txt = await r.text();
      const m = txt.match(/<time>(\d+)<\/time>/);
      if (m) cur = parseInt(m[1], 10) || 0;
    } catch (_) { /* noop */ }
    return vlcHttp('seek&val=' + Math.max(0, cur + delta));
  }).catch(() => false);
}
function mpvSend(cmdObj) {
  return new Promise((resolve) => {
    try {
      const sock = net.connect(playerCtl.mpvPipe);
      let settled = false;
      const fin = (v) => { if (!settled) { settled = true; try { sock.destroy(); } catch (_) { /* noop */ } resolve(v); } };
      sock.on('connect', () => {
        try { sock.write(JSON.stringify(cmdObj) + '\n'); } catch (_) { return fin(false); }
        setTimeout(() => fin(true), 350);
      });
      sock.on('error', () => fin(false));
      setTimeout(() => fin(false), 1800);
    } catch (_) { resolve(false); }
  });
}
/* کلیدهای مدیای جهانی — برای هر پلیر/مرورگری که زیر کنترل مستقیم نیست */
const MEDIA_KEYS = { play_pause: 'B3', next: 'B0', prev: 'B1', stop: 'B2' }; /* v0.61 — stop اصلاح شد: VK_MEDIA_STOP=0xB2 */
const VK = { left: 0x25, right: 0x27, up: 0x26, down: 0x28, esc: 0x1B, f: 0x46, f11: 0x7A };
function fgKeys(seq) {
  /* کلیدها به «پنجرهٔ فعال» می‌روند — کاربر پلیر را جلوی چشمش دارد */
  const body = seq.map((k) => `[W.N]::keybd_event(${k},0,0,0); [W.N]::keybd_event(${k},0,2,0);`).join(' ');
  return exec(
    `powershell -NoProfile -Command "Add-Type -Namespace W -Name N -MemberDefinition '[DllImport(\\"user32.dll\\")] public static extern void keybd_event(byte vk, byte sc, uint fl, uint ex);'; ${body}"`,
    { windowsHide: true, timeout: 6000 },
    () => {}
  );
}
ipcMain.handle('player:ctl', async (_e, p) => {
  const a = p && p.action ? String(p.action) : '';
  if (!a) return { ok: false, error: 'اقدام نامشخص' };
  /* ۱) VLC زیر کنترل آوا */
  if (playerCtl.player === 'vlc' && playerCtl.vlcBase) {
    const map = {
      play_pause: 'pl_pause', next: 'pl_next', prev: 'pl_previous', stop: 'pl_stop', fullscreen: 'fullscreen',
    };
    if (map[a]) { const ok = await vlcHttp(map[a]); if (ok) return { ok: true, via: 'vlc-http' }; }
    if (a === 'seek') { const ok = await vlcSeek(Math.round(Number(p.arg) || 10)); if (ok) return { ok: true, via: 'vlc-http' }; }
    if (a === 'volume_up') { const ok = await vlcHttp('volume&val=+25'); if (ok) return { ok: true, via: 'vlc-http' }; }
    if (a === 'volume_down') { const ok = await vlcHttp('volume&val=-25'); if (ok) return { ok: true, via: 'vlc-http' }; }
  }
  /* ۲) mpv زیر کنترل آوا */
  if (playerCtl.player === 'mpv') {
    const mpvMap = {
      play_pause: { command: ['cycle', 'pause'] },
      next: { command: ['playlist-next'] },
      prev: { command: ['playlist-prev'] },
      stop: { command: ['stop'] },
      fullscreen: { command: ['cycle', 'fullscreen'] },
      close: { command: ['quit'] },
      seek: { command: ['seek', Number(p.arg) || 10, 'relative'] },
      volume_up: { command: ['add', 'volume', 5] },
      volume_down: { command: ['add', 'volume', -5] },
    };
    if (mpvMap[a]) { const ok = await mpvSend(mpvMap[a]); if (ok) { if (a === 'close') playerCtl.player = null; return { ok: true, via: 'mpv-ipc' }; } }
  }
  /* ۳) کلیدهای مدیای جهانی / کلیدهای پنجرهٔ فعال */
  if (MEDIA_KEYS[a]) { fgKeys([`0x${MEDIA_KEYS[a]}`]); return { ok: true, via: 'media-keys' }; }
  if (a === 'seek') {
    /* هر فشار فلش ≈ ۵ ثانیه در بیشتر پلیرها — تا ۸ فشار در یک سیشل */
    const d = Math.round(Number(p.arg) || 10);
    const n = Math.max(1, Math.min(8, Math.round(Math.abs(d) / 5)));
    fgKeys(Array.from({ length: n }, () => (d > 0 ? VK.right : VK.left)));
    return { ok: true, via: 'fg-keys' };
  }
  if (a === 'fullscreen') { fgKeys([VK.f11, VK.f]); return { ok: true, via: 'fg-keys' }; }
  if (a === 'volume_up') { fgKeys(['0xAF']); return { ok: true, via: 'media-keys' }; }
  if (a === 'volume_down') { fgKeys(['0xAE']); return { ok: true, via: 'media-keys' }; }
  if (a === 'play_pause') { fgKeys([`0x${MEDIA_KEYS.play_pause}`]); return { ok: true, via: 'media-keys' }; }
  if (a === 'stop') { fgKeys([`0x${MEDIA_KEYS.stop}`]); return { ok: true, via: 'media-keys' }; }
  if (a === 'close') {
    if (playerCtl.exe) {
      const nm = path.basename(playerCtl.exe);
      exec(`taskkill /IM "${nm}" /F`, { windowsHide: true, timeout: 5000 }, () => {});
      playerCtl.player = null;
      return { ok: true, via: 'taskkill' };
    }
    return { ok: false, error: 'پلیری زیر کنترل آوا باز نیست' };
  }
  return { ok: false, error: 'این اقدام برای پلیر فعلی ممکن نیست' };
});

/* ---------- ۶) باز کردن در پلیر (حتی یوتیوب) ---------- */
/* اجرای واقعی پلیر با منبع (v0.61 — از player:open و openWithDefaultPlayer
   هر دو همین یک مسیر می‌روند تا رفتارها هیچ‌وقت از هم جدا نیفتند) */
async function playerLaunch(player, src, opts) {
  const scan = await playersScan();
  const entry = scan.list.find((x) => x.id === player);
  if (!entry || !entry.exe) return { ok: false, player, error: 'پلیر پیدا نشد' };
  let feed = String(src || '');
  const isYt = /youtube\.com|youtu\.be/i.test(feed);
  /* یوتیوب در VLC/mpv → استریم مستقیم با yt-dlp (PotPlayer/KMPlayer خودشان یوتیوب را می‌فهمند) */
  if (isYt && opts && opts.ytdl) {
    try {
      const g = await new Promise((resolve) => {
        exec(`yt-dlp -f "best" -g --no-warnings "${feed}"`, { windowsHide: true, timeout: 25000 }, (err, stdout) => {
          if (err || !stdout) return resolve('');
          resolve(String(stdout).split(/\r?\n/).filter(Boolean)[0] || '');
        });
      });
      if (!g) return { ok: false, player, error: 'استریم یوتیوب استخراج نشد (yt-dlp قدیمی است؟) — بگو «با پت‌پلیر پخش کن»' };
      feed = g;
    } catch (_) { return { ok: false, player, error: 'استریم یوتیوب استخراج نشد' }; }
  }
  try {
    if (player === 'vlc') {
      const port = 8907 + Math.floor(Math.random() * 80);
      const pass = crypto.randomBytes(8).toString('hex');
      spawn(entry.exe, ['--extraintf', 'http', '--http-host', '127.0.0.1', '--http-port', String(port), '--http-password', pass, '--no-video-title-show', feed], { detached: true, stdio: 'ignore' }).unref();
      playerCtl.player = 'vlc'; playerCtl.vlcPort = port; playerCtl.vlcPass = pass; playerCtl.vlcBase = `http://127.0.0.1:${port}`; playerCtl.exe = entry.exe;
      await new Promise((r) => setTimeout(r, 900)); /* فرصت بالا آمدن رابط HTTP */
      return { ok: true, player, fa: entry.fa, controlled: true };
    }
    if (player === 'mpv') {
      spawn(entry.exe, ['--input-ipc-server=' + playerCtl.mpvPipe, '--force-window=yes', feed], { detached: true, stdio: 'ignore' }).unref();
      playerCtl.player = 'mpv'; playerCtl.exe = entry.exe;
      return { ok: true, player, fa: entry.fa, controlled: true };
    }
    spawn(entry.exe, [feed], { detached: true, stdio: 'ignore' }).unref();
    playerCtl.player = player; playerCtl.exe = entry.exe; playerCtl.vlcBase = '';
    return { ok: true, player, fa: entry.fa, controlled: false };
  } catch (e) {
    return { ok: false, error: netErr(e) };
  }
}

ipcMain.handle('player:open', async (_e, p) => {
  const q = p || {};
  const scan = await playersScan();
  const wanted = String(q.player || 'default').toLowerCase();
  /* منبع: عبارت یوتیوب → حل ویدیو؛ لینک → نرمال؛ فایل محلی → همان */
  let src = String(q.src || '').trim();
  if (q.kind === 'query' && src) {
    const res = await ytResolve(src);
    if (!res.ok) return { ok: false, error: res.error };
    src = 'https://www.youtube.com/watch?v=' + res.videoId;
    playerCtl.ytUrl = src;
  } else {
    const n = ytNormalizeUrl(src);
    playerCtl.ytUrl = n || '';
    src = n || src;
  }
  /* v0.61 — تصمیم واحد برای همهٔ حالت‌ها (پلیر صریح، «پلیر پیش‌فرض»، فایل محلی) */
  const def = wanted === 'default' ? await defaultVideoPlayer() : null;
  const d = playerOpenDecision(q.kind || 'url', src, wanted, scan, def);
  if (d.action === 'fail') return { ok: false, error: d.error };
  const player = (d.action === 'substitute') ? d.player
    : (d.player || wanted);
  const entry = scan.list.find((x) => x.id === player);
  if (d.action === 'browser') {
    /* پلیر پیش‌فرض/خواسته‌شده یوتیوب را نمی‌فهمد → همان ویدیو در مرورگر */
    try { shell.openExternal(src); } catch (_) { /* noop */ }
    return { ok: true, via: 'browser', player, fa: (entry && entry.fa) || 'مرورگر' };
  }
  if (d.action === 'os-default') {
    /* فایل محلی با انتخاب خود ویندوز (همان پلیر پیش‌فرض کاربر) باز می‌شود */
    try { await shell.openPath(src); } catch (_) { /* noop */ }
    return { ok: true, via: 'os-default', player: 'uwp', fa: 'پلیر پیش‌فرض ویندوز' };
  }
  if (d.action === 'no-ytdlp') {
    return { ok: false, noYtdl: true, player, error: 'برای پخش یوتیوب در ' + ((entry && entry.fa) || player) + ' باید yt-dlp روی سیستم نصب باشد' };
  }
  if (d.action === 'spawn' || d.action === 'spawn-ytdlp') {
    return playerLaunch(player, src, { ytdl: d.action === 'spawn-ytdlp' });
  }
  return { ok: false, error: 'پخش ممکن نشد' };
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

/* v0.47 — B09/B11: کش منفی ۴۲۹/شبکه + breaker سراسری
   لاگ کاربر: در ۵ دقیقه ۵ بار کل گانگسترِ ۱۱مدل×کلید چرخید و هر بار «سرویس شلوغ» —
   و ۶ خط «fetch failed» در ۱۰ms. حالا: شکست کاملِ ۴۲۹ → ۹۰ ثانیه، شکست کامل شبکه
   → ۴۵ ثانیه، برنده/موفقیت → پاک شدن. درخواستِ داخل کول‌داون بلافاصله همان خطای
   انسانی را برمی‌گرداند بدون هیچ درخواست شبکه‌ای. */
const gemCooldown = { chatUntil: 0, chatReason: '', sttUntil: 0, sttReason: '', netUntil: 0 };
const gemCoolClear = () => { gemCooldown.chatUntil = 0; gemCooldown.chatReason = ''; gemCooldown.sttUntil = 0; gemCooldown.sttReason = ''; gemCooldown.netUntil = 0; };
const gemNetCool = (reason) => {
  gemCooldown.netUntil = Date.now() + 45000;
  if (reason) { gemCooldown.chatReason = reason; gemCooldown.sttReason = reason; }
};

/* v0.18 — سوال‌هایی که واقعاً به جستجوی زنده نیاز دارند (گران‌ترین و کندترین مسیر) */
const SEARCH_INTENT_RE = new RegExp(
  '(سرچ|جستجو|جستجو کن|گوگل کن|اخبار|خبر|قیمت|نرخ|دلار|تومان|ارز|بورس|ارز دیجیتال|بیت کوین|تتر|آب و هوا|هواشناسی|دموا|برفی|بارون|امروز|فردا|الان|چه خبر|جدیدترین|آخرین|نتایج|نتیجه|مسابقه|امتیاز|لیگ|هفته|[؛؟?]\\s*(کی|کجاست|چند|چقدر)|who won|latest news|price of|weather|today|current|score)',
  'i'
);

ipcMain.handle('ai:gemini', async (_e, p) => {
  const { key, model, messages, search, base } = p || {};
  /* v0.29 — رلهٔ اختیاری (سرور شخصی کاربر) برای دور زدن محدودیت سرزمینی گوگل */
  const gbase = String(base || '').trim().replace(/\/+$/, '') || 'https://generativelanguage.googleapis.com';
  const keys = splitKeys(key);
  if (!keys.length) return { ok: false, error: 'کلید Gemini تنظیم نشده' };
  if (!Array.isArray(messages) || !messages.length) return { ok: false, error: 'پیام خالی است' };
  /* v0.47 — B09: کول‌داون ۴۲۹/سهمیه — بدون این، هر درخواست دوباره ۱۱مدل را می‌چرخاند */
  const _nowC = Date.now();
  if (_nowC < gemCooldown.netUntil) return { ok: false, error: gemCooldown.chatReason || 'شبکه در دسترس نیست — چند لحظه بعد دوباره امتحان کن' };
  if (_nowC < gemCooldown.chatUntil) return { ok: false, error: gemCooldown.chatReason || 'سهمیه موقتاً تمام شده — چند لحظه بعد دوباره امتحان کن' };
  let lastErr = null;
  let sawNetFail = false; /* v0.26 */
  /* زنجیرهٔ مدل: اول مدلِ انتخابی کاربر، بعد جدیدترین فلاش (نام مستعار همیشه‌سبز)
     و بعد نسل‌های قدیمی‌تر به‌عنوان فالبک — اگر مدلی منسوخ شده باشد (404)، خودکار
     مدل بعدی امتحان می‌شود تا «دیگر در دسترس نیست» دیگر به کاربر نرسد.
     v0.21 — مدل کاریِ آخر در اول زنجیره (دومین سوال به بعد = سریع‌ترین مسیر)
     v0.26 — مدل‌های ۴۰۴شده از حافظهٔ منفی حذف می‌شوند (gemBadModels) */
  /* v0.32 — اول کشف پویا (هرچه گوگل امروز دارد)، بعد نام مستعار همیشه‌سبز،
     بعد نسل ۳ (بر اساس سند رسمی گوگل نسل ۲.۰ بازنشسته شده)، و در انتها ۲.۵
     به‌عنوان فالبک خیلی قدیمی — دیگر هیچ مدل مرده‌ای در زنجیره اسلات هدر نمی‌دهد */
  const disc = await gemDiscoverModels(keys[0], gbase);
  const baseModels = gemChainPruned([...new Set([
    gemWorkingModel,
    String(model || '').trim(),
    ...disc,
    ...geminiModelChain(''),
  ])].filter(Boolean)).slice(0, 12);
  /* v0.39 — صف پویا + قطع سریع خطای منطقه‌ای + 429 → مدل بعدی (سهمیهٔ جدا)
     (همان منطق stt:gemini — توضیح کامل آنجا) */
  let locBlocked = false;
  let netFailStreak = 0; /* v0.47 — B11: دو شکستِ آنیِ شبکه‌ای = مسیر قطع است، نه مدل */
  for (const k of keys) {
    if (locBlocked) break;
    const queue = baseModels.slice();
    const hinted = new Set();
    let guard = 0;
    while (queue.length && guard++ < 24) {
      const mdl = queue.shift();
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
        /* v0.18 — سرعت: نسل ۲.۵ به بعد بدون «فکر کردن» جواب می‌دهد
           (thinkingBudget=0 — تا ۵۰-۷۰٪ سریع‌تر)؛ v0.32 — از روی نام مدل */
        if (gemSupportsThinking(mdl)) body.generationConfig.thinkingConfig = { thinkingBudget: 0 };
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
        const r = await cloudFetch(
          `${gbase}/v1beta/models/${encodeURIComponent(mdl)}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k }, /* v0.39 — هدر (هر دو فرمت کلید) */
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(35000), /* v0.21: ۶۰→۳۵ ثانیه */
          }
        );
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          const msg = (j && j.error && (j.error.message || j.error.status)) || `HTTP ${r.status}`;
          lastErr = `Gemini: ${String(msg).slice(0, 140)}`;
          if (gemIsModel404(r.status, msg)) {
            gemMarkBad(mdl); /* v0.26 */
            const hint = gemHintModel(msg); /* v0.39 — جایگزینِ رسمیِ گوگل، اول صف */
            if (hint && !hinted.has(hint) && !gemBadModels.has(hint)) { hinted.add(hint); gemBadModels.delete(hint); queue.unshift(hint); }
          }
          if (isNetFail(String(msg))) sawNetFail = true;
          /* v0.39 — موقعیت = کل مسیر؛ قطع فوری با پیام رله */
          if (gemIsLocationErr(r.status, msg)) { lastErr = 'Gemini: ' + (gemErrHuman(r.status, msg) || lastErr); locBlocked = true; break; }
          /* v0.21 — کلید بی‌اعتبار/ممنوع (401/403) → کلید بعدی */
          if ([401, 403].includes(r.status)) { lastErr = gemErrHuman(r.status, msg) || lastErr; break; }
          /* v0.39 — 429 سهمیهٔ همین مدل است؛ مدل بعدی سهمیهٔ جدا دارد (درخواست کاربر:
             «اگر یک مدل کار نکرد خودت خودکار برو مدل بعدی») */
          if (r.status === 429) { lastErr = gemErrHuman(r.status, msg) || lastErr; continue; }
          /* v0.28 — پیام فارسیِ قابل‌فهم برای خطاهای کلید/سرزمین (400: API key not valid) */
          const hum = gemErrHuman(r.status, msg);
          if (hum) lastErr = 'Gemini: ' + hum;
          continue; /* مدل ناموجود (400/404) → مدل بعدی */
        }
        const cand = j && j.candidates && j.candidates[0];
        const text = cand && cand.content && cand.content.parts
          ? cand.content.parts.map((x) => x.text || '').join('').trim()
          : '';
        if (!text) { lastErr = 'پاسخ خالی از Gemini رسید'; continue; }
        gemWorkingModel = mdl; /* v0.21 — حافظهٔ مدل کارا */
        gemCoolClear(); /* v0.47 — B09: موفقیت = کول‌داون‌ها پاک */
        return { ok: true, text, model: mdl, keyIndex: keys.indexOf(k) };
      } catch (e) {
        lastErr = netErr(e);
        sawNetFail = sawNetFail || isNetFail(String(lastErr));
        /* v0.47 — B11: شکستِ آنیِ شبکه‌ای (fetch failed/timeout) یعنی مسیر قطع است —
           چرخش ۱۱مدل دیگر فقط طوفان retry می‌سازد (لاگ: ۶ خط fetch failed در ۱۰ms) */
        if (isNetFail(String(lastErr))) {
          netFailStreak += 1;
          if (netFailStreak >= 2) { gemNetCool(lastErr); break; }
        }
      }
    }
  }
  /* v0.26 — همهٔ شکست‌ها شبکه‌ای بود → در لاگ صریح بنویس (تشخیص آسان کاربر) */
  if (sawNetFail) actLog('gemini-chat: all attempts failed at NETWORK level — dns bypass ' + (DNS_BOOT.applied ? 'active' : 'INACTIVE') + ', hosts pinned=' + DNS_BOOT.count);
  /* v0.38 — لیست فنی مدل‌های امتحان‌شده فقط در activity.log می‌ماند، نه در پیام کاربر */
  try { actLog('gemini-chat fail: tried models ' + baseModels.join(', ') + (gemHintModel(lastErr) ? ' (hint applied live)' : '')); } catch (_) { /* noop */ }
  /* v0.47 — B09: شکست کامل → کول‌داون (۴۲۹/سهمیه: ۹۰s، شبکه: ۴۵s) تا درخواست
     بعدی فوراً جواب انسانی بگیرد و سهمیه/شبکه هدر نرود */
  if (sawNetFail) {
    gemNetCool(lastErr);
  } else {
    gemCooldown.chatUntil = Date.now() + 90000;
    gemCooldown.chatReason = lastErr || '';
  }
  return { ok: false, error: (lastErr || 'سرویس Gemini در حال حاضر پاسخگو نیست — چند لحظه بعد دوباره امتحان کن') };
});

/* v0.29 — تست اتصال جمنای از تنظیمات: یک درخواست واقعیِ کوچک با کلید ذخیره‌شده؛
   نتیجهٔ دقیق (مدل، تأخیر) یا خطای فارسیِ قابل‌فهم برمی‌گرداند تا کاربر بداند
   مشکل کلید است، سهمیه، سرزمین (ایران) یا شبکه — نه «ثبت نشده»‌های مبهم */
ipcMain.handle('ai:gemtest', async (_e, p) => {
  const { key, base } = p || {};
  const gbase = String(base || '').trim().replace(/\/+$/, '') || 'https://generativelanguage.googleapis.com';
  const keys = splitKeys(key);
  if (!keys.length) return { ok: false, error: 'اول کلید جمنای را در کادر بالا بگذار و صبر کن ذخیره شود' };
  /* v0.32 — تست اتصال هم از کشف پویا استفاده می‌کند: مدل‌های واقعاً زندهٔ همین کلید
     v0.39 — زنجیرهٔ تازه + فهرست کامل مدل‌ها در پاسخ (برای انتخابگر تنظیمات) */
  const discT = await gemDiscoverModels(keys[0], gbase);
  const models = [...new Set([...discT.slice(0, 4), ...geminiModelChain('').slice(0, 4)])].slice(0, 6);
  const badKeys = new Set();
  let lastErr = null;
  let locBlockedT = false;
  for (const mdl of models) {
    if (locBlockedT) break;
    for (const k of keys) {
      if (badKeys.has(k)) continue;
      const t0 = Date.now();
      try {
        const r = await cloudFetch(
          `${gbase}/v1beta/models/${encodeURIComponent(mdl)}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k }, /* v0.39 — هدر */
            body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: pong' }] }], generationConfig: { maxOutputTokens: 8 } }),
            signal: AbortSignal.timeout(15000),
          }
        );
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          const msg = (j && j.error && (j.error.message || j.error.status)) || `HTTP ${r.status}`;
          lastErr = gemErrHuman(r.status, msg) || String(msg).slice(0, 160);
          if (gemIsLocationErr(r.status, msg)) { locBlockedT = true; break; } /* v0.39 — همهٔ مدل‌ها همان را می‌دهند */
          if ([401, 403].includes(r.status)) { badKeys.add(k); continue; } /* این کلید خراب/ممنوع است */
          if (r.status === 429) continue; /* v0.39 — سهمیهٔ این مدل؛ مدل بعدی */
          continue; /* مدل ناموجود → مدل بعدی */
        }
        const cand = j && j.candidates && j.candidates[0];
        const txt = cand && cand.content && cand.content.parts
          ? cand.content.parts.map((x) => x.text || '').join('').trim()
          : '';
        if (!txt) { lastErr = 'اتصال برقرار شد ولی پاسخ خالی برگشت'; continue; }
        gemWorkingModel = mdl; /* v0.39 — تست موفق = مدل کاری چت هم همین شود */
        return { ok: true, model: mdl, ms: Date.now() - t0, reply: txt.slice(0, 40), via: __cloudVia || '?', models: (gemDiscoverCache.all || []).slice() };
      } catch (e) {
        lastErr = netErr(e);
      }
    }
  }
  /* v0.29.1 — شکست + مسیر تشخیصی: کاربر باید بداند مشکل کجاست (کلید؟ سرزمین؟
     شبکه؟ پراکسی؟) — پیام فارسیِ معنی‌دار + مسیر واقعی تلاش‌ها */
  let hint = '';
  try {
    const pr = await session.defaultSession.resolveProxy('https://generativelanguage.googleapis.com/');
    hint = String(pr || '').trim() === 'DIRECT'
      ? 'هیچ پراکسی فعالی دیده نمی‌شود — اگر فیلترشکن داری روشنش کن، یا در کادر «آدرس رله» یک آدرس بگذار'
      : 'پراکسی سیستم فعاله — مسیر کرومیوم امتحان شد؛ اگر باز هم خطا آمد کلید/رله را چک کن';
  } catch (_) { /* noop */ }
  return { ok: false, error: ((lastErr || 'اتصال برقرار نشد') + (hint ? ' — ' + hint : '')).slice(0, 300), via: __cloudVia || '?', models: (gemDiscoverCache.all || []).slice() };
});

/* v0.39 — فهرست کامل مدل‌های چتِ همین کلید برای انتخابگر تنظیمات؛
   کشف ۳۰ دقیقه‌ای کش می‌شود — این هندلر فقط همان کش را می‌دهد (سریع) */
ipcMain.handle('ai:gemmodels', async (_e, p) => {
  const { key, base } = p || {};
  const gbase = String(base || '').trim().replace(/\/+$/, '') || 'https://generativelanguage.googleapis.com';
  const keys = splitKeys(key);
  if (!keys.length) return { ok: false, models: [], error: 'اول کلید جمنای را ذخیره کن' };
  if (!gemDiscoverCache.all.length || Date.now() - gemDiscoverCache.at > 30 * 60 * 1000) {
    await gemDiscoverModels(keys[0], gbase).catch(() => []);
  }
  const all = (gemDiscoverCache.all || []).slice();
  return { ok: all.length > 0, models: all, error: all.length ? '' : 'فهرست مدل‌ها همین حالا در دسترس نیست — بعداً دوباره امتحان کن' };
});

ipcMain.handle('ai:openai', async (_e, p) => {
  const { key, model, messages } = p || {};
  const keys = splitKeys(key);
  if (!keys.length) return { ok: false, error: 'کلید OpenAI تنظیم نشده' };
  if (!Array.isArray(messages) || !messages.length) return { ok: false, error: 'پیام خالی است' };
  let lastErr = null;
  for (const k of keys) {
    try {
      const r = await cloudFetch('https://api.openai.com/v1/chat/completions', {
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
   این‌جا فقط اجرای مهاربندی‌شده PowerShell انجام می‌شود.
   v0.60 (B3) — سخت‌سازی «دورِ» همین قابلیت (خودِ قابلیت عمداً آزاد می‌ماند):
   ۱) فهرست سیاهِ ویرانگری (case-insensitive) روی اسکریپت ترکیب‌شده
   ۲) سقف نرخ: حداکثر ۶ اجر در پنجرهٔ ۶۰ ثانیه‌ای غلتان
   ۳) لاگ کامل هر اجر: طول + ۱۲۰ نویسهٔ اول (پاک‌سازی‌شده از کاراکتر کنترلی)
   فیوچر: -ConstrainedLanguage گزینهٔ بعدی است — فعلاً نه، چون اسکریپت‌های
   قانونی کاربر (COM/بدنه‌های Add-Type/…) می‌شکند و B3 نباید قابلیت را بکشد. */
const CUSTOM_RUN_DENY_RE = new RegExp([
  '(^|[\\s;&|(])format(\\.com)?(\\s|\\(|$)', /* format.com / format C: — اما Format-Table/List را نمی‌گیرد */
  'Format-Volume',
  'diskpart',
  'Remove-Item\\s+-Recurse\\s+-Force\\s+[A-Za-z]:\\\\',
  'rd\\s+/s',
  'del\\s+/[sq]',
  'reg\\s+delete',
  'vssadmin',
  'bcdedit',
  'cipher\\s+/w',
  'Invoke-WebRequest[\\s\\S]*-OutFile',
  'DownloadFile',
  'certutil\\s+-urlcache',
  'bitsadmin\\s+/transfer',
].join('|'), 'i');
const customRunTimes = [];
ipcMain.handle('custom:run', (_e, script) => {
  const s = String(script || '')
    .replace(/\r?\n/g, '; ')
    .slice(0, 2000);
  if (!s.trim()) return { ok: false, error: 'اسکریپت خالی است' };
  /* v0.38.1 — -EncodedCommand (UTF-16LE base64): قبلاً escaping دستی کوتیشن
     دو-بک‌اسلش تولید می‌کرد و هر اسکریپت دارای " با «missing the terminator»
     می‌مرد (گزارش کاربر: «دستور هوش مصنوعی کاری نمی‌کند») */
  const cmdStr = `powershell -NoProfile -NonInteractive -EncodedCommand ${Buffer.from(s, 'utf16le').toString('base64')}`;
  /* B3-۱ — فهرست سیاه: دستورهای ویرانگر/دانلود-دراپر با لاگ صادقانه رد می‌شوند.
     نکتهٔ طراحی: به‌جای throw، {ok:false,error} برمی‌گردد — رندرر (که مجاز به
     دست‌زدن نیست) برای reject هیچ catch‌ای ندارد و استثنا «خطای خاموش» می‌شد؛
     همین قرارداد در UI به‌صورت «اجرا نشد: …» نمایش داده می‌شود. */
  const dm = CUSTOM_RUN_DENY_RE.exec(s);
  if (dm) {
    actLog(`custom:run REFUSED (deny-list: "${String(dm[0]).slice(0, 40)}") len=${s.length} head="${s.slice(0, 120).replace(/[\x00-\x1f\x22]/g, ' ')}"`);
    return { ok: false, error: 'این اسکریپت شامل دستورهای خطرناک (فرمت/پاک‌سازی انبوه/دانلود فایل) است و اجرا نمی‌شود' };
  }
  /* B3-۲ — سقف نرخ: ۶ اجر در ۶۰ ثانیهٔ غلتان (حافظهٔ درون‌پردازشی) */
  const now = Date.now();
  while (customRunTimes.length && now - customRunTimes[0] > 60000) customRunTimes.shift();
  if (customRunTimes.length >= 6) {
    actLog(`custom:run REFUSED (rate cap 6/60s) len=${s.length} head="${s.slice(0, 120).replace(/[\x00-\x1f\x22]/g, ' ')}"`);
    return { ok: false, error: 'تعداد اجرای فرمان‌های سفارشی زیاد است — حدود یک دقیقه صبر کنید' };
  }
  customRunTimes.push(now);
  /* B3-۳ — لاگ کامل هر اجر (بدون متن خام چندخطی) */
  actLog(`custom:run len=${s.length} head="${s.slice(0, 120).replace(/[\x00-\x1f\x22]/g, ' ')}"`);
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
/* v0.22 — اسکریپت کاملاً ایستا با param(): یک‌بار در userData نوشته و با
   «-File» اجرا می‌شود — دیگر هیچ خط فرمان بلندی وجود ندارد. ریشهٔ ارور
   «The command line is too long» این بود که کل اسکریپت (بیش از حد مجاز
   cmd.exe / CreateProcess) به‌صورت -EncodedCommand در خط فرمان می‌رفت. */
/* v0.30.0 — DC-NATIVE: بدنهٔ دیسکورد از صفر بازنویسی شد (درخواست کاربر بعد از
   سه نسل فیکس: «یک بار کامل از اول برنامه‌نویسی کن، با یک روش دیگ»). موتور جدید:
   حالتِ واقعی (UIA سه‌دوره‌ای) → کلید با فوکوسِ تاییدشده (AttachThreadInput +
   SwitchToThisWindow + اسکن‌کد مستقل از کیبورد فارسی) → UIA Invoke → کلیک مختصاتی
   → تاییدِ فلِیپ — نتیجه‌ها صادقانه: KEYS-VERIFIED / UIA-VERIFIED / UACLICK /
   ALREADY / KEYS-UNVERIFIED / ERR:NOFOCUS. کلیدِ بدون فوکوس (که به پنجرهٔ
   اشتباه می‌رفت) و «OK دروغین» هر دو به‌کلی حذف شده‌اند. */
const DISCORD_PS_BODY = `param(
  [string]$Action = 'focus',
  [string]$Mode = 'fg',
  [string]$Name = '',
  [int]$Dx = 46,
  [int]$Dy = 52,
  [int]$WaitMs = 6000,
  [int]$Retries = 1,
  [string]$Text = ''
)
$ErrorActionPreference = 'Stop'
# v0.29.1 — خطاهای ران‌تایم پاورشل به کدپیج کنسول ویندوز می‌روند؛ متن فارسی به
# «????» تبدیل می‌شد. با UTF-8 کردن خروجی، پیام خطا خوانا به activity.log می‌رسد.
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace AvaDc3 {
  public struct RECT { public int Left, Top, Right, Bottom; }
  public struct POINT { public int X, Y; }
  public class W {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, UIntPtr dwExtraInfo);
    [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern IntPtr FindWindowEx(IntPtr p, IntPtr c, string cls, string win);
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wp, IntPtr lp);
    [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd, ref POINT p);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern int GetClassName(IntPtr hWnd, System.Text.StringBuilder sb, int max);
    public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
  }
}
'@
# ─── v0.30.0 — DC-NATIVE: بازنویسی کامل موتور دیسکورد از صفر ───
# کاربر بعد از سه نسل فیکس گفت: «هنوز هیچ عملی روی دیسکورد اعمال نمیشه».
# سه نسخهٔ قبلی روی یک فرض بنا شده بودند: «UIA دکمهٔ واقعی را پیدا می‌کند».
# اگر درخت دسترس‌پذیری دیسکورد کور باشد (BTNS=0) یا نام‌ها عوض شده باشند،
# همهٔ مسیرها می‌میرند و فالبک کلید هم بدون فوکوس واقعی به پنجرهٔ اشتباه می‌رود.
# موتور جدید روی یک چرخهٔ بسته بنا شده: «حالتِ واقعی → عمل لایه‌ای → تاییدِ
# فلِیپ» و هیچ مسیری بدون تایید نمی‌گوید «انجام شد»:
#   L1 کلید با فوکوسِ تاییدشده — زنجیرهٔ قطعی فوکوس (AttachThreadInput +
#      SwitchToThisWindow + پوکِ Alt) و بعد keybd_event با پرچم SCANCODE؛
#      اسکن‌کد مستقل از layout است (کیبورد فارسی فرقی نمی‌کند) و Chromium
#      event.code درست می‌سازد — همان چیزی که دیسکورد برای keybind می‌خواهد.
#      کلید هرگز بدون تاییدِ GetForegroundWindow فرستاده نمی‌شود (پروب DBG:FG).
#   L2 UIA Invoke روی دکمهٔ واقعی (بدون نیاز به فوکوس)
#   L3 کلیک مختصاتی روی مستطیل همان دکمه
#   بعد از هر عمل: Test-Flip چک می‌کند لیبل دکمه واقعا چرخیده باشد؛
#   نتیجه‌ها صادقانه‌اند: KEYS-VERIFIED / UIA-VERIFIED / UACLICK / ALREADY /
#   KEYS-UNVERIFIED / ERR:NOFOCUS / ERR:NOBTN — هیچ «OK دروغین» وجود ندارد.
$VKNAME = @{ 'ctrl' = 0x11; 'shift' = 0x10; 'm' = 0x4D; 'd' = 0x44; 'h' = 0x48; 'a' = 0x41; 'e' = 0x45; 'k' = 0x4B; 'v' = 0x56; 'enter' = 0x0D }
$SCNAME = @{ 'ctrl' = 0x1D; 'shift' = 0x2A; 'm' = 0x32; 'd' = 0x20; 'h' = 0x23; 'a' = 0x1E; 'e' = 0x12; 'k' = 0x25; 'v' = 0x2F; 'enter' = 0x1C }
# v0.36 — دیگر فیلتر MainWindowHandle وجود ندارد: دیسکوردِ داخل try پنجرهٔ «مخفی»
# دارد (MainWindowHandle=0) و فیلتر قبلی همین‌جا ERR:NO_DISCORD می‌داد — ریشهٔ
# «دیسکورد دیگه اصلاً کار نمی‌کنه» بعد از آپدیت/بستن به try. حالا پروسه هست؟ کافی است.
$dcProcs = @(Get-Process -Name Discord,DiscordCanary,DiscordPTB -ErrorAction SilentlyContinue)
$proc = $dcProcs | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $proc) {
  # اگر دیسکورد با دیپ‌لینک در حال بالا آمدن است، تا $WaitMs میلی‌ثانیه صبر کن
  $waited = 0
  while ($waited -lt $WaitMs) {
    Start-Sleep -Milliseconds 600
    $waited += 600
    $dcProcs = @(Get-Process -Name Discord,DiscordCanary,DiscordPTB -ErrorAction SilentlyContinue)
    $proc = $dcProcs | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
    if ($proc) { break }
  }
}
if (-not $dcProcs -or $dcProcs.Count -eq 0) { Write-Output 'ERR:NO_DISCORD'; exit }
# v0.36 — پیدا کردن پنجرهٔ واقعی حتی وقتی مخفی/مینیمایز در try است: EnumWindows
# روی همهٔ PIDهای دیسکورد + کلاس Chrome_WidgetWin_1؛ پنجرهٔ نمایان مقدم است.
function Find-DcHwndByPid {
  $pidSet = @{}
  foreach ($p in $dcProcs) { $pidSet[[uint32]$p.Id] = $true }
  # hashtables نوع مرجع‌اند — دیلیگیتِ EnumWindows همان نمونه را می‌بیند (دامنهٔ اسکوپ امن است)
  $box = @{ best = [IntPtr]::Zero; any = [IntPtr]::Zero }
  $cb = [AvaDc3.W+EnumProc]{
    param($h, $l)
    try {
      [uint32]$wpid = 0
      [AvaDc3.W]::GetWindowThreadProcessId($h, [ref]$wpid) | Out-Null
      if (-not $pidSet.ContainsKey($wpid)) { return $true }
      $sb = New-Object System.Text.StringBuilder 256
      [AvaDc3.W]::GetClassName($h, $sb, 256) | Out-Null
      if ($sb.ToString() -ne 'Chrome_WidgetWin_1') { return $true }
      if ($box['any'] -eq [IntPtr]::Zero) { $box['any'] = $h }
      if ([AvaDc3.W]::IsWindowVisible($h)) { $box['best'] = $h; return $false }
    } catch { }
    return $true
  }
  try { [AvaDc3.W]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null } catch { }
  if ($box['best'] -ne [IntPtr]::Zero) { return $box['best'] }
  return $box['any']
}
$hwnd = [IntPtr]::Zero
if ($proc) { $hwnd = $proc.MainWindowHandle }
if (-not $hwnd -or $hwnd -eq [IntPtr]::Zero) { $hwnd = Find-DcHwndByPid }
if ($hwnd -eq [IntPtr]::Zero) {
  # پروسه هست ولی هیچ پنجرهٔ شناخته‌شده‌ای نیست — میوت/دیفن با کلید سراسری
  # هنوز ممکن است (UIA صادقانه ناموفق می‌شود)؛ فقط مسیرهای پنجره‌دار می‌میرند
  Write-Output 'DBG:NOHWND=1'
}
$child = [AvaDc3.W]::FindWindowEx($hwnd, [IntPtr]::Zero, 'Chrome_RenderWidgetHostHWND', [IntPtr]::Zero)
if ($child -eq [IntPtr]::Zero) { $child = $hwnd }
Write-Output "DBG:PROC=$($proc.ProcessName) CHILD=$(if ($child -ne [IntPtr]::Zero) { 1 } else { 0 }) MODE=$Mode ACT=$Action"
$bg = ($Mode -eq 'bg')
$prevFg = [AvaDc3.W]::GetForegroundWindow()
function Test-Fg { return ([AvaDc3.W]::GetForegroundWindow() -eq $hwnd) }
function Poke-Alt {
  # یک ضربهٔ بی‌ضرر Alt — قفلِ foreground ویندوز را برای SetForegroundWindow باز می‌کند
  [AvaDc3.W]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 40
  [AvaDc3.W]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)
}
function Focus-DcHard {
  # فقط وقتی TRUE می‌دهد که سیستم‌عامل واقعاً دیسکورد را foreground گزارش کند —
  # همین «تایید» است که کلیدِ کورکورانه (ریشهٔ «هیچ عملی اعمال نمیشه») را می‌کشد
  if (Test-Fg) { return $true }
  [AvaDc3.W]::ShowWindow($hwnd, 9) | Out-Null
  Start-Sleep -Milliseconds 80
  Poke-Alt
  Start-Sleep -Milliseconds 60
  [AvaDc3.W]::SetForegroundWindow($hwnd) | Out-Null
  Start-Sleep -Milliseconds 180
  if (Test-Fg) { return $true }
  # مسیر AttachThreadInput — کلاسیک‌ترین راه قطعیِ جابه‌جایی فوکوس از پروسهٔ دیگر
  try {
    [uint32]$fgPid = 0
    $fg = [AvaDc3.W]::GetForegroundWindow()
    $tidF = [AvaDc3.W]::GetWindowThreadProcessId($fg, [ref]$fgPid)
    $tidC = [AvaDc3.W]::GetCurrentThreadId()
    [AvaDc3.W]::AttachThreadInput($tidC, $tidF, $true) | Out-Null
    [AvaDc3.W]::BringWindowToTop($hwnd) | Out-Null
    [AvaDc3.W]::SetForegroundWindow($hwnd) | Out-Null
    [AvaDc3.W]::AttachThreadInput($tidC, $tidF, $false) | Out-Null
  } catch { Write-Output ('DBG:ATIERR=' + $_.Exception.Message) }
  Start-Sleep -Milliseconds 200
  if (Test-Fg) { return $true }
  # SwitchToThisWindow — مستندنشده ولی از ویندوز ۹۵ تا ۱۱ همیشه کار می‌کند
  try { [AvaDc3.W]::SwitchToThisWindow($hwnd, $true) } catch { }
  Start-Sleep -Milliseconds 250
  if (Test-Fg) { return $true }
  Poke-Alt
  [AvaDc3.W]::SetForegroundWindow($hwnd) | Out-Null
  Start-Sleep -Milliseconds 180
  return (Test-Fg)
}
function Send-Combo([string]$seq) {
  # keybd_event با پرچم KEYEVENTF_SCANCODE (0x8) و KEYEVENTF_KEYUP (0x2):
  # کلید با «شمارهٔ فیزیکی» تزریق می‌شود نه کاراکترِ layout — فارسی/انگلیسی یکی است
  $names = @($seq.Split(',') | ForEach-Object { $_.Trim().ToLower() })
  foreach ($n in $names) { [AvaDc3.W]::keybd_event([byte]$VKNAME[$n], [byte]$SCNAME[$n], 0x8, [UIntPtr]::Zero) }
  Start-Sleep -Milliseconds 80
  for ($i = $names.Count - 1; $i -ge 0; $i--) {
    $n = $names[$i]
    [AvaDc3.W]::keybd_event([byte]$VKNAME[$n], [byte]$SCNAME[$n], 0x8 -bor 0x2, [UIntPtr]::Zero)
  }
  Start-Sleep -Milliseconds 140
}
function Send-BgCombo([int[]]$vks) {
  # مسیر PostMessage برای Quick Switcher در حالت bg (کلیک/کلید پنجرهٔ غیرفعال)
  foreach ($v in $vks) {
    $s = $SCNAME[[string]$v]; if (-not $s) { $s = 0 }
    $lp = [long]1 -bor ([long]$s -shl 16)
    [AvaDc3.W]::PostMessage($child, 0x100, [IntPtr]$v, [IntPtr]$lp) | Out-Null
  }
  Start-Sleep -Milliseconds 60
  for ($i = $vks.Length - 1; $i -ge 0; $i--) {
    $s = $SCNAME[[string]$vks[$i]]; if (-not $s) { $s = 0 }
    $lp = [long]0xC0000001 -bor ([long]$s -shl 16)
    [AvaDc3.W]::PostMessage($child, 0x101, [IntPtr]$vks[$i], [IntPtr]$lp) | Out-Null
  }
}
function Send-BgClick([int]$sx, [int]$sy) {
  $o = New-Object AvaDc3.POINT; $o.X = 0; $o.Y = 0
  [AvaDc3.W]::ClientToScreen($child, [ref]$o) | Out-Null
  $lp = [long](($sy - $o.Y) -shl 16) -bor [long](($sx - $o.X) -band 0xFFFF)
  [AvaDc3.W]::PostMessage($child, 0x201, [IntPtr]1, [IntPtr]$lp) | Out-Null
  Start-Sleep -Milliseconds 90
  [AvaDc3.W]::PostMessage($child, 0x202, [IntPtr]0, [IntPtr]$lp) | Out-Null
}
function Send-FgClick([int]$sx, [int]$sy) {
  [AvaDc3.W]::SetCursorPos($sx, $sy) | Out-Null
  Start-Sleep -Milliseconds 70
  [AvaDc3.W]::mouse_event(0x02, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 60
  [AvaDc3.W]::mouse_event(0x04, 0, 0, 0, [UIntPtr]::Zero)
}
function Click-At([int]$sx, [int]$sy) { if ($bg) { Send-BgClick $sx $sy } else { Send-FgClick $sx $sy } }
function Restore-Focus {
  # فقط اگر فوکوس واقعاً به دیسکورد رفته باشد دست می‌زنیم — وگرنه پوکِ الکی Alt
  # می‌تواند منوی برنامهٔ فعال را باز کند
  if ($prevFg -eq [IntPtr]::Zero -or $prevFg -eq $hwnd) { return }
  if (-not (Test-Fg)) { return }
  Poke-Alt
  Start-Sleep -Milliseconds 60
  [AvaDc3.W]::SetForegroundWindow($prevFg) | Out-Null
}
function Get-DcWin {
  Add-Type -AssemblyName UIAutomationClient | Out-Null
  Add-Type -AssemblyName UIAutomationTypes | Out-Null
  # v0.29.3 — PropertyCondition با hwnd IntPtr در سازنده می‌ترکد (فقط Int32
  # قبول می‌کند) → همهٔ اکشن‌ها EMPTY. FromHandle همان کار را با IntPtr می‌کند.
  if ($hwnd -eq [IntPtr]::Zero) { return $null }
  return [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$hwnd)
}
function Get-DcBtns {
  # درخت دسترس‌پذیری کرومیوم تنبل ساخته می‌شود؛ اولین FindAll بعد از پیدا شدن
  # پروسه ممکن است خالی باشد — سه دور با مکث تا BTNS=0ِ کاذب نداشته باشیم
  $win = Get-DcWin
  if (-not $win) { return $null }
  $btnCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)
  for ($round = 1; $round -le 3; $round++) {
    $btns = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, $btnCond)
    $cnt = 0; if ($btns) { $cnt = $btns.Count }
    Write-Output ('DBG:ROUND=' + $round + ' BTNS=' + $cnt)
    if ($cnt -gt 0) { return $btns }
    Start-Sleep -Milliseconds 450
  }
  return $null
}
function Scan-DcBtns([string]$doRx, [string]$alrRx, [bool]$quiet) {
  $res = @{ alive = $false; names = @(); hit = $null; already = $false }
  try {
    $btns = Get-DcBtns
    if (-not $btns) { return $res }
    $res.alive = $true
    $nl = New-Object System.Collections.Generic.List[string]
    foreach ($b in $btns) {
      $bn = ''
      try { $bn = $b.Current.Name } catch { }
      if (-not $bn) { continue }
      if ($nl.Count -lt 64) { $nl.Add($bn) }
      if ($doRx -and ($bn -match $doRx)) { $res.hit = $b }
      elseif ($alrRx -and ($bn -match $alrRx)) { $res.already = $true }
    }
    $res.names = @($nl)
    if (-not $quiet) {
      $dump = ($nl -join '|')
      if ($dump.Length -gt 400) { $dump = $dump.Substring(0, 400) }
      Write-Output ('DBG:BTNAMES=' + $dump)
    }
  } catch { Write-Output ('DBG:UIAERR=' + $_.Exception.Message) }
  return $res
}
function Test-Flip([string]$doRx, [string]$alrRx) {
  # بعد از عمل: اگر لیبل دکمهٔ مقابل ظاهر شود، تغییر وضعیت تایید است
  if (-not $alrRx) { return $false }
  $s = Scan-DcBtns $alrRx $doRx $true
  if ($s.alive -and ($null -ne $s.hit)) { return $true }
  Start-Sleep -Milliseconds 400
  $s = Scan-DcBtns $alrRx $doRx $true
  return ($s.alive -and ($null -ne $s.hit))
}
function Show-DcQuiet {
  # v0.35 — پنجرهٔ مینیمایز را «بدون گرفتن فوکوس» نشان بده (SW_SHOWNOACTIVATE=4)
  # تا درخت دسترس‌پذیری کرومیوم زنده شود.
  # v0.36 — پنجرهٔ مخفیِ try هم بدون فوکوس نشان داده می‌شود.
  # خروجی (تک‌مقداری — بدون خط DBG تا آرایه‌ای نشود): ۰=تغییری نکرد، ۱=مینیمایز بود، ۲=مخفی بود
  $mode = 0
  try {
    if ([AvaDc3.W]::IsIconic($hwnd)) { $mode = 1 }
    elseif (-not [AvaDc3.W]::IsWindowVisible($hwnd)) { $mode = 2 }
  } catch { return 0 }
  if ($mode -ne 0) {
    try { [AvaDc3.W]::ShowWindow($hwnd, 4) | Out-Null } catch { return 0 }
    Start-Sleep -Milliseconds 500
  }
  return $mode
}
function Re-Minimize-Dc($was) {
  # فقط اگر خودمان از مینیمایز/مخفی بیرون آورده بودیم، بعد از کار همان حالت قبلی
  # ۶=SW_MINIMIZE برای حالت ۱؛ ۰=SW_HIDE برای حالت ۲ (پنجرهٔ try مثل قبل پنهان بماند)
  if ($was -is [array]) { $was = $was[-1] } # محافظت از خروجی چندخطی تصادفی
  if ($was -eq 1) { try { [AvaDc3.W]::ShowWindow($hwnd, 6) | Out-Null } catch { } }
  elseif ($was -eq 2) { try { [AvaDc3.W]::ShowWindow($hwnd, 0) | Out-Null } catch { } }
}
function Press-DcBg([string]$doRx, [string]$alrRx, [string]$label) {
  # v0.35 — میوت/دیفن «بدون باز کردن صفحهٔ دیسکورد»: درخواست اصلی کاربر.
  # هیچ فوکوس عوض نمی‌شود، هیچ کلیدی تزریق نمی‌شود؛ فقط UIA دکمهٔ واقعی را
  # Invoke می‌کند و Test-Flip اثبات می‌کند وضعیت واقعاً چرخیده — بدون اثبات
  # رشتهٔ OK برنمی‌گردد و مسیر به چرخهٔ فوکوس‌دارِ قبلی (Press-Dc) می‌افتد.
  $wasIconic = Show-DcQuiet
  try {
    for ($pass = 1; $pass -le 2; $pass++) {
      $st = Scan-DcBtns $doRx $alrRx $true
      if ($st.alive -and $st.already -and (-not $st.hit)) { return ('OK:' + $label + '-ALREADY') }
      if ($st.hit) {
        try { Write-Output ('DBG:BGHIT=' + $st.hit.Current.Name) } catch { }
        try {
          ($st.hit.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)).Invoke()
          Start-Sleep -Milliseconds 450
          if (Test-Flip $doRx $alrRx) { return ('OK:' + $label + ':BG-UIA-VERIFIED') }
          Write-Output 'DBG:BGINVOKE_NOFLIP'
        } catch { Write-Output ('DBG:BGINVERR=' + $_.Exception.Message) }
      }
      Start-Sleep -Milliseconds 700
    }
  } finally { Re-Minimize-Dc $wasIconic }
  return ''
}
function Try-Keys($st, [string]$doRx, [string]$alrRx, [string]$label, [string]$combo) {
  # کلید فقط بعد از فوکوسِ تاییدشده فرستاده می‌شود — اگر فوکوس نگرفت،
  # هیچ کلیدی جایی فرستاده نمی‌شود (پنجرهٔ اشتباه آلوده نمی‌شود)
  $fg = Focus-DcHard
  Write-Output ('DBG:FG=' + $(if ($fg) { '1' } else { '0' }))
  if (-not $fg) { return '' }
  Send-Combo $combo
  if ($st.alive) {
    if (-not $alrRx) { Restore-Focus; return ('OK:' + $label + ':KEYS-UNVERIFIED') }
    Start-Sleep -Milliseconds 350
    if (Test-Flip $doRx $alrRx) { Restore-Focus; return ('OK:' + $label + ':KEYS-VERIFIED') }
    Write-Output 'DBG:FLIP=0'
    return ''
  }
  Restore-Focus
  return ('OK:' + $label + ':KEYS-UNVERIFIED')
}
function Try-HotkeyBg([bool]$preAlive, [string]$doRx, [string]$alrRx, [string]$label, [string]$combo) {
  # v0.36 — کلیدِ سراسری دیسکورد (Settings › Keybinds → Global) توسط ویندوز گرفته
  # می‌شود و به فوکوس پنجرهٔ دیسکورد نیاز ندارد؛ پس حتی وقتی دیسکورد مخفی/try/
  # مینیمایز/بازی است کار می‌کند — بدون جابه‌جایی فوکوس، بدون کلید به پنجرهٔ اشتباه
  # (RegisterHotKey کلید را قبل از برنامهٔ فعال مصرف می‌کند).
  # اثبات فلِیپ فقط وقتی ادعا می‌شود که اسکنِ «قبل» زنده بود (وضعیت قبلی معلوم بود) —
  # وگرنه زنجیرهٔ بعدی خودش وضعیت را می‌خواند و در صورت نیاز اصلاح می‌کند.
  if (-not $combo) { return '' }
  Write-Output ('DBG:HOTKEY=' + $combo)
  Send-Combo $combo
  if (-not $alrRx) { return ('OK:' + $label + ':KEYS-UNVERIFIED') }
  Start-Sleep -Milliseconds 400
  $flipped = Test-Flip $doRx $alrRx
  if (-not $flipped) {
    Start-Sleep -Milliseconds 600
    $flipped = Test-Flip $doRx $alrRx
  }
  if ($flipped -and $preAlive) { return ('OK:' + $label + ':HOTKEY-VERIFIED') }
  if ($preAlive) { Write-Output 'DBG:HOTKEY_NOFLIP' }
  return ''
}
function Press-Dc([string]$doRx, [string]$alrRx, [string]$label, [string]$combo = '', [bool]$keysFirst = $true) {
  # چرخهٔ کامل v0.30: حالت واقعی → عمل لایه‌ای → تایید فلِیپ — هرگز کورکورانه OK نمی‌گوید
  # v0.35 — حالت bg برای خانوادهٔ mute (فقط مسیرهای کلیددار): اول مسیر کاملاً
  # بدون‌فوکوس (Press-DcBg)؛ فقط وقتی UIA پس‌زمینه جواب نداد، همان چرخهٔ
  # فوکوس‌دارِ تاییدشدهٔ قبلی اجرا می‌شود — هیچ مسیر بی‌اثری اضافه نشده
  # v0.36 — ترتیب جدید حالت bg: (۰) اسکن سریع وضعیت فعلی — اگر از قبل در وضعیت
  # هدفیم هیچ کلیدی فرستاده نمی‌شود؛ (۱) کلید سراسری بدون نیاز به فوکوس — حتی
  # دیسکورد در try؛ (۲) UIA مینیمایز v0.35؛ (۳) چرخهٔ فوکوس‌دار قبلی.
  if ($bg -and $keysFirst -and $combo) {
    $wasIc0 = Show-DcQuiet
    $pre = Scan-DcBtns $doRx $alrRx $true
    Re-Minimize-Dc $wasIc0
    if ($pre.alive -and $pre.already -and (-not $pre.hit)) { return ('OK:' + $label + '-ALREADY') }
    $hk = Try-HotkeyBg ([bool]$pre.alive) $doRx $alrRx $label $combo
    if ($hk) { return $hk }
    $bgR = Press-DcBg $doRx $alrRx $label
    if ($bgR) {
      # ALREADY این‌جا یعنی «بعد از کلیدِ ما وضعیت هدف برقرار است» (اسکن قبل آن را
      # ندیده بود) — برچسب صادقانهٔ تاییدشده می‌گیرد، نه «از قبل»
      if ($bgR -like ('OK:' + $label + '-ALREADY') -and (-not ($pre.alive -and $pre.already))) { $bgR = ('OK:' + $label + ':BG-UIA-VERIFIED') }
      return $bgR
    }
  }
  $st = Scan-DcBtns $doRx $alrRx $false
  if ($st.alive -and $st.already -and (-not $st.hit)) { return ('OK:' + $label + '-ALREADY') }
  if ($keysFirst -and $combo) {
    $r = Try-Keys $st $doRx $alrRx $label $combo
    if ($r) { return $r }
  }
  if ($st.hit) {
    try { Write-Output ('DBG:UIAHIT=' + $st.hit.Current.Name) } catch { }
    try {
      ($st.hit.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)).Invoke()
      if ($st.alive) {
        Start-Sleep -Milliseconds 300
        if (Test-Flip $doRx $alrRx) { Restore-Focus; return ('OK:' + $label + ':UIA-VERIFIED') }
      }
      Restore-Focus
      return ('OK:' + $label + ':UIA')
    } catch { Write-Output ('DBG:INVERR=' + $_.Exception.Message) }
    try {
      $r = $st.hit.Current.BoundingRectangle
      Click-At ([int]($r.X + $r.Width / 2)) ([int]($r.Y + $r.Height / 2))
      if ($st.alive) {
        Start-Sleep -Milliseconds 300
        if (Test-Flip $doRx $alrRx) { Restore-Focus; return ('OK:' + $label + ':UACLICK-VERIFIED') }
      }
      Restore-Focus
      return ('OK:' + $label + ':UACLICK')
    } catch { Write-Output ('DBG:CLERR=' + $_.Exception.Message) }
  }
  if (-not $keysFirst -and $combo) {
    $r = Try-Keys $st $doRx $alrRx $label $combo
    if ($r) { return $r }
  }
  if ($st.alive) { return ('ERR:NOBTN:' + $label) }
  # UIA کور + فوکوس هم نگرفتیم — هیچ عملی انجام نشد، صادقانه می‌گوییم
  return 'ERR:NOFOCUS'
}
function Test-CallAlive {
  # v0.33 — اثبات واقعیِ برقراری تماس: در صفحهٔ DM پیش از تماس هیچ‌کدام از این
  # دکمه‌ها وجود ندارند (دکمه‌های Mute/Deafen پنل پایین همیشه هستند، ولی
  # Disconnect/Leave Call فقط داخل تماس) — این همان «تایید فلِیپ» مسیر تماس است
  $s = Scan-DcBtns '^(Disconnect|Leave Call|Leave|End Call)$' '' $true
  return ($s.alive -and ($null -ne $s.hit))
}
function Try-CallClick {
  # دکمهٔ تماس: UIA دکمه‌ای (نام دقیق) → UIA درخت کامل (هر نوع کنترل) → مختصات دستی
  # چند بار تلاش می‌شود (بارگذاری DM ممکن است چند ثانیه طول بکشد)
  # v0.33 — چرخهٔ بسته: بعد از Invoke/کلیک، Test-CallAlive اثبات می‌کند تماس واقعاً
  # برقرار شده؛ بدون اثبات OK دروغین برنمی‌گردد (ریشهٔ «مخاطب را پیدا می‌کند ولی
  # زنگ نمی‌زند»: Invoke بی‌اثر بود ولی بدون هیچ اثباتی OK:CALLING می‌گفتیم)
  if (Test-CallAlive) { return 'OK:CALLING' } # همین حالا در تماس است
  for ($tryN = 1; $tryN -le $Retries; $tryN++) {
    try {
      $win = if ($hwnd -ne [IntPtr]::Zero) { [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$hwnd) } else { $null }
      if ($win) {
        $btnCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)
        $btns = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, $btnCond)
        Write-Output "DBG:TRY=$tryN BTNS=$($btns.Count)"
        # دور ۳ — درخت کامل بدون فیلتر نوع کنترل: بعضی نسخه‌های دیسکورد دکمهٔ تماس
        # را با ControlType دیگری منتشر می‌کنند — فقط دورهای ۱ و ۶ (گران‌ترین اسکن)
        $fullTree = $null
        if ($tryN -eq 1 -or $tryN -eq 6) {
          try { $fullTree = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition) } catch { }
        }
        foreach ($pass in 1, 2, 3) {
          if ($pass -eq 3 -and (-not $fullTree)) { continue }
          $scan = $btns
          if ($pass -eq 3) { $scan = $fullTree }
          $seen = 0
          foreach ($b in $scan) {
            $seen++
            if ($pass -eq 3 -and $seen -gt 600) { break }
            $bn = ''
            try { $bn = $b.Current.Name } catch { }
            if (-not $bn) { continue }
            if ($bn -match 'Video|ویدیو|دوربین|End|قطع|Screen|اشتراک') { continue }
            $ok = $false
            if ($pass -eq 1) { $ok = ($bn -match 'Start Voice Call|Voice Call|Voice|تماس صوتی|شروع تماس|صوتی') }
            elseif ($pass -eq 2) { $ok = ($bn -match 'Call|تماس') }
            else { $ok = ($bn -match 'Start Voice Call|Voice Call|Voice|تماس صوتی|شروع تماس|Call|تماس') }
            if (-not $ok) { continue }
            Write-Output "DBG:HIT=$bn PASS=$pass"
            try {
              ($b.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)).Invoke()
              Start-Sleep -Milliseconds 900
              if (Test-CallAlive) { Restore-Focus; return 'OK:CALLING' }
              Start-Sleep -Milliseconds 700
              if (Test-CallAlive) { Restore-Focus; return 'OK:CALLING' }
              Write-Output 'DBG:INVOKE_NOFLIP'
            } catch { }
            try {
              $r = $b.Current.BoundingRectangle
              if ([int]$r.Width -gt 0 -and [int]$r.Height -gt 0) {
                Click-At ([int]($r.X + $r.Width / 2)) ([int]($r.Y + $r.Height / 2))
                Start-Sleep -Milliseconds 900
                if (Test-CallAlive) { Restore-Focus; return 'OK:CALLING' }
                Write-Output 'DBG:CLICK_NOFLIP'
              }
            } catch { }
          }
        }
        # v0.33 — اگر درخت زنده بود ولی دکمهٔ تماس در هیچ پاس پیدا نشد، یک‌بار
        # نام عناصر را لاگ کن تا دیباگِ دور بعدی دقیق ممکن باشد
        if ($btns.Count -gt 0 -and $tryN -eq 1) {
          try {
            $dump = @(); $k = 0
            $all2 = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
            foreach ($e in $all2) {
              $k++
              if ($k -gt 400) { break }
              $en2 = ''
              try { $en2 = $e.Current.Name } catch { }
              if ($en2 -and $dump.Count -lt 40) { $dump += $en2 }
            }
            if ($dump.Count -gt 0) {
              $d = ($dump -join '|')
              if ($d.Length -gt 300) { $d = $d.Substring(0, 300) }
              Write-Output ('DBG:ALLNAMES=' + $d)
            }
          } catch { }
        }
      }
    } catch { }
    Start-Sleep -Milliseconds 1100
  }
  # فالبک مختصات دستی — فقط وقتی درخت دسترس‌پذیری کور است (هیچ دکمه‌ای دیده نشد)
  # v0.32 — اگر دکمه‌ها بودند ولی دکمهٔ تماس نه، یعنی صفحهٔ DM نیست (جستجوی
  # Quick Switcher به پیج اشتباه رفته) و کلیک کور روی سرستون می‌تواند روی
  # چیز اشتباهی بخورد — قبلاً همین اتفاق می‌افتاد؛ حالا صادقانه می‌میریم
  Write-Output 'DBG:UIA_MISS'
  $blindProbe = Scan-DcBtns '' '' $true
  if ($blindProbe.alive -and $blindProbe.names.Count -gt 0) {
    Restore-Focus
    if ($Name) { return 'ERR:NODM' }
    return 'ERR:NOBTN'
  }
  $r2 = New-Object AvaDc3.RECT
  [AvaDc3.W]::GetWindowRect($hwnd, [ref]$r2) | Out-Null
  $tx = $r2.Right - $Dx
  $ty = $r2.Top + $Dy
  if ($tx -gt $r2.Left -and $ty -gt $r2.Top) {
    Click-At $tx $ty
    Start-Sleep -Milliseconds 900
    if (Test-CallAlive) { Restore-Focus; return 'OK:CALLING' }
    Restore-Focus
    return 'OK:CALL_CLICKED'
  }
  Restore-Focus
  return 'ERR:NOBTN'
}
# v0.29.1 — ریشهٔ ارور «The term '????' is not recognized»: کامنت C-سبک (اسلش-ستاره)
# در پاورشل کامنت نیست! قانون بدنه: فقط کامنت # تک‌خطی — هیچ‌وقت اسلش-ستاره ننویس.
# v0.30 — نتیجهٔ صادقانه: UIA=دکمه واقعی زده شد، ALREADY=از قبل در همان وضعیت،
#   KEYS-VERIFIED=کلید با فوکوس تاییدشده و فلِیپ تاییدشده، KEYS-UNVERIFIED=کلید
#   رفت ولی UIA کور بود و نتوانستیم تایید کنیم، ERR:NOFOCUS=نه UIA نه فوکوس.
switch ($Action) {
  'focus'    { if ($bg) { Write-Output 'OK' } elseif (Focus-DcHard) { Write-Output 'OK' } else { Write-Output 'ERR:NOFOCUS' } }
  'mute'     { Write-Output (Press-Dc '^Mute$' '^Unmute$' 'MUTE' 'ctrl,shift,m') }
  'unmute'   { Write-Output (Press-Dc '^Unmute$' '^Mute$' 'UNMUTE' 'ctrl,shift,m') }
  'deafen'   { Write-Output (Press-Dc '^Deafen$' '^Undeafen$' 'DEAFEN' 'ctrl,shift,d') }
  'undeafen' { Write-Output (Press-Dc '^Undeafen$' '^Deafen$' 'UNDEAFEN' 'ctrl,shift,d') }
  'hangup'   { Write-Output (Press-Dc '^(Disconnect|Leave Call|Leave|End Call)$' '' 'HANGUP' 'ctrl,shift,h' $false) }
  'answer'   { Write-Output (Press-Dc '^(Join Call|Answer|Accept|Join)$' '' 'ANSWER' 'ctrl,shift,a' $false) }
  'decline'  { Write-Output (Press-Dc '^(Decline|Reject|Deny)$' '' 'DECLINE' 'ctrl,shift,e' $false) }
  'state' {
    # خواندن وضعیت واقعی میکروفون/صدا بدون هیچ کلیکی — برای «وضعیت میکروفون دیسکورد»
    # v0.35 — حالت bg: پنجرهٔ مینیمایز بدون گرفتن فوکوس نشان داده می‌شود تا
    # درخت UIA زنده شود و وضعیت واقعاً از دیسکورد مینیمایز هم خوانده شود
    $wasIconic = Show-DcQuiet
    $st = Scan-DcBtns '' '' $false
    Re-Minimize-Dc $wasIconic
    if (-not $st.alive) { Write-Output 'ERR:NOSTATE'; exit }
    $muted = $false; $deaf = $false; $known = $false
    foreach ($n in $st.names) {
      if ($n -match '^Unmute$') { $muted = $true; $known = $true }
      elseif ($n -match '^Mute$') { $known = $true }
      if ($n -match '^Undeafen$') { $deaf = $true; $known = $true }
      elseif ($n -match '^Deafen$') { $known = $true }
    }
    if (-not $known) { Write-Output 'ERR:NOSTATE'; exit }
    $ms = 'ON'; if ($muted) { $ms = 'MUTED' }
    $ds = 'SOUND'; if ($deaf) { $ds = 'DEAF' }
    Write-Output ('OK:STATE:' + $ms + ':' + $ds)
  }
  'probe' {
    # آزمایش مکان‌یابی دکمهٔ تماس — فقط نشانگر موس حرکت می‌کند، کلیکی در کار نیست
    try {
      $win = if ($hwnd -ne [IntPtr]::Zero) { [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$hwnd) } else { $null }
      if ($win) {
        $btnCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)
        $btns = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, $btnCond)
        foreach ($b in $btns) {
          $bn = ''
          try { $bn = $b.Current.Name } catch { }
          if ($bn -match 'Video|ویدیو|End|قطع') { continue }
          if ($bn -match 'Start Voice Call|Voice Call|تماس صوتی|شروع تماس|Call|تماس') {
            $r = $b.Current.BoundingRectangle
            $cx = [int]($r.X + $r.Width / 2); $cy = [int]($r.Y + $r.Height / 2)
            [AvaDc3.W]::SetCursorPos($cx, $cy) | Out-Null
            Write-Output "OK:PROBE:$cx,$cy"
            exit
          }
        }
      }
    } catch { }
    $r2 = New-Object AvaDc3.RECT
    [AvaDc3.W]::GetWindowRect($hwnd, [ref]$r2) | Out-Null
    $tx = $r2.Right - $Dx; $ty = $r2.Top + $Dy
    [AvaDc3.W]::SetCursorPos($tx, $ty) | Out-Null
    Write-Output "OK:PROBE-FB:$tx,$ty"
  }
  'clickcall' {
    # DM از قبل با دیپ‌لینک باز شده — فقط دکمهٔ تماس را بزن
    Start-Sleep -Milliseconds 900
    # v0.33 — فوکوس تاییدشده قبل از هر اسکنی: اگر دیسکورد مینیمایز/تری باشد درخت
    # UIA کور و مختصات بی‌اعتبار است — یکی از ریشه‌های «پیدا می‌کند ولی زنگ نمی‌زند»
    $fg = Focus-DcHard
    Write-Output ('DBG:FG=' + $(if ($fg) { '1' } else { '0' }))
    $res = Try-CallClick
    if (-not ($res -like 'OK*')) {
      # v0.33 — دیپ‌لینک صفحهٔ DM را باز نکرده؟ همان مسیر Quick Switcher داخل همین
      # اجرا امتحان می‌شود — به‌جای خطای خالی، تماس واقعاً گرفته می‌شود
      Write-Output ('DBG:SW_FALLBACK=' + $res)
      $nm = ($Name -replace '[''"]', '')
      foreach ($cq in [char]0x2018, [char]0x2019, [char]0x201C, [char]0x201D) { $nm = $nm.Replace([string]$cq, '') }
      if ($nm) {
        try { Set-Clipboard -Value $nm -ErrorAction Stop | Out-Null } catch { Write-Output 'DBG:CLIP_FAIL' }
        $clipOk = $false
        try { $got = Get-Clipboard -Raw; $clipOk = ($got -eq $nm) } catch { $clipOk = $false }
        if ($clipOk) {
          $fg2 = Focus-DcHard
          Write-Output ('DBG:FG2=' + $(if ($fg2) { '1' } else { '0' }))
          if ($fg2) {
            Send-Combo 'ctrl,k'
            Start-Sleep -Milliseconds 1000
            Send-Combo 'ctrl,v'
            Start-Sleep -Milliseconds 900
            Send-Combo 'enter'
            Start-Sleep -Milliseconds 1700
            $res = Try-CallClick
          } else { $res = 'ERR:NOFOCUS' }
        } else { $res = 'ERR:CLIP' }
      }
    }
    Write-Output $res
  }
  'callswitch' {
    # v0.28.1 — در این فایل فقط گیومهٔ ASCII مجاز است؛ کاراکتر کج در زمان اجرا با [char] حذف می‌شود
    $name = ($Name -replace '[''"]', '')
    foreach ($cq in [char]0x2018, [char]0x2019, [char]0x201C, [char]0x201D) { $name = $name.Replace([string]$cq, '') }
    if (-not $name) { Write-Output 'ERR:NONAME'; exit }
    try { Set-Clipboard -Value $name -ErrorAction Stop | Out-Null } catch { Write-Output 'DBG:CLIP_FAIL' }
    # v0.32 — تایید کلیپ‌بورد: اگر نوشتن شکست خورده بود، Ctrl+V محتوای قدیمی
    # کلیپ‌بورد کاربر را در Quick Switcher می‌گذاشت → پیج اشتباه → تماس اشتباه
    $clipOk = $false
    try { $got = Get-Clipboard -Raw; $clipOk = ($got -eq $name) } catch { $clipOk = $false }
    if (-not $clipOk) { Write-Output 'ERR:CLIP'; exit }
    # v0.32 — مسیر bg با PostMessage حذف شد: کرومیوم کلیدهای PostMessage را
    # بی‌صدا می‌بلعد (ریشهٔ «به ali-hk زنگ بزن» که هیچ عملی اعمال نمی‌کرد) —
    # حالا همیشه فوکوس تاییدشده + کلید اسکن‌کد؛ فوکوس نگرفت = ERR:NOFOCUS صادقانه
    $fg = Focus-DcHard
    Write-Output ('DBG:FG=' + $(if ($fg) { '1' } else { '0' }))
    if (-not $fg) { Write-Output 'ERR:NOFOCUS'; exit }
    Send-Combo 'ctrl,k'
    Start-Sleep -Milliseconds 1000
    Send-Combo 'ctrl,v'
    Start-Sleep -Milliseconds 900
    Send-Combo 'enter'
    Start-Sleep -Milliseconds 1700
    Write-Output (Try-CallClick)
  }
  'msgsend' {
    # v0.35 — فرمان جدید: «به علی پیام بده که فردا میام» — مخاطب با Quick Switcher
    # باز می‌شود (همان مسیر امتحان‌شدهٔ تماس)، بعد متن پیام در کادر پیام پیست و
    # با Enter واقعی فرستاده می‌شود. هر گام تایید صادقانه دارد:
    #   کلیپ‌بورد تاییدشده، فوکوس تاییدشده، و بعد از ارسال جستجوی متن پیام در
    #   درخت UIA — پیدا شد = OK:MSGSENT، نشد = OK:MSGSENT-UNVERIFIED (دروغ نمی‌گوییم)
    $name = ($Name -replace '[''"]', '')
    foreach ($cq in [char]0x2018, [char]0x2019, [char]0x201C, [char]0x201D) { $name = $name.Replace([string]$cq, '') }
    if (-not $name) { Write-Output 'ERR:NONAME'; exit }
    $msg = ('' + $Text).Trim()
    if (-not $msg) { Write-Output 'ERR:NOTEXT'; exit }
    # گام ۱ — باز کردن DM مخاطب با کلیپ‌بوردِ تاییدشده (متن پیام فعلاً نگه داشته می‌شود)
    try { Set-Clipboard -Value $name -ErrorAction Stop | Out-Null } catch { Write-Output 'DBG:CLIP_FAIL' }
    $clipOk = $false
    try { $got = Get-Clipboard -Raw; $clipOk = ($got -eq $name) } catch { $clipOk = $false }
    if (-not $clipOk) { Write-Output 'ERR:CLIP'; exit }
    $fg = Focus-DcHard
    Write-Output ('DBG:FG=' + $(if ($fg) { '1' } else { '0' }))
    if (-not $fg) { Write-Output 'ERR:NOFOCUS'; exit }
    Send-Combo 'ctrl,k'
    Start-Sleep -Milliseconds 1000
    Send-Combo 'ctrl,v'
    Start-Sleep -Milliseconds 900
    Send-Combo 'enter'
    Start-Sleep -Milliseconds 1700
    # گام ۲ — پیست متن پیام در کادر پیام (بعد از باز شدن DM فوکوس خودکار آنجاست)
    try { Set-Clipboard -Value $msg -ErrorAction Stop | Out-Null } catch { Write-Output 'DBG:CLIP_FAIL' }
    $clipOk2 = $false
    try { $got2 = Get-Clipboard -Raw; $clipOk2 = ($got2 -eq $msg) } catch { $clipOk2 = $false }
    if (-not $clipOk2) { Write-Output 'ERR:CLIP'; exit }
    Send-Combo 'ctrl,v'
    Start-Sleep -Milliseconds 400
    Send-Combo 'enter'
    Start-Sleep -Milliseconds 800
    # گام ۳ — اثبات ارسال: متن پیام در درخت UIA (تاریخچهٔ چت) جستجو می‌شود
    $probe = $msg
    if ($probe.Length -gt 20) { $probe = $probe.Substring(0, 20) }
    $probeRx = [regex]::Escape($probe)
    $sent = $false
    try {
      $win2 = Get-DcWin
      if ($win2) {
        $all = $win2.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
        $k = 0
        foreach ($el in $all) {
          $k++
          if ($k -gt 800) { break }
          $en = ''
          try { $en = $el.Current.Name } catch { }
          if ($en -and ($en -match $probeRx)) { $sent = $true; break }
        }
      }
    } catch { Write-Output ('DBG:MSGVERIFYERR=' + $_.Exception.Message) }
    Restore-Focus
    if ($sent) { Write-Output 'OK:MSGSENT' } else { Write-Output 'OK:MSGSENT-UNVERIFIED' }
  }
  default { Write-Output 'ERR:UNKNOWN' }
}`;

/* v0.22 — نوشتن اسکریپت در پوشهٔ برنامه (ACL کاربر جاری) و اجرای spawn -File:
   خط فرمان فقط چند ده کاراکتر است — محدودیت ۸۱۹۱ کاراکتری cmd.exe و
   ۳۲۷۶۷ کاراکتری CreateProcess هر دو دیگر اصلاً درگیر نمی‌شوند. */
function runDiscordPs(psAction, mode, nm, dxN, dyN, msgText) {
  /* v0.35 — msgsend هم بلندمدت است (سوییچر + بارگذاری DM + ارسال) */
  const longRun = psAction === 'clickcall' || psAction === 'callswitch' || psAction === 'msgsend';
  const waitMs = longRun ? 25000 : 6000;
  const retries = longRun ? 12 : 1;
  const safeName = String(nm || '').replace(/['’‘“”`"…]/g, ''); /* v0.28.1 + گیومهٔ کج */
  /* v0.35 — متن پیام فقط از گیومه‌های خطرناک پاک می‌شود، محتوا دست‌نخورده
     می‌ماند (از argv می‌آید، نه خط فرمان shell — گیومه امن است) */
  const safeText = String(msgText || '').replace(/[’‘“”…]/g, (ch) => ({ '’': "'", '‘': "'", '“': '"', '”': '"', '…': '...' }[ch]));
  let psFile = '';
  try {
    psFile = path.join(app.getPath('userData'), 'ava-dc.ps1');
    /* BOM: پاورشل ۵.۱ بدون BOM متن فارسیِ نام دکمه‌ها را خراب می‌خواند */
    fs.writeFileSync(psFile, '\ufeff' + DISCORD_PS_BODY, 'utf8');
  } catch (e) {
    actLog(`discord ps write failed: ${String((e && e.message) || e).slice(0, 120)}`, 'discord');
    return Promise.resolve({ ok: false, error: 'نوشتن اسکریپت دیسکورد ممکن نشد' });
  }
  const args = ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-File', psFile,
    '-Action', psAction, '-Mode', mode, '-Name', safeName,
    '-Dx', String(dxN), '-Dy', String(dyN), '-WaitMs', String(waitMs), '-Retries', String(retries)];
  if (psAction === 'msgsend') args.push('-Text', safeText);
  const t0 = Date.now();
  return new Promise((resolve) => {
    let stdout = '', stderr = '', killed = false;
    let child = null;
    try { child = spawn('powershell.exe', args, { windowsHide: true }); }
    catch (e) { return resolve({ ok: false, error: String((e && e.message) || e).slice(0, 160) }); }
    const killer = setTimeout(() => { killed = true; try { child.kill(); } catch (_) { /* noop */ } }, 62000);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (e) => {
      clearTimeout(killer);
      resolve({ ok: false, error: String((e && e.message) || e).slice(0, 160) });
    });
    child.on('close', () => {
      clearTimeout(killer);
      const errTxt = String(stderr || '').trim();
      if (errTxt) actLog(`discord ps stderr: ${errTxt.slice(0, 260)}`, 'discord');
      /* خطوط DBG: تشخیصی‌اند و نتیجه نیستند — فقط لاگ می‌شوند؛
         نتیجه = آخرین خط OK/ERR (اسکریپت ممکن است چند خط چاپ کند) */
      const lines = String(stdout || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      lines.filter((l) => /^DBG:/i.test(l)).forEach((l) => actLog(`discord ${l.slice(0, 400)}`, 'discord'));
      const out = lines.filter((l) => !/^DBG:/i.test(l)).pop() || '';
      actLog(`discord ${psAction} mode=${mode} -> ${out || (killed ? 'TIMEOUT' : 'EMPTY')} (${Date.now() - t0}ms)`, 'discord');
      if (/^ERR:PS:/.test(out)) {
        return resolve({ ok: false, error: ('خطای اسکریپت: ' + out.replace(/^ERR:PS:/, '')).slice(0, 160) });
      }
      /* v0.28.1 — پیامِ واقعی خطا نشان داده شود، نه فقط خط اول («At ... char:N»)
          خطِ پیام = اولین خطی که At / + / CategoryInfo / FullyQualifiedErrorId نیست */
      if (!out && errTxt) {
        const el = errTxt.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
        const msgLine = el.find((l) => !/^At /.test(l) && !/^\+/.test(l) && !/^CategoryInfo/i.test(l) && !/^FullyQualifiedErrorId/i.test(l)) || el[0] || '';
        const posM = (el[0] || '').match(/:(\d+) char:(\d+)\s*$/);
        const posTxt = posM ? ` (خط ${posM[1]})` : '';
        return resolve({ ok: false, error: ('خطای پاورشل: ' + msgLine + posTxt).slice(0, 240) });
      }
      if (!out) {
        return resolve({
          ok: false,
          error: killed
            ? 'اسکریپت دیسکورد بیش از حد طول کشید — دیسکورد را یک‌بار باز/بسته کن و دوباره امتحان کن'
            : ('PowerShell اجرا نشد' + (errTxt ? `: ${errTxt.split(/\r?\n/)[0]}` : '')).slice(0, 160),
        });
      }
      if (/^ERR:/.test(out)) {
        const msgs = {
          'ERR:NO_DISCORD': 'دیسکورد باز نیست — اول دیسکورد را باز کن',
          'ERR:UNKNOWN': 'فرمان دیسکورد شناخته نشد',
          'ERR:NONAME': 'نام مخاطب پیدا نشد — در تنظیمات دیسکورد مخاطب بساز یا نام را کامل بگو',
          'ERR:NOSTATE': 'وضعیت دیسکورد خوانده نشد — دیسکورد را باز کن و دوباره امتحان کن',
          'ERR:NOBTN': 'دکمهٔ تماس پیدا نشد — صفحهٔ مخاطب باز شد ولی تماس نگرفت؛ مختصات دستی را با «آزمایش مکان» تنظیم کن یا حالت کمکی را امتحان کن',
          'ERR:CLIP': 'کلیپ‌بورد در دسترس نیست — یک‌بار دیگر امتحان کن، یا مخاطب را در تنظیمات › دیسکورد ثبت کن تا تماس با دیپ‌لینک مستقیم گرفته شود',
          'ERR:NODM': 'صفحهٔ گفتگوی مخاطب باز نشد — نام را واضح‌تر بگو، یا مخاطب را در تنظیمات › دیسکورد ثبت کن تا تماس با دیپ‌لینک مستقیم گرفته شود',
          'ERR:NOTEXT': 'متن پیام پیدا نشد — دوباره بگو و آخرش متن پیام را واضح اضافه کن',
        };
        /* v0.30 — خطاهای پسونددار (ERR:NOBTN:LABEL / ERR:NOFOCUS) با پیشوند تطبیق می‌شوند */
        const em = out.trim();
        let msg = msgs[em] || '';
        if (!msg && em.startsWith('ERR:NOBTN:')) msg = 'دکمهٔ دیسکورد پیدا نشد — نام دکمه‌ها در activity.log ثبت شد؛ دیسکورد را یک‌بار ماکسیمم کن و دوباره بگو';
        if (!msg && em.startsWith('ERR:NOFOCUS')) msg = 'فوکوس به پنجرهٔ دیسکورد منتقل نشد — پنجرهٔ دیسکورد را یک‌بار دستی فعال کن و دوباره امتحان کن';
        return resolve({ ok: false, error: (msg || em.replace(/^ERR:/, 'خطا: ')).slice(0, 200) });
      }
      resolve({ ok: true, result: out || 'OK' });
    });
  });
}

ipcMain.handle('discord:cmd', async (_e, p) => {
  const { action, name, userId, bg, dx, dy, assist, text } = p || {};
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
    const uid = String(userId).trim();
    const nm = String(name || '');
    actLog(`discord call userId=${uid.slice(0, 4)}… mode=${mode}`, 'discord');
    try { await shell.openExternal(`discord://discord.com/channels/@me/${uid}`); } catch (_) { /* noop */ }
    await new Promise((r) => setTimeout(r, 2600));
    /* v0.32 — clickcall همیشه fg: فالبک کلیک مختصاتی در bg با PostMessage بود
       و بلعیده می‌شد؛ مسیر قطعی فقط فوکوس تاییدشده است.
       v0.33 — نام مخاطب هم پاس می‌شود تا اگر دیپ‌لینک صفحهٔ DM را باز نکرد،
       اسکریپت داخل همان اجرا با Quick Switcher خودش را ترمیم کند */
    const r1 = await runDiscordPs('clickcall', 'fg', nm, dxN, dyN);
    if (r1 && r1.ok) return r1;
    /* v0.33 — قالب دوم دیپ‌لینک: نسخه‌هایی از دیسکورد فقط شکل discord://-/ را
       می‌شناسند؛ فقط روی شکستِ تلاش اول، تماس با قالب دوم دوباره تلاش می‌شود */
    actLog(`discord call alt deep-link retry (${String((r1 && r1.error) || '').slice(0, 60)})`, 'discord');
    try { await shell.openExternal(`discord://-/channels/@me/${uid}`); } catch (_) { /* noop */ }
    await new Promise((r) => setTimeout(r, 2600));
    return runDiscordPs('clickcall', 'fg', nm, dxN, dyN);
  }
  /* v0.32 — تماس (callswitch) همیشه fg با فوکوس تاییدشده — در حالت bg کلیدهای
     Quick Switcher قبلاً PostMessage بودند و کرومیوم بی‌صدا بلعیدشان؛ ریشهٔ
     «به ali-hk زنگ بزن» که هیچ عملی اعمال نمی‌کرد. بقیهٔ اکشن‌ها مثل قبل —
     خانوادهٔ mute خودش در v0.30 فوکوس را تایید می‌کند. */
  const psAction = A === 'call' ? 'callswitch' : A;
  /* v0.35 — msgsend متن پیام را جدا از نام عبور می‌دهد؛ پاک‌سازی امن فقط روی Name */
  return runDiscordPs(psAction, (A === 'call' ? 'fg' : mode), String(name || ''), dxN, dyN, A === 'msgsend' ? String(text || '') : '');
});

/* ============================================================
   v0.34 — تایپ صوتی سیستم‌شیرین: «اینجا برام تایپ کن» در هر برنامهٔ ویندوز
   ریشهٔ «خروجی در برنامهٔ فعال» این بود که bridge.system.typeText اصلاً
   وجود نداشت — دکمهٔ مرده. حالا موتور واقعی تایپ با SendInput UNICODE:
   مستقل از layout کیبورد (فارسی/انگلیسی فرقی ندارد)، متن از فایل موقت
   خوانده می‌شود (محدودیت طول خط فرمان حذف)، فوکوس به پنجرهٔ ثبت‌شده
   برمی‌گردد و تایپ همان‌جا انجام می‌شود. هیچ کلیدی بدون فوکوسِ تاییدشده.
   ============================================================ */
const TYPE_PS_BODY = `param(
  [string]$Action = 'savefg',
  [string]$TxtFile = '',
  [long]$Focus = 0
)
$ErrorActionPreference = 'Stop'
# فقط کامنت # — هیچ اسلش-ستاره، هیچ گیومهٔ کج، هیچ بک‌تیک (قانون بدنه‌های پاورشل آوا)
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace AvaType {
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Explicit)] public struct InputUnion { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public InputUnion U; }
  public static class W {
    [DllImport("user32.dll", SetLastError = true)] public static extern uint SendInput(uint n, INPUT[] inputs, int size);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool f);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  }
}
'@;
function Restore-Focus2([long]$h) {
  # فوکوس تاییدشده — همان زنجیرهٔ قطعی دیسکورد؛ کلید هرگز به پنجرهٔ اشتباه نمی‌رود
  if ($h -le 0) { return $true }
  $hw = [IntPtr]$h
  if ([AvaType.W]::GetForegroundWindow() -eq $hw) { return $true }
  try {
    [AvaType.W]::ShowWindow($hw, 9) | Out-Null
    Start-Sleep -Milliseconds 80
    [uint32]$fgPid = 0
    $fg = [AvaType.W]::GetForegroundWindow()
    $tidF = [AvaType.W]::GetWindowThreadProcessId($fg, [ref]$fgPid)
    $tidC = [AvaType.W]::GetCurrentThreadId()
    [AvaType.W]::AttachThreadInput($tidC, $tidF, $true) | Out-Null
    [AvaType.W]::BringWindowToTop($hw) | Out-Null
    [AvaType.W]::SetForegroundWindow($hw) | Out-Null
    [AvaType.W]::AttachThreadInput($tidC, $tidF, $false) | Out-Null
  } catch { }
  Start-Sleep -Milliseconds 200
  if ([AvaType.W]::GetForegroundWindow() -eq $hw) { return $true }
  return $false
}
function New-Ki([int]$wvk, [int]$scan, [int]$flags) {
  # پاورشل نمی‌تواند فیلد ساختارِ تودرتو را درجا تغییر دهد — ساختار از پایین ساخته می‌شود
  $ki = New-Object AvaType.KEYBDINPUT
  $ki.wVk = [uint16]$wvk; $ki.wScan = [uint16]$scan; $ki.dwFlags = [uint32]$flags; $ki.time = 0; $ki.dwExtraInfo = [IntPtr]::Zero
  $u = New-Object AvaType.InputUnion
  $u.ki = $ki
  $inp = New-Object AvaType.INPUT
  $inp.type = [uint32]1
  $inp.U = $u
  return $inp
}
switch ($Action) {
  'savefg' {
    # پنجرهٔ فعال الان چیست — در لحظهٔ شروع تایپ صوتی ثبت می‌شود
    try {
      $fg = [AvaType.W]::GetForegroundWindow()
      Write-Output ('FG=' + $fg.ToInt64().ToString())
    } catch { Write-Output 'ERR:NOUSER32' }
  }
  'type' {
    # متن از فایل UTF-8 — محدودیت ۸۱۹۱ کاراکتری خط فرمان اصلاً درگیر نمی‌شود
    if (-not $TxtFile -or -not (Test-Path -LiteralPath $TxtFile)) { Write-Output 'ERR:NOTEXT'; exit }
    $text = ''
    try { $text = [System.IO.File]::ReadAllText($TxtFile) } catch { Write-Output 'ERR:NOTEXT'; exit }
    if (-not $text.Length) { Write-Output 'ERR:NOTEXT'; exit }
    if (-not (Restore-Focus2 $Focus)) { Write-Output 'ERR:NOFOCUS'; exit }
    Start-Sleep -Milliseconds 250
    $size = [System.Runtime.InteropServices.Marshal]::SizeOf([type][AvaType.INPUT])
    $batch = New-Object 'System.Collections.Generic.List[AvaType.INPUT]'
    $typed = 0
    $flushBatch = {
      if ($batch.Count -gt 0) {
        $arr = $batch.ToArray()
        [void][AvaType.W]::SendInput([uint32]$arr.Length, $arr, $size)
        $batch.Clear()
        Start-Sleep -Milliseconds 12
      }
    }
    foreach ($ch in $text.ToCharArray()) {
      $code = [int]$ch
      if ($code -eq 13) { continue }
      if ($code -eq 10) {
        # خط جدید = کلید Enter واقعی
        $batch.Add((New-Ki 0x0D 0x1C 0)); $batch.Add((New-Ki 0x0D 0x1C 2)); $typed++
      } elseif ($code -ge 32) {
        # KEYEVENTF_UNICODE = 0x4 — تایپ مستقل از layout کیبورد
        $batch.Add((New-Ki 0 $code 4)); $batch.Add((New-Ki 0 $code 6)); $typed++
      }
      if ($batch.Count -ge 32) { & $flushBatch }
    }
    & $flushBatch
    Write-Output ('OK:TYPED:' + $typed)
  }
  default { Write-Output 'ERR:UNKNOWN' }
}`;

function runTypePs(psAction, txtFile, focusArg) {
  return new Promise((resolve) => {
    let psFile = '';
    try {
      psFile = path.join(app.getPath('userData'), 'ava-type.ps1');
      fs.writeFileSync(psFile, '\ufeff' + TYPE_PS_BODY, 'utf8');
    } catch (e) {
      actLog(`type ps write failed: ${String((e && e.message) || e).slice(0, 120)}`, 'type');
      return resolve({ ok: false, error: 'نوشتن اسکریپت تایپ ممکن نشد' });
    }
    const args = ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-File', psFile,
      '-Action', psAction, '-TxtFile', String(txtFile || ''), '-Focus', String(focusArg || 0)];
    const t0 = Date.now();
    let child = null;
    try { child = spawn('powershell.exe', args, { windowsHide: true }); }
    catch (e) { return resolve({ ok: false, error: String((e && e.message) || e).slice(0, 160) }); }
    let stdout = '', stderr = '', killed = false;
    const killer = setTimeout(() => { killed = true; try { child.kill(); } catch (_) { /* noop */ } }, 30000);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (e) => { clearTimeout(killer); resolve({ ok: false, error: String((e && e.message) || e).slice(0, 160) }); });
    child.on('close', () => {
      clearTimeout(killer);
      const errTxt = String(stderr || '').trim();
      if (errTxt) actLog(`type ps stderr: ${errTxt.slice(0, 240)}`, 'type');
      const lines = String(stdout || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const out = lines.pop() || '';
      actLog(`type ${psAction} -> ${out || (killed ? 'TIMEOUT' : 'EMPTY')} (${Date.now() - t0}ms)`, 'type');
      if (/^FG=/.test(out)) return resolve({ ok: true, hwnd: Number(out.slice(3)) || 0 });
      if (/^OK:TYPED:/.test(out)) return resolve({ ok: true, typed: Number(out.slice(9)) || 0 });
      if (/^ERR:NOFOCUS/.test(out)) return resolve({ ok: false, error: 'فوکوس به پنجرهٔ مقصد برنگشت — پنجرهٔ مقصد را یک‌بار فعال کن و دوباره امتحان کن' });
      if (/^ERR:NOTEXT/.test(out)) return resolve({ ok: false, error: 'متنی برای تایپ وجود ندارد' });
      if (/^ERR:NOUSER32/.test(out)) return resolve({ ok: false, error: 'این قابلیت فقط داخل ویندوز کار می‌کند' });
      if (/^ERR:PS:/.test(out) || (!out && errTxt)) {
        return resolve({ ok: false, error: ('خطای پاورشل تایپ: ' + (out.replace(/^ERR:PS:/, '') || errTxt.split(/\r?\n/)[0])).slice(0, 200) });
      }
      if (/^ERR:/.test(out)) return resolve({ ok: false, error: out.replace(/^ERR:/, 'خطا: ') });
      if (!out) return resolve({ ok: false, error: killed ? 'اسکریپت تایپ بیش از حد طول کشید' : 'PowerShell اجرا نشد' });
      resolve({ ok: false, error: out.slice(0, 160) });
    });
  });
}

ipcMain.handle('sys:savefg', async () => {
  if (process.platform !== 'win32') return { ok: false, error: 'تایپ در برنامه‌ها فقط داخل ویندوز کار می‌کند' };
  return runTypePs('savefg', '', 0);
});

ipcMain.handle('sys:typeText', async (_e, p) => {
  const { text, hwnd } = p || {};
  const t = String(text || '');
  if (!t.trim()) return { ok: false, error: 'متنی برای تایپ وجود ندارد' };
  if (process.platform !== 'win32') return { ok: false, error: 'تایپ در برنامه‌ها فقط داخل ویندوز کار می‌کند' };
  let f = '';
  try {
    f = path.join(app.getPath('userData'), `ava-type-${Date.now()}.txt`);
    /* BOM: ReadAllText کدپیج درست را خودش می‌فهمد */
    fs.writeFileSync(f, '\ufeff' + t, 'utf8');
  } catch (e) {
    return { ok: false, error: 'نوشتن فایل موقت تایپ ممکن نشد' };
  }
  const r = await runTypePs('type', f, Number(hwnd) || 0);
  try { fs.unlinkSync(f); } catch (_) { /* noop */ }
  return r;
});


/* ---------- لاگ عملکرد (v0.18 — ارتقا v0.48) — برای عیب‌یابی از راه دور ----------
   دو فایل موازی:
   1) activity.log (متنِ خوانا، همان قالب همیشه — روتِیت ~۴۰۰KB)
   2) activity.jsonl (لاگ ساخت‌یافته v0.48 — خواستهٔ کاربر: «ساختار لاگ رو
      بهتر کنی که بهتر مشکلات رو متوجه بشی») — هر خط یک JSON:
      {t, v(نسخه), b(شناسهٔ نشست), ch(کانال/تگ), m(پیام), ...extra}
      + مارکرهای session: boot/quit/crash — بوت بدون quit قبلی = کرش.
   ارسال دستی: کاربر با «آوا گزارش بفرست» یا دکمهٔ تنظیمات، پوشهٔ logs را
   باز می‌کند (log:openFolder) و فایل‌های activity.jsonl/activity.log را
   خودش برای ممیزی می‌فرستد (تصمیم کاربر — آپلود آنلاین کلاً حذف شد). */
const ACT_MAX = 400 * 1024;
const ACT_JSONL_MAX = 2 * 1024 * 1024;
function logDirOf() { return path.join(app.getPath('userData'), 'logs'); }
function logSessionMarker(ev, extra) {
  try {
    const dir = logDirOf();
    fs.mkdirSync(dir, { recursive: true });
    const rec = Object.assign({ t: new Date().toISOString(), v: app.getVersion(), b: AVA_BOOT_ID, ch: 'session', ev }, (extra && typeof extra === 'object') ? extra : {});
    fs.appendFileSync(path.join(dir, 'activity.jsonl'), JSON.stringify(rec) + '\n');
  } catch (_) { /* لاگ هرگز نباید برنامه را بکشد */ }
}
function actLog(line, tag = 'app', extra = null) {
  /* ۱) متن خوانا — همان رفتار همیشه (کاملاً سازگار با قبلی) */
  try {
    const dir = logDirOf();
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, 'activity.log');
    try {
      const st = fs.statSync(f);
      if (st.size > ACT_MAX) fs.renameSync(f, path.join(dir, 'activity.old.log'));
    } catch (_) { /* هنوز فایلی نیست */ }
    fs.appendFileSync(f, `[${new Date().toISOString()}] [${tag}] ${String(line).replace(/\s+/g, ' ').slice(0, 400)}\n`);
  } catch (_) { /* لاگ هرگز نباید برنامه را بکشد */ }
  /* ۲) JSONL ساخت‌یافته — تحلیل ماشینی دقیق (v0.48) */
  try {
    const dir = logDirOf();
    fs.mkdirSync(dir, { recursive: true });
    const jf = path.join(dir, 'activity.jsonl');
    try {
      const st = fs.statSync(jf);
      if (st.size > ACT_JSONL_MAX) fs.renameSync(jf, path.join(dir, 'activity.old.jsonl'));
    } catch (_) { /* هنوز فایلی نیست */ }
    const rec = Object.assign({ t: new Date().toISOString(), v: app.getVersion(), b: AVA_BOOT_ID, ch: String(tag || 'app'), m: String(line).replace(/\s+/g, ' ').slice(0, 400) }, (extra && typeof extra === 'object') ? extra : {});
    fs.appendFileSync(jf, JSON.stringify(rec) + '\n');
  } catch (_) { /* noop */ }
}
ipcMain.handle('log:openFolder', () => { try { const d = logDirOf(); fs.mkdirSync(d, { recursive: true }); shell.openPath(d); return { ok: true, path: d }; } catch (e) { return { ok: false, error: String((e && e.message) || e) }; } });
ipcMain.handle('log:act', (_e, msg, extra) => {
  /* v0.48 — سازگار با قبلی: رشتهٔ ساده؛ جدید: {m, tag, extra} ساخت‌یافته */
  if (msg && typeof msg === 'object' && !Array.isArray(msg)) {
    actLog(String(msg.m || ''), String(msg.tag || 'ui'), (msg.extra && typeof msg.extra === 'object') ? msg.extra : null);
  } else {
    actLog(String(msg || ''), 'ui', (extra && typeof extra === 'object') ? extra : null);
  }
  return true;
});
ipcMain.handle('log:get', () => {
  try {
    const f = path.join(logDirOf(), 'activity.log');
    const lines = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean);
    return { ok: true, lines: lines.slice(-80) };
  } catch (e) { return { ok: false, lines: [], error: netErr(e) }; }
});

/* ============================================================
   v0.22 — پلیر موزیک ماندگار: پوشه‌ها دیگر بعد از ری‌استارت گم نمی‌شوند
   ریشهٔ باگ: قبلاً پوشه با <input webkitdirectory> انتخاب می‌شد و File های
   آن فقط تا پایان نشست زنده بودند — با بستن برنامه همه‌چیز از دست می‌رفت.
   حالا: انتخاب پوشه با dialog واقعی ویندوز → اسکن روی فایل‌سیستم در پروسهٔ
   اصلی → مسیرها در ava-settings.json ذخیره → بعد از ری‌استارت دوباره اسکن
   و بازسازی خودکار پلی‌لیست (بدون نیاز به انتخاب دوباره).
   ============================================================ */
const MUSIC_EXT_RE = /\.(mp3|m4a|aac|wav|flac|ogg|oga|opus|weba|webm|wma)$/i;

ipcMain.handle('music:pickDirs', async () => {
  try {
    const r = await dialog.showOpenDialog({
      title: 'انتخاب پوشه موزیک — چند پوشه هم می‌توانی انتخاب کنی',
      properties: ['openDirectory', 'multiSelections'],
    });
    if (r.canceled || !r.filePaths || !r.filePaths.length) return { ok: false, canceled: true };
    actLog(`music pickDirs: ${r.filePaths.length} folder(s)`);
    return { ok: true, dirs: r.filePaths };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
});

ipcMain.handle('music:scan', async (_e, dirs) => {
  const list = (Array.isArray(dirs) ? dirs : []).map((d) => String(d || '').trim()).filter((d) => path.isAbsolute(d));
  const out = [];
  const scanDir = async (dir, depth) => {
    if (depth > 4 || out.length >= 3000) return; /* عمق حداکثر ۴، سقف ۳۰۰۰ فایل */
    let entries = [];
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const ent of entries) {
      if (out.length >= 3000) return;
      if (ent.name.startsWith('.') || ent.name.startsWith('$')) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) { await scanDir(full, depth + 1); continue; }
      if (ent.isFile() && MUSIC_EXT_RE.test(ent.name)) {
        try {
          const st = await fs.promises.stat(full);
          out.push({ path: full, name: ent.name, size: st.size, mtime: st.mtimeMs });
        } catch (_) { /* فایل شاید همزمان حذف شده باشد */ }
      }
    }
  };
  for (const d of list) await scanDir(d, 0);
  out.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  return { ok: true, tracks: out, dirs: list };
});

ipcMain.handle('music:readHead', (_e, p, max) => {
  try {
    const f = String(p || '');
    if (!path.isAbsolute(f)) return { ok: false };
    /* v0.60 (B5) — قبلاً ۳MB اولِ «هر» مسیر مطلقی خوانده می‌شد؛ حالا فقط
       فایل موزیکِ داخل همان allowlist پوشه‌های ava-media:// مجاز است.
       ردشدن‌ها در activity.log ثبت می‌شوند. */
    if (!mediaDirAllowed(f)) {
      try { actLog('music:readHead DENIED (outside media allowlist): ' + f.slice(0, 120)); } catch (_) { /* noop */ }
      return { ok: false };
    }
    if (!MUSIC_EXT_RE.test(path.basename(f))) {
      try { actLog('music:readHead DENIED (not a music file): ' + f.slice(0, 120)); } catch (_) { /* noop */ }
      return { ok: false };
    }
    const st = fs.statSync(f);
    const n = Math.min(st.size, Math.max(64, Number(max) || 3 * 1024 * 1024 + 10));
    const fd = fs.openSync(f, 'r');
    try {
      const buf = Buffer.alloc(n);
      fs.readSync(fd, buf, 0, n, 0);
      return { ok: true, head: new Uint8Array(buf), size: st.size };
    } finally { fs.closeSync(fd); }
  } catch (_) { return { ok: false }; }
});

/* ---------- App lifecycle ---------- */
/* ============================================================
   v0.51 — Push-to-Talk قابل‌تنظیم (خواستهٔ کاربر: «کاربر بتونه یک دکمه
   push to talk بزاره… به محض فشردن صدا گرفته شه و نیازی نیس اسم اوا رو
   بگه… هر لحظه که دکمه رو ول کرد ضبط تموم شه… میتونه ترکیبی هم باشه»)
   • کلید/ترکیب دلخواه در تنظیمات (Electron accelerator string)
   • حالت hold: نگه‌داشتن = ضبط؛ رهاکردن = پایان + پردازش (تشخیص رهاشدن
     روی ویندوز با PowerShell + GetAsyncKeyState — بدون هیچ ماژول نیتیو)
   • حالت toggle: جایگزین (یک بار بزن شروع، دوباره بزن پایان)
   • هیچ فوکوس‌دزدی: دیگر win.show() وسط کار کاربر اجرا نمی‌شود
   ============================================================ */
const pttSt = {
  cfg: { enabled: true, combo: 'CommandOrControl+Shift+Space', mode: 'hold', fallback: 'CommandOrControl+Alt+Space' },
  /* v0.53 — معماری نگهبان پایدار: یک پروسهٔ PowerShell از بوت (نه با هر فشردن!)،
     لبهٔ down/up همهٔ VKهای ترکیب را می‌دهد. ریشه‌های خرابی 0.51/0.52 (لاگ کاربر:
     صفر ردِ ptt): spawn تازه در «هر فشردن» (استارت ۱-۳s + کامپایل Add-Type در هر بار)
     و صفر لاگ — خرابی کاملاً نامرئی بود. حالا هر مرحله لاگ دارد. */
  ok: false,
  win: null,
  watchChild: null,
  watchFile: '',
  watchTries: 0,
  watchReady: false,
  registered: '',
  fallbackReg: '',
};

function pttReadCfg() {
  try {
    const c = (loadedSettings() || {}).ptt || {};
    return {
      enabled: c.enabled !== false,
      combo: (typeof c.combo === 'string' && c.combo.trim()) ? c.combo.trim() : 'CommandOrControl+Shift+Space',
      mode: c.mode === 'toggle' ? 'toggle' : 'hold',
      fallback: (typeof c.fallback === 'string' && c.fallback.trim()) ? c.fallback.trim() : 'CommandOrControl+Alt+Space',
    };
  } catch (_) {
    return { enabled: true, combo: 'CommandOrControl+Shift+Space', mode: 'hold', fallback: 'CommandOrControl+Alt+Space' };
  }
}

/* accelerator → کدهای VK برای GetAsyncKeyState */
function pttComboVks(combo) {
  const KEYMAP = { control: 0x11, ctrl: 0x11, alt: 0x12, option: 0x12, altgr: 0xA5, shift: 0x10, space: 0x20, tab: 0x09, enter: 0x0D, return: 0x0D, backspace: 0x08, escape: 0x1B, esc: 0x1B, delete: 0x2E, del: 0x2E, insert: 0x2D, home: 0x24, end: 0x23, pageup: 0x21, pagedown: 0x22, up: 0x26, down: 0x28, left: 0x25, right: 0x27, plus: 0xBB, minus: 0xBD, comma: 0xBC, period: 0xBE, slash: 0xBF, backquote: 0xC0, '`': 0xC0, '[': 0xDB, ']': 0xDD, ';': 0xBA, "'": 0xDE, '\\': 0xDC, '=' : 0xBB };
  const out = [];
  for (const raw of String(combo || '').split('+')) {
    const k = raw.trim().toLowerCase();
    if (!k) continue;
    if (k === 'commandorcontrol') { out.push(0x11); continue; } /* ویندوز = Ctrl */
    if (k === 'command' || k === 'cmd' || k === 'super' || k === 'meta' || k === 'win') { out.push(0x5B); continue; }
    const fm = k.match(/^f(\d{1,2})$/);
    if (fm) { const n = parseInt(fm[1], 10); if (n >= 1 && n <= 24) { out.push(0x70 + n - 1); continue; } }
    if (KEYMAP[k]) { out.push(KEYMAP[k]); continue; }
    if (k.length === 1) { out.push(k.toUpperCase().charCodeAt(0)); continue; }
  }
  return [...new Set(out)];
}

/* v0.53 — نگهبان پایدار PTT: «یک» پروسهٔ PowerShell از بوت؛ Add-Type فقط یک‌بار
   کامپایل می‌شود (نسخهٔ قبل با هر فشردن spawn می‌کرد: استارت ۱-۳ ثانیه‌ای + ریسک).
   خروجی لبه‌ها: ready → آماده؛ down → همهٔ کلیدها پایین؛ up → یکی رها شد.
   مرگ پروسه → ری‌استارت خودکار با بک‌آف. هر مرحله لاگ صادقانه دارد. */
function pttWatcherEdge(line) {
  const win = pttSt.win;
  if (line === 'down') {
    actLog('ptt down (' + pttSt.cfg.combo + ')');
    try {
      if (!win || win.isDestroyed()) { actLog('ptt down: window gone — dropped'); return; }
      if (pttSt.cfg.mode === 'toggle') win.webContents.send('ava:toggle-listen', {});
      else win.webContents.send('ava:ptt-down', {});
    } catch (_) { /* noop */ }
    return;
  }
  if (line === 'up') {
    if (pttSt.cfg.mode === 'toggle') return; /* در toggle فقط لبهٔ پایین مهم است */
    actLog('ptt up (release)');
    try { sendUI('ava:ptt-up', { why: 'release' }); } catch (_) { /* noop */ }
  }
}
function pttStopHoldWatcher() {
  pttSt.watchReady = false;
  try { if (pttSt.watchChild && !pttSt.watchChild.killed) pttSt.watchChild.kill(); } catch (_) { /* noop */ }
  pttSt.watchChild = null;
  try { if (pttSt.watchFile) fs.unlinkSync(pttSt.watchFile); } catch (_) { /* noop */ }
  pttSt.watchFile = '';
}
function pttStartWatcher(vks) {
  pttStopHoldWatcher();
  if (process.platform !== 'win32') { actLog('ptt watcher unavailable: not win32'); return false; }
  if (!vks || !vks.length) { actLog('ptt watcher unavailable: empty combo'); return false; }
  try {
    const body = [
      "$ErrorActionPreference='Stop'",
      "$s=@\"",
      'using System;',
      'using System.Runtime.InteropServices;',
      'public class AvaKeys { [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int k); }',
      '"@',
      'Add-Type -TypeDefinition $s',
      '$keys=@(' + vks.join(',') + ')',
      '$prev=$false',
      /* v0.60 (B7) — اگر AVA با taskkill مرد، این watcher تا ابد زنده می‌ماند؛
         هر ~۵ ثانیه (۱۴۳ × ۳۵ms) بودنِ پدر چک می‌شود — نبود → exit */
      '$pp=' + Number(process.pid || 0),
      '$t=0',
      '[Console]::Out.WriteLine(\'ready\')',
      'while($true){',
      '  Start-Sleep -Milliseconds 35',
      '  $t++',
      '  if($t -ge 143){ $t=0; try{ Get-Process -Id $pp -ErrorAction Stop | Out-Null } catch { exit } }',
      '  $down=0',
      '  foreach($k in $keys){ if([AvaKeys]::GetAsyncKeyState($k) -band 0x8000){ $down++ } }',
      '  $all=($down -eq $keys.Count)',
      '  if($all -ne $prev){ $prev=$all; [Console]::Out.WriteLine($(if($all){\'down\'}else{\'up\'})) }',
      '}',
    ].join('\r\n');
    const file = path.join(os.tmpdir(), 'ava-ptt-watcher.ps1');
    fs.writeFileSync(file, body, 'utf8');
    pttSt.watchFile = file;
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file], { windowsHide: true });
    pttSt.watchChild = child;
    let buf = '';
    child.stdout.on('data', (d) => {
      buf += String(d || '');
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() || '';
      for (const ln of lines) {
        const s = ln.trim();
        if (s === 'ready') {
          pttSt.watchReady = true; pttSt.watchTries = 0;
          actLog('ptt watcher ready (Add-Type ok, polling 35ms): ' + pttSt.cfg.combo);
        } else if (s === 'down' || s === 'up') pttWatcherEdge(s);
      }
    });
    child.on('error', (e) => { /* spawn خودش شکست خورد */
      actLog('ptt watcher spawn FAILED: ' + String((e && e.message) || e).slice(0, 100));
      pttStopHoldWatcher();
    });
    child.on('exit', (code) => {
      const wasReady = pttSt.watchReady;
      clearTimeout(pttSt.restartTo);
      try { fs.unlinkSync(file); } catch (_) { /* noop */ }
      if (pttSt.watchFile === file) pttSt.watchFile = '';
      if (pttSt.watchChild === child) { pttSt.watchChild = null; pttSt.watchReady = false; }
      /* ری‌استارت خودکار — اگر وسط ضبط مرد، اول «up» صادقانه بفرست تا ضبط بی‌نهایت نماند */
      if (wasReady) { try { sendUI('ava:ptt-up', { why: 'watcher-died' }); } catch (_) { /* noop */ } }
      pttSt.watchTries++;
      if (pttSt.watchTries <= 3 || pttSt.watchTries % 10 === 0) actLog('ptt watcher exited (code=' + code + ') → restart #' + pttSt.watchTries);
      if (pttSt.cfg.enabled && !pttSt.registered && !pttSt.fallbackReg) {
        pttSt.restartTo = setTimeout(() => { try { if (pttSt.cfg.enabled && !pttSt.watchChild) pttStartWatcher(vks); } catch (_) { /* noop */ } }, Math.min(30000, 2000 * pttSt.watchTries));
      }
    });
    return true;
  } catch (e) {
    actLog('ptt watcher setup FAILED: ' + String((e && e.message) || e).slice(0, 100));
    pttStopHoldWatcher();
    return false;
  }
}

/* v0.53 — مسلح‌کردن PTT: اول نگهبان پایدار (لبهٔ down/up بدون بلعیدن کلید و
   بدون تداخل با میانبر داخلی گوش‌دادن)؛ اگر نشد → فالبکِ صادقانهٔ globalShortcut
   (فشردن = شروع، سقف ۳۰s). هر مسیر لاگ دارد تا خرابی دیگر نامرئی نباشد. */
function pttRegister(win) {
  pttStopHoldWatcher();
  try { if (pttSt.registered) globalShortcut.unregister(pttSt.registered); } catch (_) { /* noop */ }
  try { if (pttSt.fallbackReg) globalShortcut.unregister(pttSt.fallbackReg); } catch (_) { /* noop */ }
  pttSt.registered = '';
  pttSt.fallbackReg = '';
  pttSt.ok = false;
  pttSt.win = win || null;
  const cfg = pttReadCfg();
  pttSt.cfg = cfg;
  if (!cfg.enabled) { actLog('ptt: disabled in settings'); return false; }
  const vks = pttComboVks(cfg.combo);
  if (pttStartWatcher(vks)) {
    pttSt.ok = true;
    actLog('ptt armed: ' + cfg.combo + ' (mode=' + cfg.mode + ', persistent watcher)');
    return true;
  }
  /* فالبک: نگهبان ممکن نشد (غیر-ویندوز/spawn شکست) — globalShortcut قدیمی با سقف ۳۰s */
  const press = () => {
    try {
      const w = pttSt.win;
      if (!w || w.isDestroyed()) return;
      if (pttSt.cfg.mode === 'toggle') { w.webContents.send('ava:toggle-listen', {}); return; }
      actLog('ptt down (globalShortcut fallback)');
      w.webContents.send('ava:ptt-down', {});
      clearTimeout(pttSt.capTo);
      pttSt.capTo = setTimeout(() => { try { sendUI('ava:ptt-up', { why: 'cap' }); } catch (_) { /* noop */ } }, 30000);
    } catch (_) { /* noop */ }
  };
  let ok = false;
  try { ok = globalShortcut.register(cfg.combo, press); } catch (_) { ok = false; }
  if (ok) {
    pttSt.registered = cfg.combo;
    pttSt.ok = true;
    actLog('ptt armed (globalShortcut fallback — watcher unavailable): ' + cfg.combo + ' (mode=' + cfg.mode + ')');
    return true;
  }
  try { ok = globalShortcut.register(cfg.fallback, press); } catch (_) { ok = false; }
  if (ok) {
    pttSt.fallbackReg = cfg.fallback;
    pttSt.ok = true;
    actLog('ptt combo OCCUPIED (' + cfg.combo + ') → fallback registered: ' + cfg.fallback);
    return true;
  }
  actLog('ptt arm FAILED: ' + cfg.combo + ' (watcher unavailable + both shortcuts occupied)');
  return false;
}

ipcMain.handle('ptt:reconfig', (e) => {
  const win = e && e.sender ? BrowserWindow.fromWebContents(e.sender) : null;
  const ok = pttRegister(win || BrowserWindow.getAllWindows()[0]);
  return { ok, cfg: pttSt.cfg, registered: pttSt.registered || pttSt.fallbackReg };
});
ipcMain.handle('ptt:get', () => ({ cfg: pttSt.cfg, ok: !!pttSt.ok, watcher: !!pttSt.watchChild, ready: !!pttSt.watchReady, registered: pttSt.registered || pttSt.fallbackReg }));

app.whenReady().then(() => {
  actLog(`boot v${app.getVersion()} electron=${process.versions.electron} packaged=${app.isPackaged}`);
  /* v0.48 — مارکر بوت در JSONL + تایمر تله‌متری + بازپخش جلسهٔ قبل */
  try { logSessionMarker('boot', { electron: process.versions.electron, pid: process.pid }); } catch (_) { /* noop */ }
  /* v0.60 (A22) — بلوک خالیِ بی‌مصرف try{}catch(_){} که این‌جا بود حذف شد. */
  app.on('before-quit', () => { try { logSessionMarker('quit', { uptimeS: Math.round(process.uptime()) }); } catch (_) { /* noop */ } });
  /* v0.35 — تور ایمنی کرش: رندرر اگر مرد (GPU درایور/OOM وسط بازی) به‌جای
     پنجرهٔ خالیِ معلق، خودکار یک‌بار ری‌لود می‌شود و علت در لاگ می‌ماند؛
     پرامیس‌های رهاشده هم دیگر بی‌صدا نیستند — «گاهی اوقات کرش میکنه» دیگر
     بی‌اثر نمی‌ماند و ردّش در activity.log ثبت می‌شود */
  process.on('unhandledRejection', (reason) => {
    try { actLog('unhandledRejection: ' + String((reason && reason.stack) || reason).slice(0, 220)); } catch (_) { /* noop */ }
  });
  process.on('uncaughtException', (err) => {
    try { actLog('uncaughtException: ' + String((err && err.stack) || err).slice(0, 220)); } catch (_) { /* noop */ }
    try { logSessionMarker('crash', { m: String((err && err.message) || err).slice(0, 160) }); } catch (_) { /* noop */ } /* v0.48 */
  });
  app.on('render-process-gone', (_ev, wc, details) => {
    try { actLog('renderer gone: ' + JSON.stringify(details).slice(0, 160)); } catch (_) { /* noop */ }
    try {
      if (!wc || wc.isDestroyed() || !details || details.reason === 'clean-exit') return;
      /* v0.38.1 — فقط همان پنجره‌ای که مرد ریکاور می‌شود؛ قبلاً همیشه UI اصلی
         reload می‌شد (حتی وقتی PiP کرش کرده بود) */
      if (win && !win.isDestroyed() && wc === win.webContents) {
        win.webContents.reload();
      }
    } catch (_) { /* noop */ }
  });
  /* v0.24 — گزارش وضعیت دورزدن DNS در لاگ عملکرد */
  actLog('dns bypass: ' + (DNS_BOOT.off
    ? 'off (dnsBypass=false in ava-settings.json — explicit opt-out)'
    : DNS_BOOT.applied
      ? DNS_BOOT.count + ' hosts pinned' + (DNS_BOOT.cached ? ' (cache)' : ' via shekan/electro') + ' — web engine + cloud fetches bypass filtered system DNS'
      : 'unavailable — system DNS in use (shekan/electro unreachable)'));
  /* v0.43 — اسکن نرم‌افزارهای سیستم هنگام شروع (خواستهٔ کاربر: «یک اسکن بکنه
     اول نرم افزارای سیستمو … اگه چیزی رو خواست باز کنه دیگه اماده باشه»):
     ۶ ثانیه بعد از بوت، کش کهنه/خالی → اسکن پس‌زمینه (Start Menu + UWP + Steam)
     تا اولین «فلان رو باز کن» فوری و طبق نرم‌افزارهای واقعی کاربر جواب بدهد */
  setTimeout(() => { try { scanAllApps().catch(() => {}); } catch (_) { /* noop */ } }, 6000);
  /* سرو کردن رابط کاربری و مدل‌ها از ava://app + فایل‌های موزیک از ava-media:// */
  try { protocol.handle('ava', (req) => { try { console.log('AVA_REQ:' + req.url); } catch (_) {} return serveAvaFile(req.url); }); } catch (e) { console.error('ava protocol:', e); }
  try { protocol.handle('ava-media', (req) => serveMediaFile(req.url, req)); } catch (e) { console.error('ava-media protocol:', e); }

  setupMicPermission();
  createWindow();
  setupAutoUpdater();

  /* v0.61 — پیاده‌سازی ویدیوی شناور حذف شد؛ میانبر Ctrl+Shift+P دیگر
     PiP را باز نمی‌کند (فضای میانبر آزاد است). */

  /* v0.24 — سلف‌چک شبکه بعد از بالا آمدن پنجره (تأخیر کوتاه تا بوت سنگین نشود)
     v0.29.1 — + تشخیص عمیق: پراکسی سیستم + https واقعی به generativelanguage */
  try { setTimeout(netSelfCheck, 2500); } catch (_) { /* noop */ }
  try { setTimeout(netDeepDiag, 5000); } catch (_) { /* noop */ }

  // میانبر سراسری گوش دادن (Push-to-talk) + حالت بی‌دست
  try {
    /* v0.51 — PTT کامل: کلید قابل‌تنظیم (ترکیبی هم می‌شود) + حالت hold
       (نگه‌دار=ضبط، رهاکن=پایان) + بدون دزدیدن فوکوس (قبلاً win.show()
       وسط کارِ کاربر پنجرهٔ آوا را جلوی برنامهٔ فعال می‌کشید!)
       v0.38.1/v0.47 — ثبتِ ناموفق صادقانه لاگ + fallback chord + تلاش مجدد */
    const okPtt = pttRegister(win);
    const scFail = [];
    if (!okPtt) scFail.push(String((pttSt.cfg && pttSt.cfg.combo) || 'Ctrl+Shift+Space'));
    // میانبر سراسری حالت بی‌دست (گوش دائمی + کلمه بیدارباش)
    const okHf = globalShortcut.register('CommandOrControl+Alt+A', () => {
      if (win) {
        if (win.isMinimized()) win.restore();
        win.show();
        win.webContents.send('ava:toggle-handsfree');
      }
    });
    if (!okHf) scFail.push('Ctrl+Alt+A');
    if (scFail.length) {
      actLog('shortcut register FAILED: ' + scFail.join(', ') + ' (occupied by another app)');
      try { sendUI('ava:shortcut-failed', { combos: scFail }); } catch (_) { /* noop */ }
      const scRetry = setInterval(() => {
        try {
          const left = [];
          if (!pttSt.ok) left.push('ptt'); /* v0.53 — ok شامل مسیر watcher هم می‌شود */
          if (!globalShortcut.isRegistered('CommandOrControl+Alt+A')) left.push('hf');
          if (!left.length) { clearInterval(scRetry); actLog('shortcut retry: all shortcuts now registered'); return; }
          if (left.includes('ptt')) pttRegister(win);
          if (left.includes('hf')) {
            globalShortcut.register('CommandOrControl+Alt+A', () => {
              if (win) { if (win.isMinimized()) win.restore(); win.show(); win.webContents.send('ava:toggle-handsfree'); }
            });
          }
        } catch (_) { clearInterval(scRetry); }
      }, 60000);
    }
  } catch (e) {
    /* noop */
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  /* v0.35 — بیدارباش در مینیمایز/بازی: تایمر و صدا در پنجرهٔ مخفی/پوشیده
     هرگز throttle و suspend نمی‌شوند (سه سوییچ پایین قبل از ready هم ست شده‌اند)
     + powerSaveBlocker تا ویندوز Modern Standby میکروفون را نبلعد */
  let wakePsbId = 0;
  ipcMain.handle('wake:psb', (_e, on) => {
    try {
      if (on) {
        if (!powerSaveBlocker.isStarted(wakePsbId)) wakePsbId = powerSaveBlocker.start('prevent-app-suspension');
      } else if (powerSaveBlocker.isStarted(wakePsbId)) {
        powerSaveBlocker.stop(wakePsbId);
        wakePsbId = 0;
      }
      return { ok: true, active: powerSaveBlocker.isStarted(wakePsbId) };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err).slice(0, 120) };
    }
  });
});

app.on('window-all-closed', () => {
  app.quit(); // رفتار استاندارد ویندوز
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  try { pttStopHoldWatcher(); } catch (_) { /* noop */ } /* v0.51 — پروسهٔ PowerShell نگهبان PTT هم بسته شود */
});
