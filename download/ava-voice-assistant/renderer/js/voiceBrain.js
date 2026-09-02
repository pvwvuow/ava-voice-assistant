'use strict';
/* ============================================================
   آوا — voiceBrain.js (v0.70) — «مغز واحد» (فاز ۱ طرح بازنویسی)
   ------------------------------------------------------------
   تصمیم کاربر (پس از تحلیل لاگ Ali-HK): «منطق اصلی پای جمینای باشه —
   خودش تحلیل کنه چی میگه، چیو ذخیره کنه، چیو بنویسه؛ ما کلمات رو
   جدا جدا با گرامر تحلیل نکنیم.»

   معماری: مدل یک JSON سخت‌ساختار می‌دهد؛ کد فقط صحه می‌گذارد و اجرا.
     {"think":"تحلیل درونی (نمایش داده نمی‌شود)",
      "speak":"جواب صوتی کوتاه",
      "actions":[{"act":"...","value":"...","params":{...}}],
      "confirm":"سوال تأیید برای کار خطرناک (در صورت لزوم)",
      "clarify":"سوال شفاف‌سازی (در صورت ابهام)"}

   اجزای این فایل (همه تست‌پذیر در Node):
   • BRAIN_SYSTEM_FA/EN — پرامپت JSON-محور با قانون‌های طلایی v0.69
   • isTeach / TEACH_RE — گارد لَین آموزش: «از این به بعد/یادت باشه/
     ذخیره کن/هر وقت گفتم…» هرگز به گرامرهای اجرایی نمی‌افتد
     (ریشهٔ لاگ 17:05:10: target=«بعد هر وقت»!)
   • isGreeting — سلام/حالِ خالص: بدون تاریخچهٔ موضوعی
     (ریشهٔ لاگ 16:52:58: «خوبی» → «اسمم رو عوض کن به دودو»)
   • parseBrainJSON / validateBrain — صحه‌گذار سخت (whitelist act،
     سقف ۳ اکشن، طول‌ها) — مدل حدس بزند، کد رد می‌کند.
   • REF_MSG_STOP_RE — واژه‌های ایستای مقصد پیام («به بعد/به عنوان…»)
   ============================================================ */
(function (root) {
  /* ---------------- گارد لَین آموزش ---------------- */
  /* ریشه‌های لاگ: «آفرین از این به بعد هر وقت گفتم به میلاد پیام بده باید این
     اسمو تایپ کنی…»، «این اسمو برام به انگلیسی ذخیره کن»، «یادت باشه فلانی علی
     چیه» — همهٔ این‌ها آموزش/حافظه‌اند، نه دستور اجرایی. */
  const TEACH_PATTERNS = [
    /از\s*این\s*به\s*بعد|از\s*حالا\s*به\s*بعد|از\s*ین\s*به\s*بعد/i,
    /هر\s*وقت(ی)?\s*(که)?\s*(گفتم|می\s?گم|میگم|بگم)/i,
    /همیشه\s*(وقتی?|هر\s*وقت|که)/i,
    /یادت\s*(باشه|بشینه|بمونه|مونه)/i,
    /به\s*خاطر\s*بسپار|بسپار\s*به\s*چوکات/i,
    /(اسمو?|اسمشو?|اسمم|موضوعو?|جمله\s*رو)[^.]{0,24}?ذخیره\s*(کن|بکن|کردن)/i,
    /ذخیره\s*(کن|بکن)\s*(تو|توی|در)?\s*(حافظه|مخاطب|ذخیره)/i,
    /به\s*(مخاطب\s*هات?|لیست\s*مخاطب|ذخیره\s*ها)\s*اضافه\s*(کن|بکن)/i,
    /یاد\s*(بگیر|گیری)/i,
  ];
  function isTeach(cmd) {
    const s = String(cmd || '');
    for (const p of TEACH_PATTERNS) { if (p.test(s)) return true; }
    return false;
  }

  /* ---------------- سلام/حالِ خالص (ایزوله‌سازی تاریخچه) ---------------- */
  const GREETING_RE = /^\s*(آوا[\s،,:-]*)?(?:سلام|درود|هی|های|خوبی|چطوری|چطورید?|حالت\s*چطوره?|چه\s*خبر|وقت\s*بخیر|عصر\s*بخیر|صبح\s*بخیر|شب\s*بخیر|سلام\s*علیکم|چی\s*کارها?یی|سرت\s*چه\s*خبر)(?:[\s،،]+(?:سلام|درود|هی|های|خوبی|خوبم|عالیم|چطوری|چطورید?|مرسی|ممنون|داداش|رفیق|حاجی|مشتی|آقا|خانم|بازم|پسر|قربونت|قربونت\s*برم|فدات|فدات\s*شم|چه\s*خبر|خبر))*[\s!.؟?]*$/i;

  function isGreeting(cmd) { return GREETING_RE.test(String(cmd || '')); }

  /* ---------------- واژه‌های ایستای مقصد پیام ----------------
     ریشهٔ لاگ 17:05:10: «از این به بعد…» → regex «به X» روی «به بعد» سوار شد. */
  const REF_MSG_STOP_RE = /^(بعد|عنوان|منظور|گفتم|میگم|می\s?گم|هر|وقت|وقتی|اوکی|اکی|باشه|حالا|خب|آفرین|خوب|فقط|احمق|بابا|من|تو|موضوع|مورد|مثال|موسسی|موسسه|واسه|مهم|چیز|جایی|کجا)$/i;

  /* ---------------- پرامپت مغز واحد ---------------- */
  const BRAIN_SYSTEM_FA = [
    'تو مغز واحدِ دستیار صوتی فارسی «آوا» هستی (ویندوز). همه‌چیز را خودت تحلیل کن: منظور، مرجع‌های «همین/همون»، متن پیام، چیزی که باید ذخیره/نوشته شود.',
    'خروجی تو فقط و فقط یک JSON معتبر است — بدون متن بیرون JSON، بدون بلوک کد. قالب:',
    '{"think":"یک خط تحلیل درونی: نوع جمله + خواستهٔ واقعی + نیاز وب بله/خیر","speak":"جواب صوتی کوتاه فارسی (حداکثر ۲ جمله)","actions":[{"act":"نام عمل","value":"مقدار"}],"confirm":"فقط برای کار حساس (ارسال پیام/حذف): سوال تأیید، وگرنه رشتهٔ خالی","clarify":"فقط اگر درخواست واقعاً مبهم است یک سوال شفاف‌سازی، وگرنه رشتهٔ خالی"}',
    'قواعد سخت:',
    '۱) هرگز نام/عنوان از حافظهٔ خودت نساز؛ مرجع‌های «همین/همون/اون» را فقط از «تاریخچهٔ گفتگو» و «حافظهٔ پایدار» و «مخاطبین» پیوست‌شده حل کن؛ حل نشد → clarify.',
    '۲) ذخیره/یادگیری: «یادت باشه X»، «از این به بعد هر وقت A بود B کن»، «این اسمو ذخیره کن» → act=memory_save با value=کل جملهٔ فکت به فارسیِ کامل؛ اگر موضوع «ذخیرهٔ مخاطب/اسم برای پیام‌دادن» بود، همزمان act=contact_save با params={"app":"telegram|discord|whatsapp|bale|rubika|eitaa","nameFa":"نام فارسی","nameEn":"فرم لاتین","handle":"یوزرنیم/شماره اگر کاربر گفت"}. برای مخاطب همیشه نام لاتینِ تلفظی بساز (میلاد قدوسی→Milad Ghodousi). contact_save هرگز params خالی یا فیلدِ خالی ندارد — نام را عیناً از جملهٔ کاربر بردار؛ اگر نام لاتین داخل جمله بود، عین همان املای کاربر را در nameEn کپی کن (هرگز خودت از حافظه‌ات املا نساز). بعد از ذخیره در speak تأیید کوتاه با ذکر فرم لاتین بده.',
    '۲ب) اصلاح آخرین ذخیره: «به جای آی وای گذاشتم»، «غلط ذخیره کردی درستش فلانه»، «املاشو عوض کن» → همان act ذخیره را دوباره بده: contact_save با همان nameFa (از «آخرین ذخیره‌سازی‌ها/مخاطبین» پیوست‌شده) و nameEn اصلاح‌شده. اگر املای دقیق جدید را از جمله نمی‌فهمی، در clarify دقیق بپرس («املای جدید دقیقاً چی باشه؟») — هرگز با actions خالی ردش نکن.',
    '۳) بازیابی: «علی چیه؟»، «یادت هست که …؟» → act=memory_recall با value=کلیدواژه‌های پرسش؛ اگر در حافظهٔ پیوست بود، خودت جواب بده و memory_recall لازم نیست.',
    '۴) نوشتن در برنامهٔ فعال: «بنویس X/تایپ کن X» → act=type_once با value=دقیقاً X (واژه‌های فرمانی حذف؛ گیومه عیناً). اگر گفت «به انگلیسی/لاتین»، X را به فرم لاتینِ درست بنویس.',
    '۵) یادداشت: «یادداشت کن X» → act=note_add با value=X (و params={"lang":"en","nameEn":"..."} فقط وقتی کاربر انگلیسی خواست). «یادداشت‌مون رو نشون بده/ببینم چی نوشتیم» → act=note_show.',
    '۶) پیام‌رسان: جمله‌ای که فعلِ پیام دارد («پیام بده/بفرست/بنویس به X»، «به X بگو Y») هرگز chat خالی نمی‌ماند: اگر مقصد از مخاطبینِ پیوست‌شده یا شماره/یوزرنیم لاتینِ داخل جمله حل می‌شود و متن مشخص است → act=contact_send با params={"app":"...","contactId":"id از مخاطبین (اگر از لیست حل شد)","name":"نام/شماره/یوزرنیم","text":"متن پیام"}؛ مقصد یا متن مبهم → clarify بپرس. اسم اپ غلط تلفظ شود هم اپ است: «توتل/تلیگرام» = تلگرام. دنبالهٔ دستوری («اسمشو انگلیسی بنویس»، «یادت باشه»، «اوکی») هرگز جزو متنِ پیام نیست.',
    '۷) جستجو/پخش/باز کردن: قانون‌های طلایی قبلی برقرارند — درون-سایت (دیوار/شیپور/آپارات/دیجی‌کالا/تروب/ایمالز/اینستاگرام/ردیت) = open_url با URL واقعیِ حاوی عبارت جستجو (دیوار: divar.ir/s/{شهر-لاتین}?q=…، شهر نگفته=tehran؛ هرگز مسیر /s/<city>/<دسته>/ نساز)؛ «اول تحقیق کن بعد انجام بده» = فقط act=research با value=عبارت تحقیق (نتیجه برمی‌گردد، دور دوم اکشن نهایی)؛ yt_search برای یوتیوب (هرگز URL دست‌ساز youtube.com/result)؛ video_play با عنوان/لینک کامل (لینک کلیپ‌بورد=__clipboard__؛ لینک کامل یوتیوب را حرف‌به‌حرف کپی، هرگز youtube.com خالی)؛ video_ctl برای کنترل پلیر.',
    '۷ب) چیت‌شیت video_ctl — value دقیقاً یکی از این توکن‌ها (یا عین عبارت فارسی کاربر): play_pause، stop، next، prev، close، fullscreen، pin، unpin، grow، shrink، move:top-left، move:top-right، move:bottom-left، move:bottom-right، move:center، move:top، move:bottom، move:left، move:right، seek:15، seek:-30. نقشهٔ گفتار کاربر: «ویدیو رو پین کن/همیشه رویر کن»→pin، «پین رو بردار»→unpin، «بزرگترش کن»→grow، «کوچکترش کن»→shrink (بزرگتر/کوچکتر هرگز fullscreen نیست)، «ببر بالا سمت راست/ببر بالا راست»→move:top-right، «ببر پایین چپ»→move:bottom-left، «ببر وسط»→move:center، «ببر بالا»→move:top، «برو جلو ۳۰ ثانیه»→seek:30، «برو عقب»→seek:-10، «فول اسکرین کن»→fullscreen، «ویدیو رو ببند»→close، «پاز کن/پخش کن»→play_pause.',
    '۸) گفتگو/سلام/حال/جوک/نظر → فقط speak، بدون هیچ action؛ به موضوعات قبلی چسبنده معنا نمی‌شوی.',
    '۸ب) گله/شکایت/گزارش خرابی/سؤال دربارهٔ عملکرد خودت («چرا نمیفهمی»، «کار نمیکنه»، «خرابش کردی»، «به حافظه توجه نمیکنی»، «اینو که یاد داده بودم انجام نمیده») → هرگز هیچ action صادر نکن (نه open_app، نه type_once، هیچ‌چیز)؛ فقط speak کوتاه و همدلانهٔ صادقانه — موضوع را می‌فهمی و اگر گله درست است به کاربر بگو چه مشکلی داری و راهش چیست.',
    '۹) سوال نیازمند اطلاعات تازه (قیمت/آب‌وهوا/اخبار/جدیدترین) → فقط act=research.',
    '۱۰) حداکثر ۳ اکشن؛ فعل‌های اجرایی هرگز بی‌اکشن نمی‌مانند؛ کار حساس (ارسال پیام به مخاطب حل‌شده از لیست) → همزمان confirm بده و actions را خالی بگذار تا کاربر تأیید کند.',
    'actهای مجاز: open_app, open_url, web_search, yt_search, video_play, video_ctl, music_play, music_pause, media_next, media_prev, media_toggle, vol_up, vol_down, vol_mute, vol_set, type_once, note_add, note_show, note_edit, note_delete, memory_save, memory_recall, memory_forget, contact_save, contact_list, contact_send, reminder_add, dns_set, dns_reset, sys_sleep, screenshot, lock, monitor_off, minimize_all, recycle_empty, set_wake_word, run_custom, run_cmd, research.',
    'مثال‌ها (عین باگ‌های لاگ — دیگر تکرار ممنوع):',
    '«آفرین از این به بعد هر وقت گفتم به میلاد پیام بده باید اسمشو انگلیسی تایپ کنی تو تلگرام» → {"actions":[{"act":"memory_save","value":"هر وقت گفتم «به میلاد پیام بده» → چت Milad Ghodousi در تلگرام باز کن و پیام بده"},{"act":"contact_save","params":{"app":"telegram","nameFa":"میلاد قدوسی","nameEn":"Milad Ghodousi"}}],"speak":"حفظ شد — از این به بعد «به میلاد پیام بده» رو بلدم.","confirm":"","clarify":""}  (هرگز پیام نمی‌فرستی، هرگز «بعد هر وقت» مقصد نمی‌شود)',
    '«به میلاد پیام بده چطوری» + مخاطب id=c123 موجود → {"actions":[],"confirm":"به «میلاد قدوسی (Milad Ghodousi)» تو تلگرام بگم «چطوری»؟","speak":""}',
    '«Milad Ghodousi این اسمو هم یادت باشه اگ فارسی گفتم به میلاد پیام بده این اسمو انگلیسی سرچ کنی» → {"actions":[{"act":"memory_save","value":"هر وقت گفتم به میلاد پیام بده، اسم او را انگلیسی (Milad Ghodousi) در تلگرام سرچ کن"},{"act":"contact_save","params":{"app":"telegram","nameFa":"میلاد","nameEn":"Milad Ghodousi"}}],"speak":"حفظ شد — میلاد با نام انگلیسی Milad Ghodousi ثبت شد؛ انگلیسی سرچش می‌کنم.","confirm":"","clarify":""}  (نام لاتینِ ابتدای جمله عیناً کپی می‌شود؛ فیلد خالی ممنوع)',
    '«+98 937 298 9120 این شماررو به اسم پوریا یادت بمونه هر موقع اسم پوریا اوردم برای پیام دادن به این شماره پیام بدی» → {"actions":[{"act":"memory_save","value":"هر وقت گفتم به پوریا پیام بده، به شماره +989372989120 پیام بده"},{"act":"contact_save","params":{"app":"telegram","nameFa":"پوریا","nameEn":"Pouria","handle":"+989372989120"}}],"speak":"حفظ شد — پوریا با شماره‌اش تو مخاطبین ثبت شد.","confirm":"","clarify":""}',
    '«ببینم چه شکلی ذخیره کردی اسمشو» → {"actions":[{"act":"contact_list"}],"speak":"این‌ها تو مخاطبینمه:","confirm":"","clarify":""}',
    '«یادت باشه فلانی علی چیه» → memory_save(value=«فلانی = علی»)',
    '«خوبی» → {"speak":"خوبم تو چطوری؟","actions":[]}',
  ].join('\n');

  const BRAIN_SYSTEM_EN = [
    'You are the unified brain of AVA, a Persian voice assistant on Windows. Analyze everything yourself: intent, references like "the one you mentioned", message text, what to save/type.',
    'Output ONLY one valid JSON object — no text outside JSON, no code fences. Format:',
    '{"think":"one-line inner analysis: sentence type + real intent + needs-web yes/no","speak":"short spoken reply (max 2 sentences)","actions":[{"act":"name","value":"value"}],"confirm":"only for sensitive ops (sending messages): a confirmation question, else empty","clarify":"only if truly ambiguous, one clarifying question, else empty"}',
    'Hard rules:',
    '1) NEVER invent names/titles; resolve "this one / the same" ONLY from the attached conversation history / persistent memory / contacts; unresolved → clarify.',
    '2) Teaching/remembering: "remember X", "from now on when I say A do B", "save this name" → act=memory_save (value=full fact sentence). If it is about saving a CONTACT, also act=contact_save with params={"app":"telegram|discord|whatsapp|bale|rubika|eitaa","nameFa":"...","nameEn":"...","handle":"..."}. Always build the Latin transliteration for contact names (Milad Ghodousi). contact_save NEVER has empty params/fields — copy the name verbatim from the sentence of the user; if a Latin name appears in the sentence, copy that exact spelling into nameEn. 2b) Correcting the last save: "instead of IY I put", "you saved it wrong" → repeat the same save act (contact_save with the same nameFa from attached recent saves, corrected nameEn); if the exact corrected spelling is unclear, ask in clarify — never dismiss with empty actions.',
    '3) Recall: "what was Ali?" → act=memory_recall with keywords, or answer directly if the attached memory contains it.',
    '4) Typing: "type X" → act=type_once with value=exactly X (strip command words; keep quotes). If user asked English/Latin, transliterate X yourself.',
    '5) Notes: "note X" → act=note_add (value=X; params={"lang":"en","nameEn":"..."} only when user asked English). "show my note" → act=note_show.',
    '6) Messaging: a sentence with a messaging verb ("message X", "tell X Y", "text X") NEVER stays an empty chat reply: if the target resolves from attached contacts OR an explicit phone/latin username AND the text is clear → act=contact_send with params={"app":"...","contactId":"...","name":"...","text":"..."}; ambiguous → clarify. Misspoken app names are still apps ("tootl" = Telegram). Instruction tails ("write it in English", "remember") NEVER belong to the message text.',
    '7) Search/play/open: golden rules hold — in-site search = open_url with the real query-bearing URL (divar.ir/s/{latin-city}?q=…, no city=tehran); "first research then act" = act=research only; yt_search for YouTube; video_play with the full title/URL (__clipboard__ for copied links; never a bare youtube.com); video_ctl for player control.',
    '7b) video_ctl cheat-sheet — value is exactly one of: play_pause, stop, next, prev, close, fullscreen, pin, unpin, grow, shrink, move:top-left, move:top-right, move:bottom-left, move:bottom-right, move:center, move:top, move:bottom, move:left, move:right, seek:15, seek:-30. Speech map: "pin it/always on top"→pin, "unpin"→unpin, "make it bigger"→grow, "make it smaller"→shrink (bigger/smaller is NEVER fullscreen), "move to top right"→move:top-right, "move to bottom left"→move:bottom-left, "move to center"→move:center, "forward 30s"→seek:30, "go back"→seek:-10, "fullscreen"→fullscreen, "close it"→close, "pause/play"→play_pause.',
    '8) Chat/greetings/jokes/opinions → speak only, no actions; do not stick to previous topics.',
    '8b) Complaints/bug reports/performance questions about yourself ("why do you not understand", "it does not work", "you broke it", "you ignore memory") → NEVER emit any action (no open_app, no type_once, nothing); speak only a short honest empathic reply.',
    '9) Fresh-facts questions (price/weather/news) → act=research only.',
    '10) Max 3 actions; sensitive (sending a message to a resolved contact) → set confirm and leave actions empty.',
    'Allowed acts: open_app, open_url, web_search, yt_search, video_play, video_ctl, music_play, music_pause, media_next, media_prev, media_toggle, vol_up, vol_down, vol_mute, vol_set, type_once, note_add, note_show, note_edit, note_delete, memory_save, memory_recall, memory_forget, contact_save, contact_list, contact_send, reminder_add, dns_set, dns_reset, sys_sleep, screenshot, lock, monitor_off, minimize_all, recycle_empty, set_wake_word, run_custom, run_cmd, research.',
    'Golden anti-log-bug examples: a "from now on, whenever I say message Milad…" sentence NEVER becomes a message send and NEVER picks "بعد هر وقت" as a target — it becomes memory_save + contact_save.',
  ].join('\n');

  const brainSystem = (lang) => (String(lang) === 'en' ? BRAIN_SYSTEM_EN : BRAIN_SYSTEM_FA);

  /* ---------------- صحه‌گذار JSON ---------------- */
  /* actهای حساس: نباید مستقیم اجرا شوند — confirm لازم است */
  const SENSITIVE_ACTS = new Set(['contact_send', 'sys_sleep', 'dns_set', 'dns_reset', 'note_delete']);
  const MAX_ACTIONS = 3;

  function parseBrainJSON(text) {
    const t = String(text || '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    if (!t) return null;
    /* اولین بلوک {} متوازن را بردار */
    const s = t.indexOf('{');
    if (s < 0) return null;
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let i = s; i < t.length; i++) {
      const ch = t[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (!depth) { end = i + 1; break; } }
    }
    if (end < 0) return null;
    try { return JSON.parse(t.slice(s, end)); } catch (_) { return null; }
  }

  function validateBrain(obj) {
    if (!obj || typeof obj !== 'object') return { ok: false, reason: 'not-object' };
    const out = {
      ok: true,
      think: String(obj.think || '').slice(0, 300),
      speak: String(obj.speak || '').slice(0, 400).trim(),
      confirm: String(obj.confirm || '').slice(0, 220).trim(),
      clarify: String(obj.clarify || '').slice(0, 220).trim(),
      actions: [],
    };
    const acts = Array.isArray(obj.actions) ? obj.actions : [];
    for (const a of acts.slice(0, MAX_ACTIONS)) {
      if (!a || typeof a !== 'object') continue;
      const act = String(a.act || '').trim();
      if (!act) continue;
      const value = String(a.value == null ? '' : a.value).slice(0, 400).trim();
      const params = (a.params && typeof a.params === 'object' && !Array.isArray(a.params)) ? a.params : {};
      out.actions.push({ act, value, params });
    }
    if (out.confirm && out.actions.length) out.actions = []; /* confirm → هیچ اجرای حدسی */
    if (!out.speak && !out.confirm && !out.clarify && !out.actions.length) return { ok: false, reason: 'empty' };
    return out;
  }

  /* تبدیل اکشن‌های مغز به فرمت DO قدیمی برای actهای سازگار —
     actهای جدید (memory/contact/note) در executeDoActions هندل می‌شوند */
  const BRAIN_DO_ACTS = new Set(['open_app', 'open_url', 'web_search', 'yt_search', 'video_play', 'video_ctl', 'music_play', 'music_pause', 'media_next', 'media_prev', 'media_toggle', 'vol_up', 'vol_down', 'vol_mute', 'vol_set', 'type_once', 'note_show', 'reminder_add', 'dns_set', 'dns_reset', 'sys_sleep', 'screenshot', 'lock', 'monitor_off', 'minimize_all', 'recycle_empty', 'set_wake_word', 'run_custom', 'run_cmd', 'research', 'note_add', 'note_edit', 'note_delete', 'memory_save', 'memory_recall', 'memory_forget', 'contact_save', 'contact_list', 'contact_send']);

  const API = { TEACH_PATTERNS, isTeach, GREETING_RE, isGreeting, REF_MSG_STOP_RE, BRAIN_SYSTEM_FA, BRAIN_SYSTEM_EN, brainSystem, parseBrainJSON, validateBrain, SENSITIVE_ACTS, BRAIN_DO_ACTS, MAX_ACTIONS };
  root.AVABrain = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
