/* ============================================================
   scripts-test-v0480.js — v0.48.0-beta
   «گزارش خودکار لاگ به گیت‌هاب + لاگ ساخت‌یافته JSONL»
   ------------------------------------------------------------
   1) telemetry.js — توکن/backoff/gating/payload/ارسال (نود خالص با deps جعلی)
   2) tailBytes/maskToken/dayStamp — برش مرزِ خط + ماسک توکن
   3) main.js — JSONL ساخت‌یافته + bootId + مارکرهای session + IPC تله‌متری
   4) preload/app.js/index.html — سیم‌کشی UI + فرمان صوتی + i18n
   5) امنیت — هیچ توکنی در کد/ریپو جاسازی نیست؛ توکن در status.txt ماسک است
   6) dns-bypass — پین api.github.com/github.com + version bump
   ============================================================ */
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } }

const ROOT = __dirname;
const appSrc = fs.readFileSync(path.join(ROOT, 'renderer/js/app.js'), 'utf8');
const mainSrc = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
const preloadSrc = fs.readFileSync(path.join(ROOT, 'preload.js'), 'utf8');
const htmlSrc = fs.readFileSync(path.join(ROOT, 'renderer/index.html'), 'utf8');
const dnsSrc = fs.readFileSync(path.join(ROOT, 'lib/dns-bypass.js'), 'utf8');
const teleSrc = fs.readFileSync(path.join(ROOT, 'lib/telemetry.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const T = require(path.join(ROOT, 'lib/telemetry.js'));

/* ---------- ابزار fs جعلی (حافظه‌ای) ---------- */
function fakeFs(files) {
  return {
    readFileSync: (f) => { if (!(f in files)) throw new Error('enoent'); return files[f]; },
    statSync: (f) => { if (!(f in files)) throw new Error('enoent'); return { size: String(files[f]).length }; },
  };
}
function makeTele(over) {
  const o = over || {};
  let saved = null;
  const files = o.files || { 'activity.jsonl': '', 'activity.old.jsonl': '' };
  const t = T.createTelemetry(Object.assign({
    fs: fakeFs(files),
    version: '0.48.0-test',
    bootId: 'btest',
    platform: 'win32 test',
    env: o.env || {},
    readSettings: o.readSettings || (() => ({ logs: { auto: true, githubToken: 'tok_test_1234567890' } })),
    logDir: '/x',
    logFiles: o.logFiles || (() => ['activity.jsonl', 'activity.old.jsonl']),
    ghFetch: o.ghFetch || (async () => ({ status: 201, text: JSON.stringify({ id: 'gist1', html_url: 'https://gist.github.com/gist1' }) })),
    log: o.log || (() => {}),
    initialState: o.initialState || {},
    saveState: (s) => { saved = JSON.parse(JSON.stringify(s)); },
    now: o.now || (() => now0),
  }));
  return { t, files, getSaved: () => saved };
}
let now0 = 1000000000;

(async () => {

  /* ---------- 1) gating و توکن ---------- */
  console.log('\n[1] telemetry — gating، توکن، backoff');
  {
    const noTok = makeTele({ readSettings: () => ({ logs: { auto: true } }) });
    ok(noTok.t.status().configured === false, 'بدون توکن → configured=false');
    const g = noTok.t.shouldSend(true, false);
    ok(g.yes === false && g.why === 'no-token', 'بدون توکن ارسال ممنوع (حتی force)');
    const r0 = await noTok.t.sendOnce(true);
    ok(r0.ok === false && r0.error === 'no-token' && noTok.t.state.lastResult === 'no-token', 'sendOnce بدون توکن → خطای صادقانه no-token');

    const off = makeTele({ readSettings: () => ({ logs: { auto: false, githubToken: 'tok' } }) });
    ok(off.t.shouldSend(true, false).why === 'auto-off', 'toggle خاموش → ارسال ممنوع (حتی با توکن)');

    const envTok = makeTele({ readSettings: () => ({}), env: { AVA_LOGS_TOKEN: 'envtok' } });
    ok(envTok.t.status().configured === true, 'فالبک AVA_LOGS_TOKEN محیط');

    const m = makeTele({ files: { 'activity.jsonl': 'x'.repeat(9000), 'activity.old.jsonl': '' } });
    ok(m.t.shouldSend(true, false).yes === true, 'توکن+force → ارسال');
  }

  /* ---------- 2) ارسال موفق: create/PATCH/payload/state ---------- */
  console.log('\n[2] telemetry — create/PATCH/وضعیت پس از موفقیت');
  {
    const calls = [];
    const m = makeTele({
      files: { 'activity.jsonl': 'l1\nl2\n', 'activity.old.jsonl': 'p1\n' },
      ghFetch: async (url, opts) => { calls.push({ url, method: opts.method, body: opts.body }); return { status: 201, text: JSON.stringify({ id: 'gA', html_url: 'u' }) }; },
    });
    const r1 = await m.t.sendOnce(true);
    ok(r1.ok === true && r1.url === 'u', 'ارسال اول → ساخت Gist');
    ok(calls[0].method === 'POST' && calls[0].url === 'https://api.github.com/gists', 'اولین ارسال = POST /gists');
    const b1 = JSON.parse(calls[0].body);
    const dayKey = Object.keys(b1.files).find((k) => /^activity-\d{4}-\d{2}-\d{2}\.jsonl$/.test(k));
    ok(!!dayKey, 'بدنه دارای activity-YYYY-MM-DD.jsonl');
    ok(b1.files['status.txt'].content.indexOf('0.48.0-test') >= 0 && b1.files['status.txt'].content.indexOf('btest') >= 0, 'status.txt نسخه+bootId دارد');
    ok(b1.files['activity-old.jsonl'].content === 'p1\n', 'جلسهٔ قبل (old) هم ارسال می‌شود');
    ok(b1.public === false, 'Gist مخفی است (public=false)');
    ok(b1.files['status.txt'].content.indexOf('tok_test_1234567890') === -1 && b1.files['status.txt'].content.indexOf('tok_***') >= 0, 'توکن در status.txt ماسک است (هرگز خام نمی‌رود)');
    ok(m.t.state.gistId === 'gA' && m.t.state.failStreak === 0, 'gistId ذخیره + failStreak صفر');
    ok(m.getSaved() && m.getSaved().gistId === 'gA', 'state اتمیک ذخیره شد (ava-telemetry.json)');
    ok(m.t.state.lastLogSize === ('l1\nl2\n'.length + 'p1\n'.length), 'حجمِ لحظهٔ ارسال ثبت شد (مبنای «لاگ تازه»)');
    const r2 = await m.t.sendOnce(true);
    ok(r2.ok === true && calls[1].method === 'PATCH' && calls[1].url.indexOf('gists/gA') >= 0, 'ارسال‌های بعدی = PATCH همان گِیست');
  }

  /* ---------- 3) شکست → backoff نمایی + ریکاوری ---------- */
  console.log('\n[3] telemetry — backoff نمایی و ریکاوری');
  {
    const m = makeTele({ ghFetch: async () => ({ status: 500, text: JSON.stringify({ message: 'boom' }) }) });
    await m.t.sendOnce(true);
    ok(m.t.state.failStreak === 1 && m.t.state.lastResult.indexOf('500') >= 0, 'HTTP 500 → failStreak=۱ + lastResult صادقانه');
    const iv1 = m.t.__test.intervalMs();
    await m.t.sendOnce(true); await m.t.sendOnce(true);
    const iv2 = m.t.__test.intervalMs();
    ok(iv2 > iv1, 'backoff نمایی بزرگ‌تر شد');
    ok(iv2 <= 4 * 60 * 60 * 1000, 'سقف backoff ۴ ساعت');
    m.t.state.failStreak = 99;
    ok(m.t.__test.intervalMs() === 4 * 60 * 60 * 1000, 'failStreak بزرگ → کف سقف ۴h (نه بیشتر)');

    const m2 = makeTele({ ghFetch: async () => ({ status: 201, text: JSON.stringify({ id: 'gB' }) }) });
    m2.t.state.failStreak = 3;
    await m2.t.sendOnce(true);
    ok(m2.t.state.failStreak === 0, 'موفقیت → failStreak ریست');

    const m3 = makeTele({ ghFetch: async () => { throw new Error('ENETDOWN'); } });
    const r3 = await m3.t.sendOnce(true);
    ok(r3.ok === false && String(r3.error).indexOf('ENETDOWN') >= 0 && m3.t.state.failStreak === 1, 'throw شبکه → خطای صادقانه + failStreak');
  }

  /* ---------- 4) throttle خطا ---------- */
  console.log('\n[4] telemetry — notifyErr throttle');
  {
    const e1 = makeTele({ files: { 'activity.jsonl': new Array(5000).fill('e').join(''), 'activity.old.jsonl': '' } });
    e1.t.state.lastSentAt = now0;
    const d1 = e1.t.shouldSend(false, true);
    ok(d1.yes === false && d1.why === 'err-throttled', 'خطای تازه بلافاصله دوباره ارسال نمی‌شود (throttle ۸min)');
    now0 += 9 * 60 * 1000;
    ok(e1.t.shouldSend(false, true).yes === true, '۹ دقیقه بعد → خطا اجازهٔ ارسال دارد');
  }

  /* ---------- 5) not-enough-new + gap زمانی ---------- */
  console.log('\n[5] telemetry — not-enough-new + gap');
  {
    const m = makeTele({ files: { 'activity.jsonl': 'aaaa', 'activity.old.jsonl': '' } });
    m.t.state.lastSentAt = now0 - 20 * 60 * 1000;
    m.t.state.lastLogSize = 4;
    ok(m.t.shouldSend(false, false).why === 'not-enough-new', 'بدون لاگ تازه (≥۴KB) ارسال نمی‌شود');
    m.files['activity.jsonl'] = 'a'.repeat(5000);
    ok(m.t.shouldSend(false, false).yes === true, 'با لاگ تازه → ارسال');
    m.t.state.lastSentAt = now0 - 1 * 60 * 1000;
    ok(m.t.shouldSend(false, false).why === 'backoff', 'فاصلهٔ کمتر از ۱۵ دقیقه → backoff');
  }

  /* ---------- 6) tailBytes/maskToken/dayStamp ---------- */
  console.log('\n[6] tailBytes — برش در مرز خط + maskToken');
  {
    ok(T.tailBytes('abc', 100) === 'abc', 'کوتاه‌تر از سقف → دست‌نخورده');
    const long = Array.from({ length: 100 }, (_, i) => 'line' + i).join('\n');
    const cut = T.tailBytes(long, 30);
    ok(cut.length <= 30 && long.endsWith(cut) && cut.startsWith('line'), 'برش بزرگ→کوچک: پسوندِ متن است و از مرز خط شروع می‌شود (خطِ نصفه حذف)');
    ok(T.maskToken('ghp_abcdef1234567890') === 'ghp_***890', 'ماسک توکن در status.txt');
    ok(/^\d{4}-\d{2}-\d{2}$/.test(T.dayStamp(new Date('2026-09-01T10:00:00Z'))), 'dayStamp فرمت درست');
    ok(T.MAX_TODAY_BYTES === 1.5 * 1024 * 1024 && T.MAX_OLD_BYTES === 512 * 1024, 'سقف‌های ارسال: ۱.۵MB امروز + ۵۱۲KB جلسهٔ قبل');
    ok(T.BASE_INTERVAL_MS === 15 * 60 * 1000, 'بازهٔ پایهٔ ارسال = ۱۵ دقیقه');
  }

  /* ---------- 7) main.js — لاگ ساخت‌یافته + session + IPC ---------- */
  console.log('\n[7] main.js — JSONL، bootId، مارکرهای session، ghFetchFull، IPC');
  ok(mainSrc.includes("const telemetry = require('./lib/telemetry')"), 'main: telemetry required');
  ok(mainSrc.includes("const AVA_BOOT_ID = 'b'"), 'main: شناسهٔ نشست AVA_BOOT_ID');
  ok(mainSrc.includes("function actLog(line, tag = 'app', extra = null)"), 'main: actLog با extra (سازگار با همهٔ فراخوانی‌های قبلی)');
  ok(mainSrc.includes("fs.appendFileSync(jf, JSON.stringify(rec) + '\\n')"), 'main: نوشتن JSONL خط‌به‌خط');
  ok(mainSrc.includes("ch: String(tag || 'app')") && mainSrc.includes('v: app.getVersion(), b: AVA_BOOT_ID'), 'main: رکورد JSONL دارای t/v/b/ch/m');
  ok(mainSrc.includes("if (st.size > ACT_JSONL_MAX) fs.renameSync(jf, path.join(dir, 'activity.old.jsonl'))"), 'main: روتِیت JSONL ~۲MB → activity.old.jsonl');
  ok(mainSrc.includes("ch: 'session', ev"), 'main: مارکر session با ev');
  ok(mainSrc.includes("logSessionMarker('boot'") && mainSrc.includes("logSessionMarker('quit'") && mainSrc.includes("logSessionMarker('crash'"), 'main: مارکرهای boot/quit/crash (بوت بدون quit قبلی = کرش)');
  ok(mainSrc.includes("if (tag === 'err' && TELE) TELE.notifyErr()"), 'main: خطای تازه → فرصت ارسال زودتر تله‌متری');
  ok(mainSrc.includes('var TELE = null'), 'main: TELE var (بوت زودهنگام TDZ نمی‌خورد)');
  ok(mainSrc.includes('function ghFetchFull(url, opts)'), 'main: ghFetchFull با {status,text} برای Gist API');
  ok(mainSrc.includes("req.setHeader('Content-Length', String(buf.length))"), 'main: Content-Length بدنهٔ PATCH/POST');
  ok(mainSrc.includes('readSettings: loadedSettings'), 'main: توکن هر بار از فایل تنظیمات (تغییر UI بدون ری‌استارت)');
  ok(mainSrc.includes('saveState: (s) => { const f2 = teleStateFile(); if (f2) writeJsonAtomic(f2, s); }'), 'main: state تله‌متری اتمیک (ava-telemetry.json)');
  ok(mainSrc.includes('بازپخش لاگ نفرستادهٔ جلسهٔ قبل') || mainSrc.includes('TELE.tick().catch'), 'main: بوت → بازپخش لاگ نفرستادهٔ جلسهٔ قبل');
  ok(mainSrc.includes('5 * 60 * 1000'), 'main: تیک دوره‌ای ۵ دقیقه‌ای (گیت داخلی ۱۵min/۴KB)');
  ok(mainSrc.includes("if (msg && typeof msg === 'object' && !Array.isArray(msg))"), 'main: log:act هم رشته (سازگار) هم شیء ساخت‌یافته');
  ok(mainSrc.includes("ipcMain.handle('logs:status'") && mainSrc.includes("ipcMain.handle('logs:sendNow'"), 'main: IPC وضعیت/ارسال دستی تله‌متری');
  ok(dnsSrc.includes("'api.github.com'"), 'dns-bypass: پین api.github.com (تله‌متری + releases API)');
  ok(dnsSrc.includes("'github.com'"), 'dns-bypass: پین github.com (آپدیتر web-json/atom)');

  /* ---------- 8) preload + app.js — سیم‌کشی UI ---------- */
  console.log('\n[8] preload/app.js — bridge.logs، toggle/توکن/ارسال، فرمان صوتی');
  ok(preloadSrc.includes("act: (msg, extra) => ipcRenderer.invoke('log:act', msg, extra)"), 'preload: act ساخت‌یافته');
  ok(preloadSrc.includes("status: () => ipcRenderer.invoke('logs:status')") && preloadSrc.includes("sendNow: () => ipcRenderer.invoke('logs:sendNow')"), 'preload: bridge.logs');
  ok(appSrc.includes('const actLog = (msg, tag, extra) =>'), 'app: رپر actLog ساخت‌یافته');
  ok(appSrc.includes("logs: store.get('logs', { auto: true, githubToken: '' })"), 'app: پیش‌فرض settings.logs (auto=روشن، توکن خالی)');
  ok(appSrc.includes('async function refreshTeleStatus()'), 'app: وضعیت تله‌متری در تنظیمات');
  ok(appSrc.includes("$('#btnLogTokenSave')") && appSrc.includes("$('#btnLogSend')") && appSrc.includes("$('#optAutoLog')"), 'app: هندلرهای ذخیرهٔ توکن/ارسال الان/toggle');
  ok(appSrc.includes('if (bridge && bridge.logs && bridge.logs.status && bridge.logs.sendNow)'), 'app: فرمان صوتی گزارش → اگر توکن هست آپلود واقعی');
  ok(appSrc.includes("return t('tele.sentOk')"), 'app: پاسخ موفق صوتی («دفعه بعد خودم لاگ را می‌گیرم»)');
  ok(appSrc.includes("'tele.uiTitle'") && appSrc.includes("'tele.tokenTitle'") && appSrc.includes("'tele.stNoToken'"), 'app: i18n فارسی/انگلیسی تله‌متری');
  ok(appSrc.includes("{ ev: 'utterance', ms: Date.now() - h0, res: _dispatchOutcome || 'done' }"), 'app: لاگ نهایی utterance فیلد ساخت‌یافته دارد');
  ok(htmlSrc.includes('id="optAutoLog"') && htmlSrc.includes('id="optLogToken"') && htmlSrc.includes('id="btnLogTokenSave"') && htmlSrc.includes('id="btnLogSend"') && htmlSrc.includes('id="logStatusText"'), 'index: کارت گزارش خودکار (toggle/توکن/ارسال/وضعیت)');
  ok(htmlSrc.includes('data-i18n="tele.uiTitle"') && htmlSrc.includes('data-i18n-ph="tele.tokenPh"'), 'index: i18n کارت');
  ok(htmlSrc.includes('scopes=gist'), 'index: لینک ساخت توکنِ فقط-گیستی');

  /* ---------- 9) امنیت ---------- */
  console.log('\n[9] امنیت — هیچ توکنی در کد جاسازی نیست');
  ok(!/ghp_[A-Za-z0-9]{20,}/.test(teleSrc + mainSrc + appSrc + preloadSrc + htmlSrc + dnsSrc), 'هیچ ghp_… واقعی در سورس نیست (ریپو عمومی است)');
  ok(teleSrc.includes("Authorization: 'token ' + c.token"), 'توکن فقط در هدر درخواست استفاده می‌شود');
  ok(teleSrc.includes('tokenMasked: ') && teleSrc.includes('maskToken(c.token)'), 'status.txt فقط توکن ماسک‌شده دارد');
  ok(teleSrc.includes('AVA_LOGS_TOKEN') && mainSrc.includes('env: process.env'), 'فالبک محیطی AVA_LOGS_TOKEN (از main با env: process.env پاس می‌شود)');

  /* ---------- 10) version ---------- */
  console.log('\n[10] version bump');
  ok(pkg.version === '0.48.0-beta', 'package.json 0.48.0-beta');
  ok(htmlSrc.includes('<span id="abVersion">v0.48.0-beta</span>'), 'index.html abVersion');
  ok(fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8').includes('۰.۴۸.۰-بتا'), 'README بلاک ۰.۴۸ (ارقام فارسی)');

  console.log('\n==========================================');
  console.log('scripts-test-v0480: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);

})().catch((e) => { console.error('SUITE ERROR:', e); process.exit(1); });
