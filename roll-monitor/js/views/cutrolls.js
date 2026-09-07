/* =========================================================================
   views/cutrolls.js — نما «رول‌های برش‌خورده» (فرزند) — تغییرات جدید
   -------------------------------------------------------------------------
   رکوردها با کلید «عرض برش‌خورده + شماره ستاپ» از الگوهای برش ستاپ‌ها
   ساخته می‌شوند و با رول‌های موجود فایل «رول‌های موجود» پیوند می‌خورند
   (تشخیص برش‌خورده: حرف بازوی L/R بعد از M در شناسهٔ رول).

   ستون‌ها (تعداد + وزن روی هم در یک فیلد):
     عرض · ستاپ · مقدار موجود · مقدار در ستاپ · مقدار برش‌نخورده ·
     X · U · Q · T · پای کار · پالت شده
   وزن = عرض × ۰٫۳۶۲ × تعداد — نمایش با جداکنندهٔ سه‌رقمی نقطه‌ای (2.316).

   امکانات UI:
     - «پنل مرتب‌سازی» مشابه رول‌های خام (کشیدنی + ماندگار) با قابلیت
       مخفی/ظاهر شدن برای صرفه‌جویی در فضا (وضعیت ذخیره می‌شود).
     - فیلتر پیشرفتهٔ همهٔ ستون‌ها — باکس فیلتر زیر سرستون هر ستون
       (امکان فیلتر همزمان چند ستون؛ عدد = برابری عددی، متن = شامل بودن).
     - ارتفاع بلند — حداقل ۵۰ رکورد قابل مشاهده، سپس اسکرول داخلی
       (thead چسبان هنگام اسکرول).
   ========================================================================= */

'use strict';

(function () {
  const U = RM.utils;
  const UI = RM.ui;
  const DB = RM.db;

  const CutView = {
    sortPipeline: null,     // [{field, direction}] — ماندگار (appSettings: cutRollsSort)
    filters: {},            // { fieldKey: مقدار } — فیلتر زیر سرستون‌ها
    sortPanelVisible: true, // نمایش/مخفی پنل مرتب‌سازی (ماندگار)
  };

  /* ================================================================
     ۱) راه‌اندازی
     ================================================================ */

  CutView.init = async function () {
    // مرتب‌سازی ذخیره‌شده یا پیش‌فرض
    CutView.sortPipeline = await DB.getSetting('cutRollsSort', RM.config.CUT_DEFAULT_SORT);

    // وضعیت نمایش/مخفی پنل مرتب‌سازی — ماندگار (پیش‌فرض: نمایان)
    CutView.sortPanelVisible = await DB.getSetting('cutSortPanelVisible', true);

    // دکمهٔ نمایش/مخفی پنل مرتب‌سازی
    const toggleBtn = document.getElementById('cut-sort-toggle');
    toggleBtn.addEventListener('click', () => {
      CutView.sortPanelVisible = !CutView.sortPanelVisible;
      DB.setSetting('cutSortPanelVisible', CutView.sortPanelVisible);
      CutView.applySortPanelVisibility();
    });

    // سازندهٔ مرتب‌سازی: افزودن فیلد
    const addSelect = document.getElementById('cut-sort-add-select');
    addSelect.innerHTML = '<option value="">افزودن فیلد…</option>' +
      Object.entries(RM.config.CUT_SORTABLE_FIELDS)
        .map(([k, v]) => `<option value="${k}">${U.escapeHtml(v.label)}</option>`)
        .join('');

    document.getElementById('cut-sort-add-btn').addEventListener('click', () => {
      const field = addSelect.value;
      if (!field) return;
      if (CutView.sortPipeline.some((s) => s.field === field)) {
        UI.toast('این فیلد قبلاً به مرتب‌سازی اضافه شده است.', 'info');
        return;
      }
      CutView.sortPipeline.push({ field, direction: 'asc' });
      CutView.saveSort();
      CutView.renderSortBuilder();
      CutView.renderTable();
    });

    // بازنشانی مرتب‌سازی
    document.getElementById('cut-sort-reset-btn').addEventListener('click', async () => {
      CutView.sortPipeline = JSON.parse(JSON.stringify(RM.config.CUT_DEFAULT_SORT));
      await DB.setSetting('cutRollsSort', CutView.sortPipeline);
      CutView.renderSortBuilder();
      CutView.renderTable();
      UI.toast('مرتب‌سازی رول‌های برش‌خورده به حالت پیش‌فرض بازگشت.', 'info');
    });

    CutView.applySortPanelVisibility();
    CutView.renderSortBuilder();
  };

  /* ================================================================
     ۲) پنل مرتب‌سازی (مشابه رول‌های خام — با قابلیت مخفی/ظاهر)
     ================================================================ */

  CutView.saveSort = function () {
    DB.setSetting('cutRollsSort', CutView.sortPipeline);
  };

  /** اعمال وضعیت نمایش/مخفی پنل + برچسب و آیکون دکمه */
  CutView.applySortPanelVisibility = function () {
    const builder = document.getElementById('cut-sort-builder');
    const toggleBtn = document.getElementById('cut-sort-toggle');
    if (!builder || !toggleBtn) return;

    builder.hidden = !CutView.sortPanelVisible;
    toggleBtn.setAttribute('aria-expanded', String(CutView.sortPanelVisible));
    toggleBtn.innerHTML = CutView.sortPanelVisible
      ? `${UI.icons.cross} مخفی‌کردن پنل مرتب‌سازی`
      : `${UI.icons.plus} نمایش پنل مرتب‌سازی`;
    toggleBtn.title = CutView.sortPanelVisible
      ? 'پنل مرتب‌سازی را مخفی کن (برای صرفه‌جویی در فضا)'
      : 'پنل مرتب‌سازی را نمایش بده';
  };

  /** رندر چیپ‌های «پنل مرتب‌سازی» — مولفهٔ مشترک UI (کشیدن + جهت + حذف) */
  CutView.renderSortBuilder = function () {
    UI.sortPanel(document.getElementById('cut-sort-pipeline'), CutView.sortPipeline, RM.config.CUT_SORTABLE_FIELDS, {
      onDir: (i) => {
        CutView.sortPipeline[i].direction =
          CutView.sortPipeline[i].direction === 'asc' ? 'desc' : 'asc';
        CutView.saveSort();
        CutView.renderSortBuilder();
        CutView.renderTable();
      },
      onRemove: (i) => {
        CutView.sortPipeline.splice(i, 1);
        CutView.saveSort();
        CutView.renderSortBuilder();
        CutView.renderTable();
      },
      onReorder: (from, to) => {
        const [moved] = CutView.sortPipeline.splice(from, 1);
        CutView.sortPipeline.splice(to, 0, moved);
        CutView.saveSort();
        CutView.renderSortBuilder();
        CutView.renderTable();
      },
    });
  };

  /* ================================================================
     ۳) اعمال مرتب‌سازی چندمرحله‌ای (از آخرین اولویت به اولین)
     ================================================================ */

  CutView.sortRecords = function (records) {
    const sorted = [...records];
    for (let i = CutView.sortPipeline.length - 1; i >= 0; i--) {
      const { field, direction } = CutView.sortPipeline[i];
      sorted.sort((a, b) => U.compareNumeric(a[field], b[field], direction));
    }
    return sorted;
  };

  /* ================================================================
     ۴) فیلتر پیشرفتهٔ زیر سرستون‌ها (همزمان چند ستون)
        عدد = برابری عددی با «تعداد» همان ستون · متن = شامل بودن
     ================================================================ */

  /** رکورد به فیلتر یک ستون می‌خورد؟ (مقدار عددی هر ستون = تعداد) */
  CutView.recordMatchesFilter = function (record, key, value) {
    const num = U.parseNumber(value);

    // عدد → برابری عددی با مقدار تعداد همان ستون
    if (num !== null && Number.isFinite(Number(record[key]))) {
      return Number(record[key]) === num;
    }

    // متن → شامل بودن در متن نمایشی سلول (تعداد فارسی + وزن نقطه‌ای)
    const hay = String(U.faNumPlain(record[key])) + ' ' +
      U.faWeightDot(CutView.weightOf(record, key));
    return hay.includes(value);
  };

  /** اعمال همهٔ فیلترهای فعال */
  CutView.filterRecords = function (records) {
    const active = Object.entries(CutView.filters)
      .filter(([, v]) => String(v ?? '').trim() !== '');
    if (!active.length) return records;
    return records.filter((r) =>
      active.every(([key, val]) =>
        CutView.recordMatchesFilter(r, key, String(val).trim())
      )
    );
  };

  /* ================================================================
     ۵) رندر جدول (همهٔ رکوردها — ارتفاع بلند + اسکرول داخلی)
     ================================================================ */

  /** ستون‌های جدول — هر ستون مقداری: (تعداد، وزن) روی هم */
  CutView.COLUMNS = [
    { key: 'width',            label: 'عرض',             numeric: true },
    { key: 'setupNumber',      label: 'ستاپ',            numeric: true },
    { key: 'existingCount',    label: 'مقدار موجود',     numeric: true },
    { key: 'inSetupCount',     label: 'مقدار در ستاپ',   numeric: true },
    { key: 'uncutCount',       label: 'مقدار برش‌نخورده', numeric: true },
    { key: 'xCount',           label: 'X',               numeric: true, grade: 'X' },
    { key: 'uCount',           label: 'U',               numeric: true, grade: 'U' },
    { key: 'qCount',           label: 'Q',               numeric: true, grade: 'Q' },
    { key: 'tCount',           label: 'T',               numeric: true, grade: 'T' },
    { key: 'endCount',         label: 'پای کار',         numeric: true },
    { key: 'palletCount',      label: 'پالت شده',        numeric: true },
  ];

  /** مقدار وزن متناظر یک ستون عددی برای رکورد */
  CutView.weightOf = function (record, key) {
    switch (key) {
      case 'existingCount': return record.existingWeight;
      case 'inSetupCount':  return record.inSetupWeight;
      case 'uncutCount':    return record.uncutWeight;
      case 'xCount':        return record.gradeWeights.X;
      case 'uCount':        return record.gradeWeights.U;
      case 'qCount':        return record.gradeWeights.Q;
      case 'tCount':        return record.gradeWeights.T;
      case 'endCount':      return record.endWeight;
      case 'palletCount':   return record.palletWeight;
      default: return null;
    }
  };

  /** رندر سلول (تعداد + وزن روی هم در یک فیلد) */
  CutView.cwCellHtml = function (record, key) {
    const count = record[key];
    const weight = CutView.weightOf(record, key);
    const isPlain = key === 'width' || key === 'setupNumber';

    if (isPlain) {
      return key === 'width' ? U.faWidth(count) : U.faNum(count);
    }

    return `
      <div class="cw-cell">
        <span class="cw-count">${U.faNum(count)}</span>
        <span class="cw-weight">${U.faWeightDot(weight)}</span>
      </div>`;
  };

  CutView.renderTable = async function () {
    const state = await RM.calcEngine.getState();
    const cut = state.cutRolls;
    const wrap = document.getElementById('cutrolls-table');

    if (!cut.records.length) {
      document.getElementById('cutrolls-stats').innerHTML = '';
      wrap.innerHTML = `
        <div class="empty-state">
          ${UI.icons.alert}
          <h4>رکوردی برای نمایش وجود ندارد</h4>
          <p>رکوردهای رول‌های برش‌خورده از «الگوی برش» رکوردهای ستاپ‌ها ساخته می‌شوند.<br>
          ابتدا در تب «ستاپ‌ها» رکوردی با الگوی برش ثبت کنید و فایل «رول‌های موجود» را وارد کنید.</p>
        </div>`;
      return;
    }

    const filtered = CutView.filterRecords(cut.records);
    const sorted = CutView.sortRecords(filtered);

    /* --- آمار بالای جدول --- */
    const st = cut.stats;
    const activeCount = Object.values(CutView.filters)
      .filter((v) => String(v ?? '').trim() !== '').length;
    document.getElementById('cutrolls-stats').innerHTML = `
      <span class="chip">رکوردها: ${U.faNum(st.totalRecords)}</span>
      <span class="chip">موجود: ${U.faNum(st.totalExisting)}</span>
      <span class="chip chip-strong">در ستاپ: ${U.faNum(st.totalInSetup)}</span>
      <span class="chip chip-ok">برش‌نخورده: ${U.faNum(st.totalUncut)}</span>
      <span class="chip">رول برش‌خورده شناسایی‌شده در فایل: ${U.faNum(st.cutRollsFound)}</span>
      ${activeCount
        ? `<span class="chip chip-warn">${U.faNum(filtered.length)} از ${U.faNum(st.totalRecords)} رکورد (فیلترشده)</span>`
        : ''}
    `;

    /* --- سرستون‌ها + ردیف فیلتر زیر هر سرستون --- */
    const headRow = CutView.COLUMNS.map((c) => `<th>${c.label}</th>`).join('');
    const filterRow = CutView.COLUMNS.map((c) => `
      <th class="cut-filter-cell" aria-label="فیلتر ${c.label}">
        <input type="text" class="cut-filter-input" data-cut-filter="${c.key}"
               value="${U.escapeHtml(CutView.filters[c.key] ?? '')}"
               autocomplete="off" placeholder="فیلتر…"
               aria-label="فیلتر ستون ${U.escapeHtml(c.label)}">
      </th>`).join('');

    /* --- بدنه: همهٔ رکوردها (بدون صفحه‌بندی — اسکرول داخلی) --- */
    const bodyRows = sorted.map((r) => {
      const cells = CutView.COLUMNS
        .map((c) => `<td class="${c.grade ? 'grade-cell' : ''}">${CutView.cwCellHtml(r, c.key)}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    /* ارتفاع کافی برای حداقل ۵۰ رکورد + اسکرول داخلی (thead چسبان) */
    const heightStyle = `height: calc(${RM.config.CUT_VISIBLE_ROWS} * 42px); max-height: calc(${RM.config.CUT_VISIBLE_ROWS} * 42px);`;

    wrap.innerHTML = `
      <div class="cut-table-scroll" style="${heightStyle}">
        <table class="data-table cut-table">
          <thead>
            <tr class="cut-head-row">${headRow}</tr>
            <tr class="cut-filter-row">${filterRow}</tr>
          </thead>
          <tbody>${bodyRows || `<tr><td colspan="${CutView.COLUMNS.length}" class="muted" style="text-align:center;padding:18px">هیچ رکوردی با فیلترهای فعلی مطابقت ندارد — فیلترها را پاک کنید.</td></tr>`}</tbody>
        </table>
      </div>
      <div class="cut-filter-bar">
        <span class="muted" style="font-size:.7rem">فیلتر هر ستون در زیر سرستون همان ستون · عدد = برابری عددی · متن = شامل بودن (تعداد یا وزن)</span>
        <button type="button" class="btn btn-ghost btn-sm" id="cut-filter-clear">پاک‌کردن فیلترها</button>
      </div>`;

    /* --- رویدادهای فیلتر (debounce) --- */
    let timer = null;
    wrap.querySelectorAll('[data-cut-filter]').forEach((el) => {
      el.addEventListener('input', () => {
        CutView.filters[el.dataset.cutFilter] = el.value;
        clearTimeout(timer);
        timer = setTimeout(() => CutView.renderTable(), 250);
      });
    });

    document.getElementById('cut-filter-clear').addEventListener('click', () => {
      CutView.filters = {};
      CutView.renderTable();
      UI.toast('فیلترها پاک شد.', 'info');
    });
  };

  /** رندر کامل نما (هنگام تعویض تب — داده از Cache موتور محاسبه) */
  CutView.render = function () {
    CutView.renderTable();
  };

  RM.views = RM.views || {};
  RM.views.cutrolls = CutView;
})();
