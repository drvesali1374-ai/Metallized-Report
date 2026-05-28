
import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useNavigate, useParams } from 'react-router-dom';
import { Station, Task } from '../types';
import { getTehranTime } from '../utils/jalali';
import { Plus, Trash2, ArrowRight, Zap, Layers, AlertTriangle } from 'lucide-react';
import JalaliPicker from './JalaliPicker';

const TaskForm: React.FC = () => {
  const { currentUser, users, upsertTask, tasks } = useStore();
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [type, setType] = useState<'SINGLE' | 'MULTI'>('SINGLE');
  const [isParallel, setIsParallel] = useState(false);
  const [title, setTitle] = useState('');
  const [performerId, setPerformerId] = useState('');
  const [deadlineDate, setDeadlineDate] = useState(getTehranTime().toISOString());
  const [description, setDescription] = useState('');
  const [stations, setStations] = useState<Station[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      const task = tasks.find(t => t.id === id);
      if (task) {
        setTitle(task.title);
        setPerformerId(task.performerId);
        setDeadlineDate(task.deadlineDate);
        setDescription(task.description);
        setType(task.type);
        setIsParallel(task.isParallel || false);
        setStations(task.stations || []);
      }
    }
  }, [id, tasks]);

  const addStation = () => {
    const lastStationDate = stations.length > 0 ? stations[stations.length - 1].deadlineDate : getTehranTime().toISOString();
    setStations([...stations, {
      id: Math.random().toString(36).substr(2, 9),
      performerId: '',
      performerName: '',
      performerPersonnelCode: '',
      deadlineDate: lastStationDate,
      description: '',
      performerNote: '',
      progress: 0,
      isCompleted: false
    }]);
  };

  const updateStation = (idx: number, field: keyof Station, value: any) => {
    const updated = [...stations];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === 'performerId') {
      const u = users.find(u => u.id === value);
      updated[idx].performerName = u ? u.fullName : '';
      updated[idx].performerPersonnelCode = u ? u.personnelCode : '';
    }
    setStations(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!currentUser) return;

    // Requirement 4: Deadline must be in the future
    const now = getTehranTime();
    
    if (type === 'SINGLE') {
      if (new Date(deadlineDate) <= now) {
        setError('مهلت انجام درخواست باید حتماً در آینده باشد.');
        return;
      }
    } else {
      // Requirement 3: At least 1 station for MULTI
      if (stations.length === 0) {
        setError('برای درخواست‌های گردشی، حداقل باید یک ایستگاه کاری تعریف کنید.');
        return;
      }

      // Check all stations deadlines
      for (let i = 0; i < stations.length; i++) {
        if (!stations[i].performerId) {
          setError(`لطفاً انجام‌دهنده ایستگاه شماره ${i+1} را انتخاب کنید.`);
          return;
        }
        if (new Date(stations[i].deadlineDate) <= now) {
          setError(`مهلت انجام ایستگاه شماره ${i+1} باید در آینده باشد.`);
          return;
        }
      }
    }

    const performer = users.find(u => u.id === performerId);

    const newTask: Task = {
      id: id || Math.random().toString(36).substr(2, 9),
      priority: 0,
      requesterId: currentUser.id,
      requesterName: currentUser.fullName,
      performerId: type === 'MULTI' ? (stations[0]?.performerId || '') : performerId,
      performerName: type === 'MULTI' ? (stations[0]?.performerName || '') : (performer?.fullName || ''),
      performerPersonnelCode: type === 'MULTI' ? (stations[0]?.performerPersonnelCode || '') : (performer?.personnelCode || ''),
      title,
      description,
      createdAt: getTehranTime().toISOString(),
      deadlineDate: type === 'MULTI' ? (stations[stations.length-1]?.deadlineDate || getTehranTime().toISOString()) : deadlineDate,
      expectedProgress: 100,
      actualProgress: 0,
      isPerformerCompleted: false,
      isRequesterFinished: false,
      comments: [],
      type,
      isParallel: type === 'MULTI' ? isParallel : false,
      stations: type === 'MULTI' ? stations : undefined,
      currentStationIndex: type === 'MULTI' ? 0 : undefined,
      labels: [],
    };

    upsertTask(newTask);
    navigate('/');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="glass p-8 rounded-[2.5rem] border-white/10 shadow-2xl animate-in slide-in-from-bottom-4 duration-500">
        <h2 className="text-3xl font-black mb-8 flex items-center gap-3">
          <Plus className="text-blue-500" size={32} />
          {id ? 'ویرایش اطلاعات درخواست' : 'ثبت درخواست جدید در سامانه'}
        </h2>

        {error && (
          <div className="mb-6 bg-red-500/20 border border-red-500/30 p-4 rounded-2xl flex items-center gap-3 text-red-400 text-sm font-black animate-in fade-in">
            <AlertTriangle size={20} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-2">
            <label className="text-xs font-black text-white/30 mr-2 uppercase tracking-widest">نوع ساختار درخواست</label>
            <div className="flex glass p-1 rounded-2xl bg-white/5 border border-white/5 max-w-sm">
              <button type="button" onClick={() => setType('SINGLE')} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${type === 'SINGLE' ? 'bg-blue-600 shadow-lg' : 'hover:bg-white/5'}`}>تک‌مرحله‌ای (ساده)</button>
              <button type="button" onClick={() => setType('MULTI')} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${type === 'MULTI' ? 'bg-blue-600 shadow-lg' : 'hover:bg-white/5'}`}>گردش کار (ایستگاهی)</button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-white/30 mr-2 uppercase tracking-widest">عنوان اصلی درخواست</label>
            <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full glass bg-white/5 border border-white/10 p-4 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/30 outline-none font-bold" placeholder="عنوان درخواست را وارد کنید..." />
          </div>

          {type === 'SINGLE' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-xs font-black text-white/30 mr-2 uppercase tracking-widest">انجام‌دهنده نهایی</label>
                <select required value={performerId} onChange={e => setPerformerId(e.target.value)} className="w-full glass bg-slate-800 border border-white/10 p-3.5 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500/30">
                  <option value="" className="bg-slate-900">انتخاب شخص...</option>
                  {users.map(u => <option key={u.id} value={u.id} className="bg-slate-900">{u.fullName} ({u.position})</option>)}
                </select>
              </div>
              <JalaliPicker label="مهلت زمانی تحویل" value={deadlineDate} onChange={setDeadlineDate} />
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex justify-between items-center bg-blue-500/10 p-5 rounded-[2rem] border border-blue-500/20 shadow-inner">
                <div className="flex items-center gap-4">
                  <Zap size={24} className="text-blue-400" />
                  <div>
                    <p className="text-sm font-black">حالت ارسال همزمان (موازی)</p>
                    <p className="text-[10px] text-white/40 font-bold">تمامی ایستگاه‌ها همزمان ایجاد می‌شوند.</p>
                  </div>
                </div>
                <button type="button" onClick={() => setIsParallel(!isParallel)} className={`w-14 h-7 rounded-full transition-all relative shadow-lg ${isParallel ? 'bg-blue-600' : 'bg-white/10'}`}>
                  <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-md ${isParallel ? 'right-8' : 'right-1'}`} />
                </button>
              </div>

              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <label className="text-lg font-black flex items-center gap-2"><Layers size={20} className="text-blue-400"/> ایستگاه‌های گردش کار</label>
                <button type="button" onClick={addStation} className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-6 py-2.5 rounded-2xl flex items-center gap-2 hover:bg-emerald-500/20 transition-all font-black">+ افزودن ایستگاه</button>
              </div>

              <div className="space-y-6">
                {stations.map((s, i) => (
                  <div key={s.id} className="glass p-8 rounded-[2rem] space-y-6 border-white/10 bg-white/5 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-1 h-full bg-blue-500 group-hover:bg-blue-600" />
                    <div className="flex justify-between items-center">
                      <span className="bg-blue-600/20 text-blue-400 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-500/20">ایستگاه شماره {i+1}</span>
                      <button onClick={() => setStations(stations.filter((_, idx) => idx !== i))} type="button" className="text-red-400 p-2 hover:bg-red-400/10 rounded-xl transition-all"><Trash2 size={18}/></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/30 mr-1 uppercase tracking-widest">مسئول ایستگاه</label>
                        <select required value={s.performerId} onChange={e => updateStation(i, 'performerId', e.target.value)} className="w-full bg-slate-800 border border-white/10 rounded-2xl p-3 text-sm outline-none">
                          <option value="" className="bg-slate-900">انتخاب شخص...</option>
                          {users.map(u => <option key={u.id} value={u.id} className="bg-slate-900">{u.fullName} ({u.position})</option>)}
                        </select>
                      </div>
                      <JalaliPicker label="مهلت ایستگاه" value={s.deadlineDate} onChange={(v) => updateStation(i, 'deadlineDate', v)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-white/30 mr-1 uppercase tracking-widest">توضیحات اختصاصی ایستگاه</label>
                      <textarea rows={2} value={s.description} onChange={e => updateStation(i, 'description', e.target.value)} className="w-full bg-slate-800 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none" placeholder="شرح وظیفه این ایستگاه..." />
                    </div>
                  </div>
                ))}
                {stations.length === 0 && <div className="text-center py-10 opacity-20 italic text-sm border-2 border-dashed border-white/5 rounded-3xl">هنوز ایستگاهی تعریف نکرده‌اید.</div>}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-black text-white/30 mr-2 uppercase tracking-widest">شرح کلی و مستندات</label>
            <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} className="w-full glass bg-white/5 border border-white/10 p-5 rounded-[2rem] text-sm focus:ring-2 focus:ring-blue-500/30 outline-none" placeholder="توضیحات کامل درخواست..." />
          </div>

          <div className="pt-10 flex justify-end gap-6 border-t border-white/5">
            <button type="button" onClick={() => navigate(-1)} className="px-8 py-4 text-white/40 font-black hover:text-white transition-colors">انصراف</button>
            <button type="submit" className="metallic-btn bg-blue-600 px-14 py-4 rounded-[1.5rem] font-black shadow-2xl flex items-center gap-3">ثبت و ارسال نهایی <ArrowRight size={20}/></button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskForm;
