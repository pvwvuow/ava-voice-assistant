#!/usr/bin/env node
/* v0.81.0-beta — فیکس «لینک در جا پخش نمی‌شود» + لاینِ قطعیِ کلیپ‌بورد
   گزارش کاربر (نسخهٔ 0.80): «ویدیو خوب درست پلی نمی‌شه توی پات پلیر پخش نمی کنه
   ولی تو نسخه ۷۹ راحت پخش می کرد لینکو که می ذاشتید در جا پخش می کرد می خوام
   وقتی کاربر لینکو فقط توی کلیپ بردش گذاشته خودش تشخیص بده و همونو»
   فیکس‌ها:
   ۱) videoPlayReply: URL صریح → kind='url' (دیگر به‌عنوان عبارتِ سرچ به
      ytResolve داده نمی‌شود — اولین نتیجهٔ صفحهٔ نتایج = ویدیوی اشتباه/هیچ)
   ۲) لاین clipboard-play: «پخش کن» لخت یا ارجاعی («لینکو/اینو پخش کن») با
      لینکِ ویدیو در کلیپ‌بورد → همان لینک، همان پلیر، پایپ‌لاین قطعی
   ۳) player_open: پسماند ارجاعی («لینک/اینو/همین») عنوانِ سرچ نیست → کلیپ‌بورد */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) { if (cond) { pass++; } else { fail++; fails.push(msg); console.log('  ✗ ' + msg); } }
function section(t) { console.log('— ' + t); }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

const VI = require('./renderer/js/voiceIntent.js');
const appSrc = read('renderer/js/app.js');
const mainSrc = read('main.js');

console.log('==== v0.81.0-beta: پخشِ مطمئنِ لینک + لاینِ کلیپ‌بورد ====');

/* ---------- ۱) اعتبارسنجی URL برای کلیپ‌بورد (videoUrlOf) ---------- */
section('videoUrlOf — اعتبارسنجی لینک کلیپ‌بورد');
ok(VI.videoUrlOf('پخش کن https://youtu.be/AbC12345678') === 'https://youtu.be/AbC12345678', 'لینک کوتاه یوتیوب قبول');
ok(VI.videoUrlOf('پخش کن https://www.youtube.com/watch?v=ob3pgk1PDTs') === 'https://www.youtube.com/watch?v=ob3pgk1PDTs', 'لینک watch قبول');
ok(VI.videoUrlOf('پخش کن https://cdn.example.com/video.mp4') === 'https://cdn.example.com/video.mp4', 'فایل مستقیم mp4 با فعلِ پخش قبول');
ok(VI.videoUrlOf('https://www.youtube.com/shorts/AbC12345678') !== '', 'لینک shorts قبول');
ok(VI.videoUrlOf('https://google.com') === '', 'لینک غیرویدیویی بدون فعل رد');
ok(VI.videoUrlOf('پخش کن https://google.com') !== '', 'videoUrlOf با فعلِ پخش URL برمی‌گرداند (طراحی v0.66 — سخت‌گیری با strictVideoUrlOf)');
ok(VI.strictVideoUrlOf('https://google.com') === '' && VI.strictVideoUrlOf('پخش کن https://google.com') === '', 'strictVideoUrlOf: گوگل/سایت هرگز قبول نمی‌شود (کلیپ‌بورد)');
ok(VI.strictVideoUrlOf('https://youtu.be/AbC12345678') === 'https://youtu.be/AbC12345678', 'strictVideoUrlOf: یوتیوب قبول');
ok(VI.strictVideoUrlOf('https://x.com/v/clip.mp4?tok=1') === 'https://x.com/v/clip.mp4?tok=1', 'strictVideoUrlOf: فایل ویدیویی مستقیم قبول');
/* حفظ حساسیت حروفِ شناسه (پین v0.76) */
ok(VI.videoUrlOf('پخش کن https://youtu.be/ulF0Tkqr7Q4') === 'https://youtu.be/ulF0Tkqr7Q4', 'شناسه case-sensitive حفظ (پین v0.76)');

/* ---------- ۲) videoPlayReply — kind هوشمند ---------- */
section('videoPlayReply — URL → kind:url (فیکس رگرسیون)');
ok(appSrc.includes("? 'url' : 'query'") && appSrc.includes("kind: /^https?:"), 'videoPlayReply: URL صریح → kind:url (نه query)');
ok(appSrc.includes("kind: 'query', src: vq") === false, 'kind:query کورکورانه حذف شد');
ok(/v0\.81 — فیکس رگرسیون/.test(appSrc), 'یادداشت ریشه در سورس ثبت شد');
ok(/ipcMain\.handle\('player:open'/.test(mainSrc) && /ytNormalizeUrl\(src\)/.test(mainSrc), 'main: مسیر kind:url با ytNormalizeUrl (شناسهٔ دقیق، بدون سرچ)');

/* ---------- ۳) لاینِ clipboard-play ---------- */
section('لاین clipboard-play — ترتیب و گاردها');
const ixUrl = appSrc.indexOf('video-url (deterministic)');
const ixClip = appSrc.indexOf("_dispatchOutcome = 'clipboard-play'");
const ixCancel = appSrc.indexOf('فرمانِ صوتیِ لغو');
ok(ixClip > ixUrl, 'لاین کلیپ‌بورد بعد از لاین URL');
ok(ixClip > 0 && ixCancel > ixClip, 'لاین کلیپ‌بورد قبل از لاین لغو (اولویت مچ)');
ok(/_pbVerb = \/\(پخشش\?\\s\?کن\|پلی/.test(appSrc), 'گارد فعلِ پخش');
ok(/_pbNoUrl = !\/https\?:\\\/\\\/\/i\.test\(raw\)/.test(appSrc), 'گارد «لینک در متن نیست»');
ok(/_pbRef = \/\(لینکو\?\|کلیپ\\s\?بورد/.test(appSrc), 'گارد ارجاعِ لینک (لینکو/اینو/همین)');
ok(/_pbBare = \/\^\(آوا\[\\s،,:-\]\*\)\?\(پخشش\?\\s\?کن/.test(appSrc), 'گارد «پخش کن» لخت (سرِ جمله)');
ok(/videoUrlOf\('پخش کن ' \+ _mt\[0\]\)/.test(appSrc), 'اعتبارسنجی URL کلیپ‌بورد با videoUrlOf');
ok(/player: _pbPlayer \|\| 'default', kind: 'url', src: _cbUrl/.test(appSrc), 'پخش با kind:url + پلیرِ خواسته‌شده از جمله («توی پات پلیر»)');
ok(/لینک رو از کلیپ‌بورد برداشتم و پخش کردم/.test(appSrc), 'پاسخ فارسیِ شفافِ تشخیص کلیپ‌بورد');
ok(/لینک تو کلیپ‌بورد بود ولی پخش نشد: /.test(appSrc), 'پاسخ صادقانه در شکست');
ok(/via: 'clipboard-play'/.test(appSrc), 'تله‌متری recordTurn');
ok(/lastVideoUrl = _cbUrl;/.test(appSrc), 'حافظهٔ lastVideoUrl پر می‌شود (پین v0.66 حفظ)');
ok(appSrc.indexOf('«آهنگ فلان رو پخش کن»') >= 0 || /عنوانِ صریح[^«]*کلیپ‌بورد را/.test(appSrc), 'یادداشت گاردِ عنوانِ صریح');

/* ---------- ۴) player_open — پسماند ارجاعی → کلیپ‌بورد ---------- */
section('player_open — پسماند «لینک/اینو» عنوانِ سرچ نیست');
const ixPo = appSrc.indexOf("id: 'player_open'");
const ixGuard = appSrc.indexOf('link-ref leftover');
const ixKind = appSrc.indexOf("let kind = src ? 'query' : 'url';");
ok(ixPo > 0 && ixGuard > ixPo, 'گارد پسماند داخل player_open');
ok(ixGuard < ixKind, 'گارد قبل از تعیین kind (src خالی → url + کلیپ‌بورد)');
ok(/\/\^\(لینکو\?\|این\\s\?لینک\|همین\\s\?لینک\|اینو\|این\\s\?رو\|همینو\|همین\\s\?رو\|کلیپ\\s\?بورد\)\\b\/i\.test\(src\)/.test(appSrc), 'رجکس پسماند ارجاعی');

/* ---------- ۵) رگرسیون — مسیرهای قبلی حفظ ---------- */
section('رگرسیون — پین‌های پخشِ قبلی');
ok(/lane=video-url \(deterministic\)/.test(appSrc), 'لاین URL حفظ (پین v0660a)');
ok(/const _keep = \/کنارش\|کنارشون\|همزمان\|با\\s\?هم\|کنار\\s\?هم\/i\.test\(c\)/.test(appSrc), 'keepExisting player_open حفظ (پین v0800)');
ok(/const _keepP = \/کنارش\|کنارشون\|همزمان/.test(appSrc), 'keepExisting مسیر مغز حفظ (پین v0800)');
ok(/async function videoPlayReply\(vq, playerWanted, origCmdForLog, keepExisting\)/.test(appSrc), 'امضای videoPlayReply حفظ (پین v0660a رو-به-جلو)');
ok(/id: 'yt_list'/.test(appSrc) && /id: 'yt_pick'/.test(appSrc), 'لاین‌های سرچ لیستی حفظ (پین v0800)');
ok(appSrc.indexOf("id: 'yt_play'") < appSrc.indexOf("id: 'yt_list'"), 'yt_play قبل از yt_list (پخشِ یوتیوبِ صریح اولویت)');

/* ---------- نتیجه ---------- */
console.log('\n———————————————');
console.log('PASS=' + pass + '  FAIL=' + fail);
if (fail) { console.log('\nFAILED:'); for (const f of fails) console.log(' - ' + f); }
process.exit(fail ? 1 : 0);
