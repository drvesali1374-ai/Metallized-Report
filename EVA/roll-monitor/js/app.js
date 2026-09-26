/* =========================================================================
   app.js — راه‌انداز برنامه (bootstrap)
   -------------------------------------------------------------------------
   بارگذاری لایهٔ داده (IndexedDB + درج دادهٔ اولیه در نخستین اجرا) →
   ساخت اسنپ‌شات (تنظیمات + رول‌ها + آخرین Import) → رندر زبانه‌ها.
   زبانهٔ فعال و زیرزبانه‌ها و وضعیت جداول در localStorage ماندگارند.
   ========================================================================= */
(function () {
  'use strict';

  var TABS = ['dashboard', 'import', 'rolls', 'settings', 'help'];
  var TAB_KEY = 'eva-active-tab';

  var activeTab = 'dashboard';
  var snapshot = null; // { settings, rolls, lastBatch, headers }
  var booted = false;

  /* =========================================================================
     اسنپ‌شات داده
     ========================================================================= */

  function loadSnapshot() {
    return Promise.all([Store.getAllRolls(), Store.getLastBatch()]).then(function (results) {
      var rolls = results[0];
      var lastBatch = results[1];
      snapshot = {
        settings: Store.getSettings(),
        rolls: rolls,
        lastBatch: lastBatch,
        headers: lastBatch ? EVA.parseJsonArray(lastBatch.headers) : [],
      };
      return snapshot;
    });
  }

  /* =========================================================================
     زبانه‌ها
     ========================================================================= */

  function activateTab(tab, opts) {
    if (TABS.indexOf(tab) === -1) tab = 'dashboard';
    activeTab = tab;
    localStorage.setItem(TAB_KEY, tab);

    TABS.forEach(function (t) {
      var btn = document.getElementById('tab-' + t);
      var sec = document.getElementById('view-' + t);
      var on = t === tab;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
      btn.setAttribute('tabindex', on ? '0' : '-1');
      sec.hidden = !on;
    });

    renderActiveView();
    if (!opts || !opts.noScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderActiveView() {
    if (!snapshot) return;
    var sec = document.getElementById('view-' + activeTab);
    var view = EvaViews[activeTab];
    if (view) view.render(sec, snapshot);
  }

  /** بازرندر نمای فعلی با همان اسنپ‌شات (بدون خواندن مجدد داده) */
  function rerender() {
    renderActiveView();
  }

  /** خواندن مجدد داده از IndexedDB + بازرندر نمای فعال + بج سربرگ */
  function refreshAll() {
    return loadSnapshot().then(function () {
      renderHeader();
      renderActiveView();
    });
  }

  /** ناوبری برنامه‌ای بین زبانه‌ها */
  function navigate(tab) {
    activateTab(tab);
  }

  /* =========================================================================
     سربرگ و پاصفحه
     ========================================================================= */

  function renderHeader() {
    var side = document.getElementById('header-side');
    if (snapshot.lastBatch) {
      var li = snapshot.lastBatch;
      side.innerHTML =
        '<span class="badge badge-secondary header-badge" title="آخرین ورود: ' + UI.esc(li.fileName) + ' — ' + Fmt.faDateTime(li.importedAt) + '">' +
        UI.icon('file-spreadsheet', 14) +
        '<span class="truncate" style="max-width:180px">' + UI.esc(li.fileName) + '</span>' +
        '<span style="opacity:.7">·</span><span style="opacity:.7">' + Fmt.faInt(li.totalRows) + ' سطر</span>' +
        '</span>';
    } else {
      side.innerHTML =
        '<span class="badge badge-outline header-badge"><span class="txt-amber">' + UI.icon('alert-triangle', 14) + '</span>داده‌ای وارد نشده است</span>';
    }
    UI.hydrateIcons(side);
  }

  function renderFooter() {
    document.getElementById('footer-version').textContent =
      'سامانه مانیتورینگ رول‌های EVA — نسخهٔ ' + Fmt.toFaDigits(EVA.APP_VERSION).replace('.', '٫') + ' (آفلاین)';
  }

  /* =========================================================================
     راه‌اندازی
     ========================================================================= */

  function showFatal(message) {
    var main = document.getElementById('main');
    main.innerHTML =
      '<div class="alert alert-destructive" role="alert">' + UI.icon('alert-circle', 18) +
      '<div class="alert-body"><p class="alert-title">خطا در راه‌اندازی پایگاه دادهٔ مرورگر</p>' +
      '<p style="line-height:1.9">' + UI.esc(message) + '</p>' +
      '<p class="text-xs txt-muted">برای استفادهٔ آفلاین، مرورگر باید IndexedDB را برای فایل‌های محلی فعال کرده باشد (کروم/اج/فایرفاکس پشتیبانی می‌کنند). اگر فایل را مستقیم باز کرده‌اید و مشکل ادامه داشت، صفحه را از طریق آدرس serv شده باز کنید.</p>' +
      '</div></div>';
    UI.hydrateIcons(main);
  }

  function boot() {
    if (booted) return;
    booted = true;

    // آیکون سربرگ و پاصفحه
    document.getElementById('brand-icon').innerHTML = UI.icon('factory', 22);
    UI.hydrateIcons(document.body);
    renderFooter();

    // اسکلت بارگذاری تا آماده‌شدن داده
    var initialTab = localStorage.getItem(TAB_KEY);
    if (TABS.indexOf(initialTab) === -1) initialTab = 'dashboard';
    activeTab = initialTab;
    document.getElementById('view-' + initialTab).innerHTML = UI.skeletonHtml(6);

    // رویدادهای زبانه‌ها
    document.querySelectorAll('#tabs-bar .tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activateTab(btn.getAttribute('data-tab'));
      });
    });

    // ناوبری از طریق رویداد سفارشی (Empty State ها)
    window.addEventListener('eva:navigate', function (e) {
      if (typeof e.detail === 'string' && TABS.indexOf(e.detail) !== -1) activateTab(e.detail);
    });

    Store.ready()
      .then(loadSnapshot)
      .then(function () {
        renderHeader();
        activateTab(activeTab, { noScroll: true });
      })
      .catch(function (e) {
        console.error('[app] خطای راه‌اندازی:', e);
        showFatal((e && e.message) || 'خطای ناشناخته هنگام بازکردن پایگاه دادهٔ مرورگر.');
      });

    // بازترسیم نمودارها پس از آماده‌شدن کامل فونت وزیرمتن
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (window.EvaCharts) EvaCharts.redrawAll();
      });
    }
  }

  /* ---------------- انتشار سراسری ---------------- */
  window.App = {
    navigate: navigate,
    rerender: rerender,
    refreshAll: refreshAll,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
