# نقشهٔ ریشهٔ مونوریپو (ROOT-MAP)

> این ریپو یک مونوریپو است؛ **اپلیکیشن آوا فقط در زیرپوشهٔ `download/ava-voice-assistant/` زندگی می‌کند.**

| مسیر | چیست | وضعیت |
|---|---|---|
| `download/ava-voice-assistant/` | **اپلیکیشن Electron آوا** (main.js، renderer/، تست‌ها، CI اپ، RELEASING.md) | پروژهٔ اصلی |
| `src/`, `public/` (به‌جز `public/ava`)، `prisma/`, `examples/`, `tests/` … | اسکفت Next.js نامرتبط (پیش‌فرض سندباکس) — هیچ ربطی به اپ آوا ندارد | دست‌نخورده/نامرتبط |
| `docs/BUGLIST-v0.46.md` | سند تاریخی باگ‌های v0.46 (همه بسته‌شده در v0.47.0-beta) | آرشیو |
| `scripts/` | ابزارهای توسعه/انتشار (بیرون از گیت نگه داشته می‌شود؛ ابزار ریلیز: `gh_release_tools.py`) | ابزار توسعه |
| `upload/`, `db/` | آشغال محلی (تصاویر/زیپ‌های آپلودی، دیتابیس محلی) — جزو اپ نیست، نباید track شود | junk محلی |
| `public/ava/` | آینهٔ منسوخ‌شدهٔ وبِ اپ (نسخهٔ قدیمی) | منسوخ — در انتظار حذف |
| `.github/workflows/build.yml` | ورک‌فلوی CI — بایت‌به‌بایت کپیِ `download/ava-voice-assistant/.github/workflows/build.yml` (اسکریپت‌های پوش این سینک را انجام می‌دهند) | سینک‌شده |

## انتشار اپ

فرایند کامل انتشار (باطری ← بامپ ← smoke ← بستهٔ واقعی/asar ← تگ ← CI درفت ← انتشار) فقط در یک‌جاست:
**`download/ava-voice-assistant/RELEASING.md`** — ابزارهای ریلیز: `scripts/gh_release_tools.py` (بدون توکن؛ `GH_TOKEN` از محیط).
