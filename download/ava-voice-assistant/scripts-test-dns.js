'use strict';
/* ============================================================
   آوا — تست منطقی مستقل v0.24 (بدون الکترون، فقط نود)
   سرور DNS جعلی روی 127.0.0.1:پورت تصادفی می‌سازیم تا پاسخ‌خوان
   DNS و ساخت رول‌های کرومیوم واقعاً آزموده شوند.
   اجرا:  node scripts-test-dns.js
   ============================================================ */
const dgram = require('dgram');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const DB = require('./lib/dns-bypass');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('PASS | ' + name); }
  else { fail++; console.log('FAIL | ' + name + (extra ? ' | ' + extra : '')); }
};

/* --- سرور DNS جعلی: به هر پرس‌وجوی A با یک رکورد A ثابت جواب می‌دهد --- */
function fakeDnsServer(answerIp, opts) {
  const o = opts || {};
  const sock = dgram.createSocket('udp4');
  let hits = 0;
  sock.on('message', (msg, rinfo) => {
    hits++;
    const respond = () => {
      try {
        /* هدر پاسخ: QR=1, RD=1, RA=1, RCODE=0, QD=1, AN=1 */
        const head = Buffer.from([msg[0], msg[1], 0x81, 0x80, 0, 1, 0, 1, 0, 0, 0, 0]);
        const question = msg.slice(12); /* QNAME + QTYPE + QCLASS */
        const name = Buffer.from([0xc0, 0x0c]); /* پوینتر به سؤال */
        const rr = Buffer.alloc(10);
        rr.writeUInt16BE(1, 0);      /* TYPE  = A */
        rr.writeUInt16BE(1, 2);      /* CLASS = IN */
        rr.writeUInt32BE(300, 4);    /* TTL */
        rr.writeUInt16BE(4, 8);      /* RDLEN */
        const ipBuf = Buffer.from(String(answerIp).split('.').map((x) => Number(x) & 0xff));
        const body = Buffer.concat([name, rr, ipBuf]);
        const out = Buffer.concat([head, question, body]);
        sock.send(out, rinfo.port, rinfo.address);
      } catch (_) { /* noop */ }
    };
    if (o.delayMs) setTimeout(respond, o.delayMs);
    else respond();
  });
  sock.on('error', () => { /* noop */ });
  const ready = new Promise((res) => sock.bind(0, '127.0.0.1', res));
  return { sock, ready, port: () => sock.address().port, hits: () => hits, close: () => { try { sock.close(); } catch (_) { /* noop */ } } };
}

(async () => {
  const IP = '142.250.185.68';

  /* ۱) ساخت پکت پرس‌وجو + پاسخ‌خوان: رفت و برگشت کامل روی سوکت واقعی */
  const srv = fakeDnsServer(IP);
  await srv.ready;
  const port = srv.port();
  ok('fake dns server bound on 127.0.0.1:' + port, port > 1024);

  const q = DB.buildQuery(0x1234, 'www.google.com');
  ok('buildQuery: header RD=1 QDCOUNT=1 + QTYPE=A', q.length > 17 && q.readUInt16BE(4) === 1 && q.readUInt16BE(q.length - 4) === 1);

  const ip = await DB.resolveHost('www.google.com', { servers: ['127.0.0.1:' + port], timeoutMs: 900 });
  ok('resolveHost via fake server returns pinned IP', ip === IP, 'got=' + ip);
  ok('fake server actually received the query', srv.hits() >= 1);

  /* ۲) همه‌شکست → null (نه اکسپشن، نه هنگ) */
  const t0 = Date.now();
  const dead = await DB.resolveHost('www.google.com', { servers: ['127.0.0.1:9', '127.0.0.1:1'], timeoutMs: 400 });
  ok('resolveHost: all servers dead → null (no throw, bounded)', dead === null && Date.now() - t0 < 2500, 'dt=' + (Date.now() - t0));

  /* ۳) پاسخ آشغال → null (پارس امن) */
  ok('parseA: garbage buffer → null safely', DB.parseA(Buffer.from([1, 2, 3, 4])) === null && DB.parseA(null) === null);

  /* ۴) چند میزبان با هم */
  const map = await DB.resolveHosts(['www.google.com', 'api.groq.com'], { servers: ['127.0.0.1:' + port], timeoutMs: 900 });
  ok('resolveHosts: both hosts resolved', map['www.google.com'] === IP && map['api.groq.com'] === IP, JSON.stringify(map));

  /* ۵) ساخت رول کرومیوم */
  const rules = DB.hostResolverRules(map);
  ok('hostResolverRules format', rules === 'MAP www.google.com ' + IP + ',MAP api.groq.com ' + IP, rules);

  /* ۶) حالت CLI — همان مسیری که پروسهٔ اصلی الکترون با spawnSync صدا می‌زند
        (فایل پیکربندی از argv[2]، خروجی JSON روی stdout).
        ⚠ سرور جعلی باید در «پروسهٔ جداگانه» باشد: spawnSync حلقهٔ رویداد
        این پروسه را می‌بندد و سرورِ داخل همین پروسه هرگز نمی‌تواند جواب بدهد. */
  const srvPath = path.join(os.tmpdir(), 'ava-fake-dns-' + Date.now() + '.js');
  fs.writeFileSync(srvPath, [
    'const dgram = require("dgram");',
    'const s = dgram.createSocket("udp4");',
    's.on("message", (msg, rinfo) => {',
    '  const rr = Buffer.alloc(10);',
    '  rr.writeUInt16BE(1, 0); rr.writeUInt16BE(1, 2); rr.writeUInt32BE(300, 4); rr.writeUInt16BE(4, 8);',
    '  const resp = Buffer.concat([Buffer.from([msg[0], msg[1], 0x81, 0x80, 0, 1, 0, 1, 0, 0, 0, 0]), msg.slice(12), Buffer.from([0xc0, 0x0c]), rr, Buffer.from([142, 250, 185, 68])]);',
    '  s.send(resp, rinfo.port, rinfo.address);',
    '});',
    's.bind(0, "127.0.0.1", () => { console.log("PORT " + s.address().port); });',
  ].join('\n'));
  /* async spawn — سرور زنده می‌ماند تا بعد از spawnSyncِ کلاینت جواب بدهد */
  const { spawn } = require('child_process');
  const child = spawn(process.execPath, [srvPath], { stdio: ['ignore', 'pipe', 'pipe'] });
  const mPort = await new Promise((res) => {
    let buf = '';
    const to = setTimeout(() => res(null), 4000);
    child.stdout.on('data', (d) => {
      buf += d;
      const m = /PORT (\d+)/.exec(buf);
      if (m) { clearTimeout(to); res(m[1]); }
    });
  });
  ok('standalone fake dns server child started', !!mPort);
  let cli = null;
  if (mPort) {
    const tmpCfg = path.join(os.tmpdir(), 'ava-dns-probe-cfg-' + Date.now() + '.json');
    fs.writeFileSync(tmpCfg, JSON.stringify({ hosts: ['www.google.com'], servers: ['127.0.0.1:' + mPort], timeoutMs: 900 }));
    const r = spawnSync(process.execPath, [path.join(__dirname, 'lib', 'dns-bypass.js'), tmpCfg], { encoding: 'utf8', timeout: 6000 });
    try {
      const out = String(r.stdout || '');
      cli = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1));
    } catch (_) { /* noop */ }
    ok('CLI probe mode (spawnSync + argv cfg file) returns map', !!(cli && cli.ok && cli.map && cli.map['www.google.com'] === IP), 'stdout=' + String(r.stdout || '').slice(0, 120));
    fs.unlinkSync(tmpCfg);
  }
  try { child.kill(); } catch (_) { /* noop */ }
  fs.unlinkSync(srvPath);

  /* ۷) تاخیر سرور — سقف زمانی باید جلوی هنگ را بگیرد */
  const slow = fakeDnsServer(IP, { delayMs: 1500 });
  await slow.ready;
  const slowIp = await DB.resolveHost('www.google.com', { servers: ['127.0.0.1:' + slow.port()], timeoutMs: 300 });
  ok('slow server respects per-query timeout (null, fast)', slowIp === null);
  slow.close();
  srv.close();

  console.log('TEST SUMMARY: ' + pass + '/' + (pass + fail) + ' passed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST_ERROR', e); process.exit(2); });
