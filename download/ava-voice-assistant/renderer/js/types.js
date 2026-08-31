'use strict';
/* ============================================================
   آوا — types (v0.37) — قراردادهای دادهٔ «ویدیوی شناور» (JSDoc)
   ------------------------------------------------------------
   پروژهٔ آوا JavaScript خالص است؛ این فایل قراردادِ اشتراکیِ
   pipWindowManager / preload / renderer / پارسر صوتی را مستند
   می‌کند تا هر فایل دقیقاً همان شکل داده را بفرستد/بگیرد.
   ============================================================ */

/**
 * موقعیت پنجرهٔ PiP روی مانیتور فعال
 * @typedef {'top-right'|'top-left'|'bottom-right'|'bottom-left'|'center'|'top-center'|'bottom-center'} PipPosition
 */

/**
 * اندازهٔ پنجرهٔ PiP (نسبت 16:9)
 * v0.38.1 — قرارداد سیمی واقعی «xl» است (pipCore.PIP_SIZES) نه extra-large؛
 * قبلاً pipAPI.resize('extra-large') طبق این typedef بی‌صدا no-op می‌شد
 * @typedef {'small'|'medium'|'large'|'xl'} PipSize
 * small=360×203 medium=480×270 large=640×360 xl=854×480
 */

/**
 * نیت تشخیص‌داده‌شده از فرمان صوتی
 * @typedef {'PIN_VIDEO'|'UNPIN_VIDEO'|'MOVE_PIP'|'RESIZE_PIP'|'OPACITY_PIP'|
 *           'CLICK_THROUGH_ON'|'CLICK_THROUGH_OFF'|'ALWAYS_ON_TOP_ON'|
 *           'ALWAYS_ON_TOP_OFF'|'RESET_PIP'} PipIntent
 */

/**
 * نتیجهٔ پارسر فرمان صوتی
 * @typedef {Object} ParsedPipCommand
 * @property {PipIntent} intent                 نیت اصلی
 * @property {{position?: PipPosition, size?: PipSize|'bigger'|'smaller', opacity?: number}} entities موجودیت‌های اختیاری
 */

/**
 * منبع ویدیویی که پنجرهٔ PiP باید پخش کند
 * @typedef {Object} PipVideoSource
 * @property {'youtube'|'src'|'blob'|'none'} kind
 *   youtube → ویدیوی یوتیوب (videoId + start ثانیه) در iframe رسمی
 *   src     → URL مستقیم https (mp4/webm) با volume/rate/time
 *   blob    → ویدیوی صفحه با MediaSource — انتقال مستقیم ممکن نیست (محدودیت)
 *   none    → چیزی پیدا نشد؛ پنجره با راهنمای صوتی باز می‌شود
 * @property {string=} videoId
 * @property {number=} start   ثانیهٔ شروع (یوتیوب: ?start=)
 * @property {string=} url
 * @property {number=} volume  0..1
 * @property {number=} rate    نرخ پخش
 * @property {number=} time    ثانیهٔ جاری برای resume
 * @property {boolean=} muted
 */

/**
 * وضعیت ماندگار PiP — در pip-state.json (پوشهٔ userData) ذخیره می‌شود
 * @typedef {Object} PipState
 * @property {PipPosition} position
 * @property {PipSize} size
 * @property {number} opacity        0.3 | 0.5 | 0.7 | 1
 * @property {boolean} clickThrough
 * @property {boolean} alwaysOnTop
 * @property {boolean} focusable
 * @property {number|null} displayId
 * @property {{x:number,y:number,width:number,height:number}|null} lastBounds
 * @property {boolean=} open         فقط در getState() — پنجره الان باز است؟
 */

/**
 * پل امن پروسهٔ اصلی (window.pipAPI در رندررِ پنجرهٔ اصلی)
 * @typedef {Object} PipAPI
 * @property {(source?: PipVideoSource)=>Promise<PipState>} show
 * @property {()=>Promise<PipState>} hide
 * @property {(source?: PipVideoSource)=>Promise<PipState>} toggle
 * @property {(position: PipPosition)=>Promise<PipState>} move
 * @property {(size: PipSize)=>Promise<PipState>} resize
 * @property {(value: number)=>Promise<PipState>} setOpacity
 * @property {(enabled: boolean)=>Promise<PipState>} setClickThrough
 * @property {(enabled: boolean)=>Promise<PipState>} setAlwaysOnTop
 * @property {()=>Promise<PipState>} reset
 * @property {()=>Promise<PipState>} getState
 * @property {()=>Promise<string>} clipboard
 */

if (typeof module !== 'undefined' && module.exports) module.exports = {};
