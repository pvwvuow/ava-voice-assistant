'use strict';
/* ============================================================
   AVA v0.37 — تست بوت واقعی پنجرهٔ PiP (Electron + Xvfb)
   • init واقعی مدیر پنجره → showPiP → صفحهٔ pip.html بالا بیاید
   • pipHost داخل صفحه موجود باشد + لوگو + المان‌های کنترل
   • move/resize/opacity/click-through/hide بدون خطا اجرا شوند
   ============================================================ */
const path = require('path');
const fs = require('fs');
const { app, protocol } = require('electron');
const pip = require('./pipWindowManager');

/* پروتکل ava:// باید قبل از ready ثبت شود (همان امتیازهای main.js) */
protocol.registerSchemesAsPrivileged([
  { scheme: 'ava', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

const PIP_MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.css': 'text/css; charset=utf-8' };

function serveAva(reqUrl) {
  try {
    const u = new URL(reqUrl);
    const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '');
    const file = path.normalize(path.join(__dirname, rel || 'renderer/index.html'));
    if (!file.startsWith(__dirname)) return new Response('forbidden', { status: 403 });
    const data = fs.readFileSync(file);
    return new Response(data, { status: 200, headers: { 'Content-Type': PIP_MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' } });
  } catch (_) {
    return new Response('not found', { status: 404 });
  }
}

let pageChecked = false;

app.whenReady().then(() => {
  try {
    protocol.handle('ava', (req) => serveAva(req.url));

    /* خطاهای کنسول صفحهٔ PiP را بشناسیم */
    app.on('web-contents-created', (_e, wc) => {
      wc.on('console-message', (_ev, level, msg) => {
        if (level >= 3) console.log('PIP-PAGE-ERR:' + String(msg).slice(0, 200));
      });
      wc.on('did-finish-load', () => {
        if (!String(wc.getURL() || '').includes('pip.html')) return;
        setTimeout(() => {
          wc.executeJavaScript('JSON.stringify({host: !!window.pipHost, root: !!document.getElementById("root"), logo: !!document.querySelector(\'img[src="assets/ava-logo.png"]\'), bar: !!document.getElementById("bar"), empty: !document.getElementById("empty").classList.contains("hidden")})')
            .then((r) => { pageChecked = true; console.log('PIP-PAGE-OK:' + r); })
            .catch((e) => console.log('PIP-PAGE-CHECK-ERR:' + e.message));
        }, 800);
      });
    });

    pip.init({ statePath: path.join(__dirname, '.tmp-pip-state.json') });
    pip.showPiP({ kind: 'youtube', videoId: 'dQw4w9WgXcQ', start: 42 });

    setTimeout(() => {
      try {
        const st1 = pip.getState();
        pip.movePiP('top-left');
        pip.resizePiP('large');
        pip.setPiPOpacity(0.5);
        pip.setClickThrough(true);
        const st2 = pip.getState();
        console.log('PIP-TEST-STATE:' + JSON.stringify({ open1: st1.open, open2: st2.open, size: st2.size, pos: st2.position, op: st2.opacity, ct: st2.clickThrough }));
        pip.setClickThrough(false);
        pip.hidePiP();
        console.log('PIP-TEST-HIDDEN:open=' + pip.getState().open);
        setTimeout(() => {
          console.log('PIP-TEST-PAGE:' + (pageChecked ? 'checked' : 'NOT-checked'));
          app.exit(0);
        }, 300);
      } catch (e) {
        console.log('PIP-TEST-ACT-ERR:' + e.message);
        app.exit(1);
      }
    }, 3200);
  } catch (e) {
    console.log('PIP-TEST-ERR:' + (e && e.message));
    app.exit(1);
  }
});
