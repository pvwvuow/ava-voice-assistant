/* ============================================================
   scripts-test-v0510.js — v0.51.0-beta
   «فیکس ریشه‌ای + PTT + دیکتهٔ یک‌باره + پلیر v2 + فاز تحقیق»
   ------------------------------------------------------------
   ریشه‌ها (لاگ واقعی کاربر، جلسهٔ v0.50.0-beta، boot=bmtirt8czzv6v):
   • ۱۴:۳۸:۰۸ «مطمئنی اسم آهنگ جدید شاد نازنین» → rule:open_music ۱۱۳ms
     (سؤالِ اطمینان — گیت قدیم «مطمئنی» را نمی‌شناخت)
   • ۱۴:۳۹:۳۴ «ببین اسم آهنگ جدید شادمهر نازنین نیست» → rule:open_music ۱۰۵ms
     (تصحیح با «نیست» — کلاس نفی نداشتیم)
   • ۱۴:۴۷:۱۶ «جدیدترین آهنگ شادمهر در ۲۰۲۶» → rule:open_music ۹۸ms
     (عبارت اسمیِ بی‌فعل — noun-phrase فقط ≤۳ توکن را می‌گرفت)
   • ۱۴:۳۷–۱۴:۳۹: AI اسم «نازنین» را از حافظه‌اش ساخت و دوبار یاد گرفت
     (درخواستِ «اول بفهم بعد سرچ کن» بدون ابزار تحقیق)
   • اسکرین‌شات کاربر: پنجرهٔ شناور «Video player configuration error /
     Error 153» — iframe + enablejsapi بدون origin
   • خواسته‌های جدید: دکمهٔ Push-to-Talk (قابل‌تنظیم، ترکیبی، رهاکن=پایان)،
     دیکتهٔ یک‌باره با هر تعبیری، پخش در لانچرِ خودِ آوا
   ============================================================ */
const path = require('path');
const fs = require('fs');
const AVAIntent = require(path.join(__dirname, 'renderer/js/voiceIntent.js'));
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } }

/* جدول قوانین حداقلی — همان idها/kهای واقعی app.js (بعد از v0.51) */
const RULES = [
  { k: /موسیقی|آهنگ|موزیک|play music/i, id: 'open_music' },
  { k: /(?=.*(یوتیوب|youtube))(?=.*(پلی\s?کن|پخش\s?کن|پخشش\s?کن|پلاش\s?کن|بذار\s?(پخش|بزن)))/i, id: 'yt_play' },
  { k: /(?=.*(یوتیوب|youtube))(?=.*(جستجو|سرچ|سیرچ|بگرد|پخش|پلی\s?کن|بزن|بذار|آهنگ|ترانه|ویدیو|فیلم|search|find))/i, id: 'yt_search' },
  { k: /یوتیوب|youtube/i, id: 'open_youtube' },
  { k: /جستجو|سرچ|سیرچ|گوگل/i, id: 'web_search' },
  { k: new RegExp('(?:پخش|بزن|پلی|شروع|بذار|بزار|بیار|بگیر|play)[^.]{0,10}(?:آهنگ|ترانه|موزیک|موسیقی)|(?:آهنگ|ترانه|موزیک|موسیقی)[^.]{0,14}(پخش|بزن|پلی|شروع|بذار|بزار|بیار|بگیر|play)', 'i'), id: 'music_play' },
  { k: /سایت|وب\s?سایت/i, id: 'site_search' },
];

(function () {
  console.log('\n[۱] گیت v3 — سه نشت واقعی لاگ v0.50 دیگر اکشن کور اجرا نمی‌کنند');
  ok(AVAIntent.gateReason('مطمئنی اسم آهنگ جدید شاد نازنین', 'open_music') === 'certainty',
    '«مطمئنی اسم آهنگ …» → certainty (لاگ ۱۴:۳۸: قبلاً open_music می‌شد!)');
  ok(AVAIntent.gateReason('ببین اسم آهنگ جدید شادمهر نازنین نیست', 'open_music') === 'negation',
    '«…نازنین نیست» → negation (لاگ ۱۴:۳۹: قبلاً open_music می‌شد!)');
  ok(AVAIntent.gateReason('جدیدترین آهنگ شادمهر در ۲۰۲۶', 'open_music') === 'no-verb',
    '«جدیدترین آهنگ شادمهر در ۲۰۲۶» → no-verb (لاگ ۱۴:۴۷) — وارونگی بار اثبات');
  ok(AVAIntent.blocksActionRule('مطمئنی اسم آهنگ جدید شاد نازنین', 'open_music') === true,
    'blocksActionRule سازگار بولین می‌ماند (true)');
  ok(AVAIntent.blocksActionRule('توی یوتیوب آهنگ شادمهر پخش کن', 'yt_play') === false,
    'جملهٔ سالمِ فعل‌دار همچنان مسیر سریع (false)');

  console.log('\n[۲] گیت v3 — نگهبان‌های FP: مسیرهای سریع درست قربانی نمی‌شوند');
  const fp = [
    ['تو یوتیوب برام سرچ کن شادمهر', 'yt_search'],
    ['آهنگ جدید شادمهر تو یوتیوب برام پلی کن', 'yt_play'],
    ['یوتیوب باز کن', 'open_youtube'],
    ['موزیک بعدی', 'music_next'],
    ['تو دیوار دنبال موتور بگرد', 'site_search'],
    ['آهنگ شادمهر بذار', 'music_play'],
    ['سرچش کن تو یوتیوب شادمهر رو', 'yt_search'],
    ['گوگل کروم رو برام باز کن', 'open_chrome'],
    ['با وی‌ال‌سی آهنگ شادمهر رو پخش کن', 'player_open'],
    ['play shape of you on youtube', 'yt_play'],
    /* v0.61: نیت‌های pip/pip_youtube حذف شدند → کنترل پلیر */
    ['ویدیو رو فول اسکرین کن', 'player_ctl'],
    ['پلیر رو پاز کن', 'player_ctl'],
  ];
  for (const [c, id] of fp) {
    ok(AVAIntent.gateReason(c, id) === '', 'FP-guard: «' + c.slice(0, 42) + '» → fast (' + id + ')');
  }
  ok(AVAIntent.gateReason('اسم آهنگ جدید شادمهر چیه', 'open_music') === 'question', 'سؤال همچنان question');
  ok(AVAIntent.gateType('یوتیوب رو ببند') === '', '«یوتیوب رو ببند» بدون گیت (سازگاری v0500)');
  ok(AVAIntent.gateReason('what is the newest shadmehr song', 'open_music') === 'no-verb',
    'انگلیسیِ بی‌فعل هم no-verb → AI (معماری زبان‌مستقل)');

  console.log('\n[۳] داوری — «آهنگ X بذار» به music_play می‌رسد نه صفحهٔ YT Music');
  const arbit = AVAIntent.arbitrate('آهنگ شادمهر بذار', RULES);
  ok(!!arbit && arbit.rule.id === 'music_play', '«آهنگ شادمهر بذار» → music_play (قبلاً open_music صفحهٔ اصلی می‌شد)');
  ok(!!arbit && arbit.decisive, '…و قاطع است (فاصلهٔ امتیاز روشن)');

  console.log('\n[۴] دیکتهٔ یک‌باره — typeOnceOf روی تعبیرهای واقعی');
  ok(AVAIntent.typeOnceOf('اینجا بنویس سلام خوبی') === 'سلام خوبی', '«اینجا بنویس سلام خوبی»');
  ok(AVAIntent.typeOnceOf('آوا اینجا بنویس "من فلانم"') === 'من فلانم', 'گیومه‌دار — فقط داخل گیومه');
  ok(AVAIntent.typeOnceOf('ببین بنویس من فردا میام') === 'من فردا میام', '«ببین بنویس …» — تعبیر آزاد');
  ok(AVAIntent.typeOnceOf('اینو تایپ کن قرار ساعت ۵') === 'قرار ساعت ۵', '«اینو تایپ کن …»');
  ok(AVAIntent.typeOnceOf('برام بنویس که جلسه داریم') === 'جلسه داریم', '«برام بنویس که …»');
  ok(AVAIntent.typeOnceOf('اینجا بنویس: قرار ساعت ۵') === 'قرار ساعت ۵', 'بعد از کولون');
  ok(AVAIntent.typeOnceOf('اینجا برام تایپ کن') === '', 'بدون محتوا → حالت مودار (رفتار قبلی)');
  ok(AVAIntent.typeOnceOf('اسم آهنگ جدید رو بنویس') === '', 'فعل در انتها و بی‌محتوا → AI');
  ok(AVAIntent.typeOnceOf('بنویس تو گوگل سرچ کن شادمهر') === '', 'مقصد وب — دیکته نیست');
  ok(AVAIntent.typeOnceOf('type this hello world') === 'hello world', 'انگلیسی');

  console.log('\n[۵] PTT — نگاشت VK + سیم‌کشی hold/release');
  /* بازسازی هم‌ارز pttComboVks در main.js — برای ماندگاری رگرسیون */
  const KEYMAP = { control: 0x11, ctrl: 0x11, alt: 0x12, shift: 0x10, space: 0x20, enter: 0x0D };
  function pttComboVks(combo) {
    const out = [];
    for (const raw of String(combo || '').split('+')) {
      const k = raw.trim().toLowerCase();
      if (!k) continue;
      if (k === 'commandorcontrol') { out.push(0x11); continue; }
      const fm = k.match(/^f(\d{1,2})$/);
      if (fm) { const n = parseInt(fm[1], 10); if (n >= 1 && n <= 24) { out.push(0x70 + n - 1); continue; } }
      if (KEYMAP[k]) { out.push(KEYMAP[k]); continue; }
      if (k.length === 1) { out.push(k.toUpperCase().charCodeAt(0)); continue; }
    }
    return [...new Set(out)];
  }
  ok(JSON.stringify(pttComboVks('CommandOrControl+Shift+Space')) === JSON.stringify([0x11, 0x10, 0x20]), 'VK(Ctrl+Shift+Space) = 11,10,20');
  ok(JSON.stringify(pttComboVks('F9')) === JSON.stringify([0x78]), 'VK(F9) = 0x78');
  ok(JSON.stringify(pttComboVks('CommandOrControl+Alt+A')) === JSON.stringify([0x11, 0x12, 0x41]), 'VK(Ctrl+Alt+A) = 11,12,41');
  const mainSrc = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
  ok(mainSrc.includes("'ava:ptt-down'") && mainSrc.includes("'ava:ptt-up'"), 'main.js: کانال‌های ptt-down/ptt-up');
  ok(!/okPtt = globalShortcut\.register\('CommandOrControl\+Shift\+Space'[\s\S]{0,80}win\.show\(\)/.test(mainSrc),
    'PTT دیگر پنجره را جلو نمی‌کشد (win.show حذف شد — بدون فوکوس‌دزدی)');
  ok(mainSrc.includes('GetAsyncKeyState'), 'hold-watcher: GetAsyncKeyState (بدون ماژول نیتیو)');
  ok(mainSrc.includes('pttRegister(win)') && mainSrc.includes("ipcMain.handle('ptt:reconfig'"), 'ثبت پویا + IPC reconfig');
  const preSrc = fs.readFileSync(path.join(__dirname, 'preload.js'), 'utf8');
  ok(preSrc.includes('onPttDown') && preSrc.includes("'ptt:reconfig'"), 'preload: پل ptt');
  const appSrc = fs.readFileSync(path.join(__dirname, 'renderer/js/app.js'), 'utf8');
  ok(appSrc.includes('function pttStart') && appSrc.includes("aveDeliver(txt, 'ptt-flush'"), 'رندرر: pttStart + flush (تحویل، نه لغو)');

  console.log('\n[۶] پلیر سیستم — v0.61: پلیر خود آوا حذف شد؛ پخش با پلیر پیش‌فرض کاربر');
  ok(!fs.existsSync(path.join(__dirname, 'renderer/pip.html')) && !fs.existsSync(path.join(__dirname, 'pipWindowManager.js')) && !fs.existsSync(path.join(__dirname, 'renderer/js/pipRenderer.js')), 'فایل‌های پلیر خودساختهٔ آوا حذف شدند (v0.61)');
  ok(!mainSrc.includes('pipManager') && !mainSrc.includes('pip_youtube'), 'main.js: بدون pipManager/pip_youtube');
  ok(mainSrc.includes('openWithDefaultPlayer') && mainSrc.includes("ipcMain.handle('player:default'"), 'main.js: youtube_play → پلیر پیش‌فرض کاربر + player:default');
  ok(mainSrc.includes("'autoplay-policy', 'no-user-gesture-required'"), 'autoplay با صدا بدون کلیک');

  console.log('\n[۷] فاز تحقیق — پادزهر توهم «نازنین»');
  ok(/'set_wake_word', 'research', 'type_once'/.test(appSrc), 'DO_ACTS + research + type_once (v0.61: +video_play/video_ctl در انتها)');
  ok(mainSrc.includes('aiWebResearch') && mainSrc.includes('duckduckgo.com/html') && mainSrc.includes('format=rss'), 'تحقیق وب: DDG + فالبک Bing RSS');
  ok(mainSrc.includes("'ai:research'") && preSrc.includes('research:'), 'IPC ai:research + پل preload');
  ok(appSrc.includes('[نتایج واقعی وب') && appSrc.includes('learn skip'), 'دور دوم AI + عدم یادگیریِ برنامهٔ تحقیقی');
  ok(appSrc.includes('قانون مهم ۸') && appSrc.includes('act=research'), 'قانون مهم ۸ (fa): هرگز اسم از حافظه نساز');
  ok(appSrc.includes('Important rule 7 (critical, anti-hallucination)'), 'Rule 7 (en): research phase');

  console.log('\n[۸] دیکتهٔ یک‌باره — سیم‌کشی کامل');
  ok(appSrc.includes("id: 'type_once'"), 'قانون type_once در RULES');
  ok(appSrc.includes("_dispatchOutcome = 'type-once'"), 'مسیر «اینجا بنویس …» → یک‌باره (نه فقط حالت مودار)');
  ok(appSrc.includes("case 'type_once'"), 'مجری DO: case type_once');
  ok(appSrc.includes('قانون مهم ۹') && appSrc.includes('act=type_once'), 'قانون مهم ۹ (fa): نوشتن با هر تعبیر');
  ok(appSrc.includes('Important rule 8'), 'Rule 8 (en): type_once');

  console.log('\n[۹] نویز-دایت ۲');
  ok(appSrc.includes('L.stats.noisy') && appSrc.includes('(.)\\1{2,}'), 'کش‌قاف حرفی و تکرارِ تک‌مفهوم → فقط آمار');

  console.log('\n[۱۰] نسخه');
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  ok(pkg.version === '0.63.0-beta', 'package.json → 0.63.0-beta');
  ok(pkg.description.includes('۰.۶۳') && pkg.description.includes('پلیر'), 'description → ۰.۶۲');

  console.log('\n==========================================');
  console.log('scripts-test-v0510: ' + pass + ' passed, ' + fail + ' failed');
  if (fail) process.exit(1);
})();
