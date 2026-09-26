/* =========================================================================
   tables.js — کارخانهٔ جدول دادهٔ پیشرفته (پورت Vanilla از data-table.tsx)
   -------------------------------------------------------------------------
   الگوی استاندارد پروژهٔ متالایز — همهٔ جداول سامانه از همین کارخانه ساخته
   می‌شوند (رول‌ها ×۳، گروه‌های برش، جزئیات گروه، خلاصهٔ Import، هشدارها):
   · ردیف فیلتر زیر هر سرستون: کادر «فیلتر…» + دکمهٔ کوچک «≠» برای سوییچ
     شامل‌بودن/شامل‌نشودن (نرمال‌سازی ارقام فارسی/عربی + جداکننده‌ها)
   · «مرتب‌سازی»: پنل چندسطحی با شمارهٔ اولویت + جهت ↑/↓ + حذف + جابه‌جایی
   · «ترتیب ستون‌ها»: نمایش/مخفی (چشم) + عرض px + جابه‌جایی
   · «پاک‌کردن همهٔ فیلترها» با شمارندهٔ فیلترهای فعال
   · نوار پایین: چیپ «X از Y رکورد (فیلترشده)» + «ردیف‌های قابل نمایش»
   · سقف رندر DOM (maxDomRows) + ردیف جمع چسبان (sums) با دیتای فیلترشده
   · ماندگاری کامل وضعیت در localStorage: eva-table-{id}-{filters|sort|columns|rows}
   ========================================================================= */
(function () {
  'use strict';

  /* =========================================================================
     ابزارهای ماندگاری و فیلتر (منطق متالایز)
     ========================================================================= */

  function loadJSON(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) {
      return fallback;
    }
  }

  function saveJSON(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      /* سهمیهٔ پر یا حالت خصوصی مرورگر — ذخیره نادیده گرفته می‌شود */
    }
  }

  /** نرمال‌سازی متن جست‌وجو/سلول: ارقام لاتین + حذف جداکننده‌ها + کوچک */
  function normalizeFilterText(text) {
    return Fmt.toLatinDigits(String(text == null ? '' : text))
      .replace(/[,\u066C\u2019\u066B\s]/g, '')
      .trim()
      .toLowerCase();
  }

  /** تطبیق «شامل بودن» (invert = «شامل نشود») — فیلتر خالی → همه */
  function filterContains(tokens, value, invert) {
    var needle = normalizeFilterText(value);
    if (needle === '') return true;
    var hay = tokens.map(normalizeFilterText).filter(Boolean).join(' ');
    var contains = hay.indexOf(needle) !== -1;
    return invert ? !contains : contains;
  }

  function rowValue(row, key) {
    return row[key];
  }

  function defaultTokens(row, key) {
    var v = rowValue(row, key);
    return v === null || v === undefined ? [] : [String(v)];
  }

  /* =========================================================================
     کارخانهٔ جدول
     ========================================================================= */

  /**
   * ساخت جدول — opts:
   *   tableId, columns[{key,label,headerTitle,render,tokens,filterable,width,
   *                     align,className,sortableType}], rows, getRowKey,
   *   rowHeight(41), defaultVisibleRows(25), maxDomRows(300),
   *   paginated(false), defaultPageSize(2000),
   *   emptyText, filteredEmptyText, footerNote, sums, compact
   * خروجی: { el, setRows(rows), destroy() }
   */
  function create(opts) {
    var columns = opts.columns || [];
    var rows = opts.rows || [];
    var getRowKey = opts.getRowKey || function (r, i) { return i; };
    var rowHeight = opts.rowHeight || 41;
    var defaultVisibleRows = opts.defaultVisibleRows || 25;
    var maxDomRows = opts.maxDomRows || 300;
    var paginated = !!opts.paginated;
    var defaultPageSize = opts.defaultPageSize || 2000;
    var emptyText = opts.emptyText !== undefined ? opts.emptyText : 'داده‌ای برای نمایش وجود ندارد.';
    var filteredEmptyText = opts.filteredEmptyText !== undefined ? opts.filteredEmptyText : 'هیچ رکوردی با فیلترهای فعلی مطابقت ندارد — فیلترها را پاک کنید.';
    var footerNote = opts.footerNote !== undefined ? opts.footerNote : 'فیلتر هر ستون در زیر سرستون همان ستون · منطق: شامل بودن (عدد و متن)';
    var sums = opts.sums || null;
    var compact = !!opts.compact;

    /* ---------------- وضعیت ماندگار ---------------- */
    var lsF = 'eva-table-' + opts.tableId + '-filters';
    var lsS = 'eva-table-' + opts.tableId + '-sort';
    var lsC = 'eva-table-' + opts.tableId + '-columns';
    var lsR = 'eva-table-' + opts.tableId + '-rows';
    var lsP = 'eva-table-' + opts.tableId + '-pageSize';

    var filters = loadJSON(lsF, {});
    var sortSteps = loadJSON(lsS, []);
    if (!Array.isArray(sortSteps)) sortSteps = [];
    var colsState = loadJSON(lsC, { order: [], hidden: [], widths: {} });
    if (!colsState || !Array.isArray(colsState.order)) colsState = { order: [], hidden: [], widths: {} };
    if (!Array.isArray(colsState.hidden)) colsState.hidden = [];
    if (!colsState.widths || typeof colsState.widths !== 'object') colsState.widths = {};
    var visibleRowsRaw = loadJSON(lsR, defaultVisibleRows);
    var visibleRows = Math.min(
      Math.max(Number.isFinite(visibleRowsRaw) && visibleRowsRaw > 0 ? visibleRowsRaw : defaultVisibleRows, 5),
      200
    );

    /* صفحه‌بندی (بند ۱ — نسخهٔ ۱٫۳): صفحهٔ فعلی در حافظه؛ اندازهٔ صفحه ماندگار */
    var PAGE_SIZES = [2000, 4000, 8000];
    var page = 1;
    var pageSizeRaw = loadJSON(lsP, defaultPageSize);
    var pageSize = PAGE_SIZES.indexOf(pageSizeRaw) !== -1 ? pageSizeRaw : defaultPageSize;

    var byKey = new Map();
    columns.forEach(function (c) { byKey.set(c.key, c); });

    /* ---------------- ترکیب ترتیب ستون‌ها با تعریف فعلی (سازگار با تغییر ستون‌ها) ---------------- */
    function effectiveColumns() {
      var order = colsState.order.filter(function (k) { return byKey.has(k); });
      columns.forEach(function (c) {
        if (order.indexOf(c.key) === -1) order.push(c.key);
      });
      var hidden = colsState.hidden.filter(function (k) { return byKey.has(k); });
      var widths = {};
      Object.keys(colsState.widths).forEach(function (k) {
        if (byKey.has(k) && colsState.widths[k] > 0) widths[k] = colsState.widths[k];
      });
      return { order: order, hidden: hidden, widths: widths };
    }

    function widthOf(col, eff) {
      return eff.widths[col.key] || (col.width && col.width > 0 ? col.width : 0);
    }

    /* ---------------- نوع مرتب‌سازی هر ستون (استنتاج) ---------------- */
    var colTypes = new Map();
    function computeColTypes() {
      colTypes = new Map();
      columns.forEach(function (col) {
        if (col.sortableType) {
          colTypes.set(col.key, col.sortableType);
          return;
        }
        var inferred = 'string';
        for (var i = 0; i < rows.length; i++) {
          var v = rowValue(rows[i], col.key);
          if (v !== null && v !== undefined && v !== '') {
            inferred = typeof v === 'number' ? 'number' : 'string';
            break;
          }
        }
        colTypes.set(col.key, inferred);
      });
    }

    /* ---------------- فیلتر + مرتب‌سازی + سقف DOM ---------------- */
    function visibleColsOf(eff) {
      return eff.order
        .map(function (k) { return byKey.get(k); })
        .filter(Boolean)
        .filter(function (c) { return eff.hidden.indexOf(c.key) === -1; });
    }

    function computeFiltered(eff, visCols) {
      var filterableVisible = visCols.filter(function (c) { return c.filterable !== false; });
      var active = filterableVisible.filter(function (c) {
        return ((filters[c.key] || {}).value || '').trim() !== '';
      });
      if (active.length === 0) return { rows: rows, activeCount: 0 };
      var out = rows.filter(function (row) {
        return active.every(function (c) {
          var f = filters[c.key] || { value: '', invert: false };
          var tokens = c.tokens ? c.tokens(row) : defaultTokens(row, c.key);
          return filterContains(tokens, f.value, f.invert);
        });
      });
      return { rows: out, activeCount: active.length };
    }

    function computeSorted(filtered) {
      if (sortSteps.length === 0) return filtered;
      var steps = sortSteps
        .filter(function (s) { return s && byKey.has(s.key); })
        .map(function (s) { return { key: s.key, dir: s.dir === 'desc' ? 'desc' : 'asc', type: colTypes.get(s.key) || 'string' }; });
      if (steps.length === 0) return filtered;
      var out = filtered.slice();
      out.sort(function (a, b) {
        for (var i = 0; i < steps.length; i++) {
          var step = steps[i];
          var dir = step.dir === 'asc' ? 1 : -1;
          var av = rowValue(a, step.key);
          var bv = rowValue(b, step.key);
          var aNull = av === null || av === undefined || av === '';
          var bNull = bv === null || bv === undefined || bv === '';
          if (aNull && bNull) continue;
          if (aNull) return 1; // تهی‌ها همیشه آخر — مستقل از جهت
          if (bNull) return -1;
          var r;
          if (step.type === 'number') {
            r = (Number(av) - Number(bv)) * dir;
          } else {
            r = String(av).localeCompare(String(bv), 'fa') * dir;
          }
          if (r !== 0) return r;
        }
        return 0;
      });
      return out;
    }

    /* ---------------- جمع‌ها با دیتای فیلترشده ---------------- */
    function computeSums(sorted) {
      if (!sums) return null;
      var out = {};
      Object.keys(sums).forEach(function (key) {
        var spec = sums[key];
        if (spec.type === 'number') {
          var total = 0;
          sorted.forEach(function (row) {
            var v = rowValue(row, key);
            if (v === null || v === undefined || v === '') return;
            var n = Number(v);
            if (Number.isFinite(n)) total += n;
          });
          out[key] = { number: total };
        } else {
          var count = 0;
          var weight = 0;
          sorted.forEach(function (row) {
            var v = Number(rowValue(row, key));
            if (Number.isFinite(v)) count += v;
            var w = spec.weightOf ? Number(spec.weightOf(row)) : NaN;
            if (Number.isFinite(w)) weight += w;
          });
          out[key] = { pair: { count: count, weight: weight } };
        }
      });
      return out;
    }

    /* =========================================================================
       رندر
       ========================================================================= */
    var root = document.createElement('div');
    root.className = 'dt-wrap';

    function alignCls(a) {
      return a === 'center' ? 'c' : a === 'left' ? 'l' : '';
    }

    function renderAll() {
      var eff = effectiveColumns();
      var visCols = visibleColsOf(eff);
      /* بند ۱+۳ (نسخهٔ ۱٫۳): جدول‌های صفحه‌بندی‌شده همیشه چیدمان fixed دارند
         (auto با ۳۰هزار سلول صفحه را قفل می‌کند)؛ در حالت عرض‌دار/fixed هر ستون
         عرض صریح می‌گیرد (کاربر ?? تعریف ?? ۱۲۰px) تا هیچ ستونی جمع نشود و در
         صورت سرریز، جدول با min-width اسکرول افقی بگیرد. */
      var hasWidths = visCols.some(function (c) { return widthOf(c, eff) > 0; });
      var useFixed = hasWidths || paginated;
      var colWidths = visCols.map(function (c) { return widthOf(c, eff) || 120; });
      var totalWidth = colWidths.reduce(function (s, w) { return s + w; }, 0);

      var sortBtnBadge = sortSteps.length > 0
        ? '<span class="dt-btn-badge">' + Fmt.faInt(sortSteps.length) + '</span>'
        : '';
      var colsBtnBadge = eff.hidden.length > 0
        ? '<span class="dt-btn-badge">' + Fmt.faInt(eff.hidden.length) + '</span>'
        : '';

      var html =
        '<div class="dt-toolbar">' +
        '  <button type="button" class="btn btn-outline btn-sm dt-sort-btn" aria-label="پنل مرتب‌سازی چندسطحی">' + UI.icon('arrow-up-down', 14) + 'مرتب‌سازی' + sortBtnBadge + '</button>' +
        '  <button type="button" class="btn btn-outline btn-sm dt-cols-btn" aria-label="پنل ترتیب ستون‌ها">' + UI.icon('columns', 14) + 'ترتیب ستون‌ها' + colsBtnBadge + '</button>' +
        '  <button type="button" class="btn btn-outline btn-sm dt-clear-btn" title="پاک‌کردن همهٔ فیلترهای اعمال‌شدهٔ این جدول (متن فیلترها + منطق «شامل نشود»)" aria-label="پاک‌کردن همهٔ فیلترهای این جدول">' + UI.icon('filter-x', 14) + 'پاک‌کردن همهٔ فیلترها<span class="dt-clear-badge"></span></button>' +
        '</div>' +
        '<div class="dt-scroll nice-scroll" style="height:' + (visibleRows * rowHeight) + 'px;max-height:' + (visibleRows * rowHeight) + 'px">' +
        '  <table class="dt-table' + (compact ? ' compact' : '') + (useFixed ? ' fixed' : '') + (paginated ? ' dt-big' : '') + '"' + (useFixed ? ' style="min-width:' + totalWidth + 'px"' : '') + '>' +
        (useFixed
          ? '<colgroup>' + visCols.map(function (c, i) {
              return '<col style="width:' + colWidths[i] + 'px;min-width:' + colWidths[i] + 'px"></col>';
            }).join('') + '</colgroup>'
          : '') +
        '    <thead>' +
        '      <tr>' + visCols.map(function (col) {
          return '<th scope="col" title="' + UI.esc(col.headerTitle || '') + '" class="' + alignCls(col.align) + '">' + UI.esc(col.label) + '</th>';
        }).join('') + '</tr>' +
        '      <tr class="filter-row">' + visCols.map(function (col) {
          if (col.filterable === false) return '<th></th>';
          var f = filters[col.key] || { value: '', invert: false };
          return (
            '<th>' +
            '<div class="fcell">' +
            '<button type="button" class="dt-invert' + (f.invert ? ' on' : '') + '" data-col="' + UI.esc(col.key) + '" aria-pressed="' + (f.invert ? 'true' : 'false') + '" aria-label="برعکس‌کردن منطق فیلتر ستون ' + UI.esc(col.label) + '" title="' + (f.invert ? 'شامل نشود' : 'شامل شود') + '">≠</button>' +
            '<input type="text" class="dt-filter-input" data-col="' + UI.esc(col.key) + '" value="' + UI.esc(f.value) + '" placeholder="فیلتر…" autocomplete="off" aria-label="فیلتر ستون ' + UI.esc(col.label) + '" />' +
            '</div>' +
            '</th>'
          );
        }).join('') + '</tr>' +
        '    </thead>' +
        '    <tbody class="dt-tbody"></tbody>' +
        (sums ? '<tfoot class="dt-tfoot"></tfoot>' : '') +
        '  </table>' +
        '</div>' +
        '<div class="dt-pager"></div>' +
        '<div class="dt-footer">' +
        '  <div class="chips"><span class="dt-note">' + UI.esc(footerNote) + '</span><span class="dt-status-chips"></span></div>' +
        '  <label><span title="تعداد ردیف قابل نمایش قبل از اسکرول — ارتفاع جدول طبق این عدد تغییر می‌کند">ردیف‌های قابل نمایش:</span>' +
        '  <input type="number" min="5" max="200" step="1" inputmode="numeric" class="dt-rows-input" value="' + visibleRows + '" aria-label="تعداد ردیف قابل نمایش" title="تعداد ردیف قابل نمایش قبل از اسکرول — ارتفاع جدول طبق این عدد تغییر می‌کند" /></label>' +
        '</div>';

      root.innerHTML = html;
      renderBody();
    }

    /** رندر بدنه + جمع‌ها + چیپ‌های وضعیت + نوار صفحه‌بندی (بدون دست‌زدن به ردیف فیلتر — حفظ فوکوس) */
    function renderBody() {
      computeColTypes();
      var eff = effectiveColumns();
      var visCols = visibleColsOf(eff);
      var fr = computeFiltered(eff, visCols);
      var sorted = computeSorted(fr.rows);

      /* صفحه‌بندی (بند ۱ — نسخهٔ ۱٫۳): برش رکوردهای صفحهٔ فعلی */
      var totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
      if (page > totalPages) page = totalPages;
      if (page < 1) page = 1;
      var pageStart = (page - 1) * pageSize;

      var domCapped = !paginated && sorted.length > maxDomRows;
      var domRows = paginated
        ? sorted.slice(pageStart, pageStart + pageSize)
        : domCapped
          ? sorted.slice(0, maxDomRows)
          : sorted;

      /* بدنه */
      var tbody = root.querySelector('.dt-tbody');
      if (domRows.length === 0) {
        tbody.innerHTML =
          '<tr class="empty-row"><td colspan="' + (visCols.length || 1) + '">' +
          UI.esc(rows.length === 0 ? emptyText : filteredEmptyText) +
          '</td></tr>';
      } else {
        var pad = compact ? '4px 7px' : '6px 8px';
        tbody.innerHTML = domRows.map(function (row, i) {
          var tds = visCols.map(function (col) {
            var raw = rowValue(row, col.key);
            var content = col.render
              ? col.render(row)
              : raw === null || raw === undefined
                ? '<span class="txt-muted">—</span>'
                : UI.esc(String(raw));
            /* بند ۱ (نسخهٔ ۱٫۴): تولتیپ مقدار کامل — وقتی متن با «…» بریده می‌شود،
               کاربر با نگه‌داشتن ماوس مقدار کامل را می‌بیند */
            var tip =
              typeof raw === 'number' || (typeof raw === 'string' && raw !== '')
                ? ' title="' + UI.esc(String(raw)) + '"'
                : '';
            return '<td' + tip + ' class="' + alignCls(col.align) + (col.className ? ' ' + col.className : '') + '" style="padding:' + pad + '">' + content + '</td>';
          }).join('');
          return '<tr data-ri="' + i + '">' + tds + '</tr>';
        }).join('');
      }

      /* جمع‌ها */
      var tfoot = root.querySelector('.dt-tfoot');
      if (sums && tfoot && visCols.length > 0) {
        var sumsComputed = computeSums(sorted);
        tfoot.innerHTML = '<tr>' + visCols.map(function (col) {
          var spec = sums[col.key];
          if (!spec) return '<td style="padding:7px 8px"></td>';
          var computed = sumsComputed[col.key];
          var inner;
          if (spec.type === 'number') {
            inner = '<span class="font-bold">' + (spec.format ? spec.format(computed.number) : Fmt.faInt(computed.number)) + '</span>';
          } else {
            inner = '<span class="cw-cell"><span class="cw-count">' + Fmt.faInt(computed.pair.count) + '</span>' +
              '<span class="cw-weight">' + Fmt.faWeightShort(computed.pair.weight) + '</span></span>';
          }
          return '<td title="جمع ستون «' + UI.esc(col.label) + '» با دیتای فیلترشده" class="' + alignCls(col.align) + '" style="padding:7px 8px">' + inner + '</td>';
        }).join('') + '</tr>';
      }

      /* چیپ‌های وضعیت */
      var chipsEl = root.querySelector('.dt-status-chips');
      var chips = '';
      if (fr.activeCount > 0) {
        chips += '<span class="dt-chip filtered">' + Fmt.faInt(sorted.length) + ' از ' + Fmt.faInt(rows.length) + ' رکورد (فیلترشده)</span>';
      } else {
        chips += '<span class="dt-chip">' + Fmt.faInt(rows.length) + ' رکورد</span>';
      }
      if (domCapped) {
        chips += '<span class="dt-chip" title="برای پاسخ‌گویی فقط ' + Fmt.faInt(domRows.length) + ' ردیف اولِ فیلترشده رندر شده — با فیلتر دقیق‌تر رکوردهای دلخواه را ببینید">نمایش ' + Fmt.faInt(domRows.length) + ' ردیف</span>';
      }
      chipsEl.innerHTML = chips;

      /* نوار صفحه‌بندی (بند ۱ — نسخهٔ ۱٫۳) */
      renderPager(sorted.length, totalPages, pageStart, fr.activeCount > 0);

      /* دکمهٔ پاک‌کردن فیلترها */
      var clearBtn = root.querySelector('.dt-clear-btn');
      clearBtn.disabled = fr.activeCount === 0;
      clearBtn.querySelector('.dt-clear-badge').innerHTML = fr.activeCount > 0
        ? '<span class="dt-btn-badge">' + Fmt.faInt(fr.activeCount) + '</span>'
        : '';

      /* بج دکمهٔ مرتب‌سازی */
      var sortBtn = root.querySelector('.dt-sort-btn');
      var sb = sortBtn.querySelector('.dt-btn-badge');
      if (sortSteps.length > 0) {
        if (!sb) sortBtn.insertAdjacentHTML('beforeend', '<span class="dt-btn-badge">' + Fmt.faInt(sortSteps.length) + '</span>');
        else sb.textContent = Fmt.faInt(sortSteps.length);
      } else if (sb) sb.remove();
    }

    /** نوار صفحه‌بندی — دکمه‌ها/محدوده/اندازهٔ صفحه (بند ۱ نسخهٔ ۱٫۳) */
    function renderPager(total, totalPages, pageStart, isFiltered) {
      var pagerEl = root.querySelector('.dt-pager');
      if (!paginated || total === 0) {
        pagerEl.innerHTML = '';
        return;
      }
      var pageEnd = Math.min(pageStart + pageSize, total);
      /* بند ۲ (نسخهٔ ۱٫۴): چیدمان استاندارد دکمه‌های صفحه‌بندی — «صفحهٔ اول» در
         منتهی‌الیه چپ با علامت « و «صفحهٔ آخر» در منتهی‌الیه راست با علامت »
         (قبلاً جفت دکمه‌های راست/چپ جای هم بودند و علامت‌ها برعکس دیده می‌شدند). */
      pagerEl.innerHTML =
        '<div class="dt-pager-btns" dir="ltr">' +
        '<button type="button" class="dt-pg-btn" data-pg="first" aria-label="صفحهٔ اول" title="صفحهٔ اول"' + (page === 1 ? ' disabled' : '') + '>«</button>' +
        '<button type="button" class="dt-pg-btn" data-pg="prev" aria-label="صفحهٔ قبلی" title="صفحهٔ قبلی"' + (page === 1 ? ' disabled' : '') + '>‹</button>' +
        '<span class="dt-pg-info" aria-live="polite" dir="rtl">صفحهٔ ' + Fmt.faInt(page) + ' از ' + Fmt.faInt(totalPages) + '</span>' +
        '<button type="button" class="dt-pg-btn" data-pg="next" aria-label="صفحهٔ بعدی" title="صفحهٔ بعدی"' + (page === totalPages ? ' disabled' : '') + '>›</button>' +
        '<button type="button" class="dt-pg-btn" data-pg="last" aria-label="صفحهٔ آخر" title="صفحهٔ آخر"' + (page === totalPages ? ' disabled' : '') + '>»</button>' +
        '</div>' +
        '<span class="dt-pager-range">نمایش ' + Fmt.faInt(pageStart + 1) + ' تا ' + Fmt.faInt(pageEnd) + ' از ' + Fmt.faInt(total) + ' رکورد' + (isFiltered ? ' (فیلترشده)' : '') + '</span>' +
        '<label><span title="تعداد رکورد در هر صفحه — حداقل ۲۰۰۰ رکورد">ردیف در هر صفحه:</span>' +
        '<select class="dt-page-size" aria-label="ردیف در هر صفحه">' +
        PAGE_SIZES.map(function (n) {
          return '<option value="' + n + '"' + (n === pageSize ? ' selected' : '') + '>' + Fmt.faInt(n) + '</option>';
        }).join('') +
        '</select></label>';
    }

    /* =========================================================================
       رویدادها
       ========================================================================= */

    /* تغییر اندازهٔ صفحه (بند ۱ — نسخهٔ ۱٫۳) */
    root.addEventListener('change', function (e) {
      var t = e.target;
      if (t.classList && t.classList.contains('dt-page-size')) {
        var n = parseInt(t.value, 10);
        if (Number.isFinite(n)) {
          pageSize = n;
          page = 1;
          saveJSON(lsP, pageSize);
          renderAll();
        }
      }
    });

    root.addEventListener('input', function (e) {
      var t = e.target;
      if (t.classList.contains('dt-filter-input')) {
        var key = t.getAttribute('data-col');
        var f = filters[key] || { value: '', invert: false };
        f.value = t.value;
        filters[key] = f;
        saveJSON(lsF, filters);
        renderBody();
      } else if (t.classList.contains('dt-rows-input')) {
        var n = parseInt(t.value, 10);
        if (Number.isFinite(n)) {
          visibleRows = Math.min(Math.max(n, 5), 200);
          saveJSON(lsR, visibleRows);
          var scroller = root.querySelector('.dt-scroll');
          scroller.style.height = (visibleRows * rowHeight) + 'px';
          scroller.style.maxHeight = (visibleRows * rowHeight) + 'px';
          renderBody();
        }
      }
    });

    root.addEventListener('click', function (e) {
      /* دکمه‌های صفحه‌بندی (بند ۱ — نسخهٔ ۱٫۳) */
      var pgBtn = e.target.closest ? e.target.closest('.dt-pg-btn') : null;
      if (pgBtn) {
        var act = pgBtn.getAttribute('data-pg');
        var eff0 = effectiveColumns();
        var vis0 = visibleColsOf(eff0);
        var total0 = computeSorted(computeFiltered(eff0, vis0).rows).length;
        var tp = Math.max(1, Math.ceil(total0 / pageSize));
        if (act === 'first') page = 1;
        else if (act === 'prev') page = Math.max(1, page - 1);
        else if (act === 'next') page = Math.min(tp, page + 1);
        else if (act === 'last') page = tp;
        renderBody();
        return;
      }

      var invertBtn = e.target.closest ? e.target.closest('.dt-invert') : null;
      if (invertBtn) {
        var key = invertBtn.getAttribute('data-col');
        var f = filters[key] || { value: '', invert: false };
        f.invert = !f.invert;
        filters[key] = f;
        saveJSON(lsF, filters);
        // فقط دکمه و بدنه به‌روز می‌شوند — فیلتر ورودی دست‌نخورده می‌ماند
        invertBtn.classList.toggle('on', f.invert);
        invertBtn.setAttribute('aria-pressed', f.invert ? 'true' : 'false');
        invertBtn.title = f.invert ? 'شامل نشود' : 'شامل شود';
        renderBody();
        return;
      }

      if (e.target.closest('.dt-clear-btn')) {
        var clearBtn = root.querySelector('.dt-clear-btn');
        if (clearBtn.disabled) return;
        Object.keys(filters).forEach(function (k) {
          filters[k] = { value: '', invert: false };
        });
        saveJSON(lsF, filters);
        UI.toast.info('همهٔ فیلترهای این جدول پاک شد.');
        renderAll();
        return;
      }

      if (e.target.closest('.dt-sort-btn')) {
        openSortPanel(e.target.closest('.dt-sort-btn'));
        return;
      }

      if (e.target.closest('.dt-cols-btn')) {
        openColsPanel(e.target.closest('.dt-cols-btn'));
      }
    });

    /* =========================================================================
       پنل مرتب‌سازی چندسطحی
       ========================================================================= */

    function openSortPanel(anchor) {
      var content = document.createElement('div');
      buildSortPanel(content);
      UI.popover(anchor, content, { onClose: null });

      function buildSortPanel(box) {
        var eff = effectiveColumns();
        var ordered = eff.order.map(function (k) { return byKey.get(k); }).filter(Boolean);
        var available = ordered.filter(function (c) {
          return !sortSteps.some(function (s) { return s.key === c.key; });
        });

        var listHtml = sortSteps.length === 0
          ? '<p class="panel-empty">مرتب‌سازی پیش‌فرض</p>'
          : sortSteps.map(function (step, i) {
              var col = byKey.get(step.key);
              return (
                '<div class="panel-chip" data-sort-key="' + UI.esc(step.key) + '">' +
                '<span class="prio">' + Fmt.faInt(i + 1) + '</span>' +
                '<span class="name" title="' + UI.esc(col ? col.label : step.key) + '">' + UI.esc(col ? col.label : step.key) + '</span>' +
                '<button type="button" class="icon-btn ' + (step.dir === 'asc' ? 'dir-on' : '') + ' dt-dir" title="تغییر جهت" aria-label="تغییر جهت مرتب‌سازی">' + (step.dir === 'asc' ? '↑' : '↓') + '</button>' +
                '<button type="button" class="icon-btn ghost dt-move-up" title="یک سطح بالاتر" aria-label="افزایش اولویت">' + UI.icon('arrow-up', 13) + '</button>' +
                '<button type="button" class="icon-btn ghost dt-move-down" title="یک سطح پایین‌تر" aria-label="کاهش اولویت">' + UI.icon('arrow-down', 13) + '</button>' +
                '<button type="button" class="icon-btn danger dt-remove" title="حذف" aria-label="حذف از مرتب‌سازی">' + UI.icon('x', 13) + '</button>' +
                '</div>'
              );
            }).join('');

        box.innerHTML =
          '<p class="popover-title">سطح‌های مرتب‌سازی <span>(اولویت از بالا به پایین)</span></p>' +
          '<div class="panel-list nice-scroll">' + listHtml + '</div>' +
          (available.length > 0
            ? '<select class="panel-select" aria-label="افزودن سطح مرتب‌سازی"><option value="">افزودن سطح مرتب‌سازی…</option>' +
              available.map(function (c) { return '<option value="' + UI.esc(c.key) + '">' + UI.esc(c.label) + '</option>'; }).join('') +
              '</select>'
            : '<p class="panel-note">همهٔ ستون‌ها در مرتب‌سازی هستند.</p>');

        /* رویدادهای پنل */
        box.querySelectorAll('[data-sort-key]').forEach(function (chip) {
          var key = chip.getAttribute('data-sort-key');
          chip.querySelector('.dt-dir').addEventListener('click', function () {
            sortSteps.forEach(function (s) {
              if (s.key === key) s.dir = s.dir === 'asc' ? 'desc' : 'asc';
            });
            saveJSON(lsS, sortSteps);
            refresh();
          });
          chip.querySelector('.dt-move-up').addEventListener('click', function () {
            var idx = sortSteps.findIndex(function (s) { return s.key === key; });
            if (idx > 0) {
              var tmp = sortSteps[idx - 1];
              sortSteps[idx - 1] = sortSteps[idx];
              sortSteps[idx] = tmp;
              saveJSON(lsS, sortSteps);
              refresh();
            }
          });
          chip.querySelector('.dt-move-down').addEventListener('click', function () {
            var idx = sortSteps.findIndex(function (s) { return s.key === key; });
            if (idx >= 0 && idx < sortSteps.length - 1) {
              var tmp = sortSteps[idx + 1];
              sortSteps[idx + 1] = sortSteps[idx];
              sortSteps[idx] = tmp;
              saveJSON(lsS, sortSteps);
              refresh();
            }
          });
          chip.querySelector('.dt-remove').addEventListener('click', function () {
            sortSteps = sortSteps.filter(function (s) { return s.key !== key; });
            saveJSON(lsS, sortSteps);
            refresh();
          });
        });

        var sel = box.querySelector('.panel-select');
        if (sel) {
          sel.addEventListener('change', function () {
            if (sel.value === '') return;
            if (!sortSteps.some(function (s) { return s.key === sel.value; })) {
              sortSteps.push({ key: sel.value, dir: 'asc' });
              saveJSON(lsS, sortSteps);
              refresh();
            }
          });
        }

        function refresh() {
          renderAll();
          buildSortPanel(box);
        }
      }
    }

    /* =========================================================================
       پنل ترتیب/نمایش/عرض ستون‌ها
       ========================================================================= */

    function openColsPanel(anchor) {
      var content = document.createElement('div');
      buildColsPanel(content);
      UI.popover(anchor, content);

      function buildColsPanel(box) {
        var eff = effectiveColumns();
        var order = eff.order;

        var listHtml = order.map(function (key, i) {
          var col = byKey.get(key);
          if (!col) return '';
          var hidden = eff.hidden.indexOf(key) !== -1;
          var w = widthOf(col, eff);
          return (
            '<div class="panel-chip' + (hidden ? ' dimmed' : '') + '" data-col-key="' + UI.esc(key) + '">' +
            '<span class="prio">' + Fmt.faInt(i + 1) + '</span>' +
            '<span class="name" title="' + UI.esc(col.label) + '">' + UI.esc(col.label) + '</span>' +
            '<button type="button" class="icon-btn ghost ' + (hidden ? '' : 'eyes-on') + ' dt-eye" aria-pressed="' + (!hidden) + '" aria-label="نمایش/مخفی‌کردن ستون ' + UI.esc(col.label) + '" title="' + (hidden ? 'این ستون در جدول مخفی است — برای نمایش دوباره کلیک کنید' : 'مخفی‌کردن این ستون در جدول (از پنل دوباره نمایش داده می‌شود)') + '">' + UI.icon(hidden ? 'eye-off' : 'eye', 13) + '</button>' +
            '<input type="number" min="0" max="1200" step="1" inputmode="numeric" class="width-input dt-width" value="' + (w > 0 ? w : '') + '" placeholder="خودکار" aria-label="عرض ستون ' + UI.esc(col.label) + '" title="عرض این ستون در جدول (پیکسل) — صفر یا خالی = خودکار" />' +
            '<span style="font-size:10px;color:var(--muted-foreground);flex-shrink:0">px</span>' +
            '<button type="button" class="icon-btn ghost dt-col-up" title="یک ردیف بالاتر" aria-label="جابه‌جایی به بالا"' + (i === 0 ? ' disabled' : '') + '>' + UI.icon('arrow-up', 13) + '</button>' +
            '<button type="button" class="icon-btn ghost dt-col-down" title="یک ردیف پایین‌تر" aria-label="جابه‌جایی به پایین"' + (i === order.length - 1 ? ' disabled' : '') + '>' + UI.icon('arrow-down', 13) + '</button>' +
            '</div>'
          );
        }).join('');

        box.innerHTML =
          '<p class="popover-title">ترتیب، نمایش و عرض ستون‌ها <span>(برای جابه‌جایی از فلش‌ها استفاده کنید)</span></p>' +
          '<div class="panel-list nice-scroll">' + listHtml + '</div>';

        box.querySelectorAll('[data-col-key]').forEach(function (chip) {
          var key = chip.getAttribute('data-col-key');

          chip.querySelector('.dt-eye').addEventListener('click', function () {
            var hidden = colsState.hidden.indexOf(key) !== -1;
            if (!hidden && order.filter(function (k) { return colsState.hidden.indexOf(k) === -1; }).length <= 1) {
              UI.toast.info('حداقل یک ستون باید نمایان بماند.');
              return;
            }
            if (hidden) colsState.hidden = colsState.hidden.filter(function (k) { return k !== key; });
            else colsState.hidden.push(key);
            saveJSON(lsC, colsState);
            refresh();
          });

          var widthTimer = null;
          chip.querySelector('.dt-width').addEventListener('input', function (e) {
            var val = e.target.value;
            if (widthTimer) clearTimeout(widthTimer);
            widthTimer = setTimeout(function () {
              var n = parseInt(val, 10);
              var px = Number.isFinite(n) ? Math.min(Math.max(n, 0), 1200) : 0;
              if (px > 0) colsState.widths[key] = px;
              else delete colsState.widths[key];
              saveJSON(lsC, colsState);
              renderAll(); // فقط جدول به‌روز می‌شود — پنل و فوکوس ورودی حفظ می‌شود
            }, 350);
          });

          chip.querySelector('.dt-col-up').addEventListener('click', function () {
            var idx = order.indexOf(key);
            if (idx > 0) {
              var tmp = order[idx - 1];
              order[idx - 1] = order[idx];
              order[idx] = tmp;
              colsState.order = order;
              saveJSON(lsC, colsState);
              refresh();
            }
          });

          chip.querySelector('.dt-col-down').addEventListener('click', function () {
            var idx = order.indexOf(key);
            if (idx >= 0 && idx < order.length - 1) {
              var tmp = order[idx + 1];
              order[idx + 1] = order[idx];
              order[idx] = tmp;
              colsState.order = order;
              saveJSON(lsC, colsState);
              refresh();
            }
          });
        });

        function refresh() {
          renderAll();
          buildColsPanel(box);
        }
      }
    }

    /* =========================================================================
     API عمومی
     ========================================================================= */

    var api = {
      el: root,
      setRows: function (newRows) {
        rows = newRows || [];
        renderAll();
      },
      destroy: function () {
        root.remove();
      },
    };

    renderAll();
    return api;
  }

  window.DataTableUI = { create: create };
})();
