/* =========================================================================
   ui.js — ابزارهای رابط کاربری مشترک (آیکون‌ها، Toast، دیالوگ، پاپ‌اور)
   -------------------------------------------------------------------------
   · آیکون‌های SVG خطی (هم‌خانوادهٔ لوسید نسخهٔ وب) — کاملاً آفلاین
   · Toast در گوشهٔ پایین-چپ (همانند نسخهٔ وب)
   · دیالوگ مودال با بستن با Esc/کلیک بیرون
   · پاپ‌اور برای پنل‌های «مرتب‌سازی» و «ترتیب ستون‌ها»
   ========================================================================= */
(function () {
  'use strict';

  /* ---------------- گریز HTML ---------------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* =========================================================================
     آیکون‌ها — مسیرهای SVG (stroke) با مختصات 24×24
     ========================================================================= */
  var P = {
    'layout-dashboard': '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
    rolls: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/>',
    'settings-2': '<path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
    'book-open': '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    factory: '<path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/>',
    package: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    scissors: '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
    'alert-circle': '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
    'alert-triangle': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
    eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
    'eye-off': '<path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>',
    'bar-chart': '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    'pie-chart': '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
    'file-spreadsheet': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    weight: '<circle cx="12" cy="5" r="3"/><path d="M6.5 8a2 2 0 0 0-1.9 1.46L2.1 18.5A2 2 0 0 0 4 21h16a2 2 0 0 0 1.93-2.54L19.4 9.5A2 2 0 0 0 17.48 8Z"/>',
    'list-filter': '<path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/>',
    save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    rotate: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    loader: '<path d="M21 12a9 9 0 1 1-6.22-8.56"/>',
    tag: '<path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
    ruler: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/>',
    gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
    'hard-drive-download': '<path d="M12 2v8"/><path d="m16 6-4 4-4-4"/><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6 18h.01"/><path d="M10 18h.01"/>',
    'archive-restore': '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="m10 12 2-2 2 2"/><path d="M12 10v6"/>',
    'arrow-up-down': '<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>',
    columns: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/>',
    'filter-x': '<path d="M13.01 3H2l8 9.46V19l4 2v-8.54l.9-1.06"/><path d="M22 3l-5 5"/><path d="M17 3l5 5"/>',
    grip: '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>',
    'circle-help': '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
    table: '<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>',
    'arrow-up': '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    'arrow-down': '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
    boxes: '<rect width="8" height="8" x="3" y="3" rx="1"/><rect width="8" height="8" x="13" y="13" rx="1"/><path d="M11 7h4a1 1 0 0 1 1 1v4"/><path d="M7 11v4a1 1 0 0 0 1 1h4"/>',
  };

  /** ساخت HTML آیکون با نام */
  function icon(name, size) {
    var s = size || 16;
    var body = P[name] || P.info;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + s + '" height="' + s +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      body + '</svg>';
  }

  /** پرکردن همهٔ عناصر [data-icon] داخل یک عنصر */
  function hydrateIcons(root) {
    (root || document).querySelectorAll('[data-icon]').forEach(function (el) {
      el.innerHTML = icon(el.getAttribute('data-icon'));
      el.style.display = 'inline-flex';
      el.style.flexShrink = '0';
    });
  }

  /* =========================================================================
     Toast (گوشهٔ پایین-چپ — همانند نسخهٔ وب)
     ========================================================================= */
  var toastZone = null;

  function toast(kind, title, description) {
    if (!toastZone) toastZone = document.getElementById('toast-zone');
    if (!toastZone) return;
    var el = document.createElement('div');
    el.className = 'toast toast-' + kind;
    var iconName = kind === 'success' ? 'check-circle' : kind === 'error' ? 'alert-circle' : 'info';
    el.innerHTML =
      '<span class="' + (kind === 'success' ? 'txt-green' : kind === 'error' ? 'txt-red' : 'txt-primary') + '">' + icon(iconName, 18) + '</span>' +
      '<div style="min-width:0">' +
      '<p class="t-title" style="margin:0">' + esc(title) + '</p>' +
      (description ? '<p class="t-desc" style="margin:2px 0 0">' + esc(description) + '</p>' : '') +
      '</div>';
    toastZone.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 300);
    }, kind === 'error' ? 6000 : 4200);
  }

  var toastApi = {
    success: function (title, opts) { toast('success', title, opts && opts.description); },
    error: function (title, opts) { toast('error', title, opts && opts.description); },
    info: function (title, opts) { toast('info', title, opts && opts.description); },
  };

  /* =========================================================================
     دیالوگ مودال
     ========================================================================= */
  var openDialogs = [];

  /**
   * ساخت دیالوگ — opts:
   *   title, desc, bodyHtml, wide, footerHtml, onMount(dlg), persistent
   * خروجی: { el, close() }
   */
  function dialog(opts) {
    var overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML =
      '<div class="dialog' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" dir="rtl">' +
      '  <div class="dialog-head">' +
      '    <h3 class="dialog-title">' + (opts.title || '') + '</h3>' +
      (opts.desc ? '<p class="dialog-desc">' + opts.desc + '</p>' : '') +
      '  </div>' +
      '  <div class="dialog-body">' + (opts.bodyHtml || '') + '</div>' +
      (opts.footerHtml ? '<div class="dialog-foot">' + opts.footerHtml + '</div>' : '') +
      '</div>';

    function close() {
      var i = openDialogs.indexOf(api);
      if (i >= 0) openDialogs.splice(i, 1);
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) {
      if (e.key === 'Escape' && !opts.persistent) close();
    }

    if (!opts.persistent) {
      overlay.addEventListener('mousedown', function (e) {
        if (e.target === overlay) close();
      });
      document.addEventListener('keydown', onKey);
    }

    document.body.appendChild(overlay);
    var api = { el: overlay, close: close, dialogEl: overlay.querySelector('.dialog') };
    openDialogs.push(api);
    if (opts.onMount) opts.onMount(api);
    return api;
  }

  /* =========================================================================
     پاپ‌اور (پنل مرتب‌سازی/ترتیب ستون‌ها) — بسته‌شدن با کلیک بیرون یا Esc
     ========================================================================= */
  var activePopover = null;

  function closePopover() {
    if (activePopover) {
      activePopover.el.remove();
      document.removeEventListener('mousedown', activePopover.onDoc, true);
      document.removeEventListener('keydown', activePopover.onKey, true);
      activePopover = null;
    }
  }

  /**
   * نمایش پنل زیر لنگر (دکمه) — contentEl عنصر آمادهٔ HTML است.
   * opts.onClose هنگام بسته‌شدن صدا زده می‌شود.
   */
  function popover(anchor, contentEl, opts) {
    closePopover();
    var panel = document.createElement('div');
    panel.className = 'popover';
    panel.dir = 'rtl';
    panel.appendChild(contentEl);
    document.body.appendChild(panel);

    var rect = anchor.getBoundingClientRect();
    var panelWidth = 340;
    var left = Math.min(Math.max(8, rect.left), window.innerWidth - panelWidth - 8);
    var top = rect.bottom + window.scrollY + 6;
    // اگر به پایین صفحه نزدیک است، پنل را بالای دکمه باز کن
    var estHeight = Math.min(panel.offsetHeight || 320, 420);
    if (rect.bottom + estHeight > window.innerHeight && rect.top - estHeight > 8) {
      top = rect.top + window.scrollY - estHeight - 6;
    }
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';

    function onDoc(e) {
      if (!panel.contains(e.target) && !anchor.contains(e.target)) closePopover();
    }
    function onKey(e) {
      if (e.key === 'Escape') closePopover();
    }
    document.addEventListener('mousedown', onDoc, true);
    document.addEventListener('keydown', onKey, true);
    activePopover = {
      el: panel,
      onDoc: onDoc,
      onKey: onKey,
      onClose: opts && opts.onClose,
    };
    return panel;
  }

  // closePopover باید onClose را هم صدا بزند
  var _closePopover = closePopover;
  closePopover = function () {
    if (activePopover) {
      var cb = activePopover.onClose;
      _closePopover();
      if (cb) cb();
    }
  };

  /* =========================================================================
     ابزارهای DOM
     ========================================================================= */

  /** ساخت عنصر از HTML */
  function elFromHtml(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  /* =========================================================================
     وضعیت خالی مشترک (EmptyDataState نسخهٔ وب)
     ========================================================================= */
  function emptyStateHtml(title, description, actionLabel) {
    return (
      '<div class="empty-state">' +
      '<div class="icon">' + icon('database', 32) + '</div>' +
      '<div><h3>' + esc(title) + '</h3><p>' + esc(description) + '</p></div>' +
      (actionLabel
        ? '<button type="button" class="btn btn-primary btn-lg eva-goto-import">' + esc(actionLabel) + '</button>'
        : '') +
      '</div>'
    );
  }

  /** اسکلتون بارگذاری */
  function skeletonHtml(cards) {
    var out = '<div class="kpi-grid">';
    for (var i = 0; i < (cards || 6); i++) {
      out += '<div class="skeleton-card"><div class="skeleton" style="height:12px;width:66%"></div><div class="skeleton" style="height:24px;width:50%"></div><div class="skeleton" style="height:12px;width:75%"></div></div>';
    }
    out += '</div><div class="skeleton" style="height:340px"></div>';
    return out;
  }

  /* ---------------- انتشار سراسری ---------------- */
  window.UI = {
    esc: esc,
    icon: icon,
    hydrateIcons: hydrateIcons,
    toast: toastApi,
    dialog: dialog,
    popover: popover,
    closePopover: closePopover,
    elFromHtml: elFromHtml,
    emptyStateHtml: emptyStateHtml,
    skeletonHtml: skeletonHtml,
  };
})();
