
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, Inbox, Send, ChevronRight, ChevronLeft, 
  Settings, Users, HelpCircle, User as UserIcon, 
  PlusCircle, MessageSquare, FileText, Contact
} from 'lucide-react';
import { useStore } from '../context/StoreContext';

const Sidebar: React.FC<{ collapsed: boolean, setCollapsed: (v: boolean) => void }> = ({ collapsed, setCollapsed }) => {
  const { currentUser, systemSettings } = useStore();
  const location = useLocation();

  const navItem = (to: string, icon: React.ReactNode, label: string) => {
    const active = location.pathname === to;
    return (
      <Link to={to} className={`flex items-center gap-3 p-4 rounded-2xl transition-all ${active ? 'bg-blue-600 shadow-xl text-white' : 'hover:bg-white/10'}`}>
        <span className="shrink-0">{icon}</span>
        {!collapsed && <span className="text-sm font-black">{label}</span>}
      </Link>
    );
  };

  return (
    <aside className={`glass-dark border-l transition-all duration-300 relative z-50 flex flex-col no-print ${collapsed ? 'w-24' : 'w-72'}`}>
      
      {/* Top Toggle Button - Absolute */}
      <button 
        onClick={() => setCollapsed(!collapsed)} 
        className="absolute top-6 left-4 p-2 hover:bg-white/10 rounded-xl transition-transform active:scale-90 z-20 text-white/50 hover:text-white"
      >
        {collapsed ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
      </button>

      {/* User Profile Section - Replaced Logo Area */}
      <div className={`flex flex-col items-center justify-center pt-10 pb-6 border-b border-white/5 transition-all duration-300 ${collapsed ? 'px-2' : 'px-6'}`}>
        <div className={`relative transition-all duration-500 ${collapsed ? 'w-12 h-12' : 'w-24 h-24 mb-4'}`}>
          <div className="w-full h-full rounded-[2rem] border-2 border-white/10 bg-slate-800 flex items-center justify-center overflow-hidden shadow-2xl">
             {currentUser?.profileImage ? (
                <img 
                  src={currentUser.profileImage} 
                  alt="Profile" 
                  className="w-full h-full object-cover" 
                  style={{ 
                    transform: `scale(${currentUser.profileZoom || 1}) translate(${(currentUser.profilePosX || 50) - 50}%, ${(currentUser.profilePosY || 50) - 50}%)` 
                  }}
                />
              ) : (
                <UserIcon size={collapsed ? 20 : 40} className="text-blue-400" />
              )}
          </div>
          <div className={`absolute bottom-0 right-0 border-2 border-slate-900 rounded-full bg-emerald-500 ${collapsed ? 'w-3 h-3' : 'w-5 h-5'}`}></div>
        </div>
        
        {!collapsed && (
          <div className="text-center animate-in fade-in slide-in-from-bottom-2">
             <h4 className="font-black text-lg truncate text-white">{currentUser?.fullName}</h4>
             <h5 className="text-xs text-blue-400 font-bold truncate mt-1">{currentUser?.position}</h5>
          </div>
        )}
      </div>

      <div className="flex-1 px-5 py-4 space-y-2 overflow-y-auto no-scrollbar">
        {navItem('/', <Home size={22} />, 'داشبورد')}
        {navItem('/received', <Inbox size={22} />, 'دریافتی')}
        {navItem('/sent', <Send size={22} />, 'ارسالی')}
        
        <Link to="/create-task" className={`flex items-center gap-3 p-4 rounded-2xl transition-all my-2 bg-blue-600/10 border border-blue-500/20 text-blue-400 hover:bg-blue-600 hover:text-white group`}>
          <PlusCircle size={22} className="shrink-0 group-hover:scale-110 transition-transform" />
          {!collapsed && <span className="text-sm font-black">درخواست جدید</span>}
        </Link>
        
        {navItem('/messages', <MessageSquare size={22} />, 'ارسال پیام')}
        {navItem('/letters', <FileText size={22} />, 'ارسال نامه')}
        
        <div className="pt-4 mt-4 border-t border-white/10 space-y-2">
          {currentUser?.role === 'ADMIN' 
            ? navItem('/admin', <Users size={22} />, 'مدیریت کاربران')
            : navItem('/contacts', <Contact size={22} />, 'مخاطبین')
          }
          {navItem('/settings', <Settings size={22} />, 'تنظیمات')}
          {navItem('/help', <HelpCircle size={22} />, 'راهنما')}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
