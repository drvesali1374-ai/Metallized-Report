/* =========================================================================
   views/dashboard.js — داشبورد (پورت dashboard-view.tsx)
   -------------------------------------------------------------------------
   KPI ها + نمودار اصلی مانده زمان به تفکیک ستاپ + هشدارها (خطا/اطلاع)
   با دیالوگ drill-down + دونات گرید (بدون تولتیپ — متن مرکزی)
   + نمودار موقعیت رول‌های خام.
   ========================================================================= */
(function () {
  'use strict';

  var WARNING_ORDER = ['error_e_film', 'error_no_e', 'raw_out_of_range'];
  var WARNING_TITLES = {
    error_e_film: 'خطا: حرف E بدون فیلم EVA',
    error_no_e: 'خطا: فیلم EVA بدون حرف E',
    raw_out_of_range: 'اطلاع: فیلم خام خارج از محدوده',
  };

  /** توضیح فارسی قانون هر هشدار (پورت warningDescription) */
  function warningDescription(key, s) {
    var evaFilms = s.evaFilmTypes.join('، ');
    var rawFilms = s.rawFilmTypes.join('، ');
    switch (key) {
      case 'error_e_film':
        return 'قانون: اگر در شمارهٔ رول، بعد از بازوی برش خام حرف E وجود داشته باشد، نوع فیلم باید جزو فیلم‌های EVA (' + evaFilms + ') باشد. نوع فیلم این رول‌ها با ساختار شمارهٔ رول آن‌ها تناقض دارد.';
      case 'error_no_e':
        return 'قانون: نوع فیلم‌های EVA (' + evaFilms + ') باید بعد از بازوی برش خام در شمارهٔ رول، حرف E داشته باشند. این رول‌ها حرف E ندارند و دسته‌بندی آن‌ها قطعی نیست.';
      case 'raw_out_of_range':
        return 'نوع فیلم این رول‌ها خام (' + rawFilms + ') است، اما عرض آن‌ها خارج از بازهٔ ' + Fmt.faNum(s.rawMinWidth, 0) + ' تا ' + Fmt.faNum(s.rawMaxWidth, 0) + ' میلی‌متر یا ضخامت آن‌ها ' + Fmt.faNum(s.rawThickness, 0) + ' میکرون نیست؛ بنابراین در محاسبهٔ مانده زمان لحاظ نمی‌شوند.';
    }
    return '';
  }

  /** ستون‌های جدول رول‌های هشدار (پورت WARN_COLUMNS) */
  function warnColumns() {
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
        key: 'filmType',
        label: 'نوع فیلم',
        render: function (r) { return '<span class="ltr-code text-xs">' + UI.esc(r.filmType) + '</span>'; },
        tokens: function (r) { return [r.filmType]; },
      },
      { key: 'width', label: 'عرض (میلی‌متر)', sortableType: 'number', render: function (r) { return '<span class="dt-num">' + Fmt.faNum(r.width, 0) + '</span>'; } },
      { key: 'thickness', label: 'ضخامت (میکرون)', sortableType: 'number', render: function (r) { return '<span class="dt-num">' + Fmt.faNum(r.thickness, 0) + '</span>'; } },
      { key: 'setupNumber', label: 'شماره ستاپ', sortableType: 'number', render: function (r) { return '<span class="dt-num">' + Fmt.faInt(r.setupNumber) + '</span>'; } },
    ];
  }

  /** دیالوگ رول‌های یک هشدار — جدول مشترک DataTable */
  function openWarningDialog(warningKey, rolls) {
    var table = DataTableUI.create({
      tableId: 'dashboard-warn-' + warningKey,
      columns: warnColumns(),
      rows: rolls,
      getRowKey: function (r) { return r.id; },
      compact: true,
      defaultVisibleRows: 10,
      emptyText: 'رولی با این هشدار یافت نشد.',
    });
    UI.dialog({
      wide: true,
      title: UI.esc(WARNING_TITLES[warningKey]) +
        ' <span class="badge badge-secondary">' + Fmt.faInt(rolls.length) + ' رول</span>',
      desc: 'فهرست رول‌های دارای این هشدار به همراه مشخصات فنی آن‌ها',
      onMount: function (dlg) {
        dlg.dialogEl.querySelector('.dialog-body').appendChild(table.el);
      },
    });
  }

  /* =========================================================================
     رندر داشبورد
     ========================================================================= */

  function render(el, snapshot) {
    /* حالت خالی — هنوز داده‌ای وارد نشده است */
    if (!snapshot.lastBatch) {
      el.innerHTML = UI.emptyStateHtml(
        'داشبورد خالی است',
        'برای مشاهدهٔ شاخص‌ها، نمودار مانده زمان و هشدارها، ابتدا فایل اکسل «رول های موجود» را در بخش ورود داده‌ها بارگذاری کنید.',
        'رفتن به ورود داده‌ها'
      );
      bindGotoImport(el);
      return;
    }

    var dash = EVA.computeDashboard(snapshot.rolls, snapshot.settings);
    var kpis = dash.kpis;
    var s = dash.settingsUsed;
    var hoursPerDay = s.hoursPerDay || 24;
    var perDayCapacity = s.evaCapacityPerShift * s.shiftsPerDay;

    var html = '';

    /* ---------------- شاخص‌های کلیدی ---------------- */
    html +=
      '<section aria-label="شاخص‌های کلیدی داشبورد" class="kpi-grid fade-in-up">' +
      kpiCard('package', 'txt-primary', 'رول‌های خام',
        Fmt.faWeightShort(kpis.rawWeight) + '<span class="unit">کیلوگرم</span>',
        Fmt.faInt(kpis.rawCount) + ' رول قابل مصرف') +
      kpiCard('clock', 'txt-amber', 'مانده زمان تولید',
        Fmt.faDuration(kpis.remainingDays, hoursPerDay),
        Fmt.faHours(kpis.remainingHours),
        '<div class="kpi-formula" title="فرمول مانده زمان: وزن رول‌های خام ÷ (ظرفیت هر شیفت × تعداد شیفت در روز)">ظرفیت ' +
          Fmt.faNum(s.evaCapacityPerShift, 0) + ' × ' + Fmt.faNum(s.shiftsPerDay, 0) + ' شیفت = ' +
          Fmt.faNum(perDayCapacity, 0) + ' کیلوگرم در روز</div>') +
      kpiCard('layers', 'txt-green', 'رول‌های EVA',
        Fmt.faInt(kpis.evaCount) + '<span class="unit">رول برش‌نخورده</span>',
        Fmt.faWeight(kpis.evaWeight)) +
      kpiCard('scissors', 'txt-amber', 'رول‌های برش‌خورده',
        Fmt.faInt(kpis.cutCount) + '<span class="unit">رول</span>',
        Fmt.faWeight(kpis.cutWeight)) +
      kpiCard('alert-circle', kpis.errorsCount > 0 ? 'txt-red' : 'txt-green', 'خطاهای شناسایی‌شده',
        '<span class="' + (kpis.errorsCount > 0 ? 'txt-red' : 'txt-green') + '">' + Fmt.faInt(kpis.errorsCount) + '</span>',
        kpis.errorsCount > 0 ? 'نیازمند بررسی دستی' : 'هیچ خطایی شناسایی نشد') +
      kpiCard('info', 'txt-amber', 'هشدارهای اطلاعی',
        '<span class="' + (kpis.infosCount > 0 ? 'txt-amber' : 'txt-muted') + '">' + Fmt.faInt(kpis.infosCount) + '</span>',
        'فیلم خام خارج از محدوده') +
      '</section>';

    /* ---------------- نمودار اصلی ---------------- */
    html +=
      '<div class="card fade-in-up">' +
      '<div class="card-header"><h3 class="card-title">' + UI.icon('bar-chart', 20) + 'مانده زمان تولید به تفکیک ستاپ</h3>' +
      '<p class="card-desc">هر ستاپ دو میله دارد: مانده زمان تولید (ساعت — محور راست) و وزن رول‌های خام همان ستاپ (کیلوگرم — محور چپ)؛ عدد بالای هر میله با فونت بولد نمایش داده می‌شود. مبنای محاسبه: فایل «' + UI.esc(snapshot.lastBatch.fileName) + '» — ' + Fmt.faDateTime(snapshot.lastBatch.importedAt) + '</p></div>' +
      '<div class="card-body">' +
      (dash.perSetup.length === 0
        ? '<div style="display:flex;height:256px;flex-direction:column;align-items:center;justify-content:center;gap:8px;border:1px dashed var(--border);border-radius:10px;text-align:center;font-size:0.8rem;color:var(--muted-foreground)">' + UI.icon('package', 30) + 'رول خامی برای محاسبهٔ مانده زمان وجود ندارد.</div>'
        : '<div dir="rtl" style="display:flex;flex-wrap:wrap;align-items:center;gap:4px 16px;font-size:0.72rem;color:var(--muted-foreground);margin-bottom:4px">' +
          '<span style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--chart-1)" aria-hidden="true"></span>مانده زمان (ساعت)</span>' +
          '<span style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--chart-2)" aria-hidden="true"></span>وزن خام (کیلوگرم)</span>' +
          '</div>' +
          '<div class="chart-box" id="dash-main-chart" dir="ltr" style="height:340px"></div>') +
      '<p class="chart-hint">مانده زمان هر ستاپ = وزن رول‌های خام همان ستاپ ÷ (' + Fmt.faNum(s.evaCapacityPerShift, 0) + ' × ' + Fmt.faNum(s.shiftsPerDay, 0) + ') — ساعت = روز × ' + Fmt.faNum(hoursPerDay, 0) + ' ساعت تولید در شبانه‌روز.</p>' +
      '</div></div>';

    /* ---------------- هشدارهای شناسایی‌شده ---------------- */
    html += '<section aria-label="هشدارهای شناسایی‌شده" style="margin-bottom:1.5rem">' +
      '<h2 style="display:flex;align-items:center;gap:8px;font-size:1rem;font-weight:700;margin:0 0 12px">' +
      '<span class="txt-amber">' + UI.icon('alert-triangle', 20) + '</span>هشدارهای شناسایی‌شده</h2>';

    if (kpis.errorsCount === 0 && kpis.infosCount === 0) {
      html +=
        '<div class="alert alert-green">' + UI.icon('check-circle', 16) +
        '<div class="alert-body"><p class="alert-title">هیچ خطایی شناسایی نشد</p>' +
        '<p>همهٔ رول‌های واردشده بدون تناقض در قوانین دسته‌بندی شناسایی شدند.</p></div></div>';
    } else {
      WARNING_ORDER.forEach(function (key) {
        var rolls = dash.warnings[key] || [];
        if (rolls.length === 0) return;
        var isError = key !== 'raw_out_of_range';
        html +=
          '<div class="alert ' + (isError ? 'alert-destructive' : 'alert-amber') + '">' +
          UI.icon(isError ? 'alert-circle' : 'info', 16) +
          '<div class="alert-body">' +
          '<p class="alert-title">' + UI.esc(WARNING_TITLES[key]) +
          '<span class="badge ' + (isError ? 'badge-destructive' : 'badge-amber') + '">' + Fmt.faInt(rolls.length) + ' رول</span></p>' +
          '<p style="line-height:1.9">' + UI.esc(warningDescription(key, s)) + '</p>' +
          '<button type="button" class="btn btn-outline btn-sm mt-2" data-warn="' + key + '" aria-label="مشاهدهٔ رول‌های ' + UI.esc(WARNING_TITLES[key]) + '">' + UI.icon('eye', 14) + 'مشاهدهٔ رول‌ها</button>' +
          '</div></div>';
      });
    }
    html += '</section>';

    /* ---------------- نمودارهای مکمل ---------------- */
    html += '<section aria-label="نمودارهای مکمل" class="comp-charts">';

    // دونات گرید
    html +=
      '<div class="card" style="margin-bottom:0">' +
      '<div class="card-header"><h3 class="card-title" style="font-size:0.9rem">' + UI.icon('pie-chart', 16) + 'توزیع وزن رول‌های برش‌خورده بر اساس گرید</h3></div>' +
      '<div class="card-body">' +
      (dash.cutGradeDistribution.length === 0
        ? '<div style="display:flex;height:224px;align-items:center;justify-content:center;border:1px dashed var(--border);border-radius:10px;font-size:0.8rem;color:var(--muted-foreground)">رول برش‌خورده‌ای برای نمایش وجود ندارد.</div>'
        : '<div class="chart-box" id="dash-donut" style="height:224px"></div><hr class="sep" style="margin:12px 0" /><ul class="legend-grid" id="dash-donut-legend" style="margin:0;padding:0;list-style:none"></ul>') +
      '</div></div>';

    // نمودار موقعیت
    html +=
      '<div class="card" style="margin-bottom:0">' +
      '<div class="card-header"><h3 class="card-title" style="font-size:0.9rem">' + UI.icon('bar-chart', 16) + 'وزن رول‌های خام به تفکیک موقعیت فعلی</h3></div>' +
      '<div class="card-body">' +
      (dash.rawByPosition.length === 0
        ? '<div style="display:flex;height:224px;align-items:center;justify-content:center;border:1px dashed var(--border);border-radius:10px;font-size:0.8rem;color:var(--muted-foreground)">رول خامی برای نمایش وجود ندارد.</div>'
        : '<div class="chart-box" id="dash-position" dir="ltr" style="height:' + Math.max(200, dash.rawByPosition.length * 40 + 36) + 'px"></div>') +
      '<p class="chart-hint">موقعیت فعلی رول‌های خام از ستون «موقعیت فعلی» فایل اکسل خوانده می‌شود.</p>' +
      '</div></div>';

    html += '</section>';

    el.innerHTML = html;
    UI.hydrateIcons(el);

    /* ---------------- رندر نمودارها ---------------- */
    if (dash.perSetup.length > 0) {
      EvaCharts.renderMainChart(el.querySelector('#dash-main-chart'), dash.perSetup, hoursPerDay);
    }
    if (dash.cutGradeDistribution.length > 0) {
      var donutResult = EvaCharts.renderGradeDonut(
        el.querySelector('#dash-donut'),
        dash.cutGradeDistribution,
        kpis.cutWeight
      );
      // legend تعاملی زیر نمودار — هاور، مرکز دونات را به‌روز می‌کند
      var legendEl = el.querySelector('#dash-donut-legend');
      legendEl.innerHTML = dash.cutGradeDistribution
        .map(function (item, i) {
          return (
            '<li class="legend-item" data-gi="' + i + '">' +
            '<span class="row1"><span class="dot" style="background:' + EvaCharts.distColor(item.label, i) + '"></span>' +
            '<span class="font-bold">' + UI.esc(item.label) + '</span></span>' +
            '<span class="row2">' + Fmt.faInt(item.count) + ' رول · ' + Fmt.faWeightShort(item.weight) + ' کیلوگرم</span>' +
            '</li>'
          );
        })
        .join('');
      legendEl.querySelectorAll('.legend-item').forEach(function (li) {
        li.addEventListener('mouseenter', function () { donutResult.setActive(Number(li.getAttribute('data-gi'))); });
        li.addEventListener('mouseleave', function () { donutResult.setActive(null); });
      });
    }
    if (dash.rawByPosition.length > 0) {
      EvaCharts.renderPositionChart(el.querySelector('#dash-position'), dash.rawByPosition);
    }

    /* ---------------- دیالوگ هشدارها ---------------- */
    el.querySelectorAll('[data-warn]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openWarningDialog(btn.getAttribute('data-warn'), dash.warnings[btn.getAttribute('data-warn')] || []);
      });
    });
  }

  /* ---------- KPI کارت ---------- */
  function kpiCard(iconName, iconCls, label, valueHtml, subHtml, extraHtml) {
    return (
      '<div class="kpi-card">' +
      '<p class="kpi-label"><span class="' + iconCls + '">' + UI.icon(iconName, 14) + '</span>' + UI.esc(label) + '</p>' +
      '<div class="kpi-value">' + valueHtml + '</div>' +
      (subHtml ? '<p class="kpi-sub">' + subHtml + '</p>' : '') +
      (extraHtml || '') +
      '</div>'
    );
  }

  /* ---------- دکمهٔ «رفتن به ورود داده‌ها» ---------- */
  function bindGotoImport(el) {
    var btn = el.querySelector('.eva-goto-import');
    if (btn) btn.addEventListener('click', function () { window.App.navigate('import'); });
  }

  window.EvaViews = window.EvaViews || {};
  window.EvaViews.dashboard = { render: render };
})();
