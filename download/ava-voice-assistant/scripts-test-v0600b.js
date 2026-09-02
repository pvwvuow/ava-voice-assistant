#!/usr/bin/env node
/* scripts-test-v0600b.js — Wave 2 / PACKAGE A UI (v0.60.0-beta line, A12–A18)
   فیکس‌های رابط کاربری روی پایهٔ v0.57.0-beta + موج ۱ (A1–A11) — بدون bump نسخه
   ------------------------------------------------------------
   چک‌ها:
     1)  A12 — تیتر صفحهٔ DNS: کلید تازهٔ dnsp.pageTitle (بلوک زنده) + h2 صفحه به آن
         اشاره می‌کند؛ پاپ‌آپ پینگ همچنان روی dnsp.title («پینگ DNSها»)؛ تعریف‌های
         قدیمی dnsp.title دست‌نخورده
     2)  A13 — تم سبک (lite): ورودی‌های set-select/set-input/dict-box/cmd-bar/chat-bar/kbd
         override گرفتند؛ مقدارهای تیرهٔ تم پیش‌فرض عیناً سر جایشان (صفر تغییر ظاهر در dark)
     3)  A14 — تم روشن: سه پنل پس‌زمینهٔ تیرهٔ هاردکد (cs-card/cp-card/gem-panel)
         با همان الگوی .confirm خوانا شدند
     4)  A16 — مودال تأیید: z-index: 130 (بالاتر از cp-wrap 120)؛ cp-wrap دست‌نخورده
     5)  A15 — ردیف‌های فهرست یادگیری: dc-item بی‌CSS → dc-contact (+dc-ct-actions)
         — همان کارتِ یادآوری‌ها، دکمهٔ حذف هم‌ساختار ردیف یادآوری
     6)  A17 — ثبت کلید PTT: فقط کلیدهای لاتین (رفتار واقعی گارد با vm) + تایم‌اوت
         ۱۰ ثانیه + تولتیپ «ESC = لغو» + لغو با ESC + توست کلید لاتین
     7)  A18 — i18n: ۹ کلید تازه (fa+en، فقط بلوک زنده)؛ ۸ توست فارسی هاردکد → t()؛
         تیتر کارت آپدیت دوزبانه؛ #i-warn حذف شد
     8)  A18 — راهنمای بیکاری: {combo} واقعی PTT (فالبک پیش‌فرض)
     9)  A18 — زنجیرهٔ ESC: else-if واقعی — یک Esc فقط یک لایه می‌بندد
    10)  A18 — about.desc نسخهٔ فعلی (آوا + پوش-تو-تاک)؛ بلوک مرده دست‌نخورده
    11)  نگهبان v0570 — ناوبری گروهی/جداکننده/زیرتیتر/بدون inline/ترتیب پنل/نسخه
*/
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

const appSrc = fs.readFileSync(path.join(ROOT, 'renderer/js/app.js'), 'utf8');
const htmlSrc = fs.readFileSync(path.join(ROOT, 'renderer/index.html'), 'utf8');
const cssSrc = fs.readFileSync(path.join(ROOT, 'renderer/css/styles.css'), 'utf8');

/* برش‌های صفحهٔ تنظیمات (الگوی v0570) */
const spA = htmlSrc.indexOf('id="settingsPage"');
const spB = htmlSrc.indexOf('id="historyPage"');
const setSrc = (spA > -1 && spB > spA) ? htmlSrc.slice(spA, spB) : '';

/* ============================================================
   [1] A12 — تیتر صفحهٔ DNS
   ============================================================ */
console.log('\n[1] A12 — dnsp.pageTitle: تیتر صفحهٔ DNS دیگر «پینگ DNSها» نیست');
ok(appSrc.includes("'dnsp.pageTitle': ['تغییرگر DNS', 'DNS Changer'],"),
   'دیکشنری (بلوک زنده): dnsp.pageTitle با جفت فارسی/انگلیسی');
ok((appSrc.split("'dnsp.pageTitle'").length - 1) === 1, 'dnsp.pageTitle فقط یک‌بار (فقط بلوک زنده — بلوک مرده دست نخورد)');
const dnsPageSlice = htmlSrc.slice(htmlSrc.indexOf('id="dnsPage"'), htmlSrc.indexOf('</section>', htmlSrc.indexOf('id="dnsPage"')));
ok(dnsPageSlice.includes('data-i18n="dnsp.pageTitle"'), 'h2 صفحهٔ DNS حالا dnsp.pageTitle دارد');
ok(!dnsPageSlice.includes('data-i18n="dnsp.title"'), 'h2 صفحهٔ DNS دیگر از dnsp.title استفاده نمی‌کند');
const dnsPingSlice = htmlSrc.slice(htmlSrc.indexOf('id="dnsPing"'), htmlSrc.indexOf('id="about"'));
ok(dnsPingSlice.includes('data-i18n="dnsp.title"'), 'پاپ‌آپ پینگ همچنان روی dnsp.title است («پینگ DNSها»)');
ok((appSrc.split("'dnsp.title': ['DNS Changer', 'DNS Changer'],").length - 1) === 0,
   'تعریف‌های قدیمی dnsp.title («DNS Changer») حذف شدند (D1: بلوک مرده ادغام شد — dnsp.title فقط «پینگ DNSها»)');
ok(appSrc.includes("'dnsp.title': ['پینگ DNSها', 'Ping DNS servers'],"),
   'تعریف «پینگ DNSها» هم عیناً سر جایش است (برندهٔ پاپ‌آپ)');

/* ============================================================
   [2] A13 — تم سبک (lite): ورودی‌های خوانا، بدون تغییر در تم تیره
   ============================================================ */
console.log('\n[2] A13 — lite: هر ۶ ورودی override گرفتند؛ dark دست نخورد');
ok(cssSrc.includes('[data-theme="lite"] .set-select,') &&
   cssSrc.includes('[data-theme="lite"] .set-input,') &&
   cssSrc.includes('[data-theme="lite"] .dict-box,') &&
   cssSrc.includes('[data-theme="lite"] .cmd-bar,') &&
   cssSrc.includes('[data-theme="lite"] .chat-bar { background: #ffffff; border: 1px solid var(--stroke); }'),
   'lite: set-select/set-input/dict-box/cmd-bar/chat-bar → سفید + استروک تم');
ok(cssSrc.includes('[data-theme="lite"] .set-select option { background: #ffffff; color: var(--text); }'),
   'lite: آپشن سلکت‌ها هم خوانا شد (قبلاً #0c1210 با متن تیره)');
ok(cssSrc.includes('[data-theme="lite"] kbd { background: rgba(30, 41, 59, 0.06); border-color: rgba(30, 41, 59, 0.16); }'),
   'lite: kbd قابل دیدن شد');
ok((cssSrc.split('background: rgba(11, 15, 13, 0.6);').length - 1) === 3,
   'dark: پس‌زمینهٔ تیرهٔ set-select/set-input/dict-box عیناً سر جایش (۳ رخداد)');
ok((cssSrc.split('background: rgba(11, 15, 13, 0.55);').length - 1) === 1 &&
   (cssSrc.split('background: rgba(9, 13, 11, 0.65);').length - 1) === 1,
   'dark: cmd-bar و chat-bar عیناً سر جایشان');
ok(cssSrc.includes('[data-theme="light"] .set-select, [data-theme="light"] .set-input, [data-theme="light"] .dict-box {'),
   'رجسیون: overrideهای تم روشن (از قبل موجود) دست‌نخورده');

/* ============================================================
   [3] A14 — تم روشن: سه پنل تیرهٔ هاردکد خوانا شدند
   ============================================================ */
console.log('\n[3] A14 — light: cs-card/cp-card/gem-panel با الگوی .confirm');
ok(cssSrc.includes('[data-theme="light"] .cs-card { background: rgba(255, 255, 255, 0.94); }') &&
   cssSrc.includes('[data-theme="light"] .cp-card { background: rgba(255, 255, 255, 0.94); }') &&
   cssSrc.includes('[data-theme="light"] .gem-panel { background: rgba(255, 255, 255, 0.94); }'),
   'سه override تم روشن اضافه شد (همان rgba(255,255,255,0.94) الگوی .confirm)');
ok(cssSrc.indexOf('[data-theme="light"] .confirm { background: rgba(255, 255, 255, 0.94); }') <
   cssSrc.indexOf('[data-theme="light"] .cs-card {'),
   'الگوی .confirm بالای سرشان مانده (همان بخش تم روشن)');
ok((cssSrc.split('background: rgba(10, 16, 14, 0.94);').length - 1) === 1 &&
   (cssSrc.split('background: rgba(10, 16, 14, 0.96);').length - 1) === 1 &&
   (cssSrc.split('background: rgba(10, 16, 14, 0.92);').length - 1) === 1,
   'پایهٔ تیرهٔ هر سه پنل دست‌نخورده (تم تیره همان ظاهر قبلی)');

/* ============================================================
   [4] A16 — مودال تأیید بالاتر از صفحهٔ فرمان‌ها
   ============================================================ */
console.log('\n[4] A16 — .confirm z-index: 130 بالاتر از cp-wrap (120)');
ok(/\.confirm \{\n  position: fixed; inset: 0; z-index: 130;/.test(cssSrc), 'CSS: .confirm اکنون z-index: 130 دارد');
ok(cssSrc.includes('.cp-wrap { position: fixed; inset: 0; z-index: 120;'), 'cp-wrap عیناً روی 120 ماند (طبق دستور دست نخورد)');
ok(htmlSrc.indexOf('id="confirmBox"') < htmlSrc.indexOf('id="cmdPage"'), 'ترتیب DOM همان قبلی (confirmBox قبل از cmdPage) — پس confirm باید بالاتر باشد');

/* ============================================================
   [5] A15 — ردیف‌های فهرست یادگیری هم‌شکل یادآوری‌ها
   ============================================================ */
console.log('\n[5] A15 — learn-list: dc-item بی‌CSS → dc-contact');
const learnA = appSrc.indexOf('async function renderLearnList');
const learnB = appSrc.indexOf('const btnLearnClear', learnA);
const learnSlice = (learnA > -1 && learnB > learnA) ? appSrc.slice(learnA, learnB) : '';
ok(learnSlice.includes("row.className = 'dc-contact';"), 'ردیف یادگیری از همان کلاس dc-contact استفاده می‌کند');
ok(!appSrc.includes("row.className = 'dc-item';") && !/className\s*=\s*'dc-item'/.test(appSrc),
   'هیچ‌جا دیگر dc-item بلااستفاده نماند');
ok(learnSlice.includes('<div class="dc-ct-actions">') && learnSlice.includes('class="chip sm danger dc-del"'),
   'دکمهٔ حذف ردیف یادگیری دقیقاً هم‌ساختار ردیف یادآوری (dc-ct-actions + chip sm danger)');
ok(/\.dc-contact \{\n  display: flex; align-items: center; justify-content: space-between; gap: 10px;/.test(cssSrc),
   'CSS: قانون dc-contact (کارت یادآوری‌ها) سر جایش است — ردیف یادگیری حالا استایل دارد');
ok(cssSrc.includes('[data-theme="darklite"] .dc-contact { background: rgba(255, 255, 255, 0.03); }'),
   'رجسیون: override تیرهٔ سبک dc-contact هم حالا برای ردیف‌های یادگیری اعمال می‌شود');

/* ============================================================
   [6] A17 — ثبت کلید PTT مهارشده (رفتار واقعی گارد با vm)
   ============================================================ */
console.log('\n[6] A17 — گارد کلید لاتین + تایم‌اوت ۱۰ ثانیه + ESC = لغو');
const capA = appSrc.indexOf("const okName = /^(F");
let okNameFn = null;
if (capA > -1) {
  const exprEnd = appSrc.indexOf(';', capA);
  okNameFn = new Function('keyName', 'return (' + appSrc.slice(capA + 'const okName = '.length, exprEnd) + ');');
}
ok(!!okNameFn, 'عبارت گارد okName استخراج شد');
ok(!!okNameFn && okNameFn('A') === true, '«A» لاتین → پذیرفته می‌شود');
ok(!!okNameFn && okNameFn('5') === true, '«5» عدد لاتین → پذیرفته می‌شود');
ok(!!okNameFn && okNameFn('F2') === true && okNameFn('Space') === true && okNameFn('PageDown') === true,
   'کلیدهای نام‌دار (F2/Space/PageDown) مثل قبل پذیرفته می‌شوند');
ok(!!okNameFn && okNameFn('ش') === false, '«ش» (غیرلاتین) → رد می‌شود (قبلاً بی‌سروصدا پذیرفته و PTT می‌مرد!)');
ok(!!okNameFn && okNameFn('؛') === false && okNameFn('') === false, '«؛» و رشته‌های نامعتبر → رد');
ok(!appSrc.includes('keyName.length === 1'), 'شرط قدیمی «هر کلید تک‌کاراکتری» حذف شد');
ok(/\/\^\[A-Za-z0-9\]\$\/\.test\(keyName\)/.test(appSrc), 'سورس: گارد /^[A-Za-z0-9]$/ روی کلیدهای تکی');
ok(appSrc.includes("const capTimer = setTimeout(() => { toast(t('set.key.timeout'), '#i-info'); done(null); }, 10000);"),
   'تایم‌اوت ۱۰ ثانیه‌ای ثبت کلید با توست صادقانه');
ok(appSrc.includes('clearTimeout(capTimer);'), 'پاک‌شدن تایم‌اوت هنگام ثبت/لغو (نشتی تایمر ندارد)');
ok(appSrc.includes("if (btnPttKey) btnPttKey.title = t('set.key.escHint');") &&
   appSrc.includes("if (btnPttKey) btnPttKey.title = '';"),
   'تولتیپ «ESC = لغو» حین ثبت + پاک‌شدن بعد از پایان');
ok(appSrc.includes("if (e.key === 'Escape') { done(null); return; }"), 'لغو با ESC (رفتار موجود) حفظ شد');
ok(appSrc.includes("else if (Date.now() - latinToastAt > 1200) { latinToastAt = Date.now(); toast(t('set.key.latin'), '#i-info'); }"),
   'کلید ردشده → توست «کلیدهای لاتین مجازند» (با مهار اسپم تکرار)');
ok(!appSrc.includes('set.key.overlay') && !appSrc.includes('pttCaptureOverlay'), 'بدون اورلی تمام‌صفحه (فیوچر — طبق دستور ساخته نشد)');

/* ============================================================
   [7] A18 — i18n: کلیدهای تازه + توست‌های هاردکد + تیتر کارت آپدیت
   ============================================================ */
console.log('\n[7] A18 — کلیدهای تازه (fa+en، فقط بلوک زنده) + ۸ توست → t()');
const newKeys = [
  ["'dnsp.pageTitle': ['تغییرگر DNS', 'DNS Changer'],", 1],
  ["'set.key.latin': ['کلیدهای لاتین مجازند', 'Only Latin keys are accepted'],", 2],
  ["'set.key.timeout': ['زمان ثبت کلید تمام شد — دوباره امتحان کن', 'Key capture timed out — try again'],", 2],
  ["'set.key.escHint': ['در حال شنیدن کلید… ESC = لغو', 'Listening for a key… ESC = cancel'],", 2],
  ["'toast.electronOnly': ['این دکمه فقط داخل نرم‌افزار الکترون واقعی کار می‌کند', 'This button only works inside the real Electron app'],", 2],
  ["'toast.discOnly': ['کنترل دیسکورد فقط داخل نرم‌افزار ویندوزی کار می‌کند', 'Discord control only works inside the Windows app'],", 2],
  ["'toast.winOnly': ['فقط داخل نرم‌افزار ویندوزی کار می‌کند', 'Only works inside the Windows app'],", 2],
  ["'toast.updOnlyApp': ['آپدیت خودکار فقط داخل نرم‌افزار ویندوزی کار می‌کند', 'Auto update only works inside the Windows app'],", 3],
  ["'toast.linkFail': ['باز کردن لینک ممکن نشد', 'Could not open the link'],", 2],
];
let keysOk = true;
for (const [line] of newKeys) {
  if (!appSrc.includes(line)) { keysOk = false; console.log('    ✗ خط دیکشنری یافت نشد: ' + line.slice(0, 40)); }
}
ok(keysOk, 'هر ۹ کلید تازه با جفت فارسی/انگلیسی در دیکشنری (بلوک زنده)');
ok((appSrc.split("'dnsp.pageTitle'").length - 1) === 1 &&
   (appSrc.split("'set.key.latin'").length - 1) === 2 &&
   (appSrc.split("'toast.electronOnly'").length - 1) === 2,
   'کلیدهای تازه فقط در بلوک زنده‌اند (تعریف + مصرف؛ بلوک مرده دست نخورد)');
ok((appSrc.match(/t\('toast\.updInstalling'\)/g) || []).length === 2,
   'هر دو توست «در حال نصب…» مسیر نصب آپدیت از کلید موجود updInstalling می‌خوانند');
ok((appSrc.match(/t\('toast\.updOnlyApp'\)/g) || []).length === 2,
   'هر دو توست «آپدیت خودکار فقط داخل…» دوزبانه شدند');
let hardGone = true;
for (const s of ["toast('این دکمه فقط داخل نرم‌افزار الکترون واقعی کار می‌کند'", "toast('کنترل دیسکورد فقط داخل نرم‌افزار ویندوزی کار می‌کند'",
  "toast('فقط داخل نرم‌افزار ویندوزی کار می‌کند'", "toast('در حال نصب نسخه جدید… برنامه راه‌اندازی مجدد می‌شود'",
  "toast('آپدیت خودکار فقط داخل نرم‌افزار ویندوزی کار می‌کند'", "toast('باز کردن لینک ممکن نشد'"]) {
  if (appSrc.includes(s)) { hardGone = false; console.log('    ✗ هاردکد باقی مانده: ' + s); }
}
ok(hardGone, 'هیچ‌کدام از ۶ رشتهٔ توستِ هاردکد باقی نمانده (۸ نقطهٔ مصرف مسیر t())');
ok(appSrc.includes("t('toast.electronOnly')") && appSrc.includes("t('toast.discOnly')") &&
   appSrc.includes("t('toast.winOnly')") && appSrc.includes("t('toast.linkFail')"),
   'توست‌های الکترون/دیسکورد/ویندوز/لینک از دیکشنری می‌خوانند');
ok(!appSrc.includes('#i-warn'), '#i-warn (سمبل ناموجود) از app.js حذف شد');
ok(appSrc.includes("'هیچ موتور صدایی در دسترس نیست', '#i-info'"),
   'توست «هیچ موتور صدایی…» حالا از i-info موجود استفاده می‌کند');
const updA = appSrc.indexOf('function maybeUpdCard');
const updB = appSrc.indexOf('function setUpdUI', updA);
const updSlice = (updA > -1 && updB > updA) ? appSrc.slice(updA, updB) : '';
ok(updSlice.includes("$('#updCardTitle')") && updSlice.includes("t('upd.cardTitle')"),
   'maybeUpdCard: تیتر کارت آپدیت هم از دیکشنری ست می‌شود (کلید موجود upd.cardTitle)');

/* ============================================================
   [8] A18 — راهنمای بیکاری: کلید واقعی PTT
   ============================================================ */
console.log('\n[8] A18 — status.idle قالب {combo} دارد و کلید واقعی PTT را نشان می‌دهد');
ok(appSrc.includes("'status.idle': ['برای شروع، اورب را لمس کن یا کلید {combo}', 'Tap the orb or press {combo} to start']"),
   'دیکشنری: status.idle با جای‌نگهدار {combo} در هر دو زبان');
ok(appSrc.includes("IDLE_HINT = t('status.idle', { combo: pttHintComboHtml() });"),
   'applyI18n: راهنمای بیکاری با {combo} ساخته می‌شود');
ok(/function pttHintComboHtml\(\) \{[\s\S]*?settings\.ptt\.enabled === false[\s\S]*?settings\.ptt\.combo[\s\S]*?pttComboLabel\(combo\)/.test(appSrc),
   'pttHintComboHtml: PTT روشن + ترکیب ثبت‌شده → کلید واقعی؛ خاموش/ناشناخته → پیش‌فرض');
ok(appSrc.includes("const def = '<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Space</kbd>';"),
   'فالبک همان متن پیش‌فرض قبلی است (رفتار قدیمی وقتی PTT تنظیم نشده)');
ok(htmlSrc.includes('برای شروع، اورب را لمس کن یا کلید <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Space</kbd>'),
   'رجسیون: متن استاتیک index.html (پیش از JS) دست‌نخورده');

/* ============================================================
   [9] A18 — زنجیرهٔ ESC: else-if واقعی
   ============================================================ */
console.log('\n[9] A18 — یک Esc فقط یک لایه می‌بندد (زنجیرهٔ else-if)');
ok(/else if \(e\.key === 'Escape'\) \{\s*\n\s*if \(dnsQuickEl && !dnsQuickEl\.hidden\) closeDnsQuickOverlay\(\);[^\n]*\n\s*else if \(dnsPingEl && !dnsPingEl\.hidden\) closeDnsPingOverlay\(\);\n\s*else if \(!confirmBox\.hidden\) hideConfirm\(\);/.test(appSrc),
   'سورس: dnsQuick → else if dnsPing → else if confirm (زنجیرهٔ واقعی)');
ok(!/\n\s*if \(dnsPingEl && !dnsPingEl\.hidden\) closeDnsPingOverlay\(\);/.test(appSrc),
   '«if» لختِ قدیمی dnsPing (بدون else) حذف شد — دیگر دو لایه با هم بسته نمی‌شوند');
ok(/else if \(!about\.hidden\) about\.hidden = true;\n\s*else if \(!settingsPage\.hidden\) showSettings\(false\);/.test(appSrc),
   'بقیهٔ زنجیره (about/settings/…) با همان ترتیب قبلی');

/* ============================================================
   [10] A18 — about.desc نسخهٔ فعلی؛ بلوک مرده دست‌نخورده
   ============================================================ */
console.log('\n[10] A18 — about.desc: معرفی خنثیِ نسخهٔ فعلی + کلید PTT قابل‌تنظیم');
ok(appSrc.includes("'about.desc': ['آوا؛ دستیار صوتی فارسی تو — گفتار، فرمان، موزیک، یادآوری و هوش مصنوعی. کلید پوش-تو-تاک قابل تنظیم در تنظیمات.'"),
   'فارسی: آوا + پوش-تو-تاک در یک خط');
ok(/'about\.desc': \[[^\]]*push-to-talk key is configurable in Settings/.test(appSrc),
   'انگلیسی: معادل با ذکر PTT قابل‌تنظیم');
ok((appSrc.split("'about.desc': ['نسخه ۰.۲۵").length - 1) === 0,
   'D1: بلوک مرده حذف شد — about.desc قدیمی (v0.25) دیگر در دیکشنری نیست (فقط نسخهٔ زنده)');

/* ============================================================
   [11] نگهبان v0570 — ساختار تنظیمات دست نخورده + بدون bump نسخه
   ============================================================ */
console.log('\n[11] نگهبان v0570 — ناوبری گروهی/جداکننده/زیرتیتر/بدون inline/ترتیب پنل/نسخه');
ok((setSrc.match(/<div class="set-nav-group" data-i18n="/g) || []).length === 4, 'v0570: دقیقاً ۴ برچسب گروه');
ok((setSrc.match(/class="set-row( col)? first"/g) || []).length === 14, 'v0570: دقیقاً ۱۴ ردیف first');
ok((setSrc.match(/<div class="set-subhead" data-i18n="/g) || []).length === 4, 'v0570: دقیقاً ۴ زیرتیتر');
ok(!/ style="/.test(setSrc), 'v0570: صفر استایل inline در صفحهٔ تنظیمات');
ok(setSrc.includes('class="ptt-controls"') && setSrc.includes('class="set-select w190"') && setSrc.includes('class="set-input w150"'),
   'v0570: کلاس‌های ptt-controls/w190/w150 سر جایشان');
const order = [...htmlSrc.matchAll(/<div class="set-pane[^"]*" data-pane="(\w+)"/g)].map((m) => m[1]);
ok(JSON.stringify(order) === JSON.stringify(['mic', 'stt', 'wake', 'dict', 'voice', 'ai', 'discord', 'ext', 'perf', 'app', 'update']),
   'v0570: ترتیب ۱۱ پنل دقیقاً همان v0.36');
ok(cssSrc.includes('.set-row.first { border-top: none; }') && !cssSrc.includes('.set-row:first-of-type'),
   'v0570: جداکنندهٔ first سالم');
ok(appSrc.includes("let appVersion = '0.61.0-beta';"), 'نسخه: bump والد به v0.60.0-beta اعمال شد');
for (const k of ['set.ptt.onoff', 'set.navg.speak', 'set.sub.appLook']) {
  ok((appSrc.split("'" + k + "'").length - 1) >= 1, 'v0570 i18n: کلید ' + k + ' در دیکشنری ادغام‌شدهٔ D1 موجود است');
}

console.log('\n-----------------------------');
console.log(`RESULT: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
