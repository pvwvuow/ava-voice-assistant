'use strict';
/* ============================================================
   آوا — widgetManager (v0.55) — ویجت شناور آوا
   ------------------------------------------------------------
   درخواست صریح کاربر: «یک حالت آیکون فلوت معلق داشته باشیم که آیکون
   برنامه رو اونجا داشته باشه؛ هر وقت کاربر صحبت کرد یک حالت هالهٔ سبز
   دورش بیاد؛ گفتهٔ خود کاربر کوچولو بنویسه و پاسخ آوا هم بنویسه»
   ------------------------------------------------------------
   • پنجرهٔ کوچک شیشه‌ای، بدون قاب، همیشه-روشن، بدون نوار تسک
   • حالت‌ها: idle / listening (هالهٔ سبز پالس‌دار) / processing (کهربایی) /
     speaking (فیروزه‌ای) + متنِ کوچکِ گفتهٔ کاربر و پاسخ آوا
   • درگ با app-region (پنجره focusable است — مطمئن‌ترین درگ ویندوزی)
   • دابل‌کلیک → باز شدن پنجرهٔ اصلی
   • موقعیت و روشن/خاموشی در widget-state.json (نوشتن اتمیک tmp+rename)
   • اگر پنجرهٔ اصلی مخفی (ترِی) شد، ویجت سرجایش می‌ماند — چشم آوا
   ============================================================ */
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, screen } = require('electron');

let mainWin = null;
let widgetWin = null;
let state = { enabled: true, x: null, y: null };
let statePath = null;
let saveTimer = null;
const W = 300, H = 178;

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
  saveTimer = setTimeout(() => { saveTimer = null; writeStateFile(); }, 300);
}
function loadState() {
  try { const raw = JSON.parse(fs.readFileSync(statePath, 'utf8')); if (raw && typeof raw === 'object') state = Object.assign(state, raw); } catch (_) { /* اولین اجرا */ }
  if (typeof state.enabled !== 'boolean') state.enabled = true;
}

function defaultPos() {
  try {
    const p = screen.getCursorScreenPoint();
    const wa = screen.getDisplayNearestPoint(p).workArea;
    return { x: wa.x + wa.width - W - 18, y: wa.y + wa.height - H - 18 };
  } catch (_) { return { x: 100, y: 100 }; }
}

function createWidget() {
  if (widgetWin && !widgetWin.isDestroyed()) return;
  const d = defaultPos();
  const x = (typeof state.x === 'number') ? state.x : d.x;
  const y = (typeof state.y === 'number') ? state.y : d.y;
  widgetWin = new BrowserWindow({
    width: W, height: H, x, y,
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
  widgetWin.loadURL('ava://app/renderer/widget.html');
  widgetWin.once('ready-to-show', () => { try { widgetWin.showInactive(); } catch (_) { /* noop */ } log('open'); });
  /* موقعیت — ذخیره با debounce */
  const mv = () => { try { const [nx, ny] = widgetWin.getPosition(); state.x = nx; state.y = ny; saveState(); } catch (_) { /* noop */ } };
  widgetWin.on('moved', mv);
  widgetWin.on('moved', () => {});
  widgetWin.on('closed', () => { widgetWin = null; log('closed'); });
  widgetWin.on('always-on-top-changed', (_e, top) => { if (!top && widgetWin && !widgetWin.isDestroyed()) widgetWin.setAlwaysOnTop(true, 'floating'); });
}

function destroyWidget() {
  try { if (widgetWin && !widgetWin.isDestroyed()) widgetWin.destroy(); } catch (_) { /* noop */ }
  widgetWin = null;
}

function configure(enabled) {
  state.enabled = !!enabled;
  saveState();
  if (state.enabled) createWidget(); else destroyWidget();
  broadcast();
}

function getState() {
  const open = !!(widgetWin && !widgetWin.isDestroyed() && widgetWin.isVisible());
  return { enabled: state.enabled, open };
}

/* اعلان به پنجرهٔ اصلی (چک‌باکس تنظیمات همیشه صادق باشد) */
function broadcast() {
  try { if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('widget:state', getState()); } catch (_) { /* noop */ }
}

/* به‌روزرسانی محتوا/حالت — از renderer اصلی می‌آید */
function update(payload) {
  if (!state.enabled) return;
  if (!widgetWin || widgetWin.isDestroyed()) { createWidget(); return; }
  try { widgetWin.webContents.send('widget:update', payload || {}); } catch (_) { /* noop */ }
}

function flushState() {
  if (!saveTimer) return;
  try { clearTimeout(saveTimer); } catch (_) { /* noop */ }
  saveTimer = null;
  writeStateFile();
}

function init({ win }) {
  mainWin = win;
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
  if (state.enabled) setTimeout(createWidget, 1200); /* بعد از استقرار پنجرهٔ اصلی */
}

module.exports = { init, configure, update, getState, flushState };
