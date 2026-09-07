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

  RM.ui = UI;
})();
