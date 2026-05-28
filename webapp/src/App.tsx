
import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider, useStore } from './context/StoreContext';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import TaskForm from './components/TaskForm';
import TaskDetail from './components/TaskDetail';
import TaskList from './components/TaskList';
import AdminPanel from './components/AdminPanel';
import Contacts from './components/Contacts';
import Help from './components/Help';
import Settings from './components/Settings';
import SendMessage from './components/SendMessage';
import SendLetter from './components/SendLetter';
import Drafts from './components/Drafts';
import { AlertCircle, Loader2 } from 'lucide-react';
import { ToastContainer } from 'react-toastify';

const AppContent: React.FC = () => {
  const { currentUser, isLoading } = useStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView />;
  }

  return (
    <Layout>
      <ToastContainer 
        position="top-center" 
        autoClose={3000} 
        rtl={true} 
        theme="dark" 
        toastClassName="!bg-slate-800 !text-white !font-bold !rounded-xl !shadow-2xl !border !border-white/10"
      />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Navigate to="/" />} />
        <Route path="/create-task" element={<TaskForm />} />
        <Route path="/edit-task/:id" element={<TaskForm />} />
        <Route path="/task/:id" element={<TaskDetail />} />
        <Route path="/received" element={<TaskList context="RECEIVED" />} />
        <Route path="/sent" element={<TaskList context="SENT" />} />
        <Route path="/messages" element={<SendMessage />} />
        <Route path="/letters" element={<Drafts />} />
        <Route path="/letters/edit/:id" element={<SendLetter />} />
        <Route path="/admin" element={currentUser.role === 'ADMIN' ? <AdminPanel /> : <Navigate to="/" />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/help" element={<Help />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
};

const LoginView: React.FC = () => {
  const { login } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);
    
    try {
      const success = await login(username, password);
      if (!success) {
        setError('نام کاربری یا رمز عبور اشتباه است.');
      }
    } catch (err) {
      setError('خطا در برقراری ارتباط با سرور.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full glass p-12 rounded-[3.5rem] shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-700">
        <div className="text-center mb-12">
          <div className="w-24 h-24 bg-blue-600 rounded-[2rem] mx-auto flex items-center justify-center mb-8 shadow-2xl shadow-blue-600/30 transform rotate-12">
             <span className="text-5xl font-black text-white -rotate-12">P</span>
          </div>
          <h1 className="text-4xl font-black mb-2 tracking-tight">خوش آمدید</h1>
          <p className="text-white/30 text-[10px] font-bold uppercase tracking-[0.3em]">PanTask Professional ERP</p>
          <div className="mt-2 text-[9px] text-white/20 bg-white/5 py-1 px-3 rounded-full inline-block">
             Admin: admin / admin
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-white/40 mr-2 uppercase tracking-widest">نام کاربری</label>
            <input 
              required
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              className="w-full glass bg-white/5 border border-white/10 rounded-2xl p-4 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all text-sm font-bold" 
              placeholder="Username" 
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-white/40 mr-2 uppercase tracking-widest">رمز عبور</label>
            <input 
              required
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="w-full glass bg-white/5 border border-white/10 rounded-2xl p-4 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all text-sm font-bold" 
              placeholder="••••••••" 
            />
          </div>
          {error && <div className="flex items-center gap-2 text-red-400 text-[10px] font-black justify-center bg-red-400/10 py-2 rounded-xl border border-red-400/20"><AlertCircle size={12}/> {error}</div>}
          <button 
            type="submit" 
            disabled={isLoggingIn}
            className="w-full metallic-btn bg-blue-600 py-4 rounded-[1.5rem] font-black text-lg shadow-xl shadow-blue-600/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {isLoggingIn ? <Loader2 className="animate-spin" size={24} /> : 'ورود به پنل'}
          </button>
        </form>
      </div>
    </div>
  );
};

const App: React.FC = () => (
  <StoreProvider>
    <Router>
      <AppContent />
    </Router>
  </StoreProvider>
);

export default App;
