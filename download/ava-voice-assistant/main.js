/**
 * آوا — دستیار صوتی ویندوز
 * Electron main process (نسخه ۰.۱ — فقط رابط کاربری)
 */
const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const os = require('os');

let win = null;

/* ---------- CPU / RAM sampling ---------- */
function cpuSample() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const c of cpus) {
    for (const k of Object.keys(c.times)) total += c.times[k];
    idle += c.times.idle;
  }
  return { idle, total };
}
let prevCpu = cpuSample();

function cpuUsage() {
  const cur = cpuSample();
  const idleD = cur.idle - prevCpu.idle;
  const totalD = cur.total - prevCpu.total;
  prevCpu = cur;
  if (totalD <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - idleD / totalD) * 100)));
}

/* ---------- Window ---------- */
function createWindow() {
  win = new BrowserWindow({
    width: 1120,
    height: 740,
    minWidth: 940,
    minHeight: 620,
    frame: false, // نوار عنوان سفارشی
    backgroundColor: '#0a0e10',
    show: false,
    title: 'آوا — دستیار صوتی ویندوز',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());

  win.on('maximize', () => win.webContents.send('win:maximized-changed', true));
  win.on('unmaximize', () => win.webContents.send('win:maximized-changed', false));
  win.on('closed', () => { win = null; });

  // برای دیباگ رابط کاربری، خط زیر را از کامنت خارج کنید:
  // win.webContents.openDevTools({ mode: 'detach' });
}

/* ---------- IPC: window controls ---------- */
ipcMain.handle('win:minimize', () => { if (win) win.minimize(); });
ipcMain.handle('win:toggle-maximize', () => {
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});
ipcMain.handle('win:close', () => { if (win) win.close(); });
ipcMain.handle('win:is-maximized', () => (win ? win.isMaximized() : false));

/* ---------- IPC: system stats (برای مانیتور و نوار وضعیت) ---------- */
ipcMain.handle('sys:stats', () => ({
  cpu: cpuUsage(),
  ram: Math.round((1 - os.freemem() / os.totalmem()) * 100),
  uptime: Math.round(os.uptime()),
  totalMemGB: +(os.totalmem() / 1073741824).toFixed(1),
  freeMemGB: +(os.freemem() / 1073741824).toFixed(1),
  platform: os.platform(),
  release: os.release(),
  hostname: os.hostname(),
}));

/* ---------- App lifecycle ---------- */
app.whenReady().then(() => {
  createWindow();

  // میانبر سراسری گوش دادن (Push-to-talk)
  try {
    globalShortcut.register('CommandOrControl+Shift+Space', () => {
      if (win) {
        if (win.isMinimized()) win.restore();
        win.show();
        win.webContents.send('ava:toggle-listen');
      }
    });
  } catch (e) {
    /* noop */
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit(); // رفتار استاندارد ویندوز
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
