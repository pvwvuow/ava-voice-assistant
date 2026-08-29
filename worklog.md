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

---
Task ID: 4
Agent: main (Super Z)
Task: پنجره یک‌سوم صفحه + اتصال پروژه به گیت‌هاب (درخواست کاربر)

Work Log:
- main.js: پنجره جدید = یک‌سوم عرض workArea (کلمپ ۴۰۰-۶۸۰)، ارتفاع ۹۲٪ (کلمپ ۵۴۰-۷۸۰)، موقعیت لبه راست دسکتاپ با فاصله ۲۴px
- styles.css: دو مدیاکوئری جدید (≤680px: اورب ۱۱۶px، chipها فشرده، about/toasts جابجا؛ ≤460px: مخفی‌کردن badge و CPU/RAM)
- رفع انیمیشن toastIn (translateX → translateY) که در RTL لحظه‌ای در لبه چپ کلیپ می‌شد
- .github/workflows/build.yml: ساخت خودکار EXE روی تگ v* با windows-latest + انتشار در Releases + artifact
- LICENSE (MIT) + بخش «انتشار روی گیت‌هاب» در README
- git init -b main + دو commit (۱۸ فایل)
- تست مرورگری 640x780: چیدمان کامل بدون اسکرول، کارت پاسخ و توست‌ها سالم

Stage Summary:
- پنجره پیش‌فرض حالا پنل دستیار یک‌سوم صفحه سمت راست است
- ریپو آماده پوش: کاربر فقط remote اضافه می‌کند + push + tag v0.2.0 → EXE خودکار در Releases

---
Task ID: 4
Agent: main (Super Z)
Task: رفع ارور electron-builder در GitHub Actions + اسکریپت پوش خودکار پاورشل + تکمیل پنجره یک‌سوم (v0.3.0)

Work Log:
- علت ارور CI تشخیص داده شد: تگ v0.2.0 باعث حالت publish در electron-builder می‌شد ولی فیلد repository در package.json نبود (Cannot detect repository by .git/config) + GH_TOKEN در ورک‌فلو ست نشده بود
- package.json: version 0.3.0 + فیلد repository (placeholder؛ push.ps1 و CI خودش از روی remote درستش می‌کنند) + build.publish: github + artifactName: AVA-Setup-${version}.exe
- push.ps1 ساخته شد (فقط ASCII برای سازگاری Windows PowerShell 5.1): تشخیص خودکار remote و تزریق repository، سینک .gitignore و workflow به ریشه ریپو، git rm --cached برای node_modules/dist، کامیت با پیام پیش‌فرض زمانی، pull --rebase، push، و با -Release تگ‌زدن نسخه از package.json و پوش تگ
- push.cmd ساخته شد (wrapper با ExecutionPolicy Bypass برای اجرای بدون دردسر)
- .github/workflows/build.yml ساخته شد: windows-latest، trigger روی تگ v* و workflow_dispatch، permissions: contents:write، GH_TOKEN=secrets.GITHUB_TOKEN، مرحله «Fix repository field» با GITHUB_REPOSITORY (تضمین: ارور قبلی هرگز تکرار نمی‌شود)، working-directory: download/ava-voice-assistant، آپلود artifact در اجرای دستی
- .gitignore ساخته شد
- README: بخش انتشار جدید (فقط یک دستور)، به‌روزرسانی نسخه ۰.۳، درخت پروژه
- index.html: نسخه ۰.۳ در badge/statusbar/about
- کشف شد پنجره یک‌سوم (main.js) و CSS واکنش‌گرایش از قبل انجام شده بود؛ باگ ظریف رفع شد: tb-title به‌جای display:none حالا visibility:hidden تا دکمه‌های پنجره به لبه چپ بچسبند
- sync به public/ava (index.html + styles.css)
- تست agent-browser: 640x780 بدون overflow، دکمه‌ها در x=0، کارت پاسخ «وضعیت سیستم» سالم، حداقل سایز 380x540 بدون overflow — همه ✓

Stage Summary:
- کاربر از این به بعد فقط: .\push.cmd "پیام" → پوش خودکار | .\push.cmd "پیام" -Release → تگ + بیلد CI + EXE در GitHub Releases
- ارور Cannot detect repository در سه لایه حل شد: repository در package.json + تزریق خودکار در push.ps1 + مرحله fix در workflow
- نسخه 0.3.0 آماده انتشار؛ کاربر باید فایل‌ها را روی سیستم ویندوزی‌اش کپی و push.cmd را اجرا کند
