
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { 
  Palette, User, Save, Check, Globe, 
  Image as ImageIcon, Trash2, FileText, Plus, X,
  ChevronDown, ChevronUp, Lock, Brush, LayoutTemplate, Settings2
} from 'lucide-react';
import { AppTheme } from '../types';

// ============================================================
// ACCORDION SECTION COMPONENT
// Each section can be expanded/collapsed independently
// ============================================================
interface AccordionSectionProps {
  title: string;
  icon: React.ReactNode;
  iconColor?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const AccordionSection: React.FC<AccordionSectionProps> = ({ 
  title, icon, iconColor = 'text-blue-400', children, defaultOpen = false 
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="glass border border-white/10 rounded-2xl overflow-hidden shadow-lg">
      {/* Header - clickable to toggle */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors text-right"
      >
        <div className="flex items-center gap-3">
          <span className={iconColor}>{icon}</span>
          <span className="font-black text-sm">{title}</span>
        </div>
        <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
          <ChevronDown size={18} className="text-white/40" />
        </div>
      </button>

      {/* Content - slides open/closed */}
      <div
        className={`transition-all duration-300 overflow-hidden ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="p-5 pt-0 border-t border-white/5">
          {children}
        </div>
      </div>
    </div>
  );
};

const Settings: React.FC = () => {
  const { currentUser, updateUser, currentTheme, setTheme, systemSettings, updateSettings, addLetterhead, removeLetterhead } = useStore();
  const [fullName, setFullName] = useState(currentUser?.fullName || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showSaved, setShowSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [appName, setAppName] = useState(systemSettings.appName);
  const [passwordError, setPasswordError] = useState('');

  const [showLhModal, setShowLhModal] = useState(false);
  const [newLhName, setNewLhName] = useState('');
  const [newLhImg, setNewLhImg] = useState('');

  const isAdmin = currentUser?.role === 'ADMIN';

  const showSuccess = (msg: string) => {
    setSaveMessage(msg);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 3000);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setPasswordError('');

    if (password && password !== confirmPassword) {
      setPasswordError('رمز عبور و تکرار آن یکسان نیستند.');
      return;
    }

    updateUser({ ...currentUser, fullName, password: password || currentUser.password });
    setPassword('');
    setConfirmPassword('');
    showSuccess('اطلاعات حساب کاربری بروزرسانی شد.');
  };

  const handleUpdateBranding = () => {
    updateSettings({ appName });
    showSuccess('تنظیمات برندینگ بروزرسانی شد.');
  };

  const handleSaveLetterhead = () => {
    if (!newLhName || !newLhImg) return;
    addLetterhead({ name: newLhName, imageUrl: newLhImg });
    setNewLhName('');
    setNewLhImg('');
    setShowLhModal(false);
    showSuccess('سربرگ جدید اضافه شد.');
  };

  const themes: { id: AppTheme, label: string, color: string, gradient: string }[] = [
    { id: 'dark', label: 'تاریک', color: 'bg-slate-900', gradient: 'from-slate-800 to-slate-900' },
    { id: 'blue', label: 'آبی', color: 'bg-blue-900', gradient: 'from-blue-700 to-blue-900' },
    { id: 'green', label: 'سبز', color: 'bg-emerald-900', gradient: 'from-emerald-700 to-emerald-900' },
    { id: 'purple', label: 'بنفش', color: 'bg-purple-900', gradient: 'from-purple-700 to-purple-900' },
    { id: 'light', label: 'روشن', color: 'bg-gray-400', gradient: 'from-gray-200 to-gray-400' },
    { id: 'wood', label: 'چوبی', color: 'bg-[#5D4037]', gradient: 'from-[#795548] to-[#3E2723]' },
    { id: 'pink', label: 'صورتی', color: 'bg-[#C2185B]', gradient: 'from-[#E91E63] to-[#880E4F]' },
    { id: 'teal', label: 'کله‌غازی', color: 'bg-[#004D40]', gradient: 'from-[#009688] to-[#004D40]' },
    { id: 'sky', label: 'آسمانی', color: 'bg-[#0D47A1]', gradient: 'from-[#1565C0] to-[#0D47A1]' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <header className="pb-2">
        <h1 className="text-3xl font-black mb-2 flex items-center gap-3">
          <Settings2 className="text-blue-400" size={32} />
          تنظیمات و پیکربندی
        </h1>
        <p className="text-white/40 text-sm">شخصی‌سازی ظاهر و تنظیمات مدیریتی سیستم</p>
      </header>

      {/* Success notification */}
      {showSaved && (
        <div className="flex items-center gap-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-5 py-3 rounded-2xl text-sm font-bold animate-in fade-in slide-in-from-top-2">
          <Check size={18} />
          {saveMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ========= Left Column: Accordion Sections ========= */}
        <div className="lg:col-span-2 space-y-4">

          {/* Section 1: User Account */}
          <AccordionSection 
            title="حساب کاربری من" 
            icon={<User size={20} />}
            iconColor="text-blue-400"
            defaultOpen={true}
          >
            <form onSubmit={handleUpdate} className="space-y-5 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-white/50">نام کامل نمایشی</label>
                  <input 
                    value={fullName} 
                    onChange={e => setFullName(e.target.value)} 
                    className="w-full glass bg-white/5 border border-white/10 p-3 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" 
                    placeholder="نام و نام خانوادگی"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-white/50">نام کاربری (غیرقابل تغییر)</label>
                  <input 
                    value={currentUser?.username || ''} 
                    disabled
                    className="w-full glass bg-white/3 border border-white/5 p-3 rounded-xl font-bold text-sm text-white/30 cursor-not-allowed" 
                  />
                </div>
              </div>

              <div className="border-t border-white/5 pt-4 space-y-1.5">
                <label className="text-xs font-bold text-white/50 flex items-center gap-2"><Lock size={12} /> تغییر رمز عبور (اختیاری)</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input 
                    type="password" 
                    placeholder="رمز عبور جدید..." 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    className="w-full glass bg-white/5 border border-white/10 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" 
                  />
                  <input 
                    type="password" 
                    placeholder="تکرار رمز عبور جدید..." 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    className="w-full glass bg-white/5 border border-white/10 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" 
                  />
                </div>
                {passwordError && (
                  <p className="text-red-400 text-xs font-bold mt-1">{passwordError}</p>
                )}
              </div>

              <button 
                type="submit" 
                className="metallic-btn bg-blue-600 px-8 py-3 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-blue-500 transition-all active:scale-95"
              >
                <Save size={16} /> ذخیره تغییرات
              </button>
            </form>
          </AccordionSection>

          {/* Section 2: Branding (Admin only) */}
          {isAdmin && (
            <AccordionSection
              title="پیکربندی برندینگ"
              icon={<Globe size={20} />}
              iconColor="text-indigo-400"
              defaultOpen={false}
            >
              <div className="space-y-5 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-white/50">نام اتوماسیون</label>
                    <input 
                      value={appName} 
                      onChange={e => setAppName(e.target.value)} 
                      className="w-full glass bg-white/5 border border-white/10 p-3 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all" 
                      placeholder="مثلاً پن‌تسک" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-white/50">لوگوی اختصاصی</label>
                    <div className="flex gap-3 items-center">
                      <div className="w-14 h-14 glass rounded-xl flex items-center justify-center bg-white/5 border border-white/10 overflow-hidden relative cursor-pointer group hover:bg-white/10 transition-all">
                        {systemSettings.appLogo ? (
                          <img src={systemSettings.appLogo} className="w-full h-full object-contain" alt="logo" />
                        ) : <ImageIcon size={18} className="text-white/20" />}
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if(f) {
                              const reader = new FileReader();
                              reader.onload = () => updateSettings({ appLogo: reader.result as string });
                              reader.readAsDataURL(f);
                            }
                          }} 
                          className="absolute inset-0 opacity-0 cursor-pointer" 
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[8px] text-white font-bold">تغییر</div>
                      </div>
                      <span className="text-[10px] text-white/30">روی تصویر کلیک کنید تا لوگو را عوض کنید</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={handleUpdateBranding} 
                  className="metallic-btn bg-indigo-600 px-8 py-3 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-indigo-500 transition-all active:scale-95"
                >
                  <Save size={16} /> بروزرسانی برندینگ
                </button>
              </div>
            </AccordionSection>
          )}

          {/* Section 3: Letterhead Management (Admin only) */}
          {isAdmin && (
            <AccordionSection
              title="مدیریت سربرگ نامه‌ها"
              icon={<FileText size={20} />}
              iconColor="text-emerald-400"
              defaultOpen={false}
            >
              <div className="space-y-4 pt-4">
                <div className="flex justify-end">
                  <button 
                    onClick={() => setShowLhModal(true)} 
                    className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all active:scale-95"
                  >
                    <Plus size={14}/> ایجاد سربرگ جدید
                  </button>
                </div>

                {systemSettings.letterheads.length === 0 ? (
                  <div className="text-center py-10 text-white/20 text-xs italic border border-dashed border-white/10 rounded-2xl">
                    هنوز سربرگی اضافه نشده است
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {systemSettings.letterheads.map(lh => (
                      <div key={lh.id} className="glass p-3 rounded-2xl bg-white/5 border border-white/5 flex gap-3 items-center group hover:bg-white/10 transition-all">
                        <div className="w-20 h-14 bg-white rounded-xl overflow-hidden shrink-0 flex items-center justify-center border border-white/10">
                          <img src={lh.imageUrl} className="w-full h-full object-contain" alt={lh.name} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black truncate">{lh.name}</p>
                          <p className="text-[10px] text-white/30 mt-0.5">سربرگ نامه</p>
                        </div>
                        <button 
                          onClick={() => removeLetterhead(lh.id)} 
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          title="حذف سربرگ"
                        >
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </AccordionSection>
          )}

          {/* Section 4: Appearance / Theme */}
          <AccordionSection
            title="تم و ظاهر سامانه"
            icon={<Brush size={20} />}
            iconColor="text-purple-400"
            defaultOpen={false}
          >
            <div className="pt-4">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {themes.map(t => (
                  <button 
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all border-2 ${
                      currentTheme === t.id 
                        ? 'border-blue-500 bg-blue-500/10' 
                        : 'border-white/5 hover:bg-white/5 hover:border-white/20'
                    }`}
                    title={t.label}
                  >
                    <div className={`w-9 h-9 rounded-full bg-gradient-to-b ${t.gradient} border border-white/20 shadow-lg flex items-center justify-center`}>
                      {currentTheme === t.id && <Check size={15} className="text-white" />}
                    </div>
                    <span className="text-[10px] font-black w-full text-center leading-tight">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </AccordionSection>

        </div>

        {/* ========= Right Column: Profile Card ========= */}
        <div className="space-y-4">
          {/* Profile Summary Card */}
          <div className="glass p-6 rounded-2xl border border-white/10 shadow-xl text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-3xl font-black text-white shadow-xl">
              {currentUser?.fullName?.charAt(0) || 'U'}
            </div>
            <div>
              <p className="font-black text-base">{currentUser?.fullName}</p>
              <p className="text-white/40 text-xs mt-0.5">{currentUser?.position}</p>
              <p className="text-white/20 text-[10px]">{currentUser?.unit}</p>
            </div>
            <div className="border-t border-white/5 pt-3 space-y-2">
              <div className="flex justify-between text-[10px]">
                <span className="text-white/30">نام کاربری</span>
                <span className="font-bold text-white/60">{currentUser?.username}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-white/30">کد پرسنلی</span>
                <span className="font-bold text-white/60">{currentUser?.personnelCode}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-white/30">نقش</span>
                <span className={`font-black px-2 py-0.5 rounded-full text-[9px] ${currentUser?.role === 'ADMIN' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                  {currentUser?.role === 'ADMIN' ? 'مدیر سیستم' : 'کاربر'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Info Card */}
          <div className="glass p-5 rounded-2xl border border-white/10 shadow-xl space-y-3">
            <h3 className="text-xs font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
              <LayoutTemplate size={12} /> راهنمای سریع
            </h3>
            <div className="space-y-2 text-[10px] text-white/40 leading-relaxed">
              <p>• برای تغییر نام کاربری با مدیر سیستم تماس بگیرید</p>
              <p>• تغییر رمز عبور نیازی به وارد کردن رمز قدیمی ندارد</p>
              {isAdmin && <p>• سربرگ‌ها در نگارش نامه قابل انتخاب هستند</p>}
              <p>• تغییر تم بلافاصله اعمال می‌شود</p>
            </div>
          </div>
        </div>
      </div>

      {/* ============ ADD LETTERHEAD MODAL ============ */}
      {showLhModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="glass p-8 rounded-[3rem] w-full max-w-lg space-y-6 border-white/20 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="font-black text-lg flex items-center gap-2">
                <FileText className="text-emerald-400" size={20} /> ایجاد سربرگ جدید
              </h3>
              <button onClick={() => setShowLhModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={20}/></button>
            </div>
            
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-wide">نام سربرگ</label>
                <input 
                  required 
                  value={newLhName} 
                  onChange={e => setNewLhName(e.target.value)} 
                  className="w-full glass bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all" 
                  placeholder="مثلاً: سربرگ مدیریت" 
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-wide">تصویر سربرگ (A4 Landscape)</label>
                <div className="w-full aspect-[1.41] glass rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center overflow-hidden relative group cursor-pointer hover:border-emerald-500/40 transition-all">
                  {newLhImg ? (
                    <img src={newLhImg} className="w-full h-full object-contain" alt="letterhead preview" />
                  ) : (
                    <div className="text-center">
                      <ImageIcon className="text-white/10 mx-auto mb-2" size={40} />
                      <p className="text-xs text-white/20">کلیک کنید تا تصویر انتخاب شود</p>
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if(f) {
                        const reader = new FileReader();
                        reader.onload = () => setNewLhImg(reader.result as string);
                        reader.readAsDataURL(f);
                      }
                    }} 
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                  />
                  {newLhImg && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs text-white font-bold">
                      تغییر تصویر
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={handleSaveLetterhead} 
                disabled={!newLhName || !newLhImg}
                className="flex-1 metallic-btn bg-emerald-600 py-4 rounded-2xl font-black text-sm shadow-xl hover:bg-emerald-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ذخیره و ایجاد سربرگ
              </button>
              <button
                onClick={() => { setShowLhModal(false); setNewLhName(''); setNewLhImg(''); }}
                className="px-6 py-4 glass border border-white/10 rounded-2xl font-black text-sm text-white/50 hover:text-white hover:bg-white/10 transition-all"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
