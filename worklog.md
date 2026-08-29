# Worklog

---
Task ID: 1
Agent: main (Super Z)
Task: ساخت اولیه نرم‌افزار «آوا» — دستیار صوتی ویندوز با Electron (UI + دمو)

Work Log:
- ساخت ساختار پروژه Electron در download/ava-voice-assistant/
- طراحی UI سه‌فایلی (index.html, styles.css, app.js) با تم Liquid Glass زمردی و RTL کامل

Stage Summary:
- نسخه ۰.۱ فقط رابط کاربری با شبیه‌سازی دمو

---
Task ID: 2
Agent: main (Super Z)
Task: رفع باگ‌های گزارش‌شده کاربر و بازطراحی کامل UI

Work Log:
- رفع باگ pointer-events روی حلقه‌های اورب
- بازطراحی: پنل کناری، لاگ فعالیت، مانیتور سیستم، نوار وضعیت
- شروع تشخیص گفتار مرورگر با فالبک دمو

Stage Summary:
- UI کامل بازطراحی شد؛ کاربر درخواست فرمان‌های بیشتر و کارکرد واقعی کرد

---
Task ID: 3
Agent: main (Super Z)
Task: نسخه ۰.۲ — فرمان‌های جدید + اجرای واقعی فرمان‌های ویندوز + مجوز میکروفون

Work Log:
- main.js: افزودن setupMicPermission (setPermissionRequestHandler/CheckHandler برای media)
- main.js: افزودن اجراکننده امن sys:run با فهرست سفید COMMANDS (۱۸ شناسه: باز کردن کروم/نت‌پد/ماشین‌حساب/اکسپلورر/VS Code/تسک‌منیجر/تنظیمات/پینت، یوتیوب/یوتیوب‌موزیک، web_open/web_search، minimize_all، lock، screenshot با PowerShell CopyFromScreen، vol_up/vol_down/vol_mute با keybd_event)
- preload.js: expose شدن ava.system.run(id, arg)
- app.js: بازنویسی — +۲۵ قانون فرمان با پشتیبانی ZWNJ (\u200C)، تشخیص گفتار واقعی fa-IR با فالبک دمو، تایمر واقعی با توست+بوق WebAudio، باتری واقعی (getBattery)، جوک‌ها، تگ کارت پاسخ (پاسخ آوا/اجرا شد/شبیه‌سازی دمو)، لیبل موتور در نوار وضعیت
- index.html: ۹ آیکون SVG جدید + ۱۰ chip فرمان + به‌روزرسانی نسخه ۰.۲ و متن درباره
- package.json: version 0.2.0
- README.md: جدول فرمان‌های پشتیبانی‌شده + مستند sys:run
- رفع ۳ باگ یافت‌شده در تست: regex نیم‌فاصله (ماشین‌حساب/نت‌پد/تسک‌منیجر/آب‌وهوا)، ترتیب قوانین صدا (بی‌صدا قبل از بلندتر)، استخراج عبارت جستجو (حرف «ی» اضافه)
- تست مرورگری با agent-browser: ۹ فرمان اجرا و تأیید شد؛ تایمر ۵ ثانیه‌ای → توست «زمان تایمر تمام شد!» ✅
- Sync کامل به public/ava (diff تأیید شد)

Stage Summary:
- نسخه ۰.۲ آماده: تشخیص گفتار واقعی + اجرای واقعی فرمان‌ها در Electron ویندوز
- بسته‌بندی نصب‌کننده: npm install && npm run dist → EXE نصب‌کننده NSIS
- پیش‌نمایش: http://localhost:3000/ava/index.html
