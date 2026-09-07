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

  /** رندر کامل داشبورد از وضعیت محاسبه‌شده */
  Dashboard.render = async function (state) {
    Dashboard._state = state;   // برای Drill-down هشدارها
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
      document.getElementById('machine-time-chart').innerHTML = `
        <div class="empty-state">
          ${UI.icons.alert}
          <p>برای نمایش گزارش مانده زمان متالایز، ابتدا در تب «تنظیمات» برای هر دستگاه قانون زمان تعریف کنید:<br>
          (شماره دستگاه، متراژ استاندارد، تعداد در شیفت → مدت زمان خودکار = ۷۲۰ ÷ تعداد)</p>
        </div>`;
    } else {
      document.getElementById('kpi-remaining-setup').textContent = U.hoursOf(s.totalRemainingSetupTime) !== null
        ? `${U.faNum(U.hoursOf(s.totalRemainingSetupTime))} ساعت`
        : '—';
      document.getElementById('kpi-remaining-setup-meta').innerHTML =
        `دقیق: ${U.faDuration(s.totalRemainingSetupTime)} · ` +
        `${U.faNum(s.timeRuleCoverage.covered)} رکورد دارای قانون` +
        (s.timeRuleCoverage.uncovered > 0
          ? ` · ⚠ ${U.faNum(s.timeRuleCoverage.uncovered)} رکورد بدون قانون`
          : '');

      document.getElementById('kpi-remaining-produced').textContent = U.hoursOf(s.totalRemainingProducedTime) !== null
        ? `${U.faNum(U.hoursOf(s.totalRemainingProducedTime))} ساعت`
        : '—';
      document.getElementById('kpi-remaining-produced-meta').innerHTML =
        `دقیق: ${U.faDuration(s.totalRemainingProducedTime)} · تفاوت با ستاپ: ${U.faDuration(
          s.totalRemainingSetupTime - s.totalRemainingProducedTime
        )} (رول‌های هنوز تولیدنشده)`;

      Dashboard.renderMachineTimeChart(state);
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

  /* ---------- چارت مانده زمان متالایز به تفکیک دستگاه (تغییرات جدید) ---------- */

  /**
   * نمودار میله‌ای افقی هر دستگاه (۱/۲/۳) با دو میله:
   *   «مانده زمان ستاپ» (فیروزه‌ای) و «مانده زمان تولید شده» (کهربایی).
   * طول میله‌ها نسبت به بیشینهٔ کل مقیاس می‌شود (بزرگ‌ترین = ۱۰۰٪).
   */
  Dashboard.renderMachineTimeChart = function (state) {
    const s = state.summary;
    const machines = RM.config.VALID_MACHINES;

    // بیشینه برای مقیاس میله‌ها
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
              <span class="mt-legend-produced" title="مانده زمان تولید شده = مدت زمان × خام موجود">تولید شده</span>
              <div class="mt-track">
                <div class="mt-bar mt-bar-produced" style="width:${hasData ? producedPct : 0}%"></div>
              </div>
              <span class="mt-val">${U.faDuration(t.produced)}</span>
            </div>
          </div>
        </div>`;
    }).join('');

    const totalSetupH = U.hoursOf(s.totalRemainingSetupTime);
    const totalProducedH = U.hoursOf(s.totalRemainingProducedTime);

    document.getElementById('machine-time-chips').innerHTML = `
      <span class="chip">قوانین زمان: ${U.faNum(s.timeRulesCount)}</span>
      <span class="chip chip-strong">جمع مانده زمان ستاپ: ${U.faDuration(s.totalRemainingSetupTime)}</span>
      <span class="chip chip-ok">جمع مانده زمان تولید شده: ${U.faDuration(s.totalRemainingProducedTime)}</span>
      ${s.timeRuleCoverage.uncovered > 0
        ? `<span class="chip chip-warn">${U.faNum(s.timeRuleCoverage.uncovered)} رکورد بدون قانون</span>`
        : ''}
    `;

    document.getElementById('machine-time-chart').innerHTML = `
      <div class="mt-legend-bar">
        <span class="mt-legend-item"><span class="mt-dot mt-dot-setup"></span> مانده زمان ستاپ (مدت زمان × تعداد)</span>
        <span class="mt-legend-item"><span class="mt-dot mt-dot-produced"></span> مانده زمان تولید شده (مدت زمان × خام موجود)</span>
        <span class="mt-legend-item muted">مقیاس میله‌ها نسبت به بیشینه (${U.faNum(Math.round(maxVal / 60))} ساعت)</span>
      </div>
      <div class="mt-rows">${rows}</div>
      <div class="mt-total">
        جمع کل — ستاپ: <b>${U.faDuration(s.totalRemainingSetupTime)}</b>${totalSetupH !== null ? ` (~${U.faNum(totalSetupH)} ساعت)` : ''} ·
        تولید شده: <b>${U.faDuration(s.totalRemainingProducedTime)}</b>${totalProducedH !== null ? ` (~${U.faNum(totalProducedH)} ساعت)` : ''}
      </div>`;
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
