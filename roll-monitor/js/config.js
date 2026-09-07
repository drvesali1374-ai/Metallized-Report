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

  /* ---------------- نقشه ستون‌های Excel → مدل داخلی (§8-§9) ----------------
     نام اصلی + نام‌های جایگزین برای مقاوم‌سازی در برابر تغییرات جزئی اکسل */

  /*  نگاشت پیش‌فرض ستون‌ها — قابل بازنویسی توسط کاربر در تنظیمات
      (تنظیم در appSettings با کلید columnMapping؛ مستقل برای هر Dataset).
      فیلدهای optional: true در صورت نبود ستون، خطا نیستند (فیلدهای
      نمایشی/جزئیات مثل تاریخ تولید، وزن خالص، گرید و وضعیت). */
  COLUMN_MAP: {
    rolls: {
      rollNumber:     { primary: 'شماره رول',     fallbacks: ['شمارهرول', 'Roll Number'] },
      width:          { primary: 'عرض رول اولیه', fallbacks: ['عرض', 'عرضرولاولیه'] },
      actualLength:   { primary: 'متراژ',          fallbacks: ['متراز', 'Length'] },
      thickness:      { primary: 'ضخامت',          fallbacks: ['ضخامتفیلم'] },
      filmType:       { primary: 'نوع فیلم',       fallbacks: ['نوعفیلم'] },
      palletNumber:   { primary: 'شماره پالت',     fallbacks: ['شمارهپالت'] },
      setupNumber:    { primary: 'شماره ستاپ',     fallbacks: ['شمارهستاپ'] },
      /* --- فیلدهای اختیاری (جزئیات رکورد — § نگاشت قابل تنظیم) --- */
      productionDate: { primary: 'تاریخ تولید',   fallbacks: ['تاریختولید'], optional: true },
      netWeight:      { primary: 'وزن خالص',       fallbacks: ['وزنخالص'], optional: true },
      grade:          { primary: 'گرید',           fallbacks: [], optional: true },
      status:         { primary: 'وضعیت',          fallbacks: ['وضعیتفعلی'], optional: true },
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
    'status', 'width', 'thickness', 'setupNumber', 'filmType', 'palletNumber',
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
    setupNumber:    { label: 'شماره ستاپ',      numeric: true },
    machineNumber:  { label: 'شماره دستگاه',    numeric: true },
    width:          { label: 'عرض',            numeric: true },
    thickness:      { label: 'ضخامت',          numeric: true },
    standardLength: { label: 'متراژ استاندارد', numeric: true },
    rollCount:      { label: 'تعداد رول',       numeric: true },
    rawExisting:    { label: 'خام موجود',       numeric: true },
    metallized:     { label: 'متالایز',         numeric: true },
    uncut:          { label: 'برش‌نشده',        numeric: true },
    cuttingPattern: { label: 'الگوی برش',       numeric: false },
  },

  /** مرتب‌سازی پیش‌فرض گزارش تولید ستاپ‌ها */
  SETUP_DEFAULT_SORT: [
    { field: 'setupNumber', direction: 'asc' },
    { field: 'width', direction: 'asc' },
  ],

  /* ---------------- تنظیمات UI ---------------- */

  /** تعداد ردیف هر صفحه در جدول‌های صفحه‌بندی‌شده (§56) */
  PAGE_SIZE: 30,

  /** حداکثر رکورد پیش‌نمایش داده خام پس از Import */
  PREVIEW_ROWS: 20,

  /** نام برنامه برای فایل Backup */
  APP_NAME: 'RollMonitor',
};
