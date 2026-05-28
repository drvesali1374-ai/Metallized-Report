
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { formatPersianDateTime, getTehranTime } from '../utils/jalali';
import { 
  Clock, CheckCircle, MessageSquare, 
  Layers, Send, UserCircle2, Tag, X, Plus
} from 'lucide-react';
import { Comment, PersonalLabel } from '../types';

const TaskDetail: React.FC = () => {
  const { id } = useParams();
  const { tasks, currentUser, upsertTask, personalLabels, addPersonalLabel, assignLabelToTask, unassignLabelFromTask, taskLabelMap } = useStore();
  const [commentText, setCommentText] = useState('');
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#3b82f6');
  const [showLabelCreator, setShowLabelCreator] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const task = tasks.find(t => t.id === id);
  const [localProgress, setLocalProgress] = useState(0);
  const [localPerformerNote, setLocalPerformerNote] = useState('');

  const taskLabelIds = task ? (taskLabelMap[task.id] || []) : [];

  const getCurrentStation = () => {
    if (!task || task.type === 'SINGLE') return null;
    if (task.isParallel) {
      return task.stations?.find(s => s.performerPersonnelCode === currentUser?.personnelCode);
    } else {
      const activeIdx = task.currentStationIndex ?? 0;
      const s = task.stations?.[activeIdx];
      return (s?.performerPersonnelCode === currentUser?.personnelCode) ? s : null;
    }
  };

  const activeStation = getCurrentStation();

  useEffect(() => {
    if (task) {
      if (task.type === 'SINGLE') {
        setLocalProgress(task.actualProgress);
        setLocalPerformerNote(task.performerNote || '');
      } else {
        const s = activeStation;
        setLocalProgress(s?.progress || 0);
        setLocalPerformerNote(s?.performerNote || '');
      }
    }
  }, [task?.id, activeStation?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [task?.comments.length]);

  if (!task) return <div className="p-8 glass text-center rounded-3xl">وظیفه مورد نظر یافت نشد.</div>;

  const isRequester = currentUser?.id === task.requesterId;
  const isLocked = task.isRequesterFinished;

  const canModifyProgress = task.type === 'SINGLE' 
    ? (currentUser?.personnelCode === task.performerPersonnelCode && !task.isPerformerCompleted) 
    : (!!activeStation && !activeStation.isCompleted);

  const handleUpdateProgress = (val: number) => {
    setLocalProgress(val);
    const nextTask = { ...task };
    if (task.type === 'SINGLE') {
      nextTask.actualProgress = val;
    } else {
      nextTask.stations = task.stations?.map(s => {
        if (s.id === activeStation?.id) return { ...s, progress: val };
        return s;
      });
      const sum = nextTask.stations?.reduce((acc, s) => acc + s.progress, 0) || 0;
      nextTask.actualProgress = Math.round(sum / (nextTask.stations?.length || 1));
    }
    upsertTask(nextTask);
  };

  const handleUpdatePerformerNote = (val: string) => {
    setLocalPerformerNote(val);
    const nextTask = { ...task };
    if (task.type === 'SINGLE') nextTask.performerNote = val;
    else nextTask.stations = task.stations?.map(s => s.id === activeStation?.id ? { ...s, performerNote: val } : s);
    upsertTask(nextTask);
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !currentUser) return;
    const newComment: Comment = {
      id: Math.random().toString(36).substr(2, 9),
      authorId: currentUser.id,
      authorName: currentUser.fullName,
      text: commentText,
      timestamp: getTehranTime().toISOString(),
      role: isRequester ? 'REQUESTER' : 'PERFORMER'
    };
    upsertTask({ ...task, comments: [...task.comments, newComment] });
    setCommentText('');
  };

  const handleCreateLabel = () => {
    if (!newLabelName.trim()) return;
    const label: PersonalLabel = {
      id: Math.random().toString(36).substr(2, 9),
      name: newLabelName,
      color: newLabelColor
    };
    addPersonalLabel(label);
    setNewLabelName('');
    setShowLabelCreator(false);
  };

  return (
    <div className="space-y-6 relative pb-20 animate-in fade-in duration-500">
      <div className="w-full space-y-6">
        <div className="glass p-10 rounded-[3rem] relative overflow-hidden border-white/10 shadow-2xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
            <h1 className="text-4xl font-black tracking-tight">{task.title}</h1>
            <div className="flex gap-3">
              {task.isRequesterFinished ? (
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-6 py-2.5 rounded-2xl text-[10px] font-black flex items-center gap-2 shadow-lg"><CheckCircle size={14} /> مختومه نهایی</span>
              ) : (
                <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-6 py-2.5 rounded-2xl text-[10px] font-black flex items-center gap-2 shadow-lg"><Clock size={14} /> در جریان اقدام</span>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12 bg-white/5 p-8 rounded-[2.5rem] border border-white/5">
            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-white/30 font-black uppercase tracking-widest">درخواست‌دهنده</span>
              <span className="text-sm font-black flex items-center gap-2 text-white/80"><UserCircle2 size={18} className="text-blue-400" /> {task.requesterName}</span>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-white/30 font-black uppercase tracking-widest">نوع گردش کار</span>
              <span className="text-sm font-black text-white/80">{task.type === 'MULTI' ? (task.isParallel ? 'موازی' : 'ترتیبی') : 'ساده'}</span>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-white/30 font-black uppercase tracking-widest">تاریخ ثبت</span>
              <span className="text-sm font-black text-white/80">{formatPersianDateTime(task.createdAt)}</span>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-white/30 font-black uppercase tracking-widest">مهلت نهایی</span>
              <span className="text-sm font-black text-red-400">{formatPersianDateTime(task.deadlineDate)}</span>
            </div>
          </div>

          <div className="p-8 glass rounded-[2.5rem] mb-12 border-white/5 space-y-6">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <Tag size={20} className="text-blue-400" />
              <h3 className="font-black text-sm">برچسب‌های شخصی من برای این درخواست</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {personalLabels.map(label => {
                const isActive = taskLabelIds.includes(label.id);
                return (
                  <button 
                    key={label.id}
                    onClick={() => isActive ? unassignLabelFromTask(task.id, label.id) : assignLabelToTask(task.id, label.id)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 transition-all border ${isActive ? 'ring-2 ring-white/50 text-white' : 'opacity-40 hover:opacity-100 text-white/60'}`}
                    style={{ backgroundColor: label.color, borderColor: label.color }}
                  >
                    {label.name}
                    {isActive ? <CheckCircle size={12}/> : <Plus size={12}/>}
                  </button>
                );
              })}
              <button 
                onClick={() => setShowLabelCreator(!showLabelCreator)}
                className="px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
              >
                <Plus size={14}/> ایجاد برچسب جدید
              </button>
            </div>
            {showLabelCreator && (
              <div className="flex items-center gap-3 animate-in slide-in-from-top-2 bg-white/5 p-4 rounded-2xl border border-white/10">
                <input type="text" value={newLabelName} onChange={e => setNewLabelName(e.target.value)} placeholder="نام برچسب..." className="bg-transparent border-b border-white/20 text-xs p-1 focus:outline-none focus:border-blue-500" />
                <input type="color" value={newLabelColor} onChange={e => setNewLabelColor(e.target.value)} className="w-8 h-8 rounded-lg bg-transparent border-none cursor-pointer" />
                <button onClick={handleCreateLabel} className="bg-blue-600 px-4 py-1.5 rounded-lg text-[10px] font-black">ثبت</button>
              </div>
            )}
          </div>

          <div className="p-10 glass rounded-[2.5rem] border-white/5 mb-12 bg-gradient-to-br from-blue-500/5 to-transparent">
            <div className="flex justify-between items-center mb-6">
              <span className="text-xs font-black text-white/50 uppercase tracking-widest">پیشرفت عملیاتی پروژه</span>
              <span className="text-5xl font-black text-emerald-400">{task.actualProgress}%</span>
            </div>
            <div className="w-full h-5 bg-black/20 rounded-full overflow-hidden p-1 border border-white/5">
              <div className="h-full bg-gradient-to-l from-emerald-500 to-emerald-400 rounded-full transition-all duration-1000 shadow-[0_0_20px_rgba(16,185,129,0.4)]" style={{ width: `${task.actualProgress}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-6">
              <h3 className="text-xs font-black text-blue-400 uppercase tracking-[0.2em] flex items-center gap-3"><Layers size={18} className="text-blue-500"/> شرح درخواست و پیوست‌ها</h3>
              <div className="p-8 bg-black/10 rounded-[2rem] border border-white/5 text-sm whitespace-pre-wrap text-white/70 leading-loose">{task.description}</div>
            </div>

            <div className="space-y-6">
              <h3 className="text-xs font-black text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-3"><CheckCircle size={18} className="text-emerald-500"/> گزارش اقدامات ایستگاه جاری</h3>
              {canModifyProgress ? (
                <div className="space-y-6">
                  <textarea rows={6} value={localPerformerNote} onChange={e => setLocalPerformerNote(e.target.value)} onBlur={e => handleUpdatePerformerNote(e.target.value)} className="w-full glass bg-white/5 border border-white/10 p-6 rounded-[2rem] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all" placeholder="گزارش اقدام خود را بنویسید..." />
                  <div className="p-8 glass rounded-[2rem] border-emerald-500/20 bg-emerald-500/5">
                    <div className="flex justify-between items-center mb-4"><span className="text-xs font-black">درصد پیشرفت شما</span><span className="text-2xl font-black text-emerald-400">{localProgress}%</span></div>
                    <input type="range" min="0" max="100" value={localProgress} onChange={e => setLocalProgress(Number(e.target.value))} onMouseUp={e => handleUpdateProgress(Number((e.target as HTMLInputElement).value))} onTouchEnd={e => handleUpdateProgress(Number((e.target as HTMLInputElement).value))} className="w-full h-2.5 bg-black/30 rounded-full appearance-none cursor-pointer accent-emerald-500" />
                  </div>
                </div>
              ) : (
                <div className="p-8 bg-black/10 rounded-[2rem] border border-white/5 min-h-[250px]">
                  <p className="text-sm leading-relaxed text-white/50 italic">{localPerformerNote || 'هنوز گزارشی برای این ایستگاه ثبت نشده است.'}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="glass p-12 rounded-[3rem] border-white/10 shadow-2xl space-y-10" dir="rtl">
          <h3 className="text-2xl font-black flex items-center gap-4"><MessageSquare size={28} className="text-blue-400"/> میز گفتگوی نهایی</h3>
          
          <div className="bg-black/30 rounded-[2.5rem] border border-white/10 p-8 max-h-[600px] overflow-y-auto space-y-6 custom-scroll">
            {task.comments.length === 0 ? (
              <div className="py-24 text-center opacity-20 italic text-sm">پیامی برای نمایش وجود ندارد.</div>
            ) : (
              task.comments.map(c => {
                const isMe = c.authorId === currentUser?.id;
                return (
                  <div key={c.id} className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[80%] space-y-2 flex flex-col ${isMe ? 'items-start' : 'items-end'}`}>
                      <div className={`p-5 rounded-[2rem] shadow-2xl ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'glass bg-white/5 border-white/10 text-white/90 rounded-tl-none'}`}>
                        <p className="text-sm font-bold leading-relaxed">{c.text}</p>
                      </div>
                      <div className="flex items-center gap-3 px-3">
                        <span className="text-[10px] font-black text-white/30">{c.authorName}</span>
                        <span className="text-[9px] text-white/30 font-black" dir="ltr">{formatPersianDateTime(c.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleAddComment} className="flex flex-row-reverse gap-4 items-center bg-white/5 p-2 rounded-[2rem] border border-white/10">
            <div className="flex-1 relative">
              <input type="text" value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="ارسال پیام..." className="w-full bg-transparent p-5 text-sm font-bold text-right outline-none" />
            </div>
            <button type="submit" disabled={!commentText.trim()} className="p-5 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white rounded-2xl shadow-xl transition-all">
              <Send size={24} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TaskDetail;
