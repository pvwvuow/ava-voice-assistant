/* ============================================================
   آوا — دستیار صوتی ویندوز | منطق رابط کاربری (نسخه دمو)
   - در Electron: از پل window.ava (preload) استفاده می‌کند
   - در مرورگر: همه‌چیز شبیه‌سازی می‌شود
   ============================================================ */
(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const bridge = window.ava || null;

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
  const chips = [...document.querySelectorAll('.chip')];
  const respCard = $('#respCard');
  const rcHeard = $('#rcHeard');
  const rcReply = $('#rcReply');
  const cmdBar = $('#cmdBar');
  const cmdInput = $('#cmdInput');
  const sbMic = $('#sbMic');
  const sbCpu = $('#sbCpu');
  const sbRam = $('#sbRam');
  const sbClock = $('#sbClock');
  const toasts = $('#toasts');
  const about = $('#about');
  const btnAbout = $('#btnAbout');
  const greetTitle = $('#greetTitle');
  const abRuntime = $('#abRuntime');

  const IDLE_HINT = 'برای شروع، اورب را لمس کن یا کلید <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Space</kbd>';
  const DEFAULT_REPLY = 'این فرمان در نسخه دمو هنوز به موتور اجرا وصل نیست؛ ولی رابط کاربری کاملاً آماده است!';

  /* ---------- ابزار ---------- */
  const faNum = (v) => String(v).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
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
      const env = Math.sin((Math.PI * i) / (N - 1)); // پوش مرکز-برجسته
      const n =
        Math.sin(t0 * 2.1 + i * 0.55) * 0.5 +
        Math.sin(t0 * 3.7 + i * 1.3) * 0.3 +
        Math.sin(t0 * 0.7 + i * 0.21) * 0.2;
      const amp = energy * env * (0.32 + 0.68 * Math.abs(n));
      const jitter = energy > 0.2 ? Math.random() * 0.13 * energy : 0;
      const lvl = Math.max(0.04, Math.min(1, amp + jitter));
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

  /* ---------- قوانین پاسخ دمو ---------- */
  const RULES = [
    { k: /کروم|مرورگر/, t: 'برنامه باز شد (دمو)', i: '#i-globe', r: () => 'مرورگر کروم باز شد. خوش بگذره!' },
    {
      k: /صدا|بلندی|ولوم/,
      t: 'صدا تنظیم شد (دمو)', i: '#i-volume',
      r: (c) => {
        const m = c.match(/\d+/);
        return `بلندی صدا روی ${faNum(m ? Math.min(100, +m[0]) : 50)}٪ تنظیم شد.`;
      },
    },
    { k: /اسکرین|عکس.{0,6}(صفحه|بگیر)|screenshot/, t: 'اسکرین‌شات (دمو)', i: '#i-camera', r: () => 'اسکرین‌شات گرفته شد و در پوشه Pictures ذخیره شد.' },
    { k: /وضعیت|سیستم|پردازنده|رم/, t: 'مانیتورینگ (دمو)', i: '#i-pulse', r: () => `پردازنده حدود ${faNum(lastCpu)}٪ و رم حدود ${faNum(lastRam)}٪ درگیر است؛ همه‌چیز خوب کار می‌کند.` },
    { k: /ساعت/, i: '#i-clock', r: () => `الان ساعت ${timeFmt.format(new Date())} است.` },
    { k: /تاریخ|چندمه|امروز/, i: '#i-clock', r: () => `امروز ${dateFmt.format(new Date())} است.` },
    { k: /سلام|درود|خوبی/, i: '#i-wave', r: () => 'سلام! من خوبم، ممنون. چه کاری برات انجام بدم؟' },
    { k: /متشکر|مرسی|ممنون/, i: '#i-wave', r: () => 'خواهش می‌کنم! کار دیگری هست؟' },
  ];

  let lastCpu = 12, lastRam = 46;

  /* ---------- تایپ متن پاسخ ---------- */
  let typeTimer = null;
  function typeText(el, txt) {
    clearInterval(typeTimer);
    el.textContent = '';
    let i = 0;
    typeTimer = setInterval(() => {
      el.textContent = txt.slice(0, ++i);
      if (i >= txt.length) clearInterval(typeTimer);
    }, 18);
  }

  /* ---------- اجرای فرمان (شبیه‌سازی) ---------- */
  function runCommand(cmd) {
    if (state === 'processing') return;
    if (state === 'listening') stopListening(false);

    setState('processing');
    statusText.textContent = 'در حال انجام…';
    body.classList.add('has-card'); // موج جمع می‌شود تا کارت پاسخ جا باز کند
    rcHeard.textContent = `«${cmd}»`;
    respCard.classList.remove('show');
    void respCard.offsetWidth;
    respCard.classList.add('show');
    rcReply.textContent = '';

    const rule = RULES.find((r) => r.k.test(cmd));
    const reply = rule ? rule.r(cmd) : DEFAULT_REPLY;

    setTimeout(() => {
      setState('success');
      statusText.textContent = 'انجام شد';
      typeText(rcReply, reply);
      if (rule && rule.t) toast(rule.t, rule.i || '#i-info');
      setTimeout(() => {
        if (state === 'success') {
          setState('idle');
          statusText.innerHTML = IDLE_HINT;
        }
      }, 2400);
    }, 900 + Math.random() * 500);
  }

  /* ---------- گوش دادن ---------- */
  let listenTimer = null;
  function startListening() {
    if (state === 'processing') return;
    clearTimeout(listenTimer);
    setState('listening');
    body.classList.remove('has-card'); // کارت جمع می‌شود و ویژوالایزر برمی‌گردد
    respCard.classList.remove('show');
    orbIcon.setAttribute('href', '#i-stop');
    statusText.textContent = 'در حال گوش دادن… (مثلاً بگو «کروم را باز کن»)';
    sbMic.innerHTML = '<i class="dot rec"></i>میکروفون: در حال ضبط';
    // دمو: بعد از چند ثانیه یک فرمان فرضی «شنیده می‌شود»
    listenTimer = setTimeout(() => {
      const demo = chips[Math.floor(Math.random() * chips.length)].dataset.cmd;
      stopListening(false);
      runCommand(demo);
    }, 4200);
  }
  function stopListening(reset = true) {
    clearTimeout(listenTimer);
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
      else if (state === 'listening') stopListening();
    }
  });
  if (bridge && bridge.voice) bridge.voice.onToggleListen(toggleListen);

  /* ---------- آیتم‌های قفل‌شده سایدبار ---------- */
  document.querySelectorAll('.rail-item.locked').forEach((b) =>
    b.addEventListener('click', () => toast('این بخش در نسخه بعدی اضافه می‌شود', '#i-info'))
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
  setTimeout(() => toast('آوا آماده است — این یک دموی رابط کاربری است', '#i-wave'), 900);
})();
