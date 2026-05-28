
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import Sidebar from './Sidebar';
import TopNav from './TopNav';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTheme } = useStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const getThemeClass = () => {
    switch (currentTheme) {
      case 'blue': return 'bg-slate-900 text-white';
      case 'green': return 'bg-emerald-950 text-white';
      case 'purple': return 'bg-indigo-950 text-white';
      case 'light': return 'bg-gray-200 text-slate-900';
      case 'wood': return 'bg-[#FDF5E6] text-[#5D4037]';
      case 'pink': return 'bg-[#FFF0F5] text-[#C2185B]';
      case 'teal': return 'bg-[#E0F2F1] text-[#004D40]';
      case 'sky': return 'bg-[#E3F2FD] text-[#0D47A1]';
      default: return 'bg-slate-900 text-white';
    }
  };

  const isLightMode = ['light', 'wood', 'pink', 'teal', 'sky'].includes(currentTheme);

  return (
    <div className={`min-h-screen flex ${getThemeClass()} transition-all duration-500 overflow-hidden ${isLightMode ? 'light-mode-active' : ''}`}>
      <style>{`
        .light-mode-active .glass { background: rgba(0, 0, 0, 0.05); border: 1px solid rgba(0, 0, 0, 0.1); }
        .light-mode-active .glass-dark { background: rgba(0, 0, 0, 0.1); border-left: 1px solid rgba(0, 0, 0, 0.1); }
        .light-mode-active input, .light-mode-active select, .light-mode-active textarea { color: inherit; background: rgba(0, 0, 0, 0.03) !important; border: 1px solid rgba(0,0,0,0.1) !important; }
        .light-mode-active .text-white\\/40 { color: rgba(0, 0, 0, 0.5); }
        .light-mode-active .text-white\\/50 { color: rgba(0, 0, 0, 0.6); }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; color: black !important; }
        }
      `}</style>
      <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="no-print"><TopNav /></div>
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto space-y-8 pt-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
