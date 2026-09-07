/* =========================================================================
   database.js — لایهٔ دسترسی به پایگاه‌داده (Dexie / IndexedDB)
   -------------------------------------------------------------------------
   جداول (§13):
     rolls              رکوردهای نرمال‌شدهٔ فایل rolls.xlsx
     archivedRolls      رکوردهای نرمال‌شدهٔ فایل Archived Rolls.xlsx
     setupRolls         رکوردهای تعریف‌شدهٔ کاربر برای ستاپ‌ها
     standardLengthRules قوانین متراژ استاندارد (§15)
     appSettings        تنظیمات برنامه (مرتب‌سازی ماندگار و…)
     importMetadata     متادیتای هر Import (§12)
     meta               جدول قدیمی نسخهٔ ۱ (برای سازگاری حفظ می‌شود)

   مهاجرت امن v1 → v2 (§76):
     داده‌های قدیمی کاربر بدون از دست رفتن به مدل جدید تبدیل می‌شوند.
   ========================================================================= */

'use strict';

(function () {
  const U = RM.utils;
  const N = RM.normalize;

  /* ---------------- تعریف پایگاه‌داده ---------------- */

  const db = new Dexie('RollMonitorDB');

  /** Schema نسخهٔ ۱ — ساختار قدیمی پروژه (برای مسیر مهاجرت) */
  db.version(1).stores({
    rolls: '++id, filmType',
    archivedRolls: '++id, filmType',
    setupRolls: '++id, setupNumber, machineNumber, rollType',
    meta: 'key',
  });

  /**
   * نسخهٔ ۲ — Schema جدید + مهاجرت داده‌های قدیمی (§76)
   * ایندکس‌ها بر اساس نیاز واقعی موتورهای محاسباتی تعریف شده‌اند (§13).
   */
  db.version(2).stores({
    rolls:             '++id, rollNumber, setupNumber, width, filmType',
    archivedRolls:     '++id, rollNumber, setupNumber, width, filmType',
    setupRolls:        '++id, setupNumber, machineNumber, [setupNumber+machineNumber]',
    standardLengthRules: '++id, thickness',
    appSettings:       'key',
    importMetadata:    '++id, target, importedAt',
    meta:              'key',
  }).upgrade(async (tx) => {
    /* ----- مهاجرت rolls و archivedRolls: نرمال‌سازی مجدد از سطر خام قدیمی ----- */
    const targets = [
      { table: 'rolls', sourceKey: 'rolls' },
      { table: 'archivedRolls', sourceKey: 'archived' },
    ];

    for (const { table, sourceKey } of targets) {
      const legacyRows = await tx.table(table).toArray();
      if (!legacyRows.length) continue;

      // بازسازی رکوردهای جدید از سطرهای خام ذخیره‌شده در فیلد data
      const headers = legacyRows.length ? Object.keys(legacyRows[0].data || {}) : [];
      const mapping = N.buildFieldMapping(sourceKey, headers);

      const records = [];
      for (const legacy of legacyRows) {
        const raw = legacy.data || {};
        const { record } = N.normalizeRow(raw, sourceKey, mapping);
        records.push(record);
      }

      const tableRef = tx.table(table);
      await tableRef.clear();
      await tableRef.bulkAdd(records);
    }

    /* ----- مهاجرت setupRolls: نگاشت فیلدهای قدیمی به مدل جدید ----- */
    const legacySetups = await tx.table('setupRolls').toArray();
    if (legacySetups.length) {
      const now = Date.now();
      const migrated = legacySetups.map((s) => ({
        setupNumber: U.parseInt(s.setupNumber) ?? 0,
        machineNumber: U.parseInt(s.machineNumber) ?? null,
        width: U.parseNumber(s.rollWidth) ?? null,
        // مدل جدید ضخامت/متراژ استاندارد دارد؛ رکوردهای قدیمی ناقص علامت‌گذاری می‌شوند
        thickness: null,
        standardLength: null,
        rollCount: U.parseInt(s.rollCount) ?? 0,
        cuttingPattern: null,
        legacy: true,          // نشانِ «نیازمند تکمیل توسط کاربر»
        createdAt: s.createdAt || now,
        updatedAt: now,
      }));

      const setupTable = tx.table('setupRolls');
      await setupTable.clear();
      await setupTable.bulkAdd(migrated);
    }

    /* ----- مهاجرت meta قدیمی → importMetadata ----- */
    const metaTable = tx.table('meta');
    const importTable = tx.table('importMetadata');

    const legacyRollsInfo = await metaTable.get('rollsInfo');
    if (legacyRollsInfo) {
      await importTable.add({
        target: 'rolls',
        fileName: legacyRollsInfo.fileName || 'rolls.xlsx (قدیمی)',
        importedAt: legacyRollsInfo.importedAt || now,
        totalRecords: legacyRollsInfo.totalRows || 0,
        validRecords: legacyRollsInfo.totalRows || 0,
        rawRolls: legacyRollsInfo.matchedRows || 0,
        fileHash: null,
        datasetVersion: 1,
      });
    }

    const legacyArchivedInfo = await metaTable.get('archivedInfo');
    if (legacyArchivedInfo) {
      await importTable.add({
        target: 'archived',
        fileName: legacyArchivedInfo.fileName || 'Archived Rolls.xlsx (قدیمی)',
        importedAt: legacyArchivedInfo.importedAt || now,
        totalRecords: legacyArchivedInfo.totalRows || 0,
        validRecords: legacyArchivedInfo.totalRows || 0,
        rawRolls: 0,
        fileHash: null,
        datasetVersion: 1,
      });
    }
  });

  /* ---------------- لایهٔ دسترسی راحت (Repository ساده) ---------------- */

  const DB = { db };

  /** خواندن همهٔ منابع داده به‌صورت موازی (برای موتور محاسبه) */
  DB.loadAllSources = async function () {
    const [rolls, archivedRolls, setupRolls, rules, importMetadata] = await Promise.all([
      db.rolls.toArray(),
      db.archivedRolls.toArray(),
      db.setupRolls.toArray(),
      db.standardLengthRules.toArray(),
      db.importMetadata.toArray(),
    ]);
    return { rolls, archivedRolls, setupRolls, rules, importMetadata };
  };

  /** خواندن یک تنظیم (با مقدار پیش‌فرض) */
  DB.getSetting = async function (key, defaultValue) {
    const row = await db.appSettings.get(key);
    return row ? row.value : defaultValue;
  };

  /** ذخیرهٔ یک تنظیم به‌صورت تراکنشی */
  DB.setSetting = async function (key, value) {
    await db.transaction('rw', db.appSettings, async () => {
      await db.appSettings.put({ key, value });
    });
  };

  /** آخرین متادیتای Import برای هر هدف */
  DB.getLatestImportMeta = async function (targetKey) {
    const entries = await db.importMetadata
      .where('target').equals(targetKey)
      .reverse()
      .sortBy('importedAt');
    return entries.length ? entries[0] : null;
  };

  /** شمارهٔ نسخهٔ Dataset بعدی برای هر هدف (§60) */
  DB.nextDatasetVersion = async function (targetKey) {
    const count = await db.importMetadata.where('target').equals(targetKey).count();
    return count + 1;
  };

  /**
   * ارتقای رکوردهای قدیمی به مدل فعلی (بدون تغییر Schema — سازگاری نرم).
   * رکوردهایی که پیش از افزودن فیلد cutWidth ایمپورت/بازیابی شده‌اند،
   * از سطر خام ذخیره‌شده (raw) با Mapping جاری بازسازی می‌شوند تا فیلدهای
   * جدید مقدار بگیرند. تراکنشی و یک‌باره — اگر رکوردها از قبل به‌روز
   * باشند هیچ کاری انجام نمی‌شود.
   */
  DB.ensureModelFields = async function () {
    const targets = [
      { table: 'rolls', sourceKey: 'rolls' },
      { table: 'archivedRolls', sourceKey: 'archived' },
    ];

    for (const { table, sourceKey } of targets) {
      try {
        const all = await db[table].toArray();
        if (!all.length) continue;
        if ('cutWidth' in all[0]) continue;          // مدل فعلی — نیازی به بازسازی نیست

        const withRaw = all.filter((r) => r.raw);
        if (!withRaw.length) continue;               // بدون سطر خام — قابل بازسازی نیست

        const headers = Object.keys(withRaw[0].raw);
        const overrides = (await N.getUserMapping())[sourceKey] || {};
        const mapping = N.buildFieldMapping(sourceKey, headers, overrides);

        const fresh = all.map((r) =>
          r.raw ? { ...N.normalizeRow(r.raw, sourceKey, mapping).record, id: r.id } : r
        );

        await db.transaction('rw', db[table], async () => {
          await db[table].clear();
          await db[table].bulkPut(fresh);
        });
      } catch (err) {
        console.warn('[ModelUpgrade]', table, err);
      }
    }
  };

  RM.db = DB;
})();
