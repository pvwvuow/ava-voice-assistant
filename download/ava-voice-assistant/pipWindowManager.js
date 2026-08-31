'use strict';
/* ============================================================
   آوا — pipWindowManager (v0.37) — مدیر پنجرهٔ «ویدیوی شناور»
   ------------------------------------------------------------
   مسئولیت‌ها:
   • ساخت/نمایش/مخفی‌کردن پنجرهٔ PiP (BrowserWindow شیشه‌ای، بدون قاب)
   • جابجایی روی «مانیتور فعال» (مانیتوری که ماوس آنجاست)
   • تغییر اندازهٔ 16:9 ، شفافیت، click-through ، always-on-top
   • ذخیره/بازیابی آخرین وضعیت در pip-state.json (پوشهٔ userData)
   • میانبرهای سراسری: Ctrl+Shift+P (روشن/خاموش)، Ctrl+Shift+جهت‌ها
     (جابجایی)، Ctrl+Shift+Plus/Minus (اندازه) — فقط وقتی PiP باز است
     میانبرهای جهت ثبت می‌شوند تا کلید دیگر برنامه‌ها را ندزدند.
   • درگ دستی پنجره (poll مختصات ماوس در پروسهٔ اصلی — چون پنجره
     focusable:false است و حلقهٔ درگِ Chromium روی آن قابل‌اعتماد نیست)

   ⚠️ Exclusive Fullscreen: اگر بازی «تمام‌صفحهٔ انحصاری» باشد،
   ویندوز هیچ پنجرهٔ شناوری را روی بازی نشان نمی‌دهد. بازی باید
   Borderless Windowed / Windowed Fullscreen باشد. (توضیح در README)
   ============================================================ */
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process'); /* v0.38 — باز کردن نتایج جستجو در مرورگر پیش‌فرض */
const { app, BrowserWindow, ipcMain, screen, clipboard, globalShortcut } = require('electron');
const core = require('./pipCore');

let appWin = null;      /* پنجرهٔ اصلی آوا (برای رویدادها) */
let pipWin = null;      /* پنجرهٔ PiP */
let state = null;       /* وضعیت ماندگار */
let statePath = null;   /* مسیر pip-state.json */
let saveTimer = null;   /* debounce ذخیره */
let pendingSource = null; /* منبع ویدیویی که هنوز به صفحهٔ PiP نرسیده */
let dragTimer = null;   /* حلقهٔ درگ دستی */
let moveKeysBound = false;

const ytEmbedAllowed = /^https:\/\/www\.youtube(-nocookie)?\.com\/embed\//i;

function log(m) { try { console.log('PIP:' + m); } catch (_) {} }

/* ---------- وضعیت ---------- */
function getState() {
  const open = !!(pipWin && !pipWin.isDestroyed() && pipWin.isVisible());
  return Object.assign({}, state, { open });
}

function savePiPState() {
  /* ذخیرهٔ debounce شده — حرکت/تغییر اندازهٔ پشت‌سرهم فقط یک بار نوشته می‌شود */
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      if (!statePath) return;
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
    } catch (e) { log('SAVE_ERR:' + (e && e.message)); }
  }, 300);
}

function loadPiPState() {
  let raw = null;
  try { raw = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch (_) { /* اولین اجرا */ }
  state = core.normalizeState(raw);
}

/* ---------- مانیتور فعال ---------- */
function activeWorkArea() {
  /* «مانیتور فعال» = مانیتوری که ماوس روی آن است؛ اگر نشد، مانیتور اصلی */
  try {
    const p = screen.getCursorScreenPoint();
    const d = screen.getDisplayNearestPoint(p);
    return d.workArea;
  } catch (_) { /* noop */ }
  try { return screen.getPrimaryDisplay().workArea; } catch (_) { return { x: 0, y: 0, width: 1920, height: 1040 }; }
}

/* ---------- اعمال وضعیت روی پنجره ---------- */
function applyOpacity(v) {
  if (!pipWin || pipWin.isDestroyed()) return;
  try { pipWin.setOpacity(core.clamp(v, 0.1, 1)); } catch (e) { log('OP_ERR:' + e.message); }
}

/* click-through: کل پنجره از ماوس عبور می‌کند (forward:true یعنی mousemove
   همچنان به صفحهٔ PiP می‌رسد تا هنگام hover روی نوار کنترل، کلیک‌پذیری
   موقتاً برگردد — الگوی استاندارد overlay های بازی) */
function applyClickThrough(on) {
  if (!pipWin || pipWin.isDestroyed()) return;
  try { pipWin.setIgnoreMouseEvents(!!on, { forward: true }); } catch (e) { log('CT_ERR:' + e.message); }
}

function applyAlwaysOnTop(on) {
  if (!pipWin || pipWin.isDestroyed()) return;
  try { pipWin.setAlwaysOnTop(!!on, 'screen-saver'); } catch (_) { /* noop */ }
}

function sendState() {
  if (pipWin && !pipWin.isDestroyed()) {
    try { pipWin.webContents.send('pip:state', getState()); } catch (_) { /* noop */ }
  }
  if (appWin && !appWin.isDestroyed()) {
    try { appWin.webContents.send('pip:state', getState()); } catch (_) { /* noop */ }
  }
}

/* ---------- ساخت پنجره ---------- */
function createPiPWindow(options) {
  const opts = options || {};
  if (pipWin && !pipWin.isDestroyed()) { try { pipWin.destroy(); } catch (_) {} }
  pipWin = null;

  const wa = activeWorkArea();
  /* اگر جای ذخیره‌شده روی مانیتور فعلی معقول بود همان، وگرنه موقعیت اسمی */
  let b = null;
  if (opts.restore && state.lastBounds) b = Object.assign({}, state.lastBounds);
  if (!b) b = core.pipBounds(wa, state.size, state.position);

  pipWin = new BrowserWindow({
    width: b.width,
    height: b.height,
    x: b.x,
    y: b.y,
    frame: false,          /* بدون نوار عنوان */
    transparent: true,     /* گوشه‌های گرد شیشه‌ای */
    resizable: true,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,     /* در تسک‌بار و alt-tab بازی نمی‌آید */
    hasShadow: false,
    focusable: state.focusable !== undefined ? state.focusable : false,
    show: false,
    backgroundColor: '#00000000',
    title: 'AVA PiP — ویدیوی شناور',
    icon: path.join(__dirname, 'renderer', 'assets', 'ava-logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'pipPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: false, /* در بازی، تایمرها throttle نشوند */
    },
  });

  /* بالای همهٔ چیز حتی نوار وظیفه + دیده‌شدن روی همهٔ دسکتاپ‌ها */
  applyAlwaysOnTop(state.alwaysOnTop);
  try { pipWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch (_) { /* noop */ }
  try { pipWin.setMenu(null); } catch (_) { /* noop */ }

  applyOpacity(state.opacity);
  applyClickThrough(state.clickThrough);

  pipWin.loadURL('ava://app/renderer/pip.html');

  /* امنیت: فقط iframe یوتیوب مجاز است؛ هیچ popup و هیچ ناوبری دیگری */
  pipWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  pipWin.webContents.on('will-navigate', (e, url) => {
    if (!ytEmbedAllowed.test(url)) { try { e.preventDefault(); } catch (_) {} log('NAV_BLOCK'); }
  });

  pipWin.once('ready-to-show', () => {
    try { pipWin.showInactive(); } catch (_) { pipWin.show(); }
    bindMoveKeys(true);
    sendState();
  });

  /* حرکت/تغییر اندازهٔ دستی کاربر هم ثبت شود */
  const recBounds = () => {
    if (!pipWin || pipWin.isDestroyed()) return;
    try {
      const bb = pipWin.getBounds();
      state.lastBounds = { x: bb.x, y: bb.y, width: bb.width, height: bb.height };
      savePiPState();
    } catch (_) { /* noop */ }
  };
  pipWin.on('move', recBounds);
  pipWin.on('resize', recBounds);

  pipWin.on('closed', () => {
    pipWin = null;
    pendingSource = null;
    stopDrag();
    bindMoveKeys(false);
    sendState();
  });

  return pipWin;
}

/* ---------- API عمومی ماژول ---------- */
function ensureWindow(opts) {
  if (!pipWin || pipWin.isDestroyed()) createPiPWindow(opts);
  return pipWin;
}

/* source = {kind:'youtube',videoId,start} | {kind:'src',url,volume,rate,time,muted} | {kind:'blob'} | {kind:'none'} */
function showPiP(source) {
  if (source !== undefined) pendingSource = source && source.kind ? source : null;
  const w = ensureWindow();
  try { if (!pipWin.isVisible()) pipWin.showInactive(); } catch (_) { try { pipWin.show(); } catch (_) {} }
  /* اگر صفحه از قبل بالا آمده، منبعِ در انتظار همین حالا بفرست */
  try { pipWin.webContents.send('pip:source', pendingSource); } catch (_) { /* noop */ }
  return getState();
}

function hidePiP() {
  if (pipWin && !pipWin.isDestroyed()) { try { pipWin.hide(); } catch (_) {} }
  bindMoveKeys(false);
  sendState();
  return getState();
}

function togglePiP(source) {
  const open = pipWin && !pipWin.isDestroyed() && pipWin.isVisible();
  return open ? hidePiP() : showPiP(source);
}

/* v0.38 — باز کردن مستقیم یک URL/شناسهٔ یوتیوب در پنجرهٔ شناور
   (دستور صوتی «یوتیوب شناور …» و نوار جستجوی داخل PiP)
   خروجی: true اگر ویدیوی یوتیوب بود و پخش شد؛ false = فراخواننده فالبک کند */
function openUrl(u) {
  const s = String(u || '').trim();
  if (!s) return false;
  const id = core.ytIdFromUrl(s) || (/^[a-zA-Z0-9_-]{11}$/.test(s) ? s : null);
  if (!id) return false; /* لینک/شناسهٔ ویدیوی یوتیوب نیست */
  let start = 0;
  try { start = core.ytStartFromUrl(s) || 0; } catch (_) { start = 0; }
  showPiP({ kind: 'youtube', videoId: id, start });
  return true;
}

function movePiP(position) {
  if (!core.PIP_POSITIONS.includes(position)) return getState();
  state.position = position;
  state.lastBounds = null; /* موقعیت اسمی جدید جایگزین جای دستی */
  const w = ensureWindow();
  const b = core.pipBounds(activeWorkArea(), state.size, position);
  try { w.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height }); } catch (e) { log('MOVE_ERR:' + e.message); }
  savePiPState();
  sendState();
  return getState();
}

function resizePiP(sizeKey) {
  if (!core.PIP_SIZES[sizeKey]) return getState();
  state.size = sizeKey;
  const w = ensureWindow();
  /* وقتی جای دستی داریم، از همان گوشه/لبه حفظ کنیم؛ وگرنه موقعیت اسمی */
  let anchor;
  if (state.lastBounds) {
    anchor = { x: state.lastBounds.x, y: state.lastBounds.y };
  } else {
    const b = core.pipBounds(activeWorkArea(), sizeKey, state.position);
    anchor = { x: b.x, y: b.y };
  }
  const s = core.PIP_SIZES[sizeKey];
  try { w.setBounds({ x: anchor.x, y: anchor.y, width: s.w, height: s.h }); } catch (e) { log('RES_ERR:' + e.message); }
  savePiPState();
  sendState();
  return getState();
}

function setPiPOpacity(value) {
  const v = core.snapOpacity(value);
  state.opacity = v;
  applyOpacity(v);
  savePiPState();
  sendState();
  return getState();
}

function setClickThrough(enabled) {
  state.clickThrough = !!enabled;
  applyClickThrough(state.clickThrough);
  savePiPState();
  sendState();
  return getState();
}

function setAlwaysOnTop(enabled) {
  state.alwaysOnTop = !!enabled;
  applyAlwaysOnTop(state.alwaysOnTop);
  savePiPState();
  sendState();
  return getState();
}

function resetPiP() {
  state = core.normalizeState(null);
  const w = ensureWindow();
  const b = core.pipBounds(activeWorkArea(), state.size, state.position);
  try { w.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height }); } catch (_) { /* noop */ }
  applyOpacity(state.opacity);
  applyClickThrough(state.clickThrough);
  applyAlwaysOnTop(state.alwaysOnTop);
  savePiPState();
  sendState();
  return getState();
}

/* ---------- درگ دستی (poll ماوس در پروسهٔ اصلی) ---------- */
function stopDrag() {
  if (dragTimer) { clearInterval(dragTimer); dragTimer = null; }
}

function startDrag() {
  if (!pipWin || pipWin.isDestroyed()) return;
  stopDrag();
  let from;
  let wp;
  try {
    from = screen.getCursorScreenPoint();
    wp = pipWin.getPosition();
  } catch (_) { return; }
  let lastX = from.x, lastY = from.y, idle = 0, ticks = 0;
  dragTimer = setInterval(() => {
    try {
      if (!pipWin || pipWin.isDestroyed()) { stopDrag(); return; }
      const p = screen.getCursorScreenPoint();
      if (p.x === lastX && p.y === lastY) {
        /* 1.2 ثانیه ماوس نخورد = دکمه رها شده بیرون از پنجره → پایان */
        if (++idle > 75) { stopDrag(); return; }
      } else { idle = 0; lastX = p.x; lastY = p.y; }
      if (++ticks > 3750) { stopDrag(); return; } /*failsafe یک دقیقه */
      pipWin.setPosition(wp.x + (p.x - from.x), wp.y + (p.y - from.y));
    } catch (_) { stopDrag(); }
  }, 16);
}

/* ---------- میانبرهای سراسری ---------- */
function bindMoveKeys(bind) {
  if (bind === moveKeysBound) return;
  try {
    if (bind) {
      globalShortcut.register('CommandOrControl+Shift+Left', () => movePiP('top-left'));
      globalShortcut.register('CommandOrControl+Shift+Right', () => movePiP('top-right'));
      globalShortcut.register('CommandOrControl+Shift+Up', () => movePiP('top-center'));
      globalShortcut.register('CommandOrControl+Shift+Down', () => movePiP('bottom-center'));
      globalShortcut.register('CommandOrControl+Shift+Return', () => movePiP('center'));
      globalShortcut.register('CommandOrControl+Shift+Plus', () => resizePiP(core.stepSize(state.size, +1)));
      globalShortcut.register('CommandOrControl+Shift+Minus', () => resizePiP(core.stepSize(state.size, -1)));
    } else {
      ['Left', 'Right', 'Up', 'Down', 'Return', 'Plus', 'Minus'].forEach((k) => {
        try { globalShortcut.unregister('CommandOrControl+Shift+' + k); } catch (_) { /* noop */ }
      });
    }
    moveKeysBound = !!bind;
  } catch (e) { log('KEY_ERR:' + e.message); }
}

function registerShortcuts() {
  /* Ctrl+Shift+P همیشه فعال است (روشن/خاموش PiP حتی وسط بازی) */
  try {
    globalShortcut.register('CommandOrControl+Shift+P', () => { togglePiP(); });
  } catch (e) { log('KEY_ERR:' + e.message); }
}

/* ---------- IPC ---------- */
function registerIpc() {
  const handle = (ch, fn) => { try { ipcMain.handle(ch, fn); } catch (e) { log('IPC_DUP:' + ch); } };
  handle('pip:show', (_e, source) => showPiP(source));
  handle('pip:hide', () => hidePiP());
  handle('pip:toggle', (_e, source) => togglePiP(source));
  handle('pip:move', (_e, pos) => movePiP(pos));
  handle('pip:resize', (_e, size) => resizePiP(size));
  handle('pip:opacity', (_e, v) => setPiPOpacity(v));
  handle('pip:click-through', (_e, on) => setClickThrough(on));
  handle('pip:always-on-top', (_e, on) => setAlwaysOnTop(on));
  handle('pip:reset', () => resetPiP());
  handle('pip:get-state', () => getState());
  /* کلیپ‌بورد از پروسهٔ اصلی — بدون پنجرهٔ مجوز مرورگر، برای «لینک یوتیوب کپی‌شده» */
  handle('pip:clip', () => { try { return String(clipboard.readText() || '').slice(0, 4000); } catch (_) { return ''; } });

  /* پیام‌های صفحهٔ PiP */
  try {
    ipcMain.on('pip:host:ready', (e) => {
      try { e.sender.send('pip:source', pendingSource); } catch (_) { /* noop */ }
      try { e.sender.send('pip:state', getState()); } catch (_) { /* noop */ }
    });
    ipcMain.on('pip:host:close', () => hidePiP());
    ipcMain.on('pip:host:hover-ui', (e, on) => {
      /* وقتی click-through فعال است فقط نوار کنترل کلیک‌پذیر می‌ماند */
      if (pipWin && !pipWin.isDestroyed() && e.sender === pipWin.webContents && state && state.clickThrough) {
        applyClickThrough(!on);
      }
    });
    ipcMain.on('pip:host:drag-start', () => startDrag());
    ipcMain.on('pip:host:drag-end', () => stopDrag());
    /* v0.38 — جستجوی سریع داخل پنجرهٔ PiP:
     • لینک/شناسهٔ یوتیوب → همان‌جا پخش می‌شود
     • متن معمولی → صفحهٔ نتایج یوتیوب iframe نمی‌شود (X-Frame-Options گوگل)؛
       پس نتیجه‌ها در مرورگر پیش‌فرض باز و در PiP پیام راهنما نشان داده می‌شود */
    ipcMain.on('pip:host:search', (_e, q) => {
      const s = String(q || '').trim().slice(0, 200);
      if (!s) return;
      const id = core.ytIdFromUrl(s) || (/^[a-zA-Z0-9_-]{11}$/.test(s) ? s : null);
      if (id) { showPiP({ kind: 'youtube', videoId: id }); return; }
      try {
        exec(`start "" "https://www.youtube.com/results?search_query=${encodeURIComponent(s)}"`, { windowsHide: true, timeout: 15000 }, () => {});
      } catch (_) { /* noop */ }
      showPiP({ kind: 'note', message: 'نتیجه‌ها در مرورگر باز شد. لینک ویدیو را کپی کن و بگو «ویدیو رو پین کن» تا همین‌جا پخش شود.' });
    });
    ipcMain.on('pip:host:ctl', (_e, type) => {
      switch (String(type || '')) {
        case 'close': hidePiP(); break;
        case 'clickthrough': setClickThrough(!state.clickThrough); break;
        case 'opacity': setPiPOpacity(core.stepOpacity(state.opacity, -1)); break;
        case 'size': resizePiP(core.stepSize(state.size, +1)); break;
        default: break;
      }
    });
  } catch (e) { log('IPC_ON_ERR:' + e.message); }
}

/* ---------- راه‌اندازی ---------- */
function init(opts) {
  const o = opts || {};
  appWin = o.win || null;
  statePath = o.statePath || path.join(app.getPath('userData'), 'pip-state.json');
  loadPiPState();
  registerIpc();
  registerShortcuts();
  log('INIT ' + JSON.stringify({ position: state.position, size: state.size }));
}

module.exports = {
  init,
  createPiPWindow,
  showPiP,
  hidePiP,
  togglePiP,
  movePiP,
  resizePiP,
  setPiPOpacity,
  setClickThrough,
  setAlwaysOnTop,
  savePiPState,
  loadPiPState,
  resetPiP,
  getState,
  openUrl, /* v0.38 — لینک/شناسهٔ یوتیوب → پخش شناور */
};
