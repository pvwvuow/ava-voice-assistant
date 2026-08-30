/* جداسازی: آیا اصلاً یک ورکر ساده از ava:// لود می‌شود؟ */
const fs = require('fs');
const path = require('path');
const ROOT = '/home/z/my-project/download/ava-voice-assistant';
let src = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');

/* یک ورکر مینیمال اضافه کن */
fs.writeFileSync(path.join(ROOT, 'renderer', 'js', 'tiny.worker.js'), "self.onmessage = (e) => { self.postMessage({type:'tiny-ok', got: e.data}); };");

src += `

/* --- isolate hook --- */
setTimeout(async () => {
  try {
    if (!win) { console.log('DBG_FAIL no window'); app.exit(1); return; }
    win.webContents.on('console-message', (_e, level, msg, line, source) => {
      console.log('PC[' + level + '] ' + String(msg).slice(0, 200));
    });
    const PROBE = "new Promise((res) => { try { const w = new Worker('js/tiny.worker.js');" +
      " const t = setTimeout(() => res({timeout:true}), 8000);" +
      " w.onmessage = (e) => { clearTimeout(t); res(e.data); };" +
      " w.onerror = (e) => { clearTimeout(t); res({werr: e.message, file: e.filename, line: e.lineno, err: String(e.error)}); };" +
      " w.postMessage({hello:1}); } catch (e) { res({throw: String(e)}); } })";
    const info = await win.webContents.executeJavaScript(PROBE, true);
    console.log('TINY ' + JSON.stringify(info));
    app.exit(0);
  } catch (e) {
    console.log('DBG_ERR ' + (e && e.message));
    app.exit(1);
  }
}, 4000);
`;
fs.writeFileSync(path.join(ROOT, 'dbg_main3.js'), src);
console.log('dbg_main3.js written');
