'use strict';
/* ============================================================
   آوا — voiceMessaging.js (v0.67) — اکستنشن پیام‌رسانی (مرحلهٔ ۲)
   ------------------------------------------------------------
   خواستهٔ صریح کاربر: «اپشن پیام دادن در هر برنامه رو میخام اضافه کنی:
   telegram discord telegram web robika web bale whatsapp» — و بازخورد
   واقعی روی v0.66: «پیام رسان‌ها هیچکدوم کار نمیکنه… میگم به فلانی پیام
   بده تو تلگرام اصن هیچکاری نمیکنه حتی با این ک تلگرام pc بازه».

   ریشه‌های یافت‌شده (v0.66 مرحلهٔ ۱ — deep-link محض):
   • tg://resolve?domain=فلانی → تلگرام فقط یوزرنیم لاتین می‌شناسد؛ نام
     فارسی ساکت نادیده گرفته می‌شود (دقیقاً «هیچ‌کاری نمی‌کند»).
   • discord://…/@me/رضا → رضا یک channel-ID نیست → بی‌اثر.
   • «به فلانی پیام بده تو تلگرام» → متن پیام «تو تلگرام» برداشته می‌شد!
   • پاسخ «باز شد؛ متن در کلیپ‌بورد است» حتی وقتی هیچ چتی باز نشده بود.

   معماری مرحلهٔ ۲ (سه ستون + مسیریابی صادقانه):
   ۱) کشف (detect): از اسکن نرم‌افزارها — «کدام پیام‌رسان‌ها نصب‌اند».
   ۲) گرامر (parse): استخراج قطعی اپ/مقصد/متن — بدون AI؛ متن هرگز
      عبارتِ اپ را قورت نمی‌دهد؛ مقصد تا ۳ کلمه؛ گاردِ «بله».
   ۳) اجرا: هر اپ مسیر واقعی خودش را دارد (در app.js لَین پیاده شده):
      تلگرام/دیسکورد → اتوماسیون دسکتاپ (msg:send → PS؛ دیسکورد همان
      موتور اثبات‌شدهٔ v0.35، تلگرام موتور جدید Ctrl+F)؛ واتساپ →
      wa.me پیش‌پرشده با شماره؛ بله/روبیکا → وب + کلیپ‌بورد صادقانه.
   + مخاطبین: contactFind — نام گفته‌شده → شناسهٔ ثبت‌شده
     (settings.msgContacts؛ UI در پنل افزونه‌ها).
   ============================================================ */
(function (root) {
  /* ---------- ۱) رجیستری اپ‌های پیام‌رسان ---------- */
  const MSG_APPS = [
    { id: 'telegram', fa: 'تلگرام', re: /تلگرام|telegram/i, procs: ['Telegram', 'TelegramDesktop', '64Gram'], link: (t) => 'https://t.me/' + t, desktopLink: (t) => 'tg://resolve?domain=' + t, clipboardText: true, auto: true },
    { id: 'whatsapp', fa: 'واتساپ', re: /واتساپ|واتسآپ|whatsapp/i, procs: ['WhatsApp'], link: (t, txt) => 'https://wa.me/' + String(t || '').replace(/[^0-9]/g, '') + (txt ? '?text=' + encodeURIComponent(txt) : ''), desktopLink: (t, txt) => 'whatsapp://send?phone=' + String(t || '').replace(/[^0-9]/g, '') + (txt ? '&text=' + encodeURIComponent(txt) : ''), clipboardText: false, auto: false },
    { id: 'bale', fa: 'بله', re: /بله(?!ی)|\bbale\b/i, procs: ['Bale', 'BaleMessenger'], link: () => 'https://web.bale.ai/chat', desktopLink: null, clipboardText: true, auto: false, needsLoc: true },
    { id: 'rubika', fa: 'روبیکا', re: /روبیکا|rubika/i, procs: ['Rubika', 'RubikaDesktop'], link: () => 'https://web.rubika.ir/', desktopLink: null, clipboardText: true, auto: false, needsLoc: true },
    { id: 'discord', fa: 'دیسکورد', re: /دیسکورد|discord/i, procs: ['Discord', 'DiscordCanary', 'DiscordPTB', 'DiscordDevelopment'], link: () => 'https://discord.com/channels/@me', desktopLink: (t) => 'discord://discord.com/channels/@me/' + (t || ''), clipboardText: true, auto: true },
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

  /* ---------- ۲) گرامر فارسی «پیام دادن» (v2) ----------
     شکل‌ها (همه با اپ + مقصد + متن):
     «به علی در تلگرام پیام بده که سلام» / «به فلانی پیام بده تو تلگرام»
     «در تلگرام به علی بگو سلام» / «تلگرام به مامان بگو شام خوردی»
     «پیام بده به علی تو دیسکورد که بیا ویس» / «براش تو بله بنویس سلام»
     «به مامان بزرگ تو بله پیام بده که رسیدم» (مقصد چندکلمه‌ای)
     گیومه‌دار اولویت دارد: «به علی تلگرام پیام بده "فردا میام"» */
  const STOP_TAIL_RE = /(?:\s*(?:پیام|پیغام|بگو|بنویس|متن|برسون|برسان|بفرست|که|رو|را|تو|در|توی|با)\s*)+$/i;
  function normWord(s) {
    return String(s || '').toLowerCase().replace(/\u200C/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function msgParse(cmd) {
    let s = String(cmd || '').trim();
    if (!s || s.length < 6) return null;
    if (!/(پیام|پیغام|متن|بگو|بنویس|بده|بفرست|برسون|برسان)/i.test(s)) return null;
    /* اپ: اولین پیام‌رسانی که در جمله هست؛ «بله/روبیکا» فقط با عبارت مکانی
       صریح («تو بله» / «در روبیکا» / «با بله») — وگرنه کلمهٔ «بله» هر جمله‌ای
       را می‌ربود (ریسک فالس‌پازیتیو). */
    let appM = MSG_APPS.find((m) => m.re.test(s));
    if (!appM) return null;
    if (appM.needsLoc && !/(?:تو|در|توی|با)\s*(بله(?!ی)|روبیکا)/i.test(s)) appM = null;
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
    const woApp = s.replace(appM.re, ' ');
    const tm2 = woApp.match(/(?:به|برای|برا)\s+((?:[\u0600-\u06FFa-zA-Z0-9._@]{2,30})(?:\s+[\u0600-\u06FFa-zA-Z0-9._@]{2,30}){0,2})/i);
    if (tm2) {
      target = tm2[1].replace(STOP_TAIL_RE, '').trim();
      target = target.replace(/\s*(پیام|پیغام|بگو|بنویس|متن|برسون|برسان|بفرست)[\s\S]*$/i, '').trim();
    }
    /* متن بدون گیومه: بعد از اولین فعلِ پیام، با حذف اتصال */
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
    }
    /* متن نباید خودِ مقصد باشد */
    if (text && target && text.indexOf(target) === 0) text = text.slice(target.length).replace(/^[\s:،,]+/, '').trim();
    if (!target && !text) return null;
    return { app: appM.id, appFa: appM.fa, target, text };
  }

  /* ---------- ۳) سازندهٔ لینک اجرا ---------- */
  function msgBuild(appId, target, text, preferDesktop) {
    const m = MSG_APPS.find((x) => x.id === appId);
    if (!m) return null;
    const link = preferDesktop && m.desktopLink ? m.desktopLink(target, text) : m.link(target, text);
    return { app: m.id, appFa: m.fa, link, copyText: m.clipboardText ? String(text || '') : '', preFilled: m.id === 'whatsapp' && !!text };
  }

  /* ---------- ۴) مخاطبین (نام گفته‌شده → شناسهٔ واقعی) ----------
     settings.msgContacts = [{id, name, app, handle}] — از UI پنل افزونه‌ها.
     تطبیق: دقیق → لوانشتاین محافظه‌کار (نویز STT) → شامل‌سنجی دوطرفه. */
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
  function contactFind(contacts, appId, name) {
    const q = normWord(name);
    if (!q || q.length < 2) return null;
    const list = (Array.isArray(contacts) ? contacts : []).filter((c) => c && String(c.app || '') === String(appId) && String(c.handle || '').trim());
    if (!list.length) return null;
    let hit = list.find((c) => normWord(c.name) === q);
    if (hit) return hit;
    hit = list.find((c) => { const n = normWord(c.name); if (n.length < 3 || Math.abs(n.length - q.length) > 2) return false; const tol = n.length >= 9 ? 2 : (n.length >= 5 ? 1 : 0); return tol > 0 && _lev(n, q) <= tol; });
    if (hit) return hit;
    hit = list.find((c) => { const n = normWord(c.name); if (q.length < 3 && n.length < 3) return false; return n.indexOf(q) === 0 || q.indexOf(n) === 0; });
    return hit || null;
  }

  /* ---------- ۵) توابع کمکی قطعی مسیریابی ---------- */
  /* یوزرنیم لاتین معتبر تلگرام/دیسکورد (برای فالبک deep-link بعد از NO_TG)
     — @ ابتدای یوزرنیم هم پذیرفته می‌شود (STT هرگز @ نمی‌دهد؛ ورودی دستی می‌دهد) */
  function isLatinUsername(s) {
    return /^[a-zA-Z][a-zA-Z0-9_.@]{2,32}$/.test(String(s || '').trim().replace(/^@/, ''));
  }
  /* شمارهٔ تلفن قابل‌قبول واتساپ (۸+ رقم، ارقام فارسی هم پذیرفته می‌شود) */
  function phoneLike(s) {
    const d = String(s || '').replace(/[۰-۹]/g, (ch) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch))).replace(/[^0-9+]/g, '');
    return d.replace(/\+/g, '').length >= 8 ? d.replace(/\+/g, '') : '';
  }

  const api = { msgAppsOf, detectInstalled, appOf, msgParse, msgBuild, contactFind, isLatinUsername, phoneLike };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AVAMessaging = api;
})(typeof window !== 'undefined' ? window : null);
