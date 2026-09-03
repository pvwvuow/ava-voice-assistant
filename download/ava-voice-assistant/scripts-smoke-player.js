/* اسموکِ پنجرهٔ پلیر آوا — صفحه باز می‌شود، iframe ست می‌شود، خطای کنسول ندارد */
'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');
let win = null;
let errs = [];
app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 640, height: 400, show: false, frame: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, autoplayPolicy: 'no-user-gesture-required' },
  });
  win.webContents.on('console-message', (_e, level, msg) => { if (level >= 3) errs.push(String(msg).slice(0, 160)); });
  win.loadFile(path.join(__dirname, 'renderer', 'ava-player.html'), { query: { v: 'dQw4w9WgXcQ', t: 'تست', start: '30' } });
  win.webContents.once('did-finish-load', async () => {
    try {
      const r = await win.webContents.executeJavaScript(`(function(){
        const f = document.getElementById('frame');
        return {
          src: (f && f.src || '').slice(0, 90),
          hasSet: typeof window.__avaSetTitle === 'function',
          title: document.title,
          bar: !!document.getElementById('bar'),
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
