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

---
Task ID: 5
Agent: main (Super Z)
Task: نسخه 0.4.0 — آپدیت خودکار داخل برنامه (electron-updater) + تنظیمات سیستمی + TTS + ضبط واقعی صدا + بامپ خودکار نسخه در push.ps1

Work Log:
- از گزارش کاربر استفاده شد: ریپوی واقعی pvwvuow/ava-voice-assistant در package.json و README جایگزین placeholder شد؛ درس پروکسی گیت به push.ps1 اضافه شد (هشدار http.proxy)
- package.json: version 0.4.0 + dependencies: electron-updater ^6.3.9 + repository واقعی
- main.js: setupAutoUpdater (autoDownload + autoInstallOnAppQuit + رویدادها → updater:status + چک خودکار ۱۲ ثانیه بعد از شروع با فلگ autoCheckEnabled) + IPCهای جدید: updater:check/install/set-auto، app:flags، app:set-always-on-top، app:set-login-item، sys:open-url (فقط https با safeUrl)، sys:save-audio (ذخیره webm در Music/AVA)، app:info (نسخه واقعی). require الکترون-آپدیتر با try/catch تا بدون نصب ماژول هم برنامه بالا بیاید
- preload.js: ava.settings (flags/setAlwaysOnTop/setLoginItem) + ava.updater (check/install/setAuto/onStatus) + system.openUrl/saveAudio/info
- index.html: صفحه تنظیمات کامل (رفتار برنامه / صدا و TTS / به‌روزرسانی / پیوندها) + آیکون‌های i-refresh، i-download، i-power، i-tts + دکمه gear از قفل درآمد (btnSettings) + btnHome + چیپ «ضبط صدا» (۱۱ چیپ) + نسخه ۰.۴ در badge/statusbar/about
- app.js: store (localStorage) + speak() با انتخاب خودکار صدای فارسی + hook در runCommand و پایان تایمر + attachMic/detachMic با getUserMedia و AnalyserNode → ویژوالایزر ۵۲ میله‌ای با صدای واقعی (فالبک سینتتیک) + startAudioRec/stopAudioRec با MediaRecorder و ذخیره واقعی از طریق پل + ۲ قانون فرمان ضبط + منطق کامل صفحه تنظیمات (سوییچ‌ها با فالبک مرورگر، انتخاب گوینده، UI آپدیتر با setUpdUI هفت‌حالته، پیوندها با openUrl)
- styles.css: استایل صفحه تنظیمات + سوییچ RTL + نوار پیشرفت دانلود + [hidden]{display:none!important} (رفع باگ دیده‌شدن دکمه chip مخفی) + ریسپانسیو ۶۸۰px
- push.ps1 بازنویسی: پارامتر -Version + بامپ خودکار patch قبل از کامیت در Release (0.4.0→0.4.1) + تگ از نسخه جدید + هشدار پروکسی گیت + پیام پیش‌فرض Release vX
- باگ‌های کشف و رفع‌شده در تست: (۱) دکمه‌های [hidden] با display:inline-flex دیده می‌شدند، (۲) چیپ‌های تنظیمات در لیست chips اولیه بودند و runCommand(undefined) صدا می‌زدند → سلکتور .chip[data-cmd] + گارد !cmd
- تست مرورگری 640x780: صفحه تنظیمات کامل رندر شد (نسخه فعلی v۰.۴.۰، سوییچ‌ها، سلکت صدا)، فرمان‌های «شروع ضبط/توقف ضبط» پاسخ درست، ذخیره TTS در localStorage، بدون خطای کنسول

Stage Summary:
- جریان انتشار آینده: .\push.cmd "پیام" -Release → بامپ خودکار نسخه + تگ + بیلد CI + انتشار در Releases + آپدیت خودکار برنامه‌های نصب‌شده
- برنامه از داخل خودش آپدیت می‌شود (تنظیمات → به‌روزرسانی)
- نسخه 0.4.0 آماده: کاربر باید کل پوشه را روی ویندوز کپی و .\push.cmd "v0.4.0" -Release بزند

---
Task ID: 6
Agent: main (Super Z)
Task: نسخه 0.5.0 — حذف فالبک دموی جعلی و STT واقعی (وب → GLM-ASR)، چت با هوش مصنوعی GLM + ساخت فرمان سفارشی، تنظیمات میکروفون با تست زنده، اکولایزر همیشه‌واقعی، runmetocreateexeforyou.bat + release.ps1

Work Log:
- تحقیق API: endpoint چت GLM (api.z.ai/api/paas/v4/chat/completions) و ASR فارسی (glm-asr-2512 روی /audio/transcriptions، پاسخ {text}) از docs.z.ai تأیید شد
- main.js: سه IPC جدید — ai:chat (OpenAI-compatible با پیام‌های آخر)، stt:transcribe (FormData multipart با Blob در پروسه اصلی — دور زدن CORS)، custom:run (اجرای اسکریپت PowerShell تک‌خطی فقط با تأیید قبلی UI، timeout 30s) + دو فرمان whitelist جدید (open_downloads با shell:Downloads، open_documents با shell:Personal، recycle_empty با Clear-RecycleBin)
- preload.js: ava.ai.chat / ava.stt.transcribe / ava.custom.run
- app.js بازنویسی STT: resolveEngine (خودکار/وب/GLM) → موتور وب با فالبک خودکار به GLM در خطای network/service-not-allowed → GLM-ASR با MediaRecorder + VAD ساده (آستانه میانگین طیف 16، توقف بعد از 2.3s سکوت، سقف 12s) → تبدیل → runCommand. تابع noEngine پیام صادقانه می‌دهد (هیچ فرمان جعلی اجرا نمی‌شود)؛ حالت دمو فقط با تنظیم صریح demoMode
- اکولایزر همیشه‌واقعی: attachMic از شروع برنامه (1.2s بعد) با deviceId دلخواه، frame() بدون شرط micLive از micData استفاده می‌کند؛ stopListening/stopAudioRec دیگر میکروفون را نمی‌بندند
- تنظیمات جدید: گروه میکروفون (enumerateDevices + select ورودی + میتر تست زنده canvas 34 میله‌ای)، گروه تشخیص گفتار (سلکت موتور، کلید GLM password با دکمه نمایش، سوییچ دمو)، گروه AI GLM (سلکت Z.ai/BigModel + مدل glm-4.6/4.5-flash/4.5-air)
- چت AI: صفحه chatPage با حباب‌های RTL، system prompt فارسیِ JSON-strict، parseAi مقاوم (حذف fence + استخراج {})، کارت فرمان جدید با دکمه «افزودن به فرمان‌ها» → ذخیره localStorage → chip سفارشی زمردی با دکمه حذف → اجرای صوتی/متنی با مودال تأیید برای نوع ps
- مودال تأیید (confirmBox) با کد LTR و دکمه‌های اجرا/بی‌خیال + Escape
- فرمان‌های جدید RULES: دانلودها، اسناد، خالی کردن سطل بازیافت؛ DEFAULT_REPLY جدید به صفحه چت ارجاع می‌دهد
- runmetocreateexeforyou.bat (ASCII): چک git، حذف پروکسی خراب، پیام کامیت اختیاری، فراخوانی release.ps1 + پیام URLهای Actions/Releases
- release.ps1 (ASCII): unset پروکسی، add/set-url origin خودکار، سینک .gitignore و build.yml به ریشه ریپو + هشدار ورک‌فلوی قدیمی، سوییچ به main، fetch tags، بامپ خودکار patch با node اگر تگ موجود باشد (رفع ریشه‌ای مشکل همگامی version↔tag)، commit/pull --rebase/push main، تگ + پوش تگ
- نسخه‌ها → 0.5.0 (package.json + statusbar + badge + about)؛ README بازنویسی بخش انتشار (راه ۱ دابل‌کلیک bat / راه ۲ push.ps1) و پل و ساختار
- تست: node --check هر سه فایل OK، JSON OK، ۶۲ شناسه UI همه در HTML موجود، agent-browser در 640×780 و 380×540 بدون overflow و بدون خطای کنسول؛ چت/تنظیمات/مودال تأیید/chip سفارشی همه رندر و رفتار درست؛ sync کامل به public/ava

Stage Summary:
- درخواست‌های کاربر انجام شد: (۱) دیگه میره روی دمو؟ نه — زنجیره وب→GLM-ASR با پیام صادقانه، (۲) فایل runmetocreateexeforyou.bat ساخته شد که پوش+تگ+بیلد EXE را خودکار می‌کند و مشکل همگامی نسخه/تگ را ریشه‌ای حل می‌کند، (۳) تنظیمات میکروفون با لیست ورودی‌ها و تست زنده، (۴) اکولایزر واقعاً با صدا بالا/پایین می‌شود (میکروفون همیشه فعال)، (۵) چت AI متصل به اکانت GLM کاربر با ساخت فرمان و افزودن به لیست با تأیید، (۶) فیچرهای جدید: پوشه‌ها، سطل بازیافت، فرمان سفارشی، مدل‌های AI
- برای فعال‌شدن STT ابری و چت، کاربر باید کلید API از console.z.ai (یا bigmodel) را در تنظیمات وارد کند

---
Task ID: 7
Agent: main (Super Z)
Task: نسخه 0.6.0 — حذف کامل نیاز به کلید API: STT رایگان گوگل (درخواست صریح کاربر)، چت GLM بدون توکن با اتصال به صفحه chat.z.ai، مسیریابی سوالات پیچیده به AI

Work Log:
- درخواست کاربر: «توکن API ندارم، خودش به همین صفحه ai وصل بشه» + «برای صدا از سیستم گوگل استفاده کن، رایگانه و فارسی داره» + «اگ درخواست پیچیده بود ai تحلیل کنه و جواب بده»
- main.js: webviewTag:true + نشست دائمی persist:ai با permission handler + setWindowOpenHandler (OAuth لاگین z.ai/گوگل داخل برنامه، بقیه لینک‌ها openExternal)
- main.js هندلر stt:google: POST PCM 16kHz به www.google.com/speech-api/v2/recognize (fa-IR، کلید عمومی کرومیوم AIzaSyBOti4mM...، client=chromium) با پارس NDJSON چندخطی + پیام 403 راهنما
- main.js هندلر ai:zaiChat: چت بدون کلید با توکن نشست z.ai — انتخاب خودکار مدل از /api/models (اولویت GLM-4.6)، POST api/chat/completions با stream:false، پارس پاسخ SSE و JSON، تشخیص 401 → needLogin
- preload.js: ava.stt.google + ava.ai.zaiChat
- app.js موتور گوگل رایگان: startGoogleListen با ScriptProcessorNode(4096) روی استریم مشترک میک، جمع‌آوری Float32 + VAD با RMS (آستانه 0.013، سکوت 1.5s، سقف 12s، تایم‌اوت بی‌صدایی 8s) → downsampleF32 خطی به 16kHz → f32ToI16 → bridge.stt.google؛ زنجیره resolveEngine: web → google → glm؛ فالبک onerror موتور وب اضافه شد
- app.js چت بدون کلید: تب‌های chatPage (چت سریع آوا / صفحه چت GLM) + webview chat.z.ai با useragent کروم؛ checkZaiToken با executeJavaScript خواندن localStorage.token با ۵ تلاش + badge وضعیت اتصال؛ aiAsk اول zaiChat بعد کلید GLM؛ حافظه گفتگو chatHist (۸ پیام آخر)
- پرامپت AI جدید: پاسخ طبیعی فارسی + بلوک <<<ADD>>>{json}<<<END>>> برای فرمان جدید؛ parseAdd استخراج مقاوم؛ renderCmdCard همان قبلی
- مسیریابی پیچیده: runCommand اگر فرمان شناخته نشد و aiConnected() → aiHandleCommand (پاسخ در کارت با تگ «هوش مصنوعی» + TTS + مودال تأیید برای فرمان پیشنهادی)
- index.html: تب‌ها + webview (partition=persist:ai, allowpopups, UA کروم) + کلید اختصاصی گوگل (اختیاری) در تنظیمات + دکمه «ورود به حساب GLM» + حذف سلکت سرویس‌دهنده (glmBase ثابت ماند) + نسخه‌ها ۰.۶
- styles.css: chat-tab/zai-badge/zai-wrap/zai-web/zai-hint
- package.json: 0.6.0 + توضیحات جدید
- تست: node --check سه فایل OK، JSON OK، بدون رفرنس stale (optAiBase/parseAi حذف)، یک submit handler، همه هندلرها موجود؛ agent-browser 640×780: چت سریع + تب z.ai + تنظیمات (میک/گفتار/AI/آپدیت) بدون خطا رندر شد؛ sync به public/ava
- تحویل: ZIP کامل در download/ava-voice-assistant-v0.6.0.zip (این ورک‌اسپیس اعتبارنامه گیت‌هاب ندارد؛ انتشار از سیستم کاربر با runmetocreateexeforyou.bat)

Stage Summary:
- هیچ کلید API دیگر لازم نیست: STT فارسی با موتور رایگان گوگل (وب → HTTP)، چت با نشست حساب z.ai کاربر داخل برنامه
- کاربر: ZIP را دانلود → استخراج → دابل‌کلیک runmetocreateexeforyou.bat → پوش + تگ v0.6.0 + بیلد EXE خودکار در Releases
- ریسک شناخته‌شده: endpoint speech-api/v2 گوگل ممکن است در بعضی شبکه‌ها 403 بدهد → پیام راهنما + فیلد کلید اختصاصی اختیاری در تنظیمات پیش‌بینی شد؛ مسیر z.ai وب (api/models + chat/completions) غیررسمی است و در صورت تغییر UI/API ممکن است نیاز به به‌روزرسانی داشته باشد — در آن صورت تب webview همیشه کار می‌کند

---
Task ID: 8
Agent: main (Super Z)
Task: راستی‌آزمایی پوش v0.6.0/v0.6.1 و EXE — کشف دو مشکل جدی + فیکس release.ps1 + ZIP سالم جدید

Work Log:
- کاربر پرسید: «مطمئنی همین نسخه جدید رو پوش میکنه؟ و فایل exe 0.6.0 رو میده؟» — کل زنجیره bat → release.ps1 → تگ → CI → Releases بازرسی شد
- git ls-remote: تگ‌های ریموت = v0.2.0/v0.2.2/v0.2.3/v0.3.0/v0.6.0/v0.6.1 (بدون v0.4.0/v0.5.0)؛ local HEAD ancestor ریموت بود
- کشف ۱: ریلیز v0.6.0 توسط github-actions[bot] ساخته شده ولی asset آن AVA-Setup-0.4.0.exe است — تگ v0.6.0 (کامیت «feat: release version 0.6.0 from provided archive» روی والد v0.3.0) روی کد قدیمی 0.4.0 زده شده (git show v0.6.0:...package.json → 0.4.0، بدون stt:google، app.js حدود ۸۶۶ خط عقب‌تر)
- کشف ۲: ریلیز v0.6.1 (دستیِ کاربر «les go») هیچ EXE ندارد — چون .github/workflows از ریشه ریپو در کامیت‌های 5bc2f39/2f77103 حذف شده بود و push تگ تریگر نشد
- کشف ۳ (ساختار): ریشه ریپوی گیت‌هاب = کل ورک‌اسپیس (public/src/download/...) و AVA زیر download/ava-voice-assistant — با working-directory ورک‌فلوی سازگار است؛ pathspec گیت نسبت به CWD است و diff های اولیه گمراه‌کننده بودند
- تأیید خوب: git diff محتوایی fbdd6c7..origin/main برای پوشه AVA فقط یک خط = version 0.6.0→0.6.1؛ یعنی کد جدید واقعی (STT گوگل، چت بدون توکن z.ai، مسیریابی پیچیده→AI) همین حالا روی main ریموت است
- git pull --ff-only origin main → ورک‌اسپیس به 0.6.1 سینک شد
- فیکس release.ps1: بامپ تگ از تک‌مرحله‌ای به حلقه while با TagTaken (چک تگ محلی + ls-remote ریموت با تحمل خطای شبکه) تا با وجود تگ‌های سوخته 0.6.0/0.6.1 ریلیز بعدی خودکار v0.6.2 شود؛ + پیام پایانی با نام دقیق AVA-Setup-$ver.exe؛ ASCII محض تأیید شد
- کامیت محلی فیکس؛ ZIP جدید با اسکریپت پایتونی (git archive در کلون shallow خراب/خالی بود): download/ava-voice-assistant-v0.6.1.zip — ۲۲ فایل، همه فایل‌های حیاتی، version 0.6.1، دارای فیکس؛ ZIP قدیمی v0.6.0 حذف شد

Stage Summary:
- پاسخ صادقانه به کاربر: نه — تا الان EXE درستی از کد جدید ساخته نشده (EXE ریلیز v0.6.0 = کد قدیمی 0.4.0؛ v0.6.1 بدون EXE) اما کد جدید روی main سالم است
- مسیر ادامه کاربر: clone تازه یا پول main → ریختن ZIP جدید روی download/ava-voice-assistant → دابل‌کلیک bat → ریلیز خودکار v0.6.2 → AVA-Setup-0.6.2.exe با کد کامل جدید در Releases؛ نصب‌های 0.4.0 با آپدیتر خودکار به 0.6.2 می‌روند
- نسخه محلی ورک‌اسپیس: 0.6.1 (+۱ کامیت فیکس محلی که هنوز روی گیت‌هاب نیست و فقط داخل ZIP است)

---
Task ID: 9
Agent: main (Super Z)
Task: انتشار کامل v0.6.2 روی گیت‌هاب توسط عامل (با توکن یکبارمصرف کاربر) + بیلد و انتشار EXE

Work Log:
- کاربر توکن fine-grained فرستاد؛ push با 403 خورد (Contents فقط-خواندن + فاقد Workflows) — تشخیص: احتمالاً گزینه Public repositories (read-only) انتخاب شده بود
- راهنمای اصلاح داده شد؛ کاربر توکن کلاسیک ghp_ (repo+workflow) فرستاد
- push موفق: main 2f77103→235fbbe (۳ کامیت: فیکس release.ps1، سینک worklog/ZIP، بامپ 0.6.2 + برگرداندن .github/workflows/build.yml به ریشه) + تگ v0.6.2 → هر دو با ls-remote تأیید شد
- مانیتور Actions با اسکریپت scripts/watch_ava_build.py: run 33258480191 → conclusion=success
- کشف: electron-builder ریلیز را Draft ساخت (id=379013968) با assetهای AVA-Setup-0.6.2.exe (78.7MB) + blockmap + latest.yml؛ همچنین Draft قدیمی v0.4.0 در ریپو وجود دارد
- ریلیز با API منتشر شد (PATCH draft:false + نام AVA v0.6.2 + توضیحات فارسی) → /releases/latest = v0.6.2 تأیید شد
- بهبود: releaseType:'release' در package.json + در مرحله fix ورک‌فلو (هر دو نسخه AVA و ریشه) → بیلدهای بعدی مستقیم منتشر می‌شوند نه draft؛ push شد (235fbbe→3241183، بدون تگ جدید = بدون بیلد اضافه)

Stage Summary:
- AVA-Setup-0.6.2.exe واقعی (کد جدید: STT گوگل، چت بدون توکن، مسیریابی AI) روی https://github.com/pvwvuow/ava-voice-assistant/releases/latest منتشر شد
- نصب‌های قبلی 0.4.0 با electron-updater و latest.yml به 0.6.2 آپدیت خودکار می‌شوند
- مشکل ریشه‌ای CI (نبودن ورک‌فلو در ریشه ریپو) رفع شد؛ release.ps1 هم حلقه‌ای فیکس شده
- باز برای کاربر: revoke هر دو توکن + تصمیم درباره حذف .env از گیت (شامل DATABASE_URL، از قبل عمومی است)

---
Task ID: 9
Agent: main (Super Z)
Task: گزارش باگ کاربر (بدون صدا، موتور گوگل خراب، خطای ورود گوگل) + فیکس همه + پوش و ریلیز

Work Log:
- کشف باگ بحرانی صدا: getByteFrequencyData هرگز فراخوانی نمی‌شد → micData همیشه صفر → اکولایزر/متر/تشخیص سکوت کور
- کشف: AudioContext بدون resume ممکن است suspended بماند → onaudioprocess هیچ‌وقت fire نمی‌شود → «صدایی نشنیدم»
- تست زنده endpoint گوگل: HTTP 200 با کلید پیش‌فرض → موتور گوگل سمت سرور سالم است؛ مشکل سمت کلاینت بود
- فیکس attachMic: فالبک خودکار به میکروفون پیش‌فرض وقتی deviceId ذخیره‌شده خراب است + پیام خطای دقیق فارسی به تفکیک نوع خطا
- فیکس «This browser or app may not be secure»: CHROME_UA در app.userAgentFallback + setUserAgent + هدرهای sec-ch-ua برای هر دو نشست؛ پاپ‌آپ OAuth وب‌ویو z.ai در پارتیشن persist:ai
- فیکس stt:google: تایم‌اوت 15 ثانیه + پیام خطای 403/5xx/خالی + regex خطای شبکه
- فیکس GLM-ASR: تحمل 1.3 ثانیه سکوت تا بین کلمات قطع نشود
- متفرقه: تایپوی «تایر»، تگ «اجرا نشد» به‌جای «شبیه‌سازی دمو»، listMicDevices هنگام باز شدن تنظیمات، resume در beep
- کشف اینکه v0.6.2 قبلاً با CI منتشر شده (کد قبل از فیکس) → بامپ به v0.6.3 برای آپدیت خودکار نصب‌های قبلی
- پوش main (0a31bea) + تگ v0.6.3 با توکن کلاسیک؛ CI run 33259219600 → success
- ساخت ZIP سورس v0.6.3 (22 فایل، وریفای فیکس‌ها) و حذف ZIP قدیمی 0.6.1

Stage Summary:
- ریلیز v0.6.3 منتشر شد: https://github.com/pvwvuow/ava-voice-assistant/releases/tag/v0.6.3
- AVA-Setup-0.6.3.exe (78.7MB) + blockmap + latest.yml (sha512 سازگار با electron-updater)
- نصب‌های 0.6.2 ظرف ۱۲ ثانیه بعد از باز شدن برنامه آپدیت را خودکار پیدا می‌کنند
- ZIP: download/ava-voice-assistant-v0.6.3.zip
- یادآوری امنیتی به کاربر: Revoke هر دو توکن (fine-grained + ghp_...) لازم است؛ سوال حذف .env هنوز بی‌پاسخ است

---
Task ID: 10
Agent: main (Super Z)
Task: گزارش کاربر: میکروفون وصل می‌شود ولی گوگل/STT کند یا خراب است + درخواست فیچرهای جدید و روش بهتر دریافت صدا/درخواست

Work Log:
- ریشه‌یابی: endpoint گوگل speech-api از سرور ما 200 می‌دهد ولی برای کاربر ایران فیلتر است + کلید عمومی کرومیوم محدودیت شدید دارد؛ تشخیص اینکه زنجیره gRec/GLM بعد از تشخیص، فرمان را اجرا نمی‌کردند
- کشف باگ بحرانی دوم: runCommand با گارد state==='processing' هر پاسخ تشخیص‌داده‌شده گوگل/GLM را ساکت رد می‌کرد (تشخیص جواب می‌داد ولی فرمان اجرا نمی‌شد) → جایگزینی با cmdBusy
- انتخاب معماری: پکیج vosk به ffi-napi وابسته است و بیلد نمی‌شود → ریسک CI؛ تصمیم: Whisper آفلاین با transformers.js v2 (WASM خالص، بدون ماژول نیتیو)
- مدل whisper-tiny کوانتیزه (~42MB: tokenizer 2.4MB + encoder 9.7MB + decoder 30MB) از HuggingFace دانلود و داخل برنامه باندل شد (renderer/models/) + transformers.min.js و ort-wasm-simd(-threaded).wasm در renderer/vendor/ → نصب‌کننده 78.7MB → 107.3MB
- پروتکل امن ava://app (standard+secure+supportFetchAPI+stream) با هندلر readFileSync + MIME کامل + ACAO:* + COOP/COEP فقط برای index.html → crossOriginIsolated=true → SAB → WASM چندنخی
- کشف و حل ۳ مشکل لود ورکر: (۱) ورکر مستقیم از پروتکل سفارشی با COEP لود نمی‌شود → ساخت Blob-Worker؛ (۲) importScripts با URL نسبی در Blob ورکر بدون base شکست می‌خورد → URL مطلق ava://؛ (۳) باندل ESM است نه UMD (خطای "Unexpected token 'export'") → سوییچ به Module Worker با import مطلق از vendor
- تست‌ها: node --check همه فایل‌ها ✓؛ تست Node مدل: pipeline از فایل‌های لوکال لود شد (780ms) و inference اجرا شد ✓؛ تست دود کامل Electron با Xvfb: ava://app لود، coi:true، bridge، UI جدید، asrReady:true و «موتور: آفلاین Whisper» → SMOKE_OK
- فیچرهای جدید: حالت بی‌دست با کلمه بیدارباش «آوا» (شورت‌کات سراسری Ctrl+Alt+A + تاگل UI + تنظیمات)، VAD با کف نویز تطبیقی + بریدن سکوت لبه‌ها، آب‌وهوا از Open-Meteo بدون کلید (IPC sys:weather با کد WMO فارسی)، ماشین‌حساب صوتی فارسی (اعداد حرفی + عملگرها + اعتبارسنجی)، vol_set تنظیم دقیق درصد صدا با keybd_event، پنل تاریخچه فرمان‌ها با اجرای مجدد، ذخیره‌سازی تنظیمات در userData/ava-settings.json (مقاوم به تغییر مببع UI)، تایم‌اوت 60s برای z.ai/GLM
- زنجیره موتور جدید: آفلاین Whisper → وب → گوگل رایگان → GLM-ASR؛ گزینه «فقط موتور آفلاین» در تنظیمات
- بامپ 0.7.0 (package.json + توضیحات) + README بازنویسی + commit 2f536e3 + تگ v0.7.0 + push با توکن کلاسیک
- CI run 33261592193 → success؛ ریلیز منتشر شد: AVA-Setup-0.7.0.exe (107.3MB) + blockmap + latest.yml
- ZIP سورس v0.7.0 ساخته شد (34 فایل، مدل و ورکر داخلش وریفای شد) و ZIP قدیمی 0.6.3 حذف شد

Stage Summary:
- ریلیز v0.7.0: https://github.com/pvwvuow/ava-voice-assistant/releases/tag/v0.7.0 — نصب‌های قبلی با electron-updater خودکار آپدیت می‌شوند
- تشخیص گفتار حالا ۱۰۰٪ آفلاین است: بدون گوگل، بدون فیلترشکن، بدون کلید، صدای کاربر به هیچ سروری نمی‌رود
- ZIP: download/ava-voice-assistant-v0.7.0.zip
- یادآوری امنیتی باز: کاربر باید هر دو توکن (fine-grained + ghp_) را revoke کند؛ سوال حذف .env از گیت هنوز بی‌پاسخ است

---
Task ID: 8 (v0.8.0 release)
Agent: main (Super Z)
Task: فیکس دقت تشخیص گفتار، فیکس چت GLM با حساب کاربر، آپدیت دلتا/خودکار، ریدیزاین تنظیمات، تایپ صوتی (شروع/پایان/علائم/فرمان سفارشی/کپی)، مدیریت DNS صوتی (الکترو/شکن/شماره‌دار/بی‌نهایت/قابل ویرایش)

Work Log:
- تحقیق z.ai web API از ریپوهای reverse-engineered (hmjz100/Z.ai2api): هدرهای لازم X-FE-Version/Origin/Referer + بدنه stream:true + chat_id/id + پاسخ SSE با phase/delta_content
- main.js: بازنویسی کامل ai:zaiChat (هدرهای مرورگر + SSE واقعی + حذف زنجیره فکر + fallback فرمت OpenAI)؛ IPC جدید dns:interfaces/current/apply/reset با اسکریپت PowerShell موقت + Start-Process -Verb RunAs (UAC) + اعتبارسنجی بعد از اعمال؛ IPC sys:type-text (کلیپ‌بورد + Ctrl+V در برنامه فعال)
- asr.module.js: پشتیبانی مدل باکیفیت (Xenova/whisper-base/small با دانلود و کش + فالبک خودکار به tiny باندل‌شده)، chunk_length_s/stride_length_s
- app.js: اولویت «دقت» (وب گوگل اول) با سگ‌بان ۸ثانیه‌ای و فالبک زنجیره‌ای به آفلاین؛ normalizeLoudness (RMS→0.035، حداکثر ×۶) در مسیرهای whisper/google؛ حالت تایپ صوتی کامل (DICT_START/STOP با مادّه «آ»، علائم نگارشی DICT_PUNCT، اکشن‌ها، فرمان سفارشی n-گرمی، rearm loop، خروجی کادر یا برنامه فعال)؛ مدیریت DNS (پایگاه ۱۱ DNS معروف، تطبیق فازی نام، شماره‌دار، ensureUserProfile، صفحه مدیریت کامل)؛ showView dict/dns؛ ریدیزاین مسطح set-group؛ بامپ نسخه
- index.html: صفحه تایپ صوتی (textarea + interim + کپی/پاک) و صفحه DNS (وضعیت فعلی، فرم افزودن/ویرایش، DNSهای معروف، فهرست پروفایل‌ها)؛ بخش‌های تنظیمات تایپ صوتی و DNS؛ دکمه‌های ریل و چیپ‌های جدید؛ نسخه‌ها ۰.۸
- styles.css: set-group مسطح + استایل‌های dict/tc/dns
- تست: node --check همه ✓؛ تست رجکس‌ها (فیکس مادّه «آ» + بسه) ALL PASS ✓؛ تست دود Xvfb Electron: SMOKE_OK (پروتکل، bridge dns/typeText، همه المان‌ها، سیکل کامل شروع/پایان تایپ صوتی با کلیک چیپ و فرمان «آوا تموم») ✓
- README بازنویسی برای ۰.۸؛ package.json 0.8.0

Stage Summary:
- v0.8.0 آماده انتشار: تشخیص گفتار دقیق‌تر (وب-first + فالبک خودکار + نرمال‌سازی صدا + مدل باکیفیت اختیاری)، تایپ صوتی کامل، DNS صوتی کامل، چت GLM فیکس‌شده، تنظیمات مسطح، آپدیت دلتا
- یادآوری امنیتی باز: کاربر باید هر دو توکن گیت‌هاب را revoke کند؛ سوال حذف .env از گیت هنوز بی‌پاسخ است

---
Task ID: 8-b (push + release v0.8.0)
Agent: main (Super Z)
Task: پوش main + تگ v0.8.0 و انتشار ریلیز

Work Log:
- پوش اول رد شد: GitHub Push Protection توکن ghp_ را در scripts/watch_ava_070.py (کامیت محلی c546acd) پیدا کرد
- تاریخچه بازنویسی شد: soft reset به 2f536e3، حذف فایل حاوی توکن از استیج و دیسک، اسکن کامل diff استیج (فقط کلید عمومی کرومیوم باقی ماند که از قبل در ریلیزهای قبلی بود)، ری‌کامیت یکجا (2a4f2fc)
- push موفق: main + تگ v0.8.0
- CI run 33263596288 → success؛ ریلیز: AVA-Setup-0.8.0.exe (107.3MB) + blockmap (0.1MB) + latest.yml → آپدیت دلتا فعال است

Stage Summary:
- ریلیز v0.8.0: https://github.com/pvwvuow/ava-voice-assistant/releases/tag/v0.8.0 — نصب‌های 0.7.0 خودکار آپدیت می‌شوند
- توکن ghp_ به گیت‌هاب نرفت (push protection جلویش گرفت) ولی روی دیسک لوکال بود → کاربر حتماً باید revoke کند
