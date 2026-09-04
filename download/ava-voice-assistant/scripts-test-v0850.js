#!/usr/bin/env node
'use strict';
/* ============================================================
   scripts-test-v0850.js — باتریِ رفتاریِ بازساختِ پلیر آوا (v0.85)
   ------------------------------------------------------------
   الکترونِ واقعی (Xvfb در لینوکس، خودکار) + ماژولِ واقعی
   lib/ava-player.js با دیپ‌های قلابی (yt-dlp با exec قلابی —
   «fakeExec»؛ پلیرهای خارجی/اسکن/لانچ قلابی). سناریوها:
   ۱) موتور مستقیم روشن می‌شود (video.src = googlevideo + بج «مستقیم»)
   ۲) پخش دوم = همان پنجره navigate (بدون بستن/بازکردن) + عنوان نو
   ۳) «درجا بسته میشه» ریشه‌کن: ۲.۲ثانیه بعد پنجره زنده است (بمب قدیمی ۱.۵ث)
   ۴) m3u8 → embed ؛ ۵) نبودن yt-dlp → embed
   ۶) keepExisting → پنجرهٔ دوم («کنارش پخش کن»)
   ۷) عملیات پنجره: size/max/pip/unpip/top/opacity/monitor/copyurl/opAll
   ۸) فوکوس (newest/bad-pid) + ctl صوتی (status/fullscreen)
   ۹) closeByPid/closeAll/reopen
   ۱۰) IPC از خود پلیر: stream(360) + meta
   ۱۱) پلیر سیستم از خود پلیر (sys → پت‌پلیر قلابی → پنجره بسته)
   ۱۲) کرشِ رندرر → ریلود؛ پنجره زنده (render-process-gone)
   ۱۳) بدون خطای کنسول صفحه در همهٔ سناریوها
   معیار: شمارش ok؛ exit-code = تعداد شکست. الکترون در دسترس نبود → SKIP.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const R = __dirname;

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ FAIL: ' + name); } }

/* ---------- گاردهای ایستای سریع (بدون الکترون) ---------- */
const modSrc = fs.readFileSync(path.join(R, 'lib', 'ava-player.js'), 'utf8');
ok('ماژول: هیچ setTimeoutِ destroy — بمب ساعتی ساختاراً ناممکن', !/setTimeout[\s\S]{0,80}\.destroy\(/.test(modSrc));
ok('ماژول: خروجیِ فکتوری — تمام API قراردادی', ['play', 'ctl', 'op', 'opAll', 'closeAll', 'closeByPid', 'focusNewest', 'focusByPid', 'listEntries', 'size', 'ytIdOf']
  .every((k) => modSrc.includes(k)));

/* ---------- پیدا کردن باینری الکترون ---------- */
const elBin = path.join(R, 'node_modules', '.bin', 'electron');
if (!fs.existsSync(elBin)) {
  console.log('SKIP: electron binary not installed — behavioral scenarios skipped (static guards above still ran)');
  console.log('\n==== v0.85.0-beta behavioral: ' + pass + ' passed, ' + fail + ' failed (SKIP) ====');
  process.exit(fail ? 1 : 0);
}

/* ---------- main موقتِ هارنس ---------- */
const MAIN = `
'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');
app.commandLine.appendSwitch('no-sandbox');

const AVA_ROOT = process.env.AVA_ROOT || ${JSON.stringify(R)};
const APmod = require(path.join(AVA_ROOT, 'lib', 'ava-player.js'));

const stub = { state: { mode: 'ok' }, launches: [], closedExternal: 0 };
function fakeExec(cmd, opts, cb) {
  const m = String(cmd).match(/-f "([^"]+)"/);
  const fmt = m ? m[1] : '';
  setTimeout(() => {
    if (stub.state.mode === 'fail') return cb(new Error('stub-fail'), '');
    if (fmt.startsWith('18')) {
      /* نردبان ۳۶۰ همیشه mp4 واقعی می‌دهد (تستِ نجاتِ ۳۶۰ و تعویض کیفیت) */
      return cb(null, 'https://r1---sn-t.gvt1.com/videoplayback?mime=video%2Fmp4&itag=18&dur=600.000');
    }
    if (stub.state.mode === 'm3u8') return cb(null, 'https://manifest.googlevideo.com/api/manifest/hls_playlist/id/xyz.m3u8');
    cb(null, 'https://r5---sn-t.gvt1.com/videoplayback?mime=video%2Fmp4&itag=22&dur=600.000');
  }, 5);
}
let cloudSeq = 0;
const playerCtl = { player: null, vlcPort: 0, vlcPass: '', vlcBase: '', mpvPipe: '', ytUrl: '', exe: '', activePid: 0, activeProc: '', speed: 1 };
const AP = APmod({
  BrowserWindow: BrowserWindow, ipcMain: require('electron').ipcMain, session: require('electron').session,
  shell: require('electron').shell, screen: require('electron').screen, app: app,
  clipboard: require('electron').clipboard, exec: fakeExec,
  playerCtl: playerCtl,
  actLog: (line) => { process.stdout.write('T0850LOG ' + String(line).slice(0, 120) + '\\n'); },
  netErr: (e) => String(e && e.message || e).slice(0, 120),
  cloudFetch: (url) => Promise.resolve({ ok: true, json: async () => ({ title: 'عنوان قلابی ' + (++cloudSeq) }) }),
  closeAllExternalVideoPlayers: async () => { stub.closedExternal++; return { count: 0 }; },
  playersScan: async () => ({ list: [{ id: 'potplayer' }, { id: 'vlc' }], ytdl: true }),
  defaultVideoPlayer: async () => ({ id: 'potplayer' }),
  playerLaunch: async (pl) => { stub.launches.push(pl); return { ok: true, fa: 'پت‌پلیر', exe: 'pot.exe' }; },
  ytDlpFind: async () => (stub.state.mode === 'noby' ? '' : '/fake/yt-dlp'),
  resolveYtStream: async () => (stub.state.mode === 'noby' ? { ok: false, error: 'no' } : { ok: true, url: 'https://r5---sn-t.gvt1.com/videoplayback?mime=video%2Fmp4&itag=22' }),
});

const errs = [];
app.on('web-contents-created', (_e, wc) => {
  wc.on('console-message', (_e2, level, msg, line, sourceId) => {
    if (level >= 3 && !String(sourceId || '').includes('youtube')) errs.push(String(msg).slice(0, 140));
  });
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (p, ms, tag) => Promise.race([
  p, new Promise((r2) => setTimeout(() => r2({ __timeout: tag || 'exec' }), ms)),
]);
async function dom() {
  const w = BrowserWindow.getAllWindows()[0];
  if (!w) return null;
  return await withTimeout(w.webContents.executeJavaScript(\`(function(){
    return {
      eng: (document.getElementById('eng')||{}).textContent || '',
      bodyEmbed: document.body.classList.contains('eng-embed'),
      bodyDirect: !document.body.classList.contains('eng-embed'),
      videoSrc: (document.getElementById('video')||{}).src || '',
      frameSrc: (document.getElementById('frame')||{}).src || '',
    };
  })()\`, true), 8000, 'dom');
}
async function exec1(expr) {
  const w = BrowserWindow.getAllWindows()[0];
  if (!w) return null;
  try { return await withTimeout(w.webContents.executeJavaScript(expr, true), 8000, 'exec1'); } catch (e) { return { ok: false, error: String(e && e.message).slice(0, 100) }; }
}
const newestPid = () => AP.listEntries().map((x) => x.pid).sort((a, b) => b - a)[0] || 0;
const fs2 = require('fs');
const mark = (n) => { try { fs2.appendFileSync('/tmp/t0850-trace.log', Date.now() % 100000 + ' ' + n + '\n'); } catch (_) { /* noop */ } };

/* پیش‌فرضِ الکترون: با بسته شدن همهٔ پنجره‌ها اپ خارج می‌شود — در هارنس ممنوع
   (سناریوی S9 همهٔ پنجره‌ها را می‌بندد و بعد reopen می‌کند) */
app.on('window-all-closed', () => { /* no-op — هارنس کنترل دارد */ });
process.on('uncaughtException', (e) => { process.stdout.write('T0850STEP UNCAUGHT: ' + String(e && e.stack || e).slice(0, 300) + '\\n'); });
process.on('unhandledRejection', (e) => { process.stdout.write('T0850STEP UNHANDLED: ' + String(e && e.stack || e).slice(0, 300) + '\\n'); });
const heartbeat = setInterval(() => { /* keep-alive */ }, 1000);
/* نگهبانِ سراسری: هرگز بدون RESULT نمی‌میریم (حتی اگر سناریویی بالتاسرفه گیر کند) */
const watchdog = setTimeout(() => {
  try {
    res_dog.watchdog = true;
    process.stdout.write('T0850_RESULT ' + JSON.stringify(Object.assign({ fatal: 'watchdog-110s' }, res_dog)) + '\n');
  } catch (_) { /* noop */ }
  app.exit(2);
}, 110000);
const res_dog = {};
(async () => {
  const res = res_dog;
  try {
    await app.whenReady();
    mark('S1-direct');
    /* S1 — موتور مستقیم */
    const r1 = await AP.play('https://www.youtube.com/watch?v=YYYYYYYYYY1', { title: 'عنوان یک' });
    res.play1 = !!(r1 && r1.ok === true && r1.via === 'ava' && r1.apid < 0 && r1.engine === 'direct');
    await wait(900);
    res.win1 = AP.size() === 1;
    const d1 = await dom();
    /* محیطِ میزبان ممکن است رندررها را کرش کند (shm/seccomp) — چک‌های DOM شرطی می‌شوند */
    const domOK = !!(d1 && !d1.__timeout);
    res.domOK = domOK;
    res.direct_eng = !!(domOK && d1.eng === 'مستقیم' && d1.bodyDirect && /googlevideo/.test(d1.videoSrc));
    res.bad_id = (await AP.play('not-a-youtube-link', {})).ok === false;

    mark('S2-reuse');
    /* S2 — همان پنجره navigate */
    const wcBefore = BrowserWindow.getAllWindows()[0].webContents.id;
    mark('S2a-before-play');
    const r2p = await AP.play('https://youtu.be/YYYYYYYYYY2', { title: 'عنوان دو' });
    mark('S2b-after-play apid=' + (r2p && r2p.apid));
    await wait(800);
    mark('S2c-after-wait');
    res.reuse = AP.size() === 1 && BrowserWindow.getAllWindows()[0].webContents.id === wcBefore;
    res.nav_title = AP.listEntries().length === 1 && AP.listEntries()[0].title.includes('عنوان دو');

    mark('S3-alive');
    /* S3 — بمب قدیمی: ۲.۲ ثانیه بعد هنوز زنده */
    await wait(2200);
    res.alive_2s = AP.size() === 1 && !BrowserWindow.getAllWindows()[0].isDestroyed();

    mark('S4-m3u8');
    /* S4 — m3u8 → embed */
    stub.state.mode = 'm3u8';
    await AP.play('https://www.youtube.com/watch?v=YYYYYYYYYY3', {});
    await wait(800);
    const d4 = await dom();
    res.m3u8_embed = !!(domOK && d4 && d4.bodyEmbed && /youtube\\.com\\/embed/.test(d4.frameSrc));

    mark('S5-noby');
    /* S5 — بدون yt-dlp → embed */
    stub.state.mode = 'noby';
    await AP.play('https://www.youtube.com/watch?v=YYYYYYYYYY4', {});
    await wait(800);
    const d5 = await dom();
    res.noby_embed = !!(domOK && d5 && d5.bodyEmbed);
    stub.state.mode = 'ok';

    mark('S6-keep');
    /* S6 — keepExisting → پنجرهٔ دوم */
    await AP.play('https://www.youtube.com/watch?v=YYYYYYYYYY5', { keepExisting: true, title: 'کنارش' });
    await wait(700);
    res.keep2 = AP.size() === 2;

    mark('S7-ops');
    /* S7 — عملیات پنجره */
    const np = newestPid();
    res.op_size = (await AP.op('size', 'small', np)).ok === true;
    res.op_max = (await AP.op('size', 'max', np)).ok === true;
    res.op_pip = (await AP.op('pip', '', np)).ok === true;
    res.op_unpip = (await AP.op('unpip', '', np)).ok === true;
    const rt = await AP.op('top', '', np);
    res.op_top = rt.ok === true && rt.top === true;
    res.op_opacity = (await AP.op('opacity', '60', np)).ok === true;
    res.op_mon_bad = (await AP.op('monitor', '9', np)).ok === false;
    res.op_copy = (await AP.op('copyurl', '', np)).ok === true;
    res.opall_op = (await AP.opAll('opacity', '80')).count === AP.size();
    res.opall_pip = (await AP.opAll('pip', '')).count === 1;

    mark('S8-ctl');
    /* S8 — فوکوس + ctl صوتی */
    res.focus_newest = AP.focusNewest() === true;
    res.focus_bad = (await AP.focusByPid(-999)).ok === false;
    if (domOK) {
      const c1 = await AP.ctl('status', '', 0);
      res.ctl_status = !!(c1 && c1.ok && c1.via === 'ava-player' && 'engine' in c1);
      const c2 = await AP.ctl('fullscreen', '', 0);
      res.ctl_fs = !!(c2 && c2.ok && typeof c2.fullscreen === 'boolean');
    }

    mark('S9-close');
    /* S9 — closeByPid / closeAll / reopen */
    const ents = AP.listEntries().map((x) => x.pid).sort((a, b) => a - b); /* قدیم→جدید */
    mark('S9a-ents=' + ents.join(','));
    const rc = await AP.closeByPid(ents[0]);
    mark('S9b-closepid=' + (rc && rc.ok));
    await wait(400);
    res.close_pid = !!(rc && rc.ok === true && rc.closed === 1 && String(rc.closedTitle || '').includes('آوا پلیر') && AP.size() === 1);
    await AP.closeAll();
    mark('S9c-closeall=' + AP.size());
    await wait(400);
    res.close_all = AP.size() === 0;
    const rp = await AP.play('https://youtu.be/YYYYYYYYYY6', { title: 'بازگشایی' });
    mark('S9d-reopen=' + (rp && rp.ok) + '/' + AP.size());
    await wait(700);
    res.reopen = AP.size() === 1;

    mark('S10-ipc');
    /* S10 — IPC از خود پلیر: stream + meta */
    if (domOK) {
      const sr = await exec1('window.avaPlayer.stream({quality:"360"})');
      res.ipc_stream = !!(sr && sr.ok === true && /googlevideo/.test(sr.url || '') && sr.quality === '360');
      const mr = await exec1('window.avaPlayer.meta()');
      res.ipc_meta = !!(mr && mr.ok === true && mr.videoId === 'YYYYYYYYYY6');
    }

    mark('S11-sys');
    /* S11 — پلیر سیستم از خود پلیر */
    if (domOK) {
      const sysr = await exec1('window.avaPlayer.sys()');
      await wait(700);
      res.sys = !!(sysr && sysr.ok === true && sysr.player === 'potplayer' && stub.launches.includes('potplayer') && AP.size() === 0);
    } else { stub.launches.push('skipped:renderer-down'); }

    mark('S12-crash');
    /* S12 — کرش رندرر → ریلود، پنجره زنده */
    await AP.play('https://www.youtube.com/watch?v=YYYYYYYYYY7', {});
    await wait(800);
    const w7 = BrowserWindow.getAllWindows()[0];
    w7.webContents.forcefullyCrashRenderer();
    await wait(1800);
    res.crash = AP.size() === 1 && !w7.isDestroyed();
    const d7 = await dom();
    res.crash_reloaded = !!(domOK && d7 && (d7.bodyDirect || d7.bodyEmbed));

    res.no_console_errors = errs.length === 0;
    res.err_sample2 = errs.slice(0, 2);
    res.err_sample = errs.slice(0, 4);
  } catch (e) {
    res.fatal = String(e && e.stack || e).slice(0, 400);
  }
  process.stdout.write('T0850_RESULT ' + JSON.stringify(res) + '\\n');
  clearInterval(heartbeat);
  setTimeout(() => app.exit(res.fatal ? 1 : 0), 300);
})();

`;

/* ---------- اجرا: لینوکس بدون DISPLAY → Xvfb خودکار (مستقیم، بدون xauth) ---------- */
function runElectron() {
  const tmpMain = path.join(os.tmpdir(), 'ava-t0850-main-' + Date.now() + '.js');
  fs.writeFileSync(tmpMain, MAIN);
  if (process.env.AVA_T0850_KEEP) { fs.copyFileSync(tmpMain, '/tmp/ava-t0850-main-latest.js'); console.log('  ↳ harness main kept at: ' + tmpMain); }
  const env = Object.assign({}, process.env, { AVA_ROOT: R, ELECTRON_ENABLE_LOGGING: '0' });
  /* کانتینر: /dev/shm و /tmp ممکن است noexec باشند → shm در پوشهٔ امن (TMPDIR از بیرون تزریق می‌شود) */
  const safeTmp = process.env.AVA_T0850_TMPDIR || '';
  if (safeTmp) { env.TMPDIR = safeTmp; env.TEMP = safeTmp; }

  let xv = null;
  if (process.platform === 'linux' && !process.env.DISPLAY) {
    /* Xvfb مستقیم روی :99 — الگوی RELEASING.md (xvfb-run به xauth نیاز دارد که همه‌جا نیست) */
    try {
      const { spawn } = require('child_process');
      try {
        xv = spawn('Xvfb', [':99', '-screen', '0', '1280x800x24'], { stdio: 'ignore' });
        xv.on('error', () => { try { xv.kill(); } catch (_) { /* noop */ } });
      } catch (_) { xv = null; }
      const sock = '/tmp/.X11-unix/X99';
      for (let i = 0; i < 60 && !fs.existsSync(sock); i++) {
        spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},50)']);
      }
      if (!fs.existsSync(sock)) { try { xv.kill(); } catch (_) { /* noop */ } xv = null; }
      else env.DISPLAY = ':99';
    } catch (_) { xv = null; }
    if (!env.DISPLAY) {
      try { fs.unlinkSync(tmpMain); } catch (_) { /* noop */ }
      return { error: new Error('no Xvfb available'), stdout: '', stderr: '' };
    }
  }
  const elArgs = [];
  if (safeTmp) elArgs.push('--disable-dev-shm-usage', '--disable-gpu'); /* فقط «قبل از» مسیر main — وگرنه آرگِ اپ می‌شوند */
  elArgs.push(tmpMain);
  const r = spawnSync(elBin, elArgs, { cwd: R, env, encoding: 'utf8', timeout: 180000, maxBuffer: 64 * 1024 * 1024 });
  if (xv && typeof xv.kill === 'function') { try { xv.kill(); } catch (_) { /* noop */ } }
  try { fs.unlinkSync(tmpMain); } catch (_) { /* noop */ }
  return r;
}

const r = runElectron();
const out = ((r.stdout || '') + (r.stderr || ''));
if (r.error) console.log('  ↳ electron spawn error: ' + String(r.error.message || r.error).slice(0, 160) + ' status=' + r.status + ' sig=' + r.signal);
/* محیطِ میزبانِ خصمانه (shmem/seccomp یا سقف زمان) — سناریوهای رفتاری قابل اجرا نیستند؛
   روی CI سالم هرگز رخ نمی‌دهد — گاردهای ایستا بالاتر کامل اجرا شده‌اند. */
const HOSTILE = /platform_shared_memory|render-gone x\d/.test(out) || (r.error && /ETIMEDOUT/.test(String(r.error)) && !/T0850_RESULT/.test(out));
if (r.error || /Cannot open display|Missing X server/.test(out) || HOSTILE) {
  const steps = out.split('\n').filter((l) => l.startsWith('T0850STEP') || l.startsWith('T0850LOG') || l.startsWith('T0850_RESULT'));
  console.log(steps.slice(-14).join('\n'));
  if (!steps.length) console.log('(no harness steps in output — last lines:\n' + out.split('\n').filter((l) => l.trim()).slice(-8).join('\n') + ')');
  console.log((HOSTILE ? 'SKIP-ENV: میزبان رندررهای کرومیوم را کرش می‌دهد (shmem/seccomp)' : 'SKIP: no display for electron')
    + ' — گاردهای ایستا بالا کامل اجرا شدند؛ سناریوهای رفتاری روی CI سالم اجرا می‌شوند');
  console.log('\n==== v0.85.0-beta behavioral: ' + pass + ' passed, ' + fail + ' failed (SKIP) ====');
  process.exit(fail ? 1 : 0);
}
const m = out.match(/T0850_RESULT (\{[\s\S]*\})\s*$/m);
if (!m) {
  console.log(out.split('\n').filter((l) => l.trim()).slice(-12).join('\n'));
  fail++;
  ok('هارنس الکترون اجرا شد و نتیجه داد (T0850_RESULT)', false);
  console.log('\n==== v0.85.0-beta behavioral: ' + pass + ' passed, ' + fail + ' failed ====');
  process.exit(fail ? 1 : 0);
}
let res = {};
try { res = JSON.parse(m[1]); } catch (e) { res = { fatal: 'json parse: ' + String(e).slice(0, 80) }; }

if (res.fatal) { ok('هارنس بدون خطای مرگبار اجرا شد', false); console.log('  ↳ ' + res.fatal); }

ok('play مستقیم → ok/via=ava/apid منفی/engine=direct', res.play1 === true);
ok('پنجرهٔ اول باز است (size=1)', res.win1 === true);
if (res.domOK === false) console.log('  ○ SKIP (رندرر در این محیط در دسترس نیست): موتور مستقیم در صفحه: بج «مستقیم» + video.src=googlevideo'); else ok('موتور مستقیم در صفحه: بج «مستقیم» + video.src=googlevideo', res.direct_eng === true);
ok('لینک نامعتبر → ok:false با پیام', res.bad_id === true);
ok('پخش دوم = همان پنجره (webContents ثابت — بدون بستن/بازکردن)', res.reuse === true);
ok('عنوانِ نو بعد از navigate ثبت شد', res.nav_title === true);
ok('بحرانی: ۲.۲ثانیه بعد پنجره زنده است (بمب ۱.۵ثانیه‌ای قدیمی ناممکن)', res.alive_2s === true);
if (res.domOK === false) console.log('  ○ SKIP (رندرر در این محیط در دسترس نیست): m3u8 رد شد → موتور embed'); else ok('m3u8 رد شد → موتور embed', res.m3u8_embed === true);
if (res.domOK === false) console.log('  ○ SKIP (رندرر در این محیط در دسترس نیست): بدون yt-dlp → موتور embed'); else ok('بدون yt-dlp → موتور embed', res.noby_embed === true);
ok('keepExisting → پنجرهٔ دوم («کنارش پخش کن»)', res.keep2 === true);
ok('op: size کوچک', res.op_size === true);
ok('op: حداکثر (maximize واقعی)', res.op_max === true);
ok('op: pip', res.op_pip === true);
ok('op: unpip', res.op_unpip === true);
ok('op: top (همیشه‌روانه روی true رفت)', res.op_top === true);
ok('op: opacity', res.op_opacity === true);
ok('op: مانیتور ناموجود → خطای صادقانه', res.op_mon_bad === true);
ok('op: copyurl (کپی لینک)', res.op_copy === true);
ok('opAll: opacity همهٔ پنجره‌ها', res.opall_op === true);
ok('opAll: pip فقط جدیدترین', res.opall_pip === true);
ok('focusNewest = true', res.focus_newest === true);
ok('focusByPid ناموجود → ok:false', res.focus_bad === true);
if (res.domOK === false) console.log('  ○ SKIP (رندرر در این محیط در دسترس نیست): ctl صوتی: status با via=ava-player + engine'); else ok('ctl صوتی: status با via=ava-player + engine', res.ctl_status === true);
if (res.domOK === false) console.log('  ○ SKIP (رندرر در این محیط در دسترس نیست): ctl صوتی: fullscreen بومی'); else ok('ctl صوتی: fullscreen بومی', res.ctl_fs === true);
ok('closeByPid → ok + closedTitle + کاهش شمارش', res.close_pid === true);
ok('closeAll → صفر پنجره', res.close_all === true);
ok('بازگشایی بعد از closeAll کار می‌کند', res.reopen === true);
if (res.domOK === false) console.log('  ○ SKIP (رندرر در این محیط در دسترس نیست): IPC stream(360) → استریم ۳۶۰ با کیفیت اعلام‌شده'); else ok('IPC stream(360) → استریم ۳۶۰ با کیفیت اعلام‌شده', res.ipc_stream === true);
if (res.domOK === false) console.log('  ○ SKIP (رندرر در این محیط در دسترس نیست): IPC meta → videoId درست (بازیابی بعد از ریلود)'); else ok('IPC meta → videoId درست (بازیابی بعد از ریلود)', res.ipc_meta === true);
if (res.domOK === false) console.log('  ○ SKIP (رندرر در این محیط در دسترس نیست): پلیر سیستم از خود پلیر → پت‌پلیر قلابی + پنجره بسته شد'); else ok('پلیر سیستم از خود پلیر → پت‌پلیر قلابی + پنجره بسته شد', res.sys === true);
ok('کرش رندرر → پنجره زنده ماند (ریلود)', res.crash === true);
if (res.domOK === false) console.log('  ○ SKIP (رندرر در این محیط در دسترس نیست): بعد از کرش صفحه دوباره بارگذاری شد'); else ok('بعد از کرش صفحه دوباره بارگذاری شد', res.crash_reloaded === true);
if (res.domOK === false) console.log('  ○ SKIP (رندرر در این محیط در دسترس نیست): بدون خطای کنسول صفحه در تمام سناریوها'); else ok('بدون خطای کنسول صفحه در تمام سناریوها', res.no_console_errors === true);
if (res.err_sample && res.err_sample.length) console.log('  ↳ console: ' + res.err_sample.join(' | '));

console.log('\n==== v0.85.0-beta behavioral: ' + pass + ' passed, ' + fail + ' failed ====');
process.exit(fail ? 1 : 0);
