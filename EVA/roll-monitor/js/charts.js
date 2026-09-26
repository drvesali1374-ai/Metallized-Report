/* =========================================================================
   charts.js — نمودارهای داشبورد با Chart.js (کاملاً راست‌به‌چپ)
   -------------------------------------------------------------------------
   · نمودار اصلی (بند ۱ نسخهٔ ۱٫۲): هر ستاپ فقط یک میله = مانده زمان تولید
     (ساعت، محور راست)؛ برچسب دوخطی بالای هر میله: خط اول مانده زمان (بولد،
     تیره) و خط دوم وزن رول‌های خام همان ستاپ (کهربایی)؛ محور X معکوس تا
     ستاپ اول سمت راست باشد؛ شماره ستاپ‌ها بولد/مشکی/درشت
   · نمودار موقعیت: میله‌های افقی که از راست رشد می‌کنند و لیبل موقعیت‌ها
     سمت راست است
   · دونات گرید: بدون تولتیپ شناور (بند ۷ نسخهٔ ۱٫۱) — متن مرکزی با
     افزونهٔ سفارشی روی بوم؛ هاور قطاع/آیتم legend جزئیات همان گرید را در
     مرکز می‌گذارد و بقیهٔ قطاع‌ها کم‌رنگ می‌شوند
   ========================================================================= */
(function () {
  'use strict';

  /* فونت پیش‌فرض همهٔ نمودارها */
  if (window.Chart) {
    Chart.defaults.font.family = "'Vazirmatn', 'Segoe UI', Tahoma, sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.color = '#5d6f75';
  }

  /* ---------- خواندن رنگ‌ها از متغیرهای CSS تم ---------- */
  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  var PAL = {};
  function palette() {
    PAL.primary = cssVar('--primary', '#0a7568');
    PAL.chart1 = cssVar('--chart-1', '#17a398');
    PAL.chart2 = cssVar('--chart-2', '#e0a52e');
    PAL.chart3 = cssVar('--chart-3', '#e0518b');
    PAL.chart4 = cssVar('--chart-4', '#9b5bd6');
    PAL.chart5 = cssVar('--chart-5', '#52b788');
    PAL.mutedFg = cssVar('--muted-foreground', '#5d6f75');
    PAL.border = cssVar('--border', '#dce5e1');
    PAL.card = cssVar('--card', '#ffffff');
    return PAL;
  }

  /** رنگ ثابت هر گرید در نمودارها (پورت distColor نسخهٔ وب) */
  function distColor(label, index) {
    palette();
    var gradeColors = { X: PAL.chart1, U: PAL.chart5, Q: PAL.chart3, T: PAL.chart2 };
    var fallback = [PAL.chart1, PAL.chart2, PAL.chart3, PAL.chart4, PAL.chart5];
    return (gradeColors[label] !== undefined ? gradeColors[label] : undefined) ||
      fallback[index % fallback.length];
  }

  /* ---------- ثبت نمونه‌ها برای بازترسیم پس از آماده‌شدن فونت ---------- */
  var registry = [];
  function track(chart) {
    registry.push(chart);
    if (registry.length > 12) registry.shift();
  }
  function destroyChart(container) {
    if (container && container.__chart) {
      container.__chart.destroy();
      container.__chart = null;
    }
  }

  /* =========================================================================
     افزونهٔ لیبل‌های مقدار روی بوم (بالای میله‌ها و نقاط خط)
     -------------------------------------------------------------------------
     بند ۶ (نسخهٔ ۱٫۳): دیتاست با _evaLabelBold → برچسب بولد ۱۱px تیره
     (مانند وب). حالت قدیمی دوخطی (_evaLabel2) برای سازگاری حفظ شده است.
     ========================================================================= */
  var valueLabelsPlugin = {
    id: 'evaValueLabels',
    afterDatasetsDraw: function (chart, args, opts) {
      if (!opts || !opts.enabled) return;
      var ctx = chart.ctx;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';

      chart.data.datasets.forEach(function (ds, di) {
        if (ds._evaLabel === undefined) return;
        var meta = chart.getDatasetMeta(di);
        if (meta.hidden) return;
        var twoLine = ds._evaLabel2 === true && Array.isArray(ds._evaLabel2Data);
        meta.data.forEach(function (el, i) {
          var v = ds.data[i];
          if (v === null || v === undefined || v === 0) return;
          if (twoLine) {
            // حالت قدیمی: دو خط بالای همان میله
            ctx.font = "700 11px 'Vazirmatn', Tahoma, sans-serif";
            ctx.fillStyle = opts.color1 || '#1d2528';
            ctx.fillText(Fmt.faNum(v, 1), el.x, el.y - 20);
            var w = ds._evaLabel2Data[i];
            if (w !== null && w !== undefined) {
              ctx.font = "500 9.5px 'Vazirmatn', Tahoma, sans-serif";
              ctx.fillStyle = opts.color2 || PAL.chart2 || '#e0a52e';
              ctx.fillText(w >= 1000 ? Fmt.faNum(w, 0) : Fmt.faNum(w, 2), el.x, el.y - 8);
            }
          } else if (ds._evaLabelBold) {
            // بند ۶ (نسخهٔ ۱٫۳): بولد ۱۱px تیره — مثل LabelList وب
            ctx.font = "700 11px 'Vazirmatn', Tahoma, sans-serif";
            ctx.fillStyle = opts.color1 || '#1d2528';
            var fmtB = ds._evaLabelFmt === 'hours'
              ? function (x) { return Fmt.faNum(x, 1); }
              : function (x) { return x >= 1000 ? Fmt.faNum(x, 0) : Fmt.faNum(x, 2); };
            ctx.fillText(fmtB(v), el.x, el.y - 3);
          } else {
            ctx.font = "10px 'Vazirmatn', Tahoma, sans-serif";
            ctx.fillStyle = opts.color || '#5d6f75';
            var fmt = ds._evaLabelFmt === 'hours' ? function (x) { return Fmt.faNum(x, 1); } : Fmt.faWeightShort;
            var text = fmt(v);
            if (ds.type === 'line' || ds._evaIsLine) {
              ctx.fillText(text, el.x, el.y - 6);
            } else {
              ctx.fillText(text, el.x, el.y - 3);
            }
          }
        });
      });
      ctx.restore();
    },
  };

  /* =========================================================================
     افزونهٔ عنوان محورها («ساعت» راست / «کیلوگرم» چپ) — مانند نسخهٔ وب
     ========================================================================= */
  var axisTitlesPlugin = {
    id: 'evaAxisTitles',
    afterDraw: function (chart, args, opts) {
      if (!opts || !opts.enabled) return;
      var ctx = chart.ctx;
      var area = chart.chartArea;
      ctx.save();
      ctx.font = "10px 'Vazirmatn', Tahoma, sans-serif";
      ctx.fillStyle = opts.color || '#5d6f75';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'right';
      ctx.fillText(opts.right || '', area.right, Math.max(area.top - 14, 2));
      ctx.textAlign = 'left';
      ctx.fillText(opts.left || '', area.left, Math.max(area.top - 14, 2));
      ctx.restore();
    },
  };

  /* =========================================================================
     نمودار اصلی — مانده زمان تولید به تفکیک ستاپ
     ========================================================================= */

  /**
   * نمودار اصلی (بند ۶ نسخهٔ ۱٫۳ — منطبق با dashboard-view.tsx):
   * هر ستاپ دو میله — میلهٔ ۱: مانده زمان (ساعت) روی محور راست (فیروزه‌ای)؛
   * میلهٔ ۲: وزن خام همان ستاپ (کیلوگرم) روی محور چپ (کهربایی). دیتالیبل هر
   * دو میله بولد و تیره است؛ محور X معکوس و شماره ستاپ‌ها بولد/مشکی/درشت.
   * @param container عنصر والد (ارتفاع ثابت ۳۴۰px در CSS)
   * @param perSetup  آرایهٔ {setupNumber, rawCount, rawWeight, remainingDays, remainingHours}
   * @param hoursPerDay ساعت تولید در شبانه‌روز
   */
  function renderMainChart(container, perSetup, hoursPerDay) {
    destroyChart(container);
    palette();
    var labels = perSetup.map(function (s) { return Fmt.toFaDigits(s.setupNumber); });

    var hoursData = perSetup.map(function (s) { return s.remainingHours; });
    var weightData = perSetup.map(function (s) { return s.rawWeight; });

    var canvas = document.createElement('canvas');
    container.innerHTML = '';
    container.appendChild(canvas);

    var chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            type: 'bar',
            label: 'مانده زمان (ساعت)',
            data: hoursData,
            yAxisID: 'hours',
            backgroundColor: PAL.chart1,
            borderRadius: { topLeft: 4, topRight: 4 },
            borderSkipped: 'bottom',
            maxBarThickness: 26,
            minBarLength: 2,
            _evaLabel: true,
            _evaLabelFmt: 'hours',
            _evaLabelBold: true,
          },
          {
            type: 'bar',
            label: 'وزن خام (کیلوگرم)',
            data: weightData,
            yAxisID: 'weight',
            backgroundColor: PAL.chart2,
            borderRadius: { topLeft: 4, topRight: 4 },
            borderSkipped: 'bottom',
            maxBarThickness: 26,
            minBarLength: 2,
            _evaLabel: true,
            _evaLabelBold: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 14 } },
        plugins: {
          legend: { display: false }, // لژند HTML بالای نمودار (مثل وب)
          tooltip: {
            rtl: true,
            textDirection: 'rtl',
            backgroundColor: '#ffffff',
            titleColor: '#1d2528',
            bodyColor: '#1d2528',
            borderColor: PAL.border,
            borderWidth: 1,
            padding: 10,
            displayColors: false,
            callbacks: {
              title: function (items) {
                var i = items[0].dataIndex;
                return 'ستاپ ' + Fmt.toFaDigits(perSetup[i].setupNumber);
              },
              label: function (item) {
                var i = item.dataIndex;
                var row = perSetup[i];
                if (item.datasetIndex === 0) {
                  return 'مانده زمان: ' + Fmt.faDuration(row.remainingDays, hoursPerDay || 24);
                }
                return ['وزن خام: ' + Fmt.faWeight(row.rawWeight), Fmt.faInt(row.rawCount) + ' رول خام'];
              },
            },
          },
          evaValueLabels: {
            enabled: true,
            color: PAL.mutedFg,
            color1: '#1d2528', // دیتالیبل هر دو میله: بولد و تیره (بند ۶ نسخهٔ ۱٫۳)
          },
          evaAxisTitles: { enabled: true, color: PAL.mutedFg, right: 'ساعت', left: 'کیلوگرم' },
        },
        scales: {
          x: {
            reverse: true, // بند ۶: ستاپ اول سمت راست — روند خوانش راست‌به‌چپ
            grid: { display: false },
            // شماره ستاپ‌ها: درشت‌تر، بولد و مشکی (بند ۱-۶)
            ticks: { color: '#000000', font: { size: 13, weight: 'bold' } },
            border: { color: PAL.border },
          },
          hours: {
            type: 'linear',
            position: 'right',
            grid: { color: 'rgba(220,229,225,0.55)' },
            ticks: { color: PAL.mutedFg, callback: function (v) { return Fmt.faNum(v, 0); } },
            border: { display: false },
          },
          weight: {
            type: 'linear',
            position: 'left',
            grid: { display: false },
            ticks: { color: PAL.mutedFg, callback: function (v) { return Fmt.faNum(v, 0); } },
            border: { display: false },
          },
        },
      },
      plugins: [valueLabelsPlugin, axisTitlesPlugin],
    });

    container.__chart = chart;
    track(chart);
    return chart;
  }

  /* =========================================================================
     نمودار موقعیت — وزن رول‌های خام به تفکیک موقعیت فعلی
     ========================================================================= */

  /**
   * @param container عنصر والد (ارتفاع = max(200, تعداد×۴۰+۳۶) در CSS)
   * @param positions آرایهٔ {label, count, weight}
   */
  function renderPositionChart(container, positions) {
    destroyChart(container);
    palette();
    var canvas = document.createElement('canvas');
    container.innerHTML = '';
    container.appendChild(canvas);

    var chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: positions.map(function (p) { return p.label; }),
        datasets: [
          {
            label: 'وزن خام',
            data: positions.map(function (p) { return p.weight; }),
            backgroundColor: PAL.chart5 + 'd9',
            borderRadius: { topLeft: 4, bottomLeft: 4 },
            borderSkipped: 'right',
            barThickness: 16,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        layout: { padding: { left: 62, right: 6, top: 2, bottom: 2 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            rtl: true,
            textDirection: 'rtl',
            backgroundColor: '#ffffff',
            titleColor: '#1d2528',
            bodyColor: '#1d2528',
            borderColor: PAL.border,
            borderWidth: 1,
            padding: 10,
            displayColors: false,
            callbacks: {
              title: function (items) {
                return 'موقعیت: ' + items[0].label;
              },
              label: function (item) {
                var p = positions[item.dataIndex];
                return ['وزن خام: ' + Fmt.faWeight(p.weight), Fmt.faInt(p.count) + ' رول'];
              },
            },
          },
        },
        scales: {
          x: {
            reverse: true, // میله‌ها از لبهٔ راست رشد می‌کنند (بند ۶)
            grid: { display: false },
            ticks: { color: PAL.mutedFg, callback: function (v) { return Fmt.faNum(v, 0); } },
            border: { display: false },
          },
          y: {
            position: 'right', // لیبل موقعیت‌ها سمت راست نمودار
            grid: { display: false },
            ticks: { color: PAL.mutedFg, font: { size: 11 }, crossAlign: 'far' },
            border: { display: false },
            afterFit: function (scale) { scale.width = 92; },
          },
        },
      },
      plugins: [
        {
          id: 'evaHLabels',
          afterDatasetsDraw: function (chart) {
            var ctx = chart.ctx;
            var meta = chart.getDatasetMeta(0);
            ctx.save();
            ctx.font = "10px 'Vazirmatn', Tahoma, sans-serif";
            ctx.fillStyle = PAL.mutedFg;
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'right';
            meta.data.forEach(function (el, i) {
              var v = chart.data.datasets[0].data[i];
              if (v === null || v === undefined) return;
              ctx.fillText(Fmt.faWeightShort(v), el.x - 5, el.y);
            });
            ctx.restore();
          },
        },
      ],
    });

    container.__chart = chart;
    track(chart);
    return chart;
  }

  /* =========================================================================
     دونات گرید — توزیع وزن رول‌های برش‌خورده (بدون تولتیپ شناور — بند ۷)
     ========================================================================= */

  /**
   * @param container عنصر والد (ارتفاع ثابت ۲۲۴px)
   * @param distribution آرایهٔ {label, count, weight}
   * @param cutWeight مجموع وزن برش‌خورده (KPI)
   * خروجی: تابع setActive(index|null) برای legend زیر نمودار
   */
  function renderGradeDonut(container, distribution, cutWeight) {
    destroyChart(container);
    palette();

    var state = { active: null };
    var totalWeight = distribution.reduce(function (s, d) { return s + d.weight; }, 0);

    function baseColors() {
      return distribution.map(function (item, i) { return distColor(item.label, i); });
    }
    function applyColors() {
      var colors = baseColors().map(function (c, i) {
        return state.active === null || state.active === i ? c : c + '73'; // ۴۵٪ شفافیت
      });
      chart.data.datasets[0].backgroundColor = colors;
    }

    /* افزونهٔ متن مرکزی — روی بوم رسم می‌شود (بدون HTML شناور) */
    var centerPlugin = {
      id: 'evaDonutCenter',
      afterDraw: function (chart) {
        var ctx = chart.ctx;
        var area = chart.chartArea;
        var cx = (area.left + area.right) / 2;
        var cy = (area.top + area.bottom) / 2;
        var item = state.active !== null ? distribution[state.active] : null;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = PAL.mutedFg;
        ctx.font = "10px 'Vazirmatn', Tahoma, sans-serif";
        if (item) {
          ctx.fillText(item.label, cx, cy - 20);
          ctx.fillStyle = '#1d2528';
          ctx.font = "700 18px 'Vazirmatn', Tahoma, sans-serif";
          ctx.fillText(Fmt.faWeightShort(item.weight), cx, cy + 1);
          ctx.fillStyle = PAL.mutedFg;
          ctx.font = "10px 'Vazirmatn', Tahoma, sans-serif";
          var pct = totalWeight > 0 ? (item.weight / totalWeight) * 100 : 0;
          ctx.fillText(Fmt.faInt(item.count) + ' رول · ' + Fmt.faNum(pct, 1) + '٪', cx, cy + 20);
        } else {
          ctx.fillText('مجموع وزن برش‌خورده', cx, cy - 20);
          ctx.fillStyle = '#1d2528';
          ctx.font = "700 18px 'Vazirmatn', Tahoma, sans-serif";
          ctx.fillText(Fmt.faWeightShort(cutWeight), cx, cy + 1);
          ctx.fillStyle = PAL.mutedFg;
          ctx.font = "10px 'Vazirmatn', Tahoma, sans-serif";
          ctx.fillText('کیلوگرم', cx, cy + 20);
        }
        ctx.restore();
      },
    };

    var canvas = document.createElement('canvas');
    container.innerHTML = '';
    container.appendChild(canvas);

    var chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: distribution.map(function (d) { return d.label; }),
        datasets: [
          {
            data: distribution.map(function (d) { return d.weight; }),
            backgroundColor: baseColors(),
            borderColor: PAL.card,
            borderWidth: 2,
            spacing: 2, // معادل paddingAngle نسخهٔ وب
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        animation: { duration: 300 },
        /* بدون Tooltip شناور (بند ۷): هاور روی هر قطاع، جزئیات همان گرید را
           در لیبل مرکزی دونات نشان می‌دهد */
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
        },
        onHover: function (event, elements) {
          if (elements && elements.length) setActive(elements[0].index);
          else setActive(null);
        },
      },
      plugins: [centerPlugin],
    });

    function setActive(index) {
      if (state.active === index) return;
      state.active = index;
      applyColors();
      chart.update('none');
    }

    container.__chart = chart;
    track(chart);
    return { chart: chart, setActive: setActive };
  }

  /* ---------------- انتشار سراسری ---------------- */
  window.EvaCharts = {
    renderMainChart: renderMainChart,
    renderPositionChart: renderPositionChart,
    renderGradeDonut: renderGradeDonut,
    distColor: distColor,
    redrawAll: function () {
      registry.forEach(function (c) {
        if (c && !c.destroyed) c.update('none');
      });
    },
  };
})();
