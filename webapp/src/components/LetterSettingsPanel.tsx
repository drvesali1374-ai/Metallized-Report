/**
 * LetterSettingsPanel - Redesigned: independent dropdown menus that never overlap.
 *
 * FIX #2: Each settings group lives in its own button-triggered dropdown panel
 * rendered via portal at fixed coordinates so menus never overlap each other or
 * other UI. Only one menu can be open at a time. All previous fields are
 * preserved (page setup, header/date, margins, text styles, signature box).
 */
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Settings2, Ruler, Move, Maximize, ChevronDown,
  FileText, Type as TypeIcon, X
} from 'lucide-react';

// ----------------------------------------------------------------
// Number input - LTR direction, empty == 0
// ----------------------------------------------------------------
const NumInput: React.FC<{
  label?: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  className?: string;
}> = ({ label, value, onChange, step = 1, min = 0, max, className = '' }) => {
  const [raw, setRaw] = useState<string>(value === 0 ? '' : String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setRaw(value === 0 ? '' : String(value));
  }, [value, focused]);

  return (
    <div className={`space-y-1 ${className}`}>
      {label && <label className="text-[9px] text-white/50 block font-bold">{label}</label>}
      <input
        type="text"
        inputMode="decimal"
        value={focused ? raw : (value === 0 ? '' : String(value))}
        onChange={(e) => setRaw(e.target.value.replace(/[^0-9.]/g, ''))}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          const parsed = parseFloat(raw);
          const finalVal = isNaN(parsed) ? 0 : parsed;
          onChange(finalVal);
          setRaw(finalVal === 0 ? '' : String(finalVal));
        }}
        placeholder="0"
        dir="ltr"
        className="w-full bg-white/10 border border-white/15 p-2 rounded-lg text-[11px] font-bold text-center outline-none focus:ring-1 focus:ring-blue-500/50 transition-all text-white"
        style={{ textAlign: 'center', direction: 'ltr' }}
      />
    </div>
  );
};

// ----------------------------------------------------------------
// Settings interface (unchanged - all original fields preserved)
// ----------------------------------------------------------------
export interface LetterSettings {
  letterheadId: string;
  pageSize: 'A4' | 'A5';
  orientation: 'PORTRAIT' | 'LANDSCAPE';
  firstPageHeaderH: number;
  headerCoords: { x: number; y: number };
  headerColor: string;
  margins: { top: number; bottom: number; left: number; right: number };
  lineHeight: number;
  recipientColor: string;
  recipientFontSize: number;
  senderColor: string;
  senderFontSize: number;
  sigSize: { w: number; h: number };
}

interface LetterSettingsPanelProps {
  settings: LetterSettings;
  onChange: (updates: Partial<LetterSettings>) => void;
  letterheads: { id: string; name: string }[];
}

// ----------------------------------------------------------------
// DropdownMenu - one independent menu per group
// Rendered via portal so menus never overlap each other or stacking contexts.
// ----------------------------------------------------------------
interface DropdownMenuProps {
  id: string;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  title: string;
  icon?: React.ReactNode;
  width?: number;
  children: React.ReactNode;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({
  id, openId, setOpenId, title, icon, width = 280, children
}) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const open = openId === id;

  useLayoutEffect(() => {
    if (open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      // Place panel below the button, aligned to its right edge (RTL aware).
      // Clamp inside viewport.
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = r.right - width;
      if (left < 8) left = 8;
      if (left + width > vw - 8) left = vw - width - 8;
      let top = r.bottom + 6;
      // If menu would overflow bottom, place above
      // (Estimate menu height of ~280; will be clamped via maxHeight too)
      if (top + 320 > vh) {
        top = Math.max(8, r.top - 320);
      }
      setPos({ top, left });
    }
  }, [open, width]);

  // Outside click + Esc close
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(t) &&
        menuRef.current && !menuRef.current.contains(t)
      ) {
        setOpenId(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenId(null);
    };
    const handleResize = () => setOpenId(null);
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [open, setOpenId]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpenId(open ? null : id)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition-colors text-right ${
          open
            ? 'bg-blue-600/30 border-blue-400/50 text-white'
            : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20'
        }`}
      >
        <div className="flex items-center gap-2 font-black text-[11px]">
          {icon && <span className="text-current opacity-70">{icon}</span>}
          {title}
        </div>
        <ChevronDown
          size={14}
          className={`opacity-60 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="letter-settings-menu"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: `${width}px`,
            maxHeight: 'min(70vh, 460px)',
            overflowY: 'auto',
            zIndex: 10000,
            background: '#0f172a',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: '14px',
            padding: '14px',
            boxShadow: '0 30px 60px -12px rgba(0,0,0,0.85), 0 0 0 1px rgba(59,130,246,0.15)',
          }}
        >
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
            <div className="flex items-center gap-2 text-white/80 font-black text-[11px]">
              {icon}
              <span>{title}</span>
            </div>
            <button
              type="button"
              onClick={() => setOpenId(null)}
              className="p-1 hover:bg-white/10 rounded-md text-white/50 hover:text-white"
              title="بستن"
            >
              <X size={14} />
            </button>
          </div>
          <div className="space-y-3">
            {children}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

// ----------------------------------------------------------------
// Main panel
// ----------------------------------------------------------------
const LetterSettingsPanel: React.FC<LetterSettingsPanelProps> = ({
  settings, onChange, letterheads
}) => {
  const {
    letterheadId, pageSize, orientation, firstPageHeaderH,
    headerCoords, headerColor, margins, lineHeight,
    recipientColor, recipientFontSize, senderColor, senderFontSize, sigSize
  } = settings;

  // Only one menu can be open at any time => menus never overlap.
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="glass p-3 rounded-2xl border-white/10 shadow-xl sticky top-[6rem] space-y-2">
      <h3 className="font-black text-[10px] text-white/40 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-2 mb-1">
        <Settings2 size={12} /> تنظیمات نامه
      </h3>

      {/* ============== 1) Page setup ============== */}
      <DropdownMenu
        id="page"
        openId={openId}
        setOpenId={setOpenId}
        title="تنظیمات صفحه"
        icon={<FileText size={12} />}
      >
        <div className="space-y-1">
          <label className="text-[9px] text-white/50 block font-bold">سربرگ</label>
          <select
            value={letterheadId}
            onChange={e => onChange({ letterheadId: e.target.value })}
            className="w-full bg-slate-800 border border-white/15 p-2 rounded-lg text-[11px] font-bold outline-none text-white"
          >
            <option value="">بدون سربرگ</option>
            {letterheads.map(lh => <option key={lh.id} value={lh.id}>{lh.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[9px] text-white/50 block font-bold">اندازه کاغذ</label>
            <select
              value={pageSize}
              onChange={e => onChange({ pageSize: e.target.value as any })}
              className="w-full bg-slate-800 border border-white/15 p-2 rounded-lg text-[11px] font-bold outline-none text-white"
            >
              <option value="A4">A4</option>
              <option value="A5">A5</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] text-white/50 block font-bold">جهت</label>
            <select
              value={orientation}
              onChange={e => onChange({ orientation: e.target.value as any })}
              className="w-full bg-slate-800 border border-white/15 p-2 rounded-lg text-[11px] font-bold outline-none text-white"
            >
              <option value="PORTRAIT">عمودی</option>
              <option value="LANDSCAPE">افقی</option>
            </select>
          </div>
        </div>
      </DropdownMenu>

      {/* ============== 2) Header / date block ============== */}
      <DropdownMenu
        id="header"
        openId={openId}
        setOpenId={setOpenId}
        title="سربرگ و بلوک تاریخ"
        icon={<Move size={12} />}
      >
        <NumInput
          label="فضای مقدمه (mm)"
          value={firstPageHeaderH}
          onChange={v => onChange({ firstPageHeaderH: v })}
        />
        <div className="grid grid-cols-2 gap-2">
          <NumInput
            label="موقعیت عمودی (mm)"
            value={headerCoords.y}
            onChange={v => onChange({ headerCoords: { ...headerCoords, y: v } })}
          />
          <NumInput
            label="موقعیت افقی (mm)"
            value={headerCoords.x}
            onChange={v => onChange({ headerCoords: { ...headerCoords, x: v } })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] text-white/50 block font-bold">رنگ تاریخ/شماره</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={headerColor}
              onChange={e => onChange({ headerColor: e.target.value })}
              className="w-10 h-8 rounded-lg bg-transparent border border-white/15 cursor-pointer"
            />
            <span className="text-[10px] text-white/50 font-mono">{headerColor}</span>
          </div>
        </div>
      </DropdownMenu>

      {/* ============== 3) Margins ============== */}
      <DropdownMenu
        id="margins"
        openId={openId}
        setOpenId={setOpenId}
        title="حاشیه‌ها (mm)"
        icon={<Ruler size={12} />}
      >
        <div className="grid grid-cols-2 gap-2">
          <NumInput label="بالا" value={margins.top} onChange={v => onChange({ margins: { ...margins, top: v } })} />
          <NumInput label="پایین" value={margins.bottom} onChange={v => onChange({ margins: { ...margins, bottom: v } })} />
          <NumInput label="راست" value={margins.right} onChange={v => onChange({ margins: { ...margins, right: v } })} />
          <NumInput label="چپ" value={margins.left} onChange={v => onChange({ margins: { ...margins, left: v } })} />
        </div>
      </DropdownMenu>

      {/* ============== 4) Text styles ============== */}
      <DropdownMenu
        id="text"
        openId={openId}
        setOpenId={setOpenId}
        title="سبک متن نامه"
        icon={<TypeIcon size={12} />}
        width={300}
      >
        <NumInput
          label="فاصله خطوط"
          value={lineHeight}
          onChange={v => onChange({ lineHeight: v })}
          step={0.1}
          min={1}
          max={4}
        />
        <div className="space-y-2 pt-1 border-t border-white/10">
          <p className="text-[10px] text-white/60 font-black">سبک نام گیرنده</p>
          <div className="grid grid-cols-2 gap-2">
            <NumInput label="سایز فونت" value={recipientFontSize} onChange={v => onChange({ recipientFontSize: v })} />
            <div className="space-y-1">
              <label className="text-[9px] text-white/50 block font-bold">رنگ</label>
              <input type="color" value={recipientColor}
                onChange={e => onChange({ recipientColor: e.target.value })}
                className="w-full h-[34px] rounded-lg bg-transparent border border-white/15 cursor-pointer" />
            </div>
          </div>
        </div>
        <div className="space-y-2 pt-2 border-t border-white/10">
          <p className="text-[10px] text-white/60 font-black">سبک نام فرستنده</p>
          <div className="grid grid-cols-2 gap-2">
            <NumInput label="سایز فونت" value={senderFontSize} onChange={v => onChange({ senderFontSize: v })} />
            <div className="space-y-1">
              <label className="text-[9px] text-white/50 block font-bold">رنگ</label>
              <input type="color" value={senderColor}
                onChange={e => onChange({ senderColor: e.target.value })}
                className="w-full h-[34px] rounded-lg bg-transparent border border-white/15 cursor-pointer" />
            </div>
          </div>
        </div>
      </DropdownMenu>

      {/* ============== 5) Signature box ============== */}
      <DropdownMenu
        id="sig"
        openId={openId}
        setOpenId={setOpenId}
        title="کادر امضا"
        icon={<Maximize size={12} />}
      >
        <div className="grid grid-cols-2 gap-2">
          <NumInput label="عرض (mm)" value={sigSize.w} onChange={v => onChange({ sigSize: { ...sigSize, w: v } })} />
          <NumInput label="ارتفاع (mm)" value={sigSize.h} onChange={v => onChange({ sigSize: { ...sigSize, h: v } })} />
        </div>
      </DropdownMenu>
    </div>
  );
};

export default LetterSettingsPanel;
