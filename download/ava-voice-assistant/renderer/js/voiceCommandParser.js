'use strict';
/* ============================================================
   آوا — voiceCommandParser (v0.37) — پارسر فرمان‌های صوتی PiP
   ------------------------------------------------------------
   ورودی: متن خروجی speech-to-text (+ زمینهٔ پنجرهٔ PiP)
   خروجی: { intent, entities:{position?, size?, opacity?} } یا null

   Intent ها:
     PIN_VIDEO  UNPIN_VIDEO  MOVE_PIP  RESIZE_PIP  OPACITY_PIP
     CLICK_THROUGH_ON  CLICK_THROUGH_OFF  ALWAYS_ON_TOP_ON
     ALWAYS_ON_TOP_OFF  RESET_PIP

   Entity ها:
     position: top-right | top-left | bottom-right | bottom-left |
               center | top-center | bottom-center
     size:     small | medium | large | extra-large  (یا bigger/smaller نسبی)
     opacity:  0.3 | 0.5 | 0.7 | 1

   گاردهای ضد-ربایش (خیلی مهم):
     فرمان‌های «خام» مثل «ببندش» یا «بزرگش کن» فقط وقتی به PiP تعبیر
     می‌شوند که یا (الف) واژهٔ لنگرِ PiP در جمله باشد (پین/شناور/ویدیو/…)،
     یا (ب) پنجرهٔ PiP همین حالا باز باشد (ctx.pipOpen)، یا (ج) فعلِ
     جابجایی/تنظیم صریح باشد. در غیر این صورت null برمی‌گردد تا جمله
     به هوش مصنوعی برود — نه اینکه بی‌جهت پنجره‌ای را بردارد.

   در مرورگر روی window.AVAVoice می‌نشیند و در Node هم module.exports
   دارد تا تست‌های رگرسیون بدون Electron اجرا کنند.
   ============================================================ */
(function (root) {
  /* ---------- نرمال‌سازی فارسی/انگلیسی ---------- */
  function normFa(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[\u200c\u200f\u200e]/g, ' ')                       /* نیم‌فاصله/نشانه‌های RTL */
      .replace(/[يىﻯﻰﻱ]/g, 'ی').replace(/ك/g, 'ک')                 /* عربی → فارسی */
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))    /* ارقام فارسی */
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))    /* ارقام عربی */
      .replace(/\u00a0/g, ' ')
      .replace(/[.،؛!؟?]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const INTENTS = {
    PIN: 'PIN_VIDEO', UNPIN: 'UNPIN_VIDEO', MOVE: 'MOVE_PIP', RESIZE: 'RESIZE_PIP',
    OPACITY: 'OPACITY_PIP', CT_ON: 'CLICK_THROUGH_ON', CT_OFF: 'CLICK_THROUGH_OFF',
    TOP_ON: 'ALWAYS_ON_TOP_ON', TOP_OFF: 'ALWAYS_ON_TOP_OFF', RESET: 'RESET_PIP',
  };

  /* واژهٔ لنگر: حاضر بودن موضوع «ویدیوی شناور» در جمله */
  const ANCHOR_RE = /پین|شناور|فیپ|پی\s?ای\s?پی|پی\s?اِی\s?پی|picture\s?in\s?picture|ویدیو|فیلم|کلیپ|clip|video|movie|float|\bpip\b/i;

  /* v0.40 — واژه‌های تنظیمی: جمله‌ای که آن‌ها را دارد فرمانِ «پین کردن» نیست
     («پین رو واضح‌ترش کن» دیگر PIN_VIDEO نمی‌خورد — گزارش واقعی کاربر) */
  const TUNE_RE = /واضح|شفاف|کم\s?رنگ|تار|محو|اپسیتی|اوپسیتی|شیشه|روشن\s?تر|بزرگ|کوچک|متوسط|opacity/i;

  /* فعلِ تنظیم/جابجایی صریح */
  const VERB_RE = /ببرش?|بذار|بزار|بیارش?|بنداز|تنظیم|بچسبون|جابجا|move|put|set|place|bring|pin|float/i;

  /* v0.38.1 — «پینگ» دیگر پین حساب نمی‌شود: «پینگ گوگل چنده» پنجرهٔ شناور باز نمی‌کرد */
  const UNPIN_RE = /بردار|ببند|بنده?ش|قطعش? کن|جدا کن|درش بیار|بندازش بیرون|خاموشش? کن از صفحه|unpin|close pip|hide pip|remove (the )?(pip|pin)|close (the )?(video|pip|pin)/i;
  const PIN_RE = /پین(?!گ)|شناور|فیپ|پی\s?ای\s?پی|picture\s?in\s?picture|\bpip\b|float (it|video)|pin (the )?(video|youtube|movie|clip)/i;

  const POS_WORDS = {
    top: /بالا|top/i, bottom: /پایین|زیر|bottom|down/i,
    left: /چپ|left/i, right: /راست|right/i,
    center: /وسط|مرکز|center|middle/i,
  };

  function positionOf(n) {
    const hasTop = POS_WORDS.top.test(n), hasBottom = POS_WORDS.bottom.test(n);
    const hasLeft = POS_WORDS.left.test(n), hasRight = POS_WORDS.right.test(n);
    const hasCenter = POS_WORDS.center.test(n);
    if (hasCenter && !hasTop && !hasBottom && !hasLeft && !hasRight) return 'center';
    if (hasTop && hasCenter) return 'top-center';
    if (hasBottom && hasCenter) return 'bottom-center';
    if (hasTop && hasRight) return 'top-right';
    if (hasTop && hasLeft) return 'top-left';
    if (hasBottom && hasRight) return 'bottom-right';
    if (hasBottom && hasLeft) return 'bottom-left';
    if (hasTop && !hasBottom && !hasLeft && !hasRight) return 'top-center';   /* «ببرش بالا» */
    if (hasBottom && !hasTop && !hasLeft && !hasRight) return 'bottom-center'; /* «ببرش پایین» */
    if (hasRight && !hasLeft) return 'top-right';   /* «ببرش راست» */
    if (hasLeft && !hasRight) return 'top-left';
    return null;
  }

  /* شفافیت: اعداد + واژه‌ها (پنجاه=50، هفتاد=70، سی=30، صد=100)
     v0.40 — گزارش کاربر (activity.log): «پین رو واضح‌ترش کن» و «اپسیتی فیفتی»
     هیچ‌کدام شفافیت نمی‌شد و «پین…» حتی PINVIDEO می‌خورد! خانوادهٔ «واضح»
     (شفاف‌تر شدن = opaquer) و «اپسیتی» (تلفظ opacity) و «فیفتی» اضافه شد؛
     حالت‌های «تر» نسبی‌اند و به ctx.opacity پله می‌خورند. */
  const OP_STEPS = [0.3, 0.5, 0.7, 1];
  function stepFrom(cur, dir) {
    const i = OP_STEPS.indexOf(Number(cur) || 1);
    const j = OP_STEPS.indexOf(Number(cur) || 1) >= 0 ? i : OP_STEPS.length - 1; /* نامعلوم = کامل */
    return OP_STEPS[Math.max(0, Math.min(OP_STEPS.length - 1, j + dir))];
  }
  function opacityOf(n, c) {
    const ctx = c || {};
    if (/(کامل|بدون شفافیت|غیر\s?شفاف|کاملا)/.test(n) && /شفاف|نشون|نمایش|واضح/.test(n)) return 1;
    if (/نیمه|نصف|half/.test(n) && /شفاف|اپسیتی/.test(n)) return 0.5;
    /* واضح‌تر/روشن‌تر = رو به کامل (بالا)؛ شفاف‌تر/کم‌رنگ‌تر/محو = رو به محو (پایین) */
    if (/(واضح\s?ترش?|واضح\s?تر|روشن\s?ترش?|روشن\s?تر|clearer|more solid)/i.test(n)) return stepFrom(ctx.opacity, +1);
    if (/(شفافش|کم\s?رنگش|شیشه\s?ایش?|شفاف کن|کم\s?رنگ کن|transparent)/.test(n)) return 0.5;
    if (/(شفاف\s?ترش?|کم\s?رنگ\s?ترش?|محو\s?ترش?|تار\s?ترش?)/.test(n)) return stepFrom(ctx.opacity, -1);
    if (/شیشه\s?ای|شیشه‌ای/.test(n)) return 0.5;
    /* «اپسیتی/اوپسیتی» بدون مقدار = یک پله واضح‌تر (درخواست واقعی کاربر:
        «اپسیتی رو تغییر بده» — هر تغییری از هیچ بهتر است؛ اگر روی کامل
        باشد یک پله محو می‌کنیم تا تغییری واقعاً دیده شود) */
    const opWord = '(?:شفافیت|شفاف|اپسیتی|اوپسیتی|اوپاسیتی|opacity)';
    if (new RegExp(opWord + '[^.]{0,10}(تغییر|عوض)').test(n)) {
      let nv = stepFrom(ctx.opacity, +1);
      if (nv >= 1 && (ctx.opacity == null || Number(ctx.opacity) >= 1)) nv = 0.7;
      return nv;
    }
    const words = { 'سی': 30, 'پنجاه': 50, 'فیفتی': 50, 'فتی': 50, 'هفتاد': 70, 'سونتی': 70, 'صد': 100, 'هانرد': 100, 'fifty': 50, 'seventy': 70, 'thirty': 30, 'hundred': 100 };
    for (const w of Object.keys(words)) {
      if (new RegExp(opWord + '[^.]{0,12}' + w + '|' + w + '[^.]{0,10}(درصد|percent)|opacity\\s*' + w, 'i').test(n)) {
        return words[w] / 100;
      }
    }
    /* [^.\d] تا عددِ آخر جمله بلعیده نشود («opacity 50» → 50 نه 0) */
    const dm = n.match(new RegExp(opWord + '[^.\\d]{0,12}(\\d{1,3})|(\\d{1,3})[^.]{0,10}(?:درصد|percent)', 'i'));
    if (dm) {
      const v = parseInt(dm[1] || dm[2], 10);
      if (v >= 0 && v <= 100) {
        let best = 1, bestD = Infinity;
        for (const s of OP_STEPS) { const d = Math.abs(v - s * 100); if (d < bestD) { bestD = d; best = s; } }
        return best;
      }
    }
    if (/make it transparent|more transparent/i.test(n)) return 0.5;
    if (/opacity (30|50|70|100)/i.test(n)) return parseInt(n.match(/opacity (30|50|70|100)/i)[1], 10) / 100;
    return null;
  }

  /* v0.40 — سوالِ «چجوری/چطور می‌تونم…؟» هرگز اقدام مستقیم نیست:
     «چجوری ویدیو رو پین کنم؟» باید راهنما/AI شود، نه اینکه همین الان پین شود */
  const HOW_Q_RE = /چ(?:جور|طور|گونه)|چطوری|چگونه|how (do|can|to) i?\b/i;

  /* اندازه: مطلق یا نسبی (بزرگش/کوچیکش) */
  function sizeOf(n) {
    if (/خیلی\s?بزرگ|extra\s?large|\bxl\b|huge/.test(n)) return 'extra-large';
    if (/خیلی\s?کوچیک|خیلی\s?کوچک|tiny|very small/.test(n)) return 'small';
    if (/متوسط|medium/.test(n)) return 'medium';
    if (/\blarge\b|بزرگش? کن$|بزرگ کن$/.test(n) && !/کوچ/.test(n)) return 'large';
    if (/\bsmall\b/.test(n)) return 'small';
    /* نسبی: بزرگتر/کوچکتر — با ctx.size به مقدار مطلق تبدیل می‌شود */
    if (/(بزرگ.?تر|بزرگش|بزرگ کن|bigger|larger)/.test(n)) return 'bigger';
    if (/(کوچیک.?تر|کوچک.?تر|کوچیکش|کوچکش|کوچیک کن|کوچک کن|smaller)/.test(n)) return 'smaller';
    return null;
  }

  /* پارسر اصلی — ctx = { pipOpen:boolean, size?:'small'|'medium'|'large'|'extra-large' } */
  function parseVoiceCommand(text, ctx) {
    const n = normFa(text);
    if (!n) return null;
    const c = ctx || {};
    const anchored = ANCHOR_RE.test(n);
    const verb = VERB_RE.test(n);
    if (HOW_Q_RE.test(n)) return null; /* v0.40 — سوال روش، نه فرمان */

    /* ۱) ریست */
    if (/ریستش? کن|ریست پیک|حالت پیش\s?فرض|برگردون حالت|reset pip|back to default/.test(n) && (anchored || verb || c.pipOpen)) {
      return { intent: INTENTS.RESET, entities: {} };
    }

    /* ۲) کلیک‌پذیری — دقت کن: «کلیک روش رو ببند» = قفل (عبور کلیک) ولی
          «کلیک روش فعال باشه» = باز (کلیک روی پنجره کار کند) */
    const ctOn = /کلیک[^.]{0,12}(ببند|رد\s?بشه|رد\s?شه|عبور|رد بشه|پشتش)|مزاحم کلیک نباشه|کلیکش? رو ببند|کلیک نخوره|click\s?-?through (on|enable)|disable mouse/i.test(n);
    const ctOff = /کلیک[^.]{0,14}(فعال|باز|کار کنه)|click\s?-?through off|enable (mouse|click)|unlock click/i.test(n);
    if ((ctOn || ctOff) && (anchored || c.pipOpen || /کلیک/.test(n))) {
      if (ctOff && !ctOn) return { intent: INTENTS.CT_OFF, entities: {} };
      if (ctOn) return { intent: INTENTS.CT_ON, entities: {} };
    }

    /* ۳) همیشه رو صفحه — «نباشه» اولویت دارد تا «دیگه همیشه بالا نباشه»
          به‌اشتباه TOP_ON نشود؛ فعل صریح (بذار همیشه…) هم گارد است */
    const topOff = /همیشه[^.]{0,10}(نباشه|نمونه|بردار)|always on top off|stop being on top/i.test(n);
    const topOn = /همیشه (رو|روی|بالا)|بذار همیشه|always on top/i.test(n);
    if ((topOn || topOff) && (anchored || verb || c.pipOpen)) {
      return { intent: topOff ? INTENTS.TOP_OFF : INTENTS.TOP_ON, entities: {} };
    }

    /* ۴) برداشتن از صفحه — «ببندش»/«بردارش» فقط با لنگر یا PiP باز؛
          v0.38.1: «از پلی‌لیست بردار» نباید پنجرهٔ شناور را بردارد */
    if (UNPIN_RE.test(n) && (anchored || c.pipOpen) && !/پلی\s?لیست|\bلیست\b|از\s+(سبد|گروه)/.test(n)) {
      return { intent: INTENTS.UNPIN, entities: {} };
    }

    /* ۵) شفافیت — «شفافش/کم‌رنگش/واضح‌ترش/اپسیتی» خودش کافی است
          (به غیر از PiP معنای دیگری ندارد — ریشهٔ «پین رو واضح‌ترش کن»
          که PIN اشتباه می‌خورد) */
    const op = opacityOf(n, c);
    if (op !== null && (anchored || c.pipOpen || /شفافیت|شفافش|کم\s?رنگش|واضح|اپسیتی|اوپسیتی|شیشه|opacity/.test(n))) {
      return { intent: INTENTS.OPACITY, entities: { opacity: op } };
    }

    /* ۶) اندازه */
    const sz = sizeOf(n);
    const pos = positionOf(n);
    if (sz && (anchored || c.pipOpen || verb)) {
      /* نسبی → مطلق با وضعیت فعلی (ctx.size) */
      const order = ['small', 'medium', 'large', 'extra-large'];
      let size = sz;
      if (sz === 'bigger' || sz === 'smaller') {
        if (c.size && order.includes(c.size)) {
          const i = order.indexOf(c.size);
          size = sz === 'bigger' ? order[Math.min(order.length - 1, i + 1)] : order[Math.max(0, i - 1)];
        } else {
          size = sz === 'bigger' ? 'large' : 'small'; /* بدون زمینه: نزدیک‌ترین مفهوم */
        }
      }
      /* «بزرگش کن بالا راست» — هم جابجایی هم اندازه در یک جمله */
      if (pos) return { intent: INTENTS.MOVE, entities: { position: pos, size } };
      return { intent: INTENTS.RESIZE, entities: { size } };
    }

    /* ۷) جابجایی — نیاز به فعل/لنگر/PiP باز؛ «بالا راست» تنها با PiP باز */
    if (pos && (verb || anchored || c.pipOpen)) {
      return { intent: INTENTS.MOVE, entities: { position: pos } };
    }

    /* ۸) پین کردن — v0.40: جملهٔ تنظیمی («پین رو واضح‌ترش کن») دیگر پین نیست */
    if (PIN_RE.test(n) && !UNPIN_RE.test(n) && !TUNE_RE.test(n)) {
      return { intent: INTENTS.PIN, entities: pos ? { position: pos } : {} };
    }

    return null;
  }

  /* دروازهٔ قانون در RULES — کمی بازتر است تا جمله به پارسر برسد؛
     اگر پارسر null داد، قانون به هوش مصنوعی fallback می‌کند.
     v0.40 — گزارش واقعی activity.log که هیچ‌کدام به پارسر نمی‌رسیدند:
     «فیلم یا ویدیو رو ببند» / «ببرش بالا سمت راست» / «یکم کوچکترش کن» /
     «اپسیتی فیفتی» → واژه‌های ویدیو/فیلم/ببرش/بیارش/کوچکترش/بزرگترش/
     اپسیتی/واضح اضافه شد (پارسر خودش گارد ضد-ربایش دارد) */
  const PIP_COMMAND_RE = /پین(?!گ)|شناور|فیپ|پی\s?ای\s?پی|\bpip\b|picture|شفاف|کلیک|همیشه|بردار|ببندش|ببند\s|کوچیکش|کوچکترش|بزرگش|بزرگترش|متوسطش|ریستش کن|opacity|اپسیتی|اوپسیتی|واضح|شیشه|ویدیو|فیلم|کلیپ|ببرش|بیارش|pin video|float video/i;

  /* ============================================================
     v0.41 — جستجوی درون-سایتی با دایرهٔ لغات باز (درخواست کاربر:
     «برو توی سایت فلان اینو سرچ کن» → اشتباهی در گوگل سرچ می‌شد،
     در حالی که «دنبال … بگرد» درست کار می‌کرد). حالا همهٔ تعبیرها
     یک پارسر مشترک دارند:
     • فعل جستجو: سرچ/سیرچ/سارچ/جستجو/جستجوی/بگرد/بگرده/پیدا کن/پیداش کن/search/find
     • لنگر سایت: «سایت/وبسایت X» ، اسم معروف بدون واژهٔ «سایت» ،
       دامنهٔ خام (zoomit.ir) ، «این/همین/همون سایت» (حافظهٔ آخرین سایت)
     • پیشوندها: برو/برو به/برو توی/وارد شو/از/توی/تو/در
     • علامت پرسش: دنبال، اینو/این رو، رو/را، دربارهٔ/راجع به، هرچی، چیزی
     خروجی: {thisSite, base, siteName, rawName, query} | null
     یوتیوب → null (مسیر بومی yt_search اولویت خودش را دارد)
     deps: {knownSite(name)→url|null, knownName(cmd)→{name,url}|null,
            domainOf(cmd)→host|null, lastSite→url}
     ============================================================ */
  function parseSiteSearch(cmd, deps) {
    const raw = String(cmd || '');
    const c = normFa(raw);
    if (!c || c.length < 6) return null;
    if (/یوتیوب|youtube|\bwebview\b/.test(c)) return null; /* یوتیوب = yt_search بومی */
    /* فعل جستجو — دایرهٔ باز؛ بدون آن جستجوی درون-سایتی معنا ندارد */
    if (!/(سرچ|سیرچ|سارچ|جستجو|بگرد|بگرده|پیدا|search|find|look\s*up)/i.test(c)) return null;
    const knownSite = deps && deps.knownSite;   /* تطبیق دقیق اسم (برای اسکن پیشوندی) */
    const knownName = deps && deps.knownName;   /* تطبیق شامل (روی کل جمله — مسیر C) */
    const domainOf = deps && deps.domainOf;
    const lastSite = String((deps && deps.lastSite) || '');
    const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    let site = '', siteName = '', rawName = '', thisSite = false, work = c;

    /* مرز اسم سایت: از این‌جا به بعد اسم نیست (علامت پرسش/فعل/موضوع/را) */
    const CUT_NAME = /\s+(?:دنبال|اینو|این\s*رو|این\s*را|آنو|آن\s*رو|هرچی|هر\s*چی|چیزی|چیزایی|درباره|دربارهی|راجع|مطلب|ویدیو|آهنگ|عکس|اخبار|سرچ|سیرچ|سارچ|جستجو|جستجوی|بگرد|بگرده|پیدا|رو|را|این|آن)(?=\s|$)[\s\S]*$/i;
    const cutName = (s) => String(s || '').replace(CUT_NAME, '').trim();
    /* دامنهٔ خام همیشه روی متن خام — نرمال‌سازی نقطهٔ دامنه را می‌خورد */
    const domRaw = domainOf ? (domainOf(raw) || '') : '';

    /* A) «توی این/همین/همون سایت …» — حافظهٔ آخرین سایت باز‌شده */
    const thisM = c.match(/(توی|تو|در|از)?\s*(این|همین|همون)\s+(سایت|وب\s*سایت|صفحه)/i);
    if (thisM) {
      thisSite = true;
      site = lastSite;
      siteName = lastSite.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
      work = c.replace(thisM[0], ' ');
    } else {
      /* B) «سایت X …» — اسم بعد از واژهٔ سایت */
      const wordM = c.match(/(?:سایت|وب\s*سایت)\s+(.+)$/i);
      if (wordM && wordM[1]) {
        const name = cutName(wordM[1]).replace(/^(از|در|توی|تو)\s+/i, '').trim();
        if (name.length >= 2 && name.length <= 40) {
          rawName = name;
          if (domRaw && (name.includes(domRaw.split('.')[0]) || name.includes(domRaw.replace(/\./g, ' ')))) {
            /* «سایت zoomit.ir …» — دامنهٔ خام از متن خام */
            site = 'https://' + domRaw.replace(/^https?:\/\//i, '');
            siteName = domRaw; rawName = '';
            work = c.slice(0, wordM.index) + ' ' + wordM[1]
              .replace(new RegExp(escRe(domRaw), 'gi'), ' ')
              .replace(domRaw.replace(/\./g, ' '), ' ');
          } else {
            /* اسکن پیشوندی بلند→کوتاه: «دیجیاتو بهترین لپ تاپ» → «دیجیاتو» +
               باقی = عبارت پرسش — تطبیق دقیق تا «دیجی»ِ ناقص دیجی‌کالا را نبیرد */
            const toks = name.split(/\s+/);
            let nameRest = '';
            for (let i = toks.length; i >= 1 && !site; i--) {
              const pref = toks.slice(0, i).join(' ');
              const u = knownSite ? knownSite(pref) : null;
              if (u) { site = u; siteName = pref; nameRest = toks.slice(i).join(' '); }
            }
            if (site) {
              rawName = '';
              const cutPart = wordM[1].slice(name.length); /* بخشی که cutName بریده */
              work = c.slice(0, wordM.index) + ' ' + nameRest + ' ' + cutPart;
            } else {
              /* سایت ناشناس («سایت موزیک بلاگ …») — اسم از عبارت پرسش حذف شود */
              work = c.slice(0, wordM.index) + ' ' + wordM[1].slice(name.length);
            }
          }
        }
      }
      /* C) بدون واژهٔ «سایت»: دامنهٔ خام یا اسم معروف داخل جمله
         («توی دیجی کالا دنبال ساعت بگرد» / «توی zoomit.ir قیمت رو بگرد») */
      if (!site && !rawName) {
        if (domRaw) {
          site = 'https://' + domRaw.replace(/^https?:\/\//i, '');
          siteName = domRaw;
          work = c
            .replace(new RegExp(escRe(domRaw), 'gi'), ' ')
            .replace(domRaw.replace(/\./g, ' '), ' ');
        } else if (knownName) {
          const hit = knownName(c);
          if (hit && hit.url && hit.name) {
            const nm = String(hit.norm || hit.name);
            /* اگر بعد از اسم سایت چیزی نماند («سرچ کن دیجی کالا») اسم خودش
               عبارت جستجوی گوگل است، نه مقصد جستجوی درون-سایتی → رد */
            const afterName = c.slice(c.lastIndexOf(nm) + nm.length) || '';
            const tailWords = afterName
              .replace(/(سرچ|سیرچ|سارچ|جستجو|جستجوی|بگرد|بگرده|پیدا)(ش)?\s*(کن|بکن|بزن|کنی)?/gi, ' ')
              .replace(/\s+/g, ' ').trim();
            if (tailWords.length < 2) return null;
            site = hit.url; siteName = hit.name;
            work = c.replace(new RegExp(escRe(nm), 'gi'), ' ');
          }
        }
      }
    }
    if (!site && !rawName && !thisSite) return null; /* لنگر سایت نبود → گوگل معمولی */

    /* عبارت پرسش: بقیهٔ جمله منهای پیشوند/فعل/علامت‌ها */
    let q = work
      .replace(/(لطفا|لطفا|خب|خوب|بابا|دیگه|دیگ|الان|الان|حالا|ممنون|مرسی|چشم)/gi, ' ')
      .replace(/(^|\s)(برو|وارد\s*شو|بزن|واسم|برام|برای\s*من|میخوام|می\s*خوام)(?=\s|$)/gi, '$1')
      .replace(/(توی|تو|در|از|روی)\s+(سایت|وب\s*سایت)/gi, ' ')
      .replace(/(سایت|وب\s*سایت)/gi, ' ')
      .replace(/(سرچ|سیرچ|سارچ|جستجو|جستجوی)(ش)?\s*(کن|بکن|بزن|کنی|میکنی|می\s*کنی)?/gi, ' ')
      .replace(/(بگرد|بگرده|گردش)(ش)?/gi, ' ')
      .replace(/پیدا(ش)?\s*(کن|بکن|کنی)?/gi, ' ')
      .replace(/\b(search|find|look)\s*(for|up)?\b/gi, ' ')
      .replace(/(^|\s)(دنبال|اینو|آنو|هرچی|هر\s*چی|چیزی|چیزایی|درباره|دربارهی|راجع|عبارت|موضوع|مطلب)(?=\s|$)/gi, '$1')
      .replace(/(^|\s)(رو|را|روی|در|تو|توی|از|که|هم|فقط)(?=\s|$)/gi, ' ')
      .replace(/\s+ی(?=\s|$)/g, ' ')
      /* علامت مفعولی پایانی: «این ساعتو» → «این ساعت» — وِا اضافهٔ پایان واژه (≥۴ حرف) حذف.
         واژه‌به‌واژه تا regex داخل «ویدیو» برنگردد (ویدی+و): استثنا رو/لو/یو
         (آبرو، پهلو، ویدیو — وِا جزو خود واژه است). «و» مستقل (رابط) دست نمی‌خورد */
      .replace(/\S+/g, (w) => (w.length >= 4 && w.endsWith('و') && !/(رو|لو|یو)$/i.test(w) ? w.slice(0, -1) : w))
      .replace(/\s+/g, ' ').trim();
    if (q.length > 80) q = q.slice(0, 80).trim();
    return { thisSite, base: site, siteName, rawName, query: q.length >= 2 ? q : '' };
  }

  const api = { parseVoiceCommand, normFa, PIP_COMMAND_RE, INTENTS, parseSiteSearch };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AVAVoice = api;
})(typeof window !== 'undefined' ? window : null);
