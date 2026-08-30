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

  /* ۲) همه‌شکست (بدون فالبک DoH) → null (نه اکسپشن، نه هنگ) */
  const t0 = Date.now();
  const dead = await DB.resolveHost('www.google.com', { servers: ['127.0.0.1:9', '127.0.0.1:1'], timeoutMs: 400, doh: [] });
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
  const slowIp = await DB.resolveHost('www.google.com', { servers: ['127.0.0.1:' + slow.port()], timeoutMs: 300, doh: [] });
  ok('slow server respects per-query timeout (null, fast)', slowIp === null);
  slow.close();

  /* ---------- v0.26 — لایهٔ DoH (RFC 8484 wireformat POST) ----------
     سرور HTTPS محلی با گواهی self-signed (همان حالتی که گواهی شکن منقضی
     است و rejectUnauthorized:false باید آن را بپذیرد) */
  const httpsSrv = require('https');
  /* self-signed فیکسچر (base64 داخل خود تست — .gitignore اجازهٔ pem نمی‌دهد) */
  const fxt = path.join(os.tmpdir(), 'ava-doh-fixture-' + Date.now());
  fs.mkdirSync(fxt, { recursive: true });
  fs.writeFileSync(path.join(fxt, 'key.pem'), Buffer.from('LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JSUV2d0lCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktrd2dnU2xBZ0VBQW9JQkFRRFZ3c3VucDdoUFBkWUcKU1JrUmRmdGRnTnQrUjFRUEg2OVVMMEQ5MHVzT1BPMEJ1eDl4bHFCcU42TWgrbU8wUkNSeUFWenYwZ0VQSDNPTApkN2drYW5PV0g3bHJNWHlacXNuUGNKamZRYzVLNTJCYWhCNlNNeDJsS1dxT1Y2RjZtcVQ1ZGptRjBVdlVZWVdyCld2Q2VVejFnMVN3THE3MVUzMVhTS2NlcitTYkpxbUwxdFRVazdVZnZCOG5DWHBiWDRMaWNxa3lzNEw4SnR3RnUKZVRlUUF2REppQUxkTE54d1VNVkp0SElNeDg2SDVVV0luTEsxRG53cXdTZlk4NUc2UVJhQzRSS3dkczNyYkVWaQpoVS9PM25aKzdRRjlmaWNMaWkvZTBhbjlXeDRHTVd5NFBDNVh5SzNRR1ZWN1FuUXdzWWN5ckZZbXFtQjR2bWdlClBXZzR1aDNkQWdNQkFBRUNnZ0VBSTcrMVgvZEdkV2dsd2p6WTFxajR6aGtsL0I4eE1XdE8zdUVkT1NYY1BqQVYKd2YrWm9WMDd2Qy9NVmpzaUVBeUNYTmVhQTVpSEtWQ00raExlUnFiUDZGZ3JZZ0F2Y3FLVHFCL1FUU3diOUQ1dwpTSXNHY3RSZUhaaEkwLy9YUjJJVCs0MVlUdWNqQzZSNG5xRHhrMFRnQTdENjhnTzVnUGR0eXAxR29aM2tMUDhGCnhKQTJ0eXVFYS9CSnprYU8rQUp1bXVtWUhyUTJhZ3ZlcG1YZHRwMllMQlY3UE9aREdFZ3VxT05KekJoK2l2WWMKNEtNbDdIOGsrVTJ5QmFXTkRaU2k1MnJxajdvOFhsNU02TlQ4R3g1c20xVXJlakM1NVZzMHBNUXAvMTFBYVRPSgpxQzYvYUhmY0lzazdpc2NDaklEWTAzUlR2UjJ5WUcwbUJGWG1GMVRGSVFLQmdRRDA2aDFFM2tKYjJLY0oxM1R2Cm4yb3ZMcTZvcmsyNnpQL3ZOcXlXTUVjeVdZdTUydzBmcjBnU3FuUTVOZlp0TGNCdHh1RzM3VEdyS29GekpDVloKemxDZ1QwSnBZSmdCNmVPSkFSaTVQL2d2Z2hrZlIrWGFpK0NFU1N5L004bU1QdWttQmRKNVRmdkdTL0JQb3JpNApkZDI1QlRxZlBNWFVHdEFKRDRBWTh3dHU0UUtCZ1FEZmI3SmZVWTF3QW5BTitFYXlTOHlaYnRHMVBKampXeUFVCmlxV09uOXZwWUJmY3lTcm9jc2YyL2hyN0NIVG4rbExRT3R3Z3R4UXc1cFpMZXZFLzNhYnBGUm9mTDYxZTkzVVoKQXdqZHhZeDFRSWlWclZrWHFEYlhPOTBucXNXenRLMzRkLys3MTRNWDZLaEp4aVNmMWRHbm1KN2pkbjRXS2srdwpySEZtazhZNmZRS0JnUUNXT2JBZ1dSQnRFL1JKcGgzMUNWeHhlbm5wdjVpd0Z5UjVqNWpIT3UvQTQ0cEFReXZHCm5wWmYxS3dibDQwREpRZ2VqZHBRSGk3VUpldG5PK21wTDFMbk1oYXpXbXVDNlBzSFEyUHQ1VjRQamdabzJJb1YKeHF5OWw4RFp1eU5LWWlCU2tVbXIzSGl1QmxCdUdJcWpvckNRMTdOQWoxOXRIZEV6YlkyT1FDNW9JUUtCZ1FEZQpwRmFCVktvektycXRzUEFCU2phZHpTZDZDTi92N1NXU1VuV1dJUVRwRDYrM2VWMGdNdisreG9Yc0R3a3UvdWoyClJUQ0VDT285c0FlalB1YVdWUyswb2lwZFdRelF6SlFLVUZQTmFNUUZNa0RucE14YUhteEhISWZLdHdnNWdaaTUKTmhuRis0SE5tUy9ZRTNEN00veXRuQTczYVdOS2d1N1ZoWCthVHpYL29RS0JnUURTZHZ3SEZzUW51OXlqRWkrdAorbUJPMTNFWDBSYnZzYmNKcWFjVkgrcGdwcGcxeXIremcvKzFoVVljWWR2endVSFZiVmlGQ1dFYlBVQTFyUjE1CnpNdjNZYkZxaWdiRkc5QVhwT2RocEsycXZXV0JXc29NUnN0WUlmS0svZDh6cEVBNjhBRm5tOHZrR3JpYmZTL3gKaEhROFpmelN0QUhhMXN5VFRKMFB3OU1HS3c9PQotLS0tLUVORCBQUklWQVRFIEtFWS0tLS0tCg==', 'base64'));
  fs.writeFileSync(path.join(fxt, 'cert.pem'), Buffer.from('LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSURDVENDQWZHZ0F3SUJBZ0lVSVB2NVBBMGpacy9iamZNUFR6RkdoWkxIbVhjd0RRWUpLb1pJaHZjTkFRRUwKQlFBd0ZERVNNQkFHQTFVRUF3d0piRzlqWVd4b2IzTjBNQjRYRFRJMk1EZ3pNREV6TURjd04xb1hEVE0yTURneQpOekV6TURjd04xb3dGREVTTUJBR0ExVUVBd3dKYkc5allXeG9iM04wTUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGCkFBT0NBUThBTUlJQkNnS0NBUUVBMWNMTHA2ZTRUejNXQmtrWkVYWDdYWURiZmtkVUR4K3ZWQzlBL2RMckRqenQKQWJzZmNaYWdhamVqSWZwanRFUWtjZ0ZjNzlJQkR4OXppM2U0SkdwemxoKzVhekY4bWFySnozQ1kzMEhPU3VkZwpXb1Fla2pNZHBTbHFqbGVoZXBxaytYWTVoZEZMMUdHRnExcndubE05WU5Vc0M2dTlWTjlWMGluSHEva215YXBpCjliVTFKTzFIN3dmSndsNlcxK0M0bktwTXJPQy9DYmNCYm5rM2tBTHd5WWdDM1N6Y2NGREZTYlJ5RE1mT2grVkYKaUp5eXRRNThLc0VuMlBPUnVrRVdndUVTc0hiTjYyeEZZb1ZQenQ1MmZ1MEJmWDRuQzRvdjN0R3AvVnNlQmpGcwp1RHd1VjhpdDBCbFZlMEowTUxHSE1xeFdKcXBnZUw1b0hqMW9PTG9kM1FJREFRQUJvMU13VVRBZEJnTlZIUTRFCkZnUVV6djRUbjJFdnJGWmdZOHVBYkduMVlybkFBNVV3SHdZRFZSMGpCQmd3Rm9BVXp2NFRuMkV2ckZaZ1k4dUEKYkduMVlybkFBNVV3RHdZRFZSMFRBUUgvQkFVd0F3RUIvekFOQmdrcWhraUc5dzBCQVFzRkFBT0NBUUVBbDA1bApiZjBZdEdoVEdQM0VNQm9OZittNUozQm5pT1dONGVBZFdlZlo0UEJ2SGFkLzVNT2FIbFR4YVQ3Wjg3T0JkWjN1ClpPOHJNL0hPRC9keDZlcXE3aEJxR2FzL1cyOHBzdFBZeUcwR0hRN0ROSGZvZnRWWUJsc29tbEtBT2VaYmNBZzYKVkQrM3dGRzR2Y0d3NkN0WXM4citXTFRaNDRzMjV3ZWdjQ0UrZHdWSTRkaytvWHQ4dENLZzc3WkdIZlFUQTNQeQpxdXRQL0kxaFJveFRjWGkwWHpWK2I5K3E5eEEvcDBNOUNvb1lNRkhQOEVJbDhra0RMQkhGWU9aWjFsNHZJNTRYCmE3VGdsamswNDBNRE1MNEFyY3l0d3ZYWUZ2TDk4R1RFMkVIZlNpejlMZVV6UFNtdXhEWndoeWpOWGlOUWV6bHIKZnJEYTJ0WjhTTlNtK0pLeDR3PT0KLS0tLS1FTkQgQ0VSVElGSUNBVEUtLS0tLQo=', 'base64'));
  const FAKE_KEY = fs.readFileSync(path.join(fxt, 'key.pem'), 'utf8');
  const FAKE_CERT = fs.readFileSync(path.join(fxt, 'cert.pem'), 'utf8');
  const wireAnswer = (queryBuf, ipStr) => {
    /* پاسخ وایرفرمت: هدر (همان ID) + سؤال اصلی + یک رکورد A */
    const head = Buffer.from([queryBuf[0], queryBuf[1], 0x81, 0x80, 0, 1, 0, 1, 0, 0, 0, 0]);
    const rr = Buffer.alloc(10);
    rr.writeUInt16BE(1, 0); rr.writeUInt16BE(1, 2); rr.writeUInt32BE(300, 4); rr.writeUInt16BE(4, 8);
    const ipBuf = Buffer.from(String(ipStr).split('.').map((x) => Number(x) & 0xff));
    return Buffer.concat([head, queryBuf.slice(12), Buffer.from([0xc0, 0x0c]), rr, ipBuf]);
  };
  const dohServer = httpsSrv.createServer({ key: FAKE_KEY, cert: FAKE_CERT }, (req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        if (req.method !== 'POST' || !/dns-message/.test(String(req.headers['content-type'] || ''))) {
          res.writeHead(400); res.end(); return;
        }
        const q = Buffer.concat(chunks);
        res.writeHead(200, { 'Content-Type': 'application/dns-message' });
        res.end(wireAnswer(q, '10.9.8.7'));
      } catch (_) { try { res.writeHead(500); res.end(); } catch (_) { /* noop */ } }
    });
  });
  const dohReady = new Promise((res) => dohServer.listen(0, '127.0.0.1', res));
  await dohReady;
  const dohPort = dohServer.address().port;
  const dohUrl = 'https://127.0.0.1:' + dohPort + '/dns-query';

  /* ۸) queryDoH مستقیم روی سرور جعلی با گواهی نامعتبر → باید جواب بگیرد */
  const dohIp = await DB.queryDoH(dohUrl, 'www.google.com', 2500);
  ok('queryDoH: self-signed HTTPS accepted (rejectUnauthorized:false) + wireformat parsed', dohIp === '10.9.8.7', 'got=' + dohIp);

  /* ۹) قلب v0.26: UDP مرده → فالبک DoH باید نجات بدهد */
  const rescued = await DB.resolveHost('www.google.com', { servers: ['127.0.0.1:9', '127.0.0.1:1'], timeoutMs: 300, doh: [dohUrl], dohTimeoutMs: 2500 });
  ok('resolveHost: dead UDP → DoH fallback rescues', rescued === '10.9.8.7', 'got=' + rescued);

  /* ۱۰) DoH زنده ولی پاسخ HTTP غیر-۲۰۰ → null امن */
  const badServer = httpsSrv.createServer({ key: FAKE_KEY, cert: FAKE_CERT }, (req, res) => { res.writeHead(503); res.end('no'); });
  await new Promise((res) => badServer.listen(0, '127.0.0.1', res));
  const badIp = await DB.queryDoH('https://127.0.0.1:' + badServer.address().port + '/dns-query', 'www.google.com', 2000);
  ok('queryDoH: non-200 response → null safely', badIp === null);
  badServer.close();

  /* ۱۱) endpoint خراب/نامعتبر → null بدون اکسپشن */
  ok('queryDoH: invalid endpoint → null safely', await DB.queryDoH('not a url', 'www.google.com', 500) === null);

  dohServer.close();
  srv.close();

  console.log('TEST SUMMARY: ' + pass + '/' + (pass + fail) + ' passed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST_ERROR', e); process.exit(2); });
