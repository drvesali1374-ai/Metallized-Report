/* =========================================================================
   config.js — ثابت‌ها و پیکربندی مرکزی سیستم
   -------------------------------------------------------------------------
   تمام ثابت‌های سیستم در این فایل تعریف می‌شود تا هیچ مقدار کاری
   در کدهای Business Logic به‌صورت Hardcode باقی نماند (§92-93).
   ========================================================================= */

'use strict';

/** فضای نام سراسری برنامه (سازگار با file:// — بدون ES Module) */
window.RM = window.RM || {};

RM.config = {

  /* ---------------- پیکربندی اهداف Import ---------------- */

  IMPORT_TARGETS: {
    rolls: {
      key: 'rolls',
      table: 'rolls',
      label: 'رول‌های موجود',
      expectedFile: 'rolls.xlsx',
      /** ستون‌های مورد نیاز این فایل (نقشه §8) */
      requiredColumns: ['شماره رول', 'عرض رول اولیه', 'متراژ', 'ضخامت', 'نوع فیلم', 'شماره پالت', 'شماره ستاپ'],
    },
    archived: {
      key: 'archived',
      table: 'archivedRolls',
      label: 'سابقه رول‌ها (آرشیو)',
      expectedFile: 'Archived Rolls.xlsx',
      requiredColumns: ['شماره رول', 'عرض', 'متراژ اولیه', 'ضخامت', 'نوع فیلم', 'شماره پالت', 'شماره ستاپ'],
    },
  },

  /** عنوان‌های کاربرپسندهٔ Datasetها (نام فنی فقط برای Audit نمایش داده می‌شود) */
  DATASET_LABELS: {
    rolls: 'رول‌های موجود',
    archived: 'سابقه رول‌ها (آرشیو)',
  },

  /** برچسب منطقی فیلدها — برای پنل نگاشت ستون‌ها و عنوان ستون‌های جزئیات */
  FIELD_LABELS: {
    rollNumber:     'شماره رول',
    width:          'عرض',
    cutWidth:       'عرض',
    actualLength:   'متراژ',
    thickness:      'ضخامت',
    filmType:       'نوع فیلم',
    palletNumber:   'شماره پالت',
    setupNumber:    'شماره ستاپ',
    productionDate: 'تاریخ تولید',
    netWeight:      'وزن خالص',
    grade:          'گرید',
    status:         'وضعیت',
  },

  /** برچسب‌های اختصاصی هر Dataset (اولویت بر FIELD_LABELS)
      «رول‌های موجود»: فیلد width برچسب «عرض اولیه» دارد (محاسبات رول‌های خام)
      و فیلد جدید cutWidth برچسب «عرض» دارد (محاسبات رول‌های برش‌خورده). */
  SOURCE_FIELD_LABELS: {
    rolls: { width: 'عرض اولیه' },
  },

  /* ---------------- نقشه ستون‌های Excel → مدل داخلی (§8-§9) ----------------
     نام اصلی + نام‌های جایگزین برای مقاوم‌سازی در برابر تغییرات جزئی اکسل */

  /*  نگاشت پیش‌فرض ستون‌ها — قابل بازنویسی توسط کاربر در تنظیمات
      (تنظیم در appSettings با کلید columnMapping؛ مستقل برای هر Dataset).
      فیلدهای optional: true در صورت نبود ستون، خطا نیستند (فیلدهای
      نمایشی/جزئیات مثل تاریخ تولید، وزن خالص، گرید و وضعیت). */
  COLUMN_MAP: {
    rolls: {
      rollNumber:     { primary: 'شماره رول',     fallbacks: ['شمارهرول', 'Roll Number'] },
      /* عرض اولیه — مبنای محاسبات رول‌های خام (گروه‌بندی/تطبیق ستاپ) */
      width:          { primary: 'عرض رول اولیه', fallbacks: ['عرض'] },
      /* عرض (جدید) — مبنای محاسبات رول‌های برش‌خورده (فرزند) */
      cutWidth:       { primary: 'عرض',            fallbacks: [], optional: true },
      actualLength:   { primary: 'متراژ',          fallbacks: ['متراز', 'Length'] },
      thickness:      { primary: 'ضخامت',          fallbacks: ['ضخامتفیلم'] },
      filmType:       { primary: 'نوع فیلم',       fallbacks: ['نوعفیلم'] },
      palletNumber:   { primary: 'شماره پالت',     fallbacks: ['شمارهپالت'] },
      setupNumber:    { primary: 'شماره ستاپ',     fallbacks: ['شمارهستاپ'] },
      /* --- فیلدهای اختیاری (جزئیات رکورد — § نگاشت قابل تنظیم) --- */
      productionDate: { primary: 'تاریخ تولید',   fallbacks: ['تاریختولید'], optional: true },
      netWeight:      { primary: 'وزن خالص',       fallbacks: ['وزنخالص'], optional: true },
      grade:          { primary: 'گرید',           fallbacks: [], optional: true },
      /* موقعیت فعلی («پای کار» و…) از فیلد وضعیت خوانده می‌شود */
      status:         { primary: 'وضعیت',          fallbacks: ['وضعیتفعلی', 'موقعیت فعلی', 'موقعیتفعلی'], optional: true },
    },
    archived: {
      rollNumber:     { primary: 'شماره رول',   fallbacks: ['شمارهرول'] },
      width:          { primary: 'عرض',          fallbacks: ['عرضرول'] },
      actualLength:   { primary: 'متراژ اولیه', fallbacks: ['متراژ', 'متراجاولیه'] },
      thickness:      { primary: 'ضخامت',       fallbacks: ['ضخامتفیلم'] },
      filmType:       { primary: 'نوع فیلم',     fallbacks: ['نوعفیلم'] },
      palletNumber:   { primary: 'شماره پالت',   fallbacks: ['شمارهپالت'] },
      setupNumber:    { primary: 'شماره ستاپ',   fallbacks: ['شمارهستاپ'] },
      /* --- فیلدهای اختیاری --- */
      productionDate: { primary: 'تاریخ تولید', fallbacks: ['تاریخ تولید (شمسی)', 'تاریختولید'], optional: true },
      netWeight:      { primary: 'وزن خالص',     fallbacks: ['وزنخالص'], optional: true },
      grade:          { primary: 'گرید',         fallbacks: [], optional: true },
      status:         { primary: 'وضعیت',        fallbacks: ['علت'], optional: true },
    },
  },

  /* ---------------- ستون‌های جزئیات رکورد (گروه رول / Drill-down) ----------------
     ترتیب و انتخاب ستون‌ها توسط کاربر (appSettings: rollDetailColumns) تعیین
     می‌شود؛ نام ستون‌ها از Mapping کاربر خوانده می‌شود. */
  DETAIL_FIELDS: [
    'rollNumber', 'actualLength', 'productionDate', 'netWeight', 'grade',
    'status', 'width', 'cutWidth', 'thickness', 'setupNumber', 'filmType', 'palletNumber',
  ],

  /** پیش‌فرض ستون‌های جزئیات (حداقل ۵ فیلد موردنیاز) */
  DETAIL_DEFAULT_COLUMNS: ['rollNumber', 'actualLength', 'productionDate', 'netWeight', 'grade'],

  /* ---------------- محدودیت‌های دامنه کسب‌وکار ---------------- */

  /** شماره دستگاه تولید متالایز — تنها مقادیر مجاز (§21) */
  VALID_MACHINES: [1, 2, 3],

  /** فیلدهای مرتب‌سازی مجاز صفحه رول‌های خام (§36) + وضعیت تطبیق گروه */
  SORTABLE_FIELDS: {
    width:          { label: 'عرض',            numeric: true },
    thickness:      { label: 'ضخامت',          numeric: true },
    standardLength: { label: 'متراژ استاندارد', numeric: true },
    setupNumber:    { label: 'شماره ستاپ',      numeric: true },
    count:          { label: 'تعداد',           numeric: true },
    status:         { label: 'وضعیت',          numeric: false },
  },

  /** مرتب‌سازی پیش‌فرض صفحه رول‌های خام */
  DEFAULT_SORT: [
    { field: 'setupNumber', direction: 'asc' },
    { field: 'width', direction: 'asc' },
    { field: 'standardLength', direction: 'asc' },
  ],

  /* ---------------- پنل مرتب‌سازی گزارش تولید ستاپ‌ها ----------------
     همان سازوکار رول‌های خام — فیلدهای گزارش ستاپ + ماندگاری
     (appSettings: setupReportSort). */
  SETUP_SORTABLE_FIELDS: {
    setupNumber:          { label: 'شماره ستاپ',      numeric: true },
    machineNumber:        { label: 'شماره دستگاه',    numeric: true },
    width:                { label: 'عرض',            numeric: true },
    thickness:            { label: 'ضخامت',          numeric: true },
    standardLength:       { label: 'متراژ استاندارد', numeric: true },
    rollCount:            { label: 'تعداد رول',       numeric: true },
    rawExisting:          { label: 'خام موجود',       numeric: true },
    metallized:           { label: 'متالایز',         numeric: true },
    uncut:                { label: 'برش‌نشده',        numeric: true },
    cuttingPattern:       { label: 'الگوی برش',       numeric: false },
    remainingSetupTime:   { label: 'مانده زمان ستاپ', numeric: true },
    remainingProducedTime:{ label: 'مانده زمان موجودی', numeric: true },
  },

  /** مرتب‌سازی پیش‌فرض گزارش تولید ستاپ‌ها */
  SETUP_DEFAULT_SORT: [
    { field: 'setupNumber', direction: 'asc' },
    { field: 'width', direction: 'asc' },
  ],

  /* ---------------- ترتیب ستون‌های گزارش ستاپ‌ها (نسخهٔ ۲٫۳) ----------------
     ترتیب توسط کاربر در «پنل ترتیب ستون‌ها» (کشیدنی) تغییر می‌کند و
     به‌صورت ماندگار در appSettings: setupColumnOrder ذخیره می‌شود. */
  SETUP_DEFAULT_COLUMN_ORDER: [
    'setupNumber', 'machineNumber', 'width', 'thickness', 'standardLength',
    'rollCount', 'cuttingPattern', 'rawExisting', 'metallized', 'uncut',
    'remainingSetupTime', 'remainingProducedTime', 'actions',
  ],

  /* ---------------- عرض پیش‌فرض ستون‌های گزارش ستاپ‌ها (نسخهٔ ۲٫۴) ----------------
     در «پنل ترتیب ستون‌ها» بجای فلش‌های بالا/پایین، یک باکس عددی برای عرض هر
     ستون (px) قرار دارد؛ مقادیر کاربر به‌صورت ماندگار در appSettings:
     setupColumnWidths ذخیره می‌شود. صفر یا خالی → عرض خودکار مرورگر. */
  SETUP_DEFAULT_COLUMN_WIDTHS: {
    setupNumber:           84,
    machineNumber:         84,
    width:                 96,
    thickness:             92,
    standardLength:        118,
    rollCount:             86,
    cuttingPattern:        236,
    rawExisting:           96,
    metallized:            92,
    uncut:                 104,
    remainingSetupTime:    128,
    remainingProducedTime: 132,
    actions:               118,
  },

  /* ---------------- پنل مرتب‌سازی رول‌های برش‌خورده (فرزند) ----------------
     همان سازوکار رول‌های خام + ماندگاری (appSettings: cutRollsSort).
     مرتب‌سازی همیشه بر مبنای «تعداد» هر ستون است (وزن از تعداد مشتق می‌شود). */
  CUT_SORTABLE_FIELDS: {
    setupNumber:    { label: 'شماره ستاپ',      numeric: true },
    width:          { label: 'عرض',            numeric: true },
    existingCount:  { label: 'مقدار موجود',     numeric: true },
    inSetupCount:   { label: 'مقدار در ستاپ',   numeric: true },
    uncutCount:     { label: 'مقدار برش‌نخورده', numeric: true },
    xCount:         { label: 'گرید X',         numeric: true },
    uCount:         { label: 'گرید U',         numeric: true },
    qCount:         { label: 'گرید Q',         numeric: true },
    tCount:         { label: 'گرید T',         numeric: true },
    endCount:       { label: 'پای کار',         numeric: true },
    palletCount:    { label: 'پالت شده',        numeric: true },
  },

  /** مرتب‌سازی پیش‌فرض جدول رول‌های برش‌خورده */
  CUT_DEFAULT_SORT: [
    { field: 'setupNumber', direction: 'asc' },
    { field: 'width', direction: 'asc' },
  ],

  /* ---------------- ترتیب ستون‌های «گروه‌بندی رول‌های خام» (نسخهٔ ۲٫۶) ----------------
     همان سازوکار گزارش ستاپ‌ها: ترتیب با «پنل ترتیب ستون‌ها» (کشیدنی) تغییر
     می‌کند و در appSettings: rawColumnOrder ذخیره می‌شود. */
  RAW_DEFAULT_COLUMN_ORDER: [
    'width', 'thickness', 'standardLength', 'setupNumber', 'count', 'status', 'details',
  ],

  /** عرض پیش‌فرض ستون‌های رول‌های خام — خالی = خودکار (کاربر از پنل عرض می‌دهد) */
  RAW_DEFAULT_COLUMN_WIDTHS: {},

  /* ---------------- ترتیب ستون‌های «رول‌های برش‌خورده» (نسخهٔ ۲٫۶) ---------------- */
  CUT_DEFAULT_COLUMN_ORDER: [
    'width', 'setupNumber', 'existingCount', 'inSetupCount', 'uncutCount',
    'xCount', 'uCount', 'qCount', 'tCount', 'endCount', 'palletCount',
  ],

  /** عرض پیش‌فرض ستون‌های برش‌خورده — خالی = خودکار */
  CUT_DEFAULT_COLUMN_WIDTHS: {},

  /** تعداد حداقل رکوردهای قابل‌مشاهدهٔ جدول برش‌خورده (ارتفاع بلند + اسکرول)
      نسخهٔ ۲٫۴: مقدار اولیهٔ باکس «ردیف‌های قابل نمایش» — کاربر عدد دلخواه می‌دهد */
  CUT_VISIBLE_ROWS: 50,

  /** ارتفاع جدول رول‌های خام — همان طراحی برش‌خورده‌ها (نسخهٔ ۲٫۳)
      نسخهٔ ۲٫۴: مقدار اولیهٔ باکس «ردیف‌های قابل نمایش» */
  RAW_VISIBLE_ROWS: 50,

  /** ارتفاع جدول گزارش تولید ستاپ‌ها — همان طراحی برش‌خورده‌ها (نسخهٔ ۲٫۳)
      نسخهٔ ۲٫۴: مقدار اولیهٔ باکس «ردیف‌های قابل نمایش» */
  SETUP_VISIBLE_ROWS: 50,

  /** محدودهٔ مجاز باکس تعداد ردیف قابل نمایش (نسخهٔ ۲٫۴) */
  VISIBLE_ROWS_MIN: 5,
  VISIBLE_ROWS_MAX: 500,

  /* ---------------- رنگ ثابت دستگاه‌ها در دونات‌های داشبورد ----------------
     نسخهٔ ۲٫۶ (درخواست کاربر): رنگ‌های پررنگ‌تر و شفاف‌تر —
     دستگاه ۱ → سبز #82C836 · دستگاه ۲ → نارنجی #F09252 · دستگاه ۳ → آبی #00C1EE
     (فقط در دو دونات «مانده زمان ستاپ/موجودی» استفاده می‌شود) */
  MACHINE_COLORS: { 1: '#82C836', 2: '#F09252', 3: '#00C1EE' },

  /* ---------------- ثابت‌های کسب‌وکار رول‌های برش‌خورده ---------------- */

  /** وزن هر رول برش‌خورده = عرض × ضریب ثابت × تعداد (کیلوگرم) */
  CUT_WEIGHT_PER_MM: 0.362,

  /** حروف مجاز گرید (پیشوند لاتین ستون گرید) */
  GRADE_LETTERS: ['X', 'U', 'Q', 'T'],

  /** عبارت جست‌وجوی «پای کار» در ستون موقعیت فعلی (وضعیت) */
  END_OF_LINE_KEYWORD: 'پای کار',

  /* ---------------- قوانین زمان متالایز (هر دستگاه) ---------------- */

  /** طول شیفت تولید (دقیقه) — مدت زمان هر رول = ۷۲۰ ÷ تعداد در شیفت */
  SHIFT_MINUTES: 720,

  /* ---------------- تنظیمات UI ---------------- */

  /** تعداد ردیف هر صفحه در جدول‌های صفحه‌بندی‌شده (§56) */
  PAGE_SIZE: 30,

  /** حداکثر رکورد پیش‌نمایش داده خام پس از Import */
  PREVIEW_ROWS: 20,

  /** نام برنامه برای فایل Backup */
  APP_NAME: 'RollMonitor',
};
