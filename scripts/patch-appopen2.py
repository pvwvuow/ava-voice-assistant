# -*- coding: utf-8 -*-
"""حذف شاخه «و باز/اجرا» از extractAppName — حرف آخر کلمه‌هایی مثل «رو» را نمی‌خورد"""
import io, sys
P = '/home/z/my-project/download/ava-voice-assistant/renderer/js/app.js'
src = io.open(P, encoding='utf-8').read()
old = r"(و\s*(باز|اجرا)\s*(شو|شه|کن)(?=\s|$|،|\.|!|؟))|(باز\s*(کن|بکن|شو|شه|کردن)?(?=\s|$|،|\.|!|؟))"
new = r"(باز\s*(کن|بکن|شو|شه|کردن)?(?=\s|$|،|\.|!|؟))"
if src.count(old) != 1:
    print('COUNT=', src.count(old)); sys.exit(1)
io.open(P, 'w', encoding='utf-8').write(src.replace(old, new))
print('PATCH2_DONE')
