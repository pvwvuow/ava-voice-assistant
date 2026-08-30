/* ابزار تست v0.22: استخراج DISCORD_PS_BODY (اسکریپت ایستای param دار) از main.js
   و بررسی ساختاری + شبیه‌سازی طول خط فرمان با spawn -File */
const fs = require('fs');
const file = '/home/z/my-project/download/ava-voice-assistant/main.js';
const src = fs.readFileSync(file, 'utf8');
const a = src.indexOf('const DISCORD_PS_BODY = `');
const b = src.indexOf('`;', a);
if (a < 0 || b < 0) { console.log('bounds fail'); process.exit(1); }
const body = src.slice(a + 'const DISCORD_PS_BODY = `'.length, b);
const out = '/home/z/my-project/scripts/out-ava-dc.ps1';
/* BOM همان‌طور که در runDiscordPs نوشته می‌شود */
fs.writeFileSync(out, '\ufeff' + body, 'utf8');

const bal = (body.match(/{/g) || []).length === (body.match(/}/g) || []).length;
const paren = (body.match(/\(/g) || []).length === (body.match(/\)/g) || []).length;
const sq = (body.match(/'/g) || []).length;
const noBlock = !/\/\*/.test(body);
const noLeftover = !/\$\{[a-zA-Z]/.test(body); /* هیچ interpolation جاوااسکریپتی نمانده باشد */
const hasParam = /\nparam\(/.test(body);
const uses = ['$Action', '$Mode', '$Name', '$Dx', '$Dy', '$WaitMs', '$Retries']
  .filter((v) => !body.includes(v));
const startsParam = body.trimStart().startsWith('param(');
const firstLineBom = fs.readFileSync(out).slice(0, 3).toString('hex') === 'efbbbf';

console.log('script len        :', body.length);
console.log('braces balanced   :', bal ? 'OK' : 'BAD');
console.log('parens balanced   :', paren ? 'OK' : 'BAD');
console.log('single quotes     :', sq, (sq % 2 === 0) ? '(even OK)' : '(ODD — check!)');
console.log('no block comment  :', noBlock ? 'OK' : 'BAD');
console.log('no JS ${} leftover:', noLeftover ? 'OK' : 'BAD');
console.log('param() first stmt:', (hasParam && startsParam) ? 'OK' : 'BAD');
console.log('BOM written       :', firstLineBom ? 'OK' : 'BAD');
console.log('params used all   :', uses.length ? ('MISSING: ' + uses.join(',')) : 'OK');

/* شبیه‌سازی خط فرمان واقعی روی ویندوز: spawn با آرگومان‌های جدا (بدون cmd.exe) */
const argv = ['powershell.exe', '-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass',
  '-File', 'C:\\Users\\u\\AppData\\Roaming\\AVA Voice Assistant\\ava-dc.ps1',
  '-Action', 'callswitch', '-Mode', 'bg', '-Name', 'علی', '-Dx', '46', '-Dy', '52', '-WaitMs', '25000', '-Retries', '12'];
const cl = argv.map((x) => (/[ "]/.test(x) ? '"' + x.replace(/"/g, '\\"') + '"' : x)).join(' ');
console.log('command line len  :', cl.length, cl.length < 8000 ? 'OK (cmd.exe-safe)' : 'TOO LONG');
const hasFileExec = /-File', psFile/.test(src) && /spawn\('powershell\.exe'/.test(src);
console.log('spawn -File exec  :', hasFileExec ? 'OK' : 'BAD');
const noEncoded = !src.includes('-EncodedCommand ${encoded}');
console.log('no EncodedCommand :', noEncoded ? 'OK' : 'BAD');

const ok = bal && paren && noBlock && noLeftover && hasParam && startsParam && firstLineBom && !uses.length
  && cl.length < 8000 && hasFileExec && noEncoded && sq % 2 === 0;
console.log(ok ? 'PS GENERATION OK' : 'PS GENERATION FAILED');
process.exit(ok ? 0 : 1);
