/* ============================================================
   AVA v0.48 — ارسال خودکار لاگ به گیت‌هاب (Gist مخفی)
   ------------------------------------------------------------
   خواستهٔ کاربر: «نمیشه کاری کرد که مثلا کاربر هر کاری میکنه..لاگ خودش
   آنلاین ارسال بشه به گیت‌هاب که دفعه بعد بررسی کردی..خودت لاگ‌ها رو
   بررسی کنی» — یعنی ممیزی بعدی بدون رفت‌وآمد فایل انجام می‌شود.

   طراحی:
   - مقصد: یک Gist مخفی «AVA — Telemetry» در حساب صاحب توکن.
     * مخفی (secret) است: بدون لینک دیده نمی‌شود و به ریپوی عمومی هم
       وصل نیست؛ توکنِ لازم فقط scope گِیست دارد (نه ریپو، نه چیز دیگر).
   - فایل‌های گِیست: activity-YYYY-MM-DD.jsonl (دمِ لاگ امروز) +
     activity-old.jsonl (دمِ جلسهٔ قبل، برای ردیابی کرش) + status.txt.
   - ساختار لاگ در همین نسخه JSONL شد (main.js): هر خط = یک رخداد با
     t/v/b/ch/m + فیلدهای اختیاری (engine/dur/rule/res/…) — تحلیل
     ماشینی خیلی دقیق‌تر از متن آزاد.
   - توکن: فقط از ava-settings.json (کلید logs.githubToken) یا متغیر
     محیطی AVA_LOGS_TOKEN می‌آید. هیچ توکنی داخل این فایل/ریپوی عمومی
     جاسازی نمی‌شود (ریپو public است — امنیت مقدم است). UI تنظیمات
     ورودی توکن + لینک ساخت توکنِ فقط-گیستی دارد.
   - زمان‌بندی: هر ۱۵ دقیقه اگر ≥۴KB لاگ تازه باشد؛ روی خطا (ch=err)
     حداکثر هر ۸ دقیقه؛ backoff نمایی روی شکست (۱۵min → حداکثر ۴h)؛
     سقف ارسال ۱.۵MB دمِ امروز + ۵۱۲KB جلسهٔ قبل (برش در مرز خط).
   - این ماژول عمداً وابسته به Electron نیست (تزریق وابستگی) تا در
     تست‌های نود خالص هم قابل اجرا باشد — الگوی voiceLearn.js.
   ============================================================ */

'use strict';

const MAX_TODAY_BYTES = 1.5 * 1024 * 1024;
const MAX_OLD_BYTES = 512 * 1024;
const BASE_INTERVAL_MS = 15 * 60 * 1000;
const ERR_THROTTLE_MS = 8 * 60 * 1000;
const MIN_NEW_BYTES = 4 * 1024;
const MAX_BACKOFF_MS = 4 * 60 * 60 * 1000;

function pad2(n) { return (n < 10 ? '0' : '') + n; }
function dayStamp(d) {
  const x = (d instanceof Date) ? d : new Date();
  return x.getFullYear() + '-' + pad2(x.getMonth() + 1) + '-' + pad2(x.getDate());
}
function isoNow() { return new Date().toISOString(); }

/* برش آخرِ فایل تا سقف بایت، در مرز خط — همیشه جدیدترین خط‌ها می‌مانند */
function tailBytes(text, maxBytes) {
  const t = String(text || '');
  if (!maxBytes || t.length <= maxBytes) return t;
  const cut = t.slice(t.length - maxBytes);
  const nl = cut.indexOf('\n');
  return nl >= 0 ? cut.slice(nl + 1) : cut;
}

/* فیلد f در JSONL نباید توکن باشد — ماسک سطحی برای هر رشتهٔ شبیه ghp_ */
function maskToken(s) {
  const str = String(s || '');
  if (!str) return '';
  return str.length > 10 ? str.slice(0, 4) + '***' + str.slice(-3) : '***';
}

function createTelemetry(deps) {
  const D = deps || {};
  const log = D.log || function () { /* noop */ };
  const now = D.now || (() => Date.now());

  const state = Object.assign({
    gistId: '', lastSentAt: 0, lastResult: '', lastBytes: 0,
    failStreak: 0, lastErrAt: 0, lastLogSize: 0,
  }, D.initialState || {});

  function saveState() {
    try { if (D.saveState) D.saveState(state); } catch (_) { /* noop */ }
  }

  function cfg() {
    const s = D.readSettings ? (D.readSettings() || {}) : {};
    const l = (s.logs && typeof s.logs === 'object') ? s.logs : {};
    return {
      auto: l.auto !== false, /* v0.48 پیش‌فرض: روشن (خواستهٔ صریح کاربر) */
      token: String(l.githubToken || '') || String((D.env && D.env.AVA_LOGS_TOKEN) || ''),
      intervalMs: BASE_INTERVAL_MS,
    };
  }

  function intervalMs() {
    if (state.failStreak <= 0) return BASE_INTERVAL_MS;
    const ms = BASE_INTERVAL_MS * Math.pow(2, Math.min(state.failStreak, 4));
    return Math.min(ms, MAX_BACKOFF_MS);
  }

  function configured() { return !!cfg().token; }

  function status() {
    const c = cfg();
    return {
      configured: !!c.token,
      auto: c.auto,
      gistId: state.gistId || '',
      lastSentAt: state.lastSentAt || 0,
      lastResult: state.lastResult || '',
      lastBytes: state.lastBytes || 0,
      failStreak: state.failStreak || 0,
      nextCheckMs: intervalMs(),
    };
  }

  /* حجم فعلی فایل‌های لاگ — «چند بایت جدید» = حجم فعلی − حجم آخرین ارسال */
  function logSizeNow(files) {
    let total = 0;
    try {
      for (const f of files) {
        try { total += D.fs.statSync(f).size; } catch (_) { /* فایل نیست */ }
      }
    } catch (_) { /* noop */ }
    return total;
  }

  function shouldSend(force, isErrTrigger) {
    const c = cfg();
    if (!c.auto) return { yes: false, why: 'auto-off' };
    if (!c.token) return { yes: false, why: 'no-token' };
    if (force) return { yes: true };
    const t = now();
    const gap = t - (state.lastSentAt || 0);
    if (isErrTrigger) {
      if (gap >= ERR_THROTTLE_MS && t - (state.lastErrAt || 0) >= ERR_THROTTLE_MS) {
        state.lastErrAt = t; return { yes: true };
      }
      return { yes: false, why: 'err-throttled' };
    }
    if (gap < intervalMs()) return { yes: false, why: 'backoff' };
    const files = D.logFiles ? D.logFiles() : [];
    const nb = Math.max(0, logSizeNow(files) - (state.lastLogSize || 0));
    if (nb < MIN_NEW_BYTES) return { yes: false, why: 'not-enough-new' };
    return { yes: true };
  }

  /* بدنهٔ گِیست: دمِ امروز + دمِ جلسهٔ قبل + status.txt خلاصه */
  function buildPayload() {
    const fs2 = D.fs;
    const today = dayStamp();
    const files = D.logFiles ? D.logFiles() : [];
    let todayText = '';
    let oldText = '';
    for (const f of files) {
      try {
        const txt = String(fs2.readFileSync(f, 'utf8') || '');
        if (f.indexOf('old.') >= 0) oldText = txt; else todayText = txt;
      } catch (_) { /* noop */ }
    }
    const oldName = 'activity-old.jsonl';
    const out = {
      ['activity-' + today + '.jsonl']: { content: tailBytes(todayText, MAX_TODAY_BYTES) || '(خالی — هنوز رخدادی در این جلسه ثبت نشده)' },
      'status.txt': { content: buildStatus() },
    };
    if (oldText.trim()) out[oldName] = { content: tailBytes(oldText, MAX_OLD_BYTES) };
    return out;
  }

  function buildStatus() {
    const c = cfg();
    const lines = [
      'AVA telemetry status',
      'version: ' + (D.version || '?'),
      'bootId: ' + (D.bootId || '?'),
      'platform: ' + (D.platform || process.platform),
      'utc: ' + isoNow(),
      'autoUpload: ' + (c.auto ? 'on' : 'off'),
      'lastSentAt: ' + (state.lastSentAt ? new Date(state.lastSentAt).toISOString() : 'never'),
      'lastResult: ' + (state.lastResult || '—'),
      'lastBytes: ' + (state.lastBytes || 0),
      'failStreak: ' + (state.failStreak || 0),
      'tokenMasked: ' + (c.token ? maskToken(c.token) : '(none)'),
      '',
      'recent errors:',
    ];
    let errs = [];
    try {
      const files = D.logFiles ? D.logFiles() : [];
      for (const f of files) {
        try {
          const txt = String(D.fs.readFileSync(f, 'utf8') || '');
          const tail = tailBytes(txt, 256 * 1024);
          errs = errs.concat(tail.split('\n').filter((l) => (l.indexOf('"ch":"err"') >= 0) || (l.indexOf('"ch":"stt"') >= 0 && l.indexOf('fail') >= 0)));
        } catch (_) { /* noop */ }
      }
    } catch (_) { /* noop */ }
    lines.push(...errs.slice(-8).map((l) => '  ' + l.slice(0, 220)));
    if (errs.length === 0) lines.push('  (none)');
    return lines.join('\n').slice(0, 20 * 1024);
  }

  /* ارسال واقعی — ghFetch: (url, {method, headers, body}) → {status, text} */
  async function sendOnce(force) {
    const c = cfg();
    if (!c.token) { state.lastResult = 'no-token'; return { ok: false, error: 'no-token' }; }
    if (!force && !shouldSend(false, false).yes) return { ok: false, error: 'skipped' };
    const body = buildPayload();
    const ghHeaders = {
      Authorization: 'token ' + c.token,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'AVA-Voice-Assistant-Telemetry',
      'Content-Type': 'application/json',
    };
    let res = null;
    try {
      if (state.gistId) {
        res = await D.ghFetch('https://api.github.com/gists/' + encodeURIComponent(state.gistId), { method: 'PATCH', headers: ghHeaders, body: JSON.stringify({ files: body }) });
      } else {
        res = await D.ghFetch('https://api.github.com/gists', { method: 'POST', headers: ghHeaders, body: JSON.stringify({ description: 'AVA — Telemetry (auto)', public: false, files: body }) });
      }
    } catch (e) {
      state.failStreak = (state.failStreak || 0) + 1;
      state.lastResult = 'network: ' + String((e && e.message) || e).slice(0, 90);
      saveState();
      try { log('telemetry send failed: ' + state.lastResult, 'err'); } catch (_) { /* noop */ }
      return { ok: false, error: state.lastResult };
    }
    const httpStatus = res ? res.status : 0;
    let j = null;
    try { j = JSON.parse(res && res.text || '{}'); } catch (_) { /* noop */ }
    if (httpStatus >= 200 && httpStatus < 300 && j && j.id) {
      const kb = Object.keys(body).reduce((a, k) => a + ((body[k].content || '').length), 0);
      state.gistId = String(j.id);
      state.lastSentAt = now();
      state.failStreak = 0;
      state.lastResult = 'ok (' + Math.round(kb / 1024) + 'KB)';
      state.lastBytes = kb;
      state.lastLogSize = logSizeNow(D.logFiles ? D.logFiles() : []);
      saveState();
      try { log('telemetry sent: gist ' + state.gistId + ' ' + state.lastResult, 'telemetry'); } catch (_) { /* noop */ }
      return { ok: true, url: (j.html_url || ('https://gist.github.com/' + j.id)), bytes: kb };
    }
    state.failStreak = (state.failStreak || 0) + 1;
    const em = (j && j.message) || ('HTTP ' + httpStatus);
    state.lastResult = 'http ' + httpStatus + ': ' + String(em).slice(0, 90);
    saveState();
    try { log('telemetry send failed: ' + state.lastResult, 'err'); } catch (_) { /* noop */ }
    return { ok: false, error: state.lastResult, status: httpStatus };
  }

  /* خطای تازهٔ لاگ‌شده → فرصت ارسال زودتر (با تrottle داخلی shouldSend) */
  function notifyErr() {
    try {
      const c = cfg();
      if (!c.auto || !c.token) return;
      const d = shouldSend(false, true);
      if (d.yes) { /* آگاهانه آسنکرون بدون await — آپلود پس‌زمینه */ sendOnce(true).catch(() => { /* noop */ }); }
    } catch (_) { /* noop */ }
  }

  function tick(force) {
    const d = shouldSend(!!force, false);
    if (d.yes) return sendOnce(true);
    return Promise.resolve({ ok: false, error: d.why || 'skipped' });
  }

  return {
    status, configured, shouldSend, buildPayload, buildStatus, sendOnce,
    notifyErr, tick, state, logSizeNow: () => logSizeNow(D.logFiles ? D.logFiles() : []),
    __test: { tailBytes, maskToken, dayStamp, intervalMs, cfg },
  };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { createTelemetry, tailBytes, maskToken, dayStamp, MAX_TODAY_BYTES, MAX_OLD_BYTES, BASE_INTERVAL_MS };
