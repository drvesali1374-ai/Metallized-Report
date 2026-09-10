# Worklog

---
Task ID: 1
Agent: Z.ai Code (main agent)
Task: ساخت وب‌اپلیکیشن آفلاین «مانیتورینگ صنعتی رول‌ها» مشابه پروژه Optimizer — تحلیل مرجع، پیاده‌سازی کامل و تست مرورگر

Work Log:
- ساختار پروژه مرجع GitHub (Optimizer) بررسی شد: یک فایل HTML اصلی با اسکریپت‌های لوکال ماژولار و base href شبکه‌ای، کاملاً بدون سرور
- دو فایل اکسل مرجع دانلود و با SheetJS تحلیل شدند: ستون «نوع فیلم» در اندیس ۳، مقادیر FRN21/KRN21؛ rolls دارای ۹۹ ردیف واقعی (+۱۵۶ ردیف خالی)، Archived دارای ۹۹ ردیف واقعی (+۹۰۴۲ ردیف خالی)
- ساختار پروژه roll-monitor/ ساخته شد: index.html + app.js + style.css + README.md + lib/ (همه لوکال)
- کتابخانه‌ها دانلود و لوکال شدند: dexie.min.js (v4.0.8 از unpkg)، xlsx.full.min.js (از node_modules)، فونت وزیرمتن (۳ وزن woff2 از jsdelivr)
- index.html نوشته شد: UI کامل RTL فارسی، ۳ تب (داشبورد/ورود داده‌ها/رول‌های ستاپ)، ۴ کارت KPI، دراپ‌زون ایمپورت، فرم ۵ فیلدی، مودال تأیید، سیستم Toast
- style.css نوشته شد: تم تیره zinc (بدون آبی/نیلی)، رنگ‌های تأکیدی زمردی/کهربایی/فیروزه‌ای/رز، پاصفحه چسبیده با mt-auto، واکنش‌گرا (موبایل‌فرست)، اسکرول‌بار سفارشی، دسترس‌پذیری فوکوس
- app.js نوشته شد: Dexie با ۴ جدول (rolls/archivedRolls/setupRolls/meta)، ایمپورت SheetJS با اعتبارسنجی ستون «نوع فیلم» (نرمال‌سازی هدر)، CRUD رول ستاپ، محاسبه ۴ شاخص دقیقاً طبق فرمول کاربر، کامنت‌های فارسی
- باگ CSS پیدا و رفع شد: [hidden] { display:none !important } — بدون آن پنجره مودال بسته روی کل صفحه سایه می‌انداخت
- ESLint برای پوشه‌های کتابخانه‌های minified مستثنی شد؛ lint پاس شد
- کپی در public/roll-monitor + ساخت roll-monitor.zip + فایل‌های نمونه اکسل در public/samples
- صفحه Next.js (src/app/page.tsx): iframe پیش‌نمایش زنده + دکمه دانلود ZIP + راهنمای ۳ مرحله‌ای + لینک فایل‌های نمونه + پاصفحه
- تست کامل با agent-browser: ایمپورت هر دو فایل واقعی (خام=۹۹، متالایز=۹۹)، ثبت ۲ رکورد ستاپ (مجموع=۴۲)، حذف با تأیید، اعتبارسنجی فرم خالی، ایمپورت فایل نامعتبر (پیام خطای دقیق + حفظ داده‌های قبلی)، ماندگاری IndexedDB پس از reload، پاصفحه چسبیده در دسکتاپ و موبایل، تأیید بصری با VLM
- خطای عمدی تست در کنسول ثبت شد (بخش مدیریت خطا) — هیچ خطای غیرمنتظره‌ای وجود ندارد

Stage Summary:
- محصول نهایی: اپ کاملاً آفلاین Vanilla JS (HTML/CSS/JS خالص) با SheetJS + Dexie + IndexedDB، قابل اجرا با دابل‌کلیک روی index.html
- منطق ۴ شاخص: خام = ردیف‌های rolls با charAt(1)==='R'؛ متالایز = همین شرط روی Archived؛ کل ستاپ = SUM(تعداد رول)؛ برش‌نشده = کل − (خام+متالایز) با هشدار مقدار منفی
- پیش‌نمایش زنده از طریق صفحه / (iframe به /roll-monitor/index.html) + دانلود ZIP کامل از /roll-monitor.zip + فایل‌های نمونه اکسل
- همه تعاملات کلیدی در مرورگر verify شدند؛ صفحه بدون خطا در dev.log

---
Task ID: 2
Agent: Z.ai Code (main agent)
Task: بازطراحی کامل پروژه طبق Master Specification (Metallized-Report) — تبدیل به سامانهٔ Roll Monitoring / Setup Management / Production Traceability

Work Log:
- فایل Master Specification (۲۸۹۹ خط) کامل خوانده و در دو لیست (۴۴ قانون کسب‌وکار + معماری ۱۶ ماژولی) مستند شد
- داده‌های واقعی اکسل با قوانین جدید تأیید شدند: ۹۹ رول خام (R + پالت خالی)، ۹۹ متالایز یونیک، عرض‌ها/ضخامت‌ها/ستاپ‌های واقعی
- معماری جدید: ۱۶ فایل JS ماژولار (بدون ES Module — سازگار file://) در فضای نام window.RM
- هسته: config (نقشه ستون‌ها)، utils (اعداد فارسی + هش FNV-1a)، normalize (مدل داخلی رول + parentRollNumber رزرو)، database (مهاجرت امن v1→v2 با بازسازی نرمال داده قدیمی)
- موتورها: rules (اعتبارسنجی هم‌پوشانی مرکزی + resolveStandardLength)، setups (کلید یکتا ۴فاکتوری + ارث‌بری/آبشار ضخامت + اعتبارسنجی الگو)، calc (calculateProductionState مرکزی: گروه‌بندی ۳فاکتوری خام + متالایز یونیک ۲فاکتوری + تخصیص Greedy-ASC ظرفیت‌محور + هشدارهای کیفیت + خلاصه)
- import (گزارشنمای اعتبارسنجی §11 + هش + نسخه‌بندی Dataset + تأیید جایگزینی) + backup (JSON تراکنشی با اعتبارسنجی)
- UI: ui.js (Toast/Modal/Pager) + ۵ نما (داشبورد/ورود/رول‌ها/ستاپ/تنظیمات) — همه فقط از موتور محاسبه تغذیه می‌کنند
- index.html بازنویسی (۵ تب + ۲ سابت + مودال Audit) و style.css کامل (کارت‌های الگو، چیپ‌های مرتب‌سازی کشیدنی، نشان مغایرت، مرکز هشدار)
- باگ‌های یافت‌شده و رفع: دکمه حذف‌همه از HTML جا افتاده بود؛ قفل ارث‌بری با ویرایش آبشاری تضاد داشت (پارامتر allowThicknessChange)؛ دراپ‌داون پس از تغییر ضخامت مقدار معتبر را حفظ نمی‌کرد
- تصمیم معماری مستندشده: تخصیص ظرفیت‌محور رول‌های خام هم‌کلید (مانند متالایز) برای جلوگیری از شمارش مضاعع §88
- تست‌ها: ۳۶ تست منطقی §100 (همه پاس)؛ سناریوی ۳ دستگاهی §101؛ مهاجرت v1→v2 (رکورد قدیمی legacy + متادیتا)؛ ایمپورت واقعی هر دو فایل؛ ارث‌بری قفل خودکار؛ آبشار ضخامت با تأیید؛ کلید یکتا؛ الگوی نامعتبر؛ حذف با تأیید؛ مغایرت ظرفیت §85-86؛ مرتب‌سازی کشیدنی + ماندگاری؛ Backup/تخریب/Restore + رد فایل خراب؛ عملکرد ۱۰k و ۱۰۰k ردیف (recalc خالص ۹۰۸ms)؛ اجرا با شبکهٔ کاملاً مسدود
- بررسی بصری VLM (دسکتاپ/ستاپ/رول‌ها/موبایل): بدون glitch، بدون overflow، پاصفحه سالم
- همگام‌سازی public + ZIP تمیز (۲۹ فایل) + lint پاس + dev.log بدون خطا

Stage Summary:
- محصول: نسخهٔ ۲ کامل با موتور محاسبهٔ مرکزی (Single Source of Truth)، قوانین متراژ، ستاپ‌های هوشمند، تخصیص ظرفیت‌محور، مرکز هشدار، Backup/Restore، مهاجرت امن
- همه ۴۴ قانون کسب‌وکار سند پیاده و تست شدند؛ ۲ باگ رفع و ۱ تصمیم معماری مستند شد
- پیش‌نمایش زنده از / با داده واقعی (خام ۹۹، متالایز ۹۹، ستاپ ۳۶، برش‌نشده ۹)

---
Task ID: 3
Agent: Z.ai Code (main agent)
Task: اعمال ۹ اصلاح و توسعه روی پروژه Roll Monitor موجود (Enhancement — نه بازنویسی)

Work Log:
- Inventory کامل کد فعلی (۱۶ فایل JS + HTML + CSS)؛ تشخیص موجود/ناقص/غایب برای هر ۹ مورد طبق قانون طلایی
- بررسی هدرهای واقعی هر دو فایل اکسل مرجع (۴۰ ستون rolls شامل تاریخ تولید/وزن خالص/گرید؛ ۳۳ ستون Archived)
- Item 1: COLUMN_MAP با ۴ فیلد اختیاری جدید (productionDate/netWeight/grade/status) + optional flag؛ buildFieldMapping با overrides کاربر (appSettings: columnMapping — مستقل هر Dataset)؛ پنل «نگاشت ستون‌های اکسل» در تنظیمات با اعتبارسنجی ستون در زمان ذخیره + بازسازی تراکنشی Dataset + متادیتای headers/mappingGaps در Import
- Item 2: Setups.normalizePatternKey (Multiset — ترتیب قطعات بی‌اثر) + کلید یکتا ۵فاکتوری + به‌روزرسانی پیام خطا؛ Allocation ظرفیت‌محور Greedy-ASC موجود حفظ و تأیید شد (تست ۳ دستگاهی: 8 یونیک → 2/3/3)
- Item 3: تبدیل تم تیره → روشن صنعتی با همان سیستم CSS Variable (bg #f1f2ec کرم-خاکستری، کارت #fcfcfa بدون سفید مطلق، Success #047857/Warning #b45309/Info #0f766e/Error #dc2626 + --danger-text)؛ همه رنگ‌های hardcoded اصلاح + کلاس panel-lib-error
- Item 4: Setups.parseBulkText (خط فرد=الگو+تعداد، خط زوج=مادر؛ سلول خالی=ادامهٔ مادر) + تجمیع هم‌کلیدها در کل Batch (تطابق با قانون کلید یکتا) + createBulk با dryRun و Commit تراکنشی واحد + پنل Bulk Paste با پیش‌نمایش خطای هر رکورد
- Item 5: فیلد status در SORTABLE_FIELDS + کامپراتور اختصاصی (1=دارای ستاپ/2=بدون ستاپ/3=غیرقابل تطبیق) + option در HTML
- Item 6: U.faWidth/faNumPlain مرکزی + جایگزینی در همه عرض‌ها (rolls/setup/import views + پیام‌های setups.js + پیش‌نمایش Bulk)
- Item 7: rollIds + matched در گروه‌های calc + جزئیات گروه با جدول ستون‌های Mapping‌شده + انتخاب‌گر ستون (افزودن/حذف/ترتیب + ذخیرهٔ rollDetailColumns)
- Item 8: هشدارها به تفکیک Dataset/نوع نقص (width/length/thickness/rollNumber/filmType) + no-rule/no-setup/metallized-surplus/capacity-conflict/incomplete-setup/rule-overlap/mapping-incomplete با drill descriptor + دکمهٔ «مشاهدهٔ رکوردها» در داشبورد + رزولور مشترک
- Item 9: عناوین کاربرپسنده + نام واقعی برای Audit + وضعیت Import + ردیف‌های مشکل‌دارِ قابل کلیک (Drill-down همان رکوردها) + برچسب‌های دوستانه در KPI/تنظیمات/سابقه
- ابزار مشترک: UI.rollDetailColumns + UI.recordsDrillModal (مودال واحد برای 7/8/9 — بدون UI موازی)
- باگ‌های یافت‌شده و رفع: حذف خروجی‌های normalize در بازنویسی (RM.normalize = N بدون متصل‌کردن توابع)؛ faNum(null)→«۰» به‌جای «—»؛ تفسیر مادرهای تکراری در نمونهٔ کاربر (نیاز به تجمیع سراسری Batch)
- تست منطقی Bun (۵۰+ سناریو): نرمال‌سازی الگو (جایگشت‌ها)، تجزیهٔ Bulk نمونهٔ واقعی ۱۰ خطی (۱۳ رکورد تجمیعی/۳۳ رول)، Mapping overrides، فرمت‌ها
- همگام‌سازی public/roll-monitor ↔ roll-monitor + بازسازی ZIP (۲۹ فایل) + README نسخهٔ ۲٫۱ + lint پاس
- تست E2E کامل با agent-browser: ایمپورت هر دو فایل، Mapping override + بازسازی ۹۹ رکورد، Bulk Paste کامل (13 رکورد/33 رول) + مسیر خطا (بدون Commit ناقص)، رد Duplicate دقیق و جایگشتی، تخصیص ۳ دستگاهی 2/3/3، مرتب‌سازی وضعیت (persist)، جزئیات گروه با ۵ ستون Mapping + انتخاب‌گر، Drill-down هشدارها (۷۹ بدون قانون / گروه‌ها / نقص‌ها)، Import قابل کلیک (TEST100R2 دقیق)، Backup، Reload persistence، پاصفحه (کوتاه/بلند)، کنسول بدون خطا، VLM تأیید تم روشن (دسکتاپ/موبایل)

Stage Summary:
- هر ۹ مورد قابل استفاده در UI و منطق تأیید شد؛ Regression ها (ایمپورت/قوانین/ارث‌بری/ماندگاری/Backup/پاصفحه/کنسول) سالم
- تصمیم معماری مهم: تجمیع ستاپ‌های هم‌کلید در Bulk Paste (مادرهای تکراری در نمونهٔ کاربر + سازگاری با کلید یکتا) — مجموع ظرفیت حفظ می‌شود
- سازگاری IndexedDB: بدون تغییر Schema؛ کلیدهای جدید appSettings (columnMapping/rollDetailColumns) + فیلدهای جدید رکوردها فقط با بازسازی نرمال روی ذخیرهٔ Mapping

---
Task ID: 4
Agent: Z.ai Code (main agent)
Task: اعمال ۷ اصلاح گزارش‌شدهٔ کاربر روی پروژهٔ Roll Monitor (Enhancement — بدون بازنویسی)

Work Log:
- Inventory کامل کد فعلی (۱۶ فایل JS + HTML + CSS) برای هر ۷ مورد؛ تشخیص ریشهٔ باگ‌ها
- Item 1 (بدون متراژ + صفحه‌بندی): ریشه = کلید «length» گزارشنماها به فیلد «actualLength» مدل داخلی نگاشت نمی‌شد — رزولور مشترک N.recordsWithIssue در normalize.js + استفاده در import view / dashboard / calc (شمارش هشدارها هم همین باگ را داشت!)؛ صفحه‌بندی کارا در recordsDrillModal و جزئیات گروه (state page + onPageChange بدون بستن مودال)؛ حذف سقف ۳۰۰ رکورد (DETAIL_ROWS) — همهٔ رکوردها با صفحه‌بندی قابل مشاهده
- Item 2: حذف کارت «فرمول‌های محاسباتی» داشبورد (HTML + JS)؛ ساخت تب/صفحهٔ «راهنما» با ۹ بخش آکاردئونی (فرمول‌ها + راهنمای همهٔ بخش‌ها)؛ حذف rolls.xlsx/Archived Rolls.xlsx از تیترهای Import و نگاشت (نام واقعی فقط برای Audit می‌ماند) + برچسب‌های پاک‌سازی و emptyText
- Item 3: تم تاریک با همان سیستم CSS Variable — بلوک [data-theme="dark"] (پالت zinc بدون آبی) + رنگ‌های وضعیت روشن‌تر برای کنتراست + متغیرهای جدید (--header-bg/--scrollbar-thumb/--input-hover-border/--accent-contrast) + انتخابگر تم در تنظیمات + اسکریپت head برای اعمال پیش از رندر + ذخیره در localStorage؛ تم روشن دست‌نخورده
- Item 4: سابقهٔ Import محدود به ۵ مورد آخر + چیپ «N Import ثبت‌شده» + دکمهٔ «نمایش همه/نمایش ۵ مورد آخر»
- Item 5: جدول قوانین و سابقهٔ Import در .table-wrap (اسکرول افقی داخل کادر — بدون بیرون‌زدگی)
- Item 6: بازسازی موتور Bulk → buildBulkDraft (تجمیع هم‌کلید) + validateBulkDraft (همان §26؛ خطاهای سراسری setup/thickness یک‌بار؛ خطای ضخامتِ بدون قانون سراسری) + commitBulkDraft (تراکنش واحد)؛ UI پیش‌نمایش قابل ویرایش: نوار فیلدهای سراسری (شماره ستاپ/ضخامت + دستگاه/متراژ پیش‌فرض + «اعمال روی همه»)، جدول با ویرایش همهٔ فیلدها (مادر/الگو/تعداد/دستگاه/متراژ از قوانین)، خلاصهٔ زندهٔ ۶چیپی (رکوردها/عرض‌های مادر/رول‌های الگو/جمع ست‌ها/یونیک مادر/یونیک الگو) با به‌روزرسانی آنی، اعتبارسنجی زنده با debounce
- Item 7: پنل مرتب‌سازی گزارش ستاپ‌ها (SETUP_SORTABLE_FIELDS ده فیلد + ماندگاری setupReportSort + بازنشانی) با مولفهٔ مشترک UI.sortPanel (استخراج از rolls.js — بدون UI موازی)؛ تغییر نام «خط لولهٔ مرتب‌سازی»→«پنل مرتب‌سازی» در هر دو بخش؛ فیلتر ستون‌ها (۱۰ ورودی برچسب‌دار، عدد=برابری عددی/متن=شامل بودن + ارقام فارسی، وضعیت «N از M»، پاک‌کردن فیلترها)
- باگ‌های یافت‌شده و رفع در حین تست: SetupView.filters مقداردهی نشده بود (Object.entries(undefined))؛ لیسنر btn-bulk-commit دوباره ثبت شده بود (Commit مضاعف ۳۴ رکورد!)؛ هر دو رفع شد
- تست منطقی Bun (۲۲ سناریو): buildBulkDraft نمونهٔ ۱۲ خطی کاربر (۱۷ رکورد/۲۲ مادر/۴۱ قطعه/۴۱ ست/۱۶ یونیک مادر)، تجمیع ۲۰۴۰×۲، خطاهای سراسری/ردیفی، همه-یا-هیچ، تکراری با DB، قوانین ضخامت دیگر — همه پاس
- تست E2E مرورگر: بدون متراژ ۳۵ رکورد در Import + داشبورد (قبلاً خالی/هشدار حذف)؛ صفحه‌بندی ابتدا/قبلی/بعدی/انتها در ۳ مودال؛ راهنما؛ عناوین؛ تم تاریک (اعمال/ماندگاری/بازگشت)؛ سابقهٔ ۶ Import (۵+گسترش)؛ اسکرول جدول‌های تنظیمات؛ Bulk کامل نمونهٔ واقعی (ویرایش زندهٔ تعداد ۴۱→۴۶ و الگو ۴۱→۴۲، commit تکی ۱۷ رکورد/۴۱ رول)؛ مسیر خطا (بدون ثبت)؛ مرتب‌سازی ستاپ‌ها (افزودن/جهت/ماندگاری بعد از reload/بازنشانی)؛ فیلتر عددی/متنی/ارقام فارسی/بدون نتیجه/پاک‌سازی؛ صفحه‌بندی جزئیات گروه (PAGE_SIZE=۵)؛ فوتر چسبیده (کوتاه/بلند)؛ موبایل؛ VLM تأیید تم روشن/تاریک؛ reload persistence ۹۹/۹۹/۲۰؛ کنسول بدون خطا؛ lint پاس؛ ZIP ۲۹ فایل بازسازی

Stage Summary:
- هر ۷ مورد در UI و منطق قابل استفاده تأیید شد؛ Regression ها (ایمپورت/قوانین/گروه‌ها/ماندگاری/فوتر/کنسول) سالم
- معماری حفظ شد: بدون Schema change؛ دو کلید appSettings جدید (setupReportSort) + localStorage تم؛ رزولور مشترک نقص‌ها و مولفهٔ مشترک پنل مرتب‌سازی — بدون UI/منطق موازی
- دو ریسک پنهان رفع شد: شمارش هشدارهای calc برای متراژ و Commit مضاعف Bulk

---
Task ID: 5
Agent: Z.ai Code (main agent)
Task: بازیابی کامل پروژه از بک‌آپ گیت‌هاب (drvesali1374-ai/Metallized-Report) — جایگزینی کامل محتویات پروژه فعلی که آخرین نسخهٔ آن از دست رفته بود

Work Log:
- مخزن بک‌آپ از https://github.com/drvesali1374-ai/Metallized-Report کلون شد؛ آخرین کامیت: «q» (v2.1 کامل شامل Task 1-4)
- مقایسهٔ زیرساخت حیاتی (Caddyfile/next.config.ts/package.json/prisma schema): همه IDENTICAL — جایگزینی امن
- توقف dev server قبلی؛ rsync --delete کامل محتویات repo → /home/z/my-project (حفظ node_modules/.git/skills/dev.log)
- حذف فایل‌های نسخهٔ ازدست‌رفته: roll-monitor/js/machines.js و roll-monitor/js/views/cutrolls.js و نسخه‌های تغییر یافتهٔ ۱۶ فایل JS بازگردانی به وضعیت repo
- پاک‌سازی .next و next-env.d.ts برای rebuild تمیز؛ bun install بدون تغییر (۸۵۵ پکیج)
- راه‌اندازی مجدد dev server با double-fork setsid (پایدار بین جلسات) — Ready in 809ms
- تست E2E با agent-browser: صفحهٔ / با iframe اپ رندر شد؛ تب ورود داده‌ها → ایمپورت rolls.xlsx (Dataset #1: ۹۹ رکورد، ۹۹ خام، هش #49890E99) + Archived Rolls.xlsx (Dataset #1: ۹۹ رکورد، ۹۹ متالایز، هش #45EB289F) با مودال تأیید جایگزینی
- داشبورد بعد از ایمپورت: خام ۹۹ / متالایز ۹۹ / ستاپ ۰ / برش‌نشده ۰ — منطق v2.1 سالم
- تست persistence: reload کامل صفحه → داده‌ها ماندگار (IndexedDB)؛ بدون هیچ console error
- تب ستاپ‌ها بررسی شد: فرم ثبت رول + ثبت گروهی (Paste از Clipboard) + گزارش تولید ستاپ‌ها با پنل مرتب‌سازی/فیلتر — همه سالم
- اسکرین‌شات دسکتاپ (1440px) و موبایل (390px) گرفته شد؛ dev.log پاک از خطا

Stage Summary:
- پروژهٔ v2.1 کامل (۴ مرحلهٔ کاری مستند در worklog repo) با موفقیت بازیابی و مستقر شد
- نسخهٔ ازدست‌رفته (شامل machines.js/cutrolls.js ناقص) به‌طور کامل حذف و با نسخهٔ پایدار repo جایگزین شد
- سرور روی پورت ۳۰۰۰ پایدار در حال اجرا؛ همهٔ تعاملات کلیدی (ایمپورت/داشبورد/ماندگاری/تب‌ها) در مرورگر verify شد
- آماده دریافت لیست تغییرات جدید از کاربر

---
Task ID: 6
Agent: Z.ai Code (main agent)
Task: اعمال ۴ تغییر بزرگ درخواستی کاربر روی پروژهٔ Roll Monitor نسخهٔ ۲٫۲ (نگاشت عرض اولیه/عرض + اصلاح گزارش تحلیل گروهی + تکمیل بخش رول‌های برش‌خورده + قوانین زمان متالایز و گزارش‌های زمانی)

Work Log:
- خوانده‌شدن کامل ۱۶ فایل JS + HTML + CSS + worklog برای درک معماری قبل از هر تغییری
- همهٔ ۴ تغییر ابتدا لیست و با TodoWrite ردیابی شد؛ سپس مو به مو پیاده‌سازی گردید

تغییر ۱ (نگاشت):
- config: فیلد width رول‌های موجود → برچسب «عرض اولیه» (PRIMARY «عرض رول اولیه»)؛ فیلد جدید cutWidth «عرض» (PRIMARY «عرض»، اختیاری)؛ SOURCE_FIELD_LABELS برای برچسب اختصاصی هر Dataset؛ fallback «موقعیت فعلی» برای فیلد وضعیت
- normalize: فیلد cutWidth در مدل داخلی + N.fieldLabel + isCutRoll (regex M\d*[LR]) + gradeLetter (پیشوند XUQT) + isEndOfLine (Contains «پای کار»)
- database: DB.ensureModelFields — ارتقای نرم رکوردهای قدیمی از raw با Mapping جاری (بدون تغییر Schema)
- utils: U.faWeightDot (جداسازی سه‌رقمی نقطه‌ای — 2316.8→«2.316») + U.faDuration + U.hoursOf

تغییر ۲ (گزارش تحلیل گروهی):
- bulkSummaryStats بازنویسی: جمع عرض رول مادر=Σتعداد · یونیک رول مادر=|عرض‌های یکتا| · جمع عرض الگوی برش=Σ(تعداد عرض الگو×تعداد ست) · یونیک عرض الگوی برش=|عرض‌های یکتا| — چیپ‌ها با برچسب‌های دقیق کاربر

تغییر ۳ (رول‌های برش‌خورده):
- calc.js: buildCutRollsReport — رکوردها از تنوع عرض‌های الگوهای ستاپ (کلید عرض+ستاپ)؛ موجود/گرید/پای‌کار/پالت از رول‌های برش‌خوردهٔ فایل موجود هم‌کلید؛ درستاپ/برش‌نخورده=Σ(تکرار عرض در الگو×تعداد/برش‌نشده)؛ وزن=عرض×۰٫۳۶۲×تعداد (فیلدهای مسطح x/u/q/tCount هم اضافه شد)
- views/cutrolls.js جدید: ۱۱ ستون (تعداد+وزن روی هم) · پنل مرتب‌سازی مشابه خام با دکمهٔ مخفی/ظاهر (ماندگار cutSortPanelVisible + cutRollsSort) · فیلتر همهٔ ستون‌ها زیر سرستون (همزمان چند ستون) · ارتفاع ۵۰ رکورد (calc(50×42px)) با thead چسبان
- HTML: جایگزینی placeholder با ساختار کامل + اسکریپت + CSS (cw-cell/cut-filter-row/mt-chart)

تغییر ۴ (زمان متالایز):
- rules.js: موتور قوانین زمان (ذخیره در appSettings:machineTimeRules — Backup خودکار پوشش می‌دهد) با کلید یکتا دستگاه+متراژ + timeDurationMinutes=floor(720/qty)
- settings.js + HTML: پنل «تعریف قانون زمان متالایز» با متراژ فقط از قوانین تعریف‌شده + پیش‌نمایش زندهٔ مدت + جدول CRUD
- calc.js: غنی‌سازی setupReport با durationMin/remainingSetupTime(=مدت×تعداد)/remainingProducedTime(=مدت×خام‌موجود) + خلاصه‌های totalRemaining*/machineTime/timeRuleCoverage + هشدار no-time-rule با Drill
- setup.js: دو ستون جدید + مرتب‌سازی/فیلتر + چیپ‌های زمان + Audit زمان
- dashboard.js + HTML: کارت‌های جدید «مانده زمان متالایز — ستاپ/تولید شده» (جایگزین متالایز/کل ستاپ) + چارت میله‌ای هر دستگاه با دو مؤلفه + Legend + جمع کل

تست‌ها:
- تست منطقی Bun (۵۷ سناریو، همه پاس): مثال‌های مرجع کاربر — ۱۶/۳/۴۸/۵ ، ۸۰۰×۰٫۳۶۲×۸=2.316 ، ۷۲۰÷۷=۱۰۲ ، هر ۷ نمونهٔ شناسهٔ رول، ۴ نمونهٔ گرید، گزارش برش‌خورده کامل با ۸ رول ۸۰۰ (۳X/۲U/۲Q/۱T/۵پای‌کار/۶پالت)، زمان‌ها ۱۰۲×۲=۲۰۴ و تفکیک دستگاه
- باگ یافت و رفع: فیلدهای xCount/uCount/… مسطح نشده بودند (گریدها «—» نشان می‌دادند)
- E2E مرورگر (agent-browser): ایمپورت فایل تست واقعی با ۱۲ رول برش‌خوردهٔ M-الگو → مقدار موجود ۸ + وزن 2.316 (دقیقاً مثال کاربر)؛ ۱۹/۱۳/۱۲/۲/۲ در-ستاپ (جمع ۴۸)؛ فیلتر همزمان دو ستون (width=800 + موجود=8 → ۱ رکورد)؛ toggle پنل مرتب‌سازی + persistence بعد از reload؛ mapping override «عرض»→«عرض رول اولیه» + rebuild + reset (cutWidth 800↔1740)؛ قانون زمان ۲ دستگاه + چارت (دستگاه۱ ۴:۴۸ = ۱۴۴×۲، دستگاه۲ ۲۳:۴۸)؛ KPI ۲۷→۲۸:۳۶ ساعت با ویرایش ستاپ
- VLM تأیید بصری دسکتاپ ۱۴۴۰px + موبایل ۳۹۰px: بدون به‌هم‌ریختگی/بیرون‌زدگی/هم‌پوشانی
- lint پاس · ZIP ۳۰ فایل بازسازی · README نسخهٔ ۲٫۲ + changelog · dev.log بدون خطا

Stage Summary:
- هر ۴ تغییر با مثال‌های عددی مرجع کاربر در تست منطقی و E2E مرورگر verify شد (۱۶/۳/۴۸/۵ · 2.316 · ۱۰۲ دقیقه)
- معماری Single Source of Truth حفظ شد: همهٔ محاسبات جدید در calc.js؛ نماها فقط رندر؛ ذخیره‌سازی زمان‌ها در appSettings (بدون Schema change) → Backup پوشش می‌دهد
- سازگاری: ارتقای نرم رکوردهای قدیمی (ensureModelFields)؛ IndexedDB بدون تغییر Schema؛ رول‌های خام/متالایز/ستاپ‌های موجود دست‌نخورده

---
Task ID: 7
Agent: Z.ai Code (main agent)
Task: اعمال ۴ تغییر درخواستی کاربر روی نسخهٔ ۲٫۳ (فیلتر شامل‌بودن + «≠» و حفظ فوکوس · بازطراحی جدول خام · بازطراحی گزارش ستاپ‌ها با پنل ترتیب ستون‌ها · داشبورد حرفه‌ای ECharts لوکال)

Work Log:
- کاوش کامل فایل‌های مرتبط (cutrolls/rolls/setup/dashboard/ui/config/index.html/style.css) و ارائهٔ لیست کامل ۴ تغییر قبل از اجرا
- کامپوننت مشترک UI.filterTable در ui.js (اساس هر ۳ جدول — بدون UI موازی): فیلتر «شامل بودن» برای اعداد و متن‌ها (نه تطابق دقیق) + نرمال‌سازی ارقام فارسی/عربی/جداکننده‌ها روی needle و haystack + tokens هر ستون (نمایش فارسی + مقدار خام + وزن نقطه‌ای/خام) + دکمهٔ کوچک «≠» کنار هر باکس (سوییچ «شامل نشود» با حالت کهربایی on) + حفظ فوکوس/ caret (ورودی فیلتر فقط tbody را رندر مجدد می‌کند — سرستون/باکس‌ها دست‌نخورده) + debounce 180ms + پاک‌کردن همه + چیپ وضعیت «N از M» + ردیف فیلتر چسبان + ارتفاع visibleRows×rowHeight
- UI.orderPanel (مولفهٔ مشترک پنل ترتیب ستون‌ها): چیپ‌های کشیدنی + ↑/↓ + حذف بدون جهت مرتب‌سازی
- تغییر ۱ (برش‌خورده‌ها): بازنویسی cutrolls.js با کامپوننت مشترک؛ stats chips حفظ؛ ۱۱ ستون با tokens کامل (count فارسی/لاتین + وزن dot/raw/floor)
- تغییر ۲ (رول‌های خام): دکمهٔ roll-sort-toggle + ماندگاری rawSortPanelVisible (appSettings)؛ حذف صفحه‌بندی؛ جدول بلند ۵۰×42px؛ ستون‌های عرض/شماره ستاپ با کلاس em-cell (بولد ۷۰۰ / 16px)؛ tokens شامل وضعیت متنی و «بدون قانون»؛ اتصال دکمهٔ جزئیات گروه از onRendered
- تغییر ۳ (گزارش ستاپ‌ها): انتقال پنل جدول به ابتدای view-setup (فرم ثبت/ثبت گروهی زیر آن)؛ دکمه‌های setup-sort-toggle و setup-cols-toggle (ماندگاری setupSortPanelVisible/setupColsPanelVisible)؛ پنل «ترتیب ستون‌ها» با UI.orderPanel + ماندگاری setupColumnOrder + بازنشانی؛ حذف کامل initFilterBar/FILTER_FIELDS/rowMatchesFilter/filterRows/updateFilterStatus و HTML نوار فیلتر قدیمی؛ reportColumns() رجیستری ۱۳ ستون (ستاپ/عرض em-cell؛ actions بدون فیلتر)؛ ارتفاع ۵۰×56px؛ rowHeight=56 برای ردیف‌های الگو-دار
- تغییر ۴ (داشبورد): دانلود Apache ECharts 5.5.1 به lib/echarts.min.js (۱٫۰MB لوکال — بدون CDN) + تگ اسکریپت؛ موتور چارت Dashboard (chartOf/applyChart/disposeChart/rerenderCharts/onShown) با رجیستری نمونه‌ها؛ پالت تم‌آگاه (chartPalette — روشن/تاریک از data-theme) + MutationObserver برای رندر مجدد هنگام تعویض تم + resize دیبانس؛ نمودار میله‌ای گروهی افقی (ستاپ/تولیدشده × دستگاه ۱-۳) با Tooltip فارسی (faDuration + ساعت) + برچسب ساعت محور + Legend؛ نمودار دوناتی جدید وضعیت گروه‌های خام (دارای ستاپ/بدون ستاپ/غیرقابل تطبیق) با متن مرکزی «N گروه»؛ Fallback کامل به میله‌های CSS قبلی و چیپ‌های متنی در نبود echarts؛ حالت خالی با disposeChart؛ هوک dashboard در viewHooks برای رندر پس از نمایان شدن تب؛ HTML جدید dash-charts-grid (2fr/1fr → 1 ستون در 1080px)
- CSS نسخهٔ ۲٫۳: ft-filter-box/ft-invert (26px، حالت on کهربایی، focus-visible) · em-cell (700/1rem) · cols-builder/order-chip فیروزه‌ای · dash-charts-grid/echart-box (330px→270px موبایل) · پالایش KPI (نوار گرادیانی 4px + هالهٔ radial + گرادیان کارت + hover 5px)
- config: RAW_VISIBLE_ROWS=50 · SETUP_VISIBLE_ROWS=50 · SETUP_DEFAULT_COLUMN_ORDER (۱۳ کلید)
- app.js: هوک dashboard در viewHooks

تست‌ها:
- تست منطقی Bun (۲۲ سناریو، همه پاس): نرمال‌سازی (۸۰۰→800، ۱٬۲۰۰→1200، 2,316→2316، lowercase) · شامل‌بودن اعداد (80↔800/1740، ۸۰۰ فارسی) · وزن (2316، 2.316، ۳۱۶) · متن (ستاپ) · invert هر دو جهت · الگو/گرید case-insensitive · فیلتر خالی
- E2E مرورگر کامل (agent-browser — مستقیم روی /roll-monitor/):
  * ایمپورت هر دو فایل نمونه (۹۹ رکورد با مودال جایگزینی) + بازیابی دیتاست پس از تست برش‌خورده
  * قوانین: ضخامت ۲۰ و ۲۵ → استاندارد ۲۰۰۰۰؛ قانون زمان دستگاه۱ (۷→۱۰۲ دقیقه) و دستگاه۲ (۵→۱۴۴)
  * ستاپ‌ها: 40/1/1740/الگو 800-940/۵ رول + 41/2/2260/780-800-680/۳ رول → زمان‌ها دقیق: ۹۴۲=۵۱۰+۴۳۲ دقیقه (۱۵:۴۲) و ۲۰۴ دقیقه (۳:۲۴)
  * جدول ستاپ: ۱۳ ستون + ۱۲ فیلتر + ۱۲ «≠» + em-cell×4 + ارتفاع 50×56 + ۱۳ چیپ ترتیب؛ جابه‌جایی ستون «عرض» با ↑ و با drag (هر دو) + بازنشانی + ماندگاری پس از reload؛ فیلتر ستاپ=40 (شامل) → فقط 40؛ «≠» → فقط 41؛ toggle هر دو پنل (مخفی/نمایان)
  * جدول خام: ۷ ستون + ۶ فیلتر + ۶ «≠» + em-cell (700/16px) + ارتفاع 50×42 (2100px)؛ فیلتر عرض «17» → 1740+1760؛ «174» → فقط 1740؛ فوکوس + caret (selectionStart=3) حفظ؛ دکمه جزئیات گروه → مودال با ۱۲ چیپ ستون
  * جدول برش‌خورده: ۵ رکورد از الگوها؛ موجود 4/وزن 1.158 و 1/340 با فایل تست برش‌خورده؛ گریدها ۱/۱/۱/۱ (289)؛ پای کار 2 (579)؛ پالت 3 (868)؛ فیلتر وزن «1158» → رکورد 800؛ xCount=1 → دو ردیف؛ «≠» → سه ردیف صفر
  * داشبورد: هر دو چارت canvas رندر؛ KPI ۹۹/۱۶ ساعت/۳ ساعت؛ chips/footer جمع‌ها؛ تم تاریک (رندر مجدد چارت‌ها + قابل‌خواندن)؛ موبایل 390px (KPI استک + چارت)؛ VLM تأیید دسکتاپ/موبایل/تاریک
  * فوتر: چسبیده به پایین viewport در محتوای کوتاه (gap=0) و رانده‌شده طبیعی در بلند
  * مودال Audit/ویرایش جدول ستاپ از onRendered (هر دو کارکرد)؛ صفحهٔ راهنما
  * کنسول/errors/dev.log بدون خطا؛ lint پاس
- همگام‌سازی public/roll-monitor + بازسازی ZIP (۳۱ فایل، 2.6MB) + README نسخهٔ ۲٫۳

Stage Summary:
- هر ۴ تغییر در UI و منطق verify شد: شامل‌بودن اعداد/متن + «≠» + حفظ فوکوس در هر ۳ جدول؛ جدول خام/گزارش ستاپ دقیقاً مانند برش‌خورده‌ها؛ ترتیب ستون‌ها (drag + ↑/↓ + بازنشانی + ماندگاری)؛ داشبورد ECharts لوکال با ۲ نمودار + پشتیبانی دو تم
- معماری: کامپوننت مشترک UI.filterTable/UI.orderPanel (بدون UI موازی)؛ بدون تغییر Schema؛ ۴ کلید appSettings جدید (rawSortPanelVisible/setupSortPanelVisible/setupColsPanelVisible/setupColumnOrder) → Backup خودکار پوشش می‌دهد
- ECharts 5.5.1 کاملاً لوکال (lib/echarts.min.js) با Fallback CSS — برنامه همچنان ۱۰۰٪ آفلاین
- نکتهٔ تست: توصیف VLM روی اسکرین‌شات جدول‌های متراکم نامعتبر بود (توهم) — صحت‌سنجی با snapshot دسترس‌پذیری + محاسبهٔ استایل DOM انجام شد

---
Task ID: 8
Agent: Z.ai Code (main agent)
Task: اعمال ۱۰ تغییر درخواستی کاربر روی نسخهٔ ۲٫۳ (پنل عرض ستون‌ها + فرمت [H]:mm + ارتفاع داینامیک ۳ جدول + تاریخ شمسی Backup + Bulk بدون تجمیع + داشبورد موجودی/دو دونات/نمودار ستونی)

Work Log:
- تأیید نسخهٔ ۲٫۳ (README/style.css/index.html) قبل از شروع طبق شرط کاربر
- دانلود مرجع‌ها: Chart 1.png (تصویر نمودار مطلوب) + RollMonitor-Backup-2026-09-08.json (۱۷MB دیتای واقعی: ۵۱ ستاپ/۳۲۲۱ رول/۹۲۳۰ آرشیو/۹ قانون زمان)
- تحلیل VLM تصویر مرجع → نتیجه: همان نمودار میله‌ای افقی گروهی فعلی (ECharts) + فوتر «جمع کل» — نمودار حفظ و فقط فوتر + ساختار زیر آن تغییر کرد
- تغییر ۱ (پنل عرض ستون‌ها): UI.orderPanel بازنویسی — حذف فلش‌های ↑/↓، باکس عددی «px» با label داخل هر چیپ + debounce ۳۲۰ms؛ config.SETUP_DEFAULT_COLUMN_WIDTHS (۱۳ مقدار)؛ state SetupView.columnWidths (appSettings: setupColumnWidths)؛ reportColumns با col.width → UI.filterTable با colgroup + table-layout:fixed (کلاس fixed-cols)؛ بازنشانی = ترتیب + عرض‌ها
- تغییر ۲ (rename + [H]:mm): U.faHMM جدید (۴۸۷ دقیقه → «۴۸۷:۴۲»، دقیقه دو رقمی با U.toFaDigits جدید)؛ ستون «مانده زمان تولید شده» → «مانده زمان موجودی» (رجیستری + SETUP_SORTABLE_FIELDS + چیپ‌ها + Audit + راهنما + calc.js هشدارها)؛ هر دو ستون زمان با title=facet verbose و نمایش [H]:mm
- تغییر ۳/۴/۵ (ارتفاع داینامیک): UI.filterTable باکس «ردیف‌های قابل نمایش» در نوار پایین (min ۵ / max ۵۰۰ از config) — فقط استایل ارتفاع .cut-table-scroll به‌روز می‌شود (فوکوس/فیلترها دست‌نخورده)؛ ماندگاری: setupVisibleRows/cutVisibleRows/rawVisibleRows؛ ستون‌های عرض/ستاپ برش‌خورده‌ها em-cell (۷۰۰/۱۶px)
- تغییر ۶ (تاریخ شمسی): U.jalaliFileStamp با Intl 'en-u-ca-persian' → RollMonitor-Backup-1405-06-17.json (تست node + مرورگر)
- تغییر ۷ (Bulk بدون تجمیع): حذف ادغام داخل parseBulkText + حذف aggregate سراسری buildBulkDraft — هر گروه (مادر+الگو) رکورد جداگانهٔ پیش‌نمایش؛ validateBulkDraft با dbKeys/batchKeys → پیغام خطای دقیق تکراری: «در همین Batch تکراری است» یا «قبلاً در پایگاه‌داده ثبت شده است» + راهنمای اصلاح
- تغییر ۸ (واژگان): همهٔ «تولید شده» → «موجودی» در dashboard.js (legend/چیپ/fallback/KPI) + index.html (عنوان کارت + توضیحات پنل) + calc.js + settings.js + راهنما
- تغییر ۹ (آمار دوخطی + دونات‌ها): فوتر mt-stats دوخطی — خط ۱: دستگاه کمترین مانده زمان (کriterion=موجودی) + U.faDaysOf (روز ۲۴ ساعته، یک اعشار)؛ خط ۲: میانگین = جمع÷۳؛ renderTimeDonuts جدید با timeDonutOption — دو دونات موجودی/ستاپ (۳ سگمنت MACHINE_COLORS) + متن مرکزی دوخطی «کمترین/میانگین» با graphic center؛ حذف کامل renderRawStatusChart + پنل HTML آن
- تغییر ۱۰ (نمودار ستونی): renderSetupInventoryColumnChart — هر رکورد گزارش ستاپ یک ستون (مرتب setupNumber→دستگاه→عرض)؛ مقدار remainingProducedTime||0 (حتی ستاپ‌های بدون رول خام = ۰)؛ Tooltip با جزئیات + برچسب [H]:mm
- HTML/CSS: dash-charts-grid جدید (پنل میله‌ای تمام‌عرض + دو دونات هم‌عرض + پنل ستونی زیر همه)؛ echart-box donut-box 320px / col-box 400px؛ استایل‌های ft-rows/order-width/fixed-cols/time-cell/mt-stats؛ فوتر نسخهٔ ۲٫۴
- تست E2E (agent-browser مستقیم روی /roll-monitor/):
  * بازیابی Backup واقعی (۵۱/۳۲۲۱/۹۲۳۰ + مودال تأیید)
  * داشبورد: جمع‌ها دقیق = مثال کاربر (ستاپ ۴۸۷:۴۲ / موجودی ۶۲:۴۲)؛ آمار دوخطی: دستگاه ۱ (۱:۳۰/۰٫۱ روز + ۲۶۲:۱۲/۱۰٫۹ روز) + میانگین (۲۰:۵۴/۰٫۹ + ۱۶۲:۳۴/۶٫۸)؛ هر ۴ چارت canvas رندر؛ مرکز دونات از getOption: «کمترین: ۱:۳۰ / میانگین: ۲۰:۵۴»؛ ستونی: ۵۱ ستون (۶ غیرصفر + ۴۵ صفر)
  * جدول ستاپ: ۱۳ باکس عرض با پیش‌فرض (۸۴/۸۴/۹۶/…)؛ تغییر 84→200 → col width:200px + ماندگاری؛ تعداد ردیف 20→calc(1120px)؛ فیلتر «40» → ۳ از ۵۱ + فوکوس/caret حفظ
  * برش‌خورده‌ها: rows=30 → calc(1260px)؛ em-cell ۷۰۰/16px (72 سلول)؛ خام: rows=15 → calc(630px)
  * Backup: نام RollMonitor-Backup-1405-06-17.json
  * Bulk: ۳ ردیف جدا (1180×3 بدون تجمیع)؛ خطای تکراری Batch (ردیف ۳) → تغییر دستگاه به 2 → commit ۳ رکورد (۵۴ کل) → پاک‌سازی تست؛ خطای DB-duplicate با پیغام «قبلاً در پایگاه‌داده»
  * ماندگاری پس از reload (عرض ۲۰۰ + cutRows 30 + rawRows 15) → ریست به پیش‌فرض
  * موبایل 390px (KPI/چارت‌ها استک، بدون overflow) + تم تاریک (چارت‌ها خوانا) + ریست تم
  * VLM تأیید بصری: پنل عرض با باکس‌های px بدون فلش؛ دونات‌ها با متن مرکزی دوخطی وسط‌چین؛ ستونی با اکثراً ستون‌های صفر؛ موبایل/تاریک سالم
  * iframe صفحهٔ / هم verify (KPI ۶۳ + هر ۳ چارت جدید داخل فریم)
  * کنسول/خطاها/dev.log پاک؛ lint پاس؛ ZIP ۳۱ فایل بازسازی؛ README نسخهٔ ۲٫۴

Stage Summary:
- هر ۱۰ تغییر با دیتای واقعی Backup کاربر verify شد؛ اعداد داشبورد دقیقاً منطبق بر مثال‌های پیام کاربر (۴۸۷:۴۲ / ۶۲:۴۲)
- معماری حفظ شد: کامپوننت مشترک UI.filterTable/orderPanel توسعه یافت (rowsControl + width + colgroup)؛ بدون Schema change؛ ۴ کلید appSettings جدید (setupColumnWidths/setupVisibleRows/cutVisibleRows/rawVisibleRows)
- تصمیم‌های مستندشده: criterion «کمترین مانده زمان» = موجودی (برچسب شفاف)؛ میانگین = جمع÷۳ دستگاه؛ روز = ۲۴ ساعت با یک اعشار؛ هر گروه Bulk حتی با کلید یکسان رکورد جدا (تکراری نهایی → رد با پیغام تفکیک‌شده)
- برنامه همچنان ۱۰۰٪ آفلاین؛ پیش‌نمایش زنده از / (iframe) + ZIP به‌روز

---
Task ID: 9
Agent: Z.ai Code (main agent)
Task: اعمال ۴ تغییر درخواستی کاربر روی نسخهٔ ۲٫۴ (→ ۲٫۵): فرمول جدید مانده زمان موجودی + Wrap Text هدر/باکس فیلتر + راست‌به‌چپ نمودار میله‌ای/رنگ دستگاه ۳/مرکز دقیق دونات + یک میله برای هر ستاپ

Work Log:
- تأیید نسخهٔ ۲٫۴ موجود (README/index.html footer/worklog Task 8) قبل از شروع طبق شرط کاربر
- تغییر ۱ (فرمول): calc.js — remainingProducedTime = durationMin × Math.max(0, rollCount − metallized) (پیش‌تر: × rawExisting) + فیلد remainingInventoryCount؛ به‌روزرسانی همهٔ متون: Audit مودال setup.js (۱۸۰ × (۱۰ − ۳) = ۲۱:۰۰) + KPI meta dashboard.js (تفاوت = زمان رول‌های متالایزشده) + fallback legendها + index.html (KPI desc/panel desc/راهنما)
- تغییر ۲ (Wrap Text + باکس فیلتر): ui.js — جابه‌جایی DOM (آیکون «≠» اول = سمت راست در RTL) + syncHeadHeight با متغیر CSS --ft-head-h و ResizeObserver (disconnect نمونهٔ قبلی با wrap._ftHeadRO)؛ style.css — سرستون white-space:normal + overflow-wrap:anywhere + min-height:38 + ردیف فیلتر چسبان top:var(--ft-head-h)؛ ft-invert ۲۰px/svg ۱۱px؛ cut-filter-input min-width:0 → هم‌عرض ستون
- تغییر ۳ (داشبورد): dashboard.js — machine-time-chart: yAxis position:'right' + xAxis inverse + label position:'left' + borderRadius [4,0,0,4] + grid left 56؛ دونات‌ها: center ['50%','50%'] + radius ['54%','74%'] + graphic top:'middle' + مخفی‌کردن برچسب صفر + legend bottom 2؛ config.js — MACHINE_COLORS[3] = '#9FEDFF'
- تغییر ۴ (نمودار ستونی): dashboard.js renderSetupInventoryColumnChart بازنویسی — گروه‌بندی بر اساس setupNumber (Map) + مجموع remainingProducedTime رکوردهای همان ستاپ + Tooltip جزئیات هر رکورد (دستگاه/عرض/تعداد/متالایز + شمارش بدون قانون) + Fallback گروهی
- رفع باگ کشف‌شده در تست موبایل: dash-charts-grid در media queryها 1fr (min-content) بود → deadlock سرریز هنگام کوچک‌شدن دسکتاپ→موبایل (canvas عرض ثابت)؛ fix: minmax(0,1fr) در هر دو media + .dash-charts-grid > * { min-width: 0 }
- نسخهٔ ۲٫۵: footer index.html + README (بخش تغییرات کامل) + بنر style.css
- همگام‌سازی public/roll-monitor + بازسازی ZIP (۳۱ فایل) + lint پاس

تست E2E (agent-browser مستقیم روی /roll-monitor/index.html + iframe صفحهٔ /):
- Seed کنسولی: قانون متراژ 20→20000 + قوانین زمان (م1=180/م2=144/م3=120 دقیقه) + ۳ ستاپ (50@م1×10، 50@م2×5، 51@م3×6 — ستاپ 50 عمداً دو رکورد) + ۶ رول متالایز آرشیوی (3+1+2)
- فرمول: (10−3)×180=1260 · (5−1)×144=576 · (6−2)×120=480 · جمع 2316=۳۸:۳۶ دقیق؛ machineTime [1260,576,480]؛ KPI ۵۴/۳۹ ساعت + تفاوت ۱۵:۲۴ (زمان متالایزشده)؛ Audit: «۱۸۰ × (۱۰ − ۳) = ۲۱:۰۰»
- Wrap Text: عرض ۵۶px → «مانده زمان موجودی» ۴ خط (۷۵px متن) و «مانده زمان ستاپ» ۳ خط؛ سرستون ۸۸px = ردیف فیلتر چسبان ۸۸px (تطابق دقیق)؛ آیکون ۲۰×۲۰ در راست هر ۱۲ باکس (btnRightOfInput همه true)؛ عرض ورودی ۲۱–۳۴px با ستون؛ boxFitsInTh همه true (هیچ سرریز/نقص)
- چارت میله‌ای: getOption → yAxis position:right + xAxis inverse:true + cats [۳,۲,۱] + label left؛ تأیید بصری VLM کشت‌شده: نام‌ها راست، میله‌ها راست→چپ، دستگاه ۱ بالا، برچسب ساعت نوک میله
- دونات‌ها: colors [#0f766e,#b45309,#9FEDFF] + center [50%,50%] + graphic top middle؛ تحلیل پیکسلی: مرکز متن (304.0,158.5) در برابر مرکز دونات (304.5,160.0) — انحراف ≤۱٫۵px؛ #9FEDFF: ۳٬۹۲۴px روشن + ۵٬۶۶۸px تاریک (رندر مجدد تم تاریک ✓)
- ستونی: ۲ میله برای ۲ ستاپ یکتا [۵۰,۵۱] با مقادیر [1836,480] (مجموع دو رکورد ستاپ 50)؛ VLM تأیید بصری ۲ میله + برچسب مقدار
- آمار دوخطی: دستگاه ۳ کمترین (۸:۰۰ موجودی/۱۲:۰۰ ستاپ) + میانگین (۱۲:۵۲/۱۸:۰۰) ✓
- موبایل 390px: بدون سرریز افقی (scrollW=390) پس از fix؛ تست shrink داینامیک 1440→390 پاس؛ همهٔ چارت‌ها 332px
- فوتر چسبان ✓ · نسخهٔ ۲٫۵ در فوتر ✓ · iframe صفحهٔ / (هر ۴ چارت canvas + KPI ۳۹) ✓ · کنسول بدون خطا · dev.log فقط 200 (+EADDRINUSE قدیمی نامرتبط) · lint پاس

Stage Summary:
- هر ۴ تغییر با سنجهٔ عددی/پیکسلی/DOM verify شد (فرمول دقیق مثال‌ها · انحراف مرکز دونات ≤۱٫۵px · تطابق سرستون/ردیف چسبان px-to-px)
- معماری Single Source of Truth حفظ شد: فرمول فقط در calc.js؛ همهٔ چارت‌ها/KPI/Audit از همان مقدار تغذیه می‌کنند
- باگ موبایل dash-charts-grid (1fr → minmax(0,1fr) + min-width:0) رفع شد — از نسخهٔ ۲٫۳ موجود بود اما در تست VLM قبلی دیده نشده بود
- ZIP/README/public همگام؛ برنامه همچنان ۱۰۰٪ آفلاین (ECharts لوکال)

---
Task ID: 10
Agent: Z.ai Code (main agent)
Task: اعمال ۸ تغییر درخواستی کاربر روی نسخهٔ ۲٫۵ (→ ۲٫۶)

Work Log:
- تأیید وجود نسخهٔ ۲٫۵ (فرمول جدید مانده موجودی + Wrap Text + راست‌به‌چپ چارت میله‌ای + چارت ستونی گروهی + رنگ #9FEDFF + مرکز ۵۰/۵۰) → طبق شرط کاربر، ۸ تغییر جدید روی همان پایه اعمال شد
- تغییر ۱ (Bulk delete): setup.js — ستون «عملیات» + آیکون سطل (data-bulk-del) در هر ردیف پیش‌نمایش؛ removeBulkDraft → splice + رندر مجدد + خلاصه/اعتبارسنجی/Commit؛ guard «حذف همه → Commit غیرفعال»؛ CSS بخش bulk-del-btn
- تغییر ۲ (دونات): config.js MACHINE_COLORS → ۱:#82C836 / ۲:#F09252 / ۳:#00C1EE؛ dashboard.js timeDonutOption — متن مرکزی rich بولد (lbl=۷۰۰/v=۸۰۰) + فونت تطبیقی از ابعاد واقعی بوم (innerR×۰٫۱۶ clamp ۱۰٫۵-۱۳٫۵ + چک عرض متن با حاشیهٔ امن ۱۴px)؛ boxSize از renderTimeDonuts
- تغییر ۳ (کارت‌ها): dashboard.js — statCol/mt-cards جایگزین mt-stats: ستون راست «کمترین مانده زمان موجودی — دستگاه X» + ستون چپ «میانگین دستگاه‌ها» هرکدام با ۲ کارت (موجودی/ستاپ + معادل روزانه)؛ CSS mt-cards/mt-col/mt-card (accent متال/ستاپ)؛ دیتالیبل میله‌ها: fontWeight ۷۰۰ + رنگ تم‌آگاه (#15181c روشن / #e8ebef تاریک)
- تغییر ۴ (tooltip ستونی): فقط «ستاپ X + مانده زمان موجودی» — جزئیات رکوردها/noRuleCount حذف
- تغییر ۵ (وسط‌چین): CSS — .cut-table thead/tbody همه center + cw-cell/pattern-cards/row-actions مرکز (bulk-errors راست ماند)
- تغییر ۶ (پنل ستون‌ها خام/برش): config.js RAW/CUT_DEFAULT_COLUMN_ORDER(+WIDTHS {})؛ rolls.js/cutrolls.js — columnRegistry + renderColumnOrderPanel + applyColsPanelVisibility + reset؛ index.html — raw/cut-cols-toggle/builder/pipeline/reset؛ ماندگاری rawColumnOrder/Widths/Visible + cut معادل
- تغییر ۷ (باکس‌های جمع): ui.js filterTable — opts.sums {key:{type:number|time|pair,weightOf}} → tfoot.ft-sum-row چسبان (sticky bottom) + updateSums در renderBody از visible؛ setup(۶ ستون: تعداد/خام/متالایز/برش‌نشده + ۲ زمانی [H]:mm با skip*) / خام(تعداد) / برش(۹ ستون pair: جمع تعداد+وزن)
- تغییر ۸ (قوانین): index.html — پنل قانون متراژ panel-wide (grid-column 1/-1) → ستون عملیات کامل
- نسخهٔ ۲٫۶: footer + README (changelog کامل) + بنرهای style.css؛ همگام‌سازی public + ZIP ۳۱ فایل + lint پاس

تست E2E (agent-browser روی /roll-monitor/index.html + iframe صفحهٔ /):
- Seed: قانون 20→20000 + قوانین زمان (key 1/2/3-20000: 180/144/120 دقیقه — نکته: قانون زمان نیازمند فیلد key) + ۳ ستاپ + ۶ خام + ۶ برش‌خورده + ۶ متالایز آرشیوی
- محاسبات: mTime [1800/1260, 720/576, 720/480]؛ totSetup=3240 (۵۴:۰۰)؛ totProduced=2316 (۳۸:۳۶)؛ چارت ستونی [1836,480] برای ستاپ‌های [50,51]
- کارت‌ها: راست=«کمترین — دستگاه ۳» (۸:۰۰/۰٫۳ + ۱۲:۰۰/۰٫۵) + چپ=«میانگین» (۱۲:۵۲/۰٫۵ + ۱۸:۰۰/۰٫۸)؛ rtlOrderCheck true
- دونات‌ها: colors [#82C836,#F09252,#00C1EE] هر دو؛ rich [700/12, 800/13.5]؛ center 50/50؛ VLM: متن دقیقاً داخل حفره، بدون تداخل با حلقه، بولد
- Bar labels: #15181c/light + #e8ebef/dark (سوییچ تم live) + weight 700
- Tooltip ستونی: dispatchAction showTip → «ستاپ ۵۰ + مانده زمان موجودی: ۳۰:۳۶» (فقط همین)
- Setup sums: Σ21/6/6/9/54:00/38:36؛ فیلتر ستاپ=50 → Σ15/4/4/7/42:00/30:36 (بازمحاسبه با فیلتر)؛ head/body center؛ tfoot sticky
- Bulk: ۴ ردیف + ۴ دکمهٔ حذف؛ حذف index1 → [1880,1930,1960] + خلاصه ۳؛ حذف همه → Commit disabled
- خام: ۷ چیپ + ۷ باکس عرض؛ Σ10 → فیلتر count=2 → Σ2؛ toggle مخفی/نمایش + ماندگاری (false→true)
- برش: ۱۱ چیپ + ۱۱ باکس عرض؛ ۹ باکس pair؛ uncut Σ27 + Σ7.551 (وزن ۷۵۵۰٫۵۲)؛ عرض 150 → fixed-cols+colgroup 150px+ذخیره؛ reorder → «پالت شده» اول؛ reset → «عرض»
- قوانین: grid-column 1/-1 + tableFits true + VLM: عملیات کامل
- موبایل 390px: scrollW=390 بدون overflow؛ mt-cards تک‌ستونه (332px)؛ VLM تم تاریک: کارت‌ها/لیبل‌ها خوانا
- iframe صفحهٔ /: ۴ canvas + فوتر ۲٫۶؛ ZIP: ۳۱ فایل + نسخهٔ ۲٫۶ + رنگ‌های جدید داخل zip
- کنسول بدون خطا؛ dev.log فقط 200؛ lint پاس؛ دیتای تست پاک‌سازی شد

Stage Summary:
- هر ۸ تغییر با سنجهٔ عددی/DOM/پیکسلی verify شد (فرمول جمع‌ها دقیق: ۲۱/۶/۶/۹/۵۴:۰۰/۳۸:۳۶ — ۲۷/۷۵۵۰٫۵۲ — ۱۵/۴۲:۰۰ بعد فیلتر)
- معماری مشترک حفظ شد: tfoot/sums داخل UI.filterTable (هر ۳ جدول رایگان)؛ رجیستری ستون‌ها الگوی setup تعمیم یافت؛ ۶ کلید appSettings جدید (raw/cutColumnOrder/Widths/ColsPanelVisible)
- رنگ‌های جدید MACHINE_COLORS فقط دونات‌ها (تأیید usage)؛ فونت مرکز دونات تطبیقی و هرگز سرریز
- ZIP/public/README همگام؛ برنامه همچنان ۱۰۰٪ آفلاین
