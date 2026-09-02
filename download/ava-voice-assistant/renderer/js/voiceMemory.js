'use strict';
/* ============================================================
   آوا — voiceMemory.js (v0.70) — «هستهٔ حافظه» (فاز ۰ طرح بازنویسی)
   ------------------------------------------------------------
   ریشهٔ لاگ Ali-HK (docs/LOG-ANALYSIS-2026-09-02.md):
   «یادت باشه فلانی علی چیه — دو دقیقه بعد کلاً یادش رفته»
   «این اسمو ذخیره کن» → هیچ actای وجود نداشت؛ مغز آن را type می‌کرد.
   «از این به بعد هر وقت گفتم به میلاد پیام بده…» → گرامر پیام آن را
   دستور ارسال فهمید (target=«بعد هر وقت»!).

   پاسخ معماری — حافظهٔ بلندمدتِ پایدار با سه خزانه:
     facts[]    : «یادت باشه/همیشه/از این به بعد…» — فکت‌ها و قواعد آموزشی
     contacts[] : آداپتور روی settings.msgContacts (UI موجود حفظ می‌شود)
     notes[]    : آداپتور روی ava-notes.json موجود (bridge.notes)

   اصول:
   • این فایل بدون Electron است — در window می‌نشیند و در Node هم
     module.exports دارد تا تست واحد مستقیم اجرا شود.
   • پایداری با آداپتور تزریقی (bridge.mem.load/save با نوشتن اتمیک
     در main.js) — بدون آداپتور، همه‌چیز در حافظه کار می‌کند (تست).
   • هر API هرگز استثنا پرتاب نمی‌کند — حافظه نباید مسیر اجرا را بشکند.
   • dedupe نرمال‌شده، سقف فکت (۵۰۰)، امتیازدهی بازیابی با هم‌پوشانی واژه.
   ============================================================ */
(function (root) {
  function normFa(s) {
    return String(s || '')
      .replace(/[\u200c\u200f\u200e]/g, ' ')
      .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/[«»"'.,،؛:!؟?()\[\]{}]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
  const STOP = new Set(('رو را به از توی تو برای برا کن بکن بده بزن که و یا در با هم همیشه هر وقت وقتی گفتم میگم می گم این اون یادت باشه بمونه یادت باشه من ما شم تا ای بله خب خوب اوکی باشه آفرین لطفا یه یک بعد بعدش قبل الان دیگه فقط باید بشه میشه بود شد میکنم کنم کنه اگه اگر اگرم ولش بی خیال چیه چی چیست هست بود کجاست کیه چند نیست هستش بودم گفتی میگی').split(/\s+/).filter(Boolean));

  const MAX_FACTS = 500;
  const FACT_MAX_LEN = 300;

  function emptyData() { return { v: 1, facts: [], seq: 1 }; }

  /* ============================================================
     AvaMemory — خزانهٔ فکت‌ها (پایدار) + آداپتورهای مخاطب/یادداشت
     ============================================================ */
  function createMemory(adapter) {
    const mem = {
      data: emptyData(),
      _ready: false,
      _adapter: adapter || null,
    };

    async function load() {
      if (mem._ready) return mem.data;
      try {
        if (mem._adapter && mem._adapter.load) {
          const d = await mem._adapter.load();
          if (d && typeof d === 'object') {
            mem.data = {
              v: 1,
              seq: Number(d.seq) || 1,
              facts: Array.isArray(d.facts) ? d.facts.slice(0, MAX_FACTS) : [],
            };
          }
        }
      } catch (_) { mem.data = emptyData(); }
      mem._ready = true;
      return mem.data;
    }
    async function persist() {
      try {
        if (mem._adapter && mem._adapter.save) {
          const ok = await mem._adapter.save(mem.data);
          if (!ok) return false;
        }
      } catch (_) { return false; }
      return true;
    }

    /* ---------- فکت‌ها ---------- */
    function addFact(text, opts) {
      const t = String(text || '').replace(/\s+/g, ' ').trim().slice(0, FACT_MAX_LEN);
      if (t.length < 4) return null;
      const n = normFa(t);
      if (n.length < 4) return null;
      const dup = mem.data.facts.find((f) => f.n === n);
      if (dup) { dup.hits = (dup.hits || 0) + 1; dup.at = Date.now(); return dup.id; }
      const id = 'f' + (mem.data.seq++);
      mem.data.facts.unshift({ id, text: t, n, at: Date.now(), hits: 0, scope: (opts && opts.scope) || 'permanent', src: String((opts && opts.src) || 'ai').slice(0, 12) });
      if (mem.data.facts.length > MAX_FACTS) mem.data.facts.length = MAX_FACTS;
      return id;
    }
    function delFact(idOrPrefix) {
      const k = normFa(idOrPrefix);
      const i = mem.data.facts.findIndex((f) => f.id === idOrPrefix || f.n.indexOf(k) === 0 || f.n === k);
      if (i < 0) return null;
      return mem.data.facts.splice(i, 1)[0] || null;
    }
    function listFacts(limit) {
      return mem.data.facts.slice(0, Math.max(1, limit || 20)).map((f) => ({ id: f.id, text: f.text, at: f.at, hits: f.hits || 0 }));
    }
    /* بازیابی: امتیاز = واژه‌های محتوایی مشترک با پرسش (فکت‌های تازه و پربکار هم جلو) */
    function findFacts(query, limit) {
      const q = normFa(query);
      if (!q) return listFacts(limit || 5);
      const qw = q.split(' ').filter((w) => w.length >= 2 && !STOP.has(w));
      if (!qw.length) return listFacts(limit || 5);
      const scored = mem.data.facts.map((f) => {
        /* v0.70.1 — ریشهٔ دود-تست: تازگیِ خالی به همهٔ فکت‌های تازه امتیاز می‌داد
           (هر پرسشی هر فکت تازه‌ای را برمی‌گرداند). حالا حداقل یک هم‌پوشانیِ
           واژهٔ محتوایی لازم است؛ تازگی/بسامد فقط تای‌بریکرند. */
        let sc = 0;
        for (const w of qw) { if (f.n.indexOf(w) !== -1) sc += 2; }
        if (sc === 0) return { f, sc: 0 };
        sc += Math.min(0.9, Math.max(0, 1 - (Date.now() - (f.at || 0)) / 864e5)); /* تازگی: حداکثر ۰٫۹ */
        sc += Math.min(0.8, (f.hits || 0) * 0.2); /* بسامد: حداکثر ۰٫۸ */
        return { f, sc };
      }).filter((x) => x.sc >= 2).sort((a, b) => b.sc - a.sc);
      return scored.slice(0, Math.max(1, limit || 5)).map((x) => ({ id: x.f.id, text: x.f.text, at: x.f.at, hits: x.f.hits || 0 }));
    }
    /* بستهٔ زمینه برای مغز — فقط فکت‌های مرتبط با کلیدواژه‌های جملهٔ فعلی */
    function factsCtx(query, limit) {
      const hits = findFacts(query, limit || 6);
      if (!hits.length) return '';
      return '[حافظهٔ پایدار آوا — فکت‌ها/قواعدی که کاربر قبلاً یادت سپرده]\n' +
        hits.map((f, i) => (i + 1) + '. ' + f.text).join('\n') + '\n[پایان حافظهٔ پایدار]';
    }

    /* ---------- مخاطبین (آداپتور settings.msgContacts) ---------- */
    /* آیتم: {id, name, app, handle, aliases?} — سازگار با UI پنل موجود */
    function addContact(list, c) {
      const name = String((c && (c.name || c.nameFa)) || (c && c.nameEn) || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      const app = String(c && c.app || '').trim().toLowerCase();
      const handle = String(c && c.handle || '').trim().slice(0, 80);
      if (!name || !app) return null;
      if (!Array.isArray(list)) return null;
      const n = normFa(name);
      const dup = list.find((x) => normFa(x && x.name) === n && String(x.app) === app);
      if (dup) { if (handle) dup.handle = handle; if (Array.isArray(c.aliases)) dup.aliases = c.aliases.slice(0, 6); return dup.id; }
      const id = 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
      const _als = Array.isArray(c.aliases) ? c.aliases.slice(0, 6) : (c && c.nameEn ? [String(c.nameEn).trim()].filter(Boolean) : []);
      list.push({ id, name, app, handle, aliases: _als });
      return id;
    }
    function findContact(list, app, name) {
      if (!Array.isArray(list) || !name) return null;
      const q = normFa(name).replace(/^(به|برای|برا)\s+/, '');
      if (!q) return null;
      const inApp = list.filter((x) => !app || String(x && x.app) === app);
      let hit = inApp.find((x) => normFa(x && x.name) === q);
      if (hit) return hit;
      hit = inApp.find((x) => Array.isArray(x.aliases) && x.aliases.some((a) => normFa(a) === q));
      if (hit) return hit;
      hit = inApp.find((x) => normFa(x && x.name).indexOf(q) === 0 || q.indexOf(normFa(x && x.name)) === 0);
      if (hit) return hit;
      /* لوانشتین ≤۱ برای تلفظ‌های نزدیک («میلاد قدسی» ↔ «میلاد قدوسی») */
      let best = null, bestD = 2;
      for (const x of inApp) {
        const d = lev(normFa(x && x.name), q);
        if (d < bestD) { bestD = d; best = x; }
      }
      return best;
    }
    function lev(a, b) {
      if (a === b) return 0;
      const m = a.length, n = b.length;
      if (!m || !n) return Math.max(m, n);
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
    function contactsCtx(list) {
      if (!Array.isArray(list) || !list.length) return '';
      return '[مخاطبین ذخیره‌شدهٔ کاربر — برای act=contact_send/contact_save؛ id را عیناً بده]\n' +
        list.slice(0, 25).map((c) => '- id=' + c.id + ' | ' + c.name + ' | اپ=' + c.app + (c.handle ? ' | مقصد=' + c.handle : '') + (Array.isArray(c.aliases) && c.aliases.length ? ' | مستعار=' + c.aliases.join('/') : '')).join('\n') +
        '\n[پایان مخاطبین]';
    }

    return { load, persist, addFact, delFact, listFacts, findFacts, factsCtx, addContact, findContact, contactsCtx, get data() { return mem.data; }, _norm: normFa };
  }

  const API = { createMemory, normFa, emptyData };
  root.AVAMemory = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
