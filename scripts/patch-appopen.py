# -*- coding: utf-8 -*-
"""پچ extractAppName و matchSysApp — حذف \b فارسی‌ناپسند + فازی داخل دیکشنری"""
import io, sys

P = '/home/z/my-project/download/ava-voice-assistant/renderer/js/app.js'
src = io.open(P, encoding='utf-8').read()

def sub_once(old, new, label):
    global src
    if old not in src:
        print('MISS |', label); sys.exit(1)
    if src.count(old) != 1:
        print('AMBIGUOUS |', label, 'count=', src.count(old)); sys.exit(1)
    src = src.replace(old, new)
    print('OK   |', label)

# ۱) extractAppName: \b با حروف فارسی کار نمی‌کند → lookahead فارسی‌سازگار
sub_once(
    r"      .replace(/(و\s*(باز|اجرا)\s*(شو|شه|کن)\b)|(باز\s*(کن|بکن|شو|شه|کردن)?\b)|(اجرا\s*(کن|بکن|بده|شه|کردن)?\b)|(بیار\s*(بالا|روی|شکم)?)|(بذار\s*(باز|اجرا|بشه)\b)|(لانچ\s*(کن)?\b)|(بشین\s*(رو|روی)\b)|(run\b)|(open\b)|(launch\b)|(start\b)/gi, ' ')",
    r"      .replace(/(و\s*(باز|اجرا)\s*(شو|شه|کن)(?=\s|$|،|\.|!|؟))|(باز\s*(کن|بکن|شو|شه|کردن)?(?=\s|$|،|\.|!|؟))|(اجرا\s*(کن|بکن|بده|شه|کردن)?(?=\s|$|،|\.|!|؟))|(بیار\s*(بالا|روی|شکم)?(?=\s|$|،|\.|!|؟))|(بذار\s*(باز|اجرا|بشه)(?=\s|$|،|\.|!|؟))|(لانچ\s*(کن)?(?=\s|$|،|\.|!|؟))|(بشین\s*(رو|روی)(?=\s|$|،|\.|!|؟))|\b(run|open|launch|start)\b/gi, ' ')",
    'extract verbs without \\b',
)

# ۲) matchSysApp: فازی داخل دیکشنری فونتیک (تلفظ‌های نزدیک مثل «تلگرم»)
sub_once(
    r"""    let phon = APP_PHONETIC[q] || null;
    if (!phon) {
      for (const [fa, en] of Object.entries(APP_PHONETIC)) {
        const nfa = normApp(fa);
        if ((q.includes(nfa) && nfa.length >= 3) || (nfa.includes(q) && q.length >= 3)) { phon = en; break; }
      }
    }""",
    r"""    let phon = APP_PHONETIC[q] || null;
    if (!phon) {
      /* اول شامل‌شدن، بعد فازی داخل خود دیکشنری — «تلگرم» هم به telegram می‌رسد */
      let bestFa = null, bestScore = 0;
      for (const [fa, en] of Object.entries(APP_PHONETIC)) {
        const nfa = normApp(fa);
        if ((q.includes(nfa) && nfa.length >= 3) || (nfa.includes(q) && q.length >= 3)) { bestFa = en; break; }
        const sc = simRatio(nfa, q);
        if (sc > bestScore) { bestScore = sc; bestFa = en; }
      }
      if (bestFa && bestScore >= 0.72) phon = bestFa;
    }""",
    'phonetic fuzzy inside dict',
)

io.open(P, 'w', encoding='utf-8').write(src)
print('PATCH_DONE')
