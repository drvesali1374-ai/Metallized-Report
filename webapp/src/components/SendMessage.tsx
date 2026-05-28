
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Send, MessageSquare, UserPlus, X, Search, Info, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SendMessage: React.FC = () => {
  const { users, sendMessage, contactGroups } = useStore();
  const navigate = useNavigate();
  
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [ccIds, setCcIds] = useState<string[]>([]);
  const [bccIds, setBccIds] = useState<string[]>([]);
  
  const [showRecipientList, setShowRecipientList] = useState<'TO' | 'CC' | 'BCC' | null>(null);

  const toggleSelection = (id: string, type: 'TO' | 'CC' | 'BCC') => {
    const setters = { TO: setRecipientIds, CC: setCcIds, BCC: setBccIds };
    const values = { TO: recipientIds, CC: ccIds, BCC: bccIds };
    
    if (values[type].includes(id)) {
      setters[type](values[type].filter(i => i !== id));
    } else {
      setters[type]([...values[type], id]);
    }
  };

  const addGroupMembers = (groupId: string, type: 'TO' | 'CC' | 'BCC') => {
    const group = contactGroups.find(g => g.id === groupId);
    if (!group) return;
    const setters = { TO: setRecipientIds, CC: setCcIds, BCC: setBccIds };
    const values = { TO: recipientIds, CC: ccIds, BCC: bccIds };
    
    // Add all members that are not already in the list
    const newIds = [...values[type]];
    group.memberIds.forEach(mid => {
        if (!newIds.includes(mid)) newIds.push(mid);
    });
    setters[type](newIds);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (recipientIds.length === 0 || !subject.trim() || !content.trim()) return;
    
    sendMessage({ recipientIds, ccIds, bccIds, subject, content });
    alert('پیام شما با موفقیت ارسال شد.');
    navigate('/');
  };

  const UserChip: React.FC<{ id: string; onRemove: () => void }> = ({ id, onRemove }) => {
    const u = users.find(user => user.id === id);
    if (!u) return null;
    return (
      <span className="flex items-center gap-2 bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-xl border border-blue-500/20 text-[10px] font-black">
        {u.fullName}
        <button type="button" onClick={onRemove} className="hover:text-red-400 transition-colors"><X size={12}/></button>
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <header className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-blue-600/20 flex items-center justify-center text-blue-400 shadow-lg">
          <MessageSquare size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-black">ارسال پیام جدید</h1>
          <p className="text-white/40 text-xs mt-1">ارتباط سریع و مستقیم با همکاران و واحدهای سازمانی</p>
        </div>
      </header>

      <form onSubmit={handleSend} className="glass p-10 rounded-[3rem] border-white/10 shadow-2xl space-y-8">
        <div className="space-y-6">
          {/* TO */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-white/30 uppercase tracking-widest flex justify-between">
              <span>گیرندگان اصلی (To)</span>
              <button type="button" onClick={() => setShowRecipientList('TO')} className="text-blue-400 hover:text-blue-300 flex items-center gap-1"><UserPlus size={12}/> افزودن گیرنده</button>
            </label>
            <div className="min-h-[56px] glass bg-white/5 border border-white/5 p-3 rounded-2xl flex flex-wrap gap-2 items-center">
               {recipientIds.length > 0 ? recipientIds.map(id => <UserChip key={id} id={id} onRemove={() => toggleSelection(id, 'TO')} />) : <span className="text-[10px] text-white/20 mr-2 italic">هیچ گیرنده‌ای انتخاب نشده است.</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             {/* CC */}
             <div className="space-y-3">
               <label className="text-[10px] font-black text-white/30 uppercase tracking-widest flex justify-between">
                 <span>رونوشت (CC)</span>
                 <button type="button" onClick={() => setShowRecipientList('CC')} className="text-blue-400 hover:text-blue-300 flex items-center gap-1"><UserPlus size={12}/> افزودن</button>
               </label>
               <div className="min-h-[56px] glass bg-white/5 border border-white/5 p-3 rounded-2xl flex flex-wrap gap-2 items-center">
                  {ccIds.length > 0 ? ccIds.map(id => <UserChip key={id} id={id} onRemove={() => toggleSelection(id, 'CC')} />) : <span className="text-[10px] text-white/20 mr-2 italic">---</span>}
               </div>
             </div>

             {/* BCC */}
             <div className="space-y-3">
               <label className="text-[10px] font-black text-white/30 uppercase tracking-widest flex justify-between">
                 <span>رونوشت پنهان (BCC)</span>
                 <button type="button" onClick={() => setShowRecipientList('BCC')} className="text-blue-400 hover:text-blue-300 flex items-center gap-1"><UserPlus size={12}/> افزودن</button>
               </label>
               <div className="min-h-[56px] glass bg-white/5 border border-white/5 p-3 rounded-2xl flex flex-wrap gap-2 items-center">
                  {bccIds.length > 0 ? bccIds.map(id => <UserChip key={id} id={id} onRemove={() => toggleSelection(id, 'BCC')} />) : <span className="text-[10px] text-white/20 mr-2 italic">---</span>}
               </div>
             </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/30 uppercase tracking-widest">موضوع پیام</label>
            <input required type="text" value={subject} onChange={e => setSubject(e.target.value)} className="w-full glass bg-white/5 border border-white/10 p-4 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500/30" placeholder="موضوع پیام را اینجا وارد کنید..." />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/30 uppercase tracking-widest">متن پیام</label>
            <textarea required rows={8} value={content} onChange={e => setContent(e.target.value)} className="w-full glass bg-white/5 border border-white/10 p-6 rounded-[2rem] text-sm outline-none focus:ring-2 focus:ring-blue-500/30 leading-relaxed" placeholder="متن پیام خود را اینجا بنویسید..." />
          </div>
        </div>

        <div className="flex justify-between items-center pt-8 border-t border-white/5">
           <div className="flex items-center gap-2 text-white/20 text-[10px] italic">
             <Info size={14} /> ارسال پیام شامل نوتیفیکیشن لحظه‌ای برای گیرندگان خواهد بود.
           </div>
           <button type="submit" className="metallic-btn bg-blue-600 px-12 py-4 rounded-2xl font-black text-white shadow-xl flex items-center gap-3 active:scale-95 transition-all">
             ارسال نهایی پیام <Send size={20} />
           </button>
        </div>
      </form>

      {/* Recipient Selection Modal */}
      {showRecipientList && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
           <div className="glass p-8 rounded-[3rem] w-full max-w-lg space-y-6 animate-in zoom-in-95 border-white/20 shadow-2xl flex flex-col max-h-[85vh]">
              <div className="flex justify-between items-center border-b border-white/10 pb-4 shrink-0">
                 <h3 className="font-black">انتخاب گیرندگان {showRecipientList === 'TO' ? 'اصلی' : showRecipientList === 'CC' ? 'رونوشت' : 'رونوشت پنهان'}</h3>
                 <button onClick={() => setShowRecipientList(null)} className="p-2 hover:bg-white/10 rounded-full"><X size={20}/></button>
              </div>
              <div className="relative shrink-0">
                 <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                 <input type="text" className="w-full glass bg-white/5 border border-white/10 rounded-xl py-3 pr-11 pl-4 text-xs font-bold" placeholder="جستجوی نام یا واحد..." />
              </div>
              
              <div className="overflow-y-auto space-y-2 custom-scroll pr-2 flex-1">
                 {/* Contact Groups First */}
                 {contactGroups.length > 0 && (
                     <div className="space-y-2 mb-4 pb-4 border-b border-white/5">
                         <div className="text-[10px] font-black text-orange-400 px-2 mb-1">گروه‌های مخاطبین من</div>
                         {contactGroups.map(g => (
                             <button
                                key={g.id}
                                onClick={() => addGroupMembers(g.id, showRecipientList)}
                                className="w-full flex items-center justify-between p-3 rounded-2xl transition-all glass bg-orange-600/10 border-orange-500/20 hover:bg-orange-600/20"
                             >
                                 <div className="flex items-center gap-3">
                                     <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-400">
                                        <Users size={16} />
                                     </div>
                                     <div className="text-right">
                                         <p className="text-xs font-black">{g.name}</p>
                                         <p className="text-[10px] opacity-50">{g.memberIds.length} عضو</p>
                                     </div>
                                 </div>
                                 <span className="text-[9px] bg-orange-500/20 px-2 py-1 rounded text-orange-300">افزودن همه</span>
                             </button>
                         ))}
                     </div>
                 )}

                 {/* Users List */}
                 {users.map(u => {
                    const isSelected = (showRecipientList === 'TO' ? recipientIds : showRecipientList === 'CC' ? ccIds : bccIds).includes(u.id);
                    return (
                      <button 
                        key={u.id}
                        type="button"
                        onClick={() => toggleSelection(u.id, showRecipientList)}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border ${isSelected ? 'bg-blue-600 border-blue-400 text-white' : 'glass bg-white/5 border-white/5 hover:bg-white/10'}`}
                      >
                         <div className="text-right">
                           <p className="text-xs font-black">{u.fullName}</p>
                           <p className="text-[10px] opacity-50">{u.position} | {u.unit}</p>
                         </div>
                         {isSelected && <Send size={14} className="opacity-50" />}
                      </button>
                    );
                 })}
              </div>
              <button onClick={() => setShowRecipientList(null)} className="w-full bg-blue-600 py-3 rounded-2xl font-black text-sm shrink-0">تایید انتخاب‌ها</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default SendMessage;
