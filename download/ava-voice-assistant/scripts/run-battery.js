#!/usr/bin/env node
'use strict';
/* ============================================================
   scripts/run-battery.js — دوندهٔ باتری تست آوا (موج ۱۷-e / C4)
   ------------------------------------------------------------
   باتریِ صریح = همهٔ scripts-test-v0*.js (گلوب، مرتب‌شده)
                 + scripts-test-ave3.js + scripts-test-dns.js + scripts-test-race.js
   هر سوئیت با node اجرا می‌شود؛ کد خروج + آخرین خط خروجی ثبت می‌شود.
   خروجی: یک خط برای هر سوئیت + خلاصهٔ JSON نهایی
     {suites, pass, fail, failures:[{suite, out}]}
   کد خروج: اگر هر سوئیتی شکست بخورد → ۱.
   معیار شکست: کد خروج غیرصفر (اصلی) + الگوهای «N fail» برای سوئیت‌هایی
   که همیشه صفر خارج می‌شوند (FAIL=[1-9] / «N fail» غیرصفر / «P/T» ناقص).
   استفاده: node scripts/run-battery.js            (از هر جایی)
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const APP = path.resolve(__dirname, '..');

/* باتری صریح — بدون کشف خودکارِ چیزهای دیگر */
const vSuites = fs.readdirSync(APP)
  .filter((f) => /^scripts-test-v0.*\.js$/.test(f))
  .sort();
const extraSuites = ['scripts-test-ave3.js', 'scripts-test-dns.js', 'scripts-test-race.js'];
const suites = [];
for (const s of [...vSuites, ...extraSuites]) {
  if (!suites.includes(s) && fs.existsSync(path.join(APP, s))) suites.push(s);
}

if (suites.length === 0) {
  console.error('no test suites found in ' + APP);
  process.exit(1);
}

/* معیار شکستِ کمکی برای سوئیت‌هایی که همیشه با کد ۰ خارج می‌شوند —
   فقط روی «آخرین خط» سنجیده می‌شود (متن کامل پر از کسر و شمارش است) */
function outputSaysFail(lastLine) {
  if (!lastLine) return false;
  if (/FAIL\s*=\s*[1-9]/i.test(lastLine)) return true;                 // FAIL=3  (نه FAIL=0)
  let m = lastLine.match(/(?:^|[^\d=])(\d+)\s+fail\b(?!\s*=)/i);       // «2 fail»  (نه «PASS=32 FAIL=0»)
  if (m && +m[1] > 0) return true;
  m = lastLine.match(/(\d+)\s*\/\s*(\d+)/);                            // «44/45» ناقص (نه 45/45)
  if (m && +m[1] < +m[2]) return true;
  return false;
}

let pass = 0, fail = 0; const failures = [];
console.log('=== AVA test battery — ' + suites.length + ' suites (root: ' + APP + ') ===');

for (const s of suites) {
  const r = spawnSync(process.execPath, [path.join(APP, s)], {
    cwd: APP, encoding: 'utf8', timeout: 10 * 60 * 1000, maxBuffer: 64 * 1024 * 1024,
  });
  const out = ((r.stdout || '') + (r.stderr || '')).trim();
  const lastLine = out ? out.split('\n').filter((l) => l.trim() !== '').pop() : '';
  const bad = (r.status !== 0) || r.error || outputSaysFail(lastLine);
  if (bad) {
    fail++;
    failures.push({ suite: s, out: lastLine || ('exit=' + (r.status != null ? r.status : (r.error && r.error.code))) });
    console.log('✗ ' + s + ' — ' + (lastLine || ('exit=' + (r.status != null ? r.status : 'error'))));
  } else {
    pass++;
    console.log('✓ ' + s + ' — ' + (lastLine || 'ok'));
  }
}

const summary = { suites: suites.length, pass, fail, failures };
console.log('\n' + JSON.stringify(summary, null, 2));
console.log(fail ? '\nBATTERY BROKEN: ' + fail + ' failing suite(s)' : '\nBATTERY GREEN: all ' + pass + ' suites passed');
process.exit(fail ? 1 : 0);
