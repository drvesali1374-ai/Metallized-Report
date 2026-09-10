/* =========================================================================
   views/dashboard.js — نما داشبورد (§57-§59، §52)
   -------------------------------------------------------------------------
   این نما هیچ محاسبه‌ای انجام نمی‌دهد؛ فقط از موتور محاسبهٔ مرکزی
   (RM.calcEngine) تغذیه می‌کند (Single Source of Truth — §105).
   ========================================================================= */

'use strict';

(function () {
  const U = RM.utils;
  const UI = RM.ui;
  const db = RM.db.db;

  const Dashboard = { _state: null };   // آخرین وضعیت محاسبه (برای Drill-down هشدارها)

  /* ================================================================
     موتور نمودارهای ECharts (نسخهٔ ۲٫۳ — کاملاً لوکال)
     ----------------------------------------------------------------
     - کتابخانه از lib/echarts.min.js لوکال بارگذاری می‌شود (بدون CDN)
     - رنگ‌ها از همان پالت CSS (زمردی/فیروزه‌ای/کهربایی/رز) — بدون آبی
     - تم روشن/تاریک پشتیبانی می‌شود (با تغییر تم، نمودارها تازه می‌شوند)
     - در نبود کتابخانه → Fallback به نمودار CSS قبلی (آفلاین مقاوم)
     ================================================================ */

  Dashboard._charts = {};          // id → نمونهٔ echarts
  Dashboard._pendingCharts = false; // دادهٔ تازه در تب مخفی — هنگام نمایش رندر شود

  /** آیا ECharts لوکال در دسترس است؟ */
  Dashboard.hasECharts = function () {
    return typeof window.echarts !== 'undefined';
  };

  /** پالت رنگ متن/محور بر اساس تم فعال */
  Dashboard.chartPalette = function () {
    const dark = document.documentElement.dataset.theme === 'dark';
    return {
      dark,
      fontFamily: "'Vazirmatn', 'Tahoma', sans-serif",
      text: dark ? '#d4d8dc' : '#21262b',
      muted: dark ? '#9aa0a7' : '#575e66',
      faint: dark ? '#6b7280' : '#878e95',
      splitLine: dark ? 'rgba(255,255,255,0.09)' : 'rgba(33,38,43,0.08)',
      axisLine: dark ? 'rgba(255,255,255,0.16)' : 'rgba(33,38,43,0.14)',
      tooltipBg: dark ? '#22262b' : '#fcfcfa',
      tooltipBorder: dark ? 'rgba(255,255,255,0.16)' : '#dcded2',
      // رنگ‌های کسب‌وکار — همان متغیرهای CSS
      raw: '#047857',      // زمردی
      metal: '#b45309',    // کهربایی
      setup: '#0f766e',    // فیروزه‌ای
      uncut: '#be123c',    // رز
      gray: dark ? '#7c848c' : '#a3a89e',
    };
  };

  /** ساخت/بازیابی نمونهٔ چارت با شناسهٔ المان */
  Dashboard.chartOf = function (elId) {
    const el = document.getElementById(elId);
    if (!el || !Dashboard.hasECharts()) return null;
    if (Dashboard._charts[elId]) return Dashboard._charts[elId];
    if (!el.clientWidth) return null;   // مخفی است — هنگام نمایش ساخته می‌شود
    const inst = window.echarts.init(el);
    Dashboard._charts[elId] = inst;
    return inst;
  };

  /** اعمال گزینه‌ها روی چارت (بدون Merge — رندر تازه) */
  Dashboard.applyChart = function (elId, option) {
    const inst = Dashboard.chartOf(elId);
    if (!inst) { Dashboard._pendingCharts = true; return false; }
    inst.setOption(option, { notMerge: true });
    return true;
  };

  /** حذف امن نمونهٔ چارت (حالت خالی — جلوگیری از نمونهٔ سرگردان) */
  Dashboard.disposeChart = function (elId) {
    if (Dashboard._charts[elId]) {
      try { Dashboard._charts[elId].dispose(); } catch (e) { /* noop */ }
      delete Dashboard._charts[elId];
    }
  };

  /** رندر مجدد همهٔ نمودارها (تعویض تم / بازگشت به تب) — نسخهٔ ۲٫۴:
      میله‌ای دستگاه‌ها + دو دونات زمان + نمودار ستونی ستاپ‌ها */
  Dashboard.rerenderCharts = function () {
    if (!Dashboard._state) return;
    const s = Dashboard._state.summary;
    if (s.timeRulesCount) {
      Dashboard.renderMachineTimeChart(Dashboard._state);
      Dashboard.renderTimeDonuts(Dashboard._state);
      Dashboard.renderSetupInventoryColumnChart(Dashboard._state);
    }
    Dashboard._pendingCharts = false;
  };

  /** هوک نمایش تب — نمودارهای معوق/تازه‌شده را رندر می‌کند */
  Dashboard.onShown = function () {
    // اگر المان مخفی بوده و چارت ساخته نشده → ساخت پس از نمایان شدن
    for (const id of Object.keys(Dashboard._charts)) {
      Dashboard._charts[id].resize();
    }
    Dashboard.rerenderCharts();
  };

  /* ---------- تغییر اندازهٔ پنجره → مقیاس‌دهی مجدد ---------- */
  let _resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
      Object.values(Dashboard._charts).forEach((c) => { try { c.resize(); } catch (e) { /* noop */ } });
    }, 180);
  });

  /* ---------- تغییر تم → رنگ‌های نمودار تازه ---------- */
  if (typeof MutationObserver !== 'undefined') {
    const themeObserver = new MutationObserver(() => Dashboard.rerenderCharts());
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  /** رندر کامل داشبورد از وضعیت محاسبه‌شده */
  Dashboard.render = async function (state) {
    Dashboard._state = state;   // برای Drill-down هشدارها و نمودارها
    const s = state.summary;

    /* ---------- کارت‌های KPI (منطق جدید §58-§59) ---------- */
    document.getElementById('kpi-raw').textContent = U.faNum(s.rawRollsCount);
    document.getElementById('kpi-raw-meta').innerHTML =
      `در تطبیق با ستاپ‌ها: ${U.faNum(s.rawMatchedCount)} · تعداد گروه‌ها: ${U.faNum(s.totalGroups)}`;

    /* ---------- کارت‌های مانده زمان متالایز (تغییرات جدید — جایگزین کارت‌های
       «رول‌های متالایز شده» و «کل رول‌های ستاپ‌ها») ---------- */
    if (!s.timeRulesCount) {
      // هیچ قانون زمانی تعریف نشده — کارت‌ها و چارت حالت خالی
      document.getElementById('kpi-remaining-setup').textContent = '—';
      document.getElementById('kpi-remaining-setup-meta').textContent =
        'قانون زمان متالایز تعریف نشده — از تنظیمات «قانون زمان متالایز» اضافه کنید.';
      document.getElementById('kpi-remaining-produced').textContent = '—';
      document.getElementById('kpi-remaining-produced-meta').textContent =
        'قانون زمان متالایز تعریف نشده — از تنظیمات «قانون زمان متالایز» اضافه کنید.';
      document.getElementById('machine-time-chips').innerHTML =
        '<span class="chip chip-warn">قانون زمان تعریف نشده</span>';
      Dashboard.disposeChart('machine-time-chart');
      document.getElementById('machine-time-footer').innerHTML = '';
      document.getElementById('machine-time-chart').innerHTML = `
        <div class="empty-state">
          ${UI.icons.alert}
          <p>برای نمایش گزارش مانده زمان متالایز، ابتدا در تب «تنظیمات» برای هر دستگاه قانون زمان تعریف کنید:<br>
          (شماره دستگاه، متراژ استاندارد، تعداد در شیفت → مدت زمان خودکار = ۷۲۰ ÷ تعداد)</p>
        </div>`;
      // دونات‌ها و نمودار ستونی نیز بدون قانون زمان محاسبه نمی‌شوند (نسخهٔ ۲٫۴)
      const emptyCharts = ['inventory-time-chart', 'setup-time-chart', 'setup-inventory-chart'];
      for (const id of emptyCharts) {
        Dashboard.disposeChart(id);
        const el = document.getElementById(id);
        if (el) el.innerHTML = `
          <div class="empty-state" style="min-height:220px">
            ${UI.icons.alert}
            <p>قانون زمان متالایز تعریف نشده — از تب «تنظیمات» قانون زمان اضافه کنید.</p>
          </div>`;
      }
    } else {
      document.getElementById('kpi-remaining-setup').textContent = U.hoursOf(s.totalRemainingSetupTime) !== null
        ? `${U.faNum(U.hoursOf(s.totalRemainingSetupTime))} ساعت`
        : '—';
      document.getElementById('kpi-remaining-setup-meta').innerHTML =
        `دقیق: ${U.faHMM(s.totalRemainingSetupTime)} · ` +
        `${U.faNum(s.timeRuleCoverage.covered)} رکورد دارای قانون` +
        (s.timeRuleCoverage.uncovered > 0
          ? ` · ⚠ ${U.faNum(s.timeRuleCoverage.uncovered)} رکورد بدون قانون`
          : '');

      document.getElementById('kpi-remaining-produced').textContent = U.hoursOf(s.totalRemainingProducedTime) !== null
        ? `${U.faNum(U.hoursOf(s.totalRemainingProducedTime))} ساعت`
        : '—';
      document.getElementById('kpi-remaining-produced-meta').innerHTML =
        `دقیق: ${U.faHMM(s.totalRemainingProducedTime)} · تفاوت با ستاپ: ${U.faHMM(
          s.totalRemainingSetupTime - s.totalRemainingProducedTime
        )} (زمان رول‌های متالایزشده)`;

      Dashboard.renderMachineTimeChart(state);

      /* ---------- دو دونات زمان (نسخهٔ ۲٫۴ — جایگزین دونات وضعیت خام) ---------- */
      Dashboard.renderTimeDonuts(state);

      /* ---------- نمودار ستونی مانده زمان موجودی همهٔ ستاپ‌ها (نسخهٔ ۲٫۴) ---------- */
      Dashboard.renderSetupInventoryColumnChart(state);
    }

    const uncutValue = document.getElementById('kpi-uncut');
    uncutValue.textContent = U.faNum(s.totalUncut);

    // فرمول شفاف برش‌نشده (§51 — مغایرت پنهان نمی‌شود)
    document.getElementById('kpi-uncut-meta').innerHTML =
      `Σ [ستاپ − (خام + متالایز)] = ${U.faNum(s.totalSetupRolls)} − ` +
      `(${U.faNum(s.rawMatchedCount)} + ${U.faNum(s.metallizedAllocated)})` +
      (s.totalConflict > 0
        ? `<br>⚠ مغایرت ظرفیت: ${U.faNum(s.totalConflict)} رول (در گزارش ستاپ‌ها)`
        : '');

    // حالت هشدار کارت برش‌نشده (مغایرت ظرفیت)
    const uncutCard = uncutValue.closest('.kpi-card');
    uncutCard.classList.toggle('negative', s.totalConflict > 0);

    /* ---------- مرکز هشدار کیفیت داده (§52 — B) ---------- */
    Dashboard.renderAlerts(state.warnings);

    /* ---------- اطلاعات فایل‌ها (§12) ---------- */
    await Dashboard.renderImportBadges();
  };

  /* ---------- چارت مانده زمان متالایز به تفکیک دستگاه (نسخهٔ ۲٫۳ — ECharts) ---------- */

  /**
   * نمودار میله‌ای افقی گروهی ECharts — هر دستگاه (۱/۲/۳) دو میله:
   *   «مانده زمان ستاپ» (فیروزه‌ای) و «مانده زمان موجودی» (کهربایی).
   * نسخهٔ ۲٫۵ — راست‌به‌چپ: نام دستگاه‌ها در سمت راست (yAxis position:right)
   * و میله‌ها از راست (کنار نام‌ها) به چپ رشد می‌کنند (xAxis inverse).
   * Tooltip فارسی با مدت دقیق + برچسب ساعت روی محور. Fallback: میله‌های CSS.
   * زیر نمودار: آمار دوخطی (کمترین دستگاه + میانگین) — نسخهٔ ۲٫۴.
   */
  Dashboard.renderMachineTimeChart = function (state) {
    const s = state.summary;
    const machines = RM.config.VALID_MACHINES;

    // بیشینه برای مقیاس
    let maxVal = 0;
    for (const m of machines) {
      const t = s.machineTime[m];
      if (t) maxVal = Math.max(maxVal, t.setup, t.produced);
    }

    const chipsEl = document.getElementById('machine-time-chips');
    chipsEl.innerHTML = `
      <span class="chip">قوانین زمان: ${U.faNum(s.timeRulesCount)}</span>
      <span class="chip chip-strong">جمع مانده زمان ستاپ: ${U.faHMM(s.totalRemainingSetupTime)}</span>
      <span class="chip chip-ok">جمع مانده زمان موجودی: ${U.faHMM(s.totalRemainingProducedTime)}</span>
      ${s.timeRuleCoverage.uncovered > 0
        ? `<span class="chip chip-warn">${U.faNum(s.timeRuleCoverage.uncovered)} رکورد بدون قانون</span>`
        : ''}
    `;

    /* ---------- آمار کارت‌بندی‌شده زیر نمودار (نسخهٔ ۲٫۶) ----------
       ستون راست: «کمترین مانده زمان موجودی» (دستگاه دارای کمترین مقدار) + دو کارت
       (مانده زمان موجودی / مانده زمان ستاپ — هرکدام با معادل روزانه).
       ستون چپ: «میانگین دستگاه‌ها» (جمع ÷ تعداد) + همان دو کارت.
       همهٔ زمان‌ها با فرمت [H]:mm + معادل روزانه (روز ۲۴ ساعته) */
    const producedOf = (m) => (s.machineTime[m] ? s.machineTime[m].produced : 0);
    const setupOf = (m) => (s.machineTime[m] ? s.machineTime[m].setup : 0);
    let minMachine = machines[0];
    let minProduced = Infinity;
    for (const m of machines) {
      if (producedOf(m) < minProduced) { minProduced = producedOf(m); minMachine = m; }
    }
    const machineCount = machines.length;
    const avgProduced = s.totalRemainingProducedTime / machineCount;
    const avgSetup = s.totalRemainingSetupTime / machineCount;

    const statCol = (title, producedMin, setupMin) => `
      <div class="mt-col">
        <div class="mt-col-title">${title}</div>
        <div class="mt-card mt-card-inv">
          <div class="mt-card-label">مانده زمان موجودی</div>
          <div class="mt-card-value">${U.faHMM(producedMin)}</div>
          <div class="mt-card-days">معادل روزانه: ${U.faDaysOf(producedMin)}</div>
        </div>
        <div class="mt-card mt-card-setup">
          <div class="mt-card-label">مانده زمان ستاپ</div>
          <div class="mt-card-value">${U.faHMM(setupMin)}</div>
          <div class="mt-card-days">معادل روزانه: ${U.faDaysOf(setupMin)}</div>
        </div>
      </div>`;

    document.getElementById('machine-time-footer').innerHTML = `
      <div class="mt-cards">
        ${statCol(`کمترین مانده زمان موجودی — دستگاه ${U.faNum(minMachine)}`, producedOf(minMachine), setupOf(minMachine))}
        ${statCol(`میانگین دستگاه‌ها (${U.faNum(machineCount)} دستگاه)`, avgProduced, avgSetup)}
      </div>`;

    if (!Dashboard.hasECharts()) {
      Dashboard.renderMachineTimeChartFallback(state);   // کتابخانه در دسترس نیست
      return;
    }

    const P = Dashboard.chartPalette();
    const cats = machines.map((m) => `دستگاه ${U.faNumPlain(m)}`).reverse();   // دستگاه ۱ بالا
    const setupData = machines.map((m) => {
      const t = s.machineTime[m];
      return t && t.setup ? t.setup : 0;
    }).reverse();
    const producedData = machines.map((m) => {
      const t = s.machineTime[m];
      return t && t.produced ? t.produced : 0;
    }).reverse();
    const recordsByMachine = machines.map((m) => {
      const t = s.machineTime[m];
      return t ? t.records : 0;
    }).reverse();

    const option = {
      animationDuration: 550,
      animationEasing: 'cubicOut',
      textStyle: { fontFamily: P.fontFamily },
      // نسخهٔ ۲٫۵: راست‌به‌چپ — میله‌ها از راست (کنار نام دستگاه‌ها) به چپ رشد می‌کنند
      grid: { left: 56, right: 8, top: 42, bottom: 8, containLabel: true },
      legend: {
        top: 4,
        right: 8,
        itemWidth: 14,
        itemHeight: 9,
        itemGap: 18,
        textStyle: { color: P.muted, fontFamily: P.fontFamily, fontSize: 11 },
        data: ['مانده زمان ستاپ', 'مانده زمان موجودی'],
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: P.splitLine } },
        backgroundColor: P.tooltipBg,
        borderColor: P.tooltipBorder,
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: P.text, fontFamily: P.fontFamily, fontSize: 12 },
        formatter: (params) => {
          const idx = params[0] ? params[0].dataIndex : 0;
          const m = RM.config.VALID_MACHINES[machines.length - 1 - idx] || '—';
          const lines = [`<b>دستگاه ${U.faNumPlain(m)}</b> · ${U.faNum(recordsByMachine[idx] || 0)} رکورد`];
          for (const p of params) {
            lines.push(`${p.marker} ${p.seriesName}: <b>${U.faDuration(p.value)}</b>${p.value ? ` (~${U.faNum(Math.round(p.value / 60))} ساعت)` : ''}`);
          }
          return lines.join('<br>');
        },
      },
      xAxis: {
        type: 'value',
        inverse: true,                       // نسخهٔ ۲٫۵: صفر در راست → رشد به چپ
        max: (v) => Math.max(v.max * 1.08, 60),
        axisLabel: {
          color: P.muted,
          fontFamily: P.fontFamily,
          fontSize: 10.5,
          formatter: (v) => `${U.faNumPlain(Math.round(v / 60))} ساعت`,
        },
        splitLine: { lineStyle: { color: P.splitLine, width: 1 } },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'category',
        position: 'right',                  // نسخهٔ ۲٫۵: نام دستگاه‌ها در سمت راست
        data: cats,
        axisLabel: { color: P.text, fontFamily: P.fontFamily, fontSize: 12, fontWeight: 600 },
        axisLine: { lineStyle: { color: P.axisLine } },
        axisTick: { show: false },
      },
      series: [
        {
          name: 'مانده زمان ستاپ',
          type: 'bar',
          data: setupData,
          barMaxWidth: 18,
          barGap: '28%',
          itemStyle: { color: P.setup, borderRadius: [4, 0, 0, 4] },
          emphasis: { itemStyle: { color: P.setup, opacity: 0.82 } },
          label: {
            show: true,
            position: 'left',              // نسخهٔ ۲٫۵: نوک میله (سمت چپ — رشد راست‌به‌چپ)
            // نسخهٔ ۲٫۶: بولد‌تر + تم‌آگاه (تاریک → روشن، روشن → سیاه)
            color: P.dark ? '#e8ebef' : '#15181c',
            fontFamily: P.fontFamily,
            fontSize: 10.5,
            fontWeight: 700,
            formatter: (p) => (p.value ? `${U.faNumPlain(Math.round(p.value / 60))} ساعت` : ''),
          },
        },
        {
          name: 'مانده زمان موجودی',
          type: 'bar',
          data: producedData,
          barMaxWidth: 18,
          itemStyle: { color: P.metal, borderRadius: [4, 0, 0, 4] },
          emphasis: { itemStyle: { color: P.metal, opacity: 0.82 } },
          label: {
            show: true,
            position: 'left',              // نسخهٔ ۲٫۵: نوک میله (سمت چپ — رشد راست‌به‌چپ)
            // نسخهٔ ۲٫۶: بولد‌تر + تم‌آگاه (تاریک → روشن، روشن → سیاه)
            color: P.dark ? '#e8ebef' : '#15181c',
            fontFamily: P.fontFamily,
            fontSize: 10.5,
            fontWeight: 700,
            formatter: (p) => (p.value ? `${U.faNumPlain(Math.round(p.value / 60))} ساعت` : ''),
          },
        },
      ],
    };

    Dashboard.applyChart('machine-time-chart', option);
  };

  /* ---------- دو دونات زمان متالایز (نسخهٔ ۲٫۴ — جایگزین دونات وضعیت خام) ----------
     زیر نمودار میله‌ای، دو دونات قرار می‌گیرد:
       ۱) دونات «مانده زمان موجودی» — سهم هر سه دستگاه + متن مرکزی دوخطی:
          بالا «کمترین: [H]:mm» و پایین «میانگین: [H]:mm»
       ۲) دونات «مانده زمان ستاپ» — همان ساختار با زمان‌های ستاپ
     میانگین = جمع دستگاه‌ها ÷ تعداد دستگاه‌ها.
     نسخهٔ ۲٫۵: مرکز دونات = مرکز بوم (center ۵۰٪/۵۰٪) و متن مرکزی با
     top:'middle' دقیقاً وسط‌چین می‌شود — مابین دو خط «کمترین/میانگین».
     نسخهٔ ۲٫۶: رنگ دستگاه‌ها پررنگ‌تر (۱=#82C836 · ۲=#F09252 · ۳=#00C1EE) و
     متن مرکزی بولد با فونت تطبیقی — همیشه داخل حفرهٔ مرکز (بیرون نمی‌زند). */

  /** ساخت و اعمال یک دونات زمان (سهم دستگاه‌ها + مرکز دوخطی کمترین/میانگین) */
  Dashboard.timeDonutOption = function (P, values, metricLabel, boxSize) {
    const machines = RM.config.VALID_MACHINES;
    const total = values.reduce((a, b) => a + b, 0);
    const minVal = Math.min(...values);
    const avgVal = total / machines.length;

    /* فونت تطبیقی متن مرکزی (نسخهٔ ۲٫۶): بر اساس ابعاد واقعی بوم،
       اندازه‌ای انتخاب می‌شود که دو خط «کمترین/میانگین» با فونت بولد
       همیشه داخل حفرهٔ مرکز جا شوند (حاشیهٔ امن ۱۴px). */
    const minDim = boxSize && (boxSize.w || boxSize.h)
      ? Math.max(180, Math.min(boxSize.w || 320, boxSize.h || 320))
      : 320;
    const innerR = (minDim / 2) * 0.54;                    // شعاع داخلی دونات (px)
    let fs = Math.max(10.5, Math.min(13.5, innerR * 0.16));
    const maxChars = Math.max(
      `کمترین: ${U.faHMM(minVal)}`.length,
      `میانگین: ${U.faHMM(avgVal)}`.length
    );
    const maxW = innerR * 2 - 14;                          // عرض مجاز داخل حفره
    while (fs > 9.5 && maxChars * 0.6 * fs > maxW) fs -= 0.5;

    return {
      animationDuration: 550,
      textStyle: { fontFamily: P.fontFamily },
      tooltip: {
        trigger: 'item',
        backgroundColor: P.tooltipBg,
        borderColor: P.tooltipBorder,
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: P.text, fontFamily: P.fontFamily, fontSize: 12 },
        formatter: (p) => `<b>${p.name}</b> — ${metricLabel}<br>${U.faHMM(p.value)}${
          p.value ? ` (~${U.faNumPlain(Math.round(p.value / 60))} ساعت · ${U.faDaysOf(p.value)})` : ''}`,
      },
      legend: {
        bottom: 2,
        left: 'center',
        itemWidth: 12,
        itemHeight: 12,
        itemGap: 14,
        textStyle: { color: P.muted, fontFamily: P.fontFamily, fontSize: 11 },
      },
      series: [
        {
          type: 'pie',
          radius: ['54%', '74%'],
          center: ['50%', '50%'],   // نسخهٔ ۲٫۵: مرکز دونات = مرکز بوم → متن مرکزی دقیقاً وسط
          avoidLabelOverlap: true,
          itemStyle: { borderColor: P.dark ? '#16181b' : '#fcfcfa', borderWidth: 2 },
          label: {
            show: true,
            color: P.muted,
            fontFamily: P.fontFamily,
            fontSize: 10.5,
            formatter: (p) => (p.value ? U.faHMM(p.value) : ''),   // نسخهٔ ۲٫۵: برچسب مقدار صفر مخفی
          },
          emphasis: {
            scale: true,
            scaleSize: 5,
            label: { show: true, fontWeight: 700 },
          },
          data: machines.map((m, i) => ({
            name: `دستگاه ${U.faNumPlain(m)}`,
            value: values[i],
            itemStyle: { color: RM.config.MACHINE_COLORS[m] || P.setup },
          })),
        },
      ],
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: 'middle',              // نسخهٔ ۲٫۵: دقیقاً مرکز بوم = مرکز دونات
          style: {
            // نسخهٔ ۲٫۶: دو خط بولد — برچسب (کمترین/میانگین) + مقدار درشت‌تر؛
            // fontSize تطبیقی همیشه داخل حفرهٔ مرکز می‌ماند
            text: `{lbl|کمترین: }{v|${U.faHMM(minVal)}}\n{lbl|میانگین: }{v|${U.faHMM(avgVal)}}`,
            rich: {
              lbl: {
                fontSize: Math.max(9.5, fs - 1.5),
                fontWeight: 700,
                color: P.muted,
                fontFamily: P.fontFamily,
              },
              v: {
                fontSize: fs,
                fontWeight: 800,
                color: P.text,
                fontFamily: P.fontFamily,
              },
            },
            fontSize: fs,
            fontFamily: P.fontFamily,
            textAlign: 'center',
            textVerticalAlign: 'middle',
            fill: P.text,
            lineHeight: Math.round(fs * 1.7),
          },
        },
      ],
    };
  };

  /** رندر دو دونات «مانده زمان موجودی» و «مانده زمان ستاپ» */
  Dashboard.renderTimeDonuts = function (state) {
    const s = state.summary;
    const machines = RM.config.VALID_MACHINES;
    const producedValues = machines.map((m) => (s.machineTime[m] ? s.machineTime[m].produced : 0));
    const setupValues = machines.map((m) => (s.machineTime[m] ? s.machineTime[m].setup : 0));

    const hasAny = producedValues.some((v) => v > 0) || setupValues.some((v) => v > 0);
    if (!hasAny) {
      const emptyHtml = `
        <div class="empty-state" style="min-height:220px">
          ${UI.icons.alert}
          <p>هنوز رکوردی با قانون زمان متالایز تطبیق نشده — دونات‌ها پس از تطبیق رکوردها رندر می‌شوند.</p>
        </div>`;
      for (const id of ['inventory-time-chart', 'setup-time-chart']) {
        Dashboard.disposeChart(id);
        const el = document.getElementById(id);
        if (el) el.innerHTML = emptyHtml;
      }
      return;
    }

    if (!Dashboard.hasECharts()) {
      // Fallback: چیپ‌های متنی هر دستگاه
      const rowsHtml = (vals) => machines.map((m, i) =>
        `<div class="mt-row"><div class="mt-label"><b style="color:${RM.config.MACHINE_COLORS[m]}">دستگاه ${U.faNum(m)}</b></div><b>${U.faHMM(vals[i])}</b></div>`
      ).join('');
      const inv = document.getElementById('inventory-time-chart');
      const stp = document.getElementById('setup-time-chart');
      if (inv) inv.innerHTML = `<div class="mt-rows" style="padding:12px">${rowsHtml(producedValues)}</div>`;
      if (stp) stp.innerHTML = `<div class="mt-rows" style="padding:12px">${rowsHtml(setupValues)}</div>`;
      return;
    }

    const P = Dashboard.chartPalette();
    /* ابعاد واقعی بوم‌ها → فونت تطبیقی متن مرکزی (نسخهٔ ۲٫۶) */
    const boxOf = (id) => {
      const el = document.getElementById(id);
      return el ? { w: el.clientWidth, h: el.clientHeight } : { w: 0, h: 0 };
    };
    Dashboard.applyChart('inventory-time-chart',
      Dashboard.timeDonutOption(P, producedValues, 'مانده زمان موجودی', boxOf('inventory-time-chart')));
    Dashboard.applyChart('setup-time-chart',
      Dashboard.timeDonutOption(P, setupValues, 'مانده زمان ستاپ', boxOf('setup-time-chart')));
  };

  /* ---------- نمودار ستونی مانده زمان موجودی همهٔ ستاپ‌ها (نسخهٔ ۲٫۴ / ۲٫۵) ----------
     نسخهٔ ۲٫۵: به‌ازای هر ستاپ (شماره ستاپ) فقط یک میله — مجموع مانده زمان
     موجودی همهٔ رکوردهای همان شماره ستاپ (Σ [مدت × (تعداد − متالایز)]).
     رکوردهای بدون قانون زمان در مجموع لحاظ نمی‌شوند (Tooltip اعلام می‌کند). */

  Dashboard.renderSetupInventoryColumnChart = function (state) {
    const report = state.setupReport;
    const el = document.getElementById('setup-inventory-chart');
    if (!el) return;

    if (!report.length) {
      Dashboard.disposeChart('setup-inventory-chart');
      el.innerHTML = `
        <div class="empty-state" style="min-height:220px">
          ${UI.icons.alert}
          <p>هنوز ستاپی ثبت نشده — هر ستاپ (شماره ستاپ) یک میله از مجموع مانده زمان موجودی رکوردهایش خواهد بود.</p>
        </div>`;
      return;
    }

    // مرتب‌سازی رکوردها: شماره ستاپ → دستگاه → عرض
    const sorted = [...report].sort((a, b) =>
      (a.setupNumber - b.setupNumber) ||
      (a.machineNumber - b.machineNumber) ||
      (a.width - b.width));

    // گروه‌بندی بر اساس شماره ستاپ — یک میله برای هر ستاپ (نسخهٔ ۲٫۵)
    const groups = [];
    const bySetup = new Map();
    for (const r of sorted) {
      let g = bySetup.get(r.setupNumber);
      if (!g) {
        g = { setupNumber: r.setupNumber, records: [], total: 0, noRuleCount: 0 };
        bySetup.set(r.setupNumber, g);
        groups.push(g);
      }
      g.records.push(r);
      if (r.remainingProducedTime === null) {
        g.noRuleCount++;                       // رکورد بدون قانون زمان
      } else {
        g.total += r.remainingProducedTime;    // Σ [مدت × (تعداد − متالایز)]
      }
    }

    const values = groups.map((g) => g.total);

    if (!Dashboard.hasECharts()) {
      // Fallback: فهرست متنی — یک ردیف برای هر ستاپ (مجموع)
      el.innerHTML = `
        <div class="mt-rows" style="padding:12px; max-height:320px; overflow:auto">
          ${groups.map((g) => `<div class="mt-row"><div class="mt-label"><b>ستاپ ${U.faNum(g.setupNumber)}</b> · ${U.faNum(g.records.length)} رکورد</div><b>${U.faHMM(g.total)}</b></div>`).join('')}
        </div>`;
      return;
    }

    const P = Dashboard.chartPalette();
    const showLabels = groups.length <= 14;

    const option = {
      animationDuration: 550,
      textStyle: { fontFamily: P.fontFamily },
      grid: { left: 10, right: 16, top: 26, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: P.splitLine } },
        backgroundColor: P.tooltipBg,
        borderColor: P.tooltipBorder,
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: P.text, fontFamily: P.fontFamily, fontSize: 12 },
        // نسخهٔ ۲٫۶: فقط ستاپ + مانده زمان موجودی — جزئیات رکوردها حذف شد
        formatter: (params) => {
          const p = params[0];
          if (!p) return '';
          const g = groups[p.dataIndex];
          return `<b>ستاپ ${U.faNum(g.setupNumber)}</b><br>مانده زمان موجودی: <b>${U.faHMM(p.value)}</b>`;
        },
      },
      xAxis: {
        type: 'category',
        data: groups.map((g) => U.faNumPlain(g.setupNumber)),
        axisLabel: {
          color: P.muted,
          fontFamily: P.fontFamily,
          fontSize: 10.5,
          hideOverlap: true,
          interval: 'auto',
        },
        axisLine: { lineStyle: { color: P.axisLine } },
        axisTick: { show: false },
        name: 'شماره ستاپ',
        nameLocation: 'middle',
        nameGap: 26,
        nameTextStyle: { color: P.faint, fontFamily: P.fontFamily, fontSize: 10.5 },
      },
      yAxis: {
        type: 'value',
        max: (v) => Math.max(v.max * 1.12, 60),
        axisLabel: {
          color: P.muted,
          fontFamily: P.fontFamily,
          fontSize: 10.5,
          formatter: (v) => `${U.faNumPlain(Math.round(v / 60))} ساعت`,
        },
        splitLine: { lineStyle: { color: P.splitLine, width: 1 } },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          name: 'مانده زمان موجودی',
          type: 'bar',
          data: values,
          barMaxWidth: 34,
          itemStyle: { color: P.metal, borderRadius: [5, 5, 0, 0] },
          emphasis: { itemStyle: { color: P.metal, opacity: 0.82 } },
          label: showLabels
            ? {
                show: true,
                position: 'top',
                color: P.muted,
                fontFamily: P.fontFamily,
                fontSize: 9.5,
                formatter: (p) => (p.value ? U.faHMM(p.value) : ''),
              }
            : { show: false },
        },
      ],
    };

    Dashboard.applyChart('setup-inventory-chart', option);
  };

  /* ---------- Fallback قدیمی: میله‌های CSS (نبود ECharts) ---------- */

  Dashboard.renderMachineTimeChartFallback = function (state) {
    const s = state.summary;
    const machines = RM.config.VALID_MACHINES;

    let maxVal = 0;
    for (const m of machines) {
      const t = s.machineTime[m];
      if (t) maxVal = Math.max(maxVal, t.setup, t.produced);
    }
    if (maxVal === 0) maxVal = 1;

    const rows = machines.map((m) => {
      const t = s.machineTime[m] || { setup: 0, produced: 0, records: 0 };
      const setupPct = Math.max(2, Math.round((t.setup / maxVal) * 100));
      const producedPct = Math.max(2, Math.round((t.produced / maxVal) * 100));
      const hasData = t.records > 0;

      return `
        <div class="mt-row" data-machine="${m}">
          <div class="mt-label">
            <b>دستگاه ${U.faNum(m)}</b>
            <span class="muted mt-records">${hasData ? `${U.faNum(t.records)} رکورد` : 'بدون رکورد مطابق'}</span>
          </div>
          <div class="mt-bars">
            <div class="mt-bar-line">
              <span class="mt-legend-setup" title="مانده زمان ستاپ = مدت زمان × تعداد">ستاپ</span>
              <div class="mt-track">
                <div class="mt-bar mt-bar-setup" style="width:${hasData ? setupPct : 0}%"></div>
              </div>
              <span class="mt-val">${U.faDuration(t.setup)}</span>
            </div>
            <div class="mt-bar-line">
              <span class="mt-legend-produced" title="مانده زمان موجودی = مدت زمان × (تعداد − متالایز)">موجودی</span>
              <div class="mt-track">
                <div class="mt-bar mt-bar-produced" style="width:${hasData ? producedPct : 0}%"></div>
              </div>
              <span class="mt-val">${U.faDuration(t.produced)}</span>
            </div>
          </div>
        </div>`;
    }).join('');

    document.getElementById('machine-time-chart').innerHTML = `
      <div class="mt-legend-bar">
        <span class="mt-legend-item"><span class="mt-dot mt-dot-setup"></span> مانده زمان ستاپ (مدت زمان × تعداد)</span>
        <span class="mt-legend-item"><span class="mt-dot mt-dot-produced"></span> مانده زمان موجودی (مدت زمان × (تعداد − متالایز))</span>
      </div>
      <div class="mt-rows">${rows}</div>`;
  };

  /* ---------- مرکز هشدار + Drill-down رکوردهای عامل (§8 اصلاحات) ---------- */

  const SEVERITY_META = {
    error: { label: 'خطا', cls: 'alert-error' },
    warning: { label: 'هشدار', cls: 'alert-warning' },
  };

  Dashboard.renderAlerts = function (warnings) {
    const wrap = document.getElementById('alerts-list');
    const panel = document.getElementById('alerts-panel');

    if (!warnings.length) {
      panel.hidden = true;
      wrap.innerHTML = '';
      return;
    }

    panel.hidden = false;
    document.getElementById('alerts-count').textContent = U.faNum(warnings.length);

    wrap.innerHTML = warnings.map((w) => {
      const meta = SEVERITY_META[w.severity] || SEVERITY_META.warning;
      const hasDrill = !!w.drill;
      return `
        <div class="alert-item ${meta.cls}" role="alert" data-alert="${U.escapeHtml(w.type)}">
          <span class="alert-badge">${meta.label}</span>
          <div class="alert-body">
            <b>${U.escapeHtml(w.title)}</b>
            <p>${U.escapeHtml(w.detail)}</p>
          </div>
          ${hasDrill
            ? `<button type="button" class="btn btn-ghost btn-sm" data-alert-drill="${U.escapeHtml(w.type)}" title="نمایش رکوردهای عامل این هشدار">مشاهدهٔ رکوردها</button>`
            : (w.action
              ? `<button type="button" class="btn btn-ghost btn-sm" data-alert-action="${w.action}">مشاهده</button>`
              : '')}
        </div>`;
    }).join('');

    // دکمهٔ «مشاهدهٔ رکوردها» → Drill-down دقیق رکوردهای عامل همان هشدار
    wrap.querySelectorAll('[data-alert-drill]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const w = warnings.find((x) => x.type === btn.dataset.alertDrill);
        if (w) Dashboard.openDrill(w);
      });
    });

    // هشدارهای بدون Drill → رفتن به بخش مرتبط (رفتار قبلی حفظ شد)
    wrap.querySelectorAll('[data-alert-action]').forEach((btn) => {
      btn.addEventListener('click', () => UI.switchTab(btn.dataset.alertAction));
    });
  };

  /**
   * بازکردن Drill-down یک هشدار — دقیقاً رکوردهای عامل همان Rule.
   * موجودیت‌های Roll از مودال مشترک با ستون‌های Mapping استفاده می‌کنند؛
   * هشدارهای مربوط به ستاپ/قانون جدول اختصاصی خودشان را می‌گیرند.
   */
  Dashboard.openDrill = async function (warning) {
    const d = warning.drill;
    if (!d) return;

    try {
      /* --- هشدارهای مربوط به ستاپ‌ها --- */
      if (d.source === 'setups') {
        const state = Dashboard._state;
        const rows = (d.filter === 'capacity-conflict')
          ? state.setupReport.filter((r) => r.conflict > 0)
          : (d.filter === 'no-time-rule')
            ? state.setupReport.filter((r) => r.remainingSetupTime === null)
            : state.setupReport.filter((r) => r.thickness === null || r.standardLength === null);

        const timeCols = (d.filter === 'no-time-rule')
          ? '<th>مانده زمان</th>'
          : '<th>خام</th><th>متالایز</th><th>مغایرت</th>';

        UI.infoModal(warning.title, `
          <div class="drill-subtitle"><b>${U.faNum(rows.length)}</b> رکورد ستاپ</div>
          <div class="table-wrap table-scroll" style="max-height:420px">
            <table class="data-table">
              <thead><tr><th>ستاپ</th><th>دستگاه</th><th>عرض</th><th>ضخامت</th><th>متراژ استاندارد</th><th>تعداد</th>${timeCols}</tr></thead>
              <tbody>${rows.map((r) => `
                <tr>
                  <td>${U.faNum(r.setupNumber)}</td>
                  <td>${U.faNum(r.machineNumber)}</td>
                  <td>${U.faWidth(r.width)}</td>
                  <td>${r.thickness === null ? '<span class="muted">ناقص</span>' : U.faNum(r.thickness)}</td>
                  <td>${r.standardLength === null ? '<span class="muted">ناقص</span>' : U.faNum(r.standardLength)}</td>
                  <td class="count-cell">${U.faNum(r.rollCount)}</td>
                  ${d.filter === 'no-time-rule'
                    ? `<td><span class="muted">بدون قانون زمان</span></td>`
                    : `<td>${U.faNum(r.rawExisting)}</td>
                       <td>${U.faNum(r.metallized)}</td>
                       <td>${r.conflict > 0 ? `<span class="pill-bad status-pill">⚠ ${U.faNum(r.conflict)}</span>` : '—'}</td>`}
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        `);
        return;
      }

      /* --- هشدار هم‌پوشانی قوانین --- */
      if (d.source === 'rules') {
        UI.infoModal(warning.title, `
          <div class="drill-subtitle"><b>${U.faNum(d.pairs.length)}</b> جفت قانون هم‌پوشان</div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>ضخامت</th><th>بازهٔ قانون ۱</th><th>بازهٔ قانون ۲</th></tr></thead>
              <tbody>${d.pairs.map(([a, b]) => `
                <tr>
                  <td class="thickness-cell">${U.faNum(a.thickness)}</td>
                  <td>${U.faNum(a.minLength)} تا ${U.faNum(a.maxLength)} → ${U.faNum(a.standardLength)}</td>
                  <td>${U.faNum(b.minLength)} تا ${U.faNum(b.maxLength)} → ${U.faNum(b.standardLength)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        `);
        return;
      }

      /* --- هشدارهای رکوردی (rolls / archived) → مودال مشترک --- */
      const sourceKey = d.source;
      const table = RM.config.IMPORT_TARGETS[sourceKey].table;
      let records = [];

      if (d.issue) {
        // نقص دادهٔ مستقیم: بدون عرض / بدون متراژ / بدون ضخامت / شماره رول / نوع فیلم
        // رزولور مشترک نقص‌ها («length» → actualLength در مدل داخلی)
        const all = await db[table].toArray();
        records = RM.normalize.recordsWithIssue(all, d.issue);
      } else if (d.filter === 'all') {
        // Mapping ناقص — همهٔ رکوردهای همان Dataset (فیلدهای مفقود «—» نمایش داده می‌شوند)
        records = await db[table].toArray();
      } else if (d.filter === 'no-rule') {
        // رول‌های خام بدون قانون متراژ — از گروه‌های بدون قانون (کلید‌محور)
        const state = Dashboard._state;
        const groups = state.rawRollGroups.filter((g) => !g.hasRule);
        const ids = groups.flatMap((g) => g.rollIds);
        records = (await db.rolls.bulkGet(ids)).filter(Boolean);
      } else if (d.filter === 'group') {
        // گروه‌های خاص (بدون ستاپ / مازاد خام)
        const state = Dashboard._state;
        const keySet = new Set(d.groupKeys || []);
        const groups = state.rawRollGroups.filter((g) => keySet.has(g.key));
        const ids = groups.flatMap((g) => g.rollIds);
        records = (await db.rolls.bulkGet(ids)).filter(Boolean);
      } else if (d.filter === 'metallized-unallocated') {
        // مازاد متالایز — یونیک‌های دارای کلیدِ تخصیص‌نیافته
        const state = Dashboard._state;
        const keySet = new Set(d.groupKeys || []);
        records = state.metallizedUniqueRecords.filter((r) =>
          keySet.has(U.formatKey(r.width, r.setupNumber))
        );
      }

      await UI.recordsDrillModal(warning.title, records, { source: sourceKey });
    } catch (err) {
      console.error('[Drill-down]', err);
      UI.toast('نمایش رکوردهای این هشدار با خطا مواجه شد.', 'error');
    }
  };

  /* ---------- اطلاعات آخرین Import (§12 — عنوان کاربرپسنده + نام فایل برای Audit) ---------- */

  Dashboard.renderImportBadges = async function () {
    for (const targetKey of ['rolls', 'archived']) {
      const el = document.getElementById(`kpi-file-${targetKey}`);
      if (!el) continue;

      const entries = await db.importMetadata
        .where('target').equals(targetKey)
        .reverse()
        .sortBy('importedAt');
      const info = entries[0];

      el.innerHTML = info
        ? `${U.escapeHtml(RM.config.DATASET_LABELS[targetKey])} — <code>${U.escapeHtml(U.truncate(info.fileName, 28))}</code> · ${U.faNum(info.totalRecords)} رکورد · ${U.faDate(info.importedAt)}`
        : '<span class="muted">فایلی بارگذاری نشده</span>';
    }
  };

  RM.views = RM.views || {};
  RM.views.dashboard = Dashboard;
})();
