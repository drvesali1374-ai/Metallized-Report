
import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { formatPersianDateOnly, isPastDeadline } from '../utils/jalali';
import { Link } from 'react-router-dom';
import { Search, CheckCircle2, UserCheck, UserPlus, Star, Send, Inbox, MessageSquare, FileText } from 'lucide-react';

const TaskList: React.FC<{ context: 'RECEIVED' | 'SENT' }> = ({ context }) => {
  const { tasks, messages, letters, currentUser, userPriorityList, toggleUserPriority, personalLabels, taskLabelMap } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'COMPLETED'>('ACTIVE');

  const unifiedItems = useMemo(() => {
    const items: any[] = [];

    // Filter Tasks
    tasks.forEach(t => {
      const isPerformer = t.performerId === currentUser?.id || t.stations?.some(s => s.performerId === currentUser?.id);
      const isRequester = t.requesterId === currentUser?.id;
      if ((context === 'RECEIVED' && isPerformer) || (context === 'SENT' && isRequester)) {
        const matchStatus = statusFilter === 'ACTIVE' ? !t.isRequesterFinished : t.isRequesterFinished;
        if (matchStatus) items.push({ ...t, itemType: 'TASK' });
      }
    });

    // Filter Messages
    messages.forEach(m => {
      const isRecipient = m.recipientIds.includes(currentUser?.id || '') || m.ccIds.includes(currentUser?.id || '') || m.bccIds.includes(currentUser?.id || '');
      const isSender = m.senderId === currentUser?.id;
      if ((context === 'RECEIVED' && isRecipient) || (context === 'SENT' && isSender)) {
        // Messages don't have "finished" status, so show in ACTIVE
        if (statusFilter === 'ACTIVE') items.push({ ...m, itemType: 'MESSAGE', title: m.subject, deadlineDate: m.timestamp });
      }
    });

    // Filter Letters
    letters.forEach(l => {
      const isRecipient = l.recipientId === currentUser?.id;
      const isSender = l.senderId === currentUser?.id;
      if ((context === 'RECEIVED' && isRecipient) || (context === 'SENT' && isSender)) {
        if (statusFilter === 'ACTIVE') items.push({ ...l, itemType: 'LETTER', title: l.subject, deadlineDate: l.timestamp });
      }
    });

    return items.filter(i => 
      i.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (i.description || i.content || "").toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => new Date(b.deadlineDate).getTime() - new Date(a.deadlineDate).getTime());
  }, [tasks, messages, letters, context, statusFilter, searchTerm, currentUser]);

  const handleTogglePriority = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    toggleUserPriority(id);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black">{context === 'RECEIVED' ? 'صندوق دریافتی' : 'صندوق ارسالی'}</h1>
          <p className="text-white/40 text-sm mt-1">مدیریت هوشمند مکاتبات و وظایف</p>
        </div>
        
        <div className="glass p-1 rounded-2xl flex w-full md:w-auto shadow-xl">
          <button onClick={() => setStatusFilter('ACTIVE')} className={`flex-1 md:w-32 py-2.5 rounded-xl text-xs font-black transition-all ${statusFilter === 'ACTIVE' ? 'bg-blue-600 shadow-lg' : 'hover:bg-white/5'}`}>فعال / جاری</button>
          <button onClick={() => setStatusFilter('COMPLETED')} className={`flex-1 md:w-32 py-2.5 rounded-xl text-xs font-black transition-all ${statusFilter === 'COMPLETED' ? 'bg-emerald-600 shadow-lg' : 'hover:bg-white/5'}`}>مختومه / نهایی</button>
        </div>
      </header>

      <div className="glass p-8 rounded-[2.5rem] space-y-8 shadow-2xl">
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20" size={20} />
          <input 
            type="text" 
            placeholder="جستجو در میان موارد..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full glass bg-transparent border border-white/10 rounded-2xl py-4 pr-12 pl-4 focus:ring-2 focus:ring-blue-500/30 transition-all text-sm font-black"
          />
        </div>

        <div className="space-y-4">
          {unifiedItems.length > 0 ? unifiedItems.map(item => {
            const isDelayed = item.itemType === 'TASK' && !item.isRequesterFinished && isPastDeadline(item.deadlineDate);
            const isStarred = userPriorityList.includes(item.id);
            const taskLabelIds = taskLabelMap[item.id] || [];
            const taskLabels = personalLabels.filter(l => taskLabelIds.includes(l.id));
            
            const Icon = item.itemType === 'TASK' ? (context === 'SENT' ? Send : Inbox) : (item.itemType === 'MESSAGE' ? MessageSquare : FileText);
            const colorClass = item.itemType === 'TASK' ? 'text-blue-400' : (item.itemType === 'MESSAGE' ? 'text-purple-400' : 'text-emerald-400');
            const bgClass = item.itemType === 'TASK' ? 'bg-blue-500/20' : (item.itemType === 'MESSAGE' ? 'bg-purple-500/20' : 'bg-emerald-500/20');

            return (
              <div key={item.id} className="relative group">
                <Link to={item.itemType === 'TASK' ? `/task/${item.id}` : '#'} className="flex flex-col lg:flex-row items-center gap-6 p-6 glass rounded-[2rem] hover:bg-white/5 transition-all border border-white/5 overflow-hidden">
                  <div className={`absolute top-0 right-0 w-1.5 h-full ${isStarred ? 'bg-yellow-500' : (item.itemType === 'TASK' ? 'bg-blue-500' : 'bg-purple-500')}`} />
                  
                  <div className={`p-4 rounded-[1.5rem] flex-shrink-0 ${bgClass} ${colorClass}`}>
                    <Icon size={28} />
                  </div>

                  <div className="flex-1 min-w-0 text-center lg:text-right">
                    <div className="flex items-center justify-center lg:justify-start gap-3 mb-2">
                      <div className="flex flex-col items-start">
                        <span className="text-[9px] font-black opacity-30 uppercase">{item.itemType}</span>
                        <h4 className="font-black text-lg truncate">{item.title}</h4>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {taskLabels.map(label => (
                          <span key={label.id} className="text-[9px] px-3 py-1 rounded-full font-black text-white" style={{ backgroundColor: label.color }}>
                            {label.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 mt-2">
                      <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-lg border border-white/5">
                        <UserPlus size={12} className="text-blue-400" />
                        <span className="text-[9px] text-white/30 font-black">فرستنده:</span>
                        <span className="text-[11px] font-black">{item.requesterName || item.senderName}</span>
                      </div>
                      {item.performerName && (
                        <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-lg border border-white/5">
                          <UserCheck size={12} className="text-emerald-400" />
                          <span className="text-[9px] text-white/30 font-black">گیرنده:</span>
                          <span className="text-[11px] font-black">{item.performerName}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-8 flex-shrink-0 mt-4 lg:mt-0">
                    <div className="text-center lg:text-left">
                      <p className="text-[10px] text-white/30 font-black mb-1">{item.itemType === 'TASK' ? 'مهلت نهایی' : 'تاریخ ثبت'}</p>
                      <p className={`text-xs font-black ${isDelayed ? 'text-red-400' : ''}`}>{formatPersianDateOnly(item.deadlineDate)}</p>
                    </div>
                    
                    {item.itemType === 'TASK' && (
                      <div className="text-center lg:text-left">
                        <p className="text-[10px] text-white/30 font-black mb-1">پیشرفت</p>
                        <div className="flex items-center gap-3">
                          <div className="w-20 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div className={`h-full bg-blue-500 transition-all duration-1000 shadow-[0_0_10px_rgba(59,130,246,0.5)]`} style={{ width: `${item.actualProgress}%` }} />
                          </div>
                          <span className="text-xs font-black">{item.actualProgress}%</span>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => handleTogglePriority(e, item.id)}
                        className={`p-3 rounded-2xl transition-all border ${isStarred ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-white/5 text-white/20 border-white/10 hover:text-yellow-400 hover:bg-yellow-400/10'}`}
                      >
                        <Star size={20} fill={isStarred ? "currentColor" : "none"} />
                      </button>
                    </div>
                  </div>
                </Link>
              </div>
            );
          }) : (
            <div className="text-center py-32 glass rounded-[3rem] border border-white/5">
               <CheckCircle2 size={64} className="mx-auto mb-6 text-white/5" />
               <p className="text-sm font-black text-white/20 italic">موردی برای نمایش یافت نشد.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskList;
