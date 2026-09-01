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

  const api = { norm, lev, safeActs, learn, match, isRepeatHit, revise, markUsed, dropKey, summary, examplesForAi, MAX_LEARN, REPEAT_WINDOW, MAX_REVISE, LEARN_ACTS_OK };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AVALearn = api;
})(typeof window !== 'undefined' ? window : null);
