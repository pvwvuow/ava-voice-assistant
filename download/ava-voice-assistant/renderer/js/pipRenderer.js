'use strict';
/* ============================================================
   آوا — pipRenderer (v0.37) — منطقِ داخل پنجرهٔ ویدیوی شناور
   ------------------------------------------------------------
   • دریافت منبع ویدیو از پروسهٔ اصلی:
       {kind:'youtube', videoId, start}  → iframe امبد یوتیوب
       {kind:'src', url, volume, rate, time, muted} → <video> مستقیم
       {kind:'blob'} → انتقال مستقیم ممکن نیست (blob/MediaSource قابل
         ریپلیکیشن به پنجرهٔ دیگر نیست) → پیام صادقانه + راهنما
       {kind:'none'} → حالت خالی با راهنمای صوتی
   • click-through هوشمند: وقتی قفلِ کلیک فعال است، همه‌جا از ماوس
     عبور می‌کند به‌جز نوار کنترل (hover روی نوار → کلیک‌پذیر موقت)
   • درگ دستی: mousedown روی grip → پروسهٔ اصلی با مختصات واقعی ماوس
     پنجره را جابجا می‌کند (پنجره focusable:false است)
   • همگام‌سازی با ویدیوی اصلی محدود است (مخصوصاً یوتیوب — embed
     اجازهٔ sync کامل نمی‌دهد؛ از ?start= برای زمان شروع استفاده کردیم)
   ============================================================ */
(function () {
  const root = document.getElementById('root');
  const mediaWrap = document.getElementById('mediaWrap');
  const vid = document.getElementById('vid');
  const ytWrap = document.getElementById('ytWrap');
  const yt = document.getElementById('yt');
  const empty = document.getElementById('empty');
  const btnClose = document.getElementById('btnClose');
  const btnLock = document.getElementById('btnLock');
  const btnOpacity = document.getElementById('btnOpacity');
  const btnSize = document.getElementById('btnSize');
  const grip = document.getElementById('grip');
  /* v0.38 — کنترل پلیر + جستجوی سریع */
  const btnPlay = document.getElementById('btnPlay');
  const btnMute = document.getElementById('btnMute');
  const pipSearch = document.getElementById('pipSearch');
  /* v0.51 — پلیر v2: نوار زمان واقعی + ±۱۰ ثانیه + فالبک یوتیوب */
  const seekrow = document.getElementById('seekrow');
  const seek = document.getElementById('seek');
  const tCur = document.getElementById('tCur');
  const tDur = document.getElementById('tDur');
  const btnBack = document.getElementById('btnBack');
  const btnFwd = document.getElementById('btnFwd');
  const ytFallback = document.getElementById('ytFallback');

  let uiTimer = null;
  let dragging = false;
  let isPaused = false;
  let isMuted = false;
  /* v0.51 — وضعیت پلیر یوتیوب در webview */
  let ytActive = false;      /* آیا webview یوتیوب منبع دارد */
  let ytCurId = '';          /* videoId فعلی برای فالبک */
  let ytPoll = null;         /* تایمر نظرسنجی وضعیت ویدیو */
  let ytNoVideoCount = 0;    /* پاس‌های پیاپی بدون <video> */
  let ytSeekDrag = false;    /* کاربر در حال کشیدن نوار زمان است */
  let ytLastState = null;    /* آخرین وضعیت واقعی از داخل webview */

  function showUI() {
    root.classList.add('show-ui');
    if (uiTimer) clearTimeout(uiTimer);
    uiTimer = setTimeout(() => root.classList.remove('show-ui'), 2600);
  }

  /* ---------- منبع ویدیو + کنترل پلیر ---------- */
  /* v0.51 — پلیر v2 (رفع ارور ۱۵۳ + کنترل حرفه‌ای) ----------
     iframe + enablejsapi یوتیوبِ جدید را رد می‌کرد (Video player
     configuration error / Error 153) و هیچ‌چیز پخش نمی‌شد.
     حالا webview با embedِ ساده (بدون jsapi) → پخش قطعاً بالا می‌آید؛
     کنترل (پلی/پاز/سیک/زمان/صدا) با executeJavaScript داخل همان
     webview روی عنصر <video> واقعی اجرا می‌شود — بدون هیچ API گوگل. */
  function ytEval(expr) {
    try { return yt.executeJavaScript(expr, false); } catch (_) { return Promise.resolve(null); }
  }
  function ytVideoState() {
    return ytEval('(function(){var v=document.querySelector("video");if(!v)return "no";' +
      'try{return {t:v.currentTime||0,d:v.duration||0,p:!!v.paused,m:!!v.muted,vol:(v.volume==null?1:v.volume)}}catch(e){return "no"}})()');
  }
  function ytPlayPause(play) {
    return ytEval('(function(){var v=document.querySelector("video");if(!v)return "no";try{' +
      (play ? 'v.play();' : 'v.pause();') + 'return "ok"}catch(e){return "err"}})()');
  }
  function ytSetMuted(m) {
    return ytEval('(function(){var v=document.querySelector("video");if(!v)return "no";try{v.muted=' + (m ? 'true' : 'false') + ';return "ok"}catch(e){return "err"}})()');
  }
  function ytSeekTo(t) {
    return ytEval('(function(){var v=document.querySelector("video");if(!v)return "no";try{v.currentTime=' + Number(t) + ';return "ok"}catch(e){return "err"}})()');
  }
  function ytSeekBy(delta) {
    return ytEval('(function(){var v=document.querySelector("video");if(!v)return "no";try{v.currentTime=Math.max(0,Math.min((v.duration||0),(v.currentTime||0)+' + Number(delta) + '));return "ok"}catch(e){return "err"}})()');
  }
  /* v0.38.1 — همگام‌سازی آیکون‌ها با وضعیت واقعی پلیر: قبلاً isPaused/isMuted
     کورکورانه flip می‌شدند و بعد از یک ویدیوی جدید اولین فشار دکمه مرده به‌نظر می‌رسید */
  function setPlayIcon(paused) {
    isPaused = !!paused;
    btnPlay.textContent = isPaused ? '▶' : '⏸';
    btnPlay.title = isPaused ? 'پخش' : 'توقف';
  }
  function setMuteIcon(muted) {
    isMuted = !!muted;
    btnMute.textContent = isMuted ? '🔇' : '🔊';
    btnMute.title = isMuted ? 'بازگرداندن صدا' : 'قطع صدا';
  }
  function ytPause() { try { vid.pause(); } catch (_) { /* noop */ } if (ytActive) ytPlayPause(false); }
  function togglePlay() {
    const wantPause = !isPaused;
    setPlayIcon(wantPause);
    if (ytActive) ytPlayPause(!wantPause);
    else { try { wantPause ? vid.pause() : vid.play().catch(() => {}); } catch (_) { /* noop */ } }
  }
  function toggleMute() {
    const wantMute = !isMuted;
    setMuteIcon(wantMute);
    if (ytActive) ytSetMuted(wantMute);
    else { try { vid.muted = wantMute; } catch (_) { /* noop */ } }
  }
  /* v0.51 — نظرسنجی وضعیت واقعی ویدیو در webview: آیکون‌ها + نوار زمان */
  function fmtTime(x) {
    const t = Math.max(0, Math.floor(Number(x) || 0));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s2 = t % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s2).padStart(2, '0');
  }
  function seekUiShow(on) { if (seekrow) seekrow.classList.toggle('hidden', !on); }
  function ytStartPoll() {
    ytStopPoll();
    ytNoVideoCount = 0;
    if (ytFallback) ytFallback.classList.remove('show');
    seekUiShow(true);
    ytPoll = setInterval(async () => {
      if (!ytActive) return ytStopPoll();
      let st = null;
      try { st = await ytVideoState(); } catch (_) { st = null; }
      if (!st || st === 'no') {
        ytNoVideoCount += 1;
        /* ~۶ ثانیه بدون <video> → embed بالا نیامده؛ فالبک صادقانه */
        if (ytNoVideoCount === 14 && ytFallback && ytCurId) ytFallback.classList.add('show');
        return;
      }
      ytNoVideoCount = 0;
      if (ytFallback) ytFallback.classList.remove('show');
      ytLastState = st;
      setPlayIcon(!!st.p);
      setMuteIcon(!!st.m);
      if (!ytSeekDrag && seek) {
        const d = Number(st.d) || 0, t = Number(st.t) || 0;
        if (d > 0) {
          seek.max = String(d);
          seek.value = String(Math.min(t, d));
          const pct = (t / d) * 100;
          try { seek.style.setProperty('--p', pct.toFixed(2) + '%'); } catch (_) { /* noop */ }
        }
      }
      if (tCur) tCur.textContent = fmtTime(st.t);
      if (tDur) tDur.textContent = fmtTime(st.d);
    }, 450);
  }
  function ytStopPoll() { if (ytPoll) { clearInterval(ytPoll); ytPoll = null; } }
  /* رویدادهای واقعی <video> */
  try {
    vid.addEventListener('play', () => setPlayIcon(false));
    vid.addEventListener('pause', () => setPlayIcon(true));
    vid.addEventListener('volumechange', () => setMuteIcon(!!vid.muted));
    /* v0.51 — ویدیوی مستقیم هم نوار زمان واقعی دارد (پلیر یکپارچه) */
    vid.addEventListener('timeupdate', () => {
      if (ytActive || ytSeekDrag || !vid.duration) return;
      seek.max = String(vid.duration);
      seek.value = String(vid.currentTime || 0);
      try { seek.style.setProperty('--p', ((vid.currentTime / vid.duration) * 100).toFixed(2) + '%'); } catch (_) { /* noop */ }
      if (tCur) tCur.textContent = fmtTime(vid.currentTime);
      if (tDur) tDur.textContent = fmtTime(vid.duration);
    });
  } catch (_) { /* noop */ }
  /* v0.51 — کنترل‌های ترنسپورت: سیک + نوار زمان (یوتیوب از webview، مستقیم از <video>) */
  try {
    if (btnBack) btnBack.addEventListener('click', () => { showUI(); if (ytActive) ytSeekBy(-10); else { try { vid.currentTime = Math.max(0, (vid.currentTime || 0) - 10); } catch (_) {} } });
    if (btnFwd) btnFwd.addEventListener('click', () => { showUI(); if (ytActive) ytSeekBy(10); else { try { vid.currentTime = (vid.currentTime || 0) + 10; } catch (_) {} } });
    if (seek) {
      seek.addEventListener('input', () => {
        ytSeekDrag = true;
        try { seek.style.setProperty('--p', ((Number(seek.value) / (Number(seek.max) || 1)) * 100).toFixed(2) + '%'); } catch (_) { /* noop */ }
        if (tCur) tCur.textContent = fmtTime(seek.value);
      });
      seek.addEventListener('change', () => {
        const t = Number(seek.value) || 0;
        if (ytActive) ytSeekTo(t); else { try { vid.currentTime = t; } catch (_) {} }
        ytSeekDrag = false;
        showUI();
      });
    }
    if (ytFallback) ytFallback.addEventListener('click', () => {
      try { window.pipHost.openExternal('https://www.youtube.com/watch?v=' + ytCurId); } catch (_) { /* noop */ }
    });
  } catch (_) { /* noop */ }

  /* ---------- v0.38 — جستجوی سریع داخل PiP ----------
     Enter → به پروسهٔ اصلی: لینک/شناسه = پخش همان‌جا؛ متن = نتایج در مرورگر
     v0.38.1 — فوکوس/بلور به پروسهٔ اصلی خبر داده می‌شود تا پنجره (که
     focusable:false است) فقط هنگام تایپ فوکوس‌پذیر شود و کیبورد از بازی نرود */
  pipSearch.addEventListener('focus', () => { try { window.pipHost.focusInput(); } catch (_) { /* noop */ } });
  pipSearch.addEventListener('blur', () => { try { window.pipHost.blurInput(); } catch (_) { /* noop */ } });
  pipSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && pipSearch.value.trim()) {
      const q = pipSearch.value.trim();
      try { window.pipHost.search(q); } catch (_) { /* noop */ }
      pipSearch.value = '';
      try { pipSearch.blur(); } catch (_) { /* noop */ }
    }
  });

  const emptyDefault = empty.querySelector('p').textContent; /* v0.38 — متن پیش‌فرض برای بازنشانی */
  function showEmpty(msg) {
    /* v0.38.1 — مخفی کردن صفحه نباید صدا را زنده بگذارد: پخش واقعاً متوقف
       و webview خالی می‌شود (قبلاً ویدیوی پنهان در بازی ادامه می‌داد) */
    try { vid.pause(); } catch (_) { /* noop */ }
    ytActive = false;
    ytCurId = '';
    ytStopPoll();
    seekUiShow(false);
    try { if (yt.getAttribute('src') && yt.getAttribute('src') !== 'about:blank') { yt.src = 'about:blank'; } } catch (_) { /* noop */ }
    if (ytFallback) ytFallback.classList.remove('show');
    mediaWrap.classList.add('hidden');
    empty.classList.remove('hidden');
    empty.querySelector('p').textContent = msg || emptyDefault; /* پیام قبلی نماند */
  }

  function loadSource(src) {
    try {
      /* v0.38.1 — وضعیت دکمه‌ها با هر منبع جدید ریست شود تا با پلیر واقعی همگام بماند */
      setPlayIcon(false);
      setMuteIcon(false);
      if (!src || src.kind === 'none') { showEmpty(); return; }
      if (src.kind === 'youtube' && src.videoId) {
        /* v0.51 — پلیر v2: webview + embed ساده بدون enablejsapi.
           ارور ۱۵۳ (Video player configuration error) ریشه‌اش enablejsapi
           بدون origin معتبر بود — دیگر وجود ندارد. کنترل با executeJavaScript */
        const s = Math.max(0, Math.floor(src.start || 0));
        ytWrap.style.display = 'block';
        vid.removeAttribute('src');
        vid.load();
        ytActive = true;
        ytCurId = String(src.videoId);
        seekUiShow(true);
        yt.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(src.videoId) +
          '?autoplay=1&playsinline=1&rel=0&modestbranding=1' + (s ? '&start=' + s : '');
        empty.classList.add('hidden');
        mediaWrap.classList.remove('hidden');
        ytStartPoll();
        return;
      }
      if (src.kind === 'src' && src.url && /^https?:/i.test(src.url)) {
        ytWrap.style.display = 'none';
        ytActive = false;
        ytCurId = '';
        ytStopPoll();
        seekUiShow(true);
        yt.src = 'about:blank';
        vid.src = src.url;
        if (typeof src.volume === 'number') { try { vid.volume = Math.max(0, Math.min(1, src.volume)); } catch (_) {} }
        if (typeof src.rate === 'number') { try { vid.playbackRate = src.rate; } catch (_) {} }
        if (typeof src.muted === 'boolean') { try { vid.muted = src.muted; } catch (_) {} }
        const t0 = Math.max(0, Number(src.time) || 0);
        const onMeta = () => {
          try { if (t0 > 0 && t0 < (vid.duration || Infinity)) vid.currentTime = t0; } catch (_) {}
          vid.play().catch(() => { /* autoplay با صدا ممکن است بلاک شود */ });
        };
        if (vid.readyState >= 1) onMeta(); else vid.addEventListener('loadedmetadata', onMeta, { once: true });
        empty.classList.add('hidden');
        mediaWrap.classList.remove('hidden');
        return;
      }
      if (src.kind === 'note') {
        /* v0.38 — پیام راهنما (مثلاً بعد از جستجوی متنی که نتایجش به مرورگر رفت) */
        showEmpty(src.message || '');
        return;
      }
      if (src.kind === 'blob') {
        /* محدودیت واقعی: src از نوع blob/MediaSource در پنجرهٔ دیگر قابل پخش نیست */
        showEmpty('این ویدیو داخل صفحه با blob/MediaSource پخش می‌شود و انتقال مستقیم ممکن نیست. لینک یوتیوب را کپی کن و بگو «ویدیو رو پین کن».');
        return;
      }
      showEmpty();
    } catch (e) {
      showEmpty();
    }
  }

  /* ---------- وضعیت (شفافیت/قفل/اندازه از صدا یا میانبر تغییر کرد) ---------- */
  function applyState(st) {
    if (!st) return;
    if (typeof st.clickThrough === 'boolean') {
      root.classList.toggle('ct', st.clickThrough);
      btnLock.textContent = st.clickThrough ? '🔒' : '🔓';
      btnLock.classList.toggle('on', st.clickThrough);
      btnLock.title = st.clickThrough
        ? 'کلیک قفل است — بگو «کلیک روش فعال باشه» تا باز شود'
        : 'قفل کلیک — کلیک از روی پنجره رد شود (مناسب بازی)';
    }
    if (typeof st.opacity === 'number') btnOpacity.textContent = '◐ ' + Math.round(st.opacity * 100);
  }

  /* ---------- click-through هوشمند ---------- */
  /* با forward:true حتی وقتی پنجره mouse-ignore است، mousemove به همین صفحه
     می‌رسد؛ پس می‌فهمیم ماوس روی نوار کنترل است و موقتاً کلیک‌پذیری برمی‌گردد */
  document.addEventListener('mousemove', (e) => {
    showUI();
    const overUi = !!(e.target && e.target.closest && e.target.closest('[data-ui]'));
    try { window.pipHost.hoverUi(overUi); } catch (_) { /* noop */ }
  });
  document.addEventListener('mouseleave', () => {
    try { window.pipHost.hoverUi(false); } catch (_) { /* noop */ }
    if (uiTimer) clearTimeout(uiTimer);
    root.classList.remove('show-ui');
  });
  /* v0.38.1 — خروج ماوس از نوار کنترل هم کلیک‌پذیری را پس بدهد: روی iframe
     یوتیوب (OOPIF) mousemove به سند والد نمی‌رسد و قبلاً نوار کلیک‌پذیر می‌ماند */
  const barEl = document.getElementById('bar');
  if (barEl) barEl.addEventListener('mouseleave', () => {
    try { window.pipHost.hoverUi(false); } catch (_) { /* noop */ }
  });

  /* ---------- دکمه‌ها ---------- */
  btnClose.addEventListener('click', () => { try { window.pipHost.close(); } catch (_) {} });
  btnLock.addEventListener('click', () => { try { window.pipHost.ctl('clickthrough'); } catch (_) {} });
  btnOpacity.addEventListener('click', () => { try { window.pipHost.ctl('opacity'); } catch (_) {} });
  btnSize.addEventListener('click', () => { try { window.pipHost.ctl('size'); } catch (_) {} });

  /* ---------- درگ دستی ---------- */
  grip.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    root.classList.add('dragging');
    try { window.pipHost.dragStart(); } catch (_) {}
    e.preventDefault();
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    root.classList.remove('dragging');
    try { window.pipHost.dragEnd(); } catch (_) {}
  });

  /* ---------- پل‌ها ---------- */
  try {
    window.pipHost.onSource(loadSource);
    window.pipHost.onState(applyState);
    /* v0.38.1 — پنجره مخفی شد → صدا بلافاصله بایستد */
    window.pipHost.onPause(() => { try { ytPause(); } catch (_) { /* noop */ } });
    window.pipHost.ready();
  } catch (_) { /* در پیش‌نمایش وب pipHost وجود ندارد */ }

  showEmpty();
  showUI();
})();
