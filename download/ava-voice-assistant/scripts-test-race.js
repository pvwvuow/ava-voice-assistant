/* v0.23 — تست منطقی مسابقهٔ موازی STT (بدون Electron):
   ۱) سریع‌ترین موتور برنده می‌شود و فقط یک بار فرمان اجرا می‌شود
   ۲) همه شکست بخورند → پیام خطا
   ۳) لغو کاربر (idle) نتایج دیرهنگام را باطل می‌کند
   ۴) دو جواب هم‌زمان → فقط اولی اجرا می‌شود */
const assert = require('assert');

function makeRace(engineImpls, stateRef) {
  const RACE_MS = 20000;
  const log = { commands: [], winner: null, finished: null };
  const withEngTimeout = (pr, ms) => Promise.race([
    Promise.resolve(pr),
    new Promise((res) => setTimeout(() => res({ ok: false, error: 'timeout' }), ms)),
  ]);
  const raceSettle = (eng, r, ms) => {
    if (log.winner || stateRef.s === 'idle') { log.late = log.late || []; log.late.push(eng); return; }
    if (r && r.ok && r.text) {
      log.winner = eng;
      log.commands.push(r.text.trim());
      return;
    }
    log.failed = (log.failed || 0) + 1;
    log.lastErr = (r && r.error) || log.lastErr || '';
    if (log.failed >= engineImpls.chain.length && !log.winner && stateRef.s !== 'idle') {
      log.finished = log.lastErr || '—';
    }
  };
  engineImpls.chain.forEach((eng) => {
    const t0 = Date.now();
    withEngTimeout(Promise.resolve().then(() => engineImpls.run(eng)), RACE_MS)
      .then((r) => raceSettle(eng, r, Date.now() - t0))
      .catch(() => raceSettle(eng, { ok: false, error: 'conn' }, Date.now() - t0));
  });
  return log;
}

(async () => {
  /* ۱ — Whisper در ۱۰۰ms جواب می‌دهد، Gemini در ۳۰۰ms → برنده: whisper، فرمان: یکی */
  let s1 = { s: 'processing' };
  let l1 = makeRace({
    chain: ['whisper', 'google', 'glm', 'gemini'],
    run: async (eng) => {
      const d = eng === 'whisper' ? 100 : eng === 'google' ? 200 : eng === 'glm' ? 250 : 300;
      await new Promise((r) => setTimeout(r, d));
      return { ok: true, text: `cmd-from-${eng}` };
    },
  }, s1);
  await new Promise((r) => setTimeout(r, 500));
  assert.strictEqual(l1.winner, 'whisper', 'winner must be whisper');
  assert.deepStrictEqual(l1.commands, ['cmd-from-whisper'], 'exactly one command');
  assert.strictEqual(l1.late.length, 3, 'three late engines ignored');
  console.log('PASS 1 — fastest engine wins, single command, 3 late ignored');

  /* ۲ — همه شکست → پیام خطا (Google ok ولی متن خالی = شکست) */
  let s2 = { s: 'processing' };
  let l2 = makeRace({
    chain: ['whisper', 'google'],
    run: async (eng) => (eng === 'google' ? { ok: true, text: '' } : { ok: false, error: 'net down' }),
  }, s2);
  await new Promise((r) => setTimeout(r, 100));
  assert.strictEqual(l2.winner, null, 'no winner');
  assert.strictEqual(l2.finished, 'net down', 'failure surfaced');
  console.log('PASS 2 — all-fail surfaces last error');

  /* ۳ — کاربر لغو می‌کند (idle) قبل از جواب → هیچ فرمانی اجرا نمی‌شود */
  let s3 = { s: 'processing' };
  let l3 = makeRace({
    chain: ['gemini'],
    run: async () => { await new Promise((r) => setTimeout(r, 150)); s3.s = 'idle'; return { ok: true, text: 'late cmd' }; },
  }, s3);
  await new Promise((r) => setTimeout(r, 300));
  assert.strictEqual(l3.winner, null, 'cancelled result ignored');
  assert.deepStrictEqual(l3.commands, [], 'no command executed');
  console.log('PASS 3 — user cancel voids late results');

  /* ۴ — دو جواب تقریباً هم‌زمان → فقط اولی که settle شد اجرا می‌شود */
  let s4 = { s: 'processing' };
  let l4 = makeRace({
    chain: ['whisper', 'google'],
    run: async (eng) => { await new Promise((r) => setTimeout(r, eng === 'whisper' ? 50 : 51)); return { ok: true, text: `x-${eng}` }; },
  }, s4);
  await new Promise((r) => setTimeout(r, 200));
  assert.strictEqual(l4.commands.length, 1, 'exactly one command on near-tie');
  assert.strictEqual(l4.winner, 'whisper', 'first settler wins');
  console.log('PASS 4 — near-tie yields single execution');

  console.log('RACE LOGIC: 4/4 PASS');
  process.exit(0);
})().catch((e) => { console.error('RACE LOGIC FAIL:', e.message); process.exit(1); });
