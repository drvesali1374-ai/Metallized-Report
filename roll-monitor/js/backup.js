/* =========================================================================
   backup.js — پشتیبان‌گیری و بازیابی (§61-§62)
   -------------------------------------------------------------------------
   Export:  JSON شامل ستاپ‌ها + قوانین + تنظیمات + متادیتا + Datasetها
   Restore: اعتبارسنجی ساختار → تأیید کاربر → جایگزینی تراکنشی (§14)
   نام فایل: RollMonitor-Backup-YYYY-MM-DD.json
   ========================================================================= */

'use strict';

(function () {
  const U = RM.utils;
  const db = RM.db.db;

  const Backup = {};

  /* ---------------- ساخت Backup ---------------- */

  /**
   * ساخت شیء کامل پشتیبان از تمام داده‌های برنامه.
   * Datasetهای Import شده نیز پوشش داده می‌شوند (§61).
   */
  Backup.build = async function () {
    const [setupRolls, standardLengthRules, appSettings, importMetadata, rolls, archivedRolls] =
      await Promise.all([
        db.setupRolls.toArray(),
        db.standardLengthRules.toArray(),
        db.appSettings.toArray(),
        db.importMetadata.toArray(),
        db.rolls.toArray(),
        db.archivedRolls.toArray(),
      ]);

    return {
      app: RM.config.APP_NAME,
      schemaVersion: 2,
      exportedAt: Date.now(),
      counts: {
        setupRolls: setupRolls.length,
        standardLengthRules: standardLengthRules.length,
        rolls: rolls.length,
        archivedRolls: archivedRolls.length,
        importMetadata: importMetadata.length,
      },
      data: { setupRolls, standardLengthRules, appSettings, importMetadata, rolls, archivedRolls },
    };
  };

  /** دانلود فایل Backup (Blob محلی — بدون سرور) */
  Backup.exportFile = async function () {
    const payload = await Backup.build();

    const date = new Date(payload.exportedAt);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const fileName = `RollMonitor-Backup-${y}-${m}-${d}.json`;

    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();

    // آزادسازی حافظهٔ Blob پس از دانلود
    setTimeout(() => URL.revokeObjectURL(url), 4000);

    return { fileName, counts: payload.counts };
  };

  /* ---------------- اعتبارسنجی Backup (§72: Backup Corrupted) ---------------- */

  /**
   * اعتبارسنجی ساختار فایل Backup.
   * خروجی: { ok, payload, errors } — پیام‌های دقیق برای کاربر.
   */
  Backup.validate = function (payload) {
    const errors = [];

    if (!payload || typeof payload !== 'object') {
      return { ok: false, errors: ['ساختار فایل معتبر نیست.'] };
    }
    if (payload.app !== RM.config.APP_NAME) {
      errors.push('این فایل متعلق به سامانهٔ مانیتورینگ رول‌ها نیست.');
    }
    if (payload.schemaVersion !== 2) {
      errors.push(`نسخهٔ ساختار پشتیبان (${payload.schemaVersion}) پشتیبانی نمی‌شود.`);
    }

    const d = payload.data;
    if (!d || typeof d !== 'object') {
      errors.push('بخش داده‌های فایل یافت نشد.');
      return { ok: false, errors };
    }

    // بررسی جداول ضروری (آرایه بودن)
    for (const table of ['setupRolls', 'standardLengthRules', 'appSettings', 'rolls', 'archivedRolls']) {
      if (!Array.isArray(d[table])) {
        errors.push(`جدول «${table}» در فایل یافت نشد یا معتبر نیست.`);
      }
    }

    // اعتبارسنجی حداقلی رکوردهای ستاپ (قابل بازیابی بودن)
    if (Array.isArray(d.setupRolls)) {
      const bad = d.setupRolls.filter(
        (s) => typeof s.setupNumber !== 'number' ||
               typeof s.rollCount !== 'number' ||
               typeof s.width !== 'number'
      );
      if (bad.length) {
        errors.push(`${U.faNum(bad.length)} رکورد ستاپ در فایل ساختار نامعتبر دارد.`);
      }
    }

    // اعتبارسنجی قوانین
    if (Array.isArray(d.standardLengthRules)) {
      const badRules = d.standardLengthRules.filter(
        (r) => typeof r.thickness !== 'number' || typeof r.minLength !== 'number' ||
               typeof r.maxLength !== 'number' || typeof r.standardLength !== 'number'
      );
      if (badRules.length) {
        errors.push(`${U.faNum(badRules.length)} قانون متراژ در فایل ساختار نامعتبر دارد.`);
      }
    }

    return { ok: errors.length === 0, payload, errors };
  };

  /* ---------------- بازیابی Backup (§70: تأیید اجباری) ---------------- */

  /**
   * بازیابی تراوانشی Backup — تمام جداول جاری جایگزین می‌شوند.
   * UI باید پیش از فراخوانی، تأیید کاربر را با نمایش تعداد رکوردها بگیرد.
   */
  Backup.restore = async function (payload) {
    const check = Backup.validate(payload);
    if (!check.ok) return { ok: false, errors: check.errors };

    const d = check.payload.data;

    await db.transaction(
      'rw',
      [db.setupRolls, db.standardLengthRules, db.appSettings, db.importMetadata, db.rolls, db.archivedRolls],
      async () => {
        await db.setupRolls.clear();
        await db.setupRolls.bulkAdd(d.setupRolls);

        await db.standardLengthRules.clear();
        await db.standardLengthRules.bulkAdd(d.standardLengthRules);

        await db.appSettings.clear();
        if (d.appSettings.length) await db.appSettings.bulkAdd(d.appSettings);

        await db.importMetadata.clear();
        if (Array.isArray(d.importMetadata) && d.importMetadata.length) {
          await db.importMetadata.bulkAdd(d.importMetadata);
        }

        // Datasetهای اکسل — فیلدهای id قدیمی حذف تا کلید جدید بگیرند
        await db.rolls.clear();
        if (d.rolls.length) {
          await db.rolls.bulkAdd(d.rolls.map(({ id, ...row }) => row));
        }

        await db.archivedRolls.clear();
        if (d.archivedRolls.length) {
          await db.archivedRolls.bulkAdd(d.archivedRolls.map(({ id, ...row }) => row));
        }
      }
    );

    return { ok: true, counts: check.payload.counts };
  };

  RM.backupEngine = Backup;
})();
