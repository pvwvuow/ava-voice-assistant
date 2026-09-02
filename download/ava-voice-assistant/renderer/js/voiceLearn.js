/* ============================================================
   AVA — موتور یادگیری آوا (v0.47 — SELF-LEARNING)
   ------------------------------------------------------------
   درخواست صریح کاربر:
   «میخام یک سیستم جدید بسازیم برای یادگیری خود اوا مثلا اگ از ai یک
   درخواستی کرد کاربر ava خودش اون رو یاد بگیره و دفعات بعد افلاین
   انجام بده ..ولی اگ مثلا کاربر از عمل کرد ai در اون درخواست راضی
   نبود و دوباره تکرار کرد اون یادگیری قبلی رو تجدید نظر کنه»
   ------------------------------------------------------------
   طراحی:
   • یادگیری از عمل‌های موفقِ هوش مصنوعی (whitelist امن — عمل خطرناک هرگز)
   • ذخیرهٔ پایدار ava-learnings.json در userData (اتمیک، از دست نمی‌رود)
   • مچِ فازی روی عبارت نرمال‌شده (غلط‌های شنیداری STT هم پوشش داده می‌شوند)
   • بازپخش آفلاین: دفعهٔ بعد همان عمل، بدون شبکه، با تگ «⚡ یادگرفته»
   • نارضایتی = تکرار: اگر کاربر ظرف ۱۰ دقیقه همان را دوباره بگوید،
     یادگیری باطل و تصمیمِ تازه به هوش مصنوعی سپرده می‌شود (revise)؛
     بعد از ۳ revise، عبارت «ناپایدار» علامت می‌خورد و دیگر خودکار اجرا نمی‌شود
   • سقف LRU=۱۰۰ — پرمصرف‌ها و تازه‌ها می‌مانند
   در مرورگر روی window.AVALearn می‌نشیند و در Node هم module.exports دارد
   تا تست‌های رگرسیون بدون Electron اجرا شوند.
   ============================================================ */
(function (root) {
  const MAX_LEARN = 100;
  const REPEAT_WINDOW = 10 * 60 * 1000; /* نارضایتی = تکرار در ۱۰ دقیقه */
  const MAX_REVISE = 3;
  const LEARN_ACTS_OK = [
    'open_url', 'web_search', 'open_app', 'vol_set', 'vol_up', 'vol_down',
    'vol_mute', 'media_next', 'media_prev', 'media_toggle', 'note_show',
  ];

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[\u064A\u0649]/g, '\u06CC')
      .replace(/\u0643/g, '\u06A9')
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
      .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/\u200C/g, ' ')
      .replace(/[\\|`^~«»]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* فاصلهٔ لوانشتین سبک — فقط برای مچ فازی محافظه‌کارانه */
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

  /* فقط عمل‌های امنِ فهرست سفید یاد گرفته می‌شوند — lock/monitor/run_custom/dns… هرگز */
  function safeActs(acts) {
    return (Array.isArray(acts) ? acts : []).filter((a) =>
      a && LEARN_ACTS_OK.includes(String(a.act)) && String(a.value || '').trim().length <= 500
    ).slice(0, 3);
  }

  /* یادگیری/به‌روزرسانی: همان عبارت اگر قبلاً هست، عمل‌های تازه جایگزین می‌شوند */
  function learn(store, cmd, acts, reply) {
    const st = store && typeof store === 'object' ? store : { v: 1, items: [] };
    if (!Array.isArray(st.items)) st.items = [];
    const safe = safeActs(acts);
    if (!safe.length) return { changed: false, reason: 'no-safe-acts' };
    const k = norm(cmd);
    if (!k || k.length < 3) return { changed: false, reason: 'bad-key' };
    let e = st.items.find((x) => x.k === k);
    if (!e) {
      e = { k, acts: safe, at: Date.now(), used: 0, revise: 0, lastHit: 0 };
      st.items.push(e);
      /* سقف LRU: قدیمی‌ترینِ کم‌مصرف حذف می‌شود */
      while (st.items.length > MAX_LEARN) {
        let worst = 0;
        for (let i = 1; i < st.items.length; i++) {
          const a = st.items[i], b = st.items[worst];
          const sa = (a.used || 0) * 1e12 + (a.at || 0);
          const sb = (b.used || 0) * 1e12 + (b.at || 0);
          if (sa < sb) worst = i;
        }
        st.items.splice(worst, 1);
      }
    } else {
      e.acts = safe;
      e.at = Date.now();
      /* v0.47.1 — revise/unstable عمداً حفظ می‌شوند: تصمیمِ تازهٔ AI همان‌جا
         جایگزین می‌شود ولی سابقهٔ نارضایتیِ کاربر پاک نمی‌شود */
    }
    if (reply) e.reply = String(reply).slice(0, 200);
    return { changed: true, entry: e };
  }

  /* v0.50 — توکن‌های عامیِ فرمانی برای مچ معنایی (فعل‌ها/حروف اضافه حذف می‌شوند
     تا «برای شهر بجنورد سرچ کن موتور» با «تو دیوار شهر بجنورد موتور» هم‌ارز دیده شود) */
  const STOP_TOK = new Set(['رو', 'را', 'تو', 'توی', 'در', 'برای', 'برام', 'واسه', 'کن', 'بکن', 'بزن', 'بذار', 'بزار', 'سرچ', 'جستجو', 'پیدا', 'بگرد', 'دنبال', 'میگم', 'بگو', 'از', 'به', 'با', 'و', 'یه', 'یک', 'خب', 'خوب', 'دیگه', 'الان', 'لطفا', 'بابا', 'بهم', 'هم', 'که', 'روی', 'اجرا', 'باز', 'حالا', 'کنه', 'کنم', 'میکنم']);
  /* شباهت جکارد روی توکن‌های محتوایی — ≥۲ توکن مشترک لازم است */
  function tokSim(a, b) {
    const A = String(a || '').split(' ').filter((x) => x.length > 1 && !STOP_TOK.has(x));
    const B = String(b || '').split(' ').filter((x) => x.length > 1 && !STOP_TOK.has(x));
    if (!A.length || !B.length) return 0;
    const setB = new Set(B);
    const seen = new Set();
    let inter = 0;
    for (const x of A) { if (setB.has(x) && !seen.has(x)) { inter++; seen.add(x); } }
    if (inter < 2) return 0;
    const uni = new Set([...A, ...B]).size;
    return inter / uni;
  }

  /* مچ: دقیق → لوانشتین → معنایی توکن‌محور (v0.50)
     خواستهٔ کاربر: «دفعه بعد همین‌جوری ولی کمی فرق‌دار گفت حتی آفلاین قبول کنه» */
  function match(store, cmd) {
    const st = store && Array.isArray(store.items) ? store : { items: [] };
    const k = norm(cmd);
    if (!k || k.length < 3) return null;
    let e = st.items.find((x) => x.k === k);
    if (e && e.unstable) return null;
    if (e) return e;
    for (const x of st.items) {
      if (x.unstable) continue;
      const d = lev(x.k, k);
      const tol = k.length >= 18 ? 2 : (k.length >= 10 ? 1 : 0);
      if (d > 0 && d <= tol) return x;
    }
    /* v0.50 — پاس معنایی: شبیه‌ترین آیتم با جکارد ≥ ۰٫۶ (≥۲ توکن محتوایی مشترک) */
    let best = null;
    let bestSim = 0;
    for (const x of st.items) {
      if (x.unstable) continue;
      const sim = tokSim(k, x.k);
      if (sim >= 0.6 && sim > bestSim) { best = x; bestSim = sim; }
    }
    return best;
  }

  /* اصلاح (نارضایتی): تکرار در پنجرهٔ ۱۰ دقیقه → یادگیری قبلی باطل، revise++ */
  function isRepeatHit(entry, now) {
    return !!(entry && REPEAT_WINDOW && now - (entry.lastHit || 0) < REPEAT_WINDOW && entry.lastHit);
  }
  /* v0.47.1 — اصلاح طراحی: entry حذف نمی‌شود تا شمارندهٔ revise بماند (قبلاً
     هر revise حذف می‌کرد و شمارنده هرگز به ۳ نمی‌رسید). lastHit صفر می‌شود تا
     تصمیمِ تازهٔ AI عمل‌ها را جایگزین کند؛ ۳ بار نارضایتی = ناپایدارِ همیشگی */
  function revise(store, entry) {
    if (!entry) return { dropped: false };
    entry.revise = (entry.revise || 0) + 1;
    entry.lastHit = 0;
    if (entry.revise >= MAX_REVISE) {
      entry.unstable = true; /* عبارتِ همیشه‌ناراضی — دیگر خودکار اجرا نمی‌شود، فقط AI */
      return { dropped: false, unstable: true, revise: entry.revise };
    }
    return { dropped: false, revised: true, revise: entry.revise };
  }
  function markUsed(entry) {
    if (!entry) return;
    entry.used = (entry.used || 0) + 1;
    entry.lastHit = Date.now();
  }
  function dropKey(store, key) {
    const st = store && Array.isArray(store.items) ? store : { items: [] };
    const k = norm(key);
    const ix = st.items.findIndex((x) => x.k === k);
    if (ix >= 0) { st.items.splice(ix, 1); return true; }
    return false;
  }
  function summary(acts) {
    return (Array.isArray(acts) ? acts : [])
      .map((a) => String(a.act) + (a.value ? '(' + String(a.value).slice(0, 30) + ')' : ''))
      .join(' + ');
  }

  /* v0.50 — نمونه‌های آموخته برای پرامپت AI (خواستهٔ کاربر: «Gemini بررسی کنه
     این به کدوم کامندِ یادگرفته شبیهه و همون اجرا کنه») —
     رتبه‌بندی: توکن مشترک با درخواست فعلی + شباهت + بیش‌مصرف + تازه‌ترین */
  function examplesForAi(store, cmd, n) {
    try {
      const st = store && Array.isArray(store.items) ? store : { items: [] };
      const nn = Math.max(1, Math.min(10, Number(n) || 6));
      const ck = norm(cmd);
      const cTokens = new Set(ck.split(' ').filter(Boolean));
      const scored = st.items
        .filter((x) => !x.unstable && x.k && x.acts && x.acts.length)
        .map((x) => {
          let overlap = 0;
          for (const t of x.k.split(' ')) if (cTokens.has(t)) overlap++;
          const sim = tokSim(ck, x.k);
          return { x, s: overlap * 3 + sim * 10 + (x.used || 0) * 2 + (x.at || 0) / 1e13 };
        })
        .sort((a, b) => b.s - a.s)
        .slice(0, nn);
      return scored.map((o) => ({
        say: o.x.k,
        do: o.x.acts.map((a) => a.act + (a.value ? '(' + String(a.value).slice(0, 40) + ')' : '')).join(' + '),
      }));
    } catch (_) { return []; }
  }

  /* ============================================================
     v0.65 — یادگیریِ صریح (TEACH): کاربر مستقیم به آوا درس می‌دهد
     ------------------------------------------------------------
     درخواست کاربر: «روی یاد دادن به آوا از ریشه خوب کار کن»
     • «یاد بگیر وقتی گفتم X یعنی Y» → جفتِ (X→Y) در ava-taught.json
     • دفعات بعد X پیش از همهٔ لَین‌ها (حتی AI) به Y بازنویسی می‌شود —
       قطعی، آفلاین، بدون حدس
     • مطمئن‌ترین مچ: دقیق → لوانشتینِ محافظه‌کارانه (نویز STT)
     ============================================================ */
  const MAX_TAUGHT = 100;

  /* بریدنِ پیشوند بیدارباشِ سبک («آوا، ...» / «ava ...») برای مچ تمیزتر */
  function wakeStrip(s) {
    return String(s || '')
      .replace(/^\s*(?:[اآا]وا|ava|awa)\s*[،,:\-!]?\s*/i, '')
      .trim();
  }

  function _edgeTrim(s) { return String(s || '').replace(/[\s.!?،,؛;:ـ]+$/g, '').replace(/^[\s،,؛;:]+/g, '').trim(); }

  /* پارس جملات یاد دادن — خروجی {phrase, command} یا null
     شکل‌ها:
       یاد بگیر وقتی گفتم X یعنی Y      | یاد بگیر X یعنی Y
       هر وقت(ی) گفتم X یعنی Y          | وقتی گفتم X بشه Y
       یادت باشه( که) وقتی گفتم X یعنی Y | X رو یاد بگیر یعنی Y  */
  function teachParse(text) {
    let s = wakeStrip(text);
    if (!s || s.length < 7) return null;
    const n = norm(s);
    if (!/(یاد بگیر|یاد کن|یادت باشه|یادت باشد|هر وقت|وقتی گفتم|وقتی میگم|وقتی می گم)/.test(n)) return null;
    const TEACH_RE = /(?:یاد\s*(?:بگیر|کن)\s*[:،,]?\s*(?:که\s*)?(?:هر\s*وقتی?\s*|وقتی\s*)?(?:گفتم\s*|میگم\s*|می\s*گم\s*)?|یادت\s*(?:باشه|باشد)\s*[:،,]?\s*(?:که\s*)?(?:هر\s*وقتی?\s*|وقتی\s*)?(?:گفتم\s*|میگم\s*|می\s*گم\s*)?|هر\s*وقت(?:ی)?\s*(?:که\s*)?(?:گفتم|میگم|می\s*گم)\s*|وقتی\s*(?:که\s*)?(?:گفتم|میگم|می\s*گم)\s*)(.+?)\s*(?:یعنی|بشه|بفهم(?:ی|م)?|انجام\s*بده)\s*(.+)/i;
    const P4_RE = /^(.+?)\s*(?:رو|را)\s*یاد\s*(?:بگیر|کن)\s*(?:که\s*)?(?:یعنی|بشه)\s*(.+)$/i;
    let m = s.match(TEACH_RE);
    if (!m) m = s.match(P4_RE);
    if (!m) return null;
    const phrase = _edgeTrim(m[1]);
    const command = _edgeTrim(m[2]);
    if (!phrase || !command) return null;
    if (phrase.length < 2 || phrase.length > 80) return null;
    if (command.length < 2 || command.length > 200) return null;
    const np = norm(phrase);
    if (/یعنی/.test(np)) return null; /* X نباید خودش «یعنی» داشته باشد — مبهم */
    /* یادگیریِ زنجیره‌ای ممنوع: Y خودش جملهٔ یاد دادن نیست */
    if (/(یاد بگیر|یادت باشه|یاد کن)/.test(norm(command))) return null;
    if (/^(آوا|ava)$/.test(np)) return null;
    return { phrase, command };
  }

  /* پارس جملات فراموش کردن — {key, all} یا null
     «فراموش کن X» | «X رو فراموش کن» | «یادگیری X رو پاک کن» | «همه رو فراموش کن» */
  function forgetParse(text) {
    const s = wakeStrip(text);
    if (!s) return null;
    const n = norm(s);
    if (!/(فراموش|از یاد ببر|یادگیری)/.test(n)) return null;
    let m = s.match(/^(?:فراموش\s*کن|از\s*یاد\s*ببر|یادگیری(?:‌ها)?(?:\s*رو|\s*را)?\s*پاک\s*کن)\s*[:،]?\s*(.+)$/i);
    if (!m) m = s.match(/^(.+?)\s*(?:رو|را)\s*(?:فراموش\s*کن|از\s*یاد\s*ببر|از\s*حافظه\s*پاک\s*کن)$/i);
    if (!m) return null;
    const key = _edgeTrim(m[1]);
    if (!key || key.length > 80) return null;
    const nk = norm(key);
    const all = /^(همه|همه رو|همه را|همه شون|همه‌شون|همیش|همه یادگیری ها|همه یادگیری‌ها)$/.test(nk);
    return { key, all };
  }

  /* ذخیرهٔ جفتِ آموخته — همان عبارت = به‌روزرسانی؛ سقف LRU=۱۰۰ */
  function taughtSave(store, phrase, command) {
    const st = store && typeof store === 'object' ? store : { v: 1, items: [] };
    if (!Array.isArray(st.items)) st.items = [];
    const k = norm(phrase);
    const c = String(command || '').trim();
    if (!k || k.length < 2 || !c) return { changed: false, reason: 'bad-key' };
    let e = st.items.find((x) => x.k === k);
    if (e) {
      e.command = c; e.at = Date.now();
      return { changed: true, entry: e, updated: true };
    }
    e = { id: 't' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), k, phrase: String(phrase).trim(), command: c, at: Date.now(), used: 0, lastHit: 0 };
    st.items.push(e);
    while (st.items.length > MAX_TAUGHT) {
      let worst = 0;
      for (let i = 1; i < st.items.length; i++) {
        const a = st.items[i], b = st.items[worst];
        const sa = (a.used || 0) * 1e12 + (a.at || 0);
        const sb = (b.used || 0) * 1e12 + (b.at || 0);
        if (sa < sb) worst = i;
      }
      st.items.splice(worst, 1);
    }
    return { changed: true, entry: e, updated: false };
  }

  /* مچِ آموخته: دقیق → لوانشتینِ محافظه‌کارانه (نویز تشخیص گفتار) */
  function taughtMatch(store, cmd) {
    const st = store && Array.isArray(store.items) ? store : { items: [] };
    const k = norm(wakeStrip(cmd));
    if (!k || k.length < 2 || !st.items.length) return null;
    let e = st.items.find((x) => x.k === k);
    if (e) return e;
    /* v0.65.1 — نویز STT روی عبارت‌های کوتاهِ ≥۸ نویسه هم پوشش داده شود
       (تست واقعی: «سلام دنیا» → شنیده‌شد «سلام دنیی»)؛ خیلی کوتاه‌ها دقیق */
    const tol = k.length >= 18 ? 2 : (k.length >= 8 ? 1 : 0);
    if (tol > 0) {
      for (const x of st.items) {
        if (Math.abs(x.k.length - k.length) > tol) continue;
        if (lev(x.k, k) <= tol) return x;
      }
    }
    return null;
  }

  /* فراموشی: با کلید (شامل‌سنجی دوطرفهٔ محتاطانه) یا همه */
  function taughtDrop(store, key, all) {
    const st = store && Array.isArray(store.items) ? store : { items: [] };
    if (all) { const n = st.items.length; st.items = []; return { all: true, removed: n }; }
    const k = norm(key);
    if (!k) return { all: false, removed: 0 };
    let ix = st.items.findIndex((x) => x.k === k);
    let removedPhrase = '';
    if (ix < 0) {
      let best = -1, bestD = Infinity;
      for (let i = 0; i < st.items.length; i++) {
        const x = st.items[i];
        if (!(x.k.includes(k) || k.includes(x.k))) continue;
        const d = Math.abs(x.k.length - k.length);
        if (d < bestD) { bestD = d; best = i; }
      }
      ix = best;
    }
    if (ix == null || ix < 0) return { all: false, removed: 0 };
    removedPhrase = st.items[ix].phrase || st.items[ix].k;
    st.items.splice(ix, 1);
    return { all: false, removed: 1, removedPhrase };
  }

  const api = { norm, lev, safeActs, learn, match, isRepeatHit, revise, markUsed, dropKey, summary, examplesForAi, teachParse, forgetParse, taughtSave, taughtMatch, taughtDrop, wakeStrip, MAX_LEARN, REPEAT_WINDOW, MAX_REVISE, LEARN_ACTS_OK, MAX_TAUGHT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AVALearn = api;
})(typeof window !== 'undefined' ? window : null);
