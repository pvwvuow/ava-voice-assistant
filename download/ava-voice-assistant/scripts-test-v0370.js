/* ============================================================
   AVA v0.37.0 — تست‌های رگرسیون «Smart Gaming PiP» + راهنمای AI
   ریشه‌های اصلی این نسخه (درخواست کاربر):
   P1  pipWindowManager — پنجرهٔ شیشه‌ای مخصوص گیم: همیشه‌رو با
       level «screen-saver»، click-through با forward:true (الگوی
       hover-UI)، ذخیرهٔ وضعیت، میانبرهای Ctrl+Shift+P / جهت‌ها
   P2  پارسر صوتی فارسی+انگلیسی با گاردهای ضد-ربایش: «ببندش» یا
       «بالا راست» یا «کوچیکش کن» فقط با لنگر/PiP-باز/فعلِ صریح
   P3  detectActiveVideo سه‌مسیره: خودِ صفحه → webview → کلیپ‌بورد
   P4  «چجوری می‌تونم …؟» → رجیستری توانایی‌ها (آفلاین) → AI با مانیفست
   P5  لوگوی آوا داخل پنجرهٔ PiP (واترمارک + آیکون + حالت خالی)
   NEG CONTROL ها اثبات می‌کنند گاردها واقعاً کار می‌کنند.
   ============================================================ */
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond) {
  if (cond) { pass++; console.log('PASS | ' + name); }
  else { fail++; fails.push(name); console.log('FAIL | ' + name); }
}
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

const appSrc = read('renderer/js/app.js');
const htmlSrc = read('renderer/index.html');
const preloadSrc = read('preload.js');
const mainSrc = read('main.js');
const mgrSrc = read('pipWindowManager.js');
const pipHtml = read('renderer/pip.html');
const pipRendSrc = read('renderer/js/pipRenderer.js');

const core = require('./pipCore.js');
const V = require('./renderer/js/voiceCommandParser.js');
const CAP = require('./renderer/js/capabilities.js');

/* ============ ۱) pipCore — ریاضیات موقعیت/اندازه/شفافیت ============ */
const wa = { x: 0, y: 0, width: 1920, height: 1040 };
const tr = core.pipBounds(wa, 'medium', 'top-right');
ok('pipCore: top-right = workArea.width − w − 24 / y = 24', tr.x === 1920 - 480 - 24 && tr.y === 24 && tr.width === 480 && tr.height === 270);
const br = core.pipBounds(wa, 'medium', 'bottom-right');
ok('pipCore: bottom-right y = wa.height − h − 24', br.x === 1920 - 480 - 24 && br.y === 1040 - 270 - 24);
const ce = core.pipBounds(wa, 'medium', 'center');
ok('pipCore: center = (wa − w)/2 formulas', ce.x === (1920 - 480) / 2 && ce.y === (1040 - 270) / 2);
const tl = core.pipBounds(wa, 'medium', 'top-left');
ok('pipCore: top-left = margin در هر دو محور', tl.x === 24 && tl.y === 24);
const wa2 = { x: 100, y: 50, width: 1366, height: 728 };
const tr2 = core.pipBounds(wa2, 'small', 'top-right');
ok('pipCore: مانیتور دوم با offset لحاظ می‌شود', tr2.x === 100 + 1366 - 360 - 24 && tr2.y === 50 + 24);

ok('pipCore: اندازه‌های استاندارد 16:9 (360/480/640/854)',
  core.PIP_SIZES.small.w === 360 && core.PIP_SIZES.small.h === 203 &&
  core.PIP_SIZES.medium.w === 480 && core.PIP_SIZES.medium.h === 270 &&
  core.PIP_SIZES.large.w === 640 && core.PIP_SIZES.large.h === 360 &&
  core.PIP_SIZES.xl.w === 854 && core.PIP_SIZES.xl.h === 480);

ok('pipCore: stepSize بزرگ/کوچک با کلمپ', core.stepSize('medium', +1) === 'large' && core.stepSize('xl', +1) === 'xl' && core.stepSize('large', -1) === 'medium' && core.stepSize('small', -1) === 'small');
ok('pipCore: snapOpacity (60→0.5، 35→0.3، 90→1، 0.5→0.5)', core.snapOpacity(60) === 0.5 && core.snapOpacity(35) === 0.3 && core.snapOpacity(90) === 1 && core.snapOpacity(0.5) === 0.5);
ok('pipCore: stepOpacity چرخه 1→0.7→0.5', core.stepOpacity(1, -1) === 0.7 && core.stepOpacity(0.7, -1) === 0.5);

const stBad = core.normalizeState({ position: 'moon', size: 'giant', opacity: 0.01, lastBounds: { x: 55.4, y: 10, width: 500, height: 999 } });
ok('pipCore: normalizeState خرابی‌ها → پیش‌فرض + اسنپ اندازه', stBad.position === 'bottom-right' && stBad.size === 'medium' && stBad.opacity === 0.1 && stBad.lastBounds.width === 480 && stBad.lastBounds.x === 55);
const stRound = core.normalizeState(null);
ok('pipCore: پیش‌فرض = bottom-right/medium/opacity 1/alwaysOnTop', stRound.position === 'bottom-right' && stRound.size === 'medium' && stRound.opacity === 1 && stRound.alwaysOnTop === true && stRound.focusable === false);

ok('pipCore: ytIdFromUrl (youtu.be/watch/shorts/embed/live)', core.ytIdFromUrl('https://youtu.be/dQw4w9WgXcQ') === 'dQw4w9WgXcQ' && core.ytIdFromUrl('https://www.youtube.com/watch?v=abc123XYZ_-&t=30s') === 'abc123XYZ_-' && core.ytIdFromUrl('https://www.youtube.com/shorts/x9y8z7qqp') === 'x9y8z7qqp' && core.ytIdFromUrl('https://youtube.com/embed/vid1234568') === 'vid1234568');
ok('pipCore: ytStartFromUrl (90 / 1m30s / start=605 / نامعتبر→0)', core.ytStartFromUrl('https://youtu.be/x?t=90') === 90 && core.ytStartFromUrl('https://youtu.be/x?t=1m30s') === 90 && core.ytStartFromUrl('https://youtu.be/x?start=605') === 605 && core.ytStartFromUrl('https://youtu.be/x') === 0);

/* ============ ۲) پارسر صوتی — POSITIVE (فارسی + انگلیسی) ============ */
const OPEN = { pipOpen: true, size: 'medium' };
const closed = { pipOpen: false, size: 'medium' };
const I = V.INTENTS;

ok('PIN: ویدیو رو پین کن', V.parseVoiceCommand('ویدیو رو پین کن', closed).intent === I.PIN);
ok('PIN: پینش کن / فیلم رو پین کن / یوتیوب رو پین کن', ['پینش کن', 'فیلم رو پین کن', 'یوتیوب رو پین کن'].every((c) => V.parseVoiceCommand(c, closed).intent === I.PIN));
ok('PIN: ببرش حالت شناور', V.parseVoiceCommand('ببرش حالت شناور', closed).intent === I.PIN);
ok('PIN: picture in picture / pin video / float video', ['picture in picture', 'pin video', 'float video'].every((c) => V.parseVoiceCommand(c, closed).intent === I.PIN));

ok('UNPIN: بردارش فقط با PiP باز', V.parseVoiceCommand('بردارش', OPEN).intent === I.UNPIN);
ok('NEG UNPIN: بردارش با PiP بسته → null', V.parseVoiceCommand('بردارش', closed) === null);
ok('UNPIN: از صفحه بردار + پین رو بردار (لنگر) حتی با PiP بسته', V.parseVoiceCommand('از صفحه بردار', OPEN).intent === I.UNPIN && V.parseVoiceCommand('پین رو بردار', closed).intent === I.UNPIN);
ok('UNPIN: ببندش فقط با PiP باز + NEG با PiP بسته', V.parseVoiceCommand('ببندش', OPEN).intent === I.UNPIN && V.parseVoiceCommand('ببندش', closed) === null);
ok('UNPIN: unpin / close pip / hide pip', ['unpin', 'close pip', 'hide pip'].every((c) => V.parseVoiceCommand(c, OPEN).intent === I.UNPIN));

ok('MOVE: ببرش بالا سمت راست → top-right', V.parseVoiceCommand('ببرش بالا سمت راست', closed).entities.position === 'top-right');
ok('MOVE: بالا راست با PiP باز / NEG با PiP بسته', V.parseVoiceCommand('بالا راست', OPEN).entities.position === 'top-right' && V.parseVoiceCommand('بالا راست', closed) === null);
ok('MOVE: بذار بالا راست (فعل) حتی با PiP بسته', V.parseVoiceCommand('بذار بالا راست', closed).entities.position === 'top-right');
ok('MOVE: بالا چپ / ببرش پایین راست / پایین چپ', V.parseVoiceCommand('بالا چپ', OPEN).entities.position === 'top-left' && V.parseVoiceCommand('ببرش پایین راست', closed).entities.position === 'bottom-right' && V.parseVoiceCommand('پایین چپ', OPEN).entities.position === 'bottom-left');
ok('MOVE: بذار وسط / بیار وسط → center', V.parseVoiceCommand('بذار وسط', closed).entities.position === 'center' && V.parseVoiceCommand('بیار وسط', OPEN).entities.position === 'center');
ok('MOVE: center / top right / bottom left (EN)', V.parseVoiceCommand('center', OPEN).entities.position === 'center' && V.parseVoiceCommand('top right', OPEN).entities.position === 'top-right' && V.parseVoiceCommand('bottom left', OPEN).entities.position === 'bottom-left');

ok('RESIZE: خیلی کوچیکش کن → small', V.parseVoiceCommand('خیلی کوچیکش کن', OPEN).entities.size === 'small');
ok('RESIZE: کوچیکش کن با size:large → medium (نسبی) و بدون زمینه → small', V.parseVoiceCommand('کوچیکش کن', { pipOpen: true, size: 'large' }).entities.size === 'medium' && V.parseVoiceCommand('کوچیکش کن', OPEN).entities.size === 'small');
ok('NEG RESIZE: کوچیکش کن با PiP بسته → null', V.parseVoiceCommand('کوچیکش کن', closed) === null);
ok('RESIZE: متوسطش کن → medium', V.parseVoiceCommand('متوسطش کن', OPEN).entities.size === 'medium');
ok('RESIZE: بزرگش کن با size:medium → large', V.parseVoiceCommand('بزرگش کن', { pipOpen: true, size: 'medium' }).entities.size === 'large');
ok('RESIZE: خیلی بزرگش کن → extra-large', V.parseVoiceCommand('خیلی بزرگش کن', OPEN).entities.size === 'extra-large');
ok('RESIZE: small / medium / large (EN)', V.parseVoiceCommand('small', OPEN).entities.size === 'small' && V.parseVoiceCommand('medium', OPEN).entities.size === 'medium' && V.parseVoiceCommand('large', OPEN).entities.size === 'large');
ok('RESIZE: make it bigger/smaller نسبت به زمینه', V.parseVoiceCommand('make it bigger', { pipOpen: true, size: 'small' }).entities.size === 'medium' && V.parseVoiceCommand('make it smaller', { pipOpen: true, size: 'large' }).entities.size === 'medium');

ok('OPACITY: شفافش کن / کم‌رنگش کن / نیمه شفافش کن → 0.5', [V.parseVoiceCommand('شفافش کن', closed), V.parseVoiceCommand('کم‌رنگش کن', OPEN), V.parseVoiceCommand('نیمه شفافش کن', OPEN)].every((r) => r && r.intent === I.OPACITY && r.entities.opacity === 0.5));
ok('OPACITY: opacity fifty / opacity 50 → 0.5', V.parseVoiceCommand('opacity fifty', OPEN).entities.opacity === 0.5 && V.parseVoiceCommand('opacity 50', OPEN).entities.opacity === 0.5);
ok('OPACITY: شفافیت پنجاه درصد → 0.5 / هفتاد درصد → 0.7', V.parseVoiceCommand('شفافیت پنجاه درصد', OPEN).entities.opacity === 0.5 && V.parseVoiceCommand('شفافیت هفتاد درصد', OPEN).entities.opacity === 0.7);
ok('OPACITY: کامل نشون بده → 1', V.parseVoiceCommand('کامل نشون بده', OPEN).entities.opacity === 1);
ok('OPACITY: opacity 30 → 0.3', V.parseVoiceCommand('opacity 30', OPEN).entities.opacity === 0.3);

ok('CT: کلیک روش رو ببند / کلیک از روش رد بشه / مزاحم کلیک نباشه / click through on / disable mouse → ON',
  ['کلیک روش رو ببند', 'کلیک از روش رد بشه', 'مزاحم کلیک نباشه', 'click through on', 'disable mouse'].every((c) => V.parseVoiceCommand(c, OPEN).intent === I.CT_ON));
ok('CT: کلیک روش فعال باشه / click through off → OFF (وارونگی درست)', V.parseVoiceCommand('کلیک روش فعال باشه', OPEN).intent === I.CT_OFF && V.parseVoiceCommand('click through off', OPEN).intent === I.CT_OFF);

ok('TOP: همیشه رو صفحه باشه / بذار همیشه بالا بمونه / always on top → ON',
  V.parseVoiceCommand('همیشه رو صفحه باشه', OPEN).intent === I.TOP_ON && V.parseVoiceCommand('بذار همیشه بالا بمونه', closed).intent === I.TOP_ON && V.parseVoiceCommand('always on top', OPEN).intent === I.TOP_ON);
ok('TOP: دیگه همیشه بالا نباشه → OFF (نه ON!)', V.parseVoiceCommand('دیگه همیشه بالا نباشه', OPEN).intent === I.TOP_OFF);

ok('RESET: ریستش کن / برگردون حالت پیش‌فرض / reset pip', V.parseVoiceCommand('ریستش کن', OPEN).intent === I.RESET && V.parseVoiceCommand('برگردون حالت پیش\u200cفرض', OPEN).intent === I.RESET && V.parseVoiceCommand('reset pip', closed).intent === I.RESET);

/* --- NEG CONTROLS: جمله‌های غیر-PiP نباید ربایش شوند --- */
ok('NEG: قیمت دلار چنده → null', V.parseVoiceCommand('قیمت دلار چنده', OPEN) === null);
ok('NEG: هوا چطوره → null', V.parseVoiceCommand('هوا چطوره', OPEN) === null);
ok('NEG: آهنگ بعدی پلیر → null', V.parseVoiceCommand('آهنگ بعدی پلیر', OPEN) === null);
ok('NEG: کروم رو باز کن → null', V.parseVoiceCommand('کروم رو باز کن', OPEN) === null);
ok('NEG: سیستم رو خاموش کن → null (بدون «از صفحه»)', V.parseVoiceCommand('سیستم رو خاموش کن', OPEN) === null);
ok('NEG: یوتیوب رو باز کن → null و دروازهٔ قانون هم رد نمی‌کند', V.parseVoiceCommand('یوتیوب رو باز کن', OPEN) === null && !V.PIP_COMMAND_RE.test('یوتیوب رو باز کن'));
ok('GATE: یوتیوب رو پین کن از دروازه رد می‌شود', V.PIP_COMMAND_RE.test('یوتیوب رو پین کن'));
ok('GATE: نرمال‌سازی ارقام/عربی/نیم‌فاصله', V.normFa('شفافیت ٱ۰۷٠٪') === 'شفافیت 070٪' ? true : V.normFa('شفافیت ۷۰').includes('70'));

/* ============ ۳) «چجوری می‌تونم …؟» — رجیستری توانایی‌ها ============ */
ok('HOW: چجوری میتونم ویدیو رو پین کنم → pip', CAP.search('چجوری میتونم ویدیو رو پین کنم').cap.id === 'pip');
ok('HOW: چطور میتونم دیسکورد رو میوت کنم → dc-mute', CAP.search('چطور میتونم دیسکورد رو میوت کنم').cap.id === 'dc-mute');
ok('HOW: چجوری تایپ صوتی کنم → dictation', CAP.search('چجوری تایپ صوتی کنم').cap.id === 'dictation');
ok('HOW: چطوری آهنگ بزنم → music', CAP.search('چطوری آهنگ بزنم').cap.id === 'music');
ok('HOW: چجوری کامپیوتر رو خاموش کنم → power', CAP.search('چجوری میتونم کامپیوتر رو خاموش کنم').cap.id === 'power');
ok('HOW: چجوری سایت رو باز کنم → sites', CAP.search('چجوری میتونم یه سایت رو باز کنم').cap.id === 'sites');
ok('HOW: چجوری ویدیو رو تو بازی گوشه بذارم → pip', CAP.search('چجوری ویدیو رو وسط بازی گوشه صفحه بذارم').cap.id === 'pip');
ok('HOW: پاسخ محلی شامل «کافیه بگی» + مثال نقل‌قولی', (() => { const r = CAP.howReply(CAP.search('چجوری ویدیو رو پین کنم'), 'fa'); return r.includes('کافیه بگی') && r.includes('ویدیو رو پین کن'); })());
ok('HOW: aiPromptAddon شامل مانیفست + قانون «هیچ فرمانی اجرا نکن»', CAP.aiPromptAddon().includes('ویدیوی شناور') && CAP.aiPromptAddon().includes('هیچ فرمانی اجرا نکن') && CAP.aiPromptAddon().includes('صادقانه'));
ok('NEG HOW: چجوری برم مریخ → null (به AI می‌رود)', CAP.search('چجوری میتونم به مریخ سفر کنم') === null);

/* ============ ۴) اتصال‌ها — main/preload/app/pip.html ============ */
ok('main.js: pipManager require + init داخل whenReady', mainSrc.includes("require('./pipWindowManager')") && /pipManager\.init\(\{\s*win\s*\}\)/.test(mainSrc));
ok('manager: alwaysOnTop با level screen-saver + setVisibleOnAllWorkspaces', mgrSrc.includes("'screen-saver'") && mgrSrc.includes('setVisibleOnAllWorkspaces'));
ok('manager: click-through با forward:true (الگوی hover-UI)', mgrSrc.includes('setIgnoreMouseEvents') && mgrSrc.includes('forward: true'));
ok('manager: ذخیره/بازیابی pip-state.json در userData', mgrSrc.includes('pip-state.json') && mgrSrc.includes('savePiPState') && mgrSrc.includes('loadPiPState'));
ok('manager: میانبرها — Ctrl+Shift+P همیشه، جهت‌ها فقط وقتی PiP باز است', mgrSrc.includes("CommandOrControl+Shift+P") && mgrSrc.includes('bindMoveKeys') && mgrSrc.includes('CommandOrControl+Shift+Left'));
ok('manager: درگ دستی با poll مختصات ماوس + failsafe', mgrSrc.includes('startDrag') && mgrSrc.includes('getCursorScreenPoint') && mgrSrc.includes('stopDrag'));
ok('manager: مانیتور فعال = ماوس (getCursorScreenPoint→workArea)', mgrSrc.includes('getDisplayNearestPoint') && mgrSrc.includes('activeWorkArea'));
ok('manager: صفحه از ava://app/renderer/pip.html با preload جدا و contextIsolation', mgrSrc.includes('ava://app/renderer/pip.html') && mgrSrc.includes('pipPreload.js') && mgrSrc.includes('contextIsolation: true') && mgrSrc.includes('nodeIntegration: false'));
ok('manager: ناوبری فقط امبد یوتیوب + deny popup', mgrSrc.includes('youtube(-nocookie)') && mgrSrc.includes("action: 'deny'"));
ok('manager: توضیح Exclusive Fullscreen → Borderless در کد', /Borderless Windowed/.test(mgrSrc) && /Exclusive Fullscreen|تمام\u200cصفحه\u200cای انحصاری/.test(mgrSrc));
ok('manager: skipTaskbar/hasShadow:false/backgroundColor شفاف', mgrSrc.includes('skipTaskbar: true') && mgrSrc.includes('hasShadow: false') && mgrSrc.includes("backgroundColor: '#00000000'"));
ok('manager: بوت خودش PiP را باز نمی‌کند (init بدون showPiP)', (() => { const m = mgrSrc.match(/function init\(opts\) \{[\s\S]*?\n\}/); return !!m && !m[0].includes('showPiP(') && !m[0].includes('createPiPWindow('); })());

ok('preload: pipAPI کامل (show/hide/move/resize/setOpacity/setClickThrough/setAlwaysOnTop/reset/getState/clipboard/onState)', ['show', 'hide', 'toggle', 'move', 'resize', 'setOpacity', 'setClickThrough', 'setAlwaysOnTop', 'reset', 'getState', 'clipboard', 'onState'].every((k) => new RegExp('pipAPI[\\s\\S]{0,1600}' + k).test(preloadSrc)));
ok('pipPreload: پل امن صفحهٔ PiP (ready/close/hoverUi/dragStart/ctl/onSource/onState)', ['ready', 'close', 'hoverUi', 'dragStart', 'dragEnd', 'ctl', 'onSource', 'onState'].every((k) => pipRendSrc.length > 0 && fs.readFileSync(path.join(__dirname, 'pipPreload.js'), 'utf8').includes(k)));

ok('app.js: قانون PIP با AVAVoice.PIP_COMMAND_RE + pipVoiceReply + قانون HOW با __aiExtra', appSrc.includes('AVAVoice.PIP_COMMAND_RE') && appSrc.includes('pipVoiceReply') && appSrc.includes('__aiExtra: AVACapabilities.aiPromptAddon()'));
ok('app.js: HOW قبل از PIP splice می‌شود (چجوری…پین کنم → راهنما نه پین!)', (() => { const m = appSrc.match(/const pipRules = \[[\s\S]*?\];/); return !!m && m[0].indexOf('howToReply') < m[0].indexOf('AVAVoice.PIP_COMMAND_RE'); })());
ok('app.js: dispatch fallback مانیفست را به aiHandleCommand می‌دهد', /aiHandleCommand\(cmd, (?:await aiFallbackCtx\(rule\)|rule && rule\.__aiExtra)\)/.test(appSrc)); /* v0.42: aiFallbackCtx شامل __aiExtra */
ok('app.js: aiAsk/aiHandleCommand پارامتر extraCtx دارند', appSrc.includes('async function aiAsk(text, extraCtx)') && appSrc.includes('async function aiHandleCommand(cmd, extraCtx)'));
ok('app.js: detectActiveVideo سه‌مسیره (video → webview → کلیپ‌بورد)', appSrc.includes('async function detectActiveVideo') && appSrc.includes("document.querySelectorAll('video')") && appSrc.includes("document.querySelector('webview')") && appSrc.includes('bridge.pipAPI.clipboard()'));
ok('app.js: مسیر blob صادقانه است (قابل انتقال نیست)', appSrc.includes("kind: 'blob'") && appSrc.includes('انتقال مستقیم ممکن نیست'));
ok('app.js: بدون AI هم fallback صادقانهٔ PiP دارد', appSrc.includes('اول یه ویدیو پین کن'));

ok('pip.html: واترمارک + لوگو + data-ui + CSP امبد فقط یوتیوب', pipHtml.includes('assets/ava-logo.png') && (pipHtml.match(/data-ui="1"/g) || []).length >= 6 && /frame-src https:\/\/www\.youtube\.com/.test(pipHtml) && pipHtml.includes('btnLock') && pipHtml.includes('btnOpacity') && pipHtml.includes('grip'));
ok('pipRenderer: hoverUi + dragStart/dragEnd + onSource YouTube embed', pipRendSrc.includes('hoverUi') && pipRendSrc.includes('dragStart') && pipRendSrc.includes('youtube.com/embed/') && pipRendSrc.includes('start='));
ok('pipRenderer: زمان شروع یوتیوب با ?start= منتقل می‌شود (sync کامل محدود است)', pipRendSrc.includes("'&start=' + s") && /sync.*محدود|محدود.*sync/.test(pipRendSrc));

/* ============ ۵) لوگو + اسکریپت‌ها + نسخه ============ */
ok('لوگو: renderer/assets/ava-logo.png موجود (512px → >50KB)', (() => { try { const st = fs.statSync(path.join(__dirname, 'renderer/assets/ava-logo.png')); return st.size > 50 * 1024; } catch (_) { return false; } })());
ok('index.html: اسکریپت‌های parser/capabilities قبل از app.js', htmlSrc.indexOf('js/voiceCommandParser.js') > -1 && htmlSrc.indexOf('js/capabilities.js') > -1 && htmlSrc.indexOf('js/voiceCommandParser.js') < htmlSrc.indexOf('js/app.js') && htmlSrc.indexOf('js/capabilities.js') < htmlSrc.indexOf('js/app.js'));
ok('نسخه 0.37+ در هر سه فایل (forward)', /^0\.(3[7-9]|[4-9][0-9])\.[\w.-]+$/.test(require('./package.json').version) && /let appVersion = '0\.(3[7-9]|[4-9][0-9])\.[\w.-]+';/.test(appSrc) && />v0\.(3[7-9]|[4-9][0-9])\./.test(htmlSrc));

console.log('\nRESULT: ' + pass + '/' + (pass + fail));
if (fail) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
