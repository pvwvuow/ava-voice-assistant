/* ابزار تست: استخراج discordPsScript از main.js و بررسی اسکریپت‌های تولیدی */
const fs = require('fs');
const path = '/home/z/my-project/download/ava-voice-assistant/main.js';
const src = fs.readFileSync(path, 'utf8');
const a = src.indexOf('function discordPsScript');
const b = src.indexOf('function runDiscordPs');
if (a < 0 || b < 0 || b <= a) { console.log('bounds fail'); process.exit(1); }
const slice = src.slice(a, b).trim();
const fn = new Function('return ' + slice)();
const checks = [];
for (const [tag, act, mode, nm] of [
  ['bg-callswitch', 'callswitch', 'bg', 'علی test'],
  ['fg-clickcall', 'clickcall', 'fg', ''],
  ['fg-mute', 'mute', 'fg', ''],
  ['bg-mute', 'mute', 'bg', ''],
  ['fg-probe', 'probe', 'fg', ''],
  ['bg-deafen', 'deafen', 'bg', ''],
]) {
  const s = fn(act, mode, nm, 46, 52, act.includes('call') ? 25000 : 6000, act.includes('call') ? 8 : 1);
  fs.writeFileSync('/tmp/dc-' + tag + '.ps1', s, 'utf8');
  const bal = (s.match(/{/g) || []).length === (s.match(/}/g) || []).length;
  const paren = (s.match(/\(/g) || []).length === (s.match(/\)/g) || []).length;
  const noBlock = !/\/\*/.test(s);
  const noLeftover = !/\$\{[a-zA-Z]/.test(s);
  checks.push({ tag, len: s.length, bal, paren, noBlock, noLeftover });
  console.log(tag, 'len=' + s.length, 'braces=' + (bal ? 'OK' : 'BAD'), 'parens=' + (paren ? 'OK' : 'BAD'), 'noBlockComment=' + noBlock, 'interp=' + (noLeftover ? 'OK' : 'BAD'));
}
const s1 = fn('callswitch', 'bg', 'علی', 46, 52, 25000, 8);
console.log('wait line :', s1.split('\n').find((l) => l.includes('$waited -lt')));
console.log('retry line:', s1.split('\n').find((l) => l.includes('$tryN -le')));
console.log('mode line :', s1.split('\n').find((l) => l.startsWith('$mode =')));
if (checks.some((c) => !c.bal || !c.paren || !c.noBlock || !c.noLeftover)) process.exit(1);
console.log('PS GENERATION OK');
