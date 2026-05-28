
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../context/StoreContext';
import { FileText, Plus, X, Trash2, Edit2, Clock, Calendar, CheckCircle2, Search, Send, User, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatPersianDateTime } from '../utils/jalali';

const Drafts: React.FC = () => {
  const { drafts, letters, createDraft, deleteDraft, users } = useStore();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [subject, setSubject] = useState('');

  // Search filters
  const [searchSubject, setSearchSubject] = useState('');
  const [searchStatus, setSearchStatus] = useState<'ALL' | 'DRAFT' | 'SENT'>('ALL');
  const [searchRecipient, setSearchRecipient] = useState('');

  const portalTarget = document.getElementById('header-action-portal');

  const handleCreate = () => {
    if (!subject.trim()) return alert('لطفاً موضوع نامه را وارد کنید.');
    createDraft(subject);
    setSubject('');
    setShowModal(false);
  };

  // Combine drafts and sent letters into one list
  const allLetters = useMemo(() => {
    const sentLetters = letters.map(l => ({ ...l, status: 'SENT' as const }));
    return [...drafts, ...sentLetters];
  }, [drafts, letters]);

  const filteredLetters = useMemo(() => {
    return allLetters.filter(letter => {
      const matchSubject = letter.subject.toLowerCase().includes(searchSubject.toLowerCase());
      const matchStatus = searchStatus === 'ALL' || letter.status === searchStatus;

      let recipientName = '';
      if (letter.recipientId) {
        const u = users.find(user => user.id === letter.recipientId);
        recipientName = u ? u.fullName : '';
      } else if (letter.customRecipient) {
        recipientName = letter.customRecipient.name;
      }
      const matchRecipient = searchRecipient === '' || recipientName.toLowerCase().includes(searchRecipient.toLowerCase());

      return matchSubject && matchStatus && matchRecipient;
    }).sort((a, b) => new Date(b.lastModified || b.timestamp).getTime() - new Date(a.lastModified || a.timestamp).getTime());
  }, [allLetters, searchSubject, searchStatus, searchRecipient, users]);

  const handleLetterClick = (letter: (typeof filteredLetters)[0]) => {
    if (letter.status === 'SENT') {
      // Navigate to view-only mode using the letter id from letters array
      navigate(`/letters/edit/${letter.id}`);
    } else {
      navigate(`/letters/edit/${letter.id}`);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">

      {/* Create Draft Button in Header */}
      {portalTarget && createPortal(
        <button
          onClick={() => setShowModal(true)}
          className="metallic-btn bg-blue-600 px-6 py-2.5 rounded-xl font-black text-xs text-white shadow-xl flex items-center justify-center gap-2 hover:bg-blue-500 transition-all active:scale-95"
        >
          <Plus size={16} /> ایجاد پیش‌نویس
        </button>,
        portalTarget
      )}

      <header className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-slate-700/50 flex items-center justify-center text-white/70 shadow-lg border border-white/10">
          <FileText size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-black">مکاتبات اداری</h1>
          <p className="text-white/40 text-xs mt-1">مدیریت پیش‌نویس‌ها و نامه‌های ارسال شده</p>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass p-4 rounded-2xl border border-white/10 text-center">
          <div className="text-2xl font-black text-blue-400">{drafts.filter(d => d.status === 'DRAFT').length}</div>
          <div className="text-[10px] text-white/40 mt-1 font-bold">پیش‌نویس</div>
        </div>
        <div className="glass p-4 rounded-2xl border border-white/10 text-center">
          <div className="text-2xl font-black text-emerald-400">{letters.length}</div>
          <div className="text-[10px] text-white/40 mt-1 font-bold">ارسال شده</div>
        </div>
        <div className="glass p-4 rounded-2xl border border-white/10 text-center">
          <div className="text-2xl font-black text-white/60">{allLetters.length}</div>
          <div className="text-[10px] text-white/40 mt-1 font-bold">مجموع</div>
        </div>
      </div>

      {/* Advanced Search Box */}
      <div className="glass p-5 rounded-[2rem] border border-white/10 space-y-4 shadow-xl">
        <div className="flex items-center gap-2 text-white/50 text-[10px] font-black uppercase tracking-widest">
          <Search size={14} /> جستجوی پیشرفته
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="جستجو در موضوع..."
            value={searchSubject}
            onChange={e => setSearchSubject(e.target.value)}
            className="glass bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:bg-white/10 transition-all"
          />
          <input
            type="text"
            placeholder="جستجو در نام مخاطب..."
            value={searchRecipient}
            onChange={e => setSearchRecipient(e.target.value)}
            className="glass bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:bg-white/10 transition-all"
          />
          <select
            value={searchStatus}
            onChange={e => setSearchStatus(e.target.value as any)}
            className="glass bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold outline-none"
          >
            <option value="ALL" className="bg-slate-900">همه وضعیت‌ها</option>
            <option value="DRAFT" className="bg-slate-900">پیش‌نویس</option>
            <option value="SENT" className="bg-slate-900">ارسال شده</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {filteredLetters.length === 0 ? (
          <div className="py-32 text-center glass rounded-[3rem] border-dashed border-2 border-white/5">
            <FileText size={64} className="mx-auto mb-6 text-white/5" />
            <p className="text-sm font-black text-white/20 italic">هیچ نامه‌ای یافت نشد.</p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-6 metallic-btn bg-blue-600 px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 mx-auto"
            >
              <Plus size={16} /> ایجاد نامه جدید
            </button>
          </div>
        ) : (
          filteredLetters.map(letter => {
            const isSent = letter.status === 'SENT';
            let recipientName = 'تعیین نشده';
            if (letter.recipientId) {
              const u = users.find(user => user.id === letter.recipientId);
              if (u) recipientName = u.fullName;
            } else if (letter.customRecipient) {
              recipientName = letter.customRecipient.name;
            }

            return (
              <div
                key={letter.id}
                onClick={() => handleLetterClick(letter)}
                className={`glass p-5 rounded-2xl border transition-all cursor-pointer group flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  isSent
                    ? 'border-emerald-500/20 hover:bg-emerald-500/5'
                    : 'border-white/5 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shrink-0 ${isSent ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                    {isSent ? <Send size={20} /> : <Edit2 size={20} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-black text-base transition-colors truncate ${isSent ? 'text-white group-hover:text-emerald-400' : 'text-white group-hover:text-blue-400'}`}>
                        {letter.subject}
                      </h3>
                      {isSent && (
                        <span className="shrink-0 text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-black border border-emerald-500/20">
                          ارسال شده
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-[10px] text-white/40 flex items-center gap-1 bg-white/5 px-2 py-1 rounded-lg">
                        <User size={10} /> مخاطب: {recipientName}
                      </span>
                      <span className="text-[10px] text-white/40 flex items-center gap-1 bg-white/5 px-2 py-1 rounded-lg">
                        <Calendar size={10} /> ایجاد: {formatPersianDateTime(letter.createdAt || letter.timestamp)}
                      </span>
                      {!isSent && (
                        <span className="text-[10px] text-white/40 flex items-center gap-1 bg-white/5 px-2 py-1 rounded-lg">
                          <Clock size={10} /> ویرایش: {formatPersianDateTime(letter.lastModified || letter.timestamp)}
                        </span>
                      )}
                      {isSent && letter.sentAt && (
                        <span className="text-[10px] text-emerald-400/70 flex items-center gap-1 bg-emerald-500/5 px-2 py-1 rounded-lg border border-emerald-500/10">
                          <CheckCircle2 size={10} /> ارسال: {formatPersianDateTime(letter.sentAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                  {isSent ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Eye size={12} /> مشاهده نامه
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                      <Edit2 size={12} /> ویرایش
                    </div>
                  )}

                  {!isSent && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('آیا این پیش‌نویس حذف شود؟')) deleteDraft(letter.id);
                      }}
                      className="p-2.5 text-red-400 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                      title="حذف پیش‌نویس"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Draft Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="glass p-8 rounded-[3rem] w-full max-w-md space-y-6 animate-in zoom-in-95 border-white/20 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="font-black text-lg flex items-center gap-2">
                <FileText size={20} className="text-blue-400" />
                شروع نگارش نامه جدید
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-full"><X size={20} /></button>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/40 mr-1">موضوع نامه</label>
              <input
                autoFocus
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                className="w-full glass bg-white/5 border border-white/10 rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-blue-500/30 outline-none"
                placeholder="مثلاً: درخواست مرخصی..."
              />
            </div>

            <div className="flex gap-3">
              <button onClick={handleCreate} className="flex-1 metallic-btn bg-blue-600 py-3 rounded-2xl font-black text-sm shadow-xl">
                ثبت و شروع نگارش
              </button>
              <button onClick={() => setShowModal(false)} className="flex-1 bg-white/5 border border-white/10 py-3 rounded-2xl font-black text-sm hover:bg-white/10 transition-all">
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Drafts;
