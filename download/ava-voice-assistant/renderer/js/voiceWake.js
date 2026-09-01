/* ============================================================
   AVA — موتور تطبیق کلمهٔ بیدارباش (v0.46)
   ------------------------------------------------------------
   گزارش کاربر: «این کلمه ویکورد وقتی من میگم خیلی سخت متوجه میشه
   چون داره از آفلاین استفاده می‌کنه — دقت نسخهٔ آفلاین برای ویکورد
   بهترش بشه». لاگ واقعی v0.45 نشان داد whisper-base روی «آوا»ی
   کوتاه این‌ها را می‌نویسد و هیچ‌کدام بیدار نمی‌کردند:
     «او با» «اوه با» «حو با» «باو باو» «او افا» «پاو با»
     «ابار» «اوربا» «Aba» «A bar» «ava»
   موتور قبلی فقط یک مجموعهٔ ثابت (آوا/آبا/آوه/…) را می‌دید.

   معماری جدید — تطبیق سه‌لایهٔ آوانگار (بدون دیکشنری مثال):
     T1 دقیق      : خود کلمه + مشتقاتش (ی/جان/جون) + لاتین ava — بیدار فوری
     T2 آوانگار   : اسکلت آوایی (واحد لب‌سانی و/ب/ف/پ، حذف ه/ح، فروپاشی
                    تکرارهای مجاور) با خود کلمه برابر شود — بیدار فوری؛
                    محافظ FP: مسیرِ ه-دار فقط برای نام‌های ≥۴ نویسه
                    (هوا/اوه ۳نویسه هرگز بیدار نمی‌کنند)
     T3 نامزد ابری: جملهٔ کوتاهِ هم‌خانواده (او افا، پاو با، باو باو) —
                    همان صدا برای تأیید به موتور ابری می‌رود (سقف زمانی)
   کلمهٔ بیدارباش قابل تغییر است (settings.wakeWordText) — همهٔ لایه‌ها
   برای «هر کلمه» عمومی کار می‌کنند، نه فقط آوا.
   در مرورگر روی window.AVAWake می‌نشیند و در Node هم module.exports
   دارد تا تست‌های رگرسیون بدون Electron اجرا شوند.
   ============================================================ */
(function (root) {
  /* نرمال‌سازی سبک (هم‌خانوادهٔ voiceUnderstand) — اعراب حذف، ی/ک عربی یکدست */
  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[\u200c\u200f\u200e]/g, ' ')
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[\u064A\u0649]/g, '\u06CC')
      .replace(/\u0643/g, '\u06A9')
      .replace(/[\u0623\u0625\u0622]/g, '\u0627') /* أ إ آ → ا (فقط در لایهٔ مقایسه) */
      .replace(/[.،؛!؟?«»"'()\[\]{}:~\\|/^$%*+_=<>-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* آوانگاری لاتین ساده — whisper گاهی «ava / Aba / orba» می‌نویسد */
  function translit(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[^a-z\u0600-\u06FF\s]/g, ' ')
      .replace(/[vw]/g, '\u0648') /* اول صدادارها — وگرنه «a» قربانی می‌شود */
      .replace(/[aeiou]/g, '\u0627')
      .replace(/b/g, '\u0628')
      .replace(/f/g, '\u0641')
      .replace(/p/g, '\u067E')
      .replace(/h/g, '\u0647')
      .replace(/r/g, '\u0631').replace(/l/g, '\u0644').replace(/m/g, '\u0645')
      .replace(/n/g, '\u0646').replace(/k/g, '\u06A9').replace(/c/g, '\u06A9')
      .replace(/g/g, '\u06AF')
      .replace(/t/g, '\u062A').replace(/d/g, '\u062F').replace(/s/g, '\u0633')
      .replace(/z/g, '\u0632').replace(/j/g, '\u062C').replace(/y/g, '\u06CC')
      .replace(/q/g, ' ').replace(/x/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* اسکلت آوایی: هر نویسه → کلاس
     A = واکهٔ باز (ا/آ/أ/إ + لاتین a...)، W = لب‌سانی (و/ب/پ/ف — منبع اصلی
     خطای whisper روی «آوا»)، H = ه/ح/ع/ء (اغلب بلعیده یا اضافه می‌شود)،
     بقیهٔ نویسه‌ها کلاس خودشان (س≠ص نمی‌شوند — lev لایهٔ near جبران می‌کند) */
  function classSeq(s) {
    const t = translit(norm(s)).replace(/\s+/g, '');
    let out = '';
    for (const ch of t) {
      if (ch === '\u0627' || ch === '\u0622') out += 'A';
      else if (ch === '\u0648' || ch === '\u0628' || ch === '\u067E' || ch === '\u0641') out += 'W';
      else if (ch === '\u0647' || ch === '\u062D' || ch === '\u0639' || ch === '\u0621' || ch === '\u0629') out += 'H';
      else out += ch;
    }
    return out;
  }

  /* فروپاشی: حذف H + یکی‌کردن کلاس‌های مجاور یکسان
     اوبا→AWA ، اوهبا→AWA ، حوبا→(حذف H)→WA ، او افا→AWAWA */
  function collapse(seq) {
    let out = '';
    for (const ch of String(seq || '')) {
      if (ch === 'H') continue;
      if (out && out[out.length - 1] === ch) continue;
      out += ch;
    }
    return out;
  }

  function lev(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m || !n) return Math.max(m, n);
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }

  /* T2 — تطبیق آوانگار یک نامزد با کلمهٔ هدف */
  function nearMatch(cand, word) {
    const cRaw = norm(cand).replace(/\s+/g, '');
    if (!cRaw || cRaw.length < 3 || cRaw.length > 8) return false;
    const t = collapse(classSeq(word));
    const c = collapse(classSeq(cand));
    if (!t || !c) return false;
    if (c === t) return true; /* اوا/اوبا/اوهبا/آبا/اوربا… */
    /* مسیر ه-دار (حوا/حوبا = آوا با آغاز ه): فقط نام‌های ≥۴ نویسه —
       «هوا» و «اوه» و «او»ی ۳نویسه هرگز بیدارباش کاذب نمی‌سازند */
    if (classSeq(cand).indexOf('H') >= 0 && cRaw.length >= 4 && c === t.replace(/^A/, '')) return true;
    /* س/ص، ت/ط، ز/ذ/ض و… — فاصلهٔ کلاسی ۱ روی اسکلت؛ فقط برای کلمه‌های هدف
       بلندتر (اسم دلخواه کاربر مثل «سارا») — هدف ۳کلاسهٔ «آوا» بدون این
       مسیر، وگرنه واژه‌های عادی مثل «ابر» بیدارباش کاذب می‌سازند */
    if (t.length >= 4 && c.length === t.length && lev(c, t) <= 1) return true;
    return false;
  }

  /* T1 — خانوادهٔ تاریخی آوا (v0.36) — بدون «او/اوه/آو/اوب»: آن‌ها واژه‌های
     فوق‌عادی گفتارند و بیدارباشِ کاذب می‌سازند؛ نسخه‌های «او با/اوه با» با
     لایهٔ آوانگار (T2) پوشش داده می‌شوند */
  const LEGACY_AVA_T1 = ['آوا', 'اوا', 'آوای', 'اوای', 'آبا', 'ابا', 'آووا', 'اواا', 'اوبا'];
  function t1Set(word) {
    const b = norm(word);
    const b2 = b.replace(/\u0622/g, '\u0627'); /* آ→ا */
    const sfx = ['', '\u06CC', '\u06CC\u06CC', '\u062C\u0627\u0646', '\u062C\u0648\u0646', ' \u062C\u0627\u0646', ' \u062C\u0648\u0646'];
    const set = new Set();
    for (const base of new Set([b, b2])) {
      if (!base) continue;
      set.add(base);
      set.add(base + 'ی');
      set.add(base + 'یی');
      set.add(base + 'جان');
      set.add(base + 'جون');
    }
    for (const s of sfx) if (b) set.add((b + s).replace(/\s+/g, ' ').trim());
    /* خانوادهٔ تاریخی آوا (v0.36) — وقتی خودِ کلمه آوا/اوا است حفظ می‌شود */
    if (b2 === 'اوا') for (const w of LEGACY_AVA_T1) { set.add(w); set.add(w.replace(/\u0622/g, '\u0627')); }
    set.delete('');
    return set;
  }

  const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /* RE پیشوند برای برداشتن دنبالهٔ یک‌نفسی: «آوا برو سایت دیوار» → «برو سایت دیوار»
     آ/ا انعطاف‌پذیر؛ «هی آوا» هم پذیرفته است */
  function prefixRe(word) {
    const b = escRe(norm(word)).replace(/\u0627/g, '[\u0627\u0622]');
    /* v0.47 — B05: خانوادهٔ تاریخی به پیشوند برگشت (رگرسیون v0.46 که
       «آوه به علی زنگ بزن» را دیگر بیدار نمی‌کرد) + گارد مرزی (lookahead) —
       «آواز» و «جاوا» هرگز بیدار نمی‌شوند چون بعد از کلمه مرز نیست */
    const isAva = norm(word) === 'اوا';
    const fam = isAva
      ? '(?:' + b + '|اوه|اوها|اوبا|اوب|ابا|اواو|اواا|ava|awa)'
      : b;
    return new RegExp('^\\s*(?:هی\\s+|)(?:' + fam + ')(?:ی|یی|ی\\s?جان|ی\\s?جون|\\s?جان|\\s?جون)?(?=[\\s\u060C،,:؛;!?.\\-]|$)[\\s\u060C،,:؛;!?.\\-]*(.*)$', 'i');
  }
  /* واریانت‌های ضعیفِ پیشوندی — فقط با دنبالهٔ فرمان بیدار می‌کنند
     («اوه» تنها = سلامِ عادی، نه بیدارباش — FP-hardening) */
  const AVA_WEAK_PREFIX = /^(اوه|اوها|اوبا|اوب)$/

  /* لاتینِ T1 — فقط وقتی کلمهٔ هدف خودِ آوا/اوا است (whisper گاهی ava می‌نویسد) */
  const LATIN_AVA_RE = /\b(?:ava|awa|aba|avaa)\b/i;

  /* قضاوت کامل یک متن — قلب موتور
     بازگشت: { t1, tail, near, cloud } */
  function match(text, word) {
    const w = norm(word) || 'اوا';
    const s = norm(text);
    const out = { t1: false, tail: '', near: false, cloud: false };
    if (!s) return out;
    /* T1 — توکن‌به‌توکن */
    const set = t1Set(w);
    const toks = s.split(/[\s\u060C،,:؛;!?.\-]+/).filter(Boolean);
    for (const tk of toks) {
      if (set.has(tk)) { out.t1 = true; break; }
    }
    /* T1 — لاتین (فقط خانوادهٔ آوا) */
    if (!out.t1 && w.replace(/\u06CC/g, 'ی') === 'اوا' && LATIN_AVA_RE.test(s)) out.t1 = true;
    /* T1 — پیشوند (برای دنبالهٔ یک‌نفسی؛ «آوا جان» هم خالی است یعنی بیدارِ تنها)
       v0.47 — B05: هم‌خوانی پیشوندی به‌تنهایی بیدار است (قبلاً T1 توکنی هم لازم بود)
       — واریانت ضعیف بدون دنباله به T2/T3 سپرده می‌شود */
    const pm = s.match(prefixRe(w));
    if (pm) {
      const tail2 = String(pm[1] || '').trim();
      /* سرِ بیدارباش = کل match منهای دنباله (pm[0] کل جمله است، نه فقط کلمه) */
      const head = norm(tail2 ? String(pm[0] || '').slice(0, String(pm[0] || '').length - tail2.length) : String(pm[0] || '')).replace(/[\s\u060C،,:؛;!?.\-]+/g, ' ').trim();
      const firstTok = tail2.split(/\s+/)[0] || '';
      if (!tail2 && AVA_WEAK_PREFIX.test(head)) {
        /* «اوه» تنها = حرفِ عادی، نه بیدارباش */
      } else if (tail2 && AVA_WEAK_PREFIX.test(head) && firstTok && nearMatch(head + firstTok, w)) {
        /* «اوه با» → «با» ادامهٔ کلمهٔ بیدارباشِ بدشنیده است، نه فرمان */
        out.t1 = true;
        out.tail = '';
      } else {
        out.t1 = true;
        out.tail = tail2;
      }
    }
    /* T2 — آوانگار: تک‌توکن یا پیوستهٔ توکن‌ها (او با → اوبا)
       v0.47 — B05: دنبالهٔ فرمان بعد از توکن T2 حفظ می‌شود
       («او با برو سایت دیوار» قبلاً دنباله‌اش دور ریخته می‌شد) */
    if (!out.t1) {
      const joined = toks.join('');
      if (joined && nearMatch(joined, w)) { out.near = true; }
      else {
        for (let i = 0; i < toks.length; i++) {
          if (nearMatch(toks[i], w)) {
            out.near = true;
            if (i === 0 && toks.length > 1) out.tail = toks.slice(1).join(' ');
            break;
          }
          /* جفتِ آغازین: «او با …» — دو توکنِ نخست خودِ کلمهٔ بدشنیده‌اند */
          if (i === 0 && toks.length > 1 && nearMatch(toks[i] + toks[i + 1], w)) {
            out.near = true;
            out.tail = toks.slice(2).join(' ');
            break;
          }
        }
      }
    }
    /* T3 — نامزد تأیید ابری: برشِ کوتاهِ هم‌خانواده که نه T1 است نه T2
       (پاو با، باو باو، اوربا، orba) — همان صدا به موتور ابری می‌رود تا خودش
       «آوا»ی واقعی را بنویسد. گیت سخت‌گیرانه: فقط دوتکه/لاتین — واژه‌های
       عادیِ تک‌تکه (اوه، هوا، باور، بابا) و نویزِ [صول] هرگز ابری نمی‌شوند */
    if (!out.t1 && !out.near) {
      const joined = toks.join('');
      const tj = translit(joined);
      if (
        toks.length >= 1 && toks.length <= 2 && joined.length >= 3 && joined.length <= 7 &&
        (toks.length === 2 || /[a-z]/.test(joined) || joined.length >= 5) &&
        /[\u0627\u0628\u067E\u0641\u0647\u062D\u0648]/.test(tj[0] || '') && /[\u0648\u0628\u067E\u0641]/.test(tj)
      ) out.cloud = true;
    }
    return out;
  }

  /* دنبالهٔ یک‌نفسی بعد از کلمهٔ بیدارباش ('' = فقط اسم گفته شده) */
  function tailOf(text, word) {
    const s = norm(text);
    const m = s.match(prefixRe(word));
    return m ? String(m[1] || '').trim() : '';
  }

  /* hit سریع (T1∪T2) — برای سازگاری با wakeHitText قدیمی و مسیر تست */
  function quickHit(text, word) {
    const m = match(text, word);
    return !!(m.t1 || m.near);
  }

  const api = { norm, translit, classSeq, collapse, nearMatch, t1Set, prefixRe, match, tailOf, quickHit, lev };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AVAWake = api;
})(typeof window !== 'undefined' ? window : null);
