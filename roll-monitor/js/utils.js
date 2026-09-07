/* =========================================================================
   utils.js — ابزارهای عمومی مشترک
   -------------------------------------------------------------------------
   شامل: نرمال‌سازی اعداد (فارسی/لاتین)، قالب‌بندی نمایش، Escape امن،
   هش FNV-1a برای شناسایی فایل، تاریخ شمسی و ابزارهای کوچک دیگر.
   ========================================================================= */

'use strict';

(function () {
  const U = {};

  /* ---------- ۱) تبدیل ارقام فارسی/عربی به لاتین (§94-95) ---------- */

  const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

  /** تبدیل تمام ارقام فارسی و عربی یک رشته به ارقام لاتین */
  U.toLatinDigits = function (str) {
    let out = String(str ?? '');
    for (let i = 0; i < 10; i++) {
      out = out.replaceAll(PERSIAN_DIGITS[i], String(i));
      out = out.replaceAll(ARABIC_DIGITS[i], String(i));
    }
    return out;
  };

  /* ---------- ۲) نرمال‌سازی اعداد (§94) ---------- */

  /**
   * تجزیهٔ امن مقادیر عددی از Excel یا ورودی کاربر.
   * مثال‌های پشتیبانی‌شده:  20 ، "20" ، "۲۰" ، "20,000" ، "۲۰٬۰۰۰" ، " 20 "
   * خروجی: عدد (در صورت موفقیت) و در غیر این صورت null.
   */
  U.parseNumber = function (value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;

    // تبدیل ارقام فارسی/عربی + حذف جداکننده‌های هزارگان و فاصله‌ها
    const cleaned = U.toLatinDigits(String(value))
      .replace(/[,\u066C\u2019\u066B\s]/g, '')   // کاما، جداکنندهٔ فارسی ٬، آپاستروف، فاصله
      .replace(/[\u200c\u200f\u200e\uFEFF]/g, ''); // کاراکترهای کنترلی RTL و نیم‌فاصله

    if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;

    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  };

  /** تجزیهٔ عدد صحیح (برای شماره ستاپ، تعداد و…) */
  U.parseInt = function (value) {
    const n = U.parseNumber(value);
    return n === null ? null : Math.trunc(n);
  };

  /* ---------- ۳) قالب‌بندی نمایش ---------- */

  /** نمایش عدد با ارقام فارسی و جداکنندهٔ هزارگان (null → «—») */
  U.faNum = function (n) {
    if (n === null || n === undefined || n === '') return '—';
    const num = Number(n);
    if (!Number.isFinite(num)) return '—';
    return num.toLocaleString('fa-IR');
  };

  /** نمایش عدد فارسی بدون جداکنندهٔ هزارگان */
  U.faNumPlain = function (n) {
    if (n === null || n === undefined || n === '') return '—';
    const num = Number(n);
    if (!Number.isFinite(num)) return '—';
    return num.toLocaleString('fa-IR', { useGrouping: false });
  };

  /**
   * قالب‌دهندهٔ مرکزی «عرض رول» — بدون جداکنندهٔ هزارگان.
   * مثال: 1200 → «۱۲۰۰» (نه «۱٬۲۰۰»).
   * فقط لایهٔ Presentation است؛ مقدار/نوع داده در محاسبات و
   * Storage بدون تغییر می‌ماند.
   */
  U.faWidth = function (n) {
    return U.faNumPlain(n);
  };

  /**
   * قالب‌دهندهٔ «وزن» رول‌های برش‌خورده — جداسازی سه‌رقمی با نقطه
   * (فرمت خواسته‌شدهٔ کاربر: 1235456 → «1.235.456» و 2316.8 → «2.316»).
   * جز اعشار برای نمایش حذف می‌شود (طبق مثال مرجع ۸۰۰×۰٫۳۶۲×۸ = «2.316»).
   * مقدار عددی دقیق در داده‌ها حفظ می‌شود — این فقط لایهٔ Presentation است.
   */
  U.faWeightDot = function (n) {
    if (n === null || n === undefined || n === '') return '—';
    const num = Number(n);
    if (!Number.isFinite(num)) return '—';
    const sign = num < 0 ? '-' : '';
    const int = Math.floor(Math.abs(num));
    return sign + String(int).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  /**
   * قالب‌دهندهٔ «مدت زمان» (دقیقه) — خوانا و فشرده:
   *   < 60  → «۴۵ دقیقه»
   *   ≥ 60  → «۵ ساعت» یا «۵ ساعت و ۳۰ دقیقه»
   * مقدار تهی → «—»
   */
  U.faDuration = function (minutes) {
    if (minutes === null || minutes === undefined) return '—';
    const m = Math.max(0, Math.round(Number(minutes)));
    if (!Number.isFinite(m)) return '—';
    if (m < 60) return `${U.faNumPlain(m)} دقیقه`;
    const hours = Math.floor(m / 60);
    const rem = m % 60;
    return rem > 0
      ? `${U.faNumPlain(hours)} ساعت و ${U.faNumPlain(rem)} دقیقه`
      : `${U.faNumPlain(hours)} ساعت`;
  };

  /** مقدار ساعتِ یک عدد دقیقه‌ای (برای کارت‌ها و چارت‌ها — گردشده) */
  U.hoursOf = function (minutes) {
    if (minutes === null || minutes === undefined) return null;
    return Math.round((Number(minutes) || 0) / 60);
  };

  /**
   * نمایش تاریخ/زمان از مقادیر اکسل برای جزئیات رکوردها.
   * سه حالت پشتیبانی می‌شود:
   *   ۱) رشتهٔ شمسی مثل «1405/05/25 10:06:38» → همان‌گونه نمایش
   *   ۲) رشتهٔ ISO/میلادی → تبدیل به تقویم شمسی (fa-IR)
   *   ۳) عدد سریال تاریخ اکسل → تبدیل و نمایش شمسی
   */
  U.faDateTime = function (value) {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'number' && Number.isFinite(value)) {
      // سریال تاریخ اکسل (روز از 1899-12-30) → 25569 = فاصله تا 1970-01-01
      const d = new Date(Math.round((value - 25569) * 86400000));
      return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fa-IR');
    }
    const s = String(value).trim();
    if (s === '') return '—';
    // رشتهٔ شمسی (سال ۱۳۰۰ تا ۱۴۹۹) — مستقیم نمایش داده می‌شود
    if (/^1[34]\d{2}[\/\-]/.test(s)) return s;
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('fa-IR');
    return s;
  };

  /** نمایش تاریخ و ساعت شمسی */
  U.faDate = function (ts) {
    try {
      return new Date(ts).toLocaleString('fa-IR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  /** نمایش تاریخ شمسی بدون ساعت */
  U.faDateOnly = function (ts) {
    try {
      return new Date(ts).toLocaleDateString('fa-IR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  /* ---------- ۴) امنیت: فرار دادن HTML (§73) ---------- */

  U.escapeHtml = function (value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  };

  /* ---------- ۵) نرمال‌سازی متن هدر ستون‌های اکسل ---------- */

  /**
   * حذف فاصله‌ها، نیم‌فاصله و کاراکترهای جهت‌دهی برای مقایسهٔ مطمئن عنوان ستون‌ها.
   * «نوع فیلم» ، «نوع‌فیلم» و «نوعفیلم» هم‌ارزش می‌شوند.
   */
  U.normalizeHeader = function (h) {
    return String(h ?? '')
      .replace(/[\s\u200c\u200f\u200e\uFEFF]/g, '')
      .trim();
  };

  /* ---------- ۶) هش FNV-1a برای شناسایی فایل (§12) ---------- */

  /**
   * هش ۳۲ بیتی FNV-1a روی ArrayBuffer — سبک، همگام و بدون نیاز به
   * crypto.subtle (که در برخی زمینه‌ها مثل file:// قدیمی در دسترس نیست).
   * برای تشخیص «فایل بدون تغییر» کاملاً کافی است.
   */
  U.hashBuffer = function (buffer) {
    const view = new Uint8Array(buffer);
    let hash = 0x811c9dc5;
    for (let i = 0; i < view.length; i++) {
      hash ^= view[i];
      hash = Math.imul(hash, 0x01000193) >>> 0;   // ضرب FNV با حفظ uint32
    }
    return ('00000000' + hash.toString(16)).slice(-8).toUpperCase();
  };

  /* ---------- ۷) ابزارهای کوچک ---------- */

  /** فرمت کلید گروه: «عرض-متراژ-ستاپ» */
  U.formatKey = (...parts) => parts.map((p) => (p === null || p === undefined ? 'null' : String(p))).join('-');

  /** قطع متن طولانی برای نمایش در جدول */
  U.truncate = function (text, max = 40) {
    const s = String(text ?? '');
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  };

  /** مقایسهٔ عددی امن برای مرتب‌سازی (null در انتها) */
  U.compareNumeric = function (a, b, direction = 'asc') {
    const na = a === null || a === undefined || a === '—' ? null : Number(a);
    const nb = b === null || b === undefined || b === '—' ? null : Number(b);
    let result = 0;
    if (na === null && nb === null) result = 0;
    else if (na === null) result = 1;      // مقادیر تهی همیشه آخر
    else if (nb === null) result = -1;
    else result = na < nb ? -1 : na > nb ? 1 : 0;
    return direction === 'desc' ? -result : result;
  };

  RM.utils = U;
})();
