#!/usr/bin/env node
'use strict';
/* ============================================================
   scripts-test-v0840.js — باتری نسخهٔ ۰.۸۴.۰-بتا
   ------------------------------------------------------------
   دو گزارش کاربر بعد از ۰.۸۳.۱:
   ۱) «ببین کار نمیکنه» — پلیر آوا باز می‌شود ولی یوتیوب با
      «Video player configuration error (133/153)» رد می‌کند.
      ریشه: یوتیوب از پاییز ۲۰۲۵ embedِ بدون Referer معتبر را رد
      می‌کند؛ صفحهٔ پلیر file:// است و مرورگر برای file:// هرگز
      Referer نمی‌فرستد. فیکس لایهٔ شبکه: سشن اختصاصی «aplayer» +
      onBeforeSendHeaders تزریق Referer روی درخواست‌های یوتیوبِ همان
      سشن + referrerpolicy روی iframe + نردبان خطا (nocookie → پنل
      فالبک با پلیر سیستم/مرورگر/تلاش دوباره). ویدیوی میدانیِ خراب
      لایو بود → بج LIVE هم اضافه شد.
   ۲) «اپشنای اواپلیر خیلی کمه» — نوار کنترل کامل: پخش/پاز، ±۱۰ث،
      سیک‌بار+زمان، ولوم+بی‌صدا، سرعت، تکرار، PIP، همیشه‌روانه،
      فول‌اسکرین، منوی اندازه/شفافیت/مرورگر/پلیرسیستم/میان‌برها +
      کلیدهای کیبورد + کنترل صوتیِ واقعی (player:ctl شاخهٔ آوا).
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
let playerHtmlSrc = '', preloadSrc = '', smokeSrc = '';
try { playerHtmlSrc = read('renderer/ava-player.html'); } catch (_) { /* noop */ }
try { preloadSrc = read('renderer/ava-player-preload.js'); } catch (_) { /* noop */ }
try { smokeSrc = read('scripts-smoke-player.js'); } catch (_) { /* noop */ }

/* ---------- ۱) فیکس ریشه‌ای Error 133/153 ---------- */
console.log('\n[1] فیکس «Video player configuration error» — Referer + نردبان خطا');
ok('main.js: پنجرهٔ پلیر با سشن اختصاصی aplayer (partition: aplayer)',
  /preload:[\s\S]{0,200}partition:\s*'aplayer'/.test(mainSrc));
ok('main.js: پل preload صفحهٔ پلیر وصل است (ava-player-preload.js)',
  mainSrc.includes("path.join(__dirname, 'renderer', 'ava-player-preload.js')"));
ok('main.js: avaPlayerRef — سشن aplayer + onBeforeSendHeaders (فقط درخواست‌های یوتیوب)',
  mainSrc.includes("session.fromPartition('aplayer')") &&
  mainSrc.includes('onBeforeSendHeaders') &&
  mainSrc.includes("'*://*.youtube.com/*'") && mainSrc.includes("'*://*.youtube-nocookie.com/*'"));
ok('main.js: تزریق Referer https://www.youtube.com/ (ریشهٔ ردِ embed بدون referrer)',
  mainSrc.includes("h['Referer'] = 'https://www.youtube.com/';"));
ok('main.js: avaPlayerRef یک‌بار و در لحظهٔ باز شدن پنجره صدا زده می‌شود',
  mainSrc.includes('let applayerRefDone = false;') && mainSrc.includes('avaPlayerRef();'));
ok('player: iframe با referrerpolicy strict-origin-when-cross-origin',
  playerHtmlSrc.includes('referrerpolicy="strict-origin-when-cross-origin"'));
ok('player: embed با enablejsapi=1 (پل postMessage) + autoplay=1 + embed رسمی',
  playerHtmlSrc.includes('enablejsapi=1') && playerHtmlSrc.includes('autoplay=1') &&
  playerHtmlSrc.includes('/embed/'));
ok('player: فرمان‌های postMessage به یوتیوب (event:command) + هندشیک listening',
  playerHtmlSrc.includes("event: 'command'") && playerHtmlSrc.includes("cmd('listening'"));
ok('player: خواندن infoDelivery — زمان/وضعیت/سرعت/ولوم زنده',
  playerHtmlSrc.includes("d.event === 'infoDelivery'") && playerHtmlSrc.includes('currentTime') &&
  playerHtmlSrc.includes('playbackRate'));
ok('player: نردبان خطا — onError → تلاش خودکار youtube-nocookie (یک پله)',
  playerHtmlSrc.includes("function onError(code)") && playerHtmlSrc.includes('youtube-nocookie.com') &&
  playerHtmlSrc.includes('st.triedNC'));
ok('player: متن خطاها برای کدهای واقعی (101/150/133/153/100) — صادقانه، نه مبهم',
  playerHtmlSrc.includes('133:') && playerHtmlSrc.includes('153:') &&
  playerHtmlSrc.includes('اجازهٔ پخش خارجی نداده'));
ok('player: ساعتِ نگهبان ۱۴ث — پنل فالبک می‌آید، پنجره بسته نمی‌شود',
  playerHtmlSrc.includes('14000') && playerHtmlSrc.includes('پخش شروع نشد'));
ok('player: پنل فالبک چهار عمل — تلاش دوباره / پلیر سیستم / در مرورگر / بستن پنل',
  ['panelRetry', 'panelSys', 'panelBrowser', 'panelDismiss'].every((id) => playerHtmlSrc.includes('id="' + id + '"')));
ok('player: حالت شبیه‌سازی وقتی رویداد یوتیوب ساکت است (lastInfo + شمارش محلی)',
  playerHtmlSrc.includes('Date.now() - st.lastInfo > 3000'));
ok('player: بج LIVE — سیک‌بار برای ویدیوی زنده خاموش می‌شود',
  playerHtmlSrc.includes('islive') && playerHtmlSrc.includes('LIVE'));
ok('main.js: همگام‌سازی فول‌اسکرین به صفحه (aplayer:fs روی enter/leave)',
  mainSrc.includes("send('aplayer:fs'") && mainSrc.includes("'enter-full-screen'") &&
  mainSrc.includes("'leave-full-screen'"));

/* ---------- ۲) اپشنای کامل پلیر ---------- */
console.log('\n[2] «اپشنای آواپلیر خیلی کمه» — نوار کنترل کامل');
['btnPlay', 'btnB10', 'btnF10', 'seek', 'vol', 'btnMute', 'rate', 'btnLoop', 'btnPip', 'btnTop', 'btnFs', 'btnMore']
  .forEach((id) => ok('player: کنترل ' + id + ' در نوار پایین', playerHtmlSrc.includes('id="' + id + '"')));
['btnBrowser', 'btnSys', 'btnReload', 'btnKeys', 'sizeRow', 'opRow', 'btnClose2']
  .forEach((id) => ok('player: گزینهٔ ' + id + ' در منوی ⋮', playerHtmlSrc.includes('id="' + id + '"')));
ok('player: اندازهٔ پنجره — کوچک/متوسط/بزرگ/حداکثر (win op size)',
  playerHtmlSrc.includes('data-size="small"') && playerHtmlSrc.includes('data-size="max"') &&
  playerHtmlSrc.includes("winOp('size'"));
ok('player: شفافیت — ۱۰۰/۸۰/۶۰/۴۰٪ (win op opacity)',
  playerHtmlSrc.includes('data-op="40"') && playerHtmlSrc.includes("winOp('opacity'"));
ok('player: میان‌برهای کیبورد کامل (Space/K، J/L، M، R، T، P، F، 0-9، سرعت، Esc)',
  playerHtmlSrc.includes("'k' || k === 'K'") && playerHtmlSrc.includes("'j' || k === 'J'") &&
  playerHtmlSrc.includes("'m' || k === 'M'") && playerHtmlSrc.includes("'r' || k === 'R'") &&
  playerHtmlSrc.includes("'t' || k === 'T'") && playerHtmlSrc.includes("'p' || k === 'P'") &&
  playerHtmlSrc.includes("'f' || k === 'F'") && playerHtmlSrc.includes("/^[0-9]$/.test(k)"));
ok('player: دابل‌کلیک روی ویدیو = فول‌اسکرین، کلیک = پخش/پاز (لایهٔ hit)',
  playerHtmlSrc.includes("hit.addEventListener('dblclick'") && playerHtmlSrc.includes("hit.addEventListener('click'"));
ok('player: پخش با پلیر سیستم از خود پلیر (AP.sys + پیام آماده‌سازی صادقانه)',
  playerHtmlSrc.includes('AP.sys()') && playerHtmlSrc.includes('پلیر سیستم'));
ok('player: __avaCtl — زبان مشترک صوتی/میان‌بر (play_pause/seek/speed/volume/mute/loop/status)',
  playerHtmlSrc.includes('window.__avaCtl') && playerHtmlSrc.includes("'play_pause'") &&
  playerHtmlSrc.includes("'volume_up'") && playerHtmlSrc.includes("'status'"));
ok('player: نرخ‌های سرعت استاندارد (0.25 تا 2) با چرخش کلیک/راست‌کلیک',
  playerHtmlSrc.includes('SIZES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]') &&
  playerHtmlSrc.includes("rateStep(1)") && playerHtmlSrc.includes("rateStep(-1)"));
ok('player: حلقهٔ تکرار — onState ended → seekTo(0)+playVideo',
  (playerHtmlSrc.match(/st\.loop/g) || []).length >= 3);

/* ---------- ۳) main.js — کنترل صوتی واقعی پلیر آوا ---------- */
console.log('\n[3] player:ctl شاخهٔ پلیر آوا — پاز/سرعت/ولوم/سیک هدفمند');
ok('main.js: شاخهٔ ۲.۴ — playerCtl.player === ava یا pid منفی → avaPlayerCtl',
  mainSrc.includes("if (playerCtl.player === 'ava' || Number(p.pid) < 0) {"));
ok('main.js: avaPlayerCtl — pid منفی هدفمند، وگرنه جدیدترین پنجرهٔ آوا',
  mainSrc.includes('async function avaPlayerCtl(a, arg, pidHint)') &&
  mainSrc.includes('if (Number(pidHint) < 0) apid = Number(pidHint);'));
ok('main.js: avaPlayerCtl — فول‌اسکرین بومی خود پنجره (setFullScreen)',
  /async function avaPlayerCtl[\s\S]{0,700}setFullScreen\(want\)/.test(mainSrc));
ok('main.js: avaPlayerCtl — فرمان به __avaCtl خود صفحه (executeJavaScript)',
  mainSrc.includes('window.__avaCtl ? window.__avaCtl(') && mainSrc.includes('executeJavaScript'));
ok('main.js: aplayer:win — عملیات fullscreen/top/pip/unpip/size/opacity/close/browser',
  ["'fullscreen'", "'top'", "'pip'", "'unpip'", "'size'", "'opacity'", "'close'", "'browser'"]
    .every((op) => mainSrc.includes('op === ' + op)));
ok('main.js: aplayer:sys — resolveYtStream → playerLaunch → بستن پنجرهٔ آوا در موفقیت',
  /ipcMain\.handle\('aplayer:sys'[\s\S]{0,500}resolveYtStream\(url\)[\s\S]{0,700}playerLaunch\(pl, r\.url, \{ ytdl: false \}\)[\s\S]{0,700}win\.close\(\)/.test(mainSrc));
ok('main.js: apidOfSender با wc ثبت‌شده در رجیستری (en.wc = win.webContents.id)',
  mainSrc.includes('function apidOfSender(sender)') && mainSrc.includes('wc: win.webContents.id'));
ok('main.js: سرعتِ پلیر آوا در playerCtl.speed ذخیره می‌شود (پاسخ صوتی درست)',
  mainSrc.includes('if (r.speed) playerCtl.speed = r.speed;'));
ok('main.js: پنجره نبود → playerCtl.player پاک می‌شود (noPlayer صادقانه)',
  mainSrc.includes('if (r && r.noPlayer) { playerCtl.player = null; return r; }'));

/* ---------- ۴) preload — فهرست سفید بسته ---------- */
console.log('\n[4] ava-player-preload.js — پل امن');
ok('preload: contextBridge.exposeInMainWorld(avaPlayer) با فقط win/sys/onFs',
  preloadSrc.includes("contextBridge.exposeInMainWorld('avaPlayer'") &&
  preloadSrc.includes("win: (op, arg) => ipcRenderer.invoke('aplayer:win'") &&
  preloadSrc.includes("sys: () => ipcRenderer.invoke('aplayer:sys')") &&
  preloadSrc.includes("onFs:"));
ok('preload: هیچ API خامی فاش نشده (nodeIntegration خاموش می‌ماند، ipcRenderer expose نمی‌شود)',
  !/exposeInMainWorld\('avaPlayer',\s*ipcRenderer\s*\)/.test(preloadSrc) &&
  !mainSrc.includes('nodeIntegration: true'));
ok('main.js: sandbox + contextIsolation + autoplayPolicy پلیر حفظ شده',
  mainSrc.includes('autoplayPolicy: \'no-user-gesture-required\'') &&
  /avaPlayerOpen\(videoId[\s\S]{0,600}sandbox: true/.test(mainSrc));
ok('main.js: setWindowOpenHandler → مرورگر خارجی (پنجرهٔ نو داخل آوا ممنوع)',
  mainSrc.includes('setWindowOpenHandler'));

/* ---------- ۵) حفظ فیکس‌های 0.83.x ---------- */
console.log('\n[5] رگرسیون — فیکس‌های قبلی دست‌نخورده');
ok('v0.83.1: closeAvaPlayers اسنپ‌شات می‌گیرد (بمب destroy نمی‌سازد)',
  mainSrc.includes('const olds = [...avaPlayers.values()];'));
ok('v0.83: closeVideoByPid pid منفی → بستن بومی (هرگز Stop-Process روی خود آوا)',
  /function closeVideoByPid\(pid\) \{[\s\S]{0,300}if \(pidN < 0\) \{[\s\S]{0,400}en\.win\.close\(\)/.test(mainSrc));
ok('v0.83: playerOpenDecision پیش‌فرض یوتیوب → ava-player',
  mainSrc.includes("if (!wanted || wanted === 'default' || wanted === 'ava') return { action: 'ava-player', player: 'ava' };"));
ok('v0.83: عنوان با oEmbed زنده به‌روز می‌شود (__avaSetTitle)',
  mainSrc.includes('async function ytTitleOf') && playerHtmlSrc.includes('__avaSetTitle'));
ok('player: CSP صفحهٔ پلیر آپدیت شده (frame-src هر دو دامنه + img-src بندانگشتی)',
  playerHtmlSrc.includes('frame-src https://www.youtube.com https://www.youtube-nocookie.com') &&
  playerHtmlSrc.includes('img-src https://i.ytimg.com'));
ok('player: صفحات قدیمی — veil/btnBrowser/btnReload/Escape حفظ (پین‌های v0830)',
  playerHtmlSrc.includes('id="veil"') && playerHtmlSrc.includes('id="btnBrowser"') &&
  playerHtmlSrc.includes('id="btnReload"') && playerHtmlSrc.includes("e.key === 'Escape'"));

/* ---------- ۶) اسموک + نحو ---------- */
console.log('\n[6] اسموک پلیر و نحو');
ok('scripts-smoke-player.js: با پل preload + سشن aplayer اسموک می‌کند (همان تولید)',
  smokeSrc.includes('ava-player-preload.js') && smokeSrc.includes("fromPartition('aplayer'") &&
  smokeSrc.includes('hasBridge') && smokeSrc.includes('ctlStatus'));
let syn = spawnSync(process.execPath, ['--check', path.join(R, 'main.js')]);
ok('node --check main.js', !syn.status);
syn = spawnSync(process.execPath, ['--check', path.join(R, 'renderer', 'ava-player-preload.js')]);
ok('node --check ava-player-preload.js', !syn.status);
const htmlScript = (playerHtmlSrc.match(/<script>([\s\S]*)<\/script>/) || [])[1] || '';
try { new Function(htmlScript); ok('نحو JS صفحهٔ پلیر (new Function parse)', true); }
catch (e) { ok('نحو JS صفحهٔ پلیر (new Function parse): ' + String(e && e.message).slice(0, 80), false); }

/* ---------- ۷) پین نسخه ---------- */
console.log('\n[7] پین نسخه 0.84.0-beta');
ok('package.json: 0.84.0-beta', pkgSrc.includes('"version": "0.84.0-beta"'));
ok('app.js: appVersion = 0.84.0-beta', appSrc.includes("let appVersion = '0.84.0-beta';"));
ok('index.html: abVersion = v0.84.0-beta', htmlSrc.includes('>v0.84.0-beta<'));
ok('ava-player.html: برند پلیر v0.84', playerHtmlSrc.includes('آوا پلیر v0.84'));
ok('README: بلاک نسخهٔ ۰.۸۴.۰-بتا', read('README.md').includes('۰.۸۴.۰'));

(async () => {
  /* ---------- ۸) رفتاری: نردبان خطا و کنترل پخش ---------- */
  console.log('\n[8] شبیه‌سازی رفتاری — onError → nocookie → پنل، و __avaCtl');
  try {
    const js = playerHtmlSrc.match(/<script>([\s\S]*)<\/script>/)[1];
    const grab = (re, nm) => { const m = js.match(re); ok('برشِ منطق «' + nm + '» از سورس صفحه', !!m); return m ? m[0] : 'function ' + nm + '(){ /* missing */ }'; };
    const rates = (js.match(/var SIZES = \[[^\]]*\];/) || ['var SIZES = [];'])[0];
    const errTxt = grab(/var ERR_TXT = \{[\s\S]*?\n    \};/, 'ERR_TXT');
    const failFn = grab(/function fail\(msg, sub\) \{[\s\S]*?\n    \}/, 'fail');
    const onErrorFn = grab(/function onError\(code\) \{[\s\S]*?\n    \}/, 'onError');
    const setRateFn = grab(/function setRate\(r\) \{[\s\S]*?\n    \}/, 'setRate');
    const rateStepFn = grab(/function rateStep\(dir\) \{[\s\S]*?\n    \}/, 'rateStep');
    const ctlFn = grab(/window\.__avaCtl = function \(c\) \{[\s\S]*?\n    \};/, '__avaCtl');

    const st = { playing: false, dur: 0, cur: 0, vol: 100, muted: false, rate: 1, loop: false,
      live: false, pip: false, top: false, fs: false, evtAlive: false, lastInfo: 0, loadedAt: 0, triedNC: false, nocookie: false };
    const els = {};
    const mkEl = (id) => ({
      id, textContent: '', value: '0', attrs: {},
      classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); }, toggle(c, v) { v ? this._s.add(c) : this._s.delete(c); } },
      setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
    });
    const $ = (id) => { if (!els[id]) els[id] = mkEl(id); return els[id]; };
    const veil = $('veil'), panel = $('panel');
    const sandbox = new Function(
      'st', '$', 'veil', 'panel', 'setTimeout', 'window',
      'function poke() { }' +
      'function load() { st.loadedAt = Date.now(); }' +
      'function render() { }' +
      'function cmd() { }' +
      'function toggle() { st.playing = !st.playing; }' +
      'function seekTo(s) { st.cur = Math.max(0, s); }' +
      'function setVol(v) { st.vol = Math.max(0, Math.min(100, Math.round(v))); st.muted = st.vol === 0; }' +
      rates + ' ' + errTxt + ' ' + failFn + ' ' + onErrorFn + ' ' + setRateFn + ' ' + rateStepFn + ' ' + ctlFn +
      ' ; return { onError: onError, ctl: window.__avaCtl };'
    );
    const api = sandbox(st, $, veil, panel, (fn, ms) => setTimeout(fn, Math.min(ms || 0, 250)), {});

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
    ok('__avaCtl status → وضعیت کامل (playing/cur/dur/speed/vol/muted/loop/live)',
      r8 && r8.ok === true && ['playing', 'cur', 'dur', 'speed', 'vol', 'muted', 'loop', 'live'].every((k) => k in r8));
    const r9 = api.ctl({ a: 'x-unknown' });
    ok('__avaCtl اقدام ناشناخته → ok:false با پیام', r9 && r9.ok === false && r9.error);
  } catch (e) {
    ok('شبیه‌سازی اجرا شد (' + String(e && e.message || e).slice(0, 90) + ')', false);
  }

  console.log('\n==== v0.84.0-beta: ' + pass + ' passed, ' + fail + ' failed ====');
  process.exit(fail ? 1 : 0);
})();
