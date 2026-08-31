'use strict';
/* ============================================================
   آوا — هستهٔ منطق «ویدیوی شناور» (Smart Gaming PiP) — v0.37
   ------------------------------------------------------------
   این فایل «بدون Electron» است تا بتوان آن را در تست‌های
   Node خالص اجرا کرد (همان ریاضیاتِ موقعیت/اندازه/شفافیت که
   pipWindowManager در پروسهٔ اصلی استفاده می‌کند).

   ⚠️ نکتهٔ مهم برای گیمرها (Exclusive Fullscreen):
   اگر بازی با حالت «تمام‌صفحهٔ انحصاری» (Exclusive Fullscreen) اجرا شود،
   ویندوز اجازهٔ نمایش هیچ پنجرهٔ شناوری (حتی overlayهای سیستم) را روی
   صحنهٔ بازی نمی‌دهد و پنجرهٔ PiP دیده نمی‌شود.
   ✅ برای بهترین نتیجه بازی را در «Borderless Windowed» یا
      «Windowed Fullscreen» اجرا کنید — تقریباً همهٔ بازی‌های جدید این
      حالت را در تنظیمات Display دارند.
   ============================================================ */

/* اندازه‌های استاندارد (نسبت 16:9) — طبق مشخصات:
   small=360×203 ، medium=480×270 ، large=640×360 ، xl=854×480 */
const PIP_SIZES = {
  small: { w: 360, h: 203 },
  medium: { w: 480, h: 270 },
  large: { w: 640, h: 360 },
  xl: { w: 854, h: 480 },
};

/* ترتیب اندازه‌ها برای «بزرگش کن / کوچیکش کن» (گام نسبتاً +/−) */
const PIP_SIZE_ORDER = ['small', 'medium', 'large', 'xl'];

/* نام نمایشی اندازه‌ها (فارسی) برای UI پنجره */
const PIP_SIZE_LABELS = { small: 'کوچک', medium: 'متوسط', large: 'بزرگ', xl: 'خیلی بزرگ' };

/* موقعیت‌های مجاز روی مانیتور */
const PIP_POSITIONS = [
  'top-left', 'top-center', 'top-right',
  'center',
  'bottom-left', 'bottom-center', 'bottom-right',
];

/* فاصله از لبه‌ها (px) — طبق مشخصات */
const PIP_MARGIN = 24;

/* پله‌های شفافیت مجاز — چرخش دکمهٔ UI و اسنپ مقادیر صوتی */
const PIP_OPACITY_STEPS = [0.3, 0.5, 0.7, 1];

/* حالت پیش‌فرض: پایین-راست، متوسط (25٪ عرض صفحهٔ 1080p)، مات نیست */
const DEFAULT_STATE = {
  position: 'bottom-right',
  size: 'medium',
  opacity: 1,
  clickThrough: false,
  alwaysOnTop: true,
  focusable: false, /* هیچ‌وقت فوکوس را از بازی نمی‌قاپد */
  displayId: null,  /* آخرین مانیتور — در load با نزدیک‌ترین match جایگزین می‌شود */
  lastBounds: null, /* {x,y,width,height} — برای بازیابی دقیق جای پنجره */
};

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

/* محاسبهٔ مختصات پنجره بر اساس workArea مانیتور فعال — طبق فرمول‌های مشخصات:
   top-right    → x = wa.x + wa.width  − w − margin ، y = wa.y + margin
   bottom-right → x = wa.x + wa.width  − w − margin ، y = wa.y + wa.height − h − margin
   center       → x = wa.x + (wa.width − w)/2        ، y = wa.y + (wa.height − h)/2
   margin پیش‌فرض = 24px */
function pipBounds(wa, sizeKey, position) {
  const s = PIP_SIZES[sizeKey] || PIP_SIZES.medium;
  const w = s.w, h = s.h;
  const area = wa && typeof wa.width === 'number' ? wa : { x: 0, y: 0, width: 1920, height: 1040 };
  const m = PIP_MARGIN;
  let x, y;
  switch (position) {
    case 'top-left': x = area.x + m; y = area.y + m; break;
    case 'top-center': x = area.x + (area.width - w) / 2; y = area.y + m; break;
    case 'top-right': x = area.x + area.width - w - m; y = area.y + m; break;
    case 'center': x = area.x + (area.width - w) / 2; y = area.y + (area.height - h) / 2; break;
    case 'bottom-left': x = area.x + m; y = area.y + area.height - h - m; break;
    case 'bottom-center': x = area.x + (area.width - w) / 2; y = area.y + area.height - h - m; break;
    case 'bottom-right':
    default: x = area.x + area.width - w - m; y = area.y + area.height - h - m; break;
  }
  /* همیشه داخل workArea بماند (اگر پنجره بزرگ‌تر از ناحیهٔ کاری شد) */
  x = clamp(Math.round(x), area.x, Math.max(area.x, area.x + area.width - w));
  y = clamp(Math.round(y), area.y, Math.max(area.y, area.y + area.height - h));
  return { x, y, width: w, height: h };
}

/* گام بعدی/قبلی اندازه برای «بزرگش کن» (+1) و «کوچیکش کن» (−1) */
function stepSize(sizeKey, dir) {
  const i = PIP_SIZE_ORDER.indexOf(sizeKey);
  const cur = i === -1 ? 1 : i; /* پیش‌فرض medium */
  const next = clamp(cur + (dir >= 0 ? 1 : -1), 0, PIP_SIZE_ORDER.length - 1);
  return PIP_SIZE_ORDER[next];
}

/* نزدیک‌ترین پلهٔ شفافیت مجاز (برای «شفافیت ۶۰ درصد» → 0.7) */
function snapOpacity(v) {
  const n = clamp(Number(v), 0, 100);
  if (!isFinite(n)) return 1;
  const pct = n > 1 ? n : n * 100; /* هم 0.5 هم 50 قبول است */
  let best = 1, bestD = Infinity;
  for (const s of PIP_OPACITY_STEPS) {
    const d = Math.abs(pct - s * 100);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

/* گام بعدی شفافیت — چرخهٔ UI: 1 → 0.7 → 0.5 → 0.3 → 1 */
function stepOpacity(v, dir) {
  const cur = snapOpacity(v);
  const i = PIP_OPACITY_STEPS.indexOf(cur);
  const next = clamp(i + (dir >= 0 ? 1 : -1), 0, PIP_OPACITY_STEPS.length - 1);
  return PIP_OPACITY_STEPS[next];
}

/* اعتبارسنجی/ادغام حالت ذخیره‌شده — هر ورودی خرابی به پیش‌فرض برمی‌گردد */
function normalizeState(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const st = {
    position: PIP_POSITIONS.includes(r.position) ? r.position : DEFAULT_STATE.position,
    size: PIP_SIZES[r.size] ? r.size : DEFAULT_STATE.size,
    opacity: clamp(Number(r.opacity), 0.1, 1) || DEFAULT_STATE.opacity,
    clickThrough: !!r.clickThrough,
    alwaysOnTop: r.alwaysOnTop === undefined ? DEFAULT_STATE.alwaysOnTop : !!r.alwaysOnTop,
    focusable: r.focusable === undefined ? DEFAULT_STATE.focusable : !!r.focusable,
    displayId: (r.displayId === undefined || r.displayId === null) ? null : Number(r.displayId) || null,
    lastBounds: null,
  };
  const b = r.lastBounds;
  if (b && Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.width) && Number.isFinite(b.height)) {
    /* ابعاد آخر به اندازه‌های مجاز اسنپ می‌شوند تا نسبت 16:9 حفظ بماند */
    const sizes = Object.keys(PIP_SIZES).map((k) => PIP_SIZES[k]);
    let best = sizes[1], bestD = Infinity;
    for (const s of sizes) {
      const d = Math.abs(s.w - b.width) + Math.abs(s.h - b.height);
      if (d < bestD) { bestD = d; best = s; }
    }
    st.lastBounds = { x: Math.round(b.x), y: Math.round(b.y), width: best.w, height: best.h };
  }
  return st;
}

/* ---------- استخراج یوتیوب از URL ----------
   youtu.be/ID ، watch?v=ID ، /shorts/ID ، /embed/ID ، /live/ID
   + زمان شروع t= یا start= (فرم 12 یا 1m30s یا 1h2m3s) */
function ytIdFromUrl(u) {
  const s = String(u || '');
  const m = s.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/|v\/))([A-Za-z0-9_-]{6,})/i
  );
  return m ? m[1] : null;
}

function ytStartFromUrl(u) {
  const s = String(u || '');
  const m = s.match(/[?&](?:t|start)=([0-9hms]+)/i);
  if (!m) return 0;
  const raw = m[1];
  if (/^\d+$/.test(raw)) return parseInt(raw, 10);
  const hm = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (!hm) return 0;
  return (parseInt(hm[1] || '0', 10) * 3600) + (parseInt(hm[2] || '0', 10) * 60) + parseInt(hm[3] || '0', 10);
}

module.exports = {
  PIP_SIZES, PIP_SIZE_ORDER, PIP_SIZE_LABELS, PIP_POSITIONS, PIP_MARGIN, PIP_OPACITY_STEPS,
  DEFAULT_STATE, pipBounds, stepSize, snapOpacity, stepOpacity, normalizeState,
  ytIdFromUrl, ytStartFromUrl, clamp,
};
