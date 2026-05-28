
import React, { useMemo, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Calendar as CalendarIcon, AlertTriangle, PlayCircle, TrendingUp, ChevronRight, ChevronLeft, MoveLeft, GripVertical, Star, Send, Inbox } from 'lucide-react';
import { isToday, isPastDeadline, formatPersianDateOnly, getJalaliParts, getDaysInJalaliMonth, JALALI_MONTHS, getFirstDayOfMonthWeekday, isFriday } from '../utils/jalali';
import { Link } from 'react-router-dom';
import { Task } from '../types';

const Dashboard: React.FC = () => {
  const { tasks, currentUser, systemSettings, userPriorityList, reorderUserPriorities, toggleUserPriority, personalLabels, taskLabelMap } = useStore();
  const [currentJalali, setCurrentJalali] = useState(() => getJalaliParts(new Date()));
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const userTasks = tasks.filter(t => t.requesterId === currentUser?.id || t.performerId === currentUser?.id || t.stations?.some(s => s.performerId === currentUser?.id));
    const active = userTasks.filter(t => !t.isRequesterFinished);
    const priorityList = userPriorityList.map(id => tasks.find(t => t.id === id)).filter((t): t is Task => !!t);
    return { today: active.filter(t => isToday(t.deadlineDate)), delayed: active.filter(t => isPastDeadline(t.deadlineDate)), totalActive: active.length, allUserTasks: userTasks, priorityList };
  }, [tasks, currentUser, userPriorityList]);

  const taskDaysMap = useMemo(() => {
    const map = new Set<number>();
    stats.allUserTasks.forEach(t => {
      let deadlineToDisplay = t.type === 'SINGLE' ? t.deadlineDate : (t.stations?.find(s => s.performerId === currentUser?.id)?.deadlineDate || '');
      if (deadlineToDisplay) {
        const p = getJalaliParts(new Date(deadlineToDisplay));
        if (p.year === currentJalali.year && p.month === currentJalali.month) map.add(p.day);
      }
    });
    return map;
  }, [stats.allUserTasks, currentJalali.year, currentJalali.month, currentUser?.id]);

  const calendarDays = useMemo(() => {
    const todayParts = getJalaliParts(new Date());
    const days = [];
    const daysInMonth = getDaysInJalaliMonth(currentJalali.year, currentJalali.month);
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${currentJalali.year}/${currentJalali.month.toString().padStart(2, '0')}/${i.toString().padStart(2, '0')}`;
      days.push({ day: i, isHoliday: isFriday(currentJalali.year, currentJalali.month, i) || systemSettings.holidays.includes(dateStr), isToday: todayParts.year === currentJalali.year && todayParts.month === currentJalali.month && todayParts.day === i, hasTasks: taskDaysMap.has(i) });
    }
    return days;
  }, [currentJalali, systemSettings.holidays, taskDaysMap]);

  const onDrop = (targetId: string) => {
    if (!draggedTaskId || draggedTaskId === targetId) return;
    const newList = [...userPriorityList];
    const dIdx = newList.indexOf(draggedTaskId);
    const tIdx = newList.indexOf(targetId);
    if (dIdx > -1 && tIdx > -1) {
      newList.splice(dIdx, 1);
      newList.splice(tIdx, 0, draggedTaskId);
      reorderUserPriorities(newList);
    }
    setDraggedTaskId(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div><h1 className="text-4xl font-black mb-1">خوش آمدید، {currentUser?.fullName}</h1><p className="text-white/40 text-base">{currentUser?.unit} | {currentUser?.position}</p></div>
        {/* Requirement 1: Button removed from here */}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <StatCard icon={CalendarIcon} color="bg-blue-500" label="امروز" count={stats.today.length} />
             <StatCard icon={AlertTriangle} color="bg-red-500" label="تأخیر" count={stats.delayed.length} />
             <StatCard icon={PlayCircle} color="bg-emerald-500" label="فعال" count={stats.totalActive} />
             <StatCard icon={Star} color="bg-yellow-500" label="اولویت‌ها" count={stats.priorityList.length} />
          </div>

          <div className="glass p-8 rounded-[2.5rem] border-white/10 shadow-xl min-h-[500px]">
            <h2 className="text-xl font-black flex items-center gap-3 mb-8"><TrendingUp size={24} className="text-blue-400" /> لیست اولویت‌های من</h2>
            <div className="space-y-4">
              {stats.priorityList.length > 0 ? stats.priorityList.map((t, index) => {
                const isSent = t.requesterId === currentUser?.id;
                const taskLabelIds = taskLabelMap[t.id] || [];
                const taskLabels = personalLabels.filter(l => taskLabelIds.includes(l.id));

                return (
                  <div key={t.id} draggable onDragStart={() => setDraggedTaskId(t.id)} onDragOver={e => e.preventDefault()} onDragEnd={() => setDraggedTaskId(null)} onDrop={() => onDrop(t.id)} className={`flex items-center gap-4 p-5 glass rounded-[2rem] hover:bg-white/5 border border-white/5 transition-all group relative cursor-move ${draggedTaskId === t.id ? 'opacity-30 scale-95' : 'opacity-100'}`}>
                    <div className="absolute -left-2 -bottom-4 text-7xl font-black text-white/5 select-none pointer-events-none">{index + 1}</div>
                    <div className="shrink-0 w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-400 border border-blue-500/20 group-hover:bg-blue-600 group-hover:text-white transition-all">
                       {isSent ? <Send size={24} /> : <Inbox size={24} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link to={`/task/${t.id}`}>
                        <h4 className="font-black text-base truncate mb-1 group-hover:text-blue-400 transition-colors">{t.title}</h4>
                        <div className="flex flex-wrap gap-1.5">
                           {taskLabels.map(l => <span key={l.id} className="text-[8px] px-2 py-0.5 rounded-full text-white font-bold" style={{backgroundColor: l.color}}>{l.name}</span>)}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider mt-1">
                           <span className="text-white/20">فرستنده:</span> <span className="text-white/50">{t.requesterName}</span>
                           <MoveLeft size={12} className="text-blue-500/40" />
                           <span className="text-blue-400">{t.performerName}</span>
                        </div>
                      </Link>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => toggleUserPriority(t.id)} className="p-3 bg-white/5 rounded-xl text-yellow-400 hover:bg-yellow-400/20 transition-all border border-transparent hover:border-yellow-400/30"><Star size={18} fill="currentColor" /></button>
                      <div className="p-3 opacity-20 group-hover:opacity-100 transition-opacity"><GripVertical size={20} /></div>
                    </div>
                  </div>
                );
              }) : (
                <div className="py-24 text-center text-white/20 italic text-sm">لیست اولویت‌ها خالی است.</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass p-8 rounded-[2.5rem] shadow-2xl border-white/10 relative overflow-hidden h-fit">
             <div className="flex justify-between items-center mb-8 px-2">
                <button onClick={() => setCurrentJalali(p => p.month === 1 ? { ...p, year: p.year-1, month: 12 } : { ...p, month: p.month-1 })} className="p-2 hover:bg-white/10 rounded-xl transition-all"><ChevronRight size={22}/></button>
                <h3 className="font-black text-xl">{JALALI_MONTHS[currentJalali.month-1]} {currentJalali.year}</h3>
                <button onClick={() => setCurrentJalali(p => p.month === 12 ? { ...p, year: p.year+1, month: 1 } : { ...p, month: p.month+1 })} className="p-2 hover:bg-white/10 rounded-xl transition-all"><ChevronLeft size={22}/></button>
             </div>
             <div className="grid grid-cols-7 gap-2 text-center mb-4 text-[10px] font-black text-white/30">{['ش','ی','د','س','چ','پ','ج'].map(d => <span key={d}>{d}</span>)}</div>
             <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: getFirstDayOfMonthWeekday(currentJalali.year, currentJalali.month) }).map((_, i) => <div key={`off-${i}`} />)}
                {calendarDays.map((d) => (
                  <div key={d.day} className={`aspect-square flex flex-col items-center justify-center rounded-2xl text-sm relative transition-all group ${d.isHoliday ? 'bg-red-500/10 text-red-500' : 'hover:bg-white/5'} ${d.isToday ? 'ring-2 ring-blue-500 bg-blue-500/20' : ''}`}>
                    <span className={d.isToday ? 'font-black' : ''}>{d.day}</span>
                    <div className="flex gap-1 absolute bottom-2">{d.hasTasks && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />}</div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, color, label, count }: any) => (
  <div className="glass p-6 rounded-[2rem] border border-white/5 hover:translate-y-[-4px] transition-all shadow-xl">
    <div className={`w-12 h-12 rounded-2xl ${color} bg-opacity-20 flex items-center justify-center mb-5`}><Icon className={color.replace('bg-', 'text-')} size={28} /></div>
    <h3 className="text-white/40 text-[11px] font-black uppercase tracking-widest mb-1">{label}</h3>
    <p className="text-3xl font-black">{count}</p>
  </div>
);

export default Dashboard;
