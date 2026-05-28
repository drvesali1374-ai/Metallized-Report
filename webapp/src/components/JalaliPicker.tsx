
import React, { useState } from 'react';
import { Calendar as CalendarIcon, Clock, X, Check } from 'lucide-react';
import { getTehranTime, getJalaliParts, getDaysInJalaliMonth, JALALI_MONTHS, jalaliToGregorian } from '../utils/jalali';

interface Props {
  value: string;
  onChange: (val: string) => void;
  label: string;
}

const JalaliPicker: React.FC<Props> = ({ value, onChange, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const now = getTehranTime();
  const currentJ = getJalaliParts(value ? new Date(value) : now);
  
  const [year, setYear] = useState(currentJ.year);
  const [month, setMonth] = useState(currentJ.month);
  const [day, setDay] = useState(currentJ.day);
  const [hour, setHour] = useState(value ? new Date(value).getHours() : 12);
  const [minute, setMinute] = useState(value ? new Date(value).getMinutes() : 0);

  const handleConfirm = () => {
    const newDate = jalaliToGregorian(year, month, day, hour, minute);
    onChange(newDate.toISOString());
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <label className="text-[10px] font-bold text-white/40 mb-1 block mr-2">{label}</label>
      <button 
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full glass bg-transparent border border-white/10 p-2.5 rounded-xl flex items-center justify-between text-sm"
      >
        <span className="font-bold">
          {value ? new Intl.DateTimeFormat('fa-IR', { calendar: 'persian', dateStyle: 'long', timeStyle: 'short' }).format(new Date(value)) : 'انتخاب زمان...'}
        </span>
        <CalendarIcon size={16} className="text-blue-400" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass p-6 rounded-3xl w-full max-w-sm border-blue-500/30 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black">انتخاب تاریخ و ساعت</h3>
              <button onClick={() => setIsOpen(false)} className="text-white/40 hover:text-white"><X size={20}/></button>
            </div>

            <div className="space-y-6">
              {/* Correct Order: Year (Left), Month (Middle), Day (Right) */}
              <div className="grid grid-cols-3 gap-2" dir="ltr">
                <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="bg-slate-800 border border-white/10 rounded-lg p-2 text-xs">
                  {[1403, 1404, 1405, 1406].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="bg-slate-800 border border-white/10 rounded-lg p-2 text-xs">
                  {JALALI_MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
                <select value={day} onChange={e => setDay(parseInt(e.target.value))} className="bg-slate-800 border border-white/10 rounded-lg p-2 text-xs">
                  {Array.from({ length: getDaysInJalaliMonth(year, month) }).map((_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                </select>
              </div>

              {/* Time Picker: Hour (Left), Minute (Right) */}
              <div className="flex items-center justify-center gap-4 bg-white/5 p-4 rounded-2xl" dir="ltr">
                <Clock size={20} className="text-blue-400" />
                <input type="number" min="0" max="23" value={hour} onChange={e => setHour(parseInt(e.target.value))} className="w-12 bg-transparent text-center font-bold text-xl focus:outline-none" />
                <span className="text-xl">:</span>
                <input type="number" min="0" max="59" value={minute} onChange={e => setMinute(parseInt(e.target.value))} className="w-12 bg-transparent text-center font-bold text-xl focus:outline-none" />
              </div>

              <button 
                onClick={handleConfirm}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-black shadow-lg flex items-center justify-center gap-2"
              >
                <Check size={18} /> تایید و ثبت
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JalaliPicker;
