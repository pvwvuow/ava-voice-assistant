#!/usr/bin/env node
/* scripts-test-v0530.js — doctest v0.53.0-beta
   PTT v2 (بازنویسی ریشه‌ای) + قانون ارجاع به تاریخچه
   user: «از عملکردش راضیم ولی پوش تو تاک کار نمی‌کنه — تست کردم»
   سند لاگ: صفر ردِ ptt بعد از «ptt registered» — spawn با هر فشردن + صفر لاگ
   چک‌ها:
     1) نگهبان پایدار (یک پروسه از بوت، لبهٔ down/up، Add-Type یک‌بار، ری‌استارت خودکار)
     2) globalShortcut فقط فالبک؛ pttRegister اول watcher
     3) هر مرحله لاگ (armed/ready/down/up/flush/spawn FAILED/restart)
     4) VK صحیح (رفتار واقعی pttComboVks در vm)
     5) قانون ۱۰/Rule 9 (ارجاع به تاریخچه) + learn-skip جملهٔ ارجاعی
     6) نسخه 0.53.0-beta
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
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

console.log('\n[1] نگهبان پایدار PTT v2 (main.js)');
ok(mainSrc.includes('function pttStartWatcher(vks) {'), 'pttStartWatcher (نگهبان پایدار) وجود دارد');
ok(mainSrc.includes("function pttStartHoldWatcher(") === false, 'تابع قدیمی per-press (pttStartHoldWatcher) حذف شده');
ok(mainSrc.includes('$prev=$false') && mainSrc.includes("if($all -ne $prev)"), 'اسکریپت PS: تشخیص لبهٔ down/up (نه exit بعد از اولین up)');
ok(mainSrc.includes("[Console]::Out.WriteLine(\\'ready\\')"), 'اسکریپت PS: heartbeat «ready» بعد از Add-Type');
ok(mainSrc.includes('Add-Type -TypeDefinition $s') && mainSrc.indexOf('Add-Type -TypeDefinition $s') < mainSrc.indexOf('while($true)'), 'Add-Type فقط یک‌بار قبل از حلقه');
ok(mainSrc.includes("spawn('powershell.exe'") && mainSrc.includes("Start-Sleep -Milliseconds 35"), 'پول ۳۵ms با powershell.exe مخفی');
ok(mainSrc.includes("pttSt.restartTo = setTimeout"), 'مرگ پروسه → ری‌استارت خودکار با بک‌آف');
ok(mainSrc.includes("sendUI('ava:ptt-up', { why: 'watcher-died' })"), 'مرگ وسط ضبط → «up» صادقانه (ضبط بی‌نهایت نمی‌ماند)');
ok(mainSrc.split('function pttStopHoldWatcher').length === 2, 'pttStopHoldWatcher دقیقاً یک تعریف');

console.log('\n[2] مسلح‌سازی: اول watcher، globalShortcut فقط فالبک');
const regIdx = mainSrc.indexOf('function pttRegister(win) {');
ok(regIdx > 0, 'pttRegister v2');
ok(mainSrc.slice(regIdx).indexOf('pttStartWatcher(vks)') < mainSrc.slice(regIdx).indexOf('globalShortcut.register(cfg.combo'), 'اول مسیر watcher، بعد فالبک globalShortcut');
ok(mainSrc.includes("actLog('ptt armed: ' + cfg.combo + ' (mode=' + cfg.mode + ', persistent watcher)')"), 'لاگ armed (watcher)');
ok(mainSrc.includes("actLog('ptt armed (globalShortcut fallback — watcher unavailable): '"), 'لاگ فالبک صادقانه');
ok(mainSrc.includes("if (!pttSt.ok) left.push('ptt')"), 'بوت-ریترای با pttSt.ok (مسیر watcher هم حساب است)');
ok(mainSrc.includes("ptt: disabled in settings'") || mainSrc.includes("actLog('ptt: disabled in settings')"), 'لاگ disabled');

console.log('\n[3] لاگ هر مرحله (پایان نامرئی‌بودن خرابی)');
ok(mainSrc.includes("actLog('ptt down (' + pttSt.cfg.combo + ')')") && mainSrc.includes("actLog('ptt up (release)')"), 'لبه‌ها در main لاگ می‌شوند');
ok(mainSrc.includes("'ptt watcher ready (Add-Type ok, polling 35ms): '"), 'لاگ ready (کامپایل سالم)');
ok(mainSrc.includes("actLog('ptt watcher spawn FAILED: '"), 'لاگ spawn FAILED');
ok(mainSrc.includes("'ptt watcher exited (code=' + code + ') → restart #'"), 'لاگ exit/restart');
ok(appSrc.includes("actLog('ptt down → start listening (no wake word needed)')"), 'renderer: لاگ ptt down');
ok(appSrc.includes("actLog('ptt up: nothing to stop (state=' + state + ')')"), 'renderer: لاگ up بی‌کار');
ok(appSrc.includes("actLog('ptt flush: «' + txt.slice(0, 48) + '» → deliver')"), 'renderer: لاگ flush متن');
ok(appSrc.includes("actLog('ptt flush: empty (no speech detected)')"), 'renderer: لاگ flush خالی');
ok(mainSrc.includes("ready: !!pttSt.watchReady, registered:"), 'ptt:get وضعیت watcher/ready را می‌دهد');

console.log('\n[4] رفتار واقعی pttComboVks (vm روی سورس واقعی)');
const v1 = mainSrc.indexOf('function pttComboVks(combo) {');
const v2 = mainSrc.indexOf('/* v0.53 — نگهبان پایدار PTT');
ok(v1 > 0 && v2 > v1, 'تابع pttComboVks موجود');
const sb = {};
vm.createContext(sb);
vm.runInContext(mainSrc.slice(v1, v2) + '\nthis.f=pttComboVks;', sb);
ok(JSON.stringify(sb.f('CommandOrControl+Q')) === JSON.stringify([0x11, 0x51]), 'Ctrl+Q → [0x11, 0x51]');
ok(JSON.stringify(sb.f('CommandOrControl+Shift+Space')) === JSON.stringify([0x11, 0x10, 0x20]), 'Ctrl+Shift+Space → [0x11, 0x10, 0x20]');
ok(JSON.stringify(sb.f('CommandOrControl+Alt+F5')) === JSON.stringify([0x11, 0x12, 0x74]), 'Ctrl+Alt+F5 → [0x11, 0x12, 0x74]');

console.log('\n[5] قانون ارجاع به تاریخچه + گارد یادگیری');
ok(appSrc.includes('مرجع را اول از «تاریخچهٔ همین گفتگو» بردار'), 'FA: قانون ۱۰ (v0.54: اول تاریخچه، بعد اکشن — نه حافظه، نه رد کردن)');
ok(appSrc.includes('resolve the reference FIRST from the chat history'), 'EN: rule 9 (v0.54)');
ok(appSrc.includes('learn skip: جملهٔ ارجاعی به تاریخچه — قابل بازپخش آفلاین نیست'), 'learn-skip: جملهٔ ارجاعی یاد گرفته نمی‌شود');
ok(/همون\|همین\|همان/.test(appSrc) && /همینو\|اونو/.test(appSrc) && appSrc.includes('آخرین بار|قبلی'), 'regex گارد: همون/همین/همان + همینو/اونو + آخرین بار/قبلی');

console.log('\n[6] نسخه (forward-relax ≥0.54)');
ok(pkg.version === '0.55.0-beta', 'package.json → 0.55.0-beta');
ok(htmlSrc.includes('<span id="abVersion">v0.55.0-beta</span>'), 'index.html abVersion');
ok(appSrc.includes("let appVersion = '0.55.0-beta';"), 'app.js appVersion');
ok(readme.includes('۰.۵۵.۰-بتا'), 'README بلاک ۰.۵۴ (ارقام فارسی)');

console.log('\n======================');
console.log('PASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
