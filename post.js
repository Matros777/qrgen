/* ===== QRGen — страница «Пост с QR»: изображение → QR-код → подпись ===== */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  // ---------- Элементы ----------
  const drop       = $('drop');
  const fileInput  = $('img-file');
  const pickBtn    = $('pick-btn');
  const dropPrev   = $('drop-preview');
  const urlInput   = $('post-url');
  const qrValue    = $('qr-value');
  const caption    = $('caption');
  const fitSel     = $('fit');
  const alignSel   = $('align');
  const bgInput    = $('bg');
  const fgInput    = $('fg');
  const qrDark     = $('qr-dark');
  const qrLight    = $('qr-light');
  const makeBtn    = $('make-btn');
  const dlBtn      = $('dl-btn');
  const hint       = $('hint');
  const canvas     = $('canvas');
  const placeholder = $('placeholder');
  const metaFormat = $('meta-format');
  const metaLayout = $('meta-layout');
  const metaQr     = $('meta-qr');
  const metaCap    = $('meta-caption');

  // ---------- Форматы (стандартные соотношения сторон) ----------
  const FORMATS = {
    '16:9': { w: 1280, h: 720 },
    '9:16': { w: 1080, h: 1920 },
    '1:1':  { w: 1080, h: 1080 }
  };
  let currentFormat = '1:1';

  // ---------- Состояние ----------
  let sourceImage = null;   // HTMLImageElement с загруженной картинкой
  let sourceName  = 'image';

  // ---------- Утилиты ----------
  function setHint(text, kind) {
    hint.textContent = text;
    hint.className = 'hint' + (kind ? ' ' + kind : '');
  }

  function showThumb() {
    if (!sourceImage) { dropPrev.style.display = 'none'; return; }
    dropPrev.src = sourceImage.src;
    dropPrev.style.display = 'block';
  }

  /** Загрузка картинки из URL-строки (через fetch, чтобы был CORS) */
  function loadFromUrl(url) {
    const clean = url.trim();
    if (!clean) return;

    setHint('Загружаю картинку по ссылке...');
    fetch(clean, { mode: 'cors', cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
      .then((blob) => {
        if (blob && /^image\//.test(blob.type)) throw new Error('not image');
        const finalUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(finalUrl);
          sourceImage = img;
          sourceName = (() => {
            try { return new URL(clean).pathname.split('/').pop() || 'image'; }
            catch (e) { return 'image'; }
          })();
          showThumb();
          drop.classList.add('has-image');
          setHint('Картинка загружена. Нажми «Собрать картинку».', 'ok');
          render();
        };
        img.onerror = () => {
          URL.revokeObjectURL(finalUrl);
          setHint('Не удалось открыть картинку по ссылке (CORS). Скачай её и загрузи файлом.', 'error');
        };
        img.src = finalUrl;
      })
      .catch(() => {
        setHint('Ссылка не даёт доступ к картинке (CORS). Скачай её и загрузи файлом.', 'error');
      });
  }

  /** Загрузка картинки из файла (drag&drop или выбор) */
  function loadFromFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      setHint('Это не картинка. Нужен файл изображения.', 'error');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setHint('Файл больше 15 МБ — возьми поменьше.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        sourceImage = img;
        sourceName = (file.name || 'image').replace(/\.[^.]+$/, '');
        showThumb();
        drop.classList.add('has-image');
        setHint('Картинка загружена. Нажми «Собрать картинку».', 'ok');
        render();
      };
      img.onerror = () => setHint('Браузер не смог прочитать файл.', 'error');
      img.src = reader.result;
    };
    reader.onerror = () => setHint('Не удалось прочитать файл.', 'error');
    reader.readAsDataURL(file);
  }

  /** Перенос текста по ширине */
  function wrapText(ctx, text, maxWidth) {
    const out = [];
    text.split('\n').forEach((paragraph) => {
      const words = paragraph.split(/\s+/).filter(Boolean);
      if (!words.length) { out.push(''); return; }
      let line = words[0];
      for (let i = 1; i < words.length; i++) {
        const test = line + ' ' + words[i];
        if (ctx.measureText(test).width > maxWidth && line) { out.push(line); line = words[i]; }
        else { line = test; }
      }
      out.push(line);
    });
    return out.length ? out : [''];
  }

  /** Нарисовать QR-код в offscreen-canvas и вернуть ready-изображение */
  function renderQr(text, size, dark, light) {
    const off = document.createElement('canvas');
    off.width = size;
    off.height = size;

    const tmp = document.createElement('canvas');
    return new Promise((resolve, reject) => {
      try {
        QRCode.toCanvas(
          tmp,
          text,
          { width: size, margin: 2, errorCorrectionLevel: 'M', color: { dark: dark, light: light } },
          (err) => {
            if (err) { reject(err); return; }
            const c = off.getContext('2d');
            c.fillStyle = light;
            c.fillRect(0, 0, size, size);
            c.drawImage(tmp, 0, 0, size, size);
            resolve(off);
          }
        );
      } catch (e) { reject(e); }
    });
  }

  // ---------- Сборка картинки ----------
  async function render() {
    if (!sourceImage) {
      placeholder.style.display = '';
      dlBtn.disabled = true;
      return;
    }
    if (typeof QRCode === 'undefined') {
      setHint('QR-библиотека не загрузилась (qrcode.min.js).', 'error');
      return;
    }

    const fmt = FORMATS[currentFormat];
    const W = fmt.w, H = fmt.h;
    const unit = Math.min(W, H);
    const ctx = canvas.getContext('2d');

    const value = qrValue.value.trim();
    const capText = caption.value.trim();
    const fit = fitSel.value;
    const align = alignSel.value;
    const bg = bgInput.value;
    const fg = fgInput.value;
    const dark = qrDark.value;
    const light = qrLight.value;

    // Отключаем кнопку на время сборки
    makeBtn.disabled = true;
    dlBtn.disabled = true;

    const natW = sourceImage.naturalWidth  || 1;
    const natH = sourceImage.naturalHeight || 1;

    /* ================================================================
       РЕЖИМ «БЕЗ ПОЛЕЙ»
       Картинка — во всю ширину холста, пропорции сохраняются.
       QR — квадрат во всю ширину, строго под картинкой.
       Текст — под QR.
       Высота холста считается автоматически.
       ================================================================ */
    if (fit === 'full') {
      const W        = fmt.w;                     // фиксированная ширина холста
      const imgH     = Math.round(W * (natH / natW)); // высота картинки по её пропорциям
      const qrSize   = W;                         // QR — квадрат во всю ширину
      const gap1     = Math.round(W * 0.015);     // картинка → QR
      const gap2     = capText ? Math.round(W * 0.022) : 0; // QR → текст
      const sidePad  = Math.round(W * 0.045);     // боковые поля ТОЛЬКО у текста
      const botPad   = capText ? 0 : Math.round(W * 0.02);
      const maxTextW = W - sidePad * 2;

      let fontSize = Math.round(W * 0.038);
      let lines = [], lineH = 0, textH = 0;

      // Подгоняем шрифт, чтобы картинка не уехала за разумный предел
      for (let i = 0; i < 8; i++) {
        ctx.font = '700 ' + fontSize + 'px "Segoe UI", system-ui, sans-serif';
        lines  = capText ? wrapText(ctx, capText, maxTextW) : [];
        lineH  = Math.round(fontSize * 1.32);
        textH  = lines.length * lineH;
        const total = imgH + gap1 + qrSize + gap2 + textH;
        if (total <= 4000 || fontSize <= 14) break;
        fontSize = Math.max(14, Math.round(fontSize * 0.92));
      }

      const totalH = imgH + gap1 + qrSize + gap2 + textH + botPad;

      canvas.width  = W;
      canvas.height = totalH;

      // Фон — только заполнитель промежутков между блоками
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, totalH);

      // Картинка — во всю ширину, без полей, пропорции сохранены
      ctx.drawImage(sourceImage, 0, 0, W, imgH);

      // QR — квадрат во всю ширину, строго под картинкой
      const qrY = imgH + gap1;
      try {
        const qrCanvas = await renderQr(value || ' ', qrSize, dark, light);
        ctx.drawImage(qrCanvas, 0, qrY, qrSize, qrSize);
      } catch (e) {
        makeBtn.disabled = false;
        setHint('Ошибка генерации QR: ' + (e && e.message ? e.message : e), 'error');
        return;
      }

      // Текст — под QR
      if (capText) {
        const textTop = qrY + qrSize + gap2;
        ctx.fillStyle  = fg;
        ctx.textBaseline = 'top';
        ctx.textAlign  = align;
        const tx = align === 'left' ? sidePad : align === 'right' ? W - sidePad : W / 2;
        ctx.font = '700 ' + fontSize + 'px "Segoe UI", system-ui, sans-serif';
        lines.forEach((line, i) => {
          if (line) ctx.fillText(line, tx, textTop + i * lineH, maxTextW);
        });
      }

      placeholder.style.display = 'none';
      canvas.style.display = '';

      metaFormat.textContent = currentFormat + ' · ' + W + ' × ' + totalH + ' px (без полей)';
      metaLayout.textContent = 'Картинка ' + W + '×' + imgH + ' (пропорции сохранены)' +
                               ' · QR ' + qrSize + '×' + qrSize +
                               (lines.length ? ' · ' + lines.length + ' стр. подписи' : ' · без подписи');
      metaQr.textContent  = value || '—';
      metaCap.textContent = capText || '—';

      dlBtn.disabled = false;
      makeBtn.disabled = false;
      setHint('Готово: картинка во всю ширину, QR квадратом под ней, текст внизу.', 'ok');
      return;
    }

    /* ================================================================
       ОБЫЧНЫЙ РЕЖИМ — холст фиксированного размера формата
       ================================================================ */
    const pad     = Math.round(unit * 0.045);
    const qrSize  = Math.round(unit * 0.26);
    const qrPad   = Math.round(qrSize * 0.12);
    const qrBox   = qrSize + qrPad * 2;
    const gap1    = Math.round(unit * 0.035);   // картинка → QR
    const gap2    = capText ? Math.round(unit * 0.03) : 0; // QR → текст

    // Подбираем размер шрифта так, чтобы всё влезло
    const maxTextW = W - pad * 2;
    let fontSize = Math.round(unit * 0.042);
    let lines = [];
    let textH = 0;
    let imgH = 0;

    for (let attempt = 0; attempt < 8; attempt++) {
      ctx.font = '700 ' + fontSize + 'px "Segoe UI", system-ui, sans-serif';
      lines = capText ? wrapText(ctx, capText, maxTextW) : [];
      textH = lines.length * Math.round(fontSize * 1.32);
      imgH = H - pad * 2 - qrBox - gap1 - gap2 - textH;

      if (imgH >= Math.round(unit * 0.25) || fontSize <= 14) break;

      // Не влезает — уменьшаем шрифт и пробуем снова
      fontSize = Math.max(14, Math.round(fontSize * 0.92));
    }

    if (imgH < 40) {
      setHint('Не хватает места: сократи текст подписи.', 'error');
      makeBtn.disabled = false;
      return;
    }

    // --- Рисуем ---
    canvas.width = W;
    canvas.height = H;

    // Фон
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Изображение (сверху)
    const imgX = 0;
    const imgY = pad;
    const imgW = W;
    const imgHReal = imgH;

    if (fit === 'cover') {
      // Заполнить: обрезаем по меньшей стороне
      const scale = Math.max(imgW / sourceImage.naturalWidth, imgHReal / sourceImage.naturalHeight);
      const dw = sourceImage.naturalWidth * scale;
      const dh = sourceImage.naturalHeight * scale;
      ctx.save();
      ctx.beginPath();
      ctx.rect(imgX, imgY, imgW, imgHReal);
      ctx.clip();
      ctx.drawImage(sourceImage, imgX + (imgW - dw) / 2, imgY + (imgHReal - dh) / 2, dw, dh);
      ctx.restore();
    } else {
      // Целиком: вписываем с полями
      const scale = Math.min(imgW / sourceImage.naturalWidth, imgHReal / sourceImage.naturalHeight);
      const dw = sourceImage.naturalWidth * scale;
      const dh = sourceImage.naturalHeight * scale;
      ctx.save();
      ctx.beginPath();
      ctx.rect(imgX, imgY, imgW, imgHReal);
      ctx.clip();
      ctx.drawImage(sourceImage, imgX + (imgW - dw) / 2, imgY + (imgHReal - dh) / 2, dw, dh);
      ctx.restore();
    }

    // QR-код (строго под изображением)
    const qrX = Math.round((W - qrBox) / 2);
    const qrY = imgY + imgHReal + gap1;

    try {
      const qrCanvas = await renderQr(value || ' ', qrSize, dark, light);
      ctx.drawImage(qrCanvas, qrX, qrY + qrPad, qrSize, qrSize);
    } catch (e) {
      makeBtn.disabled = false;
      setHint('Ошибка генерации QR: ' + (e && e.message ? e.message : e), 'error');
      return;
    }

    // Текст (под QR-кодом)
    if (capText) {
      const lineH = Math.round(fontSize * 1.32);
      const textTop = qrY + qrBox + gap2;
      ctx.fillStyle = fg;
      ctx.textBaseline = 'top';
      ctx.textAlign = align;
      const tx = align === 'left' ? pad : align === 'right' ? W - pad : W / 2;
      ctx.font = '700 ' + fontSize + 'px "Segoe UI", system-ui, sans-serif';
      lines.forEach((line, i) => {
        if (line) ctx.fillText(line, tx, textTop + i * lineH, maxTextW);
      });
    }

    // Превью показано
    placeholder.style.display = 'none';
    canvas.style.display = '';

    // Метаданные
    metaFormat.textContent = currentFormat + ' · ' + W + ' × ' + H + ' px';
    metaLayout.textContent = 'Картинка ' + Math.round(imgW) + '×' + Math.round(imgHReal) +
                            ' · QR ' + qrSize + ' px' +
                            (lines.length ? ' · ' + lines.length + ' стр. подписи' : ' · без подписи');
    metaQr.textContent = value || '—';
    metaCap.textContent = capText || '—';

    dlBtn.disabled = false;
    makeBtn.disabled = false;
    setHint('Готово. Можно скачивать PNG.', 'ok');
  }

  // ---------- Скачать PNG ----------
  function download() {
    if (dlBtn.disabled) {
      setHint('Сначала собери картинку.', 'error');
      return;
    }
    dlBtn.disabled = true;
    canvas.toBlob((blob) => {
      dlBtn.disabled = false;
      if (!blob) { setHint('Браузер не смог собрать PNG.', 'error'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'qr-post-' + currentFormat.replace(':', 'x') + '-' + Date.now() + '.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      setHint('Файл сохранён.', 'ok');
    }, 'image/png');
  }

  // ---------- Загрузка: файл ----------
  pickBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
  drop.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) loadFromFile(fileInput.files[0]);
  });

  ['dragenter', 'dragover'].forEach((ev) => {
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-drag'); });
  });
  ['dragleave', 'drop'].forEach((ev) => {
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-drag'); });
  });
  drop.addEventListener('drop', (e) => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadFromFile(f);
  });

  // ---------- Загрузка: URL ----------
  let urlTimer = null;
  urlInput.addEventListener('input', () => {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => loadFromUrl(urlInput.value), 700);
  });

  // ---------- Формат ----------
  const fmtButtons = document.querySelectorAll('#format-group .seg');
  fmtButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      fmtButtons.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      currentFormat = btn.dataset.fmt;
      render();
    });
  });

  // ---------- Авто-пересборка ----------
  [qrValue, caption].forEach((el) => el.addEventListener('input', () => {
    clearTimeout(el._t);
    el._t = setTimeout(() => { if (sourceImage) render(); }, 350);
  }));

  [fitSel, alignSel, bgInput, fgInput, qrDark, qrLight].forEach((el) => {
    el.addEventListener('input', () => { if (sourceImage) render(); });
    el.addEventListener('change', () => { if (sourceImage) render(); });
  });

  // ---------- Кнопки ----------
  makeBtn.addEventListener('click', render);
  dlBtn.addEventListener('click', download);

  // Ctrl+Enter в подписи — пересборка
  caption.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); render(); }
  });

  // ---------- Старт ----------
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  canvas.style.display = 'none';
  metaFormat.textContent = currentFormat + ' · ' + FORMATS[currentFormat].w + ' × ' + FORMATS[currentFormat].h + ' px';
  setHint('Загрузи картинку — и нажми «Собрать картинку».');
})();