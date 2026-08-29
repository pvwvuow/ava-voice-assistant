/* دیباگ عمیق‌تر: ErrorEvent کامل + کنسول صفحه */
const fs = require('fs');
let src = fs.readFileSync('/home/z/my-project/download/ava-voice-assistant/main.js', 'utf8');
src += `

/* --- debug hook v2 --- */
setTimeout(async () => {
  try {
    if (!win) { console.log('DBG_FAIL no window'); app.exit(1); return; }
    win.webContents.on('console-message', (_e, level, msg, line, source) => {
      console.log('PAGE_CONSOLE [' + level + '] ' + String(source).slice(0, 60) + ':' + line + ' ' + String(msg).slice(0, 220));
    });
    const PROBE = "new Promise((res) => { try { const w = new Worker('js/asr.worker.js');" +
      " const t = setTimeout(() => res({timeout:true}), 45000);" +
      " w.onmessage = (e) => { clearTimeout(t); res(e.data); };" +
      " w.onerror = (e) => { clearTimeout(t); res({werr: e.message, file: e.filename, line: e.lineno, stack: e.error && e.error.stack ? String(e.error.stack).slice(0,400) : null}); };" +
      " w.postMessage({type:'load'}); } catch (e) { res({throw: String(e)}); } })";
    const info = await win.webContents.executeJavaScript(PROBE, true);
    console.log('WORKER ' + JSON.stringify(info));
    app.exit(0);
  } catch (e) {
    console.log('DBG_ERR ' + (e && e.message));
    app.exit(1);
  }
}, 4000);
`;
fs.writeFileSync('/home/z/my-project/download/ava-voice-assistant/dbg_main2.js', src);
console.log('dbg_main2.js written');
