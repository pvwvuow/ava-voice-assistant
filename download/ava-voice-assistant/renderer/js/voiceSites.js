'use strict';
/* ============================================================
   آوا — voiceSites.js (v0.50) — رجیستری جستجوی درون‌سایتی + نقشهٔ شهرها
   ------------------------------------------------------------
   خواستهٔ صریح کاربر: «طبق روال عادی هر سایت همین‌جوری معمول سرچ نکن که
   مثلاً شهر بجن تا ابتدای لینک بنویسی — ببین خود اون سایت طراحیش چه‌جوریه،
   چه‌جوری سرچ میشه در هر شهری، بعد اجرا کنه دستور رو»

   سند واقعی لاگ v0.49 (خط ۱۵۸۴): AI لینک توهمی divar.ir/s/bojnurd/mot ساخت
   → HTTP 404 واقعی؛ قالب درست دیوار divar.ir/s/{شهر-لاتین}?q={عبارت} است
   (تست‌شده: bojnurd?q=موتور = 200 OK). نسخهٔ قبلی siteUrlFix شهر را دور
   می‌ریخت و همه‌چیز را tehran می‌کرد — یعنی «بجنورد» می‌شد «تهران».

   قوانین این ماژول:
   ۱) شهرِ داخل لینکِ AI (لاتین یا فارسی) حفظ و به اسلاگ لاتین تبدیل می‌شود.
   ۲) مسیر توهمی (بخش غیرشهری بعد از /s/{شهر}/) به عبارتِ جستجوی ?q= تبدیل
      می‌شود، مگر دستهٔ واقعی دیوار باشد (لینک دسته معتبر است، دست نمی‌خورد).
   ۳) لینکی که از قبل ?q= دارد دست‌نخورده می‌ماند.
   در مرورگر روی window.AVASites می‌نشیند و در Node هم module.exports دارد
   تا تست‌های رگرسیون بدون Electron اجرا شوند.
   ============================================================ */
(function (root) {
  /* قالب‌های تست‌شدهٔ واقعی — پرچم سوم = آیا قالب «شهر» می‌فهمد */
  const SITE_QUERY_REGISTRY = [
    [/^www\.divar\.ir$|^divar\.ir$/, (q, city) => 'https://divar.ir/s/' + (city || 'tehran') + '?q=' + encodeURIComponent(q), true],
    [/^www\.sheypoor\.com$|^sheypoor\.com$/, (q) => 'https://www.sheypoor.com/search?q=' + encodeURIComponent(q), false],
    [/^www\.aparat\.com$|^aparat\.com$/, (q) => 'https://www.aparat.com/search/' + encodeURIComponent(q), false],
    [/^www\.digikala\.com$|^digikala\.com$/, (q) => 'https://www.digikala.com/search/?q=' + encodeURIComponent(q), false],
    [/^torob\.com$|^www\.torob\.com$/, (q) => 'https://torob.com/search/?query=' + encodeURIComponent(q), false],
    [/^emalls\.ir$|^www\.emalls\.ir$/, (q) => 'https://emalls.ir/?s=' + encodeURIComponent(q), false],
  ];

  /* نقشهٔ شهرهای ایران → اسلاگ لاتینِ خود سایت‌ها (دیوار/شیپور)
     کلیدها با املای رایج STT هم پوشش داده شده‌اند (نیم‌فاصله/فاصله/آ) */
  const CITY_SLUGS = {
    'تهران': 'tehran', 'طهران': 'tehran', 'مشهد': 'mashhad', 'مشهد مقدس': 'mashhad',
    'اصفهان': 'isfahan', 'شیراز': 'shiraz', 'تبریز': 'tabriz', 'کرج': 'karaj',
    'قم': 'qom', 'اهواز': 'ahvaz', 'کرمانشاه': 'kermanshah', 'ارومیه': 'urmia',
    'رشت': 'rasht', 'زاهدان': 'zahedan', 'همدان': 'hamedan', 'کرمان': 'kerman',
    'یزد': 'yazd', 'اردبیل': 'ardabil', 'بندرعباس': 'bandarabbas', 'اراک': 'arak',
    'قزوین': 'qazvin', 'سنندج': 'sanandaj', 'بجنورد': 'bojnurd', 'بجران': 'bojnurd',
    'بیرجند': 'birjand', 'ساری': 'sari', 'گرگان': 'gorgan', 'سمنان': 'semnan',
    'شهرکرد': 'shahrekord', 'بوشهر': 'bushehr', 'ایلام': 'ilam', 'یاسوج': 'yasuj',
    'زنجان': 'zanjan', 'قشم': 'qeshm', 'کیش': 'kish', 'نیشابور': 'neyshabur',
    'اسلامشهر': 'eslamshahr', 'پاکدشت': 'pakdasht', 'شهریار': 'shahriar',
    'خرم اباد': 'khorramabad', 'خرم آباد': 'khorramabad',
  };

  /* دسته‌های واقعی دیوار — لینکِ /s/{شهر}/{دسته} معتبر است و نباید به ?q= بشکند */
  const DIVAR_CATEGORIES = new Set([
    'real-estate', 'vehicles', 'car', 'motorcycle', 'bicycle', 'classic-cars',
    'mobile-phones', 'tablet', 'computer-and-laptop', 'electronic-devices',
    'home-appliances', 'home-and-kitchen', 'personal', 'fashion-and-apparel',
    'leisure-hobbies', 'jobs', 'services', 'for-rent', 'agriculture',
    'industrial', 'businesses', 'animals', 'kids-and-baby', 'books-and-media',
    'game-console', 'diy-and-building-materials', 'antiques', 'free-things',
  ]);

  /* فارسی/لاتین → اسلاگ معتبر؛ لاتین معتبر همان می‌ماند */
  function citySlug(x) {
    const s = String(x || '').trim().toLowerCase();
    if (!s) return '';
    if (/^[a-z0-9-]{2,24}$/.test(s)) return s;
    const n = s.replace(/\u200C/g, ' ').replace(/\s+/g, ' ').trim();
    return CITY_SLUGS[n] || '';
  }

  /* بازسازی URL سایت‌های رجیستری — v0.50 شهر-محور.
     توجه: pathname در درصد-انکود است — هر سگمنت باید اول decode شود
     وگرنه encodeURIComponent دومرتبه (%25D9…) تولید می‌شود (باگ واقعی تست). */
  function decSeg(x) { try { return decodeURIComponent(String(x || '')); } catch (_) { return String(x || ''); } }
  const CITY_SLUG_SET = new Set(Object.values(CITY_SLUGS));

  function siteUrlFix(url) {
    try {
      const u = new URL(String(url || ''));
      const hit = SITE_QUERY_REGISTRY.find((r) => r[0].test(u.hostname));
      if (!hit) return url;
      const hasQ = !!(u.search || '').replace('?', '').trim();
      const cityAware = hit[2] === true;
      const rawSegs = u.pathname.split('/').filter(Boolean);
      if (cityAware) {
        /* دیوار: /s/{شهر}/… — شهر را از مسیر یا پارامتر نجات بده */
        let city = '';
        let rest = [];
        if (/^s$/i.test(rawSegs[0] || '')) {
          city = citySlug(decSeg(rawSegs[1] || ''));
          rest = rawSegs.slice(2).map(decSeg);
        }
        if (!city) city = citySlug(u.searchParams.get('city') || '');
        if (hasQ) {
          const q0 = u.searchParams.get('q') || u.searchParams.get('query') || '';
          return q0 ? 'https://divar.ir/s/' + (city || 'tehran') + '?q=' + encodeURIComponent(q0) : url;
        }
        const cats = rest.filter((x) => DIVAR_CATEGORIES.has(String(x).toLowerCase()));
        if (cats.length) return url; /* /s/{شهر}/{دستهٔ واقعی} — لینک معتبر، دست نزن */
        const nonCat = rest.filter((x) => !DIVAR_CATEGORIES.has(String(x).toLowerCase()));
        const seg = nonCat.pop() || '';
        if (seg && seg.length >= 2) {
          return 'https://divar.ir/s/' + (city || 'tehran') + '?q=' + encodeURIComponent(seg);
        }
        if (!rest.length && rawSegs[0] && /^s$/i.test(rawSegs[0])) {
          const x = decSeg(rawSegs[1] || '');
          if (x && CITY_SLUG_SET.has(x.toLowerCase())) return url; /* صفحهٔ شهرِ واقعی */
          if (x && x.length >= 2) return 'https://divar.ir/s/tehran?q=' + encodeURIComponent(x);
        }
        return url; /* عبارتی نیست — همان صفحهٔ شهر باز شود */
      }
      if (hasQ) return url;
      const segs = rawSegs.filter((x) => !/^search$|^s$|^result$/i.test(x)).map(decSeg);
      const seg = segs.pop() || '';
      return seg && seg.length >= 2 ? hit[1](seg) : url;
    } catch (_) { return url; }
  }

  const api = { SITE_QUERY_REGISTRY, CITY_SLUGS, DIVAR_CATEGORIES, citySlug, siteUrlFix };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AVASites = api;
})(typeof window !== 'undefined' ? window : null);
