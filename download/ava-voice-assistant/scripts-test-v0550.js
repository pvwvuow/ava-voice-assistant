#!/usr/bin/env node
/* scripts-test-v0550.js — doctest v0.55.1-beta — ۸ درخواست کاربر
   ۱) ویجت شناور (آیکون + هالهٔ سبز + گفتهٔ کاربر/پاسخ آوا)
   ۲) ترِی + بستن = پس‌زمینه
   ۳) باگ «is listening» دروغین → نگهبان وضعیت
   ۴) قالب‌های آماده (ورودی/نمودار/آب‌وهوا/فوتبال) + بلوک CARD + پادتوهم
   ۵) چت خودکار (آینهٔ مکالمه صوتی)
   ۶) تاریخچهٔ چت روی دیسک با لود تنبل (جایگزین تاریخچهٔ فرمان)
   ۷) باگ اکولایزر (دادهٔ کهنه/کانتکست مرده)
   ۸) نسخه 0.55.1-beta
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

const mainSrc = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(ROOT, 'renderer/js/app.js'), 'utf8');
const htmlSrc = fs.readFileSync(path.join(ROOT, 'renderer/index.html'), 'utf8');
const cssSrc = fs.readFileSync(path.join(ROOT, 'renderer/css/styles.css'), 'utf8');
const preloadSrc = fs.readFileSync(path.join(ROOT, 'preload.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const widgetMgrSrc = fs.readFileSync(path.join(ROOT, 'widgetManager.js'), 'utf8');
const widgetHtml = fs.readFileSync(path.join(ROOT, 'renderer/widget.html'), 'utf8');
const widgetRndSrc = fs.readFileSync(path.join(ROOT, 'renderer/js/widgetRenderer.js'), 'utf8');
const widgetPreloadSrc = fs.readFileSync(path.join(ROOT, 'renderer/widgetPreload.js'), 'utf8');

console.log('\n[1] ویجت شناور — ماژول + صفحه + رندرر + preload + سیم‌کشی');
ok(widgetMgrSrc.includes('new BrowserWindow') && widgetMgrSrc.includes('transparent: true') && widgetMgrSrc.includes('skipTaskbar: true') && widgetMgrSrc.includes('alwaysOnTop: true'), 'پنجرهٔ شیشه‌ای همیشه-روشن بدون نوار تسک');
ok(widgetMgrSrc.includes("path.join(__dirname, 'renderer', 'widgetPreload.js')"), 'ویجت preload امن دارد (contextIsolation)');
ok(widgetMgrSrc.includes("fs.renameSync(tmp, statePath)") && widgetMgrSrc.includes('widget-state.json'), 'موقعیت/روشن‌بودن: نوشتن اتمیک tmp+rename');
ok(typeof widgetMgrSrc.includes("module.exports = { init, configure, update, getState, flushState };"), 'API ماژول: init/configure/update/getState/flushState');
ok(widgetHtml.includes('class="halo"') && widgetHtml.includes('class="halo2"') && widgetHtml.includes('<body class="idle">'), 'هالهٔ حالت در widget.html');
ok(/body\.listening .*halo/.test(widgetHtml.replace(/\n/g, ' ')) && widgetHtml.includes('@keyframes pulse'), 'هالهٔ سبز پالس‌دار در حالت گوش دادن');
ok(widgetHtml.includes('lineUser') && widgetHtml.includes('lineAva') && widgetHtml.includes('شما') && widgetHtml.includes('آوا'), 'متن کوچک گفتهٔ کاربر + پاسخ آوا');
ok(widgetRndSrc.includes('9000'), 'محو خودکار متن‌ها بعد ۹ ثانیه');
ok(widgetRndSrc.includes('AVAWidget.onUpdate') && widgetRndSrc.includes('AVAWidget.openMain'), 'رندرر فقط از پل امن AVAWidget');
ok(widgetPreloadSrc.includes("contextBridge.exposeInMainWorld('AVAWidget'"), 'widgetPreload: contextBridge');
ok(widgetRndSrc.includes("dblclick") && widgetMgrSrc.includes("'widget:open-main'"), 'دابل‌کلیک ویجت → باز شدن برنامه');
ok(mainSrc.includes("require('./widgetManager')") && mainSrc.includes('widgetManager.init({ win })') && mainSrc.includes('widgetManager.flushState()'), 'سیم‌کشی main: init + flush');
ok(widgetMgrSrc.includes("'widget:config'") && widgetMgrSrc.includes("'widget:update'") && widgetMgrSrc.includes("widget:get"), 'IPC ویجت: get/config/update');
ok(htmlSrc.includes('id="optWidget"'), 'سوییچ تنظیمات ویجت');
ok(appSrc.includes('bridge.widget.config(optWidget.checked)'), 'سوییچ تنظیمات → کانال config');

console.log('\n[2] ترِی + بستن به پس‌زمینه');
ok(mainSrc.includes('Tray, Menu, nativeImage'), 'الکترون: Tray/Menu/nativeImage');
ok(mainSrc.includes('function createTray()') && mainSrc.includes("new Tray("), 'createTray');
ok(mainSrc.includes("win.on('close', (e) => {") && mainSrc.includes('if (!isQuitting)') && mainSrc.includes('win.hide()'), 'بستن = مخفی به ترِی (نه quit)');
ok(mainSrc.includes('displayBalloon') && mainSrc.includes('آوا در پس‌زمینه فعال ماند'), 'بالون آگاهی پس‌زمینه');
ok(mainSrc.includes("'خروج کامل / Quit'") && mainSrc.includes('isQuitting = true'), 'خروج فقط از منوی ترِی');
ok(mainSrc.includes('ava:toggle-listen'), 'منوی ترِی: شروع/توقف گوش دادن');
ok(/app\.on\('window-all-closed'[\s\S]{0,120}if \(isQuitting\) app\.quit\(\)/.test(mainSrc), 'window-all-closed: فقط با خروج آشکار');
ok(mainSrc.includes('ویجت شناور (Floating widget)'), 'منوی ترِی: سوییچ ویجت');

console.log('\n[3] باگ «is listening» دروغین');
ok(appSrc.includes("'status watchdog: stale listening label reset'") && /setInterval\(\(\) => \{[\s\S]{0,400}گوش دادن\|Listening[\s\S]{0,400}\}, 1500\)/.test(appSrc), 'نگهبان وضعیت (خودترمیم هر ۱.۵ ثانیه)');
ok(appSrc.includes("if (state === 'listening') statusText.textContent = t('status.listening');"), 'گارد state در callback ریسکی r.start');

console.log('\n[4] قالب‌های آمادهٔ چت (CARD) + پادتوهم');
ok(/function parseCard\(text\)/.test(appSrc) && appSrc.includes("['weather', 'chart', 'league', 'input']"), 'parseCard: چهار قالب');
ok(appSrc.includes('rc-bars') && appSrc.includes('rc-table') && appSrc.includes('rc-inrow') && appSrc.includes('rc-days'), 'رندر نمودار/جدول/ورودی/روزهای آب‌وهوا');
ok(appSrc.includes('<<<CARD>>>') && appSrc.includes('هرگز عدد/رتبه/دما را از حافظه‌ات نساز'), 'FA: بلوک CARD + پادتوهم');
ok(appSrc.includes('Chat templates (CARD)') && appSrc.includes('NEVER invent numbers/ranks/temperatures'), 'EN: بلوک CARD + پادتوهم');
ok(appSrc.includes('if (_pcV.card) attachCardToChat(_pcV.card);'), 'مسیر صوتی: کارت به چت می‌چسبد');
ok(appSrc.includes("attachCardToChat({ type: 'input', data: { prompt: LANG === 'en' ? 'Your answer:' : 'پاسخ تو:' } });"), 'سؤال AI → کادر ورودی آماده (صوتی)');
ok(appSrc.includes("else if (/[؟?]\\s*$/.test(String(reply || ''))) renderRichCard(msgEl, { type: 'input'"), 'چت: سؤال AI → کادر ورودی آماده');
ok(cssSrc.includes('rcGrow'), 'انیمیشن میله‌های نمودار در CSS');
ok(cssSrc.includes('.rich-card') && cssSrc.includes('.ch-bub') && cssSrc.includes('.ch-day'), 'CSS: کارت‌ها + حباب‌های تاریخچه');

console.log('\n[5] آینهٔ مکالمه صوتی (چت خودکار) + ویجت');
ok(appSrc.includes('if (el === rcReply) { try { voiceReplyShown(txt); } catch (_) { /* noop */ } }'), 'تک‌نقطه‌ای: typeText روی rcReply → voiceReplyShown');
ok(appSrc.includes('function mirrorExchange(heard, reply, via)') && appSrc.includes('function voiceReplyShown(text)'), 'mirrorExchange + voiceReplyShown');
ok(/bridge\.widget\.update\(\{ user: u \}\)/.test(appSrc) && /bridge\.widget\.update\(\{ reply: r \}\)/.test(appSrc), 'متن‌ها به ویجت هم می‌روند');
ok(appSrc.includes("bridge.chats.append(arr)"), 'ردوبدل صوتی → دیسک');
ok(appSrc.includes("chatAutoOpen: store.get('chatAutoOpen', true)"), 'چت خودکار (پیش‌فرض روشن)');
ok(appSrc.includes("document.visibilityState === 'visible'") && appSrc.includes("showView('chat')"), 'باز شدن خودکار چت فقط وقتی پنجره دیده می‌شود');
ok(htmlSrc.includes('id="optChatAutoOpen"'), 'سوییچ تنظیمات چت خودکار');

console.log('\n[6] تاریخچهٔ گفتگو روی دیسک + لود تنبل');
ok(mainSrc.includes('ava-chats.json') && mainSrc.includes("ipcMain.handle('chats:append'") && mainSrc.includes("ipcMain.handle('chats:load'") && mainSrc.includes("ipcMain.handle('chats:clear'"), 'IPC چت‌ها: append/load/clear');
ok(mainSrc.includes('slice(-2000)') && mainSrc.includes('writeChatsNow'), 'سقف ۲۰۰۰ پیام + نوشتن اتمیک');
ok(mainSrc.includes('chatsSaveTimer = setTimeout'), 'نوشتن debounce (برنامه سنگین نشود)');
ok(preloadSrc.includes('chats: {') && preloadSrc.includes("invoke('chats:load', p)"), 'preload: پل chats');
ok(appSrc.includes('bridge.chats.load({ limit: 120, offset: chatHistOffset })'), 'لود تنبل: فقط ۱۲۰ پیام آخر هنگام باز شدن نما');
ok(appSrc.includes("'chMore'") && appSrc.includes('خواندن قدیمی‌ترها'), 'دکمهٔ «خواندن قدیمی‌ترها»');
ok(appSrc.includes('await bridge.chats.clear()'), 'پاک‌سازی تاریخچهٔ گفتگو');
ok(appSrc.includes('appendChatHistRow') && appSrc.includes('chatHistDayLabel'), 'گروه‌بندی روزانه + حباب‌ها');

console.log('\n[7] باگ اکولایزر');
ok(appSrc.includes("const micAlive = analyser && micData && micLive && audioCtx && audioCtx.state === 'running';"), 'گارد کانتکست زنده (دادهٔ کهنه هرگز رندر نمی‌شود)');
ok(appSrc.includes('tr.onended = () => { micLive = false; if (micData) micData.fill(0);'), 'مرگ ترک میکروفون → صفرسازی');
ok(appSrc.includes("if (state === 'listening' && micData && !micAlive)") && appSrc.includes('micData.fill(0); /* خودترمیمی'), 'خودترمیمی حلقهٔ رندر');
ok(appSrc.includes("audioCtx.resume()") && appSrc.includes("if (s === 'listening' && audioCtx && audioCtx.state === 'suspended')"), 'resume هنگام ورود به گوش دادن');

console.log('\n[8] نسخه 0.55.1-beta');
ok(appSrc.includes("let appVersion = '0.55.1-beta';"), 'app.js');
ok(pkg.version === '0.55.1-beta', 'package.json');
ok(htmlSrc.includes('<span id="abVersion">v0.55.1-beta</span>'), 'index.html');
ok(readme.includes('۰.۵۵.۱-بتا') && readme.includes('ویجت شناور + ترِی'), 'README: ۰.۵۵.۱-بتا');

console.log('\n-----------------------------');
console.log(`RESULT: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
