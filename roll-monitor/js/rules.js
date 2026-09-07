/* =========================================================================
   rules.js — موتور قوانین متراژ استاندارد (§15-§19)
   -------------------------------------------------------------------------
   ساختار هر قانون:
     { id, thickness, minLength, maxLength, standardLength, createdAt }

   قوانین کسب‌وکار:
     - مرزهای بازه شامل‌اند (§16):  minLength <= actualLength <= maxLength
     - هم‌پوشانی قوانینِ یک ضخامت ممنوع (§18) — اعتبارسنجی مرکزی
     - بدون قانون منطبق → standardLength = null → عدم تطبیق (§17)
   ========================================================================= */

'use strict';

(function () {
  const U = RM.utils;
  const db = RM.db.db;

  const Rules = {};

  /* ---------------- اعتبارسنجی ساختاری یک قانون ---------------- */

  /**
   * اعتبارسنجی مقادیر خام فرم (قبل از ذخیره).
   * خروجی: { ok: true, rule }  یا  { ok: false, errors: {field: message} }
   */
  Rules.validateInput = function (input) {
    const errors = {};

    const thickness = U.parseNumber(input.thickness);
    const minLength = U.parseNumber(input.minLength);
    const maxLength = U.parseNumber(input.maxLength);
    const standardLength = U.parseNumber(input.standardLength);

    if (thickness === null || thickness <= 0) errors.thickness = 'ضخامت باید عددی مثبت (میکرون) باشد.';
    if (minLength === null || minLength <= 0) errors.minLength = 'حداقل متراژ باید عددی مثبت باشد.';
    if (maxLength === null || maxLength <= 0) errors.maxLength = 'حداکثر متراژ باید عددی مثبت باشد.';
    if (standardLength === null || standardLength <= 0) errors.standardLength = 'متراژ استاندارد باید عددی مثبت باشد.';

    if (minLength !== null && maxLength !== null && minLength > maxLength) {
      errors.maxLength = 'حداکثر متراژ نمی‌تواند کمتر از حداقل باشد.';
    }

    if (Object.keys(errors).length) return { ok: false, errors };

    return {
      ok: true,
      rule: { thickness, minLength, maxLength, standardLength },
    };
  };

  /* ---------------- اعتبارسنجی هم‌پوشانی (§18) — مرکزی ---------------- */

  /**
   * بررسی هم‌پوشانی قانون جدید/ویرایش‌شده با قوانین موجود همان ضخامت.
   * دو بازهٔ [aMin,aMax] و [bMin,bMax] هم‌پوشانند اگر:
   *    aMin <= bMax  &&  bMin <= aMax    (مرزها شامل‌اند — §16)
   * @param {object} rule        قانون در حال ذخیره
   * @param {Array}  existing    قوانین موجود همان ضخامت
   * @param {number|null} editId شناسهٔ قانون در حال ویرایش (از بررسی مستثنی)
   * @returns {object|null} قانونِ متعارض یا null
   */
  Rules.findOverlap = function (rule, existing, editId = null) {
    for (const other of existing) {
      if (editId !== null && other.id === editId) continue;
      if (other.thickness !== rule.thickness) continue;

      const overlaps =
        rule.minLength <= other.maxLength &&
        other.minLength <= rule.maxLength;

      if (overlaps) return other;
    }
    return null;
  };

  /**
   * اعتبارسنجی کامل پیش از ذخیره (ساختار + هم‌پوشانی).
   * خروجی: { ok } یا { ok:false, message, errors }
   */
  Rules.validateForSave = async function (input, editId = null) {
    // ۱) اعتبارسنجی ساختاری
    const structural = Rules.validateInput(input);
    if (!structural.ok) return { ok: false, errors: structural.errors, message: 'مقادیر قانون معتبر نیست.' };

    const rule = structural.rule;

    // ۲) اعتبارسنجی هم‌پوشانی — مرکزی و غیرقابل دور زدن (§18)
    const sameThickness = await db.standardLengthRules
      .where('thickness').equals(rule.thickness)
      .toArray();

    const overlap = Rules.findOverlap(rule, sameThickness, editId);
    if (overlap) {
      return {
        ok: false,
        message:
          `هم‌پوشانی بازه با قانون موجود (ضخامت ${U.faNum(overlap.thickness)}، ` +
          `${U.faNum(overlap.minLength)} تا ${U.faNum(overlap.maxLength)} → ${U.faNum(overlap.standardLength)})؛ ` +
          `بازه‌های یک ضخامت نباید هم‌پوشانی داشته باشند.`,
      };
    }

    return { ok: true, rule };
  };

  /* ---------------- عملیات CRUD ---------------- */

  /** ذخیرهٔ قانون جدید — تراکنشی (§14) */
  Rules.create = async function (input) {
    const check = await Rules.validateForSave(input);
    if (!check.ok) return check;

    const rule = {
      ...check.rule,
      createdAt: Date.now(),
    };
    const id = await db.transaction('rw', db.standardLengthRules, async () => {
      return db.standardLengthRules.add(rule);
    });
    return { ok: true, id };
  };

  /** ویرایش قانون — با اجرای مجدد تمام اعتبارسنجی‌ها */
  Rules.update = async function (id, input) {
    const check = await Rules.validateForSave(input, id);
    if (!check.ok) return check;

    await db.transaction('rw', db.standardLengthRules, async () => {
      await db.standardLengthRules.update(id, {
        ...check.rule,
        updatedAt: Date.now(),
      });
    });
    return { ok: true, id };
  };

  /** حذف قانون (رویداد UI باید تأیید بگیرد — §70) */
  Rules.remove = async function (id) {
    await db.transaction('rw', db.standardLengthRules, async () => {
      await db.standardLengthRules.delete(id);
    });
  };

  /* ---------------- موتور تطبیق متراژ استاندارد (§16-§17) ---------------- */

  /**
   * یافتن متراژ استاندارد یک رول بر اساس ضخامت + متراژ واقعی.
   * اگر هیچ قانونی پوشش ندهد → null (رول در تطبیق ستاپ شرکت نمی‌کند).
   */
  Rules.resolveStandardLength = function (rules, thickness, actualLength) {
    if (thickness === null || actualLength === null) return null;

    for (const rule of rules) {
      if (rule.thickness === thickness &&
          rule.minLength <= actualLength &&
          actualLength <= rule.maxLength) {
        return rule.standardLength;
      }
    }
    return null;
  };

  /** فهرست متراژهای استاندارد یکتای یک ضخامت (برای دراپ‌داون فرم ستاپ — §24) */
  Rules.standardLengthsFor = function (rules, thickness) {
    const set = new Set();
    for (const rule of rules) {
      if (rule.thickness === thickness) set.add(rule.standardLength);
    }
    return [...set].sort((a, b) => a - b);
  };

  RM.rulesEngine = Rules;
})();
