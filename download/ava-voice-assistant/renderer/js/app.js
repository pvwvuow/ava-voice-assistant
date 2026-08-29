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
    'set.nav.voice': ['صدا و پاسخ', 'Voice & replies'], 'set.nav.ai': ['هوش مصنوعی', 'AI'],
    'set.nav.app': ['برنامه', 'App'], 'set.nav.update': ['به‌روزرسانی', 'Updates'],
    'set.nav.ext': ['افزونه‌ها', 'Extensions'],
    'set.nav.perf': ['بهینه‌سازی', 'Optimization'],
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
    'ext.musicDesc': ['پلی‌لیست از پوشهٔ خودت با کاور، ویژوالایزر زنده، ویجت صفحه اصلی و کنترل صوتی', 'Playlist from your own folder with covers, live visualizer, home widget and voice control'],
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
    'disc.dmOnly': ['پیام‌رسان دیسکورد باز شد ولی دکمهٔ تماس پیدا نشد — مختصات دکمه را در تنظیمات دیسکورد آزمایش/تنظیم کن', 'Discord DM opened but the call button was not found — calibrate it in Discord settings'],
    'disc.muteBtn': ['میوت', 'Mute'], 'disc.deafenBtn': ['بی‌صدا کردن کل', 'Deafen'],
    'disc.answerBtn': ['جواب تماس', 'Answer'], 'disc.declineBtn': ['رد تماس', 'Decline'],
    'disc.hangupBtn': ['قطع تماس', 'Hang up'], 'disc.focusBtn': ['فوکوس دیسکورد', 'Focus Discord'],
    'disc.callBtn': ['زنگ بزن', 'Call'],
    /* ---------- v0.17 — تنظیمات دیسکورد ---------- */
    'set.nav.discord': ['دیسکورد', 'Discord'],
    'set.dc.open': ['تنظیمات', 'Settings'],
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
    'set.dc.bg': ['اجرای بک‌گراند (وسط بازی)', 'Background mode (mid-game)'],
    'set.dc.bgHint': ['کلیدها بدون فعال‌شدن پنجرهٔ دیسکورد فرستاده می‌شوند تا وسط بازی چیزی به‌هم نریزد — اگر اثری نکردی خاموشش کن تا با فوکوس مستقیم اجرا شود', 'Keys are sent to Discord without activating its window so your game stays intact — turn it off if nothing happens'],
    'set.dc.bgOn': ['حالت بک‌گراند روشن شد — دیسکورد وسط بازی پاپ‌آپ نمی‌شود', 'Background mode on — Discord will not pop up mid-game'],
    'set.dc.bgOff': ['حالت بک‌گراند خاموش شد — اجرا با فوکوس مستقیم', 'Background mode off — commands run with direct focus'],
    'set.dc.cal': ['مکان دکمهٔ تماس (فالبک)', 'Call button position (fallback)'],
    'set.dc.calHint': ['وقتی دکمهٔ تماس پیدا نشود، از گوشهٔ بالا-راست این فاصله‌ها کلیک می‌شود — با «آزمایش» نشانگر موس سر جایش می‌نشیند', 'When the call button cannot be found, AVA clicks this far from the top-right corner — "Probe" moves the mouse there for checking'],
    'set.dc.probe': ['آزمایش', 'Probe'],
    'set.dc.probing': ['نشانگر موس به مکان دکمهٔ تماس می‌رود…', 'Moving the mouse to the call button position…'],
    'set.dc.probed': ['نشانگر روی مکان دکمهٔ تماس قرار گرفت — درست است؟ عدد X/Y را اگر لازم است عوض کن', 'Mouse is now on the call button spot — adjust X/Y if it is off'],
    'set.dc.note': ['فرمان‌ها: «به علی زنگ بزن»، «تماس رو قطع کن»، «دیسکورد رو میوت کن»، «صدای دیسکورد رو قطع کن»، «جواب تماس»، «رد تماس». برای قطع/جواب/رد یک‌بار در Discord › Settings › Keybinds اکشن Disconnect را روی Ctrl+Shift+H، Answer را روی Ctrl+Shift+A و Decline را روی Ctrl+Shift+E بگذار؛ میوت (Ctrl+Shift+M) و کرافت (Ctrl+Shift+D) پیش‌فرض کار می‌کنند.', 'Commands: "call Ali", "hang up", "mute Discord", "deafen Discord", "answer", "decline". For hangup/answer/decline bind once in Discord › Settings › Keybinds: Disconnect = Ctrl+Shift+H, Answer = Ctrl+Shift+A, Decline = Ctrl+Shift+E; Mute (Ctrl+Shift+M) and Deafen (Ctrl+Shift+D) work by default.'],
    'disc.namePh': ['اسم دوستت در دیسکورد…', "Your friend's Discord name…"],
    'disc.hint': ['یک‌بار در دیسکورد این کلیدها را بساز: Settings › Keybinds → Disconnect از Voice Channel = Ctrl+Shift+H، Answer Call = Ctrl+Shift+A، Decline Call = Ctrl+Shift+E — بعد با صدا بگو «تماس رو قطع کن». میوت (Ctrl+Shift+M) و بی‌صدای کل (Ctrl+Shift+D) با پیش‌فرض دیسکورد کار می‌کنند.', 'Once in Discord make these keybinds: Settings › Keybinds → Disconnect from Voice Channel = Ctrl+Shift+H, Answer Call = Ctrl+Shift+A, Decline Call = Ctrl+Shift+E — then just say "hang up". Mute (Ctrl+Shift+M) and Deafen (Ctrl+Shift+D) work with Discord defaults.'],
    'dnsp.title': ['DNS Changer', 'DNS Changer'],
    'set.mic.input': ['ورودی میکروفون', 'Microphone input'],
    'set.mic.checking': ['دسترسی میکروفون بررسی می‌شود…', 'Checking microphone access…'],
    'set.mic.default': ['پیش‌فرض ویندوز', 'Windows default'],
    'set.mic.test': ['تست زنده میکروفون', 'Live microphone test'],
    'set.mic.testHint': ['حرف بزن — میله‌ها باید با صدای تو بالا و پایین شوند', 'Speak — the bars should move with your voice'],
    'set.mic.note': ['برای دقت بیشتر در تشخیص گفتار، میکروفون نزدیک‌تر باشد و با آهنگ یکنواخت حرف بزن.', 'For better recognition accuracy, stay close to the microphone and speak at an even pace.'],
    'set.stt.engine': ['موتور تشخیص گفتار', 'Speech recognition engine'],
    'set.stt.engineHint': ['«خودکار»: اول موتور وب گوگل (دقیق‌ترین)؛ اگر در دسترس نبود گوگل رایگان و بعد GLM ابری', '"Auto": Google web engine first (most accurate); then free Google, then cloud GLM'],
    'set.stt.auto': ['خودکار (پیشنهادی)', 'Auto (recommended)'], 'set.stt.web': ['فقط موتور وب گوگل', 'Google web engine only'],
    'set.stt.google': ['فقط گوگل رایگان HTTP (نیاز به فیلترشکن)', 'Free Google HTTP only (needs VPN in some regions)'],
    'set.stt.glm': ['فقط GLM-ASR ابری (نیاز به کلید)', 'Cloud GLM-ASR only (needs key)'],
    'set.stt.lang': ['زبان گفتار', 'Speech language'],
    'set.stt.langHint': ['زبانی که با آن فرمان می‌گویی — تشخیص با همین زبان انجام می‌شود', 'The language you speak commands in — recognition uses it'],
    'set.stt.handsFree': ['حالت بی‌دست (گوش دائمی)', 'Hands-free (always listening)'],
    'set.stt.handsFreeHint': ['آوا همیشه گوش می‌دهد؛ فقط وقتی کلمه «آوا» را بگویی فرمان را اجرا می‌کند — میانبر: Ctrl+Alt+A', 'AVA always listens; say the wake word first to run a command — shortcut: Ctrl+Alt+A'],
    'set.stt.wake': ['کلمه بیدارباش «آوا»', 'Wake word "Ava"'],
    'set.stt.wakeHint': ['در حالت بی‌دست، فقط فرمان‌هایی که با «آوا» شروع شوند اجرا شوند (غیرفعال = هر حرفی که می‌گویی اجرا می‌شود)', 'In hands-free mode only commands starting with "Ava" run (off = everything you say runs)'],
    'set.stt.gkey': ['کلید اختصاصی گوگل (اختیاری)', 'Custom Google key (optional)'],
    'set.stt.gkeyHint': ['خالی = کلید رایگان داخلی — فقط اگر با 403 روبه‌رو شدی', 'Empty = built-in free key — only if you hit 403 errors'],
    'set.stt.gkeyPh': ['خالی = رایگان و بدون کلید', 'Empty = free, no key'],
    'set.stt.demo': ['حالت نمایشی (دمو)', 'Demo mode'],
    'set.stt.demoHint': ['اگر موتوری در دسترس نبود، فرمان نمونه اجرا شود — پیش‌فرض: خاموش', 'If no engine is available, run a sample command — default: off'],
    'set.stt.note': ['بلندی صدای میکروفون خودکار نرمال می‌شود، آستانه تشخیص صدا برای هر میکروفون تطبیقی تنظیم می‌شود و اگر موتوری جواب نداد، همان صدا به موتور بعدی فرستاده می‌شود.', 'Microphone loudness is auto-normalized, the voice threshold adapts to your mic, and if one engine fails the same audio is retried on the next engine.'],
    'set.dict.start': ['شروع و پایان', 'Start and stop'],
    'set.dict.startHint': ['بگو «آوا تایپ» تا تایپ شروع شود؛ «آوا تموم» یا «قطع تایپ» تا تمام شود — یا از دکمه پایین', 'Say "Ava type" to start; "Ava done" or "stop typing" to finish — or use the button'],
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
    'toast.copied': ['گزارش کپی شد — برایم بفرست ✓', 'Report copied — send it to me ✓'],
    'toast.copyFail': ['کپی نشد — از پنل خطا استفاده کن', 'Copy failed — use the crash panel'],
    'set.app.top': ['همیشه روی همه پنجره‌ها', 'Always on top'], 'set.app.topHint': ['پنجره آوا روی برنامه‌های دیگر باقی بماند', 'Keep the AVA window above other apps'],
    'set.app.login': ['اجرای خودکار با ویندوز', 'Start with Windows'], 'set.app.loginHint': ['آوا هنگام روشن شدن سیستم بالا بیاید', 'Launch AVA when the system boots'],
    'set.app.links': ['پیوندها', 'Links'], 'set.app.linksHint': ['ریپو و دانلود آخرین نسخه در مرورگر باز می‌شود', 'Opens the repo and the latest download in your browser'],
    'set.app.repo': ['ریپوی گیت‌هاب', 'GitHub repo'], 'set.app.dl': ['دانلود آخرین نسخه', 'Download latest'],
    'set.upd.auto': ['بررسی خودکار هنگام شروع', 'Auto check on startup'],
    'set.upd.autoHint': ['۱۲ ثانیه بعد از باز شدن برنامه، نسخه جدید چک شود', 'Check for a new version 12 seconds after launch'],
    'set.upd.check': ['بررسی نسخه جدید', 'Check for updates'], 'set.upd.install': ['نصب و راه‌اندازی مجدد', 'Install and restart'],
    'set.upd.manualDl': ['دانلود مستقیم نصّاب', 'Download installer directly'],
    'set.upd.note': ['آپدیت کامل داخل خود برنامه: بررسی و دانلود خودکار انجام می‌شود و نصب هم با یک کلیک — فقط بخش‌های تغییرکرده دانلود می‌شود (آپدیت دلتا)، نه کل برنامه.', 'Full in-app updates: auto check and download, one-click install — only changed parts are downloaded (delta update).'],
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
    'about.desc': ['نسخه ۰.۱۷ — تشخیص گفتار کلاس AI (الگوی سایت‌های حرفه‌ای تایپ صوتی): موتور Gemini Audio با همان کلید جمنای خودت + Whisper سازگار با OpenAI (پیش‌فرض Groq، سریع‌ترین) — کنترل دیسکورد کامل شد: تماس واقعی با مخاطبین اسم‌دار («به علی زنگ بزن» با آی‌دی ذخیره‌شده)، حالت بک‌گراند مخصوص وسط بازی و صفحهٔ تنظیمات اختصاصی — اولویت اول پاسخ‌ها با جمنای + نشان موتور پاسخ‌دهنده — دکمهٔ میکروفون فلت در حالت بهینه‌سازی — پلیر مینیمال‌تر و تم تیرهٔ سبک برای سیستم ضعیف.', 'v0.17 — AI-class speech recognition (like pro voice-typing sites): Gemini Audio with your own key + OpenAI-compatible Whisper (Groq default, blazing fast) — Discord control completed: real calling with named contacts, background mode for mid-game use, full settings page — Gemini-first AI replies with an engine badge — flat mic button in performance mode — more minimal player and a flat dark theme for weak PCs.'],
    'about.listen': ['گوش دادن', 'Listen'], 'about.cmd': ['کادر فرمان', 'Command box'], 'about.esc': ['بستن / لغو', 'Close / Cancel'],

    /* --- دینامیک --- */
    'status.idle': ['برای شروع، اورب را لمس کن یا کلید <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Space</kbd>', 'Tap the orb or press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Space</kbd> to start'],
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
    'stt.tryGemini': ['تبدیل صدا با جمنای…', 'Transcribing with Gemini…'],
    'stt.tryWhisper': ['تبدیل صدا با Whisper…', 'Transcribing with Whisper…'],
    'set.stt.gemini': ['فقط Gemini Audio — دقیق‌ترین (کلید جمنای)', 'Gemini Audio only — most accurate (Gemini key)'],
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
    'default.reply': ['این فرمان را هنوز یاد نگرفتم. اتصال هوش مصنوعی را برقرار کن (تب «صفحه چت GLM» › ورود به حسابت) تا هر سوال و فرمانی را همان‌جا تحلیل کنم و یاد بگیرم!', 'I have not learned this command yet. Connect the AI (GLM chat tab › sign in) and I will analyze anything you ask there!'],
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
    'ai.fail': ['پاسخی نرسید', 'No answer arrived'], 'ai.noConn': ['اتصال AI برقرار نیست', 'AI connection is down'],
    'ai.err': ['اتصال به هوش مصنوعی برقرار نشد.', 'Could not reach the AI.'],
    'weather.reply': ['آب‌وهوای {city}: {desc}، دما حدود {temp} درجه (احساس واقعی {feels})، رطوبت {hum}٪ و باد {wind} کیلومتر بر ساعت.', 'Weather in {city}: {desc}, around {temp} degrees (feels like {feels}), humidity {hum}% and wind {wind} km/h.'],
    'weather.fail': ['آب‌وهوا الان در دسترس نیست — چند لحظه بعد دوباره بگو.', 'Weather is unavailable right now — try again in a moment.'],
    'weather.onlyApp': ['پیش‌بینی آب‌وهوا فقط داخل نرم‌افزار ویندوزی کار می‌کند.', 'Weather forecast only works inside the Windows app.'],
    'calc.reply': ['{x} می‌شود {y}؛ حساب کردم!', '{x} equals {y} — calculated!'],
    'calc.fail': ['این محاسبه را متوجه نشدم — مثلاً بگو «پنج ضربدر هفت چند میشه» یا «۱۲ به علاوه ۳۰».', 'I did not understand that calculation — try "12 plus 30" or "five times seven".'],
    'timer.on': ['تایمر {x} {y}‌ای فعال شد؛ به‌محض رسیدن وقت خبرت می‌کنم.', 'A {x} {y} timer is set; I will ping you when time is up.'],
    'timer.min': ['دقیقه', 'minute(s)'], 'timer.sec': ['ثانیه', 'second(s)'],
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
    'upd.available': ['نسخه جدید v{x} پیدا شد — در حال دانلود…', 'New version v{x} found — downloading…'],
    'upd.downloading': ['در حال دانلود: {x}٪', 'Downloading: {x}%'],
    'upd.ready': ['نسخه v{x} آماده نصب است', 'Version v{x} is ready to install'],
    'upd.none': ['آخرین نسخه را داری ✓', 'You are on the latest version ✓'],
    'upd.dev': ['در حالت توسعه (npm start) به‌روزرسان غیرفعال است؛ خروجی نصب‌شده کار می‌کند', 'Updater is disabled in dev mode (npm start); the installed build works'],
    'upd.error': ['خطا در بروزرسانی: {x}', 'Update error: {x}'], 'upd.default': ['اتصال خودکار به GitHub Releases', 'Auto-connects to GitHub Releases'],
    'upd.availableManual': ['نسخه جدید v{x} پیدا شد — دانلود مستقیم ممکن است', 'New version v{x} found — direct download available'],
    'upd.directDlToast': ['در حال دانلود مستقیم نصّاب از GitHub…', 'Downloading the installer directly from GitHub…'],
    'upd.manualFailToast': ['دانلود مستقیم ناموفق بود', 'Direct download failed'],
    'upd.current': ['نسخه فعلی: v{x}', 'Current version: v{x}'],
    'wake.need': ['بگو «آوا …» تا فرمانت را اجرا کنم', 'Say "Ava …" and I will run your command'],
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
    'music.paused': ['موزیک متوقف شد', 'Music paused'],
    'music.resumed': ['موزیک ادامه پیدا کرد', 'Music resumed'],
    'music.next': ['آهنگ بعدی', 'Next track'], 'music.prev': ['آهنگ قبلی', 'Previous track'],
    'music.emptyPlay': ['پلی‌لیست خالی است — اول از صفحه موزیک یک پوشه انتخاب کن', 'Playlist is empty — pick a folder in the music page first'],
    'music.pageOpen': ['صفحه موزیک باز شد', 'Music page opened'],
    'music.mute': ['قطع/وصل صدا', 'Mute / unmute'],
    'music.muted': ['صدای پلیر قطع شد', 'Player muted'],
    'music.unmuted': ['صدای پلیر وصل شد', 'Player unmuted'],
    'music.widgetOff': ['ویجت موزیک بسته شد — با آهنگ بعدی برمی‌گردد', 'Music widget dismissed — returns with the next track'],

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

    /* --- v0.13: افزونه‌ها + پینگ DNS --- */
    'set.ext.ping': ['پینگ DNSها', 'Ping DNS servers'],
    'set.ext.pingHint': ['سرعت پاسخ همه DNSهای ذخیره‌شده‌ات را می‌سنجد تا بهترین را انتخاب کنی — با صدا هم: «پینگ دی ان اس هامو»', 'Measures the response time of every saved DNS so you can pick the best — also by voice: "ping my DNS"'],
    'set.ext.pingBtn': ['پینگ بگیر', 'Ping now'],
    'set.ext.note': ['این بخش مخصوص امکانات خاص است؛ اگر لازمشان نداری می‌توانی نادیده‌شان بگیری. مدیریت کامل DNS و ابزارهای خاص این‌جا جمع شده‌اند.', 'This section holds special tools you can safely ignore if you do not need them — full DNS management and extras live here.'],
    'dnsp.title': ['پینگ DNSها', 'Ping DNS servers'],
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
    'set.ai.geminiModelHint': ['هر مدلی تایپ کن — اگر مدل منسوخ شده باشد، آوا خودکار با جدیدترین فلاش جواب می‌دهد', 'Type any model — if it has retired, AVA automatically falls back to the newest flash'],
    'set.ai.geminiModelPh': ['gemini-flash-latest', 'gemini-flash-latest'],
    'set.ai.openaiModel': ['مدل OpenAI', 'OpenAI model'],
    'set.ai.openaiModelHint': ['می‌توانی هر مدلی بنویسی؛ پیشنهادها از منوی پایین ورودی هم می‌آید', 'Type any model name; suggestions appear below the input'],
    'set.ai.openaiModelPh': ['gpt-4o-mini', 'gpt-4o-mini'],
    'mic.busy': ['یک لحظه! دارم فرمان قبلی‌ات را انجام می‌دهم…', 'One moment! I am still working on your previous command…'],
    'voice.engine': ['موتور صدا', 'Voice engine'],
    'voice.engineHint': ['«گوگل»: صدای زن طبیعی و حرفه‌ای (آنلاین — همان صدای گوگل‌ترنسلیت)؛ «ویندوز»: صدای نصب‌شده ویندوز (آفلاین)', '"Google": natural professional female voice (online — the Google Translate voice); "Windows": the installed Windows voice (offline)'],
    'voice.gEng': ['گوگل — صدای زن (پیشنهادی)', 'Google — female voice (recommended)'],
    'voice.wEng': ['ویندوز — آفلاین', 'Windows — offline'],
    'voice.googleFail': ['صدای گوگل در دسترس نبود — با صدای ویندوز گفتم', 'Google voice unavailable — used the Windows voice'],
    'set.voice.engine': ['موتور صدا', 'Voice engine'],
    'set.voice.engineHint': ['«گوگل»: صدای زن طبیعی و حرفه‌ای (آنلاین — همان صدای گوگل‌ترنسلیت)؛ «ویندوز»: صدای نصب‌شده ویندوز (آفلاین)', '"Google": natural professional female voice (online); "Windows": the installed Windows voice (offline)'],
    'set.voice.gEng': ['گوگل — صدای زن (پیشنهادی)', 'Google — female voice (recommended)'],
    'set.voice.wEng': ['ویندوز — آفلاین', 'Windows — offline'],
    'set.ai.provider': ['موتور هوش مصنوعی', 'AI engine'],
    'set.ai.providerHint': ['«خودکار»: اول کلید Gemini (با سرچ زنده گوگل)، بعد حساب GLM، کلید GLM و در آخر OpenAI — یا یکی را ثابت انتخاب کن', '"Auto": Gemini key first (with live Google Search), then GLM account, GLM key, and OpenAI last — or fix one'],
    'set.ai.pAuto': ['خودکار (پیشنهادی)', 'Auto (recommended)'],
    'set.ai.pZai': ['حساب GLM (z.ai)', 'GLM account (z.ai)'],
    'set.ai.pGlm': ['کلید API گله‌م', 'GLM API key'],
    'set.ai.pGemini': ['گوگل جمنای', 'Google Gemini'],
    'set.ai.pOpenai': ['OpenAI', 'OpenAI'],
    'set.ai.geminiKey': ['کلیدهای API گوگل جمنای (اختیاری)', 'Google Gemini API keys (optional)'],
    'set.ai.geminiKeyHint': ['برای سوال‌های «سرچ» جواب لحظه‌ای با جستجوی گوگل می‌گیرد — کلید رایگان از aistudio.google.com. چند کلید؟ با ویرگول جدا کن؛ اگر یکی محدود شد، بعدی خودکار استفاده می‌شود', 'Search-like questions get live Google Search answers — free key from aistudio.google.com. Multiple keys: separate with commas — auto rotation on rate limits'],
    'set.ai.geminiPh': ['AIza… , AIza… (چند کلید با ویرگول)', 'AIza… , AIza… (comma separated)'],
    'set.ai.openaiKey': ['کلیدهای API اوپن‌ای‌آی (اختیاری)', 'OpenAI API keys (optional)'],
    'set.ai.openaiKeyHint': ['از platform.openai.com — با GPT جواب می‌دهد. چند کلید را می‌توانی با ویرگول بدهی (چرخش خودکار)', 'From platform.openai.com — answers with GPT. Multiple keys can be comma separated (auto rotation)'],
    'set.ai.openaiPh': ['sk-… , sk-… (چند کلید با ویرگول)', 'sk-… , sk-… (comma separated)'],
    'upd.badge': ['آپدیت جدید', 'Update'],
    'toast.saved': ['ذخیره شد', 'Saved'],
    'upd.badgeReady': ['نصب آپدیت', 'Install update'],
    'upd.badgeDl': ['دانلود {x}٪', 'Downloading {x}%'],
    'upd.clickInstall': ['نسخه {x} دانلود شد — برای نصب و راه‌اندازی مجدد کلیک کن', 'Version {x} is downloaded — click to install and restart'],
    'upd.downloadingToast': ['نسخه {x} در حال دانلود است…', 'Downloading version {x}…'],
    'dict.trigger': ['حالت تایپ صوتی روشن شد — هر چی بگویی در کادر تایپ نوشته می‌شود', 'Voice typing is on — everything you say goes into the typing box'],
    'dns.setVoice': ['در حال تنظیم DNS «{x}» روی ویندوز…', 'Setting DNS "{x}" on Windows…'],
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
    IDLE_HINT = t('status.idle');
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
  const mViz = $('#mViz');
  const btnMusicBack = $('#btnMusicBack');
  const btnMusicFolder = $('#btnMusicFolder');
  const mFolder = $('#mFolder');
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
    voiceURI: store.get('voiceURI', ''),
    ttsEngine: store.get('ttsEngine', 'google'),
    autoUpdate: store.get('autoUpdate', true),
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
    openaiModel: store.get('openaiModel', 'gpt-4o-mini'),
    /* v0.17 — موتورهای STT کلاس AI */
    whisperBase: store.get('whisperBase', 'https://api.groq.com/openai/v1'),
    whisperKey: store.get('whisperKey', ''),
    whisperModel: store.get('whisperModel', 'whisper-large-v3-turbo'),
    /* v0.17 — افزونهٔ دیسکورد: مخاطبین و اجرای بک‌گراند */
    discordContacts: store.get('discordContacts', []), /* [{id, name, userId, note}] */
    discordBg: store.get('discordBg', true),           /* بدون به‌هم‌ریختن بازی */
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
  (async () => {
    /* بارگذاری تنظیمات ذخیره‌شده در فایل — بعد از تعریف کامل صفحه */
    if (!bridge || !bridge.settings || !bridge.settings.load) return;
    try {
      const f = await bridge.settings.load();
      if (f && typeof f === 'object' && Object.keys(f).length) {
        Object.keys(settings).forEach((k) => { if (f[k] !== undefined) settings[k] = f[k]; });
        if (Array.isArray(f.customCmds) && f.customCmds.length) { customCmds = f.customCmds; store.set('customCmds', customCmds); }
        if (Array.isArray(f.history)) { history = f.history; store.set('history', history); }
        refreshEngineUI();
        renderCustomChips();
        updateHandsFreeUI();
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
    if (gTtsAudio) {
      try { gTtsAudio.pause(); } catch (_) { /* noop */ }
      gTtsAudio.src = '';
      gTtsAudio = null;
    }
  }

  function playNextGoogleChunk() {
    if (!gTtsQueue.length) { gTtsPlaying = false; return; }
    const b64 = gTtsQueue.shift();
    try {
      const au = new Audio('data:audio/mpeg;base64,' + b64);
      gTtsAudio = au;
      gTtsPlaying = true;
      au.onended = playNextGoogleChunk;
      au.onerror = () => { gTtsPlaying = false; };
      au.play().catch(() => { gTtsPlaying = false; });
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

  async function speak(text) {
    if (!settings.tts || !text) return;
    const txt = String(text).replace(/[«»]/g, '').trim();
    if (!txt) return;
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (_) { /* noop */ }
    stopGoogleSpeak();
    if (settings.ttsEngine === 'google') {
      const ok = await speakGoogle(txt);
      if (ok) return;
      /* گوگل جواب نداد (آفلاین/فیلتر) → صدای ویندوز */
      speakWindows(txt);
      return;
    }
    speakWindows(txt);
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

  /* ---------- خوش‌آمد بر اساس ساعت ---------- */
  greetTitle.textContent = greetingText();

  /* ---------- ساعت نوار وضعیت ---------- */
  const tickClock = () => { sbClock.textContent = fmtTime(); };
  tickClock();
  setInterval(tickClock, 15000);

  /* ---------- وضعیت ویژوالایزر (v0.16.2) ----------
     ⚠ این let باید «قبل از» اولین applyPerf() بیاید؛ applyPerf در حین بوت
     ممکن است vizStop() را صدا بزند (safeMode/noFx/lite) و اگر vizRaf هنوز
     در TDZ (منطقهٔ مرگ موقت let) باشد، کل بوت با ReferenceError می‌مرد —
     باگ گزارش کرش کاربر: «Cannot access 'vizRaf' before initialization».
     تعریف تابع‌های viz پایین فایل می‌ماند (hoist کامل دارند). */
  let vizCtx = null, vizAnalyser = null, vizData = null, vizRaf = 0, vizTick = false;

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
    /* try/catch اضافی: هیچ خطایی از این مسیر نباید بوت را بکشد (سپر دوم بعد از فیکس TDZ) */
    if (typeof vizStop === 'function' && (settings.noFx || flatTheme() || settings.safeMode)) { try { vizStop(); } catch (_) { /* noop */ } }
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
  const browserHint = () => toast('این دکمه فقط داخل نرم‌افزار الکترون واقعی کار می‌کند', '#i-info');
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
    if (analyser) return true;
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
    detachMic();
    await attachMic();
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
    if (isRecording || gRec) return; /* حین ضبط، استریم نباید بسته شود */
    if (micStream) { micStream.getTracks().forEach((t) => t.stop()); micStream = null; }
    if (audioCtx) { try { audioCtx.close(); } catch (_) { /* noop */ } audioCtx = null; }
    analyser = null; micData = null; micLive = false;
    sbMic.innerHTML = `<i class="dot err"></i>${t('mic.off')}`;
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
  const stripSearch = (c) =>
    c.replace(/(لطفا|لطفاً)/g, '')
      .replace(/(در\s+)?(گوگل|google)/gi, '')
      .replace(/(را|رو)\s+/g, '')
      .replace(/(جستجو|سرچ|search)[\s\u200C]*(کن|بکن|بگیر)?[\s\u200C]*ی?[\s\u200C]*/gi, '')
      .replace(/[\s\u200C]+/g, ' ')
      .trim();

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

  async function weatherReply(c) {
    if (!bridge || !bridge.system || !bridge.system.weather) {
      return t('weather.onlyApp');
    }
    let city = String(c || '')
      .replace(WX_STRIP, ' ')
      .replace(/[0-9۰-۹?؟!.,،:;]+/g, ' ')
      .replace(/[\s\u200C]+/g, ' ')
      .trim();
    const r = await bridge.system.weather(city || 'تهران');
    if (r && r.ok) {
      return t('weather.reply', { city: r.name, desc: LANG === 'en' ? (r.descEn || r.desc) : r.desc, temp: faNum(r.temp), feels: faNum(r.feels), hum: faNum(r.hum), wind: faNum(r.wind) });
    }
    return (r && r.error) || t('weather.fail');
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
    if (!m) return t('calc.fail');
    const v = Math.round(m.val * 1000) / 1000;
    return t('calc.reply', { x: faNum(m.expr.replace(/\*/g, '×').replace(/\//g, '÷')), y: faNum(String(v)) });
  }

  const RULES = [
    /* --- پاور: خواب / خاموش / ریستارت / مانیتور (نسخه ۰.۱۰) --- */
    {
      k: /لغو.{0,8}(خاموش|شات\s?داون)|انصراف.{0,8}(خاموش|ریستارت)|cancel.{0,8}(shutdown|restart)|abort.{0,8}shutdown/i, t: 'لغو خاموش شدن', i: '#i-power', run: 'shutdown_abort',
      r: () => runPower('shutdown_abort'),
    },
    { k: /(بخواب|خواب.{0,6}ببر|حالت.{0,6}خواب|به\s*خواب|sleep( now)?|go to sleep)/i, t: 'حالت خواب', i: '#i-moon', run: 'sys_sleep', r: () => runPower('sys_sleep') },
    { k: /مانیتور.{0,10}خاموش|نمایشگر.{0,10}خاموش|خاموش.{0,10}مانیتور|خاموش.{0,10}نمایشگر|turn off.{0,10}(monitor|screen|display)|monitor.{0,6}off/i, t: 'خاموش کردن مانیتور', i: '#i-monitor', run: 'monitor_off', r: () => runPower('monitor_off') },
    { k: /ری\s?استارت|ریستارت|راه\s?اندازی.{0,4}مجدد|restart|reboot/i, t: 'راه‌اندازی مجدد', i: '#i-refresh', run: 'sys_restart', confirm: 'restart', r: () => runPower('sys_restart') },
    {
      k: /(خاموش|شات\s?داون|shutdown|shut\s?down|power\s?off|turn\s?off).{0,16}(کامپیوتر|سیستم|ویندوز|پی\s?سی|pc|computer|system)?|کامپیوتر.{0,10}خاموش|سیستم.{0,10}خاموش/i, t: 'خاموش کردن', i: '#i-power', run: 'sys_shutdown', confirm: 'shutdown',
      r: () => runPower('sys_shutdown'),
    },

    /* --- برنامه‌های ویندوز --- */
    { k: /کروم|مرورگر|chrome|browser/i, t: 'باز کردن کروم', i: '#i-globe', run: 'open_chrome', r: () => LANG === 'en' ? 'Chrome is open. Enjoy!' : 'مرورگر کروم باز شد. خوش بگذره!' },
    { k: /نت[\s\u200C.]?پد|نوت[\s\u200C]?پد|دفترچه|notepad/i, t: 'باز کردن نت‌پد', i: '#i-note', run: 'open_notepad', r: () => LANG === 'en' ? 'Notepad is open.' : 'نت‌پد باز شد.' },
    { k: /ماشین[\s\u200C]?حساب|calculator|حساب\s?کن/i, t: 'باز کردن ماشین‌حساب', i: '#i-calc', run: 'open_calc', r: () => LANG === 'en' ? 'Calculator is open.' : 'ماشین‌حساب باز شد.' },
    { k: /اکسپلورر|فایل‌?ها|مای\s?کامپیوتر|این\s?کامپیوتر|explorer|file explorer/i, t: 'باز کردن اکسپلورر', i: '#i-window', run: 'open_explorer', r: () => LANG === 'en' ? 'File Explorer is open.' : 'فایل اکسپلورر باز شد.' },
    { k: /وی[\s\u200C]?اس\s?کد|vs\s?code|کدنویس/i, t: 'باز کردن VS Code', i: '#i-note', run: 'open_vscode', r: () => LANG === 'en' ? 'VS Code is open (must be installed).' : 'وی‌اس کد باز شد (باید روی سیستم نصب باشد).' },
    { k: /تسک[\s\u200C]?منیجر|مدیریت[\s\u200C]?فرایند|task\s?manager/i, t: 'باز کردن تسک‌منیجر', i: '#i-pulse', run: 'open_taskmgr', r: () => LANG === 'en' ? 'Task Manager is open.' : 'تسک‌منیجر باز شد.' },
    { k: /تنظیمات|windows settings|open settings/i, t: 'باز کردن تنظیمات', i: '#i-gear', run: 'open_settings', r: () => LANG === 'en' ? 'Windows Settings is open.' : 'تنظیمات ویندوز باز شد.' },
    { k: /پینت|نقاشی|paint/i, t: 'باز کردن پینت', i: '#i-calc', run: 'open_paint', r: () => LANG === 'en' ? 'Paint is open; get creative!' : 'پینت باز شد؛ خلاق باش!' },

    /* --- وب --- */
    { k: /یوتیوب|youtube/i, t: 'باز کردن یوتیوب', i: '#i-music', run: 'open_youtube', r: () => LANG === 'en' ? 'YouTube is open.' : 'یوتیوب باز شد.' },
    { k: /موسیقی|آهنگ|موزیک|play music|play some music/i, t: 'پخش موسیقی', i: '#i-music', run: 'open_music', r: () => LANG === 'en' ? 'YouTube Music is open; pick a song.' : 'یوتیوب موزیک باز شد؛ آهنگ دلخواهت را بزن.' },
    {
      k: /آب[\s\u200C]?و[\s\u200C]?هوا|هوا\s?(چطور|چنده|چی|چیکار)|درجه[\s\u200C]?هوا|چند\s?درجه|دما|weather/i, t: 'آب‌وهوا', i: '#i-cloud',
      r: (c) => weatherReply(c),
    },
    {
      k: /(سایت|وب\s?سایت)|https?:\/\//i, t: 'باز کردن سایت', i: '#i-globe',
      run: (c) => (/https?:\/\//i.test(c) ? 'web_open' : 'web_search'),
      arg: (c) => {
        const m = c.match(/https?:\/\/\S+/);
        return m ? m[0] : stripSearch(c) || 'گوگل';
      },
      r: (c) => (LANG === 'en' ? (/https?:\/\//i.test(c) ? 'The website is open.' : 'I searched it on Google; the first result is usually the site.') : (/https?:\/\//i.test(c) ? 'سایت موردنظر باز شد.' : 'در گوگل جستجویش کردم؛ نتیجه اول معمولاً همان سایت است.')),
    },
    {
      k: /جستجو|سرچ|گوگل|google|search( for)?( the)? web|search$/i, t: 'جستجوی وب', i: '#i-search',
      run: 'web_search', arg: (c) => stripSearch(c),
      r: (c) => LANG === 'en' ? `I searched "${stripSearch(c) || 'Google'}" on Google.` : `«${stripSearch(c) || 'گوگل'}» را در گوگل جستجو کردم.`,
    },

    /* --- پنجره‌ها و سیستم --- */
    { k: /اسکرین\s?شات|اسکرین|عکس.{0,8}(صفحه|نمایشگر)|screenshot|take a screenshot/i, t: 'اسکرین‌شات', i: '#i-camera', run: 'screenshot', r: () => LANG === 'en' ? 'Screenshot taken and saved to your Pictures folder.' : 'اسکرین‌شات گرفته شد و در پوشه Pictures ذخیره شد.' },
    { k: /مینیمایز|کوچک.{0,8}(کن)|دسکتاپ|پنجره‌ها|minimize|show (the )?desktop/i, t: 'نمایش دسکتاپ', i: '#i-window', run: 'minimize_all', r: () => LANG === 'en' ? 'All windows minimized; desktop is clear.' : 'همه پنجره‌ها کوچک شدند؛ دسکتاپ آزاد است.' },
    { k: /قفل.{0,8}(کن|صفحه)|لاک\s?اسکرین|lock (the )?(pc|computer|screen)/i, t: 'قفل صفحه', i: '#i-lock', run: 'lock', r: () => LANG === 'en' ? 'Screen locked; bye!' : 'صفحه قفل شد؛ بدرود!' },

    /* --- ضبط صدا (واقعی) --- */
    { k: /(شروع|بگیر).{0,8}ضبط|ضبط.{0,8}(صدا|شروع)|start recording|record (my )?(voice|audio)/i, t: 'شروع ضبط صدا', i: '#i-mic', r: () => startAudioRec() },
    { k: /توقف.{0,8}ضبط|پایان.{0,8}ضبط|ضبط.{0,8}(تموم|کافی)|قطع.{0,8}ضبط|stop recording/i, t: 'پایان ضبط صدا', i: '#i-mic', r: () => stopAudioRec() },

    /* --- صدا --- */
    { k: /(صدا|ولوم).{0,12}(قطع|بی[\s\u200C]?صدا|میوت)|میوت|mute( the)?( volume| sound)?|بی[\s\u200C]?صدا/i, t: 'بی‌صدا کردن', i: '#i-volume', run: 'vol_mute', r: () => LANG === 'en' ? 'Sound is muted.' : 'صدا قطع شد.' },
    { k: /(صدا|ولوم|بلندی).{0,12}(بلند|زیاد|بالا|بده)|volume up|louder|turn (it )?up/i, t: 'بلندتر کردن صدا', i: '#i-volume', run: 'vol_up', r: () => LANG === 'en' ? 'Volume raised.' : 'صدای سیستم را بلندتر کردم.' },
    { k: /(صدا|ولوم|بلندی).{0,12}(کم|پایین|آرام)|volume down|quieter|turn (it )?down/i, t: 'کم کردن صدا', i: '#i-volume', run: 'vol_down', r: () => LANG === 'en' ? 'Volume lowered.' : 'صدای سیستم را کمتر کردم.' },
    {
      k: /(صدا|ولوم|بلندی|volume)[^0-9۰-۹]{0,12}[0-9۰-۹]+|[0-9۰-۹]+[^0-9۰-۹]{0,8}(درصد)?[\s\u200C]*(صدا|ولوم)|volume (to )?\d+/i, t: 'تنظیم دقیق صدا', i: '#i-volume',
      run: 'vol_set',
      arg: (c) => { const m = faToEn(c).match(/\d+/); return m ? Math.min(100, +m[0]) : 50; },
      r: (c) => { const m = faToEn(c).match(/\d+/); return LANG === 'en' ? `Volume set to ${m ? Math.min(100, +m[0]) : 50}%.` : `بلندی صدا روی ${faNum(m ? Math.min(100, +m[0]) : 50)}٪ تنظیم شد.`; },
    },

    /* --- ماشین‌حساب صوتی (قبل از جستجو تا قاطی نشود) --- */
    {
      k: /(?=.*(ضرب|تقسیم|علاوه|بعلاوه|منهای|منها|جمع|چند\s?میشه|چنده))(?=.*(\d|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|بیست|سی|چهل|پنجاه|شصت|هفتاد|هشتاد|نود|صد|هزار))|(?=.*(plus|minus|times|multiplied|divided))(?=.*\d)|what(?:'s| is) \d/i, t: 'محاسبه', i: '#i-calc',
      r: (c) => calcReply(c),
    },

    /* --- اطلاعات --- */
    { k: /وضعیت|سیستم|پردازنده|رم|system status|cpu|ram|how is (the )?system/i, t: 'مانیتورینگ', i: '#i-pulse', r: () => t('sys.reply', { cpu: faNum(lastCpu), ram: faNum(lastRam) }) },
    {
      k: /باتری|شارژ|battery|charge/i, t: 'باتری', i: '#i-pulse',
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
    { k: /ساعت|چند\s?ساعته|what time|the time/i, t: 'ساعت', i: '#i-clock', r: () => t('time.reply', { x: fmtTime() }) },
    { k: /تاریخ|چندمه|امروز|what('s| is) (the )?date|today'?s date/i, t: 'تاریخ', i: '#i-clock', r: () => t('date.reply', { x: fmtDate() }) },

    /* --- ابزار --- */
    /* --- یادآوری واقعی (v0.12): ساعت مطلق یا مدت + متن --- */
    {
      k: /یادآوری|یادم\s?بنداز|یادت\s?بنداز|یادآور|آلارم|بیدارم\s?کن|remind me/i, t: 'یادآوری ثبت شد', i: '#i-timer',
      r: (c) => reminderReply(c),
    },
    { k: /تایمر|هشدار\s?بذار|timer/i, t: 'تایمر فعال شد', i: '#i-timer', r: (c) => startTimer(c) },

    /* --- مدیای سیستم (هر پلیری — Spotify/مرورگر و…) --- */
    { k: /مدیا[^.]{0,10}(بعدی|بعد)|پلیر[^.]{0,10}(بعدی|بعد)|آهنگ بعدی پلیر|media next|next (track|media)/i, t: 'مدیای بعدی', i: '#i-music', run: 'media_next', r: () => (LANG === 'en' ? 'Next track on the system player.' : 'آهنگ بعدی در پلیر سیستم.') },
    { k: /مدیا[^.]{0,10}(قبلی|قبل)|پلیر[^.]{0,10}(قبلی|قبل)|آهنگ قبلی پلیر|media prev|previous (track|media)/i, t: 'مدیای قبلی', i: '#i-music', run: 'media_prev', r: () => (LANG === 'en' ? 'Previous track on the system player.' : 'آهنگ قبلی در پلیر سیستم.') },
    { k: /مدیا[^.]{0,12}(پاز|توقف|پخش|نگه دار)|(پاز|پخش).{0,6}مدیا|media (play|pause)|play pause media/i, t: 'پخش/توقف مدیا', i: '#i-music', run: 'media_toggle', r: () => (LANG === 'en' ? 'Toggled the system player.' : 'پلیر سیستم را پخش/توقف کردم.') },
    { k: /جوک|بخندون|شوخی|tell me a joke|make me laugh|joke/i, t: 'جوک', i: '#i-smile', r: () => joke() },

    /* --- تعامل --- */
    { k: /سلام|درود|خوبی|hello|hi ava|hey ava|good (morning|evening|afternoon)/i, t: 'سلام', i: '#i-wave', r: () => LANG === 'en' ? 'Hello! I am great, thanks. What can I do for you?' : 'سلام! من خوبم، ممنون. چه کاری برات انجام بدم؟' },
    { k: /متشکر|مرسی|ممنون|thank( you|s)/i, t: 'خواهش', i: '#i-wave', r: () => LANG === 'en' ? 'You are welcome! Anything else?' : 'خواهش می‌کنم! کار دیگری هست؟' },

    /* --- پوشه‌های ویندوز و سطل بازیافت --- */
    { k: /پوشه.{0,6}دانلود|دانلودها|downloads|open downloads/i, t: 'باز کردن دانلودها', i: '#i-download', run: 'open_downloads', r: () => LANG === 'en' ? 'Downloads folder is open.' : 'پوشه دانلودها باز شد.' },
    { k: /پوشه.{0,6}(اسناد|داکیومنت|مستندات)|documents|open documents/i, t: 'باز کردن اسناد', i: '#i-note', run: 'open_documents', r: () => LANG === 'en' ? 'Documents folder is open.' : 'پوشه اسناد باز شد.' },
    { k: /سطل.{0,10}(زباله|بازیافت).{0,12}(خالی|پاک|تمیز|بریز)|empty (the )?(recycle|trash)|empty trash/i, t: 'خالی کردن سطل بازیافت', i: '#i-trash', run: 'recycle_empty', r: () => LANG === 'en' ? 'Recycle Bin emptied.' : 'سطل بازیافت خالی شد.' },
  ];

  /* فرمان‌های صوتی موزیک — قبل از قانون قدیمی یوتیوب‌موزیک */
  const MUSIC_FA = 'موزیک|موسیقی|آهنگ|اهنگ|آواز|ترانه|پلی\s?[\u200C]?لیست|music|song|playlist';
  {
    const musicRules = [
      {
        k: new RegExp(`(?:${MUSIC_FA})[^.]{0,14}(بعدی|بعد)|(بعدی|next)[^.]{0,8}(?:${MUSIC_FA})|next (song|track|music)`, 'i'),
        t: 'آهنگ بعدی', i: '#i-music', r: () => voiceMusicNext(),
      },
      {
        k: new RegExp(`(?:${MUSIC_FA})[^.]{0,14}(قبلی|قبل)|(قبلی|previous|prev)[^.]{0,8}(?:${MUSIC_FA})|previous (song|track|music)`, 'i'),
        t: 'آهنگ قبلی', i: '#i-music', r: () => voiceMusicPrev(),
      },
      {
        k: new RegExp(`(?:${MUSIC_FA})[^.]{0,16}(پاز|توقف|نگه\s?[\u200C]?دار|قطع|استاپ|استپ|ساکت|stop|pause)|(پاز|stop|pause)[^.]{0,10}(?:${MUSIC_FA})`, 'i'),
        t: 'توقف موزیک', i: '#i-music', r: () => voiceMusicPause(),
      },
      {
        k: new RegExp(`(?:پخش|بزن|پلی|شروع|play)[^.]{0,10}(?:${MUSIC_FA})|(?:${MUSIC_FA})[^.]{0,14}(پخش|بزن|پلی|شروع|play|کن)`, 'i'),
        t: 'پخش موزیک', i: '#i-music', r: () => voiceMusicPlay(),
      },
      {
        k: /پلی\s?[\u200C]?لیست|playlist|صفحه.{0,8}موزیک|موزیک.{0,8}(باز|صفحه)/i,
        t: 'پلیر موزیک', i: '#i-music', r: () => { showView('music'); return t('music.pageOpen'); },
      },
    ];
    RULES.splice(1, 0, ...musicRules);
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

  /* استخراج نام برنامه از جمله: «لطفا تلگرام رو برام اجرا کن» → «تلگرام» */
  function extractAppName(cmd) {
    let s = String(cmd || '');
    if (/(سایت|وب\s?سایت|https?:\/\/)/i.test(s)) return '';
    s = s
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
    const en = /\b(discord)\b/i.test(t0);
    const fa = /دیسکورد|دیسبورد|دیسکوردُ/.test(t0);
    const ctx = discordCtx();
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
    /* بی‌صدای کل (deafen) — «صدای دیسکورد رو قطع/کرافت کن» */
    if (/صدای?[^.]{0,8}(دیسکورد|discord)/.test(t0) && /(قطع|بیصدا|بی صدا|کرافت)/.test(t0)) {
      const r = await bridge.discord.cmd({ action: 'deafen', ...ctx }).catch(() => null);
      return r && r.ok ? t('disc.deafened') : ((r && r.error) || t('disc.fail'));
    }
    /* میوت میکروفون — «دیسکورد رو میوت کن» / «میکروفون دیسکورد قطع» */
    if (fa || en) {
      if (/(میوت|مایوت|بیصدا|بی صدا)/.test(t0) || (/میکروفون/.test(t0) && /قطع/.test(t0)) || /وصل[^.]{0,6}(میکروفون|میوت)/.test(t0)) {
        const r = await bridge.discord.cmd({ action: 'mute', ...ctx }).catch(() => null);
        return r && r.ok ? t('disc.muted') : ((r && r.error) || t('disc.fail'));
      }
    }
    /* تماس با نام: «به علی زنگ بزن» / «در دیسکورد به علی تماس بگیر» / «کال کن علی»
       v0.17 — اول مخاطبین ذخیره‌شده (اسم ساده → آی‌دی) تطبیق می‌شوند؛
       اگر مخاطب پیدا شد تماس با دیپ‌لینک مستقیم انجام می‌شود */
    const callRe = [/(?:در\s*)?(?:دیسکورد|discord)[^.]{0,10}?(?:به|برای)\s+(.+?)\s*(?:زنگ\s*بزن|تماس\s*بگیر|کال\s*کن)/, /(?:به|برای)\s+(.+?)\s*(?:زنگ\s*بزن|تماس\s*بگیر|کال\s*کن)/, /(?:زنگ\s*بزن|تماس\s*بگیر|کال\s*کن)\s*(?:به|برای)?\s+(.+)/];
    if (/(زنگ\s*بزن|تماس\s*بگیر|کال\s*کن)/.test(t0)) {
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
  function parseReminder(c) {
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
        else if (mer === 'noon' && hour < 12) hour += hour === 0 ? 12 : 0;
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

    /* ۲) مدت: «۲۰ دقیقه دیگه» / «یک ساعت و نیم بعد» / «نیم ساعت دیگه» */
    const half = /نیم\s*ساعت/.test(txt);
    const dur = txt.match(/([\d۰-۹]+|[ا-ی\u200C\s]{2,20}?)\s*(ثانیه|دقیقه|ساعت)(?:\s*و\s*(نیم|ربع))?\s*(دیگه|دیگر|بعد)/i);
    if (dur) {
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
    if (half && /(دیگ|دیگر|بعد)/.test(txt)) {
      const text = stripTime(txt) || 'یادآوری';
      return { at: Date.now() + 30 * 60000, text };
    }
    return null;
  }

  async function reminderReply(c) {
    const parsed = parseReminder(c);
    if (!parsed) {
      /* زمان نفهمیدیم — اگر مدت داشت مثل تایمر رفتار کن */
      if (/ثانیه|دقیقه|ساعت|timer/i.test(c)) return startTimer(c);
      return t('rem.noTime');
    }
    if (!bridge || !bridge.reminders) {
      /* پیش‌نمایش مرورگر — مثل تایمر محلی */
      return startTimer(new Date(parsed.at - Date.now()) <= new Date(0) ? c : c);
    }
    const r = await bridge.reminders.add({ text: parsed.text, at: parsed.at }).catch(() => null);
    if (r && r.ok) return t('rem.set', { x: parsed.text, y: fmtClock(parsed.at) });
    return (r && r.error) || t('rem.fail');
  }

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

  /* ---------- تایمر واقعی ---------- */
  let timerId = null;
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
  function startTimer(c) {
    const txt = faToEn(c);
    const m = txt.match(/(\d+(?:\.\d+)?)/);
    let mins = m ? parseFloat(m[1]) : 5;
    const secWord = /ثانیه|second/i.test(c);
    const minWord = /دقیقه|minute/i.test(c);
    let unit = t('timer.min');
    if (secWord && !minWord) { mins = mins / 60; unit = t('timer.sec'); }
    mins = Math.max(0.05, Math.min(600, mins));
    if (timerId) clearTimeout(timerId);
    timerId = setTimeout(() => {
      beep();
      toast(t('timer.done'), '#i-timer');
      setState('success');
      statusText.textContent = t('timer.done');
      rcTag.textContent = t('timer.doneTag');
      rcHeard.textContent = t('timer.doneTag');
      rcReply.textContent = t('timer.doneReply');
      respCard.classList.add('show');
      speak(t('timer.doneSpeak'));
      setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 4000);
    }, mins * 60000);
    const label = secWord && !minWord ? faNum(Math.round(mins * 60)) : faNum(+(mins.toFixed(1)));
    return t('timer.on', { x: label, y: unit });
  }

  /* ---------- تایپ متن پاسخ ---------- */
  let typeTimer = null;
  function typeText(el, txt) {
    clearInterval(typeTimer);
    el.textContent = '';
    let i = 0;
    typeTimer = setInterval(() => {
      el.textContent = txt.slice(0, ++i);
      if (i >= txt.length) clearInterval(typeTimer);
    }, 14);
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
      }
    } catch (_) {
      rcTag.textContent = t('tag.fail');
    }
    return reply;
  }

  /* cmdBusy: جلوگیری از اجرای دوباره فرمان در حین اجرای فرمان قبلی.
     توجه: state=processing بعد از تشخیص گفتار کاملاً طبیعی است و
     نباید فرمان را رد کند (باگ قدیمی که جواب‌های گوگل/GLM را ساکت دور می‌ریخت). */
  let cmdBusy = false;

  /* اجرای فرمان‌های DNS (با UAC واقعی) — هم از مسیر «دی ان اس …»
     و هم از مسیر «الکترو رو تنظیم کن» (اسم ذخیره‌شده کاربر) */
  async function runDnsCommand(raw) {
    if (cmdBusy) return;
    cmdBusy = true;
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
    } catch (_) {
      setState('idle');
      statusText.textContent = t('dns.dnsFail');
    }
    cmdBusy = false;
    setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 2600);
  }

  async function runCommand(cmd, opts) {
    if (!cmd) return;
    if (cmdBusy) return;
    const raw = String(cmd).trim();
    /* ---- اولویت: تایپ صوتی و DNS (قبل از قوانین دیگر) ---- */
    const DICT_START_RE = /([اآا]وا|ava)[\s\u200C،,:-]*تایپ|حالت\s*تایپ|تایپ\s*(رو\s*)?(شروع|بزن)\s*کن|شروع\s*به\s*تایپ|برام\s*تایپ\s*کن|برایم\s*تایپ\s*کن|این\s*(رو|را)\s*تایپ\s*کن|تایپش\s*کن/i;
    const wakeDictStart = opts && opts.wake && /^(تایپ|تایپ\s*کن|حالت\s*تایپ|تایپ\s*صوتی)$/i.test(raw);
    if (dictation.active) {
      if (DICT_STOP_RE.test(raw)) { stopDictation(true); return; }
      /* وسط تایپ: همین متن اضافه شود، نه اجرای فرمان */
      dictateHandle(raw);
      return;
    }
    if (DICT_START_RE.test(raw) || wakeDictStart) { startDictation(); return; }
    /* کنترل دیسکورد (v0.16) — قبل از DNS/برنامه تا «زنگ بزن» قاطی نشود */
    if (/زنگ\s*بزن|تماس\s*بگیر|کال\s*کن|دیسکورد|discord|میکروفون[^.]{0,10}(قطع|میوت)/i.test(raw)) {
      const dr = await tryDiscordCmd(raw);
      if (dr) {
        if (cmdBusy) return;
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
    }
    /* پینگ DNSها (v0.13) — قبل از مسیر کلاسیک DNS تا «پینگ دی ان اس» قاطی نشود */
    if (/پینگ[^.]{0,16}(دی\s?ان\s?اس|dns)|(دی\s?ان\s?اس|dns)[^.]{0,12}پینگ|پینگ\s?(بگیر|نشون|بده)|dns.{0,10}ping|ping.{0,10}dns/i.test(raw)) {
      if (cmdBusy) return;
      cmdBusy = true;
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
      } catch (_) {
        setState('idle');
        statusText.innerHTML = IDLE_HINT;
      }
      cmdBusy = false;
      setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 2600);
      return;
    }
    /* DNS کلاسیک: هر جمله‌ای که «دی ان اس / dns» دارد */
    if (/دی\s?ان\s?اس|dns/i.test(raw)) { await runDnsCommand(raw); return; }
    /* DNS با اسم دلخواه — حتی بدون واژه «دی ان اس»:
       «الکترو رو تنظیم کن» یا «شکن رو فعال کن» → همان پروفایل روی ویندوز ست می‌شود */
    if (/(تنظیم|فعال|وصل|اعمال|ست)\s*(کن|بکن)?/i.test(raw)) {
      const cand = raw
        .replace(/(لطفا|لطفاً)/g, '')
        .replace(/(^|\s)(رو|را|به|برای|من)(\s|$)/g, ' ')
        .replace(/(تنظیم|فعال|وصل|اعمال|کن|بکن|بزن|شروع)/g, ' ')
        .replace(/[\s\u200C]+/g, ' ')
        .trim();
      if (cand.length >= 3 && findDnsProfile(cand)) { await runDnsCommand(raw); return; }
    }
    cmdBusy = true;
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
    rcReply.textContent = '';
    rcTag.textContent = t('tag.working');

    const rule = RULES.find((r) => r.k.test(cmd)) || findCustomRule(cmd);
    if (!rule) {
      /* مرحله ۳ پایپ‌لاین: تطبیق فازی برنامه‌های سیستم («تلگرام رو اجرا کن»)
         اگر نیت باز کردن نبود یا برنامه پیدا نشد → هوش مصنوعی (مرحله ۴) */
      const appReply = await tryAppOpen(cmd);
      if (appReply) {
        setState('success');
        statusText.textContent = t('status.done');
        rcTag.textContent = t('tag.done');
        typeText(rcReply, appReply);
        speak(appReply);
        pushHistory(cmd, !/پیدا نکردم|not found/i.test(appReply));
        setTimeout(() => { cmdBusy = false; }, 100);
        setTimeout(() => {
          if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; }
        }, 2600);
        return;
      }
      if (aiConnected()) {
        /* فرمان شناخته نشد → هوش مصنوعی تحلیل و جواب می‌دهد */
        await aiHandleCommand(cmd);
        return;
      }
    }
    const reply = rule ? await resolveReply(rule, cmd) : t('default.reply');
    if (!rule) rcTag.textContent = t('tag.reply');

    setTimeout(() => {
      setState('success');
      statusText.textContent = t('status.done');
      typeText(rcReply, reply);
      speak(reply);
      if (rule && rule.t) toast(rule.t, rule.i || '#i-info');
      pushHistory(cmd, !/نشده|نمی‌شود|Failed/.test(rcTag.textContent || ''));
      handsFreeRearm();
      setTimeout(() => {
        cmdBusy = false;
        if (state === 'success') {
          setState('idle');
          statusText.innerHTML = IDLE_HINT;
        }
      }, 2400);
    }, 500 + Math.random() * 300);
  }

  /* ============================================================
     تشخیص گفتار واقعی — زنجیره: موتور وب → گوگل رایگان (HTTP) → GLM-ASR
     بدون هیچ کلیدی؛ دمو فقط با تنظیم صریح کاربر.
     ============================================================ */
  let rec = null, recActive = false, gotFinal = false, srBroken = false, demoNoticeShown = false;
  let webGotAny = false, webWatchdog = null, webFailStreak = 0;
  let recEpoch = 0; /* نسل‌شمار موتور وب — ریس onend/onresult جلسه قدیمی را می‌کشد (فیکس v0.13) */
  let glmRec = null, glmTimer = null, glmMaxTimer = null, glmSpoke = false, glmListening = false, glmSilentMs = 0;
  const ASR_MODEL = 'glm-asr-2512';
  const GLM_MAX_MS = 12000;   // بیشینه ضبط هر فرمان صوتی
  const GLM_SIL_MS = 2300;    // سکوت لازم برای پایان فرمان
  const GLM_ON_LVL = 16;      // آستانه تشخیص شروع حرف (میانگین طیف)

  const googleReady = () => !!(bridge && bridge.stt && bridge.stt.google);
  /* v0.17 — موتورهای کلاس AI (الگوی typeo/iotype): ترنسکریپت با مدل هوش مصنوعی */
  const geminiSttReady = () => !!(bridge && bridge.stt && bridge.stt.gemini && settings.geminiKey);
  const whisperSttReady = () => !!(bridge && bridge.stt && bridge.stt.whisper && settings.whisperKey);

  function refreshEngineUI() {
    const eng = settings.sttEngine || 'auto';
    const webUsable = SRC && !srBroken;
    if (webUsable && eng !== 'google' && eng !== 'glm' && eng !== 'gemini' && eng !== 'whisper') sbEngine.innerHTML = `<i class="dot ok"></i>${t('eng.web')}`;
    else if (geminiSttReady() && eng !== 'web' && eng !== 'glm' && eng !== 'google' && eng !== 'whisper') sbEngine.innerHTML = `<i class="dot ok"></i>${t('eng.gemini')}`;
    else if (whisperSttReady() && eng !== 'web' && eng !== 'glm' && eng !== 'google' && eng !== 'gemini') sbEngine.innerHTML = `<i class="dot ok"></i>${t('eng.whisper')}`;
    else if (googleReady() && eng !== 'web' && eng !== 'glm' && eng !== 'gemini' && eng !== 'whisper') sbEngine.innerHTML = `<i class="dot ok"></i>${t('eng.google')}`;
    else if (glmReady() && eng !== 'web' && eng !== 'google' && eng !== 'gemini' && eng !== 'whisper') sbEngine.innerHTML = `<i class="dot ok"></i>${t('eng.glm')}`;
    else if (settings.demoMode) sbEngine.innerHTML = `<i class="dot warn"></i>${t('eng.demo')}`;
    else sbEngine.innerHTML = `<i class="dot err"></i>${t('eng.none')}`;
  }

  /* زنجیرهٔ ابری (v0.17): جمنای → Whisper → GLM → گوگل رایگان
     موتور آفلاین ضعیف در نسخه ۰.۹ کامل حذف شده است. */
  function buildCloudChain() {
    const eng = settings.sttEngine || 'auto';
    if (eng === 'gemini') return geminiSttReady() ? ['gemini'] : [];
    if (eng === 'whisper') return whisperSttReady() ? ['whisper'] : [];
    if (eng === 'glm') return glmReady() ? ['glm'] : [];
    if (eng === 'google') return googleReady() ? ['google'] : [];
    /* خودکار: دقیق‌ترین موتور در دسترس جلوتر */
    const c = [];
    if (geminiSttReady()) c.push('gemini');
    if (whisperSttReady()) c.push('whisper');
    if (glmReady()) c.push('glm');
    if (googleReady()) c.push('google');
    return c;
  }
  function resolveEngine() {
    const eng = settings.sttEngine || 'auto';
    if (eng === 'web') return (SRC && !srBroken) ? 'web' : null;
    if (eng === 'gemini' || eng === 'whisper' || eng === 'glm' || eng === 'google') return buildCloudChain()[0] || null;
    /* خودکار: اول وب (فوری و زنده)، بعد موتورهای ابری AI */
    if (SRC && !srBroken) return 'web';
    return buildCloudChain()[0] || null;
  }

  /* بعد از موتور وب، نوبت کدام موتور برسد (فالبک زنجیره‌ای) */
  function nextEngineAfterWeb() {
    return buildCloudChain()[0] || null;
  }

  /* فالبک هوشمند: اگر موتور وب از دسترس خارج شد، بدون دخالت کاربر
     با موتور بعدی گوش می‌دهیم (در همان وضعیت گوش دادن) */
  function fallbackFromWeb() {
    webFailStreak += 1;
    if (webFailStreak >= 2) srBroken = true; /* این اجرا: دیگر وب را امتحان نکن */
    refreshEngineUI();
    if (state !== 'listening') return;
    const nxt = nextEngineAfterWeb();
    /* همهٔ موتورهای ابری از همان ضبط‌کنندهٔ تطبیقی مشترک استفاده می‌کنند */
    if (nxt) { statusText.textContent = t('stt.webFail'); startCloudListen(); }
    else { setState('idle'); statusText.innerHTML = IDLE_HINT; }
  }

  function makeRec() {
    /* نسل‌شمار: اگر جلسه جدیدی شروع شده بود، رویدادهای این جلسه قدیمی
       کاملاً نادیده گرفته می‌شوند — فیکس «رفتار عجیب» استارت/استارت سریع
       (قبلاً onend جلسه قبلی، موتور جلسه جدید را هم از کار می‌انداخت) */
    const myEpoch = recEpoch;
    const r = new SRC();
    r.lang = settings.sttLang || 'fa-IR';
    r.interimResults = true;
    r.continuous = false;
    webGotAny = false;
    /* سگ‌بان: اگر موتور وب بعد از ۷.۵ ثانیه هیچ نتیجه/خطایی نداد (معمولاً
       به‌خاطر کندی شبکه)، خودکار به موتور بعدی سوییچ می‌کنیم
       (۴.۵ ثانیه قبلی وسط گوش دادن روی اینترنت کند قطع می‌شد) */
    clearTimeout(webWatchdog);
    webWatchdog = setTimeout(() => {
      if (myEpoch !== recEpoch || state !== 'listening' || gotFinal || webGotAny) return;
      try { recActive = false; if (rec) { try { rec.onend = null; rec.stop(); } catch (_) { /* noop */ } } } catch (_) { /* noop */ }
      fallbackFromWeb();
    }, 7500);
    r.onresult = (e) => {
      if (myEpoch !== recEpoch) return; /* جلسه قدیمی — نادیده */
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const tr = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += tr; else interim += tr;
      }
      if ((interim || final) && !webGotAny) {
        webGotAny = true;
        clearTimeout(webWatchdog);
        webFailStreak = 0; /* موتور وب زنده است */
      }
      if (interim && state === 'listening') {
        if (dictation.active) { dictInterim.textContent = interim; }
        else { statusText.textContent = t('status.heard', { x: interim }); setLiveText(interim); }
      }
      if (final) {
        gotFinal = true;
        clearTimeout(webWatchdog);
        setLiveText('');
        stopListening(false);
        if (dictation.active) dictateHandle(final.trim(), { interimEl: true });
        else handleUtterance(final.trim());
      }
    };
    r.onerror = (e) => {
      if (myEpoch !== recEpoch) return; /* جلسه قدیمی — نادیده */
      if (['network', 'not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'].includes(e.error)) {
        clearTimeout(webWatchdog);
        recActive = false;
        /* فالبک خودکار: گوگل رایگان (HTTP) → GLM ابری */
        if (state === 'listening' && (settings.sttEngine === 'auto')) {
          fallbackFromWeb();
        } else if (['network', 'service-not-allowed'].includes(e.error)) {
          srBroken = true;
          refreshEngineUI();
        }
      }
    };
    r.onend = () => {
      if (myEpoch !== recEpoch) return; /* جلسه قدیمی — وضعیت جلسه جدید را خراب نکن */
      recActive = false;
      clearTimeout(webWatchdog);
      if (gotFinal || srBroken) return;
      if (state === 'listening') {
        /* بدون هیچ نتیجه بسته شد → احتمالاً گوگل در دسترس نیست → فالبک */
        if (!webGotAny && (settings.sttEngine === 'auto')) { fallbackFromWeb(); return; }
        if (dictation.active) { rearmDictation(); return; }
        setState('idle');
        statusText.innerHTML = IDLE_HINT;
        sbMic.innerHTML = `<i class="dot ok"></i>${t('mic.ready')}`;
      }
    };
    return r;
  }

  /* --- موتور رایگان گوگل: ضبط PCM + آستانه تطبیقی + ارسال به سرور گوگل ---
     نسخه ۰.۱۰ — فیکس کامل «صدا دریافت نشد»:
     ۱) آستانه شروع حرف برای هر میکروفون «تطبیقی» محاسبه می‌شود
        (اول کف نویز محیط اندازه می‌شود؛ دیگر آستانه ثابت باعث
        «صدایی نشنیدم» روی میکروفون‌های آروم نمی‌شود)
     ۲) اگر صدایی کمتر از آستانه بود ولی کاملاً ساکت هم نبود،
        به‌هرحال برای تشخیص ارسال می‌شود
     ۳) صدا اول بریده می‌شود (سکوت‌ها) بعد تقویت — دقت بالاتر
     ۴) اگر گوگل جواب نداد، همان صدا به‌صورت WAV به GLM-ASR هم می‌رود */
  const G_MAX_MS = 12000;    // بیشینه ضبط
  const G_SIL_MS = 2200;     // سکوت پایان فرمان (۲.۲ ثانیه — وسط جمله قطع نکنیم)
  const G_IDLE_MS = 8000;    // اگر هیچ حرفی نشنید
  let gRec = null, gMaxT = null;

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

  /* ساخت فایل WAV استاندارد از PCM خام — برای فالبک GLM-ASR
     (GLM-ASR فایل wav قبول می‌کند؛ این‌جا بدون هیچ وابستگی هدر می‌سازیم) */
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

  /* نرمال‌سازی بلندی صدا: میکروفون‌های کم‌صدا/دور را تقویت می‌کند تا
     موتور تشخیص کلمه‌ها را نصفه‌کاره نشنود (علت اصلی «کج می‌شنود») */
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

  function startGoogleListen() {
    /* ضبط‌کنندهٔ تطبیقی مشترک همهٔ موتورهای ابری (گوگل/جمنای/Whisper/GLM) */
    if (!buildCloudChain().length) { noEngine(t('stt.noEngineApp')); return; }
    attachMic().then((ok) => {
      /* اگر کاربر وسط کار دکمه را زده و گوش‌دادن تمام شده، ضبط نساز */
      if (!ok) { noEngine(t('stt.micMissing')); return; }
      if (state !== 'listening') return;
      try {
        const src = audioCtx.createMediaStreamSource(micStream);
        const proc = audioCtx.createScriptProcessor(4096, 1, 1);
        const sink = audioCtx.createGain();
        sink.gain.value = 0; // بی‌صدا — فقط برای پردازش
        src.connect(proc);
        proc.connect(sink);
        sink.connect(audioCtx.destination);
        /* floor: کف نویز محیط — تا اولین حرف، مدام به‌روز می‌شود تا
           آستانه شروع حرف برای «هر میکروفونی» تطبیقی باشد */
        gRec = { src, proc, sink, chunks: [], spoke: false, lastVoice: 0, started: Date.now(), busy: false, floor: 0.006, floorN: 0, maxRms: 0 };
        proc.onaudioprocess = (e) => {
          if (!gRec || gRec.busy) return;
          const f = e.inputBuffer.getChannelData(0);
          gRec.chunks.push(new Float32Array(f));
          let sum = 0, n = 0;
          for (let i = 0; i < f.length; i += 4) { sum += f[i] * f[i]; n++; }
          const rms = Math.sqrt(sum / Math.max(1, n));
          const now = Date.now();
          if (rms > gRec.maxRms) gRec.maxRms = rms;
          /* آستانه تطبیقی: کمی بالاتر از نویز محیط؛ بین ۰٫۰۰۵ و ۰٫۰۴ محدود می‌شود */
          const thr = Math.max(0.005, Math.min(0.04, gRec.floor * 2.2 + 0.0035));
          if (!gRec.spoke) {
            /* هنوز حرفی نشنیده‌ایم: کف نویز را نرم به‌روزرسانی کن */
            gRec.floor = gRec.floor * 0.92 + rms * 0.08;
            gRec.floorN++;
          }
          if (rms > thr) {
            gRec.spoke = true;
            gRec.lastVoice = now;
            if (state === 'listening') statusText.textContent = t('status.googleHeard');
          } else if (gRec.spoke && now - gRec.lastVoice > G_SIL_MS) {
            stopGoogleRec();
          } else if (!gRec.spoke && now - gRec.started > G_IDLE_MS) {
            stopGoogleRec();
          }
        };
        statusText.textContent = t('status.googleListen');
        gMaxT = setTimeout(() => stopGoogleRec(), G_MAX_MS);
      } catch (_) {
        gRec = null;
        noEngine(t('stt.googleFail'));
      }
    });
  }

  function stopGoogleRec() {
    clearTimeout(gMaxT); gMaxT = null;
    if (!gRec) return;
    const g = gRec;
    gRec = null;
    try { g.proc.disconnect(); } catch (_) { /* noop */ }
    try { g.src.disconnect(); } catch (_) { /* noop */ }
    try { g.sink.disconnect(); } catch (_) { /* noop */ }
    if (g.busy) return;
    g.busy = true;
    const totalMs = (g.chunks.length * 4096 * 1000) / (audioCtx ? audioCtx.sampleRate : 48000);
    /* فقط وقتی «واقعاً» هیچ صدایی نبود خطا بده — اگر کمی صدا بود
       به‌هرحال برای تشخیص بفرست (فیکس «صدا دریافت نشد» روی میکروفون‌های آروم) */
    if (g.maxRms < 0.0045 || totalMs < 350) {
      statusText.textContent = t('status.silence');
      setTimeout(() => { if (state === 'listening' || state === 'processing') { setState('idle'); statusText.innerHTML = IDLE_HINT; sbMic.innerHTML = `<i class="dot ok"></i>${t('mic.ready')}`; } }, 1500);
      return;
    }
    setState('processing');
    statusText.textContent = t('status.googleConv');
    const merged = new Float32Array(g.chunks.reduce((a, c) => a + c.length, 0));
    let off = 0;
    for (const c of g.chunks) { merged.set(c, off); off += c.length; }
    const rate = (audioCtx && audioCtx.sampleRate) || 48000;
    /* اول سکوت ابتدا/انتها را ببر، بعد بلندی را نرمال کن — تشخیص دقیق‌تر */
    const trimmed = trimSilenceEdges(downsampleF32(merged, rate, 16000), 16000);
    const normed = normalizeLoudness(trimmed);
    const pcm16 = f32ToI16(normed);
    const lang = settings.sttLang || 'fa-IR';
    const finishIdle = (msg) => {
      setState('idle');
      statusText.textContent = msg;
      sbMic.innerHTML = `<i class="dot ok"></i>${t('mic.ready')}`;
      if (dictation.active) setTimeout(rearmDictation, 1500);
    };
    /* v0.17 — پیمایش زنجیرهٔ ابری: جمنای → Whisper → GLM → گوگل رایگان
       همان صدا (WAV/PCM) به تک‌تک موتورهای زنجیره می‌رود تا جواب بگیرد؛
       دقیق‌ترین‌ها (کلاس AI — الگوی typeo/iotype) جلوتر هستند */
    const chain = buildCloudChain();
    const pcmBytes = new Uint8Array(pcm16.buffer);
    const wavBlob = pcmToWavBlob(pcm16, 16000);
    const wavSend = async () => {
      const b = new Uint8Array(await wavBlob.arrayBuffer());
      return b.length < 900 ? null : b;
    };
    const runEngine = async (eng) => {
      if (eng === 'gemini') {
        statusText.textContent = t('stt.tryGemini');
        const b = await wavSend();
        if (!b) return { ok: false };
        return bridge.stt.gemini({ buf: b, key: settings.geminiKey, model: settings.geminiModel, lang: settings.sttLang || 'fa-IR' });
      }
      if (eng === 'whisper') {
        statusText.textContent = t('stt.tryWhisper');
        const b = await wavSend();
        if (!b) return { ok: false };
        return bridge.stt.whisper({ buf: b, base: settings.whisperBase, key: settings.whisperKey, model: settings.whisperModel, lang: settings.sttLang || 'fa-IR' });
      }
      if (eng === 'glm') {
        statusText.textContent = t('stt.fallbackGlm');
        const b = await wavSend();
        if (!b) return { ok: false };
        return bridge.stt.transcribe({ buf: b, base: settings.glmBase, key: settings.glmKey, model: ASR_MODEL });
      }
      statusText.textContent = t('status.googleConv');
      return bridge.stt.google({ pcm: pcmBytes, rate: 16000, key: settings.googleKey || '', lang });
    };
    const runChain = async (i, why) => {
      if (state === 'idle') return; /* کاربر لغو کرد */
      const eng = chain[i];
      if (!eng) { finishIdle(why || t('stt.convFail', { x: '—' })); return; }
      let r = null;
      try { r = await runEngine(eng); } catch (_) { r = { ok: false, error: t('stt.connFail') }; }
      if (r && r.ok && r.text) {
        const tx = r.text.trim();
        if (dictation.active) dictateHandle(tx);
        else handleUtterance(tx);
        return;
      }
      const isLast = (i + 1 >= chain.length);
      if (r && r.error && isLast) toast(String(r.error).slice(0, 150), '#i-info');
      runChain(i + 1, (r && r.error) ? t('stt.convFail', { x: r.error }) : why);
    };
    if (!chain.length) { finishIdle(t('stt.noEngineApp')); return; }
    runChain(0, '');
  }

  /* نام مستعار — ضبط‌کنندهٔ تطبیقی مشترک همهٔ موتورهای ابری */
  const startCloudListen = startGoogleListen;

  /* --- موتور GLM-ASR: ضبط واقعی + ارسال به سرور + تبدیل به فرمان --- */
  function startGlmListen() {
    if (!glmReady()) { noEngine(t('stt.glmNeedKey')); return; }
    attachMic().then((ok) => {
      if (!ok) { noEngine(t('stt.micMissing')); return; }
      if (state !== 'listening') return;
      try {
        recChunks = [];
        glmSpoke = false;
        glmListening = true;
        glmRec = new MediaRecorder(micStream);
        glmRec.ondataavailable = (e) => { if (e.data && e.data.size) recChunks.push(e.data); };
        glmRec.onstop = finishGlmTranscribe;
        glmRec.start();
        statusText.textContent = t('stt.glmListen');
        /* تشخیص سکوت برای توقف هوشمند ضبط (با کمی تحمل تا بین کلمات قطع نشود) */
        glmSilentMs = 0;
        glmTimer = setInterval(() => {
          if (!glmListening || !micData) return;
          let sum = 0;
          for (let i = 0; i < micData.length; i++) sum += micData[i];
          const avg = sum / micData.length;
          if (avg > GLM_ON_LVL) {
            glmSpoke = true;
            glmSilentMs = 0;
            statusText.textContent = t('stt.glmHeard');
          } else if (glmSpoke) {
            glmSilentMs += 300;
            if (glmSilentMs >= 1300) stopGlmRec();
          }
        }, 300);
        glmMaxTimer = setTimeout(() => stopGlmRec(), GLM_MAX_MS);
      } catch (_) {
        noEngine(t('stt.startFail'));
      }
    });
  }

  function stopGlmRec() {
    clearInterval(glmTimer); clearTimeout(glmMaxTimer);
    glmTimer = null; glmMaxTimer = null;
    if (glmListening && glmRec && glmRec.state !== 'inactive') {
      try { glmRec.stop(); } catch (_) { finishGlmTranscribe(); }
    } else {
      glmListening = false;
    }
  }

  async function finishGlmTranscribe() {
    glmListening = false;
    glmRec = null;
    const blob = new Blob(recChunks, { type: (micRecMime() || 'audio/webm') });
    recChunks = [];
    if (!blob.size || blob.size < 900) {
      statusText.textContent = t('status.silence');
      setTimeout(() => { if (state === 'listening') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 1600);
      return;
    }
    setState('processing');
    statusText.textContent = t('stt.glmConv');
    try {
      const buf = new Uint8Array(await blob.arrayBuffer());
      const r = await bridge.stt.transcribe({ buf, base: settings.glmBase, key: settings.glmKey, model: ASR_MODEL });
      if (r && r.ok && r.text) {
        const tx = r.text.trim();
        if (dictation.active) dictateHandle(tx);
        else handleUtterance(tx);
      } else {
        setState('idle');
        statusText.textContent = t('stt.glmFail', { x: (r && r.error) || '—' });
        toast('GLM-ASR: ' + ((r && r.error) || '—'), '#i-info');
        if (dictation.active) setTimeout(rearmDictation, 1500);
      }
    } catch (_) {
      setState('idle');
      statusText.textContent = t('stt.glmConn');
      if (dictation.active) setTimeout(rearmDictation, 1500);
    }
  }

  function micRecMime() {
    if (typeof MediaRecorder === 'undefined') return '';
    for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']) {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m;
    }
    return '';
  }

  /* بریدن سکوت ابتدا/انتهای صدا → تشخیص سریع‌تر و دقیق‌تر
     (حالا برای موتور گوگل HTTP هم استفاده می‌شود) */
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
  function handleUtterance(text) {
    let cmd = text;
    if (settings.handsFree && settings.wakeWord && !dictation.active) {
      const m = text.match(/^\s*(هی\s+آوا|آوا\s?جان|آوا|اوا|آوای|اوای|ava)[\s،,:-]*(.*)$/i);
      if (!m) {
        /* بدون کلمه بیدارباش → نادیده بگیر و به گوش دادن ادامه بده */
        setState('idle');
        statusText.textContent = t('wake.need');
        handsFreeRearm();
        return;
      }
      cmd = (m[2] || '').trim();
      if (!cmd) {
        setState('idle');
        statusText.textContent = t('wake.yes');
        speak(t('wake.yes'));
        handsFreeRearm();
        return;
      }
    }
    runCommand(cmd, { wake: !!(settings.handsFree && settings.wakeWord && !dictation.active) });
  }

  /* در حالت بی‌دست، بعد از هر فرمان/خطا دوباره گوش می‌دهیم */
  function handsFreeRearm() {
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
    }, 700);
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
  }

  /* ============================================================
     حالت تایپ صوتی (v0.8) — «آوا تایپ» شروع، «آوا تموم»/«قطع تایپ» پایان
     هر جمله‌ای که گفته شود در کادر تایپ نوشته می‌شود (یا با پیست
     در همان برنامه‌ای که باز است). علائم نگارشی صوتی + فرمان‌های
     سفارشی تعریف‌شدنی در تنظیمات.
     ============================================================ */
  const dictation = { active: false, busy: false };

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
    /* خروجی در برنامه فعال: فقط بخش تازه‌اضافه‌شده در همان پنجره تایپ می‌شود */
    if (settings.dictTarget === 'apps' && delta.trim() && bridge && bridge.system && bridge.system.typeText) {
      bridge.system.typeText(delta).catch(() => { /* noop */ });
    }
    rearmDictation();
  }

  function startDictation() {
    dictation.active = true;
    showView('dict');
    updateDictToggleUI();
    renderDictation();
    toast(t('dict.on'), '#i-note');
    speak(t('dict.onSpeak'));
    if (state === 'idle') startListening();
    else if (state === 'listening') { stopListening(); setTimeout(() => { if (dictation.active && state === 'idle') startListening(); }, 300); }
    else setTimeout(() => { if (dictation.active && state === 'idle') startListening(); }, 1500);
  }

  function stopDictation(voice = false) {
    dictation.active = false;
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

  /* ---------- گوش دادن ---------- */
  let listenTimer = null;
  function startListening() {
    if (state === 'processing') return;
    if (state === 'listening') return; /* از بی‌دست دوباره فراخوانی شده */
    clearTimeout(listenTimer);
    setState('listening');
    body.classList.remove('has-card');
    respCard.classList.remove('show');
    sbMic.innerHTML = `<i class="dot rec"></i>${t('mic.rec')}`;
    gotFinal = false;
    setLiveText(t('live.on')); /* زیر دکمه ضبط: «در حال شنیدن…» تا اولین کلمه */
    stopGoogleSpeak(); /* اگر آوا مشغول حرف زدن بود، ساکت شود تا گوش دهد */
    attachMic();
    /* اگر کانتکست صوتی معلق بود، اینجا بیدارش می‌کنیم تا ضبط شروع شود */
    if (audioCtx && audioCtx.state === 'suspended') { try { audioCtx.resume(); } catch (_) { /* noop */ } }

    /* سگ‌بان امنیتی: اگر ۳۵ ثانیه گوش دادیم و هیچ موتوری هیچ کاری نکرد،
       آیکون و وضعیت را خودمان به حالت اولیه برمی‌گردانیم (فیکس «گیر می‌کند») */
    listenTimer = setTimeout(() => {
      if (state !== 'listening') return;
      setState('idle');
      setLiveText('');
      statusText.innerHTML = IDLE_HINT;
      sbMic.innerHTML = `<i class="dot ok"></i>${t('mic.ready')}`;
    }, 35000);

    const eng = resolveEngine();
    if (eng === 'web') {
      try {
        recEpoch += 1; /* جلسه جدید — رویدادهای جلسه قبلی باطل می‌شوند */
        rec = makeRec();
        statusText.textContent = t('status.listening');
        recActive = true;
        rec.start();
        return;
      } catch (_) {
        /* استارت موتور وب شکست خورد → زنجیره ادامه پیدا کند */
        srBroken = true;
        refreshEngineUI();
        if (googleReady()) { startGoogleListen(); return; }
        if (glmReady()) { startGlmListen(); return; }
        noEngine(t('stt.noEngineApp'));
        return;
      }
    }
    if (eng === 'google') {
      startGoogleListen();
      return;
    }
    if (eng === 'glm') {
      startGlmListen();
      return;
    }
    noEngine(t('stt.noEngineApp'));
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
    clearInterval(glmTimer); clearTimeout(glmMaxTimer);
    glmTimer = null; glmMaxTimer = null;
    glmListening = false;
    setLiveText('');
    if (rec && recActive) { try { rec.stop(); } catch (_) { /* noop */ } }
    recActive = false;
    if (glmRec && glmRec.state !== 'inactive') {
      /* جلوی ادامه فرایند تبدیل را می‌گیریم */
      glmRec.onstop = null;
      try { glmRec.stop(); } catch (_) { /* noop */ }
    }
    glmRec = null;
    if (gRec) {
      const g = gRec;
      gRec = null;
      try { g.proc.disconnect(); } catch (_) { /* noop */ }
      try { g.src.disconnect(); } catch (_) { /* noop */ }
      try { g.sink.disconnect(); } catch (_) { /* noop */ }
    }
    clearTimeout(gMaxT); gMaxT = null;
    /* میکروفون روشن می‌ماند تا اکولایزر همیشه به صدای واقعی واکنش نشان دهد */
    setState('idle');
    sbMic.innerHTML = `<i class="dot ok"></i>${t('mic.ready')}`;
    if (reset) {
      statusText.innerHTML = IDLE_HINT;
    }
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
      if (dnsQuickEl && !dnsQuickEl.hidden) closeDnsQuickOverlay();
      if (dnsPingEl && !dnsPingEl.hidden) closeDnsPingOverlay();
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

  /* ---------- آیتم‌های قفل‌شده سایدبار ---------- */
  document.querySelectorAll('.rail-item.locked').forEach((b) =>
    b.addEventListener('click', () => toast(t('toast.locked'), '#i-info'))
  );

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
      try { tm.textContent = fmtTime(); } catch (_) { tm.textContent = ''; }
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
  let appVersion = '0.17.0';

  /* پنل فعال تنظیمات (v0.9 — ناوبری لیستی سمت چپ) */
  const setNavItems = [...document.querySelectorAll('.set-nav-item')];
  const setPanes = [...document.querySelectorAll('.set-pane')];
  function showSettingsPane(id) {
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
      dx: Number(settings.discordCallDx) || 46,
      dy: Number(settings.discordCallDy) || 52,
    };
  }
  async function runDiscordCmd(action, name, okMsg, userId) {
    if (!bridge || !bridge.discord) return toast('کنترل دیسکورد فقط داخل نرم‌افزار ویندوزی کار می‌کند', '#i-info');
    toast(t('disc.working'), '#i-smile');
    const r = await bridge.discord.cmd({ action, name, userId, ...discordCtx() }).catch((e) => ({ ok: false, error: String(e) }));
    if (r && r.ok) {
      /* شفاف‌سازی: در حالت بک‌گراند کلیدها به دیسکورد فرستاده می‌شوند ولی
         قابل تأیید نیست — اگر اثری دیدی نشد، حالت بک‌گراند را خاموش کن */
      const res = String((r && r.result) || '');
      if (res === 'OK:DM_OPENED') toast(t('disc.dmOnly'), '#i-info');
      else toast(okMsg || t('disc.done'), '#i-check');
    } else toast((r && r.error) || t('disc.fail'), '#i-info');
    return r;
  }
  /* یافتن مخاطب از نام گفته‌شده — تطبیق دقیق، شروع، و شامل‌بودن دوطرفه */
  function resolveDiscordContact(spoken) {
    const list = Array.isArray(settings.discordContacts) ? settings.discordContacts : [];
    if (!spoken) return null;
    const s = String(spoken).trim().toLowerCase().replace(/[\u200c\s]+/g, ' ');
    if (!s) return null;
    let hit = list.find((c) => String(c.name).trim().toLowerCase() === s);
    if (hit) return hit;
    hit = list.find((c) => String(c.name).trim().toLowerCase().startsWith(s) || s.startsWith(String(c.name).trim().toLowerCase()));
    if (hit) return hit;
    hit = list.find((c) => s.includes(String(c.name).trim().toLowerCase()) || String(c.name).trim().toLowerCase().includes(s));
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
  const btnDcCall = $('#btnDcCall');
  const dcCallName = $('#dcCallName');
  if (btnDcCall) btnDcCall.addEventListener('click', async () => {
    const nm = (dcCallName && dcCallName.value || '').trim();
    if (!nm) { toast(t('disc.needName'), '#i-info'); return; }
    const ct = resolveDiscordContact(nm);
    await runDiscordCmd('call', ct ? ct.name : nm, t('disc.calling', { x: ct ? ct.name : nm }), ct ? ct.userId : '');
  });
  /* دکمهٔ باز کردن تنظیمات دیسکورد از کارت افزونه */
  const btnDcSettings = $('#btnDcSettings');
  if (btnDcSettings) btnDcSettings.addEventListener('click', () => {
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
    if (!bridge || !bridge.discord) return toast('فقط داخل نرم‌افزار ویندوزی کار می‌کند', '#i-info');
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
    optAutoUpdate.checked = !!settings.autoUpdate;
    optDemo.checked = !!settings.demoMode;
    optSttEngine.value = settings.sttEngine || 'auto';
    if (optSttLang) optSttLang.value = settings.sttLang || 'fa-IR';
    if (optLang) optLang.value = settings.lang || 'fa';
    if (optTheme) optTheme.value = settings.theme || 'dark';
    if (optDictTarget) optDictTarget.value = settings.dictTarget || 'box';
    optGlmKey.value = settings.glmKey || '';
    optGoogleKey.value = settings.googleKey || '';
    optAiModel.value = settings.glmModel || 'glm-4.6';
    if (optTtsEngine) optTtsEngine.value = settings.ttsEngine || 'google';
    if (optAiProvider) optAiProvider.value = settings.aiProvider || 'auto';
    if (optGeminiKey) optGeminiKey.value = settings.geminiKey || '';
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

  if (optTtsEngine) optTtsEngine.addEventListener('change', () => {
    settings.ttsEngine = optTtsEngine.value === 'windows' ? 'windows' : 'google';
    store.set('ttsEngine', settings.ttsEngine);
    stopGoogleSpeak();
    if (window.speechSynthesis) speechSynthesis.cancel();
    speak(t(settings.ttsEngine === 'google' ? 'voice.gEng' : 'voice.wEng'));
  });
  if (optAiProvider) optAiProvider.addEventListener('change', () => {
    settings.aiProvider = optAiProvider.value || 'auto';
    store.set('aiProvider', settings.aiProvider);
    toast(t('toast.saved'), '#i-spark');
  });
  if (optGeminiKey) optGeminiKey.addEventListener('change', () => {
    settings.geminiKey = optGeminiKey.value.trim();
    store.set('geminiKey', settings.geminiKey);
  });
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

  optDemo.addEventListener('change', () => {
    settings.demoMode = optDemo.checked;
    store.set('demoMode', settings.demoMode);
    refreshEngineUI();
    toast(settings.demoMode ? t('toast.demoOn') : t('toast.demoOff'), '#i-info');
  });

  optGoogleKey.addEventListener('change', () => {
    settings.googleKey = optGoogleKey.value.trim();
    store.set('googleKey', settings.googleKey);
    refreshEngineUI();
    toast(settings.googleKey ? t('toast.gKeySaved') : t('toast.gKeyCleared'), '#i-key');
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
      toast('در حال نصب نسخه جدید… برنامه راه‌اندازی مجدد می‌شود', '#i-download');
      bridge.updater.install();
    } else if (bridge && bridge.updater) {
      toast(t('upd.downloadingToast', { x: faNum(updVersion || '') }), '#i-download');
      bridge.updater.check().catch(() => {});
    } else {
      toast('آپدیت خودکار فقط داخل نرم‌افزار ویندوزی کار می‌کند', '#i-refresh');
    }
  });

  function setUpdUI(s) {
    updProgress.hidden = true;
    btnInstallUpdate.hidden = true;
    if (btnManualDl) btnManualDl.hidden = true;
    if (btnCheckUpdate) btnCheckUpdate.disabled = false;
    switch (s && s.state) {
      case 'checking':
        updNote.textContent = t('upd.checking');
        break;
      case 'available':
        updNote.textContent = t('upd.available', { x: faNum(s.version || '') });
        updProgress.hidden = false;
        updBar.style.width = '6%';
        setBadge('available', s.version);
        break;
      case 'available-manual':
        updNote.textContent = t('upd.availableManual', { x: faNum(s.version || '') });
        if (btnManualDl) btnManualDl.hidden = false;
        setBadge('available', s.version);
        break;
      case 'downloading':
        updNote.textContent = t('upd.downloading', { x: faNum(s.percent || 0) });
        updProgress.hidden = false;
        updBar.style.width = `${Math.max(4, s.percent || 0)}%`;
        setBadge('downloading', s.version, s.percent);
        break;
      case 'ready':
      case 'ready-manual':
        updNote.textContent = t('upd.ready', { x: faNum(s.version || '') });
        btnInstallUpdate.hidden = false;
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
    btnInstallUpdate.addEventListener('click', () => {
      toast('در حال نصب نسخه جدید… برنامه راه‌اندازی مجدد می‌شود', '#i-download');
      bridge.updater.install();
    });
    if (btnManualDl) btnManualDl.addEventListener('click', async () => {
      btnManualDl.disabled = true;
      toast(t('upd.directDlToast'), '#i-download');
      const r = await bridge.updater.downloadManual().catch(() => ({ ok: false }));
      btnManualDl.disabled = false;
      if (r && (r.ok || r.dev || r.latest)) return;
      toast((r && r.error) ? `خطا: ${r.error}` : t('upd.manualFailToast'), '#i-info');
    });
  } else {
    btnCheckUpdate.addEventListener('click', () => toast('آپدیت خودکار فقط داخل نرم‌افزار ویندوزی کار می‌کند', '#i-refresh'));
    btnInstallUpdate.addEventListener('click', needApp);
  }

  /* --- پیوندها (باز شدن در مرورگر پیش‌فرض) --- */
  document.querySelectorAll('#settingsPage [data-url]').forEach((b) =>
    b.addEventListener('click', async () => {
      const url = b.dataset.url;
      if (bridge && bridge.system && bridge.system.openUrl) {
        const r = await bridge.system.openUrl(url);
        if (!r || !r.ok) toast('باز کردن لینک ممکن نشد', '#i-info');
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
  const AI_SYSTEM_FA =
    'تو مغز دستیار صوتی فارسی «آوا» هستی که روی ویندوز اجرا می‌شود و به فرمان‌های کاربر گوش می‌دهی.\n' +
    'همیشه فارسی، کوتاه (حداکثر ۳ جمله)، دوستانه و مفید جواب بده.\n' +
    'اگر کاربر خواست کاری/فرمانی جدید به برنامه اضافه شود، یا درخواستش قابل تبدیل به یک فرمان سیستم باشد،\n' +
    'در انتهای پاسخ این بلوک را اضافه کن (وگرنه هیچ بلوکی ننویس):\n' +
    '<<<ADD>>>\n' +
    '{"title":"نام کوتاه فرمان","phrases":["عبارتی که کاربر می‌گوید"],"action":{"type":"...","value":"..."}}\n' +
    '<<<END>>>\n' +
    'قواعد action:\n' +
    '- type=open_url: باز کردن وب‌سایت؛ value آدرس کامل https\n' +
    '- type=run: اجرای فرمان آماده؛ value یکی از: open_chrome, open_notepad, open_calc, open_explorer, open_vscode, open_taskmgr, open_settings, open_paint, open_youtube, open_music, open_downloads, open_documents, minimize_all, lock, screenshot, vol_up, vol_down, vol_mute, vol_set, recycle_empty\n' +
    '- type=ps: اسکریپت کوتاه تک‌خطی و غیرمخرب PowerShell\n' +
    'مثال: اگر کاربر گفت «فرمان باز کردن تلگرام بساز»، بلوک را با open_url و آدرس https://web.telegram.org بساز.';
  const AI_SYSTEM_EN =
    'You are the AI brain of AVA, a Persian/English voice assistant for Windows.\n' +
    'Reply in the user\'s language, short (max 3 sentences), friendly and helpful.\n' +
    'If the user wants a new app command, append this block at the end (otherwise write no block):\n' +
    '<<<ADD>>>\n' +
    '{"title":"Short command name","phrases":["spoken phrase"],"action":{"type":"...","value":"..."}}\n' +
    '<<<END>>>\n' +
    'action rules:\n' +
    '- type=open_url: open a website; value is a full https URL\n' +
    '- type=run: run a built-in command; value one of: open_chrome, open_notepad, open_calc, open_explorer, open_vscode, open_taskmgr, open_settings, open_paint, open_youtube, open_music, open_downloads, open_documents, minimize_all, lock, screenshot, vol_up, vol_down, vol_mute, vol_set, recycle_empty\n' +
    '- type=ps: short single-line non-destructive PowerShell script\n' +
    'Example: "make a command to open Telegram" → block with open_url and https://web.telegram.org';
  const aiSystem = () => (LANG === 'en' ? AI_SYSTEM_EN : AI_SYSTEM_FA);

  let chatBusy = false;
  let chatHist = [];   // تاریخچه گفتگو برای حافظه کوتاه
  let zaiToken = '';   // توکن نشست حساب z.ai — از webview خوانده می‌شود

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
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
    return m;
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

  /* --- تب‌های چت: چت سریع / صفحه GLM --- */
  function selectChatTab(which) {
    const zai = which === 'zai';
    if (tabQuick) tabQuick.classList.toggle('active', !zai);
    if (tabZai) tabZai.classList.toggle('active', zai);
    if (quickWrap) quickWrap.hidden = zai;
    if (zaiWrap) zaiWrap.hidden = !zai;
    if (zai) setTimeout(() => checkZaiToken(), 900);
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
          setZaiBadge(true);
        } else {
          zaiToken = '';
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
  async function aiAsk(text) {
    const msgs = [{ role: 'system', content: aiSystem() }, ...chatHist.slice(-8), { role: 'user', content: text }];
    const prov = settings.aiProvider || 'auto';
    let lastErr = null;

    const tryZai = async () => {
      if (!bridge || !bridge.ai || !bridge.ai.zaiChat) return false;
      const r = await bridge.ai.zaiChat({ token: zaiToken || '', messages: msgs }).catch(() => null);
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
      return (await bridge.ai.chat({ base: settings.glmBase, key: settings.glmKey, model: settings.glmModel, messages: msgs }).catch(() => null)) || false;
    };
    const tryGemini = async () => {
      if (!settings.geminiKey || !bridge || !bridge.ai || !bridge.ai.gemini) return false;
      /* Gemini با ابزار جستجوی گوگل: سوال‌های «سرچ» جواب لحظه‌ای می‌گیرند
         مدل از تنظیمات (v0.13) — پیش‌فرض flash-latest (همیشه جدیدترین فلاش) */
      return (await bridge.ai.gemini({ key: settings.geminiKey, model: settings.geminiModel || 'gemini-flash-latest', messages: msgs, search: true }).catch(() => null)) || false;
    };
    const tryOpenai = async () => {
      if (!settings.openaiKey || !bridge || !bridge.ai || !bridge.ai.openai) return false;
      return (await bridge.ai.openai({ key: settings.openaiKey, model: settings.openaiModel || 'gpt-4o-mini', messages: msgs }).catch(() => null)) || false;
    };

    /* v0.17 — اولویت اول با جمنای (خواست کاربر) + برچسب موتور پاسخ‌دهنده */
    const tag = (r, via) => (r ? Object.assign({}, r, { via }) : r);
    if (prov === 'zai') { const r = await tryZai(); if (r) return tag(r, 'GLM'); }
    else if (prov === 'glm') { const r = await tryGlm(); if (r) return tag(r, 'GLM API'); }
    else if (prov === 'gemini') { const r = await tryGemini(); if (r) return tag(r, 'Gemini'); }
    else if (prov === 'openai') { const r = await tryOpenai(); if (r) return tag(r, 'OpenAI'); }
    else {
      /* خودکار: اول Gemini، بعد حساب GLM، بعد کلید GLM، در آخر OpenAI */
      let r = await tryGemini(); if (r) return tag(r, 'Gemini');
      r = await tryZai(); if (r) return tag(r, 'GLM');
      r = await tryGlm(); if (r) return tag(r, 'GLM API');
      r = await tryOpenai(); if (r) return tag(r, 'OpenAI');
    }

    if (!bridge || !bridge.ai) return { ok: false, error: 'چت با هوش مصنوعی فقط داخل نرم‌افزار ویندوزی کار می‌کند' };
    if (lastErr && lastErr.error) return lastErr;
    const needAny = !(settings.geminiKey || settings.openaiKey);
    if (needAny && prov !== 'gemini' && prov !== 'openai') {
      return { ok: false, needLogin: true, error: 'برای چت، اول در تب «صفحه چت GLM» وارد حسابت شو یا کلید Gemini/OpenAI را در تنظیمات بگذار' };
    }
    return { ok: false, error: 'هیچ‌کدام از موتورهای هوش مصنوعی جواب ندادند — کلیدها و اینترنت را بررسی کن' };
  }

  async function handleChatSend(v) {
    addMsg('user', v);
    chatHist.push({ role: 'user', content: v });
    const typing = addMsg('bot', t('chat.thinking'));
    typing.classList.add('typing');
    chatBusy = true;
    try {
      const r = await aiAsk(v);
      typing.remove();
      if (!r || !r.ok) {
        addMsg('err', (r && r.error) || t('chat.noReply'));
      } else {
        const { reply, add } = parseAdd(r.text);
        chatHist.push({ role: 'assistant', content: r.text });
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
  async function aiHandleCommand(cmd) {
    setState('processing');
    statusText.textContent = t('ai.asking');
    body.classList.add('has-card');
    rcHeard.textContent = `«${cmd}»`;
    respCard.classList.remove('show');
    void respCard.offsetWidth;
    respCard.classList.add('show');
    rcReply.textContent = '';
    rcTag.textContent = t('tag.ai');
    try {
      const r = await aiAsk(cmd);
      if (r && r.ok) {
        const { reply, add } = parseAdd(r.text);
        chatHist.push({ role: 'user', content: cmd }, { role: 'assistant', content: r.text });
        setState('success');
        statusText.textContent = t('ai.got');
        /* نشان موتور پاسخ‌دهنده — شفاف بودن اولویت جمنای */
        rcTag.textContent = (add ? t('tag.aiCmd') : t('tag.ai')) + (r.via ? ' · ' + r.via : '');
        typeText(rcReply, reply || '…');
        speak(reply);
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
        setState('success');
        statusText.textContent = r && r.needLogin ? t('ai.noConn') : t('ai.fail');
        rcTag.textContent = t('tag.ai');
        typeText(rcReply, (r && r.error) || t('chat.noReply'));
        pushHistory(cmd, false);
      }
    } catch (_) {
      setState('success');
      rcTag.textContent = t('tag.ai');
      typeText(rcReply, t('ai.err'));
      pushHistory(cmd, false);
    }
    handsFreeRearm();
    cmdBusy = false;
    setTimeout(() => {
      if (state === 'success') {
        setState('idle');
        statusText.innerHTML = IDLE_HINT;
      }
    }, 3000);
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

  /* --- پارسر ID3v2 (mp3) — عنوان، خواننده و کاور --- */
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

  async function readId3(file) {
    const out = { title: '', artist: '', album: '', cover: null };
    try {
      const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
      if (head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return out; /* «ID3» */
      const ver = head[3];
      const size = ((head[6] & 0x7f) << 21) | ((head[7] & 0x7f) << 14) | ((head[8] & 0x7f) << 7) | (head[9] & 0x7f);
      if (size < 10 || size > 3 * 1024 * 1024) return out;
      const buf = new Uint8Array(await file.slice(10, 10 + Math.min(size, 3 * 1024 * 1024)).arrayBuffer());
      const dv = new DataView(buf.buffer);
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
    music.view = music.tracks.filter((tr) => !q || (tr.title + ' ' + tr.artist + ' ' + tr.file.name).toLowerCase().includes(q));
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
      row.innerHTML =
        `<span class="m-idx num">${tIdx === music.cur && music.playing ? '<span class="eqbars"><i></i><i></i><i></i></span>' : faNum(tIdx + 1)}</span>` +
        `<span class="m-thumb">${tr.cover ? `<img src="${tr.cover}" alt=""/>` : '<svg class="ic"><use href="#i-music"/></svg>'}` +
        `<span class="m-hovplay"><svg class="ic"><use href="#i-play"/></svg></span></span>` +
        `<span class="m-tt"><b></b><span class="m-ar"></span></span>` +
        `<span class="m-dur num">--:--</span>`;
      row.querySelector('.m-tt b').textContent = tr.title;
      row.querySelector('.m-ar').textContent = tr.artist || tr.file.name.replace(/\.[^.]+$/, '');
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
      const tag = await readId3(tr.file);
      if (tag.title) tr.title = tag.title;
      if (tag.artist) tr.artist = tag.artist;
      if (tag.cover) tr.cover = tag.cover;
      since += 1;
      if (since % 4 === 0) renderMusicList();
    }
    renderMusicList();
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
      if (mArtist) mArtist.textContent = tr.artist || tr.file.name.replace(/\.[^.]+$/, '');
      if (mwTitle) mwTitle.textContent = tr.title;
      if (mwArtist) mwArtist.textContent = tr.artist || '';
      /* کاور */
      const coverHtml = tr.cover ? `<img src="${tr.cover}" alt=""/>` : '';
      if (mCover) {
        const old = mCover.querySelector('img');
        if (old) old.remove();
        if (tr.cover) mCover.insertAdjacentHTML('afterbegin', coverHtml);
      }
      if (mwCover) {
        const oldW = mwCover.querySelector('img');
        if (oldW) oldW.remove();
        if (tr.cover) mwCover.insertAdjacentHTML('afterbegin', coverHtml);
      }
      if (musicWidget) musicWidget.hidden = !settings.extMusic || music.widgetDismissedFor === music.cur; /* افزونهٔ موزیک خاموش یا با درگ بسته شده → مخفی */
    } else {
      if (musicWidget) musicWidget.hidden = true;
    }
    /* ردیف جاری در لیست — با شناسه واقعی آهنگ (فیکس جستجوی فعال) */
    if (mList) Array.from(mList.children).forEach((rowEl) => {
      const i = Number(rowEl.dataset.idx);
      rowEl.classList.toggle('current', i === music.cur);
      rowEl.classList.toggle('playing-row', playing && i === music.cur);
      const idx = rowEl.querySelector('.m-idx');
      if (idx) idx.innerHTML = i === music.cur && playing ? '<span class="eqbars"><i></i><i></i><i></i></span>' : faNum(i + 1);
    });
  }

  function playTrack(i) {
    if (!music.tracks.length) return;
    music.cur = ((i % music.tracks.length) + music.tracks.length) % music.tracks.length;
    music.widgetDismissedFor = null; /* آهنگ جدید → ویجت دوباره می‌آید */
    const tr = music.tracks[music.cur];
    try { mAudio.src = tr.url; mAudio.play(); } catch (_) { /* noop */ }
    mediaSessionMeta();
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
    mAudio.addEventListener('play', () => { music.playing = true; updatePlayerUI(); vizStart(); });
    mAudio.addEventListener('pause', () => { music.playing = false; updatePlayerUI(); vizStop(); });
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

  /* ---------- ویژوالایزر زندهٔ موزیک (v0.15) ----------
     AnalyserNode روی همان <audio>؛ فقط هنگام پخش رسم می‌شود (~۳۰fps برای CPU کم)
     و با کلیدهای بهینه‌سازی/تم سبک کلاً خاموش می‌ماند. */
  /* حالت viz بالای فایل اعلان شده (قبل از اولین applyPerf) — فیکس TDZ v0.16.2 */
  function vizEnsure() {
    if (vizAnalyser) return true;
    if (!mViz) return false;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      vizCtx = vizCtx || new AC();
      const src = vizCtx.createMediaElementSource(mAudio); /* فقط یک بار مجاز است */
      vizAnalyser = vizCtx.createAnalyser();
      vizAnalyser.fftSize = 256;
      vizAnalyser.smoothingTimeConstant = 0.82;
      src.connect(vizAnalyser);
      vizAnalyser.connect(vizCtx.destination);
      vizData = new Uint8Array(vizAnalyser.frequencyBinCount);
      return true;
    } catch (_) { vizAnalyser = null; return false; }
  }
  function vizResize() {
    if (!mViz) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = mViz.clientWidth || 480;
    const h = mViz.clientHeight || 64;
    if (mViz.width !== Math.round(w * dpr) || mViz.height !== Math.round(h * dpr)) {
      mViz.width = Math.round(w * dpr);
      mViz.height = Math.round(h * dpr);
    }
  }
  function vizDraw() {
    vizRaf = 0;
    if (!vizAnalyser || !mViz || mAudio.paused) { if (mViz) mViz.classList.remove('on'); return; }
    vizTick = !vizTick;
    if (vizTick) { vizRaf = requestAnimationFrame(vizDraw); return; } /* ~۳۰ فریم بر ثانیه */
    try {
      vizResize();
      const g = mViz.getContext('2d');
      const W = mViz.width, H = mViz.height;
      vizAnalyser.getByteFrequencyData(vizData);
      g.clearRect(0, 0, W, H);
      const acc = (getComputedStyle(document.body).getPropertyValue('--acc-rgb') || '16, 185, 129').trim();
      const bars = 52;
      const bw = W / bars;
      for (let i = 0; i < bars; i++) {
        const vi = Math.floor((i / bars) * vizData.length * 0.72); /* فرکانس‌های خیلی بالا را کنار می‌گذاریم */
        const v = (vizData[vi] || 0) / 255;
        const bh = Math.max(2 * (window.devicePixelRatio || 1), v * H * 0.88);
        const x = i * bw + bw * 0.2;
        const w2 = bw * 0.6;
        const grad = g.createLinearGradient(0, (H - bh) / 2, 0, (H + bh) / 2);
        grad.addColorStop(0, `rgba(${acc}, 0.95)`);
        grad.addColorStop(0.5, `rgba(${acc}, 0.38)`);
        grad.addColorStop(1, `rgba(${acc}, 0.95)`);
        g.fillStyle = grad;
        const y = (H - bh) / 2;
        if (g.roundRect) { g.beginPath(); g.roundRect(x, y, w2, bh, Math.min(w2 / 2, 4)); g.fill(); }
        else g.fillRect(x, y, w2, bh);
      }
    } catch (_) { /* noop */ }
    vizRaf = requestAnimationFrame(vizDraw);
  }
  function vizStart() {
    if (!mViz || settings.noFx || settings.noAnim || settings.theme === 'lite') { if (mViz) mViz.classList.remove('on'); return; }
    if (!vizEnsure()) return;
    try { if (vizCtx && vizCtx.state === 'suspended') vizCtx.resume().catch(() => {}); } catch (_) { /* noop */ }
    vizResize();
    mViz.classList.add('on');
    if (!vizRaf) vizRaf = requestAnimationFrame(vizDraw);
  }
  function vizStop() {
    if (vizRaf) { cancelAnimationFrame(vizRaf); vizRaf = 0; }
    if (mViz) mViz.classList.remove('on');
  }
  window.addEventListener('resize', () => { if (vizRaf) vizResize(); });

  async function handleMusicFolder(ev) {
    const files = Array.from((ev.target && ev.target.files) || []).filter((f) => AUDIO_EXT.test(f.name));
    ev.target.value = '';
    if (!files.length) { toast(t('music.none'), '#i-music'); return; }
    /* آزادسازی حافظه آهنگ‌های قبلی */
    music.tracks.forEach((tr) => { try { if (tr.url) URL.revokeObjectURL(tr.url); } catch (_) { /* noop */ } });
    mAudio.pause();
    mAudio.removeAttribute('src');
    music.tracks = files.map((f) => ({
      file: f,
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

  /* --- کمک‌کننده‌های فرمان صوتی موزیک --- */
  function voiceMusicPlay() {
    if (!music.tracks.length) { showView('music'); return t('music.emptyPlay'); }
    if (!mAudio.src) { playTrack(music.cur < 0 ? 0 : music.cur); return t('music.playing', { x: music.tracks[Math.max(0, music.cur)].title }); }
    if (mAudio.paused) { mAudio.play().catch(() => {}); return t('music.resumed'); }
    return t('music.playing', { x: music.tracks[music.cur].title });
  }
  function voiceMusicPause() {
    if (!music.tracks.length || mAudio.paused) return t('music.paused');
    mAudio.pause();
    return t('music.paused');
  }
  function voiceMusicNext() {
    if (!music.tracks.length) { showView('music'); return t('music.emptyPlay'); }
    musicNext();
    return t('music.next');
  }
  function voiceMusicPrev() {
    if (!music.tracks.length) { showView('music'); return t('music.emptyPlay'); }
    musicPrev();
    return t('music.prev');
  }

  if (btnMusic) btnMusic.addEventListener('click', () => showView(musicPage.hidden ? 'music' : 'home'));
  if (btnMusicBack) btnMusicBack.addEventListener('click', () => showView('home'));
  if (btnMusicFolder) btnMusicFolder.addEventListener('click', () => { if (mFolder) mFolder.click(); });
  if (mFolder) mFolder.addEventListener('change', handleMusicFolder);
  if (mPlayBtn) mPlayBtn.addEventListener('click', () => (music.tracks.length ? musicToggle() : (mFolder && mFolder.click())));
  if (mNextBtn) mNextBtn.addEventListener('click', () => musicNext());
  if (mPrevBtn) mPrevBtn.addEventListener('click', () => musicPrev());
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
  /* فرم شیشه‌ای DNS جدید — درخواست از پروسه اصلی (اگر از بیرون آمده باشد) */
  if (bridge && bridge.dns && bridge.dns.onQuickRequest) {
    bridge.dns.onQuickRequest(() => openDnsQuickOverlay());
  }
  /* یادآوری سر وقت: توست + بوق + گفتن بلند (تیک پس‌زمینه در پروسه اصلی است) */
  if (bridge && bridge.reminders && bridge.reminders.onDue) {
    bridge.reminders.onDue((r) => {
      const msg = t('rem.due', { x: (r && r.text) || '' });
      beep();
      toast(msg, '#i-timer');
      setState('success');
      statusText.textContent = t('timer.done');
      body.classList.add('has-card');
      rcHeard.textContent = t('timer.doneTag');
      rcTag.textContent = t('timer.doneTag');
      typeText(rcReply, msg);
      speak(msg);
      setTimeout(() => { if (state === 'success') { setState('idle'); statusText.innerHTML = IDLE_HINT; } }, 5000);
    });
  }
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
