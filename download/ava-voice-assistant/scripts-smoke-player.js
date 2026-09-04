/* اسموکِ پنجرهٔ پلیر آوا (v0.85) — صفحهٔ نو با <video> مستقیم + iframe embed:
   صفحه باز می‌شود، هر دو لایهٔ پخش هست‌اند، پل preload (win/sys/stream/meta)
   وصل است، کنترل‌ها و منو کامل‌اند، __avaCtl کار می‌کند، خطای کنسول ندارد */
'use strict';
const { app, BrowserWindow, session } = require('electron');
const path = require('path');
let win = null;
let errs = [];
app.whenReady().then(() => {
  /* همان وب‌پرفرنسِ تولیدیِ ماژول — پل preload + سشن aplayer + تزریق Referer */
  try {
    const ses = session.fromPartition('aplayer');
    ses.webRequest.onBeforeSendHeaders(
      { urls: ['*://*.youtube.com/*', '*://*.youtube-nocookie.com/*'] },
      (det, cb) => { const h = det.requestHeaders || {}; h['Referer'] = 'https://www.youtube.com/'; cb({ requestHeaders: h }); }
    );
  } catch (e) { errs.push('ref-inject: ' + String(e && e.message).slice(0, 80)); }
  win = new BrowserWindow({
    width: 640, height: 400, show: false, frame: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, autoplayPolicy: 'no-user-gesture-required',
      preload: path.join(__dirname, 'renderer', 'ava-player-preload.js'), partition: 'aplayer' },
  });
  win.webContents.on('console-message', (_e, level, msg) => { if (level >= 3) errs.push(String(msg).slice(0, 160)); });
  /* engine=embed در اسموک — بدون yt-dlp، بدون نیاز به شبکه برای موتور مستقیم */
  win.loadFile(path.join(__dirname, 'renderer', 'ava-player.html'), { query: { v: 'dQw4w9WgXcQ', t: 'تست', start: '30', engine: 'embed' } });
  win.webContents.once('did-finish-load', async () => {
    try {
      const r = await win.webContents.executeJavaScript(`(function(){
        const f = document.getElementById('frame');
        return {
          src: (f && f.src || '').slice(0, 110),
          refpol: (f && f.getAttribute('referrerpolicy')) || '',
          hasVideo: !!document.getElementById('video'),
          engEmbed: document.body.classList.contains('eng-embed'),
          engBadge: (document.getElementById('eng') || {}).textContent || '',
          hasSet: typeof window.__avaSetTitle === 'function',
          hasCtl: typeof window.__avaCtl === 'function',
          hasBridge: !!(window.avaPlayer && typeof window.avaPlayer.win === 'function' && typeof window.avaPlayer.sys === 'function'
            && typeof window.avaPlayer.stream === 'function' && typeof window.avaPlayer.meta === 'function'
            && typeof window.avaPlayer.onNavigate === 'function' && typeof window.avaPlayer.onFs === 'function'),
          title: document.title,
          bar: !!document.getElementById('bar'),
          ctl: !!document.getElementById('ctl'),
          seek: !!document.getElementById('seek'),
          vol: !!document.getElementById('vol'),
          qual: !!document.getElementById('qual'),
          opts: !!document.getElementById('opts'),
          help: !!document.getElementById('help'),
          panel: !!document.getElementById('panel'),
          toast: !!document.getElementById('toast'),
          monRow: !!document.getElementById('monRow'),
          btns: ['btnPlay','btnB10','btnF10','btnMute','btnLoop','btnPip','btnTop','btnFs','btnMore','btnBrowser','btnReload','btnSys','btnCopy','btnShot'].filter(function(id){ return !document.getElementById(id); }).length,
          ctlStatus: (function(){ try { return window.__avaCtl({ a: 'status' }); } catch (e) { return { err: String(e).slice(0,60) }; } })(),
          veil: !document.getElementById('veil').classList.contains('off'),
        };
      })()`, true);
      console.log('PLAYER_SMOKE ' + JSON.stringify(r));
    } catch (e) { console.log('PLAYER_SMOKE exec-fail: ' + String(e && e.message).slice(0, 120)); }
    setTimeout(() => {
      console.log(errs.length ? 'PLAYER_ERRORS: ' + errs.join(' | ') : 'PLAYER_NO_CONSOLE_ERRORS');
      console.log('PLAYER_SMOKE_DONE');
      app.exit(0);
    }, 1200);
  });
  setTimeout(() => { console.log('PLAYER_SMOKE_TIMEOUT'); app.exit(1); }, 12000);
});
