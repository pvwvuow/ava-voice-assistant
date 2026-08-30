/* تست آفلاین مدل whisper-tiny باندل‌شده برای آوا
   ۱) بارگذاری کامل از پوشه renderer/models (بدون شبکه)
   ۲) اجرای تشخیص روی نمونه سینتاتیکی (سکوت + تون) */
const path = require('path');

const tfx = require('/home/z/my-project/scripts/vosk-test/node_modules/@xenova/transformers');
const { pipeline, env } = tfx;

(async () => {
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  env.localModelPath = '/home/z/my-project/download/ava-voice-assistant/renderer/models/';
  if (env.backends && env.backends.onnx && env.backends.onnx.wasm) {
    env.backends.onnx.wasm.numThreads = 1;
  }
  console.log('[1] loading pipeline from', env.localModelPath + 'whisper-tiny ...');
  const t0 = Date.now();
  const asr = await pipeline('automatic-speech-recognition', 'whisper-tiny', { quantized: true });
  console.log('[2] pipeline loaded in', Date.now() - t0, 'ms');

  /* ۳ ثانیه سکوت + تون ملایم — باید بدون کرش متن (احتمالاً خالی/تکراری) بدهد */
  const pcm = new Float32Array(16000 * 3);
  for (let i = 0; i < pcm.length; i++) {
    pcm[i] = 0.04 * Math.sin((2 * Math.PI * 220 * i) / 16000) * Math.max(0, Math.sin((2 * Math.PI * 1.2 * i) / 16000));
  }
  const t1 = Date.now();
  const out = await asr(pcm, { language: 'fa', task: 'transcribe' });
  console.log('[3] inference done in', Date.now() - t1, 'ms → text:', JSON.stringify((out && out.text || '').trim().slice(0, 80)));
  console.log('MODEL TEST OK');
  process.exit(0);
})().catch((e) => {
  console.error('MODEL TEST FAILED:', e && (e.stack || e.message || e));
  process.exit(1);
});
