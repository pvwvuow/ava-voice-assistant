/* بایسکت: کل setup واقعی main.js + پنجره مینیمال */
const fs = require('fs');
let src = fs.readFileSync('/home/z/my-project/download/ava-voice-assistant/main.js', 'utf8');

/* تزریق لاگ به هندلر + جایگزینی createWindow با نسخه مینیمال */
src = src.replace(
  "app.whenReady().then(() => {\n  /* سرو کردن رابط کاربری و مدل‌ها از ava://app */",
  "app.whenReady().then(() => {\n  /* سرو کردن رابط کاربری و مدل‌ها از ava://app */\n  console.log('READY_REACHED');"
);
src = src.replace(
  'try { protocol.handle(\'ava\', (req) => { try { console.log(\'AVA_REQ:\' + req.url); } catch (_) {} return serveAvaFile(req.url); }); } catch (e) { console.error(\'ava protocol:\', e); }',
  "try { protocol.handle('ava', (req) => { console.log('AVA_REQ:' + req.url); return serveAvaFile(req.url); }); } catch (e) { console.error('ava protocol FAILED:', e); }"
);
src = src.replace(/win\.loadURL\('ava:\/\/app\/renderer\/index\.html'\);/, "win.loadURL('ava://app/renderer/index.html').then(() => console.log('WIN_LOAD_OK')).catch(e => console.log('WIN_LOAD_FAIL', e.message));");
src = src.replace('win.once(\'ready-to-show\', () => win.show());', '/* skip show */');
src = src.replace('setupAutoUpdater();', '/* setupAutoUpdater skipped */');
src = src.replace(/globalShortcut\.register\('CommandOrControl\+Alt[\s\S]*?\}\);/, '/* alt shortcut skipped */');

fs.writeFileSync('/home/z/my-project/download/ava-voice-assistant/bisect_test.js', src);
console.log('bisect_test.js written');
