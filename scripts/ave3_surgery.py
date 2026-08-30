# -*- coding: utf-8 -*-
"""AVE3 surgery v1 — replace old STT pipeline in app.js with AVE3 engine.
Bottom-up line-range splices with anchor verification, then dynamic edits."""
import io, sys, re, json, os

ROOT = '/home/z/my-project/download/ava-voice-assistant'
APP = os.path.join(ROOT, 'renderer/js/app.js')

with io.open(APP, 'r', encoding='utf-8') as f:
    lines = f.read().split('\n')  # 0-based internally; doc lines are 1-based

def L(n):  # 1-based line content
    return lines[n-1]

def expect(n, sub, tag):
    if sub not in L(n):
        print('ANCHOR FAIL at line %d (%s): expected %r, got: %r' % (n, tag, sub, L(n)[:120]))
        sys.exit(1)

# ---------------- verify anchors BEFORE surgery ----------------
expect(2594, '/* ====', 'globals-open')
expect(2595, 'تشخیص گفتار واقعی', 'globals-head')
expect(2610, 'GLM_ON_LVL', 'globals-tail')
expect(2692, 'بعد از موتور وب', 'fallback-head')
expect(2835, 'return r;', 'makeRec-tail')
expect(2836, '  }', 'makeRec-close')
expect(2838, 'موتور رایگان گوگل', 'google-head')
expect(3075, 'const startCloudListen = startGoogleListen;', 'alias')
expect(3077, 'موتور GLM-ASR', 'glm-head')
expect(3182, 'return f32.slice(s, e);', 'trim-tail')
expect(3849, 'گوش دادن', 'listen-head')
expect(3851, 'function startListening', 'startListening')
expect(3901, "noEngine(t('stt.noEngineApp'));", 'startListening-tail1')
expect(3917, 'function stopListening', 'stopListening')
expect(3943, 'statusText.innerHTML = IDLE_HINT;', 'stopListening-body')
print('anchors OK')

# ---------------- PART1: globals (replaces 2594-2611) ----------------
P1 = r'''  /* ============================================================
     AVE3 — موتور مکالمهٔ صوتی آوا، نسل سوم (بازسازی کامل — v0.25)
     ------------------------------------------------------------
     درخواست کاربر: «مکالمه و گرفتن صدا هنوز مشکل دارد — از نو
     کامل بساز». این یک بازنویسی تمام‌عیار است، نه وصله:

     ۱) هر جلسهٔ گوش‌دادن دو مسیرِ موازی دارد:
        • مسیر زندهٔ وب: همان شنوندهٔ کرومیوم که در پیش‌نمایش کروم
          کاربر «خیلی خوب» جواب داد — متن لحظه‌ای
        • مسیر بافر: ضبط واقعی PCM از «لحظهٔ صفر» + VAD تطبیقی
     ۲) ⭐ «گوش دادن دوباره» وجود ندارد — ریشهٔ اصلی «گرفتن صدا»:
        قبلاً اگر موتور وب می‌مرد، گوش‌دادن از صفر شروع می‌شد و
        کاربر باید حرفش را دوباره می‌گفت. حالا همان صدایی که از
        اول ضبط شده، بی‌درنگ به موتورهای ابری می‌رود.
     ۳) پایان جمله را VAD (سکوت واقعی پس از گفتار) تصمیم می‌گیرد،
        نه انتظار برای «final» گوگل؛ متن میانی که ۷۵۰/۱۱۰۰ms ثابت
        بماند همان لحظه تحویل گرفته می‌شود (ارث v0.19).
     ۴) موتورهای ابری روی همان یک صدا مسابقهٔ موازی می‌دهند
        (سقف ۱۲ ثانیه برای هر موتور) — فیوز/چسبندگی سر جایش است.
     ============================================================ */
  const AVE_SIL_MS = 1200;   /* سکوتِ پایان جمله پس از گفتار (VAD) */
  const AVE_IDLE_MS = 8000;  /* اگر هیچ گفتاری نشنید */
  const AVE_MAX_MS = 22000;  /* سقف کل جلسهٔ گوش دادن */
  const RACE_MS = 12000;     /* سقف هر موتور ابری در مسابقه */
  let ave = null;            /* جلسهٔ جاری AVE3 */
  let aveEpoch = 0;          /* نسل جلسه — رویدادهای جلسهٔ قدیمی را می‌کشد */
  let rec = null, recActive = false; /* موتور وب جلسهٔ جاری */
  let webFailStreak = 0, demoNoticeShown = false;
  /* v0.24 — srBroken «مهر زمانی بنچ» است نه پرچم همیشگی: خطای اولیهٔ
     شبکه (مثلاً قبل از فعال شدن DNS) موتور وب را برای همیشه نمی‌کشد —
     بعد از ۹۰ ثانیه دوباره شانس می‌گیرد (مثل کروم) */
  let srBroken = 0;
  const SR_BENCH_MS = 90000;
  const srUsable = () => !!SRC && (!srBroken || Date.now() > srBroken);
  const ASR_MODEL = 'glm-asr-2512';'''

# ---------------- PART2: session core (replaces 2692-2836) ----------------
P2 = r'''  /* ============================ AVE3 هسته ============================ */

  /* شروع جلسه: دو مسیر موازی (وب زنده + بافر PCM) */
  function aveStart() {
    aveEpoch += 1;
    const myEpoch = aveEpoch;
    setState('listening');
    body.classList.remove('has-card');
    respCard.classList.remove('show');
    sbMic.innerHTML = `<i class="dot rec"></i>${t('mic.rec')}`;
    setLiveText(t('live.on'));
    stopGoogleSpeak(); /* اگر آوا مشغول حرف زدن بود ساکت شود تا گوش دهد */
    if (audioCtx && audioCtx.state === 'suspended') { try { audioCtx.resume(); } catch (_) { /* noop */ } }
    const eng = settings.sttEngine || 'auto';
    const chain = buildCloudChain();
    const webOn = (eng === 'auto' || eng === 'web') && srUsable();
    ave = {
      myEpoch, chain, webOn,
      delivered: false, srLive: false, srGotText: '', srFinal: '',
      lastTxt: '', lastAt: 0, graceN: 0,
      chunks: [], spoke: false, lastVoice: 0, started: 0, maxRms: 0, floor: 0.006,
      proc: null, srcNode: null, sink: null,
      tVad: null, tStable: null, tGrace: null,
    };
    attachMic().then((ok) => {
      if (myEpoch !== aveEpoch) return; /* جلسه عوض شد */
      if (!ok) { ave = null; rec = null; recActive = false; noEngine(t('stt.micMissing')); return; }
      if (webOn) aveTrackA(myEpoch);
      else if (chain.length) statusText.textContent = t('status.googleListen');
      aveTrackB(myEpoch);
      /* کمربند امنیتی: اگر همه‌چیز گم شد، ۳۵ ثانیه بعد حالت اول */
      listenTimer = setTimeout(() => {
        if (state === 'listening') { aveStopSession(); setLiveText(''); statusText.innerHTML = IDLE_HINT; }
      }, 35000);
    });
  }

  /* برش سریع فقط برای فرمان‌های کامل‌نما (ارث v0.19) */
  const QUICK_CMD_RE = /^(باز\s?کن|اجرا\s?کن|روشن\s?کن|خاموش\s?کن|ریستارت|کامپیوتر\s?(رو\s?)?(بخوابون|خاموش)|پخش|پاز|آهنگ\s?(بعدی|قبلی)|موزیک|مدیای|بلند\s?تر|کم\s?تر|میوت|بی\s?صدا|تنظیم\s?دی\s?ان\s?اس|دی\s?ان\s?اس|زنگ\s?بزن|تماس\s?بگیر|قطع\s?کن|یادم\s?بنداز|ساعت\s?چند|چند\s?ساعت|تاریخ|باتری|اسکرین\s?شات|قفل\s?کن|مانیتور\s?رو|پینگ)/i;

  /* بازخورد زنده: متن شنیده‌شده همان لحظه در کارت پاسخ + زیر دکمه */
  function aveLiveHeard(txt) {
    if (dictation.active) { dictInterim.textContent = txt; return; }
    statusText.textContent = t('status.heard', { x: txt });
    setLiveText(txt);
    rcTag.textContent = t('tag.heard');
    rcHeard.textContent = `«${txt}»`;
    if (!respCard.classList.contains('show')) { body.classList.add('has-card'); respCard.classList.add('show'); }
  }

  /* مسیر زندهٔ وب — همان شنوندهٔ کروم؛ ⚠ اگر مرد، هیچ‌کس «دوباره گوش
     نمی‌دهد»: بافرِ مسیر B خودش فالبک است و کاربر چیزی را تکرار نمی‌کند */
  function aveTrackA(myEpoch) {
    const ut0 = Date.now();
    const r = new SRC();
    r.lang = settings.sttLang || 'fa-IR';
    r.interimResults = true;
    r.continuous = false;
    rec = r; recActive = true;
    r.onresult = (e) => {
      if (!ave || ave.myEpoch !== myEpoch || ave.delivered) return;
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const tr = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += tr; else interim += tr;
      }
      const txt = (final || interim).trim();
      if (txt && !ave.srGotText) {
        ave.srGotText = txt;
        webFailStreak = 0; /* موتور وب زنده است */
        actLog('stt web first-result ' + (Date.now() - ut0) + 'ms');
      }
      if (txt) aveLiveHeard(txt);
      if (final) { ave.srFinal = final.trim(); aveDeliver(ave.srFinal, 'web-final', myEpoch); return; }
      if (interim) {
        const tr2 = interim.trim();
        const nowT = Date.now();
        if (tr2 !== ave.lastTxt) {
          ave.lastTxt = tr2; ave.lastAt = nowT;
          clearTimeout(ave.tStable);
          const isQuick = QUICK_CMD_RE.test(tr2) && tr2.length >= 9 && tr2.length <= 60;
          ave.tStable = setTimeout(() => {
            /* برش زودهنگام: متن ثابت مانده + VAD گفتار دیده (یا جملهٔ بلندتر از روای خیالی) */
            if (ave && ave.myEpoch === myEpoch && !ave.delivered && tr2 && (ave.spoke || tr2.length >= 12)) aveDeliver(tr2, 'web-stable', myEpoch);
          }, isQuick ? 750 : 1100);
        }
      }
    };
    r.onerror = (e) => {
      if (!ave || ave.myEpoch !== myEpoch) return;
      actLog('stt web error: ' + e.error);
      ave.srLive = false;
      recActive = false;
      if (['network', 'not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'].includes(e.error)) {
        webFailStreak += 1;
        if (webFailStreak >= 2) {
          srBroken = Date.now() + SR_BENCH_MS; /* بنچ ۹۰ ثانیه‌ای (v0.24) */
          webFailStreak = 0;
          refreshEngineUI();
          actLog('stt web benched 90s (2 fails) — will re-probe automatically');
        }
        if (state === 'listening') statusText.textContent = t('stt.webFail');
      }
    };
    r.onend = () => {
      if (!ave || ave.myEpoch !== myEpoch) return;
      recActive = false;
      /* گوگل جلسه را بست: متن مستابل موجود؟ همین حالا تحویل — وگرنه
         VAD/بافر ادامه می‌دهد (بدون شروع دوبارهٔ گوش دادن) */
      if (!ave.delivered && ave.lastTxt && (ave.spoke || ave.lastTxt.length >= 12)) aveDeliver(ave.lastTxt, 'web-onend', myEpoch);
    };
    try { r.start(); ave.srLive = true; statusText.textContent = t('status.listening'); }
    catch (_) {
      actLog('stt web start failed — buffer path stays armed (no re-listen)');
      ave.srLive = false; recActive = false;
      webFailStreak += 1;
      if (webFailStreak >= 2) { srBroken = Date.now() + SR_BENCH_MS; webFailStreak = 0; refreshEngineUI(); }
      if (ave.chain.length) statusText.textContent = t('stt.webFail');
    }
  }'''

# ---------------- PART3: helpers + buffer/finalize/race (replaces 2838-3075) ----------------
P3 = r'''  /* --- ابزار صوتی خالص (ارث نسخه‌های قبل — بدون وابستگی) --- */
  function downsampleF32(f32, from, to) {
    if (from === to) return f32;
    const ratio = from / to;
    const len = Math.max(1, Math.floor(f32.length / ratio));
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const pos = i * ratio;
      const i0 = Math.floor(pos);
      const frac = pos - i0;
      const s0 = f32[i0] || 0;
      const s1 = f32[i0 + 1] || s0;
      out[i] = s0 + (s1 - s0) * frac;
    }
    return out;
  }

  function f32ToI16(f32) {
    const out = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      const v = Math.max(-1, Math.min(1, f32[i]));
      out[i] = v < 0 ? v * 32768 : v * 32767;
    }
    return out;
  }

  /* ساخت فایل WAV استاندارد از PCM خام */
  function pcmToWavBlob(pcm16, sampleRate) {
    const bytesPerSample = 2, numCh = 1;
    const dataSize = pcm16.length * bytesPerSample;
    const buf = new ArrayBuffer(44 + dataSize);
    const v = new DataView(buf);
    const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); v.setUint32(4, 36 + dataSize, true); ws(8, 'WAVE');
    ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, numCh, true);
    v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * numCh * bytesPerSample, true);
    v.setUint16(32, numCh * bytesPerSample, true); v.setUint16(34, 16, true);
    ws(36, 'data'); v.setUint32(40, dataSize, true);
    for (let i = 0; i < pcm16.length; i++) v.setInt16(44 + i * 2, pcm16[i], true);
    return new Blob([buf], { type: 'audio/wav' });
  }

  /* نرمال‌سازی بلندی صدا: میکروفون‌های کم‌صدا/دور را تقویت می‌کند */
  function normalizeLoudness(f32) {
    let sum = 0, n = 0;
    for (let i = 0; i < f32.length; i += 2) { sum += f32[i] * f32[i]; n++; }
    const rms = Math.sqrt(sum / Math.max(1, n));
    if (!isFinite(rms) || rms < 1e-5) return f32;
    const gain = Math.min(6, 0.035 / rms); /* هدف RMS حدود ۰٫۰۳۵ — حداکثر ×۶ */
    if (gain > 0.97 && gain < 1.03) return f32;
    const out = new Float32Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      const v = f32[i] * gain;
      out[i] = v > 1 ? 1 : v < -1 ? -1 : v;
    }
    return out;
  }

  /* مسیر بافر: ضبط PCM از لحظهٔ صفر + VAD تطبیقی — فالبکی که همیشه هست */
  function aveTrackB(myEpoch) {
    try {
      const src = audioCtx.createMediaStreamSource(micStream);
      const proc = audioCtx.createScriptProcessor(4096, 1, 1);
      const sink = audioCtx.createGain();
      sink.gain.value = 0; /* بی‌صدا — فقط برای پردازش */
      src.connect(proc); proc.connect(sink); sink.connect(audioCtx.destination);
      ave.srcNode = src; ave.proc = proc; ave.sink = sink;
      proc.onaudioprocess = (e) => aveOnFrame(myEpoch, e.inputBuffer.getChannelData(0));
      ave.started = Date.now();
      ave.tVad = setInterval(() => aveVadTick(myEpoch), 120);
    } catch (_) {
      actLog('stt buffer recorder failed');
      if (!ave || !ave.srLive) { ave = null; recActive = false; setState('idle'); noEngine(t('stt.startFail')); }
    }
  }

  function aveOnFrame(myEpoch, f) {
    if (!ave || ave.myEpoch !== myEpoch || ave.delivered) return;
    ave.chunks.push(new Float32Array(f));
    let sum = 0, n = 0;
    for (let i = 0; i < f.length; i += 4) { sum += f[i] * f[i]; n++; }
    const rms = Math.sqrt(sum / Math.max(1, n));
    if (rms > ave.maxRms) ave.maxRms = rms;
    /* آستانهٔ تطبیقی (ارث از نسخهٔ ۰.۱۰ که «صدا دریافت نشد» را فیکس کرد) */
    const thr = Math.max(0.005, Math.min(0.04, ave.floor * 2.2 + 0.0035));
    if (!ave.spoke) ave.floor = ave.floor * 0.92 + rms * 0.08;
    if (rms > thr) {
      if (!ave.spoke) {
        ave.spoke = true;
        if (state === 'listening' && !ave.srGotText) statusText.textContent = t('stt.heardLive');
      }
      ave.lastVoice = Date.now();
    }
  }

  /* تیک VAD: پایان جمله = سکوت واقعی پس از گفتار */
  function aveVadTick(myEpoch) {
    if (!ave || ave.myEpoch !== myEpoch || ave.delivered) return;
    const now = Date.now();
    const dur = now - (ave.started || now);
    if (ave.spoke && ave.lastVoice && now - ave.lastVoice >= AVE_SIL_MS) { aveFinalize(myEpoch, 'vad-silence'); return; }
    if (!ave.spoke && dur >= AVE_IDLE_MS) { aveFinalize(myEpoch, 'no-speech'); return; }
    if (dur >= AVE_MAX_MS) { aveFinalize(myEpoch, 'session-max'); return; }
  }

  /* تحویل نهایی متن — تک‌نقطهٔ خروج همهٔ مسیرها */
  function aveDeliver(txt, src, myEpoch) {
    if (!ave || ave.myEpoch !== myEpoch || ave.delivered) return;
    const s = String(txt || '').trim();
    if (!s) return;
    ave.delivered = true;
    clearTimeout(listenTimer);
    aveKillAudio();
    if (rec) { try { rec.onend = null; rec.stop(); } catch (_) { /* noop */ } }
    rec = null; recActive = false;
    actLog('stt final(' + src + '): ' + s.slice(0, 60));
    ave = null;
    setLiveText('');
    setState('idle');
    sbMic.innerHTML = `<i class="dot ok"></i>${t('mic.ready')}`;
    if (dictation.active) dictateHandle(s);
    else handleUtterance(s);
  }

  /* پایان جلسه بدون متن تحویل‌شده — تصمیم: متن وب آماده؟ بافر به ابر برود؟ */
  function aveFinalize(myEpoch, reason) {
    if (!ave || ave.myEpoch !== myEpoch || ave.delivered) return;
    const now = Date.now();
    if (ave.srFinal) { aveDeliver(ave.srFinal, 'web-final', myEpoch); return; }
    /* متن میانی خیلی تازه است؟ ۷۰۰ms مهلت برای final وب (فقط یک‌بار) */
    if (ave.lastTxt && now - ave.lastAt < 600 && !ave.graceN) {
      ave.graceN = 1;
      clearTimeout(ave.tGrace);
      ave.tGrace = setTimeout(() => { if (ave && ave.myEpoch === myEpoch && !ave.delivered) aveFinalize(myEpoch, reason + '+grace'); }, 700);
      return;
    }
    if (ave.lastTxt && ave.lastTxt.length >= 2 && (ave.spoke || ave.lastTxt.length >= 12)) { aveDeliver(ave.lastTxt, 'web-stable@' + reason, myEpoch); return; }
    /* وب زنده بود ولی از کل جمله هیچ نداد → موتور وب ناشنواست */
    if (ave.webOn && ave.srLive && !ave.srGotText) {
      webFailStreak += 1;
      if (webFailStreak >= 2) { srBroken = Date.now() + SR_BENCH_MS; webFailStreak = 0; refreshEngineUI(); actLog('stt web benched 90s (deaf, 2 fails)'); }
    }
    aveKillAudio();
    if (rec) { try { rec.onend = null; rec.stop(); } catch (_) { /* noop */ } }
    rec = null; recActive = false;
    const rate = (audioCtx && audioCtx.sampleRate) || 48000;
    const totalMs = (ave.chunks.length * 4096 * 1000) / rate;
    if (!ave.spoke || ave.maxRms < 0.0045 || totalMs < 350) {
      actLog('stt session end(' + reason + ') — no usable audio (maxRms=' + ave.maxRms.toFixed(4) + ', ' + Math.round(totalMs) + 'ms)');
      ave = null;
      statusText.textContent = t('status.silence');
      setTimeout(() => { if (state === 'listening' || state === 'processing') { setState('idle'); statusText.innerHTML = IDLE_HINT; sbMic.innerHTML = `<i class="dot ok"></i>${t('mic.ready')}`; } }, 1500);
      if (dictation.active) setTimeout(rearmDictation, 1500);
      return;
    }
    /* ⭐ ساخت WAV از همان صدای همیشه-ضبط‌شده + مسابقهٔ ابری — بدون گوش دادن دوباره */
    const merged = new Float32Array(ave.chunks.reduce((a, c) => a + c.length, 0));
    let off = 0;
    for (const c of ave.chunks) { merged.set(c, off); off += c.length; }
    const pcm16 = f32ToI16(normalizeLoudness(trimSilenceEdges(downsampleF32(merged, rate, 16000), 16000)));
    const wavBlob = pcmToWavBlob(pcm16, 16000);
    const sessChain = ave.chain;
    ave = null;
    setState('processing');
    aveCloudRace(myEpoch, wavBlob, pcm16, sessChain);
  }

  /* هیچ موتوری حق گیر کردن ندارد — سقف زمانی سخت هر موتور */
  const withEngTimeout = (pr, ms) => Promise.race([
    Promise.resolve(pr),
    new Promise((res) => setTimeout(() => res({ ok: false, error: 'timeout' }), ms)),
  ]);

  /* مسابقهٔ موازی موتورهای ابری روی همان یک صدا (ارث v0.23، سقف ۱۲s) */
  function aveCloudRace(myEpoch, wavBlob, pcm16, chain) {
    if (!chain.length) {
      setState('idle');
      statusText.innerHTML = t('stt.noEngine', { x: t('stt.noEngineApp') });
      sbMic.innerHTML = `<i class="dot ok"></i>${t('mic.ready')}`;
      if (dictation.active) setTimeout(rearmDictation, 1500);
      return;
    }
    statusText.textContent = t('stt.racing', { x: chain.map((e) => t('eng.' + e)).join(' + ') });
    const pcmBytes = new Uint8Array(pcm16.buffer);
    let won = false, fails = 0, lastErr = '';
    const isDead = () => aveEpoch !== myEpoch; /* لغو کاربر/جلسهٔ جدید → همهٔ نتایج باطل */
    const raceSettle = (eng, r, ms) => {
      if (won || isDead()) { actLog('stt ' + eng + ' late (' + ms + 'ms) — race already decided'); return; }
      if (r && r.ok && r.text) {
        won = true;
        sttMarkOk(eng);
        actLog('stt race winner=' + eng + ' (' + ms + 'ms)');
        const tx = String(r.text).trim();
        setState('idle');
        if (dictation.active) dictateHandle(tx);
        else handleUtterance(tx);
        return;
      }
      fails += 1;
      if (r && r.error) lastErr = String(r.error);
      sttMarkFail(eng);
      actLog('stt ' + eng + ' fail (' + ms + 'ms)' + (r && r.error ? ' err=' + String(r.error).slice(0, 80) : ''));
      if (fails >= chain.length && !won && !isDead()) {
        setState('idle');
        statusText.textContent = t('stt.failAll', { x: (lastErr || '—').slice(0, 120) });
        sbMic.innerHTML = `<i class="dot ok"></i>${t('mic.ready')}`;
        if (lastErr) toast(lastErr.slice(0, 150), '#i-info');
        if (dictation.active) setTimeout(rearmDictation, 1500);
      }
    };
    chain.forEach((eng) => {
      const te0 = Date.now();
      const pr = (async () => {
        if (eng === 'google') return bridge.stt.google({ pcm: pcmBytes, rate: 16000, key: settings.googleKey || '', lang: settings.sttLang || 'fa-IR' });
        const b = new Uint8Array(await wavBlob.arrayBuffer());
        if (b.length < 900) return { ok: false, error: 'short-audio' };
        if (eng === 'whisper') return bridge.stt.whisper({ buf: b, base: settings.whisperBase, key: settings.whisperKey, model: settings.whisperModel, lang: settings.sttLang || 'fa-IR' });
        if (eng === 'glm') return bridge.stt.transcribe({ buf: b, base: settings.glmBase, key: settings.glmKey, model: ASR_MODEL });
        if (eng === 'gemini') return bridge.stt.gemini({ buf: b, key: settings.geminiKey, model: settings.geminiModel, lang: settings.sttLang || 'fa-IR' });
        return { ok: false, error: 'unknown-engine' };
      })();
      withEngTimeout(pr, RACE_MS)
        .then((r) => raceSettle(eng, r, Date.now() - te0))
        .catch(() => raceSettle(eng, { ok: false, error: t('stt.connFail') }, Date.now() - te0));
    });
  }

  /* قطع لایهٔ صدا/VAD (جلسه ممکن است ادامه یابد یا تمام شود) */
  function aveKillAudio() {
    if (!ave) return;
    clearInterval(ave.tVad); ave.tVad = null;
    clearTimeout(ave.tStable); ave.tStable = null;
    clearTimeout(ave.tGrace); ave.tGrace = null;
    try { if (ave.proc) ave.proc.disconnect(); } catch (_) { /* noop */ }
    try { if (ave.srcNode) ave.srcNode.disconnect(); } catch (_) { /* noop */ }
    try { if (ave.sink) ave.sink.disconnect(); } catch (_) { /* noop */ }
    ave.proc = ave.srcNode = ave.sink = null;
  }

  /* توقف کامل جلسه (دکمهٔ کاربر / سیستم) — هر رویداد در پرواز باطل می‌شود */
  function aveStopSession() {
    aveEpoch += 1;
    if (ave) { aveKillAudio(); ave = null; }
    if (rec) { try { rec.onend = null; rec.stop(); } catch (_) { /* noop */ } }
    rec = null; recActive = false;
    webFailStreak = 0;
    setState('idle');
  }'''

# ---------------- PART4: helpers tail (replaces 3077-3183) ----------------
P4 = r'''  function micRecMime() {
    if (typeof MediaRecorder === 'undefined') return '';
    for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']) {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m;
    }
    return '';
  }

  /* بریدن سکوت ابتدا/انتهای صدا → تشخیص سریع‌تر و دقیق‌تر */
  function trimSilenceEdges(f32, rate) {
    const win = Math.max(1, Math.floor(rate * 0.02));
    const loud = (i) => {
      let sum = 0;
      const end = Math.min(f32.length, i + win);
      for (let j = i; j < end; j++) sum += f32[j] * f32[j];
      return Math.sqrt(sum / Math.max(1, end - i));
    };
    let s = 0, e = f32.length;
    while (s < f32.length && loud(s) < 0.008) s += win;
    while (e - win > s && loud(e - win) < 0.008) e -= win;
    const pad = Math.floor(rate * 0.08);
    s = Math.max(0, s - pad);
    e = Math.min(f32.length, e + pad);
    if (e - s < rate * 0.2) return f32;
    return f32.slice(s, e);
  }'''

# ---------------- PART5: startListening (replaces 3849-3902) ----------------
P5 = r'''  /* ---------- گوش دادن (AVE3) ---------- */
  let listenTimer = null;
  function startListening() {
    if (state === 'processing') return;
    if (state === 'listening') return; /* از بی‌دست دوباره فراخوانی شده */
    clearTimeout(listenTimer);
    /* نه وب داریم نه موتور ابری → پیام صادقانه (+ دمو فقط اگر کاربر روشن کرده) */
    if (!srUsable() && !buildCloudChain().length) { noEngine(t('stt.noEngineApp')); return; }
    aveStart();
  }'''

# ---------------- PART6: stopListening (replaces 3917-3945) ----------------
P6 = r'''  function stopListening(reset = true) {
    clearTimeout(listenTimer);
    aveStopSession(); /* جلسهٔ AVE3 + همهٔ رویدادهای در پرواز باطل */
    setLiveText('');
    sbMic.innerHTML = `<i class="dot ok"></i>${t('mic.ready')}`;
    if (reset) {
      statusText.innerHTML = IDLE_HINT;
    }
  }'''

# ---------------- splice bottom-up ----------------
def splice(start1, end1, newtext):
    # start1/end1 are 1-based inclusive
    newlines = newtext.split('\n')
    lines[start1-1:end1] = newlines

splice(3917, 3945, P6)   # stopListening
splice(3849, 3902, P5)   # startListening
splice(3077, 3183, P4)   # glm block -> helpers tail
splice(2838, 3075, P3)   # google block -> helpers + AVE3 buffer/race
splice(2692, 2836, P2)   # fallback+makeRec -> AVE3 core
splice(2594, 2610, P1)   # globals
print('splices done; total lines now', len(lines))

# ---------------- dynamic edits ----------------
src = '\n'.join(lines)

# 1) detachMic guard: gRec -> ave
if 'isRecording || gRec' not in src:
    print('EDIT FAIL: detachMic guard not found'); sys.exit(1)
src = src.replace('isRecording || gRec', 'isRecording || ave', 1)

# 2) optMic change: stop session before mic swap
old_mic = 'if (isRecording) await stopAudioRec();\n    detachMic();'
if old_mic not in src:
    print('EDIT FAIL: optMic handler not found'); sys.exit(1)
src = src.replace(old_mic, 'if (isRecording) await stopAudioRec();\n    if (state === \'listening\') stopListening(false); /* جلسه با میکروفون قدیمی می‌مرد */\n    detachMic();', 1)

# 3) i18n: add AVE3 keys right after stt.racing
racing_line = None
for i, ln in enumerate(lines2 := src.split('\n')):
    if "'stt.racing': [" in ln:
        racing_line = i
        break
if racing_line is None:
    print('EDIT FAIL: stt.racing i18n not found'); sys.exit(1)
add = [
    "    'stt.heardLive': ['شنیدم… بعد از سکوتت پردازش می‌کنم', 'I hear you… transcribing after your pause'],",
    "    'stt.failAll': ['هیچ موتوری نتوانست صدایت را تبدیل کند: {x}', 'No engine could transcribe your voice: {x}'],",
]
lines2[racing_line+1:racing_line+1] = add
src = '\n'.join(lines2)

# 4) about.desc — replace both occurrences with v0.25 text
DESC_FA = 'نسخه ۰.۲۵ — «بازسازی کامل مکالمهٔ صوتی (AVE3)»: هر جلسهٔ گوش‌دادن حالا دو مسیر موازی دارد — شنوندهٔ زندهٔ وب (همان که در کروم عالی بود) + ضبط PCM از لحظهٔ صفر با VAD تطبیقی. اگر موتور وب بمیرد، دیگر «دوباره گوش نمی‌دهیم» — همان صدای ضبط‌شده بی‌درنگ به مسابقهٔ موازی موتورهای ابری (گوگل/Whisper/GLM/Gemini، سقف ۱۲ ثانیه برای هر موتور) می‌رود؛ کاربر هرگز چیزی را تکرار نمی‌کند. پایان جمله با سکوت واقعی (VAD ۱.۲ ثانیه‌ای) تصمیم گرفته می‌شود و teardown تمیز جلسه با شمارش نسل، رفتارهای عجیب استارت/استارت را ریشه‌کن می‌کند.'
DESC_EN = 'v0.25 — "voice conversation rebuilt from scratch (AVE3)": every listening session now runs two parallel tracks — the live web listener (the one that was great in Chrome) plus a from-zero PCM buffer with adaptive VAD. If the web engine dies, we never re-listen — the already-captured audio instantly enters the parallel cloud race (Google/Whisper/GLM/Gemini, 12s cap each); the user never repeats a command. End-of-utterance is decided by real silence (1.2s VAD) and clean epoch-guarded teardown kills weird start/start behavior.'
new_desc = "    'about.desc': ['" + DESC_FA + "', '" + DESC_EN + "'],"
cnt = 0
out = []
for ln in src.split('\n'):
    if ln.strip().startswith("'about.desc': ["):
        out.append(new_desc); cnt += 1
    else:
        out.append(ln)
if cnt != 2:
    print('EDIT FAIL: about.desc count =', cnt); sys.exit(1)
src = '\n'.join(out)

# 5) appVersion bump
if "let appVersion = '0.24.0';" not in src:
    print('EDIT FAIL: appVersion not found'); sys.exit(1)
src = src.replace("let appVersion = '0.24.0';", "let appVersion = '0.25.0';", 1)

with io.open(APP, 'w', encoding='utf-8') as f:
    f.write(src)
print('app.js written OK')

# ---------------- self-check: banned tokens must be gone ----------------
banned = ['startCloudListen', 'fallbackFromWeb', 'makeRec(', 'stopGoogleRec', 'startGoogleListen',
          'startGlmListen', 'stopGlmRec', 'finishGlmTranscribe', 'gotFinal', 'webGotAny',
          'webWatchdog', 'recEpoch', 'glmRec', 'glmListening', 'GLM_ON_LVL', 'GLM_SIL_MS',
          'GLM_MAX_MS', 'G_SIL_MS', 'G_IDLE_MS', 'G_MAX_MS', 'gRec', 'gMaxT']
hits = []
for i, ln in enumerate(src.split('\n'), 1):
    for b in banned:
        if b in ln:
            hits.append((i, b, ln.strip()[:90]))
if hits:
    print('BANNED TOKENS REMAIN:')
    for h in hits: print('  line %d: %s | %s' % h)
    sys.exit(1)
print('banned-token check: CLEAN')

# quick syntax sanity via node
os.system('node --check "%s" && echo "node --check app.js OK"' % APP)
