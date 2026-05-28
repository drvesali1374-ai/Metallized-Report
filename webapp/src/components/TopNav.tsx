
import React, { useState, useEffect, useMemo } from 'react';
import { Bell, LogOut, Clock, Calendar as CalIcon, CheckCircle, Star } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatPersianDateTime, getTehranTime, formatHeaderDate, getJalaliParts } from '../utils/jalali';
import { useLocation } from 'react-router-dom';

const TopNav: React.FC = () => {
  const { notifications, markNotificationRead, logout, currentUser, systemSettings, tasks, upsertTask, userPriorityList, toggleUserPriority, currentTheme } = useStore();
  const location = useLocation();
  const [showNotifs, setShowNotifs] = useState(false);
  const [time, setTime] = useState(getTehranTime());

  useEffect(() => {
    const timer = setInterval(() => setTime(getTehranTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isLightMode = ['light', 'wood', 'pink', 'teal', 'sky'].includes(currentTheme);
  const contrastClass = isLightMode ? 'text-slate-900' : 'text-white';
  const iconContrastClass = isLightMode ? 'text-blue-600' : 'text-blue-400';
  const clockIconContrastClass = isLightMode ? 'text-emerald-600' : 'text-emerald-400';

  const unreadCount = notifications.filter(n => !n.isRead && n.userId === currentUser?.id).length;
  
  const taskId = useMemo(() => {
    const match = location.pathname.match(/\/task\/([^\/]+)/);
    return match ? match[1] : null;
  }, [location.pathname]);

  const task = useMemo(() => tasks.find(t => t.id === taskId), [tasks, taskId]);

  const handleTaskAction = (action: 'COMPLETE' | 'LOCK') => {
    if (!task) return;
    const nextTask = { ...task };
    
    if (action === 'COMPLETE') {
      if (task.type === 'SINGLE') {
        if (task.isPerformerCompleted) return;
        nextTask.isPerformerCompleted = true;
        nextTask.performerCompletedAt = getTehranTime().toISOString();
      } else {
        const activeIdx = task.currentStationIndex ?? 0;
        nextTask.stations = task.stations?.map((s, idx) => {
          if (s.performerPersonnelCode === currentUser?.personnelCode && (task.isParallel || idx === activeIdx)) {
            if (s.isCompleted) return s;
            return { ...s, isCompleted: true, completedAt: getTehranTime().toISOString() };
          }
          return s;
        });
      }
    } else if (action === 'LOCK') {
      if (task.isRequesterFinished) return;
      nextTask.isRequesterFinished = true;
      nextTask.requesterFinishedAt = getTehranTime().toISOString();
    }
    upsertTask(nextTask);
  };

  const isStarred = task ? userPriorityList.includes(task.id) : false;

  const headerDateString = useMemo(() => {
    const parts = getJalaliParts(time);
    const dayName = new Intl.DateTimeFormat('fa-IR', { weekday: 'long', calendar: 'persian' }).format(time);
    const y = parts.year.toLocaleString('fa-IR', { useGrouping: false });
    const m = parts.month.toLocaleString('fa-IR', { minimumIntegerDigits: 2 });
    const d = parts.day.toLocaleString('fa-IR', { minimumIntegerDigits: 2 });
    return `${y}/${m}/${d} ${dayName}`;
  }, [time]);

  return (
    <nav className="h-20 glass-dark border-b px-4 md:px-6 flex items-center justify-between sticky top-0 z-40 backdrop-blur-xl">
      <div className="flex items-center gap-4 flex-1">
        <div className="flex items-center gap-4 shrink-0">
          <div className="h-12 w-auto flex items-center">
            {systemSettings.appLogo ? (
              <img src={systemSettings.appLogo} alt="Logo" className="h-full w-auto max-w-[120px] object-contain transition-all" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white text-lg shadow-lg">P</div>
            )}
          </div>
          <span className={`text-lg font-black hidden xl:block tracking-tight ${contrastClass}`}>{systemSettings.appName}</span>
        </div>

        {/* Portal Target for Page Actions (e.g. Send Letter Button) */}
        <div id="header-action-portal" className="mr-8 flex items-center"></div>

        {task && (
          <div className="hidden md:flex gap-2 mr-4 animate-in slide-in-from-right-4">
             <button 
                onClick={() => toggleUserPriority(task.id)}
                className={`px-4 py-2 rounded-xl font-black text-[10px] flex items-center gap-2 transition-all border shadow-lg ${isStarred ? 'bg-yellow-500 border-yellow-400 text-slate-900' : 'bg-white/10 border-white/10 hover:bg-yellow-500/20 text-white'}`}
              >
                <Star size={14} fill={isStarred ? "currentColor" : "none"} />
                {isStarred ? 'در اولویت من' : 'افزودن به اولویت'}
             </button>

             {((task.type === 'SINGLE' && currentUser?.personnelCode === task.performerPersonnelCode) || 
               (task.type === 'MULTI' && task.stations?.some(s => s.performerPersonnelCode === currentUser?.personnelCode))) && (
               <button 
                 onClick={() => handleTaskAction('COMPLETE')}
                 disabled={task.type === 'SINGLE' ? task.isPerformerCompleted : task.stations?.find(s => s.performerPersonnelCode === currentUser?.personnelCode)?.isCompleted}
                 className={`px-4 py-2 rounded-xl font-black text-[10px] flex items-center gap-2 transition-all border shadow-lg disabled:opacity-50 ${ (task.type === 'SINGLE' ? task.isPerformerCompleted : task.stations?.find(s => s.performerPersonnelCode === currentUser?.personnelCode)?.isCompleted) ? 'bg-emerald-600 border-emerald-400' : 'bg-blue-600 border-blue-400'}`}
               >
                 <CheckCircle size={14} /> {(task.type === 'SINGLE' ? task.isPerformerCompleted : task.stations?.find(s => s.performerPersonnelCode === currentUser?.personnelCode)?.isCompleted) ? 'تکمیل شد' : 'تکمیل مرحله'}
               </button>
             )}
             {currentUser?.id === task.requesterId && (
               <button 
                 onClick={() => handleTaskAction('LOCK')}
                 disabled={task.isRequesterFinished}
                 className={`px-4 py-2 rounded-xl font-black text-[10px] flex items-center gap-2 transition-all border shadow-lg disabled:opacity-50 ${task.isRequesterFinished ? 'bg-purple-600 border-purple-400' : 'bg-slate-700 border-white/20'}`}
               >
                 <CheckCircle size={14} /> {task.isRequesterFinished ? 'مختومه شد' : 'تایید نهایی'}
               </button>
             )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-8">
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-black ${contrastClass}`}>{headerDateString}</span>
            <CalIcon size={14} className={iconContrastClass} />
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-black tracking-widest ${contrastClass}`} dir="ltr">
              {time.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <Clock size={14} className={clockIconContrastClass} />
          </div>
        </div>

        <div className="flex items-center gap-2 border-r border-white/10 pr-6">
          <div className="relative">
            <button onClick={() => setShowNotifs(!showNotifs)} className={`p-2.5 hover:bg-white/10 rounded-xl transition-colors relative ${contrastClass}`}>
              <Bell size={20} />
              {unreadCount > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[8px] flex items-center justify-center font-bold border-2 border-slate-900">{unreadCount}</span>}
            </button>
            {showNotifs && (
              <div className="absolute left-0 mt-3 w-80 glass border border-white/20 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="p-4 border-b border-white/10 bg-white/5 font-bold text-sm">اعلان‌ها</div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.filter(n => n.userId === currentUser?.id).length === 0 ? (
                    <div className="p-8 text-center text-white/40 text-xs">موردی یافت نشد.</div>
                  ) : (
                    notifications.filter(n => n.userId === currentUser?.id).map(n => (
                      <div key={n.id} onClick={() => markNotificationRead(n.id)} className={`p-4 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${!n.isRead ? 'bg-blue-500/5' : ''}`}>
                        <p className="text-xs mb-1">{n.message}</p>
                        <span className="text-[9px] text-white/30">{formatPersianDateTime(n.timestamp)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <button onClick={logout} className="p-2.5 hover:bg-red-500/10 text-red-400 rounded-xl transition-all"><LogOut size={20} /></button>
        </div>
      </div>
    </nav>
  );
};

export default TopNav;
