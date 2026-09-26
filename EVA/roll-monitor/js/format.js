/* =========================================================================
   format.js — قالب‌بندی فارسی اعداد/وزن/زمان (پورت کامل lib/eva/format.ts)
   ========================================================================= */
(function () {
  'use strict';

  /** تبدیل ارقام لاتین به فارسی */
  function toFaDigits(s) {
    return String(s).replace(/\d/g, function (d) {
      return '۰۱۲۳۴۵۶۷۸۹'[Number(d)];
    });
  }

  /** تبدیل ارقام فارسی (۰-۹) و عربی (٠-٩) به لاتین */
  function toLatinDigits(s) {
    return String(s == null ? '' : s)
      .replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); })
      .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); });
  }

  /** عدد صحیح با جداکنندهٔ هزارگان فارسی — ۱۲۳۴۵۶۷ → ۱٬۲۳۴٬۵۶۷ */
  function faInt(n) {
    if (n === null || n === undefined || !Number.isFinite(n)) return '—';
    return toFaDigits(Math.trunc(n).toLocaleString('en-US')).replace(/,/g, '٬');
  }

  /** عدد اعشاری با حداکثر رقم اعشار مشخص + جداکنندهٔ هزارگان فارسی */
  function faNum(n, maxFractionDigits) {
    if (maxFractionDigits === undefined) maxFractionDigits = 2;
    if (n === null || n === undefined || !Number.isFinite(n)) return '—';
    var fixed = Number(n.toFixed(maxFractionDigits));
    var parts = String(fixed).split('.');
    var intPart = parts[0];
    var frac = parts[1];
    var intFa = toFaDigits(Number(intPart).toLocaleString('en-US')).replace(/,/g, '٬');
    return frac ? intFa + '٫' + toFaDigits(frac) : intFa;
  }

  /** وزن (کیلوگرم) — دو رقم اعشار */
  function faWeight(n) {
    if (n === null || n === undefined || !Number.isFinite(n)) return '—';
    return faNum(n, 2) + ' کیلوگرم';
  }

  /** وزن کوتاه بدون واحد */
  function faWeightShort(n) {
    return faNum(n, 2);
  }

  /** سال — عدد صحیح بدون جداکنندهٔ هزارگان (۱۴۰۵ و نه ۱٬۴۰۵) */
  function faYear(n) {
    if (n === null || n === undefined || !Number.isFinite(n)) return '—';
    return toFaDigits(Math.trunc(n));
  }

  /** مانده زمان — «۲ روز و ۵ ساعت» */
  function faDuration(days, hoursPerDay) {
    if (hoursPerDay === undefined) hoursPerDay = 24;
    if (days === null || days === undefined || !Number.isFinite(days)) return '—';
    var totalHours = days * hoursPerDay;
    var d = Math.floor(days);
    var h = Math.round(totalHours - d * hoursPerDay);
    if (d === 0 && h === 0) return '۰ ساعت';
    if (d === 0) return toFaDigits(h) + ' ساعت';
    if (h === 0) return toFaDigits(d) + ' روز';
    return toFaDigits(d) + ' روز و ' + toFaDigits(h) + ' ساعت';
  }

  /** ساعت با یک رقم اعشار */
  function faHours(hours) {
    if (hours === null || hours === undefined || !Number.isFinite(hours)) return '—';
    return faNum(hours, 1) + ' ساعت';
  }

  /** روز با دو رقم اعشار */
  function faDays(days) {
    if (days === null || days === undefined || !Number.isFinite(days)) return '—';
    return faNum(days, 2) + ' روز';
  }

  /** تاریخ و ساعت ذخیره‌شده (ISO) → نمایش شمسی-گونهٔ خوانا (ویرگول فارسی) */
  function faDateTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    try {
      var date = new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      return date.format(d).replace(/,\s*/, '، ');
    } catch (e) {
      return String(iso);
    }
  }

  /** تاریخ شمسی YYYY-MM-DD با ارقام لاتین — برای نام فایل پشتیبان */
  function jalaliFileStamp(date) {
    if (!date) date = new Date();
    var parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    var digits = function (type) {
      var p = parts.find(function (x) { return x.type === type; });
      return (p ? p.value : '').replace(/\D+/g, '');
    };
    var y = digits('year');
    var m = digits('month').padStart(2, '0');
    var d = digits('day').padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  window.Fmt = {
    toFaDigits: toFaDigits,
    toLatinDigits: toLatinDigits,
    faInt: faInt,
    faNum: faNum,
    faWeight: faWeight,
    faWeightShort: faWeightShort,
    faYear: faYear,
    faDuration: faDuration,
    faHours: faHours,
    faDays: faDays,
    faDateTime: faDateTime,
    jalaliFileStamp: jalaliFileStamp,
  };
})();
