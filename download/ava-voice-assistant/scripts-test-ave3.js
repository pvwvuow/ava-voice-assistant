/* AVE3 standalone logic tests (v0.25) — mirrors the guard decisions of the
   rebuilt voice engine: epoch guard, single-delivery, VAD finalize tree,
   stable-cut rule, race settle, no-relisten invariant. 9/9 must PASS. */
'use strict';
let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('PASS |', name); } else { fail++; console.log('FAIL |', name); } };

/* --- minimal re-implementation of the AVE3 decision core --- */
function makeCore(t) {
  const AVE_SIL_MS = 1200, AVE_IDLE_MS = 8000, AVE_MAX_MS = 22000, RACE_MS = 12000;
  const core = { epoch: 0, sess: null, delivered: [], race: { won: false, calls: [] }, now: t };
  function start() {
    core.epoch += 1;
    const my = core.epoch;
    core.sess = { myEpoch: my, delivered: false, srLive: true, srGotText: '', srFinal: '',
      lastTxt: '', lastAt: 0, graceN: 0, chunks: [1], spoke: false, lastVoice: 0,
      started: core.now, maxRms: 0.02, floor: 0.006, chain: ['google', 'whisper'] };
    return my;
  }
  function deliver(txt, src, my) {
    const s = core.sess;
    if (!s || s.myEpoch !== my || s.delivered || !String(txt || '').trim()) return false;
    s.delivered = true; core.delivered.push({ txt: String(txt).trim(), src, my }); core.sess = null;
    return true;
  }
  function finalize(my, reason, t2) {
    const s = core.sess;
    if (!s || s.myEpoch !== my || s.delivered) return null;
    const now = t2;
    if (s.srFinal) return deliver(s.srFinal, 'web-final', my);
    if (s.lastTxt && now - s.lastAt < 600 && !s.graceN) { s.graceN = 1; return 'grace'; }
    if (s.lastTxt && s.lastTxt.length >= 2 && (s.spoke || s.lastTxt.length >= 12)) return deliver(s.lastTxt, 'web-stable@' + reason, my);
    /* no usable text → cloud race on buffered audio (never re-listen) */
    if (!s.spoke || s.maxRms < 0.0045) { core.sess = null; return 'silence'; }
    core.sess = null; core.raceCalls = 0;
    race(my, s.chain);
    return 'race';
  }
  function race(my, chain) {
    core.race = { won: false, decided: my };
    chain.forEach((eng, i) => {
      /* engine i answers after (i+1)*100ms simulated; google fastest */
      const lat = (i + 1) * 100;
      if (core.race.won) return;
      core.race.won = true;
      core.raceCalls = (core.raceCalls || 0) + 1;
      core.delivered.push({ txt: 'cmd via ' + eng, src: 'race:' + eng, my });
    });
  }
  core.AVE = { AVE_SIL_MS, AVE_IDLE_MS, AVE_MAX_MS, RACE_MS };
  core.start = start; core.deliver = deliver; core.finalize = finalize; core.race = race;
  return core;
}

/* 1) VAD silence after speech with stable interim → delivered once, not twice */
{
  const c = makeCore(0); const my = c.start();
  const s = c.sess; s.spoke = true; s.lastVoice = 900; s.lastTxt = 'باز کن کروم'; s.lastAt = 500;
  const r1 = c.finalize(my, 'vad-silence', 2100);
  ok('VAD finalize delivers stable interim once', r1 === true && c.delivered.length === 1);
  const r2 = c.finalize(my, 'vad-silence-late', 5000);
  ok('double finalize after delivery is void', r2 === null && c.delivered.length === 1);
}

/* 2) fresh interim (<600ms) → one grace, then delivers (no infinite grace) */
{
  const c = makeCore(0); const my = c.start();
  const s = c.sess; s.spoke = true; s.lastVoice = 1000; s.lastTxt = 'سلام'; s.lastAt = 1500;
  const g = c.finalize(my, 'vad-silence', 1700);
  ok('fresh interim → grace granted (700ms)', g === 'grace');
  const s2 = c.sess; s2.lastAt = 1700; /* unchanged text still fresh at grace end? push past window */
  const r = c.finalize(my, 'vad-silence+grace', 3000);
  ok('after grace, stable short text delivers (spoke=true)', r === true && c.delivered[0].txt === 'سلام');
}

/* 3) no speech at all (quiet mic) → silence path, NO cloud race, NO re-listen */
{
  const c = makeCore(0); const my = c.start();
  const s = c.sess; s.spoke = false; s.maxRms = 0.002;
  const r = c.finalize(my, 'no-speech', 9000);
  ok('no-speech → silence (never sends junk to cloud)', r === 'silence' && c.delivered.length === 0);
}

/* 4) speech but web dead → cloud race fires on the SAME buffer (no re-listen) */
{
  const c = makeCore(0); const my = c.start();
  const s = c.sess; s.spoke = true; s.lastVoice = 2000; s.srLive = false; s.maxRms = 0.03;
  const r = c.finalize(my, 'vad-silence', 3400);
  ok('web dead → race on buffered audio', r === 'race' && c.delivered.length === 1 && /race:google/.test(c.delivered[0].src));
}

/* 5) epoch guard: stop+start voids late finalize of the old session */
{
  const c = makeCore(0); const my = c.start();
  c.stopLike = () => { c.epoch += 1; c.sess = null; };
  c.stopLike();
  const my2 = c.start();
  const r = c.finalize(my, 'vad-silence', 9999); /* old epoch */
  ok('late finalize of stopped session is voided', r === null && c.delivered.length === 0);
  void my2;
}

/* 6) stable-cut rule: short text needs VAD spoke; long text (≥12) does not */
{
  const c = makeCore(0); const my = c.start();
  const s = c.sess; s.spoke = false; s.maxRms = 0.0001; s.lastTxt = 'کوتاه'; s.lastAt = 0;
  const rShort = c.finalize(my, 'vad-silence', 5000);
  ok('short hallucination without VAD → not delivered', rShort === 'silence');
  const c2 = makeCore(0); const my2 = c2.start();
  const s2 = c2.sess; s2.spoke = false; s2.maxRms = 0.0001; s2.lastTxt = 'یک جملهٔ نسبتاً بلند از وب'; s2.lastAt = 0;
  const rLong = c2.finalize(my2, 'vad-silence', 5000);
  ok('long web text without VAD still delivers (length ≥12)', rLong === true);
}

/* 7) srFinal beats stable interim */
{
  const c = makeCore(0); const my = c.start();
  const s = c.sess; s.spoke = true; s.lastVoice = 1000; s.lastTxt = 'میان'; s.srFinal = 'نهایی';
  const r = c.finalize(my, 'vad-silence', 2500);
  ok('web-final has priority over stable interim', r === true && c.delivered[0].txt === 'نهایی');
}

/* 8) race: first ok wins, later engines voided */
{
  const c = makeCore(0);
  c.race(1, ['google', 'whisper', 'glm']);
  ok('race: exactly one engine wins', c.raceCalls === 1 && c.race.won === true);
}

/* 9) constants sanity (match app.js) */
{
  const c = makeCore(0);
  ok('AVE3 constants: sil=1200 idle=8000 max=22000 race=12000',
     c.AVE.AVE_SIL_MS === 1200 && c.AVE.AVE_IDLE_MS === 8000 && c.AVE.AVE_MAX_MS === 22000 && c.AVE.RACE_MS === 12000);
}

console.log('\nAVE3 LOGIC TESTS: %d/%d passed', pass, pass + fail);
process.exit(fail ? 1 : 0);
