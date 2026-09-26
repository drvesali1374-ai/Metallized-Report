/* =========================================================================
   views/settings.js — تنظیمات (پورت settings-view.tsx)
   -------------------------------------------------------------------------
   ۱) پارامترهای سامانه: ادیتور انواع فیلم خام/EVA + سه فیلد عددی هم‌تراز
      در یک ردیف + فرمول زندهٔ مانده زمان + اعتبارسنجی فارسی
   ۲) نگاشت ستون‌های اکسل: ۱۳ فیلد با تشخیص خودکار + بازسازی رکوردها
   ۳) پشتیبان‌گیری و بازیابی: ساخت JSON سازگار با نسخهٔ وب + بازیابی با
      همان قواعد و پیام‌های اعتبارسنجی سرور
   ۴) راهنمای کوتاه
   ========================================================================= */
(function () {
  'use strict';

  var AUTO_VALUE = '__auto__';
  var NUM_FIELDS = ['rawMinWidth', 'rawMaxWidth', 'rawThickness', 'evaCapacityPerShift', 'shiftsPerDay', 'hoursPerDay'];

  /* ---------------- پیش‌نویس‌ها (تا زمان ذخیره فقط محلی — مانِد در بازرندر) ---------------- */
  var draft = {
    num: null,        // {field: string} | null
    rawTypes: null,   // string[] | null
    evaTypes: null,   // string[] | null
    mapping: null,    // ColumnMapping | null
    restoreErrors: null,
    restoreErrorTitle: 'فایل پشتیبان معتبر نیست:',
    lastAction: null,
    busy: false, // قفل موقت هنگام ذخیره/بازیابی
  };

  function resetParamDrafts() {
    draft.num = null;
    draft.rawTypes = null;
    draft.evaTypes = null;
  }

  /* =========================================================================
     رندر
     ========================================================================= */

  function render(el, snapshot) {
    var params = snapshot.settings;
    var headers = snapshot.headers;

    var numValue = function (f) {
      return draft.num && draft.num[f] !== undefined ? draft.num[f] : String(params[f] == null ? '' : params[f]);
    };
    var rawTypes = draft.rawTypes !== null ? draft.rawTypes : params.rawFilmTypes;
    var evaTypes = draft.evaTypes !== null ? draft.evaTypes : params.evaFilmTypes;
    var mapping = draft.mapping !== null ? draft.mapping : (params.columnMapping || {});
    var paramsDirty = draft.num !== null || draft.rawTypes !== null || draft.evaTypes !== null;
    var mappingDirty = draft.mapping !== null;

    var html = '';

    /* ================ ۱) پارامترهای سامانه ================ */
    html +=
      '<div class="card fade-in-up">' +
      '<div class="card-header tight"><h3 class="card-title">' + UI.icon('settings-2', 20) + 'پارامترهای سامانه' +
      (paramsDirty ? ' <span class="badge badge-amber">تغییرات ذخیره‌نشده</span>' : '') + '</h3>' +
      '<p class="card-desc">این پارامترها به‌صورت <strong>زنده</strong> روی دسته‌بندی رول‌ها و محاسبهٔ مانده زمان اثر می‌گذارند — بدون نیاز به Import مجدد؛ بلافاصله پس از ذخیره، داشبورد و جداول به‌روزرسانی می‌شوند.</p></div>' +
      '<div class="card-body">';

    // --- قوانین رول خام ---
    html +=
      '<section aria-label="قوانین رول خام" style="margin-bottom:20px">' +
      '<h3 style="display:flex;align-items:center;gap:8px;font-size:0.85rem;font-weight:700;margin:0 0 16px"><span class="txt-primary">' + UI.icon('tag', 16) + '</span>قوانین شناسایی رول خام</h3>' +
      filmTypesEditorHtml('raw-film-types', 'انواع فیلم رول خام', 'رول‌هایی با این نوع فیلم، در صورت برقراری شرایط عرض و ضخامت، «خام» شمرده می‌شوند.', rawTypes) +
      '<div class="grid-3" style="margin-top:16px">' +
      numFieldHtml('rawMinWidth', 'حداقل عرض رول خام', 'میلی‌متر', '', numValue('rawMinWidth')) +
      numFieldHtml('rawMaxWidth', 'حداکثر عرض رول خام', 'میلی‌متر', '', numValue('rawMaxWidth')) +
      numFieldHtml('rawThickness', 'ضخامت رول خام', 'میکرون', '', numValue('rawThickness')) +
      '</div></section><hr class="sep" />';

    // --- قوانین خط EVA ---
    html +=
      '<section aria-label="قوانین خط EVA" style="margin-bottom:20px">' +
      '<h3 style="display:flex;align-items:center;gap:8px;font-size:0.85rem;font-weight:700;margin:0 0 16px"><span class="txt-primary">' + UI.icon('gauge', 16) + '</span>قوانین خط EVA و ظرفیت تولید</h3>' +
      filmTypesEditorHtml('eva-film-types', 'انواع فیلم رول EVA', 'رول‌هایی با این نوع فیلم باید در شمارهٔ رول، بعد از بازوی برش خام، حرف E داشته باشند.', evaTypes) +
      '<div class="grid-3" style="margin-top:16px">' +
      numFieldHtml('evaCapacityPerShift', 'ظرفیت هر شیفت دستگاه EVA', 'کیلوگرم', 'مصرف رول خام در هر شیفت', numValue('evaCapacityPerShift')) +
      numFieldHtml('shiftsPerDay', 'تعداد شیفت در روز', 'شیفت', '', numValue('shiftsPerDay')) +
      numFieldHtml('hoursPerDay', 'ساعت تولید در شبانه‌روز', 'ساعت', 'برای تبدیل روز به ساعت', numValue('hoursPerDay')) +
      '</div></section>';

    // --- فرمول زنده + خطاها + دکمه‌ها (بازترسیم هدفمند) ---
    html +=
      '<div id="st-dynamic">' + dynamicPartsHtml(snapshot, rawTypes, evaTypes, numValue, paramsDirty) + '</div>';

    html += '</div></div>';

    /* ================ ۲) نگاشت ستون‌های اکسل ================ */
    html +=
      '<div class="card fade-in-up">' +
      '<div class="card-header tight"><h3 class="card-title">' + UI.icon('database', 20) + 'نگاشت ستون‌های اکسل' +
      (mappingDirty ? ' <span class="badge badge-amber">تغییرات ذخیره‌نشده</span>' : '') + '</h3>' +
      '<p class="card-desc">مشخص کنید هر فیلد منطقی سامانه از کدام ستون فایل اکسل خوانده شود. انتخاب دستی شما بر تشخیص خودکار اولویت دارد. ذخیرهٔ نگاشت، همهٔ رکوردهای موجود را از دادهٔ خام <strong>بازسازی</strong> می‌کند.</p></div>' +
      '<div class="card-body">';

    if (headers.length === 0) {
      html +=
        '<div class="alert alert-default">' + UI.icon('info', 16) +
        '<div class="alert-body"><p class="alert-title">هدر فایلی در دسترس نیست</p>' +
        '<p>برای تنظیم نگاشت، ابتدا یک فایل در بخش ورود داده‌ها وارد کنید؛ پس از آن، هدرهای فایل اینجا نمایش داده می‌شوند.</p>' +
        '<button type="button" class="btn btn-outline btn-sm mt-2 eva-goto-import">رفتن به ورود داده‌ها</button>' +
        '</div></div>';
    } else {
      html += '<p class="text-xs txt-muted" style="margin:0 0 12px">' + Fmt.faInt(headers.length) + ' ستون در فایل «' + UI.esc(snapshot.lastBatch ? snapshot.lastBatch.fileName : '—') + '» شناسایی شده است.</p>';
      html += '<div style="border:1px solid var(--border);border-radius:12px;overflow:hidden" id="st-map-rows">';
      EVA.MAPPABLE_FIELD_ORDER.forEach(function (field) {
        var saved = mapping[field];
        var isRequired = EVA.REQUIRED_FIELDS.indexOf(field) !== -1;
        var auto = EVA.buildFieldMapping(headers, mapping).map[field];
        var effectiveValue = typeof saved === 'string' && saved.trim() !== '' ? saved : auto;
        html +=
          '<div style="display:flex;flex-direction:column;gap:8px;padding:12px;border-bottom:1px solid var(--border)" class="st-map-row">' +
          '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px">' +
          '<span style="font-size:0.82rem;font-weight:500">' + UI.esc(EVA.FIELD_LABELS[field]) + '</span>' +
          (isRequired ? '<span class="badge badge-destructive" style="font-size:10px;padding:1px 7px">الزامی</span>' : '') +
          (typeof saved === 'string' && saved.trim() !== ''
            ? '<span class="badge badge-primary-outline">انتخاب دستی</span>'
            : '<span class="badge badge-outline">خودکار</span>') +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start">' +
          '<select class="select st-map-select" data-field="' + field + '" dir="rtl" aria-label="ستون اکسل برای فیلد ' + UI.esc(EVA.FIELD_LABELS[field]) + '">' +
          '<option value="' + AUTO_VALUE + '">— خودکار —</option>' +
          headers.map(function (h) {
            var sel = saved === h ? ' selected' : '';
            return '<option value="' + UI.esc(h) + '"' + sel + '>' + UI.esc(h) + '</option>';
          }).join('') +
          '</select>' +
          '<p class="text-xs" style="margin:0;color:' + (effectiveValue === null && isRequired ? 'var(--destructive)' : 'var(--muted-foreground)') + '">' +
          (effectiveValue === null
            ? (isRequired ? 'ستونی برای این فیلد یافت نشد!' : 'یافت نشد (اختیاری)')
            : 'انتخاب مؤثر: ' + UI.esc(effectiveValue)) +
          '</p>' +
          '</div></div>';
      });
      html += '</div>';

      html +=
        '<div class="row mt-3">' +
        '<button type="button" class="btn btn-primary" id="st-save-mapping" aria-label="ذخیرهٔ نگاشت و بازسازی داده‌ها"' + (draft.busy ? ' disabled' : '') + '>' + UI.icon('refresh', 16) + 'ذخیرهٔ نگاشت و بازسازی داده‌ها</button>' +
        '<button type="button" class="btn btn-outline" id="st-reset-mapping" aria-label="بازگردانی نگاشت به حالت خودکار"' + (draft.busy ? ' disabled' : '') + '>' + UI.icon('rotate', 16) + 'بازگردانی پیش‌فرض</button>' +
        '</div>';
    }
    html += '</div></div>';

    /* ================ ۳) پشتیبان‌گیری و بازیابی ================ */
    html +=
      '<div class="card fade-in-up">' +
      '<div class="card-header tight"><h3 class="card-title">' + UI.icon('hard-drive-download', 20) + 'پشتیبان‌گیری و بازیابی</h3>' +
      '<p class="card-desc">فایل JSON شامل تنظیمات، متادیتای ورود داده‌ها و همهٔ رکوردهای رول‌ها (قابل بازیابی روی هر نصب از برنامه — حتی نسخهٔ وب).</p></div>' +
      '<div class="card-body">' +
      '<div class="alert alert-amber">' + UI.icon('alert-triangle', 16) +
      '<div class="alert-body"><p class="alert-title">هشدار مهم</p>' +
      '<p>برای جلوگیری از از دست رفتن اطلاعات، به‌صورت دوره‌ای از داده‌ها پشتیبان تهیه کنید.</p></div></div>' +
      '<div class="row">' +
      '<button type="button" class="btn btn-primary" id="st-export-btn">' + UI.icon('hard-drive-download', 16) + 'ساخت فایل پشتیبان</button>' +
      '<button type="button" class="btn btn-outline" id="st-restore-btn">' + UI.icon('archive-restore', 16) + 'بازیابی از فایل</button>' +
      '<input type="file" id="st-restore-input" accept=".json" hidden aria-hidden="true" />' +
      '</div>' +
      (draft.restoreErrors
        ? '<div class="alert alert-destructive" role="alert" style="margin-top:14px">' + UI.icon('alert-circle', 16) +
          '<div class="alert-body"><p class="alert-title">' + UI.esc(draft.restoreErrorTitle) + '</p><ul>' +
          draft.restoreErrors.map(function (err) { return '<li>' + UI.esc(err) + '</li>'; }).join('') +
          '</ul></div></div>'
        : '') +
      (draft.lastAction ? '<p class="text-xs txt-muted" style="margin:12px 0 0">' + UI.esc(draft.lastAction) + '</p>' : '') +
      '</div></div>';

    /* ================ ۴) راهنمای کوتاه ================ */
    html +=
      '<div class="card fade-in-up" style="border-color:rgba(10,117,104,0.3);background:rgba(10,117,104,0.04)">' +
      '<div class="card-header tight"><h3 class="card-title">' + UI.icon('book-open', 20) + 'راهنمای کوتاه تنظیمات</h3></div>' +
      '<div class="card-body">' +
      '<ul style="margin:0;padding-right:20px;list-style:disc;font-size:0.82rem;line-height:2;color:var(--muted-foreground)">' +
      '<li><strong style="color:var(--foreground)">پارامترها (فیلم‌ها، عرض، ضخامت، ظرفیت، شیفت):</strong> تغییر آن‌ها بلافاصله و بدون بازسازی، روی دسته‌بندی همهٔ رول‌ها و مانده زمان اثر می‌گذارد — نیازی به Import مجدد نیست.</li>' +
      '<li><strong style="color:var(--foreground)">نگاشت ستون‌ها:</strong> فقط هنگام Import یا ذخیرهٔ نگاشت استفاده می‌شود؛ پس از تغییر آن باید «بازسازی داده‌ها» انجام شود (دکمهٔ ذخیرهٔ نگاشت این کار را خودکار انجام می‌دهد).</li>' +
      '<li><strong style="color:var(--foreground)">نکتهٔ بازسازی در نسخهٔ آفلاین:</strong> رکوردهای بازیابی‌شده از پشتیبانِ نسخهٔ وب، دادهٔ خام کامل (rawJson) دارند و با نگاشت جدید کاملاً بازسازی می‌شوند؛ رکوردهای دادهٔ اولیهٔ این نسخه، مقادیر نرمال‌شدهٔ خود را حفظ می‌کنند.</li>' +
      '<li>اگر هنگام Import خطای «ستون الزامی یافت نشد» گرفتید، از همین بخش ستون مربوطه را دستی انتخاب و بازسازی کنید؛ هدرهای شناسایی‌شدهٔ فایل در پیام خطا فهرست شده‌اند.</li>' +
      '</ul>' +
      '<button type="button" class="btn btn-outline mt-3" id="st-goto-help">' + UI.icon('book-open', 16) + 'مشاهدهٔ راهنمای کامل سامانه</button>' +
      '</div></div>';

    el.innerHTML = html;
    UI.hydrateIcons(el);
    bindEvents(el, snapshot);
  }

  /* =========================================================================
     اجزای فرم
     ========================================================================= */

  /** ادیتور انواع فیلم (تگ‌های قابل حذف + افزودن) */
  function filmTypesEditorHtml(id, label, description, value) {
    var editorKey = id === 'raw-film-types' ? 'raw' : 'eva';
    var tags = value.length === 0
      ? '<span class="film-empty">هیچ نوع فیلمی تعریف نشده است</span>'
      : value.map(function (t) {
          return (
            '<span class="film-tag" role="listitem"><span class="ltr-code code font-bold">' + UI.esc(t) + '</span>' +
            '<button type="button" class="rm" data-rm-film="' + UI.esc(t) + '" data-editor="' + editorKey + '" aria-label="حذف نوع فیلم ' + UI.esc(t) + '">' + UI.icon('x', 12) + '</button>' +
            '</span>'
          );
        }).join('');
    return (
      '<div>' +
      '<label class="field-label" for="' + id + '">' + UI.esc(label) + '</label>' +
      '<p class="text-xs txt-muted" style="margin:2px 0 8px">' + UI.esc(description) + '</p>' +
      '<div class="film-tags" role="list" aria-label="' + UI.esc(label) + '">' + tags + '</div>' +
      '<div class="film-add-row" style="margin-top:8px">' +
      '<input type="text" id="' + id + '" class="input ltr-code" placeholder="مثلاً FSN02" aria-label="افزودن نوع فیلم به ' + UI.esc(label) + '" style="height:40px" />' +
      '<button type="button" class="btn btn-outline" data-add-film="' + id + '">' + UI.icon('plus', 15) + 'افزودن</button>' +
      '</div></div>'
    );
  }

  /** فیلد عددی با واحد (بند ۳ نسخهٔ ۱٫۲ — مثل NumFieldBox وب):
   *  عنوان بلافاصله بالای فیلد است؛ راهنمای اختیاری فقط هنگام وجود hint،
   *  زیر فیلد رندر می‌شود (ناحیهٔ عنوان با min-height ثابت برای هم‌ترازی عمودی). */
  function numFieldHtml(field, label, unit, hint, value) {
    var invalid = !Number.isFinite(Number(value)) || Number(value) <= 0;
    return (
      '<div class="field">' +
      '<div style="min-height:24px"><label class="field-label" for="st-num-' + field + '">' + UI.esc(label) + '</label></div>' +
      '<div class="input-wrap">' +
      '<input type="number" inputmode="decimal" min="0" step="any" id="st-num-' + field + '" class="input num st-num' + (invalid ? ' invalid' : '') + '" data-num-field="' + field + '" value="' + UI.esc(value) + '" aria-invalid="' + invalid + '" dir="ltr" />' +
      '<span class="input-unit">' + UI.esc(unit) + '</span>' +
      '</div>' +
      (hint ? '<p class="field-hint">' + UI.esc(hint) + '</p>' : '') +
      '</div>'
    );
  }

  /** بخش فرمول زنده + خطاهای اعتبارسنجی + دکمه‌های ذخیره */
  function dynamicPartsHtml(snapshot, rawTypes, evaTypes, numValue, paramsDirty) {
    /* اعتبارسنجی زندهٔ پارامترها (پیام‌های هماهنگ نسخهٔ وب) */
    var errs = [];
    if (rawTypes.length === 0) errs.push('حداقل یک نوع فیلم رول خام باید تعریف شود.');
    if (evaTypes.length === 0) errs.push('حداقل یک نوع فیلم رول EVA باید تعریف شود.');
    var min = Number(numValue('rawMinWidth'));
    var max = Number(numValue('rawMaxWidth'));
    var th = Number(numValue('rawThickness'));
    var cap = Number(numValue('evaCapacityPerShift'));
    var sh = Number(numValue('shiftsPerDay'));
    var h = Number(numValue('hoursPerDay'));
    if (!Number.isFinite(min) || min <= 0) errs.push('حداقل عرض رول خام باید عددی مثبت باشد.');
    if (!Number.isFinite(max) || max <= 0) errs.push('حداکثر عرض رول خام باید عددی مثبت باشد.');
    if (Number.isFinite(min) && Number.isFinite(max) && min > max) errs.push('حداقل عرض رول خام نمی‌تواند از حداکثر عرض بیشتر باشد.');
    if (!Number.isFinite(th) || th <= 0) errs.push('ضخامت رول خام باید عددی مثبت باشد.');
    if (!Number.isFinite(cap) || cap <= 0) errs.push('ظرفیت هر شیفت دستگاه EVA باید عددی مثبت باشد.');
    if (!Number.isFinite(sh) || sh <= 0 || !Number.isInteger(sh)) errs.push('تعداد شیفت در روز باید عدد صحیح مثبت باشد.');
    if (!Number.isFinite(h) || h <= 0 || h > 24 || !Number.isInteger(h)) errs.push('ساعت تولید در شبانه‌روز باید عدد صحیح بین ۱ تا ۲۴ باشد.');

    /* وزن رول‌های خام با تنظیمات ذخیره‌شده (برای فرمول زنده) */
    var rawWeight = 0;
    snapshot.rolls.forEach(function (r) {
      if (EVA.classifyRoll(r.rollNumber, r.filmType, r.width, r.thickness, snapshot.settings).category === 'raw') {
        rawWeight += r.netWeight == null ? 0 : r.netWeight;
      }
    });

    var perDay = Number.isFinite(cap) && Number.isFinite(sh) ? cap * sh : null;
    var liveDays = perDay && perDay > 0 ? rawWeight / perDay : null;
    var hVal = Number.isFinite(h) && h > 0 ? h : 24;

    var html =
      '<section class="formula-box" aria-label="فرمول محاسبهٔ مانده زمان">' +
      '<h3><span class="txt-primary">' + UI.icon('clock', 16) + '</span>فرمول مانده زمان (با مقادیر فعلی فرم)</h3>' +
      '<p>مانده زمان (روز) = وزن رول‌های خام ÷ (ظرفیت هر شیفت × تعداد شیفت در روز)</p>' +
      '<p class="txt-muted">= ' + Fmt.faWeightShort(EVA.roundTo(rawWeight, 3)) + ' کیلوگرم ÷ (' + Fmt.faNum(cap, 0) + ' × ' + Fmt.faNum(sh, 0) + ') = ' +
      (perDay !== null ? Fmt.faNum(perDay, 0) + ' کیلوگرم در روز' : '—') + '</p>' +
      (liveDays !== null
        ? '<p class="txt-primary font-bold">≈ ' + Fmt.faDuration(liveDays, hVal) +
          '<span style="font-weight:400;margin-right:8px" class="txt-muted">(معادل ' + Fmt.faHours(liveDays * hVal) + ' با ' + Fmt.faNum(hVal, 0) + ' ساعت تولید در شبانه‌روز)</span></p>'
        : '') +
      '</section>';

    if (errs.length > 0) {
      html +=
        '<div class="alert alert-destructive" role="alert" style="margin-top:14px">' + UI.icon('alert-triangle', 16) +
        '<div class="alert-body"><p class="alert-title">پیش از ذخیره، موارد زیر را اصلاح کنید</p><ul>' +
        errs.map(function (e) { return '<li>' + UI.esc(e) + '</li>'; }).join('') +
        '</ul></div></div>';
    }

    html +=
      '<div class="row mt-3">' +
      '<button type="button" class="btn btn-primary" id="st-save-params"' + (errs.length > 0 || !paramsDirty || draft.busy ? ' disabled' : '') + ' aria-label="ذخیرهٔ پارامترهای سامانه">' + UI.icon('save', 16) + 'ذخیرهٔ پارامترها</button>' +
      (paramsDirty
        ? '<button type="button" class="btn btn-ghost" id="st-discard-params" aria-label="صرف‌نظر از تغییرات پارامترها">' + UI.icon('rotate', 16) + 'صرف‌نظر از تغییرات</button>'
        : '') +
      '<p class="text-xs txt-muted" style="margin:0">ذخیرهٔ پارامترها نیازی به بازسازی یا Import مجدد ندارد و بلافاصله اعمال می‌شود.</p>' +
      '</div>';

    return html;
  }

  /* =========================================================================
     رویدادها
     ========================================================================= */

  function bindEvents(el, snapshot) {
    var params = snapshot.settings;

    /* ---------- فیلدهای عددی: به‌روزرسانی زندهٔ فرمول/خطاها بدون از دست رفتن فوکوس ---------- */
    el.querySelectorAll('.st-num').forEach(function (input) {
      input.addEventListener('input', function () {
        var f = input.getAttribute('data-num-field');
        draft.num = draft.num || {};
        NUM_FIELDS.forEach(function (nf) {
          if (draft.num[nf] === undefined) {
            var el2 = el.querySelector('[data-num-field="' + nf + '"]');
            draft.num[nf] = el2 ? el2.value : String(params[nf]);
          }
        });
        draft.num[f] = input.value;
        input.classList.toggle('invalid', !Number.isFinite(Number(input.value)) || Number(input.value) <= 0);
        refreshDynamic(el, snapshot);
      });
    });

    /* ---------- ادیتور انواع فیلم ---------- */
    el.querySelectorAll('[data-add-film]').forEach(function (btn) {
      var inputId = btn.getAttribute('data-add-film');
      var input = el.querySelector('#' + inputId);
      function add() {
        var v = input.value.trim().toUpperCase();
        if (!v) return;
        var isRaw = inputId === 'raw-film-types';
        var current = isRaw
          ? (draft.rawTypes !== null ? draft.rawTypes : params.rawFilmTypes)
          : (draft.evaTypes !== null ? draft.evaTypes : params.evaFilmTypes);
        if (current.indexOf(v) !== -1) {
          UI.toast.error('نوع فیلم ' + v + ' قبلاً در فهرست وجود دارد.');
          return;
        }
        var next = current.concat([v]);
        if (isRaw) draft.rawTypes = next;
        else draft.evaTypes = next;
        window.App.rerender();
      }
      btn.addEventListener('click', add);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          add();
        }
      });
    });

    el.querySelectorAll('[data-rm-film]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var t = btn.getAttribute('data-rm-film');
        var editorKey = btn.getAttribute('data-editor');
        if (editorKey === 'raw') {
          draft.rawTypes = (draft.rawTypes !== null ? draft.rawTypes : params.rawFilmTypes).filter(function (x) { return x !== t; });
        } else {
          draft.evaTypes = (draft.evaTypes !== null ? draft.evaTypes : params.evaFilmTypes).filter(function (x) { return x !== t; });
        }
        window.App.rerender();
      });
    });

    /* ---------- ذخیره/صرف‌نظر پارامترها ---------- */
    var saveBtn = el.querySelector('#st-save-params');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var merged = JSON.parse(JSON.stringify(params));
        if (draft.rawTypes !== null) merged.rawFilmTypes = draft.rawTypes;
        if (draft.evaTypes !== null) merged.evaFilmTypes = draft.evaFilmTypes;
        NUM_FIELDS.forEach(function (f) {
          if (draft.num && draft.num[f] !== undefined) merged[f] = Number(draft.num[f]);
        });
        var v = EVA.validateSettings(merged);
        if (!v.ok) {
          UI.toast.error(v.errors.join('؛ '));
          return;
        }
        Store.saveSettings(merged);
        resetParamDrafts();
        UI.toast.success('پارامترها ذخیره شد', {
          description: 'دسته‌بندی همهٔ رول‌ها به‌صورت زنده با تنظیمات جدید بازمحاسبه شد.',
        });
        window.App.refreshAll();
      });
    }
    var discardBtn = el.querySelector('#st-discard-params');
    if (discardBtn) {
      discardBtn.addEventListener('click', function () {
        resetParamDrafts();
        window.App.rerender();
      });
    }

    /* ---------- نگاشت ستون‌ها ---------- */
    el.querySelectorAll('.st-map-select').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var field = sel.getAttribute('data-field');
        var current = draft.mapping !== null ? draft.mapping : (params.columnMapping || {});
        var next = Object.assign({}, current);
        if (sel.value === AUTO_VALUE) delete next[field];
        else next[field] = sel.value;
        draft.mapping = next;
        window.App.rerender();
      });
    });

    var saveMappingBtn = el.querySelector('#st-save-mapping');
    if (saveMappingBtn) {
      saveMappingBtn.addEventListener('click', function () {
        saveMapping(el, snapshot, false);
      });
    }
    var resetMappingBtn = el.querySelector('#st-reset-mapping');
    if (resetMappingBtn) {
      resetMappingBtn.addEventListener('click', function () {
        UI.dialog({
          title: 'بازگردانی نگاشت به حالت خودکار؟',
          bodyHtml: '<p style="font-size:0.85rem;line-height:1.9;margin:0">همهٔ انتخاب‌های دستی شما پاک می‌شود و سامانه ستون‌ها را با نام‌های استاندارد به‌صورت خودکار تشخیص می‌دهد. سپس داده‌های موجود یک‌بار با نگاشت جدید بازسازی خواهند شد.</p>',
          footerHtml:
            '<button type="button" class="btn btn-outline" data-act="cancel">انصراف</button>' +
            '<button type="button" class="btn btn-primary" data-act="ok">بله، بازگردانی کن</button>',
          onMount: function (dlg) {
            dlg.el.querySelector('[data-act="cancel"]').addEventListener('click', dlg.close);
            dlg.el.querySelector('[data-act="ok"]').addEventListener('click', function () {
              dlg.close();
              draft.mapping = {};
              saveMapping(el, snapshot, true);
            });
          },
        });
      });
    }

    /* ---------- پشتیبان‌گیری ---------- */
    el.querySelector('#st-export-btn').addEventListener('click', function () {
      exportBackup(el);
    });

    el.querySelector('#st-restore-btn').addEventListener('click', function () {
      el.querySelector('#st-restore-input').click();
    });

    el.querySelector('#st-restore-input').addEventListener('change', function (e) {
      var file = e.target.files ? e.target.files[0] : null;
      e.target.value = ''; // امکان انتخاب مجدد همان فایل
      if (!file) return;
      file.text().then(function (text) {
        var payload;
        try {
          payload = JSON.parse(text);
        } catch (err) {
          draft.restoreErrorTitle = 'ساختار فایل معتبر نیست.';
          draft.restoreErrors = ['ساختار فایل معتبر نیست.'];
          UI.toast.error('ساختار فایل معتبر نیست.');
          window.App.rerender();
          return;
        }
        var check = Store.validateBackup(payload);
        if (!check.ok) {
          draft.restoreErrorTitle = 'فایل پشتیبان معتبر نیست:';
          draft.restoreErrors = check.errors;
          UI.toast.error('فایل پشتیبان معتبر نیست.');
          window.App.rerender();
          return;
        }
        draft.restoreErrors = null;
        confirmRestore(file.name, payload, check);
      });
    });

    /* ---------- ناوبری ---------- */
    var gotoImport = el.querySelector('.eva-goto-import');
    if (gotoImport) gotoImport.addEventListener('click', function () { window.App.navigate('import'); });
    el.querySelector('#st-goto-help').addEventListener('click', function () { window.App.navigate('help'); });
  }

  /** بازترسیم هدفمند بخش فرمول/خطا/دکمه‌ها */
  function refreshDynamic(el, snapshot) {
    var rawTypes = draft.rawTypes !== null ? draft.rawTypes : snapshot.settings.rawFilmTypes;
    var evaTypes = draft.evaTypes !== null ? draft.evaTypes : snapshot.settings.evaFilmTypes;
    var numValue = function (f) {
      if (draft.num && draft.num[f] !== undefined) return draft.num[f];
      var input = el.querySelector('[data-num-field="' + f + '"]');
      return input ? input.value : String(snapshot.settings[f]);
    };
    var paramsDirty = draft.num !== null || draft.rawTypes !== null || draft.evaTypes !== null;
    var box = el.querySelector('#st-dynamic');
    if (box) {
      box.innerHTML = dynamicPartsHtml(snapshot, rawTypes, evaTypes, numValue, paramsDirty);
      UI.hydrateIcons(box);
      // اتصال مجدد دکمه‌ها
      var saveBtn = box.querySelector('#st-save-params');
      if (saveBtn) saveBtn.addEventListener('click', function () {
        var params = snapshot.settings;
        var merged = JSON.parse(JSON.stringify(params));
        if (draft.rawTypes !== null) merged.rawFilmTypes = draft.rawTypes;
        if (draft.evaTypes !== null) merged.evaFilmTypes = draft.evaFilmTypes;
        NUM_FIELDS.forEach(function (f) {
          if (draft.num && draft.num[f] !== undefined) merged[f] = Number(draft.num[f]);
        });
        var v = EVA.validateSettings(merged);
        if (!v.ok) {
          UI.toast.error(v.errors.join('؛ '));
          return;
        }
        Store.saveSettings(merged);
        resetParamDrafts();
        UI.toast.success('پارامترها ذخیره شد', {
          description: 'دسته‌بندی همهٔ رول‌ها به‌صورت زنده با تنظیمات جدید بازمحاسبه شد.',
        });
        window.App.refreshAll();
      });
      var discard = box.querySelector('#st-discard-params');
      if (discard) discard.addEventListener('click', function () {
        resetParamDrafts();
        window.App.rerender();
      });
    }
  }

  /* =========================================================================
     ذخیرهٔ نگاشت + بازسازی داده‌ها (پورت rebuild در api/settings)
     ========================================================================= */

  function saveMapping(el, snapshot, isReset) {
    var params = snapshot.settings;
    var headers = snapshot.headers;
    var mapping = isReset ? {} : (draft.mapping !== null ? draft.mapping : (params.columnMapping || {}));

    /* مقدار مؤثر هر فیلد: انتخاب دستی یا خودکار */
    var effective = EVA.buildFieldMapping(headers, mapping);
    var columnMapping = {};
    EVA.MAPPABLE_FIELD_ORDER.forEach(function (f) {
      var saved = mapping[f];
      if (typeof saved === 'string' && saved.trim() !== '') {
        columnMapping[f] = saved;
      } else {
        var auto = effective.map[f];
        if (typeof auto === 'string' && auto.trim() !== '') columnMapping[f] = auto;
      }
    });

    draft.busy = true;
    window.App.rerender();

    Store.rebuildRolls(columnMapping, headers)
      .then(function (res) {
        var merged = JSON.parse(JSON.stringify(params));
        merged.columnMapping = columnMapping;
        Store.saveSettings(merged);
        draft.mapping = null;
        draft.busy = false;
        UI.toast.success(isReset ? 'نگاشت به حالت خودکار بازگردانده شد' : 'نگاشت ستون‌ها ذخیره شد', {
          description: res.rebuilt && typeof res.affectedRows === 'number'
            ? Fmt.faInt(res.affectedRows) + ' رکورد از دادهٔ خام بازسازی شد.'
            : 'داده‌های موجود با نگاشت جدید بازسازی شدند.',
        });
        window.App.refreshAll();
      })
      .catch(function (e) {
        draft.busy = false;
        UI.toast.error((e && e.message) || 'خطا در ذخیرهٔ نگاشت');
        window.App.rerender();
      });
  }

  /* =========================================================================
     پشتیبان‌گیری و بازیابی
     ========================================================================= */

  function exportBackup(el) {
    var btn = el.querySelector('#st-export-btn');
    btn.disabled = true;
    Store.buildBackup().then(function (payload) {
      var text = JSON.stringify(payload);
      var fileName = 'EVA-Monitor-Backup-' + Fmt.jalaliFileStamp() + '.json';
      var url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      var link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      draft.lastAction = 'آخرین عمل: ساخت پشتیبان — ' + Fmt.faDateTime(payload.exportedAt);
      UI.toast.success('فایل پشتیبان ساخته شد', {
        description: Fmt.faInt(payload.counts.rolls) + ' رول، ' + Fmt.faInt(payload.counts.importBatches) + ' ورود داده‌ها، ' + Fmt.faInt(payload.counts.settings) + ' تنظیمات — ' + fileName,
      });
    }).catch(function (e) {
      UI.toast.error((e && e.message) || 'خطا در ساخت فایل پشتیبان');
    }).finally(function () {
      btn.disabled = false;
    });
  }

  /** دیالوگ تأیید بازیابی (الگوی §70 متالایز) */
  function confirmRestore(fileName, payload, check) {
    var counts = {
      settings: payload.counts && typeof payload.counts.settings === 'number' ? payload.counts.settings : check.data.settings.length,
      importBatches: payload.counts && typeof payload.counts.importBatches === 'number' ? payload.counts.importBatches : check.data.batches.length,
      rolls: payload.counts && typeof payload.counts.rolls === 'number' ? payload.counts.rolls : check.data.rolls.length,
    };
    var exportedAt = typeof payload.exportedAt === 'string' ? payload.exportedAt : null;

    UI.dialog({
      title: 'بازیابی از فایل پشتیبان',
      bodyHtml:
        '<div style="font-size:0.85rem;line-height:1.9">' +
        '<p style="margin:0 0 8px">محتوای فایل <strong>' + UI.esc(fileName) + '</strong> خوانده شد و پس از تأیید، این موارد بازیابی خواهند شد:</p>' +
        '<ul style="margin:0;padding-right:20px;list-style:disc">' +
        '<li>رول‌ها: ' + Fmt.faInt(counts.rolls) + ' رکورد</li>' +
        '<li>ورود داده‌ها: ' + Fmt.faInt(counts.importBatches) + ' رکورد</li>' +
        '<li>تنظیمات: ' + Fmt.faInt(counts.settings) + ' رکورد</li>' +
        '</ul>' +
        (exportedAt ? '<p style="margin:8px 0 0">تاریخ ساخت فایل پشتیبان: ' + Fmt.faDateTime(exportedAt) + '</p>' : '') +
        '</div>' +
        '<p class="dialog-warn-box" style="margin-top:12px">این عمل جایگزینی کامل داده‌های فعلی است و بازگشت‌پذیر نیست.</p>',
      footerHtml:
        '<button type="button" class="btn btn-outline" data-act="cancel">انصراف</button>' +
        '<button type="button" class="btn btn-destructive" data-act="ok">' + UI.icon('archive-restore', 15) + 'بازیابی</button>',
      onMount: function (dlg) {
        var okBtn = dlg.el.querySelector('[data-act="ok"]');
        dlg.el.querySelector('[data-act="cancel"]').addEventListener('click', dlg.close);
        okBtn.addEventListener('click', function () {
          okBtn.disabled = true;
          okBtn.innerHTML = '<span class="spin" style="display:inline-flex">' + UI.icon('loader', 15) + '</span>بازیابی';
          Store.restoreBackup(check).then(function (res) {
            dlg.close();
            draft.lastAction = 'آخرین عمل: بازیابی از فایل — ' + Fmt.faDateTime(new Date().toISOString());
            UI.toast.success('بازیابی با موفقیت انجام شد.', {
              description: Fmt.faInt(res.counts.rolls) + ' رول، ' + Fmt.faInt(res.counts.importBatches) + ' ورود داده‌ها و ' + Fmt.faInt(res.counts.settings) + ' تنظیمات از فایل پشتیبان بازیابی شد.',
            });
            window.App.refreshAll();
          }).catch(function (e) {
            dlg.close();
            UI.toast.error((e && e.message) || 'خطا در بازیابی از فایل پشتیبان');
          });
        });
      },
    });
  }

  window.EvaViews = window.EvaViews || {};
  window.EvaViews.settings = { render: render };
})();
