/* =========================================================================
   views/import.js — ورود داده‌ها (پورت import-view.tsx)
   -------------------------------------------------------------------------
   دراپ‌زون + انتخاب فایل اکسل → پارس محلی با SheetJS → اعتبارسنجی ستون‌های
   الزامی → نرمال‌سازی و دسته‌بندی → جایگزینی کامل داده‌ها در IndexedDB →
   خلاصهٔ نتیجهٔ Import (۷ دسته) + جدول رول‌های فایل واردشده با ویرایش و
   وضعیت دستی (بند ۴ نسخهٔ ۱٫۲) + وضعیت آخرین Import + حذف همهٔ داده‌ها.
   ========================================================================= */
(function () {
  'use strict';

  /** رنگ Badge هر دسته (پالت فیروزه‌ای/کهربایی — بدون آبی) */
  var CATEGORY_BADGE = {
    raw: 'badge-teal',
    eva: 'badge-emerald',
    cut: 'badge-amber',
    error_e_film: 'badge-red',
    error_no_e: 'badge-red',
    raw_out_of_range: 'badge-orange',
    other: 'badge-stone',
  };

  /** گزینه‌های وضعیت دستی رول (بند ۴) — '__auto' = بدون انتخاب (تشخیص خودکار) */
  var TYPE_OVERRIDE_OPTIONS = [
    { value: '__auto', label: 'خودکار (بدون انتخاب)' },
    { value: 'raw', label: 'رول خام' },
    { value: 'eva', label: 'رول EVA' },
    { value: 'cut', label: 'رول برش‌خورده' },
  ];

  /** برچسب فارسی وضعیت دستی */
  var OVERRIDE_LABEL = { raw: 'رول خام', eva: 'رول EVA', cut: 'رول برش‌خورده' };

  /** برچسب فیلدهای ویرایش‌شده برای بخش «رول‌های ویرایش‌شده» (بند ۴ — نسخهٔ ۱٫۳) */
  var EDIT_FIELD_LABELS = {
    rollNumber: 'شماره رول',
    filmType: 'نوع فیلم',
    width: 'عرض',
    initialWidth: 'عرض رول اولیه',
    thickness: 'ضخامت',
    length: 'متراژ',
    netWeight: 'وزن خالص',
    grade: 'گرید',
    palletNumber: 'شماره پالت',
    setupNumber: 'شماره ستاپ',
    productionDate: 'تاریخ تولید',
    position: 'موقعیت فعلی',
    externalId: 'شناسه رول',
  };

  /** ستون‌های جدول خلاصهٔ دسته‌ها (پورت SUMMARY_COLUMNS) */
  function summaryColumns() {
    return [
      {
        key: 'cat',
        label: 'دسته',
        render: function (r) {
          return '<span class="badge ' + CATEGORY_BADGE[r.cat] + '">' + UI.esc(EVA.CATEGORY_LABELS[r.cat]) + '</span>';
        },
        tokens: function (r) { return [EVA.CATEGORY_LABELS[r.cat], r.cat]; },
      },
      {
        key: 'count',
        label: 'تعداد',
        sortableType: 'number',
        render: function (r) { return '<span class="font-bold dt-num">' + Fmt.faInt(r.count) + '</span>'; },
      },
      {
        key: 'share',
        label: 'سهم از کل',
        render: function (r) {
          return '<span class="txt-muted dt-num">' + (r.share === null ? '—' : Fmt.faNum(r.share, 1) + '٪') + '</span>';
        },
        tokens: function (r) { return r.share === null ? [] : [String(Math.round(r.share * 10) / 10)]; },
      },
    ];
  }

  /* وضعیت محلی نما */
  var state = {
    selectedFile: null,
    summary: null,       // خلاصهٔ آخرین Import موفق (فقط همین نشست)
    missingError: null,  // {message, missing[], headers[]}
    uploading: false,
  };

  /* =========================================================================
     رندر
     ========================================================================= */

  function render(el, snapshot) {
    var html = '';

    /* ---------------- کارت آپلود ---------------- */
    html +=
      '<div class="card fade-in-up">' +
      '<div class="card-header"><h3 class="card-title">' + UI.icon('upload', 20) + 'بارگذاری فایل اکسل «رول های موجود»</h3>' +
      '<p class="card-desc">فایل اکسل خروجی انبار (نمونه: <span class="ltr-code">EVA Data.xls</span>) را اینجا رها کنید یا انتخاب کنید. هر بار Import جدید، <strong>کل داده‌های قبلی را جایگزین می‌کند</strong>؛ بنابراین برای به‌روزرسانی، کافی است نسخهٔ جدید فایل را بارگذاری کنید. <span class="txt-muted">ساختار پذیرفته‌شده: هفت ستون الزامی «شماره رول، نوع فیلم، شماره ستاپ، عرض، ضخامت، وزن خالص و گرید» به‌همراه ستون‌های اختیاری متراژ، شماره پالت، عرض رول اولیه، تاریخ تولید، موقعیت فعلی و شناسه رول.</span></p></div>' +
      '<div class="card-body">' +
      '  <div class="dropzone' + (state.uploading ? ' disabled' : '') + '" id="imp-dropzone" role="button" tabindex="0" aria-label="ناحیهٔ بارگذاری فایل — فایل را اینجا رها کنید یا برای انتخاب کلیک کنید">' +
      '    <div class="dz-icon">' + UI.icon('file-spreadsheet', 28) + '</div>' +
      '    <div><p class="dz-title">' + (state.selectedFile && !state.uploading ? 'برای جایگزینی، فایل جدیدی انتخاب کنید' : 'فایل اکسل را اینجا رها کنید یا کلیک کنید') + '</p>' +
      '    <p class="dz-hint">فرمت‌های مجاز: <span class="ltr-code">xls</span> و <span class="ltr-code">xlsx</span> — حداکثر یک فایل</p></div>' +
      '  </div>' +
      '  <input type="file" id="imp-file-input" accept=".xls,.xlsx,.xlsm" hidden aria-hidden="true" tabindex="-1" />' +
      '  <div class="row mt-3">' +
      '    <button type="button" class="btn btn-primary" id="imp-pick-btn"' + (state.uploading ? ' disabled' : '') + ' aria-label="انتخاب فایل اکسل رول های موجود">' + UI.icon('file-spreadsheet', 16) + (state.uploading ? 'در حال پردازش…' : 'انتخاب فایل') + '</button>' +
      (state.selectedFile && !state.uploading
        ? '<p class="text-xs txt-muted" style="margin:0">آخرین فایل انتخاب‌شده: <span class="ltr-code font-bold">' + UI.esc(state.selectedFile) + '</span></p>'
        : '') +
      '  </div>' +
      (state.uploading
        ? '<div class="mt-3" aria-live="polite">' +
          '<p class="text-xs txt-muted" style="display:flex;align-items:center;gap:8px;margin:0 0 8px"><span class="spin" style="display:inline-flex;color:var(--primary)">' + UI.icon('loader', 16) + '</span>در حال بارگذاری «' + UI.esc(state.selectedFile || '') + '» و پردازش سطرها…</p>' +
          '<div class="progressbar" role="progressbar" aria-label="در حال پردازش"><div></div></div></div>'
        : '') +
      '</div></div>';

    /* ---------------- خطای ستون‌های الزامی ---------------- */
    if (state.missingError) {
      html +=
        '<div class="alert alert-destructive fade-in-up" role="alert">' + UI.icon('alert-triangle', 16) +
        '<div class="alert-body">' +
        '<p class="alert-title">ستون‌های الزامی در فایل یافت نشد</p>' +
        '<p style="line-height:1.9">' + UI.esc(state.missingError.message) + ' — نگاشت ستون‌ها را در بخش تنظیمات اصلاح کنید یا هدرهای فایل را بررسی کنید.</p>' +
        '<p class="text-xs font-bold" style="margin:10px 0 0">ستون‌های یافت‌نشده:</p>' +
        '<div class="chip-row">' +
        state.missingError.missing.map(function (m) {
          var faLabel = EVA.FIELD_LABELS[m];
          return '<span class="badge missing-chip">' + (faLabel ? UI.esc(faLabel) : '<span class="ltr-code">' + UI.esc(m) + '</span>') +
            (faLabel ? ' <span class="ltr-code" style="opacity:.7">(' + UI.esc(m) + ')</span>' : '') + '</span>';
        }).join('') +
        '</div>' +
        (state.missingError.headers && state.missingError.headers.length > 0
          ? '<p class="text-xs font-bold" style="margin:12px 0 0">هدرهای شناسایی‌شده در فایل:</p>' +
            '<div class="chip-row">' +
            state.missingError.headers.map(function (h) {
              return '<span class="badge badge-outline header-chip">' + UI.esc(h) + '</span>';
            }).join('') +
            '</div>'
          : '') +
        '</div></div>';
    }

    /* ---------------- خلاصهٔ موفقیت آخرین Import ---------------- */
    if (state.summary) {
      var sm = state.summary;
      var monitored =
        (sm.counts.raw || 0) + (sm.counts.eva || 0) + (sm.counts.cut || 0) +
        (sm.counts.error_e_film || 0) + (sm.counts.error_no_e || 0) + (sm.counts.raw_out_of_range || 0);
      html +=
        '<div class="card fade-in-up" style="border-color:rgba(5,150,105,0.4)">' +
        '<div class="card-header tight"><h3 class="card-title"><span class="txt-green">' + UI.icon('check-circle', 20) + '</span>خلاصهٔ نتیجهٔ Import</h3>' +
        '<p class="card-desc">فایل «' + UI.esc(sm.fileName) + '» — برگهٔ «' + UI.esc(sm.sheetName || '—') + '» — ' + Fmt.faDateTime(sm.importedAt) + '</p></div>' +
        '<div class="card-body">' +
        '<div class="grid-3" style="gap:12px">' +
        miniStat('list-filter', 'کل سطرها', Fmt.faInt(sm.totalRows)) +
        miniStat('database', 'رول‌های پایش‌شده', Fmt.faInt(monitored)) +
        miniStat('weight', 'وزن رول‌های خام', Fmt.faNum(sm.totalRawWeight, 1) + '<span class="unit" style="font-size:10px;color:var(--muted-foreground)">کیلوگرم</span>') +
        '</div>' +
        '<hr class="sep" />' +
        '<p class="font-bold" style="font-size:0.82rem;margin:0 0 8px">شمارندهٔ دسته‌ها پس از دسته‌بندی زنده:</p>' +
        '<div id="imp-summary-table"></div>' +
        '<p class="chart-hint" style="margin-top:10px">این خلاصه با تنظیمات فعلی سامانه محاسبه شده است؛ اگر پارامترها یا نگاشت ستون‌ها را تغییر دهید، دسته‌بندی به‌صورت زنده بازمحاسبه می‌شود و نیازی به Import مجدد نیست.</p>' +
        '</div></div>';
    }

    /* ---------------- جدول رول‌های فایل واردشده (بند ۴) ---------------- */
    if (snapshot.lastBatch) {
      var allRolls = allRollsOf(snapshot);
      html +=
        '<div class="card fade-in-up">' +
        '<div class="card-header tight"><h3 class="card-title">' + UI.icon('table', 20) + 'رول‌های فایل واردشده' +
        ' <span class="badge badge-secondary dt-num">' + Fmt.faInt(allRolls.length) + ' رول</span></h3>' +
        '<p class="card-desc">تمام رول‌های فایل «' + UI.esc(snapshot.lastBatch.fileName) +
        '» — هر ردیف با دکمهٔ «ویرایش» قابل اصلاح است و وضعیت هر رول (خام / EVA / برش‌خورده) فقط از طریق همان دکمه قابل تغییر است؛ رکوردهای ویرایش‌شده در بخش «رول‌های ویرایش‌شده» جمع می‌شوند. حداقل ۲۰۰۰ رکورد در هر صفحه نمایش داده می‌شود و ادامهٔ رکوردها با صفحه‌بندی در دسترس است. همهٔ تغییرات بلافاصله در کل پروژه اثر می‌کنند و در فایل پشتیبان و بازسازی نگاشت حفظ می‌شوند.</p></div>' +
        '<div class="card-body"><div id="imp-rolls-table"></div></div>' +
        '</div>';
    }

    /* ---------------- رول‌های ویرایش‌شده (بند ۴ — نسخهٔ ۱٫۳) ---------------- */
    if (snapshot.lastBatch) {
      var editedRolls = allRollsOf(snapshot).filter(function (r) { return r.edited; });
      html +=
        '<div class="card fade-in-up">' +
        '<div class="card-header tight"><h3 class="card-title"><span class="txt-primary">' + UI.icon('pencil', 20) + '</span>رول‌های ویرایش‌شده' +
        ' <span class="badge badge-secondary dt-num">' + Fmt.faInt(editedRolls.length) + ' رول</span></h3>' +
        '<p class="card-desc">رول‌هایی که وضعیت دستی یا فیلدهای آن‌ها به‌صورت دستی ویرایش شده است — با «ویرایش» قابل اصلاح مجدد هستند و با «حذف»، همهٔ ویرایش‌ها پاک شده و رول به حالت اولیهٔ فایل اکسل بازمی‌گردد.</p></div>' +
        '<div class="card-body"><div id="imp-edited-table"></div></div>' +
        '</div>';
    }

    /* ---------------- وضعیت آخرین Import ---------------- */
    var lastImport = snapshot.lastBatch;
    html +=
      '<div class="card fade-in-up">' +
      '<div class="card-header tight"><h3 class="card-title">' + UI.icon('database', 20) + 'وضعیت آخرین Import</h3>' +
      '<p class="card-desc">داده‌های فعلی سامانه (ذخیره‌شده در همین مرورگر) مبنای داشبورد و جداول است. با حذف، همهٔ رول‌ها و متادیتای مرتبط پاک می‌شود.</p></div>' +
      '<div class="card-body"><div class="row" style="justify-content:space-between;align-items:flex-start">' +
      (lastImport
        ? '<div class="grid-3" style="gap:8px 32px;flex:1;min-width:0">' +
          '<div><p class="text-xs txt-muted" style="margin:0">نام فایل</p><p class="ltr-code font-bold" style="margin:2px 0 0" title="' + UI.esc(lastImport.fileName) + '">' + UI.esc(lastImport.fileName) + '</p></div>' +
          '<div><p class="text-xs txt-muted" style="margin:0;display:flex;align-items:center;gap:5px">' + UI.icon('calendar', 13) + 'تاریخ ورود</p><p class="font-bold" style="margin:2px 0 0">' + Fmt.faDateTime(lastImport.importedAt) + '</p></div>' +
          '<div><p class="text-xs txt-muted" style="margin:0">تعداد سطرها</p><p class="font-bold" style="margin:2px 0 0">' + Fmt.faInt(lastImport.totalRows) + ' سطر</p></div>' +
          '</div>' +
          '<button type="button" class="btn btn-destructive" id="imp-delete-btn" style="min-width:160px" aria-label="حذف همهٔ داده‌های واردشده">' + UI.icon('trash', 16) + 'حذف همهٔ داده‌ها</button>'
        : '<div style="display:flex;flex-direction:column;gap:12px;align-items:flex-start;flex:1">' +
          '<p class="txt-muted" style="margin:0;font-size:0.82rem">هنوز هیچ فایلی وارد نشده است.</p>' +
          '<button type="button" class="btn btn-outline" id="imp-refresh-btn">' + UI.icon('database', 16) + 'به‌روزرسانی وضعیت</button>' +
          '</div>') +
      '</div></div></div>';

    el.innerHTML = html;
    UI.hydrateIcons(el);

    /* ---------------- جدول خلاصهٔ دسته‌ها ---------------- */
    if (state.summary) {
      var sm2 = state.summary;
      var rows = EVA.CATEGORY_ORDER.map(function (cat) {
        return {
          cat: cat,
          count: sm2.counts[cat] || 0,
          share: sm2.totalRows > 0 ? ((sm2.counts[cat] || 0) / sm2.totalRows) * 100 : null,
        };
      });
      var table = DataTableUI.create({
        tableId: 'import-summary',
        columns: summaryColumns(),
        rows: rows,
        getRowKey: function (r) { return r.cat; },
        compact: true,
        sums: { count: { type: 'number', format: Fmt.faInt } },
      });
      el.querySelector('#imp-summary-table').appendChild(table.el);
    }

    /* ---------------- جدول رول‌های فایل واردشده (بند ۴) ---------------- */
    if (snapshot.lastBatch) {
      renderImportedRollsTable(el, snapshot);
    }

    /* ---------------- جدول رول‌های ویرایش‌شده (بند ۴ — نسخهٔ ۱٫۳) ---------------- */
    if (snapshot.lastBatch) {
      renderEditedRollsTable(el, snapshot);
    }

    bindEvents(el, snapshot);
  }

  function miniStat(iconName, label, valueHtml) {
    return (
      '<div style="border:1px solid var(--border);background:rgba(238,242,240,0.5);border-radius:10px;padding:12px">' +
      '<p class="text-xs txt-muted" style="margin:0;display:flex;align-items:center;gap:5px">' + UI.icon(iconName, 14) + label + '</p>' +
      '<p class="font-bold" style="margin:4px 0 0;font-size:1.05rem">' + valueHtml + '</p></div>'
    );
  }

  /* =========================================================================
     جدول رول‌های فایل واردشده + ویرایش + وضعیت دستی (بند ۴ نسخهٔ ۱٫۲)
     -------------------------------------------------------------------------
     پورت import-view.tsx: همهٔ رول‌ها با دسته‌بندی زنده (شامل وضعیت دستی)،
     مرتب‌شده مثل /api/rolls?category=all (ستاپ سپس شمارهٔ رول).
     ========================================================================= */

  /** همهٔ رول‌ها به‌صورت DTO + مرتب‌سازی ستاپ سپس شمارهٔ رول (null ها آخر) */
  function allRollsOf(snapshot) {
    return snapshot.rolls
      .map(function (r) { return EVA.toRollDto(r, snapshot.settings); })
      .sort(function (a, b) {
        return (
          ((a.setupNumber == null ? Number.MAX_SAFE_INTEGER : a.setupNumber) -
            (b.setupNumber == null ? Number.MAX_SAFE_INTEGER : b.setupNumber)) ||
          a.rollNumber.localeCompare(b.rollNumber)
        );
      });
  }

  /** گزینه‌های سلکت وضعیت دستی — مقدار فعلی انتخاب می‌شود */
  function typeOverrideOptionsHtml(current) {
    return TYPE_OVERRIDE_OPTIONS.map(function (o) {
      return '<option value="' + o.value + '"' + (o.value === current ? ' selected' : '') + '>' + UI.esc(o.label) + '</option>';
    }).join('');
  }

  /** ستون‌های جدول رول‌های واردشده (ترتیب RTL مثل وب — بند ۴-۳) */
  function importedRollsColumns() {
    return [
      {
        key: 'category',
        label: 'وضعیت شناسایی‌شده',
        headerTitle: 'وضعیت مؤثر رول — با احتساب انتخاب دستی',
        render: function (r) {
          return (
            '<span style="display:flex;flex-direction:column;align-items:flex-start;gap:4px">' +
            '<span class="badge ' + CATEGORY_BADGE[r.category] + '">' + UI.esc(EVA.CATEGORY_LABELS[r.category]) + '</span>' +
            (r.typeOverride
              ? '<span class="manual-flag" title="انتخاب دستی: ' + UI.esc(OVERRIDE_LABEL[r.typeOverride]) + ' — بر منطق خودکار اولویت دارد">دستی</span>'
              : '') +
            '</span>'
          );
        },
        tokens: function (r) { return [EVA.CATEGORY_LABELS[r.category], r.category]; },
      },
      {
        key: 'rollNumber',
        label: 'شماره رول',
        headerTitle: 'شمارهٔ کامل رول — ساختار: حرف + سالن + سال + سری + بازوی برش',
        render: function (r) {
          return '<span class="ltr-code text-xs font-bold" title="' + UI.esc(r.rollNumber) + '">' + UI.esc(r.rollNumber) + '</span>';
        },
        tokens: function (r) { return [r.rollNumber]; },
      },
      {
        key: 'filmType',
        label: 'نوع فیلم',
        render: function (r) { return '<span class="ltr-code text-xs">' + UI.esc(r.filmType) + '</span>'; },
        tokens: function (r) { return [r.filmType]; },
      },
      { key: 'setupNumber', label: 'شماره ستاپ', sortableType: 'number', render: function (r) { return '<span class="dt-num">' + Fmt.faInt(r.setupNumber) + '</span>'; } },
      { key: 'width', label: 'عرض (میلی‌متر)', sortableType: 'number', render: function (r) { return '<span class="dt-num">' + Fmt.faNum(r.width, 0) + '</span>'; } },
      { key: 'thickness', label: 'ضخامت (میکرون)', sortableType: 'number', render: function (r) { return '<span class="dt-num">' + Fmt.faNum(r.thickness, 0) + '</span>'; } },
      {
        key: 'netWeight',
        label: 'وزن خالص (کیلوگرم)',
        sortableType: 'number',
        render: function (r) { return '<span class="font-bold dt-num">' + Fmt.faNum(r.netWeight, 2) + '</span>'; },
      },
      {
        key: 'grade',
        label: 'گرید',
        render: function (r) {
          return r.grade
            ? '<span class="badge badge-outline ltr-code text-xs">' + UI.esc(r.grade) + '</span>'
            : '<span class="txt-muted">—</span>';
        },
        tokens: function (r) { return r.grade ? [r.grade] : []; },
      },
      { key: 'length', label: 'متراژ (متر)', sortableType: 'number', render: function (r) { return '<span class="dt-num">' + Fmt.faNum(r.length, 0) + '</span>'; } },
      { key: 'initialWidth', label: 'عرض رول اولیه (میلی‌متر)', sortableType: 'number', render: function (r) { return '<span class="dt-num">' + Fmt.faNum(r.initialWidth, 0) + '</span>'; } },
      {
        key: 'palletNumber',
        label: 'شماره پالت',
        render: function (r) { return '<span class="dt-num">' + (r.palletNumber == null ? '—' : UI.esc(r.palletNumber)) + '</span>'; },
        tokens: function (r) { return r.palletNumber == null ? [] : [r.palletNumber]; },
      },
      {
        key: 'productionDate',
        label: 'تاریخ تولید',
        render: function (r) { return '<span class="text-xs">' + (r.productionDate == null ? '—' : UI.esc(r.productionDate)) + '</span>'; },
        tokens: function (r) { return r.productionDate == null ? [] : [r.productionDate]; },
      },
      {
        key: 'position',
        label: 'موقعیت فعلی',
        render: function (r) { return '<span class="text-xs">' + (r.position == null ? '—' : UI.esc(r.position)) + '</span>'; },
        tokens: function (r) { return r.position == null ? [] : [r.position]; },
      },
      {
        key: 'externalId',
        label: 'شناسه رول',
        render: function (r) { return '<span class="ltr-code text-xs">' + (r.externalId == null ? '—' : UI.esc(r.externalId)) + '</span>'; },
        tokens: function (r) { return r.externalId == null ? [] : [r.externalId]; },
      },
      {
        key: 'actions',
        label: 'ویرایش',
        headerTitle: 'ویرایش کامل اطلاعات این رول',
        filterable: false,
        align: 'center',
        render: function (r) {
          return (
            '<button type="button" class="btn btn-outline btn-sm" data-edit-roll="' + r.id + '" aria-label="ویرایش رول ' + UI.esc(r.rollNumber) + '">' +
            UI.icon('pencil', 14) + 'ویرایش</button>'
          );
        },
      },
    ];
  }

  /** ساخت جدول رول‌های واردشده + رویداد ویرایش (delegation) */
  function renderImportedRollsTable(el, snapshot) {
    var allRolls = allRollsOf(snapshot);
    var table = DataTableUI.create({
      tableId: 'import-rolls',
      columns: importedRollsColumns(),
      rows: allRolls,
      getRowKey: function (r) { return r.id; },
      compact: true,
      defaultVisibleRows: 15,
      paginated: true,
      defaultPageSize: 2000,
      emptyText: 'رولی یافت نشد.',
      sums: { netWeight: { type: 'number', format: function (n) { return Fmt.faNum(n, 2); } } },
    });
    el.querySelector('#imp-rolls-table').appendChild(table.el);

    /* دکمهٔ «ویرایش» هر ردیف → دیالوگ ویرایش کامل (تنها مسیر تغییر وضعیت — بند ۴ نسخهٔ ۱٫۳) */
    table.el.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-edit-roll]') : null;
      if (!btn) return;
      var id = Number(btn.getAttribute('data-edit-roll'));
      var dto = allRolls.find(function (r) { return r.id === id; });
      if (dto) openEditDialog(dto, snapshot);
    });
  }

  /* =========================================================================
     جدول رول‌های ویرایش‌شده (بند ۴ — نسخهٔ ۱٫۳ — پورت import-view.tsx)
     ========================================================================= */

  /** ستون‌های جدول رول‌های ویرایش‌شده */
  function editedRollsColumns() {
    return [
      {
        key: 'rollNumber',
        label: 'شماره رول',
        headerTitle: 'شمارهٔ کامل رول — ساختار: حرف + سالن + سال + سری + بازوی برش',
        render: function (r) {
          return '<span class="ltr-code text-xs font-bold" title="' + UI.esc(r.rollNumber) + '">' + UI.esc(r.rollNumber) + '</span>';
        },
        tokens: function (r) { return [r.rollNumber]; },
      },
      {
        key: 'category',
        label: 'وضعیت فعلی',
        headerTitle: 'وضعیت مؤثر رول — با احتساب انتخاب دستی',
        render: function (r) {
          return (
            '<span style="display:inline-flex;flex-wrap:wrap;align-items:center;gap:4px">' +
            '<span class="badge ' + CATEGORY_BADGE[r.category] + '">' + UI.esc(EVA.CATEGORY_LABELS[r.category]) + '</span>' +
            (r.typeOverride
              ? '<span class="manual-flag" title="انتخاب دستی: ' + UI.esc(OVERRIDE_LABEL[r.typeOverride]) + ' — بر منطق خودکار اولویت دارد">دستی</span>'
              : '') +
            '</span>'
          );
        },
        tokens: function (r) { return [EVA.CATEGORY_LABELS[r.category], r.category]; },
      },
      {
        key: 'editedFields',
        label: 'فیلدهای ویرایش‌شده',
        headerTitle: 'فیلدهایی که مقدار آن‌ها به‌صورت دستی تغییر کرده است',
        render: function (r) {
          var keys = Object.keys(r.manualEdit || {});
          if (keys.length === 0) {
            return '<span class="txt-muted" style="font-size:0.72rem">فقط وضعیت دستی</span>';
          }
          return (
            '<span style="display:flex;flex-wrap:wrap;gap:4px;max-width:290px">' +
            keys.map(function (k) {
              var cur = r.manualEdit[k] === null || r.manualEdit[k] === undefined ? '—' : String(r.manualEdit[k]);
              return '<span class="badge badge-outline" title="مقدار فعلی: ' + UI.esc(cur) + '" style="font-size:0.66rem">' +
                UI.esc(EDIT_FIELD_LABELS[k] || k) + '</span>';
            }).join('') +
            '</span>'
          );
        },
        tokens: function (r) {
          return Object.keys(r.manualEdit || {}).map(function (k) { return EDIT_FIELD_LABELS[k] || k; });
        },
      },
      {
        key: 'actions',
        label: 'عملیات',
        headerTitle: 'ویرایش مجدد یا حذف ویرایش‌ها (بازگشت به حالت اولیهٔ فایل اکسل)',
        filterable: false,
        align: 'center',
        render: function (r) {
          return (
            '<span style="display:inline-flex;align-items:center;gap:4px">' +
            '<button type="button" class="btn btn-outline btn-sm" data-edit-roll="' + r.id + '" aria-label="ویرایش رول ' + UI.esc(r.rollNumber) + '">' +
            UI.icon('pencil', 14) + 'ویرایش</button>' +
            '<button type="button" class="btn btn-outline btn-sm btn-danger-ghost" data-revert-roll="' + r.id + '" aria-label="حذف ویرایش‌های رول ' + UI.esc(r.rollNumber) + '" title="حذف ویرایش‌ها — بازگشت رول به حالت اولیهٔ فایل اکسل">' +
            UI.icon('trash', 14) + 'حذف</button>' +
            '</span>'
          );
        },
      },
    ];
  }

  /** ساخت جدول رول‌های ویرایش‌شده + رویدادهای ویرایش/حذف (delegation) */
  function renderEditedRollsTable(el, snapshot) {
    var allRolls = allRollsOf(snapshot);
    var editedRolls = allRolls.filter(function (r) { return r.edited; });
    var table = DataTableUI.create({
      tableId: 'import-rolls-edited',
      columns: editedRollsColumns(),
      rows: editedRolls,
      getRowKey: function (r) { return r.id; },
      compact: true,
      defaultVisibleRows: 10,
      emptyText: 'هیچ رولی به‌صورت دستی ویرایش نشده است — با دکمهٔ «ویرایش» در جدول بالا شروع کنید.',
      footerNote: 'ویرایش و حذف در این بخش فوراً در کل پروژه و جدول بالا اعمال می‌شود',
    });
    el.querySelector('#imp-edited-table').appendChild(table.el);

    /* ویرایش مجدد → همان دیالوگ */
    table.el.addEventListener('click', function (e) {
      var editBtn = e.target.closest ? e.target.closest('[data-edit-roll]') : null;
      if (editBtn) {
        var id = Number(editBtn.getAttribute('data-edit-roll'));
        var dto = allRolls.find(function (r) { return r.id === id; });
        if (dto) openEditDialog(dto, snapshot);
        return;
      }
      var revertBtn = e.target.closest ? e.target.closest('[data-revert-roll]') : null;
      if (revertBtn) {
        var rid = Number(revertBtn.getAttribute('data-revert-roll'));
        var rdto = allRolls.find(function (r) { return r.id === rid; });
        if (rdto) openRevertDialog(rdto);
      }
    });
  }

  /** دیالوگ تأیید حذف ویرایش‌های رول (بند ۴ — نسخهٔ ۱٫۳) */
  function openRevertDialog(dto) {
    UI.dialog({
      title: 'حذف ویرایش‌های این رول؟',
      bodyHtml:
        '<p style="font-size:0.85rem;line-height:1.9;margin:0">همهٔ ویرایش‌های دستی رول «<span class="ltr-code">' + UI.esc(dto.rollNumber) + '</span>» پاک می‌شود و مقادیر آن به حالت اولیهٔ فایل اکسل بازمی‌گردد؛ وضعیت رول نیز دوباره بر اساس منطق خودکار تنظیمات تعیین می‌شود.</p>',
      footerHtml:
        '<button type="button" class="btn btn-outline" data-act="cancel">انصراف</button>' +
        '<button type="button" class="btn btn-destructive" data-act="ok">' + UI.icon('trash', 15) + 'بله، حذف کن</button>',
      onMount: function (dlg) {
        dlg.el.querySelector('[data-act="cancel"]').addEventListener('click', dlg.close);
        var okBtn = dlg.el.querySelector('[data-act="ok"]');
        okBtn.addEventListener('click', function () {
          okBtn.disabled = true;
          Store.revertRoll(dto.id)
            .then(function (res) {
              var rec = res && res.record ? res.record : res;
              var updated = EVA.toRollDto(rec, Store.getSettings());
              dlg.close();
              UI.toast.success('ویرایش‌های رول «' + updated.rollNumber + '» حذف شد', {
                description: res && res.fullyReverted === false
                  ? 'وضعیت دستی پاک شد؛ به دلیل نبود دادهٔ خام، مقادیر فیلدها تغییر نکرد.'
                  : 'مقادیر رول به حالت اولیهٔ فایل اکسل بازگشت.',
              });
              return window.App.refreshAll();
            })
            .catch(function (err) {
              okBtn.disabled = false;
              UI.toast.error((err && err.message) || 'خطا در حذف ویرایش‌ها');
            });
        });
      },
    });
  }

  /* =========================================================================
     دیالوگ ویرایش رول (بند ۴ — پورت RollEditDialog)
     ========================================================================= */

  /** فیلد فرم ویرایش — عنوان + ورودی (واحد/LTR اختیاری) مثل EditField وب */
  function editFieldHtml(id, label, value, opts) {
    opts = opts || {};
    var inputAttrs =
      ' id="' + id + '" class="input' + (opts.ltr ? ' ltr-code' : '') + '"' +
      ' value="' + UI.esc(value) + '" placeholder="' + UI.esc(opts.placeholder || '') + '"' +
      (opts.unit ? ' inputmode="decimal"' : '') +
      (opts.ltr ? ' dir="ltr"' : '') +
      ' style="height:40px' + (opts.unit ? ';padding-left:52px' : '') + '"';
    return (
      '<div class="field" style="gap:5px">' +
      '<label class="field-label" for="' + id + '">' + UI.esc(label) +
      (opts.unit ? ' <span style="font-weight:400;color:var(--muted-foreground)">(' + UI.esc(opts.unit) + ')</span>' : '') +
      '</label>' +
      (opts.unit
        ? '<div class="input-wrap"><input type="text"' + inputAttrs + ' /><span class="input-unit">' + UI.esc(opts.unit) + '</span></div>'
        : '<input type="text"' + inputAttrs + ' />') +
      '</div>'
    );
  }

  /** مقدار فیلد فرم از DTO — null → رشتهٔ خالی */
  function formValue(v) {
    return v === null || v === undefined ? '' : String(v);
  }

  /** دیالوگ ویرایش رول: وضعیت فعلی + تغییر وضعیت + هر ۱۳ فیلد + ذخیره/انصراف (بند ۴ نسخهٔ ۱٫۳) */
  function openEditDialog(dto, snapshot) {
    var bodyHtml =
      '<div style="display:flex;flex-direction:column;gap:14px">' +
      /* وضعیت فعلی رول (بند ۴ — نسخهٔ ۱٫۳) */
      '<div style="border:1px solid var(--border);background:rgba(238,242,240,0.5);border-radius:10px;padding:12px">' +
      '<p class="field-label" style="margin:0">وضعیت فعلی رول:</p>' +
      '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:6px">' +
      '<span class="badge ' + CATEGORY_BADGE[dto.category] + '">' + UI.esc(EVA.CATEGORY_LABELS[dto.category]) + '</span>' +
      (dto.typeOverride
        ? '<span class="text-xs txt-muted" style="font-size:0.72rem;line-height:1.6">انتخاب دستی (' + UI.esc(OVERRIDE_LABEL[dto.typeOverride]) + ') — تشخیص خودکار: ' + UI.esc(EVA.CATEGORY_LABELS[dto.autoCategory]) + '</span>'
        : '<span class="text-xs txt-muted" style="font-size:0.72rem;line-height:1.6">تشخیص خودکار بر اساس تنظیمات فعلی</span>') +
      '</div></div>' +
      /* تغییر وضعیت (تنها از همین مسیر — بند ۴ نسخهٔ ۱٫۳) */
      '<div class="field" style="gap:5px">' +
      '<label class="field-label" for="ef-type-override">تغییر وضعیت رول (شناسایی دستی)</label>' +
      '<select id="ef-type-override" class="select" style="height:40px;min-width:0;width:100%" dir="rtl" aria-label="تغییر وضعیت دستی رول">' +
      typeOverrideOptionsHtml(dto.typeOverride || '__auto') +
      '</select>' +
      '<p class="field-hint">«خودکار (بدون انتخاب)» یعنی وضعیت طبق منطق شناسایی تنظیمات تعیین شود؛ انتخاب هر وضعیت، بر منطق خودکار اولویت دارد.</p>' +
      '</div>' +
      '<hr class="sep" style="margin:0" />' +
      /* هر ۱۳ فیلد */
      '<div class="edit-grid">' +
      editFieldHtml('ef-roll', 'شماره رول', formValue(dto.rollNumber), { ltr: true }) +
      editFieldHtml('ef-film', 'نوع فیلم', formValue(dto.filmType), { ltr: true, placeholder: 'FSN02' }) +
      editFieldHtml('ef-setup', 'شماره ستاپ', formValue(dto.setupNumber), { unit: 'عدد' }) +
      editFieldHtml('ef-width', 'عرض', formValue(dto.width), { unit: 'میلی‌متر' }) +
      editFieldHtml('ef-initial', 'عرض رول اولیه', formValue(dto.initialWidth), { unit: 'میلی‌متر' }) +
      editFieldHtml('ef-thickness', 'ضخامت', formValue(dto.thickness), { unit: 'میکرون' }) +
      editFieldHtml('ef-length', 'متراژ', formValue(dto.length), { unit: 'متر' }) +
      editFieldHtml('ef-weight', 'وزن خالص', formValue(dto.netWeight), { unit: 'کیلوگرم' }) +
      editFieldHtml('ef-grade', 'گرید', formValue(dto.grade), { ltr: true, placeholder: 'X' }) +
      editFieldHtml('ef-pallet', 'شماره پالت', formValue(dto.palletNumber)) +
      editFieldHtml('ef-date', 'تاریخ تولید', formValue(dto.productionDate)) +
      editFieldHtml('ef-position', 'موقعیت فعلی', formValue(dto.position)) +
      editFieldHtml('ef-external', 'شناسه رول', formValue(dto.externalId)) +
      '</div>' +
      '<p class="text-xs txt-muted" style="margin:0;line-height:1.8">فیلدهای خالی به‌صورت «بدون مقدار» ذخیره می‌شوند. ویرایش‌ها در بازسازی نگاشت ستون‌ها و فایل پشتیبان حفظ می‌شوند.</p>' +
      '</div>';

    UI.dialog({
      wide: true,
      title: '<span class="txt-primary">' + UI.icon('pencil', 16) + '</span>ویرایش رول' +
        ' <span class="ltr-code badge badge-secondary" style="font-size:0.72rem" title="' + UI.esc(dto.rollNumber) + '">' + UI.esc(dto.rollNumber) + '</span>',
      desc: 'اطلاعات این رول را اصلاح کنید؛ ذخیره، بلافاصله در داشبورد، رول‌ها و گروه‌های برش‌خورده اثر می‌کند.',
      bodyHtml: bodyHtml,
      footerHtml:
        '<button type="button" class="btn btn-outline" data-act="cancel">انصراف</button>' +
        '<button type="button" class="btn btn-primary" data-act="save">' + UI.icon('save', 15) + 'ذخیرهٔ تغییرات</button>',
      onMount: function (dlg) {
        dlg.el.querySelector('[data-act="cancel"]').addEventListener('click', dlg.close);
        dlg.el.querySelector('[data-act="save"]').addEventListener('click', function () {
          submitEditDialog(dlg, dto, snapshot);
        });
      },
    });

    /* تمرکز اولیه روی فیلد شمارهٔ رول */
    var first = document.getElementById('ef-roll');
    if (first) first.focus();
  }

  /** اعتبارسنجی سمت کلاینت + ساخت ورودی + Store.updateRoll + toast (بند ۴) */
  function submitEditDialog(dlg, dto, snapshot) {
    var g = function (id) { var el = dlg.el.querySelector('#' + id); return el ? el.value : ''; };
    var rollNumber = g('ef-roll').trim();
    var filmType = g('ef-film').trim();
    if (rollNumber === '') {
      UI.toast.error('شمارهٔ رول نمی‌تواند خالی باشد.');
      return;
    }
    if (filmType === '') {
      UI.toast.error('نوع فیلم نمی‌تواند خالی باشد.');
      return;
    }
    var num = function (id) {
      var v = g(id).trim();
      return v === '' ? null : Number(v);
    };
    var str = function (id) {
      var v = g(id).trim();
      return v === '' ? null : v;
    };
    var typeOverride = g('ef-type-override') === '__auto' ? null : g('ef-type-override');

    var input = {
      rollNumber: rollNumber,
      filmType: filmType,
      setupNumber: num('ef-setup'),
      width: num('ef-width'),
      initialWidth: num('ef-initial'),
      thickness: num('ef-thickness'),
      length: num('ef-length'),
      netWeight: num('ef-weight'),
      grade: str('ef-grade'),
      palletNumber: str('ef-pallet'),
      productionDate: str('ef-date'),
      position: str('ef-position'),
      externalId: str('ef-external'),
      typeOverride: typeOverride,
    };

    var saveBtn = dlg.el.querySelector('[data-act="save"]');
    saveBtn.disabled = true;
    Store.updateRoll(dto.id, input)
      .then(function (rec) {
        var updated = EVA.toRollDto(rec, snapshot.settings);
        dlg.close();
        UI.toast.success('رول «' + updated.rollNumber + '» به‌روزرسانی شد', {
          description: 'وضعیت مؤثر: ' + EVA.CATEGORY_LABELS[updated.category],
        });
        return window.App.refreshAll();
      })
      .catch(function (err) {
        saveBtn.disabled = false;
        UI.toast.error((err && err.message) || 'ذخیرهٔ تغییرات ناموفق بود');
      });
  }

  /* =========================================================================
     رویدادها
     ========================================================================= */

  function bindEvents(el, snapshot) {
    var dropzone = el.querySelector('#imp-dropzone');
    var input = el.querySelector('#imp-file-input');

    function pickFile(file) {
      if (!file) return;
      if (!/\.(xlsx|xlsm|xls)$/i.test(file.name)) {
        UI.toast.error('فرمت فایل مجاز نیست', { description: 'فقط فایل‌های اکسل با پسوند xls یا xlsx پذیرفته می‌شوند.' });
        return;
      }
      state.selectedFile = file.name;
      state.missingError = null;
      state.uploading = true;
      window.App.rerender(); // نمایش حالت پردازش

      Store.importExcelFile(file, Store.getSettings())
        .then(function (summary) {
          state.summary = summary;
          state.missingError = null;
          state.uploading = false;
          UI.toast.success('فایل «' + summary.fileName + '» با موفقیت وارد شد', {
            description: Fmt.faInt(summary.totalRows) + ' سطر پردازش و دسته‌بندی شد.',
          });
          return window.App.refreshAll();
        })
        .catch(function (e) {
          state.uploading = false;
          if (e && e.name === 'ImportError' && e.importExtra && e.importExtra.missing) {
            state.missingError = {
              message: e.message,
              missing: e.importExtra.missing,
              headers: e.importExtra.headers || [],
            };
            UI.toast.error('ستون‌های الزامی در فایل یافت نشد');
          } else {
            UI.toast.error((e && e.message) || 'خطای نامشخص در بارگذاری فایل');
          }
          window.App.rerender();
        });
    }

    dropzone.addEventListener('click', function () { if (!state.uploading) input.click(); });
    dropzone.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && !state.uploading) {
        e.preventDefault();
        input.click();
      }
    });
    dropzone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropzone.classList.add('over');
    });
    dropzone.addEventListener('dragleave', function () {
      dropzone.classList.remove('over');
    });
    dropzone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropzone.classList.remove('over');
      if (!state.uploading && e.dataTransfer.files && e.dataTransfer.files[0]) {
        pickFile(e.dataTransfer.files[0]);
      }
    });
    input.addEventListener('change', function (e) {
      pickFile(e.target.files ? e.target.files[0] : null);
      input.value = '';
    });
    var pickBtn = el.querySelector('#imp-pick-btn');
    if (pickBtn) pickBtn.addEventListener('click', function () { input.click(); });

    /* حذف همهٔ داده‌ها — با تأییدیه */
    var deleteBtn = el.querySelector('#imp-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function () {
        var lastImport = snapshot.lastBatch;
        UI.dialog({
          title: 'حذف همهٔ داده‌های واردشده؟',
          bodyHtml:
            '<p style="font-size:0.85rem;line-height:1.9;margin:0">همهٔ ' + Fmt.faInt(lastImport.totalRows) +
            ' سطرِ فایل «<span class="ltr-code">' + UI.esc(lastImport.fileName) + '</span>» به‌همراه داشبورد، جداول' +
            ' و گروه‌بندی‌ها حذف می‌شود. این عمل بازگشت‌پذیر نیست و برای بازیابی باید فایل را دوباره بارگذاری کنید.</p>',
          footerHtml:
            '<button type="button" class="btn btn-outline" data-act="cancel">انصراف</button>' +
            '<button type="button" class="btn btn-destructive" data-act="ok">' + UI.icon('trash', 15) + 'بله، حذف کن</button>',
          onMount: function (dlg) {
            dlg.el.querySelector('[data-act="cancel"]').addEventListener('click', dlg.close);
            dlg.el.querySelector('[data-act="ok"]').addEventListener('click', function () {
              Store.deleteAllData().then(function () {
                dlg.close();
                state.summary = null;
                state.selectedFile = null;
                state.missingError = null;
                UI.toast.success('همهٔ داده‌های واردشده حذف شد');
                window.App.refreshAll();
              });
            });
          },
        });
      });
    }

    var refreshBtn = el.querySelector('#imp-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', function () { window.App.refreshAll(); });
  }

  window.EvaViews = window.EvaViews || {};
  window.EvaViews.import = { render: render };
})();
