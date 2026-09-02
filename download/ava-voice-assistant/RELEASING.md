# راهنمای انتشار آوا (RELEASING) — از باتری تا ریلیزِ منتشرشده

> این سند «فرایند واقعی» است؛ بخش انتشار README فقط خلاصه‌اش را می‌گوید.
> ابزارهای قدیمی (`runmetocreateexeforyou.bat` و `push.ps1`) مسیرِ مستقیمِ انتشارند و دیگر توصیه نمی‌شوند.

## نقشهٔ کلی

```
باطری تست ← بامپ نسخه ← smoke واقعی (Xvfb) ← بستهٔ واقعی --dir + بازرسی asar ← کامیت
   ← پوش تگ v* ← CI (باطری اوبونتو → بیلد ویندوز → بازرسی asar → ریلیزِ درفت)
   ← بازبینی دارایی‌ها ← انتشار درفت + نُت‌های فارسی ← تمام
```

قاعدهٔ طلایی: **نسخه در چهار جا باید یکی باشد** (package.json، description فارسی، `appVersion` در app.js، `abVersion` در index.html) — اسکریپت بامپ هر چهار جا را با هم عوض می‌کند و اگر جایی نسخهٔ قدیم را نبیند، **بدون نوشتن** رد می‌شود.

## ۱) باتری کامل

```bash
node scripts/run-battery.js
```

همهٔ سوئیت‌ها (`scripts-test-v0*.js` + `ave3` + `dns` + `race`) باید سبز باشند و خروجی JSON پایانی `fail: 0` بدهد. گارد بسته‌بندی (`scripts-test-v0551.js`) هم داخل باتری است — همان نگهبانِ درس v0.55.1.

## ۲) بامپ نسخه

```bash
node scripts/bump-version.js 0.60.0-beta
```

چهار فایل را آپدیت می‌کند (package.json + description فارسی «۰.۵۷ ← ۰.۶۰»، app.js، index.html، README) و خلاصهٔ جایگزینی هر فایل را چاپ می‌کند. اگر چیزی را پیدا نکرد، هیچ فایلی نوشته نمی‌شود (idempotent-safe).

## ۳) smoke واقعی (دستی، Xvfb :99)

> نکتهٔ ماندگار: Xvfb را «دستی» روی دیسپلی :99 بگذار — اسکریپت smoke خودش به :99 وصل می‌شود و اگر دیسپلی نباشد، واقعاً اجرا نمی‌شود. حتماً با باینری electron اجرا کن نه node خالی (`node` → `registerSchemesAsPrivileged undefined`).

```bash
Xvfb :99 -screen 0 1280x800x24 &
DISPLAY=:99 node_modules/.bin/electron . &     # بگذار بالا بیاید، بعد:
node scripts-smoke.js
# انتظار: 326/326 SMOKE_OK
```

## ۴) بستهٔ واقعی + بازرسی asar (قبل از تگ!)

```bash
npx electron-builder --dir                       # بدون NSIS، فقط win-unpacked
npx asar list dist/win-unpacked/resources/app.asar > /tmp/asar.txt
for f in main.js preload.js pipCore.js pipWindowManager.js lib/dns-bypass.js \
         renderer/index.html renderer/js/app.js renderer/css/styles.css \
         renderer/fonts/Vazirmatn-Regular.woff2; do
  grep -Eq "(^|/)$f\$" /tmp/asar.txt && echo "ok $f" || echo "MISSING $f"
done
```

این همان درسِ **v0.55.1** است: `widgetManager.js` در `build.files` نبود ولی main.js آن را require می‌کرد → داخل asarِ نصاب وجود نداشت → «برنامه نصب شد ولی باز نمی‌شود». سوئیت `scripts-test-v0551.js` و گام `Asar inspect` در CI هر دو همین را خودکار چک می‌کنند — ولی چکِ دستی قبل از تگ هم ارزان است.

## ۵) کامیت و تگ

```bash
git add -A
git commit -m "feat: v0.60.0-beta — <عنوان فارسی> … (توضیح کامل — این متن بعدها نُت ریلیز می‌شود)"
git tag v0.60.0-beta
git push origin main --follow-tags
```

اگر تگ از قبل روی ریموت باشد CI دو بار اجرا نمی‌شود / خطای tag-version گارد می‌گیرد — «نسخه را bump کن».

## ۶) CI چه می‌کند؟ (`.github/workflows/build.yml` — نسخهٔ ریشه بایت‌به‌بایت کپی است)

1. **job تست (اوبونتو):** `npm ci` (با کش) → `node scripts/run-battery.js` — بیلد فقط بعد از سبزی تست است (`needs: test`).
2. **گارد تگ=نسخه:** تگِ پوش‌شده با `package.json` سنجیده می‌شود؛ ناهم‌خوانی = شکست فوری قبل از هر بیلدی.
3. **job بیلد (ویندوز، سقف ۳۰ دقیقه):** `npm ci` → تزریق repository → `npm run dist` (انتشار به‌صورت **درفت**) → **بازرسی asar** (فایل‌های حیاتی باید داخل app.asar باشند) → آپلود آرتیفکت فقط برای اجرای دستی (workflow_dispatch).
4. `concurrency: release-<ref>` بدون cancel — دو ریلیز هم‌زمان روی هم نمی‌نویسند.

انتشار درفت است چون باید اول خودت بسته را ببینی؛ `releaseType: draft` در package.json ثابت است (اسکریپت‌های قدیمی که آن را release می‌کردند منسوخ‌اند).

## ۷) بازبینی و انتشار نهایی — `scripts/gh_release_tools.py`

ابزارِ بدون‌توکن (از `/home/z/my-project/scripts/`؛ توکن فقط از `GH_TOKEN` env خوانده می‌شود — هرگز در فایل/کامیت/خروجی نمی‌آید):

```bash
export GH_TOKEN=<توکن شخصی با دسترسی contents:write>

python3 gh_release_tools.py list-actions-runs 5      # وضعیت اجراها
python3 gh_release_tools.py wait-run v0.60.0-beta    # تا کامل‌شدن بیلدِ تگ صبر می‌کند (conclusion را می‌دهد)
python3 gh_release_tools.py list-releases            # دارایی‌ها: AVA-Setup-*.exe + .blockmap + latest.yml
python3 gh_release_tools.py publish-draft v0.60.0-beta
node -e "…" > notes.txt                              # نُت فارسی را از پیام کامیت بساز
python3 gh_release_tools.py patch-notes v0.60.0-beta notes.txt
```

بعد از انتشار، `latest.yml` باعث می‌شود نصب‌های قبلی خودشان آپدیت شوند.

## ۸) رول‌بک (runbook)

ترتیبِ امن وقتی ریلیز خراب است:

1. **آرشیو:** `git branch archive/vX.Y.Z-line && git push origin archive/vX.Y.Z-line` (شاخهٔ نجات — مثل `archive/v0.55-56-line`).
2. **برگشت شاخه:** `git reset --hard <کامیت خوب>` و سپس `git push --force origin main` (فقط اگر مطمئنی — تاریخچهٔ بازنویسی‌شده).
3. **حذف ریلیز خراب:** `python3 gh_release_tools.py delete-release vX.Y.Z-beta` (فقط ریلیز؛ خود تگ را هم می‌خواهی حذف کنی: `git push origin :refs/tags/vX.Y.Z-beta`).
4. کاربرانی که نسخهٔ خراب را نصب کرده‌اند: اگر `latest.yml` به نسخهٔ قبلی برگردد آپدیتر خودش پایین می‌آورد؛ در غیر این صورت اطلاع‌رسانی دستی.
5. درس را در worklog بنویس و سوئیت گارد اضافه کن — همان کاری که v0.55.1 برای `build.files` کرد.

## یادداشت‌ها

- **درس build.files:** هر فایل ریشه‌ای که main.js require می‌کند باید هم روی دیسک باشد (سوئیت v0551)، هم داخل `build.files` (همان سوئیت + بازرسی asar CI). «تست سبز = بستهٔ سالم» نیست — خود بسته را چک کن.
- **Xvfb دستی :99:** اسکریپت‌های smoke به دیسپلی :99 تکیه دارند؛ Xvfb را خودت بالا بیاور (بخش ۳).
- **اسکریپت‌ها بدون توکن‌اند:** `gh_release_tools.py` و CI فقط `GH_TOKEN` را از محیط می‌خوانند (`secrets.GITHUB_TOKEN` در Actions). هیچ توکنی در ریپو/کامنت/خروجی نباید ظاهر شود.
- نسخه‌های قدیمی: ابزارهای `runmetocreateexeforyou.bat` / `push.ps1` / `release.ps1` هنوز برای پوشِ روزمره کار می‌کنند ولی منطق انتشارشان (تگِ حذف/باز-ساخت + انتشار مستقیم) با فرایند درفت فعلی ناسازگار است — برای انتشار رسمی از همین سند استفاده کن.
