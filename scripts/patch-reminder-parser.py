# -*- coding: utf-8 -*-
"""پچ parseReminder در app.js — فیکس «یک ساعت و نیم» + متن پاک‌شده"""
import io, re, sys

P = '/home/z/my-project/download/ava-voice-assistant/renderer/js/app.js'
src = io.open(P, encoding='utf-8').read()

def sub_once(old, new, label):
    global src
    if old not in src:
        print('MISS |', label)
        sys.exit(1)
    if src.count(old) != 1:
        print('AMBIGUOUS |', label, 'count=', src.count(old))
        sys.exit(1)
    src = src.replace(old, new)
    print('OK   |', label)

# ۱) stripTime: «دیگ» → «دیگه» (حرف اضافه باقی نمی‌ماند)
sub_once(
    r"      .replace(/(و\s*)?(نیم|ربع)\s*(دیگ|دیگر|بعد|دیگاه)?/gi, ' ')",
    r"      .replace(/(و\s*)?(نیم|ربع)\s*(دیگه|دیگر|بعد)?/gi, ' ')",
    'stripTime نیم/ربع',
)
sub_once(
    r"      .replace(/(\d+|[ا-ی\u200C\s]{2,22}?)\s*(ساعت|دقیقه|ثانیه)\s*(دیگ|دیگر|بعد|دیگاه)?/gi, ' ')",
    r"      .replace(/(\d+|[ا-ی\u200C\s]{2,22}?)\s*(ساعت|دقیقه|ثانیه)\s*(دیگه|دیگر|بعد)?/gi, ' ')",
    'stripTime duration',
)

# ۲) ساعت مطلق: اسپن دقیق زمان مچ شود تا متن یادآوری حذف نشود
sub_once(
    r"""    /* ۱) ساعت مطلق: «ساعت ۵ عصر» / «ساعت هشت و نیم صبح» / «ساعت ۲۲» */
    const abs = txt.match(/ساعت\s+([^،.؟!]{1,24})/i);
    if (abs) {
      const seg = abs[1];
      let h = faWordNum(seg.split(/\s/)[0]);
      if (h === null) { const m2 = seg.match(/\d+/); h = m2 ? Number(m2[0]) : null; }
      if (h !== null && h >= 0 && h <= 23) {""",
    r"""    /* ۱) ساعت مطلق: «ساعت ۵ عصر» / «ساعت هشت و نیم صبح» / «ساعت ۲۲» / «ساعت ۱۰ و ربع»
       فاصله زمانی دقیق مچ می‌شود تا متن یادآوری همراهش پاک نشود */
    const abs = txt.match(/ساعت\s+(?:[\d۰-۹]+|[ا-ی\u200C]+)(?:\s*و\s*(?:نیم|ربع|[\d۰-۹]+\s*دقیقه|[ا-ی\u200C]+\s*دقیقه))?(?:\s*(?:صبح|ظهر|عصر|شب))?/i);
    if (abs) {
      const seg = abs[0].replace(/^\s*ساعت\s+/i, '');
      const numM = seg.match(/[\d۰-۹]+|[ا-ی\u200C]+/);
      let h = numM ? (/^\d/.test(numM[0]) ? Number(faToEn(numM[0])) : faWordNum(numM[0])) : null;
      if (h !== null && h >= 0 && h <= 23) {""",
    'abs time span',
)

# ۳) حذف base بی‌استفاده + بازگردانی « » به‌جای '' در replace متن (دو جا)
sub_once("          const base = new Date(now);\n", "", 'remove unused base')
src = src.replace("stripTime(txt.replace(abs[0], ''))", "stripTime(txt.replace(abs[0], ' '))")
print('OK   |', 'abs text replace spacing')

# ۴) مدت: پشتیبانی «X ساعت و نیم/ربع»
sub_once(
    r"    /* ۲) مدت: «۲۰ دقیقه دیگه» / «یک ساعت و نیم بعد» / «نیم ساعت دیگه» */"
    "\n"
    r"    const half = /نیم\s*ساعت/.test(txt);"
    "\n"
    r"    const dur = txt.match(/([\d۰-۹]+|[ا-ی\u200C\s]{2,20}?)\s*(ثانیه|دقیقه|ساعت)\s*(دیگ|دیگر|بعد)/i);",
    r"    /* ۲) مدت: «۲۰ دقیقه دیگه» / «یک ساعت و نیم بعد» / «نیم ساعت دیگه» */"
    "\n"
    r"    const half = /نیم\s*ساعت/.test(txt);"
    "\n"
    r"    const dur = txt.match(/([\d۰-۹]+|[ا-ی\u200C\s]{2,20}?)\s*(ثانیه|دقیقه|ساعت)(?:\s*و\s*(نیم|ربع))?\s*(دیگه|دیگر|بعد)/i);",
    'dur regex + و نیم',
)

# ۵) محاسبه ms با جزء نیم/ربع
sub_once(
    r"""      if (n !== null) {
        let ms = 0;
        if (/ثانیه/.test(dur[2])) ms = n * 1000;
        else if (/دقیقه/.test(dur[2])) ms = n * 60000;
        else ms = n * 3600000;
        if (half) ms = 30 * 60000;
        ms = Math.max(5000, Math.min(ms, 30 * 24 * 3600000));
        const text = stripTime(txt) || 'یادآوری';
        return { at: Date.now() + ms, text };
      }""",
    r"""      if (n !== null) {
        let ms = 0;
        if (/ثانیه/.test(dur[2])) ms = n * 1000;
        else if (/دقیقه/.test(dur[2])) ms = n * 60000;
        else ms = n * 3600000;
        /* جزء «و نیم/و ربع»: یک ساعت و نیم = ۹۰ دقیقه، یک دقیقه و نیم = ۹۰ ثانیه */
        if (dur[3] === 'نیم') ms += (/دقیقه/.test(dur[2]) ? 30000 : 1800000);
        else if (dur[3] === 'ربع') ms += (/دقیقه/.test(dur[2]) ? 15000 : 900000);
        if (half) ms = 30 * 60000;
        ms = Math.max(5000, Math.min(ms, 30 * 24 * 3600000));
        const text = stripTime(txt) || 'یادآوری';
        return { at: Date.now() + ms, text };
      }""",
    'ms + نیم/ربع جزء',
)

io.open(P, 'w', encoding='utf-8').write(src)
print('PATCH_DONE')
