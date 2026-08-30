/* تست دود الکترون برای آوا v0.7
   — بارگذاری ava://app + crossOriginIsolated + آماده شدن ورکر ASR آفلاین */
const { app, BrowserWindow } = require('electron');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 800, height: 600, show: false,
    webPreferences: { preload: require('path').join(__dirname, 'preload.js'), contextIsolation: true, webviewTag: true },
  });
  const errors = [];
  win.webContents.on('console-message', (_e, level, msg) => { if (level >= 2) errors.push(String(msg).slice(0, 200)); });
  try {
    await win.loadURL('ava://app/renderer/index.html');
    console.log('LOAD_OK');
  } catch (e) {
    console.log('LOAD_FAIL', e && e.message);
    app.exit(1);
    return;
  }
  await new Promise((r) => setTimeout(r, 12000)); /* فرصت پیش‌بارگذاری مدل (بعد از ۲ ثانیه شروع می‌شود) */
  const info = await win.webContents.executeJavaScript(`({
    url: location.href,
    coi: window.crossOriginIsolated === true,
    bridge: !!(window.ava && window.ava.system && window.ava.system.weather),
    settings: !!(window.ava && window.ava.settings && window.ava.settings.load),
    asrReady: !!window.__avaAsrReady,
    asrBroken: !!window.__avaAsrBroken,
    engine: (document.querySelector('#sbEngine') || {}).textContent || '',
    handsFreeBtn: !!document.querySelector('#btnHandsFree'),
    historyPage: !!document.querySelector('#historyPage'),
  })`, true);
  console.log('INFO ' + JSON.stringify(info));
  console.log('CONSOLE_ERRORS ' + JSON.stringify(errors.slice(0, 6)));
  const ok = info.coi && info.bridge && info.asrReady && !info.asrBroken;
  console.log(ok ? 'SMOKE_OK' : 'SMOKE_FAIL');
  app.exit(ok ? 0 : 1);
});
