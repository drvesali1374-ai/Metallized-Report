/* =========================================================================
   normalize.js — لایهٔ نرمال‌سازی مرکزی داده‌های Excel (§8-§9)
   -------------------------------------------------------------------------
   مسیر داده:
     Excel Columns  →  Normalization  →  Internal Roll Model  →  Business Logic

   مدل داخلی رول (Independent از نام‌های خام اکسل):
     {
       rollNumber   شماره رول        (همیشه String — §97)
       width        عرض
       actualLength متراژ واقعی
       thickness    ضخامت (میکرون)
       filmType     نوع فیلم
       palletNumber شماره پالت (نرمال‌شده: '' اگر خالی)
       setupNumber  شماره ستاپ (عدد یا null)
       source       'rolls' | 'archived'
       parentRollNumber  رزرو برای Traceability آینده (§64-§67، §98)
       raw          سطر اصلی اکسل (برای Audit و پیش‌نمایش)
     }
   ========================================================================= */

'use strict';

(function () {
  const { COLUMN_MAP } = RM.config;
  const U = RM.utils;
  const N = {};

  /** یافتن نام واقعی ستون در هدرهای فایل بر اساس نقشهٔ پیکربندی */
  function resolveColumn(headers, spec) {
    const normalizedHeaders = new Map(
      headers.map((h) => [U.normalizeHeader(h), h])   // نگاشت «نرمال → نام اصلی»
    );

    // ابتدا نام اصلی، سپس جایگزین‌ها
    for (const candidate of [spec.primary, ...spec.fallbacks]) {
      const found = normalizedHeaders.get(U.normalizeHeader(candidate));
      if (found !== undefined) return found;
    }
    return null;
  }

  /**
   * ساخت نگاشت «فیلد داخلی → نام ستون واقعی فایل».
   * خروجی برای اعتبارسنجی وجود ستون‌ها (§10: Header Validation) هم استفاده می‌شود.
   *
   * overrides (اختیاری): نگاشت کاربر از تنظیمات — { فیلد: نام ستون اکسل }.
   * اولویت با انتخاب کاربر است؛ در نبود آن از نقشهٔ پیش‌فرض (primary + fallbacks)
   * استفاده می‌شود. منطق برنامه هرگز به نام فیزیکی ستون‌های Excel وابسته نیست.
   *
   * خروجی:
   *   map[field]          نام واقعی ستون یا null
   *   map.__missing       ستون‌های الزامی یافت‌نشده
   *   map.__invalid       انتخاب‌های کاربر که در فایل وجود ندارند
   *   map.__usedOverrides فیلدهایی که از انتخاب کاربر آمده‌اند
   */
  function buildFieldMapping(sourceKey, headers, overrides) {
    const map = { __missing: [], __invalid: [], __usedOverrides: [] };
    const spec = COLUMN_MAP[sourceKey];
    const normalizedHeaders = new Map(
      headers.map((h) => [U.normalizeHeader(h), h])
    );

    for (const [field, columnSpec] of Object.entries(spec)) {
      const override = overrides ? overrides[field] : null;

      // ۱) انتخاب صریح کاربر
      if (typeof override === 'string' && override.trim() !== '') {
        const real = normalizedHeaders.get(U.normalizeHeader(override));
        if (real !== undefined) {
          map[field] = real;
          map.__usedOverrides.push(field);
          continue;
        }
        // ستونِ تنظیم‌شدهٔ کاربر در فایل وجود ندارد
        map[field] = null;
        map.__invalid.push({ field, value: override });
        if (!columnSpec.optional) map.__missing.push(override);
        continue;
      }

      // ۲) رزولوشن خودکار (پیش‌فرض)
      const real = resolveColumn(headers, columnSpec);
      if (real === null) {
        map[field] = null;
        if (!columnSpec.optional) map.__missing.push(columnSpec.primary);
      } else {
        map[field] = real;
      }
    }
    return map;
  }

  /**
   * نرمال‌سازی یک سطر اکسل به مدل داخلی (§6، §94-§97).
   * خروجی: { record, issues: {width?, length?, thickness?, setupNumber?, rollNumber?, filmType?} }
   */
  function normalizeRow(row, sourceKey, mapping) {
    const get = (field) => {
      const col = mapping[field];
      return col === null ? '' : row[col];
    };

    const rollNumberRaw = get('rollNumber');
    const productionDateRaw = get('productionDate');

    const record = {
      rollNumber: String(rollNumberRaw ?? '').trim(),   // شماره رول همیشه String (§97)
      width: U.parseNumber(get('width')),
      actualLength: U.parseNumber(get('actualLength')),
      thickness: U.parseNumber(get('thickness')),
      filmType: String(get('filmType') ?? '').trim(),
      palletNumber: String(get('palletNumber') ?? '').trim(),
      setupNumber: U.parseInt(get('setupNumber')),
      // فیلدهای جزئیات/نمایش (اختیاری — از Mapping کاربر)
      productionDate:
        productionDateRaw === '' || productionDateRaw === null || productionDateRaw === undefined
          ? null : productionDateRaw,
      netWeight: U.parseNumber(get('netWeight')),
      grade: String(get('grade') ?? '').trim(),
      status: String(get('status') ?? '').trim(),
      source: sourceKey,
      parentRollNumber: null,                             // رزرو Traceability (§98)
      raw: row,                                           // سطر اصلی برای Audit
    };

    // گردآوری مشکلات داده‌ای برای گزارشنمای Import (§11)
    const issues = {};
    if (record.width === null) issues.width = true;
    if (record.actualLength === null) issues.length = true;
    if (record.thickness === null) issues.thickness = true;
    if (record.setupNumber === null) issues.setupNumber = true;
    if (record.rollNumber === '') issues.rollNumber = true;
    if (record.filmType === '') issues.filmType = true;

    return { record, issues };
  }

  /**
   * نرمال‌سازی کامل آرایهٔ سطرهای یک فایل.
   * خروجی: { records, issues: {width, length, thickness, setupNumber, rollNumber, filmType} }
   */
  function normalizeRows(rows, sourceKey, mapping) {
    const records = [];
    const issues = { width: 0, length: 0, thickness: 0, setupNumber: 0, rollNumber: 0, filmType: 0 };

    for (const row of rows) {
      const { record, issues: rowIssues } = normalizeRow(row, sourceKey, mapping);
      for (const key of Object.keys(issues)) {
        if (rowIssues[key]) issues[key]++;
      }
      records.push(record);
    }

    return { records, issues };
  }

  /* ---------------- لایهٔ Mapping قابل تنظیم کاربر ---------------- */

  /** خواندن نگاشت ستون‌های ذخیره‌شدهٔ کاربر (appSettings: columnMapping) */
  N.getUserMapping = async function () {
    try {
      return (await RM.db.getSetting('columnMapping', {})) || {};
    } catch {
      return {};   // پیش از آماده‌شدن دیتابیس — حالت بدون Override
    }
  };

  /**
   * هدرهای واقعی Dataset فعلی — از متادیتای آخرین Import؛
   * در نبود آن، از raw اولین رکورد همان جدول.
   */
  N.getDatasetHeaders = async function (sourceKey) {
    const target = RM.config.IMPORT_TARGETS[sourceKey];
    try {
      const meta = await RM.db.getLatestImportMeta(sourceKey);
      if (meta && Array.isArray(meta.headers) && meta.headers.length) return meta.headers;
    } catch { /* دیتابیس در دسترس نیست */ }
    try {
      const first = await RM.db.db[target.table].limit(1).toArray();
      if (first.length && first[0].raw) return Object.keys(first[0].raw);
    } catch { /* جدول خالی */ }
    return [];
  };

  /**
   * عنوان‌های مؤثر ستون‌های جزئیات برای یک Dataset:
   * اگر Mapping (کاربر یا خودکار) به ستونی رسیده باشد → نام همان ستون اکسل؛
   * در غیر این صورت برچسب منطقی فارسی. این عنوان‌ها در جدول‌های جزئیات
   * (گروه رول، Drill-down کیفیت داده و Import) استفاده می‌شوند.
   */
  N.effectiveColumnLabels = async function (sourceKey) {
    const overrides = await N.getUserMapping();
    const headers = await N.getDatasetHeaders(sourceKey);
    const mapping = N.buildFieldMapping(sourceKey, headers, overrides[sourceKey] || {});
    const labels = {};
    for (const field of Object.keys(COLUMN_MAP[sourceKey])) {
      labels[field] = mapping[field] || RM.config.FIELD_LABELS[field] || field;
    }
    return labels;
  };

  /* ---------------- فیلتر مشترک رکوردهای دارای نقص (Drill-down) ---------------- */

  /**
   * رکوردهای دارای یک نقص داده‌ای — رزولور مشترک Drill-down کیفیت
   * (Import گزارسنما + مرکز هشدار داشبورد از همین استفاده می‌کنند).
   * نکته: کلید «length» در گزارشنماها به فیلد «actualLength» مدل داخلی
   * نگاشت می‌شود (نام منطقی ≠ نام فیزیکی مدل).
   * issue ∈ width | length | thickness | rollNumber | filmType
   */
  N.recordsWithIssue = function (records, issueKey) {
    const field = issueKey === 'length' ? 'actualLength' : issueKey;
    return (records || []).filter((r) =>
      issueKey === 'rollNumber' ? r.rollNumber === '' :
      issueKey === 'filmType'   ? r.filmType === '' :
      r[field] === null
    );
  };

  /* ---------------- قوانین تشخیص کسب‌وکار (§6-§7) ---------------- */

  /**
   * آیا نوع فیلم شامل حرف R/r است؟ (Case-Insensitive — §6)
   * بررسی Contains نه CharAt؛ دقیقاً طبق سند: filmType.includes('R')
   */
  function hasR(filmType) {
    return String(filmType ?? '').toLowerCase().includes('r');
  }

  /**
   * آیا شماره پالت «خالی» است؟ (§6)
   * null/undefined/""/"   " → خالی
   * 0 ، "0" ، "P0" ، "0:1" → غیرخالی
   */
  function isEmptyPallet(palletNumber) {
    if (palletNumber === null || palletNumber === undefined) return true;
    return String(palletNumber).trim() === '';
  }

  /**
   * آیا این رکورد یک «رول خام فعلی» است؟ (rolls.xlsx — §6، §32)
   * شرط: نوع فیلم دارای R/r  و  پالت خالی
   */
  function isRawRoll(record) {
    return hasR(record.filmType) && isEmptyPallet(record.palletNumber);
  }

  /* ---------------- ثبت در فضای نام ---------------- */

  N.resolveColumn = resolveColumn;
  N.buildFieldMapping = buildFieldMapping;
  N.normalizeRow = normalizeRow;
  N.normalizeRows = normalizeRows;
  N.hasR = hasR;
  N.isEmptyPallet = isEmptyPallet;
  N.isRawRoll = isRawRoll;

  RM.normalize = N;
})();
