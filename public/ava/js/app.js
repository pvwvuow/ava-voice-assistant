/* ============================================================
   آوا — دستیار صوتی ویندوز | منطق رابط کاربری (نسخه ۰.۴)
   - تشخیص گفتار واقعی (Web Speech API) با فالبک به حالت دمو
   - پاسخ گفتاری واقعی (TTS) + ویژوالایزر با صدای واقعی میکروفون
   - ضبط واقعی صدا و ذخیره در Music/AVA (از طریق پل امن)
   - صفحه تنظیمات: همیشه‌روون، اجرای خودکار با ویندوز، آپدیت خودکار
   - اجرای واقعی فرمان‌های ویندوز از طریق پل امن sys:run
   - در مرورگر (پیش‌نمایش): شبیه‌سازی کامل
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
  const DEFAULT_REPLY = 'این فرمان را هنوز یاد نگرفتم؛ ولی مثلاً می‌تونی بگی «کروم را باز کن»، «تایمر ۱۰ دقیقه‌ای بذار»، «جستجوی آب و هوا» یا «یک جوک بگو».';

  /* ---------- تنظیمات (localStorage) ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ava.' + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem('ava.' + k, JSON.stringify(v)); } catch (_) { /* noop */ } },
  };
  const settings = {
    tts: store.get('tts', true),
    voiceURI: store.get('voiceURI', ''),
    autoUpdate: store.get('autoUpdate', true),
  };

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

  /* ---------- میکروفون واقعی: تحلیل طیف برای ویژوالایزر + ضبط فایل ---------- */
  let micStream = null, audioCtx = null, analyser = null, micData = null, micLive = false;
  let mediaRec = null, recChunks = [], isRecording = false;

  async function attachMic() {
    if (analyser) return true;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      audioCtx = new AC();
      const src = audioCtx.createMediaStreamSource(micStream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;
      src.connect(analyser);
      micData = new Uint8Array(analyser.frequencyBinCount);
      return true;
    } catch (_) {
      return false;
    }
  }

  function detachMic() {
    if (isRecording) return; /* حین ضبط، استریم نباید بسته شود */
    if (micStream) { micStream.getTracks().forEach((t) => t.stop()); micStream = null; }
    if (audioCtx) { try { audioCtx.close(); } catch (_) { /* noop */ } audioCtx = null; }
    analyser = null; micData = null; micLive = false;
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
    if (state !== 'listening') { micLive = false; detachMic(); }
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
      if (micLive && micData) {
        /* صدای واقعی میکروفون: تبدیل طیف فرکانسی به ۵۲ میله */
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
      k: /آب[\s\u200C]?و[\s\u200C]?هوا|هوا\s?چطور|درجه[\s\u200C]?هوا|weather/i, t: 'جستجوی آب‌وهوا', i: '#i-search',
      run: 'web_search', arg: () => 'آب و هوای امروز',
      r: () => 'آب‌وهوای امروز را در گوگل جستجو کردم.',
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
      k: /صدا|بلندی|ولوم/, t: 'تنظیم صدا', i: '#i-volume',
      r: (c) => {
        const m = faToEn(c).match(/\d+/);
        return `بلندی صدا روی ${faNum(m ? Math.min(100, +m[0]) : 50)}٪ تنظیم شد (تنظیم دقیق درصد در نسخه بعدی).`;
      },
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
  ];

  let lastCpu = 12, lastRam = 46;

  /* ---------- تایمر واقعی ---------- */
  let timerId = null;
  function beep() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ac = new AC();
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
      speak('زمان تایر تمام شد؛ خبرت کردم!');
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
    if (!rule.run) { rcTag.textContent = 'پاسخ آوا'; return reply; }
    if (!canRun) { rcTag.textContent = 'شبیه‌سازی دمو'; return reply; }
    const runId = typeof rule.run === 'function' ? rule.run(cmd) : rule.run;
    const arg = rule.arg ? rule.arg(cmd) : undefined;
    try {
      const res = await bridge.system.run(runId, arg);
      if (res && res.ok) {
        rcTag.textContent = 'اجرا شد';
        if (runId === 'screenshot' && res.out) reply = `اسکرین‌شات ذخیره شد در: ${res.out}`;
      } else {
        rcTag.textContent = 'شبیه‌سازی دمو';
        reply += ' (اجرای واقعی فقط داخل نرم‌افزار ویندوزی انجام می‌شود.)';
      }
    } catch (_) {
      rcTag.textContent = 'شبیه‌سازی دمو';
    }
    return reply;
  }

  async function runCommand(cmd) {
    if (!cmd) return;
    if (state === 'processing') return;
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

    const rule = RULES.find((r) => r.k.test(cmd));
    const reply = rule ? await resolveReply(rule, cmd) : DEFAULT_REPLY;
    if (!rule) rcTag.textContent = 'پاسخ آوا';

    setTimeout(() => {
      setState('success');
      statusText.textContent = 'انجام شد';
      typeText(rcReply, reply);
      speak(reply);
      if (rule && rule.t) toast(rule.t, rule.i || '#i-info');
      setTimeout(() => {
        if (state === 'success') {
          setState('idle');
          statusText.innerHTML = IDLE_HINT;
        }
      }, 2400);
    }, 500 + Math.random() * 300);
  }

  /* ---------- تشخیص گفتار واقعی ---------- */
  let rec = null, recActive = false, gotFinal = false, srBroken = false, demoNoticeShown = false;

  function updateEngine() {
    if (SRC && !srBroken) sbEngine.innerHTML = '<i class="dot ok"></i>موتور: تشخیص گفتار فعال';
    else sbEngine.innerHTML = '<i class="dot warn"></i>موتور: شبیه‌سازی دمو';
  }
  updateEngine();

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
      if (['network', 'not-allowed', 'service-not-allowed', 'audio-capture'].includes(e.error)) {
        srBroken = true;
        updateEngine();
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

  /* ---------- گوش دادن ---------- */
  let listenTimer = null;
  function startListening() {
    if (state === 'processing') return;
    clearTimeout(listenTimer);
    setState('listening');
    body.classList.remove('has-card');
    respCard.classList.remove('show');
    orbIcon.setAttribute('href', '#i-stop');
    sbMic.innerHTML = '<i class="dot rec"></i>میکروفون: در حال ضبط';
    gotFinal = false;
    attachMic().then((ok) => { if (ok && (state === 'listening' || isRecording)) micLive = true; });

    if (SRC && !srBroken) {
      try {
        rec = makeRec();
        statusText.textContent = 'در حال گوش دادن… فرمانت را بگو';
        recActive = true;
        rec.start();
        return;
      } catch (_) { /* ادامه به حالت دمو */ }
    }
    startDemoListen();
  }

  function startDemoListen() {
    statusText.textContent = 'حالت دمو: در حال شنیدن…';
    if (!demoNoticeShown) {
      demoNoticeShown = true;
      toast('تشخیص گفتار اینجا در دسترس نیست؛ حالت دمو فعال شد', '#i-info');
    }
    listenTimer = setTimeout(() => {
      const demo = chips[Math.floor(Math.random() * chips.length)].dataset.cmd;
      stopListening(false);
      runCommand(demo);
    }, 4200);
  }

  function stopListening(reset = true) {
    clearTimeout(listenTimer);
    if (rec && recActive) { try { rec.stop(); } catch (_) { /* noop */ } }
    recActive = false;
    micLive = false;
    if (!isRecording) detachMic();
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
      if (!about.hidden) about.hidden = true;
      else if (!settingsPage.hidden) showSettings(false);
      else if (state === 'listening') stopListening();
    }
  });
  if (bridge && bridge.voice) bridge.voice.onToggleListen(toggleListen);

  /* ---------- آیتم‌های قفل‌شده سایدبار ---------- */
  document.querySelectorAll('.rail-item.locked').forEach((b) =>
    b.addEventListener('click', () => toast('این بخش در نسخه بعدی اضافه می‌شود', '#i-info'))
  );

  /* ============================================================
     صفحه تنظیمات
     ============================================================ */
  let appVersion = '0.4.0';

  function showSettings(on) {
    settingsPage.hidden = !on;
    hero.style.display = on ? 'none' : '';
    btnHome.classList.toggle('active', !on);
    btnSettings.classList.toggle('active', on);
    $('#main').scrollTop = 0;
    if (on) refreshSettingsUI();
  }
  btnSettings.addEventListener('click', () => showSettings(settingsPage.hidden));
  btnHome.addEventListener('click', () => showSettings(false));
  btnSettingsBack.addEventListener('click', () => showSettings(false));

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
    fillVoiceSelect();
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
  setTimeout(() => {
    toast(canRun ? 'آوا آماده است — اجرای واقعی فرمان‌ها فعال است' : 'آوا آماده است — پیش‌نمایش رابط کاربری', '#i-wave');
  }, 900);
})();
