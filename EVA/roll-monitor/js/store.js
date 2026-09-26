/* =========================================================================
   store.js — لایهٔ دادهٔ آفلاین (IndexedDB + localStorage)
   -------------------------------------------------------------------------
   · IndexedDB «eva-roll-monitor»: فروشگاه‌های rolls و batches (دادهٔ حجیم)
   · localStorage: رشتهٔ JSON تنظیمات با کلید evaSettings (همان مقدار
     ستون value رکورد Setting در نسخهٔ وب — سازگار با فایل پشتیبان)
   · اولین بارگذاری: درج دادهٔ اولیهٔ window.EVA_SEED (چانک‌های ۵۰۰تایی)
   · Import اکسل = جایگزینی کامل (پورت api/import)
   · ساخت/اعتبارسنجی/بازیابی پشتیبان (پورت api/backup — سازگار رفت‌وبرگشت)
   ========================================================================= */
(function () {
  'use strict';

  var DB_NAME = 'eva-roll-monitor';
  var DB_VERSION = 1;
  var CHUNK_SIZE = 500;
  var MAX_FILE_SIZE = 50 * 1024 * 1024; // ۵۰ مگابایت

  var db = null;

  /* =========================================================================
     پوشش وعده‌محور IndexedDB
     ========================================================================= */

  function openDB() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var d = req.result;
        if (!d.objectStoreNames.contains('rolls')) d.createObjectStore('rolls', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('batches')) d.createObjectStore('batches', { keyPath: 'id' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  /** تبدیل یک IDBRequest به Promise */
  function idb(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  /** اجرای یک تابع داخل تراکنش — resolve پس از complete */
  function runTx(stores, mode, fn) {
    return new Promise(function (resolve, reject) {
      var t = db.transaction(stores, mode);
      var objs = (Array.isArray(stores) ? stores : [stores]).map(function (s) { return t.objectStore(s); });
      var result;
      try {
        result = fn.apply(null, objs);
      } catch (e) {
        reject(e);
        return;
      }
      t.oncomplete = function () { resolve(result); };
      t.onerror = function () { reject(t.error); };
      t.onabort = function () { reject(t.error || new Error('تراکنش لغو شد')); };
    });
  }

  /** درج چانکی آرایهٔ بزرگ در یک فروشگاه (چانک‌های ۵۰۰تایی) */
  function bulkAddChunked(storeName, rows) {
    var promise = Promise.resolve();
    var _loop = function (i) {
      var chunk = rows.slice(i, i + CHUNK_SIZE);
      promise = promise.then(function () {
        return runTx(storeName, 'readwrite', function (s) {
          chunk.forEach(function (r) { s.put(r); });
        });
      });
    };
    for (var i = 0; i < rows.length; i += CHUNK_SIZE) _loop(i);
    return promise;
  }

  /* =========================================================================
     آماده‌سازی و دادهٔ اولیه
     ========================================================================= */

  var readyPromise = null;

  /** باز کردن پایگاه داده + درج دادهٔ اولیه در نخستین بارگذاری */
  function ready() {
    if (readyPromise) return readyPromise;
    readyPromise = openDB()
      .then(function (d) { db = d; })
      .then(function () { return seedIfNeeded(); })
      .catch(function (e) {
        console.error('[store] خطای بازکردن IndexedDB:', e);
        throw e;
      });
    return readyPromise;
  }

  /** اگر فروشگاه رول‌ها خالی بود → درج EVA_SEED (چانک‌های ۵۰۰تایی) */
  function seedIfNeeded() {
    return runTx(['rolls'], 'readonly', function (s) {
      return idb(s.count());
    }).then(function (count) {
      if (count > 0) return false;
      var seed = window.EVA_SEED;
      if (!seed || !seed.data || !Array.isArray(seed.data.rolls)) return false;

      var data = seed.data;
      // تنظیمات اولیه — فقط وقتی هنوز چیزی ذخیره نشده است
      if (localStorage.getItem(EVA.SETTINGS_KEY) === null && Array.isArray(data.settings)) {
        var main = data.settings.find(function (s) { return s.key === EVA.SETTINGS_KEY; });
        if (main) localStorage.setItem(EVA.SETTINGS_KEY, main.value);
      }

      var batches = (Array.isArray(data.importBatches) ? data.importBatches : []).map(function (b) {
        return {
          id: typeof b.id === 'number' ? b.id : 1,
          fileName: String(b.fileName || ''),
          sheetName: b.sheetName == null ? null : b.sheetName,
          importedAt: typeof b.importedAt === 'string' ? b.importedAt : new Date().toISOString(),
          totalRows: Number(b.totalRows) || 0,
          headers: typeof b.headers === 'string' ? b.headers : JSON.stringify(b.headers || []),
          counts: typeof b.counts === 'string' ? b.counts : JSON.stringify(b.counts || {}),
        };
      });

      var rolls = data.rolls.map(function (r) { return normalizeStoredRoll(r); });

      return bulkAddChunked('batches', batches).then(function () {
        return bulkAddChunked('rolls', rolls);
      }).then(function () { return true; });
    });
  }

  /** هم‌نوع‌سازی رکورد رول برای ذخیرهٔ خام (بدون دسته‌بندی — دسته‌بندی زنده است)
   *  فیلدهای typeOverride و manualEdit (بند ۴ نسخهٔ ۱٫۲) هم ذخیره می‌شوند */
  function normalizeStoredRoll(r) {
    return {
      id: typeof r.id === 'number' ? r.id : 0,
      rollNumber: String(r.rollNumber == null ? '' : r.rollNumber),
      filmType: String(r.filmType == null ? '' : r.filmType),
      width: r.width == null ? null : r.width,
      initialWidth: r.initialWidth == null ? null : r.initialWidth,
      length: r.length == null ? null : r.length,
      thickness: r.thickness == null ? null : r.thickness,
      netWeight: r.netWeight == null ? null : r.netWeight,
      grade: r.grade == null ? null : r.grade,
      palletNumber: r.palletNumber == null ? null : r.palletNumber,
      setupNumber: r.setupNumber == null ? null : r.setupNumber,
      productionDate: r.productionDate == null ? null : r.productionDate,
      position: r.position == null ? null : r.position,
      externalId: r.externalId == null ? null : r.externalId,
      typeOverride:
        r.typeOverride === 'raw' || r.typeOverride === 'eva' || r.typeOverride === 'cut'
          ? r.typeOverride
          : null,
      manualEdit:
        typeof r.manualEdit === 'string'
          ? r.manualEdit
          : r.manualEdit && typeof r.manualEdit === 'object'
            ? JSON.stringify(r.manualEdit)
            : null,
      rawJson: typeof r.rawJson === 'string' ? r.rawJson : (r.rawJson && typeof r.rawJson === 'object' ? JSON.stringify(r.rawJson) : undefined),
      batchId: typeof r.batchId === 'number' ? r.batchId : null,
      rowIndex: typeof r.rowIndex === 'number' ? r.rowIndex : 0,
    };
  }

  /* =========================================================================
     تنظیمات (localStorage — همان رشتهٔ JSON رکورد Setting نسخهٔ وب)
     ========================================================================= */

  function getSettingsJSON() {
    return localStorage.getItem(EVA.SETTINGS_KEY);
  }

  function getSettings() {
    return EVA.parseSettingsValue(getSettingsJSON());
  }

  function saveSettings(params) {
    localStorage.setItem(EVA.SETTINGS_KEY, JSON.stringify(params));
  }

  /* =========================================================================
     خواندن داده‌ها
     ========================================================================= */

  function getAllRolls() {
    return runTx(['rolls'], 'readonly', function (s) {
      return idb(s.getAll());
    });
  }

  function getAllBatches() {
    return runTx(['batches'], 'readonly', function (s) {
      return idb(s.getAll());
    });
  }

  /** آخرین رکورد ImportBatch (مرتب‌سازی نزولی id) — یا null */
  function getLastBatch() {
    return getAllBatches().then(function (list) {
      if (!list.length) return null;
      var sorted = list.slice().sort(function (a, b) { return b.id - a.id; });
      return sorted[0];
    });
  }

  /** خواندن یک رول با شناسه — یا null */
  function getRollById(id) {
    return runTx(['rolls'], 'readonly', function (s) {
      return idb(s.get(id));
    });
  }

  /* =========================================================================
     ویرایش دستی یک رول (بند ۴ نسخهٔ ۱٫۲ — پورت PATCH /api/rolls/[id])
     -------------------------------------------------------------------------
     اعتبارسنجی فارسی (شماره رول/نوع فیلم غیرخالی، اعداد ≥ ۰، ستاپ صحیح ≥ ۰،
     typeOverride فقط raw|eva|cut|null) + آپدیت رکورد IndexedDB + ادغام فیلدهای
     ویرایش‌شده در manualEdit (JSON) برای ماندگاری در بازسازی نگاشت.
     خروجی: Promise<رکورد آپدیت‌شده> — نما با EVA.toRollDto دی‌تی‌او می‌سازد.
     ========================================================================= */

  function updateRoll(id, input) {
    return Promise.resolve().then(function () {
      // ۱) شناسهٔ رول
      if (!Number.isInteger(id) || id <= 0) {
        throw new Error('شناسهٔ رول نامعتبر است.');
      }
      if (typeof input !== 'object' || input === null) {
        throw new Error('بدنهٔ درخواست معتبر نیست.');
      }

      // ۲) اعتبارسنجی فیلدها — خطاها به فارسی (عین route.ts)
      var NUM_FIELDS = ['width', 'initialWidth', 'thickness', 'length', 'netWeight'];
      var OPT_STR_FIELDS = ['grade', 'palletNumber', 'productionDate', 'position', 'externalId'];
      var TYPE_OVERRIDES = ['raw', 'eva', 'cut'];
      var errors = [];
      var data = {};

      if (input.rollNumber !== undefined) {
        var rn = String(input.rollNumber).trim();
        if (rn === '') errors.push('شمارهٔ رول نمی‌تواند خالی باشد.');
        else data.rollNumber = rn;
      }
      if (input.filmType !== undefined) {
        var ft = String(input.filmType).trim().toUpperCase();
        if (ft === '') errors.push('نوع فیلم نمی‌تواند خالی باشد.');
        else data.filmType = ft;
      }
      NUM_FIELDS.forEach(function (f) {
        var v = input[f];
        if (v === undefined) return;
        if (v === null) data[f] = null;
        else if (typeof v === 'number' && Number.isFinite(v)) {
          if (v < 0) errors.push('مقادیر عددی نمی‌توانند منفی باشند.');
          else data[f] = v;
        } else if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
          var n = Number(v);
          if (n < 0) errors.push('مقادیر عددی نمی‌توانند منفی باشند.');
          else data[f] = n;
        } else {
          errors.push('مقدار عددی فیلد معتبر نیست.');
        }
      });
      if (input.setupNumber !== undefined) {
        var sv = input.setupNumber;
        if (sv === null) data.setupNumber = null;
        else if (typeof sv === 'number' && Number.isInteger(sv) && sv >= 0) data.setupNumber = sv;
        else if (typeof sv === 'string' && sv.trim() !== '' && Number.isInteger(Number(sv)) && Number(sv) >= 0)
          data.setupNumber = Number(sv);
        else errors.push('شمارهٔ ستاپ باید عدد صحیح مثبت باشد.');
      }
      OPT_STR_FIELDS.forEach(function (f) {
        var v = input[f];
        if (v === undefined) return;
        data[f] = v === null || String(v).trim() === '' ? null : String(v).trim();
      });
      if (input.typeOverride !== undefined) {
        var tv = input.typeOverride;
        if (tv === null || (typeof tv === 'string' && tv.trim() === '')) data.typeOverride = null;
        else if (typeof tv === 'string' && TYPE_OVERRIDES.indexOf(tv) !== -1) data.typeOverride = tv;
        else errors.push('وضعیت دستی رول معتبر نیست (مقادیر مجاز: خام، EVA، برش‌خورده).');
      }

      if (errors.length > 0) throw new Error(errors.join(' '));
      if (Object.keys(data).length === 0) {
        throw new Error('هیچ فیلدی برای ویرایش ارسال نشده است.');
      }

      // ۳) رول موجود است؟
      return getRollById(id).then(function (existing) {
        if (!existing) throw new Error('رول موردنظر یافت نشد.');

        // ۴) ادغام ویرایش دستی در manualEdit — ماندگاری در بازسازی نگاشت (rebuild).
        //    بند ۴ (نسخهٔ ۱٫۳): فقط فیلدهایی که با مقدار اولیهٔ فایل اکسل فرق دارند
        //    در manualEdit می‌مانند تا «فیلدهای ویرایش‌شده» معنای دقیقی داشته باشد.
        var manual = EVA.parseManualEdit(existing.manualEdit);
        var manualKeys = {};
        EVA.MANUAL_NUM_FIELDS.concat(EVA.MANUAL_STR_FIELDS).forEach(function (k) { manualKeys[k] = true; });

        return originalValuesOf(existing).then(function (original) {
          Object.keys(data).forEach(function (key) {
            if (!manualKeys[key]) return;
            var equalsOriginal = original && key in original && (original[key] == null ? null : original[key]) === (data[key] == null ? null : data[key]);
            if (equalsOriginal) delete manual[key];
            else manual[key] = data[key];
          });
          data.manualEdit = JSON.stringify(manual);

          // ۵) آپدیت رکورد + خروجی رکورد آپدیت‌شده
          var updated = Object.assign({}, existing, data);
          return runTx(['rolls'], 'readwrite', function (s) {
            s.put(updated);
          }).then(function () {
            return updated;
          });
        });
      });
    });
  }

  /** مقادیر اولیهٔ یک رول — برای حذف ویرایش‌ها و diff حداقلی (بند ۴ — نسخهٔ ۱٫۳).
   *  منبع اول: rawJson (سطر خام اکسل) با نگاشت فعلی؛ منبع دوم (fallback):
   *  رکورد هم‌id در window.EVA_SEED — دادهٔ اولیهٔ بستهٔ آفلاین (رول‌های بذر
   *  rawJson ندارند). خروجی null وقتی هیچ منبعی در دسترس نیست. */
  function originalValuesOf(roll) {
    return getLastBatch().then(function (last) {
      try {
        if (roll.rawJson && typeof roll.rawJson === 'string') {
          var parsed = JSON.parse(roll.rawJson);
          /* بند ۴ (نسخهٔ ۱٫۳): «{}» یا شیء بدون کلید = بی‌داده → مسیر بذر */
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length > 0) {
            var settings = getSettings();
            var headers = [];
            try { headers = last && typeof last.headers === 'string' ? JSON.parse(last.headers) : (Array.isArray(last && last.headers) ? last.headers : []); } catch (e) { headers = []; }
            var mapResult = EVA.buildFieldMapping(headers, settings.columnMapping);
            var rec = EVA.normalizeRow(parsed, mapResult.map, roll.rowIndex);
            delete rec.rawJson;
            delete rec.rowIndex;
            return rec;
          }
        }
      } catch (e) { /* ادامه به fallback بذر */ }
      try {
        var seed = window.EVA_SEED;
        if (seed && seed.data && Array.isArray(seed.data.rolls)) {
          /*توجه: بعد از بازیابی پشتیبان، شناسه‌ها ترتیبی بازتخصیص می‌شوند —
             تطبیق بر اساس id ناامن است. شمارهٔ رول در پشتیبان پایدار است؛
             اگر شمارهٔ رول خودش ویرایش شده باشد → بدون تطبیق (تخریب تدریجی). */
          var orig = null;
          for (var i = 0; i < seed.data.rolls.length; i++) {
            if (seed.data.rolls[i] && seed.data.rolls[i].rollNumber === roll.rollNumber) {
              orig = seed.data.rolls[i];
              break;
            }
          }
          if (orig) {
            var out = {};
            ['rollNumber', 'filmType', 'width', 'initialWidth', 'length', 'thickness',
             'netWeight', 'grade', 'palletNumber', 'setupNumber', 'productionDate',
             'position', 'externalId'].forEach(function (f) {
              out[f] = orig[f] === undefined ? null : orig[f];
            });
            return out;
          }
        }
      } catch (e2) { /* بدون دادهٔ خام */ }
      return null;
    });
  }

  /* =========================================================================
     حذف ویرایش‌های دستی یک رول (بند ۴ نسخهٔ ۱٫۳ — پورت POST /api/rolls/[id]/revert)
     -------------------------------------------------------------------------
     بازگردانی کامل رول به حالت اولیهٔ فایل اکسل: همهٔ فیلدها از rawJson با
     نگاشت فعلی دوباره نرمال‌سازی می‌شوند + پاک‌شدن typeOverride و manualEdit.
     اگر rawJson در دسترس نبود، فقط نشانگرهای دستی پاک می‌شوند.
     خروجی: Promise<{ record, fullyReverted }>
     ========================================================================= */

  var REVERT_FIELDS = [
    'rollNumber', 'filmType', 'width', 'initialWidth', 'length', 'thickness',
    'netWeight', 'grade', 'palletNumber', 'setupNumber', 'productionDate',
    'position', 'externalId',
  ];

  function revertRoll(id) {
    return Promise.resolve().then(function () {
      if (!Number.isInteger(id) || id <= 0) throw new Error('شناسهٔ رول نامعتبر است.');
      return getRollById(id);
    }).then(function (existing) {
      if (!existing) throw new Error('رول موردنظر یافت نشد.');
      var data = { typeOverride: null, manualEdit: null };
      return originalValuesOf(existing).then(function (original) {
        var fullyReverted = false;
        if (original) {
          REVERT_FIELDS.forEach(function (f) { data[f] = original[f]; });
          fullyReverted = true;
        }
        var updated = Object.assign({}, existing, data);
        return runTx(['rolls'], 'readwrite', function (s) {
          s.put(updated);
        }).then(function () {
          return { record: updated, fullyReverted: fullyReverted };
        });
      });
    });
  }

  /* =========================================================================
     Import فایل اکسل (پورت api/import — جایگزینی کامل Dataset)
     ========================================================================= */

  /** خطای Import با ستون‌های الزامی گم‌شده (همان قرارداد ApiError) */
  function ImportError(message, extra) {
    var e = new Error(message);
    e.name = 'ImportError';
    e.importExtra = extra || {};
    return e;
  }

  function readFileAsArrayBuffer(file) {
    if (file.arrayBuffer) return file.arrayBuffer();
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = function () { reject(fr.error); };
      fr.readAsArrayBuffer(file);
    });
  }

  /**
   * خواندن + اعتبارسنجی + جایگزینی کامل داده‌ها از فایل اکسل.
   * خروجی: Promise<summary> — یا reject با ImportError.
   */
  function importExcelFile(file, settings) {
    return Promise.resolve()
      .then(function () {
        // ۱) بررسی نوع و حجم فایل
        if (!/\.(xlsx|xlsm|xls)$/i.test(file.name)) {
          throw new ImportError('فقط فایل‌های اکسل (.xls یا .xlsx) پذیرفته می‌شوند.');
        }
        if (file.size > MAX_FILE_SIZE) {
          throw new ImportError('حجم فایل نباید بیش از ۵۰ مگابایت باشد.');
        }
        return readFileAsArrayBuffer(file);
      })
      .then(function (buffer) {
        // ۲) پارس فایل اکسل (شییت اول)
        var workbook;
        try {
          workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
        } catch (err) {
          console.error('[store] خطای پارس فایل:', err);
          throw new ImportError('فایل اکسل قابل خوانده شدن نیست. از فایل xls/xlsx سالم استفاده کنید.');
        }
        var sheetName = workbook.SheetNames[0] || '';
        var ws = sheetName ? workbook.Sheets[sheetName] : undefined;
        // raw:true تا مقادیر عددی واقعی باشند (نه رشته) — هدرها فارسی هستند
        var rows = ws ? XLSX.utils.sheet_to_json(ws, { defval: null, raw: true }) : [];
        if (rows.length === 0) {
          throw new ImportError('فایل خالی است.');
        }
        var headers = Object.keys(rows[0]);

        // ۳) نگاشت ستون‌ها با تنظیمات فعلی (اولویت: انتخاب کاربر → primary → fallback)
        var mapping = EVA.buildFieldMapping(headers, settings.columnMapping);
        if (mapping.missing.length > 0) {
          var labels = mapping.missing.map(function (f) { return EVA.FIELD_LABELS[f]; });
          throw new ImportError(
            'ستون‌های الزامی یافت نشدند: ' + labels.join('، '),
            { missing: labels, headers: headers }
          );
        }

        // ۴) نرمال‌سازی سطرها (هر سطر rawJson خود را برای بازسازی نگه می‌دارد)
        var records = rows.map(function (row, i) {
          return EVA.normalizeRow(row, mapping.map, i + 1);
        });

        // ۵) شمارش دسته‌ها با تنظیمات فعلی + وزن کل رول‌های خام
        var counts = {
          raw: 0, eva: 0, cut: 0,
          error_e_film: 0, error_no_e: 0,
          raw_out_of_range: 0, other: 0,
        };
        var totalRawWeight = 0;
        records.forEach(function (rec) {
          var cls = EVA.classifyRoll(rec.rollNumber, rec.filmType, rec.width, rec.thickness, settings);
          counts[cls.category] += 1;
          if (cls.category === 'raw' && rec.netWeight !== null) totalRawWeight += rec.netWeight;
        });
        totalRawWeight = EVA.roundTo(totalRawWeight, 3);

        // ۶) جایگزینی کامل Dataset
        var now = new Date();
        var batch = {
          id: Date.now(),
          fileName: file.name,
          sheetName: sheetName,
          importedAt: now.toISOString(),
          totalRows: records.length,
          headers: JSON.stringify(headers),
          counts: JSON.stringify(counts),
        };
        var storedRolls = records.map(function (r, i) {
          return {
            id: i + 1,
            rollNumber: r.rollNumber,
            filmType: r.filmType,
            width: r.width,
            initialWidth: r.initialWidth,
            length: r.length,
            thickness: r.thickness,
            netWeight: r.netWeight,
            grade: r.grade,
            palletNumber: r.palletNumber,
            setupNumber: r.setupNumber,
            productionDate: r.productionDate,
            position: r.position,
            externalId: r.externalId,
            rawJson: r.rawJson,
            batchId: batch.id,
            rowIndex: r.rowIndex,
          };
        });

        return replaceDataset(storedRolls, batch).then(function () {
          // ۷) خروجی — نگاشت بدون مقادیر null (فقط ستون‌های واقعاً نگاشت‌شده)
          var mappingOut = {};
          Object.keys(mapping.map).forEach(function (field) {
            var col = mapping.map[field];
            if (typeof col === 'string' && col !== '') mappingOut[field] = col;
          });
          return {
            fileName: file.name,
            sheetName: sheetName,
            totalRows: records.length,
            headers: headers,
            mapping: mappingOut,
            counts: counts,
            totalRawWeight: totalRawWeight,
            importedAt: now.toISOString(),
          };
        });
      });
  }

  /** پاک‌سازی کامل + درج رکوردهای جدید (چانکی) */
  function replaceDataset(rolls, batch) {
    return runTx(['rolls', 'batches'], 'readwrite', function (rollStore, batchStore) {
      rollStore.clear();
      batchStore.clear();
      batchStore.put(batch);
    }).then(function () {
      return bulkAddChunked('rolls', rolls);
    });
  }

  /** حذف همهٔ داده‌ها (رول‌ها + متادیتای Import) — تنظیمات دست‌نخورده */
  function deleteAllData() {
    return runTx(['rolls', 'batches'], 'readwrite', function (rollStore, batchStore) {
      rollStore.clear();
      batchStore.clear();
    });
  }

  /* =========================================================================
     بازسازی رکوردها با نگاشت جدید (پورت rebuild در api/settings)
     -------------------------------------------------------------------------
     رکوردهای دارای rawJson از دادهٔ خام بازسازی می‌شوند؛ رکوردهای اولیهٔ
     سامانه (بدون rawJson) مقادیر نرمال‌شدهٔ فعلی خود را حفظ می‌کنند.
     ========================================================================= */

  function rebuildRolls(newMapping, headers) {
    return getLastBatch().then(function (last) {
      if (!last) return { rebuilt: false, affectedRows: 0 };
      var mapResult = EVA.buildFieldMapping(headers, newMapping);
      // اگر نگاشت جدید فیلد الزامی را از دست داد → خطا و هیچ تغییری ذخیره نمی‌شود
      if (mapResult.missing.length > 0) {
        var labels = mapResult.missing.map(function (f) { return EVA.FIELD_LABELS[f]; });
        var e = new Error('ستون‌های الزامی در نگاشت جدید یافت نشدند: ' + labels.join('، ') + ' — هیچ تغییری ذخیره نشد.');
        e.name = 'RebuildError';
        throw e;
      }
      return getAllRolls().then(function (rolls) {
        var affected = 0;
        var updated = rolls.map(function (roll) {
          var row = null;
          if (roll.rawJson && typeof roll.rawJson === 'string') {
            try { row = JSON.parse(roll.rawJson); } catch (err) { row = null; }
          }
          if (row && typeof row === 'object') {
            var rec = EVA.normalizeRow(row, mapResult.map, roll.rowIndex);
            affected += 1;
            // بند ۴ (نسخهٔ ۱٫۲): ویرایش دستی فیلدها (manualEdit) بر خروجی
            // نرمال‌سازی اولویت دارد تا در بازسازی نگاشت از دست نرود
            // (عین api/settings: رشته‌ها با ?? و اعداد با !== undefined)
            var manual = EVA.parseManualEdit(roll.manualEdit);
            return Object.assign({}, roll, {
              rollNumber: manual.rollNumber != null ? manual.rollNumber : rec.rollNumber,
              filmType: manual.filmType != null ? manual.filmType : rec.filmType,
              width: manual.width !== undefined ? manual.width : rec.width,
              initialWidth: manual.initialWidth !== undefined ? manual.initialWidth : rec.initialWidth,
              length: manual.length !== undefined ? manual.length : rec.length,
              thickness: manual.thickness !== undefined ? manual.thickness : rec.thickness,
              netWeight: manual.netWeight !== undefined ? manual.netWeight : rec.netWeight,
              grade: manual.grade !== undefined ? manual.grade : rec.grade,
              palletNumber: manual.palletNumber !== undefined ? manual.palletNumber : rec.palletNumber,
              setupNumber: manual.setupNumber !== undefined ? manual.setupNumber : rec.setupNumber,
              productionDate: manual.productionDate !== undefined ? manual.productionDate : rec.productionDate,
              position: manual.position !== undefined ? manual.position : rec.position,
              externalId: manual.externalId !== undefined ? manual.externalId : rec.externalId,
            });
          }
          return roll; // بدون دادهٔ خام → همان مقادیر نرمال‌شدهٔ فعلی (شامل ویرایش دستی)
        });
        return bulkAddChunked('rolls', updated).then(function () {
          return { rebuilt: true, affectedRows: rolls.length };
        });
      });
    });
  }

  /* =========================================================================
     پشتیبان‌گیری (GET /api/backup) — ساخت فایل JSON سازگار با نسخهٔ وب
     ========================================================================= */

  /** ساخت payload کامل پشتیبان */
  function buildBackup() {
    return Promise.all([getAllBatches(), getAllRolls()]).then(function (results) {
      var batches = results[0].slice().sort(function (a, b) { return a.id - b.id; });
      var rolls = results[1].slice().sort(function (a, b) { return a.id - b.id; });
      var settingsValue = getSettingsJSON();
      var settings = settingsValue !== null ? [{ key: EVA.SETTINGS_KEY, value: settingsValue }] : [];
      return {
        app: EVA.APP_NAME,
        schemaVersion: EVA.BACKUP_SCHEMA_VERSION,
        appVersion: EVA.APP_VERSION,
        exportedAt: new Date().toISOString(),
        counts: {
          settings: settings.length,
          importBatches: batches.length,
          rolls: rolls.length,
        },
        data: {
          settings: settings,
          importBatches: batches.map(function (b) {
            return {
              id: b.id,
              fileName: b.fileName,
              sheetName: b.sheetName,
              importedAt: b.importedAt,
              totalRows: b.totalRows,
              headers: b.headers, // رشتهٔ JSON آرایهٔ هدرها — عین‌گونه
              counts: b.counts,   // رشتهٔ JSON شمارنده‌ها — عین‌گونه
            };
          }),
          rolls: rolls.map(function (r) {
            // همهٔ فیلدها شامل rawJson هنگام وجود — عین‌گونه
            return normalizeStoredRoll(r);
          }),
        },
      };
    });
  }

  /* =========================================================================
     اعتبارسنجی و بازیابی پشتیبان (پورت api/backup POST) — پیام‌های یکسان
     ========================================================================= */

  var MAX_BACKUP_ROLLS = 200000;

  function isRecord(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
  }

  /** پارس فیلد JSON (headers/counts): رشتهٔ JSON قابل‌پارس یا مقدار بومی */
  function parseJsonField(v, kind) {
    var parsed = v;
    if (typeof v === 'string') {
      try { parsed = JSON.parse(v); } catch (e) { return undefined; }
    }
    if (kind === 'array') return Array.isArray(parsed) ? parsed : undefined;
    return isRecord(parsed) ? parsed : undefined;
  }

  /** فیلد عددی اختیاری — عین‌گونه پاس داده می‌شود (undefined/null → null) */
  function passNumber(v) {
    return v === undefined || v === null ? null : v;
  }

  /** فیلد رشته‌ای اختیاری — عین‌گونه پاس داده می‌شود */
  function passString(v) {
    return v === undefined || v === null ? null : v;
  }

  /** rawJson — رشته عین‌گونه؛ شیء/آرایه → JSON.stringify؛
   *  بند ۴ (نسخهٔ ۱٫۳): تهی → null (نه «{}» — رشتهٔ «{}» Truthy است و مسیر
   *  بازگردانی از دادهٔ خام را با سطر خالی فریب می‌داد) */
  function normalizeRawJson(v) {
    if (typeof v === 'string') return v === '{}' ? null : v;
    if (isRecord(v) || Array.isArray(v)) return JSON.stringify(v);
    return null;
  }

  /** آماده‌سازی سطر ImportBatch — نامعتبر → null (شمرده می‌شود) */
  function prepareBatchRow(row) {
    if (!isRecord(row)) return null;
    if (typeof row.fileName !== 'string') return null;
    if (typeof row.totalRows !== 'number' || !Number.isFinite(row.totalRows)) return null;
    var headers = parseJsonField(row.headers, 'array');
    if (headers === undefined) return null;
    var counts = parseJsonField(row.counts, 'object');
    if (counts === undefined) return null;
    return {
      oldId: typeof row.id === 'number' ? row.id : null,
      data: {
        fileName: row.fileName,
        sheetName: typeof row.sheetName === 'string' ? row.sheetName : null,
        importedAt: typeof row.importedAt === 'string' ? row.importedAt : new Date().toISOString(),
        totalRows: row.totalRows,
        headers: typeof row.headers === 'string' ? row.headers : JSON.stringify(headers),
        counts: typeof row.counts === 'string' ? row.counts : JSON.stringify(counts),
      },
    };
  }

  /** آماده‌سازی سطر Roll — نامعتبر → null (شمرده می‌شود)
   *  typeOverride و manualEdit (بند ۴ نسخهٔ ۱٫۲) پذیرفته و ذخیره می‌شوند؛
   *  فایل‌های پشتیبان قدیمی بدون این فیلدها هم پذیرفته می‌شوند → null */
  function prepareRollRow(row) {
    if (!isRecord(row)) return null;
    if (typeof row.rollNumber !== 'string' || typeof row.filmType !== 'string') return null;
    var netWeight = row.netWeight;
    if (netWeight !== undefined && netWeight !== null && typeof netWeight !== 'number') return null;
    return {
      rollNumber: row.rollNumber,
      filmType: row.filmType,
      width: passNumber(row.width),
      initialWidth: passNumber(row.initialWidth),
      length: passNumber(row.length),
      thickness: passNumber(row.thickness),
      netWeight: passNumber(netWeight),
      grade: passString(row.grade),
      palletNumber: passString(row.palletNumber),
      setupNumber: passNumber(row.setupNumber),
      productionDate: passString(row.productionDate),
      position: passString(row.position),
      externalId: passString(row.externalId),
      typeOverride:
        row.typeOverride === 'raw' || row.typeOverride === 'eva' || row.typeOverride === 'cut'
          ? row.typeOverride
          : null,
      manualEdit:
        typeof row.manualEdit === 'string'
          ? row.manualEdit
          : row.manualEdit && typeof row.manualEdit === 'object'
            ? JSON.stringify(row.manualEdit)
            : null,
      rawJson: normalizeRawJson(row.rawJson),
      batchId: typeof row.batchId === 'number' ? row.batchId : null,
      rowIndex: typeof row.rowIndex === 'number' ? row.rowIndex : 0,
    };
  }

  /**
   * اعتبارسنجی کامل فایل پشتیبان — همهٔ خطاها جمع می‌شوند (پیام‌های فارسی
   * یکسان با api/backup در نسخهٔ وب).
   */
  function validateBackup(body) {
    var errors = [];

    if (!isRecord(body)) {
      return { ok: false, errors: ['ساختار فایل معتبر نیست.'] };
    }
    if (body.app !== EVA.APP_NAME) {
      errors.push('این فایل متعلق به ' + EVA.APP_NAME + ' نیست.');
    }
    if (body.schemaVersion !== EVA.BACKUP_SCHEMA_VERSION) {
      errors.push('نسخهٔ ساختار پشتیبان (' + String(body.schemaVersion) + ') پشتیبانی نمی‌شود.');
    }

    var d = body.data;
    if (!isRecord(d)) {
      errors.push('بخش داده‌های فایل یافت نشد.');
      return { ok: false, errors: errors };
    }

    if (!Array.isArray(d.settings)) errors.push('جدول «تنظیمات» در فایل یافت نشد یا معتبر نیست.');
    if (!Array.isArray(d.importBatches)) errors.push('جدول «ورود داده‌ها» در فایل یافت نشد یا معتبر نیست.');
    if (!Array.isArray(d.rolls)) errors.push('جدول «رول‌ها» در فایل یافت نشد یا معتبر نیست.');
    if (errors.length > 0) return { ok: false, errors: errors };

    var settingsRows = d.settings;
    var batchRows = d.importBatches;
    var rollRows = d.rolls;

    if (rollRows.length > MAX_BACKUP_ROLLS) {
      errors.push('حجم فایل پشتیبان بیش از حد مجاز است.');
      return { ok: false, errors: errors };
    }

    // سطرهای تنظیمات — شیء با key/value رشته‌ای
    var settings = [];
    var badSettings = 0;
    settingsRows.forEach(function (row) {
      if (isRecord(row) && typeof row.key === 'string' && typeof row.value === 'string') {
        settings.push({ key: row.key, value: row.value });
      } else {
        badSettings += 1;
      }
    });
    if (badSettings > 0) {
      errors.push(Fmt.faNum(badSettings) + ' رکورد تنظیمات در فایل ساختار نامعتبر دارد.');
    }

    // ردیف تنظیمات اصلی برنامه باید JSON معتبر باشد
    var mainSettings = null;
    for (var i = 0; i < settings.length; i++) {
      if (settings[i].key === EVA.SETTINGS_KEY) { mainSettings = settings[i]; break; }
    }
    if (mainSettings) {
      try { JSON.parse(mainSettings.value); } catch (e) {
        errors.push('تنظیمات ذخیره‌شده در فایل معتبر نیست.');
      }
    }

    // سطرهای ImportBatch
    var batches = [];
    var badBatches = 0;
    batchRows.forEach(function (row) {
      var prepared = prepareBatchRow(row);
      if (prepared) batches.push(prepared);
      else badBatches += 1;
    });
    if (badBatches > 0) {
      errors.push(Fmt.faNum(badBatches) + ' رکورد ورود داده‌ها در فایل ساختار نامعتبر دارد.');
    }

    // سطرهای رول
    var rolls = [];
    var badRolls = 0;
    rollRows.forEach(function (row) {
      var prepared = prepareRollRow(row);
      if (prepared) rolls.push(prepared);
      else badRolls += 1;
    });
    if (badRolls > 0) {
      errors.push(Fmt.faNum(badRolls) + ' رکورد رول در فایل ساختار نامعتبر دارد.');
    }

    if (errors.length > 0) return { ok: false, errors: errors };
    return { ok: true, data: { settings: settings, batches: batches, rolls: rolls } };
  }

  /**
   * بازیابی اتمیک — پاک‌سازی کامل + بازسازی فروشگاه‌ها و تنظیمات.
   * batchId رول‌ها به شناسهٔ معتبر نگاشت می‌شود (رفتار نسخهٔ وب).
   */
  function restoreBackup(check) {
    var settings = check.data.settings;
    var batches = check.data.batches;
    var rolls = check.data.rolls;

    // تنظیمات: ردیف اصلی → localStorage؛ نبود → پیش‌فرض (حذف کلید)
    var mainSettings = null;
    for (var i = 0; i < settings.length; i++) {
      if (settings[i].key === EVA.SETTINGS_KEY) { mainSettings = settings[i]; break; }
    }
    if (mainSettings) localStorage.setItem(EVA.SETTINGS_KEY, mainSettings.value);
    else localStorage.removeItem(EVA.SETTINGS_KEY);

    // درج batch ها (با شناسهٔ جدید = شناسهٔ فایل یا ترتیبی) + نگاشت قدیمی → جدید
    var batchIdMap = new Map();
    var firstBatchId = null;
    var batchRecords = batches.map(function (b, idx) {
      var newId = b.oldId !== null ? b.oldId : idx + 1;
      var record = Object.assign({ id: newId }, b.data);
      if (b.oldId !== null) batchIdMap.set(b.oldId, newId);
      if (firstBatchId === null) firstBatchId = newId;
      return record;
    });

    // رول‌ها — batchId معتبرشده؛ شناسهٔ ترتیبی جدید (همانند auto-increment نسخهٔ وب)
    var rollRecords = rolls.map(function (r, idx) {
      var oldBatchId = r.batchId;
      var resolved = oldBatchId === null ? undefined : batchIdMap.get(oldBatchId);
      if (resolved === undefined) resolved = firstBatchId !== null ? firstBatchId : (oldBatchId == null ? 0 : oldBatchId);
      return Object.assign({}, r, { id: idx + 1, batchId: resolved });
    });

    return runTx(['rolls', 'batches'], 'readwrite', function (rollStore, batchStore) {
      rollStore.clear();
      batchStore.clear();
      batchRecords.forEach(function (b) { batchStore.put(b); });
    }).then(function () {
      return bulkAddChunked('rolls', rollRecords);
    }).then(function () {
      return {
        ok: true,
        counts: {
          settings: settings.length,
          importBatches: batches.length,
          rolls: rolls.length,
        },
      };
    });
  }

  /* ---------------- انتشار سراسری ---------------- */
  window.Store = {
    ready: ready,
    ImportError: ImportError,
    getSettings: getSettings,
    getSettingsJSON: getSettingsJSON,
    saveSettings: saveSettings,
    getAllRolls: getAllRolls,
    getAllBatches: getAllBatches,
    getLastBatch: getLastBatch,
    getRollById: getRollById,
    updateRoll: updateRoll,
    revertRoll: revertRoll,
    importExcelFile: importExcelFile,
    deleteAllData: deleteAllData,
    rebuildRolls: rebuildRolls,
    buildBackup: buildBackup,
    validateBackup: validateBackup,
    restoreBackup: restoreBackup,
  };
})();
