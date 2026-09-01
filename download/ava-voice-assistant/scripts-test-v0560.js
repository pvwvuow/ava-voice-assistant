#!/usr/bin/env node
'use strict';
/* ============================================================
   scripts-test-v0560.js — doctest v0.56.0 — بازطراحی بزرگ رابط
   [1] استیج یکپارچهٔ چت (لایه روی hero + میک بالا-وسط + انتقال زندهٔ نودها)
   [2] ویجت شناور v2 (حلقهٔ SVG + منوی کنترل کامل + ترجیحات + همگامی ترِی)
   [3] کارت‌های مینیمال (بدون emoji + دکمهٔ گرد ارسال + هایلایت سه ردهٔ اول)
   [4] فیکس ریشه‌ای اکولایزر (ResizeObserver روی بوم)
   [5] نسخه 0.56.0-beta همه‌جا
   ============================================================ */
const fs = require('fs'), path = require('path');
const ROOT = __dirname;
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } }
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const idx = rd('renderer/index.html');
const app = rd('renderer/js/app.js');
const css = rd('renderer/css/styles.css');
const wm = rd('widgetManager.js');
const wr = rd('renderer/js/widgetRenderer.js');
const wp = rd('renderer/widgetPreload.js');
const mn = rd('main.js');

console.log('\n[1] استیج یکپارچهٔ چت روی hero');
ok(idx.includes('id="chatLayer"') && idx.includes('id="clStreamHost"') && idx.includes('id="clBarHost"'), 'لایهٔ چت داخل hero (chatLayer/stream/bar host)');
ok(idx.includes('id="clMic"') && idx.includes('clm-ring'), 'دکمهٔ میک انیمیشنی بالا-وسط با حلقه‌های پالس');
ok(idx.includes('id="clGlm"') && idx.includes('id="clClose"'), 'دسترسی چت GLM + بستن لایه');
ok(app.includes('function openChatLayer()') && app.includes('function closeChatLayer()'), 'openChatLayer/closeChatLayer تعریف شده');
ok(app.includes('clStreamHost.appendChild(chatMsgs)') && app.includes('clBarHost.appendChild(chatBar)'), 'انتقال زندهٔ نودهای چت — listenerها حفظ');
ok(app.includes('var chatLayerOpen = false;'), 'پرچم بدون TDZ برای showView زودهنگام');
ok(!/chatAutoOpen[^;]*showView\('chat'\)/.test(app) && app.includes("chatAutoOpen && document.visibilityState === 'visible') openChatLayer();"), 'چت خودکار صوتی → لایه (نه صفحهٔ جدا)');
ok(app.includes("tabQuick.addEventListener('click', () => { showView('home'); openChatLayer(); });"), 'تب «چت سریع» → لایهٔ روی hero');
ok(css.includes('.chat-layer.open') && css.includes('@keyframes clMsgIn'), 'انیمیشن ورود لایه + stagger حباب‌ها');
ok(css.includes('body.state-listening .cl-mic') && css.includes('@keyframes clPulse'), 'میک: تنفس idle + پالس سبز گوش دادن (از state-* بدنه)');
ok(css.includes('.hero.chat-open .orb-stage') && css.includes('backdrop-filter: blur(26px)'), 'جمع‌شدن اورب + backdrop-blur لایه');

console.log('\n[2] ویجت شناور v2 — طراحی + کنترل کامل');
ok(idx.includes('i-close'), 'آیکون close موجود برای لایه (رفرنس svg سالم)');
ok(wr.includes("body.classList.add(['listening', 'processing', 'speaking', 'idle'].includes(st)"), 'ماشین حالت ویجت حفظ شده');
ok(wr.includes('function applyLook') && wr.includes("onLook"), 'اعمال ترجیحات (اندازه/شفافیت/قفل/متن) در renderer');
ok(wr.includes("addEventListener('contextmenu'") && wr.includes('AVAWidget.menu()'), 'راست‌کلیک ویجت → منو');
ok(wr.includes("closest('button[data-act]')") && wr.includes("AVAWidget.act(act)"), 'نوار ابزار hover → act امن');
ok(wp.includes('onLook') && wp.includes('menu: () => ipcRenderer.send') && wp.includes("act: (name) => ipcRenderer.send"), 'preload ویجت: سه پل امن جدید');
ok(wm.includes('SIZES = { s:') && wm.includes('applyLook()'), 'مدیر ویجت: سه اندازه + اعمال زنده');
ok(wm.includes("label: 'اندازه'") && wm.includes("label: 'شفافیت'") && wm.includes("label: 'قفل جای ویجت'") && wm.includes("label: 'نمایش متن گفتگوها'") && wm.includes("label: 'بازنشانی مکان ویجت'") && wm.includes("label: 'خاموش کردن ویجت شناور'"), 'منوی ویجت: اندازه/شفافیت/قفل/متن/بازنشانی/خاموش');
ok(wm.includes("'widget:menu'") && wm.includes("'widget:act'") && wm.includes("'widget:set'"), 'IPCهای کنترلی ویجت');
ok(wm.includes('writeStateFile()') && wm.includes("statePath + '.tmp'") && wm.includes('renameSync(tmp, statePath)'), 'ذخیرهٔ اتمیک ترجیحات (v2 state)');
ok(wm.includes('onConfigured') && mn.includes('onConfig: () => { try { if (trayRebuild) trayRebuild(); }'), 'همگامی منوی ترِی با تغییر ویجت (فیکس چک‌باکس کهنه)');
ok(mn.includes('let trayRebuild = null;') && mn.includes('trayRebuild = rebuild;'), 'هوک rebuild ترِی');
const pl = rd('preload.js');
ok(wm.includes("'ava:open-chat'") && pl.includes('ava:open-chat'), 'کانال باز کردن چت از ویجت → renderer (فرستندهٔ main-side + شنوندهٔ preload)');

console.log('\n[3] کارت‌های مینیمال');
ok(!app.includes('🌤️'), 'emoji آب‌وهوا حذف شد');
ok(app.includes("if (Number(x.pos) <= 3) tr.classList.add('top');"), 'جدول: هایلایت سه ردهٔ اول');
ok(app.includes('class="rc-send"') && css.includes('.rich-card .rc-send {'), 'کادر ورودی: دکمهٔ گرد ارسال');
ok(css.includes('@keyframes rcBar') && css.includes('tr.top td.pos'), 'انیمیشن میله‌ها + استایل ردهٔ برتر');

console.log('\n[4] فیکس ریشه‌ای اکولایزر');
ok(app.includes('_waveRO = new ResizeObserver') && app.includes('_waveRO.observe(wave);'), 'ResizeObserver روی بوم — فریم معتبر در هر نمایانی/تغییر اندازه');
ok(app.includes("window.addEventListener('resize', resizeWave);"), 'گوشگر resize پنجره حفظ شده');
ok(app.includes('micAlive = analyser && micData && micLive && audioCtx && audioCtx.state'), 'گارد کانتکست زندهٔ v0.55 حفظ شده');

console.log('\n[5] نسخه 0.56.0-beta');
ok(JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version === '0.56.0-beta', 'package.json 0.56.0-beta');
ok(app.includes("let appVersion = '0.56.0-beta';"), 'app.js appVersion');
ok(idx.includes('<span id="abVersion">v0.56.0-beta</span>'), 'index.html abVersion');
const readme = rd('README.md');
ok(readme.includes('۰.۵۶.۰-بتا') && readme.includes('ویجت شناور + ترِی'), 'README بلاک ۰.۵۶ + سازگاری سوئیت‌های قدیمی');

console.log('\n===== scripts-test-v0560.js: ' + pass + '/' + (pass + fail) + ' =====');
process.exit(fail ? 1 : 0);
