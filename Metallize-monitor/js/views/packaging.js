/* =========================================================================
   views/packaging.js — نما/تب «بسته‌بندی» (نسخهٔ ۳٫۱۳)
   -------------------------------------------------------------------------
   رابط کاربری صفحهٔ بسته‌بندی — تمام محاسبات از موتور مرکزی
   (js/packaging.js — RM.packaging.buildPlan) مصرف می‌شود؛ این فایل
   فقط نمایش/تعامل است و هیچ منطق تخصیص/بهینه‌سازی مستقل ندارد.

   ساختار صفحه (۳٫۱۳):
     ۱) کارت Import فایل مدیریت پالت‌ها (drop-pallets — هدف 'pallets')
     ۲) خلاصهٔ برنامه (وسط‌چین) — پالت‌های «فروش» همیشه کنار (بند ۵)
     ۳) هشدارهای داده‌ای اختصاصی همین صفحه (§24 سند + دریل با صفحه‌بندی سالم)
     ۴) چهار زیرتب:
        · برنامهٔ بسته‌بندی — فقط بسته‌های «قابل اقدام» (بند ۷) با ستون‌های
          «پالت‌های هر بسته» (بند ۳) و «رول‌های هر بسته» (بند ۴) + ۵ ستون
          ویژگی مجزا (بند ۸) + ظرفیت «X از Y» (بند ۲) + خروجی اکسل (بند ۱۱)
        · پالت‌ها
        · رول‌ها و ردیابی
        · نمایش گرافیکی (بند ۱۴) — کارت‌های رنگی ۱۵تایی در صفحه + خروجی PNG/PDF

   هر سه جدول بلند (بند ۶): پنل‌های «ترتیب ستون‌ها» و «مرتب‌سازی» مثل
   گزارش ستاپ‌ها (چیپ کشیدنی + عرض ستون + چشم مخفی‌سازی + ماندگار) +
   فیلتر زیر سرستون همهٔ ستون‌ها (بند ۱) + ماندگاری «ردیف‌های قابل نمایش».
   ========================================================================= */

'use strict';

(function () {
  const U = RM.utils;
  const UI = RM.ui;
  const db = RM.db.db;
  const PK = RM.packaging;

  const PackagingView = {
    state: {
      tables: {           // فیلترهای هر جدول (جلسه‌ای) — visibleRows از cfg هر جدول
        plan: { filters: {} },
        pallets: { filters: {} },
        rolls: { filters: {} },
      },
      graphSelected: new Set(),   // شمارهٔ بسته‌های انتخاب‌شده برای نمایش گرافیکی (ماندگار)
      graphPage: 1,               // صفحهٔ فعلی نمایش گرافیکی (جلسه‌ای)
    },
    ctls: {},             // کنترل جدول‌ها: { plan, pallets, rolls }
    _records: null,
    _plan: null,
  };

  /* ================================================================
     ۰) ثابت‌های نمایش گرافیکی (بند ۱۴)
     ================================================================ */

  /** تعداد کارت در هر صفحهٔ نمایش گرافیکی (~۱۵ — سند بند ۱۴) */
  const GRAPH_PAGE_SIZE = 15;

  /** پالت رنگ‌های تفکیکی کارت‌ها (چرخشی — بدون آبی/نیلی) */
  const GRAPH_COLORS = [
    '#047857', '#b45309', '#be123c', '#0d9488', '#ea580c',
    '#15803d', '#a16207', '#9333ea', '#db2777', '#65a30d',
    '#c2410c', '#0f766e', '#b91c1c', '#7e22ce', '#4d7c0f',
  ];

  /* ================================================================
     ۱) رجیستری ستون‌ها + پیکربندی ماندگار هر جدول (بند ۶)
     ================================================================
     الگوی گزارش ستاپ‌ها: هر جدول یک «کنترل» دارد با
       order   — ترتیب ستون‌ها (کشیدنی)
       widths  — عرض ستون‌ها (px)
       hidden  — ستون‌های مخفی (چشم)
       sort    — خط لولهٔ مرتب‌سازی چندمرحله‌ای
       sortVisible / colsVisible — باز/بسته بودن پنل‌ها
       visibleRows — «ردیف‌های قابل نمایش» (بند ۱ — ماندگار)
     همه در یک appSettings ذخیره می‌شود (packPlanCfg / packPalletsCfg / packRollsCfg). */

  const TABLE_DEFS = {
    plan: {
      settingKey: 'packPlanCfg',
      defaults: {
        order: ['no', 'pallets', 'rollsList', 'filmType', 'width', 'thickness', 'grade',
          'diameter', 'computedType', 'capacity', 'pkgType', 'reserve', 'moves', 'actions'],
        widths: {
          no: 52, pallets: 172, rollsList: 198, filmType: 92, width: 76, thickness: 80,
          grade: 70, diameter: 62, computedType: 104, capacity: 112, pkgType: 112,
          reserve: 84, moves: 88, actions: 178,
        },
        hidden: [],
        sort: [{ field: 'no', direction: 'asc' }],
        visibleRows: 50,
      },
      fields: {
        no:            { label: 'شمارهٔ بسته', numeric: true, valueOf: (p) => p.no },
        mainPalletNo:  { label: 'پالت اصلی', valueOf: (p) => p.mainPalletNo },
        palletCount:   { label: 'تعداد پالت بسته', numeric: true, valueOf: (p) => p.palletParts.length },
        rollCount:     { label: 'تعداد رول بسته', numeric: true, valueOf: (p) => p.finalCount },
        filmType:      { label: 'فیلم', valueOf: (p) => p.filmType },
        width:         { label: 'عرض', numeric: true, valueOf: (p) => p.width },
        thickness:     { label: 'ضخامت', numeric: true, valueOf: (p) => p.thickness },
        grade:         { label: 'گرید', valueOf: (p) => p.grade },
        diameter:      { label: 'قطر', numeric: true, valueOf: (p) => p.diameter },
        computedType:  { label: 'نوع بسته‌بندی', valueOf: (p) => p.computedType },
        finalCount:    { label: 'ظرفیت فعلی', numeric: true, valueOf: (p) => p.finalCount },
        stdCapacity:   { label: 'ظرفیت استاندارد', numeric: true, valueOf: (p) => p.stdCapacity },
        target:        { label: 'ظرفیت هدف', numeric: true, valueOf: (p) => p.target },
        pkgType:       { label: 'نوع بسته', valueOf: (p) => PK.PACKAGE_TYPE_LABELS[p.type] || p.type },
        reserveCount:  { label: 'تعداد رزرو', numeric: true, valueOf: (p) => p.reserveRolls.length },
        moves:         { label: 'جابه‌جایی', numeric: true, valueOf: (p) => p.moves },
      },
    },
    pallets: {
      settingKey: 'packPalletsCfg',
      defaults: {
        order: ['palletNo', 'palletId', 'filmType', 'line', 'width', 'thickness', 'grade',
          'diameter', 'packTypeExcel', 'computedType', 'rollCount', 'stdCapacity',
          'palletStatus', 'planState', 'warehouse', 'productionDate', 'actions'],
        widths: {
          palletNo: 140, palletId: 78, filmType: 90, line: 70, width: 74, thickness: 78,
          grade: 66, diameter: 62, packTypeExcel: 88, computedType: 94, rollCount: 70,
          stdCapacity: 92, palletStatus: 102, planState: 208, warehouse: 150,
          productionDate: 120, actions: 100,
        },
        hidden: [],
        sort: [{ field: 'palletNo', direction: 'asc' }],
        visibleRows: 50,
      },
      fields: {
        palletNo:       { label: 'شماره پالت', valueOf: (p) => p.palletNo },
        palletId:       { label: 'شناسه', valueOf: (p) => p.palletId },
        filmType:       { label: 'نوع فیلم', valueOf: (p) => p.filmType },
        line:           { label: 'خط تولید', valueOf: (p) => p.line },
        width:          { label: 'عرض', numeric: true, valueOf: (p) => p.width },
        thickness:      { label: 'ضخامت', numeric: true, valueOf: (p) => p.thickness },
        grade:          { label: 'گرید', valueOf: (p) => p.grade },
        diameter:       { label: 'قطر', numeric: true, valueOf: (p) => p.diameter },
        packTypeExcel:  { label: 'نوع اکسل', valueOf: (p) => p.packTypeExcel },
        computedType:   { label: 'نوع محاسبه‌شده', valueOf: (p) => p.computedType },
        rollCount:      { label: 'تعداد رول', numeric: true, valueOf: (p) => p.rollCount },
        stdCapacity:    { label: 'ظرفیت استاندارد', numeric: true, valueOf: (p) => p.stdCapacity },
        palletStatus:   { label: 'وضعیت پالت', valueOf: (p) => PK.PALLET_STATUS_LABELS[p.palletStatus] || p.palletStatus },
        planState:      { label: 'وضعیت در برنامه', valueOf: (p) => PK.PLAN_STATE_LABELS[p.planState] || p.planState },
        warehouse:      { label: 'انبار', valueOf: (p) => p.warehouse },
        productionDate: { label: 'تاریخ تولید', valueOf: (p) => p.record.productionDate },
      },
    },
    rolls: {
      settingKey: 'packRollsCfg',
      defaults: {
        order: ['roll', 'origin', 'filmType', 'width', 'thickness', 'grade', 'diameter',
          'packageNo', 'role', 'move', 'status'],
        widths: {
          roll: 158, origin: 140, filmType: 90, width: 72, thickness: 78, grade: 66,
          diameter: 60, packageNo: 70, role: 84, move: 148, status: 208,
        },
        hidden: [],
        sort: [{ field: 'origin', direction: 'asc' }, { field: 'roll', direction: 'asc' }],
        visibleRows: 50,
      },
      fields: {
        roll:        { label: 'شماره رول', valueOf: (r) => r.roll },
        origin:      { label: 'پالت مبدأ', valueOf: (r) => r.pallet.palletNo },
        filmType:    { label: 'نوع فیلم', valueOf: (r) => r.pallet.filmType },
        width:       { label: 'عرض', numeric: true, valueOf: (r) => r.pallet.width },
        thickness:   { label: 'ضخامت', numeric: true, valueOf: (r) => r.pallet.thickness },
        grade:       { label: 'گرید', valueOf: (r) => r.pallet.grade },
        diameter:    { label: 'قطر', numeric: true, valueOf: (r) => r.pallet.diameter },
        packageNo:   { label: 'بسته', numeric: true, valueOf: (r) => r.packageNo },
        role:        { label: 'نقش', valueOf: (r) => (r.role === 'main' ? 'اصلی' : r.role === 'complement' ? 'مکمل' : null) },
        move:        { label: 'انتقال', valueOf: (r) => r.movedToPalletNo },
        status:      { label: 'وضعیت نهایی', valueOf: (r) => PK.ROLL_STATUS_LABELS[r.status] || r.status },
      },
    },
  };

  /** مقایسه‌گر عمومی (عددی/متنی — تهی‌ها آخر) برای مرتب‌سازی چندمرحله‌ای */
  function cmpByField(meta, a, b, direction) {
    const va = meta.valueOf(a);
    const vb = meta.valueOf(b);
    let r;
    if (meta.numeric) {
      r = U.compareNumeric(va, vb, 'asc');
    } else {
      const sa = (va === null || va === undefined || va === '') ? null : String(va);
      const sb = (vb === null || vb === undefined || vb === '') ? null : String(vb);
      if (sa === null && sb === null) r = 0;
      else if (sa === null) r = 1;
      else if (sb === null) r = -1;
      else r = sa.localeCompare(sb, 'fa', { numeric: true });
    }
    return direction === 'desc' ? -r : r;
  }

  /** ساخت کنترل یک جدول (بارگذاری ماندگار + مرتب‌سازی + ستون‌ها) */
  function makeTableCtl(name) {
    const def = TABLE_DEFS[name];
    const ctl = {
      name,
      def,
      cfg: null,

      async load() {
        const saved = (await RM.db.getSetting(def.settingKey, null)) || {};
        const cfg = {
          order: Array.isArray(saved.order) && saved.order.length ? [...saved.order] : [...def.defaults.order],
          widths: Object.assign({}, def.defaults.widths, saved.widths || {}),
          hidden: Array.isArray(saved.hidden) ? [...saved.hidden] : [...def.defaults.hidden],
          sort: Array.isArray(saved.sort) && saved.sort.length
            ? saved.sort.map((s) => ({ field: s.field, direction: s.direction === 'desc' ? 'desc' : 'asc' }))
            : JSON.parse(JSON.stringify(def.defaults.sort)),
          sortVisible: saved.sortVisible !== false,
          colsVisible: saved.colsVisible !== false,
          visibleRows: Number(saved.visibleRows) > 0 ? Number(saved.visibleRows) : def.defaults.visibleRows,
        };
        /* مهاجرت نرم: کلیدهای جدیدِ ترتیب پیش‌فرض که در ذخیرهٔ قدیمی نیستند،
           بعد از ستونِ قبلیِ خود در ترتیب پیش‌فرض درج می‌شوند */
        const missing = def.defaults.order.filter((k) => !cfg.order.includes(k));
        for (const key of missing) {
          const prev = def.defaults.order[def.defaults.order.indexOf(key) - 1];
          const at = prev ? cfg.order.indexOf(prev) : -1;
          if (at !== -1) cfg.order.splice(at + 1, 0, key);
          else cfg.order.push(key);
        }
        ctl.cfg = cfg;
      },

      async save() {
        await RM.db.setSetting(def.settingKey, ctl.cfg);
      },

      /** اعمال عرض‌های ماندگار روی رجیستری ستون‌ها (0/خالی = خودکار) */
      applyWidths(registry) {
        for (const col of Object.values(registry)) {
          const w = Number(ctl.cfg.widths[col.key]);
          col.width = Number.isFinite(w) && w > 0 ? w : undefined;
        }
      },

      /** ستون‌های قابل نمایش به ترتیب کاربر (بدون مخفی‌شده‌ها) */
      visibleColumns(registry) {
        const hiddenSet = new Set(ctl.cfg.hidden);
        return ctl.cfg.order
          .map((k) => registry[k])
          .filter(Boolean)
          .filter((c) => !hiddenSet.has(c.key));
      },

      /** مرتب‌سازی چندمرحله‌ای (از آخرین اولویت به اولین — پایدار) */
      applySort(rows) {
        const pipeline = (ctl.cfg.sort && ctl.cfg.sort.length)
          ? ctl.cfg.sort
          : def.defaults.sort;
        const sorted = [...rows];
        for (let i = pipeline.length - 1; i >= 0; i--) {
          const { field, direction } = pipeline[i];
          const meta = def.fields[field];
          if (!meta) continue;
          sorted.sort((a, b) => cmpByField(meta, a, b, direction));
        }
        return sorted;
      },
    };
    return ctl;
  }

  /** همسان‌سازی منطق فیلتر با UI.filterTable (برای خروجی اکسل — بند ۱۱) */
  PackagingView.filterRows = function (rows, columns, state) {
    const filterable = columns.filter((c) => c.filterable !== false);
    return rows.filter((row) => filterable.every((c) => {
      const f = UI.filterStateOf(state, c.key);
      if (String(f.value ?? '').trim() === '') return true;
      return UI.filterContains(
        c.tokens ? c.tokens(row) : [String(row[c.key] ?? '')],
        f.value, f.invert
      );
    }));
  };

  /* ================================================================
     ۲) راه‌اندازی
     ================================================================ */

  PackagingView.init = async function () {
    /* --- بارگذاری پیکربندی ماندگار هر سه جدول (بند ۱ و ۶) --- */
    for (const name of Object.keys(TABLE_DEFS)) {
      PackagingView.ctls[name] = makeTableCtl(name);
      await PackagingView.ctls[name].load();
    }

    /* --- انتخاب ماندگار نمایش گرافیکی (بند ۱۴) --- */
    const savedSel = (await RM.db.getSetting('packGraphSelection', null)) || [];
    PackagingView.state.graphSelected = new Set(
      (Array.isArray(savedSel) ? savedSel : []).map(Number).filter(Number.isFinite));

    /* --- کارت Import فایل پالت‌ها (الگوی مشترک ورود داده‌ها) --- */
    const dropzone = document.getElementById('drop-pallets');
    const input = document.getElementById('file-pallets');
    if (dropzone && input) {
      dropzone.addEventListener('click', () => input.click());
      dropzone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          input.click();
        }
      });
      input.addEventListener('change', () => {
        if (input.files && input.files[0]) {
          PackagingView.handleFile(input.files[0]);
          input.value = '';
        }
      });
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
        if (file) PackagingView.handleFile(file);
      });
    }

    /* --- زیرتب‌ها (محدود به همین صفحه — الگوی lists.js) --- */
    document.querySelectorAll('#view-packaging .subtab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#view-packaging .subtab-btn').forEach((b) => {
          const active = b === btn;
          b.classList.toggle('active', active);
          b.setAttribute('aria-selected', String(active));
        });
        const target = btn.dataset.pksubview;
        document.querySelectorAll('#view-packaging .subview').forEach((el) => {
          const active = el.id === `pksubview-${target}`;
          el.classList.toggle('active', active);
          el.hidden = !active;
        });
      });
    });

    /* --- پنل‌های مرتب‌سازی/ترتیب ستون‌های هر سه جدول (بند ۶ — الگوی ستاپ‌ها) --- */
    for (const name of Object.keys(TABLE_DEFS)) {
      const ctl = PackagingView.ctls[name];

      const addSelect = document.getElementById(`pack-${name}-sort-add-select`);
      if (addSelect) {
        addSelect.innerHTML = '<option value="">افزودن فیلد…</option>' +
          Object.entries(TABLE_DEFS[name].fields)
            .map(([k, v]) => `<option value="${k}">${U.escapeHtml(v.label)}</option>`)
            .join('');
      }
      const addBtn = document.getElementById(`pack-${name}-sort-add-btn`);
      if (addBtn) addBtn.addEventListener('click', () => {
        const field = addSelect ? addSelect.value : '';
        if (!field) return;
        if (ctl.cfg.sort.some((s) => s.field === field)) {
          UI.toast('این فیلد قبلاً به مرتب‌سازی اضافه شده است.', 'info');
          return;
        }
        ctl.cfg.sort.push({ field, direction: 'asc' });
        ctl.save().then(() => PackagingView.rerenderTable(name));
      });
      const sortReset = document.getElementById(`pack-${name}-sort-reset-btn`);
      if (sortReset) sortReset.addEventListener('click', () => {
        ctl.cfg.sort = JSON.parse(JSON.stringify(TABLE_DEFS[name].defaults.sort));
        ctl.save().then(() => PackagingView.rerenderTable(name));
        UI.toast('مرتب‌سازی این جدول به حالت پیش‌فرض بازگشت.', 'info');
      });
      const colsReset = document.getElementById(`pack-${name}-cols-reset-btn`);
      if (colsReset) colsReset.addEventListener('click', () => {
        ctl.cfg.order = [...TABLE_DEFS[name].defaults.order];
        ctl.cfg.widths = { ...TABLE_DEFS[name].defaults.widths };
        ctl.cfg.hidden = [...TABLE_DEFS[name].defaults.hidden];
        ctl.save().then(() => PackagingView.rerenderTable(name));
        UI.toast('ترتیب، عرض و نمایش ستون‌های این جدول به حالت پیش‌فرض بازگشت.', 'info');
      });
    }

    /* --- دکمهٔ «خروجی اکسل» بالای جدول برنامه (بند ۱۱) --- */
    const excelBtn = document.getElementById('pack-excel-btn');
    if (excelBtn) excelBtn.addEventListener('click', () => PackagingView.exportPlanExcel());

    /* --- دکمه‌های نمایش گرافیکی (بند ۱۴) --- */
    const graphClear = document.getElementById('pack-graph-clear');
    if (graphClear) graphClear.addEventListener('click', () => {
      PackagingView.state.graphSelected.clear();
      PackagingView.saveGraphSelection();
      PackagingView.renderGraphView(PackagingView._plan);
      PackagingView.renderPlanTable(PackagingView._plan);
      UI.toast('همهٔ بسته‌ها از نمایش گرافیکی حذف شدند.', 'info');
    });
    const graphPng = document.getElementById('pack-graph-png');
    if (graphPng) graphPng.addEventListener('click', () => PackagingView.exportGraphImage());
    const graphPdf = document.getElementById('pack-graph-pdf');
    if (graphPdf) graphPdf.addEventListener('click', () => PackagingView.exportGraphPdf());
  };

  /** بازسازی کامل یک جدول + پنل‌های آن (پس از تغییر ترتیب/مرتب‌سازی/عرض) */
  PackagingView.rerenderTable = function (name) {
    const plan = PackagingView._plan;
    if (!plan) return;
    if (name === 'plan') PackagingView.renderPlanTable(plan);
    else if (name === 'pallets') PackagingView.renderPalletsTable(plan);
    else if (name === 'rolls') PackagingView.renderRollsTable(plan);
  };

  /** نمایش/مخفی پنل‌های سازندهٔ یک جدول بر اساس cfg */
  PackagingView.applyPanelsFor = function (name) {
    const ctl = PackagingView.ctls[name];
    if (!ctl || !ctl.cfg) return;
    const sortBuilder = document.getElementById(`pack-${name}-sort-builder`);
    if (sortBuilder) sortBuilder.hidden = !ctl.cfg.sortVisible;
    const colsBuilder = document.getElementById(`pack-${name}-cols-builder`);
    if (colsBuilder) colsBuilder.hidden = !ctl.cfg.colsVisible;
  };

  /** رندر پنل مرتب‌سازی یک جدول (چیپ‌های کشیدنی) */
  PackagingView.renderSortBuilderFor = function (name) {
    const ctl = PackagingView.ctls[name];
    const wrap = document.getElementById(`pack-${name}-sort-pipeline`);
    if (!ctl || !ctl.cfg || !wrap) return;
    UI.sortPanel(wrap, ctl.cfg.sort, TABLE_DEFS[name].fields, {
      onDir: (i) => {
        ctl.cfg.sort[i].direction = ctl.cfg.sort[i].direction === 'asc' ? 'desc' : 'asc';
        ctl.save().then(() => PackagingView.rerenderTable(name));
      },
      onRemove: (i) => {
        ctl.cfg.sort.splice(i, 1);
        ctl.save().then(() => PackagingView.rerenderTable(name));
      },
      onReorder: (from, to) => {
        const [moved] = ctl.cfg.sort.splice(from, 1);
        ctl.cfg.sort.splice(to, 0, moved);
        ctl.save().then(() => PackagingView.rerenderTable(name));
      },
      emptyText: 'مرتب‌سازی پیش‌فرض',
    });
  };

  /** رندر پنل ترتیب ستون‌های یک جدول (کشیدن + عرض + چشم) */
  PackagingView.renderColsBuilderFor = function (name, registry) {
    const ctl = PackagingView.ctls[name];
    const wrap = document.getElementById(`pack-${name}-cols-pipeline`);
    if (!ctl || !ctl.cfg || !wrap) return;
    const all = registry || {};
    const items = ctl.cfg.order
      .map((key) => all[key])
      .filter(Boolean)
      .map((c) => ({ key: c.key, label: c.label, width: ctl.cfg.widths[c.key] ?? 0, hidden: ctl.cfg.hidden.includes(c.key) }));

    UI.orderPanel(wrap, items, {
      onMove: async (from, to) => {
        const [moved] = ctl.cfg.order.splice(from, 1);
        ctl.cfg.order.splice(to, 0, moved);
        await ctl.save();
        PackagingView.rerenderTable(name);
      },
      onWidth: async (key, w) => {
        ctl.cfg.widths[key] = w;
        await ctl.save();
        PackagingView.rerenderTable(name);
      },
      onToggle: async (key, hidden) => {
        const set = new Set(ctl.cfg.hidden);
        if (hidden) set.add(key);
        else set.delete(key);
        ctl.cfg.hidden = [...set];
        await ctl.save();
        PackagingView.rerenderTable(name);
        UI.toast(hidden
          ? `ستون «${U.escapeHtml((all[key] || {}).label || key)}» در جدول مخفی شد — از پنل ترتیب ستون‌ها (چشم) دوباره نمایش داده می‌شود.`
          : `ستون «${U.escapeHtml((all[key] || {}).label || key)}» دوباره نمایش داده شد.`, 'info');
      },
      emptyText: 'بدون ستون',
    });
  };

  /* ================================================================
     ۳) Import فایل مدیریت پالت‌ها
     ================================================================ */

  PackagingView.handleFile = async function (file) {
    const dropzone = document.getElementById('drop-pallets');
    dropzone.classList.add('loading');
    try {
      const result = await RM.importEngine.run('pallets', file, { confirm: UI.confirm });
      if (result.cancelled) {
        UI.toast('عملیات Import لغو شد؛ داده‌های قبلی دست‌نخورده باقی ماند.', 'info');
        return;
      }
      const { parsed, datasetVersion, sameFileWarning } = result;
      UI.toast(
        `فایل «${U.escapeHtml(parsed.fileName)}» وارد شد — ${U.faNum(parsed.totalRecords)} پالت ` +
        `(Dataset #${U.faNum(datasetVersion)})`,
        'success'
      );
      if (sameFileWarning) {
        UI.toast('محتوای فایل با آخرین Import یکسان بود (هش یکسان).', 'warning', 6000);
      }
      await RM.refreshAll();
    } catch (err) {
      console.error('[Packaging Import]', err.message);
      UI.toast(U.escapeHtml(err.message || 'خطای ناشناخته هنگام خواندن فایل.'), 'error', 7000);
      const statusEl = document.getElementById('status-pallets');
      if (statusEl) {
        statusEl.className = 'import-status err';
        statusEl.innerHTML = `<div class="status-row"><span class="status-icon err">${UI.icons.cross}</span>
          <b>${U.escapeHtml(err.message)}</b></div>`;
      }
    } finally {
      dropzone.classList.remove('loading');
    }
  };

  /** رندر کارت وضعیت Import (گزارشنمای اختصاصی پالت‌ها) */
  PackagingView.renderStatus = async function () {
    const statusEl = document.getElementById('status-pallets');
    if (!statusEl) return;

    const entries = await db.importMetadata
      .where('target').equals('pallets')
      .reverse()
      .sortBy('importedAt');
    const info = entries[0];

    if (!info) {
      statusEl.className = 'import-status';
      statusEl.innerHTML = '<p class="status-empty">هنوز فایلی بارگذاری نشده است.</p>';
      return;
    }

    const issues = info.issues || {};
    const nonM = issues.nonM || 0;
    const row = (label, value, warn) => warn
      ? `<button type="button" class="status-row status-row-link" data-pack-warn-total="${label}"
             title="این تعداد در گزارشنمای فایل ثبت شده است"><span class="status-icon err">${UI.icons.warning}</span>${label}: <b class="num-warn">${U.faNum(value)}</b></button>`
      : `<div class="status-row"><span class="status-icon ok">${UI.icons.check}</span>${label}: <span class="num">${U.faNum(value)}</span></div>`;

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
        <span class="chip">${RM.config.DATASET_LABELS.pallets}</span>
        <span class="chip">Dataset #${U.faNum(info.datasetVersion)}</span>
        <span class="chip chip-ok">وضعیت: ${info.status === 'ok' ? 'موفق' : (info.status || '—')}</span>
        ${info.fileHash ? `<span class="chip" title="هش فایل">#${U.escapeHtml(info.fileHash)}</span>` : ''}
      </div>
      <div class="report-grid">
        ${row('کل ردیف‌های فایل', (info.totalRecords || 0) + nonM, false)}
        ${row('ردیف بدون M (فقط شمرده شد)', nonM, nonM > 0)}
        ${row('پالت‌های ذخیره‌شده', info.totalRecords || 0, false)}
        ${(issues.palletNo || 0) > 0 ? row('پالت بدون شماره', issues.palletNo, true) : ''}
        ${(issues.noRolls || 0) > 0 ? row('پالت بدون رول (خالی)', issues.noRolls, true) : ''}
        ${(issues.noWidth || 0) > 0 ? row('پالت بدون عرض', issues.noWidth, true) : ''}
      </div>
      ${gapsHtml}
      <div class="status-row muted">تاریخ: ${U.faDate(info.importedAt)} · شییت: ${U.escapeHtml(info.sheetName || '—')}</div>
    `;
  };

  /* ================================================================
     ۴) رندر اصلی (از موتور مرکزی)
     ================================================================ */

  PackagingView.render = async function () {
    PackagingView._records = await db.pallets.toArray();
    await PackagingView.renderStatus();
    PackagingView.renderFromCache();
  };

  /** محاسبه/رندر برنامه از رکوردهای کش‌شده (بدون خواندن مجدد دیتابیس)
   *  ۳٫۱۳ — بدون scope: پالت‌های «فروش» همیشه کنار (بند ۵). */
  PackagingView.renderFromCache = function () {
    const records = PackagingView._records;
    if (!records || !records.length) {
      PackagingView._plan = null;
      const statsEl = document.getElementById('pack-stats');
      if (statsEl) {
        statsEl.innerHTML = '<p class="status-empty">برای شروع، فایل مدیریت پالت‌ها را در کادر بالا وارد کنید.</p>';
      }
      document.getElementById('pack-warnings-panel').hidden = true;
      document.getElementById('pack-plan-count').textContent = U.faNum(0);
      document.getElementById('pack-plan-stats').textContent = '';
      document.getElementById('pack-pallets-stats').textContent = '';
      document.getElementById('pack-rolls-stats').textContent = '';
      document.getElementById('pack-graph-stats').textContent = '';
      const graphWrap = document.getElementById('pack-graph-wrap');
      if (graphWrap) graphWrap.innerHTML = '<div class="empty-state">' + UI.icons.alert +
        '<h4>بسته‌ای انتخاب نشده است</h4><p>از جدول «برنامهٔ بسته‌بندی» بسته‌های دلخواه را با دکمهٔ «+ نمایش» به این صفحه اضافه کنید.</p></div>';
      for (const name of Object.keys(TABLE_DEFS)) {
        UI.filterTable(document.getElementById(`pack-${name}-table`), [], [], {
          state: PackagingView.state.tables[name],
          emptyText: 'هنوز فایل پالت‌ها وارد نشده است.',
        });
      }
      return;
    }

    const plan = PK.buildPlan(records);
    PackagingView._plan = plan;

    PackagingView.renderStats(plan);
    PackagingView.renderWarnings(plan);
    PackagingView.renderPlanTable(plan);
    PackagingView.renderPalletsTable(plan);
    PackagingView.renderRollsTable(plan);
    PackagingView.renderGraphView(plan);
  };

  /* ---------------- خلاصهٔ آماری (وسط‌چین — بند ۹) ---------------- */

  PackagingView.renderStats = function (plan) {
    const el = document.getElementById('pack-stats');
    const s = plan.stats;
    const item = (label, value, opts = {}) => `
      <div class="pack-stat${opts.cls ? ` ${opts.cls}` : ''}"${opts.title ? ` title="${U.escapeHtml(opts.title)}"` : ''}>
        <span class="pack-stat-label">${label}</span>
        <span class="pack-stat-value">${value}</span>
        ${opts.sub ? `<span class="pack-stat-sub">${opts.sub}</span>` : ''}
      </div>`;

    el.innerHTML = `
      ${item('پالت‌های فایل', U.faNum(s.palletsTotal), { sub: `${U.faNum(s.soldPallets)} فروخته‌شده (کنار)`, title: 'مجموع پالت‌های ذخیره‌شدهٔ دارای M — پالت‌های «فروش» همیشه از برنامه کنار گذاشته می‌شوند' })}
      ${item('پالت در برنامه', U.faNum(s.inScope), { sub: 'انبار + پای کار', title: 'همهٔ پالت‌های غیرفروش — چه در انبار، چه پای کار (سالن تولید)' })}
      ${item('پالت کامل', U.faNum(s.completePallets), { sub: 'بدون نیاز به اقدام', cls: 'ok' })}
      ${item('پالت ناقص', U.faNum(s.partial), { cls: s.partial ? 'warn' : '' })}
      ${item('پالت خالی', U.faNum(s.empty))}
      ${item('مستثنا (دادهٔ نامعتبر)', U.faNum(s.excluded), { cls: s.excluded ? 'warn' : '' })}
      ${item('گروه سازگار', U.faNum(s.groups), { title: 'گروه‌های پنج‌ویژگی: نوع فیلم + عرض + ضخامت + گرید + قطر بوبین' })}
      ${item('بستهٔ قابل اقدام', U.faNum(s.packagesActionable), { sub: `${U.faNum(s.packagesAssembled)} تشکیل جدید · ${U.faNum(s.packagesDowngraded)} تخلیهٔ مازاد`, cls: 'ok', title: `بسته‌هایی که نیاز به تغییر دارند و در جدول برنامه نمایش داده می‌شوند — ${U.faNum(s.packagesAsIs)} بستهٔ دیگر در ظرفیت هدف بدون امکان بهبودند و نمایش داده نمی‌شوند` })}
      ${item('جابه‌جایی رول', U.faNum(s.movesTotal), { title: 'تعداد رول‌هایی که باید بین پالت‌ها جابه‌جا شوند' })}
      ${item('پالت نیازمند آوردن از انبار', U.faNum(s.recallPalletCount), { title: 'پالت‌های درگیر بسته‌ها که در انبارند و باید به ایستگاه بسته‌بندی آورده شوند (پالت‌های «پای کار» در سالن تولیدند و آوردن نمی‌خواهند)' })}
      ${item('رول بسته‌بندی‌شده', U.faNum(s.rollsPacked), { sub: `از ${U.faNum(s.rollsInScope)} رول درون برنامه` })}
      ${item('رول رزرو', U.faNum(s.rollsReserve), { title: 'رول‌های باقی‌ماندهٔ هم‌ویژگی — جایگزین QC' })}
      ${item('رول باقی‌مانده', U.faNum(s.rollsLeftover))}
      ${item('پالت غیرقابل بسته‌بندی', U.faNum(s.unpackedPallets), { cls: s.unpackedPallets ? 'warn' : '' })}
    `;
  };

  /* ---------------- هشدارهای داده‌ای (§24) ---------------- */

  PackagingView.renderWarnings = function (plan) {
    const panel = document.getElementById('pack-warnings-panel');
    const wrap = document.getElementById('pack-warnings');
    if (!plan.warnings.length) {
      panel.hidden = true;
      wrap.innerHTML = '';
      return;
    }
    panel.hidden = false;
    wrap.innerHTML = plan.warnings.map((w) => `
      <button type="button" class="status-row status-row-link" data-pack-warning="${w.key}"
        title="نمایش پالت‌ها و رول‌های درگیر">
        <span class="status-icon err">${UI.icons.warning}</span>
        <b>${U.escapeHtml(w.label)}:</b> <b class="num-warn">${U.faNum(w.pallets.length)}</b> پالت
        <span class="drill-hint">مشاهده ←</span>
      </button>`).join('');
    wrap.querySelectorAll('[data-pack-warning]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const w = plan.warnings.find((x) => x.key === btn.dataset.packWarning);
        if (w) PackagingView.showWarningDrill(w, plan);
      });
    });
  };

  /** دریل هشدار: پالت‌های درگیر + صفحه‌بندی سالم + وسط‌چین (بند ۱۳) */
  PackagingView.showWarningDrill = function (w, plan) {
    const titles = {
      mismatch: 'مغایرت نوع بسته‌بندی — پالت‌های درگیر',
      invalidPack: 'نوع بسته‌بندی نامعتبر — پالت‌های درگیر',
      noWidth: 'عرض نامشخص — پالت‌های درگیر',
      unknownLine: 'خط تولید نامشخص — پالت‌های درگیر',
    };
    const columns = [
      {
        key: 'palletNo', label: 'شماره پالت', className: 'ltr',
        render: (p) => `<b>${U.escapeHtml(p.palletNo || '—')}</b>`,
        tokens: (p) => [p.palletNo || ''],
      },
      { key: 'palletId', label: 'شناسه', render: (p) => U.escapeHtml(p.palletId || '—'), tokens: (p) => [p.palletId || ''] },
      { key: 'filmType', label: 'نوع فیلم', render: (p) => U.escapeHtml(p.filmType || '—'), tokens: (p) => [p.filmType || ''] },
      { key: 'width', label: 'عرض', render: (p) => p.width === null ? '<span class="muted">—</span>' : U.faWidth(p.width), tokens: (p) => p.width === null ? [] : [U.faWidth(p.width), String(p.width)] },
      { key: 'thickness', label: 'ضخامت', render: (p) => p.thickness === null ? '<span class="muted">—</span>' : U.faNum(p.thickness), tokens: (p) => p.thickness === null ? [] : [U.faNum(p.thickness), String(p.thickness)] },
      { key: 'grade', label: 'گرید', render: (p) => U.escapeHtml(p.grade || '—'), tokens: (p) => [p.grade || ''] },
      {
        key: 'excel', label: 'نوع اکسل',
        render: (p) => p.packTypeExcel ? U.escapeHtml(p.packTypeExcel) : '<span class="num-warn">خالی</span>',
        tokens: (p) => [p.packTypeExcel || ''],
      },
      {
        key: 'computed', label: 'محاسبه‌شده',
        render: (p) => p.computedType ? U.escapeHtml(p.computedType) : '<span class="muted">—</span>',
        tokens: (p) => [p.computedType || ''],
      },
      { key: 'rolls', label: 'رول‌ها', render: (p) => U.faNum(p.rollCount), tokens: (p) => [String(p.rollCount)] },
      { key: 'warehouse', label: 'انبار', render: (p) => U.escapeHtml(p.warehouse || '—'), tokens: (p) => [p.warehouse || ''] },
      {
        key: 'actions', label: 'عملیات', filterable: false,
        render: (p) => `<button type="button" class="btn btn-ghost btn-sm" data-pack-pal="${U.escapeHtml(p.palletNo)}">جزئیات</button>`,
      },
    ];

    UI.infoModal(`${titles[w.key] || w.label} — ${U.faNum(w.pallets.length)} پالت`, `
      <div class="drill-subtitle">
        ${w.key === 'mismatch'
          ? 'نوع بسته‌بندی محاسبه‌شدهٔ سامانه (قوانین خط تولید/عرض/قطر) با مقدار اکسل یکی نیست — پالت همچنان با قطر استخراج‌شده در برنامه است:'
          : 'قطر بوبین از مقدار اکسل قابل استخراج نیست یا دادهٔ لازم نقص دارد — پالت وارد برنامهٔ بسته‌بندی نشده:'}
      </div>
      <div id="pack-warn-table"></div>
    `, { wide: true });

    /* ۳٫۱۳ — بند ۱۳: صفحه‌بندی واقعی (ابتدا/قبلی/بعدی/انتها) + وسط‌چین */
    const tableEl = document.getElementById('pack-warn-table');
    const renderPage = (page) => {
      UI.renderTable(tableEl, columns, w.pallets, {
        page,
        pageSize: RM.config.PAGE_SIZE,
        emptyText: 'پالتی یافت نشد.',
        centered: true,
        onPageChange: (next) => renderPage(next),
      });
      tableEl.querySelectorAll('[data-pack-pal]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const p = plan.pallets.find((x) => x.palletNo === btn.dataset.packPal);
          if (p) PackagingView.showPalletModal(p, plan);
        });
      });
    };
    renderPage(1);
  };

  /* ================================================================
     ۵) جدول برنامهٔ بسته‌بندی (بندهای ۱/۲/۳/۴/۷/۸/۱۱/۱۴)
     ================================================================ */

  /** رجیستری ستون‌های جدول برنامه (مشترک رندر و خروجی اکسل) */
  PackagingView.planColumns = function () {
    const sel = PackagingView.state.graphSelected;
    const registry = {
      no: {
        key: 'no', label: '#',
        render: (x) => U.faNum(x.no),
        tokens: (x) => [String(x.no)],
      },
      pallets: {
        key: 'pallets', label: 'پالت‌های هر بسته', className: 'pk-list-cell',
        headerTitle: 'همهٔ پالت‌های شرکت‌کننده در این بسته (اصلی + مکمل) — نشان ⚡ یعنی پالت «پای کار» است و در انبار نیست',
        render: (x) => '<div class="pk-pal-list">' + x.palletParts.map((pt, i) =>
          `<div class="pk-pal-item${pt.atBase ? ' at-base' : ''}"` +
          ` title="${U.escapeHtml(pt.warehouse || '—')}${pt.atBase
            ? ' — پای کار: در سالن تولید است و نیازی به آوردن از انبار ندارد'
            : ' — در انبار: باید به ایستگاه بسته‌بندی آورده شود'}">` +
          `<span class="pk-pal-idx">${U.faNum(i + 1)}-</span>` +
          `<span class="ltr pk-pal-no">${U.escapeHtml(pt.palletNo)}</span>` +
          (pt.atBase ? '<span class="pk-base-badge">⚡ پای کار</span>' : '') +
          '</div>').join('') + '</div>',
        tokens: (x) => x.palletParts.flatMap((pt) => [pt.palletNo, pt.warehouse || '']),
      },
      rollsList: {
        key: 'rollsList', label: 'رول‌های هر بسته', className: 'pk-list-cell',
        headerTitle: 'رول‌های هر پالتِ این بسته — زیر شمارهٔ همان پالت',
        render: (x) => '<div class="pk-rolls-list">' + x.palletParts.map((pt, i) =>
          `<div class="pk-rolls-group" title="پالت ${U.faNum(i + 1)}: ${U.escapeHtml(pt.palletNo)}">` +
          `<span class="pk-pal-idx">${U.faNum(i + 1)}-</span>` +
          '<span class="pk-rolls-col">' +
          pt.rolls.map((r) => `<span class="pk-roll ltr">${U.escapeHtml(r.roll)}</span>`).join('') +
          '</span></div>').join('') + '</div>',
        tokens: (x) => x.palletParts.flatMap((pt) => pt.rolls.map((r) => r.roll)),
      },
      filmType: {
        key: 'filmType', label: 'فیلم',
        render: (x) => U.escapeHtml(x.filmType),
        tokens: (x) => [x.filmType],
      },
      width: {
        key: 'width', label: 'عرض',
        render: (x) => U.faWidth(x.width),
        tokens: (x) => [U.faWidth(x.width), String(x.width)],
      },
      thickness: {
        key: 'thickness', label: 'ضخامت',
        render: (x) => x.thickness === null ? '<span class="muted">—</span>' : U.faNum(x.thickness),
        tokens: (x) => x.thickness === null ? [] : [U.faNum(x.thickness), String(x.thickness)],
      },
      grade: {
        key: 'grade', label: 'گرید',
        render: (x) => U.escapeHtml(x.grade || '—'),
        tokens: (x) => [x.grade || ''],
      },
      diameter: {
        key: 'diameter', label: 'قطر',
        render: (x) => `${U.faNum(x.diameter)}″`,
        tokens: (x) => [String(x.diameter)],
      },
      computedType: {
        key: 'computedType', label: 'نوع بسته‌بندی',
        render: (x) => `<b>${U.escapeHtml(x.computedType)}</b>`,
        headerTitle: 'نوع بسته‌بندی محاسبه‌شدهٔ سامانه (جهت + قطر بوبین)',
        tokens: (x) => [x.computedType],
      },
      capacity: {
        key: 'capacity', label: 'ظرفیت نهایی',
        headerTitle: 'تعداد رول فعلی بسته از ظرفیت استاندارد پالت',
        render: (x) => `<b>${U.faNum(x.finalCount)}</b> <span class="muted">از ${U.faNum(x.stdCapacity)}</span>`,
        tokens: (x) => [String(x.finalCount), String(x.stdCapacity), `${x.finalCount} از ${x.stdCapacity}`],
      },
      pkgType: {
        key: 'pkgType', label: 'نوع بسته',
        render: (x) => `<span class="chip chip-pack-${x.type}">${PK.PACKAGE_TYPE_LABELS[x.type]}</span>`,
        tokens: (x) => [PK.PACKAGE_TYPE_LABELS[x.type]],
      },
      reserve: {
        key: 'reserve', label: 'رزرو',
        headerTitle: 'رول‌های باقی‌ماندهٔ هم‌ویژگی — جایگزین در صورت رد QC',
        render: (x) => x.reserveRolls.length
          ? `<b class="pack-reserve">${U.faNum(x.reserveRolls.length)}</b>`
          : '<span class="muted">—</span>',
        tokens: (x) => x.reserveRolls.map((r) => r.roll),
      },
      moves: {
        key: 'moves', label: 'جابه‌جایی',
        render: (x) => U.faNum(x.moves),
        tokens: (x) => [String(x.moves)],
      },
      actions: {
        key: 'actions', label: 'عملیات', filterable: false,
        render: (x) => {
          const inGraph = sel.has(x.no);
          return `<div class="row-actions pk-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-pack-pkg="${x.no}">جزئیات</button>
            <button type="button" class="btn btn-ghost btn-sm pk-graph-toggle${inGraph ? ' panel-on' : ''}"
                    data-pack-graph="${x.no}" aria-pressed="${String(inGraph)}"
                    title="${inGraph ? 'حذف از نمایش گرافیکی' : 'افزودن به نمایش گرافیکی'}">
              ${inGraph ? '✓ در نمایش' : '+ نمایش'}
            </button>
          </div>`;
        },
      },
    };
    return registry;
  };

  PackagingView.renderPlanTable = function (plan) {
    if (!plan) return;
    const ctl = PackagingView.ctls.plan;
    const s = plan.stats;

    /* بند ۷ — فقط بسته‌های «قابل اقدام»: پالت‌هایی که در یکی از ظرفیت‌های
       هدف‌اند و امکان بهبود اولویت ندارند، تغییری نمی‌خواهند و نمایش
       داده نمی‌شوند؛ بسته‌های تشکیل/تخلیهٔ مازاد نیاز به تغییر دارند. */
    const rows = ctl.applySort(plan.packages.filter((p) => p.type !== 'as-is'));

    document.getElementById('pack-plan-count').textContent = U.faNum(s.packagesActionable);
    document.getElementById('pack-plan-stats').textContent =
      `${U.faNum(s.packagesActionable)} بستهٔ قابل اقدام — ${U.faNum(s.packagesAssembled)} تشکیل جدید` +
      (s.packagesDowngraded ? ` · ${U.faNum(s.packagesDowngraded)} تخلیهٔ مازاد` : '') +
      ` · ${U.faNum(s.movesTotal)} جابه‌جایی` +
      (s.packagesAsIs ? ` · ${U.faNum(s.packagesAsIs)} بستهٔ در ظرفیت هدف بدون امکان بهبود (نمایش داده نمی‌شود)` : '');

    const registry = PackagingView.planColumns();
    ctl.applyWidths(registry);
    const columns = ctl.visibleColumns(registry);

    const wrap = document.getElementById('pack-plan-table');
    /* بند ۱ — «ردیف‌های قابل نمایش» ماندگار: مقدار ذخیره‌شده به state
       جدول وصل می‌شود و تغییر کاربر از طریق onRowsChange ذخیره می‌شود */
    PackagingView.state.tables.plan.visibleRows = ctl.cfg.visibleRows;
    UI.filterTable(wrap, columns, rows, {
      state: PackagingView.state.tables.plan,
      tableClass: 'cut-table',
      maxDomRows: RM.config.PACK_MAX_DOM_ROWS,
      emptyText: 'بسته‌ای برای اقدام نیست — پالت‌های ناقص یا کامل‌اند یا در ظرفیت هدف بدون امکان بهبودند.',
      footerNote: 'فیلتر هر ستون زیر سرستون همان ستون · منطق: شامل بودن · دکمهٔ «≠» = شامل نشود · ستون «پالت‌های هر بسته» همهٔ پالت‌های بسته را با نشان «⚡ پای کار» فهرست می‌کند',
      onRowsChange: (n) => { ctl.cfg.visibleRows = n; ctl.save(); },
      tools: [
        { id: `pack-plan-cols-toggle`, label: 'ترتیب ستون‌ها', title: 'نمایش/بستن پنل ترتیب ستون‌ها', pressed: ctl.cfg.colsVisible },
        { id: `pack-plan-sort-toggle`, label: 'مرتب‌سازی', title: 'نمایش/بستن پنل مرتب‌سازی', pressed: ctl.cfg.sortVisible },
      ],
      onToolToggle: (toolId) => {
        if (toolId === 'pack-plan-cols-toggle') {
          ctl.cfg.colsVisible = !ctl.cfg.colsVisible;
          ctl.save().then(() => PackagingView.applyPanelsFor('plan'));
        } else if (toolId === 'pack-plan-sort-toggle') {
          ctl.cfg.sortVisible = !ctl.cfg.sortVisible;
          ctl.save().then(() => PackagingView.applyPanelsFor('plan'));
        }
      },
      /* بند ۱ — اتصال دکمه‌ها پس از «هر» رندر بدنه (فیلترها فقط tbody را
         بازسازی می‌کنند؛ رویدادها باید هر بار نو شوند) */
      onRendered: () => {
        wrap.querySelectorAll('[data-pack-pkg]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const pkg = plan.packages.find((x) => x.no === Number(btn.dataset.packPkg));
            if (pkg) PackagingView.showPackageModal(pkg, plan);
          });
        });
        wrap.querySelectorAll('[data-pack-graph]').forEach((btn) => {
          btn.addEventListener('click', () => {
            PackagingView.toggleGraphPackage(Number(btn.dataset.packGraph));
          });
        });
      },
    });

    PackagingView.renderSortBuilderFor('plan');
    PackagingView.renderColsBuilderFor('plan', registry);
    PackagingView.applyPanelsFor('plan');
  };

  /** افزودن/حذف بستهٔ نمایش گرافیکی (بند ۱۴) */
  PackagingView.toggleGraphPackage = function (no) {
    const sel = PackagingView.state.graphSelected;
    const plan = PackagingView._plan;
    if (!plan) return;
    const pkg = plan.packages.find((x) => x.no === no);
    if (!pkg) return;
    if (sel.has(no)) {
      sel.delete(no);
      UI.toast(`بستهٔ ${U.faNum(no)} از نمایش گرافیکی حذف شد.`, 'info');
    } else {
      sel.add(no);
      UI.toast(`بستهٔ ${U.faNum(no)} به نمایش گرافیکی اضافه شد (${U.faNum(pkg.palletParts.length)} پالت · ${U.faNum(pkg.finalCount)} رول).`, 'success');
    }
    PackagingView.saveGraphSelection();
    PackagingView.renderGraphView(plan);
    PackagingView.renderPlanTable(plan);
  };

  PackagingView.saveGraphSelection = function () {
    RM.db.setSetting('packGraphSelection', [...PackagingView.state.graphSelected]);
  };

  /* ---------------- مودال جزئیات بسته (§19-§22 + بندهای ۱۲/۹) ---------------- */

  PackagingView.showPackageModal = function (pkg, plan) {
    const infoRow = (label, value) => `
      <div class="pack-info-item"><span>${label}</span><b>${value}</b></div>`;

    /* پالت‌های مشارکت‌کننده — از palletParts موتور (اصلی + مکمل) */
    const palletRows = pkg.palletParts.map((pt, i) => ({
      idx: U.faNum(i + 1),
      palletNo: pt.palletNo,
      role: pt.isMain ? 'اصلی' : 'مکمل',
      place: pt.atBase ? '⚡ پای کار (سالن تولید)' : (pt.warehouse || '—'),
      kept: pt.isMain ? pt.rolls.length : null,
      given: pt.isMain ? null : pt.rolls.length,
    }));

    const palletCols = [
      { key: 'idx', label: '#', render: (r) => r.idx },
      { key: 'palletNo', label: 'شماره پالت', className: 'ltr', render: (r) => `<b>${U.escapeHtml(r.palletNo)}</b>` },
      { key: 'role', label: 'نقش', render: (r) => U.escapeHtml(r.role) },
      { key: 'place', label: 'موقعیت', render: (r) => U.escapeHtml(r.place) },
      { key: 'kept', label: 'رول نگه‌داشته', render: (r) => r.kept === null ? '<span class="muted">—</span>' : U.faNum(r.kept) },
      { key: 'given', label: 'رول داده', render: (r) => r.given === null ? '<span class="muted">—</span>' : U.faNum(r.given) },
    ];

    const rollCols = [
      { key: 'roll', label: 'شماره رول', className: 'ltr', render: (r) => `<b>${U.escapeHtml(r.roll)}</b>` },
      { key: 'origin', label: 'پالت مبدأ', className: 'ltr', render: (r) => U.escapeHtml(r.pallet.palletNo) },
      { key: 'role', label: 'نقش', render: (r) => (r.role === 'main' ? 'اصلی' : 'مکمل') },
      {
        key: 'move', label: 'جابه‌جایی', render: (r) => r.movedToPalletNo
          ? `→ <span class="ltr">${U.escapeHtml(r.movedToPalletNo)}</span>`
          : '<span class="muted">—</span>',
      },
    ];

    const allRolls = [...pkg.mainRolls, ...pkg.complementRolls];

    /* بند ۱۲ — رول‌های رزرو به‌همراه شمارهٔ پالت، گروه‌بندی‌شده بر اساس پالت */
    const reserveByPallet = new Map();
    for (const robj of pkg.reserveRolls) {
      if (!reserveByPallet.has(robj.pallet)) reserveByPallet.set(robj.pallet, []);
      reserveByPallet.get(robj.pallet).push(robj);
    }
    const reserveHtml = pkg.reserveRolls.length
      ? [...reserveByPallet.entries()]
        .sort((a, b) => (a[0].palletNo < b[0].palletNo ? -1 : 1))
        .map(([pallet, rolls]) => `
          <div class="pack-reserve-group">
            <div class="pack-reserve-pal">
              <span class="pk-pal-idx">▪</span>
              <b class="ltr">${U.escapeHtml(pallet.palletNo)}</b>
              <span class="muted">${U.faNum(rolls.length)} رول — ${U.escapeHtml(pallet.warehouse || '—')}</span>
            </div>
            <div class="pack-reserve-rolls">
              ${rolls.map((r) => `<span class="pack-recall-chip pack-reserve-chip ltr" title="روی پالت ${U.escapeHtml(pallet.palletNo)} — جایگزین در صورت رد QC">${U.escapeHtml(r.roll)}</span>`).join('')}
            </div>
          </div>`).join('')
      : '<p class="muted">رول باقی‌ماندهٔ هم‌ویژگی برای این بسته وجود ندارد.</p>';

    UI.infoModal(`بسته‌بندی شمارهٔ ${U.faNum(pkg.no)} — ${PK.PACKAGE_TYPE_LABELS[pkg.type]}`, `
      <div class="pack-info-grid">
        ${infoRow('نوع فیلم', U.escapeHtml(pkg.filmType))}
        ${infoRow('خط تولید', U.escapeHtml(pkg.line || '—'))}
        ${infoRow('عرض', U.faWidth(pkg.width))}
        ${infoRow('ضخامت', pkg.thickness === null ? '—' : U.faNum(pkg.thickness))}
        ${infoRow('گرید', U.escapeHtml(pkg.grade || '—'))}
        ${infoRow('قطر بوبین', `${U.faNum(pkg.diameter)}″`)}
        ${infoRow('چیدمان مجاز', `${U.faNum(pkg.layers)} طبقه × ${U.faNum(pkg.rollsPerLayer)} رول (${pkg.direction})`)}
        ${infoRow('ظرفیت استاندارد', U.faNum(pkg.stdCapacity))}
        ${infoRow('ظرفیت هدف', U.faNum(pkg.target))}
        ${infoRow('نوع بسته‌بندی', U.escapeHtml(pkg.computedType))}
        ${infoRow('رول نهایی', `${U.faNum(pkg.finalCount)} از ${U.faNum(pkg.stdCapacity)} (${U.faNum(pkg.mainRolls.length)} اصلی + ${U.faNum(pkg.complementRolls.length)} مکمل)`)}
        ${infoRow('جابه‌جایی', U.faNum(pkg.moves))}
      </div>

      <h4 class="pack-modal-title">پالت‌های هر بسته (${U.faNum(palletRows.length)})</h4>
      <div id="pkg-pallets-wrap"></div>

      <h4 class="pack-modal-title">رول‌های بسته (${U.faNum(allRolls.length)})</h4>
      <div id="pkg-rolls-wrap"></div>

      <h4 class="pack-modal-title">رول‌های رزرو (${U.faNum(pkg.reserveRolls.length)}) — با پالت مبدأ</h4>
      ${reserveHtml}
    `, { wide: true });

    UI.renderTable(document.getElementById('pkg-pallets-wrap'), palletCols, palletRows, { pageSize: 10, centered: true });
    UI.renderTable(document.getElementById('pkg-rolls-wrap'), rollCols, allRolls, { pageSize: 10, centered: true });
  };

  /* ================================================================
     ۶) جدول پالت‌ها
     ================================================================ */

  PackagingView.palletsColumns = function (plan) {
    const pkgByMain = new Map(plan.packages.map((x) => [x.main, x]));
    return {
      palletNo: {
        key: 'palletNo', label: 'شماره پالت', className: 'ltr',
        render: (p) => `<b>${U.escapeHtml(p.palletNo || '—')}</b>`,
        tokens: (p) => [p.palletNo || ''],
      },
      palletId: {
        key: 'palletId', label: 'شناسه',
        render: (p) => U.escapeHtml(p.palletId || '—'),
        tokens: (p) => [p.palletId || ''],
      },
      filmType: {
        key: 'filmType', label: 'نوع فیلم',
        render: (p) => U.escapeHtml(p.filmType || '—'),
        tokens: (p) => [p.filmType || ''],
      },
      line: {
        key: 'line', label: 'خط',
        render: (p) => U.escapeHtml(p.line || '—'),
        tokens: (p) => [p.line || ''],
      },
      width: {
        key: 'width', label: 'عرض',
        render: (p) => p.width === null ? '<span class="num-warn">—</span>' : U.faWidth(p.width),
        tokens: (p) => p.width === null ? [] : [U.faWidth(p.width), String(p.width)],
      },
      thickness: {
        key: 'thickness', label: 'ضخامت',
        render: (p) => p.thickness === null ? '<span class="muted">—</span>' : U.faNum(p.thickness),
        tokens: (p) => p.thickness === null ? [] : [U.faNum(p.thickness), String(p.thickness)],
      },
      grade: {
        key: 'grade', label: 'گرید',
        render: (p) => U.escapeHtml(p.grade || '—'),
        tokens: (p) => [p.grade || ''],
      },
      diameter: {
        key: 'diameter', label: 'قطر',
        render: (p) => p.diameter === null ? '<span class="muted">—</span>' : `${U.faNum(p.diameter)}″`,
        tokens: (p) => p.diameter === null ? [] : [String(p.diameter)],
      },
      packTypeExcel: {
        key: 'packTypeExcel', label: 'نوع اکسل',
        render: (p) => (p.packTypeExcel ? U.escapeHtml(p.packTypeExcel) : '<span class="num-warn">خالی</span>') +
          (p.packTypeMismatch ? ' <span class="pack-warn-star" title="مغایرت با نوع محاسبه‌شده">⚠</span>' : ''),
        tokens: (p) => [p.packTypeExcel || ''],
      },
      computedType: {
        key: 'computedType', label: 'محاسبه‌شده',
        render: (p) => p.computedType
          ? U.escapeHtml(p.computedType)
          : `<span class="num-warn">${p.excluded ? 'نامعتبر' : '—'}</span>`,
        headerTitle: 'نوع بسته‌بندی محاسبه‌شدهٔ سامانه (مستقل از اکسل)',
        tokens: (p) => [p.computedType || (p.excluded ? 'نامعتبر' : '')],
      },
      rollCount: {
        key: 'rollCount', label: 'رول‌ها',
        render: (p) => U.faNum(p.rollCount),
        tokens: (p) => [String(p.rollCount)],
      },
      stdCapacity: {
        key: 'stdCapacity', label: 'استاندارد',
        render: (p) => p.stdCapacity === null ? '<span class="muted">—</span>' : U.faNum(p.stdCapacity),
        headerTitle: 'ظرفیت استاندارد (تعداد طبقه × رول در طبقه)',
        tokens: (p) => p.stdCapacity === null ? [] : [String(p.stdCapacity)],
      },
      palletStatus: {
        key: 'palletStatus', label: 'وضعیت پالت',
        render: (p) => `<span class="chip">${PK.PALLET_STATUS_LABELS[p.palletStatus]}</span>`,
        tokens: (p) => [PK.PALLET_STATUS_LABELS[p.palletStatus]],
      },
      planState: {
        key: 'planState', label: 'وضعیت در برنامه',
        render: (p) => {
          const pkg = pkgByMain.get(p);
          const label = PK.PLAN_STATE_LABELS[p.planState] || '—';
          return pkg
            ? `${U.escapeHtml(label)} — <b>بستهٔ ${U.faNum(pkg.no)}</b>`
            : U.escapeHtml(label);
        },
        tokens: (p) => [PK.PLAN_STATE_LABELS[p.planState] || ''],
      },
      warehouse: {
        key: 'warehouse', label: 'انبار',
        render: (p) => U.escapeHtml(p.warehouse || '—'),
        tokens: (p) => [p.warehouse || ''],
      },
      productionDate: {
        key: 'productionDate', label: 'تاریخ تولید',
        render: (p) => U.escapeHtml(U.faDateTime(p.record.productionDate)),
        tokens: (p) => [String(p.record.productionDate ?? '')],
      },
      actions: {
        key: 'actions', label: 'عملیات', filterable: false, width: 100,
        render: (p) => `<button type="button" class="btn btn-ghost btn-sm" data-pack-pal2="${U.escapeHtml(p.palletNo)}">جزئیات</button>`,
      },
    };
  };

  PackagingView.renderPalletsTable = function (plan) {
    if (!plan) return;
    const ctl = PackagingView.ctls.pallets;
    const s = plan.stats;
    document.getElementById('pack-pallets-stats').textContent =
      `${U.faNum(s.inScope)} پالت در برنامه — ${U.faNum(s.completePallets)} کامل · ${U.faNum(s.partial)} ناقص · ` +
      `${U.faNum(s.empty)} خالی · ${U.faNum(s.excluded)} مستثنا · ${U.faNum(s.soldPallets)} فروخته‌شده (کنار)`;

    const rows = ctl.applySort(plan.pallets.filter((p) => p.inScope));

    const wrap = document.getElementById('pack-pallets-table');
    const registry = PackagingView.palletsColumns(plan);
    ctl.applyWidths(registry);
    const columns = ctl.visibleColumns(registry);
    PackagingView.state.tables.pallets.visibleRows = ctl.cfg.visibleRows;

    UI.filterTable(wrap, columns, rows, {
      state: PackagingView.state.tables.pallets,
      tableClass: 'cut-table',
      maxDomRows: RM.config.PACK_MAX_DOM_ROWS,
      emptyText: 'پالتی درون برنامه وجود ندارد.',
      footerNote: 'فیلتر هر ستون زیر سرستون همان ستون · منطق: شامل بودن · دکمهٔ «≠» = شامل نشود · ستون «وضعیت در برنامه» نتیجهٔ بسته‌بندی همان پالت است',
      onRowsChange: (n) => { ctl.cfg.visibleRows = n; ctl.save(); },
      tools: [
        { id: 'pack-pallets-cols-toggle', label: 'ترتیب ستون‌ها', title: 'نمایش/بستن پنل ترتیب ستون‌ها', pressed: ctl.cfg.colsVisible },
        { id: 'pack-pallets-sort-toggle', label: 'مرتب‌سازی', title: 'نمایش/بستن پنل مرتب‌سازی', pressed: ctl.cfg.sortVisible },
      ],
      onToolToggle: (toolId) => {
        if (toolId === 'pack-pallets-cols-toggle') {
          ctl.cfg.colsVisible = !ctl.cfg.colsVisible;
          ctl.save().then(() => PackagingView.applyPanelsFor('pallets'));
        } else if (toolId === 'pack-pallets-sort-toggle') {
          ctl.cfg.sortVisible = !ctl.cfg.sortVisible;
          ctl.save().then(() => PackagingView.applyPanelsFor('pallets'));
        }
      },
      onRendered: () => {
        wrap.querySelectorAll('[data-pack-pal2]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const p = plan.pallets.find((x) => x.palletNo === btn.dataset.packPal2);
            if (p) PackagingView.showPalletModal(p, plan);
          });
        });
      },
    });

    PackagingView.renderSortBuilderFor('pallets');
    PackagingView.renderColsBuilderFor('pallets', registry);
    PackagingView.applyPanelsFor('pallets');
  };

  /* ---------------- مودال جزئیات پالت (§23) ---------------- */

  PackagingView.showPalletModal = function (p, plan) {
    const infoRow = (label, value) => `
      <div class="pack-info-item"><span>${label}</span><b>${value}</b></div>`;

    const pkgByMain = new Map(plan.packages.map((x) => [x.main, x]));
    const pkg = pkgByMain.get(p);

    const rollCols = [
      { key: 'roll', label: 'شماره رول', className: 'ltr', render: (r) => `<b>${U.escapeHtml(r.roll)}</b>` },
      {
        key: 'status', label: 'وضعیت',
        render: (r) => {
          const label = PK.ROLL_STATUS_LABELS[r.status] || r.status;
          if (r.status === 'reserve') {
            return `<span class="pack-reserve">${U.escapeHtml(label)}</span>` +
              ` <span class="muted">برای بستهٔ ${r.reserveFor.map((n) => U.faNum(n)).join('، ')}</span>`;
          }
          if (r.status === 'packed') {
            return `${U.escapeHtml(label)}${r.onCompletePallet ? ' <span class="muted">(پالت کامل)</span>' : ''}`;
          }
          return `${U.escapeHtml(label)}${r.loose ? ' <span class="muted">(مازاد جدا‌شده)</span>' : ''}`;
        },
        tokens: (r) => [PK.ROLL_STATUS_LABELS[r.status] || ''],
      },
      {
        key: 'packageNo', label: 'بسته', render: (r) => r.packageNo ? U.faNum(r.packageNo) : '<span class="muted">—</span>',
        tokens: (r) => (r.packageNo ? [String(r.packageNo)] : []),
      },
      {
        key: 'role', label: 'نقش', render: (r) => (r.role === 'main' ? 'اصلی' : r.role === 'complement' ? 'مکمل' : '—'),
        tokens: (r) => (r.role === 'main' ? ['اصلی'] : r.role === 'complement' ? ['مکمل'] : []),
      },
      {
        key: 'move', label: 'جابه‌جایی', render: (r) => r.movedToPalletNo
          ? `→ <span class="ltr">${U.escapeHtml(r.movedToPalletNo)}</span>`
          : '<span class="muted">—</span>',
        tokens: (r) => (r.movedToPalletNo ? [r.movedToPalletNo] : []),
      },
    ];

    UI.infoModal(`پالت ${U.escapeHtml(p.palletNo || '—')} — ردیابی کامل`, `
      <div class="pack-info-grid">
        ${infoRow('شناسه پالت', U.escapeHtml(p.palletId || '—'))}
        ${infoRow('نوع فیلم', U.escapeHtml(p.filmType || '—'))}
        ${infoRow('خط تولید', U.escapeHtml(p.line || '—'))}
        ${infoRow('عرض', p.width === null ? '—' : U.faWidth(p.width))}
        ${infoRow('ضخامت', p.thickness === null ? '—' : U.faNum(p.thickness))}
        ${infoRow('گرید', U.escapeHtml(p.grade || '—'))}
        ${infoRow('قطر بوبین', p.diameter === null ? 'نامشخص' : `${U.faNum(p.diameter)}″`)}
        ${infoRow('نوع اکسل', p.packTypeExcel ? U.escapeHtml(p.packTypeExcel) : 'خالی')}
        ${infoRow('نوع محاسبه‌شده', p.computedType ? U.escapeHtml(p.computedType) : '—')}
        ${infoRow('چیدمان مجاز', p.stdCapacity === null ? '—' : `${U.faNum(p.layers)} طبقه × ${U.faNum(p.rollsPerLayer)} رول (${p.direction})`)}
        ${infoRow('ظرفیت استاندارد', p.stdCapacity === null ? '—' : U.faNum(p.stdCapacity))}
        ${infoRow('اهداف', p.targets ? p.targets.map((t) => U.faNum(t)).join(' → ') : '—')}
        ${infoRow('تعداد رول', `${U.faNum(p.rollCount)}${p.stdCapacity !== null && !p.excluded ? ` از ${U.faNum(p.stdCapacity)}` : ''}`)}
        ${infoRow('انبار', U.escapeHtml(p.warehouse || '—') + (p.atBase ? ' — پای کار (سالن تولید)' : ''))}
        ${infoRow('تاریخ تولید', U.escapeHtml(U.faDateTime(p.record.productionDate)))}
        ${infoRow('وزن خالص', p.record.netWeight === null ? '—' : U.faNum(p.record.netWeight))}
        ${infoRow('وضعیت پالت', PK.PALLET_STATUS_LABELS[p.palletStatus])}
        ${infoRow('وضعیت در برنامه', pkg ? `${PK.PLAN_STATE_LABELS[p.planState]} — بستهٔ ${U.faNum(pkg.no)}` : (PK.PLAN_STATE_LABELS[p.planState] || '—'))}
      </div>
      ${p.rollObjs && p.rollObjs.length ? `
        <h4 class="pack-modal-title">رول‌های این پالت (${U.faNum(p.rollObjs.length)})</h4>
        <div id="pal-rolls-wrap"></div>` : '<p class="muted">این پالت رولی ندارد (خالی).</p>'}
    `, { wide: true });

    if (p.rollObjs && p.rollObjs.length) {
      UI.renderTable(document.getElementById('pal-rolls-wrap'), rollCols, p.rollObjs, { pageSize: 10, centered: true });
    }
  };

  /* ================================================================
     ۷) جدول رول‌ها و ردیابی (§23 + بند ۱ — توکن‌های همهٔ ستون‌ها)
     ================================================================ */

  PackagingView.rollsColumns = function () {
    return {
      roll: {
        key: 'roll', label: 'شماره رول', className: 'ltr',
        render: (r) => `<b>${U.escapeHtml(r.roll)}</b>`,
        tokens: (r) => [r.roll],
      },
      origin: {
        key: 'origin', label: 'پالت مبدأ', className: 'ltr',
        render: (r) => U.escapeHtml(r.pallet.palletNo),
        tokens: (r) => [r.pallet.palletNo],
      },
      filmType: {
        key: 'filmType', label: 'نوع فیلم',
        render: (r) => U.escapeHtml(r.pallet.filmType || '—'),
        tokens: (r) => [r.pallet.filmType || ''],
      },
      width: {
        key: 'width', label: 'عرض',
        render: (r) => U.faWidth(r.pallet.width),
        tokens: (r) => r.pallet.width === null ? [] : [U.faWidth(r.pallet.width), String(r.pallet.width)],
      },
      thickness: {
        key: 'thickness', label: 'ضخامت',
        render: (r) => r.pallet.thickness === null ? '<span class="muted">—</span>' : U.faNum(r.pallet.thickness),
        tokens: (r) => r.pallet.thickness === null ? [] : [U.faNum(r.pallet.thickness), String(r.pallet.thickness)],
      },
      grade: {
        key: 'grade', label: 'گرید',
        render: (r) => U.escapeHtml(r.pallet.grade || '—'),
        tokens: (r) => [r.pallet.grade || ''],
      },
      diameter: {
        key: 'diameter', label: 'قطر',
        render: (r) => `${U.faNum(r.pallet.diameter)}″`,
        tokens: (r) => [String(r.pallet.diameter)],
      },
      packageNo: {
        key: 'packageNo', label: 'بسته',
        render: (r) => r.packageNo ? U.faNum(r.packageNo) : '<span class="muted">—</span>',
        tokens: (r) => (r.packageNo ? [String(r.packageNo)] : []),
      },
      role: {
        key: 'role', label: 'نقش',
        render: (r) => (r.role === 'main' ? 'اصلی' : r.role === 'complement' ? 'مکمل' : '<span class="muted">—</span>'),
        tokens: (r) => (r.role === 'main' ? ['اصلی', 'main'] : r.role === 'complement' ? ['مکمل', 'complement'] : []),
      },
      move: {
        key: 'move', label: 'انتقال',
        render: (r) => r.movedToPalletNo
          ? `→ <span class="ltr">${U.escapeHtml(r.movedToPalletNo)}</span>`
          : '<span class="muted">—</span>',
        tokens: (r) => (r.movedToPalletNo ? [r.movedToPalletNo] : []),
      },
      status: {
        key: 'status', label: 'وضعیت نهایی',
        render: (r) => {
          if (r.status === 'reserve') {
            return `<span class="pack-reserve">رزرو</span> <span class="muted">برای بستهٔ ${r.reserveFor.map((n) => U.faNum(n)).join('، ')}</span>`;
          }
          const label = PK.ROLL_STATUS_LABELS[r.status] || r.status;
          if (r.status === 'packed') {
            return `${U.escapeHtml(label)}${r.onCompletePallet ? ' <span class="muted">(پالت کامل)</span>' : ''}`;
          }
          return `${U.escapeHtml(label)}${r.loose ? ' <span class="muted">(مازاد جدا‌شده)</span>' : ''}`;
        },
        tokens: (r) => [PK.ROLL_STATUS_LABELS[r.status] || '', ...(r.reserveFor || []).map(String)],
      },
    };
  };

  PackagingView.renderRollsTable = function (plan) {
    if (!plan) return;
    const ctl = PackagingView.ctls.rolls;
    const s = plan.stats;
    document.getElementById('pack-rolls-stats').textContent =
      `${U.faNum(s.rollsInScope)} رول درون برنامه — ${U.faNum(s.rollsPacked)} بسته‌بندی‌شده · ${U.faNum(s.rollsReserve)} رزرو · ` +
      `${U.faNum(s.rollsLeftover)} باقی‌مانده · ${U.faNum(s.rollsExcluded)} مستثنا`;

    const rows = ctl.applySort(plan.rollStates);

    const wrap = document.getElementById('pack-rolls-table');
    const registry = PackagingView.rollsColumns();
    ctl.applyWidths(registry);
    const columns = ctl.visibleColumns(registry);
    PackagingView.state.tables.rolls.visibleRows = ctl.cfg.visibleRows;

    UI.filterTable(wrap, columns, rows, {
      state: PackagingView.state.tables.rolls,
      tableClass: 'cut-table',
      maxDomRows: RM.config.PACK_MAX_DOM_ROWS,
      emptyText: 'رولی درون برنامه وجود ندارد.',
      footerNote: 'فیلتر هر ستون زیر سرستون همان ستون · منطق: شامل بودن · دکمهٔ «≠» = شامل نشود · ردیف‌ها بر اساس پالت مبدأ مرتب‌اند',
      onRowsChange: (n) => { ctl.cfg.visibleRows = n; ctl.save(); },
      tools: [
        { id: 'pack-rolls-cols-toggle', label: 'ترتیب ستون‌ها', title: 'نمایش/بستن پنل ترتیب ستون‌ها', pressed: ctl.cfg.colsVisible },
        { id: 'pack-rolls-sort-toggle', label: 'مرتب‌سازی', title: 'نمایش/بستن پنل مرتب‌سازی', pressed: ctl.cfg.sortVisible },
      ],
      onToolToggle: (toolId) => {
        if (toolId === 'pack-rolls-cols-toggle') {
          ctl.cfg.colsVisible = !ctl.cfg.colsVisible;
          ctl.save().then(() => PackagingView.applyPanelsFor('rolls'));
        } else if (toolId === 'pack-rolls-sort-toggle') {
          ctl.cfg.sortVisible = !ctl.cfg.sortVisible;
          ctl.save().then(() => PackagingView.applyPanelsFor('rolls'));
        }
      },
    });

    PackagingView.renderSortBuilderFor('rolls');
    PackagingView.renderColsBuilderFor('rolls', registry);
    PackagingView.applyPanelsFor('rolls');
  };

  /* ================================================================
     ۸) خروجی اکسل برنامهٔ بسته‌بندی (بند ۱۱)
     ================================================================
     ستون‌ها (به‌ترتیب): «لیست پالت و رول ها» (شمارهٔ هر پالت و زیر آن
     شمارهٔ رول‌های همان پالت — هرکدام در یک سلول) · «رول های رزرو» (زیر
     هم، هر رول یک سلول) · فیلم · عرض · ضخامت · گرید · قطر · ظرفیت نهایی.
     فقط بسته‌های قابل نمایش جدول (پس از فیلترهای فعال) صادر می‌شوند. */

  PackagingView.exportPlanExcel = function () {
    const plan = PackagingView._plan;
    const btn = document.getElementById('pack-excel-btn');
    if (!plan || !plan.packages.length) {
      UI.toast('برنامه‌ای برای خروجی گرفتن نیست — ابتدا فایل مدیریت پالت‌ها را وارد کنید.', 'warning');
      return;
    }
    if (typeof XLSX === 'undefined') {
      UI.toast('کتابخانهٔ اکسل (xlsx) بارگذاری نشده است.', 'error');
      return;
    }

    /* همان ردیف‌های قابل نمایش جدول: مرتب‌سازی کاربر + فیلترهای فعال */
    const ctl = PackagingView.ctls.plan;
    const registry = PackagingView.planColumns();
    const columns = ctl.visibleColumns(registry);
    const sorted = ctl.applySort(plan.packages.filter((p) => p.type !== 'as-is'));
    const visible = PackagingView.filterRows(sorted, columns, PackagingView.state.tables.plan);

    if (!visible.length) {
      UI.toast('با فیلترهای فعلی هیچ بسته‌ای قابل نمایش نیست — خروجی اکسل خالی می‌شد.', 'warning');
      return;
    }

    const header = ['لیست پالت و رول ها', 'رول های رزرو', 'فیلم', 'عرض', 'ضخامت', 'گرید', 'قطر', 'ظرفیت نهایی'];
    const aoa = [header];
    const merges = [];

    let r = 1;
    for (const pkg of visible) {
      const startR = r;
      const listCol = [];
      for (const pt of pkg.palletParts) {
        listCol.push(pt.palletNo);
        for (const robj of pt.rolls) listCol.push(robj.roll);
      }
      const reserveCol = pkg.reserveRolls.map((x) => x.roll);
      const blockH = Math.max(listCol.length, reserveCol.length, 1);

      for (let i = 0; i < blockH; i++) {
        aoa.push([listCol[i] ?? '', reserveCol[i] ?? '', '', '', '', '', '', '']);
      }
      const row0 = aoa[startR];
      row0[2] = pkg.filmType || '';
      row0[3] = pkg.width === null ? '—' : pkg.width;
      row0[4] = pkg.thickness === null ? '—' : pkg.thickness;
      row0[5] = pkg.grade || '';
      row0[6] = pkg.diameter;
      row0[7] = `${pkg.finalCount} از ${pkg.stdCapacity}`;

      /* ادغام عمودی ستون‌های مشخصات (C تا H) روی بلوک این بسته */
      if (blockH > 1) {
        for (let c = 2; c <= 7; c++) {
          merges.push({ s: { r: startR, c }, e: { r: startR + blockH - 1, c } });
        }
      }
      r += blockH;
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;
    ws['!cols'] = [{ wch: 28 }, { wch: 26 }, { wch: 12 }, { wch: 9 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 15 }];
    ws['!views'] = [{ RTL: true }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'برنامه بسته‌بندی');

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;

    try {
      XLSX.writeFile(wb, `برنامه-بسته-بندی_${stamp}.xlsx`);
      UI.toast(
        `خروجی اکسل ساخته شد — ${U.faNum(visible.length)} بستهٔ قابل نمایش (${U.faNum(aoa.length - 1)} ردیف) با ستون‌های «لیست پالت و رول ها» و «رول های رزرو».`,
        'success', 5200
      );
    } catch (err) {
      console.error('[PackExcel]', err);
      UI.toast(`ساخت فایل اکسل با خطا مواجه شد (${U.escapeHtml(String(err.message || err).slice(0, 90))}).`, 'error', 6500);
    }
    if (btn) btn.blur();
  };

  /* ================================================================
     ۹) نمایش گرافیکی (بند ۱۴)
     ================================================================
     کارت‌های تفکیک‌رنگ هر بسته — پالت‌ها و رول‌های داخل هر بسته به‌زیبایی؛
     مشخصات ثابت هر کارت: فیلم · عرض · ضخامت · گرید · نوع بسته‌بندی ·
     ظرفیت. حدود ۱۵ بسته در هر صفحه + خروجی تصویر (صفحهٔ فعلی) و PDF
     (همهٔ صفحات — استیج روشن‌موضوع خارج از دید، مثل گانت برنامه‌ریزی). */

  /** تبدیل رنگ hex به rgba — html2canvas نسخهٔ فعلی color-mix و گاهی
   *  hex-۸رقمی را پشتیبانی نمی‌کند؛ همهٔ رنگ‌های شفاف کارت با rgba ست می‌شوند */
  function pgRgba(hex, alpha) {
    const n = parseInt(String(hex).replace('#', ''), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }

  /** ساخت HTML کارت یک بسته (مشترک صفحه و خروجی) */
  PackagingView.graphCardHtml = function (pkg, globalIdx, opts = {}) {
    const accent = GRAPH_COLORS[globalIdx % GRAPH_COLORS.length];
    const removable = !opts.pdf;
    const palletsHtml = pkg.palletParts.map((pt, i) => `
      <div class="pg-pallet${pt.atBase ? ' at-base' : ''}" style="${pt.atBase ? '' : `border-color:${pgRgba(accent, 0.4)};background:${pgRgba(accent, 0.05)};`}">
        <div class="pg-pal-head">
          <span class="pg-pal-idx" style="color:${accent};background:${pgRgba(accent, 0.12)};border-color:${pgRgba(accent, 0.45)}">${U.faNum(i + 1)}</span>
          <span class="pg-pal-no ltr">${U.escapeHtml(pt.palletNo)}</span>
          ${pt.atBase
            ? '<span class="pk-base-badge">⚡ پای کار</span>'
            : `<span class="pg-wh-badge" title="${U.escapeHtml(pt.warehouse || '—')}">انبار</span>`}
          <span class="pg-pal-count">${U.faNum(pt.rolls.length)} رول</span>
        </div>
        <div class="pg-rolls">
          ${pt.rolls.map((robj) => `<span class="pg-roll ltr">${U.escapeHtml(robj.roll)}</span>`).join('')}
        </div>
      </div>`).join('');

    return `
      <div class="pg-card" style="--pg-accent:${accent}">
        <div class="pg-head" style="border-color:${pgRgba(accent, 0.35)};background:${pgRgba(accent, 0.06)}">
          <span class="pg-title" style="color:${accent}">بستهٔ ${U.faNum(pkg.no)}</span>
          <span class="chip chip-pack-${pkg.type}">${PK.PACKAGE_TYPE_LABELS[pkg.type]}</span>
          <span class="pg-meta">${U.faNum(pkg.palletParts.length)} پالت · ${U.faNum(pkg.finalCount)} رول</span>
          ${removable ? `<button type="button" class="pg-remove" data-pg-remove="${pkg.no}" title="حذف از نمایش گرافیکی" aria-label="حذف بستهٔ ${U.faNum(pkg.no)} از نمایش">×</button>` : ''}
        </div>
        <div class="pg-specs">
          <span class="pg-spec"><i>فیلم</i><b>${U.escapeHtml(pkg.filmType)}</b></span>
          <span class="pg-spec"><i>عرض</i><b>${U.faWidth(pkg.width)}</b></span>
          <span class="pg-spec"><i>ضخامت</i><b>${pkg.thickness === null ? '—' : U.faNum(pkg.thickness)}</b></span>
          <span class="pg-spec"><i>گرید</i><b>${U.escapeHtml(pkg.grade || '—')}</b></span>
          <span class="pg-spec"><i>نوع بسته</i><b>${U.escapeHtml(pkg.computedType)}</b></span>
          <span class="pg-spec"><i>ظرفیت</i><b>${U.faNum(pkg.finalCount)} از ${U.faNum(pkg.stdCapacity)}</b></span>
        </div>
        <div class="pg-pallets">${palletsHtml}</div>
        ${pkg.reserveRolls.length
          ? `<div class="pg-reserve" title="رول‌های باقی‌ماندهٔ هم‌ویژگی — جایگزین در صورت رد QC">رزرو: ${U.faNum(pkg.reserveRolls.length)} رول</div>`
          : ''}
      </div>`;
  };

  /** رندر نمای نمایش گرافیکی (کارت‌ها + صفحه‌بندی) */
  PackagingView.renderGraphView = function (plan) {
    const wrap = document.getElementById('pack-graph-wrap');
    const statsEl = document.getElementById('pack-graph-stats');
    if (!wrap) return;

    if (!plan) {
      if (statsEl) statsEl.textContent = '';
      wrap.innerHTML = '<div class="empty-state">' + UI.icons.alert +
        '<h4>بسته‌ای انتخاب نشده است</h4><p>از جدول «برنامهٔ بسته‌بندی» بسته‌های دلخواه را با دکمهٔ «+ نمایش» به این صفحه اضافه کنید.</p></div>';
      return;
    }

    /* حذف انتخاب‌های منقضی (بسته‌ای که دیگر وجود ندارد) */
    const pkgMap = new Map(plan.packages.map((x) => [x.no, x]));
    let stale = false;
    for (const no of [...PackagingView.state.graphSelected]) {
      if (!pkgMap.has(no)) { PackagingView.state.graphSelected.delete(no); stale = true; }
    }
    if (stale) PackagingView.saveGraphSelection();

    const pkgs = [...PackagingView.state.graphSelected]
      .sort((a, b) => a - b)
      .map((no) => pkgMap.get(no));

    if (!pkgs.length) {
      if (statsEl) statsEl.textContent = '';
      wrap.innerHTML = '<div class="empty-state">' + UI.icons.alert +
        '<h4>بسته‌ای انتخاب نشده است</h4><p>از جدول «برنامهٔ بسته‌بندی» بسته‌های دلخواه را با دکمهٔ «+ نمایش» به این صفحه اضافه کنید.</p></div>';
      return;
    }

    const pages = Math.max(1, Math.ceil(pkgs.length / GRAPH_PAGE_SIZE));
    if (PackagingView.state.graphPage > pages) PackagingView.state.graphPage = pages;
    const page = Math.min(Math.max(1, PackagingView.state.graphPage), pages);
    PackagingView.state.graphPage = page;

    const from = (page - 1) * GRAPH_PAGE_SIZE;
    const pagePkgs = pkgs.slice(from, from + GRAPH_PAGE_SIZE);

    if (statsEl) {
      statsEl.textContent = `${U.faNum(pkgs.length)} بستهٔ انتخاب‌شده — صفحهٔ ${U.faNum(page)} از ${U.faNum(pages)}`;
    }

    const cardsHtml = pagePkgs
      .map((pkg, i) => PackagingView.graphCardHtml(pkg, from + i))
      .join('');

    const pager = pages > 1 ? `
      <div class="pager" role="navigation" aria-label="صفحه‌بندی نمایش گرافیکی">
        <button type="button" class="btn btn-ghost btn-sm" data-gpage="1" ${page === 1 ? 'disabled' : ''}>ابتدا</button>
        <button type="button" class="btn btn-ghost btn-sm" data-gpage="${page - 1}" ${page === 1 ? 'disabled' : ''}>قبلی</button>
        <span class="pager-info">صفحهٔ ${U.faNum(page)} از ${U.faNum(pages)} — ${U.faNum(pkgs.length)} بسته</span>
        <button type="button" class="btn btn-ghost btn-sm" data-gpage="${page + 1}" ${page === pages ? 'disabled' : ''}>بعدی</button>
        <button type="button" class="btn btn-ghost btn-sm" data-gpage="${pages}" ${page === pages ? 'disabled' : ''}>انتها</button>
      </div>` : '';

    wrap.innerHTML = `
      <div class="pg-grid" id="pack-graph-grid">${cardsHtml}</div>
      ${pager}`;

    wrap.querySelectorAll('[data-pg-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        PackagingView.state.graphSelected.delete(Number(btn.dataset.pgRemove));
        PackagingView.saveGraphSelection();
        PackagingView.renderGraphView(plan);
        PackagingView.renderPlanTable(plan);
      });
    });
    wrap.querySelectorAll('[data-gpage]').forEach((btn) => {
      btn.addEventListener('click', () => {
        PackagingView.state.graphPage = Number(btn.dataset.gpage);
        PackagingView.renderGraphView(plan);
      });
    });
  };

  /** ساخت HTML یک صفحهٔ استیج خروجی (۱۵ کارت — تم روشن ثابت) */
  PackagingView.graphStagePageHtml = function (pkgs, pageIdx, totalPages) {
    return `
      <div class="pg-page">
        <div class="pg-stage-head">
          <b>نمایش گرافیکی بسته‌بندی</b>
          <span>${U.faNum(pkgs.length)} بسته · صفحهٔ ${U.faNum(pageIdx + 1)} از ${U.faNum(totalPages)}</span>
        </div>
        <div class="pg-grid">${pkgs.map((pkg, i) => PackagingView.graphCardHtml(pkg, i, { pdf: true })).join('')}</div>
      </div>`;
  };

  /** ساخت استیج خارج از دید + انتظار چیدمان/فونت/رندر */
  PackagingView.buildGraphStage = async function (pagesHtml) {
    const stage = document.getElementById('pack-graph-stage');
    if (!stage) throw new Error('graph stage not found');
    if (typeof window.html2canvas !== 'function') throw new Error('html2canvas not loaded');
    stage.innerHTML = pagesHtml.join('');
    stage.hidden = false;
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) { /* noop */ }
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return stage;
  };

  /** خروجی تصویر PNG از صفحهٔ فعلی نمایش گرافیکی (تم روشن) */
  PackagingView.exportGraphImage = async function () {
    const plan = PackagingView._plan;
    const btn = document.getElementById('pack-graph-png');
    const sel = PackagingView.state.graphSelected;
    if (!plan || !sel.size) {
      UI.toast('بسته‌ای برای خروجی تصویر انتخاب نشده است.', 'warning');
      return;
    }
    const pkgMap = new Map(plan.packages.map((x) => [x.no, x]));
    const pkgs = [...sel].sort((a, b) => a - b).map((no) => pkgMap.get(no)).filter(Boolean);
    if (!pkgs.length) {
      UI.toast('بسته‌ای برای خروجی تصویر انتخاب نشده است.', 'warning');
      return;
    }

    const btnHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = 'در حال ساخت تصویر…'; }
    let stage = null;
    try {
      const pages = Math.max(1, Math.ceil(pkgs.length / GRAPH_PAGE_SIZE));
      const page = Math.min(Math.max(1, PackagingView.state.graphPage), pages);
      const from = (page - 1) * GRAPH_PAGE_SIZE;
      const pagePkgs = pkgs.slice(from, from + GRAPH_PAGE_SIZE);

      stage = await PackagingView.buildGraphStage([
        PackagingView.graphStagePageHtml(pagePkgs, page - 1, pages),
      ]);
      const pageEl = stage.querySelector('.pg-page');
      const canvas = await window.html2canvas(pageEl, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
      });
      if (!canvas.width || !canvas.height) throw new Error('empty canvas');

      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `نمایش-گرافیکی-بسته-بندی_صفحه-${page}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      UI.toast(`خروجی تصویر صفحهٔ ${U.faNum(page)} ساخته شد — ${U.faNum(pagePkgs.length)} کارت بسته.`, 'success');
    } catch (err) {
      console.error('[GraphPNG]', err);
      UI.toast(`ساخت تصویر با خطا مواجه شد (${U.escapeHtml(String(err.message || err).slice(0, 90))}).`, 'error', 6500);
    } finally {
      if (stage) { stage.innerHTML = ''; stage.hidden = true; }
      if (btn) { btn.disabled = false; btn.innerHTML = btnHtml; }
    }
  };

  /** خروجی PDF همهٔ صفحات نمایش گرافیکی (A4 عمودی — برش تصویر بلند) */
  PackagingView.exportGraphPdf = async function () {
    const plan = PackagingView._plan;
    const btn = document.getElementById('pack-graph-pdf');
    const sel = PackagingView.state.graphSelected;
    if (!plan || !sel.size) {
      UI.toast('بسته‌ای برای خروجی PDF انتخاب نشده است.', 'warning');
      return;
    }
    if (!window.jspdf || !window.jspdf.jsPDF) {
      UI.toast('کتابخانهٔ PDF (jspdf) بارگذاری نشده است.', 'error');
      return;
    }
    const pkgMap = new Map(plan.packages.map((x) => [x.no, x]));
    const pkgs = [...sel].sort((a, b) => a - b).map((no) => pkgMap.get(no)).filter(Boolean);
    if (!pkgs.length) {
      UI.toast('بسته‌ای برای خروجی PDF انتخاب نشده است.', 'warning');
      return;
    }

    const btnHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = 'در حال ساخت PDF…'; }
    let stage = null;
    try {
      const totalPages = Math.max(1, Math.ceil(pkgs.length / GRAPH_PAGE_SIZE));
      const pagesHtml = [];
      for (let p = 0; p < totalPages; p++) {
        pagesHtml.push(PackagingView.graphStagePageHtml(
          pkgs.slice(p * GRAPH_PAGE_SIZE, (p + 1) * GRAPH_PAGE_SIZE), p, totalPages));
      }
      stage = await PackagingView.buildGraphStage(pagesHtml);

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const PW = 210, PH = 297, MG = 6;
      const usableW = PW - 2 * MG;
      const usableH = PH - 2 * MG;

      const pageEls = [...stage.querySelectorAll('.pg-page')];
      let firstSlice = true;
      for (const pageEl of pageEls) {
        const canvas = await window.html2canvas(pageEl, {
          scale: 2,
          backgroundColor: '#ffffff',
          logging: false,
          useCORS: true,
        });
        if (!canvas.width || !canvas.height) throw new Error('empty canvas');

        const ratio = canvas.height / canvas.width;
        const hFull = usableW * ratio;
        if (hFull <= usableH) {
          if (!firstSlice) pdf.addPage('a4', 'portrait');
          firstSlice = false;
          pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', MG, MG, usableW, hFull, undefined, 'FAST');
        } else {
          /* تصویر بلندتر از صفحه — برش عمودی به تکه‌های هم‌اندازهٔ صفحه */
          const sliceH = Math.floor(canvas.width * (usableH / usableW));
          for (let y = 0; y < canvas.height; y += sliceH) {
            const h2 = Math.min(sliceH, canvas.height - y);
            const c2 = document.createElement('canvas');
            c2.width = canvas.width;
            c2.height = h2;
            c2.getContext('2d').drawImage(canvas, 0, y, canvas.width, h2, 0, 0, canvas.width, h2);
            if (!firstSlice) pdf.addPage('a4', 'portrait');
            firstSlice = false;
            pdf.addImage(c2.toDataURL('image/jpeg', 0.92), 'JPEG', MG, MG, usableW, usableW * (h2 / canvas.width), undefined, 'FAST');
          }
        }
      }

      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      pdf.save(`نمایش-گرافیکی-بسته-بندی_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.pdf`);
      UI.toast(
        `خروجی PDF ساخته شد — ${U.faNum(pkgs.length)} بسته در ${U.faNum(totalPages)} صفحه (هر صفحه حداکثر ${U.faNum(GRAPH_PAGE_SIZE)} کارت).`,
        'success', 5200
      );
    } catch (err) {
      console.error('[GraphPDF]', err);
      UI.toast(`ساخت PDF با خطا مواجه شد (${U.escapeHtml(String(err.message || err).slice(0, 90))}).`, 'error', 6500);
    } finally {
      if (stage) { stage.innerHTML = ''; stage.hidden = true; }
      if (btn) { btn.disabled = false; btn.innerHTML = btnHtml; }
    }
  };

  RM.views = RM.views || {};
  RM.views.packaging = PackagingView;
})();
