# Worklog

---
Task ID: 1
Agent: Main Agent (Super Z)
Task: ساخت رابط کاربری نرم‌افزار Electron «آوا» — دستیار صوتی ویندوز (فقط UI)

Work Log:
- از کاربر ۸ سؤال شفط‌سازی پرسیده شد: فارسی RTL، تم تیره، سبک Fluent شیشه‌ای، رنگ زمردی، بخش اورب صوتی، سایدبار آیکونی، تایتل‌بار Frameless، نام «آوا» + رفرنس liquid-glass-vue
- محیط fullstack (Next.js 16) با اسکریپت init راه‌اندازی شد (پورت ۳۰۰۰، dev خودکار)
- رفرنس liquid-glass-vue بررسی شد (تکنیک backdrop-filter blur + بوردر نیمه‌شفاف) و به Liquid Glass کامل ارتقا داده شد (inset specular highlights، هسته مایع متحرک، نویز، blobهای پس‌زمینه)
- فونت وزیرمتن (۵ وزن woff2) از jsdelivr دانلود و باندل شد
- آیکون برنامه (PNG ۵۱۲ + ICO + favicon) با اسکریپت PIL در scripts/make_icon.py ساخته شد
- پروژه Electron کامل در download/ava-voice-assistant ساخته شد: package.json (با کانفیگ electron-builder NSIS)، main.js (پنجره Frameless، IPC کنترل پنجره، sys:stats واقعی، میانبر سراسری Ctrl+Shift+Space)، preload.js (contextBridge با API ی window.ava)
- UI کامل پیاده‌سازی شد: index.html (RTL، آیکون‌های SVG داخلی)، css/styles.css (~۵۷۰ خط، سیستم Liquid Glass)، js/app.js (ماشین حالت idle/listening/processing/success، ویژوالایزر Canvas، دموی فرمان‌ها، توست، پاپ‌آپ درباره، ساعت fa-IR، آمار واقعی/شبیه‌سازی)
- تست با agent-browser: حالت idle، listening (اورب→stop، موج انرژی)، کارت پاسخ (جایگزینی موج/کارت برای رفع سرریز عمودی)، فرمان تایپی «ساعت چنده؟»، پاپ‌آپ درباره، سایز مینیمم ۹۴۰×۶۲۰ — همه سالم
- رفع باگ: سرریز عمودی کارت پاسخ → الگوی تعویض has-card (موج جمع می‌شود کارت باز می‌شود)
- رفع لینت: ignores برای download/** و public/** در eslint.config.mjs
- پیش‌نمایش: renderer در public/ava کپی شد و src/app/page.tsx به /ava/index.html ریدایرکت می‌کند

Stage Summary:
- خروجی اصلی: /home/z/my-project/download/ava-voice-assistant (پروژه کامل Electron قابل اجرا با npm install && npm start)
- پیش‌نمایش وب: روت «/» → public/ava/index.html (شبیه‌سازی دمو بدون Electron)
- تصمیم‌های کلیدی: RTL کامل شامل آینه‌شدن دکمه‌های پنجره (چپ)، فونت باندل‌شده آفلاین، آمار CPU/RAM واقعی در Electron و شبیه‌سازی در مرورگر، نقاط اتصال موتور صوتی در README مستند شد
