/* ============================================================
   lib/ava-player.js (v0.85) — پلیر آوا، بازساختِ کامل به‌صورت ماژولِ مستقل
   ────────────────────────────────────────────────────────────
   ریشهٔ «کار نمی‌کند» (لاگ میدانی + اسکرین‌شات کاربر): embed یوتیوب با
   «Video player configuration error (133/153)» رد می‌شود — ردِ سمتِ یوتیوب
   و سطحِ IP/ربات‌یابی است؛ تزریق Referer/nocookie قطعی‌اش نمی‌کنند.
   معماریِ نو — موتور ۴ طبقه:
     ۱) «مستقیم»: yt-dlp → استریمِ تک‌فایلی mp4/webm → <video> محلی —
        embed در کار نیست؛ خطای ۱۳۳ از اساس ناممکن می‌شود. m3u8/HLS
        (کرومیوم پخش نمی‌کند) رد می‌شود → طبقهٔ بعد.
     ۲) «embed»: رسمی یوتیوب — فقط وقتی استخراجِ مستقیم نشد.
     ۳) «پلیر سیستم»: از خود پلیر (yt-dlp → پت‌پلیر/VLC/…).
     ۴) «مرورگر»: آخرین طبقه، همیشه در دسترس.
   مدیریت پنجره — ریشهٔ تاریخی «باز می‌شود و درجا می‌میرد»:
     • تک‌پنجرهٔ بازاستفاده: پخشِ نو در «همان پنجره» navigate می‌شود
       (aplayer:navigate) — الگوی «بستن-بعد-بازکردن» حذف شده است.
     • هیچ تایمرِ destroy روی مسیرهای عادی وجود ندارد؛ پاک‌سازی فقط در
       رویداد 'closed' انجام می‌شود (بمبِ ساعتیِ v0.83 ساختاراً ناممکن).
     • render-process-gone → ریلود + لاگ؛ پنجره نمی‌میرد.
   pid منفی (apid) — هرگز با PID واقعی ویندوز اشتباه نمی‌شود؛ بستن/فوکوس/
   PIP/شفافیت/مانیتور/شاتِ این پنجره‌ها همه بومی Electron است.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = function createAvaPlayer(D) {
  const {
    BrowserWindow, ipcMain, session, shell, screen, app, clipboard, exec,
    playerCtl, actLog, netErr, cloudFetch,
    closeAllExternalVideoPlayers, playersScan, defaultVideoPlayer, playerLaunch,
    ytDlpFind, resolveYtStream,
  } = D;

  /* ---------- وضعیت ---------- */
  const players = new Map(); /* apid(منفی) → entry */
  let seq = 0;
  let refDone = false; /* تزریق Referer سشن aplayer — یک بار */

  const VPIP = { w: 400, h: 225, margin: 14 };
  const SIZES = { small: [520, 300], medium: [960, 562], large: [1280, 740] };

  const alive = (en) => !!en && !!en.win && !en.win.isDestroyed();
  /* جدیدترینِ زنده — «ترتیب درجِ» Map (قراردادِ لگاسی: آخرین کلید = جدیدترین؛
     apid منفی است، مقایسهٔ عددی غلطِ قدیم‌به‌نو می‌دهد) */
  const newest = () => {
    let found = null;
    for (const [apid, en] of players) { if (alive(en)) { en.apid = apid; found = en; } }
    return found;
  };
  const size = () => { let n = 0; for (const en of players.values()) if (alive(en)) n++; return n; };

  function log(line, extra) {
    try { actLog(line, 'player', extra); } catch (_) { /* noop */ }
  }
  /* هر تماسِ cross-process به رندرر سقفِ زمانی دارد — رندررِ کرش‌کرده/بالتاسرفه
     هرگز نباید زنجیرهٔ فرمانِ صوتی یا اسکرین‌شات را بی‌پاسخ نگه دارد */
  function bounded(p, ms, tag) {
    return Promise.race([
      Promise.resolve(p),
      new Promise((res) => setTimeout(() => res({ ok: false, error: 'زمانِ انتظارِ ' + tag + ' تمام شد' }), ms)),
    ]);
  }

  /* ---------- ytId / عنوان ---------- */
  function ytIdOf(raw) {
    const u = String(raw || '');
    const m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/|\/v\/))([A-Za-z0-9_-]{11})/);
    if (!m) return null;
    let start = 0;
    try {
      const q = new URL(u);
      const t = String(q.searchParams.get('t') || q.searchParams.get('start') || '');
      const hm = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
      if (hm && t) start = (parseInt(hm[1], 10) || 0) * 3600 + (parseInt(hm[2], 10) || 0) * 60 + (parseInt(hm[3], 10) || 0);
      else if (/^\d+$/.test(t)) start = parseInt(t, 10) || 0;
    } catch (_) { /* noop */ }
    return { id: m[1], start };
  }
  async function ytTitleOf(videoId) {
    try {
      const r = await cloudFetch('https://www.youtube.com/oembed?format=json&url=' +
        encodeURIComponent('https://www.youtube.com/watch?v=' + videoId), { signal: AbortSignal.timeout(4000) });
      if (!r.ok) return '';
      const j = await r.json();
      return String((j && j.title) || '').slice(0, 120);
    } catch (_) { return ''; }
  }

  /* ---------- موتور ۱ — استریمِ مستقیم با نردبانِ کیفیت ----------
     همان نردبانِ main.js (22/18/هر mp4/هر webm) + فالبکِ کلاینت ios +
     ردِ m3u8 (کرومیوم HLS نمی‌فهمد) — سقفِ هر پله ۱۰ ثانیه. */
  function ytdlpRun(bin, url, fmt, client) {
    const cli = client ? ' --no-check-certificates --extractor-args "youtube:player_client=' + client + '"' : '';
    const cmd = bin + ' -f "' + fmt + '" -g --no-playlist --no-warnings' + cli + ' "' + url + '"';
    return new Promise((resolve) => {
      exec(cmd, { windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024 }, (err, stdout) => {
        if (err || !stdout) return resolve('');
        const line = String(stdout).split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0] || '';
        resolve(/^https?:\/\//i.test(line) ? line : '');
      });
    });
  }
  async function resolveStream(videoId, quality) {
    const watch = 'https://www.youtube.com/watch?v=' + videoId;
    const fmt = String(quality) === '360'
      ? '18/b[ext=mp4]/b[ext=webm]/b'
      : '22/18/b[ext=mp4]/b[ext=webm]/b';
    const bin = await ytDlpFind();
    if (!bin) return { ok: false, noBin: true };
    let u = await ytdlpRun(bin, watch, fmt);
    if (!u) u = await ytdlpRun(bin, watch, fmt, 'ios');
    if (!u) return { ok: false };
    if (/\.m3u8/i.test(u) || /manifest/i.test(u)) return { ok: false, m3u8: true }; /* HLS → embed */
    return { ok: true, url: u, quality: String(quality) === '360' ? '360' : 'best' };
  }

  /* ---------- تزریق Referer (طبقهٔ embed) — سشن aplayer ---------- */
  function injectRef() {
    if (refDone) return;
    refDone = true;
    try {
      const ses = session.fromPartition('aplayer');
      ses.webRequest.onBeforeSendHeaders(
        { urls: ['*://*.youtube.com/*', '*://*.youtube-nocookie.com/*'] },
        (det, cb) => {
          const h = det.requestHeaders || {};
          h['Referer'] = 'https://www.youtube.com/';
          cb({ requestHeaders: h });
        }
      );
    } catch (_) { /* noop */ }
  }

  /* ---------- پاک‌سازی entry — فقط از رویداد 'closed'، بدون تایمر ---------- */
  function forget(apid) {
    const en = players.get(apid);
    players.delete(apid);
    if (en && playerCtl && playerCtl.activePid === apid) { playerCtl.activePid = 0; playerCtl.activeProc = ''; }
  }
  function isCrashed(en) {
    if (en && en.crashed) return true;
    try { const wc = en && en.win && en.win.webContents; return !!(wc && typeof wc.isCrashed === 'function' && wc.isCrashed()); } catch (_) { return false; }
  }
  function closeEntry(en) {
    try {
      if (!alive(en)) return;
      /* رندررِ کرش‌کرده هرگز پیامِ close را ack نمی‌کند → close() برای همیشه
         معلق می‌ماند و entry زامبی می‌شود؛ نابودیِ فوری (destroy) تنها راه
         درست است — رویداد closed همان‌جا پاک‌سازی می‌کند (بدون تایمر). */
      if (isCrashed(en)) en.win.destroy();
      else en.win.close();
    } catch (_) { /* noop */ }
  }

  /* ---------- ساخت پنجره ---------- */
  function openWindow(payload) {
    injectRef();
    const apid = --seq;
    const win = new BrowserWindow({
      width: SIZES.medium[0], height: SIZES.medium[1], minWidth: 420, minHeight: 260,
      show: false, frame: false, backgroundColor: '#050507',
      title: 'آوا پلیر', autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true, nodeIntegration: false, sandbox: true,
        spellcheck: false, autoplayPolicy: 'no-user-gesture-required',
        preload: path.join(__dirname, '..', 'renderer', 'ava-player-preload.js'),
        partition: 'aplayer',
      },
    });
    win.setMenuBarVisibility(false);
    const en = {
      apid, win, wc: win.webContents.id, videoId: payload.videoId, start: payload.start || 0,
      title: String(payload.title || ''), engine: payload.engine || 'embed', src: payload.src || '',
      quality: payload.quality || '', at: Date.now(), prev: null, resent: false,
    };
    players.set(apid, en);

    win.on('closed', () => forget(apid)); /* تنها نقطهٔ پاک‌سازی — بدون تایمر */
    const sendFs = (v) => { try { if (!win.isDestroyed()) win.webContents.send('aplayer:fs', v); } catch (_) { /* noop */ } };
    win.on('enter-full-screen', () => sendFs(true));
    win.on('leave-full-screen', () => sendFs(false));
    /* کرشِ رندرر = ریلود، نه مرگ — پنجره زنده می‌ماند و payload دوباره می‌رسد.
       گاردِ حلقه: بیش از ۳ کرش در ۱۰ ثانیه = محیطِ خراب؛ ریلود متوقف می‌شود
       (وگرنه حلقهٔ بی‌پایانِ کرش/ریلود منابع را می‌سوزاند). */
    win.webContents.on('render-process-gone', (_e, details) => {
      en.crashed = true;
      const now = Date.now();
      en.crashTimes = (en.crashTimes || []).filter((t) => now - t < 10000);
      en.crashTimes.push(now);
      if (en.crashTimes.length > 3) {
        log('ava-player render-gone x' + en.crashTimes.length + '/10s — reload paused (apid=' + apid + ', reason=' + (details && details.reason) + ')');
        return;
      }
      en.resent = false;
      log('ava-player render-gone (' + (details && details.reason) + ') → reload, apid=' + apid);
      try { if (!win.isDestroyed()) win.webContents.reload(); } catch (_) { /* noop */ }
    });
    win.webContents.on('did-finish-load', () => {
      en.crashed = false; /* رندرر دوباره زنده شد */
      if (en.resent) return;
      en.resent = true;
      try { if (!win.isDestroyed()) win.webContents.send('aplayer:navigate', payloadOf(en)); } catch (_) { /* noop */ }
    });
    win.webContents.setWindowOpenHandler(({ url }) => {
      try { shell.openExternal(url); } catch (_) { /* noop */ }
      return { action: 'deny' };
    });
    en.resent = true; /* بارِ اول با loadFile — navigate دوباره نفرست */
    win.loadFile(path.join(__dirname, '..', 'renderer', 'ava-player.html'), {
      query: payloadQuery(en),
    }).catch(() => { /* noop */ });
    win.once('ready-to-show', () => { try { win.show(); win.focus(); } catch (_) { /* noop */ } });
    return apid;
  }

  function payloadQuery(en) {
    return {
      v: en.videoId,
      t: String(en.title || '').slice(0, 110),
      start: en.start ? String(en.start) : '',
      engine: en.engine || 'embed',
      src: en.src ? String(en.src) : '',
      q: en.quality || '',
    };
  }
  function payloadOf(en) {
    return {
      videoId: en.videoId, start: en.start || 0, title: en.title || '',
      engine: en.engine || 'embed', src: en.src || '', quality: en.quality || '',
    };
  }

  /* ناوبری درجا — همان پنجره، ویدیوی نو (ریشهٔ رفعِ «باز و درجا مرگ») */
  function navigateEntry(en, payload) {
    en.videoId = payload.videoId; en.start = payload.start || 0; en.title = String(payload.title || '');
    en.engine = payload.engine || 'embed'; en.src = payload.src || ''; en.quality = payload.quality || '';
    en.prev = null; en.at = Date.now();
    try {
      if (!alive(en)) return false;
      if (en.win.isMinimized()) en.win.restore();
      /* اگر در PIP بود، اول به حالت عادی برگرد — ویدیوی نو، پنجرهٔ عادی */
      if (en.win.isAlwaysOnTop()) {
        en.win.setAlwaysOnTop(false);
        const wa = screen.getDisplayMatching(en.win.getBounds()).workArea;
        en.win.setBounds({ x: wa.x + Math.floor((wa.width - SIZES.medium[0]) / 2), y: wa.y + Math.floor((wa.height - SIZES.medium[1]) / 2), width: SIZES.medium[0], height: SIZES.medium[1] });
      }
      en.win.webContents.send('aplayer:navigate', payloadOf(en));
      try { en.win.show(); en.win.focus(); } catch (_) { /* noop */ }
      return true;
    } catch (_) {
      /* رندرر در دسترس نیست → بارِ کامل همان پنجره (هنوز بدون بستن/بازکردن) */
      try { en.resent = true; en.win.loadFile(path.join(__dirname, '..', 'renderer', 'ava-player.html'), { query: payloadQuery(en) }); return true; } catch (_) { return false; }
    }
  }

  /* ---------- play — ورودیِ اصلی (همان قرارداد avaPlayerPlay قبلی) ---------- */
  async function play(src, opts) {
    const o = opts || {};
    const idm = ytIdOf(src);
    if (!idm) return { ok: false, error: 'لینک یوتیوب ویدیوی مشخصی ندارد' };

    /* موتور ۱: استریمِ مستقیم — نشد → موتور ۲: embed (پنجره هرگز نبند) */
    const rs = await resolveStream(idm.id, 'best').catch(() => ({ ok: false }));
    const engine = rs.ok ? 'direct' : 'embed';

    if (!o.keepExisting) {
      /* تک‌لاین ویدیو: خارجی‌ها بسته شوند؛ پنجرهٔ آوا (اگر باز است) «همان» navigate می‌شود */
      try { const cr = await closeAllExternalVideoPlayers(); if (cr && cr.count) playerCtl.player = null; } catch (_) { /* noop */ }
      const reuse = newest();
      for (const [apid, en] of [...players]) { if (en !== reuse) closeEntry(en); }
    }

    const payload = {
      videoId: idm.id, start: idm.start || 0, title: String(o.title || ''),
      engine, src: rs.ok ? rs.url : '', quality: rs.ok ? rs.quality : '',
    };
    const reuse = o.keepExisting ? null : newest();
    let apid;
    if (reuse && !isCrashed(reuse)) {
      apid = reuse.apid; navigateEntry(reuse, payload);
    } else {
      /* پنجرهٔ موجود یا بسته است یا رندررش مرده — زامبی نابود و پنجرهٔ تازه */
      if (reuse) closeEntry(reuse);
      apid = openWindow(payload);
    }

    playerCtl.player = 'ava'; playerCtl.activePid = apid; playerCtl.activeProc = 'ava-player';
    playerCtl.ytUrl = 'https://www.youtube.com/watch?v=' + idm.id; playerCtl.exe = ''; playerCtl.speed = 1; playerCtl.vlcBase = '';
    log('ava-player open: ' + idm.id + ' apid=' + apid + ' engine=' + engine + (o.reason ? ' (' + o.reason + ')' : ''),
      { ev: 'player', stage: 'ava-player', ok: true, via: 'ava', videoId: idm.id, engine });

    /* عنوان واقعی با oEmbed — نوار عنوان زنده به‌روز می‌شود */
    ytTitleOf(idm.id).then((t2) => {
      if (!t2) return;
      const en = players.get(apid); if (!en) return;
      en.title = t2;
      try { en.win.webContents.executeJavaScript('window.__avaSetTitle && window.__avaSetTitle(' + JSON.stringify(t2) + ')', true).catch(() => { /* noop */ }); } catch (_) { /* noop */ }
    }).catch(() => { /* noop */ });

    return { ok: true, via: 'ava', player: 'ava', fa: 'پلیر آوا', apid, engine };
  }

  /* ---------- ctl — همان زبانِ صوتی (player:ctl → __avaCtl صفحه) ---------- */
  async function ctl(a, arg, pidHint) {
    let apid = 0;
    if (Number(pidHint) < 0) apid = Number(pidHint);
    else { const en = newest(); apid = en ? en.apid : 0; }
    const en = players.get(apid);
    if (!alive(en)) return { ok: false, noPlayer: true, error: 'پنجرهٔ پلیر آوا باز نیست' };
    try {
      if (a === 'fullscreen') {
        const want = !en.win.isFullScreen();
        en.win.setFullScreen(want);
        try { en.win.show(); en.win.focus(); } catch (_) { /* noop */ }
        return { ok: true, via: 'ava-player', fullscreen: want };
      }
      const js = '(window.__avaCtl ? window.__avaCtl(' + JSON.stringify({ a, arg }) + ') : { ok:false, error:"پل preload ندارد" })';
      const r = await bounded(en.win.webContents.executeJavaScript(js, true), 6000, 'کنترل پخش');
      if (r && r.ok) return Object.assign({ ok: true, via: 'ava-player' }, r);
      return { ok: false, error: (r && r.error) || 'کنترل پخش در پلیر آوا ممکن نشد' };
    } catch (e) { return { ok: false, error: netErr(e) }; }
  }

  /* ---------- op — عملیات بومی پنجره (معادل PowerShellِ پلیرهای خارجی) ---------- */
  function op(kind, arg, apid) {
    const en = players.get(apid);
    if (!en) return Promise.resolve({ ok: false, error: 'پنجرهٔ پلیر آوا پیدا نشد' });
    if (!alive(en)) return Promise.resolve({ ok: false, error: 'پنجرهٔ پلیر آوا دیگر باز نیست' });
    const win = en.win;
    const okN = (extra) => Promise.resolve(Object.assign({ ok: true, count: 1, op: kind }, extra || {}));
    try {
      if (kind === 'size' || kind === 'resize') {
        let pw = 0, ph = 0;
        if (arg && typeof arg === 'object') { pw = Math.max(200, parseInt(arg.w, 10) || 480); ph = Math.max(120, parseInt(arg.h, 10) || 270); }
        else {
          const k = String(arg || 'medium').toLowerCase();
          if (k === 'max' || k === 'maximize') { try { win.unmaximize(); } catch (_) { /* noop */ } win.maximize(); return okN(); }
          const pr = SIZES[k] || SIZES.medium; pw = pr[0]; ph = pr[1];
        }
        const wa = screen.getDisplayMatching(win.getBounds()).workArea;
        win.setBounds({ x: wa.x + Math.floor((wa.width - pw) / 2), y: wa.y + Math.floor((wa.height - ph) / 2), width: pw, height: ph });
        return okN();
      }
      if (kind === 'maximize') { win.maximize(); return okN(); }
      if (kind === 'minimize') { win.minimize(); return okN(); }
      if (kind === 'restore') { win.restore(); return okN(); }
      if (kind === 'pip') {
        if (!en.prev || en.prev.width <= 100) en.prev = win.getBounds();
        const wa = screen.getPrimaryDisplay().workArea;
        win.setAlwaysOnTop(true, 'screen-saver');
        win.setBounds({ x: wa.x + wa.width - VPIP.w - VPIP.margin, y: wa.y + wa.height - VPIP.h - VPIP.margin, width: VPIP.w, height: VPIP.h });
        return okN();
      }
      if (kind === 'unpip') {
        const p = (en.prev && en.prev.width > 100) ? en.prev : { width: SIZES.medium[0], height: SIZES.medium[1] };
        const wa = screen.getDisplayMatching(win.getBounds()).workArea;
        win.setAlwaysOnTop(false);
        win.setBounds({ x: wa.x + Math.floor((wa.width - p.width) / 2), y: wa.y + Math.floor((wa.height - p.height) / 2), width: p.width, height: p.height });
        en.prev = null;
        return okN();
      }
      if (kind === 'top') {
        const want = arg === true || arg === false ? arg : !win.isAlwaysOnTop();
        win.setAlwaysOnTop(want, 'screen-saver');
        return okN({ top: want });
      }
      if (kind === 'opacity') {
        win.setOpacity(Math.max(0.1, Math.min(1, (parseInt(arg, 10) || 50) / 100)));
        return okN();
      }
      if (kind === 'monitor') {
        const i = Math.max(1, parseInt(arg, 10) || 1) - 1;
        const ds = screen.getAllDisplays();
        if (i >= ds.length) return Promise.resolve({ ok: false, error: 'این شماره مانیتور وجود نداره — فقط ' + ds.length + ' مانیتور متصله' });
        const wa = ds[i].workArea; const b = win.getBounds();
        win.setPosition(wa.x + Math.floor((wa.width - b.width) / 2), wa.y + Math.floor((wa.height - b.height) / 2));
        return okN();
      }
      if (kind === 'shot') {
        const shot = win.webContents.capturePage().then((img) => {
          const dir = path.join(app.getPath('pictures'), 'Ava');
          try { fs.mkdirSync(dir, { recursive: true }); } catch (_) { /* noop */ }
          const d = new Date();
          const pad = (x) => String(x).padStart(2, '0');
          const f = path.join(dir, 'video-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + '.png');
          fs.writeFileSync(f, img.toPNG());
          return { ok: true, path: f, count: 1, op: 'shot' };
        });
        return bounded(shot, 6000, 'اسکرین‌شات').catch((e) => ({ ok: false, error: netErr(e) }));
      }
      if (kind === 'copyurl') {
        const u = 'https://www.youtube.com/watch?v=' + en.videoId;
        try { clipboard.writeText(u); return okN({ url: u }); } catch (e) { return Promise.resolve({ ok: false, error: netErr(e) }); }
      }
      if (kind === 'browser') {
        const u = 'https://www.youtube.com/watch?v=' + en.videoId;
        try { shell.openExternal(u); return okN({ url: u }); } catch (e) { return Promise.resolve({ ok: false, error: netErr(e) }); }
      }
      return Promise.resolve({ ok: false, error: 'اقدام پنجرهٔ ناشناخته' });
    } catch (e) { return Promise.resolve({ ok: false, error: netErr(e) }); }
  }

  /* pip/shot = جدیدترین؛ بقیه = همه (همان معنای PS) */
  async function opAll(kind, arg) {
    if (!size()) return { ok: false, noPlayer: true };
    const ids = [...players.keys()].filter((id) => alive(players.get(id))); /* قدیم→جدید */
    if (!ids.length) return { ok: false, noPlayer: true };
    const targets = (kind === 'pip' || kind === 'shot') ? [ids[ids.length - 1]] : ids;
    let cnt = 0, last = null;
    for (const id of targets) { const r = await op(kind, arg, id); if (r.ok) { cnt++; last = r; } }
    if (cnt > 0) { const out = { ok: true, count: cnt, op: kind }; if (last && last.path) out.path = last.path; return out; }
    return { ok: false, error: 'کنترل پلیر آوا ممکن نشد' };
  }

  /* ---------- بستن‌ها — بدون هیچ تایمری ---------- */
  function closeAll() {
    const olds = [...players.values()].filter(alive);
    for (const en of olds) closeEntry(en);
    return Promise.resolve({ count: olds.length });
  }
  function closeByPid(pid) {
    const apid = Number(pid) || 0;
    const en = players.get(apid);
    if (!en) return Promise.resolve({ ok: false, error: 'پنجرهٔ مورد نظر پیدا نشد — شاید قبلاً بسته شده' });
    const ttl = 'آوا پلیر' + (en.title ? ' — ' + en.title : '');
    closeEntry(en);
    if (playerCtl.activePid === apid) { playerCtl.activePid = 0; }
    return Promise.resolve({ ok: true, closed: 1, total: 1, pid: apid, closedTitle: ttl });
  }
  function focusNewest() {
    const en = newest();
    if (!en) return false;
    try { if (en.win.isMinimized()) en.win.restore(); en.win.show(); en.win.focus(); } catch (_) { /* noop */ }
    return true;
  }
  function focusByPid(pid) {
    const en = players.get(Number(pid) || 0);
    if (!alive(en)) return Promise.resolve({ ok: false, error: 'پنجرهٔ پلیر آوا پیدا نشد' });
    try { if (en.win.isMinimized()) en.win.restore(); en.win.show(); en.win.focus(); } catch (_) { /* noop */ }
    return Promise.resolve({ ok: true, proc: 'ava-player' });
  }
  function listEntries() {
    const out = [];
    for (const [apid, en] of players) {
      if (!alive(en)) continue;
      try {
        const b = en.win.getBounds();
        out.push({ pid: apid, proc: 'ava-player', ageSec: Math.max(0, Math.floor((Date.now() - en.at) / 1000)),
          x: b.x, y: b.y, w: b.width, h: b.height, title: 'آوا پلیر' + (en.title ? ' — ' + en.title : '') });
      } catch (_) { /* noop */ }
    }
    return out;
  }

  /* ---------- IPC از خود پلیر (sender → apid) ---------- */
  function apidOfSender(sender) {
    try {
      const wc = sender && sender.id;
      if (!wc) return 0;
      for (const [apid, en] of players) { if (en.wc === wc) return apid; }
    } catch (_) { /* noop */ }
    return 0;
  }

  ipcMain.handle('aplayer:win', (_e, p) => {
    const apid = apidOfSender(_e.sender);
    const en = players.get(apid);
    if (!alive(en)) return { ok: false, error: 'پنجرهٔ پلیر پیدا نشد' };
    const opk = String((p && p.op) || '');
    const map = {
      fullscreen: () => {
        const want = p.arg === true || p.arg === false ? p.arg : !en.win.isFullScreen();
        en.win.setFullScreen(want);
        try { if (want) { en.win.show(); en.win.focus(); } } catch (_) { /* noop */ }
        return { ok: true, fs: want };
      },
      top: () => op('top', p.arg, apid),
      pip: () => op('pip', '', apid),
      unpip: () => op('unpip', '', apid),
      size: () => op('size', String((p.arg || 'medium')), apid),
      maximize: () => op('maximize', '', apid),
      minimize: () => op('minimize', '', apid),
      opacity: () => op('opacity', parseInt(p.arg, 10) || 100, apid),
      monitor: () => op('monitor', String((p.arg || '1')), apid),
      shot: () => op('shot', '', apid),
      copyurl: () => op('copyurl', '', apid),
      browser: () => op('browser', '', apid),
      close: () => { try { en.win.close(); return { ok: true }; } catch (e) { return { ok: false, error: netErr(e) }; } },
    };
    try {
      const fn = map[opk];
      if (!fn) return { ok: false, error: 'اقدام ناشناخته: ' + opk };
      const r = fn();
      return (r && typeof r.then === 'function') ? r : r;
    } catch (e) { return { ok: false, error: netErr(e) }; }
  });

  /* موتور ۳ — پخش در پلیر سیستم از خود پلیر (yt-dlp → پت‌پلیر/VLC/…) */
  ipcMain.handle('aplayer:sys', async (_e) => {
    const apid = apidOfSender(_e.sender);
    const en = players.get(apid);
    if (!en) return { ok: false, error: 'پنجرهٔ پلیر پیدا نشد' };
    const url = 'https://www.youtube.com/watch?v=' + en.videoId;
    try {
      const r = await resolveYtStream(url);
      if (!r.ok) return { ok: false, noYtdl: true, error: r.error || 'استریم یوتیوب استخراج نشد' };
      const scan = await playersScan();
      const def = await defaultVideoPlayer();
      const pl = (def.id && scan.list.some((x) => x.id === def.id)) ? def.id : ((scan.list.find((x) => x.id !== 'wmplayer') || scan.list[0]) || {}).id || '';
      if (!pl) return { ok: false, error: 'پلیر ویدیویی روی سیستم پیدا نشد' };
      const lr = await playerLaunch(pl, r.url, { ytdl: false });
      if (!lr.ok) return { ok: false, error: lr.error || 'بازکردن در پلیر سیستم ممکن نشد' };
      playerCtl.player = pl; playerCtl.activePid = 0; playerCtl.activeProc = pl; playerCtl.ytUrl = url;
      playerCtl.exe = lr.exe || playerCtl.exe || ''; playerCtl.speed = 1; playerCtl.vlcBase = '';
      log('ava-player → system player: ' + pl + ' (videoId=' + en.videoId + ')',
        { ev: 'player', stage: 'ava-sys', ok: true, via: 'ava-to-system', player: pl });
      /* بستن «بعد از» رسیدنِ پاسخ به صفحه — نه همزمان (اگر همزمان ببندیم،
         promiseِ invoke در رندرر بی‌جواب می‌ماند). بستنِ عادی است؛ پاک‌سازی
         با رویداد closed انجام می‌شود — این تایمر destroy نیست. */
      setImmediate(() => closeEntry(en));
      return { ok: true, player: pl, fa: lr.fa || '' };
    } catch (e) { return { ok: false, error: netErr(e) }; }
  });

  /* تعویض کیفیت / فالبکِ دستیِ صفحه (Q و پنل خطا) */
  ipcMain.handle('aplayer:stream', async (_e, p) => {
    const apid = apidOfSender(_e.sender);
    const en = players.get(apid);
    if (!alive(en)) return { ok: false, error: 'پنجرهٔ پلیر پیدا نشد' };
    const quality = String((p && p.quality) || 'best');
    const rs = await resolveStream(en.videoId, quality).catch(() => ({ ok: false }));
    if (!rs.ok) return { ok: false, m3u8: !!rs.m3u8, noBin: !!rs.noBin };
    en.engine = 'direct'; en.src = rs.url; en.quality = rs.quality;
    return { ok: true, url: rs.url, quality: rs.quality };
  });

  /* وضعیتِ پنجره برای رندرر (بعد از کرش/ریلود هم بازیابی می‌شود) */
  ipcMain.handle('aplayer:meta', (_e) => {
    const apid = apidOfSender(_e.sender);
    const en = players.get(apid);
    if (!alive(en)) return { ok: false };
    return Object.assign({ ok: true }, payloadOf(en));
  });

  ipcMain.on('aplayer:log', (_e, line) => { log('ava-player page: ' + String(line || '').slice(0, 220)); });

  return { play, ctl, op, opAll, closeAll, closeByPid, focusNewest, focusByPid, listEntries, size, ytIdOf };
};
