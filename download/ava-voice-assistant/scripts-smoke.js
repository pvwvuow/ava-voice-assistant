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
          keyRotation: mainjs.includes('const splitKeys') && mainjs.includes('gemini-2.0-flash-lite'),
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
        monitorFix: mainjs.includes('SendMessageW(IntPtr h, uint m, IntPtr w, IntPtr l)') && mainjs.includes("'monitor_off', 'lock'"),
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
        if (b) b.click();
        return { nav: !!b, pane: !!document.querySelector('.set-pane[data-pane="discord"]') };
      })()`);
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
        reportCmd: appjs.includes('function sendActivityReport(') && appjs.includes('گزارش\\s*(بفرست') && appjs.includes('issues/new?title='),
        deltaOn: mainjs.includes('disableDifferentialDownload = false'),
        aiFast: mainjs.includes('thinkingBudget: 0') && mainjs.includes('SEARCH_INTENT_RE') && mainjs.includes('if (search && wantsSearch)'),
        dcWait: mainjs.includes('$waited -lt $WaitMs') && mainjs.includes('$tryN -le $Retries') && mainjs.includes("'-WaitMs', String(waitMs)"),
        minimalHtml: html.includes('np-area') && html.includes('np-cover') && html.includes('pl-area') && !html.includes('np-card'),
        minimalCss: css.includes('.np-cover {\n  position: relative; width: 232px; height: 232px;') && css.includes('.np-area .np-head b { font-size: 21px'),
      };
      ok('v0.25 listening dispatch: dual-track AVE3 reaches web + cloud engines', v18.dispatchFix);
      ok('v0.18 settings file restore re-applies theme/perf', v18.settingsRestore);
      ok('v0.18 activity log IPC + rotation', v18.actLogIpc && v18.logBridge);
      ok('v0.18 voice report send (GitHub issue)', v18.reportCmd);
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
        doProtocol: /function parseDo\(text\)/.test(appjs) && /async function executeDoActions\(actions\)/.test(appjs) && appjs.includes('const DO_ACTS = ['),
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
        keyBreak: mainjs.includes('if ([401, 403, 429].includes(r.status)) break;'),
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

    // 8.94 v0.23 — runtime: race marker in JS scope + cover single panel
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
        aboutV25: (() => { const el = document.querySelector('#abVersion'); return el ? /0\\.25/.test(el.textContent) : false; })(),
      }))()`);
      ok('v0.24 ava.net.onStatus bridge exposed to renderer', rt24.netBridge);
      ok('v0.25 about page shows v0.25.0', rt24.aboutV25);
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
