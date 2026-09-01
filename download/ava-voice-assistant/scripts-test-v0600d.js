#!/usr/bin/env node
/* scripts-test-v0600d.js — Wave 3b / D2: حذف CSS و JS مرده + ادغام ۴ جفت قانون تکراری (v0.60.0-beta line)
   روی پایهٔ v0.57.0-beta — بدون bump نسخه
   ------------------------------------------------------------
   چک‌ها:
     1)  D2-a — سلکتورهای CSS مرده از styles.css حذف شده‌اند و در index.html/app.js هم ارجاعی ندارند
     2)  D2-b — خوشهٔ JS ویژوالایزر (mViz/viz*) کامل از app.js حذف شد — #mViz از اول در DOM نبود
     3)  D2-c — ۴ جفت قانون تکراری ادغام شدند (برنده = کپی بعدی): .greet h1 ، .m-ctl ،
         .m-tt/.m-idx/.m-dur ، .music-deck (+ دوقلوی media ۹۰۰px) — صفر تغییر ظاهری
     4)  D2-d — چیزهای زنده دست‌نخورده: ریل، پلیر جدید، chipها، eqBounce مشترک، .m-row و pinnedهای v0570
*/
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

const cssSrc = fs.readFileSync(path.join(ROOT, 'renderer/css/styles.css'), 'utf8');
const appSrc = fs.readFileSync(path.join(ROOT, 'renderer/js/app.js'), 'utf8');
const htmlSrc = fs.readFileSync(path.join(ROOT, 'renderer/index.html'), 'utf8');

/* ============================================================
   [1] D2-a — سلکتورهای مرده: غیبت در styles.css + صفر ارجاع در index.html/app.js
   ============================================================ */
console.log('\n[1] D2-a — سلکتورهای CSS مرده حذف شدند (styles.css + index.html + app.js)');
const deadCssSelectors = [
  '.rail-logo', '.rail-dot', '.rail-item.locked',
  '.set-sub {', '.set-sub::after',
  '.np-card', '.np-disc', '.np-hole', '.np-disc-wrap', '.pl-card', '.pl-head',
  '.np-vol', '.m-eq', '.m-list-head', '.m-cover', '.music-hero',
  '.chip-x', '.chip.custom', '.chips {', '#mViz',
];
for (const sel of deadCssSelectors) {
  ok(!cssSrc.includes(sel), 'styles.css بدون ' + sel.trim());
}
ok(!/\.chips[^-]/.test(cssSrc), 'styles.css بدون کلاس .chips (بدون خلط با cs-chips/cp-chips)');
ok(!cssSrc.includes('@keyframes discSpin'), 'keyframes یتیم discSpin (فقط مصرف‌کننده‌اش np-disc بود) حذف شد');
ok((cssSrc.match(/set-subhead/g) || []).length >= 3, 'set-subhead (هم‌خانوادهٔ زندهٔ v0570) سالم است — با set-sub خلط نشد');

const htmlNeedles = ['rail-logo', 'rail-dot', 'rail-item.locked', 'class="locked"',
  'np-card', 'np-disc', 'np-hole', 'pl-card', 'pl-head', 'np-vol',
  'm-eq', 'm-list-head', 'class="m-cover"', 'music-hero', 'chip-x', 'chip custom', 'class="chips"', 'mViz'];
for (const n of htmlNeedles) {
  ok(!htmlSrc.includes(n), 'index.html بدون ' + n);
}
const appNeedles = ['rail-logo', 'rail-dot', '.rail-item.locked',
  'np-card', 'np-disc', 'np-hole', 'pl-card', 'pl-head', 'np-vol',
  'm-eq', 'm-list-head', "'.m-cover'", 'music-hero', 'chip-x', "'.chips'",
  'chip custom', 'class="chip custom"', "classList.add('custom')"];
for (const n of appNeedles) {
  ok(!appSrc.includes(n), 'app.js بدون ' + n);
}

/* ============================================================
   [2] D2-b — خوشهٔ JS ویژوالایزر کامل حذف شد
   ============================================================ */
console.log('\n[2] D2-b — خوشهٔ mViz/viz* در app.js صفر شد');
const vizTokens = ['mViz', 'vizStart', 'vizStop', 'vizEnsure', 'vizResize', 'vizDraw',
  'vizRaf', 'vizCtx', 'vizAnalyser', 'vizData', 'vizTick', 'createMediaElementSource'];
for (const t of vizTokens) {
  ok(!appSrc.includes(t), 'app.js بدون ' + t);
}
ok(!/createAnalyser[\s\S]{0,240}mAudio|MediaElementSource/.test(appSrc), 'createAnalyser باقی‌مانده فقط متعلق به اورب (analyser میکروفون — زنده) است، نه viz موزیک');
ok(!cssSrc.includes('mViz') && !htmlSrc.includes('mViz'), '#mViz هیچ ردی در styles.css/index.html ندارد');
ok(appSrc.includes("mAudio.addEventListener('play'") && appSrc.includes("mAudio.addEventListener('pause'"),
  'لیسنرهای play/pause خود mAudio حفظ شدند (فقط فراخوانی viz از آن‌ها خط خورد)');
ok(appSrc.includes("actLog('music play')"), 'actLog(«music play») در لیسنر play حفظ شد (رفتار لاگ عیناً قبلی)');

/* ============================================================
   [3] D2-c — ادغام ۴ جفت قانون تکراری (برنده = کپی بعدی)
   ============================================================ */
console.log('\n[3] D2-c — ۴ جفت تکراری ادغام شد — هر سلکتور پایه دقیقاً یک‌بار بیرون از media query');
const onceSelectors = [/^\.m-ctl \{/m, /^\.m-idx \{/m, /^\.m-tt \{/m, /^\.m-dur \{/m, /^\.music-deck \{/m];
for (const re of onceSelectors) {
  const n = (cssSrc.match(re) || []).length;
  ok(n === 1, re.source + ' → دقیقاً ' + n + ' بار (بیرون از media، با انکر ابتدای خط)');
}
/* .greet h1: برنده (درخشش) + نسخهٔ اولیهٔ فقط با props غیرهمپوشان — چون ۴ media query
   font-size «قبل از» قانون درخشش می‌آیند، بردنِ font-size به پایین فایل cascade را می‌شکست؛
   پس count نهایی ۲ پین شد (قبلاً هم ۲ بود ولی با پس‌زمینهٔ همپوشان) */
ok((cssSrc.match(/^\.greet h1 \{/gm) || []).length === 2, '.greet h1 دقیقاً ۲ قانون پایه (props یکتا + قانون برندهٔ درخشش) — پینِ count حاصل از ادغام');
ok(!cssSrc.includes('linear-gradient(180deg, #ffffff, #a9cdbb)'), 'پس‌زمینهٔ قدیمی .greet h1 (کپی بازندهٔ بالای فایل) حذف شد');
ok(cssSrc.includes('animation: greetShine 7s ease-in-out infinite'), 'قانون برندهٔ درخشش .greet h1 سر جایش است');
ok((cssSrc.match(/^  \.greet h1 \{ font-size:/gm) || []).length === 4, '۴ media query فونت‌سایز .greet h1 دست‌نخورده (cascade حفظ شد)');

/* .music-deck: مقادیر برندهٔ کپی بعدی + props یکتای کپی اول در یک قانون واحد */
const deckMatch = cssSrc.match(/\.music-deck \{[\s\S]*?\n\}/);
ok(!!deckMatch && deckMatch[0].includes('display: grid') && deckMatch[0].includes('grid-template-columns: minmax(300px, 430px) minmax(280px, 1fr)') &&
   deckMatch[0].includes('gap: 28px') && deckMatch[0].includes('width: 100%') &&
   deckMatch[0].includes('max-width: 980px') && deckMatch[0].includes('margin: 0 auto') &&
   deckMatch[0].includes('margin-top: 4px') && deckMatch[0].includes('align-items: start'),
  'قانون ادغام‌شدهٔ .music-deck = برندهٔ بعدی (430px/28px/980px/margin-top) + props یکتای اول (display/width/margin:auto/align-items)');
ok((cssSrc.match(/@media \(max-width: 900px\) \{ \.music-deck \{ grid-template-columns: 1fr; \} \}/g) || []).length === 1,
  'دوقلوی media ۹۰۰px مجرد (dotted twin) — قبلاً ۲ نسخهٔ یکسان بود');

/* .m-ctl: کپی بازنده حذف شد؛ border-radius:10px یکتای .m-ctl.sm (که کپی بعدی ندارد) حفظ شد */
ok((cssSrc.match(/^\.m-ctl\.sm \{ width: 30px; height: 30px; border-radius: 10px; \}$/m) || []).length === 1,
  '.m-ctl.sm با border-radius: 10px حفظ شد (قانون بعدی آن را override نمی‌کرد — حذفش visual change بود)');
ok(/\.m-ctl \{[^}]*border-radius: 50%/.test(cssSrc), '.m-ctl پایه = مقادیر برندهٔ v0.21 (circle 36px + background: transparent)');
ok(cssSrc.includes('.m-ctl.sm { width: 30px; height: 30px; }') && cssSrc.includes('.m-ctl.sm .ic { width: 14px; height: 14px; }'),
  'قوانین برندهٔ .m-ctl.sm بعدی سر جایشان هستند');
/* .m-tt/.m-idx/.m-dur: کپی‌های بازندهٔ بالای فایل حذف — برنده‌ها (superset) تک‌ماندند */
ok(cssSrc.includes('.m-idx { width: 28px; height: 20px; display: grid; place-items: center;') &&
   cssSrc.includes('.m-tt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }'),
  'برنده‌های .m-idx/.m-tt (نسخهٔ v0.21 با جزئیات بیشتر) تنها نسخه‌های باقی‌مانده‌اند');
ok((cssSrc.match(/^\.m-row\.current \.m-dur \{ color: var\(--acc2\); \}$/gm) || []).length === 1 &&
   (cssSrc.match(/^\.m-row\.current \.m-idx \{ color: var\(--acc2\); \}$/gm) || []).length === 1,
  'دوقلوهای وضعیت .m-row.current (.m-dur/.m-idx) هم تک‌نسخه شدند');

/* ============================================================
   [4] D2-d — زنده‌ها دست‌نخورده (ریل/پلیر جدید/chip/eqBounce مشترک)
   ============================================================ */
console.log('\n[4] D2-d — سلکتورهای زنده و pinnedها سالم ماندند');
for (const alive of ['#rail {', '.rail-nav, .rail-bottom', '.rail-item {', '.rail-item.active', '.rail-ind {',
  '.np-head {', '.np-chips {', '.m-count {', '.chip {', '.chip.sm {', '.chip.danger {',
  '.m-search {', '.m-list {', '.m-hint {', '.musicpage > .m-hint',
  '@keyframes eqBounce', '.mw-eq.live i { animation: eqBounce',
  '.m-row {', '.dc-contact {', '.set-subhead {', '.set-nav-group {', 'ptt-controls']) {
  ok(cssSrc.includes(alive), 'styles.css نگه داشت: ' + alive);
}
ok(htmlSrc.includes('class="rail-item') && htmlSrc.includes('rail-ind') && htmlSrc.includes('id="mCover"') &&
   htmlSrc.includes('class="np-cover"') && htmlSrc.includes('class="np-eq"') && htmlSrc.includes('id="mCount"'),
  'index.html: ریل/پلیر جدید (np-*) و idهای زنده پابرجا');
ok(cssSrc.split('{').length === cssSrc.split('}').length, 'بالانس آکولادهای styles.css سالم (هیچ برش ناقصی رخ نداده)');

console.log('\n-----------------------------');
console.log(`RESULT: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
