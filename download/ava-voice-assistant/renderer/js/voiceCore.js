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
  const MAX_TURNS = 10;
  const state = {
    turns: [],   /* [{u, via, intent, params, reply, at}] — تازه اول */
    entities: {  /* آخرین موجودیت هر دامنه — فقط رشتهٔ تمیز */
      song: '', video: '', site: '', app: '', city: '', model: '', query: '', lastTitle: '',
    },
  };

  /* استخراج موجودیت از «متن» — بدون دانش بیرونی، فقط الگوهای فارسی امن */
  function extractFromText(text) {
    const s = normFa(text);
    const out = {};
    let m = s.match(/(?:آهنگ|ترانه|موزیک)\s+(?:جدید\s+|جدیدترین\s+| جدید\s+)?([\u0600-\u06FF\u200c]{2,30})/);
    if (m && m[1]) out.song = m[1].trim();
    m = s.match(/(?:ویدیو|فیلم|کلیپ)\s+([\u0600-\u06FF\u200c0-9]{2,30})/);
    if (m && m[1]) out.video = m[1].trim();
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
        u: String((o && o.utterance) || '').slice(0, 200),
        via: String((o && o.via) || '').slice(0, 24),
        intent: String((o && o.intent) || '').slice(0, 40),
        params: (o && o.params && typeof o.params === 'object') ? o.params : null,
        reply: String((o && o.reply) || '').slice(0, 200),
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
        if (v && !/^(همین|همون|اونو|اینو|همو)$/.test(v)) state.entities[k] = v;
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
  /* ضمایرِ لختِ بدون دامنه — به آخرین موجودیت هر دامنه‌ای که هست می‌روند */
  const BARE_REF_RE = /(^|[\s،؛«"(])(همینو|همونو|اونو|اینو|همو|همین|همون|همان)(?=$|[\s،؛»").!؟?:،]|و)(?:\s?(رو|را|رو\s?بگرد|رو\s?پخش|رو\s?پلی))?/i;
  const POSSESS_REF_RE = /(^|[\s،؛«"(])(همینو?|همونو?|همان|اونو?|اینو?)\s?(اسمشو?|اسماشو?|اسمش)(?=$|[\s،؛»").!؟?:،])/i;

  function pickEntity(key) {
    const e = state.entities;
    if (key === 'song' && e.song) return e.song;
    if (key === 'video' && e.video) return e.video;
    if (key === 'model' && e.model) return e.model;
    if (key === 'site' && e.site) return e.site;
    if (key === 'city' && e.city) return e.city;
    if (key === 'query' && e.query) return e.query;
    if (e.lastTitle) return e.lastTitle;
    return e.song || e.video || e.model || e.query || '';
  }

  function resolveRefs(cmd) {
    const orig = String(cmd || '');
    const out = { text: orig, resolved: [], unresolved: false };
    if (!orig.trim()) return out;
    let s = orig;
    const hit = (domain, from) => {
      const v = pickEntity(domain);
      if (!v || v === from) return false;
      out.resolved.push({ from, to: v, domain });
      return v;
    };
    /* ۱) «همون اسمش/اسمشو» → آخرین تیتر */
    let m = POSSESS_REF_RE.exec(s);
    if (m) {
      const v = pickEntity('song');
      if (v) { s = s.replace(m[0], ' ' + v + ' ').replace(/\s+/g, ' ').trim(); out.resolved.push({ from: m[0].trim(), to: v, domain: 'title' }); }
      else out.unresolved = true;
    }
    /* ۲) «همون آهنگ جدیدش / همین ویدیو / اون مدل» — دامنه‌دار */
    if (!out.resolved.length) {
      for (const d of REF_DOMAINS) {
        m = d.re.exec(s);
        if (m && /(همین|همون|همان|اون|این)/i.test(m[0]) && d.re.test(s)) {
          /* فقط وقتی ضمیرِ ارجاعی واقعاً در عبارت دامنه هست اجرا شود */
          const v = hit(d.domain, m[0]);
          if (v) { s = s.replace(m[0], (m[2] ? m[2] + ' ' : '') + v + ' ').replace(/\s+/g, ' ').trim(); break; }
        }
      }
    }
    /* ۳ب) «NOUN که گفتیم/گفتی» (لاگ: «مدل موتوری که گفتیم» گم شده بود) */
    if (!out.resolved.length) {
      const kn = s.match(/(مدل|موتور|آهنگ|ویدیو|فیلم|سایت|موضوع)(ی)?\s?که\s?(گفتیم|گفتی|گفتید)/i);
      if (kn) {
        const dom = /مدل|موتور/.test(kn[1]) ? 'model' : /آهنگ/.test(kn[1]) ? 'song' : /ویدیو|فیلم/.test(kn[1]) ? 'video' : /سایت/.test(kn[1]) ? 'site' : 'query';
        const v = pickEntity(dom);
        if (v) { s = s.replace(kn[0], kn[1] + ' ' + v).replace(/\s+/g, ' ').trim(); out.resolved.push({ from: kn[0], to: v, domain: dom }); }
        else out.unresolved = true;
      }
    }
    /* ۳) ضمیرِ لخت «همینو/اونو» → آخرین موجودیت هر دامنه‌ای که هست */
    if (!out.resolved.length && BARE_REF_RE.test(s)) {
      const v = pickEntity('');
      if (v) { s = s.replace(BARE_REF_RE, ' ' + v + ' ').replace(/\s+/g, ' ').trim(); out.resolved.push({ from: 'bare-ref', to: v, domain: 'last' }); }
      else out.unresolved = true;
    }
    /* ۴) «همین که گفتی/گفتی چی بود» → آخرین موجودیت؛ بدون موجودیت = unresolved */
    if (!out.resolved.length && /(همین|همون|همان|اون)\s?که\s?(گفتی|گفتیم|گفتید|بهم\s?گفتی)/i.test(s)) {
      const v = pickEntity('');
      if (v) { s = s.replace(/(همین|همون|همان|اون)\s?که\s?(گفتی|گفتیم|گفتید|بهم\s?گفتی)/i, v).replace(/\s+/g, ' ').trim(); out.resolved.push({ from: 'ke-gofti', to: v, domain: 'last' }); }
      else out.unresolved = true;
    }
    out.text = s;
    return out;
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
    /* بستن پخش */
    '(یوتیوب|پخش|استریم)[^.]{0,12}(ببند|بس\\s?بند|بس\\s?کن|خاموش\\s?کن|قطع\\s?کن|استاپ|استوپ)',
  ].join('|'), 'i');
  /* بستنِ پخش — قبل از ممنوعه چک می‌شود: «یوتیوب رو ببند» فرمانِ بستهٔ سیستم است
     (نه جمله‌ای موضوع‌دار؛ ریشه: بدون این، «ببند» + «یوتیوب» به brain می‌رفت) */
  const INSTANT_CLOSE_RE = new RegExp('(یوتیوب|youtube|پخش|استریم|پلیر|مدیا)[^.]{0,12}(ببند|بس\\s?بند|بس\\s?کن|خاموش\\s?کن|قطع\\s?کن|استاپ|استوپ)|(ببندش?|قطعش?|استاپش?)[^.]{0,12}(یوتیوب|youtube|پخش|پلیر)', 'i');
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
    const t = state.turns.slice(0, Math.max(2, Math.min(10, n || 6)));
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
    if (!rows.length) return '';
    return '[موجودیت‌های آخرین گفتگو — برای حل ارجاع و ادامهٔ موضوع:\n' + rows.join('\n') + '\n]';
  }
  function lastUserText() {
    return (state.turns.find((x) => x.u) || {}).u || '';
  }
  function reset() { state.turns.length = 0; Object.keys(state.entities).forEach((k) => { state.entities[k] = ''; }); }

  /* نقطهٔ ورود واحد برای app.js — همیشه دقیقاً یک تصمیم */
  function prepare(cmd, opts) {
    const rr = resolveRefs(cmd);
    const lane = laneOf(rr.text, opts);
    return { text: rr.text, resolved: rr.resolved, unresolved: rr.unresolved, lane: lane.lane, reason: lane.reason };
  }

  const api = { normFa, recordTurn, resolveRefs, laneOf, turnsCtx, entityCtx, lastUserText, prepare, reset, _state: state };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AVACore = api;
})(typeof window !== 'undefined' ? window : null);
