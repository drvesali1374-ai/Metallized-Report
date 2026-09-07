import { Button } from "@/components/ui/button";
import {
  Download,
  Factory,
  FileSpreadsheet,
  FolderDown,
  MonitorSmartphone,
  ShieldCheck,
} from "lucide-react";

export const metadata = {
  title: "مانیتورینگ صنعتی رول‌ها | اپلیکیشن آفلاین",
  description:
    "وب‌اپلیکیشن کاملاً آفلاین مانیتورینگ صنعتی رول‌ها — بدون سرور، بدون نصب، بدون اینترنت",
};

export default function Home() {
  return (
    <div
      dir="rtl"
      className="flex min-h-screen flex-col bg-background text-foreground"
      style={{ fontFamily: "Tahoma, 'Segoe UI', sans-serif" }}
    >
      {/* نوار بالای صفحه پیش‌نمایش */}
      <header className="border-b bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-500">
              <Factory className="size-5" />
            </span>
            <div>
              <h1 className="text-sm font-bold leading-5">
                مانیتورینگ صنعتی رول‌ها
              </h1>
              <p className="text-xs text-muted-foreground">
                نسخهٔ آفلاین — پیش‌نمایش زنده در کادر پایین
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-500">
              <ShieldCheck className="size-3.5" />
              بدون سرور · بدون ارسال داده
            </span>
            <Button asChild size="sm" variant="default" className="bg-emerald-600 text-white hover:bg-emerald-500">
              <a href="/roll-monitor.zip" download>
                <Download className="size-4" />
                دانلود پروژهٔ کامل (ZIP)
              </a>
            </Button>
          </div>
        </div>
      </header>

      {/* پیش‌نمایش زندهٔ خود اپلیکیشن آفلاین */}
      <main className="flex flex-1 flex-col">
        <div className="relative flex-1">
          <iframe
            src="/roll-monitor/index.html"
            title="پیش‌نمایش اپلیکیشن مانیتورینگ صنعتی رول‌ها"
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>

        {/* راهنمای سریع زیر پیش‌نمایش */}
        <section className="border-t bg-card">
          <div className="mx-auto grid max-w-[1400px] gap-3 px-4 py-4 sm:grid-cols-3">
            <div className="flex items-start gap-3 rounded-xl border bg-background p-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-500/15 text-teal-500">
                <MonitorSmartphone className="size-4" />
              </span>
              <div className="text-xs leading-6 text-muted-foreground">
                <b className="text-foreground">۱ — استفادهٔ آفلاین:</b> فایل ZIP را
                دانلود و استخراج کنید، سپس روی{" "}
                <code className="rounded bg-muted px-1">index.html</code>{" "}
                دابل‌کلیک کنید. همین پیش‌نمایش، خود آن برنامه است.
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border bg-background p-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-500">
                <FileSpreadsheet className="size-4" />
              </span>
              <div className="text-xs leading-6 text-muted-foreground">
                <b className="text-foreground">۲ — فایل‌های نمونهٔ اکسل:</b>{" "}
                برای آزمایش ایمپورت می‌توانید از{" "}
                <a
                  className="font-medium text-emerald-500 underline underline-offset-4"
                  href="/samples/rolls.xlsx"
                  download
                >
                  rolls.xlsx
                </a>{" "}
                و{" "}
                <a
                  className="font-medium text-emerald-500 underline underline-offset-4"
                  href="/samples/Archived%20Rolls.xlsx"
                  download
                >
                  Archived Rolls.xlsx
                </a>{" "}
                استفاده کنید.
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border bg-background p-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-rose-500/15 text-rose-500">
                <FolderDown className="size-4" />
              </span>
              <div className="text-xs leading-6 text-muted-foreground">
                <b className="text-foreground">۳ — داخل ZIP چه هست؟</b>{" "}
                <code className="rounded bg-muted px-1">index.html</code> +{" "}
                <code className="rounded bg-muted px-1">app.js</code> +{" "}
                <code className="rounded bg-muted px-1">style.css</code> + پوشهٔ{" "}
                <code className="rounded bg-muted px-1">lib/</code> شامل
                SheetJS، Dexie و فونت وزیرمتن — همه لوکال و آمادهٔ اجرا.
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-auto border-t bg-card px-4 py-3 text-center text-[11px] text-muted-foreground">
        داده‌ها فقط در مرورگر شما (IndexedDB) ذخیره می‌شوند — هیچ درخواستی به
        اینترنت ارسال نمی‌شود.
      </footer>
    </div>
  );
}
