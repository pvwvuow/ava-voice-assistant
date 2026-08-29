/* تست دود الکترون برای آوا v0.8 — پروتکل ava:// + صفحه‌های جدید + شروع تایپ صوتی */
const { app, BrowserWindow, protocol, session } = require('electron');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm', '.onnx': 'application/octet-stream',
  '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
};
protocol.registerSchemesAsPrivileged([
  { scheme: 'ava', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

app.whenReady().then(async () => {
  const root = __dirname;
  try {
    protocol.handle('ava', (req) => {
      const u = new URL(req.url);
      const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '');
      const file = path.normalize(path.join(root, rel || 'renderer/index.html'));
      if (!file.startsWith(root)) return new Response('forbidden', { status: 403 });
      const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      const headers = { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' };
      if (file.endsWith('index.html')) {
        headers['Cross-Origin-Opener-Policy'] = 'same-origin';
        headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
      }
      return new Response(fs.readFileSync(file), { status: 200, headers });
    });
  } catch (e) { console.error('proto:', e); }

  const allow = ['media', 'audioCapture', 'notifications', 'fullscreen', 'clipboard-sanitized-write'];
  session.defaultSession.setPermissionRequestHandler((_wc, p, cb) => cb(allow.includes(p)));
  session.defaultSession.setPermissionCheckHandler((_wc, p) => allow.includes(p));

  const win = new BrowserWindow({
    width: 800, height: 640, show: false,
    webPreferences: { preload: path.join(root, 'preload.js'), contextIsolation: true, webviewTag: true },
  });
  const errors = [];
  win.webContents.on('console-message', (_e, level, msg) => { if (level >= 2) errors.push(String(msg).slice(0, 240)); });
  try {
    await win.loadURL('ava://app/renderer/index.html');
    console.log('LOAD_OK');
  } catch (e) {
    console.log('LOAD_FAIL', e && e.message);
    app.exit(1);
    return;
  }
  await new Promise((r) => setTimeout(r, 9000));
  const info = await win.webContents.executeJavaScript(`({
    coi: window.crossOriginIsolated === true,
    bridge: !!(window.ava && window.ava.system && window.ava.system.weather),
    dnsBridge: !!(window.ava && window.ava.dns && window.ava.dns.apply && window.ava.dns.reset && window.ava.dns.current),
    typeText: !!(window.ava && window.ava.system && window.ava.system.typeText),
    dictPage: !!document.querySelector('#dictPage'),
    dnsPage: !!document.querySelector('#dnsPage'),
    optSttQuality: !!document.querySelector('#optSttQuality'),
    optWebFirst: !!document.querySelector('#optWebFirst'),
    tcAdd: !!document.querySelector('#tcAdd'),
    dnsSaveBtn: !!document.querySelector('#dnsSaveBtn'),
    btnDnsReset: !!document.querySelector('#btnDnsReset'),
    btnDict: !!document.querySelector('#btnDict'),
    dictBox: !!document.querySelector('#dictBox'),
    ver: (document.querySelector('.sb-item:last-child') || {}).textContent || '',
  })`, true);
  console.log('INFO ' + JSON.stringify(info));

  /* فانکشنال: کلیک روی چیپ «آوا تایپ» → صفحه تایپ باز شود و تاگل عوض شود */
  const func = await win.webContents.executeJavaScript(`(async () => {
    const chip = document.querySelector('.chip[data-cmd="آوا تایپ"]');
    if (!chip) return { chip: false };
    chip.click();
    await new Promise((r) => setTimeout(r, 900));
    const dictOpen = !document.querySelector('#dictPage').hidden;
    const toggleTxt = (document.querySelector('#btnDictToggle span') || {}).textContent || '';
    const status = (document.querySelector('#dictStatus') || {}).textContent || '';
    /* حالا شبیه‌سازی پایان: فرمان «آوا تموم» از کادر فرمان */
    const ci = document.querySelector('#cmdInput');
    ci.value = 'آوا تموم';
    document.querySelector('#cmdBar').dispatchEvent(new Event('submit', { cancelable: true }));
    await new Promise((r) => setTimeout(r, 700));
    const toggleTxt2 = (document.querySelector('#btnDictToggle span') || {}).textContent || '';
    return { chip: true, dictOpen, toggleTxt, status, toggleTxt2 };
  })()`, true);
  console.log('FUNC ' + JSON.stringify(func));
  console.log('CONSOLE_ERRORS ' + JSON.stringify(errors.slice(0, 8)));
  const ok = info.coi && info.bridge && info.dnsBridge && info.typeText && info.dictPage && info.dnsPage
    && info.optSttQuality && info.optWebFirst && info.tcAdd && info.dnsSaveBtn && info.btnDict && info.dictBox
    && func.dictOpen;
  console.log(ok ? 'SMOKE_OK' : 'SMOKE_FAIL');
  app.exit(ok ? 0 : 1);
});
