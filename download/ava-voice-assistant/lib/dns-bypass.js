'use strict';
/* ============================================================
   آوا — v0.24 دور زدن DNS فیلترشدهٔ ایران (شکن/الکترو) بدون UAC
   ============================================================
   ریشهٔ «نشنیدن صدا» در ویندوز کاربر این بود:
   • کروم (پیش‌نمایش وب) به‌خاطر DNS امنِ خودش گوگل را راحت می‌بیند و
     صدای کاربر را همان لحظه تایپ می‌کند؛
   • ولی برنامهٔ نصب‌شده از DNS سیستم‌عامل استفاده می‌کند که روی شبکهٔ
     ایران میزبان‌های گوگل را فیلتر می‌کند → موتور وب با خطای network
     می‌میرد و همهٔ موتورهای ابری هم «اتصال به سرور برقرار نشد» می‌دهند.
   راه‌حل: پرسیدن آی‌پی واقعی میزبان‌های مهم از DNS شکن/الکترو
   (سرویس‌های داخلی ایران — همیشه در دسترس، بدون فیلترشکن) و پین‌کردن
   آن آی‌پی‌ها فقط داخل خود برنامه؛ بدون تغییر DNS ویندوز و بدون UAC.

   این ماژول دو کار می‌کند:
   ۱) کتابخانه: resolveHost / resolveHosts / hostResolverRules
   ۲) حالت CLI (برای پروسهٔ اصلی الکترون): پیکربندی را از argv[2]
      (فایل JSON) می‌خواند و نقشهٔ host→ip را روی stdout چاپ می‌کند.
      چون قبل از رویداد ready باید appendSwitch شود، پروسهٔ اصلی با
      spawnSync (ELECTRON_RUN_AS_NODE) این اسکریپت را به‌صورت سنکرون
      صدا می‌زند تا نتیجه قطعاً پیش از ساخت پنجره آماده باشد. */

const dgram = require('dgram');
const https = require('https');

/* پروفایل‌های رسمی شکن و الکترو */
const SHECAN = ['178.22.122.100', '185.51.200.2'];
const ELECTRO = ['78.157.42.100', '78.157.42.101'];
const DEFAULT_SERVERS = SHECAN.concat(ELECTRO);

/* v0.26 — لایهٔ دوم: DoH (DNS-over-HTTPS، RFC 8484 wireformat POST)
   بعضی ISPهای ایران UDP:53 به DNSهای شخص ثالث را کلاً می‌بندند؛ در آن حالت
   پرس‌وجوی UDP همه‌جا Timeout می‌خورد. DoH روی TCP:443 است و تقریباً هیچ‌وقت
   بسته نیست.

   rationale عمدیِ rejectUnauthorized:false (v0.60 — تقویت‌شده؛ TLS دست نخورده):
   • گواهی شکن منقضی است (تیر ۱۴۰۵) و کل مسیر «دورزدن بدون UAC» به شکن تکیه دارد؛
   • این اتصال فقط «کشف آی‌پی» است — همان اطلاعاتی که هر DNS یو‌دی‌پی معمولی
     (بدون هیچ احراز هویتی) هم می‌بیند. هیچ راز/کوکی/توکنی به رزولور نمی‌رود؛
   • اتصال‌های اصلی برنامه (HTTPS به گوگل/زت‌ای/گیت‌هاب و…) نشست‌های TLS جدای
     با اعتبارسنجی گواهی کامل‌اند — اگر کسی جواب DoH را دروغ بدهد، حداکثر
     «اتصال برقرار نشد» (DoS) می‌سازد؛ نمی‌تواند ترافیک برنامه را MITM کند
     چون هر سرور واقعی گواهی معتبر خودش را می‌خواهد؛
   • یعنی rejectUnauthorized:false این‌جا دقیقاً هم‌سطح اعتمادِ DNS یو‌دی‌پی
     است، نه یک ضعف اضافه. */
const DOH_ENDPOINTS = ['https://free.shecan.ir/dns-query'];

/* میزبان‌هایی که برنامه واقعاً با آن‌ها «می‌شنود» و «حرف می‌زند» */
const DEFAULT_HOSTS = [
  'www.google.com',                        /* موتور وب کرومیوم + گوگل رایگان HTTP */
  'translate.google.com',                  /* TTS رایگان */
  'generativelanguage.googleapis.com',     /* Gemini (چت + STT + TTS) */
  'api.z.ai',                              /* GLM (پایهٔ پیش‌فرض) */
  'api.groq.com',                          /* Whisper */
  'api.openai.com',                        /* پایهٔ سازگار OpenAI */
  'open.bigmodel.cn',                      /* GLM (پایهٔ جایگزین) */
  /* v0.48 — گیت‌هاب: تله‌متری (ارسال خودکار لاگ با Gist API) + مسیرهای
     آپدیتر (api/releases/latest) — قبلاً پین نبودند و در فیلترینگِ DNS
     ممکن بود ارسال/بررسی نسخه بی‌دلیل رد شود */
  'api.github.com',                        /* Gist API + releases API */
  'github.com',                            /* releases/latest (web-json) + atom */
];

/* ساخت پکت پرس‌وجوی DNS (کلاس IN، نوع A) */
function buildQuery(id, name) {
  const labels = String(name || '').split('.').filter(Boolean);
  const parts = [Buffer.alloc(12)];
  parts[0].writeUInt16BE(id & 0xffff, 0); /* ID */
  parts[0].writeUInt16BE(0x0100, 2);      /* flags: RD=1 */
  parts[0].writeUInt16BE(1, 4);           /* QDCOUNT = 1 */
  for (const l of labels) {
    const b = Buffer.from(l, 'ascii');
    if (!b.length || b.length > 63) throw new Error('bad label');
    parts.push(Buffer.from([b.length]), b);
  }
  parts.push(Buffer.from([0]));                 /* انتهای QNAME */
  const tail = Buffer.alloc(4);
  tail.writeUInt16BE(1, 0);                     /* QTYPE  = A */
  tail.writeUInt16BE(1, 2);                     /* QCLASS = IN */
  parts.push(tail);
  return Buffer.concat(parts);
}

/* پرش از روی نامِ (احتمالاً فشرده‌شده) در بدنهٔ پاسخ */
function skipName(buf, off) {
  while (off < buf.length) {
    const len = buf[off];
    if ((len & 0xc0) === 0xc0) return off + 2;  /* پوینتر فشردگی */
    if (len === 0) return off + 1;
    off += len + 1;
  }
  return -1;
}

/* استخراج اولین رکورد A از پاسخ DNS */
function parseA(buf) {
  try {
    if (!buf || buf.length < 12) return null;
    if (!(buf[2] & 0x80)) return null;          /* QR باید پاسخ باشد */
    if ((buf[3] & 0x0f) !== 0) return null;     /* RCODE = 0 */
    const ancount = buf.readUInt16BE(6);
    if (!ancount) return null;
    let off = skipName(buf, 12);                /* رد کردن سؤال */
    off += 4;                                   /* QTYPE + QCLASS */
    for (let i = 0; i < ancount && off + 10 <= buf.length; i++) {
      off = skipName(buf, off);
      if (off < 0 || off + 10 > buf.length) return null;
      const type = buf.readUInt16BE(off);
      const rdlen = buf.readUInt16BE(off + 8);
      const rd = off + 10;
      if (type === 1 && rdlen === 4 && rd + 4 <= buf.length) {
        return buf[rd] + '.' + buf[rd + 1] + '.' + buf[rd + 2] + '.' + buf[rd + 3];
      }
      off = rd + rdlen;
    }
    return null;
  } catch (_) {
    return null;
  }
}

/* «ip» یا «ip:port» — فرمت دوم فقط برای تست با سرور محلی */
function splitServer(s) {
  const m = /^(\d+\.\d+\.\d+\.\d+)(?::(\d+))?$/.exec(String(s || '').trim());
  if (!m) return null;
  return { ip: m[1], port: Number(m[2] || 53) };
}

/* یک پرس‌وجو به یک سرور — همیشه resolve می‌شود (null = شکست) */
function queryOne(server, name, timeoutMs) {
  return new Promise((resolve) => {
    const tgt = splitServer(server);
    if (!tgt) { resolve(null); return; }
    const sock = dgram.createSocket('udp4');
    const id = (Math.random() * 0xffff) | 1;
    let q;
    try { q = buildQuery(id, name); } catch (_) { resolve(null); return; }
    let done = false;
    const fin = (v) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { sock.close(); } catch (_) { /* noop */ }
      resolve(v);
    };
    const timer = setTimeout(() => fin(null), Math.max(150, Number(timeoutMs) || 1200));
    sock.on('message', (msg) => {
      if (msg.length >= 12 && msg.readUInt16BE(0) === id) fin(parseA(msg));
    });
    sock.on('error', () => fin(null));
    try {
      sock.send(q, tgt.port, tgt.ip, (err) => { if (err) fin(null); });
    } catch (_) { fin(null); }
  });
}

/* v0.26 — یک پرس‌وجوی DoH (wireformat POST) — همیشه resolve می‌شود
   v0.60 (B6) — سقف زمانی «مطلق» با AbortController (~۳ ثانیه): گزینهٔ timeout
   قبلی فقط «بی‌کاریِ سوکت» را می‌سنجید و پاسخ قطره‌قطره می‌توانست فراتر برود؛
   حالا کل فراخوانی بعد از deadline قطع می‌شود (abort → fin(null) امن). */
function queryDoH(endpoint, name, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    let ac = null;
    let killer = null;
    let req = null;
    const fin = (v) => {
      if (done) return;
      done = true;
      if (killer) { clearTimeout(killer); killer = null; }
      try { if (ac) ac.abort(); } catch (_) { /* noop */ }
      try { if (req) req.destroy(); } catch (_) { /* noop */ }
      resolve(v);
    };
    let q;
    try { q = buildQuery((Math.random() * 0xffff) | 1, name); } catch (_) { resolve(null); return; }
    let u;
    try { u = new URL(String(endpoint || '')); } catch (_) { resolve(null); return; }
    /* B6 — ددلاین مطلق: min(آرگومان، ۳ ثانیه) — هرگز بیشتر از ~۳ ثانیه صبر نمی‌کنیم */
    const deadlineMs = Math.max(400, Math.min(Number(timeoutMs) || 3000, 3000));
    try {
      ac = new AbortController();
      killer = setTimeout(() => fin(null), deadlineMs);
    } catch (_) { ac = null; /* نسخه‌های خیلی قدیم نود — سقف سوکتی قبلی می‌ماند */ }
    try {
      req = https.request({
        hostname: u.hostname,
        port: Number(u.port) || 443,
        path: u.pathname + (u.search || ''),
        method: 'POST',
        headers: {
          'Content-Type': 'application/dns-message',
          'Accept': 'application/dns-message',
          'Content-Length': q.length,
        },
        timeout: Math.max(400, Number(timeoutMs) || 2500),
        signal: ac ? ac.signal : undefined,
        rejectUnauthorized: false, /* گواهی شکن منقضی است — rationale بالای فایل؛ هم‌سطح اعتماد UDP DNS */
      }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) return fin(null);
            fin(parseA(Buffer.concat(chunks)));
          } catch (_) { fin(null); }
        });
        res.on('error', () => fin(null));
      });
    } catch (_) { fin(null); return; }
    req.on('timeout', () => fin(null));
    req.on('error', () => fin(null));
    try { req.end(q); } catch (_) { fin(null); }
  });
}

/* پرس‌وجوی هم‌زمان به همهٔ سرورها — اولین جواب درست برنده است؛
   v0.26 — اگر همهٔ UDPها خواب بودند، DoH شکن (TCP:443) امتحان می‌شود؛
   v0.60 (B6) — روی شکست DoH «یک» تلاش دوباره می‌رود (خطای لحظه‌ای شبکه/TLS
   اغلب در تلاش دوم جواب می‌دهد) ولی فقط تا وقتی بودجهٔ زمانی (retryBudgetMs)
   اجازه دهد تا مسیر CLI سنکرونِ بوت هرگز از سقف spawnSync رد نشود. */
async function resolveHost(name, opts) {
  const o = opts || {};
  const servers = Array.isArray(o.servers) && o.servers.length ? o.servers : DEFAULT_SERVERS;
  const timeoutMs = Number(o.timeoutMs) || 1200;
  const t0 = Date.now();
  const results = await Promise.all(servers.map((s) => queryOne(s, name, timeoutMs)));
  const udpOk = results.find(Boolean);
  if (udpOk) return udpOk;
  const dohs = Array.isArray(o.doh) ? o.doh : DOH_ENDPOINTS;
  const retryBudgetMs = Number(o.retryBudgetMs) || 2400;
  for (const ep of dohs) {
    let ip = await queryDoH(ep, name, Number(o.dohTimeoutMs) || 2500);
    if (!ip && (Date.now() - t0) < retryBudgetMs) {
      ip = await queryDoH(ep, name, Number(o.dohTimeoutMs) || 2500); /* فقط یک تلاش دوباره */
    }
    if (ip) return ip;
  }
  return null;
}

/* چند میزبان با هم — خروجی فقط جواب‌های موفق */
async function resolveHosts(names, opts) {
  const out = {};
  await Promise.all((Array.isArray(names) ? names : []).map(async (h) => {
    const ip = await resolveHost(h, opts);
    if (ip) out[h] = ip;
  }));
  return out;
}

/* ساخت مقدار سوییچ host-resolver-rules کرومیوم */
function hostResolverRules(map) {
  return Object.entries(map || {})
    .map(([h, ip]) => 'MAP ' + h + ' ' + ip)
    .join(',');
}

/* ---------- حالت CLI (پروسهٔ اصلی با spawnSync صدا می‌زند) ---------- */
if (require.main === module) {
  const finish = (obj) => {
    try { process.stdout.write(JSON.stringify(obj)); } catch (_) { /* noop */ }
    try { process.exit(0); } catch (_) { /* noop */ }
  };
  const hardKill = setTimeout(() => finish({ ok: false, map: {}, error: 'hard-timeout' }), 4000);
  if (hardKill.unref) hardKill.unref();
  const fsRead = (p) => {
    try { return require('fs').readFileSync(p, 'utf8'); } catch (_) { return ''; }
  };
  /* B6 — فالبک رزولوشن سیستم: اگر UDP و DoH هر دو صفر جواب دادند، به‌جای
     بی‌جوابیِ مطلق، dns.lookup سیستم (getaddrinfo) آخرین شانس است —
     موازی و کوتاه (۵۰۰ms) تا سقف بوت نشکند. اگر سیستم هم جواب نداد،
     همان مسیر قبلی (host بدون pin → کرومیوم/نود خودش سیستم را می‌پرسد) می‌ماند. */
  const dnsMod = require('dns');
  const systemLookup = (h, ms) => new Promise((res) => {
    let fin = false;
    const t = setTimeout(() => { if (!fin) { fin = true; res(null); } }, Math.max(200, Number(ms) || 500));
    try {
      dnsMod.lookup(String(h || ''), { family: 4 }, (err, ip) => {
        if (fin) return;
        fin = true; clearTimeout(t);
        res(err ? null : String(ip || ''));
      });
    } catch (_) { if (!fin) { fin = true; clearTimeout(t); res(null); } }
  });
  try {
    const req = JSON.parse(fsRead(process.argv[2]) || '{}');
    const hosts = Array.isArray(req.hosts) && req.hosts.length ? req.hosts : DEFAULT_HOSTS;
    const servers = Array.isArray(req.servers) && req.servers.length ? req.servers : DEFAULT_SERVERS;
    const timeoutMs = Number(req.timeoutMs) || 1300;
    const t0 = Date.now();
    resolveHosts(hosts, { servers, timeoutMs })
      .then(async (map) => {
        try {
          if (Date.now() - t0 < 3300) {
            const missing = hosts.filter((h) => !map[h]);
            const sysAns = await Promise.all(missing.map(async (h) => [h, await systemLookup(h, 500)]));
            sysAns.forEach(([h, ip]) => { if (ip && !map[h]) map[h] = ip; });
          }
        } catch (_) { /* فالبک سیستم هرگز کل پروش را نمی‌کشد */ }
        finish({ ok: true, map });
      })
      .catch(() => finish({ ok: false, map: {} }));
  } catch (_) {
    finish({ ok: false, map: {} });
  }
}

module.exports = {
  SHECAN, ELECTRO, DEFAULT_SERVERS, DEFAULT_HOSTS, DOH_ENDPOINTS,
  buildQuery, parseA, queryOne, queryDoH, resolveHost, resolveHosts, hostResolverRules,
};
