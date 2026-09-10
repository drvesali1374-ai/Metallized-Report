/* =========================================================================
   ui.js — ابزارهای مشترک رابط کاربری
   -------------------------------------------------------------------------
   شامل: Toast، Modal تأیید (Promise-based)، Modal اطلاعاتی،
   مدیریت تب‌ها، رندر جدول صفحه‌بندی‌شده (§56) و Escape امن.
   ========================================================================= */

'use strict';

(function () {
  const U = RM.utils;

  const UI = {};

  /* ---------------- آیکون‌های SVG ---------------- */

  UI.icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>',
    error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    check:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    cross:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    alert:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    trash:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
    edit:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
    audit:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    grip:    '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>',
    plus:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>',
  };

  /* ---------------- Toast ---------------- */

  /** نمایش اعلان شناور؛ type ∈ success | error | warning | info */
  UI.toast = function (message, type = 'info', duration = 4200) {
    const stack = document.getElementById('toasts');
    if (!stack) return;

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `${UI.icons[type] || UI.icons.info}<div>${message}</div>`;
    stack.appendChild(el);

    const timer = setTimeout(dismiss, duration);
    function dismiss() {
      clearTimeout(timer);
      el.classList.add('leaving');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }
    el.addEventListener('click', dismiss);
  };

  /* ---------------- Modal تأیید (Promise) ---------------- */

  let modalResolve = null;

  /**
   * نمایش پنجرهٔ تأیید و انتظار برای پاسخ.
   * options: { title, html, message, confirmText, danger }
   */
  UI.confirm = function (options) {
    return new Promise((resolve) => {
      const overlay = document.getElementById('modal');
      const titleEl = document.getElementById('modal-title');
      const msgEl = document.getElementById('modal-msg');
      const btnOk = document.getElementById('modal-confirm');
      const btnCancel = document.getElementById('modal-cancel');

      titleEl.textContent = options.title || 'تأیید عملیات';
      // html اختیاری برای آمار تأیید (محتوای داخلی قابل اعتماد — UI خودمان می‌سازدش)
      msgEl.innerHTML = (options.html || '') + U.escapeHtml(options.message || '');
      btnOk.textContent = options.confirmText || 'بله، انجام بده';
      btnOk.classList.toggle('btn-danger', !!options.danger);
      btnOk.classList.toggle('btn-primary', !options.danger);

      overlay.hidden = false;
      btnOk.focus();

      function close(result) {
        overlay.hidden = true;
        btnOk.removeEventListener('click', onOk);
        btnCancel.removeEventListener('click', onCancel);
        overlay.removeEventListener('click', onOverlay);
        document.removeEventListener('keydown', onKey);
        modalResolve = null;
        resolve(result);
      }
      const onOk = () => close(true);
      const onCancel = () => close(false);
      const onOverlay = (e) => { if (e.target === overlay) close(false); };
      const onKey = (e) => { if (e.key === 'Escape') close(false); };

      btnOk.addEventListener('click', onOk);
      btnCancel.addEventListener('click', onCancel);
      overlay.addEventListener('click', onOverlay);
      document.addEventListener('keydown', onKey);
    });
  };

  /* ---------------- Modal اطلاعاتی (Audit — §45) ---------------- */

  /** نمایش پنجرهٔ اطلاعات با محتوای ساختاریافته (ریشه قابل اعتماد) */
  UI.infoModal = function (title, bodyHtml) {
    const overlay = document.getElementById('modal-info');
    const titleEl = document.getElementById('modal-info-title');
    const bodyEl = document.getElementById('modal-info-body');
    const btnClose = document.getElementById('modal-info-close');

    titleEl.textContent = title;
    bodyEl.innerHTML = bodyHtml;
    overlay.hidden = false;
    btnClose.focus();

    function close() {
      overlay.hidden = true;
      btnClose.removeEventListener('click', close);
      overlay.removeEventListener('click', onOverlay);
      document.removeEventListener('keydown', onKey);
    }
    const onOverlay = (e) => { if (e.target === overlay) close(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };

    btnClose.addEventListener('click', close);
    overlay.addEventListener('click', onOverlay);
    document.addEventListener('keydown', onKey);
  };

  /* ---------------- مدیریت تب‌ها (§71: دسترس‌پذیر) ---------------- */

  UI.initTabs = function () {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => UI.switchTab(btn.dataset.view));
    });
  };

  /** تعویض تب فعال (همراه با فراخوانی هوک نما در صورت وجود) */
  UI.switchTab = function (viewName) {
    document.querySelectorAll('.tab-btn').forEach((b) => {
      const isActive = b.dataset.view === viewName;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-selected', String(isActive));
    });
    document.querySelectorAll('.view').forEach((section) => {
      const isActive = section.id === `view-${viewName}`;
      section.classList.toggle('active', isActive);
      section.hidden = !isActive;
    });
    // هوک نمایش نما (مثلاً رندر با دادهٔ تازه هنگام باز شدن)
    const hook = RM.viewHooks && RM.viewHooks[viewName];
    if (typeof hook === 'function') hook();
  };

  /* ---------------- جدول صفحه‌بندی‌شده (§56) ---------------- */

  /**
   * رندر جدول صفحه‌بندی‌شده:
   * @param wrap       عنصر نگهدارندهٔ جدول
   * @param columns    [{key, label, render?, className?, sortable?}]
   * @param rows       داده‌ها
   * @param opts       { page, pageSize, emptyText, footerInfo }
   */
  UI.renderTable = function (wrap, columns, rows, opts = {}) {
    const pageSize = opts.pageSize || RM.config.PAGE_SIZE;
    const page = opts.page || 1;
    const emptyText = opts.emptyText || 'داده‌ای برای نمایش وجود ندارد.';

    if (!rows.length) {
      wrap.innerHTML = `
        <div class="empty-state">
          ${UI.icons.alert}
          <p>${emptyText}</p>
        </div>`;
      return { page: 1, pages: 0 };
    }

    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    const safePage = Math.min(page, pages);
    const slice = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

    const thead = '<thead><tr>' +
      columns.map((c) => `<th>${c.label}</th>`).join('') +
      '</tr></thead>';

    const tbody = '<tbody>' + slice.map((row) => {
      const cells = columns.map((c) => {
        const content = c.render ? c.render(row) : U.escapeHtml(row[c.key] ?? '—');
        return `<td class="${c.className || ''}">${content}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('') + '</tbody>';

    // نوار صفحه‌بندی (اگر بیش از یک صفحه)
    const pager = pages > 1
      ? `<div class="pager" role="navigation" aria-label="صفحه‌بندی جدول">
           <button type="button" class="btn btn-ghost btn-sm" data-page="1" ${safePage === 1 ? 'disabled' : ''}>ابتدا</button>
           <button type="button" class="btn btn-ghost btn-sm" data-page="${safePage - 1}" ${safePage === 1 ? 'disabled' : ''}>قبلی</button>
           <span class="pager-info">صفحهٔ ${U.faNum(safePage)} از ${U.faNum(pages)} — ${U.faNum(rows.length)} ردیف</span>
           <button type="button" class="btn btn-ghost btn-sm" data-page="${safePage + 1}" ${safePage === pages ? 'disabled' : ''}>بعدی</button>
           <button type="button" class="btn btn-ghost btn-sm" data-page="${pages}" ${safePage === pages ? 'disabled' : ''}>انتها</button>
         </div>`
      : (opts.footerInfo ? `<div class="pager"><span class="pager-info">${opts.footerInfo(rows.length)}</span></div>` : '');

    wrap.innerHTML = `
      <div class="table-wrap table-scroll">
        <table class="data-table">${thead}${tbody}</table>
      </div>
      ${pager}`;

    // رویداد صفحه‌بندی
    wrap.querySelectorAll('[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextPage = Number(btn.dataset.page);
        if (opts.onPageChange) opts.onPageChange(nextPage);
      });
    });

    return { page: safePage, pages };
  };

  /* ---------------- کمک‌های اعتبارسنجی فرم (§69) ---------------- */

  /** نمایش/پاک‌سازی خطای یک فیلد: حاشیهٔ قرمز + پیام زیر فیلد + فوکوس */
  UI.setFieldError = function (input, errEl, message) {
    if (!input) return;
    input.classList.toggle('invalid', !!message);
    if (errEl) {
      errEl.textContent = message || '';
      errEl.hidden = !message;
    }
  };

  /** پاک‌کردن همهٔ خطاهای یک فرم */
  UI.clearFormErrors = function (form) {
    form.querySelectorAll('.field-error').forEach((el) => {
      el.textContent = '';
      el.hidden = true;
    });
    form.querySelectorAll('input.invalid, select.invalid').forEach((el) => {
      el.classList.remove('invalid');
    });
  };

  /* ---------------- ستون‌های جزئیات رکورد با نام Mapping‌شده ---------------- */

  /**
   * ساخت ستون‌های جدول جزئیات رکورد (گروه رول / Drill-down کیفیت / Import).
   * نام هر ستون از Mapping کاربر خوانده می‌شود (اگر Dataset وارد شده باشد
   * نام واقعی ستون اکسل؛ وگرنه برچسب منطقی فارسی).
   * @param {string} sourceKey   'rolls' | 'archived'
   * @param {Array|null} selectedKeys  ترتیب/انتخاب ستون‌ها (null → تنظیم ذخیره‌شده)
   */
  UI.rollDetailColumns = async function (sourceKey, selectedKeys) {
    const labels = await RM.normalize.effectiveColumnLabels(sourceKey);

    const RENDERERS = {
      rollNumber:     (r) => U.escapeHtml(r.rollNumber || '—'),
      actualLength:   (r) => r.actualLength === null ? '<span class="muted">—</span>' : U.faNum(r.actualLength),
      productionDate: (r) => U.escapeHtml(U.faDateTime(r.productionDate)),
      netWeight:      (r) => r.netWeight === null ? '<span class="muted">—</span>' : U.faNum(r.netWeight),
      grade:          (r) => U.escapeHtml(r.grade || '—'),
      status:         (r) => U.escapeHtml(r.status || '—'),
      width:          (r) => r.width === null ? '<span class="muted">—</span>' : U.faWidth(r.width),
      cutWidth:       (r) => r.cutWidth === null ? '<span class="muted">—</span>' : U.faWidth(r.cutWidth),
      thickness:      (r) => r.thickness === null ? '<span class="muted">—</span>' : U.faNum(r.thickness),
      setupNumber:    (r) => r.setupNumber === null ? '<span class="muted">—</span>' : U.faNum(r.setupNumber),
      filmType:       (r) => U.escapeHtml(r.filmType || '—'),
      palletNumber:   (r) => U.escapeHtml(r.palletNumber || '—'),
    };

    let order = selectedKeys;
    if (!order || !order.length) {
      order = await RM.db.getSetting('rollDetailColumns', RM.config.DETAIL_DEFAULT_COLUMNS);
    }

    return (order || [])
      .filter((k) => RENDERERS[k])
      .map((k) => ({
        key: k,
        label: U.escapeHtml(labels[k] || RM.config.FIELD_LABELS[k] || k),
        className: k === 'rollNumber' || k === 'grade' ? 'ltr' : '',
        render: RENDERERS[k],
      }));
  };

  /* ---------------- مودال مشترک Drill-down رکوردها (§8/§9 اصلاحات) ---------------- */

  /**
   * نمایش رکوردهای عامل یک هشدار/مشکل در جدولی با ستون‌های Mapping‌شده.
   * مسیر کاربر: Summary → مشکل → رکوردهای عامل مشکل.
   * همهٔ رکوردها از طریق صفحه‌بندی قابل مشاهده‌اند (دکمه‌های ابتدا/قبلی/بعدی/انتها).
   * @param {string} title        عنوان مودال
   * @param {Array}  records      رکوردهای نرمال‌شدهٔ مدل داخلی
   * @param {object} opts         { source, subtitle }
   */
  UI.recordsDrillModal = async function (title, records, opts = {}) {
    const sourceKey = opts.source || 'rolls';
    const columns = await UI.rollDetailColumns(sourceKey);

    UI.infoModal(title, `
      <div class="drill-subtitle">
        ${opts.subtitle ? U.escapeHtml(opts.subtitle) : ''}
        <b>${U.faNum(records.length)}</b> رکورد
      </div>
      <div id="drill-table-wrap"></div>
    `);

    // صفحه‌بندی کارا: تغییر صفحه فقط جدول را دوباره رندر می‌کند (بدون بستن مودال)
    const renderPage = (page) => {
      UI.renderTable(document.getElementById('drill-table-wrap'), columns, records, {
        page,
        pageSize: RM.config.PAGE_SIZE,
        emptyText: 'رکوردی برای نمایش یافت نشد.',
        onPageChange: (nextPage) => renderPage(nextPage),
      });
    };
    renderPage(1);
  };

  /* ---------------- پنل مرتب‌سازی مشترک (چیپ‌های کشیدنی — §36-§38) ---------------- */

  /**
   * رندر «پنل مرتب‌سازی» — چیپ‌های مراحل مرتب‌سازی با کشیدن‌ورها،
   * تغییر جهت و حذف. مولفهٔ مشترک رول‌های خام و گزارش ستاپ‌ها.
   * @param {HTMLElement} wrap       عنصر نگهدارندهٔ چیپ‌ها
   * @param {Array}        pipeline  [{field, direction}]
   * @param {object}       fields    رجیستری فیلدها ({label})
   * @param {object}       handlers  { onDir(i), onRemove(i), onReorder(from, to), emptyText? }
   */
  UI.sortPanel = function (wrap, pipeline, fields, handlers) {
    wrap.innerHTML = pipeline.map((step, i) => {
      const meta = fields[step.field] || { label: step.field };
      return `
        <div class="sort-chip" draggable="true" data-index="${i}" title="برای تغییر اولویت بکشید">
          <span class="grip">${UI.icons.grip}</span>
          <span class="sort-priority">${U.faNum(i + 1)}</span>
          <span class="sort-label">${U.escapeHtml(meta.label)}</span>
          <button type="button" class="sort-dir ${step.direction}" data-dir="${i}"
                  aria-label="تغییر جهت مرتب‌سازی" title="تغییر جهت">
            ${step.direction === 'asc' ? '↑' : '↓'}
          </button>
          <button type="button" class="sort-remove" data-remove="${i}"
                  aria-label="حذف از مرتب‌سازی" title="حذف">${UI.icons.cross}</button>
        </div>`;
    }).join('') ||
      `<span class="muted" style="font-size:.78rem">${U.escapeHtml(handlers.emptyText || 'مرتب‌سازی پیش‌فرض')}</span>`;

    // تغییر جهت
    wrap.querySelectorAll('[data-dir]').forEach((btn) => {
      btn.addEventListener('click', () => handlers.onDir(Number(btn.dataset.dir)));
    });

    // حذف مرحله
    wrap.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => handlers.onRemove(Number(btn.dataset.remove)));
    });

    // ---------- کشیدن و رها کردن برای تغییر ترتیب (§37) ----------
    let dragSrcIndex = null;

    wrap.querySelectorAll('.sort-chip').forEach((chip) => {
      chip.addEventListener('dragstart', (e) => {
        dragSrcIndex = Number(chip.dataset.index);
        chip.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(dragSrcIndex));
      });

      chip.addEventListener('dragend', () => {
        chip.classList.remove('dragging');
        wrap.querySelectorAll('.sort-chip').forEach((c) => c.classList.remove('drag-over'));
        dragSrcIndex = null;
      });

      chip.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!chip.classList.contains('drag-over')) chip.classList.add('drag-over');
      });

      chip.addEventListener('dragleave', () => chip.classList.remove('drag-over'));

      chip.addEventListener('drop', (e) => {
        e.preventDefault();
        const from = dragSrcIndex;
        const to = Number(chip.dataset.index);
        if (from === null || from === to) return;
        handlers.onReorder(from, to);
      });
    });
  };

  /* ---------------- جدول بلند با فیلتر زیر سرستون‌ها (مشترک ۳ جدول) ---------------- */

  /**
   * نرمال‌سازی متن جست‌وجو — ارقام فارسی/عربی → لاتین + حذف جداکننده‌های
   * هزارگان و فاصله‌ها. هم روی «مقدار جست‌وجو» و هم روی «متن سلول» اعمال
   * می‌شود تا «۸» با 8 و «۲۳» با 23 هم‌ارزش شود.
   */
  UI.filterNormalize = function (text) {
    return U.toLatinDigits(String(text ?? ''))
      .replace(/[,\u066C\u2019\u066B\s]/g, '')
      .trim()
      .toLowerCase();
  };

  /**
   * منطق تطبیق «شامل بودن» (نسخهٔ ۲٫۳):
   *   - عدد و متن هر دو با «شامل بودن» فیلتر می‌شوند (نه تطابق دقیق)
   *   - invert = true → برعکس: «شامل نشود»
   * @param {string[]} tokens   متن‌های قابل‌جست‌وجوی سلول (نمایش + مقدار خام)
   * @param {string}   value    مقدار واردشده در باکس فیلتر
   * @param {boolean}  invert   منطق برعکس فعال است؟
   */
  UI.filterContains = function (tokens, value, invert) {
    const needle = UI.filterNormalize(value);
    if (needle === '') return true;      // فیلتر خالی → همه
    const hay = (tokens || [])
      .map((t) => UI.filterNormalize(t))
      .filter(Boolean)
      .join(' ');
    const contains = hay.includes(needle);
    return invert ? !contains : contains;
  };

  /** خواندن/ساخت وضعیت فیلتر یک ستون ({ value, invert }) از state */
  UI.filterStateOf = function (state, key) {
    if (!state.filters[key] || typeof state.filters[key] !== 'object') {
      state.filters[key] = { value: '', invert: false };
    }
    return state.filters[key];
  };

  /** آیکون «≠» دکمهٔ برعکس‌کردن منطق فیلتر */
  UI.icons.notContains = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="5.8" y1="18.2" x2="18.2" y2="5.8"/></svg>';

  /**
   * جدول بلند (حداقل ۵۰ رکورد) + فیلتر پیشرفتهٔ زیر سرستون‌ها — مولفهٔ
   * مشترک جدول‌های «رول‌های برش‌خورده»، «رول‌های خام» و «گزارش ستاپ‌ها».
   *
   * منطق نسخهٔ ۲٫۳:
   *   - فیلتر همهٔ ستون‌ها (عدد و متن) با «شامل بودن» + ارقام فارسی/لاتین
   *   - دکمهٔ کوچک «≠» کنار هر باکس → سوییچ «شامل نشود»
   *   - فوکوس باکس فیلتر حفظ می‌شود (فقط tbody دوباره رندر می‌شود،
   *     سرستون/باکس‌ها بازسازی نمی‌شوند و فوکوس جابه‌جا نمی‌شود)
   *   - سرستون + ردیف فیلتر چسبان هنگام اسکرول عمودی
   *
   * منطق نسخهٔ ۲٫۴:
   *   - باکس «ردیف‌های قابل نمایش» در نوار پایین → ارتفاع جدول داینامیک
   *     (فقط استایل ارتفاع به‌روز می‌شود؛ جدول/فیلترها/فوکوس دست‌نخورده)
   *   - پشتیبانی عرض ستون (c.width → colgroup با table-layout:fixed)
   *
   * منطق نسخهٔ ۲٫۵:
   *   - Wrap Text هدرها: عنوان ستون‌ها با توجه به عرض ستون چندخط می‌شود؛
   *     ارتفاع ردیف سرستون اندازه‌گیری و در متغیر --ft-head-h ثبت می‌شود تا
   *     ردیف فیلتر چسبان دقیقاً زیر آن بنشیند (ResizeObserver → هم‌گام با تغییر عرض)
   *   - چیدمان باکس فیلتر: آیکون «≠» کوچک در سمت راست + باکس فیلتر در ادامه
   *     که عرضش با عرض ستون تنظیم می‌شود (min-width: 0 → هرگز ناقص نمی‌شود)
   *
   * منطق نسخهٔ ۲٫۶:
   *   - باکس‌های جمع (opts.sums): زیر ستون‌های عددی/زمانی، ردیف پایانی چسبان
   *     (tfoot) با جمع همان ستون — جمع همیشه با دیتای «فیلترشدهٔ» فعلی
   *     محاسبه می‌شود و با هر فیلتر/تغییر، به‌روز می‌شود.
   *
   * @param {HTMLElement} wrap     نگهدارندهٔ جدول
   * @param {Array}  columns       [{key, label, render(row)→html, tokens(row)→string[],
   *                                className?, filterable? (پیش‌فرض true), width? (px — نسخهٔ ۲٫۴)}]
   * @param {Array}  rows          همهٔ رکوردها (مرتب‌شده توسط فراخوان)
   * @param {object} opts          { state: {filters:{}, visibleRows?} (ماندگار بین رندرها),
   *                                visibleRows, rowHeight, tableClass, emptyText,
   *                                filteredEmptyText, footerNote, rowsControl? (bool — باکس تعداد ردیف),
   *                                onRowsChange?(n) (ذخیرهٔ ماندگار),
   *                                fixedCols? (bool — table-layout:fixed برای عرض‌های ستون),
   *                                sums? ({ colKey: {type:'number'|'time'|'pair',
   *                                        weightOf?(row,key)→number } }) — نسخهٔ ۲٫۶,
   *                                onRendered(visibleRows) }
   */
  UI.filterTable = function (wrap, columns, rows, opts = {}) {
    if (!wrap) return;
    const state = opts.state || { filters: {} };
    state.filters = state.filters || {};
    // تعداد ردیف قابل نمایش (نسخهٔ ۲٫۴): اولویت با state کاربر (ماندگار)، بعد opts
    if (!Number.isFinite(Number(state.visibleRows)) || Number(state.visibleRows) <= 0) {
      state.visibleRows = opts.visibleRows || 50;
    }
    const rowHeight = opts.rowHeight || 42;
    const tableClass = opts.tableClass || 'cut-table';
    const filterableCols = columns.filter((c) => c.filterable !== false);

    /* ---------- تطبیق یک رکورد با همهٔ فیلترهای فعال ---------- */
    const rowMatches = (row) => filterableCols.every((c) => {
      const f = UI.filterStateOf(state, c.key);
      if (String(f.value ?? '').trim() === '') return true;
      return UI.filterContains(c.tokens ? c.tokens(row) : [String(row[c.key] ?? '')], f.value, f.invert);
    });

    /* ---------- ساخت سرستون + ردیف فیلتر (یک‌بار در هر رندر کامل) ---------- */
    const headRow = columns.map((c) => `<th${c.headerTitle ? ` title="${U.escapeHtml(c.headerTitle)}"` : ''}${c.width ? ` style="width:${Number(c.width)}px;min-width:${Number(c.width)}px"` : ''}>${c.label}</th>`).join('');
    const filterRow = columns.map((c) => {
      if (c.filterable === false) return '<th class="cut-filter-cell"></th>';
      const f = UI.filterStateOf(state, c.key);
      return `
      <th class="cut-filter-cell" aria-label="فیلتر ${U.escapeHtml(String(c.label))}">
        <div class="ft-filter-box">
          <button type="button" class="ft-invert${f.invert ? ' on' : ''}" data-ft-invert="${U.escapeHtml(c.key)}"
                  aria-pressed="${String(!!f.invert)}"
                  title="${f.invert ? 'منطق فعلی: شامل نشود — برای بازگشت به «شامل بودن» کلیک کنید' : 'برعکس‌کردن منطق: شامل نشود'}"
                  aria-label="برعکس‌کردن منطق فیلتر ستون ${U.escapeHtml(String(c.label))}">
            ${UI.icons.notContains}
          </button>
          <input type="text" class="cut-filter-input" data-ft-filter="${U.escapeHtml(c.key)}"
                 value="${U.escapeHtml(f.value ?? '')}"
                 autocomplete="off" placeholder="فیلتر…" inputmode="text"
                 aria-label="فیلتر ستون ${U.escapeHtml(String(c.label))}">
        </div>
      </th>`;
    }).join('');

    /* ---------- باکس‌های جمع زیر ستون‌ها (نسخهٔ ۲٫۶) ----------
       opts.sums = { colKey: { type: 'number' | 'time' | 'pair',
                               weightOf?: (row, key) => number|null } }
       جمع همیشه از دیتای فیلترشدهٔ فعلی (visible) محاسبه می‌شود. */
    const sumSpecs = opts.sums || null;
    const hasSums = !!(sumSpecs && Object.keys(sumSpecs).length);

    /** ساخت HTML یک باکس جمع بر اساس نوع ستون */
    const sumBoxHtml = (spec, cnt, wt, skipped) => {
      if (spec.type === 'pair') {
        return `<span class="ft-sum-sigma" aria-hidden="true">Σ</span>
          <span class="ft-sum-pair">
            <b class="ft-sum-val">${U.faNum(cnt)}</b>
            <span class="ft-sum-wgt">Σ ${U.faWeightDot(wt)}</span>
          </span>`;
      }
      const val = spec.type === 'time' ? U.faHMM(cnt) : U.faNum(cnt);
      return `<span class="ft-sum-sigma" aria-hidden="true">Σ</span>
        <b class="ft-sum-val${spec.type === 'time' ? ' ft-sum-time' : ''}">${val}</b>`
        + (skipped ? `<sup class="ft-sum-skip" title="${U.faNum(skipped)} رکورد بدون قانون در جمع لحاظ نشد">*</sup>` : '');
    };

    /** به‌روزرسانی همهٔ باکس‌های جمع از ردیف‌های فیلترشده */
    const updateSums = (visible) => {
      if (!hasSums) return;
      for (const c of columns) {
        const spec = sumSpecs[c.key];
        if (!spec) continue;
        const box = wrap.querySelector(`[data-ft-sum-box="${c.key}"]`);
        if (!box) continue;

        if (spec.type === 'pair') {
          let cnt = 0, wt = 0;
          for (const row of visible) {
            const v = Number(row[c.key]);
            if (Number.isFinite(v)) cnt += v;
            const w = spec.weightOf ? Number(spec.weightOf(row, c.key)) : NaN;
            if (Number.isFinite(w)) wt += w;
          }
          box.innerHTML = sumBoxHtml(spec, cnt, wt, 0);
          box.parentElement.title =
            `جمع ستون «${String(c.label)}» با دیتای فیلترشده — ردیف اول: جمع تعداد · ردیف دوم: جمع وزن`;
          continue;
        }

        let total = 0, counted = 0;
        for (const row of visible) {
          const v = row[c.key];
          if (v === null || v === undefined || v === '') continue;   // «بدون قانون» و تهی‌ها
          const n = Number(v);
          if (Number.isFinite(n)) { total += n; counted++; }
        }
        const skipped = spec.type === 'time' ? (visible.length - counted) : 0;
        box.innerHTML = sumBoxHtml(spec, total, 0, skipped);
        box.parentElement.title = `جمع ستون «${String(c.label)}» — با دیتای فیلترشدهٔ فعلی`
          + (spec.type === 'time' ? ` (${U.faNum(counted)} رکورد دارای قانون)` : '');
      }
    };

    /* ---------- رندر بدنه (ایزوله — سرستون دست‌نخورده می‌ماند) ---------- */
    const renderBody = () => {
      const visible = rows.filter(rowMatches);
      const tbody = wrap.querySelector('.ft-tbody');
      const statusEl = wrap.querySelector('.ft-status');
      if (!tbody) return visible;

      const activeCount = filterableCols.filter((c) =>
        String(UI.filterStateOf(state, c.key).value ?? '').trim() !== '').length;

      tbody.innerHTML = visible.length
        ? visible.map((row) => {
            const cells = columns.map((c) => {
              const content = c.render ? c.render(row) : U.escapeHtml(row[c.key] ?? '—');
              return `<td class="${c.className || ''}">${content}</td>`;
            }).join('');
            return `<tr>${cells}</tr>`;
          }).join('')
        : `<tr><td colspan="${columns.length}" class="muted" style="text-align:center;padding:18px">${
            rows.length
              ? (opts.filteredEmptyText || 'هیچ رکوردی با فیلترهای فعلی مطابقت ندارد — فیلترها را پاک کنید.')
              : (opts.emptyText || 'داده‌ای برای نمایش وجود ندارد.')
          }</td></tr>`;

      if (statusEl) {
        statusEl.innerHTML = activeCount
          ? `<span class="chip chip-strong">${U.faNum(visible.length)} از ${U.faNum(rows.length)} رکورد (فیلترشده)</span>`
          : `<span class="chip">${U.faNum(rows.length)} رکورد</span>`;
      }

      updateSums(visible);     // نسخهٔ ۲٫۶: جمع‌ها با دیتای فیلترشده به‌روز می‌شوند

      if (typeof opts.onRendered === 'function') opts.onRendered(visible, rows);
      return visible;
    };

    /* ---------- اسکلت جدول (یک‌بار) ---------- */
    if (!rows.length && !Object.values(state.filters).some((f) => f && String(f.value ?? '').trim() !== '')) {
      wrap.innerHTML = `
        <div class="empty-state">
          ${UI.icons.alert}
          <h4>رکوردی برای نمایش وجود ندارد</h4>
          <p>${opts.emptyText || 'داده‌ای برای نمایش وجود ندارد.'}</p>
        </div>`;
      if (typeof opts.onRendered === 'function') opts.onRendered([], rows);
      return;
    }

    const applyHeight = (scrollEl, n) => {
      scrollEl.style.height = `calc(${n} * ${rowHeight}px)`;
      scrollEl.style.maxHeight = `calc(${n} * ${rowHeight}px)`;
    };

    // colgroup عرض ستون‌ها (نسخهٔ ۲٫۴) + جدول fixed-cols در صورت وجود عرض
    const hasWidths = columns.some((c) => c.width);
    const colgroup = hasWidths
      ? `<colgroup>${columns.map((c) => `<col${c.width ? ` style="width:${Number(c.width)}px"` : ''}>`).join('')}</colgroup>`
      : '';

    const heightStyle = `height: calc(${state.visibleRows} * ${rowHeight}px); max-height: calc(${state.visibleRows} * ${rowHeight}px);`;

    /* ردیف جمع چسبان زیر جدول (نسخهٔ ۲٫۶) — sticky bottom، هم‌عرض ستون‌ها؛
       مقدار هر باکس در renderBody/updateSums با دیتای فیلترشده پر می‌شود. */
    const sumFoot = hasSums
      ? `<tfoot class="ft-sum-row"><tr>${columns.map((c) => {
          if (!sumSpecs[c.key]) return '<td class="ft-sum-cell"></td>';
          return `<td class="ft-sum-cell">
            <div class="ft-sum-box" data-ft-sum-box="${c.key}"><span class="muted">…</span></div>
          </td>`;
        }).join('')}</tr></tfoot>`
      : '';

    wrap.innerHTML = `
      <div class="cut-table-scroll" style="${heightStyle}">
        <table class="data-table ${tableClass}${hasWidths ? ' fixed-cols' : ''}">
          ${colgroup}
          <thead>
            <tr class="cut-head-row">${headRow}</tr>
            <tr class="cut-filter-row">${filterRow}</tr>
          </thead>
          <tbody class="ft-tbody"></tbody>
          ${sumFoot}
        </table>
      </div>
      <div class="cut-filter-bar">
        <span class="muted" style="font-size:.7rem">${opts.footerNote || 'فیلتر هر ستون در زیر سرستون همان ستون · منطق: شامل بودن (عدد و متن)'}</span>
        <span class="ft-status"></span>
        ${opts.rowsControl === false ? '' : `
        <label class="ft-rows" title="تعداد ردیف قابل نمایش قبل از اسکرول — ارتفاع جدول طبق این عدد تغییر می‌کند">
          <span>ردیف‌های قابل نمایش:</span>
          <input type="number" class="ft-rows-input" data-ft-rows min="${RM.config.VISIBLE_ROWS_MIN}" max="${RM.config.VISIBLE_ROWS_MAX}" step="1" value="${state.visibleRows}" inputmode="numeric" aria-label="تعداد ردیف قابل نمایش">
        </label>`}
        <button type="button" class="btn btn-ghost btn-sm" data-ft-clear>پاک‌کردن فیلترها</button>
      </div>`;

    /* ---------- ارتفاع داینامیک سرستون (Wrap Text — نسخهٔ ۲٫۵) ----------
       عنوان ستون‌ها ممکن است با عرض کم ستون چندخط شود؛ ارتفاع واقعی ردیف
       سرستون اندازه‌گیری و در متغیر CSS --ft-head-h ثبت می‌شود تا ردیف فیلتر
       چسبان دقیقاً زیر آن بنشیند. ResizeObserver تغییر عرض (پنل عرض ستون‌ها /
       تغییر اندازهٔ پنجره) را دنبال می‌کند و مقدار را هم‌گام نگه می‌دارد. */
    const syncHeadHeight = () => {
      const headTr = wrap.querySelector('.cut-head-row');
      if (!headTr) return;
      const h = headTr.offsetHeight;
      if (h > 0) wrap.style.setProperty('--ft-head-h', `${h}px`);
    };
    syncHeadHeight();
    if (typeof ResizeObserver !== 'undefined') {
      const headTr = wrap.querySelector('.cut-head-row');
      if (wrap._ftHeadRO) { try { wrap._ftHeadRO.disconnect(); } catch (e) { /* noop */ } }
      if (headTr) {
        wrap._ftHeadRO = new ResizeObserver(syncHeadHeight);
        wrap._ftHeadRO.observe(headTr);
      }
    }

    /* ---------- رویدادها ---------- */

    // ورود متن فیلتر → فقط tbody دوباره رندر می‌شود (فوکوس و caret حفظ می‌شود)
    let timer = null;
    wrap.querySelectorAll('[data-ft-filter]').forEach((el) => {
      el.addEventListener('input', () => {
        const f = UI.filterStateOf(state, el.dataset.ftFilter);
        f.value = el.value;
        clearTimeout(timer);
        timer = setTimeout(renderBody, 180);
      });
    });

    // دکمهٔ کوچک «≠» → سوییچ منطق شامل‌بودن/شامل‌نشدن
    wrap.querySelectorAll('[data-ft-invert]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const f = UI.filterStateOf(state, btn.dataset.ftInvert);
        f.invert = !f.invert;
        btn.classList.toggle('on', f.invert);
        btn.setAttribute('aria-pressed', String(f.invert));
        btn.title = f.invert
          ? 'منطق فعلی: شامل نشود — برای بازگشت به «شامل بودن» کلیک کنید'
          : 'برعکس‌کردن منطق: شامل نشود';
        renderBody();
      });
    });

    // پاک‌کردن همهٔ فیلترها
    wrap.querySelector('[data-ft-clear]').addEventListener('click', () => {
      for (const c of filterableCols) {
        const f = UI.filterStateOf(state, c.key);
        f.value = '';
        f.invert = false;
      }
      wrap.querySelectorAll('[data-ft-filter]').forEach((el) => { el.value = ''; });
      wrap.querySelectorAll('[data-ft-invert]').forEach((b) => {
        b.classList.remove('on');
        b.setAttribute('aria-pressed', 'false');
        b.title = 'برعکس‌کردن منطق: شامل نشود';
      });
      renderBody();
      UI.toast('فیلترها پاک شد.', 'info');
    });

    // باکس «ردیف‌های قابل نمایش» (نسخهٔ ۲٫۴) — فقط ارتفاع اسکرول تغییر می‌کند؛
    // جدول/فیلترها/فوکوس دست‌نخورده می‌مانند. ماندگاری با onRowsChange.
    const rowsInput = wrap.querySelector('[data-ft-rows]');
    if (rowsInput) {
      let rowsTimer = null;
      rowsInput.addEventListener('input', () => {
        clearTimeout(rowsTimer);
        rowsTimer = setTimeout(() => {
          const n = Math.min(
            Math.max(U.parseInt(rowsInput.value) || RM.config.VISIBLE_ROWS_MIN, RM.config.VISIBLE_ROWS_MIN),
            RM.config.VISIBLE_ROWS_MAX
          );
          state.visibleRows = n;
          rowsInput.value = String(n);
          const scrollEl = wrap.querySelector('.cut-table-scroll');
          if (scrollEl) applyHeight(scrollEl, n);
          if (typeof opts.onRowsChange === 'function') opts.onRowsChange(n);
        }, 260);
      });
    }

    renderBody();
  };

  /* ---------------- پنل ترتیب ستون‌ها (مشترک — چیپ‌های کشیدنی + باکس عرض) ---------------- */

  /**
   * پنل «ترتیب ستون‌ها» — نسخهٔ ۲٫۴:
   *   - ترتیب با کشیدن‌ورها (drag) تغییر می‌کند (فلش‌های ↑/↓ حذف شدند)
   *   - بجای فلش‌ها، هر ستون یک باکس عددی «عرض (px)» دارد؛ کاربر عرض دلخواه
   *     هر ستون را وارد می‌کند (صفر یا خالی → عرض خودکار)
   * برای جدول «گزارش تولید ستاپ‌ها».
   * @param {HTMLElement} wrap      عنصر نگهدارندهٔ چیپ‌ها
   * @param {Array}        items    [{key, label, width}] به ترتیب فعلی
   * @param {object}       handlers { onMove(from, to), onWidth(key, width), emptyText? }
   */
  UI.orderPanel = function (wrap, items, handlers) {
    if (!wrap) return;
    wrap.innerHTML = items.map((it, i) => `
      <div class="sort-chip order-chip" draggable="true" data-index="${i}" title="برای تغییر ترتیب بکشید">
        <span class="grip">${UI.icons.grip}</span>
        <span class="sort-priority">${U.faNum(i + 1)}</span>
        <span class="sort-label">${U.escapeHtml(it.label)}</span>
        <label class="order-width" title="عرض این ستون در جدول (پیکسل) — صفر یا خالی = خودکار">
          <span class="order-width-unit">px</span>
          <input type="number" class="order-width-input" data-order-width="${U.escapeHtml(it.key)}"
                 min="0" max="1200" step="1" inputmode="numeric" aria-label="عرض ستون ${U.escapeHtml(it.label)}"
                 value="${it.width != null ? Number(it.width) : ''}" placeholder="خودکار">
        </label>
      </div>`).join('') ||
      `<span class="muted" style="font-size:.78rem">${U.escapeHtml(handlers.emptyText || 'بدون ستون')}</span>`;

    // باکس عرض هر ستون (نسخهٔ ۲٫۴) — debounce سبک؛ خالی/۰ = عرض خودکار
    let widthTimer = null;
    wrap.querySelectorAll('[data-order-width]').forEach((inp) => {
      inp.addEventListener('input', () => {
        clearTimeout(widthTimer);
        const key = inp.dataset.orderWidth;
        widthTimer = setTimeout(() => {
          const v = U.parseInt(inp.value);
          handlers.onWidth(key, v === null ? 0 : Math.min(Math.max(v, 0), 1200));
        }, 320);
      });
    });

    // کشیدن و رها کردن
    let dragSrcIndex = null;
    wrap.querySelectorAll('.order-chip').forEach((chip) => {
      chip.addEventListener('dragstart', (e) => {
        dragSrcIndex = Number(chip.dataset.index);
        chip.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(dragSrcIndex));
      });
      chip.addEventListener('dragend', () => {
        chip.classList.remove('dragging');
        wrap.querySelectorAll('.order-chip').forEach((c) => c.classList.remove('drag-over'));
        dragSrcIndex = null;
      });
      chip.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!chip.classList.contains('drag-over')) chip.classList.add('drag-over');
      });
      chip.addEventListener('dragleave', () => chip.classList.remove('drag-over'));
      chip.addEventListener('drop', (e) => {
        e.preventDefault();
        const from = dragSrcIndex;
        const to = Number(chip.dataset.index);
        if (from === null || from === to) return;
        handlers.onMove(from, to);
      });
    });
  };

  RM.ui = UI;
})();
