/* ============================================================
   آوا — دستیار صوتی ویندوز | منطق رابط کاربری (نسخه ۰.۵)
   - تشخیص گفتار واقعی: موتور وب → فالبک GLM-ASR ابری (بدون دموی جعلی)
   - اکولایزر همیشه با صدای واقعی میکروفون بالا و پایین می‌شود
   - چت با هوش مصنوعی GLM + ساخت فرمان جدید با تأیید کاربر
   - صفحه تنظیمات: میکروفون (ورودی/تست زنده)، موتور گفتار، کلید GLM
   - ضبط واقعی صدا و ذخیره در Music/AVA + پاسخ گفتاری TTS
   ============================================================ */
(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const bridge = window.ava || null;
  const SRC = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const canRun = !!(bridge && bridge.system && bridge.system.run);

  /* ---------- عناصر صفحه تنظیمات ---------- */
  const hero = document.querySelector('.hero');
  const settingsPage = $('#settingsPage');
  const btnHome = $('#btnHome');
  const btnSettings = $('#btnSettings');
  const btnSettingsBack = $('#btnSettingsBack');
  const optTop = $('#optTop');
  const optLogin = $('#optLogin');
  const optTts = $('#optTts');
  const optVoice = $('#optVoice');
  const optAutoUpdate = $('#optAutoUpdate');
  const updText = $('#updText');
  const updNote = $('#updNote');
  const updProgress = $('#updProgress');
  const updBar = $('#updBar');
  const btnCheckUpdate = $('#btnCheckUpdate');
  const btnInstallUpdate = $('#btnInstallUpdate');

  /* ---------- عناصر تنظیمات جدید (میکروفون / گفتار / GLM) ---------- */
  const optMic = $('#optMic');
  const micStat = $('#micStat');
  const micMeter = $('#micMeter');
  const optSttEngine = $('#optSttEngine');
  const optGlmKey = $('#optGlmKey');
  const btnKeyShow = $('#btnKeyShow');
  const optGoogleKey = $('#optGoogleKey');
  const btnGoZai = $('#btnGoZai');
  const optDemo = $('#optDemo');
  const optAiModel = $('#optAiModel');

  /* ---------- عناصر حالت بی‌دست و تاریخچه (v0.7) ---------- */
  const optHandsFree = $('#optHandsFree');
  const optWakeWord = $('#optWakeWord');
  const btnHandsFree = $('#btnHandsFree');
  const historyPage = $('#historyPage');
  const btnHistory = $('#btnHistory');
  const btnHistoryBack = $('#btnHistoryBack');
  const btnHistoryClear = $('#btnHistoryClear');
  const historyList = $('#historyList');
  const historyEmpty = $('#historyEmpty');

  /* ---------- عناصر چت هوش مصنوعی ---------- */
  const chatPage = $('#chatPage');
  const btnChat = $('#btnChat');
  const btnChatBack = $('#btnChatBack');
  const chatMsgs = $('#chatMsgs');
  const chatBar = $('#chatBar');
  const chatInput = $('#chatInput');
  const tabQuick = $('#tabQuick');
  const tabZai = $('#tabZai');
  const quickWrap = $('#quickWrap');
  const zaiWrap = $('#zaiWrap');
  const zaiWeb = $('#zaiWeb');
  const zaiBadge = $('#zaiBadge');

  /* ---------- مودال تأیید ---------- */
  const confirmBox = $('#confirmBox');
  const cfTitle = $('#cfTitle');
  const cfText = $('#cfText');
  const cfCode = $('#cfCode');
  const btnConfirmOk = $('#btnConfirmOk');
  const btnConfirmCancel = $('#btnConfirmCancel');

  /* ---------- عناصر ---------- */
  const body = document.body;
  const btnMin = $('#btnMin');
  const btnMax = $('#btnMax');
  const btnClose = $('#btnClose');
  const maxIcon = $('#maxIcon');
  const orb = $('#orb');
  const orbIcon = $('#orbIcon');
  const statusText = $('#statusText');
  const wave = $('#wave');
  const chips = [...document.querySelectorAll('.chip[data-cmd]')];
  const respCard = $('#respCard');
  const rcTag = $('#rcTag');
  const rcHeard = $('#rcHeard');
  const rcReply = $('#rcReply');
  const cmdBar = $('#cmdBar');
  const cmdInput = $('#cmdInput');
  const sbMic = $('#sbMic');
  const sbEngine = $('#sbEngine');
  const sbCpu = $('#sbCpu');
  const sbRam = $('#sbRam');
  const sbClock = $('#sbClock');
  const toasts = $('#toasts');
  const about = $('#about');
  const btnAbout = $('#btnAbout');
  const greetTitle = $('#greetTitle');
  const abRuntime = $('#abRuntime');

  const IDLE_HINT = 'برای شروع، اورب را لمس کن یا کلید <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Space</kbd>';
  const DEFAULT_REPLY = 'این فرمان را هنوز یاد نگرفتم. اتصال هوش مصنوعی را برقرار کن (تب «صفحه چت GLM» › ورود به حسابت) تا هر سوال و فرمانی را همان‌جا تحلیل کنم و یاد بگیرم!';

  /* ---------- تنظیمات (فایل userData + میرور localStorage) ----------
     با جابجایی مببع UI از فایل به ava://، localStorage از صفر شروع می‌شد؛
     حالا فایل ava-settings.json منبع حقیقت است و چیزی از دست نمی‌رود. */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ava.' + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem('ava.' + k, JSON.stringify(v)); } catch (_) { /* noop */ } persistSettings(); },
  };
  const settings = {
    tts: store.get('tts', true),
    voiceURI: store.get('voiceURI', ''),
    autoUpdate: store.get('autoUpdate', true),
    demoMode: store.get('demoMode', false),
    sttEngine: store.get('sttEngine', 'auto'),
    googleKey: store.get('googleKey', ''),
    glmKey: store.get('glmKey', ''),
    glmBase: store.get('glmBase', 'https://api.z.ai/api/paas/v4'),
    glmModel: store.get('glmModel', 'glm-4.6'),
    micId: store.get('micId', ''),
    handsFree: store.get('handsFree', false),
    wakeWord: store.get('wakeWord', true),
  };
  let customCmds = store.get('customCmds', []);
  let history = store.get('history', []);

  let persistTimer = null;
  function persistSettings() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      if (!bridge || !bridge.settings || !bridge.settings.save) return;
      try { bridge.settings.save({ ...settings, customCmds, history }); } catch (_) { /* noop */ }
    }, 600);
  }
  (async () => {
    /* بارگذاری تنظیمات ذخیره‌شده در فایل — بعد از تعریف کامل صفحه */
    if (!bridge || !bridge.settings || !bridge.settings.load) return;
    try {
      const f = await bridge.settings.load();
      if (f && typeof f === 'object' && Object.keys(f).length) {
        Object.keys(settings).forEach((k) => { if (f[k] !== undefined) settings[k] = f[k]; });
        if (Array.isArray(f.customCmds) && f.customCmds.length) { customCmds = f.customCmds; store.set('customCmds', customCmds); }
        if (Array.isArray(f.history)) { history = f.history; store.set('history', history); }
        refreshEngineUI();
        renderCustomChips();
        updateHandsFreeUI();
      }
    } catch (_) { /* noop */ }
  })();
  const glmReady = () => !!(settings.glmKey && bridge && bridge.stt);

  /* ---------- پاسخ گفتاری واقعی (TTS) ---------- */
  function speak(text) {
    if (!settings.tts || !text || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text).replace(/[«»]/g, '').slice(0, 320));
      const voices = speechSynthesis.getVoices() || [];
      if (settings.voiceURI) {
        const sel = voices.find((v) => v.voiceURI === settings.voiceURI);
        if (sel) u.voice = sel;
      } else {
        const fa = voices.find((v) => /^fa[\-_]?/i.test(v.lang) || /persian|فارسی/i.test(v.name));
        if (fa) u.voice = fa;
      }
      u.lang = (u.voice && u.voice.lang) || 'fa-IR';
      u.rate = 0.98;
      u.pitch = 1;
      speechSynthesis.speak(u);
    } catch (_) { /* noop */ }
  }

  /* ---------- ابزار ---------- */
  const faNum = (v) => String(v).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const faToEn = (s) => String(s).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  const timeFmt = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' });
  const dateFmt = new Intl.DateTimeFormat('fa-IR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  function toast(msg, ico = '#i-info') {
    const t = document.createElement('div');
    t.className = 'toast glass';
    t.innerHTML = `<svg class="ic"><use href="${ico}"/></svg><span></span>`;
    t.querySelector('span').textContent = msg;
    toasts.appendChild(t);
    setTimeout(() => t.classList.add('out'), 3300);
    setTimeout(() => t.remove(), 3700);
  }

  /* ---------- ماشین حالت ---------- */
  let state = 'idle';
  function setState(s) {
    state = s;
    body.classList.remove('state-idle', 'state-listening', 'state-processing', 'state-success');
    body.classList.add('state-' + s);
  }

  /* ---------- خوش‌آمد بر اساس ساعت ---------- */
  const h = new Date().getHours();
  const dayPart = h < 5 ? 'شب بخیر' : h < 12 ? 'صبح بخیر' : h < 15 ? 'ظهر بخیر' : h < 19 ? 'عصر بخیر' : 'شب بخیر';
  greetTitle.textContent = `${dayPart}؛ من آوا هستم`;

  /* ---------- ساعت نوار وضعیت ---------- */
  const tickClock = () => { sbClock.textContent = timeFmt.format(new Date()); };
  tickClock();
  setInterval(tickClock, 15000);

  /* ---------- کنترل‌های پنجره ---------- */
  const browserHint = () => toast('این دکمه فقط داخل نرم‌افزار الکترون واقعی کار می‌کند', '#i-info');
  btnMin.addEventListener('click', () => (bridge ? bridge.window.minimize() : browserHint()));
  btnMax.addEventListener('click', () => (bridge ? bridge.window.toggleMaximize() : browserHint()));
  btnClose.addEventListener('click', () => (bridge ? bridge.window.close() : browserHint()));
  if (bridge) {
    const setMaxIco = (v) => maxIcon.setAttribute('href', v ? '#i-restore' : '#i-max');
    bridge.window.onMaximizeChange(setMaxIco);
    bridge.window.isMaximized().then(setMaxIco).catch(() => {});
    abRuntime.textContent = `Electron v${bridge.versions.electron}`;
  } else {
    abRuntime.textContent = 'پیش‌نمایش مرورگر';
  }

  /* ---------- ویژوالایزر موج صدا ---------- */
  const ctx = wave.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  function resizeWave() {
    const r = wave.getBoundingClientRect();
    W = r.width; H = r.height;
    wave.width = Math.max(1, W * DPR);
    wave.height = Math.max(1, H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resizeWave);
  resizeWave();

  /* ---------- میکروفون واقعی: همیشه روشن — اکولایزر و تست تنظیمات با صدای واقعی ---------- */
  let micStream = null, audioCtx = null, analyser = null, micData = null, micLive = false;
  let mediaRec = null, recChunks = [], isRecording = false;

  async function attachMic() {
    if (analyser) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      const base = { echoCancellation: true, noiseSuppression: true };
      /* اول با میکروفون انتخابی کاربر؛ اگر شناسه قدیمی بود/در دسترس نبود، خودکار پیش‌فرض ویندوز */
      if (settings.micId) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: { ...base, deviceId: { exact: settings.micId } } });
        } catch (_) { micStream = null; }
      }
      if (!micStream) micStream = await navigator.mediaDevices.getUserMedia({ audio: base });
      audioCtx = new AC();
      /* بعضی سیستم‌ها کانتکست را معلق (suspended) می‌سازند — بدون resume هیچ صدایی نمی‌آید */
      if (audioCtx.state === 'suspended') { try { await audioCtx.resume(); } catch (_) { /* noop */ } }
      const src = audioCtx.createMediaStreamSource(micStream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;
      src.connect(analyser);
      micData = new Uint8Array(analyser.frequencyBinCount);
      micLive = true;
      sbMic.innerHTML = '<i class="dot ok"></i>میکروفون: فعال';
      micStat.textContent = 'میکروفون فعال است — با حرف زدن، میله‌ها بالا و پایین می‌شوند';
      listMicDevices();
      return true;
    } catch (err) {
      micLive = false;
      const nm = String((err && err.name) || err || '');
      const why = /NotReadable|TrackStart/i.test(nm)
        ? 'میکروفون توسط برنامه دیگری در حال استفاده است — آن برنامه را ببند'
        : /NotFound/i.test(nm)
        ? 'هیچ میکروفونی پیدا نشد — اتصال میکروفون را چک کن'
        : /NotAllowed|SecurityError/i.test(nm)
        ? 'مجوز میکروفون رد شد — در ویندوز: Settings › Privacy › Microphone را روشن کن'
        : 'دسترسی به میکروفون ممکن نشد — مجوز ویندوز و آنتی‌ویروس را بررسی کن';
      sbMic.innerHTML = '<i class="dot err"></i>میکروفون: بدون دسترسی';
      micStat.textContent = why;
      return false;
    }
  }

  async function listMicDevices() {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const mics = devs.filter((d) => d.kind === 'audioinput');
      const cur = settings.micId;
      let html = '<option value="">پیش‌فرض ویندوز</option>';
      mics.forEach((m, i) => {
        const label = m.label || `میکروفون ${i + 1}`;
        const sel = m.deviceId === cur ? ' selected' : '';
        html += `<option value="${m.deviceId}"${sel}>${label}</option>`;
      });
      optMic.innerHTML = html;
    } catch (_) { /* noop */ }
  }

  optMic.addEventListener('change', async () => {
    settings.micId = optMic.value || '';
    store.set('micId', settings.micId);
    /* ری‌استارت استریم با ورودی جدید */
    if (isRecording) await stopAudioRec();
    detachMic();
    await attachMic();
    toast('ورودی میکروفون عوض شد', '#i-mic');
  });

  /* میتر تست زنده در تنظیمات */
  const mctx = micMeter ? micMeter.getContext('2d') : null;
  function drawMeter() {
    if (!mctx || settingsPage.hidden) { setTimeout(drawMeter, 400); return; }
    const r = micMeter.getBoundingClientRect();
    const mw = Math.max(10, r.width), mh = 40;
    if (micMeter.width !== mw * DPR) { micMeter.width = mw * DPR; micMeter.height = mh * DPR; mctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
    mctx.clearRect(0, 0, mw, mh);
    if (micData) {
      const bars = 34, gap = 3;
      const bw = Math.max(2, (mw - (bars - 1) * gap) / bars);
      for (let i = 0; i < bars; i++) {
        const bi = Math.min(micData.length - 1, Math.floor(Math.pow(i / bars, 1.5) * micData.length * 0.72));
        const raw = micData[bi] / 255;
        const bh = Math.max(3, raw * (mh - 8));
        mctx.fillStyle = raw > 0.55 ? 'rgba(52, 211, 153, 0.95)' : 'rgba(16, 185, 129, 0.65)';
        rr(mctx, (mw - (bars * bw + (bars - 1) * gap)) / 2 + i * (bw + gap), (mh - bh) / 2, bw, bh, bw / 2);
        mctx.fill();
      }
    } else {
      mctx.fillStyle = 'rgba(255,255,255,0.25)';
      mctx.font = '11px Vazirmatn, sans-serif';
      mctx.textAlign = 'center';
      mctx.fillText('میکروفون متصل نیست', mw / 2, 24);
    }
    setTimeout(drawMeter, 60);
  }
  drawMeter();

  function detachMic() {
    if (isRecording || gRec) return; /* حین ضبط، استریم نباید بسته شود */
    if (micStream) { micStream.getTracks().forEach((t) => t.stop()); micStream = null; }
    if (audioCtx) { try { audioCtx.close(); } catch (_) { /* noop */ } audioCtx = null; }
    analyser = null; micData = null; micLive = false;
    sbMic.innerHTML = '<i class="dot err"></i>میکروفون: خاموش';
  }

  async function startAudioRec() {
    if (isRecording) return 'ضبط از قبل در جریان است؛ بگو «توقف ضبط» تا ذخیره‌اش کنم.';
    if (!window.MediaRecorder) return 'ضبط صدا در این محیط پشتیبانی نمی‌شود.';
    const ok = await attachMic();
    if (!ok) return 'دسترسی به میکروفون ممکن نشد؛ مجوز میکروفون را در ویندوز بررسی کن.';
    try {
      recChunks = [];
      mediaRec = new MediaRecorder(micStream);
      mediaRec.ondataavailable = (e) => { if (e.data && e.data.size) recChunks.push(e.data); };
      mediaRec.start();
      isRecording = true;
      micLive = true;
      sbMic.innerHTML = '<i class="dot rec"></i>میکروفون: در حال ضبط';
      statusText.textContent = 'در حال ضبط صدایت… برای پایان بگو «توقف ضبط»';
      return 'ضبط شروع شد! هر وقت خواستی بگو «توقف ضبط» تا در پوشه Music ذخیره‌اش کنم.';
    } catch (_) {
      return 'شروع ضبط ممکن نشد.';
    }
  }

  async function stopAudioRec() {
    if (!isRecording || !mediaRec || mediaRec.state === 'inactive') return 'ضبط فعالی وجود ندارد.';
    const stopped = new Promise((res) => { mediaRec.onstop = res; });
    try { mediaRec.stop(); } catch (_) { /* noop */ }
    await stopped;
    isRecording = false;
    sbMic.innerHTML = '<i class="dot ok"></i>میکروفون: آماده';
    const blob = new Blob(recChunks, { type: (mediaRec && mediaRec.mimeType) || 'audio/webm' });
    recChunks = [];
    /* میکروفون برای اکولایزر واقعی روشن می‌ماند */
    if (!blob.size) return 'صدایی ضبط نشده بود!';
    if (canRun && bridge.system.saveAudio) {
      try {
        const buf = new Uint8Array(await blob.arrayBuffer());
        const r = await bridge.system.saveAudio(buf);
        if (r && r.ok) return `ضبط ذخیره شد در: ${r.path}`;
        return `ذخیره ممکن نشد: ${(r && r.error) || 'خطای نامشخص'}`;
      } catch (_) { /* ادامه به پاسخ مرورگری */ }
    }
    return `ضبط انجام شد (${faNum(Math.round(blob.size / 1024))} کیلوبایت)؛ ذخیره واقعی فایل فقط داخل نرم‌افزار ویندوزی است.`;
  }

  const N = 52;
  const levels = new Array(N).fill(0.1);
  let t0 = 0, energy = 0.1;
  function rr(c, x, y, w, hgt, r) {
    if (c.roundRect) { c.beginPath(); c.roundRect(x, y, w, hgt, r); return; }
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + hgt, r);
    c.arcTo(x + w, y + hgt, x, y + hgt, r);
    c.arcTo(x, y + hgt, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function frame() {
    t0 += 0.016;
    /* خواندن طیف واقعی میکروفون — بدون این فراخوانی micData همیشه صفر می‌ماند
       و اکولایزر و تشخیص سکوت هیچ صدایی نمی‌بینند (باگ اصلی «صدایی دریافت نمیشه») */
    if (analyser && micData && micLive) {
      try { analyser.getByteFrequencyData(micData); } catch (_) { /* noop */ }
    }
    const target = state === 'listening' ? 0.88 : state === 'processing' ? 0.42 : state === 'success' ? 0.55 : 0.15;
    energy += (target - energy) * 0.05;
    ctx.clearRect(0, 0, W, H);
    const mid = H / 2;
    const gap = 4;
    const bw = Math.max(2, Math.min(4.5, (W - (N - 1) * gap) / N));
    const startX = (W - (N * bw + (N - 1) * gap)) / 2;
    for (let i = 0; i < N; i++) {
      const env = Math.sin((Math.PI * i) / (N - 1));
      let lvl;
      if (micData) {
        /* صدای واقعی میکروفون: تبدیل طیف فرکانسی به ۵۲ میله — همیشه واقعی */
        const bins = Math.floor(micData.length * 0.72);
        const bi = Math.min(micData.length - 1, Math.floor(Math.pow(i / N, 1.55) * bins));
        const raw = micData[bi] / 255;
        lvl = Math.max(0.05, Math.min(1, raw * 1.6 * (0.35 + 0.65 * env)));
      } else {
        const n =
          Math.sin(t0 * 2.1 + i * 0.55) * 0.5 +
          Math.sin(t0 * 3.7 + i * 1.3) * 0.3 +
          Math.sin(t0 * 0.7 + i * 0.21) * 0.2;
        const amp = energy * env * (0.32 + 0.68 * Math.abs(n));
        const jitter = energy > 0.2 ? Math.random() * 0.13 * energy : 0;
        lvl = Math.max(0.04, Math.min(1, amp + jitter));
      }
      levels[i] += (lvl - levels[i]) * 0.25;
      const bh = Math.max(3, levels[i] * (H - 8));
      const g = ctx.createLinearGradient(0, mid - bh / 2, 0, mid + bh / 2);
      g.addColorStop(0, 'rgba(52, 211, 153, 0.95)');
      g.addColorStop(0.5, 'rgba(16, 185, 129, 0.85)');
      g.addColorStop(1, 'rgba(13, 148, 136, 0.9)');
      ctx.fillStyle = g;
      rr(ctx, startX + i * (bw + gap), mid - bh / 2, bw, bh, bw / 2);
      ctx.fill();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------- قوانین فرمان‌ها ----------
     k = الگوی شنیدن | t = توست | i = آیکون | r = متن پاسخ
     run = شناسه فرمان واقعی ویندوز | arg = آرگومان استخراجی */
  const stripSearch = (c) =>
    c.replace(/(لطفا|لطفاً)/g, '')
      .replace(/(در\s+)?(گوگل|google)/gi, '')
      .replace(/(را|رو)\s+/g, '')
      .replace(/(جستجو|سرچ|search)[\s\u200C]*(کن|بکن|بگیر)?[\s\u200C]*ی?[\s\u200C]*/gi, '')
      .replace(/[\s\u200C]+/g, ' ')
      .trim();

  const JOKES = [
    'به برنامه‌نویس میگن چقدر طول می‌کشد این کار تموم شه؟ میگه دو دقیقه… بعد دو هفته برمی‌گردد!',
    'دو تا بایت به هم می‌رسند؛ یکی می‌پرسد حالت چطوره؟ می‌گوید یکم بیت‌دارم!',
    'چرا کامپیوترها هیچ‌وقت گرسنه نمی‌شوند؟ چون همیشه چیپس دارند!',
    'به یارو میگن گوشی‌ات را ریست کن، میگه چرا، خوبه! میگن نه، تو که رِست (رستوران) رفتی برگرد!',
    'دنیا بدون کامپیوتر چه شکلی بود؟ کسی نمی‌داند؛ هیچ‌کس آن‌قدر صبر نکرد!',
  ];

  /* --- آب‌وهوا واقعی (Open-Meteo، بدون کلید — درخواست از پروسه اصلی) --- */
  const WX_STRIP =
    /(لطفا|لطفاً|آب[\s\u200C]*و[\s\u200C]*هوا(ی)?|اب[\s\u200C]*و[\s\u200C]*هوا(ی)?|هوا(ی)?|درجه(ی)?|دما(ی)?|چطوره?|چند\s*درجه|چنده|چیه|چیکار|امروز|الان|فردا|بگو|بده|شهر|است|می\s*خوام|weather|در|تو|رو|یک|یه)/gi;

  async function weatherReply(c) {
    if (!bridge || !bridge.system || !bridge.system.weather) {
      return 'پیش‌بینی آب‌وهوا فقط داخل نرم‌افزار ویندوزی کار می‌کند.';
    }
    let city = String(c || '')
      .replace(WX_STRIP, ' ')
      .replace(/[0-9۰-۹?؟!.,،:;]+/g, ' ')
      .replace(/[\s\u200C]+/g, ' ')
      .trim();
    const r = await bridge.system.weather(city || 'تهران');
    if (r && r.ok) {
      return `آب‌وهوای ${r.name}: ${r.desc}، دما حدود ${faNum(r.temp)} درجه (احساس واقعی ${faNum(r.feels)})، رطوبت ${faNum(r.hum)}٪ و باد ${faNum(r.wind)} کیلومتر بر ساعت.`;
    }
    return (r && r.error) || 'آب‌وهوا الان در دسترس نیست — چند لحظه بعد دوباره بگو.';
  }

  /* --- ماشین‌حساب صوتی: تبدیل جمله فارسی به عبارت ریاضی امن --- */
  const FA_WORD_NUM = {
    صفر: 0, یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, هفت: 7, هشت: 8, نه: 9, ده: 10,
    یازده: 11, دوازده: 12, سیزده: 13, چهارده: 14, پانزده: 15, پونزده: 15, شانزده: 16, هفده: 17, هجده: 18, نوزده: 19,
    بیست: 20, سی: 30, چهل: 40, پنجاه: 50, شصت: 60, هفتاد: 70, هشتاد: 80, نود: 90, صد: 100, هزار: 1000,
  };
  function parseMath(c) {
    let s = faToEn(String(c)).toLowerCase();
    s = s.replace(/(هزار|صد|نود|هشتاد|هفتاد|شصت|پنجاه|چهل|سی|بیست|نوزده|هجده|هفده|شانزده|پونزده|پانزده|چهارده|سیزده|دوازده|یازده|ده|نه|هشت|هفت|شش|پنج|چهار|سه|دو|یک|صفر)/g,
      (w) => ` ${FA_WORD_NUM[w]} `);
    s = s
      .replace(/به\s*علاوه|بعلاوه|بهم\s*اضافه|جمع|plus/g, '+')
      .replace(/منهای|منها|منها|لا\s*منها/g, '-')
      .replace(/ضرب\s*در|ضربدر|ضرب|times/g, '*')
      .replace(/تقسیم\s*بر|تقسیم|divided/g, '/')
      .replace(/چند\s*می\s*شود|چند\s*میشه|چندمه|چنده|مساوی|محاسبه|حساب\s*کن|به\s*من\s*بگو|میشه|می\s*شود|درصد/g, ' ');
    s = s.replace(/[^0-9+\-*/().\s]/g, '').replace(/\s+/g, '');
    if (!s || !/[+\-*/]/.test(s)) return null;
    if (!/^[0-9+\-*/().]+$/.test(s)) return null;
    if (/\d{8,}/.test(s)) return null;
    let val;
    try { val = Function('"use strict";return (' + s + ')')(); } catch (_) { return null; }
    if (typeof val !== 'number' || !isFinite(val)) return null;
    return { expr: s, val };
  }
  function calcReply(c) {
    const m = parseMath(c);
    if (!m) return 'این محاسبه را متوجه نشدم — مثلاً بگو «پنج ضربدر هفت چند میشه» یا «۱۲ به علاوه ۳۰».';
    const v = Math.round(m.val * 1000) / 1000;
    return `${faNum(m.expr.replace(/\*/g, '×').replace(/\//g, '÷'))} می‌شود ${faNum(String(v))}؛ حساب کردم!`;
  }

  const RULES = [
    /* --- برنامه‌های ویندوز --- */
    { k: /کروم|مرورگر/, t: 'باز کردن کروم', i: '#i-globe', run: 'open_chrome', r: () => 'مرورگر کروم باز شد. خوش بگذره!' },
    { k: /نت[\s\u200C.]?پد|نوت[\s\u200C]?پد|دفترچه|notepad/i, t: 'باز کردن نت‌پد', i: '#i-note', run: 'open_notepad', r: () => 'نت‌پد باز شد.' },
    { k: /ماشین[\s\u200C]?حساب|calculator|حساب\s?کن/i, t: 'باز کردن ماشین‌حساب', i: '#i-calc', run: 'open_calc', r: () => 'ماشین‌حساب باز شد.' },
    { k: /اکسپلورر|فایل‌?ها|مای\s?کامپیوتر|این\s?کامپیوتر/, t: 'باز کردن اکسپلورر', i: '#i-window', run: 'open_explorer', r: () => 'فایل اکسپلورر باز شد.' },
    { k: /وی[\s\u200C]?اس\s?کد|vs\s?code|کدنویس/i, t: 'باز کردن VS Code', i: '#i-note', run: 'open_vscode', r: () => 'وی‌اس کد باز شد (باید روی سیستم نصب باشد).' },
    { k: /تسک[\s\u200C]?منیجر|مدیریت[\s\u200C]?فرایند/i, t: 'باز کردن تسک‌منیجر', i: '#i-pulse', run: 'open_taskmgr', r: () => 'تسک‌منیجر باز شد.' },
    { k: /تنظیمات/, t: 'باز کردن تنظیمات', i: '#i-gear', run: 'open_settings', r: () => 'تنظیمات ویندوز باز شد.' },
    { k: /پینت|نقاشی|paint/i, t: 'باز کردن پینت', i: '#i-calc', run: 'open_paint', r: () => 'پینت باز شد؛ خلاق باش!' },

    /* --- وب --- */
    { k: /یوتیوب|youtube/i, t: 'باز کردن یوتیوب', i: '#i-music', run: 'open_youtube', r: () => 'یوتیوب باز شد.' },
    { k: /موسیقی|آهنگ|موزیک/, t: 'پخش موسیقی', i: '#i-music', run: 'open_music', r: () => 'یوتیوب موزیک باز شد؛ آهنگ دلخواهت را بزن.' },
    {
      k: /آب[\s\u200C]?و[\s\u200C]?هوا|هوا\s?(چطور|چنده|چی|چیکار)|درجه[\s\u200C]?هوا|چند\s?درجه|دما|weather/i, t: 'آب‌وهوا', i: '#i-cloud',
      r: (c) => weatherReply(c),
    },
    {
      k: /(سایت|وب\s?سایت)|https?:\/\//i, t: 'باز کردن سایت', i: '#i-globe',
      run: (c) => (/https?:\/\//i.test(c) ? 'web_open' : 'web_search'),
      arg: (c) => {
        const m = c.match(/https?:\/\/\S+/);
        return m ? m[0] : stripSearch(c) || 'گوگل';
      },
      r: (c) => (/https?:\/\//i.test(c) ? 'سایت موردنظر باز شد.' : 'در گوگل جستجویش کردم؛ نتیجه اول معمولاً همان سایت است.'),
    },
    {
      k: /جستجو|سرچ|گوگل|google/i, t: 'جستجوی وب', i: '#i-search',
      run: 'web_search', arg: (c) => stripSearch(c),
      r: (c) => `«${stripSearch(c) || 'گوگل'}» را در گوگل جستجو کردم.`,
    },

    /* --- پنجره‌ها و سیستم --- */
    { k: /اسکرین\s?شات|اسکرین|عکس.{0,8}(صفحه|نمایشگر)|screenshot/i, t: 'اسکرین‌شات', i: '#i-camera', run: 'screenshot', r: () => 'اسکرین‌شات گرفته شد و در پوشه Pictures ذخیره شد.' },
    { k: /مینیمایز|کوچک.{0,8}(کن)|دسکتاپ|پنجره‌ها/, t: 'نمایش دسکتاپ', i: '#i-window', run: 'minimize_all', r: () => 'همه پنجره‌ها کوچک شدند؛ دسکتاپ آزاد است.' },
    { k: /قفل.{0,8}(کن|صفحه)|لاک\s?اسکرین/, t: 'قفل صفحه', i: '#i-lock', run: 'lock', r: () => 'صفحه قفل شد؛ بدرود!' },

    /* --- ضبط صدا (واقعی) --- */
    { k: /(شروع|بگیر).{0,8}ضبط|ضبط.{0,8}(صدا|شروع)/, t: 'شروع ضبط صدا', i: '#i-mic', r: () => startAudioRec() },
    { k: /توقف.{0,8}ضبط|پایان.{0,8}ضبط|ضبط.{0,8}(تموم|کافی)|قطع.{0,8}ضبط/, t: 'پایان ضبط صدا', i: '#i-mic', r: () => stopAudioRec() },

    /* --- صدا --- */
    { k: /(صدا|ولوم).{0,12}(قطع|بی[\s\u200C]?صدا|میوت)|میوت|mute|بی[\s\u200C]?صدا/i, t: 'بی‌صدا کردن', i: '#i-volume', run: 'vol_mute', r: () => 'صدا قطع شد.' },
    { k: /(صدا|ولوم|بلندی).{0,12}(بلند|زیاد|بالا|بده)/i, t: 'بلندتر کردن صدا', i: '#i-volume', run: 'vol_up', r: () => 'صدای سیستم را بلندتر کردم.' },
    { k: /(صدا|ولوم|بلندی).{0,12}(کم|پایین|آرام)/i, t: 'کم کردن صدا', i: '#i-volume', run: 'vol_down', r: () => 'صدای سیستم را کمتر کردم.' },
    {
      k: /(صدا|ولوم|بلندی)[^0-9۰-۹]{0,12}[0-9۰-۹]+|[0-9۰-۹]+[^0-9۰-۹]{0,8}(درصد)?[\s\u200C]*(صدا|ولوم)/, t: 'تنظیم دقیق صدا', i: '#i-volume',
      run: 'vol_set',
      arg: (c) => { const m = faToEn(c).match(/\d+/); return m ? Math.min(100, +m[0]) : 50; },
      r: (c) => { const m = faToEn(c).match(/\d+/); return `بلندی صدا روی ${faNum(m ? Math.min(100, +m[0]) : 50)}٪ تنظیم شد.`; },
    },
    { k: /صدا|بلندی|ولوم/, t: 'تنظیم صدا', i: '#i-volume', r: (c) => `بلندی صدا روی ${faNum(faToEn(c).match(/\d+/) ? Math.min(100, +faToEn(c).match(/\d+/)[0]) : 50)}٪ تنظیم شد.` },

    /* --- ماشین‌حساب صوتی (قبل از جستجو تا قاطی نشود) --- */
    {
      k: /(?=.*(ضرب|تقسیم|علاوه|بعلاوه|منهای|منها|جمع|چند\s?میشه|چنده))(?=.*(\d|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|بیست|سی|چهل|پنجاه|شصت|هفتاد|هشتاد|نود|صد|هزار))/, t: 'محاسبه', i: '#i-calc',
      r: (c) => calcReply(c),
    },

    /* --- اطلاعات --- */
    { k: /وضعیت|سیستم|پردازنده|رم/, t: 'مانیتورینگ', i: '#i-pulse', r: () => `پردازنده حدود ${faNum(lastCpu)}٪ و رم حدود ${faNum(lastRam)}٪ درگیر است؛ همه‌چیز خوب کار می‌کند.` },
    {
      k: /باتری|شارژ/, t: 'باتری', i: '#i-pulse',
      r: async () => {
        if (navigator.getBattery) {
          try {
            const b = await navigator.getBattery();
            return `باتری ${faNum(Math.round(b.level * 100))}٪ است${b.charging ? ' و در حال شارژ شدن' : ''}.`;
          } catch (_) { /* noop */ }
        }
        return 'خواندن باتری در این محیط ممکن نیست؛ داخل نرم‌افزار ویندوزی امتحان کن.';
      },
    },
    { k: /ساعت/, t: 'ساعت', i: '#i-clock', r: () => `الان ساعت ${timeFmt.format(new Date())} است.` },
    { k: /تاریخ|چندمه|امروز/, t: 'تاریخ', i: '#i-clock', r: () => `امروز ${dateFmt.format(new Date())} است.` },

    /* --- ابزار --- */
    {
      k: /تایمر|یادآور|یادآوری|هشدار\s?بذار/, t: 'تایمر فعال شد', i: '#i-timer',
      r: (c) => startTimer(c),
    },
    { k: /جوک|بخندون|شوخی/, t: 'جوک', i: '#i-smile', r: () => JOKES[Math.floor(Math.random() * JOKES.length)] },

    /* --- تعامل --- */
    { k: /سلام|درود|خوبی/, t: 'سلام', i: '#i-wave', r: () => 'سلام! من خوبم، ممنون. چه کاری برات انجام بدم؟' },
    { k: /متشکر|مرسی|ممنون/, t: 'خواهش', i: '#i-wave', r: () => 'خواهش می‌کنم! کار دیگری هست؟' },

    /* --- پوشه‌های ویندوز و سطل بازیافت --- */
    { k: /پوشه.{0,6}دانلود|دانلودها|downloads/i, t: 'باز کردن دانلودها', i: '#i-download', run: 'open_downloads', r: () => 'پوشه دانلودها باز شد.' },
    { k: /پوشه.{0,6}(اسناد|داکیومنت|مستندات)|documents/i, t: 'باز کردن اسناد', i: '#i-note', run: 'open_documents', r: () => 'پوشه اسناد باز شد.' },
    { k: /سطل.{0,10}(زباله|بازیافت).{0,12}(خالی|پاک|تمیز|بریز)/, t: 'خالی کردن سطل بازیافت', i: '#i-trash', run: 'recycle_empty', r: () => 'سطل بازیافت خالی شد.' },
  ];

  let lastCpu = 12, lastRam = 46;

  /* ---------- تایمر واقعی ---------- */
  let timerId = null;
  function beep() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ac = new AC();
      if (ac.state === 'suspended') { try { ac.resume(); } catch (_) { /* noop */ } }
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.001, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, ac.currentTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.9);
      o.start(); o.stop(ac.currentTime + 1);
    } catch (_) { /* noop */ }
  }
  function startTimer(c) {
    const txt = faToEn(c);
    const m = txt.match(/(\d+(?:\.\d+)?)/);
    let mins = m ? parseFloat(m[1]) : 5;
    let unit = 'دقیقه';
    if (/ثانیه/.test(c) && !/دقیقه/.test(c)) { mins = mins / 60; unit = 'ثانیه'; }
    mins = Math.max(0.05, Math.min(600, mins));
    if (timerId) clearTimeout(timerId);
    timerId = setTimeout(() => {
      beep();
      toast('زمان تایمر تمام شد!', '#i-timer');
      setState('success');
      statusText.textContent = 'زمان تایمر تمام شد';
      rcTag.textContent = 'تایمر';
      rcHeard.textContent = 'تایمر';
      rcReply.textContent = 'زمان تمام شد؛ یادت بودیم!';
      respCard.classList.add('show');
      speak('زمان تایمر تمام شد؛ خبرت کردم!');
      setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 4000);
    }, mins * 60000);
    const label = unit === 'ثانیه' ? faNum(Math.round(mins * 60)) : faNum(+(mins.toFixed(1)));
    return `تایمر ${label} ${unit}‌ای فعال شد؛ به‌محض رسیدن وقت خبرت می‌کنم.`;
  }

  /* ---------- تایپ متن پاسخ ---------- */
  let typeTimer = null;
  function typeText(el, txt) {
    clearInterval(typeTimer);
    el.textContent = '';
    let i = 0;
    typeTimer = setInterval(() => {
      el.textContent = txt.slice(0, ++i);
      if (i >= txt.length) clearInterval(typeTimer);
    }, 14);
  }

  /* ---------- اجرای فرمان ---------- */
  async function resolveReply(rule, cmd) {
    let reply = await rule.r(cmd);
    if (!rule.run) { rcTag.textContent = rule.custom ? 'فرمان سفارشی' : 'پاسخ آوا'; return reply; }
    if (!canRun) { rcTag.textContent = 'شبیه‌سازی دمو'; return reply; }
    const runId = typeof rule.run === 'function' ? rule.run(cmd) : rule.run;
    const arg = rule.arg ? rule.arg(cmd) : undefined;
    try {
      const res = await bridge.system.run(runId, arg);
      if (res && res.ok) {
        rcTag.textContent = 'اجرا شد';
        if (runId === 'screenshot' && res.out) reply = `اسکرین‌شات ذخیره شد در: ${res.out}`;
      } else {
        rcTag.textContent = canRun ? 'اجرا نشد' : 'شبیه‌سازی دمو';
        if (!canRun) reply += ' (اجرای واقعی فقط داخل نرم‌افزار ویندوزی انجام می‌شود.)';
      }
    } catch (_) {
      rcTag.textContent = canRun ? 'اجرا نشد' : 'شبیه‌سازی دمو';
    }
    return reply;
  }

  /* cmdBusy: جلوگیری از اجرای دوباره فرمان در حین اجرای فرمان قبلی.
     توجه: state=processing بعد از تشخیص گفتار کاملاً طبیعی است و
     نباید فرمان را رد کند (باگ قدیمی که جواب‌های گوگل/GLM را ساکت دور می‌ریخت). */
  let cmdBusy = false;
  async function runCommand(cmd) {
    if (!cmd) return;
    if (cmdBusy) return;
    cmdBusy = true;
    if (state === 'listening') stopListening(false);
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (_) { /* noop */ }

    setState('processing');
    statusText.textContent = 'در حال انجام…';
    body.classList.add('has-card');
    rcHeard.textContent = `«${cmd}»`;
    respCard.classList.remove('show');
    void respCard.offsetWidth;
    respCard.classList.add('show');
    rcReply.textContent = '';
    rcTag.textContent = 'در حال انجام…';

    const rule = RULES.find((r) => r.k.test(cmd)) || findCustomRule(cmd);
    if (!rule && aiConnected()) {
      /* فرمان شناخته نشد → هوش مصنوعی تحلیل و جواب می‌دهد */
      await aiHandleCommand(cmd);
      return;
    }
    const reply = rule ? await resolveReply(rule, cmd) : DEFAULT_REPLY;
    if (!rule) rcTag.textContent = 'پاسخ آوا';

    setTimeout(() => {
      setState('success');
      statusText.textContent = 'انجام شد';
      typeText(rcReply, reply);
      speak(reply);
      if (rule && rule.t) toast(rule.t, rule.i || '#i-info');
      pushHistory(cmd, !/نشده|نمی‌شود/.test(rcTag.textContent || ''));
      handsFreeRearm();
      setTimeout(() => {
        cmdBusy = false;
        if (state === 'success') {
          setState('idle');
          statusText.innerHTML = IDLE_HINT;
        }
      }, 2400);
    }, 500 + Math.random() * 300);
  }

  /* ============================================================
     تشخیص گفتار واقعی — زنجیره: موتور وب → گوگل رایگان (HTTP) → GLM-ASR
     بدون هیچ کلیدی؛ دمو فقط با تنظیم صریح کاربر.
     ============================================================ */
  let rec = null, recActive = false, gotFinal = false, srBroken = false, demoNoticeShown = false;
  let glmRec = null, glmTimer = null, glmMaxTimer = null, glmSpoke = false, glmListening = false, glmSilentMs = 0;
  const ASR_MODEL = 'glm-asr-2512';
  const GLM_MAX_MS = 12000;   // بیشینه ضبط هر فرمان صوتی
  const GLM_SIL_MS = 2300;    // سکوت لازم برای پایان فرمان
  const GLM_ON_LVL = 16;      // آستانه تشخیص شروع حرف (میانگین طیف)

  const googleReady = () => !!(bridge && bridge.stt && bridge.stt.google);

  function refreshEngineUI() {
    try { window.__avaAsrReady = asrReady; window.__avaAsrBroken = asrBroken; } catch (_) { /* noop */ }
    if (whisperReady() && settings.sttEngine !== 'web' && settings.sttEngine !== 'google' && settings.sttEngine !== 'glm')
      sbEngine.innerHTML = asrReady
        ? '<i class="dot ok"></i>موتور: آفلاین Whisper — بدون اینترنت'
        : '<i class="dot warn"></i>موتور: آفلاین (در حال آماده‌سازی…)';
    else if (SRC && !srBroken && settings.sttEngine !== 'google' && settings.sttEngine !== 'glm' && settings.sttEngine !== 'whisper') sbEngine.innerHTML = '<i class="dot ok"></i>موتور: تشخیص گفتار وب';
    else if (googleReady() && settings.sttEngine !== 'web' && settings.sttEngine !== 'glm' && settings.sttEngine !== 'whisper') sbEngine.innerHTML = '<i class="dot ok"></i>موتور: گوگل رایگان';
    else if (glmReady() && settings.sttEngine !== 'web' && settings.sttEngine !== 'google' && settings.sttEngine !== 'whisper') sbEngine.innerHTML = '<i class="dot ok"></i>موتور: GLM-ASR ابری';
    else if (settings.demoMode) sbEngine.innerHTML = '<i class="dot warn"></i>موتور: حالت دمو';
    else sbEngine.innerHTML = '<i class="dot err"></i>موتور: تنظیم نشده';
  }

  function resolveEngine() {
    const eng = settings.sttEngine || 'auto';
    if (eng === 'whisper') return whisperReady() ? 'whisper' : null;
    if (eng === 'web') return (SRC && !srBroken) ? 'web' : null;
    if (eng === 'google') return googleReady() ? 'google' : null;
    if (eng === 'glm') return glmReady() ? 'glm' : null;
    /* خودکار: اول موتور آفلاین داخلی، بعد وب، بعد گوگل، بعد GLM */
    if (whisperReady()) return 'whisper';
    if (SRC && !srBroken) return 'web';
    if (googleReady()) return 'google';
    if (glmReady()) return 'glm';
    return null;
  }

  function makeRec() {
    const r = new SRC();
    r.lang = 'fa-IR';
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t; else interim += t;
      }
      if (interim && state === 'listening') statusText.textContent = `شنیدم: «${interim}»`;
      if (final) {
        gotFinal = true;
        stopListening(false);
        runCommand(final.trim());
      }
    };
    r.onerror = (e) => {
      if (['network', 'not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'].includes(e.error)) {
        srBroken = true;
        refreshEngineUI();
        /* فالبک خودکار: گوگل رایگان → GLM ابری (اگر کلید باشد) */
        if (state === 'listening' && settings.sttEngine === 'auto') {
          try { recActive = false; } catch (_) { /* noop */ }
          if (googleReady()) startGoogleListen();
          else if (glmReady()) startGlmListen();
        }
      }
    };
    r.onend = () => {
      recActive = false;
      if (gotFinal || srBroken) return;
      if (state === 'listening') {
        setState('idle');
        statusText.innerHTML = IDLE_HINT;
        orbIcon.setAttribute('href', '#i-mic');
        sbMic.innerHTML = '<i class="dot ok"></i>میکروفون: آماده';
      }
    };
    return r;
  }

  /* --- موتور رایگان گوگل: ضبط PCM + تشخیص سکوت + ارسال به سرور گوگل --- */
  const G_MAX_MS = 12000;    // بیشینه ضبط
  const G_SIL_MS = 1500;     // سکوت پایان فرمان
  const G_ON = 0.013;        // آستانه شروع حرف (RMS)
  const G_IDLE_MS = 8000;    // اگر هیچ حرفی نشنید
  let gRec = null, gMaxT = null;

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

  function startGoogleListen() {
    if (!googleReady()) { noEngine('موتور گوگل فقط داخل نرم‌افزار فعال است'); return; }
    attachMic().then((ok) => {
      if (!ok) { noEngine('میکروفون در دسترس نیست'); return; }
      try {
        const src = audioCtx.createMediaStreamSource(micStream);
        const proc = audioCtx.createScriptProcessor(4096, 1, 1);
        const sink = audioCtx.createGain();
        sink.gain.value = 0; // بی‌صدا — فقط برای پردازش
        src.connect(proc);
        proc.connect(sink);
        sink.connect(audioCtx.destination);
        gRec = { src, proc, sink, chunks: [], spoke: false, lastVoice: 0, started: Date.now(), busy: false };
        proc.onaudioprocess = (e) => {
          if (!gRec || gRec.busy) return;
          const f = e.inputBuffer.getChannelData(0);
          gRec.chunks.push(new Float32Array(f));
          let sum = 0, n = 0;
          for (let i = 0; i < f.length; i += 4) { sum += f[i] * f[i]; n++; }
          const rms = Math.sqrt(sum / Math.max(1, n));
          const now = Date.now();
          if (rms > G_ON) {
            gRec.spoke = true;
            gRec.lastVoice = now;
            if (state === 'listening') statusText.textContent = 'شنیدم… بعد از سکوت، گوگل تبدیلش می‌کند';
          } else if (gRec.spoke && now - gRec.lastVoice > G_SIL_MS) {
            stopGoogleRec();
          } else if (!gRec.spoke && now - gRec.started > G_IDLE_MS) {
            stopGoogleRec();
          }
        };
        statusText.textContent = 'در حال گوش دادن (گوگل)… فرمانت را بگو';
        gMaxT = setTimeout(() => stopGoogleRec(), G_MAX_MS);
      } catch (_) {
        gRec = null;
        noEngine('شروع ضبط گوگل ممکن نشد');
      }
    });
  }

  function stopGoogleRec() {
    clearTimeout(gMaxT); gMaxT = null;
    if (!gRec) return;
    const g = gRec;
    gRec = null;
    try { g.proc.disconnect(); } catch (_) { /* noop */ }
    try { g.src.disconnect(); } catch (_) { /* noop */ }
    try { g.sink.disconnect(); } catch (_) { /* noop */ }
    if (g.busy) return;
    g.busy = true;
    const totalMs = (g.chunks.length * 4096 * 1000) / (audioCtx ? audioCtx.sampleRate : 48000);
    if (!g.spoke || totalMs < 350) {
      statusText.textContent = 'صدایی نشنیدم؛ دوباره امتحان کن';
      setTimeout(() => { if (state === 'listening' || state === 'processing') { setState('idle'); statusText.innerHTML = IDLE_HINT; orbIcon.setAttribute('href', '#i-mic'); sbMic.innerHTML = '<i class="dot ok"></i>میکروفون: آماده'; } }, 1500);
      return;
    }
    setState('processing');
    statusText.textContent = 'در حال تبدیل گفتار با گوگل…';
    const merged = new Float32Array(g.chunks.reduce((a, c) => a + c.length, 0));
    let off = 0;
    for (const c of g.chunks) { merged.set(c, off); off += c.length; }
    const rate = (audioCtx && audioCtx.sampleRate) || 48000;
    const pcm16 = f32ToI16(downsampleF32(merged, rate, 16000));
    bridge.stt.google({ pcm: new Uint8Array(pcm16.buffer), rate: 16000, key: settings.googleKey || '', lang: 'fa-IR' })
      .then((r) => {
        if (r && r.ok && r.text) {
          runCommand(r.text.trim());
        } else {
          setState('idle');
          statusText.textContent = 'تبدیل گوگل ممکن نشد: ' + ((r && r.error) || 'خطای نامشخص');
          orbIcon.setAttribute('href', '#i-mic');
          sbMic.innerHTML = '<i class="dot ok"></i>میکروفون: آماده';
          toast((r && r.error) || 'گوگل پاسخی نداد', '#i-info');
        }
      })
      .catch(() => {
        setState('idle');
        statusText.textContent = 'اتصال به گوگل برقرار نشد — اینترنت/فیلترشکن را چک کن';
        orbIcon.setAttribute('href', '#i-mic');
        sbMic.innerHTML = '<i class="dot ok"></i>میکروفون: آماده';
      });
  }

  /* --- موتور GLM-ASR: ضبط واقعی + ارسال به سرور + تبدیل به فرمان --- */
  function startGlmListen() {
    if (!glmReady()) { noEngine('کلید GLM تنظیم نشده'); return; }
    attachMic().then((ok) => {
      if (!ok) { noEngine('میکروفون در دسترس نیست'); return; }
      try {
        recChunks = [];
        glmSpoke = false;
        glmListening = true;
        glmRec = new MediaRecorder(micStream);
        glmRec.ondataavailable = (e) => { if (e.data && e.data.size) recChunks.push(e.data); };
        glmRec.onstop = finishGlmTranscribe;
        glmRec.start();
        statusText.textContent = 'در حال گوش دادن (GLM-ASR)… فرمانت را بگو';
        /* تشخیص سکوت برای توقف هوشمند ضبط (با کمی تحمل تا بین کلمات قطع نشود) */
        glmSilentMs = 0;
        glmTimer = setInterval(() => {
          if (!glmListening || !micData) return;
          let sum = 0;
          for (let i = 0; i < micData.length; i++) sum += micData[i];
          const avg = sum / micData.length;
          if (avg > GLM_ON_LVL) {
            glmSpoke = true;
            glmSilentMs = 0;
            statusText.textContent = 'شنیدم… بعد از سکوت، تبدیلش می‌کنم';
          } else if (glmSpoke) {
            glmSilentMs += 300;
            if (glmSilentMs >= 1300) stopGlmRec();
          }
        }, 300);
        glmMaxTimer = setTimeout(() => stopGlmRec(), GLM_MAX_MS);
      } catch (_) {
        noEngine('شروع ضبط ممکن نشد');
      }
    });
  }

  function stopGlmRec() {
    clearInterval(glmTimer); clearTimeout(glmMaxTimer);
    glmTimer = null; glmMaxTimer = null;
    if (glmListening && glmRec && glmRec.state !== 'inactive') {
      try { glmRec.stop(); } catch (_) { finishGlmTranscribe(); }
    } else {
      glmListening = false;
    }
  }

  async function finishGlmTranscribe() {
    glmListening = false;
    glmRec = null;
    const blob = new Blob(recChunks, { type: (micRecMime() || 'audio/webm') });
    recChunks = [];
    if (!blob.size || blob.size < 900) {
      statusText.textContent = 'صدایی نشنیدم؛ دوباره امتحان کن';
      setTimeout(() => { if (state === 'listening') { setState('idle'); statusText.innerHTML = IDLE_HINT; orbIcon.setAttribute('href', '#i-mic'); } }, 1600);
      return;
    }
    setState('processing');
    statusText.textContent = 'در حال تبدیل گفتار به متن با GLM-ASR…';
    try {
      const buf = new Uint8Array(await blob.arrayBuffer());
      const r = await bridge.stt.transcribe({ buf, base: settings.glmBase, key: settings.glmKey, model: ASR_MODEL });
      if (r && r.ok && r.text) {
        runCommand(r.text.trim());
      } else {
        setState('idle');
        statusText.textContent = 'تبدیل گفتار ممکن نشد: ' + ((r && r.error) || 'خطای نامشخص');
        orbIcon.setAttribute('href', '#i-mic');
        toast('GLM-ASR: ' + ((r && r.error) || 'خطای نامشخص'), '#i-info');
      }
    } catch (_) {
      setState('idle');
      statusText.textContent = 'اتصال به GLM-ASR برقرار نشد';
      orbIcon.setAttribute('href', '#i-mic');
    }
  }

  function micRecMime() {
    if (typeof MediaRecorder === 'undefined') return '';
    for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']) {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m;
    }
    return '';
  }

  /* ============================================================
     موتور آفلاین Whisper — کاملاً داخل برنامه، بدون اینترنت
     ورکر + مدل باندل‌شده → بدون فیلترشکن، بدون کلید، بدون ارسال صدا به سرور
     ============================================================ */
  const whisperReady = () => !!(bridge && window.Worker && !asrBroken);
  let asrWorker = null, asrReady = false, asrBroken = false, asrSeq = 0, asrCreating = false;
  const asrPending = new Map();

  /* ورکر ماژول با Blob ساخته می‌شود — لود مستقیم اسکریپت ورکر از پروتکل سفارشی
     در Chromium با COEP مشکل دارد، ولی Blob-Module-Worker همیشه کار می‌کند؛
     خود اسکریپت ورکر کتابخانه را با URL مطلق ava://app/... ایمپورت می‌کند. */
  function asrEnsure(done) {
    if (asrBroken) { if (done) done(null); return; }
    if (asrWorker) { if (done) done(asrWorker); return; }
    if (asrCreating) { setTimeout(() => asrEnsure(done), 300); return; }
    if (!window.Worker) { asrBroken = true; refreshEngineUI(); if (done) done(null); return; }
    asrCreating = true;
    (async () => {
      try {
        const url = new URL('js/asr.module.js', location.href).href;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const code = await resp.text();
        const w = new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })), { type: 'module' });
        w.onmessage = (e) => {
          const d = e.data || {};
          if (d.type === 'ready') { asrReady = true; refreshEngineUI(); return; }
          if (d.type === 'loaderror' || d.type === 'boot-error') {
            asrBroken = true; refreshEngineUI();
            try { console.warn('[AVA ASR]', d.error || 'load failed'); } catch (_) { /* noop */ }
            return;
          }
          if (d.type === 'result') {
            const cb = asrPending.get(d.id);
            asrPending.delete(d.id);
            if (cb) cb(d);
          }
        };
        w.onerror = (e) => {
          asrBroken = true; refreshEngineUI();
          try { console.warn('[AVA ASR] worker error:', String((e && e.message) || 'unknown').slice(0, 200)); } catch (_) { /* noop */ }
        };
        asrWorker = w;
        asrCreating = false;
        refreshEngineUI();
        w.postMessage({ type: 'load' }); /* پیش‌بارگذاری مدل */
        if (done) done(w);
      } catch (err) {
        asrBroken = true;
        asrCreating = false;
        refreshEngineUI();
        try { console.warn('[AVA ASR] create failed:', String((err && err.message) || err).slice(0, 200)); } catch (_) { /* noop */ }
        if (done) done(null);
      }
    })();
  }

  function asrRecognize(pcm) {
    return new Promise((resolve) => {
      if (asrBroken || !asrWorker) { resolve({ ok: false, error: 'موتور آفلاین در دسترس نیست' }); return; }
      const id = ++asrSeq;
      asrPending.set(id, resolve);
      try {
        asrWorker.postMessage({ type: 'recognize', id, pcm }, [pcm.buffer]);
      } catch (_) {
        asrPending.delete(id);
        resolve({ ok: false, error: 'ارسال صدا به موتور ممکن نشد' });
        return;
      }
      setTimeout(() => {
        if (asrPending.has(id)) {
          asrPending.delete(id);
          resolve({ ok: false, error: 'تبدیل گفتار بیش از حد طول کشید' });
        }
      }, 30000);
    });
  }

  /* --- کپچر هوشمند صدا: کف نویز تطبیقی + تشخیص پایان فرمان (VAD) --- */
  const WC_MAX_MS = 12000;   // بیشینه ضبط هر فرمان
  const WC_SIL_MS = 1400;    // سکوت لازم برای پایان (تحمل فاصله کلمات)
  const WC_MIN_MS = 400;     // کمینه طول گفتار معتبر
  const WC_IDLE_MS = 8000;   // اگر هیچ حرفی نشنید
  let wCap = null;

  function startWhisperListen() {
    asrEnsure((w) => {
      if (!w) { noEngine('موتور آفلاین فقط داخل نرم‌افزار فعال است'); return; }
      if (state !== 'listening') return; /* کاربر منصرف شده */
      attachMic().then((ok) => {
      if (!ok) { noEngine('میکروفون در دسترس نیست'); return; }
      try {
        if (audioCtx.state === 'suspended') { try { audioCtx.resume(); } catch (_) { /* noop */ } }
        const src = audioCtx.createMediaStreamSource(micStream);
        const proc = audioCtx.createScriptProcessor(4096, 1, 1);
        const sink = audioCtx.createGain();
        sink.gain.value = 0; // بی‌صدا — فقط پردازش
        src.connect(proc); proc.connect(sink); sink.connect(audioCtx.destination);
        wCap = { src, proc, sink, chunks: [], spoke: false, lastVoice: 0, started: Date.now(), floor: 0.008, maxT: null };
        proc.onaudioprocess = (e) => {
          if (!wCap) return;
          const f = e.inputBuffer.getChannelData(0);
          wCap.chunks.push(new Float32Array(f));
          let sum = 0, n = 0;
          for (let i = 0; i < f.length; i += 4) { sum += f[i] * f[i]; n++; }
          const rms = Math.sqrt(sum / Math.max(1, n));
          /* کف نویز تطبیقی: در سکوت، آستانه خودش را با محیط تنظیم می‌کند */
          if (!wCap.spoke) wCap.floor = Math.max(0.004, wCap.floor * 0.985 + rms * 0.015);
          const thr = Math.max(0.013, wCap.floor * 3);
          const now = Date.now();
          if (rms > thr) {
            if (!wCap.spoke && state === 'listening') statusText.textContent = 'شنیدم… بعد از سکوت، خودم تبدیلش می‌کنم (آفلاین)';
            wCap.spoke = true;
            wCap.lastVoice = now;
          } else if (wCap.spoke && now - wCap.lastVoice > WC_SIL_MS) {
            stopWhisperRec();
          } else if (!wCap.spoke && now - wCap.started > WC_IDLE_MS) {
            stopWhisperRec();
          }
        };
        wCap.maxT = setTimeout(() => stopWhisperRec(), WC_MAX_MS);
      } catch (_) {
        wCap = null;
        noEngine('شروع گوش دادن آفلاین ممکن نشد');
      }
      });
    });
  }

  function stopWhisperRec() {
    if (!wCap) return;
    const cap = wCap;
    wCap = null;
    clearTimeout(cap.maxT);
    try { cap.proc.disconnect(); } catch (_) { /* noop */ }
    try { cap.src.disconnect(); } catch (_) { /* noop */ }
    try { cap.sink.disconnect(); } catch (_) { /* noop */ }
    const rate = (audioCtx && audioCtx.sampleRate) || 48000;
    const totalMs = (cap.chunks.length * 4096 * 1000) / rate;
    if (!cap.spoke || totalMs < WC_MIN_MS) {
      statusText.textContent = 'صدایی نشنیدم؛ دوباره امتحان کن';
      setTimeout(() => {
        if (state === 'listening') {
          setState('idle');
          statusText.innerHTML = IDLE_HINT;
          orbIcon.setAttribute('href', '#i-mic');
          sbMic.innerHTML = '<i class="dot ok"></i>میکروفون: آماده';
        }
        handsFreeRearm();
      }, 1500);
      return;
    }
    setState('processing');
    statusText.textContent = 'در حال تبدیل گفتار (آفلاین)…';
    const merged = new Float32Array(cap.chunks.reduce((a, c) => a + c.length, 0));
    let off = 0;
    for (const c of cap.chunks) { merged.set(c, off); off += c.length; }
    const pcm16k = downsampleF32(merged, rate, 16000);
    const pcm = trimSilenceEdges(pcm16k, 16000);
    asrRecognize(pcm).then((r) => {
      if (r && r.ok && r.text) {
        handleUtterance(r.text.trim());
      } else {
        setState('idle');
        statusText.textContent = 'تبدیل آفلاین ممکن نشد: ' + ((r && r.error) || 'نامشخص');
        orbIcon.setAttribute('href', '#i-mic');
        sbMic.innerHTML = '<i class="dot ok"></i>میکروفون: آماده';
        toast((r && r.error) || 'موتور آفلاین پاسخی نداد', '#i-info');
        handsFreeRearm();
      }
    });
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
  }

  /* ============================================================
     پردازش گفته‌ها + حالت بی‌دست (کلمه بیدارباش «آوا»)
     ============================================================ */
  function handleUtterance(text) {
    let cmd = text;
    if (settings.handsFree && settings.wakeWord) {
      const m = text.match(/^\s*(هی\s+آوا|آوا\s?جان|آوا|اوا|آوای|اوای|ava)[\s،,:-]*(.*)$/i);
      if (!m) {
        /* بدون کلمه بیدارباش → نادیده بگیر و به گوش دادن ادامه بده */
        setState('idle');
        statusText.textContent = 'بگو «آوا …» تا فرمانت را اجرا کنم';
        handsFreeRearm();
        return;
      }
      cmd = (m[2] || '').trim();
      if (!cmd) {
        setState('idle');
        statusText.textContent = 'بله؟';
        speak('بله؟');
        handsFreeRearm();
        return;
      }
    }
    runCommand(cmd);
  }

  /* در حالت بی‌دست، بعد از هر فرمان/خطا دوباره گوش می‌دهیم */
  function handsFreeRearm() {
    if (!settings.handsFree) return;
    setTimeout(() => {
      if (!settings.handsFree) return;
      if (state !== 'idle') return;
      try {
        if (window.speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending)) {
          handsFreeRearm(); return; /* تا صدای خود آوا تمام شود */
        }
      } catch (_) { /* noop */ }
      startListening();
    }, 700);
  }

  function setHandsFree(on) {
    settings.handsFree = !!on;
    store.set('handsFree', settings.handsFree);
    updateHandsFreeUI();
    if (settings.handsFree) {
      toast('حالت بی‌دست روشن شد — بگو «آوا …»', '#i-wave');
      if (state === 'idle') startListening();
    } else {
      toast('حالت بی‌دست خاموش شد', '#i-wave');
      if (state === 'listening') stopListening();
    }
  }

  function updateHandsFreeUI() {
    if (btnHandsFree) {
      btnHandsFree.classList.toggle('active', !!settings.handsFree);
      btnHandsFree.setAttribute('aria-pressed', settings.handsFree ? 'true' : 'false');
    }
    if (optHandsFree) optHandsFree.checked = !!settings.handsFree;
    if (optWakeWord) optWakeWord.checked = !!settings.wakeWord;
  }

  /* --- وقتی هیچ موتوری نیست: پیام صادقانه (+ دمو فقط اگر کاربر روشن کرده) --- */
  function noEngine(reason) {
    setState('idle');
    orbIcon.setAttribute('href', '#i-mic');
    sbMic.innerHTML = '<i class="dot ok"></i>میکروفون: آماده';
    if (settings.demoMode) {
      startDemoListen();
      return;
    }
    statusText.innerHTML = 'تشخیص گفتار در دسترس نیست — ' + reason;
    toast('موتور رایگان گوگل فقط داخل نرم‌افزار ویندوزی فعال است', '#i-info');
  }

  /* ---------- گوش دادن ---------- */
  let listenTimer = null;
  function startListening() {
    if (state === 'processing') return;
    if (state === 'listening') return; /* از بی‌دست دوباره فراخوانی شده */
    clearTimeout(listenTimer);
    setState('listening');
    body.classList.remove('has-card');
    respCard.classList.remove('show');
    orbIcon.setAttribute('href', '#i-stop');
    sbMic.innerHTML = '<i class="dot rec"></i>میکروفون: در حال ضبط';
    gotFinal = false;
    attachMic();
    /* اگر کانتکست صوتی معلق بود، اینجا بیدارش می‌کنیم تا ضبط شروع شود */
    if (audioCtx && audioCtx.state === 'suspended') { try { audioCtx.resume(); } catch (_) { /* noop */ } }

    const eng = resolveEngine();
    if (eng === 'whisper') {
      startWhisperListen();
      return;
    }
    if (eng === 'web') {
      try {
        rec = makeRec();
        statusText.textContent = 'در حال گوش دادن… فرمانت را بگو';
        recActive = true;
        rec.start();
        return;
      } catch (_) { srBroken = true; }
    }
    if (eng === 'google') {
      startGoogleListen();
      return;
    }
    if (eng === 'glm') {
      startGlmListen();
      return;
    }
    noEngine(SRC ? 'موتور وب از کار افتاد و موتور گوگل اینجا فعال نیست' : 'موتور گوگل اینجا پشتیبانی نمی‌شود (فقط داخل نرم‌افزار)');
  }

  function startDemoListen() {
    statusText.textContent = 'حالت دمو: در حال شنیدن…';
    if (!demoNoticeShown) {
      demoNoticeShown = true;
      toast('حالت دمو روشن است — برای تشخیص واقعی، کلید GLM را در تنظیمات بگذار', '#i-info');
    }
    listenTimer = setTimeout(() => {
      const demo = chips[Math.floor(Math.random() * chips.length)].dataset.cmd;
      stopListening(false);
      runCommand(demo);
    }, 4200);
  }

  function stopListening(reset = true) {
    clearTimeout(listenTimer);
    clearInterval(glmTimer); clearTimeout(glmMaxTimer);
    glmTimer = null; glmMaxTimer = null;
    glmListening = false;
    if (rec && recActive) { try { rec.stop(); } catch (_) { /* noop */ } }
    recActive = false;
    if (glmRec && glmRec.state !== 'inactive') {
      /* جلوی ادامه فرایند تبدیل را می‌گیریم */
      glmRec.onstop = null;
      try { glmRec.stop(); } catch (_) { /* noop */ }
    }
    glmRec = null;
    if (gRec) {
      const g = gRec;
      gRec = null;
      try { g.proc.disconnect(); } catch (_) { /* noop */ }
      try { g.src.disconnect(); } catch (_) { /* noop */ }
      try { g.sink.disconnect(); } catch (_) { /* noop */ }
    }
    if (wCap) {
      const cap = wCap;
      wCap = null;
      clearTimeout(cap.maxT);
      try { cap.proc.disconnect(); } catch (_) { /* noop */ }
      try { cap.src.disconnect(); } catch (_) { /* noop */ }
      try { cap.sink.disconnect(); } catch (_) { /* noop */ }
    }
    clearTimeout(gMaxT); gMaxT = null;
    /* میکروفون روشن می‌ماند تا اکولایزر همیشه به صدای واقعی واکنش نشان دهد */
    orbIcon.setAttribute('href', '#i-mic');
    sbMic.innerHTML = '<i class="dot ok"></i>میکروفون: آماده';
    if (reset) {
      setState('idle');
      statusText.innerHTML = IDLE_HINT;
    }
  }
  const toggleListen = () => (state === 'listening' ? stopListening() : startListening());

  orb.addEventListener('click', toggleListen);

  /* ---------- فرمان‌های سریع ---------- */
  chips.forEach((c) => c.addEventListener('click', () => runCommand(c.dataset.cmd)));

  /* ---------- کادر فرمان ---------- */
  cmdBar.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = cmdInput.value.trim();
    if (!v) { cmdInput.focus(); return; }
    cmdInput.value = '';
    runCommand(v);
  });

  /* ---------- میانبرها ---------- */
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'Space') {
      e.preventDefault();
      toggleListen();
    } else if (e.ctrlKey && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      cmdInput.focus();
    } else if (e.key === 'Escape') {
      if (!confirmBox.hidden) hideConfirm();
      else if (!about.hidden) about.hidden = true;
      else if (!settingsPage.hidden) showSettings(false);
      else if (historyPage && !historyPage.hidden) showView('home');
      else if (!chatPage.hidden) showView('home');
      else if (state === 'listening') stopListening();
    }
  });
  if (bridge && bridge.voice) bridge.voice.onToggleListen(toggleListen);

  /* ---------- آیتم‌های قفل‌شده سایدبار ---------- */
  document.querySelectorAll('.rail-item.locked').forEach((b) =>
    b.addEventListener('click', () => toast('این بخش در نسخه بعدی اضافه می‌شود', '#i-info'))
  );

  /* ---------- تاریخچه فرمان‌ها ---------- */
  function pushHistory(cmd, ok = true) {
    const t = String(cmd || '').trim();
    if (!t) return;
    if (history[0] && history[0].t === t) return; /* تکرار پشت‌سرهم ثبت نشود */
    history.unshift({ t, ok: !!ok, at: Date.now() });
    history = history.slice(0, 40);
    store.set('history', history);
  }
  function renderHistory() {
    if (!historyList) return;
    historyList.innerHTML = '';
    if (historyEmpty) historyEmpty.hidden = history.length > 0;
    history.forEach((h) => {
      const it = document.createElement('div');
      it.className = 'history-item';
      const dot = document.createElement('i');
      dot.className = 'h-ok ' + (h.ok ? 'ok' : 'fail');
      const txt = document.createElement('span');
      txt.className = 'h-txt';
      txt.textContent = h.t;
      const tm = document.createElement('span');
      tm.className = 'h-time';
      try { tm.textContent = timeFmt.format(new Date(h.at)); } catch (_) { tm.textContent = ''; }
      it.appendChild(dot); it.appendChild(txt); it.appendChild(tm);
      it.addEventListener('click', () => {
        showView('home');
        runCommand(h.t);
      });
      historyList.appendChild(it);
    });
  }
  if (btnHistory) btnHistory.addEventListener('click', () => {
    renderHistory();
    showView('history');
  });
  if (btnHistoryBack) btnHistoryBack.addEventListener('click', () => showView('home'));
  if (btnHistoryClear) btnHistoryClear.addEventListener('click', () => {
    history = [];
    store.set('history', history);
    renderHistory();
    toast('تاریخچه پاک شد', '#i-trash');
  });

  /* ---------- تاگل‌های حالت بی‌دست ---------- */
  if (btnHandsFree) btnHandsFree.addEventListener('click', () => setHandsFree(!settings.handsFree));
  if (optHandsFree) optHandsFree.addEventListener('change', () => setHandsFree(optHandsFree.checked));
  if (optWakeWord) optWakeWord.addEventListener('change', () => {
    settings.wakeWord = optWakeWord.checked;
    store.set('wakeWord', settings.wakeWord);
    toast(settings.wakeWord
      ? 'کلمه بیدارباش «آوا» فعال است'
      : 'هر گفتاری بدون کلمه بیدارباش اجرا می‌شود — مراقب سوءتفاهم باش!', '#i-wave');
  });
  if (bridge && bridge.voice && bridge.voice.onToggleHandsFree) {
    bridge.voice.onToggleHandsFree(() => setHandsFree(!settings.handsFree));
  }

  /* ---------- ناوبری: خانه / تنظیمات / چت / تاریخچه ----------
     ============================================================ */
  let appVersion = '0.7.0';

  function showView(v) {
    settingsPage.hidden = v !== 'settings';
    chatPage.hidden = v !== 'chat';
    if (historyPage) historyPage.hidden = v !== 'history';
    hero.style.display = v === 'home' ? '' : 'none';
    btnHome.classList.toggle('active', v === 'home');
    btnSettings.classList.toggle('active', v === 'settings');
    btnChat.classList.toggle('active', v === 'chat');
    if (btnHistory) btnHistory.classList.toggle('active', v === 'history');
    $('#main').scrollTop = 0;
    if (v === 'settings') refreshSettingsUI();
    if (v === 'chat') {
      if (!chatMsgs.childElementCount) chatWelcome();
      setTimeout(() => chatInput.focus(), 150);
    }
  }
  function showSettings(on) { showView(on ? 'settings' : 'home'); }
  btnSettings.addEventListener('click', () => showView(settingsPage.hidden ? 'settings' : 'home'));
  btnHome.addEventListener('click', () => showView('home'));
  btnSettingsBack.addEventListener('click', () => showView('home'));
  btnChat.addEventListener('click', () => showView(chatPage.hidden ? 'chat' : 'home'));
  btnChatBack.addEventListener('click', () => showView('home'));

  function loadAppVersion() {
    const render = () => { updText.textContent = `نسخه فعلی: v${faNum(appVersion)}`; };
    if (bridge && bridge.system && bridge.system.info) {
      bridge.system.info().then((i) => {
        appVersion = (i && i.version) || appVersion;
        render();
      }).catch(render);
    } else {
      render();
    }
  }

  function refreshSettingsUI() {
    optTts.checked = !!settings.tts;
    optAutoUpdate.checked = !!settings.autoUpdate;
    optDemo.checked = !!settings.demoMode;
    optSttEngine.value = settings.sttEngine || 'auto';
    optGlmKey.value = settings.glmKey || '';
    optGoogleKey.value = settings.googleKey || '';
    optAiModel.value = settings.glmModel || 'glm-4.6';
    updateHandsFreeUI();
    refreshEngineUI();
    fillVoiceSelect();
    listMicDevices();
    loadAppVersion();
    if (bridge && bridge.settings) {
      bridge.settings.flags().then((f) => {
        optTop.checked = !!(f && f.alwaysOnTop);
        optLogin.checked = !!(f && f.loginItem);
      }).catch(() => { /* noop */ });
    } else {
      optTop.checked = false;
      optLogin.checked = false;
    }
  }

  const needApp = () => toast('این گزینه فقط داخل نرم‌افزار ویندوزی کار می‌کند', '#i-info');

  optTts.addEventListener('change', () => {
    settings.tts = optTts.checked;
    store.set('tts', settings.tts);
    if (settings.tts) speak('پاسخ گفتاری فعال شد');
    else if (window.speechSynthesis) speechSynthesis.cancel();
  });

  optAutoUpdate.addEventListener('change', () => {
    settings.autoUpdate = optAutoUpdate.checked;
    store.set('autoUpdate', settings.autoUpdate);
    if (bridge && bridge.updater) bridge.updater.setAuto(settings.autoUpdate);
    toast(settings.autoUpdate ? 'بررسی خودکار فعال شد' : 'بررسی خودکار خاموش شد', '#i-refresh');
  });

  optTop.addEventListener('change', async () => {
    if (!bridge || !bridge.settings) { optTop.checked = false; needApp(); return; }
    try {
      const v = await bridge.settings.setAlwaysOnTop(optTop.checked);
      optTop.checked = !!v;
      toast(v ? 'آوا حالا همیشه روون است' : 'حالت همیشه‌روون خاموش شد', '#i-power');
    } catch (_) { optTop.checked = false; }
  });

  optLogin.addEventListener('change', async () => {
    if (!bridge || !bridge.settings) { optLogin.checked = false; needApp(); return; }
    try {
      const v = await bridge.settings.setLoginItem(optLogin.checked);
      if (v === null || v === undefined) {
        optLogin.checked = false;
        toast('در این محیط قابل اعمال نیست', '#i-info');
      } else {
        optLogin.checked = !!v;
        toast(v ? 'اجرای خودکار با ویندوز فعال شد' : 'اجرای خودکار خاموش شد', '#i-power');
      }
    } catch (_) { optLogin.checked = false; }
  });

  /* --- موتور تشخیص گفتار و کلید GLM --- */
  optSttEngine.addEventListener('change', () => {
    settings.sttEngine = optSttEngine.value || 'auto';
    store.set('sttEngine', settings.sttEngine);
    refreshEngineUI();
    if (settings.sttEngine === 'glm' && !settings.glmKey) {
      optGlmKey.focus();
      toast('موتور GLM به کلید نیاز دارد — یا موتور «خودکار»/«گوگل رایگان» را انتخاب کن', '#i-key');
    }
  });

  optGlmKey.addEventListener('change', () => {
    settings.glmKey = optGlmKey.value.trim();
    store.set('glmKey', settings.glmKey);
    refreshEngineUI();
    toast(settings.glmKey ? 'کلید ذخیره شد — تشخیص گفتار ابری و چت فعال شد' : 'کلید پاک شد', '#i-key');
  });

  btnKeyShow.addEventListener('click', () => {
    const show = optGlmKey.type === 'password';
    optGlmKey.type = show ? 'text' : 'password';
    btnKeyShow.querySelector('span').textContent = show ? 'مخفی' : 'نمایش';
  });

  optDemo.addEventListener('change', () => {
    settings.demoMode = optDemo.checked;
    store.set('demoMode', settings.demoMode);
    refreshEngineUI();
    toast(settings.demoMode ? 'حالت دمو روشن شد' : 'حالت دمو خاموش شد — تشخیص واقعی یا پیام خطا', '#i-info');
  });

  optGoogleKey.addEventListener('change', () => {
    settings.googleKey = optGoogleKey.value.trim();
    store.set('googleKey', settings.googleKey);
    refreshEngineUI();
    toast(settings.googleKey ? 'کلید اختصاصی گوگل ذخیره شد' : 'کلید پاک شد — استفاده از کلید رایگان داخلی', '#i-key');
  });

  btnGoZai.addEventListener('click', () => {
    showView('chat');
    selectChatTab('zai');
    toast('یک بار وارد حسابت شو — بعدش همه‌چیز بدون کلید کار می‌کند', '#i-globe');
  });

  optAiModel.addEventListener('change', () => {
    settings.glmModel = optAiModel.value;
    store.set('glmModel', settings.glmModel);
    toast(`مدل گفتگو: ${optAiModel.selectedOptions[0].textContent}`, '#i-spark');
  });

  /* --- انتخاب صدای گوینده --- */
  function fillVoiceSelect() {
    if (!('speechSynthesis' in window)) {
      optVoice.innerHTML = '<option value="">بدون موتور گفتار</option>';
      optVoice.disabled = true;
      return;
    }
    optVoice.disabled = false;
    const voices = speechSynthesis.getVoices() || [];
    const faFirst = [...voices].sort((a, b) => (/^fa/i.test(b.lang) ? 1 : 0) - (/^fa/i.test(a.lang) ? 1 : 0));
    let html = '<option value="">خودکار (فارسی اگر نصب باشد)</option>';
    faFirst.forEach((v) => {
      const sel = settings.voiceURI === v.voiceURI ? ' selected' : '';
      html += `<option value="${v.voiceURI}"${sel}>${v.name} — ${v.lang}</option>`;
    });
    optVoice.innerHTML = voices.length ? html : '<option value="">صدایی یافت نشد</option>';
  }
  optVoice.addEventListener('change', () => {
    settings.voiceURI = optVoice.value || '';
    store.set('voiceURI', settings.voiceURI);
    speak('سلام! من آوا هستم.');
  });
  if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = fillVoiceSelect;
    setTimeout(fillVoiceSelect, 300);
  }

  /* --- به‌روزرسانی --- */
  function setUpdUI(s) {
    updProgress.hidden = true;
    btnInstallUpdate.hidden = true;
    if (btnCheckUpdate) btnCheckUpdate.disabled = false;
    switch (s && s.state) {
      case 'checking':
        updNote.textContent = 'در حال بررسی نسخه جدید…';
        break;
      case 'available':
        updNote.textContent = `نسخه جدید v${faNum(s.version || '')} پیدا شد — در حال دانلود…`;
        updProgress.hidden = false;
        updBar.style.width = '6%';
        break;
      case 'downloading':
        updNote.textContent = `در حال دانلود: ${faNum(s.percent || 0)}٪`;
        updProgress.hidden = false;
        updBar.style.width = `${Math.max(4, s.percent || 0)}%`;
        break;
      case 'ready':
        updNote.textContent = `نسخه v${faNum(s.version || '')} آماده نصب است`;
        btnInstallUpdate.hidden = false;
        toast('نسخه جدید آماده نصب است — از تنظیمات نصبش کن', '#i-download');
        break;
      case 'none':
        updNote.textContent = 'آخرین نسخه را داری ✓';
        break;
      case 'dev':
        updNote.textContent = 'در حالت توسعه (npm start) به‌روزرسان غیرفعال است؛ خروجی نصب‌شده کار می‌کند';
        break;
      case 'error':
        updNote.textContent = 'خطا در بروزرسانی: ' + String(s.message || '').slice(0, 90);
        break;
      default:
        updNote.textContent = 'اتصال خودکار به GitHub Releases';
    }
  }

  if (bridge && bridge.updater) {
    bridge.updater.onStatus(setUpdUI);
    if (bridge.updater.setAuto) bridge.updater.setAuto(settings.autoUpdate);
    btnCheckUpdate.addEventListener('click', async () => {
      btnCheckUpdate.disabled = true;
      updNote.textContent = 'در حال بررسی نسخه جدید…';
      const r = await bridge.updater.check().catch(() => ({ ok: false, error: 'اتصال برقرار نشد' }));
      btnCheckUpdate.disabled = false;
      if (r && r.dev) setUpdUI({ state: 'dev' });
      else if (r && !r.ok) setUpdUI({ state: 'error', message: r.error });
      else if (r && r.ok) setUpdUI({ state: 'checking' });
    });
    btnInstallUpdate.addEventListener('click', () => {
      toast('در حال نصب نسخه جدید… برنامه راه‌اندازی مجدد می‌شود', '#i-download');
      bridge.updater.install();
    });
  } else {
    btnCheckUpdate.addEventListener('click', () => toast('آپدیت خودکار فقط داخل نرم‌افزار ویندوزی کار می‌کند', '#i-refresh'));
    btnInstallUpdate.addEventListener('click', needApp);
  }

  /* --- پیوندها (باز شدن در مرورگر پیش‌فرض) --- */
  document.querySelectorAll('#settingsPage [data-url]').forEach((b) =>
    b.addEventListener('click', async () => {
      const url = b.dataset.url;
      if (bridge && bridge.system && bridge.system.openUrl) {
        const r = await bridge.system.openUrl(url);
        if (!r || !r.ok) toast('باز کردن لینک ممکن نشد', '#i-info');
      } else {
        window.open(url, '_blank');
      }
    })
  );

  /* ============================================================
     فرمان‌های سفارشی (ساخته‌شده با هوش مصنوعی) + مودال تأیید
     ============================================================ */
  let confirmResolve = null;
  const chipsBox = $('#chips');

  const normFa = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/\u064A/g, '\u06CC')
      .replace(/\u0643/g, '\u06A9')
      .replace(/[\s\u200C]+/g, ' ')
      .trim();

  function findCustomRule(cmd) {
    const n = normFa(cmd);
    if (!n) return null;
    const cc = customCmds.find((c) => (c.phrases || []).some((p) => n.includes(normFa(p))));
    if (!cc) return null;
    return {
      custom: true,
      k: /.*/,
      t: cc.title || 'فرمان سفارشی',
      i: '#i-spark',
      r: async () => runCustom(cc),
    };
  }

  async function runCustom(cc) {
    const act = cc.action || {};
    if (act.type === 'open_url') {
      if (bridge && bridge.system && bridge.system.openUrl) {
        const r = await bridge.system.openUrl(act.value);
        return r && r.ok ? `«${cc.title}» باز شد.` : 'باز کردن لینک ممکن نشد.';
      }
      window.open(act.value, '_blank');
      return `«${cc.title}» باز شد (در مرورگر).`;
    }
    if (act.type === 'run') {
      if (!canRun) return 'اجرای واقعی فقط داخل نرم‌افزار ویندوزی انجام می‌شود.';
      const r = await bridge.system.run(act.value);
      return r && r.ok ? `«${cc.title}» انجام شد.` : `اجرا نشد: ${(r && r.error) || 'خطای نامشخص'}`;
    }
    if (act.type === 'ps') {
      if (!bridge || !bridge.custom) return 'اجرای اسکریپت فقط داخل نرم‌افزار ویندوزی انجام می‌شود.';
      const okGo = await askConfirm({
        title: 'اجرای فرمان سفارشی',
        text: `اسکریپت PowerShell زیر برای فرمان «${cc.title}» ذخیره شده. اجرا شود؟`,
        code: act.value,
      });
      if (!okGo) return 'بی‌خیال؛ اجرا نشد.';
      const r = await bridge.custom.run(act.value);
      if (r && r.ok) return (r.out ? `انجام شد: ${r.out}` : 'انجام شد.') + '';
      return `اجرا نشد: ${(r && r.error) || 'خطای نامشخص'}`;
    }
    return 'نوع فرمان سفارشی پشتیبانی نمی‌شود.';
  }

  function askConfirm({ title, text, code }) {
    return new Promise((resolve) => {
      cfTitle.textContent = title || 'تأیید';
      cfText.textContent = text || '';
      if (code) { cfCode.hidden = false; cfCode.textContent = code; }
      else cfCode.hidden = true;
      confirmBox.hidden = false;
      confirmResolve = resolve;
    });
  }
  function hideConfirm(val) {
    if (confirmBox.hidden) return;
    confirmBox.hidden = true;
    if (confirmResolve) { confirmResolve(!!val); confirmResolve = null; }
  }
  btnConfirmOk.addEventListener('click', () => hideConfirm(true));
  btnConfirmCancel.addEventListener('click', () => hideConfirm(false));

  function renderCustomChips() {
    chipsBox.querySelectorAll('.chip.custom').forEach((el) => el.remove());
    customCmds.forEach((cc) => {
      const b = document.createElement('button');
      b.className = 'chip custom';
      b.type = 'button';
      b.title = `فرمان سفارشی — ${(cc.phrases || [])[0] || cc.title}`;
      b.innerHTML = `<svg class="ic"><use href="#i-spark"/></svg><span></span><i class="chip-x" title="حذف فرمان">–</i>`;
      b.querySelector('span').textContent = cc.title;
      b.addEventListener('click', () => runCommand(cc.title));
      b.querySelector('.chip-x').addEventListener('click', (e) => {
        e.stopPropagation();
        customCmds = customCmds.filter((c) => c.id !== cc.id);
        store.set('customCmds', customCmds);
        renderCustomChips();
        toast(`فرمان «${cc.title}» حذف شد`, '#i-trash');
      });
      chipsBox.appendChild(b);
    });
  }

  /* ============================================================
     چت با هوش مصنوعی GLM — بدون کلید API (با نشست حساب z.ai) یا با کلید
     ============================================================ */
  const AI_SYSTEM =
    'تو مغز دستیار صوتی فارسی «آوا» هستی که روی ویندوز اجرا می‌شود و به فرمان‌های کاربر گوش می‌دهی.\n' +
    'همیشه فارسی، کوتاه (حداکثر ۳ جمله)، دوستانه و مفید جواب بده.\n' +
    'اگر کاربر خواست کاری/فرمانی جدید به برنامه اضافه شود، یا درخواستش قابل تبدیل به یک فرمان سیستم باشد،\n' +
    'در انتهای پاسخ این بلوک را اضافه کن (وگرنه هیچ بلوکی ننویس):\n' +
    '<<<ADD>>>\n' +
    '{"title":"نام کوتاه فرمان","phrases":["عبارتی که کاربر می‌گوید"],"action":{"type":"...","value":"..."}}\n' +
    '<<<END>>>\n' +
    'قواعد action:\n' +
    '- type=open_url: باز کردن وب‌سایت؛ value آدرس کامل https\n' +
    '- type=run: اجرای فرمان آماده؛ value یکی از: open_chrome, open_notepad, open_calc, open_explorer, open_vscode, open_taskmgr, open_settings, open_paint, open_youtube, open_music, open_downloads, open_documents, minimize_all, lock, screenshot, vol_up, vol_down, vol_mute, vol_set, recycle_empty\n' +
    '- type=ps: اسکریپت کوتاه تک‌خطی و غیرمخرب PowerShell\n' +
    'مثال: اگر کاربر گفت «فرمان باز کردن تلگرام بساز»، بلوک را با open_url و آدرس https://web.telegram.org بساز.';

  let chatBusy = false;
  let chatHist = [];   // تاریخچه گفتگو برای حافظه کوتاه
  let zaiToken = '';   // توکن نشست حساب z.ai — از webview خوانده می‌شود

  const aiConnected = () => !!zaiToken || !!settings.glmKey;

  function chatWelcome() {
    const ready = aiConnected();
    addMsg('bot', ready
      ? 'سلام! من مغز هوشمند آوا هستم و به حسابت وصل هستم. هر سوال پیچیده‌ای بپرسی جواب می‌دهم و اگر فرمانی بخواهی، خودم می‌سازمش و با تأیید تو به فرمان‌هام اضافه می‌کنم.'
      : 'سلام! من مغز هوشمند آوا هستم. برای چت بدون کلید API، برو تب «صفحه چت GLM» و یک بار وارد حسابت شو — بعد اینجا هر سوال و فرمانی بخواهی در خدمتم.');
  }

  function addMsg(role, text) {
    const m = document.createElement('div');
    m.className = `msg ${role === 'user' ? 'user' : role === 'err' ? 'err' : 'bot'}`;
    m.textContent = text;
    chatMsgs.appendChild(m);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
    return m;
  }

  /* استخراج بلوک افزودن فرمان از پاسخ AI */
  function parseAdd(text) {
    const t = String(text || '');
    const m = t.match(/<<<ADD>>>\s*([\s\S]*?)\s*<<<END>>>/);
    if (!m) return { reply: t.trim(), add: null };
    let add = null;
    try {
      const j = JSON.parse(m[1].replace(/^```(?:json)?/i, '').replace(/```$/, '').trim());
      if (j && j.title && j.action && j.action.type && j.action.value) add = j;
    } catch (_) { /* noop */ }
    return { reply: t.replace(m[0], '').trim(), add };
  }

  /* --- تب‌های چت: چت سریع / صفحه GLM --- */
  function selectChatTab(which) {
    const zai = which === 'zai';
    if (tabQuick) tabQuick.classList.toggle('active', !zai);
    if (tabZai) tabZai.classList.toggle('active', zai);
    if (quickWrap) quickWrap.hidden = zai;
    if (zaiWrap) zaiWrap.hidden = !zai;
    if (zai) setTimeout(() => checkZaiToken(), 900);
  }
  if (tabQuick) tabQuick.addEventListener('click', () => selectChatTab('quick'));
  if (tabZai) tabZai.addEventListener('click', () => selectChatTab('zai'));

  function setZaiBadge(on, txt) {
    if (!zaiBadge) return;
    zaiBadge.textContent = txt || (on ? 'اتصال به حساب GLM: فعال ✓' : 'بدون کلید API');
    zaiBadge.classList.toggle('on', !!on);
  }

  function checkZaiToken(attempts = 0) {
    if (!zaiWeb || typeof zaiWeb.executeJavaScript !== 'function') return;
    try {
      zaiWeb.executeJavaScript("localStorage.getItem('token')||''", true).then((t) => {
        if (t) {
          zaiToken = String(t);
          setZaiBadge(true);
        } else {
          zaiToken = '';
          setZaiBadge(false, attempts < 4 ? 'برای اتصال، وارد حسابت شو' : 'بدون کلید API');
          if (attempts < 4) setTimeout(() => checkZaiToken(attempts + 1), 2500);
        }
      }).catch(() => { /* noop */ });
    } catch (_) { /* noop */ }
  }
  if (zaiWeb) {
    zaiWeb.addEventListener('dom-ready', () => setTimeout(() => checkZaiToken(), 1400));
    zaiWeb.addEventListener('did-stop-loading', () => setTimeout(() => checkZaiToken(), 800));
  }

  /* --- ارسال پیام: اول نشست z.ai، بعد کلید GLM --- */
  async function aiAsk(text) {
    const msgs = [{ role: 'system', content: AI_SYSTEM }, ...chatHist.slice(-8), { role: 'user', content: text }];
    if (zaiToken && bridge && bridge.ai && bridge.ai.zaiChat) {
      const r = await bridge.ai.zaiChat({ token: zaiToken, messages: msgs });
      if (r && r.ok) return r;
      if (r && r.needLogin) { zaiToken = ''; setZaiBadge(false, 'نشست منقضی شد — دوباره وارد شو'); }
      if (r && !settings.glmKey) return r; // خطای z.ai را نشان بده
    }
    if (settings.glmKey && bridge && bridge.ai && bridge.ai.chat) {
      return bridge.ai.chat({ base: settings.glmBase, key: settings.glmKey, model: settings.glmModel, messages: msgs });
    }
    if (!bridge || !bridge.ai) return { ok: false, error: 'چت با هوش مصنوعی فقط داخل نرم‌افزار ویندوزی کار می‌کند' };
    return { ok: false, needLogin: true, error: 'برای چت بدون کلید، اول در تب «صفحه چت GLM» وارد حسابت شو' };
  }

  async function handleChatSend(v) {
    addMsg('user', v);
    chatHist.push({ role: 'user', content: v });
    const typing = addMsg('bot', 'دارم فکر می‌کنم…');
    typing.classList.add('typing');
    chatBusy = true;
    try {
      const r = await aiAsk(v);
      typing.remove();
      if (!r || !r.ok) {
        addMsg('err', (r && r.error) || 'پاسخی نرسید.');
      } else {
        const { reply, add } = parseAdd(r.text);
        chatHist.push({ role: 'assistant', content: r.text });
        const msgEl = addMsg('bot', reply || '…');
        speak(reply);
        if (add) renderCmdCard(msgEl, add);
      }
    } catch (_) {
      typing.remove();
      addMsg('err', 'اتصال به سرور هوش مصنوعی برقرار نشد.');
    }
    chatBusy = false;
    chatInput.focus();
  }

  chatBar.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = chatInput.value.trim();
    if (!v || chatBusy) return;
    if (!bridge || !bridge.ai) {
      addMsg('err', 'چت با هوش مصنوعی فقط داخل نرم‌افزار ویندوزی کار می‌کند (درخواست باید از پروسه اصلی برود).');
      return;
    }
    chatInput.value = '';
    handleChatSend(v);
  });

  function renderCmdCard(msgEl, cc) {
    const card = document.createElement('div');
    card.className = 'cmd-card';
    card.innerHTML =
      `<b><svg class="ic"><use href="#i-plus"/></svg><span></span></b>` +
      `<code></code>` +
      `<div class="cmd-actions">` +
      `<button class="chip sm upd-install"><svg class="ic"><use href="#i-plus"/></svg><span>افزودن به فرمان‌ها</span></button>` +
      `<button class="chip sm"><svg class="ic"><use href="#i-close"/></svg><span>بی‌خیال</span></button>` +
      `</div>`;
    card.querySelector('b span').textContent = cc.title || 'فرمان جدید';
    const codeEl = card.querySelector('code');
    const act = cc.action || {};
    codeEl.textContent = (act.type === 'ps' ? 'PowerShell: ' : act.type === 'open_url' ? 'URL: ' : 'Command: ') + (act.value || '');
    const [btnAdd, btnSkip] = card.querySelectorAll('button');
    btnAdd.addEventListener('click', () => {
      cc.id = Date.now();
      customCmds.push(cc);
      store.set('customCmds', customCmds);
      renderCustomChips();
      card.querySelector('.cmd-actions').remove();
      const done = document.createElement('p');
      done.style.cssText = 'margin:8px 0 0;font-size:11.5px;color:#6ee7b7';
      done.textContent = 'افزوده شد ✓ حالا با صدا یا کادر فرمان قابل اجراست.';
      card.appendChild(done);
      toast(`فرمان «${cc.title}» به لیست اضافه شد`, '#i-plus');
    });
    btnSkip.addEventListener('click', () => { card.remove(); });
    msgEl.appendChild(card);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
  }

  /* ---------- مسیریابی سوالات پیچیده به هوش مصنوعی ----------
     اگر متن، فرمان شناخته‌شده نبود و اتصال AI برقرار بود،
     آوا خودش از GLM می‌پرسد، جواب را می‌گوید و فرمان جدید پیشنهادی را با تأیید اضافه می‌کند. */
  async function aiHandleCommand(cmd) {
    setState('processing');
    statusText.textContent = 'سوالت را از هوش مصنوعی می‌پرسم…';
    body.classList.add('has-card');
    rcHeard.textContent = `«${cmd}»`;
    respCard.classList.remove('show');
    void respCard.offsetWidth;
    respCard.classList.add('show');
    rcReply.textContent = '';
    rcTag.textContent = 'هوش مصنوعی';
    try {
      const r = await aiAsk(cmd);
      if (r && r.ok) {
        const { reply, add } = parseAdd(r.text);
        chatHist.push({ role: 'user', content: cmd }, { role: 'assistant', content: r.text });
        setState('success');
        statusText.textContent = 'جواب آمد';
        rcTag.textContent = add ? 'هوش مصنوعی + فرمان جدید' : 'هوش مصنوعی';
        typeText(rcReply, reply || '…');
        speak(reply);
        if (add) {
          const okGo = await askConfirm({
            title: 'فرمان جدید پیشنهاد شد',
            text: `هوش مصنوعی برای درخواستت این فرمان را ساخت: «${add.title}». به فرمان‌ها اضافه شود؟`,
            code: (add.action.type === 'ps' ? 'PowerShell: ' : add.action.type === 'open_url' ? 'URL: ' : 'Command: ') + add.action.value,
          });
          if (okGo) {
            add.id = Date.now();
            customCmds.push(add);
            store.set('customCmds', customCmds);
            renderCustomChips();
            toast(`فرمان «${add.title}» اضافه شد`, '#i-plus');
          }
        }
      } else {
        setState('success');
        statusText.textContent = r && r.needLogin ? 'اتصال AI برقرار نیست' : 'پاسخی نرسید';
        rcTag.textContent = 'هوش مصنوعی';
        typeText(rcReply, (r && r.error) || 'پاسخی نرسید. از صفحه «چت با هوش مصنوعی» امتحان کن.');
        pushHistory(cmd, false);
      }
    } catch (_) {
      setState('success');
      rcTag.textContent = 'هوش مصنوعی';
      typeText(rcReply, 'اتصال به هوش مصنوعی برقرار نشد.');
      pushHistory(cmd, false);
    }
    handsFreeRearm();
    cmdBusy = false;
    setTimeout(() => {
      if (state === 'success') {
        setState('idle');
        statusText.innerHTML = IDLE_HINT;
      }
    }, 3000);
  }

  /* ---------- پاپ‌آپ درباره ---------- */
  btnAbout.addEventListener('click', (e) => {
    e.stopPropagation();
    about.hidden = !about.hidden;
  });
  document.addEventListener('click', (e) => {
    if (!about.hidden && !about.contains(e.target) && !btnAbout.contains(e.target)) about.hidden = true;
  });

  /* ---------- آمار سیستم (واقعی در Electron / شبیه‌سازی در مرورگر) ---------- */
  let simCpu = 12, simRam = 46;
  async function tickStats() {
    if (bridge && bridge.system) {
      try {
        const s = await bridge.system.stats();
        lastCpu = s.cpu; lastRam = s.ram;
      } catch (_) { /* noop */ }
    } else {
      simCpu = Math.max(3, Math.min(92, simCpu + (Math.random() * 10 - 5)));
      simRam = Math.max(28, Math.min(88, simRam + (Math.random() * 4 - 2)));
      lastCpu = Math.round(simCpu);
      lastRam = Math.round(simRam);
    }
    sbCpu.textContent = `CPU ${faNum(lastCpu)}٪`;
    sbRam.textContent = `RAM ${faNum(lastRam)}٪`;
  }
  tickStats();
  setInterval(tickStats, 2000);

  /* ---------- شروع ---------- */
  setState('idle');
  statusText.innerHTML = IDLE_HINT;
  refreshEngineUI();
  renderCustomChips();
  updateHandsFreeUI();
  /* میکروفون از همین لحظه فعال می‌ماند تا اکولایزر به صدای واقعی واکنش نشان دهد */
  setTimeout(() => { attachMic(); }, 1200);
  /* پیش‌بارگذاری موتور آفلاین — تا اولین فرمان فوری جواب بدهد */
  if (bridge && window.Worker) setTimeout(() => asrEnsure(), 2000);
  setTimeout(() => {
    toast(canRun ? 'آوا آماده است — اجرای واقعی فرمان‌ها فعال است' : 'آوا آماده است — پیش‌نمایش رابط کاربری', '#i-wave');
  }, 900);
})();
