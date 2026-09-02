#!/usr/bin/env node
/* scripts/relax-v0640.js — forward-relax پین‌های نسخهٔ 0.63.0-beta در سوئیت‌های
   قدیمی تا بعد از بامپ 0.64.0-beta هم سبز بمانند (قرارداد جلسات قبل).
   الگوی مجاز جدید: هر نسخهٔ 0.63 به بعد (0.63.x تا 0.9x). */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const RX63 = String.raw`0\.(6[3-9]|[7-9]\d)\.\d+(?:-[\w.]+)?`; // برای داخل regex literal
const edits = [
  /* [file, [from, to]] — هر from باید دقیقاً یک‌بار (یا با علم به تعداد) رخ دهد */
  ['scripts-test-v0620a.js', [
    ["ok(pkg.version === '0.63.0-beta', 'package.json → 0.63.0-beta');",
     "ok(new RegExp('^" + RX63 + "$').test(pkg.version), 'package.json → ' + pkg.version); /* v0.64 forward-relax */"],
    ["ok(/let appVersion = ['\"]0\\.63\\.0-beta['\"]/.test(appSrc), 'app.js appVersion → 0.63.0-beta');",
     "ok(new RegExp(\"let appVersion = ['\\\"]" + RX63 + "['\\\"]\").test(appSrc), 'app.js appVersion → ' + (appSrc.match(/let appVersion = ['\"][^'\"]+/) || [''])[0]); /* v0.64 forward-relax */"],
    ["ok(/id=\"abVersion\">v0\\.63\\.0-beta</.test(idxSrc), 'index.html abVersion → v0.63.0-beta');",
     "ok(new RegExp('id=\"abVersion\">v" + RX63 + "<').test(idxSrc), 'index.html abVersion → v0.64 line'); /* v0.64 forward-relax */"],
  ]],
  ['scripts-test-v0600b.js', [
    ["ok(appSrc.includes(\"let appVersion = '0.63.0-beta';\"), 'نسخه: bump والد به v0.63.0-beta اعمال شد');",
     "ok(new RegExp(\"let appVersion = '\" + RX63 + \"';\").test(appSrc), 'نسخه: bump والد اعمال شد → ' + (appSrc.match(/let appVersion = '[^']+/) || [''])[0]); /* v0.64 forward-relax */"],
  ]],
  ['scripts-test-v0570.js', [
    ["ok(appSrc.includes(\"let appVersion = '0.63.0-beta';\"), 'app.js: 0.63.0-beta');",
     "ok(new RegExp(\"let appVersion = '\" + RX63 + \"';\").test(appSrc), 'app.js: ' + (appSrc.match(/let appVersion = '[^']+/) || [''])[0]); /* v0.64 forward-relax */"],
    ["ok(pkg.version === '0.63.0-beta', 'package.json: 0.63.0-beta');",
     "ok(new RegExp('^" + RX63 + "$').test(pkg.version), 'package.json: ' + pkg.version); /* v0.64 forward-relax */"],
    ["ok(htmlSrc.includes('<span id=\"abVersion\">v0.63.0-beta</span>'), 'index.html: v0.63.0-beta');",
     "ok(new RegExp('<span id=\"abVersion\">v" + RX63 + "</span>').test(htmlSrc), 'index.html: ' + ((htmlSrc.match(/abVersion\">([^<]+)/) || [])[1] || '?')); /* v0.64 forward-relax */"],
  ]],
  ['scripts-test-v0530.js', [
    ["ok(pkg.version === '0.63.0-beta', 'package.json → 0.63.0-beta');",
     "ok(new RegExp('^" + RX63 + "$').test(pkg.version), 'package.json → ' + pkg.version); /* v0.64 forward-relax */"],
    ["ok(htmlSrc.includes('<span id=\"abVersion\">v0.63.0-beta</span>'), 'index.html abVersion');",
     "ok(new RegExp('<span id=\"abVersion\">v" + RX63 + "</span>').test(htmlSrc), 'index.html abVersion'); /* v0.64 forward-relax */"],
    ["ok(appSrc.includes(\"let appVersion = '0.63.0-beta';\"), 'app.js appVersion');",
     "ok(new RegExp(\"let appVersion = '\" + RX63 + \"';\").test(appSrc), 'app.js appVersion'); /* v0.64 forward-relax */"],
  ]],
  ['scripts-test-v0540.js', [
    ["ok(appSrc.includes(\"let appVersion = '0.63.0-beta';\"), 'app.js: 0.63.0-beta');",
     "ok(new RegExp(\"let appVersion = '\" + RX63 + \"';\").test(appSrc), 'app.js: ' + (appSrc.match(/let appVersion = '[^']+/) || [''])[0]); /* v0.64 forward-relax */"],
    ["ok(pkg.version === '0.63.0-beta', 'package.json: 0.63.0-beta');",
     "ok(new RegExp('^" + RX63 + "$').test(pkg.version), 'package.json: ' + pkg.version); /* v0.64 forward-relax */"],
    ["ok(htmlSrc.includes('<span id=\"abVersion\">v0.63.0-beta</span>'), 'index.html: v0.63.0-beta');",
     "ok(new RegExp('<span id=\"abVersion\">v" + RX63 + "</span>').test(htmlSrc), 'index.html: ' + ((htmlSrc.match(/abVersion\">([^<]+)/) || [])[1] || '?')); /* v0.64 forward-relax */"],
  ]],
  ['scripts-test-v0510.js', [
    ["ok(pkg.version === '0.63.0-beta', 'package.json → 0.63.0-beta');",
     "ok(new RegExp('^" + RX63 + "$').test(pkg.version), 'package.json → ' + pkg.version); /* v0.64 forward-relax */"],
  ]],
  ['scripts-test-v0520.js', [
    ["ok(pkg.version === '0.63.0-beta', 'package.json → 0.63.0-beta');",
     "ok(new RegExp('^" + RX63 + "$').test(pkg.version), 'package.json → ' + pkg.version); /* v0.64 forward-relax */"],
    ["ok(htmlSrc.includes('<span id=\"abVersion\">v0.63.0-beta</span>'), 'index.html abVersion');",
     "ok(new RegExp('<span id=\"abVersion\">v" + RX63 + "</span>').test(htmlSrc), 'index.html abVersion'); /* v0.64 forward-relax */"],
    ["ok(appSrc.includes(\"let appVersion = '0.63.0-beta';\"), 'app.js appVersion');",
     "ok(new RegExp(\"let appVersion = '\" + RX63 + \"';\").test(appSrc), 'app.js appVersion'); /* v0.64 forward-relax */"],
  ]],
  ['scripts-test-v0480.js', [
    ["ok(pkg.version === '0.63.0-beta', 'package.json 0.63.0-beta');",
     "ok(new RegExp('^" + RX63 + "$').test(pkg.version), 'package.json ' + pkg.version); /* v0.64 forward-relax */"],
    ["ok(htmlSrc.includes('<span id=\"abVersion\">v0.63.0-beta</span>'), 'index.html abVersion');",
     "ok(new RegExp('<span id=\"abVersion\">v" + RX63 + "</span>').test(htmlSrc), 'index.html abVersion'); /* v0.64 forward-relax */"],
    ["ok(appSrc.includes(\"let appVersion = '0.63.0-beta';\"), 'app.js appVersion');",
     "ok(new RegExp(\"let appVersion = '\" + RX63 + \"';\").test(appSrc), 'app.js appVersion'); /* v0.64 forward-relax */"],
  ]],
  ['scripts-test-v0630.js', [
    ["ok(pkg.version === '0.63.0-beta', 'package.json → ' + pkg.version);",
     "ok(new RegExp('^" + RX63 + "$').test(pkg.version), 'package.json → ' + pkg.version); /* v0.64 forward-relax */"],
    ["ok(/appVersion\\s*=\\s*'0\\.63\\.0-beta'/.test(appSrc), 'app.js appVersion');",
     "ok(new RegExp(\"appVersion\\\\s*=\\\\s*'\" + RX63 + \"'\").test(appSrc), 'app.js appVersion'); /* v0.64 forward-relax */"],
    ["ok(/abVersion[^0-9]*0\\.63\\.0-beta/.test(idxSrc), 'index.html abVersion');",
     "ok(new RegExp('abVersion[^0-9]*" + RX63 + "').test(idxSrc), 'index.html abVersion'); /* v0.64 forward-relax */"],
  ]],
];

let touched = 0, missed = [];
for (const [file, pairs] of edits) {
  const fp = path.join(root, file);
  if (!fs.existsSync(fp)) { missed.push(file + ' (missing)'); continue; }
  let src = fs.readFileSync(fp, 'utf8');
  let changed = false;
  for (const [from, to] of pairs) {
    if (src.includes(from)) { src = src.split(from).join(to); changed = true; }
    else if (!src.includes(to)) missed.push(file + ' :: ' + from.slice(0, 60));
  }
  if (changed) { fs.writeFileSync(fp, src, 'utf8'); touched++; }
}
console.log('relaxed files: ' + touched);
if (missed.length) { console.log('MISSED:\n' + missed.join('\n')); process.exit(1); }
console.log('RELAX_OK');
