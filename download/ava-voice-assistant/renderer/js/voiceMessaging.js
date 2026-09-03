'use strict';
/* ============================================================
   آوا — voiceMessaging.js (v0.68) — اکستنشن پیام‌رسانی (مرحلهٔ ۳)
   ------------------------------------------------------------
   خواستهٔ صریح کاربر پس از v0.67:
   «این باگ برای همه پیام رسانا هست» + «وسط مکالمه فارسی ممکنه من
   یک اسم انگلیسی بگم خب اون چی میشه؟» + «اکستنشن هر پیام رسان رو
   کامل و حرفه ای اضافه کن.. برای ذخیره مخاطب با اسمی ک ذخیره شده».

   چه چیزی در v0.68 از ریشه اضافه/فیکس شد:
   ۱) تطبیق دوزبانهٔ نام — «وسط مکالمهٔ فارسی اسم انگلیسی»: STT هم
      «علی» می‌دهد هم «Ali»/«Ali.»؛ جدول ۵۰+ اسم رایج ایران
      (علی↔ali، محمد↔mohammad/muhammad/…) + آوانگاری عمومی کاراکتری
      دوطرفه (faToLatin/latinToFa) + اسکلتِ هم‌خوان‌ها برای نام‌های
      بلندتر (سیاوش↔siavash) + تطبیق یوزرنیم (به ali_gh پیام بده).
      نرمال‌سازی: ي/ك عربی → ی/ک، اعراب/نیم‌فاصله حذف، ارقام فارسی.
   ۲) مخاطبین صوتی (ctCmdParse) — ذخیره/حذف/لیست با جملهٔ فارسی:
      «علی رو تو تلگرام با یوزر ali_gh ذخیره کن» / «ذخیره کن رضا رو
      تو واتساپ با شماره ۰۹۱۲…» / «مخاطب علی رو حذف کن» / «علی رو از
      مخاطبین پاک کن» / «مخاطبینمو بخون». contactFind حالا alias هم
      می‌فهمد و فالبک اشتراکِ شماره بین واتساپ/بله/ایتا/روبیکا دارد.
   ۳) ایتا به رجیستری اپ‌ها اضافه شد (گارد «ایتالیا» با lookahead)؛
      بله/روبیکا/ایتا همچنان فقط با عبارت مکانی صریح.
   ۴) فیکس ریشه‌ای گرامر: فعلِ تکراری سرِ متن («…بده تو تلگرام بگو
      بیا ویس» → «بگو» از سر متن حذف می‌شود؛ v0.67 «بگو بیا ویس»
      می‌فرستاد!)؛ ذخیره بدون اپ → پیش‌فرض هوشمند (یوزرنیم→تلگرام،
      شماره→واتساپ).
   معماری مرحلهٔ ۲ (بدون تغییر): کشف از اسکن اپ‌ها؛ گرامر قطعی بدون
   AI؛ اجرای واقعی: تلگرام/دیسکورد → اتوماسیون دسکتاپ (msg:send)،
   واتساپ → wa.me/whatsapp:// پیش‌پرشده، بله/روبیکا/ایتا → وب +
   کلیپ‌بورد صادقانه. هیچ «OK دروغین» وجود ندارد.
   ============================================================ */
(function (root) {
  /* ---------- ۱) رجیستری اپ‌های پیام‌رسان ---------- */
  const MSG_APPS = [
    { id: 'telegram', fa: 'تلگرام', re: /تلگرام|توتل|تلیگرام|تیلگرام|تله\s?گرام|telegram/i, procs: ['Telegram', 'TelegramDesktop', '64Gram'], link: (t) => 'https://t.me/' + t, desktopLink: (t) => 'tg://resolve?domain=' + t, clipboardText: true, auto: true },
    { id: 'whatsapp', fa: 'واتساپ', re: /واتساپ|واتسآپ|whatsapp/i, procs: ['WhatsApp'], link: (t, txt) => 'https://wa.me/' + String(t || '').replace(/[^0-9]/g, '') + (txt ? '?text=' + encodeURIComponent(txt) : ''), desktopLink: (t, txt) => 'whatsapp://send?phone=' + String(t || '').replace(/[^0-9]/g, '') + (txt ? '&text=' + encodeURIComponent(txt) : ''), clipboardText: false, auto: false },
    { id: 'bale', fa: 'بله', re: /بله(?!ی)|\bbale\b/i, procs: ['Bale', 'BaleMessenger'], link: () => 'https://web.bale.ai/chat', desktopLink: null, clipboardText: true, auto: false, needsLoc: true },
    { id: 'rubika', fa: 'روبیکا', re: /روبیکا|rubika/i, procs: ['Rubika', 'RubikaDesktop'], link: () => 'https://web.rubika.ir/', desktopLink: null, clipboardText: true, auto: false, needsLoc: true },
    { id: 'discord', fa: 'دیسکورد', re: /دیسکورد|discord/i, procs: ['Discord', 'DiscordCanary', 'DiscordPTB', 'DiscordDevelopment'], link: () => 'https://discord.com/channels/@me', desktopLink: (t) => 'discord://discord.com/channels/@me/' + (t || ''), clipboardText: true, auto: true },
    { id: 'eitaa', fa: 'ایتا', re: /ایتا(?!لیا)|\beitaa\b/i, procs: ['Eitaa', 'EitaaDesktop'], link: () => 'https://web.eitaa.com/', desktopLink: null, clipboardText: true, auto: false, needsLoc: true },
  ];
  function msgAppsOf() { return MSG_APPS; }
  /* کشف نصب‌بودن از لیست اسکن‌شدهٔ اپ‌ها (sysApps.list) */
  function detectInstalled(apps) {
    const names = (apps || []).map((a) => String(a.name || '')).join(' ٫ ');
    return MSG_APPS.filter((m) => m.re.test(names)).map((m) => m.id);
  }
  function appOf(idOrName) {
    const s = String(idOrName || '').trim();
    return MSG_APPS.find((m) => m.id === s) || MSG_APPS.find((m) => m.re.test(s)) || null;
  }

  /* ---------- ۲) گرامر فارسی «پیام دادن» (v3) ----------
     شکل‌ها (همه با اپ + مقصد + متن):
     «به علی در تلگرام پیام بده که سلام» / «به فلانی پیام بده تو تلگرام»
     «در تلگرام به علی بگو سلام» / «تلگرام به مامان بگو شام خوردی»
     «پیام بده به علی تو دیسکورد که بیا ویس» / «براش تو بله بنویس سلام»
     «به مامان بزرگ تو بله پیام بده که رسیدم» (مقصد چندکلمه‌ای)
     «به Ali پیام بده تو تلگرام که بیا» (مقصد لاتین — مجاز)
     گیومه‌دار اولویت دارد: «به علی تلگرام پیام بده "فردا میام"» */
  const STOP_TAIL_RE = /(?:\s*(?:پیام|پیغام|بگو|بنویس|متن|برسون|برسان|بفرست|بده|که|رو|را|تو|در|توی|با)\s*)+$/i;
  /* v0.69 — واژه‌های لَیدِ حرفی که گرامر را می‌شکنند («خوب به همین علی…» — در لاگ مسیر مرگِ 2ms)
     و دستورِ زبانی داخل متن («چطوری اسمشو انگلیسی بنویس کامل» — دستور به‌جای متن ارسال شد!)
     v0.74 — «برو/بریم/بیا» هم (لاگ 0.73: «آفرین حالا برو به علی تو دیسکورد پیام بده» —
     «برو» گرامر را می‌شکست و جمله سرنوشتش unrouted/ربوده‌شدن توسط دروازهٔ قدیمی دیسکورد بود) */
  const LEAD_FILLER_RE = /^(?:خوب|خب|حالا|ببین|ببینید|آفرین|افرین|باشه|اوکی|لطفا|لطفاً|داداش|حاجی|اقا|آقا|اول|اولش|راستی|برو|بریم|بیا)(?:\s+(?:که|دیگه))*(?=\s|$)\s*/i;
  const META_LANG_RE = /(?:اسمشو?|اسماشو?|اسم\s*(?:او|رو|را)|نامشو?)?\s*(?:کامل|درست|خب)?\s*(?:به|به\s*صورت|با)?\s*(?:حروف\s*)?(?:انگلیسی|لاتین|فارسی|english)\s*(?:بنویس|بنویسی|بنویسید|بنویسش|بنیویس|بنویسین)(?:\s*(?:کامل|درست|دیگه|خب|جان))*|(?:بنویس|بنویسی)\s*(?:اسمشو?|اسم\s*رو|اسم\s*را)?\s*(?:به\s*)?(?:انگلیسی|لاتین|فارسی)/i;
  function normWord(s) {
    return String(s || '').toLowerCase().replace(/\u200C/g, ' ').replace(/\s+/g, ' ').trim();
  }
  /* v0.75 — حذف واژه‌به‌واژهٔ دُمِ ایستا (پیام/بگو/رو/را/تو/…) از نامزدِ مقصد.
     regex قدیمی داخلِ واژه می‌برید (لاگ میدانی 0.74: صدرا→صد؛ سارا→سا، زهرا→زه هم قربانی می‌شوند)؛
     این نسخه فقط واژه‌های کاملِ ایستا را از انتها برمی‌دارد و آخرین واژه را هرگز نمی‌خورد. */
  const TAIL_STOP_WORD_RE = /^(?:پیام|پیغام|بگو|بنویس|متن|برسون|برسان|بفرست|بده|بدم|که|رو|را|تو|در|توی|با)$/i;
  function stripStopTail(t) {
    const ws = String(t || '').replace(/\u200C/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    while (ws.length > 1 && TAIL_STOP_WORD_RE.test(ws[ws.length - 1])) ws.pop();
    return ws.join(' ').trim();
  }
  function msgParse(cmd) {
    let s = String(cmd || '').trim();
    if (!s || s.length < 6) return null;
    if (!/(پیام|پیغام|متن|بگو|بنویس|بده|بفرست|برسون|برسان)/i.test(s)) return null;
    /* v0.69 — لَیدِ حرفی حذف («خوب به همین علی…» دیگر گرامر را نمی‌شکند) */
    for (let i = 0; i < 4; i++) {
      const s2 = s.replace(LEAD_FILLER_RE, '');
      if (s2 === s) break;
      s = s2;
    }
    /* اپ: اولین پیام‌رسانی که در جمله هست؛ «بله/روبیکا/ایتا» فقط با عبارت
       مکانی صریح («تو بله» / «در روبیکا» / «با ایتا») — وگرنه کلمهٔ «بله»
       هر جمله‌ای را می‌ربود (ریسک فالس‌پازیتیو). */
    let appM = MSG_APPS.find((m) => m.re.test(s));
    if (!appM) return null;
    if (appM.needsLoc && !/(?:تو|در|توی|با)\s*(بله(?!ی)|روبیکا|ایتا)/i.test(s)) appM = null;
    if (!appM) {
      appM = MSG_APPS.find((m) => !m.needsLoc && m.re.test(s));
      if (!appM) return null;
    }
    /* متن: اول گیومه — بالاترین اولویت */
    let text = '';
    const q = s.match(/["«']([\s\S]{1,300}?)["»']/);
    if (q) text = q[1].trim();
    /* مقصد: «به X» — تا ۳ کلمهٔ نامی؛ سپس دُمِ فعل/حرف اضافه بریده می‌شود
       v0.70 — روی «همهٔ» نامزدهای «به X» می‌چرخد و اولین نامزدی را برمی‌دارد
       که سرش واژهٔ ایستای قیدی نباشد (ریشهٔ لاگ 17:05:10: «از این به بعد هر
       وقت گفتم به میلاد…» → «به بعد» مقصد شد! «بعد/عنوان/منظور/هر/وقت…»
       دیگر هرگز مقصد پیام نمی‌شوند) */
    let target = '';
    let targetRef = false; /* «به همین اسم / همون مخاطب» — مقصد باید از حافظه حل شود */
    const woApp = s.replace(appM.re, ' ').replace(/(?:به|برای|برا)\s+(?:همین|همون|همان|اون|این)\s+/gi, 'به ');
    const _stopW = (typeof AVABrain !== 'undefined' && AVABrain.REF_MSG_STOP_RE) ? AVABrain.REF_MSG_STOP_RE : /^(بعد|عنوان|منظور|گفتم|میگم|هر|وقت|اوکی|باشه|حالا|خب|آفرین|فقط|من|تو|موضوع|مورد)$/i;
    let tm2 = null;
    const _rxT = /(?:به|برای|برا)\s+((?:[\u0600-\u06FFa-zA-Z0-9._@]{2,30})(?:\s+[\u0600-\u06FFa-zA-Z0-9._@]{2,30}){0,2})/gi;
    let _mT;
    while ((_mT = _rxT.exec(woApp)) !== null) {
      const _cand = String(_mT[1] || '').trim();
      const _w0 = (_cand.split(/\s+/)[0] || '').replace(/[\u200c]/g, '');
      if (_w0 && _stopW.test(_w0)) continue;
      tm2 = _mT;
      break;
    }
    if (tm2) {
      /* v0.75 — ریشهٔ لاگ میدانی 0.74 (۲۲:۰۵): «به صدرا تو دیسکورد پیام بده» → target=«صد»!
         STOP_TAIL_RE دُمِ «را» را بدون مرزواژه می‌خورد (صدرا→صد، سارا→سا، زهرا→زه) و بعد
         سوییچرِ دیسکورد با HIT زیررشته‌ای به چتِ اشتباه رفت و پیام برای آدمِ اشتباه فرستاده شد.
         درمان: حذف دُم فقط واژه‌به‌واژه — هیچ‌وقت داخلِ یک واژه بریده نمی‌شود. */
      target = stripStopTail(tm2[1]);
      target = target.replace(/\s+(?:پیام|پیغام|بگو|بنویس|متن|برسون|برسان|بفرست)[\s\S]*$/i, '').trim();
      /* v0.69 — «به همین علی اچ کی» → «همین» حذف، نام می‌ماند؛ «به همین اسم/مخاطب» → ref */
      target = target.replace(/^(?:همین|همون|همان|اون|این)\s+/i, '');
      if (!target || /^(?:اسم|نام|مخاطب|شخص)(?:\s+(?:رو|را))?$/i.test(target)) {
        targetRef = true;
        target = '';
      }
      /* v0.69 — «به شماره ۹۳۷…» پیشوندِ شماره حذف (سرچ بی‌نتیجه می‌ساخت) */
      target = target.replace(/^شماره\s*/i, '').trim();
    }
    /* v0.69 — «بهش بگو…/براش بنویس…» — مقصد ضمیری → از حافظه حل می‌شود */
    if (!tm2 && /(?:^|\s)(?:بهش|براش|برا\s?ش|براى او)(?=$|[\s،؛».!؟?:،])/i.test(s)) targetRef = true;
    /* متن بدون گیومه: بعد از اولین فعلِ پیام، با حذف اتصال */
    let lang = ''; /* v0.69 — دستورِ زبانی کشف‌شده در متن ('en'|'fa') */
    if (!text) {
      const tm = s.match(/(?:پیام\s*بده|پیغام\s*بده|بفرست|بگو|بنویس|برسون|برسان)\s*(?:که|این\s*که|:|،|,)?\s*([\s\S]{1,300})$/i);
      if (tm) text = tm[1].trim();
    }
    if (text) {
      /* «پیام بده به علی که سلام» — مقصدِ تکرارشده از سر متن حذف شود */
      if (target) {
        const headRe = new RegExp('^(?:به|برای|برا)\\s+' + target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*(?:که|:|،|,)?\\s*', 'i');
        text = text.replace(headRe, '').trim();
      }
      /* «به فلانی پیام بده تو تلگرام» — دُمِ مکان+اپ از متن حذف شود
         (ریشهٔ متنِ زبالهٔ v0.66: «تو تلگرام» به‌عنوان پیام!) */
      const tailLoc = text.match(/(?:^|\s)(?:تو|در|توی|با)\s*([\u0600-\u06FFa-zA-Z]+)\s*$/i);
      if (tailLoc && appM.re.test(tailLoc[1])) text = text.replace(/(?:\s*)(?:تو|در|توی|با)\s*[\u0600-\u06FFa-zA-Z]+\s*$/i, '').trim();
      /* «پیام بده به علی تو دیسکورد که بیا ویس» — مکان+اپ در سرِ متن هم حذف شود */
      const leadLoc = text.match(/^(?:تو|در|توی|با)\s*([\u0600-\u06FFa-zA-Z]+)\s*/i);
      if (leadLoc && appM.re.test(leadLoc[1])) text = text.slice(leadLoc[0].length).trim();
      text = text.replace(/^(?:که|این\s*که|:|،|,)\s*/i, '').trim();
      /* v0.68 — فعلِ تکراری سرِ متن («…بده تو تلگرام بگو بیا ویس») حذف شود؛ v0.67 «بگو بیا ویس» را به‌عنوان پیام می‌فرستاد */
      text = text.replace(/^(?:پیام\s*بده|پیغام\s*بده|بگو|بنویس|بفرست|برسون|برسان)\s+/i, '').trim();
      /* v0.69 — دستورِ زبانی/املایی هرگز داخل متن پیام نمی‌رود
         (ریشهٔ لاگ: «چطوری اسمشو انگلیسی بنویس کامل» کلمه‌به‌کلمه ارسال شد) */
      const metaM = text.match(META_LANG_RE);
      if (metaM) {
        lang = /فارسی/.test(metaM[0]) ? 'fa' : 'en';
        text = text.replace(META_LANG_RE, ' ').replace(/\s+/g, ' ').trim();
        text = text.replace(/^(?:و|بعد|بعدش|هم)\s+/i, '').replace(/\s+(?:و|بعد|بعدش|هم)$/i, '').trim();
      }
    }
    /* متن نباید خودِ مقصد باشد */
    if (text && target && text.indexOf(target) === 0) text = text.slice(target.length).replace(/^[\s:،,]+/, '').trim();
    if (!target && !text && !targetRef) return null;
    return { app: appM.id, appFa: appM.fa, target, targetRef: !!targetRef, text, lang };
  }

  /* ---------- ۳) سازندهٔ لینک اجرا ---------- */
  function msgBuild(appId, target, text, preferDesktop) {
    const m = MSG_APPS.find((x) => x.id === appId);
    if (!m) return null;
    const link = preferDesktop && m.desktopLink ? m.desktopLink(target, text) : m.link(target, text);
    return { app: m.id, appFa: m.fa, link, copyText: m.clipboardText ? String(text || '') : '', preFilled: m.id === 'whatsapp' && !!text };
  }

  /* ---------- ۴) نرمال‌سازی فارسی + آوانگاری دوزبانه ----------
     «وسط مکالمهٔ فارسی ممکنه اسم انگلیسی بگم» — تطبیق دوجهته:
     جدول اسم‌های رایج (علی↔ali) + آوانگاری عمومی کاراکتری دوطرفه +
     اسکلت هم‌خوان‌ها (سیاوش↔siavash). نرمال‌سازی: ي/ك عربی → ی/ک،
     اعراب/نیم‌فاصله حذف، ارقام فارسی → لاتین. */
  function normFa(s) {
    return String(s || '')
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/\u200C/g, '')
      .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/ة/g, 'ه')
      .replace(/[أإٱ]/g, 'ا').replace(/ؤ/g, 'و').replace(/ئ/g, 'ی')
      .replace(/[۰-۹]/g, (ch) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)))
      .replace(/\s+/g, ' ').toLowerCase().trim();
  }
  const FA2LAT = { 'آ': 'a', 'ا': 'a', 'ب': 'b', 'پ': 'p', 'ت': 't', 'ث': 's', 'ج': 'j', 'چ': 'ch', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'z', 'ر': 'r', 'ز': 'z', 'ژ': 'zh', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'z', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'gh', 'ک': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n', 'و': 'v', 'ه': 'h', 'ی': 'i' };
  const LAT2FA = { 'sh': 'ش', 'ch': 'چ', 'kh': 'خ', 'gh': 'غ', 'zh': 'ژ', 'oo': 'و', 'ou': 'و', 'ee': 'ی', 'ay': 'ای', 'ai': 'ای', 'ei': 'ای', 'a': 'ا', 'b': 'ب', 'c': 'ک', 'd': 'د', 'e': 'ای', 'f': 'ف', 'g': 'گ', 'h': 'ه', 'i': 'ای', 'j': 'ج', 'k': 'ک', 'l': 'ل', 'm': 'م', 'n': 'ن', 'o': 'او', 'p': 'پ', 'q': 'ق', 'r': 'ر', 's': 'س', 't': 'ت', 'u': 'یو', 'v': 'و', 'w': 'و', 'x': 'کس', 'y': 'ی', 'z': 'ز' };
  /* v0.70 — فاز ۳: دیکشنری واژه‌محورِ نام‌های رایج — سرچ مخاطب با فرم لاتینِ
     واقعی («میلاد قدوسی» → Milad Ghodousi، «سلفون» → cellphone) */
  const WORD2LAT = { 'علی': 'Ali', 'علیرضا': 'Alireza', 'محمد': 'Mohammad', 'محمدمهدی': 'MohammadMahdi', 'مهدی': 'Mahdi', 'میلاد': 'Milad', 'مجید': 'Majid', 'مصطفی': 'Mostafa', 'سارا': 'Sarah', 'ساره': 'Sara', 'زهرا': 'Zahra', 'فاطمه': 'Fateme', 'فاطی': 'Fati', 'مریم': 'Maryam', 'نرگس': 'Narges', 'نازنین': 'Nazanin', 'شادمهر': 'Shadmehr', 'حسین': 'Hossein', 'حسن': 'Hassan', 'رضا': 'Reza', 'حیدر': 'Heydar', 'ابوالفضل': 'Abolfazl', 'ابوفضل': 'Abolfazl', 'امیر': 'Amir', 'امیرعلی': 'AmirAli', 'قدوسی': 'Ghodousi', 'قاضی': 'Ghazi', 'حسینی': 'Hosseini', 'محمدی': 'Mohammadi', 'رضایی': 'Rezaei', 'حسنی': 'Hasani', 'اکبری': 'Akbari', 'کریمی': 'Karimi', 'موسوی': 'Mousavi', 'سلفون': 'cellphone', 'سامسونگ': 'Samsung', 'شیائومی': 'Xiaomi', 'اپل': 'Apple', 'گوشی': 'phone', 'تلگرام': 'Telegram', 'دیسکورد': 'Discord', 'واتساپ': 'WhatsApp', 'همساده': 'Hamsadeh', 'همسایه': 'Hamsaye', 'اقتصاد': 'Eghtesad', 'آنلاین': 'Online', 'انلاین': 'Online' };
  function faToLatin(s) {
    const n = normFa(s);
    if (!n) return '';
    /* اول واژه‌محور — همهٔ واژه‌ها دیکشنری‌باشند یا عدد؛ وگرنه حرف‌به‌حرف */
    const words = n.split(/\s+/).filter(Boolean);
    if (words.length && words.every((w) => WORD2LAT[w] || /^[0-9]+$/.test(w))) {
      return words.map((w) => WORD2LAT[w] || w).join(' ');
    }
    const t = n.replace(/\s+/g, '');
    let out = '';
    for (const ch of t) out += FA2LAT[ch] || ch;
    return out;
  }
  function latinToFa(s) {
    const t = String(s || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!t) return '';
    let out = '', i = 0;
    while (i < t.length) {
      const two = t.slice(i, i + 2);
      if (LAT2FA[two]) { out += LAT2FA[two]; i += 2; continue; }
      out += LAT2FA[t[i]] || t[i]; i += 1;
    }
    return out;
  }
  function skel(s) { return String(s || '').replace(/[^a-z0-9]/gi, '').toLowerCase().replace(/[aeiou]/g, ''); }
  /* جدول اسم‌های رایج ایران — تلفظ فارسی ↔ نوشتار لاتین */
  const PHON_PAIRS = [
    ['علی', 'ali'], ['رضا', 'reza'], ['حسین', 'hossein', 'hosein', 'hussein', 'hussain'],
    ['حسن', 'hassan', 'hasan'], ['محمد', 'mohammad', 'muhammad', 'mohamed', 'mohammed'],
    ['مهدی', 'mehdi', 'mahdi'], ['امیر', 'amir'], ['احمد', 'ahmad', 'ahmed'],
    ['جواد', 'javad'], ['حامد', 'hamed'], ['صادق', 'sadegh', 'sadeq'],
    ['مصطفی', 'mostafa', 'mustafa'], ['مجید', 'majid'], ['میلاد', 'milad'],
    ['محسن', 'mohsen'], ['محمود', 'mahmoud', 'mahmood'], ['مسعود', 'masoud', 'masood'],
    ['سینا', 'sina'], ['نیما', 'nima'], ['سیاوش', 'siavash', 'siavush'], ['آرش', 'arash'], ['ارش', 'arash'],
    ['آرمان', 'arman'], ['بابک', 'babak'], ['کاوه', 'kaveh'], ['پویا', 'pouya', 'pooya'],
    ['سعید', 'saeed', 'said'], ['حمید', 'hamid'], ['ناصر', 'naser', 'nasser'],
    ['کریم', 'karim'], ['فرهاد', 'farhad'], ['فرید', 'farid'], ['کیان', 'kian'],
    ['یاسر', 'yaser', 'yasser'], ['یوسف', 'yousef', 'yusuf', 'yusef'], ['ایمان', 'iman'],
    ['سارا', 'sara', 'sarah'], ['مریم', 'maryam'], ['زهرا', 'zahra'],
    ['فاطمه', 'fatemeh', 'fateme', 'fatima'], ['نگار', 'negar'], ['الهام', 'elham'],
    ['پریسا', 'parisa'], ['شیما', 'shima'], ['شیرین', 'shirin'], ['سمیرا', 'samira'],
    ['نیلوفر', 'niloofar', 'niloufar'], ['لیلا', 'leila', 'layla'], ['مینا', 'mina'],
    ['جان', 'john', 'jon'], ['پدرام', 'pedram'], ['سهیل', 'soheil'],
  ];
  const LAT2FA_SET = {};
  for (const pp of PHON_PAIRS) {
    const fa = normFa(pp[0]);
    for (const lat of pp.slice(1)) {
      const l = String(lat).toLowerCase();
      (LAT2FA_SET[l] = LAT2FA_SET[l] || []).push(fa);
    }
  }

  /* ---------- ۴ب) تبدیل املایی گفتاری → نوشتار لاتین (v0.69) ----------
     ریشهٔ لاگ: «اول انگلیسی یادداشت کن علی اچ کی وسطشم یه خط فاصله»
     ذخیره شد «اول انگلیسی علی اچ کی…» — کاربر Ali-HK می‌خواست.
     حروف املایی گفتاری (اچ=H، کی=K،…) + علائم گفتاری (خط فاصله=-،
     نقطه=., آندرلاین=_) + اسم‌های جدول (علی=Ali) + جهت‌دهی (وسطش/بینش). */
  const SPELL_LETTERS = [
    ['دبلیو|دبل\\s?یو', 'W'], ['اکس', 'X'], ['وای', 'Y'], ['زد', 'Z'],
    ['کیو', 'Q'], ['اچ', 'H'], ['کی', 'K'], ['جی', 'G|J'], ['اِف|اف', 'F'], ['ال', 'L'], ['ام', 'M'], ['ان', 'N'], ['او', 'O'], ['پی', 'P'], ['آر', 'R'], ['اس', 'S'], ['تی', 'T'], ['یو', 'U'], ['وی', 'V'], ['دی', 'D'], ['بی', 'B'], ['سی', 'C'], ['ای', 'A'],
  ];
  const PUNCT_WORDS = [
    /* ⚠️ در string literal باید \\s بنویسیم — '\s' در JS به «s» ساده تبدیل
       می‌شود و «خط فاصله» هیچ‌وقت علامت شناخته نمی‌شد (باگ واقعی v0.69-بتا) */
    ['خط\\s*فاصله|خط\\s*تیره', '-'],
    ['آندرلاین|زیر\\s?خط', '_'],
    ['نقطه', '.'],
  ];
  const SPELL_TOKEN_RE = new RegExp(
    /* v0.69 — ترتیب حیاتی: اول علامتِ چندکلمه‌ای («خط فاصله»)؛ بعد رشتهٔ فارسیِ کامل
       (وگرنه حروفِ املایی داخلِ نام‌ها می‌خورند: «سیاوش» → سی(C)+او(O) = «CO»!) */
    '(' + PUNCT_WORDS.map((p) => p[0]).join('|') + '|[a-zA-Z0-9]+|[\u0600-\u06FF\u200c]+)', 'gi'
  );
  function _spellToken(tok) {
    const t = normFa(tok);
    if (!t) return { t: '', k: '' };
    for (const [re, v] of PUNCT_WORDS) if (new RegExp('^(?:' + re + ')$', 'i').test(t)) return { t: v, k: 'p' };
    for (const [re, v] of SPELL_LETTERS) if (new RegExp('^(?:' + re + ')$', 'i').test(t)) return { t: v.split('|')[0], k: 'l' };
    if (/^[a-zA-Z0-9]+$/.test(t)) return { t, k: 'w' }; /* لاتین از قبل */
    for (const pp of PHON_PAIRS) { if (t === normFa(pp[0])) return { t: pp[1].split('|')[0].charAt(0).toUpperCase() + pp[1].split('|')[0].slice(1), k: 'n' }; }
    return { t: '', k: '' };
  }
  /* «علی اچ کی وسطشم یه خط فاصله» → { out: 'Ali-HK', dir: 'en' }
     بدون دستورِ انگلیسی → null (متن عادی) */
  function noteLatinOf(text) {
    const s = normFa(String(text || ''));
    if (!s) return null;
    if (!/(انگلیسی|لاتین|english)/i.test(s)) return null;
    /* فقط بخشِ بعد از دستورِ زبانی تبدیل می‌شود */
    const m = s.match(/(?:انگلیسی|لاتین|english)(?:\s*(?:بنویس|بنویسی|یادداشت|بگم|بگو))?(?:\s*(?:کن|کنه))?\s*([\s\S]+)$/i);
    const body = (m && m[1] ? m[1] : s).replace(/(?:وسطش|وسطشم|بینش|بینشوم|بینشون|وسط)(?:م|ش|مان|شان)?\s*(?:یه?\s*)?/g, ' ').trim();
    const toks = body.match(SPELL_TOKEN_RE) || [];
    const parts = [];
    let punct = '';
    for (const tk of toks) {
      const r = _spellToken(tk);
      if (!r.k) continue;
      if (r.k === 'p') { punct = r.t; continue; } /* علامتِ بین اجزا (وسطش/بینش) */
      parts.push({ t: r.t, k: r.k });
    }
    if (!parts.length) return null;
    /* «علی اچ کی … خط فاصله» → Ali-HK — گروه‌بندی: هر اسم/واژه = یک گروه؛
       حروفِ املاییِ پشت‌سرهم = یک گروه؛ علامت فقط «بینِ گروه‌ها» می‌آید
       (ریشهٔ لاگ: «AliH» بی‌خط فاصله ذخیره شد) */
    const groups = [];
    for (const p of parts) {
      const last = groups[groups.length - 1];
      if (p.k === 'l' && last && last.kind === 'l') last.t += p.t;
      else groups.push({ kind: p.k, t: p.t });
    }
    let out;
    if (groups.length === 1) out = groups[0].t;
    else if (punct) out = groups.map((g) => g.t).join(punct);
    else {
      let acc = '';
      for (const g of groups) {
        if (acc && g.kind === 'l') acc += g.t;
        else if (acc) acc += ' ' + g.t;
        else acc = g.t;
      }
      out = acc;
    }
    out = out.trim();
    return out ? { out, dir: 'en' } : null;
  }

  /* ---------- ۵) مخاطبین (نام گفته‌شده → شناسهٔ واقعی) ----------
     settings.msgContacts = [{id, name, app, handle, aliases?}] — از UI
     پنل افزونه‌ها یا فرمان صوتی. تطبیق v3:
     گذر ۰ دقیق (نام/alias/یوزرنیم) → گذر ۱ آوانگاری دوزبانه (علی↔Ali)
     → گذر ۲ لوانشتین محافظه‌کار (نویز STT) → گذر ۳ پیشوند دوطرفه.
     anyApp=true برای حذف (جستجو در همهٔ اپ‌ها). اپ‌های شماره‌محور
     (واتساپ/بله/ایتا/روبیکا) فالبک اشتراک مخاطب دارند. */
  function _lev(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = new Array(n + 1), cur = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      cur[0] = i;
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      const t = prev; prev = cur; cur = t;
    }
    return prev[n];
  }
  function contactFind(contacts, appId, name, anyApp) {
    const q = normFa(name);
    if (!q || q.length < 2) return null;
    const all = (Array.isArray(contacts) ? contacts : []).filter((c) => c && String(c.handle || '').trim());
    if (!all.length) return null;
    const PHONE_APPS = { whatsapp: 1, bale: 1, eitaa: 1, rubika: 1 };
    const sameApp = String(appId || '') ? all.filter((c) => String(c.app || '') === String(appId)) : [];
    let list = sameApp;
    if (!list.length) {
      if (PHONE_APPS[String(appId)]) list = all.filter((c) => PHONE_APPS[String(c.app)]);
      else if (anyApp) list = all;
      else list = [];
    }
    if (!list.length) return null;
    const hdOf = (h) => String(h || '').replace(/^@/, '').toLowerCase().trim();
    function variants(c) {
      const vs = new Set();
      const add = (x) => { const n = normFa(x); if (n && n.length >= 2) { vs.add(n); vs.add(faToLatin(n)); } };
      add(c.name);
      (Array.isArray(c.aliases) ? c.aliases : []).forEach(add);
      return vs;
    }
    const qBare = q.replace(/^@/, '');
    /* گذر ۰ — دقیق: نام/alias/یوزرنیم */
    let hit = list.find((c) => variants(c).has(q) || hdOf(c.handle) === qBare);
    if (hit) return hit;
    /* گذر ۱ — آوانگاری دوزبانه: علی↔Ali، محمد↔Mohammad، جدول + عمومی */
    const qLat = faToLatin(q);
    const qFaCands = new Set();
    if (/^[a-z]/.test(q)) {
      (LAT2FA_SET[qBare] || []).forEach((x) => qFaCands.add(x));
      qFaCands.add(latinToFa(qBare));
    }
    hit = list.find((c) => {
      const vs = variants(c);
      for (const fq of qFaCands) if (vs.has(fq)) return true;
      for (const v of vs) {
        /* v0.70.1 — مقایسهٔ لاتین بی‌حساس به بزرگی حروف (دیکشنری واژه‌محور
           «Milad Ghodousi» می‌دهد؛ سرچ هرگز نباید از سرِ حرف بزرگ جا بماند) */
        if (qLat && String(v).toLowerCase() === qLat.toLowerCase()) return true;
        if (qLat && v.length >= 4 && qLat.length >= 4 && skel(String(v).toLowerCase()) === skel(qLat.toLowerCase())) return true;
      }
      return false;
    });
    if (hit) return hit;
    /* گذر ۲ — لوانشتین محافظه‌کار (نویز STT) روی نام/alias/یوزرنیم */
    hit = list.find((c) => {
      const cands = [...variants(c), hdOf(c.handle)];
      for (const n of cands) {
        if (n.length < 3 || Math.abs(n.length - q.length) > 2) continue;
        /* نام ۳حرفی هم‌طول با فاصلهٔ ≤۱ هم می‌پذیرد (نویز STT روی اسم کوتاه) */
        const tol = n.length >= 9 ? 2 : (n.length >= 4 ? 1 : (n.length === q.length ? 1 : 0));
        if (tol > 0 && _lev(n, q) <= tol) return true;
      }
      return false;
    });
    if (hit) return hit;
    /* گذر ۳ — پیشوند دوطرفه */
    hit = list.find((c) => { for (const n of variants(c)) { if (n.length >= 3 && (n.indexOf(q) === 0 || q.indexOf(n) === 0)) return true; } return false; });
    return hit || null;
  }

  /* ---------- ۶) گرامر مخاطبین صوتی (v0.68) ----------
     «علی رو تو تلگرام با یوزر ali_gh ذخیره کن» / «ذخیره کن رضا رو تو
     واتساپ با شماره ۰۹۱۲…» / «علی رو با آیدی ali_gh ذخیره کن» (اپ
     پیش‌فرض: یوزرنیم→تلگرام، شماره→واتساپ) / «مخاطب علی رو حذف کن» /
     «علی رو از مخاطبین پاک کن» / «مخاطبینمو بخون» / «لیست مخاطبین». */
  /* v0.75 — نقشهٔ اپ برای شاخهٔ آموزش ctCmdParse (کپیِ امن از APP_MAP در app.js) */
  const APP_MAP_FA = { 'تلگرام': 'telegram', 'telegram': 'telegram', 'دیسکورد': 'discord', 'دیسبورد': 'discord', 'discord': 'discord', 'واتساپ': 'whatsapp', 'واتس اپ': 'whatsapp', 'whatsapp': 'whatsapp', 'روبیکا': 'rubika', 'rubika': 'rubika', 'ایتا': 'eitaa', 'eitaa': 'eitaa' };
  function ctCmdParse(cmd) {
    let s = String(cmd || '').trim();
    if (!s || s.length < 8) return null;
    /* جملهٔ ارسال پیام هرگز فرمان مخاطبین نیست (گارد مستقیم) */
    if (/(پیام|پیغام)\s*(بده|بفرست|برسون|برسان)|بگو\s+(که|این)/i.test(s)) return null;
    /* v0.75 — آموزشِ قطعیِ آفلاین مخاطب از شکلِ گفتاری (ریشهٔ لاگ میدانی 0.74):
       «ببین من یک کاربر توی دیسکورد مخاطبمه اسمش تو دیسکورد diyako هست ولی من بهش میگم صدرا»
       به مغز رفت، مغز contact_save خالی با اپِ غلط داد (/telegram/) → ذخیره شکست خورد →
       دوباره «به صدرا پیام بده» هیچ حافظه‌ای نداشت. حالا همین‌جا، بدون AI، ذخیره می‌شود:
       handle = واژهٔ لاتینِ بعد از «اسمش/یوزرش/آیدیش (تو APP)» + nameFa = بعد از «بهش میگم». */
    if (/(?:هست|هستن|میگم|میگیم|صدا\s*می|صداش)/i.test(s) && /(?:اسمش|یوزرش|یوزرنیمش|آیدیش|ایدیش|مخاطبم)/i.test(s)) {
      const APP_RE_S = '(?:تلگرام|telegram|دیسکورد|دیسبورد|discord|واتس ?اپ|whatsapp|روبیکا|rubika|ایتا|eitaa)';
      const _appM2 = s.match(new RegExp(APP_RE_S, 'i'));
      const _appId2 = _appM2 ? (APP_MAP_FA[_appM2[0].toLowerCase().replace(/\s+/g, ' ')] || '') : '';
      let _hdl2 = '';
      /* v0.76 — ریشهٔ لاگ میدانی 0.75 (04:58:07): «اسم مخاطبم تو دیسکورد mmd هست»
         با «اسمش» جور درنمی‌آمد (کلمهٔ «مخاطبم» وسط بود) → آموزش ربوده شد.
         حالا اسم+مخاطبم/مخاطبش/مخاطب هم پذیرفته می‌شود. */
      const _hm1 = s.match(new RegExp('(?:اسم(?:ش?و?|مخاطبم|مخاطبش?|مخاطب)|یوزرش?و?|یوزرنیمش?|آیدیش?|ایدیش?)\\s*(?:تو|توی|در)?\\s*(?:' + APP_RE_S + ')?\\s*(?:یه?\\s*)?([A-Za-z][A-Za-z0-9_.@-]{2,32}(?:\\s+[A-Za-z][A-Za-z0-9_.@-]{2,32}){0,2})', 'i'));
      const _hm2 = _hm1 ? null : s.match(new RegExp('(?:' + APP_RE_S + ')(?:ش|م)?\\s*(?:اسمش?|آیدیش?|ایدیش?|یوزرش?)?\\s*(?:هست\\s*)?([A-Za-z][A-Za-z0-9_.@-]{2,32}(?:\\s+[A-Za-z][A-Za-z0-9_.@-]{2,32}){0,2})', 'i'));
      if (_hm1) _hdl2 = _hm1[1].replace(/^@/, '');
      else if (_hm2) _hdl2 = _hm2[1].replace(/^@/, '');
      let _nm2 = '';
      const _gm = s.match(/(?:بهش|براش|به\s+اون|بهشون)\s+(?:میگم|میگمش|میگیم|صدا\s*می\s*کنم|صداش\s*می\s*کنم)\s+([\u0600-\u06FF][\u0600-\u06FF\u200c]{1,24})/i);
      if (_gm) _nm2 = _gm[1].replace(/[\u200c]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!_nm2) {
        /* v0.76 — نامِ قبل از «صداش می‌کنم»: «من محمد صداش میکنم» (لاگ 0.75:
           نام همیشه بعد از فعل نبود؛ «اسمش mmd هست، من محمد صداش میکنم») */
        const _gb = s.match(/(?:من\s+)?([\u0600-\u06FF][\u0600-\u06FF\u200c]{1,24})\s+(?:صداشو?\s*می\s*کنم|صداش\s*می\s*کنم|صدام\s*هست|صداش\s*هست)/i);
        if (_gb) _nm2 = _gb[1].replace(/[\u200c]/g, ' ').replace(/\s+/g, ' ').trim();
      }
      if (_nm2) _nm2 = _nm2.replace(/(?:\s|^)(خب|خوب|دیگه|ببین|اوکی|باشه)$/i, '').trim();
      /* v0.76 — مستعارِ آموزشی: «هر موقع گفتم محمد» / «هر وقت گفتم پوریا» —
         اسمی که کاربر در آینده می‌گوید و باید همان مخاطب باز شود؛
         اگر نامِ مستقل در جمله نبود، خودِ مستعار نامِ مخاطب می‌شود (شکل
         «اسمش تو تلگرام pourya rahmani هست هر وقت گفتم پوریا»). */
      let _al2 = '';
      const _am2 = s.match(/هر\s*(?:وقت|موقع)(?:ی)?\s*(?:که)?\s*(?:گفتم|میگم|می\s?گم|بگم)\s+([\u0600-\u06FF][\u0600-\u06FF\u200c]{1,24})/i);
      if (_am2) _al2 = _am2[1].replace(/[\u200c]/g, ' ').trim();
      if (!_nm2 && _al2) _nm2 = _al2;
      if (_hdl2 && _nm2 && _appId2) {
        const _out2 = { op: 'save', name: _nm2.slice(0, 40), app: _appId2, handle: _hdl2.slice(0, 80), kind: 'username' };
        if (_al2 && _al2 !== _out2.name) _out2.alias = _al2.slice(0, 40);
        return _out2;
      }
    }
    if (/(ذخیره|ثبت|اضافه|سیو|save|add)/i.test(s) && /کن/i.test(s)) {
      const um = s.match(/(?:با\s*)?(?:یوزر|یوزرنیم|آیدی|ایدی|نام کاربری|username|user)\s*[:\s]*([a-zA-Z0-9_@.]{3,40})/i);
      const pm = s.match(/(?:با\s*)?(?:شماره|موبایل|تلفن|نمبر|number|phone)\s*[:\s]*([0-9۰-۹+][0-9۰-۹+\s]{5,23})/);
      let handle = '';
      let kind = '';
      if (um) { handle = um[1].trim(); kind = 'username'; }
      else if (pm) { handle = phoneLike(pm[1]); kind = 'phone'; }
      if (handle) {
        let appM = MSG_APPS.find((m) => m.re.test(s));
        if (appM && appM.needsLoc && !/(?:تو|در|توی|با)\s*(بله(?!ی)|روبیکا|ایتا)/i.test(s)) appM = null;
        const app = appM ? appM.id : (kind === 'username' ? 'telegram' : 'whatsapp');
        /* نام: عبارتِ قبل از رو/را (شکل اسم-اول و فعل-اول) */
        const wo = s.replace(/(?:با\s*)?(?:یوزر|یوزرنیم|آیدی|ایدی|نام کاربری|username|user)\s*[:\s]*[a-zA-Z0-9_@.]{3,40}/i, ' ').replace(/(?:با\s*)?(?:شماره|موبایل|تلفن|نمبر|number|phone)\s*[:\s]*[0-9۰-۹+\s]{6,24}/i, ' ');
        let name = '';
        /* ⚠️ \s+ قبل از رو/را اجباری — وگرنه نام‌هایی که به «را» ختم می‌شوند
           (سارا، زهرا، نگار) نصف می‌شدند («سارا» → «سا») — باگ واقعی v0.68-بتای داخلی */
        const nm = wo.match(/([آ-ی\u200Ca-zA-Z0-9][آ-ی\u200Ca-zA-Z0-9\s]{0,30}?)\s+(?:رو|را)\s/i);
        if (nm) name = nm[1].trim();
        else {
          const nm2 = wo.match(/(?:ذخیره|ثبت|اضافه|سیو)\s*کن\s+([آ-ی\u200Ca-zA-Z0-9][آ-ی\u200Ca-zA-Z0-9\s]{1,30}?)\s*$/i);
          if (nm2) name = nm2[1].trim();
        }
        /* فعل‌های سرِ نام پشت‌سرهم حذف شوند («ذخیره کن رضا» → «رضا») */
        for (let i = 0; i < 4; i++) {
          const n2 = name.replace(/^(?:مخاطب|کن|ذخیره|ثبت|اضافه|سیو)\s+/i, '').trim();
          if (n2 === name) break;
          name = n2;
        }
        if (name && name.length >= 2) return { op: 'save', name: name.slice(0, 40), app, handle: handle.slice(0, 80), kind };
      }
    }
    const nf = normFa(s);
    if (/(پاک|حذف|بردار|remove|delete)/i.test(nf) && /مخاطب/.test(nf)) {
      let name = '';
      const m1 = s.match(/مخاطب\s+([آ-ی\u200Ca-zA-Z0-9][آ-ی\u200Ca-zA-Z0-9\s]{0,30}?)\s+(?:رو|را)\s/i);
      const m2 = s.match(/([آ-ی\u200Ca-zA-Z0-9][آ-ی\u200Ca-zA-Z0-9\s]{0,30}?)\s+(?:رو|را)\s*(?:از\s*)?مخاطبین/i);
      if (m1) name = m1[1].trim();
      else if (m2) name = m2[1].trim();
      name = name.replace(/^(?:مخاطب|کن|رو)\s+/i, '').trim();
      return { op: 'del', name: (name || '').slice(0, 40) };
    }
    if (/مخاطب|کانتکت/.test(nf)) {
      if (/(بخون|بگو|لیست|چین|چیه|کین|نمایش|نشون|باز|چند|تعداد|list|show)/i.test(nf)) return { op: 'list' };
    }
    if (/^لیست مخاطبین/.test(nf) || /^مخاطبین$/.test(nf)) return { op: 'list' };
    return null;
  }

  /* ---------- ۶.۵) v0.78 — پاپ‌آپ «مخاطب جدید» (ساخت مخاطب وسط مکالمه) ----------
     خواستهٔ کاربر: «یک المان کوچولو که وسط همون مکالمه پاپ بشه»:
     «میخام مخاطب جدید ایجاد کنم برا دیسکورد» → پاپ‌آپ خالی با اپِ پیش‌پر؛
     «میخام یک نفر اد کنی برام به اسم soliiii تو دیسکورد من صداش میکنم داداش» →
     پاپ‌آپ با فیلدهای پیش‌پر (handle=soliiii, app=discord, name=داداش)؛
     آوا جمله را می‌خواند، می‌پرسد «همینه؟» و صدا منتظر تایید/ویرایش/انصراف می‌ماند.
     خروجی: { op:'add-popup', app, appFa, handle, kind, name, warn[] } یا null. */
  function ctAddParse(cmd) {
    let s = String(cmd || '').trim();
    if (!s || s.length < 8) return null;
    /* گارد ۱ — ارسال پیام نیست */
    if (/(پیام|پیغام)\s*(بده|بفرست|برسون|برسان)|\bبگو\s+(?:که|این)|بنویس\s+برام/i.test(s)) return null;
    /* گارد ۲ — شکل کلاسیک با هندل صریح («با یوزر ali_gh ذخیره کن») قلمرو ctCmdParse است */
    if (/(?:با\s*)(?:یوزر|یوزرنیم|آیدی|ایدی|شماره|نمبر|username|number|phone)/i.test(s)) return null;
    /* گارد ۳ — حذف/لیست مخاطبین نیست */
    if (/(حذف|پاک|بردار|بخون|لیست|چین|چند)/i.test(s)) return null;
    const sN = s.replace(/[\u200c]/g, ' ').replace(/\s+/g, ' ').trim();
    /* تریگر — چهار خانوادهٔ جملهٔ طبیعی */
    const trig =
      /(?:مخاطب|کانتکت|contact)[^.]{0,24}(?:جدید|نو|تازه|بساز|ایجاد|اضافه|ثبت|ذخیره|اد\s?کن)/i.test(sN) ||
      /(?:اد\s?کنی?|اضافه\s?کنی?|ایجاد\s?کنی?|بساز(?:ی)?\s*برام)[^.]{0,18}(?:برام|برای\s*من)/i.test(sN) ||
      /(?:میخام|میخوام|می\s?خوام|بخوام)[^.]{0,36}(?:نفر|کسی|یکی|مخاطب|کانتکت)[^.]{0,24}(?:اد|اضافه|بساز|ایجاد|ذخیره|ثبت|معرفی)/i.test(sN) ||
      /* شکل کلاسیک بدون هندل: «ذخیره کن سارا رو تو تلگرام» → پاپ‌آپ با نام+اپ */
      /(?:ذخیره|ثبت|اضافه|سیو)\s*کن\s+[\u0600-\u06FFa-zA-Z][^.]{0,32}?(?:رو|را)\s+(?:تو|توی|در|برا|برای)\s*(?:تلگرام|telegram|دیسکورد|دیسبورد|discord|واتس\s?اپ|whatsapp|روبیکا|rubika|ایتا|eitaa|بله|bale)/i.test(sN);
    if (!trig) return null;
    /* اپ — اولویت: کلمهٔ اپ بلافاصله بعد از تو/توی/در/برا («به اسم soliiii تو دیسکورد»)
       تا «بله»ِ اول جمله به‌عنوان اپ بله گرفته نشود */
    let app = '';
    const _aml = sN.match(new RegExp('(?:تو|توی|در|برا|برای)\s+(' + APP_RE_S_SRC() + ')', 'i'));
    const _amg = _aml ? _aml[1] : (sN.match(new RegExp(APP_RE_S_SRC(), 'i')) || [''])[0];
    if (_amg) app = APP_MAP_FA[_amg.toLowerCase().replace(/\s+/g, ' ')] || '';
    /* هندل — لاتین بعد از «به اسم/با اسم/با یوزر/با آیدی/اسمش/ایدیش …» */
    let handle = '', kind = '';
    const hm = sN.match(/(?:به\s*)?(?:با\s*)?(?:یوزر|یوزرنیم|یوزرش?و?|آیدی|آیدیش?و?|ایدی|ایدیش?و?|اسمش?و?|نامش?و?|user(?:name)?|id)\s+([A-Za-z][A-Za-z0-9_.@-]{2,32}(?:\s+[A-Za-z][A-Za-z0-9_.@-]{2,32}){0,2})/i);
    if (hm) { handle = hm[1].replace(/^@/, '').trim(); kind = 'username'; }
    if (!handle) {
      /* شماره — با کلیدواژه یا موبایل ایرانی/بین‌المللی خالص */
      const pm = sN.match(/(?:شماره|موبایل|تلفن|نمبر)\s*[:\s]*([0-9۰-۹+][0-9۰-۹+\s]{7,23})/) || sN.match(/(\+?\d{10,14})\b/);
      if (pm) { const p = phoneLike(pm[1]); if (p) { handle = p; kind = 'phone'; } }
    }
    if (!handle) {
      /* توکن لاتین تنها («اد کنی برام به اسم soliiii …») */
      const bl = sN.match(/(?:^|\s)([A-Za-z][A-Za-z0-9_.-]{2,32})(?=\s|$)/);
      if (bl && !CTADD_LATIN_BLACK_RE.test(bl[1])) { handle = bl[1].replace(/^@/, ''); kind = 'username'; }
    }
    /* لقب — «من صداش میکنم داداش» / «بهش میگم داداش» / «صداشو بذار داداش» */
    let name = '';
    const g1 = sN.match(/(?:من\s+)?صداش(?:و)?\s*(?:می\s*کنم|میکنم|کنم|میگم|بگم|میگیم|بگین)\s+([\u0600-\u06FF][\u0600-\u06FF\u200c]{1,24})/i);
    const g2 = !g1 ? sN.match(/(?:بهش|براش|به\s+اون|براشون)\s+(?:میگم|بگو|میگین|بگید)\s+([\u0600-\u06FF][\u0600-\u06FF\u200c]{1,24})/i) : null;
    const g3 = !g1 && !g2 ? sN.match(/صداش(?:و)?\s*(?:رو)?\s*(?:بذار|بزار|بکن|کن)\s+([\u0600-\u06FF][\u0600-\u06FF\u200c]{1,24})/i) : null;
    if (g1) name = g1[1];
    else if (g2) name = g2[1];
    else if (g3) name = g3[1];
    if (name) name = name.replace(/(?:\s+|^)(خب|خوب|دیگه|ببین|اوکی|باشه)$/i, '').trim();
    const warn = [];
    /* «به اسم سولی» فارسی — اگر لقب جدا داشت، همین توکن فارسی همان یوزری است
       که کاربر گفت (STT لاتین را فارسی می‌نویسد) → هندل + هشدار لاتین‌بودن */
    if (!handle && kind !== 'phone') {
      const fnm = sN.match(/(?:به\s*)?(?:اسم|نام|یوزرش?|آیدیش?|ایدیش?)\s+([\u0600-\u06FF][\u0600-\u06FF\u200c]{1,24})/i);
      if (fnm && !/^(?:اسم|نام|مخاطب|شخص)$/.test(fnm[1])) {
        handle = fnm[1];
        kind = 'username';
        warn.push('latin-needed');
      }
    } else if (!name) {
      /* «به اسم سارا تو تلگراف ذخیره کن» بدون «صداش میکنم» → همان اسم = لقب */
      const nm2 = sN.match(/(?:به\s*)?(?:اسم|نام)\s+([\u0600-\u06FF][\u0600-\u06FF\u200c]{1,24})/i);
      if (nm2) name = nm2[1];
    }
    /* v0.78 — شکل کلاسیکِ بدون هندل: «ذخیره کن سارا رو تو تلگرام» → نام = مفعول رو/را */
    if (!name) {
      const nm3 = sN.match(/(?:ذخیره|ثبت|اضافه|سیو)\s*کن\s+([\u0600-\u06FF][\u0600-\u06FF\u200c]{1,24}(?:\s+[\u0600-\u06FF][\u0600-\u06FF\u200c]{1,24})?)\s*(?:رو|را)\s/i);
      if (nm3) name = nm3[1].trim();
    }
    /* برچسب فارسی اپ از رجیستری */
    const _appRec = app && appOf ? appOf(app) : null;
    return { op: 'add-popup', app, appFa: _appRec ? _appRec.fa : (app || ''), handle: handle.slice(0, 80), kind, name: (name || '').slice(0, 40), warn };
  }
  /* واژه‌های لاتین قلابی که نباید هندل شوند (توکن‌های عمومی گفتار) */
  const CTADD_LATIN_BLACK_RE = /^(?:ava|ok|okay|okey|id|dm|tv|hd|pc|dc|ai|app|usa|uk|mm|ss|yt|vk|tg|wp|ig|fb|tt|ps|xbox|hdmi|usb|wifi|pdf|mp4|mp3|ram|cpu|vpn|dns|otp|sim|gps|led|lcd|fps|gpu|hdd|ssd|uac|bio)$/i;
  const APP_RE_S_SRC = () => '(?:تلگرام|telegram|دیسکورد|دیسبورد|discord|واتس ?اپ|whatsapp|روبیکا|rubika|ایتا|eitaa|بله(?!ی)|bale)';

  /* تایید/انصراف صوتیِ پاپ‌آپ — عین‌کلمه‌ای (جملهٔ بلند تایید نیست) */
  const CTADD_YES_RE = /^(?:بله|بلله|اره|آره|اکی|اوکی|اوکیه|باشه|تأیید|تایید|تاییده|ذخیره(?:ش)?(?:\s*کن)?|سیو(?:ش)?(?:\s*کن)?|ثبت(?:ش)?(?:\s*کن)?|همینه|همینو|همین(?:ه)?(?:\s*(?:رو|را))?|درسته|صحیح|yes|ok|okay|confirm|save(?:\s*it)?)\s*[.!.؟?]*$/i;
  const CTADD_NO_RE = /^(?:نه|نخیر|کنسل|بی\s?خیال|بیخیال|لغو|منصرف(?:\s*شدم)?|ولش\s?کن|پاکش\s?کن|نخوامش|نمیخوام|نمیخوامش|cancel|no)\s*[.!.؟?]*$/i;

  /* ویرایش صوتی فیلد: «یوزرشو بکن soli2» / «اسمشو بکن سارا» / «برا واتساپه»
     خروجی { field: 'app'|'handle'|'name', value, kind?, warn? } یا null */
  function ctAddEditParse(cmd) {
    const s = String(cmd || '').replace(/[\u200c]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s) return null;
    /* اپ: «برا واتساپه» / «اپشو بکن تلگرام» / «تلگرام باشه» */
    const am = s.match(/(?:برا|برای|اپ(?:ش)?و?|پیام\s?رسان(?:ش)?)\s*(?:هم)?\s*(?:بشه|بکن|کن|هست)?\s*(تلگرام|telegram|دیسکورد|دیسبورد|discord|واتس\s?اپ|whatsapp|روبیکا|rubika|ایتا|eitaa|بله(?!ی)|bale)/i);
    if (am && /برا|اپ|پیام\s?رسان|بشه|بکن|کن|باشه/i.test(s)) {
      const id = APP_MAP_FA[am[1].toLowerCase().replace(/\s+/g, ' ')];
      if (id) return { field: 'app', value: id };
    }
    /* هندل: «یوزرشو بکن soli_2» / «آیدیش رو عوض کن به x» / «شماره‌شو بکن 0912…» */
    const hm = s.match(/(?:یوزرش?و?|یوزرنیمش?|آیدیش?و?|ایدیش?و?|شماره(?:ش)?و?|user(?:name)?)\s*(?:رو)?\s*(?:عوض\s*کن|تغییر\s*بده|بکن|کن|بذار|بزار|بشه|بساز)?\s*(?:به\s*)?([A-Za-z][A-Za-z0-9_.@-]{2,32}|\+?[0-9۰-۹][0-9۰-۹\s]{7,23})/i);
    if (hm) {
      const v = hm[1].trim();
      if (/^[0-9۰-۹+]/.test(v)) { const p = phoneLike(v); if (p) return { field: 'handle', value: p, kind: 'phone' }; }
      return { field: 'handle', value: v.replace(/^@/, ''), kind: 'username' };
    }
    /* لقب: «اسمشو بکن سارا» / «صداشو بذار داداش» / «من صداش میکنم علی» */
    const nm = s.match(/(?:اسمش?و?|لقبش?و?|صداش(?:و)?|نامش?و?)\s*(?:رو)?\s*(?:عوض\s*کن|تغییر\s*بده|بکن|کن|بذار|بزار|بشه)?\s*(?:به\s*)?([\u0600-\u06FF][\u0600-\u06FF\u200c]{1,24})/i);
    if (nm && !/^(?:عوض|تغییر|بکن|کن|بذار|بزار|بشه|به)$/.test(nm[1])) return { field: 'name', value: nm[1] };
    const nm2 = s.match(/(?:من\s+)?صداش(?:و)?\s*(?:می\s*کنم|میکنم|کنم|میگم|بگم)\s+([\u0600-\u06FF][\u0600-\u06FF\u200c]{1,24})/i);
    if (nm2) return { field: 'name', value: nm2[1] };
    return null;
  }

  /* برداشتنِ مقدارِ فیلد از جملهٔ آزاد (وقتی آوا منتظر یک فیلد است):
     «soliiii» → handle؛ «سارا» در مرحلهٔ name → name؛ «شماره 0912…» → handle …
     خروجی { field, value, kind?, warn? } یا null — stage ∈ app|handle|name|confirm */
  function ctAddValueOf(cmd, stage) {
    const s = String(cmd || '').replace(/[\u200c]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s) return null;
    const ed = ctAddEditParse(s);
    if (ed) return ed;
    const g = s.match(/(?:من\s+)?صداش(?:و)?\s*(?:می\s*کنم|میکنم|کنم|میگم|بگم)\s+([\u0600-\u06FF][\u0600-\u06FF\u200c]{1,24})/i);
    if (g) return { field: 'name', value: g[1] };
    const g2 = s.match(/(?:بهش|براش|به\s+اون)\s+(?:میگم|بگو)\s+([\u0600-\u06FF][\u0600-\u06FF\u200c]{1,24})/i);
    if (g2) return { field: 'name', value: g2[1] };
    const pm = s.match(/(?:شماره|موبایل|تلفن|نمبر)\s*[:\s]*([0-9۰-۹+][0-9۰-۹+\s]{7,23})/);
    if (pm) { const p = phoneLike(pm[1]); if (p) return { field: 'handle', kind: 'phone', value: p }; }
    const hm = s.match(/(?:یوزرش?و?|یوزرنیمش?|آیدیش?و?|ایدیش?و?|user(?:name)?)\s+(?:هست\s*)?([A-Za-z][A-Za-z0-9_.@-]{2,32})/i);
    if (hm) return { field: 'handle', kind: 'username', value: hm[1].replace(/^@/, '') };
    const bare = s.match(/(?:^|\s)(@?[A-Za-z][A-Za-z0-9_.-]{2,32})(?=\s|$)/);
    if (bare && !CTADD_LATIN_BLACK_RE.test(bare[1]) && stage !== 'name') return { field: 'handle', kind: 'username', value: bare[1].replace(/^@/, '') };
    const fp = s.match(/^([\u0600-\u06FF][\u0600-\u06FF\u200c]{1,24})$/);
    if (fp) {
      if (stage === 'handle') return { field: 'handle', kind: 'username', value: fp[1], warn: ['latin-needed'] };
      if (stage === 'name') return { field: 'name', value: fp[1] };
    }
    return null;
  }

  /* ---------- ۷) توابع کمکی قطعی مسیریابی ---------- */
  /* یوزرنیم لاتین معتبر تلگرام/دیسکورد (برای فالبک deep-link بعد از NO_TG)
     — @ ابتدای یوزرنیم هم پذیرفته می‌شود (STT هرگز @ نمی‌دهد؛ ورودی دستی می‌دهد) */
  function isLatinUsername(s) {
    return /^[a-zA-Z][a-zA-Z0-9_.@]{2,32}$/.test(String(s || '').trim().replace(/^@/, ''));
  }
  /* شمارهٔ تلفن قابل‌قبول (۸+ رقم، ارقام فارسی هم پذیرفته می‌شود) */
  function phoneLike(s) {
    const d = String(s || '').replace(/[۰-۹]/g, (ch) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch))).replace(/[^0-9+]/g, '');
    return d.replace(/\+/g, '').length >= 8 ? d.replace(/\+/g, '') : '';
  }
  /* v0.73 — لاتین‌اولِ پایدار (stable partition): واریانت‌های لاتین جلو، فارسی عقب.
     ریشهٔ لاگ میدانی 0.72: «همون اسم فارسی ک خودم میگمو مینویسه.. ن اونی ک ذخیره شده» —
     هویتِ ذخیره‌شده (مخاطب/فکت) پشتِ اسمِ گفته‌شده می‌ماند و هرگز نوبتش نمی‌رسید.
     ترتیب نسبی داخل هر گروه حفظ می‌شود؛ تکراری‌ها هم از قبل با _pushV حذف شده‌اند. */
  function latinFirstOrder(vs) {
    const list = (Array.isArray(vs) ? vs : []).map((x) => String(x || '').trim()).filter(Boolean);
    const lat = list.filter((x) => /[A-Za-z]/.test(x));
    const fao = list.filter((x) => !/[A-Za-z]/.test(x));
    return lat.concat(fao);
  }

  /* ---------- ۸) v0.75 — گاردها و گرامرهای جدید ---------- */
  /* گارد هدفِ مشکوک — ریشهٔ لاگ 0.74: «صد» (بریدهٔ صدرا) مستقیم به سوییچر دیسکورد
     رفت، با HIT زیررشته‌ای جور درآمد و پیام برای آدمِ اشتباه فرستاده شد.
     هدفی که نه در مخاطبین است نه شکلِ یک اسم واقعی دارد → ارسال نمی‌شود؛
     صادقانه می‌پرسیم/آموزش ذخیره می‌دهیم. */
  const FA_NUM_WORD_RE = /^(?:صد|دویست|سیصد|چهارصد|پانصد|پنجصد|ششصد|هفتصد|هشتصد|نهصد|هزار|میلیون|میلیارد|ده|یازده|دوازده|سی|چهل|پنجاه|شصت|هفتاد|هشتاد|نود|تا|دونه|بار)$/i;
  const COMMON_NONAME_RE = /^(?:سلام|تست|هیچ|چیز|چیزی|خب|خوب|باشه|اوکی|اکی|الان|حالا|چند|کجاست|چیه|چرا|خیلی)$/i;
  function suspiciousTarget(t) {
    const s = String(t || '').trim();
    if (!s) return true;
    if (/[A-Za-z]/.test(s)) return false; /* لاتین (یوزرنیم/اسم لاتین) معتبر است */
    if (isLatinUsername(s)) return false;
    if (phoneLike(s)) return false;
    const n = normFa(s);
    if (n.replace(/\s+/g, '').length < 3) return true; /* «صد»، «آر» … */
    if (FA_NUM_WORD_RE.test(n)) return true;
    if (COMMON_NONAME_RE.test(n)) return true;
    return false;
  }

  /* v0.75 — «چت X رو تو تلگرام/دیسکورد باز کن» — بازکردنِ چت بدون ارسال پیام.
     ریشهٔ خواسته: کاربر قبل از پیام‌دادن می‌خواهد خودش چت را ببیند؛ تا حالا
     هیچ گرامری برای این وجود نداشت و جمله به مغز/بازکردنِ اپِ خالی می‌افتاد. */
  function chatOpenParse(cmd) {
    let s = String(cmd || '').trim();
    if (!s || s.length < 10) return null;
    if (/(پیام|پیغام|بگو|بنویس|بفرست|برسون|برسان|تایپ|سرچ)/i.test(s)) return null; /* نیت ارسال/سرچ نیست */
    if (!/(?:باز\s*(?:کن|شو|شه)|بیار|بکش|بکش\s*بالا|برو|سری\s*بزن|سر\s*بزن)/i.test(s)) return null;
    let appM = MSG_APPS.find((m) => m.re.test(s));
    if (!appM) return null;
    if (appM.needsLoc && !/(?:تو|در|توی|با)\s*(بله(?!ی)|روبیکا|ایتا)/i.test(s)) return null;
    /* شکل ۱ — «چت X رو تو APP باز کن» */
    let m = s.match(/(?:چت|گفتگو)\s+(?:با\s+)?((?:[\u0600-\u06FFa-zA-Z0-9._@]{2,30})(?:\s+[\u0600-\u06FFa-zA-Z0-9._@]{2,30}){0,2})\s*(?:رو|را)?\s+(?:تو|توی|در)/i);
    if (!m) {
      /* شکل ۲ — «تو APP چت X رو باز کن» */
      m = s.match(/(?:تو|توی|در)\s+[\u0600-\u06FFa-zA-Z]+\s+(?:چت|گفتگو)\s+(?:با\s+)?((?:[\u0600-\u06FFa-zA-Z0-9._@]{2,30})(?:\s+[\u0600-\u06FFa-zA-Z0-9._@]{2,30}){0,2})/i);
    }
    if (!m) return null;
    let target = stripStopTail(m[1]);
    target = target.replace(/\s+(?:رو|را)$/i, '').trim();
    if (!target || /^(?:اسم|نام|مخاطب|شخص|من|تو)$/i.test(target)) return null;
    if (suspiciousTarget(target)) return null;
    return { app: appM.id, appFa: appM.fa, target };
  }

  /* v0.75 — «کی برام پیام داده؟» / «پیام‌های جدید» — خواندن چت‌های اخیر (مرحلهٔ ۳
     پیام‌رسانی — قدم اول فقط-خواندنی). فعلاً فقط تلگرام اتوماسیونِ خواندن دارد؛
     دیسکورد صادقانه «خواندن ندارم» می‌گیرد (app='discord' برمی‌گردد). */
  function msgReadParse(cmd) {
    const s = String(cmd || '').trim();
    if (!s || s.length < 8) return null;
    const hit = /(کی\s*(برام|برای\s*من)?\s*(پیام|مسیج|چت))|(پیام\s*(داده|فرستاده|نوشته|دارم))|((پیام|مسیج|چت|گفتگو)\s*(?:های|ها)?\s*(جدید|نو|اخیر|آخر|خونده\s*نشده|ناشده|تازه))|(لیست\s*(چت|گفتگو|پیام))|(آخرین\s*(چت|گفتگو|پیام))/i;
    if (!hit.test(s)) return null;
    const appM = MSG_APPS.find((m) => m.re.test(s));
    return { app: appM ? appM.id : 'telegram', appFa: appM ? appM.fa : 'تلگرام' };
  }

  const api = { msgAppsOf, detectInstalled, appOf, msgParse, msgBuild, contactFind, ctCmdParse, ctAddParse, ctAddEditParse, ctAddValueOf, CTADD_YES_RE, CTADD_NO_RE, normFa, faToLatin, latinToFa, noteLatinOf, isLatinUsername, phoneLike, latinFirstOrder, stripStopTail, suspiciousTarget, chatOpenParse, msgReadParse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AVAMessaging = api;
})(typeof window !== 'undefined' ? window : null);
