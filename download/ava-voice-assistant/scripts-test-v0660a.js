#!/usr/bin/env node
/* scripts-test-v0660a.js — v0.66 — «لَینِ قطعیِ ویدیو: پلیر مقصد + لینکِ دست‌نخورده + حافظه»
   ------------------------------------------------------------
   ریشه‌ها از لاگ واقعی v0.63/v0.65 (activity.jsonl + activity.log):
   [الف] ۷ بار ai DO: video_play(https://www.youtube.com/) — کاربر URL کامل
        داده بود («watch?v=ob3pgk1PDTs» / «RVNoO2q8H-k») ولی جمینای لینک را
        خراب می‌کرد → لَین قطعیِ URL: پیامِ حاوی لینک هرگز به AI نمی‌رود.
   [ب] «با یک ویدیو پلیر دیگم پخش کنه کار نمیکنه» — video_play همیشه
        player:'default' می‌فرستاد → playerTargetOf: «توی/با + X پلیر».
   [پ] «همین ویدیویی که یوتیوب دادم … توی کی ام پلیر» → ctx-resolve با
        موجودیتِ زباله («رو») جمله را به «ویدیو رو یی» خراب می‌کرد →
        فیلتر واژه‌های مجازی + ارجاعِ لینکِ داده‌شده بدون بازنویسی +
        سرنخِ «آخرین لینک ویدیو» (lastVideoUrl).
   [ت] «دستور بستن ویدیو کار نمیکنه» — فعل‌های بستن گسترده شد
        (ببندش/خاموشش کن/قطعش کن/…) + ویدیو/فیلم/کلیپ/پلیر به اسم‌های
        بستن + شمارش صادقانهٔ «بستم (۲ پلیر)».
   [ث] مشاهده‌پذیری پایپ‌لاین پخش در main.js (player:open/ytdl/launch/fallback)
        — قبلاً خروجی پخش در لاگ کاملاً نامرئی بود.
*/
const fs = require('fs');
const path = require('path');
const APP = __dirname;
const mainSrc = fs.readFileSync(path.join(APP, 'main.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(APP, 'renderer/js/app.js'), 'utf8');
const idxSrc = fs.readFileSync(path.join(APP, 'renderer/index.html'), 'utf8');
const cssSrc = fs.readFileSync(path.join(APP, 'renderer/css/styles.css'), 'utf8');
const preloadSrc = fs.readFileSync(path.join(APP, 'preload.js'), 'utf8');

let pass = 0, fail = 0;
const fails = [];
function ok(cond, label) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; fails.push(label); console.log('  ✗ ' + label); }
}
function section(s) { console.log('\n[' + s + ']'); }

/* ---------- [1] voiceIntent زنده — لَین URL + پلیر مقصد ---------- */
section('1] voiceIntent زنده — videoUrlOf/playerTargetOf/videoUrlLane');
const I = require(path.join(APP, 'renderer/js/voiceIntent.js'));
ok(typeof I.videoUrlOf === 'function' && typeof I.playerTargetOf === 'function' && typeof I.videoUrlLane === 'function', 'سه تابع جدید صادر شده‌اند');
/* URL حرف‌به‌حرف — case-sensitive (id یوتیوب حساس به حروف است) */
const u1 = I.videoUrlLane('https://www.youtube.com/watch?v=ob3pgk1PDTs');
ok(u1 && u1.url === 'https://www.youtube.com/watch?v=ob3pgk1PDTs', 'URL لخت → همان URL بدون تغییر حروف');
const u2 = I.videoUrlLane('https://www.youtube.com/watch?v=ob3pgk1PDTs توی کی‌ام پلیر پخشش کن');
ok(u2 && u2.url.indexOf('ob3pgk1PDTs') >= 0 && u2.player === 'kmplayer', 'URL + «توی کی‌ام پلیر» → kmplayer');
const u3 = I.videoUrlLane('https://youtu.be/RVNoO2q8H-k با پات پلیر بذار پخش');
ok(u3 && u3.player === 'potplayer' && /RVNoO2q8H-k/.test(u3.url), 'youtu.be + «با پات پلیر» → potplayer');
ok(I.videoUrlLane('آدرس دیوار رو باز کن https://divar.ir/s/tehran') === null, 'نگاتیو: لینک غیرویدیویی + «باز کن» → لَین URL نیست (open_url می‌ماند)');
ok(I.videoUrlLane('https://example.com/video.mp4 پخش کن') !== null, 'لینک mp4 + فعل پخش → لَین ویدیو');
ok(I.videoUrlLane('سلام چطوری') === null, 'نگاتیو: جملهٔ عادی');
/* پلیر مقصد — اشکال فارسی + نویز STT (لاگ: «کمپ پلیر») */
ok(I.playerTargetOf('توی پات‌پلیر پخشش کن') === 'potplayer', 'پلیر: پات‌پلیر (ZWNJ)');
ok(I.playerTargetOf('کمپ پلیر') === 'kmplayer', 'پلیر: «کمپ پلیر» نویز STT → kmplayer');
ok(I.playerTargetOf('در VLC') === 'vlc', 'پلیر: VLC لاتین');
ok(I.playerTargetOf('ام پی سی بازش کن') === 'mpc', 'پلیر: ام پی سی');
ok(I.playerTargetOf('توی ویدیو پلیر پخشش کن') === '', 'پلیر: «ویدیو پلیر» لخت = پیش‌فرض (نه پلیر خاص)');

/* ---------- [2] voiceCore زنده — موجودیتِ تمیز + ارجاعِ لینک ---------- */
section('2] voiceCore زنده — فیلتر زباله + سرنخِ لینک + بستنِ instant');
const C = require(path.join(APP, 'renderer/js/voiceCore.js'));
C.reset();
/* ریشهٔ لاگ v0.65: «ویدیو رو پخش کن» entities.video=«رو» می‌ساخت */
C.recordTurn({ utterance: 'ویدیو رو پخش کن', via: 'rule', intent: 'player_ctl' });
C.recordTurn({ utterance: 'اولین ویدیو شادمهر رو کپی کن', via: 'rule', intent: 'player_ctl' });
ok(C._state.entities.video !== 'رو', 'موجودیت زباله («رو») دیگر ذخیره نمی‌شود — الان: ' + JSON.stringify(C._state.entities.video));
const p1 = C.prepare('همین ویدیویی که یوتیوب دادم به تو برا من توی کی ام پلیر پخشش کن', { ai: true, videoUrl: 'https://www.youtube.com/watch?v=ob3pgk1PDTs' });
ok(p1.text.indexOf('ویدیو رو یی') < 0 && p1.text.indexOf('(آخرین لینک ویدیو: https://www.youtube.com/watch?v=ob3pgk1PDTs)') >= 0, 'سرنخِ لینک به جملهٔ دست‌نخورده چسبید (با حافظه)');
const p2 = C.prepare('همین ویدیویی که یوتیوب دادم به تو برا من توی کی ام پلیر پخشش کن', { ai: true });
ok(p2.text === 'همین ویدیویی که یوتیوب دادم به تو برا من توی کی ام پلیر پخشش کن', 'ارجاعِ لینکِ داده‌شده (دادم) بدون حافظه → جمله دست‌نخورده');
const p3 = C.prepare('خوب این ویدیو یوتیوب برام پلی کن', { ai: true });
ok(p3.text.indexOf('شادمهر') >= 0, 'بازنویسی مفیدِ عنوان سر جایش است («این ویدیو» → «ویدیو شادمهر»)');
const p4 = C.prepare('لینک یوتیوب کپی کردم برام توی ویدیو پلیر پخشش کن', { ai: true });
ok(p4.text === 'لینک یوتیوب کپی کردم برام توی ویدیو پلیر پخشش کن', '«لینک کپی کردم» بدون بازنویسی (AI قانون __clipboard__ دارد)');
const p5 = C.prepare('همین آهنگ رو باز کن', { ai: true });
ok(p5.text.indexOf('شادمهر') >= 0, 'بازنویسی عادی آهنگ خراب نشده');
/* بستنِ instant (فیکس [ت]) */
ok(C.prepare('ویدیو رو ببند', { ai: false }).lane === 'instant', '«ویدیو رو ببند» → instant (قبلاً brain)');
ok(C.prepare('ویدیو رو خاموشش کن', { ai: false }).lane === 'instant', '«ویدیو رو خاموشش کن» → instant');
ok(C.prepare('پلیر رو ببندش', { ai: false }).lane === 'instant', '«پلیر رو ببندش» → instant');

/* ---------- [3] app.js — لَین URL + پلیر مقصد + حافظه ---------- */
section('3] app.js — لَین قطعی URL + videoPlayReply مشترک + حافظهٔ lastVideoUrl');
ok(/lane=video-url \(deterministic\)/.test(appSrc) && /AVAIntent\.videoUrlLane\(cmd\)/.test(appSrc), 'لَین URL در runCommand قبل از هستهٔ فهم');
ok(/lastVideoUrl = _vl\.url/.test(appSrc), 'لَین URL حافظه را پر می‌کند');
ok(/videoUrl: \(typeof lastVideoUrl === 'string' && lastVideoUrl\) \? lastVideoUrl : ''/.test(appSrc), 'حافظه به AVACore.prepare می‌رسد');
ok(/async function videoPlayReply\(vq, playerWanted, origCmdForLog\)/.test(appSrc), 'هلپر مشترک videoPlayReply (لَین URL + اکشن video_play یک مسیر)');
ok(/AVAIntent\.playerTargetOf\(String\(origCmd \|\| ''\)\)/.test(appSrc) && /videoPlayReply\(vq, _pw, origCmd\)/.test(appSrc), 'video_play پلیر مقصد را از جملهٔ کاربر می‌خواند');
ok(/if \(bareYt && lastVideoUrl\) \{[\s\S]{0,120}video_play last-video memory/.test(appSrc), 'دامنهٔ خام + حافظه → لینک واقعی');
ok(/if \(_vr\.ok\) \{ try \{ playDoneSound\(\); \} catch \(_\) \{ \/\* noop \*\/ \} \}/.test(appSrc), 'صدای انجام‌شد فقط در موفقیتِ لَین URL');
/* فیکس [ت] — فعل‌های بستن */
ok(/بس\\s\?بند\|بسش\\s\?کن\|بخوابون\|خاموشش\?\\s\?کن\|قطعش\?\\s\?کن/.test(appSrc), 'فعل‌های بستن در player_ctl گسترده شد');
ok(/close \(the \)\?\(youtube\|player\|stream\|video\)/.test(appSrc), 'yt_close ویدیو/فیلم/کلیپ/پلیر را هم می‌گیرد');
ok(/پلیر باز را بستم/.test(appSrc), 'بازخورد شمارشی «بستم (N پلیر)»');

/* ---------- [4] main.js — مشاهده‌پذیری پایپ‌لاین پخش ---------- */
section('4] main.js — لاگ player:open / ytdl / launch / fallback');
ok(/actLog\('player:open wanted=' \+ wanted/.test(mainSrc), 'player:open ورودی لاگ می‌شود');
ok(/player ytdl OK: stream resolved/.test(mainSrc) && /player ytdl FAIL: player=/.test(mainSrc), 'نتیجهٔ yt-dlp لاگ می‌شود (قبلاً نامرئی)');
ok(/player launched: ' \+ player \+ ' \(via '/.test(mainSrc), 'اجرای موفق پلیر لاگ می‌شود');
ok(/player fallback → browser: player=/.test(mainSrc), 'فالبک مرورگر لاگ می‌شود');
ok(/'player'/.test(mainSrc), 'کانال لاگ player');

/* ---------- [5] v0.66 — کنسل/هنگ (D) ---------- */
section('5] کنسل/هنگ — دکمه ✕ + فرمان صوتی + epoch + abort سراسری');
ok(/ipcMain\.handle\('ai:cancel'/.test(mainSrc) && /aiGenCancelEpoch \+= 1/.test(mainSrc), 'main: کانال ai:cancel + epoch');
ok(/AbortSignal\.any\(\[AbortSignal\.timeout\(35000\), ac\.signal\]\)/.test(mainSrc), 'main: fetch جمینای با abort کاربر (AbortSignal.any)');
ok((mainSrc.match(/isCancelled\(\)/g) || []).length >= 3, 'main: گارد لغو در حلقهٔ کلید/مدل + catch (کول‌داون نسازد) — ' + (mainSrc.match(/isCancelled\(\)/g) || []).length + ' نقطه');
ok(/cancel: \(\) => ipcRenderer\.invoke\('ai:cancel'\)/.test(preloadSrc), 'preload: پل ai.cancel');
ok(/let aiRunEpoch = 0;/.test(appSrc) && /async function aiCancelRun\(reason\)/.test(appSrc), 'renderer: epoch + aiCancelRun');
ok(/await aiCancelRun\('new-command'\)/.test(appSrc) && /cmd busy → previous request cancelled by new command/.test(appSrc), 'renderer: فرمان جدید برنده است (busy-drop حذف شد)');
ok(/کنسل\(\\s\?کن\)\?\|لغو/.test(appSrc) && /wasBusy \? 'cancel' : 'cancel-idle'/.test(appSrc), 'renderer: فرمان صوتی لغو (busy/idle دو پیام)');
ok((appSrc.match(/aiStale\(\)\) return;/g) || []).length >= 6, 'renderer: گاردهای aiStale بعد از هر فراخوان شبکه‌ای (' + (appSrc.match(/aiStale\(\)\) return;/g) || []).length + ' نقطه)');
ok(/if \(aiRunEpoch === myEpoch\) thinkChipSet\(false\);/.test(appSrc), 'renderer: چیپ فکر با گارد epoch بسته می‌شود');
ok(/if \(!aiStale\(\)\) cmdBusy = false;/.test(appSrc), 'renderer: رانِ لغوشده گاردِ فرمان جدید را نمی‌سوزاند');
ok(/id="thinkCancel"/.test(idxSrc) && /\.think-cancel/.test(cssSrc) && /pointer-events: auto/.test(cssSrc), 'UI: دکمهٔ ✕ روی چیپ (کلیک‌پذیر داخل چیپ non-pointer)');

/* ---------- [6] v0.66 — بوردر رنگین‌کمانی (F1) + بج wake word (F2) ---------- */
section('6] UI — بوردر رنگین‌کمانی thinking + بج «کلمهٔ فعال الان»');
ok(/@property --thinkAng/.test(cssSrc) && /conic-gradient\(from var\(--thinkAng\)/.test(cssSrc) && /@keyframes thinkSpin/.test(cssSrc), 'F1: حلقهٔ conic-gradient چرخان دور چیپ');
ok(/255, 255, 255/.test(cssSrc) && /253, 224, 71/.test(cssSrc) && /192, 132, 252/.test(cssSrc), 'F1: رنگ‌های سفید/زرد/بنفش');
ok(/\.think-chip::after/.test(cssSrc) && /blur\(6px\)/.test(cssSrc), 'F1: هالهٔ نرم بیرونی (::after + blur)');
ok(/id="wakeWordNow"/.test(idxSrc) && /set\.stt\.wakeWordNow'/.test(appSrc) && /wwn\.textContent = String\(settings\.wakeWordText/.test(appSrc), 'F2: بج «کلمهٔ فعال الان» + سیم‌کشی نمایش');
ok(/elWwn2 = \$\('#wakeWordNow'\)/.test(appSrc), 'F2: تازه‌سازی بج پس از تایپ دستی هم');

/* ---------- [7] v0.66 — PTT (C) ---------- */
section('7] PTT — ثبات نگهبان + تعارض + پیشنهادها + وضعیت');
const VI = require(path.join(APP, 'renderer/js/voiceIntent.js'));
ok(typeof VI.pttConflictOf === 'function' && typeof VI.pttSuggestionsOf === 'function', 'voiceIntent: pttConflictOf/pttSuggestionsOf صادر شده‌اند');
ok(VI.pttConflictOf('CommandOrControl+1').length > 0, 'تعارض: Ctrl+1 (تب مرورگر) — دقیقاً کلیدی که کاربر لاگ داشت');
ok(VI.pttConflictOf('CommandOrControl+Shift+M').length > 0, 'تعارض: Ctrl+Shift+M (میوت دیسکورد)');
ok(VI.pttConflictOf('F9') === '' && VI.pttConflictOf('CommandOrControl+Alt+V') === '', 'پیشنهادهای امن واقعاً بی‌تعارض‌اند');
ok(VI.pttSuggestionsOf().length >= 5 && VI.pttSuggestionsOf().every((s) => s.acc && s.fa), 'لیست پیشنهادی ≥۵ کلید با برچسب فارسی');
ok(/_avaIntentionalKill = true/.test(mainSrc) && /if \(child\._avaIntentionalKill\) \{ actLog\('ptt watcher stopped/.test(mainSrc), 'main: مرگِ عامدانهٔ watcher دیگر restart نمی‌سازد (ریشهٔ لاگ: restart# در هر تعویض کلید)');
ok(/id="pttPresets"/.test(idxSrc) && /id="pttConflictHint"/.test(idxSrc) && /id="pttStatus"/.test(idxSrc), 'UI: چیپ‌های پیشنهادی + هشدار تعارض + وضعیت');
ok(/AVAIntent\.pttConflictOf\(settings\.ptt\.combo\)/.test(appSrc) && /function pttStatusUpdate\(\)/.test(appSrc), 'renderer: هشدار زندهٔ تعارض + وضعیت از ptt:get');
ok(/set\.ptt\.presetsTitle'/.test(appSrc) && /set\.ptt\.statusWatcher'/.test(appSrc), 'i18n: کلیدهای جدید PTT');

/* ---------- [8] v0.66 — دیسکورد (E) ---------- */
section('8] دیسکورد — selftest یک‌کلیکی + تشخیص پهن پروسس');
ok(/'selftest' \{/.test(mainSrc) && /OK:SELFTEST/.test(mainSrc), 'main: اکشن selftest در اسکریپت PS (گام‌های DBG: winapi/uia/process/window)');
ok((mainSrc.match(/Discord,DiscordCanary,DiscordPTB,DiscordDevelopment/g) || []).length >= 3, 'main: تشخیص پروسس شامل Discord/Canary/PTB/Development');
ok(/id="btnDcSelftest"/.test(idxSrc) && /dcBtn\('#btnDcSelftest', 'selftest'/.test(appSrc), 'UI: دکمهٔ «تست دیسکورد» + سیم‌کشی');
ok(/disc\.selftestBtn':/.test(appSrc) && /disc\.selftestOk':/.test(appSrc), 'i18n: برچسب/پیام تست دیسکورد');
ok(/'discord_mute'/.test(appSrc) && /'discord_hangup'/.test(appSrc) && /'discord_answer'/.test(appSrc) && /'discord_decline'/.test(appSrc) && /'discord_deafen'/.test(appSrc) && /'discord_unmute'/.test(appSrc), 'DO: هر ۶ اکشن دیسکورد سیم‌کشی‌شده');

/* ---------- [9] v0.66 — اسکن اپ‌ها (G) + فیکس‌های لاگ‌محور (I) ---------- */
section('9] اسکن نرم‌افزارها + فالبک AI + learn + ریس STT');
ok(/function scanRegistryApps\(\)/.test(mainSrc) && /Uninstall\\\\\*/.test(mainSrc) || /CurrentVersion\\\\Uninstall/.test(mainSrc), 'G: اسکن رجیستری (HKLM/HKCU Uninstall)');
ok(/scanRegistryApps\(\)/.test(mainSrc) && /menu, steam, uwp, reg/.test(mainSrc), 'G: ادغام رجیستری در scanAllApps');
ok(/app scan done: ' \+ apps\.length \+ ' apps \(menu=/.test(mainSrc), 'G: لاگ نتیجهٔ اسکن به‌تفکیک منبع');
ok(/id="appsCount"/.test(idxSrc) && /id="btnAppsRescan"/.test(idxSrc) && /bridge\.apps\.scan\(\)/.test(appSrc), 'G: پنل «نرم‌افزارهای شناسایی‌شده» + دکمهٔ اسکن مجدد');
ok(/set\.app\.appsTitle':/.test(appSrc) && /set\.app\.appsDone':/.test(appSrc), 'G: i18n پنل اپ‌ها');
ok(/chain2 = \(prov && prov !== 'auto'\) \? chainAi\.filter\(\(x\) => x\[0\] !== prov\) : chainAi/.test(appSrc), 'I1: فالبک عرضه‌محور — پرووایدر ثابتِ شکست‌خورده، زنجیرهٔ بقیه امتحان می‌شود');
const L2 = require(path.join(APP, 'renderer/js/voiceLearn.js'));
const stT1 = { items: [{ k: 'محمد', act: 'web_search', value: 'محمد', unstable: false }] };
ok(L2.match(stT1, 'مشتی سی و پرطرفدار دایی') === null, 'I3: مچِ بی‌ربطِ یادگیری (لاگ v0.63) دیگر رخ نمی‌دهد');
ok(L2.match({ items: [{ k: 'آهنگ جدید شادمهر رو بگرد', act: 'web_search', value: 'شادمهر', unstable: false }] }, 'آهنگ جدید شادمهر رو برام بگرد') !== null, 'I3: مچ معنایی سالم سر جایش است');
ok(/tokN >= 4 && chain\.length > 1/.test(appSrc) && /2\.2s cloud corroboration window/.test(appSrc), 'I2: ریس STT — آستانهٔ ۴ توکن + پنجرهٔ ۲.۲ ثانیه (زبالهٔ ۵توکنی لاگ دیگر برنده نمی‌شود)');
ok(/SR_BENCH_MS = 60000/.test(appSrc), 'I2: بنچ وب ۹۰→۶۰ ثانیه');

/* ---------- نتیجه ---------- */
console.log('\n———————————————');
console.log('PASS=' + pass + '  FAIL=' + fail);
if (fails.length) console.log('failures:\n - ' + fails.join('\n - '));
process.exit(fail ? 1 : 0);
