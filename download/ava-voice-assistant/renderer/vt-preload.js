/* v0.82 — preload مخصوص حباب تایپ صوتی (پنجرهٔ شناور VT) */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vtb', {
  /* کلیک روی حباب → شروع/توقف ضبط */
  toggle: () => { try { ipcRenderer.send('vt:toggle'); } catch (_) { /* noop */ } },
  /* وضعیت ضبط از رندرر اصلی برمی‌گردد */
  onRecState: (cb) => { try { ipcRenderer.on('vt:rec-state', (_e, on) => { try { cb(!!on); } catch (_) { /* noop */ } }); } catch (_) { /* noop */ } },
  /* متن میانی شنیده‌شده */
  onInterim: (cb) => { try { ipcRenderer.on('vt:interim', (_e, txt) => { try { cb(String(txt || '')); } catch (_) { /* noop */ } }); } catch (_) { /* noop */ } },
});
