/* =========================================================================
   views/cutrolls.js — نما «رول‌های برش‌خورده» (فرزند) — نسخهٔ ۲٫۳
   -------------------------------------------------------------------------
   رکوردها با کلید «عرض برش‌خورده + شماره ستاپ» از الگوهای برش ستاپ‌ها
   ساخته می‌شوند و با رول‌های موجود فایل «رول‌های موجود» پیوند می‌خورند
   (تشخیص برش‌خورده: حرف بازوی L/R بعد از M در شناسهٔ رول).

   ستون‌ها (تعداد + وزن روی هم در یک فیلد):
     عرض · ستاپ · مقدار موجود · مقدار در ستاپ · مقدار برش‌نخورده ·
     X · U · Q · T · پای کار · پالت شده
   وزن = عرض × ۰٫۳۶۲ × تعداد — نمایش با جداکنندهٔ سه‌رقمی نقطه‌ای (2.316).

   امکانات UI (نسخهٔ ۲٫۳ — کامپوننت مشترک UI.filterTable):
     - «پنل مرتب‌سازی» کشیدنی + ماندگار با قابلیت مخفی/ظاهر (ذخیره می‌شود).
     - فیلتر پیشرفتهٔ همهٔ ستون‌ها با منطق «شامل بودن» برای اعداد و متن
       (نه تطابق دقیق) + ارقام فارسی/لاتین + وزن با «2316» هم پیدا می‌شود.
     - دکمهٔ کوچک «≠» کنار هر باکس → سوییچ منطق «شامل نشود».
     - فوکوس باکس فیلتر پس از اعمال فیلتر حفظ می‌شود (رندر فقط tbody).
     - ارتفاع بلند — حداقل ۵۰ رکورد قابل مشاهده + اسکرول داخلی.
   ========================================================================= */

'use strict';

(function () {
  const U = RM.utils;
  const UI = RM.ui;
  const DB = RM.db;

  const CutView = {
    sortPipeline: null,     // [{field, direction}] — ماندگار (appSettings: cutRollsSort)
    filters: {},            // { fieldKey: {value, invert} } — فیلتر زیر سرستون‌ها
    sortPanelVisible: true, // نمایش/مخفی پنل مرتب‌سازی (ماندگار)
    visibleRows: null,      // تعداد ردیف قابل نمایش (ماندگار — نسخهٔ ۲٫۴)
    columnOrder: null,      // ترتیب ستون‌ها (ماندگار — نسخهٔ ۲٫۶، مانند گزارش ستاپ‌ها)
    columnWidths: null,     // { colKey: px } — عرض ستون‌ها (ماندگار — نسخهٔ ۲٫۶)
    colsPanelVisible: true, // نمایش/مخفی پنل ترتیب ستون‌ها (ماندگار — نسخهٔ ۲٫۶)
  };

  /* ================================================================
     ۱) راه‌اندازی
     ================================================================ */

  CutView.init = async function () {
    // مرتب‌سازی ذخیره‌شده یا پیش‌فرض
    CutView.sortPipeline = await DB.getSetting('cutRollsSort', RM.config.CUT_DEFAULT_SORT);

    // وضعیت نمایش/مخفی پنل مرتب‌سازی — ماندگار (پیش‌فرض: نمایان)
    CutView.sortPanelVisible = await DB.getSetting('cutSortPanelVisible', true);

    // تعداد ردیف قابل نمایش — ماندگار (نسخهٔ ۲٫۴: باکس تعداد ردیف)
    CutView.visibleRows = await DB.getSetting('cutVisibleRows', RM.config.CUT_VISIBLE_ROWS);

    /* --- پنل ترتیب ستون‌ها + عرض ستون‌ها (نسخهٔ ۲٫۶ — دقیقاً مانند گزارش ستاپ‌ها) --- */
    CutView.colsPanelVisible = await DB.getSetting('cutColsPanelVisible', true);
    CutView.columnOrder = await DB.getSetting(
      'cutColumnOrder', RM.config.CUT_DEFAULT_COLUMN_ORDER);
    CutView.columnWidths = Object.assign(
      {}, RM.config.CUT_DEFAULT_COLUMN_WIDTHS,
      await DB.getSetting('cutColumnWidths', {}) || {}
    );

    const cutColsToggle = document.getElementById('cut-cols-toggle');
    if (cutColsToggle) {
      cutColsToggle.addEventListener('click', () => {
        CutView.colsPanelVisible = !CutView.colsPanelVisible;
        DB.setSetting('cutColsPanelVisible', CutView.colsPanelVisible);
        CutView.applyColsPanelVisibility();
      });
    }

    const cutColsResetBtn = document.getElementById('cut-cols-reset-btn');
    if (cutColsResetBtn) {
      cutColsResetBtn.addEventListener('click', async () => {
        CutView.columnOrder = [...RM.config.CUT_DEFAULT_COLUMN_ORDER];
        CutView.columnWidths = { ...RM.config.CUT_DEFAULT_COLUMN_WIDTHS };
        await DB.setSetting('cutColumnOrder', CutView.columnOrder);
        await DB.setSetting('cutColumnWidths', CutView.columnWidths);
        CutView.renderColumnOrderPanel();
        CutView.renderTable();
        UI.toast('ترتیب و عرض ستون‌ها به حالت پیش‌فرض بازگشت.', 'info');
      });
    }

    CutView.applyColsPanelVisibility();

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
    CutView.renderColumnOrderPanel();      // نسخهٔ ۲٫۶ — پنل ترتیب ستون‌ها
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
     ۲-ب) پنل ترتیب ستون‌ها + عرض ستون‌ها (نسخهٔ ۲٫۶ — مانند گزارش ستاپ‌ها)
     ================================================================ */

  /** اعمال وضعیت نمایش/مخفی پنل ترتیب ستون‌ها */
  CutView.applyColsPanelVisibility = function () {
    const builder = document.getElementById('cut-cols-builder');
    const toggleBtn = document.getElementById('cut-cols-toggle');
    if (!builder || !toggleBtn) return;

    builder.hidden = !CutView.colsPanelVisible;
    toggleBtn.setAttribute('aria-expanded', String(CutView.colsPanelVisible));
    toggleBtn.innerHTML = CutView.colsPanelVisible
      ? `${UI.icons.cross} مخفی‌کردن پنل ترتیب ستون‌ها`
      : `${UI.icons.plus} نمایش پنل ترتیب ستون‌ها`;
    toggleBtn.title = CutView.colsPanelVisible
      ? 'پنل ترتیب ستون‌ها را مخفی کن (برای صرفه‌جویی در فضا)'
      : 'پنل ترتیب ستون‌ها را نمایش بده';
  };

  /** رندر پنل «ترتیب ستون‌ها» — چیپ‌های کشیدنی + باکس عرض هر ستون */
  CutView.renderColumnOrderPanel = function () {
    const all = CutView.columnRegistry();
    const widths = CutView.columnWidths || {};
    const items = (CutView.columnOrder || RM.config.CUT_DEFAULT_COLUMN_ORDER)
      .map((key) => all[key])
      .filter(Boolean)
      .map((c) => ({ key: c.key, label: c.label, width: widths[c.key] ?? 0 }));

    UI.orderPanel(document.getElementById('cut-cols-pipeline'), items, {
      onMove: async (from, to) => {
        const order = CutView.columnOrder || [...RM.config.CUT_DEFAULT_COLUMN_ORDER];
        const [moved] = order.splice(from, 1);
        order.splice(to, 0, moved);
        CutView.columnOrder = order;
        await DB.setSetting('cutColumnOrder', order);
        CutView.renderColumnOrderPanel();
        CutView.renderTable();
      },
      onWidth: async (key, w) => {
        CutView.columnWidths = CutView.columnWidths || {};
        CutView.columnWidths[key] = w;
        await DB.setSetting('cutColumnWidths', CutView.columnWidths);
        CutView.renderTable();
      },
      emptyText: 'بدون ستون',
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
     ۴) رندر جدول (کامپوننت مشترک UI.filterTable — نسخهٔ ۲٫۳)
        ارتفاع بلند (۵۰ رکورد) + فیلتر «شامل بودن» + دکمهٔ «≠» + حفظ فوکوس
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

  /** رجیستری ستون‌ها برای filterTable + پنل ترتیب ستون‌ها (نسخهٔ ۲٫۶) —
      ترتیب نمایش از CutView.columnOrder؛ عرض هر ستون از CutView.columnWidths */
  CutView.columnRegistry = function () {
    const widths = CutView.columnWidths || {};
    const registry = {};

    for (const c of CutView.COLUMNS) {
      const isPlain = c.key === 'width' || c.key === 'setupNumber';
      // نسخهٔ ۲٫۴: ستون‌های «عرض» و «ستاپ» با فونت بزرگتر و بولد (em-cell)
      const baseClass = c.grade ? 'grade-cell' : (isPlain ? 'em-cell' : '');
      registry[c.key] = {
        key: c.key,
        label: c.label,
        className: baseClass,
        render: (r) => CutView.cwCellHtml(r, c.key),
        // توکن‌های قابل‌جست‌وجو: نمایش فارسی/لاتین + مقدار خام عددی + وزن (خام/نقطه‌ای)
        tokens: (r) => {
          const count = r[c.key];
          const tokens = [U.faNumPlain(count), String(count ?? '')];
          if (!isPlain) {
            const w = CutView.weightOf(r, c.key);
            if (w !== null && w !== undefined && Number.isFinite(w)) {
              tokens.push(U.faWeightDot(w), String(w), String(Math.floor(w)));
            }
          }
          return tokens;
        },
      };
    }

    /* عرض هر ستون از پنل ترتیب ستون‌ها (نسخهٔ ۲٫۶) — 0/خالی = خودکار */
    for (const col of Object.values(registry)) {
      const w = Number(widths[col.key]);
      col.width = Number.isFinite(w) && w > 0 ? w : undefined;
    }
    return registry;
  };

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

    /* --- آمار بالای جدول --- */
    const st = cut.stats;
    document.getElementById('cutrolls-stats').innerHTML = `
      <span class="chip">رکوردها: ${U.faNum(st.totalRecords)}</span>
      <span class="chip">موجود: ${U.faNum(st.totalExisting)}</span>
      <span class="chip chip-strong">در ستاپ: ${U.faNum(st.totalInSetup)}</span>
      <span class="chip chip-ok">برش‌نخورده: ${U.faNum(st.totalUncut)}</span>
      <span class="chip">رول برش‌خورده شناسایی‌شده در فایل: ${U.faNum(st.cutRollsFound)}</span>
    `;

    const sorted = CutView.sortRecords(cut.records);

    /* --- ستون‌ها از رجیستری + ترتیب کاربر (نسخهٔ ۲٫۶) --- */
    const all = CutView.columnRegistry();
    const columns = (CutView.columnOrder || RM.config.CUT_DEFAULT_COLUMN_ORDER)
      .map((key) => all[key])
      .filter(Boolean);

    /* --- باکس‌های جمع دو ردیفی (تعداد + وزن) زیر ستون‌های مقداری (نسخهٔ ۲٫۶) --- */
    const pairSums = {};
    for (const c of CutView.COLUMNS) {
      if (c.key === 'width' || c.key === 'setupNumber') continue;
      pairSums[c.key] = { type: 'pair', weightOf: CutView.weightOf };
    }

    UI.filterTable(wrap, columns, sorted, {
      state: CutView,                      // filters + visibleRows (ماندگار)
      visibleRows: RM.config.CUT_VISIBLE_ROWS,
      rowHeight: 42,
      // نسخهٔ ۲٫۴: باکس تعداد ردیف + ماندگاری مقدار
      onRowsChange: (n) => DB.setSetting('cutVisibleRows', n),
      tableClass: 'cut-table',
      emptyText: 'رکوردی برای نمایش وجود ندارد.',
      filteredEmptyText: 'هیچ رکوردی با فیلترهای فعلی مطابقت ندارد — فیلترها را پاک کنید.',
      footerNote: 'فیلتر هر ستون زیر سرستون همان ستون · منطق: شامل بودن (اعداد و متن‌ها) · دکمهٔ «≠» = شامل نشود · فوکوس حفظ می‌شود · باکس‌های Σ (تعداد + وزن) با دیتای فیلترشده به‌روز می‌شوند',
      // باکس‌های جمع دو ردیفی زیر ستون‌ها (نسخهٔ ۲٫۶) — با احترام به فیلتر
      sums: pairSums,
    });
  };

  /** رندر کامل نما (هنگام تعویض تب — داده از Cache موتور محاسبه) */
  CutView.render = function () {
    CutView.renderColumnOrderPanel();       // نسخهٔ ۲٫۶ — هم‌گام با تنظیمات
    CutView.renderTable();
  };

  RM.views = RM.views || {};
  RM.views.cutrolls = CutView;
})();
