/* ============================================================
   ava-player-preload.js (v0.85) — پلِ امنِ پنجرهٔ پلیر آوا
   ────────────────────────────────────────────────────────────
   صفحهٔ پلیر (ava-player.html) sandbox + contextIsolation دارد؛
   هر کاری که باید «بیرونِ» صفحه انجام شود از همین پل با فهرستِ
   سفیدِ بسته می‌گذرد — هیچ API خامی فاش نمی‌شود.
   پل‌ها: win (عملیات پنجره) / sys (پلیر سیستم) / stream (تعویض
   کیفیت و استریمِ تازه) / meta (بازیابی وضعیت بعد از ریلود) /
   onNavigate (ناوبری درجا — ویدیوی نو در همین پنجره) / onFs.
   ============================================================ */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('avaPlayer', {
  /* عملیات پنجره — op: fullscreen|top|pip|unpip|size|maximize|minimize|opacity|monitor|shot|copyurl|browser|close */
  win: (op, arg) => ipcRenderer.invoke('aplayer:win', { op, arg }),
  /* پخش همین ویدیو در پلیر سیستم (yt-dlp → پت‌پلیر/VLC/…) */
  sys: () => ipcRenderer.invoke('aplayer:sys'),
  /* استریمِ تازه / تعویض کیفیت ({ quality: 'best' | '360' }) */
  stream: (opts) => ipcRenderer.invoke('aplayer:stream', opts || {}),
  /* وضعیتِ ویدیوی این پنجره (بعد از کرش/ریلود هم بازیابی می‌شود) */
  meta: () => ipcRenderer.invoke('aplayer:meta'),
  /* لاگِ صفحه → main (دیباگِ میدانی) */
  log: (line) => { try { ipcRenderer.send('aplayer:log', String(line || '').slice(0, 300)); } catch (_) { /* noop */ } },
  /* ناوبری درجا: ویدیوی نو در همین پنجره (بدون بستن/بازکردن) */
  onNavigate: (h) => { ipcRenderer.on('aplayer:navigate', (_e, p) => { try { h(p); } catch (_) { /* noop */ } }); },
  /* همگام‌سازی وضعیت فول‌اسکرین (main → صفحه، آیکون ⛶ درست بماند) */
  onFs: (h) => { ipcRenderer.on('aplayer:fs', (_e, v) => { try { h(v); } catch (_) { /* noop */ } }); },
});
