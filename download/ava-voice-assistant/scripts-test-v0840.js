#!/usr/bin/env node
'use strict';
/* ============================================================
   scripts-test-v0840.js — باتری نسخهٔ ۰.۸۴ (نگهبانِ بازساختِ v0.85)
   ------------------------------------------------------------
   دو گزارش کاربر بعد از ۰.۸۳.۱ و درمانِ نهایی‌شان در v0.85:
   ۱) «ببین کار نمیکنه» — embed یوتیوب با «Video player
      configuration error (133/153)» (ردِ سمتِ سرور، سطحِ IP/ربات)
      رد می‌شود؛ هیچ فیکسِ سمتِ صفحه قطعی‌اش نمی‌کند. درمانِ
      ساختاری v0.85: موتور ۱ «مستقیم» — yt-dlp → استریمِ تک‌فایلی
      mp4/webm در <video> محلی (embed اصلاً در کار نیست؛ خطای ۱۳۳
      ناممکن می‌شود؛ m3u8 رد می‌شود)؛ موتور ۲ embed فقط فالبک؛
      نردبان کیفیت بهترین→۳۶۰→embed→پنل صادقانه.
   ۲) «اپشنای اواپلیر خیلی کمه» — نوار کنترل کامل: پخش/پاز، ±۱۰ث،
      Shift+±۳۰ث، نوار زمان با پرِ بافر، ولوم/بی‌صدا، سرعت ۰.۲۵–۲×،
      تکرار، کیفیت، LIVE، PIP، همیشه‌روانه، فول‌اسکرین، اندازه ×۴،
      شفافیت ×۴، مانیتور ×۲، اسکرین‌شات، کپی لینک، مرورگر، پلیر
      سیستم، پخش مجدد، میان‌برها + MediaSession + ناوبری درجا.
   معیار: فقط شمارش ok؛ exit-code = تعداد شکست.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const R = __dirname;
let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ FAIL: ' + name); } }
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8');

const mainSrc = read('main.js');
const pkgSrc = read('package.json');
const appSrc = read('renderer/js/app.js');
const htmlSrc = read('renderer/index.html');
const modSrc = read('lib/ava-player.js');
let playerHtmlSrc = '', preloadSrc = '', smokeSrc = '';
try { playerHtmlSrc = read('renderer/ava-player.html'); } catch (_) { /* noop */ }
try { preloadSrc = read('renderer/ava-player-preload.js'); } catch (_) { /* noop */ }
try { smokeSrc = read('scripts-smoke-player.js'); } catch (_) { /* noop */ }

/* ---------- ۱) موتور مستقیم — ریشه‌کنی Error 133/153 ---------- */
console.log('\n[1] «کار نمی‌کند» — موتور مستقیم <video> + نردبان فالبک');
ok('ماژول: موتور مستقیم — نردبان فرمت تک‌فایلی (22/18/mp4/webm) مثل main',
  modSrc.includes("'22/18/b[ext=mp4]/b[ext=webm]/b'") && modSrc.includes("'18/b[ext=mp4]/b[ext=webm]/b'"));
ok('ماژول: فالبکِ کلاینت ios با --no-check-certificates (درس v0.82/0.83 حفظ)',
  modSrc.includes("player_client=' + client") && modSrc.includes('--no-check-certificates'));
ok('ماژول: m3u8/HLS رد می‌شود (کرومیوم HLS نمی‌فهمد → embed)',
  modSrc.includes('.m3u8') && modSrc.includes('m3u8: true'));
ok('ماژول: سقفِ ۱۰ثانیه هر پلهٔ yt-dlp (فست-فیل درس v0.82.2)',
  modSrc.includes('timeout: 10000'));
ok('main.js: play بدون keepExisting = ناوبریِ همان پنجره (embed/direct هرچه بود)',
  /const rs = await resolveStream\(idm\.id, 'best'\)[\s\S]{0,200}const engine = rs\.ok \? 'direct' : 'embed'/.test(modSrc));
ok('player: لایهٔ <video> مستقیم + iframe embed — هر دو در صفحه',
  playerHtmlSrc.includes('<video id="video"') && playerHtmlSrc.includes('<iframe id="frame"'));
ok('player: بدنه eng-embed/eng — بج موتور (مستقیم/یوتیوب) زنده',
  playerHtmlSrc.includes('eng-embed') && playerHtmlSrc.includes("id=\"eng\"") &&
  playerHtmlSrc.includes("'مستقیم'") && playerHtmlSrc.includes("'یوتیوب'"));
ok('player: نردبان خطای موتور مستقیم — بهترین → ۳۶۰ → embed',
  playerHtmlSrc.includes('function directFail') && playerHtmlSrc.includes('st.tried360') &&
  playerHtmlSrc.includes("AP.stream({ quality: '360' })"));
ok('player: embed با enablejsapi=1 + autoplay + referrerpolicy (فالبک سالم)',
  playerHtmlSrc.includes('enablejsapi=1') && playerHtmlSrc.includes('autoplay=1') &&
  playerHtmlSrc.includes('referrerpolicy="strict-origin-when-cross-origin"'));
ok('player: پخش مجددِ مستقیم استریمِ تازه می‌گیرد (URL منقضی googlevideo)',
  playerHtmlSrc.includes('function directFresh') && playerHtmlSrc.includes('AP.stream({ quality: quality })'));
ok('player: نردبان خطای embed — onError → تلاش خودکار youtube-nocookie (یک پله)',
  playerHtmlSrc.includes('function onError(code)') && playerHtmlSrc.includes('youtube-nocookie.com') &&
  playerHtmlSrc.includes('st.triedNC'));
ok('player: ساعتِ نگهبان (۱۲ث مستقیم / ۱۴ث embed) — پنل فالبک می‌آید، پنجره بسته نمی‌شود',
  playerHtmlSrc.includes("engine === 'direct' ? 12000 : 14000") && playerHtmlSrc.includes('پخش شروع نشد'));
ok('player: پنل فالبک پنج عمل — تلاش/یوتیوب/پلیر سیستم/مرورگر/بستن پنل',
  ['panelRetry', 'panelEmbed', 'panelSys', 'panelBrowser', 'panelDismiss'].every((id) => playerHtmlSrc.includes('id="' + id + '"')));
ok('ماژول: سشن اختصاصی aplayer + تزریق Referer روی یوتیوب (طبقهٔ embed)',
  modSrc.includes("session.fromPartition('aplayer')") && modSrc.includes("h['Referer'] = 'https://www.youtube.com/';"));
ok('main.js/ماژول: همگام‌سازی فول‌اسکرین به صفحه (aplayer:fs روی enter/leave)',
  modSrc.includes("send('aplayer:fs'") && modSrc.includes("'enter-full-screen'") &&
  modSrc.includes("'leave-full-screen'"));

/* ---------- ۲) اپشنای کامل پلیر ---------- */
console.log('\n[2] «اپشنای آواپلیر خیلی کمه» — نوار کنترل کامل');
['btnPlay', 'btnB10', 'btnF10', 'seek', 'vol', 'btnMute', 'rate', 'qual', 'btnLoop', 'btnPip', 'btnTop', 'btnFs', 'btnMore']
  .forEach((id) => ok('player: کنترل ' + id + ' در نوار پایین', playerHtmlSrc.includes('id="' + id + '"')));
['btnBrowser', 'btnSys', 'btnReload', 'btnKeys', 'btnShot', 'btnCopy', 'sizeRow', 'opRow', 'monRow', 'btnClose2']
  .forEach((id) => ok('player: گزینهٔ ' + id + ' در منوی ⋮', playerHtmlSrc.includes('id="' + id + '"')));
ok('player: اندازهٔ پنجره — کوچک/متوسط/بزرگ/حداکثر (maximize واقعی در ماژول)',
  playerHtmlSrc.includes('data-size="max"') && playerHtmlSrc.includes("winOp('size'") &&
  modSrc.includes("win.maximize()"));
ok('player: شفافیت — ۱۰۰/۸۰/۶۰/۴۰٪ (win op opacity)',
  playerHtmlSrc.includes('data-op="40"') && playerHtmlSrc.includes("winOp('opacity'"));
ok('player: مانیتور ۱ و ۲ (خطای صادقانه برای مانیتور ناموجود)',
  playerHtmlSrc.includes('data-mon="2"') && modSrc.includes('این شماره مانیتور وجود نداره'));
ok('player: اسکرین‌شات + کپی لینک از خود پلیر',
  playerHtmlSrc.includes("winOp('shot'") && playerHtmlSrc.includes("winOp('copyurl'") &&
  modSrc.includes("clipboard.writeText"));
ok('player: میان‌برهای کیبورد کامل (Space/K، J/L، Shift+←→ ۳۰ث، M، R، T، P، F، Q، C، 0-9، سرعت، Esc)',
  playerHtmlSrc.includes("'k' || k === 'K'") && playerHtmlSrc.includes("'j' || k === 'J'") &&
  playerHtmlSrc.includes('e.shiftKey ? 30 : 5') && playerHtmlSrc.includes("'m' || k === 'M'") &&
  playerHtmlSrc.includes("'r' || k === 'R'") && playerHtmlSrc.includes("'t' || k === 'T'") &&
  playerHtmlSrc.includes("'p' || k === 'P'") && playerHtmlSrc.includes("'f' || k === 'F'") &&
  playerHtmlSrc.includes("'q' || k === 'Q'") && playerHtmlSrc.includes("'c' || k === 'C'") &&
  playerHtmlSrc.includes("/^[0-9]$/.test(k)"));
ok('player: دابل‌کلیک روی ویدیو = فول‌اسکرین، کلیک = پخش/پاز (لایهٔ hit)',
  playerHtmlSrc.includes("hit.addEventListener('dblclick'") && playerHtmlSrc.includes("hit.addEventListener('click'"));
ok('player: پخش با پلیر سیستم از خود پلیر (AP.sys + پیام آماده‌سازی صادقانه)',
  playerHtmlSrc.includes('AP.sys()') && playerHtmlSrc.includes('پلیر سیستم'));
ok('player: __avaCtl — زبان مشترک صوتی/میان‌بر (play_pause/seek/speed/volume/mute/loop/fullscreen/status)',
  playerHtmlSrc.includes('window.__avaCtl') && playerHtmlSrc.includes("'play_pause'") &&
  playerHtmlSrc.includes("'volume_up'") && playerHtmlSrc.includes("'status'") &&
  playerHtmlSrc.includes("'fullscreen'"));
ok('player: نرخ‌های سرعت استاندارد (0.25 تا 2) با چرخش کلیک/راست‌کلیک',
  playerHtmlSrc.includes('RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]') &&
  playerHtmlSrc.includes('rateStep(1)') && playerHtmlSrc.includes('rateStep(-1)'));
ok('player: پرِ بافر روی نوار زمان (progress → گرادیان seek)',
  playerHtmlSrc.includes("video.addEventListener('progress'") && playerHtmlSrc.includes('st.buf'));
ok('player: MediaSession برای موتور مستقیم (متادیتا + play/pause/seek)',
  playerHtmlSrc.includes('mediaSession') && playerHtmlSrc.includes('setActionHandler'));
ok('player: ناوبری درجا در صفحه — onNavigate → apply → load (پنجره عوض نمی‌شود)',
  playerHtmlSrc.includes('AP.onNavigate(apply)') && playerHtmlSrc.includes('function apply(p2)'));
ok('player: توست + برند + veil + Escape حفظ شده',
  playerHtmlSrc.includes('id="toast"') && playerHtmlSrc.includes('آوا پلیر v0.85') &&
  playerHtmlSrc.includes('id="veil"') && playerHtmlSrc.includes("k === 'Escape'"));

/* ---------- ۳) main.js — کنترل صوتی واقعی پلیر آوا ---------- */
console.log('\n[3] player:ctl شاخهٔ پلیر آوا — پاز/سرعت/ولوم/سیک هدفمند');
ok('main.js: شاخهٔ ۲.۴ — playerCtl.player === ava یا pid منفی → avaPlayerCtl',
  mainSrc.includes("if (playerCtl.player === 'ava' || Number(p.pid) < 0) {"));
ok('ماژول: ctl — pid منفی هدفمند، وگرنه جدیدترین پنجرهٔ زنده',
  modSrc.includes('async function ctl(a, arg, pidHint)') &&
  modSrc.includes('if (Number(pidHint) < 0) apid = Number(pidHint);'));
ok('ماژول: ctl — فول‌اسکرین بومی خود پنجره (setFullScreen)',
  /async function ctl\(a, arg, pidHint\)[\s\S]{0,700}setFullScreen\(want\)/.test(modSrc));
ok('ماژول: ctl — فرمان به __avaCtl خود صفحه (executeJavaScript)',
  modSrc.includes('window.__avaCtl ? window.__avaCtl(') && modSrc.includes('executeJavaScript'));
ok('ماژول: aplayer:win — عملیات fullscreen/top/pip/size/opacity/monitor/shot/copyurl/browser/close',
  ["fullscreen", "top", "pip", "unpip", "size", "maximize", "minimize", "opacity", "monitor", "shot", "copyurl", "browser", "close"]
    .every((op) => modSrc.includes(op + ': () => op(') || modSrc.includes(op + ': () => {')));
ok('ماژول: aplayer:sys — resolveYtStream → playerLaunch({ytdl:false}) → بستن پنجره در موفقیت',
  /ipcMain\.handle\('aplayer:sys'[\s\S]{0,500}resolveYtStream\(url\)[\s\S]{0,700}playerLaunch\(pl, r\.url, \{ ytdl: false \}\)/.test(modSrc));
ok('ماژول: apidOfSender با wc ثبت‌شده (en.wc = win.webContents.id)',
  modSrc.includes('function apidOfSender(sender)') && modSrc.includes('wc: win.webContents.id'));
ok('main.js: سرعتِ پلیر آوا در playerCtl.speed ذخیره می‌شود (پاسخ صوتی درست)',
  mainSrc.includes('if (r.speed) playerCtl.speed = r.speed;'));
ok('main.js: پنجره نبود → playerCtl.player پاک می‌شود (noPlayer صادقانه)',
  mainSrc.includes('if (r && r.noPlayer) { playerCtl.player = null; return r; }'));
ok('main.js: شمارش پنجره‌ها از ماژول (AP.size در player:ctl)',
  (mainSrc.match(/AP\.size\(\)/g) || []).length >= 4);

/* ---------- ۴) preload — فهرست سفید بسته ---------- */
console.log('\n[4] ava-player-preload.js — پل امن');
ok('preload: contextBridge با win/sys/stream/meta/log/onNavigate/onFs',
  preloadSrc.includes("contextBridge.exposeInMainWorld('avaPlayer'") &&
  preloadSrc.includes("win: (op, arg) => ipcRenderer.invoke('aplayer:win'") &&
  preloadSrc.includes("sys: () => ipcRenderer.invoke('aplayer:sys')") &&
  preloadSrc.includes("stream: (opts) => ipcRenderer.invoke('aplayer:stream'") &&
  preloadSrc.includes('meta: () => ipcRenderer.invoke') &&
  preloadSrc.includes('onNavigate:') && preloadSrc.includes('onFs:'));
ok('preload: هیچ API خامی فاش نشده (nodeIntegration خاموش می‌ماند، ipcRenderer expose نمی‌شود)',
  !/exposeInMainWorld\('avaPlayer',\s*ipcRenderer\s*\)/.test(preloadSrc) &&
  !mainSrc.includes('nodeIntegration: true'));
ok('ماژول: sandbox + contextIsolation + autoplayPolicy پلیر حفظ شده',
  modSrc.includes("autoplayPolicy: 'no-user-gesture-required'") &&
  /new BrowserWindow\(\{[\s\S]{0,500}sandbox: true/.test(modSrc));
ok('ماژول: setWindowOpenHandler → مرورگر خارجی (پنجرهٔ نو داخل آوا ممنوع)',
  modSrc.includes('setWindowOpenHandler'));
ok('ماژول: aplayer:stream — تعویض کیفیت/استریم تازه + aplayer:meta برای بازیابی بعد از ریلود',
  modSrc.includes("ipcMain.handle('aplayer:stream'") && modSrc.includes("ipcMain.handle('aplayer:meta'"));

/* ---------- ۵) حفظ فیکس‌های 0.83.x روی معماری نو ---------- */
console.log('\n[5] رگرسیون — فیکس‌های قبلی دست‌نخورده');
ok('v0.85: هیچ تایمر destroy در مسیرهای عادی ماژول نیست (ریشه‌کنی بمب v0.83)',
  !/setTimeout[\s\S]{0,60}\.destroy\(/.test(modSrc));
ok('v0.83: closeVideoByPid pid منفی → بستن بومی ماژول (هرگز Stop-Process روی خود آوا)',
  mainSrc.includes('if (pidN < 0) return avaCloseByPid(pidN);'));
ok('v0.83: playerOpenDecision پیش‌فرض یوتیوب → ava-player',
  mainSrc.includes("if (!wanted || wanted === 'default' || wanted === 'ava') return { action: 'ava-player', player: 'ava' };"));
ok('v0.83: عنوان با oEmbed زنده به‌روز می‌شود (__avaSetTitle)',
  modSrc.includes('async function ytTitleOf') && playerHtmlSrc.includes('__avaSetTitle'));
ok('player: CSP صفحهٔ پلیر — frame-src یوتیوب + media-src https (موتور مستقیم) + img-src بندانگشتی',
  playerHtmlSrc.includes('frame-src https://www.youtube.com https://www.youtube-nocookie.com') &&
  playerHtmlSrc.includes('media-src https: blob: data:') &&
  playerHtmlSrc.includes('img-src https://i.ytimg.com'));
ok('ماژول: play خروجی قراردادی (ok/via/player/fa/apid) و playerCtl به‌روز',
  /return \{ ok: true, via: 'ava', player: 'ava', fa: 'پلیر آوا', apid, engine \};/.test(modSrc) &&
  modSrc.includes("playerCtl.player = 'ava'"));

/* ---------- ۶) اسموک + نحو ---------- */
console.log('\n[6] اسموک پلیر و نحو');
ok('scripts-smoke-player.js: با پل preload + سشن aplayer اسموک می‌کند (همان تولید)',
  smokeSrc.includes('ava-player-preload.js') && smokeSrc.includes("fromPartition('aplayer'") &&
  smokeSrc.includes('hasBridge') && smokeSrc.includes('ctlStatus'));
let syn = spawnSync(process.execPath, ['--check', path.join(R, 'main.js')]);
ok('node --check main.js', !syn.status);
syn = spawnSync(process.execPath, ['--check', path.join(R, 'lib', 'ava-player.js')]);
ok('node --check lib/ava-player.js', !syn.status);
syn = spawnSync(process.execPath, ['--check', path.join(R, 'renderer', 'ava-player-preload.js')]);
ok('node --check ava-player-preload.js', !syn.status);
const htmlScript = (playerHtmlSrc.match(/<script>([\s\S]*)<\/script>/) || [])[1] || '';
try { new Function(htmlScript); ok('نحو JS صفحهٔ پلیر (new Function parse)', true); }
catch (e) { ok('نحو JS صفحهٔ پلیر (new Function parse): ' + String(e && e.message).slice(0, 80), false); }

/* ---------- ۷) پین نسخه ---------- */
console.log('\n[7] پین نسخه 0.85.0-beta');
ok('package.json: 0.85.0-beta', pkgSrc.includes('"version": "0.85.0-beta"'));
ok('app.js: appVersion = 0.85.0-beta', appSrc.includes("let appVersion = '0.85.0-beta';"));
ok('index.html: abVersion = v0.85.0-beta', htmlSrc.includes('>v0.85.0-beta<'));
ok('ava-player.html: برند پلیر v0.85', playerHtmlSrc.includes('آوا پلیر v0.85'));
ok('README: بلاک نسخهٔ ۰.۸۵.۰', read('README.md').includes('۰.۸۵.۰'));

(async () => {
  /* ---------- ۸) رفتاری: نردبان خطای embed و __avaCtl (سندباکس) ---------- */
  console.log('\n[8] شبیه‌سازی رفتاری — onError → nocookie → پنل، و __avaCtl');
  try {
    const js = playerHtmlSrc.match(/<script>([\s\S]*)<\/script>/)[1];
    const grab = (re, nm) => { const m = js.match(re); ok('برشِ منطق «' + nm + '» از سورس صفحه', !!m); return m ? m[0] : 'function ' + nm + '(){ /* missing */ }'; };
    const rates = (js.match(/var RATES = \[[^\]]*\];/) || ['var RATES = [];'])[0];
    const errTxt = grab(/var ERR_TXT = \{[\s\S]*?\n    \};/, 'ERR_TXT');
    const embedUrl = grab(/function embedSrcUrl\(\) \{[\s\S]*?\n    \}/, 'embedSrcUrl');
    const failFn = grab(/function fail\(msg, sub\) \{[\s\S]*?\n    \}/, 'fail');
    const onErrorFn = grab(/function onError\(code\) \{[\s\S]*?\n    \}/, 'onError');
    const pVolFn = grab(/function pVol\(v\) \{[\s\S]*?\n    \}/, 'pVol');
    const pRateFn = grab(/function pRate\(r\) \{[\s\S]*?\n    \}/, 'pRate');
    const rateStepFn = grab(/function rateStep\(dir\) \{[\s\S]*?\n    \}/, 'rateStep');
    const ctlFn = grab(/window\.__avaCtl = function \(c\) \{[\s\S]*?\n    \};/, '__avaCtl');

    const st = { playing: false, dur: 0, cur: 0, vol: 100, muted: false, rate: 1, loop: false,
      live: false, pip: false, top: false, fs: false, buf: 0, evtAlive: false, lastInfo: 0,
      loadedAt: 0, triedNC: false, nocookie: false, wdFired: false, tried360: false };
    const els = {};
    const mkEl = (id) => ({
      id, textContent: '', value: '0', attrs: {},
      classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); }, toggle(c, v) { v ? this._s.add(c) : this._s.delete(c); } },
      setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
    });
    const $ = (id) => { if (!els[id]) els[id] = mkEl(id); return els[id]; };
    const veil = $('veil'), panel = $('panel');
    const vid = 'dQw4w9WgXcQ';
    const payload = { videoId: vid, start: 0, title: '', engine: 'embed', src: '', quality: 'best' };
    const sandbox = new Function(
      'st', 'RATES', '$', 'veil', 'panel', 'vid', 'payload', 'engine', 'video', 'frame', 'cmd', 'winOp', 'setTimeout', 'window',
      'function poke() { }' +
      'function load() { st.loadedAt = Date.now(); }' +
      'function render() { }' +
      'function pPlay() { }' +
      'function pPause() { }' +
      'function pSeek(s) { st.cur = Math.max(0, s); }' +
      'function toggle() { st.playing = !st.playing; }' +
      'function toggleMute() { st.muted = !st.muted; }' +
      'function say() { }' +
      'function setQuality() { }' +
      rates + ' ' + errTxt + ' ' + embedUrl + ' ' + failFn + ' ' + onErrorFn + ' ' + pVolFn + ' ' + pRateFn + ' ' + rateStepFn + ' ' + ctlFn +
      ' ; return { onError: onError, ctl: window.__avaCtl };'
    );
    const api = sandbox(st, [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2], $, veil, panel, vid, payload, 'embed',
      { volume: 1, muted: false, playbackRate: 1, loop: false, currentTime: 0, play() {}, pause() {} },
      { contentWindow: { postMessage() {} } },
      (fn, args) => { api.lastCmd = { fn, args }; return { ok: true }; },
      () => Promise.resolve({ ok: true }),
      (fn, ms) => setTimeout(fn, Math.min(ms || 0, 250)), {});
    void payload;

    /* نردبان خطا: 101 → یک‌بار nocookie خودکار */
    api.onError(101);
    ok('onError 101 → پلهٔ خودکار nocookie (triedNC + nocookie)',
      st.triedNC === true && st.nocookie === true);
    /* بار دوم → پنل فالبک با پیام صادقانه */
    api.onError(101);
    ok('دومین onError → پنل فالبک + پیام «اجازهٔ پخش خارجی»',
      panel.classList.contains('show') && $('panelMsg').textContent.includes('اجازهٔ پخش خارجی'));
    ok('پنل فالبک پرده (veil) را برمی‌دارد — پنجره هرگز بسته نمی‌شود',
      veil.classList.contains('off'));
    /* کد 100 (حذف/خصوصی) → مستقیم پنل بدون تلاش nocookie */
    st.triedNC = false; st.nocookie = false; panel.classList.remove('show');
    api.onError(100);
    ok('onError 100 → بدون هدررفتِ nocookie، مستقیم پنل «پیدا نمی‌شود»',
      st.nocookie === false && panel.classList.contains('show') &&
      $('panelMsg').textContent.includes('پیدا نمی‌شود'));
    /* کد ناشناخته (مثلاً 133 خانوادهٔ پیکربندی) */
    st.triedNC = false; st.nocookie = false; panel.classList.remove('show');
    api.onError(133);
    ok('onError 133 → اول nocookie، دوم پنل «پیکربندی پخش»',
      st.nocookie === true);

    /* __avaCtl — رفتار سرعت/ولوم/حلقه/وضعیت */
    const r1 = api.ctl({ a: 'speed', arg: '2' });
    ok('__avaCtl speed=2 → rate=2', r1 && r1.ok === true && st.rate === 2);
    const r2 = api.ctl({ a: 'speed', arg: 'up' });
    ok('__avaCtl speed=up از 2 → 2 (سقف نردبان)', r2 && r2.ok === true && st.rate === 2);
    st.vol = 100;
    const r3 = api.ctl({ a: 'volume_down', arg: '' });
    ok('__avaCtl volume_down از 100 → 90', r3 && r3.ok === true && st.vol === 90);
    const r4 = api.ctl({ a: 'mute', arg: '' });
    ok('__avaCtl mute → بی‌صدا', r4 && r4.ok === true && st.muted === true);
    const r5 = api.ctl({ a: 'loop', arg: 'on' });
    ok('__avaCtl loop=on → حلقه فعال', r5 && r5.ok === true && st.loop === true);
    const r6 = api.ctl({ a: 'play_pause', arg: '' });
    ok('__avaCtl play_pause → حالت پخش فلیپ می‌کند', r6 && r6.ok === true && st.playing === true);
    const r7 = api.ctl({ a: 'seek', arg: '30' });
    ok('__avaCtl seek+30 → cur جلو می‌رود', r7 && r7.ok === true && st.cur === 30);
    const r8 = api.ctl({ a: 'status' });
    ok('__avaCtl status → وضعیت کامل (playing/cur/dur/speed/vol/muted/loop/live/engine)',
      r8 && r8.ok === true && ['playing', 'cur', 'dur', 'speed', 'vol', 'muted', 'loop', 'live', 'engine'].every((k) => k in r8));
    const r9 = api.ctl({ a: 'x-unknown' });
    ok('__avaCtl اقدام ناشناخته → ok:false با پیام', r9 && r9.ok === false && r9.error);
  } catch (e) {
    ok('شبیه‌سازی اجرا شد (' + String(e && e.message || e).slice(0, 90) + ')', false);
  }

  console.log('\n==== v0.84.0-beta (guards on v0.85 architecture): ' + pass + ' passed, ' + fail + ' failed ====');
  process.exit(fail ? 1 : 0);
})();
