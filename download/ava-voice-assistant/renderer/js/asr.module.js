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

const MODEL = 'whisper-tiny';
let asr = null;
let loading = null;

async function ensurePipeline() {
  if (asr) return asr;
  if (!loading) {
    loading = pipeline('automatic-speech-recognition', MODEL, { quantized: true })
      .then((p) => { asr = p; return p; })
      .catch((e) => { loading = null; throw e; });
  }
  return loading;
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
    try {
      await ensurePipeline();
      self.postMessage({ type: 'ready', model: MODEL });
    } catch (err) {
      self.postMessage({ type: 'loaderror', error: String((err && err.message) || err).slice(0, 180) });
    }
    return;
  }
  if (d.type === 'recognize' && typeof d.id === 'number') {
    await recognize(d.id, d.pcm);
  }
};
