'use strict';
/* ============================================================
   آوا — voiceCore.js (v0.61) — «هستهٔ فهم» نسخهٔ ۲
   ------------------------------------------------------------
   درخواست صریح کاربر (لاگ activity.log — session ۰.۴۸ تا ۰.۶۰):
   «این چه معماریه که ما داریم برای پاسخ‌دهی؟ همش اشتباه می‌کنه.
    لطفاً دونه‌دونه اشتباهات رو فیکس نکن — ببین چه الگوریتمی،
    چه ساختاری بسازی که این مشکلات پیش نیاد.»

   تشخیص ریشه‌ای از لاگ واقعی (نه حدس):
   ۱) «همینو/اونو/همون آهنگ» → موتور قانون عبارتِ لخت را در یوتیوب
      سرچ می‌کرد (v0.53 سه نشت پشت‌سرهم) یا AI بدون تاریخچه «همینو»
      را جستجو می‌کرد.  → علت: هیچ ذخیره‌ای از «چی آخر سر گفتیم»
      وجود نداشت؛ نه برای قانون‌ها نه برای AI.
   ۲) «چرا توی یوتیوب سرچ کردی؟! گوگل گفته بودم» / «همون مدل موتوری
      که گفتیم» → علت: قانون ۹ِ پرامپت به AI می‌گفت «از تاریخچه حل
      کن» ولی تاریخچه اصلاً به AI چسبانده نمی‌شد!
   ۳) «هوای بجرا چطوره» → فهمید date — علت: قانون‌های بدون لنگر
      (امروز) زودتر از نیت واقعی برنده می‌شدند؛ داوری امتیازی فقط
      برای نیت‌های TABLE-دار معنا دارد.
   ۴) «ویدیو رو پلی کن» → اول نیت pip (ویدیوی شناور) می‌گرفت،
      شکست می‌خورد و ۶ ثانیه معطل AI می‌شد.

   پاسخ معماری — چهار ستون (همه در این فایل، همه تست‌پذیر):

   ستون ۱ — حافظهٔ گفتگو (ContextStore):
     آخرین ~۱۰ رد و بدل + «موجودیت‌های» آخرین موضوع به تفکیک دامنه
     (song/video/site/app/city/model/query/lastTitle). بعد از هر
     اجرا recordTurn() صدا می‌شود؛ هم قانون‌ها هم AI از همان
     یک حافظه تغذیه می‌شوند تا دو مغز از هم جدا نیفتند.

   ستون ۲ — حل‌گر ارجاع (resolveRefs):
     «همینو/همون آهنگ/اون مدل/اسمش» قبل از هر تصمیمی با موجودیتِ
     دامنهٔ خودش عوض می‌شود. اگر موجودیت نبود، اصلاً دست نمی‌زند و
     پرچم unresolved برمی‌گرداند (جمله به AI می‌رود، نه اجرای کور).
     این کلاسِ باگ را ریشه‌کن می‌کند: دیگر هیچ لایه‌ای «همینو» را
     به‌عنوان عبارت جستجو نمی‌بیند — چون متن ترمیم شده.

   ستون ۳ — مسیربینی دو لَین (laneOf):
     instant = مجموعهٔ بستهٔ فرمان‌های سیستمی (صدا/مدیا/پاور/تایمر/
       اپ معروف/دیکتهٔ یک‌باره/…) — محلی، آنی، آفلاین‌ساز.
     brain   = هر چیزی که «موضوع» دارد (سرچ/پخش با اسم/سوال/تصحیح/
       ارجاع/چندمرحله‌ای) — وقتی AI وصل است مستقیم به مغز ابری با
       تاریخچه می‌رود؛ قانون‌ها فقط فالبکِ آفلاین‌اند (وارونگیِ
       «قانون-اول» قدیم). همیشه دقیقاً یک لَین برمی‌گردد.

   ستون ۴ — بستهٔ زمینهٔ واحد (brainPack):
     فهرست فرمان‌ها + وضعیت + موجودیت‌ها + آخرین رد و بدل — یک
     بستهٔ استاندارد که هر مسیر AI همان را می‌گیرد؛ دیگر هیچ
     قانونی در پرامپت به حافظه‌ای که وجود ندارد ارجاع نمی‌دهد.

   این فایل بدون Electron است: در window می‌نشیند (root.AVACore)
   و در Node هم module.exports دارد تا کورپوس طلاییِ v0610 بدون
   اجرای اپ تست شود.
   ============================================================ */
(function (root) {
  /* ---------- نرمال‌سازی مشترک (هم‌خانوادهٔ voiceIntent) ---------- */
  function normFa(s) {
    return String(s || '')
      .replace(/[\u200c\u200f\u200e]/g, ' ')
      .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* ============================================================
     ستون ۱ — ContextStore
     ============================================================ */
  const MAX_TURNS = 12;
  const state = {
    turns: [],   /* [{u, via, intent, params, reply, at}] — تازه اول */
    entities: {  /* آخرین موجودیت هر دامنه — فقط رشتهٔ تمیز */
      song: '', video: '', site: '', app: '', city: '', model: '', query: '', lastTitle: '',
      /* v0.69 — موجودیت‌های «واقعیت‌های اخیر»: ریشهٔ لاگ Ali-HK
         («دو دقیقه بعد یادش رفته چی می‌گفتیم») — یادداشت، مقصد پیام،
         عنوان نتیجهٔ سرچ و نگاشت نام گفتاری↔نوشتاری ذخیره می‌شوند */
      note: '', msgTarget: '', msgApp: '', searchTitle: '', person: '',
    },
  };

  /* v0.69 — آشکارساز جملهٔ بی‌معنی (گیت کیفیت یادگیری)
     ریشهٔ لاگ: «دو تلیگرام بیدی بیدی بید» → open_url(web.telegram.org)
     «تو تهلگ روم بایم بایم بایم بایم بایم بایم» → ذخیرهٔ دائمیِ نویز STT.
     قاعده‌ها: تکرار متوالی توکن، نسبت توکن یکتا، و اجبارِ واژهٔ محتوادار. */
  function isGibberish(s) {
    const t = String(s || '').replace(/[\u200c\u200f\u200e]/g, ' ').trim();
    if (!t) return true;
    const toks = t.toLowerCase().split(/[\s،؛,.!؟?:]+/).filter(Boolean);
    if (!toks.length) return true;
    if (toks.length <= 2) return false; /* جملات خیلی کوتاه را قضاوت نمی‌کنیم */
    /* ۱) توکن تکراری متوالی (≥۲ بار پشت‌سرهم ×۲) */
    let maxRun = 1, run = 1;
    for (let i = 1; i < toks.length; i++) {
      run = (toks[i] === toks[i - 1]) ? run + 1 : 1;
      if (run > maxRun) maxRun = run;
    }
    if (maxRun >= 3) return true;
    /* ۲) نسبت یکتا — «بایم بایم بایم بایم» حتی غیرمتوالی هم زباله است */
    const uniq = new Set(toks).size;
    if (toks.length >= 5 && uniq / toks.length <= 0.4) return true;
    /* ۳) «بیدی بیدی بید» — جملات کوتاه با تکرارِ جفتی + تنوعِ کم
       (نویز STT واقعی لاگ: «دو تلیگرام بیدی بیدی بید») */
    if (toks.length >= 4 && maxRun >= 2 && uniq / toks.length <= 0.8) return true;
    return false;
  }

  /* v0.74 — آشکارساز گله/شکایت/گزارش خرابی (گیت کیفیت یادگیریِ دوم)
     ریشهٔ لاگ 0.73: «دهن منو سرویس کردی ..وقتی میگم علی تو باید یوزرش رو سرچ کنی
     توی دیسکورد چرا نمیفهمی» → open_app(Discord) به‌عنوان فرمان دائمی یاد گرفته شد!
     جملهٔ گلهٔ روان، نه gibberish است نه ارجاعی — پس گیت خودش لازم است. */
  const LEARN_COMPLAIN_RE = /(دهن\s*م(و|تو)?\s*(سرویس|انداخت|می|میزنی)|مسخره|سرکاری|هیچ\s*کاری\s*نمی|کار\s*نمی\s*کنه|کار\s*نمیکنه|نمی\s*فهمی|نمیفهمی|بلد\s*نیستی|بلد\s*نیس|گوش\s*نمیدی|توجه\s*نمی\s*کنی|حافظه\s*ندار|مموری\s*ندار|مموری\s*توجه|خراب\s*(شد|کردی|شده|شده‌ای)|درست\s*کار\s*نمی|درست\s*انجام\s*نمیده|اشتباه\s*می\s*کنی|فیکسش\s*کن|درستش\s*کن)/i;

  /* استخراج موجودیت از «متن» — بدون دانش بیرونی، فقط الگوهای فارسی امن */
  /* v0.66 — واژه‌های مجازِ حکمی/حرف اضافه که هرگز «عنوان» نیستند.
     ریشهٔ لاگ v0.65: «ویدیو رو پخش کن» → entities.video = «رو» ذخیره شد و
     بعداً «همین ویدیویی که یوتیوب دادم» با «رو» بازنویسی شد → «ویدیو رو یی»
     (جملهٔ خراب که AI را به video_play(youtube.com) فرستاد). */
  const ENTITY_STOP_RE = /^(رو|را|به|از|روی|توی|تو|برای|برا|کن|بکن|بزن|بده|بیار|ببر|بذار|بزار|پخش|باز|پاز|ببند|استاپ|استوپ|پلیر|مدیا|بالا|پایین|کوچک|بزرگ|کم|زیاد|من|تو|ما|این|اون|همین|همون|که|ویدیو|فیلم|کلیپ|آهنگ|موزیک|یوتیوب|گوگل|لینک|کپی|دادم|کردم|گفتم|بعدی|قبلی|جدید|جدیدترین|اول|بعد|دیگه|فقط|یه|یک)$/i;
  /* v0.75 — گارد ارزشِ موجودیت (ریشهٔ لاگ میدانی 0.73/0.74): موجودیت‌ها با فیلر/فعل/زبالهٔ STT
     آلوده می‌شدند («باور کن»، «آمده‌ای»، «صد» — بریدهٔ صدرا) و بعد حل‌گرِ ارجاع «همینو» را با
     همین آشغال‌ها بازنویسی می‌کرد («همینو برام تو یوتیوب پیدا کن» → «باور کن برام…») و پارسهٔ
     جمله نابود می‌شد. قاعده: هرگز «به بهتر از نبودن» — مقدارِ مشکوک اصلاً ذخیره/استفاده نمی‌شود. */
  const ENTITY_VALUE_BAD_RE = /^(?:باور\s*کن|آمده\s*ای|رفته\s*ای|گفته\s*ای|دیده\s*ای|سلام|تست|هیچ|چیز|چیزی|خب|خوب|آره|اره|نه|باشه|اوکی|اکی|حالا|الان|ببین|ببینید|بیا|برو|بریم|فکر\s*کن|یعنی|مثلا|مثلاً|فقط|خیلی|کاملا|صد|دویست|سیصد|چهارصد|پانصد|پنجصد|ششصد|هفتصد|هشتصد|نهصد|هزار|میلیون|ده|بیست|سی|چهل|پنجاه|شصت|هفتاد|هشتاد|نود|یکی|دوتا)$/i;
  function entityOk(v) {
    const s = String(v || '').replace(/[\u200c\u200f\u200e]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s) return false;
    if (s.replace(/\s+/g, '').length < 3) return false; /* «صد»، «رو» … */
    if (ENTITY_VALUE_BAD_RE.test(s)) return false;
    if (ENTITY_STOP_RE.test(s)) return false;
    if (isGibberish(s)) return false; /* زبالهٔ STT */
    return true;
  }
  function extractFromText(text) {
    const s = normFa(text);
    const out = {};
    let m = s.match(/(?:آهنگ|ترانه|موزیک)\s+(?:جدید\s+|جدیدترین\s+| جدید\s+)?([\u0600-\u06FF\u200c]{2,30})/);
    if (m && m[1] && !ENTITY_STOP_RE.test(m[1].trim())) out.song = m[1].trim();
    m = s.match(/(?:ویدیو|فیلم|کلیپ)\s+([\u0600-\u06FF\u200c0-9]{2,30})/);
    if (m && m[1] && !ENTITY_STOP_RE.test(m[1].trim())) out.video = m[1].trim();
    m = s.match(/(?:هوا[یی]?|آب\s?و\s?هوای?)\s+([\u0600-\u06FF]{2,20})/);
    if (m && m[1] && !/^(چطور|چنده|چی|خوبه|برفی|بارونی)/.test(m[1])) out.city = m[1].trim();
    m = s.match(/(?:مدل|موتور)\s+([\u0600-\u06FF0-9\s]{2,40}?)(?=\s|$)/);
    if (m && m[1]) out.model = m[1].trim().slice(0, 40);
    return out;
  }

  /* ثبت یک رد و بدل کامل — بعد از اجرا در app.js صدا زده می‌شود.
     intent/params از هر مسیری می‌آید (rule یا AI) — یک حافظه، دو مغز. */
  function recordTurn(o) {
    try {
      const t = {
        u: String((o && o.utterance) || '').slice(0, 300),
        via: String((o && o.via) || '').slice(0, 24),
        intent: String((o && o.intent) || '').slice(0, 40),
        params: (o && o.params && typeof o.params === 'object') ? o.params : null,
        reply: String((o && o.reply) || '').slice(0, 300),
        at: Date.now(),
      };
      if (!t.u && !t.reply) return;
      state.turns.unshift(t);
      if (state.turns.length > MAX_TURNS) state.turns.length = MAX_TURNS;
      /* موجودیت‌ها: از params صریح + از متن کاربر + از تیترِ داخل پاسخ */
      const pu = {};
      if (t.params) {
        if (t.params.q) pu.video = String(t.params.q);
        if (t.params.city) pu.city = String(t.params.city);
        if (t.params.app) pu.app = String(t.params.app);
        if (t.params.site) pu.site = String(t.params.site);
        if (t.params.wake) { state.entities.wake = String(t.params.wake); }
        /* v0.69 — واقعیت‌های اخیر از پارامترهای صریح هر لاین */
        if (t.params.noteText) state.entities.note = String(t.params.noteText).slice(0, 200);
        if (t.params.msgTarget) state.entities.msgTarget = String(t.params.msgTarget).slice(0, 80);
        if (t.params.msgApp) state.entities.msgApp = String(t.params.msgApp).slice(0, 20);
        if (t.params.searchTitle) state.entities.searchTitle = String(t.params.searchTitle).slice(0, 120);
        if (t.params.person) state.entities.person = String(t.params.person).slice(0, 80);
      }
      /* v0.69 — واژه‌سازی موجودیت از لاین‌های شناخته‌شده (یک حافظه، همهٔ مغزها) */
      const vi = t.via + '/' + t.intent;
      if (/messaging\/msg_send|msg_test/.test(vi) && t.u) {
        const mm = t.u.match(/(?:به|برای|برا)\s+([^\s][\u0600-\u06FFa-zA-Z0-9._@\s]{1,40}?)(?=\s+(?:پیام|پیغام|بگو|بنویس|بفرست)|$)/i);
        if (mm && mm[1] && !/^(همین|همون|بهش|براش|اون)/i.test(mm[1].trim())) {
          /* v0.75 — بریدن در حرف اضافهٔ مکان: «صدرا تو دیسکورد» هرگز یکجا مقصد نمی‌شود */
          const _mt = mm[1].trim().replace(/\s+(?:تو|توی|در|با)\s+[\u0600-\u06FFa-zA-Z]+[\s\S]*$/i, '').trim();
          if (_mt && entityOk(_mt)) { state.entities.msgTarget = _mt.slice(0, 80); }
        }
      }
      Object.assign(pu, extractFromText(t.u));
      const intent = t.intent || '';
      if (/yt_search|yt_play|youtube/.test(intent) && t.params && t.params.q) pu.video = String(t.params.q);
      if (/music_play/.test(intent) && t.params && t.params.q) pu.song = String(t.params.q);
      if (/web_search/.test(intent) && t.params && t.params.q) pu.query = String(t.params.q);
      if (/weather/.test(intent)) { const e = extractFromText(t.u); if (e.city) pu.city = e.city; }
      if (t.reply) {
        const q = t.reply.match(/«([^»]{2,60})»/);
        if (q && q[1]) state.entities.lastTitle = q[1].trim();
      }
      for (const k of Object.keys(pu)) {
        const v = String(pu[k] || '').trim().slice(0, 80);
        /* v0.75 — گارد ارزش: «باور کن/آمده‌ای/صد» هرگز موجودیت نمی‌شوند */
        if (v && entityOk(v)) state.entities[k] = v;
      }
    } catch (_) { /* حافظه هرگز نباید مسیر اجرا را بشکند */ }
  }

  /* ============================================================
     ستون ۲ — حل‌گر ارجاع (آنافور) — ترمیم متن قبل از هر تصمیم
     خروجی: { text, resolved:[{from,to,domain}], unresolved:boolean }
     ============================================================ */
  const REF_DOMAINS = [
    { domain: 'song',   re: /(همین|همون|همان|اون|این)?\s?(آهنگ|موزیک|ترانه)\s?(جدید(ش)?|جدیدترین(ش)?|قبلی(ش)?|اخری|آخرین)?(ش)?/i, key: (m) => (/جدید|اخر|آخر/.test(m) ? 'song' : 'song') },
    { domain: 'video',  re: /(همین|همون|همان|اون|این)?\s?(ویدیو|فیلم|کلیپ)/i },
    { domain: 'model',  re: /(همین|همون|همان|اون|این)?\s?(مدل|موتور)/i },
    { domain: 'site',   re: /(همین|همون|همان|اون|این)?\s?(سایت|وب\s?سایت)/i },
    { domain: 'city',   re: /(همین|همون|همان|اون|این)?\s?(شهر)/i },
    { domain: 'query',  re: /(همین|همون|همان|اون|این)?\s?(موضوع|مطلب)/i },
  ];
  /* ضمایرِ لختِ بدون دامنه — v0.69: دیگر هرگز بازنویسی نمی‌شوند؛ فقط حاشیه
     (ریشهٔ لاگ: بازنویسیِ لخت «میگم همون اسمی که یادداشت کردیم…» را به
     «میگم علی اچ کی وسطشم یه خط فاصله اسمی که…» نابود کرد) */
  const BARE_REF_RE = /(^|[\s،؛«"(])(همینو|همونو|اونو|اینو|همو|همین|همون|همان)(?=$|[\s،؛»").!؟?:،]|و)(?:\s?(رو|را|رو\s?بگرد|رو\s?پخش|رو\s?پلی))?/i;
  const POSSESS_REF_RE = /(^|[\s،؛«"(])(همینو?|همونو?|همان|اونو?|اینو?)\s?(اسمشو?|اسماشو?|اسمش)(?=$|[\s،؛»").!؟?:،])/i;
  /* v0.69 — «همین/همون + اسم» داخل جمله‌های پیام/یادداشت («به همین اسم پیام بده»)
     — حل‌گر لاین‌های قطعی از این الگو استفاده می‌کند */
  const REF_NOUN_RE = /(?:به|برای|برا|از)?\s*(همینو?|همونو?|همان|اونو?|اینو?)\s+(اسم|نام|مخاطب|شخص|یارو|فلانی)(?:\s*(رو|را))?/i;

  function pickEntity(key) {
    const e = state.entities;
    /* v0.75 — هر خروجی از گارد ارزش می‌گذرد؛ مقدارِ آلوده = نداشتنِ مقدار */
    const ok = (v) => (v && entityOk(v)) ? v : '';
    if (key === 'song') return ok(e.song) || ok(e.lastTitle) || ok(e.query);
    if (key === 'video') return ok(e.video) || ok(e.lastTitle) || ok(e.query);
    if (key === 'model') return ok(e.model);
    if (key === 'site') return ok(e.site);
    if (key === 'city') return ok(e.city);
    if (key === 'query') return ok(e.query) || ok(e.lastTitle);
    return ok(e.lastTitle) || ok(e.song) || ok(e.video) || ok(e.model) || ok(e.query);
  }

  function resolveRefs(cmd, opts) {
    const orig = String(cmd || '');
    /* v0.69 — hints: حاشیه‌های ارجاع (به AI می‌چسبند، جمله هرگز خراب نمی‌شود) */
    const out = { text: orig, resolved: [], unresolved: false, hints: [] };
    if (!orig.trim()) return out;
    let s = orig;
    /* v0.66 — حافظهٔ «آخرین لینک ویدیو» از app.js می‌آید (کلیپ‌بورد/لینک گفته‌شده/پخش‌شده).
       اگر جمله ارجاعِ لینک ویدیو دارد («همین ویدیویی که یوتیوب دادم»، «لینکی که کپی کردم»)،
       جمله هرگز با عنوانِ عنوان‌مانند بازنویسی نمی‌شود — لینک واقعی به‌عنوان سرنخ به همان جمله چسبانده می‌شود
       تا مغز AI لینک اصل را ببیند (لاگ: بازنویسیِ «همین ویدیویی» → «ویدیو رو یی» مسیر را خراب کرد). */
    const VIDEO_LINK_REF_RE = /(ویدیو|فیلم|کلیپ|لینک)[^.]{0,24}(یوتیوب|کپی|دادم|فرستادم|فرستاد)|لینک[^.]{0,16}(ویدیو|کپی)/i;
    /* فقط ارجاعِ «لینکِ داده‌شده» (کپی کردم/دادم/فرستادم) از بازنویسی مستثناست؛
       «این ویدیو یوتیوب برام پلی کن» هنوز ارجاعِ عنوان است و بازنویسی به آن کمک می‌کند
       (لاگ v0.62: «ویدیو شادمهر» جایگزین شد و به AI کمک کرد) */
    const LINK_GIVE_RE = /(کپی|دادم|فرستادم|فرستاد|کلیپ\s?بورد|clipboard)/i;
    const wantUrlHint = !!(opts && opts.videoUrl) && VIDEO_LINK_REF_RE.test(orig);
    const hit = (domain, from) => {
      const v = pickEntity(domain);
      if (!v || v === from || ENTITY_STOP_RE.test(String(v).trim())) return false;
      out.resolved.push({ from, to: v, domain });
      return v;
    };
    if (wantUrlHint) {
      /* بازنویسی ممنوع — فقط سرنخِ لینک؛ هیچ جایگزینیِ عبارت انجام نمی‌شود */
      s = s + ' (آخرین لینک ویدیو: ' + String(opts.videoUrl) + ')';
      out.resolved.push({ from: 'video-ref', to: String(opts.videoUrl), domain: 'video-url' });
      out.text = s;
      return out;
    }
    if (LINK_GIVE_RE.test(orig)) {
      /* v0.66 — جمله دربارهٔ «لینکی که کپی/فرستادم» است: هیچ بازنویسیِ موجودیتی
         (حتی ضمیرِ لخت) مجاز نیست؛ جملهٔ دست‌نخورده به AI می‌رود (تاریخچه + قانون
         __clipboard__ در پرامپت حلش می‌کند). ریشهٔ لاگ: «همین» → «شادمهر» جای
         لینک نشست و مسیر خراب شد. */
      out.text = s;
      return out;
    }
    /* ۱) «همون اسمش/اسمشو» — v0.69: حاشیه، نه بازنویسی (ریشهٔ لاگ:
       (last=کپی) و (model=نتیجه) جمله را می‌ساختند و مسیر را خراب)
       v0.69-نهایی — بازنویسی فقط برای مقادیر کوتاه (≤۳ کلمه، غیر-زباله)
       مجاز است تا کورپوس طلایی v0.61 سالم بماند؛ مقادیر بلند (تیتر یادداشت،
       جمله‌های چندکلمه‌ای) فقط حاشیه می‌شوند — ریشهٔ «میگم علی اچ کی
       وسطشم یه خط فاصله اسمی که…» (نابودی جمله با تیتر ۶کلمه‌ای) */
    const _wc = (x) => String(x || '').trim().split(/\s+/).filter(Boolean).length;
    const _shortOk = (v) => v && _wc(v) <= 3 && !ENTITY_STOP_RE.test(String(v).trim());
    let m = POSSESS_REF_RE.exec(s);
    if (m) {
      const v = pickEntity('song');
      if (_shortOk(v)) { s = s.replace(m[0], ' ' + v + ' ').replace(/\s+/g, ' ').trim(); out.resolved.push({ from: m[0].trim(), to: v, domain: 'title' }); }
      else if (v && !ENTITY_STOP_RE.test(String(v).trim())) out.hints.push('ارجاع «' + m[0].trim() + '» = ' + v);
      else out.unresolved = true;
    }
    /* ۲) «همون آهنگ جدیدش / همین ویدیو / اون مدل» — دامنه‌دار
       v0.66 — ارجاعِ «لینک/یوتیوب» (ویدیویی که دادم/کپی کردم) هرگز با عنوانِ
       ذخیره‌شده بازنویسی نمی‌شود: یا لینک واقعی به‌عنوان سرنخ چسبیده می‌شود
       (بالا) یا جمله دست‌نخورده به AI می‌رود که خودش با تاریخچه حل کند.
       (لاگ v0.65: «همین ویدیویی که یوتیوب دادم» → «ویدیو رو یی که…» = جملهٔ خراب) */
    if (!out.resolved.length && !LINK_GIVE_RE.test(orig)) {
      for (const d of REF_DOMAINS) {
        m = d.re.exec(s);
        if (m && /(همین|همون|همان|اون|این)/i.test(m[0]) && d.re.test(s)) {
          /* فقط وقتی ضمیرِ ارجاعی واقعاً در عبارت دامنه هست اجرا شود */
          const v = hit(d.domain, m[0]);
          if (v) { s = s.replace(m[0], (m[2] ? m[2] + ' ' : '') + v + ' ').replace(/\s+/g, ' ').trim(); break; }
        }
      }
    }
    /* ۳ب) «NOUN که گفتیم/گفتی» — بازنویسی فقط با مقدار کوتاه؛ بلند → حاشیه */
    if (!out.resolved.length) {
      const kn = s.match(/(مدل|موتور|آهنگ|ویدیو|فیلم|سایت|موضوع|مدل موتور)(ی)?\s?که\s?(گفتیم|گفتی|گفتید|بهم\s?گفتی)/i);
      if (kn) {
        const dom = /مدل|موتور/.test(kn[1]) ? 'model' : /آهنگ/.test(kn[1]) ? 'song' : /ویدیو|فیلم/.test(kn[1]) ? 'video' : /سایت/.test(kn[1]) ? 'site' : /یادداشت/.test(kn[1]) ? 'note' : /اسم|نام/.test(kn[1]) ? 'person' : 'query';
        const v = pickEntity(dom);
        if (_shortOk(v)) { s = s.replace(kn[0], kn[1] + ' ' + v).replace(/\s+/g, ' ').trim(); out.resolved.push({ from: kn[0], to: v, domain: dom }); }
        else if (v) out.hints.push('ارجاع «' + kn[0] + '» = ' + v);
        else out.unresolved = true;
      }
    }
    /* ۳آ) «به همین اسم / همون مخاطب» — v0.69: حاشیهٔ نام برای مغز (همیشه حاشیه —
       بازنویسی «به همین اسم» → «به علی اچ کی اسم» جمله را می‌شکند) */
    if (!out.resolved.length) {
      const rn = s.match(REF_NOUN_RE);
      if (rn) {
        const v = state.entities.msgTarget || state.entities.person || '';
        if (v) { out.hints.push('ارجاع «' + rn[0].trim() + '» = ' + v); out.resolved.push({ from: rn[0].trim(), to: v, domain: 'ref-noun' }); }
        else out.unresolved = true;
      }
    }
    /* ۳) ضمیرِ لخت «همینو/اونو» — بازنویسی فقط با مقدار کوتاه (رفتار v0.61)؛
       مقدار بلند → فقط حاشیه (ریشهٔ نابودیِ جمله با تیتر ۶کلمه‌ای) */
    if (!out.resolved.length && BARE_REF_RE.test(s)) {
      const v = pickEntity('');
      if (_shortOk(v)) { s = s.replace(BARE_REF_RE, ' ' + v + ' ').replace(/\s+/g, ' ').trim(); out.resolved.push({ from: 'bare-ref', to: v, domain: 'last' }); }
      else if (v) out.hints.push('ارجاع «' + (s.match(BARE_REF_RE) || [''])[0].trim() + '» = ' + v);
      else out.unresolved = true;
    }
    /* ۴) «همین که گفتی» — بازنویسی فقط با مقدار کوتاه؛ بلند → حاشیه */
    if (!out.resolved.length && /(همین|همون|همان|اون)\s?که\s?(گفتی|گفتیم|گفتید|بهم\s?گفتی)/i.test(s)) {
      const v = pickEntity('');
      if (_shortOk(v)) { s = s.replace(/(همین|همون|همان|اون)\s?که\s?(گفتی|گفتیم|گفتید|بهم\s?گفتی)/i, v).replace(/\s+/g, ' ').trim(); out.resolved.push({ from: 'ke-gofti', to: v, domain: 'last' }); }
      else if (v) out.hints.push('ارجاع «همین/همون که گفتیم» = ' + v);
      else out.unresolved = true;
    }
    out.text = s;
    return out;
  }

  /* v0.69 — «به همین اسم/همون مخاطب/بهش» برای لاین‌های قطعی — مقدارِ قابل‌ارسال
     برمی‌گرداند یا '' (تا لاین صادقانه سؤال کند؛ هیچ ارسالِ لفظیِ «همین اسم») */
  function resolveRefTarget(text) {
    const s = String(text || '');
    if (!/(همین|همون|همان|بهش|براش|اونو?|اینو?)/i.test(s)) return '';
    /* v0.75 — خروجی هم از گارد ارزش می‌گذرد (مقصدِ آلوده هرگز ارسال نمی‌شود) */
    const _okt = (v) => (v && entityOk(v)) ? v : '';
    if (REF_NOUN_RE.test(s)) return _okt(state.entities.person) || _okt(state.entities.msgTarget);
    if (/\b(بهش|براش|برا\s?اش)\b/i.test(s) || /(?:^|\s)(بهش|براش|برا\s?اش)(?=$|[\s،؛».!؟?:،])/i.test(s)) return _okt(state.entities.msgTarget);
    return '';
  }

  /* ============================================================
     ستون ۳ — مسیربینی دو لَین
     دقیقاً یک لَین برمی‌گردد؛ هیچ مسیر اجرایی در این فایل نیست.
     ============================================================ */
  /* فرمان‌های بستهٔ سیستمی — آنی، آفلاین‌پسند، بدون «موضوع» */
  const INSTANT_RE = new RegExp([
    /* صدا */
    '(صدا|ولوم|بلندی)[^.]{0,12}(بلند|زیاد|بالا|کم|پایین|آرام|قطع|میوت|بی[\\s\\u200C]?صدا|خاموش)',
    '(صدا|ولوم)[^0-9۰-۹]{0,8}[0-9۰-۹]+|[0-9۰-۹]+[\\s\\u200C]*(درصد)?[\\s\\u200C]*(صدا|ولوم)',
    'mute( the)?( volume| sound)?|volume (up|down|to ?\\d+)|louder|quieter',
    /* مدیا — با لنگرِ پلیر/مدیا/آهنگِ کنترلی (بدون مفعول) */
    '(مدیا|پلیر)[^.]{0,12}(بعدی|قبلی|پاز|توقف|استاپ|پخش|نگه\\s?دار|ببند)',
    '(پاز|پخش)[^.]{0,6}مدیا|media (next|prev|play|pause)|آهنگ\\s?(بعدی|قبلی)\\s?(پلیر)?$',
    '(پلیر|مدیا|ویدیو|فیلم|کلیپ)[^.]{0,16}(فول\\s?اسکرین|تمام\\s?صفحه|برو\\s?(جلو|عقب)|فوروارد|ریویند)',
    '(پاز|توقف|استاپ|پلی\\s?کن|پخش\\s?کن|نگه\\s?دار)[^.]{0,10}(پلیر|مدیا|ویدیو|فیلم|کلیپ)',
    '(ویدیو|فیلم|کلیپ|پلیر|مدیا)[^.]{0,12}(پلی\\s?کن|پخش\\s?کن|پاز|نگه\\s?دار)',
    '(برو\\s?|بپر\\s?)(جلو|عقب|فوروارد|ریویند)',
    'now\\s?playing|چی\\s?(داره\\s?)?پخش|الان\\s?چی\\s?پخشه',
    /* پاور/دستگاه */
    'بخواب|حالت\\s?خواب|مانیتور[^.]{0,10}خاموش|نمایشگر[^.]{0,10}خاموش|خاموش[^.]{0,16}(کامپیوتر|سیستم|ویندوز|پی\\s?سی)',
    '(کامپیوتر|سیستم|ویندوز|پی\\s?سی)[^.]{0,16}(خاموش|شات\\s?داون)|ری\\s?استارت|ریستارت|لغو.{0,8}خاموش|انصراف.{0,8}خاموش',
    'قفل.{0,8}(کن|صفحه)|لاک\\s?اسکرین|log\\s?off|logoff|sign\\s?out|خروج.{0,8}(حساب|اکانت)|turn\\s?off.{0,10}(monitor|screen|pc)',
    /* ابزار آنی */
    'اسکرین\\s?شات|screenshot|تایمر|یادآوری|یادم\\s?بنداز|یادت\\s?بنداز|آلارم|بیدارم\\s?کن|remind\\s?me',
    'وضعیت\\s?(سیستم)?|پردازنده|چند\\s?درجه|باتری|شارژ|battery|چند\\s?ساعته|what\\s?time|ساعت\\s?چنده|تاریخ\\s?چنده|چندمه',
    'مینیمایز|نمایش\\s?دسکتاپ|minimize|show\\s?desktop|همه[^.]{0,8}پنجره',
    'یادداشت|note\\s?(down|to\\s?self)|حساب\\s?کن|چند\\s?میشه|چنده\\s?نتیجه|ضرب|تقسیم|بعلاوه|منهای',
    'دی\\s?ان\\s?اس|dns|پینگ\\s?(دی\\s?ان\\s?اس|dns)',
    /* دیکتهٔ یک‌باره با محتوا */
    "(بنویس|تایپ\\s?کن|دیکته\\s?کن)\\s+[«'\"]?[^\\s«\"]{2,}",
    /* بستن پخش — v0.66: ویدیو/فیلم/کلیپ/پلیر هم اضافه شدند */
    '(یوتیوب|پخش|استریم|ویدیو|فیلم|کلیپ|پلیر|مدیا)[^.]{0,12}(ببند|بس\\s?بند|بس\\s?کن|بسش\\s?کن|خاموشش?\\s?کن|قطعش?\\s?کن|استاپ|استوپ)',
  ].join('|'), 'i');
  /* بستنِ پخش — قبل از ممنوعه چک می‌شود: «یوتیوب رو ببند» فرمانِ بستهٔ سیستم است
     (نه جمله‌ای موضوع‌دار؛ ریشه: بدون این، «ببند» + «یوتیوب» به brain می‌رفت) */
  const INSTANT_CLOSE_RE = new RegExp('(یوتیوب|youtube|پخش|استریم|ویدیو|فیلم|کلیپ|پلیر|مدیا)[^.]{0,12}(ببند|بس\\s?بند|بس\\s?کن|بسش\\s?کن|خاموشش?\\s?کن|قطعش?\\s?کن|استاپ|استوپ)|(ببندش?|بسش\\s?کن|خاموشش?\\s?کن|قطعش?\\s?کن|استاپش?|استوپش?)[^.]{0,12}(یوتیوب|youtube|پخش|پلیر|ویدیو|فیلم|کلیپ)', 'i');
  /* ممنوعهٔ instant — این نشانه‌ها یعنی جمله «موضوع» دارد */
  const INSTANT_NEG_RE = /(چیه|چرا|کجا|کدوم|چطوری|منظورم|اشتباه|همین|همون|همان|اونو|اینو|اول[^.]{0,30}بعد|سرچ|جستجو|بگرد|پیدا\s?کن|گوگل\s?کن|یوتیوب|youtube|گوگل|google|آپارات|دنبال)/i;
  /* فعل‌های باز کردن + اسم اپ: instant اگر اپ معروف/نصب باشد */
  const APP_OPEN_RE = /(باز\s*(کن|بکن|شو|شه|کردن)|اجرا\s*(کن|بکن|شه|ده)|بیار\s*(بالا|روی)|بذار\s*(باز|اجرا)|open|launch|run|start)/i;

  function laneOf(cmd, opts) {
    const o = opts || {};
    const s = normFa(cmd);
    if (!s) return { lane: 'brain', reason: 'empty' };
    if (INSTANT_CLOSE_RE.test(s)) return { lane: 'instant', reason: 'closed-set-close' };
    /* موضوع‌دارها همیشه مغز (یا فالبک آفلاین) — نه اجرای کور */
    if (INSTANT_NEG_RE.test(s)) return { lane: 'brain', reason: 'subject-or-meta' };
    if (INSTANT_RE.test(s)) return { lane: 'instant', reason: 'closed-set' };
    if (APP_OPEN_RE.test(s)) {
      const names = (o.apps && o.apps.length) ? o.apps : [];
      if (!names.length) return { lane: 'brain', reason: 'app-unknown-list' };
      const target = s.replace(/^(.+?)\s+(رو|را)\s+(باز|اجرا|بذار)/i, '$1');
      const tail = s.replace(APP_OPEN_RE, ' ').replace(/(رو|را)/g, ' ').trim();
      const cand = [target, tail].filter(Boolean);
      const known = names.some((n) => cand.some((c) => c.includes(String(n).toLowerCase()) || String(n).toLowerCase().includes(c)));
      if (known) return { lane: 'instant', reason: 'app-known' };
      return { lane: 'brain', reason: 'app-unknown' };
    }
    return { lane: 'brain', reason: 'default-subject' };
  }

  /* ============================================================
     ستون ۴ — بستهٔ زمینهٔ واحد برای مغز ابری
     ============================================================ */
  function turnsCtx(n) {
    const t = state.turns.slice(0, Math.max(2, Math.min(12, n || 10)));
    if (!t.length) return '';
    const rows = t.map((x) => {
      const u = x.u ? 'کاربر: «' + x.u + '»' : '';
      const a = x.reply ? 'آوا: «' + x.reply + '»' : (x.intent ? 'آوا: اجرا شد ' + x.intent + (x.params && x.params.q ? ' («' + x.params.q + '»)' : '') : '');
      return [u, a].filter(Boolean).join(' / ');
    }).filter(Boolean);
    if (!rows.length) return '';
    return '[تاریخچهٔ همین گفتگو (تازه‌ترین اول) — ارجاع‌های «همین/همون/اون» را فقط از همین تاریخچه حل کن:\n' + rows.join('\n') + '\n]';
  }
  function entityCtx() {
    const e = state.entities;
    const rows = [];
    if (e.song) rows.push('آهنگ/خوانندهٔ آخر: ' + e.song);
    if (e.video) rows.push('ویدیوی آخر: ' + e.video);
    if (e.site) rows.push('آخرین سایت: ' + e.site);
    if (e.app) rows.push('آخرین برنامه: ' + e.app);
    if (e.city) rows.push('آخرین شهر: ' + e.city);
    if (e.model) rows.push('آخرین مدل/موضوع فنی: ' + e.model);
    if (e.query) rows.push('آخرین عبارت جستجو: ' + e.query);
    if (state.entities.wake) rows.push('کلمهٔ بیداری فعلی: ' + state.entities.wake);
    /* v0.69 — واقعیت‌های اخیر (ریشهٔ «دو دقیقه بعد یادش رفته») */
    if (e.note) rows.push('آخرین یادداشت ثبت‌شده: «' + e.note + '»');
    if (e.msgTarget) rows.push('آخرین مقصد پیام: ' + e.msgTarget + (e.msgApp ? ' (در ' + e.msgApp + ')' : ''));
    if (e.searchTitle) rows.push('آخرین نتیجهٔ سرچ: ' + e.searchTitle);
    if (e.person) rows.push('آخرین نام مطرح‌شده: ' + e.person);
    if (!rows.length) return '';
    return '[موجودیت‌ها و واقعیت‌های آخرین گفتگو — برای حل ارجاع و ادامهٔ موضوع — ارجاع «همین/همون/بهش» را از همین‌ها حل کن:\n' + rows.join('\n') + '\n]';
  }
  function lastUserText() {
    return (state.turns.find((x) => x.u) || {}).u || '';
  }
  function reset() { state.turns.length = 0; Object.keys(state.entities).forEach((k) => { state.entities[k] = ''; }); }

  /* نقطهٔ ورود واحد برای app.js — همیشه دقیقاً یک تصمیم */
  function prepare(cmd, opts) {
    /* v0.66 — videoUrl به حل‌گر ارجاع می‌رسد (سرنخِ «همین ویدیو» بدون خراب‌کردن جمله) */
    const rr = resolveRefs(cmd, opts);
    const lane = laneOf(rr.text, opts);
    /* v0.69 — متن «تمیز» برای لاین‌های قطعی؛ حاشیه‌ها جدا برمی‌گردند تا فقط
       به بستهٔ AI بچسبند (ریشه: پسوندِ پرانتزی در typeOnceOf تایپ می‌شد) */
    return { text: rr.text, hints: rr.hints || [], resolved: rr.resolved, unresolved: rr.unresolved, lane: lane.lane, reason: lane.reason };
  }

  const api = { normFa, recordTurn, resolveRefs, resolveRefTarget, isGibberish, LEARN_COMPLAIN_RE, laneOf, turnsCtx, entityCtx, lastUserText, prepare, reset, entityOk, _state: state };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AVACore = api;
})(typeof window !== 'undefined' ? window : null);
