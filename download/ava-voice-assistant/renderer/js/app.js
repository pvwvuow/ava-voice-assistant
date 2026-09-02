/* ============================================================
   آوا — دستیار صوتی ویندوز | منطق رابط کاربری (نسخه ۰.۱۰)
   - تشخیص گفتار دقیق: موتور وب گوگل (با کلید کرومیوم داخل Electron)
     → فالبک خودکار گوگل رایگان HTTP (آستانه تطبیقی + فالبک WAV به GLM)
   - پیشنهاد شانسی فرمان‌ها (چرخشی) + انیمیشن‌های حرفه‌ای صفحه اصلی
   - فرم شیشه‌ای «DNS جدید» داخل صفحه اصلی با انیمیشن + اعمال فوری
   - تم تیره زمردی / تم روشن بنفش-کهربایی + دوزبانه (فارسی/English)
   - فرمان‌های صوتی خواب/خاموش کردن/مانیتور + فرمان‌های سفارشی AI
   ============================================================ */
/* ============================================================
   v0.16.1 — سپر پایداری (قبل از هر چیز)
   هر خطای رندرر در حلقهٔ localStorage ثبت می‌شود؛ اگر برنامه تا
   ۵ ثانیه «بالا نیامده» باشد، پنل خطا با دکمهٔ کپی گزارش و حالت
   امن نشان داده می‌شود — دیگر هیچ‌وقت «هیچ‌کاره» بی‌توضیح نیست.
   ============================================================ */
(() => {
  const K = 'ava.errlog';
  let ring = [];
  try { ring = JSON.parse(localStorage.getItem(K) || '[]'); } catch (_) { ring = []; }
  if (!Array.isArray(ring)) ring = [];
  const push = (msg) => {
    try {
      ring.push('[' + new Date().toISOString() + '] ' + msg);
      while (ring.length > 25) ring.shift();
      localStorage.setItem(K, JSON.stringify(ring));
    } catch (_) { /* noop */ }
    try { document.documentElement.setAttribute('data-ava-err', '1'); } catch (_) { /* noop */ }
  };
  window.__avaErr = { ring, push, booted: false, start: Date.now() };
  window.addEventListener('error', (e) => {
    push('error: ' + ((e && e.message) || 'unknown') + ' @ ' + ((e && e.filename) ? String(e.filename).split('/').pop() : '?') + ':' + ((e && e.lineno) || 0));
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e && e.reason;
    push('promise: ' + String((r && (r.stack || r.message)) || r).slice(0, 300));
  });
  /* شمارش خطاهای اولیه → اگر زیاد شد، دفعهٔ بعد حالت امن خودکار روشن شود */
  const bootErrors = () => window.__avaErr.ring.filter((l) => /error:|promise:/.test(l)).length;
  window.__avaErr.autoSafe = () => {
    try {
      if (bootErrors() >= 3 && Date.now() - window.__avaErr.start < 15000 && !localStorage.getItem('ava.safeMode')) {
        localStorage.setItem('ava.safeMode', '1');
        return true;
      }
    } catch (_) { /* noop */ }
    return false;
  };
  window.__avaCrashPanel = () => {
    if (document.querySelector('#avaCrashPanel')) return;
    const d = document.createElement('div');
    d.id = 'avaCrashPanel';
    d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(6,10,9,0.92);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;direction:rtl;font-family:inherit;';
    const txt = (window.__avaErr.ring.slice(-10).join('\n') || '(خطایی ثبت نشده — شاید فایل‌ها کامل نصب نشده‌اند؛ نصب را پاک و نسخهٔ جدید را کامل نصب کن)').slice(0, 1200);
    d.innerHTML = '<div style="width:min(560px,92vw);background:#0d1512;border:1px solid rgba(52,211,153,0.35);border-radius:18px;padding:22px;color:#e7f0ea;line-height:1.9">' +
      '<b style="font-size:15px">آوا کامل بالا نیامد</b>' +
      '<p style="font-size:12px;color:#9fb0a7;margin:8px 0 12px">اگر دکمه‌ها و داده‌ها کار نمی‌کنند، این گزارش را کپی و برایم بفرست. «حالت امن» افکت‌های سنگین را خاموش می‌کند و برنامه را دوباره بالا می‌آورد.</p>' +
      '<pre style="direction:ltr;text-align:left;font-size:10.5px;max-height:180px;overflow:auto;background:#081009;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px;white-space:pre-wrap">' + String(txt).replace(/</g, '&lt;') + '</pre>' +
      '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">' +
      '<button id="avaCrashCopy" style="padding:8px 16px;border-radius:10px;border:1px solid rgba(52,211,153,0.5);background:rgba(52,211,153,0.15);color:#e7f0ea;cursor:pointer">کپی گزارش خطا</button>' +
      '<button id="avaCrashSafe" style="padding:8px 16px;border-radius:10px;border:1px solid rgba(245,158,11,0.5);background:rgba(245,158,11,0.15);color:#e7f0ea;cursor:pointer">حالت امن و شروع دوباره</button>' +
      '<button id="avaCrashClose" style="padding:8px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.2);background:none;color:#9fb0a7;cursor:pointer">بستن</button>' +
      '</div></div>';
    document.body ? document.body.appendChild(d) : document.documentElement.appendChild(d);
    const q = (id) => d.querySelector(id);
    if (q('#avaCrashCopy')) q('#avaCrashCopy').onclick = () => {
      try {
        navigator.clipboard.writeText('AVA crash report\n' + (navigator.userAgent || '') + '\n\n' + window.__avaErr.ring.join('\n'));
        q('#avaCrashCopy').textContent = 'کپی شد ✓';
      } catch (_) { q('#avaCrashCopy').textContent = 'کپی نشد'; }
    };
    if (q('#avaCrashSafe')) q('#avaCrashSafe').onclick = () => {
      try { localStorage.setItem('ava.safeMode', '1'); } catch (_) { /* noop */ }
      location.reload();
    };
    if (q('#avaCrashClose')) q('#avaCrashClose').onclick = () => d.remove();
  };
  setTimeout(() => { if (window.__avaErr && !window.__avaErr.booted) window.__avaCrashPanel(); }, 5000);
})();

(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const bridge = window.ava || null;
  const SRC = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const canRun = !!(bridge && bridge.system && bridge.system.run);

  /* ============================================================
     دوزبانه (i18n) — هر کلید: [فارسی، English]
     عناصر استاتیک با data-i18n / data-i18n-ph / data-i18n-tip
     متن‌های دینامیک با t('key')
     ============================================================ */
  let LANG = 'fa';
  const I18N = {
    'tb.title': ['دستیار صوتی ویندوز', 'Windows Voice Assistant'],
    'tb.theme': ['تم روشن / تیره', 'Light / Dark theme'],
    'tb.min': ['کوچک کردن', 'Minimize'], 'tb.max': ['بزرگ کردن / بازگردانی', 'Maximize / Restore'], 'tb.close': ['بستن', 'Close'],
    'nav.home': ['خانه صوتی', 'Voice home'], 'nav.dict': ['تایپ صوتی — بگو «آوا تایپ»', 'Voice typing — say "Ava type"'],
    'nav.chat': ['چت با هوش مصنوعی GLM (بدون کلید)', 'Chat with GLM AI (no API key)'],
    'nav.ext': ['افزونه‌ها — DNS Changer، پلیر موزیک و بیشتر', 'Extensions — DNS Changer, music player and more'],
    'nav.dnsExt': ['DNS Changer — مدیریت کامل DNS', 'DNS Changer — full DNS management'],
    'nav.history': ['تاریخچه فرمان‌ها', 'Command history'], 'nav.plugins': ['افزونه‌ها — به‌زودی', 'Plugins — soon'],
    'nav.about': ['درباره آوا', 'About AVA'], 'nav.settings': ['تنظیمات', 'Settings'],
    'hero.sub': ['فرمانت را بگو تا برایت انجامش بدهم.', 'Say the word and I will do it for you.'],
    'hf.tip': ['حالت بی‌دست (Ctrl+Alt+A) — با گفتن «آوا …» فرمان بده', 'Hands-free (Ctrl+Alt+A) — start with "Ava …"'],
    'hf.label': ['حالت بی‌دست', 'Hands-free'],
    'suggest.hint': ['مثلاً بگو…', 'Try saying…'],
    'cmd.ph': ['فرمان را اینجا بنویس یا دکمه میکروفون را بزن…', 'Type a command here or press the mic button…'],
    'set.title': ['تنظیمات', 'Settings'], 'set.back': ['بازگشت به خانه', 'Back to home'],
    'set.nav.mic': ['میکروفون', 'Microphone'], 'set.nav.stt': ['تشخیص گفتار', 'Speech recognition'],
    'set.nav.dict': ['تایپ صوتی', 'Voice typing'], 'set.nav.dns': ['DNS و شبکه', 'DNS & network'],
    'set.nav.wake': ['بیدارباش', 'Wake word'],
    'set.wake.note': ['بیدارباش یعنی آوا همیشه گوش می‌دهد که کی داری حرف می‌زنی — حتی وقتی برنامه مینیمایز باشد یا در بازی هستی. با گفتن «آوا» (یا تلفظ‌های نزدیک مانند «آبا») آمادهٔ گوش دادن می‌شود.', 'Wake word means AVA always listens for your voice — even minimized or in a game. Say "Ava" (or close pronunciations like "Aba") and it gets ready to listen.'],
    'set.dc.adv': ['مخاطبین، روش تماس و مکان دکمه (پیشرفته)', 'Contacts, call mode & button position (advanced)'],
    'set.nav.voice': ['صدا و پاسخ', 'Voice & replies'], 'set.nav.ai': ['هوش مصنوعی', 'AI'],
    'set.nav.app': ['برنامه', 'App'], 'set.nav.update': ['به‌روزرسانی', 'Updates'],
    'set.nav.ext': ['افزونه‌ها', 'Extensions'],
    'set.nav.perf': ['بهینه‌سازی', 'Optimization'],
    'set.navg.speak': ['گفتار', 'Speech'], 'set.navg.voice': ['صدا و هوش', 'Voice & AI'],
    'set.navg.connect': ['اتصال‌ها', 'Integrations'], 'set.navg.system': ['سیستم', 'System'],
    'set.sub.appLook': ['زبان و ظاهر', 'Language & theme'], 'set.sub.appRun': ['پنجره و شروع', 'Window & startup'],
    'set.sub.appMem': ['یادآوری و یادگیری', 'Reminders & learning'], 'set.sub.appMisc': ['عیب‌یابی و پیوندها', 'Diagnostics & links'],
    'set.ptt.onoff': ['روشن/خاموش', 'On/off'],
    'set.ext.dns': ['افزونهٔ DNS Changer', 'DNS Changer extension'],
    'set.ext.dnsHint': ['با فعال‌کردن، دکمه‌اش در ستون کنار می‌آید و مدیریت کامل DNS را همان‌جا باز می‌کند', 'When on, its button stays in the side rail and opens full DNS management'],
    'set.ext.music': ['افزونهٔ پلیر موزیک', 'Music player extension'],
    'set.ext.musicHint': ['تا وقتی فعالش نکنی در ستون نمی‌آید و برنامه سبک‌تر می‌ماند', 'Until you enable it, it stays out of the rail and the app stays light'],
    'set.ext.open': ['مدیریت افزونه‌ها', 'Manage extensions'],
    'set.ext.openHint': ['صفحهٔ افزونه‌ها: فعال‌سازی، باز کردن و کارت‌های جدید در نسخه‌های بعدی', 'The extensions page: enable, open, and new cards in future releases'],
    'set.ext.openBtn': ['باز کردن افزونه‌ها', 'Open extensions'],
    'set.ext.note2': ['به‌زودی افزونه‌های بیشتری مثل آب‌وهوا و تایمر به همین صفحه اضافه می‌شود.', 'More extensions like Weather and Timer will arrive on this page soon.'],
    'set.perf.anim': ['انیمیشن‌ها', 'Animations'],
    'set.perf.animHint': ['همهٔ حرکت‌ها ساکت می‌شوند — برای لپ‌تاپ‌های ضعیف و باتری کمتر', 'All motion is silenced — great for weak laptops and battery'],
    'set.perf.fx': ['افکت‌های پس‌زمینه', 'Background effects'],
    'set.perf.fxHint': ['ذرات، شفق و هالهٔ دور دکمه حذف می‌شوند و شیشه‌ها ساده می‌شوند', 'Removes particles, aurora and the orb halo; glass becomes simple'],
    'set.perf.theme': ['تم‌های سبک (سیستم ضعیف)', 'Lite themes (weak PC)'],
    'set.perf.themeHint': ['هر بار کلیک، یک قدم جلو: سبک روشن → سبک تیره → بازگشت — ظاهر صاف بدون شیشه و گرادیان سنگین', 'Each click cycles: lite light → lite dark → back — flat look, no heavy glass or gradients'],
    'set.perf.themeBtn': ['تغییر تم سبک', 'Cycle lite theme'],
    'set.perf.note': ['تم سبک خودش افکت‌ها و انیمیشن‌ها را هم کم می‌کند؛ اگر فقط کمی سبک‌تر شدن کافی است، فقط همان دو کلید بالا را خاموش کن.', 'The lite theme also trims effects and animations by itself; for a lighter touch just use the two switches above.'],
    'set.ai.save': ['ذخیره تنظیمات هوش مصنوعی', 'Save AI settings'],
    'toast.savedAll': ['همهٔ تنظیمات هوش مصنوعی ذخیره شد ✓', 'All AI settings saved ✓'],
    'toast.themeLite': ['تم سبک فعال شد — برای سیستم‌های ضعیف', 'Lite theme on — made for weak PCs'],
    'toast.extOn': ['افزونهٔ {x} فعال شد — دکمه‌اش به ستون کنار آمد', '{x} extension enabled — added to the rail'],
    'toast.extOff': ['افزونهٔ {x} خاموش شد', '{x} extension disabled'],
    'toast.noAnimOn': ['انیمیشن‌ها خاموش شد — سبک‌تر از همیشه', 'Animations off — lighter than ever'],
    'toast.noAnimOff': ['انیمیشن‌ها روشن شد', 'Animations back on'],
    'toast.noFxOn': ['افکت‌های پس‌زمینه خاموش شد', 'Background effects off'],
    'toast.noFxOff': ['افکت‌های پس‌زمینه روشن شد', 'Background effects on'],
    'music.pausedFling': ['ویجت بسته شد — پخش متوقف شد', 'Widget dismissed — playback paused'],
    'ext.title': ['افزونه‌ها', 'Extensions'],
    'ext.hint': ['افزونه‌ها بخش‌های اضافهٔ آوا هستند؛ هر کدام را فعال کنی دکمه‌اش به ستون کنار می‌آید و وقتی لازمشان نداری برنامه سبک و جمع‌وجور می‌ماند.', 'Extensions are optional AVA modules; enabling one adds its button to the side rail, keeping the app light otherwise.'],
    'ext.dns': ['DNS Changer', 'DNS Changer'],
    'ext.dnsDesc': ['تغییر سریع DNS با کلیک یا صدا، پروفایل نام‌دار بی‌نهایت، پینگ سرعت و وضعیت لحظه‌ای اتصال', 'Fast DNS switching by click or voice, named profiles, speed ping and live status'],
    'ext.music': ['پلیر موزیک', 'Music player'],
    'ext.musicDesc': ['پلی‌لیست از پوشهٔ خودت با کاور، ویجت صفحه اصلی و کنترل صوتی', 'Playlist from your own folder with covers, home widget and voice control'],
    'ext.open': ['باز کردن', 'Open'],
    'ext.soon': ['به‌زودی', 'Soon'],
    'ext.soonWeather': ['آب‌وهوا', 'Weather'],
    'ext.soonDesc': ['وضعیت هوا و پیش‌بینی چند روز آینده — با فرمان صوتی', 'Current weather and multi-day forecast — by voice'],
    'ext.soonTimer': ['تایمر و پومودورو', 'Timer & Pomodoro'],
    'ext.soonDesc2': ['تایمر صوتی، شمارش معکوس و حالت تمرکز', 'Voice timer, countdown and focus mode'],
    'ext.discord': ['کنترل دیسکورد با صدا', 'Voice-controlled Discord'],
    'ext.discordDesc': ['«به علی زنگ بزن»، «تماس رو قطع کن»، «دیسکورد رو میوت کن»', '"Call Ali", "hang up", "mute Discord" — calls, end, mute, answer'],
    'ext.discordHint': ['زنگ زدن به دوستان، قطع تماس، میوت و جواب تماس — با کلیدهای میان‌بر دیسکورد', 'Call friends, hang up, mute and answer calls — via Discord keybinds'],
    'disc.working': ['در حال اجرای فرمان دیسکورد…', 'Running the Discord command…'],
    'disc.done': ['انجام شد ✓', 'Done ✓'],
    'disc.fail': ['فرمان دیسکورد اجرا نشد', 'Discord command failed'],
    'disc.muted': ['میکروفون دیسکورد قطع/وصل شد ✓', 'Discord mic toggled ✓'],
    'disc.deafened': ['صدای دیسکورد قطع/وصل شد ✓', 'Discord sound toggled ✓'],
    'disc.hangup': ['تماس قطع شد ✓', 'Call disconnected ✓'],
    'disc.answer': ['تماس جواب داده شد ✓', 'Call answered ✓'],
    'disc.decline': ['تماس رد شد ✓', 'Call declined ✓'],
    'disc.focused': ['پنجرهٔ دیسکورد فعال شد ✓', 'Discord window focused ✓'],
    'disc.calling': ['در حال زنگ زدن به {x} در دیسکورد…', 'Calling {x} on Discord…'],
    'disc.needName': ['اسم دوستت را بنویس', "Type your friend's name first"],
    /* v0.35 — پیام خصوصی + قطع/وصل کلاً */
    'disc.msgSent': ['پیامت برای {x} فرستاده شد ✓', 'Your message was sent to {x} ✓'],
    'disc.msgSentUnver': ['پیامت برای {x} رفت — نتوانستم ارسال را در صفحه تایید کن؛ یک نگاه به دیسکورد بنداز', 'Message handed to {x} — could not verify on screen; take a quick look at Discord'],
    'disc.msgNeedText': ['چه پیامی برای {x} بفرستم؟ آخرش بگو «که …» و متن پیام', 'What message should I send to {x}? End with the text'],
    'disc.comboOff': ['میکروفون و صدای دیسکورد هر دو قطع شدند ✓', 'Discord mic and sound are both off ✓'],
    'disc.comboOn': ['میکروفون و صدای دیسکورد هر دو وصل شدند ✓', 'Discord mic and sound are both back on ✓'],
    /* v0.29 — نتایج صادقانهٔ UIA + ان‌میوت واقعی */
    'disc.unmuted': ['میکروفون دیسکورد وصل شد ✓', 'Discord mic unmuted ✓'],
    'disc.alreadyMuted': ['میکروفون دیسکورد از قبل بی‌صدا بود ✓', 'Discord mic was already muted ✓'],
    'disc.alreadyOn': ['میکروفون دیسکورد از قبل وصل بود ✓', 'Discord mic was already on ✓'],
    'disc.alreadyDeaf': ['صدای دیسکورد از قبل قطع بود ✓', 'Discord was already deafened ✓'],
    /* v0.30 — وضعیت واقعی دیسکورد (بدون هیچ کلیکی) */
    'disc.stateMuted': ['میکروفون دیسکورد قطع است', 'Discord mic is muted'],
    'disc.stateOn': ['میکروفون دیسکورد وصل است', 'Discord mic is on'],
    'disc.stateDeaf': ['صدای دیسکورد قطع است', 'Discord sound is off'],
    'disc.stateSound': ['صدای دیسکورد وصل است', 'Discord sound is on'],
    'disc.stateFail': ['وضعیت دیسکورد خوانده نشد — دیسکورد باز است؟', 'Could not read Discord state — is Discord open?'],
    'wake.woke': ['آوا شنیدم! گوش می‌دهم…', 'Heard "Ava"! Listening…'],
    'wake.alwaysNeedPack': ['برای بیدارباش همیشگی، اول بستهٔ موتور آفلاین را از تنظیمات › گفتار دانلود کن', 'For always-on wake word, download the offline engine pack first (Settings › Speech)'],
    'wake.alwaysPreparing': ['در حال آماده‌سازی بیدارباش همیشگی… بستهٔ آفلاین دانلود می‌شود (فقط بار اول — بعدش ۱۰۰٪ آفلاین)', 'Preparing always-on wake word… downloading the offline pack (first time only — fully offline afterwards)'],
    'toast.wakeAlwaysOn': ['بیدارباش همیشگی روشن شد — هر وقت «آوا» بگویی گوش می‌دهم (۱۰۰٪ آفلاین، داخل ویندوز)', 'Always-on wake word is on — say "Ava" anytime (100% offline, on-device)'],
    'toast.wakeAlwaysOff': ['بیدارباش همیشگی خاموش شد', 'Always-on wake word is off'],
    'set.stt.wakeAlways': ['بیدارباش همیشگی (حتی وقتی گوش دادن خاموش است)', 'Always-on wake word (even when listening is off)'],
    /* v0.34 — سلامت و تست بیدارباش + حالت ابری بدون بستهٔ آفلاین */
    'wake.alwaysCloudOn': ['بیدارباش همیشگی روشن شد — تا نصب بستهٔ آفلاین، تشخیص «آوا» با اینترنت انجام می‌شود', 'Always-on wake is on — until the offline pack installs, "Ava" detection uses the internet'],
    'wake.healthTitle': ['وضعیت بیدارباش', 'Wake word status'],
    'wake.healthIdle': ['خاموش — سوییچ «بیدارباش همیشگی» را روشن کن', 'Off — turn on the always-on wake switch'],
    'wake.healthCloud': ['فعال — تشخیص «آوا» با اینترنت (بستهٔ آفلاین هنوز نصب نشده)', 'Active — "Ava" detection via internet (offline pack not installed yet)'],
    'wake.healthLocal': ['فعال — تشخیص «آوا» ۱۰۰٪ آفلاین داخل ویندوز', 'Active — "Ava" detection 100% offline on-device'],
    'wake.healthMic': ['در انتظار میکروفون — ۳۰ ثانیه دیگر دوباره تلاش می‌کنم', 'Waiting for the microphone — retrying in 30s'],
    'wake.healthFail': ['شروع نشد: {x}', 'Failed to start: {x}'],
    'wake.healthLast': ['آخرین شنیده: «{x}»', 'Last heard: "{x}"'],
    'wake.testBtn': ['تست بیدارباش', 'Test wake word'],
    'wake.testHint': ['الان بگو: «آوا» — نتیجه همین‌جا نشان داده می‌شود', 'Now say: "Ava" — the result shows right here'],
    'wake.testOk': ['تست موفق — آوا شنید و بیدار شد ✓', 'Test passed — Ava heard you and woke up ✓'],
    'wake.testMiss': ['شنیدم: «{x}» — ولی «آوا» توش نبود؛ کمی بلندتر و نزدیک‌تر به میکروفون امتحان کن', 'Heard: "{x}" — no "Ava" in it; try louder and closer to the mic'],
    'wake.testOff': ['اول بیدارباش همیشگی را روشن کن، بعد تست بگیر', 'Turn always-on wake on first, then test'],
    /* v0.34 — تایپ صوتی در برنامهٔ فعال */
    'dict.sysOn': ['تایپ در همین برنامه شروع شد — حرف بزن؛ پایان: «آوا تموم»', 'Typing into this app started — speak; say the stop command to finish'],
    'dict.sysSpeak': ['تایپ شروع شد — هرچی بگی همین‌جا می‌نویسم', 'Typing started — whatever you say gets typed right here'],
    'dict.sysFail': ['تایپ در برنامه انجام نشد — پنجرهٔ مقصد را فعال نگه دار', 'Typing into the app failed — keep the target window active'],
    'set.stt.wakeAlwaysHint': ['میکروفون باز می‌ماند و گفتار محیط ۱۰۰٪ داخل ویندوز بررسی می‌شود — حتی وقتی آوا مینیمایز است، پشت بازی‌ست یا مانیتور خاموش است (بدون توقف تایمر و صدا). با گفتن «آوا» صدای بانمک پخش و گوش دادن شروع می‌شود', 'Keeps the mic open and checks speech 100% on-device — even when Ava is minimized, behind a fullscreen game, or the monitor is off (timers and audio never throttle). Saying "Ava" plays the chime and starts listening'],
    /* v0.46 — کلمهٔ بیدارباش قابل تغییر (در هر دو دیکشنری) */
    'set.stt.wakeWordText': ['کلمهٔ بیدارباش (اسم صدازدن)', 'Wake word (call name)'],
    'set.stt.wakeWordTextHint': ['اگر «آوا» درست شنیده نمی‌شود یا اسم دیگری می‌پسندی عوضش کن (مثلاً «سارا») — تشخیص آوانگاری برای هر کلمه‌ای فعال می‌شود', 'If "Ava" is misheard or you prefer another name, change it here — phonetic matching adapts to any word'],
    'set.stt.wakeWordNow': ['کلمهٔ فعال الان', 'Active wake word now'],
    'set.stt.wakeWordNowHint': ['هر کلمه‌ای اینجا ببینی، همین الان فعالی است — با گفتن «آوا، از این به بعد … صدازم» یا همین کادر بالا عوض می‌شود', 'Whatever you see here is active right now — change it by voice or with the field above'],
    'toast.wakeWordSet': ['از این به بعد با گفتن «{x}» بیدار می‌شوم', 'From now on say "{x}" to wake me'],
    'set.ai.gemTest': ['تست اتصال جمنای', 'Test Gemini connection'],
    'set.ai.gemTestHint': ['کلید ذخیره‌شده را با یک درخواست واقعی امتحان می‌کند — خطای دقیق (کلید/سهمیه/سرزمین/شبکه) را همین‌جا می‌بینی', 'Sends a tiny real request with the saved key — shows the exact error (key/quota/region/network)'],
    'set.ai.gemTestBtn': ['تست اتصال', 'Test connection'],
    'set.ai.gemTesting': ['در حال تست…', 'Testing…'],
    'set.ai.gemTestNoKey': ['اول کلید جمنای را در کادر بالا بگذار', 'Put your Gemini key in the field above first'],
    'set.ai.gemTestOk': ['وصل شد ✓ مدل {x} — {y} میلی‌ثانیه', 'Connected ✓ model {x} — {y} ms'],
    'set.ai.gemTestOkList': ['وصل شد ✓ مدل {x} — {y} میلی‌ثانیه ({z} مدل زنده پیدا شد — دکمهٔ «فهرست مدل‌ها»)', 'Connected ✓ model {x} — {y} ms ({z} live models found — see "Model list")'],
    'set.ai.gemTestToastOk': ['جمنای وصل است ✓', 'Gemini is connected ✓'],
    'set.ai.gemTestFail': ['وصل نشد: {x}', 'Connection failed: {x}'],
    'set.ai.gemBase': ['آدرس رلهٔ جمنای (پیشرفته — اختیاری)', 'Gemini relay URL (advanced — optional)'],
    'set.ai.gemBaseHint': ['اگر گوگل منطقهٔ تو را محدود کرده («location is not supported»)، آدرس پایهٔ یک پروکسی/ورکر شخصی را بگذار (مثل https://my-worker.workers.dev) تا درخواست‌های جمنای از سرور خودت رد شوند؛ خالی = مستقیم گوگل', 'If Google blocks your region ("location is not supported"), put the base URL of your own proxy/worker (e.g. https://my-worker.workers.dev) — requests go through your server; empty = direct Google'],
    'disc.dmOnly': ['پیام‌رسان دیسکورد باز شد ولی دکمهٔ تماس پیدا نشد — مختصات دکمه را در تنظیمات دیسکورد آزمایش/تنظیم کن', 'Discord DM opened but the call button was not found — calibrate it in Discord settings'],
    'disc.assist': ['صفحهٔ مخاطب در دیسکورد باز شد — فقط دکمهٔ تماس را بزن ✓', 'Contact page is open in Discord — just press the call button ✓'],
    'set.dc.callMode': ['روش شروع تماس', 'How calls start'],
    'set.dc.callModeHint': ['«کمکی»: فقط صفحهٔ مخاطب باز می‌شود و خودت دکمهٔ تماس را می‌زنی — کاملاً مطابق قوانین دیسکورد. «خودکار (آزمایشی)»: آوا کلید/کلیک شبیه‌سازی‌شده به پنجرهٔ دیسکورد خودت می‌فرستد (مثل ماکروهای دسترسی‌پذیری) — هیچ توکن یا API دیسکورد استفاده نمی‌شود، ولی ممکن است روی بعضی نسخه‌ها کار نکند', '"Assist": only opens the contact page and you press call — fully within Discord rules. "Auto (experimental)": AVA sends simulated keys/clicks to your own Discord window (like accessibility macros) — no Discord token or API involved, but it may not work on every version'],
    'set.dc.modeAuto': ['خودکار (آزمایشی)', 'Auto (experimental)'],
    'set.dc.modeAssist': ['کمکی — امن', 'Assist — safe'],
    'disc.muteBtn': ['میوت', 'Mute'], 'disc.deafenBtn': ['بی‌صدا کردن کل', 'Deafen'],
    'disc.answerBtn': ['جواب تماس', 'Answer'], 'disc.declineBtn': ['رد تماس', 'Decline'],
    'disc.hangupBtn': ['قطع تماس', 'Hang up'], 'disc.focusBtn': ['فوکوس دیسکورد', 'Focus Discord'],
    'disc.selftestBtn': ['تست دیسکورد', 'Test Discord'],
    'disc.selftestOk': ['تست دیسکورد کامل شد — جزئیات گام‌به‌گام در activity.log', 'Discord self-test finished — step details in activity.log'],
    'disc.callBtn': ['زنگ بزن', 'Call'],
    /* ---------- v0.17 — تنظیمات دیسکورد ---------- */
    'set.nav.discord': ['دیسکورد', 'Discord'],
    'set.dc.open': ['تنظیمات', 'Settings'],
    'set.dc.openPage': ['تنظیمات و دکمه‌ها', 'Settings & buttons'],
    'set.dc.quick': ['دکمه‌های سریع دیسکورد', 'Discord quick buttons'],
    'set.dc.quickHint': ['میوت، بی‌صدای کل، جواب/رد/قطع تماس — حتی وقتی دیسکورد مینیمایز است (بدون باز شدن پنجره)', 'Mute, deafen, answer/decline/hangup — even when Discord is minimized (no window opens)'],
    'set.adv.stt': ['سرور Whisper، کلید گوگل و دمو (پیشرفته — همان پیش‌فرض‌ها برای اکثر مردم کافی است)', 'Whisper server, Google key and demo (advanced — defaults are fine for most people)'],
    'set.adv.ai': ['رله، مدل‌ها و کلید OpenAI (پیشرفته)', 'Relay, models and OpenAI key (advanced)'],

    'set.dc.contacts': ['مخاطبین دیسکورد', 'Discord contacts'],
    'set.dc.contactsHint': ['برای دوستانی که آی‌دی‌شان عجیب/سخت است یک اسم ساده ذخیره کن؛ بعد با «به فلانی زنگ بزن» مستقیم تماس می‌گیرد. آی‌دی: در دیسکورد Settings › Advanced › Developer Mode را روشن کن، بعد روی مخاطب راست‌کلیک و Copy User ID', 'Save a simple name for friends with awkward IDs, then say "call …". To get the ID: enable Settings › Advanced › Developer Mode in Discord, right-click the user → Copy User ID'],
    'set.dc.namePh': ['اسم ساده (مثلاً: علی)', 'Simple name (e.g. Ali)'],
    'set.dc.idPh': ['Discord User ID — ۱۷/۱۸ رقم', 'Discord User ID — 17/18 digits'],
    'set.dc.add': ['افزودن', 'Add'],
    'set.dc.empty': ['هنوز مخاطبی نداری — اسم ساده + آی‌دی دیسکورد را وارد کن', 'No contacts yet — add a simple name + Discord ID'],
    'set.dc.call': ['زنگ بزن', 'Call'],
    'set.dc.del': ['حذف مخاطب', 'Delete contact'],
    'set.dc.deleted': ['مخاطب «{x}» حذف شد', 'Contact "{x}" removed'],
    'set.dc.needBoth': ['هم اسم و هم آی‌دی دیسکورد را وارد کن', 'Enter both a name and the Discord ID'],
    'set.dc.badId': ['آی‌دی دیسکورد فقط عدد است (۱۷ یا ۱۸ رقم)', 'A Discord ID is all digits (17–18 of them)'],
    'set.dc.added': ['مخاطب «{x}» ذخیره شد ✓ — حالا بگو «به {x} زنگ بزن»', 'Contact "{x}" saved ✓ — now say "call {x}"'],
    'set.dc.bg': ['بدون باز کردن پنجرهٔ دیسکورد', 'No Discord window opening'],
    'set.dc.bgHint': ['میوت/دیفن حتی وقتی دیسکورد مینیمایز یا بسته به تری است، بدون باز شدن و بدون قاپیدن فوکوس اجرا می‌شود (کلیک مجازی دکمهٔ واقعی + تایید تغییر وضعیت) — اگر روی نسخه‌ای جواب نداد خاموشش کن تا با فوکوس مستقیم اجرا شود', 'Mute/deafen runs even when Discord is minimized or in the tray — no window opens and focus is never stolen (virtual click on the real button + state-flip proof). Turn off only if your Discord build resists it'],
    'set.dc.bgOn': ['حالت بک‌گراند روشن شد — دیسکورد وسط بازی پاپ‌آپ نمی‌شود', 'Background mode on — Discord will not pop up mid-game'],
    'set.dc.bgOff': ['حالت بک‌گراند خاموش شد — اجرا با فوکوس مستقیم', 'Background mode off — commands run with direct focus'],
    'set.dc.cal': ['مکان دکمهٔ تماس (فالبک)', 'Call button position (fallback)'],
    'set.dc.calHint': ['وقتی دکمهٔ تماس پیدا نشود، از گوشهٔ بالا-راست این فاصله‌ها کلیک می‌شود — با «آزمایش» نشانگر موس سر جایش می‌نشیند', 'When the call button cannot be found, AVA clicks this far from the top-right corner — "Probe" moves the mouse there for checking'],
    'set.dc.probe': ['آزمایش', 'Probe'],
    'set.dc.probing': ['نشانگر موس به مکان دکمهٔ تماس می‌رود…', 'Moving the mouse to the call button position…'],
    'set.dc.probed': ['نشانگر روی مکان دکمهٔ تماس قرار گرفت — درست است؟ عدد X/Y را اگر لازم است عوض کن', 'Mouse is now on the call button spot — adjust X/Y if it is off'],
    'set.dc.note': ['فرمان‌ها: «به علی زنگ بزن»، «تماس رو قطع کن»، «دیسکورد رو میوت کن»، «صدای دیسکورد رو قطع کن»، «جواب تماس»، «رد تماس». برای قطع/جواب/رد یک‌بار در Discord › Settings › Keybinds اکشن Disconnect را روی Ctrl+Shift+H، Answer را روی Ctrl+Shift+A و Decline را روی Ctrl+Shift+E بگذار؛ میوت (Ctrl+Shift+M) و کرافت (Ctrl+Shift+D) پیش‌فرض کار می‌کنند.', 'Commands: "call Ali", "hang up", "mute Discord", "deafen Discord", "answer", "decline". For hangup/answer/decline bind once in Discord › Settings › Keybinds: Disconnect = Ctrl+Shift+H, Answer = Ctrl+Shift+A, Decline = Ctrl+Shift+E; Mute (Ctrl+Shift+M) and Deafen (Ctrl+Shift+D) work by default.'],
    'disc.namePh': ['اسم دوستت در دیسکورد…', "Your friend's Discord name…"],
    /* ---------- v0.18 ---------- */
    'report.working': ['پوشهٔ لاگ‌ها باز می‌شود…', 'Opening the logs folder…'],
  'report.folder': ['پوشهٔ لاگ‌ها باز شد — فایل activity.jsonl (و activity.log) را برای من بفرست تا خودم بررسی کنم', 'Logs folder opened — send me the activity.jsonl file and I will review it'],
  'report.folder.fail': ['باز کردن پوشهٔ لاگ‌ها نشد — مسیر: %APPDATA%/ava-voice-assistant/logs', 'Could not open the logs folder — path: %APPDATA%/ava-voice-assistant/logs'],
    'disc.hint': ['یک‌بار در دیسکورد این کلیدها را بساز: Settings › Keybinds → Disconnect از Voice Channel = Ctrl+Shift+H، Answer Call = Ctrl+Shift+A، Decline Call = Ctrl+Shift+E — بعد با صدا بگو «تماس رو قطع کن». میوت (Ctrl+Shift+M) و بی‌صدای کل (Ctrl+Shift+D) با پیش‌فرض دیسکورد کار می‌کنند.', 'Once in Discord make these keybinds: Settings › Keybinds → Disconnect from Voice Channel = Ctrl+Shift+H, Answer Call = Ctrl+Shift+A, Decline Call = Ctrl+Shift+E — then just say "hang up". Mute (Ctrl+Shift+M) and Deafen (Ctrl+Shift+D) work with Discord defaults.'],
    'set.mic.input': ['ورودی میکروفون', 'Microphone input'],
    'set.mic.checking': ['دسترسی میکروفون بررسی می‌شود…', 'Checking microphone access…'],
    'set.mic.default': ['پیش‌فرض ویندوز', 'Windows default'],
    'set.mic.test': ['تست زنده میکروفون', 'Live microphone test'],
    'set.mic.testHint': ['حرف بزن — میله‌ها باید با صدای تو بالا و پایین شوند', 'Speak — the bars should move with your voice'],
    'set.mic.note': ['برای دقت بیشتر در تشخیص گفتار، میکروفون نزدیک‌تر باشد و با آهنگ یکنواخت حرف بزن.', 'For better recognition accuracy, stay close to the microphone and speak at an even pace.'],
    'set.stt.engine': ['موتور تشخیص گفتار', 'Speech recognition engine'],
    'set.stt.engineHint': ['«خودکار»: اول موتور وب زنده؛ بعد سریع‌ترین‌های ابری — Whisper (۲-۳ ثانیه)، گوگل رایگان، GLM و آخر Gemini (دقیق ولی گاهی کند)', '"Auto": live web engine first; then fastest cloud engines — Whisper (2-3s), free Google, GLM, Gemini last (accurate but sometimes slow)'],
    'set.stt.auto': ['خودکار (پیشنهادی)', 'Auto (recommended)'], 'set.stt.web': ['فقط موتور وب گوگل', 'Google web engine only'],
    'set.stt.google': ['فقط گوگل رایگان HTTP (دی‌ان‌اس داخلی شکن — بدون نیاز به تغییر ویندوز)', 'Free Google HTTP only (built-in Shekan DNS bypass — no Windows change)'],
    'set.stt.glm': ['فقط GLM-ASR ابری (نیاز به کلید)', 'Cloud GLM-ASR only (needs key)'],
    'set.stt.lang': ['زبان گفتار', 'Speech language'],
    'set.stt.langHint': ['زبانی که با آن فرمان می‌گویی — تشخیص با همین زبان انجام می‌شود', 'The language you speak commands in — recognition uses it'],
    'set.stt.handsFree': ['حالت بی‌دست (گوش دائمی)', 'Hands-free (always listening)'],
    'set.stt.handsFreeHint': ['آوا همیشه گوش می‌دهد؛ فقط وقتی کلمه «آوا» را بگویی فرمان را اجرا می‌کند — میانبر: Ctrl+Alt+A', 'AVA always listens; say the wake word first to run a command — shortcut: Ctrl+Alt+A'],
    'set.stt.wake': ['کلمه بیدارباش «آوا»', 'Wake word "Ava"'],
    'set.stt.wakeHint': ['در حالت بی‌دست فقط فرمان‌هایی که با «آوا» شروع شوند اجرا می‌شوند — و با همین یک «آوا» حالت گفتگو باز می‌شود: تا مدتی بقیهٔ حرف‌ها بدون تکرار اسم اجرا می‌شوند (مثل سیری)', 'In hands-free only commands starting with "Ava" run — and that one "Ava" opens conversation mode: for a while the rest runs without repeating the name (like Siri)'],
    'set.stt.gkey': ['کلید اختصاصی موتور گفتار گوگل (اختیاری — مربوط به جمنای نیست)', 'Custom Google speech key (optional — not for Gemini)'],
    'set.stt.gkeyHint': ['خالی = کلید رایگان داخلی — فقط اگر با 403 روبه‌رو شدی', 'Empty = built-in free key — only if you hit 403 errors'],
    'set.stt.gkeyPh': ['خالی = رایگان و بدون کلید', 'Empty = free, no key'],
    'set.stt.demo': ['حالت نمایشی (دمو)', 'Demo mode'],
    'set.stt.demoHint': ['اگر موتوری در دسترس نبود، فرمان نمونه اجرا شود — پیش‌فرض: خاموش', 'If no engine is available, run a sample command — default: off'],
    'set.stt.note': ['بلندی صدای میکروفون خودکار نرمال می‌شود، آستانه تشخیص صدا برای هر میکروفون تطبیقی تنظیم می‌شود و اگر موتوری جواب نداد، همان صدا به موتور بعدی فرستاده می‌شود.', 'Microphone loudness is auto-normalized, the voice threshold adapts to your mic, and if one engine fails the same audio is retried on the next engine.'],
    'set.dict.start': ['شروع و پایان', 'Start and stop'],
    'set.dict.startHint': ['بگو «آوا تایپ» تا تایپ شروع شود؛ «آوا تموم» یا «قطع تایپ» تا تمام شود — یا از دکمه پایین', 'Say "Ava type" to start; "Ava done" or "stop typing" to finish — or use the button'],
    /* v0.51 — Push-to-Talk */
    'set.ptt.title': ['دکمهٔ فشاری صحبت (Push-to-Talk)', 'Push-to-Talk button'],
    'set.ptt.hint': ['تا وقتی دکمه را نگه داشته‌ای آوا گوش می‌دهد و به محض رهاکردن، ضبط تمام و فرمان اجرا می‌شود — بدون نیاز به گفتن «آوا» و بدون پرش پنجره. کلید ترکیبی هم قابل تنظیم است.', 'While held, AVA listens; on release the recording ends and the command runs — no wake word and no window stealing. Combos supported.'],
    'set.ptt.hold': ['نگه‌دار و حرف بزن (hold)', 'Hold to talk'],
    'set.ptt.toggle': ['یک بار بزن (toggle)', 'Press once (toggle)'],
    'set.ptt.press': ['کلید دلخواهت را فشار بده…', 'Press your key combo…'],
    'set.ptt.set': ['کلید ذخیره شد:', 'Key saved:'],
    'set.ptt.on': ['دکمهٔ فشاری صحبت روشن شد', 'Push-to-Talk enabled'],
    'set.ptt.off': ['دکمهٔ فشاری صحبت خاموش شد', 'Push-to-Talk disabled'],
    /* v0.66 — پیشنهاد کلید امن + تعارض + وضعیت */
    'set.ptt.presetsTitle': ['کلیدهای پیشنهادی امن (بدون تداخل با ویندوز و برنامه‌های پرکاربرد):', 'Safe suggested keys (no known Windows/app conflicts):'],
    'set.ptt.conflict': ['⚠ تداخل: {x}', '⚠ Conflict: {x}'],
    'set.ptt.noConflict': ['این کلید تداخل شناخته‌شده‌ای ندارد ✓', 'No known conflict for this key ✓'],
    'set.ptt.statusIdle': ['وضعیت: —', 'Status: —'],
    'set.ptt.statusWatcher': ['وضعیت: فعال — نگهبان پایدار آماده است', 'Status: active — persistent watcher ready'],
    'set.ptt.statusFallback': ['وضعیت: فعال — فالبک میانبر سراسری (سقف ۳۰ ثانیه)', 'Status: active — global shortcut fallback (30s cap)'],
    'set.ptt.statusOff': ['وضعیت: خاموش — سوییچ بالا را روشن کن', 'Status: off — enable the switch above'],
    /* v0.60 — ثبت کلید PTT: فقط کلیدهای لاتین + تایم‌اوت + راهنمای لغو */
    'set.key.latin': ['کلیدهای لاتین مجازند', 'Only Latin keys are accepted'],
    'set.key.timeout': ['زمان ثبت کلید تمام شد — دوباره امتحان کن', 'Key capture timed out — try again'],
    'set.key.escHint': ['در حال شنیدن کلید… ESC = لغو', 'Listening for a key… ESC = cancel'],
    'set.dict.startBtn': ['شروع تایپ صوتی', 'Start voice typing'],
    'set.dict.target': ['خروجی تایپ', 'Typing output'],
    'set.dict.targetHint': ['«کادر آوا»: متن در آوا نوشته و با دکمه کپی برمی‌دارد؛ «برنامه فعال»: همان‌جا که داری کار می‌کنی تایپ می‌شود (پیست خودکار)', '"AVA box": text is written here with a copy button; "Active app": typed directly into whatever app you use (auto paste)'],
    'set.dict.box': ['کادر تایپ آوا (با کپی)', 'AVA typing box (with copy)'], 'set.dict.apps': ['تایپ مستقیم در برنامه فعال', 'Type directly into active app'],
    'set.dict.custom': ['فرمان‌های صوتی سفارشی', 'Custom voice commands'],
    'set.dict.customHint': ['مثال: عبارت گفتاری «آدرس» → متن «تهران، خیابان …» — یا «خط جدید»، «پاک کردن کلمه آخر»، «پاک کردن همه»', 'Example: spoken phrase "address" → text "…" — or "new line", "delete last word", "clear all"'],
    'set.dict.phPh': ['وقتی گفتم… (مثلاً: آدرس)', 'When I say… (e.g.: address)'],
    'set.dict.valPh': ['این را بنویس / خط جدید / پاک کردن کلمه آخر', 'Write this / new line / delete last word'],
    'set.dict.add': ['افزودن', 'Add'],
    'set.dict.note': ['علائم داخلی: بگو «نقطه»، «کاما»، «علامت سوال»، «علامت تعجب»، «دو نقطه»، «خط تیره»، «پرانتز باز/بسته»، «خط جدید»، «پاک کن».', 'Built-in punctuation (fa): نقطه، کاما، علامت سوال… switch speech language to English for period/comma/new line.'],
    'set.dns.state': ['وضعیت فعلی', 'Current status'],
    'set.dns.stateHint': ['«دی ان اس رو بردار» یا دکمه بازگردانی، همه‌چیز را به حالت خودکار (DHCP) برمی‌گرداند', 'Voice "remove DNS" or the reset button returns everything to automatic (DHCP)'],
    'set.dns.reset': ['بازگردانی خودکار', 'Reset to auto'],
    'set.dns.quick': ['افزودن سریع DNS', 'Quick add DNS'],
    'set.dns.quickHint': ['فرم شیشه‌ای کوچک داخل صفحه اصلی: اسم + دو آی‌پی + فعال‌سازی فوری — با فرمان صوتی «تنظیم دی ان اس جدید» هم باز می‌شود', 'A small glass form right on the home page: name + two IPs + instant apply — also opens with the "new DNS" voice command'],
    'set.dns.quickBtn': ['فرم DNS جدید', 'New DNS form'],
    'set.dns.namePh': ['اسم DNS (مثلاً: الکترو، کاری‌ام، …)', 'DNS name (e.g.: Electro)'],
    'set.dns.p1Ph': ['DNS اول (Preferred) — 78.157.42.100', 'Preferred DNS — 78.157.42.100'],
    'set.dns.p2Ph': ['DNS دوم (Alternate) — اختیاری', 'Alternate DNS — optional'],
    'set.dns.save': ['ذخیره DNS', 'Save DNS'], 'set.dns.cancelEdit': ['لغو ویرایش', 'Cancel editing'],
    'set.dns.builtin': ['DNSهای معروف (یک‌کلیکی)', 'Well-known DNS (one click)'],
    'set.dns.builtinHint': ['برای افزودن به فهرست‌ت کلیک کن — فعال‌سازی با دکمه «فعال‌سازی»', 'Click to add to your list — activate with the "Activate" button'],
    'set.dns.mine': ['فهرست DNSهای من', 'My DNS list'],
    'set.dns.mineHint': ['بدون محدودیت — فعال‌سازی، ویرایش و حذف', 'Unlimited — activate, edit and delete'],
    'set.dns.note': ['فرمان صوتی: «دی ان اس الکترو» یا «دی اناس شکن» → مستقیم اعمال می‌شود؛ «دی ان اس شماره ۱» → پروفایل اول تو؛ «تنظیم دی ان اس جدید» → فرم شیشه‌ای. اعمال DNS پنجره تأیید مدیر (UAC) ویندوز را باز می‌کند.', 'Voice: "DNS Electro" applies directly; "DNS number 1" → your first profile; "new DNS" → glass form. Applying DNS opens the Windows UAC prompt.'],
    'set.voice.tts': ['پاسخ گفتاری (TTS)', 'Spoken replies (TTS)'], 'set.voice.ttsHint': ['آوا جواب‌ها را با صدای بلند بخواند', 'AVA reads replies out loud'],
    'set.voice.sel': ['صدای گوینده', 'Voice'], 'set.voice.selHint': ['اگر صدای فارسی نصب نباشد، از Settings › Time & Language › Speech اضافه کن', 'If no Persian voice is installed, add one from Settings › Time & Language › Speech'],
    'set.ai.nokey': ['اتصال بدون کلید API', 'Connect without API key'],
    'set.ai.nokeyHint': ['از صفحه «چت با هوش مصنوعی» › تب «صفحه چت GLM» یک بار وارد حسابت شو — پیام‌ها مستقیم به چت حسابت می‌روند و جوابش برمی‌گردد', 'From the chat page › "GLM chat" tab, sign in once — messages go straight to your account chat and the answer comes back'],
    'set.ai.login': ['ورود به حساب GLM', 'Sign in to GLM'],
    'set.ai.key': ['کلید API GLM (اختیاری)', 'GLM API key (optional)'],
    'set.ai.keyHint': ['فقط اگر کلید داشته باشی — بدون آن هم چت از نشست حساب کار می‌کند. چند کلید؟ با ویرگول جدا کن (چرخش خودکار)', 'Only if you have a key — chat works via your account session without it. Multiple keys: comma separated (auto rotation)'],
    'set.ai.keyPh': ['اختیاری — مثل: 1a2b3c…', 'Optional — e.g.: 1a2b3c…'], 'set.ai.show': ['نمایش', 'Show'],
    'set.ai.model': ['مدل گفتگو (با کلید API)', 'Chat model (with API key)'],
    'set.ai.modelHint': ['فلاش رایگان است؛ ۴.۶ هوشمندتر است', 'Flash is free; 4.6 is smarter'],
    'set.ai.note': ['سوالات پیچیده‌ای که فرمان نباشند، خودکار به GLM می‌روند و جواب تحلیلی می‌گیری؛ فرمان جدید هم با تأیید تو ساخته می‌شود.', 'Complex questions that are not commands go to GLM automatically for an analytical answer; new commands are built with your confirmation.'],
    'set.app.lang': ['زبان برنامه / App language', 'App language / زبان برنامه'],
    /* v0.66 — نرم‌افزارهای من (اسکن یک‌بارهٔ سیستم) */
    'set.app.appsTitle': ['نرم‌افزارهای شناسایی‌شده', 'Detected apps'],
    'set.app.appsHint': ['اسکن خودکار یک‌باره در شروع: منوی استارت + استور ویندوز + Steam + رجیستری ویندوز — پایهٔ «باز کن X»، پلیرهای ویدیو و چک‌لیست افزونه‌ها', 'One-time auto scan at boot: Start Menu + Windows Store + Steam + Windows registry — powers open-app, video players and extension checklists'],
    'set.app.appsRescan': ['اسکن مجدد', 'Re-scan'],
    'set.app.appsDone': ['اسکن کامل شد — {x} برنامه شناسایی شد', 'Scan finished — {x} apps detected'],
    'set.app.appsFail': ['اسکن انجام نشد — دوباره امتحان کن', 'Scan failed — try again'],
    /* v0.66 — اکستنشن پیام‌رسانی + VPN */
    'set.ext.msg': ['پیام‌دادن صوتی (تلگرام/واتساپ/بله/روبیکا/دیسکورد)', 'Voice messaging (Telegram/WhatsApp/Bale/Rubika/Discord)'],
    'set.ext.msgHint': ['«به علی در تلگرام پیام بده که سلام» — چت باز و متن آماده می‌شود. نصب‌شده‌ها از اسکن سیستم:', '"message Ali on Telegram saying hi" — opens the chat with your text ready. Installed apps come from the system scan:'],
    'set.ext.ctTitle': ['مخاطبین پیام‌رسان', 'Messenger contacts'],
    'set.ext.ctHint': ['«به علی پیام بده که…» با مخاطبِ ثبت‌شده دقیق‌تر می‌شود — یوزرنیم تلگرام، شمارهٔ واتساپ و…', '"message Ali…" gets precise with saved contacts — Telegram username, WhatsApp number, etc.'],
    'set.ext.ctAdd': ['افزودن', 'Add'],
    'set.ext.vpn': ['VPN و تونل اپ‌محور', 'VPN & per-app tunneling'],
    'set.ext.vpnHint': ['تشخیص VPN فعال (آداپتور/کلاینت/پورت پروکسی) — مرحلهٔ بعد: مسیریابی هر برنامه از داخل یا خارج تونل', 'Detect active VPN (adapter/client/proxy port) — next step: route any app in or out of the tunnel'],
    'set.ext.vpnDetect': ['تشخیص VPN', 'Detect VPN'],
    'set.app.langHint': ['کل رابط کاربری و پاسخ‌های آوا به این زبان نشان داده می‌شود', 'The whole UI and AVA replies are shown in this language'],
    'set.app.fa': ['فارسی', 'فارسی'], 'set.app.en': ['English', 'English'],
    'set.app.theme': ['تم ظاهری', 'Appearance theme'],
    'set.app.themeHint': ['تیره زمردی یا روشن بنفش/کهربایی — از دکمه خورشید/ماه نوار بالا هم عوض می‌شود', 'Dark emerald or light violet/amber — also via the sun/moon button in the title bar'],
    'set.app.dark': ['تیره (زمردی)', 'Dark (emerald)'], 'set.app.light': ['روشن (بنفش و کهربایی)', 'Light (violet & amber)'],
    'set.app.lite': ['سبک روشن (سیستم ضعیف)', 'Lite light (weak PC)'], 'set.app.darklite': ['سبک تیره (سیستم ضعیف)', 'Lite dark (weak PC)'],
    'set.app.safe': ['حالت امن (اگر برنامه درست کار نمی‌کند)', 'Safe mode (if the app misbehaves)'],
    'set.app.safeHint': ['افکت‌های سنگین (شیشه، گرادیان، انیمیشن) خاموش می‌شوند تا روی هر سیستمی برنامه سالم کار کند', 'Heavy effects (glass, gradients, animation) turn off so the app works on any system'],
    'set.app.errCopy': ['گزارش خطاها', 'Error report'],
    'set.app.errCopyHint': ['اگر چیزی کار نمی‌کند، این دکمه گزارش کامل خطاها را کپی می‌کند تا بفرستی', 'If something is broken, this copies the full error report so you can send it'],
    'set.app.errCopyBtn': ['کپی گزارش', 'Copy report'],
    'toast.safeOn': ['حالت امن روشن است — افکت‌های سنگین خاموش', 'Safe mode is on — heavy effects disabled'],
    'toast.safeOff': ['حالت امن خاموش شد', 'Safe mode off'],
    'toast.safeAuto': ['چند خطا دیدم — خودکار حالت امن روشن شد', 'Errors detected — safe mode auto-enabled'],
    'set.app.top': ['همیشه روی همه پنجره‌ها', 'Always on top'], 'set.app.topHint': ['پنجره آوا روی برنامه‌های دیگر باقی بماند', 'Keep the AVA window above other apps'],
    'set.app.login': ['اجرای خودکار با ویندوز', 'Start with Windows'], 'set.app.loginHint': ['آوا هنگام روشن شدن سیستم بالا بیاید', 'Launch AVA when the system boots'],
    'set.app.links': ['پیوندها', 'Links'], 'set.app.linksHint': ['ریپو و دانلود آخرین نسخه در مرورگر باز می‌شود', 'Opens the repo and the latest download in your browser'],
    'set.app.repo': ['ریپوی گیت‌هاب', 'GitHub repo'], 'set.app.dl': ['دانلود آخرین نسخه', 'Download latest'],
    'set.upd.auto': ['بررسی خودکار هنگام شروع', 'Auto check on startup'],
    'set.upd.autoHint': ['۱۲ ثانیه بعد از باز شدن برنامه، نسخه جدید چک شود', 'Check for a new version 12 seconds after launch'],
    'set.upd.check': ['بررسی نسخه جدید', 'Check for updates'], 'set.upd.install': ['نصب و راه‌اندازی مجدد', 'Install and restart'],
    'set.upd.manualDl': ['دانلود مستقیم نصّاب', 'Download installer directly'],
    'set.upd.download': ['دانلود نسخه جدید', 'Download the new version'], 'set.upd.pause': ['توقف', 'Pause'], 'set.upd.resume': ['ادامه دانلود', 'Resume download'], 'set.upd.cancel': ['لغو', 'Cancel'],
    'set.upd.note': ['بررسی خودکار انجام می‌شود، ولی دانلود فقط وقتی که خودت بخواهی: هر وقت خواستی «دانلود نسخه جدید» را بزن، هر وقت خواستی «توقف» یا «لغو» کن — فقط بخش‌های تغییرکرده دانلود می‌شود (آپدیت دلتا) و نصب هم با یک کلیک.', 'Auto-check runs by itself, but downloading only when you want: hit “Download new version” whenever you like — pause or cancel anytime. Only changed parts are downloaded (delta update) and install is one click.'],
    'hist.title': ['تاریخچه فرمان‌ها', 'Command history'], 'hist.recent': ['فرمان‌های اخیر', 'Recent commands'],
    'hist.recentHint': ['روی هر فرمان بزنی دوباره اجرا می‌شود', 'Click any command to run it again'], 'hist.clear': ['پاک‌سازی', 'Clear'],
    'hist.empty': ['هنوز فرمانی اجرا نکردی — یکی از فرمان‌های سریع را امتحان کن یا با میکروفون حرف بزن.', 'No commands yet — try a suggestion or speak into the microphone.'],
    'dict.title': ['تایپ صوتی', 'Voice typing'], 'dict.text': ['متن تایپ‌شده', 'Typed text'],
    'dict.textHint': ['هر چه بگویی اینجا نوشته می‌شود؛ علائم را هم با صدا بگو (نقطه، کاما، علامت سوال…)', 'Whatever you say is written here; speak punctuation out loud (period, comma…)'],
    'dict.startBtn': ['شروع تایپ صوتی', 'Start voice typing'],
    'dict.ph': ['متن اینجا تایپ می‌شود… بگو «آوا تایپ» تا شروع کنم، و «آوا تموم» یا «قطع تایپ» تا تمام کنم.', 'Text appears here… say the typing command to start.'],
    'dict.copy': ['کپی متن', 'Copy text'], 'dict.clear': ['پاک کردن', 'Clear'],
    'dict.note': ['پایان تایپ: «آوا تموم» یا «قطع تایپ». محل خروجی (کادر آوا یا برنامه فعال) را از تنظیمات › تایپ صوتی عوض کن. فرمان‌های صوتی دلخواهت را هم همان‌جا تعریف کن.', 'Stop typing with the stop command; change the output target and custom commands in Settings › Voice typing.'],
    'chat.title': ['چت با هوش مصنوعی', 'AI chat'], 'chat.quick': ['چت سریع آوا', 'AVA quick chat'], 'chat.zai': ['صفحه چت GLM (z.ai)', 'GLM chat (z.ai)'],
    'chat.ph': ['پیامت را بنویس… مثلاً: چطور حافظه رم رو بهینه کنم؟', 'Write your message… e.g.: how do I optimize RAM?'],
    'chat.zaiHint': ['یک بار وارد حسابت شو — نشست ذخیره می‌ماند و «چت سریع» و دستیار صوتی هم بدون کلید API به همین حساب وصل می‌شوند.', 'Sign in once — the session is kept and quick chat + the voice assistant connect to the same account without an API key.'],
    'chat.note': ['آوا سوالات پیچیده را خودش از GLM می‌پرسد و جواب می‌دهد؛ فرمان‌های جدید هم با تأیید تو ساخته و اضافه می‌شوند.', 'AVA asks GLM complex questions for you; new commands are created with your confirmation.'],
    'sb.micReady': ['میکروفون: آماده', 'Mic: ready'],
    'cf.run': ['اجرا', 'Run'], 'cf.skip': ['بی‌خیال', 'Skip'],
    'dnsq.title': ['DNS جدید', 'New DNS'], 'dnsq.sub': ['فقط اسم و دو آی‌پی — همین!', 'Just a name and two IPs — that is it!'],
    'dnsq.name': ['اسم DNS', 'DNS name'], 'dnsq.namePh': ['مثلاً: الکترو', 'e.g.: Electro'],
    'dnsq.p1': ['DNS اول (Preferred)', 'Preferred DNS'], 'dnsq.p1Ph': ['78.157.42.100', '78.157.42.100'],
    'dnsq.p2': ['DNS دوم (Alternate) — اختیاری', 'Alternate DNS — optional'], 'dnsq.p2Ph': ['78.157.42.101', '78.157.42.101'],
    'dnsq.apply': ['بعد از ذخیره، همین حالا روی ویندوز اعمال شود (UAC)', 'Apply to Windows right after saving (UAC)'],
    'dnsq.save': ['ذخیره (Enter)', 'Save (Enter)'], 'dnsq.cancel': ['کنسل', 'Cancel'],
    'about.desc': ['آوا؛ دستیار صوتی فارسی تو — گفتار، فرمان، موزیک، یادآوری و هوش مصنوعی. کلید پوش-تو-تاک قابل تنظیم در تنظیمات.', 'AVA — your Persian voice assistant: speech, commands, music, reminders and AI. The push-to-talk key is configurable in Settings.'],
    'about.listen': ['گوش دادن', 'Listen'], 'about.cmd': ['کادر فرمان', 'Command box'], 'about.esc': ['بستن / لغو', 'Close / Cancel'],

    /* --- دینامیک --- */
    'status.idle': ['برای شروع، اورب را لمس کن یا کلید {combo}', 'Tap the orb or press {combo} to start'], /* v0.60 — {combo} = کلید واقعی PTT از تنظیمات (فالبک: Ctrl+Shift+Space) */
    'status.listening': ['در حال گوش دادن… فرمانت را بگو', 'Listening… say your command'],
    'status.googleListen': ['در حال گوش دادن (گوگل)… فرمانت را بگو', 'Listening (Google)… say your command'],
    'status.heard': ['شنیدم: «{x}»', 'Heard: "{x}"'],
    'status.googleHeard': ['شنیدم… بعد از سکوت، گوگل تبدیلش می‌کند', 'Heard you… after you pause, Google transcribes it'],
    'status.googleConv': ['در حال تبدیل گفتار با گوگل…', 'Transcribing with Google…'],
    'status.silence': ['صدایی نشنیدم؛ دوباره امتحان کن', 'I did not catch any sound; try again'],
    'status.done': ['انجام شد', 'Done'], 'status.working': ['در حال انجام…', 'Working…'],
    'status.noSound': ['صدایی دریافت نشد — کمی بلندتر حرف بزن', 'No sound received — speak a bit louder'],
    'mic.active': ['میکروفون فعال است — با حرف زدن، میله‌ها بالا و پایین می‌شوند', 'Microphone is live — bars move as you speak'],
    'mic.on': ['میکروفون: فعال', 'Mic: active'], 'mic.ready': ['میکروفون: آماده', 'Mic: ready'],
    'mic.rec': ['میکروفون: در حال ضبط', 'Mic: recording'], 'mic.off': ['میکروفون: خاموش', 'Mic: off'],
    'mic.noAccess': ['میکروفون: بدون دسترسی', 'Mic: no access'],
    'eng.web': ['موتور: وب گوگل (دقیق‌ترین) — فالبک خودکار', 'Engine: Google web (best) — auto fallback'],
    'eng.google': ['موتور: گوگل رایگان', 'Engine: free Google'], 'eng.glm': ['موتور: GLM-ASR ابری', 'Engine: cloud GLM-ASR'],
    /* v0.17 — موتورهای کلاس AI */
    'eng.gemini': ['موتور: Gemini Audio (دقت AI)', 'Engine: Gemini Audio (AI-grade)'], 'eng.whisper': ['موتور: Whisper (سریع)', 'Engine: Whisper (fast)'],
    /* v0.27 — موتور آفلاین همیشه-کار */
    'eng.local': ['موتور: آفلاین داخلی — بدون اینترنت', 'Engine: built-in offline — no internet'],
    'set.stt.local': ['فقط موتور آفلاین داخلی — بدون اینترنت، همیشه کار می‌کند', 'Built-in offline engine only — no internet, always works'],
    'set.off.title': ['صدای آفلاین — همیشه کار می‌کند', 'Offline voice — always works'],
    'set.off.desc': ['این بسته صدای تو را کاملاً داخل ویندوز تبدیل می‌کند: بدون اینترنت، بدون فیلترینگ، بدون کلید، بدون DNS. یک بار دانلود کن و برای همیشه خیالت راحت باشد.', 'This pack converts your speech entirely inside Windows: no internet, no filtering, no keys, no DNS. Download once and never worry again.'],
    'set.off.dl': ['دانلود و نصب بستهٔ آفلاین (~۲۱۰MB)', 'Download & install offline pack (~210 MB)'],
    'set.off.progress': ['در حال دانلود… {x}٪', 'Downloading… {x}%'],
    'set.off.extract': ['در حال نصب…', 'Installing…'],
    'set.off.ready': ['بستهٔ آفلاین نصب و آماده است — حتی بدون اینترنت می‌شنوم', 'Offline pack installed and ready — I hear you even offline'],
    'set.off.done': ['نصب شد! از این به بعد حتی بدون اینترنت هم صدایت را می‌شنوم', 'Installed! I can now hear you even with no internet at all'],
    'set.off.fail': ['دانلود ناموفق بود — دوباره امتحان کن', 'Download failed — please try again'],
    'set.off.getHint': ['اگر موتورهای ابری روی شبکهٔ تو محدود هستند، این بسته راه‌حل قطعی است', 'If cloud engines are limited on your network, this pack is the definitive fix'],
    'stt.noPackHint': ['هیچ موتوری جواب نداد — بستهٔ آفلاین را از تنظیمات › تشخیص گفتار نصب کن تا بدون اینترنت هم کار کند', 'No engine answered — install the offline pack (Settings › Speech) to work with no internet'],
    'stt.tryGemini': ['تبدیل صدا با جمنای…', 'Transcribing with Gemini…'],
    'stt.tryWhisper': ['تبدیل صدا با Whisper…', 'Transcribing with Whisper…'],
    'set.stt.gemini': ['فقط Gemini Audio — دقیق ولی روی بعضی شبکه‌ها کند (کلید جمنای)', 'Gemini Audio only — accurate but can be slow on some networks (Gemini key)'],
    'set.stt.whisper': ['فقط Whisper — سریع (Groq/OpenAI)', 'Whisper only — fastest (Groq/OpenAI)'],
    'set.stt.wbase': ['آدرس سرور Whisper (سازگار با OpenAI)', 'Whisper server base URL (OpenAI-compatible)'],
    'set.stt.wbaseHint': ['پیش‌فرض: Groq — whisper-large-v3-turbo رایگان و بسیار سریع است؛ آدرس OpenAI یا سرور محلی whisper.cpp هم می‌گذاری', 'Default Groq — free whisper-large-v3-turbo; OpenAI or a local whisper.cpp server URL also works'],
    'set.stt.wkey': ['کلید Whisper', 'Whisper API key'],
    'set.stt.wkeyHint': ['کلید رایگان از console.groq.com بگیر — سریع‌ترین ترنسکریپتی که تا حالا تجربه می‌کنی', 'Grab a free key at console.groq.com — the fastest transcription you have ever tried'],
    'set.stt.wkeyPh': ['gsk_…', 'gsk_…'],
    'set.stt.wmodel': ['مدل Whisper', 'Whisper model'],
    'set.stt.wmodelHint': ['whisper-large-v3-turbo (پیش‌فرض)، whisper-large-v3 یا هر مدلی که سرورت پشتیبانی کند', 'whisper-large-v3-turbo (default), whisper-large-v3, or any model your server supports'],
    'set.ai.noKeyWarn': ['مدل جمنای ذخیره شده ولی کلید نداری — بدون کلید، جمنای نه در چت جواب می‌دهد نه در تشخیص گفتار؛ موتور بعدی (GLM) جایگزین می‌شود.', 'A Gemini model is saved but there is no key — without a key Gemini answers nothing in chat or speech; GLM takes over.'],
    'eng.demo': ['موتور: حالت دمو', 'Engine: demo mode'], 'eng.none': ['موتور: تنظیم نشده', 'Engine: not set'],
    'tag.ready': ['آماده', 'Ready'], 'tag.working': ['در حال انجام…', 'Working…'], 'tag.done': ['اجرا شد', 'Ran'], 'tag.fail': ['اجرا نشد', 'Failed'],
    'tag.reply': ['پاسخ آوا', 'AVA reply'], 'tag.custom': ['فرمان سفارشی', 'Custom command'], 'tag.demo': ['شبیه‌سازی دمو', 'Demo simulation'],
    'tag.ai': ['هوش مصنوعی', 'AI'], 'tag.aiCmd': ['هوش مصنوعی + فرمان جدید', 'AI + new command'],
    'tag.heard': ['شنیدم', 'Heard'],
    'tag.aiDo': ['هوش مصنوعی · اجرا شد', 'AI · executed'],
    'default.reply': ['این فرمان را هنوز یاد نگرفتم. اتصال هوش مصنوعی را برقرار کن (تب «صفحه چت GLM» › ورود به حسابت) تا هر سوال و فرمانی را همان‌جا تحلیل کنم و یاد بگیرم!', 'I have not learned this command yet. Connect the AI (GLM chat tab › sign in) and I will analyze anything you ask there!'],
    'cmd.fail': ['یه خطای داخلی موقع اجرای این فرمان پیش آمد؛ دوباره امتحان کن. اگر تکرار شد، از تنظیمات › برنامه › گزارش خطاها بفرست.', 'An internal error happened while running that command; please try again. If it repeats, send the error report from Settings › App.'],
    'cmd.busy': ['یک لحظه صبر کن — هنوز دارم فرمان قبلی‌ات را انجام می‌دهم.', 'One moment — I am still finishing your previous command.'], /* v0.47 B02 */
    'toast.shortcutFail': ['برخی میانبرهای کیبورد آوا ثبت نشدند — کلیدها اشغال است؛ می‌توانید از دکمهٔ میکروفون استفاده کنید. خودکار دوباره تلاش می‌شود.', 'Some AVA keyboard shortcuts could not be registered — keys are occupied; use the mic button instead. AVA will retry automatically.'], /* v0.47 B13 */
    'learn.uiTitle': ['چیزهایی که آوا یاد گرفته', 'Things AVA has learned'],
    'learn.uiHint': ['وقتی هوش مصنوعی درخواستی را درست انجام دهد، آوا همان را یاد می‌گیرد و دفعهٔ بعد بدون اینترنت اجرا می‌کند — اگر راضی نبودی همان را تکرار کن تا اصلاح کند', 'When the AI fulfills a request, AVA learns it and replays it offline next time — repeat the request if unsatisfied and AVA will revise the learning'],
    'learn.uiClear': ['پاک کردن همه', 'Forget all'],
    'learn.uiEmpty': ['هنوز چیزی یاد نگرفته — بگذار هوش مصنوعی چند درخواست را انجام دهد', 'Nothing learned yet — let the AI fulfill a few requests'],
    'learn.uiForget': ['فراموش کن', 'Forget'],
    'learn.uiUsed': ['اجراشده ({n} بار)', 'used ({n} times)'],
    'learn.uiUnstable': ['ناپایدار — فقط هوش مصنوعی تصمیم می‌گیرد', 'unstable — AI decides every time'],
    'learn.tag': ['⚡ یادگرفته · بدون اینترنت', '⚡ learned · offline'],
    /* v0.48 — گزارش خودکار به گیت‌هاب (تله‌متری) */
    'suggest.say': ['بگو', 'Say'],
    'toast.welcome': ['آوا آماده است — اجرای واقعی فرمان‌ها فعال است', 'AVA is ready — real command execution is on'],
    'toast.preview': ['آوا آماده است — پیش‌نمایش رابط کاربری', 'AVA is ready — UI preview'],
    'toast.micChanged': ['ورودی میکروفون عوض شد', 'Microphone input changed'],
    'toast.onlyApp': ['این گزینه فقط داخل نرم‌افزار ویندوزی کار می‌کند', 'This only works inside the Windows app'],
    'toast.keySaved': ['کلید ذخیره شد — تشخیص گفتار ابری و چت فعال شد', 'Key saved — cloud STT and chat are enabled'],
    'toast.keyCleared': ['کلید پاک شد', 'Key cleared'],
    'toast.gKeySaved': ['کلید اختصاصی گوگل ذخیره شد', 'Custom Google key saved'],
    'toast.gKeyCleared': ['کلید پاک شد — استفاده از کلید رایگان داخلی', 'Key cleared — using the built-in free key'],
    'toast.demoOn': ['حالت دمو روشن شد', 'Demo mode on'], 'toast.demoOff': ['حالت دمو خاموش شد — تشخیص واقعی یا پیام خطا', 'Demo mode off — real recognition or error messages'],
    'toast.autoOn': ['بررسی خودکار فعال شد', 'Auto check enabled'], 'toast.autoOff': ['بررسی خودکار خاموش شد', 'Auto check disabled'],
    'toast.langChanged': ['زبان برنامه عوض شد', 'App language changed'],
    'toast.themeLight': ['تم روشن فعال شد', 'Light theme on'], 'toast.themeDark': ['تم تیره فعال شد', 'Dark theme on'],
    'toast.themeDarkLite': ['تم تیرهٔ سبک فعال شد — مخصوص سیستم ضعیف', 'Flat dark theme on — made for weak PCs'],
    'toast.dnsqSaved': ['DNS «{x}» ذخیره شد', 'DNS "{x}" saved'],
    'toast.dnsApplyUac': ['پنجره تأیید مدیر (UAC) ویندوز را تأیید کن', 'Confirm the Windows UAC prompt'],
    'toast.dnsResetUac': ['برای بازگردانی DNS به حالت خودکار، UAC را تأیید کن', 'Confirm UAC to reset DNS to automatic'],
    'toast.dnsResetOk': ['DNS به حالت خودکار برگشت', 'DNS reset to automatic'],
    'toast.dnsResetFail': ['ریست نشد: {x}', 'Reset failed: {x}'],
    'toast.dnsDel': ['DNS «{x}» حذف شد', 'DNS "{x}" deleted'],
    'toast.dnsExists': ['«{x}» از قبل در فهرست تو هست', '"{x}" is already in your list'],
    'toast.dnsAdded': ['«{x}» اضافه شد — با دکمه فعال‌سازی اعمالش کن', '"{x}" added — activate it with the Activate button'],
    'toast.updReady': ['نسخه جدید آماده نصب است — از تنظیمات نصبش کن', 'New version ready — install it from Settings'],
    'toast.updInstalling': ['در حال نصب نسخه جدید… برنامه راه‌اندازی مجدد می‌شود', 'Installing the new version… the app will restart'],
    'toast.histCleared': ['تاریخچه پاک شد', 'History cleared'],
    'toast.hfOn': ['حالت بی‌دست روشن شد — بگو «آوا …»', 'Hands-free on — say "Ava …"'], 'toast.hfOff': ['حالت بی‌دست خاموش شد', 'Hands-free off'],
    'toast.wakeOn': ['کلمه بیدارباش «آوا» فعال است', 'Wake word "Ava" is active'],
    'toast.wakeOff': ['هر گفتاری بدون کلمه بیدارباش اجرا می‌شود — مراقب سوءتفاهم باش!', 'Everything you say runs without a wake word — watch for false triggers!'],
    'toast.dictTargetBox': ['خروجی: کادر تایپ آوا', 'Output: AVA typing box'],
    'toast.dictTargetApps': ['خروجی: تایپ مستقیم در برنامه فعال (کلیپ‌بورد موقتاً عوض می‌شود)', 'Output: typing directly into the active app (clipboard is temporarily replaced)'],
    'toast.typingCmdDel': ['فرمان تایپ حذف شد', 'Typing command removed'],
    'toast.typingCmdNeed': ['هم عبارت گفتاری و هم عمل لازم است', 'Both the spoken phrase and the action are required'],
    'toast.typingCmdAdded': ['از این به بعد «{x}» → همان عمل انجام می‌شود', 'From now on "{x}" → that action runs'],
    'toast.cmdDeleted': ['فرمان «{x}» حذف شد', 'Command "{x}" deleted'],
    'toast.cmdAdded': ['فرمان «{x}» به لیست اضافه شد', 'Command "{x}" added to the list'],
    'toast.copied': ['متن کپی شد ✓', 'Text copied ✓'], 'toast.copyFail': ['کپی ممکن نشد — خودت انتخاب و کپی کن', 'Copy failed — select and copy manually'],
    'toast.noCopyText': ['متنی برای کپی نیست', 'Nothing to copy'], 'toast.boxCleared': ['کادر تایپ پاک شد', 'Box cleared'],
    /* v0.60 — توست‌های فارسیِ هاردکد → دیکشنری (دوزبانه) */
    'toast.electronOnly': ['این دکمه فقط داخل نرم‌افزار الکترون واقعی کار می‌کند', 'This button only works inside the real Electron app'],
    'toast.discOnly': ['کنترل دیسکورد فقط داخل نرم‌افزار ویندوزی کار می‌کند', 'Discord control only works inside the Windows app'],
    'toast.winOnly': ['فقط داخل نرم‌افزار ویندوزی کار می‌کند', 'Only works inside the Windows app'],
    'toast.updOnlyApp': ['آپدیت خودکار فقط داخل نرم‌افزار ویندوزی کار می‌کند', 'Auto update only works inside the Windows app'],
    'toast.linkFail': ['باز کردن لینک ممکن نشد', 'Could not open the link'],
    'toast.locked': ['این بخش در نسخه بعدی اضافه می‌شود', 'Coming in the next version'],
    'tts.on': ['پاسخ گفتاری فعال شد', 'Spoken replies enabled'],
    'dict.on': ['حالت تایپ شروع شد — حرف بزن! پایان: «آوا تموم» یا «قطع تایپ»', 'Voice typing started — speak! Say the stop command to finish'],
    'dict.onSpeak': ['حالت تایپ شروع شد. حرف بزن؛ هر وقت خواستی بگو آوا تموم.', 'Voice typing started. Speak; say the stop command whenever you want.'],
    'dict.off': ['حالت تایپ پایان یافت', 'Voice typing ended'], 'dict.offVoice': ['تایپ صوتی تمام شد — متن آماده کپی است', 'Voice typing finished — text is ready to copy'],
    'dict.offSilent': ['تایپ صوتی متوقف شد', 'Voice typing stopped'], 'dict.stopSpoken': ['تایپ تمام شد.', 'Typing finished.'],
    'dict.statusOff': ['تایپ صوتی خاموش است — بگو «آوا تایپ» یا دکمه را بزن', 'Voice typing is off — say the start command or press the button'],
    'dict.statusOn': ['حالا حرف بزن — هر چیزی بگویی تایپ می‌شود ({x} نویسه)', 'Now speak — everything you say gets typed ({x} chars)'],
    'dns.applyOk': ['DNS «{x}» فعال شد: {y}. کش شبکه هم پاک شد.', 'DNS "{x}" is now active: {y}. The network cache was flushed too.'],
    'dns.applyFail': ['اعمال DNS ممکن نشد.', 'Applying the DNS failed.'],
    'dns.onlyApp': ['تغییر DNS فقط داخل نرم‌افزار ویندوزی کار می‌کند', 'Changing DNS only works inside the Windows app'],
    'dns.openedForm': ['فرم «DNS جدید» باز شد — اسم و دو آی‌پی را وارد کن و اینتر بزن.', 'The "New DNS" form is open — enter a name and two IPs, then press Enter.'],
    'dns.managerOpened': ['مدیریت DNS باز شد — فعلاً این DNSها فعال‌اند.', 'The DNS manager is open — these DNS servers are active right now.'],
    'dns.knownFound': ['«{x}» را پیدا کردم و در فهرست DNSهایت ثبتش کردم ({y}) — هر وقت خواستی بگو «دی ان اس {x}» تا فعالش کنم.', 'Found "{x}" and saved it to your list ({y}) — say "DNS {x}" anytime to activate it.'],
    'dns.notFound': ['«{x}» را در فهرست DNSهای معروف پیدا نکردم — صفحه افزودن باز شد؛ آی‌پی‌هایش را دستی وارد کن.', 'Could not find "{x}" among well-known DNS — the add form is open; enter its IPs manually.'],
    'dns.numMissing': ['پروفایل شماره {x} هنوز تعریف نشده — لیست DNSهای تو باز شد.', 'Profile number {x} does not exist yet — your DNS list is open.'],
    'dns.resetOk': ['DNS به حالت خودکار ویندوز برگشت.', 'DNS is back to Windows automatic.'],
    'dns.resetFail': ['ریست DNS ممکن نشد: {x}', 'DNS reset failed: {x}'],
    'dns.resetOnlyApp': ['ریست DNS فقط داخل نرم‌افزار ویندوزی کار می‌کند.', 'DNS reset only works inside the Windows app.'],
    'dns.dnsWork': ['در حال کار روی DNS…', 'Working on DNS…'], 'dns.dnsDone': ['انجام شد', 'Done'], 'dns.dnsFail': ['کار روی DNS ممکن نشد', 'Working on DNS failed'],
    'pow.sleepDone': ['سیستم به حالت خواب رفت؛ بدرود!', 'The system went to sleep; bye!'],
    'pow.shutdownSoon': ['کامپیوتر تا ۱۰ ثانیه دیگر خاموش می‌شود! برای لغو بگو «لغو خاموش شدن».', 'The PC will shut down in 10 seconds! Say "cancel shutdown" to abort.'],
    'pow.restartSoon': ['کامپیوتر تا ۱۰ ثانیه دیگر ری‌استارت می‌شود! برای لغو بگو «لغو خاموش شدن».', 'The PC will restart in 10 seconds! Say "cancel shutdown" to abort.'],
    'pow.abortDone': ['خاموش شدن لغو شد — برگشتیم!', 'Shutdown aborted — welcome back!'],
    'pow.abortNothing': ['خاموش شدن زمان‌داری در جریان نبود.', 'No scheduled shutdown was running.'],
    'pow.monitorOff': ['مانیتور خاموش شد — هر کلیدی بزنی روشن می‌شود.', 'Monitor is off — press any key to wake it.'],
    'pow.confirmShutdown': ['خاموش کردن کامپیوتر', 'Shut down the PC'],
    'pow.confirmShutdownText': ['کامپیوتر تا ۱۰ ثانیه دیگر خاموش می‌شود. مطمئنی؟', 'The PC will shut down in 10 seconds. Are you sure?'],
    'pow.confirmRestart': ['راه‌اندازی مجدد', 'Restart'],
    'pow.confirmRestartText': ['کامپیوتر تا ۱۰ ثانیه دیگر ری‌استارت می‌شود. مطمئنی؟', 'The PC will restart in 10 seconds. Are you sure?'],
    'cf.cancelled': ['بی‌خیال؛ اجرا نشد.', 'Skipped; nothing ran.'],
    'ai.asking': ['سوالت را از هوش مصنوعی می‌پرسم…', 'Asking the AI for you…'], 'ai.got': ['جواب آمد', 'Answer arrived'],
    /* v0.65 — نشانگر فکر کردن + یادگیری صریح */
    'ai.thinking': ['آوا داره فکر می‌کنه…', 'Ava is thinking…'],
    'teach.tag': ['📚 یادگرفته', '📚 taught'],
    'teach.status': ['درس یاد گرفتم', 'Lesson learned'],
    'teach.saved': ['یاد گرفتم! از این به بعد هر وقت بگی «{x}» همینو می‌کنم: {y}', 'Got it! From now on, "{x}" means: {y}'],
    'teach.updated': ['به‌روز شد! قانونِ «{x}» الان یعنی: {y}', 'Updated! "{x}" now means: {y}'],
    'teach.bad': ['نتونستم این رو یاد بگیرم — این شکلی بگو: «یاد بگیر وقتی گفتم فلان، یعنی فلان».', "I couldn't learn that — say it like: \"teach me: when I say X, it means Y\"."],
    'teach.forgot': ['فراموش شد ✓ («{x}» از حافظه پاک شد؛ {n} چیز دیگه یادمه)', 'Forgotten ✓ ("{x}" cleared; {n} left)'],
    'teach.notFound': ['توی چیزهایی که یاد گرفتم همچین چیزی نداشتم.', "I don't have that in my learned list."],
    'teach.cleared': ['همه یاد گرفته‌ها پاک شد ✓ ({n} مورد)', 'All learned items cleared ✓ ({n} items)'],
    'teach.list': ['{n} چیز ازت یاد گرفتم:', 'I have learned {n} things from you:'],
    'teach.empty': ['هنوز هیچ چیزی بهم یاد ندادی — بگو «یاد بگیر وقتی گفتم فلان یعنی فلان».', "You haven't taught me anything yet — say \"teach me: when I say X it means Y\"."],
    'ai.fail': ['پاسخی نرسید', 'No answer arrived'], 'ai.noConn': ['اتصال AI برقرار نیست', 'AI connection is down'],
    'ai.err': ['اتصال به هوش مصنوعی برقرار نشد.', 'Could not reach the AI.'],
    'weather.reply': ['آب‌وهوای {city}: {desc}، دما حدود {temp} درجه (احساس واقعی {feels})، رطوبت {hum}٪ و باد {wind} کیلومتر بر ساعت.', 'Weather in {city}: {desc}, around {temp} degrees (feels like {feels}), humidity {hum}% and wind {wind} km/h.'],
    'weather.fail': ['آب‌وهوا الان در دسترس نیست — چند لحظه بعد دوباره بگو.', 'Weather is unavailable right now — try again in a moment.'],
    'weather.onlyApp': ['پیش‌بینی آب‌وهوا فقط داخل نرم‌افزار ویندوزی کار می‌کند.', 'Weather forecast only works inside the Windows app.'],
    'calc.reply': ['{x} می‌شود {y}؛ حساب کردم!', '{x} equals {y} — calculated!'],
    'calc.fail': ['این محاسبه را متوجه نشدم — مثلاً بگو «پنج ضربدر هفت چند میشه» یا «۱۲ به علاوه ۳۰».', 'I did not understand that calculation — try "12 plus 30" or "five times seven".'],
    'timer.on': ['تایمر {x} {y}‌ای فعال شد؛ به‌محض رسیدن وقت خبرت می‌کنم.', 'A {x} {y} timer is set; I will ping you when time is up.'],
    'timer.multi': ['(الان {n} تایمر فعالی)', '({n} timers are now running)'],
    'notes.open': ['یادداشتت ({when}): «{x}»', 'Your note ({when}): "{x}"'],
    'timer.min': ['دقیقه', 'minute(s)'], 'timer.sec': ['ثانیه', 'second(s)'], 'timer.hour': ['ساعت', 'hour(s)'],
    'timer.done': ['زمان تایمر تمام شد!', "Time's up!"], 'timer.doneTag': ['تایمر', 'Timer'],
    'timer.doneReply': ['زمان تمام شد؛ خبرت کردم!', "Time is up — I kept my promise!"], 'timer.doneSpeak': ['زمان تایمر تمام شد؛ خبرت کردم!', "Time is up!"],
    'sys.reply': ['پردازنده حدود {cpu}٪ و رم حدود {ram}٪ درگیر است؛ همه‌چیز خوب کار می‌کند.', 'CPU is around {cpu}% and RAM around {ram}%; everything looks healthy.'],
    'battery.reply': ['باتری {x}٪ است{y}.', 'Battery is at {x}%{y}.'], 'battery.charging': [' و در حال شارژ شدن', ' and charging'],
    'battery.fail': ['خواندن باتری در این محیط ممکن نیست؛ داخل نرم‌افزار ویندوزی امتحان کن.', 'Battery info is unavailable here; try inside the Windows app.'],
    'time.reply': ['الان ساعت {x} است.', "It is {x} right now."], 'date.reply': ['امروز {x} است.', 'Today is {x}.'],
    'rec.on': ['ضبط شروع شد! هر وقت خواستی بگو «توقف ضبط» تا در پوشه Music ذخیره‌اش کنم.', 'Recording started! Say the stop command whenever you want and I will save it to your Music folder.'],
    'rec.busy': ['ضبط از قبل در جریان است؛ بگو «توقف ضبط» تا ذخیره‌اش کنم.', 'A recording is already running; say the stop command to save it.'],
    'rec.noSupport': ['ضبط صدا در این محیط پشتیبانی نمی‌شود.', 'Audio recording is not supported in this environment.'],
    'rec.needMic': ['دسترسی به میکروفون ممکن نشد؛ مجوز میکروفون را در ویندوز بررسی کن.', 'Could not access the microphone; check Windows mic permissions.'],
    'rec.recording': ['در حال ضبط صدایت… برای پایان بگو «توقف ضبط»', 'Recording your voice… say the stop command to finish'],
    'rec.stopNone': ['ضبط فعالی وجود ندارد.', 'There is no active recording.'], 'rec.empty': ['صدایی ضبط نشده بود!', 'Nothing was recorded!'],
    'rec.saved': ['ضبط ذخیره شد در: {x}', 'Recording saved to: {x}'], 'rec.saveFail': ['ذخیره ممکن نشد: {x}', 'Saving failed: {x}'],
    'rec.size': ['ضبط انجام شد ({x} کیلوبایت)؛ ذخیره واقعی فایل فقط داخل نرم‌افزار ویندوزی است.', 'Recorded ({x} KB); real file saving works inside the Windows app.'],
    'rec.startFail': ['شروع ضبط ممکن نشد.', 'Could not start recording.'],
    'chat.welcomeOn': ['سلام! من مغز هوشمند آوا هستم و به حسابت وصل هستم. هر سوال پیچیده‌ای بپرسی جواب می‌دهم و اگر فرمانی بخواهی، خودم می‌سازمش و با تأیید تو به فرمان‌هام اضافه می‌کنم.', 'Hi! I am the AI brain of AVA, connected to your account. Ask me anything complex and if you want a new command, I build it with your confirmation.'],
    'chat.welcomeOff': ['سلام! من مغز هوشمند آوا هستم. برای چت بدون کلید API، برو تب «صفحه چت GLM» و یک بار وارد حسابت شو — بعد اینجا هر سوال و فرمانی بخواهی در خدمتم.', 'Hi! I am the AI brain of AVA. To chat without an API key, open the GLM chat tab and sign in once — then ask me anything.'],
    'chat.thinking': ['دارم فکر می‌کنم…', 'Thinking…'], 'chat.noReply': ['پاسخی نرسید.', 'No answer arrived.'],
    'chat.err': ['اتصال به سرور هوش مصنوعی برقرار نشد.', 'Could not reach the AI server.'],
    'chat.onlyApp': ['چت با هوش مصنوعی فقط داخل نرم‌افزار ویندوزی کار می‌کند (درخواست باید از پروسه اصلی برود).', 'AI chat only works inside the Windows app (requests must go from the main process).'],
    'badge.on': ['اتصال به حساب GLM: فعال ✓', 'GLM account: connected ✓'], 'badge.off': ['بدون کلید API', 'No API key'],
    'badge.needLogin': ['برای اتصال، وارد حسابت شو', 'Sign in to connect'],
    'badge.needLoginChat': ['برای چت، در تب «صفحه چت GLM» وارد حسابت شو', 'Sign in via the GLM chat tab to chat'],
    'zai.loginHint': ['یک بار وارد حسابت شو — بعدش همه‌چیز بدون کلید کار می‌کند', 'Sign in once — everything works without a key afterwards'],
    'upd.checking': ['در حال بررسی نسخه جدید…', 'Checking for a new version…'],
    'upd.available': ['نسخه جدید v{x} پیدا شد — هر وقت خواستی دانلودش کن', 'New version v{x} found — download whenever you like'],
    'upd.downloading': ['در حال دانلود: {x}٪', 'Downloading: {x}%'],
    'upd.downloadingMB': ['در حال دانلود: {x}٪ — {a} از {b} مگابایت{d}', 'Downloading: {x}% — {a} of {b} MB{d}'],
    'upd.delta': [' (فقط تغییرات — دلتا)', ' (delta — changes only)'],
    'upd.paused': ['دانلود در {x}٪ متوقف شد — با «ادامه دانلود» ادامه بده', 'Download paused at {x}% — hit “Resume download” to continue'],
    'upd.canceled': ['دانلود لغو شد — هر وقت خواستی دوباره شروع کن', 'Download cancelled — start again whenever you like'],
    'upd.startDlToast': ['دانلود نسخه {x} شروع شد — می‌توانی هر لحظه توقفش کنی', 'Downloading v{x} — you can pause it anytime'],
    'upd.pauseToast': ['دانلود متوقف شد', 'Download paused'], 'upd.cancelToast': ['دانلود لغو شد', 'Download cancelled'],
    'upd.ready': ['نسخه v{x} آماده نصب است', 'Version v{x} is ready to install'],
    'upd.none': ['آخرین نسخه را داری ✓', 'You are on the latest version ✓'],
    'upd.dev': ['در حالت توسعه (npm start) به‌روزرسان غیرفعال است؛ خروجی نصب‌شده کار می‌کند', 'Updater is disabled in dev mode (npm start); the installed build works'],
    'upd.error': ['خطا در بروزرسانی: {x}', 'Update error: {x}'], 'upd.default': ['اتصال خودکار به GitHub Releases', 'Auto-connects to GitHub Releases'],
    'upd.availableManual': ['نسخه جدید v{x} پیدا شد — دانلود مستقیم ممکن است', 'New version v{x} found — direct download available'],
    'upd.directDlToast': ['در حال دانلود مستقیم نصّاب از GitHub…', 'Downloading the installer directly from GitHub…'],
    'upd.manualFailToast': ['دانلود مستقیم ناموفق بود', 'Direct download failed'],
    'upd.current': ['نسخه فعلی: v{x}', 'Current version: v{x}'],
    'wake.need': ['بگو «آوا …» تا فرمانت را اجرا کنم', 'Say "Ava …" and I will run your command'],
    /* v0.28 — سیری‌وار: با یک «آوا» حالت گفتگو باز می‌شود + صدای بانمک */
    'wake.sessOn': ['حالت گفتگو فعال شد — تا چند لحظهٔ دیگر هر چه بگویید بدون «آوا» اجرا می‌شود', 'Conversation mode on — for the next little while everything runs without saying "Ava"'],
    'wake.sessExp': ['حالت گفتگو تمام شد — برای ادامه دوباره بگو «آوا»', 'Conversation mode ended — say "Ava" again to continue'],
    'wake.dropSpoken': ['اول اسم من را صدا بزن — بگو «آوا» و بعد درخواستت را؛ با همین یک «آوا» حالت گفتگو باز می‌شود', 'Say my name first — say "Ava" and then your request; one "Ava" opens conversation mode'],
    /* v0.27.1 — فرمان بدون «آوا» دیگر بی‌صدا دور ریخته نمی‌شود */
    'wake.dropTag': ['شنیدم — بی‌اجرا', 'Heard — not run'],
    'wake.dropHint': ['فرمانت آماده است ولی اجرا نشد — در حالت بی‌دست اول بگو «آوا» (مثلاً: آوا، کروم رو باز کن)؛ با گفتن «آوا» حالت گفتگو باز می‌شود و تا مدتی بدون تکرار اسم، همه چیز اجرا می‌شود. یا همین حالا با دکمهٔ پایین اجرایش کن.', 'Your command is ready but was not run — in hands-free say "Ava" first (e.g.: Ava, open Chrome); one "Ava" opens conversation mode so for a while everything runs without the name. Or run it now with the button below.'],
    'wake.runNow': ['همین حالا اجرا کن', 'Run it now'],
    'wake.noWake': ['از این به بعد بدون «آوا»', 'From now on without "Ava"'],
    'wake.noWakeDone': ['فیلتر «آوا» خاموش شد — هر چی بگویید اجرا می‌شود', 'Wake filter is off — everything you say will run'],
    'wake.yes': ['بله؟', 'Yes?'],
    'hf.rearm': ['در حال گوش دادن…', 'Listening…'],
    'dns.curReading': ['در حال خواندن DNS فعلی…', 'Reading the current DNS…'],
    'dns.curAuto': ['DNS فعلی: حالت خودکار (DHCP)', 'Current DNS: automatic (DHCP)'],
    'dns.curFail': ['خواندن DNS فعلی ممکن نشد', 'Could not read the current DNS'],
    'dns.curOnlyApp': ['خواندن DNS فعلی فقط داخل نرم‌افزار ویندوزی کار می‌کند', 'Reading the current DNS only works inside the Windows app'],
    'dns.listUpdated': ['فهرست DNS به‌روز شد', 'The DNS list was updated'],
    'dns.empty': ['هنوز DNS ذخیره نکردی — یکی از DNSهای معروف را اضافه کن یا خودت آی‌پی بده. محدودیتی در تعداد نیست.', 'No DNS saved yet — add a well-known one or enter your own IPs. No limit.'],
    'dns.activate': ['فعال‌سازی', 'Activate'], 'dns.edit': ['ویرایش', 'Edit'], 'dns.del': ['حذف', 'Delete'],
    'dns.updated': ['DNS «{x}» به‌روز شد', 'DNS "{x}" updated'],
    'dns.savedHint': ['DNS «{x}» ذخیره شد — بگو «DNS {x}» تا فعالش کنم', 'DNS "{x}" saved — say "DNS {x}" to activate it'],
    'dns.needName': ['اسم DNS را بنویس — بعداً با همان اسم صدا می‌زنی', 'Give the DNS a name — you will call it by that name later'],
    'dns.badIp': ['آی‌پی اول معتبر نیست — مثال: 78.157.42.100', 'The first IP is not valid — e.g.: 78.157.42.100'],
    'dns.badIp2': ['آی‌پی دوم معتبر نیست', 'The second IP is not valid'],
    'dns.saveChanges': ['ذخیره تغییرات', 'Save changes'],
    'stt.webFail': ['موتور وب در دسترس نبود — سوییچ به گوگل…', 'Web engine unavailable — switching to Google…'],
    'stt.noEngine': ['تشخیص گفتار در دسترس نیست — {x}', 'Speech recognition is unavailable — {x}'],
    'stt.noEngineApp': ['موتور گوگل فقط داخل نرم‌افزار فعال است', 'The Google engine only works inside the app'],
    'stt.micMissing': ['میکروفون در دسترس نیست', 'Microphone unavailable'],
    'stt.glmNeedKey': ['کلید GLM تنظیم نشده', 'GLM key is not set'],
    'stt.startFail': ['شروع ضبط ممکن نشد', 'Could not start recording'],
    'stt.googleFail': ['شروع ضبط گوگل ممکن نشد', 'Could not start Google recording'],
    'stt.convFail': ['تبدیل گوگل ممکن نشد: {x}', 'Google transcription failed: {x}'],
    'stt.connFail': ['اتصال به گوگل برقرار نشد — اینترنت/فیلترشکن را چک کن', 'Could not reach Google — check your internet/VPN'],
    'stt.googleEmpty': ['گوگل پاسخی نداد', 'Google returned nothing'],
    'stt.glmListen': ['در حال گوش دادن (GLM-ASR)… فرمانت را بگو', 'Listening (GLM-ASR)… say your command'],
    'stt.glmHeard': ['شنیدم… بعد از سکوت، تبدیلش می‌کنم', 'Heard you… transcribing after the pause'],
    'stt.glmConv': ['در حال تبدیل گفتار به متن با GLM-ASR…', 'Transcribing with GLM-ASR…'],
    'stt.glmFail': ['تبدیل گفتار ممکن نشد: {x}', 'Transcription failed: {x}'],
    'stt.glmConn': ['اتصال به GLM-ASR برقرار نشد', 'Could not reach GLM-ASR'],
    'stt.demoListen': ['حالت دمو: در حال شنیدن…', 'Demo mode: listening…'],
    'stt.demoHint': ['حالت دمو روشن است — برای تشخیص واقعی، کلید GLM را در تنظیمات بگذار', 'Demo mode is on — set the GLM key in Settings for real recognition'],
    'stt.fallbackGlm': ['گوگل جواب نداد — همان صدا به GLM-ASR فرستاده شد…', 'Google had no answer — the same audio went to GLM-ASR…'],
    'stt.racing': ['شنیدن با {x} — زودترین جواب برنده است…', 'Listening with {x} — first answer wins…'],
    'stt.heardLive': ['شنیدم… بعد از سکوتت پردازش می‌کنم', 'I hear you… transcribing after your pause'],
    'stt.failAll': ['هیچ موتوری نتوانست صدایت را تبدیل کند: {x}', 'No engine could transcribe your voice: {x}'],

    /* ---------- v0.11 ---------- */
    'nav.music': ['پلیر موزیک — پلی‌لیست از پوشه خودت', 'Music player — playlist from your folder'],
    'live.on': ['در حال شنیدن…', 'Listening…'],
    'music.title': ['پلیر موزیک', 'Music player'],
    'music.pick': ['انتخاب پوشه موزیک', 'Choose music folder'],
    'music.noTrack': ['هنوز آهنگی انتخاب نشده', 'No track selected yet'],
    'music.pickHint': ['یک پوشه پر از آهنگ انتخاب کن تا پلی‌لیست ساخته شود', 'Pick a folder full of songs to build the playlist'],
    'music.search': ['جستجو در آهنگ‌ها…', 'Search songs…'],
    'music.hint': ['با صدا هم می‌گویی: «موزیک پخش کن»، «آهنگ بعدی»، «آهنگ قبلی»، «موزیک پاز»', 'Voice too: "play music", "next song", "previous song", "pause music"'],
    'music.empty': ['هنوز پوشه‌ای انتخاب نکردی — «انتخاب پوشه موزیک» را بزن و پوشه‌ای که آهنگ‌هایت آنجاست را نشان بده؛ آوا عنوان، خواننده و کاور آهنگ‌ها را خودش می‌خواند.', 'No folder yet — click "Choose music folder" and point to where your songs live; AVA reads titles, artists and cover art.'],
    'music.shuffle': ['پخش تصادفی', 'Shuffle'], 'music.repeat': ['تکرار (خاموش/همه/یکی)', 'Repeat (off / all / one)'],
    'music.tracks': ['{x} آهنگ', '{x} tracks'],
    'music.loaded': ['پلی‌لیست ساخته شد: {x} آهنگ از «{y}»', 'Playlist ready: {x} songs from "{y}"'],
    'music.none': ['در این پوشه فایل صوتی پیدا نشد (mp3، wav، m4a، flac، ogg…)', 'No audio files found here (mp3, wav, m4a, flac, ogg…)'],
    'music.playing': ['در حال پخش: {x}', 'Now playing: {x}'],
    'music.paused': ['موزیک متوقف شد', 'Music paused'], 'music.stopped': ['موزیک قطع شد — از ابتدا', 'Music stopped — back to the start'],
    'music.extOff': ['افزونهٔ موزیک خاموشه — صفحهٔ افزونه‌ها را باز کردم؛ از همان‌جا فعالش کن', 'Music extension is off — I opened the extensions page; enable it there'],
    'music.resumed': ['موزیک ادامه پیدا کرد', 'Music resumed'],
    'music.next': ['آهنگ بعدی', 'Next track'], 'music.prev': ['آهنگ قبلی', 'Previous track'],
    'music.emptyPlay': ['پلی‌لیست خالی است — اول از صفحه موزیک یک پوشه انتخاب کن', 'Playlist is empty — pick a folder in the music page first'],
    'music.pageOpen': ['صفحه موزیک باز شد', 'Music page opened'],
    'music.mute': ['قطع/وصل صدا', 'Mute / unmute'],
    'music.muted': ['صدای پلیر قطع شد', 'Player muted'],
    'music.unmuted': ['صدای پلیر وصل شد', 'Player unmuted'],
    'music.widgetOff': ['ویجت موزیک بسته شد — با آهنگ بعدی برمی‌گردد', 'Music widget dismissed — returns with the next track'],
    'music.restored': ['پلی‌لیست از پوشه‌های ذخیره‌شده بازسازی شد: {x} آهنگ', 'Playlist rebuilt from saved folders: {x} songs'],
    'music.cleared': ['پوشه‌های ذخیره‌شدهٔ پلی‌لیست پاک شد', 'Saved playlist folders cleared'],
    'music.clearDirs': ['حذف پوشه‌ها', 'Clear folders'],
    'music.multiHint': ['چند پوشه هم می‌توانی انتخاب کنی — پوشه‌ها بعد از بستن برنامه هم می‌مانند', 'You can add several folders — they survive app restarts'],

    /* --- v0.12: باز کردن برنامه‌های سیستم --- */
    'app.open': ['{x} را باز کردم — خوش بگذره!', 'Opened {x} — enjoy!'],
    'app.notFound': ['برنامه‌ای به نام «{x}» روی سیستم پیدا نکردم — اسمش را واضح‌تر بگو یا از نصب بودنش مطمئن شو.', 'Could not find an app called "{x}" on this PC — say it more clearly or make sure it is installed.'],
    'app.launchFail': ['{x} را باز نشد — فایل ممکن است جابه‌جا شده باشد.', 'Could not launch {x} — the file may have moved.'],
    'app.scanning': ['اولین بار لیست برنامه‌های سیستم را می‌سازم… چند لحظه صبر کن', 'First scan of installed apps… one moment'],

    /* --- v0.12: یادآوری‌ها --- */
    'rem.set': ['یادآوری «{x}» ثبت شد برای {y} — سر وقت خودم خبرت می‌کنم.', 'Reminder "{x}" is set for {y} — I will ping you on time.'],
    'rem.noTime': ['نگفتی کی یادت بندازم — مثلاً بگو «۲۰ دقیقه دیگه یادم بنداز چایی درست کنم» یا «ساعت ۵ عصر یادآوری بذار».', 'You did not say when — try "remind me in 20 minutes to make tea" or "remind me at 5 PM".'],
    'rem.fail': ['یادآوری ثبت نشد — دوباره امتحان کن.', 'The reminder did not save — try again.'],
    'rem.due': ['یادآوری: {x}', 'Reminder: {x}'],
    'rem.uiTitle': ['یادآوری‌های فعال', 'Active reminders'],
    'rem.uiHint': ['با صدا ثبت می‌شوند: «۲۰ دقیقه دیگه یادم بنداز چایی» — سر وقت آوا خبرت می‌کند', 'Created by voice: "remind me in 20 minutes…" — AVA pings you on time'],
    'rem.uiEmpty': ['فعلاً یادآوری‌ای ثبت نشده', 'No reminders yet'],
    'rem.uiClear': ['پاک کردن همه', 'Clear all'],
    'rem.uiDel': ['حذف', 'Delete'],

    /* --- v0.13: افزونه‌ها + پینگ DNS --- */
    'set.ext.ping': ['پینگ DNSها', 'Ping DNS servers'],
    'set.ext.pingHint': ['سرعت پاسخ همه DNSهای ذخیره‌شده‌ات را می‌سنجد تا بهترین را انتخاب کنی — با صدا هم: «پینگ دی ان اس هامو»', 'Measures the response time of every saved DNS so you can pick the best — also by voice: "ping my DNS"'],
    'set.ext.pingBtn': ['پینگ بگیر', 'Ping now'],
    'set.ext.note': ['این بخش مخصوص امکانات خاص است؛ اگر لازمشان نداری می‌توانی نادیده‌شان بگیری. مدیریت کامل DNS و ابزارهای خاص این‌جا جمع شده‌اند.', 'This section holds special tools you can safely ignore if you do not need them — full DNS management and extras live here.'],
    'dnsp.title': ['پینگ DNSها', 'Ping DNS servers'],
    'dnsp.pageTitle': ['تغییرگر DNS', 'DNS Changer'], /* v0.60 — تیتر صفحهٔ DNS؛ dnsp.title دوقلو بود و مقدارِ پاپ‌آپ پینگ برنده می‌شد */
    'dnsp.sub': ['سریع‌ترین‌ها بالا — هر کدام را خواستی فعال کن', 'Fastest first — activate any of them'],
    'dnsp.refresh': ['پینگ دوباره', 'Ping again'],
    'dnsp.note': ['فعال‌سازی هر DNS پنجره تأیید مدیر (UAC) ویندوز را باز می‌کند. «کنسل» بزنی صفحه می‌بندد.', 'Activating a DNS opens the Windows UAC prompt. Cancel just closes this page.'],
    'dnsp.testing': ['در حال پینگ گرفتن… چند لحظه صبر کن', 'Pinging… one moment'],
    'dnsp.fail': ['پاسخی نداد', 'No reply'],
    'dnsp.activate': ['فعال‌سازی', 'Activate'],
    'dnsp.active': ['فعال شد ✓', 'Active ✓'],
    'dnsp.onlyApp': ['پینگ فقط داخل نرم‌افزار ویندوزی کار می‌کند', 'Pinging only works inside the Windows app'],
    'dns.pingReply': ['پینگ گرفتم! سریع‌ترین DNS: «{x}» با {y} میلی‌ثانیه — صفحه پینگ باز است؛ هر کدام را خواستی فعال کن.', 'Pinged! Fastest DNS: "{x}" at {y} ms — the ping page is open; activate whichever you like.'],
    'dns.pingAllFail': ['هیچ‌کدام از DNSها پاسخ ندادند — اتصال اینترنت را بررسی کن.', 'None of the DNS servers replied — check your internet connection.'],

    /* --- v0.13: انتخاب مدل + فیدبک دکمه میکروفون --- */
    'set.ai.geminiModel': ['مدل جمنای', 'Gemini model'],
    'set.ai.geminiModelHint': ['هر مدلی تایپ کن — اگر مدلی کار نکرد (بازنشسته/بی‌سهمیه)، آوا خودکار به مدل بعدی می‌رود؛ دکمهٔ «فهرست مدل‌ها» همهٔ مدل‌های زندهٔ کلیدت را نشان می‌دهد', 'Type any model — if one fails (retired/no quota), AVA automatically tries the next; the "Model list" button shows every live model of your key'],
    'set.ai.geminiModelPh': ['gemini-flash-lite-latest', 'gemini-flash-lite-latest'],
    'set.ai.gemModelsBtn': ['فهرست مدل‌ها', 'Model list'],
    'set.ai.gemSearchPh': ['جستجو بین مدل‌ها…', 'Search models…'],
    'set.ai.gemModelsNone': ['فهرست مدل‌ها الان در دسترس نیست — اول «تست اتصال» را بزن تا مدل‌های زندهٔ کلیدت خوانده شود', 'Model list is unavailable right now — run "Test connection" first so AVA can read your live models'],
    'set.ai.openaiModel': ['مدل OpenAI', 'OpenAI model'],
    'set.ai.openaiModelHint': ['می‌توانی هر مدلی بنویسی؛ پیشنهادها از منوی پایین ورودی هم می‌آید', 'Type any model name; suggestions appear below the input'],
    'set.ai.openaiModelPh': ['gpt-4o-mini', 'gpt-4o-mini'],
    'mic.busy': ['یک لحظه! دارم فرمان قبلی‌ات را انجام می‌دهم…', 'One moment! I am still working on your previous command…'],
    'voice.engine': ['موتور صدا', 'Voice engine'],
    'voice.engineHint': ['«اِج» (پیشنهادی): صدای عصبی رایگان مایکروسافت — طبیعی‌ترین فارسی، همان موتور openai-edge-tts؛ «گوگل»: صدای زن گوگل‌ترنسلیت؛ «ویندوز»: آفلاین', '"Edge" (recommended): free Microsoft neural voice — the most natural Persian, the openai-edge-tts engine; "Google": the Google Translate voice; "Windows": offline'],
    'voice.eEng': ['اِج — صدای عصبی مایکروسافت (پیشنهادی)', 'Edge — Microsoft neural voice (recommended)'],
    'voice.gEng': ['گوگل — صدای زن (پیشنهادی)', 'Google — female voice (recommended)'],
    'voice.wEng': ['ویندوز — آفلاین', 'Windows — offline'],
    'voice.googleFail': ['صدای گوگل در دسترس نبود — با صدای ویندوز گفتم', 'Google voice unavailable — used the Windows voice'],
    'set.voice.engine': ['موتور صدا', 'Voice engine'],
    'set.voice.engineHint': ['«اِج» (پیشنهادی): صدای عصبی رایگان مایکروسافت — طبیعی‌ترین فارسی، همان موتور openai-edge-tts؛ «گوگل»: صدای زن گوگل‌ترنسلیت؛ «ویندوز»: آفلاین', '"Edge" (recommended): free Microsoft neural voice — most natural Persian; "Google": the Google Translate voice; "Windows": offline'],
    'set.voice.eEng': ['اِج — صدای عصبی مایکروسافت (پیشنهادی)', 'Edge — Microsoft neural voice (recommended)'],
    'set.voice.gEng': ['گوگل — صدای زن', 'Google — female voice'],
    'set.voice.wEng': ['ویندوز — آفلاین', 'Windows — offline'],
    'set.voice.eVoice': ['صدای اِج', 'Edge voice'],
    'set.voice.eVoiceHint': ['مؤنث (دلارا) یا مذکر (فرید) — با تغییر، نمونهٔ صدا پخش می‌شود', 'Female (Dilara) or male (Farid) — a sample plays on change'],
    'set.ai.provider': ['موتور هوش مصنوعی', 'AI engine'],
    'set.ai.providerHint': ['«خودکار»: اول کلید Gemini (با سرچ زنده گوگل)، بعد حساب GLM، کلید GLM و در آخر OpenAI — یا یکی را ثابت انتخاب کن', '"Auto": Gemini key first (with live Google Search), then GLM account, GLM key, and OpenAI last — or fix one'],
    'set.ai.pAuto': ['خودکار (پیشنهادی)', 'Auto (recommended)'],
    'set.ai.pZai': ['حساب GLM (z.ai)', 'GLM account (z.ai)'],
    'set.ai.pGlm': ['کلید API گله‌م', 'GLM API key'],
    'set.ai.pGemini': ['گوگل جمنای', 'Google Gemini'],
    'set.ai.pOpenai': ['OpenAI', 'OpenAI'],
    'set.ai.geminiKey': ['کلیدهای API گوگل جمنای (اختیاری)', 'Google Gemini API keys (optional)'],
    'set.ai.geminiKeyHint': ['برای سوال‌های «سرچ» جواب لحظه‌ای با جستجوی گوگل می‌گیرد — کلید رایگان از aistudio.google.com؛ هر دو فرمت (AIza… و AQ.…) کار می‌کنند. چند کلید؟ با ویرگول جدا کن', 'Search-like questions get live Google Search answers — free key from aistudio.google.com; both formats (AIza… and AQ.…) work. Multiple keys: comma separated'],
    'set.ai.geminiPh': ['AIza… یا AQ.… (چند کلید با ویرگول)', 'AIza… or AQ.… (comma separated)'],
    'set.ai.openaiKey': ['کلیدهای API اوپن‌ای‌آی (اختیاری)', 'OpenAI API keys (optional)'],
    'set.ai.openaiKeyHint': ['از platform.openai.com — با GPT جواب می‌دهد. چند کلید را می‌توانی با ویرگول بدهی (چرخش خودکار)', 'From platform.openai.com — answers with GPT. Multiple keys can be comma separated (auto rotation)'],
    'set.ai.openaiPh': ['sk-… , sk-… (چند کلید با ویرگول)', 'sk-… , sk-… (comma separated)'],
    'upd.badge': ['آپدیت جدید', 'Update'],
    /* v0.26 — کارت بروزرسانی بوت */
    'upd.cardTitle': ['نسخهٔ جدید آوا منتشر شد', 'A new AVA version is out'],
    'upd.cardVer': ['نسخهٔ {x} آمادهٔ نصب است', 'Version {x} is ready to install'],
    'upd.cardBody': ['مکالمهٔ صوتی از صفر بازسازی شده، فیلترینگ/DNS خودکار دور زده می‌شود و سرعت پاسخ چند برابر شده — برای شنیدنِ درست حتماً نصبش کن', 'Voice conversation was rebuilt from scratch, DNS filtering is bypassed automatically and responses are several times faster — please install it for correct listening'],
    'upd.cardNow': ['همین حالا دانلود و نصب', 'Download & install now'],
    'upd.cardLater': ['بعداً', 'Later'],
    'toast.saved': ['ذخیره شد', 'Saved'],
    'upd.badgeReady': ['نصب آپدیت', 'Install update'],
    'upd.badgeDl': ['دانلود {x}٪', 'Downloading {x}%'],
    'upd.clickInstall': ['نسخه {x} دانلود شد — برای نصب و راه‌اندازی مجدد کلیک کن', 'Version {x} is downloaded — click to install and restart'],
    'upd.downloadingToast': ['نسخه {x} در حال دانلود است…', 'Downloading version {x}…'],
    'dict.trigger': ['حالت تایپ صوتی روشن شد — هر چی بگویی در کادر تایپ نوشته می‌شود', 'Voice typing is on — everything you say goes into the typing box'],
    'dns.setVoice': ['در حال تنظیم DNS «{x}» روی ویندوز…', 'Setting DNS "{x}" on Windows…'],
    /* ---------- v0.24 — شنیدن مثل کروم (دورزدن DNS داخلی) ---------- */
    'net.googleFail': ['Google از داخل برنامه در دسترس نیست — شنوندهٔ سریع وب محدود می‌شود؛ اینترنت/فیلترشکن را چک کن (جزئیات در activity.log)', 'Google is unreachable from the app — fast web listening will be limited; check your internet/VPN (details in activity.log)'],
    'set.net.status': ['وضعیت اتصال (سلف‌چک بعد از بوت)', 'Network status (self-check after boot)'],
    /* ---------- v0.28 — سایت مستقیم + دیسکورد + جمنای ---------- */
    'disc.off': ['افزونهٔ کنترل دیسکورد خاموش است — از تنظیمات › افزونه‌ها روشنش کن', 'The Discord control extension is off — enable it in Settings › Extensions'],
    'web.siteOpen': ['سایت {x} باز شد', 'The {x} website is open'],
    'web.siteFail': ['باز کردن «{x}» ممکن نشد', 'Could not open "{x}"'],
    'set.ai.gemMoved': ['این کلید جمنای بود — خودکار در بخش هوش مصنوعی ذخیره شد ✓', 'That is a Gemini key — saved to the AI section automatically ✓'],
    'set.ai.gemSaved': ['کلید جمنای ذخیره شد ✓ — چت و سرچ لحظه‌ای فعال شد', 'Gemini key saved ✓ — chat and live search enabled'],
    'set.ai.gemCleared': ['کلید جمنای پاک شد', 'Gemini key cleared'],
    'set.ai.gemBadFormat': ['این فرمت شبیه کلید جمنای نیست — کلیدهای جمنای با «AIza» یا «AQ.» شروع می‌شوند؛ اگر مطمئنی درست است، بی‌خیال این پیام', 'This does not look like a Gemini key — Gemini keys start with "AIza" or "AQ."; ignore this notice if you are sure it is right'],
    'set.ai.gemErrKey': ['کلید جمنای معتبر نیست — از aistudio.google.com کلید بگیر و کامل بچسبان (با AIza شروع می‌شود)', 'The Gemini key is not valid — get a free one from aistudio.google.com and paste it fully (starts with AIza)'],
    'set.ai.gemErrLoc': ['گوگل جمنای را برای سرزمین تو محدود کرده — موتورهای دیگر آوا همین حالا جواب می‌دهند (خودکار/گوگل/بستهٔ آفلاین)', 'Google restricts Gemini in your region — the other AVA engines answer right now (Auto / Google / offline pack)'],
    /* --- v0.31.0: قیمت‌ها / اوقات شرعی / یادداشت / تاریخ میلادی --- */
    'rates.up': ['کمی بالاتر از قبل', 'a bit higher'],
    'rates.down': ['کمی پایین‌تر از قبل', 'a bit lower'],
    'rates.usd': ['دلار', 'USD'],
    'rates.approx': ['حدود', 'about'],
    'rates.onlyApp': ['قیمت لحظه‌ای فقط داخل برنامهٔ ویندوزی آوا کار می‌کند', 'Live rates work inside the Windows app only'],
    'rates.ask': ['بگو «قیمت دلار چنده» یا «قیمت طلا چنده» — دلار، یورو، پوند، درهم، طلا، مثقال، انس جهانی، سکه‌ها و رمزارزها را لحظه‌ای می‌گویم', 'Say "dollar price" or "gold price" — I report live rates for currency, gold, coins and crypto'],
    'date.greg': ['تاریخ میلادی امروز: {x}', 'Gregorian date today: {x}'],
    'prayer.city': ['اوقات شرعی {city} — {x}', 'Prayer times in {city} — {x}'],
    'prayer.onlyApp': ['اوقات شرعی فقط داخل برنامهٔ ویندوزی آوا کار می‌کند', 'Prayer times work inside the Windows app only'],
    'prayer.fail': ['اوقات شرعی برای اینجا محاسبه نشد', 'Prayer times could not be computed here'],
    'notes.added': ['ثبت شد ✓ — یادداشت شمارهٔ {n}: «{x}»', 'Saved ✓ — note #{n}: "{x}"'],
    'notes.ask': ['متن یادداشت را هم بگو — مثلاً: «یادداشت کن که فردا ساعت ۵ جلسه دارم»', 'Say the note text too — e.g. "take a note: meeting at 5 tomorrow"'],
    'notes.empty': ['هنوز یادداشتی نداری — بگو «یادداشت کن که …»', 'No notes yet — say "take a note: …"'],
    'notes.list': ['یادداشت‌هات ({n} تا):', 'Your notes ({n}):'],
    'notes.deletedLast': ['آخرین یادداشت پاک شد — «{x}»', 'Last note deleted — "{x}"'],
    'notes.cleared': ['همهٔ یادداشت‌ها پاک شد', 'All notes cleared'],
    'notes.saveFail': ['یادداشت ذخیره نشد — دوباره امتحان کن', 'Could not save the note — try again'],
    'notes.onlyApp': ['یادداشت فقط داخل برنامهٔ ویندوزی آوا کار می‌کند', 'Notes work inside the Windows app only'],
  };
  const t = (key, vars) => {
    const e = I18N[key];
    let s = e ? (LANG === 'en' ? (e[1] !== undefined ? e[1] : e[0]) : e[0]) : (vars && vars.def) || key;
    if (vars && typeof s === 'string') {
      for (const [k, v] of Object.entries(vars)) { if (k !== 'def') s = s.split('{' + k + '}').join(String(v)); }
    }
    return s;
  };
  const faNum = (v) => LANG === 'en' ? String(v) : String(v).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);

  function applyI18n() {
    const root = document.documentElement;
    root.lang = LANG === 'en' ? 'en' : 'fa';
    root.dir = LANG === 'en' ? 'ltr' : 'rtl';
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const e = I18N[key];
      if (e) el.textContent = LANG === 'en' ? (e[1] !== undefined ? e[1] : e[0]) : e[0];
    });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
      const key = el.getAttribute('data-i18n-ph');
      const e = I18N[key];
      if (e) el.placeholder = LANG === 'en' ? (e[1] !== undefined ? e[1] : e[0]) : e[0];
    });
    document.querySelectorAll('[data-i18n-tip]').forEach((el) => {
      const key = el.getAttribute('data-i18n-tip');
      const e = I18N[key];
      if (e) el.title = LANG === 'en' ? (e[1] !== undefined ? e[1] : e[0]) : e[0];
    });
    /* متن‌های دینامیک که همیشه روی صفحه‌اند */
    IDLE_HINT = t('status.idle', { combo: pttHintComboHtml() }); /* v0.60 — راهنمای بیکاری کلید واقعی PTT را نشان می‌دهد */
    greetTitle.textContent = greetingText();
    const sbMicTxt = sbMic.querySelector('span');
    if (sbMicTxt) sbMicTxt.textContent = t('sb.micReady');
    refreshEngineUI();
    buildSuggestions(true);
    updateDictToggleUI();
  }

  /* ---------- عناصر صفحه تنظیمات ---------- */
  const hero = document.querySelector('.hero');
  const settingsPage = $('#settingsPage');
  const btnHome = $('#btnHome');
  const btnSettings = $('#btnSettings');
  const btnSettingsBack = $('#btnSettingsBack');
  const optTop = $('#optTop');
  const optLogin = $('#optLogin');
  const optTts = $('#optTts');
  const optVoice = $('#optVoice');
  const optAutoUpdate = $('#optAutoUpdate');
  const updText = $('#updText');
  const updNote = $('#updNote');
  const updProgress = $('#updProgress');
  const updBar = $('#updBar');
  const btnCheckUpdate = $('#btnCheckUpdate');
  const btnInstallUpdate = $('#btnInstallUpdate');
  const btnManualDl = $('#btnManualDl');
  /* v0.21 — دانلود به اختیار کاربر */
  const btnUpdDownload = $('#btnUpdDownload');
  const btnUpdPause = $('#btnUpdPause');
  const btnUpdCancel = $('#btnUpdCancel');

  /* ---------- عناصر تنظیمات جدید (میکروفون / گفتار / GLM) ---------- */
  const optMic = $('#optMic');
  const micStat = $('#micStat');
  const micMeter = $('#micMeter');
  const optSttEngine = $('#optSttEngine');
  const optGlmKey = $('#optGlmKey');
  const btnKeyShow = $('#btnKeyShow');
  const optGoogleKey = $('#optGoogleKey');
  const btnGoZai = $('#btnGoZai');
  const optDemo = $('#optDemo');
  const optAiModel = $('#optAiModel');

  /* ---------- عناصر حالت بی‌دست و تاریخچه (v0.7) ---------- */
  const optHandsFree = $('#optHandsFree');
  const optWakeWord = $('#optWakeWord');
  const btnHandsFree = $('#btnHandsFree');
  const historyPage = $('#historyPage');
  const btnHistory = $('#btnHistory');
  const btnHistoryBack = $('#btnHistoryBack');
  const btnHistoryClear = $('#btnHistoryClear');
  const historyList = $('#historyList');
  const historyEmpty = $('#historyEmpty');

  /* ---------- عناصر تایپ صوتی (v0.8) ---------- */
  const dictPage = $('#dictPage');
  const btnDict = $('#btnDict');
  const btnDictBack = $('#btnDictBack');
  const dictBox = $('#dictBox');
  const dictInterim = $('#dictInterim');
  const dictStatus = $('#dictStatus');
  const btnDictToggle = $('#btnDictToggle');
  const btnDictCopy = $('#btnDictCopy');
  const btnDictClear = $('#btnDictClear');
  const optDictTarget = $('#optDictTarget');
  const typingCmdsList = $('#typingCmdsList');
  const tcPhrase = $('#tcPhrase');
  const tcValue = $('#tcValue');
  const tcAdd = $('#tcAdd');

  /* ---------- عناصر مدیریت DNS (v0.9) ---------- */
  const dnsCurrentBox = $('#dnsCurrentBox');
  const dnsProfilesList = $('#dnsProfilesList');
  const dnsAddForm = $('#dnsAddForm');
  const dnsName = $('#dnsName');
  const dnsPrimary = $('#dnsPrimary');
  const dnsSecondary = $('#dnsSecondary');
  const dnsSaveBtn = $('#dnsSaveBtn');
  const dnsEditId = $('#dnsEditId');
  const dnsCancelEdit = $('#dnsCancelEdit');
  const dnsBuiltins = $('#dnsBuiltins');
  const btnQuickDns = $('#btnQuickDns');

  /* ---------- عناصر چت هوش مصنوعی ---------- */
  const chatPage = $('#chatPage');
  const btnChat = $('#btnChat');
  const btnChatBack = $('#btnChatBack');
  const chatMsgs = $('#chatMsgs');
  const chatBar = $('#chatBar');
  const chatInput = $('#chatInput');
  const tabQuick = $('#tabQuick');
  const tabZai = $('#tabZai');
  const quickWrap = $('#quickWrap');
  const zaiWrap = $('#zaiWrap');
  const zaiWeb = $('#zaiWeb');
  const zaiBadge = $('#zaiBadge');
  /* v0.45 — سبک‌سازی RAM: صفحهٔ chat.z.ai دیگر در بوت لود نمی‌شود
     (یک صفحهٔ کامل کرومیوم = صدها مگابایت). فقط با اولین باز شدن تب
     «صفحه چت GLM» بارگذاری می‌شود؛ توکن نشست از اجرای قبل کش می‌ماند
     تا «چت سریع» و فرمان‌های صوتی هم بدون لود صفحه کار کنند. */
  let zaiWebLoaded = false;
  function ensureZaiWebLoaded() {
    if (zaiWebLoaded || !zaiWeb) return;
    const src = zaiWeb.getAttribute('data-src');
    if (!src) return;
    zaiWebLoaded = true;
    actLog('zai webview lazy-load (RAM diet: not loaded at boot)');
    zaiWeb.src = src;
  }

  /* ---------- مودال تأیید ---------- */
  const confirmBox = $('#confirmBox');
  const cfTitle = $('#cfTitle');
  const cfText = $('#cfText');
  const cfCode = $('#cfCode');
  const btnConfirmOk = $('#btnConfirmOk');
  const btnConfirmCancel = $('#btnConfirmCancel');

  /* ---------- عناصر v0.11: متن زنده، بج آپدیت، صدا، هوش مصنوعی، موزیک ---------- */
  const liveText = $('#liveText');
  const liveTextBody = $('#liveTextBody');
  const btnUpdBadge = $('#btnUpdBadge');
  const updBadgeTxt = $('#updBadgeTxt');
  const optTtsEngine = $('#optTtsEngine');
  const optEdgeVoice = $('#optEdgeVoice');
  const optAiProvider = $('#optAiProvider');
  const optGeminiKey = $('#optGeminiKey');
  const optOpenaiKey = $('#optOpenaiKey');
  const optGeminiModel = $('#optGeminiModel');
  const optOpenaiModel = $('#optOpenaiModel');
  const musicPage = $('#musicPage');
  const btnMusic = $('#btnMusic');
  /* v0.15 — افزونه‌ها و صفحه‌های جدید */
  const btnExt = $('#btnExt');
  const btnDnsExt = $('#btnDnsExt');
  const extPage = $('#extPage');
  const dnsPage = $('#dnsPage');
  const extDnsOpt = $('#extDnsOpt');
  const extMusicOpt = $('#extMusicOpt');
  const extDnsToggle = $('#extDnsToggle');
  const extMusicToggle = $('#extMusicToggle');
  const extDiscordOpt = $('#extDiscordOpt');
  const extDiscordToggle = $('#extDiscordToggle');
  const optNoAnim = $('#optNoAnim');
  const optNoFx = $('#optNoFx');
  const btnLiteTheme = $('#btnLiteTheme');
  const btnSaveAi = $('#btnSaveAi');
  const btnMusicBack = $('#btnMusicBack');
  const btnMusicFolder = $('#btnMusicFolder');
  const mFolder = $('#mFolder');
  const mDirsClear = $('#mDirsClear');
  const mCover = $('#mCover');
  const mTitle = $('#mTitle');
  const mArtist = $('#mArtist');
  const mCount = $('#mCount');
  const mEq = $('#mEq');
  const mSeek = $('#mSeek');
  const mCur = $('#mCur');
  const mDur = $('#mDur');
  const mPlayBtn = $('#mPlay');
  const mPlayIcon = $('#mPlayIcon');
  const mPrevBtn = $('#mPrev');
  const mNextBtn = $('#mNext');
  const mShuffleBtn = $('#mShuffle');
  const mRepeatBtn = $('#mRepeat');
  const mVol = $('#mVol');
  const mMute = $('#mMute');
  /* v0.21 — کنترل‌های مینیمال جدید: توقف کامل، جلو/عقب ۱۰ ثانیه‌ای، کم/زیاد صدا */
  const mStopBtn = $('#mStop');
  const mBack10Btn = $('#mBack10');
  const mFwd10Btn = $('#mFwd10');
  const mVolDownBtn = $('#mVolDown');
  const mVolUpBtn = $('#mVolUp');
  const mSearch = $('#mSearch');
  const mList = $('#mList');
  const mEmpty = $('#mEmpty');
  const mAudio = new Audio(); /* پلیر — خارج از DOM تا با ری‌رندر از دست نرود */
  const musicWidget = $('#musicWidget');
  const mwCover = $('#mwCover');
  const mwTitle = $('#mwTitle');
  const mwArtist = $('#mwArtist');
  const mwEq = $('#mwEq');
  const mwPlayBtn = $('#mwPlay');
  const mwPlayIcon = $('#mwPlayIcon');

  /* ---------- متن زنده زیر دکمه ضبط ----------
     هر تکه‌ای که موتور تشخیص در حال شنیدن است، همان لحظه نشان داده می‌شود */
  function setLiveText(txt) {
    if (!liveText || !liveTextBody) return;
    const s = String(txt || '').trim();
    if (!s) {
      liveText.hidden = true;
      liveTextBody.textContent = '';
      liveText.classList.remove('on');
      return;
    }
    liveText.hidden = false;
    liveText.classList.add('on');
    liveTextBody.textContent = s;
  }

  /* ---------- عناصر ---------- */
  const body = document.body;
  const btnMin = $('#btnMin');
  const btnMax = $('#btnMax');
  const btnClose = $('#btnClose');
  const maxIcon = $('#maxIcon');
  const orb = $('#orb');
  const orbIcon = $('#orbIcon');
  const statusText = $('#statusText');
  const wave = $('#wave');
  const respCard = $('#respCard');
  const rcTag = $('#rcTag');
  const rcHeard = $('#rcHeard');
  const rcReply = $('#rcReply');
  const cmdBar = $('#cmdBar');
  const cmdInput = $('#cmdInput');
  const sbMic = $('#sbMic');
  const sbEngine = $('#sbEngine');
  const sbCpu = $('#sbCpu');
  const sbRam = $('#sbRam');
  const sbClock = $('#sbClock');
  const toasts = $('#toasts');
  const about = $('#about');
  const btnAbout = $('#btnAbout');
  const greetTitle = $('#greetTitle');
  const abRuntime = $('#abRuntime');

  const IDLE_HINT_TXT = 'برای شروع، اورب را لمس کن یا کلید <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Space</kbd>';
  let IDLE_HINT = IDLE_HINT_TXT;
  const DEFAULT_REPLY = 'این فرمان را هنوز یاد نگرفتم. اتصال هوش مصنوعی را برقرار کن (تب «صفحه چت GLM» › ورود به حسابت) تا هر سوال و فرمانی را همان‌جا تحلیل کنم و یاد بگیرم!';

  /* ---------- تنظیمات (فایل userData + میرور localStorage) ----------
     با جابجایی مببع UI از فایل به ava://، localStorage از صفر شروع می‌شد؛
     حالا فایل ava-settings.json منبع حقیقت است و چیزی از دست نمی‌رود. */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ava.' + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem('ava.' + k, JSON.stringify(v)); } catch (_) { /* noop */ } persistSettings(); },
  };
  const settings = {
    tts: store.get('tts', true),
    /* v0.65 — صدای کوچکِ بانمکِ پایانِ کار (WebAudio سنتز — بدون فایل) */
    doneSound: store.get('doneSound', true),
    voiceURI: store.get('voiceURI', ''),
    ttsEngine: store.get('ttsEngine', 'edge'), /* v0.42 — اِج پیش‌فرض */
    edgeVoice: store.get('edgeVoice', 'dilara'), /* v0.43 — صدای اِج: دلارا/فرید */
    autoUpdate: store.get('autoUpdate', true),
    /* v0.48 — گزارش خودکار لاگ به گیت‌هاب: {auto, githubToken} — توکن فقط
       در فایل تنظیمات محلی می‌ماند (هرگز در ریپو/کد جاسازی نمی‌شود) */
    logs: store.get('logs', { auto: true, githubToken: '' }),
    demoMode: store.get('demoMode', false),
    sttEngine: store.get('sttEngine', 'auto'),
    sttLang: store.get('sttLang', 'fa-IR'),
    lang: store.get('lang', 'fa'),
    theme: store.get('theme', 'dark'),
    googleKey: store.get('googleKey', ''),
    glmKey: store.get('glmKey', ''),
    glmBase: store.get('glmBase', 'https://api.z.ai/api/paas/v4'),
    glmModel: store.get('glmModel', 'glm-4.6'),
    aiProvider: store.get('aiProvider', 'auto'),
    geminiKey: store.get('geminiKey', ''),
    openaiKey: store.get('openaiKey', ''),
    /* v0.13: انتخاب مدل — flash-latest همیشه جدیدترین فلاش جمنای است */
    geminiModel: store.get('geminiModel', 'gemini-flash-latest'),
    /* v0.29 — رلهٔ اختیاری جمنای (پروکسی شخصی برای دور زدن محدودیت سرزمینی گوگل) */
    gemBase: store.get('gemBase', ''),
    /* v0.29 — بیدارباش همیشگی آفلاین: حتی وقتی گوش دادن خاموش است «آوا» شنیده می‌شود */
    wakeAlways: store.get('wakeAlways', false),
    /* v0.46 — کلمهٔ بیدارباش قابل تغییر (خواستهٔ کاربر: «میتونم ویکورد رو تغییر بدم»)
       همهٔ لایه‌های تطبیق (دقیق/آوانگار/ابری) برای هر کلمه‌ای عمومی کار می‌کنند */
    wakeWordText: store.get('wakeWordText', 'آوا'),
    openaiModel: store.get('openaiModel', 'gpt-4o-mini'),
    /* v0.17 — موتورهای STT کلاس AI */
    whisperBase: store.get('whisperBase', 'https://api.groq.com/openai/v1'),
    whisperKey: store.get('whisperKey', ''),
    whisperModel: store.get('whisperModel', 'whisper-large-v3-turbo'),
    /* v0.17 — افزونهٔ دیسکورد: مخاطبین و اجرای بک‌گراند */
    discordContacts: store.get('discordContacts', []), /* [{id, name, userId, note}] */
    /* v0.67 — مخاطبین پیام‌رسان‌ها: [{id, name, app, handle}] */
    msgContacts: store.get('msgContacts', []),
    discordBg: store.get('discordBg', true),           /* بدون به‌هم‌ریختن بازی */
    discordCallMode: store.get('discordCallMode', 'auto'), /* auto=آزمایشی | assist=امن */
    discordCallDx: store.get('discordCallDx', 46),     /* فاصلهٔ دکمهٔ تماس از راست */
    discordCallDy: store.get('discordCallDy', 52),     /* فاصله از بالا */
    micId: store.get('micId', ''),
    handsFree: store.get('handsFree', false),
    wakeWord: store.get('wakeWord', true),
    dictTarget: store.get('dictTarget', 'box'),
    typingCmds: store.get('typingCmds', []),
    dnsProfiles: store.get('dnsProfiles', []),
    settingsPane: store.get('settingsPane', 'mic'),
    musicVol: store.get('musicVol', 0.8),
    musicShuffle: store.get('musicShuffle', false),
    musicRepeat: store.get('musicRepeat', 'off'),
    lastMusicFolder: store.get('lastMusicFolder', ''),
    /* v0.22 — پلیر ماندگار: پوشه‌های موزیک + آخرین آهنگ بعد از ری‌استارت برمی‌گردند */
    musicDirs: store.get('musicDirs', []),
    lastMusicPath: store.get('lastMusicPath', ''),
    /* v0.15 — افزونه‌ها و بهینه‌سازی */
    extDns: store.get('extDns', true),      /* DNS Changer پیش‌فرض روشن */
    extMusic: store.get('extMusic', false), /* موزیک تا کاربر فعالش نکند در ستون نمی‌آید */
    extDiscord: store.get('extDiscord', true), /* کنترل دیسکورد — به‌خواست کاربر روشن */
    noAnim: store.get('noAnim', false),
    noFx: store.get('noFx', false),
    safeMode: store.get('safeMode', false), /* v0.16.1 — حالت امن: بدون افکت سنگین */
  };
  let customCmds = store.get('customCmds', []);
  let history = store.get('history', []);

  let persistTimer = null;
  function persistSettings() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      if (!bridge || !bridge.settings || !bridge.settings.save) return;
      try { bridge.settings.save({ ...settings, customCmds, history }); } catch (_) { /* noop */ }
    }, 600);
  }
  /* لاگ عملکرد (v0.18) — فقط داخل نرم‌افزار؛ هیچ‌وقت نمی‌شکند */
  /* v0.48 — actLog رندرر: حالا لاگ ساخت‌یافته می‌فرستد {m, tag, extra}
     (فراخوانی‌های قدیمی actLog('متن') دقیقاً مثل قبل tag='ui') */
  const actLog = (msg, tag, extra) => { try { if (bridge && bridge.log && bridge.log.act) bridge.log.act({ m: String(msg), tag: String(tag || 'ui'), extra: (extra && typeof extra === 'object') ? extra : null }); } catch (_) { /* noop */ } };
  /* v0.24 — وضعیت شبکه از پروسهٔ اصلی (سلف‌چک TCP بعد از بوت):
     اگر گوگل در دسترس نباشد، موتور وب (شنوندهٔ سریع مثل کروم) کار نمی‌کند —
     یک بار در هر اجرا به کاربر با توست شفاف خبر بده */
  try {
    if (bridge && bridge.net && bridge.net.onStatus) {
      bridge.net.onStatus((s) => {
        try {
          const items = (s && s.items) || [];
          const g = items.find((i) => i.host === 'www.google.com');
          actLog('net status received: ' + (items.map((i) => i.host + (i.ok ? ' ok' : ' FAIL')).join(', ') || 'empty'));
          if (g && !g.ok && settings.extDns !== false && !sessionStorage.getItem('ava.netToast')) {
            sessionStorage.setItem('ava.netToast', '1');
            setTimeout(() => toast(t('net.googleFail'), '#i-info'), 800);
          }
        } catch (_) { /* noop */ }
      });
    }
  } catch (_) { /* noop */ }
  (async () => {
    /* بارگذاری تنظیمات ذخیره‌شده در فایل — بعد از تعریف کامل صفحه */
    if (!bridge || !bridge.settings || !bridge.settings.load) return;
    try {
      const f = await bridge.settings.load();
      if (f && typeof f === 'object' && Object.keys(f).length) {
        /* v0.18 — فیکس «تم/تنظیمات بعد از ریستارت یا آپدیت برنمی‌گردد»:
           بعد از merge، ظاهر و تم و افزونه‌ها دوباره اعمال و localStorage هم
           همگام می‌شود (فایل در userData از آپدیت جان سالم به در می‌برد) */
        let changed = 0;
        Object.keys(settings).forEach((k) => {
          if (f[k] !== undefined && JSON.stringify(f[k]) !== JSON.stringify(settings[k])) {
            settings[k] = f[k];
            try { localStorage.setItem('ava.' + k, JSON.stringify(f[k])); changed++; } catch (_) { /* noop */ }
          }
        });
        if (Array.isArray(f.customCmds) && f.customCmds.length) { customCmds = f.customCmds; store.set('customCmds', customCmds); }
        if (Array.isArray(f.history)) { history = f.history; store.set('history', history); }
        /* v0.22 — مهاجرت یک‌باره (به درخواست گزارش کاربر):
           ۱) extDns دوباره روشن می‌شود (در نسخه‌های قدیمی false ذخیره شده بود و
              کاربر به DNS شکن/الکترو دسترسی نداشت → خطای «اتصال به سرور برقرار نشد»)
           ۲) اگر موتور STT روی Gemini قفل بود، به «خودکار» برمی‌گردد —
              در لاگ کاربر Gemini تا ۷۵ ثانیه طول می‌کشید، Whisper/گوگل ۲-۵ ثانیه */
        if (store.get('migV22') !== true) {
          if (settings.extDns === false) { settings.extDns = true; store.set('extDns', true); }
          if (settings.sttEngine === 'gemini') { settings.sttEngine = 'auto'; store.set('sttEngine', 'auto'); }
          store.set('migV22', true);
          actLog('migration v0.22 applied: extDns=' + settings.extDns + ' sttEngine=' + settings.sttEngine);
        }
        /* v0.42 — مهاجرت یک‌بارهٔ موتور صدا: اِج (عصبی مایکروسافت — همان موتور
           رایگان openai-edge-tts که کاربر معرفی کرد) صدای پیش‌فرض آوا می‌شود؛
           «گوگل» قبلی هم یک‌بار به اِج می‌رود، «ویندوز» دست‌نخورده می‌ماند و
           کاربر هر وقت بخواهد از تنظیمات برمی‌گرداند */
        if (store.get('migV42') !== true) {
          if (settings.ttsEngine !== 'windows') { settings.ttsEngine = 'edge'; store.set('ttsEngine', 'edge'); }
          store.set('migV42', true);
          actLog('migration v0.42 applied: ttsEngine=' + settings.ttsEngine);
        }
        applyTheme();
        applyPerf();
        syncPerfUI();
        if (typeof applyExtensions === 'function') applyExtensions();
        if (typeof renderDiscordContacts === 'function') renderDiscordContacts();
        /* v0.22 — اگر پوشه‌های موزیک از فایل آمد، پلی‌لیست دوباره ساخته می‌شود
           (v0.42 — فقط وقتی افزونهٔ موزیک روشن است؛ سبک‌سازی) */
        try { if (typeof restoreMusicLibrary === 'function' && settings.extMusic) restoreMusicLibrary(); } catch (_) { /* noop */ }
        if (optTheme) optTheme.value = settings.theme || 'dark';
        refreshEngineUI();
        renderCustomChips();
        updateHandsFreeUI();
        actLog(`settings restored from file (changed=${changed}) theme=${settings.theme} stt=${settings.sttEngine}`);
      }
    } catch (_) { /* noop */ }
  })();
  const glmReady = () => !!(settings.glmKey && bridge && bridge.stt);

  /* ---------- پاسخ گفتاری (TTS) — v0.11 ----------
     پیش‌فرض: صدای زن طبیعی گوگل (آنلاین — همان صدای گوگل‌ترنسلیت فارسی).
     اگر گوگل در دسترس نبود، بدون سروصدا با صدای ویندوز می‌خواند. */
  let gTtsAudio = null;          // <audio> جاری گوگل
  let gTtsQueue = [];            // صف تکه‌های mp3
  let gTtsPlaying = false;
  const ttsAudioBusy = () => gTtsPlaying;

  function stopGoogleSpeak() {
    gTtsQueue = [];
    gTtsPlaying = false;
    gTtsNext = null;
    if (gTtsAudio) {
      try { gTtsAudio.pause(); } catch (_) { /* noop */ }
      gTtsAudio.src = '';
      gTtsAudio = null;
    }
  }

  /* v0.27 — دوبوفری: تکهٔ بعدی هنگام پخش تکهٔ فعلی ساخته و decode می‌شود
     → فاصلهٔ بین جمله‌ها تقریباً صفر (تقاضای گزارش عامل خارجی) */
  let gTtsNext = null;
  function playNextGoogleChunk() {
    if (!gTtsQueue.length) { gTtsPlaying = false; return; }
    const b64 = gTtsQueue.shift();
    try {
      let au = gTtsNext; gTtsNext = null;
      if (!au || au.__avaB64 !== b64) au = new Audio('data:audio/mpeg;base64,' + b64);
      au.__avaB64 = b64;
      gTtsAudio = au;
      gTtsPlaying = true;
      au.onended = playNextGoogleChunk;
      au.onerror = () => { gTtsPlaying = false; };
      au.play().catch(() => { gTtsPlaying = false; });
      /* پیش‌بارگذاری تکهٔ بعدی — هم‌زمان با پخش همین تکه */
      if (gTtsQueue.length && !gTtsNext) {
        try {
          gTtsNext = new Audio('data:audio/mpeg;base64,' + gTtsQueue[0]);
          gTtsNext.__avaB64 = gTtsQueue[0];
          gTtsNext.load();
        } catch (_) { gTtsNext = null; }
      }
    } catch (_) { gTtsPlaying = false; }
  }

  async function speakGoogle(text) {
    if (!bridge || !bridge.tts || !bridge.tts.google) return false;
    const lang = settings.sttLang === 'en-US' ? 'en' : 'fa';
    try {
      const r = await bridge.tts.google({ text: String(text).slice(0, 2200), lang });
      if (!(r && r.ok && Array.isArray(r.chunks) && r.chunks.length)) return false;
      stopGoogleSpeak();
      gTtsQueue = r.chunks.slice();
      playNextGoogleChunk();
      return gTtsPlaying;
    } catch (_) { return false; }
  }

  /* v0.42 — موتور عصبی مایکروسافت اِج (رایگان) — همان موتور پروژهٔ
     openai-edge-tts که کاربر معرفی کرد، بدون سرور پایتون و مستقیم در آوا.
     تلفظ فارسی طبیعی‌تر و هر تکه تا ۳۰۰۰ نویسه در یک درخواست خوانده می‌شود. */
  async function speakEdge(text) {
    if (!bridge || !bridge.tts || !bridge.tts.edge) return false;
    const lang = settings.sttLang === 'en-US' ? 'en' : 'fa';
    /* v0.43 — صدای مذکر/مؤنث انتخابی کاربر (تغییر TTS دیگر فقط اسم نیست —
       واقعاً صدا عوض می‌شود) */
    const voice = settings.edgeVoice === 'farid'
      ? (lang === 'en' ? 'en-US-GuyNeural' : 'fa-IR-FaridNeural')
      : '';
    try {
      const r = await bridge.tts.edge({ text: String(text).slice(0, 3000), lang, voice });
      if (!(r && r.ok && Array.isArray(r.chunks) && r.chunks.length)) return false;
      stopGoogleSpeak();
      gTtsQueue = r.chunks.slice();
      playNextGoogleChunk();
      return gTtsPlaying;
    } catch (_) { return false; }
  }

  /* مسیر آفلاین ویندوز — فالبک مطمئن */
  function speakWindows(text) {
    if (!('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text).replace(/[«»]/g, '').slice(0, 320));
      const voices = speechSynthesis.getVoices() || [];
      if (settings.voiceURI) {
        const sel = voices.find((v) => v.voiceURI === settings.voiceURI);
        if (sel) u.voice = sel;
      } else {
        const fa = voices.find((v) => /^fa[\-_]?/i.test(v.lang) || /persian|فارسی/i.test(v.name));
        if (fa) u.voice = fa;
      }
      u.lang = (u.voice && u.voice.lang) || 'fa-IR';
      u.rate = 0.98;
      u.pitch = 1;
      speechSynthesis.speak(u);
    } catch (_) { /* noop */ }
  }

  /* v0.43 — «TTS رو تغییر میدم ولی هیچی تغییر نمیکنه» — ریشه: اِج روی شبکهٔ
     کاربر بلاک است و بی‌سروصدا گوگل جایگزین می‌شد → همهٔ موتورها یک صدا
     شنیده می‌شدند. حالا موتورِ واقعاً پخش‌شده ثبت و یک‌بار اعلام می‌شود. */
  let ttsLastEngine = '';
  let ttsEdgeFailTold = false;
  async function speak(text) {
    if (!settings.tts || !text) return false;
    const txt = String(text).replace(/[«»]/g, '').trim();
    if (!txt) return false;
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (_) { /* noop */ }
    stopGoogleSpeak();
    /* v0.42 — زنجیره: اِج → گوگل → ویندوز (اِج پیش‌فرض جدید؛ هر حلقه اگر
       جواب نداد خودکار به بعدی می‌رود تا صدا هیچ‌وقت خاموش نماند) */
    if (settings.ttsEngine === 'edge') {
      if (await speakEdge(txt)) { ttsLastEngine = 'edge'; actLog('tts played via edge'); return true; }
      /* v0.47 — B12: جایگزینی اِج→گوگل هر بار در لاگ می‌آید و اعلان هر ۱۰ دقیقه
         تکرار می‌شود (قبلاً فقط یک‌بار در کل session — کاربر فکر می‌کرد تغییر صدا
         کلاً خراب است در حالی که اِج بلاک است) */
      actLog('tts edge unavailable → google fallback');
      if (await speakGoogle(txt)) {
        ttsLastEngine = 'google';
        if (!ttsEdgeFailTold || Date.now() - (speak._edgeToldAt || 0) > 600000) {
          ttsEdgeFailTold = true;
          speak._edgeToldAt = Date.now();
          try {
            toast(LANG === 'en'
              ? 'Edge voice is blocked on your network — Google voice is used (VPN enables Edge)'
              : 'صدای اِج روی شبکهٔ شما در دسترس نیست (بلاک مایکروسافت) — فعلاً با صدای گوگل حرف می‌زنم؛ برای صدای اِج VPN لازم است', '#i-info');
          } catch (_) { /* noop */ }
        }
        return true;
      }
      ttsLastEngine = 'windows';
      actLog('tts played via windows (edge+google unavailable)');
      speakWindows(txt);
      return true;
    }
    if (settings.ttsEngine === 'google') {
      const ok = await speakGoogle(txt);
      if (ok) { ttsLastEngine = 'google'; actLog('tts played via google'); return true; }
      /* گوگل جواب نداد (آفلاین/فیلتر) → صدای ویندوز */
      ttsLastEngine = 'windows';
      speakWindows(txt);
      return true;
    }
    ttsLastEngine = 'windows';
    speakWindows(txt);
    return true;
  }

  /* ---------- ابزار ---------- */
  /* faNum در ماژول i18n بالای فایل تعریف شده (فارسی‌سازی عدد فقط در زبان فارسی) */
  const faToEn = (s) => String(s).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  const timeFmt = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' });
  const timeFmtEn = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateFmt = new Intl.DateTimeFormat('fa-IR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const dateFmtEn = new Intl.DateTimeFormat('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const fmtTime = () => (LANG === 'en' ? timeFmtEn : timeFmt).format(new Date());
  const fmtDate = () => (LANG === 'en' ? dateFmtEn : dateFmt).format(new Date());

  /* خواندن رنگ تم از CSS (کانوس‌ها هم با تم روشن هماهنگ می‌شوند) */
  const cssColor = (name, fallback) => {
    try {
      let v = getComputedStyle(document.body).getPropertyValue(name).trim();
      if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
      return v || fallback;
    } catch (_) { return fallback; }
  };

  /* کش رنگ اکولایزر — فقط با تعویض تم تازه می‌شود (نه در هر فریم) */
  const waveCols = { c1: 'rgba(52,211,153,0.95)', mid: 'rgba(16,185,129,0.85)', c2: 'rgba(16,185,129,0.9)' };
  let waveDirty = true, idleSettled = false; /* پرچم‌های بهینه‌سازی CPU حلقه اکولایزر */
  function refreshWaveColors() {
    waveCols.c1 = cssColor('--wave-c1', 'rgba(52, 211, 153, 0.95)');
    const acc = cssColor('--acc-rgb', '16,185,129');
    waveCols.mid = acc ? `rgba(${acc}, 0.85)` : 'rgba(16, 185, 129, 0.85)';
    waveCols.c2 = cssColor('--wave-c2', 'rgba(16, 185, 129, 0.9)');
    waveDirty = true; /* رنگ عوض شد → یک رندر مجدد */
  }

  function greetingText() {
    const h = new Date().getHours();
    if (LANG === 'en') {
      return h < 5 ? 'Good night, I am AVA' : h < 12 ? 'Good morning, I am AVA' : h < 15 ? 'Good afternoon, I am AVA' : h < 19 ? 'Good evening, I am AVA' : 'Good night, I am AVA';
    }
    const dayPart = h < 5 ? 'شب بخیر' : h < 12 ? 'صبح بخیر' : h < 15 ? 'ظهر بخیر' : h < 19 ? 'عصر بخیر' : 'شب بخیر';
    return `${dayPart}؛ من آوا هستم`;
  }

  function toast(msg, ico = '#i-info') {
    const t = document.createElement('div');
    t.className = 'toast glass';
    t.innerHTML = `<svg class="ic"><use href="${ico}"/></svg><span></span>`;
    t.querySelector('span').textContent = msg;
    toasts.appendChild(t);
    setTimeout(() => t.classList.add('out'), 3300);
    setTimeout(() => t.remove(), 3700);
  }

  /* ---------- ماشین حالت ----------
     آیکون اورب همیشه با حالت همگام می‌ماند (فیکس «آیکون برنمی‌گردد») */
  let state = 'idle';
  function setState(s) {
    state = s;
    body.classList.remove('state-idle', 'state-listening', 'state-processing', 'state-success');
    body.classList.add('state-' + s);
    if (orbIcon) orbIcon.setAttribute('href', s === 'listening' ? '#i-stop' : '#i-mic');
  }

  /* ============================================================
     v0.65 — صدای کوچکِ بانمکِ «انجام شد!»
     ------------------------------------------------------------
     درخواست کاربر: «وقتی درخواست انجام شد یک صدای کوچولو بانمک بیاد»
     • WebAudio سنتزِ سه‌نتِ اسپارکل (سُل۵→دو۶→می۶، مثلثیِ نرم) —
       متمایز از چایم بیدارباش (می۵→لا۵→دویس۶، سینوسی)
     • فقط جای موفقیت صدا زده می‌شود (نه خطا) + ترمز ۱٫۲ ثانیه‌ای
     • خاموش/روشن از تنظیمات › صدا (doneSound)
     ============================================================ */
  let _doneSfxAt = 0;
  function playDoneSound() {
    if (!settings.doneSound) return;
    const now = Date.now();
    if (now - _doneSfxAt < 1200) return; /* دوبارِ پشت‌سرهم ممنوع */
    _doneSfxAt = now;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ac = playDoneSound._ac || (playDoneSound._ac = new AC());
      if (ac.state === 'suspended') { ac.resume().catch(() => { /* noop */ }); }
      const t0 = ac.currentTime + 0.02;
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 6500; lp.Q.value = 0.4;
      const master = ac.createGain();
      master.gain.setValueAtTime(0.8, t0);
      lp.connect(master); master.connect(ac.destination);
      /* سه نت بالاروندهٔ شاد + هارمونیک ظریف — «تِرینگ!» کوچولو */
      [[783.99, 0.0, 0.22], [1046.5, 0.085, 0.24], [1318.51, 0.17, 0.34]].forEach(([f, off, dur]) => {
        [[f, 'triangle', 0.11], [f * 2, 'sine', 0.028]].forEach(([ff, type, vol]) => {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.type = type;
          o.frequency.setValueAtTime(ff, t0 + off);
          g.gain.setValueAtTime(0.0001, t0 + off);
          g.gain.exponentialRampToValueAtTime(vol, t0 + off + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + dur);
          o.connect(g); g.connect(lp);
          o.start(t0 + off); o.stop(t0 + off + dur + 0.06);
        });
      });
    } catch (_) { /* noop — هیچ‌وقت بوت را نکشد */ }
  }

  /* ---------- خوش‌آمد بر اساس ساعت ---------- */
  greetTitle.textContent = greetingText();

  /* ---------- ساعت نوار وضعیت ---------- */
  const tickClock = () => { sbClock.textContent = fmtTime(); };
  tickClock();
  setInterval(tickClock, 15000);

  /* ---------- تم روشن/تیره/سبک (v0.15) + تیرهٔ سبک v0.17 + بهینه‌سازی ---------- */
  const flatTheme = () => (settings.theme === 'lite' || settings.theme === 'darklite');
  function applyTheme() {
    if (settings.theme === 'light') document.body.setAttribute('data-theme', 'light');
    else if (settings.theme === 'lite') document.body.setAttribute('data-theme', 'lite');
    else if (settings.theme === 'darklite') document.body.setAttribute('data-theme', 'darklite');
    else document.body.removeAttribute('data-theme');
    const ti = $('#themeIcon');
    if (ti) ti.setAttribute('href', settings.theme === 'dark' ? '#i-sun' : '#i-moon');
    refreshWaveColors(); /* رنگ اکولایزر با تم همگام شود */
  }
  /* کلیدهای بهینه‌سازی: بدون انیمیشن / بدون افکت (v0.15) + حالت امن (v0.16.1) */
  function applyPerf() {
    body.classList.toggle('perf-noanim', !!settings.noAnim || !!settings.safeMode);
    body.classList.toggle('perf-nofx', !!settings.noFx || flatTheme() || !!settings.safeMode);
    body.classList.toggle('safe-orb', !!settings.safeMode); /* دیسک شیشه‌ای → ساده و صاف */
  }
  function syncPerfUI() {
    if (optNoAnim) optNoAnim.checked = !!settings.noAnim;
    if (optNoFx) optNoFx.checked = !!settings.noFx;
    if (btnLiteTheme) btnLiteTheme.classList.toggle('active', flatTheme());
  }
  function setTheme(th, silent = false) {
    settings.theme = ['light', 'lite', 'darklite'].includes(th) ? th : 'dark';
    store.set('theme', settings.theme);
    /* تم‌های سبک خودشان انیمیشن و افکت را کم می‌کنند (برگشت به تم دیگر، کلیدها سرجایشان می‌مانند) */
    if (flatTheme()) {
      settings.noAnim = true;
      settings.noFx = true;
      store.set('noAnim', true);
      store.set('noFx', true);
    }
    applyPerf();
    applyTheme();
    syncPerfUI();
    if (optTheme) optTheme.value = settings.theme;
    if (!silent) toast(settings.theme === 'light' ? t('toast.themeLight') : (settings.theme === 'lite' ? t('toast.themeLite') : (settings.theme === 'darklite' ? t('toast.themeDarkLite') : t('toast.themeDark'))), '#i-sun');
  }
  const btnTheme = $('#btnTheme');
  if (btnTheme) btnTheme.addEventListener('click', () => setTheme(settings.theme === 'dark' ? 'light' : 'dark'));
  applyPerf();
  applyTheme();
  syncPerfUI();

  /* ---------- کنترل‌های پنجره ---------- */
  const browserHint = () => toast(t('toast.electronOnly'), '#i-info');
  btnMin.addEventListener('click', () => (bridge ? bridge.window.minimize() : browserHint()));
  btnMax.addEventListener('click', () => (bridge ? bridge.window.toggleMaximize() : browserHint()));
  btnClose.addEventListener('click', () => (bridge ? bridge.window.close() : browserHint()));
  if (bridge) {
    const setMaxIco = (v) => maxIcon.setAttribute('href', v ? '#i-restore' : '#i-max');
    bridge.window.onMaximizeChange(setMaxIco);
    bridge.window.isMaximized().then(setMaxIco).catch(() => {});
    abRuntime.textContent = `Electron v${bridge.versions.electron}`;
  } else {
    abRuntime.textContent = 'پیش‌نمایش مرورگر';
  }

  /* ---------- ویژوالایزر موج صدا ---------- */
  const ctx = wave.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  function resizeWave() {
    const r = wave.getBoundingClientRect();
    W = r.width; H = r.height;
    wave.width = Math.max(1, W * DPR);
    wave.height = Math.max(1, H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    waveDirty = true; /* بعد از تغییر اندازه، یک فریم دوباره کشیده شود */
  }
  window.addEventListener('resize', resizeWave);
  resizeWave();

  /* ---------- میکروفون واقعی: همیشه روشن — اکولایزر و تست تنظیمات با صدای واقعی ---------- */
  let micStream = null, audioCtx = null, analyser = null, micData = null, micLive = false;
  let mediaRec = null, recChunks = [], isRecording = false;

  async function attachMic() {
    /* v0.60 (A7) — کشِ میک اعتبارسنجی می‌شود: «if (analyser) return true» قبلاً
       میکِ قطع‌شده را برای همیشه کش می‌کرد و هیچ‌وقت ریکاور نمی‌شد؛ استریمِ
       مرده (ترک ended) بلافاصله باطل و گرفتن تازه انجام می‌شود */
    if (analyser) {
      let dead = false;
      try { dead = !micStream || micStream.getTracks().some((trk) => trk.readyState === 'ended'); } catch (_) { /* noop */ }
      if (!dead) return true;
      actLog('mic: cached stream is dead (device gone) — rebuilding');
      if (micStream) { try { micStream.getTracks().forEach((trk) => { try { trk.onended = null; } catch (_) { /* noop */ } }); } catch (_) { /* noop */ } micStream = null; }
      if (audioCtx) { try { audioCtx.close(); } catch (_) { /* noop */ } audioCtx = null; }
      analyser = null; micData = null; micLive = false;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      const base = { echoCancellation: true, noiseSuppression: true };
      /* برای تشخیص گفتار: صدای خام + AGC روشن — NS/EC کلمه‌های کوتاه و آروم را می‌خورند
         و علت اصلی «صدا دریافت نشد» بودند؛ اگر دستگاه خام نداد، به حالت قبلی برمی‌گردیم */
      const raw = { echoCancellation: false, noiseSuppression: false, autoGainControl: true, channelCount: 1 };
      const tryGet = async (c) => {
        if (settings.micId) {
          try { return await navigator.mediaDevices.getUserMedia({ audio: { ...c, deviceId: { exact: settings.micId } } }); } catch (_) { /* noop */ }
        }
        try { return await navigator.mediaDevices.getUserMedia({ audio: c }); } catch (_) { return null; }
      };
      micStream = await tryGet(raw);
      if (!micStream) micStream = await tryGet(base);
      /* v0.60 (A7) — مرگ ترک (آن‌پلاگ میک) خودش را اعلام می‌کند: onended →
         detachMic (خودش حین جلسه/ضبط/بیدارباش دست نمی‌زند — watchdog/attach
         بعدی بازسازی می‌کند) */
      try {
        micStream.getTracks().forEach((trk) => {
          try { trk.onended = () => { actLog('mic: track ended (device unplugged?) — mic cache invalidated'); detachMic(); }; } catch (_) { /* noop */ }
        });
      } catch (_) { /* noop */ }
      audioCtx = new AC();
      /* بعضی سیستم‌ها کانتکست را معلق (suspended) می‌سازند — بدون resume هیچ صدایی نمی‌آید */
      if (audioCtx.state === 'suspended') { try { await audioCtx.resume(); } catch (_) { /* noop */ } }
      const src = audioCtx.createMediaStreamSource(micStream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;
      src.connect(analyser);
      micData = new Uint8Array(analyser.frequencyBinCount);
      micLive = true;
      sbMic.innerHTML = `<i class="dot ok"></i>${t('mic.on')}`;
      micStat.textContent = t('mic.active');
      listMicDevices();
      return true;
    } catch (err) {
      micLive = false;
      const nm = String((err && err.name) || err || '');
      const why = /NotReadable|TrackStart/i.test(nm)
        ? (LANG === 'en' ? 'The microphone is used by another app — close that app first' : 'میکروفون توسط برنامه دیگری در حال استفاده است — آن برنامه را ببند')
        : /NotFound/i.test(nm)
        ? (LANG === 'en' ? 'No microphone found — check the connection' : 'هیچ میکروفونی پیدا نشد — اتصال میکروفون را چک کن')
        : /NotAllowed|SecurityError/i.test(nm)
        ? (LANG === 'en' ? 'Microphone permission denied — enable it in Windows Settings › Privacy › Microphone' : 'مجوز میکروفون رد شد — در ویندوز: Settings › Privacy › Microphone را روشن کن')
        : (LANG === 'en' ? 'Could not access the microphone — check Windows permissions and antivirus' : 'دسترسی به میکروفون ممکن نشد — مجوز ویندوز و آنتی‌ویروس را بررسی کن');
      sbMic.innerHTML = `<i class="dot err"></i>${t('mic.noAccess')}`;
      micStat.textContent = why;
      return false;
    }
  }

  async function listMicDevices() {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const mics = devs.filter((d) => d.kind === 'audioinput');
      const cur = settings.micId;
      let html = '<option value="">پیش‌فرض ویندوز</option>';
      mics.forEach((m, i) => {
        const label = m.label || `میکروفون ${i + 1}`;
        const sel = m.deviceId === cur ? ' selected' : '';
        html += `<option value="${m.deviceId}"${sel}>${label}</option>`;
      });
      optMic.innerHTML = html;
    } catch (_) { /* noop */ }
  }

  optMic.addEventListener('change', async () => {
    settings.micId = optMic.value || '';
    store.set('micId', settings.micId);
    /* ری‌استارت استریم با ورودی جدید */
    if (isRecording) await stopAudioRec();
    if (state === 'listening') stopListening(false); /* جلسه با میکروفون قدیمی می‌مرد */
    /* v0.29 — حلقهٔ بیدارباش هم با میکروفون جدید از نو شروع شود */
    const wakeWas = !!wakeLoop;
    if (wakeWas) wakeLoopStop();
    detachMic();
    await attachMic();
    if (wakeWas) wakeLoopStart();
    toast(t('toast.micChanged'), '#i-mic');
  });

  /* میتر تست زنده در تنظیمات */
  const mctx = micMeter ? micMeter.getContext('2d') : null;
  function drawMeter() {
    if (!mctx || settingsPage.hidden) { setTimeout(drawMeter, 600); return; }
    const r = micMeter.getBoundingClientRect();
    const mw = Math.max(10, r.width), mh = 40;
    if (micMeter.width !== mw * DPR) { micMeter.width = mw * DPR; micMeter.height = mh * DPR; mctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
    mctx.clearRect(0, 0, mw, mh);
    if (micData) {
      const bars = 34, gap = 3;
      const bw = Math.max(2, (mw - (bars - 1) * gap) / bars);
      for (let i = 0; i < bars; i++) {
        const bi = Math.min(micData.length - 1, Math.floor(Math.pow(i / bars, 1.5) * micData.length * 0.72));
        const raw = micData[bi] / 255;
        const bh = Math.max(3, raw * (mh - 8));
        mctx.fillStyle = raw > 0.55 ? cssColor('--meter-hi', 'rgba(52, 211, 153, 0.95)') : cssColor('--meter-ok', 'rgba(16, 185, 129, 0.65)');
        rr(mctx, (mw - (bars * bw + (bars - 1) * gap)) / 2 + i * (bw + gap), (mh - bh) / 2, bw, bh, bw / 2);
        mctx.fill();
      }
    } else {
      mctx.fillStyle = 'rgba(255,255,255,0.25)';
      mctx.font = '11px Vazirmatn, sans-serif';
      mctx.textAlign = 'center';
      mctx.fillText('میکروفون متصل نیست', mw / 2, 24);
    }
    setTimeout(drawMeter, 80);
  }
  drawMeter();

  function detachMic() {
    if (isRecording || ave || wakeLoop) return; /* حین ضبط/جلسه/بیدارباش، استریم نباید بسته شود */
    if (micStream) { micStream.getTracks().forEach((t) => t.stop()); micStream = null; }
    if (audioCtx) { try { audioCtx.close(); } catch (_) { /* noop */ } audioCtx = null; }
    analyser = null; micData = null; micLive = false;
    sbMic.innerHTML = `<i class="dot err"></i>${t('mic.off')}`;
  }

  /* v0.60 (A7) — تنها گوش‌دهٔ devicechange سراسری برنامه: حذف/اضافهٔ دستگاه
     صوتی → کشِ میک باطل تا attach بعدی تازه بگیرد. تک‌ listener با گارد
     duplicate (بدون نشت شنونده)؛ حین جلسه/ضبط فقط لاگ — watchdog/attach
     بعدی بازسازی می‌کند */
  if (navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === 'function' && !window.__AVA_MIC_DEVCHANGE__) {
    window.__AVA_MIC_DEVCHANGE__ = true;
    navigator.mediaDevices.addEventListener('devicechange', () => {
      if (!analyser) return; /* چیزی برای باطل کردن نیست */
      if (isRecording || ave || wakeLoop) { actLog('mic: devicechange during active use — watchdog/next attach rebuilds'); return; }
      actLog('mic: devicechange — cached mic invalidated, next attach rebuilds');
      detachMic();
    });
  }

  async function startAudioRec() {
    if (isRecording) return t('rec.busy');
    if (!window.MediaRecorder) return t('rec.noSupport');
    const ok = await attachMic();
    if (!ok) return t('rec.needMic');
    try {
      recChunks = [];
      mediaRec = new MediaRecorder(micStream);
      mediaRec.ondataavailable = (e) => { if (e.data && e.data.size) recChunks.push(e.data); };
      mediaRec.start();
      isRecording = true;
      micLive = true;
      sbMic.innerHTML = `<i class="dot rec"></i>${t('mic.rec')}`;
      statusText.textContent = t('rec.recording');
      return t('rec.on');
    } catch (_) {
      return t('rec.startFail');
    }
  }

  async function stopAudioRec() {
    if (!isRecording || !mediaRec || mediaRec.state === 'inactive') return t('rec.stopNone');
    const stopped = new Promise((res) => { mediaRec.onstop = res; });
    try { mediaRec.stop(); } catch (_) { /* noop */ }
    await stopped;
    isRecording = false;
    sbMic.innerHTML = `<i class="dot ok"></i>${t('mic.ready')}`;
    const blob = new Blob(recChunks, { type: (mediaRec && mediaRec.mimeType) || 'audio/webm' });
    recChunks = [];
    /* میکروفون برای اکولایزر واقعی روشن می‌ماند */
    if (!blob.size) return t('rec.empty');
    if (canRun && bridge.system.saveAudio) {
      try {
        const buf = new Uint8Array(await blob.arrayBuffer());
        const r = await bridge.system.saveAudio(buf);
        if (r && r.ok) return t('rec.saved', { x: r.path });
        return t('rec.saveFail', { x: (r && r.error) || '—' });
      } catch (_) { /* ادامه به پاسخ مرورگری */ }
    }
    return t('rec.size', { x: faNum(Math.round(blob.size / 1024)) });
  }

  const N = 52;
  const levels = new Array(N).fill(0.06);
  let t0 = 0, energy = 0.06, lastFrameT = performance.now();
  refreshWaveColors();
  function rr(c, x, y, w, hgt, r) {
    if (c.roundRect) { c.beginPath(); c.roundRect(x, y, w, hgt, r); return; }
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + hgt, r);
    c.arcTo(x + w, y + hgt, x, y + hgt, r);
    c.arcTo(x, y + hgt, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  /* زمان‌بندی تطبیقی حلقه (بهینه‌سازی CPU — v0.12):
     در حالت فعال ۶۰fps، اما در حالت عادی پس از نشستن میله‌ها حلقه
     فقط هر ۲۵۰ میلی‌ثانیه بیدار می‌شود — GPU و CPU آسوده می‌مانند */
  const schedFrame = (ms) => { if (ms <= 0) requestAnimationFrame(frame); else setTimeout(frame, ms); };
  function frame() {
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameT) / 1000));
    lastFrameT = now;
    const active = state !== 'idle';
    if (active) idleSettled = false;
    /* سکون کامل: میله‌ها ثابت‌اند — بدون رندر مجدد، فقط بیدار شدن کم‌نرخ */
    if (!active && idleSettled && !waveDirty) { schedFrame(250); return; }
    t0 += dt;
    /* طیف واقعی میکروفون فقط وقتی خوانده می‌شود که کاربر دکمه میکروفون را
       زده باشد (حالت گوش دادن) — در حالت عادی اکولایزر کاملاً ثابت می‌ماند */
    if (state === 'listening' && analyser && micData && micLive) {
      try { analyser.getByteFrequencyData(micData); } catch (_) { /* noop */ }
    }
    /* انرژی هدف بر اساس حالت: گوش دادن = بلند، پردازش/موفق = موج ملایم، عادی = سکون */
    const target = state === 'listening' ? 0.88 : state === 'processing' ? 0.4 : state === 'success' ? 0.5 : 0.0;
    energy += (target - energy) * (1 - Math.exp(-dt * 5));
    ctx.clearRect(0, 0, W, H);
    const mid = H / 2;
    const gap = 4;
    const bw = Math.max(2, Math.min(4.5, (W - (N - 1) * gap) / N));
    const startX = (W - (N * bw + (N - 1) * gap)) / 2;
    for (let i = 0; i < N; i++) {
      const env = Math.sin((Math.PI * i) / (N - 1));
      let lvl;
      if (state === 'idle') {
        /* حالت عادی: میله‌های کوتاه ثابت — بدون هیچ حرکتی */
        lvl = 0.055;
      } else if (state === 'listening' && micData && micLive) {
        /* صدای واقعی میکروفون */
        const bins = Math.floor(micData.length * 0.72);
        const bi = Math.min(micData.length - 1, Math.floor(Math.pow(i / N, 1.55) * bins));
        const raw = micData[bi] / 255;
        lvl = Math.max(0.05, Math.min(1, raw * 1.6 * (0.35 + 0.65 * env)));
      } else if (state === 'processing' || state === 'success') {
        /* موج سینوسی نرم و بی‌پرش (بدون تصادف) */
        const n = Math.sin(t0 * 2.4 + i * 0.52) * 0.6 + Math.sin(t0 * 1.1 + i * 0.19) * 0.4;
        lvl = Math.max(0.05, Math.min(1, energy * env * (0.5 + 0.5 * Math.abs(n))));
      } else {
        lvl = 0.055;
      }
      levels[i] += (lvl - levels[i]) * Math.min(1, dt * 14);
      const bh = Math.max(3, levels[i] * (H - 8));
      const g = ctx.createLinearGradient(0, mid - bh / 2, 0, mid + bh / 2);
      g.addColorStop(0, waveCols.c1);
      g.addColorStop(0.5, waveCols.mid);
      g.addColorStop(1, waveCols.c2);
      ctx.fillStyle = g;
      rr(ctx, startX + i * (bw + gap), mid - bh / 2, bw, bh, bw / 2);
      ctx.fill();
    }
    waveDirty = false;
    idleSettled = !active && energy < 0.02 && levels.every((l) => Math.abs(l - 0.055) < 0.004);
    schedFrame(!active && idleSettled ? 250 : 0);
  }
  schedFrame(0);

  /* ---------- قوانین فرمان‌ها ----------
     k = الگوی شنیدن | t = توست | i = آیکون | r = متن پاسخ
     run = شناسه فرمان واقعی ویندوز | arg = آرگومان استخراجی */
  /* v0.41 — دایرهٔ لغاتِ جستجوی وب بازتر شد: «گوگل کن»، «سرچش کن»،
     «جستجوش کن»، «پیداش کن»، «برام سرچ کن»، «سرچش کن تو گوگل» … */
  const stripSearch = (c) =>
    c.replace(/(لطفا|لطفاً)/g, '')
      .replace(/(در|توی|تو)\s+(گوگل|google)/gi, '')
      .replace(/(در\s+)?(گوگل|google)/gi, '')
      /* v0.36 — پرت‌گوی‌ها جزو عبارت جستجو نیستند («بابا دیگه ممنون») */
      .replace(/(^|\s)(بابا|دیگه|دیگ|خب|خوب|ممنون|مرسی|واسه|برام|برای\s*من|واسم|الان)(?=\s|$)/gi, '$1')
      /* v0.60 (A9) — «رو/را» فقط واژهٔ مستقل برده می‌شود نه داخل کلمات
         («سرچ کن قیمت سرو کاج» → «سرو کاج» سالم می‌ماند، نه «س کاج») */
      .replace(/(^|\s)(را|رو)\s+/g, '$1')
      .replace(/(جستجو|جستجوی|سرچ|سیرچ|سارچ|پیداش?|search)[\s\u200C]*(ش)?\s*(کن|بکن|بزن|بگیر|میکنی|می\s*کنی)?[\s\u200C]*ی?[\s\u200C]*/gi, '')
      .replace(/\s+ی(?=\s|$)/g, ' ')
      .replace(/[\s\u200C]+/g, ' ')
      .trim();

  /* ============================================================
     v0.50 — استخراج عبارت جستجو به voiceIntent.js منتقل شد (AVAIntent.ytQueryOf)
     تا بدون Electron هم تست شود. سه لایهٔ جدید آن:
     ۱) برش جمله‌وارهٔ ارجاعی «که…» («آهنگ X که چند لحظه پیش بهم گفتی…» → «آهنگ X»)
        ولی نامِ محتوایی که خودش «که» دارد قربانی نمی‌شود («آهنگی که اسمش دیوونه شوه»)
     ۲) «بهم» جزو فیلرها
     ۳) سنجاق سلامت: سوال‌محور/ارجاعی/۶+ توکن = زباله → '' (جمله به AI می‌رود)
     (ریشهٔ واقعی لاگ: «همین آهنگ شادمهر که…بهم گفتی…همون اسمو سرچ کن» که
     کلِ جمله در یوتیوب سرچ می‌شد)
     ============================================================ */
  const ytQueryOf = (c) => {
    try { return (typeof AVAIntent !== 'undefined' && AVAIntent.ytQueryOf) ? AVAIntent.ytQueryOf(c) : ''; }
    catch (_) { return ''; }
  };

  /* ============================================================
     v0.50 — رجیستری و بازسازی URL به voiceSites.js منتقل شد (AVASites).
     v0.50 شهر-محور شد (خواستهٔ کاربر: «شهر بجن را اول لینک ننویس — ببین
     خود سایت چه‌جوری در هر شهری سرچ می‌شود»):
     • سند لاگ v0.49 خط ۱۵۸۴: AI لینک توهمی divar.ir/s/bojnurd/mot ساخت → ۴۰۴ واقعی
     • قالب واقعی دیوار: divar.ir/s/{شهر-لاتین}?q=… (bojnurd?q=موتور = 200 OK)
     • نسخهٔ قبل شهر را دور می‌ریخت و همه‌چیز را tehran می‌کرد — «بجنورد» می‌شد «تهران»
     • نقشهٔ شهرها (بجنورد→bojnurd…) + حفظ دسته‌های واقعی دیوار + decode سگمنت‌ها
     ============================================================ */
  function siteUrlFix(url) {
    try { return (typeof AVASites !== 'undefined' && AVASites.siteUrlFix) ? AVASites.siteUrlFix(url) : url; }
    catch (_) { return url; }
  }
  /* ============================================================
     v0.28 — باز کردن مستقیم سایت: «برو به سایت دیجی کالا»
     دیگر «برو به» در گوگل سرچ نمی‌شود؛ دیکشنری سایت‌های معروف
     (فارسی + انگلیسی) مستقیم URL می‌دهد، دامنهٔ خام هم باز می‌شود.
     ============================================================ */
  const KNOWN_SITES = [
    ['دیجی کالا', 'https://www.digikala.com'], ['دیجی\u200Cکالا', 'https://www.digikala.com'], ['digikala', 'https://www.digikala.com'],
    ['آپارات', 'https://www.aparat.com'], ['اپارات', 'https://www.aparat.com'], ['aparat', 'https://www.aparat.com'],
    ['فیلیمو', 'https://www.filimo.com'], ['filimo', 'https://www.filimo.com'],
    ['نماوا', 'https://www.namava.ir'], ['namava', 'https://www.namava.ir'],
    ['ترب', 'https://torob.com'], ['torob', 'https://torob.com'],
    ['اسنپ', 'https://snapp.ir'], ['snapp', 'https://snapp.ir'],
    ['تپسی', 'https://tapsi.ir'], ['tapsi', 'https://tapsi.ir'],
    ['بازاره', 'https://basalam.com'], ['باسلام', 'https://basalam.com'], ['basalam', 'https://basalam.com'],
    ['ایران سل', 'https://www.irancell.ir'], ['ایرانسل', 'https://www.irancell.ir'], ['همراه اول', 'https://www.mci.ir'],
    ['بانک ملت', 'https://bankmellat.ir'], ['بانک ملی', 'https://www.bmi.ir'], ['بانک صادرات', 'https://bsi.ir'],
    ['جیمیل', 'https://mail.google.com'], ['gmail', 'https://mail.google.com'],
    ['توییتر', 'https://x.com'], ['تویتر', 'https://x.com'], ['twitter', 'https://x.com'], ['ایکس', 'https://x.com'],
    ['اینستاگرام', 'https://www.instagram.com'], ['insta', 'https://www.instagram.com'], ['instagram', 'https://www.instagram.com'],
    ['واتساپ', 'https://web.whatsapp.com'], ['whatsapp', 'https://web.whatsapp.com'],
    ['تلگرام وب', 'https://web.telegram.org'], ['telegram web', 'https://web.telegram.org'],
    ['گیت هاب', 'https://github.com'], ['گیت\u200Cهاب', 'https://github.com'], ['github', 'https://github.com'],
    /* v0.47 — B16: حرف‌نوشت STT «گیتاب» (لاگ کاربر: ۴ بار تکرار «تو گیتاب سرچ کن خرید» که به گوگلِ زباله می‌رفت) */
    ['گیتاب', 'https://github.com'], ['گیت اب', 'https://github.com'], ['گیتـاب', 'https://github.com'],
    ['استک اورفلو', 'https://stackoverflow.com'], ['stack overflow', 'https://stackoverflow.com'],
    ['ویکی پدیا', 'https://fa.wikipedia.org'], ['ویکی\u200Cپدیا', 'https://fa.wikipedia.org'], ['wikipedia', 'https://wikipedia.org'],
    ['دیجی استایل', 'https://style.digikala.com'], ['کافه بازار', 'https://cafebazaar.ir'], ['بازار', 'https://cafebazaar.ir'],
    /* v0.36 — سایت‌های پرکاربرد ایرانی (ریشهٔ «سایت سافت 98 که خیلی خوبه رو باز کن»
       که سرچ می‌شد: سافت 98 در دیکشنری نبود) — اسمِ عددی هم با حروف پوشیده شده */
    ['سافت 98', 'https://soft98.ir'], ['سافت98', 'https://soft98.ir'], ['سافت ۹۸', 'https://soft98.ir'], ['سافت۹۸', 'https://soft98.ir'],
    ['سافت نود و هشت', 'https://soft98.ir'], ['سافت نودوهشت', 'https://soft98.ir'], ['soft98', 'https://soft98.ir'],
    ['دانلودها', 'https://downloadha.com'], ['دانلود ها', 'https://downloadha.com'], ['downloadha', 'https://downloadha.com'],
    ['زومیت', 'https://www.zoomit.ir'], ['zoomit', 'https://www.zoomit.ir'],
    ['دیجیاتو', 'https://www.digiato.com'], ['digiato', 'https://www.digiato.com'],
    ['نی نی سایت', 'https://www.ninisite.com'], ['نینی سایت', 'https://www.ninisite.com'], ['ninisite', 'https://www.ninisite.com'],
    /* v0.41 — گسترش دایرهٔ سایت‌های معروف (درخواست کاربر: «دایرهٔ لغات را بیشتر کن») */
    ['ورزش سه', 'https://www.varzesh3.com'], ['ورزش۳', 'https://www.varzesh3.com'], ['ورزش ۳', 'https://www.varzesh3.com'], ['varzesh3', 'https://www.varzesh3.com'],
    ['نمناک', 'https://www.namnak.com'], ['namnak', 'https://www.namnak.com'],
    ['ویرگول', 'https://virgool.io'], ['virgool', 'https://virgool.io'],
    ['رددیت', 'https://www.reddit.com'], ['reddit', 'https://www.reddit.com'],
    ['آمازون', 'https://www.amazon.com'], ['amazon', 'https://www.amazon.com'],
    ['اوکالا', 'https://okala.com'], ['کوئرا', 'https://quera.org'], ['quera', 'https://quera.org'],
    ['پونیشا', 'https://ponisha.ir'], ['کارلنسر', 'https://karlancer.com'],
    ['مایکت', 'https://myket.ir'], ['myket', 'https://myket.ir'],
    ['نوبیتکس', 'https://nobitex.ir'], ['والکس', 'https://wallex.ir'],
    ['آپارت', 'https://www.aparat.com'], ['اپارت', 'https://www.aparat.com'], /* رایج‌ترین خطای تلفظ STT */
    ['فرادرس', 'https://faradars.org'], ['faradars', 'https://faradars.org'],
    ['مکتب خونه', 'https://maktabkhooneh.org'], ['مکتب\u200Cخونه', 'https://maktabkhooneh.org'], ['maktabkhooneh', 'https://maktabkhooneh.org'],
    ['گوگل', 'https://www.google.com'], ['یوتیوب', 'https://www.youtube.com'], ['youtube', 'https://www.youtube.com'],
  ];
  const SITE_NAV_STRIP =
    /(لطفا|لطفاً|می\u200Cخوام|میخوام|برام|برای\s*من|وارد\s*شو\s*به|وارد\s*شو|وارد\s*کن|وارد|برو\s*به|برو\s*تو|برو|باز\s*کن|باز\s*بکن|بکن|کن\s*باز|رفتن|بریم|بساز)/gi;
  const SITE_WORD_STRIP = /^(سایت|وب\s?سایت|سایتِ|website|web\s?site|the\s+site|site)\s*(از|ی|of|for)?\s*/gi;
  /* نرمال‌سازی مقایسه: نیم‌فاصله/فاصله‌های تکراری + عربی‌به‌فارسی */
  const siteNorm = (s) => String(s || '')
    .replace(/[\u200C]/g, ' ')
    .replace(/[ك]/g, 'ک').replace(/[يی]/g, 'ی').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ؤ/g, 'و')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  function knownSiteOf(cmd) {
    const s = siteNorm(faToEn(String(cmd || '')));
    if (!s) return null;
    for (const [name, url] of KNOWN_SITES) {
      const n = siteNorm(name);
      if (!n) continue;
      if (s === n || s.includes(n) || (n.includes(s) && s.length >= 3)) return url;
    }
    return null;
  }
  /* v0.41 — تطبیق «دقیق» اسم سایت: برای اسکن پیشوندیِ پارسر جستجوی درون-سایتی —
     «دیجی» ناقص نباید دیجی‌کالا بخورد وگرنه باقی جمله («کالا این ساعت…»)
     عبارت پرسشِ آلوده می‌شد */
  function knownExactOf(cmd) {
    const s = siteNorm(faToEn(String(cmd || '')));
    if (!s) return null;
    for (const [name, url] of KNOWN_SITES) {
      if (s === siteNorm(name)) return url;
    }
    return null;
  }
  /* v0.41 — کدام اسم معروف داخل جمله است؟ ({name,url,norm} — name برای نمایش،
     norm شکلِ نرمال‌شدهٔ واقعی داخل جمله برای حذف تمیز از متن) */
  function knownNameOf(cmd) {
    const s = siteNorm(faToEn(String(cmd || '')));
    if (!s) return null;
    /* بلندترین اسم اول — «کافه بازار» قبل از «بازار» */
    let best = null;
    for (const [name, url] of KNOWN_SITES) {
      const n = siteNorm(name);
      if (n && n.length >= 3 && s.includes(n) && (!best || n.length > best.norm.length)) {
        best = { name, url, norm: n };
      }
    }
    return best;
  }
  /* دامنهٔ خام داخل جمله: «باز کن app.example.ir» → app.example.ir */
  function siteDomainOf(cmd) {
    const s = siteNorm(faToEn(String(cmd || '')));
    const m = s.match(/(?:https?:\/\/)?((?:[a-z0-9-]+\.)+(?:com|ir|net|org|io|dev|co|app|shop|xyz|me|tv|info|biz|online|site)(?:\/\S*)?)/i);
    return m ? m[1] : null;
  }
  /* اسم تمیز سایت برای فالبکِ جستجو — «برو به سایت دیجی کالا» → «دیجی کالا» */
  function cleanSiteQuery(cmd) {
    let s = String(cmd || '');
    s = s.replace(SITE_NAV_STRIP, ' ').replace(/[\s\u200C]+/g, ' ').trim(); /* v0.28.1: تریم قبل از ریشهٔ «سایت» */
    s = s.replace(SITE_WORD_STRIP, ' ');
    /* v0.36 — بند وابستهٔ «که …» جزو اسم سایت نیست («سافت 98 که خیلی خوبه» → «سافت 98») */
    s = s.replace(/\s+که\s+[\s\S]*$/i, ' ');
    s = s.replace(/\s*(از|در|تو|توی)\s+(سایت|وب\s?سایت)\s*/gi, ' ');
    s = s.replace(/(سایت|وب\s?سایت)\s*(رو|را)?\s*$/gi, ' ');
    s = s.replace(/[\s\u200C]+/g, ' ').trim();
    s = s.replace(/^(رو|را|به|تو|ی)\s+/i, '').replace(/\s+(رو|را)$/i, '');
    return s.length >= 2 ? s.slice(0, 60) : '';
  }
  /* v0.36 — استخراج مستقیم اسم سایت از الگوی «سایت X رو باز کن» —
     «سایت سافت 98 که خیلی خوبه رو باز کن» → «سافت 98» */
  function siteTargetOf(cmd) {
    const m = String(cmd || '').match(/(?:سایت|وب\s?سایت|صفحه)\s+(?:از\s+)?(.+?)\s*(?:رو|را)\s*باز/i);
    let s = m && m[1] ? m[1] : '';
    s = s.replace(/\s+که\s+[\s\S]*$/i, '').replace(/[\s\u200C]+/g, ' ').trim();
    return s.length >= 2 ? s.slice(0, 60) : '';
  }
  /* v0.28 — دروازهٔ فرمان‌های دیسکورد: «تماس/کال/call» هم بدون اسم دیسکورد
     پذیرفته می‌شود (ریشهٔ «تماس رو قطع کن کار نمی‌کند»: دروازه قبلی فقط
     با «دیسکورد/زنگ بزن/تماس بگیر» روشن می‌شد) */
  const DISC_GATE_RE = /زنگ\s*بزن|تماس|کال|call\b|دیسکورد|discord|میکروفون[^.]{0,10}(قطع|میوت)|دیفن|دی\s?فن|deafen/i;

  const JOKES = [
    'به برنامه‌نویس میگن چقدر طول می‌کشد این کار تموم شه؟ میگه دو دقیقه… بعد دو هفته برمی‌گردد!',
    'دو تا بایت به هم می‌رسند؛ یکی می‌پرسد حالت چطوره؟ می‌گوید یکم بیت‌دارم!',
    'چرا کامپیوترها هیچ‌وقت گرسنه نمی‌شوند؟ چون همیشه چیپس دارند!',
    'به یارو میگن گوشی‌ات را ریست کن، میگه چرا، خوبه! میگن نه، تو که رِست (رستوران) رفتی برگرد!',
    'دنیا بدون کامپیوتر چه شکلی بود؟ کسی نمی‌داند؛ هیچ‌کس آن‌قدر صبر نکرد!',
  ];
  const JOKES_EN = [
    'A programmer was told the task takes two minutes… he came back two weeks later!',
    'Why do computers never get hungry? Because they always have chips!',
    'There are 10 kinds of people: those who understand binary and those who do not.',
    'Why did the developer go broke? Because he used up all his cache!',
  ];
  const joke = () => (LANG === 'en' ? JOKES_EN : JOKES)[Math.floor(Math.random() * (LANG === 'en' ? JOKES_EN : JOKES).length)];

  /* --- آب‌وهوا واقعی (Open-Meteo، بدون کلید — درخواست از پروسه اصلی) --- */
  const WX_STRIP =
    /(لطفا|لطفاً|آب[\s\u200C]*و[\s\u200C]*هوا(ی)?|اب[\s\u200C]*و[\s\u200C]*هوا(ی)?|هوا(ی)?|درجه(ی)?|دما(ی)?|چطوره?|چند\s*درجه|چنده|چیه|چیکار|امروز|الان|فردا|بگو|بده|شهر|است|می\s*خوام|در|تو|رو|یک|یه)/gi;
  const WX_STRIP_EN =
    /\b(please|the|a|an|weather|temperature|forecast|what(?:'s| is)|how(?:'s| is)|it|today|now|tomorrow|tell|me|give|city|in|of|like|degrees?)\b/gi;
  /* v0.29.2 — حروف اضافهٔ سر و ته جملهٔ شهر («بجنورد را بهم بگو» → تا دیروز
     «بجنورد را بهم» به سرویس می‌رفت و «شهری به نام بجنورد را بهم پیدا نشد»
     برمی‌گشت — ریشهٔ گزارش کاربر). فقط کل‌واژه‌های لبهٔ رشته بریده می‌شوند تا
     اسم شهرها (مثل «میانه») آسیب نبیند. */
  const WX_EDGE =
    /(^|\s)(را|رو|بهم|برام|برایم|نشون|نشونم|نشان|نشانم|تو|در|از|برای|میخوام|می‌خوام)(?=\s|$)/gi;

  /* v0.29.2 — نشانهٔ ارجاع به هوش مصنوعی: قانونی که درخواست را «می‌فهمد» ولی
     نمی‌تواند انجامش دهد (شهر پیدا نشد / شبکه / پارس ریاضی) دیگر بن‌بست نیست؛
     runCommand این نشانه را می‌بیند و درخواست را به تحلیل هوش مصنوعی می‌دهد */
  const AI_FALLBACK = Object.freeze({ __aiFallback: true });
  /* v0.43 — نامزدهای داوری نیتِ همان جمله (برای پیام AI) */
  let _intentCands = '';

  /* ============================================================
     v0.44 — دروازهٔ «فهم-اول» (درخواست صریح کاربر:
     «اول تحلیل کنه و واقعاً بفهمه این چیه؛ اگه نفهمید بده gemini
     انجام بده کار رو» + «توی دیوار دنبال موتور بگرد، نره گوگل سرچ کنه»)
     هدفِ درون-جمله‌ای («توی X»، «سایت X») که در فهرست‌های محلی حل
     نشود هرگز با حدسِ جستجوی عمومی اجرا نمی‌شود — به AI برمی‌گردد.
     نمونه‌پچی ممنوع: هیچ اسمی به دیکشنری اضافه نمی‌شود؛ تحلیل ساختاری است.
     ============================================================ */
  function targetResolvableSync(t) {
    const s = String(t || '').trim();
    if (!s || s.length < 2) return true;
    try { if (knownExactOf(s) || knownSiteOf(s) || siteDomainOf(s)) return true; } catch (_) { /* noop */ }
    try { if (sysApps.list && sysApps.list.length && matchSysApp(s)) return true; } catch (_) { /* noop */ }
    return false;
  }

  /* v0.45 — رزول‌شدنیِ «وبی» برای دروازهٔ فهم-اول: برای قوانین خانوادهٔ وب
     (web_search/web_open/…)، «برنامهٔ نصب‌شده بودنِ هدف» کافی نیست —
     «توی تلگرام دنبال پیام بگرد» نباید گوگل‌سرچ شود؛ باید برود AI تصمیم
     بگیرد (باز کردن برنامه / جستجوی درون‌برنامه‌ای ممکن نیست → صادق بگوید).
     برنامه‌بودنِ هدف فقط برای قوانین غیروب رزول‌شدنی است (targetResolvableSync). */
  function targetResolvableWebSync(t) {
    const s = String(t || '').trim();
    if (!s || s.length < 2) return true;
    try { if (knownExactOf(s) || knownSiteOf(s) || siteDomainOf(s)) return true; } catch (_) { /* noop */ }
    return false;
  }

  function wxExtractCity(c) {
    let city = String(c || '')
      .replace(WX_STRIP, ' ')
      .replace(/[0-9۰-۹?؟!.,،:;]+/g, ' ');
    for (let i = 0; i < 4; i++) {
      const before = city;
      city = city.replace(WX_EDGE, ' ').replace(/[\s\u200C]+/g, ' ').trim();
      if (city === before) break;
    }
    return city.trim();
  }

  async function weatherReply(c) {
    if (!bridge || !bridge.system || !bridge.system.weather) {
      return t('weather.onlyApp');
    }
    const city = wxExtractCity(c);
    const r = await bridge.system.weather(city || 'تهران');
    if (r && r.ok) {
      return t('weather.reply', { city: r.name, desc: LANG === 'en' ? (r.descEn || r.desc) : r.desc, temp: faNum(r.temp), feels: faNum(r.feels), hum: faNum(r.hum), wind: faNum(r.wind) });
    }
    /* v0.29.2 — دیگر هیچ خطای آب‌وهوایی بن‌بست نیست: درخواست به هوش مصنوعی
       ارجاع می‌شود (GLM/Gemini). گزارش کاربر: «ارجاع نمیده به ای آی» */
    actLog('weather fail → AI fallback (city=' + (city || 'تهران')
      + ', netFail=' + String(!!(r && r.netFail))
      + '): ' + String((r && r.error) || '').slice(0, 80));
    return AI_FALLBACK;
  }

  /* --- ماشین‌حساب صوتی: تبدیل جمله فارسی به عبارت ریاضی امن --- */
  const FA_WORD_NUM = {
    صفر: 0, یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, هفت: 7, هشت: 8, نه: 9, ده: 10,
    یازده: 11, دوازده: 12, سیزده: 13, چهارده: 14, پانزده: 15, پونزده: 15, شانزده: 16, هفده: 17, هجده: 18, نوزده: 19,
    بیست: 20, سی: 30, چهل: 40, پنجاه: 50, شصت: 60, هفتاد: 70, هشتاد: 80, نود: 90, صد: 100, هزار: 1000,
  };
  function parseMath(c) {
    let s = faToEn(String(c)).toLowerCase();
    s = s.replace(/(هزار|صد|نود|هشتاد|هفتاد|شصت|پنجاه|چهل|سی|بیست|نوزده|هجده|هفده|شانزده|پونزده|پانزده|چهارده|سیزده|دوازده|یازده|ده|نه|هشت|هفت|شش|پنج|چهار|سه|دو|یک|صفر)/g,
      (w) => ` ${FA_WORD_NUM[w]} `);
    s = s
      .replace(/به\s*علاوه|بعلاوه|بهم\s*اضافه|جمع|plus/g, '+')
      .replace(/منهای|منها|منها|لا\s*منها/g, '-')
      .replace(/ضرب\s*در|ضربدر|ضرب|times/g, '*')
      .replace(/تقسیم\s*بر|تقسیم|divided/g, '/')
      .replace(/چند\s*می\s*شود|چند\s*میشه|چندمه|چنده|مساوی|محاسبه|حساب\s*کن|به\s*من\s*بگو|میشه|می\s*شود|درصد/g, ' ');
    s = s.replace(/[^0-9+\-*/().\s]/g, '').replace(/\s+/g, '');
    if (!s || !/[+\-*/]/.test(s)) return null;
    if (!/^[0-9+\-*/().]+$/.test(s)) return null;
    if (/\d{8,}/.test(s)) return null;
    let val;
    try { val = Function('"use strict";return (' + s + ')')(); } catch (_) { return null; }
    if (typeof val !== 'number' || !isFinite(val)) return null;
    return { expr: s, val };
  }
  function calcReply(c) {
    const m = parseMath(c);
    if (!m) {
      /* v0.29.2 — جملهٔ حسابی که پارس نشد بن‌بست نیست → هوش مصنوعی */
      actLog('calc parse fail → AI fallback: ' + String(c || '').slice(0, 60));
      return AI_FALLBACK;
    }
    const v = Math.round(m.val * 1000) / 1000;
    return t('calc.reply', { x: faNum(m.expr.replace(/\*/g, '×').replace(/\//g, '÷')), y: faNum(String(v)) });
  }

  /* ============================================================
     v0.31.0 — فیوچرهای جدید
     ۱) قیمت لحظه‌ای ارز/طلا/سکه/رمزارز (tgju — بدون کلید، مسیر cloudFetch)
     ۲) اوقات شرعی ۱۰۰٪ آفلاین (محاسبهٔ نجومی — روش ژئوفیزیک دانشگاه تهران)
     ۳) یادداشت صوتی ماندگار (ava-notes.json)
     ۴) تاریخ میلادی به‌عنوان مکمل تاریخ شمسی
     ============================================================ */

  /* --- ۱) قیمت‌ها -------------------------------------------------- */
  const moneyFa = (n) => faNum(String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','));
  /* عدد بزرگ تومان به خوانا: «۱۶٫۳ میلیارد تومان» */
  const bigToman = (n) => {
    if (n >= 1e9) return faNum((Math.round(n / 1e8) / 10).toFixed(1)).replace('.0', '') + ' میلیارد تومان';
    if (n >= 1e6) return faNum(Math.round(n / 1e6)) + ' میلیون تومان';
    return moneyFa(n) + ' تومان';
  };
  /* unit: toman = ریال÷۱۰ | usd = دلار | dual = دلاری + تومانی (-irr) */
  const RATE_MAP = [
    { id: 'ounce', fa: 'انس جهانی طلا', unit: 'usd', keys: ['ons'], rx: /انس\s*جهانی|انس\s*طلا|اونس\s*جهانی|ounce/i },
    { id: 'gold18', fa: 'طلای ۱۸ عیار', unit: 'toman', keys: ['geram18'], rx: /طلای?\s*(۱۸|18)|گرم\s*طلا|طلای?\s*عیار|طلا(?!یی)/i },
    { id: 'mesghal', fa: 'مثقال طلا', unit: 'toman', keys: ['mesghal'], rx: /مثقال/i },
    { id: 'dollar', fa: 'دلار', unit: 'toman', keys: ['price_dollar_rl'], rx: /دلار|دولار|dollar/i },
    /* v0.38.1 — \b با حروف فارسی کار نمی‌کند؛ lookahead جایگزین شد */
    { id: 'euro', fa: 'یورو', unit: 'toman', keys: ['price_eur'], rx: /یورو|ارو(?![\u0600-\u06FF])|euro/i },
    { id: 'pound', fa: 'پوند', unit: 'toman', keys: ['price_gbp'], rx: /پوند|pound/i },
    { id: 'dirham', fa: 'درهم', unit: 'toman', keys: ['price_aed'], rx: /درهم|dirham/i },
    { id: 'nim', fa: 'نیم سکه', unit: 'toman', keys: ['nim'], rx: /نیم\s*سکه/i },
    { id: 'rob', fa: 'ربع سکه', unit: 'toman', keys: ['rob'], rx: /ربع\s*سکه/i },
    { id: 'gerami', fa: 'سکه گرمی', unit: 'toman', keys: ['gerami'], rx: /سکه\s*گرمی|گرمی/i },
    { id: 'bahar', fa: 'سکه بهار آزادی', unit: 'toman', keys: ['sekeb'], rx: /بهار\s*آزادی|سکه\s*بهار/i },
    { id: 'emami', fa: 'سکه امامی', unit: 'toman', keys: ['sekee'], rx: /امامی|سکه(?!‌ی)/i },
    { id: 'btc', fa: 'بیت‌کوین', unit: 'dual', keys: ['crypto-bitcoin', 'crypto-bitcoin-irr'], rx: /بیت\s?کوی?ین|bitcoin|\bbtc\b/i },
    { id: 'eth', fa: 'اتریوم', unit: 'dual', keys: ['crypto-ethereum', 'crypto-ethereum-irr'], rx: /اتریوم|ethereum|\beth\b/i },
    { id: 'usdt', fa: 'تتر', unit: 'dual', keys: ['crypto-tether', 'crypto-tether-irr'], rx: /تتر|tether|usdt/i },
    { id: 'sol', fa: 'سولانا', unit: 'dual', keys: ['crypto-solana', 'crypto-solana-irr'], rx: /سولانا|solana/i },
    { id: 'doge', fa: 'دوجکوین', unit: 'dual', keys: ['crypto-dogecoin', 'crypto-dogecoin-irr'], rx: /دوج|dogecoin|doge/i },
    { id: 'bnb', fa: 'بایننس کوین', unit: 'dual', keys: ['crypto-binance-coin', 'crypto-binance-coin-irr'], rx: /بایننس|binance/i },
  ];
  /* تشخیص خالص دارایی‌ها — تابع خالص برای تست خودکار (ترتیب مهم است) */
  function ratesDetect(c) {
    const s = String(c || '');
    const ids = RATE_MAP.filter((a) => a.rx.test(s)).map((a) => a.id);
    /* اولویت‌ها: «انس طلا» فقط انس، «نیم/ربع سکه» فقط خودش، «سکه» تنها = امامی */
    if (ids.includes('ounce') && ids.includes('gold18') && !/گرم\s*طلا/i.test(s)) {
      return ids.filter((x) => x !== 'gold18');
    }
    if (ids.includes('emami') && (ids.includes('nim') || ids.includes('rob') || ids.includes('gerami') || ids.includes('bahar')) && !/امامی/i.test(s)) {
      return ids.filter((x) => x !== 'emami');
    }
    return ids;
  }
  const rateTrend = (it) => {
    const dp = (it && it.dp) || 0;
    if (Math.abs(dp) < 0.05) return '';
    return (dp > 0 || (it && it.dt) === 'high') ? t('rates.up') : t('rates.down');
  };
  /* ساخت یک خط قیمت — تابع خالص برای تست (q = خروجی sys:rates) */
  function rateLine(id, q) {
    const a = RATE_MAP.find((x) => x.id === id);
    if (!a || !q) return '';
    const it = q[a.keys[0]];
    if (!it || !isFinite(it.p) || it.p <= 0) return '';
    const tr = rateTrend(it);
    if (a.unit === 'usd') return `${a.fa}: ${moneyFa(it.p)} ${t('rates.usd')}${tr ? ' — ' + tr : ''}`;
    if (a.unit === 'toman') return `${a.fa}: ${moneyFa(it.p / 10)}${tr ? ' — ' + tr : ''}`;
    /* dual: دلاری + تومانی از کلید -irr */
    const irr = q[a.keys[1]];
    const tom = irr && isFinite(irr.p) && irr.p > 0 ? ` (${t('rates.approx')} ${bigToman(irr.p / 10)})` : '';
    return `${a.fa}: ${moneyFa(it.p)} ${t('rates.usd')}${tom}${tr ? ' — ' + tr : ''}`;
  }
  async function ratesReply(c) {
    if (!bridge || !bridge.system || !bridge.system.rates) return t('rates.onlyApp');
    let ids = ratesDetect(c);
    if (!ids.length) ids = ['dollar', 'gold18', 'emami']; /* «ارز چنده» و امثالش → سبد خلاصه */
    const r = await bridge.system.rates();
    if (r && r.ok && r.q && typeof r.q === 'object') {
      const parts = ids.map((id) => rateLine(id, r.q)).filter(Boolean);
      if (parts.length) {
        actLog('rates ok: ' + ids.join(','));
        return parts.join('؛ ');
      }
      actLog('rates keys missing: ' + ids.join(',') + ' → AI fallback');
      return AI_FALLBACK; /* سرویس شکل عوض کرده → هوش مصنوعی */
    }
    actLog('rates fail → AI fallback (netFail=' + String(!!(r && r.netFail)) + '): ' + String((r && r.error) || '').slice(0, 80));
    return AI_FALLBACK;
  }

  /* --- ۲) اوقات شرعی (آفلاین کامل) --------------------------------- */
  /* هستهٔ نجومی — روش مؤسسهٔ ژئوفیزیک دانشگاه تهران
     (صبح ۱۷٫۷°، عشا ۱۴°، مغرب ۴٫۵° زیر افق، نیمه‌شب جعفری = وسط مغرب تا صبح
      فردا — همان تعریف تقویم رسمی ایران). اعتبارسنجی‌شده با سرویس aladhan
      method=7: اختلاف ۰-۱ دقیقه در ۵ شهر × ۳ تاریخ. واحد: ساعت اعشاری محلی. */
  function prayerTimesCore(lat, lng, date, tzOff) {
    const rad = Math.PI / 180;
    const dtr = (d) => d * rad;
    const rtd = (r) => r / rad;
    const fix = (a, b) => { const v = a - b * Math.floor(a / b); return v < 0 ? v + b : v; };
    const jd = (y, m, d) => {
      if (m <= 2) { y -= 1; m += 12; }
      const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
      return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
    };
    const sunPos = (jdp) => {
      const D = jdp - 2451545.0;
      const g = fix(357.529 + 0.98560028 * D, 360);
      const q = fix(280.459 + 0.98564736 * D, 360);
      const L = fix(q + 1.915 * Math.sin(dtr(g)) + 0.020 * Math.sin(dtr(2 * g)), 360);
      const e = 23.439 - 0.00000036 * D;
      const RA = fix(rtd(Math.atan2(Math.cos(dtr(e)) * Math.sin(dtr(L)), Math.cos(dtr(L)))) / 15, 24);
      const eqt = q / 15 - RA;
      const decl = rtd(Math.asin(Math.sin(dtr(e)) * Math.sin(dtr(L))));
      return { decl, eqt };
    };
    const baseJ = jd(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lng / (15 * 24);
    /* فاصلهٔ ساعت تا لحظه‌ای که خورشید به «زاویهٔ زیر افق» می‌رسد */
    const Tdeg = (angle) => {
      const { decl } = sunPos(baseJ + 0.5);
      const c = (-Math.sin(dtr(angle)) - Math.sin(dtr(decl)) * Math.sin(dtr(lat))) /
        (Math.cos(dtr(decl)) * Math.cos(dtr(lat)));
      if (c > 1 || c < -1) return null;
      return rtd(Math.acos(c)) / 15;
    };
    const sunEqt = () => sunPos(baseJ + 0.5).eqt;
    const dhuhr = 12 + tzOff - lng / 15 - sunEqt();
    const riseSet = (angle) => {
      const t = Tdeg(angle);
      return t == null ? null : { rise: dhuhr - t, set: dhuhr + t };
    };
    const rs083 = riseSet(0.833); /* طلوع/غروب: قطر قرص + شکست نور */
    const rs45 = riseSet(4.5);    /* مغرب روش تهران */
    const asrAngle = -rtd(Math.atan(1 / (1 + Math.tan(dtr(Math.abs(lat - sunPos(baseJ + 0.5).decl))))));
    const rsAsr = riseSet(asrAngle);
    const rs177 = riseSet(17.7);
    const rs14 = riseSet(14);
    /* نیمه‌شب شرعی جعفری: وسطِ غروبِ امروز تا اذان صبح فردا */
    const baseJ2 = jd(date.getFullYear(), date.getMonth() + 1, date.getDate() + 1) - lng / (15 * 24);
    const decl2 = sunPos(baseJ2 + 0.5).decl;
    const eqt2 = sunPos(baseJ2 + 0.5).eqt;
    const dhuhr2 = 12 + tzOff - lng / 15 - eqt2;
    const c2 = (-Math.sin(dtr(17.7)) - Math.sin(dtr(decl2)) * Math.sin(dtr(lat))) /
      (Math.cos(dtr(decl2)) * Math.cos(dtr(lat)));
    const fajr2 = (Math.abs(c2) <= 1) ? dhuhr2 - rtd(Math.acos(c2)) / 15 : null;
    const maghrib = rs45 ? rs45.set : (rs083 ? rs083.set + 0.15 : null);
    const midnight = (maghrib != null && fajr2 != null) ? maghrib + ((fajr2 + 24 - maghrib) / 2) : null;
    const f = (x) => (x == null ? null : Math.round(x * 60) / 60);
    return {
      fajr: f(rs177 ? rs177.rise : null),
      sunrise: f(rs083 ? rs083.rise : null),
      dhuhr: f(dhuhr),
      asr: f(rsAsr ? rsAsr.set : null),
      sunset: f(rs083 ? rs083.set : null),
      maghrib: f(maghrib),
      isha: f(rs14 ? rs14.set : null),
      midnight: f(midnight && midnight >= 24 ? midnight - 24 : midnight),
    };
  }
  const PR_LABELS = {
    fajr: ['اذان صبح', 'Fajr'], sunrise: ['طلوع آفتاب', 'Sunrise'], dhuhr: ['اذان ظهر', 'Dhuhr'],
    asr: ['اذان عصر', 'Asr'], sunset: ['غروب آفتاب', 'Sunset'], maghrib: ['اذان مغرب', 'Maghrib'],
    isha: ['اذان عشا', 'Isha'], midnight: ['نیمه‌شب شرعی', 'Midnight'],
  };
  const PR_STRIP =
    /(اوقات\s*شرعی|اوقات|شرعی|اذان|اذون|نماز|وقت|چند\s?مه|چنده|چند(?=\s|$)|چیه|بگو|لطفا|لطفاً|امروز|امشب|دیشب|الان|شهر|ساعت|عشر)/gi;
  const PR_NAMES =
    /(نیمه\s*شب|صبح|سحر|پیشین|طلوع|آفتاب(?!ی)|ظهر|عصر(?!ها)|غروب|مغرب|عشا|(?<![مب])شب(?!ه))/gi;
  function prWhich(c) {
    const s = String(c || '');
    const w = [];
    if (/نیمه\s*شب/i.test(s)) w.push('midnight');
    if (/صبح|سحر|پیشین/i.test(s)) w.push('fajr');
    if (/طلوع|آفتاب(?!ی)/i.test(s)) w.push('sunrise');
    if (/ظهر(?![^.]{0,6}(صبح|عصر|مغرب|عشا))/i.test(s) && !w.includes('dhuhr')) w.push('dhuhr');
    if (/عصر(?![^.]{0,6}(صبح|مغرب|عشا))/i.test(s)) w.push('asr');
    if (/غروب/i.test(s)) w.push('sunset');
    if (/مغرب/i.test(s)) w.push('maghrib');
    if (/عشا|شب(?!ه)/i.test(s) && !w.includes('midnight')) w.push('isha');
    return w.length ? w : ['fajr', 'sunrise', 'dhuhr', 'maghrib', 'isha'];
  }
  function prExtractCity(c) {
    let city = String(c || '')
      .replace(PR_STRIP, ' ')
      .replace(PR_NAMES, ' ')
      .replace(/[0-9۰-۹?؟!.,،:;]+/g, ' ');
    for (let i = 0; i < 4; i++) {
      const before = city;
      city = city.replace(WX_EDGE, ' ').replace(/[\s\u200C]+/g, ' ').trim();
      if (city === before) break;
    }
    return city.trim();
  }
  const prHM = (x) => {
    if (x == null) return '';
    let h = Math.floor(x), m = Math.round((x - h) * 60);
    if (m === 60) { h += 1; m = 0; }
    return faNum(String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'));
  };
  async function prayerReply(c) {
    if (!bridge || !bridge.system || !bridge.system.geo) return t('prayer.onlyApp');
    const city = prExtractCity(c) || 'تهران';
    const geo = await bridge.system.geo(city);
    if (!geo || !geo.ok) {
      actLog('prayer city unknown (' + city + ') → AI fallback');
      return AI_FALLBACK; /* شهر ناشناخته → هوش مصنوعی */
    }
    const tzOff = -new Date().getTimezoneOffset() / 60;
    const tm = prayerTimesCore(geo.lat, geo.lng, new Date(), tzOff);
    const which = prWhich(c);
    const parts = which
      .filter((k) => tm[k] != null)
      .map((k) => `${LANG === 'en' ? PR_LABELS[k][1] : PR_LABELS[k][0]} ${prHM(tm[k])}`);
    if (!parts.length) return t('prayer.fail');
    actLog('prayer ok: ' + (geo.name || city) + ' [' + which.join(',') + ']');
    return t('prayer.city', { city: geo.name || city, x: parts.join(' · ') });
  }

  /* --- ۳) یادداشت صوتی ماندگار ------------------------------------- */
  let NOTES = null;
  async function notesLoad() {
    if (NOTES) return NOTES;
    try {
      NOTES = (bridge && bridge.notes) ? (await bridge.notes.load() || []) : [];
    } catch (_) { NOTES = []; }
    if (!Array.isArray(NOTES)) NOTES = [];
    return NOTES;
  }
  /* تشخیص عملیات یادداشت — تابع خالص برای تست: {op, text} */
  function notesParseOp(c) {
    const s = String(c || '');
    if (/یادداشت[^.]{0,20}(پاک|حذف)|پاک[^.]{0,10}یادداشت|حذف[^.]{0,10}یادداشت|clear (my )?notes|delete (my )?notes/i.test(s)) {
      return { op: /همه|تمام|کل|all/i.test(s) ? 'delAll' : 'delLast' };
    }
    /* v0.69 — شکل‌های خواندن گسترده‌تر — ریشهٔ لاگ:
       «میگم همون اسمی که الان یادداشت کردیم با هم … ببینم چطور یادداشت کردیم»
       به چت AI رفت و هیچ محتوایی نشان داده نشد */
    if (/یادداشت[^.]{0,26}(بخون|بخوان|خوندن|نشون|لیست|کدوم|چی|چیه|چی\s?بود|چطور)|یادداشت\s*(کردیم|نوشتیم|کردم|نوشتم|شده|شد)|یادداشت‌?هام|یادداشت\s*ها|همون[^.]{0,20}یادداشت|همین[^.]{0,20}یادداشت|my notes|read (my )?notes|list notes/i.test(s)) {
      return { op: 'read' };
    }
    if (/یادداشت|note (down|to self)|take a note/i.test(s)) {
      let x = s
        .replace(/یادداشت\s*(کن|بکن|بنویس|بنیویس|ثبت\s*کن|اضافه\s*کن|بگیر)\s*(که|بازه|باشه|:|،)?/gi, ' ')
        .replace(/(بنویس|ثبت\s*کن|اضافه\s*کن|بگیر)[^.]{0,8}یادداشت/gi, ' ')
        .replace(/یادداشت(‌هام|ها|م)?/gi, ' ')
        .replace(/note (down|to self)|take a note/gi, ' ')
        /* v0.69 — عبارتِ ارجاعیِ آغازین حذف («همون اسمی که بهت گفتم بنویس…» —
           ریشهٔ لاگ: کل جمله به‌عنوان یادداشت ذخیره می‌شد) */
        .replace(/(?:همون|همین|اون)\s+[^.]{0,24}?\s+که\s+(?:بهت|به\s+تو|برات|برای\s+تو)\s+(?:گفتم|گفتی|گفتید|دادم)/gi, ' ')
        /* فقط حرف‌پرانه‌های «آغاز» بریده می‌شوند (نه همه‌جا — «یک ساعت» داخل
           متن یادداشت باید سالم بماند) + ZWNJ وای‌فای و امثالش حفظ می‌شود */
        .replace(/^([\s:,،]*(?:لطفا|لطفاً|یه|یک|یکی|که|بازه|باشه|و|بعد|بعدش)(?=\s|$)\s*)+/gi, ' ')
        .replace(/[\s:,،]+/g, ' ')
        .trim();
      x = x.replace(/^(رو|را|کن|بکن|بگو|بده|به\s*من)\s+/i, '').replace(/\s+(رو|را|کن|بکن)$/i, '').trim();
      return { op: 'add', text: x };
    }
    return { op: 'none' };
  }
  async function notesReply(c) {
    const op = notesParseOp(c);
    if (!bridge || !bridge.notes) return t('notes.onlyApp');
    if (op.op === 'read') {
      const arr = await notesLoad();
      if (!arr.length) return t('notes.empty');
      /* v0.69 — آخرین یادداشت در حافظهٔ گفتگو می‌نشیند (واقعیت‌های اخیر) */
      try { if (window.AVACore && window.AVACore._state && arr[0] && arr[0].x) window.AVACore._state.entities.note = String(arr[0].x).slice(0, 200); } catch (_) { /* noop */ }
      const lines = arr.slice(0, 8).map((n, i) => faNum(i + 1) + ') ' + String(n.x || '').slice(0, 80));
      actLog('notes read: ' + arr.length);
      return t('notes.list', { n: faNum(arr.length) }) + ' ' + lines.join(' — ') + (arr.length > 8 ? ' …' : '');
    }
    if (op.op === 'delLast') {
      const arr = await notesLoad();
      if (!arr.length) return t('notes.empty');
      const rem = arr.shift();
      NOTES = arr;
      const ok = await bridge.notes.save(arr);
      actLog('notes delLast ok=' + String(ok) + ' total=' + arr.length);
      return ok ? t('notes.deletedLast', { x: String((rem && rem.x) || '').slice(0, 80) }) : t('notes.saveFail');
    }
    if (op.op === 'delAll') {
      NOTES = [];
      const ok = await bridge.notes.save([]);
      actLog('notes delAll ok=' + String(ok));
      return ok ? t('notes.cleared') : t('notes.saveFail');
    }
    if (op.op === 'add') {
      const text = String(op.text || '').trim();
      if (text.length < 2) return t('notes.ask');
      /* v0.69 — تبدیل املایی لاتین: «اول انگلیسی یادداشت کن علی اچ کی وسطشم یه
         خط فاصله» → «Ali-HK» (ریشهٔ لاگ: متن خام ذخیره می‌شد) */
      let stored = text;
      try {
        const _lat = (typeof AVAMessaging !== 'undefined' && AVAMessaging.noteLatinOf) ? AVAMessaging.noteLatinOf(text) : null;
        if (_lat && _lat.out && _lat.out.length >= 2) stored = _lat.out;
      } catch (_) { /* noop */ }
      const arr = await notesLoad();
      arr.unshift({ t: Date.now(), x: stored.slice(0, 500) });
      const kept = arr.slice(0, 200);
      const ok = await bridge.notes.save(kept);
      if (ok) NOTES = kept;
      actLog('notes add ok=' + String(ok) + ' total=' + kept.length + ' x=' + String(stored).slice(0, 40));
      /* v0.69 — یادداشت تازه در حافظهٔ گفتگو می‌نشیند (واقعیت‌های اخیر —
       «دو دقیقه بعد یادش رفته» دیگر ممکن نیست) */
      try {
        if (window.AVACore && window.AVACore._state) {
          window.AVACore._state.entities.note = String(stored).slice(0, 200);
          if (/^[A-Za-z0-9 ._@\-]{2,40}$/.test(String(stored))) window.AVACore._state.entities.person = String(stored).slice(0, 80);
        }
      } catch (_) { /* noop */ }
      return ok ? t('notes.added', { n: faNum(kept.length), x: stored.slice(0, 90) }) : t('notes.saveFail');
    }
    return t('notes.ask');
  }

  /* ============================================================
     v0.42 — «اون یادداشتی که نوشتیم رو باز کن» — حافظهٔ محلی یادداشت‌ها
     (خواستهٔ کاربر: کامندنویسی برای این سخته؛ AI ببینه و باز کنه —
     مسیر محلیِ آنی + اکشن note_show برای مسیر هوش مصنوعی)
     query خالی یا بدون قطعهٔ قابل‌جستجو → آخرین یادداشت؛ وگرنه جستجوی متنی داخل متن یادداشت‌ها
     ============================================================ */
  async function openLastNote(query) {
    if (!bridge || !bridge.notes) return t('notes.onlyApp');
    const arr = await notesLoad();
    if (!arr.length) return t('notes.empty');
    const q = normFaFull(String(query || '')).toLowerCase().replace(/[\s\u200C]+/g, ' ').trim();
    let note = null;
    if (q && q.length >= 3) {
      /* قطعهٔ جستجو: واژه‌های اضافهٔ فرمانی حذف و بلندترین بخش زنده می‌ماند */
      const frag = q
        .replace(/(^|\s)(اون|همون|آخرین|قبلی|یادداشت|نوت|رو|را|باز|کن|بکن|نشون|بده|بخون|بگو|که|نوشتیم|بودیم|دوباره|برام|برای|من)(?=\s|$)/g, ' ')
        .replace(/[\s\u200C]+/g, ' ').trim();
      if (frag.length >= 3) note = arr.find((n) => normFaFull(String(n.x || '')).toLowerCase().includes(frag)) || null;
    }
    if (!note) note = arr[0]; /* جدیدترین */
    const when = note && note.t ? new Intl.DateTimeFormat(LANG === 'en' ? 'en-US' : 'fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(note.t)) : '';
    actLog('note open: ' + String((note && note.x) || '').slice(0, 40));
    return t('notes.open', { when, x: String((note && note.x) || '').slice(0, 220) });
  }

  const RULES = [
    /* --- پاور: خواب / خاموش / ریستارت / مانیتور (نسخه ۰.۱۰) ---
       v0.60 (A1) — run از این ۴ قانون حذف شد: resolveReply هم rule.r (runPower
       → bridge.system.run) و هم مسیر rule.run را اجرا می‌کرد — هر فرمان پاور
       دوبار اجرا می‌شد. حالا فقط r (یک اجرای واقعی، یک پاسخ). */
    {
      k: /لغو.{0,8}(خاموش|شات\s?داون)|انصراف.{0,8}(خاموش|ریستارت)|cancel.{0,8}(shutdown|restart)|abort.{0,8}shutdown/i, id: 'shutdown_abort', t: 'لغو خاموش شدن', i: '#i-power', run: 'shutdown_abort',
      r: () => runPower('shutdown_abort'),
    },
    { k: /(بخواب|خواب.{0,6}ببر|حالت.{0,6}خواب|به\s*خواب|sleep( now)?|go to sleep)/i, id: 'sleep', t: 'حالت خواب', i: '#i-moon', r: () => runPower('sys_sleep') },
    { k: /مانیتور.{0,10}خاموش|نمایشگر.{0,10}خاموش|خاموش.{0,10}مانیتور|خاموش.{0,10}نمایشگر|صفحه\s?(نمایشگر)?\s?(رو|را)?\s?خاموش\s?(کن|شه)|نور.{0,6}خاموش|turn off.{0,10}(monitor|screen|display)|monitor.{0,6}off/i, id: 'monitor_off', t: 'خاموش کردن مانیتور', i: '#i-monitor', r: () => runPower('monitor_off') },
    { k: /ری\s?استارت|ریستارت|راه\s?اندازی.{0,4}مجدد|restart|reboot/i, id: 'restart', t: 'راه‌اندازی مجدد', i: '#i-refresh', confirm: 'restart', r: () => runPower('sys_restart') },
    {
      /* v0.38.1 — «صدا رو خاموش کن» دیگر دیالوگ خاموشی PC باز نمی‌کرد!
         قبلاً گروهِ دستگاه اختیاری بود و «خاموش» تنها کافی بود؛ حالا باید
         دستگاه (کامپیوتر/سیستم/ویندوز/pc) در جمله باشد — در هر دو ترتیب */
      k: /(خاموش|شات\s?داون|shutdown|shut\s?down|power\s?off|turn\s?off)[^.]{0,16}(کامپیوتر|سیستم|ویندوز|پی\s?سی|pc|computer|system)|(کامپیوتر|سیستم|ویندوز|پی\s?سی|pc|computer|system)[^.]{0,16}(خاموش|شات\s?داون|shutdown|power\s?off)/i, id: 'shutdown', t: 'خاموش کردن', i: '#i-power', confirm: 'shutdown',
      r: () => runPower('sys_shutdown'),
    },

    /* --- برنامه‌های ویندوز --- */
    { k: /کروم|مرورگر|chrome|browser/i, id: 'open_chrome', t: 'باز کردن کروم', i: '#i-globe', run: 'open_chrome', r: () => LANG === 'en' ? 'Chrome is open. Enjoy!' : 'مرورگر کروم باز شد. خوش بگذره!' },
    { k: /نت[\s\u200C.]?پد|نوت[\s\u200C]?پد|دفترچه|notepad/i, id: 'open_notepad', t: 'باز کردن نت‌پد', i: '#i-note', run: 'open_notepad', r: () => LANG === 'en' ? 'Notepad is open.' : 'نت‌پد باز شد.' },
    /* v0.38.1 — «حساب کن» از این قانون حذف شد: «حساب کن پنج ضربدر هفت» باید
       محاسبهٔ صوتی شود نه باز شدن اپ ماشین‌حساب (قانون محاسبه پایین‌تر است) */
    { k: /ماشین[\s\u200C]?حساب|calculator/i, id: 'open_calc', t: 'باز کردن ماشین‌حساب', i: '#i-calc', run: 'open_calc', r: () => LANG === 'en' ? 'Calculator is open.' : 'ماشین‌حساب باز شد.' },
    { k: /اکسپلورر|فایل‌?ها|مای\s?کامپیوتر|این\s?کامپیوتر|explorer|file explorer/i, id: 'open_explorer', t: 'باز کردن اکسپلورر', i: '#i-window', run: 'open_explorer', r: () => LANG === 'en' ? 'File Explorer is open.' : 'فایل اکسپلورر باز شد.' },
    { k: /وی[\s\u200C]?اس\s?کد|vs\s?code|کدنویس/i, id: 'open_vscode', t: 'باز کردن VS Code', i: '#i-note', run: 'open_vscode', r: () => LANG === 'en' ? 'VS Code is open (must be installed).' : 'وی‌اس کد باز شد (باید روی سیستم نصب باشد).' },
    { k: /تسک[\s\u200C]?منیجر|مدیریت[\s\u200C]?فرایند|task\s?manager/i, id: 'open_taskmgr', t: 'باز کردن تسک‌منیجر', i: '#i-pulse', run: 'open_taskmgr', r: () => LANG === 'en' ? 'Task Manager is open.' : 'تسک‌منیجر باز شد.' },
    { k: /تنظیمات|windows settings|open settings/i, id: 'open_settings', t: 'باز کردن تنظیمات', i: '#i-gear', run: 'open_settings', r: () => LANG === 'en' ? 'Windows Settings is open.' : 'تنظیمات ویندوز باز شد.' },
    { k: /پینت|نقاشی|paint/i, id: 'open_paint', t: 'باز کردن پینت', i: '#i-calc', run: 'open_paint', r: () => LANG === 'en' ? 'Paint is open; get creative!' : 'پینت باز شد؛ خلاق باش!' },

    /* --- وب --- */
    { k: /یوتیوب|youtube/i, id: 'open_youtube', t: 'باز کردن یوتیوب', i: '#i-music', run: 'open_youtube', r: () => LANG === 'en' ? 'YouTube is open.' : 'یوتیوب باز شد.' },
    { k: /موسیقی|آهنگ|موزیک|play music|play some music/i, id: 'open_music', t: 'پخش موسیقی', i: '#i-music', run: 'open_music', r: () => LANG === 'en' ? 'YouTube Music is open; pick a song.' : 'یوتیوب موزیک باز شد؛ آهنگ دلخواهت را بزن.' },
    {
      k: /آب[\s\u200C]?و[\s\u200C]?هوا|هوا\s?(چطور|چنده|چی|چیکار)|درجه[\s\u200C]?هوا|چند\s?درجه|دما|weather/i, id: 'weather', t: 'آب‌وهوا', i: '#i-cloud',
      r: (c) => weatherReply(c),
    },
    /* --- v0.31.0: قیمت لحظه‌ای + اوقات شرعی (قبل از جستجو/ساعت تا قاطی نشوند) --- */
    {
      k: /((قیمت|نرخ)[^.]{0,24}(دلار|دولار|یورو|پوند|درهم|طلا|مثقال|انس|اونس|سکه|گرمی|بیت|کوین|تتر|اتریوم|سولانا|دوج|بایننس|ارز)|(دلار|دولار|یورو|پوند|درهم|طلا|مثقال|انس|اونس|سکه|بیت\s?کوین|تتر|اتریوم|سولانا|دوج|بایننس|ارز)[^.]{0,10}(چنده|چند\s?مه|چند\s?میشه|چقدر|قیمتش)|(price|rate)\s+(of\s+)?(dollar|euro|gold|bitcoin|crypto|tether))/i,
      id: 'rates', t: 'قیمت لحظه‌ای', i: '#i-pulse', r: (c) => ratesReply(c),
    },
    {
      k: /اوقات\s*شرعی|شرعی|اذان|اذون|نماز[^.]{0,10}(چنده|چند|ساعت|وقت)|وقت\s*نماز|prayer times?/i,
      id: 'prayer', t: 'اوقات شرعی', i: '#i-clock', r: (c) => prayerReply(c),
    },
    {
      k: /(سایت|وب\s?سایت)|https?:\/\//i, id: 'web_open', t: 'باز کردن سایت', i: '#i-globe',
      run: (c) => (/https?:\/\//i.test(c) ? 'web_open' : (knownSiteOf(c) || knownSiteOf(siteTargetOf(c)) || siteDomainOf(c) || siteDomainOf(siteTargetOf(c)) ? 'web_open' : 'web_search')),
      arg: (c) => {
        const m = c.match(/https?:\/\/\S+/);
        if (m) return m[0];
        /* v0.28 — «برو به سایت دیجی کالا» باید خودِ سایت را باز کند، نه اینکه
           «برو به» را در گوگل سرچ کند: اول دیکشنری سایت‌های معروف، بعد دامنهٔ
           خام (x.com/x.ir)، در آخر فقط «اسم تمیزِ سایت» برای جستجو */
        const ks = knownSiteOf(c) || knownSiteOf(siteTargetOf(c));
        if (ks) { store.set('lastSite', ks); return ks; }
        const dom = siteDomainOf(c) || siteDomainOf(siteTargetOf(c));
        if (dom) { const u = 'https://' + dom; store.set('lastSite', u); return u; }
        return cleanSiteQuery(c) || 'گوگل';
      },
      r: (c) => {
        if (/https?:\/\//i.test(c) || knownSiteOf(c) || knownSiteOf(siteTargetOf(c)) || siteDomainOf(c)) return LANG === 'en' ? 'The website is open.' : 'سایت موردنظر باز شد.';
        return LANG === 'en' ? `I searched "${cleanSiteQuery(c) || 'it'}" on Google; the first result is usually the site.` : `«${cleanSiteQuery(c) || 'آن'}» را در گوگل جستجویش کردم؛ نتیجهٔ اول معمولاً همان سایت است.`;
      },
    },
    {
      /* v0.41 — دایرهٔ لغات جستجوی وب: گوگل کن / سرچش / جستجوش / پیداش کن /
         برام سرچ کن / تو اینترنت … (پیش از این «گوگل کن» به هیچ‌جا نمی‌رسید) */
      /* v0.42 — «سرچ کن» تنها دیگر «» را جستجو کردم» دروغ نمی‌گوید: گوگلِ
         ساده باز می‌شود و از کاربر عبارت پرسیده می‌شود (گزارش: «انجام نده») */
      k: /جستجو|سرچ|سیرچ|گوگل\s*(کن|بزن)?|google|پیداش\s*کن|search( for)?( the)? web|search$/i, id: 'web_search', t: 'جستجوی وب', i: '#i-search',
      run: 'web_search', arg: (c) => stripSearch(c),
      r: (c) => {
        const q = stripSearch(c);
        if (!q) return LANG === 'en' ? 'Google is open — tell me what to search for.' : 'گوگل باز شد — بگو چی رو برات سرچ کنم.';
        return LANG === 'en' ? `I searched "${q}" on Google.` : `«${q}» را در گوگل جستجو کردم.`;
      },
    },

    /* --- پنجره‌ها و سیستم --- */
    { k: /اسکرین\s?شات|اسکرین|عکس.{0,8}(صفحه|نمایشگر)|screenshot|take a screenshot/i, id: 'screenshot', t: 'اسکرین‌شات', i: '#i-camera', run: 'screenshot', r: () => LANG === 'en' ? 'Screenshot taken and saved to your Pictures folder.' : 'اسکرین‌شات گرفته شد و در پوشه Pictures ذخیره شد.' },
    /* v0.40 — «یکم کوچکترش کن» (وقتی پنجرهٔ شناور باز است) باید اندازهٔ PiP شود،
       نه مینیمایزِ همهٔ پنجره‌ها! (گزارش واقعی activity.log) — «کوچک کن» تنها
       با لنگرِ پنجره معنی مینیمایز می‌گیرد */
    { k: /مینیمایز|دسکتاپ|پنجره[^.]{0,10}(کوچک|کوچیک)|همه[^.]{0,8}پنجره|minimize|show (the )?desktop/i, id: 'minimize_all', t: 'نمایش دسکتاپ', i: '#i-window', run: 'minimize_all', r: () => LANG === 'en' ? 'All windows minimized; desktop is clear.' : 'همه پنجره‌ها کوچک شدند؛ دسکتاپ آزاد است.' },
    { k: /قفل.{0,8}(کن|صفحه)|لاک\s?اسکرین|lock (the )?(pc|computer|screen)/i, id: 'lock', t: 'قفل صفحه', i: '#i-lock', run: 'lock', r: () => LANG === 'en' ? 'Screen locked; bye!' : 'صفحه قفل شد؛ بدرود!' },
    /* v0.43 — خروج از حساب ویندوز («اقدامات این چنینی») */
    { k: /(از\s*)?(حساب|اکانت)(م)?\s*(خارج|برو\s?بیرون|بسته\s?شه)|لاگ\s?آف|لاگ\s?اف|logoff|log off|sign out/i, id: 'logoff', t: 'خروج از حساب', i: '#i-lock', run: 'sys_logoff', r: () => LANG === 'en' ? 'Signing out of Windows.' : 'از حساب کاربری ویندوز خارج می‌شوم.' },

    /* --- ضبط صدا (واقعی) --- */
    { k: /(شروع|بگیر).{0,8}ضبط|ضبط.{0,8}(صدا|شروع)|start recording|record (my )?(voice|audio)/i, id: 'rec_start', t: 'شروع ضبط صدا', i: '#i-mic', r: () => startAudioRec() },
    { k: /توقف.{0,8}ضبط|پایان.{0,8}ضبط|ضبط.{0,8}(تموم|کافی)|قطع.{0,8}ضبط|stop recording/i, id: 'rec_stop', t: 'پایان ضبط صدا', i: '#i-mic', r: () => stopAudioRec() },

    /* --- صدا --- */
    /* v0.38.1 — «صدا رو خاموش کن» حالا میوت می‌شود (قبلاً به خاموشی PC می‌رفت) */
    { k: /(صدا|ولوم).{0,12}(قطع|بی[\s\u200C]?صدا|میوت|خاموش)|میوت|mute( the)?( volume| sound)?|بی[\s\u200C]?صدا/i, id: 'vol_mute', t: 'بی‌صدا کردن', i: '#i-volume', run: 'vol_mute', r: () => LANG === 'en' ? 'Sound is muted.' : 'صدا قطع شد.' },
    { k: /(صدا|ولوم|بلندی).{0,12}(بلند|زیاد|بالا|بده)|volume up|louder|turn (it )?up/i, id: 'vol_up', t: 'بلندتر کردن صدا', i: '#i-volume', run: 'vol_up', r: () => LANG === 'en' ? 'Volume raised.' : 'صدای سیستم را بلندتر کردم.' },
    { k: /(صدا|ولوم|بلندی).{0,12}(کم|پایین|آرام)|volume down|quieter|turn (it )?down/i, id: 'vol_down', t: 'کم کردن صدا', i: '#i-volume', run: 'vol_down', r: () => LANG === 'en' ? 'Volume lowered.' : 'صدای سیستم را کمتر کردم.' },
    {
      k: /(صدا|ولوم|بلندی|volume)[^0-9۰-۹]{0,12}[0-9۰-۹]+|[0-9۰-۹]+[^0-9۰-۹]{0,8}(درصد)?[\s\u200C]*(صدا|ولوم)|volume (to )?\d+/i, id: 'vol_set', t: 'تنظیم دقیق صدا', i: '#i-volume',
      run: 'vol_set',
      arg: (c) => { const m = faToEn(c).match(/\d+/); return m ? Math.min(100, +m[0]) : 50; },
      r: (c) => { const m = faToEn(c).match(/\d+/); return LANG === 'en' ? `Volume set to ${m ? Math.min(100, +m[0]) : 50}%.` : `بلندی صدا روی ${faNum(m ? Math.min(100, +m[0]) : 50)}٪ تنظیم شد.`; },
    },

    /* --- ماشین‌حساب صوتی (قبل از جستجو تا قاطی نشود) --- */
    {
      k: /(?=.*(ضرب|تقسیم|علاوه|بعلاوه|منهای|منها|جمع|چند\s?میشه|چنده))(?=.*(\d|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|بیست|سی|چهل|پنجاه|شصت|هفتاد|هشتاد|نود|صد|هزار))|(?=.*(plus|minus|times|multiplied|divided))(?=.*\d)|what(?:'s| is) \d/i, id: 'calc', t: 'محاسبه', i: '#i-calc',
      r: (c) => calcReply(c),
    },

    /* --- ابزار (یادآوری/تایمر قبل از مانیتورینگ/ساعت — v0.38.1) ---
       «بیدارم کن» زیررشتهٔ «رم» بود و مانیتورینگ می‌ربود؛
       «ساعت ۵ یادآوری بذار» قانون ساعت می‌ربود. ترتیب درست شد. */
    {
      k: /یادآوری|یادم\s?بنداز|یادت\s?بنداز|یادآور|آلارم|بیدارم\s?کن|remind me/i, id: 'reminder', t: 'یادآوری ثبت شد', i: '#i-timer',
      r: (c) => reminderReply(c),
    },
    /* --- v0.42 — وضعیت/لغو تایمر — باید «قبل از» قانون ست‌کردن تایمر باشد --- */
    {
      k: /تایمر[^.]{0,14}(لغو|بردار|پاک|قطع|کنسل|بی\s?خیال)|لغو[^.]{0,10}تایمر|cancel (the )?timers?|clear (the )?timers?/i,
      id: 'timer_cancel', t: 'لغو تایمرها', i: '#i-timer', r: () => cancelTimersReply(),
    },
    {
      /* «چند تا تایمر دارم؟» / «تایمرام چیه؟» / «تایمر فعاله؟» — محلی و آنی */
      k: /چند(تا|\s*تا|\s*دونه)?\s*تایمر|تایمر(ام|هام|ها)[^.]{0,14}(چیه|چی|هست|فعال|باقی|مونده|کدوم|بگو|نشون)|تایمر[^.]{0,18}(فعاله|باقی\s*مونده|وضعیت|لیست|چندتا)|how many timers|(my )?timers?\s*(active|running|left|status)/i,
      id: 'timer_report', t: 'وضعیت تایمرها', i: '#i-timer', r: () => timersReportReply(),
    },
    { k: /تایمر|هشدار\s?بذار|timer/i, id: 'timer', t: 'تایمر فعال شد', i: '#i-timer', r: (c) => startTimer(c) },

    /* --- اطلاعات --- */
    { k: /وضعیت|سیستم|پردازنده|(?<![\u0600-\u06FF])رم(?![\u0600-\u06FF])|system status|cpu|\bram\b|how is (the )?system/i, id: 'status', t: 'مانیتورینگ', i: '#i-pulse', r: () => t('sys.reply', { cpu: faNum(lastCpu), ram: faNum(lastRam) }) },
    {
      k: /باتری|شارژ|battery|charge/i, id: 'battery', t: 'باتری', i: '#i-pulse',
      r: async () => {
        if (navigator.getBattery) {
          try {
            const b = await navigator.getBattery();
            return t('battery.reply', { x: faNum(Math.round(b.level * 100)), y: b.charging ? t('battery.charging') : '' });
          } catch (_) { /* noop */ }
        }
        return t('battery.fail');
      },
    },
    { k: /ساعت|چند\s?ساعته|what time|the time/i, id: 'clock', t: 'ساعت', i: '#i-clock', r: () => t('time.reply', { x: fmtTime() }) },
    { k: /تاریخ|چندمه|امروز|what('s| is) (the )?date|today'?s date/i, id: 'date', t: 'تاریخ', i: '#i-clock',
      /* v0.31.0 — «تاریخ میلادی امروز» هم پشتیبانی شد (پیش‌فرض: شمسی) */
      r: (c) => /میلادی|gregorian/i.test(c)
        ? t('date.greg', { x: new Intl.DateTimeFormat(LANG === 'en' ? 'en-US' : 'fa-IR-u-ca-gregory', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date()) })
        : t('date.reply', { x: fmtDate() }) },

    /* --- ابزار --- */
    /* v0.42 — «اون یادداشتی که نوشتیم رو باز کن» — قبل از قانون عمومی یادداشت */
    {
      k: /(اون|همون|آخرین|قبلی)\s*(یادداشت|نوت)|(یادداشت|نوت)[^.]{0,6}(آخر|قبلی|قبل)|یادداشتم\s*(رو|را)?\s*(باز|نشون|بخون)|(open|show|read)\s*(that|the last|my last)\s*note/i,
      id: 'notes_open', t: 'یادداشت آخر', i: '#i-note', r: (c) => openLastNote(c),
    },
    /* v0.31.0 — یادداشت صوتی ماندگار */
    { k: /یادداشت|یادداشتم|note (down|to self)|take a note|my notes/i, id: 'notes', t: 'یادداشت', i: '#i-note', r: (c) => notesReply(c) },

    /* --- مدیای سیستم (هر پلیری — Spotify/مرورگر و…) --- */
    { k: /مدیا[^.]{0,10}(بعدی|بعد)|پلیر[^.]{0,10}(بعدی|بعد)|آهنگ بعدی پلیر|media next|next (track|media)/i, id: 'media_next', t: 'مدیای بعدی', i: '#i-music', run: 'media_next', r: () => (LANG === 'en' ? 'Next track on the system player.' : 'آهنگ بعدی در پلیر سیستم.') },
    { k: /مدیا[^.]{0,10}(قبلی|قبل)|پلیر[^.]{0,10}(قبلی|قبل)|آهنگ قبلی پلیر|media prev|previous (track|media)/i, id: 'media_prev', t: 'مدیای قبلی', i: '#i-music', run: 'media_prev', r: () => (LANG === 'en' ? 'Previous track on the system player.' : 'آهنگ قبلی در پلیر سیستم.') },
    { k: /مدیا[^.]{0,12}(پاز|توقف|پخش|نگه دار)|(پاز|پخش).{0,6}مدیا|media (play|pause)|play pause media/i, id: 'media_toggle', t: 'پخش/توقف مدیا', i: '#i-music', run: 'media_toggle', r: () => (LANG === 'en' ? 'Toggled the system player.' : 'پلیر سیستم را پخش/توقف کردم.') },
    {
      /* v0.36 — «بابا یه جوک خفن بگو ولی از تو» دیگر سرچ نمی‌شود: جک/جوک/لطیفه
         اول به هوش مصنوعی می‌رود (جوکِ تازه از خودِ آوا)، بدون اتصال هم جوکِ محلی هست */
      k: /جوک|جک|لطیفه|بخندون|شوخی|tell me a joke|make me laugh|joke/i, id: 'joke', t: 'جوک', i: '#i-smile',
      r: async () => { if (aiConnected()) return AI_FALLBACK; return joke(); },
    },

    /* --- تعامل --- */
    { k: /سلام|درود|خوبی|hello|hi ava|hey ava|good (morning|evening|afternoon)/i, t: 'سلام', i: '#i-wave', r: () => LANG === 'en' ? 'Hello! I am great, thanks. What can I do for you?' : 'سلام! من خوبم، ممنون. چه کاری برات انجام بدم؟' },
    { k: /متشکر|مرسی|ممنون|thank( you|s)/i, t: 'خواهش', i: '#i-wave', r: () => LANG === 'en' ? 'You are welcome! Anything else?' : 'خواهش می‌کنم! کار دیگری هست؟' },

    /* --- پوشه‌های ویندوز و سطل بازیافت --- */
    { k: /پوشه.{0,6}دانلود|دانلودها|downloads|open downloads/i, id: 'open_downloads', t: 'باز کردن دانلودها', i: '#i-download', run: 'open_downloads', r: () => LANG === 'en' ? 'Downloads folder is open.' : 'پوشه دانلودها باز شد.' },
    { k: /پوشه.{0,6}(اسناد|داکیومنت|مستندات)|documents|open documents/i, id: 'open_documents', t: 'باز کردن اسناد', i: '#i-note', run: 'open_documents', r: () => LANG === 'en' ? 'Documents folder is open.' : 'پوشه اسناد باز شد.' },
    { k: /سطل.{0,10}(زباله|بازیافت).{0,12}(خالی|پاک|تمیز|بریز)|empty (the )?(recycle|trash)|empty trash/i, id: 'recycle_empty', t: 'خالی کردن سطل بازیافت', i: '#i-trash', run: 'recycle_empty', r: () => LANG === 'en' ? 'Recycle Bin emptied.' : 'سطل بازیافت خالی شد.' },
  ];

  /* فرمان‌های صوتی موزیک — قبل از قانون قدیمی یوتیوب‌موزیک */
  /* v0.45 — فیکس: داخل رشتهٔ JS، \s به «s» تبدیل می‌شد («پلیs?لیست» بی‌معنا!) —
     حالا [\\s\u200C] درست ساخته می‌شود؛ همین باعث می‌شد «آهنگ رو نگه دار»
     هرگز مکث موزیک نمی‌شد (باگ واقعیِ کشف‌شده در بازنگری کامل منطق) */
  const MUSIC_FA = 'موزیک|موسیقی|آهنگ|اهنگ|آواز|ترانه|پلی[\\s\u200C]?لیست|music|song|playlist';
  {
    const musicRules = [
      {
        k: new RegExp(`(?:${MUSIC_FA})[^.]{0,14}(بعدی|بعد)|(بعدی|next)[^.]{0,8}(?:${MUSIC_FA})|next (song|track|music)`, 'i'),
        id: 'music_next', t: 'آهنگ بعدی', i: '#i-music', r: () => voiceMusicNext(),
      },
      {
        k: new RegExp(`(?:${MUSIC_FA})[^.]{0,14}(قبلی|قبل)|(قبلی|previous|prev)[^.]{0,8}(?:${MUSIC_FA})|previous (song|track|music)`, 'i'),
        id: 'music_prev', t: 'آهنگ قبلی', i: '#i-music', r: () => voiceMusicPrev(),
      },
      {
        /* v0.45 — «ببند» هم توقف موزیک است: «موزیک رو ببند» دیگر به نیت باز کردن
           نمی‌رود (منفی‌های open_music) و همین‌جا مکث می‌شود */
        k: new RegExp(`(?:${MUSIC_FA})[^.]{0,16}(پاز|توقف|نگه[\\s\u200C]?دار|قطع|استاپ|استپ|ساکت|ببند|stop|pause)|(پاز|stop|pause|ببند)[^.]{0,10}(?:${MUSIC_FA})`, 'i'),
        id: 'music_pause', t: 'توقف موزیک', i: '#i-music', r: () => voiceMusicPause(),
      },
      {
        /* v0.43 — «کن» تنهایی از الگوی دوم حذف شد: «موزیک رو باز کن» را هم
           پخشِ موزیکِ محلی می‌گرفت (ریشهٔ بخشی از «الکی انجام میده»؛ باز کردن
           پلیر موزیک الان مسیر درست خودش را دارد)
           v0.51 — بذار/بزار/بیار/بگیر به فعل‌ها پیوست (لاگ v0.50: «آهنگ X بذار»
           به هیچ‌کدام از فعل‌های music_play نمی‌خورد و می‌افتاد روی open_music
           = باز شدن صفحهٔ اصلی YT Music بدون پخشِ هیچ آهنگی؛ engine آهنگ-آگاهِ
           voiceMusicPlay خودش محلی/یوتیوب را انتخاب می‌کند) */
        k: new RegExp(`(?:پخش|بزن|پلی|شروع|بذار|بزار|بیار|بگیر|play)[^.]{0,10}(?:${MUSIC_FA})|(?:${MUSIC_FA})[^.]{0,14}(پخش|بزن|پلی|شروع|بذار|بزار|بیار|بگیر|play)`, 'i'),
        id: 'music_play', t: 'پخش موزیک', i: '#i-music', r: (c) => voiceMusicPlay(c),
      },
      {
        k: /پلی\s?[\u200C]?لیست|playlist|صفحه.{0,8}موزیک|موزیک.{0,8}(باز|صفحه)/i,
        id: 'music_page', t: 'پلیر موزیک', i: '#i-music', r: () => { showView('music'); return t('music.pageOpen'); },
      },
    ];
    RULES.splice(1, 0, ...musicRules);
  }

  /* ============================================================
     v0.37 → v0.61 — بلاک قواعد مدیا + راهنمای فرمان‌ها
     ------------------------------------------------------------
     (الف) HOW — «چجوری می‌تونم فلان کارو بکنم؟»:
          اول در رجیستری توانایی‌های آوا (capabilities.js) می‌گردد؛
          اگر پیدا شد دقیق می‌گوید «چه بگویی»، وگرنه همان سوال همراه
          فهرست واقعی توانایی‌های آوا (__aiExtra) به هوش مصنوعی می‌رود
          تا یا روشِ درست را بگوید یا صادقانه بگوید آوا این کار را ندارد.
          گارد لازم: «چطور/چجوری/چگونه» فقط وقتی سوالِ روش است که
          «میتونم/کنم/بکنم» یا «چی میتونی» هم در جمله باشد — وگرنه
          «هوا چطوره؟» هم راهنما می‌شد!
     (ب) MEDiA — یوتیوب/پلیر سیستم/کنترل پخش/دیکتهٔ یک‌باره.
          v0.61: پنجرهٔ شناور (PiP) و پنجرهٔ یوتیوب (ytWin) حذف شدند؛
          پخش با «پلیر پیش‌فرض کاربر» است و کنترل پلیر با کلیدهای مدیا.
     ============================================================ */
  {
    /* v0.61 — بلاک قواعد مدیا: «یوتیوب شناور» و «پنجرهٔ شناور (PiP)» حذف شدند
       (پلیر خودساختهٔ آوا برچیده شد؛ پخش با پلیر پیش‌فرض کاربر است). */
    const mediaRules = [
      {
        k: /چ(?:طور|جور|گونه)[^.]{0,10}(?:میتونم|می\s?تونم|بکنم|کنم|بذارم|بزنم|بدم|کرد|بکن)|(?:میتونم|می\s?تونم)[^.]{0,16}چ(?:طور|جور|گونه)|how (do|can) i\b|what can you do|چی\s?(?:میتونی|می\s?تونی|بلدی)|چیکار.{0,8}(?:میتونی|بلدی)|چه\s?(?:کارایی|کارهایی|فرمانهایی|فرمان\u200cهایی|فرمانهای?|دستوراتی?)|لیست\s?(?:فرمان|دستور|کامند)|توانایی/i,
        id: 'howto', t: 'راهنمای فرمان‌ها', i: '#i-gear', r: (c) => howToReply(c),
        __aiExtra: AVACapabilities.aiPromptAddon(),
      },
      /* --- v0.50 — «پلی/پخش کن» روی یوتیوب = پخشِ واقعی اولین نتیجه ---
         (لاگ کاربر v0.49: «آهنگ جدید شادمهر تو یوتیوب برام پلی کن» فقط صفحهٔ
         نتایج باز می‌شد؛ پلی یعنی پخش!) سرچِ صریح همچنان صفحهٔ نتایج می‌دهد */
      {
        k: /(?=.*(یوتیوب|youtube))(?=.*(پلی\s?کن|پخش\s?کن|پخشش\s?کن|پلاش\s?کن|بذار\s?(پخش|بزن)))/i,
        id: 'yt_play', t: 'پخش یوتیوب', i: '#i-music', run: 'youtube_play',
        arg: (c) => ytQueryOf(c),
        r: (c) => {
          const q = ytQueryOf(c);
          return q
            ? (LANG === 'en' ? `Playing "${q}" in your default video player.` : `«${q}» را با پلیر پیش‌فرض سیستم پخش می‌کنم.`)
            : (LANG === 'en' ? 'Opening YouTube.' : 'یوتیوب باز شد.');
        },
      },
      /* --- v0.38 — جستجوی مستقیم یوتیوب: «تو یوتیوب آهنگ X رو سرچ کن» ---
         قبل از قانونِ یوتیوبِ ساده (که هر جملهٔ یوتیوب‌دار را می‌بلعد) */
      {
        /* v0.43 — «توی یوتیوب برام آهنگ شادمهر پلی کن» الان واقعاً در یوتیوب
           پخش می‌شود (لاگ کاربر: به موزیکِ محلی می‌رفت!) — فعل پخش/پلی/بزن
           هم به فعل‌های جستجو پیوست؛ انتخاب نهایی با داوری AVAIntent است */
        k: /(?=.*(یوتیوب|youtube))(?=.*(جستجو|سرچ|سیرچ|بگرد|پخش|پلی\s?کن|بزن|بذار|آهنگ|ترانه|ویدیو|فیلم|search|find))/i,
        id: 'yt_search', t: 'جستجوی یوتیوب', i: '#i-search', run: 'youtube_search',
        arg: (c) => ytQueryOf(c),
        r: (c) => {
          const q = ytQueryOf(c);
          return q
            ? (LANG === 'en' ? `I searched "${q}" on YouTube.` : `«${q}» را در یوتیوب جستجو کردم.`)
            : (LANG === 'en' ? 'YouTube search is open.' : 'جستجوی یوتیوب باز شد.');
        },
      },
      /* --- v0.43 — «چی داره پخش میشه؟» — SMTC ویندوز (هر مرورگر/پلیری) --- */
      {
        k: /چی\s?(داره\s?)?پخش|چه\s?(آهنگی|ویدیویی|چیزی)\s?(داره\s?)?پخش|الان\s?چی\s?پخشه|چی\s?در\s?حال\s?پخش|whats?\s+playing|now\s+playing/i,
        id: 'now_playing', t: 'در حال پخش', i: '#i-music',
        r: async () => {
          if (!bridge || !bridge.media || !bridge.media.now) return LANG === 'en' ? 'Media status is only available inside the app.' : 'وضعیت پخش فقط داخل خود نرم‌افزار در دسترس است.';
          const n = await bridge.media.now();
          if (!n || !n.ok) return LANG === 'en' ? 'Nothing is playing right now.' : 'الان هیچ چیزی در حال پخش نیست.';
          const what = [n.title, n.artist].filter(Boolean).join(' — ') || 'نامشخص';
          return (LANG === 'en'
            ? `Playing in ${n.app || 'unknown app'}: ${what}`
            : `در حال پخش در ${n.app || 'برنامهٔ نامشخص'}: «${what}»${n.playing ? '' : ' (مکث شده)'}`);
        },
      },
      /* --- v0.43 — «همین ویدیو رو بیار» — v0.61: پخش با پلیر پیش‌فرض کاربر
         (نیت «پخش در خود آوا» حذف شد) --- */
      {
        /* v0.47 — B16: فاصلهٔ جمله («ویدیویی که توی یوتیوب داره پخش میشه رو بیار…») دیگر رول را نمی‌پراند (لاگ: به yt_search زباله می‌رفت) */
        k: /همین\s?(ویدیو|فیلم|کلیپ)|ویدیو(یی)?\s?که[^.]{0,28}?(داره|در\s?حال)[^.]{0,12}?پخش|ویدیو\s?در\s?حال\s?پخش|همینو?\s?(بیار|باز\s?کن)|برام\s?همون\s?ویدیو|(بیار|بیارش)[^.]{0,16}(پات\s?پلیر|potplayer|وی\s?ال\s?سی|vlc)|bring (the )?current video|this video/i,
        id: 'yt_bring', t: 'ویدیوی در حال پخش', i: '#i-music',
        r: async (c) => {
          const cleanTitle = (s) => String(s || '').replace(/\s*[-–—]\s*(YouTube|یوتیوب)\s*$/i, '').trim();
          let q = '';
          try {
            if (bridge && bridge.media && bridge.media.now) {
              const n = await bridge.media.now();
              if (n && n.ok && n.title) {
                const t1 = cleanTitle(n.title);
                const ar = cleanTitle(n.artist);
                q = t1 + (ar && !t1.toLowerCase().includes(ar.toLowerCase()) ? ' ' + ar : '');
              }
            }
          } catch (_) { /* noop */ }
          if (!q) q = ytQueryOf(c);
          if (!q) return LANG === 'en'
            ? 'I could not detect what is playing — start the video first or copy its link.'
            : 'نتوانستم بفهمم چه ویدیویی در حال پخش است — اول ویدیو را پخش کن یا لینکش را کپی کن.';
          try {
            const res = (bridge.yt && bridge.yt.resolve) ? await bridge.yt.resolve(q) : null;
            if (res && res.ok && res.videoId) {
              const op = await bridge.player.open({ player: 'default', kind: 'url', src: 'https://www.youtube.com/watch?v=' + res.videoId });
              if (op && op.ok) return (LANG === 'en'
                ? (op.via === 'browser-fallback'
                  ? `Player could not stream it — opened "${res.title || q}" in the browser.`
                  : `Brought "${res.title || q}" into your default player.`)
                : (op.via === 'browser-fallback'
                  ? `پلیر نتوانست پخش کند — «${res.title || q}» را در مرورگر باز کردم.`
                  : `«${res.title || q}» را در پلیر پیش‌فرض سیستم پخش کردم.`));
            }
          } catch (_) { /* noop */ }
          return LANG === 'en' ? 'Could not open the video.' : 'باز کردن ویدیو ممکن نشد.';
        },
      },
      /* --- v0.43 — کنترل پلیرها: «با وی ال سی پخش کن…» / «برو جلو ۳۰ ثانیه» ---
         v0.61 — + کی‌ام‌پلیر + «با پلیر پیش‌فرض پخش کن» + کلیپ‌بورد از sys.clipboard */
      {
        /* v0.47 — B16: حرف‌نوشت STT «پات پلیر» + فعل‌های باز کن/بیار (لاگ: «پات پلیر رو باز کن» رول را نمی‌گرفت)
           v0.61 — + کی‌ام‌پلیر + «با پلیر پیش‌فرض» (پلیرِ انتخابی خود کاربر در ویندوز) */
        k: /(با|توی|تو|توسط)\s*(وی\s?ال\s?سی|\bvlc\b|ام\s?پی\s?وی|\bmpv\b|پت\s?پلیر|پات\s?پلیر|potplayer|کی\s?ام\s?پلیر|کی\s?ام\s?پلیر|kmplayer|ام\s?پی\s?سی|\bmpc\b)|(پخش|پلی\s?کن|بذار|اجرا|باز\s?کن|بیار|بیارش)[^.]{0,12}(وی\s?ال\s?سی|vlc|ام\s?پی\s?وی|mpv|پت\s?پلیر|پات\s?پلیر|potplayer|کی\s?ام\s?پلیر|kmplayer|ام\s?پی\s?سی|mpc)|(پت\s?پلیر|پات\s?پلیر|potplayer|کی\s?ام\s?پلیر|kmplayer)[^.]{0,10}(باز\s?کن|بیار|پخش\s?کن)|پلیر\s?پیش\s?فرض[^.]{0,10}(پخش|پلی|بذار|باز)/i,
        id: 'player_open', t: 'پخش در پلیر', i: '#i-music',
        r: async (c) => {
          const pidOf = (s) => (/وی\s?ال\s?سی|vlc/i.test(s) ? 'vlc' : /ام\s?پی\s?وی|mpv/i.test(s) ? 'mpv' : /پت\s?پلیر|potplayer/i.test(s) ? 'potplayer' : /کی\s?ام\s?پلیر|kmplayer/i.test(s) ? 'kmplayer' : /ام\s?پی\s?سی|mpc/i.test(s) ? 'mpc' : (/پلیر\s?پیش\s?فرض/i.test(s) ? 'default' : ''));
          const player = pidOf(c);
          let src = ytQueryOf(c)
            .replace(/(وی\s?ال\s?سی|vlc|ام\s?پی\s?وی|mpv|پت\s?پلیر|potplayer|کی\s?ام\s?پلیر|kmplayer|ام\s?پی\s?سی|mpc|پلیر\s?پیش\s?فرض)/gi, ' ')
            .replace(/\s+/g, ' ').trim();
          let kind = src ? 'query' : 'url';
          if (!src) {
            try {
              const cb = (bridge && bridge.sys && bridge.sys.clipboard) ? await bridge.sys.clipboard() : null;
              const clip = String((cb && cb.text) || '').trim();
              const mUrl = clip.match(/https?:\/\/\S+/);
              if (mUrl) src = mUrl[0];
            } catch (_) { /* noop */ }
          }
          if (!src) return LANG === 'en'
            ? 'Tell me what to play, e.g. "play Shahram in VLC" — or copy the video link first.'
            : 'بگو چی پخش کنم — مثل «با وی‌ال‌سی آهنگ شادمهر رو پخش کن» — یا اول لینک ویدیو را کپی کن.';
          try {
            const res = await bridge.player.open({ player, kind, src });
            if (res && res.ok && res.via === 'browser-fallback') return (LANG === 'en'
              ? 'Your player could not stream YouTube — I opened it in the browser instead (no bot/sign-in walls there).'
              : 'پلیر نتوانست یوتیوب را پخش کند — در مرورگر بازش کردم (اینجا دیوار ربات/ورود نیست).');
            if (res && res.ok) {
              return (LANG === 'en'
                ? `Playing in ${res.fa}${res.controlled ? ' — now I fully control it (pause/seek/fullscreen).' : '.'}`
                : `در ${res.fa} پخش شد${res.controlled ? ' — از الان پاز/جلو/عقب/فول‌اسکرینش هم دست خودمه.' : '.'}`);
            }
            return (LANG === 'en' ? `Could not play: ${res && res.error || ''}` : `پخش نشد: ${res && res.error || ''}`);
          } catch (_) { return LANG === 'en' ? 'Player launch failed.' : 'اجرای پلیر ممکن نشد.'; }
        },
      },
      {
        /* v0.61 — بازنگری ریشه‌ای: «ویدیو رو پلی کن» دیگر به نیتِ حذف‌شدهٔ
           پنجرهٔ شناور نمی‌رود (لاگ v0.48: ۶ ثانیه معطلی AI) — کنترل واقعی
           پلیر سیستم است: پلیر/مدیا با هر فعل + ویدیو/فیلم/کلیپ با فعل‌های
           پخش/پاز/فول‌اسکرین/جلو/عقب + «برو جلو/عقب» مستقل */
        k: /(پلیر|مدیا)[^.]{0,16}(پاز|توقف|استاپ|جلو|عقب|فوروارد|ریویند|فول\s?اسکرین|تمام\s?صفحه|ببند|بعدی|قبلی|پلی\s?کن|پخش|نگه\s?دار)|(ویدیو|فیلم|کلیپ)[^.]{0,16}(فول\s?اسکرین|تمام\s?صفحه|جلو|عقب|پاز|توقف|استاپ|پلی\s?کن|پخش\s?کن|نگه\s?دار|ببند)|(برو\s?|بپر\s?)(جلو|عقب|فوروارد|ریویند)|فول\s?اسکرین[^.]{0,10}(کن|پلیر|ویدیو|فیلم)|(پاز|توقف|استاپ|پلی\s?کن|پخش\s?کن)\s*(پلیر|مدیا|ویدیو|فیلم|کلیپ)/i,
        id: 'player_ctl', t: 'کنترل پلیر', i: '#i-music',
        r: async (c) => {
          /* v0.64 — گاردِ جملهٔ مرکب: «اولین ویدیو شادمهر رو کپی کن و توی پلیری که
             داره پخش می‌کنه اونجا پخش کن» توسط کلیدواژهٔ پخش‌کن ربوده می‌شد و
             در ۱۲ms به play_pauseِ بی‌اثر تبدیل می‌شد (لاگ v0.63). جمله‌ای که
             غیر از یک فعلِ کنترلی خواستهٔ دیگری هم دارد → مغز AI. */
          if (/(کپی|سرچ|جستجو|بگرد|پیدا\s?کن|اولین|دومین|سومین|چهارمین|بعد\s?(از|ش)|بعدش|تحلیل|بررسی|لینک|توی\s?(اون\s)?پلیر|همزمان|دوتا|سه\s?تا)/i.test(c)) return AI_FALLBACK;
          if (!bridge || !bridge.player || !bridge.player.ctl) return LANG === 'en' ? 'Player control is only available inside the app.' : 'کنترل پلیر فقط داخل خود نرم‌افزار کار می‌کند.';
          const num = (() => { const m = faToEn(c).match(/\d+/); return m ? Math.min(600, parseInt(m[0], 10) || 0) : 0; })();
          let action = '', arg = 0;
          if (/جلو|فوروارد/.test(c)) { action = 'seek'; arg = num || 10; }
          else if (/عقب|ریویند|به\s?عقب/.test(c)) { action = 'seek'; arg = -(num || 10); }
          else if (/بعدی/.test(c)) action = 'next';
          else if (/قبلی|قبل/.test(c)) action = 'prev';
          else if (/فول\s?اسکرین|تمام\s?صفحه/.test(c)) action = 'fullscreen';
          /* v0.66 — بستن با فعل‌های بیشتر (لاگ/خواستهٔ کاربر: «دستور بستن ویدیو
             کار نمیکنه»): ببندش/بس بندش/بسش کن/خاموشش کن/قطعش کن/بخوابونش */
          else if (/ببند|بس\s?بند|بسش\s?کن|بخوابون|خاموشش?\s?کن|قطعش?\s?کن|استاپش|استوپش|پایانش?\s?بده/i.test(c)) action = 'close';
          else if (/صدا|ولوم/ .test(c)) action = /زیاد|بلند|بالا/.test(c) ? 'volume_up' : 'volume_down';
          else action = 'play_pause'; /* پاز/توقف/استاپ/پلی کن/پخش کن/نگه دار/بی‌فعل */
          try {
            const res = await bridge.player.ctl({ action, arg });
            if (res && res.ok) {
              const fa = { play_pause: 'پخش/توقف', seek: arg >= 0 ? 'رفتم جلو' : 'برگشتم عقب', next: 'بعدی', prev: 'قبلی', fullscreen: 'فول‌اسکرین', close: 'بستن', volume_up: 'صدا بیشتر', volume_down: 'صدا کمتر', stop: 'توقف' };
              return (LANG === 'en' ? `Done (${action}).` : `انجام شد: ${fa[action] || action}${action === 'seek' ? ' ' + Math.abs(arg) + ' ثانیه' : ''}.`);
            }
            return (LANG === 'en' ? `Could not: ${res && res.error || ''}` : `انجام نشد: ${res && res.error || ''}`);
          } catch (_) { return LANG === 'en' ? 'Control failed.' : 'کنترل پلیر ممکن نشد.'; }
        },
      },
      /* --- v0.45 — بازنگری کامل منطق: نیتِ «بستن» قرینهٔ «باز کردن» است ---
         ریشهٔ ممیزی: «یوتیوب رو ببند» فقط واژهٔ یوتیوب را می‌دید و یوتیوب را
         «باز» می‌کرد! حالا فعلِ بستن/خاموش/قطع/استاپ یک نیت واقعی است.
         v0.61 — پنجرهٔ شناور حذف شده؛ بستن یعنی بستن پلیری که آوا اجرا کرده. */
      {
        /* v0.66 — ویدیو/فیلم/کلیپ/پلیر هم به اسم‌های بستن اضافه شدند
           («ویدیو رو ببند/خاموشش کن» قبلاً فقط با یوتیوب/پخش کار می‌کرد) */
        k: /(یوتیوب|youtube|پخش|استریم|ویدیو|فیلم|کلیپ|پلیر|مدیا)[^.]{0,12}(ببند|بس\s?بند|بس\s?کن|بسش\s?کن|خاموشش?\s?کن|قطعش?\s?کن|استاپ|استوپ|پایان)|(ببندش?|بسش\s?کن|خاموشش?\s?کن|قطعش?\s?کن|استاپش?|استوپش?)[^.]{0,12}(یوتیوب|youtube|پخش|پلیر|ویدیو|فیلم|کلیپ)|(از\s*)?(یوتیوب|youtube)[^.]{0,10}(بیرون|کافی)|close (the )?(youtube|player|stream|video)/i,
        id: 'yt_close', t: 'بستن پخش', i: '#i-window', r: (c) => ytCloseReply(c),
      },
      /* --- v0.51 — دیکتهٔ یک‌باره بدون «اینجا»: «ببین بنویس …» / «اینو تایپ کن …» /
         «برام بنویس که …» — استخراج محتوا با voiceIntent.typeOnceOf؛ اگر محتوا
         نبود (مثل «تایپ کن» تنهایی) AI_FALLBACK تا AI تعبیر کند یا حالت مودار بیاید.
         «اینجا…» از قبل بالاتر (SYS_DICT_RE) زودتر گرفته می‌شود. */
      {
        k: /(بنویس|بنویشه|بنویش|بنویسش|تایپش?\s?کن|تایپش?کشار|دیکته\s?کن|\bwrite\s+(this|that|it)\b|\btype\s+(this|that|it)\b)/i,
        id: 'type_once', t: 'نوشتن یک‌باره', i: '#i-type',
        r: async (c) => {
          const x = (typeof AVAIntent !== 'undefined' && AVAIntent.typeOnceOf) ? AVAIntent.typeOnceOf(c) : '';
          if (!x) return AI_FALLBACK;
          actLog('interpret: گفت «' + String(c).slice(0, 48) + '» | فهمید type_once', 'ui', { ev: 'interpret', via: 'rule', rule: 'type_once', q: x.slice(0, 40) });
          return await typeOnceExec(x);
        },
      },
    ];
    RULES.splice(1, 0, ...mediaRules);
  }

  /* ============================================================
     v0.40 — صفحهٔ کامل فرمان‌ها (درخواست کاربر: «یه صفحهٔ ساده با
     انیمیشن باز بشه کامندها رو نشون بده») + جستجوی درون-سایتی
     ------------------------------------------------------------
     گزارش واقعی activity.log: «می‌خوام دستورات مربوط به یوتیوب و فیلم
     رو ببینم» → قانون یوتیوب (/یوتیوب|youtube/i) می‌گرفت و یوتیوب باز
     می‌شد! حالا «دستورات/فرمان‌ها … ببینم» صفحهٔ فرمان‌ها را باز می‌کند.
     + «توی سایت دیجی کالا دنبال ساعت رولکس بگرد» جستجوی واقعی سایت را
     باز می‌کند (نه صفحهٔ اصلی) و «توی این سایت» سایت قبلی را یاد می‌ماند.
     ============================================================ */
  const CMD_PAGE_DECK = {
    video: {
      fa: 'ویدیو و پلیر سیستم', en: 'Video & System Player',
      items: {
        fa: ['ویدیو رو پلی کن', 'ویدیو رو پاز کن', 'ویدیو رو فول اسکرین کن', 'ویدیو رو ببند', 'برو جلو ۳۰ ثانیه', 'با وی‌ال‌سی آهنگ X رو پخش کن', 'با پت‌پلیر پخش کن', 'با پلیر پیش‌فرض پخش کن', 'تو یوتیوب آهنگ X رو سرچ کن'],
        en: ['Play the video', 'Pause the video', 'Fullscreen the video', 'Close the video', 'Forward 30s', 'Play X in VLC', 'Play in PotPlayer', 'Play in my default player', 'Search YouTube for X'],
      },
    },
    music: {
      fa: 'موزیک و صدا', en: 'Music & Sound',
      items: {
        fa: ['آهنگ بعدی', 'آهنگ قبلی', 'آهنگ رو نگه دار', 'آهنگ رو پخش کن', 'پلیر موزیک رو باز کن', 'صدا رو کم کن', 'صدا رو بلند کن'],
        en: ['Next song', 'Previous song', 'Pause music', 'Play music', 'Open music player', 'Lower the volume', 'Raise the volume'],
      },
    },
    web: {
      fa: 'سایت‌ها و جستجو', en: 'Sites & Search',
      items: {
        fa: ['سایت گوگل رو باز کن', 'برو یوتیوب', 'سایت دیجی کالا رو باز کن', 'توی دیجی کالا دنبال ساعت بگرد', 'سایت آپارات رو باز کن', 'سایت سافت ۹۸ رو باز کن', 'سایت زومیت رو باز کن'],
        en: ['Open Google', 'Open YouTube', 'Open Digikala', 'Search Digikala for watches', 'Open Aparat', 'Open Soft98', 'Open Zoomit'],
      },
    },
    system: {
      fa: 'سیستم', en: 'System',
      items: {
        fa: ['اسکرین‌شات بگیر', 'همه پنجره‌ها رو کوچک کن', 'وضعیت سیستم چطوره', 'باتری چنده', 'ساعت چنده', 'تایمر ۵ دقیقه', 'یادم بنداز چای دم کن', 'حالت خواب'],
        en: ['Take a screenshot', 'Minimize all windows', 'System status', 'Battery level', 'What time is it', 'Timer 5 minutes', 'Remind me', 'Sleep mode'],
      },
    },
    discord: {
      fa: 'دیسکورد', en: 'Discord',
      items: {
        fa: ['دیسکورد میوت کن', 'دیسکورد دیفن کن', 'کلا ساکت کن', 'کلا برگردون'],
        en: ['Discord mute', 'Discord deafen', 'Full silence', 'Bring it all back'],
      },
    },
    tools: {
      fa: 'ابزارها', en: 'Tools',
      items: {
        fa: ['یک جوک بگو', 'هوا چطوره', 'آب و هوای مشهد', 'قیمت دلار چنده', 'اوقات شرعی', 'یادداشت کن: خرید نان', 'اینجا برام تایپ کن'],
        en: ['Tell me a joke', 'How is the weather', 'Weather in Mashhad', 'Dollar price', 'Prayer times', 'Note: buy bread', 'Type here for me'],
      },
    },
  };
  function cmdCategoryOf(c) {
    const s = String(c || '');
    if (/یوتیوب|ویدیو|فیلم|پین|شناور|youtube|video|movie/i.test(s)) return 'video';
    if (/موزیک|موسیقی|آهنگ|اهنگ|music|song/i.test(s)) return 'music';
    if (/دیسکورد|discord/i.test(s)) return 'discord';
    if (/سایت|گوگل|وب\s?سایت|مرورگر|google|website/i.test(s)) return 'web';
    return 'video'; /* پرکاربردترین دسته */
  }
  let cpCat = 'video';
  function cpRender() {
    const L = LANG === 'en';
    const tabs = $('#cpTabs'), chips = $('#cpChips');
    if (!tabs || !chips) return;
    tabs.innerHTML = '';
    Object.keys(CMD_PAGE_DECK).forEach((id) => {
      const d = CMD_PAGE_DECK[id];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cp-tab' + (id === cpCat ? ' on' : '');
      b.textContent = L ? d.en : d.fa;
      b.addEventListener('click', () => { cpCat = id; cpRender(); });
      tabs.appendChild(b);
    });
    chips.innerHTML = '';
    const list = (L ? CMD_PAGE_DECK[cpCat].items.en : CMD_PAGE_DECK[cpCat].items.fa);
    list.forEach((txt, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cs-chip';
      b.textContent = txt;
      b.style.animationDelay = Math.min(i * 0.035, 0.5).toFixed(3) + 's';
      b.addEventListener('click', () => { closeCmdPage(); runCommand(txt, { wake: false }); });
      chips.appendChild(b);
    });
  }
  function openCmdPage(cat) {
    try {
      const page = $('#cmdPage');
      if (!page) return false;
      cpCat = CMD_PAGE_DECK[cat] ? cat : 'video';
      cpRender();
      page.hidden = false;
      page.classList.remove('bye');
      actLog('commands page open: ' + cpCat);
      return true;
    } catch (_) { return false; }
  }
  function closeCmdPage() {
    try {
      const page = $('#cmdPage');
      if (!page || page.hidden) return;
      page.classList.add('bye');
      setTimeout(() => { page.hidden = true; page.classList.remove('bye'); }, 240);
    } catch (_) { /* noop */ }
  }
  {
    const cpClose = $('#cpClose'), cpBack = $('#cpBack');
    if (cpClose) cpClose.addEventListener('click', closeCmdPage);
    if (cpBack) cpBack.addEventListener('click', closeCmdPage);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCmdPage(); });
  }
  {
    const cmdPageRule = {
      k: /(دستورات|فرمان[هاات\u200c]{1,4}|کامند[هاات]?)[^.]{0,48}(ببینم|نشون|نشان|لیست|چیه|کدوما|بده|مربوط)|(لیست|فهرست)\s+(دستور|فرمان|کامند)|چه\s+(فرمان|دستور|کارایی)|show\s+(all\s+)?commands|command\s+(list|page)|list\s+(all\s+)?commands/i,
      id: 'cmdpage', t: 'صفحهٔ فرمان‌ها', i: '#i-gear',
      r: (c) => {
        openCmdPage(cmdCategoryOf(c));
        return LANG === 'en' ? 'Commands page is open — say or click any of them.' : 'صفحهٔ فرمان‌ها باز شد؛ هر کدام را بگو یا رویش کلیک کن.';
      },
    };
    RULES.splice(1, 0, cmdPageRule);
  }

  /* --- v0.40/v0.41 — جستجوی درون-سایتی با دایرهٔ لغات باز ---
     v0.41 (درخواست کاربر): «برو توی سایت فلان اینو سرچ کن» اشتباهی در گوگل
     سرچ می‌شد ولی «دنبال … بگرد» درست بود — حالا پارسر مشترک
     AVAVoice.parseSiteSearch همهٔ تعبیرها را می‌گیرد: سرچ/جستجو/بگرد/پیدا کن
     × سایت X / اسم معروف بدون واژهٔ سایت / دامنهٔ خام / این سایت (حافظه). */
  function siteSearchUrlFor(base, q) {
    const host = String(base || '').replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
    const enc = encodeURIComponent(q || '');
    /* v0.45 — «توی گوگل دنبال X بگرد» جستجوی گوگل است، نه site:google.com */
    if (/^(www\.)?google\./.test(host)) return 'https://www.google.com/search?q=' + enc;
    if (/digikala/.test(host)) return 'https://www.digikala.com/search/?q=' + enc;
    if (/aparat/.test(host)) return 'https://www.aparat.com/result/' + enc;
    if (/torob/.test(host)) return 'https://torob.com/search/?query=' + enc;
    /* v0.41 — جستجوی بومی سایت‌های بیشتر */
    if (/zoomit/.test(host)) return 'https://www.zoomit.ir/search/?q=' + enc;
    if (/digiato/.test(host)) return 'https://www.digiato.com/search/?q=' + enc;
    if (/wikipedia/.test(host)) return 'https://fa.wikipedia.org/w/index.php?search=' + enc;
    if (/github/.test(host)) return 'https://github.com/search?q=' + enc;
    if (/stackoverflow/.test(host)) return 'https://stackoverflow.com/search?q=' + enc;
    if (/cafebazaar/.test(host)) return 'https://cafebazaar.ir/search?q=' + enc;
    if (/filimo/.test(host)) return 'https://www.filimo.com/search?q=' + enc;
    if (/virgool/.test(host)) return 'https://virgool.io/search?q=' + enc;
    if (/namnak/.test(host)) return 'https://www.namnak.com/search/?q=' + enc;
    if (/varzesh3/.test(host)) return 'https://www.varzesh3.com/search?q=' + enc;
    /* v0.46 — «ایمال سرچ کن موتور»: جستجوی بومی emalls — آدرس‌های «/جستجو/…»
       که AI ساخته بود HTTP 500 می‌دادند (لاگ واقعی کاربر) */
    if (/emalls/.test(host)) return 'https://emalls.ir/?s=' + enc;
    if (/downloadha|soft98/.test(host)) return 'https://www.google.com/search?q=' + encodeURIComponent('site:' + host + ' ' + q);
    return 'https://www.google.com/search?q=' + encodeURIComponent('site:' + host + ' ' + q);
  }
  /* v0.46 — URL ابریِ بدون عبارت ممنوع (لاگ واقعی: «برو به سایت ایمال سرچ کن
     موتور» دو بار صفحهٔ اصلی/خراب emalls باز شد، عبارتِ «موتور» گم شده بود).
     اگر AI برای درخواستِ جستجوی درون-سایتی open_urlِ بدون عبارت داد، همین‌جا
     URL با فرمت بومی سایت بازسازی می‌شود — کلی و بدون دیکشنری مثال. */
  function aiUrlWithQuery(url, cmd) {
    try {
      const u = String(url || '').trim();
      if (!/^https?:\/\//i.test(u)) return u;
      const und = (window.AVAUnderstand && AVAUnderstand.analyze) ? AVAUnderstand.analyze(cmd) : null;
      if (!und || !und.searchVerb || !und.query || und.query.length < 2) return u;
      const host = u.replace(/^https?:\/\//i, '').split(/[/?#]/)[0].toLowerCase();
      const enc = encodeURIComponent(und.query);
      if (/^(www\.)?(google|bing|duckduckgo)\./.test(host)) return u; /* خودش موتور جستجوست */
      if (/youtube\./.test(host)) {
        return /search_query=/.test(u) ? u : 'https://www.youtube.com/results?search_query=' + enc;
      }
      if (u.includes(und.query) || u.toLowerCase().includes(enc.toLowerCase())) return u;
      if (/[?&](q|s|search|query|text|k|keyword|p)=/i.test(u)) return u; /* AI خودش عبارت گذاشته */
      const native = siteSearchUrlFor(host, und.query);
      if (native && !/site:/.test(native)) return native; /* فقط سایت‌های با جستجوی بومی */
      return u + (u.includes('?') ? '&' : (u.endsWith('/') ? '' : '/') + '?') + 'q=' + enc;
    } catch (_) { return url; }
  }
  /* deps پارسر — هر بار از وضعیت واقعی برنامه (حافظهٔ آخرین سایت) */
  function siteSearchDeps() {
    return {
      knownSite: (s) => knownExactOf(s),
      knownName: (s) => knownNameOf(s),
      domainOf: (s) => siteDomainOf(s) || siteDomainOf(siteTargetOf(s)),
      lastSite: String(store.get('lastSite', '') || ''),
    };
  }
  async function siteSearchReply(c) {
    const hit = AVAVoice.parseSiteSearch(c, siteSearchDeps());
    if (!hit || !bridge || !bridge.system) return AI_FALLBACK;
    const q = hit.query;
    /* v0.47 — B14: نتیجهٔ واقعی IPC دیگر دور ریخته نمی‌شود — شکست = پیام صادق
       (قبلاً .catch(()=>null) بود و همیشه «جستجو کردم» گفته می‌شد) */
    const _fail = (LANG === 'en' ? 'The search could not be opened.' : 'جستجو باز نشد — یک بار دیگر امتحان کن.');
    if (hit.rawName) {
      const wq = (hit.rawName + ' ' + q).trim();
      const r = await bridge.system.run('web_search', wq).catch(() => null);
      if (!(r && r.ok)) return _fail;
      return LANG === 'en' ? `"${q}" on ${hit.rawName} — searched the web.` : `«${q}» را در ${hit.rawName} جستجو کردم (از طریق وب).`;
    }
    if (!q) return AI_FALLBACK;
    if (hit.thisSite && !hit.base) {
      const r = await bridge.system.run('web_search', q).catch(() => null);
      if (!(r && r.ok)) return _fail;
      return LANG === 'en' ? `I searched the web for "${q}" — no site was opened before.` : `سایتی قبلاً باز نشده بود؛ «${q}» را در وب جستجو کردم.`;
    }
    let base = hit.base, siteName = hit.siteName;
    if (hit.thisSite) base = String(store.get('lastSite', '') || '');
    if (!base) return AI_FALLBACK;
    if (!siteName) siteName = base.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    store.set('lastSite', base); /* «حالا توی این سایت…» بعدی همین‌جا می‌افتد */
    const r2 = await bridge.system.run('web_open', siteSearchUrlFor(base, q)).catch(() => null);
    if (!(r2 && r2.ok)) return _fail;
    return LANG === 'en' ? `I searched "${q}" on ${siteName}.` : `«${q}» را در ${siteName} جستجو کردم.`;
  }
  {
    /* v0.41 — قانون site_search با دروازهٔ پارسرِ کامل (نه یک regex)، و
       «قبل از web_open» تا «توی سایت X سرچ کن» دیگر هرگز Googleِ کور نشود؛
       خود پارسر برای یوتیوب null می‌دهد تا مسیر بومی yt_search (جلوتر در
       فهرست) اولویت خودش را نگه دارد */
    const siteSearchRule = {
      k: { test: (c) => !!AVAVoice.parseSiteSearch(c, siteSearchDeps()) },
      id: 'site_search', t: 'جستجو در سایت', i: '#i-search', r: (c) => siteSearchReply(c),
    };
    const wi = RULES.findIndex((r) => r.id === 'web_open');
    RULES.splice(wi >= 0 ? wi : RULES.length, 0, siteSearchRule);
  }

  /* ============================================================
     v0.39 — پیشنهاد زمینه‌ای فرمان‌ها (درخواست کاربر):
     «اگه کاربر داره با یه دستور دربارهٔ یوتیوب و فیلم کار میکنه، اون لحظه
     پیشنهاد بده میخای کامندهای مربوط به ویدیو یا یوتیوبو ببینی .. بعد یه
     صفحهٔ ساده با یه انیمیشن باز بشه کامندها رو نشون بده»
     کارت شیشه‌ای کوچک با انیمیشن پایین صفحه باز می‌شود؛ کلیک روی هر فرمان
     = اجرا؛ بعد از ۱۶ ثانیه خودش می‌رود. هر دسته حداکثر هر ۱۲ ساعت یک‌بار
     تا اذیت نکند — و در وسط کار هرگز جلوی فرمان بعدی را نمی‌گیرد.
     ============================================================ */
  const SUGGEST_TRIGGERS = new Set(['open_youtube', 'open_music', 'yt_search', 'yt_play', 'yt_bring', 'now_playing', 'player_open', 'player_ctl', 'yt_close', 'music_play', 'music_pause', 'music_next', 'music_prev', 'music_page', 'media_next', 'media_prev', 'media_toggle']);
  const SUGGEST_DECK = {
    video: {
      title: { fa: 'درگیر یوتیوب و ویدیویی؟', en: 'Working with YouTube/video?' },
      sub: { fa: 'این فرمان‌ها همین حالا کار می‌کنند — بگو یا کلیک کن:', en: 'These commands work right now — say or click:' },
      items: {
        fa: ['ویدیو رو پین کن', 'ویدیو رو ببر گوشهٔ بالا راست', 'ویدیو رو شیشه‌ای کن', 'ویدیو رو ببند', 'آهنگ بعدی', 'صدا رو کم کن', 'تو یوتیوب آهنگ X رو سرچ کن'],
        en: ['Pin the video', 'Move it to top-right', 'Make it translucent', 'Close the video', 'Next song', 'Lower the volume', 'Search YouTube for X'],
      },
    },
  };
  let csTimer = 0, csByeT = 0;
  function maybeSuggestCommands(cat) {
    try {
      const d = SUGGEST_DECK[cat];
      if (!d) return;
      /* هر دسته هر ۱۲ ساعت یک‌بار — نه هر فرمان (کاربر معتاد پیشنهاد نشود) */
      const seen = store.get('cmdSuggestAt', {}) || {};
      if (Date.now() - Number(seen[cat] || 0) < 12 * 60 * 60 * 1000) return;
      seen[cat] = Date.now();
      store.set('cmdSuggestAt', seen);
      const L = LANG === 'en';
      const titleEl = $('#csTitle'), subEl = $('#csSub'), chips = $('#csChips'), card = $('#cmdSuggest');
      if (!titleEl || !chips || !card) return;
      titleEl.textContent = L ? d.title.en : d.title.fa;
      if (subEl) subEl.textContent = L ? d.sub.en : d.sub.fa;
      chips.innerHTML = '';
      (L ? d.items.en : d.items.fa).forEach((txt) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cs-chip';
        b.textContent = txt;
        b.addEventListener('click', () => { hideCmdSuggest(); runCommand(txt, { wake: false }); });
        chips.appendChild(b);
      });
      /* v0.40 — «همهٔ فرمان‌ها» → صفحهٔ کامل فرمان‌ها (خواستهٔ اصلی کاربر) */
      const all = document.createElement('button');
      all.type = 'button';
      all.className = 'cs-all';
      all.textContent = L ? 'See all commands' : 'همهٔ فرمان‌ها';
      all.addEventListener('click', () => { hideCmdSuggest(); openCmdPage(cat); });
      chips.appendChild(all);
      card.hidden = false;
      card.classList.remove('bye');
      clearTimeout(csTimer);
      clearTimeout(csByeT);
      csTimer = setTimeout(hideCmdSuggest, 16000);
      actLog('suggest card shown: ' + cat);
    } catch (_) { /* noop */ }
  }
  function hideCmdSuggest() {
    try {
      const card = $('#cmdSuggest');
      if (!card || card.hidden) return;
      card.classList.add('bye');
      clearTimeout(csByeT);
      csByeT = setTimeout(() => { card.hidden = true; card.classList.remove('bye'); }, 300);
    } catch (_) { /* noop */ }
  }
  {
    const csCloseBtn = $('#csClose');
    if (csCloseBtn) csCloseBtn.addEventListener('click', hideCmdSuggest);
  }

  /* v0.39 — کاتالوگ فشردهٔ فرمان‌های آوا برای هوش مصنوعی (درخواست کاربر:
     «اگه کاربر یه شکل دیگ درخواست کنه، AI بررسی کنه اگه توی کامندها بود اجراش کنه»).
     فقط وقتی فرمان به قوانین نرسید به پیام کاربر می‌چسبد تا توکن هدر نرود؛
     AI اگر هم‌معنا پیدا کرد، بلوک DO با act=run_cmd می‌دهد و اجرا با کد محلی است.
     v0.41 — CATALOG_HINTS: برای پرتکرارترین سوءتفهم‌ها چند مترادفِ فارسی کنار
     عنوان می‌نشیند تا «ای آی متوجه بشه به کدام کامند مربوط میشه» دقیق‌تر شود
     (خواستهٔ خود کاربر) — چند خط کوتاه، هزینهٔ توکن ناچیز. */
  const CATALOG_HINTS = {
    web_search: 'سرچ کن، جستجو کن، گوگل کن، پیداش کن — کل وب',
    site_search: 'جستجو داخل یک سایت مشخص: توی سایت X اینو/دنبال … سرچ کن/بگرد/پیدا کن',
    yt_search: 'جستجو یا پخش داخل یوتیوب: تو یوتیوب X رو سرچ کن / پلی کن',
    yt_bring: 'ویدیویی که الان در مرورگر/سیستم پخش میشه رو با پلیر پیش‌فرض کاربر پخش کن: همین ویدیو رو بیار',
    now_playing: 'چی داره پخش میشه؟ — وضعیت پخش سیستم',
    player_open: 'پخش در پلیر ویندوز: با وی‌ال‌سی/پت‌پلیر/کی‌ام‌پلیر/mpv آهنگ X رو پخش کن — یا «با پلیر پیش‌فرض پخش کن»',
    player_ctl: 'کنترل پلیر: ویدیو رو پلی/پاز کن / برو جلو ۳۰ ثانیه / فول اسکرین کن / پلیر رو ببند / پین کن / بزرگترش کن / ببرش بالا سمت راست',
    web_open: 'فقط باز کردن سایت — بدون هیچ جستجویی',
    open_youtube: 'باز کردن خود یوتیوب',
    open_music: 'پخش موزیک/آهنگ',
    music_play: 'پخش آهنگ یا پلی‌لیست',
    music_pause: 'توقف/ادامهٔ موزیک',
    music_next: 'آهنگ بعدی',
    music_prev: 'آهنگ قبلی',
    vol_up: 'بلند کردن صدا',
    vol_down: 'کم کردن صدا',
    vol_mute: 'قطع/بی‌صدا کردن صدا',
    vol_set: 'صدا روی عدد مشخص (مثلا ۵۰ درصد)',
    reminder: 'یادآوری، آلارم، بیدارم کن',
    timer: 'تایمر (مثلا ۱۰ دقیقه)',
    timer_report: 'چند تا تایمر دارم/تایمرام چیه/فعاله؟ — وضعیت محلی',
    timer_cancel: 'لغو/برداشتن تایمرها',
    screenshot: 'اسکرین‌شات/عکس صفحه',
    lock: 'قفل کردن صفحه',
    minimize_all: 'نمایش دسکتاپ/مینیمایز همهٔ پنجره‌ها',
    status: 'وضعیت سیستم/CPU/RAM',
    battery: 'میزان باتری',
    clock: 'ساعت چنده',
    date: 'تاریخ امروز/چندمه',
    notes: 'یادداشت',
    notes_open: 'باز کردن/خواندن یادداشت ذخیره‌شده: اون یادداشت رو باز کن',
    open_chrome: 'باز کردن مرورگر کروم',
    rec_start: 'شروع ضبط صدا',
    rec_stop: 'پایان ضبط صدا',
    cmdpage: 'نمایش همهٔ فرمان‌ها',
  };
  function aiCmdCatalogCtx() {
    try {
      const rows = RULES.filter((r) => r.id).map((r) => r.id + ' = ' + r.t + (CATALOG_HINTS[r.id] ? ' — ' + CATALOG_HINTS[r.id] : ''));
      if (!rows.length) return '';
      return (LANG === 'en'
        ? '[AVA command catalog — if the user request means one of these commands (even with totally different wording), reply with ONLY a DO block using act=run_cmd and value=<id>. If it matches none, ignore this list.\n'
        : '[فهرست فرمان‌های آوا — اگر درخواست کاربر هم‌معنای یکی از این فرمان‌ها بود (حتی با تعبیر کاملاً متفاوت)، فقط بلوک DO بده با act=run_cmd و value=همان id. اگر به هیچ‌کدام ربط نداشت این فهرست را نادیده بگیر.\n')
        + rows.join('\n') + ']';
    } catch (_) { return ''; }
  }

  /* v0.41 — حافظهٔ نگاشت AI (درخواست کاربر: «سریعتر به AI وصلش کنیم»):
     بار اول AI عبارتِ نامتعارف را به فرمان واقعی آوا نگاشت می‌کند (run_cmd)؛
     از دفعهٔ بعد همان عبارت «بی‌شبکه و در لحظه» اجرا می‌شود — نگاشت‌های
     موفق محلیِ امن (فقط run_cmd) تا ۵۰ عدد و ۳۰ روز در localStorage. */
  const AI_MAP_KEY = 'avaAiCmdMap';
  const AI_MAP_TTL = 30 * 24 * 60 * 60 * 1000;
  let aiCmdMap = (() => { try { return JSON.parse(localStorage.getItem(AI_MAP_KEY) || '{}') || {}; } catch (_) { return {}; } })();
  const aiMapNorm = (c) => normFaFull(String(c || '')).toLowerCase().replace(/[\s\u200C]+/g, ' ').trim();
  function aiMapGet(cmd) {
    try {
      const e = aiCmdMap[aiMapNorm(cmd)];
      if (!e || !e.id || Date.now() - Number(e.at || 0) > AI_MAP_TTL) return null;
      return RULES.some((r) => r.id === e.id) ? e.id : null;
    } catch (_) { return null; }
  }
  function aiMapSet(cmd, id) {
    try {
      const k = aiMapNorm(cmd);
      if (!k || !id || k.length < 3) return;
      const now = Date.now();
      const keep = Object.entries(aiCmdMap).filter(([kk, vv]) => kk !== k && now - Number(vv.at || 0) <= AI_MAP_TTL);
      keep.push([k, { id: String(id), at: now }]);
      aiCmdMap = Object.fromEntries(keep.slice(-50));
      localStorage.setItem(AI_MAP_KEY, JSON.stringify(aiCmdMap));
      actLog('ai map cached: "' + k.slice(0, 40) + '" → ' + id);
    } catch (_) { /* noop */ }
  }

  /* ============================================================
     v0.47 — سیستم یادگیری آوا (SELF-LEARNING — درخواست صریح کاربر)
     «اگ از ai یک درخواستی کرد کاربر ava خودش اون رو یاد بگیره و دفعات
     بعد افلاین انجام بده ..ولی اگ کاربر از عمل کرد ai راضی نبود و دوباره
     تکرار کرد اون یادگیری قبلی رو تجدید نظر کنه»
     موتور: renderer/js/voiceLearn.js — ذخیرهٔ پایدار: ava-learnings.json
     ============================================================ */
  let learnStore = { v: 1, items: [] };
  let learnLoaded = false;
  async function loadLearnStore() {
    try {
      if (bridge && bridge.learnings && bridge.learnings.load) {
        const r = await bridge.learnings.load();
        if (r && r.ok && r.data && Array.isArray(r.data.items)) learnStore = r.data;
      }
    } catch (_) { /* noop */ }
    learnLoaded = true;
    /* میراث: نگاشت‌های run_cmd قدیمیِ localStorage وارد حافظهٔ پایدار می‌شوند */
    try {
      let migrated = 0;
      for (const [k, v] of Object.entries(aiCmdMap || {})) {
        if (!v || !v.id || Date.now() - Number(v.at || 0) > AI_MAP_TTL) continue;
        if (learnStore.items.some((x) => x.k === k)) continue;
        learnStore.items.push({ k, acts: [{ act: 'run_cmd', value: String(v.id) }], at: Number(v.at || Date.now()), used: 0, revise: 0, lastHit: 0 });
        migrated++;
      }
      if (migrated) { saveLearnStore(); actLog('learn migration from aiCmdMap: ' + migrated); }
    } catch (_) { /* noop */ }
  }
  let learnSaveBusy = false;
  async function saveLearnStore() {
    if (learnSaveBusy) return;
    learnSaveBusy = true;
    try { if (bridge && bridge.learnings && bridge.learnings.save) await bridge.learnings.save(JSON.parse(JSON.stringify(learnStore))); } catch (_) { /* noop */ }
    learnSaveBusy = false;
  }
  /* فرمت مقدار lastHit در زمانِ یادگیری هم ست می‌شود: اولین تکرار کاربرِ
     ناراضیِ بلافاصله هم «تجدید نظر» حساب می‌شود (خواستهٔ صریح کاربر) */
  async function learnFromAI(cmd, acts, reply) {
    try {
      const Le = (typeof AVALearn !== 'undefined') ? AVALearn : null;
      if (!Le || !cmd) return;
      /* v0.53 — جملهٔ ارجاعی به تاریخچه هرگز یاد گرفته نمی‌شود: معنایش وابسته به
         گفتگوی همان لحظه است و بازپخش آفلاینش = پخش دوبارهٔ توهم. سند لاگ v0.52
         خط 3260: «همون آهنگ شادمهری که آخرین بار سرچ کردی» → web_search(توهم
         «قشنگترین گناه شادمهر») و همان توهم learn set شد! */
      /* v0.54 — دامنهٔ گارد باز شد: همین/این/اون و حالت‌های پیوسته‌اش هم
         (لاگ v0.53 ۱۶:۴۸/۱۶:۴۹: «تو یوتیوب همین آهنگو سرچ کن» و «…مگم همینو
         برام…» learn set شدند چون گارد فقط همون/همان را می‌گرفت) */
      if (/(همون|همین|همان|همو|همونو|همینو|اونو|اینو)([\s،؛»"']|$)|(?:^|[\s،؛])(اون|این)\s?(آهنگ|موزیک|ویدیو|اسم|صفحه|سایت|لینک)|آخرین بار|قبلی|پارسال|که گفتی|که گفتم|که سرچ کردی|که پخش کردی|منظورم|آخرین\s(سایت|یادداشت|آهنگ)/.test(String(cmd))) {
        actLog('learn skip: جملهٔ ارجاعی به تاریخچه — قابل بازپخش آفلاین نیست: ' + String(cmd).slice(0, 44));
        return;
      }
      /* v0.50 — یادگیریِ URL «اصلاح‌شده» نه توهمِ AI: سند لاگ v0.49 خط ۱۵۸۴ —
         لینک توهمی divar.ir/s/bojnurd/mot (۴۰۴) یاد گرفته شد و آفلاین دوباره
         باز می‌شد. الان همان مسیر اجرای واقعی (siteUrlFix) قبل از ذخیره می‌آید */
      const safe = Le.safeActs(acts).map((a) => (a && a.act === 'open_url' && a.value)
        ? Object.assign({}, a, { value: siteUrlFix(a.value) })
        : a);
      if (!safe.length) return;
      const lr = Le.learn(learnStore, cmd, safe, reply || '');
      /* v0.69 — گیت کیفیت: نویز STT («دو تلیگرام بیدی بیدی بید») هرگز
         فرمانِ دائمی نمی‌شود — قبلاً open_url(web.telegram.org) یاد گرفته بود! */
      if (lr && lr.updated && window.AVACore && window.AVACore.isGibberish && window.AVACore.isGibberish(cmd)) {
        actLog('learn skip: جملهٔ نامفهوم (نویز STT) — ذخیره نشد: ' + String(cmd).slice(0, 44));
        return;
      }
      if (lr.changed && lr.entry) {
        lr.entry.lastHit = Date.now(); /* AI همین حالا انجامش داد */
        await saveLearnStore();
        actLog('learn set (from AI): "' + String(cmd).slice(0, 44) + '" → ' + Le.summary(safe));
        try { renderLearnList(); } catch (_) { /* noop */ }
      }
    } catch (_) { /* noop */ }
  }

  /* ============================================================
     v0.65 — آموخته‌های صریح کاربر (TEACH STORE)
     ------------------------------------------------------------
     «یاد بگیر وقتی گفتم X یعنی Y» → ava-taught.json (userData)
     • ذخیره‌گاه جدا از self-learning تا نارضایتیِ AI با درسِ صریح کاربر قاطی نشود
     • بازنویسیِ قطعی پیش از همهٔ لَین‌ها: X → Y (حتی آفلاین، حتی بدون AI)
     ============================================================ */
  let taughtStore = { v: 1, items: [] };
  let taughtLoaded = false;
  async function taughtLoad() {
    if (taughtLoaded) return taughtStore;
    taughtLoaded = true;
    try {
      if (bridge && bridge.learnings && bridge.learnings.loadTaught) {
        const r = await bridge.learnings.loadTaught();
        if (r && r.ok && r.data && Array.isArray(r.data.items)) taughtStore = r.data;
      }
    } catch (_) { /* noop */ }
    if (!taughtStore || !Array.isArray(taughtStore.items)) taughtStore = { v: 1, items: [] };
    return taughtStore;
  }
  async function taughtPersist() {
    try {
      if (bridge && bridge.learnings && bridge.learnings.saveTaught) {
        await bridge.learnings.saveTaught(JSON.parse(JSON.stringify(taughtStore)));
      }
    } catch (_) { /* noop */ }
  }

  /* ---------- هندلرهای لَین آموزش (قطعی — هرگز به AI نمی‌روند) ---------- */
  function _teachReplyShell(original, rep, tagKey) {
    setState('success');
    statusText.textContent = t('teach.status');
    body.classList.add('has-card');
    rcHeard.textContent = `«${original}»`;
    respCard.classList.remove('show');
    void respCard.offsetWidth;
    respCard.classList.add('show');
    rcTag.textContent = t(tagKey);
    typeText(rcReply, rep);
    speak(rep);
    pushChatHist('user', original); pushChatHist('assistant', rep);
    pushHistory(original, true);
    playDoneSound();
    handsFreeRearm();
    _dispatchOutcome = 'teach';
    setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 4200);
  }
  async function teachHandle(tp, original) {
    const st = await taughtLoad();
    const res = AVALearn.taughtSave(st, tp.phrase, tp.command);
    await taughtPersist();
    actLog('teach-save: «' + String(tp.phrase).slice(0, 48) + '» → «' + String(tp.command).slice(0, 60) + '»', 'ui', { ev: 'teach', save: true, updated: !!res.updated, n: st.items.length });
    const key = res.updated ? 'teach.updated' : 'teach.saved';
    _teachReplyShell(original, t(key, { x: tp.phrase, y: tp.command }), 'teach.tag');
  }
  async function teachForgetHandle(tf, original) {
    const st = await taughtLoad();
    const res = AVALearn.taughtDrop(st, tf.key, tf.all);
    await taughtPersist();
    actLog('teach-forget: ' + (tf.all ? 'ALL' : String(tf.key).slice(0, 48)), 'ui', { ev: 'teach', forget: true, removed: res.removed || 0 });
    let rep;
    if (res.all) rep = t('teach.cleared', { n: res.removed });
    else if (res.removed) rep = t('teach.forgot', { x: res.removedPhrase || tf.key, n: st.items.length });
    else rep = t('teach.notFound');
    _teachReplyShell(original, rep, 'teach.tag');
  }
  async function teachListHandle(original) {
    const st = await taughtLoad();
    const items = st.items.slice()
      .sort((a, b) => ((b.used || 0) * 1e12 + (b.at || 0)) - ((a.used || 0) * 1e12 + (a.at || 0)))
      .slice(0, 8);
    const rep = !st.items.length
      ? t('teach.empty')
      : t('teach.list', { n: st.items.length }) + '\n' + items.map((x, i) => (i + 1) + '. «' + (x.phrase || x.k) + '» ← ' + x.command).join('\n');
    actLog('teach-list: n=' + st.items.length, 'ui', { ev: 'teach', list: true });
    _teachReplyShell(original, rep, 'teach.tag');
  }

  /* ============================================================
     v0.42 — عکسِ لحظه‌ایِ وضعیت آوا برای هوش مصنوعی (خواستهٔ کاربر:
     «gemini یا ai پس‌زمینه … درخواست‌های پس‌زمینه و ذخیره‌شدهٔ کاربر
     رو بتونه ببینه») — تایمرهای فعال، یادآوری‌ها، یادداشت‌های ذخیره‌شده،
     آخرین سایت. فقط وقتی چیزی واقعاً هست پر می‌شود (هزینهٔ توکن ≈ صفر) و
     AI با act=note_show می‌تواند یادداشت را هم دوباره «باز» کند.
     ============================================================ */
  async function avaStateCtx() {
    try {
      const rows = [];
      if (typeof TIMERS !== 'undefined' && TIMERS.length) {
        rows.push('تایمرهای فعال: ' + TIMERS.slice(0, 5).map((tm) => `${tm.label} ${tm.unit}`).join('، '));
      }
      try {
        if (bridge && bridge.reminders && bridge.reminders.list) {
          const r = await bridge.reminders.list();
          const items = (((r && r.reminders) || [])).slice().sort((a, b) => a.at - b.at).slice(0, 5);
          if (items.length) {
            const fmt = new Intl.DateTimeFormat(LANG === 'en' ? 'en-US' : 'fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            rows.push('یادآوری‌های ثبت‌شده: ' + items.map((x) => `«${String(x.text).slice(0, 40)}» (${fmt.format(new Date(x.at))})`).join('، '));
          }
        }
      } catch (_) { /* noop */ }
      try {
        const notes = Array.isArray(NOTES) && NOTES.length ? NOTES : (await notesLoad());
        const live = (notes || []).filter((n) => n && n.x).slice(0, 3);
        if (live.length) {
          rows.push('یادداشت‌های ذخیره‌شدهٔ کاربر: ' + live.map((n, i) => `${i + 1}) «${String(n.x).slice(0, 60)}»`).join('  '));
        }
      } catch (_) { /* noop */ }
      const ls = String(store.get('lastSite', '') || '');
      if (ls) rows.push('آخرین سایتی که با آوا باز شد: ' + ls);
      rows.push('افزونهٔ موزیک: ' + (settings.extMusic ? 'روشن' : 'خاموش'));
      if (!rows.length) return '';
      return '[وضعیت لحظه‌ای آوا]\n' + rows.join('\n') +
        '\n(اگر سوال کاربر دربارهٔ همین وضعیت بود — چند تایمر دارد، یادداشتش چی بود، یادآوری فعال دارد یا نه — خودت از همین اطلاعات کوتاه جواب بده و هیچ بلوکی ننویس. اگر کاربر خواست یک یادداشت را دوباره ببیند/بخواند، بلوک DO با act=note_show بده: value=بخشی از متن همان یادداشت، یا value خالی برای آخرین یادداشت.)';
    } catch (_) { return ''; }
  }
  /* v0.42 — بستهٔ کامل زمینه برای فالبک AI: کاتالوگ + وضعیت + extra قانون
     v0.43 — + نامزدهای داوری نیت (وقتی دو نیت نزدیک بودند) */
  /* v0.44 — نام برنامه‌های نصب‌شده برای AI («توی دیوار…» برنامه است یا سایت؟
     AI با دیدن همین فهرست + قانون ۵ تصمیم درست می‌گیرد — حدسِ کورکورانه ممنوع) */
  function appsNamesCtx() {
    try {
      if (!sysApps.list || !sysApps.list.length) return '';
      const names = sysApps.list.slice(0, 60).map((a) => String(a.name || '').slice(0, 24)).filter(Boolean);
      if (!names.length) return '';
      return '[برنامه‌های نصب‌شدهٔ کاربر (بخشی، ' + sysApps.list.length + ' عدد): ' + names.join('، ') + (sysApps.list.length > 60 ? ' …' : '') + ']\n(اگر هدفِ درخواست کاربر یکی از این برنامه‌ها بود، open_app با همان نام بده.)';
    } catch (_) { return ''; }
  }
  /* v0.50 — نمونه‌های آموخته برای AI (خواستهٔ کاربر: «کامندِ ناشناخته →
     Gemini بررسی کنه این به کدوم کامندِ یادگرفته شبیهه و همون اجرا کنه»).
     محتوا-محور رتبه‌بندی می‌شود (توکن مشترک + بیش‌مصرف + تازه) */
  function learnedExamplesCtx(cmd) {
    try {
      const Le = (typeof AVALearn !== 'undefined') ? AVALearn : null;
      if (!Le || !Le.examplesForAi || !learnLoaded || !learnStore.items.length) return '';
      const ex = Le.examplesForAi(learnStore, cmd, 6);
      if (!ex.length) return '';
      return '[فرمان‌هایی که خودت قبلاً از این کاربر یاد گرفته‌ای — اگر درخواستِ تازه به یکی از این‌ها شبیه است، دقیقاً همان عمل‌ها را با همان شکل URL بده (فقط عبارت/شهرِ داخلش را با درخواست تازه عوض کن):\n' +
        ex.map((e) => '- «' + e.say + '» → ' + e.do).join('\n') + '\n]';
    } catch (_) { return ''; }
  }
  async function aiFallbackCtx(rule, cmd) {
    const parts = [aiCmdCatalogCtx(), appsNamesCtx(), learnedExamplesCtx(cmd || ''), await avaStateCtx()];
    if (_intentCands) parts.push(_intentCands);
    if (rule && rule.__aiExtra) parts.push(rule.__aiExtra);
    /* v0.61 — حافظهٔ گفتگو برای فالبک هم — هیچ مسیر AI بی‌حافظه نیست
       v0.69 — تاریخچه ۱۰ رد و بدل (ریشهٔ «دو دقیقه بعد یادش رفته») */
    try { if (window.AVACore) { const t = window.AVACore.turnsCtx(10); if (t) parts.push(t); const e = window.AVACore.entityCtx(); if (e) parts.push(e); } } catch (_) { /* noop */ }
    return parts.filter(Boolean).join('\n');
  }
  /* v0.61 — بستهٔ زمینهٔ لَین مغز (ستون ۴): مثل فالبک + حافظهٔ گفتگو +
     موجودیت‌ها. قانون ۹ِ پرامپت («ارجاع را از تاریخچه حل کن») حالا واقعاً
     تاریخچه دارد — ریشهٔ «همون مدل موتوری که گفتیم» همین بود. */
  async function aiBrainCtx() {
    const parts = [aiCmdCatalogCtx(), appsNamesCtx(), learnedExamplesCtx(arguments.length ? arguments[0] : ''), await avaStateCtx()];
    /* v0.69 — تاریخچه ۱۰ رد و بدل + واقعیت‌های اخیر (یادداشت/مقصد پیام/نتیجهٔ سرچ) */
    try { if (window.AVACore) { const t = window.AVACore.turnsCtx(10); if (t) parts.push(t); const e = window.AVACore.entityCtx(); if (e) parts.push(e); } } catch (_) { /* noop */ }
    return parts.filter(Boolean).join('\n');
  }

  /* ============================================================
     باز کردن برنامه‌های سیستم (v0.12) — معادل phonetic_dictionary.json
     کاربر نام‌ها را فارسی می‌گوید اما فایل‌ها انگلیسی‌اند؛ پس:
     ۱) دیکشنری تلفظ صوتی: «کروم» → chrome ، «فتوشاپ» → photoshop
     ۲) تطبیق فازی (Levenshtein): اگر نام دقیق نبود، نزدیک‌ترین
        برنامه از نتیجه اسکن Start Menu + Steam پیدا می‌شود
     پایپ‌لاین ۵ مرحله‌ای: فرمان دقیق → قوانین regex → فازی برنامه‌ها
     → هوش مصنوعی — فقط وقتی هیچ‌کدام جواب نداد سراغ AI می‌رویم.
     ============================================================ */
  const APP_OPEN_RE = /(باز\s*(کن|بکن|شو|شه|کردن)|اجرا\s*(کن|بکن|بده|شه|کردن)|بیار\s*(بالا|روی|شکم)|بذار\s*(باز|اجرا|بشه)|لانچ|launch|run|open|start)/i;
  const APP_PHONETIC = {
    'کروم': 'chrome', 'گل کروم': 'google chrome', 'مرورگر کروم': 'chrome',
    'فایرفاکس': 'firefox', 'موزیلا': 'firefox',
    'اج': 'edge', 'مایکروسافت اج': 'microsoft edge',
    'تلگرام': 'telegram', 'واتساپ': 'whatsapp', 'واتس اپ': 'whatsapp',
    'دیسبورد': 'discord', 'دیسکورد': 'discord',
    'اسپاتیفای': 'spotify', 'اسکایپ': 'skype', 'زوم': 'zoom',
    'وی اس کد': 'visual studio code', 'ویژوال استودیو کد': 'visual studio code', 'ویزوال استودیو کد': 'visual studio code',
    'ویژوال استودیو': 'visual studio',
    'فتوشاپ': 'photoshop', 'الیستریتور': 'illustrator', 'ایلستریتور': 'illustrator', 'پریمیر': 'premiere pro',
    'افترافکت': 'after effects', 'بلندر': 'blender',
    'ورد': 'word', 'اکسل': 'excel', 'پاورپوینت': 'powerpoint', 'اوتلوک': 'outlook', 'وان نوت': 'onenote',
    'تیمز': 'teams', 'تیم ورک': 'teams',
    'پاورشل': 'powershell', 'ترمینال': 'terminal',
    'استیم': 'steam', 'ایپیک گیمز': 'epic games',
    'تاندربیرد': 'thunderbird', 'اوبونتو': 'ubuntu',
    'پی دی اف': 'acrobat', 'آکروبت': 'acrobat', 'ادوبی ریدر': 'acrobat reader',
    'کیوبیس': 'obs', 'او بی اس': 'obs studio',
    'پایتون': 'python', 'جاوا': 'java',
    'گیت هاب': 'github', 'پست من': 'postman', 'پایچرم': 'pycharm',
    'نت پد پلاس پلاس': 'notepad++',
    'وای فای': 'settings', 'وایبر': 'viber', 'لینکدین': 'linkedin',
    /* v0.22 — گسترش دیکشنری فونتیک (به درخواست گزارش کاربر: فهم نام‌های
       انگلیسی با تلفظ فارسی، مثل پروژهٔ قبلی phonetic_dictionary.json) */
    'کرومیوم': 'chromium', 'گوگل کروم': 'google chrome', 'فایر فاکس': 'firefox',
    'اپرا': 'opera', 'براو': 'brave', 'بریو': 'brave', 'وولفیک': 'vivaldi', 'ویوالدی': 'vivaldi',
    'تلگرام دسکتاپ': 'telegram desktop', 'واتس اپ دسکتاپ': 'whatsapp desktop',
    'اینستاگرام': 'instagram', 'فیسبوک': 'facebook', 'فیس بوک': 'facebook',
    'توییتر': 'twitter', 'اکس': 'x', 'اسنپ چت': 'snapchat', 'تیک تاک': 'tiktok',
    'نتفلیکس': 'netflix', 'یوتیوب': 'youtube', 'یوتیوب موزیک': 'yt music',
    'وان درایو': 'onedrive', 'دراپ باکس': 'dropbox', 'گوگل درایو': 'google drive',
    'ای دی ام': 'idm', 'اینترنت دانلود منیجر': 'internet download manager',
    'وی ال سی': 'vlc', 'مدیا پلیر کلاسیک': 'media player classic', 'پات پلیر': 'potplayer',
    'نت پد': 'notepad', 'ماشین حساب': 'calculator', 'تسک منیجر': 'task manager', 'تسک منجر': 'task manager',
    'کامند پرامپت': 'cmd', 'سی ام دی': 'cmd', 'پاور شل': 'powershell',
    'تیم ویور': 'teamviewer', 'انی دسک': 'anydesk', 'راست ویو': 'rustdesk',
    'بلی استکس': 'bluestacks', 'گیم لوپ': 'gameloop', 'امولاتور': 'emulator',
    'ادوبی': 'adobe', 'لایت روم': 'lightroom', 'ادوبی پریمیر': 'premiere pro',
    'اندروید استودیو': 'android studio', 'اینتلیجی': 'intellij', 'اینتلی جی': 'intellij',
    'کد بلاکس': 'codeblocks', 'گیت': 'git', 'داکر': 'docker', 'وی ام ویر': 'vmware',
    'ویرچوال باکس': 'virtualbox', 'فایل زیلا': 'filezilla', 'وی بی نت': 'vb.net',
    'استارول': 'stardew valley', 'ماینکرفت': 'minecraft', 'جی تی ای': 'gta', 'جی تی ای فایو': 'gta v',
    'پابجی': 'pubg', 'فورتنایت': 'fortnite', 'سی اس گو': 'counter strike', 'کالاف دیوتی': 'call of duty',
    'ایکس': 'x', 'دیسکورد کاناری': 'discord canary', 'اورجین': 'origin', 'ایا گیم': 'ea games',
  };

  /* نرمال‌سازی نام برای مچ (ی/ک عربی → فارسی، فاصله و نیم‌فاصله یکدست) */
  const normApp = (s) =>
    String(s || '').toLowerCase()
      .replace(/[\u064A]/g, '\u06CC').replace(/[\u0643]/g, '\u06A9')
      .replace(/[\s\u200C_.\-()[\]؟?!،,:;'"\/\\]+/g, ' ')
      .replace(/[^a-z0-9\u0600-\u06FF+ ]/g, '')
      .replace(/\s+/g, ' ').trim();

  /* فاصله لوانشتاین — برای تطبیق فازی نام برنامه (تایپ اشتباه گوگل/تلفظ متفاوت) */
  function lev(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m || !n) return Math.max(m, n);
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }
  const simRatio = (a, b) => (!a || !b ? 0 : 1 - lev(a, b) / Math.max(a.length, b.length));

  /* کش لیست برنامه‌های اسکن‌شده در رندرر — پروسه اصلی ۲۴ ساعت کش می‌کند */
  const sysApps = { list: [], at: 0, busy: false };
  async function ensureAppsList(force = false) {
    if (!bridge || !bridge.apps) return sysApps.list;
    if (!force && sysApps.list.length && Date.now() - sysApps.at < 20 * 60 * 1000) return sysApps.list;
    if (sysApps.busy) return sysApps.list;
    sysApps.busy = true;
    try {
      const r = force ? await bridge.apps.scan() : await bridge.apps.list();
      if (r && r.ok && Array.isArray(r.apps) && r.apps.length) {
        sysApps.list = r.apps;
        sysApps.at = Date.now();
      } else if (force) {
        sysApps.at = Date.now(); /* اسکن زده شد ولی چیزی نیامد — بلافاصله تکرار نشود */
      }
    } catch (_) { /* noop */ }
    sysApps.busy = false;
    return sysApps.list;
  }
  /* v0.66 — «نرم‌افزارهای من»: شمارش زندهٔ پنل برنامه + دکمهٔ اسکن مجدد.
     اسکن یک‌بارهٔ سیستم در main خودش در بوت (۶ ثانیه بعد) انجام می‌شود؛
     اینجا فقط نمایش و کنترل دستی است. */
  async function appsCountUpdate() {
    const el = $('#appsCount');
    if (!el) return;
    try {
      await ensureAppsList();
      el.textContent = faNum(String(sysApps.list.length));
    } catch (_) { try { el.textContent = '—'; } catch (_) { /* noop */ } }
  }
  {
    const br = $('#btnAppsRescan');
    if (br) br.addEventListener('click', async () => {
      if (!bridge || !bridge.apps || !bridge.apps.scan) return;
      br.disabled = true;
      try {
        const r = await bridge.apps.scan();
        if (r && r.ok) {
          sysApps.list = r.apps || [];
          sysApps.at = Date.now();
          const el = $('#appsCount');
          if (el) el.textContent = faNum(String(r.count || sysApps.list.length));
          toast(t('set.app.appsDone', { x: faNum(String(r.count || 0)) }), '#i-check');
        } else toast(t('set.app.appsFail'), '#i-info');
      } catch (_) { toast(t('set.app.appsFail'), '#i-info'); }
      finally { br.disabled = false; }
    });
    appsCountUpdate();
  }
  /* v0.66 — اکستنشن پیام‌رسانی: چک‌لیست نصب‌شده‌ها + اکستنشن VPN: تشخیص زنده */
  {
    const wrap = $('#msgChecklist');
    if (wrap && typeof AVAMessaging !== 'undefined' && AVAMessaging.detectInstalled) {
      (async () => {
        try {
          await ensureAppsList();
          const ids = AVAMessaging.detectInstalled(sysApps.list);
          wrap.innerHTML = '';
          for (const m of AVAMessaging.msgAppsOf()) {
            const has = ids.indexOf(m.id) >= 0;
            const b = document.createElement('span');
            b.className = 'wake-now-badge' + (has ? '' : ' msg-absent');
            b.textContent = m.fa + (has ? ' ✓' : ' —');
            wrap.appendChild(b);
          }
        } catch (_) { /* noop */ }
      })();
    }
    const bd = $('#btnVpnDetect');
    if (bd) bd.addEventListener('click', async () => {
      const st = $('#vpnStatus');
      if (!bridge || !bridge.vpn || !bridge.vpn.detect) return;
      bd.disabled = true;
      if (st) st.textContent = '…';
      try {
        const r = await bridge.vpn.detect();
        if (st) st.textContent = r && r.active ? (LANG === 'en' ? 'active' : 'فعال') : (LANG === 'en' ? 'none' : 'ندارم');
        if (r && r.active) {
          const det = [];
          if (r.adapters.length) det.push(LANG === 'en' ? 'adapter' : 'آداپتور: ' + r.adapters[0].name);
          if (r.procs.length) det.push((LANG === 'en' ? 'client: ' : 'کلاینت: ') + r.procs.join(', '));
          if (r.ports.length) det.push((LANG === 'en' ? 'proxy ports: ' : 'پورت پروکسی: ') + r.ports.map((p) => p.port + ' (' + p.proc + ')').join(', '));
          toast(det.join(' — ').slice(0, 180), '#i-check');
        } else toast(LANG === 'en' ? 'No active VPN detected.' : 'VPN فعالی پیدا نشد.', '#i-info');
      } catch (_) { if (st) st.textContent = '—'; }
      finally { bd.disabled = false; }
    });
    /* v0.67 — مخاطبین پیام‌رسان: settings.msgContacts=[{id,name,app,handle}]
       — نامِ گفته‌شده در «به علی پیام بده…» از همین‌جا به شناسهٔ واقعی حل می‌شود */
    function msgContactsRender() {
      const box = $('#msgContactsList');
      if (!box) return;
      const list = Array.isArray(settings.msgContacts) ? settings.msgContacts : [];
      box.innerHTML = '';
      if (!list.length) {
        const e = document.createElement('span');
        e.className = 'wake-now-badge msg-absent';
        e.textContent = LANG === 'en' ? 'no contacts yet' : 'هنوز مخاطبی ثبت نشده';
        box.appendChild(e);
        return;
      }
      for (const c of list) {
        const b = document.createElement('span');
        b.className = 'wake-now-badge';
        b.title = c.handle || '';
        b.textContent = (c.name || '?') + ' · ' + c.app + ' · ' + String(c.handle || '').slice(0, 18);
        const x = document.createElement('button');
        x.className = 'ct-del';
        x.textContent = '×';
        x.setAttribute('aria-label', 'delete');
        x.addEventListener('click', () => {
          settings.msgContacts = settings.msgContacts.filter((y) => y.id !== c.id);
          store.set('msgContacts', settings.msgContacts);
          msgContactsRender();
        });
        b.appendChild(x);
        box.appendChild(b);
      }
    }
    msgContactsRender();
    const ctAdd = $('#btnCtAdd');
    if (ctAdd) ctAdd.addEventListener('click', () => {
      const nm = String(($('#ctName') || {}).value || '').trim();
      const hd = String(($('#ctHandle') || {}).value || '').trim();
      const ap = String(($('#ctApp') || {}).value || 'telegram').trim();
      if (!nm || !hd) { toast(LANG === 'en' ? 'Name and handle are required.' : 'نام و شناسه هر دو لازم است.', '#i-info'); return; }
      if (!Array.isArray(settings.msgContacts)) settings.msgContacts = [];
      if (settings.msgContacts.length >= 200) { toast(LANG === 'en' ? 'Contacts list is full.' : 'لیست مخاطبین پر است.', '#i-info'); return; }
      settings.msgContacts.push({ id: 'm' + Date.now().toString(36), name: nm.slice(0, 40), app: ap, handle: hd.slice(0, 80) });
      store.set('msgContacts', settings.msgContacts);
      if ($('#ctName')) $('#ctName').value = '';
      if ($('#ctHandle')) $('#ctHandle').value = '';
      msgContactsRender();
      toast(LANG === 'en' ? 'Contact saved.' : 'مخاطب ثبت شد.', '#i-check');
    });
  }

  /* استخراج نام برنامه از جمله: «لطفا تلگرام رو برام اجرا کن» → «تلگرام» */
  function extractAppName(cmd) {
    let s = String(cmd || '');
    if (/(سایت|وب\s?سایت|https?:\/\/)/i.test(s)) return '';
    s = s
      /* v0.47 — B16: صفت‌های خطابی آغاز جمله («آقا بازی مارول رو تو استیم باز کن»
         قبلاً «آقا بازی مارول تو استیم» می‌ماند) */
      .replace(/(^|\s)(آقا|آخه|خب|خوب|اِ|الا|الان|حالا|یه\s?دونه|یک\s?دونه|لطفاً?)(?=\s)/gi, ' ')
      .replace(/(لطفا|لطفاً|ممنون|بی\s?زحمت|تو\s?رو\s?خدا)/g, ' ')
      .replace(/(برام|برای\s*من|می‌شه|میشه|می\s*شه|می‌خوام|میخوام|لطفا)/g, ' ')
      .replace(/(باز\s*(کن|بکن|شو|شه|کردن)?(?=\s|$|،|\.|!|؟))|(اجرا\s*(کن|بکن|بده|شه|کردن)?(?=\s|$|،|\.|!|؟))|(بیار\s*(بالا|روی|شکم)?(?=\s|$|،|\.|!|؟))|(بذار\s*(باز|اجرا|بشه)(?=\s|$|،|\.|!|؟))|(لانچ\s*(کن)?(?=\s|$|،|\.|!|؟))|(بشین\s*(رو|روی)(?=\s|$|،|\.|!|؟))|\b(run|open|launch|start)\b/gi, ' ')
      .replace(/(^|\s)(رو|را|یه|یک|هم)(\s|$)/g, ' ')
      .replace(/\s*(کن|بکن|شه|شو)\s*$/g, ' ')
      .replace(/[\s\u200C]+/g, ' ')
      .trim();
    return s.length >= 2 ? s.slice(0, 60) : '';
  }

  /* بهترین تطبیق نام از بین برنامه‌های اسکن‌شده (فونتیک + شامل‌بودن + فازی) */
  function matchSysApp(query) {
    const q = normApp(query);
    if (!q || !sysApps.list.length) return null;
    /* دیکشنری تلفظ: فارسی → نام انگلیسی */
    let phon = APP_PHONETIC[q] || null;
    if (!phon) {
      /* اول شامل‌شدن، بعد فازی داخل خود دیکشنری — «تلگرم» هم به telegram می‌رسد */
      let bestFa = null, bestScore = 0;
      for (const [fa, en] of Object.entries(APP_PHONETIC)) {
        const nfa = normApp(fa);
        if ((q.includes(nfa) && nfa.length >= 3) || (nfa.includes(q) && q.length >= 3)) { bestFa = en; break; }
        const sc = simRatio(nfa, q);
        if (sc > bestScore) { bestScore = sc; bestFa = en; }
      }
      if (bestFa && bestScore >= 0.72) phon = bestFa;
    }
    const target = phon ? normApp(phon) : q;
    let best = null, bestScore = 0;
    for (const a of sysApps.list) {
      const n = normApp(a.name);
      if (!n) continue;
      let score = 0;
      if (n === target) score = 1;
      else if ((n.includes(target) || target.includes(n)) && Math.min(n.length, target.length) >= 3) score = 0.9;
      else score = simRatio(n, target) * 0.82;
      /* امتیاز تطبیق مستقیم گفتار (بدون دیکشنری) — برای نام‌های انگلیسی که همان‌طور گفته می‌شوند */
      const sq = n === q ? 1 : ((n.includes(q) || q.includes(n)) && q.length >= 3 ? 0.88 : simRatio(n, q) * 0.78);
      score = Math.max(score, sq);
      if (score > bestScore) { bestScore = score; best = a; }
    }
    return bestScore >= 0.62 && best ? { app: best, score: bestScore } : null;
  }

  /* نیت «باز کن» بود؟ برنامه پیدا شد؟ اجرا کن — وگرنه null (AI پاسخ می‌دهد) */
  /* ============================================================
     افزونهٔ کنترل دیسکورد (v0.16) — فرمان‌های صوتی:
     «به علی زنگ بزن / در دیسکورد تماس بگیر»، «تماس رو قطع کن»،
     «دیسکورد رو میوت کن»، «صدای دیسکورد رو قطع کن»، «جواب تماس»، «رد کن»
     ============================================================ */
  async function tryDiscordCmd(raw) {
    if (settings.extDiscord === false) return null;
    if (!bridge || !bridge.discord) return null;
    const t0 = String(raw || '')
      .replace(/(لطفا|لطفاً)/g, '')
      .replace(/[\u200C]/g, ' ')
      .trim();
    const en = /\b(discord)\b/i.test(t0) || /\bcall\b/i.test(t0);
    const fa = /دیسکورد|دیسبورد|دیسکوردُ/.test(t0);
    const ctx = discordCtx();
    /* v0.30 — وضعیت واقعی میکروفون/صدای دیسکورد — خواندن بدون هیچ کلیکی:
       «وضعیت میکروفون دیسکورد چیه» / «صدای دیسکورد چطوره» / «میکروفون دیسکورد قطعه؟» */
    if ((fa || en) && /((وضعیت|چه\s*وضعی|چطوره|چیه)\s*[^.]{0,10}(میکروفون|صدای?\s*دیسکورد|دی\s?فن|میوت))|((میکروفون|صدای?)\s*دیسکورد\s*[^.]{0,10}(وضعیت|چطوره|چیه|روشنه|قطعه|وصله|خاموشه))|((میکروفون|دیفن|دی\s?فن|میوت)\s*[^.]{0,14}وضعیت)|((state|status)\b[^.]{0,12}(mic\b|sound|deafen|discord))/i.test(t0)) {
      const r = await bridge.discord.cmd({ action: 'state', ...ctx }).catch(() => null);
      if (!(r && r.ok)) return (r && r.error) || t('disc.stateFail');
      const s = String(r.result || '');
      const mic = /:MUTED/.test(s) ? t('disc.stateMuted') : t('disc.stateOn');
      const snd = /:DEAF/.test(s) ? t('disc.stateDeaf') : t('disc.stateSound');
      return mic + ' — ' + snd;
    }
    /* قطع تماس — «تماس/زنگ/کال» + قطع/ببند/کات */
    if (/(تماس|زنگ|کال|کال)[^.]{0,14}(قطع|ببند|کات|تموم)/.test(t0) || /(قطع|ببند)[^.]{0,8}(تماس|زنگ|کال)/.test(t0)) {
      if (!fa && !en) return null;
      const r = await bridge.discord.cmd({ action: 'hangup', ...ctx }).catch(() => null);
      return r && r.ok ? t('disc.hangup') : ((r && r.error) || t('disc.fail'));
    }
    /* رد تماس */
    if (/(تماس|زنگ|کال)[^.]{0,10}رد/.test(t0) || /رد[^.]{0,6}(تماس|زنگ|کال)/.test(t0)) {
      if (!fa && !en) return null;
      const r = await bridge.discord.cmd({ action: 'decline', ...ctx }).catch(() => null);
      return r && r.ok ? t('disc.decline') : ((r && r.error) || t('disc.fail'));
    }
    /* جواب تماس */
    if (/(تماس|زنگ|کال)[^.]{0,10}(جواب|برار|برگردن)/.test(t0) || /جواب[^.]{0,8}(تماس|زنگ|کال)/.test(t0)) {
      if (!fa && !en) return null;
      const r = await bridge.discord.cmd({ action: 'answer', ...ctx }).catch(() => null);
      return r && r.ok ? t('disc.answer') : ((r && r.error) || t('disc.fail'));
    }
    /* v0.35 — قطع/وصل «کلاً» هم‌زمان میکروفون + صدا:
       «دیسکورد رو کلا ساکت کن» / «میکروفون و صدات رو کلا قطع کن» → mute+deafen
       «کلا برگردون» / «کلا وصل کن» → unmute+undeafen — هر دو عمل تایید فلِیپ دارند
       و اگر نیمی شکست خورد، صادقانه همان خطا نمایش داده می‌شود */
    if (fa || en) {
      const offCombo = /(کلا|تماما|به\s*طور\s?کامل|all)[^.]{0,10}(بی\s?صدا|ساکت|قطع|دی\s?فن|میوت|mute|deafen)/i.test(t0) || /(بی\s?صدا|ساکت|دی\s?فن|میوت)[^.]{0,8}(کلا|تماما)/.test(t0);
      const onCombo = /(کلا|تماما|همه[^.]{0,4}رو|all)[^.]{0,10}(برگردون|برگردان|وصل|روشن|unmute|undeafen)/i.test(t0) || /(برگردون|وصل)[^.]{0,8}(کلا|همه)/.test(t0);
      const dcWord = /دیسکورد|دیسبورد|discord|میکروفون|دیفن|میوت/i.test(t0);
      if ((offCombo || onCombo) && dcWord) {
        const r1 = await bridge.discord.cmd({ action: offCombo ? 'mute' : 'unmute', ...ctx }).catch(() => null);
        const r2 = await bridge.discord.cmd({ action: offCombo ? 'deafen' : 'undeafen', ...ctx }).catch(() => null);
        if (!(r1 && r1.ok)) return (r1 && r1.error) || t('disc.fail');
        if (!(r2 && r2.ok)) return (r2 && r2.error) || t('disc.fail');
        return offCombo ? t('disc.comboOff') : t('disc.comboOn');
      }
    }
    /* بی‌صدای کل (deafen) — v0.28: «دیفن» هم پذیرفته می‌شود
       «صدای دیسکورد رو قطع/کرافت کن» / «دیسکورد رو دیفن کن» / «deafen» */
    if (/(دیفن|دی\s?فن|کرافت|deafen)/i.test(t0) || (/صدای?[^.]{0,8}(دیسکورد|discord)/.test(t0) && /(قطع|بیصدا|بی صدا|وصل|روشن)/.test(t0))) {
      const r = await bridge.discord.cmd({ action: 'deafen', ...ctx }).catch(() => null);
      if (r && r.ok && /-ALREADY/.test(String(r.result || ''))) return t('disc.alreadyDeaf');
      return r && r.ok ? t('disc.deafened') : ((r && r.error) || t('disc.fail'));
    }
    /* میوت میکروفون — «دیسکورد رو میوت کن» / «میکروفون دیسکورد قطع/وصل»
       v0.28: «ان‌میوت» هم همان کلیدِ تاگل است */
    if (fa || en) {
      if (/(میوت|مایوت|بیصدا|بی صدا|(ا|آ)ن\s?میوت)/.test(t0) || (/میکروفون/.test(t0) && /(قطع|وصل)/.test(t0)) || /وصل[^.]{0,6}(میکروفون|میوت)/.test(t0)) {
        /* v0.29 — «ان‌میوت کن» / «میکروفون رو وصل کن» → unmute واقعی (نه تاگل کورکورانه)؛
           نتیجهٔ UIA هم صادقانه: ALREADY = از قبل در همان وضعیت بود */
        /* v0.29.1 — «آن میوت» با «آ» (مجهری) هم قبول شود — کاربر می‌گوید «آن میوت کن»
           و قبلاً به mute (عکسِ خواسته) نقشه‌برداری می‌شد */
        const unmute = /(ا|آ)ن\s?میوت|وصل|روشن/.test(t0) && !/(بیصدا|بی\s?صدا|قطع)/.test(t0);
        const r = await bridge.discord.cmd({ action: unmute ? 'unmute' : 'mute', ...ctx }).catch(() => null);
        if (r && r.ok && /-ALREADY/.test(String(r.result || ''))) return unmute ? t('disc.alreadyOn') : t('disc.alreadyMuted');
        return r && r.ok ? (unmute ? t('disc.unmuted') : t('disc.muted')) : ((r && r.error) || t('disc.fail'));
      }
    }
    /* v0.35 — فرمان جدید پیام خصوصی: «به علی پیام بده که فردا میام» /
       «در دیسکورد به علی بگو سلام» / «پیام بده به علی: دیشب گل دیدیم؟»
       — قبل از قاعدهٔ تماس می‌آید تا «پیام بده» هرگز «زنگ بزن» تفسیر نشود */
    if (/(پیام|پیغام)\s*(بده|کن|بفرست)|\b(dm|message)\b/i.test(t0) || /به\s+\S[^.]{1,28}?\s+بگو\s+\S/.test(t0)) {
      let nm = null, tx = null;
      const pats = [
        /(?:به|برای)\s+(.+?)\s*(?:پیام|پیغام)\s*(?:بده|کن|بفرست)(?:\s*(?:که|:|،|,)\s*(.+))?$/,
        /(?:پیام|پیغام)\s*(?:بده|کن|بفرست)\s*(?:به|برای)\s+(.+?)(?:\s+(?:که|:|،|,)\s*(.+))?$/,
        /(?:به|برای)\s+(.+?)\s+بگو\s+(.+)$/,
        /\b(?:message|dm)\s+([A-Za-z0-9_\-. ]{2,28})(?:\s+(?:saying|that|:)\s+(.+))?$/i,
      ];
      for (const re of pats) { const m = re.exec(t0); if (m && m[1]) { nm = m[1]; tx = m[2] || ''; break; } }
      if (nm) {
        nm = nm.replace(/(توی|در|با|و|رو|را|برام|برای|دیسکورد)\s*$/g, '').replace(/["«»]/g, '').trim();
        const bad = /^(من|خودم|تو|ما|مارو|این|اون|بگو|که)$/i.test(nm) || /(ساعت|هوا|قیمت|شرعی|یادداشت|آهنگ|موزیک|چنده|چند$)/.test(nm);
        if (bad || !nm) return null; /* اسم مخاطب نیست — برو سر قواعد دیگر */
        if (!tx) return t('disc.msgNeedText', { x: nm });
        const ct = resolveDiscordContact(nm);
        const r = await bridge.discord.cmd({ action: 'msgsend', name: ct ? ct.name : nm, text: tx, ...ctx }).catch(() => null);
        if (r && r.ok) {
          actLog('discord msgsend -> ' + String(r.result || '').slice(0, 40));
          return /UNVERIFIED/.test(String(r.result || '')) ? t('disc.msgSentUnver', { x: ct ? ct.name : nm }) : t('disc.msgSent', { x: ct ? ct.name : nm });
        }
        return (r && r.error) || t('disc.fail');
      }
    }
    /* تماس با نام: «به علی زنگ بزن» / «در دیسکورد به علی تماس بگیر» / «کال کن علی»
       v0.17 — اول مخاطبین ذخیره‌شده (اسم ساده → آی‌دی) تطبیق می‌شوند؛
       اگر مخاطب پیدا شد تماس با دیپ‌لینک مستقیم انجام می‌شود */
    const callRe = [/(?:در\s*)?(?:دیسکورد|discord)[^.]{0,10}?(?:به|برای)\s+(.+?)\s*(?:زنگ\s*بزن|تماس\s*بگیر|کال\s*کن)/, /(?:به|برای)\s+(.+?)\s*(?:زنگ\s*بزن|تماس\s*بگیر|کال\s*کن)/, /(?:زنگ\s*بزن|تماس\s*بگیر|کال\s*کن)\s*(?:به|برای)?\s+(.+)/, /(?:call|ring)\s+(?:up\s+)?(.+)/i];
    if (/(زنگ\s*بزن|تماس\s*بگیر|کال\s*کن|\bcall\b)/.test(t0)) {
      let nm = null;
      for (const re of callRe) { const m = re.exec(t0); if (m && m[1]) { nm = m[1]; break; } }
      if (nm || fa || en) {
        nm = (nm || '').replace(/(توی|در|با|و|رو|را|برام|برای)\s*$/g, '').replace(/["«»]/g, '').trim();
        const ct = resolveDiscordContact(nm);
        const r = await bridge.discord.cmd({ action: 'call', name: ct ? ct.name : nm, userId: ct ? ct.userId : '', ...ctx }).catch(() => null);
        if (r && r.ok) return t('disc.calling', { x: ct ? ct.name : (nm || '…') });
        return (r && r.error) || t('disc.fail');
      }
    }
    return null;
  }

  async function tryAppOpen(cmd) {
    if (!APP_OPEN_RE.test(cmd)) return null;
    /* v0.47 — B16: «بازی X رو تو استیم باز کن» — قبلاً فقط خود Steam باز می‌شد و
       بازی جا می‌ماند؛ جستجوی فروشگاه Steam برای بازیِ خواسته‌شده باز می‌شود */
    const steamGameM = String(cmd || '').match(/بازی\s+([^\s][^.]{2,40}?)\s+(رو|را)?\s*(تو|توی|در)?\s*(استیم|steam)\s*(رو\s*)?(باز|اجرا|run|open)/i);
    if (steamGameM && steamGameM[1] && /استیم|steam/i.test(String(cmd))) {
      const game = steamGameM[1].replace(/\s*(رو|را)\s*$/,'').trim();
      if (game.length >= 2) {
        if (!bridge || !bridge.system) return null;
        const url = 'https://store.steampowered.com/search/?term=' + encodeURIComponent(game);
        const r = await bridge.system.run('web_open', url).catch(() => null);
        if (r && r.ok) return LANG === 'en' ? `Steam store search opened for "${game}".` : `جستجوی «${game}» در فروشگاه استیم باز شد — از آنجا نصب/اجرا کن.`;
        return LANG === 'en' ? 'Could not open Steam store.' : 'فروشگاه استیم باز نشد.';
      }
    }
    const name = extractAppName(cmd);
    if (!name) return null;
    if (!bridge || !bridge.apps) return LANG === 'en' ? 'Opening apps only works inside the Windows app.' : 'باز کردن برنامه‌ها فقط داخل نرم‌افزار ویندوزی کار می‌کند.';
    await ensureAppsList();
    if (!sysApps.list.length) {
      statusText.textContent = t('app.scanning');
      await ensureAppsList(true).catch(() => { /* noop */ });
    }
    const hit = matchSysApp(name);
    if (!hit) {
      return t('app.notFound', { x: name });
    }
    const r = await bridge.apps.launch({ name: hit.app.name, exe: hit.app.exe }).catch(() => null);
    if (r && r.ok) return t('app.open', { x: hit.app.name });
    return (r && r.error) || t('app.launchFail', { x: hit.app.name });
  }

  /* ============================================================
     یادآوری‌های صوتی (v0.12) — معادل reminders.py
     «یادآوری کن ساعت ۵ عصر چای درست کنم» / «۲۰ دقیقه دیگه یادم بنداز
     آهنگ رو ببینم» — تبدیل حروف فارسی به رقم + پارس ساعت + تیک
     پس‌زمینه در پروسه اصلی که به‌محض رسیدن وقت، آوا بلند خبر می‌دهد.
     ============================================================ */
  function faWordNum(str) {
    const t = faToEn(String(str || '').toLowerCase());
    let total = 0, cur = 0, found = false;
    for (const w of t.split(/[\s\u200Cو]+/)) {
      if (!w) continue;
      if (Object.prototype.hasOwnProperty.call(FA_WORD_NUM, w)) {
        found = true;
        const v = FA_WORD_NUM[w];
        if (v >= 100) { total += cur + v; cur = 0; } else cur += v;
      } else if (/^\d+$/.test(w)) { found = true; cur = cur * Math.pow(10, w.length) + Number(w); }
    }
    return found ? total + cur : null;
  }

  function fmtClock(ts) {
    const d = new Date(ts);
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const pm = h >= 12;
    h = h % 12 || 12;
    return LANG === 'en'
      ? `${h}:${m} ${pm ? 'PM' : 'AM'}`
      : `${faNum(h)}:${faNum(m)} ${pm ? 'بعدازظهر' : 'صبح'}`;
  }

  /* پارس یادآوری: خروجی {at, text} یا null — اول ساعت مطلق، بعد مدت */
  function parseReminder(c, opts) {
    const txt = String(c || '').replace(/(لطفا|لطفاً)/g, '');
    const now = new Date();

    /* متن یادآوری = جمله بدون الگوهای زمان و فرمان‌ها */
    const stripTime = (s) => s
      .replace(/(یادآوری\s*(کن|بده)?|یادم\s*بنداز|یادت\s*بنداز|یادآور|آلارم\s*(بذار|بزن|بگذار)?|بیدارم\s*کن|remind\s*me( to)?|reminder)/gi, ' ')
      .replace(/(در\s*)?(ساعت)\s*[^\s،.!؟؟]*/gi, ' ')
      .replace(/(و\s*)?(نیم|ربع)\s*(دیگه|دیگر|بعد)?/gi, ' ')
      .replace(/(\d+|[ا-ی\u200C\s]{2,22}?)\s*(ساعت|دقیقه|ثانیه)\s*(دیگه|دیگر|بعد)?/gi, ' ')
      .replace(/(دیگه|دیگر|بعدا|بعداً|بعد|later)/gi, ' ')
      .replace(/(که|بگو|بگه|به\s*من|منو|من\s*را|رو|را|برام|برای\s*من)\s*/gi, ' ')
      .replace(/[\s\u200C]+/g, ' ')
      .replace(/^[،.!؟?\s]+|[،.!؟?\s]+$/g, '')
      .trim();

    /* ۱) ساعت مطلق: «ساعت ۵ عصر» / «ساعت هشت و نیم صبح» / «ساعت ۲۲» / «ساعت ۱۰ و ربع»
       فاصله زمانی دقیق مچ می‌شود تا متن یادآوری همراهش پاک نشود */
    const abs = txt.match(/ساعت\s+(?:[\d۰-۹]+|[ا-ی\u200C]+)(?:\s*و\s*(?:نیم|ربع|[\d۰-۹]+\s*دقیقه|[ا-ی\u200C]+\s*دقیقه))?(?:\s*(?:صبح|ظهر|عصر|شب))?/i);
    if (abs) {
      const seg = abs[0].replace(/^\s*ساعت\s+/i, '');
      const numM = seg.match(/[\d۰-۹]+|[ا-ی\u200C]+/);
      let h = numM ? (/^\d/.test(numM[0]) ? Number(faToEn(numM[0])) : faWordNum(numM[0])) : null;
      if (h !== null && h >= 0 && h <= 23) {
        let min = 0;
        if (/نیم/i.test(seg)) min = 30;
        else if (/ربع/i.test(seg)) min = 15;
        else {
          const mq = seg.match(/[و,،]\s*(\d+|[ا-ی\u200C\s]{2,12})\s*دقیقه/i);
          if (mq) min = faWordNum(mq[1]) || Number(faToEn(mq[1]).replace(/\D/g, '')) || 0;
        }
        const mer = /عصر|شب/i.test(seg) ? 'pm' : /صبح/i.test(seg) ? 'am' : /ظهر/i.test(seg) ? 'noon' : null;
        let hour = h;
        if (mer === 'pm' && hour < 12) hour += 12;
        else if (mer === 'noon' && hour < 12) hour += 12; /* v0.60 (A5) — «۲ ظهر»→۱۴:۰۰ و «۱۲ ظهر»→۱۲:۰۰ (قبلاً ۲ ظهر = ۲ بامداد فردا می‌شد) */
        else if (!mer && hour <= 12) {
          /* بدون صبح/عصر: نزدیک‌ترین زمان آینده (۵ را هم ۵ صبح می‌گیریم هم ۵ عصر) */
          const cand = [hour, (hour % 12) + 12, hour + 12];
          let bestDt = null;
          for (const hh of new Set(cand)) {
            if (hh > 23) continue;
            const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, min, 0, 0);
            if (dt <= now) dt.setDate(dt.getDate() + 1);
            if (!bestDt || dt < bestDt) bestDt = dt;
          }
          if (bestDt) {
            const text = stripTime(txt.replace(abs[0], ' ')) || 'یادآوری';
            return { at: bestDt.getTime(), text };
          }
        }
        if (hour <= 23) {
          const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, min, 0, 0);
          if (dt <= now) dt.setDate(dt.getDate() + 1);
          const text = stripTime(txt.replace(abs[0], ' ')) || 'یادآوری';
          return { at: dt.getTime(), text };
        }
      }
    }

    /* ۲) مدت: «۲۰ دقیقه دیگه» / «یک ساعت و نیم بعد» / «نیم ساعت دیگه»
       v0.47 — B01: قید نسبیت («دیگه/بعد») دیگر الزامی نیست — مقدارِ AI مثل
       «5 دقیقه» (لاگ: reminder_add(5 دقیقه) هرگز شلیک نشد) و جمله‌های درخواستی
       بدون «دیگه» («برای ۵ دقیقه منو بیدار کن») هم یادآوری می‌شوند؛
       بدون قیدِ نسبیت فقط با نشانهٔ درخواست/allowBare (مقدار AI) پذیرفته می‌شود */
    const half = /نیم\s*ساعت/.test(txt);
    const dur = txt.match(/([\d۰-۹]+|[ا-ی\u200C\s]{2,20}?)\s*(ثانیه|دقیقه|ساعت)(?:\s*و\s*(نیم|ربع))?(\s*(دیگه|دیگر|بعد))?/i);
    if (dur) {
      const rel = !!(dur[5]);
      const requestish = rel || /(بیدار|یادآوری|یادم|یادت|آلارم|تایمر|بذار|بگذار|بزن|remind|timer)/i.test(txt) || !!(opts && opts.allowBare);
      const past = /پیش|قبل از/.test(txt);
      if (requestish && !past) {
      let n = faWordNum(dur[1]);
      if (n === null) { const m2 = faToEn(dur[1]).match(/\d+/); n = m2 ? Number(m2[0]) : null; }
      if (n === null) n = half ? 30 : null;
      if (n !== null) {
        let ms = 0;
        if (/ثانیه/.test(dur[2])) ms = n * 1000;
        else if (/دقیقه/.test(dur[2])) ms = n * 60000;
        else ms = n * 3600000;
        /* جزء «و نیم/و ربع»: یک ساعت و نیم = ۹۰ دقیقه، یک دقیقه و نیم = ۹۰ ثانیه */
        if (dur[3] === 'نیم') ms += (/دقیقه/.test(dur[2]) ? 30000 : 1800000);
        else if (dur[3] === 'ربع') ms += (/دقیقه/.test(dur[2]) ? 15000 : 900000);
        if (half) ms = 30 * 60000;
        ms = Math.max(5000, Math.min(ms, 30 * 24 * 3600000));
        const text = stripTime(txt) || 'یادآوری';
        return { at: Date.now() + ms, text };
      }
      }
    }
    if (half && /(دیگ|دیگر|بعد)/.test(txt)) {
      const text = stripTime(txt) || 'یادآوری';
      return { at: Date.now() + 30 * 60000, text };
    }
    return null;
  }

  async function reminderReply(c, opts) {
    const parsed = parseReminder(c, opts);
    if (!parsed) {
      /* زمان نفهمیدیم — اگر مدت داشت مثل تایمر رفتار کن */
      if (/ثانیه|دقیقه|ساعت|timer/i.test(c)) return startTimer(c);
      return t('rem.noTime');
    }
    if (!bridge || !bridge.reminders) {
      /* پیش‌نمایش مرورگر — مثل تایمر محلی (v0.38.1: مدت واقعی، نه حدس) */
      return startTimer(c, Math.max(5000, parsed.at - Date.now()));
    }
    const r = await bridge.reminders.add({ text: parsed.text, at: parsed.at }).catch(() => null);
    if (r && r.ok) { try { renderRemList(); } catch (_) { /* noop */ } return t('rem.set', { x: parsed.text, y: fmtClock(parsed.at) }); }
    return (r && r.error) || t('rem.fail');
  }

  /* ---------- v0.38.1 — فهرست یادآوری‌ها در تنظیمات › برنامه ----------
     قبلاً یادآوری فقط با صدا ثبت می‌شد ولی هیچ UI‌ای فهرست/حذفش را نداشت
     (bridge.reminders.list/remove/clean بلااستفاده بودند) */
  async function renderRemList() {
    const remList = $('#remList');
    if (!remList || !bridge || !bridge.reminders || !bridge.reminders.list) return;
    try {
      const r = await bridge.reminders.list();
      const items = ((r && r.reminders) || []).slice().sort((a, b) => a.at - b.at);
      remList.innerHTML = '';
      if (!items.length) {
        remList.innerHTML = '<div class="dc-empty"></div>';
        remList.firstChild.textContent = t('rem.uiEmpty');
        return;
      }
      const fmt = new Intl.DateTimeFormat(LANG === 'en' ? 'en-US' : 'fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      items.forEach((rem) => {
        const row = document.createElement('div');
        row.className = 'dc-contact';
        row.innerHTML = `
          <div class="dc-ct-info"><b></b><span class="num" dir="ltr"></span></div>
          <div class="dc-ct-actions">
            <button type="button" class="chip sm danger dc-del"><svg class="ic"><use href="#i-close"/></svg></button>
          </div>`;
        row.querySelector('.dc-ct-info b').textContent = rem.text || '—';
        row.querySelector('.dc-ct-info span').textContent = fmt.format(new Date(rem.at));
        row.querySelector('.dc-del').addEventListener('click', async () => {
          try { await bridge.reminders.remove(rem.id); } catch (_) { /* noop */ }
          renderRemList();
        });
        remList.appendChild(row);
      });
    } catch (_) { /* noop */ }
  }
  const btnRemClear = $('#btnRemClear');
  if (btnRemClear) btnRemClear.addEventListener('click', async () => {
    if (bridge && bridge.reminders && bridge.reminders.clear) {
      try { await bridge.reminders.clear(); } catch (_) { /* noop */ }
      renderRemList();
      toast(t('rem.uiEmpty'), '#i-trash');
    }
  });

  /* ============================================================
     v0.47 — UI یادگیری‌ها: فهرست «چیزهایی که آوا یاد گرفته» + فراموشی
     ============================================================ */
  async function renderLearnList() {
    const list = $('#learnList');
    if (!list) return;
    try {
      const items = (learnStore && Array.isArray(learnStore.items)) ? learnStore.items.slice() : [];
      items.sort((a, b) => (b.at || 0) - (a.at || 0));
      list.innerHTML = '';
      if (!items.length) {
        const e = document.createElement('div');
        e.className = 'dc-empty';
        e.textContent = t('learn.uiEmpty');
        list.appendChild(e);
        return;
      }
      const Le = (typeof AVALearn !== 'undefined') ? AVALearn : null;
      for (const it of items.slice(0, 30)) {
        const row = document.createElement('div');
        row.className = 'dc-contact'; /* v0.60 — کلاس قبلی هیچ قانون CSS نداشت؛ همان کارتِ یادآوری‌ها/مخاطبین */
        const stTxt = it.unstable
          ? t('learn.uiUnstable')
          : ((it.used ? t('learn.uiUsed', { n: faNum(it.used) }) : (Le ? Le.summary(it.acts) : '')) || Le.summary(it.acts));
        row.innerHTML = `
          <div class="dc-ct-info"><b></b><span></span></div>
          <div class="dc-ct-actions">
            <button type="button" class="chip sm danger dc-del"><svg class="ic"><use href="#i-close"/></svg></button>
          </div>`;
        row.querySelector('.dc-ct-info b').textContent = '«' + it.k + '»';
        row.querySelector('.dc-ct-info span').textContent = stTxt;
        row.querySelector('.dc-del').addEventListener('click', async () => {
          try {
            const Le2 = (typeof AVALearn !== 'undefined') ? AVALearn : null;
            if (Le2) { Le2.dropKey(learnStore, it.k); await saveLearnStore(); renderLearnList(); }
          } catch (_) { /* noop */ }
        });
        list.appendChild(row);
      }
    } catch (_) { /* noop */ }
  }
  const btnLearnClear = $('#btnLearnClear');
  if (btnLearnClear) btnLearnClear.addEventListener('click', async () => {
    try {
      learnStore = { v: 1, items: [] };
      await saveLearnStore();
      renderLearnList();
      toast(t('learn.uiEmpty'), '#i-trash');
    } catch (_) { /* noop */ }
  });


  /* اجرای فرمان‌های پاور — خاموش/ریستارت از قبل در resolveReply تأیید گرفته‌اند */
  async function runPower(id) {
    if (!canRun) return t('toast.onlyApp');
    const res = await bridge.system.run(id).catch(() => ({ ok: false }));
    if (res && res.ok) {
      if (id === 'sys_sleep') return t('pow.sleepDone');
      if (id === 'sys_shutdown') return t('pow.shutdownSoon');
      if (id === 'sys_restart') return t('pow.restartSoon');
      if (id === 'shutdown_abort') return t('pow.abortDone');
      if (id === 'monitor_off') return t('pow.monitorOff');
    }
    if (id === 'shutdown_abort') return t('pow.abortNothing');
    return (res && res.error) || t('toast.onlyApp');
  }

  let lastCpu = 12, lastRam = 46;

  /* ---------- تایمر واقعی ----------
     v0.42 — «چندتایمری»: هر تایمر در TIMERS می‌نشیند (کاربر: «میخوام بدونه
     چند تا تایمر داره… آیا فعاله؟») — نزدیک‌ترین تایمر زنگ می‌خورد و بقیه
     سر جایشان می‌مانند. وضعیت با «چند تا تایمر دارم؟» محلی و آنی جواب می‌گیرد. */
  let timerId = null;
  let TIMERS = []; /* {id, endsAt, label, unit} */
  let timerSeq = 0;
  function beep() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ac = new AC();
      if (ac.state === 'suspended') { try { ac.resume(); } catch (_) { /* noop */ } }
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.001, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, ac.currentTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.9);
      o.start(); o.stop(ac.currentTime + 1);
    } catch (_) { /* noop */ }
  }
  function fmtRemaining(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return faNum(s) + ' ثانیه';
    const m = Math.floor(s / 60);
    if (m < 60) return faNum(m) + ' دقیقه';
    return faNum(Math.round(m / 60)) + ' ساعت';
  }
  function armNextTimer() {
    if (timerId) { clearTimeout(timerId); timerId = null; }
    if (!TIMERS.length) return;
    TIMERS.sort((a, b) => a.endsAt - b.endsAt);
    const next = TIMERS[0];
    timerId = setTimeout(() => fireTimer(next.id), Math.max(0, next.endsAt - Date.now()));
  }
  function fireTimer(id) {
    const idx = TIMERS.findIndex((x) => x.id === id);
    const tm = idx >= 0 ? TIMERS[idx] : null;
    if (idx >= 0) TIMERS.splice(idx, 1);
    armNextTimer();
    /* v0.47 — B01: شلیک تایمر در لاگ می‌آید (قبلاً بی‌لاگ بود و قابل دیباگ نبود)
       + رونوشت پایدارِ تایمر از فهرست یادآوری‌ها حذف می‌شود */
    actLog('timer fired: ' + (tm ? (tm.label + ' ' + tm.unit) : '?'));
    if (tm && tm.persistId && bridge && bridge.reminders && bridge.reminders.remove) {
      bridge.reminders.remove(tm.persistId).then(() => { try { renderRemList(); } catch (_) { /* noop */ } }).catch(() => { /* noop */ });
    }
    beep();
    const doneMsg = t('timer.done') + (tm ? ` (${tm.label} ${tm.unit})` : '');
    toast(doneMsg, '#i-timer');
    setState('success');
    statusText.textContent = doneMsg;
    rcTag.textContent = t('timer.doneTag');
    rcHeard.textContent = t('timer.doneTag');
    rcReply.textContent = t('timer.doneReply');
    respCard.classList.add('show');
    speak(doneMsg);
    setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 4000);
  }
  /* v0.47 — B01: رونوشت پایدار تایمر در فهرست یادآوری‌ها (kind=timer)
     — بعد از reload/crash با rearmPersistedTimers دوباره مسلح می‌شود */
  function persistTimerCopy(tm) {
    try {
      if (!tm || !bridge || !bridge.reminders || !bridge.reminders.add) return;
      if (tm.endsAt <= Date.now() + 3500) return; /* خیلی کوتاه — ارزش persist ندارد */
      bridge.reminders.add({ text: (tm.label + ' ' + (tm.unit || '')).trim(), at: tm.endsAt, kind: 'timer', label: tm.label, unit: tm.unit })
        .then((r) => {
          if (r && r.ok && r.reminder) { tm.persistId = r.reminder.id; try { renderRemList(); } catch (_) { /* noop */ } }
        }).catch(() => { /* noop */ });
    } catch (_) { /* noop */ }
  }
  async function rearmPersistedTimers() {
    try {
      if (!bridge || !bridge.reminders || !bridge.reminders.list) return;
      const r = await bridge.reminders.list();
      const items = ((((r && r.reminders) || []))).filter((x) => x.kind === 'timer' && x.at > Date.now() + 2000);
      let added = 0;
      for (const it of items) {
        if (TIMERS.some((tm) => tm.persistId === it.id)) continue;
        TIMERS.push({ id: ++timerSeq, endsAt: it.at, label: it.label || it.text || 'تایمر', unit: it.unit || t('timer.min'), persistId: it.id });
        added++;
      }
      if (added) { armNextTimer(); actLog('timers re-armed after boot/reload: ' + added); }
    } catch (_) { /* noop */ }
  }
  function startTimer(c, msOverride) {
    const txt = faToEn(c);
    /* v0.38.1 — «تایمر ۲ ساعت» واقعاً ۲ ساعت بود نه ۲ دقیقه؛ ترکیبی هم پشتیبانی
       می‌شود: «۱ ساعت و ۳۰ دقیقه» = ۹۰ دقیقه. عددِ چسبیده به هر واحد ملاک است. */
    const unitPairs = [...txt.matchAll(/(\d+(?:\.\d+)?)\s*(ساعت|دقیقه|ثانیه|hours?|hrs?|minutes?|mins?|seconds?|secs?)/gi)];
    let mins = 0;
    let firstUnit = '';
    for (const p of unitPairs) {
      const n = parseFloat(p[1]);
      if (!Number.isFinite(n)) continue;
      const u = p[2].toLowerCase();
      if (/ساعت|hour|hr/.test(u)) { mins += n * 60; if (!firstUnit) firstUnit = 'h'; }
      else if (/ثانیه|sec/.test(u)) { mins += n / 60; if (!firstUnit) firstUnit = 's'; }
      else { mins += n; if (!firstUnit) firstUnit = 'm'; }
    }
    if (!mins && /نیم\s*ساعت/.test(txt)) { mins = 30; firstUnit = 'm'; }
    if (!mins) {
      const m = txt.match(/(\d+(?:\.\d+)?)/);
      mins = m ? parseFloat(m[1]) : 5; /* بدون واحد: دقیقه پیش‌فرض */
      if (/ثانیه|second/i.test(c) && !/دقیقه|minute/i.test(c)) { mins = mins / 60; firstUnit = 's'; }
    }
    /* پیش‌نمایش مرورگر: یادآوریِ زمان‌دار دقیق به‌جای حدسِ عدد اول (v0.38.1) */
    if (Number.isFinite(msOverride) && msOverride > 0) mins = msOverride / 60000;
    mins = Math.max(0.05, Math.min(600, mins));
    /* برچسب: ثانیه → ثانیه، ساعت خالص → ساعت، بقیه → دقیقه */
    let unit = t('timer.min');
    let label = faNum(+(mins.toFixed(1)));
    if (firstUnit === 's') { unit = t('timer.sec'); label = faNum(Math.round(mins * 60)); }
    else if (firstUnit === 'h' && Number.isInteger(mins / 60) && mins / 60 < 24) { unit = t('timer.hour'); label = faNum(mins / 60); }
    TIMERS.push({ id: ++timerSeq, endsAt: Date.now() + mins * 60000, label, unit });
    /* v0.47 — B01: تایمر دیگر فقط درون‌حافظه‌ایِ رندرر نیست (با reload/crash می‌مُرد —
       ریشهٔ دوم «یادآوریام کجا رفت») — رونوشت پایدار در ava-reminders.json */
    const newTm = TIMERS[TIMERS.length - 1];
    persistTimerCopy(newTm);
    armNextTimer();
    actLog('timer set: ' + label + ' ' + unit);
    const base = t('timer.on', { x: label, y: unit });
    /* v0.42 — کاربر بداند چند تایمر فعال دارد (چندتایمری جدید) */
    return TIMERS.length > 1
      ? base + ' ' + t('timer.multi', { n: faNum(TIMERS.length) })
      : base;
  }
  /* v0.42 — «چند تا تایمر دارم؟» / «تایمر فعاله؟» — جواب محلیِ آنی، بدون شبکه */
  async function timersReportReply() {
    const lines = TIMERS.slice(0, 6).map((tm) => `${tm.label} ${tm.unit} — ${fmtRemaining(tm.endsAt - Date.now())} مونده`);
    let remCount = 0, nextRem = null;
    try {
      if (bridge && bridge.reminders && bridge.reminders.list) {
        const r = await bridge.reminders.list();
        const items = (((r && r.reminders) || [])).slice().sort((a, b) => a.at - b.at);
        remCount = items.length;
        nextRem = items[0] || null;
      }
    } catch (_) { /* noop */ }
    if (!TIMERS.length && !remCount) return LANG === 'en' ? 'No timers are running right now — say "10 minute timer".' : 'الان هیچ تایمری فعاله نیست — بگو مثلاً: «تایمر ۱۰ دقیقه».';
    let out = TIMERS.length
      ? (LANG === 'en' ? `${TIMERS.length} timer(s) running: ` : `${faNum(TIMERS.length)} تایمر فعال داری: `) + lines.join('، ')
      : (LANG === 'en' ? 'No local timers running.' : 'تایمر محلی فعالی نداری.');
    if (remCount) {
      out += (LANG === 'en' ? ` — ${remCount} reminder(s) saved` : ` — ${faNum(remCount)} یادآوری ثبت شده`)
        + (nextRem ? (LANG === 'en' ? `, next: ${nextRem.text} (${fmtClock(nextRem.at)})` : `، نزدیک‌ترین: «${nextRem.text}» (${fmtClock(nextRem.at)})`) : '');
    }
    return out;
  }
  /* v0.42 — «تایمر رو بردار/لغو کن» — همهٔ تایمرهای محلی */
  function cancelTimersReply() {
    if (!TIMERS.length) return LANG === 'en' ? 'There is no active timer to cancel.' : 'تایمری فعاله نیست که لغو کنم.';
    const n = TIMERS.length;
    TIMERS = [];
    armNextTimer();
    return LANG === 'en' ? `${n} timer(s) cancelled.` : `${faNum(n)} تایمر فعال لغو شد.`;
  }

  /* ---------- تایپ متن پاسخ ---------- */
  let typeTimer = null;
  function typeText(el, txt) {
    clearInterval(typeTimer);
    el.textContent = '';
    let i = 0;
    /* v0.19 — دو برابر سریع‌تر (۸ms و ۲ نویسه در هر تیک) — حس کندی حذف شود */
    typeTimer = setInterval(() => {
      i += 2;
      el.textContent = txt.slice(0, i);
      if (i >= txt.length) { el.textContent = txt; clearInterval(typeTimer); }
    }, 8);
  }

  /* ---------- اجرای فرمان ----------
     rule.confirm: فرمان‌های مخرب (خاموش/ریستارت) اول تأیید کاربر را می‌گیرند */
  async function resolveReply(rule, cmd) {
    if (rule.confirm) {
      const isShutdown = rule.confirm === 'shutdown';
      const okGo = await askConfirm({
        title: isShutdown ? t('pow.confirmShutdown') : t('pow.confirmRestart'),
        text: isShutdown ? t('pow.confirmShutdownText') : t('pow.confirmRestartText'),
      });
      if (!okGo) { rcTag.textContent = t('tag.reply'); return t('cf.cancelled'); }
    }
    let reply = await rule.r(cmd);
    if (!rule.run) { rcTag.textContent = rule.custom ? t('tag.custom') : t('tag.reply'); return reply; }
    if (!canRun) { rcTag.textContent = t('tag.demo'); return reply; }
    const runId = typeof rule.run === 'function' ? rule.run(cmd) : rule.run;
    const arg = rule.arg ? rule.arg(cmd) : undefined;
    try {
      const res = await bridge.system.run(runId, arg);
      if (res && res.ok) {
        rcTag.textContent = t('tag.done');
        if (runId === 'screenshot' && res.out) {
          reply = LANG === 'en' ? `Screenshot saved to: ${res.out}` : `اسکرین‌شات ذخیره شد در: ${res.out}`;
        }
      } else {
        rcTag.textContent = t('tag.fail');
        /* v0.45 — پاسخ صادق (بازنگری منطق پاسخ‌دهی): وقتی عمل واقعاً انجام نشد،
           آوا متنِ موفقیت را تکرار نمی‌کند (دروغ «باز شد» ممنوع) — نام همان
           کارِ ناموفق را می‌گوید تا کاربر بداند چه اتفاقی نیفتاد */
        reply = (LANG === 'en'
          ? `Couldn't do it: ${rule.t || 'the request'}${res && res.error ? ' — ' + String(res.error).slice(0, 80) : ''}.`
          : `«${rule.t || 'این درخواست'}» انجام نشد${res && res.error ? ' — ' + String(res.error).slice(0, 80) : ''}.`);
      }
    } catch (_) {
      rcTag.textContent = t('tag.fail');
      /* v0.45 — پاسخ صادق در خطای اجرا (دروغ «انجام شد» ممنوع) */
      reply = (LANG === 'en'
        ? `Couldn't do it: ${rule.t || 'the request'}.`
        : `«${rule.t || 'این درخواست'}» انجام نشد.`);
    }
    return reply;
  }

  /* cmdBusy: جلوگیری از اجرای دوباره فرمان در حین اجرای فرمان قبلی.
     توجه: state=processing بعد از تشخیص گفتار کاملاً طبیعی است و
     نباید فرمان را رد کند (باگ قدیمی که جواب‌های گوگل/GLM را ساکت دور می‌ریخت).
     v0.27.1 — قفل‌شدگی هرگز ابدی نیست: اگر >۴۵ ثانیه بماند (خطای در
     پرواز که رست نشده) خودکار رد می‌شود تا فرمان‌های بعدی ساکت دور ریخته نشوند
     (دومین ریشهٔ گزارش کاربر: «درخواست اجرا نمی‌شود»). */
  let cmdBusy = false;
  let cmdBusyAt = 0;
  /* v0.66 — حافظهٔ «آخرین لینک ویدیو» (جلسه‌ای): از لَین URL / کلیپ‌بورد / پخش
     موفق پر می‌شود و به «همین ویدیویی که یوتیوب دادم» جواب می‌دهد.
     ریشهٔ لاگ v0.65: کاربر لینک داد، بعد گفت «همین ویدیو توی کی‌ام‌پلیر» و
     هیچ حافظه‌ای از لینک نبود → video_play(youtube.com خالی). */
  let lastVideoUrl = '';
  /* v0.66 — نسل درخواست AI: با هر لغو/فرمان جدید جلو می‌رود؛ رانِ کهنه UI را دست نمی‌زند */
  let aiRunEpoch = 0;
  /* v0.66 — لغو درخواست در جریان (خواستهٔ کاربر: «کاربر بتونه کنسل کنه درخواستو»):
     هم پرچمِ محلی (رانِ کهنه ساکت می‌شود) هم IPC به main (fetch واقعی abort شود
     تا چرخش ۱۲مدلی و انتظار ۳۵ثانیه‌ای ادامه پیدا نکند) */
  async function aiCancelRun(reason) {
    aiRunEpoch += 1;
    try { if (bridge && bridge.ai && bridge.ai.cancel) await bridge.ai.cancel(); } catch (_) { /* noop */ }
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (_) { /* noop */ }
    try { stopGoogleSpeak(); } catch (_) { /* noop */ }
    try { actLog('ai run cancelled (' + (reason || 'user') + ')', 'ui', { ev: 'ai-cancel', reason: reason || 'user' }); } catch (_) { /* noop */ }
  }
  /* v0.47 — B18: نتیجهٔ هر dispatch در لاگ ثبت می‌شود تا activity.log قابل دیباگ باشد
     (قبلاً «utterance total 3ms» هیچ دلالتی بر اجرا نداشت و دیباگ جلسات قبل را فلج کرد) */
  let _dispatchOutcome = '';
  const cmdBusyGuard = () => {
    if (!cmdBusy) return false;
    if (Date.now() - cmdBusyAt < 45000) return true; /* واقعاً در جریان است */
    actLog('cmdBusy stuck >45s — force reset (would silently drop every next command)');
    cmdBusy = false;
    return false;
  };
  const cmdBusySet = () => { cmdBusy = true; cmdBusyAt = Date.now(); _dispatchOutcome = ''; };
  /* v0.47 — B02: تکرار فرمان در پنجرهٔ busy دیگر «بلعِ بی‌صدا» نیست — اعلان محدود */
  let cmdBusyHintAt = 0;
  function cmdBusyHint() {
    if (Date.now() - cmdBusyHintAt < 8000) return;
    cmdBusyHintAt = Date.now();
    try { toast(t('cmd.busy'), '#i-info'); } catch (_) { /* noop */ }
    try { statusText.textContent = t('cmd.busy'); } catch (_) { /* noop */ }
  };

  /* اجرای فرمان‌های DNS (با UAC واقعی) — هم از مسیر «دی ان اس …»
     و هم از مسیر «الکترو رو تنظیم کن» (اسم ذخیره‌شده کاربر)
     v0.42 — «پویا»: حتی اگر افزونهٔ DNS خاموش باشد، فرمان صوتی آن را همان
     لحظه روشن و دکمه‌اش را به ستون کنار می‌آورد (خواستهٔ کاربر: غیرفعال
     باشند ولی هر موقع کاربر خواست باز شوند) */
  async function runDnsCommand(raw) {
    if (settings.extDns === false) {
      settings.extDns = true;
      store.set('extDns', true);
      if (typeof applyExtensions === 'function') applyExtensions();
      toast(t('toast.extOn', { x: 'DNS Changer' }), '#i-shield');
      actLog('dns ext auto-enabled by voice command (dynamic extension)');
    }
    if (cmdBusyGuard()) return;
    cmdBusySet();
    setState('processing');
    statusText.textContent = t('dns.dnsWork');
    try {
      const reply = await dnsHandle(raw);
      setState('success');
      statusText.textContent = t('dns.dnsDone');
      body.classList.add('has-card');
      rcHeard.textContent = `«${raw}»`;
      rcTag.textContent = 'DNS';
      typeText(rcReply, reply);
      speak(reply);
      pushHistory(raw, true);
    } catch (dnsErr) {
      /* v0.47 — B03: شکست DNS دیگر بی‌صدا نیست (لاگ کاربر: «دی ان اس امو تست بگیر» ساکت ماند) */
      actLog('dns command fail: ' + String((dnsErr && (dnsErr.stack || dnsErr.message)) || dnsErr).slice(0, 160));
      setState('idle');
      statusText.textContent = t('dns.dnsFail');
      try { typeText(rcReply, t('dns.dnsFail')); } catch (_) { /* noop */ }
      try { speak(t('dns.dnsFail')); } catch (_) { /* noop */ }
      try { pushHistory(raw, false); } catch (_) { /* noop */ }
    }
    cmdBusy = false;
    setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 2600);
  }

  /* v0.18 — ارسال لاگ عملکرد به گیت‌هاب (بدون توکن داخل برنامه؛ صفحهٔ Issue پیش‌پر می‌شود) */
  async function sendActivityReport() {
  /* v0.49 — آپلود آنلاین حذف شد (تصمیم کاربر: «ارسال لاگ با گیت‌هاب رو کلاً فراموش کن،
     خودم دستی برات ارسال می‌کنم») → فقط پوشهٔ لاگ‌ها باز می‌شود تا فایل را دستی بفرستد */
  try {
    if (bridge && bridge.logs && bridge.logs.openFolder) {
      const r = await bridge.logs.openFolder();
      if (r && r.ok) return t('report.folder');
    }
  } catch (_) { /* noop */ }
  return t('report.folder.fail');
}

  /* ============================================================
     نرمال‌سازی متن فارسی (v0.20 — لایهٔ utils پروژهٔ مرجع)
     ي/ى عربی → ی، ك عربی → ک، اعراب و کشیده حذف، اعداد فارسی/عربی → انگلیسی،
     نیم‌فاصله → فاصله — تا قوانین regex و تطبیق برنامه‌ها سردرگم نشوند
     (فقط در خط فرمان‌ها؛ متن تایپ صوتی دست‌نخورده می‌ماند)
     ============================================================ */
  function normFaFull(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[\u064A\u0649]/g, '\u06CC')
      .replace(/\u0643/g, '\u06A9')
      .replace(/\u0640/g, '')
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
      .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/\u200C/g, ' ')
      .replace(/[\u00AB\u00BB]/g, '')
      /* v0.36 — آلودگیِ نویسهٔ تشخیص گفتار مثل «:\» یا «|» در قواعد مزاحمت ایجاد می‌کند */
      .replace(/[\\|\u0060^~]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async function runCommand(cmd, opts) {
    if (!cmd) return;
    let raw = String(cmd).trim();
    /* v0.69 — observability: هیچ برگشتِ زودهنگامِ بی‌نام دیگر وجود ندارد؛
       لاگ «2ms [ai-brain]» با تگِ کهنه از run قبلی دیگر ممکن نیست */
    _dispatchOutcome = 'unrouted';
    /* v0.47 — B02: گارد busy قبل از actLog بود → تکرار کاربر در پنجرهٔ ~۳ثانیه‌ای
       بدون لاگ/UI/صدا دور ریخته می‌شد (ریشهٔ کل خانوادهٔ «۳ تا ۱۰ms و هیچ» در لاگ) */
    if (cmdBusyGuard()) {
      /* v0.66 — به‌جای دور ریختنِ بی‌صدای فرمان جدید (ریشهٔ لاگ v0.64:
         «cmd busy-drop: پینگ dns هامو نشون بده» هرگز اجرا نشد)، فرمانِ جدید
         برنده است: درخواستِ قبلی لغو و فرمانِ تازه اجرا می‌شود */
      actLog('cmd busy → previous request cancelled by new command: ' + raw.slice(0, 80), 'ui', { ev: 'busy-cancel', next: raw.slice(0, 60) });
      await aiCancelRun('new-command');
      cmdBusy = false;
    }
    actLog('cmd: ' + raw.slice(0, 120));
    /* ---- اولویت: تایپ صوتی و DNS (قبل از قوانین دیگر) ---- */
    const DICT_START_RE = /([اآا]وا|ava)[\s\u200C،,:-]*تایپ|حالت\s*تایپ|تایپ\s*(رو\s*)?(شروع|بزن)\s*کن|شروع\s*به\s*تایپ|برام\s*تایپ\s*کن|برایم\s*تایپ\s*کن|این\s*(رو|را)\s*تایپ\s*کن|تایپش\s*کن/i;
    /* v0.34 — «اینجا برام تایپ کن» = تایپ مستقیم در همین برنامهٔ فعال (سیستم‌شیرین) —
       اول از همه چک می‌شود تا با تایپ صوتی معمولی قاطی نشود */
    const SYS_DICT_RE = /(اینجا|همینجا|همین\s*جا)\s*(برام|برایم|هم)?\s*(تایپ|بنویس)|(بنویس|تایپ)\s*(کن)?\s*(اینجا|همینجا)/i;
    const wakeDictStart = opts && opts.wake && /^(تایپ|تایپ\s*کن|حالت\s*تایپ|تایپ\s*صوتی)$/i.test(raw);
    /* v0.67/v0.68 — جمله‌های حاوی نام پیام‌رسان به لَین پیام‌رسانی می‌روند
       («به علی تو دیسکورد تایپ کن که…» ارسال پیام است نه دیکته/تایپ در پنجرهٔ فعال) */
    const MSG_APP_SENT_RE = /تلگرام|دیسکورد|واتساپ|روبیکا|ایتا|telegram|discord|whatsapp|eitaa/i;
    if (dictation.active) {
      if (DICT_STOP_RE.test(raw)) { stopDictation(true); _dispatchOutcome = 'dict-stop'; return; }
      /* وسط تایپ: همین متن اضافه شود، نه اجرای فرمان */
      dictateHandle(raw);
      _dispatchOutcome = 'dictation';
      return;
    }
    /* v0.34/v0.51 — «اینجا برام تایپ کن» دو رفتار دارد:
       با محتوا («اینجا بنویس "سلام"») → دیکتهٔ یک‌باره: همان لحظه در
       برنامهٔ فعال نوشته می‌شود و تمام؛
       بدون محتوا («اینجا برام تایپ کن») → حالت تایپ صوتی (هرچه گفتی همان‌جا
       نوشته می‌شود تا بگویی تمام). */
    if (SYS_DICT_RE.test(raw)) {
      const onceTxt = (typeof AVAIntent !== 'undefined' && AVAIntent.typeOnceOf) ? AVAIntent.typeOnceOf(raw) : '';
      if (onceTxt) {
        _dispatchOutcome = 'type-once';
        actLog('interpret: گفت «' + raw.slice(0, 48) + '» | فهمید type_once', 'ui', { ev: 'interpret', via: 'rule', rule: 'type_once', q: onceTxt.slice(0, 40) });
        const rep = await typeOnceExec(onceTxt);
        typeText(rcReply, rep);
        speak(rep);
        if (/نوشتم/.test(rep)) playDoneSound(); /* v0.65 — صدای کوچکِ انجام‌شد */
        pushChatHist('user', raw); pushChatHist('assistant', rep);
        return;
      }
      startDictation(true); _dispatchOutcome = 'dict-start'; return;
    }
    if ((DICT_START_RE.test(raw) || wakeDictStart) && !MSG_APP_SENT_RE.test(raw)) {
      /* v0.60 (A6) — «برام تایپ کن سلام» دیگر حالت مودار را قورت نمی‌دهد:
         اگر typeOnceOf محتوای واقعی دارد → مسیر تایپ یک‌باره (همان مسیر type_once)؛
         فقط تایپِ لختِ بی‌محتوا («برام تایپ کن») حالت تایپ صوتی پیوسته می‌ماند */
      const onceTxt = (typeof AVAIntent !== 'undefined' && AVAIntent.typeOnceOf) ? AVAIntent.typeOnceOf(raw) : '';
      if (onceTxt) {
        _dispatchOutcome = 'type-once';
        actLog('interpret: گفت «' + raw.slice(0, 48) + '» | فهمید type_once', 'ui', { ev: 'interpret', via: 'rule', rule: 'type_once', q: onceTxt.slice(0, 40) });
        const rep = await typeOnceExec(onceTxt);
        typeText(rcReply, rep);
        speak(rep);
        if (/نوشتم/.test(rep)) playDoneSound(); /* v0.65 — صدای کوچکِ انجام‌شد */
        pushChatHist('user', raw); pushChatHist('assistant', rep);
        return;
      }
      startDictation(); _dispatchOutcome = 'dict-start'; return;
    }
    /* v0.20 — نرمال‌سازی برای همهٔ قوانین (تایپ صوتی بالاتر خارج شد)
       v0.38.1 — ریشهٔ «خیلی از فرمان‌ها کاری نمی‌کنند» با whisper: خروجی STT
       حروف عربی ي/ك و نیم‌فاصله دارد ولی dispatch پایین با cmdِ خام انجام می‌شد؛
       حالا cmd هم همان متنِ نرمال‌شده است تا همهٔ قوانین/برنامه‌ها/AI یک متن ببینند */
    raw = normFaFull(raw);
    cmd = raw;
    /* ============================================================
       v0.65 — لَینِ یادگیریِ صریح (TEACH) — پیش از همهٔ لَین‌ها
       کاربر مستقیم درس می‌دهد؛ سپس عبارتِ آموخته به فرمانِ آموخته‌شده
       بازنویسی و اجرا می‌شود (قطعی، آفلاین، بدون AI). درسِ تازه هرگز
       به مغز AI نمی‌رود تا «جواب چت» نشود.
       ============================================================ */
    if (typeof AVALearn !== 'undefined' && AVALearn.teachParse && !(opts && opts.fromTeach)) {
      const _tw = AVALearn.wakeStrip ? AVALearn.wakeStrip(raw) : raw;
      const _tp = AVALearn.teachParse(_tw);
      if (_tp) { await teachHandle(_tp, raw); return; }
      const _tf = AVALearn.forgetParse ? AVALearn.forgetParse(_tw) : null;
      if (_tf) { await teachForgetHandle(_tf, raw); return; }
      if (/^\s*(?:چه\s+چیز(?:ایی|هایی)\s+یاد|لیست\s+یاد|فهرست\s+یاد|یاد\s*گرفته\s*ها|یادگیری\s*ها)\b/.test(_tw)) { await teachListHandle(raw); return; }
      const _tst = await taughtLoad();
      const _tm = AVALearn.taughtMatch(_tst, _tw);
      if (_tm && _tm.command) {
        _tm.used = (_tm.used || 0) + 1;
        _tm.lastHit = Date.now();
        await taughtPersist();
        actLog('teach-hit: «' + String(_tw).slice(0, 48) + '» → «' + String(_tm.command).slice(0, 60) + '»', 'ui', { ev: 'teach', hit: true, id: _tm.id || '' });
        raw = String(_tm.command);
        cmd = raw;
      }
    }
    /* ============================================================
       v0.46 — «آوا»ی تنها فرمان نیست (لاگ واقعی: cmd «آوا» به Gemini
       فرستاده می‌شد و جواب بی‌ربط می‌آمد). گفتنِ فقط اسم بیدارباش =
       نجویدن؛ آوا جواب می‌دهد «بله؟» و گوش دادن باز می‌شود — بدون
       هیچ تماس شبکه‌ای. (مسیر wake-session خودش قبل از اینجا می‌گیرد؛
       این گارد برای مسیر کلید میان‌بر/بدون بی‌دست و تکرار داخل جلسه است.)
       ============================================================ */
    if (!(opts && opts.force)) {
      const bwm = raw.match(AVAWake.prefixRe(wakeWordCfg()));
      const bareWake = (bwm && !String(bwm[1] || '').trim()) || (raw.length <= 5 && /\b(?:ava|awa)\b/i.test(raw));
      if (bareWake) {
        _dispatchOutcome = 'wake-bare';
        wakeSessOpen();
        setState('idle');
        statusText.textContent = t('wake.sessOn');
        playWakeChime();
        speak(t('wake.yes'));
        handsFreeRearm(1600);
        return;
      }
    }
    /* ارسال گزارش عملکرد (v0.18) — «آوا گزارش بفرست» */
    if (/گزارش\s*(بفرست|بده|بگیر)|لاگ\s*(بفرست|بده)|گزارش\s*مشکل|ارسال\s*گزارش|send\s+log\s+report/i.test(raw)) {
      if (cmdBusyGuard()) return;
      cmdBusySet();
      setState('processing');
      statusText.textContent = t('report.working');
      const rep = await sendActivityReport();
      setState('success');
      statusText.textContent = t('status.done');
      body.classList.add('has-card');
      rcHeard.textContent = `«${raw}»`;
      rcTag.textContent = 'LOG';
      typeText(rcReply, rep);
      speak(rep);
      cmdBusy = false;
      setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 2600);
      return;
    }
    /* کنترل دیسکورد (v0.16) — قبل از DNS/برنامه تا «زنگ بزن» قاطی نشود
       v0.28: دروازهٔ مشترک DISC_GATE_RE — «دیفن/تماس/کال/call» هم پذیرفته
       می‌شود + وقتی افزونه خاموش است پیام روشن (نه سرچ گوگل، نه سکوت) */
    if (DISC_GATE_RE.test(raw)) {
      const dr = await tryDiscordCmd(raw);
      if (dr) {
        if (cmdBusyGuard()) return;
        setState('success');
        statusText.textContent = t('status.done');
        body.classList.add('has-card');
        rcHeard.textContent = `«${raw}»`;
        rcTag.textContent = 'DISCORD';
        typeText(rcReply, dr);
        speak(dr);
        pushHistory(raw, true);
        setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 2600);
        return;
      }
      /* افزونهٔ دیسکورد خاموش است ولی کاربر فرمان کنترل داد → پیام شفاف
         (ولی «دیسکورد رو باز کن» نیت اجرای خود برنامه است → به مسیر عادی برود) */
      if (settings.extDiscord === false
          && !/(باز\s*کن|اجرا\s*کن|باز\s*شو|بیار\s*بالا|\b(open|run|launch)\b)/i.test(raw)) {
        if (cmdBusyGuard()) return;
        setState('success');
        statusText.textContent = t('status.done');
        body.classList.add('has-card');
        rcHeard.textContent = `«${raw}»`;
        rcTag.textContent = 'DISCORD';
        const offMsg = t('disc.off');
        typeText(rcReply, offMsg);
        speak(offMsg);
        setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 2600);
        cmdBusy = false;
        return;
      }
    }
    /* پینگ DNSها (v0.13) — قبل از مسیر کلاسیک DNS تا «پینگ دی ان اس» قاطی نشود */
    /* v0.47 — B16: «دی ان اس امو تست بگیر» هم تست واقعی اجرا کند (لاگ: فقط مدیریت DNS باز می‌شد) */
    if (/پینگ[^.]{0,16}(دی\s?ان\s?اس|dns)|(دی\s?ان\s?اس|dns)[^.]{0,16}(پینگ|تست|سرعت)|پینگ\s?(بگیر|نشون|بده)|تست\s?(بگیر|کن)[^.]{0,16}(دی\s?ان\s?اس|dns)|dns.{0,10}ping|ping.{0,10}dns/i.test(raw)) {
      if (cmdBusyGuard()) return;
      cmdBusySet();
      setState('processing');
      statusText.textContent = t('dnsp.testing');
      try {
        const reply = await pingVoiceReply();
        setState('success');
        statusText.textContent = t('status.done');
        body.classList.add('has-card');
        rcHeard.textContent = `«${raw}»`;
        rcTag.textContent = 'PING';
        typeText(rcReply, reply);
        speak(reply);
        pushHistory(raw, true);
        _dispatchOutcome = 'ping';
      } catch (_) {
        setState('idle');
        statusText.innerHTML = IDLE_HINT;
        _dispatchOutcome = 'ping-fail';
      }
      cmdBusy = false;
      setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 2600);
      return;
    }
    /* DNS کلاسیک: هر جمله‌ای که «دی ان اس / dns» دارد */
    if (/دی\s?ان\s?اس|dns/i.test(raw)) { _dispatchOutcome = 'dns'; await runDnsCommand(raw); return; }
    /* DNS با اسم دلخواه — حتی بدون واژه «دی ان اس»:
       «الکترو رو تنظیم کن» یا «شکن رو فعال کن» → همان پروفایل روی ویندوز ست می‌شود */
    if (/(تنظیم|فعال|وصل|اعمال|ست)\s*(کن|بکن)?/i.test(raw)) {
      const cand = raw
        .replace(/(لطفا|لطفاً)/g, '')
        .replace(/(^|\s)(رو|را|به|برای|من)(\s|$)/g, ' ')
        .replace(/(تنظیم|فعال|وصل|اعمال|کن|بکن|بزن|شروع)/g, ' ')
        .replace(/[\s\u200C]+/g, ' ')
        .trim();
      if (cand.length >= 3 && findDnsProfile(cand)) { _dispatchOutcome = 'dns'; await runDnsCommand(raw); return; }
    }
    cmdBusySet();
    try {
    if (state === 'listening') stopListening(false);
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (_) { /* noop */ }
    stopGoogleSpeak(); /* صدای قبلی آوا قطع شود */

    setState('processing');
    statusText.textContent = t('status.working');
    body.classList.add('has-card');
    rcHeard.textContent = `«${cmd}»`;
    respCard.classList.remove('show');
    void respCard.offsetWidth;
    respCard.classList.add('show');
    hideWakeDropCard(); /* v0.27.1 */
    rcReply.textContent = '';
    rcTag.textContent = t('tag.working');

    /* ============================================================
       v0.70 — تأییدِ در انتظار (کار حساس مغز: contact_send)
       کاربر «بله/بفرست» گفت → ارسال واقعی؛ «نه/کنسل» → هیچ.
       ============================================================ */
    if (_pendingConfirm) {
      const _yes = /^(بله|بفرست|اره|آره|اوکی|اکی|باشه|تأیید|تایید|همینه|همینو بفرست|بزن بریم|یواش)\s*[.!.]*$/i.test(raw.trim());
      const _no = /^(نه|نخیر|کنسل|بی\s?خیال|بیخیال|لغو|نفرست|ولش\s?کن)\s*[.!.]*$/i.test(raw.trim());
      if (_yes || _no) {
        const pc = _pendingConfirm;
        _pendingConfirm = null;
        let _crep2 = '';
        if (_yes) {
          _crep2 = await brainSendResolved(pc.action);
        } else {
          _crep2 = LANG === 'en' ? 'Okay, nothing was sent.' : 'باشه، چیزی نفرستادم.';
        }
        setState('success');
        statusText.textContent = t('status.done');
        rcTag.textContent = t('tag.done');
        typeText(rcReply, _crep2);
        speak(_crep2);
        pushHistory(raw, true);
        try { if (window.AVACore) window.AVACore.recordTurn({ utterance: raw, via: _yes ? 'confirm-send' : 'confirm-cancel', intent: 'contact_send', params: { msgTarget: String((pc.action.params && pc.action.params.name) || '') }, reply: _crep2 }); } catch (_) { /* noop */ }
        if (_yes && !/انجام نشد|Could not/.test(String(_crep2))) { try { playDoneSound(); } catch (_) { /* noop */ } }
        cmdBusy = false;
        setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 3000);
        return;
      }
      /* جملهٔ دیگر → تأیید منقضی؛ مسیر عادی ادامه می‌یابد */
      _pendingConfirm = null;
    }

    /* ============================================================
       v0.66 — لَین قطعیِ URL ویدیو — همیشه قبل از هر لایهٔ دیگر
       ------------------------------------------------------------
       ریشهٔ لاگ v0.63/v0.65 (۷ بار): کاربر URL کامل داد
       («https://www.youtube.com/watch?v=ob3pgk1PDTs پخشش کن»، «لینک +
       توی کی ام پلیر») ولی جمله به مغز AI رفت و Gemini لینک را به
       video_play(https://www.youtube.com/) خراب کرد. درمان ریشه‌ای: پیامِ
       حاوی لینک ویدیو هرگز به AI نمی‌رود — لینک حرف‌به‌حرف از متنِ خام
       بریده می‌شود، «پلیر مقصد» از همان جمله خوانده می‌شود، لینک در
       حافظهٔ lastVideoUrl ثبت می‌شود و مستقیم پایپ‌لاین پخش می‌رود.
       ============================================================ */
    {
      const _vl = (typeof AVAIntent !== 'undefined' && AVAIntent.videoUrlLane) ? AVAIntent.videoUrlLane(cmd) : null;
      if (_vl && _vl.url) {
        try { actLog('lane=video-url (deterministic): url=' + _vl.url.slice(0, 90) + ' player=' + (_vl.player || 'default'), 'ui', { ev: 'lane', lane: 'video-url', url: _vl.url, player: _vl.player || 'default' }); } catch (_) { /* noop */ }
        _dispatchOutcome = 'video-url';
        lastVideoUrl = _vl.url;
        const _vr = await videoPlayReply(_vl.url, _vl.player, cmd);
        setState('success');
        statusText.textContent = t('status.done');
        rcTag.textContent = t('tag.done');
        typeText(rcReply, _vr.rep);
        speak(_vr.rep);
        pushHistory(cmd, true);
        try { if (window.AVACore) window.AVACore.recordTurn({ utterance: cmd, via: 'video-url', intent: 'video_play', params: { q: _vl.url }, reply: _vr.rep }); } catch (_) { /* noop */ }
        if (_vr.ok) { try { playDoneSound(); } catch (_) { /* noop */ } }
        cmdBusy = false;
        setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 2600);
        return;
      }
    }

    /* ============================================================
       v0.66 — فرمانِ صوتیِ لغو — «بی‌خیال / کنسل / لغو کن / ولش کن»
       ------------------------------------------------------------
       کاربر وقتی آوا معطلِ یک درخواستِ کند است دیگر اسیر آن نیست:
       • کاری در جریان است → واقعاً لغو می‌شود (epoch + abort) + تأیید
       • چیزی در جریان نیست → پاسخ کوتاه صادقانه، بدون رفتن به AI
         (ریشهٔ لاگ: «نه بابا بی‌خیال» ۱ ثانیه منتظر جمینای ماند)
       فقط فرمانِ خالصِ لغو (anchor به سرِ جمله) — «نه بابا بی‌خیال»
       همچنان به گفتگوی عادی می‌رود.
       ============================================================ */
    if (/^(آوا[\s،,:-]*)?(بی\s?خیال|بیخیال|کنسل(\s?کن)?|لغو(\s?کن|\s?کردن)?|ولش\s?کن|منصرف\s?شدم|استاپ\s?کن|متوقفش?\s?کن)\s*$/i.test(raw)) {
      const wasBusy = cmdBusy;
      if (wasBusy) await aiCancelRun('voice');
      _dispatchOutcome = wasBusy ? 'cancel' : 'cancel-idle';
      setState('success');
      rcTag.textContent = t('tag.done');
      const _crep = wasBusy ? (LANG === 'en' ? 'Okay, cancelled.' : 'خیلی خب، لغو شد.') : (LANG === 'en' ? 'Nothing was running.' : 'الان چیزی در جریان نبود.');
      typeText(rcReply, _crep);
      speak(_crep);
      pushHistory(raw, true);
      cmdBusy = false;
      setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 2200);
      return;
    }

    /* ============================================================
       v0.68 — عیب‌یاب صوتی پیام‌رسان‌ها («تست تلگرام» / «تست پیام‌رسان‌ها»)
       --------------------------------------------------------------
       خواستهٔ کاربر: باگِ «هیچ‌کاری نمی‌کنه» نباید مبهم بماند — هر خطا
       با دلیل مشخص گفته می‌شود (نصب نیست / پنجره پیدا نشد / فوکوس نشد).
       تلگرام: کشف پنجره + فوکوس بدون ارسال (msg:test)؛ دیسکورد: selftest
       موتور؛ بقیه: چک نصب از اسکن اپ‌ها. جملهٔ ارسال پیام هرگز دزدیده
       نمی‌شود (گارد msgParse با target+text).
       ============================================================ */
    {
      const _hasTest = /(?:تست|چک)/i.test(raw);
      const _mm = raw.match(/پیام\s*رسان|پیام‌رسان|تلگرام|دیسکورد|واتساپ|بله|روبیکا|ایتا/i);
      const _mpGuard = (typeof AVAMessaging !== 'undefined' && AVAMessaging.msgParse) ? AVAMessaging.msgParse(raw) : null;
      if (_hasTest && _mm && !(_mpGuard && _mpGuard.text && _mpGuard.target)) {
        _dispatchOutcome = 'messaging';
        let _trep = '';
        try {
          const _which = String(_mm[0] || '');
          const _appM = (typeof AVAMessaging !== 'undefined' && AVAMessaging.appOf) ? AVAMessaging.appOf(_which.replace(/\s+/g, '')) : null;
          const _inst = (typeof AVAMessaging !== 'undefined' && AVAMessaging.detectInstalled && typeof sysApps !== 'undefined' && sysApps.list) ? AVAMessaging.detectInstalled(sysApps.list) : [];
          const _faAll = { telegram: 'تلگرام', whatsapp: 'واتساپ', bale: 'بله', rubika: 'روبیکا', discord: 'دیسکورد', eitaa: 'ایتا' };
          if (!_appM || /پیام/.test(_which)) {
            _trep = _inst.length
              ? LANG === 'en' ? ('Installed: ' + _inst.map((x) => _faAll[x] || x).join(', ') + ' — for a deep test say "test telegram".') : ('نصب هست: ' + _inst.map((x) => _faAll[x] || x).join('، ') + ' — برای تست عمیق بگو «تست تلگرام» یا «تست دیسکورد».')
              : LANG === 'en' ? 'No messenger found in the app list — run the app scan in Settings › Plugins first.' : 'هیچ پیام‌رسانی توی لیست اپ‌ها پیدا نکردم — اول از تنظیمات › افزونه‌ها اسکن اپ‌ها رو بزن.';
          } else if (_appM.id === 'telegram' && bridge && bridge.msg && bridge.msg.test) {
            const r = await bridge.msg.test({ app: 'telegram' }).catch(() => null);
            if (r && r.ok && /TGTEST/.test(String(r.result || ''))) _trep = LANG === 'en' ? 'Telegram window found, focus OK — the send engine is ready.' : 'پنجرهٔ تلگرام رو پیدا کردم، فوکوس هم اوکیه — موتور ارسال آماده‌ست.';
            else _trep = (r && r.error) || (LANG === 'en' ? 'Telegram test failed.' : 'تست تلگرام انجام نشد.');
          } else if (_appM.id === 'discord' && bridge && bridge.discord) {
            const r = await bridge.discord.cmd({ action: 'selftest' }).catch(() => null);
            _trep = (r && r.ok) ? t('disc.selftestOk') : (LANG === 'en' ? 'Discord self-test failed — details in activity.log.' : 'تست دیسکورد کامل نشد — جزئیات تو activity.log هست.');
          } else {
            const _has = _inst.indexOf(_appM.id) !== -1;
            _trep = _has
              ? (LANG === 'en' ? `${_appM.fa} is installed and ready — say "message [name] on ${_appM.fa} that …".` : `${_appM.fa} نصبه و مسیر ارسالش آماده‌ست — بگو «به [اسم] پیام بده تو ${_appM.fa} که …».`)
              : (LANG === 'en' ? `${_appM.fa} not found in installed apps — install it and run the app scan.` : `${_appM.fa} رو توی اپ‌های سیستم پیدا نکردم — نصبش کن و یک‌بار اسکن اپ‌ها رو بزن.`);
          }
        } catch (e) { _trep = LANG === 'en' ? 'Messenger test failed.' : 'تست پیام‌رسان انجام نشد: ' + String((e && e.message) || e).slice(0, 60); }
        setState('success');
        statusText.textContent = t('status.done');
        rcTag.textContent = t('tag.done');
        typeText(rcReply, _trep);
        speak(_trep);
        pushHistory(raw, true);
        try { if (window.AVACore) window.AVACore.recordTurn({ utterance: raw, via: 'messaging', intent: 'msg_test', params: {}, reply: _trep }); } catch (_) { /* noop */ }
        cmdBusy = false;
        setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 3200);
        return;
      }
    }

    /* ============================================================
       v0.68 — لَین مخاطبین صوتی (ذخیرهٔ مخاطب با اسمی که ذخیره شده)
       --------------------------------------------------------------
       «علی رو تو تلگرام با یوزر ali_gh ذخیره کن» / «ذخیره کن رضا رو تو
       واتساپ با شماره ۰۹۱۲…» / «مخاطب علی رو حذف کن» / «علی رو از
       مخاطبین پاک کن» / «مخاطبینمو بخون» — قطعی، بدون AI؛ قبل از لَین
       ارسال پیام تا هیچ‌وقت با فرمان ارسال قاطی نشود.
       ============================================================ */
    {
      const _ctc = (typeof AVAMessaging !== 'undefined' && AVAMessaging.ctCmdParse) ? AVAMessaging.ctCmdParse(raw) : null;
      if (_ctc) {
        _dispatchOutcome = 'messaging';
        let _crep = '';
        try {
          const _faOf = (id) => { const m = (typeof AVAMessaging !== 'undefined' && AVAMessaging.msgAppsOf) ? AVAMessaging.msgAppsOf().find((x) => x.id === id) : null; return m ? m.fa : id; };
          if (_ctc.op === 'save') {
            if (!Array.isArray(settings.msgContacts)) settings.msgContacts = [];
            if (settings.msgContacts.length >= 200) {
              _crep = LANG === 'en' ? 'Contacts list is full.' : 'لیست مخاطبین پر است — چند تا قدیمی رو پاک کن.';
            } else {
              const _hd = (h) => String(h || '').replace(/^@/, '').toLowerCase().trim();
              const _dup = settings.msgContacts.find((y) => String(y.app || '') === _ctc.app && _hd(y.handle) === _hd(_ctc.handle)) || settings.msgContacts.find((y) => String(y.app || '') === _ctc.app && AVAMessaging.normFa(y.name) === AVAMessaging.normFa(_ctc.name));
              if (_dup) {
                _dup.handle = _ctc.handle;
                if (!Array.isArray(_dup.aliases)) _dup.aliases = [_dup.name];
                if (_dup.name !== _ctc.name && !_dup.aliases.includes(_ctc.name)) _dup.aliases.push(_ctc.name);
                _dup.name = _ctc.name;
                store.set('msgContacts', settings.msgContacts);
                try { if (typeof msgContactsRender === 'function') msgContactsRender(); } catch (_) { /* noop */ }
                _crep = LANG === 'en' ? `Updated "${_ctc.name}" on ${_faOf(_ctc.app)} → ${_ctc.handle}.` : `«${_ctc.name}» رو تو ${_faOf(_ctc.app)} به‌روز کردم → ${_ctc.handle}.`;
              } else {
                settings.msgContacts.push({ id: 'mc' + Date.now().toString(36), name: _ctc.name, app: _ctc.app, handle: _ctc.handle, aliases: [_ctc.name] });
                store.set('msgContacts', settings.msgContacts);
                try { if (typeof msgContactsRender === 'function') msgContactsRender(); } catch (_) { /* noop */ }
                _crep = LANG === 'en' ? `Saved "${_ctc.name}" on ${_faOf(_ctc.app)} → ${_ctc.handle}. From now on just say: message ${_ctc.name}.` : `ذخیره کردم: «${_ctc.name}» تو ${_faOf(_ctc.app)} با ${_ctc.kind === 'phone' ? 'شمارهٔ' : 'یوزرِ'} ${_ctc.handle}. از این به بعد فقط بگو «به ${_ctc.name} پیام بده».`;
              }
            }
          } else if (_ctc.op === 'del') {
            const _all = Array.isArray(settings.msgContacts) ? settings.msgContacts : [];
            if (!_ctc.name) {
              _crep = LANG === 'en' ? 'Which contact should I delete? Say its name.' : 'اسم مخاطبی که باید پاک بشه رو بگو.';
            } else {
              const _hit = AVAMessaging.contactFind(_all, '', _ctc.name, true);
              if (_hit) {
                settings.msgContacts = _all.filter((y) => y.id !== _hit.id);
                store.set('msgContacts', settings.msgContacts);
                try { if (typeof msgContactsRender === 'function') msgContactsRender(); } catch (_) { /* noop */ }
                _crep = LANG === 'en' ? `Deleted "${_hit.name}" from contacts.` : `«${_hit.name}» رو از مخاطبین پاک کردم.`;
              } else {
                _crep = LANG === 'en' ? `I don't have "${_ctc.name}" in contacts.` : `«${_ctc.name}» رو توی مخاطبینم ندارم.`;
              }
            }
          } else {
            const _all = Array.isArray(settings.msgContacts) ? settings.msgContacts : [];
            if (!_all.length) {
              _crep = LANG === 'en' ? 'No contacts yet — say: save Ali on Telegram with user ali_gh.' : 'هنوز مخاطبی نداریم — بگو: «علی رو تو تلگرام با یوزر ali_gh ذخیره کن».';
            } else {
              _crep = LANG === 'en'
                ? 'Contacts: ' + _all.slice(0, 8).map((y) => `${y.name} (${y.app}: ${y.handle})`).join(', ') + (_all.length > 8 ? ` … (${_all.length} total)` : '')
                : 'مخاطبینت: ' + _all.slice(0, 8).map((y) => `«${y.name}» (${_faOf(y.app)}: ${y.handle})`).join('، ') + (_all.length > 8 ? ` … و ${_all.length - 8} تا دیگه` : '') + '.';
            }
          }
        } catch (e) { _crep = LANG === 'en' ? 'Contacts command failed.' : 'فرمان مخاطبین انجام نشد: ' + String((e && e.message) || e).slice(0, 60); }
        setState('success');
        statusText.textContent = t('status.done');
        rcTag.textContent = t('tag.done');
        typeText(rcReply, _crep);
        speak(_crep);
        pushHistory(raw, true);
        try { if (window.AVACore) window.AVACore.recordTurn({ utterance: raw, via: 'messaging', intent: 'contacts_' + _ctc.op, params: { op: _ctc.op, app: _ctc.app || '' }, reply: _crep }); } catch (_) { /* noop */ }
        playDoneSound();
        cmdBusy = false;
        setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 3200);
        return;
      }
    }

    /* ============================================================
       v0.70 — گارد لَین آموزش/حافظه — قبل از همهٔ لَین‌های اجرایی
       ------------------------------------------------------------
       ریشهٔ لاگ 17:05:10: «آفرین از این به بعد هر وقت گفتم به میلاد پیام
       بده…» به گرامر پیام افتاد (target=«بعد هر وقت»!) و تقریباً به
       غریبه پیام می‌رفت. جمله‌های «از این به بعد/هر وقت گفتم/یادت باشه/
       ذخیره کن» حالا هرگز به گرامرهای اجرایی نمی‌افتند؛ به مغز واحد با
       actهای memory_save/contact_save می‌روند. آفلاین: فکتِ خام ذخیره
       و صادقانه گفته می‌شود.
       ============================================================ */
    if (typeof AVABrain !== 'undefined' && AVABrain.isTeach(raw)) {
      _dispatchOutcome = 'teach';
      try { actLog('lane=teach (guard): «' + raw.slice(0, 60) + '»', 'ui', { ev: 'lane', lane: 'teach' }); } catch (_) { /* noop */ }
      if (aiConnected()) {
        await aiHandleCommand(raw, await aiBrainCtx());
        return;
      }
      /* آفلاین — حداقل: فکت را نگه دار، صادقانه بگو */
      let _trep3 = LANG === 'en' ? 'I am offline right now — for full learning, connect to the internet.' : 'الان آفلاینم — برای یادگیری کامل اینترنت رو وصل کن.';
      try {
        const m = avaMem();
        if (m) { await m.load(); const id = m.addFact(raw, { src: 'offline' }); const ok = id ? await m.persist() : false; if (ok) _trep3 = LANG === 'en' ? 'Saved as a rough note — I will organize it once I am online.' : 'خام ذخیره‌اش کردم — تا آنلاین شدم مرتبش می‌کنم.'; }
      } catch (_) { /* noop */ }
      setState('success');
      statusText.textContent = t('status.done');
      rcTag.textContent = t('tag.reply');
      typeText(rcReply, _trep3);
      speak(_trep3);
      pushHistory(raw, true);
      try { if (window.AVACore) window.AVACore.recordTurn({ utterance: raw, via: 'teach-offline', intent: 'memory_save', reply: _trep3 }); } catch (_) { /* noop */ }
      cmdBusy = false;
      setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 2800);
      return;
    }

    /* ============================================================
       v0.67 — لَین قطعیِ پیام‌رسانی (اکستنشن مرحلهٔ ۲ — اتوماسیون واقعی)
       ------------------------------------------------------------
       بازخورد کاربر روی مرحلهٔ ۱: «پیام رسان‌ها هیچکدوم کار نمیکنه…
       به فلانی پیام بده تو تلگرام اصن هیچکاری نمیکنه حتی با تلگرام PC
       بازه» — ریشه: tg://resolve فقط یوزرنیم لاتین می‌شناسد و نام فارسی
       ساکت نادیده می‌شود؛ دیسکورد هم channel-ID می‌خواست.
       درمان ریشه‌ای: تلگرام/دیسکورد → اتوماسیون واقعی دسکتاپ (msg:send →
       PS: فوکوس تاییدشده + سرچ/سوییچر + پیست + Enter)؛ واتساپ → wa.me
       پیش‌پرشده با شماره (از جمله یا مخاطبین)؛ بله/روبیکا → وب + کلیپ‌بورد
       صادقانه. بدون متن پیام هیچ ارسالی نیست — صادقانه می‌پرسد.
       ============================================================ */
    {
      const _mp = (typeof AVAMessaging !== 'undefined' && AVAMessaging.msgParse) ? AVAMessaging.msgParse(raw) : null;
      /* v0.69 — آنافورا مقصد («بهش/براش/همین اسم/همون مخاطب») از حافظه حل می‌شود —
         ریشهٔ لاگ: «همین اسم» لفظی در سوییچر دیسکورد تایپ شد و «بهش بگو» با مقصد خالی رفت */
      if (_mp && _mp.targetRef && !_mp.target) {
        const _rt = (window.AVACore && window.AVACore.resolveRefTarget) ? window.AVACore.resolveRefTarget(raw) : '';
        if (_rt) _mp.target = _rt;
      }
      if (_mp && (_mp.target || _mp.text || _mp.targetRef)) {
        try { actLog('lane=messaging (deterministic): app=' + _mp.app + ' target=' + String(_mp.target).slice(0, 24) + ' text=' + String(_mp.text).slice(0, 30) + (_mp.targetRef ? ' REF-UNRESOLVED' : ''), 'ui', { ev: 'lane', lane: 'messaging', app: _mp.app }); } catch (_) { /* noop */ }
        _dispatchOutcome = 'messaging';
        let _mrep = '';
        let _mok = false;
        try {
        if (!_mp.target) {
          /* مقصدِ حل‌نشده → سؤال صادقانه؛ هیچ ارسالِ بی‌مقصد یا لفظیِ «همین اسم» */
          _mrep = LANG === 'en' ? `Who should I message on ${_mp.appFa}? Say the name, e.g. "message Ali on ${_mp.appFa} …".` : `به کی تو ${_mp.appFa} پیام بدم؟ اسمش رو بگو — مثلاً «به علی تو ${_mp.appFa} پیام بده که …»`;
        } else if (!_mp.text) {
            /* v0.67 — بدون متن پیام هیچ ارسالی وجود ندارد؛ قبلاً deep-link لخت
               می‌زد که در تلگرام هیچ بود (ریشهٔ «هیچ‌کاری نمی‌کنه») */
            _mrep = LANG === 'en' ? `What should I send to "${_mp.target}" on ${_mp.appFa}? Say: «…message them that …»` : `چی برای «${_mp.target}» تو ${_mp.appFa} بفرستم؟ بگو «به ${_mp.target} پیام بده که …»`;
          } else if (_mp.app === 'telegram' || _mp.app === 'discord') {
            /* اتوماسیون واقعی دسکتاپ — نام فارسی با سرچ/سوییچرِ خود اپ باز و
               پیست/ارسال می‌شود؛ deep-link فقط فالبکِ «اپ باز نیست» است */
            const _cts = (typeof settings !== 'undefined' && Array.isArray(settings.msgContacts)) ? settings.msgContacts : [];
            const _ct = AVAMessaging.contactFind(_cts, _mp.app, _mp.target);
            const _name = (_mp.app === 'discord' && _ct && AVAMessaging.isLatinUsername(_ct.handle)) ? _ct.handle.replace(/^@/, '') : ((_ct && _ct.name) || _mp.target);
            const _handle = (_ct && _ct.handle) || '';
            /* v0.69 — واریانت‌های جستجو: نام گفته‌شده + نام مخاطب + مستعارها + یوزرنیم
               + آخرین یادداشت لاتین‌شکل + آوانگاری لاتین (ریشهٔ لاگ: سرچ «علی اچ کی»
           در دیسکوردِ انگلیسی‌نویس هیچ بود) */
            const _vs = [];
            const _pushV = (x) => { const v = String(x || '').trim(); if (v && _vs.indexOf(v) === -1) _vs.push(v); };
            _pushV(_mp.target);
            if (_ct) { _pushV(_ct.name); (Array.isArray(_ct.aliases) ? _ct.aliases : []).forEach(_pushV); _pushV(_ct.handle); }
            try {
              if (window.AVACore && window.AVACore._state) {
                const _ne = window.AVACore._state.entities.note || '';
                if (_ne && /[a-zA-Z]/.test(_ne) && String(_ne).length <= 40) _pushV(_ne);
                const _pe = window.AVACore._state.entities.person || '';
                if (_pe && String(_pe).length <= 40) _pushV(_pe);
              }
            } catch (_) { /* noop */ }
            if (/(انگلیسی|لاتین)/i.test(raw) && AVAMessaging.noteLatinOf) { try { const _lv = AVAMessaging.noteLatinOf(raw); if (_lv && _lv.out) _pushV(_lv.out); } catch (_) { /* noop */ } }
            if (!AVAMessaging.phoneLike(_mp.target)) { try { const _fl = AVAMessaging.faToLatin(_mp.target); if (_fl && _fl.length >= 3) _pushV(_fl); } catch (_) { /* noop */ } }
            const _uname = (_mp.app === 'telegram' && AVAMessaging.isLatinUsername(_handle)) ? _handle.replace(/^@/, '') : (AVAMessaging.isLatinUsername(_mp.target) ? _mp.target.replace(/^@/, '') : '');
            const r = (bridge && bridge.msg && bridge.msg.send) ? await bridge.msg.send({ app: _mp.app, name: _name, text: _mp.text, username: _uname, variants: _vs }).catch(() => null) : null;
            if (r && r.error && /NO_MATCH/.test(String(r.error))) {
              /* v0.69 — وارسی عنوان چت شکست خورد → صادقانه؛ دیگر پیام به چتِ اشتباه نمی‌رود */
              _mrep = LANG === 'en' ? `Could not find "${_name}" in ${_mp.appFa} with confidence — nothing was sent. Search them manually once and I'll remember.` : `چت «${_name}» رو تو ${_mp.appFa} مطمئن پیدا نکردم — هیچی نفرستادم. یک بار خودت سرچش کن تا اسم دقیقش رو یاد بگیرم.`;
            } else if (r && r.ok && /UNVERIFIED/.test(String(r.result || ''))) {
              _mok = true;
              _mrep = LANG === 'en' ? `Sent to "${_name}" on ${_mp.appFa} — double-check it landed.` : `فرستادم به «${_name}» تو ${_mp.appFa} — یه نگاه بنداز که رسیده باشه.`;
            } else if (r && r.ok) {
              _mok = true;
              _mrep = LANG === 'en' ? `Sent to "${_name}" on ${_mp.appFa}.` : `فرستادم به «${_name}» تو ${_mp.appFa}.`;
            } else if (r && r.error && /باز نیست/.test(String(r.error)) && _uname && _mp.app === 'telegram' && bridge.msg.open) {
              /* فالبک صادقانه: تلگرام باز نیست ولی یوزرنیم معتبر داریم — چت باز +
                 متن در کلیپ‌بورد (هیچ ادعای ارسالی وجود ندارد) */
              try { await bridge.sys.copyText(_mp.text); } catch (_) { /* noop */ }
              try { await bridge.msg.open('tg://resolve?domain=' + _uname); } catch (_) { /* noop */ }
              _mrep = LANG === 'en' ? `Telegram was closed — opened the chat with "${_uname}"; your text is on the clipboard (Ctrl+V, Enter).` : `تلگرام باز نبود؛ چت «${_uname}» رو باز کردم و متن تو کلیپ‌بورد است — Ctrl+V و بعد Enter.`;
            } else {
              _mrep = (r && r.error) || (LANG === 'en' ? 'Messaging automation failed.' : 'ارسال پیام انجام نشد.');
            }
          } else if (_mp.app === 'whatsapp') {
            const _cts2 = (typeof settings !== 'undefined' && Array.isArray(settings.msgContacts)) ? settings.msgContacts : [];
            const _ct2 = AVAMessaging.contactFind(_cts2, 'whatsapp', _mp.target);
            const _phone = AVAMessaging.phoneLike(_mp.target) || (_ct2 ? AVAMessaging.phoneLike(_ct2.handle) : '');
            if (!_phone) {
              _mrep = LANG === 'en' ? `WhatsApp needs a phone number for "${_mp.target}" — say "message 0912… on WhatsApp …" or save the contact in Settings › Plugins.` : `برای «${_mp.target}» تو واتساپ شماره لازم است — بگو «به ۰۹۱۲… در واتساپ پیام بده که …» یا مخاطب را در تنظیمات › افزونه‌ها ثبت کن.`;
            } else if (bridge && bridge.msg && bridge.msg.open) {
              const built = AVAMessaging.msgBuild('whatsapp', _phone, _mp.text, true);
              const r = await bridge.msg.open(built.link).catch(() => null);
              if (r && r.ok) { _mok = true; _mrep = LANG === 'en' ? `WhatsApp opened for "${_mp.target}" with your text pre-filled — press Enter.` : `واتساپ برای «${_mp.target}» با متن «${_mp.text}» باز شد — فقط Enter بزن.`; }
              else _mrep = LANG === 'en' ? 'Could not open WhatsApp.' : `باز کردن واتساپ ممکن نشد${r && r.error ? ': ' + r.error : ''}.`;
            } else _mrep = t('toast.onlyApp');
          } else if (bridge && bridge.msg && bridge.msg.open) {
            /* بله / روبیکا — وب: لینک باز + متن در کلیپ‌بورد؛ اتوماسیون تایپِ
               وب نداریم و صادقانه می‌گوییم (قبلاً «باز شد» گفته بودیم و ساکت) */
            const built = AVAMessaging.msgBuild(_mp.app, _mp.target, _mp.text, false);
            if (built.copyText) { try { await bridge.sys.copyText(built.copyText); } catch (_) { /* noop */ } }
            const r = await bridge.msg.open(built.link).catch(() => null);
            if (r && r.ok) _mrep = LANG === 'en' ? `${_mp.appFa} web opened; your text is on the clipboard — paste (Ctrl+V) and send it yourself.` : `${_mp.appFa} باز شد؛ متن «${_mp.text}» در کلیپ‌بورد است — خودت Ctrl+V کن و بفرست (وب اتوماسیون تایپ ندارم).`;
            else _mrep = LANG === 'en' ? 'Could not open the messenger.' : `باز کردن ${_mp.appFa} ممکن نشد${r && r.error ? ': ' + r.error : ''}.`;
          } else _mrep = t('toast.onlyApp');
        } catch (e) { _mrep = LANG === 'en' ? 'Messaging failed.' : 'پیام‌رسانی انجام نشد: ' + String((e && e.message) || e).slice(0, 60); }
        setState('success');
        statusText.textContent = t('status.done');
        rcTag.textContent = t('tag.done');
        typeText(rcReply, _mrep);
        speak(_mrep);
        pushHistory(raw, true);
        try { if (window.AVACore) window.AVACore.recordTurn({ utterance: raw, via: 'messaging', intent: 'msg_send', params: { app: _mp.app, msgTarget: String(_mp.target || '').slice(0, 80), msgApp: _mp.app }, reply: _mrep }); } catch (_) { /* noop */ }
        if (_mok) { try { playDoneSound(); } catch (_) { /* noop */ } }
        cmdBusy = false;
        setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 3200);
        return;
      }
    }

    /* ============================================================
       v0.69 — لَینِ قطعیِ یادداشت — پیش از مغز و پیش از تایپ یک‌باره
       ----------------------------------------------------------
       ریشهٔ لاگ Ali-HK:
       «همون اسمی که بهت گفتم بنویس یادداشت کن…» به type-once رفت و در
       پنجرهٔ متمرکز تایپ شد؛ «میگم همون اسمی که الان یادداشت کردیم…»
       به چت AI رفت و هیچ محتوایی نشان داده نشد. حالا هر جملهٔ حاوی
       «یادداشت» همین‌جا قطعی حل می‌شود (add/read/delete)، با تبدیل
       املایی لاتین، و هرگز به تایپ/چت نمی‌ریزد.
       ============================================================ */
    if (/یادداشت|یادداشتم|note (down|to self)|take a note/i.test(raw)) {
      _dispatchOutcome = 'rule:notes';
      try { actLog('lane=notes (deterministic): «' + raw.slice(0, 60) + '»', 'ui', { ev: 'lane', lane: 'notes' }); } catch (_) { /* noop */ }
      const _nrep = await notesReply(raw);
      setState('success');
      statusText.textContent = t('status.done');
      rcTag.textContent = t('tag.done');
      typeText(rcReply, _nrep);
      speak(_nrep);
      pushHistory(raw, true);
      try { if (window.AVACore) window.AVACore.recordTurn({ utterance: raw, via: 'rule', intent: 'notes', params: { noteText: (window.AVACore._state && window.AVACore._state.entities.note) || '' }, reply: _nrep }); } catch (_) { /* noop */ }
      if (!/نشده|Could not|ذخیره نشد/.test(String(_nrep))) { try { playDoneSound(); } catch (_) { /* noop */ } }
      cmdBusy = false;
      setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 2800);
      return;
    }

    /* ============================================================
       v0.61 — هستهٔ فهم (AVACore) — چهار ستون معماری جدید پاسخ‌دهی
       ----------------------------------------------------------
       ستون ۲: حل‌گر ارجاع — «همینو/همون آهنگ/اون مدل» با موجودیتِ آخرین
         گفتگو ترمیم می‌شود تا هیچ لایه‌ای (قانون/AI) عبارتِ لخت نبیند
         (ریشهٔ لاگ v0.53: «همینو» در یوتیوب سرچ شد).
       ستون ۳: مسیربینی دو لَین — جملهٔ «موضوع‌دار» (سرچ/پخش با اسم/سوال/
         تصحیح/ارجاع) وقتی AI وصل است «مستقیم» به مغز ابری می‌رود و
         قانون‌ها فقط فالبکِ آفلاین‌اند (وارونگیِ «قانون-اول» قدیم).
       ستون ۱/۴: حافظه و بستهٔ زمینه در voiceCore.js است؛ بعد از هر اجرا
         recordTurn() هر دو لَین را از یک حافظه تغذیه می‌کند.
       همیشه دقیقاً یک لَین — دوبار اجرا ساختاراً ناممکن است.
       ============================================================ */
    let vcText = cmd;
    try {
      if (window.AVACore) {
        const _vc = window.AVACore.prepare(cmd, {
          ai: aiConnected(),
          videoUrl: (typeof lastVideoUrl === 'string' && lastVideoUrl) ? lastVideoUrl : '',
          apps: (typeof sysApps !== 'undefined' && sysApps.list) ? sysApps.list.map((a) => AVACore.normFa(String(a.name || '')).toLowerCase()) : [],
        });
        vcText = _vc.text || cmd;
        if (_vc.resolved && _vc.resolved.length) {
          try { actLog('ctx-resolve: «' + cmd.slice(0, 48) + '» → «' + vcText.slice(0, 48) + '» (' + _vc.resolved.map((r) => r.domain + '=' + r.to).join(', ') + ')', 'ui', { ev: 'ctx', resolved: _vc.resolved }); } catch (_) { /* noop */ }
        }
        if (_vc.lane === 'brain' && aiConnected()) {
          /* v0.64 — لَینِ قطعیِ «بنویس»: فرمانِ خالصِ نوشتن هرگز به چتِ AI نمی‌رود
             (لاگ v0.51: «…بررسی می‌کنم برام بنویس» → AI فقط جواب حرف زد و هیچ
             چیزی تایپ نشد). فقط فرمانِ خالص: فعل نوشتن + محتوای قابل استخراج،
             بدون فعل پژوهشیِ دیگر و بدون سؤال. ترکیبی (اول تحقیق کن بعد بنویس)
             → مغز AI می‌رود (قانون ۱۲ پرامپت، آخرین act=type_once). */
          const _to = (typeof AVAIntent !== 'undefined' && AVAIntent.typeOnceOf) ? AVAIntent.typeOnceOf(vcText) : '';
          /* v0.69 — گاردِ متا/سؤال/دوفعل: «میشه دقیقا آدرسشو برام بنویسی» و
             «انگلیسی بنویسی جان جدت بنویس…» قبلاً لخت تایپ می‌شدند */
          const _pureType = !!_to
            && !/(سرچ|جستجو|پیدا|بگرد|تحلیل|بررسی|دنبال|بخون|ترجمه|خلاصه|تحقیق|پخش|اجرا|باز\s?کن|برو\s?به)/i.test(vcText)
            && !/[؟?]/.test(vcText)
            && !/(میشه|ممکنه|می\s?شه|فکر\s?کنم|اگه\s?میشه|اگر\s?میشه|برای\s?من\s?بنویسی|دقیق\s?بنویسی|دقیقا)/i.test(vcText)
            && !/(بنویس|بنویسی|بنیویس)[^.]{0,24}(بنویس|بنویسی|بنیویس)/i.test(vcText)
            && !/(انگلیسی|فارسی|لاتین)\s*(بنویس|بنویسی|بنیویس)|بنویس[^.]{0,12}(انگلیسی|فارسی|لاتین)/i.test(vcText);
          if (_pureType) {
            try { actLog('lane=type-once (deterministic): «' + vcText.slice(0, 60) + '»', 'ui', { ev: 'lane', lane: 'type-once', q: _to.slice(0, 60) }); } catch (_) { /* noop */ }
            _dispatchOutcome = 'type-once';
            const _typeRep = await typeOnceExec(_to);
            setState('success');
            statusText.textContent = t('status.done');
            rcTag.textContent = t('tag.done');
            typeText(rcReply, _typeRep);
            speak(_typeRep);
            pushHistory(cmd, true);
            try { if (window.AVACore) window.AVACore.recordTurn({ utterance: vcText, via: 'type-once', intent: 'type_once', reply: _typeRep }); } catch (_) { /* noop */ }
            cmdBusy = false;
            setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 2600);
            return;
          }
          try { actLog('lane=brain (direct-AI, reason=' + _vc.reason + '): «' + vcText.slice(0, 60) + '»', 'ui', { ev: 'lane', lane: 'brain', reason: _vc.reason }); } catch (_) { /* noop */ }
          _dispatchOutcome = 'ai-brain';
          /* v0.69 — حاشیه‌های ارجاع فقط به مغز می‌چسبند (جملهٔ اصلی دست‌نخورده برای لاین‌های قطعی) */
          const _hints = (_vc && _vc.hints && _vc.hints.length) ? ' (' + _vc.hints.join('؛ ') + ')' : '';
          await aiHandleCommand(vcText + _hints, await aiBrainCtx());
          return;
        }
      }
    } catch (_) { vcText = cmd; } /* هستهٔ فهم هرگز نباید مسیر را بشکند */


    /* v0.43 — داوری نیت: همهٔ قوانین منطبق امتیاز می‌گیرند (لنگر/ممنوعه/
       تقویت‌کننده) و برندهٔ قاطع اجرا می‌شود؛ جملهٔ مبهم با نامزدها به AI
       می‌رود. ریشهٔ «دونه‌دونه فیکس کردن کامندها» همین‌جا حذف شد.
       v0.61 — این زنجیره فقط دو نقش دارد: لَین instant + فالبک آفلاینِ
       لَین brain — و روی متنِ ترمیم‌شده (vcText) کار می‌کند نه متن خام. */
    const _arbit = (typeof AVAIntent !== 'undefined') ? AVAIntent.arbitrate(vcText, RULES) : null;
    let rule = _arbit ? _arbit.rule : null;
    if (!rule) rule = findCustomRule(vcText);
    _intentCands = (typeof AVAIntent !== 'undefined') ? (AVAIntent.candidatesText(_arbit) || '') : '';
    /* نیت مبهم + AI در دسترس → اقدام حدسی ممنوع، داوری با AI */
    if (rule && _arbit && !_arbit.decisive && aiConnected()) {
      try { actLog('intent ambiguous → AI arbitration: ' + _arbit.ranked.slice(0, 3).map((x) => x.rule.id + '=' + Math.round(x.score)).join(',')); } catch (_) { /* noop */ }
      rule = null;
    }
    /* v0.44 — فهم-اول: جملهٔ دارای هدفِ حل‌نشدنی («توی دیوار دنبال موتور بگرد»،
       «برو به سایت همراه من») هرگز به جستجوی عمومی/بازکردن حدسی نمی‌رود؛
       تحلیل ساختاری + قانون به AI می‌رود تا «واقعاً بفهمد» هدف چیست.
       اگر AI قطع باشد، رفتار قبلی (حدس محلی) حفظ می‌شود تا کاربر بی‌جواب نماند. */
    if (rule && aiConnected() && typeof AVAUnderstand !== 'undefined') {
      try {
        const _und = AVAUnderstand.analyze(vcText);
        if (_und && AVAUnderstand.blocksBlindAction(_und, rule.id, targetResolvableWebSync)) {
          actLog('understand-first: «' + _und.target.clean + '» not locally resolvable → AI decides (no blind ' + rule.id + ')');
          _intentCands = AVAUnderstand.briefForAi(_und) + (_intentCands ? '\n' + _intentCands : '');
          rule = null;
        }
      } catch (_) { /* noop */ }
    }
    /* v0.49/v0.51 — گیت نوع جمله: سوال/تصحیح/چندمرحله‌ای/ارجاعی/بی‌فعلِ اجرا هرگز
       اکشنِ کور اجرا نمی‌کنند (ریشهٔ سه نشت لاگ v0.50: «مطمئنی اسم آهنگ…»،
       «…نازنین نیست»، «جدیدترین آهنگ شادمهر در ۲۰۲۶» — همگی open_music شدند).
       v0.51 = وارونگی بار اثبات: اجرای سریعِ خانوادهٔ اکشن فقط با فعلِ اجرای صریح. */
    if (rule && aiConnected() && typeof AVAIntent !== 'undefined' && AVAIntent.blocksActionRule && AVAIntent.blocksActionRule(vcText, rule.id)) {
      const _gt = (AVAIntent.gateReason ? AVAIntent.gateReason(vcText, rule.id) : AVAIntent.gateType(vcText)) || 'unknown';
      actLog('sentence-gate: «' + vcText.slice(0, 60) + '» → ' + _gt + ' → AI decides (no blind ' + (rule.id || '?') + ')', 'ui', { ev: 'gate', gtype: _gt, blocked: rule.id || '?' });
      rule = null;
    }
    if (!rule) {
      /* مرحله ۳ پایپ‌لاین: تطبیق فازی برنامه‌های سیستم («تلگرام رو اجرا کن»)
         اگر نیت باز کردن نبود یا برنامه پیدا نشد → هوش مصنوعی (مرحله ۴) */
      const appReply = await tryAppOpen(vcText);
      if (appReply) {
        setState('success');
        statusText.textContent = t('status.done');
        rcTag.textContent = t('tag.done');
        typeText(rcReply, appReply);
        speak(appReply);
        if (!/پیدا نکردم|not found/i.test(appReply)) playDoneSound(); /* v0.65 */
        pushHistory(cmd, !/پیدا نکردم|not found/i.test(appReply));
        try { if (window.AVACore) window.AVACore.recordTurn({ utterance: vcText, via: 'app-open', intent: 'open_app', reply: appReply }); } catch (_) { /* noop */ }
        /* v0.47 — B02: قفلِ busy بلافاصله آزاد شود */
        cmdBusy = false;
        _dispatchOutcome = 'app-open';
        setTimeout(() => {
          if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; }
        }, 2600);
        return;
      }
      if (aiConnected()) {
        /* فرمان شناخته نشد → هوش مصنوعی تحلیل و جواب می‌دهد
           v0.39 — کاتالوگ فرمان‌ها هم می‌چسبد تا AI درخواستِ با تعبیر متفاوت را
           به فرمان واقعی آوا نگاشت کند (act=run_cmd)
           v0.42 — عکسِ وضعیت (تایمرها/یادآوری‌ها/یادداشت‌ها/آخرین سایت) هم
           می‌چسبد تا AI «ذخیره‌شده‌های» کاربر را ببیند */
        _dispatchOutcome = 'ai';
        await aiHandleCommand(vcText, await aiFallbackCtx(null, vcText));
        return;
      }
    }
    /* v0.50 — ردِ گفت/فهمید: هر تصمیمِ تفسیرِ محلی در لاگ می‌ماند تا
       «چرا این کار را کرد؟» قابل دیباگ باشد (کرد = خط utterance total پایانی) */
    if (rule) {
      try {
        const _q = rule.arg ? rule.arg(vcText) : undefined;
        actLog('interpret: گفت «' + vcText.slice(0, 60) + '» | فهمید ' + (rule.id || 'custom') + (_q !== undefined ? ' q=«' + String(_q || '').slice(0, 60) + '»' : ''), 'ui', { ev: 'interpret', via: 'rule', id: rule.id || '', q: String(_q || '').slice(0, 120) });
      } catch (_) { /* noop */ }
    }
    _dispatchOutcome = rule ? ('rule:' + (rule.id || rule.t || '?')) : 'free-reply';
    let reply = rule ? await resolveReply(rule, vcText) : t('default.reply');
    /* v0.29.2 — قانونی که درخواست را فهمید ولی نتوانست انجام دهد (شهر پیدا
       نشد / شبکه / پارس ریاضی) → دیگر بن‌بست نیست؛ همان درخواست به تحلیل
       هوش مصنوعی می‌رود (گزارش کاربر: «ارجاع نمیده به ای آی») */
    if (reply && typeof reply === 'object' && reply.__aiFallback) {
      actLog('rule "' + ((rule && rule.t) || '?') + '" could not fulfill → AI fallback');
      /* v0.37 — __aiExtra: قانون راهنما فهرست توانایی‌های آوا را به AI می‌چسباند */
      if (aiConnected()) { _dispatchOutcome = 'rule-fallback-ai'; await aiHandleCommand(vcText, await aiFallbackCtx(rule, vcText)); return; }
      reply = t('weather.fail'); /* AI هم در دسترس نیست → پیام صادقانهٔ از پیش تعریف‌شده */
      rcTag.textContent = t('tag.reply');
    }
    if (!rule) rcTag.textContent = t('tag.reply');

    /* v0.47 — B02: پاسخ آماده شد → قفل busy همین‌جا آزاد شود، نه ۳ ثانیه بعد.
       تکرار سریع کاربر دیگر در پنجرهٔ مرده ساکت بلعیده نمی‌شود؛ فقط انیمیشن کارت ۵۰۰ms است */
    cmdBusy = false;
    setTimeout(() => {
      try {
        setState('success');
        statusText.textContent = t('status.done');
        typeText(rcReply, reply);
        speak(reply);
        if (!/انجام نشد|Could not|Couldn't|پیدا نشد|نشده/.test(String(reply))) playDoneSound(); /* v0.65 — فقط موفقیت */
        if (rule && rule.t) toast(rule.t, rule.i || '#i-info');
        /* v0.39 — پیشنهاد زمینه‌ای: کاربر درگیر یوتیوب/ویدیو/موسیقی بود → کارت فرمان‌ها */
        if (rule && rule.id && SUGGEST_TRIGGERS.has(rule.id)) maybeSuggestCommands('video');
        pushHistory(cmd, !/نشده|نمی‌شود|Failed/.test(rcTag.textContent || ''));
        /* v0.61 — ستون ۱: حافظهٔ گفتگو بعد از هر اجرای قانون تغذیه می‌شود */
        try {
          if (window.AVACore) window.AVACore.recordTurn({
            utterance: vcText, via: 'rule', intent: rule ? (rule.id || rule.t || '') : '',
            params: (rule && rule.arg) ? { q: String(rule.arg(vcText) || '').slice(0, 80) } : null,
            reply: String(reply || '').slice(0, 200),
          });
        } catch (_) { /* noop */ }
        handsFreeRearm();
      } catch (e) {
        /* v0.47 — B03: استثنای مسیر پاسخ هرگز بی‌صدا دور ریخته نمی‌شود */
        try { actLog('reply path fail: ' + String((e && (e.stack || e.message)) || e).slice(0, 160)); } catch (_) { /* noop */ }
      }
      setTimeout(() => {
        if (state === 'success') {
          setState('idle');
          statusText.innerHTML = IDLE_HINT;
        }
      }, 2400);
    }, 500 + Math.random() * 300);
    } catch (err) {
      /* v0.38.1 — یک reject در قانون (شبکه/IPC) نباید میکروفن را ۴۵ ثانیه قفل کند
         v0.47 — B03: حالا صدادار هم هست — سکوت به‌جای صداقت ممنوع */
      actLog('command fail: ' + String((err && (err.stack || err.message)) || err).slice(0, 200));
      cmdBusy = false;
      setState('idle');
      statusText.innerHTML = IDLE_HINT;
      _dispatchOutcome = 'error';
      try { toast(t('cmd.fail'), '#i-info'); } catch (_) { /* noop */ }
      try { speak(t('cmd.fail')); } catch (_) { /* noop */ }
    }
  }

  /* ============================================================
     AVE3 — موتور مکالمهٔ صوتی آوا، نسل سوم (بازسازی کامل — v0.25)
     ------------------------------------------------------------
     درخواست کاربر: «مکالمه و گرفتن صدا هنوز مشکل دارد — از نو
     کامل بساز». این یک بازنویسی تمام‌عیار است، نه وصله:

     ۱) هر جلسهٔ گوش‌دادن دو مسیرِ موازی دارد:
        • مسیر زندهٔ وب: همان شنوندهٔ کرومیوم که در پیش‌نمایش کروم
          کاربر «خیلی خوب» جواب داد — متن لحظه‌ای
        • مسیر بافر: ضبط واقعی PCM از «لحظهٔ صفر» + VAD تطبیقی
     ۲) ⭐ «گوش دادن دوباره» وجود ندارد — ریشهٔ اصلی «گرفتن صدا»:
        قبلاً اگر موتور وب می‌مرد، گوش‌دادن از صفر شروع می‌شد و
        کاربر باید حرفش را دوباره می‌گفت. حالا همان صدایی که از
        اول ضبط شده، بی‌درنگ به موتورهای ابری می‌رود.
     ۳) پایان جمله را VAD (سکوت واقعی پس از گفتار) تصمیم می‌گیرد،
        نه انتظار برای «final» گوگل؛ متن میانی که ۷۵۰/۱۱۰۰ms ثابت
        بماند همان لحظه تحویل گرفته می‌شود (ارث v0.19).
     ۴) موتورهای ابری روی همان یک صدا مسابقهٔ موازی می‌دهند
        (سقف ۱۲ ثانیه برای هر موتور) — فیوز/چسبندگی سر جایش است.
     ============================================================ */
  const AVE_SIL_MS = 1200;   /* سکوتِ پایان جمله پس از گفتار (VAD) */
  const AVE_IDLE_MS = 8000;  /* اگر هیچ گفتاری نشنید */
  const AVE_MAX_MS = 22000;  /* سقف کل جلسهٔ گوش دادن */
  const RACE_MS = 12000;     /* سقف هر موتور ابری در مسابقه */
  let ave = null;            /* جلسهٔ جاری AVE3 */
  let aveEpoch = 0;          /* نسل جلسه — رویدادهای جلسهٔ قدیمی را می‌کشد */
  let rec = null, recActive = false; /* موتور وب جلسهٔ جاری */
  let webFailStreak = 0, demoNoticeShown = false;
  /* v0.24 — srBroken «مهر زمانی بنچ» است نه پرچم همیشگی: خطای اولیهٔ
     شبکه (مثلاً قبل از فعال شدن DNS) موتور وب را برای همیشه نمی‌کشد —
     بعد از ۹۰ ثانیه دوباره شانس می‌گیرد (مثل کروم) */
  let srBroken = 0;
  const SR_BENCH_MS = 60000; /* v0.66 — ۹۰→۶۰ ثانیه: دورهٔ «کرشدن» وب shorter (لاگ: ۹ بار بنچ ۹۰ثانیه‌ای) */
  const srUsable = () => !!SRC && (!srBroken || Date.now() > srBroken);
  const ASR_MODEL = 'glm-asr-2512';

  /* v0.27 — موتور آفلاین همیشه-کار (sherpa-onnx + Whisper int8 داخل ویندوز):
     بدون اینترنت، بدون فیلترینگ، بدون کلید — ضامن «همیشه کار کردن» صدا */
  let localStat = { installed: false, ready: false, downloading: false };
  /* v0.47 — B19: installed کافی است (لود تنبل با اولین stt:local) — بوت دیگر
     ~۲۰۰MB sync لود نمی‌کند (۱۸ بار «offline engine ready» در لاگ کاربر) */
  const localReady = () => !!(localStat.ready || localStat.installed);
  function updateOfflineCard() {
    const st = $('#offStatus'), bt = $('#offBtnTxt'), btn = $('#btnOfflineDl'), pr = $('#offProgress');
    if (!st || !bt || !btn) return;
    if (pr) pr.hidden = true;
    if (localStat.ready) {
      st.textContent = t('set.off.ready');
      bt.textContent = t('set.off.dl');
      btn.disabled = false;
    } else {
      st.textContent = t('set.off.getHint');
      bt.textContent = t('set.off.dl');
      btn.disabled = !!localStat.downloading;
    }
  }
  function setOffProgress(pct, stage) {
    const pr = $('#offProgress'), bar = $('#offBar'), st = $('#offStatus');
    if (!pr) return;
    if (!pct || pct <= 0 || pct >= 100) { if (pct >= 100 && st) st.textContent = t('set.off.extract'); return; }
    pr.hidden = false;
    if (bar) bar.style.width = Math.max(4, Math.min(100, pct)) + '%';
    if (st) st.textContent = stage === 'extract' ? t('set.off.extract') : t('set.off.progress', { x: faNum(Math.round(pct)) });
  }
  async function refreshLocalStatus() {
    if (!bridge || !bridge.stt || !bridge.stt.localStatus) return;
    try {
      const s = await bridge.stt.localStatus();
      localStat = { installed: !!s.installed, ready: !!s.ready, downloading: !!s.downloading };
    } catch (_) { /* noop */ }
    updateOfflineCard();
    refreshEngineUI();
    /* v0.29 — بستهٔ آفلاین تازه آماده شده و بیدارباش همیشگی روشن است؟ شروع کن
       v0.29.1 — wakeLoopStart خودش بستهٔ گمشده را دانلود می‌کند، پس فقط
       سوییچ را چک می‌کنیم (دیگر خاموشی بی‌صدا در نبود بسته رخ نمی‌دهد) */
    if (settings.wakeAlways && !wakeLoop) wakeLoopStart();
  }

  const googleReady = () => !!(bridge && bridge.stt && bridge.stt.google);
  /* v0.17 — موتورهای کلاس AI (الگوی typeo/iotype): ترنسکریپت با مدل هوش مصنوعی */
  const geminiSttReady = () => !!(bridge && bridge.stt && bridge.stt.gemini && settings.geminiKey);
  const whisperSttReady = () => !!(bridge && bridge.stt && bridge.stt.whisper && settings.whisperKey);

  function refreshEngineUI() {
    const eng = settings.sttEngine || 'auto';
    const webUsable = srUsable();
    if (eng === 'local' && localReady()) sbEngine.innerHTML = `<i class="dot ok"></i>${t('eng.local')}`;
    else if (webUsable && eng !== 'google' && eng !== 'glm' && eng !== 'gemini' && eng !== 'whisper' && eng !== 'local') sbEngine.innerHTML = `<i class="dot ok"></i>${t('eng.web')}`;
    else if (localReady() && eng !== 'web' && eng !== 'google' && eng !== 'glm' && eng !== 'gemini' && eng !== 'whisper') sbEngine.innerHTML = `<i class="dot ok"></i>${t('eng.local')}`;
    else if (geminiSttReady() && eng !== 'web' && eng !== 'glm' && eng !== 'google' && eng !== 'whisper' && eng !== 'local') sbEngine.innerHTML = `<i class="dot ok"></i>${t('eng.gemini')}`;
    else if (whisperSttReady() && eng !== 'web' && eng !== 'glm' && eng !== 'google' && eng !== 'gemini' && eng !== 'local') sbEngine.innerHTML = `<i class="dot ok"></i>${t('eng.whisper')}`;
    else if (googleReady() && eng !== 'web' && eng !== 'glm' && eng !== 'gemini' && eng !== 'whisper' && eng !== 'local') sbEngine.innerHTML = `<i class="dot ok"></i>${t('eng.google')}`;
    else if (glmReady() && eng !== 'web' && eng !== 'google' && eng !== 'gemini' && eng !== 'whisper' && eng !== 'local') sbEngine.innerHTML = `<i class="dot ok"></i>${t('eng.glm')}`;
    else if (settings.demoMode) sbEngine.innerHTML = `<i class="dot warn"></i>${t('eng.demo')}`;
    else sbEngine.innerHTML = `<i class="dot err"></i>${t('eng.none')}`;
  }

  /* زنجیرهٔ ابری (v0.17): جمنای → Whisper → GLM → گوگل رایگان
     موتور آفلاین ضعیف در نسخه ۰.۹ کامل حذف شده است.
     v0.21 — هوشمندی زنجیره: ۱) موتوری که آخرین بار جواب داد، اول امتحان می‌شود؛
     ۲) موتوری که ۲ بار پشت‌سرهم شکست خورد (کلید خراب/شبکهٔ بسته) ۳ دقیقه
     «فیوز» می‌شود و جلوی زنجیره نمی‌ایستد — این همان تأخیری بود که کاربر
     «نزدیک یک دقیقه» حس می‌کرد: هر بار از اول روی موتورِ مرده تلاش می‌شد. */
  const STT_LAST_KEY = 'avaSttLast';
  const STT_FUSE_KEY = 'avaSttFuse';
  const sttFuseGet = () => { try { return JSON.parse(localStorage.getItem(STT_FUSE_KEY) || '{}') || {}; } catch (_) { return {}; } };
  function sttMarkOk(eng) {
    try {
      localStorage.setItem(STT_LAST_KEY, String(eng));
      const f = sttFuseGet();
      if (f[eng]) { delete f[eng]; localStorage.setItem(STT_FUSE_KEY, JSON.stringify(f)); }
    } catch (_) { /* noop */ }
  }
  function sttMarkFail(eng) {
    try {
      const f = sttFuseGet();
      const e = f[eng] || { n: 0, until: 0 };
      e.n = (e.n || 0) + 1;
      e.until = e.n >= 2 ? Date.now() + 180000 : 0; /* ۲ بار شکست → ۳ دقیقه کنار */
      f[eng] = e;
      localStorage.setItem(STT_FUSE_KEY, JSON.stringify(f));
    } catch (_) { /* noop */ }
  }
  const sttBenched = (eng) => {
    const f = sttFuseGet();
    return !!(f[eng] && f[eng].until && f[eng].until > Date.now());
  };
  function buildCloudChain() {
    const eng = settings.sttEngine || 'auto';
    if (eng === 'gemini') return geminiSttReady() ? ['gemini'] : [];
    if (eng === 'whisper') return whisperSttReady() ? ['whisper'] : [];
    if (eng === 'glm') return glmReady() ? ['glm'] : [];
    if (eng === 'google') return googleReady() ? ['google'] : [];
    if (eng === 'local') return localReady() ? ['local'] : [];
    /* خودکار: سریع‌ترین‌ها جلو — v0.27: موتور آفلاین اول (همیشه جواب می‌دهد،
       ۲-۳ ثانیه، بدون اینترنت)؛ بعد Whisper (Groq) و گوگل رایگان ۲-۵ ثانیه‌ای؛
       GLM و Gemini آخر (دقیق‌ترین ولی کندترین/وابسته به شبکه) */
    let c = [];
    if (localReady()) c.push('local');
    if (whisperSttReady()) c.push('whisper');
    if (googleReady()) c.push('google');
    if (glmReady()) c.push('glm');
    if (geminiSttReady()) c.push('gemini');
    /* v0.21 — اگر فیوز همه را زده بود، همان ترتیب اصلی بماند */
    const live = c.filter((e) => !sttBenched(e));
    if (live.length) c = live;
    /* v0.21 — موتور کارا (آخرین موفق) اول */
    const lg = (() => { try { return localStorage.getItem(STT_LAST_KEY) || ''; } catch (_) { return ''; } })();
    const li = c.indexOf(lg);
    if (li > 0) c.splice(0, 0, c.splice(li, 1)[0]);
    return c;
  }
  function resolveEngine() {
    const eng = settings.sttEngine || 'auto';
    if (eng === 'web') return srUsable() ? 'web' : null;
    if (eng === 'local') return localReady() ? 'local' : null;
    if (eng === 'gemini' || eng === 'whisper' || eng === 'glm' || eng === 'google') return buildCloudChain()[0] || null;
    /* خودکار: اول وب (فوری و زنده)، بعد آفلاین/ابری */
    if (srUsable()) return 'web';
    return buildCloudChain()[0] || null;
  }

  /* ============================ AVE3 هسته ============================ */

  /* شروع جلسه: دو مسیر موازی (وب زنده + بافر PCM) */
  function aveStart() {
    aveEpoch += 1;
    const myEpoch = aveEpoch;
    setState('listening');
    body.classList.remove('has-card');
    respCard.classList.remove('show');
    sbMic.innerHTML = `<i class="dot rec"></i>${t('mic.rec')}`;
    setLiveText(t('live.on'));
    stopGoogleSpeak(); /* اگر آوا مشغول حرف زدن بود ساکت شود تا گوش دهد */
    if (audioCtx && audioCtx.state === 'suspended') { try { audioCtx.resume(); } catch (_) { /* noop */ } }
    const eng = settings.sttEngine || 'auto';
    const chain = buildCloudChain();
    const webOn = (eng === 'auto' || eng === 'web') && srUsable();
    ave = {
      myEpoch, chain, webOn,
      delivered: false, srLive: false, srGotText: '', srFinal: '',
      lastTxt: '', lastAt: 0, graceN: 0,
      chunks: [], spoke: false, lastVoice: 0, started: 0, maxRms: 0, floor: 0.006,
      proc: null, srcNode: null, sink: null,
      tVad: null, tStable: null, tGrace: null,
    };
    attachMic().then((ok) => {
      if (myEpoch !== aveEpoch) return; /* جلسه عوض شد */
      if (!ok) { ave = null; rec = null; recActive = false; noEngine(t('stt.micMissing')); return; }
      if (webOn) aveTrackA(myEpoch);
      else if (chain.length) statusText.textContent = t('status.googleListen');
      aveTrackB(myEpoch);
      /* کمربند امنیتی: اگر همه‌چیز گم شد، ۳۵ ثانیه بعد حالت اول */
      listenTimer = setTimeout(() => {
        if (state === 'listening') { aveStopSession(); setLiveText(''); statusText.innerHTML = IDLE_HINT; }
      }, 35000);
    });
  }

  /* برش سریع فقط برای فرمان‌های کامل‌نما (ارث v0.19) */
  const QUICK_CMD_RE = /^(باز\s?کن|اجرا\s?کن|روشن\s?کن|خاموش\s?کن|ریستارت|کامپیوتر\s?(رو\s?)?(بخوابون|خاموش)|پخش|پاز|آهنگ\s?(بعدی|قبلی)|موزیک|مدیای|بلند\s?تر|کم\s?تر|میوت|بی\s?صدا|تنظیم\s?دی\s?ان\s?اس|دی\s?ان\s?اس|زنگ\s?بزن|تماس\s?بگیر|قطع\s?کن|یادم\s?بنداز|ساعت\s?چند|چند\s?ساعت|تاریخ|باتری|اسکرین\s?شات|قفل\s?کن|مانیتور\s?رو|پینگ)/i;

  /* بازخورد زنده: متن شنیده‌شده همان لحظه در کارت پاسخ + زیر دکمه */
  function aveLiveHeard(txt) {
    if (dictation.active) { dictInterim.textContent = txt; return; }
    hideWakeDropCard(); /* v0.27.1 — کارت قبلی پاک شود تا متن زنده دیده شود */
    statusText.textContent = t('status.heard', { x: txt });
    setLiveText(txt);
    rcTag.textContent = t('tag.heard');
    rcHeard.textContent = `«${txt}»`;
    if (!respCard.classList.contains('show')) { body.classList.add('has-card'); respCard.classList.add('show'); }
  }

  /* مسیر زندهٔ وب — همان شنوندهٔ کروم؛ ⚠ اگر مرد، هیچ‌کس «دوباره گوش
     نمی‌دهد»: بافرِ مسیر B خودش فالبک است و کاربر چیزی را تکرار نمی‌کند */
  function aveTrackA(myEpoch) {
    const ut0 = Date.now();
    const r = new SRC();
    r.lang = settings.sttLang || 'fa-IR';
    r.interimResults = true;
    r.continuous = false;
    rec = r; recActive = true;
    r.onresult = (e) => {
      if (!ave || ave.myEpoch !== myEpoch || ave.delivered) return;
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const tr = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += tr; else interim += tr;
      }
      const txt = (final || interim).trim();
      if (txt && !ave.srGotText) {
        ave.srGotText = txt;
        webFailStreak = 0; /* موتور وب زنده است */
        actLog('stt web first-result ' + (Date.now() - ut0) + 'ms');
      }
      if (txt) aveLiveHeard(txt);
      if (final) { ave.srFinal = final.trim(); aveDeliver(ave.srFinal, 'web-final', myEpoch); return; }
      if (interim) {
        const tr2 = interim.trim();
        const nowT = Date.now();
        if (tr2 !== ave.lastTxt) {
          ave.lastTxt = tr2; ave.lastAt = nowT;
          clearTimeout(ave.tStable);
          const isQuick = QUICK_CMD_RE.test(tr2) && tr2.length >= 9 && tr2.length <= 60;
          ave.tStable = setTimeout(() => {
            /* برش زودهنگام: متن ثابت مانده + VAD گفتار دیده (یا جملهٔ بلندتر از روای خیالی) */
            if (ave && ave.myEpoch === myEpoch && !ave.delivered && tr2 && (ave.spoke || tr2.length >= 12)) aveDeliver(tr2, 'web-stable', myEpoch);
          }, isQuick ? 750 : 1100);
        }
      }
    };
    r.onerror = (e) => {
      if (!ave || ave.myEpoch !== myEpoch) return;
      actLog('stt web error: ' + e.error);
      ave.srLive = false;
      recActive = false;
      if (['network', 'not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'].includes(e.error)) {
        webFailStreak += 1;
        if (webFailStreak >= 2) {
          srBroken = Date.now() + SR_BENCH_MS; /* بنچ ۹۰ ثانیه‌ای (v0.24) */
          webFailStreak = 0;
          refreshEngineUI();
          actLog('stt web benched 90s (2 fails) — will re-probe automatically');
        }
        if (state === 'listening') statusText.textContent = t('stt.webFail');
      }
    };
    r.onend = () => {
      if (!ave || ave.myEpoch !== myEpoch) return;
      recActive = false;
      /* گوگل جلسه را بست: متن مستابل موجود؟ همین حالا تحویل — وگرنه
         VAD/بافر ادامه می‌دهد (بدون شروع دوبارهٔ گوش دادن) */
      if (!ave.delivered && ave.lastTxt && (ave.spoke || ave.lastTxt.length >= 12)) aveDeliver(ave.lastTxt, 'web-onend', myEpoch);
    };
    try { r.start(); ave.srLive = true; statusText.textContent = t('status.listening'); }
    catch (_) {
      actLog('stt web start failed — buffer path stays armed (no re-listen)');
      ave.srLive = false; recActive = false;
      webFailStreak += 1;
      if (webFailStreak >= 2) { srBroken = Date.now() + SR_BENCH_MS; webFailStreak = 0; refreshEngineUI(); }
      if (ave.chain.length) statusText.textContent = t('stt.webFail');
    }
  }

  /* --- ابزار صوتی خالص (ارث نسخه‌های قبل — بدون وابستگی) --- */
  function downsampleF32(f32, from, to) {
    if (from === to) return f32;
    const ratio = from / to;
    const len = Math.max(1, Math.floor(f32.length / ratio));
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const pos = i * ratio;
      const i0 = Math.floor(pos);
      const frac = pos - i0;
      const s0 = f32[i0] || 0;
      const s1 = f32[i0 + 1] || s0;
      out[i] = s0 + (s1 - s0) * frac;
    }
    return out;
  }

  function f32ToI16(f32) {
    const out = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      const v = Math.max(-1, Math.min(1, f32[i]));
      out[i] = v < 0 ? v * 32768 : v * 32767;
    }
    return out;
  }

  /* ساخت فایل WAV استاندارد از PCM خام */
  function pcmToWavBlob(pcm16, sampleRate) {
    const bytesPerSample = 2, numCh = 1;
    const dataSize = pcm16.length * bytesPerSample;
    const buf = new ArrayBuffer(44 + dataSize);
    const v = new DataView(buf);
    const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); v.setUint32(4, 36 + dataSize, true); ws(8, 'WAVE');
    ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, numCh, true);
    v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * numCh * bytesPerSample, true);
    v.setUint16(32, numCh * bytesPerSample, true); v.setUint16(34, 16, true);
    ws(36, 'data'); v.setUint32(40, dataSize, true);
    for (let i = 0; i < pcm16.length; i++) v.setInt16(44 + i * 2, pcm16[i], true);
    return new Blob([buf], { type: 'audio/wav' });
  }

  /* نرمال‌سازی بلندی صدا: میکروفون‌های کم‌صدا/دور را تقویت می‌کند */
  function normalizeLoudness(f32) {
    let sum = 0, n = 0;
    for (let i = 0; i < f32.length; i += 2) { sum += f32[i] * f32[i]; n++; }
    const rms = Math.sqrt(sum / Math.max(1, n));
    if (!isFinite(rms) || rms < 1e-5) return f32;
    const gain = Math.min(6, 0.035 / rms); /* هدف RMS حدود ۰٫۰۳۵ — حداکثر ×۶ */
    if (gain > 0.97 && gain < 1.03) return f32;
    const out = new Float32Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      const v = f32[i] * gain;
      out[i] = v > 1 ? 1 : v < -1 ? -1 : v;
    }
    return out;
  }

  /* مسیر بافر: ضبط PCM از لحظهٔ صفر + VAD تطبیقی — فالبکی که همیشه هست */
  function aveTrackB(myEpoch) {
    try {
      const src = audioCtx.createMediaStreamSource(micStream);
      const proc = audioCtx.createScriptProcessor(4096, 1, 1);
      const sink = audioCtx.createGain();
      sink.gain.value = 0; /* بی‌صدا — فقط برای پردازش */
      src.connect(proc); proc.connect(sink); sink.connect(audioCtx.destination);
      ave.srcNode = src; ave.proc = proc; ave.sink = sink;
      proc.onaudioprocess = (e) => aveOnFrame(myEpoch, e.inputBuffer.getChannelData(0));
      ave.started = Date.now();
      ave.tVad = setInterval(() => aveVadTick(myEpoch), 120);
    } catch (_) {
      actLog('stt buffer recorder failed');
      if (!ave || !ave.srLive) { ave = null; recActive = false; setState('idle'); noEngine(t('stt.startFail')); }
    }
  }

  function aveOnFrame(myEpoch, f) {
    if (!ave || ave.myEpoch !== myEpoch || ave.delivered) return;
    ave.chunks.push(new Float32Array(f));
    let sum = 0, n = 0;
    for (let i = 0; i < f.length; i += 4) { sum += f[i] * f[i]; n++; }
    const rms = Math.sqrt(sum / Math.max(1, n));
    if (rms > ave.maxRms) ave.maxRms = rms;
    /* آستانهٔ تطبیقی (ارث از نسخهٔ ۰.۱۰ که «صدا دریافت نشد» را فیکس کرد) */
    const thr = Math.max(0.005, Math.min(0.04, ave.floor * 2.2 + 0.0035));
    if (!ave.spoke) ave.floor = ave.floor * 0.92 + rms * 0.08;
    if (rms > thr) {
      if (!ave.spoke) {
        ave.spoke = true;
        if (state === 'listening' && !ave.srGotText) statusText.textContent = t('stt.heardLive');
      }
      ave.lastVoice = Date.now();
    }
  }

  /* تیک VAD: پایان جمله = سکوت واقعی پس از گفتار */
  function aveVadTick(myEpoch) {
    if (!ave || ave.myEpoch !== myEpoch || ave.delivered) return;
    const now = Date.now();
    const dur = now - (ave.started || now);
    if (ave.spoke && ave.lastVoice && now - ave.lastVoice >= AVE_SIL_MS) { aveFinalize(myEpoch, 'vad-silence'); return; }
    if (!ave.spoke && dur >= AVE_IDLE_MS) { aveFinalize(myEpoch, 'no-speech'); return; }
    if (dur >= AVE_MAX_MS) { aveFinalize(myEpoch, 'session-max'); return; }
  }

  /* تحویل نهایی متن — تک‌نقطهٔ خروج همهٔ مسیرها */
  function aveDeliver(txt, src, myEpoch) {
    if (!ave || ave.myEpoch !== myEpoch || ave.delivered) return;
    const s = String(txt || '').trim();
    if (!s) return;
    ave.delivered = true;
    clearTimeout(listenTimer);
    aveKillAudio();
    if (rec) { try { rec.onend = null; rec.stop(); } catch (_) { /* noop */ } }
    rec = null; recActive = false;
    actLog('stt final(' + src + '): ' + s.slice(0, 60));
    ave = null;
    setLiveText('');
    setState('idle');
    sbMic.innerHTML = `<i class="dot ok"></i>${t('mic.ready')}`;
    if (dictation.active) dictateHandle(s);
    else handleUtterance(s);
  }

  /* پایان جلسه بدون متن تحویل‌شده — تصمیم: متن وب آماده؟ بافر به ابر برود؟ */
  function aveFinalize(myEpoch, reason) {
    if (!ave || ave.myEpoch !== myEpoch || ave.delivered) return;
    const now = Date.now();
    if (ave.srFinal) { aveDeliver(ave.srFinal, 'web-final', myEpoch); return; }
    /* متن میانی خیلی تازه است؟ ۷۰۰ms مهلت برای final وب (فقط یک‌بار) */
    if (ave.lastTxt && now - ave.lastAt < 600 && !ave.graceN) {
      ave.graceN = 1;
      clearTimeout(ave.tGrace);
      ave.tGrace = setTimeout(() => { if (ave && ave.myEpoch === myEpoch && !ave.delivered) aveFinalize(myEpoch, reason + '+grace'); }, 700);
      return;
    }
    if (ave.lastTxt && ave.lastTxt.length >= 2 && (ave.spoke || ave.lastTxt.length >= 12)) { aveDeliver(ave.lastTxt, 'web-stable@' + reason, myEpoch); return; }
    /* وب زنده بود ولی از کل جمله هیچ نداد → موتور وب ناشنواست */
    if (ave.webOn && ave.srLive && !ave.srGotText) {
      webFailStreak += 1;
      if (webFailStreak >= 2) { srBroken = Date.now() + SR_BENCH_MS; webFailStreak = 0; refreshEngineUI(); actLog('stt web benched 90s (deaf, 2 fails)'); }
    }
    aveKillAudio();
    if (rec) { try { rec.onend = null; rec.stop(); } catch (_) { /* noop */ } }
    rec = null; recActive = false;
    const rate = (audioCtx && audioCtx.sampleRate) || 48000;
    const totalMs = (ave.chunks.length * 4096 * 1000) / rate;
    if (!ave.spoke || ave.maxRms < 0.0045 || totalMs < 350) {
      actLog('stt session end(' + reason + ') — no usable audio (maxRms=' + ave.maxRms.toFixed(4) + ', ' + Math.round(totalMs) + 'ms)');
      ave = null;
      statusText.textContent = t('status.silence');
      setTimeout(() => { if (state === 'listening' || state === 'processing') { setState('idle'); statusText.innerHTML = IDLE_HINT; sbMic.innerHTML = `<i class="dot ok"></i>${t('mic.ready')}`; } }, 1500);
      if (dictation.active) setTimeout(rearmDictation, 1500);
      return;
    }
    /* ⭐ ساخت WAV از همان صدای همیشه-ضبط‌شده + مسابقهٔ ابری — بدون گوش دادن دوباره */
    const merged = new Float32Array(ave.chunks.reduce((a, c) => a + c.length, 0));
    let off = 0;
    for (const c of ave.chunks) { merged.set(c, off); off += c.length; }
    const pcm16 = f32ToI16(normalizeLoudness(trimSilenceEdges(downsampleF32(merged, rate, 16000), 16000)));
    const wavBlob = pcmToWavBlob(pcm16, 16000);
    const sessChain = ave.chain;
    ave = null;
    setState('processing');
    aveCloudRace(myEpoch, wavBlob, pcm16, sessChain);
  }

  /* هیچ موتوری حق گیر کردن ندارد — سقف زمانی سخت هر موتور */
  const withEngTimeout = (pr, ms) => Promise.race([
    Promise.resolve(pr),
    new Promise((res) => setTimeout(() => res({ ok: false, error: 'timeout' }), ms)),
  ]);

  /* مسابقهٔ موازی موتورهای ابری روی همان یک صدا (ارث v0.23، سقف ۱۲s) */
  function aveCloudRace(myEpoch, wavBlob, pcm16, chain) {
    if (!chain.length) {
      setState('idle');
      statusText.innerHTML = t('stt.noEngine', { x: t('stt.noEngineApp') });
      sbMic.innerHTML = `<i class="dot ok"></i>${t('mic.ready')}`;
      if (dictation.active) setTimeout(rearmDictation, 1500);
      return;
    }
    statusText.textContent = t('stt.racing', { x: chain.map((e) => t('eng.' + e)).join(' + ') });
    const pcmBytes = new Uint8Array(pcm16.buffer);
    let won = false, fails = 0, lastErr = '';
    const isDead = () => aveEpoch !== myEpoch; /* لغو کاربر/جلسهٔ جدید → همهٔ نتایج باطل */
    const raceSettle = (eng, r, ms) => {
      if (won || isDead()) { actLog('stt ' + eng + ' late (' + ms + 'ms) — race already decided'); return; }
      if (r && r.ok && r.text) {
        const tx0 = String(r.text).trim();
        /* v0.40 — برندهٔ هذیانی برنده نیست: موتورهای دیرترِ ابری شانس می‌گیرند
           v0.47 — B06: نتیجهٔ junk دیگر موتور را بنچ نمی‌کند (قبلاً دو جملهٔ نویزی
           پشت‌سرهم موتور سالم را ۳ دقیقه کور می‌کرد — «stt web benched 90s (deaf…)») */
        if (!dictation.active && isJunkUtterance(tx0)) {
          actLog('stt ' + eng + ' junk/hallucination result (' + ms + 'ms) — skipped, waiting cloud');
          fails += 1;
          if (fails >= chain.length && !won && !isDead()) {
            actLog('stt all engines returned junk/hallucination — nothing dispatched');
            setState('idle');
            statusText.innerHTML = IDLE_HINT;
            sbMic.innerHTML = `<i class="dot ok"></i>${t('mic.ready')}`;
          }
          return;
        }
        /* v0.47 — B06: جملهٔ بلندِ فقط-محلی (رژیم توهم whisper-base) فرصت تأیید ابری می‌گیرد
           v0.66 — آستانهٔ ۶→۴ توکن و پنجرهٔ ۱.۴→۲.۲ ثانیه (لاگ v0.65: «قیم پیلی ربا سون آباد»
           = ۵ توکنِ زباله از whisper، زیرِ آستانه‌ماند و برنده شد؛ web هم ۱.۹s دیر رسید و
           پنجرهٔ ۱.۴s بسته بود) */
        const tokN = tx0.split(/\s+/).filter(Boolean).length;
        if (eng === 'local' && tokN >= 4 && chain.length > 1) {
          actLog('stt local long sentence (' + tokN + ' tokens) — 2.2s cloud corroboration window');
          setTimeout(() => {
            if (won || isDead()) return;
            won = true;
            sttMarkOk(eng);
            actLog('stt race winner=local (long sentence, no cloud corroboration arrived)');
            setState('idle');
            handleUtterance(tx0);
          }, 2200);
          return;
        }
        won = true;
        sttMarkOk(eng);
        actLog('stt race winner=' + eng + ' (' + ms + 'ms)');
        const tx = String(r.text).trim();
        setState('idle');
        if (dictation.active) dictateHandle(tx);
        else handleUtterance(tx);
        return;
      }
      fails += 1;
      if (r && r.error) lastErr = String(r.error);
      sttMarkFail(eng);
      actLog('stt ' + eng + ' fail (' + ms + 'ms)' + (r && r.error ? ' err=' + String(r.error).slice(0, 80) : ''));
      if (fails >= chain.length && !won && !isDead()) {
        setState('idle');
        statusText.textContent = t('stt.failAll', { x: (lastErr || '—').slice(0, 120) });
        sbMic.innerHTML = `<i class="dot ok"></i>${t('mic.ready')}`;
        /* v0.27 — راه‌حل قطعی وقتی هیچ موتوری جواب نداد: بستهٔ آفلاین */
        if (!localStat.installed) toast(t('stt.noPackHint'), '#i-info');
        else if (lastErr) toast(lastErr.slice(0, 150), '#i-info');
        if (dictation.active) setTimeout(rearmDictation, 1500);
      }
    };
    /* v0.47 — B08: gemini = موج دوم — لاگ کاربر: ده‌ها «stt gemini late (4-12s) —
       race already decided». gemini عملاً هرگز نمی‌برد ولی هر utterance شبکه
       می‌سوزاند. اگر موتورهای سریع دیگری در زنجیره‌اند، gemini فقط بعد از ۲.۵ ثانیه
       بدون برنده راه می‌افتد (موج دوم) — مگر آخرین موتورِ موفق خودش gemini باشد. */
    let lastOk = '';
    try { lastOk = localStorage.getItem(STT_LAST_KEY) || ''; } catch (_) { /* noop */ }
    chain.forEach((eng) => {
      const launch = () => {
        if (won || isDead()) return; /* برنده آمده/جلسه مرده — راه نیفت */
        const te0 = Date.now();
        const pr = (async () => {
          /* v0.27 — آفلاین: همان PCM ۱۶k، ۱۰۰٪ داخل ویندوز، بدون هیچ شبکه‌ای */
          if (eng === 'local') return bridge.stt.local({ pcm: pcmBytes, rate: 16000, lang: settings.sttLang || 'fa-IR' });
          if (eng === 'google') return bridge.stt.google({ pcm: pcmBytes, rate: 16000, key: settings.googleKey || '', lang: settings.sttLang || 'fa-IR' });
          const b = new Uint8Array(await wavBlob.arrayBuffer());
          if (b.length < 900) return { ok: false, error: 'short-audio' };
          if (eng === 'whisper') return bridge.stt.whisper({ buf: b, base: settings.whisperBase, key: settings.whisperKey, model: settings.whisperModel, lang: settings.sttLang || 'fa-IR' });
          if (eng === 'glm') return bridge.stt.transcribe({ buf: b, base: settings.glmBase, key: settings.glmKey, model: ASR_MODEL });
          if (eng === 'gemini') return bridge.stt.gemini({ buf: b, key: settings.geminiKey, model: settings.geminiModel, lang: settings.sttLang || 'fa-IR', base: settings.gemBase || '' });
          return { ok: false, error: 'unknown-engine' };
        })();
        withEngTimeout(pr, RACE_MS)
          .then((r) => raceSettle(eng, r, Date.now() - te0))
          .catch(() => raceSettle(eng, { ok: false, error: t('stt.connFail') }, Date.now() - te0));
      };
      if (eng === 'gemini' && chain.length > 1 && lastOk !== 'gemini') {
        setTimeout(launch, 2500); /* موج دوم */
      } else {
        launch();
      }
    });
  }

  /* قطع لایهٔ صدا/VAD (جلسه ممکن است ادامه یابد یا تمام شود) */
  function aveKillAudio() {
    if (!ave) return;
    clearInterval(ave.tVad); ave.tVad = null;
    clearTimeout(ave.tStable); ave.tStable = null;
    clearTimeout(ave.tGrace); ave.tGrace = null;
    clearTimeout(ave.tPttFlush); ave.tPttFlush = null; /* v0.60 (A8) — فلاش PTTِ کهنه جلسهٔ تازه را نمی‌کشد */
    try { if (ave.proc) ave.proc.disconnect(); } catch (_) { /* noop */ }
    try { if (ave.srcNode) ave.srcNode.disconnect(); } catch (_) { /* noop */ }
    try { if (ave.sink) ave.sink.disconnect(); } catch (_) { /* noop */ }
    ave.proc = ave.srcNode = ave.sink = null;
  }

  /* توقف کامل جلسه (دکمهٔ کاربر / سیستم) — هر رویداد در پرواز باطل می‌شود */
  function aveStopSession() {
    aveEpoch += 1;
    if (ave) { aveKillAudio(); ave = null; }
    if (rec) { try { rec.onend = null; rec.stop(); } catch (_) { /* noop */ } }
    rec = null; recActive = false;
    webFailStreak = 0;
    setState('idle');
  }

  function micRecMime() {
    if (typeof MediaRecorder === 'undefined') return '';
    for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']) {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m;
    }
    return '';
  }

  /* بریدن سکوت ابتدا/انتهای صدا → تشخیص سریع‌تر و دقیق‌تر */
  function trimSilenceEdges(f32, rate) {
    const win = Math.max(1, Math.floor(rate * 0.02));
    const loud = (i) => {
      let sum = 0;
      const end = Math.min(f32.length, i + win);
      for (let j = i; j < end; j++) sum += f32[j] * f32[j];
      return Math.sqrt(sum / Math.max(1, end - i));
    };
    let s = 0, e = f32.length;
    while (s < f32.length && loud(s) < 0.008) s += win;
    while (e - win > s && loud(e - win) < 0.008) e -= win;
    const pad = Math.floor(rate * 0.08);
    s = Math.max(0, s - pad);
    e = Math.min(f32.length, e + pad);
    if (e - s < rate * 0.2) return f32;
    return f32.slice(s, e);
  }

  /* ============================================================
     پردازش گفته‌ها + حالت بی‌دست (کلمه بیدارباش «آوا»)
     ============================================================ */

  /* v0.27.1 — فرمانِ شنیده‌شده بدون «آوا» دیگر بی‌صدا دور ریخته نمی‌شود:
     کارت «شنیدم — بی‌اجرا» + دکمهٔ اجرای یک‌کلیکی + خاموش‌کردن فیلتر.
     (ریشهٔ گزارش کاربر: «تایپ می‌کند ولی دوباره میره روی listening و
     درخواست اجرا نمی‌شود» — حالت بی‌دست + فیلتر بیدارباش) */
  let wakeDropCmd = '';
  function showWakeDropCard(text) {
    wakeDropCmd = String(text || '').trim();
    /* v0.47 — B04: drop در لاگ نامرئی بود (actLog نداشت) — دقیقاً همان «stt final»
       بی‌دنبالهٔ لاگ v0.46 (۰۷:۲۳:۲۶) که دیباگ را فلج کرد */
    actLog('wake drop (no wake word, session closed): «' + wakeDropCmd.slice(0, 60) + '» → actionable card');
    body.classList.add('has-card');
    respCard.classList.remove('show');
    void respCard.offsetWidth;
    respCard.classList.add('show');
    rcTag.textContent = t('wake.dropTag');
    rcHeard.textContent = `«${wakeDropCmd}»`;
    typeText(rcReply, t('wake.dropHint'));
    const w = $('#rcWakeActions');
    if (w) w.hidden = false;
  }
  function hideWakeDropCard() {
    const w = $('#rcWakeActions');
    if (w) w.hidden = true;
  }
  const btnWakeRun = $('#btnWakeRun');
  const btnWakeOff = $('#btnWakeOff');
  if (btnWakeRun) btnWakeRun.addEventListener('click', () => {
    const c = wakeDropCmd;
    hideWakeDropCard();
    wakeSessOpen(); /* اجرای همان فرمان + باز شدن حالت گفتگو برای ادامهٔ حرف‌ها */
    if (c) handleUtterance(c, { force: true }); /* اجرای همان فرمان بدون نیاز به «آوا» */
  });
  if (btnWakeOff) btnWakeOff.addEventListener('click', () => {
    settings.wakeWord = false;
    store.set('wakeWord', settings.wakeWord);
    updateHandsFreeUI();
    toast(t('wake.noWakeDone'), '#i-power');
    const c = wakeDropCmd;
    hideWakeDropCard();
    if (c) handleUtterance(c); /* فیلتر خاموش شد → بدون force هم اجرا می‌شود */
  });

  /* ============================================================
     v0.28 — حالت گفتگو سیری‌وار:
     کاربر یک بار «آوا» را صدا می‌زند → صدای بانمک + حالت گفتگو باز
     می‌شود و تا WAKE_SESS_MS میلی‌ثانیه (هر فرمان تمدید می‌شود)
     دیگر نیازی به تکرار اسم نیست — دقیقاً مثل سیری آیفون.
     ============================================================ */
  let wakeSessUntil = 0;
  let wakeSessTimer = 0;
  const WAKE_SESS_MS = 90000;
  /* v0.36 — «آبا/اوا» هم بیدارباش است (خواستهٔ کاربر: کلماتی مثل آبا هم فعال کند)
     v0.38.1 — variant های فازی هم به این RE اضافه شدند؛ قبلاً «آوه به علی زنگ بزن»
     بیدار می‌شد ولی دنبالهٔ فرمان دور ریخته می‌شد (WAKE_WORD_RE آن را نمی‌شناخت) */
  const WAKE_WORD_RE = /^\s*(هی\s+(?:آوا|اوا)|(?:آوا|اوا)(?:ی|یی|ی\s?جان|ی\s?جون|جان|جون)?|آوای|اوای|آبا|ابا|آوه|اوها|اوبا|اوب|آووا|اووا|اواو|اواا|آو|ava|awa)[\s،,:-]*(.*)$/i;
  /* v0.36 — تطبیق فازی بیدارباش: whisper گاهی «آوا» را «آبا/آوه/آو/اوها» می‌شنود؛
     موتور قبلی فقط زیررشتهٔ «اوا/آوا» را می‌دید و به‌سختی فعال می‌شد (گزارش کاربر:
     «به سختی کلمه ava یا اوا رو تشخیص میده...ولی خود دستیار بهتره»).
     «او» و «اوهِ» تنها عمداً فعال نمی‌شوند (واژهٔ خیلی رایج = بیدارباش کاذب). */
  const WAKE_ACCEPT = new Set(['آوا', 'اوا', 'آوای', 'اوای', 'آبا', 'ابا', 'آوه', 'اوها', 'آو', 'اوب', 'اواو', 'اووا', 'آووا', 'اواا', 'اوبا']);
  /* v0.46 — تطبیق به موتور سه‌لایهٔ voiceWake.js منتقل شد (دقیق + آوانگار +
     نامزد ابری). این پوششِ سازگاری قدیمی است: T1∪T2 بدون وضعیت تکرار.
     موتورِ کامل با nearMatch/tail در wakeCheck استفاده می‌شود. */
  function wakeHitText(txt) {
    if (typeof window !== 'undefined' && window.AVAWake && typeof wakeWordCfg === 'function') {
      const wm = AVAWake.match(txt, wakeWordCfg());
      return !!(wm.t1 || wm.near);
    }
    const s = normFaFull(txt).replace(/[\\|`^~]+/g, ' ');
    /* v0.38.1 — «java/جاوا» بیدارباش کاذب می‌ساخت (زیررشتهٔ ava)؛ اینک توکنِ کامل */
    if (/\b(?:ava|awa)\b/i.test(s)) return true;
    const toks = s.split(/[\s،,:؛;!?.\-]+/).filter(Boolean);
    for (const w of toks) {
      if (w.length < 2) continue;
      if (WAKE_ACCEPT.has(w)) return true;   /* آوا، آبا، آوه، آو، اوها… */
      /* مشتقات مجاز: آواجون/آوایی/اواجان… ولی «آواز/آوازه/آواری» هرگز!
         قبلاً پیشوند باز بود و آواز هم بیدار می‌کرد (گزارش کاربر) */
      if (/^(اوا|آوا)(ی|یی|ی\s?جان|ی\s?جون|جان|جون)?$/.test(w)) return true;
    }
    return false;
  }
  const wakeSessActive = () => Date.now() < wakeSessUntil;
  function wakeSessOpen() {
    wakeSessUntil = Date.now() + WAKE_SESS_MS;
    clearTimeout(wakeSessTimer);
    wakeSessTimer = setTimeout(() => {
      if (!wakeSessActive()) return;
      wakeSessUntil = 0;
      if (state === 'listening' && settings.handsFree && settings.wakeWord) {
        statusText.textContent = t('wake.sessExp');
        setTimeout(() => { if (state === 'listening') statusText.textContent = t('status.listening'); }, 2200);
      }
    }, WAKE_SESS_MS + 400);
  }
  function wakeSessExtend() {
    if (wakeSessActive()) wakeSessOpen();
  }
  /* صدای بانمک فعال‌شدن دستیار — v0.35 «چایم شیشه‌ای» سه‌نتی (می=E5، لا=A5،
     دوی=C#6) با هارمونیک ظریف و فیلتر ملایم — به‌جای دو بوق سادهٔ قبلی.
     هنوز هم بدون فایل صوتی و فقط WebAudio ساده (بدون ریسک SwiftShader) */
  function playWakeChime() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ac = playWakeChime._ac || (playWakeChime._ac = new AC());
      if (ac.state === 'suspended') { ac.resume().catch(() => { /* noop */ }); }
      const t0 = ac.currentTime + 0.03;
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 5200; lp.Q.value = 0.4;
      const master = ac.createGain();
      master.gain.setValueAtTime(0.9, t0);
      lp.connect(master); master.connect(ac.destination);
      /* سه نت بالاروندهٔ پنتاتونیک + هارمونیک اکتاو پایین‌تر برای گرما */
      [[659.25, 0.0, 0.34], [880.0, 0.09, 0.4], [1108.73, 0.18, 0.62]].forEach(([f, off, dur]) => {
        [[f, 'sine', 0.14], [f * 2, 'sine', 0.035], [f / 2, 'triangle', 0.05]].forEach(([ff, type, vol]) => {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.type = type;
          o.frequency.setValueAtTime(ff, t0 + off);
          g.gain.setValueAtTime(0.0001, t0 + off);
          g.gain.exponentialRampToValueAtTime(vol, t0 + off + 0.028);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + dur);
          o.connect(g); g.connect(lp);
          o.start(t0 + off); o.stop(t0 + off + dur + 0.08);
        });
      });
    } catch (_) { /* noop — هیچ‌وقت بوت را نکشد */ }
  }

  /* ============================================================
     v0.29 — بیدارباش همیشگی آفلاین («حتی وقتی میکروفون/گوش دادن فعال نیست»)
     ------------------------------------------------------------------
     معماری همان ایدهٔ trigger_word_detection و hey-siri است که کاربر فرستاد
     (هر دو پایتون‌اند و داخل الکترون اجرا نمی‌شوند؛ مدل آمادهٔ فارسی هم ندارند)
     — ولی با ابزار خودِ برنامه و ۱۰۰٪ داخل ویندوز:
       میکروفون با ScriptProcessor کم‌مصرف باز می‌ماند → VAD انرژی‌محور تطبیقی
       (همان ریاضی AVE3) گفتار را پیدا می‌کند → برشِ ~۲.۵ ثانیه‌ای به موتور
       محلی whisper (sherpa-onnx، همان بستهٔ آفلاین بدون دانلود جدید) می‌رود
       → اگر «آوا/اوا/ava» بود: صدای بانمک + جلسهٔ گفتگو + شروع گوش دادن.
     وقتی جلسهٔ گوش دادن فعال است حلقه خودش ساکت می‌شود (CPU صفر).
     ============================================================ */
  let wakeLoop = null;
  let wakeDlKicked = false; /* v0.29.1 — فقط یک بار دانلود خودکار بگیرد */
  let wakeDlLastTry = 0; /* v0.29.1 — cooldown دانلود خودکار */
  let wakeMicRetryT = 0;
  let wakeTestUntil = 0; /* v0.34 — پنجرهٔ تست بیدارباش از تنظیمات */
  /* v0.32 — گیت چهارم بیدارباش: صدای خودِ آوا. وقتی TTS در حال پخش است
     حلقه باید کر باشد — قبلاً در این فاصله state=idle بود و حلقه صدای
     خودش را می‌شنید (VAD انرژی‌محور فرق صدای بلندگو و میکروفون نمی‌فهمد)
     → بیدارباشِ کاذب/مصرف بی‌دلیل. هر دو مسیر TTS چک می‌شود. */
  function wakeTtsBusy() {
    try { if (window.speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending)) return true; } catch (_) { /* noop */ }
    return !!ttsAudioBusy();
  }
  function wakeLoopUsable() {
    return !!settings.wakeAlways && localReady() && !!(navigator.mediaDevices && (window.AudioContext || window.webkitAudioContext));
  }
  /* v0.46 — کلمهٔ بیدارباش فعال (قابل تغییر از تنظیمات یا فرمان صوتی) */
  function wakeWordCfg() {
    return (window.AVAWake && AVAWake.norm(settings.wakeWordText)) || 'اوا';
  }
  async function wakeLoopStart() {
    if (wakeLoop || !settings.wakeAlways) return;
    /* v0.29.1 — ریشهٔ «اپشن صدا زدن آوا رو روشن کردم ولی کار نمی‌کنه»:
       بستهٔ آفلاین نبود → سوییچ بی‌صدا خاموش می‌شد و هیچ توضیحی نمی‌داد!
       v0.34 — دیگر گره به بسته نیست: بدون بسته هم حلقه با VAD + تشخیص ابری
       شروع می‌شود؛ دانلود بسته در پس‌زمینه ادامه دارد و وقتی آماده شد
       موتور بیدارباش خودکار به حالت آفلاین می‌رود. */
    const engine = localReady() ? 'local' : 'cloud';
    if (engine === 'cloud') kickWakePackDownload();
    const ok = await attachMic();
    if (!ok) {
      /* v0.29.1 — میکروفون در دسترس نیست (اشغال/قطع) → سوییچ روشن می‌ماند،
         ۳۰ ثانیه بعد خودش دوباره تلاش می‌کند؛ دیگر خاموشی بی‌صدا نداریم */
      actLog('wake-always: mic unavailable — retry in 30s (toggle stays ON)');
      wakeHealthNote(t('wake.healthMic'));
      if (!wakeMicRetryT) wakeMicRetryT = setTimeout(() => { wakeMicRetryT = 0; if (settings.wakeAlways && !wakeLoop) wakeLoopStart(); }, 30000);
      return;
    }
    try {
      const src = audioCtx.createMediaStreamSource(micStream);
      const proc = audioCtx.createScriptProcessor(4096, 1, 1);
      const sink = audioCtx.createGain();
      sink.gain.value = 0; /* بی‌صدا — فقط پردازش */
      src.connect(proc); proc.connect(sink); sink.connect(audioCtx.destination);
      wakeLoop = { src, proc, sink, chunks: [], spoke: false, lastVoice: 0, floor: 0.006, busy: false, coolUntil: 0, tVad: 0, engine };
      proc.onaudioprocess = (e) => wakeOnFrame(e.inputBuffer.getChannelData(0));
      wakeLoop.tVad = setInterval(wakeVadTick, 150);
      actLog('wake-always loop started engine=' + engine);
      /* v0.35 — بیدارباش در مینیمایز/بازی: جلوگیری از suspend شدن اپ تا میکروفون
         حتی پشت بازی فول‌اسکرین هم زنده بماند (سوییچ‌های throttle هم در main ست شده‌اند) */
      try { if (bridge && bridge.system && bridge.system.wakePsb) bridge.system.wakePsb(true).catch(() => { /* noop */ }); } catch (_) { /* noop */ }
      toast(engine === 'local' ? t('toast.wakeAlwaysOn') : t('wake.alwaysCloudOn'), '#i-wave');
      wakeHealthNote(engine === 'local' ? t('wake.healthLocal') : t('wake.healthCloud'));
    } catch (e) {
      actLog('wake-always start failed: ' + String((e && e.message) || e).slice(0, 80));
      wakeLoop = null;
      wakeHealthNote(t('wake.healthFail', { x: String((e && e.message) || e).slice(0, 60) }));
    }
  }
  /* v0.34 — دانلود بسته در پس‌زمینه (بدون مسدود کردن حلقهٔ ابری) */
  function kickWakePackDownload() {
    if (wakeDlKicked || localStat.downloading) return;
    if (Date.now() - (wakeDlLastTry || 0) <= 90000) return;
    if (!(bridge && bridge.stt && bridge.stt.localDownload)) return;
    wakeDlLastTry = Date.now();
    wakeDlKicked = true;
    (async () => {
      try {
        toast(t('wake.alwaysPreparing'), '#i-wave');
        const r = await bridge.stt.localDownload().catch(() => ({ ok: false }));
        localStat.downloading = false;
        localStat.installed = !!(r && (r.ok || r.already));
        localStat.ready = !!(r && r.ready);
        actLog('wake-always: background pack download finished ok=' + !!(r && r.ok) + ' ready=' + !!(r && r.ready));
        try { updateOfflineCard(); refreshEngineUI(); } catch (_) { /* noop */ }
        /* بسته آماده شد → موتور بیدارباش به حالت آفلاین ارتقا می‌یابد */
        if (settings.wakeAlways && localReady() && wakeLoop && wakeLoop.engine === 'cloud') {
          wakeLoopStop();
          wakeLoopStart();
        }
      } catch (_) { /* دور بعد */ }
      finally { wakeDlKicked = false; }
    })();
  }
  /* v0.34 — سلامت بیدارباش: آخرین وضعیت + آخرین شنیده در تنظیمات دیده می‌شود */
  function wakeHealthNote(txt) {
    const el = $('#wakeHealth');
    if (el && txt) el.textContent = txt;
  }
  function wakeOnFrame(f) {
    if (!wakeLoop) return;
    wakeLoop.lastFrame = Date.now(); /* v0.32 — تپش قلب برای واتچ‌داگ خط لوله */
    /* حین جلسهٔ فعال گوش دادن/پردازش/صدای خود آوا/تایپ صوتی، بیدارباش کاملاً ساکت است
       v0.32 — wakeTtsBusy اضافه شد (ریشهٔ بیدارباشِ کاذب بعد از هر پاسخ بلند) */
    if (state === 'listening' || state === 'processing' || dictation.active || wakeTtsBusy()) { wakeLoop.chunks.length = 0; wakeLoop.spoke = false; return; }
    wakeLoop.chunks.push(new Float32Array(f));
    if (wakeLoop.chunks.length > 70) wakeLoop.chunks.shift(); /* v0.36 — سقف ~۶ ثانیه: پنجرهٔ بزرگ‌تر = «آوا»ی بریده‌تازه کمتر */
    let sum = 0, n = 0;
    for (let i = 0; i < f.length; i += 4) { sum += f[i] * f[i]; n++; }
    const rms = Math.sqrt(sum / Math.max(1, n));
    const thr = Math.max(0.005, Math.min(0.04, wakeLoop.floor * 2.2 + 0.0035));
    if (!wakeLoop.spoke) wakeLoop.floor = wakeLoop.floor * 0.92 + rms * 0.08;
    if (rms > thr) { wakeLoop.spoke = true; wakeLoop.lastVoice = Date.now(); }
  }
  function wakeVadTick() {
    if (!wakeLoop || wakeLoop.busy) return;
    if (state === 'listening' || state === 'processing' || dictation.active || wakeTtsBusy()) return;
    /* v0.32 — کانتکست معلق (خواب ویندوز/تغییر دستگاه) = حلقه زنده ولی کر —
     بدون resume هیچ فریمی نمی‌آید و کاربر فکر می‌کند بیدارباش کار نمی‌کند */
    if (audioCtx && audioCtx.state === 'suspended') { try { audioCtx.resume(); } catch (_) { /* noop */ } }
    /* v0.32 — واتچ‌داگ خط لوله: اگر ۴ ثانیه هیچ فریمی نرسید (مرگ ScriptProcessor
     یا ری‌ست درایور صدا) حلقه از نو ساخته می‌شود — سقف ۳ بار در دقیقه */
    if (wakeLoop.lastFrame && Date.now() - wakeLoop.lastFrame > 4000) {
      if (!wakeLoop.restarts) wakeLoop.restarts = [];
      wakeLoop.restarts = wakeLoop.restarts.filter((tt) => Date.now() - tt < 60000);
      if (wakeLoop.restarts.length < 3) {
        wakeLoop.restarts.push(Date.now());
        actLog('wake-always: no frames 4s — rebuilding loop (' + wakeLoop.restarts.length + '/3 per min)');
        wakeLoopStop();
        wakeLoopStart();
      }
      return;
    }
    const now = Date.now();
    if (now < wakeLoop.coolUntil) return;
    if (wakeLoop.spoke && wakeLoop.lastVoice && now - wakeLoop.lastVoice >= 650) wakeCheck();
  }
  async function wakeCheck() {
    const L = wakeLoop;
    if (!L || L.busy) return;
    L.busy = true;
    const buf = L.chunks; L.chunks = []; L.spoke = false;
    L.coolUntil = Date.now() + 800;
    try {
      if (buf.length < 5) return; /* خیلی کوتاه */
      /* v0.47 — B07: سقف نرخ decode — اتاق پرنویز (تلویزیون/بازی/فن) هر ~۱.۵s یک
         decode کامل whisper می‌ساخت (لاگ کاربر: هزاران «stt local ok (1s audio)»
         با خروجی نویز، CPU دائمی + whisper سنکرون در main process استاتر IPC می‌دهد).
         ۱۵ چک در دقیقه برای بیدارباش واقعی بیش از کافی است. */
      if (!wakeCheck._times) wakeCheck._times = [];
      const _nowC = Date.now();
      wakeCheck._times = wakeCheck._times.filter((t) => _nowC - t < 60000);
      if (wakeCheck._times.length >= 15) {
        if (_nowC - (wakeCheck._lastSkipLog || 0) > 30000) {
          wakeCheck._lastSkipLog = _nowC;
          actLog('wake-always: decode rate capped (15/min) — noisy environment cost cut');
        }
        return;
      }
      wakeCheck._times.push(_nowC);
      /* v0.47 — B07: گیت نسبت گفتار — پنجره‌ای که کمتر از ~۸٪ چانک‌های voiced دارد
         نویز خالص است؛ whisper روی آن فقط توهم تولید می‌کند (آبا/[صول]/"Q") */
      {
        const thrV = Math.max(0.004, L.floor * 1.8 + 0.0025);
        let voiced = 0;
        for (let i = 0; i < buf.length; i++) {
          const c = buf[i]; let sm = 0, nn = 0;
          for (let j = 0; j < c.length; j += 8) { sm += c[j] * c[j]; nn++; }
          if (Math.sqrt(sm / Math.max(1, nn)) > thrV) voiced++;
        }
        if (voiced < Math.max(2, Math.ceil(buf.length * 0.08))) return;
      }
      /* v0.36 — حذف سکوتِ سرِ صدا: whisper روی «آوا»ی بریده‌تازه خیلی دقیق‌تر است
         v0.46 — پیش‌نواز ۲ چانک (~۱۷۰ms): آغازِ نرمِ «آوا» (واکه) قبلاً زیر
         آستانهٔ VAD می‌ماند و حرف اول بریده می‌شد → whisper «با/وا»ی ناقص
         می‌شنید؛ گزارش کاربر: «خیلی سخت متوجه میشه» */
      let s0 = 0;
      const thrT = Math.max(0.004, L.floor * 1.8 + 0.0025);
      for (let i = 0; i < buf.length; i++) {
        const c = buf[i]; let sm = 0, nn = 0;
        for (let j = 0; j < c.length; j += 8) { sm += c[j] * c[j]; nn++; }
        if (Math.sqrt(sm / Math.max(1, nn)) > thrT) { s0 = Math.max(0, i - 2); break; }
      }
      const buf2 = s0 > 0 ? buf.slice(s0) : buf;
      const rate = (audioCtx && audioCtx.sampleRate) || 48000;
      const merged = new Float32Array(buf2.reduce((a, c) => a + c.length, 0));
      let off = 0;
      for (const c of buf2) { merged.set(c, off); off += c.length; }
      const pcm16 = f32ToI16(downsampleF32(merged, rate, 16000));
      if (pcm16.length < 4000) return;
      /* v0.34 — موتور تشخیص: بستهٔ آفلاین اگر هست محلی، وگرنه ابری (stt:google با
         همان PCM) — بیدارباش دیگر به دانلود ۸۰ مگی وابسته نیست */
      let r = null;
      if (localReady()) {
        /* v0.32 — مسابقه با موتور محلیِ جلسهٔ گوش دادن: اگر همان لحظه busy بود،
           قبلاً بیدارباش بی‌صدا گم می‌شد — حالا ۱.۲ ثانیه بعد با همان صدا دوباره */
        const tryStt = () => bridge.stt.local({ pcm: new Uint8Array(pcm16.buffer), rate: 16000, lang: settings.sttLang || 'fa-IR' });
        r = await tryStt().catch(() => null);
        if ((!r || r.ok === false) && /مشغول/.test(String((r && r.error) || ''))) {
          await new Promise((res) => setTimeout(res, 1200));
          r = await tryStt().catch(() => null);
        }
        /* v0.36 — فرصت دوم ابری: اگر آفلاین هیچ‌چیز نشنید (موتور ضعیف روی «آوا»ی
           کوتاه) همان برش به گوگل هم می‌رود — سقف یک‌بار در ۱۰ ثانیه برای مصرف */
        let txtL = String((r && r.text) || '').trim();
        if (!txtL && bridge && bridge.stt && bridge.stt.google && Date.now() - (L.lastCloudTry || 0) > 10000) {
          L.lastCloudTry = Date.now();
          const r2 = await bridge.stt.google({ pcm: new Uint8Array(pcm16.buffer), rate: 16000, lang: settings.sttLang || 'fa-IR' }).catch(() => null);
          if (r2 && r2.ok && String(r2.text || '').trim()) { r = r2; actLog('wake-always: cloud 2nd chance used'); }
        }
      } else if (bridge && bridge.stt && bridge.stt.google) {
        r = await bridge.stt.google({ pcm: new Uint8Array(pcm16.buffer), rate: 16000, lang: settings.sttLang || 'fa-IR' }).catch(() => null);
        if (r && r.ok === false) actLog('wake-always cloud check fail: ' + String(r.error || '').slice(0, 60));
      }
      const txt = String((r && r.text) || '').trim();
      /* ============================================================
         v0.46 — مغز سه‌لایهٔ بیدارباش (گزارش کاربر: «کلمهٔ ویکورد وقتی
         میگم خیلی سخت متوجه میشه چون از آفلاین استفاده می‌کنه»)
         لایه‌ها در voiceWake.js — با اسکلت آوایی (واحد لب‌سانی و/ب/ف/پ،
         حذف ه/ح، فروپاشی تکرارها) هر تلفظ واقعی whisper را می‌گیرد:
           T1 دقیق      → آوا/اوا/آبا/اوا جان/ava … بیدار فوری + دنبالهٔ فرمان
           T2 آوانگار   → او با، اوه با، حو با، اوبا … بیدار فوری
           T3 نامزد ابری→ پاو با، باو باو، اوربا … همان صدا به گوگل
                           (سقف زمانی) — یا دو نامزد در ۱۲ ثانیه (تکرار کاربر)
         + لاگ غیرتکراری و آمار دوره‌ای (سیلِ «[صول]» در لاگ کاربر)
         ============================================================ */
      L.stats = L.stats || { n: 0, heard: 0, near: 0, cloud: 0, wake: 0 };
      L.stats.n++;
      const wm = (window.AVAWake || { match: () => ({ t1: false, near: false, cloud: false, tail: '' }) }).match(txt, wakeWordCfg());
      const fresh = txt && txt !== (L.lastHeard || '');
      L.lastHeard = txt;
      if (txt && (wm.t1 || wm.near || wm.cloud || fresh)) {
        /* v0.49 — لاگ دایت: نویز محض («از از از»، «Q»، «[صرق]»…) فقط در آمار می‌رود؛
           سیلِ نویز پشتهٔ لاگ دستی کاربر را بی‌استفاده می‌کرد */
        const _toks = String(txt).trim().split(/[\s\u200C]+/);
        const _real = _toks.filter((tk) => tk.length > 1 && !/^(از|او|اوه|ایه|ای|آ|اِ|هوم|ببب|مه|تن|اون|این|ا|ه|ی|و|که|q|aba|ava)$/i.test(tk));
        /* v0.51 — نویز-دایت ۲ (لاگ v0.50: «راااااا…»، «اههههههه»، «ربما ربما
           ربما رب» هنوز تک‌خط لاگ می‌شدند):
           ۱) کش‌قاف حرفی (یک حرف ۳+ بار پشت‌سرهم) = صرفه/خنده/زمزمه، نه گفتار
           ۲) جملهٔ تک‌مفهومِ تکراری (بعد از فروپاشی تکرارها ≤۲ واژهٔ یکتا و
              یک واژه ۳+ بار) = همهمهٔ محیط */
        const _noRun = _toks.every((tk) => !/(.)\1{2,}/.test(tk));
        const _freq = {};
        for (const tk of _toks) { const c = tk.replace(/(.)\1+/g, '$1'); _freq[c] = (_freq[c] || 0) + 1; }
        const _uniq = Object.keys(_freq).length;
        const _repNoise = _uniq <= 2 && _toks.length >= 3 && Object.values(_freq).some((n) => n >= 3);
        if (!_noRun || _repNoise) { L.stats.noisy = (L.stats.noisy || 0) + 1; }
        else if (String(txt).trim().length >= 6 && _real.length >= 1) { actLog('wake-always heard: ' + txt.slice(0, 44)); L.stats.heard++; }
      }
      if (Date.now() - (L.statsAt || 0) > 600000) {
        actLog('wake stats (10min): checks=' + L.stats.n + ' heard=' + L.stats.heard + ' noisy=' + (L.stats.noisy || 0) + ' near=' + L.stats.near + ' cloud=' + L.stats.cloud + ' wakes=' + L.stats.wake);
        L.stats = { n: 0, heard: 0, noisy: 0, near: 0, cloud: 0, wake: 0 };
        L.statsAt = Date.now();
      }
      const wakeNow = (tail) => {
        L.stats.wake++;
        playWakeChime();
        wakeSessOpen();
        toast(t('wake.woke'), '#i-wave');
        statusText.textContent = t('wake.sessOn');
        L.coolUntil = Date.now() + 5000;
        /* v0.32 — سیری‌وار: «آوا به علی زنگ بزن» در یک نفس — فرمان بعد از اسم
           همان‌جا اجرا می‌شود؛ اگر فقط اسم بود، گوش دادن شروع می‌شود. */
        if (tail && tail.length > 3) {
          actLog('wake-always: one-breath command → ' + tail.slice(0, 60));
          wakePickup(tail);
        } else {
          wakePickup('');
        }
      };
      /* تأیید ابری T3 — همان برش صوتی به گوگل؛ سقف ۸ ثانیه + امضای برش ۶۰ ثانیه */
      const cloudVerify = async (why) => {
        if (!(bridge && bridge.stt && bridge.stt.google)) return;
        if (Date.now() - (L.lastCloudTry || 0) < 8000) return;
        const sig = (txt || '').slice(0, 20);
        if ((L.lastCloudSig || '') === sig && Date.now() - (L.lastCloudSigAt || 0) < 60000) return;
        L.lastCloudTry = Date.now(); L.lastCloudSig = sig; L.lastCloudSigAt = Date.now();
        L.stats.cloud++;
        const r3 = await bridge.stt.google({ pcm: new Uint8Array(pcm16.buffer), rate: 16000, lang: settings.sttLang || 'fa-IR' }).catch(() => null);
        const t3 = String((r3 && r3.text) || '').trim();
        if (t3) actLog('wake-always cloud verify (' + why + '): ' + t3.slice(0, 40));
        const wm3 = (window.AVAWake || { match: () => ({}) }).match(t3, wakeWordCfg());
        if (wm3 && (wm3.t1 || wm3.near)) wakeNow(wm3.tail || '');
      };
      /* وضعیت سلامت: فقط رویدادهای معنادار (نه سیلِ نویز) — در حالت تست،
         خوردن/نخوردن همیشه صریح گفته می‌شود */
      if (txt && (wm.t1 || wm.near)) {
        const heardTxt = t('wake.healthLast', { x: txt.slice(0, 30) });
        if (Date.now() < wakeTestUntil) wakeHealthNote(t('wake.testOk'));
        else if (wakeLoop) wakeHealthNote((wakeLoop.engine === 'local' ? t('wake.healthLocal') : t('wake.healthCloud')) + ' — ' + heardTxt);
      } else if (txt && Date.now() < wakeTestUntil) {
        wakeHealthNote(t('wake.testMiss', { x: txt.slice(0, 30) }));
      }
      if (wm.t1) {
        wakeNow(wm.tail || '');
      } else if (wm.near) {
        L.stats.near++;
        L.nearHits = (L.nearHits || []).filter((ts) => Date.now() - ts < 12000);
        L.nearHits.push(Date.now());
        if (L.nearHits.length >= 2) {
          /* کاربر دارد تکرار می‌کند («آوا… آوا…») — تکرار = تأیید */
          wakeNow('');
        } else {
          cloudVerify('near').catch(() => { /* noop */ });
        }
      } else if (wm.cloud) {
        cloudVerify('miss').catch(() => { /* noop */ });
      }
    } catch (e) {
      actLog('wake-always check fail: ' + String((e && e.message) || e).slice(0, 80));
    } finally {
      L.busy = false;
    }
  }
  function wakeLoopStop() {
    if (wakeMicRetryT) { try { clearTimeout(wakeMicRetryT); } catch (_) { /* noop */ } wakeMicRetryT = 0; }
    try { if (bridge && bridge.system && bridge.system.wakePsb) bridge.system.wakePsb(false).catch(() => { /* noop */ }); } catch (_) { /* noop */ }
    if (!wakeLoop) return;
    try { clearInterval(wakeLoop.tVad); } catch (_) { /* noop */ }
    try { wakeLoop.proc.disconnect(); wakeLoop.src.disconnect(); wakeLoop.sink.disconnect(); } catch (_) { /* noop */ }
    wakeLoop = null;
    actLog('wake-always loop stopped');
  }
  /* v0.32 — برداختن جلسهٔ بیدارباش بدون گم‌شدن: اگر همین حالا فرمان قبلی/
     پخش صدا/تایپ صوتی در جریان است، شروع گوش دادن تا خلوت شدن صفحه عقب
     می‌افتد (تا ~۱۷ ثانیه؛ جلسهٔ ۹۰ ثانیه‌ای وقت دارد) — قبلاً «آوا» وقتی
     آوا مشغول حرف زدن بود شنیده می‌شد، جلسه باز می‌شد، startListening
     بی‌صدا رد می‌شد و بیدارباشِ مرده به نظر می‌رسید.
     با فرمان = اجرای همان فرمان در اولین فرصت، بدون فرمان = شروع گوش دادن. */
  function wakePickup(cmd) {
    let tries = 0;
    const run = () => {
      if (cmd) handleUtterance(cmd, { force: true });
      else startListening();
    };
    if (state === 'idle' && !wakeTtsBusy() && !dictation.active) { run(); return; }
    const tick = () => {
      tries++;
      if (!wakeSessActive()) return; /* جلسه تمام شد — دیگر هیچ */
      if (state === 'idle' && !wakeTtsBusy() && !dictation.active) { run(); return; }
      if (tries < 24) setTimeout(tick, 700);
    };
    setTimeout(tick, 700);
  }
  /* بوت: بعد از دانلود بستهٔ آفلاین هم اگر روشن باشد، حلقه شروع شود
     v0.29.1 — دیگر منتظر «بستهٔ موجود» نمی‌مانیم؛ wakeLoopStart خودش
     بسته را دانلود می‌کند — فقط یک نگاه ملایم در ۵ ثانیه برای اطمینان */
  function wakeBootRetry() {
    if (!settings.wakeAlways || wakeLoop) return;
    /* v0.34 — دیگر منتظر بستهٔ آفلاین نمی‌مانیم: حلقه ابری شروع می‌شود،
       بسته در پس‌زمینه دانلود و بعد خودکار ارتقا می‌یابد */
    wakeLoopStart();
  }

  /* ============================================================
     v0.40 — هوش ضد-هذیان STT (گزارش کاربر: «از از از از از…»)
     ------------------------------------------------------------
     whisper-base روی سکوت/نویز حلقهٔ تکرار توکن می‌سازد («از از از…»،
     «این این این…») و نویز را به شکل [صحر] / "Q" می‌نویسد. در لاگ کاربر
     یک جملهٔ هذیانی برندهٔ مسابقه شد، ۳۶ ثانیه هوش مصنوعی را سوزاند و
     خطای دروغین داد. این گارد: ۱) تکرار متوالی ≥۳ فرو می‌ریزد،
     ۲) جملهٔ تک‌واژهٔ بی‌معنی/براکت‌نویز = زباله، ۳) برندهٔ زباله در
     مسابقهٔ موتورها برنده نیست و منتظر موتور بهتر می‌ماند، ۴) زباله
     هرگز به هوش مصنوعی نمی‌رود.
     ============================================================ */
  function collapseRepeats(s) {
    const toks = String(s || '').trim().split(/\s+/).filter(Boolean);
    const out = [];
    for (const tk of toks) {
      if (out.length >= 2 && out[out.length - 1] === tk && out[out.length - 2] === tk) continue;
      out.push(tk);
    }
    return out.join(' ');
  }
  const STT_JUNK_WORDS = new Set(['از', 'او', 'اوه', 'ایه', 'ای', 'آ', 'اِ', 'هوم', 'ببب', 'مه', 'تن', 'اون', 'این', 'ا', 'ه', 'ی', 'و', 'که', 'aba', 'ava']);
  const STT_SHORT_OK = new Set(['سلام', 'هوا', 'ساعت', 'بای', 'جوک', 'توقف', 'پخش', 'درست', 'باشه', 'اوکی', 'خاموش', 'صدا', 'آوا', 'اوا', 'خوبی', 'چطوری', 'بردار', 'بشین', 'بله', 'اره', 'آره', 'نه', 'برو', 'ایست', 'ادامه']);
  function sttCleanNoise(s) {
    let t = String(s || '');
    t = t.replace(/[\[\]"“”«»'']/g, ' ');
    t = t.replace(/[.،؛!؟?…]+/g, ' ');
    return t.replace(/[\s\u200C]+/g, ' ').trim();
  }
  function isJunkUtterance(s) {
    /* v0.47 — B06: نرمال‌سازی اول — «اين» با یِ عربی قبلاً از فیلتر می‌گذشت
       (نرمال‌سازی سبک درجا — فیلتر self-contained می‌ماند) */
    let t = sttCleanNoise(String(s || '').toLowerCase()
      .replace(/[\u064A\u0649]/g, '\u06CC')
      .replace(/\u0643/g, '\u06A9')
      .replace(/\u200C/g, ' '));
    if (!t) return true;
    t = collapseRepeats(t);
    const toks = t.split(' ').filter(Boolean);
    if (!toks.length) return true;
    const mean = toks.filter((tk) => !STT_JUNK_WORDS.has(tk.toLowerCase()) && tk.length > 1);
    if (!mean.length) return true;
    if (mean.length === 1 && mean[0].length <= 4 && !STT_SHORT_OK.has(mean[0])) return true;
    return false;
  }

  async function handleUtterance(text, opts) {
    const h0 = Date.now(); /* v0.19 — لاگ تأخیر کل از شنیدن تا اجرا */
    let cmd = text;
    const wakeGate = settings.handsFree && settings.wakeWord && !dictation.active && !(opts && opts.force);
    if (wakeGate && !wakeSessActive()) {
      /* v0.46 — RE پویا از کلمهٔ بیدارباش فعال (قابل تغییر) ساخته می‌شود */
      const m = text.match(AVAWake.prefixRe(wakeWordCfg()));
      if (!m) {
        /* بدون کلمه بیدارباش → v0.27.1: کارت اقدام‌پذیر، نه دورریز بی‌صدا
           v0.28: پیام شفاهی یک‌بار در هر اجرا + کارت می‌ماند (ناپدید لحظه‌ای ندارد) */
        setState('idle');
        statusText.textContent = t('wake.need');
        showWakeDropCard(text);
        if (!handleUtterance._dropSpoken) {
          handleUtterance._dropSpoken = true; /* فقط یک بار در هر اجرای برنامه */
          try { speak(t('wake.dropSpoken')); } catch (_) { /* noop */ }
        }
        handsFreeRearm(2300); /* فرصت خواندن پیام — قبل از شروع دوبارهٔ گوش دادن */
        return;
      }
      /* «آوا» شنیده شد → صدای بانمک + باز شدن حالت گفتگو
         v0.46 — prefixRe گروه ۱ = دنبالهٔ فرمان (اسم بیدارباش non-capturing است) */
      wakeSessOpen();
      playWakeChime();
      cmd = String(m[1] || '').trim();
      if (!cmd) {
        setState('idle');
        statusText.textContent = t('wake.sessOn');
        /* v0.47 — B20: «بله؟» بدون شبکه — پیش‌فرض edge یک synth شبکه‌ای است؛
           برای بیدارِ تنها از صدای ویندوز (لوکال) استفاده می‌کنیم */
        try { speakWindows(t('wake.yes')); } catch (_) { try { speak(t('wake.yes')); } catch (_e) { /* noop */ } }
        handsFreeRearm(1600);
        return;
      }
    } else if (wakeGate && wakeSessActive()) {
      /* داخل حالت گفتگو: اسم لازم نیست — ولی اگر گفت، همان اول برداشته شود */
      const m = text.match(AVAWake.prefixRe(wakeWordCfg()));
      if (m && (m[1] || '').trim()) cmd = String(m[1] || '').trim();
    }
    /* v0.40 — گارد ضد-هذیان: زبالهٔ STT هرگز dispatch نمی‌شود (نه قوانین،
       نه هوش مصنوعی) — ریشهٔ «۳۶ ثانیه منتظر خطا ماند» در لاگ کاربر
       v0.47 — B06: قبل از دورریختن، تلاشِ wake داخل جمله چک می‌شود
       («او با» قبلاً junk بود و بیدارباش از دست می‌رفت) */
    if (!dictation.active && !(opts && opts.force) && isJunkUtterance(cmd)) {
      try {
        if (typeof AVAWake !== 'undefined' && typeof wakeWordCfg === 'function') {
          const wm = AVAWake.match(cmd, wakeWordCfg());
          if (wm && (wm.t1 || wm.near)) {
            actLog('wake-in-junk rescued: «' + String(cmd || '').slice(0, 40) + '»');
            wakeSessOpen();
            playWakeChime();
            handsFreeRearm(1600);
            _dispatchOutcome = 'wake-rescued';
            return;
          }
        }
      } catch (_) { /* noop */ }
      actLog('utterance junk dropped (hallucination/noise): ' + String(cmd || '').slice(0, 40));
      _dispatchOutcome = 'junk-drop';
      setState('idle');
      handsFreeRearm(900);
      return;
    }
    /* بازخورد فوری: متن شنیده‌شده همان لحظه در کارت پاسخ بنشیند */
    if (cmd && !dictation.active) {
      rcTag.textContent = t('tag.heard');
      rcHeard.textContent = `«${cmd}»`;
      if (!respCard.classList.contains('show')) { body.classList.add('has-card'); respCard.classList.add('show'); }
    }
    await runCommand(cmd, { wake: wakeGate });
    wakeSessExtend(); /* هر فرمان اجراشده، مدت گفتگو را تمدید می‌کند */
    /* v0.47 — B18: نتیجهٔ واقعی dispatch در لاگ می‌آید (rule/ai/busy/junk/…)
       v0.48 — + لاگ ساخت‌یافته (JSONL): ms و res به‌عنوان فیلد جداگانه */
    actLog(`utterance total ${Date.now() - h0}ms [${_dispatchOutcome || 'done'}]: ${cmd.slice(0, 60)}`, 'ui', { ev: 'utterance', ms: Date.now() - h0, res: _dispatchOutcome || 'done' });
  }

  /* در حالت بی‌دست، بعد از هر فرمان/خطا دوباره گوش می‌دهیم */
  function handsFreeRearm(delay) {
    if (!settings.handsFree) return;
    setTimeout(() => {
      if (!settings.handsFree) return;
      if (state !== 'idle') return;
      try {
        if (window.speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending)) {
          handsFreeRearm(); return; /* تا صدای خود آوا تمام شود */
        }
      } catch (_) { /* noop */ }
      if (ttsAudioBusy()) { handsFreeRearm(); return; } /* صدای گوگل هنوز در جریان است */
      startListening();
    }, Math.max(400, Number(delay) || 700));
  }

  function setHandsFree(on) {
    settings.handsFree = !!on;
    store.set('handsFree', settings.handsFree);
    updateHandsFreeUI();
    if (settings.handsFree) {
      toast(t('toast.hfOn'), '#i-wave');
      if (state === 'idle') startListening();
    } else {
      toast(t('toast.hfOff'), '#i-wave');
      if (state === 'listening') stopListening();
    }
  }

  function updateHandsFreeUI() {
    if (btnHandsFree) {
      btnHandsFree.classList.toggle('active', !!settings.handsFree);
      btnHandsFree.setAttribute('aria-pressed', settings.handsFree ? 'true' : 'false');
    }
    if (optHandsFree) optHandsFree.checked = !!settings.handsFree;
    if (optWakeWord) optWakeWord.checked = !!settings.wakeWord;
    const owa = $('#optWakeAlways'); if (owa) owa.checked = !!settings.wakeAlways;
    /* v0.46 — کلمهٔ بیدارباش قابل تغییر */
    const owwt = $('#optWakeWordText'); if (owwt) owwt.value = String(settings.wakeWordText || 'آوا');
    /* v0.66 — بجِ «کلمهٔ فعال الان»: هر تغییر (دستی/صوتی/AI) بلافاصله رویت است */
    const wwn = $('#wakeWordNow'); if (wwn) wwn.textContent = String(settings.wakeWordText || 'آوا');
  }

  /* ============================================================
     حالت تایپ صوتی (v0.8) — «آوا تایپ» شروع، «آوا تموم»/«قطع تایپ» پایان
     هر جمله‌ای که گفته شود در کادر تایپ نوشته می‌شود (یا با پیست
     در همان برنامه‌ای که باز است). علائم نگارشی صوتی + فرمان‌های
     سفارشی تعریف‌شدنی در تنظیمات.
     ============================================================ */
  const dictation = { active: false, busy: false, hwnd: 0, pid: 0, oneShotApps: false };
  /* v0.34 — پنجرهٔ فعالِ خارج از آوا: هنگام blur ثبت می‌شود تا «تایپ در برنامهٔ فعال»
     بداند کجا بنویسد؛ فرمان صوتی هم قبل از هر تمرکزگیری دوباره ثبت می‌کند */
  let lastFgHwnd = 0;
  let lastFgPid = 0;
  let lastFgAt = 0;
  let fgProbeBusy = false;
  let _probe = { hwnd: 0, pid: 0, self: false };
  function fgNow() { return { hwnd: _probe.hwnd, pid: _probe.pid, self: _probe.self }; }
  async function refreshFg() {
    if (fgProbeBusy || !bridge || !bridge.system || !bridge.system.saveFg) return fgNow();
    fgProbeBusy = true;
    try {
      const r = await bridge.system.saveFg();
      if (r && r.ok && r.hwnd) {
        if (r.self) {
          /* v0.64 — پنجرهٔ فعال خودِ آوا است؛ مقصدِ تایپ نیست و کشِ بیرونی
             دست نمی‌خورد (کاربر موقع گفتن فرمان معمولاً در برنامهٔ خودش است) */
          _probe = { hwnd: 0, pid: 0, self: true };
        } else {
          _probe = { hwnd: Number(r.hwnd) || 0, pid: Number(r.pid) || 0, self: false };
          lastFgHwnd = _probe.hwnd; lastFgPid = _probe.pid; lastFgAt = Date.now();
        }
      } else _probe = { hwnd: 0, pid: 0, self: false };
    } catch (_) { _probe = { hwnd: 0, pid: 0, self: false }; }
    fgProbeBusy = false;
    return fgNow();
  }
  /* v0.64 — کشِ تازه‌سنج: hwndی کهن‌تر از این عمر یعنی کاربر صفحه/برنامه را
     عوض کرده یا hwnd بازیافت شده — ریشهٔ «تایپ در صفحهٔ چت قدیمی» همین
     hwndِ منجمد بود که فقط لحظهٔ blur آوا ثبت می‌شد */
  function lastFgRecent(maxAge) {
    if (!lastFgHwnd || !lastFgAt) return null;
    if (Date.now() - lastFgAt > (maxAge || 45000)) return null;
    return { hwnd: lastFgHwnd, pid: lastFgPid };
  }
  window.addEventListener('blur', () => { setTimeout(() => { if (!document.hasFocus()) refreshFg(); }, 250); });
  window.addEventListener('focus', () => { lastFgHwnd = 0; lastFgPid = 0; lastFgAt = 0; _probe = { hwnd: 0, pid: 0, self: false }; });

  /* علائم نگارشی داخلی — کلمه‌ای که گفته شود همان علامت ثبت می‌شود
     زبان گفتار فارسی: علائم فارسی؛ زبان گفتار انگلیسی: علائم انگلیسی */
  const DICT_PUNCT = {
    'نقطه': '.', 'کاما': '،', 'ویرگول': '،', 'علامت سوال': '؟',
    'علامت تعجب': '!', 'دو نقطه': ':', 'نقطه ویرگول': '؛',
    'خط تیره': ' - ', 'پرانتز باز': ' (', 'پرانتز بسته': ') ',
    'گیومه': '«»',
  };
  const DICT_PUNCT_EN = {
    'period': '. ', 'full stop': '. ', 'dot': '.', 'comma': ', ',
    'question mark': '? ', 'exclamation mark': '! ', 'exclamation point': '! ',
    'colon': ': ', 'semicolon': '; ', 'hyphen': ' - ', 'dash': ' - ',
    'open parenthesis': ' (', 'close parenthesis': ') ',
    'open bracket': ' [', 'close bracket': '] ',
  };
  const DICT_ACTIONS = {
    'خط جدید': '\n', 'اینتر': '\n', 'برو خط بعد': '\n',
    'پاک کن': '__DEL__', 'پاک کردن': '__DEL__', 'پاک کردن همه': '__CLEAR__', 'همه رو پاک کن': '__CLEAR__',
  };
  const DICT_ACTIONS_EN = {
    'new line': '\n', 'newline': '\n', 'enter': '\n', 'next line': '\n',
    'delete last word': '__DEL__', 'delete word': '__DEL__',
    'clear all': '__CLEAR__', 'clear everything': '__CLEAR__',
  };
  const dictPunct = () => (settings.sttLang === 'en-US' ? DICT_PUNCT_EN : DICT_PUNCT);
  const dictActions = () => (settings.sttLang === 'en-US' ? DICT_ACTIONS_EN : DICT_ACTIONS);

  const DICT_STOP_RE = /([اآا]وا|ava)[\s\u200C]*\s*(تموم|تمام|کافیه|بس|پایان|قطع|خاموش).{0,6}(تایپ|دیکته)|(تموم|تمام|کافیه|بس|پایان|قطع|خاموش)[\s\u200C]*\s*(کن)?[\s\u200C]*\s*(تایپ|دیکته)|تایپ.{0,4}(تموم|تمام|قطع|پایان|کافیه|بسه|بس)|([اآا]وا|ava)[\s\u200C]*\s*(تموم|تمام|کافیه)/i;

  function normDictWord(w) {
    return String(w || '').toLowerCase()
      .replace(/\u064A/g, '\u06CC').replace(/\u0643/g, '\u06A9')
      .replace(/[\s\u200C]+/g, ' ').trim();
  }

  /* تبدیل گفته‌ها به متن: علائم نگارشی + فرمان‌های سفارشی کاربر */
  function applyTypingTokens(raw) {
    const words = String(raw || '').trim().split(/[\s\u200C]+/).filter(Boolean);
    let i = 0;
    let cleared = false;
    const dictBuf = () => dictBox.value;
    const appendToBuf = (s) => { dictBox.value += s; };
    const delLastWord = () => {
      const v = dictBox.value.replace(/\s+$/, '');
      const cut = Math.max(v.lastIndexOf(' '), v.lastIndexOf('\n'));
      dictBox.value = cut > 0 ? v.slice(0, cut) : '';
    };
    const applyValue = (val) => {
      if (val === '__DEL__') delLastWord();
      else if (val === '__CLEAR__') { dictBox.value = ''; cleared = true; }
      else appendToBuf((dictBuf() && !/[\s\n]$/.test(dictBuf()) ? ' ' : '') + val);
    };
    while (i < words.length) {
      let matched = false;
      /* فرمان‌های سفارشی کاربر — تطبیق n-گرمی (تا ۶ کلمه) */
      for (const tc of settings.typingCmds || []) {
        const ph = String(tc.phrase || '').trim().split(/[\s\u200C]+/).filter(Boolean);
        if (!ph.length) continue;
        if (words.length - i >= ph.length) {
          const seg = words.slice(i, i + ph.length).map(normDictWord).join(' ');
          if (seg === normDictWord(ph.join(' '))) {
            applyValue(String(tc.value || ''));
            i += ph.length;
            matched = true;
            break;
          }
        }
      }
      if (matched) continue;
      const w = normDictWord(words[i]);
      const two = words[i + 1] ? normDictWord(w + ' ' + normDictWord(words[i + 1])) : null;
      const PUNCT = dictPunct();
      const ACTIONS = dictActions();
      if (two && (ACTIONS[two] || PUNCT[two])) {
        applyValue(ACTIONS[two] || PUNCT[two]);
        i += 2;
        continue;
      }
      if (ACTIONS[w] || PUNCT[w]) {
        applyValue(ACTIONS[w] || PUNCT[w]);
        i += 1;
        continue;
      }
      appendToBuf((dictBuf() && !/[\s\n]$/.test(dictBuf()) ? ' ' : '') + words[i]);
      i += 1;
    }
    return { cleared };
  }

  function renderDictation() {
    dictInterim.textContent = '';
    dictStatus.textContent = t('dict.statusOn', { x: faNum(String(dictBox.value || '').length) });
  }

  /* حلقه تایپ: بعد از هر جمله دوباره گوش می‌دهیم */
  function rearmDictation() {
    if (!dictation.active) return;
    setTimeout(() => {
      if (!dictation.active || state !== 'idle') return;
      try {
        if (window.speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending)) { rearmDictation(); return; }
      } catch (_) { /* noop */ }
      if (ttsAudioBusy()) { rearmDictation(); return; }
      startListening();
    }, 350);
  }

  function dictateHandle(text) {
    const raw = String(text || '').trim();
    if (!raw) { rearmDictation(); return; }
    if (DICT_STOP_RE.test(raw)) { stopDictation(true); return; }
    /* state به idle برمی‌گردد تا حلقه گوش‌دادن دوباره شروع شود */
    setState('idle');
    const before = dictBox.value.length;
    applyTypingTokens(raw);
    const delta = dictBox.value.slice(before);
    renderDictation();
    /* خروجی در برنامهٔ فعال: v0.34 — موتور واقعی تایپ (SendInput UNICODE با
       فوکوس تاییدشده روی پنجرهٔ ثبت‌شده) — قبلی پیست Ctrl+V بود بدون بازیابی
       فوکوس و در پنجرهٔ اشتباه می‌نشست + کلیپ‌بورد کاربر را نابود می‌کرد */
    if ((settings.dictTarget === 'apps' || dictation.oneShotApps) && delta.trim() && bridge && bridge.system && bridge.system.typeText) {
      bridge.system.typeText(delta, dictation.hwnd || 0, dictation.pid || 0).then((r) => {
        if (!r || !r.ok) {
          actLog('type-into-app failed: ' + String((r && r.error) || 'fail').slice(0, 90));
          if (r && r.stale) {
            /* v0.64 — hwnd بازیافت/عوض شده؛ هرگز در پنجرهٔ اشتباه نمی‌نویسیم —
               از این‌جا مقصد «پنجرهٔ فعالِ لحظهٔ تایپ» می‌شود */
            dictation.hwnd = 0; dictation.pid = 0;
            dictation._staleAt = Date.now();
            toast('پنجرهٔ مقصد عوض شده یا بسته شده — از این به بعد در پنجرهٔ فعال می‌نویسم.', '#i-info');
            return;
          }
          if (!dictation._typeErrAt || Date.now() - dictation._typeErrAt > 10000) {
            dictation._typeErrAt = Date.now();
            toast((r && r.error) || t('dict.sysFail'), '#i-info');
          }
        }
      }).catch(() => { /* noop */ });
    }
    rearmDictation();
  }

  async function startDictation(system) {
    dictation.active = true;
    /* v0.34 — مقصد تایپ: اگر «برنامهٔ فعال» است، پنجرهٔ فعال همین حالا ثبت شود —
       قبل از هر تمرکزگیری؛ همان‌جایی که کاربر بود و می‌خواهد همان‌جا نوشته شود
       v0.64 — کاوشِ تازه + پینِ PID (hwndی منجمد = تایپ در صفحهٔ قدیمی) */
    dictation.oneShotApps = !!system && settings.dictTarget !== 'apps';
    dictation.hwnd = 0; dictation.pid = 0;
    if (settings.dictTarget === 'apps' || system) {
      let tgt = { hwnd: 0, pid: 0 };
      try { const f = await refreshFg(); if (f && f.hwnd && !f.self) tgt = { hwnd: f.hwnd, pid: f.pid }; } catch (_) { /* noop */ }
      if (!tgt.hwnd) { const c = lastFgRecent(45000); if (c) tgt = c; }
      dictation.hwnd = tgt.hwnd || 0; dictation.pid = tgt.pid || 0;
    }
    showView('dict');
    updateDictToggleUI();
    renderDictation();
    const sysOn = system || settings.dictTarget === 'apps';
    toast(sysOn ? t('dict.sysOn') : t('dict.on'), '#i-note');
    speak(sysOn ? t('dict.sysSpeak') : t('dict.onSpeak'));
    if (state === 'idle') startListening();
    else if (state === 'listening') { stopListening(); setTimeout(() => { if (dictation.active && state === 'idle') startListening(); }, 300); }
    else setTimeout(() => { if (dictation.active && state === 'idle') startListening(); }, 1500);
  }

  function stopDictation(voice = false) {
    dictation.active = false;
    dictation.oneShotApps = false;
    dictation.hwnd = 0; dictation.pid = 0;
    updateDictToggleUI();
    dictInterim.textContent = '';
    dictStatus.textContent = voice ? t('dict.offVoice') : t('dict.offSilent');
    if (state === 'listening') stopListening();
    toast(t('dict.off'), '#i-note');
    if (voice) speak(t('dict.stopSpoken'));
  }

  function updateDictToggleUI() {
    if (btnDictToggle) {
      btnDictToggle.classList.toggle('active', dictation.active);
      const sp = btnDictToggle.querySelector('span');
      if (sp) sp.textContent = dictation.active ? (LANG === 'en' ? 'Stop voice typing' : 'توقف تایپ صوتی') : t('dict.startBtn');
    }
    if (dictStatus && !dictation.active) dictStatus.textContent = t('dict.statusOff');
  }

  /* ============================================================
     v0.51 — دیکتهٔ یک‌باره: «اینجا بنویس "سلام خوبی"» / «ببین بنویس …» /
     «اینو تایپ کن …» — همان لحظه در برنامهٔ فعال نوشته می‌شود، بدون حالت
     مودار. تعبیر مهم نیست: هم مسیر محلی سریع (voiceIntent.typeOnceOf)
     داریم هم act هوشمند type_once برای هر تعبیر دیگری.
     موتور تایپ همان SendInput UNICODE با فوکوس تاییدشده است (v0.34).
     ============================================================ */
  async function typeOnceExec(text) {
    const txt = String(text || '').trim();
    if (!txt) return LANG === 'en' ? 'Nothing to type — say the text after "write".' : 'چیزی برای نوشتن نگفتی — بعد از «بنویس» متنش را بگو.';
    if (!bridge || !bridge.system || !bridge.system.typeText) return t('toast.onlyApp');
    /* v0.64 — مقصد = پنجرهٔ فعالِ «لحظهٔ فرمان» با کاوشِ تازه؛ hwndی منجمدِ
       blur-محور حذف شد (ریشهٔ «تایپ در صفحهٔ چت قدیمی»: کاربر از صفحهٔ قبلی
       به جدید رفته بود بدون آنکه از آوا رد شود). اگر کاوشِ تازه خودِ آوا بود،
       کشِ تازه‌سنجِ ۴۵ثانیه‌ای؛ اگر هیچ‌کدام نبود — خطای صادقانه، نه حدس. */
    let tgt = { hwnd: 0, pid: 0 };
    try {
      const f = await refreshFg();
      if (f && f.hwnd && !f.self) tgt = { hwnd: f.hwnd, pid: f.pid };
    } catch (_) { /* noop */ }
    if (!tgt.hwnd) { const c = lastFgRecent(45000); if (c) tgt = c; }
    if (!tgt.hwnd) {
      return LANG === 'en'
        ? 'I could not see which window to type into — click once inside the target app, then say "write" again.'
        : 'مقصد تایپ مشخص نشد — توی برنامهٔ مقصد یک‌بار کلیک کن و دوباره بگو «بنویس».';
    }
    try {
      const r = await bridge.system.typeText(txt, tgt.hwnd, tgt.pid || 0);
      if (r && r.ok) {
        actLog('type_once OK (' + txt.length + ' chars, hwnd=' + (tgt.hwnd || 0) + (r.pname ? ', dest=' + r.pname : '') + ')');
        return LANG === 'en'
          ? ('Typed it' + (r.pname ? ' into ' + r.pname : '') + '.')
          : ('نوشتم' + (r.pname ? ' توی ' + r.pname : '') + '.');
      }
      actLog('type_once failed: ' + String((r && r.error) || 'fail').slice(0, 90));
      return (r && r.error) || (LANG === 'en' ? "Couldn't type into the app." : 'تایپ در برنامه انجام نشد.');
    } catch (_) { /* noop */ }
    return LANG === 'en' ? "Couldn't type into the app." : 'تایپ در برنامه انجام نشد.';
  }

  /* ============================================================
     مدیریت DNS (v0.8) — پایگاه DNSهای معروف + پروفایل‌های نام‌دار
     بی‌نهایت، قابل ویرایش — اعمال واقعی با تأیید مدیر (UAC)
     فرمان صوتی: «دی ان اس جدید»، «دی اناس شماره ۱»، «دی ان اس الکترو»،
     «دی ان اس شکن»، «دی ان اس رو بردار»…
     ============================================================ */
  const DNS_BUILTIN = [
    { name: 'الکترو', ips: ['78.157.42.100', '78.157.42.101'], aliases: ['electro', 'alctro', 'الکترو'] },
    { name: 'شکن', ips: ['178.22.122.100', '185.51.200.2'], aliases: ['shecan', 'شکن'] },
    { name: 'بگوان', ips: ['185.55.226.26', '185.55.225.25'], aliases: ['begzar', 'بگوان'] },
    { name: '۴۰۳ آنلاین', ips: ['10.202.10.10', '10.202.10.11'], aliases: ['403', 'چهارصد و سه', 'ارباب حلقه‌ها'] },
    { name: 'رادار گیم', ips: ['10.202.10.202', '10.202.10.102'], aliases: ['radar', 'رادار', 'رادارگیم'] },
    { name: 'پیشگامان', ips: ['5.202.100.100', '5.202.100.101'], aliases: ['pishgaman', 'پیشگامان'] },
    { name: 'گوگل', ips: ['8.8.8.8', '8.8.4.4'], aliases: ['google'] },
    { name: 'کلادفلر', ips: ['1.1.1.1', '1.0.0.1'], aliases: ['cloudflare', 'کلاد فلر', 'کلودفلر'] },
    { name: 'کوآد۹', ips: ['9.9.9.9', '149.112.112.112'], aliases: ['quad9', 'کواد 9', 'کواد۹'] },
    { name: 'اُپن‌دی‌ان‌اس', ips: ['208.67.222.222', '208.67.220.220'], aliases: ['opendns', 'open dns'] },
    { name: 'آدانگارد', ips: ['94.140.14.14', '94.140.15.15'], aliases: ['adguard', 'ادگارد'] },
  ];

  const FA_ORD = { 'یک': 1, 'دو': 2, 'سه': 3, 'چهار': 4, 'پنج': 5, 'شش': 6, 'هفت': 7, 'هشت': 8, 'نه': 9, 'ده': 10, 'اول': 1, 'دوم': 2, 'سوم': 3 };

  const normDnsName = (s) =>
    String(s || '').toLowerCase()
      .replace(/[\u064A]/g, '\u06CC').replace(/[\u0643]/g, '\u06A9')
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/[\s\u200C_-]+/g, '')
      .replace(/[^a-z0-9\u0600-\u06FF]/g, '');

  function findDnsProfile(query) {
    const q = normDnsName(query);
    if (!q) return null;
    const all = [...settings.dnsProfiles, ...DNS_BUILTIN.map((b) => ({ ...b, builtin: true }))];
    let hit = all.find((p) => normDnsName(p.name) === q);
    if (hit) return hit;
    hit = all.find((p) => (p.aliases || []).some((a) => normDnsName(a) === q));
    if (hit) return hit;
    /* تطبیق جزئی: نام شامل عبارت یا برعکس */
    hit = all.find((p) => normDnsName(p.name).includes(q) && q.length >= 2);
    if (hit) return hit;
    hit = all.find((p) => (p.aliases || []).some((a) => normDnsName(a).includes(q) && q.length >= 2));
    return hit || null;
  }

  function ensureUserProfile(prof) {
    if (!prof) return null;
    const found = settings.dnsProfiles.find((p) => normDnsName(p.name) === normDnsName(prof.name));
    if (found) return found;
    const np = { id: Date.now(), name: prof.name, ips: [...(prof.ips || [])] };
    settings.dnsProfiles.push(np);
    store.set('dnsProfiles', settings.dnsProfiles);
    renderDnsProfiles();
    return np;
  }

  async function applyDnsIps(ips, label) {
    if (!bridge || !bridge.dns) {
      toast(t('dns.onlyApp'), '#i-info');
      return t('dns.onlyApp') + '.';
    }
    toast(t('dns.setVoice', { x: label }), '#i-info');
    const r = await bridge.dns.apply({ primary: ips[0], secondary: ips[1] || '' });
    if (r && r.ok) {
      return t('dns.applyOk', { x: label, y: faNum(ips.join(LANG === 'en' ? ' and ' : ' و ')) });
    }
    return (r && r.error) || t('dns.applyFail');
  }

  /* ============================================================
     فرم شیشه‌ای «DNS جدید» — داخل خود صفحه اصلی با انیمیشن (v0.10)
     همه‌چیز محو می‌شود، فرم با اسپرینگ بالا می‌آید، Enter ذخیره
     می‌کند، Esc/کنسل می‌بندد و بعد از ذخیره می‌تواند همان DNS را
     واقعاً روی ویندوز اعمال کند (UAC).
     ============================================================ */
  const dnsQuickEl = $('#dnsQuick');
  const dnsQuickForm = $('#dnsQuickForm');
  const dnsqName = $('#dnsqName');
  const dnsqP1 = $('#dnsqP1');
  const dnsqP2 = $('#dnsqP2');
  const dnsqApply = $('#dnsqApply');
  function openDnsQuickOverlay() {
    if (!dnsQuickEl) return;
    dnsQuickEl.hidden = false;
    document.body.classList.add('dnsq-open');
    dnsqName.value = '';
    dnsqP1.value = '';
    dnsqP2.value = '';
    setTimeout(() => dnsqName.focus(), 320);
  }
  function closeDnsQuickOverlay() {
    if (!dnsQuickEl || dnsQuickEl.hidden) return;
    const card = dnsQuickForm;
    card.classList.add('closing');
    document.body.classList.remove('dnsq-open');
    setTimeout(() => {
      dnsQuickEl.hidden = true;
      card.classList.remove('closing');
    }, 300);
  }
  async function saveDnsQuickOverlay() {
    const IP_OK = (v) => /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(v);
    const name = (dnsqName.value || '').trim().slice(0, 40);
    const p1 = (dnsqP1.value || '').trim();
    const p2 = (dnsqP2.value || '').trim();
    if (!name) { dnsQuickForm.classList.add('shake'); setTimeout(() => dnsQuickForm.classList.remove('shake'), 420); dnsqName.focus(); return; }
    if (!IP_OK(p1)) { dnsQuickForm.classList.add('shake'); setTimeout(() => dnsQuickForm.classList.remove('shake'), 420); dnsqP1.focus(); return; }
    if (p2 && !IP_OK(p2)) { dnsQuickForm.classList.add('shake'); setTimeout(() => dnsQuickForm.classList.remove('shake'), 420); dnsqP2.focus(); return; }
    const rec = { id: Date.now(), name, ips: p2 ? [p1, p2] : [p1] };
    settings.dnsProfiles.push(rec);
    store.set('dnsProfiles', settings.dnsProfiles);
    renderDnsProfiles();
    renderCustomChips();
    closeDnsQuickOverlay();
    toast(t('toast.dnsqSaved', { x: name }), '#i-shield');
    /* اعمال واقعی روی کامپیوتر — اگر کاربر خواسته باشد */
    if (dnsqApply.checked && bridge && bridge.dns) {
      await new Promise((res) => setTimeout(res, 380));
      const msg = await applyDnsIps(rec.ips, name);
      toast(msg, '#i-globe');
      refreshDnsCurrent();
    }
  }
  if (dnsQuickForm) {
    dnsQuickForm.addEventListener('submit', (e) => { e.preventDefault(); saveDnsQuickOverlay(); });
    $('#dnsqCancel').addEventListener('click', closeDnsQuickOverlay);
    $('#dnsqClose').addEventListener('click', closeDnsQuickOverlay);
    $('#dnsqBackdrop').addEventListener('click', closeDnsQuickOverlay);
  }

  /* پنجره کوچک «DNS جدید» (v0.10) — فرم شیشه‌ای داخل صفحه اصلی */
  function openDnsQuick() {
    openDnsQuickOverlay();
    return t('dns.openedForm');
  }

  /* ============================================================
     پاپ‌آپ پینگ DNSها (v0.13) — «آوا پینگ dns هامو نشون بده»
     لیست پروفایل‌های کاربر + DNSهای معروف پینگ می‌شوند، مرتب بر
     اساس سریع‌ترین؛ هر ردیف دکمه فعال‌سازی (UAC) دارد.
     ============================================================ */
  const dnsPingEl = $('#dnsPing');
  const dnsPingList = $('#dnsPingList');
  let dnsPingBusy = false;

  function pingTargets() {
    /* پروفایل‌های کاربر + معروف‌ها (بدون تکرار بر اساس نام) */
    const seen = new Set();
    const out = [];
    for (const p of [...settings.dnsProfiles, ...DNS_BUILTIN]) {
      const k = normDnsName(p.name);
      if (!k || seen.has(k) || !p.ips || !p.ips.length) continue;
      seen.add(k);
      out.push({ name: p.name, ips: p.ips });
    }
    return out;
  }

  function renderPingRow(p, state, ms) {
    const row = document.createElement('div');
    row.className = 'dnsp-row';
    row.dataset.name = p.name;
    let badge;
    if (state === 'wait') badge = `<span class="dnsp-ms wait">…</span>`;
    else if (state === 'ok') {
      const cls = ms <= 90 ? 'good' : ms <= 220 ? 'mid' : 'bad';
      badge = `<span class="dnsp-ms ${cls}">${faNum(ms)} ${LANG === 'en' ? 'ms' : 'ms'}</span>`;
    } else badge = `<span class="dnsp-ms bad">${t('dnsp.fail')}</span>`;
    row.innerHTML =
      `<span class="dnsp-name"><b></b><span></span></span>${badge}` +
      `<button type="button" class="chip sm dnsp-act"><svg class="ic"><use href="#i-power"/></svg><span></span></button>`;
    row.querySelector('.dnsp-name b').textContent = p.name;
    row.querySelector('.dnsp-name span').textContent = p.ips.join(' , ');
    const act = row.querySelector('.dnsp-act');
    act.querySelector('span').textContent = t('dnsp.activate');
    act.addEventListener('click', async () => {
      act.disabled = true;
      const msg = await applyDnsIps(p.ips, p.name);
      toast(msg, '#i-globe');
      refreshDnsCurrent();
      act.querySelector('span').textContent = t('dnsp.active');
      setTimeout(() => { act.disabled = false; act.querySelector('span').textContent = t('dnsp.activate'); }, 2600);
    });
    return row;
  }

  async function runDnsPing() {
    if (!dnsPingEl || dnsPingBusy) return { ok: false, error: '' };
    if (!bridge || !bridge.dns || !bridge.dns.ping) {
      openDnsPingOverlay();
      if (dnsPingList) dnsPingList.innerHTML = `<p class="dnsp-empty">${t('dnsp.onlyApp')}</p>`;
      return { ok: false, error: t('dnsp.onlyApp') };
    }
    const targets = pingTargets();
    openDnsPingOverlay();
    if (!targets.length) {
      if (dnsPingList) dnsPingList.innerHTML = `<p class="dnsp-empty">${t('dnsp.testing')}</p>`;
    }
    if (!targets.length) return { ok: false, error: t('dns.notFound', { x: '' }) };
    dnsPingBusy = true;
    if (dnsPingList) {
      dnsPingList.innerHTML = '';
      targets.forEach((p) => dnsPingList.appendChild(renderPingRow(p, 'wait')));
    }
    const r = await bridge.dns.ping(targets).catch(() => null);
    dnsPingBusy = false;
    if (dnsPingList) {
      dnsPingList.innerHTML = '';
      const res = (r && r.results) || [];
      res.forEach((x) => {
        const src = targets.find((p) => p.name === x.name);
        if (src) dnsPingList.appendChild(renderPingRow(src, x.ok ? 'ok' : 'fail', x.ms));
      });
      if (!res.length) dnsPingList.innerHTML = `<p class="dnsp-empty">${t('dnsp.testing')}</p>`;
    }
    return r || { ok: false, error: '' };
  }

  function openDnsPingOverlay() {
    if (!dnsPingEl) return;
    dnsPingEl.hidden = false;
    document.body.classList.add('dnsq-open');
  }
  function closeDnsPingOverlay() {
    if (!dnsPingEl || dnsPingEl.hidden) return;
    const card = dnsPingEl.querySelector('.dnsp-card');
    if (card) card.classList.add('closing');
    document.body.classList.remove('dnsq-open');
    setTimeout(() => {
      dnsPingEl.hidden = true;
      if (card) card.classList.remove('closing');
    }, 300);
  }
  if (dnsPingEl) {
    $('#dnspClose').addEventListener('click', closeDnsPingOverlay);
    $('#dnspBackdrop').addEventListener('click', closeDnsPingOverlay);
    $('#dnspRefresh').addEventListener('click', () => runDnsPing().catch(() => { /* noop */ }));
    const btnExtPing = $('#btnDnsPing');
    if (btnExtPing) btnExtPing.addEventListener('click', () => runDnsPing().catch(() => { /* noop */ }));
  }

  /* پاسخ صوتی پینگ: صفحه باز می‌شود + سریع‌ترین DNS اعلام می‌شود */
  async function pingVoiceReply() {
    if (!bridge || !bridge.dns || !bridge.dns.ping) {
      openDnsPingOverlay();
      if (dnsPingList) dnsPingList.innerHTML = `<p class="dnsp-empty">${t('dnsp.onlyApp')}</p>`;
      return t('dnsp.onlyApp') + '.';
    }
    const r = await runDnsPing();
    const res = (r && r.results) || [];
    const best = res.find((x) => x.ok);
    if (best) return t('dns.pingReply', { x: best.name, y: faNum(best.ms) });
    return t('dns.pingAllFail');
  }

  async function dnsHandle(cmd) {
    const n = normFa(cmd);
    /* باز کردن مدیر کامل DNS داخل تنظیمات (فقط از تنظیمات) */
    const openManager = (msg) => {
      showView('settings');
      showSettingsPane('ext');
      refreshDnsCurrent();
      return msg;
    };
    /* حذف/ریست به حالت خودکار */
    if (/بردار|خاموش|قطع\s*کن|حذف\s*(دی|dns)|خودکار|پیش\s*فرض|ریست/.test(n)) {
      if (bridge && bridge.dns) {
        toast(t('toast.dnsResetUac'), '#i-info');
        const r = await bridge.dns.reset();
        return r && r.ok ? t('dns.resetOk') : t('dns.resetFail', { x: (r && r.error) || '' });
      }
      return t('dns.resetOnlyApp');
    }
    /* افزودن DNS جدید → اگر اسم شناخته‌شده‌ای داخل جمله بود (مثل:
       «دی ان اس الکترو رو اضافه کن») اول سرچ و ثبت در فهرست می‌شود؛
       وگرنه فرم شیشه‌ای «DNS جدید» داخل صفحه اصلی باز می‌شود */
    if (/جدید|اضافه|ادد|تعریف|ثبت|بساز|تنظیم/.test(n)) {
      const cand = n
        .replace(/دی\s?ان\s?اس|dns|دک?ی?ان?س|رو|را|به|تو|ست\s*کن|تنظیم|فعال|وصل|کن|بده|استفاده|از|همون|همان|شروع|بزن|جدید|اضافه|ادد|تعریف|ثبت|بساز|پروفایل|لیست|فهرست/gi, ' ')
        .replace(/[\s\u200C]+/g, ' ')
        .trim();
      const known = cand && cand.length >= 2 ? findDnsProfile(cand) : null;
      if (known) {
        const user = ensureUserProfile(known);
        const ips = (user || known).ips || [];
        return t('dns.knownFound', { x: known.name, y: faNum(ips.join(LANG === 'en' ? ' and ' : ' و ')) });
      }
      return openDnsQuick();
    }
    /* شماره‌دار: پروفایل‌های ذخیره‌شده کاربر */
    const mNum = n.match(/شماره\s*(\d{1,2}|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|اول|دوم|سوم)/);
    if (mNum) {
      const idxRaw = mNum[1];
      const idx = /^\d+$/.test(idxRaw) ? Number(idxRaw) : FA_ORD[idxRaw] || 0;
      const prof = settings.dnsProfiles[idx - 1];
      if (!prof) {
        return openManager(t('dns.numMissing', { x: faNum(idx) }));
      }
      return applyDnsIps(prof.ips, prof.name);
    }
    /* جستجو با نام (مثل: دی ان اس الکترو) */
    const nameCand = n
      .replace(/دی\s?ان\s?اس|dns|دک?ی?ان?س|رو|را|به|را\s*ست|ست\s*کن|تنظیم|فعال|وصل|کن|بده|استفاده|از|همون|همان|شروع|بزن/gi, ' ')
      .replace(/[\s\u200C]+/g, ' ')
      .trim();
    if (nameCand && nameCand.length >= 2) {
      const prof = findDnsProfile(nameCand);
      if (prof) {
        const user = ensureUserProfile(prof);
        const ips = (user || prof).ips;
        return applyDnsIps(ips, prof.name);
      }
      return openManager(t('dns.notFound', { x: nameCand }));
    }
    /* فقط «دی ان اس» — باز کردن مدیر */
    return openManager(t('dns.managerOpened'));
  }

  function refreshDnsCurrent() {
    if (!dnsCurrentBox) return;
    dnsCurrentBox.textContent = t('dns.curReading');
    if (!bridge || !bridge.dns) {
      dnsCurrentBox.textContent = t('dns.curOnlyApp');
      return;
    }
    bridge.dns.current().then((r) => {
      if (r && r.ok && r.entries && r.entries.length) {
        dnsCurrentBox.innerHTML = r.entries
          .map((e) => `<span class="dns-cur"><b>${e.name}</b> ${e.ips.map((i) => faNum(i)).join(' , ')}</span>`)
          .join('');
      } else {
        dnsCurrentBox.textContent = t('dns.curAuto');
      }
    }).catch(() => { dnsCurrentBox.textContent = t('dns.curFail'); });
  }

  function renderDnsProfiles() {
    if (!dnsProfilesList) return;
    dnsProfilesList.innerHTML = '';
    const list = settings.dnsProfiles;
    if (!list.length) {
      const p = document.createElement('p');
      p.className = 'set-note';
      p.textContent = t('dns.empty');
      dnsProfilesList.appendChild(p);
      return;
    }
    list.forEach((p, idx) => {
      const row = document.createElement('div');
      row.className = 'dns-row';
      row.innerHTML =
        `<div class="dns-info"><b>${idx + 1}. </b><span class="dns-name"></span>` +
        `<span class="dns-ips"></span></div>` +
        `<div class="dns-actions">` +
        `<button class="chip sm dns-apply"><svg class="ic"><use href="#i-power"/></svg><span>${t('dns.activate')}</span></button>` +
        `<button class="chip sm dns-edit"><svg class="ic"><use href="#i-note"/></svg><span>${t('dns.edit')}</span></button>` +
        `<button class="chip sm dns-del"><svg class="ic"><use href="#i-trash"/></svg><span>${t('dns.del')}</span></button>` +
        `</div>`;
      row.querySelector('.dns-name').textContent = p.name;
      row.querySelector('.dns-ips').textContent = (p.ips || []).map(faNum).join(' , ');
      row.querySelector('.dns-apply').addEventListener('click', async () => {
        const msg = await applyDnsIps(p.ips, p.name);
        toast(msg, '#i-globe');
        refreshDnsCurrent();
      });
      row.querySelector('.dns-edit').addEventListener('click', () => {
        dnsEditId.value = String(p.id);
        dnsName.value = p.name;
        dnsPrimary.value = (p.ips || [])[0] || '';
        dnsSecondary.value = (p.ips || [])[1] || '';
        dnsSaveBtn.querySelector('span').textContent = t('dns.saveChanges');
        dnsCancelEdit.hidden = false;
        dnsName.focus();
      });
      row.querySelector('.dns-del').addEventListener('click', () => {
        settings.dnsProfiles = settings.dnsProfiles.filter((x) => x.id !== p.id);
        store.set('dnsProfiles', settings.dnsProfiles);
        renderDnsProfiles();
        toast(t('toast.dnsDel', { x: p.name }), '#i-trash');
      });
      dnsProfilesList.appendChild(row);
    });
  }

  function resetDnsForm() {
    dnsEditId.value = '';
    dnsName.value = '';
    dnsPrimary.value = '';
    dnsSecondary.value = '';
    dnsSaveBtn.querySelector('span').textContent = t('set.dns.save');
    dnsCancelEdit.hidden = true;
  }

  function renderDnsBuiltins() {
    if (!dnsBuiltins) return;
    dnsBuiltins.innerHTML = '';
    DNS_BUILTIN.forEach((b) => {
      const btn = document.createElement('button');
      btn.className = 'chip sm';
      btn.type = 'button';
      btn.title = `${b.name}: ${b.ips.join(' , ')}`;
      btn.innerHTML = `<svg class="ic"><use href="#i-globe"/></svg><span></span>`;
      btn.querySelector('span').textContent = b.name;
      btn.addEventListener('click', () => {
        const exists = settings.dnsProfiles.find((p) => normDnsName(p.name) === normDnsName(b.name));
        if (exists) {
          toast(t('toast.dnsExists', { x: b.name }), '#i-info');
          return;
        }
        settings.dnsProfiles.push({ id: Date.now(), name: b.name, ips: [...b.ips] });
        store.set('dnsProfiles', settings.dnsProfiles);
        renderDnsProfiles();
        toast(t('toast.dnsAdded', { x: b.name }), '#i-plus');
      });
      dnsBuiltins.appendChild(btn);
    });
  }

  /* --- وقتی هیچ موتوری نیست: پیام صادقانه (+ دمو فقط اگر کاربر روشن کرده) --- */
  function noEngine(reason) {
    setState('idle');
    setLiveText('');
    sbMic.innerHTML = `<i class="dot ok"></i>${t('mic.ready')}`;
    if (settings.demoMode) {
      startDemoListen();
      return;
    }
    statusText.innerHTML = t('stt.noEngine', { x: reason });
  }

  /* ---------- گوش دادن (AVE3) ---------- */
  let listenTimer = null;
  function startListening() {
    if (state === 'processing') return;
    if (state === 'listening') return; /* از بی‌دست دوباره فراخوانی شده */
    clearTimeout(listenTimer);
    /* نه وب داریم نه موتور ابری → پیام صادقانه (+ دمو فقط اگر کاربر روشن کرده) */
    if (!srUsable() && !buildCloudChain().length) { noEngine(t('stt.noEngineApp')); return; }
    aveStart();
  }

  function startDemoListen() {
    statusText.textContent = t('stt.demoListen');
    if (!demoNoticeShown) {
      demoNoticeShown = true;
      toast(t('stt.demoHint'), '#i-info');
    }
    listenTimer = setTimeout(() => {
      const sug = SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)];
      stopListening(false);
      runCommand(sug.cmd);
    }, 4200);
  }

  function stopListening(reset = true) {
    clearTimeout(listenTimer);
    aveStopSession(); /* جلسهٔ AVE3 + همهٔ رویدادهای در پرواز باطل */
    setLiveText('');
    sbMic.innerHTML = `<i class="dot ok"></i>${t('mic.ready')}`;
    if (reset) {
      statusText.innerHTML = IDLE_HINT;
    }
  }
  /* ============================================================
     v0.51 — Push-to-Talk (خواستهٔ کاربر: دکمهٔ قابل‌تنظیم؛ تا نگه‌داشته
     ضبط می‌کند، به محض رهاکردن همان‌چه گفته شد پردازش می‌شود؛ بدون
     نیاز به گفتن «آوا» و بدون پرش پنجرهٔ آوا جلوی برنامهٔ فعال)
     کلید/ترکیب و حالت hold/toggle در تنظیمات › بیدارباش.
     ============================================================ */
  function pttStart() {
    if (state === 'processing') { actLog('ptt down: busy (processing previous command) — ignored'); return; }
    if (state === 'listening') { actLog('ptt down: already listening — release will stop it'); return; }
    actLog('ptt down → start listening (no wake word needed)');
    /* فشردن دکمه = اجازهٔ صریح گفتار؛ مثل کلیک دستی، جلسه باز است */
    if (settings.handsFree && settings.wakeWord) wakeSessOpen();
    startListening();
  }
  function pttStop() {
    if (state !== 'listening' || !ave) { actLog('ptt up: nothing to stop (state=' + state + ')'); return; }
    const myEpoch = ave.myEpoch; /* v0.60 (A8) — اپوک این جلسه؛ تایمر کهنه هرگز جلسهٔ تازه را نمی‌بندد */
    actLog('ptt up → stop + flush (≤1400ms wait for final)');
    /* تحویلِ فوری (نه لغو): stop() بدون کشتنِ جلسه → فاینال برمی‌گردد؛
       اگر تا ۱۴۰۰ms فاینال نیامد، همان متن میان‌یادِ آخر تحویل می‌شود */
    try { rec.onend = null; rec.stop(); } catch (_) { /* noop */ }
    try { if (ave.tPttFlush) clearTimeout(ave.tPttFlush); } catch (_) { /* noop */ }
    ave.tPttFlush = setTimeout(() => {
      try {
        /* v0.60 (A8) — گارد اپوک: جلسه عوض/بسته شده؟ تایمر کهنه هیچ می‌کند */
        if (!ave || ave.myEpoch !== myEpoch) { actLog('ptt flush: stale timer — session changed, ignored'); return; }
        if (ave.delivered) return;
        const txt = String(ave.srFinal || ave.srGotText || ave.lastTxt || '').trim();
        if (txt) { actLog('ptt flush: «' + txt.slice(0, 48) + '» → deliver'); aveDeliver(txt, 'ptt-flush', myEpoch); }
        /* v0.60 (A3) — متنِ وب نیست ≠ بی‌صدا بود: بافر PCM تا الان ضبط شده —
           مسیر finalize (WAV + مسابقهٔ ابری) تصمیم می‌گیرد، نه دورانداختن جلسه؛
           گارد tGrace: finalize در پرواز است → دوباره‌کاری نمی‌شود */
        else if (ave.tGrace) { actLog('ptt flush: empty (no speech detected)'); actLog('ptt flush: finalize grace already pending — let it decide'); }
        else { actLog('ptt flush: empty (no speech detected)'); actLog('ptt flush: no web text → finalize (WAV/cloud race)'); aveFinalize(myEpoch, 'ptt-flush'); }
      } catch (_) { /* noop */ }
    }, 1400);
  }
  const toggleListen = () => {
    /* فیکس v0.13: کلیک حین اجرای فرمان قبلی → هیچ تغییر وضعیتی اتفاق
       نمی‌افتد ولی فیدبک واضح می‌دهیم (قبلاً ریپل می‌خورد و هیچ — حس «گیر کردن») */
    if (state === 'processing') {
      try {
        orb.classList.remove('shake');
        void orb.offsetWidth;
        orb.classList.add('shake');
        setTimeout(() => orb.classList.remove('shake'), 550);
      } catch (_) { /* noop */ }
      toast(t('mic.busy'), '#i-mic');
      return;
    }
    if (state === 'listening') return stopListening();
    /* v0.47 — B04: کاربر خودش دکمهٔ میکروفون را زد = اجازهٔ گفتار داده شده؛
       در حالت بی‌دست دیگر لازم نیست اول «آوا» بگوید (کلیک دستی = session باز) */
    if (settings.handsFree && settings.wakeWord) wakeSessOpen();
    startListening();
  };

  /* کلیک اورب: موج ripple انیمیشنی — همیشه از «مرکز دکمه» جریان می‌گیرد
     (نه از نقطه کلیک) + تیلت ریست */
  orb.addEventListener('click', () => {
    try {
      const st = orb.closest('.orb-stage') || orb.parentElement;
      const r = st.getBoundingClientRect();
      const o = orb.getBoundingClientRect();
      const rip = document.createElement('span');
      rip.className = 'orb-ripple';
      const size = 200;
      /* مرکز خود دکمه میکروفون نسبت به استیج */
      rip.style.cssText = `width:${size}px;height:${size}px;left:${o.left + o.width / 2 - r.left}px;top:${o.top + o.height / 2 - r.top}px;transform:translate(-50%,-50%) scale(0.5);`;
      st.appendChild(rip);
      setTimeout(() => rip.remove(), 750);
    } catch (_) { /* noop */ }
    toggleListen();
  });

  /* v0.15 — برق شیشهٔ دکمه میکروفون: نور با حرکت موس روی شیشه می‌لغزد
     (متغیرها روی orbStage ست می‌شوند تا هم .orb-glass و هم .orb-rim ارث ببرند) */
  (() => {
    const gst = $('#orbStage');
    if (!gst || !orb) return;
    let glareRaf = 0;
    gst.addEventListener('pointermove', (e) => {
      if (glareRaf) return;
      glareRaf = requestAnimationFrame(() => {
        glareRaf = 0;
        try {
          const r = orb.getBoundingClientRect();
          if (!r.width || !r.height) return;
          const x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
          const y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
          gst.style.setProperty('--gx', x.toFixed(1) + '%');
          gst.style.setProperty('--gy', y.toFixed(1) + '%');
          gst.style.setProperty('--gx2', (100 - x).toFixed(1) + '%');
          gst.style.setProperty('--gy2', (100 - y).toFixed(1) + '%');
          const ang = (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
          gst.style.setProperty('--ga', (ang + 90).toFixed(1) + 'deg');
        } catch (_) { /* noop */ }
      });
    }, { passive: true });
    gst.addEventListener('pointerleave', () => {
      gst.style.setProperty('--gx', '32%');
      gst.style.setProperty('--gy', '24%');
      gst.style.setProperty('--gx2', '68%');
      gst.style.setProperty('--gy2', '76%');
      gst.style.setProperty('--ga', '215deg');
    });
  })();

  /* تیلت سه‌بعدی اورب با حرکت موس — عمق حرفه‌ای صفحه اصلی */
  (() => {
    const st = $('#orbStage');
    if (!st) return;
    const ob = st.querySelector('.orb');
    st.addEventListener('mousemove', (e) => {
      if (state === 'listening') return;
      const r = st.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5;
      const dy = (e.clientY - r.top) / r.height - 0.5;
      ob.classList.add('tilt');
      ob.style.transform = `rotateY(${dx * 14}deg) rotateX(${-dy * 14}deg) translateZ(6px)`;
    });
    st.addEventListener('mouseleave', () => {
      ob.classList.remove('tilt');
      ob.style.transform = '';
    });
  })();

  /* v0.36 — تایپ‌پنجرهٔ بزرگ برای هوش مصنوعی: input تک‌خطی قبلی «کوچیکه» (گزارش کاربر)
     textarea با رشد خودکار؛ Enter = ارسال، Shift+Enter = خط جدید */
  function autoGrow(el, maxPx) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(maxPx, el.scrollHeight) + 'px';
  }
  function wireMultilineInput(el, form, maxPx) {
    if (!el) return;
    el.addEventListener('input', () => autoGrow(el, maxPx));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        if (form) form.requestSubmit();
      }
    });
  }
  wireMultilineInput(cmdInput, cmdBar, 220);
  wireMultilineInput(chatInput, chatBar, 220);

  /* ---------- پیشنهاد شانسی — هر چند ثانیه یک فرمان (نسخه ۰.۱۰) ---------- */
  const BASE_SUGGESTIONS = [
    { cmd: 'کروم را باز کن', en: 'open Chrome', icon: '#i-globe' },
    { cmd: 'نت‌پد را باز کن', en: 'open Notepad', icon: '#i-note' },
    { cmd: 'ماشین‌حساب را باز کن', en: 'open Calculator', icon: '#i-calc' },
    { cmd: 'صدا را بلندتر کن', en: 'volume up', icon: '#i-volume' },
    { cmd: 'صدا رو ۴۰ کن', en: 'volume 40', icon: '#i-volume' },
    { cmd: 'یک اسکرین‌شات بگیر', en: 'take a screenshot', icon: '#i-camera' },
    { cmd: 'آب و هوای تهران', en: 'weather in Tehran', icon: '#i-cloud' },
    { cmd: 'پنج ضربدر هفت چند میشه', en: 'what is 5 times 7', icon: '#i-calc' },
    { cmd: 'تایمر ۵ دقیقه‌ای بذار', en: 'set a 5 minute timer', icon: '#i-timer' },
    { cmd: 'موسیقی پخش کن', en: 'play music', icon: '#i-music' },
    { cmd: 'وضعیت سیستم را بگو', en: 'system status', icon: '#i-pulse' },
    { cmd: 'شروع ضبط صدا', en: 'start recording', icon: '#i-mic' },
    { cmd: 'آوا تایپ', en: 'Ava type', icon: '#i-type' },
    { cmd: 'تنظیم دی ان اس جدید', en: 'new DNS', icon: '#i-shield' },
    { cmd: 'پینگ dns هامو نشون بده', en: 'ping my DNS servers', icon: '#i-pulse' },
    { cmd: 'یک جوک بگو', en: 'tell me a joke', icon: '#i-smile' },
    { cmd: 'کامپیوتر رو بخوابون', en: 'sleep the PC', icon: '#i-moon' },
    { cmd: 'مانیتور رو خاموش کن', en: 'turn off the monitor', icon: '#i-monitor' },
    { cmd: 'صفحه رو قفل کن', en: 'lock the screen', icon: '#i-lock' },
  ];
  const SUGGESTIONS = [...BASE_SUGGESTIONS];
  let sgTimer = null, sgLast = -1;
  const sgText = $('#sgText');
  const sgIconUse = $('#sgIcon');
  const suggestBtn = $('#suggestBtn');
  function suggestionLabel(s) { return LANG === 'en' ? s.en : s.cmd; }
  function buildSuggestions(instant = false) {
    if (!sgText || !suggestBtn) return;
    if (instant) {
      /* شروع: اولین پیشنهاد + جلوگیری از تکرارش در چرخش بعدی */
      const s = SUGGESTIONS[0];
      sgLast = 0;
      sgText.textContent = suggestionLabel(s);
      if (sgIconUse) sgIconUse.setAttribute('href', s.icon);
      return;
    }
    let idx = Math.floor(Math.random() * SUGGESTIONS.length);
    if (SUGGESTIONS.length > 1) { while (idx === sgLast) idx = Math.floor(Math.random() * SUGGESTIONS.length); }
    sgLast = idx;
    const s = SUGGESTIONS[idx];
    suggestBtn.classList.remove('swap-in');
    suggestBtn.classList.add('swap-out');
    setTimeout(() => {
      sgText.textContent = suggestionLabel(s);
      if (sgIconUse) sgIconUse.setAttribute('href', s.icon);
      suggestBtn.classList.remove('swap-out');
      suggestBtn.classList.add('swap-in');
    }, 330);
  }
  function startSuggestionLoop() {
    clearInterval(sgTimer);
    sgTimer = setInterval(() => {
      /* فقط وقتی صفحه اصلی دیده می‌شود و اورلی‌ای باز نیست بچرخ */
      const overlayOpen = dnsQuickEl && !dnsQuickEl.hidden;
      const homeVisible = settingsPage.hidden && chatPage.hidden && historyPage.hidden && (dictPage ? dictPage.hidden : true) && (musicPage ? musicPage.hidden : true) && !overlayOpen;
      if (!homeVisible) return;
      buildSuggestions();
    }, 4200);
  }
  if (suggestBtn) {
    suggestBtn.addEventListener('click', () => {
      const label = sgText ? sgText.textContent : '';
      /* همیشه متن فارسی فرمان را اجرا کن (موتور تشخیص/قواعد فارسی‌اند) */
      let hit = SUGGESTIONS.find((s) => suggestionLabel(s) === label);
      runCommand(hit ? hit.cmd : label);
    });
  }

  /* ---------- کادر فرمان ---------- */
  cmdBar.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = cmdInput.value.trim();
    if (!v) { cmdInput.focus(); return; }
    cmdInput.value = '';
    runCommand(v);
  });

  /* ---------- میانبرها ---------- */
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'Space') {
      e.preventDefault();
      toggleListen();
    } else if (e.ctrlKey && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      cmdInput.focus();
    } else if (e.key === 'Escape') {
      if (dnsQuickEl && !dnsQuickEl.hidden) closeDnsQuickOverlay(); /* v0.60 — زنجیرهٔ else-if: یک Esc فقط یک لایه می‌بندد */
      else if (dnsPingEl && !dnsPingEl.hidden) closeDnsPingOverlay();
      else if (!confirmBox.hidden) hideConfirm();
      else if (!about.hidden) about.hidden = true;
      else if (!settingsPage.hidden) showSettings(false);
      else if (historyPage && !historyPage.hidden) showView('home');
      else if (dictPage && !dictPage.hidden) showView('home');
      else if (musicPage && !musicPage.hidden) showView('home');
      else if (extPage && !extPage.hidden) showView('home');   /* v0.15 */
      else if (dnsPage && !dnsPage.hidden) showView('home');    /* v0.15 */
      else if (!chatPage.hidden) showView('home');
      else if (state === 'listening') stopListening();
    }
  });
  if (bridge && bridge.voice) bridge.voice.onToggleListen(toggleListen);
  /* v0.51 — Push-to-Talk: پایین/بالا شدن دکمهٔ فشاری */
  if (bridge && bridge.voice && bridge.voice.onPttDown) bridge.voice.onPttDown(() => pttStart());
  if (bridge && bridge.voice && bridge.voice.onPttUp) bridge.voice.onPttUp(() => pttStop());

  /* ---------- تاریخچه فرمان‌ها ---------- */
  function pushHistory(cmd, ok = true) {
    const t = String(cmd || '').trim();
    if (!t) return;
    if (history[0] && history[0].t === t) return; /* تکرار پشت‌سرهم ثبت نشود */
    history.unshift({ t, ok: !!ok, at: Date.now() });
    history = history.slice(0, 40);
    store.set('history', history);
  }
  function renderHistory() {
    if (!historyList) return;
    historyList.innerHTML = '';
    if (historyEmpty) historyEmpty.hidden = history.length > 0;
    history.forEach((h) => {
      const it = document.createElement('div');
      it.className = 'history-item';
      const dot = document.createElement('i');
      dot.className = 'h-ok ' + (h.ok ? 'ok' : 'fail');
      const txt = document.createElement('span');
      txt.className = 'h-txt';
      txt.textContent = h.t;
      const tm = document.createElement('span');
      tm.className = 'h-time';
      try { tm.textContent = (LANG === 'en' ? timeFmtEn : timeFmt).format(new Date(h.at || Date.now())); } catch (_) { tm.textContent = ''; }
      it.appendChild(dot); it.appendChild(txt); it.appendChild(tm);
      it.addEventListener('click', () => {
        showView('home');
        runCommand(h.t);
      });
      historyList.appendChild(it);
    });
  }
  if (btnHistory) btnHistory.addEventListener('click', () => {
    renderHistory();
    showView('history');
  });
  if (btnHistoryBack) btnHistoryBack.addEventListener('click', () => showView('home'));
  if (btnHistoryClear) btnHistoryClear.addEventListener('click', () => {
    history = [];
    store.set('history', history);
    renderHistory();
    toast(t('toast.histCleared'), '#i-trash');
  });

  /* ---------- تاگل‌های حالت بی‌دست ---------- */
  if (btnHandsFree) btnHandsFree.addEventListener('click', () => setHandsFree(!settings.handsFree));
  if (optHandsFree) optHandsFree.addEventListener('change', () => setHandsFree(optHandsFree.checked));
  if (optWakeWord) optWakeWord.addEventListener('change', () => {
    settings.wakeWord = optWakeWord.checked;
    store.set('wakeWord', settings.wakeWord);
    toast(settings.wakeWord ? t('toast.wakeOn') : t('toast.wakeOff'), '#i-wave');
  });
  /* v0.46 — کلمهٔ بیدارباش قابل تغییر: ذخیره + اعمال فوری
     (همهٔ لایه‌های تطبیق همان لحظه روی کلمهٔ جدید می‌روند) */
  function wakeWordTextApply() {
    const owwt2 = $('#optWakeWordText');
    if (!owwt2) return;
    const nw = String(owwt2.value || '').replace(/[^\s\u0600-\u06FFa-zA-Z]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 20);
    if (!nw) { owwt2.value = String(settings.wakeWordText || 'آوا'); return; }
    if (nw !== settings.wakeWordText) {
      settings.wakeWordText = nw;
      store.set('wakeWordText', nw);
      toast(t('toast.wakeWordSet', { x: nw }), '#i-wave');
      actLog('wake word set: ' + nw);
    }
    /* v0.66 — بجِ «کلمهٔ فعال الان» همیشه تازه شود (تایپ دستی هم) */
    const elWwn2 = $('#wakeWordNow'); if (elWwn2) elWwn2.textContent = String(settings.wakeWordText || 'آوا');
  }
  const optWakeWordTextEl = $('#optWakeWordText');
  if (optWakeWordTextEl) {
    optWakeWordTextEl.addEventListener('change', wakeWordTextApply);
    optWakeWordTextEl.addEventListener('blur', wakeWordTextApply);
  }
  /* v0.29 — بیدارباش همیشگی آفلاین */
  const optWakeAlways = $('#optWakeAlways');
  if (optWakeAlways) {
    optWakeAlways.checked = !!settings.wakeAlways;
    optWakeAlways.addEventListener('change', async () => {
      settings.wakeAlways = optWakeAlways.checked;
      store.set('wakeAlways', settings.wakeAlways);
      if (settings.wakeAlways) await wakeLoopStart();
      else { wakeLoopStop(); wakeHealthNote(t('wake.healthIdle')); toast(t('toast.wakeAlwaysOff'), '#i-wave'); }
    });
  }
  /* v0.34 — تست بیدارباش: ۱۰ ثانیه بگو «آوا» — نتیجه همان‌جا دیده می‌شود */
  const btnWakeTest = $('#btnWakeTest');
  if (btnWakeTest) btnWakeTest.addEventListener('click', () => {
    if (!settings.wakeAlways) { toast(t('wake.testOff'), '#i-info'); return; }
    wakeTestUntil = Date.now() + 11000;
    wakeHealthNote(t('wake.testHint'));
    try { speak(t('wake.testHint')); } catch (_) { /* noop */ }
  });

  /* ---------- v0.51 — Push-to-Talk: کلید قابل‌تعویض (ترکیبی هم می‌شود) + حالت ---------- */
  const optPtt = $('#optPtt');
  const btnPttKey = $('#btnPttKey');
  const pttKeyLabel = $('#pttKeyLabel');
  const optPttMode = $('#optPttMode');
  settings.ptt = (settings.ptt && typeof settings.ptt === 'object') ? settings.ptt : {};
  const pttComboLabel = (acc) => String(acc || 'CommandOrControl+Shift+Space').replace(/CommandOrControl/g, 'Ctrl').trim();
  /* v0.60 — کلیدِ واقعی PTT برای راهنمای بیکاری (اگر در تنظیمات ثبت شده باشد)؛
     PTT خاموش/ناشناخته → همان پیش‌فرض Ctrl+Shift+Space */
  function pttHintComboHtml() {
    const def = '<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Space</kbd>';
    try {
      if (!settings.ptt || settings.ptt.enabled === false) return def;
      const combo = settings.ptt.combo;
      if (!combo || typeof combo !== 'string') return def;
      const parts = pttComboLabel(combo).split('+').filter(Boolean);
      if (!parts.length) return def;
      return parts.map((p) => '<kbd>' + p + '</kbd>').join('+');
    } catch (_) { return def; }
  }
  function pttRefreshUi() {
    if (optPtt) optPtt.checked = settings.ptt.enabled !== false;
    if (optPttMode) optPttMode.value = settings.ptt.mode === 'toggle' ? 'toggle' : 'hold';
    if (pttKeyLabel) pttKeyLabel.textContent = pttComboLabel(settings.ptt.combo);
    pttConflictHintUpdate();
  }
  pttRefreshUi();
  /* v0.66 — هشدار تعارض + وضعیت زندهٔ نگهبان (خواستهٔ کاربر: لیست کلیدهای امن
     + نبود تعارض با ویندوز/برنامه‌ها). تعارض‌ها خالص‌اند (voiceIntent.pttConflictOf). */
  function pttConflictHintUpdate() {
    const hint = $('#pttConflictHint');
    if (!hint) return;
    if (settings.ptt.enabled === false) { hint.hidden = true; return; }
    const why = (typeof AVAIntent !== 'undefined' && AVAIntent.pttConflictOf) ? AVAIntent.pttConflictOf(settings.ptt.combo) : '';
    if (why) { hint.textContent = t('set.ptt.conflict', { x: why }); hint.hidden = false; }
    else { hint.textContent = t('set.ptt.noConflict'); hint.hidden = false; }
  }
  function pttStatusUpdate() {
    const el = $('#pttStatus');
    if (!el) return;
    (async () => {
      try {
        if (!bridge || !bridge.ptt || !bridge.ptt.get) return;
        const st = await bridge.ptt.get();
        if (!st || !st.cfg) return;
        el.textContent = settings.ptt.enabled === false ? t('set.ptt.statusOff')
          : (st.ready ? t('set.ptt.statusWatcher')
            : (st.registered ? t('set.ptt.statusFallback') : t('set.ptt.statusIdle')));
      } catch (_) { /* noop */ }
    })();
  }
  {
    const wrap = $('#pttPresets');
    if (wrap && typeof AVAIntent !== 'undefined' && AVAIntent.pttSuggestionsOf) {
      const ttl = document.createElement('div');
      ttl.className = 'ptt-presets-title';
      ttl.textContent = t('set.ptt.presetsTitle');
      wrap.appendChild(ttl);
      for (const s of AVAIntent.pttSuggestionsOf()) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip ptt-preset';
        b.textContent = s.fa;
        b.title = s.acc;
        b.addEventListener('click', () => {
          settings.ptt.combo = s.acc;
          pttSave(true).then(() => { pttRefreshUi(); pttStatusUpdate(); }).catch(() => { /* noop */ });
          toast(t('set.ptt.set') + ' ' + pttComboLabel(s.acc), '#i-mic');
        });
        wrap.appendChild(b);
      }
    }
  }
  async function pttSave(reRegister) {
    store.set('ptt', settings.ptt);
    if (reRegister && bridge && bridge.ptt) { try { await bridge.ptt.reconfig(); } catch (_) { /* noop */ } }
  }
  if (optPtt) optPtt.addEventListener('change', () => { settings.ptt.enabled = !!optPtt.checked; pttSave(true); toast(settings.ptt.enabled ? t('set.ptt.on') : t('set.ptt.off'), '#i-mic'); pttConflictHintUpdate(); pttStatusUpdate(); });
  if (optPttMode) optPttMode.addEventListener('change', () => { settings.ptt.mode = optPttMode.value === 'toggle' ? 'toggle' : 'hold'; pttSave(true); });
  if (btnPttKey) btnPttKey.addEventListener('click', () => {
    if (pttKeyLabel) pttKeyLabel.textContent = t('set.ptt.press');
    /* v0.60 — ثبت کلید مهارشده: فقط کلیدهای لاتین + تایم‌اوت ۱۰ ثانیه + لغو با ESC
       (قبلاً هر کلیدی بی‌سروصدا می‌پذیرفت و accelerator مثل Ctrl+ش هرگز ثبت نمی‌شد) */
    if (btnPttKey) btnPttKey.title = t('set.key.escHint');
    let latinToastAt = 0;
    const done = (acc) => {
      clearTimeout(capTimer);
      if (btnPttKey) btnPttKey.title = '';
      window.removeEventListener('keydown', onKey, true);
      if (acc) {
        settings.ptt.combo = acc;
        pttSave(true);
        toast(t('set.ptt.set') + ' ' + pttComboLabel(acc), '#i-mic');
      }
      pttRefreshUi();
      pttStatusUpdate(); /* v0.66 — وضعیت پس از تعویض کلید */
    };
    const capTimer = setTimeout(() => { toast(t('set.key.timeout'), '#i-info'); done(null); }, 10000);
    const onKey = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'Escape') { done(null); return; }
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return; /* فقط توأمان ثبت می‌شوند */
      let acc = '';
      if (e.ctrlKey || e.metaKey) acc += 'CommandOrControl+';
      if (e.altKey) acc += 'Alt+';
      if (e.shiftKey) acc += 'Shift+';
      let keyName = e.key === ' ' ? 'Space' : (e.key.length === 1 ? e.key.toUpperCase() : e.key);
      keyName = keyName.replace(/^Arrow/, '');
      /* v0.60 — کلید تکی فقط لاتین ( accelerator غیرلاتین مثل Ctrl+ش در Electron هرگز ثبت نمی‌شود) */
      const okName = /^(F\d{1,2}|Space|Tab|Enter|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Plus|Minus|Comma|Period|Slash|Backquote|Up|Down|Left|Right)$/.test(keyName) || /^[A-Za-z0-9]$/.test(keyName);
      if (okName) { acc += keyName; done(acc); }
      else if (Date.now() - latinToastAt > 1200) { latinToastAt = Date.now(); toast(t('set.key.latin'), '#i-info'); }
    };
    window.addEventListener('keydown', onKey, true);
  });
  if (bridge && bridge.voice && bridge.voice.onToggleHandsFree) {
    bridge.voice.onToggleHandsFree(() => setHandsFree(!settings.handsFree));
  }

  /* ---------- تایپ صوتی: صفحه، دکمه‌ها، فرمان‌های سفارشی ---------- */
  if (btnDict) btnDict.addEventListener('click', () => showView(dictPage.hidden ? 'dict' : 'home'));
  if (btnDictBack) btnDictBack.addEventListener('click', () => showView('home'));
  if (btnDictToggle) btnDictToggle.addEventListener('click', () => {
    if (dictation.active) stopDictation(false);
    else startDictation();
  });
  if (btnDictCopy) btnDictCopy.addEventListener('click', async () => {
    const txt = dictBox.value || '';
    if (!txt.trim()) { toast(t('toast.noCopyText'), '#i-info'); return; }
    try {
      await navigator.clipboard.writeText(txt);
      toast(t('toast.copied'), '#i-note');
    } catch (_) {
      try {
        dictBox.select();
        document.execCommand('copy');
        toast(t('toast.copied'), '#i-note');
      } catch (__) { toast(t('toast.copyFail'), '#i-info'); }
    }
  });
  if (btnDictClear) btnDictClear.addEventListener('click', () => {
    dictBox.value = '';
    renderDictation();
    toast(t('toast.boxCleared'), '#i-trash');
  });
  if (optDictTarget) optDictTarget.addEventListener('change', () => {
    settings.dictTarget = optDictTarget.value || 'box';
    store.set('dictTarget', settings.dictTarget);
    toast(settings.dictTarget === 'apps' ? t('toast.dictTargetApps') : t('toast.dictTargetBox'), '#i-note');
  });
  const btnDictStart = $('#btnDictStart');
  if (btnDictStart) btnDictStart.addEventListener('click', () => startDictation());

  function renderTypingCmds() {
    if (!typingCmdsList) return;
    typingCmdsList.innerHTML = '';
    const list = settings.typingCmds || [];
    if (!list.length) {
      const p = document.createElement('p');
      p.className = 'set-note';
      p.textContent = LANG === 'en'
        ? 'No custom commands yet — e.g.: whenever I say "address", write: …'
        : 'هنوز فرمان سفارشی نداری — مثلاً بگو: هر وقت گفتم «آدرس»، این را بنویس: تهران، خیابان …';
      typingCmdsList.appendChild(p);
      return;
    }
    list.forEach((tc) => {
      const row = document.createElement('div');
      row.className = 'tc-row';
      row.innerHTML =
        `<div class="tc-info"><b class="tc-ph"></b><span class="tc-val"></span></div>` +
        `<button class="chip sm tc-del"><svg class="ic"><use href="#i-trash"/></svg><span>${t('dns.del')}</span></button>`;
      row.querySelector('.tc-ph').textContent = `«${tc.phrase}»`;
      row.querySelector('.tc-val').textContent =
        tc.value === '\n' ? (LANG === 'en' ? '→ new line' : '→ خط جدید')
        : tc.value === '__DEL__' ? (LANG === 'en' ? '→ delete last word' : '→ پاک‌کردن کلمه آخر')
        : tc.value === '__CLEAR__' ? (LANG === 'en' ? '→ clear all' : '→ پاک‌کردن همه')
        : `→ «${tc.value}»`;
      row.querySelector('.tc-del').addEventListener('click', () => {
        settings.typingCmds = settings.typingCmds.filter((x) => x.id !== tc.id);
        store.set('typingCmds', settings.typingCmds);
        renderTypingCmds();
        toast(t('toast.typingCmdDel'), '#i-trash');
      });
      typingCmdsList.appendChild(row);
    });
  }
  if (tcAdd) tcAdd.addEventListener('click', () => {
    const ph = (tcPhrase.value || '').trim();
    const rawVal = (tcValue.value || '').trim();
    if (!ph || !rawVal) { toast(t('toast.typingCmdNeed'), '#i-info'); return; }
    let val = rawVal;
    if (/^(خط\s*جدید|اینتر|new\s*line)$/i.test(rawVal)) val = '\n';
    else if (/^پاک\s*کردن\s*کلمه(\s*آخر)?$|^(delete|remove)\s*(the\s*)?last\s*word$/i.test(rawVal)) val = '__DEL__';
    else if (/^پاک\s*کردن\s*همه$|^clear\s*(all|everything)$/i.test(rawVal)) val = '__CLEAR__';
    settings.typingCmds = settings.typingCmds || [];
    settings.typingCmds.push({ id: Date.now(), phrase: ph, value: val });
    store.set('typingCmds', settings.typingCmds);
    tcPhrase.value = '';
    tcValue.value = '';
    renderTypingCmds();
    toast(t('toast.typingCmdAdded', { x: ph }), '#i-plus');
  });

  /* ---------- مدیریت DNS: فرم، ذخیره، باز کردن فرم شیشه‌ای ---------- */
  if (btnQuickDns) btnQuickDns.addEventListener('click', () => openDnsQuickOverlay());
  if (dnsSaveBtn) dnsSaveBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const name = (dnsName.value || '').trim();
    const p1 = (dnsPrimary.value || '').trim();
    const p2 = (dnsSecondary.value || '').trim();
    const IP_OK = (v) => /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(v);
    if (!name) { toast(t('dns.needName'), '#i-info'); dnsName.focus(); return; }
    if (!IP_OK(p1)) { toast(t('dns.badIp'), '#i-info'); dnsPrimary.focus(); return; }
    if (p2 && !IP_OK(p2)) { toast(t('dns.badIp2'), '#i-info'); dnsSecondary.focus(); return; }
    const editId = dnsEditId.value;
    if (editId) {
      const prof = settings.dnsProfiles.find((x) => String(x.id) === editId);
      if (prof) { prof.name = name; prof.ips = p2 ? [p1, p2] : [p1]; }
      toast(t('dns.updated', { x: name }), '#i-plus');
    } else {
      settings.dnsProfiles.push({ id: Date.now(), name, ips: p2 ? [p1, p2] : [p1] });
      toast(t('dns.savedHint', { x: name }), '#i-plus');
    }
    store.set('dnsProfiles', settings.dnsProfiles);
    resetDnsForm();
    renderDnsProfiles();
  });
  if (dnsCancelEdit) dnsCancelEdit.addEventListener('click', resetDnsForm);
  if (dnsAddForm) dnsAddForm.addEventListener('submit', (e) => { e.preventDefault(); if (dnsSaveBtn) dnsSaveBtn.click(); });
  const btnDnsReset = $('#btnDnsReset');
  if (btnDnsReset) btnDnsReset.addEventListener('click', async () => {
    if (!bridge || !bridge.dns) { toast(t('dns.resetOnlyApp'), '#i-info'); return; }
    toast(t('toast.dnsResetUac'), '#i-info');
    const r = await bridge.dns.reset();
    toast(r && r.ok ? t('toast.dnsResetOk') : t('toast.dnsResetFail', { x: (r && r.error) || '—' }), r && r.ok ? '#i-refresh' : '#i-info');
    refreshDnsCurrent();
  });

  /* ---------- ناوبری: خانه / تنظیمات / چت / تاریخچه ----------
     ============================================================ */
  let appVersion = '0.70.0-beta';

  /* پنل فعال تنظیمات (v0.9 — ناوبری لیستی سمت چپ) */
  const setNavItems = [...document.querySelectorAll('.set-nav-item')];
  const setPanes = [...document.querySelectorAll('.set-pane')];
  function showSettingsPane(id) {
    /* v0.36 — پنل ذخیره‌شدهٔ نامعتبر (مثل پنل حذف‌شده) هرگز صفحهٔ خالی نگذارد */
    if (!setPanes.some((p) => p.dataset.pane === id)) id = 'mic';
    let hit = false;
    setNavItems.forEach((b) => {
      const on = b.dataset.pane === id;
      b.classList.toggle('active', on);
      if (on) hit = true;
    });
    if (!hit && setNavItems[0]) { id = setNavItems[0].dataset.pane; setNavItems[0].classList.add('active'); }
    setPanes.forEach((p) => p.classList.toggle('active', p.dataset.pane === id));
    settings.settingsPane = id;
    store.set('settingsPane', id);
  }
  setNavItems.forEach((b) => b.addEventListener('click', () => showSettingsPane(b.dataset.pane)));

  function showView(v) {
    settingsPage.hidden = v !== 'settings';
    chatPage.hidden = v !== 'chat';
    if (historyPage) historyPage.hidden = v !== 'history';
    if (dictPage) dictPage.hidden = v !== 'dict';
    if (musicPage) musicPage.hidden = v !== 'music';
    if (extPage) extPage.hidden = v !== 'ext';   /* v0.15 */
    if (dnsPage) dnsPage.hidden = v !== 'dns';   /* v0.15 */
    hero.style.display = v === 'home' ? '' : 'none';
    btnHome.classList.toggle('active', v === 'home');
    btnSettings.classList.toggle('active', v === 'settings');
    btnChat.classList.toggle('active', v === 'chat');
    if (btnDict) btnDict.classList.toggle('active', v === 'dict');
    if (btnHistory) btnHistory.classList.toggle('active', v === 'history');
    if (btnMusic) btnMusic.classList.toggle('active', v === 'music');
    if (btnExt) btnExt.classList.toggle('active', v === 'ext');
    if (btnDnsExt) btnDnsExt.classList.toggle('active', v === 'dns');
    /* ویجت موزیک فقط روی صفحه اصلی و فقط وقتی افزونهٔ موزیک فعال است */
    if (musicWidget) musicWidget.hidden = v !== 'home' || !settings.extMusic || !(music.tracks && music.tracks.length && music.cur >= 0);
    $('#main').scrollTop = 0;
    if (v === 'settings') {
      showSettingsPane(settings.settingsPane || 'mic');
      refreshSettingsUI();
      if ((settings.settingsPane || 'mic') === 'dns' && bridge && bridge.dns) refreshDnsCurrent();
    }
    if (v === 'dns' && bridge && bridge.dns) refreshDnsCurrent(); /* v0.15 — وضعیت DNS در صفحهٔ اختصاصی */
    if (v === 'chat') {
      if (!chatMsgs.childElementCount) chatWelcome();
      setTimeout(() => chatInput.focus(), 150);
    }
  }
  function showSettings(on) { showView(on ? 'settings' : 'home'); }
  btnSettings.addEventListener('click', () => showView(settingsPage.hidden ? 'settings' : 'home'));
  btnHome.addEventListener('click', () => showView('home'));
  btnSettingsBack.addEventListener('click', () => showView('home'));
  btnChat.addEventListener('click', () => showView(chatPage.hidden ? 'chat' : 'home'));
  btnChatBack.addEventListener('click', () => showView('home'));

  /* ---------- افزونه‌ها (v0.15) — DNS Changer و پلیر موزیک در ستون کنار ---------- */
  function applyExtensions() {
    const dnsOn = settings.extDns !== false; /* پیش‌فرض: روشن */
    const musOn = !!settings.extMusic;       /* پیش‌فرض: خاموش — برنامه سبک می‌ماند */
    if (btnDnsExt) btnDnsExt.hidden = !dnsOn;
    if (btnMusic) btnMusic.hidden = !musOn;
    [extDnsOpt, extDnsToggle].forEach((el) => { if (el) el.checked = dnsOn; });
    [extMusicOpt, extMusicToggle].forEach((el) => { if (el) el.checked = musOn; });
    const dcOn = settings.extDiscord !== false;
    [extDiscordOpt, extDiscordToggle].forEach((el) => { if (el) el.checked = dcOn; });
    if (!musOn) {
      try { if (typeof mAudio !== 'undefined' && mAudio && !mAudio.paused) mAudio.pause(); } catch (_) { /* noop */ }
      if (musicWidget) musicWidget.hidden = true;
    } else {
      /* v0.42 — فعال‌سازی افزونه → بازسازی پلی‌لیست در همین لحظه (lazy، نه در شروع)
         try/catch: در اولین init شیء music هنوز تعریف نشده (پایین‌تر از این‌جاست) */
      try {
        if (!music.restored && Array.isArray(settings.musicDirs) && settings.musicDirs.length) {
          setTimeout(() => { try { restoreMusicLibrary(); } catch (_) { /* noop */ } }, 250);
        }
      } catch (_) { /* music هنوز آماده نیست — مسیر 1500ms پایینِ فایل خودش می‌گیرد */ }
    }
  }
  if (btnExt) btnExt.addEventListener('click', () => showView(extPage && !extPage.hidden ? 'home' : 'ext'));
  if (btnDnsExt) btnDnsExt.addEventListener('click', () => showView('dns'));
  [$('#btnExtBack'), $('#btnDnsPageBack')].forEach((b) => { if (b) b.addEventListener('click', () => showView('home')); });
  const btnOpenExtPage = $('#btnOpenExtPage');
  if (btnOpenExtPage) btnOpenExtPage.addEventListener('click', () => showView('ext'));
  const btnOpenDnsExt = $('#btnOpenDnsExt');
  if (btnOpenDnsExt) btnOpenDnsExt.addEventListener('click', () => showView('dns'));
  const btnOpenMusicExt = $('#btnOpenMusicExt');
  if (btnOpenMusicExt) btnOpenMusicExt.addEventListener('click', () => {
    if (!settings.extMusic) { settings.extMusic = true; store.set('extMusic', true); applyExtensions(); }
    showView('music');
  });
  [extDnsOpt, extDnsToggle].forEach((el) => el && el.addEventListener('change', () => {
    settings.extDns = el.checked;
    store.set('extDns', settings.extDns);
    applyExtensions();
    toast(el.checked ? t('toast.extOn', { x: 'DNS Changer' }) : t('toast.extOff', { x: 'DNS Changer' }), '#i-shield');
  }));
  [extMusicOpt, extMusicToggle].forEach((el) => el && el.addEventListener('change', () => {
    settings.extMusic = el.checked;
    store.set('extMusic', settings.extMusic);
    applyExtensions();
    toast(el.checked ? t('toast.extOn', { x: t('ext.music') }) : t('toast.extOff', { x: t('ext.music') }), '#i-music');
  }));
  [extDiscordOpt, extDiscordToggle].forEach((el) => el && el.addEventListener('change', () => {
    settings.extDiscord = el.checked;
    store.set('extDiscord', settings.extDiscord);
    applyExtensions();
    toast(el.checked ? t('toast.extOn', { x: t('ext.discord') }) : t('toast.extOff', { x: t('ext.discord') }), '#i-smile');
  }));
  applyExtensions();

  /* ---------- کنترل دستی دیسکورد (v0.17) — مخاطبین + بک‌گراند + مختصات ---------- */
  function discordCtx() {
    return {
      bg: !!settings.discordBg,
      assist: settings.discordCallMode === 'assist',
      dx: Number(settings.discordCallDx) || 46,
      dy: Number(settings.discordCallDy) || 52,
    };
  }
  async function runDiscordCmd(action, name, okMsg, userId) {
    if (!bridge || !bridge.discord) return toast(t('toast.discOnly'), '#i-info');
    toast(t('disc.working'), '#i-smile');
    const r = await bridge.discord.cmd({ action, name, userId, ...discordCtx() }).catch((e) => ({ ok: false, error: String(e) }));
    actLog('discord manual ' + action + (name ? ' name=' + name.slice(0, 24) : '') + ' -> ' + (r && r.ok ? String(r.result) : String(r && r.error || 'fail')));
    if (r && r.ok) {
      /* شفاف‌سازی: در حالت بک‌گراند کلیدها به دیسکورد فرستاده می‌شوند ولی
         قابل تأیید نیست — اگر اثری دیدی نشد، حالت بک‌گراند را خاموش کن */
      const res = String((r && r.result) || '');
      if (res === 'OK:ASSIST') toast(t('disc.assist'), '#i-smile');
      else if (res === 'OK:DM_OPENED') toast(t('disc.dmOnly'), '#i-info');
      else toast(okMsg || t('disc.done'), '#i-check');
    } else toast((r && r.error) || t('disc.fail'), '#i-info');
    return r;
  }
  /* یافتن مخاطب از نام گفته‌شده — تطبیق دقیق، شروع، و شامل‌بودن دوطرفه */
  /* v0.32 — نرمال‌سازی نام مخاطب: خط/زیرخط/نقطه → فاصله، ی/ك عربی → فارسی،
     نیم‌فاصله → فاصله، بزرگ/کوچک — «ali hk» و «ali-hk» و «Ali_HK» یکی می‌شوند.
     ریشهٔ «به ali-hk زنگ بزن» که مخاطبش پیدا نمی‌شد: STT به‌جای خط تیره فاصله
     می‌نوشت و مقایسهٔ رشتهٔ خام شکست می‌خورد → مسیر کُندِ Ctrl+K می‌رفت. */
  function dcNameNorm(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[\u0649\u064A]/g, '\u06CC') /* ى/ي → ی */
      .replace(/\u0643/g, '\u06A9')         /* ك → ک */
      .replace(/[\u200C]+/g, ' ')
      .replace(/[-_.]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function resolveDiscordContact(spoken) {
    const list = Array.isArray(settings.discordContacts) ? settings.discordContacts : [];
    if (!spoken) return null;
    const s = dcNameNorm(spoken);
    if (!s) return null;
    let hit = list.find((c) => dcNameNorm(c.name) === s);
    if (hit) return hit;
    hit = list.find((c) => { const n = dcNameNorm(c.name); return n.startsWith(s) || s.startsWith(n); });
    if (hit) return hit;
    hit = list.find((c) => { const n = dcNameNorm(c.name); return n.includes(s) || s.includes(n); });
    if (hit) return hit;
    /* v0.32 — آی‌دی عددی: اگر در گفتار عددی ≥۵ رقمی آمد که با آی‌دی مخاطبی
       برابر بود، همان مخاطب است (مسیر دیپ‌لینک قطعی) — ارقام فارسی/عربی هم */
    const digits = String(spoken)
      .replace(/[\u06F0-\u06F9]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x06F0 + 48))
      .replace(/[\u0660-\u0669]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48))
      .replace(/\D/g, '');
    if (digits.length >= 5) hit = list.find((c) => String(c.userId || '').trim() === digits);
    return hit || null;
  }
  const dcBtn = (id, action, msg) => {
    const b = $(id);
    if (b) b.addEventListener('click', () => runDiscordCmd(action, '', msg));
  };
  dcBtn('#btnDcMute', 'mute', t('disc.muted'));
  dcBtn('#btnDcDeafen', 'deafen', t('disc.deafened'));
  dcBtn('#btnDcHangup', 'hangup', t('disc.hangup'));
  dcBtn('#btnDcAnswer', 'answer', t('disc.answer'));
  dcBtn('#btnDcDecline', 'decline', t('disc.decline'));
  dcBtn('#btnDcFocus', 'focus', t('disc.focused'));
  dcBtn('#btnDcSelftest', 'selftest', t('disc.selftestOk')); /* v0.66 — عیب‌یاب یک‌کلیکی */
  const btnDcCall = $('#btnDcCall');
  const dcCallName = $('#dcCallName');
  if (btnDcCall) btnDcCall.addEventListener('click', async () => {
    const nm = (dcCallName && dcCallName.value || '').trim();
    if (!nm) { toast(t('disc.needName'), '#i-info'); return; }
    const ct = resolveDiscordContact(nm);
    await runDiscordCmd('call', ct ? ct.name : nm, t('disc.calling', { x: ct ? ct.name : nm }), ct ? ct.userId : '');
  });
  /* v0.38.1 — بایندینگِ مردهٔ btnDcSettings حذف شد: چنین id در markup نبود و
     هرگز اجرا نمی‌شد؛ دکمهٔ واقعی کارت افزونه (btnDcSettingsPage) پایین‌تر بایند است */
  /* v0.35 — دکمهٔ کارت دیسکورد در صفحهٔ افزونه‌ها → تنظیمات › دیسکورد */
  const btnDcSettingsPage = $('#btnDcSettingsPage');
  if (btnDcSettingsPage) btnDcSettingsPage.addEventListener('click', () => {
    showView('settings');
    showSettingsPane('discord');
  });

  /* ---------- تنظیمات دیسکورد (v0.17): مخاطبین، بک‌گراند، مختصات ---------- */
  const dcAddForm = $('#dcAddForm');
  const dcName = $('#dcName');
  const dcUserId = $('#dcUserId');
  const dcContactsList = $('#dcContactsList');
  const optDiscordBg = $('#optDiscordBg');
  const optDiscordCallDx = $('#optDiscordCallDx');
  const optDiscordCallDy = $('#optDiscordCallDy');
  function renderDiscordContacts() {
    if (!dcContactsList) return;
    const list = Array.isArray(settings.discordContacts) ? settings.discordContacts : [];
    dcContactsList.innerHTML = '';
    if (!list.length) {
      dcContactsList.innerHTML = `<div class="dc-empty">${t('set.dc.empty')}</div>`;
      return;
    }
    list.forEach((c) => {
      const row = document.createElement('div');
      row.className = 'dc-contact';
      row.innerHTML = `
        <div class="dc-ct-info"><b></b><span class="num" dir="ltr"></span></div>
        <div class="dc-ct-actions">
          <button type="button" class="chip sm dc-call"><svg class="ic"><use href="#i-tts"/></svg><span>${t('set.dc.call')}</span></button>
          <button type="button" class="chip sm danger dc-del" title="${t('set.dc.del')}"><svg class="ic"><use href="#i-close"/></svg></button>
        </div>`;
      row.querySelector('.dc-ct-info b').textContent = c.name;
      row.querySelector('.dc-ct-info span').textContent = c.userId;
      row.querySelector('.dc-call').addEventListener('click', async () => {
        await runDiscordCmd('call', c.name, t('disc.calling', { x: c.name }), c.userId);
      });
      row.querySelector('.dc-del').addEventListener('click', () => {
        settings.discordContacts = settings.discordContacts.filter((x) => x.id !== c.id);
        store.set('discordContacts', settings.discordContacts);
        renderDiscordContacts();
        toast(t('set.dc.deleted', { x: c.name }), '#i-close');
      });
      dcContactsList.appendChild(row);
    });
  }
  if (dcAddForm) dcAddForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const nm = (dcName && dcName.value || '').trim();
    const uid = (dcUserId && dcUserId.value || '').trim();
    if (!nm || !uid) { toast(t('set.dc.needBoth'), '#i-info'); return; }
    if (!/^\d{5,25}$/.test(uid)) { toast(t('set.dc.badId'), '#i-info'); return; }
    if (!Array.isArray(settings.discordContacts)) settings.discordContacts = [];
    settings.discordContacts.push({ id: 'c' + Date.now().toString(36), name: nm, userId: uid, note: '' });
    store.set('discordContacts', settings.discordContacts);
    if (dcName) dcName.value = '';
    if (dcUserId) dcUserId.value = '';
    renderDiscordContacts();
    toast(t('set.dc.added', { x: nm }), '#i-check');
  });
  if (optDiscordBg) optDiscordBg.addEventListener('change', () => {
    settings.discordBg = optDiscordBg.checked;
    store.set('discordBg', settings.discordBg);
    toast(settings.discordBg ? t('set.dc.bgOn') : t('set.dc.bgOff'), '#i-smile');
  });
  const optDiscordCallMode = $('#optDiscordCallMode');
  if (optDiscordCallMode) optDiscordCallMode.addEventListener('change', () => {
    settings.discordCallMode = optDiscordCallMode.value === 'assist' ? 'assist' : 'auto';
    store.set('discordCallMode', settings.discordCallMode);
    toast(settings.discordCallMode === 'assist' ? (LANG === 'en' ? 'Assist mode — fully within Discord rules.' : 'حالت کمکی — کاملاً مطابق قوانین دیسکورد.') : (LANG === 'en' ? 'Auto mode — experimental input simulation.' : 'حالت خودکار — آزمایشی.'), '#i-smile');
  });
  const bindDxy = (el, key) => {
    if (!el) return;
    el.addEventListener('change', () => {
      const v = Math.max(10, Math.min(320, Number(el.value) || 46));
      settings[key] = v;
      el.value = String(v);
      store.set(key, v);
    });
  };
  bindDxy(optDiscordCallDx, 'discordCallDx');
  bindDxy(optDiscordCallDy, 'discordCallDy');
  const btnDcProbe = $('#btnDcProbe');
  if (btnDcProbe) btnDcProbe.addEventListener('click', async () => {
    if (!bridge || !bridge.discord) return toast(t('toast.winOnly'), '#i-info');
    toast(t('set.dc.probing'), '#i-smile');
    const r = await bridge.discord.cmd({ action: 'probe', ...discordCtx() }).catch((e) => ({ ok: false, error: String(e) }));
    if (r && r.ok) toast(t('set.dc.probed'), '#i-check');
    else toast((r && r.error) || t('disc.fail'), '#i-info');
  });

  /* ---------- کلیدهای بهینه‌سازی (v0.15) ---------- */
  if (optNoAnim) optNoAnim.addEventListener('change', () => {
    settings.noAnim = optNoAnim.checked;
    store.set('noAnim', settings.noAnim);
    applyPerf();
    toast(settings.noAnim ? t('toast.noAnimOn') : t('toast.noAnimOff'), '#i-pulse');
  });
  if (optNoFx) optNoFx.addEventListener('change', () => {
    settings.noFx = optNoFx.checked;
    store.set('noFx', settings.noFx);
    applyPerf();
    toast(settings.noFx ? t('toast.noFxOn') : t('toast.noFxOff'), '#i-pulse');
  });
  if (btnLiteTheme) btnLiteTheme.addEventListener('click', () => setTheme(settings.theme === 'dark' ? 'lite' : (settings.theme === 'lite' ? 'darklite' : 'dark')));

  /* ---------- حالت امن + گزارش خطاها (v0.16.1) ---------- */
  const optSafeMode = $('#optSafeMode');
  if (optSafeMode) optSafeMode.addEventListener('change', () => {
    settings.safeMode = optSafeMode.checked;
    store.set('safeMode', settings.safeMode);
    applyPerf();
    toast(settings.safeMode ? t('toast.safeOn') : t('toast.safeOff'), '#i-pulse');
  });
  const btnCopyErrors = $('#btnCopyErrors');
  if (btnCopyErrors) btnCopyErrors.addEventListener('click', async () => {
    const report = [
      'AVA error report',
      'version: ' + (appVersion || '?') + ' | booted: ' + String(!!(window.__avaErr && window.__avaErr.booted)),
      'UA: ' + (navigator.userAgent || '?'),
      'bridge: ' + String(!!bridge) + ' | speech: ' + String(!!SRC),
      'safeMode: ' + String(!!settings.safeMode) + ' | theme: ' + settings.theme,
      '',
      ((window.__avaErr && window.__avaErr.ring) || []).join('\n') || '(no errors recorded)',
    ].join('\n');
    let okc = false;
    try { await navigator.clipboard.writeText(report); okc = true; } catch (_) { /* noop */ }
    if (!okc && bridge && bridge.system && bridge.system.copyText) {
      try { okc = !!(await bridge.system.copyText(report)); } catch (_) { /* noop */ }
    }
    toast(okc ? t('toast.copied') : t('toast.copyFail'), okc ? '#i-check' : '#i-info');
  });

  /* ---------- دکمهٔ ذخیرهٔ تنظیمات هوش مصنوعی (v0.15) ---------- */
  if (btnSaveAi) btnSaveAi.addEventListener('click', () => {
    settings.glmKey = ((optGlmKey && optGlmKey.value) || '').trim();
    store.set('glmKey', settings.glmKey);
    if (optAiModel) { settings.glmModel = optAiModel.value || 'glm-4.6'; store.set('glmModel', settings.glmModel); }
    if (optAiProvider) { settings.aiProvider = optAiProvider.value || 'auto'; store.set('aiProvider', settings.aiProvider); }
    if (optGeminiKey) { settings.geminiKey = optGeminiKey.value.trim(); store.set('geminiKey', settings.geminiKey); }
    const ogb = $('#optGemBase'); if (ogb) { settings.gemBase = ogb.value.trim().replace(/\/+$/, ''); store.set('gemBase', settings.gemBase); }
    if (optOpenaiKey) { settings.openaiKey = optOpenaiKey.value.trim(); store.set('openaiKey', settings.openaiKey); }
    if (optGeminiModel) { settings.geminiModel = optGeminiModel.value.trim() || 'gemini-flash-latest'; optGeminiModel.value = settings.geminiModel; store.set('geminiModel', settings.geminiModel); }
    if (optOpenaiModel) { settings.openaiModel = optOpenaiModel.value.trim() || 'gpt-4o-mini'; optOpenaiModel.value = settings.openaiModel; store.set('openaiModel', settings.openaiModel); }
    toast(t('toast.savedAll'), '#i-check');
  });

  function loadAppVersion() {
    const render = () => {
      if (updText) updText.textContent = t('upd.current', { x: faNum(appVersion) });
      /* v0.15 — نسخهٔ واقعی برنامه در نوار بالا و پایین (قبلاً متن ثابت «۰.۱۱» بود) */
      const vShort = 'v' + String(appVersion || '').replace(/^v/, '');
      const tb = $('#tbVersion');
      if (tb) tb.textContent = vShort;
      const sb = $('#sbVersion');
      if (sb) sb.textContent = 'AVA ' + vShort;
    };
    if (bridge && bridge.system && bridge.system.info) {
      bridge.system.info().then((i) => {
        appVersion = (i && i.version) || appVersion;
        render();
      }).catch(render);
    } else {
      render();
    }
  }

  function refreshSettingsUI() {
    if (typeof applyExtensions === 'function') applyExtensions();
    if (typeof syncPerfUI === 'function') syncPerfUI();
    const osm = $('#optSafeMode');
    if (osm) osm.checked = !!settings.safeMode;
    optTts.checked = !!settings.tts;
    const ods = $('#optDoneSound'); if (ods) ods.checked = settings.doneSound !== false; /* v0.65 */
    optAutoUpdate.checked = !!settings.autoUpdate;
    if (optDemo) optDemo.checked = !!settings.demoMode;
    optSttEngine.value = settings.sttEngine || 'auto';
    if (optSttLang) optSttLang.value = settings.sttLang || 'fa-IR';
    if (optLang) optLang.value = settings.lang || 'fa';
    if (optTheme) optTheme.value = settings.theme || 'dark';
    if (optDictTarget) optDictTarget.value = settings.dictTarget || 'box';
    optGlmKey.value = settings.glmKey || '';
    optGoogleKey.value = settings.googleKey || '';
    optAiModel.value = settings.glmModel || 'glm-4.6';
    if (optTtsEngine) optTtsEngine.value = settings.ttsEngine || 'edge';
    /* v0.43 — صدای اِج: مؤنث (Dilara) یا مذکر (Farid) */
    if (optEdgeVoice) optEdgeVoice.value = settings.edgeVoice === 'farid' ? 'farid' : 'dilara';
    if (optAiProvider) optAiProvider.value = settings.aiProvider || 'auto';
    if (optGeminiKey) optGeminiKey.value = settings.geminiKey || '';
    const ogb2 = $('#optGemBase'); if (ogb2) ogb2.value = settings.gemBase || '';
    if (optOpenaiKey) optOpenaiKey.value = settings.openaiKey || '';
    if (optGeminiModel) optGeminiModel.value = settings.geminiModel || 'gemini-flash-latest';
    if (optOpenaiModel) optOpenaiModel.value = settings.openaiModel || 'gpt-4o-mini';
    /* v0.17 — Whisper سازگار با OpenAI + مخاطبین دیسکورد
       (lookup مستقیم DOM — نه constهای بعدی که TDZ می‌خورند) */
    const owb = $('#optWhisperBase'); if (owb) owb.value = settings.whisperBase || 'https://api.groq.com/openai/v1';
    const owk = $('#optWhisperKey'); if (owk) owk.value = settings.whisperKey || '';
    const owm = $('#optWhisperModel'); if (owm) owm.value = settings.whisperModel || 'whisper-large-v3-turbo';
    if (typeof renderDiscordContacts === 'function') renderDiscordContacts();
    const odb = $('#optDiscordBg'); if (odb) odb.checked = !!settings.discordBg;
    const odm = $('#optDiscordCallMode'); if (odm) odm.value = settings.discordCallMode || 'auto';
    const odx = $('#optDiscordCallDx'); if (odx) odx.value = String(settings.discordCallDx || 46);
    const ody = $('#optDiscordCallDy'); if (ody) ody.value = String(settings.discordCallDy || 52);
    /* هشدار «مدل جمنای بدون کلید» — ریشهٔ سردرگمی قبلی کاربر */
    const gnkw = $('#geminiNoKeyWarn');
    if (gnkw) gnkw.hidden = !(settings.geminiModel && !settings.geminiKey);
    updateHandsFreeUI();
    refreshEngineUI();
    fillVoiceSelect();
    listMicDevices();
    loadAppVersion();
    renderTypingCmds();
    renderDnsProfiles();
    renderDnsBuiltins();
    if (bridge && bridge.settings) {
      bridge.settings.flags().then((f) => {
        optTop.checked = !!(f && f.alwaysOnTop);
        optLogin.checked = !!(f && f.loginItem);
      }).catch(() => { /* noop */ });
    } else {
      optTop.checked = false;
      optLogin.checked = false;
    }
  }

  const needApp = () => toast(t('toast.onlyApp'), '#i-info');

  /* v0.43 — نام فارسی موتورِ واقعاً پخش‌شده (اعلام صادقانه بعد از نمونهٔ صدا) */
  const ttsEngineName = (e) => (e === 'edge'
    ? (LANG === 'en' ? 'Edge neural' : 'اِج عصبی')
    : e === 'google' ? (LANG === 'en' ? 'Google' : 'گوگل') : (LANG === 'en' ? 'Windows offline' : 'ویندوز'));
  if (optTtsEngine) optTtsEngine.addEventListener('change', async () => {
    /* v0.42 — سه موتور: اِج / گوگل / ویندوز */
    settings.ttsEngine = ['edge', 'google', 'windows'].includes(optTtsEngine.value) ? optTtsEngine.value : 'edge';
    store.set('ttsEngine', settings.ttsEngine);
    stopGoogleSpeak();
    if (window.speechSynthesis) speechSynthesis.cancel();
    /* v0.43 — ریشهٔ «TTS رو تغییر میدم ولی هیچی تغییر نمیکنه»: اِج روی شبکهٔ
       کاربر بلاک بود و بی‌سروصدا گوگل حرف می‌زد. حالا موتور واقعی اعلام می‌شود */
    const wanted = settings.ttsEngine;
    const sample = t(wanted === 'edge' ? 'voice.eEng' : wanted === 'google' ? 'voice.gEng' : 'voice.wEng');
    const okS = await speak(sample);
    if (okS && ttsLastEngine && ttsLastEngine !== wanted) {
      toast(LANG === 'en'
        ? `${ttsEngineName(wanted)} is unavailable — played with ${ttsEngineName(ttsLastEngine)}`
        : `موتور «${ttsEngineName(wanted)}» در دسترس نیست — با صدای ${ttsEngineName(ttsLastEngine)} پخش شد`, '#i-info');
    } else if (okS) {
      toast(LANG === 'en' ? 'Sample played with ' + ttsEngineName(ttsLastEngine) : 'نمونهٔ صدا با موتور ' + ttsEngineName(ttsLastEngine) + ' پخش شد', '#i-check');
    } else {
      toast(LANG === 'en' ? 'No speech engine is available' : 'هیچ موتور صدایی در دسترس نیست', '#i-info'); /* v0.60 — آیکون هشدارِ ناموجود در defs با i-info جایگزین شد */
    }
  });
  if (optEdgeVoice) optEdgeVoice.addEventListener('change', () => {
    /* v0.43 — تغییر صدای اِج: مذکر/مؤنث واقعاً در لحظه عوض می‌شود */
    settings.edgeVoice = optEdgeVoice.value === 'farid' ? 'farid' : 'dilara';
    store.set('edgeVoice', settings.edgeVoice);
    stopGoogleSpeak();
    if (window.speechSynthesis) speechSynthesis.cancel();
    speak(LANG === 'en'
      ? (settings.edgeVoice === 'farid' ? 'This is the male Edge voice.' : 'This is the female Edge voice.')
      : (settings.edgeVoice === 'farid' ? 'سلام، من فرید هستم؛ صدای مذکر آوا.' : 'سلام، من دلارا هستم؛ صدای مؤنث آوا.'));
  });
  if (optAiProvider) optAiProvider.addEventListener('change', () => {
    settings.aiProvider = optAiProvider.value || 'auto';
    store.set('aiProvider', settings.aiProvider);
    toast(t('toast.saved'), '#i-spark');
  });
  if (optGeminiKey) {
    /* v0.28 — ذخیرهٔ کلید جمنای با بازخورد روشن: تا کاربر نداند «ثبت شد» یا نه.
       هم change (blur) و هم input (تایپ/پیست — debounce) ذخیره می‌کند */
    let gemSaveT = 0;
    const saveGemKey = () => {
      const v = optGeminiKey.value.trim();
      settings.geminiKey = v;
      store.set('geminiKey', v);
    };
    optGeminiKey.addEventListener('change', () => {
      saveGemKey();
      toast(settings.geminiKey ? t('set.ai.gemSaved') : t('set.ai.gemCleared'), '#i-key');
      if (settings.geminiKey && !/^(AIza|AQ\.)/.test(settings.geminiKey)) toast(t('set.ai.gemBadFormat'), '#i-info'); /* v0.39 — کلیدهای جدید AQ. هم معتبرند */
    });
    optGeminiKey.addEventListener('input', () => {
      clearTimeout(gemSaveT);
      gemSaveT = setTimeout(saveGemKey, 500);
    });
  }
  /* v0.29 — تست اتصال جمنای: یک درخواست واقعیِ کوچک؛ نتیجه یا خطای دقیق فارسی */
  const btnGemTest = $('#btnGemTest'), gemTestOut = $('#gemTestOut');
  if (btnGemTest && gemTestOut) {
    btnGemTest.addEventListener('click', async () => {
      const key = settings.geminiKey || (optGeminiKey ? optGeminiKey.value.trim() : '');
      if (!key) {
        gemTestOut.hidden = false;
        gemTestOut.className = 'set-note warn-note';
        gemTestOut.textContent = t('set.ai.gemTestNoKey');
        return;
      }
      btnGemTest.disabled = true;
      const tEl = $('#btnGemTestTxt');
      if (tEl) tEl.textContent = t('set.ai.gemTesting');
      gemTestOut.hidden = true;
      const r = await (bridge && bridge.ai && bridge.ai.gemTest
        ? bridge.ai.gemTest({ key, base: settings.gemBase || '' })
        : Promise.resolve({ ok: false, error: t('toast.onlyApp') })).catch((e) => ({ ok: false, error: String(e) }));
      btnGemTest.disabled = false;
      if (tEl) tEl.textContent = t('set.ai.gemTestBtn');
      gemTestOut.hidden = false;
      if (r && r.ok) {
        gemTestOut.className = 'set-note ok-note';
        /* v0.39 — تعداد مدل‌های زندهٔ کشف‌شده هم نشان داده می‌شود */
        const n = Array.isArray(r.models) ? r.models.length : 0;
        gemTestOut.textContent = n
          ? t('set.ai.gemTestOkList', { x: r.model, y: faNum(r.ms), z: faNum(n) })
          : t('set.ai.gemTestOk', { x: r.model, y: faNum(r.ms) });
        if (n) { fillGemModelList(r.models); store.set('gemModelList', r.models); }
        toast(t('set.ai.gemTestToastOk'), '#i-check');
      } else {
        gemTestOut.className = 'set-note warn-note';
        gemTestOut.textContent = t('set.ai.gemTestFail', { x: (r && r.error) || '?' });
        if (r && Array.isArray(r.models) && r.models.length) fillGemModelList(r.models);
      }
    });
  }

  /* ============================================================
     v0.39 — انتخابگر کامل مدل جمنای
     گزارش کاربر: «نمی‌توانم مدل نوشته‌شده را کامل ببینم» — datalist فقط
     چند مورد نشان می‌داد. حالا دکمهٔ «فهرست مدل‌ها» کل مدل‌های زندهٔ
     همین کلید (کشف‌شده از خود گوگل) را با جستجو و اسکرول کامل نشان می‌دهد.
     ============================================================ */
  let gemModelAll = [];
  function fillGemModelList(list) {
    gemModelAll = (Array.isArray(list) ? list : []).map((m) => String(m).trim()).filter(Boolean);
    /* datalist هم با فهرست واقعی پر می‌شود تا پیشنهاد تایپ هم زنده شود */
    const dl = $('#geminiModelList');
    if (dl) {
      dl.innerHTML = '';
      for (const m of gemModelAll) { const o = document.createElement('option'); o.value = m; dl.appendChild(o); }
    }
    renderGemModelItems('');
  }
  function renderGemModelItems(q) {
    const box = $('#gemModelListDiv');
    if (!box) return;
    const cur = (optGeminiModel && optGeminiModel.value || '').trim();
    const f = String(q || '').trim().toLowerCase();
    const rows = gemModelAll.filter((m) => !f || m.toLowerCase().includes(f));
    box.innerHTML = '';
    if (!rows.length) {
      const p = document.createElement('p');
      p.className = 'gem-mempty';
      p.textContent = gemModelAll.length ? t('set.ai.gemModelsNone') : t('set.ai.gemModelsNone');
      box.appendChild(p);
      return;
    }
    for (const m of rows) {
      const it = document.createElement('button');
      it.type = 'button';
      it.className = 'gem-mitem' + (m === cur ? ' on' : '');
      it.innerHTML = `<span></span>${m === cur ? '<span class="gm-check">✓</span>' : ''}`;
      it.querySelector('span').textContent = m;
      it.addEventListener('click', () => {
        if (optGeminiModel) {
          optGeminiModel.value = m;
          optGeminiModel.dispatchEvent(new Event('change')); /* خودش توست ذخیره دارد */
        }
        renderGemModelItems($('#gemModelSearch') ? $('#gemModelSearch').value : '');
      });
      box.appendChild(it);
    }
  }
  const btnGemModels = $('#btnGemModels'), gemModelPanel = $('#gemModelPanel');
  if (btnGemModels && gemModelPanel) {
    btnGemModels.addEventListener('click', async () => {
      if (gemModelPanel.hidden) {
        gemModelPanel.hidden = false;
        renderGemModelItems('');
        /* تازه‌سازی از گوگل: فهرست واقعیِ همین کلید (کش ۳۰ دقیقه‌ای در main) */
        const key = settings.geminiKey || (optGeminiKey ? optGeminiKey.value.trim() : '');
        if (key && bridge && bridge.ai && bridge.ai.gemModels) {
          const r = await bridge.ai.gemModels({ key, base: settings.gemBase || '' }).catch(() => null);
          if (r && Array.isArray(r.models) && r.models.length) {
            fillGemModelList(r.models);
            store.set('gemModelList', r.models);
          } else if (!gemModelAll.length) {
            const note = $('#gemModelsNote');
            if (note) { note.hidden = false; note.textContent = t('set.ai.gemModelsNone'); }
          }
        } else if (!gemModelAll.length) {
          const note = $('#gemModelsNote');
          if (note) { note.hidden = false; note.textContent = t('set.ai.gemModelsNone'); }
        }
        const s = $('#gemModelSearch');
        if (s) { s.value = ''; s.focus(); }
      } else {
        gemModelPanel.hidden = true;
      }
    });
    const gs = $('#gemModelSearch');
    if (gs) gs.addEventListener('input', () => renderGemModelItems(gs.value));
  }
  /* فهرست ذخیره‌شدهٔ دفعهٔ قبل — همان اول انتخابگر پر باشد */
  try { const saved = store.get('gemModelList', []); if (Array.isArray(saved) && saved.length) fillGemModelList(saved); } catch (_) { /* noop */ }
  if (optOpenaiKey) optOpenaiKey.addEventListener('change', () => {
    settings.openaiKey = optOpenaiKey.value.trim();
    store.set('openaiKey', settings.openaiKey);
  });
  /* v0.13: انتخاب مدل جمنای / OpenAI — هر نامی قابل قبول است */
  if (optGeminiModel) optGeminiModel.addEventListener('change', () => {
    settings.geminiModel = (optGeminiModel.value || '').trim() || 'gemini-flash-latest';
    optGeminiModel.value = settings.geminiModel;
    store.set('geminiModel', settings.geminiModel);
    toast(t('toast.saved'), '#i-spark');
  });
  if (optOpenaiModel) optOpenaiModel.addEventListener('change', () => {
    settings.openaiModel = (optOpenaiModel.value || '').trim() || 'gpt-4o-mini';
    optOpenaiModel.value = settings.openaiModel;
    store.set('openaiModel', settings.openaiModel);
    toast(t('toast.saved'), '#i-spark');
  });

  optTts.addEventListener('change', () => {
    settings.tts = optTts.checked;
    store.set('tts', settings.tts);
    if (settings.tts) speak(t('tts.on'));
    else {
      stopGoogleSpeak();
      if (window.speechSynthesis) speechSynthesis.cancel();
    }
  });

  /* v0.65 — صدای کوچکِ بانمکِ پایان کار: خاموش/روشن */
  const optDoneSoundEl = $('#optDoneSound');
  if (optDoneSoundEl) optDoneSoundEl.addEventListener('change', () => {
    settings.doneSound = optDoneSoundEl.checked;
    store.set('doneSound', settings.doneSound);
    if (settings.doneSound) playDoneSound(); /* نمونهٔ زنده هنگام روشن‌کردن */
  });

  optAutoUpdate.addEventListener('change', () => {
    settings.autoUpdate = optAutoUpdate.checked;
    store.set('autoUpdate', settings.autoUpdate);
    if (bridge && bridge.updater) bridge.updater.setAuto(settings.autoUpdate);
    toast(settings.autoUpdate ? t('toast.autoOn') : t('toast.autoOff'), '#i-refresh');
  });

  /* --- زبان برنامه / تم / زبان گفتار --- */
  const optLang = $('#optLang');
  const optTheme = $('#optTheme');
  const optSttLang = $('#optSttLang');
  if (optLang) optLang.addEventListener('change', () => {
    settings.lang = optLang.value || 'fa';
    store.set('lang', settings.lang);
    LANG = settings.lang;
    applyI18n();
    refreshSettingsUI();
    toast(t('toast.langChanged'), '#i-lang');
  });
  if (optTheme) optTheme.addEventListener('change', () => setTheme(optTheme.value));
  if (optSttLang) optSttLang.addEventListener('change', () => {
    settings.sttLang = optSttLang.value || 'fa-IR';
    store.set('sttLang', settings.sttLang);
    toast((LANG === 'en' ? 'Speech language: ' : 'زبان گفتار: ') + (settings.sttLang === 'fa-IR' ? 'فارسی' : 'English'), '#i-globe');
  });

  optTop.addEventListener('change', async () => {
    if (!bridge || !bridge.settings) { optTop.checked = false; needApp(); return; }
    try {
      const v = await bridge.settings.setAlwaysOnTop(optTop.checked);
      optTop.checked = !!v;
      toast(v ? (LANG === 'en' ? 'AVA stays on top now' : 'آوا حالا همیشه روون است') : (LANG === 'en' ? 'Always-on-top is off' : 'حالت همیشه‌روون خاموش شد'), '#i-power');
    } catch (_) { optTop.checked = false; }
  });

  optLogin.addEventListener('change', async () => {
    if (!bridge || !bridge.settings) { optLogin.checked = false; needApp(); return; }
    try {
      const v = await bridge.settings.setLoginItem(optLogin.checked);
      if (v === null || v === undefined) {
        optLogin.checked = false;
        toast(t('toast.onlyApp'), '#i-info');
      } else {
        optLogin.checked = !!v;
        toast(v ? (LANG === 'en' ? 'Auto-start with Windows is on' : 'اجرای خودکار با ویندوز فعال شد') : (LANG === 'en' ? 'Auto-start is off' : 'اجرای خودکار خاموش شد'), '#i-power');
      }
    } catch (_) { optLogin.checked = false; }
  });

  /* --- موتور تشخیص گفتار و کلید GLM --- */
  optSttEngine.addEventListener('change', () => {
    settings.sttEngine = optSttEngine.value || 'auto';
    store.set('sttEngine', settings.sttEngine);
    refreshEngineUI();
    if (settings.sttEngine === 'glm' && !settings.glmKey) {
      optGlmKey.focus();
      toast(LANG === 'en' ? 'The GLM engine needs a key — or pick "Auto"/"Free Google"' : 'موتور GLM به کلید نیاز دارد — یا موتور «خودکار»/«گوگل رایگان» را انتخاب کن', '#i-key');
    }
    if (settings.sttEngine === 'gemini' && !settings.geminiKey) {
      const k = $('#optGeminiKey'); if (k) k.focus();
      toast(LANG === 'en' ? 'Gemini speech needs your free Gemini key (AI settings)' : 'موتور جمنای به کلید رایگان جمنای نیاز دارد — از بخش هوش مصنوعی واردش کن', '#i-key');
    }
    if (settings.sttEngine === 'whisper' && !settings.whisperKey) {
      const k = $('#optWhisperKey'); if (k) k.focus();
      toast(LANG === 'en' ? 'Whisper needs an API key (Groq is free)' : 'Whisper به کلید API نیاز دارد — Groq پلن رایگان دارد؛ کلید را پایین وارد کن', '#i-key');
    }
  });

  optGlmKey.addEventListener('change', () => {
    settings.glmKey = optGlmKey.value.trim();
    store.set('glmKey', settings.glmKey);
    refreshEngineUI();
    toast(settings.glmKey ? t('toast.keySaved') : t('toast.keyCleared'), '#i-key');
  });

  btnKeyShow.addEventListener('click', () => {
    const show = optGlmKey.type === 'password';
    optGlmKey.type = show ? 'text' : 'password';
    btnKeyShow.querySelector('span').textContent = show ? (LANG === 'en' ? 'Hide' : 'مخفی') : t('set.ai.show');
  });


  /* v0.28 — خطای رایج کاربر: کلید جمنای (AIza…) در «کلید اختصاصی گوگل» بخش
     تشخیص گفتار چسبانده می‌شود و بعد «کلید جمنای ثبت نشده» دیده می‌شود.
     کلیدِ AIza خودکار به جای درستش (بخش هوش مصنوعی) می‌رود. */
  optGoogleKey.addEventListener('change', () => {
    const v = optGoogleKey.value.trim();
    if (v && /^AIza/.test(v)) {
      settings.geminiKey = v;
      store.set('geminiKey', v);
      settings.googleKey = '';
      optGoogleKey.value = '';
      store.set('googleKey', '');
      refreshEngineUI();
      toast(t('set.ai.gemMoved'), '#i-key');
      return;
    }
    settings.googleKey = v;
    store.set('googleKey', settings.googleKey);
    refreshEngineUI();
    toast(settings.googleKey ? t('toast.gKeySaved') : t('toast.gKeyCleared'), '#i-key');
  });

  /* v0.27 — بستهٔ آفلاین همیشه-کار: دانلود یک‌بار، تبدیل صدای برای همیشه داخلی */
  const btnOfflineDl = $('#btnOfflineDl');
  if (btnOfflineDl) btnOfflineDl.addEventListener('click', async () => {
    if (!bridge || !bridge.stt || !bridge.stt.localDownload) { toast(t('toast.onlyApp'), '#i-info'); return; }
    if (localStat.downloading) return;
    localStat.downloading = true;
    btnOfflineDl.disabled = true;
    updateOfflineCard();
    setOffProgress(1, 'dl');
    const r = await bridge.stt.localDownload().catch(() => ({ ok: false }));
    localStat.downloading = false;
    localStat.installed = !!(r && (r.ok || r.already));
    localStat.ready = !!(r && r.ready);
    btnOfflineDl.disabled = false;
    setOffProgress(100, r && r.ok ? 'done' : '');
    if (r && r.ok) {
      toast(t('set.off.done'), '#i-wave');
      setTimeout(() => setOffProgress(0, ''), 1500);
    } else {
      toast(t('set.off.fail'), '#i-info');
      setTimeout(() => setOffProgress(0, ''), 800);
    }
    updateOfflineCard();
    refreshEngineUI();
  });

  /* v0.17 — تنظیمات Whisper سازگار با OpenAI (Groq/OpenAI/سرور محلی) */
  const optWhisperBase = $('#optWhisperBase');
  const optWhisperKey = $('#optWhisperKey');
  const optWhisperModel = $('#optWhisperModel');
  if (optWhisperKey) optWhisperKey.addEventListener('change', () => {
    settings.whisperKey = optWhisperKey.value.trim();
    store.set('whisperKey', settings.whisperKey);
    refreshEngineUI();
    toast(settings.whisperKey ? t('toast.keySaved') : t('toast.keyCleared'), '#i-key');
  });
  if (optWhisperBase) optWhisperBase.addEventListener('change', () => {
    settings.whisperBase = optWhisperBase.value.trim() || 'https://api.groq.com/openai/v1';
    store.set('whisperBase', settings.whisperBase);
  });
  if (optWhisperModel) optWhisperModel.addEventListener('change', () => {
    settings.whisperModel = optWhisperModel.value.trim() || 'whisper-large-v3-turbo';
    store.set('whisperModel', settings.whisperModel);
  });

  btnGoZai.addEventListener('click', () => {
    showView('chat');
    selectChatTab('zai');
    toast(t('zai.loginHint'), '#i-globe');
  });

  optAiModel.addEventListener('change', () => {
    settings.glmModel = optAiModel.value;
    store.set('glmModel', settings.glmModel);
    toast((LANG === 'en' ? 'Chat model: ' : 'مدل گفتگو: ') + optAiModel.selectedOptions[0].textContent, '#i-spark');
  });

  /* --- انتخاب صدای گوینده --- */
  function fillVoiceSelect() {
    if (!('speechSynthesis' in window)) {
      optVoice.innerHTML = '<option value="">بدون موتور گفتار</option>';
      optVoice.disabled = true;
      return;
    }
    optVoice.disabled = false;
    const voices = speechSynthesis.getVoices() || [];
    const faFirst = [...voices].sort((a, b) => (/^fa/i.test(b.lang) ? 1 : 0) - (/^fa/i.test(a.lang) ? 1 : 0));
    let html = '<option value="">خودکار (فارسی اگر نصب باشد)</option>';
    faFirst.forEach((v) => {
      const sel = settings.voiceURI === v.voiceURI ? ' selected' : '';
      html += `<option value="${v.voiceURI}"${sel}>${v.name} — ${v.lang}</option>`;
    });
    optVoice.innerHTML = voices.length ? html : '<option value="">صدایی یافت نشد</option>';
  }
  optVoice.addEventListener('change', () => {
    settings.voiceURI = optVoice.value || '';
    store.set('voiceURI', settings.voiceURI);
    speak('سلام! من آوا هستم.');
  });
  if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = fillVoiceSelect;
    setTimeout(fillVoiceSelect, 300);
  }

  /* --- به‌روزرسانی (+ بج نوار بالا v0.11) --- */
  let updVersion = '';
  let updUiState = ''; /* v0.21 — وضعیت فعلی برای رفتار بج */
  let updManualDling = false; /* v0.21 — دانلود مستقیم در جریان است؟ */
  function setBadge(state, version, percent) {
    if (!btnUpdBadge || !updBadgeTxt) return;
    updVersion = version || updVersion || '';
    switch (state) {
      case 'available':
        btnUpdBadge.hidden = false;
        btnUpdBadge.classList.add('dl');
        btnUpdBadge.classList.remove('ready');
        updBadgeTxt.textContent = t('upd.badge');
        break;
      case 'downloading':
        btnUpdBadge.hidden = false;
        btnUpdBadge.classList.add('dl');
        btnUpdBadge.classList.remove('ready');
        updBadgeTxt.textContent = t('upd.badgeDl', { x: faNum(percent || 0) });
        break;
      case 'ready':
        btnUpdBadge.hidden = false;
        btnUpdBadge.classList.remove('dl');
        btnUpdBadge.classList.add('ready');
        updBadgeTxt.textContent = t('upd.badgeReady');
        break;
      default:
        btnUpdBadge.hidden = true;
    }
  }
  if (btnUpdBadge) btnUpdBadge.addEventListener('click', () => {
    if (btnUpdBadge.classList.contains('ready') && bridge && bridge.updater) {
      toast(t('toast.updInstalling'), '#i-download');
      bridge.updater.install();
    } else if (btnUpdBadge.classList.contains('dl') && bridge && bridge.updater) {
      /* v0.21 — بج «نسخه جدید» = شروع دانلود (دانلود دیگر خودکار نیست) */
      if (updUiState === 'downloading') {
        toast(t('upd.downloading', { x: '…' }), '#i-download');
        showView('settings');
      } else {
        toast(t('upd.startDlToast', { x: faNum(updVersion || '') }), '#i-download');
        startUpdDownload();
      }
    } else if (bridge && bridge.updater) {
      bridge.updater.check().catch(() => {});
    } else {
      toast(t('toast.updOnlyApp'), '#i-refresh');
    }
  });

  /* v0.21 — شروع/ادامهٔ دانلود (همون دکمه برای ادامه بعد از توقف) */
  function startUpdDownload() {
    if (!bridge || !bridge.updater || !bridge.updater.download) return;
    if (btnUpdDownload) { btnUpdDownload.disabled = true; }
    bridge.updater.download().catch(() => ({ ok: false })).then((r) => {
      if (btnUpdDownload) { btnUpdDownload.disabled = false; }
      /* نتیجه توسط رویدادهای updater:status نشان داده می‌شود؛ فقط خطای غیرلغو */
      if (r && r.ok === false && !r.cancelled && !r.dev) {
        setUpdUI({ state: 'error', message: r.error || '' });
      }
    });
  }

  /* v0.26 — کارت بروزرسانی بوت: هر بار باز شدن برنامه، اگر نسخهٔ جدید باشد،
     یک کارت واضح وسط صفحه می‌آید (بج نوار بالا دیده نمی‌شد و کاربر بی‌خبر
     می‌ماند که همهٔ مشکلاتش در نسخهٔ جدید حل شده). یک بار در هر نشست. */
  const updCardWrap = $('#updCardWrap');
  function maybeUpdCard(s) {
    try {
      if (!updCardWrap || !s || !s.version) return;
      if (sessionStorage.getItem('ava.updCardShown') === s.version) return;
      sessionStorage.setItem('ava.updCardShown', s.version);
      const cv = $('#updCardVer');
      if (cv) cv.textContent = t('upd.cardVer', { x: faNum(s.version) });
      const ct = $('#updCardTitle');
      if (ct) ct.textContent = t('upd.cardTitle'); /* v0.60 — تیتر کارت آپدیت هم دوزبانه شد */
      const cb = $('#updCardBody');
      if (cb) cb.textContent = t('upd.cardBody');
      const cn = $('#updCardNow');
      if (cn) cn.textContent = t('upd.cardNow');
      const cl = $('#updCardLater');
      if (cl) cl.textContent = t('upd.cardLater');
      updCardWrap.hidden = false;
    } catch (_) { /* noop */ }
  }
  if (updCardWrap) {
    $('#updCardNow') && $('#updCardNow').addEventListener('click', () => {
      updCardWrap.hidden = true;
      startUpdDownload();
      showView('settings'); /* کاربر پیشرفت دانلود را ببیند */
    });
    $('#updCardLater') && $('#updCardLater').addEventListener('click', () => { updCardWrap.hidden = true; });
  }

  function setUpdUI(s) {
    updProgress.hidden = true;
    btnInstallUpdate.hidden = true;
    if (btnManualDl) btnManualDl.hidden = true;
    if (btnCheckUpdate) btnCheckUpdate.disabled = false;
    if (btnUpdDownload) btnUpdDownload.hidden = true;
    if (btnUpdPause) btnUpdPause.hidden = true;
    if (btnUpdCancel) btnUpdCancel.hidden = true;
    updUiState = (s && s.state) || '';
    switch (s && s.state) {
      case 'checking':
        updNote.textContent = t('upd.checking');
        break;
      case 'available':
        updNote.textContent = t('upd.available', { x: faNum(s.version || '') });
        /* v0.21 — نسخهٔ جدید پیدا شد؛ دانلود فقط با کلیک کاربر */
        if (btnUpdDownload) btnUpdDownload.hidden = false;
        setBadge('available', s.version);
        maybeUpdCard(s); /* v0.26 — بج کافی نبود؛ کارت بوت */
        break;
      case 'available-manual':
        updNote.textContent = t('upd.availableManual', { x: faNum(s.version || '') });
        if (btnManualDl) btnManualDl.hidden = false;
        if (btnUpdDownload) btnUpdDownload.hidden = false;
        setBadge('available', s.version);
        maybeUpdCard(s); /* v0.26 */
        break;
      case 'downloading': {
        const pct = faNum(s.percent || 0);
        /* v0.21 — نمایش مگابایت واقعی منتقل‌شده (دلتا یا کامل؟) */
        if (typeof s.transferred === 'number' && typeof s.total === 'number' && s.total > 0) {
          updNote.textContent = t('upd.downloadingMB', {
            x: pct, a: faNum(s.transferred), b: faNum(s.total),
            d: s.delta ? t('upd.delta') : '',
          });
        } else {
          updNote.textContent = t('upd.downloading', { x: pct });
        }
        updProgress.hidden = false;
        updBar.style.width = `${Math.max(4, s.percent || 0)}%`;
        if (btnUpdPause) btnUpdPause.hidden = false;
        if (btnUpdCancel) btnUpdCancel.hidden = false;
        setBadge('downloading', s.version, s.percent);
        break;
      }
      case 'paused':
        /* v0.21 — توقف: همان دکمهٔ دانلود = ادامه */
        updNote.textContent = t('upd.paused', { x: faNum(s.percent || 0) });
        updProgress.hidden = false;
        updBar.style.width = `${Math.max(4, s.percent || 0)}%`;
        if (btnUpdDownload) { btnUpdDownload.hidden = false; btnUpdDownload.querySelector('span').textContent = t('set.upd.resume'); }
        setBadge('available', updVersion);
        break;
      case 'canceled':
        updNote.textContent = t('upd.canceled');
        if (btnUpdDownload) { btnUpdDownload.hidden = false; btnUpdDownload.querySelector('span').textContent = t('set.upd.download'); }
        setBadge('');
        break;
      case 'ready':
      case 'ready-manual':
        updNote.textContent = t('upd.ready', { x: faNum(s.version || '') });
        btnInstallUpdate.hidden = false;
        if (btnUpdDownload) btnUpdDownload.querySelector('span').textContent = t('set.upd.download');
        setBadge('ready', s.version);
        toast(t('toast.updReady'), '#i-download');
        break;
      case 'none':
        updNote.textContent = t('upd.none');
        setBadge('');
        break;
      case 'dev':
        updNote.textContent = t('upd.dev');
        setBadge('');
        break;
      case 'error':
        updNote.textContent = t('upd.error', { x: String(s.message || '').slice(0, 90) });
        setBadge('');
        break;
      default:
        updNote.textContent = t('upd.default');
    }
  }

  if (bridge && bridge.updater) {
    bridge.updater.onStatus(setUpdUI);
    if (bridge.updater.setAuto) bridge.updater.setAuto(settings.autoUpdate);
    btnCheckUpdate.addEventListener('click', async () => {
      btnCheckUpdate.disabled = true;
      updNote.textContent = 'در حال بررسی نسخه جدید…';
      const r = await bridge.updater.check().catch(() => ({ ok: false, error: 'اتصال برقرار نشد' }));
      btnCheckUpdate.disabled = false;
      if (r && r.dev) setUpdUI({ state: 'dev' });
      else if (r && !r.ok) setUpdUI({ state: 'error', message: r.error });
      else if (r && r.ok) setUpdUI({ state: 'checking' });
    });
    /* v0.21 — دانلود / توقف / لغو */
    if (btnUpdDownload) btnUpdDownload.addEventListener('click', () => startUpdDownload());
    if (btnUpdPause) btnUpdPause.addEventListener('click', async () => {
      await bridge.updater.cancel(true).catch(() => ({}));
      toast(t('upd.pauseToast'), '#i-pause');
    });
    if (btnUpdCancel) btnUpdCancel.addEventListener('click', async () => {
      await bridge.updater.cancel(false).catch(() => ({}));
      toast(t('upd.cancelToast'), '#i-close');
    });
    btnInstallUpdate.addEventListener('click', () => {
      toast(t('toast.updInstalling'), '#i-download');
      bridge.updater.install();
    });
    if (btnManualDl) btnManualDl.addEventListener('click', async () => {
      btnManualDl.disabled = true;
      updManualDling = true;
      toast(t('upd.directDlToast'), '#i-download');
      const r = await bridge.updater.downloadManual().catch(() => ({ ok: false }));
      btnManualDl.disabled = false;
      updManualDling = false;
      if (r && (r.ok || r.dev || r.latest)) return;
      if (r && r.cancelled) { setUpdUI({ state: 'canceled' }); return; }
      toast((r && r.error) ? `خطا: ${r.error}` : t('upd.manualFailToast'), '#i-info');
    });
  } else {
    btnCheckUpdate.addEventListener('click', () => toast(t('toast.updOnlyApp'), '#i-refresh'));
    btnInstallUpdate.addEventListener('click', needApp);
  }

  /* --- پیوندها (باز شدن در مرورگر پیش‌فرض) --- */
  document.querySelectorAll('#settingsPage [data-url]').forEach((b) =>
    b.addEventListener('click', async () => {
      const url = b.dataset.url;
      if (bridge && bridge.system && bridge.system.openUrl) {
        const r = await bridge.system.openUrl(url);
        if (!r || !r.ok) toast(t('toast.linkFail'), '#i-info');
      } else {
        window.open(url, '_blank');
      }
    })
  );

  /* ============================================================
     فرمان‌های سفارشی (ساخته‌شده با هوش مصنوعی) + مودال تأیید
     ============================================================ */
  let confirmResolve = null;

  const normFa = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/\u064A/g, '\u06CC')
      .replace(/\u0643/g, '\u06A9')
      .replace(/[\s\u200C]+/g, ' ')
      .trim();

  function findCustomRule(cmd) {
    const n = normFa(cmd);
    if (!n) return null;
    const cc = customCmds.find((c) => (c.phrases || []).some((p) => n.includes(normFa(p))));
    if (!cc) return null;
    return {
      custom: true,
      k: /.*/,
      t: cc.title || 'فرمان سفارشی',
      i: '#i-spark',
      r: async () => runCustom(cc),
    };
  }

  async function runCustom(cc) {
    const act = cc.action || {};
    if (act.type === 'open_url') {
      if (bridge && bridge.system && bridge.system.openUrl) {
        const r = await bridge.system.openUrl(act.value);
        return r && r.ok ? `«${cc.title}» ${LANG === 'en' ? 'is open.' : 'باز شد.'}` : (LANG === 'en' ? 'Could not open the link.' : 'باز کردن لینک ممکن نشد.');
      }
      window.open(act.value, '_blank');
      return `«${cc.title}» ${LANG === 'en' ? 'is open (in the browser).' : 'باز شد (در مرورگر).'}`;
    }
    if (act.type === 'run') {
      if (!canRun) return t('toast.onlyApp') + '.';
      const r = await bridge.system.run(act.value);
      return r && r.ok ? `«${cc.title}» ${LANG === 'en' ? 'ran.' : 'انجام شد.'}` : `${LANG === 'en' ? 'Failed' : 'اجرا نشد'}: ${(r && r.error) || '—'}`;
    }
    if (act.type === 'ps') {
      if (!bridge || !bridge.custom) return t('toast.onlyApp') + '.';
      const okGo = await askConfirm({
        title: LANG === 'en' ? 'Run custom command' : 'اجرای فرمان سفارشی',
        text: LANG === 'en'
          ? `This PowerShell script is saved for the command "${cc.title}". Run it?`
          : `اسکریپت PowerShell زیر برای فرمان «${cc.title}» ذخیره شده. اجرا شود؟`,
        code: act.value,
      });
      if (!okGo) return t('cf.cancelled');
      const r = await bridge.custom.run(act.value);
      if (r && r.ok) return (r.out ? `${LANG === 'en' ? 'Done' : 'انجام شد'}: ${r.out}` : (LANG === 'en' ? 'Done.' : 'انجام شد.')) + '';
      return `${LANG === 'en' ? 'Failed' : 'اجرا نشد'}: ${(r && r.error) || '—'}`;
    }
    return LANG === 'en' ? 'Unsupported custom command type.' : 'نوع فرمان سفارشی پشتیبانی نمی‌شود.';
  }

  function askConfirm({ title, text, code }) {
    return new Promise((resolve) => {
      cfTitle.textContent = title || 'تأیید';
      cfText.textContent = text || '';
      if (code) { cfCode.hidden = false; cfCode.textContent = code; }
      else cfCode.hidden = true;
      confirmBox.hidden = false;
      confirmResolve = resolve;
    });
  }
  function hideConfirm(val) {
    if (confirmBox.hidden) return;
    confirmBox.hidden = true;
    if (confirmResolve) { confirmResolve(!!val); confirmResolve = null; }
  }
  btnConfirmOk.addEventListener('click', () => hideConfirm(true));
  btnConfirmCancel.addEventListener('click', () => hideConfirm(false));

  /* فرمان‌های سفارشی دیگر چیپ جدا نیستند — در چرخه «پیشنهاد شانسی» می‌چرخند */
  function renderCustomChips() {
    /* rebuild: فرمان‌های سفارشی را به فهرست پیشنهادها اضافه/حذف می‌کنیم */
    SUGGESTIONS.length = BASE_SUGGESTIONS.length;
    customCmds.forEach((cc) => {
      SUGGESTIONS.push({ cmd: cc.title, en: cc.title, icon: '#i-spark', custom: true });
    });
  }

  /* ============================================================
     چت با هوش مصنوعی GLM — بدون کلید API (با نشست حساب z.ai) یا با کلید
     ============================================================ */
  /* v0.60 — نشانِ بافتار تحقیق وب: گاردهای دور دوم و سازندهٔ بلوک نتایج همه از این ثابت استفاده می‌کنند
     (بایت‌ها عین رشتهٔ قبلی است — فقط منبع واحد شد) */
  const RESEARCH_CTX_MARK = '[نتایج واقعی وب';
  const AI_SYSTEM_FA =
    'تو مغز دستیار صوتی فارسی «آوا» هستی که روی ویندوز اجرا می‌شود و به فرمان‌های کاربر گوش می‌دهی.\n' +
    'همیشه فارسی، کوتاه (حداکثر ۳ جمله)، دوستانه و مفید جواب بده.\n' +
    /* v0.52 — پروتکل فکر (خواستهٔ صریح کاربر: «چرا AI خودش تحلیل نمی‌کنه جمله رو؛
       شاید یک سوال باشه؛ باید با خودش فکر کنه، بعد که فکر کرد و تحقیق کرد، بعد جواب بده») */
    'پروتکل صفر (همیشه، قبل از هر پاسخ): اول با خودت فکر کن، بعد جواب بده — اولین خطِ هر پاسخ باید دقیقاً این قالب باشد:\n' +
    'فکر: نوع جمله (سوال/فرمان/گفتگو/اصلاح/مبهم) | خواستهٔ واقعی کاربر | نیاز به اطلاعات تازهٔ وب: بله/خیر\n' +
    'این خط فقط تحلیلِ درونی توست و هرگز خوانده یا نمایش داده نمی‌شود؛ بعد از آن پاسخ واقعی را بنویس.\n' +
    /* v0.36 — قواعد مسیریابی (گزارش کاربر: «جوک را سرچ کرد» / «سایت را کامل سرچ کرد») */
    'قانون مهم ۱: اگر کاربر جوک/جک/لطیفه/شوخی خواست (مثل «بابا یه جوک خفن بگو ولی از تو»)، خودت یک جوک کوتاه و تازه بگو — هرگز جستجو نکن و بلوک DO هم ننویس.\n' +
    'قانون مهم ۲: اگر کاربر باز کردن سایت/وبسایت خواست (مثل «سایت سافت 98 که خیلی خوبه رو باز کن»)، فقط اسمِ سایت را بردار (بندهای «که …» جزو اسم نیستند) و بلوک DO با open_url بده؛ دامنه را خودت حدس بزن (سافت 98=soft98.ir، دیجی‌کالا=digikala.com). هرگز کل جمله را جستجو نکن.\n' +
    /* v0.52 — قانون ۳ بازنویسی شد: سوالِ گفتگویی = خودت؛ سوالِ نیازمند اطلاعات تازه = RESEARCH (نه web_search، نه حدس) */
    'قانون مهم ۳ (به‌روزشده): اگر درخواست گفتگویی/سلیقه‌ای بود (جوک، نظر، چت، بگو/چرا/چطور)، خودت جواب بده و هیچ بلوکی ننویس؛ ولی اگر سوالِ نیازمند «اطلاعات تازهٔ وب» بود (جدیدترین، امروز، قیمت، آب‌وهوا، اخبار، آمار، یا هر چیزی که از جوابش مطمئن نیستی)، هرگز حدس نزن و هرگز web_search نزن — فقط این بلوک را بده تا نتایج واقعی وب به تو برگردد و در دور بعد جوابِ داده‌محور بدهی:\n' +
    '<<<RESEARCH>>>\n' +
    '{"query":"عبارت جستجو"}\n' +
    '<<<END>>>\n' +
    'سوالِ دانش عمومی پایدار (مثل پایتخت کشورها) را خودت از روی فکر جواب بده و بلوک ننویس. اگر جمله مبهم بود، به جای اجرای حدسی یک سوال کوتاه شفاف‌سازی بپرس.\n' +
    /* v0.39 — نگاشت فرمان نامتعارف به فرمان واقعی آوا */
    'قانون مهم ۴: اگر زیر پیام کاربر «فهرست فرمان‌های آوا» آمده و درخواستش هم‌معنای یکی از آن فرمان‌ها بود (حتی با تعبیر کاملاً متفاوت)، فقط بلوک DO بده با act=run_cmd و value=همان id — خودت آن کار را شبیه‌سازی نکن.\n' +
    /* v0.44 — قانون «فهم-اول» (خواستهٔ صریح کاربر: «توی دیوار دنبال موتور بگرد،
       نره گوگل سرچ کنه» + «اول تحلیل کنه واقعاً بفهمه») */
    'قانون مهم ۵ (بسیار مهم): اگر کاربر خواست «درون» یک هدف مشخص جستجو/پخش/باز شود (توی X دنبال Y بگرد / توی سایت X سرچ کن Y / برو به سایت X)، هرگز کل درخواست را به جستجوی عمومی گوگل تبدیل نکن — این سوءتفاهم بزرگ است. اول تحلیل کن: اگر X وب‌سایت معروفی است، URL واقعی جستجوی درون-سایتی خودِ X را بساز و با open_url بده (دیوار=divar.ir/s/{شهر-با-حروف-انگلیسی}?q=… — شهرِ خواسته‌شده را به اسلاگ لاتینِ خودِ دیوار تبدیل کن: بجنورد=bojnurd، تهران=tehran، مشهد=mashhad، اصفهان=isfahan، شیراز=shiraz، تبریز=tabriz، کرج=karaj، قم=qom، اهواز=ahvaz، رشت=rasht، کرمان=kerman، یزد=yazd، همدان=hamedan، …؛ شهر نگفته=tehran؛ هرگز /s/<city>/<دسته‌بندی>/ بساز نکن چون ۴۰۴ می‌شود)، شیپور=sheypoor.com/search?q=…، آپارات=aparat.com/search?text=…، دیجی‌کالا=digikala.com/search/?q=…، ترب=torob.com/search/?query=…، ایمالز=emalls.ir/?s=…، اینستاگرام=instagram.com/explore/tags/…، ردیت=reddit.com/search/?q=…). اگر X برنامهٔ نصب‌شده است (فهرست پایین را ببین) با open_app بازش کن و در reply بگو که برنامه باز شد. اگر X را واقعاً نمی‌شناسی، صادقانه در reply بگو نمی‌شناسم و نزدیک‌ترین برداشت درست را بپرس — جستجوی گوگلِ جایگزین فقط وقتی مجاز است که کاربر خودش «گوگل» را خواسته باشد.\n' +
    /* v0.46 — لاگ واقعی: AI برای «ایمال سرچ کن موتور» دو بار URLِ بی‌عبارت داد */
    'قانون مهم ۶ (بسیار مهم): اگر درخواست، جستجوی درون-سایتی است، URL باز‌شده باید خودِ عبارت جستجو را داخلش داشته باشد (مثل divar.ir/search?q=موتور یا emalls.ir/?s=موتور) — باز کردن صفحهٔ اصلی سایت بدون عبارتِ جستجو یعنی مأموریتِ نیمه‌کاره و ممنوع است.\n' +
    /* v0.49/v0.51 — درخواست چندمرحله‌ای/اکتشافی؛ از v0.51 وابسته به «آهنگ/ترانه/موسیقی/موزیک/ویدیو/فیلم/song|music|video» + «بذار/بزار/بزن/پخش/پلی/بیار/بگیر/play|put on» → آنگاه yt_play نتیجه‌گیری می‌کند */
    'قانون مهم ۷ (بسیار مهم): اگر درخواست چند مرحله دارد (اول X را بفهم، بعد Y را سرچ کن / اول ببین اسمش چیه بعد پخش کن) یا فعلِ «پیدا کن» دارد (مثل «آهنگ جدید فلانی رو برام پیدا کن»)، اگر هر دو مرحله بدون دیدن نتیجه قابل اجرا هستند توالی act را در همان بلوک DO بده (حداکثر ۳)؛ ولی اگر مرحلهٔ دوم نیازمند «دیدن نتیجهٔ اول» است (اسم واقعی/عدد/جزئیات)، قانون مهم ۸ را اجرا کن (act=research) — هرگز اسم/عنوان را از حافظه‌ات نساز و هرگز یک کارِ نامرتبط جایگزین نکن.\n' +
    /* v0.51 — قانون مهم ۸: پادزهر توهم در درخواست‌های «اول تحقیق بعد انجام بده» */
    'قانون مهم ۸ (بسیار مهم): اگر کاربر خواست اول تحقیق/فهمیدن و بعد انجام دادن (مثل: اول ببین آهنگ جدید شادمهر چی هست بعد اسمشو تو گوگل سرچ کن)، هرگز اسم یا عنوان را از حافظه‌ات نساز — در بلوک DO فقط act=research با value=عبارتِ تحقیق بده؛ نتایج واقعی وب به تو برمی‌گردد تا در دور بعد اکشن نهایی را فقط بر پایهٔ همان نتایج بدهی. اگر نتایج به سؤال جواب نداد، صادقانه بگو که چی پیدا نشد.\n' +
    /* v0.51 — دیکتهٔ یک‌باره (خواستهٔ کاربر: در هر برنامه‌ای که آمادهٔ تایپ است بنویسد؛ محدود به یک تعبیر نیست) */
    /* v0.60 (A11) — جملهٔ ارجاع به فرمان dict (run_cmd با value=dict) حذف شد:
       چنین rule idای وجود ندارد؛ اجرایش فقط فالبک صادق «چنین فرمانی نیست» می‌داد */
    'قانون مهم ۹ (مهم): اگر کاربر خواست متنی «همان‌جا که هست» نوشته/تایپ شود (اینجا بنویس… / ببین بنویس… / اینو تایپ کن… / هر تعبیر دیگری از نوشتن)، با act=type_once بده و value را متنِ عیناً خواسته‌شده بگذار (فقط واژه‌های فرمانی حذف شوند؛ متنِ داخل گیومه عیناً).\n' +
    /* v0.53 — قانون ارجاع به تاریخچه (لاگ واقعی 16:14:47: «همون آهنگ شادمهری که آخرین بار سرچ کردی» → توهم «قشنگترین گناه شادمهر») */
    /* v0.54 — قانون ۱۰ بازنویسی شد (بازخورد کاربر: در v0.52 جریانِ ارجاع+تحقیق درست کار می‌کرد — قانون نباید بهانهٔ ردِ اجرا شود) */
    'قانون مهم ۱۰ (بسیار مهم): اگر کاربر با ارجاع به گذشته حرف زد (همینو، همونو، اونو، همون، همونی که گفتی/سرچ کردی/پخش کردی، آخرین بار، قبلی، «همون آهنگ جدیدشو»)، مرجع را اول از «تاریخچهٔ همین گفتگو» بردار — مخصوصاً عنوانی که خودت چند پیام قبل در جواب گفتی. بعد از حلِ مرجع حتماً اکشن بده: پخش = music_play با عنوانِ حل‌شده؛ سرچ در یوتیوب = yt_search؛ سرچ گوگل = web_search. اگر مرجع در تاریخچه نبود، act=research بده یا صادقانه بپرس — هرگز عنوان را از حافظه‌ات نساز. این قانون هرگز مجوزِ رد کردن یا بی‌جواب گذاشتنِ خواستهٔ کاربر نیست.\n' +
    /* v0.63 — نگاشت مستقیم کنترل پخش (لاگ v0.62: «ببند/پین کن/ببر بالا سمت راست/
       بزرگتر کن» یا بی‌اکشن ماندند یا fullscreen اشتباه زده شد) */
    'قانون مهم ۱۱ (بسیار مهم): هر درخواستِ کنترلِ ویدیو/پلیر = بلوک DO با act=video_ctl: «ببند/بخوابون»=close؛ «پین کن/همیشه رویر/بیفته جلو»=pin؛ «دیگه رویر نباشه»=unpin؛ «ببر بالا سمت راست»=move:top-right؛ «ببر گوشه پایین چپ»=move:bottom-left؛ «ببر وسط»=move:center؛ «بزرگتر کن/ابعادشو زیاد کن»=grow؛ «کوچکتر کن»=shrink؛ «برو جلو ۳۰ ثانیه»=seek:30؛ «۱۰ ثانیه عقب»=seek:-10؛ «پاز کن»=play_pause؛ «ادامه بده/پلی کن»=play_pause؛ «بعدی/پاس کن»=next؛ «فول اسکرین کن»=fullscreen؛ صدای ویدیو=volume_up/volume_down. فرمانِ اجرایی هرگز بدونِ بلوک DO نمی‌ماند — این کارها هرگز سوال یا گفتگو نیستند. تنها استثنا: «شفافیت/کمرنگ/اپسیتی/شفاف کردن» ویدیو در پلیر سیستم ممکن نیست — بدونِ DO صادقانه بگو پلیر امکان شفاف‌سازی ندارد و هرگز shrink/grow جای آن نزن (لاگ v0.63: «کمرنگ کن» → shrink اشتباه شد).\n' +
    'قانون مهم ۱۲ (بسیار مهم): «بنویس X» / «تایپ کن X» / «برام بنویس که X» = بلوک DO با act=type_once و value=دقیقاً همان X — هرگز جوابِ چت نده و هرگز خودت متن را بازنویسی/خلاصه نکن. اگر درخواست چندمرحله‌ای بود (اول تحقیق/سرچ کن، بعد بنویس)، آخرین act باید type_once با متن نهایی باشد؛ پاسخِ بدونِ type_once وقتی کاربر «بنویس/تایپ کن» گفته ممنوع است (لاگ v0.51: «بررسی می‌کنم برام بنویس» → فقط جواب حرف زده شد و هیچ چیزی تایپ نشد).\n' +
    'اگر کاربر خواست کاری/فرمانی جدید به برنامه اضافه شود، یا درخواستش قابل تبدیل به یک فرمان سیستم باشد،\n' +
    'در انتهای پاسخ این بلوک را اضافه کن (وگرنه هیچ بلوکی ننویس):\n' +
    '<<<ADD>>>\n' +
    '{"title":"نام کوتاه فرمان","phrases":["عبارتی که کاربر می‌گوید"],"action":{"type":"...","value":"..."}}\n' +
    '<<<END>>>\n' +
    'قواعد action:\n' +
    '- type=open_url: باز کردن وب‌سایت؛ value آدرس کامل https\n' +
    '- type=run: اجرای فرمان آماده؛ value یکی از: open_chrome, open_notepad, open_calc, open_explorer, open_vscode, open_taskmgr, open_settings, open_paint, open_youtube, open_music, open_downloads, open_documents, minimize_all, lock, screenshot, vol_up, vol_down, vol_mute, vol_set, recycle_empty\n' +
    '- type=ps: اسکریپت کوتاه تک‌خطی و غیرمخرب PowerShell\n' +
    'مثال: اگر کاربر گفت «فرمان باز کردن تلگرام بساز»، بلوک را با open_url و آدرس https://web.telegram.org بساز.\n' +
    'اگر درخواست کاربر «انجام دادن یک کار» یا چند کار همزمان است (باز کردن برنامه، صدا، موزیک، دیسکورد، یادآوری، سایت، DNS)، به جای توضیح طولانی فقط این بلوک را بده:\n' +
    '<<<DO>>>\n' +
    '{"reply":"جواب کوتاه صوتی","actions":[{"act":"...","value":"..."}]}\n' +
    '<<<END>>>\n' +
    'کارهای مجاز act (حداکثر ۳ اکشن؛ فقط همین لیست):\n' +
    '- open_app: value=نام برنامه (کروم، تلگرام، فتوشاپ، بازی‌ها…)\n' +
    '- open_url: value=آدرس https؛ web_search: value=عبارت جستجو\n' +
    '- vol_up / vol_down / vol_mute؛ vol_set: value=عدد 0 تا 100\n' +
    /* v0.63 — video_play/video_ctl در پرامپت فارسی غایب بودند (لاگ v0.61/0.62:
       AI فرمتِ value را خودش حدس می‌زد — video_play(https://www.youtube.com/)) */
    '- video_play: value=عنوانِ دقیقِ ویدیو/فیلم برای پخش در پلیر پیش‌فرضِ کاربر، یا خودِ لینکِ کاملِ ویدیو — اگر کاربر گفت «لینکی که کپی کردم / در کلیپ‌بورد دارم»، value را دقیقاً __clipboard__ بگذار تا آوا لینک واقعی را از کلیپ‌بورد بخواند؛ هرگز آدرسِ ناقصِ بدونِ ویدیو مثل youtube.com خالی نده\n' +
    '- video_ctl: کنترل پلیر/پنجرهٔ ویدیو؛ value یکی از: play_pause|next|prev|stop|close|fullscreen|volume_up|volume_down|pin|unpin|grow|shrink|move:top-left|move:top-right|move:bottom-left|move:bottom-right|move:center|move:top|move:bottom|seek:-10|seek:30 — pin=همیشه رویر، grow=بزرگتر کردن، shrink=کوچکتر کردن، move=جابه‌جایی پنجره، seek=پرش ±ثانیه — «بزرگتر/کوچکتر کردنِ» ویدیو هرگز fullscreen نیست\n' +
    '- media_next / media_prev / media_toggle (پلیر سیستم)\n' +
    '- music_play: value=اسم آهنگ یا خالی؛ music_pause\n' +
    /* v0.54 — سرچ یوتیوب ابزار درست گرفت (لاگ v0.53 ۱۶:۴۹: AI برای «همینو برام تو یوتیوب سرچ کن» open_url(https://www.youtube.com/result) می‌داد = صفحهٔ خالی) */
    '- yt_search: value=عنوانِ دقیق برای جستجو در یوتیوب (مثال: کاربر گفت «تو یوتیوب به سلامتیت رو سرچ کن» → act=yt_search و value=به سلامتیت) — برای سرچ یوتیوب هرگز open_url با آدرسِ دست‌ساز مثل youtube.com/result نده\n' +
    /* v0.51 — پادزهر توهم (لاگ v0.50: AI اسم «نازنین» را از حافظه‌اش ساخت و دوبار یاد گرفت) */
    '- research: value=عبارت تحقیق وب — فقط وقتی کاربر خواست «اول بفهم/تحقیق کن، بعد انجام بده» (مثل: اول ببین آهنگ جدید شادمهر چی هست بعد اسمشو سرچ کن)؛ نتایج واقعی وب به تو برمی‌گردد و دور بعد باید اکشن نهایی را فقط بر پایهٔ همان نتایج بدهی — هرگز اسم/عنوان را از حافظه‌ات نساز\n' +
    '- type_once: value=متنِ دقیقی که کاربر خواست در برنامهٔ فعال نوشته شود — برای هر درخواستِ نوشتن/تایپ (اینجا بنویس… / ببین بنویس… / اینو تایپ کن…)؛ value را عیناً و کامل بنویس (فقط واژه‌های فرمان مثل «اینجا بنویس» را حذف کن)؛ اگر کاربر متن را در گیومه گفت فقط همان داخل گیومه\n' +
    '- screenshot / lock / monitor_off / minimize_all / recycle_empty؛ sys_sleep: فقط با درخواست صریح کاربر (برنامه تأیید می‌گیرد)\n' +
    '- dns_set: value=اسم پروفایل DNS؛ dns_reset (بدون value)\n' +
    '- reminder_add: value=متن کامل با زمان (مثل: ۲۰ دقیقه دیگه چایی درست کن)\n' +
    '  ⚠ ممنوعیت‌های سخت (v0.47): value هرگز فقط واژهٔ انتزاعی مثل «timer»/«status»/«بیدار» نیست — همیشه زمانِ واقعی + متن یادآوری را بنویس؛ اگر کاربر زمان نگفته، اول بپرس یا پاسخ متنی بده، هرگز reminder_add با value بی‌زمان نزن\n' +
    '- مثال‌های منفی (هرگز این خطاها را تکرار نکن): [باز کن]→run_custom نیست؛ عملِ ساخته‌شده در ذهن خودت (مثل run_custom(open_notepad) برای «نوت‌پد باز کن») ممنوع — یا open_app(notepad) بزن یا پاسخ متنی؛ از بین نبردن actهای ناموجود؛ dns_set فقط با درخواست صریح تغییر DNS\n' +
    '- note_show: value=بخشی از متن یک یادداشت ذخیره‌شدهٔ کاربر (یا خالی برای آخرین یادداشت) — یادداشت را برایش می‌خوانی\n' +
    '- discord_call: value=اسم مخاطب ذخیره‌شده؛ discord_mute؛ discord_unmute؛ discord_deafen؛ discord_hangup؛ discord_answer (جواب تماس)؛ discord_decline (رد تماس)\n' +
    '- set_wake_word: value=کلمهٔ بیدارباش جدید (فقط یک کلمه، مثل آوا یا اسم کاربر) — کاربر بیدارباش را عوض می‌کند\n' +
    '- run_custom: value=عنوان فرمان سفارشی قبلی\n' +
    'اگر فقط سوال است، جواب متنی کوتاه بده و هیچ بلوکی ننویس؛ اگر هم کار و هم سوال است، بلوک DO با reply بده.';
  const AI_SYSTEM_EN =
    'You are the AI brain of AVA, a Persian/English voice assistant for Windows.\n' +
    'Reply in the user\'s language, short (max 3 sentences), friendly and helpful.\n' +
    /* v0.52 — THINK protocol (user: the AI must analyze the sentence itself; if it is a question it must think, research, THEN answer) */
    'Zero protocol (always, before any answer): think first — the FIRST line of every reply must be exactly:\n' +
    'THINK: sentence type (question/command/chat/correction/ambiguous) | what the user really wants | needs fresh web facts: yes/no\n' +
    'That line is your inner analysis only and is never spoken or displayed; write the real answer after it.\n' +
    /* v0.36 — routing rules (user report: joke got web-searched / site name got web-searched) */
    'Important rule 1: if the user asks for a joke (جوک/جک/لطیفه), tell a short fresh joke yourself — NEVER search the web for it and write no DO block.\n' +
    'Important rule 2: if the user asks to open a website, extract ONLY the site name (relative clauses like «که …» are not part of it) and emit a DO block with open_url; guess the domain yourself (soft98.ir, digikala.com, zoomit.ir). NEVER web_search the whole sentence.\n' +
    /* v0.52 — rule 3 rewritten: conversational = yourself; fresh-facts question = RESEARCH block (never web_search, never guess) */
    'Important rule 3 (updated): conversational/opinion asks (joke, chat, greetings, tell me / why / how) — answer yourself and write no block; but a question needing FRESH web facts (newest, today, price, weather, news, stats, or anything you are unsure about) must NEVER be guessed and NEVER become web_search — reply with ONLY this block so real web results return to you next turn:\n' +
    '<<<RESEARCH>>>\n' +
    '{"query":"the search query"}\n' +
    '<<<END>>>\n' +
    'Stable general-knowledge questions: answer yourself from THINK, no block. If the request is ambiguous, ask one short clarifying question instead of guessing.\n' +
    /* v0.39 — map differently-phrased requests onto real AVA commands */
    'Important rule 4: if an "AVA command catalog" is attached below the user message and the request means one of those commands (even with totally different wording), reply with ONLY a DO block using act=run_cmd and value=<id> — do not simulate the action yourself.\n' +
    /* v0.44 — understand-first law (user: "توی دیوار دنبال موتور بگرد must not become a Google search") */
    'Important rule 5 (critical): when the user asks to search/play/open INSIDE a specific target (توی X دنبال Y بگرد / توی سایت X سرچ کن Y / برو به سایت X), NEVER turn the whole request into a generic Google search — that is a misunderstanding. Analyze first: if X is a well-known website, build the real in-site search URL and give it via open_url (divar.ir/s/{city-in-english}?q=… — transliterate the city the user named: Bojnord=bojnurd, Tehran=tehran, Mashhad=mashhad, Isfahan=isfahan, Shiraz=shiraz, Tabriz=tabriz, Karaj=karaj, Qom=qom, Ahvaz=ahvaz, Rasht=rasht; no city named = tehran; never build /s/<city>/<category>/ because it 404s, sheypoor.com/search?q=…, aparat.com/search?text=…, digikala.com/search/?q=…, torob.com/search/?query=…, emalls.ir/?s=…, instagram.com/explore/tags/…, reddit.com/search/?q=…). If X is an installed app (see the installed-apps list below) give open_app. If you truly do not know X, say so honestly in reply and ask for the closest correct reading — a substitute Google search is allowed ONLY when the user explicitly said Google.\n' +
    /* v0.46 — real log: AI returned query-less URLs twice for the same emalls request */
    'Important rule 6 (critical): for an in-site search request the open_url MUST CONTAIN the search query itself (like divar.ir/search?q=motor or emalls.ir/?s=motor) — opening the site homepage without the query is a half-done mission and is forbidden.\n' +
    /* v0.51 — anti-hallucination research phase (user log v0.50: AI invented the song name «نازنین» twice) */
    'Important rule 7 (critical, anti-hallucination): when the user asks you to FIRST find out / research and THEN act (e.g. "first see what the new song is called, then search it"), NEVER invent names or titles from memory — reply with a DO block containing ONLY act=research (value=the research query). Real web results come back to you in the next turn; then give the final actions based ONLY on those results. If the results do not answer it, say honestly that nothing was found.\n' +
    /* v0.51 — one-shot dictation (user: type into whatever box is focused; any phrasing) */
    /* v0.60 (A11) — removed the sentence pointing at run_cmd with value=dict: no such rule id exists; the honest fallback says "چنین فرمانی نیست" */
    'Important rule 8: when the user wants text WRITTEN right where they are (اینجا بنویس… / ببین بنویس… / type this… / any write phrasing), reply with act=type_once and value=the exact text verbatim (strip only the command words; if the text was quoted, keep only the quoted part).\n' +
    /* v0.53 — history-reference law (real log 16:14:47: "the same Shadmehr song you last searched" → hallucinated «قشنگترین گناه») */
    /* v0.61 — قانون ارجاع: حالا دو منبع واقعی دارد — «تاریخچهٔ گفتگو» و
       «موجودیت‌های آخرین موضوع» که هر دو واقعاً به همین پیام چسبانده شده‌اند؛
       عبارتِ ترمیم‌شدهٔ کاربر هم ممکن است خودش قبلاً «همینو» را با تیتر واقعی
       عوض کرده باشد (حل‌گر ارجاع AVACore). به‌روزشدگی متن مطابق همین منابع. */
    'Important rule 9 (critical): when the user refers to something EARLIER (همینو / همون / اونو / the one you said / searched / played / last time / previous), resolve the reference FIRST from the conversation history and the entity list attached to this message (تاریخچهٔ همین گفتگو / موجودیت‌های آخرین گفتگو) — especially a title YOU gave in an earlier answer. After resolving, ALWAYS execute: video/song play = video_play (or music_play for the local music library) with the resolved title; YouTube search = yt_search; Google = web_search. If it is not in the attached history, give act=research or ask honestly — NEVER invent titles from memory. This rule never justifies refusing or ignoring the user request.\n' +
    /* v0.63 — EN mirror of قانون ۱۱: player/video control mapping + never-leave-a-command rule */
    'Important rule 10 (critical): EVERY video/player control request = a DO block with act=video_ctl: "close it"=close؛ "pin / always on top"=pin؛ "stop being on top"=unpin؛ "move it to the top right"=move:top-right؛ "move to bottom left"=move:bottom-left؛ "center it"=move:center؛ "make it bigger"=grow؛ "make it smaller"=shrink؛ "forward 30 seconds"=seek:30؛ "back 10 seconds"=seek:-10؛ "pause/resume"=play_pause؛ "skip/next"=next؛ "fullscreen"=fullscreen؛ video volume=volume_up/volume_down. Making the video bigger/smaller is NEVER fullscreen. An understood command must NEVER remain without a DO block — these are never questions or chat. Sole exception: video opacity/transparency ("make it faded/transparent") is impossible for system players — answer honestly WITHOUT a DO that the player cannot do it; never substitute grow/shrink.\n' +
    'Important rule 11: "write X" / "type X" = a DO block with act=type_once and value=the exact X — NEVER answer in chat instead of typing, never rewrite or summarize X yourself. In a multi-step request (first search/find, then type) the LAST act must be type_once with the final text; a reply without type_once after a "write/type" request is forbidden.\n' +
    'If the user wants a new app command, append this block at the end (otherwise write no block):\n' +
    '<<<ADD>>>\n' +
    '{"title":"Short command name","phrases":["spoken phrase"],"action":{"type":"...","value":"..."}}\n' +
    '<<<END>>>\n' +
    'action rules:\n' +
    '- type=open_url: open a website; value is a full https URL\n' +
    '- type=run: run a built-in command; value one of: open_chrome, open_notepad, open_calc, open_explorer, open_vscode, open_taskmgr, open_settings, open_paint, open_youtube, open_music, open_downloads, open_documents, minimize_all, lock, screenshot, vol_up, vol_down, vol_mute, vol_set, recycle_empty\n' +
    '- type=ps: short single-line non-destructive PowerShell script\n' +
    'Example: "make a command to open Telegram" → block with open_url and https://web.telegram.org\n' +
    'If the request is "do an action" or several actions (open app, volume, music, discord, reminder, site, DNS), reply with only this block:\n' +
    '<<<DO>>>\n' +
    '{"reply":"short spoken reply","actions":[{"act":"...","value":"..."}]}\n' +
    '<<<END>>>\n' +
    'Allowed acts (max 3; this list only): open_app, open_url, web_search, yt_search(value=the exact title to search on YouTube — never build fake URLs like youtube.com/result), video_play(value=the exact title or URL to play — plays in the USER DEFAULT video player, preferred for "play X" video/movie requests; if the user means the link they COPIED, value=__clipboard__ so AVA reads the clipboard; never a bare youtube.com without a video id; if a full YouTube URL appears in the user message, copy it character-for-character into value — never shorten it to youtube.com), video_ctl(value=one of play_pause|next|prev|fullscreen|stop|close|volume_up|volume_down|pin|unpin|grow|shrink|move:top-left|move:top-right|move:bottom-left|move:bottom-right|move:center|move:top|move:bottom|seek:-10|seek:30 — pin=always on top, grow=bigger, shrink=smaller, move=window position, seek=jump seconds), vol_up, vol_down, vol_mute, vol_set(0-100), media_next, media_prev, media_toggle, music_play, music_pause, lock, screenshot, monitor_off, minimize_all, recycle_empty, sys_sleep(only on explicit request), dns_set, dns_reset, reminder_add, note_show(value=a fragment of a saved note, or empty for the latest), discord_call, discord_mute, discord_unmute, discord_deafen, discord_hangup, discord_answer, discord_decline, run_custom, set_wake_word(value=the new wake word, one word), research(value=a web research query; only for "first find out, then act" requests; results return to you next turn), type_once(value=the exact text to type into the focused app).\n' +
    'If it is just a question, answer in text with no block; if both, send a DO block with a reply.';
  const aiSystem = () => (LANG === 'en' ? AI_SYSTEM_EN : AI_SYSTEM_FA);

  let chatBusy = false;
  let chatHist = [];   // تاریخچه گفتگو برای حافظه کوتاه
  /* v0.70 — تأیید در انتظار برای کارهای حساس (ارسال پیام از مسیر مغز) */
  let _pendingConfirm = null;
  /* v0.70 — نمونهٔ هستهٔ حافظه (facts پایدار؛ contacts/notes آداپتور) */
  let _avaMemInst = null;
  function avaMem() {
    if (!_avaMemInst) {
      _avaMemInst = (window.AVAMemory && window.AVAMemory.createMemory)
        ? window.AVAMemory.createMemory((bridge && bridge.mem) ? { load: () => bridge.mem.load(), save: (d) => bridge.mem.save(d) } : null)
        : null;
    }
    return _avaMemInst;
  }
  let zaiToken = store.get('zaiToken', '');   /* v0.45 — توکن نشست z.ai کش می‌شود تا وب‌ویو تنبل بماند */

  /* در برنامه واقعی همیشه می‌توان AI را صدا زد؛ پل GLM خودش نشست حساب
     را در پنجره مخفی پیدا می‌کند (وگرنه پیام ورود نشان می‌دهد). */
  const aiConnected = () => !!(bridge && bridge.ai);

  function chatWelcome() {
    const ready = aiConnected();
    addMsg('bot', ready ? t('chat.welcomeOn') : t('chat.welcomeOff'));
  }

  function addMsg(role, text) {
    const m = document.createElement('div');
    m.className = `msg ${role === 'user' ? 'user' : role === 'err' ? 'err' : 'bot'}`;
    m.textContent = text;
    chatMsgs.appendChild(m);
    /* v0.44 — سبک‌سازی RAM (خواستهٔ صریح کاربر): حباب‌های خیلی قدیمی چت
       از DOM آزاد می‌شوند تا نشست‌های طولانی حافظه نگیرند */
    while (chatMsgs.children.length > 120) chatMsgs.removeChild(chatMsgs.firstChild);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
    return m;
  }
  /* v0.44 — سقف تاریخچهٔ چت (AI فقط ۸ پیامِ آخر را می‌خواند؛ نگهداشتنِ
     نامحدودش فقط RAM هدر می‌داد) */
  let vcPendingUser = null;
  function pushChatHist(role, content) {
    chatHist.push({ role, content: String(content == null ? '' : content).slice(0, 4000) });
    if (chatHist.length > 40) chatHist = chatHist.slice(-40);
    /* v0.61 — ستون ۱: هر رد و بدلِ AI (کاربر+پاسخ) به‌عنوان یک turn در
       حافظهٔ هستهٔ فهم ثبت می‌شود — resolveRefs و entityCtx از همین تغذیه می‌شوند */
    try {
      if (window.AVACore) {
        if (role === 'user') vcPendingUser = String(content == null ? '' : content);
        else if (role === 'assistant' && vcPendingUser != null) {
          window.AVACore.recordTurn({ utterance: vcPendingUser, via: 'ai', reply: String(content == null ? '' : content) });
          vcPendingUser = null;
        }
      }
    } catch (_) { /* noop */ }
  }

  /* استخراج بلوک افزودن فرمان از پاسخ AI */
  function parseAdd(text) {
    const t = String(text || '');
    const m = t.match(/<<<ADD>>>\s*([\s\S]*?)\s*<<<END>>>/);
    if (!m) return { reply: t.trim(), add: null };
    let add = null;
    try {
      const j = JSON.parse(m[1].replace(/^```(?:json)?/i, '').replace(/```$/, '').trim());
      if (j && j.title && j.action && j.action.type && j.action.value) add = j;
    } catch (_) { /* noop */ }
    return { reply: t.replace(m[0], '').trim(), add };
  }

  /* ---------- v0.20 — پروتکل اجرای عملی (Function Calling) ----------
     الگوی پروژهٔ مرجع: AI فقط «تصمیم» می‌گیرد؛ اجرای واقعی با کد محلی آوا و
     فقط از مسیرهای امن و شناسه‌دار. اگر لایه‌های آفلاین نفهمیدند، جمنای
     می‌تواند مستقیم کارها را به فرمان بدهد (حتی چند کار همزمان). */
  const DO_ACTS = ['open_app', 'open_url', 'web_search', 'yt_search', 'vol_up', 'vol_down', 'vol_mute', 'vol_set', 'media_next', 'media_prev', 'media_toggle', 'music_play', 'music_pause', 'lock', 'screenshot', 'monitor_off', 'sys_sleep', 'minimize_all', 'recycle_empty', 'dns_set', 'dns_reset', 'reminder_add', 'discord_call', 'discord_mute', 'discord_unmute', 'discord_deafen', 'discord_hangup', 'discord_answer', 'discord_decline', 'run_custom', 'run_cmd', 'note_show', 'set_wake_word', 'research', 'type_once', 'video_play', 'video_ctl']; /* v0.39 +run_cmd؛ v0.42 +note_show؛ v0.46 +set_wake_word؛ v0.51 +research (فاز تحقیق) +type_once (دیکتهٔ یک‌باره)؛ v0.54 +yt_search (سرچ یوتیوب بومی)؛ v0.61 +video_play (پخش با پلیر پیش‌فرض کاربر) +video_ctl (کنترل پلیر سیستم) */
  /* ---------- v0.63 — گرامر گستردهٔ video_ctl ----------
     لاگ v0.62: «پین کن/ببند/ببر بالا سمت راست/بزرگتر کن» یا بی‌اکشن ماندند یا
     fullscreen اشتباه زده شد. حالا value خامِ AI اینجا به action+arg اجرایی
     تبدیل می‌شود: pin/unpin (همیشه رویر)، move:موقعیت، grow/shrink (اندازه)،
     seek:±ثانیه — تابع مستقل از DOM تا در باتری تست زنده eval شود. */
  function videoCtlParse(value) {
    const raw = String(value == null ? '' : value).trim().toLowerCase()
      .replace(/[«»"']/g, '').replace(/\s+/g, ' ');
    const POS = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center', 'top', 'bottom', 'left', 'right'];
    const SIMP = ['play_pause', 'next', 'prev', 'stop', 'close', 'fullscreen', 'volume_up', 'volume_down', 'pin', 'unpin', 'grow', 'shrink'];
    if (/^move/.test(raw)) {
      let tail = raw.replace(/^move[:\s]*/, '').trim().replace(/[_/]/g, '-')
        .replace(/top\s*right/g, 'top-right').replace(/top\s*left/g, 'top-left')
        .replace(/bottom\s*right/g, 'bottom-right').replace(/bottom\s*left/g, 'bottom-left')
        .replace(/وسط|مرکز/g, 'center').replace(/بالا/g, 'top').replace(/پایین/g, 'bottom')
        .replace(/راست/g, 'right').replace(/چپ/g, 'left');
      if (POS.indexOf(tail) >= 0) return { action: 'move', arg: tail };
      const xy = tail.match(/^(-?\d+)\s*[,،]\s*(-?\d+)$/);
      if (xy) return { action: 'move', arg: { x: Math.round(+xy[1]), y: Math.round(+xy[2]) } };
      return { action: 'move', arg: 'center' };
    }
    if (/^seek/.test(raw)) {
      const n = parseFloat(raw.replace(/^seek[:\s]*/, '').replace(/[^\d.-]/g, ''));
      return { action: 'seek', arg: isNaN(n) ? 10 : Math.max(-300, Math.min(300, n)) };
    }
    if (SIMP.indexOf(raw) >= 0) return { action: raw, arg: 0 };
    const ALIAS = { pause: 'play_pause', play: 'play_pause', resume: 'play_pause', bigger: 'grow', larger: 'grow', smaller: 'shrink', always_on_top: 'pin', ontop: 'pin', untop: 'unpin' };
    if (ALIAS[raw]) return { action: ALIAS[raw], arg: 0 };
    const FA = { 'ببند': 'close', 'بخوابون': 'close', 'پاز': 'play_pause', 'پین': 'pin', 'رویر': 'pin', 'بزرگتر': 'grow', 'کوچکتر': 'shrink', 'فول اسکرین': 'fullscreen', 'بعدی': 'next', 'قبلی': 'prev' };
    if (FA[raw]) return { action: FA[raw], arg: 0 };
    return null;
  }
  /* v0.66 — هلپر مشترک پخش ویدیو (لَین URL + اکشن video_play هر دو همین یک
     مسیر می‌روند): پلیر مقصد (درخواستی/پیش‌فرض) + بازخورد فارسیِ صادقانه.
     خروجی { rep, ok } — ok فقط برای گیتِ صدای «انجام شد». */
  async function videoPlayReply(vq, playerWanted, origCmdForLog) {
    if (!bridge || !bridge.player || !bridge.player.open) return { rep: t('toast.onlyApp'), ok: false };
    const want = String(playerWanted || '').trim();
    try {
      const res = await bridge.player.open({ player: want || 'default', kind: 'query', src: vq });
      const where = (res && res.fa) ? ' — در ' + res.fa : '';
      if (res && res.ok && res.via === 'browser-fallback') return { rep: LANG === 'en'
        ? `Your player could not stream it — opened "${vq}" in the browser.`
        : `پلیر نتوانست یوتیوب را پخش کند — «${vq}» را در مرورگر باز کردم.`, ok: true };
      if (res && res.noVideoId) return { rep: LANG === 'en' ? 'That YouTube link has no video — copy the full video link and say it again.' : 'این آدرس یوتیوب ویدیوی مشخصی ندارد — لینک کامل ویدیو را کپی کن و دوباره بگو.', ok: false };
      if (res && res.ok) return { rep: LANG === 'en' ? `Playing "${vq}"${where}.` : `«${vq}» را پخش کردم${where}.`, ok: true };
      return { rep: LANG === 'en' ? `Could not play: ${res && res.error || ''}` : `پخش نشد: ${res && res.error || ''}`, ok: false };
    } catch (e) {
      try { actLog('videoPlayReply error: ' + String((e && e.message) || e).slice(0, 120)); } catch (_) { /* noop */ }
      return { rep: LANG === 'en' ? 'Player launch failed.' : 'اجرای پلیر ممکن نشد.', ok: false };
    }
  }
  function parseDo(text) {
    const t = String(text || '');
    const m = t.match(/<<<DO>>>\s*([\s\S]*?)\s*<<<END>>>/);
    if (!m) return { reply: t.trim(), do: null };
    let d = null;
    try {
      const j = JSON.parse(m[1].replace(/^```(?:json)?/i, '').replace(/```$/, '').trim());
      const acts = Array.isArray(j && j.actions)
        ? j.actions.slice(0, 3)
            .filter((a) => a && DO_ACTS.includes(a.act))
            .map((a) => ({ act: a.act, value: String(a.value == null ? '' : a.value).slice(0, 200).trim() }))
        : [];
      if (acts.length) d = { reply: String((j && j.reply) || '').slice(0, 300), actions: acts };
    } catch (_) { /* noop */ }
    return { reply: t.replace(m[0], '').trim(), do: d };
  }

  /* ---------- v0.52 — پروتکل فکر (THINK-FIRST BRAIN) ----------
     خواستهٔ صریح کاربر: «چرا AI خودش تحلیل نمی‌کنه جمله رو؟ شاید یک سوال باشه —
     باید با خودش فکر کنه، بعد که فکر کرد و تحقیق کرد، بعد جواب بده»
     • هر پاسخ AI با خط «فکر: …» شروع می‌شود (تحلیل درونی؛ هرگز گفته/نمایش داده نمی‌شود)
     • سوالِ نیازمند اطلاعات تازه → بلوک RESEARCH → وب‌گردی واقعی → دور دوم → جواب داده‌محور
     • فکر در لاگ می‌ماند: گفت/فهمید/کرد حالا برای مسیر AI هم کامل است */
  function stripThink(text) {
    const t = String(text || '');
    const m = t.match(/^\s*(?:فکر|THINK)\s*[:：]\s*([^\n]*)\n?/i);
    if (!m) return { think: '', body: t.trim() };
    return { think: m[1].trim().slice(0, 300), body: t.replace(m[0], '').trim() };
  }
  function parseResearch(text) {
    const t = String(text || '');
    const m = t.match(/<<<RESEARCH>>>\s*([\s\S]*?)\s*<<<END>>>/);
    if (!m) return { query: '', body: t.trim() };
    let q = '';
    try {
      const j = JSON.parse(m[1].replace(/^```(?:json)?/i, '').replace(/```$/, '').trim());
      q = String((j && (j.query || j.q)) || '').trim();
    } catch (_) {
      q = m[1].replace(/[{}"\n]/g, ' ').replace(/query\s*:/g, ' ').trim(); /* فرم خراب هم قابل استفاده باشد */
    }
    return { query: q.slice(0, 150), body: t.replace(m[0], '').trim() };
  }
  /* یک دور کامل: فکر → (در صورت نیاز) تحقیق واقعی وب → دور دوم داده‌محور.
     خروجی: { r, think, body, didResearch } — body بدون خط فکر و بدون بلوک RESEARCH */
  async function aiThinkRound(text, extraCtx) {
    const r = await aiAsk(text, extraCtx);
    if (!r || !r.ok) return { r, think: '', body: String((r && r.text) || ''), didResearch: false };
    const st = stripThink(r.text);
    if (st.think) actLog('interpret: گفت «' + String(text).slice(0, 48) + '» | فهمید(ai فکر) ' + st.think.slice(0, 120), 'ui', { ev: 'interpret', via: 'ai', think: st.think.slice(0, 220) });
    const rs = parseResearch(st.body);
    const _done = extraCtx && String(extraCtx).indexOf(RESEARCH_CTX_MARK) >= 0;
    if (rs.query && !_done && bridge && bridge.ai && bridge.ai.research) {
      actLog('ai research(جواب): «' + rs.query.slice(0, 80) + '» → وب‌گردی واقعی، بعد دور دوم');
      const rr = await bridge.ai.research(rs.query).catch(() => null);
      const rt = (rr && rr.text) || '';
      const ctx2 = (extraCtx || '') +
        '\n' + RESEARCH_CTX_MARK + ' برای «' + rs.query + '»]' +
        (rt ? '\n' + rt : '\n(تحقیق وب ناموفق بود — صادقانه بگو چی پیدا نشد)') +
        '\n[پایان نتایج — حالا فقط بر پایهٔ همین نتایج جواب نهایی بده؛ بلوک RESEARCH دیگر مجاز نیست و هرگز اسم/عنوان را از حافظه‌ات نساز]';
      const r2 = await aiAsk(text, ctx2);
      if (r2 && r2.ok) {
        const st2 = stripThink(r2.text);
        if (st2.think) actLog('ai فکر(دور۲): ' + st2.think.slice(0, 120));
        return { r: r2, think: st2.think || st.think, body: st2.body, didResearch: true };
      }
      actLog('research(جواب) دور دوم شکست → پاسخ عادی');
      return { r, think: st.think, body: rs.body, didResearch: false };
    }
    return { r, think: st.think, body: rs.body, didResearch: false };
  }
  const DO_RUN_LABEL = {
    vol_up: () => LANG === 'en' ? 'Volume raised.' : 'صدای سیستم را بلندتر کردم.',
    vol_down: () => LANG === 'en' ? 'Volume lowered.' : 'صدای سیستم را کمتر کردم.',
    vol_mute: () => LANG === 'en' ? 'Sound is muted.' : 'صدا قطع/وصل شد.',
    media_next: () => LANG === 'en' ? 'Next track.' : 'آهنگ بعدی در پلیر سیستم.',
    media_prev: () => LANG === 'en' ? 'Previous track.' : 'آهنگ قبلی در پلیر سیستم.',
    media_toggle: () => LANG === 'en' ? 'Play/pause toggled.' : 'پخش/توقف پلیر سیستم انجام شد.',
    lock: () => LANG === 'en' ? 'PC locked.' : 'صفحه قفل شد.',
    screenshot: () => LANG === 'en' ? 'Screenshot saved to Pictures.' : 'اسکرین‌شات در پوشهٔ تصاویر ذخیره شد.',
    monitor_off: () => t('pow.monitorOff'),
    minimize_all: () => LANG === 'en' ? 'All windows minimized.' : 'همهٔ پنجره‌ها کمینه شدند.',
    recycle_empty: () => LANG === 'en' ? 'Recycle bin emptied.' : 'سطل بازیافت خالی شد.',
  };
  async function executeDoActions(actions, origCmd) { /* v0.39 — origCmd برای run_cmd */
  /* v0.49 — URLهای درون‌سایتی AI با رجیستری واقعی اصلاح می‌شوند (لینک خراب دیوار ریشه‌ای بسته شد) */
  actions = (Array.isArray(actions) ? actions : []).map((x) => (x && x.act === 'open_url' && x.value) ? Object.assign({}, x, { value: siteUrlFix(x.value) }) : x);
    const outs = [];
    for (const a of actions) {
      try {
        /* v0.39 — نگاشت فرمان نامتعارف: AI فهمید درخواست هم‌معنای یکی از
           فرمان‌های آواست؛ اجرا با همان کد محلیِ آوا (بدون حلقه — مستقیم
           resolveReply، نه runCommand) */
        if (a.act === 'run_cmd') {
          const rr = RULES.find((x) => x.id === String(a.value || '').trim());
          if (!rr) { outs.push(LANG === 'en' ? 'That command is not in my list.' : 'چنین فرمانی در فهرست آوا نیست.'); break; }
          actLog('ai run_cmd → ' + rr.id);
          const out = await resolveReply(rr, String(origCmd || a.value || ''));
          /* v0.45 — پاسخ صادق: null (استثنا) دیگر «انجام شد» نمی‌گوید */
          outs.push(typeof out === 'string' && out ? out : (LANG === 'en' ? "Couldn't do it." : 'انجام نشد.'));
          if (rr.id && SUGGEST_TRIGGERS.has(rr.id)) maybeSuggestCommands('video');
          /* v0.41 — نگاشت موفق ذخیره شود؛ دفعهٔ بعدِ همین عبارت = اجرای آنی بی‌شبکه
             v0.45 — فقط «موفقیت» یاد گرفته می‌شود: پاسخ شکست («انجام نشد») هرگز
             کش نمی‌شود تا نگاشت خراب در حافظه ماندگار نشود */
          if (origCmd && typeof out === 'string' && out && !/انجام نشد|Couldn't/.test(out) && !(out && typeof out === 'object' && out.__aiFallback)) aiMapSet(origCmd, rr.id);
          continue;
        }
        switch (a.act) {
          case 'open_app': {
            if (!bridge || !bridge.apps) { outs.push(t('toast.onlyApp')); break; }
            await ensureAppsList();
            let hit = matchSysApp(a.value);
            if (!hit) { statusText.textContent = t('app.scanning'); await ensureAppsList(true).catch(() => { /* noop */ }); hit = matchSysApp(a.value); }
            if (hit) {
              const r = await bridge.apps.launch({ name: hit.app.name, exe: hit.app.exe }).catch(() => null);
              outs.push(r && r.ok ? t('app.open', { x: hit.app.name }) : t('app.launchFail', { x: hit.app.name }));
            } else outs.push(t('app.notFound', { x: a.value }));
            break;
          }
          case 'yt_search': {
            /* v0.54 — سرچ یوتیوب با کانالِ بومی؛ دیگر open_url دست‌ساز صفحهٔ خالی نمی‌دهد */
            const yq = String(a.value || '').trim();
            if (!yq) { outs.push(LANG === 'en' ? 'No search title was given.' : 'عنوانی برای جستجو داده نشد.'); break; }
            if (!bridge || !bridge.system) { outs.push(t('toast.onlyApp')); break; }
            const yr = await bridge.system.run('youtube_search', yq).catch(() => null);
            const yOk = !!(yr && (yr.ok === undefined || yr.ok));
            outs.push(yOk ? (LANG === 'en' ? 'YouTube search opened.' : 'جستجوی یوتیوب باز شد.') : (LANG === 'en' ? "Couldn't open it." : 'باز نشد.'));
            break;
          }
          case 'video_play': {
            /* v0.61 — پخش واقعی ویدیو با «پلیر پیش‌فرضِ کاربر» (خواستهٔ صریح:
               «ببین ویدیو پلیر پیش فرض کاربر چیه، با همون پلی کنه»)؛
               v0.63 — لینک کپی‌شده: __clipboard__ / اشارهٔ «کپی کردم» / دامنهٔ خام
               یوتیوب → لینک واقعی از کلیپ‌بورد خوانده می‌شود (لاگ v0.62: سه بار
               video_play(https://www.youtube.com/) زده شد = صفحهٔ خالی/دیوار ربات) */
            const vq0 = String(a.value || '').trim().slice(0, 200);
            const mentionsCopy = /(کپی\s*(کردم|شده))|کلیپ\s?بورد|clipboard/i.test(String(origCmd || ''));
            const bareYt = /^(https?:\/\/)?(www\.)?(youtube\.com\/?(?:[?#].*)?|youtu\.be\/?)(\s|$)/i.test(vq0) || /__clipboard__/i.test(vq0);
            let vq = vq0.replace(/__clipboard__/gi, '').trim();
            if (!vq || mentionsCopy || bareYt) {
              let cbUrl = '';
              try {
                const cb = (bridge && bridge.sys && bridge.sys.clipboard) ? await bridge.sys.clipboard() : null;
                const mt = String((cb && cb.text) || '').match(/https?:\/\/[^\s"'<>]+/i);
                if (mt) cbUrl = mt[0];
              } catch (_) { /* noop */ }
              if (cbUrl) { actLog('video_play clipboard → ' + cbUrl.slice(0, 90)); vq = cbUrl; }
              else if (!vq || bareYt) {
                outs.push(LANG === 'en' ? 'No video link found in the clipboard — copy the full video link first.' : 'لینک ویدیویی در کلیپ‌بورد نبود — اول لینک کامل ویدیو را کپی کن.');
                break;
              }
            }
            if (!vq) { outs.push(LANG === 'en' ? 'No title was given to play.' : 'عنوانی برای پخش داده نشد.'); break; }
            /* v0.64 — ترمیمِ URL از متن کاربر: AI گاهی به‌جای لینک کاملِ داخل جمله،
               youtube.com نمونه‌وار را می‌دهد (لاگ v0.63: سه بار
               video_play(https://www.youtube.com/) درحالی‌که URL واقعی در پیام
               بود). اگر خودِ جمله لینک شناسه‌دار دارد، همان اصل حرف اول را می‌زند. */
            const _urlInCmd = String(origCmd || '').match(/https?:\/\/[^\s"'<>]+/i);
            if (_urlInCmd && _urlInCmd[0]) {
              const _u = _urlInCmd[0].replace(/[.,؛»)\]]+$/, '');
              const _uId = /(?:watch\?v=|youtu\.be\/|shorts\/|live\/|embed\/|\/v\/)/i.test(_u);
              const _vId = /(?:watch\?v=|youtu\.be\/|shorts\/|live\/|embed\/|\/v\/)/i.test(vq);
              if (_uId && (!_vId || vq !== _u)) {
                actLog('video_play url-repair: «' + String(vq).slice(0, 60) + '» → لینکِ اصلیِ جمله');
                vq = _u;
              }
            }
            /* v0.66 — دامنهٔ خام/بی‌شناسه + حافظهٔ آخرین لینک → همان لینک واقعی
               (لاگ v0.65: «همین ویدیویی که یوتیوب دادم توی کی‌ام‌پلیر» بعد از
               خرابی ctx-resolve به video_play(youtube.com) رسید و جایی رفت). */
            if (bareYt && lastVideoUrl) {
              actLog('video_play last-video memory → ' + lastVideoUrl.slice(0, 90));
              vq = lastVideoUrl;
            }
            /* v0.66 — «پلیر مقصد»: «توی کی ام پلیر/با پات پلیر/در VLC» از همان
               جملهٔ کاربر خوانده می‌شود و به player:open می‌رود (قبلاً همیشه
               'default' بود — خواستهٔ کاربر: «با یک ویدیو پلیر دیگم پخش کنه»). */
            const _pw = (typeof AVAIntent !== 'undefined' && AVAIntent.playerTargetOf) ? AVAIntent.playerTargetOf(String(origCmd || '')) : '';
            if (_pw) actLog('video_play player-target: ' + _pw);
            if (/(?:watch\?v=|youtu\.be\/|shorts\/|live\/|embed\/|\/v\/)/i.test(vq)) lastVideoUrl = vq;
            const _vp = await videoPlayReply(vq, _pw, origCmd);
            outs.push(_vp.rep);
            break;
          }
          case 'video_ctl': {
            /* v0.61 — کنترل پلیر سیستم؛ v0.63 — گرامر گسترده با videoCtlParse:
               pin/unpin/move/grow/shrink/seek هم اجرا می‌شوند (پنجرهٔ پلیر) */
            const pr = videoCtlParse(a.value);
            if (!pr) { outs.push(LANG === 'en' ? 'Unknown player action.' : 'اقدامِ پلیر ناشناخته.'); break; }
            if (!bridge || !bridge.player || !bridge.player.ctl) { outs.push(t('toast.onlyApp')); break; }
            try {
              const res = await bridge.player.ctl({ action: pr.action, arg: pr.arg });
              const _lbl = {
                pin: 'پلیر همیشه رویر شد.', unpin: 'از حالت همیشه‌رویر خارج شد.',
                grow: 'پنجرهٔ ویدیو بزرگتر شد.', shrink: 'پنجرهٔ ویدیو کوچکتر شد.',
                move: 'پنجرهٔ ویدیو جابه‌جا شد.', seek: 'پرش انجام شد.',
              }[pr.action];
              /* v0.64 — چند ویدیو همزمان؟ اقدام روی همه اعمال شد — شمرده بگو */
              const _cnt = (res && res.ok && res.count && res.count > 1)
                ? (LANG === 'en' ? ' (on ' + res.count + ' players)' : ' (روی ' + faNum(String(res.count)) + ' پلیر)')
                : '';
              outs.push(res && res.ok ? ((LANG === 'en' ? `Done (${pr.action}).` : (_lbl || 'انجام شد.')) + _cnt) : (LANG === 'en' ? `Could not: ${res && res.error || ''}` : `انجام نشد: ${res && res.error || ''}`));
            } catch (_) { outs.push(LANG === 'en' ? 'Control failed.' : 'کنترل پلیر ممکن نشد.'); }
            break;
          }
          case 'open_url': case 'web_search': {
            if (!bridge || !bridge.system) { outs.push(t('toast.onlyApp')); break; }
            /* v0.46 — «سایت X سرچ کن Y» هرگز بدون عبارتِ Y باز نشود (لاگ واقعی:
               emalls دو بار بدون «موتور» باز شد) — URLِ بی‌عبارت بازسازی می‌شود */
            if (a.act === 'open_url') {
              const fixed = aiUrlWithQuery(a.value, String(origCmd || ''));
              if (fixed && fixed !== a.value) { actLog('ai open_url query-restore → ' + fixed.slice(0, 90)); a.value = fixed; }
            }
            const r = await bridge.system.run(a.act === 'open_url' ? 'web_open' : 'web_search', a.value).catch(() => ({ ok: false }));
            outs.push(r && r.ok ? (a.act === 'open_url' ? (LANG === 'en' ? 'Opened the link.' : 'لینک را باز کردم.') : (LANG === 'en' ? 'Search opened.' : 'جستجو را باز کردم.')) : (LANG === 'en' ? 'Could not open it.' : 'باز نشد.'));
            break;
          }
          case 'vol_up': case 'vol_down': case 'vol_mute': case 'media_next': case 'media_prev': case 'media_toggle': case 'lock': case 'screenshot': case 'minimize_all': case 'recycle_empty': {
            if (!canRun) { outs.push(t('toast.onlyApp')); break; }
            const r = await bridge.system.run(a.act).catch(() => ({ ok: false }));
            outs.push((r && r.ok ? DO_RUN_LABEL[a.act]() : (LANG === 'en' ? 'Failed.' : 'انجام نشد.')));
            break;
          }
          case 'vol_set': {
            if (!canRun) { outs.push(t('toast.onlyApp')); break; }
            const v = Math.max(0, Math.min(100, Number(a.value) || 0));
            const r = await bridge.system.run('vol_set', String(v)).catch(() => ({ ok: false }));
            outs.push(r && r.ok ? (LANG === 'en' ? `Volume set to ${v}.` : `صدا روی ${v} تنظیم شد.`) : (LANG === 'en' ? 'Failed.' : 'انجام نشد.'));
            break;
          }
          case 'monitor_off': case 'sys_sleep': {
            if (!canRun) { outs.push(t('toast.onlyApp')); break; }
            if (a.act === 'sys_sleep') {
              const okGo = await askConfirm({
                title: LANG === 'en' ? 'Sleep the PC?' : 'کامپیوتر بخوابد؟',
                text: LANG === 'en' ? 'The AI requested to sleep the system. Confirm?' : 'هوش مصنوعی درخواست خواب‌شدن سیستم را داده — تأیید می‌کنی؟',
              });
              if (!okGo) { outs.push(t('cf.skip')); break; }
            }
            outs.push(await runPower(a.act));
            break;
          }
          case 'music_play': {
            /* v0.42 — پیام یکدست «افزونه خاموشه» + باز شدن صفحهٔ افزونه‌ها */
            if (!settings.extMusic || typeof playTrack !== 'function') { outs.push(musicExtOffReply()); break; }
            const q = normFaFull(a.value);
            let idx = -1;
            if (q) idx = music.tracks.findIndex((tr) => normFaFull(tr.title).includes(q) || normFaFull(tr.artist || '').includes(q));
            if (idx < 0 && music.cur >= 0) idx = music.cur;
            if (idx < 0 && music.tracks.length) idx = 0;
            if (idx < 0) { outs.push(LANG === 'en' ? 'No tracks — pick a folder first.' : 'هنوز آهنگی نیست — اول پوشه انتخاب کن.'); break; }
            playTrack(idx);
            outs.push(LANG === 'en' ? 'Playing.' : 'پخش می‌کنم.');
            break;
          }
          case 'type_once': {
            /* v0.51 — دیکتهٔ یک‌باره: متن عیناً در برنامهٔ فعالِ ثبت‌شده نوشته می‌شود */
            outs.push(await typeOnceExec(a.value));
            break;
          }
          case 'music_pause': {
            if (typeof mAudio !== 'undefined' && mAudio) { mAudio.pause(); outs.push(LANG === 'en' ? 'Music paused.' : 'موزیک متوقف شد.'); }
            break;
          }
          /* v0.46 — تغییر کلمهٔ بیدارباش با فرمان صوتی (خواستهٔ کاربر:
             «میتونم ویکورد رو تغییر بدم») — همهٔ لایه‌های تطبیق فوراً
             روی کلمهٔ جدید می‌روند؛ چیز دیگری ری‌استارت نمی‌خواهد */
          case 'set_wake_word': {
            const wNew = String(a.value || '').replace(/[^\s\u0600-\u06FFa-zA-Z]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 20);
            if (wNew && (window.AVAWake ? AVAWake.norm(wNew) : wNew)) {
              settings.wakeWordText = wNew;
              store.set('wakeWordText', wNew);
              const elWw = $('#optWakeWordText'); if (elWw) elWw.value = wNew;
              const elWwn = $('#wakeWordNow'); if (elWwn) elWwn.textContent = wNew; /* v0.66 — بج فعال */
              actLog('wake word set (AI): ' + wNew);
              outs.push(t('toast.wakeWordSet', { x: wNew }));
            } else {
              outs.push(LANG === 'en' ? 'Tell me the wake word — one word.' : 'کلمهٔ بیدارباش را بگو — فقط یک کلمه.');
            }
            break;
          }
          case 'dns_set': case 'dns_reset': {
            outs.push(await runDnsCommand(a.act === 'dns_reset' ? 'دی ان اس رو بردار' : `${a.value} رو تنظیم کن`));
            break;
          }
          case 'reminder_add': {
            /* v0.47 — B01: مقدار AI مثل «5 دقیقه» بدون قید نسبیت است — allowBare
               v0.47 — B17: مقدارِ بی‌زمانِ ابداعی («timer»/«status» — لاگ واقعی کاربر)
               دیگر به تایمرِ پیش‌فرضِ بی‌معنا نمی‌افتد؛ پیام صادق می‌خواهد */
            const _rv = String(a.value || '');
            const hasTime = /[\d۰-۹]|ساعت|دقیقه|ثانیه|نیم\s*ساعت/i.test(_rv);
            if (!hasTime) { outs.push(LANG === 'en' ? 'What time should I set the reminder for?' : 'برای چه زمانی یادآوری بگذارم؟ (مثلاً: ۵ دقیقه دیگه)'); break; }
            outs.push(await reminderReply(_rv, { allowBare: true }));
            break;
          }
          /* v0.42 — باز کردن/خواندن یادداشت ذخیره‌شده (value خالی = آخرین یادداشت) */
          case 'note_show': {
            outs.push(await openLastNote(a.value));
            break;
          }
          case 'discord_call': {
            const ct = resolveDiscordContact(a.value);
            await runDiscordCmd('call', ct ? ct.name : a.value, t('disc.calling', { x: ct ? ct.name : a.value }), ct ? ct.userId : '');
            outs.push(t('disc.calling', { x: ct ? ct.name : a.value }));
            break;
          }
          case 'discord_mute': {
            await runDiscordCmd('mute', '', t('disc.muted'));
            outs.push(t('disc.muted'));
            break;
          }
          /* v0.29 — کامل‌ترین کنترل دیسکورد از طریق هوش مصنوعی */
          case 'discord_unmute': {
            await runDiscordCmd('unmute', '', t('disc.unmuted'));
            outs.push(t('disc.unmuted'));
            break;
          }
          case 'discord_deafen': {
            await runDiscordCmd('deafen', '', t('disc.deafened'));
            outs.push(t('disc.deafened'));
            break;
          }
          case 'discord_answer': {
            await runDiscordCmd('answer', '', t('disc.answer'));
            outs.push(t('disc.answer'));
            break;
          }
          case 'discord_decline': {
            await runDiscordCmd('decline', '', t('disc.decline'));
            outs.push(t('disc.decline'));
            break;
          }
          case 'discord_hangup': {
            await runDiscordCmd('hangup', '', t('disc.hangup'));
            outs.push(t('disc.hangup'));
            break;
          }
          case 'run_custom': {
            const cc = customCmds.find((c) => normFaFull(c.title || '') === normFaFull(a.value)) || customCmds.find((c) => (c.phrases || []).some((p) => normFaFull(a.value).includes(normFa(p))));
            if (!cc) { outs.push(LANG === 'en' ? `Custom command "${a.value}" not found.` : `فرمان سفارشی «${a.value}» پیدا نشد.`); break; }
            outs.push(await runCustom(cc));
            break;
          }
          default: break;
        }
      } catch (e) {
        outs.push((LANG === 'en' ? 'Action failed: ' : 'انجام نشد: ') + String((e && e.message) || e).slice(0, 80));
      }
    }
    return outs.filter(Boolean).join(' — ');
  }

  /* --- تب‌های چت: چت سریع / صفحه GLM --- */
  function selectChatTab(which) {
    const zai = which === 'zai';
    if (tabQuick) tabQuick.classList.toggle('active', !zai);
    if (tabZai) tabZai.classList.toggle('active', zai);
    if (quickWrap) quickWrap.hidden = zai;
    if (zaiWrap) zaiWrap.hidden = !zai;
    if (zai) { ensureZaiWebLoaded(); setTimeout(() => checkZaiToken(), 1200); }
  }
  if (tabQuick) tabQuick.addEventListener('click', () => selectChatTab('quick'));
  if (tabZai) tabZai.addEventListener('click', () => selectChatTab('zai'));

  function setZaiBadge(on, txt) {
    if (!zaiBadge) return;
    zaiBadge.textContent = txt || (on ? t('badge.on') : t('badge.off'));
    zaiBadge.classList.toggle('on', !!on);
  }

  function checkZaiToken(attempts = 0) {
    if (!zaiWeb || typeof zaiWeb.executeJavaScript !== 'function') return;
    try {
      zaiWeb.executeJavaScript("localStorage.getItem('token')||''", true).then((tk) => {
        if (tk) {
          zaiToken = String(tk);
          try { store.set('zaiToken', zaiToken); } catch (_) { /* noop */ } /* v0.45 — کش توکن برای بوت‌های بعدی */
          setZaiBadge(true);
        } else {
          zaiToken = '';
          try { store.set('zaiToken', ''); } catch (_) { /* noop */ }
          setZaiBadge(false, attempts < 4 ? t('badge.needLogin') : t('badge.off'));
          if (attempts < 4) setTimeout(() => checkZaiToken(attempts + 1), 2500);
        }
      }).catch(() => { /* noop */ });
    } catch (_) { /* noop */ }
  }
  if (zaiWeb) {
    zaiWeb.addEventListener('dom-ready', () => setTimeout(() => checkZaiToken(), 1400));
    zaiWeb.addEventListener('did-stop-loading', () => setTimeout(() => checkZaiToken(), 800));
  }

  /* --- ارسال پیام: زنجیره پرووایدرها (v0.13) ---
     «خودکار»: اول Gemini (با سرچ زنده گوگل) → حساب GLM (z.ai) → کلید GLM → OpenAI
     یا پرووایدر ثابت از تنظیمات. اولین جواب موفق برگردانده می‌شود. */
  /* v0.37 — extraCtx: پیوستِ اختیاری (مثل فهرست توانایی‌های آوا برای
     سوال‌های «چجوری می‌تونم …؟») — داخل پیام کاربر سوار می‌شود */
  async function aiAsk(text, extraCtx, opts) {
    const t0 = Date.now();
    const userText = extraCtx ? String(text) + '\n\n' + extraCtx : String(text);
    /* v0.70 — مغز واحد: پرامپت سیستم سفارشی (JSON) + بدون تاریخچهٔ چت (تاریخچه در بستهٔ زمینه می‌آید) + بودجهٔ زمانی هر دور */
    const _sys = (opts && opts.system) ? String(opts.system) : aiSystem();
    const _msgs = [{ role: 'system', content: _sys }, ...((opts && opts.noHist) ? [] : chatHist.slice(-8)), { role: 'user', content: userText }];
    const _budget = (opts && opts.timeoutMs) || 0;
    const _race = (p) => (_budget > 0 ? Promise.race([p, new Promise((res) => setTimeout(() => res(null), _budget))]) : p);
    const msgs = _msgs;
    const prov = settings.aiProvider || 'auto';
    let lastErr = null;

    const tryZai = async () => {
      if (!bridge || !bridge.ai || !bridge.ai.zaiChat) return false;
      const r = await _race(bridge.ai.zaiChat({ token: zaiToken || '', messages: msgs }).catch(() => null));
      if (r && r.ok) { setZaiBadge(true); return r; }
      if (r && r.needLogin) {
        zaiToken = '';
        setZaiBadge(false, 'برای چت، در تب «صفحه چت GLM» وارد حسابت شو');
        return false;
      }
      if (r) lastErr = r;
      return false;
    };
    const tryGlm = async () => {
      if (!settings.glmKey || !bridge || !bridge.ai || !bridge.ai.chat) return false;
      /* v0.29.1 — ریشهٔ «جمینی که بریزد همه چیز می‌میرد»: نتیجهٔ {ok:false} truthy بود
         و زنجیرهٔ خودکار همان‌جا برمی‌گشت — GLM/سایر پرووایدرها هرگز امتحان نمی‌شدند
         و لاگ هم دروغ «ai Gemini ok» می‌نوشت! حالا فقط نتیجهٔ واقعاً ok جواب است */
      const r = await _race(bridge.ai.chat({ base: settings.glmBase, key: settings.glmKey, model: settings.glmModel, messages: msgs }).catch(() => null));
      if (r && r.ok && r.text) return r;
      if (r && r.error) lastErr = r;
      return false;
    };
    const tryGemini = async () => {
      if (!settings.geminiKey || !bridge || !bridge.ai || !bridge.ai.gemini) return false;
      /* Gemini با ابزار جستجوی گوگل: سوال‌های «سرچ» جواب لحظه‌ای می‌گیرند
         مدل از تنظیمات (v0.13) — پیش‌فرض flash-latest (همیشه جدیدترین فلاش)
         v0.29.1 — فقط نتیجهٔ ok؛ شکستِ {ok:false} دیگر زنجیره را نمی‌بُرد */
      /* v0.70 — مغز واحد JSON: سرچ زندهٔ گوگل پیش‌فرض خاموش (تحقیق با act=research؛
         ریشهٔ دمِ تأخیر لاگ: search:true همیشه روشن بود) */
      const r = await _race(bridge.ai.gemini({ key: settings.geminiKey, model: settings.geminiModel || 'gemini-flash-latest', messages: msgs, search: !(opts && opts.noSearch), base: settings.gemBase || '' }).catch(() => null));
      if (r && r.ok && r.text) return r;
      if (r && r.error) lastErr = r;
      return false;
    };
    const tryOpenai = async () => {
      if (!settings.openaiKey || !bridge || !bridge.ai || !bridge.ai.openai) return false;
      const r = await _race(bridge.ai.openai({ key: settings.openaiKey, model: settings.openaiModel || 'gpt-4o-mini', messages: msgs }).catch(() => null));
      if (r && r.ok && r.text) return r; /* v0.29.1 — فقط نتیجهٔ ok */
      if (r && r.error) lastErr = r;
      return false;
    };

    /* v0.17 — اولویت اول با جمنای (خواست کاربر) + برچسب موتور پاسخ‌دهنده */
    const tag = (r, via) => {
      if (r) {
        r.via = via;
        r.ms = Date.now() - t0;
        actLog('ai ' + via + ' ok ' + r.ms + 'ms model=' + (r.model || '?'));
      }
      return r;
    };
    if (prov === 'zai') { const r = await tryZai(); if (r) return tag(r, 'GLM'); }
    else if (prov === 'glm') { const r = await tryGlm(); if (r) return tag(r, 'GLM API'); }
    else if (prov === 'gemini') { const r = await tryGemini(); if (r) return tag(r, 'Gemini'); }
    else if (prov === 'openai') { const r = await tryOpenai(); if (r) return tag(r, 'OpenAI'); }
    /* v0.66 — فالبک عرضه‌محور برای «همهٔ» حالت‌ها: پرووایدرِ انتخابی کاربر اگر
       مرد (ریشهٔ لاگ v0.61: بلاکِ محلِ جمینای وقتی VPN خاموش است → «ai fail …
       اتصال برقرار نشد» درحالی‌که z.ai/groq سالم بودند)، بقیهٔ زنجیره خودکار
       امتحان می‌شود — کاربر هرگز بی‌جواب نمی‌ماند فقط به‌خاطر تنظیمِ ثابت. */
    {
      const AI_LAST_KEY = 'avaAiLast';
      const lastAi = (() => { try { return localStorage.getItem(AI_LAST_KEY) || ''; } catch (_) { return ''; } })();
      const chainAi = [
        ['gemini', tryGemini, 'Gemini'],
        ['zai', tryZai, 'GLM'],
        ['glm', tryGlm, 'GLM API'],
        ['openai', tryOpenai, 'OpenAI'],
      ];
      const li2 = chainAi.findIndex((x) => x[0] === lastAi);
      if (li2 > 0) chainAi.unshift(chainAi.splice(li2, 1)[0]);
      /* پرووایدرِ ثابتی که همین الان شکست خورد دوباره در زنجیره امتحان نمی‌شود */
      const chain2 = (prov && prov !== 'auto') ? chainAi.filter((x) => x[0] !== prov) : chainAi;
      for (const [pk, fn2, viaName] of chain2) {
        const rr = await fn2();
        if (rr) {
          try { localStorage.setItem(AI_LAST_KEY, pk); } catch (_) { /* noop */ }
          return tag(rr, viaName);
        }
      }
    }

    if (!bridge || !bridge.ai) return { ok: false, error: 'چت با هوش مصنوعی فقط داخل نرم‌افزار ویندوزی کار می‌کند' };
    if (lastErr && lastErr.error) { actLog('ai fail ' + (Date.now() - t0) + 'ms — ' + String(lastErr.error).slice(0, 90)); return lastErr; }
    const needAny = !(settings.geminiKey || settings.openaiKey);
    if (needAny && prov !== 'gemini' && prov !== 'openai') {
      return { ok: false, needLogin: true, error: 'برای چت، اول در تب «صفحه چت GLM» وارد حسابت شو یا کلید Gemini/OpenAI را در تنظیمات بگذار' };
    }
    return { ok: false, error: 'هیچ‌کدام از موتورهای هوش مصنوعی جواب ندادند — کلیدها و اینترنت را بررسی کن' };
  }

  async function handleChatSend(v) {
    addMsg('user', v);
    pushChatHist('user', v);
    const typing = addMsg('bot', t('chat.thinking'));
    typing.classList.add('typing');
    chatBusy = true;
    try {
      /* v0.52 — فکر-اول در چت هم: سوال نیازمند اطلاعات تازه → تحقیق واقعی → جواب داده‌محور */
      const _bt = await aiThinkRound(v);
      const r = _bt.r;
      typing.remove();
      if (!r || !r.ok) {
        addMsg('err', (r && r.error) || t('chat.noReply'));
      } else {
        /* پاسخ بدون خط فکر؛ بلوک RESEARCH قبلاً به دور دومِ داده‌محور تبدیل شده است */
        const { reply, add } = parseAdd(_bt.body || r.text);
        pushChatHist('assistant', r.text);
        const msgEl = addMsg('bot', reply || '…');
        if (r.via) { const ch = document.createElement('span'); ch.className = 'msg-engine'; ch.textContent = r.via; msgEl.appendChild(ch); }
        speak(reply);
        if (add) renderCmdCard(msgEl, add);
      }
    } catch (_) {
      typing.remove();
      addMsg('err', t('chat.err'));
    }
    chatBusy = false;
    chatInput.focus();
  }

  chatBar.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = chatInput.value.trim();
    if (!v || chatBusy) return;
    if (!bridge || !bridge.ai) {
      addMsg('err', t('chat.onlyApp'));
      return;
    }
    chatInput.value = '';
    handleChatSend(v);
  });

  function renderCmdCard(msgEl, cc) {
    const card = document.createElement('div');
    card.className = 'cmd-card';
    card.innerHTML =
      `<b><svg class="ic"><use href="#i-plus"/></svg><span></span></b>` +
      `<code></code>` +
      `<div class="cmd-actions">` +
      `<button class="chip sm upd-install"><svg class="ic"><use href="#i-plus"/></svg><span>افزودن به فرمان‌ها</span></button>` +
      `<button class="chip sm"><svg class="ic"><use href="#i-close"/></svg><span>بی‌خیال</span></button>` +
      `</div>`;
    card.querySelector('b span').textContent = cc.title || 'فرمان جدید';
    const codeEl = card.querySelector('code');
    const act = cc.action || {};
    codeEl.textContent = (act.type === 'ps' ? 'PowerShell: ' : act.type === 'open_url' ? 'URL: ' : 'Command: ') + (act.value || '');
    const [btnAdd, btnSkip] = card.querySelectorAll('button');
    btnAdd.addEventListener('click', () => {
      cc.id = Date.now();
      customCmds.push(cc);
      store.set('customCmds', customCmds);
      renderCustomChips();
      card.querySelector('.cmd-actions').remove();
      const done = document.createElement('p');
      done.style.cssText = 'margin:8px 0 0;font-size:11.5px;color:var(--acc2)';
      done.textContent = LANG === 'en' ? 'Added ✓ Now it runs by voice or the command box.' : 'افزوده شد ✓ حالا با صدا یا کادر فرمان قابل اجراست.';
      card.appendChild(done);
      toast(t('toast.cmdAdded', { x: cc.title }), '#i-plus');
    });
    btnSkip.addEventListener('click', () => { card.remove(); });
    msgEl.appendChild(card);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
  }

  /* ---------- مسیریابی سوالات پیچیده به هوش مصنوعی ----------
     اگر متن، فرمان شناخته‌شده نبود و اتصال AI برقرار بود،
     آوا خودش از GLM می‌پرسد، جواب را می‌گوید و فرمان جدید پیشنهادی را با تأیید اضافه می‌کند. */

  /* ============================================================
     v0.65 — نشانگر کوچکِ «آوا داره فکر می‌کنه…»
     ------------------------------------------------------------
     درخواست کاربر: «AI وقتی داره فکر می‌کنه حالت thinking رو نشون
     بده که کاربر بدونه آوا داره فکر می‌کنه نه اینکه هنگ کرده»
     • چیپ کوچکِ آبیِ پالس‌دار در کارت پاسخ — فقط در سفرهای AI
     • دور «تمام» شاخه‌های خروجی (موفق/شکست/خطا/ترمیم/پژوهش) بسته
       می‌شود — رپر try/finally هیچ مسیر فراری ندارد
     ============================================================ */
  function thinkChipSet(on) {
    try {
      const el = document.getElementById('thinkChip');
      if (!el) return;
      el.hidden = !on;
      if (on) {
        const tx = document.getElementById('thinkTxt');
        if (tx) tx.textContent = t('ai.thinking');
      }
    } catch (_) { /* noop */ }
  }
  /* v0.66 — دکمهٔ لغو (✕) روی چیپ فکر: یک‌بار در بوت سیم‌کشی می‌شود */
  {
    const _tc = document.getElementById('thinkCancel');
    if (_tc) _tc.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      await aiCancelRun('button');
    });
  }
  /* ============================================================
     v0.70 — مغز واحد (فاز ۱ طرح بازنویسی AI-First)
     ------------------------------------------------------------
     تصمیم کاربر: «منطق اصلی پای جمینای باشه؛ خودش تحلیل کنه چی میگه،
     چیو ذخیره کنه، چیو بنویسه.» مدل یک JSON سخت‌ساختار می‌دهد؛ کد فقط
     صحه می‌گذارد و اجرا. شکست JSON → فالبک کامل به مسیر فکر-اول قدیمی
     (صفر رگرسیون). تحقیق وب فقط با act=research (سرچ زنده خاموش —
     ریشهٔ دمِ تأخیر p99=42s لاگ).
     ============================================================ */
  const BRAIN_TIMEOUT_MS = 14000;

  async function aiBrainRound(cmd, extraCtx, opts) {
    const teach = !!(opts && opts.teach);
    const _B = (typeof window !== 'undefined') ? window.AVABrain : null;
    if (!_B) return { legacy: true, r: null };
    const sys = _B.brainSystem(LANG);
    /* بستهٔ زمینه: تاریخچهٔ موضوعی (نه برای سلام/حالِ خالص) + حافظهٔ پایدار + مخاطبین */
    let ctx = String(extraCtx || '');
    const _greet = _B.isGreeting(cmd);
    if (!_greet && window.AVACore) {
      try { const t = window.AVACore.turnsCtx(6); if (t) ctx += '\n' + t; const e = window.AVACore.entityCtx(); if (e) ctx += '\n' + e; } catch (_) { /* noop */ }
    }
    if (teach) ctx += '\n[این جمله آموزش/حافظه است: فقط memory_save و در صورت نیاز contact_save بده؛ هیچ عمل اجرایی و هرگز ارسال پیام]';
    try {
      const m = avaMem();
      if (m) {
        await m.load();
        const f = m.factsCtx(cmd, 6);
        if (f) ctx += '\n' + f;
        const cl = m.contactsCtx(Array.isArray(settings.msgContacts) ? settings.msgContacts : []);
        if (cl) ctx += '\n' + cl;
      }
    } catch (_) { /* noop */ }
    /* دور ۱ — JSON */
    let r = await aiAsk(cmd, ctx, { system: sys, noSearch: true, timeoutMs: BRAIN_TIMEOUT_MS });
    if (!r || !r.ok) return { legacy: true, r };
    let b = _B.validateBrain(_B.parseBrainJSON(r.text));
    if (!b || !b.ok) {
      /* یک دور ترمیم JSON */
      const r2 = await aiAsk(cmd + '\n\n[پاسخ قبلی تو JSON معتبر نبود. فقط و فقط یک JSON معتبر با قالب گفته‌شده بده — بدون هیچ متن بیرون JSON.]', ctx, { system: sys, noSearch: true, timeoutMs: BRAIN_TIMEOUT_MS });
      if (r2 && r2.ok) b = _B.validateBrain(_B.parseBrainJSON(r2.text));
      if (!b || !b.ok) { actLog('brain JSON invalid ×2 → legacy think-first fallback'); return { legacy: true, r }; }
    }
    /* فاز تحقیق (یک دور): act=research → وب واقعی → دور دوم JSON */
    const _rAct = b.actions.find((a) => a.act === 'research');
    if (_rAct && bridge && bridge.ai && bridge.ai.research) {
      const _rq = String(_rAct.value || '').trim().slice(0, 150);
      actLog('brain research: «' + _rq + '» → وب‌گردی واقعی، بعد دور دوم');
      const _rr = await bridge.ai.research(_rq).catch(() => null);
      const _rt = (_rr && _rr.text) || '';
      const _ctx2 = ctx + '\n' + RESEARCH_CTX_MARK + ' برای «' + _rq + '»]' + (_rt ? '\n' + _rt : '\n(تحقیق وب ناموفق بود — صادقانه بگو و هیچ action نساز)') + '\n[پایان نتایج — فقط بر پایهٔ همین نتایج JSON نهایی بده؛ act=research دیگر مجاز نیست و هرگز اسم/عنوان از حافظه‌ات نساز]';
      const _r2 = await aiAsk(cmd, _ctx2, { system: sys, noSearch: true, timeoutMs: BRAIN_TIMEOUT_MS });
      if (_r2 && _r2.ok) {
        const _b2 = _B.validateBrain(_B.parseBrainJSON(_r2.text));
        if (_b2 && _b2.ok) { b = _b2; r = _r2; }
      }
    }
    b.actions = b.actions.filter((a) => a.act !== 'research');
    return { legacy: false, brain: b, via: r.via || '' };
  }

  /* --- actهای جدید حافظه/مخاطب/یادداشت (خارج از DO قدیمی) --- */
  async function notesAddDirect(text, lang) {
    const x = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 500);
    if (x.length < 2 || !bridge || !bridge.notes) return LANG === 'en' ? 'Note text was empty.' : 'متن یادداشت خالی بود.';
    let stored = x;
    try {
      const _lat = (typeof AVAMessaging !== 'undefined' && AVAMessaging.noteLatinOf) ? AVAMessaging.noteLatinOf(x) : null;
      if (String(lang) === 'en' && _lat && _lat.out && _lat.out.length >= 2) stored = _lat.out;
    } catch (_) { /* noop */ }
    const arr = await notesLoad();
    arr.unshift({ t: Date.now(), x: stored });
    const kept = arr.slice(0, 200);
    const ok = await bridge.notes.save(kept);
    if (ok) NOTES = kept;
    try { if (window.AVACore && window.AVACore._state) window.AVACore._state.entities.note = String(stored).slice(0, 200); } catch (_) { /* noop */ }
    actLog('brain note_add ok=' + String(ok) + ' x=' + String(stored).slice(0, 40));
    return ok ? (LANG === 'en' ? `Noted: "${stored.slice(0, 90)}".` : `یادداشت شد: «${stored.slice(0, 90)}».`) : t('notes.saveFail');
  }

  async function executeBrainNewActs(actions, cmd) {
    const outs = [];
    const m = avaMem();
    for (const a of actions) {
      try {
        if (a.act === 'memory_save') {
          if (!m) { outs.push(LANG === 'en' ? 'Memory is unavailable.' : 'حافظه در دسترس نیست.'); continue; }
          await m.load();
          const id = m.addFact(a.value || cmd, { src: 'brain' });
          const ok = id ? await m.persist() : false;
          actLog('brain memory_save id=' + String(id) + ' ok=' + String(ok) + ' x=' + String(a.value || '').slice(0, 60));
          outs.push(ok ? (LANG === 'en' ? 'Saved to memory.' : 'حفظ شد — دیگه یادم نمیره.') : (LANG === 'en' ? 'Could not save to memory.' : 'ذخیره در حافظه انجام نشد.'));
        } else if (a.act === 'memory_recall') {
          if (!m) { outs.push(LANG === 'en' ? 'Memory is unavailable.' : 'حافظه در دسترس نیست.'); continue; }
          await m.load();
          const hits = m.findFacts(a.value || cmd, 3);
          outs.push(hits.length ? hits.map((f) => f.text).join(' | ') : (LANG === 'en' ? 'I have nothing like that in memory.' : 'چیزی شبیه این تو حافظه‌م ندارم.'));
        } else if (a.act === 'memory_forget') {
          if (!m) continue;
          await m.load();
          const rem = m.delFact(a.value || '');
          const ok = rem ? await m.persist() : false;
          outs.push(ok ? (LANG === 'en' ? `Forgot: "${String(rem.text).slice(0, 60)}".` : `فراموش شد: «${String(rem && rem.text).slice(0, 60)}».`) : (LANG === 'en' ? 'Nothing like that in memory.' : 'چیزی شبیه این تو حافظه‌م نبود.'));
        } else if (a.act === 'contact_save') {
          const p = a.params || {};
          if (!Array.isArray(settings.msgContacts)) settings.msgContacts = [];
          const name = String(p.nameFa || p.name || '').trim() || String(p.nameEn || '').trim();
          const id = (window.AVAMemory && m) ? m.addContact(settings.msgContacts, { name, app: p.app, handle: p.handle, aliases: [String(p.nameEn || '').trim()].filter(Boolean) }) : null;
          let ok = false;
          if (id) { try { store.set('msgContacts', settings.msgContacts); ok = true; } catch (_) { ok = false; } }
          try { if (window.AVACore && window.AVACore._state) window.AVACore._state.entities.person = String(p.nameEn || name).slice(0, 80); } catch (_) { /* noop */ }
          actLog('brain contact_save id=' + String(id) + ' ok=' + String(ok) + ' ' + name + '/' + String(p.app || '') + '/' + String(p.nameEn || ''));
          try { msgContactsRender(); } catch (_) { /* noop */ }
          outs.push(ok ? (LANG === 'en' ? `Contact saved: ${name}${p.nameEn ? ' (' + p.nameEn + ')' : ''}.` : `مخاطب ذخیره شد: ${name}${p.nameEn ? ' (' + p.nameEn + ')' : ''}.`) : (LANG === 'en' ? 'Could not save the contact.' : 'ذخیرهٔ مخاطب انجام نشد.'));
        } else if (a.act === 'contact_list') {
          const _all = Array.isArray(settings.msgContacts) ? settings.msgContacts : [];
          outs.push(_all.length ? (LANG === 'en' ? 'Contacts: ' : 'مخاطبینت: ') + _all.slice(0, 8).map((c) => `«${c.name}» (${c.app})`).join('، ') : (LANG === 'en' ? 'No saved contacts yet.' : 'هنوز مخاطبی ذخیره نکردیم.'));
        } else if (a.act === 'note_add') {
          outs.push(await notesAddDirect(a.value || (a.params && a.params.text), a.params && a.params.lang));
        } else if (a.act === 'note_edit' || a.act === 'note_delete') {
          const arr = await notesLoad();
          if (!arr.length) { outs.push(t('notes.empty')); continue; }
          const frag = String(a.value || (a.params && (a.params.match || '')) || '').trim().toLowerCase();
          const idx = frag ? arr.findIndex((n) => String(n.x || '').toLowerCase().includes(frag)) : 0;
          if (idx < 0) { outs.push(LANG === 'en' ? 'No matching note.' : 'یادداشتِ مشابهی نبود.'); continue; }
          if (a.act === 'note_delete') {
            const rem = arr.splice(idx, 1)[0];
            const ok = await bridge.notes.save(arr.slice(0, 200));
            if (ok) NOTES = arr.slice(0, 200);
            outs.push(ok ? (LANG === 'en' ? `Deleted the note "${String(rem && rem.x).slice(0, 60)}".` : `یادداشت «${String(rem && rem.x).slice(0, 60)}» حذف شد.`) : t('notes.saveFail'));
          } else {
            const nt = String((a.params && a.params.text) || a.value || '').trim().slice(0, 500);
            if (!nt) { outs.push(LANG === 'en' ? 'New note text was empty.' : 'متن جدید یادداشت خالی بود.'); continue; }
            arr[idx].x = nt; arr[idx].t = Date.now();
            const ok = await bridge.notes.save(arr.slice(0, 200));
            if (ok) NOTES = arr.slice(0, 200);
            outs.push(ok ? (LANG === 'en' ? 'Note updated.' : 'یادداشت به‌روز شد.') : t('notes.saveFail'));
          }
        } else {
          outs.push('');
        }
      } catch (e) {
        actLog('brain act ' + a.act + ' error: ' + String((e && e.message) || e).slice(0, 80));
        outs.push('');
      }
    }
    return outs.filter(Boolean).join(' — ');
  }

  /* ارسال پیامِ تأییدشده از مسیر مغز — همان موتور پیام‌رسان واقعی */
  async function brainSendResolved(a) {
    const p = (a && a.params) || {};
    const app = String(p.app || 'telegram').toLowerCase();
    const _appFa = { telegram: 'تلگرام', discord: 'دیسکورد', whatsapp: 'واتساپ', bale: 'بله', rubika: 'روبیکا', eitaa: 'ایتا' }[app] || app;
    const text = String(p.text || '').trim();
    const list = Array.isArray(settings.msgContacts) ? settings.msgContacts : [];
    const ct = (window.AVAMemory && p.contactId) ? list.find((c) => c.id === p.contactId) : null;
    const name = String((ct && ct.name) || p.name || '').trim();
    if (!text || !name) return LANG === 'en' ? 'Message target or text was missing — nothing was sent.' : 'مقصد یا متن پیام ناقص بود — چیزی نفرستادم.';
    try {
      if (app === 'telegram' || app === 'discord') {
        const handle = (ct && ct.handle) || '';
        const uname = (AVAMessaging.isLatinUsername(handle)) ? handle.replace(/^@/, '') : (AVAMessaging.isLatinUsername(name) ? name.replace(/^@/, '') : '');
        const _vs = [];
        const _pushV = (x) => { const v = String(x || '').trim(); if (v && _vs.indexOf(v) === -1) _vs.push(v); };
        _pushV(name);
        if (ct) { _pushV(ct.name); (Array.isArray(ct.aliases) ? ct.aliases : []).forEach(_pushV); _pushV(ct.handle); }
        const r = (bridge && bridge.msg && bridge.msg.send) ? await bridge.msg.send({ app, name, text, username: uname, variants: _vs }).catch(() => null) : null;
        if (r && r.ok && /UNVERIFIED/.test(String(r.result || ''))) return LANG === 'en' ? `Sent to "${name}" on ${_appFa} — double-check it landed.` : `فرستادم به «${name}» تو ${_appFa} — یه نگاه بنداز که رسیده باشه.`;
        if (r && r.ok) return LANG === 'en' ? `Sent to "${name}" on ${_appFa}.` : `فرستادم به «${name}» تو ${_appFa}.`;
        return (r && r.error) || (LANG === 'en' ? 'Messaging failed.' : 'ارسال انجام نشد.');
      }
      if (app === 'whatsapp') {
        const phone = AVAMessaging.phoneLike(name) || (ct ? AVAMessaging.phoneLike(ct.handle) : '');
        if (!phone) return LANG === 'en' ? `WhatsApp needs a phone number for "${name}".` : `برای «${name}» تو واتساپ شماره لازم است.`;
        const built = AVAMessaging.msgBuild('whatsapp', phone, text, true);
        const r = bridge && bridge.msg && bridge.msg.open ? await bridge.msg.open(built.link).catch(() => null) : null;
        return (r && r.ok) ? (LANG === 'en' ? `WhatsApp opened for "${name}" with your text pre-filled — press Enter.` : `واتساپ برای «${name}» با متن باز شد — فقط Enter بزن.`) : (LANG === 'en' ? 'Could not open WhatsApp.' : 'باز کردن واتساپ ممکن نشد.');
      }
      const built = AVAMessaging.msgBuild(app, name, text, false);
      if (built.copyText && bridge && bridge.sys) { try { await bridge.sys.copyText(built.copyText); } catch (_) { /* noop */ } }
      const r = bridge && bridge.msg && bridge.msg.open ? await bridge.msg.open(built.link).catch(() => null) : null;
      return (r && r.ok) ? (LANG === 'en' ? `${_appFa} opened; text is on the clipboard — paste and send.` : `${_appFa} باز شد؛ متن تو کلیپ‌بورد است — پیست و ارسال کن.`) : (LANG === 'en' ? 'Could not open the messenger.' : 'باز کردن پیام‌رسان ممکن نشد.');
    } catch (e) {
      return LANG === 'en' ? 'Messaging failed: ' + String((e && e.message) || e).slice(0, 60) : 'ارسال انجام نشد: ' + String((e && e.message) || e).slice(0, 60);
    }
  }

  /* اجرای تصمیم مغز — فقط actهای صحه‌گذاری‌شده */
  async function brainExecute(b, cmd) {
    const _B = window.AVABrain;
    const cs = b.actions.filter((a) => a.act === 'contact_send');
    if (cs.length) {
      const c = cs[0];
      const p = c.params || {};
      const nm = String(p.name || '');
      const app = String(p.app || 'telegram');
      const appFa = { telegram: 'تلگرام', discord: 'دیسکورد', whatsapp: 'واتساپ', bale: 'بله', rubika: 'روبیکا', eitaa: 'ایتا' }[app] || app;
      _pendingConfirm = { action: c, at: Date.now(), cmd };
      actLog('brain confirm needed: contact_send ' + app + ' name=' + nm.slice(0, 30) + ' text=' + String(p.text || '').slice(0, 30));
      return { reply: b.confirm || (LANG === 'en' ? `Send "${p.text || ''}" to "${nm}" on ${appFa}?` : `به «${nm}» تو ${appFa} بگم «${p.text || ''}»؟`), kind: 'confirm' };
    }
    const legacy = [], newer = [];
    for (const a of b.actions) ((window.AVABrain && _B.BRAIN_DO_ACTS.has(a.act) && DO_ACTS.includes(a.act)) ? legacy : newer).push(a);
    let out1 = '', out2 = '';
    if (newer.length) out1 = await executeBrainNewActs(newer, cmd);
    if (legacy.length) out2 = await executeDoActions(legacy.map((a) => ({ act: a.act, value: a.value })), cmd);
    return { reply: [b.speak, out1, out2].filter(Boolean).join(' — ').trim(), kind: (b.actions.length ? 'do' : 'chat') };
  }

  async function aiHandleCommand(cmd, extraCtx) {
    /* v0.66 — نسل‌بندی (epoch): اگر فرمان جدید فرمانِ در جریان را لغو کند،
       رانِ کهنه هیچ UI ای (چیپ/کارت/وضعیت) نباید دست بزند */
    const myEpoch = aiRunEpoch;
    thinkChipSet(true);
    try { return await aiHandleCommandRun(cmd, extraCtx); }
    finally { if (aiRunEpoch === myEpoch) thinkChipSet(false); }
  }
  async function aiHandleCommandRun(cmd, extraCtx) {
    /* v0.66 — لغو: بعد از هر فراخوانِ شبکه‌ای چک می‌شود؛ رانِ لغوشده ساکت برمی‌گردد */
    const myEpoch = aiRunEpoch;
    const aiStale = () => aiRunEpoch !== myEpoch;
    setState('processing');
    statusText.textContent = t('ai.asking');
    body.classList.add('has-card');
    rcHeard.textContent = `«${cmd}»`;
    respCard.classList.remove('show');
    void respCard.offsetWidth;
    respCard.classList.add('show');
    hideWakeDropCard(); /* v0.27.1 */
    rcReply.textContent = '';
    rcTag.textContent = t('tag.ai');
    /* v0.41 — نگاشت آموخته‌شده: این عبارت قبلاً AI به یک فرمان واقعی آوا
       نگاشتش کرده → همین حالا اجرا، صفر شبکه (سرعت: «سریعتر به AI وصلش کنیم») */
    /* ============================================================
       v0.47 — سیستم یادگیری: اول حافظهٔ یادگیری چک می‌شود
       • hit و تکرارِ اخیر (نارضایتی) → اصلاح: یادگیری باطل + تصمیم تازه با AI
       • hit عادی → بازپخش آفلاین (بدون شبکه، فوری) با تگ «⚡ یادگرفته»
       • شکستِ بازپخش → حذف یادگیری و رفتن به AI (همان منطق صادق v0.45)
       ============================================================ */
    try {
      const Le = (typeof AVALearn !== 'undefined') ? AVALearn : null;
      if (Le && learnLoaded && learnStore.items.length) {
        const lhit = Le.match(learnStore, cmd);
        if (lhit) {
          if (Le.isRepeatHit(lhit, Date.now())) {
            /* کاربر همان را دوباره گفت = از عملکرد قبلی راضی نبود */
            const rv = Le.revise(learnStore, lhit);
            await saveLearnStore();
            actLog('learn revise (repeat = unsatisfied): ' + Le.summary(lhit.acts) + ' → ' + (rv.unstable ? 'marked unstable (no more auto-run)' : 'dropped, AI re-decides fresh'));
            try { renderLearnList(); } catch (_) { /* noop */ }
            /* ادامه به مسیر عادی AI (پایین) — یادگیری تازه جایگزین می‌شود */
          } else {
            actLog('learn hit (offline replay): ' + Le.summary(lhit.acts));
            const outs = await executeDoActions(lhit.acts, cmd, 'replay');
            const failedOut = outs.some((x) => /انجام نشد|باز نشد|Could not|Couldn't|پیدا نشد/.test(String(x || '')));
            if (failedOut) {
              Le.dropKey(learnStore, lhit.k);
              await saveLearnStore();
              actLog('learn replay failed → dropped, asking AI fresh');
              /* ادامه به AI */
            } else {
              Le.markUsed(lhit);
              await saveLearnStore();
              const fin = outs.filter(Boolean).join(' — ') || (LANG === 'en' ? 'Done.' : 'انجام شد.');
              pushChatHist('user', cmd); pushChatHist('assistant', fin);
              setState('success');
              statusText.textContent = t('ai.got');
              rcTag.textContent = t('learn.tag');
              typeText(rcReply, fin);
              speak(fin);
              playDoneSound(); /* v0.65 — بازپخش موفق آفلاین */
              pushHistory(cmd, true);
              handsFreeRearm();
              cmdBusy = false;
              _dispatchOutcome = 'learn-replay';
              setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 3000);
              return;
            }
          }
        }
      }
    } catch (_) { /* noop */ }
    if (extraCtx) {
      const cachedId = aiMapGet(cmd);
      if (cachedId) {
        const rr = RULES.find((x) => x.id === cachedId);
        if (rr) {
          actLog('ai map cache → ' + rr.id);
          const out = await resolveReply(rr, cmd).catch(() => null);
          const failedOut = typeof out === 'string' && out && /انجام نشد|Couldn't/.test(out);
          /* v0.45 — منطق اصلاحی: نگاشت کش‌شده‌ای که شکست خورد (null یا متن شکست)
             نباید سرِ جایش بماند — نگاشت خراب حذف می‌شود تا دفعهٔ بعد AI تازه
             تصمیم بگیرد؛ null (استثنا) مستقیم به مسیر عادی AI می‌رود */
          if (out == null || failedOut) {
            try {
              delete aiCmdMap[aiMapNorm(cmd)];
              localStorage.setItem(AI_MAP_KEY, JSON.stringify(aiCmdMap));
              actLog('ai map cache dropped (failed run): ' + rr.id);
            } catch (_) { /* noop */ }
            if (failedOut) {
              pushChatHist('user', cmd); pushChatHist('assistant', out);
              setState('success');
              statusText.textContent = t('ai.got');
              rcTag.textContent = t('tag.aiDo') + ' · ⚡';
              typeText(rcReply, out);
              speak(out);
              pushHistory(cmd, false);
              handsFreeRearm();
              cmdBusy = false;
              setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 3000);
              return;
            }
            /* null → نگاشت کش‌شده امروز نتوانست انجام دهد → مسیر عادی AI */
          } else if (!(out && typeof out === 'object' && out.__aiFallback)) {
            const fin = out;
            pushChatHist('user', cmd); pushChatHist('assistant', fin);
            setState('success');
            statusText.textContent = t('ai.got');
            rcTag.textContent = t('tag.aiDo') + ' · ⚡';
            typeText(rcReply, fin);
            speak(fin);
            pushHistory(cmd, true);
            if (rr.id && SUGGEST_TRIGGERS.has(rr.id)) maybeSuggestCommands('video');
            handsFreeRearm();
            cmdBusy = false;
            setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 3000);
            return;
          }
          /* نگاشت کش‌شده امروز نتوانست انجام دهد → مسیر عادی AI */
        }
      }
    }
    try {
      /* v0.70 — مغز واحد: اول JSON-برین (تحلیل کامل توسط مدل)، شکست → فالبک فکر-اول قدیمی */
      const _br = await aiBrainRound(cmd, extraCtx);
      if (aiStale()) return; /* v0.66 — لغو شد */
      if (!_br.legacy) {
        const _out = await brainExecute(_br.brain, cmd);
        if (aiStale()) return;
        actLog('brain JSON ok: actions=' + _br.brain.actions.map((a) => a.act).join(',') + ' kind=' + _out.kind);
        pushChatHist('user', cmd); pushChatHist('assistant', _out.reply || '…');
        setState('success');
        statusText.textContent = t('ai.got');
        rcTag.textContent = t('tag.aiDo') + (_br.via ? ' · ' + _br.via : '');
        typeText(rcReply, _out.reply || '…');
        speak(_out.reply);
        if (!/انجام نشد|باز نشد|Could not|Couldn't|پیدا نشد|ذخیره نشد/.test(String(_out.reply)) && _out.kind === 'do') playDoneSound();
        pushHistory(cmd, true);
        try { if (window.AVACore) window.AVACore.recordTurn({ utterance: cmd, via: 'ai-brain-json', intent: _br.brain.actions[0] ? _br.brain.actions[0].act : 'chat', reply: String(_out.reply || '').slice(0, 200) }); } catch (_) { /* noop */ }
        /* یادگیری فقط برای اکشن‌های DO-سازگار (قابل بازپخش آفلاین) */
        if (_out.kind === 'do' && _br.brain.actions.length && _br.brain.actions.every((a) => DO_ACTS.includes(a.act))) {
          try { await learnFromAI(cmd, _br.brain.actions.map((a) => ({ act: a.act, value: a.value })), _br.brain.speak || ''); } catch (_) { /* noop */ }
        }
        handsFreeRearm();
        cmdBusy = false;
        setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 3000);
        return;
      }
      /* v0.52 — مسیر فکر-اول (فالبک): فکر → در صورت نیاز تحقیق وب واقعی → دور دوم داده‌محور */
      const _bt = await aiThinkRound(cmd, extraCtx);
      if (aiStale()) return; /* v0.66 — لغو شد؛ فرمان جدید در اختیار UI است */
      const r = _bt.r;
      if (r && r.ok) {
        /* v0.20 — اول پروتکل اجرای عملی (Function Calling): اگر AI تصمیم گرفت
           کاری انجام شود، اجرای واقعی با کد محلی و مسیرهای امن آوا است */
        let _rEff = r;
        let doRes = parseDo(r.text);
        /* v0.63 — حکم اجرا: اگر فکرِ AI گفت «command/فرمان» ولی بلوک DO نداد،
           یک دور ترمیم اجرا می‌شود — فرمانِ شناخته‌شده هرگز بی‌اجرا نمی‌ماند
           (لاگ v0.62: «ببند/پین کن/ببر بالا سمت راست» فهمیده شدند ولی هیچ
           DO ای صادر نشد و سکوت مطلق) */
        if (!doRes.do && _bt.think && /(command|فرمان)/i.test(String(_bt.think).slice(0, 60))) {
          actLog('ai DO-repair: فکر=فرمان ولی بلوک DO نبود — دور ترمیم');
          const _rp = await aiAsk(cmd, (extraCtx || '') +
            '\n[دور ترمیم — قانون مهم: در فکرِ قبلی خودت این درخواست را «فرمان/command» خواندی ولی بلوک DO ندادی. الان فقط یکی از این دو را بنویس: اگر واقعاً فرمانِ اجرایی است، فقط و فقط بلوک DO معتبر با act از فهرست مجاز؛ اگر اشتباه کردی و سوال/گفتگو بود، فکر را با question/سوال شروع کن و هیچ بلوکی نده.]');
          if (_rp && _rp.ok) {
            if (aiStale()) return; /* v0.66 */
            const _rd = parseDo(_rp.text);
            if (_rd.do) {
              doRes = _rd; _rEff = _rp;
              actLog('ai DO-repair ok: ' + _rd.do.actions.map((x) => x.act + (x.value ? '(' + String(x.value).slice(0, 20) + ')' : '')).join(' + '));
            }
          }
        }
        if (doRes.do) {
          /* v0.51 — فاز تحقیق (ریشهٔ توهم «نازنین» لاگ v0.50): اگر AI خواست اول
             تحقیق کند (act=research)، نتایج واقعی وب گرفته می‌شود و دور دوم AI
             با دادهٔ واقعی اکشن نهایی می‌دهد. برنامه‌های تحقیقی یاد گرفته نمی‌شوند
             (قابل اجرای آفلاین نیستند) — صادقانه لاگ می‌شود. حلقه بیش از یک دور
             نیست: دور دوم هر research ای بدهد فیلتر می‌شود. */
          const _rAct = doRes.do.actions.find((a) => a && a.act === 'research');
          const _rDone = extraCtx && String(extraCtx).indexOf(RESEARCH_CTX_MARK) >= 0;
          if (_rAct && !_rDone && bridge && bridge.ai && bridge.ai.research) {
            const _rq = String(_rAct.value || '').trim().slice(0, 150);
            actLog('ai research: «' + _rq + '» → وب‌گردی واقعی، بعد دور دوم');
            const _rr = await bridge.ai.research(_rq).catch(() => null);
            if (aiStale()) return; /* v0.66 */
            const _resTxt = (_rr && _rr.text) || '';
            const _ctx2 = (extraCtx || '') +
              '\n' + RESEARCH_CTX_MARK + ' برای «' + _rq + '»]' +
              (_resTxt ? '\n' + _resTxt : '\n(تحقیق وب ناموفق بود — صادقانه بگو و هیچ action نساز)') +
              '\n[پایان نتایج — حالا فقط بر پایهٔ همین نتایج بلوک DO نهایی بده؛ act=research دیگر مجاز نیست و هرگز اسم/عنوان را از حافظه‌ات نساز]';
            const _r2 = await aiAsk(cmd, _ctx2);
            if (aiStale()) return; /* v0.66 */
            if (_r2 && _r2.ok) {
              const _do2 = parseDo(_r2.text);
              if (_do2.do) {
                const _acts2 = _do2.do.actions.filter((a) => a && a.act !== 'research');
                actLog('ai DO(final): ' + (_acts2.map((a) => a.act + (a.value ? '(' + a.value.slice(0, 24) + ')' : '')).join(' + ') || '(بدون اکشن)'));
                const _rep2 = _acts2.length ? await executeDoActions(_acts2, cmd) : '';
                const _fin2 = [_do2.do.reply, _rep2].filter(Boolean).join(' — ');
                actLog('learn skip: برنامهٔ تحقیقی (research) قابل اجرای آفلاین نیست');
                pushChatHist('user', cmd); pushChatHist('assistant', _fin2);
                setState('success');
                statusText.textContent = t('ai.got');
                rcTag.textContent = t('tag.aiDo') + (_r2.via ? ' · ' + _r2.via : '');
                typeText(rcReply, _fin2 || '…');
                speak(_fin2);
                if (!/انجام نشد|باز نشد|Could not|Couldn't|پیدا نشد/.test(String(_fin2))) playDoneSound(); /* v0.65 */
                pushHistory(cmd, true);
                handsFreeRearm();
                cmdBusy = false;
                setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 3000);
                return;
              }
              const _txt2 = parseAdd(_r2.text).reply || _r2.text;
              pushChatHist('user', cmd); pushChatHist('assistant', _txt2);
              setState('success');
              statusText.textContent = t('ai.got');
              rcTag.textContent = t('tag.ai') + (_r2.via ? ' · ' + _r2.via : '');
              typeText(rcReply, _txt2 || '…');
              speak(_txt2);
              pushHistory(cmd, true);
              handsFreeRearm();
              cmdBusy = false;
              setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 3000);
              return;
            }
            actLog('research round-2 failed → مسیر عادی DO');
          }
          actLog('ai DO: ' + doRes.do.actions.map((a) => a.act + (a.value ? '(' + a.value.slice(0, 24) + ')' : '')).join(' + '));
          const actReply = await executeDoActions(doRes.do.actions, cmd); /* v0.39 — cmd برای run_cmd */
          /* v0.47 — یادگیری از عمل‌های موفق هوش مصنوعی (فقط عمل‌های امنِ whitelist) */
          try {
            if (!/انجام نشد|باز نشد|Could not|Couldn't|پیدا نشد/.test(String(actReply || ''))) {
              await learnFromAI(cmd, doRes.do.actions, doRes.do.reply || '');
            }
          } catch (_) { /* noop */ }
          const finalReply = [doRes.do.reply, actReply].filter(Boolean).join(' — ');
          pushChatHist('user', cmd); pushChatHist('assistant', finalReply);
          setState('success');
          statusText.textContent = t('ai.got');
          rcTag.textContent = t('tag.aiDo') + (_rEff.via ? ' · ' + _rEff.via : '');
          typeText(rcReply, finalReply || '…');
          speak(finalReply);
          if (!/انجام نشد|باز نشد|Could not|Couldn't|پیدا نشد/.test(String(finalReply))) playDoneSound(); /* v0.65 — فقط موفقیتِ واقعی */
          pushHistory(cmd, true);
          handsFreeRearm();
          cmdBusy = false;
          setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 3000);
          return;
        }
        /* v0.52 — پاسخ متنی بدون خط فکر و بدون بلوک RESEARCH */
        const { reply, add } = parseAdd(_bt.body || r.text);
        pushChatHist('user', cmd); pushChatHist('assistant', r.text);
        setState('success');
        statusText.textContent = t('ai.got');
        /* نشان موتور پاسخ‌دهنده — شفاف بودن اولویت جمنای */
        rcTag.textContent = (add ? t('tag.aiCmd') : t('tag.ai')) + (r.via ? ' · ' + r.via : '');
        typeText(rcReply, reply || '…');
        speak(reply);
        playDoneSound(); /* v0.65 — پاسخ گفتاری هم «انجام شد» است */
        if (add) {
          const okGo = await askConfirm({
            title: LANG === 'en' ? 'New command suggested' : 'فرمان جدید پیشنهاد شد',
            text: LANG === 'en'
              ? `The AI built this command for you: "${add.title}". Add it to your commands?`
              : `هوش مصنوعی برای درخواستت این فرمان را ساخت: «${add.title}». به فرمان‌ها اضافه شود؟`,
            code: (add.action.type === 'ps' ? 'PowerShell: ' : add.action.type === 'open_url' ? 'URL: ' : 'Command: ') + add.action.value,
          });
          if (okGo) {
            add.id = Date.now();
            customCmds.push(add);
            store.set('customCmds', customCmds);
            renderCustomChips();
            toast(t('toast.cmdAdded', { x: add.title }), '#i-plus');
          }
        }
      } else {
        if (aiStale()) return; /* v0.66 — رانِ لغوشده پیامِ شکست روی کارتِ فرمانِ جدید ننویسد */
        setState('success');
        statusText.textContent = r && r.needLogin ? t('ai.noConn') : t('ai.fail');
        rcTag.textContent = t('tag.ai');
        typeText(rcReply, (r && r.error) || t('chat.noReply'));
        /* v0.47 — B03: شکست هوش مصنوعی صدادار شد (قبلاً فقط متن — لاگ: سکوت کامل) */
        try { speak(statusText.textContent); } catch (_) { /* noop */ }
        pushHistory(cmd, false);
      }
    } catch (_) {
      if (aiStale()) return; /* v0.66 */
      setState('success');
      rcTag.textContent = t('tag.ai');
      typeText(rcReply, t('ai.err'));
      /* v0.47 — B03: سکوت به‌جای صداقت ممنوع */
      try { speak(t('ai.err')); } catch (_) { /* noop */ }
      pushHistory(cmd, false);
    }
    handsFreeRearm();
    if (!aiStale()) cmdBusy = false; /* v0.66 — رانِ لغوشده گاردِ فرمانِ جدید را نسوزاند */
    setTimeout(() => {
      if (state === 'success') {
        setState('idle');
        statusText.innerHTML = IDLE_HINT;
      }
    }, 3000);
  }

  /* ============================================================
     v0.61 — نیت «بستن پخش» (بازنگری کامل منطق)
     ------------------------------------------------------------
     قبلاً: «یوتیوب رو ببند» یوتیوب را باز می‌کرد (نیت مخالف نادیده
     می‌شد) → فیکس v0.45 نیت بستن را ساخت. حالا پنجره‌های خودساختهٔ
     آوا (ytWin/PiP) حذف شده‌اند؛ بستن یعنی بستن پلیری که آوا اجرا
     کرده، وگرنه پاسخ صادقانه.
     ============================================================ */
  async function ytCloseReply() {
    try {
      if (bridge && bridge.player && bridge.player.ctl) {
        const res = await bridge.player.ctl({ action: 'close', arg: 0 });
        if (res && res.ok) {
          /* v0.66 — شمارش صادقانه: «بستم (۲ پلیر)» تا کاربر بداند چند پلیر بسته شد */
          const n = res && res.count ? Number(res.count) : 0;
          if (LANG === 'en') return n > 1 ? `Closed ${n} players.` : 'Closed the player.';
          return n > 1 ? `${faNum(String(n))} پلیر باز را بستم.` : 'پلیر بسته شد.';
        }
      }
    } catch (_) { /* noop */ }
    return LANG === 'en'
      ? 'No player that I launched is open right now. To stop local music, say "pause the music".'
      : 'الان پلیری که من اجرا کرده باشم باز نیست. برای توقف موزیکِ محلی بگو «آهنگ رو قطع کن».';
  }

  /* «چجوری می‌تونم …؟» — اول رجیستری محلی (آفلاین و فوری)، بعد AI با مانیفست */
  async function howToReply(cmd) {
    const hit = AVACapabilities.search(cmd);
    if (hit) {
      actLog('how-to local hit: ' + hit.cap.id);
      return AVACapabilities.howReply(hit, LANG);
    }
    if (aiConnected()) return AI_FALLBACK; /* با __aiExtra فهرست توانایی‌ها به AI می‌چسبد */
    return LANG === 'en'
      ? 'I am offline right now — sign in on the GLM chat tab and ask again. Meanwhile I can control video players ("play the video", "fullscreen", "play in VLC"), control Discord (mute/deafen/call/message), dictate into any app ("type here for me"), play music, read rates/weather, set timers and reminders, and open apps or sites.'
      : 'الان به هوش مصنوعی وصل نیستم که جواب کامل بدهم (تب «صفحه چت GLM» وارد حسابت شو). فعلاً این‌ها را بلدم: کنترل پلیر ویدیو («ویدیو رو پلی کن»، «فول اسکرین»، «با وی‌ال‌سی پخش کن»، «با پلیر پیش‌فرض پخش کن»)، دیسکورد (میوت/دیفن/تماس/پیام)، تایپ صوتی در هر برنامه («اینجا برام تایپ کن»)، موزیک، آب‌وهوا، قیمت ارز و طلا، اوقات شرعی، تایمر، یادآوری، یادداشت، خاموش/ریستارت و باز کردن برنامه‌ها و سایت‌ها.';
  }

  /* ============================================================
     پلیر موزیک (v0.11) — پلی‌لیست زیبا از پوشه کاربر
     • انتخاب پوشه (webkitdirectory) و اسکن فایل‌های صوتی
     • خواندن تگ‌های ID3v2 (عنوان/خواننده/کاور) بدون هیچ کتابخانه‌ای
     • پخش با <audio>: شافل، تکرار، سیک، ولوم، MediaSession ویندوز
     • ویجت شیشه‌ای روی صفحه اصلی + اکولایزر زنده
     ============================================================ */
  const AUDIO_EXT = /\.(mp3|m4a|aac|wav|flac|ogg|oga|opus|weba|webm|wma)$/i;
  const music = { tracks: [], view: [], cur: -1, playing: false, shuffle: false, repeat: 'off', folderName: '', widgetDismissedFor: null };

  /* --- پارسر ID3v2 (mp3) — عنوان، خواننده و کاور ---
     v0.22 — حالا از هدر خوانده‌شده (Uint8Array) کار می‌کند؛
     هم برای مسیر فایل واقعی (پلیر ماندگار) و هم برای File مرورگر */
  function decodeId3Text(bytes, enc) {
    try {
      let s = '';
      if (enc === 1) { /* UTF-16 با BOM */
        if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) s = new TextDecoder('utf-16be').decode(bytes.subarray(2));
        else s = new TextDecoder('utf-16le').decode(bytes.subarray(bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe ? 2 : 0));
      } else if (enc === 2) s = new TextDecoder('utf-16be').decode(bytes);
      else if (enc === 3) s = new TextDecoder('utf-8').decode(bytes);
      else s = new TextDecoder('windows-1252').decode(bytes);
      return s.replace(/\u0000+$/g, '').replace(/^\u0000+/g, '').trim();
    } catch (_) { return ''; }
  }

  /* هستهٔ پارس ID3 از هدر خوانده‌شده (Uint8Array) */
  function parseId3Buf(head) {
    const out = { title: '', artist: '', album: '', cover: null };
    try {
      if (!head || head.length < 10) return out;
      if (head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return out; /* «ID3» */
      const ver = head[3];
      const size = ((head[6] & 0x7f) << 21) | ((head[7] & 0x7f) << 14) | ((head[8] & 0x7f) << 7) | (head[9] & 0x7f);
      if (size < 10 || size > 3 * 1024 * 1024) return out;
      const buf = head.slice(10, 10 + Math.min(size, 3 * 1024 * 1024));
      const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      let pos = 0;
      /* پدینگ اکسپریمنتال (footer) نادیده گرفته می‌شود */
      const frameHdr = ver >= 3 ? 10 : 6;
      while (pos + frameHdr <= buf.length) {
        let id = '', fsize = 0;
        if (ver >= 3) {
          id = String.fromCharCode(buf[pos], buf[pos + 1], buf[pos + 2], buf[pos + 3]);
          if (!/^[A-Z0-9]{4}$/.test(id)) break;
          if (ver === 4) fsize = ((buf[pos + 4] & 0x7f) << 21) | ((buf[pos + 5] & 0x7f) << 14) | ((buf[pos + 6] & 0x7f) << 7) | (buf[pos + 7] & 0x7f);
          else fsize = dv.getUint32(pos + 4);
        } else {
          id = String.fromCharCode(buf[pos], buf[pos + 1], buf[pos + 2]);
          if (!/^[A-Z0-9]{3}$/.test(id)) break;
          fsize = (buf[pos + 3] << 16) | (buf[pos + 4] << 8) | buf[pos + 5];
        }
        if (fsize <= 0 || pos + frameHdr + fsize > buf.length) break;
        const data = buf.subarray(pos + frameHdr, pos + frameHdr + fsize);
        if (id === 'TIT2' || id === 'TT2') out.title = decodeId3Text(data.subarray(1), data[0]);
        else if (id === 'TPE1' || id === 'TP1') out.artist = decodeId3Text(data.subarray(1), data[0]);
        else if (id === 'TALB' || id === 'TAL') out.album = decodeId3Text(data.subarray(1), data[0]);
        else if ((id === 'APIC' || id === 'PIC') && !out.cover) {
          try {
            const enc = data[0];
            let p = 1, mime = 'image/jpeg';
            if (id === 'APIC') {
              let z = data.indexOf(0, p);
              if (z > p) mime = String.fromCharCode(...data.subarray(p, z)) || mime;
              p = z + 1;
            } else { p = 4; } /* PIC: ۳ بایت فرمت تصویر */
            p += 1; /* نوع تصویر */
            /* توضیح با انکودینگ متن (null ترمینیتور: 1 یا 2 بایت) */
            if (enc === 1 || enc === 2) { while (p + 1 < data.length && !(data[p] === 0 && data[p + 1] === 0)) p += 2; p += 2; }
            else { while (p < data.length && data[p] !== 0) p += 1; p += 1; }
            const img = data.subarray(p);
            if (img.length > 200) out.cover = URL.createObjectURL(new Blob([img], { type: mime.includes('/') ? mime : 'image/jpeg' }));
          } catch (_) { /* noop */ }
        }
        pos += frameHdr + fsize;
      }
    } catch (_) { /* noop */ }
    return out;
  }

  /* فالبک مرورگر (پیش‌نمایش وب): File مستقیم */
  async function readId3(file) {
    try { return parseId3Buf(new Uint8Array(await file.slice(0, 3 * 1024 * 1024 + 10).arrayBuffer())); }
    catch (_) { return { title: '', artist: '', album: '', cover: null }; }
  }
  /* v0.22 — خواندن تگ‌ها از مسیر واقعی فایل (پلیر ماندگار؛ هدر از پروسهٔ اصلی) */
  async function readId3FromPath(p) {
    if (!bridge || !bridge.music || !p) return { title: '', artist: '', album: '', cover: null };
    try {
      const r = await bridge.music.readHead(p, 3 * 1024 * 1024 + 10);
      if (!r || !r.ok || !r.head) return { title: '', artist: '', album: '', cover: null };
      return parseId3Buf(r.head);
    } catch (_) { return { title: '', artist: '', album: '', cover: null }; }
  }

  /* --- ساخت ردیف آهنگ --- */
  function fmtDur(s) {
    if (!isFinite(s) || s < 0) return '--:--';
    const m = Math.floor(s / 60), ss = Math.floor(s % 60);
    return `${m}:${String(ss).padStart(2, '0')}`;
  }

  /* پر شدن نوار سیک/ولوم (گرادیان با --p) — سیک و ولوم همیشه یکدست */
  function paintRange(el) {
    if (!el) return;
    const min = Number(el.min) || 0;
    const max = Number(el.max) || 100;
    const p = ((Number(el.value) - min) / (max - min)) * 100;
    el.style.setProperty('--p', `${Math.max(0, Math.min(100, p))}%`);
  }

  function renderMusicList() {
    if (!mList) return;
    const q = (mSearch && mSearch.value || '').trim().toLowerCase();
    music.view = music.tracks.filter((tr) => !q || (tr.title + ' ' + tr.artist + ' ' + (tr.name || (tr.file && tr.file.name) || '')).toLowerCase().includes(q));
    const sc = mList.scrollTop; /* اسکرول کاربر با هر رندر حفظ شود */
    mList.innerHTML = '';
    if (mEmpty) mEmpty.hidden = music.tracks.length > 0;
    if (mCount) {
      mCount.hidden = !music.tracks.length;
      if (music.tracks.length) {
        mCount.textContent = (music.folderName ? music.folderName + ' • ' : '') + t('music.tracks', { x: faNum(music.tracks.length) });
      }
    }
    const frag = document.createDocumentFragment();
    music.view.forEach((tr) => {
      /* فیکس باگ مهم: index در «view فیلترشده» با index در «tracks» یکی نیست؛
         قبلاً با جستجوی فعال، آهنگ اشتباهی پخش می‌شد — حالا شناسه واقعی آهنگ */
      const tIdx = music.tracks.indexOf(tr);
      const row = document.createElement('div');
      row.className = 'm-row' + (tIdx === music.cur ? ' current' : '');
      row.dataset.idx = String(tIdx);
      /* v0.21 — بدون تامبنیل و جعبه: شماره + عنوان + مدت؛ در هاور هم شماره
         به دکمهٔ پخش تبدیل می‌شود — ساده، مرتب، مینیمال (خواست کاربر) */
      row.innerHTML =
        `<span class="m-idx num"><span class="m-num">${faNum(tIdx + 1)}</span><svg class="ic m-go"><use href="#i-play"/></svg><span class="eqbars"><i></i><i></i><i></i></span></span>` +
        `<span class="m-tt"><b></b><span class="m-ar"></span></span>` +
        `<span class="m-dur num">--:--</span>`;
      row.querySelector('.m-tt b').textContent = tr.title;
      row.querySelector('.m-ar').textContent = tr.artist || String(tr.name || (tr.file && tr.file.name) || '').replace(/\.[^.]+$/, '');
      row.querySelector('.m-dur').textContent = tr.dur ? fmtDur(tr.dur) : '--:--';
      row.addEventListener('click', () => playTrack(tIdx));
      frag.appendChild(row);
    });
    mList.appendChild(frag);
    mList.scrollTop = sc;
  }

  /* مدت هر آهنگ به‌صورت پس‌زمینه‌ای خوانده می‌شود (بدون کند کردن لیست) */
  async function loadDurations() {
    for (const tr of music.tracks) {
      if (tr.dur) continue;
      try {
        const a = new Audio();
        a.preload = 'metadata';
        a.src = tr.url;
        await new Promise((res) => {
          const done = () => { res(); a.src = ''; };
          a.onloadedmetadata = () => { tr.dur = a.duration; done(); };
          a.onerror = done;
          setTimeout(done, 6000);
        });
      } catch (_) { /* noop */ }
      if ((mSearch && mSearch.value || '').trim()) continue; /* جستجوی فعال — بعداً */
      /* ردیف‌ها با شناسه واقعی آهنگ مچ می‌شوند (نه index فیلترشده) */
      if (mList) Array.from(mList.children).forEach((rowEl) => {
        const tr2 = music.tracks[Number(rowEl.dataset.idx)];
        if (tr2 && tr2.dur) { const d = rowEl.querySelector('.m-dur'); if (d) d.textContent = fmtDur(tr2.dur); }
      });
    }
  }

  /* --- کاور + متادیتا پس‌زمینه‌ای برای همه آهنگ‌ها ---
     هر ۴ فایل یک‌بار لیست تازه می‌شود تا با پلی‌لیست بزرگ کند نشود */
  async function enrichTracks() {
    let since = 0;
    for (const tr of music.tracks) {
      if (tr.enriched) continue;
      tr.enriched = true;
      /* v0.22 — مسیرمحور (پلیر ماندگار) یا File (فالبک مرورگر) */
      const tag = tr.path ? await readId3FromPath(tr.path) : await readId3(tr.file);
      if (tag.title) tr.title = tag.title;
      if (tag.artist) tr.artist = tag.artist;
      if (tag.cover) tr.cover = tag.cover;
      since += 1;
      if (since % 4 === 0) renderMusicList();
      /* v0.23 — اگر این آهنگ همان آهنگِ در حال پخش باشد، کاور بزرگ فوراً تازه شود */
      if (music.tracks[music.cur] === tr && (tag.cover || tag.title)) updatePlayerUI();
    }
    renderMusicList();
  }

  /* v0.31.0 — کاور امن: اگر blob خراب بود (ID3 ناقص/انکودینگ عجیب)، img خودش
     را حذف می‌کند و tr.cover پاک می‌شود تا آیکون «تصویر شکسته» هیچ‌وقت دیده
     نشود؛ ردیف‌ها هم دوباره رندر می‌شوند تا واترمارک کاور قدیمی نماند */
  function setCoverArt(el, tr, rerender) {
    if (!el) return;
    const old = el.querySelector('img');
    if (old) old.remove();
    if (!tr || !tr.cover) return;
    el.insertAdjacentHTML('afterbegin', `<img src="${tr.cover}" alt=""/>`);
    const im = el.querySelector('img');
    if (im) im.onerror = () => {
      im.remove();
      tr.cover = null;
      if (rerender) { try { renderMusicList(); } catch (_) { /* noop */ } }
    };
  }

  function updatePlayerUI() {
    const tr = music.tracks[music.cur];
    const playing = music.playing;
    if (mPlayIcon) mPlayIcon.setAttribute('href', playing ? '#i-pause' : '#i-play');
    if (mwPlayIcon) mwPlayIcon.setAttribute('href', playing ? '#i-pause' : '#i-play');
    document.body.classList.toggle('music-on', !!tr);
    document.body.classList.toggle('music-playing', playing);
    if (mEq) mEq.classList.toggle('live', playing);
    if (mwEq) mwEq.classList.toggle('live', playing);
    if (tr) {
      if (mTitle) mTitle.textContent = tr.title;
      if (mArtist) mArtist.textContent = tr.artist || String(tr.name || (tr.file && tr.file.name) || '').replace(/\.[^.]+$/, '');
      if (mwTitle) mwTitle.textContent = tr.title;
      if (mwArtist) mwArtist.textContent = tr.artist || '';
      /* کاور (v0.31.0 — با onerror امن) */
      setCoverArt(mCover, tr, true);
      setCoverArt(mwCover, tr, false);
      if (musicWidget) musicWidget.hidden = !settings.extMusic || music.widgetDismissedFor === music.cur; /* افزونهٔ موزیک خاموش یا با درگ بسته شده → مخفی */
    } else {
      if (musicWidget) musicWidget.hidden = true;
    }
    /* ردیف جاری در لیست — با شناسه واقعی آهنگ (فیکس جستجوی فعال)
       v0.21 — شماره/پخش/اکولایزر با کلاس سوییچ می‌شوند (بدون innerHTML پویا) */
    if (mList) Array.from(mList.children).forEach((rowEl) => {
      const i = Number(rowEl.dataset.idx);
      rowEl.classList.toggle('current', i === music.cur);
      rowEl.classList.toggle('playing-row', playing && i === music.cur);
    });
  }

  function playTrack(i) {
    if (!music.tracks.length) return;
    music.cur = ((i % music.tracks.length) + music.tracks.length) % music.tracks.length;
    music.widgetDismissedFor = null; /* آهنگ جدید → ویجت دوباره می‌آید */
    const tr = music.tracks[music.cur];
    /* v0.22 — آخرین آهنگ برای بازسازی بعد از ری‌استارت یاد می‌ماند */
    if (tr.path) { settings.lastMusicPath = tr.path; store.set('lastMusicPath', tr.path); }
    /* v0.38.1 — play() یک Promise می‌دهد؛ reject آن (فایل حذف‌شده/404) بدون catch
       unhandled rejection و گیر کردن UI در حالت «در حال پخش» می‌ساخت */
    try { mAudio.src = tr.url; mAudio.play().catch(() => { /* noop */ }); } catch (_) { /* noop */ }
    mediaSessionMeta();
    /* v0.23 — کاور/تگِ آهنگِ در حال پخش اولویت می‌گیرد: اگر هنوز enriched نشده
       بود، همین حالا می‌خوانیم تا کاور فوراً روی کارت بزرگ بیاید، نه بعد از
       رسیدن صف پس‌زمینه به این آهنگ */
    if (tr.path && !tr.enriched) {
      tr.enriched = true;
      readId3FromPath(tr.path).then((tag) => {
        if (tag.title) tr.title = tag.title;
        if (tag.artist) tr.artist = tag.artist;
        if (tag.cover) tr.cover = tag.cover;
        updatePlayerUI();
        renderMusicList();
      }).catch(() => { /* noop */ });
    }
  }

  function musicNext(auto = false) {
    if (!music.tracks.length) return;
    if (music.shuffle && music.tracks.length > 1) {
      let n = music.cur;
      while (n === music.cur) n = Math.floor(Math.random() * music.tracks.length);
      playTrack(n);
      return;
    }
    if (auto && music.repeat === 'off' && music.cur === music.tracks.length - 1) {
      music.playing = false;
      updatePlayerUI();
      return;
    }
    playTrack(music.cur + 1);
  }

  function musicPrev() {
    if (!music.tracks.length) return;
    /* اگر بیش از ۳ ثانیه پخش شده، از اول همان آهنگ */
    if (mAudio.currentTime > 3) { mAudio.currentTime = 0; return; }
    playTrack(music.cur - 1);
  }

  function musicToggle() {
    if (!music.tracks.length) return false;
    if (mAudio.paused) { mAudio.play().catch(() => {}); return true; }
    mAudio.pause();
    return true;
  }

  if (mAudio) {
    mAudio.volume = settings.musicVol;
    mAudio.addEventListener('play', () => { music.playing = true; updatePlayerUI(); actLog('music play'); });
    mAudio.addEventListener('pause', () => { music.playing = false; updatePlayerUI(); });
    mAudio.addEventListener('ended', () => {
      if (music.repeat === 'one') playTrack(music.cur);
      else musicNext(true);
    });
    mAudio.addEventListener('timeupdate', () => {
      if (mAudio.duration) {
        if (mSeek) { mSeek.value = String(Math.round((mAudio.currentTime / mAudio.duration) * 1000)); paintRange(mSeek); }
        if (mCur) mCur.textContent = fmtDur(mAudio.currentTime);
        if (mDur) mDur.textContent = fmtDur(mAudio.duration);
      }
    });
    /* دکمه بلندگو = قطع/وصل سریع صدا (آخرین ولوم به یاد می‌ماند) */
    let lastMusicVol = settings.musicVol ?? 0.8;
    if (mMute) mMute.addEventListener('click', () => {
      const ico = $('#mMuteIcon');
      if (mAudio.volume > 0) {
        lastMusicVol = mAudio.volume;
        mAudio.volume = 0;
        if (mVol) mVol.value = '0';
        if (ico) ico.setAttribute('href', '#i-mute');
        toast(t('music.muted'), '#i-volume');
      } else {
        mAudio.volume = Math.max(0.01, lastMusicVol);
        if (mVol) mVol.value = String(Math.round(lastMusicVol * 100));
        if (ico) ico.setAttribute('href', '#i-volume');
        toast(t('music.unmuted'), '#i-volume');
      }
      paintRange(mVol);
    });
    /* کنترل از دکمه‌های مدیای کیبورد/ویندوز */
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('play', () => mAudio.play());
        navigator.mediaSession.setActionHandler('pause', () => mAudio.pause());
        navigator.mediaSession.setActionHandler('nexttrack', () => musicNext());
        navigator.mediaSession.setActionHandler('previoustrack', () => musicPrev());
      } catch (_) { /* noop */ }
    }
  }

  function mediaSessionMeta() {
    if (!('mediaSession' in navigator)) return;
    const tr = music.tracks[music.cur];
    try {
      navigator.mediaSession.metadata = tr ? new MediaMetadata({
        title: tr.title,
        artist: tr.artist || 'AVA',
        album: music.folderName || 'AVA Playlist',
        artwork: tr.cover ? [{ src: tr.cover, sizes: '512x512' }] : [],
      }) : null;
    } catch (_) { /* noop */ }
  }

  /* ============================================================
     v0.22 — پلیر موزیک ماندگار (فیکس «پوشه‌ها بعد از ری‌استارت گم می‌شوند»)
     قبلاً پوشه با <input webkitdirectory> انتخاب می‌شد و File های آن فقط
     تا پایان نشست زنده بودند. حالا: دیالوگ واقعی ویندوز → اسکن در پروسهٔ
     اصلی → مسیرها در ava-settings.json → بعد از ری‌استارت بازسازی خودکار.
     ============================================================ */
  const mediaUrl = (p) => `ava-media://m/${encodeURIComponent(p)}`;
  const baseName = (d) => String(d || '').replace(/[\\/]+$/, '').split(/[\\/]/).pop() || '';
  function dirsLabel(dirs) {
    const names = (dirs || []).map(baseName).filter(Boolean);
    if (!names.length) return '';
    return names.slice(0, 2).join(' + ') + (names.length > 2 ? ` +${faNum(names.length - 2)}` : '');
  }

  async function scanAndLoadDirs(dirs, opts = {}) {
    const silent = !!opts.silent;
    if (!bridge || !bridge.music || !Array.isArray(dirs) || !dirs.length) return false;
    const r = await bridge.music.scan(dirs).catch(() => null);
    if (!r || !r.ok || !Array.isArray(r.tracks)) return false;
    const tracks = r.tracks.map((t2) => ({
      path: t2.path,
      name: t2.name,
      url: mediaUrl(t2.path),
      title: String(t2.name || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim(),
      artist: '',
      cover: null,
      dur: 0,
      enriched: false,
    }));
    if (!tracks.length) { if (!silent) toast(t('music.none'), '#i-music'); return false; }
    const wasEmpty = !music.tracks.length;
    try { mAudio.pause(); } catch (_) { /* noop */ }
    try { mAudio.removeAttribute('src'); } catch (_) { /* noop */ }
    music.tracks = tracks;
    music.view = tracks;
    music.folderName = dirsLabel(dirs);
    music.cur = -1;
    renderMusicList();
    if (!silent) toast(t('music.loaded', { x: faNum(tracks.length), y: music.folderName }), '#i-music');
    else if (wasEmpty && !music.restoredToast) { music.restoredToast = true; toast(t('music.restored', { x: faNum(tracks.length) }), '#i-music'); }
    enrichTracks();
    loadDurations();
    /* بازیابی آخرین آهنگ انتخابی کاربر — بدون پخش خودکار */
    let idx = settings.lastMusicPath ? tracks.findIndex((tr) => tr.path === settings.lastMusicPath) : -1;
    if (idx < 0) idx = 0;
    music.cur = idx;
    try { mAudio.src = tracks[idx].url; } catch (_) { /* noop */ }
    updatePlayerUI();
    mediaSessionMeta();
    return true;
  }

  /* بازسازی خودکار بعد از ری‌استارت — فقط یک‌بار */
  async function restoreMusicLibrary() {
    if (music.restored) return;
    const dirs = Array.isArray(settings.musicDirs) ? settings.musicDirs.filter(Boolean) : [];
    if (!bridge || !bridge.music || !dirs.length) { music.restored = true; return; }
    music.restored = true;
    const ok = await scanAndLoadDirs(dirs, { silent: true });
    if (mDirsClear) mDirsClear.hidden = false;
    actLog(`music library restored from ${dirs.length} folder(s) ok=${!!ok}`);
  }

  /* دکمهٔ «انتخاب پوشه موزیک»: دیالوگ ویندوز (چند پوشه، تجمعی) یا فالبک مرورگر */
  async function handleMusicPick() {
    if (bridge && bridge.music) {
      const r = await bridge.music.pickDirs().catch(() => null);
      if (r && r.ok && Array.isArray(r.dirs) && r.dirs.length) {
        const merged = [...new Set([...(Array.isArray(settings.musicDirs) ? settings.musicDirs : []), ...r.dirs])];
        settings.musicDirs = merged;
        store.set('musicDirs', merged);
        await scanAndLoadDirs(merged);
        if (mDirsClear) mDirsClear.hidden = false;
      }
      return;
    }
    /* فالبک مرورگر (پیش‌نمایش وب): ورودی webkitdirectory */
    if (mFolder) mFolder.click();
  }

  async function clearMusicDirs() {
    settings.musicDirs = [];
    store.set('musicDirs', []);
    settings.lastMusicPath = '';
    store.set('lastMusicPath', '');
    try { mAudio.pause(); } catch (_) { /* noop */ }
    try { mAudio.removeAttribute('src'); } catch (_) { /* noop */ }
    music.tracks = [];
    music.view = [];
    music.cur = -1;
    music.folderName = '';
    music.restored = true;
    renderMusicList();
    updatePlayerUI();
    if (mDirsClear) mDirsClear.hidden = true;
    toast(t('music.cleared'), '#i-folder');
  }

  /* فالبک مرورگر — فایل‌های webkitdirectory (بدون ماندگاری؛ فقط پیش‌نمایش وب) */
  async function handleMusicFolder(ev) {
    const files = Array.from((ev.target && ev.target.files) || []).filter((f) => AUDIO_EXT.test(f.name));
    ev.target.value = '';
    if (!files.length) { toast(t('music.none'), '#i-music'); return; }
    mAudio.pause();
    mAudio.removeAttribute('src');
    music.tracks = files.map((f) => ({
      file: f,
      name: f.name,
      url: URL.createObjectURL(f),
      title: f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim(),
      artist: '',
      cover: null,
      dur: 0,
      enriched: false,
    }));
    /* نام پوشه از مسیر نسبی اولین فایل */
    const rel = files[0].webkitRelativePath || '';
    music.folderName = rel ? rel.split('/')[0] : '';
    settings.lastMusicFolder = music.folderName;
    store.set('lastMusicFolder', music.folderName);
    music.cur = -1;
    renderMusicList();
    toast(t('music.loaded', { x: faNum(music.tracks.length), y: music.folderName }), '#i-music');
    enrichTracks();
    loadDurations();
    /* اگر پلیر خالی بود، اولین آهنگ را آماده پخش کن (بدون پخش خودکار) */
    if (music.cur < 0) { music.cur = 0; mAudio.src = music.tracks[0].url; updatePlayerUI(); mediaSessionMeta(); }
  }
  /* v0.22 — بازسازی خودکار پلی‌لیست بعد از ری‌استارت (با درنگ کوتاه تا
     تنظیمات فایل هم لود شود؛ اگر زودتر آماده شد فلگ restored جلوی دوباره‌کاری را می‌گیرد)
     v0.42 — سبک‌سازی: فقط وقتی افزونهٔ موزیک روشن است؛ با خاموش بودن،
     هیچ اسکن پوشه‌ای در شروع انجام نمی‌شود (فعال‌کردن افزونه خودش بازسازی می‌کند) */
  if (settings.extMusic && Array.isArray(settings.musicDirs) && settings.musicDirs.length) {
    setTimeout(() => { try { restoreMusicLibrary(); } catch (_) { /* noop */ } }, 1500);
  }

  /* --- کمک‌کننده‌های فرمان صوتی موزیک ---
     v0.42 — اگر افزونهٔ موزیک خاموش باشد آوا «می‌گوید خاموشه» و صفحهٔ
     افزونه‌ها را باز می‌کند (خواستهٔ کاربر: «اگ موزیک خاست بگ اکستنشن افه») */
  function musicExtOffReply() {
    showView('ext');
    return t('music.extOff');
  }
  function voiceMusicPlay(cmd) {
    if (!settings.extMusic) return musicExtOffReply();
    /* v0.45 — موزیکِ آگاه‌به‌آهنگ (بازنگری منطق فرمان‌پذیری):
       «آهنگ شادمهر رو پخش کن» قبلاً هرچه در پلیر بود را پخش می‌کرد و
       می‌گفت «پخش می‌کنم» — عمل می‌کرد ولی چیزی که خواسته شده نبود.
       حالا: اسم خواسته‌شده جدا می‌شود؛ در کتابخانه محلی هست → همان پخش می‌شود؛
       نیست → درخواست به AI می‌رود (پخش از یوتیوب)؛ بدون AI → صادقانه. */
    const req = musicReqOf(cmd);
    if (req) {
      const nq = normFaFull(req);
      const idx = music.tracks.findIndex((tr) => {
        const tt = normFaFull(tr.title || ''), ar = normFaFull(tr.artist || '');
        return (tt && (tt.includes(nq) || nq.includes(tt))) || (ar && (ar.includes(nq) || nq.includes(ar)));
      });
      if (idx >= 0) { playTrack(idx); return t('music.playing', { x: music.tracks[idx].title }); }
      if (aiConnected()) return AI_FALLBACK;
      return LANG === 'en'
        ? `"${req}" is not in your local music library. Say "play ${req} on YouTube" and I will.`
        : `«${req}» توی کتابخانهٔ موزیک محلی نیست. بگو «تو یوتیوب ${req} رو پخش کن» تا از یوتیوب برات پخشش کنم.`;
    }
    if (!music.tracks.length) { showView('music'); return t('music.emptyPlay'); }
    if (!mAudio.src) { playTrack(music.cur < 0 ? 0 : music.cur); return t('music.playing', { x: music.tracks[Math.max(0, music.cur)].title }); }
    if (mAudio.paused) { mAudio.play().catch(() => {}); return t('music.resumed'); }
    return t('music.playing', { x: music.tracks[music.cur].title });
  }
  /* v0.45 — جدا کردن اسم آهنگ/خواننده از جملهٔ پخش — بدون دیکشنری نمونه */
  function musicReqOf(c) {
    let s = String(c || '');
    s = s.replace(/(توی|تو|در)\s+(یوتیوب|youtube|آپارات|اپارات)/gi, ' ');
    s = s.replace(/(یوتیوب|youtube|آپارات|اپارات)/gi, ' ');
    s = s.replace(/(پخش|پلی|بزن|بذار|بزار|شروع|اجرا|بگیر)\s*(کن|بکن|کنی|میکنی|می\s?کنی)?/gi, ' ');
    s = s.replace(/(^|\s)(آهنگ|ترانه|موزیک|موسیقی|اهنگ|آواز|پلی\s?لیست|song|music|track|playlist)(ی)?(?=\s|$)/gi, ' ');
    s = s.replace(/(^|\s)(رو|را|برام|برای\s*من|واسم|لطفا|ممنون|مرسی|دیگه|خب|خوب|هم|یه|یک)(?=\s|$)/gi, ' ');
    s = s.replace(/\s*(کن|بکن|کنی)\s*$/g, ' ');
    s = s.replace(/[\s\u200C]+/g, ' ').trim();
    return s.length >= 2 ? s.slice(0, 60) : '';
  }
  function voiceMusicPause() {
    if (!settings.extMusic) return musicExtOffReply();
    if (music.tracks.length && !mAudio.paused) { mAudio.pause(); return t('music.paused'); }
    /* v0.47 — B15: صداقت — وقتی هیچ‌چیز داخلی پخش نمی‌شود دیگر دروغِ «موزیک متوقف شد»
       نمی‌گوییم (پلیر خارجی/یوتیوب هم پخش نیست؛ کلید مدیای کور ریسک play دارد) */
    return LANG === 'en' ? 'Nothing is playing right now.' : 'الان موزیکی در حال پخش نیست.';
  }
  function voiceMusicNext() {
    if (!settings.extMusic) return musicExtOffReply();
    if (!music.tracks.length) { showView('music'); return t('music.emptyPlay'); }
    musicNext();
    return t('music.next');
  }
  function voiceMusicPrev() {
    if (!settings.extMusic) return musicExtOffReply();
    if (!music.tracks.length) { showView('music'); return t('music.emptyPlay'); }
    musicPrev();
    return t('music.prev');
  }

  if (btnMusic) btnMusic.addEventListener('click', () => showView(musicPage.hidden ? 'music' : 'home'));
  if (btnMusicBack) btnMusicBack.addEventListener('click', () => showView('home'));
  if (btnMusicFolder) btnMusicFolder.addEventListener('click', () => { try { handleMusicPick(); } catch (_) { /* noop */ } });
  if (mFolder) mFolder.addEventListener('change', handleMusicFolder);
  if (mDirsClear) mDirsClear.addEventListener('click', () => { try { clearMusicDirs(); } catch (_) { /* noop */ } });
  if (mDirsClear && !(Array.isArray(settings.musicDirs) && settings.musicDirs.length)) mDirsClear.hidden = true;
  if (mPlayBtn) mPlayBtn.addEventListener('click', () => (music.tracks.length ? musicToggle() : (mFolder && mFolder.click())));
  if (mNextBtn) mNextBtn.addEventListener('click', () => musicNext());
  if (mPrevBtn) mPrevBtn.addEventListener('click', () => musicPrev());
  /* v0.21 — توقف کامل: مکث + برگشتن به ابتدای آهنگ (خواست کاربر: «استوپ») */
  if (mStopBtn) mStopBtn.addEventListener('click', () => {
    if (!music.tracks.length || !mAudio.src) return;
    try { mAudio.pause(); mAudio.currentTime = 0; } catch (_) { /* noop */ }
    paintRange(mSeek);
    toast(t('music.stopped'), '#i-stop');
  });
  /* v0.21 — جلو/عقب ۱۰ ثانیه‌ای (خواست کاربر: «جلو عقب کردن») */
  const seek10 = (sec) => {
    if (!mAudio.src || !isFinite(mAudio.duration)) return;
    try { mAudio.currentTime = Math.max(0, Math.min(mAudio.duration - 0.3, mAudio.currentTime + sec)); } catch (_) { /* noop */ }
    paintRange(mSeek);
  };
  if (mBack10Btn) mBack10Btn.addEventListener('click', () => seek10(-10));
  if (mFwd10Btn) mFwd10Btn.addEventListener('click', () => seek10(10));
  /* v0.21 — کم/زیاد کردن صدا با گام ۱۰٪ (خواست کاربر) */
  const nudgeVol = (delta) => {
    const v = Math.max(0, Math.min(100, Math.round(mAudio.volume * 100) + delta));
    mAudio.volume = v / 100;
    settings.musicVol = mAudio.volume;
    store.set('musicVol', settings.musicVol);
    if (mVol) { mVol.value = String(v); paintRange(mVol); }
  };
  if (mVolDownBtn) mVolDownBtn.addEventListener('click', () => nudgeVol(-10));
  if (mVolUpBtn) mVolUpBtn.addEventListener('click', () => nudgeVol(10));
  if (mShuffleBtn) mShuffleBtn.addEventListener('click', () => {
    music.shuffle = !music.shuffle;
    settings.musicShuffle = music.shuffle;
    store.set('musicShuffle', music.shuffle);
    if (mShuffleBtn) mShuffleBtn.classList.toggle('active', music.shuffle);
  });
  if (mRepeatBtn) mRepeatBtn.addEventListener('click', () => {
    music.repeat = music.repeat === 'off' ? 'all' : music.repeat === 'all' ? 'one' : 'off';
    settings.musicRepeat = music.repeat;
    store.set('musicRepeat', music.repeat);
    if (mRepeatBtn) {
      mRepeatBtn.classList.toggle('active', music.repeat !== 'off');
      mRepeatBtn.classList.toggle('one', music.repeat === 'one');
    }
  });
  if (mSeek) mSeek.addEventListener('input', () => {
    paintRange(mSeek);
    if (mAudio.duration) mAudio.currentTime = (Number(mSeek.value) / 1000) * mAudio.duration;
  });
  if (mVol) mVol.addEventListener('input', () => {
    mAudio.volume = Number(mVol.value) / 100;
    settings.musicVol = mAudio.volume;
    store.set('musicVol', settings.musicVol);
    paintRange(mVol);
  });
  if (mSearch) mSearch.addEventListener('input', () => renderMusicList());
  if (mwPlayBtn) mwPlayBtn.addEventListener('click', () => musicToggle());

  /* --- ویجت موزیک قابل کشیدن (v0.13) — با درگ افقی از صفحه حذف می‌شود ---
     درگ به چپ یا راست بیش از ~۹۰px → انیمیشن خروج و بسته شدن؛
     با آهنگ بعدی دوباره ظاهر می‌شود. دکمه پخش درگ را شروع نمی‌کند. */
  (() => {
    if (!musicWidget) return;
    const hint = document.createElement('span');
    hint.className = 'mw-draghint';
    hint.textContent = '⇢';
    musicWidget.appendChild(hint);
    let sx = 0, dx = 0, dragging = false, pid = null;
    musicWidget.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return; /* دکمه پخش/بستن دست‌نخورده */
      dragging = true;
      sx = e.clientX;
      dx = 0;
      pid = e.pointerId;
      try { musicWidget.setPointerCapture(pid); } catch (_) { /* noop */ }
      musicWidget.classList.add('dragging');
    });
    musicWidget.addEventListener('pointermove', (e) => {
      if (!dragging || e.pointerId !== pid) return;
      dx = e.clientX - sx;
      musicWidget.style.transform = `translateX(${dx}px) rotate(${dx * 0.02}deg)`;
      musicWidget.style.opacity = String(Math.max(0.35, 1 - Math.abs(dx) / 240));
    });
    const endDrag = (e) => {
      if (!dragging || (e && e.pointerId !== pid)) return;
      dragging = false;
      musicWidget.classList.remove('dragging');
      const far = Math.abs(dx) > 90;
      const dir = dx < 0 ? -1 : 1;
      if (far) {
        musicWidget.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        musicWidget.style.transform = `translateX(${dir * 280}px) rotate(${dir * 9}deg)`;
        musicWidget.style.opacity = '0';
        setTimeout(() => {
          musicWidget.hidden = true;
          musicWidget.style.cssText = '';
          music.widgetDismissedFor = music.cur;
        }, 300);
        toast(t('music.widgetOff'), '#i-music');
        /* v0.15 — پرت کردن ویجت = پاز پخش */
        try { if (!mAudio.paused) { mAudio.pause(); toast(t('music.pausedFling'), '#i-pause'); } } catch (_) { /* noop */ }
      } else {
        musicWidget.style.transition = 'transform 0.25s cubic-bezier(0.22, 1.2, 0.36, 1), opacity 0.25s ease';
        musicWidget.style.transform = '';
        musicWidget.style.opacity = '';
        setTimeout(() => { musicWidget.style.transition = ''; }, 260);
      }
      dx = 0;
    };
    musicWidget.addEventListener('pointerup', endDrag);
    musicWidget.addEventListener('pointercancel', endDrag);
  })();

  /* بازیابی وضعیت شافل/تکرار/ولوم از تنظیمات */
  if (mShuffleBtn) mShuffleBtn.classList.toggle('active', !!settings.musicShuffle);
  music.shuffle = !!settings.musicShuffle;
  music.repeat = settings.musicRepeat || 'off';
  if (mRepeatBtn) {
    mRepeatBtn.classList.toggle('active', music.repeat !== 'off');
    mRepeatBtn.classList.toggle('one', music.repeat === 'one');
  }
  if (mVol) mVol.value = String(Math.round((settings.musicVol ?? 0.8) * 100));
  paintRange(mVol);
  paintRange(mSeek);

  /* ---------- پاپ‌آپ درباره ---------- */
  btnAbout.addEventListener('click', (e) => {
    e.stopPropagation();
    about.hidden = !about.hidden;
  });
  document.addEventListener('click', (e) => {
    if (!about.hidden && !about.contains(e.target) && !btnAbout.contains(e.target)) about.hidden = true;
  });

  /* ---------- آمار سیستم (واقعی در Electron / شبیه‌سازی در مرورگر) ---------- */
  let simCpu = 12, simRam = 46;
  async function tickStats() {
    if (bridge && bridge.system) {
      try {
        const s = await bridge.system.stats();
        lastCpu = s.cpu; lastRam = s.ram;
      } catch (_) { /* noop */ }
    } else {
      simCpu = Math.max(3, Math.min(92, simCpu + (Math.random() * 10 - 5)));
      simRam = Math.max(28, Math.min(88, simRam + (Math.random() * 4 - 2)));
      lastCpu = Math.round(simCpu);
      lastRam = Math.round(simRam);
    }
    sbCpu.textContent = `CPU ${faNum(lastCpu)}٪`;
    sbRam.textContent = `RAM ${faNum(lastRam)}٪`;
  }
  tickStats();
  setInterval(tickStats, 4000); /* ۴ ثانیه — IPC و خواندن os.cpus() سبک‌تر */

  /* توقف انیمیشن‌های تزئینی وقتی پنجره فوکوس/نمای ندارد — مصرف CPU پایین */
  const setWinBlur = (on) => body.classList.toggle('app-blur', !!on);
  window.addEventListener('blur', () => setWinBlur(true));
  window.addEventListener('focus', () => setWinBlur(false));
  document.addEventListener('visibilitychange', () => setWinBlur(document.hidden));

  /* ---------- شروع ---------- */
  LANG = settings.lang === 'en' ? 'en' : 'fa';
  setState('idle');
  applyI18n();
  statusText.innerHTML = IDLE_HINT;
  refreshEngineUI();
  refreshLocalStatus(); /* v0.27 — وضعیت بستهٔ آفلاین */
  /* پیشرفت دانلود بستهٔ آفلاین از پروسهٔ اصلی */
  if (bridge && bridge.stt && bridge.stt.onLocalProgress) {
    bridge.stt.onLocalProgress((s) => {
      setOffProgress((s && s.pct) || 0, s && s.stage);
      /* v0.29.1 — بستهٔ آفلاین آماده شد و بیدارباش همیشگی روشن است → حلقه برود */
      if (s && s.stage === 'done' && settings.wakeAlways && !wakeLoop) {
        actLog('wake-always: pack done event → starting loop');
        wakeLoopStart();
      }
    });
  }
  renderCustomChips();
  renderTypingCmds();
  renderDnsProfiles();
  renderDnsBuiltins();
  renderMusicList();
  updatePlayerUI();
  updateHandsFreeUI();
  updateDictToggleUI();
  startSuggestionLoop();
  /* میکروفون از همین لحظه فعال می‌ماند تا اکولایزر به صدای واقعی واکنش نشان دهد */
  setTimeout(() => { attachMic(); }, 1200);
  /* v0.29 — اگر «بیدارباش همیشگی» روشن باشد، حلقهٔ آفلاین همین‌جا شروع می‌شود */
  setTimeout(() => { wakeBootRetry(); }, 2600);
  /* v0.41 — پیش‌گرم هوش مصنوعی (درخواست کاربر: «سریعتر به AI وصلش کنیم»):
     چند ثانیه بعد از باز شدن برنامه یک پینگ کوچک به Gemini می‌رود؛ همان یک
     درخواست، کشف مدل‌ها + مدلِ کاری + TLS/DNS را از راه می‌اندازد — یعنی
     «اولین فرمان واقعی کاربر» دیگر چند ثانیه کاوشِ سرد را تجربه نمی‌کند.
     هر بار اجرای برنامه فقط یک‌بار؛ هزینهٔ کوئیک‌نظام flash-lite قابل چشم‌پوشی. */
  let aiWarmedUp = false;
  function warmupAI() {
    if (aiWarmedUp) return;
    aiWarmedUp = true;
    try {
      const prov = settings.aiProvider || 'auto';
      if (!settings.geminiKey || (prov !== 'auto' && prov !== 'gemini')) return;
      if (!bridge || !bridge.ai || !bridge.ai.gemini) return;
      setTimeout(() => {
        /* v0.47 — B10: کاربر وسط فرمان است → warmup لغو (قبلاً همزمان دو زنجیرهٔ کامل
           ۴۲۹-spam می‌کردند)؛ اگر مدت warmup قبلی فاجعه‌بار بود (>۳۰s) هم بی‌خیال */
        if (cmdBusy || state === 'processing' || state === 'listening') return;
        const t0 = Date.now();
        actLog('ai warmup: pinging Gemini …');
        const wp = bridge.ai.gemini({
          key: settings.geminiKey,
          model: settings.geminiModel || '',
          base: settings.gemBase || '',
          search: false,
          messages: [{ role: 'user', content: 'فقط یک کلمه «آماده» بنویس.' }],
        }).then((r) => {
          actLog('ai warmup ' + (r && r.ok ? 'ok ' : 'fail ') + (Date.now() - t0) + 'ms' + (r && r.model ? ' model=' + r.model : ''));
        }).catch(() => { /* خاموش — کاربر هنوز فرمانی نداده */ });
        /* v0.47 — B10: سقف کلی ۱۲ ثانیه (لاگ کاربر: warmup ok 35416ms/37521ms —
           یعنی اولین فرمان واقعی هم بدون سقف همان‌قدر می‌توانست معطل شود) */
        Promise.race([wp, new Promise((res) => setTimeout(() => res('warmup-deadline-12s'), 12000))]).then((x) => {
          if (x === 'warmup-deadline-12s') actLog('ai warmup exceeded 12s deadline — abandoned (chain still capped per-request)');
        });
      }, 3000);
    } catch (_) { /* noop */ }
  }
  warmupAI();
  /* فرم شیشه‌ای DNS جدید — درخواست از پروسه اصلی (اگر از بیرون آمده باشد) */
  if (bridge && bridge.dns && bridge.dns.onQuickRequest) {
    bridge.dns.onQuickRequest(() => openDnsQuickOverlay());
  }
  /* v0.47 — B13: میانبرهای سراسری اگر اشغال باشند، کاربر همان لحظه می‌فهمد
     (قبلاً فقط در activity.log می‌رفت و push-to-talk بی‌سروصدا می‌مرد) */
  if (bridge && bridge.onShortcutFailed) {
    bridge.onShortcutFailed((p) => {
      const combos = ((p && p.combos) || []).join(' و ');
      try { toast(t('toast.shortcutFail') + (combos ? ' (' + combos + ')' : ''), '#i-info'); } catch (_) { /* noop */ }
      try { actLog('shortcut failed notice shown: ' + combos); } catch (_) { /* noop */ }
    });
  }
  /* یادآوری سر وقت: توست + بوق + گفتن بلند (تیک پس‌زمینه در پروسه اصلی است)
     v0.47 — B01: پیام بر اساس kind (تایمر/یادآوری) + ack فوری + لاگ شلیک */
  if (bridge && bridge.reminders && bridge.reminders.onDue) {
    bridge.reminders.onDue((r) => {
      const isTimer = r && r.kind === 'timer';
      const msg = isTimer
        ? (t('timer.done') + (r && r.text ? ` (${r.text})` : ''))
        : t('rem.due', { x: (r && r.text) || '' });
      actLog('reminder due (kind=' + (isTimer ? 'timer' : 'reminder') + '): ' + ((r && r.text) || '').slice(0, 60));
      beep();
      toast(msg, '#i-timer');
      setState('success');
      statusText.textContent = t('timer.done');
      body.classList.add('has-card');
      rcHeard.textContent = t('timer.doneTag');
      rcTag.textContent = t('timer.doneTag');
      typeText(rcReply, msg);
      speak(msg);
      /* v0.47 — B01: رندرر رسیدن را تأیید می‌کند تا main از تیک بعدی تکرار نکند */
      if (r && r.id && bridge.reminders.ack) bridge.reminders.ack(r.id).then(() => { try { renderRemList(); } catch (_) { /* noop */ } }).catch(() => { /* noop */ });
      else try { renderRemList(); } catch (_) { /* noop */ }
      setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 5000);
    });
  }
  /* v0.47 — B01: تایمرهای پایدارِ مانده از جلسهٔ قبل دوباره مسلح شوند */
  rearmPersistedTimers();
  /* v0.47 — حافظهٔ یادگیری از فایل بیاید + میراث aiCmdMap منتقل شود */
  loadLearnStore().then(() => { try { renderLearnList(); } catch (_) { /* noop */ } }).catch(() => { /* noop */ });
  taughtLoad().catch(() => { /* noop */ }); /* v0.65 — آموخته‌های صریح کاربر از اول در حافظه */
  /* v0.38.1 — فهرست یادآوری‌ها در شروع هم پر شود */
  try { renderRemList(); } catch (_) { /* noop */ }
  /* گرم کردن کش برنامه‌های سیستم در پس‌زمینه — اولین «باز کن» سریع باشد */
  setTimeout(() => { ensureAppsList().catch(() => { /* noop */ }); }, 3500);
  setTimeout(() => {
    toast(canRun ? t('toast.welcome') : t('toast.preview'), '#i-wave');
  }, 900);
  /* v0.16.1 — بالا آمدن کامل تأیید شد؛ اگر خطاهای اولیه زیاد بود، حالت امن خودکار */
  try {
    window.__avaErr.booted = true;
    if (window.__avaErr.autoSafe()) {
      settings.safeMode = true;
      applyPerf();
      setTimeout(() => toast(t('toast.safeAuto'), '#i-pulse'), 2200);
    } else if (settings.safeMode) {
      setTimeout(() => toast(t('toast.safeOn'), '#i-pulse'), 2200);
    }
  } catch (_) { /* noop */ }
})();
