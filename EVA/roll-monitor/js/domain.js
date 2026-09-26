/* =========================================================================
   domain.js — منطق دامنهٔ سامانه (پورت ۱:۱ از نسخهٔ وب)
   -------------------------------------------------------------------------
   منابع پورت‌شده:
     src/types/eva.ts            → برچسب‌ها و ثابت‌ها
     src/lib/eva/classify.ts     → parseRollIdentity / parseRollNumber / classifyRoll / gradeLetter / cutGroupKey
     src/lib/eva/column-map.ts   → COLUMN_SPECS / buildFieldMapping / parseNumber ...
     src/lib/eva/normalize.ts    → normalizeRow / normalizeRows
     src/lib/eva/settings.ts     → defaultSettings / validateSettings / normalizeFilmList
     src/lib/eva/api-helpers.ts  → remainingDaysOf / roundTo / toRollDto
     api/dashboard, api/rolls, api/rolls/cut-groups → محاسبات داشبورد و جداول
   ========================================================================= */
(function () {
  'use strict';

  /* ---------------- ثابت‌های هویت برنامه ---------------- */
  var APP_NAME = 'سامانه مانیتورینگ رول‌های EVA';
  var APP_VERSION = '1.4';
  var BACKUP_SCHEMA_VERSION = 1;
  var SETTINGS_KEY = 'evaSettings';

  /* ---------------- برچسب‌های فارسی (عین types/eva.ts) ---------------- */
  var CATEGORY_LABELS = {
    raw: 'رول خام',
    eva: 'رول EVA',
    cut: 'رول برش‌خورده',
    error_e_film: 'خطا: E بدون فیلم EVA',
    error_no_e: 'خطا: فیلم EVA بدون حرف E',
    raw_out_of_range: 'خارج از محدودهٔ خام',
    other: 'سایر',
  };

  var FIELD_LABELS = {
    rollNumber: 'شماره رول',
    filmType: 'نوع فیلم',
    setupNumber: 'شماره ستاپ',
    width: 'عرض',
    initialWidth: 'عرض رول اولیه',
    thickness: 'ضخامت',
    length: 'متراژ',
    netWeight: 'وزن خالص',
    grade: 'گرید',
    palletNumber: 'شماره پالت',
    productionDate: 'تاریخ تولید',
    position: 'موقعیت فعلی',
    externalId: 'شناسه رول',
  };

  /** فیلدهای الزامی نگاشت */
  var REQUIRED_FIELDS = ['rollNumber', 'filmType', 'setupNumber', 'width', 'thickness', 'netWeight', 'grade'];

  /** ترتیب نمایش فیلدهای نگاشت (MAPPABLE_FIELD_ORDER) */
  var MAPPABLE_FIELD_ORDER = [
    'rollNumber', 'filmType', 'setupNumber', 'width', 'initialWidth', 'thickness',
    'length', 'netWeight', 'grade', 'palletNumber', 'productionDate', 'position', 'externalId',
  ];

  /** ترتیب نمایش دسته‌ها در خلاصهٔ Import */
  var CATEGORY_ORDER = ['raw', 'eva', 'cut', 'error_e_film', 'error_no_e', 'raw_out_of_range', 'other'];

  /** کلیدهای گرید + برچسب فارسی (به‌ترتیب نمایش) */
  var GRADE_ORDER = ['X', 'U', 'Q', 'T', 'none'];
  var GRADE_LABELS = { X: 'گرید X', U: 'گرید U', Q: 'گرید Q', T: 'گرید T', none: 'بدون گرید' };

  /* =========================================================================
     موتور دسته‌بندی (پورت lib/eva/classify.ts)
     ========================================================================= */

  /** الگوی بازوی برش: حرف L یا R + یک یا دو رقم */
  var ARM_RE = /[LR]\d{1,2}/;

  /** اولین بازوی برش در رشته (index + متن) */
  function firstArm(s) {
    var m = ARM_RE.exec(s);
    if (!m) return null;
    return { arm: m[0], index: m.index, end: m.index + m[0].length };
  }

  /** تجزیهٔ هویت شمارهٔ رول: خط تولید/سالن/رقم سال */
  function parseRollIdentity(rollNumber) {
    var s = String(rollNumber == null ? '' : rollNumber).trim().toUpperCase();
    var m = /^([FK])(\d)(\d)/.exec(s);
    if (!m) return { line: null, hall: null, yearDigit: null, year: null };
    var hall = parseInt(m[2], 10);
    var yearDigit = parseInt(m[3], 10);
    return {
      line: m[1] === 'F' ? 'BOPP' : 'CPP',
      hall: Number.isFinite(hall) ? hall : null,
      yearDigit: Number.isFinite(yearDigit) ? yearDigit : null,
      year: Number.isFinite(yearDigit) ? 1400 + yearDigit : null,
    };
  }

  /**
   * تجزیهٔ ساختاری شمارهٔ رول — بازوی برش خام و ادامهٔ آن.
   *   rawArm    بازوی برش خام (مثل L8) یا null
   *   suffix    ادامهٔ شمارهٔ رول بعد از بازوی خام (مثل E16 یا E1311R11) یا null
   *   hasE      آیا بعد از بازوی خام حرف E وجود دارد؟
   *   hasEAnywhere آیا در کل شمارهٔ رول حرف E هست؟
   *   evaCutArm بازوی برش EVA (مثل R11) — فقط وقتی بعد از E بیاید
   */
  function parseRollNumber(rollNumber) {
    var s = String(rollNumber == null ? '' : rollNumber).trim().toUpperCase();
    var hasEAnywhere = s.includes('E');
    var arm = firstArm(s);
    if (!arm) {
      return { rawArm: null, suffix: null, hasE: false, hasEAnywhere: hasEAnywhere, evaCutArm: null, restAfterE: null };
    }
    var suffix = s.slice(arm.end);
    var eIndex = suffix.indexOf('E');
    var hasE = eIndex !== -1;
    var evaCutArm = null;
    var restAfterE = null;
    if (hasE) {
      restAfterE = suffix.slice(eIndex + 1);
      var cut = ARM_RE.exec(restAfterE);
      if (cut) evaCutArm = cut[0];
    }
    return {
      rawArm: arm.arm,
      suffix: suffix || null,
      hasE: hasE,
      hasEAnywhere: hasEAnywhere,
      evaCutArm: evaCutArm,
      restAfterE: restAfterE,
    };
  }

  /** نرمال‌سازی نوع فیلم برای مقایسه (حذف فاصله + بزرگ‌نویسی) */
  function normFilm(filmType) {
    return String(filmType == null ? '' : filmType).trim().toUpperCase();
  }

  /**
   * دسته‌بندی یک رول با تنظیمات فعلی — اولویت خطا بر تشخیص عادی است.
   */
  function classifyRoll(rollNumber, filmType, width, thickness, params) {
    var film = normFilm(filmType);
    var parsed = parseRollNumber(rollNumber);
    var rawFilms = params.rawFilmTypes.map(normFilm);
    var evaFilms = params.evaFilmTypes.map(normFilm);
    var category = 'other';

    if (parsed.hasEAnywhere && !evaFilms.includes(film)) {
      // خطای نوع ۱: حرف E در شمارهٔ رول اما نوع فیلم EVA نیست
      category = 'error_e_film';
    } else if (evaFilms.includes(film)) {
      if (!parsed.hasE) {
        // خطای نوع ۲: فیلم EVA است اما بعد از بازوی برش خام حرف E وجود ندارد
        category = 'error_no_e';
      } else if (parsed.evaCutArm) {
        // بازوی برش EVA بعد از حرف E → رول برش‌خورده
        category = 'cut';
      } else {
        // فقط E + ارقام → رول EVA برش‌نخورده
        category = 'eva';
      }
    } else if (rawFilms.includes(film)) {
      var widthOk = width !== null && width >= params.rawMinWidth && width <= params.rawMaxWidth;
      var thicknessOk = thickness !== null && Math.abs(thickness - params.rawThickness) < 1e-9;
      if (widthOk && thicknessOk) {
        category = 'raw';
      } else {
        // فیلم خام اما خارج از محدودهٔ عرض/ضخامت تنظیمات
        category = 'raw_out_of_range';
      }
    }

    return {
      category: category,
      hasEAfterArm: parsed.hasE,
      rawArm: parsed.rawArm,
      evaCutArm: parsed.evaCutArm,
      suffix: parsed.suffix,
    };
  }

  /** حرف گرید: فقط پیشوند لاتین X/U/Q/T از ستون گرید — وگرنه null */
  function gradeLetter(grade) {
    var g = String(grade == null ? '' : grade).trim();
    if (!g) return null;
    var first = g.charAt(0).toUpperCase();
    return first === 'X' || first === 'U' || first === 'Q' || first === 'T' ? first : null;
  }

  /** کلید گروه رول‌های برش‌خورده: ستاپ + سالن + رقم سال + عرض */
  function cutGroupKey(setupNumber, hall, yearDigit, width) {
    return (setupNumber == null ? '؟' : setupNumber) + '|' +
      (hall == null ? '؟' : hall) + '|' +
      (yearDigit == null ? '؟' : yearDigit) + '|' +
      (width == null ? '؟' : width);
  }

  /* =========================================================================
     نگاشت ستون‌های اکسل (پورت lib/eva/column-map.ts)
     ========================================================================= */

  /** نقشهٔ پیش‌فرض فایل «رول های موجود» */
  var COLUMN_SPECS = {
    rollNumber: { primary: 'شماره رول', fallbacks: ['شمارهرول', 'Roll Number'], required: true },
    filmType: { primary: 'نوع فیلم', fallbacks: ['نوعفیلم'], required: true },
    setupNumber: { primary: 'شماره ستاپ', fallbacks: ['شمارهستاپ'], required: true },
    width: { primary: 'عرض', fallbacks: ['عرض رول', 'عرضرول'], required: true },
    initialWidth: { primary: 'عرض رول اولیه', fallbacks: ['عرضرولاولیه', 'عرض اولیه'] },
    thickness: { primary: 'ضخامت', fallbacks: ['ضخامتفیلم', 'ضخامت فیلم'], required: true },
    length: { primary: 'متراژ', fallbacks: ['متراز', 'Length'] },
    netWeight: { primary: 'وزن خالص', fallbacks: ['وزنخالص'], required: true },
    grade: { primary: 'گرید', fallbacks: ['Grade'] },
    palletNumber: { primary: 'شماره پالت', fallbacks: ['شمارهپالت'] },
    productionDate: { primary: 'تاریخ تولید', fallbacks: ['تاریختولید'] },
    position: { primary: 'موقعیت فعلی', fallbacks: ['موقعیتفعلی', 'وضعیت', 'وضعیت فعلی'] },
    externalId: { primary: 'شناسه رول', fallbacks: ['شناسهرول'] },
  };

  /** نگاشت پیش‌فرض فیلد → نام ستون (همان primary ها) */
  var DEFAULT_COLUMN_MAP = {};
  Object.keys(COLUMN_SPECS).forEach(function (f) { DEFAULT_COLUMN_MAP[f] = COLUMN_SPECS[f].primary; });

  /** نرمال‌سازی هدر برای مقایسه: حذف فاصله/ZWNJ + یکسان‌سازی ارقام */
  function normalizeHeader(h) {
    return String(h == null ? '' : h)
      .trim()
      .replace(/[\s\u200c\u200f\u200e_-]+/g, '')
      .replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); })
      .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); })
      .toLowerCase();
  }

  /**
   * ساخت نگاشت «فیلد → نام ستون واقعی فایل».
   * اولویت: انتخاب کاربر → primary → fallbacks.
   */
  function buildFieldMapping(headers, overrides) {
    var normalizedHeaders = new Map();
    headers.forEach(function (h) { normalizedHeaders.set(normalizeHeader(h), h); });

    var map = {};
    var missing = [];
    var usedOverrides = [];
    var invalidOverrides = [];

    Object.keys(COLUMN_SPECS).forEach(function (field) {
      var spec = COLUMN_SPECS[field];
      var override = overrides ? overrides[field] : undefined;
      if (typeof override === 'string' && override.trim() !== '') {
        var real = normalizedHeaders.get(normalizeHeader(override));
        if (real !== undefined) {
          map[field] = real;
          usedOverrides.push(field);
          return;
        }
        map[field] = null;
        invalidOverrides.push(field);
        if (spec.required) missing.push(field);
        return;
      }
      var found;
      var candidates = [spec.primary].concat(spec.fallbacks);
      for (var i = 0; i < candidates.length; i++) {
        found = normalizedHeaders.get(normalizeHeader(candidates[i]));
        if (found !== undefined) break;
      }
      if (found === undefined) {
        map[field] = null;
        if (spec.required) missing.push(field);
      } else {
        map[field] = found;
      }
    });

    return { map: map, missing: missing, usedOverrides: usedOverrides, invalidOverrides: invalidOverrides };
  }

  /** پارس عدد از مقدار سلول اکسل (عدد یا رشته با ارقام فارسی) — خروجی null در صورت نامعتبر */
  function parseNumber(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    var s = Fmt.toLatinDigits(String(v)).replace(/[,٬\s]/g, '');
    if (s === '') return null;
    var n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  }

  /** پارس عدد صحیح — خروجی null در صورت نامعتبر */
  function parseIntSafe(v) {
    var n = parseNumber(v);
    if (n === null) return null;
    return Math.trunc(n);
  }

  /** متن امن — trim شده؛ خالی → null */
  function parseText(v) {
    if (v === null || v === undefined) return null;
    var s = String(v).trim();
    return s === '' ? null : s;
  }

  /* =========================================================================
     نرمال‌سازی سطرهای اکسل (پورت lib/eva/normalize.ts)
     ========================================================================= */

  /** نرمال‌سازی یک سطر اکسل با نگاشت داده‌شده */
  function normalizeRow(row, map, rowIndex) {
    function get(field) {
      var col = map[field];
      return col === null || col === undefined ? null : row[col];
    }
    var productionDateRaw = get('productionDate');
    return {
      rollNumber: parseText(get('rollNumber')) || '',
      filmType: parseText(get('filmType')) || '',
      width: parseNumber(get('width')),
      initialWidth: parseNumber(get('initialWidth')),
      length: parseNumber(get('length')),
      thickness: parseNumber(get('thickness')),
      netWeight: parseNumber(get('netWeight')),
      grade: parseText(get('grade')),
      palletNumber: parseText(get('palletNumber')),
      setupNumber: parseIntSafe(get('setupNumber')),
      productionDate:
        productionDateRaw === null || productionDateRaw === undefined || productionDateRaw === ''
          ? null
          : String(productionDateRaw).trim(),
      position: parseText(get('position')),
      externalId: parseText(get('externalId')),
      rawJson: JSON.stringify(row),
      rowIndex: rowIndex,
    };
  }

  /* =========================================================================
     تنظیمات (پورت lib/eva/settings.ts)
     ========================================================================= */

  /** مقادیر پیش‌فرض تنظیمات (طبق سند کاربر) */
  function defaultSettings() {
    return {
      rawFilmTypes: ['FSN02', 'FTN02'],
      rawMinWidth: 1960,
      rawMaxWidth: 1980,
      rawThickness: 12,
      evaFilmTypes: ['FST32', 'FTT32'],
      evaCapacityPerShift: 5000,
      shiftsPerDay: 3,
      hoursPerDay: 24,
      columnMapping: Object.assign({}, DEFAULT_COLUMN_MAP),
    };
  }

  /** نرمال‌سازی لیست انواع فیلم (آپرکِیس + حذف خالی/تکراری) */
  function normalizeFilmList(list) {
    if (!Array.isArray(list)) return [];
    var set = new Set(
      list
        .map(function (s) { return String(s == null ? '' : s).trim().toUpperCase(); })
        .filter(function (s) { return s.length > 0; })
    );
    return Array.from(set);
  }

  /** خواندن تنظیمات از رشتهٔ JSON ذخیره‌شده — همیشه مقادیر کامل (merge با پیش‌فرض‌ها) */
  function parseSettingsValue(value) {
    var base = defaultSettings();
    if (!value) return base;
    try {
      var saved = JSON.parse(value);
      if (!saved || typeof saved !== 'object') return base;
      function num(v, fallback) {
        var n = typeof v === 'string' ? parseFloat(v) : v;
        return Number.isFinite(n) ? n : fallback;
      }
      function posNum(v, fallback) {
        var n = num(v, fallback);
        return n > 0 ? n : fallback;
      }
      return {
        rawFilmTypes: Array.isArray(saved.rawFilmTypes) && saved.rawFilmTypes.length
          ? saved.rawFilmTypes.map(function (s) { return String(s == null ? '' : s).trim().toUpperCase(); }).filter(Boolean)
          : base.rawFilmTypes,
        rawMinWidth: num(saved.rawMinWidth, base.rawMinWidth),
        rawMaxWidth: num(saved.rawMaxWidth, base.rawMaxWidth),
        rawThickness: num(saved.rawThickness, base.rawThickness),
        evaFilmTypes: Array.isArray(saved.evaFilmTypes) && saved.evaFilmTypes.length
          ? saved.evaFilmTypes.map(function (s) { return String(s == null ? '' : s).trim().toUpperCase(); }).filter(Boolean)
          : base.evaFilmTypes,
        evaCapacityPerShift: posNum(saved.evaCapacityPerShift, base.evaCapacityPerShift),
        shiftsPerDay: posNum(saved.shiftsPerDay, base.shiftsPerDay),
        hoursPerDay: posNum(saved.hoursPerDay, base.hoursPerDay),
        columnMapping:
          saved.columnMapping && typeof saved.columnMapping === 'object'
            ? saved.columnMapping
            : base.columnMapping,
      };
    } catch (e) {
      return base;
    }
  }

  /** اعتبارسنجی و نرمال‌سازی پارامترها — خروجی خطاها به فارسی (پیام‌های هماهنگ سرور) */
  function validateSettings(input) {
    var errors = [];
    if (input.rawFilmTypes !== undefined) {
      if (!normalizeFilmList(input.rawFilmTypes).length) errors.push('حداقل یک نوع فیلم برای رول خام لازم است.');
    }
    if (input.evaFilmTypes !== undefined) {
      if (!normalizeFilmList(input.evaFilmTypes).length) errors.push('حداقل یک نوع فیلم برای رول EVA لازم است.');
    }
    if (input.rawMinWidth !== undefined && (!Number.isFinite(input.rawMinWidth) || input.rawMinWidth <= 0)) {
      errors.push('حداقل عرض رول خام باید عددی مثبت باشد.');
    }
    if (input.rawMaxWidth !== undefined && (!Number.isFinite(input.rawMaxWidth) || input.rawMaxWidth <= 0)) {
      errors.push('حداکثر عرض رول خام باید عددی مثبت باشد.');
    }
    if (
      input.rawMinWidth !== undefined && input.rawMaxWidth !== undefined &&
      Number.isFinite(input.rawMinWidth) && Number.isFinite(input.rawMaxWidth) &&
      input.rawMinWidth > input.rawMaxWidth
    ) {
      errors.push('حداقل عرض رول خام نمی‌تواند بیشتر از حداکثر عرض باشد.');
    }
    if (input.rawThickness !== undefined && (!Number.isFinite(input.rawThickness) || input.rawThickness <= 0)) {
      errors.push('ضخامت رول خام باید عددی مثبت باشد.');
    }
    if (input.evaCapacityPerShift !== undefined && (!Number.isFinite(input.evaCapacityPerShift) || input.evaCapacityPerShift <= 0)) {
      errors.push('ظرفیت هر شیفت دستگاه EVA باید عددی مثبت باشد.');
    }
    if (input.shiftsPerDay !== undefined && (!Number.isFinite(input.shiftsPerDay) || input.shiftsPerDay <= 0)) {
      errors.push('تعداد شیفت در روز باید عددی مثبت باشد.');
    }
    if (input.hoursPerDay !== undefined && (!Number.isFinite(input.hoursPerDay) || input.hoursPerDay <= 0 || input.hoursPerDay > 24)) {
      errors.push('ساعت تولید در شبانه‌روز باید عددی بین ۱ تا ۲۴ باشد.');
    }
    return { ok: errors.length === 0, errors: errors };
  }

  /* =========================================================================
     ابزارهای عددی (پورت api-helpers.ts)
     ========================================================================= */

  /** مانده زمان (روز) = وزن ÷ (ظرفیت هر شیفت × تعداد شیفت) — ظرفیت صفر → 0 */
  function remainingDaysOf(weight, params) {
    var denom = params.evaCapacityPerShift * params.shiftsPerDay;
    return denom > 0 ? weight / denom : 0;
  }

  /** گردکردن تا n رقم اعشار (پاک‌سازی خطای جمع ممیز شناور) */
  function roundTo(n, digits) {
    if (digits === undefined) digits = 3;
    var f = Math.pow(10, digits);
    return Math.round(n * f) / f;
  }

  /**
   * ساخت DTO کامل رول — دادهٔ ذخیره‌شده + دسته‌بندی زنده با تنظیمات فعلی
   * + هویت شمارهٔ رول (سالن/رقم سال/سال) + بازوها و پسوند.
   * وضعیت دستی (typeOverride — بند ۴ نسخهٔ ۱٫۲) بر دستهٔ خودکار اولویت دارد.
   */
  function toRollDto(roll, params) {
    var cls = classifyRoll(roll.rollNumber, roll.filmType, roll.width, roll.thickness, params);
    var identity = parseRollIdentity(roll.rollNumber);
    var typeOverride =
      roll.typeOverride === 'raw' || roll.typeOverride === 'eva' || roll.typeOverride === 'cut'
        ? roll.typeOverride
        : null;
    /* بند ۴ (نسخهٔ ۱٫۳): فیلدهای ویرایش‌شده + پرچم ویرایش — برای بخش «رول‌های ویرایش‌شده» */
    var manualEdit = parseManualEdit(roll.manualEdit);
    return {
      id: roll.id,
      rollNumber: roll.rollNumber,
      filmType: roll.filmType,
      width: roll.width,
      initialWidth: roll.initialWidth,
      thickness: roll.thickness,
      length: roll.length,
      netWeight: roll.netWeight,
      grade: roll.grade,
      palletNumber: roll.palletNumber,
      setupNumber: roll.setupNumber,
      productionDate: roll.productionDate,
      position: roll.position,
      externalId: roll.externalId,
      hall: identity.hall,
      yearDigit: identity.yearDigit,
      year: identity.year,
      category: typeOverride || cls.category,
      autoCategory: cls.category,
      typeOverride: typeOverride,
      manualEdit: manualEdit,
      edited: typeOverride !== null || Object.keys(manualEdit).length > 0,
      rawArm: cls.rawArm,
      evaCutArm: cls.evaCutArm,
      suffix: cls.suffix,
    };
  }

  /* =========================================================================
     ویرایش دستی رول (بند ۴ نسخهٔ ۱٫۲ — پورت api-helpers.ts)
     ========================================================================= */

  /** فیلدهای عددی قابل ویرایش دستی رول — برای اعمال manualEdit در بازسازی */
  var MANUAL_NUM_FIELDS = ['width', 'initialWidth', 'thickness', 'length', 'netWeight', 'setupNumber'];

  /** فیلدهای رشته‌ای قابل ویرایش دستی رول */
  var MANUAL_STR_FIELDS = [
    'rollNumber',
    'filmType',
    'grade',
    'palletNumber',
    'productionDate',
    'position',
    'externalId',
  ];

  /**
   * پارس manualEdit (JSON {field: value}) — خروجی فقط فیلدهای معتبر شناخته‌شده را
   * دارد؛ مقادیر عددی به number|null و رشته‌ای به string|null نگاشت می‌شوند.
   */
  function parseManualEdit(s) {
    if (!s) return {};
    try {
      var obj = JSON.parse(s);
      if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return {};
      var src = obj;
      var out = {};
      MANUAL_NUM_FIELDS.forEach(function (f) {
        if (f in src) {
          var v = src[f];
          out[f] =
            v === null || v === undefined
              ? null
              : typeof v === 'number' && Number.isFinite(v)
                ? v
                : null;
        }
      });
      MANUAL_STR_FIELDS.forEach(function (f) {
        if (f in src) {
          var v2 = src[f];
          out[f] = v2 === null || v2 === undefined ? null : String(v2);
        }
      });
      return out;
    } catch (e) {
      return {};
    }
  }

  /* =========================================================================
     محاسبات داشبورد (پورت api/dashboard/route.ts)
     ========================================================================= */

  /** سقف آیتم هر آرایهٔ هشدار */
  var WARNINGS_CAP = 50;

  function computeDashboard(rolls, settings) {
    var dtos = rolls.map(function (r) { return toRollDto(r, settings); });

    var rawCount = 0, rawWeight = 0;
    var evaCount = 0, evaWeight = 0;
    var cutCount = 0, cutWeight = 0;
    var errorsCount = 0; // error_e_film + error_no_e
    var infosCount = 0;  // raw_out_of_range

    var setups = new Map();
    var grades = new Map();
    var positions = new Map();
    var warnEFilm = [];
    var warnNoE = [];
    var warnRawOOR = [];

    dtos.forEach(function (d) {
      var w = d.netWeight == null ? 0 : d.netWeight; // null-safe
      switch (d.category) {
        case 'raw': {
          rawCount += 1;
          rawWeight += w;
          // گروه ستاپ — فقط setupNumber غیر null
          if (d.setupNumber !== null) {
            var s = setups.get(d.setupNumber) || { count: 0, weight: 0 };
            s.count += 1;
            s.weight += w;
            setups.set(d.setupNumber, s);
          }
          // گروه موقعیت — null → «نامشخص»
          var p = d.position == null ? 'نامشخص' : d.position;
          var ps = positions.get(p) || { count: 0, weight: 0 };
          ps.count += 1;
          ps.weight += w;
          positions.set(p, ps);
          break;
        }
        case 'eva':
          evaCount += 1;
          evaWeight += w;
          break;
        case 'cut': {
          cutCount += 1;
          cutWeight += w;
          // گروه گرید — حرف مجاز اول یا «بدون گرید»
          var g = gradeLetter(d.grade) || 'none';
          var gs = grades.get(g) || { count: 0, weight: 0 };
          gs.count += 1;
          gs.weight += w;
          grades.set(g, gs);
          break;
        }
        case 'error_e_film':
          errorsCount += 1;
          warnEFilm.push(d);
          break;
        case 'error_no_e':
          errorsCount += 1;
          warnNoE.push(d);
          break;
        case 'raw_out_of_range':
          infosCount += 1;
          warnRawOOR.push(d);
          break;
        default:
          break; // سایر رول‌ها در KPI ها حضور ندارند
      }
    });

    var totalDays = remainingDaysOf(rawWeight, settings);
    var kpis = {
      rawCount: rawCount,
      rawWeight: roundTo(rawWeight, 3),
      evaCount: evaCount,
      evaWeight: roundTo(evaWeight, 3),
      cutCount: cutCount,
      cutWeight: roundTo(cutWeight, 3),
      remainingDays: roundTo(totalDays, 3),
      remainingHours: roundTo(totalDays * settings.hoursPerDay, 3),
      errorsCount: errorsCount,
      infosCount: infosCount,
    };

    // مانده زمان به تفکیک ستاپ (مرتب صعودی شمارهٔ ستاپ)
    var perSetup = Array.from(setups.entries())
      .map(function (entry) {
        var days = remainingDaysOf(entry[1].weight, settings);
        return {
          setupNumber: entry[0],
          rawCount: entry[1].count,
          rawWeight: roundTo(entry[1].weight, 3),
          remainingDays: roundTo(days, 3),
          remainingHours: roundTo(days * settings.hoursPerDay, 3),
        };
      })
      .sort(function (a, b) { return a.setupNumber - b.setupNumber; });

    // هشدارها: مرتب بر اساس شمارهٔ رول + سقف ۵۰ آیتم
    function byRollNumber(a, b) { return a.rollNumber.localeCompare(b.rollNumber); }
    var warnings = {
      error_e_film: warnEFilm.sort(byRollNumber).slice(0, WARNINGS_CAP),
      error_no_e: warnNoE.sort(byRollNumber).slice(0, WARNINGS_CAP),
      raw_out_of_range: warnRawOOR.sort(byRollNumber).slice(0, WARNINGS_CAP),
    };

    // توزیع گرید رول‌های برش‌خورده (فقط گریدهای موجود، به‌ترتیب X/U/Q/T/بدون)
    var cutGradeDistribution = [];
    GRADE_ORDER.forEach(function (g) {
      var v = grades.get(g);
      if (v) {
        cutGradeDistribution.push({ label: GRADE_LABELS[g], count: v.count, weight: roundTo(v.weight, 3) });
      }
    });

    // توزیع موقعیت رول‌های خام (مرتب نزولی بر اساس وزن)
    var rawByPosition = Array.from(positions.entries())
      .map(function (entry) { return { label: entry[0], count: entry[1].count, weight: roundTo(entry[1].weight, 3) }; })
      .sort(function (a, b) { return b.weight - a.weight || a.label.localeCompare(b.label, 'fa'); });

    return {
      kpis: kpis,
      perSetup: perSetup,
      warnings: warnings,
      cutGradeDistribution: cutGradeDistribution,
      rawByPosition: rawByPosition,
      settingsUsed: {
        evaCapacityPerShift: settings.evaCapacityPerShift,
        shiftsPerDay: settings.shiftsPerDay,
        hoursPerDay: settings.hoursPerDay,
        rawFilmTypes: settings.rawFilmTypes,
        evaFilmTypes: settings.evaFilmTypes,
        rawMinWidth: settings.rawMinWidth,
        rawMaxWidth: settings.rawMaxWidth,
        rawThickness: settings.rawThickness,
      },
    };
  }

  /* =========================================================================
     فهرست رول‌های یک دسته (پورت api/rolls/route.ts)
     ========================================================================= */

  function getRollsByCategory(rolls, settings, category) {
    return rolls
      .map(function (r) { return toRollDto(r, settings); })
      .filter(function (d) { return d.category === category; })
      .sort(function (a, b) {
        return (
          ((a.setupNumber == null ? Number.MAX_SAFE_INTEGER : a.setupNumber) -
            (b.setupNumber == null ? Number.MAX_SAFE_INTEGER : b.setupNumber)) ||
          a.rollNumber.localeCompare(b.rollNumber)
        );
      });
  }

  /* =========================================================================
     گروه‌بندی رول‌های برش‌خورده (پورت api/rolls/cut-groups/route.ts)
     ========================================================================= */

  function emptyGrades() {
    return {
      X: { count: 0, weight: 0 },
      U: { count: 0, weight: 0 },
      Q: { count: 0, weight: 0 },
      T: { count: 0, weight: 0 },
      none: { count: 0, weight: 0 },
    };
  }

  function computeCutGroups(rolls, settings) {
    var groups = new Map();
    var totalCount = 0;
    var totalWeight = 0;

    rolls.forEach(function (row) {
      var dto = toRollDto(row, settings);
      if (dto.category !== 'cut') return;

      var key = cutGroupKey(dto.setupNumber, dto.hall, dto.yearDigit, dto.width);
      var g = groups.get(key);
      if (!g) {
        g = {
          key: key,
          setupNumber: dto.setupNumber,
          hall: dto.hall,
          yearDigit: dto.yearDigit,
          year: dto.year,
          width: dto.width,
          count: 0,
          totalWeight: 0,
          grades: emptyGrades(),
        };
        groups.set(key, g);
      }

      var w = dto.netWeight == null ? 0 : dto.netWeight; // null-safe
      g.count += 1;
      g.totalWeight += w;
      var gl = gradeLetter(dto.grade) || 'none';
      g.grades[gl].count += 1;
      g.grades[gl].weight += w;

      totalCount += 1;
      totalWeight += w;
    });

    // گردکردن وزن‌ها + مرتب‌سازی: ستاپ صعودی سپس عرض صعودی (null ها آخر)
    var list = Array.from(groups.values())
      .map(function (g) {
        var out = {
          key: g.key,
          setupNumber: g.setupNumber,
          hall: g.hall,
          yearDigit: g.yearDigit,
          year: g.year,
          width: g.width,
          count: g.count,
          totalWeight: roundTo(g.totalWeight, 3),
          grades: {},
        };
        GRADE_ORDER.forEach(function (k) {
          out.grades[k] = { count: g.grades[k].count, weight: roundTo(g.grades[k].weight, 3) };
        });
        return out;
      })
      .sort(function (a, b) {
        return (
          ((a.setupNumber == null ? Number.MAX_SAFE_INTEGER : a.setupNumber) -
            (b.setupNumber == null ? Number.MAX_SAFE_INTEGER : b.setupNumber)) ||
          ((a.width == null ? Number.MAX_SAFE_INTEGER : a.width) -
            (b.width == null ? Number.MAX_SAFE_INTEGER : b.width))
        );
      });

    return { groups: list, stats: { groups: list.length, count: totalCount, weight: roundTo(totalWeight, 3) } };
  }

  /* =========================================================================
     پارس فیلدهای JSON داخل رکوردها
     ========================================================================= */

  /** پارس JSON آرایه‌ای از رشته (مثل فیلد headers در ImportBatch) — خطا → آرایهٔ خالی */
  function parseJsonArray(s) {
    if (!s) return [];
    try {
      var arr = JSON.parse(s);
      return Array.isArray(arr) ? arr.map(function (x) { return String(x); }) : [];
    } catch (e) {
      return [];
    }
  }

  /* ---------------- انتشار سراسری ---------------- */
  window.EVA = {
    APP_NAME: APP_NAME,
    APP_VERSION: APP_VERSION,
    BACKUP_SCHEMA_VERSION: BACKUP_SCHEMA_VERSION,
    SETTINGS_KEY: SETTINGS_KEY,

    CATEGORY_LABELS: CATEGORY_LABELS,
    FIELD_LABELS: FIELD_LABELS,
    REQUIRED_FIELDS: REQUIRED_FIELDS,
    MAPPABLE_FIELD_ORDER: MAPPABLE_FIELD_ORDER,
    CATEGORY_ORDER: CATEGORY_ORDER,
    GRADE_ORDER: GRADE_ORDER,
    GRADE_LABELS: GRADE_LABELS,
    COLUMN_SPECS: COLUMN_SPECS,
    DEFAULT_COLUMN_MAP: DEFAULT_COLUMN_MAP,
    WARNINGS_CAP: WARNINGS_CAP,

    parseRollIdentity: parseRollIdentity,
    parseRollNumber: parseRollNumber,
    classifyRoll: classifyRoll,
    gradeLetter: gradeLetter,
    cutGroupKey: cutGroupKey,

    normalizeHeader: normalizeHeader,
    buildFieldMapping: buildFieldMapping,
    parseNumber: parseNumber,
    parseIntSafe: parseIntSafe,
    parseText: parseText,
    normalizeRow: normalizeRow,

    defaultSettings: defaultSettings,
    parseSettingsValue: parseSettingsValue,
    normalizeFilmList: normalizeFilmList,
    validateSettings: validateSettings,

    remainingDaysOf: remainingDaysOf,
    roundTo: roundTo,
    toRollDto: toRollDto,
    MANUAL_NUM_FIELDS: MANUAL_NUM_FIELDS,
    MANUAL_STR_FIELDS: MANUAL_STR_FIELDS,
    parseManualEdit: parseManualEdit,
    computeDashboard: computeDashboard,
    getRollsByCategory: getRollsByCategory,
    computeCutGroups: computeCutGroups,
    parseJsonArray: parseJsonArray,
  };
})();
