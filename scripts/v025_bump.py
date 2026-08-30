# -*- coding: utf-8 -*-
"""v0.25 bump — index.html about text/version + package.json version/description."""
import io, json, sys

ROOT = '/home/z/my-project/download/ava-voice-assistant'

# --- index.html ---
HP = ROOT + '/renderer/index.html'
html = io.open(HP, encoding='utf-8').read()
if '>v0.24.0<' not in html:
    print('FAIL: abVersion v0.24.0 not found'); sys.exit(1)
html = html.replace('>v0.24.0<', '>v0.25.0<', 1)

import re
m = re.search(r'(<p class="about-desc" data-i18n="about-desc">)[^<]*(</p>)', html) if 'about-desc"' in html else None
# the actual element uses data-i18n="about.desc"
m2 = re.search(r'<p class="about-desc" data-i18n="about\.desc">[^<]*</p>', html)
NEW_DESC = '<p class="about-desc" data-i18n="about.desc">نسخه ۰.۲۵ — بازسازی کامل مکالمهٔ صوتی (AVE3): هر جلسهٔ گوش‌دادن دو مسیر موازی دارد — شنوندهٔ زندهٔ وب (همان که در کروم عالی بود) + ضبط PCM از لحظهٔ صفر با VAD تطبیقی؛ اگر موتور وب بمیرد دیگر «دوباره گوش نمی‌دهیم» و همان صدای ضبط‌شده بی‌درنگ به مسابقهٔ موازی ابری (گوگل/Whisper/GLM/Gemini با سقف ۱۲ ثانیه) می‌رود — کاربر هرگز چیزی را تکرار نمی‌کند؛ پایان جمله با سکوت واقعی (VAD) و teardown تمیز جلسه با شمارش نسل.</p>'
if not m2:
    print('FAIL: about-desc element not found'); sys.exit(1)
html = html.replace(m2.group(0), NEW_DESC, 1)
io.open(HP, 'w', encoding='utf-8').write(html)
print('index.html OK')

# --- package.json ---
PJ = ROOT + '/package.json'
pkg = json.load(io.open(PJ, encoding='utf-8'))
pkg['version'] = '0.25.0'
pkg['description'] = ('آوا — دستیار صوتی ویندوز | نسخه ۰.۲۵: بازسازی کامل مکالمهٔ صوتی (AVE3) — '
                      'دو مسیر موازی (وب زنده + بافر PCM با VAD تطبیقی)، حذف کامل «گوش دادن دوباره»، '
                      'مسابقهٔ ابری روی همان صدا با سقف ۱۲ ثانیه، teardown تمیز با شمارش نسل')
io.open(PJ, 'w', encoding='utf-8').write(json.dumps(pkg, ensure_ascii=False, indent=2) + '\n')
print('package.json OK (v0.25.0)')
