/* v0.28.1 — regression suite for the ava-dc.ps1 parse-error fix.
   Root cause: a curly apostrophe (U+2019) inside the PowerShell callswitch
   regex acted as a STRING DELIMITER (PS treats U+2018/2019/201C/201D as
   quotes) → '..." opened an unterminated double-quoted string →
   "ava-dc.ps1:193 char:34 The string is missing the terminator: "" → the
   whole script never ran → every Discord command failed. */
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS | ' + name); }
  else { fail++; console.log('FAIL | ' + name + (extra ? ' | ' + String(extra).slice(0, 140) : '')); }
}

const mainSrc = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
const body = (mainSrc.match(/const DISCORD_PS_BODY = `([\s\S]*?)`;/) || ['', ''])[1];
ok('DISCORD_PS_BODY extractable from main.js', body.length > 4000, body.length);

/* 1) The invariant: no curly quote may exist anywhere in the generated ps1 */
ok('body has ZERO U+2018/U+2019/U+201C/U+201D (parser poison gone)', !/[\u2018\u2019\u201C\u201D]/.test(body));
ok('fixed callswitch line uses ASCII-only char class', body.includes("$name = ($Name -replace '[''\"]', '')"));
ok('runtime strip of all 4 curly quotes via [char] codes', body.includes('foreach ($cq in [char]0x2018, [char]0x2019, [char]0x201C, [char]0x201D)'));
ok('JS entry sanitizer (safeName) strips curly quotes too', mainSrc.includes(".replace(/['\u2019\u2018\u201C\u201D`\"…]/g"));

/* 2) Mechanical proof: simulate the PS single-quote tokenizer (curly = delimiter) */
function tokenizeSingleQuoteState(line) {
  /* returns { state: 'sq'|'dq'|'code', notes[] } walking the line exactly like
     the PS tokenizer for quote handling ('' escape inside SQ, curly quotes as
     delimiters, " opens DQ) */
  let state = 'code';
  const notes = [];
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (state === 'code') {
      if (ch === "'") { state = 'sq'; notes.push(i + 1 + ':open-SQ'); }
      else if (ch === '\u2018' || ch === '\u2019') { state = 'sq'; notes.push(i + 1 + ':open-SQ(curly)'); }
      else if (ch === '"') { state = 'dq'; notes.push(i + 1 + ':open-DQ'); }
      else if (ch === '\u201C' || ch === '\u201D') { state = 'dq'; notes.push(i + 1 + ':open-DQ(curly)'); }
    } else if (state === 'sq') {
      if (ch === "'") {
        if (line[i + 1] === "'") { i++; notes.push(i + 1 + ':escaped'); }
        else { state = 'code'; notes.push(i + 1 + ':close-SQ'); }
      } else if (ch === '\u2019' || ch === '\u2018') { state = 'code'; notes.push(i + 1 + ':close-SQ(curly)'); }
      /* " inside SQ is literal */
    } else { /* dq */
      if (ch === '"') { state = 'code'; notes.push(i + 1 + ':close-DQ'); }
      else if (ch === '\u201C' || ch === '\u201D') { state = 'code'; notes.push(i + 1 + ':close-DQ(curly)'); }
    }
  }
  return { state, notes };
}

const oldLine = "    $name = ($Name -replace '[''\u2019\"]', '')";
const newLine = "    $name = ($Name -replace '[''\"]', '')";
const oldTok = tokenizeSingleQuoteState(oldLine);
const newTok = tokenizeSingleQuoteState(newLine);
ok('OLD line: tokenizer lands UNTERMINATED inside DQ (reproduces user error at char 34)', oldTok.state === 'dq' && oldTok.notes.some((n) => n.startsWith('34:')), JSON.stringify(oldTok.notes));
ok('NEW line: tokenizer returns to code state (balanced)', newTok.state === 'code', JSON.stringify(newTok.notes));

/* 3) Whole-body quote-state walk (mirrors the PS tokenizer: SQ/DQ delimiters
      — ASCII AND curly — '' escape, here-strings, comments). The body must
      return to code state at EOF; any unterminated string = parse error. */
function bodyQuoteWalk(text) {
  const lines = text.split('\n');
  let state = 'code'; /* code | sq | dq | heredoc */
  for (let ln = 0; ln < lines.length; ln++) {
    const line = lines[ln];
    if (state === 'heredoc') { if (/^'@/.test(line)) state = 'code'; continue; }
    for (let i = 0; i < line.length; i++) {
      const ch = line[i], nx = line[i + 1];
      if (state === 'code') {
        if (ch === '#') break; /* comment to EOL */
        if (ch === '@' && nx === "'") { state = 'heredoc'; break; }
        if (ch === "'") state = 'sq'; /* '' as empty string resolves inside the sq handler */
        else if (ch === '"') state = 'dq';
        else if (ch === '\u2018' || ch === '\u2019') state = 'sq';
        else if (ch === '\u201C' || ch === '\u201D') state = 'dq';
        else if (ch === '`') i++; /* backtick escape */
      } else if (state === 'sq') {
        if (ch === "'") { if (nx === "'") i++; else state = 'code'; }
        else if (ch === '\u2019' || ch === '\u2018') state = 'code'; /* the poison rule */
      } else { /* dq */
        if (ch === '"') state = 'code';
        else if (ch === '\u201C' || ch === '\u201D') state = 'code';
        else if (ch === '`') i++;
      }
    }
    if (state === 'sq' || state === 'dq') return { ok: false, line: ln + 1, state };
  }
  return { ok: state === 'code', line: lines.length, state };
}
const walk = bodyQuoteWalk(body);
ok('whole-body quote walk ends in code state (no unterminated string anywhere)', walk.ok, 'broke at line ' + walk.line + ' state=' + walk.state);
/* negative control: feed the walk the PRE-FIX body (reintroduce the old line)
   — it MUST flag an unterminated double-quote, proving the check catches it */
const oldBody = body.replace("$name = ($Name -replace '[''\"]', '')", "$name = ($Name -replace '[''\u2019\"]', '')");
const walkOld = bodyQuoteWalk(oldBody);
ok('negative control: pre-fix body IS flagged by the walk (check actually works)', !walkOld.ok, 'state=' + walkOld.state + ' line=' + walkOld.line);

/* 4) stderr surfacing: the app must show the REAL message line, not just
      the "At ...:193 char:34" header (the old code split()[0] hid it) */
const sampleErr = [
  'At C:\\Users\\x\\AppData\\Roaming\\AVA Voice Assistant\\ava-dc.ps1:193 char:34',
  "+     $name = ($Name -replace '[''\u2019\"]', '')",
  '+                                      ~',
  'The string is missing the terminator: ".',
  '    + CategoryInfo          : ParserError: (:) [], ParseException',
  '    + FullyQualifiedErrorId  : TerminatorExpectedAtEndOfString',
].join('\r\n');
const el = sampleErr.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
const msgLine = el.find((l) => !/^At /.test(l) && !/^\+/.test(l) && !/^CategoryInfo/i.test(l) && !/^FullyQualifiedErrorId/i.test(l)) || el[0] || '';
const posM = (el[0] || '').match(/:(\d+) char:(\d+)\s*$/);
ok('real message extracted from PS stderr', msgLine === 'The string is missing the terminator: ".', msgLine);
ok('line number still included in parentheses', posM && posM[1] === '193', posM && posM[1]);
ok('main.js contains the surfacing algorithm', mainSrc.includes("const msgLine = el.find((l) => !/^At /.test(l)"));

/* 5) versions bumped */
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
ok('package.json >= 0.28.1', pkg.version >= '0.28.1', pkg.version);
ok('index.html abVersion >= 0.28.1', fs.readFileSync(path.join(__dirname, 'renderer/index.html'), 'utf8').includes('0.28') || fs.readFileSync(path.join(__dirname, 'renderer/index.html'), 'utf8').includes('0.29'));
ok('app.js appVersion >= 0.28.1', /appVersion[^;]*0\.(28|29|30)\./.test(fs.readFileSync(path.join(__dirname, 'renderer/js/app.js'), 'utf8')));

console.log(`\nRESULT: ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
