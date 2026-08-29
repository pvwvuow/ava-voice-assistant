/* ============================================================
   آوا — موتور تشخیص گفتار کاملاً آفلاین (Module Web Worker)
   Whisper-tiny کوانتیزه، باندل‌شده داخل خود برنامه:
   › بدون اینترنت، بدون فیلترشکن، بدون هیچ کلید API
   › مدل‌ها از ava://app/renderer/models/ سرو می‌شوند
   › WASM موتور ONNX هم از همان‌جا بارگذاری می‌شود (بدون CDN)
   نکته: این فایل ES-Module است و مستقیم از پوشه vendor برنامه
   import می‌کند (URL مطلق — چون Blob-Worker base-URL ندارد).
   ============================================================ */
'use strict';

/* گزارش خطای بوت با جزئیات — برای دیباگ */
self.onerror = (msg, src, line, col, err) => {
  try { self.postMessage({ type: 'boot-error', error: String((err && err.stack) || msg || 'unknown').slice(0, 300) }); } catch (_) { /* noop */ }
};

import { pipeline, env } from 'ava://app/renderer/vendor/transformers.min.js';

/* فقط مدل‌های داخل برنامه — هیچ درخواستی به هاگینگ‌فیس/CDN نمی‌رود */
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = 'ava://app/renderer/models/';
env.useBrowserCache = false; /* فایل‌ها همین‌جا لوکال‌اند؛ کش اضافی لازم نیست */

/* ONNX Runtime: SIMD + چندنخی (اگر SharedArrayBuffer در دسترس باشد) */
const HAS_SAB = typeof SharedArrayBuffer !== 'undefined';
const CORES = (self.navigator && self.navigator.hardwareConcurrency) || 2;
env.backends.onnx.wasm = Object.assign(env.backends.onnx.wasm || {}, {
  wasmPaths: 'ava://app/renderer/vendor/',
  numThreads: HAS_SAB ? Math.max(1, Math.min(4, CORES - 1)) : 1,
  simd: true,
  proxy: false,
});

const BUNDLED_MODEL = 'whisper-tiny';
let MODEL = BUNDLED_MODEL;
let asr = null;
let loading = null;

/* مدل‌های باکیفیت‌تر در اولین استفاده از هاب دانلود و در حافظه مرورگر کش می‌شوند؛
   اگر دانلود ممکن نشد (اینترنت/فیلترشکن)، خودکار به مدل داخلی باندل‌شده برمی‌گردیم. */
function useRemoteQuality(model) {
  if (model === BUNDLED_MODEL) return null;
  env.allowRemoteModels = true;
  env.useBrowserCache = true;
  return model === 'Xenova/whisper-small' ? 'Xenova/whisper-small' : 'Xenova/whisper-base';
}

async function ensurePipeline() {
  if (asr) return asr;
  if (!loading) {
    const opts = { quantized: true };
    /* پردازش قطعه‌ای درست صدا → پایداری بیشتر برای جمله‌های طولانی */
    opts.chunk_length_s = 30;
    opts.stride_length_s = 5;
    loading = pipeline('automatic-speech-recognition', MODEL, opts)
      .then((p) => { asr = p; return p; })
      .catch((e) => { loading = null; throw e; });
  }
  return loading;
}

async function loadModel(requested) {
  if (requested && requested !== MODEL) {
    MODEL = requested;
    asr = null;
    loading = null;
    if (requested === BUNDLED_MODEL) {
      /* بازگشت به مدل داخلی */
      env.allowRemoteModels = false;
      env.useBrowserCache = false;
    } else {
      useRemoteQuality(requested);
    }
  }
  try {
    await ensurePipeline();
    self.postMessage({ type: 'ready', model: MODEL });
  } catch (err) {
    if (MODEL !== BUNDLED_MODEL) {
      /* دانلود مدل بزرگ‌تر ممکن نشد → خودکار مدل داخلی */
      try { console.warn('[AVA ASR] fallback to bundled:', String((err && err.message) || err).slice(0, 140)); } catch (_) { /* noop */ }
      MODEL = BUNDLED_MODEL;
      asr = null;
      loading = null;
      env.allowRemoteModels = false;
      env.useBrowserCache = false;
      try {
        await ensurePipeline();
        self.postMessage({ type: 'ready', model: MODEL, fallback: true });
        return;
      } catch (err2) {
        self.postMessage({ type: 'loaderror', error: String((err2 && err2.message) || err2).slice(0, 180) });
        return;
      }
    }
    self.postMessage({ type: 'loaderror', error: String((err && err.message) || err).slice(0, 180) });
  }
}

function cleanText(t) {
  return String(t || '')
    .replace(/<\|[^|]*\|>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function recognize(id, pcm) {
  try {
    const p = await ensurePipeline();
    if (!pcm || pcm.length < 1600) { /* کمتر از ۰.۱ ثانیه */
      self.postMessage({ type: 'result', id, ok: false, error: 'صدای کافی ضبط نشد' });
      return;
    }
    let out = null;
    try {
      out = await p(pcm, { language: 'fa', task: 'transcribe' });
    } catch (_) {
      /* بعضی نسخه‌ها کد زبان را قبول نمی‌کنند → تشخیص خودکار زبان */
      out = await p(pcm, { task: 'transcribe' });
    }
    const text = cleanText(out && out.text);
    self.postMessage({ type: 'result', id, ok: !!text, text, error: text ? undefined : 'متنی تشخیص داده نشد — بلندتر و واضح‌تر حرف بزن' });
  } catch (e) {
    self.postMessage({ type: 'result', id, ok: false, error: String((e && e.message) || e).slice(0, 180) });
  }
}

self.onmessage = async (e) => {
  const d = e.data || {};
  if (d.type === 'load') {
    await loadModel(d.model);
    return;
  }
  if (d.type === 'recognize' && typeof d.id === 'number') {
    await recognize(d.id, d.pcm);
  }
};
