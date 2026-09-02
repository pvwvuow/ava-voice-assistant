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
    { id: 'telegram', fa: 'تلگرام', re: /تلگرام|telegram/i, procs: ['Telegram', 'TelegramDesktop', '64Gram'], link: (t) => 'https://t.me/' + t, desktopLink: (t) => 'tg://resolve?domain=' + t, clipboardText: true, auto: true },
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
     و دستورِ زبانی داخل متن («چطوری اسمشو انگلیسی بنویس کامل» — دستور به‌جای متن ارسال شد!) */
  const LEAD_FILLER_RE = /^(?:خوب|خب|حالا|ببین|ببینید|آفرین|افرین|باشه|اوکی|لطفا|لطفاً|داداش|حاجی|اقا|آقا|اول|اولش|راستی)(?:\s+(?:که|دیگه))*(?=\s|$)\s*/i;
  const META_LANG_RE = /(?:اسمشو?|اسماشو?|اسم\s*(?:او|رو|را)|نامشو?)?\s*(?:کامل|درست|خب)?\s*(?:به|به\s*صورت|با)?\s*(?:حروف\s*)?(?:انگلیسی|لاتین|فارسی|english)\s*(?:بنویس|بنویسی|بنویسید|بنویسش|بنیویس|بنویسین)(?:\s*(?:کامل|درست|دیگه|خب|جان))*|(?:بنویس|بنویسی)\s*(?:اسمشو?|اسم\s*رو|اسم\s*را)?\s*(?:به\s*)?(?:انگلیسی|لاتین|فارسی)/i;
  function normWord(s) {
    return String(s || '').toLowerCase().replace(/\u200C/g, ' ').replace(/\s+/g, ' ').trim();
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
    /* مقصد: «به X» — تا ۳ کلمهٔ نامی؛ سپس دُمِ فعل/حرف اضافه بریده می‌شود */
    let target = '';
    let targetRef = false; /* «به همین اسم / همون مخاطب» — مقصد باید از حافظه حل شود */
    const woApp = s.replace(appM.re, ' ').replace(/(?:به|برای|برا)\s+(?:همین|همون|همان|اون|این)\s+/gi, 'به ');
    const tm2 = woApp.match(/(?:به|برای|برا)\s+((?:[\u0600-\u06FFa-zA-Z0-9._@]{2,30})(?:\s+[\u0600-\u06FFa-zA-Z0-9._@]{2,30}){0,2})/i);
    if (tm2) {
      target = tm2[1].replace(STOP_TAIL_RE, '').trim();
      target = target.replace(/\s*(پیام|پیغام|بگو|بنویس|متن|برسون|برسان|بفرست)[\s\S]*$/i, '').trim();
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
  function faToLatin(s) {
    const t = normFa(s).replace(/\s+/g, '');
    if (!t) return '';
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
        if (qLat && v === qLat) return true;
        if (qLat && v.length >= 4 && qLat.length >= 4 && skel(v) === skel(qLat)) return true;
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
  function ctCmdParse(cmd) {
    let s = String(cmd || '').trim();
    if (!s || s.length < 8) return null;
    /* جملهٔ ارسال پیام هرگز فرمان مخاطبین نیست (گارد مستقیم) */
    if (/(پیام|پیغام)\s*(بده|بفرست|برسون|برسان)|بگو\s+(که|این)/i.test(s)) return null;
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

  const api = { msgAppsOf, detectInstalled, appOf, msgParse, msgBuild, contactFind, ctCmdParse, normFa, faToLatin, latinToFa, noteLatinOf, isLatinUsername, phoneLike };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AVAMessaging = api;
})(typeof window !== 'undefined' ? window : null);
