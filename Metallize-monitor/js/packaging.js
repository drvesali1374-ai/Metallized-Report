/* =========================================================================
   packaging.js — موتور مرکزی صفحهٔ «بسته‌بندی» (نسخهٔ ۳٫۱۳)
   -------------------------------------------------------------------------
   منطق واحد و مرکزی برنامهٔ بسته‌بندی پالت‌ها — همهٔ بخش‌های UI صفحه
   (برنامهٔ بسته‌بندی، جدول پالت‌ها، جدول رول‌ها/ردیابی، هشدارها و آمار)
   فقط از خروجی همین موتور تغذیه می‌کنند (منطق مستقل per-view وجود ندارد).

   خط لوله (سند بسته‌بندی §۲۷):
     رکوردهای پالت (فیلتر M در Import) → استخراج قطر بوبین از «نوع بسته‌بندی»
     اکسل → تشخیص خط تولید (F=BOPP/K=CPP) → محاسبهٔ مستقل جهت/نوع بسته‌بندی
     و ظرفیت استاندارد (قوانین بوبین ۳/۶) → مقایسه با اکسل (هشدار مغایرت)
     → ظرفیت‌های هدف (بوبین ۶ = فقط استاندارد · بوبین ۳ استاندارد ۸: ۸→۷→۴→۳
     و استاندارد ۴: ۴→۳) → گروه‌بندی رول‌ها با پنج ویژگی سازگار (نوع فیلم،
     عرض، ضخامت، گرید، قطر بوبین) → بهینه‌سازی ترکیب پالت‌ها → بسته‌بندی
     نهایی + پالت‌های هر بسته (رول‌هایشان) + رول‌های باقی‌مانده + رول‌های رزرو.

   دامنهٔ داده (۳٫۱۳ — بند ۵ سند جدید):
     پالت‌هایی که مقدار «انبار» آنها شامل کلمهٔ «فروش» است (فروخته‌شده)
     همیشه از دادهٔ برنامه کنار گذاشته می‌شوند؛ همهٔ پالت‌های دیگر — چه
     «انبار …» و چه «پای کار …» — در برنامه مشارکت می‌کنند. پالت «پای کار»
     در سالن تولید است (در انبار نیست و نیازی به آوردن ندارد) — با
     PK.isBasePallet قابل تشخیص است و در خروجی‌ها نشان می‌گیرد.

   الگوریتم بهینه‌سازی (به‌ازای هر گروه ۵ویژگی، Deterministic):
     ۱) پالت‌های کامل (تعداد = ظرفیت استاندارد) → بستهٔ نهایی بدون اقدام.
     ۲) پالت‌های بیش از ظرفیت → مازاد جدا و به استخر رایگان (pool) می‌رود.
     ۳) پالت‌های ناقص به‌ترتیب نزولی تعداد رول (تساوی: شماره پالت صعودی):
        برای هر پالت، ظرفیت‌های هدف به «ترتیب اولویت» بررسی می‌شوند (مثال
        سند §۱۹: A=5,B=3,C=2 با هدف ۸ → A+3 از B = بستهٔ ۸تایی؛ سیر تا
        رسیدن به اولین هدفِ ممکن)؛ انتخاب اهداکننده‌ها با جست‌وجوی
        کمینه‌سازی (تعداد پالت‌های مشارکت‌کننده، سپس تعداد تقسیم پالت) و
        اولویتِ مصرف کامل پالت اهداکننده به‌جای تخلیهٔ جزئی.
     ۴) اگر هیچ هدفِ بالاتر ممکن نبود و تعداد فعلی خودِ یکی از اهداف باشد
        → بستهٔ «در ظرفیت هدف» بدون جابه‌جایی؛ در غیر این صورت (مثلاً ۵ یا
        ۶ رول در گروه استاندارد-۸) مازاد تا نزدیک‌ترین هدف پایین‌تر جدا
        می‌شود؛ اگر هیچ راهی نباشد → غیرقابل بسته‌بندی (باقی‌مانده).
     ۵) رول‌های باقی‌ماندهٔ هر گروه که ویژگی‌های همان گروه را دارند به‌عنوان
        «رول رزرو» همهٔ بسته‌های همان گروه معرفی می‌شوند (§۲۲).

   Traceability کامل: هر رول → پالت مبدأ → گروه → بسته‌بندی → نقش
   (اصلی/مکمل) → پالت مقصد (در صورت جابه‌جایی) → وضعیت نهایی.
   ========================================================================= */

'use strict';

(function () {
  const U = RM.utils;
  const P = RM.packaging = {};

  /* ================================================================
     ۱) استخراج قواعد هر پالت (§4-§11 سند)
     ================================================================ */

  /**
   * مشتق‌سازی کامل یک پالت از رکورد نرمال‌شدهٔ فایل مدیریت پالت‌ها.
   * خروجی: ویژگی‌های پالت + خط تولید + قطر بوبین + جهت + ظرفیت استاندارد
   * + ظرفیت‌های هدف (به ترتیب اولویت) + نوع بسته‌بندی محاسبه‌شده و پرچم
   * مغایرت با مقدار اکسل + علت مستثنا شدن (در صورت نامعتبر بودن).
   */
  P.derivePallet = function (record) {
    const R = RM.config.PALLET_RULES;

    const p = {
      record,
      palletId: record.palletId,
      palletNo: record.palletNo,
      filmType: record.filmType,
      thickness: record.thickness,
      width: record.width,
      grade: record.grade,
      packTypeExcel: record.packType,
      warehouse: record.warehouse,
      rolls: record.rolls,
      rollCount: record.rolls.length,

      line: null,          // 'BOPP' | 'CPP' | null
      diameter: null,      // 3 | 6 | null
      direction: null,     // 'H' | 'V'
      layers: null,        // تعداد طبقات (حداکثر مجاز)
      rollsPerLayer: null, // تعداد رول در طبقه (حداکثر مجاز)
      stdCapacity: null,   // تعداد رول استاندارد (Layers × PerLayer)
      targets: null,       // ظرفیت‌های هدف به ترتیب اولویت
      computedType: null,  // نوع بسته‌بندی محاسبه‌شده: 'H6' | 'V6' | 'V3'
      packTypeMismatch: false,
      excluded: null,      // 'invalidPack' | 'noWidth' | 'unknownLine' | null
    };

    /* --- خط تولید از اولین کاراکتر نوع فیلم (§5) --- */
    const first = U.toLatinDigits(String(record.filmType ?? '')).trim().charAt(0).toUpperCase();
    p.line = R.LINE_BY_FIRST_CHAR[first] || null;

    /* --- قطر بوبین از عدد انتهای «نوع بسته‌بندی» اکسل (§6) ---
       خالی/ناقص/بدون عدد قابل استخراج → نامعتبر → مستثنا (§7) */
    const m = /(\d+)$/.exec(String(record.packType ?? ''));
    const dia = m ? U.parseInt(m[1]) : null;
    if (dia === null || !R.VALID_DIAMETERS.includes(dia)) {
      p.excluded = 'invalidPack';
      return p;
    }
    p.diameter = dia;

    /* --- عرض نامشخص → ظرفیت قابل محاسبه نیست → مستثنا --- */
    if (record.width === null) {
      p.excluded = 'noWidth';
      return p;
    }

    if (dia === 3) {
      /* بوبین ۳ اینچ (§9): جهت همیشه V · عرض >= ۸۰۰ → ۱ طبقه × ۴ · کمتر → ۲ طبقه × ۴ */
      p.direction = 'V';
      p.computedType = 'V3';
      p.layers = record.width >= R.D3_WIDTH_LAYERS ? 1 : 2;
      p.rollsPerLayer = 4;
      p.stdCapacity = p.layers * p.rollsPerLayer;
      /* ظرفیت هدف (§14-§15): استاندارد ۸ → ۸،۷،۴،۳ · استاندارد ۴ → ۴،۳ */
      p.targets = (p.stdCapacity === 8 ? R.TARGETS_D3_STD8 : R.TARGETS_D3_STD4).slice();
    } else {
      /* بوبین ۶ اینچ (§10-§11): جهت و ظرفیت به خط تولید و عرض وابسته است */
      if (!p.line) {
        p.excluded = 'unknownLine';   // بدون خط تولید، قانون بوبین ۶ تعیین نمی‌شود
        return p;
      }
      if (p.line === 'BOPP') {
        if (record.width >= R.BOPP_D6_WIDTH) { p.direction = 'H'; p.computedType = 'H6'; }
        else { p.direction = 'V'; p.computedType = 'V6'; }
        p.layers = 2; p.rollsPerLayer = 1; p.stdCapacity = 2;
      } else {
        p.direction = 'H'; p.computedType = 'H6';
        if (record.width >= R.CPP_D6_WIDTH) { p.layers = 2; p.rollsPerLayer = 1; p.stdCapacity = 2; }
        else { p.layers = 2; p.rollsPerLayer = 2; p.stdCapacity = 4; }
      }
      /* ظرفیت هدف بوبین ۶ (§13): فقط ظرفیت استاندارد — اولویت پایین‌تر وجود ندارد */
      p.targets = [p.stdCapacity];
    }

    /* --- مقایسهٔ نوع بسته‌بندی اکسل با مقدار محاسبه‌شده (§6) --- */
    p.packTypeMismatch = String(record.packType ?? '') !== p.computedType;

    return p;
  };

  /** کلید گروه پنج‌ویژگی سازگار (§3): نوع فیلم | ضخامت | عرض | گرید | قطر بوبین */
  P.featureKey = function (p) {
    return `${p.filmType}|${p.thickness ?? ''}|${p.width}|${p.grade}|${p.diameter}`;
  };

  /* ================================================================
     ۱-ب) کلیدواژه‌های وضعیت انبار (۳٫۱۳ — بندهای ۳ و ۵ سند جدید)
     ================================================================ */

  /** نرمال‌سازی مقدار انبار برای تطبیق کلیدواژه: حذف فاصله/نیم‌فاصله */
  function warehouseKey(w) {
    return String(w ?? '').replace(/[\s\u200c]/g, '');
  }

  /** پالت فروخته‌شده — مقدار «انبار» شامل «فروش» است؛ همیشه از برنامه
   *  کنار گذاشته می‌شود (بند ۵ سند ۳٫۱۳). */
  P.isSoldPallet = function (warehouse) {
    return warehouseKey(warehouse).includes('فروش');
  };

  /** پالت «پای کار» — در سالن تولید و پای دستگاه است؛ در انبار نیست و
   *  نیازی به مرجوعی/آوردن ندارد (بند ۳ سند ۳٫۱۳). */
  P.isBasePallet = function (warehouse) {
    return warehouseKey(warehouse).includes('پایکار');
  };

  /* ================================================================
     ۲) انتخاب اهداکنندگان (§17-§18: امکان انتقال بخشی از پالت +
        کمینه‌سازی تعداد پالت‌های مشارکت‌کننده و تقسیم غیرضروری)
     ================================================================ */

  /**
   * تأمین `need` رول برای یک بسته‌بندی:
   *   ۱) ابتدا از استخر رول‌های آزاد (pool — مازادِ جدا شده از پالت‌های
   *      بیش‌ازظرفیت/تنزل‌یافته که باید به هر حال جابه‌جا شوند؛ استفاده از
   *      آنها پالت جدیدی وارد عملیات نمی‌کند).
   *   ۲) سپس انتخاب زیرمجموعه‌ای از پالت‌های ناقص با کمینه‌سازی ترتیبیِ
   *      (تعداد پالت‌های مشارکت‌کننده، تعداد پالت‌های «تقسیم‌شده») — با
   *      جست‌وجوی کامل برای گروه‌های معمول (<= ۱۲ کاندید) و ترجیح مصرف
   *      کامل پالت اهداکننده. خروجی null = تأمین ناممکن.
   */
  function chooseDonors(need, donorCands, pool) {
    const poolRolls = [];
    let rem = need;
    while (rem > 0 && pool.length > 0) {
      poolRolls.push(pool.shift());   // FIFO — قدیمی‌ترین رول آزادشده
      rem -= 1;
    }
    if (rem === 0) return { poolRolls, donorGives: [] };

    const cands = donorCands
      .filter((d) => d.curRolls.length > 0)
      .sort((a, b) => (b.curRolls.length - a.curRolls.length) ||
        (a.palletNo < b.palletNo ? -1 : a.palletNo > b.palletNo ? 1 : 0));
    if (!cands.length) return null;

    let best = null;
    if (cands.length <= 12) {
      const n = cands.length;
      for (let mask = 1; mask < (1 << n); mask++) {
        const sub = [];
        let sum = 0;
        for (let i = 0; i < n; i++) {
          if (mask & (1 << i)) { sub.push(cands[i]); sum += cands[i].curRolls.length; }
        }
        if (sum < rem) continue;

        /* تخصیص با ترجیح مصرف کامل: پالت‌های کوچک‌تر از باقیمانده کامل
           خالی می‌شوند؛ فقط آخرین اهداکننده در صورت لزوم جزئی تقسیم می‌شود */
        const gives = [];
        let r2 = rem;
        let splits = 0;
        for (const d of sub) {
          if (r2 === 0) break;
          const g = Math.min(d.curRolls.length, r2);
          if (g < d.curRolls.length) splits++;
          gives.push({ pallet: d, count: g });
          r2 -= g;
        }
        const cost = sub.length * 100 + splits;   // ترتیبی: اول تعداد پالت، بعد تقسیم
        if (best === null || cost < best.cost) best = { cost, gives };
      }
      if (best === null) return null;
      return { poolRolls, donorGives: best.gives };
    }

    /* گروه‌های خیلی بزرگ — جایگزین حریصانهٔ معادل (نزولی + مصرف کامل) */
    const gives = [];
    let r2 = rem;
    for (const d of cands) {
      if (r2 === 0) break;
      const g = Math.min(d.curRolls.length, r2);
      gives.push({ pallet: d, count: g });
      r2 -= g;
    }
    return r2 === 0 ? { poolRolls, donorGives: gives } : null;
  }

  /* ================================================================
     ۳) بهینه‌سازی یک گروه سازگار (§16-§20، §25)
     ================================================================ */

  /**
   * members: پالت‌های درون دامنه + معتبر + دارای رول، هم‌گروه (۵ ویژگی یکسان).
   * خروجی: بسته‌های این گروه به packages اضافه می‌شوند؛ وضعیت نهایی هر پالت
   * در p.planState ثبت می‌شود ('complete' | 'assembled' | 'as-is' |
   * 'downgraded' | 'donor-empty' | 'donor-partial' | 'unpacked').
   */
  function optimizeGroup(groupKey, members, packages) {
    for (const p of members) {
      p.curRolls = p.rollObjs.slice();
      p.planState = null;
      p.donatedOut = false;
      p.shedCount = 0;
    }

    /* استخر رول‌های آزاد (مازاد بیش‌ازظرفیت / تنزل هدف) */
    const pool = [];

    /* --- گام ۱: بیش از ظرفیت (§8: طبقه/رول حداکثر مجازند) → مازاد جدا می‌شود --- */
    for (const p of members) {
      if (p.curRolls.length > p.stdCapacity) {
        const excess = p.curRolls.length - p.stdCapacity;
        for (let i = 0; i < excess; i++) pool.push(p.curRolls.pop());
        p.shedCount = excess;
        p.planState = 'complete';
      }
    }

    /* --- گام ۲: پالت‌های کامل → بستهٔ نهایی بدون اقدام --- */
    for (const p of members) {
      if (!p.planState && p.curRolls.length === p.stdCapacity) p.planState = 'complete';
    }

    /* --- گام ۳: پالت‌های ناقص — نزولی تعداد رول (تساوی: شماره پالت) --- */
    let partials = members.filter(
      (p) => !p.planState && p.curRolls.length > 0 && p.curRolls.length < p.stdCapacity
    );
    partials.sort((a, b) => (b.curRolls.length - a.curRolls.length) ||
      (a.palletNo < b.palletNo ? -1 : a.palletNo > b.palletNo ? 1 : 0));

    const makePackage = (main, target, complementRolls, type, moves) => {
      packages.push({
        groupKey,
        filmType: main.filmType,
        thickness: main.thickness,
        width: main.width,
        grade: main.grade,
        diameter: main.diameter,
        line: main.line,
        computedType: main.computedType,
        stdCapacity: main.stdCapacity,
        layers: main.layers,
        rollsPerLayer: main.rollsPerLayer,
        direction: main.direction,
        target,
        finalCount: target,
        type,                 // 'assembled' | 'as-is' | 'downgraded'
        moves,
        main,
        mainPalletNo: main.palletNo,
        mainWarehouse: main.warehouse,
        mainRolls: main.curRolls.slice(),
        complementRolls,
        recallPallets: [],    // پس از جذب رول‌ها پر می‌شود
        reserveRolls: [],     // پس از فاز رزرو پر می‌شود
      });
      if (type === 'as-is') main.planState = 'as-is';
      else main.planState = type;   // 'assembled' | 'downgraded'
    };

    let idx = 0;
    while (idx < partials.length) {
      const main = partials[idx];
      const donorCands = partials.slice(idx + 1);

      /* ظرفیت‌های هدف به ترتیب اولویت (§13-§15) — اولین هدفِ ممکن انتخاب می‌شود */
      let chosen = null;
      for (const t of main.targets) {
        if (t < main.curRolls.length) continue;
        const need = t - main.curRolls.length;
        const avail = pool.length +
          donorCands.reduce((s, d) => s + d.curRolls.length, 0);
        if (need > avail) continue;
        const sel = chooseDonors(need, donorCands, pool);
        if (sel === null) continue;
        chosen = { t, sel };
        break;
      }

      if (chosen) {
        const complement = [];
        for (const robj of chosen.sel.poolRolls) {
          complement.push(robj);
          robj.movedToPalletNo = main.palletNo;
        }
        for (const give of chosen.sel.donorGives) {
          for (let i = 0; i < give.count; i++) {
            const robj = give.pallet.curRolls.pop();   // آخرین رول‌های پالت اهداکننده
            complement.push(robj);
            robj.movedToPalletNo = main.palletNo;
            give.pallet.donatedOut = true;
          }
        }
        makePackage(main, chosen.t, complement,
          complement.length ? 'assembled' : 'as-is', complement.length);
      } else if (main.targets.includes(main.curRolls.length)) {
        /* هیچ هدف بالاتر ممکن نیست ولی تعداد فعلی خودش یکی از اهداف است (§14) */
        makePackage(main, main.curRolls.length, [], 'as-is', 0);
      } else {
        /* تعداد فعلی هیچ هدفی نیست → جداکردن مازاد تا نزدیک‌ترین هدف پایین‌تر
           (مثال: ۵ یا ۶ رول در گروه استاندارد-۸ → ۴)؛ نبود هیچ هدفی → غیرقابل */
        let t2 = null;
        for (const t of main.targets) {
          if (t < main.curRolls.length && (t2 === null || t > t2)) t2 = t;
        }
        if (t2 !== null) {
          const shed = main.curRolls.length - t2;
          for (let i = 0; i < shed; i++) pool.push(main.curRolls.pop());
          main.shedCount += shed;
          makePackage(main, t2, [], 'downgraded', shed);
        } else {
          /* غیرقابل بسته‌بندی — مگر آنکه پیش‌تر اهداکنندهٔ جزئی بوده باشد */
          main.planState = main.donatedOut ? 'donor-partial' : 'unpacked';
        }
      }

      /* پالت‌های خالی‌شده از صف خارج می‌شوند؛ ترتیب اولیه حفظ می‌شود */
      partials = [main, ...partials.slice(idx + 1).filter((p) => p.curRolls.length > 0)];
      idx += 1;
    }

    /* --- وضعیت نهایی باقی‌مانده‌ها --- */
    for (const p of members) {
      if (p.planState) continue;
      if (p.curRolls.length === 0) p.planState = 'donor-empty';
      else p.planState = p.donatedOut ? 'donor-partial' : 'unpacked';
    }
    for (const robj of pool) robj.loose = true;   // مازاد بدون مقصد
    return pool;
  }

  /* ================================================================
     ۴) ساخت برنامهٔ کامل بسته‌بندی (منطق مرکزی — §27)
     ================================================================ */

  /**
   * @param {Array}  records  رکوردهای نرمال‌شدهٔ فایل پالت‌ها (db.pallets)
   * @returns  { pallets, packages, rollStates, warnings, stats, groups }
   *
   * ۳٫۱۳: پارامتر scope حذف شد — پالت‌های «فروش» همیشه کنار؛ بقیه همیشه
   * درون دامنه (چه انبار، چه پای کار).
   */
  P.buildPlan = function (records) {
    /* --- ۱) مشتق‌سازی همهٔ پالت‌ها + دامنه (۳٫۱۳: فقط فروش‌شده‌ها کنار) --- */
    const pallets = records.map((r) => P.derivePallet(r));
    for (const p of pallets) {
      p.sold = P.isSoldPallet(p.warehouse);
      p.atBase = P.isBasePallet(p.warehouse);   // «پای کار» — در سالن تولید
      p.inScope = !p.sold;
      p.groupKey = null;
      p.planState = null;
      p.palletStatus = p.excluded ? 'excluded'
        : p.rollCount === 0 ? 'empty'
        : p.rollCount > p.stdCapacity ? 'over'
        : p.rollCount === p.stdCapacity ? 'full' : 'partial';
    }

    /* --- ۲) هشدارهای داده‌ای صفحهٔ بسته‌بندی (§24 — در دامنهٔ فعلی) --- */
    const warningDefs = [
      { key: 'mismatch', label: 'مغایرت نوع بسته‌بندی', excludedOnly: false },
      { key: 'invalidPack', label: 'نوع بسته‌بندی نامعتبر یا قطر بوبین نامشخص', excludedOnly: true },
      { key: 'noWidth', label: 'عرض نامشخص', excludedOnly: true },
      { key: 'unknownLine', label: 'خط تولید نامشخص (بوبین ۶)', excludedOnly: true },
    ];
    const warnings = [];
    for (const def of warningDefs) {
      const list = pallets.filter((p) => p.inScope &&
        (def.key === 'mismatch' ? (p.packTypeMismatch && !p.excluded) : p.excluded === def.key));
      if (list.length) warnings.push({ key: def.key, label: def.label, pallets: list });
    }

    /* --- ۳) گروه‌بندی پنج‌ویژگی (§3) — فقط پالت‌های درون دامنهٔ معتبر با رول --- */
    /* رول‌ایجکت‌های ردیابی برای «همهٔ» پالت‌های درون دامنه ساخته می‌شود
       (پالت‌های مستثنا/خالی هم رول‌های خود را با وضعیت مربوط در جدول
       ردیابی نشان می‌دهند — §23). */
    const makeRollObj = (rn, p) => ({
      roll: rn,
      pallet: p,
      status: null,          // 'packed' | 'leftover' | 'reserve' | 'excluded'
      packageNo: null,
      role: null,            // 'main' | 'complement'
      movedToPalletNo: null,
      onCompletePallet: false,  // رول روی پالتِ کامل از قبل (بدون بستهٔ برنامه)
      loose: false,          // رول جدا‌شده از پالت مبدأ (مازاد) که مقصد نگرفته
      reserveFor: null,      // [شماره بسته‌های رزرو]
    });
    for (const p of pallets) {
      if (!p.inScope) continue;
      p.rollObjs = p.rolls.map((rn) => makeRollObj(rn, p));
    }

    const groups = [];
    const groupMap = new Map();
    for (const p of pallets) {
      if (!p.inScope || p.excluded || p.rollCount === 0) continue;
      const key = P.featureKey(p);
      p.groupKey = key;
      if (!groupMap.has(key)) {
        const g = { key, members: [], packages: [] };
        groupMap.set(key, g);
        groups.push(g);
      }
      groupMap.get(key).members.push(p);
    }
    groups.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

    /* --- ۴) بهینه‌سازی هر گروه --- */
    const packages = [];
    const looseRolls = [];
    for (const g of groups) {
      const pool = optimizeGroup(g.key, g.members, packages);
      g.packages = packages.filter((pkg) => pkg.groupKey === g.key);
      for (const robj of pool) looseRolls.push(robj);
    }

    /* --- ۵) شماره‌گذاری قطعی بسته‌ها (گروه، سپس شماره پالت اصلی) --- */
    packages.sort((a, b) => (a.groupKey < b.groupKey ? -1 : a.groupKey > b.groupKey ? 1 :
      a.mainPalletNo < b.mainPalletNo ? -1 : a.mainPalletNo > b.mainPalletNo ? 1 : 0));
    packages.forEach((pkg, i) => { pkg.no = i + 1; });

    /* --- ۶) وضعیت رول‌ها + رزرو (§21-§23) --- */
    const rollStates = [];

    /* رول‌های پالت‌های کامل (بستهٔ تمام‌شده از قبل — بدون بستهٔ برنامه):
       بسته‌بندی‌شده با نقش «اصلی» و بدون شماره بسته */
    for (const p of pallets) {
      if (!p.inScope || p.planState !== 'complete') continue;
      for (const robj of p.curRolls) {
        robj.status = 'packed';
        robj.role = 'main';
        robj.onCompletePallet = true;
      }
    }

    for (const pkg of packages) {
      for (const robj of pkg.mainRolls) {
        robj.status = 'packed'; robj.role = 'main'; robj.packageNo = pkg.no;
      }
      for (const robj of pkg.complementRolls) {
        robj.status = 'packed'; robj.role = 'complement'; robj.packageNo = pkg.no;
      }
      /* پالت‌های هر بسته (۳٫۱۳ — بندهای ۳/۴): پالت اصلی + پالت‌های مکمل
         (اهداکنندگان) به‌ترتیب شمارهٔ پالت؛ برای هر پالت، رول‌هایی که در
         این بسته شرکت می‌کنند + پرچم «پای کار». مبنای ستون «پالت‌های هر
         بسته»، ستون «رول‌های هر بسته»، خروجی اکسل و نمایش گرافیکی. */
      const donorsMap = new Map();
      for (const robj of pkg.complementRolls) {
        if (!donorsMap.has(robj.pallet)) donorsMap.set(robj.pallet, []);
        donorsMap.get(robj.pallet).push(robj);
      }
      pkg.palletParts = [
        {
          pallet: pkg.main, palletNo: pkg.mainPalletNo, warehouse: pkg.mainWarehouse,
          atBase: !!pkg.main.atBase, isMain: true, rolls: pkg.mainRolls,
        },
        ...[...donorsMap.entries()]
          .sort((a, b) => (a[0].palletNo < b[0].palletNo ? -1 : 1))
          .map(([pallet, rolls]) => ({
            pallet, palletNo: pallet.palletNo, warehouse: pallet.warehouse,
            atBase: !!pallet.atBase, isMain: false, rolls,
          })),
      ];
      /* آماری: پالت‌های مکمل درگیر (برای سازگاری) */
      pkg.recallPallets = pkg.palletParts
        .filter((x) => !x.isMain)
        .map((x) => ({ palletNo: x.palletNo, warehouse: x.warehouse, count: x.rolls.length }));
    }

    for (const g of groups) {
      /* باقی‌مانده‌های گروه = هر رولی که در هیچ بسته‌ای نیست (ماندهٔ پالت‌های
         اهداکنندهٔ جزئی، پالت‌های غیرقابل و رول‌های مازادِ بدون مقصد) */
      const leftovers = [];
      for (const p of g.members) {
        for (const robj of p.rollObjs) {
          if (robj.status === 'packed') continue;
          leftovers.push(robj);
        }
      }
      /* رزرو (§22): باقی‌مانده‌های هم‌گروه برای همهٔ بسته‌های همان گروه */
      if (leftovers.length && g.packages.length) {
        const nos = g.packages.map((pkg) => pkg.no);
        for (const robj of leftovers) {
          robj.status = 'reserve';
          robj.reserveFor = nos;
        }
        for (const pkg of g.packages) pkg.reserveRolls = leftovers.slice();
      } else {
        for (const robj of leftovers) robj.status = 'leftover';
      }
    }

    /* --- ۷) آرایهٔ ردیابی رول‌ها (همهٔ رول‌های درون دامنه) --- */
    for (const p of pallets) {
      if (!p.inScope) continue;
      for (const robj of p.rollObjs || []) {
        if (!robj.status) robj.status = p.excluded ? 'excluded' : 'leftover';
        rollStates.push(robj);
      }
    }

    /* --- ۸) آمار --- */
    /* پالت‌های درگیر بسته‌ها که در انبارند (نه «پای کار») و باید به ایستگاه
       بسته‌بندی آورده شوند (۳٫۱۳: شامل پالت اصلی + مکمل‌ها، بدون پای کار) */
    const recallSet = new Set();
    for (const pkg of packages) {
      for (const part of pkg.palletParts) {
        if (!part.atBase) recallSet.add(part.palletNo);
      }
    }
    const stats = {
      totalRecords: records.length,
      palletsTotal: pallets.length,
      inScope: pallets.filter((p) => p.inScope).length,
      soldPallets: pallets.filter((p) => p.sold).length,
      excluded: pallets.filter((p) => p.inScope && p.excluded).length,
      empty: pallets.filter((p) => p.inScope && !p.excluded && p.rollCount === 0).length,
      full: pallets.filter((p) => p.inScope && !p.excluded && p.palletStatus === 'full').length,
      over: pallets.filter((p) => p.inScope && !p.excluded && p.palletStatus === 'over').length,
      partial: pallets.filter((p) => p.inScope && !p.excluded && p.palletStatus === 'partial').length,
      groups: groups.length,
      packages: packages.length,
      packagesActionable: packages.filter((x) => x.type !== 'as-is').length,
      packagesAssembled: packages.filter((x) => x.type === 'assembled').length,
      packagesAsIs: packages.filter((x) => x.type === 'as-is').length,
      packagesDowngraded: packages.filter((x) => x.type === 'downgraded').length,
      completePallets: pallets.filter((p) => p.inScope && p.planState === 'complete').length,
      movesTotal: packages.reduce((s, x) => s + x.moves, 0),
      recallPalletCount: recallSet.size,
      unpackedPallets: pallets.filter((p) => p.inScope && p.planState === 'unpacked').length,
      donorEmptyPallets: pallets.filter((p) => p.inScope && p.planState === 'donor-empty').length,
      donorPartialPallets: pallets.filter((p) => p.inScope && p.planState === 'donor-partial').length,
      rollsInScope: rollStates.length,
      rollsPacked: rollStates.filter((r) => r.status === 'packed').length,
      rollsReserve: rollStates.filter((r) => r.status === 'reserve').length,
      rollsLeftover: rollStates.filter((r) => r.status === 'leftover').length,
      rollsExcluded: rollStates.filter((r) => r.status === 'excluded').length,
      mismatch: pallets.filter((p) => p.inScope && p.packTypeMismatch && !p.excluded).length,
    };

    return { pallets, groups, packages, rollStates, warnings, stats };
  };

  /* ================================================================
     ۵) برچسب‌های وضعیت (نمایش واحد در همهٔ بخش‌های صفحه)
     ================================================================ */

  P.PALLET_STATUS_LABELS = {
    excluded: 'مستثنا (دادهٔ نامعتبر)',
    empty: 'خالی',
    over: 'بیش از ظرفیت',
    full: 'کامل',
    partial: 'ناقص',
  };

  P.PLAN_STATE_LABELS = {
    complete: 'کامل — بدون نیاز به اقدام',
    assembled: 'پالت اصلی بستهٔ جدید',
    'as-is': 'در ظرفیت هدف — بدون جابه‌جایی',
    downgraded: 'بستهٔ با تخلیهٔ مازاد',
    'donor-empty': 'تخلیه‌شده (اهدای همهٔ رول‌ها)',
    'donor-partial': 'اهدای بخشی از رول‌ها',
    unpacked: 'غیرقابل بسته‌بندی (باقی‌مانده)',
  };

  P.ROLL_STATUS_LABELS = {
    packed: 'بسته‌بندی‌شده',
    reserve: 'رزرو',
    leftover: 'باقی‌مانده',
    excluded: 'مستثنا (پالت نامعتبر)',
  };

  P.PACKAGE_TYPE_LABELS = {
    assembled: 'تشکیل جدید',
    'as-is': 'در ظرفیت هدف',
    downgraded: 'تخلیهٔ مازاد تا هدف',
  };
})();
