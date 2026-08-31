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

  let uiTimer = null;
  let dragging = false;
  let isPaused = false;
  let isMuted = false;

  function showUI() {
    root.classList.add('show-ui');
    if (uiTimer) clearTimeout(uiTimer);
    uiTimer = setTimeout(() => root.classList.remove('show-ui'), 2600);
  }

  /* ---------- منبع ویدیو + کنترل پلیر ---------- */
  /* v0.38 — کنترل پلیر (پخش/توقف و قطع صدا) ----------
     یوتیوب: دستور از طریق postMessage به iframe رسمی می‌رود (enablejsapi=1
     در آدرس امبد فعال شده تا این پیام‌ها پذیرفته شوند). ویدیوی مستقیم:
     مستقیم روی عنصر <video> */
  function ytCommand(func) {
    /* v0.38.1 — origin مقصد مشخص شد (قبلاً wildcard '*') */
    try { yt.contentWindow.postMessage(JSON.stringify({ event: 'command', func }), 'https://www.youtube.com'); } catch (_) { /* noop */ }
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
  function ytPause() { try { ytCommand('pauseVideo'); } catch (_) { /* noop */ } try { vid.pause(); } catch (_) { /* noop */ } }
  function togglePlay() {
    const wantPause = !isPaused;
    setPlayIcon(wantPause);
    if (ytWrap.style.display === 'block') ytCommand(wantPause ? 'pauseVideo' : 'playVideo');
    else { try { wantPause ? vid.pause() : vid.play().catch(() => {}); } catch (_) { /* noop */ } }
  }
  function toggleMute() {
    const wantMute = !isMuted;
    setMuteIcon(wantMute);
    if (ytWrap.style.display === 'block') ytCommand(wantMute ? 'mute' : 'unMute');
    else { try { vid.muted = wantMute; } catch (_) { /* noop */ } }
  }
  /* رویدادهای واقعی <video> */
  try {
    vid.addEventListener('play', () => setPlayIcon(false));
    vid.addEventListener('pause', () => setPlayIcon(true));
    vid.addEventListener('volumechange', () => setMuteIcon(!!vid.muted));
  } catch (_) { /* noop */ }
  /* رویدادهای واقعی پلیر یوتیوب (infoDelivery → playerState: 1=play, 2=pause) */
  try {
    window.addEventListener('message', (e) => {
      try {
        if (!/^https:\/\/(www\.)?youtube(-nocookie)?\.com$/.test(e.origin)) return;
        const d = JSON.parse(e.data);
        const ps = d && ((d.info && d.info.playerState) !== undefined ? d.info.playerState : (d.playerState !== undefined ? d.playerState : undefined));
        if (ps === 1) setPlayIcon(false);
        else if (ps === 2) setPlayIcon(true);
        const muted = d && d.info && d.info.muted;
        if (typeof muted === 'boolean') setMuteIcon(muted);
      } catch (_) { /* پیام غیر-JSON یوتیوب — نادیده */ }
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
       و iframe خالی می‌شود (قبلاً ویدیوی پنهان در بازی ادامه می‌داد) */
    try { vid.pause(); } catch (_) { /* noop */ }
    try { if (yt.getAttribute('src')) { yt.src = 'about:blank'; } } catch (_) { /* noop */ }
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
        /* امبد رسمی یوتیوب — sync کامل با پخش‌کنندهٔ اصلی محدود است؛
           فقط زمان شروع (?start=) منتقل می‌شود */
        const s = Math.max(0, Math.floor(src.start || 0));
        ytWrap.style.display = 'block';
        vid.removeAttribute('src');
        vid.load();
        yt.src = 'https://www.youtube.com/embed/' + encodeURIComponent(src.videoId) +
          '?autoplay=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1' + (s ? '&start=' + s : '');
        empty.classList.add('hidden');
        mediaWrap.classList.remove('hidden');
        return;
      }
      if (src.kind === 'src' && src.url && /^https?:/i.test(src.url)) {
        ytWrap.style.display = 'none';
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
