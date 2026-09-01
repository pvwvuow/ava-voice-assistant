'use strict';
/* ============================================================
   آوا — voiceIntent.js (v0.43) — موتور داوری نیت
   ------------------------------------------------------------
   درخواست صریح کاربر: «نمیخام دونه دونه فیکس کنی کامند هارو…
   میخام کلا سیستم فرمان دهی و فرمان پذیریشو بهبود بدی»

   ریشهٔ معماری قدیم: RULES.find(r => r.k.test(cmd)) — «اولین قانون
   برنده است». نتیجه: هر بار یک جملهٔ تازه جای اشتباه می‌افتاد و
   رفع باگ یعنی جابه‌جایی دستی ترتیب قوانین — بی‌پایان.

   معماری جدید — داوری امتیازی:
   ۱) همهٔ قوانینِ منطبق (نه فقط اولی) کاندید می‌شوند.
   ۲) هر قانون در INTENT_TABLE می‌تواند سه چیز اعلان کند:
        anchors   — واژهٔ تعیین‌کنندهٔ نیت (+۲۶ امتیاز هر تطبیق)
        boosters  — واژه‌های پشتیبان (+۸)
        negatives — ممنوعهٔ مطلق (حذف کامل قانون برای این جمله)
   ۳) برندهٔ «قاطع» اجرا می‌شود؛ اگر دو نیت نزدیک باشند null برمی‌گردد
      تا جمله با «نامزدهای امتیازدار» به هوش مصنوعی برود — نه اقدام الکی.
   ۴) امتیاز پایهٔ انطباق k برابر ۴۰ است و غرامت ترتیب (۰٫۰۱×اولویت)
      فقط برای حالت تساوی کامل — لنگرها همیشه بر ترتیب می‌چربند.

   مثال‌های واقعی activity.log که همین ساختار ریشه‌ای حل می‌کند:
   • «توی یوتیوب برام آهنگ شادمهر پلی کن» → music_play ممنوعهٔ یوتیوب دارد
     → yt_search (لنگر یوتیوب + تقویت‌کنندهٔ پلی/آهنگ) برنده می‌شود
   • «گوگل کروم را برام باز کن» → open_chrome (لنگر کروم) بر web_search
   • «می‌خوام دستورات مربوط به یوتیوب رو ببینم» → ممنوعهٔ «دستورات» در
     yt_search/open_youtube → cmdpage برنده
   ============================================================ */
(function (root) {
  /* جدول نیت‌ها — کلید = id قانون در RULES (قوانین بدون مدخل فقط k معمولی) */
  const TABLE = {
    /* ---- یوتیوب/ویدیو ---- */
    yt_search: {
      anchors: [/یوتیوب|youtube/i],
      boosters: [/پخش|پلی\s?کن|بزن|بذار|آهنگ|ترانه|ویدیو|فیلم|سرچ|سیرچ|جستجو|بگرد/i],
      negatives: [/دستور|فرمان|کامند|توانایی|چی\s?بلدی/i],
    },
    pip_youtube: {
      anchors: [/یوتیوب|youtube/i, /شناور|فیپ|پی\s?ای\s?پی/i],
      negatives: [/دستور|فرمان|کامند/i],
    },
    open_youtube: {
      anchors: [/یوتیوب|youtube/i],
      boosters: [/باز\s?کن|برو|اجرا|بکن/i],
      /* v0.45 — فعلِ «بستن» باز کردن را می‌کُشد: «یوتیوب رو ببند» هرگز
         یوتیوب را باز نمی‌کند (ریشهٔ بازنگری کامل منطق — نیت مخالف
         با فعل بسته‌شدن به yt_close می‌رود) */
      negatives: [/دستور|فرمان|کامند|سرچ|جستجو|بگرد|پخش|پلی\s?کن|آهنگ|ترانه|شناور|فیپ|ببند|بس\s?بند|بس\s?کن|خاموش|قطع|استاپ|استوپ|پایان|بیرون/i],
    },
    /* v0.45 — نیت «بستن پخش» — قرینهٔ باز کردن: «یوتیوب رو ببند»،
       «پخش رو خاموش کن»، «از یوتیوب بیا بیرون» */
    yt_close: {
      anchors: [/ببند|بس\s?بند|بس\s?کن|خاموش|قطع|استاپ|استوپ|پایان|بیرون|close/i],
      boosters: [/یوتیوب|youtube|ویدیو|پخش|فیلم/i],
      negatives: [/باز\s?کن|اجرا\s?کن|برو\s?به\s?یوتیوب|پخش\s?کن/i],
    },
    /* ---- موزیک محلی — ممنوعهٔ یوتیوب/آپارات: ریشهٔ «توی یوتیوب آهنگ پلی کن
       که الکی پوشهٔ موزیک را باز می‌کرد» ---- */
    music_play: {
      anchors: [/پخش|پلی\s?کن|بزن|شروع|play/i],
      negatives: [/یوتیوب|youtube|آپارات|اپارات|aparat|دستور|فرمان|ببند|قطع|استاپ|استوپ|خاموش/i],
    },
    music_pause: { negatives: [/یوتیوب|youtube|آپارات|اپارات|aparat/i] },
    music_next:  { negatives: [/یوتیوب|youtube|آپارات|اپارات|aparat/i] },
    music_prev:  { negatives: [/یوتیوب|youtube|آپارات|اپارات|aparat/i] },
    music_page:  { negatives: [/یوتیوب|youtube/i] },
    /* v0.45 — «موزیک رو قطع کن» نباید صفحهٔ موزیک را «باز» کند —
       فعل بستن/توقف در open_music ممنوعه است تا music_pause برنده شود */
    open_music:  { negatives: [/یوتیوب|youtube|ببند|قطع|پاز|توقف|استاپ|استوپ|خاموش|پایان/i] },
    /* ---- وب/سایت ---- */
    web_search: {
      boosters: [/گوگل\s*(کن|بزن)|سرچ|سیرچ|جستجو|پیداش/i],
      negatives: [/یوتیوب|youtube|دستور|فرمان/i],
    },
    site_search: {
      anchors: [/سایت|وب\s?سایت/i],
      boosters: [/سرچ|سیرچ|جستجو|بگرد|پیدا|دنبال/i],
      negatives: [/یوتیوب|youtube|دستور|فرمان/i],
    },
    web_open: {
      anchors: [/سایت|وب\s?سایت|https?:\/\//i],
      negatives: [/یوتیوب|youtube|دستور|فرمان|سرچ|جستجو|بگرد|دنبال/i],
    },
    /* ---- برنامه‌ها ---- */
    open_chrome: {
      anchors: [/کروم|chrome/i],
      boosters: [/باز\s?کن|اجرا|برو/i],
    },
    open_firefox: {
      anchors: [/فایرفاکس|فایر\s?فاکس|firefox|موزیلا|mozilla/i],
      boosters: [/باز\s?کن|اجرا|برو/i],
    },
    open_edge: {
      anchors: [/\bاج\b|مایکروسافت\s?اج|edge/i],
      boosters: [/باز\s?کن|اجرا|برو/i],
      negatives: [/یوتیوب/i],
    },
    /* ---- پنجره‌های شناور — ممنوعهٔ «دستورات» ریشهٔ W8 ---- */
    pip: {
      negatives: [/دستور|فرمان|کامند/i],
    },
    cmdpage: {
      anchors: [/دستورات|فرمانها?|فرمان\u200cها?|کامندها?|لیست\s?(فرمان|دستور)|چه\s?کارایی|چی\s?بلدی|توانایی/i],
    },
    howto: {
      anchors: [/چ(?:جور|طور|گونه)|چطوری|how (do|can) i|چی\s?میتونی|توانایی|دستورات|فرمانها?/i],
    },
    /* ---- یوتیوب در خود آوا (v0.43) ---- */
    yt_watch: {
      anchors: [/یوتیوب|youtube|ویدیو|لینک/i],
      boosters: [/تو\s?(خودت|خودتت)|داخل\s?(خودت|آوا)|همینجا|نمایش|ببینم|باز\s?کن/i],
      negatives: [/سرچ|جستجو|بگرد|شناور|فیپ|دستور|فرمان/i],
    },
    /* ---- کنترل پلیرهای سیستم (v0.43) ---- */
    player_open: {
      anchors: [/وی\s?ال\s?سی|\bvlc\b|ام\s?پی\s?وی|\bmpv\b|پت\s?پلیر|potplayer|ام\s?پی\s?سی|mpc/i],
      boosters: [/پخش|پلی\s?کن|بذار|باز\s?کن|اجرا/i],
    },
    player_ctl: {
      anchors: [/برو\s?(جلو|عقب)|فوروارد|ریویند|پاز|فول\s?اسکرین|تمام\s?صفحه|استاپ|توقف\s?(پلیر|ویدیو|فیلم|آهنگ)/i],
      boosters: [/پلیر|پخش|ویدیو|فیلم|آهنگ|ثانیه|دقیقه/i],
      negatives: [/یوتیوب\s?(رو|را)?\s?(باز|برو)/i],
    },
    now_playing: {
      anchors: [/چی\s?(داره\s?)?پخش|چه\s?(آهنگی|ویدیویی|چیزی)\s?(داره\s?)?پخش|الان\s?چی\s?پخشه|چی\s?در\s?حال\s?پخش|whats? playing|now playing/i],
    },
    /* ---- پاور ---- */
    monitor_off: {
      anchors: [/مانیتور|نمایشگر|monitor|display|صفحه/i],
      boosters: [/خاموش|بی\s?نور|off/i],
    },
    sleep: {
      anchors: [/بخواب|خواب|sleep/i],
      negatives: [/تایمر|یادآوری|بیدار/i],
    },
    /* ---- پخش‌های دیسکورد/تایپ — ترتیب مهم، بدون مدخل ---- */
  };

  /* عبارت‌های سوءتفاهم‌خیز که «آهنگ/ویدیو» دارند ولی موزیکِ محلی نیستند
     (حفاظ دوم غیر از negatives هر قانون) */
  function tableFor(ruleId) { return Object.prototype.hasOwnProperty.call(TABLE, ruleId) ? TABLE[ruleId] : null; }

  /* امتیازدهی و داوری — RULES همان آرایهٔ قوانین app.js است.
     خروجی: { rule, ranked:[{rule,score}], decisive:boolean } یا null */
  function arbitrate(cmd, RULES, ctx) {
    const c = String(cmd || '');
    if (!c) return null;
    const ranked = [];
    for (let i = 0; i < RULES.length; i++) {
      const r = RULES[i];
      try {
        if (!r.k || !r.k.test(c)) continue;
        let s = 40 + Math.max(0, RULES.length - i) * 0.01;
        const t = r.id ? tableFor(r.id) : null;
        if (t) {
          let dead = false;
          for (const nx of (t.negatives || [])) { if (nx.test(c)) { dead = true; break; } }
          if (dead) continue;
          for (const ax of (t.anchors || [])) if (ax.test(c)) s += 26;
          for (const bx of (t.boosters || [])) if (bx.test(c)) s += 8;
        }
        ranked.push({ rule: r, score: s });
      } catch (_) { /* قانون خراب → نادیده */ }
    }
    if (!ranked.length) return null;
    ranked.sort((a, b) => b.score - a.score);
    const top = ranked[0];
    const second = ranked[1];
    /* قاطع: فقط یک کاندید، فاصلهٔ روشن از رتبهٔ دوم، یا رقابتِ واقعیِ
       نیت‌ها نیست (دو قانون بدون جدول = همان رفتار ترتیبی قدیم؛ امن و سریع).
       فقط وقتی «دو نیتِ ثبت‌شده» نزدیک‌اند کار به هوش مصنوعی می‌افتد. */
    const gap = second ? (top.score - second.score) : Infinity;
    const bothRegistered = !!(top.rule.id && tableFor(top.rule.id)) && !!(second && second.rule.id && tableFor(second.rule.id));
    const decisive = !second || gap >= 10 || !bothRegistered;
    return { rule: top.rule, ranked, decisive };
  }

  /* نامزدهای متنی برای AI — «یا این بود یا این؛ خودت انتخاب کن» */
  function candidatesText(arbit) {
    try {
      if (!arbit || !arbit.ranked || arbit.ranked.length < 2) return '';
      const rows = arbit.ranked.slice(0, 3)
        .filter((x) => x.rule && x.rule.id)
        .map((x) => x.rule.id + '(' + Math.round(x.score) + ')');
      if (rows.length < 2) return '';
      return '[نامزدهای تطبیق محلی — اگر درخواست کاربر یکی از این‌ها بود فقط run_cmd با همان id بده: ' + rows.join('، ') + ']';
    } catch (_) { return ''; }
  }


  /* ============================================================
     v0.49 — گیت نوع جمله (خواستهٔ صریح کاربر: «چرا طبق دستور عمل نمی‌کنه؟
     اگر هزار تا دستور باشه باید هزار تا رو دونه‌دونه بررسی کنیم؟ این اشتباهه»)
     ------------------------------------------------------------
     قانون عمومی، نه patch دونه‌دونه. جمله‌هایی که «اکشنِ کور» مجاز ندارند:
       ۱) سوال (چیه/چرا/کجا/چنده/اسمش…/؟)  → باید جواب بگیرد نه اجرا
       ۲) تصحیح (نه، منظورم… / اشتباه کردی…) → با زمینهٔ گفتگو به AI می‌رود
       ۳) چندمرحله‌ای (اول… بعد… / بعدش…)    → AI توالی می‌سازد
       ۴) «پیدا کن» بدون سرچ صریح           → AI بهترین مسیر را انتخاب می‌کند
       ۵) اسم/عبارت بدون هیچ فعلی (کوتاه)    → چت/سوال است نه فرمان
     فقط خانوادهٔ «اکشن» بلاک می‌شوند؛ سوال‌های راهنما (چطور/چی بلدی)،
     تایمر/یادآوری/DNS/rates و… مسیر خودشان را دارند و دست نمی‌خورند.
     AI قطع بود → رفتار قبلی (قانون محلی) تا کاربر بی‌جواب نماند.
     ============================================================ */
  const GATE_FAMILY = new Set(['open_music', 'yt_search', 'open_youtube', 'yt_watch', 'pip_youtube',
    'web_search', 'site_search', 'web_open', 'player_open', 'music_play',
    'music_pause', 'music_next', 'music_prev', 'music_page']);

  const GATE_Q_RE = /(چ\s?یه|چیه|چی\s?ست|چنده|کیه|کی\s?ه|کی\s?بود|کجاست|کجا\s?ه|کدوم|کدام|چرا|چطوری?|چگونه|اسمش|اسم\s?شون|اسماش|هست\s?[؟?]|است\s?[؟?]|[؟?])/;
  const GATE_IMP_RE = /(باز\s?کن|اجرا\s?کن|سرچ\s?کن|جستجو\s?کن|پخش\s?کن|پلی\s?کن|بذار|بزن|بگرد|پیدا\s?کن|ببند|خاموش\s?کن|تایمر|یادآوری|تنظیم\s?کن|ست\s?کن)/;
  const GATE_QSTRONG_RE = /(چیه|چی\s?ست|چرا|کجا|کدوم|چنده|اسمش|چطوری?|چگونه)/;
  const GATE_CORR_RE = /^(نه|نخیر|نه\s?بابا|نچ|منظورم|من\s?ظورم|اشتباه|غلط|این\s?نه|من\s?میگم|گفتم\s?که|والا|بجاش|برعکس|بذار\s?این)/;
  const GATE_CORR_IN_RE = /(منظورم\s?(این|اون)\s?بود|منظورم\s?نبود|اشتباه\s?کردی|غلط\s?کردی|نه\s?بابا|حرف\s?من\s?نبود)/;
  const GATE_MULTI_RE = /(اول[^.،؛]{0,50}بعد)|(بعد\s?(ازش|از\s?اون)|بعدش)|(و\s?بعد)/;
  const GATE_VERBISH_RE = /(کن|بکن|بزن|بذار|برو|بیا|بگرد|ببین|پخش|باز|اجرا|سرچ|جستجو|پیدا|تنظیم|خاموش|روشن|ببند|قطع|بده|بگو|بخون|بنویس|تایپ|اضافه|حذف|پین|شناور|بیار|ببر|پاک|قفل|ذخیره|بفرست|بگیر|چک|استارت|بساز)/;
  const GATE_FIND_RE = /(پیدا\s?کن|پیدا\s?کردن|برام\s?پیدا|بیار\s?ببینم)/;

  function gateType(cmd) {
    const s = String(cmd || '').trim();
    if (!s) return '';
    if (GATE_CORR_RE.test(s) || GATE_CORR_IN_RE.test(s)) return 'correction';
    if (GATE_MULTI_RE.test(s)) return 'multi-step';
    if (GATE_Q_RE.test(s) && !(GATE_IMP_RE.test(s) && !GATE_QSTRONG_RE.test(s))) return 'question';
    if (GATE_FIND_RE.test(s) && !/(سرچ|جستجو)/.test(s)) return 'smart-find';
    const toks = s.split(/[\s\u200C]+/);
    if (!GATE_VERBISH_RE.test(s) && toks.length <= 3 && s.length <= 18) return 'noun-phrase';
    return '';
  }
  function blocksActionRule(cmd, ruleId) {
    if (!ruleId || !GATE_FAMILY.has(String(ruleId))) return false;
    return !!gateType(cmd);
  }

  const api = { arbitrate, candidatesText, TABLE, gateType, blocksActionRule };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AVAIntent = api;
})(typeof window !== 'undefined' ? window : null);
