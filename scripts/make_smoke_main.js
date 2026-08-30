/* تست دود واقعی: main.js کامل + بررسی وضعیت واقعی ASR اپ (بعد از prewarm) */
const fs = require('fs');
let src = fs.readFileSync('/home/z/my-project/download/ava-voice-assistant/main.js', 'utf8');
src += `

/* --- smoke hook v3: وضعیت واقعی اپ --- */
const SMOKE_PROBE = "({url:location.href,coi:window.crossOriginIsolated===true," +
  "bridge:!!(window.ava&&window.ava.system&&window.ava.system.weather)," +
  "asrReady:!!window.__avaAsrReady,asrBroken:!!window.__avaAsrBroken," +
  "engine:(document.querySelector('#sbEngine')||{}).textContent||''," +
  "handsFreeBtn:!!document.querySelector('#btnHandsFree')," +
  "historyPage:!!document.querySelector('#historyPage')})";
setTimeout(async () => {
  try {
    if (!win) { console.log('SMOKE_FAIL no window'); app.exit(1); return; }
    win.webContents.on('console-message', (_e, level, msg, line, source) => {
      const m = String(msg);
      if (m.indexOf('AVA ASR') !== -1 || level >= 3) console.log('PC[' + level + '] ' + m.slice(0, 250));
    });
    let info = null;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      info = await win.webContents.executeJavaScript(SMOKE_PROBE, true);
      console.log('TRY' + i + ' ' + JSON.stringify(info));
      if (info.asrReady || info.asrBroken) break;
    }
    const ok = info.coi && info.bridge && info.asrReady && !info.asrBroken;
    console.log(ok ? 'SMOKE_OK' : 'SMOKE_FAIL');
    app.exit(ok ? 0 : 1);
  } catch (e) {
    console.log('SMOKE_ERR ' + (e && e.message));
    app.exit(1);
  }
}, 3000);
`;
fs.writeFileSync('/home/z/my-project/download/ava-voice-assistant/smoke_main.js', src);
console.log('smoke_main.js written');
