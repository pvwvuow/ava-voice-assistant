'use strict';
/* ============================================================
   آوا — widgetRenderer (v0.55) — منطق ویجت شناور
   پیام‌ها از main (widget:update): {state, user, reply}
   حالت‌ها: idle | listening (هالهٔ سبز) | processing | speaking
   متن‌ها ۹ ثانیه بعد از آخرین ردوبدل محو می‌شوند.
   دابل‌کلیک حباب → باز شدن پنجرهٔ اصلی.
   ============================================================ */
(function () {
  const body = document.body;
  const texts = document.getElementById('texts');
  const lineUser = document.getElementById('lineUser');
  const lineAva = document.getElementById('lineAva');
  const txtUser = document.getElementById('txtUser');
  const txtAva = document.getElementById('txtAva');
  const bubble = document.getElementById('bubble');
  const hint = document.getElementById('hint');

  let fadeTimer = 0;

  function setLine(el, txtEl, text) {
    const t = String(text == null ? '' : text).trim();
    if (!t) { el.hidden = true; return; }
    txtEl.textContent = t.length > 180 ? t.slice(0, 177) + '…' : t;
    el.hidden = false;
  }
  function showTexts() {
    const any = !lineUser.hidden || !lineAva.hidden;
    texts.classList.toggle('show', any);
    if (any) {
      if (fadeTimer) clearTimeout(fadeTimer);
      fadeTimer = setTimeout(hideTexts, 9000);
    }
  }
  function hideTexts() {
    texts.classList.remove('show');
  }

  function apply(p) {
    p = p || {};
    const st = String(p.state || '').trim();
    if (st) {
      body.classList.remove('listening', 'processing', 'speaking', 'idle');
      body.classList.add(['listening', 'processing', 'speaking', 'idle'].includes(st) ? st : 'idle');
    }
    if ('user' in p) setLine(lineUser, txtUser, p.user);
    if ('reply' in p) setLine(lineAva, txtAva, p.reply);
    showTexts();
  }

  /* پل با پروسهٔ اصلی — preload ویجت (AVAWidget) */
  try {
    if (window.AVAWidget && window.AVAWidget.onUpdate) window.AVAWidget.onUpdate((p) => { try { apply(p); } catch (_) { /* noop */ } });
  } catch (_) { /* noop */ }

  if (bubble) {
    bubble.addEventListener('dblclick', () => {
      try { window.AVAWidget.openMain(); } catch (_) { /* noop */ }
    });
  }
  if (hint) {
    hint.textContent = (navigator.language || 'fa').toLowerCase().startsWith('en')
      ? 'Double-click = open Ava' : 'دابل‌کلیک = باز کردن آوا';
  }
})();
