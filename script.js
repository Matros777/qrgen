/* ===== QRGen — логика генерации QR ===== */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const input    = $('qr-input');
  const sizeSel  = $('qr-size');
  const ecSel    = $('qr-ec');
  const qrDark   = $('qr-dark');
  const qrLight  = $('qr-light');
  const qrTrans  = $('qr-transparent');
  const genBtn   = $('gen-btn');
  const dlBtn    = $('dl-btn');
  const hint     = $('hint');
  const qrBox    = $('qr-box');
  const qrAd     = $('qr-ad');
  const qrWrap   = $('qr-canvas-wrap');
  const metaType = $('meta-type');
  const metaCont = $('meta-content');
  const metaSize = $('meta-size');

  /** Показать подсказку */
  function setHint(text, kind) {
    hint.textContent = text;
    hint.className = 'hint' + (kind ? ' ' + kind : '');
  }

  /** Показать рекламу, спрятать QR */
  function showAd() {
    qrAd.style.display = '';
    qrWrap.style.display = 'none';
    qrWrap.innerHTML = '';
  }

  /** Показать QR, спрятать рекламу */
  function showQr() {
    qrAd.style.display = 'none';
    qrWrap.style.display = '';
  }

  /** Определить тип ввода */
  function detectType(value) {
    const v = value.trim();
    if (/^https?:\/\//i.test(v)) return 'Ссылка (URL)';
    if (/^mailto:/i.test(v))    return 'E-mail';
    if (/^tel:/i.test(v))       return 'Телефон';
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'E-mail (текст)';
    return 'Текст';
  }

  /** Сгенерировать QR */
  function generate() {
    const value = input.value;

    if (!value || !value.trim()) {
      setHint('Введи ссылку или текст.', 'error');
      input.focus();
      showAd();
      dlBtn.disabled = true;
      return;
    }

    if (typeof QRCode === 'undefined') {
      setHint('QR-библиотека не загрузилась (qrcode.min.js).', 'error');
      return;
    }

    const size = parseInt(sizeSel.value, 10) || 320;
    const ec   = ecSel.value || 'M';

    // Цвета: код (тёмный) и фон (светлый).
    // Прозрачный фон по умолчанию: светлый слой рисуется с альфой 0 (#ffffff00),
    // а поле .qr-box не заливается — страница просвечивает.
    const transparent = qrTrans.checked;
    const dark  = qrDark.value  || '#000000';
    const light = transparent ? '#ffffff00' : (qrLight.value || '#ffffff');
    qrBox.style.background = transparent ? 'transparent' : light;

    // Готовим canvas в скрытой обёртке
    qrWrap.innerHTML = '';
    const canvas = document.createElement('canvas');
    qrWrap.appendChild(canvas);

    try {
      QRCode.toCanvas(
        canvas,
        value,               // <-- РОВНО то, что введено
        {
          width: Math.min(size, 340 - 32), // вписываем в qr-box
          margin: 2,
          errorCorrectionLevel: ec,
          color: { dark: dark, light: light }
        },
        (err) => {
          if (err) {
            showAd();
            setHint('Ошибка генерации: ' + err.message, 'error');
            dlBtn.disabled = true;
            return;
          }

          showQr();
          dlBtn.disabled = false;

          metaType.textContent = detectType(value);
          metaCont.textContent = value;
          metaSize.textContent = size + ' × ' + size + ' px · EC ' + ec +
                                (transparent ? ' · фон прозрачный' : ' · фон ' + light);

          setHint('QR готов. Проверь содержимое справа.', 'ok');
        }
      );
    } catch (e) {
      showAd();
      setHint('Ошибка: ' + e.message, 'error');
      dlBtn.disabled = true;
    }
  }

  /** Скачать PNG */
  function download() {
    const canvas = qrWrap.querySelector('canvas');
    if (!canvas) {
      setHint('Сначала сгенерируй QR.', 'error');
      return;
    }
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qr-' + Date.now() + '.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /** Сброс к рекламе (если поле опустело) */
  input.addEventListener('input', () => {
    if (!input.value.trim()) {
      showAd();
      dlBtn.disabled = true;
      metaType.textContent = '—';
      metaCont.textContent = '—';
      metaSize.textContent = '—';
      setHint('Введи данные и нажми «Сгенерировать QR» (или Ctrl+Enter).');
    }
  });

  // События
  genBtn.addEventListener('click', generate);
  dlBtn.addEventListener('click', download);

  // Ctrl+Enter в textarea — генерация
  input.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      generate();
    }
  });

  // Автогенерация при смене размера/коррекции/цветов, если QR уже есть
  sizeSel.addEventListener('change', () => { if (qrWrap.querySelector('canvas')) generate(); });
  ecSel.addEventListener('change',   () => { if (qrWrap.querySelector('canvas')) generate(); });
  [qrDark, qrLight].forEach((el) => {
    el.addEventListener('input',  () => { if (qrWrap.querySelector('canvas')) generate(); });
    el.addEventListener('change', () => { if (qrWrap.querySelector('canvas')) generate(); });
  });
  qrTrans.addEventListener('change', () => {
    // при включённой прозрачности поле не заливается
    qrBox.style.background = qrTrans.checked ? 'transparent' : (qrLight.value || '#ffffff');
    if (qrWrap.querySelector('canvas')) generate();
  });

  // Год в подвале
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Старт: показываем рекламу
  showAd();
  setHint('Введи данные и нажми «Сгенерировать QR» (или Ctrl+Enter).');
})();
