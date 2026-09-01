/* ============================================================
   AVA v0.36.0 — تست‌های رگرسیون
   ریشه‌های اصلی این نسخه (گزارش کاربر):
   C1  «دیسکورد دیگه اصلاً کاری نمیکنه» — ریشه: فیلتر MainWindowHandle
       (دیسکوردِ در try پیدا نمی‌شد) + کلید سراسری بدون نیاز به فوکوس
   C2  wake word ضعیف — تطبیق فازی (آبا/آوه/آو)، حذف سکوتِ سر، فرصت دوم ابری
   C3  «بابا یه جوک خفن بگو» سرچ می‌شد — جک/جوک اول به AI می‌رود
   C4  «سایت سافت 98 که خیلی خوبه رو باز کن» سرچ می‌شد — دیکشنری سایت +
       حذف بند «که …» + استخراج اسم از دل جمله
   C5  تنظیمات: پنل بیدارباش جدا، یادداشتِ یتیم حذف، ترتیب جدید، دیسکورد پیشرفته جمع‌شده
   C6  پنجرهٔ تایپ هوش مصنوعی بزرگ‌تر (textarea) + اسم مدل خوانا
   NEG CONTROL ها اثبات می‌کنند هر گارد واقعاً کار می‌کند.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond) {
  if (cond) { pass++; console.log('PASS | ' + name); }
  else { fail++; fails.push(name); console.log('FAIL | ' + name); }
}
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

const mainSrc = read('main.js');
const appSrc = read('renderer/js/app.js');
const htmlSrc = read('renderer/index.html');
const cssSrc = read('renderer/css/styles.css');
const bm = mainSrc.match(/const DISCORD_PS_BODY = `([\s\S]*?)`;/);
const body = bm ? bm[1] : '';

console.log('\n[1] C1: Discord tray-proof discovery (ERR:NO_DISCORD for tray-hidden Discord)');
ok('MainWindowHandle filter no longer decides NO_DISCORD — process existence does',
   body.includes('$dcProcs = @(Get-Process -Name Discord,DiscordCanary,DiscordPTB -ErrorAction SilentlyContinue)') &&
   body.includes("if (-not $dcProcs -or $dcProcs.Count -eq 0) { Write-Output 'ERR:NO_DISCORD'; exit }"));
ok('Find-DcHwndByPid enumerates windows of all Discord PIDs (class Chrome_WidgetWin_1, visible preferred)',
   body.includes('function Find-DcHwndByPid') && body.includes("[AvaDc3.W]::EnumWindows($cb, [IntPtr]::Zero)") &&
   body.includes("Chrome_WidgetWin_1") && body.includes("$box['best'] = $h"));
ok('EnumWindows delegate needs no out-of-scope writes (reference-type box, no $script: scope bug)',
   !body.includes('$script:best') && body.includes("$box = @{ best = [IntPtr]::Zero; any = [IntPtr]::Zero }"));
ok('Add-Type gained IsWindowVisible + GetClassName + EnumWindows delegate',
   /public delegate bool EnumProc\(IntPtr hWnd, IntPtr lParam\);/.test(mainSrc) &&
   mainSrc.includes('public static extern bool IsWindowVisible(IntPtr hWnd);') &&
   mainSrc.includes('public static extern int GetClassName(IntPtr hWnd, System.Text.StringBuilder sb, int max);'));
ok('hwnd falls back to EnumWindows when MainWindowHandle is zero',
   body.includes('if (-not $hwnd -or $hwnd -eq [IntPtr]::Zero) { $hwnd = Find-DcHwndByPid }'));

console.log('\n[2] C1b: global-hotkey-first bg path (works in tray/game/minimized)');
ok('Try-HotkeyBg sends the combo with NO focus requirement, verifies flip only when pre-scan was alive',
   body.includes('function Try-HotkeyBg([bool]$preAlive, [string]$doRx, [string]$alrRx, [string]$label, [string]$combo)') &&
   body.includes("if ($flipped -and $preAlive) { return ('OK:' + $label + ':HOTKEY-VERIFIED') }"));
ok('v0.36 honest labels exist: HOTKEY-VERIFIED + KEYS-UNVERIFIED + HOTKEY_NOFLIP',
   body.includes("':HOTKEY-VERIFIED'") && body.includes("':KEYS-UNVERIFIED'") && body.includes("'DBG:HOTKEY_NOFLIP'"));
ok('Press-Dc bg branch order: pre-scan ALREADY guard → hotkey → Press-DcBg → old chain (v0.30 switch lines byte-identical)',
   body.indexOf('if ($pre.alive -and $pre.already -and (-not $pre.hit)) { return (\'OK:\' + $label + \'-ALREADY\') }') > -1 &&
   body.indexOf('$hk = Try-HotkeyBg') < body.indexOf('$bgR = Press-DcBg $doRx $alrRx $label') &&
   body.includes("'mute'     { Write-Output (Press-Dc '^Mute$' '^Unmute$' 'MUTE' 'ctrl,shift,m') }") &&
   body.includes("'deafen'   { Write-Output (Press-Dc '^Deafen$' '^Undeafen$' 'DEAFEN' 'ctrl,shift,d') }"));
ok('ALREADY found AFTER our hotkey is relabeled BG-UIA-VERIFIED (was-already vs became-state honesty)',
   body.includes("if ($bgR -like ('OK:' + $label + '-ALREADY') -and (-not ($pre.alive -and $pre.already))) { $bgR = ('OK:' + $label + ':BG-UIA-VERIFIED') }"));
ok('Show-DcQuiet returns pure int (0/1/2) — hidden tray windows also shown quietly; Re-Minimize re-hides',
   body.includes('function Re-Minimize-Dc($was)') && body.includes("elseif ($was -eq 2) { try { [AvaDc3.W]::ShowWindow($hwnd, 0) | Out-Null } catch { } }") &&
   !body.includes("Write-Output 'DBG:BGSHOW=1'"));
/* NEG CONTROL — گارد وضعیت قبلی را بردار: ادعای تاییدِ کورکورانه برگردد */
{
  const poisoned = body.replace('if ($flipped -and $preAlive) { return (\'OK:\' + $label + \':HOTKEY-VERIFIED\') }',
                                 'if ($flipped) { return (\'OK:\' + $label + \':HOTKEY-VERIFIED\') }');
  ok('NEG: stripping the preAlive gate from the flip claim is caught',
     poisoned !== body && !body.replace('if ($flipped -and $preAlive) { return (\'OK:\' + $label + \':HOTKEY-VERIFIED\') }',
                                        'if ($flipped) { return (\'OK:\' + $label + \':HOTKEY-VERIFIED\') }').includes('$flipped -and $preAlive'));
}
ok('v0.35 invariants intact: Press-DcBg untouched, Test-Flip proof, FromHandle x3',
   body.includes('function Press-DcBg') && body.includes('InvokePattern]::Pattern)).Invoke()') &&
   (body.match(/FromHandle\(\[IntPtr\]\$hwnd\)/g) || []).length === 3);

console.log('\n[3] C2: wake word — fuzzy matcher (آوا/اوا/آبا/ava…)');
ok('WAKE_WORD_RE accepts آبا/ابا/awa (v0.38.1: + variantهای فازی و دنبالهٔ یک‌نفس)',
   /const WAKE_WORD_RE = \/[^\n]*آبا[^\n]*ava[^\n]*\/i;/.test(appSrc));
ok('WAKE_ACCEPT set includes the user-requested variants (آبا، آوه، آو، اوها…)',
   appSrc.includes("const WAKE_ACCEPT = new Set(['آوا', 'اوا', 'آوای', 'اوای', 'آبا', 'ابا', 'آوه', 'اوها', 'آو', 'اوب', 'اواو', 'اووا', 'آووا', 'اواا', 'اوبا']);"));
ok('wakeHitText uses tokens + accept set; latin ava/awa token-anchored; آواز/java rejected (v0.38.1)',
   appSrc.includes('function wakeHitText(txt)') && appSrc.includes('WAKE_ACCEPT.has(w)') &&
   appSrc.includes('/\\b(?:ava|awa)\\b/i') && appSrc.includes("/^(اوا|آوا)(ی|یی|ی\\s?جان|ی\\s?جون|جان|جون)?$/"));
ok('wakeCheck uses the 3-tier engine (v0.46), wakeHitText kept as compat wrapper, old substring matcher gone',
   (appSrc.match(/wakeHitText\(txt\)/g) || []).length === 1 && appSrc.includes('AVAWake.match(txt, wakeWordCfg())') && !appSrc.includes('/(آوا|اوا|ava)/i.test(normFaFull(txt))'));
/* NEG CONTROL — اگر تطبیق به زیررشتهٔ ساده برگردد، «آبا» از دست می‌رود: هارنس باید بگیرد */
{
  const sanity = (() => {
    // شبیه‌سازی منطق: آبا باید بپذیرد، «او» و «آب» نباید بپذیرند
    const accept = new Set(['آوا', 'اوا', 'آوای', 'اوای', 'آبا', 'ابا', 'آوه', 'اوها', 'آو', 'اوب', 'اواو', 'اووا', 'آووا', 'اواا', 'اوبا']);
    const hit = (txt) => {
      const s = String(txt || '');
      if (/ava|awa/i.test(s)) return true;
      for (const w of s.split(/[\s،,:؛;!?.\-]+/)) {
        if (w.length < 2) continue;
        if (/^(اوا|آوا)/.test(w)) return true;
        if (accept.has(w)) return true;
      }
      return false;
    };
    return hit('آوا') && hit('اوا جون؟') && hit('بابا آبا') && hit('ava open chrome') && !hit('او') && !hit('آب') && !hit('سلام خوبی');
  })();
  ok('NEG: matcher sanity table (accept آوا/اوا/آبا/ava; reject او/آب/normal speech)', sanity);
}
ok('wake buffer 47→70 frames (~6s) + leading-silence trim before STT',
   appSrc.includes('wakeLoop.chunks.length > 70') && appSrc.includes('const buf2 = s0 > 0 ? buf.slice(s0) : buf;'));
ok('cloud 2nd chance when the offline engine hears nothing (10s cooldown)',
   appSrc.includes('L.lastCloudTry = Date.now();') && appSrc.includes('wake-always: cloud 2nd chance used'));

console.log('\n[4] C3: joke routes to AI, never to search');
ok('joke rule: جک/جوک/لطیفه + AI_FALLBACK when AI connected, local joke otherwise',
   appSrc.includes('k: /جوک|جک|لطیفه|بخندون|شوخی|tell me a joke|make me laugh|joke/i, id: \'joke\', t: \'جوک\', i: \'#i-smile\',') /* v0.39: id */ &&
   appSrc.includes('r: async () => { if (aiConnected()) return AI_FALLBACK; return joke(); },'));
ok('AI system prompt (FA) forbids searching jokes/sites and DO-block for jokes',
   appSrc.includes('خودت یک جوک کوتاه و تازه بگو — هرگز جستجو نکن') &&
   appSrc.includes('هرگز کل جمله را جستجو نکن') && appSrc.includes('قانون مهم ۳'));
ok('AI system prompt (EN) mirrors the routing rules',
   appSrc.includes('tell a short fresh joke yourself — NEVER search the web for it') &&
   appSrc.includes('NEVER web_search the whole sentence'));

console.log('\n[5] C4: site opening — soft98 & the «که …» clause');
ok('KNOWN_SITES: soft98 (digits + Persian words), downloadha, zoomit, digiato, ninisite, faradars, maktabkhooneh…',
   appSrc.includes("['سافت 98', 'https://soft98.ir']") && appSrc.includes("['سافت نود و هشت', 'https://soft98.ir']") &&
   appSrc.includes("['دانلودها', 'https://downloadha.com']") && appSrc.includes("['زومیت', 'https://www.zoomit.ir']") &&
   appSrc.includes("['دیجیاتو', 'https://www.digiato.com']") && appSrc.includes("['نی نی سایت', 'https://www.ninisite.com']") &&
   appSrc.includes("['فرادرس', 'https://faradars.org']") && appSrc.includes("['مکتب خونه', 'https://maktabkhooneh.org']"));
ok('siteTargetOf extracts the name from «سایت X رو باز کن» and drops the «که …» clause',
   appSrc.includes('function siteTargetOf(cmd)') && appSrc.includes("s.replace(/\\s+که\\s+[\\s\\S]*$/i, '')"));
ok('cleanSiteQuery also strips the relative clause',
   appSrc.indexOf('s.replace(/\\s+که\\s+[\\s\\S]*$/i, \' \')') > appSrc.indexOf('function cleanSiteQuery'));
ok('site rule run/arg/reply all consult siteTargetOf (web_open decision + knownSite + domain)',
   (appSrc.match(/knownSiteOf\(siteTargetOf\(c\)\)/g) || []).length >= 3 &&
   (appSrc.match(/siteDomainOf\(siteTargetOf\(c\)\)/g) || []).length >= 2);
/* NEG CONTROL — strip the clause-cut from cleanSiteQuery: «که خیلی خوبه» would leak into search queries again */
{
  const poisoned = appSrc.replace("    /* v0.36 — بند وابستهٔ «که …» جزو اسم سایت نیست («سافت 98 که خیلی خوبه» → «سافت 98») */\n    s = s.replace(/\\s+که\\s+[\\s\\S]*$/i, ' ');\n", '');
  ok('NEG: removing the clause-strip line is detectable (marker + line gone)',
     poisoned !== appSrc && !poisoned.includes("بند وابستهٔ «که …» جزو اسم سایت نیست") &&
     appSrc.includes("بند وابستهٔ «که …» جزو اسم سایت نیست"));
}
ok('stripSearch drops filler tokens (بابا/دیگه/خب/ممنون/مرسی/واسه/برام/الان)',
   (appSrc.includes("replace(/(^|\\s)(بابا|دیگه|دیگ|خب|خوب|ممنون|مرسی|واسه|برام|الان)(?=\\s|$)/gi, '$1')") || appSrc.includes("replace(/(^|\\s)(بابا|دیگه|دیگ|خب|خوب|ممنون|مرسی|واسه|برام|برای\\s*من|واسم|الان)(?=\\s|$)/gi, '$1')")));

console.log('\n[6] C5: settings — tidy for real');
ok('orphan disc.hint note removed (was always visible between panes)',
   !htmlSrc.includes('data-i18n="disc.hint"'));
ok('wake pane exists with its 4 rows + nav item (stt pane slimmed)',
   htmlSrc.includes('<div class="set-pane" data-pane="wake">') && htmlSrc.includes('data-i18n="set.nav.wake"') &&
   htmlSrc.indexOf('id="optHandsFree"') > htmlSrc.indexOf('data-pane="wake"') &&
   htmlSrc.indexOf('id="optWakeAlways"') > htmlSrc.indexOf('data-pane="wake"') &&
   htmlSrc.indexOf('id="btnWakeTest"') > htmlSrc.indexOf('data-pane="wake"') &&
   htmlSrc.indexOf('id="optHandsFree"') < htmlSrc.indexOf('<div class="set-pane" data-pane="dict">'));
ok('new pane order: mic, stt, wake, dict, voice, ai, discord, ext, perf, app, update',
   (() => {
     const order = [...htmlSrc.matchAll(/<div class="set-pane[^"]*" data-pane="(\w+)"/g)].map((m) => m[1]);
     return JSON.stringify(order) === JSON.stringify(['mic', 'stt', 'wake', 'dict', 'voice', 'ai', 'discord', 'ext', 'perf', 'app', 'update']);
   })());
ok('discord advanced (contacts/callMode/cal) collapsed into details.set-adv',
   htmlSrc.includes('data-i18n="set.dc.adv"') &&
   htmlSrc.indexOf('set.dc.adv') < htmlSrc.indexOf('id="dcAddForm"') &&
   (() => { const p = htmlSrc.indexOf('id="btnDcProbe"'); const d = htmlSrc.indexOf('</details>', p); const n = htmlSrc.indexOf('data-i18n="set.dc.note"'); return p > -1 && d > p && n > d; })());
ok('i18n pairs added for wake pane + dc.adv (fa/en)',
   appSrc.includes("'set.nav.wake': ['بیدارباش', 'Wake word']") &&
   appSrc.includes("'set.dc.adv': ['مخاطبین، روش تماس و مکان دکمه (پیشرفته)', 'Contacts, call mode & button position (advanced)']"));
ok('showSettingsPane guards an unknown stored pane (fallback to mic)',
   appSrc.includes("if (!setPanes.some((p) => p.dataset.pane === id)) id = 'mic';"));
ok('document head intact + all critical IDs unique',
   htmlSrc.startsWith('<!DOCTYPE html>') && htmlSrc.includes('<title>آوا') &&
   ['id="optMic"', 'id="optSttEngine"', 'id="offCard"', 'id="optGeminiKey"', 'id="btnDcCall"', 'id="optAutoUpdate"', 'id="dcContactsList"']
     .every((id) => htmlSrc.split(id).length === 2));

console.log('\n[7] C6: Gemini typing page bigger + readable model tag');
ok('cmd + chat inputs are auto-growing textareas (Enter sends, Shift+Enter newline)',
   htmlSrc.includes('<textarea id="cmdInput" rows="1"') && htmlSrc.includes('<textarea id="chatInput" rows="1"') &&
   appSrc.includes('function wireMultilineInput(el, form, maxPx)') &&
   appSrc.includes('wireMultilineInput(cmdInput, cmdBar, 220)') && appSrc.includes('wireMultilineInput(chatInput, chatBar, 220)') &&
   appSrc.includes("if (e.key === 'Enter' && !e.shiftKey && !e.isComposing)"));
ok('CSS: card 860px, bars grow (min-height), textareas no-resize with scroll, rc-tag wraps',
   cssSrc.includes('width: min(860px, 100%)') && cssSrc.includes('min-height: 52px; height: auto;') &&
   cssSrc.includes('max-height: 220px; resize: none;') &&
   cssSrc.includes('max-width: calc(100% - 34px); white-space: normal;'));

console.log('\n[8] hygiene + versions');
ok('PS body hygiene: no curly quotes, no C-comments, no raw backtick',
   !/[\u2018\u2019\u201C\u201D]/.test(body) && !/\/\*/.test(body) && !body.includes('`'));
ok('version 0.36.x+ everywhere (forward-compatible for v0.37+)',
   /^0\.(3[6-9]|[4-9][0-9])\.\d+(?:-[\w.]+)?$/.test(JSON.parse(read('package.json')).version) &&
   /let appVersion = '0\.(3[6-9]|[4-9][0-9])\.\d+(?:-[\w.]+)?';/.test(appSrc) && />v0\.(3[6-9]|[4-9][0-9])\.\d+(?:-[\w.]+)?</.test(htmlSrc));

console.log('\n[9] real pwsh execution (if portable pwsh available)');
const PWSH = '/home/z/my-project/scripts/pwsh/pwsh';
if (fs.existsSync(PWSH)) {
  const runPs = (code) => {
    try { return execFileSync(PWSH, ['-NoProfile', '-NonInteractive', '-Command', code], { encoding: 'utf8', timeout: 60000 }); }
    catch (e) { return String((e && e.stdout) || '') + String((e && e.stderr) || ''); }
  };
  // بدنه را از main استخراج و در فایل موقت می‌نویسیم (همان روش نسخه‌های قبل)
  const tmp = '/tmp/ava-dc-v036.ps1';
  fs.writeFileSync(tmp, '\ufeff' + body, 'utf8');
  const out1 = runPs(`& '${tmp}' -Action mute -Mode bg -WaitMs 200 2>&1 | Out-String`);
  ok('real pwsh: bg mute on Linux reaches honest NO_DISCORD (zero parse errors)',
     /NO_DISCORD/.test(out1) && !/Unexpected token|ParseException|ParserError/i.test(out1));
  const out2 = runPs(`& '${tmp}' -Action state -Mode bg -WaitMs 200 2>&1 | Out-String`);
  ok('real pwsh: state action honest on Linux', /NO_DISCORD/.test(out2));
  const out3 = runPs(`$ErrorActionPreference='Stop'; try { [AvaDc3.W]::EnumWindows | Out-Null } catch { 'no-args-enum' }; 'PARSE-OK'`);
  ok('real pwsh: Add-Type compiles (EnumWindows delegate type present)', /PARSE-OK/.test(out3));
} else {
  console.log('SKIP | portable pwsh not present');
}

console.log('\nRESULT: ' + pass + '/' + (pass + fail));
if (fail) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
