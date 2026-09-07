/* =========================================================================
   calc.js — موتور محاسبهٔ مرکزی (Calculation Engine) ⭐
   -------------------------------------------------------------------------
   این تنها منبع محاسباتی کل سیستم است (Single Source of Truth — §53، §79،
   §105). هیچ نما (Dashboard، Setup، Raw Rolls) منطق محاسبهٔ خودش را ندارد.

   خط لولهٔ محاسبه (§54):
     Raw Excel (نرمال‌شده)
        ↓  قوانین متراژ استاندارد → استانداردسازی طول
     گروه‌بندی رول‌های خام (کلید ۳فاکتوری §40)
        ↓
     متالایز یونیک از آرشیو (§7)
        ↓
     تطبیق با ستاپ‌ها + تخصیص ظرفیت‌محور (§42-§44)
        ↓
     گزارش ستاپ + هشدارها + خلاصهٔ داشبورد
   -------------------------------------------------------------------------
   خروجی calculateProductionState():
     {
       rawRollGroups,      گروه‌های رول خام (§33)
       metallizedGroups,   گروه‌های متالایز (کلید ۲فاکتوری §41)
       setupReport,        گزارش هر ستاپ (§46-§50)
       warnings,           هشدارهای مرکزی کیفیت داده (§52)
       summary             خلاصهٔ KPI داشبورد (§57-§59)
     }
   ========================================================================= */

'use strict';

(function () {
  const U = RM.utils;
  const N = RM.normalize;
  const R = RM.rulesEngine;
  const DB = RM.db;

  const Calc = { _cached: null, _dirty: true };

  /* ================================================================
     ۱) استانداردسازی + گروه‌بندی رول‌های خام (§33، §40)
     ================================================================ */

  /**
   * گروه‌بندی رول‌های خام فعلی بر اساس کلید ۳فاکتوری:
   *     عرض + متراژ استاندارد + شماره ستاپ
   * رول‌هایی که قانون متراژی ندارند با standardLength=null گروه می‌شوند
   * و در تطبیق ستاپ شرکت نمی‌کنند (§17) اما دیده می‌شوند (شفافیت).
   */
  function buildRawRollGroups(rawRolls, rules) {
    const groups = new Map();   // key → group object
    const noRuleCount = { count: 0 };   // رول‌های بدون قانون متراژ

    for (const roll of rawRolls) {
      // متراژ استاندارد از قوانین (§19)
      const standardLength = R.resolveStandardLength(rules, roll.thickness, roll.actualLength);
      if (standardLength === null) noRuleCount.count++;

      const key = U.formatKey(roll.width, standardLength, roll.setupNumber);
      let group = groups.get(key);

      if (!group) {
        group = {
          key,
          width: roll.width,
          standardLength,
          setupNumber: roll.setupNumber,
          thickness: roll.thickness,
          count: 0,
          rollNumbers: [],        // برای Audit و پیش‌نمایش
          rollIds: [],            // شناسه‌های رکوردها — برای جزئیات گروه (§7 اصلاحات)
          hasRule: standardLength !== null,
          matched: false,         // پس از ساخت نمایهٔ ستاپ‌ها تکمیل می‌شود
        };
        groups.set(key, group);
      }

      group.count++;
      if (group.rollNumbers.length < 500) group.rollNumbers.push(roll.rollNumber);
      group.rollIds.push(roll.id);
    }

    return { groups: [...groups.values()], noRuleCount: noRuleCount.count };
  }

  /* ================================================================
     ۲) متالایز یونیک از آرشیو (§7، §41، §48)
     ================================================================ */

  /**
   * استخراج رول‌های خام متالایز شده:
     - فقط رکوردهای دارای R/r
     - یونیک بر اساس شماره رول (هر رول فقط یک‌بار — §7)
     - گروه‌بندی با کلید ۲فاکتوری: عرض + شماره ستاپ (§41)
   * توجه: از شماره رول برای استخراج بخش قبل از M استفاده نمی‌شود (§7).
   */
  function buildMetallizedGroups(archivedRolls) {
    const uniqueByRollNumber = new Map();   // rollNumber → رکورد یونیک

    for (const roll of archivedRolls) {
      if (!N.hasR(roll.filmType)) continue;
      const rn = String(roll.rollNumber ?? '').trim();
      if (rn === '') continue;
      if (!uniqueByRollNumber.has(rn)) {
        uniqueByRollNumber.set(rn, roll);   // اولین رخورد کافی است (یونیک‌سازی)
      }
    }

    // گروه‌بندی ۲فاکتوری
    const groups = new Map();
    for (const roll of uniqueByRollNumber.values()) {
      const key = U.formatKey(roll.width, roll.setupNumber);
      let group = groups.get(key);
      if (!group) {
        group = { key, width: roll.width, setupNumber: roll.setupNumber, count: 0, rollNumbers: [] };
        groups.set(key, group);
      }
      group.count++;
      if (group.rollNumbers.length < 500) group.rollNumbers.push(roll.rollNumber);
    }

    return {
      uniqueCount: uniqueByRollNumber.size,
      uniqueRecords: [...uniqueByRollNumber.values()],   // برای Drill-down مازاد متالایز
      groups: [...groups.values()],
    };
  }

  /* ================================================================
     ۳) موتور تخصیص ظرفیت‌محور (§42-§44)
     ================================================================ */

  /**
   * تخصیص رول‌های موجود (خام یا متالایز) به ستاپ‌های دارای کلید مشترک.
   *
   * الگوریتم (§43):
   *   ۱) ستاپ‌های دارای کلید را بر اساس rollCount صعودی مرتب کن
   *   ۲) به‌ترتیب، هر ستاپ تا سقف ظرفیت خودش رول بگیرد (Greedy ASC)
   *   ۳) هر رول فقط به یک ستاپ تخصیص می‌یابد (بدون شمارش مضاعف — §88)
   *   ۴) مازاد → Unallocated و در هشدارها گزارش می‌شود (§44)
   *
   * اگر مجموع ظرفیت < تعداد رول‌ها → مازاد تخصیص‌نیافته برمی‌گردد.
   *
   * @param {number} available        تعداد رول در دسترس برای این کلید
   * @param {Array}  candidateSetups  ستاپ‌های دارای کلید مشترک
   * @returns {Map} setupId → allocated، به‌همراه unallocated
   */
  function allocateByKey(available, candidateSetups) {
    // مرتب‌سازی صعودی بر اساس ظرفیت (§43) — پایدار برای تساوی‌ها
    const sorted = [...candidateSetups].sort((a, b) =>
      a.rollCount - b.rollCount || a.id - b.id
    );

    let remaining = available;
    const allocation = new Map();   // setupId → { allocated, capacity }

    for (const setup of sorted) {
      const capacity = setup.rollCount;
      // ظرفیت منفی امکان‌پذیر نیست (اعتبارسنجی ورود) اما محافظ works
      const granted = Math.max(0, Math.min(capacity, remaining));
      allocation.set(setup.id, { allocated: granted, capacity });
      remaining -= granted;
      if (remaining <= 0) break;
    }

    // ستاپ‌هایی که به دلیل break حلقه تخصیص نگرفتند
    for (const setup of sorted) {
      if (!allocation.has(setup.id)) {
        allocation.set(setup.id, { allocated: 0, capacity: setup.rollCount });
      }
    }

    return { allocation, unallocated: Math.max(0, remaining) };
  }

  /* ================================================================
     ۴-ب) گزارش رول‌های برش‌خورده (فرزند) — کلید: عرض برش + شماره ستاپ
     ================================================================ */

  /**
   * ساخت گزارش رول‌های برش‌خورده از دو منبع:
   *
   *  ۱) «رول‌های موجود» — رکوردهایی که شناسهٔ رولشان مشخصهٔ بازو (L/R)
   *     بعد از M دارد (N.isCutRoll)؛ کلید هر رکورد: cutWidth + setupNumber.
   *     شمارش‌ها: موجود، گریدهای X/U/Q/T، پای کار (موقعیت فعلی)، پالت شده.
   *
   *  ۲) «گزارش تولید ستاپ‌ها» — تنوع عرض‌های الگوی برش هر ستاپ، مبنای
   *     رکوردهای جدول است:
   *       مقدار در ستاپ   = Σ (تعداد تکرار عرض در الگو × ستون «تعداد»)
   *       مقدار برش‌نخورده = Σ (تعداد تکرار عرض در الگو × ستون «برش‌نشده»)
   *     روی همهٔ رکوردهای گزارش با همان شماره ستاپ.
   *
   *  وزن هر مقدار = عرض × ۰٫۳۶۲ × تعداد (ضریب ثابت — config.CUT_WEIGHT_PER_MM).
   */
  function buildCutRollsReport(rolls, setupReport) {
    const GRADES = RM.config.GRADE_LETTERS;
    const W_PER_MM = RM.config.CUT_WEIGHT_PER_MM;

    /* --- ۱) نمایهٔ رول‌های برش‌خوردهٔ موجود (بر کلید عرض + ستاپ) --- */
    const cutIndex = new Map();   // key → bucket
    let cutTotal = 0;
    let cutUnmatchable = 0;       // برش‌خورده بدون عرض/ستاپ — در هیچ رکوردی نمی‌نشیند

    for (const roll of rolls) {
      if (!N.isCutRoll(roll)) continue;
      cutTotal++;
      if (roll.cutWidth === null || roll.setupNumber === null) {
        cutUnmatchable++;
        continue;
      }
      const key = U.formatKey(roll.cutWidth, roll.setupNumber);
      let bucket = cutIndex.get(key);
      if (!bucket) {
        bucket = {
          count: 0,
          grades: { X: 0, U: 0, Q: 0, T: 0 },
          endCount: 0,
          palletCount: 0,
          rollIds: [],
        };
        cutIndex.set(key, bucket);
      }
      bucket.count++;
      const g = N.gradeLetter(roll);
      if (g) bucket.grades[g]++;
      if (N.isEndOfLine(roll)) bucket.endCount++;
      if (!N.isEmptyPallet(roll.palletNumber)) bucket.palletCount++;
      if (bucket.rollIds.length < 2000) bucket.rollIds.push(roll.id);
    }

    /* --- ۲) رکوردهای جدول از تنوع عرض‌های الگوی برش ستاپ‌ها --- */
    const recordsMap = new Map();   // key → record

    for (const sr of setupReport) {
      if (sr.setupNumber === null) continue;
      const parsed = RM.setupEngine.parsePattern(sr.cuttingPattern);
      if (!parsed.ok || !parsed.parts.length) continue;

      for (const part of parsed.parts) {
        const key = U.formatKey(part, sr.setupNumber);
        if (!recordsMap.has(key)) {
          recordsMap.set(key, {
            key,
            width: part,
            setupNumber: sr.setupNumber,
            existingCount: 0,
            inSetupCount: 0,
            uncutCount: 0,
            grades: { X: 0, U: 0, Q: 0, T: 0 },
            endCount: 0,
            palletCount: 0,
            matchedRollIds: [],
          });
        }
      }
    }

    /* --- ۳) محاسبهٔ «در ستاپ» و «برش‌نخورده» از رکوردهای گزارش ---
       برای هر کلید، روی همهٔ رکوردهای گزارش با همان شماره ستاپ:
       تعداد تکرار عرض در الگو × (تعداد | برش‌نشده) — جمع کل. */
    const setupsByNumber = new Map();   // setupNumber → [report rows]
    for (const sr of setupReport) {
      if (sr.setupNumber === null) continue;
      if (!setupsByNumber.has(sr.setupNumber)) setupsByNumber.set(sr.setupNumber, []);
      setupsByNumber.get(sr.setupNumber).push(sr);
    }

    for (const record of recordsMap.values()) {
      const rows = setupsByNumber.get(record.setupNumber) || [];
      for (const sr of rows) {
        const parsed = RM.setupEngine.parsePattern(sr.cuttingPattern);
        if (!parsed.ok || !parsed.parts.length) continue;
        let occurrences = 0;
        for (const part of parsed.parts) {
          if (part === record.width) occurrences++;
        }
        if (occurrences === 0) continue;
        record.inSetupCount += occurrences * (sr.rollCount || 0);
        record.uncutCount += occurrences * (sr.uncut || 0);
      }

      /* --- ۴) پیوند با رول‌های موجود هم‌کلید (موجود/گرید/پای کار/پالت) --- */
      const bucket = cutIndex.get(record.key);
      if (bucket) {
        record.existingCount = bucket.count;
        record.grades = { ...bucket.grades };
        record.endCount = bucket.endCount;
        record.palletCount = bucket.palletCount;
        record.matchedRollIds = [...bucket.rollIds];
      }
    }

    /* --- ۵) رکوردهای برش‌خوردهٔ موجودِ خارج از ستاپ‌ها (حالت شفافیت) ---
       اگر رول برش‌خورده‌ای در فایل موجود با کلیدی باشد که هیچ الگویی نمی‌سازد،
       در آمار گزارش می‌ماند اما رکورد مستقل نمی‌سازد (تعریف رکورد = از ستاپ). */
    const records = [...recordsMap.values()];

    /* --- ۶) آمار کلی --- */
    const stats = {
      totalRecords: records.length,
      cutRollsFound: cutTotal,
      cutUnmatchable,
      totalExisting: records.reduce((s, r) => s + r.existingCount, 0),
      totalInSetup: records.reduce((s, r) => s + r.inSetupCount, 0),
      totalUncut: records.reduce((s, r) => s + r.uncutCount, 0),
    };

    // وزن دقیق هر رکورد (عرض × ۰٫۳۶۲ × تعداد) — مقدار عددی کامل
    const weightOf = (width, count) => width * W_PER_MM * count;
    for (const r of records) {
      // فیلدهای مسطح گریدها (برای مرتب‌سازی/فیلتر/نمای جدول)
      r.xCount = r.grades.X;
      r.uCount = r.grades.U;
      r.qCount = r.grades.Q;
      r.tCount = r.grades.T;

      r.existingWeight = weightOf(r.width, r.existingCount);
      r.inSetupWeight = weightOf(r.width, r.inSetupCount);
      r.uncutWeight = weightOf(r.width, r.uncutCount);
      r.gradeWeights = {
        X: weightOf(r.width, r.grades.X),
        U: weightOf(r.width, r.grades.U),
        Q: weightOf(r.width, r.grades.Q),
        T: weightOf(r.width, r.grades.T),
      };
      r.endWeight = weightOf(r.width, r.endCount);
      r.palletWeight = weightOf(r.width, r.palletCount);
    }

    return { records, stats, gradeLetters: GRADES };
  }

  /* ================================================================
     ۵) موتور محاسبهٔ اصلی — calculateProductionState (§53)
     ================================================================ */

  /**
   * محاسبهٔ وضعیت کامل تولید از تمام منابع داده.
   * این تابع تنها منبع حقیقت کل رابط کاربری است.
   */
  async function calculateProductionState() {
    const { rolls, archivedRolls, setupRolls, rules, importMetadata } = await DB.loadAllSources();

    /* --- قوانین زمان متالایز (تنظیمات — تغییرات جدید) --- */
    const timeRules = await DB.getSetting('machineTimeRules', []);

    /* --- ۱) رول‌های خام فعلی (§6: R/r + پالت خالی) --- */
    const rawRolls = rolls.filter(N.isRawRoll);

    /* --- ۲) گروه‌بندی خام (§33) --- */
    const { groups: rawRollGroups, noRuleCount } = buildRawRollGroups(rawRolls, rules);

    /* --- ۳) متالایز یونیک (§7) --- */
    const metallized = buildMetallizedGroups(archivedRolls);

    /* --- ۴) نمایه‌سازی گروه‌های خام برای تطبیق سریع (§56: Map) --- */
    const rawGroupIndex = new Map();
    for (const group of rawRollGroups) {
      if (group.hasRule) rawGroupIndex.set(group.key, group);
    }

    /* --- ۵) نمایهٔ ستاپ‌ها ---
       rawIndex:  کلید ۳فاکتوری → ستاپ‌های دارای آن کلید
       metIndex:  کلید ۲فاکتوری → ستاپ‌های دارای آن کلید           */
    const rawIndex = new Map();
    const metIndex = new Map();

    for (const setup of setupRolls) {
      // ستاپ ناقص (قدیمی/ناتمام) در تطبیق شرکت نمی‌کند (§25 کلید نیازمند داده کامل)
      const isComplete = setup.thickness !== null && setup.standardLength !== null;
      if (isComplete) {
        const rawKey = U.formatKey(setup.width, setup.standardLength, setup.setupNumber);
        if (!rawIndex.has(rawKey)) rawIndex.set(rawKey, []);
        rawIndex.get(rawKey).push(setup);

        const metKey = U.formatKey(setup.width, setup.setupNumber);
        if (!metIndex.has(metKey)) metIndex.set(metKey, []);
        metIndex.get(metKey).push(setup);
      }
    }

    // تکمیل پرچم «matched» گروه‌ها (وضعیت تطبیق — برای جدول و مرتب‌سازی وضعیت)
    for (const group of rawRollGroups) {
      group.matched = group.hasRule && rawIndex.has(group.key);
    }

    /* --- ۶) تخصیص رول‌های خام موجود به ستاپ‌ها (ظرفیت‌محور) ---
       هر گروه خام بین ماشین‌های دارای همان کلید ۳فاکتوری بر اساس ظرفیت
       توزیع می‌شود تا هیچ رولی دو ستاپ را تغذیه نکند (§88 — بدون شمارش مضاعف). */
    const rawAllocationBySetup = new Map();   // setupId → { allocated, capacity, audit }
    const rawUnallocatedTotal = { total: 0, keys: [] };

    for (const [key, group] of rawGroupIndex) {
      const candidates = rawIndex.get(key) || [];
      if (!candidates.length) continue;   // بدون ستاپ — در وضعیت گروه گزارش می‌شود

      const { allocation, unallocated } = allocateByKey(group.count, candidates);
      if (unallocated > 0) {
        rawUnallocatedTotal.total += unallocated;
        rawUnallocatedTotal.keys.push({ key, unallocated });
      }

      for (const [setupId, info] of allocation) {
        rawAllocationBySetup.set(setupId, {
          ...info,
          sourceKey: key,
          groupCount: group.count,
        });
      }
    }

    /* --- ۷) تخصیص متالایز به ستاپ‌ها (§42-§44 — کلید ۲فاکتوری) --- */
    const metAllocationBySetup = new Map();
    const metUnallocatedTotal = { total: 0, keys: [] };

    for (const [key, group] of metIndex) {
      const metGroup = metallized.groups.find((g) => g.key === key);
      const available = metGroup ? metGroup.count : 0;
      if (!available) continue;

      const { allocation, unallocated } = allocateByKey(available, group);
      if (unallocated > 0) {
        metUnallocatedTotal.total += unallocated;
        metUnallocatedTotal.keys.push({ key, unallocated, available });
      }

      for (const [setupId, info] of allocation) {
        metAllocationBySetup.set(setupId, {
          ...info,
          sourceKey: key,
          groupCount: available,
        });
      }
    }

    /* --- ۸) گزارش هر ستاپ (§46-§50) + ستون‌های مانده زمان (تغییرات جدید) --- */
    const setupReport = setupRolls.map((setup) => {
      const rawAlloc = rawAllocationBySetup.get(setup.id);
      const metAlloc = metAllocationBySetup.get(setup.id);

      const rawExisting = rawAlloc ? rawAlloc.allocated : 0;
      const metallizedAllocated = metAlloc ? metAlloc.allocated : 0;

      // فرمول اصلی (§50): Uncut = SetupCount - (RawExisting + Metallized)
      const uncutCalculated = setup.rollCount - (rawExisting + metallizedAllocated);

      /* --- استخراج مدت زمان از قوانین زمان (دستگاه + متراژ استاندارد) ---
         مانده زمان ستاپ = مدت زمان × تعداد
         مانده زمان تولید شده = مدت زمان × خام موجود
         بدون قانون مطابق → هر دو مقدار null (نمایش «—») */
      const timeRule = R.findTimeRule(timeRules, setup.machineNumber, setup.standardLength);
      const durationMin = timeRule ? timeRule.durationMin : null;
      const remainingSetupTime = durationMin !== null ? durationMin * setup.rollCount : null;
      const remainingProducedTime = durationMin !== null ? durationMin * rawExisting : null;

      return {
        ...setup,
        rawExisting,
        metallized: metallizedAllocated,
        uncutCalculated,                                  // مقدار خام (می‌تواند منفی باشد)
        uncut: Math.max(0, uncutCalculated),              // مقدار نمایش (§51، §86)
        conflict: uncutCalculated < 0 ? -uncutCalculated : 0,   // مغایرت ظرفیت (§86)
        timeRuleId: timeRule ? timeRule.id : null,
        durationMin,
        remainingSetupTime,
        remainingProducedTime,
        audit: {
          rawGroup: rawAlloc ? { key: rawAlloc.sourceKey, count: rawAlloc.groupCount } : null,
          metGroup: metAlloc ? { key: metAlloc.sourceKey, count: metAlloc.groupCount } : null,
          rawCapacity: rawAlloc ? rawAlloc.capacity : 0,
          metCapacity: metAlloc ? metAlloc.capacity : 0,
        },
      };
    });

    /* --- ۸-ب) گزارش رول‌های برش‌خورده (فرزند) — تغییرات جدید --- */
    const cutRolls = buildCutRollsReport(rolls, setupReport);

    /* --- ۹) هشدارهای مرکزی کیفیت داده (§52 + Drill-down) ---
       هر هشدار می‌تواند drill داشته باشد: { source, issue?, filter? }
       تا دقیقاً رکوردهای عامل همان هشدار در یک جدول با ستون‌های Mapping
       نمایش داده شوند (Summary → مشکل → رکوردهای عامل). */
    const warnings = [];

    /* --- ۹-ب) رکوردهای ستاپ بدون قانون زمان (تغییرات جدید) --- */
    if (setupRolls.length && timeRules.length) {
      const noTimeRule = setupReport.filter((r) => r.remainingSetupTime === null);
      if (noTimeRule.length) {
        warnings.push({
          type: 'no-time-rule',
          severity: 'warning',
          title: `${U.faNum(noTimeRule.length)} رکورد ستاپ قانون زمان متالایز ندارد`,
          detail: 'برای ترکیب دستگاه + متراژ استاندارد این رکوردها قانونی در تنظیمات تعریف نشده؛ ستون‌های «مانده زمان» برایشان محاسبه نمی‌شود.',
          action: 'settings',
          drill: { source: 'setups', filter: 'no-time-rule' },
        });
      }
    } else if (setupRolls.length && !timeRules.length) {
      warnings.push({
        type: 'no-time-rules-at-all',
        severity: 'warning',
        title: 'هیچ قانون زمان متالایزی تعریف نشده است',
        detail: 'برای محاسبهٔ «مانده زمان ستاپ/تولید شده» در گزارش ستاپ‌ها و داشبورد، برای هر دستگاه قانون زمان تعریف کنید.',
        action: 'settings',
      });
    }

    // الف) بدون قانون متراژ تعریف‌شده
    if (!rules.length) {
      warnings.push({
        type: 'no-rules',
        severity: 'error',
        title: 'هیچ قانون متراژ استانداردی تعریف نشده است',
        detail: 'بدون تعریف قوانین در تنظیمات، هیچ رولی استانداردسازی و با ستاپ‌ها تطبیق نمی‌شود.',
        action: 'settings',
      });
    }

    // ب) رول‌های خام بدون قانون پوشش‌دهنده (§17)
    if (noRuleCount > 0 && rules.length) {
      warnings.push({
        type: 'no-rule-coverage',
        severity: 'warning',
        title: `${U.faNum(noRuleCount)} رول خام قانون متراژی ندارد`,
        detail: 'متراژ واقعی این رول‌ها در بازهٔ هیچ قانونی برای ضخامتشان قرار نمی‌گیرد؛ با ستاپ‌ها تطبیق نمی‌شوند.',
        action: 'settings',
        drill: { source: 'rolls', filter: 'no-rule' },
      });
    }

    // ج) گروه‌های خام بدون ستاپ (§52)
    const unmatchedGroups = rawRollGroups.filter((g) => g.hasRule && !g.matched);
    if (unmatchedGroups.length) {
      warnings.push({
        type: 'no-setup',
        severity: 'warning',
        title: `${U.faNum(unmatchedGroups.length)} گروه رول خام بدون ستاپ`,
        detail: 'ترکیب عرض/متراژ استاندارد/ستاپ این گروه‌ها در هیچ ستاپی تعریف نشده است.',
        action: 'rolls',
        drill: { source: 'rolls', filter: 'group', groupKeys: unmatchedGroups.map((g) => g.key) },
      });
    }

    // د) مازاد متالایز تخصیص‌نیافته (§44)
    if (metUnallocatedTotal.total > 0) {
      warnings.push({
        type: 'metallized-surplus',
        severity: 'warning',
        title: `${U.faNum(metUnallocatedTotal.total)} رول متالایز تخصیص‌نیافته`,
        detail: 'تعداد متالایزهای یونیک بیش از مجموع ظرفیت ستاپ‌های دارای کلید مشابه است.',
        action: 'setup',
        drill: {
          source: 'archived',
          filter: 'metallized-unallocated',
          groupKeys: metUnallocatedTotal.keys.map((k) => k.key),
        },
      });
    }

    // هـ) رول‌های خام تخصیص‌نیافته (به دلیل ظرفیت)
    if (rawUnallocatedTotal.total > 0) {
      warnings.push({
        type: 'raw-surplus',
        severity: 'warning',
        title: `${U.faNum(rawUnallocatedTotal.total)} رول خام تخصیص‌نیافته`,
        detail: 'ظرفیت ستاپ‌های منطبق برای پوشش تمام رول‌های خام کافی نیست.',
        action: 'setup',
        drill: {
          source: 'rolls',
          filter: 'group',
          groupKeys: rawUnallocatedTotal.keys.map((k) => k.key),
        },
      });
    }

    // و) مغایرت ظرفیت در گزارش ستاپ (§86)
    const conflicts = setupReport.filter((r) => r.conflict > 0);
    if (conflicts.length) {
      warnings.push({
        type: 'capacity-conflict',
        severity: 'error',
        title: `${U.faNum(conflicts.length)} ستاپ با مغایرت ظرفیت`,
        detail: 'مجموع خام موجود + متالایزِ تخصیص‌یافته از تعداد رول ستاپ بیشتر است (در ستون برش‌نشده ستاره‌دار نمایش داده می‌شود).',
        action: 'setup',
        drill: { source: 'setups', filter: 'capacity-conflict' },
      });
    }

    // ز) ستاپ‌های ناقص قدیمی (پس از مهاجرت)
    const incomplete = setupRolls.filter((s) => s.thickness === null || s.standardLength === null);
    if (incomplete.length) {
      warnings.push({
        type: 'incomplete-setup',
        severity: 'warning',
        title: `${U.faNum(incomplete.length)} رکورد ستاپ ناقص`,
        detail: 'رکوردهای قدیمی فاقد ضخامت/متراژ استاندارد هستند؛ برای شرکت در محاسبات ویرایش و تکمیل شوند.',
        action: 'setup',
        drill: { source: 'setups', filter: 'incomplete' },
      });
    }

    // ح) هم‌پوشانی قوانین (دفاع مرکزی — در ذخیره مسدود است §18)
    const overlapPairs = [];
    const rulesByThickness = new Map();
    for (const rule of rules) {
      if (!rulesByThickness.has(rule.thickness)) rulesByThickness.set(rule.thickness, []);
      rulesByThickness.get(rule.thickness).push(rule);
    }
    for (const list of rulesByThickness.values()) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          if (R.findOverlap(list[i], [list[j]])) overlapPairs.push([list[i], list[j]]);
        }
      }
    }
    if (overlapPairs.length) {
      warnings.push({
        type: 'rule-overlap',
        severity: 'error',
        title: `${U.faNum(overlapPairs.length)} جفت قانون هم‌پوشان شناسایی شد`,
        detail: 'قوانین هم‌پوشان نباید ذخیره شوند؛ لطفاً بازبینی و اصلاح کنید.',
        action: 'settings',
        drill: { source: 'rules', filter: 'overlap', pairs: overlapPairs },
      });
    }

    // ط) داده‌های ناقص اکسل — به تفکیک Dataset و نوع نقص (هر کدام Drill-down مستقل)
    const DATASET_LABELS = RM.config.DATASET_LABELS;
    const ISSUE_META = [
      { issue: 'width',      label: 'بدون عرض' },
      { issue: 'length',     label: 'بدون متراژ' },
      { issue: 'thickness',  label: 'بدون ضخامت' },
      { issue: 'rollNumber', label: 'شماره رول نامعتبر (خالی)' },
      { issue: 'filmType',   label: 'نوع فیلم نامعتبر (خالی)' },
    ];
    const datasets = [
      { source: 'rolls', records: rolls },
      { source: 'archived', records: archivedRolls },
    ];
    for (const { source, records: dsRecords } of datasets) {
      for (const meta of ISSUE_META) {
        // رزولور مشترک نقص‌ها («length» → actualLength در مدل داخلی)
        const count = N.recordsWithIssue(dsRecords, meta.issue).length;
        if (count > 0) {
          warnings.push({
            type: `missing-${meta.issue}-${source}`,
            severity: 'warning',
            title: `${meta.label} (${DATASET_LABELS[source]}): ${U.faNum(count)}`,
            detail: 'رکوردهای عامل این هشدار قابل مشاهده‌اند — دکمهٔ «مشاهده» را بزنید.',
            action: 'import',
            drill: { source, issue: meta.issue },
          });
        }
      }
    }

    // ی) Mapping ناقص — فیلدهایی که کاربر تنظیم کرده اما ستونشان در فایل نبوده
    for (const meta of (importMetadata || [])) {
      const gaps = (meta && Array.isArray(meta.mappingGaps)) ? meta.mappingGaps : [];
      if (!gaps.length) continue;
      const fieldNames = gaps.map((g) => RM.config.FIELD_LABELS[g.field] || g.field).join('، ');
      warnings.push({
        type: `mapping-incomplete-${meta.target}`,
        severity: 'warning',
        title: `Mapping ناقص (${DATASET_LABELS[meta.target] || meta.target})`,
        detail: `ستون تنظیم‌شده برای فیلدهای ${fieldNames} در فایل «${U.truncate(meta.fileName || '', 30)}» یافت نشد؛ این فیلدها برای رکوردها مقدار ندارند.`,
        action: 'settings',
        drill: { source: meta.target, filter: 'all' },
      });
    }

    /* --- ۱۰) خلاصهٔ داشبورد (§57-§59 + زمان‌های متالایز — تغییرات جدید) --- */
    const totalSetupRolls = setupRolls.reduce((s, r) => s + (r.rollCount || 0), 0);
    const totalRawAllocated = [...rawAllocationBySetup.values()].reduce((s, a) => s + a.allocated, 0);
    const totalMetAllocated = [...metAllocationBySetup.values()].reduce((s, a) => s + a.allocated, 0);
    const totalUncut = setupReport.reduce((s, r) => s + r.uncut, 0);
    const totalConflict = setupReport.reduce((s, r) => s + r.conflict, 0);

    /* --- مانده زمان‌ها: کل + به تفکیک دستگاه (فقط رکوردهای دارای قانون) --- */
    const totalRemainingSetupTime = setupReport.reduce(
      (s, r) => s + (r.remainingSetupTime || 0), 0
    );
    const totalRemainingProducedTime = setupReport.reduce(
      (s, r) => s + (r.remainingProducedTime || 0), 0
    );
    const machineTime = {};
    let timeCovered = 0;
    let timeUncovered = 0;
    for (const r of setupReport) {
      if (r.remainingSetupTime === null) {
        if (r.thickness !== null && r.standardLength !== null) timeUncovered++;
        continue;
      }
      timeCovered++;
      const m = r.machineNumber;
      if (!machineTime[m]) machineTime[m] = { setup: 0, produced: 0, records: 0 };
      machineTime[m].setup += r.remainingSetupTime;
      machineTime[m].produced += r.remainingProducedTime || 0;
      machineTime[m].records++;
    }

    const summary = {
      rawRollsCount: rawRolls.length,           // کل رول‌های خام فعلی (§58)
      rawMatchedCount: totalRawAllocated,       // خامِ تطبیق‌شده با ستاپ‌ها
      metallizedCount: metallized.uniqueCount, // متالایز یونیک (§59)
      metallizedAllocated: totalMetAllocated,
      totalSetupRolls,                          // Σ تعداد ستاپ‌ها (§57)
      totalUncut,                               // Σ برش‌نشده نمایشی (§51)
      totalConflict,                            // Σ مغایرت ظرفیت (§86)
      rawUnallocated: rawUnallocatedTotal.total,
      metallizedUnallocated: metUnallocatedTotal.total,
      totalGroups: rawRollGroups.length,
      matchedGroups: rawRollGroups.length - unmatchedGroups.length,
      /* --- زمان متالایز (تغییرات جدید) --- */
      totalRemainingSetupTime,
      totalRemainingProducedTime,
      machineTime,
      timeRuleCoverage: { covered: timeCovered, uncovered: timeUncovered },
      timeRulesCount: timeRules.length,
      /* --- رول‌های برش‌خورده (تغییرات جدید) --- */
      cutRollsCount: cutRolls.stats.totalRecords,
      cutRollsFound: cutRolls.stats.cutRollsFound,
    };

    return {
      rawRollGroups,
      unmatchedGroups,
      metallizedGroups: metallized.groups,
      metallizedUniqueCount: metallized.uniqueCount,
      metallizedUniqueRecords: metallized.uniqueRecords,   // برای Drill-down مازاد متالایز
      setupReport,
      cutRolls,
      warnings,
      summary,
      meta: {
        rawUnallocatedKeys: rawUnallocatedTotal.keys,
        metUnallocatedKeys: metUnallocatedTotal.keys,
        noRuleCount,
        timeRules,
      },
    };
  }

  /* ================================================================
     ۵) مدیریت Cache (§55 — محاسبهٔ مجدد فقط در تغییر داده)
     ================================================================ */

  /** اعلام کثیف‌بودن Cache — پس از هر تغییر داده فراخوانی می‌شود */
  Calc.invalidate = function () {
    Calc._dirty = true;
  };

  /** دریافت وضعیت محاسبه‌شده (با Cache) */
  Calc.getState = async function () {
    if (Calc._dirty || !Calc._cached) {
      Calc._cached = await calculateProductionState();
      Calc._dirty = false;
    }
    return Calc._cached;
  };

  RM.calcEngine = Calc;
})();
