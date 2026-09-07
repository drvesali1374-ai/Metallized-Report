/* =========================================================================
   setups.js — موتور مدیریت ستاپ‌ها (§20-§30، §89-§91)
   -------------------------------------------------------------------------
   مدل ستاپ:
     { id, setupNumber, machineNumber(1|2|3), width, thickness,
       standardLength, rollCount, cuttingPattern, createdAt, updatedAt }

   قوانین حاکم:
     - کلید یکتا: عرض + شماره ستاپ + متراژ استاندارد + شماره دستگاه (§25)
     - ارث‌بری ضخامت: رکورد جدیدِ ستاپ موجود → ضخامت قفل (§22)
     - تغییر ضخامت در ویرایش → آبشار تراکنشی با تأیید کاربر (§23)
     - متراژ استاندارد فقط از قوانینِ همان ضخامت (§24)
     - دستگاه فقط ۱/۲/۳ — دستگاه متالایز (§21)
     - الگوی برش: مجموع ≤ عرض مادر (§27-§28)
   ========================================================================= */

'use strict';

(function () {
  const U = RM.utils;
  const R = RM.rulesEngine;
  const db = RM.db.db;

  const Setups = {};

  /* ---------------- الگوی برش (§27-§29) ---------------- */

  /**
   * تجزیهٔ الگوی برش: "1100-1170" → [1100, 1170]
   * ارقام فارسی/لاتین پذیرفته می‌شوند (§95).
   * خروجی: { ok, parts, sum, message }
   */
  Setups.parsePattern = function (patternText) {
    const raw = String(patternText ?? '').trim();
    if (raw === '') return { ok: true, parts: [], sum: 0, message: '' };   // الگو اختیاری است

    const tokens = raw.split('-');
    const parts = [];

    for (const token of tokens) {
      const trimmed = token.trim();
      const num = U.parseNumber(trimmed);
      if (trimmed === '' || num === null || num <= 0) {
        return {
          ok: false, parts: [], sum: null,
          message: `بخش «${U.escapeHtml(U.truncate(trimmed || 'خالی', 12))}» در الگوی برش عدد معتبر و مثبت نیست.`,
        };
      }
      parts.push(Math.round(num * 100) / 100);   // حذف خطای اعشار شناور
    }

    const sum = parts.reduce((a, b) => a + b, 0);
    return { ok: true, parts, sum, message: '' };
  };

  /**
   * اعتبارسنجی الگو نسبت به عرض مادر (§28).
   * قانون: PatternSum <= MotherWidth (کمتر مجاز — پرت عرض).
   */
  Setups.validatePattern = function (patternText, motherWidth) {
    const parsed = Setups.parsePattern(patternText);
    if (!parsed.ok) return parsed;
    if (!parsed.parts.length) return { ok: true, parts: [], sum: 0, message: '' };

    if (motherWidth === null || motherWidth === undefined || !(motherWidth > 0)) {
      return { ok: false, parts: parsed.parts, sum: parsed.sum, message: 'ابتدا عرض رول مادر را وارد کنید.' };
    }

    if (parsed.sum > motherWidth) {
      return {
        ok: false, parts: parsed.parts, sum: parsed.sum,
        message: `مجموع عرض الگوی برش (${U.faWidth(parsed.sum)}) بیشتر از عرض رول مادر (${U.faWidth(motherWidth)}) است.`,
      };
    }

    return { ok: true, parts: parsed.parts, sum: parsed.sum, message: '' };
  };

  /* ---------------- نرمال‌سازی الگو برای کلید یکتا (ترتیب‌آگنوستیک) ---------------- */

  /**
   * کلید نرمال‌شدهٔ الگوی برش — ترتیب قطعات در یکسان‌بودن الگوها بی‌اثر است
   * (مقایسه به‌صورت Multiset):
   *   "1200-1050" و "1050-1200" → "1050-1200"
   *   "800-930-930" ، "930-800-930" و "930-930-800" → "800-930-930"
   * الگوهای واقعاً متفاوت کلیدهای متفاوت می‌سازند.
   * الگوی خالی → "" (بدون الگو).
   */
  Setups.normalizePatternKey = function (patternText) {
    const parsed = Setups.parsePattern(patternText);
    if (!parsed.ok || !parsed.parts.length) return '';
    return [...parsed.parts].sort((a, b) => a - b).join('-');
  };

  /* ---------------- ساخت کلید یکتا (§25 + الگوی برش) ---------------- */

  /**
   * کلید یکتای ستاپ: عرض + شماره ستاپ + متراژ استاندارد + شماره دستگاه
   * + الگوی نرمال‌شدهٔ برش (ترتیب قطعات مهم نیست).
   */
  Setups.uniqueKey = function (setup) {
    const patternKey = Setups.normalizePatternKey(setup.cuttingPattern);
    return `${setup.width}-${setup.setupNumber}-${setup.standardLength}-${setup.machineNumber}-${patternKey}`;
  };

  /* ---------------- اعتبارسنجی کامل فرم (§26) ---------------- */

  /**
   * اعتبارسنجی کامل ورودی ستاپ (ایجاد و ویرایش).
   * @param {object} input        مقادیر خام فرم
   * @param {object} rules        قوانین متراژ موجود
   * @param {Array}  allSetups    تمام ستاپ‌های موجود
   * @param {number|null} editId  شناسهٔ رکورد در حال ویرایش (در بررسی یکتایی مستثنی)
   * @param {object}  options     { allowThicknessChange } — در ویرایش، تغییر ضخامت
   *                               با آبشار مجاز است (§23) و قفل ارث‌بری (§22) اعمال نمی‌شود
   * خروجی: { ok } یا { ok:false, errors:{field:msg}, message }
   */
  Setups.validate = function (input, rules, allSetups, editId = null, options = {}) {
    const errors = {};

    /* --- شماره ستاپ: عدد صحیح نامنفی (§96) --- */
    const setupNumber = U.parseInt(input.setupNumber);
    if (setupNumber === null || setupNumber < 0) {
      errors.setupNumber = 'شماره ستاپ باید عدد صحیح و نامنفی باشد.';
    }

    /* --- شماره دستگاه: فقط ۱/۲/۳ (§21) --- */
    const machineNumber = U.parseInt(input.machineNumber);
    if (!RM.config.VALID_MACHINES.includes(machineNumber)) {
      errors.machineNumber = 'شماره دستگاه باید ۱، ۲ یا ۳ باشد (دستگاه‌های متالایز).';
    }

    /* --- عرض رول مادر: عدد مثبت --- */
    const width = U.parseNumber(input.width);
    if (width === null || width <= 0) {
      errors.width = 'عرض رول مادر باید عددی بزرگ‌تر از صفر باشد.';
    }

    /* --- ضخامت + ارث‌بری (§22) --- */
    const thickness = U.parseNumber(input.thickness);
    if (thickness === null || thickness <= 0) {
      errors.thickness = 'ضخامت باید عددی مثبت (میکرون) باشد.';
    } else if (!options.allowThicknessChange) {
      // در ثبت جدید: ضخامت ستاپ موجود به ارث می‌رسد و قفل است (§22)
      const sameSetup = allSetups.filter(
        (s) => s.setupNumber === setupNumber && (editId === null || s.id !== editId)
      );
      if (sameSetup.length && sameSetup.some((s) => s.thickness !== null && s.thickness !== thickness)) {
        errors.thickness = `ضخامت ستاپ ${U.faNum(setupNumber)} قبلاً ${U.faNum(sameSetup[0].thickness)} تعیین شده و باید یکسان باشد (ارث‌بری ضخامت).`;
      }
    }

    /* --- متراژ استاندارد: فقط از قوانین همان ضخامت (§24) --- */
    const standardLength = U.parseNumber(input.standardLength);
    if (standardLength === null) {
      errors.standardLength = 'متراژ استاندارد را انتخاب کنید.';
    } else if (thickness !== null && !R.standardLengthsFor(rules, thickness).includes(standardLength)) {
      const available = R.standardLengthsFor(rules, thickness);
      errors.standardLength = available.length
        ? 'متراژ استاندارد انتخابی در قوانین این ضخامت تعریف نشده است.'
        : 'برای این ضخامت هنوز قانون متراژی تعریف نشده — ابتدا در تنظیمات قانون تعریف کنید.';
    }

    /* --- تعداد رول: عدد صحیح ≥ ۱ (§49) --- */
    const rollCount = U.parseInt(input.rollCount);
    if (rollCount === null || rollCount < 1) {
      errors.rollCount = 'تعداد رول باید عدد صحیح و حداقل ۱ باشد.';
    }

    /* --- الگوی برش (§27-§28) --- */
    const patternResult = Setups.validatePattern(input.cuttingPattern, width);
    if (!patternResult.ok) {
      errors.cuttingPattern = patternResult.message;
    }

    if (Object.keys(errors).length) {
      return { ok: false, errors, message: 'لطفاً خطاهای فرم را برطرف کنید.' };
    }

    const record = {
      setupNumber,
      machineNumber,
      width,
      thickness,
      standardLength,
      rollCount,
      cuttingPattern: String(input.cuttingPattern ?? '').trim() || null,
    };

    /* --- کلید یکتا (§25 + الگو) — الگو با ترتیب بی‌اثر --- */
    const duplicate = allSetups.find(
      (s) => (editId === null || s.id !== editId) && Setups.uniqueKey(s) === Setups.uniqueKey(record)
    );
    if (duplicate) {
      return {
        ok: false,
        errors: { machineNumber: 'ترکیب عرض + شماره ستاپ + متراژ استاندارد + دستگاه + الگوی برش تکراری است.' },
        message:
          `کلید «${U.faWidth(width)}-${U.faNum(setupNumber)}-${U.faNum(standardLength)}-${U.faNum(machineNumber)}-${U.escapeHtml(Setups.normalizePatternKey(record.cuttingPattern) || 'بدون الگو')}» ` +
          `قبلاً ثبت شده است (ترتیب قطعات الگو در یکتایی بی‌اثر است).`,
      };
    }

    return { ok: true, record };
  };

  /* ---------------- عملیات CRUD ---------------- */

  /** ایجاد رکورد جدید — تراکنشی (§14) */
  Setups.create = async function (input) {
    const [rules, allSetups] = await Promise.all([
      db.standardLengthRules.toArray(),
      db.setupRolls.toArray(),
    ]);

    const check = Setups.validate(input, rules, allSetups);
    if (!check.ok) return check;

    const record = { ...check.record, createdAt: Date.now(), updatedAt: Date.now() };
    const id = await db.transaction('rw', db.setupRolls, async () => {
      return db.setupRolls.add(record);
    });
    return { ok: true, id };
  };

  /**
   * ویرایش رکورد (§23، §26).
   * اگر ضخامت تغییر کند و رکوردهای دیگری با همین شماره ستاپ وجود داشته باشد،
   * کاربر باید تأیید کند (waterfall) — این تابع فقط پس از تأیید فراخوانی شود.
   * UI وظیفهٔ گرفتن تأیید و گزارش تعداد رکوردهای متأثر را دارد (cascadeInfo).
   */
  Setups.update = async function (id, input, options = {}) {
    const [rules, allSetups] = await Promise.all([
      db.standardLengthRules.toArray(),
      db.setupRolls.toArray(),
    ]);

    const check = Setups.validate(input, rules, allSetups, id, { allowThicknessChange: true });
    if (!check.ok) return check;

    const existing = allSetups.find((s) => s.id === id);
    if (!existing) return { ok: false, message: 'رکورد موردنظر یافت نشد.' };

    const newRecord = { ...check.record, createdAt: existing.createdAt, updatedAt: Date.now() };

    // حذف پرچم قدیمی پس از تکمیل ویرایش
    if ('legacy' in newRecord) delete newRecord.legacy;

    await db.transaction('rw', db.setupRolls, async () => {
      await db.setupRolls.update(id, newRecord);

      // آبشار ضخامت به سایر رکوردهای همان شماره ستاپ (§23) — تراکنشی
      const others = allSetups.filter((s) => s.id !== id && s.setupNumber === newRecord.setupNumber);
      for (const other of others) {
        if (other.thickness !== newRecord.thickness) {
          const patched = { ...other, thickness: newRecord.thickness, updatedAt: Date.now() };
          if ('legacy' in patched) delete patched.legacy;
          await db.setupRolls.update(other.id, patched);
        }
      }
    });

    return { ok: true, id, cascaded: options.cascadedCount || 0 };
  };

  /** اطلاعات آبشار تغییر ضخامت: چند رکورد دیگر تغییر می‌کنند؟ (برای پیام تأیید §23) */
  Setups.cascadeInfo = function (id, newThickness) {
    return db.transaction('r', db.setupRolls, async () => {
      const all = await db.setupRolls.toArray();
      const target = all.find((s) => s.id === id);
      if (!target) return { affected: 0, setupNumber: null };

      const affected = all.filter(
        (s) => s.id !== id &&
              s.setupNumber === target.setupNumber &&
              s.thickness !== newThickness
      ).length;
      return { affected, setupNumber: target.setupNumber };
    });
  };

  /** حذف رکورد (تأیید در UI — §70) */
  Setups.remove = async function (id) {
    await db.transaction('rw', db.setupRolls, async () => {
      await db.setupRolls.delete(id);
    });
  };

  /** مجموع تعداد رول‌های همهٔ ستاپ‌ها (§57) */
  Setups.totalRollCount = function (setups) {
    return setups.reduce((sum, s) => sum + (s.rollCount || 0), 0);
  };

  /* ================================================================
     ثبت گروهی از Clipboard — Bulk Paste (TSV)
     ----------------------------------------------------------------
     ساختار ورودی — هر «جفت خط» یک ست دست تولید می‌کند:

       خط فرد (الگو):   عرض‌های الگو ... [سلول‌های خالی] ... تعداد رول
       خط زوج (مادر):   عرض رول‌های مادر — هر سلول غیرخالی، گروه جدید
                        شروع می‌کند؛ سلول خالی یعنی ادامهٔ مادر قبلی.
                        هر قطعهٔ الگو به مادر متناظر خودش متصل می‌شود.

     الگوها می‌توانند یک‌تکه، دو‌تکه یا چندتکه باشند.

     جریان (قابل ویرایش پس از تحلیل):
       ۱) buildBulkDraft    — تجزیهٔ متن + تجمیع هم‌کلیدها → پیش‌نویس رکوردها
       ۲) پیش‌نمایش UI      — کاربر فیلدهای سراسری (شماره ستاپ/ضخامت) و
                              فیلدهای هر رکورد (دستگاه/متراژ استاندارد/
                              عرض مادر/الگو/تعداد) را ویرایش می‌کند
       ۳) validateBulkDraft — اعتبارسنجی با همان منطق ثبت دستی (§26)
       ۴) commitBulkDraft   — ثبت همهٔ رکوردها در یک تراکنش واحد
     ================================================================ */

  /**
   * تجزیهٔ متن Paste شده به رکوردهای ساختاری (بدون اعتبارسنجی منطقی).
   * خروجی: { pairs, structureErrors }
   *   pairs: [{ pairIndex, lineNos, rollCountToken, rollCount, groups: [{ motherToken, parts: [token] }] }]
   */
  Setups.parseBulkText = function (text) {
    const rawLines = String(text ?? '').replace(/\r/g, '').split('\n');
    const cells = rawLines.map((l) => l.split('\t'));

    // اندیس خطوط دارای محتوا (خط کاملاً خالی نادیده گرفته می‌شود)
    const contentIdx = [];
    cells.forEach((row, i) => {
      if (row.some((c) => String(c).trim() !== '')) contentIdx.push(i);
    });

    const pairs = [];
    const structureErrors = [];

    for (let p = 0; p < contentIdx.length; p += 2) {
      const patternLine = contentIdx[p];
      const motherLine = contentIdx[p + 1];          // undefined → خط مادر غایب
      const patternCells = cells[patternLine];
      const motherCells = motherLine !== undefined ? cells[motherLine] : [];
      const pairIndex = pairs.length + 1;

      // --- آخرین سلول غیرخالیِ خط الگو = تعداد رول ---
      let countIdx = -1;
      for (let i = patternCells.length - 1; i >= 0; i--) {
        if (String(patternCells[i] ?? '').trim() !== '') { countIdx = i; break; }
      }
      if (countIdx <= 0) {
        structureErrors.push({ pairIndex, message: `جفت ${U.faNum(pairIndex)}: خط الگو ساختار معتبری ندارد (عرض الگو یا تعداد رول یافت نشد).` });
        continue;
      }

      const rollCountToken = String(patternCells[countIdx]).trim();

      // --- سلول‌های مادر غیرخالی (فقط تا اندیس تعداد) — شروع گروه ---
      const motherStarts = new Map();   // اندیس ستون → توکن عرض مادر
      const limit = Math.min(motherCells.length, countIdx);
      for (let i = 0; i < limit; i++) {
        const t = String(motherCells[i] ?? '').trim();
        if (t !== '') motherStarts.set(i, t);
      }

      // --- گروه‌بندی قطعات الگو زیر مادر متناظر ---
      const groups = [];
      let current = null;
      let orphanParts = 0;

      for (let i = 0; i < countIdx; i++) {
        const t = String(patternCells[i] ?? '').trim();
        if (t === '') continue;

        if (motherStarts.has(i)) {
          current = { motherToken: motherStarts.get(i), parts: [] };
          groups.push(current);
        }
        if (current === null) {
          orphanParts++;
          continue;
        }
        current.parts.push(t);
      }

      /* --- ادغام گروه‌های یکسان (مادر + الگوی هم‌ارزش): چند مادرِ یکسان در یک
             خط یعنی تکرار همان ستاپ؛ تعداد رول نهایی = تعداد رول × دفعات.
             این ادغام با کلید یکتای ستاپ (§25 + الگو) سازگار است. --- */
      const merged = new Map();   // motherToken|الگوی‌نرمال → گروه + دفعات
      const mergedGroups = [];
      for (const g of groups) {
        const normKey = g.motherToken + '|' +
          g.parts.map((p) => U.parseNumber(p)).sort((a, b) => a - b).join('-');
        if (merged.has(normKey)) {
          merged.get(normKey).occurrences++;
        } else {
          const entry = { motherToken: g.motherToken, parts: g.parts, occurrences: 1 };
          merged.set(normKey, entry);
          mergedGroups.push(entry);
        }
      }

      if (motherLine === undefined) {
        structureErrors.push({
          pairIndex,
          message: `جفت ${U.faNum(pairIndex)}: خط رول مادر متناظر برای خط الگو وجود ندارد.`,
        });
      }
      if (orphanParts > 0) {
        structureErrors.push({
          pairIndex,
          message: `جفت ${U.faNum(pairIndex)}: ${U.faNum(orphanParts)} قطعهٔ الگو در ابتدای خط مادر قرار ندارند و رول مادر متناظری ندارند.`,
        });
      }

      pairs.push({
        pairIndex,
        lineNos: { pattern: patternLine + 1, mother: motherLine !== undefined ? motherLine + 1 : null },
        rollCountToken,
        rollCount: U.parseInt(rollCountToken),
        groups: mergedGroups,
      });
    }

    return { pairs, structureErrors };
  };

  /** فیلدهای سراسری Batch — خطاهایشان یک‌بار در سطح Batch گزارش می‌شوند */
  Setups.BULK_GLOBAL_FIELDS = ['setupNumber', 'thickness'];

  /**
   * ساخت پیش‌نویس رکوردهای Bulk از متن Paste‌شده (بدون اعتبارسنجی منطقی).
   * تجمیع سراسری بر اساس کلید یکتا (مادر + الگوی نرمال): چند مادرِ یکسان
   * یعنی تکرار همان ستاپ؛ تعداد رول انباشته می‌شود (سازگار با §25 + الگو).
   * commonInit: مقادیر اولیهٔ دستگاه/متراژ استاندارد ردیف‌ها (از فرم دستی).
   * خروجی: { drafts, structureErrors }
   *   drafts: [{ motherToken, patternText, rollCount, occurrences, pairs,
   *              machineNumber, standardLength }]
   */
  Setups.buildBulkDraft = function (commonInit, bulkText) {
    const parsed = Setups.parseBulkText(bulkText);
    const initMachine = String(commonInit.machineNumber ?? '');
    const initStandard = String(commonInit.standardLength ?? '');

    const aggregate = new Map();   // normKey → رکورد تجمیعی
    for (const pair of parsed.pairs) {
      for (const group of pair.groups) {
        const normKey = group.motherToken + '|' +
          group.parts.map((p) => U.parseNumber(p)).sort((a, b) => a - b).join('-');

        let agg = aggregate.get(normKey);
        if (!agg) {
          agg = {
            motherToken: group.motherToken,
            patternText: group.parts.join('-'),
            pairs: [],
            occurrences: 0,
            rollCount: 0,
            countInvalid: false,       // تعداد رولِ نامعتبر در یکی از جفت‌ها
            countToken: null,
          };
          aggregate.set(normKey, agg);
        }
        agg.pairs.push(pair.pairIndex);
        agg.occurrences += group.occurrences || 1;
        if (pair.rollCount === null) {
          agg.countInvalid = true;
          agg.countToken = pair.rollCountToken;
        } else {
          agg.rollCount += pair.rollCount * (group.occurrences || 1);
        }
      }
    }

    const drafts = [...aggregate.values()].map((agg) => ({
      motherToken: agg.motherToken,
      patternText: agg.patternText,
      rollCount: agg.countInvalid ? null : agg.rollCount,
      occurrences: agg.occurrences,
      pairs: agg.pairs,
      machineNumber: initMachine,          // قابل ویرایش در هر رکورد
      standardLength: initStandard,        // قابل ویرایش در هر رکورد
    }));

    return { drafts, structureErrors: parsed.structureErrors };
  };

  /**
   * اعتبارسنجی پیش‌نویس Bulk — دقیقاً همان منطق ثبت دستی (§26).
   * @param {object} common   { setupNumber, thickness } — سراسری برای کل Batch
   * @param {Array}  drafts   پیش‌نویس‌های (احتمالاً ویرایش‌شدهٔ) رکوردها
   * خروجی: { ok, globalErrors, records, total }
   *   globalErrors: خطاهای فیلدهای سراسری (یک‌بار)
   *   records[i]:   { ...draft, errors: [msgs], record? } — record وقتی معتبر
   */
  Setups.validateBulkDraft = async function (common, drafts) {
    const [rules, allSetups] = await Promise.all([
      db.standardLengthRules.toArray(),
      db.setupRolls.toArray(),
    ]);

    const working = [...allSetups];
    const globalErrors = {};
    const records = [];

    // ضخامت معتبر اما بدون قانون متراژ → خطای سراسری (نه تکرار در همهٔ ردیف‌ها)
    const commonThickness = U.parseNumber(common.thickness);
    if (commonThickness !== null && !R.standardLengthsFor(rules, commonThickness).length) {
      globalErrors.thickness = 'برای این ضخامت قانون متراژی تعریف نشده — ابتدا در تنظیمات قانون اضافه کنید.';
    }

    for (const draft of drafts) {
      const input = {
        setupNumber: common.setupNumber,
        machineNumber: draft.machineNumber,
        thickness: common.thickness,
        standardLength: draft.standardLength,
        width: draft.motherToken,
        rollCount: draft.rollCount === null ? '' : String(draft.rollCount),
        cuttingPattern: draft.patternText,
      };

      const check = Setups.validate(input, rules, working);
      const row = { ...draft, errors: [] };

      if (check.ok) {
        working.push(check.record);
        row.record = check.record;
      } else {
        for (const [field, msg] of Object.entries(check.errors)) {
          if (Setups.BULK_GLOBAL_FIELDS.includes(field)) {
            if (!globalErrors[field]) globalErrors[field] = msg;   // یک‌بار در سطح Batch
          } else if (field === 'standardLength' && globalErrors.thickness) {
            // ریشهٔ خطای متراژ، ضخامت نامعتبر سراسری است — همان گزارش می‌شود
            continue;
          } else {
            row.errors.push(msg);
          }
        }
      }
      records.push(row);
    }

    const ok =
      records.length > 0 &&
      Object.keys(globalErrors).length === 0 &&
      records.every((r) => !r.errors.length && r.record);

    return { ok, globalErrors, records, total: records.length };
  };

  /**
   * Commit پیش‌نویس — همه یا هیچ: اگر حتی یک رکورد خطا داشته باشد
   * هیچ رکوردی ثبت نمی‌شود؛ در غیر این صورت همه در یک تراکنش واحد
   * ذخیره می‌شوند (بدون Batch نیمه‌کاره).
   */
  Setups.commitBulkDraft = async function (common, drafts) {
    const check = await Setups.validateBulkDraft(common, drafts);
    if (!check.ok) return check;

    const now = Date.now();
    const ids = await db.transaction('rw', db.setupRolls, async () => {
      return db.setupRolls.bulkAdd(
        check.records.map((r) => ({ ...r.record, createdAt: now, updatedAt: now }))
      );
    });

    return { ok: true, ids, count: check.records.length, records: check.records };
  };

  RM.setupEngine = Setups;
})();
