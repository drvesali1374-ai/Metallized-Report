/* =========================================================================
   views/rolls.js — رول‌ها (پورت rolls-view.tsx)
   -------------------------------------------------------------------------
   سه زیرزبانهٔ «رولهای خام» / «رولهای EVA» / «رولهای برش خورده» + جدول
   گروه‌های برش با سلول‌های دوخطی گرید و دیالوگ جزئیات هر گروه.
   همهٔ جداول با کارخانهٔ DataTable (فیلتر ستونی/≠، مرتب‌سازی چندسطحی،
   ترتیب ستون‌ها، ردیف‌های قابل نمایش، جمع ستونی) + ماندگاری زیرزبانه.
   ========================================================================= */
(function () {
  'use strict';

  var SUB_TABS = ['raw', 'eva', 'cut'];
  var SUBTAB_KEY = 'eva-rolls-subtab';

  /* =========================================================================
     ستون‌های جداول
     ========================================================================= */

  /** ستون‌های جدول رول خام / EVA (پورت rolls-view.tsx) */
  function rollColumns(category) {
    var cols = [
      {
        key: 'rollNumber',
        label: 'شماره رول',
        headerTitle: 'شمارهٔ کامل رول — ساختار: حرف + سالن + سال + سری + بازوی برش',
        render: function (r) {
          return '<span class="ltr-code font-bold" title="' + UI.esc(r.rollNumber) + '">' + UI.esc(r.rollNumber) + '</span>';
        },
        tokens: function (r) { return [r.rollNumber]; },
      },
    ];
    if (category === 'eva') {
      cols.push({
        key: 'suffix',
        label: 'کد EVA',
        headerTitle: 'ادامهٔ شمارهٔ رول بعد از بازوی برش خام (مثل E16)',
        render: function (r) {
          return r.suffix
            ? '<span class="badge badge-outline ltr-code text-xs">' + UI.esc(r.suffix) + '</span>'
            : '<span class="txt-muted">—</span>';
        },
        tokens: function (r) { return r.suffix ? [r.suffix] : []; },
      });
    }
    cols.push(
      {
        key: 'filmType',
        label: 'نوع فیلم',
        render: function (r) { return '<span class="ltr-code text-xs">' + UI.esc(r.filmType) + '</span>'; },
        tokens: function (r) { return [r.filmType]; },
      },
      { key: 'setupNumber', label: 'شماره ستاپ', sortableType: 'number', render: function (r) { return '<span class="dt-num">' + Fmt.faInt(r.setupNumber) + '</span>'; } },
      { key: 'width', label: 'عرض (میلی‌متر)', sortableType: 'number', render: function (r) { return '<span class="dt-num">' + Fmt.faNum(r.width, 0) + '</span>'; } },
      { key: 'thickness', label: 'ضخامت (میکرون)', sortableType: 'number', render: function (r) { return '<span class="dt-num">' + Fmt.faNum(r.thickness, 0) + '</span>'; } },
      { key: 'length', label: 'متراژ (متر)', sortableType: 'number', render: function (r) { return '<span class="dt-num">' + Fmt.faInt(r.length) + '</span>'; } },
      { key: 'netWeight', label: 'وزن خالص (کیلوگرم)', sortableType: 'number', render: function (r) { return '<span class="font-bold dt-num">' + Fmt.faWeightShort(r.netWeight) + '</span>'; } },
      {
        key: 'grade',
        label: 'گرید',
        render: function (r) { return r.grade ? '<span class="ltr-code text-xs">' + UI.esc(r.grade) + '</span>' : '<span class="txt-muted">—</span>'; },
      },
      {
        key: 'position',
        label: 'موقعیت فعلی',
        render: function (r) { return r.position ? '<span class="ltr-code text-xs">' + UI.esc(r.position) + '</span>' : '<span class="txt-muted">—</span>'; },
      }
    );
    return cols;
  }

  /** ستون‌های گرید جدول گروه‌های برش‌خورده */
  var GRADE_COLS = [
    { key: 'X', label: 'گرید X', cellClass: 'grade-bg-x' },
    { key: 'U', label: 'گرید U', cellClass: 'grade-bg-u' },
    { key: 'Q', label: 'گرید Q', cellClass: 'grade-bg-q' },
    { key: 'T', label: 'گرید T', cellClass: 'grade-bg-t' },
    { key: 'none', label: 'بدون گرید', cellClass: 'grade-bg-none' },
  ];

  function cutGroupColumns() {
    var cols = [
      { key: 'setupNumber', label: 'شماره ستاپ', sortableType: 'number', render: function (g) { return '<span class="font-bold dt-num">' + Fmt.faInt(g.setupNumber) + '</span>'; } },
      { key: 'hall', label: 'سالن', sortableType: 'number', render: function (g) { return '<span class="dt-num">' + Fmt.faInt(g.hall) + '</span>'; } },
      { key: 'year', label: 'سال', sortableType: 'number', render: function (g) { return '<span class="dt-num">' + Fmt.faYear(g.year) + '</span>'; } },
      { key: 'width', label: 'عرض (میلی‌متر)', sortableType: 'number', render: function (g) { return '<span class="dt-num">' + Fmt.faNum(g.width, 0) + '</span>'; } },
      { key: 'count', label: 'تعداد', sortableType: 'number', render: function (g) { return '<span class="font-bold dt-num">' + Fmt.faInt(g.count) + '</span>'; } },
      { key: 'totalWeight', label: 'مجموع وزن خالص (کیلوگرم)', sortableType: 'number', render: function (g) { return '<span class="font-bold dt-num">' + Fmt.faWeightShort(g.totalWeight) + '</span>'; } },
    ];
    GRADE_COLS.forEach(function (g) {
      cols.push({
        key: 'grade-' + g.key,
        label: g.label,
        align: 'center',
        className: g.cellClass,
        headerTitle: g.label + ' — تعداد (خط اول) و مجموع وزن به کیلوگرم (خط دوم)',
        render: function (grp) {
          var stat = grp.grades[g.key];
          return stat && stat.count > 0
            ? '<div class="cw-cell" title="گرید ' + (g.key === 'none' ? 'ندارد' : g.key) + ': ' + Fmt.faInt(stat.count) + ' رول — ' + Fmt.faWeightShort(stat.weight) + ' کیلوگرم">' +
                '<span class="cw-count">' + Fmt.faInt(stat.count) + '</span>' +
                '<span class="cw-weight">' + Fmt.faWeightShort(stat.weight) + '</span></div>'
            : '<span style="color:rgba(93,111,117,0.4)">—</span>';
        },
        tokens: function (grp) {
          var stat = grp.grades[g.key];
          if (!stat || stat.count <= 0) return [];
          return [String(stat.count), String(stat.weight), g.key === 'none' ? 'بدون' : g.key];
        },
      });
    });
    cols.push({
      key: 'details',
      label: 'جزئیات',
      align: 'center',
      filterable: false,
      render: function (grp) {
        return '<button type="button" class="btn btn-ghost btn-sm" data-group="' + UI.esc(grp.key) + '" aria-label="مشاهدهٔ جزئیات گروه ستاپ ' + Fmt.faInt(grp.setupNumber) + '">' + UI.icon('eye', 14) + 'جزئیات</button>';
      },
    });
    return cols;
  }

  /** ستون‌های جدول جزئیات گروه (داخل دیالوگ) */
  function detailColumns() {
    return [
      {
        key: 'rollNumber',
        label: 'شماره رول',
        render: function (r) {
          return '<span class="ltr-code font-bold" title="' + UI.esc(r.rollNumber) + '">' + UI.esc(r.rollNumber) + '</span>';
        },
        tokens: function (r) { return [r.rollNumber]; },
      },
      {
        key: 'evaCutArm',
        label: 'بازوی برش',
        render: function (r) { return r.evaCutArm ? '<span class="ltr-code text-xs">' + UI.esc(r.evaCutArm) + '</span>' : '<span class="txt-muted">—</span>'; },
      },
      { key: 'width', label: 'عرض (میلی‌متر)', sortableType: 'number', render: function (r) { return '<span class="dt-num">' + Fmt.faNum(r.width, 0) + '</span>'; } },
      { key: 'netWeight', label: 'وزن خالص (کیلوگرم)', sortableType: 'number', render: function (r) { return '<span class="font-bold dt-num">' + Fmt.faWeightShort(r.netWeight) + '</span>'; } },
      { key: 'grade', label: 'گرید', render: function (r) { return r.grade ? '<span class="ltr-code text-xs">' + UI.esc(r.grade) + '</span>' : '<span class="txt-muted">—</span>'; } },
      { key: 'position', label: 'موقعیت', render: function (r) { return r.position ? '<span class="ltr-code text-xs">' + UI.esc(r.position) + '</span>' : '<span class="txt-muted">—</span>'; } },
    ];
  }

  /* =========================================================================
     اجزای کمکی
     ========================================================================= */

  function statChip(iconName, label, value) {
    return (
      '<span class="stat-chip">' + UI.icon(iconName, 16) +
      '<span class="lbl">' + label + ':</span><b>' + value + '</b></span>'
    );
  }

  /* =========================================================================
     رندر نمای رول‌ها
     ========================================================================= */

  function render(el, snapshot) {
    var saved = localStorage.getItem(SUBTAB_KEY);
    var active = SUB_TABS.indexOf(saved) !== -1 ? saved : 'raw';

    el.innerHTML =
      '<div class="subtabs nice-scroll" role="tablist" aria-label="دسته‌های رول‌ها">' +
      subtabBtn('raw', 'package', 'رولهای خام', active) +
      subtabBtn('eva', 'layers', 'رولهای EVA', active) +
      subtabBtn('cut', 'scissors', 'رولهای برش خورده', active) +
      '</div>' +
      '<div id="rolls-panel" class="fade-in-up"></div>';

    el.querySelectorAll('.subtab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        active = btn.getAttribute('data-subtab');
        localStorage.setItem(SUBTAB_KEY, active);
        el.querySelectorAll('.subtab-btn').forEach(function (b2) {
          b2.classList.toggle('active', b2 === btn);
        });
        renderPanel(el.querySelector('#rolls-panel'), active, snapshot);
      });
    });

    renderPanel(el.querySelector('#rolls-panel'), active, snapshot);
  }

  function subtabBtn(key, iconName, label, active) {
    return (
      '<button type="button" class="subtab-btn' + (active === key ? ' active' : '') + '" role="tab" data-subtab="' + key + '" aria-selected="' + (active === key) + '">' +
      UI.icon(iconName, 16) + label + '</button>'
    );
  }

  function renderPanel(panel, active, snapshot) {
    if (active === 'cut') {
      renderCutGroups(panel, snapshot);
    } else {
      renderRollsTable(panel, active, snapshot);
    }
  }

  /* ---------- جدول رول خام / EVA ---------- */
  function renderRollsTable(panel, category, snapshot) {
    var isRaw = category === 'raw';
    var title = isRaw ? 'رول‌های خام' : 'رول‌های EVA (برش‌نخورده)';
    var desc = isRaw
      ? 'رول‌های قابل مصرف دستگاه EVA — نوع فیلم خام با عرض و ضخامت در محدودهٔ تنظیمات. این رول‌ها مبنای محاسبهٔ مانده زمان تولید هستند.'
      : 'رول‌هایی که روی خط EVA تولید شده‌اند اما هنوز به بازوهای برش تفکیک نشده‌اند (حرف E بعد از بازوی برش خام، بدون بازوی برش دوم).';

    var rolls = EVA.getRollsByCategory(snapshot.rolls, snapshot.settings, category);
    var weight = rolls.reduce(function (s, d) { return s + (d.netWeight == null ? 0 : d.netWeight); }, 0);

    var html =
      '<div class="card" style="margin:0">' +
      '<div class="card-header tight"><h3 class="card-title">' + UI.icon(isRaw ? 'package' : 'layers', 20) + UI.esc(title) + '</h3>' +
      '<p class="card-desc">' + UI.esc(desc) + '</p></div>' +
      '<div class="card-body">' +
      '<div class="row" style="gap:8px;margin-bottom:16px">' +
      statChip('boxes', 'تعداد', Fmt.faInt(rolls.length)) +
      statChip('weight', 'وزن کل', Fmt.faWeightShort(EVA.roundTo(weight, 3)) + ' کیلوگرم') +
      '</div>';

    if (rolls.length === 0) {
      html += UI.emptyStateHtml(
        title + ' — بدون داده',
        'ابتدا فایل «رول های موجود» در بخش ورود داده‌ها بارگذاری کنید تا رول‌های این دسته نمایش داده شوند. اگر فایل را وارد کرده‌اید، ممکن است با تنظیمات فعلی رولی در این دسته شناسایی نشده باشد.'
      );
      html += '</div></div>';
      panel.innerHTML = html;
      UI.hydrateIcons(panel);
      var btn = panel.querySelector('.eva-goto-import');
      if (btn) btn.addEventListener('click', function () { window.App.navigate('import'); });
      return;
    }

    html += '<div class="rolls-table-holder"></div></div></div>';
    panel.innerHTML = html;
    UI.hydrateIcons(panel);

    var table = DataTableUI.create({
      tableId: isRaw ? 'rolls-raw' : 'rolls-eva',
      columns: rollColumns(category),
      rows: rolls,
      getRowKey: function (r) { return r.id; },
      sums: { netWeight: { type: 'number', format: Fmt.faWeightShort } },
    });
    panel.querySelector('.rolls-table-holder').appendChild(table.el);
  }

  /* ---------- جدول گروه‌های برش‌خورده + دیالوگ جزئیات ---------- */
  function renderCutGroups(panel, snapshot) {
    var result = EVA.computeCutGroups(snapshot.rolls, snapshot.settings);
    var groups = result.groups;
    var stats = result.stats;

    var html =
      '<div class="card" style="margin:0">' +
      '<div class="card-header tight"><h3 class="card-title">' + UI.icon('scissors', 20) + 'گروه‌های رول‌های برش‌خورده</h3>' +
      '<p class="card-desc">گروه‌بندی بر اساس کلید «شماره ستاپ + سالن تولید + سال + عرض». در سلول‌های گرید، تعداد (خط اول) و مجموع وزن خالص به کیلوگرم (خط دوم) نمایش داده می‌شود.</p></div>' +
      '<div class="card-body">' +
      '<div class="row" style="gap:8px;margin-bottom:16px">' +
      statChip('boxes', 'تعداد گروه', Fmt.faInt(stats.groups)) +
      statChip('layers', 'تعداد رول', Fmt.faInt(stats.count)) +
      statChip('weight', 'وزن کل', Fmt.faWeightShort(stats.weight) + ' کیلوگرم') +
      '</div>';

    if (groups.length === 0) {
      html += UI.emptyStateHtml(
        'رول برش‌خورده‌ای وجود ندارد',
        'ابتدا فایل «رول های موجود» در بخش ورود داده‌ها بارگذاری کنید. اگر فایل را وارد کرده‌اید، ممکن است با تنظیمات فعلی رول برش‌خورده‌ای شناسایی نشده باشد.'
      );
      html += '</div></div>';
      panel.innerHTML = html;
      UI.hydrateIcons(panel);
      var btn = panel.querySelector('.eva-goto-import');
      if (btn) btn.addEventListener('click', function () { window.App.navigate('import'); });
      return;
    }

    html += '<div class="cut-table-holder"></div></div></div>';
    panel.innerHTML = html;
    UI.hydrateIcons(panel);

    var table = DataTableUI.create({
      tableId: 'rolls-cut',
      columns: cutGroupColumns(),
      rows: groups,
      getRowKey: function (g) { return g.key; },
      sums: {
        count: { type: 'number', format: Fmt.faInt },
        totalWeight: { type: 'number', format: Fmt.faWeightShort },
      },
    });
    var holder = panel.querySelector('.cut-table-holder');
    holder.appendChild(table.el);

    /* دیالوگ جزئیات گروه */
    holder.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-group]') : null;
      if (!btn) return;
      var key = btn.getAttribute('data-group');
      var group = groups.find(function (g) { return g.key === key; });
      if (!group) return;

      // رول‌های برش‌خوردهٔ همان گروه
      var cutRolls = EVA.getRollsByCategory(snapshot.rolls, snapshot.settings, 'cut')
        .filter(function (r) { return EVA.cutGroupKey(r.setupNumber, r.hall, r.yearDigit, r.width) === group.key; });

      var detailTable = DataTableUI.create({
        tableId: 'rolls-cut-detail',
        columns: detailColumns(),
        rows: cutRolls,
        getRowKey: function (r) { return r.id; },
        compact: true,
        defaultVisibleRows: 10,
        emptyText: 'رولی در این گروه یافت نشد.',
      });

      UI.dialog({
        wide: true,
        title: 'رول‌های گروه — ستاپ ' + Fmt.faInt(group.setupNumber) +
          ' <span class="badge badge-secondary">' + Fmt.faInt(group.count) + ' رول</span>',
        desc: 'سالن ' + Fmt.faInt(group.hall) + ' · سال ' + Fmt.faYear(group.year) + ' · عرض ' +
          Fmt.faNum(group.width, 0) + ' میلی‌متر · مجموع وزن ' + Fmt.faWeight(group.totalWeight),
        onMount: function (dlg) {
          dlg.dialogEl.querySelector('.dialog-body').appendChild(detailTable.el);
        },
      });
    });
  }

  window.EvaViews = window.EvaViews || {};
  window.EvaViews.rolls = { render: render };
})();
