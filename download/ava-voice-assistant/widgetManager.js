'use strict';
/* ============================================================
   آوا — widgetManager (v0.56) — ویجت شناور بعد از ریورک کامل
   ------------------------------------------------------------
   درخواست کاربر: «طراحی‌اش خوب نیست، ریورک حسابی کن؛ کنترل کردنش رو
   بهتر کن — هر کاری کاربر بخواد بتونه باهاش بکنه: غیرفعال کنه، چت رو
   باز کنه، یا هر آپشن دیگ — خودت خلاق باش»
   ------------------------------------------------------------
   • اورب شیشه‌ای + حلقهٔ حالت SVG (widget.html v2)
   • سه اندازه کوچک/معمولی/بزرگ + شفافیت ۱۰۰/۸۰/۶۰ + قفل جایگاه + متن روشن/خاموش
   • راست‌کلیک/دکمهٔ منو → منوی کامل داخل خود ویجت
   • همهٔ ترجیحات در widget-state.json (نوشتن اتمیک tmp+rename)
   • onConfigured → منوی ترِی همیشه همگام (فیکس چک‌باکس کهنهٔ v0.55)
   ============================================================ */
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, screen, Menu } = require('electron');

let mainWin = null;
let widgetWin = null;
let onConfigured = null;
let state = { enabled: true, x: null, y: null, size: 'm', opacity: 1, locked: false, showTexts: true };
let statePath = null;
let saveTimer = null;
const SIZES = { s: { w: 236, h: 138 }, m: { w: 300, h: 172 }, l: { w: 372, h: 208 } };

function log(m) { try { console.log('WIDGET:' + m); } catch (_) { /* noop */ } }

function writeStateFile() {
  try {
    if (!statePath) return;
    const tmp = statePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tmp, statePath);
  } catch (e) { log('SAVE_ERR:' + (e && e.message)); }
}
function saveState() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; writeStateFile(); }, 250);
}
function loadState() {
  try { const raw = JSON.parse(fs.readFileSync(statePath, 'utf8')); if (raw && typeof raw === 'object') state = Object.assign(state, raw); } catch (_) { /* اولین اجرا */ }
  if (typeof state.enabled !== 'boolean') state.enabled = true;
  if (!['s', 'm', 'l'].includes(state.size)) state.size = 'm';
  if (![1, 0.8, 0.6].includes(Number(state.opacity))) state.opacity = 1;
  state.opacity = Number(state.opacity) || 1;
  state.locked = !!state.locked;
  if (typeof state.showTexts !== 'boolean') state.showTexts = true;
  if (state.x != null && typeof state.x !== 'number') state.x = null;
  if (state.y != null && typeof state.y !== 'number') state.y = null;
}

function defaultPos() {
  try {
    const p = screen.getCursorScreenPoint();
    const wa = screen.getDisplayNearestPoint(p).workArea;
    return { x: wa.x + wa.width - SIZES[state.size].w - 18, y: wa.y + wa.height - SIZES[state.size].h - 18 };
  } catch (_) { return { x: 100, y: 100 }; }
}

function sendLook() {
  try { if (widgetWin && !widgetWin.isDestroyed()) widgetWin.webContents.send('widget:look', { size: state.size, opacity: state.opacity, locked: state.locked, showTexts: state.showTexts }); } catch (_) { /* noop */ }
}

function createWidget() {
  if (widgetWin && !widgetWin.isDestroyed()) return;
  const d = state.x != null && state.y != null ? { x: state.x, y: state.y } : defaultPos();
  const s = SIZES[state.size] || SIZES.m;
  widgetWin = new BrowserWindow({
    width: s.w, height: s.h, x: d.x, y: d.y,
    frame: false, transparent: true, resizable: false, movable: true,
    alwaysOnTop: true, skipTaskbar: true, hasShadow: false,
    show: false, backgroundColor: '#00000000',
    title: 'آوا — ویجت',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      contextIsolation: true, nodeIntegration: false, spellcheck: false,
      preload: path.join(__dirname, 'renderer', 'widgetPreload.js'),
    },
  });
  widgetWin.setAlwaysOnTop(true, 'floating');
  try { widgetWin.setOpacity(state.opacity); } catch (_) { /* noop */ }
  widgetWin.loadURL('ava://app/renderer/widget.html');
  widgetWin.once('ready-to-show', () => { try { widgetWin.showInactive(); } catch (_) { /* noop */ } sendLook(); log('open'); });
  const mv = () => { try { const [nx, ny] = widgetWin.getPosition(); state.x = nx; state.y = ny; saveState(); } catch (_) { /* noop */ } };
  widgetWin.on('moved', mv);
  widgetWin.on('closed', () => { widgetWin = null; log('closed'); });
  widgetWin.on('always-on-top-changed', (_e, top) => { if (!top && widgetWin && !widgetWin.isDestroyed()) widgetWin.setAlwaysOnTop(true, 'floating'); });
}

function destroyWidget() {
  try { if (widgetWin && !widgetWin.isDestroyed()) widgetWin.destroy(); } catch (_) { /* noop */ }
  widgetWin = null;
}

/* اعمال ترجیحات ظاهری روی پنجرهٔ زنده + همگام‌سازی renderer */
function applyLook() {
  if (!widgetWin || widgetWin.isDestroyed()) return;
  const s = SIZES[state.size] || SIZES.m;
  try {
    const [cx, cy] = widgetWin.getPosition();
    widgetWin.setBounds({ width: s.w, height: s.h, x: (state.x != null ? state.x : cx), y: (state.y != null ? state.y : cy) });
  } catch (_) { try { widgetWin.setSize(s.w, s.h); } catch (_2) { /* noop */ } }
  try { widgetWin.setOpacity(Number(state.opacity) || 1); } catch (_) { /* noop */ }
  sendLook();
}

function configured() {
  saveState();
  try { if (onConfigured) onConfigured({ enabled: state.enabled }); } catch (_) { /* noop */ }
  broadcast();
}

/* از renderer یا منو: پچ امنِ ترجیحات */
function applyPatch(p) {
  p = p || {};
  if (p.size && ['s', 'm', 'l'].includes(p.size)) state.size = p.size;
  if ([1, 0.8, 0.6].includes(Number(p.opacity))) state.opacity = Number(p.opacity);
  if ('locked' in p) state.locked = !!p.locked;
  if ('showTexts' in p) state.showTexts = !!p.showTexts;
  applyLook();
  configured();
}

function configure(enabled) {
  state.enabled = !!enabled;
  if (state.enabled) createWidget(); else destroyWidget();
  applyLook();
  configured();
}

function getState() {
  const open = !!(widgetWin && !widgetWin.isDestroyed() && widgetWin.isVisible());
  return { enabled: state.enabled, open, size: state.size, opacity: state.opacity, locked: state.locked, showTexts: state.showTexts };
}

/* اعلان به پنجرهٔ اصلی (چک‌باکس تنظیمات همیشه صادق باشد) */
function broadcast() {
  try { if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('widget:state', getState()); } catch (_) { /* noop */ }
}

/* به‌روزرسانی محتوا/حالت — از renderer اصلی می‌آید */
function update(payload) {
  if (!state.enabled) return;
  if (!widgetWin || widgetWin.isDestroyed()) { if (state.enabled) createWidget(); return; }
  try { widgetWin.webContents.send('widget:update', payload || {}); } catch (_) { /* noop */ }
}

/* ---------- منوی ویجت (راست‌کلیک / دکمهٔ ⋮ ) ---------- */
function buildMenu() {
  const szl = { s: 'کوچک', m: 'معمولی', l: 'بزرگ' };
  return Menu.buildFromTemplate([
    { label: 'نمایش پنجرهٔ اصلی', click: () => { try { if (mainWin && !mainWin.isDestroyed()) { mainWin.show(); mainWin.focus(); } } catch (_) { /* noop */ } } },
    { label: 'شروع / توقف گوش دادن', click: () => { try { if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('ava:toggle-listen', {}); } catch (_) { /* noop */ } } },
    { label: 'باز کردن چت', click: () => { try { if (mainWin && !mainWin.isDestroyed()) { mainWin.show(); mainWin.focus(); mainWin.webContents.send('ava:open-chat', {}); } } catch (_) { /* noop */ } } },
    { type: 'separator' },
    { label: 'اندازه', submenu: ['s', 'm', 'l'].map((k) => ({ label: szl[k], type: 'radio', checked: state.size === k, click: () => applyPatch({ size: k }) })) },
    { label: 'شفافیت', submenu: [
      { label: '۱۰۰٪', type: 'radio', checked: state.opacity === 1, click: () => applyPatch({ opacity: 1 }) },
      { label: '۸۰٪', type: 'radio', checked: state.opacity === 0.8, click: () => applyPatch({ opacity: 0.8 }) },
      { label: '۶۰٪', type: 'radio', checked: state.opacity === 0.6, click: () => applyPatch({ opacity: 0.6 }) },
    ] },
    { label: 'قفل جای ویجت', type: 'checkbox', checked: !!state.locked, click: (it) => applyPatch({ locked: it.checked }) },
    { label: 'نمایش متن گفتگوها', type: 'checkbox', checked: state.showTexts !== false, click: (it) => applyPatch({ showTexts: it.checked }) },
    { label: 'بازنشانی مکان ویجت', click: () => {
      const d = defaultPos(); state.x = d.x; state.y = d.y; saveState();
      try { if (widgetWin && !widgetWin.isDestroyed()) widgetWin.setPosition(d.x, d.y); } catch (_) { /* noop */ }
    } },
    { type: 'separator' },
    { label: 'خاموش کردن ویجت شناور', click: () => configure(false) },
  ]);
}
function openMenu() {
  try {
    if (widgetWin && !widgetWin.isDestroyed()) { buildMenu().popup({ window: widgetWin }); return; }
    buildMenu().popup({ window: mainWin || undefined });
  } catch (e) { log('MENU_ERR:' + (e && e.message)); }
}

function flushState() {
  if (!saveTimer) return;
  try { clearTimeout(saveTimer); } catch (_) { /* noop */ }
  saveTimer = null;
  writeStateFile();
}

function init({ win, onConfig: cb }) {
  mainWin = win;
  onConfigured = typeof cb === 'function' ? cb : null;
  statePath = path.join(app.getPath('userData'), 'widget-state.json');
  loadState();
  ipcMain.handle('widget:get', () => getState());
  ipcMain.on('widget:config', (_e, p) => { configure(p && p.enabled); });
  ipcMain.on('widget:update', (_e, p) => update(p));
  ipcMain.on('widget:open-main', () => {
    try {
      if (mainWin && !mainWin.isDestroyed()) { mainWin.show(); mainWin.focus(); }
    } catch (_) { /* noop */ }
  });
  /* v0.56 — کنترل کامل از داخل ویجت */
  ipcMain.on('widget:menu', () => { try { openMenu(); } catch (_) { /* noop */ } });
  ipcMain.on('widget:act', (_e, p) => {
    const act = String((p && p.name) || '');
    try {
      if (act === 'toggle-listen' && mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('ava:toggle-listen', {});
      else if (act === 'open-chat' && mainWin && !mainWin.isDestroyed()) { mainWin.show(); mainWin.focus(); mainWin.webContents.send('ava:open-chat', {}); }
    } catch (_) { /* noop */ }
  });
  ipcMain.on('widget:set', (_e, p) => { try { applyPatch(p || {}); } catch (_) { /* noop */ } });
  if (state.enabled) setTimeout(createWidget, 1200); /* بعد از استقرار پنجرهٔ اصلی */
}

module.exports = { init, configure, update, getState, flushState };
