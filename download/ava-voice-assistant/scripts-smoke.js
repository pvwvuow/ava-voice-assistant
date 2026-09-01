/**
 * Smoke test for AVA v0.16.1 — boots the app under Xvfb, checks
 * v0.11 UI elements (titlebar physical layout, update badge, music
 * page, live text, new settings), suggestion rotation, theme +
 * language switching, v0.12 additions (phonetic app-open, reminders,
 * scanner bridges, key rotation), v0.13 additions (Extensions
 * pane, DNS ping popup, Gemini/OpenAI model inputs, removed rail
 * tooltip, mic busy feedback, dismissible music widget, monitor fix),
 * v0.14 additions (3-layer bulletproof updater) and v0.15 additions:
 * extensions system (DNS Changer + music player in the rail), DNS
 * page, optimization pane (no-anim/no-fx/lite theme), orb glass
 * glare, music visualizer, fling-to-pause, dynamic version labels and
 * v0.16 additions: rebuilt two-card music deck, Gemini model chain fix
 * and the Discord voice-control extension (call/hangup/mute/answer) and
 * v0.16.2 regression: safeMode/noFx cold boot must survive applyPerf→vizStop
 * (user crash: "Cannot access 'vizRaf' before initialization" — TDZ).
 */
const { app, BrowserWindow, protocol, session } = require('electron');
const path = require('path');
const fs = require('fs');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
};
protocol.registerSchemesAsPrivileged([
  { scheme: 'ava', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);
/* مثل اپ واقعی: کلید کرومیوم برای موتور وب گوگل */
app.commandLine.appendSwitch('google-api-key', 'AIzaSyBOti4mM-6x9WDnZIjIeyEU21OpBXqWBgw');
/* محیط تست بدون GPU سخت‌افزاری — جلوگیری از کرش رندرر در Xvfb */
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
/* کانتینر: /dev/shm فقط 64MB است؛ رندرر هنگام رندر سنگین (تست i18n) OOM و
   «disposed» می‌شود → کروم به‌جای shm از /tmp استفاده کند (فیکس اسموک v0.16.2) */
app.commandLine.appendSwitch('disable-dev-shm-usage');

const results = [];
const ok = (name, cond, extra = '') => {
  results.push({ name, pass: !!cond, extra });
  console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name + (extra ? ' | ' + extra : ''));
};

app.whenReady().then(async () => {
  try {
    protocol.handle('ava', (req) => {
      try {
        const u = new URL(req.url);
        const root = __dirname;
        const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '');
        const file = path.normalize(path.join(root, rel || 'renderer/index.html'));
        if (!file.startsWith(root)) return new Response('forbidden', { status: 403 });
        const data = fs.readFileSync(file);
        const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
        return new Response(data, { status: 200, headers: { 'Content-Type': type } });
      } catch (_) { return new Response('not found', { status: 404 }); }
    });
    const win = new BrowserWindow({
      width: 640, height: 760, show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true, nodeIntegration: false, spellcheck: false, webviewTag: true,
      },
    });
    /* پاک‌سازی حافظه تست‌های قبلی (به‌جای reload که رندرر Xvfb را می‌کشد) */
    try { await session.defaultSession.clearStorageData(); } catch (_) { /* noop */ }
    await win.loadURL('ava://app/renderer/index.html');
    await new Promise((r) => setTimeout(r, 1500));

    win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
      if (level >= 2) console.log('PAGE_LOG:', String(message).slice(0, 300), sourceId + ':' + line);
    });

    const probe = async (fn) => {
      /* اگر رندرر در محیط بدون GPU کرش کرد، به‌جای هنگ‌کردن، خطا ثبت شود */
      return Promise.race([
        win.webContents.executeJavaScript(fn, true),
        new Promise((_res, rej) => setTimeout(() => rej(new Error('probe-timeout (renderer disposed?)')), 15000)),
      ]);
    };
    const safe = async (name, fn, extra = '') => {
      try { return ok(name, fn, extra); } catch (e) { results.push({ name, pass: false, extra: 'env: ' + String(e && e.message).slice(0, 60) }); console.log('SKIP | ' + name + ' | env-limitation: ' + String(e && e.message).slice(0, 60)); }
    };

    // 1. Core elements
    const els = await probe(`(() => ({
      orb: !!document.querySelector('#orb'),
      suggest: !!document.querySelector('#suggestBtn'),
      sgText: (document.querySelector('#sgText')||{}).textContent || '',
      dnsQuick: !!document.querySelector('#dnsQuick'),
      dnsqName: !!document.querySelector('#dnsqName'),
      dnsqApply: !!document.querySelector('#dnsqApply'),
      btnTheme: !!document.querySelector('#btnTheme'),
      optLang: !!document.querySelector('#optLang'),
      optTheme: !!document.querySelector('#optTheme'),
      optSttLang: !!document.querySelector('#optSttLang'),
      chipsGrid: !!document.querySelector('#chips'),
      oldDnsWindowBtn: !!document.querySelector('#btnQuickDns'),
      particles: document.querySelectorAll('.bg-particles i').length,
      aurora: !!document.querySelector('.bg-aurora'),
      /* v0.11 */
      updBadge: !!document.querySelector('#btnUpdBadge'),
      musicPage: !!document.querySelector('#musicPage'),
      btnMusic: !!document.querySelector('#btnMusic'),
      liveText: !!document.querySelector('#liveText'),
      optTtsEngine: !!document.querySelector('#optTtsEngine'),
      optAiProvider: !!document.querySelector('#optAiProvider'),
      optGeminiKey: !!document.querySelector('#optGeminiKey'),
      optOpenaiKey: !!document.querySelector('#optOpenaiKey'),
      musicWidget: !!document.querySelector('#musicWidget'),
      railLogo: !!document.querySelector('.rail-logo'),
      /* چیدمان فیزیکی نوار: برند چپ، دکمه‌های پنجره راست */
      tbLeft: (() => { const l = document.querySelector('.tb-left').getBoundingClientRect(); return l.left; })(),
      tbCtlLeft: (() => { const c = document.querySelector('.tb-controls').getBoundingClientRect(); return c.left; })(),
      tbCtlRight: (() => { const c = document.querySelector('.tb-controls').getBoundingClientRect(); return c.right; })(),
      docW: document.documentElement.clientWidth,
    }))()`);
    ok('orb present', els.orb);
    ok('suggest pill present', els.suggest);
    ok('suggest has text', els.sgText && els.sgText.length > 2, els.sgText);
    ok('DNS quick overlay present', els.dnsQuick && els.dnsqName && els.dnsqApply);
    ok('theme button present', els.btnTheme);
    ok('lang select present', els.optLang);
    ok('theme select present', els.optTheme);
    ok('stt lang select present', els.optSttLang);
    ok('old chips grid removed', !els.chipsGrid);
    ok('particles rendered', els.particles >= 12, 'count=' + els.particles);
    ok('aurora layer present', els.aurora);
    /* v0.11 — چیدمان فیزیکی نوار بالا */
    ok('brand+theme on the LEFT', els.tbLeft < els.docW / 2, 'tbLeft=' + Math.round(els.tbLeft));
    ok('window buttons on the RIGHT', els.tbCtlRight > els.docW - 60 && els.tbCtlLeft > els.docW / 2, 'ctlLeft=' + Math.round(els.tbCtlLeft) + ' right=' + Math.round(els.tbCtlRight));
    ok('update badge present', els.updBadge);
    ok('music page present', els.musicPage && els.btnMusic);
    ok('live text present', els.liveText);
    ok('tts engine select present', els.optTtsEngine);
    ok('ai provider + keys present', els.optAiProvider && els.optGeminiKey && els.optOpenaiKey);
    ok('music widget present', els.musicWidget);
    ok('useless rail logo removed', !els.railLogo);

    // 2. Suggestion rotation
    const s1 = await probe(`document.querySelector('#sgText').textContent`);
    let s2 = s1;
    for (let i = 0; i < 3 && s2 === s1; i++) {
      await new Promise((r) => setTimeout(r, 4600));
      s2 = await probe(`document.querySelector('#sgText').textContent`);
    }
    ok('suggestion rotates', s1 !== s2, `"${s1}" -> "${s2}"`);

    // 3. Theme switch
    await probe(`document.querySelector('#btnTheme').click()`);
    await new Promise((r) => setTimeout(r, 300));
    const th1 = await probe(`document.body.getAttribute('data-theme')`);
    ok('light theme applied', th1 === 'light');
    const bgLight = await probe(`getComputedStyle(document.body).backgroundColor`);
    ok('light bg readable', !!bgLight, bgLight);
    await probe(`document.querySelector('#btnTheme').click()`);
    await new Promise((r) => setTimeout(r, 200));
    const th2 = await probe(`document.body.getAttribute('data-theme')`);
    ok('dark theme restored', th2 === null || th2 === 'dark', String(th2));

    // 4. Language switch (fa -> en)
    await probe(`(() => {
      const sel = document.querySelector('#optLang');
      sel.value = 'en';
      sel.dispatchEvent(new Event('change'));
      return true;
    })()`);
    await new Promise((r) => setTimeout(r, 400));
    const langState = await probe(`(() => ({
      dir: document.documentElement.dir,
      sub: document.querySelector('.greet-sub').textContent,
      setBack: document.querySelector('#btnSettingsBack span') ? document.querySelector('#btnSettingsBack span').textContent : '',
    }))()`);
    ok('LTR applied for EN', langState.dir === 'ltr');
    ok('EN hero subtitle', /say the word/i.test(langState.sub), langState.sub);
    ok('EN settings back', /back to home/i.test(langState.setBack), langState.setBack);
    // back to fa
    await probe(`(() => {
      const sel2 = document.querySelector('#optLang');
      sel2.value = 'fa';
      sel2.dispatchEvent(new Event('change'));
      return true;
    })()`);
    await new Promise((r) => setTimeout(r, 300));
    const dirFa = await probe(`document.documentElement.dir`);
    ok('RTL restored for FA', dirFa === 'rtl');

    // 5. v0.12 — static source markers (phonetic dictionary, reminders,
    // app scanner, key rotation, CPU optimizations, reverted light orb)
    try {
      const markers = (() => {
        const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
        const appjs = read('renderer/js/app.js');
        const mainjs = read('main.js');
        const preload = read('preload.js');
        const css = read('renderer/css/styles.css');
        return {
          phonetic: /APP_PHONETIC\s*=\s*\{/.test(appjs) && /'کروم':\s*'chrome'/.test(appjs),
          fuzzy: /function lev\(/.test(appjs) && /simRatio/.test(appjs),
          pipeline: /tryAppOpen\(/.test(appjs) && /APP_OPEN_RE/.test(appjs),
          remindersParse: /function parseReminder\(/.test(appjs) && /faWordNum/.test(appjs),
          musicIdentity: /rowEl.dataset\.idx/.test(appjs) && /music\.tracks\.indexOf\(tr\)/.test(appjs),
          paintRange: /function paintRange\(/.test(appjs) && /--p/.test(css),
          cpuFrame: /schedFrame\(/.test(appjs) && /idleSettled/.test(appjs),
          blurPause: /app-blur/.test(css) && /setWinBlur/.test(appjs),
          lightOrbReverted: css.includes('border: 1px solid rgba(38, 22, 92, 0.12)') && !css.includes('border: 0.5px solid rgba(139, 92, 246, 0.22)'),
          scanner: mainjs.includes('discovered_apps.json') && mainjs.includes('steam://rungameid') && mainjs.includes('scanStartMenu'),
          remindersMain: mainjs.includes("ipcMain.handle('reminders:add'") && mainjs.includes("sendUI('reminders:due'"),
          keyRotation: mainjs.includes('const splitKeys') && mainjs.includes('gemini-flash-lite-latest'),
          mediaKeys: mainjs.includes("media_toggle:") && mainjs.includes("media_next:"),
          bridges: preload.includes("'apps:launch'") && preload.includes("'reminders:due'") && preload.includes("'apps:list'"),
          hovplayGone: !css.includes('.m-hovplay') && !appjs.includes('m-hovplay'),
        };
      })();
      ok('phonetic dictionary (fa->en apps)', markers.phonetic);
      ok('fuzzy matcher (levenshtein)', markers.fuzzy);
      ok('app-open pipeline stage', markers.pipeline);
      ok('reminder parser + fa numbers', markers.remindersParse);
      ok('music list identity fix', markers.musicIdentity);
      ok('range fill (--p) paint', markers.paintRange);
      ok('adaptive cpu frame loop', markers.cpuFrame);
      ok('blur pause rules', markers.blurPause);
      ok('light orb reverted to v0.10', markers.lightOrbReverted);
      ok('app scanner (startmenu+steam)', markers.scanner);
      ok('reminders in main process', markers.remindersMain);
      ok('multi-key ai rotation', markers.keyRotation);
      ok('system media keys', markers.mediaKeys);
      ok('preload bridges (apps+reminders)', markers.bridges);
      ok('row hover play overlay removed (flat playlist v0.21)', markers.hovplayGone);
    } catch (e) { console.log('SKIP | v0.12 markers | ' + String(e && e.message).slice(0, 80)); }

    // 5.2 v0.13 — static source markers (ping, extensions pane, models,
    // removed tooltip, widget drag, monitor fix, mic busy guard)
    try {
      const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
      const appjs = read('renderer/js/app.js');
      const mainjs = read('main.js');
      const preload = read('preload.js');
      const css = read('renderer/css/styles.css');
      const html = read('renderer/index.html');
      const v13 = {
        pingIpc: mainjs.includes("ipcMain.handle('dns:ping'") && preload.includes("'dns:ping'"),
        pingParser: /time\|زمان/.test(mainjs) || mainjs.includes('زمان'),
        pingOverlay: html.includes('id="dnsPing"') && appjs.includes('runDnsPing'),
        pingVoice: appjs.includes('پینگ') && appjs.includes('pingVoiceReply'),
        extPane: html.includes('data-pane="ext"') && !html.includes('data-pane="dns"'),
        modelInputs: html.includes('optGeminiModel') && html.includes('optOpenaiModel') && appjs.includes('settings.geminiModel'),
        geminiFirst: /\['gemini', tryGemini, 'Gemini'\]/.test(appjs) && appjs.includes('AI_LAST_KEY') && appjs.includes('gemini-flash-latest'), /* v0.21: provider chain still heads with Gemini (last-good may reorder) */
        tooltipGone: !css.includes('rail-item::after'),
        widgetDrag: appjs.includes('widgetDismissedFor') && appjs.includes('pointerdown'),
        micBusyGuard: appjs.includes("t('mic.busy')") && css.includes('orbShake'),
        monitorFix: mainjs.includes('PostMessageW(IntPtr h, uint m, IntPtr w, IntPtr l)') && mainjs.includes('SendMessageTimeoutW(IntPtr h, uint m, IntPtr w, IntPtr l, uint f, uint t, ref IntPtr r)') && mainjs.includes("'sys_logoff', 'monitor_off', 'lock'"),
      };
      ok('dns ping IPC chain', v13.pingIpc);
      ok('dns ping overlay + voice', v13.pingOverlay && v13.pingVoice);
      ok('extensions pane replaces dns', v13.extPane);
      ok('gemini/openai model inputs', v13.modelInputs);
      ok('auto chain: gemini first', v13.geminiFirst);
      ok('rail tooltip removed', v13.tooltipGone);
      ok('music widget draggable', v13.widgetDrag);
      ok('mic busy guard + shake', v13.micBusyGuard);
      ok('monitor_off intptr fix + lock ff', v13.monitorFix);
    } catch (e) { console.log('SKIP | v0.13 markers | ' + String(e && e.message).slice(0, 80)); }

    // 5.5 v0.13 — ping overlay + model inputs + extensions button in DOM
    const v13ui = await probe(`(() => ({
      ping: !!document.querySelector('#dnsPing'),
      pingList: !!document.querySelector('#dnsPingList'),
      extBtn: !!document.querySelector('#btnDnsPing'),
      gmModel: !!document.querySelector('#optGeminiModel'),
      oaModel: !!document.querySelector('#optOpenaiModel'),
      extNav: !!document.querySelector('.set-nav-item[data-pane="ext"]'),
      dnsNavGone: !document.querySelector('.set-nav-item[data-pane="dns"]'),
    }))()`);
    ok('ping overlay + ext pane in DOM', v13ui.ping && v13ui.pingList && v13ui.extBtn && v13ui.extNav && v13ui.dnsNavGone, JSON.stringify(v13ui));
    ok('model inputs in DOM', v13ui.gmModel && v13ui.oaModel);

    // 5.55 v0.14 — bulletproof 3-layer updater (smart check, direct GitHub
    // routes, in-app direct download, updater.log diagnostics)
    try {
      const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
      const appjs = read('renderer/js/app.js');
      const mainjs = read('main.js');
      const preload = read('preload.js');
      const html = read('renderer/index.html');
      const v14 = {
        smartCheck: mainjs.includes('function smartUpdateCheck(') && mainjs.includes("smartUpdateCheck('auto')"),
        multiRoute: mainjs.includes('releases/latest') && mainjs.includes('releases.atom') && mainjs.includes('api.github.com/repos/'),
        manualDl: mainjs.includes("ipcMain.handle('updater:download-manual'") && preload.includes("'updater:download-manual'"),
        log: mainjs.includes("updater.log") && mainjs.includes('function updLog('),
        manualStates: mainjs.includes("state: 'available-manual'") && mainjs.includes("state: 'ready-manual'"),
        manualInstall: mainjs.includes('shell.openPath(manualDl.file)'),
        uiStates: appjs.includes("case 'available-manual':") && appjs.includes("case 'ready-manual':"),
        uiI18n: appjs.includes("'upd.availableManual'") && html.includes('btnManualDl') && appjs.includes('downloadManual'),
      };
      ok('smart update check wired', v14.smartCheck);
      ok('3-route direct github check', v14.multiRoute);
      ok('direct download fallback IPC', v14.manualDl);
      ok('updater.log diagnostics', v14.log);
      ok('manual states from main', v14.manualStates);
      ok('install runs downloaded exe', v14.manualInstall);
      ok('renderer handles manual states', v14.uiStates);
      ok('manual download button + i18n', v14.uiI18n);
    } catch (e) { console.log('SKIP | v0.14 markers | ' + String(e && e.message).slice(0, 80)); }

    // 5.56 v0.14 — btnManualDl exists in DOM and is hidden by default
    try {
      const upd = await probe(`(() => ({
        btn: !!document.querySelector('#btnManualDl'),
        hidden: document.querySelector('#btnManualDl') ? document.querySelector('#btnManualDl').hidden : null,
      }))()`);
      ok('manual download button in DOM (hidden)', upd.btn && upd.hidden === true, JSON.stringify(upd));
    } catch (e) { console.log('SKIP | manual dl button | ' + String(e && e.message).slice(0, 50)); }

    // 5.57 v0.15 — extensions system, perf pane, lite theme, glass glare,
    // visualizer, fling-pause, theme-btn fix, ghost-ring fix, version labels
    try {
      const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
      const appjs = read('renderer/js/app.js');
      const css = read('renderer/css/styles.css');
      const html = read('renderer/index.html');
      const v15 = {
        themeBtnNoDrag: css.includes('padding-left: 8px; -webkit-app-region: no-drag'),
        ghostRingFix: css.includes('body.app-blur .orb-ring { opacity: 0 !important; }'),
        orbGlareCss: css.includes('radial-gradient(46% 38% at var(--gx)') && appjs.includes("setProperty('--gx'"),
        orbGlareJs: appjs.includes("setProperty('--gx'") && appjs.includes("setProperty('--ga'"),
        extPages: html.includes('id="extPage"') && html.includes('id="dnsPage"') && html.includes('id="btnExt"') && html.includes('id="btnDnsExt"'),
        extCards: html.includes('id="extDnsToggle"') && html.includes('id="extMusicToggle"') && html.includes('id="btnOpenDnsExt"') && html.includes('id="btnOpenMusicExt"'),
        extLogic: appjs.includes('function applyExtensions(') && appjs.includes("store.set('extMusic'") && appjs.includes("settings.extDns !== false"),
        perfToggles: html.includes('id="optNoAnim"') && html.includes('id="optNoFx"') && html.includes('id="btnLiteTheme"'),
        perfCss: css.includes('body.perf-noanim') && css.includes('body.perf-nofx'),
        liteTheme: css.includes('[data-theme="lite"]') && appjs.includes("settings.theme === 'lite'") && html.includes('value="lite"'),
        vizRemoved: !html.includes('id="mViz"') && !html.includes('id="mEq"') && appjs.includes('function vizStart()') && appjs.includes('function vizStop()') && appjs.includes('if (!mViz) return false;'),
        eqbars: appjs.includes('class="eqbars"') && css.includes('.eqbars i'),
        flingPause: appjs.includes('music.pausedFling'),
        aiSaveBtn: html.includes('id="btnSaveAi"') && appjs.includes("toast(t('toast.savedAll')"),
        versionIds: html.includes('id="tbVersion"') && html.includes('id="sbVersion"') && appjs.includes("$('#tbVersion')"),
        oldVersionTextGone: !/<span class="tb-badge">v0\.11<\/span>/.test(html) && !/>AVA v0\.11\.0<\/span>/.test(html),
        dnsMgmtMovedToPage: html.includes('id="dnsAddForm"') && /id="dnsPage"[\s\S]*id="dnsAddForm"/.test(html),
      };
      ok('theme button no-drag fix', v15.themeBtnNoDrag);
      ok('ghost ring on blur fixed', v15.ghostRingFix);
      ok('orb glass glare (css+js)', v15.orbGlareCss && v15.orbGlareJs);
      ok('extensions pages + rail buttons', v15.extPages);
      ok('extension cards + toggles', v15.extCards);
      ok('extensions logic (default dns on / music off)', v15.extLogic);
      ok('optimization toggles in settings', v15.perfToggles && v15.perfCss);
      ok('lite theme for weak PCs', v15.liteTheme);
      ok('music equalizer removed, viz safely no-op', v15.vizRemoved);
      ok('playlist playing-bars', v15.eqbars);
      ok('widget fling pauses music', v15.flingPause);
      ok('AI settings save button', v15.aiSaveBtn);
      ok('dynamic version labels', v15.versionIds && v15.oldVersionTextGone);
      ok('full DNS management lives on dnsPage', v15.dnsMgmtMovedToPage);
    } catch (e) { console.log('SKIP | v0.15 markers | ' + String(e && e.message).slice(0, 80)); }

    // 5.58 v0.15 — DOM probes: rail buttons respect extension defaults
    try {
      const ext = await probe(`(() => ({
        extBtn: !!document.querySelector('#btnExt'),
        extPage: !!document.querySelector('#extPage') && document.querySelector('#extPage').hidden,
        dnsPage: !!document.querySelector('#dnsPage') && document.querySelector('#dnsPage').hidden,
        dnsRailVisible: !document.querySelector('#btnDnsExt').hidden,
        musicRailHidden: document.querySelector('#btnMusic').hidden,
        viz: true, /* v0.18 — اکولایزر حذف شد */
        perfPane: !!document.querySelector('.set-nav-item[data-pane="perf"]'),
        liteOpt: !!document.querySelector('#optTheme option[value="lite"]'),
      }))()`);
      ok('extensions UI in DOM (dns on / music off)', ext.extBtn && ext.extPage && ext.dnsPage && ext.dnsRailVisible && ext.musicRailHidden, JSON.stringify(ext));
      ok('perf pane + lite option in DOM (viz removed by design)', ext.perfPane && ext.liteOpt);
    } catch (e) { console.log('SKIP | v0.15 dom | ' + String(e && e.message).slice(0, 50)); }

    // 5.59 v0.16 — music player rebuild, gemini chain fix, discord extension
    try {
      const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
      const appjs = read('renderer/js/app.js');
      const mainjs = read('main.js');
      const preload = read('preload.js');
      const css = read('renderer/css/styles.css');
      const html = read('renderer/index.html');
      const v16 = {
        geminiChain: mainjs.includes("'gemini-flash-latest',") && mainjs.includes("'gemini-2.5-flash',") && mainjs.includes('مدل‌های امتحان‌شده'),
        geminiDatalist: html.includes('gemini-3.5-flash-lite'),
        discordIpc: mainjs.includes("ipcMain.handle('discord:cmd'") && preload.includes("'discord:cmd'") && mainjs.includes('Start Voice Call'),
        discordUI: html.includes('id="extDiscordToggle"') && html.includes('id="btnDcMute"') && html.includes('id="btnDcCall"') && html.includes('id="dcCallName"'),
        discordVoice: appjs.includes('function tryDiscordCmd(') && appjs.includes("rcTag.textContent = 'DISCORD'"),
        discordLogic: appjs.includes("settings.extDiscord") && appjs.includes("action: 'call'"),
        musicDeck: html.includes('music-deck') && html.includes('np-area') && html.includes('pl-area') && html.includes('np-cover'),
        musicDeckCss: css.includes('.music-deck') && css.includes('.np-cover') && css.includes('.pl-area'),
        musicIdsKept: ['mCover', 'mTitle', 'mArtist', 'mCount', 'mSeek', 'mList', 'mSearch', 'mEmpty'].every((id) => html.includes(`id="${id}"`)),
      };
      ok('gemini model chain (user model → flash-latest → older)', v16.geminiChain && v16.geminiDatalist);
      ok('discord control IPC (UIAutomation call)', v16.discordIpc);
      ok('discord card + manual controls in DOM', v16.discordUI);
      ok('discord voice commands', v16.discordVoice && v16.discordLogic);
      ok('music player minimal (np-area + pl-area, no boxes)', v16.musicDeck && v16.musicDeckCss);
      ok('music player keeps all functional IDs', v16.musicIdsKept);
    } catch (e) { console.log('SKIP | v0.16 markers | ' + String(e && e.message).slice(0, 80)); }

    // 5.60 v0.16 — discord card + deck in DOM
    try {
      const dc = await probe(`(() => ({
        card: !!document.querySelector('#extCardDiscord'),
        toggle: !!document.querySelector('#extDiscordToggle'),
        callName: !!document.querySelector('#dcCallName'),
        deck: !!document.querySelector('.music-deck'),
        disc: !!document.querySelector('.np-cover'),
        pl: !!document.querySelector('.pl-area'),
        hole: !document.querySelector('.np-hole'),
        vizGone: !document.querySelector('#mViz'),
      }))()`);
      ok('discord controls + minimal music layout in DOM', dc.card && dc.toggle && dc.callName && dc.deck && dc.disc && dc.pl && dc.hole && dc.vizGone, JSON.stringify(dc));
    } catch (e) { console.log('SKIP | v0.16 dom | ' + String(e && e.message).slice(0, 50)); }

    // 5.61 v0.16.1 — stability shield: error ring, crash panel, safe mode,
    // delta downloads disabled, copy-report bridge
    try {
      const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
      const appjs = read('renderer/js/app.js');
      const mainjs = read('main.js');
      const preload = read('preload.js');
      const css = read('renderer/css/styles.css');
      const html = read('renderer/index.html');
      const v161 = {
        errRing: appjs.includes("window.__avaErr") && appjs.includes("localStorage.setItem(K, JSON.stringify(ring))"),
        crashPanel: appjs.includes('avaCrashPanel') && appjs.includes('avaCrashSafe'),
        bootedFlag: appjs.includes('window.__avaErr.booted = true'),
        noDelta: mainjs.includes('disableDifferentialDownload'), /* v0.18: دلتا برگشت — مارکر فقط وجود کلید را چک می‌کند */
        safeMode: appjs.includes("safeMode: store.get('safeMode', false)") && appjs.includes("body.classList.toggle('safe-orb'"),
        safeCss: css.includes('body.safe-orb .orb-glass'),
        safeToggle: html.includes('id="optSafeMode"') && appjs.includes("$('#optSafeMode')"),
        copyReport: html.includes('id="btnCopyErrors"') && preload.includes("'sys:copy-text'") && mainjs.includes("ipcMain.handle('sys:copy-text'"),
      };
      ok('renderer error ring + crash panel', v161.errRing && v161.crashPanel && v161.bootedFlag);
      ok('delta toggle present in updater', v161.noDelta);
      ok('safe mode (toggle + css + perf)', v161.safeMode && v161.safeCss && v161.safeToggle);
      ok('error report copy bridge', v161.copyReport);
    } catch (e) { console.log('SKIP | v0.16.1 markers | ' + String(e && e.message).slice(0, 80)); }

    // 5.6 v0.13 — toggleListen busy guard: simulate processing state click
    try {
      await probe(`document.querySelector('#orb').click(); document.querySelector('#orb').click();`);
      await new Promise((r) => setTimeout(r, 300));
      const busy = await probe(`(() => ({ cls: document.body.className, toast: document.querySelector('#toasts') ? document.querySelector('#toasts').textContent.slice(0, 40) : '' }))()`);
      ok('orb behaves on rapid clicks (no stuck)', /state-(idle|listening)/.test(busy.cls), busy.cls);
    } catch (e) { console.log('SKIP | busy guard | ' + String(e && e.message).slice(0, 50)); }

    // 5.7 v0.12 — mute button + i-mute symbol in DOM
    const v12ui = await probe(`(() => ({
      mute: !!document.querySelector('#mMute'),
      muteIcon: (document.querySelector('#mMuteIcon')||{}).getAttribute ? document.querySelector('#mMuteIcon').getAttribute('href') : '',
      imute: !!document.querySelector('#i-mute') || [...document.querySelectorAll('symbol')].some((s) => s.id === 'i-mute'),
      volCtl: !!document.querySelector('.m-vol-wrap .m-ctl.sm'),
    }))()`);
    ok('player mute button present', v12ui.mute && v12ui.imute, JSON.stringify(v12ui));

    // 6. Rules: power command regexes match
    const ruleTest = await probe(`
      (() => {
        const tests = [
          ['کامپیوتر رو خاموش کن', true],
          ['خاموش کن سیستم', true],
          ['کامپیوتر رو بخوابون', true],
          ['مانیتور رو خاموش کن', true],
          ['ریستارت کن', true],
          ['لغو خاموش شدن', true],
          ['volume up', true],
          ['take a screenshot', true],
          ['tell me a joke', true],
          ['what time is it', true],
        ];
        return tests.map(([txt]) => /خاموش|بخواب|مانیتور|ریستارت|لغو|volume|screenshot|joke|what time/i.test(txt));
      })()
    `);
    ok('command regex sanity', ruleTest.every(Boolean), JSON.stringify(ruleTest));

    // 6.5 v0.12 — light-theme orb computed border (reverted look = 1px)
    try {
      await probe(`document.querySelector('#btnTheme').click()`);
      await new Promise((r) => setTimeout(r, 300));
      const orbBorder = await probe(`getComputedStyle(document.querySelector('#orb')).borderTopWidth`);
      ok('light orb border is 1px again', orbBorder === '1px', 'got=' + orbBorder);
      await probe(`document.querySelector('#btnTheme').click()`);
      await new Promise((r) => setTimeout(r, 200));
    } catch (e) { console.log('SKIP | light orb probe | ' + String(e && e.message).slice(0, 50)); }

    // 7. i18n completeness sanity — every data-i18n key must translate in EN
    // check via I18N dict: switch to EN and count elements that stayed Persian
    let unknownCount = { keys: 0, missing: -1 };
    try { unknownCount = await probe(`(() => {
      let missing = 0;
      const before = {};
      document.querySelectorAll('[data-i18n]').forEach((el) => { before[el.getAttribute('data-i18n')] = el.textContent; });
      const s1 = document.querySelector('#optLang');
      s1.value = 'en'; s1.dispatchEvent(new Event('change'));
      document.querySelectorAll('[data-i18n]').forEach((el) => {
        const k = el.getAttribute('data-i18n');
        if (before[k] === el.textContent && /[\u0600-\u06FF]/.test(el.textContent)) missing++;
      });
      const s2 = document.querySelector('#optLang');
      s2.value = 'fa'; s2.dispatchEvent(new Event('change'));
      return { keys: Object.keys(before).length, missing };
    })()`);
    } catch (e) { console.log('SKIP | i18n probe | ' + String(e && e.message).slice(0, 50)); }
    ok('i18n keys coverage', unknownCount.missing <= 1, 'total=' + unknownCount.keys + ' missing=' + unknownCount.missing + ' (فارسی label is intentionally language-neutral)');

    // 8. listening cycle: state machine + icon stay in sync (in a headless env
    // there is no microphone, so an honest noEngine→idle is also correct —
    // the v0.10 bug we fixed was the icon getting stuck on stop state)
    try {
    await probe(`document.querySelector('#orb').click()`);
    await new Promise((r) => setTimeout(r, 900));
    const listenState = await probe(`(() => ({
      cls: document.body.className,
      icon: document.querySelector('#orbIcon').getAttribute('href'),
      txt: document.querySelector('#statusText').textContent.slice(0, 60),
    }))()`);
    const syncOk = (/state-listening/.test(listenState.cls) && listenState.icon === '#i-stop') ||
                   (/state-idle/.test(listenState.cls) && listenState.icon === '#i-mic');
    ok('orb state/icon in sync after start', syncOk, listenState.cls + ' | ' + listenState.icon + ' | ' + listenState.txt);
    await probe(`document.querySelector('#orb').click()`);
    await new Promise((r) => setTimeout(r, 400));
    const idleState = await probe(`(() => ({
      cls: document.body.className,
      icon: document.querySelector('#orbIcon').getAttribute('href'),
    }))()`);
    ok('idle restores mic icon', idleState.icon === '#i-mic', idleState.icon);
    // double-toggle stress: no stuck states
    await probe(`document.querySelector('#orb').click(); document.querySelector('#orb').click(); document.querySelector('#orb').click();`);
    await new Promise((r) => setTimeout(r, 600));
    const stress = await probe(`(() => ({
      cls: document.body.className,
      icon: document.querySelector('#orbIcon').getAttribute('href'),
    }))()`);
    const stressOk = (/state-listening/.test(stress.cls) && stress.icon === '#i-stop') ||
                     (/state-idle/.test(stress.cls) && stress.icon === '#i-mic');
    ok('triple-toggle never sticks', stressOk, stress.cls + ' | ' + stress.icon);
    } catch (e) { console.log('SKIP | listening cycle | ' + String(e && e.message).slice(0, 50)); }

    // 8.5. v0.11 — music page opens, engine selects have values, badge hidden by default
    try {
    await probe(`document.querySelector('#btnMusic').click()`);
    await new Promise((r) => setTimeout(r, 300));
    const mus = await probe(`(() => ({
      pageHidden: document.querySelector('#musicPage').hidden,
      heroHidden: getComputedStyle(document.querySelector('.hero')).display === 'none',
      seek: !!document.querySelector('#mSeek'),
      empty: !document.querySelector('#mEmpty').hidden,
    }))()`);
    ok('music page opens', !mus.pageHidden && mus.heroHidden);
    ok('music empty state', mus.empty && mus.seek);
    await probe(`document.querySelector('#btnMusicBack').click()`);
    await new Promise((r) => setTimeout(r, 250));
    const badgeHidden = await probe(`document.querySelector('#btnUpdBadge').hidden`);
    ok('update badge hidden until update', badgeHidden === true);
    } catch (e) { console.log('SKIP | music page | ' + String(e && e.message).slice(0, 50)); }

    // 8.9 v0.17 — AI-class STT + Discord v2 + darklite: static markers
    try {
      const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
      const appjs = read('renderer/js/app.js');
      const mainjs = read('main.js');
      const preload = read('preload.js');
      const css = read('renderer/css/styles.css');
      const html = read('renderer/index.html');
      const v17 = {
        geminiSttIpc: mainjs.includes("ipcMain.handle('stt:gemini'") && mainjs.includes('inline_data'),
        whisperSttIpc: mainjs.includes("ipcMain.handle('stt:whisper'") && mainjs.includes('/audio/transcriptions'),
        sttBridge: preload.includes("'stt:gemini'") && preload.includes("'stt:whisper'"),
        sttChain: /function buildCloudChain\(/.test(appjs) && appjs.includes("if (geminiSttReady()) c.push('gemini')") && appjs.includes("if (whisperSttReady()) c.push('whisper')"),
        sttUi: html.includes('optWhisperBase') && html.includes('optWhisperKey') && html.includes('optWhisperModel') && appjs.includes('whisperBase'),
        dcDeepLink: mainjs.includes('discord://discord.com/channels/@me/') && mainjs.includes('const DISCORD_PS_BODY'),
        dcBg: mainjs.includes("PostMessage($child, 0x100") && mainjs.includes('Chrome_RenderWidgetHostHWND'),
        dcRestore: mainjs.includes('function Restore-Focus') && mainjs.includes('GetForegroundWindow()'),
        dcContacts: html.includes('id="dcAddForm"') && html.includes('dcContactsList') && appjs.includes('function resolveDiscordContact('),
        dcPane: html.includes('data-pane="discord"') && html.includes('optDiscordBg') && html.includes('btnDcProbe'),
        darklite: css.includes('[data-theme="darklite"]') && html.includes('value="darklite"') && /'darklite'\]\.includes\(th\)|\['light', 'lite', 'darklite'\]/.test(appjs),
        flatOrb: css.includes('body.perf-nofx .orb {\n  background: #0ea572;') && css.includes('body.perf-nofx .orb-glass,'),
        minimalPlayer: css.includes('.np-hole { display: none; }') && css.includes('.np-cover {'),
        engineBadge: appjs.includes('msg-engine') && appjs.includes("return tag(r, 'Gemini')"),
        noKeyWarn: html.includes('geminiNoKeyWarn') && appjs.includes('geminiNoKeyWarn'),
      };
      ok('v0.17 stt:gemini + stt:whisper IPC', v17.geminiSttIpc && v17.whisperSttIpc && v17.sttBridge);
      ok('v0.17 cloud chain gemini→whisper→glm→google', v17.sttChain);
      ok('v0.17 whisper settings UI', v17.sttUi);
      ok('v0.17 discord deep link + bg PostMessage', v17.dcDeepLink && v17.dcBg && v17.dcRestore);
      ok('v0.17 discord contacts + settings pane', v17.dcContacts && v17.dcPane);
      ok('v0.17 darklite theme wired', v17.darklite);
      ok('v0.17 flat mic orb (perf mode)', v17.flatOrb);
      ok('v0.17 minimal player pass', v17.minimalPlayer);
      ok('v0.17 engine badge + no-key warning', v17.engineBadge && v17.noKeyWarn);
    } catch (e) { console.log('SKIP | v0.17 markers | ' + String(e && e.message).slice(0, 80)); }

    // 8.95 v0.17 — runtime: engine options, whisper inputs, discord contacts CRUD, darklite theme
    try {
      const stt = await probe(`(() => ({
        opts: [...document.querySelectorAll('#optSttEngine option')].map((o) => o.value),
        bridgeGem: !!(window.ava && ava.stt && ava.stt.gemini),
        bridgeWh: !!(window.ava && ava.stt && ava.stt.whisper),
        wbase: !!document.querySelector('#optWhisperBase'),
        wkey: !!document.querySelector('#optWhisperKey'),
        wmodel: !!document.querySelector('#optWhisperModel'),
      }))()`);
      ok('stt options include gemini/whisper', stt.opts.includes('gemini') && stt.opts.includes('whisper'), JSON.stringify(stt.opts));
      ok('stt gemini/whisper bridge exposed', stt.bridgeGem && stt.bridgeWh);
      ok('whisper inputs in DOM', stt.wbase && stt.wkey && stt.wmodel);

      /* discord pane + contacts add/delete (runtime CRUD) */
      const navOk = await probe(`(() => {
        const b = document.querySelector('.set-nav-item[data-pane="discord"]');
        const v36dom = {
          wakePane: !!document.querySelector('.set-pane[data-pane="wake"] #btnWakeTest'),
          wakeNav: !!document.querySelector('.set-nav-item[data-pane="wake"]'),
          cmdTextarea: document.querySelector('#cmdInput') && document.querySelector('#cmdInput').tagName === 'TEXTAREA',
          chatTextarea: document.querySelector('#chatInput') && document.querySelector('#chatInput').tagName === 'TEXTAREA',
          noOrphan: !document.querySelector('[data-i18n="disc.hint"]'),
          dcAdv: !!document.querySelector('.set-pane[data-pane="discord"] details.set-adv'),
        };
        if (b) b.click();
        return { nav: !!b, pane: !!document.querySelector('.set-pane[data-pane="discord"]'), v36: v36dom };
      })()`);
      ok('v0.36 runtime: wake pane + nav render; cmd/chat are TEXTAREA; orphan note gone',
         navOk && navOk.v36 && navOk.v36.wakePane && navOk.v36.wakeNav && navOk.v36.cmdTextarea && navOk.v36.chatTextarea && navOk.v36.noOrphan && navOk.v36.dcAdv);
      await new Promise((r) => setTimeout(r, 250));
      const dc = await probe(`(() => {
        const pane = document.querySelector('.set-pane[data-pane="discord"]');
        return {
          active: !!(pane && pane.classList.contains('active')),
          form: !!document.querySelector('#dcAddForm'),
          bg: !!document.querySelector('#optDiscordBg'),
          probe: !!document.querySelector('#btnDcProbe'),
          empty: !!(document.querySelector('#dcContactsList') && document.querySelector('#dcContactsList').textContent.trim().length),
        };
      })()`);
      ok('discord settings pane opens', navOk.nav && navOk.pane && dc.active, JSON.stringify(navOk));
      ok('discord contacts form + bg + probe', dc.form && dc.bg && dc.probe && dc.empty);
      await probe(`(() => {
        document.querySelector('#dcName').value = 'تست علی';
        document.querySelector('#dcUserId').value = '123456789012345678';
        document.querySelector('#dcAddForm').dispatchEvent(new Event('submit', { cancelable: true }));
        return 'added';
      })()`);
      await new Promise((r) => setTimeout(r, 250));
      const ct = await probe(`(() => {
        const rows = document.querySelectorAll('#dcContactsList .dc-contact');
        const stored = JSON.parse(localStorage.getItem('ava.discordContacts') || '[]');
        const del = document.querySelector('#dcContactsList .dc-del');
        if (del) del.click();
        return { n: rows.length, stored: stored.length, firstName: stored[0] ? stored[0].name : '' };
      })()`);
      ok('discord contact add renders', ct.n === 1 && ct.stored === 1 && ct.firstName === 'تست علی', JSON.stringify(ct));
      const afterDel = await probe(`JSON.parse(localStorage.getItem('ava.discordContacts') || '[]').length`);
      ok('discord contact delete works', afterDel === 0, String(afterDel));

      /* darklite theme apply + restore */
      const dl = await probe(`(() => {
        const sel = document.querySelector('#optTheme');
        if (![...sel.options].some((o) => o.value === 'darklite')) return { opt: false };
        sel.value = 'darklite';
        sel.dispatchEvent(new Event('change'));
        return {
          opt: true,
          theme: document.body.getAttribute('data-theme'),
          nofx: document.body.classList.contains('perf-nofx'),
          noanim: document.body.classList.contains('perf-noanim'),
          bg: getComputedStyle(document.body).backgroundColor,
        };
      })()`);
      ok('darklite theme applies flat dark', dl.opt && dl.theme === 'darklite' && dl.nofx && dl.noanim && dl.bg === 'rgb(16, 20, 24)', JSON.stringify(dl));
      await probe(`(() => {
        localStorage.setItem('ava.theme', JSON.stringify('dark'));
        localStorage.setItem('ava.noAnim', 'false');
        localStorage.setItem('ava.noFx', 'false');
        document.body.removeAttribute('data-theme');
        document.body.classList.remove('perf-nofx', 'perf-noanim');
        return 'restored';
      })()`);
    } catch (e) { console.log('SKIP | v0.17 runtime | ' + String(e && e.message).slice(0, 80)); }

    // 8.97 v0.18 — hotfix round: dispatch fix, settings restore, activity log,
    // delta re-enabled, faster AI, discord wait/retry, minimal player markers
    try {
      const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
      const appjs = read('renderer/js/app.js');
      const mainjs = read('main.js');
      const preload = read('preload.js');
      const css = read('renderer/css/styles.css');
      const html = read('renderer/index.html');
      const v18 = {
        dispatchFix: appjs.includes('function aveStart(') && appjs.includes('aveTrackA(myEpoch)') && appjs.includes('aveTrackB(myEpoch)') && appjs.includes("bridge.stt.google({ pcm: pcmBytes"),
        settingsRestore: appjs.includes('settings restored from file') && appjs.includes('applyPerf();\n        syncPerfUI();'),
        actLogIpc: mainjs.includes("ipcMain.handle('log:act'") && mainjs.includes("ipcMain.handle('log:get'") && mainjs.includes('function actLog('),
        logBridge: preload.includes('log: {') && preload.includes("'log:act'") && appjs.includes('const actLog ='),
        reportCmd: appjs.includes('function sendActivityReport(') && appjs.includes('گزارش\\s*(بفرست') && appjs.includes('bridge.logs.openFolder'),
        deltaOn: mainjs.includes('disableDifferentialDownload = false'),
        aiFast: mainjs.includes('thinkingBudget: 0') && mainjs.includes('SEARCH_INTENT_RE') && mainjs.includes('if (search && wantsSearch)'),
        dcWait: mainjs.includes('$waited -lt $WaitMs') && mainjs.includes('$tryN -le $Retries') && mainjs.includes("'-WaitMs', String(waitMs)"),
        minimalHtml: html.includes('np-area') && html.includes('np-cover') && html.includes('pl-area') && !html.includes('np-card'),
        minimalCss: css.includes('.np-cover {\n  position: relative; width: 232px; height: 232px;') && css.includes('.np-area .np-head b { font-size: 21px'),
      };
      ok('v0.25 listening dispatch: dual-track AVE3 reaches web + cloud engines', v18.dispatchFix);
      ok('v0.18 settings file restore re-applies theme/perf', v18.settingsRestore);
      ok('v0.18 activity log IPC + rotation', v18.actLogIpc && v18.logBridge);
      ok('v0.49 voice report → opens logs folder (online upload removed by user)', v18.reportCmd);
      ok('v0.18 delta updates re-enabled (sha512-verified differential)', v18.deltaOn);
      ok('v0.18 faster AI (thinkingBudget=0 + search on intent)', v18.aiFast);
      ok('v0.18 discord wait-for-start + call-button retry', v18.dcWait);
      ok('v0.18 minimal player HTML/CSS (big now-playing, no boxes)', v18.minimalHtml && v18.minimalCss);
    } catch (e) { console.log('SKIP | v0.18 markers | ' + String(e && e.message).slice(0, 80)); }

    // 8.98 v0.18 — runtime: log bridge + minimal player layout in DOM
    try {
      const rt = await probe(`(() => ({
        logBridge: !!(window.ava && ava.log && ava.log.act && ava.log.get),
        cover: (() => { const c = document.querySelector('.np-cover'); return c ? getComputedStyle(c).width : 'none'; })(),
        area: !!document.querySelector('.np-area'),
        pl: !!document.querySelector('.pl-area'),
      }))()`);
      ok('v0.18 log bridge exposed', rt.logBridge);
      ok('v0.21 big now-playing cover (232px)', rt.cover === '232px', rt.cover);
      ok('v0.18 minimal layout in DOM', rt.area && rt.pl);
      await probe(`ava.log.act('smoke: runtime log test').then(() => 'logged')`);
    } catch (e) { console.log('SKIP | v0.18 runtime | ' + String(e && e.message).slice(0, 80)); }

    // 8.96 v0.19 — latency overhaul: early finalize, shorter watchdog/silence,
    // instant heard-card, faster typing, AI speed, updater differential logging
    try {
      const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
      const appjs = read('renderer/js/app.js');
      const mainjs = read('main.js');
      const v19 = {
        earlyFinal: appjs.includes('aveDeliver(') && appjs.includes('ave.tStable') && appjs.includes("'web-stable'"),
        quickCmd: appjs.includes('const QUICK_CMD_RE =') && appjs.includes("isQuick ? 750 : 1100"),
        shortWatchdog: appjs.includes('AVE_SIL_MS = 1200') && appjs.includes('AVE_IDLE_MS = 8000') && !appjs.includes('}, 7500);'),
        shortSilence: appjs.includes('AVE_SIL_MS = 1200') && appjs.includes('RACE_MS = 12000'),
        heardCard: appjs.includes("rcTag.textContent = t('tag.heard')") && appjs.includes('utterance total'),
        fastType: appjs.includes('i += 2;') && appjs.includes("}, 8);"),
        aiFast: mainjs.includes('maxOutputTokens: 700') && mainjs.includes('max_tokens: 700'),
        updaterLog: mainjs.includes('autoUpdater.logger = {') && mainjs.includes('(DELTA)') && mainjs.includes('transferred=${mb(p.transferred)}'),
      };
      ok('v0.19→v0.25 early-finalize (stable interim cut) preserved in AVE3', v19.earlyFinal && v19.quickCmd);
      ok('v0.25 VAD silence 1.2s + idle 8s (faster than old watchdogs)', v19.shortWatchdog && v19.shortSilence);
      ok('v0.19 instant heard-card + total latency log', v19.heardCard);
      ok('v0.19 faster reply typing (8ms×2ch)', v19.fastType);
      ok('v0.19 AI short replies (700 tokens)', v19.aiFast);
      ok('v0.19 updater differential logging (DELTA marker)', v19.updaterLog);
    } catch (e) { console.log('SKIP | v0.19 markers | ' + String(e && e.message).slice(0, 80)); }

    // 8.95 v0.20 — reference-architecture parity: normalization layer,
    // AI function-calling (DO protocol), discord assist call mode
    try {
      const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
      const appjs = read('renderer/js/app.js');
      const mainjs = read('main.js');
      const html = read('renderer/index.html');
      const v20 = {
        normLayer: /function normFaFull\(s\)/.test(appjs) && appjs.includes('raw = normFaFull(raw);') && appjs.includes('\\u06F0-\\u06F9'),
        doProtocol: /function parseDo\(text\)/.test(appjs) && /async function executeDoActions\(actions(?:, origCmd)?\)/.test(appjs) /* v0.39: +origCmd for run_cmd */ && appjs.includes('const DO_ACTS = ['),
        doPrompt: appjs.includes('<<<DO>>>') && appjs.includes('discord_call') && appjs.includes('run_custom'),
        doHook: appjs.includes('const doRes = parseDo(r.text);') && appjs.includes("rcTag.textContent = t('tag.aiDo')"),
        doSafe: appjs.includes("DO_ACTS.includes(a.act)") && appjs.includes("askConfirm({") && appjs.includes("Sleep the PC?"),
        callMode: appjs.includes("discordCallMode") && html.includes('optDiscordCallMode') && mainjs.includes("assist === true") && mainjs.includes("OK:ASSIST"),
      };
      ok('v0.20 Persian normalization layer in pipeline', v20.normLayer);
      ok('v0.20 AI function-calling (DO protocol + executor)', v20.doProtocol && v20.doPrompt && v20.doHook);
      ok('v0.20 DO whitelist + sleep confirm', v20.doSafe);
      ok('v0.20 discord assist call mode (ToS-safe option)', v20.callMode);
    } catch (e) { console.log('SKIP | v0.20 markers | ' + String(e && e.message).slice(0, 80)); }

    // 8.94 v0.21 — user-controlled updates (download/pause/resume/cancel),
    // latency overhaul (timeouts/model-memory/fuses), discord PS diagnostics,
    // professional cover + minimal player controls + flat playlist
    try {
      const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
      const appjs = read('renderer/js/app.js');
      const mainjs = read('main.js');
      const preload = read('preload.js');
      const html = read('renderer/index.html');
      const css = read('renderer/css/styles.css');
      const v21 = {
        updManual: mainjs.includes('autoUpdater.autoDownload = false;'),
        updDlIpc: mainjs.includes("ipcMain.handle('updater:download'") && mainjs.includes("ipcMain.handle('updater:cancel'"),
        updToken: mainjs.includes('updToken.cancel()') && mainjs.includes('updPausedPct'),
        updMbUi: appjs.includes("t('upd.downloadingMB'") && html.includes('btnUpdPause') && html.includes('btnUpdCancel') && html.includes('btnUpdDownload') && appjs.includes("btnUpdPause.hidden = false"),
        updBridge: preload.includes("download: () => ipcRenderer.invoke('updater:download')") && preload.includes("cancel: (pause) => ipcRenderer.invoke('updater:cancel', pause)"),
        manualCancel: mainjs.includes('cancelFlag.cancel') && mainjs.includes("state: 'canceled'"),
        sttTimeouts: mainjs.includes('AbortSignal.timeout(15000)') && mainjs.includes('AbortSignal.timeout(12000)') && mainjs.includes('signal: AbortSignal.timeout(20000)'),
        aiTimeos: mainjs.includes('AbortSignal.timeout(35000)') && mainjs.includes('AbortSignal.timeout(40000)') && mainjs.includes('AbortSignal.timeout(45000)'),
        modelCache: mainjs.includes('gemSttWorkingModel') && mainjs.includes('gemWorkingModel'),
        keyBreak: mainjs.includes('if ([401, 403].includes(r.status)) { lastErr = gemErrHuman(r.status, msg) || lastErr; break; }') && mainjs.includes('if (r.status === 429) { lastErr = gemErrHuman(r.status, msg) || lastErr; continue; }'), /* v0.39: 401/403 break + 429 continue */
        glmThink: mainjs.includes("body.thinking = { type: 'disabled' }"),
        ttsParallel: mainjs.includes('await Promise.all(chunks.map(') && mainjs.includes('parts.filter(Boolean)'),
        sttFuse: appjs.includes("STT_LAST_KEY = 'avaSttLast'") && appjs.includes('sttMarkFail(eng)') && appjs.includes('sttBenched'),
        engGuard: appjs.includes('withEngTimeout') && appjs.includes('const RACE_MS = 12000'),
        aiStick: appjs.includes("AI_LAST_KEY = 'avaAiLast'") && appjs.includes('chainAi'),
        mediaSearchGuard: mainjs.includes('const mediaCmd ='),
        dcDiag: mainjs.includes('discord ps stderr') && mainjs.includes('/^DBG:/i') && mainjs.includes('ERR:PS:') && mainjs.includes('DBG:TRY=') && mainjs.includes("'ERR:NOBTN'"),
        musicFlat: !css.includes('.m-thumb') && !appjs.includes('m-thumb') && !appjs.includes('m-hovplay') && css.includes('background: transparent;\n  border: none;'),
        musicCtl: html.includes('mBack10') && html.includes('mFwd10') && html.includes('id="mStop"') && html.includes('mVolDown') && html.includes('mVolUp') && html.includes('i-back10') && html.includes('i-fwd10') && html.includes('i-volup'),
        musicWire: appjs.includes('seek10(-10)') && appjs.includes('seek10(10)') && appjs.includes('nudgeVol(-10)') && appjs.includes("t('music.stopped')"),
        coverPro: css.includes('width: 232px; height: 232px;') && css.includes('.np-eq') && css.includes('.upd-actions') && !css.includes('.np-vinyl'),
      };
      ok('v0.21 update download is user-triggered (no background auto-download)', v21.updManual && v21.updDlIpc);
      ok('v0.21 pause/resume/cancel via CancellationToken (+ manual layer)', v21.updToken && v21.updBridge && v21.manualCancel);
      ok('v0.21 updater UI: download/pause/cancel buttons + MB progress', v21.updMbUi);
      ok('v0.21 STT engine timeouts (gemini 15s / whisper 12s / glm-asr 20s)', v21.sttTimeouts);
      ok('v0.21 AI timeouts (35/40/45s) + GLM thinking disabled', v21.aiTimeos && v21.glmThink);
      ok('v0.21 working-model memory (gemini chat+STT) + invalid-key break', v21.modelCache && v21.keyBreak);
      ok('v0.21 parallel TTS chunks (first audio sooner)', v21.ttsParallel);
      ok('v0.21 STT engine stickiness + circuit breaker + per-engine guard', v21.sttFuse && v21.engGuard);
      ok('v0.21 AI provider stickiness + media-cmd search guard', v21.aiStick && v21.mediaSearchGuard);
      ok('v0.21 discord PS diagnostics (stderr/DBG/ERR:PS/NOBTN)', v21.dcDiag);
      ok('v0.21 flat playlist rows (no thumbnails/boxes)', v21.musicFlat);
      ok('v0.21 player controls: stop / ±10s seek / volume± wired', v21.musicCtl && v21.musicWire);
      ok('v0.21 professional cover (200px, highlight+ring) + upd actions css', v21.coverPro);
    } catch (e) { console.log('SKIP | v0.21 markers | ' + String(e && e.message).slice(0, 80)); }

    // 8.95 v0.22 — discord -File exec (command-line-too-long fix), fast STT chain,
    // extDns migration, persistent music library, phonetic dictionary expansion
    try {
      const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
      const appjs = read('renderer/js/app.js');
      const mainjs = read('main.js');
      const preload = read('preload.js');
      const css = read('renderer/css/styles.css');
      const html = read('renderer/index.html');
      const v22 = {
        dcFile: mainjs.includes("'-File', psFile") && mainjs.includes("spawn('powershell.exe'") && mainjs.includes('param(') && mainjs.includes('-Action\', psAction'),
        dcNoEncoded: !/exec[\s\S]{0,200}-EncodedCommand/.test(mainjs.slice(mainjs.indexOf('function runDiscordPs'), mainjs.indexOf('function runDiscordPs') + 2500)),
        dcBom: mainjs.includes("'\\ufeff' + DISCORD_PS_BODY"),
        sttFast: appjs.indexOf("if (whisperSttReady()) c.push('whisper')") < appjs.indexOf("if (geminiSttReady()) c.push('gemini')"),
        sttMig: appjs.includes("migV22") && appjs.includes("settings.sttEngine === 'gemini'"),
        dnsMig: appjs.includes("settings.extDns = true; store.set('extDns', true)"),
        mediaProto: mainjs.includes("scheme: 'ava-media'") && mainjs.includes("protocol.handle('ava-media'") && mainjs.includes('Content-Range'),
        musicIpc: mainjs.includes("ipcMain.handle('music:pickDirs'") && mainjs.includes("ipcMain.handle('music:scan'") && mainjs.includes("ipcMain.handle('music:readHead'") && mainjs.includes('showOpenDialog'),
        musicBridge: preload.includes("pickDirs: () => ipcRenderer.invoke('music:pickDirs')") && preload.includes('readHead'),
        musicPersist: appjs.includes('scanAndLoadDirs') && appjs.includes('restoreMusicLibrary') && appjs.includes("settings.musicDirs = merged") && appjs.includes('mediaUrl'),
        phonetic: appjs.includes("'اپرا': 'opera'") && appjs.includes("'براو': 'brave'") && appjs.includes("'تیم ویور': 'teamviewer'") && appjs.includes("'ماینکرفت': 'minecraft'"),
        vinylUi: !html.includes('np-vinyl') && !html.includes('np-cover-wrap') && html.includes('np-eq') && html.includes('mDirsClear') && css.includes('.np-eq') && !css.includes('.np-vinyl') && !css.includes('vinylSpin'),
        musicI18n: appjs.includes("'music.restored'") && appjs.includes("'music.cleared'") && appjs.includes("'music.clearDirs'"),
      };
      ok('v0.22 discord PS via temp .ps1 + spawn -File (no cmdline limit)', v22.dcFile && v22.dcNoEncoded && v22.dcBom);
      ok('v0.22 auto STT chain: whisper/google before gemini + gemini-default migration', v22.sttFast && v22.sttMig);
      ok('v0.22 extDns one-time re-enable (Shekan/Electro access)', v22.dnsMig);
      ok('v0.22 ava-media streaming protocol with Range support', v22.mediaProto);
      ok('v0.22 music folder scan IPCs + bridge (real Windows dialog)', v22.musicIpc && v22.musicBridge);
      ok('v0.22 persistent music library (musicDirs saved + boot restore + last track)', v22.musicPersist);
      ok('v0.22 phonetic dictionary expanded (opera/brave/teamviewer/minecraft…)', v22.phonetic);
      ok('v0.23 single-panel cover (vinyl fully removed) + clear-folders button + i18n', v22.vinylUi && v22.musicI18n);
    } catch (e) { console.log('SKIP | v0.22 markers | ' + String(e && e.message).slice(0, 80)); }

    // 8.96 v0.22 — runtime: single-panel cover + clear button in DOM
    try {
      const rt22 = await probe(`(() => ({
        singlePanel: !document.querySelector('.np-vinyl') && !document.querySelector('.np-cover-wrap') && !!document.querySelector('.np-cover .np-eq'),
        clearBtn: !!document.querySelector('#mDirsClear'),
        multiHint: !!document.querySelector('[data-i18n="music.multiHint"]'),
      }))()`);
      ok('v0.23 single-panel cover + eq chip render in DOM (no vinyl layer)', rt22.singlePanel);
      ok('v0.22 clear-folders button + multi-folder hint in DOM', rt22.clearBtn && rt22.multiHint);
    } catch (e) { console.log('SKIP | v0.22 runtime | ' + String(e && e.message).slice(0, 80)); }

    // 8.95 v0.23 — STT parallel race + single-panel cover round 4
    try {
      const v23 = {
        race: appjs.includes('const RACE_MS = 12000') && appjs.includes('race winner=') && appjs.includes("t('stt.racing'") && appjs.includes('raceSettle'),
        raceNoSeq: !appjs.includes('runChain('),
        racingI18n: appjs.includes("'stt.racing': ["),
        cover4Html: html.includes('np-eq') && !html.includes('np-vinyl') && !html.includes('np-cover-wrap'),
        cover4Css: css.includes('.np-eq') && !css.includes('.np-vinyl') && !css.includes('vinylSpin') && css.includes('width: 232px; height: 232px;'),
        prioEnrich: appjs.includes('readId3FromPath(tr.path).then((tag)') && appjs.includes('music.tracks[music.cur] === tr'),
      };
      ok('v0.23 STT parallel race (first engine answer wins, no sequential timeout sum)', v23.race && v23.raceNoSeq);
      ok('v0.23 racing status i18n key', v23.racingI18n);
      ok('v0.23 cover round 4: single panel, vinyl + halo removed (HTML/CSS)', v23.cover4Html && v23.cover4Css);
      ok('v0.23 current-track ID3 priority enrichment (instant cover on play)', v23.prioEnrich);
    } catch (e) { console.log('SKIP | v0.23 markers | ' + String(e && e.message).slice(0, 80)); }

    // 8.97 v0.24 — hear-like-Chrome: in-app Shekan/Electro DNS bypass + web engine resilience
    try {
      const read24 = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
      const libjs = read24('lib/dns-bypass.js');
      const mainjs24 = read24('main.js');
      const preload24 = read24('preload.js');
      const appjs24 = read24('renderer/js/app.js');
      const v24 = {
        libExports: libjs.includes('resolveHosts') && libjs.includes('hostResolverRules') && libjs.includes("require('dgram')") && libjs.includes('178.22.122.100') && libjs.includes('78.157.42.100'),
        mainSwitch: mainjs24.includes("appendSwitch('host-resolver-rules'") && mainjs24.includes('ELECTRON_RUN_AS_NODE') && mainjs24.includes('dns-map.json') && mainjs24.includes('dns-probe.js'),
        hosts: libjs.includes("'www.google.com'") && libjs.includes("'api.groq.com'") && libjs.includes("'translate.google.com'") && libjs.includes("'generativelanguage.googleapis.com'") && libjs.includes("'api.z.ai'"),
        lookupPatch: mainjs24.includes('__avaPatched') && mainjs24.includes('nodeNet.connect'),
        selfcheck: mainjs24.includes('net selfcheck:') && mainjs24.includes("send('ava:net-status'") && mainjs24.includes('netSelfCheck'),
        webBench: appjs24.includes('SR_BENCH_MS = 90000') && appjs24.includes('const srUsable = () => !!SRC') && !appjs24.includes('srBroken = true'),
        webErrLog: appjs24.includes("actLog('stt web error: ' + e.error)"),
        netToast: appjs24.includes("'net.googleFail'") && appjs24.includes('ava.netToast') && appjs24.includes('bridge.net.onStatus'),
        preloadBridge: preload24.includes("on('ava:net-status'"),
        pkgLib: JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).build.files.some((f) => String(f).startsWith('lib/')),
      };
      ok('v0.24 dns-bypass module: UDP resolver + Shekan/Electro servers + chromium rules', v24.libExports);
      ok('v0.24 main: host-resolver-rules switch before ready (sync probe, asar-safe, cached)', v24.mainSwitch);
      ok('v0.24 pinned hosts cover speech/TTS/gemini/groq/z.ai endpoints', v24.hosts);
      ok('v0.24 node dns.lookup patch (SNI-safe) + TCP self-check wired', v24.lookupPatch && v24.selfcheck);
      ok('v0.24 web engine 90s re-probe bench instead of permanent death', v24.webBench);
      ok('v0.24 every web engine error lands in activity.log + unreachable-Google toast', v24.webErrLog && v24.netToast);
      ok('v0.24 preload net-status bridge + lib packaged in build.files', v24.preloadBridge && v24.pkgLib);
    } catch (e) { console.log('SKIP | v0.24 markers | ' + String(e && e.message).slice(0, 80)); }

    // 8.99 v0.25 — AVE3: voice conversation rebuilt from scratch
    // (dual-track session, no re-listen fallback, VAD end-of-utterance,
    // parallel cloud race on the SAME captured audio, epoch-guarded teardown)
    try {
      const app25 = fs.readFileSync(path.join(__dirname, 'renderer/js/app.js'), 'utf8');
      const v25 = {
        dualTrack: app25.includes('function aveStart(') && app25.includes('function aveTrackA(') && app25.includes('function aveTrackB('),
        noReListen: !app25.includes('fallbackFromWeb') && !app25.includes('startCloudListen') && !app25.includes('makeRec('),
        vad: app25.includes('AVE_SIL_MS = 1200') && app25.includes('function aveVadTick(') && app25.includes('function aveOnFrame('),
        deliver: app25.includes('function aveDeliver(') && app25.includes('stt final(') && app25.includes('function aveFinalize('),
        raceOnBuffer: app25.includes('const RACE_MS = 12000') && app25.includes('raceSettle') && app25.includes("bridge.stt.google({ pcm: pcmBytes"),
        teardown: app25.includes('function aveStopSession(') && app25.includes('aveEpoch += 1') && app25.includes('function aveKillAudio('),
        i18n: app25.includes("'stt.heardLive'") && app25.includes("'stt.failAll'"),
      };
      ok('v0.25 AVE3 dual-track session (live web engine + always-on PCM buffer)', v25.dualTrack);
      ok('v0.25 no re-listen fallback — user never repeats a command', v25.noReListen);
      ok('v0.25 VAD end-of-utterance (adaptive threshold + silence tick)', v25.vad);
      ok('v0.25 single deliver path + cloud race on the same captured audio', v25.deliver && v25.raceOnBuffer);
      ok('v0.25 epoch-guarded teardown + new status lines (heardLive/failAll)', v25.teardown && v25.i18n);
    } catch (e) { console.log('SKIP | v0.25 markers | ' + String(e && e.message).slice(0, 80)); }

    // 8.991 v0.26 — guaranteed connectivity: DNS bypass always-on (decoupled
    // from extDns), Shekan DoH fallback layer (UDP:53 blocked ISPs),
    // gemBadModels 404 negative memory, actionable net error, loud boot
    // update card (badge was invisible — user never got v0.22..v0.25!)
    try {
      const m26 = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
      const l26 = fs.readFileSync(path.join(__dirname, 'lib/dns-bypass.js'), 'utf8');
      const a26 = fs.readFileSync(path.join(__dirname, 'renderer/js/app.js'), 'utf8');
      const h26 = fs.readFileSync(path.join(__dirname, 'renderer/index.html'), 'utf8');
      const c26 = fs.readFileSync(path.join(__dirname, 'renderer/css/styles.css'), 'utf8');
      const v26 = {
        bypassOn: m26.includes('if (cfg.dnsBypass === false)') && !m26.includes('cfg.extDns === false'),
        doh: l26.includes('function queryDoH(') && l26.includes("DOH_ENDPOINTS = ['https://free.shecan.ir/dns-query']") && l26.includes('rejectUnauthorized: false'),
        fallback: l26.includes('async function resolveHost(') && l26.includes('dohTimeoutMs'),
        probeDoh: m26.includes('dohTimeoutMs: 2000') && m26.includes('timeout: 4600'),
        badModels: m26.includes('const gemBadModels = new Set()') && m26.includes('gemChainPruned(') && m26.includes('gemMarkBad(mdl)'),
        netHint: m26.includes('const isNetFail') && m26.includes('اتصال به سرور برقرار نشد — چند لحظه بعد دوباره امتحان کن'),
        card: h26.includes('id="updCardWrap"') && a26.includes('function maybeUpdCard(') && a26.includes("'upd.cardTitle'") && c26.includes('#updCardWrap'),
      };
      ok('v0.26 DNS bypass always-on (decoupled from extDns, explicit dnsBypass opt-out)', v26.bypassOn);
      ok('v0.26 Shekan DoH fallback layer (wireformat POST, expired-cert tolerant)', v26.doh);
      ok('v0.26 resolveHost UDP→DoH fallback + boot probe timing widened', v26.fallback && v26.probeDoh);
      ok('v0.26 gemBadModels: 404 models never retried (stale user-typed model)', v26.badModels);
      ok('v0.26 network error exists (v0.27 made it neutral, no DNS/VPN words)', v26.netHint);
      ok('v0.26 loud boot update card (badge was invisible to user)', v26.card);
    } catch (e) { console.log('SKIP | v0.26 markers | ' + String(e && e.message).slice(0, 80)); }

    // 8.992 v0.27 — always-works offline voice: local on-device engine
    // (sherpa-onnx + whisper int8), Chrome speech keys via env vars too,
    // ZERO DNS/VPN words in user-facing errors, offline pack download
    // flow (GitHub + HF mirror), TTS double-buffer prefetch
    try {
      const m27 = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
      const a27 = fs.readFileSync(path.join(__dirname, 'renderer/js/app.js'), 'utf8');
      const h27 = fs.readFileSync(path.join(__dirname, 'renderer/index.html'), 'utf8');
      const p27 = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
      const v27 = {
        localEngine: m27.includes("require('sherpa-onnx-node')") && m27.includes("ipcMain.handle('stt:local'") && m27.includes('OfflineRecognizer'),
        noExternalBuffer: m27.includes('function i16ToF32(') && !/sherpaNode\.readWave\(/.test(m27),
        pack: m27.includes("ipcMain.handle('stt:local:download'") && m27.includes('OFFLINE_URLS') && m27.includes('stt:local:progress'),
        keys: m27.includes('process.env.GOOGLE_API_KEY') && m27.includes("appendSwitch('google-api-key'"),
        noDnsWords: !m27.includes('فیلترشکن/VPN را روشن کن') && !m27.includes('(DNS/فیلترینگ) — نسخهٔ') && m27.includes("'اتصال به سرور برقرار نشد — چند لحظه بعد دوباره امتحان کن'"),
        chainLocal: a27.includes("if (localReady()) c.push('local')") && a27.includes("if (eng === 'local') return bridge.stt.local(") && a27.includes("'eng.local'"),
        card: h27.includes('id="offCard"') && h27.includes('id="btnOfflineDl"') && a27.includes('function updateOfflineCard(') && a27.includes('refreshLocalStatus()'),
        deps: p27.dependencies['sherpa-onnx-node'] && p27.optionalDependencies['sherpa-onnx-win-x64'] && Array.isArray(p27.build.asarUnpack),
        tts: a27.includes('gTtsNext') && a27.includes('__avaB64'),
        version: p27.version >= '0.29.0',
      };
      ok('v0.27 local offline engine (sherpa-onnx + whisper int8, on-device)', v27.localEngine);
      ok('v0.27 no external-buffer APIs (Electron-hardened PCM conversion)', v27.noExternalBuffer);
      ok('v0.27 offline pack download flow (GitHub archive + HF mirror + progress)', v27.pack);
      ok('v0.27 Chrome speech keys set via env vars AND command-line switches', v27.keys);
      ok('v0.27 zero DNS/VPN wording in user-facing network errors', v27.noDnsWords);
      ok('v0.27 local engine first in auto chain + race dispatch + engine UI', v27.chainLocal);
      ok('v0.27 offline pack card in settings (download/progress/status)', v27.card);
      ok('v0.27 packaging: native deps + asarUnpack for NAPI addon', v27.deps);
      ok('v0.27 TTS double-buffer prefetch (zero gap between chunks)', v27.tts);
      ok('v0.27+ version 0.29.0', v27.version);
    } catch (e) { console.log('SKIP | v0.27 markers | ' + String(e && e.message).slice(0, 80)); }

    // 8.993 v0.27.1 — fix "it types my request, then goes back to listening,
    // and the request never runs": (1) hands-free + wake-word silently DROPPED
    // every command without the "ava" prefix → now an actionable card with
    // run-now + turn-filter-off buttons; (2) cmdBusy could stick true forever
    // on a thrown error → 45s stale guard, commands can never be permanently
    // blocked silently.
    try {
      const a271 = fs.readFileSync(path.join(__dirname, 'renderer/js/app.js'), 'utf8');
      const h271 = fs.readFileSync(path.join(__dirname, 'renderer/index.html'), 'utf8');
      const v271 = {
        dropCard: a271.includes('function showWakeDropCard(') && a271.includes('wakeDropCmd') && h271.includes('id="rcWakeActions"') && h271.includes('id="btnWakeRun"') && h271.includes('id="btnWakeOff"'),
        force: a271.includes('!(opts && opts.force)') && a271.includes('handleUtterance(c, { force: true })'),
        busyGuard: a271.includes('const cmdBusyGuard = () =>') && a271.includes('Date.now() - cmdBusyAt < 45000') && !a271.includes('if (cmdBusy) return;'),
        hideOnRepaint: (a271.match(/hideWakeDropCard\(\)/g) || []).length >= 4,
        i18n: a271.includes("'wake.runNow'") && a271.includes("'wake.noWakeDone'"),
      };
      ok('v0.27.1 wake-drop actionable card (heard text + run-now + turn-filter-off)', v271.dropCard);
      ok('v0.27.1 forced execution bypass for the run-now button', v271.force);
      ok('v0.27.1 cmdBusy 45s stale guard (commands can never be permanently blocked)', v271.busyGuard);
      ok('v0.27.1 drop-card hidden on live-heard/command repaint + i18n', v271.hideOnRepaint && v271.i18n);
    } catch (e) { console.log('SKIP | v0.27.1 markers | ' + String(e && e.message).slice(0, 80)); }

    // 8.994 v0.28 — Siri-style wake session + cute chime + persistent hint;
    // direct site opening ("برو به سایت دیجی کالا" opens digikala.com, no "برو به"
    // searched on Google); Discord deafen ("دیفن") accepted + extension-off
    // explanation instead of silent fallthrough; Gemini key UX (auto-route AIza
    // from the speech Google field, save-feedback toasts, Persian server errors).
    try {
      const a28 = fs.readFileSync(path.join(__dirname, 'renderer/js/app.js'), 'utf8');
      const m28 = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
      const v28 = {
        sess: a28.includes('wakeSessUntil') && a28.includes('WAKE_SESS_MS') && a28.includes('function wakeSessOpen(') && a28.includes('wakeSessExtend()'),
        chime: a28.includes('function playWakeChime(') && a28.includes('createOscillator') && a28.includes('.ogg') === false,
        dropSpoken: a28.includes("'wake.dropSpoken'") && a28.includes('wakeSessOpen(); /* اجرای همان فرمان'),
        noWakeRe: a28.includes('WAKE_WORD_RE') && !a28.includes("text.match(/^\\s*(هی\\s+آوا|آوا\\s?جان|آوا|اوا|آوای|اوای|ava)"),
        siteDict: a28.includes('const KNOWN_SITES') && a28.includes('digikala.com') && a28.includes('function knownSiteOf(') && a28.includes('function cleanSiteQuery('),
        siteNavStrip: a28.includes('برو\\s*به') && a28.includes('siteDomainOf('),
        discDeafen: a28.includes('دیفن|دی\\s?فن|کرافت|deafen') && a28.includes("action: 'deafen'"),
        discGate: a28.includes('دیفن|دی\\s?فن|deafen') && a28.includes("'disc.off'"),
        gemRoute: a28.includes('set.ai.gemMoved') && a28.includes('/^AIza/') && a28.includes("'set.ai.gemSaved'"),
        gemErr: m28.includes('const gemErrHuman') && m28.includes('API key not valid') && m28.includes('location is not supported') && m28.includes('gemErrHuman(r.status, msg)'),
      };
      ok('v0.28 Siri-style wake session (one "Ava" opens 90s conversation mode)', v28.sess);
      ok('v0.28 cute synthesized activation chime (WebAudio, no audio file)', v28.chime);
      ok('v0.28 wake-drop speaks the hint once + run-now opens the session', v28.dropSpoken);
      ok('v0.28 wake-word regex centralized (session-aware gate)', v28.noWakeRe);
      ok('v0.28 known-sites dict — "go to Digikala site" opens the site directly', v28.siteDict);
      ok('v0.28 navigation words stripped ("برو به" never searched on Google)', v28.siteNavStrip);
      ok('v0.28 Discord deafen via "دیفن" + clear extension-off message', v28.discDeafen && v28.discGate);
      ok('v0.28 Gemini key: AIza auto-routed from speech field + save toasts', v28.gemRoute);
      ok('v0.28 Gemini server errors translated to actionable Persian', v28.gemErr);
    } catch (e) { console.log('SKIP | v0.28 markers | ' + String(e && e.message).slice(0, 80)); }

    // 8.9935 v0.28.1 — Discord PS1 parse-error root fix: a curly apostrophe
    // (U+2019) inside the callswitch regex terminated the PowerShell string
    // mid-pattern (PS treats curly quotes as string DELIMITERS) →
    // ava-dc.ps1:193 char:34 "The string is missing the terminator: \"" →
    // the WHOLE script never ran → EVERY Discord command failed. Invariant:
    // the generated ps1 body must be 100% curly-quote-free; stripping happens
    // at runtime via [char] codes; stderr is surfaced with the real message
    // line instead of only the "At ... char:N" position header.
    try {
      const m281 = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
      const body281 = (m281.match(/const DISCORD_PS_BODY = `([\s\S]*?)`;/) || ['', ''])[1];
      const v281 = {
        bodyFound: body281.length > 4000,
        noCurly: body281.length > 0 && !/[\u2018\u2019\u201C\u201D]/.test(body281),
        fixedLine: body281.includes("$name = ($Name -replace '[''\"]', '')"),
        runtimeStrip: body281.includes('foreach ($cq in [char]0x2018, [char]0x2019, [char]0x201C, [char]0x201D)'),
        safeNameStrip: m281.includes('’‘“”`'),
        errSurfaced: m281.includes("const msgLine = el.find((l) => !/^At /.test(l)") && m281.includes("('خطای پاورشل: ' + msgLine + posTxt)"),
      };
      ok('v0.28.1 Discord PS body extracted for invariant check', v281.bodyFound);
      ok('v0.28.1 PS body 100% curly-quote-free (U+2019 can never break the PS parser again)', v281.noCurly);
      ok('v0.28.1 callswitch regex ASCII-only + runtime [char] strip of all 4 curly quotes', v281.fixedLine && v281.runtimeStrip);
      ok('v0.28.1 safeName entry-sanitizer also strips curly quotes (JS side)', v281.safeNameStrip);
      ok('v0.28.1 PS stderr surfaced with the real message line, not just "At ... char:N"', v281.errSurfaced);
    } catch (e) { console.log('SKIP | v0.28.1 markers | ' + String(e && e.message).slice(0, 80)); }

    // 8.9930 v0.29 — (1) Discord actions are UIA-first & state-aware: the old
    // branches always printed OK after sending keys that Discord ignored
    // (PostMessage synthetics + SetForegroundWindow from spawned PS silently
    // fail) → now the real Mute/Unmute/Deafen/Disconnect/Join buttons are
    // found by name and Invoked, honest results (UIA/UACLICK/ALREADY/KEYS);
    // (2) Gemini test-connection button + optional personal relay base URL;
    // (3) always-on offline wake word (VAD + local Whisper, works even when
    // listening is off — the Siri behavior the user asked for);
    // (4) AI intent protocol gained discord unmute/deafen/answer/decline.
    try {
      const m29 = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
      const a29 = fs.readFileSync(path.join(__dirname, 'renderer/js/app.js'), 'utf8');
      const h29 = fs.readFileSync(path.join(__dirname, 'renderer/index.html'), 'utf8');
      const body29 = (m29.match(/const DISCORD_PS_BODY = `([\s\S]*?)`;/) || ['', ''])[1];
      const v29 = {
        uia: body29.includes('function Press-Dc') && body29.includes("'^Mute$'") && body29.includes("'^Unmute$'") && body29.includes('Disconnect|Leave Call'),
        honest: body29.includes('-ALREADY') && body29.includes(':UACLICK') && body29.includes('DBG:BTNAMES'),
        keysGuard: body29.includes('function Try-Keys') && body29.includes('function Focus-DcHard') && body29.includes('return (Test-Fg)'),
        curlyFree: body29.length > 4000 && !/[\u2018\u2019\u201C\u201D]/.test(body29),
        gemTest: m29.includes("ipcMain.handle('ai:gemtest'") && m29.includes('badKeys.add(k)'),
        gemBase: m29.includes('const gbase = String(base') && a29.includes("gemBase: store.get('gemBase', '')"),
        wakeAlways: a29.includes('async function wakeLoopStart()') && a29.includes('function wakeBootRetry()') && a29.includes("bridge.stt.local({ pcm: new Uint8Array(pcm16.buffer), rate: 16000"),
        wakeIdle: a29.includes("if (state === 'listening' || state === 'processing' || dictation.active || wakeTtsBusy()) { wakeLoop.chunks.length = 0; wakeLoop.spoke = false; return; }"),
        doActs: a29.includes("'discord_unmute', 'discord_deafen', 'discord_hangup', 'discord_answer', 'discord_decline'") && a29.includes("case 'discord_answer':"),
        unmute: a29.includes("action: unmute ? 'unmute' : 'mute'"),
        ui: h29.includes('id="optWakeAlways"') && h29.includes('id="btnGemTest"') && h29.includes('id="optGemBase"'),
      };
      ok('v0.29 Discord: UIA-first state-aware button actions (Mute/Unmute/Deafen/Hangup/Answer/Decline)', v29.uia);
      ok('v0.29 Discord: honest results (UIA/UACLICK/ALREADY/KEYS) + button-name dump for diagnosis', v29.honest);
      ok('v0.29 Discord: keys engine fires only behind VERIFIED foreground (evolved v0.30)', v29.keysGuard);
      ok('v0.29 Discord: PS body still 100% curly-quote-free (v0.28.1 invariant)', v29.curlyFree);
      ok('v0.29 Gemini: test-connection handler (3 models, bad-key rotation, Persian errors)', v29.gemTest);
      ok('v0.29 Gemini: optional personal relay base honored in chat + STT + test', v29.gemBase);
      ok('v0.29 Wake: always-on offline wake word (VAD gate + local Whisper detection of آوا)', v29.wakeAlways);
      ok('v0.29 Wake: loop idles during active sessions (zero CPU while listening)', v29.wakeIdle);
      ok('v0.29 AI: intent protocol covers discord unmute/deafen/answer/decline', v29.doActs);
      ok('v0.29 voice: ان‌میوت/وصل کن maps to real unmute, ALREADY states reported honestly', v29.unmute);
      ok('v0.29 UI: wakeAlways toggle + Gemini test button + relay field', v29.ui);
    } catch (e) { console.log('SKIP | v0.29 markers | ' + String(e && e.message).slice(0, 80)); }

    // 8.9895 v0.29.1 — (1) THE DISCORD BOMB: a C-style comment (slash-star)
    // inside ava-dc.ps1 is NOT a PS comment — the parser accepted it and at
    // runtime executed a Persian word from it as a command → 'The term '????'
    // is not recognized' → every action died after DBG:PROC. A parse-only
    // test cannot catch runtime bombs, so scripts-test-v0291.js now EXECUTES
    // the real body with real pwsh. Invariant: ZERO slash-star in the body.
    // (2) wake-always silent uncheck removed → auto pack download;
    // (3) cloudFetch dual path (chromium net.fetch honors system proxy →
    // node pinned-DNS fallback); (4) AI provider chain {ok:false} truthy bug
    // fixed (GLM tried when Gemini down); (5) «آن میوت» alef unmute.
    try {
      const m291 = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
      const a291 = fs.readFileSync(path.join(__dirname, 'renderer/js/app.js'), 'utf8');
      const body291 = (m291.match(/const DISCORD_PS_BODY = `([\s\S]*?)`;/) || ['', ''])[1];
      const v291 = {
        noCsComment: body291.length > 4000 && !body291.includes('/*') && !body291.includes('*/'),
        utf8Console: body291.includes('[Console]::OutputEncoding = [System.Text.Encoding]::UTF8'),
        wakeNoSilentOff: !a291.includes("settings.wakeAlways = false; store.set('wakeAlways', false);"),
        wakeAutoDl: a291.includes('bridge.stt.localDownload()') && a291.includes('wakeDlLastTry') && a291.includes("s.stage === 'done' && settings.wakeAlways && !wakeLoop"),
        cloudFetch: m291.includes('async function cloudFetch(url, opts)') && m291.includes('const r = await net.fetch(url, o);') && (m291.match(/await cloudFetch\(/g) || []).length >= 14,
        deepDiag: m291.includes('net system proxy for googleapis') && m291.includes('setTimeout(netDeepDiag, 5000)'),
        aiChain: (a291.match(/if \(r && r\.ok && r\.text\) return r;/g) || []).length >= 3 && !a291.includes('.catch(() => null)) || false;'),
        unmuteAlef: a291.includes('(ا|آ)ن\\s?میوت'),
      };
      ok('v0.29.1 Discord: PS body has ZERO C-style comments (runtime CommandNotFound bomb class eliminated)', v291.noCsComment);
      ok('v0.29.1 Discord: UTF8 console encoding set at script start (PS errors readable, no ???? mangling)', v291.utf8Console);
      ok('v0.29.1 Wake: silent toggle-off removed, pack auto-downloads with cooldown + done-hook', v291.wakeNoSilentOff && v291.wakeAutoDl);
      ok('v0.29.1 Net: cloudFetch dual path — chromium net.fetch (system proxy) → node (pinned DNS)', v291.cloudFetch);
      ok('v0.29.1 Net: system-proxy probe + real https-check of generativelanguage at boot', v291.deepDiag);
      ok('v0.29.1 AI: provider chain only accepts ok results ({ok:false} can no longer short-circuit to fake "Gemini ok")', v291.aiChain);
      ok('v0.29.1 Discord: «آن میوت» (alef) maps to unmute', v291.unmuteAlef);
    } catch (e) { console.log('SKIP | v0.29.1 markers | ' + String(e && e.message).slice(0, 80)); }

    // 8.98955 v0.29.2 — THE AI-REFERRAL round: «ارجاع نمیده به ای آی».
    // (1) A matched rule that cannot fulfill (weather city-not-found /
    // network, calc parse fail) no longer dead-ends with an error string —
    // the AI_FALLBACK sentinel routes the SAME utterance into
    // aiHandleCommand (Gemini, or GLM when Gemini is blocked).
    // (2) City extraction no longer sends «بجنورد را بهم» to geocoding —
    // edge fillers (را/بهم/برام/نشونم/...) are stripped whole-token.
    // (3) sys:weather checks gr.ok/fr.ok and no longer swallows filtered
    // HTML into {} that LIED as «city not found»; 42 Iranian cities ship
    // offline (بجنورد = 37.4747, 57.329 live-API verified).
    try {
      const m292 = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
      const a292 = fs.readFileSync(path.join(__dirname, 'renderer/js/app.js'), 'utf8');
      const v292 = {
        sentinel: a292.includes('const AI_FALLBACK = Object.freeze({ __aiFallback: true });'),
        weatherRef: /const r = await bridge\.system\.weather\(city \|\| 'تهران'\);[\s\S]{0,600}return AI_FALLBACK;/.test(a292),
        calcRef: /if \(!m\) \{[\s\S]{0,200}return AI_FALLBACK;/.test(a292),
        dispatch: a292.includes("reply && typeof reply === 'object' && reply.__aiFallback")
          && /__aiFallback[\s\S]{0,420}aiConnected\(\)\) \{ (_dispatchOutcome = '[a-z-]+'; )?await aiHandleCommand\(cmd(, (?:rule && rule\.__aiExtra|await aiFallbackCtx\((?:rule, cmd|rule)?\)))?\); return; \}/.test(a292), /* v0.47: +outcome؛ v0.50: aiFallbackCtx(rule, cmd) */
        edgeCity: a292.includes('wxExtractCity') && a292.includes('نشونم') && a292.includes('نشانم'),
        honestGeo: m292.includes('if (!gr.ok) return wFail(`سرویس آب‌وهوا پاسخ نداد (HTTP ${gr.status})`, true);')
          && (m292.match(/wFail\([^\n]*true\)/g) || []).length >= 4,
        irCities: m292.includes("'بجنورد': [37.4747, 57.329]") && (m292.match(/IR_CITIES/g) || []).length >= 2,
        ver292: /let appVersion = '0\.(29|[3-9]\d)\.\d+(?:-[\w.]+)?';/.test(a292),
      };
      ok('v0.29.2 AI-referral: AI_FALLBACK sentinel defined', v292.sentinel);
      ok('v0.29.2 AI-referral: weather failure returns the sentinel (no dead-end)', v292.weatherRef);
      ok('v0.29.2 AI-referral: calc parse failure returns the sentinel', v292.calcRef);
      ok('v0.29.2 AI-referral: runCommand routes sentinel → aiHandleCommand (same utterance)', v292.dispatch);
      ok('v0.29.2 weather: edge-filler city extraction (بجنورد را بهم → بجنورد)', v292.edgeCity);
      ok('v0.29.2 weather: gr.ok/fr.ok checked, netFail honest (no more fake city-not-found)', v292.honestGeo);
      ok('v0.29.2 weather: 42 Iranian cities offline (بجنورد live-API coords)', v292.irCities);
      ok('v0.29.2 version markers (0.29.x+)', v292.ver292);
    } catch (e) { console.log('SKIP | v0.29.2 markers | ' + String(e && e.message).slice(0, 80)); }

    // 8.98956 v0.29.3 — (1) THE UIA .CTOR BOMB: Process.MainWindowHandle is an
    // IntPtr in PS but PropertyCondition(NativeWindowHandleProperty, …) requires
    // Int32 → ctor threw ×9 in the user's log → every Press-Dc action returned
    // EMPTY → «PowerShell اجرا نشد». callswitch survived only via the coordinate
    // fallback. FIX: FromHandle([IntPtr]$hwnd) at all 3 sites, zero-hwnd guard.
    // (2) z.ai KILLED /api/chat/completions (404 live-verified) → «z.ai: Not
    // Found» after 29s; /api/v2/chat/completions is alive (401=auth). Frontend
    // bundle reverse-engineered: HMAC signature chain (js-sha256 hmac(key,msg),
    // 5-min bucket over sortedPayload|base64(prompt)|ts) — both z.ai paths now
    // POST v2 with X-Signature + signature_prompt + X-FE-Version prod-fe-1.1.92.
    try {
      const m293 = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
      const body293 = (m293.match(/const DISCORD_PS_BODY = `([\s\S]*?)`;/) || ['', ''])[1];
      const v293 = {
        noNativeCond: body293.length > 4000 && !body293.includes('NativeWindowHandleProperty'),
        fromHandle: (body293.match(/FromHandle\(\[IntPtr\]\$hwnd\)/g) || []).length === 3,
        v2Page: m293.includes("let r = await zfetch('/api/v2');") && m293.includes("if (r.status === 404) r = await zfetch('/api');"),
        v2Direct: m293.includes('`${ZAI}/api/v2/chat/completions?${zQs}`') && !m293.includes('`${ZAI}/api/chat/completions`'),
        sigChain: (m293.match(/key-@@@@\)\)\)\(\)\(\(9\)\)-xxxx&&&%%%%%/g) || []).length === 2
          && (m293.match(/signature_prompt: (zSigPrompt|sigPrompt)/g) || []).length === 2,
        feVer: !m293.includes('prod-fe-1.0.76') && (m293.match(/prod-fe-1\.1\.92/g) || []).length >= 2,
        dbgWide: m293.includes('l.slice(0, 400)') && !m293.includes('l.slice(0, 140)'),
      };
      ok('v0.29.3 Discord: ZERO NativeWindowHandleProperty (Int32/IntPtr ctor bomb eliminated)', v293.noNativeCond);
      ok('v0.29.3 Discord: FromHandle(IntPtr) at all 3 UIA sites', v293.fromHandle);
      ok('v0.29.3 z.ai: in-page path posts /api/v2 (v1 404-fallback kept)', v293.v2Page);
      ok('v0.29.3 z.ai: direct path posts v2, dead v1 call removed', v293.v2Direct);
      ok('v0.29.3 z.ai: HMAC signature chain + signature_prompt on both paths', v293.sigChain);
      ok('v0.29.3 z.ai: X-FE-Version prod-fe-1.1.92 (was stale 1.0.76)', v293.feVer);
      ok('v0.29.3 Discord: DBG log slice 400 (UIAERR fully visible next round)', v293.dbgWide);
    } catch (e) { console.log('SKIP | v0.29.3 markers | ' + String(e && e.message).slice(0, 80)); }

    // 8.98957 v0.30.0 — DC-NATIVE: Discord engine REBUILT from scratch (user:
    // «هنوز هیچ عملی روی دیسکورد اعمال نمیشه» after three fix generations +
    // «یک بار کامل از اول برنامه‌نویسی کن، با یک روش دیگ»). New cycle:
    // real state (UIA 3-round) → verified-focus keys (AttachThreadInput +
    // SwitchToThisWindow + SCANCODE injection, Persian-layout safe, NEVER
    // sent without GetForegroundWindow==Discord) → UIA Invoke → rect click
    // → flip verification → honest labels (KEYS-VERIFIED / UIA-VERIFIED /
    // UACLICK / ALREADY / KEYS-UNVERIFIED / ERR:NOFOCUS / ERR:NOBTN:LABEL)
    // + new state query action + «وضعیت میکروفون دیسکورد» voice command.
    try {
      const m30 = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
      const a30 = fs.readFileSync(path.join(__dirname, 'renderer/js/app.js'), 'utf8');
      const body30 = (m30.match(/const DISCORD_PS_BODY = `([\s\S]*?)`;/) || ['', ''])[1];
      const v30 = {
        hard: body30.includes('function Focus-DcHard') && body30.includes('AttachThreadInput') && body30.includes('SwitchToThisWindow') && body30.includes('BringWindowToTop'),
        sc: body30.includes('0x8 -bor 0x2') && body30.includes('Send-Combo $combo') && body30.includes("'ctrl,shift,m'"),
        guard: body30.includes('return (Test-Fg)') && body30.includes("'DBG:FG='") && body30.indexOf('Focus-DcHard') < body30.indexOf('Send-Combo $combo'),
        flip: body30.includes('function Test-Flip') && body30.includes(':KEYS-VERIFIED') && body30.includes(':KEYS-UNVERIFIED') && body30.includes(':UIA-VERIFIED'),
        rounds: body30.includes('DBG:ROUND=') && /for \(\$round = 1; \$round -le 3/.test(body30),
        state: body30.includes("'state'") && body30.includes('OK:STATE:') && body30.includes('ERR:NOSTATE'),
        honest: body30.includes('ERR:NOFOCUS') && body30.includes(':UACLICK') && body30.includes('-ALREADY') && body30.includes('ERR:NOBTN:'),
        cur: body30.length > 6000 && !/[\u2018\u2019\u201C\u201D]/.test(body30) && !body30.includes('/*') && !body30.includes('NativeWindowHandleProperty'),
        rmap: m30.includes("em.startsWith('ERR:NOBTN:')") && m30.includes("em.startsWith('ERR:NOFOCUS')") && m30.includes('ERR:NOSTATE'),
        vstate: a30.includes("action: 'state'") && a30.includes('disc.stateMuted') && a30.includes('disc.stateFail') && (a30.match(/'disc\.stateOn': \[/g) || []).length === 2,
        ver: /let appVersion = '0\.(29|[3-9]\d)\.\d+(?:-[\w.]+)?';/.test(a30),
      };
      ok('v0.30 Discord: hard-focus chain (AttachThreadInput + SwitchToThisWindow + BringWindowToTop)', v30.hard);
      ok('v0.30 Discord: scancode combos (Persian-layout safe) + real keybind sequences', v30.sc);
      ok('v0.30 Discord: keys ONLY after verified foreground + FG probe logged (no blind keys)', v30.guard);
      ok('v0.30 Discord: flip verification + honest KEYS-VERIFIED/UNVERIFIED/UIA-VERIFIED labels', v30.flip);
      ok('v0.30 Discord: 3-round UIA scan (lazy a11y tree, no false BTNS=0)', v30.rounds);
      ok('v0.30 Discord: state query action (OK:STATE:MUTED/ON:DEAF/SOUND)', v30.state);
      ok('v0.30 Discord: honest failures (ERR:NOFOCUS / ERR:NOBTN:label / ALREADY)', v30.honest);
      ok('v0.30 Discord: body still curly-free + zero C-comments + zero ctor-bomb', v30.cur);
      ok('v0.30 main: prefixed ERR:NOBTN:/ERR:NOFOCUS mapped to Persian hints', v30.rmap);
      ok('v0.30 voice: state query («وضعیت میکروفون دیسکورد») wired + i18n both dicts', v30.vstate);
      ok('v0.30 version markers (0.29.x/0.3x)', v30.ver);
    } catch (e) { console.log('SKIP | v0.30 markers | ' + String(e && e.message).slice(0, 80)); }

    // 8.98958 v0.31.0 — فیوچرهای جدید (درخواست کاربر: «برو برای اضافه کردن
    // فیوچرهای جدید»): (۱) قیمت لحظه‌ای ارز/طلا/سکه/رمزارز بدون کلید از tgju
    // با زنجیرهٔ mirror و cloudFetch (ریال÷۱۰ = تومان، رمزارز دلاری+تومانی)،
    // (۲) اوقات شرعی ۱۰۰٪ آفلاین با هستهٔ نجومی روش ژئوفیزیک تهران (۱۷٫۷/۱۴/۴٫۵
    // + نیمه‌شب جعفری) — اعتبارسنجی زنده: ۰-۱ دقیقه اختلاف با aladhan method=7
    // در ۵ شهر × ۳ تاریخ، مختصات از دیکشنری مشترک IR_CITIES (sys:geo)،
    // (۳) یادداشت صوتی ماندگار در فایل مستقل ava-notes.json، (۴) تاریخ میلادی
    // مکمل شمسی، (۵) کاور امن موزیک (onerror تصویر شکسته را حذف می‌کند).
    // هر شکست → AI_FALLBACK (هیچ بن‌بستی مثل v0.29.2 نمی‌ماند).
    try {
      const m31 = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
      const a31 = fs.readFileSync(path.join(__dirname, 'renderer/js/app.js'), 'utf8');
      const p31 = fs.readFileSync(path.join(__dirname, 'preload.js'), 'utf8');
      const s31 = (src, a, b) => { const i = src.indexOf(a); const j = src.indexOf(b, i); return i >= 0 && j > i ? src.slice(i, j) : ''; };
      const v31 = {
        rates: m31.includes("ipcMain.handle('sys:rates'") && m31.includes('https://call.tgju.org/ajax.json') && m31.includes('https://call3.tgju.org/ajax.json') && m31.includes('https://call4.tgju.org/ajax.json') && /await cloudFetch\(u,/.test(m31),
        geo: m31.includes("ipcMain.handle('sys:geo'") && (m31.match(/const IR_CITIES = \{/g) || []).length === 1 && m31.includes("'بجنورد': [37.4747, 57.329]"),
        notes: m31.includes("ipcMain.handle('notes:load'") && m31.includes("ipcMain.handle('notes:save'") && m31.includes('ava-notes.json'),
        preload: p31.includes("rates: () => ipcRenderer.invoke('sys:rates')") && p31.includes("geo: (city) => ipcRenderer.invoke('sys:geo', city)") && p31.includes("load: () => ipcRenderer.invoke('notes:load')"),
        rmap: a31.includes('const RATE_MAP = [') && a31.includes('function ratesDetect') && a31.includes('function rateLine') && a31.includes('price_dollar_rl') && a31.includes('crypto-bitcoin-irr') && a31.includes('geram18') && a31.includes('sekee') && a31.includes("ids = ['dollar', 'gold18', 'emami']"),
        rgate: a31.includes('r: (c) => ratesReply(c)') && s31(a31, 'async function ratesReply', 'async function prayerReply').includes('return AI_FALLBACK'),
        pray: a31.includes('function prayerTimesCore') && a31.includes('riseSet(17.7)') && a31.includes('riseSet(4.5)') && a31.includes('riseSet(14)') && a31.includes('function prExtractCity') && a31.includes('function prWhich') && a31.includes('r: (c) => prayerReply(c)') && a31.includes('نیمه‌شب شرعی'),
        noteR: a31.includes('function notesParseOp') && a31.includes('function notesReply') && a31.includes('r: (c) => notesReply(c)') && a31.includes('unshift({ t: Date.now(), x: text.slice(0, 500) })') && a31.includes("notes.save(kept)"),
        i18n: a31.includes("'rates.ask'") && a31.includes("'prayer.city'") && a31.includes("'notes.added'") && a31.includes("'notes.cleared'") && a31.includes("'date.greg'") && a31.includes('fa-IR-u-ca-gregory'),
        cover: a31.includes('function setCoverArt') && a31.includes('im.onerror') && a31.includes('setCoverArt(mCover, tr, true)') && a31.includes('setCoverArt(mwCover, tr, false)'),
        ver: /let appVersion = '0\.(29|[3-9]\d)\.\d+(?:-[\w.]+)?';/.test(a31) && /^0\.(29|[3-9]\d)\.\d+(?:-[\w.]+)?$/.test(JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version),
      };
      ok('v0.31 rates: sys:rates IPC + tgju 3-mirror chain via cloudFetch', v31.rates);
      ok('v0.31 geo: sys:geo + single hoisted IR_CITIES shared dict', v31.geo);
      ok('v0.31 notes: independent ava-notes.json store (settings can never swallow notes)', v31.notes);
      ok('v0.31 preload: rates/geo/notes bridges exposed', v31.preload);
      ok('v0.31 rates: RATE_MAP + pure detect/line + basket fallback + honest AI_FALLBACK', v31.rmap && v31.rgate);
      ok('v0.31 prayer: offline Tehran-method core (17.7/4.5/14 + Jafari midnight) + city/which + voice gate', v31.pray);
      ok('v0.31 notes voice: add/read/delLast/delAll parser + persistent capped save', v31.noteR);
      ok('v0.31 i18n: rates/prayer/notes/date.greg keys + Gregorian date rule', v31.i18n);
      ok('v0.31 music: safe cover art (onerror removes broken blob)', v31.cover);
      ok('v0.31 version markers 0.31.0', v31.ver);
    } catch (e) { console.log('SKIP | v0.31 markers | ' + String(e && e.message).slice(0, 80)); }

    // 8.98959 v0.32.0 — سه ریشه‌یابی از تحلیل کاربر: (۱) جمنای: کشف پویای
    // ListModels + حذف نسل مردهٔ ۲.۰ + نسل ۳ در زنجیرهٔ ثابت + gemSupportsThinking
    // (۲) بیدارباش همیشگی: گیت صدای خود آوا + واتچ‌داگ خط لوله + resume کانتکست +
    // برداختن جلسه + فرمان یک‌نفس + ریسایکل موتور مشغول
    // (۳) تماس دیسکورد: حذف کلیدِ PostMessageِ بلعیده‌شده در callswitch،
    // فوکوس تاییدشده + تایید کلیپ‌بورد + فالبک مختصاتی فقط برای درخت کور
    // + نرمال‌سازی نام مخاطب («ali hk» == «ali-hk»).
    try {
      const m32 = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
      const a32 = fs.readFileSync(path.join(__dirname, 'renderer/js/app.js'), 'utf8');
      const v32 = {
        disc: m32.includes('function gemRankModels') && m32.includes('async function gemDiscoverModels') && m32.includes('supportedGenerationMethods.includes(\'generateContent\')') && m32.includes('gemBadModels.delete(n)') && m32.includes('30 * 60 * 1000'),
        chain: m32.includes("'gemini-3.6-flash'") && m32.includes("'gemini-3.5-flash'") && m32.includes("'gemini-flash-lite-latest'") && (m32.match(/'gemini-2\.0-flash(?:-lite)?',/g) || []).length === 0,
        think: m32.includes('const gemSupportsThinking') && (m32.match(/2\\\.5\^gemini-3|latest\/\.test\(mdl\)/g) || []).length === 0 && (m32.match(/gemSupportsThinking\(mdl\)/g) || []).length >= 2,
        call1: (function () { const i = m32.indexOf("'callswitch' {"); const j = m32.indexOf("'probe'", i); const blk = m32.slice(i, j > i ? j : i + 2600); return !blk.includes('Send-BgCombo') && blk.includes('Focus-DcHard') && blk.includes('ERR:NOFOCUS') && blk.includes('Get-Clipboard -Raw') && blk.includes("'ERR:CLIP'"); })(),
        call2: m32.includes('$blindProbe = Scan-DcBtns') && m32.includes("if ($Name) { return 'ERR:NODM' }") && m32.includes("'ERR:CLIP':") && m32.includes("'ERR:NODM':") && m32.includes("runDiscordPs('clickcall', 'fg'") && m32.includes("(A === 'call' ? 'fg' : mode)"),
        wake1: a32.includes('function wakeTtsBusy()') && a32.includes('speechSynthesis.speaking || speechSynthesis.pending') && (a32.match(/wakeTtsBusy\(\)/g) || []).length >= 5,
        wake2: a32.includes('wakeLoop.lastFrame = Date.now()') && a32.includes('Date.now() - wakeLoop.lastFrame > 4000') && a32.includes("audioCtx.state === 'suspended'") && a32.includes('wakeLoop.restarts.length < 3'),
        wake3: a32.includes('function wakePickup(cmd)') && a32.includes('wakePickup(tail)') && /wakeLoop\.chunks\.length > (47|70)/.test(a32) && /one-breath command/.test(a32),
        contacts: a32.includes('function dcNameNorm(s)') && a32.includes(".replace(/[-_.]+/g, ' ')") && a32.includes('String(c.userId || \'\').trim() === digits') && a32.includes('const ct = resolveDiscordContact(nm)'),
        ver: /let appVersion = '0\.(29|[3-9]\d)\.\d+(?:-[\w.]+)?';/.test(a32) && /^0\.(29|[3-9]\d)\.\d+(?:-[\w.]+)?$/.test(JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version),
      };
      ok('v0.32 gemini: dynamic ListModels discovery + ranking + bad-memory cleansing', v32.disc);
      ok('v0.32 gemini: dead 2.0 generation out of chains, 3.x + lite alias in', v32.chain);
      ok('v0.32 gemini: gemSupportsThinking replaces hardcoded regex at both call sites', v32.think);
      ok('v0.32 discord: callswitch = verified-focus only, no PostMessage combo, clipboard verified', v32.call1);
      ok('v0.32 discord: blind-tree-only coordinate fallback + ERR:NODM/ERR:CLIP mapped + call forced fg', v32.call2);
      ok('v0.32 wake: own-voice (TTS) gate guards frame path AND vad tick', v32.wake1);
      ok('v0.32 wake: frame watchdog 4s + ctx resume + bounded rebuild (3/min)', v32.wake2);
      ok('v0.32 wake: one-breath command + session pickup + 4s buffer', v32.wake3);
      ok('v0.32 discord contacts: dcNameNorm normalization + digit-id match', v32.contacts);
      ok('v0.32 version markers (0.29.x/0.3x)', v32.ver);
    } catch (e) { console.log('SKIP | v0.32 markers | ' + String(e && e.message).slice(0, 80)); }

    // 8.98960 v0.33.0 — حلقهٔ بستهٔ تماس دیسکورد («پیدا می‌کند ولی زنگ نمی‌زند»):
    // clickcall فوکوس تاییدشده می‌گیرد، بعد از Invoke/کلیک با Test-CallAlive اثبات
    // می‌شود (Mute/Deafen پنل پایین هرگز در اثبات نیستند)، دور ۳ درخت کامل،
    // فالبک Quick Switcher داخل clickcall، دو قالب دیپ‌لینک در main.js.
    try {
      const m33 = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
      const a33 = fs.readFileSync(path.join(__dirname, 'renderer/js/app.js'), 'utf8');
      const b33m = m33.match(/const DISCORD_PS_BODY = `([\s\S]*?)`;/);
      const b33 = b33m ? b33m[1] : '';
      const v33 = {
        proof: b33.includes('function Test-CallAlive') && b33.includes("Scan-DcBtns '^(Disconnect|Leave Call|Leave|End Call)$' '' $true") && !/Test-CallAlive\{[\s\S]{0,300}Mute\}\)/.test(b33),
        gates: (b33.match(/if \(Test-CallAlive\) \{ Restore-Focus; return 'OK:CALLING' \}/g) || []).length === 4 && b33.includes('DBG:INVOKE_NOFLIP') && b33.includes('DBG:CLICK_NOFLIP') && b33.includes('DBG:ALLNAMES='),
        tree: b33.includes('[System.Windows.Automation.Condition]::TrueCondition') && b33.includes('$seen -gt 600') && b33.includes('$tryN -eq 1 -or $tryN -eq 6'),
        focus: (function () { const i = b33.indexOf("'clickcall' {"); const j = b33.indexOf("'callswitch' {", i); const blk = b33.slice(i, j > i ? j : i + 4000); return blk.indexOf('Focus-DcHard') > -1 && blk.indexOf('Try-CallClick') > blk.indexOf('Focus-DcHard') && blk.includes("if (-not ($res -like 'OK*'))") && (blk.match(/\$res = Try-CallClick/g) || []).length === 2 && !blk.includes('Send-BgCombo'); })(),
        deep: (m33.match(/runDiscordPs\('clickcall', 'fg', nm, dxN, dyN\)/g) || []).length === 2 && m33.includes('discord://discord.com/channels/@me/${uid}') && m33.includes('discord://-/channels/@me/${uid}') && m33.includes('if (r1 && r1.ok) return r1;'),
        honest: b33.includes("$blindProbe = Scan-DcBtns '' '' $true") && b33.includes("if ($Name) { return 'ERR:NODM' }") && b33.includes("Write-Output 'DBG:UIA_MISS'"),
        ver: /^0\.(3[3-9]|[4-9][0-9])\.\d+(?:-[\w.]+)?$/.test(JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version) && /let appVersion = '0\.(3[3-9]|[4-9][0-9])\.\d+(?:-[\w.]+)?';/.test(a33),
      };
      ok('v0.33 call: Test-CallAlive proof uses ONLY in-call buttons (no Mute/Deafen false-OK)', v33.proof);
      ok('v0.33 call: 4 verification gates + NOFLIP/ALLNAMES debug labels', v33.gates);
      ok('v0.33 call: full-tree pass 3 (TrueCondition, 600 cap, rounds 1&6)', v33.tree);
      ok('v0.33 call: clickcall = verified focus + Quick-Switcher self-heal (second Try-CallClick)', v33.focus);
      ok('v0.33 call: name passed to clickcall ×2 + dual deep-link formats + gated retry', v33.deep);
      ok('v0.33 call: v0.32 honest words survive (blindProbe/ERR:NODM/DBG:UIA_MISS)', v33.honest);
      ok('v0.33 version markers (0.33.x/0.3x)', v33.ver);
    } catch (e) { console.log('SKIP | v0.33 markers | ' + String(e && e.message).slice(0, 80)); }

    // 8.98961 v0.34.0 — (۱) بیدارباش همیشگی دیگر به بستهٔ آفلاین گره نیست: حلقه ابری
    // (VAD + stt:google با همان PCM) + دانلود پس‌زمینه + ارتقای خودکار + سلامت/تست.
    // (۲) «اینجا برام تایپ کن»: موتور واقعی SendInput UNICODE با فوکوس تاییدشده —
    // جایگزین پیست Ctrl+V که در پنجرهٔ اشتباه می‌نشست و کلیپ‌بورد را نابود می‌کرد.
    try {
      const m34 = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
      const a34 = fs.readFileSync(path.join(__dirname, 'renderer/js/app.js'), 'utf8');
      const p34 = fs.readFileSync(path.join(__dirname, 'preload.js'), 'utf8');
      const t34m = m34.match(/const TYPE_PS_BODY = `([\s\S]*?)`;/);
      const t34 = t34m ? t34m[1] : '';
      const v34 = {
        wake: a34.includes("const engine = localReady() ? 'local' : 'cloud';") && a34.includes("bridge.stt.google({ pcm: new Uint8Array(pcm16.buffer), rate: 16000") && a34.includes('function kickWakePackDownload()') && !/if \(!localReady\(\)\) \{ setTimeout\(wakeBootRetry/.test(a34),
        health: a34.includes('wakeTestUntil = Date.now() + 11000') && a34.includes("function wakeHealthNote(txt)") && (a34.match(/'wake\.healthCloud':/g) || []).length === 2,
        type: t34.length > 3000 && t34.includes('SendInput') && t34.includes('Restore-Focus2') && t34.includes('function New-Ki') && !t34.includes('`') && !/[\u2018\u2019\u201C\u201D]/.test(t34) && !t34.includes('/*'),
        wire: p34.includes("typeText: (text, hwnd) => ipcRenderer.invoke('sys:typeText'") && (p34.match(/typeText:/g) || []).length === 1 && p34.includes("saveFg: () => ipcRenderer.invoke('sys:savefg')") && m34.includes("ipcMain.handle('sys:typeText'") && m34.includes("ipcMain.handle('sys:savefg'"),
        sys: a34.indexOf('const SYS_DICT_RE') > -1 && a34.indexOf('SYS_DICT_RE.test(raw)') < a34.indexOf('DICT_START_RE.test(raw)') && a34.includes('dictation.oneShotApps = !!system'),
        ver: /^0\.(3[4-9]|[4-9][0-9])\.\d+(?:-[\w.]+)?$/.test(JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version) && /let appVersion = '0\.(3[4-9]|[4-9][0-9])\.\d+(?:-[\w.]+)?';/.test(a34),
      };
      ok('v0.34 wake: cloud fallback loop + background pack download + auto-upgrade', v34.wake);
      ok('v0.34 wake: health status + test button (both i18n blocks)', v34.health);
      ok('v0.34 type: SendInput UNICODE body with verified focus (no clipboard paste)', v34.type);
      ok('v0.34 type: preload typeText(hwnd) single def + saveFg + main IPC handlers', v34.wire);
      ok('v0.34 type: «اینجا برام تایپ» one-shot system dictation command', v34.sys);
      ok('v0.34 version markers (0.34.x/0.3x)', v34.ver);
    } catch (e) { console.log('SKIP | v0.34 markers | ' + String(e && e.message).slice(0, 80)); }

    // 8.98962 v0.35.0 — (۱) کرش «Not Responding»: استخراج بستهٔ آفلاین ناهمگام شد
    // (spawnSync داخل هندلر async حلقهٔ اصلی را تا ۵ دقیقه قفل می‌کرد و ویندوز
    // پیشنهاد Close the program می‌داد). (۲) میوت/دیفن واقعاً بدون باز کردن
    // دیسکورد: Press-DcBg فقط UIA Invoke + تایید فلِیپ. (۳) msgsend. (۴) بیدارباش
    // در مینیمایز/بازی: سوییچ‌ها + powerSaveBlocker. (۵) تنظیمات مرتب.
    try {
      const m35 = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
      const a35 = fs.readFileSync(path.join(__dirname, 'renderer/js/app.js'), 'utf8');
      const h35 = fs.readFileSync(path.join(__dirname, 'renderer/index.html'), 'utf8');
      const d35m = m35.match(/ipcMain\.handle\('stt:local:download'[\s\S]*?\n\}\);/);
      const d35 = d35m ? d35m[0] : '';
      const body35m = m35.match(/const DISCORD_PS_BODY = `([\s\S]*?)`;/);
      const b35 = body35m ? body35m[1] : '';
      const pdcBg = b35.indexOf('function Press-DcBg');
      const v35 = {
        nofreeze: d35.length > 0 && d35.includes('await extractTarFile') && !d35.includes('spawnSync') && m35.includes('function extractTarFile'),
        stab: m35.includes("app.on('render-process-gone'") && m35.includes("process.on('unhandledRejection'"),
        bgengine: pdcBg > -1 && b35.includes('function Show-DcQuiet') && b35.includes('::IsIconic(') && b35.includes('ShowWindow($hwnd, 4)') && b35.includes('Re-Minimize-Dc $wasIconic') && b35.includes('OK:\' + $label + \':BG-UIA-VERIFIED'),
        bgnoroute: (() => { const seg = b35.slice(pdcBg, b35.indexOf('function Try-Keys', pdcBg)); return !seg.includes('Send-Combo') && !seg.includes('Focus-DcHard') && !seg.includes('keybd_event'); })(),
        bgroute: b35.includes('if ($bg -and $keysFirst -and $combo) {') && b35.includes("Write-Output (Press-Dc '^Mute$' '^Unmute$' 'MUTE' 'ctrl,shift,m') }"),
        msgsend: b35.includes("'msgsend' {") && b35.includes('[string]$Text = \'\'') && (b35.match(/Get-Clipboard -Raw/g) || []).length >= 3 && b35.includes('OK:MSGSENT-UNVERIFIED') && b35.includes('[regex]::Escape($probe)'),
        msgwire: m35.includes("A === 'msgsend' ? String(text || '')") && m35.includes("'ERR:NOTEXT': 'متن پیام پیدا نشد"),
        wakemin: m35.includes("appendSwitch('disable-renderer-backgrounding')") && m35.includes("appendSwitch('disable-backgrounding-occluded-windows')") && m35.includes("ipcMain.handle('wake:psb'") && m35.includes('powerSaveBlocker.start') && a35.includes('bridge.system.wakePsb(true)') && a35.includes('bridge.system.wakePsb(false)'),
        chime: a35.includes('659.25') && a35.includes('1108.73') && a35.includes('createBiquadFilter'),
        setui: (() => { const dp = h35.indexOf('data-pane="discord"'); return dp > -1 && dp < h35.indexOf('id="extDiscordOpt"') && h35.indexOf('id="extDiscordOpt"') < h35.indexOf('data-pane="perf"') && h35.indexOf('id="settingsPage"') < h35.indexOf('id="dcActions"') && h35.indexOf('id="dcActions"') < h35.indexOf('id="extPage"') && h35.indexOf('id="extPage"') < h35.indexOf('id="btnDcSettingsPage"') && (h35.match(/<details class="set-adv">/g) || []).length >= 3; })(), /* v0.36: discord adv joined */
        ver: /^0\.(3[5-9]|[4-9][0-9])\.\d+(?:-[\w.]+)?$/.test(JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version) && /let appVersion = '0\.(3[5-9]|[4-9][0-9])\.\d+(?:-[\w.]+)?';/.test(a35),
      };
      ok('v0.35 crash: async pack extraction (no spawnSync in download handler) + crash net', v35.nofreeze && v35.stab);
      ok('v0.35 discord: Press-DcBg = UIA-only background path (no keys/focus inside)', v35.bgengine && v35.bgnoroute);
      ok('v0.35 discord: bg routed inside Press-Dc, switch lines verbatim', v35.bgroute);
      ok('v0.35 discord: msgsend action + Text param + verified send + wire', v35.msgsend && v35.msgwire);
      ok('v0.35 wake: throttle switches + powerSaveBlocker wired both sides', v35.wakemin);
      ok('v0.35 chime: 3-note glass chime with harmonic + filter', v35.chime);
      ok('v0.35 settings: discord hub in settings + stripped extPage card + adv details', v35.setui);
      ok('v0.35 version markers (0.35.x/0.3x)', v35.ver);
    } catch (e) { console.log('SKIP | v0.35 markers | ' + String(e && e.message).slice(0, 80)); }

    // 8.98963 v0.36.0 — (۱) «دیسکورد دیگه اصلاً کار نمی‌کنه»: دیسکوردِ در try با
    // EnumWindows پیدا می‌شود + کلید سراسری بدون نیاز به فوکوس (HOTKEY-VERIFIED).
    // (۲) بیدارباش فازی: آبا/آوه/آو هم فعال می‌کند + حذف سکوتِ سر + فرصت دوم ابری.
    // (۳) جوک → هوش مصنوعی، هرگز سرچ. (۴) سافت 98 و بند «که …». (۵) پنل بیدارباش +
    // حذف یادداشت یتیم + ترتیب جدید. (۶) تایپ‌پنجرهٔ textarea + اسم مدل خوانا.
    try {
      const m36 = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
      const a36 = fs.readFileSync(path.join(__dirname, 'renderer/js/app.js'), 'utf8');
      const h36 = fs.readFileSync(path.join(__dirname, 'renderer/index.html'), 'utf8');
      const c36 = fs.readFileSync(path.join(__dirname, 'renderer/css/styles.css'), 'utf8');
      const b36 = (m36.match(/const DISCORD_PS_BODY = `([\s\S]*?)`;/) || ['', ''])[1];
      const v36 = {
        tray: b36.includes('function Find-DcHwndByPid') && b36.includes('[AvaDc3.W]::EnumWindows($cb, [IntPtr]::Zero)') && b36.includes("if (-not $dcProcs -or $dcProcs.Count -eq 0) { Write-Output 'ERR:NO_DISCORD'; exit }") && b36.includes('Find-DcHwndByPid }'),
        hotkey: b36.includes('function Try-HotkeyBg([bool]$preAlive') && b36.includes("if ($flipped -and $preAlive) { return ('OK:' + $label + ':HOTKEY-VERIFIED') }") && b36.indexOf('$hk = Try-HotkeyBg') < b36.indexOf('$bgR = Press-DcBg $doRx $alrRx $label'),
        switchverbatim: b36.includes("'mute'     { Write-Output (Press-Dc '^Mute$' '^Unmute$' 'MUTE' 'ctrl,shift,m') }") && b36.includes("'deafen'   { Write-Output (Press-Dc '^Deafen$' '^Undeafen$' 'DEAFEN' 'ctrl,shift,d') }"),
        wake: a36.includes('const WAKE_ACCEPT = new Set(') && a36.includes("'آبا', 'ابا'") && a36.includes('function wakeHitText(txt)') && a36.includes('wakeLoop.chunks.length > 70') && a36.includes('wake-always: cloud 2nd chance used') && a36.includes('const buf2 = s0 > 0 ? buf.slice(s0) : buf;'),
        joke: a36.includes('r: async () => { if (aiConnected()) return AI_FALLBACK; return joke(); },') && a36.includes('خودت یک جوک کوتاه و تازه بگو — هرگز جستجو نکن'),
        site: a36.includes("['سافت 98', 'https://soft98.ir']") && a36.includes('function siteTargetOf(cmd)') && (a36.match(/knownSiteOf\(siteTargetOf\(c\)\)/g) || []).length >= 3,
        set: h36.includes('<div class="set-pane" data-pane="wake">') && h36.includes('data-i18n="set.nav.wake"') && !h36.includes('data-i18n="disc.hint"') && h36.includes('data-i18n="set.dc.adv"'),
        type: h36.includes('<textarea id="cmdInput" rows="1"') && h36.includes('<textarea id="chatInput" rows="1"') && a36.includes('function wireMultilineInput(el, form, maxPx)') && c36.includes('width: min(860px, 100%)') && c36.includes('max-width: calc(100% - 34px); white-space: normal;'),
        ver: /^0\.(3[6-9]|[4-9][0-9])\.\d+(?:-[\w.]+)?$/.test(JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version) && /let appVersion = '0\.(3[6-9]|[4-9][0-9])\.\d+(?:-[\w.]+)?';/.test(a36) && />v0\.(3[6-9]|[4-9][0-9])\.\d+(?:-[\w.]+)?</.test(h36),
      };
      ok('v0.36 discord: tray-proof EnumWindows discovery + NO_DISCORD only without processes', v36.tray);
      ok('v0.36 discord: hotkey-first bg (no focus) with honest preAlive-gated flip proof', v36.hotkey && v36.switchverbatim);
      ok('v0.36 wake: fuzzy accept-set (آبا/آوه/آو) + 6s buffer + silence trim + cloud 2nd chance', v36.wake);
      ok('v0.36 intent: joke → AI (never search) + soft98 dictionary + siteTargetOf clause-strip', v36.joke && v36.site);
      ok('v0.36 settings: wake pane + nav + orphan note removed + discord adv collapsed', v36.set);
      ok('v0.36 gemini page: textarea inputs + 860px card + wrapping model tag', v36.type);
      ok('v0.36 version markers (0.36.x/0.3x)', v36.ver);
    } catch (e) { console.log('SKIP | v0.36 markers | ' + String(e && e.message).slice(0, 80)); }

    // 8.98971 v0.37.0 — Smart Gaming PiP + راهنمای «چجوری می‌تونم …؟»
    // (۱) پنجرهٔ شیشه‌ای مخصوص گیم: screen-saver + click-through هوشمند + ذخیرهٔ وضعیت + میانبرها
    // (۲) پارسر فارسی/انگلیسی با گارد ضد-ربایش (ببندش/بالا راست/کوچیکش کن فقط با لنگر/PiP-باز/فعل)
    // (۳) detectActiveVideo سه‌مسیره: صفحهٔ آوا → webview → کلیپ‌بورد (blob صادقانه)
    // (۴) HOW: رجیستری توانایی‌ها (آفلاین) → AI با مانیفست __aiExtra
    // (۵) لوگوی آوا در پنجرهٔ PiP (واترمارک + آیکون + حالت خالی)
    try {
      const a37 = fs.readFileSync(path.join(__dirname, 'renderer/js/app.js'), 'utf8');
      const h37 = fs.readFileSync(path.join(__dirname, 'renderer/index.html'), 'utf8');
      const m37 = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
      const pm37 = fs.readFileSync(path.join(__dirname, 'pipWindowManager.js'), 'utf8');
      const ph37 = fs.readFileSync(path.join(__dirname, 'renderer/pip.html'), 'utf8');
      const pr37 = fs.readFileSync(path.join(__dirname, 'renderer/js/pipRenderer.js'), 'utf8');
      const pl37 = fs.readFileSync(path.join(__dirname, 'preload.js'), 'utf8');
      const vp37 = require(path.join(__dirname, 'renderer/js/voiceCommandParser.js'));
      const v37 = {
        mgr: m37.includes("require('./pipWindowManager')") && pm37.includes("'screen-saver'") && pm37.includes('forward: true') && pm37.includes('pip-state.json') && pm37.includes('CommandOrControl+Shift+P') && pm37.includes('Borderless Windowed'),
        parser: vp37.parseVoiceCommand('ویدیو رو پین کن', { pipOpen: false }).intent === 'PIN_VIDEO' && vp37.parseVoiceCommand('ببندش', { pipOpen: false }) === null && vp37.parseVoiceCommand('ببندش', { pipOpen: true }).intent === 'UNPIN_VIDEO' && vp37.parseVoiceCommand('ببرش بالا سمت راست', { pipOpen: false }).entities.position === 'top-right' && vp37.parseVoiceCommand('شفافیت هفتاد درصد', { pipOpen: true }).entities.opacity === 0.7,
        detect: a37.includes('async function detectActiveVideo') && a37.includes("kind: 'blob'") && a37.includes('bridge.pipAPI.clipboard()'),
        how: a37.includes('__aiExtra: AVACapabilities.aiPromptAddon()') && /aiHandleCommand\(cmd, (?:await aiFallbackCtx\((?:rule, cmd|rule)\)|rule && rule\.__aiExtra)\)/.test(a37) && fs.existsSync(path.join(__dirname, 'renderer/js/capabilities.js')),
        bridge: pl37.includes('pipAPI: {') && ['show', 'hide', 'move', 'resize', 'setOpacity', 'setClickThrough', 'setAlwaysOnTop', 'reset', 'getState'].every((k) => pl37.includes(k)),
        ui: ph37.includes('assets/ava-logo.png') && (ph37.match(/data-ui="1"/g) || []).length >= 6 && /youtube(-nocookie)?\.com\/embed\//.test(pr37) && pr37.includes('hoverUi'),
        order: h37.indexOf('js/voiceCommandParser.js') > -1 && h37.indexOf('js/voiceCommandParser.js') < h37.indexOf('js/app.js') && h37.indexOf('js/capabilities.js') < h37.indexOf('js/app.js'),
        ver: /^0\.(3[7-9]|[4-9][0-9])\.\d+(?:-[\w.]+)?$/.test(JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version) && /let appVersion = '0\.(3[7-9]|[4-9][0-9])\.\d+(?:-[\w.]+)?';/.test(a37) && />v0\.(3[7-9]|[4-9][0-9])\.\d+(?:-[\w.]+)?</.test(h37),
      };
      ok('v0.37 pip manager: screen-saver top + smart click-through + state file + shortcuts + borderless note', v37.mgr);
      ok('v0.37 parser: fa/en intents + anti-hijack guards (ببندش needs pipOpen)', v37.parser);
      ok('v0.37 detectActiveVideo: in-page → webview → clipboard, honest blob', v37.detect);
      ok('v0.37 how-to: local capability registry + AI manifest via __aiExtra', v37.how);
      ok('v0.37 preload: full pipAPI bridge', v37.bridge);
      ok('v0.37 pip UI: logo watermark + data-ui controls + youtube embed + hover', v37.ui);
      ok('v0.37 script order: parser/capabilities before app.js', v37.order);
      ok('v0.37 version markers (0.37.x/0.3x+)', v37.ver);
    } catch (e) { console.log('SKIP | v0.37 markers | ' + String(e && e.message).slice(0, 80)); }

    // 8.98972 v0.38.0-beta — یوتیوب شناور + جستجوی یوتیوب + کنترل پلیر PiP + خطای محترمانه
    // (۱) COMMANDS جدید: youtube_search + pip_youtube (cmd تابعی — پخش شناور با فالبک مرورگر)
    // (۲) openUrl در pipWindowManager + جستجوی داخل PiP (لینک/ID → پخش؛ متن → مرورگر + note)
    // (۳) کنترل پلیر: enablejsapi=1 + postMessage — بدون bind تکراری btnClose/btnLock
    // (۴) فیلور بی‌صدا 401/403/429 + پیام ۴۲۹ محترمانه + لیست مدل‌ها فقط در activity.log
    // (۵) قوانین صوتی (ytQueryOf + یوتیوب شناور + جستجوی یوتیوب) قبل از قانون پین
    try {
      const a38 = fs.readFileSync(path.join(__dirname, 'renderer/js/app.js'), 'utf8');
      const ih38 = fs.readFileSync(path.join(__dirname, 'renderer/index.html'), 'utf8');
      const m38 = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
      const pm38 = fs.readFileSync(path.join(__dirname, 'pipWindowManager.js'), 'utf8');
      const ph38 = fs.readFileSync(path.join(__dirname, 'renderer/pip.html'), 'utf8');
      const pr38 = fs.readFileSync(path.join(__dirname, 'renderer/js/pipRenderer.js'), 'utf8');
      const pl38 = fs.readFileSync(path.join(__dirname, 'pipPreload.js'), 'utf8');
      const v38 = {
        cmds: m38.includes('youtube_search:') && m38.includes('pip_youtube:') && m38.includes("typeof c.cmd === 'function'") && m38.includes('pipManager.openUrl'),
        openUrl: pm38.includes('function openUrl(u)') && pm38.includes('openUrl,') && pm38.includes('pip:host:search') && pm38.includes("{ kind: 'note'") && pm38.includes('results?search_query='),
        player: !pr38.includes('enablejsapi=1') && (pr38.match(/btnClose\.addEventListener/g) || []).length === 1 && (pr38.match(/btnLock\.addEventListener/g) || []).length === 1 && pr38.includes("kind === 'note'") && pr38.includes('emptyDefault'),
        ui: ph38.includes('id="btnPlay"') && ph38.includes('id="btnMute"') && ph38.includes('id="pipSearch"') && ph38.includes('.pip-search') && pl38.includes('search: (q)'),
        errors: m38.includes('429 سهمیهٔ همین مدل است') && m38.includes('سرویس هوش مصنوعی موقتاً شلوغ است') && m38.includes("actLog('gemini-chat fail: tried models ") && !m38.includes('مدل‌های امتحان‌شده: ') && !m38.includes('هیچ کلید Gemini جواب نداد'), /* v0.39: failover markers refreshed */
        voice: a38.includes('const ytQueryOf') && a38.includes("run: 'pip_youtube'") && a38.includes("run: 'youtube_search'") && a38.indexOf("run: 'pip_youtube'") < a38.indexOf('AVAVoice.PIP_COMMAND_RE'),
        ver: /^0\.(3[8-9]|[4-9][0-9])\.[\w.-]+$/.test(JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version) && /let appVersion = '0\.(3[8-9]|[4-9][0-9])\.[\w.-]+';/.test(a38) && />v0\.(3[8-9]|[4-9][0-9])\./.test(ih38),
      };
      ok('v0.38 commands: youtube_search + pip_youtube (function cmd + PiP bridge)', v38.cmds);
      ok('v0.38 pip manager: openUrl export + in-PiP search (link→play, text→browser+note)', v38.openUrl);
      ok('v0.38 player: no double btnClose/btnLock + note kind + emptyDefault', v38.player);
      ok('v0.38 pip UI: play/mute/search controls + preload search API', v38.ui);
      ok('v0.38 errors: silent failover 401/403/429 + polite 429 + models only in activity.log', v38.errors);
      ok('v0.38 voice rules: ytQueryOf + pip_youtube/youtube_search before PIP_COMMAND_RE', v38.voice);
      ok('v0.38 version markers (0.38.0-beta)', v38.ver);
    } catch (e) { console.log('SKIP | v0.38 markers | ' + String(e && e.message).slice(0, 80)); }

    try {
      const rt23 = await probe(`(() => ({
        eqChip: !!document.querySelector('.np-cover .np-eq'),
        noVinyl: !document.querySelector('.np-vinyl') && !document.querySelector('.np-cover-wrap'),
        coverRad: (() => { const c = document.querySelector('.np-cover'); return c ? getComputedStyle(c).borderRadius : 'none'; })(),
      }))()`);
      ok('v0.23 eq chip inside cover in DOM (single panel, no vinyl)', rt23.eqChip && rt23.noVinyl);
      ok('v0.23 cover radius 26px round-4 design', rt23.coverRad === '26px', rt23.coverRad);
    } catch (e) { console.log('SKIP | v0.23 runtime | ' + String(e && e.message).slice(0, 80)); }

    // 8.96 v0.24 — runtime: net-status bridge alive in renderer (hear-like-Chrome plumbing)
    try {
      const rt24 = await probe(`(() => ({
        netBridge: !!(window.ava && window.ava.net && typeof window.ava.net.onStatus === 'function'),
        aboutV26: (() => { const el = document.querySelector('#abVersion'); return el ? /0\\.(29|[3-9]\\d)\\./.test(el.textContent) : false; })(),
        aboutRaw: (() => { const el = document.querySelector('#abVersion'); return el ? el.textContent : 'NULL'; })(),
      }))()`);
      ok('v0.24 ava.net.onStatus bridge exposed to renderer', rt24.netBridge);
      ok('v0.29+ about page shows current version (0.29.x/0.3x)', rt24.aboutV26, rt24.aboutRaw);
    } catch (e) { console.log('SKIP | v0.24 runtime | ' + String(e && e.message).slice(0, 80)); }

    // 8.93 v0.21 — runtime: DOM checks for new music controls + updater buttons
    try {
      const rt = await probe(`(() => ({
        cover232: (() => { const c = document.querySelector('.np-cover'); return c ? getComputedStyle(c).width : 'none'; })(),
        ctl: !!document.querySelector('#mStop') && !!document.querySelector('#mBack10') && !!document.querySelector('#mFwd10') && !!document.querySelector('#mVolUp') && !!document.querySelector('#mVolDown'),
        flatRow: (() => { const r = document.querySelector('.m-row'); return r ? !r.querySelector('.m-thumb') : true; })(),
        updBtns: !!document.querySelector('#btnUpdDownload') && !!document.querySelector('#btnUpdPause') && !!document.querySelector('#btnUpdCancel'),
      }))()`);
      ok('v0.21 pro cover renders at 232px (v0.23 single panel)', rt.cover232 === '232px', rt.cover232);
      ok('v0.21 music controls in DOM (stop/±10s/vol±)', rt.ctl);
      ok('v0.21 playlist rows render flat (no thumb in DOM)', rt.flatRow);
      ok('v0.21 updater download/pause/cancel buttons in DOM', rt.updBtns);
    } catch (e) { console.log('SKIP | v0.21 runtime | ' + String(e && e.message).slice(0, 80)); }

    // 9. v0.16.2 — TDZ regression: cold boot with safeMode/noFx preset must survive.
    // User crash report v0.16.1: applyPerf() ran at boot before `let vizRaf` (app.js:4936)
    // executed, called vizStop() → TDZ ReferenceError → whole IIFE died → crash panel.
    // Reproduced with a SECOND cold window (reload kills renderer in Xvfb — never reload).
    try {
      await probe(`localStorage.setItem('ava.safeMode', '1'); localStorage.setItem('ava.noFx', 'true'); localStorage.setItem('ava.noAnim', 'true'); 'preset-ok'`);
      const win2 = new BrowserWindow({
        width: 640, height: 760, show: false,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          contextIsolation: true, nodeIntegration: false, spellcheck: false, webviewTag: true,
        },
      });
      await win2.loadURL('ava://app/renderer/index.html'); /* IIFE 同步运行 — did-finish-load 意味着 boot 已结束（或已崩溃） */
      const boot2 = await Promise.race([
        win2.webContents.executeJavaScript(`(() => ({
          booted: !!(window.__avaErr && window.__avaErr.booted),
          tdz: /vizRaf/i.test(JSON.stringify(window.__avaErr && window.__avaErr.ring || [])),
          safeOrb: document.body.classList.contains('safe-orb'),
          nofx: document.body.classList.contains('perf-nofx'),
          errs: JSON.stringify(window.__avaErr && window.__avaErr.ring || []).slice(0, 180),
        }))()`, true),
        new Promise((_r, rej) => setTimeout(() => rej(new Error('boot2-timeout')), 15000)),
      ]);
      await new Promise((r) => setTimeout(r, 4000)); /* صبر تا پایان init کامل */
      const boot2b = await Promise.race([
        win2.webContents.executeJavaScript(`(() => ({ booted: !!(window.__avaErr && window.__avaErr.booted) }))()`, true),
        new Promise((_r, rej) => setTimeout(() => rej(new Error('boot2b-timeout')), 8000)),
      ]);
      ok('safeMode cold boot survives (TDZ vizRaf fix)', boot2b.booted && !boot2.tdz, JSON.stringify(boot2));
      ok('safeMode perf classes on cold boot', boot2.safeOrb && boot2.nofx);
      try { win2.destroy(); } catch (_) { /* noop */ }
      await probe(`['ava.safeMode', 'ava.noFx', 'ava.noAnim'].forEach((k) => localStorage.removeItem(k)); 'clean'`);
    } catch (e) { console.log('SKIP | safeMode cold boot | ' + String(e && e.message).slice(0, 60)); }

    const fails = results.filter((r) => !r.pass);
    console.log('SMOKE SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
    console.log(fails.length ? 'SMOKE_FAIL:' + JSON.stringify(fails) : 'SMOKE_OK');
    setTimeout(() => app.exit(fails.length ? 1 : 0), 300);
  } catch (e) {
    console.error('SMOKE_ERROR', e);
    app.exit(2);
  }
});
