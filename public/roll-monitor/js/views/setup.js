/* =========================================================================
   views/setup.js — نما ستاپ‌ها (§20-§30، §46-§51، §85-§87، §91)
   -------------------------------------------------------------------------
   فرم ثبت/ویرایش با:
     - ارث‌بری ضخامت (قفل خودکار §22)
     - دراپ‌داون متراژ استاندارد وابسته به ضخامت (§24)
     - اعتبارسنجی زندهٔ الگوی برش (§29)
   جدول گزارش هر ستاپ:
     خام موجود + متالایز + برش‌نشده + مغایرت ظرفیت (§46-§50، §86)
     + جزئیات Audit تخصیص (§45)
   ========================================================================= */

'use strict';

(function () {
  const U = RM.utils;
  const UI = RM.ui;
  const Setups = RM.setupEngine;
  const db = RM.db.db;

  const SetupView = {
    page: 1,
    editingId: null,          // شناسهٔ رکورد در حال ویرایش (null = ثبت جدید)
    currentRules: [],
    thicknessLocked: false,   // ارث‌بری فعال؟ (§22)
    sortPipeline: null,       // [{field, direction}] — پنل مرتب‌سازی گزارش (ماندگار)
    filters: {},              // { فیلد: مقدار } — فیلتر ستون‌های گزارش
    filterVisible: false,     // نوار فیلتر باز است؟
  };

  /* ---------------- عناصر فرم ---------------- */

  const F = () => ({
    setupNumber: document.getElementById('f-setup'),
    machineNumber: document.getElementById('f-machine'),
    width: document.getElementById('f-width'),
    thickness: document.getElementById('f-thickness'),
    standardLength: document.getElementById('f-standard'),
    rollCount: document.getElementById('f-count'),
    cuttingPattern: document.getElementById('f-pattern'),
  });

  /* ================================================================
     ۱) راه‌انداری
     ================================================================ */

  SetupView.init = async function () {
    const form = document.getElementById('setup-form');

    /* --- ارث‌بری ضخامت: پس از ورود شماره ستاپ بررسی می‌شود (§22) --- */
    F().setupNumber.addEventListener('change', () => SetupView.applyThicknessInheritance());
    F().setupNumber.addEventListener('blur', () => SetupView.applyThicknessInheritance());

    /* --- بازپر شدن دراپ‌داون متراژ استاندارد بر اساس ضخامت (§24) ---
       اگر مقدار فعلی در قوانین ضخامت جدید هم معتبر باشد، حفظ می‌شود */
    F().thickness.addEventListener('input', () => {
      if (SetupView.thicknessLocked) return;
      SetupView.refreshStandardLengthOptions(F().standardLength.value);
    });

    /* --- اعتبارسنجی زندهٔ الگوی برش (§29) --- */
    F().cuttingPattern.addEventListener('input', () => SetupView.updatePatternFeedback());

    /* --- اعتبارسنجی زندهٔ عرض (الگو به عرض وابسته است) --- */
    F().width.addEventListener('input', () => SetupView.updatePatternFeedback());

    /* --- ثبت / ویرایش --- */
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      SetupView.submit();
    });

    /* --- پاک‌کردن فرم / انصراف از ویرایش --- */
    document.getElementById('btn-reset-form').addEventListener('click', () => SetupView.resetForm());
    document.getElementById('btn-cancel-edit').addEventListener('click', () => SetupView.resetForm());

    /* --- حذف همه (§70 تأیید) --- */
    document.getElementById('btn-clear-setups').addEventListener('click', SetupView.clearAll);

    /* --- ثبت گروهی (Bulk Paste) --- */
    document.getElementById('btn-bulk-analyze').addEventListener('click', () => SetupView.analyzeBulk());
    document.getElementById('btn-bulk-commit').addEventListener('click', () => SetupView.commitBulk());
    document.getElementById('btn-bulk-clear').addEventListener('click', () => SetupView.resetBulk());

    /* --- پنل مرتب‌سازی گزارش ستاپ‌ها (ماندگار — مثل رول‌های خام §38) --- */
    SetupView.sortPipeline = await RM.db.getSetting('setupReportSort', RM.config.SETUP_DEFAULT_SORT);
    SetupView.initSortPanel();

    /* --- فیلتر ستون‌های گزارش ستاپ‌ها --- */
    SetupView.initFilterBar();
  };

  /* ================================================================
     ۲) منطق فرم
     ================================================================ */

  /** ارث‌بری ضخامت (§22): اگر ستاپ موجود باشد → قفل خودکار */
  SetupView.applyThicknessInheritance = async function () {
    const { setupNumber, thickness, standardLength } = F();
    const value = U.parseInt(setupNumber.value);
    const hintEl = document.getElementById('hint-thickness');

    if (SetupView.editingId !== null) return;   // در ویرایش، ضخامت آزاد است (§23)

    if (value === null || value < 0) {
      SetupView.thicknessLocked = false;
      thickness.disabled = false;
      hintEl.hidden = true;
      return;
    }

    const existing = await db.setupRolls.where('setupNumber').equals(value).toArray();
    const withThickness = existing.find((s) => s.thickness !== null);

    if (withThickness) {
      // ارث‌بری: ضخامت تعیین‌شدهٔ اولین رکورد همان ستاپ (§22)
      SetupView.thicknessLocked = true;
      thickness.value = String(withThickness.thickness);
      thickness.disabled = true;
      hintEl.textContent = `ضخامت ستاپ ${U.faNum(value)} قبلاً ${U.faNum(withThickness.thickness)} تعیین شده و به‌صورت خودکار به ارث رسید (§ ارث‌بری ضخامت).`;
      hintEl.hidden = false;
    } else {
      SetupView.thicknessLocked = false;
      thickness.disabled = false;
      hintEl.hidden = true;
    }

    SetupView.refreshStandardLengthOptions(standardLength.value);
  };

  /** پرکردن دراپ‌داون متراژ استاندارد فقط با قوانینِ ضخامت فعلی (§24) */
  SetupView.refreshStandardLengthOptions = function (keepValue = null) {
    const { thickness, standardLength } = F();
    const thicknessValue = U.parseNumber(thickness.value);
    const errEl = document.getElementById('err-standard');

    const options = thicknessValue === null
      ? []
      : RM.rulesEngine.standardLengthsFor(SetupView.currentRules, thicknessValue);

    let html = '<option value="">— انتخاب کنید —</option>';
    for (const opt of options) {
      html += `<option value="${opt}">${U.faNum(opt)}</option>`;
    }
    standardLength.innerHTML = html;

    // نگهداری مقدار در صورت تعلق به همین ضخامت
    if (keepValue !== null && options.includes(U.parseNumber(keepValue))) {
      standardLength.value = keepValue;
    } else {
      standardLength.value = '';
    }

    // راهنمای کاربر وقتی قوانین این ضخامت تعریف نشده
    if (thicknessValue !== null && !options.length) {
      errEl.textContent = 'برای این ضخامت قانون متراژی تعریف نشده — از تب «تنظیمات» قانون اضافه کنید.';
      errEl.hidden = false;
    } else {
      errEl.textContent = '';
      errEl.hidden = true;
    }
  };

  /** بازخورد زندهٔ الگوی برش (§29) */
  SetupView.updatePatternFeedback = function () {
    const { width, cuttingPattern } = F();
    const box = document.getElementById('pattern-feedback');

    const result = Setups.validatePattern(cuttingPattern.value, U.parseNumber(width.value));

    if (!cuttingPattern.value.trim()) {
      box.className = 'pattern-feedback';
      box.innerHTML = '<span class="muted">اختیاری — مثال: 1100-1170</span>';
      return;
    }

    if (!result.ok) {
      box.className = 'pattern-feedback invalid';
      box.innerHTML = `<span class="pf-status">✕</span> ${result.message}`;
      return;
    }

    const motherWidth = U.parseNumber(width.value);
    const remaining = motherWidth !== null ? motherWidth - result.sum : null;

    box.className = 'pattern-feedback valid';
    box.innerHTML =
      `<span class="pf-status">✓</span> مجموع: <b>${U.faWidth(result.sum)}</b>` +
      (remaining !== null && remaining >= 0
        ? ` · باقی‌مانده (پرت عرض): <b>${U.faWidth(remaining)}</b>`
        : '') +
      ` · بخش‌ها: ${U.faNum(result.parts.length)}`;
  };

  /* ================================================================
     ۳) ثبت / ویرایش رکورد
     ================================================================ */

  SetupView.submit = async function () {
    const form = document.getElementById('setup-form');
    const f = F();
    UI.clearFormErrors(form);

    const input = {
      setupNumber: f.setupNumber.value,
      machineNumber: f.machineNumber.value,
      width: f.width.value,
      thickness: f.thickness.value,
      standardLength: f.standardLength.value,
      rollCount: f.rollCount.value,
      cuttingPattern: f.cuttingPattern.value,
    };

    /* --- ویرایش: بررسی آبشار ضخامت (§23) --- */
    if (SetupView.editingId !== null) {
      const newThickness = U.parseNumber(input.thickness);
      const info = await Setups.cascadeInfo(SetupView.editingId, newThickness);

      if (info.affected > 0) {
        const ok = await UI.confirm({
          title: 'تأیید تغییر ضخامت',
          html: `
            <div class="confirm-stats">
              <div>تغییر ضخامت ستاپ <b>${U.faNum(info.setupNumber)}</b> باعث تغییر ضخامت
              <b>${U.faNum(info.affected)}</b> رکورد دیگر نیز خواهد شد.</div>
            </div>`,
          message: 'این عملیات تراکنشی است و در صورت خطا به حالت قبل برمی‌گردد. ادامه می‌دهید؟',
          confirmText: 'بله، ضخامت همه را تغییر بده',
        });
        if (!ok) {
          UI.toast('عملیات ویرایش لغو شد.', 'info');
          return;
        }
      }

      const result = await Setups.update(SetupView.editingId, input, { cascadedCount: info.affected });
      if (!result.ok) {
        SetupView.showValidationErrors(result);
        return;
      }
      UI.toast(
        (info.affected > 0
          ? `ویرایش انجام شد — ضخامت ${U.faNum(info.affected)} رکورد دیگر نیز به‌روزرسانی شد.`
          : 'رکورد با موفقیت ویرایش شد.'),
        'success'
      );
    } else {
      /* --- ثبت جدید --- */
      const result = await Setups.create(input);
      if (!result.ok) {
        SetupView.showValidationErrors(result);
        return;
      }
      UI.toast('رکورد ستاپ جدید ذخیره شد.', 'success');
    }

    SetupView.resetForm();
    await RM.refreshAll();
    await SetupView.render();
  };

  /** نمایش خطاهای Field-Level (§69): حاشیهٔ قرمز + پیام + فوکوس */
  SetupView.showValidationErrors = function (result) {
    const form = document.getElementById('setup-form');
    const f = F();
    const fieldMap = {
      setupNumber: [f.setupNumber, document.getElementById('err-setup')],
      machineNumber: [f.machineNumber, document.getElementById('err-machine')],
      width: [f.width, document.getElementById('err-width')],
      thickness: [f.thickness, document.getElementById('err-thickness')],
      standardLength: [f.standardLength, document.getElementById('err-standard')],
      rollCount: [f.rollCount, document.getElementById('err-count')],
      cuttingPattern: [f.cuttingPattern, document.getElementById('err-pattern')],
    };

    let firstInvalid = null;
    for (const [field, [input, errEl]] of Object.entries(fieldMap)) {
      const msg = result.errors && result.errors[field];
      UI.setFieldError(input, errEl, msg);
      if (msg && !firstInvalid) firstInvalid = input;
    }

    if (result.message) UI.toast(U.escapeHtml(result.message), 'error');
    if (firstInvalid) firstInvalid.focus();
  };

  /* ================================================================
     ۴) حالت ویرایش
     ================================================================ */

  SetupView.startEdit = async function (id) {
    const record = await db.setupRolls.get(id);
    if (!record) return;

    const f = F();
    SetupView.editingId = id;

    f.setupNumber.value = String(record.setupNumber);
    f.machineNumber.value = String(record.machineNumber);
    f.width.value = String(record.width);
    f.thickness.value = record.thickness !== null ? String(record.thickness) : '';
    f.rollCount.value = String(record.rollCount);
    f.cuttingPattern.value = record.cuttingPattern || '';

    // در ویرایش ضخامت آزاد است (§23) — آبشار در ثبت گرفته می‌شود
    SetupView.thicknessLocked = false;
    f.thickness.disabled = false;
    document.getElementById('hint-thickness').hidden = true;

    SetupView.refreshStandardLengthOptions(
      record.standardLength !== null ? String(record.standardLength) : null
    );
    f.standardLength.value = record.standardLength !== null ? String(record.standardLength) : '';
    SetupView.updatePatternFeedback();

    // تغییر حالت فرم به ویرایش
    document.getElementById('setup-form-title').textContent = `ویرایش رکورد ستاپ #${U.faNum(id)}`;
    document.getElementById('btn-save-roll').innerHTML = `${UI.icons.check} ذخیرهٔ تغییرات`;
    document.getElementById('btn-cancel-edit').hidden = false;

    // اسکرول به فرم + فوکوس
    document.getElementById('view-setup').scrollIntoView({ behavior: 'smooth', block: 'start' });
    f.setupNumber.focus();
  };

  /** بازگشت فرم به حالت ثبت جدید */
  SetupView.resetForm = function () {
    const form = document.getElementById('setup-form');
    const f = F();

    form.reset();
    UI.clearFormErrors(form);
    SetupView.editingId = null;
    SetupView.thicknessLocked = false;
    f.thickness.disabled = false;
    document.getElementById('hint-thickness').hidden = true;
    document.getElementById('pattern-feedback').className = 'pattern-feedback';
    document.getElementById('pattern-feedback').innerHTML = '<span class="muted">اختیاری — مثال: 1100-1170</span>';

    document.getElementById('setup-form-title').textContent = 'ثبت رول جدید برای ستاپ';
    document.getElementById('btn-save-roll').innerHTML = `${UI.icons.plus} ذخیره رکورد`;
    document.getElementById('btn-cancel-edit').hidden = true;

    SetupView.refreshStandardLengthOptions();
  };

  /* ================================================================
     ۵-ب) ثبت گروهی از Clipboard — Bulk Paste (§4 اصلاحات)
     ----------------------------------------------------------------
     جریان: تحلیل → پیش‌نمایش «قابل ویرایش» → اعتبارسنجی زنده →
     ثبت همه در یک تراکنش واحد. پس از تحلیل:
       • شماره ستاپ و ضخامت سراسری برای کل رکوردها (نوار بالا)
       • دستگاه و متراژ استاندارد (از قوانینِ ضخامت سراسری) به‌صورت
         پیش‌فرض یا رکوردبه‌رکورد
       • همهٔ فیلدهای هر رکورد (عرض مادر، الگوی برش، تعداد رول) قابل ویرایش
       • خلاصهٔ زندهٔ رکوردها (عرض‌های مادر/رول‌های الگو/جمع ست‌ها/یونیک‌ها)
     ================================================================ */

  /** وضعیت Bulk: { common:{setupNumber,thickness}, drafts:[…], structureErrors:[…] } */
  SetupView._bulk = null;
  SetupView._bulkCheck = null;          // آخرین نتیجهٔ اعتبارسنجی
  SetupView._bulkValidateTimer = null;  // debounce اعتبارسنجی زنده

  /** مقادیر اولیهٔ تحلیل از فرم دستی (پایهٔ پیش‌فرض‌های پیش‌نمایش) */
  SetupView.bulkCommonInput = function () {
    const f = F();
    return {
      setupNumber: f.setupNumber.value,
      machineNumber: f.machineNumber.value,
      thickness: f.thickness.value,
      standardLength: f.standardLength.value,
    };
  };

  /** تحلیل + پیش‌نمایش — بدون ثبت (dry-run) */
  SetupView.analyzeBulk = async function () {
    const textarea = document.getElementById('bulk-text');
    const text = textarea.value;

    if (!text.trim()) {
      UI.toast('متن Paste شده خالی است — داده‌ها را در کادر بالا وارد کنید.', 'warning');
      return;
    }

    // قوانین تازه برای گزینه‌های متراژ استاندارد
    SetupView.currentRules = await db.standardLengthRules.toArray();

    const commonInit = SetupView.bulkCommonInput();
    const { drafts, structureErrors } = Setups.buildBulkDraft(commonInit, text);

    SetupView._bulk = {
      common: { setupNumber: commonInit.setupNumber, thickness: commonInit.thickness },
      drafts,
      structureErrors,
    };

    SetupView.renderBulkPreview();
    SetupView.renderBulkSummary();
    SetupView.revalidateBulk();
  };

  /**
   * خلاصهٔ زندهٔ رکوردهای تشخیص‌داده‌شده — با هر تغییری در رکوردها
   * بلافاصله به‌روز می‌شود (روش محاسبهٔ جدید):
   *   جمع عرض رول مادر   = Σ ستون تعداد (مجموع تعداد رول‌های مادر)
   *   یونیک رول مادر     = تعداد عرض‌های یکتای مادر (مثل ۲۲۸۰/۲۳۸۰/۲۳۰۰ = ۳)
   *   جمع عرض الگوی برش = Σ (تعداد عرض‌های الگوی هر رکورد × تعداد ست همان)
   *   یونیک عرض الگو     = تعداد عرض‌های یکتای برش (مثل ۷۸۰/۷۰۰/۸۰۰/۹۰۰/۷۴۰ = ۵)
   * مثال مرجع (۴ رکورد با تعداد ۲/۷/۵/۲ و الگوهای سه‌تکه):
   *   ۱۶ / ۳ / ۴۸ / ۵
   */
  SetupView.bulkSummaryStats = function (drafts) {
    let motherRollsTotal = 0;      // Σ تعداد — «جمع عرض رول مادر»
    let patternWidthsTotal = 0;    // Σ (تعداد عرض الگو × تعداد ست) — «جمع عرض الگوی برش»
    const motherWidthSet = new Set();   // عرض‌های یکتای مادر
    const patternWidthSet = new Set();  // عرض‌های یکتای الگو

    for (const d of drafts) {
      const rollCount = d.rollCount === null ? 0 : (d.rollCount || 0);
      motherRollsTotal += rollCount;

      const w = U.parseNumber(d.motherToken);
      if (w !== null) motherWidthSet.add(w);

      const parsed = Setups.parsePattern(d.patternText);
      if (parsed.ok && parsed.parts.length) {
        patternWidthsTotal += parsed.parts.length * rollCount;
        for (const part of parsed.parts) patternWidthSet.add(part);
      }
    }

    return {
      count: drafts.length,
      motherRollsTotal,                            // ۱۶
      uniqueMotherWidths: motherWidthSet.size,     // ۳
      patternWidthsTotal,                          // ۴۸
      uniquePatternWidths: patternWidthSet.size,   // ۵
    };
  };

  /** رندر خلاصهٔ زنده در #bulk-summary (برچسب‌ها مطابق روش محاسبهٔ جدید) */
  SetupView.renderBulkSummary = function () {
    const el = document.getElementById('bulk-summary');
    const b = SetupView._bulk;
    if (!el) return;
    if (!b || !b.drafts.length) { el.innerHTML = ''; return; }

    const s = SetupView.bulkSummaryStats(b.drafts);
    el.innerHTML = `
      <span class="chip">رکوردها: ${U.faNum(s.count)}</span>
      <span class="chip chip-strong">جمع عرض رول مادر: ${U.faNum(s.motherRollsTotal)}</span>
      <span class="chip chip-ok">یونیک رول مادر: ${U.faNum(s.uniqueMotherWidths)}</span>
      <span class="chip chip-strong">جمع عرض الگوی برش: ${U.faNum(s.patternWidthsTotal)}</span>
      <span class="chip chip-ok">یونیک عرض الگوی برش: ${U.faNum(s.uniquePatternWidths)}</span>`;
  };

  /** گزینه‌های متراژ استاندارد از قوانینِ ضخامت سراسری فعلی */
  SetupView.bulkStandardOptions = function () {
    const b = SetupView._bulk;
    const t = b ? U.parseNumber(b.common.thickness) : null;
    return t === null ? [] : RM.rulesEngine.standardLengthsFor(SetupView.currentRules, t);
  };

  /** HTML یک ردیف قابل ویرایش پیش‌نمایش Bulk */
  SetupView.bulkRowHtml = function (d, i, standardOptions) {
    const pairsTxt = (d.pairs && d.pairs.length > 1)
      ? ` (جفت ${d.pairs.map((p) => U.faNum(p)).join('،')})`
      : '';
    const occTxt = (d.occurrences || 1) > 1 ? ` ×${U.faNum(d.occurrences)}` : '';

    const machineSel = `<select data-bulk-field="machineNumber" data-bulk-row="${i}" aria-label="شماره دستگاه رکورد ${U.faNum(i + 1)}">
        <option value="">—</option>
        ${[1, 2, 3].map((m) => `<option value="${m}" ${String(m) === String(d.machineNumber) ? 'selected' : ''}>دستگاه ${U.faNum(m)}</option>`).join('')}
      </select>`;

    const stdSel = `<select data-bulk-field="standardLength" data-bulk-row="${i}" aria-label="متراژ استاندارد رکورد ${U.faNum(i + 1)}">
        <option value="">—</option>
        ${standardOptions.map((o) => `<option value="${o}" ${String(o) === String(d.standardLength) ? 'selected' : ''}>${U.faNum(o)}</option>`).join('')}
      </select>`;

    return `
      <tr data-bulk-tr="${i}">
        <td>${U.faNum(i + 1)}<span class="muted" style="font-size:.62rem">${pairsTxt}${occTxt}</span></td>
        <td><input type="text" inputmode="numeric" dir="ltr" class="bulk-input" value="${U.escapeHtml(d.motherToken ?? '')}"
               data-bulk-field="motherToken" data-bulk-row="${i}" aria-label="عرض مادر رکورد ${U.faNum(i + 1)}"></td>
        <td><input type="text" dir="ltr" class="bulk-input bulk-input-pattern" value="${U.escapeHtml(d.patternText ?? '')}"
               data-bulk-field="patternText" data-bulk-row="${i}" aria-label="الگوی برش رکورد ${U.faNum(i + 1)}"></td>
        <td><input type="text" inputmode="numeric" dir="ltr" class="bulk-input bulk-input-count" value="${d.rollCount === null ? '' : String(d.rollCount)}"
               data-bulk-field="rollCount" data-bulk-row="${i}" aria-label="تعداد رول رکورد ${U.faNum(i + 1)}"></td>
        <td>${machineSel}</td>
        <td>${stdSel}</td>
        <td data-bulk-cell="sum"><span class="muted">—</span></td>
        <td data-bulk-cell="trim"><span class="muted">—</span></td>
        <td class="bulk-status" data-bulk-cell="status"><span class="muted">…</span></td>
      </tr>`;
  };

  /** رندر کامل پیش‌نمایش — نوار فیلدهای سراسری + جدول قابل ویرایش */
  SetupView.renderBulkPreview = function () {
    const wrap = document.getElementById('bulk-preview');
    const commitBtn = document.getElementById('btn-bulk-commit');
    const b = SetupView._bulk;

    if (!b || !b.drafts.length) {
      const structureHtml = b && b.structureErrors.length
        ? `<div class="bulk-alert">${b.structureErrors.map((e) =>
            `<div class="bulk-common-error">✕ <b>ساختار:</b> ${U.escapeHtml(e.message)}</div>`).join('')}</div>`
        : '';
      wrap.innerHTML = structureHtml;
      commitBtn.disabled = true;
      return;
    }

    const standardOptions = SetupView.bulkStandardOptions();
    const structureHtml = b.structureErrors.length
      ? `<div class="bulk-alert">${b.structureErrors.map((e) =>
          `<div class="bulk-common-error">✕ <b>ساختار:</b> ${U.escapeHtml(e.message)}</div>`).join('')}</div>`
      : '';

    wrap.innerHTML = `
      <div class="bulk-toolbar">
        <div class="field">
          <label for="bulk-g-setup">شماره ستاپ (کل رکوردها) <b class="req">*</b></label>
          <input type="text" id="bulk-g-setup" inputmode="numeric" autocomplete="off"
                 value="${U.escapeHtml(b.common.setupNumber ?? '')}" placeholder="مثلاً ۱۴۰">
          <p class="field-error" id="bulk-g-err-setup" hidden></p>
        </div>
        <div class="field">
          <label for="bulk-g-thickness">ضخامت (کل رکوردها) <span class="unit">(میکرون)</span> <b class="req">*</b></label>
          <input type="text" id="bulk-g-thickness" inputmode="numeric" autocomplete="off"
                 value="${U.escapeHtml(b.common.thickness ?? '')}" placeholder="مثلاً ۲۰">
          <p class="field-error" id="bulk-g-err-thickness" hidden></p>
        </div>
        <div class="field">
          <label for="bulk-g-machine">دستگاه پیش‌فرض</label>
          <select id="bulk-g-machine">
            <option value="">— بدون تغییر —</option>
            <option value="1">دستگاه ۱</option>
            <option value="2">دستگاه ۲</option>
            <option value="3">دستگاه ۳</option>
          </select>
        </div>
        <div class="field">
          <label for="bulk-g-standard">متراژ استاندارد پیش‌فرض</label>
          <select id="bulk-g-standard">
            <option value="">— بدون تغییر —</option>
            ${standardOptions.map((o) => `<option value="${o}">${U.faNum(o)}</option>`).join('')}
          </select>
          <p class="field-hint">متراژهای ممکن از قوانینِ «تعریف قانون متراژ استاندارد» برای ضخامت سراسری خوانده می‌شود.</p>
        </div>
        <div class="field field-actions">
          <button type="button" class="btn btn-ghost btn-sm" id="bulk-g-apply">اعمال پیش‌فرض‌ها روی همهٔ رکوردها</button>
        </div>
      </div>
      ${structureHtml}
      <div class="table-wrap">
        <table class="data-table bulk-table">
          <thead><tr>
            <th>#</th><th>عرض مادر</th><th>الگوی برش</th><th>تعداد رول</th><th>دستگاه</th>
            <th>متراژ استاندارد</th><th>مجموع الگو</th><th>پرت عرض</th><th>وضعیت</th>
          </tr></thead>
          <tbody>${b.drafts.map((d, i) => SetupView.bulkRowHtml(d, i, standardOptions)).join('')}</tbody>
        </table>
      </div>`;

    /* --- فیلدهای سراسری: به‌روزرسانی وضعیت + بازسازی گزینه‌های متراژ --- */
    const gSetup = document.getElementById('bulk-g-setup');
    const gThickness = document.getElementById('bulk-g-thickness');

    gSetup.addEventListener('input', () => {
      b.common.setupNumber = gSetup.value;
      SetupView.scheduleBulkRevalidate();
    });
    gThickness.addEventListener('input', () => {
      b.common.thickness = gThickness.value;
      SetupView.rebuildBulkStandardOptions();
      SetupView.scheduleBulkRevalidate();
    });

    /* --- اعمال پیش‌فرض‌های دستگاه/متراژ روی همهٔ رکوردها --- */
    document.getElementById('bulk-g-apply').addEventListener('click', () => {
      const machine = document.getElementById('bulk-g-machine').value;
      const standard = document.getElementById('bulk-g-standard').value;
      if (machine === '' && standard === '') {
        UI.toast('ابتدا دستگاه یا متراژ استاندارد پیش‌فرض را انتخاب کنید.', 'info');
        return;
      }
      for (const d of b.drafts) {
        if (machine !== '') d.machineNumber = machine;
        if (standard !== '') d.standardLength = standard;
      }
      SetupView.renderBulkPreview();
      SetupView.renderBulkSummary();
      SetupView.revalidateBulk();
      UI.toast('پیش‌فرض‌ها روی همهٔ رکوردها اعمال شد.', 'success');
    });

    /* --- ورودی‌های هر ردیف: به‌روزرسانی زندهٔ وضعیت + خلاصه --- */
    wrap.querySelectorAll('[data-bulk-field]').forEach((el) => {
      el.addEventListener('input', () => SetupView.onBulkRowInput(el));
      el.addEventListener('change', () => SetupView.onBulkRowInput(el));
    });

    SetupView.updateBulkRowComputed();
  };

  /** تغییر یک فیلد رکورد — خلاصه/سلول‌های همان ردیف بلافاصله؛ اعتبارسنجی با debounce */
  SetupView.onBulkRowInput = function (el) {
    const b = SetupView._bulk;
    if (!b) return;
    const i = Number(el.dataset.bulkRow);
    const draft = b.drafts[i];
    if (!draft) return;

    const field = el.dataset.bulkField;
    if (field === 'rollCount') {
      const v = U.parseInt(el.value);
      draft.rollCount = v === null ? null : v;
    } else {
      draft[field] = el.value;
    }

    SetupView.renderBulkSummary();          // زنده — بلافاصله
    SetupView.updateBulkRowComputed(i);
    SetupView.scheduleBulkRevalidate();
  };

  /** سلول‌های محاسباتی ردیف‌ها (مجموع الگو / پرت عرض) */
  SetupView.updateBulkRowComputed = function (rowIdx = null) {
    const b = SetupView._bulk;
    if (!b) return;
    const rowsIdx = rowIdx === null ? b.drafts.map((_, i) => i) : [rowIdx];

    for (const i of rowsIdx) {
      const tr = document.querySelector(`[data-bulk-tr="${i}"]`);
      if (!tr) continue;
      const d = b.drafts[i];

      const parsed = Setups.parsePattern(d.patternText);
      const mother = U.parseNumber(d.motherToken);
      const sum = parsed.ok ? parsed.sum : null;
      const trim = parsed.ok && mother !== null ? mother - sum : null;

      tr.querySelector('[data-bulk-cell="sum"]').innerHTML =
        sum !== null ? U.faWidth(sum) : '<span class="muted">—</span>';
      tr.querySelector('[data-bulk-cell="trim"]').innerHTML =
        trim !== null && trim >= 0 ? U.faWidth(trim) : '<span class="muted">—</span>';
    }
  };

  /**
   * بازسازی گزینه‌های «متراژ استاندارد» با تغییر ضخامت سراسری —
   * مقدار رکوردها اگر در قوانین ضخامت جدید معتبر باشد حفظ می‌شود.
   */
  SetupView.rebuildBulkStandardOptions = function () {
    const b = SetupView._bulk;
    if (!b) return;
    const options = SetupView.bulkStandardOptions();
    const optionsStr = options.map(String);

    for (let i = 0; i < b.drafts.length; i++) {
      const sel = document.querySelector(`[data-bulk-field="standardLength"][data-bulk-row="${i}"]`);
      if (!sel) continue;
      const keep = optionsStr.includes(String(b.drafts[i].standardLength)) ? b.drafts[i].standardLength : '';
      b.drafts[i].standardLength = keep;
      sel.innerHTML = '<option value="">—</option>' +
        options.map((o) => `<option value="${o}" ${String(o) === String(keep) ? 'selected' : ''}>${U.faNum(o)}</option>`).join('');
    }

    const g = document.getElementById('bulk-g-standard');
    if (g) {
      g.innerHTML = '<option value="">— بدون تغییر —</option>' +
        options.map((o) => `<option value="${o}">${U.faNum(o)}</option>`).join('');
    }
  };

  /** اعتبارسنجی زنده با debounce (پس از توقف تایپ) */
  SetupView.scheduleBulkRevalidate = function () {
    clearTimeout(SetupView._bulkValidateTimer);
    SetupView._bulkValidateTimer = setTimeout(() => SetupView.revalidateBulk(), 350);
  };

  /** اعتبارسنجی زندهٔ پیش‌نمایش + به‌روزرسانی وضعیت ردیف‌ها و دکمهٔ Commit */
  SetupView.revalidateBulk = async function () {
    const b = SetupView._bulk;
    if (!b) return;
    const check = await Setups.validateBulkDraft(b.common, b.drafts);
    SetupView.applyBulkCheck(check);
  };

  /** اعمال نتیجهٔ اعتبارسنجی روی UI پیش‌نمایش (خطاهای سراسری + وضعیت ردیف‌ها) */
  SetupView.applyBulkCheck = function (check) {
    SetupView._bulkCheck = check;
    const b = SetupView._bulk;
    if (!b) return;

    // خطاهای فیلدهای سراسری زیر ورودی‌های خودشان
    const globalMap = {
      setupNumber: ['bulk-g-err-setup', 'bulk-g-setup'],
      thickness: ['bulk-g-err-thickness', 'bulk-g-thickness'],
    };
    for (const [field, [errId, inputId]] of Object.entries(globalMap)) {
      const errEl = document.getElementById(errId);
      const inputEl = document.getElementById(inputId);
      const msg = check.globalErrors[field] || '';
      if (errEl) { errEl.textContent = msg; errEl.hidden = !msg; }
      if (inputEl) inputEl.classList.toggle('invalid', !!msg);
    }

    // وضعیت هر ردیف
    b.drafts.forEach((d, i) => {
      const tr = document.querySelector(`[data-bulk-tr="${i}"]`);
      if (!tr) return;
      const cell = tr.querySelector('[data-bulk-cell="status"]');
      const rec = check.records[i];
      const errs = rec ? rec.errors : [];
      tr.classList.toggle('bulk-row-error', errs.length > 0);
      cell.innerHTML = errs.length
        ? `<span class="status-pill pill-bad">✕ خطا</span>
           <ul class="bulk-errors">${errs.map((e) => `<li>${U.escapeHtml(e)}</li>`).join('')}</ul>`
        : '<span class="status-pill pill-ok">✓ معتبر</span>';
    });

    const commitBtn = document.getElementById('btn-bulk-commit');
    const hasStructure = b.structureErrors.length > 0;
    commitBtn.disabled = !(check.ok === true && !hasStructure);
  };

  /** Commit نهایی — یک تراکنش واحد از وضعیت ویرایش‌شده؛ در صورت خطا هیچ رکوردی ثبت نمی‌شود */
  SetupView.commitBulk = async function () {
    const b = SetupView._bulk;
    if (!b || !b.drafts.length) return;

    const result = await Setups.commitBulkDraft(b.common, b.drafts);

    if (!result.ok) {
      SetupView.applyBulkCheck(result);
      UI.toast('Batch ثبت نشد — خطاها را در پیش‌نمایش برطرف کنید (هیچ رکوردی ذخیره نشده است).', 'error', 6000);
      return;
    }

    UI.toast(
      `${U.faNum(result.count)} رکورد ستاپ در یک تراکنش واحد ثبت شد (Bulk Paste).`,
      'success',
      5000
    );
    SetupView.resetBulk();
    await RM.refreshAll();
    await SetupView.render();
  };

  /** پاک‌کردن ناحیهٔ Bulk */
  SetupView.resetBulk = function () {
    document.getElementById('bulk-text').value = '';
    SetupView._bulk = null;
    SetupView._bulkCheck = null;
    clearTimeout(SetupView._bulkValidateTimer);
    SetupView.renderBulkPreview();
    SetupView.renderBulkSummary();
  };

  /* ================================================================
     ۶) حذف‌ها (§70 — تأیید اجباری)
     ================================================================ */

  SetupView.removeRecord = async function (id) {
    const ok = await UI.confirm({
      title: 'حذف رکورد ستاپ',
      message: 'آیا از حذف این رکورد مطمئن هستید؟ این عمل بازگشت‌پذیر نیست.',
      confirmText: 'بله، حذف کن',
      danger: true,
    });
    if (!ok) return;

    await Setups.remove(id);
    UI.toast('رکورد حذف شد.', 'success');
    await RM.refreshAll();
    await SetupView.render();
  };

  SetupView.clearAll = async function () {
    const count = await db.setupRolls.count();
    if (!count) return;

    const ok = await UI.confirm({
      title: 'حذف همهٔ رکوردهای ستاپ',
      html: `<div class="confirm-stats"><div>تعداد رکوردهای قابل حذف: <b>${U.faNum(count)}</b></div></div>`,
      message: 'تمام رکوردهای ستاپ حذف خواهند شد. ادامه می‌دهید؟',
      confirmText: 'بله، همه را حذف کن',
      danger: true,
    });
    if (!ok) return;

    await db.setupRolls.clear();
    UI.toast('همهٔ رکوردها حذف شدند.', 'success');
    await RM.refreshAll();
    await SetupView.render();
  };

  /* ================================================================
     ۶) رندر جدول گزارش ستاپ‌ها (§46-§51، §30، §45)
        + پنل مرتب‌سازی چندمرحله‌ای ماندگار + فیلتر ستون‌ها
     ================================================================ */

  /** کارت‌های الگوی برش (§30) */
  SetupView.renderPatternCards = function (setup) {
    const parsed = Setups.parsePattern(setup.cuttingPattern);
    if (!setup.cuttingPattern) return '<span class="muted">—</span>';
    if (!parsed.ok) return `<span class="film-bad">${U.escapeHtml(setup.cuttingPattern)}</span>`;

    const cards = parsed.parts
      .map((p) => `<span class="pattern-card">${U.faWidth(p)}</span>`)
      .join('');

    const trim = setup.width - parsed.sum;
    return `
      <div class="pattern-cards">${cards}</div>
      <div class="pattern-sum">
        Σ ${U.faWidth(parsed.sum)}
        ${trim > 0 ? ` · پرت عرض: ${U.faWidth(trim)}` : ''}
      </div>`;
  };

  /* ---------------- پنل مرتب‌سازی گزارش ستاپ‌ها (ماندگار) ---------------- */

  /** ذخیرهٔ ماندگار ترتیب مرتب‌سازی (مثل رول‌های خام §38) */
  SetupView.saveSort = function () {
    RM.db.setSetting('setupReportSort', SetupView.sortPipeline);
  };

  SetupView.renderSortBuilder = function () {
    UI.sortPanel(
      document.getElementById('setup-sort-pipeline'),
      SetupView.sortPipeline,
      RM.config.SETUP_SORTABLE_FIELDS,
      {
        onDir: (i) => {
          SetupView.sortPipeline[i].direction =
            SetupView.sortPipeline[i].direction === 'asc' ? 'desc' : 'asc';
          SetupView.saveSort();
          SetupView.renderSortBuilder();
          SetupView.renderReportTable();
        },
        onRemove: (i) => {
          SetupView.sortPipeline.splice(i, 1);
          SetupView.saveSort();
          SetupView.renderSortBuilder();
          SetupView.renderReportTable();
        },
        onReorder: (from, to) => {
          const [moved] = SetupView.sortPipeline.splice(from, 1);
          SetupView.sortPipeline.splice(to, 0, moved);
          SetupView.saveSort();
          SetupView.renderSortBuilder();
          SetupView.renderReportTable();
        },
      }
    );
  };

  /** راه‌اندازی دکمه‌های افزودن/بازنشانی فیلد مرتب‌سازی */
  SetupView.initSortPanel = function () {
    const addSelect = document.getElementById('setup-sort-add-select');

    // گزینه‌ها از رجیستری مرکزی SETUP_SORTABLE_FIELDS
    addSelect.innerHTML = '<option value="">افزودن فیلد…</option>' +
      Object.entries(RM.config.SETUP_SORTABLE_FIELDS)
        .map(([k, v]) => `<option value="${k}">${U.escapeHtml(v.label)}</option>`)
        .join('');

    document.getElementById('setup-sort-add-btn').addEventListener('click', () => {
      const field = addSelect.value;
      if (!field) return;
      if (SetupView.sortPipeline.some((s) => s.field === field)) {
        UI.toast('این فیلد قبلاً به مرتب‌سازی اضافه شده است.', 'info');
        return;
      }
      SetupView.sortPipeline.push({ field, direction: 'asc' });
      SetupView.saveSort();
      SetupView.renderSortBuilder();
      SetupView.renderReportTable();
    });

    document.getElementById('setup-sort-reset-btn').addEventListener('click', () => {
      SetupView.sortPipeline = JSON.parse(JSON.stringify(RM.config.SETUP_DEFAULT_SORT));
      SetupView.saveSort();
      SetupView.renderSortBuilder();
      SetupView.renderReportTable();
      UI.toast('مرتب‌سازی گزارش ستاپ‌ها به حالت پیش‌فرض بازگشت.', 'info');
    });
  };

  /** اعمال مرتب‌سازی چندمرحله‌ای روی ردیف‌های گزارش (از آخرین اولویت به اولین) */
  SetupView.applySetupSort = function (rows) {
    const sorted = [...rows];
    for (let i = SetupView.sortPipeline.length - 1; i >= 0; i--) {
      const { field, direction } = SetupView.sortPipeline[i];
      sorted.sort((a, b) => {
        if (field === 'cuttingPattern') {
          const ka = Setups.normalizePatternKey(a.cuttingPattern) || '';
          const kb = Setups.normalizePatternKey(b.cuttingPattern) || '';
          const r = ka.localeCompare(kb, 'fa', { numeric: true });
          return direction === 'desc' ? -r : r;
        }
        return U.compareNumeric(a[field], b[field], direction);
      });
    }
    return sorted;
  };
  /* ---------------- فیلتر ستون‌های گزارش ستاپ‌ها ---------------- */

  /** ستون‌های قابل فیلتر (هر ستون با مقدار خاص) */
  SetupView.FILTER_FIELDS = [
    { key: 'setupNumber', label: 'شماره ستاپ' },
    { key: 'machineNumber', label: 'شماره دستگاه' },
    { key: 'width', label: 'عرض' },
    { key: 'thickness', label: 'ضخامت' },
    { key: 'standardLength', label: 'متراژ استاندارد' },
    { key: 'rollCount', label: 'تعداد رول' },
    { key: 'cuttingPattern', label: 'الگوی برش' },
    { key: 'rawExisting', label: 'خام موجود' },
    { key: 'metallized', label: 'متالایز' },
    { key: 'uncut', label: 'برش‌نشده' },
    { key: 'remainingSetupTime', label: 'مانده زمان ستاپ (دقیقه)' },
    { key: 'remainingProducedTime', label: 'مانده زمان تولیدشده (دقیقه)' },
  ];

  /** تطبیق یک ردیف با مقدار فیلتر یک ستون: عدد = برابری عددی · متن = شامل بودن */
  SetupView.rowMatchesFilter = function (row, key, value) {
    const raw = row[key];
    const num = U.parseNumber(value);

    if (num !== null && raw !== null && raw !== undefined && Number.isFinite(Number(raw))) {
      return Number(raw) === num;
    }
    const hay = (key === 'cuttingPattern')
      ? ((Setups.normalizePatternKey(raw) || '') + ' ' + String(raw ?? ''))
      : String(raw ?? '');
    return hay.includes(value);
  };

  /** اعمال همهٔ فیلترهای فعال روی ردیف‌های گزارش */
  SetupView.filterRows = function (rows) {
    const active = Object.entries(SetupView.filters)
      .filter(([, v]) => String(v ?? '').trim() !== '');
    if (!active.length) return rows;
    return rows.filter((r) =>
      active.every(([key, val]) => SetupView.rowMatchesFilter(r, key, String(val).trim()))
    );
  };

  /** راه‌اندازی نوار فیلتر (ورودی هر ستون + باز/بسته + پاک‌کردن) */
  SetupView.initFilterBar = function () {
    const inputsWrap = document.getElementById('setup-filter-inputs');
    const bar = document.getElementById('setup-filter-bar');
    const toggle = document.getElementById('setup-filter-toggle');

    inputsWrap.innerHTML = SetupView.FILTER_FIELDS.map((f) => `
      <div class="filter-field">
        <label for="setup-filter-${f.key}">${U.escapeHtml(f.label)}</label>
        <input type="text" id="setup-filter-${f.key}" data-filter-key="${f.key}"
               autocomplete="off" placeholder="فیلتر…">
      </div>`).join('');

    let timer = null;
    inputsWrap.querySelectorAll('[data-filter-key]').forEach((el) => {
      el.addEventListener('input', () => {
        SetupView.filters[el.dataset.filterKey] = el.value;
        clearTimeout(timer);
        timer = setTimeout(() => {
          SetupView.page = 1;
          SetupView.renderReportTable();
        }, 250);
      });
    });

    toggle.addEventListener('click', () => {
      SetupView.filterVisible = !SetupView.filterVisible;
      bar.hidden = !SetupView.filterVisible;
      toggle.setAttribute('aria-expanded', String(SetupView.filterVisible));
    });

    document.getElementById('setup-filter-clear').addEventListener('click', () => {
      SetupView.filters = {};
      inputsWrap.querySelectorAll('[data-filter-key]').forEach((el) => { el.value = ''; });
      SetupView.page = 1;
      SetupView.renderReportTable();
      UI.toast('فیلترها پاک شد.', 'info');
    });
  };

  /** به‌روزرسانی وضعیت فیلتر (N ردیف از M) */
  SetupView.updateFilterStatus = function (filteredCount, totalCount) {
    const el = document.getElementById('setup-filter-status');
    if (!el) return;
    const activeCount = Object.values(SetupView.filters)
      .filter((v) => String(v ?? '').trim() !== '').length;
    el.innerHTML = activeCount
      ? `<span class="chip chip-strong">${U.faNum(filteredCount)} از ${U.faNum(totalCount)} ردیف (فیلترشده)</span>`
      : '';
  };

  /** رندر جدول گزارش (فیلتر + مرتب‌سازی + صفحه‌بندی) — از موتور محاسبه (§79) */
  SetupView.renderReportTable = async function () {
    const state = await RM.calcEngine.getState();
    const report = state.setupReport;
    const filtered = SetupView.filterRows(report);
    const rows = SetupView.applySetupSort(filtered);
    SetupView.updateFilterStatus(filtered.length, report.length);

    const wrap = document.getElementById('setup-table-wrap');

    const columns = [
      { key: 'setupNumber', label: 'ستاپ', render: (r) => U.faNum(r.setupNumber) },
      { key: 'machineNumber', label: 'دستگاه', render: (r) => U.faNum(r.machineNumber) },
      { key: 'width', label: 'عرض', render: (r) => U.faWidth(r.width) },
      { key: 'thickness', label: 'ضخامت', render: (r) => r.thickness === null ? '<span class="muted">ناقص</span>' : U.faNum(r.thickness) },
      { key: 'standardLength', label: 'متراژ استاندارد', render: (r) => r.standardLength === null ? '<span class="muted">ناقص</span>' : U.faNum(r.standardLength) },
      { key: 'rollCount', label: 'تعداد', className: 'count-cell', render: (r) => U.faNum(r.rollCount) },
      { key: 'cuttingPattern', label: 'الگوی برش', render: SetupView.renderPatternCards },
      { key: 'rawExisting', label: 'خام موجود', render: (r) => `<span class="num-raw">${U.faNum(r.rawExisting)}</span>` },
      { key: 'metallized', label: 'متالایز', render: (r) => `<span class="num-metal">${U.faNum(r.metallized)}</span>` },
      {
        key: 'uncut', label: 'برش‌نشده',
        render: (r) => r.conflict > 0
          ? `<span class="num-uncut">${U.faNum(r.uncut)}</span><span class="conflict-badge" title="مغایرت ظرفیت (§86)">⚠ ${U.faNum(r.conflict)}</span>`
          : `<span class="num-uncut">${U.faNum(r.uncut)}</span>`,
      },
      {
        key: 'remainingSetupTime', label: 'مانده زمان ستاپ',
        render: (r) => r.remainingSetupTime === null
          ? '<span class="muted" title="قانون زمان متالایز برای دستگاه + متراژ استاندارد این رکورد تعریف نشده">بدون قانون</span>'
          : `<span class="num-time">${U.faDuration(r.remainingSetupTime)}</span>`,
      },
      {
        key: 'remainingProducedTime', label: 'مانده زمان تولید شده',
        render: (r) => r.remainingProducedTime === null
          ? '<span class="muted" title="قانون زمان متالایز برای دستگاه + متراژ استاندارد این رکورد تعریف نشده">بدون قانون</span>'
          : `<span class="num-time time-produced">${U.faDuration(r.remainingProducedTime)}</span>`,
      },
      {
        key: 'actions', label: 'عملیات',
        render: (r) => `
          <div class="row-actions">
            <button type="button" class="btn btn-ghost btn-icon" data-audit="${r.id}" title="جزئیات محاسبه (Audit)" aria-label="جزئیات محاسبه">${UI.icons.audit}</button>
            <button type="button" class="btn btn-ghost btn-icon" data-edit="${r.id}" title="ویرایش" aria-label="ویرایش">${UI.icons.edit}</button>
            <button type="button" class="btn btn-icon" data-del="${r.id}" title="حذف" aria-label="حذف">${UI.icons.trash}</button>
          </div>`,
      },
    ];

    UI.renderTable(wrap, columns, rows, {
      page: SetupView.page,
      emptyText: report.length && !filtered.length
        ? 'هیچ ردیفی با فیلترهای فعلی مطابقت ندارد — فیلترها را پاک کنید.'
        : 'هنوز ستاپی ثبت نشده — از فرم بالا اولین رکورد را وارد کنید.',
      onPageChange: (p) => {
        SetupView.page = p;
        SetupView.renderReportTable();
        document.getElementById('setup-table-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    });

    // رویدادهای ردیف
    wrap.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', () => SetupView.startEdit(Number(btn.dataset.edit)))
    );
    wrap.querySelectorAll('[data-del]').forEach((btn) =>
      btn.addEventListener('click', () => SetupView.removeRecord(Number(btn.dataset.del)))
    );
    wrap.querySelectorAll('[data-audit]').forEach((btn) =>
      btn.addEventListener('click', () => SetupView.showAudit(Number(btn.dataset.audit), state))
    );
  };

  /** رندر کامل نما (چیپ‌ها + پنل مرتب‌سازی + جدول) — از موتور محاسبه */
  SetupView.render = async function () {
    const state = await RM.calcEngine.getState();
    // قوانین برای دراپ‌داون فرم (بارگذاری مجدد — پس از تغییر قوانین هم تازه است)
    SetupView.currentRules = await db.standardLengthRules.toArray();

    const report = state.setupReport;

    // چیپ‌های خلاصه
    const s = state.summary;
    document.getElementById('setup-chips').innerHTML = `
      <span class="chip">${U.faNum(report.length)} رکورد</span>
      <span class="chip chip-strong">مجموع: ${U.faNum(s.totalSetupRolls)} رول</span>
      <span class="chip">خام موجود: ${U.faNum(s.rawMatchedCount)}</span>
      <span class="chip">متالایز: ${U.faNum(s.metallizedAllocated)}</span>
      <span class="chip ${s.totalConflict > 0 ? 'chip-warn' : 'chip-ok'}">
        برش‌نشده: ${U.faNum(s.totalUncut)}${s.totalConflict > 0 ? ` · مغایرت ${U.faNum(s.totalConflict)}` : ''}
      </span>
      <span class="chip">مانده زمان ستاپ: ${U.faDuration(s.totalRemainingSetupTime)}</span>
      <span class="chip">مانده زمان تولید شده: ${U.faDuration(s.totalRemainingProducedTime)}</span>
    `;

    document.getElementById('btn-clear-setups').hidden = report.length === 0;

    SetupView.renderSortBuilder();
    await SetupView.renderReportTable();
  };

  /* ================================================================
     ۷) جزئیات Audit تخصیص (§45)
     ================================================================ */

  SetupView.showAudit = function (id, state) {
    const r = state.setupReport.find((x) => x.id === id);
    if (!r) return;

    // یافتن سایر ستاپ‌های دارای همان کلید متالایز برای گزارش تخصیص
    const metPeers = state.setupReport.filter(
      (x) => x.id !== id && x.audit.metGroup && r.audit.metGroup && x.audit.metGroup.key === r.audit.metGroup.key
    );

    const peersHtml = metPeers.length
      ? `<p class="muted" style="font-size:.78rem">سایر دستگاه‌های همین کلید متالایز:</p>
         <ul class="audit-peers">${metPeers.map((p) =>
          `<li>دستگاه ${U.faNum(p.machineNumber)}: ظرفیت ${U.faNum(p.audit.metCapacity)} — تخصیص ${U.faNum(p.metallized)}</li>`
        ).join('')}</ul>`
      : '';

    const rawGroupInfo = r.audit.rawGroup
      ? `${U.faNum(r.audit.rawGroup.count)} رول خام برای کلید <code>${U.escapeHtml(r.audit.rawGroup.key)}</code> شناسایی شد؛
         ${U.faNum(r.rawExisting)} رول تا سقف ظرفیت این ستاپ تخصیص یافت.`
      : 'هیچ گروه رول خام منطبقی (عرض + متراژ استاندارد + ستاپ) یافت نشد.';

    const metGroupInfo = r.audit.metGroup
      ? `${U.faNum(r.audit.metGroup.count)} رول متالایز یونیک برای کلید <code>${U.escapeHtml(r.audit.metGroup.key)}</code> شناسایی شد؛
         ${U.faNum(r.metallized)} رول به این دستگاه تخصیص یافت.`
      : 'هیچ رول متالایز منطبقی (عرض + ستاپ) یافت نشد.';

    const timeInfo = r.durationMin !== null
      ? `قانون زمان: دستگاه ${U.faNum(r.machineNumber)} + متراژ ${U.faNum(r.standardLength)} →
         هر رول <b>${U.faNumPlain(r.durationMin)} دقیقه</b> ·
         مانده زمان ستاپ = ${U.faNumPlain(r.durationMin)} × ${U.faNum(r.rollCount)} = <b>${U.faDuration(r.remainingSetupTime)}</b> ·
         مانده زمان تولید شده = ${U.faNumPlain(r.durationMin)} × ${U.faNum(r.rawExisting)} = <b>${U.faDuration(r.remainingProducedTime)}</b>`
      : 'قانون زمان متالایزی برای ترکیب دستگاه + متراژ استاندارد این رکورد تعریف نشده — ستون‌های «مانده زمان» محاسبه نمی‌شوند.';

    UI.infoModal(
      `جزئیات محاسبه — ستاپ ${U.faNum(r.setupNumber)} / دستگاه ${U.faNum(r.machineNumber)}`,
      `
      <div class="audit-stats">
        <div>تعداد ستاپ: <b>${U.faNum(r.rollCount)}</b></div>
        <div>خام موجود: <b>${U.faNum(r.rawExisting)}</b></div>
        <div>متالایز: <b>${U.faNum(r.metallized)}</b></div>
        <div>برش‌نشده: <b>${U.faNum(r.uncut)}</b></div>
        ${r.conflict > 0 ? `<div class="audit-conflict">⚠ مغایرت ظرفیت: <b>${U.faNum(r.conflict)} رول</b><br>
          <span style="font-size:.75rem">${U.faNum(r.rawExisting)} + ${U.faNum(r.metallized)} > ظرفیت ${U.faNum(r.rollCount)}</span></div>` : ''}
      </div>
      <div class="audit-section"><h4>مانده زمان متالایز</h4><p>${timeInfo}</p></div>
      <div class="audit-section"><h4>ریشهٔ رول‌های خام (کلید ۳فاکتوری)</h4><p>${rawGroupInfo}</p></div>
      <div class="audit-section"><h4>ریشهٔ متالایزها (کلید ۲فاکتوری)</h4><p>${metGroupInfo}</p></div>
      ${peersHtml}
      <div class="audit-formula">
        برش‌نشده = ${U.faNum(r.rollCount)} − (${U.faNum(r.rawExisting)} + ${U.faNum(r.metallized)}) =
        <b>${U.faNum(r.uncutCalculated)}</b>${r.conflict > 0 ? ` → نمایش ${U.faNum(r.uncut)} + مغایرت ${U.faNum(r.conflict)}` : ''}
      </div>
      `
    );
  };

  RM.views = RM.views || {};
  RM.views.setup = SetupView;
})();
