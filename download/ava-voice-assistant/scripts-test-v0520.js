#!/usr/bin/env node
/* scripts-test-v0520.js — doctest v0.60.0-beta
   پروتکل فکر (THINK-FIRST BRAIN) — خواستهٔ کاربر:
   «چرا AI خودش تحلیل نمی‌کنه جمله رو؟ شاید یک سوال باشه — باید با خودش فکر کنه،
   بعد که فکر کرد و تحقیق کرد، بعد جوابو بده»
   چک‌ها:
     1) پرامپت FA/EN: پروتکل صفر + خط فکر اجباری + بلوک RESEARCH + قانون ۳ بازنویسی‌شده
     2) رفتار واقعی stripThink / parseResearch (اجرای سورسِ واقعی در vm)
     3) اتصال aiThinkRound به aiHandleCommand و handleChatSend (فکر هرگز به TTS نمی‌رسد)
     4) بامپ نسخه (package.json + index.html + appVersion + README ارقام فارسی)
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname; /* اسکریپت‌ها داخل ریشهٔ خود اپ‌اند (کنار package.json) */
let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

const appSrc = fs.readFileSync(path.join(ROOT, 'renderer/js/app.js'), 'utf8');
const htmlSrc = fs.readFileSync(path.join(ROOT, 'renderer/index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

console.log('\n[1] پرامپت — پروتکل فکر (FA)');
ok(appSrc.includes('پروتکل صفر (همیشه، قبل از هر پاسخ): اول با خودت فکر کن، بعد جواب بده'), 'FA: پروتکل صفر (فکر قبل از پاسخ)');
ok(appSrc.includes('فکر: نوع جمله (سوال/فرمان/گفتگو/اصلاح/مبهم) | خواستهٔ واقعی کاربر | نیاز به اطلاعات تازهٔ وب: بله/خیر'), 'FA: قالب خط فکر (نوع | خواسته | تحقیق؟)');
ok(appSrc.includes('این خط فقط تحلیلِ درونی توست و هرگز خوانده یا نمایش داده نمی‌شود'), 'FA: خط فکر هرگز خوانده/نمایش داده نمی‌شود');
ok(appSrc.includes("<<<RESEARCH>>>\\n' +\n    '{\"query\":\"عبارت جستجو\"}"), 'FA: قالب بلوک RESEARCH');
ok(appSrc.includes('قانون مهم ۳ (به‌روزشده): اگر درخواست گفتگویی/سلیقه‌ای بود'), 'FA: قانون ۳ بازنویسی‌شده (گفتگویی=خودت)');
ok(appSrc.includes('هرگز حدس نزن و هرگز web_search نزن — فقط این بلوک را بده'), 'FA: سوالِ تازه‌خواه = RESEARCH (نه حدس، نه web_search)');
ok(appSrc.includes('سوالِ دانش عمومی پایدار'), 'FA: دانش عمومی پایدار = خودت جواب بده');
ok(!appSrc.includes("'قانون مهم ۳: اگر درخواست، سوال یا درخواست گفتگویی است"), 'FA: متن قدیمی قانون ۳ حذف شده');

console.log('\n[2] پرامپت — THINK protocol (EN)');
ok(appSrc.includes('Zero protocol (always, before any answer): think first'), 'EN: zero protocol');
ok(appSrc.includes('THINK: sentence type (question/command/chat/correction/ambiguous) | what the user really wants | needs fresh web facts: yes/no'), 'EN: THINK line format');
ok(appSrc.includes('must NEVER be guessed and NEVER become web_search'), 'EN: fresh-facts question = RESEARCH block');
ok(appSrc.includes('ask one short clarifying question instead of guessing'), 'EN: ambiguous = clarify, no guessing');

console.log('\n[3] رفتار واقعی stripThink / parseResearch (سورس واقعی app.js در vm اجرا می‌شود)');
const s1 = appSrc.indexOf('function stripThink(text) {');
const s2 = appSrc.indexOf('function parseResearch(text) {');
const s3 = appSrc.indexOf('/* یک دور کامل: فکر → (در صورت نیاز) تحقیق واقعی وب');
ok(s1 > 0 && s2 > s1 && s3 > s2, 'توابع کنار هم در app.js موجودند');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(appSrc.slice(s1, s3) + '\nthis.stripThink=stripThink;this.parseResearch=parseResearch;', sandbox);
const st1 = sandbox.stripThink('فکر: سوال | جدیدترین آهنگ شادمهر | بله\nجدیدترین آهنگ شادمهر را نمی‌دانم، تحقیق می‌کنم.');
ok(st1.think.includes('سوال') && st1.body === 'جدیدترین آهنگ شادمهر را نمی‌دانم، تحقیق می‌کنم.', 'stripThink: خط فکر فارسی جدا و حذف می‌شود');
const st2 = sandbox.stripThink('THINK: question | newest Shadmehr song | yes\nLet me research.');
ok(st2.think.includes('question') && st2.body === 'Let me research.', 'stripThink: THINK انگلیسی هم پشتیبانی می‌شود');
const st3 = sandbox.stripThink('پاسخ بدون فکر');
ok(st3.think === '' && st3.body === 'پاسخ بدون فکر', 'stripThink: بدون خط فکر دست‌نخورده می‌گذرد');
const pr1 = sandbox.parseResearch('متن\n<<<RESEARCH>>>\n{"query":"جدیدترین آهنگ شادمهر ۲۰۲۶"}\n<<<END>>>\nپایان');
ok(pr1.query === 'جدیدترین آهنگ شادمهر ۲۰۲۶' && pr1.body.replace(/\n+/g, '\n') === 'متن\nپایان', 'parseResearch: JSON سالم → query + حذف بلوک');
const pr2 = sandbox.parseResearch('<<<RESEARCH>>> query: آهنگ جدید شادمهر <<<END>>>');
ok(pr2.query === 'query: آهنگ جدید شادمهر' || pr2.query.includes('شادمهر'), 'parseResearch: فرم خراب هم query می‌دهد');
const pr3 = sandbox.parseResearch('بدون بلوک');
ok(pr3.query === '' && pr3.body === 'بدون بلوک', 'parseResearch: بدون بلوک خالی');

console.log('\n[4] اتصال به مسیر فرمان و چت');
ok(appSrc.includes('async function aiThinkRound(text, extraCtx) {'), 'aiThinkRound تعریف شده');
ok(appSrc.includes("const _bt = await aiThinkRound(cmd, extraCtx);") && appSrc.includes('const r = _bt.r;'), 'aiHandleCommand: مسیر فکر-اول');
ok(appSrc.includes("parseAdd(_bt.body || r.text)"), 'پاسخ متنی از bodyِ بی‌فکر (فکر هرگز به TTS/نمایش نمی‌رسد)');
ok(appSrc.includes('const _bt = await aiThinkRound(v);'), 'handleChatSend: چت هم فکر-اول');
ok(appSrc.includes('فهمید(ai فکر)') && appSrc.includes("ev: 'interpret', via: 'ai'"), 'لاگ گفت/فهمید برای مسیر AI (فکر در لاگ می‌ماند)');
ok(appSrc.includes('ai research(جواب)'), 'تحقیق واقعی وب برای سوال‌ها (نه فقط act=research)');
ok(appSrc.includes('بلوک RESEARCH دیگر مجاز نیست و هرگز اسم/عنوان را از حافظه‌ات نساز'), 'دور دوم: ضد توهم (فقط بر پایهٔ نتایج)');
ok(appSrc.indexOf('RESEARCH_CTX_MARK', appSrc.indexOf('async function aiThinkRound')) > 0, 'گارد دورِ دوم (حلقهٔ بیش از یک دور نیست — از طریق RESEARCH_CTX_MARK؛ forward-relax v0.60: لیترال به ثابت منتقل شد)');

console.log('\n[5] نسخه 0.61.0-beta');
ok(pkg.version === '0.61.0-beta', 'package.json → 0.61.0-beta');
ok(htmlSrc.includes('<span id="abVersion">v0.61.0-beta</span>'), 'index.html abVersion');
ok(appSrc.includes("let appVersion = '0.61.0-beta';"), 'app.js appVersion');
ok(readme.includes('۰.۶۱.۰-بتا'), 'README بلاک ۰.۵۳ (ارقام فارسی)');
ok(readme.includes('پروتکل فکر: اول فکر کن، تحقیق کن، بعد جواب بده'), 'README: عنوان نسخه');

console.log('\n======================');
console.log('PASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
