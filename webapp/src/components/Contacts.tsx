
import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Contact, Plus, Trash2, Search, Users, X, Check } from 'lucide-react';

const Contacts: React.FC = () => {
  const { contactGroups, addContactGroup, removeContactGroup, users, currentUser } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Filter out self from list
  const availableUsers = useMemo(() => {
    return users.filter(u => u.id !== currentUser?.id && (u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || u.unit.toLowerCase().includes(searchTerm.toLowerCase())));
  }, [users, searchTerm, currentUser]);

  const handleCreateGroup = () => {
    if (!groupName.trim()) return alert('نام گروه را وارد کنید.');
    if (selectedUserIds.length === 0) return alert('حداقل یک عضو برای گروه انتخاب کنید.');
    if (contactGroups.length >= 5) return alert('شما حداکثر می‌توانید ۵ گروه ایجاد کنید.');

    addContactGroup(groupName, selectedUserIds);
    setShowModal(false);
    setGroupName('');
    setSelectedUserIds([]);
    setSearchTerm('');
  };

  const toggleUserSelection = (id: string) => {
    setSelectedUserIds(prev => prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-orange-600/20 flex items-center justify-center text-orange-400 shadow-lg">
            <Contact size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black">مخاطبین من</h1>
            <p className="text-white/40 text-xs mt-1">مدیریت گروه‌های شخصی برای دسترسی سریع‌تر</p>
          </div>
        </div>
        <button 
            onClick={() => {
                if(contactGroups.length >= 5) return alert('شما حداکثر می‌توانید ۵ گروه ایجاد کنید.');
                setShowModal(true);
            }} 
            className="metallic-btn bg-orange-600 px-6 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 text-white"
        >
          <Plus size={18} /> ایجاد گروه جدید
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {contactGroups.map(group => (
            <div key={group.id} className="glass p-6 rounded-[2rem] border-white/10 hover:border-orange-500/30 transition-all group relative">
               <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400">
                        <Users size={20} />
                     </div>
                     <div>
                        <h3 className="font-black text-base">{group.name}</h3>
                        <span className="text-[10px] text-white/40 font-bold">{group.memberIds.length} عضو</span>
                     </div>
                  </div>
                  <button onClick={() => removeContactGroup(group.id)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-xl transition-all"><Trash2 size={16}/></button>
               </div>
               <div className="flex -space-x-2 space-x-reverse overflow-hidden py-2">
                  {group.memberIds.slice(0, 5).map(uid => {
                     const u = users.find(user => user.id === uid);
                     if (!u) return null;
                     return (
                        <div key={uid} className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[10px] font-bold text-white/50" title={u.fullName}>
                           {u.profileImage ? <img src={u.profileImage} className="w-full h-full rounded-full object-cover" /> : u.fullName.charAt(0)}
                        </div>
                     );
                  })}
                  {group.memberIds.length > 5 && (
                     <div className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-700 flex items-center justify-center text-[9px] font-bold text-white">
                        +{group.memberIds.length - 5}
                     </div>
                  )}
               </div>
            </div>
         ))}
         {contactGroups.length === 0 && (
            <div className="col-span-full py-20 text-center glass rounded-[3rem] border-dashed border-2 border-white/5">
               <Contact size={48} className="mx-auto text-white/10 mb-4" />
               <p className="text-white/30 font-black text-sm">هنوز گروهی ایجاد نکرده‌اید.</p>
            </div>
         )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
           <div className="glass p-8 rounded-[3rem] w-full max-w-lg space-y-6 animate-in zoom-in-95 border-white/20 shadow-2xl flex flex-col max-h-[85vh]">
              <div className="flex justify-between items-center border-b border-white/10 pb-4 shrink-0">
                 <h3 className="font-black">ایجاد گروه مخاطبین جدید</h3>
                 <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-full"><X size={20}/></button>
              </div>

              <div className="space-y-4 shrink-0">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-white/40 mr-1">نام گروه</label>
                    <input autoFocus type="text" value={groupName} onChange={e => setGroupName(e.target.value)} className="w-full glass bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-bold" placeholder="مثلاً: همکاران واحد فنی" />
                 </div>
                 <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                    <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full glass bg-white/5 border border-white/10 rounded-xl py-3 pr-10 pl-4 text-xs font-bold" placeholder="جستجوی اعضا..." />
                 </div>
              </div>

              <div className="overflow-y-auto space-y-2 custom-scroll pr-2 flex-1 min-h-[200px]">
                 {availableUsers.map(u => {
                    const isSelected = selectedUserIds.includes(u.id);
                    return (
                      <button key={u.id} onClick={() => toggleUserSelection(u.id)} className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all border ${isSelected ? 'bg-orange-600 border-orange-400 text-white' : 'glass bg-white/5 border-white/5 hover:bg-white/10'}`}>
                         <div className="text-right">
                           <p className="text-xs font-black">{u.fullName}</p>
                           <p className="text-[10px] opacity-50">{u.position} | {u.unit}</p>
                         </div>
                         {isSelected && <Check size={16} />}
                      </button>
                    );
                 })}
              </div>

              <div className="pt-4 border-t border-white/10 flex justify-between items-center shrink-0">
                 <span className="text-xs font-bold text-white/50">{selectedUserIds.length} کاربر انتخاب شده</span>
                 <button onClick={handleCreateGroup} className="bg-orange-600 px-8 py-3 rounded-2xl font-black text-sm shadow-lg hover:bg-orange-500 transition-all">ایجاد گروه</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Contacts;
