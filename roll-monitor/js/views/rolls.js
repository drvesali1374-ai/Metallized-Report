/* =========================================================================
   views/rolls.js — نما صفحهٔ «رول‌ها» (§31-§38، §90)
   -------------------------------------------------------------------------
   دو تب داخلی:
     ۱) رول‌های خام — گروه‌بندی ۳فاکتوری + جدول + وضعیت تطبیق
        + مرتب‌سازی چندمرحله‌ایِ کشیدنی و ماندگار (§36-§38)
     ۲) رول‌های برش‌خورده — placeholder آمادهٔ معماری (§31، §98)
   همهٔ داده‌ها از موتور محاسبهٔ مرکزی می‌آیند (§79).
   ========================================================================= */

'use strict';

(function () {
  const U = RM.utils;
  const UI = RM.ui;
  const DB = RM.db;
  const db = RM.db.db;

  const RollsView = {
    sortPipeline: null,     // [{field, direction}] — ماندگار (§38)
    filters: {},            // { fieldKey: {value, invert} } — فیلتر زیر سرستون‌ها (نسخهٔ ۲٫۳)
    sortPanelVisible: true, // نمایش/مخفی پنل مرتب‌سازی (ماندگار — نسخهٔ ۲٫۳)
    visibleRows: null,      // تعداد ردیف قابل نمایش (ماندگار — نسخهٔ ۲٫۴)
    columnOrder: null,      // ترتیب ستون‌ها (ماندگار — نسخهٔ ۲٫۶، مثل گزارش ستاپ‌ها)
    columnWidths: null,     // { colKey: px } — عرض ستون‌ها (ماندگار — نسخهٔ ۲٫۶)
    colsPanelVisible: true, // نمایش/مخفی پنل ترتیب ستون‌ها (ماندگار — نسخهٔ ۲٫۶)
    _lastDetailGroup: null, // آخرین گروهِ باز‌شده در جزئیات (برای رندر مجدد ستون‌ها)
  };

  /* ================================================================
     ۱) راه‌اندازی
     ================================================================ */

  RollsView.init = async function () {
    // بارگذاری مرتب‌سازی ذخیره‌شده یا پیش‌فرض (§38)
    RollsView.sortPipeline = await DB.getSetting('rawRollsSort', RM.config.DEFAULT_SORT);

    // وضعیت نمایش/مخفی پنل مرتب‌سازی — ماندگار (نسخهٔ ۲٫۳ — مثل برش‌خورده‌ها)
    RollsView.sortPanelVisible = await DB.getSetting('rawSortPanelVisible', true);

    // تعداد ردیف قابل نمایش — ماندگار (نسخهٔ ۲٫۴: باکس تعداد ردیف)
    RollsView.visibleRows = await DB.getSetting('rawVisibleRows', RM.config.RAW_VISIBLE_ROWS);

    /* --- پنل ترتیب ستون‌ها + عرض ستون‌ها (نسخهٔ ۲٫۶ — دقیقاً مانند گزارش ستاپ‌ها) --- */
    RollsView.colsPanelVisible = await DB.getSetting('rawColsPanelVisible', true);
    RollsView.columnOrder = await DB.getSetting(
      'rawColumnOrder', RM.config.RAW_DEFAULT_COLUMN_ORDER);
    RollsView.columnWidths = Object.assign(
      {}, RM.config.RAW_DEFAULT_COLUMN_WIDTHS,
      await DB.getSetting('rawColumnWidths', {}) || {}
    );

    const rollColsToggle = document.getElementById('raw-cols-toggle');
    if (rollColsToggle) {
      rollColsToggle.addEventListener('click', () => {
        RollsView.colsPanelVisible = !RollsView.colsPanelVisible;
        DB.setSetting('rawColsPanelVisible', RollsView.colsPanelVisible);
        RollsView.applyColsPanelVisibility();
      });
    }

    const colsResetBtn = document.getElementById('raw-cols-reset-btn');
    if (colsResetBtn) {
      colsResetBtn.addEventListener('click', async () => {
        RollsView.columnOrder = [...RM.config.RAW_DEFAULT_COLUMN_ORDER];
        RollsView.columnWidths = { ...RM.config.RAW_DEFAULT_COLUMN_WIDTHS };
        await DB.setSetting('rawColumnOrder', RollsView.columnOrder);
        await DB.setSetting('rawColumnWidths', RollsView.columnWidths);
        RollsView.renderColumnOrderPanel();
        RollsView.renderTable();
        UI.toast('ترتیب و عرض ستون‌ها به حالت پیش‌فرض بازگشت.', 'info');
      });
    }

    RollsView.applyColsPanelVisibility();

    const rollSortToggle = document.getElementById('roll-sort-toggle');
    if (rollSortToggle) {
      rollSortToggle.addEventListener('click', () => {
        RollsView.sortPanelVisible = !RollsView.sortPanelVisible;
        DB.setSetting('rawSortPanelVisible', RollsView.sortPanelVisible);
        RollsView.applySortPanelVisibility();
      });
    }
    RollsView.applySortPanelVisibility();

    // تب‌های داخلی
    document.querySelectorAll('.subtab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.subtab-btn').forEach((b) => {
          const active = b === btn;
          b.classList.toggle('active', active);
          b.setAttribute('aria-selected', String(active));
        });
        const target = btn.dataset.subview;
        document.querySelectorAll('.subview').forEach((el) => {
          el.classList.toggle('active', el.id === `subview-${target}`);
          el.hidden = el.id !== `subview-${target}`;
        });
      });
    });

    // سازندهٔ مرتب‌سازی: افزودن فیلد
    const addSelect = document.getElementById('sort-add-select');
    document.getElementById('sort-add-btn').addEventListener('click', () => {
      const field = addSelect.value;
      if (!field) return;
      // جلوگیری از تکرار فیلد در خط لوله
      if (RollsView.sortPipeline.some((s) => s.field === field)) {
        UI.toast('این فیلد قبلاً به مرتب‌سازی اضافه شده است.', 'info');
        return;
      }
      RollsView.sortPipeline.push({ field, direction: 'asc' });
      RollsView.saveSort();
      RollsView.renderSortBuilder();
      RollsView.renderTable();
    });

    // بازنشانی مرتب‌سازی
    document.getElementById('sort-reset-btn').addEventListener('click', async () => {
      RollsView.sortPipeline = JSON.parse(JSON.stringify(RM.config.DEFAULT_SORT));
      await DB.setSetting('rawRollsSort', RollsView.sortPipeline);
      RollsView.renderSortBuilder();
      RollsView.renderTable();
      UI.toast('مرتب‌سازی به حالت پیش‌فرض بازگشت.', 'info');
    });

    RollsView.renderSortBuilder();
    RollsView.renderColumnOrderPanel();      // نسخهٔ ۲٫۶ — پنل ترتیب ستون‌ها
  };

  /* ================================================================
     ۲) سازندهٔ مرتب‌سازی کشیدنی (§36-§38)
     ================================================================ */

  /** ذخیرهٔ ماندگار خط لولهٔ مرتب‌سازی (§38) */
  RollsView.saveSort = function () {
    DB.setSetting('rawRollsSort', RollsView.sortPipeline);
  };

  /** رندر چیپ‌های «پنل مرتب‌سازی» — مولفهٔ مشترک UI (کشیدن + جهت + حذف) */
  RollsView.renderSortBuilder = function () {
    UI.sortPanel(document.getElementById('sort-pipeline'), RollsView.sortPipeline, RM.config.SORTABLE_FIELDS, {
      onDir: (i) => {
        RollsView.sortPipeline[i].direction =
          RollsView.sortPipeline[i].direction === 'asc' ? 'desc' : 'asc';
        RollsView.saveSort();
        RollsView.renderSortBuilder();
        RollsView.renderTable();
      },
      onRemove: (i) => {
        RollsView.sortPipeline.splice(i, 1);
        RollsView.saveSort();
        RollsView.renderSortBuilder();
        RollsView.renderTable();
      },
      onReorder: (from, to) => {
        const [moved] = RollsView.sortPipeline.splice(from, 1);
        RollsView.sortPipeline.splice(to, 0, moved);
        RollsView.saveSort();
        RollsView.renderSortBuilder();
        RollsView.renderTable();
      },
    });
  };

  /* ================================================================
     ۲-ب) نمایش/مخفی پنل مرتب‌سازی (ماندگار — نسخهٔ ۲٫۳)
     ================================================================ */

  RollsView.applySortPanelVisibility = function () {
    const builder = document.getElementById('roll-sort-builder');
    const toggleBtn = document.getElementById('roll-sort-toggle');
    if (!builder || !toggleBtn) return;

    builder.hidden = !RollsView.sortPanelVisible;
    toggleBtn.setAttribute('aria-expanded', String(RollsView.sortPanelVisible));
    toggleBtn.innerHTML = RollsView.sortPanelVisible
      ? `${UI.icons.cross} مخفی‌کردن پنل مرتب‌سازی`
      : `${UI.icons.plus} نمایش پنل مرتب‌سازی`;
    toggleBtn.title = RollsView.sortPanelVisible
      ? 'پنل مرتب‌سازی را مخفی کن (برای صرفه‌جویی در فضا)'
      : 'پنل مرتب‌سازی را نمایش بده';
  };

  /* ================================================================
     ۲-ج) پنل ترتیب ستون‌ها + عرض ستون‌ها (نسخهٔ ۲٫۶ — مانند گزارش ستاپ‌ها)
     ================================================================ */

  /** اعمال وضعیت نمایش/مخفی پنل ترتیب ستون‌ها */
  RollsView.applyColsPanelVisibility = function () {
    const builder = document.getElementById('raw-cols-builder');
    const toggleBtn = document.getElementById('raw-cols-toggle');
    if (!builder || !toggleBtn) return;

    builder.hidden = !RollsView.colsPanelVisible;
    toggleBtn.setAttribute('aria-expanded', String(RollsView.colsPanelVisible));
    toggleBtn.innerHTML = RollsView.colsPanelVisible
      ? `${UI.icons.cross} مخفی‌کردن پنل ترتیب ستون‌ها`
      : `${UI.icons.plus} نمایش پنل ترتیب ستون‌ها`;
    toggleBtn.title = RollsView.colsPanelVisible
      ? 'پنل ترتیب ستون‌ها را مخفی کن (برای صرفه‌جویی در فضا)'
      : 'پنل ترتیب ستون‌ها را نمایش بده';
  };

  /** رندر پنل «ترتیب ستون‌ها» — چیپ‌های کشیدنی + باکس عرض هر ستون */
  RollsView.renderColumnOrderPanel = function () {
    const all = RollsView.columnRegistry();
    const widths = RollsView.columnWidths || {};
    const items = (RollsView.columnOrder || RM.config.RAW_DEFAULT_COLUMN_ORDER)
      .map((key) => all[key])
      .filter(Boolean)
      .map((c) => ({ key: c.key, label: c.label, width: widths[c.key] ?? 0 }));

    UI.orderPanel(document.getElementById('raw-cols-pipeline'), items, {
      onMove: async (from, to) => {
        const order = RollsView.columnOrder || [...RM.config.RAW_DEFAULT_COLUMN_ORDER];
        const [moved] = order.splice(from, 1);
        order.splice(to, 0, moved);
        RollsView.columnOrder = order;
        await DB.setSetting('rawColumnOrder', order);
        RollsView.renderColumnOrderPanel();
        RollsView.renderTable();
      },
      onWidth: async (key, w) => {
        RollsView.columnWidths = RollsView.columnWidths || {};
        RollsView.columnWidths[key] = w;
        await DB.setSetting('rawColumnWidths', RollsView.columnWidths);
        RollsView.renderTable();
      },
      emptyText: 'بدون ستون',
    });
  };

  /* ================================================================
     ۳) اعمال مرتب‌سازی چندمرحله‌ای روی گروه‌ها (§36 + فیلد وضعیت)
     ================================================================ */

  /** مقدار وضعیت گروه برای مرتب‌سازی: ۱=دارای ستاپ ۲=بدون ستاپ ۳=غیرقابل تطبیق */
  RollsView.groupStatusRank = function (g) {
    if (!g.hasRule) return 3;
    return g.matched ? 1 : 2;
  };

  RollsView.sortGroups = function (groups) {
    const sorted = [...groups];
    // اعمال از آخرین اولویت به اولین (اولین، غالب‌ترین است)
    for (let i = RollsView.sortPipeline.length - 1; i >= 0; i--) {
      const { field, direction } = RollsView.sortPipeline[i];
      sorted.sort((a, b) => {
        if (field === 'status') {
          const r = RollsView.groupStatusRank(a) - RollsView.groupStatusRank(b);
          return direction === 'desc' ? -r : r;
        }
        return U.compareNumeric(a[field], b[field], direction);
      });
    }
    return sorted;
  };

  /* ================================================================
     ۴) رندر جدول گروه‌های رول خام (§33-§35) — نسخهٔ ۲٫۳
        همان طراحی جدول «رول‌های برش‌خورده»: کامپوننت مشترک UI.filterTable
        (ارتفاع ۵۰ رکورد + فیلتر «شامل بودن» زیر سرستون‌ها + دکمهٔ «≠» +
        حفظ فوکوس + سرستون چسبان). ستون‌های «عرض» و «شماره ستاپ» بولد و بزرگ.
        نسخهٔ ۲٫۶: ترتیب/عرض ستون‌ها از «پنل ترتیب ستون‌ها» (مانند گزارش ستاپ‌ها)
        + باکس جمع زیر ستون «تعداد» (با احترام به فیلتر).
     ================================================================ */

  /** رجیستری ستون‌های جدول خام — ترتیب نمایش از RollsView.columnOrder */
  RollsView.columnRegistry = function () {
    const widths = RollsView.columnWidths || {};

    /* برچسب متنی وضعیت برای فیلتر/جست‌وجو */
    const statusText = (r) => (r.matched
      ? 'دارای ستاپ'
      : (r.hasRule ? 'بدون ستاپ' : 'غیرقابل تطبیق'));

    const registry = {
      width: {
        key: 'width', label: 'عرض (mm)', className: 'em-cell',
        headerTitle: 'عرض رول اولیه (mm)',
        render: (r) => U.faWidth(r.width),
        tokens: (r) => [U.faWidth(r.width), String(r.width ?? '')],
      },
      thickness: {
        key: 'thickness', label: 'ضخامت (μ)',
        render: (r) => U.faNum(r.thickness),
        tokens: (r) => [U.faNum(r.thickness), String(r.thickness ?? '')],
      },
      standardLength: {
        key: 'standardLength', label: 'متراژ استاندارد',
        render: (r) => r.hasRule
          ? U.faNum(r.standardLength)
          : '<span class="muted" title="قانون متراژی برای این رول یافت نشد">بدون قانون</span>',
        tokens: (r) => r.hasRule
          ? [U.faNum(r.standardLength), String(r.standardLength ?? '')]
          : ['بدون قانون'],
      },
      setupNumber: {
        key: 'setupNumber', label: 'شماره ستاپ', className: 'em-cell',
        render: (r) => U.faNum(r.setupNumber),
        tokens: (r) => [U.faNum(r.setupNumber), String(r.setupNumber ?? '')],
      },
      count: {
        key: 'count', label: 'تعداد', className: 'count-cell',
        render: (r) => U.faNum(r.count),
        tokens: (r) => [U.faNum(r.count), String(r.count ?? '')],
      },
      status: {
        key: 'status', label: 'وضعیت',
        render: (r) => (r.matched
          ? '<span class="status-pill pill-ok" title="برای این ترکیب ستاپ تعریف شده است">✓ دارای ستاپ</span>'
          : (r.hasRule
            ? '<span class="status-pill pill-warn" title="برای این ترکیب ستاپی تعریف نشده">⚠ بدون ستاپ</span>'
            : '<span class="status-pill pill-muted" title="متراژ استاندارد ندارد؛ قابل تطبیق نیست">غیرقابل تطبیق</span>')),
        tokens: (r) => [statusText(r)],
      },
      details: {
        key: 'details', label: 'جزئیات', filterable: false,
        render: (r) => `<button type="button" class="btn btn-ghost btn-sm" data-group-key="${U.escapeHtml(r.key)}"
            title="مشاهدهٔ رول‌های این گروه">${UI.icons.audit}</button>`,
      },
    };

    /* عرض هر ستون از پنل ترتیب ستون‌ها (نسخهٔ ۲٫۶) — 0/خالی = خودکار */
    for (const col of Object.values(registry)) {
      const w = Number(widths[col.key]);
      col.width = Number.isFinite(w) && w > 0 ? w : undefined;
    }
    return registry;
  };

  RollsView.renderTable = async function () {
    const state = await RM.calcEngine.getState();

    // آمار بالای جدول
    const s = state.summary;
    document.getElementById('rolls-stats').innerHTML = `
      <span class="chip">رول‌های خام: ${U.faNum(s.rawRollsCount)}</span>
      <span class="chip">گروه‌ها: ${U.faNum(s.totalGroups)}</span>
      <span class="chip chip-ok">دارای ستاپ: ${U.faNum(s.matchedGroups)}</span>
      <span class="chip chip-warn">بدون ستاپ: ${U.faNum(s.totalGroups - s.matchedGroups)}</span>
    `;

    // گروه‌های بدون قانون متراژ در انتهای جدول (مقادیر تهی آخر می‌افتند)
    const groups = RollsView.sortGroups(state.rawRollGroups);

    const wrap = document.getElementById('raw-rolls-table');
    const all = RollsView.columnRegistry();
    const columns = (RollsView.columnOrder || RM.config.RAW_DEFAULT_COLUMN_ORDER)
      .map((key) => all[key])
      .filter(Boolean);

    UI.filterTable(wrap, columns, groups, {
      state: RollsView,                      // filters + visibleRows (ماندگار)
      visibleRows: RM.config.RAW_VISIBLE_ROWS,
      rowHeight: 42,
      // نسخهٔ ۲٫۴: باکس تعداد ردیف + ماندگاری مقدار
      onRowsChange: (n) => RM.db.setSetting('rawVisibleRows', n),
      tableClass: 'cut-table raw-table',
      emptyText: 'هنوز رول خامی شناسایی نشده — فایل «رول‌های موجود» را در تب «ورود داده‌ها» بارگذاری کنید.',
      filteredEmptyText: 'هیچ گروهی با فیلترهای فعلی مطابقت ندارد — فیلترها را پاک کنید.',
      footerNote: 'فیلتر هر ستون زیر سرستون همان ستون · منطق: شامل بودن (اعداد و متن‌ها) · دکمهٔ «≠» = شامل نشود · فوکوس حفظ می‌شود · باکس Σ زیر ستون «تعداد» با دیتای فیلترشده به‌روز می‌شود',
      // باکس جمع زیر ستون «تعداد» (نسخهٔ ۲٫۶) — با احترام به فیلترهای فعال
      sums: {
        count: { type: 'number' },
      },
      // اتصال دکمه‌های «جزئیات» پس از هر رندر بدنه
      onRendered: () => {
        wrap.querySelectorAll('[data-group-key]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const group = groups.find((g) => g.key === btn.dataset.groupKey);
            if (group) {
              RollsView._lastDetailGroup = group;
              await RollsView.showGroupDetails(group);
            }
          });
        });
      },
    });
  };

  /* ================================================================
     ۵) جزئیات گروه (Audit §45 + ستون‌های قابل Mapping — §7 اصلاحات)
     ================================================================ */

  /**
   * نمایش رول‌های داخل همین گروه انتخاب‌شده — نه یک لیست عمومی.
   * ستون‌ها (نام/ترتیب/انتخاب) از Mapping کاربر + تنظیم rollDetailColumns.
   */
  RollsView.showGroupDetails = async function (group) {
    // رکوردهای همین گروه از طریق شناسه‌ها (همه — صفحه‌بندی در جدول)
    const ids = group.rollIds;
    const records = ids.length ? await db.rolls.bulkGet(ids) : [];
    const valid = records.filter(Boolean);

    const columns = await UI.rollDetailColumns('rolls');
    const selected = columns.map((c) => c.key);
    const labels = await RM.normalize.effectiveColumnLabels('rolls');

    // ---------- انتخاب‌گر ستون‌های جزئیات (انتخاب + ترتیب) ----------
    const chip = (k, on) => {
      const label = U.escapeHtml(labels[k] || RM.config.FIELD_LABELS[k] || k);
      return on
        ? `<span class="detail-chip on">
             <button type="button" data-col-up="${k}" title="انتقال به قبل" aria-label="انتقال به قبل">↑</button>
             <button type="button" data-col-down="${k}" title="انتقال به بعد" aria-label="انتقال به بعد">↓</button>
             <b>${label}</b>
             <button type="button" data-col-off="${k}" title="حذف ستون" aria-label="حذف ستون">×</button>
           </span>`
        : `<span class="detail-chip">
             <button type="button" data-col-on="${k}" title="افزودن ستون" aria-label="افزودن ستون">+ ${label}</button>
           </span>`;
    };

    const allFields = RM.config.DETAIL_FIELDS;
    const selectedSet = new Set(selected);
    const colsHtml =
      `<details class="detail-cols-picker">
         <summary>ستون‌های جزئیات (انتخاب و ترتیب — ذخیره می‌شود)</summary>
         <div class="detail-chips">
           ${selected.map((k) => chip(k, true)).join('')}
           ${allFields.filter((k) => !selectedSet.has(k)).map((k) => chip(k, false)).join('')}
         </div>
       </details>`;

    const extra = group.count - valid.length;

    UI.infoModal(
      `گروه ${U.faWidth(group.width)}-${group.hasRule ? U.faNum(group.standardLength) : '—'}-${U.faNum(group.setupNumber)}`,
      `
      <div class="audit-stats">
        <div>تعداد رول: <b>${U.faNum(group.count)}</b></div>
        <div>عرض: <b>${U.faWidth(group.width)}</b></div>
        <div>ضخامت: <b>${U.faNum(group.thickness)}</b></div>
        <div>متراژ استاندارد: <b>${group.hasRule ? U.faNum(group.standardLength) : '—'}</b></div>
      </div>
      ${colsHtml}
      <div id="group-details-table-wrap"></div>
      ${extra > 0 ? `<p class="muted">و ${U.faNum(extra)} رول دیگر (رکورد حذف‌شده)…</p>` : ''}
      `
    );

    // صفحه‌بندی کارا: تغییر صفحه فقط جدول را دوباره رندر می‌کند (بدون بستن مودال)
    RollsView._groupDetailPage = 1;
    const renderPage = (page) => {
      RollsView._groupDetailPage = page;
      UI.renderTable(document.getElementById('group-details-table-wrap'), columns, valid, {
        page,
        pageSize: RM.config.PAGE_SIZE,
        emptyText: 'رکوردی برای این گروه یافت نشد.',
        onPageChange: (nextPage) => renderPage(nextPage),
      });
    };
    renderPage(1);

    // ---------- رویدادهای انتخاب‌گر ستون‌ها ----------
    const picker = document.querySelector('.detail-cols-picker');
    if (!picker) return;

    picker.querySelectorAll('[data-col-on]').forEach((btn) =>
      btn.addEventListener('click', () => RollsView.changeDetailColumns(selected, btn.dataset.colOn, 'on'))
    );
    picker.querySelectorAll('[data-col-off]').forEach((btn) =>
      btn.addEventListener('click', () => RollsView.changeDetailColumns(selected, btn.dataset.colOff, 'off'))
    );
    picker.querySelectorAll('[data-col-up]').forEach((btn) =>
      btn.addEventListener('click', () => RollsView.changeDetailColumns(selected, btn.dataset.colUp, 'up'))
    );
    picker.querySelectorAll('[data-col-down]').forEach((btn) =>
      btn.addEventListener('click', () => RollsView.changeDetailColumns(selected, btn.dataset.colDown, 'down'))
    );
  };

  /** تغییر ترتیب/انتخاب ستون‌های جزئیات + ذخیرهٔ ماندگار + رندر مجدد */
  RollsView.changeDetailColumns = async function (current, key, action) {
    let next = [...current];
    const i = next.indexOf(key);

    if (action === 'on' && i === -1) {
      next.push(key);
    } else if (action === 'off' && i !== -1) {
      next.splice(i, 1);
    } else if (action === 'up' && i > 0) {
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
    } else if (action === 'down' && i !== -1 && i < next.length - 1) {
      [next[i + 1], next[i]] = [next[i], next[i + 1]];
    }

    if (!next.length) next = [...RM.config.DETAIL_DEFAULT_COLUMNS];   // حداقل یک ستون

    await DB.setSetting('rollDetailColumns', next);

    // رندر مجدد همان مودال با ستون‌های جدید
    const group = RollsView._lastDetailGroup;
    if (group) RollsView.showGroupDetails(group);
  };

  /** رندر نما (هنگام تعویض تب — داده از Cache موتور محاسبه) */
  RollsView.render = function () {
    RollsView.renderColumnOrderPanel();       // نسخهٔ ۲٫۶ — هم‌گام با تنظیمات
    RollsView.renderTable();
  };

  RM.views = RM.views || {};
  RM.views.rolls = RollsView;
})();
