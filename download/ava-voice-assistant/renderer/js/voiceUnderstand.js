'use strict';
/* ============================================================
   آوا — voiceUnderstand.js (v0.44) — لایهٔ «فهم-اول»
   ------------------------------------------------------------
   درخواست صریح کاربر (v0.44):
   «خیلی چیزها هست که سرخود تصمیم می‌گیره… چرا؟ چون فقط یک کلمه‌ای
   که در جملهٔ کاربر هست در کامند هست، پس اون رو اجرا می‌کنه… این
   اشتباهه. اول تحلیل کنه و واقعاً بفهمه این چیه… اگه نفهمید بده
   gemini انجام بده کار رو.»
   «میگه توی دیوار دنبال موتور بگرد، نره گوگل سرچ کنه»
   «فقط همین یک چیز که من گفتم نیست — هزار مسئله دیگه هست»

   پس این لایه هیچ دیکشنری نمونه‌ای ندارد (نه دیوار اضافه می‌کنیم
   نه شیپور — نمونه‌پچی ممنوع). کارش فقط «تحلیل ساختاری جمله» است:

   ۱) فعل را پیدا می‌کند: سرچ/بگرد/جستجو/دنبال…بگرد/پیدا کن/پخش/پلی/باز کن/اجرا
   ۲) «هدفِ درون-جمله‌ای» را پیدا می‌کند: توی/تو/در/روی X، سایت X، اپ X…
   ۳) سوژهٔ بعد از فعل (چیزی که دنبالش می‌گردد) را جدا می‌کند.
   ۴) تصمیم می‌دهد آیا اجرای محلی «کور» است یا نه:
        • هدف داریم + فعل جستجو/بازکردن + قانونِ برنده از خانوادهٔ
          web_search/site_search/web_open + هدف محلی حل‌نشدنی
          → اجرای کورکورانه ممنوع؛ جمله باید به AI برود تا «واقعاً
          بفهمد» X چیست (سایت است؟ جستجوی درون‌سایتی‌اش را بسازد؛
          برنامهٔ نصب‌شده است؟ بازش کند؛ نمی‌داند؟ صادق بگوید).
        • هدف معروف است (دیجی‌کالا/یوتیوب/…) یا برنامهٔ نصب‌شده است
          → مسیر محلی همان قبل، صفر شبکه.

   این ماژول فقط تحلیل می‌کند؛ «حل‌شدنی بودن هدف» با کال‌بکِ
   تزریق‌شده از app.js سنجیده می‌شود (knownSiteOf/matchSysApp).
   در مرورگر روی window.AVAUnderstand می‌نشیند و در Node هم
   module.exports دارد تا تست‌های رگرسیون بدون Electron اجرا کنند.
   ============================================================ */
(function (root) {
  /* فعل‌های جستجو: «سرچ کن»، «سیرچ»، «جستجو»، «دنبال X بگرد»، «بگرد»، «پیدا کن» */
  const SEARCH_VERB_RE =
    /(سرچ|سیرچ|سرچکن|جستجو|جو\sv?جو|بگرد|بگرده|بگرده?ش|دنبال|پیدا\s?کن|پیدا\s?کردن|سرچ\s?کن|search|look\s?for|find)/i;
  /* فعل‌های پخش */
  const PLAY_VERB_RE = /(پخش|پلی\s?کن|پخشش?\s?کن|بزن|بذار|play)/i;
  /* فعل‌های باز کردن */
  const OPEN_VERB_RE = /(باز\s?کن|باز\s?بکن|اجرا\s?کن|بزن\s?رو|برو\s?(به|تو|روی)|وارد\s?شو|open|launch|go\s?to)/i;
  /* نشانهٔ «درونِ هدف»: توی/تو/در/روی/سایت/اپ/برنامه */
  const IN_MARK_RE = /(توی|تو|در|روی|رو|سایت|وب\s?سایت|اپ|اپلیکیشن|برنامه|app|site|website|in|on)\s+/i;
  /* نام‌تعریف‌های کلی که خودشان هدف نیستند */
  const GENERIC_TARGET = /^(سایت|وب\s?سایت|صفحه|اپ|اپلیکیشن|برنامه|جستجو|گوگل|اینترنت|وب|همه\s?جا)$/i;
  /* بریدن دنباله‌های پرگوی پس از اسم هدف */
  const TAIL_STRIP =
    /(\s+(رو|را|هم|دیگه|دیگر|لطفا|ممنون|بی\s?زحمت|برام|برای\s?من|کن|بکن|میخوام|می\u200cخوام))+$/gi;

  /* نرمال‌سازی سبک (هم‌خانوادهٔ voiceIntent، بدون وابستگی) */
  function normFa(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[\u200c\u200f\u200e]/g, ' ')
      .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/[.،؛!؟?]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* جدا کردن هدفِ درون-جمله‌ای:
     «توی سایت دیوار سرچ کن خرید خونه» → { raw:'سایت دیوار', clean:'دیوار', marker:'سایت' }
     «توی دیوار دنبال موتور بگرد»      → { raw:'دیوار', clean:'دیوار', marker:'' }
     «برو به سایت همراه من»            → { raw:'سایت همراه من', clean:'همراه من', marker:'سایت' } */
  function targetOf(n) {
    /* مسیر ۱ — هدفِ پیش از فعل: (توی|تو|در|روی) (سایت|اپ|…)? NAME تا قبل از فعل
       (?<!حروف فارسی) — «رو»ی داخل «برو» نباید نشانهٔ درون-جمله‌ای خورده شود */
    const m1 = n.match(
      /(?<![\u0600-\u06FF\u200c])(?:توی|تو|در|روی|رو)\s+(?:(سایت|وب\s?سایت|اپ|اپلیکیشن|برنامه|app|site|website)\s+)?([a-z0-9\u0600-\u06FF][a-z0-9\u0600-\u06FF\s\u200c]*?)\s*(?=(?:سرچ|سیرچ|جستجو|بگرد|دنبال|پیدا|پخش|پلی|بزن|بذار|باز|اجرا|ببند|وارد|رو\s?باز|را\s?باز|برو|بگو|$))/i
    );
    /* مسیر ۲ — «برو به سایت X» / «سایت X رو باز کن» (هدف پس از فعل) */
    const m2 = !m1 ? n.match(/(?:برو\s+(?:به|تو|روی)\s+|وارد\s+)?(سایت|وب\s?سایت|اپ|اپلیکیشن|برنامه)\s+(?:از\s+)?([a-z0-9\u0600-\u06FF][^]*?)\s*(?=(?:رو|را|روی)?\s*(?:باز|بکن|کن|اجرا|$))/i) : null;
    const pick = m1 || m2;
    if (!pick) return null;
    const marker = (m1 && m1[1]) || (m2 ? m2[1] : '') || '';
    let name = String((m1 ? m1[2] : m2[2]) || '').trim();
    name = name.replace(TAIL_STRIP, ' ').replace(/[\s\u200c]+/g, ' ').trim();
    /* قیدهای سرکش ابتدای اسم */
    name = name.replace(/^(سایت|وب\s?سایت|اپ|اپلیکیشن|برنامه|از|ی|یه|یک|به)\s+/i, ' ').replace(/[\s\u200c]+/g, ' ').trim();
    /* اگر اسم به واژه‌های رسانه برخورد همان‌جا بُریده می‌شود:
       «یوتیوب آهنگ شادمهر» → «یوتیوب» (آهنگِ شادمهر «موضوع» است، نه هدف) */
    const mm = name.match(/\s+(?:آهنگ|ترانه|ویدیو|فیلم|کلیپ|موزیک|آلبوم)(?:\s|$)/i);
    if (mm && mm.index >= 2) name = name.slice(0, mm.index).trim();
    if (!name || name.length < 2 || name.length > 40) return null;
    if (GENERIC_TARGET.test(name)) return null;
    /* اسمی که فقط فعل بعدی است («توی گوگل سرچ کن» هدفش خود گوگل است → قابل حل) */
    return { raw: (marker ? marker + ' ' : '') + name, clean: name, marker: marker || '' };
  }

  /* سوژهٔ جستجو: چیزی که بعد از فعل می‌آید
     «سرچ کن خرید خونه» → «خرید خونه» ؛ «دنبال موتور بگرد» → «موتور» */
  function queryOf(n) {
    const m1 = n.match(/(?:دنبال)\s+([^]+?)\s*(?:بگرد|بگرده|بگردم|بگردش|search)/i);
    if (m1 && m1[1] && m1[1].trim().length >= 2) return m1[1].trim().slice(0, 80);
    const m2 = n.match(/(?:سرچ|سیرچ|جستجو|جستجو\s?کن|سرچ\s?کن|پیدا\s?کن|search(?:\s?for)?|find)\s*(?:کن|بکن|بزن)?\s+([^]+)/i);
    if (m2 && m2[1] && m2[1].trim().length >= 2) {
      return m2[1].replace(TAIL_STRIP, ' ').replace(/[\s\u200c]+/g, ' ').trim().slice(0, 80);
    }
    return '';
  }

  /* تحلیل کامل جمله */
  function analyze(text) {
    const norm = normFa(text);
    if (!norm) return null;
    const searchVerb = SEARCH_VERB_RE.test(norm);
    const playVerb = !searchVerb && PLAY_VERB_RE.test(norm);
    const openVerb = OPEN_VERB_RE.test(norm);
    const target = targetOf(norm);
    const query = queryOf(norm);
    return {
      norm,
      searchVerb,
      playVerb,
      openVerb,
      target,
      query,
      hasInTarget: !!(target && target.clean),
    };
  }

  /* آیا این جمله نباید محلیِ «کور» اجرا شود؟
     ruleId: قانون برندهٔ داوری (web_search/site_search/web_open/yt_search…)
     isResolvable(cleanTarget): کال‌بک app.js — true یعنی هدف را محلی می‌شناسیم
       (سایت معروف با جستجوی بومی / دامنهٔ روشن / برنامهٔ نصب‌شده) */
  const SEARCHY_RULES = { web_search: 1, site_search: 1, web_open: 1, yt_watch: 1 };
  function blocksBlindAction(und, ruleId, isResolvable) {
    try {
      if (!und || !und.target || !und.target.clean) return false;
      if (!SEARCHY_RULES[String(ruleId || '')]) return false;
      /* کاربر صریح گفته «توی/سایت X» → جستجوی عمومیِ جایگزین = سوءتفاهم */
      const resolvable = typeof isResolvable === 'function' ? !!isResolvable(und.target.clean) : false;
      return !resolvable;
    } catch (_) { return false; }
  }

  /* خلاصهٔ تحلیل برای پیام AI — فارسی، کوتاه، با قانون */
  function briefForAi(und) {
    try {
      if (!und) return '';
      const act = und.searchVerb ? 'جستجو' : (und.playVerb ? 'پخش' : (und.openVerb ? 'باز کردن' : 'نامشخص'));
      const rows = [
        '[تحلیل ساختاری آوا از همین جمله:',
        '- نیت: ' + act,
        und.target ? '- هدف مشخص‌شده توسط کاربر: «' + und.target.clean + '»' + (und.target.marker ? ' (نوع: ' + und.target.marker + ')' : '') : '- هدف مشخصی در جمله نیست',
        und.query ? '- موضوع: «' + und.query + '»' : '',
        '- قانون: هدفِ کاربر باید خودِ «' + (und.target ? und.target.clean : 'همان') + '» برآورده شود — این هدف در فهرست محلی آوا حل نشد؛ تو (AI) تعیین کن: اگر وب‌سایت معروفی است URL جستجو/صفحهٔ واقعی خودش را بده (open_url)؛ اگر برنامهٔ نصب‌شده است open_app بده؛ اگر مطمئن نیستی صادقانه بگو و نزدیک‌ترین حالت درست را پیشنهاد بده. تبدیل این درخواست به جستجوی عمومی گوگل فقط وقتی مجاز است که کاربر خودش گوگل را خواسته باشد.]',
      ];
      return rows.filter(Boolean).join('\n');
    } catch (_) { return ''; }
  }

  const api = { analyze, targetOf, queryOf, blocksBlindAction, briefForAi, normFa };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AVAUnderstand = api;
})(typeof window !== 'undefined' ? window : null);
