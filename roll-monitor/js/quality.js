/* =========================================================================
   quality.js — موتور کنترل‌های کیفیت دادهٔ رول‌ها (نسخهٔ ۲٫۷)
   -------------------------------------------------------------------------
   سه کنترل روی رکوردهای نرمال‌شدهٔ هر منبع (رول‌های موجود / آرشیو):

     کنترل ۱ — یکسانی ضخامت در ستاپ:
       هویت هر ستاپ = شماره ستاپ + سالن + سال (نه فقط شماره ستاپ!)
       زیرا ممکن است دو ستاپ ۱۳۰ با سال/سالن متفاوت تفاوت‌های اساسی داشته
       باشند و نباید یکی تلقی شوند. سالن و سال از شمارهٔ رول خوانده می‌شود:
         · شمارهٔ رول‌ها معمولاً با F یا K شروع می‌شوند
         · رقم اول بعد از F/K = شمارهٔ سالن  (K1400… → سالن ۱ · F2500… → سالن ۲)
         · رقم دوم بعد از F/K = سال ۱۴۰X     (K14… → ۱۴۰۴ · F25… → ۱۴۰۵)
       مبنا = ضخامتی که در همان ستاپ بیشترین تعداد را دارد؛ رول‌های منحرف
       به‌عنوان هشدار با جزئیات گزارش می‌شوند. اگر تساوی باشد (مثلاً ضخامت
       ۲۰ و ۳۰ هر کدام ۵ رول)، همهٔ رول‌های همان ستاپ هشدارند.

     کنترل ۲ — تطبیق M/R با نوع فیلم:
       شمارهٔ رول دارای M → نوع فیلم باید M داشته باشد؛
       شمارهٔ رول دارای R → نوع فیلم باید R داشته باشد.

     کنترل ۳ — بازوی برش بعد از M:
       در شمارهٔ رول‌های دارای M، بعد از M حداکثر یک بازوی برش (R یا L)
       مجاز است؛ بیشتر از یکی خطاست.
         K1400110101L4M121R2        → بعد از M فقط R2 ✓
         K2502610071R2M2111R211R2   → بعد از M دو بازو (R…R) ✕

   خروجی runControls(records) برای رندر مستقیم در نماها است؛
   رکوردهای بدون شمارهٔ ستاپ / بدون شمارهٔ رول در کنترل‌های وابسته
       بررسی نمی‌شوند (نقص‌شان در گزارشنمای Import جدا گزارش می‌شود).
   ========================================================================= */

'use strict';

(function () {
  const U = RM.utils;

  const Quality = {};

  /**
   * هویت سالن/سال از شمارهٔ رول (نکته‌های ۱ و ۲ کاربر).
   * خروجی: { hall, year } — هر دو null اگر الگو F/K+رقم+رقم نخورد.
   */
  Quality.parseRollIdentity = function (rollNumber) {
    const s = U.toLatinDigits(String(rollNumber ?? '')).trim().toUpperCase();
    const m = /^([FK])(\d)(\d)/.exec(s);
    if (!m) return { hall: null, year: null };
    const hall = U.parseInt(m[2]);
    const yearDigit = U.parseInt(m[3]);
    return { hall, year: yearDigit === null ? null : 1400 + yearDigit };
  };

  /**
   * اجرای هر سه کنترل روی رکوردهای نرمال‌شدهٔ یک منبع.
   * @param {Array} records  رکوردهای مدل داخلی (ایندکس‌دار؛ ویرایش‌ها اعمال‌شده)
   * @returns {{
   *   thickness: { warnings: Array, groups: number },
   *   filmMatch:  Array,
   *   arms:       Array,
   *   counts:     { thickness: number, filmMatch: number, arms: number }
   * }}
   *  thickness.warnings[i] = { record, setupNumber, hall, year, kind:'tie'|'deviant',
   *                            base?, countsTxt }
   *  filmMatch[i]  = { record, setupNumber, hall, year, issues:['M','R'] }
   *  arms[i]       = { record, setupNumber, hall, year, count, after }
   */
  Quality.runControls = function (records) {
    const recs = Array.isArray(records) ? records : [];
    const thickness = { warnings: [], groups: 0 };
    const filmMatch = [];
    const arms = [];

    /* ---------- کنترل ۱: ضخامت به تفکیک هویت ستاپ (ستاپ + سالن + سال) ---------- */
    const bySetup = new Map();
    for (const r of recs) {
      if (r.setupNumber === null || r.setupNumber === undefined) continue;   // بدون ستاپ → خارج از این کنترل
      const id = Quality.parseRollIdentity(r.rollNumber);
      const key = `${r.setupNumber}|${id.hall ?? '?'}|${id.year ?? '?'}`;
      if (!bySetup.has(key)) {
        bySetup.set(key, { setupNumber: r.setupNumber, hall: id.hall, year: id.year, rolls: [] });
      }
      bySetup.get(key).rolls.push(r);
    }

    for (const g of bySetup.values()) {
      // فقط رول‌های «دارای ضخامت» در تعیین مبنا مشارکت دارند (بدون ضخامت در
      // گزارشنمای Import جدا گزارش می‌شود)
      const withT = g.rolls.filter((r) => r.thickness !== null && r.thickness !== undefined);
      if (withT.length < 1) continue;

      const counts = new Map();
      for (const r of withT) counts.set(r.thickness, (counts.get(r.thickness) || 0) + 1);
      if (counts.size < 2) continue;   // تک‌ضخامتی (یا تک‌رول) → بدون هشدار

      thickness.groups++;
      const max = Math.max(...counts.values());
      const winners = [...counts.entries()].filter(([, c]) => c === max);
      const countsTxt = [...counts.entries()]
        .map(([t, c]) => `${U.faNumPlain(t)}×${U.faNumPlain(c)}`)
        .sort()
        .join('، ');

      if (winners.length > 1) {
        // تساوی → همهٔ رول‌های دارای ضخامتِ همین ستاپ هشدارند
        for (const r of withT) {
          thickness.warnings.push({
            record: r, setupNumber: g.setupNumber, hall: g.hall, year: g.year,
            kind: 'tie', countsTxt,
          });
        }
      } else {
        const base = winners[0][0];
        for (const r of withT) {
          if (r.thickness !== base) {
            thickness.warnings.push({
              record: r, setupNumber: g.setupNumber, hall: g.hall, year: g.year,
              kind: 'deviant', base, baseCount: max, countsTxt,
            });
          }
        }
      }
    }

    /* ---------- کنترل ۲: تطبیق M/R شمارهٔ رول با نوع فیلم ---------- */
    for (const r of recs) {
      const roll = String(r.rollNumber ?? '').trim();
      if (!roll) continue;   // بدون شمارهٔ رول → گزارشنمای Import
      const rollU = roll.toUpperCase();
      const filmU = String(r.filmType ?? '').trim().toUpperCase();

      const issues = [];
      if (rollU.includes('M') && !filmU.includes('M')) issues.push('M');
      if (rollU.includes('R') && !filmU.includes('R')) issues.push('R');
      if (issues.length) {
        const id = Quality.parseRollIdentity(r.rollNumber);
        filmMatch.push({ record: r, setupNumber: r.setupNumber ?? null, hall: id.hall, year: id.year, issues });
      }
    }

    /* ---------- کنترل ۳: حداکثر یک بازوی برش (R/L) بعد از M ---------- */
    for (const r of recs) {
      const roll = String(r.rollNumber ?? '').trim().toUpperCase();
      const mIdx = roll.indexOf('M');
      if (mIdx === -1) continue;   // بدون M → این کنترل تعریف نمی‌شود
      const after = roll.slice(mIdx + 1);
      const count = (after.match(/[LR]/g) || []).length;
      if (count > 1) {
        const id = Quality.parseRollIdentity(r.rollNumber);
        arms.push({ record: r, setupNumber: r.setupNumber ?? null, hall: id.hall, year: id.year, count, after });
      }
    }

    return {
      thickness,
      filmMatch,
      arms,
      counts: {
        thickness: thickness.warnings.length,
        filmMatch: filmMatch.length,
        arms: arms.length,
      },
    };
  };

  /** شرح فارسی هر مشکل (برای ستون «شرح» جداول کیفیت) */
  Quality.describeIssue = function (item, control) {
    if (control === 'thickness') {
      return item.kind === 'tie'
        ? `تساوی ضخامت‌ها در این ستاپ (${item.countsTxt}) — مبنا قابل تعیین نیست؛ همهٔ رول‌های همین ستاپ هشدارند`
        : `ضخامت ${U.faNumPlain(item.record.thickness)} ≠ مبنا ${U.faNumPlain(item.base)} (مبنا = پرتکرارِ همین ستاپ: ${item.countsTxt})`;
    }
    if (control === 'filmMatch') {
      const parts = item.issues.map((L) =>
        L === 'M'
          ? 'حرف M در شمارهٔ رول هست اما در نوع فیلم نیست'
          : 'حرف R در شمارهٔ رول هست اما در نوع فیلم نیست');
      return parts.join(' · ');
    }
    if (control === 'arms') {
      return `${U.faNumPlain(item.count)} بازوی برش (R/L) بعد از M — حداکثر ۱ بازو مجاز است (${item.after})`;
    }
    return '';
  };

  RM.quality = Quality;
})();
