/* دیباگ importScripts داخل Blob-Worker در ava:// */
const fs = require('fs');
let src = fs.readFileSync('/home/z/my-project/download/ava-voice-assistant/main.js', 'utf8');
src += `

/* --- debug hook --- */
const DBG_CODE = [
  "const out = {};",
  "self.onmessage = async () => {",
  "  try { const r = await fetch('/renderer/vendor/transformers.min.js'); out.head = r.status + ':' + (r.headers.get('content-type')||'') + ':' + (await r.text()).length; } catch (e) { out.head = 'ERR ' + e; }",
  "  try { importScripts('/renderer/vendor/transformers.min.js'); out.abs = 'OK typeof=' + (typeof transformers); } catch (e) { out.abs = 'ERR ' + (e && e.message || e); }",
  "  postMessage(out);",
  "};",
].join('\\n');
const DBG = "new Promise((res) => { try { const b = new Blob([" + JSON.stringify(DBG_CODE) + "], {type:'text/javascript'});" +
  " const u = URL.createObjectURL(b); const w = new Worker(u);" +
  " const t = setTimeout(() => res({timeout:true}), 20000);" +
  " w.onmessage = (e) => { clearTimeout(t); res(e.data); };" +
  " w.onerror = (e) => { clearTimeout(t); res({werr: String(e.message || e)}); };" +
  " w.postMessage('go'); } catch (e) { res({throw: String(e)}); } })";
setTimeout(async () => {
  try {
    if (!win) { console.log('DBG_FAIL no window'); app.exit(1); return; }
    const info = await win.webContents.executeJavaScript(DBG, true);
    console.log('DBG ' + JSON.stringify(info));
    app.exit(0);
  } catch (e) {
    console.log('DBG_ERR ' + (e && e.message));
    app.exit(1);
  }
}, 4000);
`;
fs.writeFileSync('/home/z/my-project/download/ava-voice-assistant/dbg_main.js', src);
console.log('dbg_main.js written');
