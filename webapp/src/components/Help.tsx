
import React from 'react';
import { HelpCircle, Book, Layers, Shield, Clock } from 'lucide-react';

const Help: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="text-center">
        <HelpCircle size={48} className="mx-auto text-blue-400 mb-4" />
        <h1 className="text-4xl font-black mb-2">مرکز راهنمایی</h1>
        <p className="text-white/50">هر آنچه برای شروع کار با سیستم نیاز دارید</p>
      </header>

      <div className="space-y-6">
        <section className="glass p-8 rounded-3xl">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
            <Book className="text-blue-400" /> آشنایی با نقش‌ها
          </h2>
          <p className="text-sm text-white/70 leading-relaxed mb-4">
            سیستم دارای دو نقش سیستمی ادمین و کاربر است. نقش‌های عملیاتی (درخواست‌دهنده و انجام‌دهنده) به صورت پویا در هر وظیفه تعیین می‌شوند.
          </p>
          <ul className="space-y-2 text-xs text-white/60 list-disc list-inside">
            <li>ادمین: مدیریت کامل سیستم، کاربران و تنظیمات.</li>
            <li>درخواست‌دهنده: شخصی که وظیفه را ایجاد می‌کند.</li>
            <li>انجام‌دهنده: شخصی که مسئول اجرای وظیفه است.</li>
          </ul>
        </section>

        <section className="glass p-8 rounded-3xl">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
            <Layers className="text-emerald-400" /> درخواست‌های گردشی (Multi-stage)
          </h2>
          <p className="text-sm text-white/70 leading-relaxed">
            در این نوع درخواست، شما می‌توانید چندین "ایستگاه" تعریف کنید. هر ایستگاه انجام‌دهنده و مهلت مختص خود را دارد. با تایید هر ایستگاه، وظیفه به صورت خودکار به کارتابل نفر بعدی منتقل می‌شود.
          </p>
        </section>

        <section className="glass p-8 rounded-3xl">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
            <Clock className="text-purple-400" /> مهلت و زمان‌بندی
          </h2>
          <p className="text-sm text-white/70 leading-relaxed">
            تمام زمان‌های سیستم بر اساس منطقه زمانی تهران (UTC+03:30) و تقویم شمسی محاسبه و نمایش داده می‌شوند. مهلت‌ها بر اساس تعداد روز وارد شده از لحظه ثبت محاسبه می‌گردند.
          </p>
        </section>

        <section className="glass p-8 rounded-3xl border-orange-500/20">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
            <Shield className="text-orange-400" /> امنیت و حریم خصوصی
          </h2>
          <p className="text-sm text-white/70 leading-relaxed">
            درخواست‌دهندگان می‌توانند بازدیدهای انجام‌دهنده از سیستم را مشاهده کنند. همچنین تغییر رمز عبور در اولین ورود برای حفظ امنیت الزامی است.
          </p>
        </section>
      </div>
    </div>
  );
};

export default Help;
