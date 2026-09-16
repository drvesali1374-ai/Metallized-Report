/* تست منطقی «کنترل تعداد مجاز» (تغییر ۱) — با دیتای نمونهٔ واقعی کاربر */
'use strict';

import fs from 'node:fs';
import path from 'node:path';

global.window = global;
const ROOT = '/home/z/my-project/public/roll-monitor';

function load(file) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  eval(code);
}

/* ---- بارگذاری ماژول‌های واقعی ---- */
load('js/config.js');
load('js/utils.js');

/* ---- استاب دیتابیس ---- */
const mem = {
  standardLengthRules: [
    { id: 1, thickness: 20, minLength: 19000, maxLength: 21000, standardLength: 20000 },
    { id: 2, thickness: 20, minLength: 39000, maxLength: 41000, standardLength: 40000 },
  ],
  setupRolls: [],
};
const fakeDb = {
  standardLengthRules: { toArray: async () => mem.standardLengthRules },
  setupRolls: {
    toArray: async () => mem.setupRolls,
    where: () => ({ equals: () => ({ toArray: async () => [] }) }),
  },
  transaction: async () => {},
};
global.RM.db = { db: fakeDb };

load('js/rules.js');
load('js/setups.js');

const Setups = global.RM.setupEngine;
const R = global.RM.rulesEngine;
const U = global.RM.utils;

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✕ ${name}\n      actual:   ${JSON.stringify(actual)}\n      expected: ${JSON.stringify(expected)}`); }
}

/* ---- دیتای پیست‌شدهٔ کاربر (مو به مو) ---- */
const PASTED = [
  '1210\t800\t1080\t1020\t610\t1060\t1120\t1100\t\t\t\t10',
  '2010\t\t2100\t\t1670\t\t1120\t1100\t\t\t\t',
  '1020\t1140\t1120\t1100\t1180\t1200\t1215\t\t\t\t\t8',
  '2160\t\t2220\t\t1180\t1200\t1215\t\t\t\t',
  '1020\t1160\t1210\t1180\t1140\t1120\t1170\t\t\t\t\t2',
  '2180\t1210\t2320\t\t1120\t1170\t\t\t\t',
  '1090\t1120\t1180\t1170\t1160\t1140\t1100\t\t\t\t\t2',
  '2210\t\t1180\t2330\t\t1140\t1100\t\t\t\t',
  '1170\t1020\t1170\t1020\t1020\t860\t1120\t610\t\t\t\t4',
  '2190\t\t2190\t\t1880\t\t1730\t\t\t\t',
  '1140\t1060\t1140\t1060\t750\t1060\t610\t1140\t\t\t\t2',
  '2200\t\t2200\t\t1810\t\t1750\t\t\t\t',
  '610\t610\t1170\t610\t610\t1090\t960\t610\t610\t1090\t\t\t1',
  '2390\t\t\t\t2310\t\t\t\t1570\t\t1700\t\t\t\t',
].join('\n');

console.log('\n== ۱) buildBulkDraft — ساخت drafts و allowedMap ==');
const { drafts, structureErrors, allowedMap } = Setups.buildBulkDraft(
  { setupNumber: '999', machineNumber: '1', thickness: '20', standardLength: '' }, PASTED);

check('structureErrors خالی است (تب‌ها استاندارد)', structureErrors.length, 0);
/* جفت‌ها: ۱→۵ گروه (1210-800 و…)، ۲→۵، ۳→۵، ۴→۵، ۵→۴، ۶→۴، ۷→۳ (1700 الگوی خالی) = ۳۱ */
check('تعداد رکوردهای پیش‌نمایش', drafts.length, 31);
console.log(`  drafts = ${drafts.length}, widths = ${Object.keys(allowedMap).length}`);

console.log('\n== ۲) allowedMap — تعداد مجاز دیتای پیست‌شده (مثال کاربر: 1180) ==');
check('allowedMap[1180] = 10 (1×8 + 1×2)', allowedMap['1180'], 10);
check('«تعداد مجاز» کامل عرض 1180 = 1180×10 = 11800', allowedMap['1180'] * 1180, 11800);
check('allowedMap[1100] (جفت ۱×10 + جفت ۴×2) = 12', allowedMap['1100'], 12);
check('allowedMap[1120] (جفت ۱×10 + جفت ۳×2) = 12', allowedMap['1120'], 12);
check('allowedMap[2390] = 1', allowedMap['2390'], 1);
check('allowedMap[1700] = 1 (مادر با سلول الگوی خالی — شمرده می‌شود)', allowedMap['1700'], 1);
check('1020 مادر نیست (فقط الگو) → در allowedMap نیست', allowedMap['1020'], undefined);

console.log('\n== ۳) validateBulkDraft — همه ۱-ستی (متراژ 20000) ==');
{
  const common = { setupNumber: '999', thickness: '20' };
  for (const d of drafts) { d.machineNumber = '1'; d.standardLength = '20000'; }

  const check1 = await Setups.validateBulkDraft(common, drafts, { allowedMap });
  const okRows = (check1.allowedRows || []).filter((r) => r.status === 'ok');
  const badRows = (check1.allowedRows || []).filter((r) => r.status !== 'ok');
  console.log(`  allowedRows: ${check1.allowedRows.length} — ok=${okRows.length} bad=${badRows.length}`);
  const row1180 = check1.allowedRows.find((r) => r.key === '1180');
  check('1180: preview=10 → 11800 (برابر پیست‌شده)', row1180 && row1180.preview, 11800);
  check('1180: status ok', row1180 && row1180.status, 'ok');
  // 1700 رکوردی ندارد → less
  const row1700 = check1.allowedRows.find((r) => r.key === '1700');
  check('1700: preview=0 → status less (بدون رکورد)', row1700 && row1700.status, 'less');
  check('1700: preview=0', row1700 && row1700.preview, 0);
}

console.log('\n== ۴) تغییر متراژ یک رکورد به ۴۰۰۰۰ (۲ ست) → خطای «بیشتر» ==');
{
  const common = { setupNumber: '999', thickness: '20' };
  const target = drafts.find((d) => d.motherToken === '1180');
  const savedStd = target.standardLength;
  target.standardLength = '40000';

  const check2 = await Setups.validateBulkDraft(common, drafts, { allowedMap });
  const row1180 = check2.allowedRows.find((r) => r.key === '1180');
  /* رکورد ۱۱۸۰ اول (جفت ۲، تعداد ۸) با ۲ ست: 2×8=16 + رکورد دوم (جفت ۴، تعداد ۲، ۱ ست): 2 → 18×1180 */
  check('1180 با ۲ ست: preview = 1180×(2×8 + 1×2) = 21240', row1180 && row1180.preview, 21240);
  check('1180: status more', row1180 && row1180.status, 'more');
  const row = check2.records.find((r) => r.motherToken === '1180' && r.standardLength === '40000');
  check('خطا روی رکورد 1180 الصاق شد',
    row && row.errors.some((e) => e.includes('بیشتر از دیتای ستاپ')), true);
  check('خطا روی «هر دو» رکورد 1180 (تکراری‌ها) الصاق شد',
    check2.records.filter((r) => r.motherToken === '1180')
      .every((r) => r.errors.some((e) => e.includes('کنترل تعداد مجاز'))), true);
  check('globalErrors.allowed تنظیم شد', !!check2.globalErrors.allowed, true);
  check('ok=false (Commit مسدود)', check2.ok, false);
  target.standardLength = savedStd;
}

console.log('\n== ۵) حذف یک رکورد → خطای «کمتر» ==');
{
  const common = { setupNumber: '999', thickness: '20' };
  const drafts2 = drafts.filter((d) => !(d.motherToken === '1180' && d.rollCount === 2));
  const check3 = await Setups.validateBulkDraft(common, drafts2, { allowedMap });
  const row1180 = check3.allowedRows.find((r) => r.key === '1180');
  check('1180 پس از حذف رکورد دوم: preview = 9440', row1180 && row1180.preview, 9440);
  check('1180: status less', row1180 && row1180.status, 'less');
  const row = check3.records.find((r) => r.motherToken === '1180');
  check('خطای «کمتر از دیتای ستاپ» روی رکورد باقی‌مانده',
    row && row.errors.some((e) => e.includes('کمتر از دیتای ستاپ')), true);
}

console.log('\n== ۶) بدون allowedMap → رفتار سازگار گذشته ==');
{
  const common = { setupNumber: '999', thickness: '20' };
  const check4 = await Setups.validateBulkDraft(common, drafts);
  check('بدون allowedMap: allowedRows = null', check4.allowedRows, null);
}

console.log('\n== ۷) ادغام دو رکورد هم‌عرض (تغییر ۲ قبلی) → کنترل پاس می‌مانَد ==');
{
  const common = { setupNumber: '998', thickness: '20' };
  const two = [
    { motherToken: '1180', patternText: '1180', rollCount: 8, machineNumber: '1', standardLength: '20000' },
    { motherToken: '1180', patternText: '1180', rollCount: 2, machineNumber: '1', standardLength: '20000' },
  ];
  const am = { '1180': 10 };
  const check5 = await Setups.validateBulkDraft(common, two, { allowedMap: am });
  const row1180 = check5.allowedRows.find((r) => r.key === '1180');
  check('دو رکورد 1180 (۸+۲): preview = 11800', row1180 && row1180.preview, 11800);
  check('status ok (ادغام/جمع تعداد کنترل را حفظ می‌کند)', row1180 && row1180.status, 'ok');
}

console.log(`\n========== نتیجه: ${pass} پاس / ${fail} خطا ==========`);
process.exit(fail ? 1 : 0);
