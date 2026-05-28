
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../context/StoreContext';
import { User, Signature } from '../types';
import { 
  UserPlus, Search, Trash2, Edit2, X, GitBranch, 
  Table as TableIcon, Plus, Minus, 
  User as UserIcon, Settings2, Users, Image as ImageIcon,
  PenTool, Check, Sliders, Eraser, Scissors, Sun, Contrast,
  Crop as CropIcon, ShieldCheck, Move, ZoomIn, ArrowRight
} from 'lucide-react';

const DefaultAvatar = ({ gender, className }: { gender: 'MALE' | 'FEMALE', className?: string }) => {
  if (gender === 'FEMALE') {
    return (
      <svg viewBox="0 0 64 64" className={className} fill="currentColor">
        <circle cx="32" cy="32" r="32" fill="#E0E7FF" />
        <path d="M32 12C24.8 12 19 17.8 19 25C19 32.2 24.8 38 32 38C39.2 38 45 32.2 45 25C45 17.8 39.2 12 32 12ZM32 42C21.3 42 12 47.3 12 54V58H52V54C52 47.3 42.7 42 32 42Z" fill="#818CF8"/>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" className={className} fill="currentColor">
      <circle cx="32" cy="32" r="32" fill="#E0E7FF" />
      <path d="M32 14C26.5 14 22 18.5 22 24C22 29.5 26.5 34 32 34C37.5 34 42 29.5 42 24C42 18.5 37.5 14 32 14ZM32 38C22 38 14 43 14 50V56H50V50C50 43 42 38 32 38Z" fill="#818CF8"/>
    </svg>
  );
};

interface ImageEditorProps {
  image: string;
  onSave: (processedImage: string) => void;
  onCancel: () => void;
}

const ImageEditor: React.FC<ImageEditorProps> = ({ image, onSave, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentImageSrc, setCurrentImageSrc] = useState(image);
  
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [removeBg, setRemoveBg] = useState(true);
  
  const [isCropMode, setIsCropMode] = useState(false);
  const [cropRect, setCropRect] = useState({ x: 50, y: 50, w: 200, h: 100 });
  const [activeHandle, setActiveHandle] = useState<string | null>(null);

  const applyFilters = useCallback((isFinal = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = currentImageSrc;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
      ctx.drawImage(img, 0, 0);
      ctx.filter = 'none';

      if (removeBg) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (r > 200 && g > 200 && b > 200) {
            data[i + 3] = 0; 
          }
        }
        ctx.putImageData(imageData, 0, 0);
      }

      if (isCropMode && !isFinal) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, canvas.width, cropRect.y);
        ctx.fillRect(0, cropRect.y + cropRect.h, canvas.width, canvas.height - (cropRect.y + cropRect.h));
        ctx.fillRect(0, cropRect.y, cropRect.x, cropRect.h);
        ctx.fillRect(cropRect.x + cropRect.w, cropRect.y, canvas.width - (cropRect.x + cropRect.w), cropRect.h);

        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);

        ctx.fillStyle = '#3b82f6';
        const hSize = 12;
        ctx.fillRect(cropRect.x - hSize/2, cropRect.y - hSize/2, hSize, hSize);
        ctx.fillRect(cropRect.x + cropRect.w - hSize/2, cropRect.y - hSize/2, hSize, hSize);
        ctx.fillRect(cropRect.x - hSize/2, cropRect.y + cropRect.h - hSize/2, hSize, hSize);
        ctx.fillRect(cropRect.x + cropRect.w - hSize/2, cropRect.y + cropRect.h - hSize/2, hSize, hSize);
      }
    };
  }, [currentImageSrc, brightness, contrast, removeBg, isCropMode, cropRect]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isCropMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const x = (e.clientX - rect.left) * scale;
    const y = (e.clientY - rect.top) * scale;
    
    const hSize = 30; 
    if (Math.abs(x - cropRect.x) < hSize && Math.abs(y - cropRect.y) < hSize) setActiveHandle('TL');
    else if (Math.abs(x - (cropRect.x + cropRect.w)) < hSize && Math.abs(y - cropRect.y) < hSize) setActiveHandle('TR');
    else if (Math.abs(x - cropRect.x) < hSize && Math.abs(y - (cropRect.y + cropRect.h)) < hSize) setActiveHandle('BL');
    else if (Math.abs(x - (cropRect.x + cropRect.w)) < hSize && Math.abs(y - (cropRect.y + cropRect.h)) < hSize) setActiveHandle('BR');
    else if (x > cropRect.x && x < cropRect.x + cropRect.w && y > cropRect.y && y < cropRect.y + cropRect.h) setActiveHandle('MOVE');
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!activeHandle || !isCropMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const dx = e.movementX * scale;
    const dy = e.movementY * scale;

    setCropRect(prev => {
      let { x, y, w, h } = prev;
      if (activeHandle === 'TL') { x += dx; y += dy; w -= dx; h -= dy; }
      else if (activeHandle === 'TR') { y += dy; w += dx; h -= dy; }
      else if (activeHandle === 'BL') { x += dx; w -= dx; h += dy; }
      else if (activeHandle === 'BR') { w += dx; h += dy; }
      else if (activeHandle === 'MOVE') { x += dx; y += dy; }

      x = Math.max(0, Math.min(x, canvas.width - 20));
      y = Math.max(0, Math.min(y, canvas.height - 20));
      w = Math.max(20, Math.min(w, canvas.width - x));
      h = Math.max(20, Math.min(h, canvas.height - y));

      return { x, y, w, h };
    });
  };

  const handleMouseUp = () => setActiveHandle(null);

  const handleApplyCrop = () => {
    const imgElement = new Image();
    imgElement.src = currentImageSrc;
    imgElement.onload = () => {
      const fullCanvas = document.createElement('canvas');
      fullCanvas.width = imgElement.width;
      fullCanvas.height = imgElement.height;
      const fCtx = fullCanvas.getContext('2d');
      if (!fCtx) return;

      // Redraw image with filters but WITHOUT crop overlay
      fCtx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
      fCtx.drawImage(imgElement, 0, 0);
      fCtx.filter = 'none';

      if (removeBg) {
        const imageData = fCtx.getImageData(0, 0, fullCanvas.width, fullCanvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (r > 200 && g > 200 && b > 200) {
            data[i + 3] = 0; 
          }
        }
        fCtx.putImageData(imageData, 0, 0);
      }

      // Now crop from the clean canvas
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = Math.abs(cropRect.w);
      cropCanvas.height = Math.abs(cropRect.h);
      const cCtx = cropCanvas.getContext('2d');
      if (!cCtx) return;

      cCtx.drawImage(
        fullCanvas, 
        cropRect.x, cropRect.y, cropRect.w, cropRect.h,
        0, 0, cropRect.w, cropRect.h
      );

      setCurrentImageSrc(cropCanvas.toDataURL('image/png'));
      setIsCropMode(false);
      setCropRect({ x: 0, y: 0, w: cropCanvas.width, h: cropCanvas.height });
    };
  };

  const handleFinalSave = () => {
    // For final save, we also ensure we grab the current state cleanly
    const imgElement = new Image();
    imgElement.src = currentImageSrc;
    imgElement.onload = () => {
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = imgElement.width;
        finalCanvas.height = imgElement.height;
        const ctx = finalCanvas.getContext('2d');
        if (!ctx) return;

        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
        ctx.drawImage(imgElement, 0, 0);
        ctx.filter = 'none';

        if (removeBg) {
          const imageData = ctx.getImageData(0, 0, finalCanvas.width, finalCanvas.height);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
             const r = data[i];
             const g = data[i + 1];
             const b = data[i + 2];
             if (r > 200 && g > 200 && b > 200) data[i + 3] = 0; 
          }
          ctx.putImageData(imageData, 0, 0);
        }
        
        onSave(finalCanvas.toDataURL('image/png'));
    };
  };

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl" style={{ width: '100vw', height: '100vh' }}>
      <div className="glass-dark p-8 rounded-[3rem] w-full max-w-4xl space-y-8 border-white/20">
        <div className="flex justify-between items-center border-b border-white/10 pb-4">
          <h3 className="text-xl font-black flex items-center gap-2 text-emerald-400"><Scissors size={20} /> ویرایش و برش هوشمند تصویر</h3>
          <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-full"><X size={24}/></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-3 aspect-video glass rounded-3xl overflow-hidden flex items-center justify-center bg-white/5 relative shadow-inner select-none">
            <canvas 
              ref={canvasRef} 
              className="max-w-full max-h-full object-contain" 
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>

          <div className="space-y-4">
            <button 
              onClick={() => setIsCropMode(!isCropMode)} 
              className={`w-full p-4 rounded-2xl flex items-center justify-between font-black text-xs transition-all border ${isCropMode ? 'bg-blue-600 border-blue-400' : 'glass hover:bg-white/10 border-white/10'}`}
            >
              <div className="flex items-center gap-2"><CropIcon size={16}/> کادر برش</div>
              {isCropMode ? <Check size={16}/> : <Plus size={16}/>}
            </button>

            {isCropMode && (
              <button onClick={handleApplyCrop} className="w-full bg-emerald-600 py-3 rounded-2xl font-black text-[10px] animate-in slide-in-from-top-2 flex items-center justify-center gap-2">
                <Check size={14}/> اعمال برش
              </button>
            )}

            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-white/40 flex items-center gap-2 uppercase tracking-widest"><Sun size={12}/> روشنایی</label>
                <input type="range" min="0" max="200" value={brightness} onChange={e => setBrightness(Number(e.target.value))} className="w-full h-1.5 bg-white/10 rounded-full appearance-none accent-blue-500" />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-white/40 flex items-center gap-2 uppercase tracking-widest"><Contrast size={12}/> کنتراست</label>
                <input type="range" min="0" max="200" value={contrast} onChange={e => setContrast(Number(e.target.value))} className="w-full h-1.5 bg-white/10 rounded-full appearance-none accent-blue-500" />
              </div>
              <div className="flex items-center justify-between p-4 glass rounded-2xl border-white/5 bg-white/5">
                <span className="text-xs font-black flex items-center gap-2"><Eraser size={14}/> حذف زمینه سفید</span>
                <button 
                  onClick={() => setRemoveBg(!removeBg)} 
                  className={`w-10 h-5 rounded-full flex items-center px-0.5 transition-all ${removeBg ? 'bg-emerald-600 justify-end' : 'bg-white/10 justify-start'}`}
                  dir="ltr"
                >
                  <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t border-white/10">
          <button onClick={onCancel} className="px-8 py-3 text-white/40 font-black hover:text-white transition-colors">انصراف</button>
          <button onClick={handleFinalSave} className="bg-emerald-600 px-12 py-3 rounded-2xl font-black text-white shadow-xl flex items-center gap-2 hover:bg-emerald-500 transition-all">
            <Check size={18}/> ذخیره نهایی تغییرات
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const AdminPanel: React.FC = () => {
  const { users, addUser, updateUser, deleteUser, units, addUnit } = useStore();
  const [view, setView] = useState<'TABLE' | 'TREE'>('TABLE');
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
  // Editor states
  const [editingSignature, setEditingSignature] = useState<{ index: number; data: string } | null>(null);
  const [editingProfile, setEditingProfile] = useState<boolean>(false);

  const emptyForm: Partial<User> = {
    username: '', password: '', fullName: '', personnelCode: '',
    gender: 'MALE', email: '', phone: '', unit: '', position: '', 
    honorablePosition: '', directManagerId: '', role: 'USER', isFirstLogin: true,
    profileZoom: 1, profilePosX: 50, profilePosY: 50, signatures: []
  };

  const [formData, setFormData] = useState<Partial<User>>(emptyForm);

  useEffect(() => {
    if (showModal) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [showModal]);

  const toggleNode = useCallback((id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openAddModal = () => {
    setFormData(emptyForm);
    setIsEditMode(false);
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setFormData({ ...user, signatures: user.signatures || [] });
    setIsEditMode(true);
    setShowModal(true);
  };

  const filteredUsers = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return users.filter(u => 
      u.fullName.toLowerCase().includes(q) || 
      u.personnelCode.toLowerCase().includes(q) || 
      u.unit.toLowerCase().includes(q)
    );
  }, [users, searchTerm]);

  const getSubordinateIds = useCallback((managerId: string): Set<string> => {
    const result = new Set<string>();
    const stack = [managerId];
    const visited = new Set<string>();
    while (stack.length > 0) {
      const currentId = stack.pop()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      const directSubs = users.filter(u => u.directManagerId === currentId);
      directSubs.forEach(sub => {
        result.add(sub.id);
        stack.push(sub.id);
      });
    }
    return result;
  }, [users]);

  const availableManagers = useMemo(() => {
    const currentId = formData.id || '';
    if (!isEditMode || !currentId) return users;
    const subordinateIds = getSubordinateIds(currentId);
    return users.filter(u => u.id !== currentId && !subordinateIds.has(u.id));
  }, [users, isEditMode, formData.id, getSubordinateIds]);

  const UserAvatar = ({ user, size = "w-10 h-10" }: { user: User, size?: string }) => (
    <div className={`${size} rounded-xl bg-slate-800 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center`}>
      {user.profileImage ? (
        <img 
          src={user.profileImage} 
          className="w-full h-full object-cover" 
          style={{ 
            transform: `scale(${user.profileZoom || 1}) translate(${(user.profilePosX || 50) - 50}%, ${(user.profilePosY || 50) - 50}%)` 
          }} 
          alt="" 
        />
      ) : (
        <DefaultAvatar gender={user.gender} className="w-full h-full p-1" />
      )}
    </div>
  );

  const TreeItem: React.FC<{ user: User, level: number, visited: Set<string> }> = ({ user, level, visited }) => {
    if (visited.has(user.id)) return null;
    const nextVisited = new Set(visited);
    nextVisited.add(user.id);
    const subordinates = users.filter(u => u.directManagerId === user.id);
    const hasSubordinates = subordinates.length > 0;
    const isExpanded = expandedNodes.has(user.id);

    return (
      <div className="relative">
        <div className="flex items-center gap-3 py-2 group">
          <div className="flex items-center gap-3">
             <div className="flex items-center">
                {hasSubordinates ? (
                  <button type="button" onClick={() => toggleNode(user.id)} className="w-5 h-5 flex items-center justify-center bg-white/10 hover:bg-white/20 border border-white/20 rounded-md transition-all z-10">
                    {isExpanded ? <Minus size={12} /> : <Plus size={12} />}
                  </button>
                ) : (
                  <div className="w-5 h-5 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-white/20 rounded-full" />
                  </div>
                )}
             </div>
             <div className="glass px-4 py-2 rounded-2xl border border-white/5 flex items-center gap-3 min-w-[240px] shadow-lg hover:border-blue-500/50 transition-all">
                <UserAvatar user={user} size="w-8 h-8" />
                <div className="text-right flex-1">
                   <h4 className="text-xs font-black">{user.fullName}</h4>
                   <p className="text-[9px] text-white/40">{user.position} | {user.unit}</p>
                </div>
                <div className="flex gap-1">
                   <button type="button" onClick={() => openEditModal(user)} className="p-1.5 hover:bg-blue-500/20 text-blue-400 rounded-lg"><Edit2 size={12}/></button>
                </div>
             </div>
          </div>
        </div>
        {hasSubordinates && isExpanded && (
          <div className="mr-8 border-r border-dashed border-white/10 pr-2">
            {subordinates.map(sub => (
              <TreeItem key={sub.id} user={sub} level={level + 1} visited={nextVisited} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const rootUsers = useMemo(() => users.filter(u => !u.directManagerId || !users.some(parent => parent.id === u.directManagerId)), [users]);

  const handleAddOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalData = { ...formData } as User;
    if (isEditMode) await updateUser(finalData);
    else {
      finalData.id = Math.random().toString(36).substr(2, 9);
      await addUser(finalData);
    }
    setShowModal(false);
  };

  const addSignature = () => {
    if ((formData.signatures?.length || 0) >= 2) return alert('حداکثر ۲ امضا مجاز است.');
    const newSigs = [...(formData.signatures || []), { id: Math.random().toString(36).substr(2, 9), name: '', image: '' }];
    setFormData({ ...formData, signatures: newSigs });
  };

  const updateSignature = (index: number, field: keyof Signature, value: string) => {
    const newSigs = [...(formData.signatures || [])];
    newSigs[index] = { ...newSigs[index], [field]: value };
    setFormData({ ...formData, signatures: newSigs });
  };

  const removeSignature = (index: number) => {
    const newSigs = (formData.signatures || []).filter((_, i) => i !== index);
    setFormData({ ...formData, signatures: newSigs });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black">مدیریت کاربران</h1>
          <p className="text-white/40 text-sm">پرسنل و چارت سازمانی سیستم</p>
        </div>
        <div className="flex gap-4">
          <div className="glass p-1 rounded-2xl flex">
            <button type="button" onClick={() => setView('TABLE')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${view === 'TABLE' ? 'bg-blue-600 shadow-lg' : 'hover:bg-white/5'}`}><TableIcon size={16}/> لیست</button>
            <button type="button" onClick={() => setView('TREE')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${view === 'TREE' ? 'bg-blue-600 shadow-lg' : 'hover:bg-white/5'}`}><GitBranch size={16}/> چارت</button>
          </div>
          <button type="button" onClick={openAddModal} className="metallic-btn bg-blue-600 px-6 py-2.5 rounded-2xl font-black text-sm flex items-center gap-2">
            <UserPlus size={18} /> افزودن کاربر
          </button>
        </div>
      </header>

      {showModal && createPortal(
        <div className="fixed inset-0 z-[200] bg-slate-950 backdrop-blur-xl animate-in fade-in w-screen h-screen flex flex-col" style={{ width: '100vw', height: '100vh' }}>
          <div className="flex flex-col h-full w-full">
             <header className="px-8 py-4 border-b border-white/5 flex items-center shrink-0 bg-slate-900/80 gap-6 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-emerald-600/20 rounded-xl flex items-center justify-center text-emerald-400">
                    <UserPlus size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black">{isEditMode ? 'ویرایش پروفایل' : 'تعریف پرسنل جدید'}</h2>
                    <p className="text-[10px] text-white/30">مشخصات فردی و سازمانی</p>
                  </div>
                </div>
                
                {/* Modified Buttons Position: Right side after text */}
                <div className="flex items-center gap-3 mr-auto md:mr-0">
                   <button onClick={handleAddOrUpdate} className="bg-emerald-600 hover:bg-emerald-500 px-8 py-3 rounded-xl font-black text-xs shadow-lg shadow-emerald-600/20 transition-all active:scale-95 flex items-center gap-2">
                      <Check size={16} /> تایید و ثبت نهایی
                   </button>
                   <button onClick={() => setShowModal(false)} className="px-6 py-3 rounded-xl text-white/40 hover:text-white font-black text-xs transition-colors border border-transparent hover:bg-white/5">
                      انصراف
                   </button>
                </div>
             </header>
             
             <div className="flex-1 overflow-y-auto custom-scroll p-8 pb-20">
                <form onSubmit={(e) => e.preventDefault()} className="max-w-7xl mx-auto space-y-8">
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    <div className="lg:col-span-3 space-y-8">
                      <section className="space-y-6">
                        <h3 className="text-xs font-black text-blue-400 flex items-center gap-2 border-b border-white/5 pb-3 uppercase tracking-widest"><Settings2 size={14}/> اطلاعات پایه</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-white/40 mr-1">نام و نام خانوادگی</label>
                            <input type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="w-full glass bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-bold focus:ring-2 focus:ring-blue-500/30 outline-none" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-white/40 mr-1">کد پرسنلی</label>
                            <input type="text" value={formData.personnelCode} onChange={e => setFormData({...formData, personnelCode: e.target.value})} className="w-full glass bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-bold focus:ring-2 focus:ring-blue-500/30 outline-none" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-white/40 mr-1">نام کاربری</label>
                            <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full glass bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-bold focus:ring-2 focus:ring-blue-500/30 outline-none" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-white/40 mr-1">رمز عبور</label>
                            <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full glass bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-bold focus:ring-2 focus:ring-blue-500/30 outline-none" />
                          </div>
                        </div>
                      </section>

                      <section className="space-y-6">
                        <h3 className="text-xs font-black text-purple-400 flex items-center gap-2 border-b border-white/5 pb-3 uppercase tracking-widest"><GitBranch size={14}/> جایگاه سازمانی</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-white/40 mr-1">واحد سازمانی</label>
                            <select value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full glass bg-slate-800 border border-white/10 rounded-xl p-3 text-xs font-bold outline-none">
                                <option value="">انتخاب کنید...</option>
                                {units.map(u => <option key={u} value={u} className="bg-slate-900">{u}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-white/40 mr-1">سمت</label>
                            <input type="text" value={formData.position} onChange={e => setFormData({...formData, position: e.target.value})} className="w-full glass bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-bold outline-none" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-white/40 mr-1">عنوان محترمانه</label>
                            <input type="text" value={formData.honorablePosition} onChange={e => setFormData({...formData, honorablePosition: e.target.value})} className="w-full glass bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-bold outline-none" placeholder="مثلاً: مدیریت محترم واحد فنی" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-white/40 mr-1">مدیر مستقیم</label>
                            <select value={formData.directManagerId} onChange={e => setFormData({...formData, directManagerId: e.target.value})} className="w-full glass bg-slate-800 border border-white/10 rounded-xl p-3 text-xs font-bold outline-none">
                                <option value="">بدون مدیر (ریشه چارت)</option>
                                {availableManagers.map(u => <option key={u.id} value={u.id} className="bg-slate-900">{u.fullName} ({u.unit})</option>)}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-white/40 mr-1">نقش سیستم</label>
                            <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as any})} className="w-full glass bg-slate-800 border border-white/10 rounded-xl p-3 text-xs font-bold outline-none">
                                <option value="USER" className="bg-slate-900">کاربر عادی</option>
                                <option value="ADMIN" className="bg-slate-900">مدیر سیستم (ادمین)</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-white/40 mr-1">جنسیت</label>
                            <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value as any})} className="w-full glass bg-slate-800 border border-white/10 rounded-xl p-3 text-xs font-bold outline-none">
                                <option value="MALE" className="bg-slate-900">آقا</option>
                                <option value="FEMALE" className="bg-slate-900">خانم</option>
                            </select>
                          </div>
                        </div>
                      </section>

                      <section className="space-y-6 pt-6 border-t border-white/5">
                        <div className="flex justify-between items-center">
                          <h3 className="text-xs font-black text-emerald-400 flex items-center gap-2 uppercase tracking-widest"><PenTool size={14}/> امضاهای دیجیتال</h3>
                          <button type="button" onClick={addSignature} disabled={(formData.signatures?.length || 0) >= 2} className="px-4 py-2 bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-black hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-30">+ افزودن امضا</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {formData.signatures?.map((sig, index) => (
                            <div key={sig.id} className="glass p-4 rounded-2xl border-white/5 bg-white/5 space-y-3 relative group">
                              <button type="button" onClick={() => removeSignature(index)} className="absolute top-2 left-2 p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button>
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-white/40 mr-1 uppercase">عنوان</label>
                                <input type="text" value={sig.name} onChange={e => updateSignature(index, 'name', e.target.value)} className="w-full glass bg-slate-900/50 border border-white/10 rounded-lg p-2 text-xs font-bold" placeholder="عنوان امضا" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-white/40 mr-1 uppercase">فایل تصویر</label>
                                <div className="w-full aspect-[2/1] glass rounded-xl bg-white/5 border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden relative">
                                  {sig.image ? (
                                    <img src={sig.image} className="w-full h-full object-contain filter invert" alt="Signature" />
                                  ) : (
                                    <div className="flex flex-col items-center gap-2 opacity-20"><ImageIcon size={24} /> <span className="text-[9px] font-black">انتخاب</span></div>
                                  )}
                                  <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onload = () => setEditingSignature({ index, data: reader.result as string });
                                      reader.readAsDataURL(file);
                                    }
                                  }} />
                                  {sig.image && <button type="button" onClick={() => setEditingSignature({ index, data: sig.image })} className="absolute bottom-2 right-2 p-1.5 bg-blue-600 rounded-lg text-white shadow-lg"><Sliders size={12}/></button>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    </div>

                    <div className="flex flex-col items-center gap-6">
                      <div className="w-full aspect-square glass rounded-[3rem] overflow-hidden relative border-4 border-white/10 bg-slate-800/50 flex items-center justify-center group shadow-2xl">
                         {formData.profileImage ? (
                           <img 
                              src={formData.profileImage} 
                              alt="" 
                              className="w-full h-full object-cover" 
                              style={{ 
                                transform: `scale(${formData.profileZoom || 1}) translate(${(formData.profilePosX || 50) - 50}%, ${(formData.profilePosY || 50) - 50}%)` 
                              }}
                           />
                         ) : (
                           <DefaultAvatar gender={formData.gender || 'MALE'} className="w-full h-full" />
                         )}
                         <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => setFormData({ ...formData, profileImage: reader.result as string });
                              reader.readAsDataURL(file);
                            }
                          }} />
                      </div>
                      
                      {/* Profile Image Controls */}
                      <div className="w-full space-y-4 bg-white/5 p-4 rounded-3xl border border-white/5">
                        <div className="flex justify-between items-center">
                           <span className="text-[10px] font-black text-white/40">تنظیمات تصویر</span>
                           {formData.profileImage && (
                             <button type="button" onClick={() => setEditingProfile(true)} className="text-[10px] flex items-center gap-1 text-blue-400 hover:text-white transition-colors">
                               <CropIcon size={12}/> برش تصویر
                             </button>
                           )}
                        </div>
                        
                        <div className="space-y-1">
                          <label className="flex justify-between text-[9px] font-bold text-white/30"><span>بزرگنمایی</span> <span>{formData.profileZoom || 1}x</span></label>
                          <input type="range" min="0.5" max="3" step="0.1" value={formData.profileZoom || 1} onChange={e => setFormData({...formData, profileZoom: parseFloat(e.target.value)})} className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                             <label className="text-[9px] font-bold text-white/30">موقعیت افقی X</label>
                             <input type="range" min="0" max="100" value={formData.profilePosX ?? 50} onChange={e => setFormData({...formData, profilePosX: parseInt(e.target.value)})} className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[9px] font-bold text-white/30">موقعیت عمودی Y</label>
                             <input type="range" min="0" max="100" value={formData.profilePosY ?? 50} onChange={e => setFormData({...formData, profilePosY: parseInt(e.target.value)})} className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </form>
             </div>
          </div>
        </div>,
        document.body
      )}

      {editingSignature && (
        <ImageEditor 
          image={editingSignature.data}
          onSave={(processed) => {
            updateSignature(editingSignature.index, 'image', processed);
            setEditingSignature(null);
          }}
          onCancel={() => setEditingSignature(null)}
        />
      )}
      
      {editingProfile && formData.profileImage && (
        <ImageEditor 
          image={formData.profileImage}
          onSave={(processed) => {
            setFormData({...formData, profileImage: processed});
            setEditingProfile(false);
          }}
          onCancel={() => setEditingProfile(false)}
        />
      )}

      {view === 'TABLE' ? (
        <div className="glass p-8 rounded-[2.5rem] space-y-6 shadow-xl border-white/5">
           <div className="relative">
             <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20" size={20} />
             <input type="text" placeholder="جستجوی هوشمند در لیست پرسنل و واحدها..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full glass bg-transparent border border-white/10 rounded-2xl py-4 pr-12 text-sm font-bold focus:ring-2 focus:ring-blue-500/20" />
           </div>
           <table className="w-full text-right border-collapse">
             <thead><tr className="text-white/30 text-[10px] uppercase font-black tracking-widest border-b border-white/5">
               <th className="p-4">پرسنل</th>
               <th className="p-4">جنسیت</th>
               <th className="p-4">کد پرسنلی</th>
               <th className="p-4">سمت</th>
               <th className="p-4">واحد</th>
               <th className="p-4">مدیر مستقیم</th>
               <th className="p-4 text-center">امضاها</th>
               <th className="p-4">عملیات</th>
             </tr></thead>
             <tbody className="divide-y divide-white/5">
               {filteredUsers.map(u => (
                 <tr key={u.id} className="hover:bg-white/5 transition-colors group">
                   <td className="p-4"><div className="flex items-center gap-3"><UserAvatar user={u} /><div><p className="font-bold text-sm">{u.fullName}</p><p className="text-[10px] text-white/30 font-black">{u.username}</p></div></div></td>
                   <td className="p-4 text-xs font-black text-white/60">{u.gender === 'MALE' ? 'آقا' : 'خانم'}</td>
                   <td className="p-4 text-xs font-black text-white/60 tracking-widest">{u.personnelCode}</td>
                   <td className="p-4 text-xs font-black text-blue-400">{u.position}</td>
                   <td className="p-4"><span className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-lg text-[10px] font-black">{u.unit}</span></td>
                   <td className="p-4 text-xs font-black text-white/40">{users.find(m => m.id === u.directManagerId)?.fullName || '---'}</td>
                   <td className="p-4">
                     <div className="flex justify-center gap-1">
                        {u.signatures?.map((sig) => (
                          <div key={sig.id} className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center p-1" title={sig.name}>
                            <img src={sig.image} className="max-w-full max-h-full object-contain filter invert" alt="" />
                          </div>
                        ))}
                     </div>
                   </td>
                   <td className="p-4"><div className="flex gap-2"><button onClick={() => openEditModal(u)} className="p-2 hover:bg-blue-500/20 text-blue-400 rounded-xl transition-all"><Edit2 size={16}/></button><button onClick={() => deleteUser(u.id)} className="p-2 hover:bg-red-500/20 text-red-400 rounded-xl transition-all"><Trash2 size={16}/></button></div></td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>
      ) : (
        <div className="glass p-12 rounded-[2.5rem] min-h-[600px] overflow-auto relative custom-scroll shadow-2xl border-white/5">
           {rootUsers.length > 0 ? rootUsers.map(root => <TreeItem key={root.id} user={root} level={0} visited={new Set()} />) : <div className="text-center py-20 opacity-20 italic">هیچ کاربری در سیستم یافت نشد.</div>}
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
