/* اسکرین‌شات QA تم طلایی — بوت اپ زیر Xvfb، اعمال تم light+gold، عکس از صفحه */
'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1100, height: 760, show: false, frame: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  await win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  await win.webContents.executeJavaScript(
    `document.documentElement.setAttribute('data-theme','light');
     document.documentElement.setAttribute('data-gold','on');
     document.body.classList.remove('state-listening','state-processing');
     'ok'`, true);
  await new Promise((r) => setTimeout(r, 1200));
  const img = await win.webContents.capturePage();
  require('fs').writeFileSync(path.join(__dirname, 'qa-gold-idle.png'), img.toPNG());
  await win.webContents.executeJavaScript(`document.body.classList.add('state-listening'); 'ok'`, true);
  await new Promise((r) => setTimeout(r, 700));
  const img2 = await win.webContents.capturePage();
  require('fs').writeFileSync(path.join(__dirname, 'qa-gold-listening.png'), img2.toPNG());
  console.log('QA_SHOTS_DONE');
  app.exit(0);
}).catch((e) => { console.log('QA_FAIL ' + String(e && e.message).slice(0, 120)); app.exit(1); });
setTimeout(() => { console.log('QA_TIMEOUT'); app.exit(1); }, 20000);
