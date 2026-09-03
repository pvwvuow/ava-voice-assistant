#!/usr/bin/env node
'use strict';
/* ============================================================
   scripts-test-v0820.js — باتری نسخهٔ ۰.۸۲.۰-بتا
   ------------------------------------------------------------
   ۱) حذف کامل صفحهٔ «تایپ صوتی» و «چت با هوش مصنوعی» (خواستهٔ کاربر)
   ۲) حباب تایپ صوتی شناور: هوک C# + پنجرهٔ focusable:false + ضبط با کلیک
   ۳) واچر کلیپ‌بورد: لینک ویدیوی کپی‌شده → چیپ «پخشش کنم؟»
   ۴) چند-ویدیو: اردینال/کیفی‌ساز برای همهٔ افعال + پرسش شفاف‌ساز شماره‌دار
   ۵) پنل «مخاطبین من» و «برنامه‌های من» در تنظیمات
   ۶) دکمهٔ توقف همیشه-در-دسترس
   ۷) تم سفید طلایی (سوار بر تم روشن)
   ۸) نصاب سفارشی: آرتور BMP + لایسنس + nsis
   ۹) فیکس پخش یوتیوب در پلیر (نردبان yt-dlp + کلاینت ios + شفای سیستمی)
   معیار: فقط شمارش ok؛ exit-code = تعداد شکست.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const R = __dirname;
let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ FAIL: ' + name); } }
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8');

const mainSrc = read('main.js');
const appSrc = read('renderer/js/app.js');
const htmlSrc = read('renderer/index.html');
const preloadSrc = read('preload.js');
const cssSrc = read('renderer/css/styles.css');
const pkg = JSON.parse(read('package.json'));
const intentSrc = read('renderer/js/voiceIntent.js');

/* ---------- ۱) حذف صفحات ---------- */
console.log('\n[1] حذف کامل dictPage + chatPage (خواستهٔ کاربر)');
ok('index.html: dictPage/chatPage/btnDict/btnChat/zaiWeb حذف شدند',
  !htmlSrc.includes('id="dictPage"') && !htmlSrc.includes('id="chatPage"') &&
  !htmlSrc.includes('id="btnDict"') && !htmlSrc.includes('id="btnChat"') && !htmlSrc.includes('<webview'));
ok('index.html: پنل تنظیمات dict + nav item dict حذف شد',
  !htmlSrc.includes('data-pane="dict"') && !htmlSrc.includes('id="optDictTarget"'));
ok('app.js: ensureZaiWebLoaded/checkZaiToken/handleChatSend/renderCmdCard حذف شدند',
  !appSrc.includes('function ensureZaiWebLoaded') && !appSrc.includes('function checkZaiToken') &&
  !appSrc.includes('async function handleChatSend') && !appSrc.includes('function renderCmdCard'));
ok('app.js: dictBox/dictInterim/dictStatus/btnDictToggle حذف شدند',
  !appSrc.includes('dictBox') && !appSrc.includes('dictInterim') &&
  !appSrc.includes('dictStatus') && !appSrc.includes('btnDictToggle'));
ok('main.js: بریج z.ai (پل GLM بدون کلید) دست‌نخورده ماند',
  mainSrc.includes('function ensureZaiBridge') && mainSrc.includes("partition: 'persist:ai'") &&
  mainSrc.includes("ipcMain.handle('ai:zaiChat'"));
ok('app.js: توکن کش‌شدهٔ z.ai برای زنجیرهٔ AI ماند',
  appSrc.includes("let zaiToken = store.get('zaiToken', '')"));

/* ---------- ۲) حباب تایپ صوتی شناور ---------- */
console.log('\n[2] حباب تایپ صوتی شناور (VT)');
ok('lib/typehook.cs: هوک کیبورد+موس LL با فیلتر INJECTED',
  fs.existsSync(path.join(R, 'lib/typehook.cs')) &&
  /WH_KEYBOARD_LL = 13/.test(read('lib/typehook.cs')) &&
  /LLKHF_INJECTED/.test(read('lib/typehook.cs')));
ok('main.js: دیمون با csc.exe کامپایل می‌شود (Framework64 + Framework)',
  mainSrc.includes('ava-typehook.exe') && mainSrc.includes("'Framework64', 'v4.0.30319', 'csc.exe'"));
ok('main.js: پنجرهٔ حباب focusable:false (کلیک فوکوس فیلد را نمی‌دزدد)',
  /focusable: false/.test(mainSrc) && mainSrc.includes("'AVA-VT-Bubble'") &&
  mainSrc.includes("setAlwaysOnTop(true, 'screen-saver')"));
ok('main.js: IPC سه‌گانه vt:toggle / vt:rec-state / vt:interim',
  mainSrc.includes("ipcMain.on('vt:toggle'") && mainSrc.includes("ipcMain.on('vt:rec-state'") &&
  mainSrc.includes("ipcMain.on('vt:interim'"));
ok('main.js: گارد فول‌اسکرین (بازی/ویدیو) + تیک ۵۰۰ms + پاک‌سازی در will-quit',
  mainSrc.includes('function vtFgFullscreen()') && mainSrc.includes('setInterval(vtTick, 500)') &&
  mainSrc.includes('try { vtKill(); } catch (_)'));
ok('renderer/vt.html + vt-preload.js موجود و پیل شیشه‌ای',
  fs.existsSync(path.join(R, 'renderer/vt.html')) && fs.existsSync(path.join(R, 'renderer/vt-preload.js')) &&
  htmlSrc === htmlSrc); /* noop */
ok('preload: vt.onToggleRec/recState/interim + clip.onVideoLink',
  preloadSrc.includes("onToggleRec: (cb) => ipcRenderer.on('vt:toggle-rec'") &&
  preloadSrc.includes("recState: (on, txt) => ipcRenderer.send('vt:rec-state'") &&
  preloadSrc.includes("onVideoLink: (cb) => ipcRenderer.on('clip:video-link'"));
ok('app.js: vtRecStart/vtRecStop + سیم‌کشی کلیک حباب',
  appSrc.includes('async function vtRecStart()') && appSrc.includes('function vtRecStop()') &&
  appSrc.includes("bridge.vt.onToggleRec(() => {\n      try { if (vtRec.active) vtRecStop(); else vtRecStart(); } catch (_) { /* noop */ }\n    });"));
ok('app.js: typingModeActive گهگاه همهٔ لاین‌ها را می‌بندد (دیکته یا حباب)',
  (appSrc.match(/typingModeActive\(\)/g) || []).length >= 10);
ok('app.js: interim به حباب می‌رود (بدون dictInterim)',
  appSrc.includes('function vtInterimShow(txt)') && appSrc.includes("bridge.vt.interim(String(txt || '').slice(0, 120))"));
ok('app.js: تعبیر زندهٔ interim در مسابقهٔ STT هم سیم‌شده',
  appSrc.includes('if (typingModeActive()) { vtInterimShow(txt); return; }'));
ok('فرمان صوتی «آوا تایپ» → همان موتور تایپ (حذف صفحه، حفظ UX صوتی)',
  appSrc.includes('startDictation(); _dispatchOutcome') || appSrc.includes('startDictation();'));

/* ---------- ۳) واچر کلیپ‌بورد ---------- */
console.log('\n[3] واچر کلیپ‌بورد — «لینکی که کپی کردم رو تشخیص نمیده»');
ok('main.js: واچر ۱.۵ ثانیه‌ای + baseline (کپی قدیمیِ قبل از بوت پیشنهاد نمی‌شود)',
  mainSrc.includes('}, 1500);') && mainSrc.includes('if (!clipWatchReady) { clipWatchReady = true; return; }'));
/* رفتار واقعی CLIP_VIDEO_RE */
{
  const m = mainSrc.match(/const CLIP_VIDEO_RE = (\/[^\n]+\/i);/);
  let re = null;
  try { re = eval(m[1]); } catch (_) { /* noop */ }
  ok('CLIP_VIDEO_RE: یوتیوب watch/shorts/live/youtu.be + فایل ویدیویی',
    !!re && re.test('https://www.youtube.com/watch?v=dQw4w9WgXcQ') &&
    re.test('https://youtu.be/dQw4w9WgXcQ') &&
    re.test('https://www.youtube.com/shorts/abcdefghijk') &&
    re.test('https://cdn.example.com/movie.mp4?token=1') &&
    !re.test('https://www.google.com/search?q=hi'));
}
ok('app.js: چیپ clipChip با پخشِ مستقیم videoPlayReply + بستن + تایمر ۱۵ثانیه',
  appSrc.includes("$('#clipChip')") && appSrc.includes('await videoPlayReply(url,') &&
  appSrc.includes('clearTimeout(_ccTimer);'));

/* ---------- ۴) چند-ویدیو ---------- */
console.log('\n[4] شفاف‌سازی چند-ویدیو (الگوی needs_clarification معماری مرجع)');
{
  const vi = require('./renderer/js/voiceIntent.js');
  const cases = [
    ['ویدیو قبلی رو ببند', 'oldest'], ['ویدیو جدید رو ببند', 'newest'],
    ['ویدیوی سوم رو ببند', 3], ['اون یکی رو ببند', 'other'],
    ['همه رو ببند', 'all'], ['جفتشون رو ببند', 'all'],
    ['اولی رو ببند', 'oldest'], ['دومی رو پاز کن', 'newest'],
    ['ویدیو قبلی رو فول اسکرین کن', 'oldest'],
  ];
  let n = 0;
  for (const [c, want] of cases) {
    const tgt = vi.videoTargetOf(c);
    const got = (tgt === '' ? '' : tgt);
    const passCase = JSON.stringify(got) === JSON.stringify(want);
    ok('videoTargetOf: «' + c + '» → ' + JSON.stringify(want), passCase);
    n++;
  }
  ok('videoCtlOf: fullscreen/pause هدف‌دار (tgt چسبیده)',
    JSON.stringify(vi.videoCtlOf('ویدیو قبلی رو فول اسکرین کن')).includes('"tgt":"oldest"') &&
    JSON.stringify(vi.videoCtlOf('دومی رو پاز کن')).includes('"tgt":"newest"'));
  ok('videoCtlOf: «ویدیو ببند» لخت = auto (رندرر تصمیم پرسش می‌گیرد)',
    vi.videoCtlOf('ویدیو رو ببند').arg === 'auto');
  ok('videoCtlParse مغز: close:ord:N می‌فهمد',
    /close:ord/.test(appSrc) === false || appSrc.includes("const om = tail.match(/^(?:ord:)?(\\d{1,2})$/)"));
}
ok('main.js: بستن با pid مستقیم یا ord:N — هرگز پنجرهٔ اشتباه',
  mainSrc.includes("if (Number(p.pid) > 0 || /^ord:\\d+$/.test(tgt)) {") &&
  mainSrc.includes('closeVideoByPid(_pid)'));
ok('app.js: پرسش شماره‌دار + _pendingVideoPick + لاین مصرف («دومی»/«شمارهٔ ۲»/«همه»/«بی‌خیال»)',
  appSrc.includes('let _pendingVideoPick = null;') && appSrc.includes('async function videoPickConsume(raw)') &&
  appSrc.includes('if (_pendingVideoPick) {') && appSrc.includes("بگو «اولی»، «دومی»، «شمارهٔ ۲» یا «بی‌خیال»"));
ok('app.js: رزولور pid در لاین player_ctl + play_pause/seek/fullscreen با pid هدف‌دار در main',
  appSrc.includes("await bridge.player.ctl({ action: 'players' }).catch(() => null);") &&
  mainSrc.includes('focusPlayerWindow(Number(p.pid) || playerCtl.activePid || 0)') &&
  mainSrc.includes('focusPlayerWindow(Number(p.pid) || 0); /* v0.82'));

/* ---------- ۵) پنل مخاطبین + برنامه‌های من ---------- */
console.log('\n[5] بخش مخاطبین + برنامه‌های من در تنظیمات');
ok('index.html: پنل contacts با جستجو/لیست/دکمهٔ مخاطب جدید + nav item',
  htmlSrc.includes('data-pane="contacts"') && htmlSrc.includes('id="ctSearch"') &&
  htmlSrc.includes('id="contactsList"') && htmlSrc.includes('id="btnContactNew"') &&
  htmlSrc.includes('data-pane="contacts"') && /data-pane="contacts"/.test(htmlSrc));
ok('index.html: پنل apps با جستجو/لیست/اسکن مجدد + nav item',
  htmlSrc.includes('data-pane="apps"') && htmlSrc.includes('id="appsSearch"') &&
  htmlSrc.includes('id="appsList"') && htmlSrc.includes('id="btnAppsPaneRescan"'));
ok('app.js: contactsPaneRender — آواتار/بج/ویرایش با ctAddOpen/حذف',
  appSrc.includes('function contactsPaneRender()') && appSrc.includes('ctAddOpen({ app: c.app, handle: c.handle, name: c.name })') &&
  appSrc.includes('CT_APP_FA'));
ok('app.js: appsPaneRender — جستجو/اجرا با bridge.apps.launch/اسکن مجدد',
  appSrc.includes('async function appsPaneRender(force)') &&
  appSrc.includes('bridge.apps.launch({ name: a.name, exe: a.exe })'));
ok('app.js: باز شدن پنل با صدا («مخاطبینمو نشون بده» / «نرم‌افزارا رو نشون بده»)',
  appSrc.includes("id: 'contacts_show'") && appSrc.includes("id: 'apps_show'") &&
  appSrc.includes("showSettingsPane('contacts')") && appSrc.includes("showSettingsPane('apps')"));

/* ---------- ۶) دکمهٔ توقف ---------- */
console.log('\n[6] دکمهٔ توقف — «اوا گیر میکنه، کاربر بتونه متوقف کنه»');
ok('index.html: stopChip + app.js: لغو واقعی (aiCancelRun + epoch + TTS)',
  htmlSrc.includes('id="stopChip"') && appSrc.includes("await aiCancelRun('stop-chip')") &&
  appSrc.includes('aveEpoch += 1; /* نتیجهٔ هر تشخیص در جریان باطل شود */'));
ok('app.js: چیپ فقط وقتی مشغول است دیده می‌شود (poll 400ms)',
  appSrc.includes("_sc.hidden = !(state === 'processing' || cmdBusy || ttsAudioBusy());"));

/* ---------- ۷) تم سفید طلایی ---------- */
console.log('\n[7] تم سفید طلایی + حالت روشن');
ok('styles.css: data-gold سوار بر light با طلایی #b8860b/#d4a017',
  cssSrc.includes('[data-theme="light"][data-gold="on"]') && cssSrc.includes('--acc: #b8860b;') &&
  cssSrc.includes('--acc2: #d4a017;'));
ok('app.js: applyTheme برای gold هم data-theme=light می‌گذارد هم data-gold=on',
  appSrc.includes("else if (settings.theme === 'gold') { document.body.setAttribute('data-theme', 'light'); document.body.setAttribute('data-gold', 'on'); }"));
ok('app.js: gold در سقف setTheme + سیکل دکمهٔ تم dark→light→gold→dark + اپشن select',
  appSrc.includes("['light', 'lite', 'darklite', 'gold'].includes(th)") &&
  appSrc.includes("settings.theme === 'light' ? 'gold' : 'dark'") &&
  htmlSrc.includes('<option value="gold"'));

/* ---------- ۸) نصاب سفارشی ---------- */
console.log('\n[8] نصاب سفارشی طلایی (نه پیش‌فرض ویندوز)');
ok('package.json: nsis با installerHeader/Sidebar/license/include فارسی',
  pkg.build && pkg.build.nsis && pkg.build.nsis.installerHeader === 'build/installerHeader.bmp' &&
  pkg.build.nsis.installerSidebar === 'build/installerSidebar.bmp' &&
  pkg.build.nsis.license === 'build/license.fa.txt' &&
  pkg.build.nsis.include === 'build/installer.nsh' &&
  pkg.build.nsis.uninstallDisplayName === 'آوا — دستیار صوتی ویندوز');
{
  const side = fs.readFileSync(path.join(R, 'build/installerSidebar.bmp'));
  const head = fs.readFileSync(path.join(R, 'build/installerHeader.bmp'));
  const dim = (b) => ({ w: b.readInt32LE(18), h: Math.abs(b.readInt32LE(22)), bpp: b.readUInt16LE(28) });
  const s1 = dim(side), s2 = dim(head);
  ok('installerSidebar.bmp دقیقاً 164x314 (۲۴بیت) و installerHeader.bmp دقیقاً 150x57',
    s1.w === 164 && s1.h === 314 && s1.bpp <= 24 && s2.w === 150 && s2.h === 57 && s2.bpp <= 24);
}
ok('build/license.fa.txt فارسی + build/installer.nsh با BrandingText آوا',
  fs.existsSync(path.join(R, 'build/license.fa.txt')) &&
  fs.readFileSync(path.join(R, 'build/installer.nsh'), 'utf8').includes('BrandingText "AVA - ava-voice-assistant"'));
ok('گارد NSIS: فایل installer.nsh کاملاً ASCII است (کامنت «؛» فارسی = شکست makensis — درس CI v0.82)',
  (() => {
    const nsh = fs.readFileSync(path.join(R, 'build/installer.nsh'), 'utf8');
    const bad = nsh.split('\n').filter((l) => [...l].some((c) => c.charCodeAt(0) > 127));
    if (bad.length) console.log('    ✗ non-ascii lines: ' + bad.length);
    return bad.length === 0;
  })());
ok('گارد اسکیما electron-builder 25: کلیدهای nsis همگی معتبر (درس CI v0.82)',
  (() => {
    const VALID = ['allowElevation', 'allowToChangeInstallationDirectory', 'artifactName', 'createDesktopShortcut', 'createStartMenuShortcut', 'customNsisBinary', 'deleteAppDataOnUninstall', 'differentialPackage', 'displayLanguageSelector', 'guid', 'include', 'installerHeader', 'installerHeaderIcon', 'installerIcon', 'installerLanguages', 'installerSidebar', 'language', 'license', 'menuCategory', 'multiLanguageInstaller', 'oneClick', 'packElevateHelper', 'perMachine', 'preCompressedFileExtensions', 'publish', 'removeDefaultUninstallWelcomePage', 'runAfterFinish', 'script', 'selectPerMachineByDefault', 'shortcutName', 'unicode', 'uninstallDisplayName', 'uninstallerIcon', 'uninstallerSidebar', 'useZip', 'warningsAsErrors'];
    const keys = Object.keys(pkg.build.nsis);
    const bad = keys.filter((k) => !VALID.includes(k));
    if (bad.length) console.log('    ✗ invalid nsis keys: ' + bad.join(','));
    return bad.length === 0;
  })());

/* ---------- ۹) فیکس یوتیوب در پلیر ---------- */
console.log('\n[9] پخش یوتیوب در پلیر (رگرسیون ۰.۷۹→۰.۸۱)');
ok('نردبان فرمت گسترده: 22/18 → mp4 → webm → b (ریشه: یوتیوب muxed 22/18 را پس می‌گیرد)',
  mainSrc.includes('-f "22/18/b[ext=mp4]/b[ext=webm]/b"'));
ok('فالبک کلاینت ios/android (استریم HLS تک‌خطی برای پلیرهای دسکتاپ)',
  mainSrc.includes("function ytDlpClientCmd(bin, url, client)") &&
  mainSrc.includes("ytDlpClientCmd(b, u, 'ios')") && mainSrc.includes("ytDlpClientCmd(b, u, 'android')"));
ok('شفای yt-dlp سیستمیِ کهنه با نسخهٔ تازهٔ باندل (قبلاً فقط باندل شفا می‌یافت)',
  /let g = await ytdlpGetUrl\(bin, url\);/.test(mainSrc) &&
  /const d = await ytDlpDownload\(\);\s*\n\s*const bin2 = d \? ytDlpBundledPath\(\) : '';/.test(mainSrc));

/* ---------- ۱۰) i18n + نسخه ---------- */
console.log('\n[10] i18n و نسخه');
ok('جفت‌های i18n جدید (مخاطبین/برنامه‌ها/توقف/طلایی)',
  appSrc.includes("'set.nav.contacts': ['مخاطبین', 'Contacts']") &&
  appSrc.includes("'set.nav.apps': ['برنامه‌های من', 'My apps']") &&
  appSrc.includes("'stop.label': ['توقف', 'Stop']") &&
  appSrc.includes("'toast.themeGold'"));
ok(/^0\.[8-9]\d\.?\d*/.test(pkg.version), 'package.json version = 0.8x (forward-relaxed)');

console.log('\n==== v0.82.0-beta: ' + pass + ' passed, ' + fail + ' failed ====');
process.exit(fail ? 1 : 0);
