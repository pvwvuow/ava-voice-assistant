'use strict';
/* ============================================================
   آوا — widgetRenderer (v0.56) — منطق ویجت شناور بعد از ریورک
   ورودی‌ها از main:
     widget:update → {state, user, reply}   state: idle|listening|processing|speaking
     widget:look   → {size, opacity, locked, showTexts}
   کنترل کاربر:
     دابل‌کلیک اورب → باز شدن برنامه | نوار ابزار (میک/چت/منو) | راست‌کلیک → منو
   متن‌ها ۹ ثانیه بعد از آخرین ردوبدل محو می‌شوند؛ hint فقط ۶ ثانیهٔ اول.
   ============================================================ */
(function () {
  const body = document.body;
  const texts = document.getElementById('texts');
  const lineUser = document.getElementById('lineUser');
  const lineAva = document.getElementById('lineAva');
  const txtUser = document.getElementById('txtUser');
  const txtAva = document.getElementById('txtAva');
  const orb = document.getElementById('orb');
  const tools = document.getElementById('tools');
  const hint = document.getElementById('hint');

  let fadeTimer = 0;

  function setLine(el, txtEl, text) {
    const t = String(text == null ? '' : text).trim();
    if (!t) { el.hidden = true; return; }
    txtEl.textContent = t.length > 180 ? t.slice(0, 177) + '…' : t;
    el.hidden = false;
  }
  function showTexts() {
    if (body.classList.contains('hide-texts')) return;
    const any = !lineUser.hidden || !lineAva.hidden;
    texts.classList.toggle('show', any);
    if (any) {
      if (fadeTimer) clearTimeout(fadeTimer);
      fadeTimer = setTimeout(hideTexts, 9000);
    }
  }
  function hideTexts() { texts.classList.remove('show'); }

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

  /* ترجیحات ظاهری از main (v0.56 — اندازه/شفافیت/قفل/متن‌ها) */
  function applyLook(l) {
    l = l || {};
    if (l.size) {
      body.classList.remove('size-s', 'size-m', 'size-l');
      body.classList.add('size-' + (['s', 'm', 'l'].includes(l.size) ? l.size : 'm'));
    }
    if ('opacity' in l) body.style.setProperty('--op', String(Math.max(0.35, Math.min(1, Number(l.opacity) || 1))));
    body.classList.toggle('locked', !!l.locked);
    body.classList.toggle('hide-texts', l.showTexts === false);
    if (l.showTexts === false) hideTexts(); else showTexts();
  }

  /* پل با پروسهٔ اصلی — preload ویجت (AVAWidget) */
  try {
    if (window.AVAWidget && window.AVAWidget.onUpdate) window.AVAWidget.onUpdate((p) => { try { apply(p); } catch (_) { /* noop */ } });
    if (window.AVAWidget && window.AVAWidget.onLook) window.AVAWidget.onLook((l) => { try { applyLook(l); } catch (_) { /* noop */ } });
  } catch (_) { /* noop */ }

  if (orb) {
    orb.addEventListener('dblclick', () => {
      try { window.AVAWidget.openMain(); } catch (_) { /* noop */ }
    });
    orb.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      try { window.AVAWidget.menu(); } catch (_) { /* noop */ }
    });
  }
  if (tools) {
    tools.addEventListener('click', (e) => {
      const b = e.target && e.target.closest ? e.target.closest('button[data-act]') : null;
      if (!b) return;
      e.stopPropagation();
      const act = b.getAttribute('data-act');
      try {
        if (act === 'menu') window.AVAWidget.menu();
        else window.AVAWidget.act(act); /* listen | chat */
      } catch (_) { /* noop */ }
    });
  }
  if (hint) {
    hint.textContent = (navigator.language || 'fa').toLowerCase().startsWith('en')
      ? 'Double-click = open Ava' : 'دابل‌کلیک = باز کردن آوا';
    /* v0.56 — hint فقط ۶ ثانیهٔ اول؛ بعدش ظاهر تمیز می‌ماند */
    setTimeout(() => { try { hint.classList.add('gone'); } catch (_) { /* noop */ } }, 6000);
  }
})();
