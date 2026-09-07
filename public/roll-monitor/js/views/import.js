/* =========================================================================
   views/import.js — نما ورود داده‌ها (§10-§12، §89)
   -------------------------------------------------------------------------
   فرایند: انتخاب/رهاکردن فایل → تجزیه → گزارشنمای اعتبارسنجی (§11)
   → تأیید جایگزینی با آمار قدیم/جدید (§89) → ذخیرهٔ تراکنشی → رفرش کل.
   ========================================================================= */

'use strict';

(function () {
  const U = RM.utils;
  const UI = RM.ui;
  const Import = RM.importEngine;
  const db = RM.db.db;

  const ImportView = {};

  /* ---------------- راه‌اندازی رویدادها ---------------- */

  ImportView.init = function () {
    for (const key of Object.keys(RM.config.IMPORT_TARGETS)) {
      const dropzone = document.getElementById(`drop-${key}`);
      const input = document.getElementById(`file-${key}`);

      // کلیک یا کیبورد → باز کردن پنجرهٔ انتخاب فایل
      dropzone.addEventListener('click', () => input.click());
      dropzone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          input.click();
        }
      });

      // انتخاب فایل
      input.addEventListener('change', () => {
        if (input.files && input.files[0]) {
          ImportView.handleFile(key, input.files[0]);
          input.value = '';
        }
      });

      // کشیدن و رهاکردن
      ['dragenter', 'dragover'].forEach((evt) => {
        dropzone.addEventListener(evt, (e) => {
          e.preventDefault();
          dropzone.classList.add('dragover');
        });
      });
      ['dragleave', 'drop'].forEach((evt) => {
        dropzone.addEventListener(evt, (e) => {
          e.preventDefault();
          dropzone.classList.remove('dragover');
        });
      });
      dropzone.addEventListener('drop', (e) => {
        const file = e.dataTransfer?.files?.[0];
        if (file) ImportView.handleFile(key, file);
      });
    }
  };

  /* ---------------- فرایند Import یک فایل ---------------- */

  ImportView.handleFile = async function (targetKey, file) {
    const dropzone = document.getElementById(`drop-${targetKey}`);
    dropzone.classList.add('loading');

    try {
      // اجرای فرایند کامل Import با تأیید جایگزینی (§89)
      const result = await Import.run(targetKey, file, { confirm: UI.confirm });

      if (result.cancelled) {
        UI.toast('عملیات Import لغو شد؛ داده‌های قبلی دست‌نخورده باقی ماند.', 'info');
        return;
      }

      const { parsed, datasetVersion, sameFileWarning } = result;

      // اعلان موفقیت
      UI.toast(
        `فایل «${U.escapeHtml(parsed.fileName)}» وارد شد — ${U.faNum(parsed.totalRecords)} رکورد ` +
        `(Dataset #${U.faNum(datasetVersion)})`,
        'success'
      );
      if (sameFileWarning) {
        UI.toast('محتوای فایل با آخرین Import یکسان بود (هش یکسان).', 'warning', 6000);
      }

      // رفرش کل سیستم (محاسبات + همهٔ نماها — §90)
      await RM.refreshAll();

      // رندر کارت همان هدف با گزارشنما
      await ImportView.renderCard(targetKey);
    } catch (err) {
      // مدیریت خطا (§72) — پیام دقیق بدون جزئیات فنی
      console.error('[Import]', err.message);
      UI.toast(U.escapeHtml(err.message || 'خطای ناشناخته هنگام خواندن فایل.'), 'error', 7000);

      // نمایش خطا در کارت وضعیت
      const statusEl = document.getElementById(`status-${targetKey}`);
      if (statusEl) {
        statusEl.className = 'import-status err';
        statusEl.innerHTML = `<div class="status-row"><span class="status-icon err">${UI.icons.cross}</span>
          <b>${U.escapeHtml(err.message)}</b></div>`;
      }
    } finally {
      dropzone.classList.remove('loading');
    }
  };

  /* ---------------- رندر کارت Import (متادیتا + گزارشنما §11-§12) ---------------- */

  ImportView.renderCard = async function (targetKey) {
    const statusEl = document.getElementById(`status-${targetKey}`);
    const previewWrap = document.getElementById(`preview-wrap-${targetKey}`);
    const table = RM.config.IMPORT_TARGETS[targetKey].table;

    const entries = await db.importMetadata
      .where('target').equals(targetKey)
      .reverse()
      .sortBy('importedAt');
    const info = entries[0];

    if (!info) {
      statusEl.className = 'import-status';
      statusEl.innerHTML = '<p class="status-empty">هنوز فایلی بارگذاری نشده است.</p>';
      previewWrap.hidden = true;
      return;
    }

    // ------- گزارشنمای اعتبارسنجی (§11) — موارد مشکل‌دار قابل کلیک -------
    const issues = info.issues || { width: 0, length: 0, thickness: 0, setupNumber: 0, rollNumber: 0, filmType: 0 };
    const label = RM.config.DATASET_LABELS[targetKey];

    /** سطر گزارسنما: اگر مقدار > 0 باشد قابل کلیک است (Drill-down همان رکوردها) */
    const row = (issueKey, labelTxt, value, warn) => {
      const content = warn
        ? `<span class="status-icon err">${UI.icons.warning}</span>${labelTxt}: <b class="num-warn">${U.faNum(value)}</b>`
        : `<span class="status-icon ok">${UI.icons.check}</span>${labelTxt}: <span class="num">${U.faNum(value)}</span>`;
      return warn
        ? `<button type="button" class="status-row status-row-link" data-drill-issue="${issueKey}"
             title="نمایش دقیق همین رکوردهای مشکل‌دار">${content} <span class="drill-hint">مشاهده ←</span></button>`
        : `<div class="status-row">${content}</div>`;
    };

    // Mapping ناقص — فیلدهای تنظیم‌شدهٔ کاربر که در فایل نبوده‌اند
    const gaps = Array.isArray(info.mappingGaps) ? info.mappingGaps : [];
    const gapsHtml = gaps.length
      ? `<div class="status-row"><span class="status-icon err">${UI.icons.warning}</span>
           <span class="num-warn">Mapping ناقص:</span>
           ${gaps.map((g) => RM.config.FIELD_LABELS[g.field] || g.field).join('، ')} — ستون در فایل یافت نشد
         </div>`
      : '';

    statusEl.className = 'import-status ok';
    statusEl.innerHTML = `
      <div class="status-row">
        <span class="status-icon ok">${UI.icons.check}</span>
        <b>${U.escapeHtml(info.fileName)}</b>
        <span class="chip">${label}</span>
        <span class="chip">Dataset #${U.faNum(info.datasetVersion)}</span>
        <span class="chip chip-ok">وضعیت: ${info.status === 'ok' ? 'موفق' : (info.status || '—')}</span>
        ${info.fileHash ? `<span class="chip" title="هش فایل">#${U.escapeHtml(info.fileHash)}</span>` : ''}
      </div>
      <div class="report-grid">
        ${row('total', 'کل رکوردها', info.totalRecords, false)}
        ${targetKey === 'rolls' ? row('raw', 'رول خام شناسایی‌شده', info.rawRolls, false) : ''}
        ${targetKey === 'archived' ? row('unique', 'متالایز یونیک', info.rawRolls, false) : ''}
        ${row('width', 'بدون عرض', issues.width || 0, (issues.width || 0) > 0)}
        ${row('length', 'بدون متراژ', issues.length || 0, (issues.length || 0) > 0)}
        ${row('thickness', 'بدون ضخامت', issues.thickness || 0, (issues.thickness || 0) > 0)}
        ${(issues.rollNumber || 0) > 0 ? row('rollNumber', 'بدون شماره رول', issues.rollNumber, true) : ''}
        ${(issues.filmType || 0) > 0 ? row('filmType', 'نوع فیلم خالی', issues.filmType, true) : ''}
      </div>
      ${gapsHtml}
      <div class="status-row muted">تاریخ: ${U.faDate(info.importedAt)} · شییت: ${U.escapeHtml(info.sheetName || '—')}</div>
    `;

    // ------- Drill-down: کلیک روی مشکل → دقیقاً همان رکوردهای عامل -------
    statusEl.querySelectorAll('[data-drill-issue]').forEach((btn) => {
      btn.addEventListener('click', () => ImportView.showIssueDrill(targetKey, btn.dataset.drillIssue, label));
    });

    // ------- پیش‌نمایش ردیف‌ها -------
    const sample = await db[table].limit(RM.config.PREVIEW_ROWS).toArray();
    ImportView.renderPreview(targetKey, sample);
    previewWrap.hidden = false;
  };

  /** نمایش رکوردهای عامل یک مشکل — مودال مشترک با ستون‌های Mapping کاربر */
  ImportView.showIssueDrill = async function (targetKey, issueKey, label) {
    const table = RM.config.IMPORT_TARGETS[targetKey].table;
    const all = await db[table].toArray();

    // رزولور مشترک نقص‌ها («length» → actualLength در مدل داخلی)
    const records = RM.normalize.recordsWithIssue(all, issueKey);

    const titles = {
      width: 'رکوردهای بدون عرض',
      length: 'رکوردهای بدون متراژ',
      thickness: 'رکوردهای بدون ضخامت',
      rollNumber: 'رکوردهای بدون شماره رول',
      filmType: 'رکوردهای بدون نوع فیلم',
    };

    await UI.recordsDrillModal(
      `${titles[issueKey] || 'رکوردهای مشکل‌دار'} — ${label}`,
      records,
      { source: targetKey, subtitle: 'رکوردهای عامل این مشکل:' }
    );
  };

  /** رندر جدول پیش‌نمایش نرمال‌شده (مدل داخلی — نه ستون‌های خام) */
  ImportView.renderPreview = function (targetKey, records) {
    const wrapEl = document.getElementById(`preview-inner-${targetKey}`);
    if (!wrapEl || !records.length) return;

    const columns = [
      { key: 'rollNumber', label: 'شماره رول', className: 'ltr' },
      { key: 'width', label: 'عرض', render: (r) => r.width === null ? '<span class="muted">—</span>' : U.faWidth(r.width) },
      { key: 'actualLength', label: 'متراژ', render: (r) => r.actualLength === null ? '<span class="muted">—</span>' : U.faNum(r.actualLength) },
      { key: 'thickness', label: 'ضخامت', render: (r) => r.thickness === null ? '<span class="muted">—</span>' : U.faNum(r.thickness) },
      {
        key: 'filmType', label: 'نوع فیلم',
        render: (r) => {
          const isR = RM.normalize.hasR(r.filmType);
          return isR
            ? `<span class="film-r">${U.escapeHtml(r.filmType)}</span>`
            : U.escapeHtml(r.filmType || '—');
        },
      },
      { key: 'palletNumber', label: 'پالت', render: (r) => U.escapeHtml(r.palletNumber || '—') },
      { key: 'setupNumber', label: 'ستاپ', render: (r) => r.setupNumber === null ? '<span class="muted">—</span>' : U.faNum(r.setupNumber) },
    ];

    UI.renderTable(wrapEl, columns, records, { pageSize: RM.config.PREVIEW_ROWS });
  };

  /** رندر کامل نما (هنگام شروع برنامه) */
  ImportView.render = async function () {
    for (const key of Object.keys(RM.config.IMPORT_TARGETS)) {
      await ImportView.renderCard(key);
    }
  };

  RM.views = RM.views || {};
  RM.views.importView = ImportView;
})();
