'use strict';
/* ============================================================
   آوا — voiceMessaging.js (v0.66) — اکستنشن پیام‌رسانی (مرحلهٔ ۱)
   ------------------------------------------------------------
   خواستهٔ صریح کاربر: «اپشن پیام دادن در هر برنامه رو میخام اضافه کنی:
   telegram discord telegram web robika web bale whatsapp (یادته ک بررسی
   کرده چیا رو سیستمش داره کاربر) — با انواع و اقسام کامندها، برای کنترل
   کامل حرفه‌ای؛ این خودش یک پروژهٔ بزرگه، پلن حرفه‌ای بچین».

   معماری اکستنشن (سه لایه، هر کدام جدا و تست‌پذیر):
   ۱) کشف (detect): از اسکن نرم‌افزارها (sysApps) + اسکیم deep-link —
      «کدوم پیام‌رسان‌ها نصب‌اند» بدون حدس.
   ۲) گرامر (parse): الگوهای فارسیِ «پیام دادن» — استخراج اپ/مقصد/متن
      به‌صورت قطعی (بدون AI)؛ همهٔ شکل‌های رایج جمله.
   ۳) اجرا (build): deep-link رسمی هر اپ + متن (واتساپ: wa.me با ?text
      پیش‌پرشده) — مرحلهٔ ۲ (خواندن/پاسخ/واکنش به پیام) روی همین ستون‌ها
      با اتوماسیون UIA مثل دیسکورد سوار می‌شود.

   فاز ۲ (نقشهٔ راه حرفه‌ای — در این فایل اضافه می‌شود):
   • آداپتور UIA هر اپ (مثل DISCORD_PS_BODY): خواندن N پیام آخر، پاسخ،
     ارسال با تأیید UIA، سوییچ چت به مخاطب — خودگردان و تست‌پذیر.
   • چک‌لیست زندهٔ «نصب‌شده‌ها» در تنظیمات › افزونه‌ها.
   ============================================================ */
(function (root) {
  /* ---------- ۱) رجیستری اپ‌های پیام‌رسان ---------- */
  const MSG_APPS = [
    { id: 'telegram', fa: 'تلگرام', re: /تلگرام|telegram/i, procs: ['Telegram'], link: (t) => 'https://t.me/' + t, desktopLink: (t) => 'tg://resolve?domain=' + t, clipboardText: true },
    { id: 'whatsapp', fa: 'واتساپ', re: /واتساپ|واتسآپ|whatsapp/i, procs: ['WhatsApp'], link: (t, txt) => 'https://wa.me/' + String(t || '').replace(/[^0-9]/g, '') + (txt ? '?text=' + encodeURIComponent(txt) : ''), desktopLink: (t, txt) => 'whatsapp://send?phone=' + String(t || '').replace(/[^0-9]/g, '') + (txt ? '&text=' + encodeURIComponent(txt) : ''), clipboardText: false },
    { id: 'bale', fa: 'بله', re: /بله(?!ی)|\bbale\b/i, procs: ['Bale', 'BaleMessenger'], link: () => 'https://web.bale.ai/chat', desktopLink: null, clipboardText: true },
    { id: 'rubika', fa: 'روبیکا', re: /روبیکا|rubika/i, procs: ['Rubika', 'RubikaDesktop'], link: () => 'https://web.rubika.ir/', desktopLink: null, clipboardText: true },
    { id: 'discord', fa: 'دیسکورد', re: /دیسکورد|discord/i, procs: ['Discord', 'DiscordCanary', 'DiscordPTB'], link: () => 'https://discord.com/channels/@me', desktopLink: (t) => 'discord://discord.com/channels/@me/' + (t || ''), clipboardText: true },
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

  /* ---------- ۲) گرامر فارسی «پیام دادن» ----------
     شکل‌ها (همه با اپ + مقصد + متن):
     «به علی در تلگرام پیام بده که سلام» / «…پیام بده: سلام» / «…پیام بده سلام»
     «در تلگرام به علی بگو سلام» / «تلگرام به علی پیام بده سلام»
     «به علی تلگرام بده سلام» (محاوره) / «براش تو بله بنویس سلام» */
  function msgParse(cmd) {
    let s = String(cmd || '').trim();
    if (!s || s.length < 6) return null;
    if (!/(پیام|پیغام|متن|بگو|بنویس|بده|برسون|برسان)/i.test(s)) return null;
    /* اپ: اولین پیام‌رسانی که در جمله هست */
    const appM = MSG_APPS.find((m) => m.re.test(s));
    if (!appM) return null;
    /* متن: بعد از «که / بگو / بنویس / : / ،» در انتهای جمله — یا گیومه‌دار */
    let text = '';
    const q = s.match(/["«']([\s\S]{1,300}?)["»']/);
    if (q) text = q[1].trim();
    if (!text) {
      const tm = s.match(/(?:پیام\s*بده|پیغام\s*بده|بگو|بنویس|برسون|برسان)\s*(?:که|این\s*که|:|،|,)?\s*([\s\S]{1,300})$/i);
      if (tm) text = tm[1].trim();
    }
    /* مقصد: «به X» اولین «به» بعد از حذف اپ — تا «در/توی اپ» یا «پیام/بگو» قطع شود */
    let target = '';
    const woApp = s.replace(appM.re, ' ');
    const tm2 = woApp.match(/(?:به|برای|برا)\s+([\u0600-\u06FFa-zA-Z0-9_.@]{2,40})/i);
    if (tm2) {
      target = tm2[1].trim();
      target = target.replace(/\s*(در|توی|تو)\s*$/i, '').trim();
      /* قطعِ وقتی مقصد به فعلِ پیام می‌چسبد («به علی پیام بده») */
      target = target.replace(/\s*(پیام|پیغام|بگو|بنویس|متن|برسون|برسان)[\s\S]*$/i, '').trim();
    }
    /* متن نباید خودِ مقصد باشد؛ مقصد نباید خالی بماند وقتی الگوی «به X» هست */
    if (text && target && text.indexOf(target) === 0) text = text.slice(target.length).replace(/^[\s:،,]+/, '').trim();
    if (!target && !text) return null;
    /* نام کاربری تلگرام می‌تواند لاتین با @ یا نقطه باشد — از گرامر مقصد پوشش داده شد */
    return { app: appM.id, appFa: appM.fa, target, text };
  }

  /* ---------- ۳) سازندهٔ لینک اجرا ---------- */
  function msgBuild(appId, target, text, preferDesktop) {
    const m = MSG_APPS.find((x) => x.id === appId);
    if (!m) return null;
    const link = preferDesktop && m.desktopLink ? m.desktopLink(target, text) : m.link(target, text);
    return { app: m.id, appFa: m.fa, link, copyText: m.clipboardText ? String(text || '') : '', preFilled: m.id === 'whatsapp' && !!text };
  }

  const api = { msgAppsOf, detectInstalled, appOf, msgParse, msgBuild };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AVAMessaging = api;
})(typeof window !== 'undefined' ? window : null);
