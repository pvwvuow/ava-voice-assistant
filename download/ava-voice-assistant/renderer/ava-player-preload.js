/* ============================================================
   ava-player-preload.js (v0.84) — پلِ امنِ پنجرهٔ پلیر آوا
   ────────────────────────────────────────────────────────────
   صفحهٔ پلیر (ava-player.html) sandbox + contextIsolation دارد؛
   هر کاری که باید «بیرونِ» صفحه انجام شود (فول‌اسکرین پنجره،
   همیشه‌روانه، PIP، اندازه، شفافیت، بستن، مرورگر، پلیر سیستم)
   از همین پل با فهرست سفیدِ بسته می‌گذرد — هیچ API خامی فاش
   نمی‌شود. گزینه‌های درون‌صفحه‌ای (پخش/سیک/سرعت/ولوم) با
   postMessage مستقیم به iframe یوتیوب می‌روند و از این پل رد
   نمی‌شوند.
   ============================================================ */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('avaPlayer', {
  /* عملیات پنجره — op: fullscreen|top|pip|unpip|size|opacity|close|browser */
  win: (op, arg) => ipcRenderer.invoke('aplayer:win', { op, arg }),
  /* پخش همین ویدیو در پلیر سیستم (yt-dlp → پت‌پلیر/VLC/…) */
  sys: () => ipcRenderer.invoke('aplayer:sys'),
  /* همگام‌سازی وضعیت فول‌اسکرین (main → صفحه، آیکون ⛶ درست بماند) */
  onFs: (h) => { ipcRenderer.on('aplayer:fs', (_e, v) => { try { h(v); } catch (_) { /* noop */ } }); },
});
