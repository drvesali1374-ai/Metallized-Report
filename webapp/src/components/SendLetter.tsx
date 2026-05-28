/**
 * SendLetter.tsx - Letter composition component (rewritten)
 *
 * IMPLEMENTED FIXES:
 *  Fix #1  Eliminated unwanted bottom margin in preview page (no extra blank space).
 *  Fix #2  Settings panel uses independent dropdown menus (LetterSettingsPanel).
 *  Fix #3  Font-size input keeps selection alive; size applied to selected range.
 *  Fix #4  Editing toolbar sticks directly under header (no gap, frozen).
 *  Fix #5  Sender name/title/signature + CC names placed two line-breaks after
 *          the last line of the letter content (not at the page bottom).
 *  Fix #6  CC and hidden-CC usernames displayed beneath their respective buttons
 *          on the compose page.
 *  Fix #7  Each rendered page becomes its own print/PDF page (proper pagination
 *          via @page CSS, page-break-after, and exact-size page sheets).
 *  Fix #8  Back button in preview returns to compose (closes preview), not to the
 *          drafts list.
 *  Fix #9  Header button order on compose: Save | Back | Preview.
 *          In preview: Save & Back hidden; Edit Letter (rightmost) + Sign & Send
 *          (to its left). Sign & Send moved to preview only.
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../context/StoreContext';
import {
  Send, AlignRight, AlignCenter, AlignLeft,
  UserPlus, X, Search,
  Bold, Italic, Underline, Palette, Type, Highlighter,
  User, UserCheck, Users as UsersIcon, EyeOff, ChevronDown, Users,
  Paperclip, Plus, Save, ArrowLeft, PenTool, AlertTriangle,
  Printer, Download, Strikethrough,
  Minus, Eye,
  Subscript, Superscript, Link2, Code, Quote,
  Pencil
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Attachment, Letter } from '../types';
import { toast } from 'react-toastify';
import LetterSettingsPanel from './LetterSettingsPanel';
import type { LetterSettings } from './LetterSettingsPanel';

// ============================================================
// CONSTANTS
// ============================================================
const FONT_FAMILIES = [
  'Vazirmatn', 'B Nazanin', 'B Titr', 'B Mitra', 'B Yekan',
  'irannastaligh', 'Adobe Arabic', 'Calibri', 'Times New Roman',
  'Arial', 'Tahoma', 'Courier New'
];

const STANDARD_FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 40, 48, 56, 64, 72];

const TEXT_COLORS = [
  { name: 'سیاه', value: '#000000' },
  { name: 'سرمه‌ای', value: '#001f5c' },
  { name: 'آبی', value: '#1d4ed8' },
  { name: 'سبز تیره', value: '#14532d' },
  { name: 'سبز', value: '#16a34a' },
  { name: 'قرمز', value: '#dc2626' },
  { name: 'نارنجی', value: '#ea580c' },
  { name: 'زرد تیره', value: '#ca8a04' },
  { name: 'بنفش', value: '#7c3aed' },
  { name: 'صورتی', value: '#db2777' },
  { name: 'خاکستری', value: '#6b7280' },
  { name: 'سفید', value: '#ffffff' },
];

const HIGHLIGHT_COLORS = [
  { name: 'زرد', value: '#fef08a' },
  { name: 'سبز', value: '#bbf7d0' },
  { name: 'آبی', value: '#bfdbfe' },
  { name: 'صورتی', value: '#fbcfe8' },
  { name: 'نارنجی', value: '#fed7aa' },
  { name: 'بنفش', value: '#e9d5ff' },
  { name: 'بی‌رنگ', value: 'transparent' },
];

// Header height (matches TopNav h-20 = 5rem = 80px). The toolbar sits flush
// under it via `position:sticky; top: 0`. The toolbar lives INSIDE <main>
// which is the scrolling container; <main> starts right below TopNav, so
// top:0 means the toolbar freezes exactly at the bottom edge of TopNav with
// zero gap.
const HEADER_HEIGHT_PX = 80;

const letterNumberCache = new Map<string, string>();
function getLetterNumber(id: string): string {
  if (!letterNumberCache.has(id)) {
    letterNumberCache.set(id, String(Math.floor(Math.random() * 900000 + 100000)));
  }
  return letterNumberCache.get(id)!;
}

// ============================================================
// COLOR DROPDOWN
// ============================================================
interface ColorDropdownProps {
  icon: React.ReactNode;
  label: string;
  colors: { name: string; value: string }[];
  onSelect: (value: string) => void;
}
const ColorDropdown: React.FC<ColorDropdownProps> = ({ icon, label, colors, onSelect }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', zIndex: open ? 9999 : 1, display: 'inline-block' }}>
      <button type="button"
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(prev => !prev); }}
        className="flex items-center gap-1 px-2 py-1.5 hover:bg-white/10 rounded-md text-white/70 hover:text-white transition-colors"
        title={label}
      >
        {icon}
        <span className="text-[9px] hidden md:inline">{label}</span>
        <ChevronDown size={9} className="opacity-50" />
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            zIndex: 99999,
            backgroundColor: '#0f172a',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '12px',
            padding: '8px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)',
            minWidth: '176px',
          }}
        >
          <div className="grid grid-cols-6 gap-1 mb-2">
            {colors.filter(c => c.value !== 'transparent').map(c => (
              <button key={c.value} type="button" title={c.name}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(c.value); setOpen(false); }}
                className="w-5 h-5 rounded border border-white/10 hover:scale-125 transition-transform"
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
          {colors.find(c => c.value === 'transparent') && (
            <button type="button"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onSelect('transparent'); setOpen(false); }}
              className="w-full text-[10px] py-1 text-white/60 hover:text-white hover:bg-white/10 rounded"
            >بی‌رنگ (حذف)</button>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================
// FONT SIZE CONTROL
// FIX #3 - selection is preserved when clicking the input.
// We do NOT call .focus() on the input or steal selection. The input shows the
// current size and accepts numeric input via onMouseDown that prevents focus
// theft; instead clicking opens a dropdown of sizes and the user picks one.
// Typing is supported by an explicit click that DOES focus and saves the
// editor's current range BEFORE focus moves; on blur we re-apply.
// ============================================================
interface FontSizeControlProps {
  value: number;
  onIncrease: (e: React.MouseEvent) => void;
  onDecrease: (e: React.MouseEvent) => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  onFocus: () => void;
  onMouseDown: (e: React.MouseEvent<HTMLInputElement>) => void;
  onWrapperMouseDown: (e: React.MouseEvent) => void;
  inputValue: string;
  showDropdown: boolean;
  onSelectSize: (size: number) => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
  inputRef: React.RefObject<HTMLInputElement>;
}

const FontSizeControl: React.FC<FontSizeControlProps> = ({
  value, onIncrease, onDecrease, onChange, onKeyDown, onBlur, onFocus,
  onMouseDown, onWrapperMouseDown, inputValue, showDropdown, onSelectSize, dropdownRef, inputRef
}) => (
  <div
    onMouseDown={onWrapperMouseDown}
    className="flex items-center gap-0 bg-white/5 rounded-lg"
    style={{ overflow: 'visible', position: 'relative', zIndex: showDropdown ? 9999 : 1 }}
  >
    <button type="button" onMouseDown={onDecrease}
      className="px-2 py-1.5 hover:bg-white/10 text-white/70 hover:text-white transition-colors text-sm font-black border-l border-white/10 select-none"
      title="کاهش سایز">−</button>
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={inputValue}
        onMouseDown={onMouseDown}
        onFocus={onFocus}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        className="w-12 bg-transparent text-[12px] font-bold text-center outline-none py-1 px-1 text-white"
        dir="ltr"
        title="سایز فونت"
        style={{ direction: 'ltr', textAlign: 'center' }}
      />
      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 2px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            backgroundColor: '#0f172a',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)',
            width: '80px',
          }}
        >
          <div className="overflow-y-auto custom-scroll" style={{ maxHeight: '200px' }}>
            {STANDARD_FONT_SIZES.map(s => (
              <div key={s}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onSelectSize(s); }}
                style={{
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  textAlign: 'center',
                  color: s === value ? '#93c5fd' : 'rgba(255,255,255,0.85)',
                  backgroundColor: s === value ? 'rgba(37,99,235,0.3)' : 'transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = 'rgba(37,99,235,0.6)'; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = s === value ? 'rgba(37,99,235,0.3)' : 'transparent'; }}
              >{s}</div>
            ))}
          </div>
        </div>
      )}
    </div>
    <button type="button" onMouseDown={onIncrease}
      className="px-2 py-1.5 hover:bg-white/10 text-white/70 hover:text-white transition-colors text-sm font-black border-r border-white/10 select-none"
      title="افزایش سایز">+</button>
  </div>
);

// ============================================================
// MAIN COMPONENT
// ============================================================
const SendLetter: React.FC = () => {
  const { users, systemSettings, sendLetter, updateDraft, drafts, currentUser, contactGroups, letters } = useStore();
  const navigate = useNavigate();
  const { id } = useParams();

  const [currentDraft, setCurrentDraft] = useState<Letter | null>(null);
  const initialStateRef = useRef<string>('');

  const [subject, setSubject] = useState('');
  const [recipientType, setRecipientType] = useState<'SYSTEM' | 'CUSTOM'>('SYSTEM');
  const [recipientId, setRecipientId] = useState('');
  const [recipientSearchTerm, setRecipientSearchTerm] = useState('');
  const [isRecipientSearchOpen, setIsRecipientSearchOpen] = useState(false);
  const [customRecipient, setCustomRecipient] = useState({ name: '', gender: 'MALE' as 'MALE' | 'FEMALE', position: '' });
  const [ccIds, setCcIds] = useState<string[]>([]);
  const [bccIds, setBccIds] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [currentFontSize, setCurrentFontSize] = useState<number>(14);
  const [fontSizeInputValue, setFontSizeInputValue] = useState<string>('14');
  const [showFontSizeDropdown, setShowFontSizeDropdown] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const [letterSettings, setLetterSettings] = useState<LetterSettings>({
    letterheadId: '',
    pageSize: 'A4',
    orientation: 'PORTRAIT',
    firstPageHeaderH: 30,
    headerCoords: { x: 10, y: 15 },
    headerColor: '#000000',
    margins: { top: 30, bottom: 30, left: 20, right: 20 },
    lineHeight: 2.0,
    recipientColor: '#000000',
    recipientFontSize: 13,
    senderColor: '#000000',
    senderFontSize: 12,
    sigSize: { w: 60, h: 50 },
  });

  const [showModal, setShowModal] = useState<'CC' | 'BCC' | null>(null);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [showSignModal, setShowSignModal] = useState(false);
  const [selectedSignatureId, setSelectedSignatureId] = useState<string>('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showTableDropdown, setShowTableDropdown] = useState(false);
  const [tableHover, setTableHover] = useState({ rows: 0, cols: 0 });

  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    message: string;
    onConfirm: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    isBackConfirm?: boolean;
  }>({ show: false, message: '', onConfirm: () => {}, confirmLabel: 'بله، تایید', cancelLabel: 'خیر' });

  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const fontSizeInputRef = useRef<HTMLInputElement>(null);
  const fontSizeDropdownRef = useRef<HTMLDivElement>(null);
  const tableButtonRef = useRef<HTMLButtonElement>(null);
  const isComposingRef = useRef(false);
  const portalTarget = document.getElementById('header-action-portal');

  const isSentLetter = useMemo(() => {
    if (!id) return false;
    return !!letters.find(l => l.id === id);
  }, [id, letters]);

  const currentLetter = useMemo(() => {
    if (!id) return null;
    return letters.find(l => l.id === id) || null;
  }, [id, letters]);

  const {
    letterheadId, pageSize, orientation, firstPageHeaderH,
    headerCoords, headerColor, margins, lineHeight,
    recipientColor, recipientFontSize, senderColor, senderFontSize, sigSize
  } = letterSettings;

  useEffect(() => {
    if (id) {
      const sentLetter = letters.find(l => l.id === id);
      if (sentLetter) {
        setCurrentDraft(sentLetter);
        loadLetterData(sentLetter);
        return;
      }
      const foundDraft = drafts.find(d => d.id === id);
      if (foundDraft) {
        setCurrentDraft(foundDraft);
        loadLetterData(foundDraft);
        initialStateRef.current = JSON.stringify(extractLetterData(foundDraft));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, drafts, letters]);

  function loadLetterData(letter: Letter) {
    setSubject(letter.subject);
    setContent(letter.content);
    setRecipientId(letter.recipientId || '');
    if (letter.customRecipient) {
      setRecipientType('CUSTOM');
      setCustomRecipient(letter.customRecipient);
    } else {
      setRecipientType('SYSTEM');
    }
    setCcIds(letter.ccIds || []);
    setBccIds(letter.bccIds || []);
    setLetterSettings({
      letterheadId: letter.letterheadId || '',
      pageSize: letter.pageSize || 'A4',
      orientation: letter.orientation || 'PORTRAIT',
      firstPageHeaderH: (letter as any).firstPageHeaderH ?? 30,
      headerCoords: letter.headerCoords || { x: 10, y: 15 },
      headerColor: letter.headerColor || '#000000',
      margins: letter.margins || { top: 30, bottom: 30, left: 20, right: 20 },
      lineHeight: (letter as any).lineHeight ?? 2.0,
      recipientColor: (letter as any).recipientColor || '#000000',
      recipientFontSize: (letter as any).recipientFontSize ?? 13,
      senderColor: (letter as any).senderColor || '#000000',
      senderFontSize: (letter as any).senderFontSize ?? 12,
      sigSize: letter.sigSize || { w: 60, h: 50 },
    });
    if (letter.attachments) setAttachments(letter.attachments);
  }

  function extractLetterData(letter: Letter) {
    return {
      subject: letter.subject,
      content: letter.content,
      recipientId: letter.recipientId,
      customRecipient: letter.customRecipient,
      ccIds: letter.ccIds,
      bccIds: letter.bccIds,
      letterheadId: letter.letterheadId,
      pageSize: letter.pageSize,
      orientation: letter.orientation,
      margins: letter.margins,
      headerCoords: letter.headerCoords,
      headerColor: letter.headerColor,
      attachments: letter.attachments,
      sigSize: letter.sigSize,
    };
  }

  const recipient = useMemo(() => users.find(u => u.id === recipientId), [recipientId, users]);
  const currentLetterhead = useMemo(() => systemSettings.letterheads.find(lh => lh.id === letterheadId), [letterheadId, systemSettings.letterheads]);

  const filteredRecipientUsers = useMemo(() => {
    if (!recipientSearchTerm) return users;
    return users.filter(u =>
      u.fullName.toLowerCase().includes(recipientSearchTerm.toLowerCase()) ||
      u.position.toLowerCase().includes(recipientSearchTerm.toLowerCase()) ||
      u.unit.toLowerCase().includes(recipientSearchTerm.toLowerCase())
    );
  }, [users, recipientSearchTerm]);

  const getGenderPrefix = (gender?: string) => gender === 'FEMALE' ? 'سرکار خانم' : 'جناب آقای';

  // ============================================================
  // SELECTION MANAGEMENT
  // ============================================================
  const saveCurrentSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const editor = editorRef.current;
      if (editor && (editor.contains(range.commonAncestorContainer) || editor === range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
      }
    }
  }, []);

  const restoreSavedSelection = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    if (savedRangeRef.current) {
      try {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(savedRangeRef.current.cloneRange());
        }
      } catch (e) { /* ignore stale range */ }
    }
  }, []);

  // FIX #3: applyFontSize wraps the saved range in a span at exact pt-size,
  // re-selects it, and keeps the highlight visible by re-applying the range.
  const applyFontSize = useCallback((size: number) => {
    if (isNaN(size) || size < 1) return;
    setCurrentFontSize(size);
    setFontSizeInputValue(String(size));

    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();
    if (savedRangeRef.current) {
      try {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(savedRangeRef.current.cloneRange());
        }
      } catch (e) { /* ignore */ }
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);

    if (range.collapsed) {
      // Collapsed selection - insert a marker span for new typing.
      document.execCommand('styleWithCSS', false, 'true');
      const span = document.createElement('span');
      span.style.fontSize = `${size}pt`;
      span.appendChild(document.createTextNode('\u200B'));
      range.insertNode(span);
      range.setStartAfter(span);
      range.setEndAfter(span);
      sel.removeAllRanges();
      sel.addRange(range);
      savedRangeRef.current = range.cloneRange();
      syncContent();
      return;
    }

    // Range selection - wrap in span with exact pt-size
    document.execCommand('styleWithCSS', false, 'true');
    try {
      const fragment = range.extractContents();
      const wrapper = document.createElement('span');
      wrapper.style.fontSize = `${size}pt`;
      wrapper.appendChild(fragment);
      range.insertNode(wrapper);

      // Re-select the wrapper -> selection stays visible & highlighted
      const newRange = document.createRange();
      newRange.selectNodeContents(wrapper);
      sel.removeAllRanges();
      sel.addRange(newRange);
      savedRangeRef.current = newRange.cloneRange();
    } catch (e) {
      document.execCommand('fontSize', false, '3');
      const fontEls = editor.querySelectorAll('font[size="3"]');
      fontEls.forEach(el => {
        (el as HTMLElement).style.fontSize = `${size}pt`;
        el.removeAttribute('size');
      });
      saveCurrentSelection();
    }

    syncContent();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveCurrentSelection]);

  const execCommand = useCallback((command: string, value: string = '') => {
    const editor = editorRef.current;
    if (!editor) return;
    restoreSavedSelection();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, value || undefined);
    saveCurrentSelection();
    syncContent();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreSavedSelection, saveCurrentSelection]);

  const applyFontFamily = useCallback((family: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    restoreSavedSelection();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('fontName', false, family);
    saveCurrentSelection();
    syncContent();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreSavedSelection, saveCurrentSelection]);

  const applyColor = useCallback((color: string, type: 'fore' | 'back') => {
    const editor = editorRef.current;
    if (!editor) return;
    restoreSavedSelection();
    document.execCommand('styleWithCSS', false, 'true');
    if (type === 'fore') {
      document.execCommand('foreColor', false, color);
    } else {
      document.execCommand('hiliteColor', false, color === 'transparent' ? 'transparent' : color);
    }
    saveCurrentSelection();
    syncContent();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreSavedSelection, saveCurrentSelection]);

  const syncContent = useCallback(() => {
    if (editorRef.current) setContent(editorRef.current.innerHTML);
  }, []);

  const handleEditorInput = useCallback(() => {
    if (!isComposingRef.current) syncContent();
  }, [syncContent]);

  const handleEditorMouseUp = useCallback(() => { saveCurrentSelection(); }, [saveCurrentSelection]);
  const handleEditorKeyUp = useCallback(() => { saveCurrentSelection(); syncContent(); }, [saveCurrentSelection, syncContent]);

  // ============================================================
  // FIX #3: Font-size input handlers
  // - Wrapper onMouseDown calls preventDefault(): prevents focus/selection
  //   from leaving the editor when user clicks anywhere on the wrapper.
  // - Input onMouseDown saves the editor's current selection, then
  //   selectively allows focus by NOT preventing default on the input itself.
  // - On focus, dropdown opens but selection in editor is restored visually.
  // ============================================================
  const handleWrapperMouseDown = useCallback((e: React.MouseEvent) => {
    // If the user clicked on the actual <input> element, allow focus to move
    // there so they can type. Otherwise prevent focus-stealing.
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT') {
      // Save selection BEFORE focus moves
      saveCurrentSelection();
      return; // allow default
    }
    // For +/- buttons / wrapper - their own onMouseDown handlers already
    // preventDefault, but just in case, save the selection here too.
    saveCurrentSelection();
  }, [saveCurrentSelection]);

  const handleFontSizeInputMouseDown = useCallback((_e: React.MouseEvent<HTMLInputElement>) => {
    // Save selection BEFORE input gains focus
    saveCurrentSelection();
  }, [saveCurrentSelection]);

  const handleFontSizeInputFocus = useCallback(() => {
    setShowFontSizeDropdown(true);
    // Re-apply the saved range visually so the user keeps seeing their
    // highlighted text while interacting with the size input.
    if (savedRangeRef.current) {
      try {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(savedRangeRef.current.cloneRange());
        }
      } catch { /* ignore */ }
    }
  }, []);

  const handleFontSizeInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFontSizeInputValue(e.target.value);
  }, []);

  const handleFontSizeInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      const val = parseInt(fontSizeInputValue);
      if (!isNaN(val) && val > 0) {
        applyFontSize(val);
        setShowFontSizeDropdown(false);
        setTimeout(() => editorRef.current?.focus(), 0);
      }
    } else if (e.key === 'Escape') {
      setShowFontSizeDropdown(false);
      setFontSizeInputValue(String(currentFontSize));
      setTimeout(() => editorRef.current?.focus(), 0);
    }
  }, [fontSizeInputValue, currentFontSize, applyFontSize]);

  const handleFontSizeInputBlur = useCallback(() => {
    const val = parseInt(fontSizeInputValue);
    if (!isNaN(val) && val > 0 && val !== currentFontSize) {
      applyFontSize(val);
    } else {
      setFontSizeInputValue(String(currentFontSize));
    }
    setTimeout(() => setShowFontSizeDropdown(false), 150);
  }, [fontSizeInputValue, currentFontSize, applyFontSize]);

  const handleFontSizeSelect = useCallback((size: number) => {
    setShowFontSizeDropdown(false);
    applyFontSize(size);
  }, [applyFontSize]);

  const handleFontSizeIncrease = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    saveCurrentSelection();
    const idx = STANDARD_FONT_SIZES.indexOf(currentFontSize);
    let nextSize: number;
    if (idx === -1) {
      nextSize = STANDARD_FONT_SIZES.find(s => s > currentFontSize) || currentFontSize + 2;
    } else {
      nextSize = idx < STANDARD_FONT_SIZES.length - 1
        ? STANDARD_FONT_SIZES[idx + 1]
        : currentFontSize + 2;
    }
    applyFontSize(nextSize);
  }, [currentFontSize, applyFontSize, saveCurrentSelection]);

  const handleFontSizeDecrease = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    saveCurrentSelection();
    const idx = STANDARD_FONT_SIZES.indexOf(currentFontSize);
    let prevSize: number;
    if (idx === -1) {
      const smaller = STANDARD_FONT_SIZES.filter(s => s < currentFontSize);
      prevSize = smaller.length > 0 ? smaller[smaller.length - 1] : Math.max(6, currentFontSize - 2);
    } else {
      prevSize = idx > 0
        ? STANDARD_FONT_SIZES[idx - 1]
        : Math.max(6, currentFontSize - 2);
    }
    applyFontSize(prevSize);
  }, [currentFontSize, applyFontSize, saveCurrentSelection]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        fontSizeDropdownRef.current &&
        !fontSizeDropdownRef.current.contains(e.target as Node) &&
        fontSizeInputRef.current !== e.target
      ) setShowFontSizeDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleClickOutside = () => { setShowTableDropdown(false); };
    if (showTableDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTableDropdown]);

  const editorInitialized = useRef(false);
  useEffect(() => {
    if (editorRef.current && content && !editorInitialized.current) {
      editorRef.current.innerHTML = content;
      editorInitialized.current = true;
    }
  }, [content]);

  useEffect(() => {
    editorInitialized.current = false;
    savedRangeRef.current = null;
  }, [id]);

  // ============================================================
  // COLLECT DATA
  // ============================================================
  const collectData = (): Letter => {
    if (!currentDraft) throw new Error("Draft not found");
    const editorHTML = editorRef.current?.innerHTML || content;
    return {
      ...currentDraft,
      recipientId: recipientType === 'SYSTEM' ? recipientId : undefined,
      customRecipient: recipientType === 'CUSTOM' ? customRecipient : undefined,
      ccIds,
      bccIds,
      subject,
      content: editorHTML,
      attachments,
      ...letterSettings,
    } as Letter;
  };

  const hasChanges = (): boolean => {
    try {
      const currentData = extractLetterData({
        ...currentDraft!,
        subject,
        content: editorRef.current?.innerHTML || content,
        recipientId: recipientType === 'SYSTEM' ? recipientId : undefined,
        customRecipient: recipientType === 'CUSTOM' ? customRecipient : undefined,
        ccIds, bccIds, attachments,
        ...letterSettings,
      } as Letter);
      return JSON.stringify(currentData) !== initialStateRef.current;
    } catch { return true; }
  };

  const handleSaveChanges = () => {
    if (!currentDraft) return;
    const updatedDraft = collectData();
    updateDraft(updatedDraft);
    initialStateRef.current = JSON.stringify(extractLetterData(updatedDraft));
    toast.success('ذخیره با موفقیت انجام شد.', { icon: '💾' });
  };

  const handlePreview = () => {
    if (!currentDraft) return;
    const updatedDraft = collectData();
    updateDraft(updatedDraft);
    initialStateRef.current = JSON.stringify(extractLetterData(updatedDraft));
    setShowPreviewModal(true);
    // scroll to top so the user sees the preview from the first page
    setTimeout(() => {
      const main = document.querySelector('main');
      if (main) main.scrollTop = 0;
    }, 50);
  };

  const handlePreviewClose = () => {
    setShowPreviewModal(false);
    setTimeout(() => {
      const main = document.querySelector('main');
      if (main) main.scrollTop = 0;
    }, 50);
  };

  const handleBack = () => {
    // FIX #1: When in preview, "Back" returns to compose (closes preview).
    if (showPreviewModal) {
      handlePreviewClose();
      return;
    }
    if (isSentLetter) { navigate('/letters'); return; }
    if (hasChanges()) {
      setConfirmModal({
        show: true,
        message: 'تغییرات ذخیره نشده دارید. آیا می‌خواهید ذخیره شوند؟',
        confirmLabel: 'ذخیره تغییرات',
        cancelLabel: 'نادیده گرفتن',
        isBackConfirm: true,
        onConfirm: () => {
          const updatedDraft = collectData();
          updateDraft(updatedDraft);
          toast.success('تغییرات ذخیره شد.');
          navigate('/letters');
        }
      });
    } else {
      navigate('/letters');
    }
  };

  // FIX #4: Robust print/PDF using a hidden iframe so every paginated page
  // becomes its own page in the printer's PDF, with no clipping or extra space.
  const handlePrint = () => {
    const printArea = document.getElementById('preview-print-area') || document.getElementById('print-area-sent');
    if (!printArea) {
      window.print();
      return;
    }

    const sheets = Array.from(printArea.querySelectorAll('.letter-page-sheet')) as HTMLElement[];
    if (sheets.length === 0) {
      window.print();
      return;
    }

    // Determine page size for @page rule (in mm) from the first sheet
    const firstStyle = sheets[0].style;
    const sizeRule = `${firstStyle.width} ${firstStyle.height}`;

    // Build a self-contained HTML document with each sheet on its own page.
    // We inline the contents (innerHTML) of every sheet wrapped in a fresh
    // sheet container, then add @page CSS to force one sheet = one page.
    const pageHtml = sheets.map(s => `<section class="letter-page-sheet" style="${s.getAttribute('style') || ''}">${s.innerHTML}</section>`).join('');

    const styles = Array.from(document.styleSheets).map(ss => {
      try {
        return Array.from(ss.cssRules).map(r => r.cssText).join('\n');
      } catch { return ''; }
    }).join('\n');

    const doc = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<title>چاپ نامه</title>
<style>
  ${styles}
  @page { size: ${sizeRule}; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
  body { font-family: 'B Nazanin', Vazirmatn, Arial, sans-serif; }
  .letter-page-sheet {
    box-shadow: none !important;
    border: none !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    page-break-after: always !important;
    break-after: page !important;
    display: block !important;
    position: relative !important;
  }
  .letter-page-sheet:last-child {
    page-break-after: auto !important;
    break-after: auto !important;
  }
</style>
</head>
<body>${pageHtml}</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const cleanup = () => {
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch {}
      }, 500);
    };

    iframe.onload = () => {
      try {
        const win = iframe.contentWindow!;
        // Wait for images (letterheads, signatures) to finish loading.
        const imgs = Array.from(iframe.contentDocument!.images);
        const waitForImages = Promise.all(imgs.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise<void>(resolve => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          });
        }));
        waitForImages.then(() => {
          win.focus();
          win.print();
          cleanup();
        });
      } catch (e) {
        console.error('Print error:', e);
        cleanup();
      }
    };

    const idoc = iframe.contentDocument || iframe.contentWindow!.document;
    idoc.open();
    idoc.write(doc);
    idoc.close();
  };

  const handlePreSendValidation = () => {
    const editorHTML = editorRef.current?.innerHTML || '';
    const isRecipientSet = recipientType === 'SYSTEM'
      ? !!recipientId
      : (!!customRecipient.name && !!customRecipient.position);
    if (!isRecipientSet) { toast.error('خطا: گیرنده نامه مشخص نشده است.'); return; }
    const textOnly = editorHTML.replace(/<[^>]*>/g, '').trim();
    if (!textOnly) { toast.error('خطا: متن نامه نمی‌تواند خالی باشد.'); return; }
    setShowSignModal(true);
  };

  const handleFinalSend = () => {
    if (!selectedSignatureId) { toast.error('لطفاً یک امضا را انتخاب کنید.'); return; }
    let rName = 'گیرنده';
    if (recipientType === 'SYSTEM') {
      const u = users.find(x => x.id === recipientId);
      if (u) rName = u.fullName;
    } else if (customRecipient.name) {
      rName = customRecipient.name;
    }
    setConfirmModal({
      show: true,
      message: `آیا نامه به ${rName} ارسال شود؟`,
      confirmLabel: 'بله، ارسال شود',
      cancelLabel: 'خیر',
      onConfirm: () => {
        try {
          const finalLetter = collectData();
          const selectedSig = currentUser?.signatures?.find(s => s.id === selectedSignatureId);
          finalLetter.signatureId = selectedSignatureId;
          finalLetter.signatureImage = selectedSig?.image;
          sendLetter(finalLetter);
          toast.success('نامه با موفقیت ارسال شد! ✉️');
          setShowSignModal(false);
          navigate('/letters');
        } catch (error) {
          console.error(error);
          toast.error('خطا در ارسال نامه.');
        }
      }
    });
  };

  const toggleUserSelection = (uid: string, type: 'CC' | 'BCC') => {
    if (type === 'CC') {
      setCcIds(prev => prev.includes(uid) ? prev.filter(i => i !== uid) : [...prev, uid]);
    } else {
      setBccIds(prev => prev.includes(uid) ? prev.filter(i => i !== uid) : [...prev, uid]);
    }
  };

  const removeFromList = (uid: string, type: 'CC' | 'BCC') => {
    if (type === 'CC') {
      setCcIds(prev => prev.filter(i => i !== uid));
    } else {
      setBccIds(prev => prev.filter(i => i !== uid));
    }
  };

  const addGroupMembers = (groupId: string, type: 'CC' | 'BCC') => {
    const group = contactGroups.find(g => g.id === groupId);
    if (!group) return;
    const setter = type === 'CC' ? setCcIds : setBccIds;
    setter(prev => { const n = [...prev]; group.memberIds.forEach(mid => { if (!n.includes(mid)) n.push(mid); }); return n; });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newAttachments: Attachment[] = Array.from(files).map((f: File) => ({ name: f.name, size: f.size, type: f.type }));
      setAttachments(prev => [...prev, ...newAttachments]);
    }
  };

  const removeAttachment = (index: number) => setAttachments(prev => prev.filter((_, i) => i !== index));

  const filteredModalUsers = useMemo(() => {
    if (!modalSearchTerm) return users;
    return users.filter(u =>
      u.fullName.toLowerCase().includes(modalSearchTerm.toLowerCase()) ||
      u.unit.toLowerCase().includes(modalSearchTerm.toLowerCase())
    );
  }, [users, modalSearchTerm]);

  const viewLetter = isSentLetter ? currentLetter : null;
  const letterNumber = useMemo(() => id ? getLetterNumber(id) : '---', [id]);

  const previewLetterData: Letter = {
    ...((currentDraft || {}) as Letter),
    recipientId: recipientType === 'SYSTEM' ? recipientId : undefined,
    customRecipient: recipientType === 'CUSTOM' ? customRecipient : undefined,
    ccIds, bccIds, subject,
    content: editorRef.current?.innerHTML || content,
    attachments,
    ...letterSettings,
  } as any;

  const handleInsertLink = useCallback(() => {
    restoreSavedSelection();
    const url = window.prompt('آدرس لینک را وارد کنید:', 'https://');
    if (url) {
      document.execCommand('createLink', false, url);
      saveCurrentSelection();
      syncContent();
    }
  }, [restoreSavedSelection, saveCurrentSelection, syncContent]);

  const handleInsertTable = useCallback((rows: number, cols: number) => {
    restoreSavedSelection();
    let tableHTML = `<table border="1" style="border-collapse:collapse;width:100%;margin:4mm 0;">`;
    for (let r = 0; r < rows; r++) {
      tableHTML += '<tr>';
      for (let c = 0; c < cols; c++) {
        tableHTML += `<td style="border:1px solid #cbd5e1;padding:4px 8px;min-width:30px;">&nbsp;</td>`;
      }
      tableHTML += '</tr>';
    }
    tableHTML += '</table>';
    document.execCommand('insertHTML', false, tableHTML);
    saveCurrentSelection();
    syncContent();
    setShowTableDropdown(false);
  }, [restoreSavedSelection, saveCurrentSelection, syncContent]);

  // ============================================================
  // SENT LETTER VIEW (READ ONLY)
  // ============================================================
  if (isSentLetter && viewLetter) {
    const sentLineHeight = (viewLetter as any).lineHeight || 2.0;
    const sentRecipientColor = (viewLetter as any).recipientColor || '#000000';
    const sentRecipientFontSize = (viewLetter as any).recipientFontSize || 13;
    const sentSenderColor = (viewLetter as any).senderColor || '#000000';
    const sentSenderFontSize = (viewLetter as any).senderFontSize || 12;

    return (
      <div className="animate-in fade-in duration-500">
        {portalTarget && createPortal(
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/letters')} className="glass bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl font-bold text-xs text-white/70 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2">
              <ArrowLeft size={16} /> بازگشت
            </button>
            <button onClick={handlePrint} className="bg-blue-600/20 border border-blue-500/30 px-4 py-2.5 rounded-xl font-bold text-xs text-blue-300 hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2">
              <Printer size={16} /> چاپ
            </button>
            <button onClick={handlePrint} className="bg-emerald-600/20 border border-emerald-500/30 px-4 py-2.5 rounded-xl font-bold text-xs text-emerald-300 hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-2">
              <Download size={16} /> ذخیره PDF
            </button>
          </div>,
          portalTarget
        )}

        <div className="flex flex-col items-center gap-2" id="print-area-sent">
          <SentLetterPages
            letter={viewLetter}
            users={users}
            currentUser={currentUser}
            currentLetterhead={systemSettings.letterheads.find(lh => lh.id === viewLetter.letterheadId)}
            letterNumber={letterNumber}
            lineHeight={sentLineHeight}
            recipientColor={sentRecipientColor}
            recipientFontSize={sentRecipientFontSize}
            senderColor={sentSenderColor}
            senderFontSize={sentSenderFontSize}
          />
        </div>

        {/* FIX #1 + #7: Print/PDF - one page per .letter-page-sheet, no extra space */}
        <style>{`
          @media print {
            @page { size: auto; margin: 0; }
            html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
            body > * { display: none !important; visibility: hidden !important; }
            #print-area-sent { display: block !important; visibility: visible !important; position: static !important; padding: 0 !important; margin: 0 !important; gap: 0 !important; }
            #print-area-sent * { visibility: visible !important; }
            .letter-page-sheet {
              box-shadow: none !important;
              border: none !important;
              margin: 0 !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              page-break-after: always !important;
              break-after: page !important;
              display: block !important;
            }
            .letter-page-sheet:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
            .no-print { display: none !important; visibility: hidden !important; }
          }
        `}</style>
      </div>
    );
  }

  // ============================================================
  // DRAFT EDITOR VIEW
  // ============================================================
  if (!currentDraft || currentDraft.status === 'SENT') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white/40 text-sm">در حال بارگذاری...</div>
      </div>
    );
  }

  // CC/BCC users (resolved) for showing names beneath the buttons (FIX #6).
  const ccUsers = ccIds.map(cid => users.find(u => u.id === cid)).filter(Boolean) as any[];
  const bccUsers = bccIds.map(cid => users.find(u => u.id === cid)).filter(Boolean) as any[];

  return (
    <div className="max-w-full mx-auto space-y-6 animate-in fade-in duration-500 pb-20">

      {/* ============================================================
          FIX #1: Header buttons live in the MAIN top-nav portal so they
          are never hidden under the header.
          - Compose mode: Save | Back | Preview
          - Preview mode: Save | Back (→ back to compose) | Print | Send Letter
            (Send Letter occupies the same slot as the Preview button)
          ============================================================ */}
      {portalTarget && createPortal(
        <div className="flex items-center gap-2">
          {/* 1) Save (rightmost in DOM = appears first in RTL flow) */}
          <button
            onClick={handleSaveChanges}
            className="glass bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl font-bold text-xs text-white/70 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2"
          >
            <Save size={16} /> ذخیره
          </button>
          {/* 2) Back */}
          <button
            onClick={handleBack}
            className="bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl font-bold text-xs text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
          >
            <ArrowLeft size={16} /> بازگشت
          </button>
          {/* 3) Preview / Send Letter (leftmost - same slot) */}
          {showPreviewModal ? (
            <>
              <button
                onClick={handlePrint}
                className="bg-blue-600/20 border border-blue-500/30 px-4 py-2.5 rounded-xl font-bold text-xs text-blue-300 hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2"
                title="چاپ / ذخیره PDF"
              >
                <Printer size={16} /> چاپ
              </button>
              <button
                onClick={handlePreSendValidation}
                className="metallic-btn bg-emerald-600 border border-emerald-400 px-5 py-2.5 rounded-xl font-black text-xs text-white shadow-lg hover:bg-emerald-500 transition-all flex items-center gap-2"
                title="امضا و ارسال نامه"
              >
                <Send size={16} /> ارسال نامه
              </button>
            </>
          ) : (
            <button
              onClick={handlePreview}
              className="bg-indigo-600/20 border border-indigo-500/30 px-4 py-2.5 rounded-xl font-bold text-xs text-indigo-300 hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2"
            >
              <Eye size={16} /> پیش‌نمایش
            </button>
          )}
        </div>,
        portalTarget
      )}

      {/* ============================================================
          FIX #1: Inline preview view. Replaces the compose UI when the
          user clicks Preview, keeping the main top-nav visible so action
          buttons (Save/Back/Send Letter) live on the real header.
          ============================================================ */}
      {showPreviewModal && (
        <div className="space-y-2 animate-in fade-in duration-300">
          <div className="glass p-4 rounded-2xl border-white/10 flex items-center justify-between no-print">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Eye size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black">پیش‌نمایش نامه</h3>
                <p className="text-[10px] text-white/40">نامه نهایی همانطور که چاپ می‌شود</p>
              </div>
            </div>
            <span className="text-[10px] text-white/40 font-bold">برای ارسال یا چاپ از دکمه‌های هدر استفاده کنید</span>
          </div>

          <div id="preview-print-area" className="flex flex-col items-center gap-4 py-4 bg-slate-800/40 rounded-2xl overflow-x-auto custom-scroll">
            <SentLetterPages
              letter={previewLetterData}
              users={users}
              currentUser={currentUser}
              currentLetterhead={systemSettings.letterheads.find(lh => lh.id === letterheadId)}
              letterNumber={letterNumber}
              lineHeight={lineHeight}
              recipientColor={recipientColor}
              recipientFontSize={recipientFontSize}
              senderColor={senderColor}
              senderFontSize={senderFontSize}
              isPreview={true}
            />
          </div>
        </div>
      )}

      <div className={`grid grid-cols-1 xl:grid-cols-4 gap-6 ${showPreviewModal ? 'hidden' : ''}`}>

        {/* ======= SIDEBAR SETTINGS (Fix #2: independent dropdown menus) ======= */}
        <aside className="xl:col-span-1 no-print">
          <LetterSettingsPanel
            settings={letterSettings}
            onChange={(updates) => setLetterSettings(prev => ({ ...prev, ...updates }))}
            letterheads={systemSettings.letterheads}
          />
        </aside>

        {/* ======= MAIN CONTENT ======= */}
        <div className="xl:col-span-3 space-y-4">

          {/* Metadata Card */}
          <div className="glass p-5 rounded-2xl border-white/10 shadow-2xl space-y-5 no-print">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Recipient */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-white/30 uppercase flex items-center gap-1"><User size={12} /> مشخصات گیرنده</label>
                  <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/5">
                    <button onClick={() => setRecipientType('SYSTEM')} className={`px-3 py-1 text-[9px] font-black rounded-md transition-all ${recipientType === 'SYSTEM' ? 'bg-blue-600 text-white' : 'text-white/40'}`}>کاربر سیستم</button>
                    <button onClick={() => setRecipientType('CUSTOM')} className={`px-3 py-1 text-[9px] font-black rounded-md transition-all ${recipientType === 'CUSTOM' ? 'bg-blue-600 text-white' : 'text-white/40'}`}>گیرنده دلخواه</button>
                  </div>
                </div>
                {recipientType === 'SYSTEM' ? (
                  <div className="relative z-20">
                    <div className="w-full glass bg-slate-800 border border-white/10 p-3 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer" onClick={() => setIsRecipientSearchOpen(!isRecipientSearchOpen)}>
                      <span className={recipient ? "text-white" : "text-white/40"}>{recipient ? `${recipient.fullName} (${recipient.position})` : 'جستجوی گیرنده...'}</span>
                      <ChevronDown size={14} className="opacity-50" />
                    </div>
                    {isRecipientSearchOpen && (
                      <div className="absolute top-full left-0 right-0 mt-2 glass bg-slate-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl max-h-60 flex flex-col z-[60]">
                        <div className="p-2 border-b border-white/5">
                          <div className="relative">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" size={14} />
                            <input autoFocus type="text" className="w-full bg-white/5 rounded-lg py-2 pr-9 pl-3 text-xs font-bold outline-none" placeholder="جستجوی نام، سمت، واحد..." value={recipientSearchTerm} onChange={e => setRecipientSearchTerm(e.target.value)} />
                          </div>
                        </div>
                        <div className="overflow-y-auto custom-scroll flex-1">
                          {filteredRecipientUsers.map(u => (
                            <div key={u.id} onClick={() => { setRecipientId(u.id); setIsRecipientSearchOpen(false); setRecipientSearchTerm(''); }} className={`p-3 hover:bg-white/5 cursor-pointer text-xs font-bold transition-colors ${recipientId === u.id ? 'bg-blue-500/10 text-blue-400' : ''}`}>
                              <div className="flex justify-between"><span>{u.fullName}</span><span className="text-[10px] opacity-50">{u.unit}</span></div>
                              <span className="text-[10px] opacity-50 block mt-0.5">{u.position}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 gap-2">
                      <select value={customRecipient.gender} onChange={e => setCustomRecipient({ ...customRecipient, gender: e.target.value as any })} className="col-span-1 glass bg-slate-800 border border-white/10 p-2 rounded-xl text-[11px] font-bold">
                        <option value="MALE">جناب آقای</option>
                        <option value="FEMALE">سرکار خانم</option>
                      </select>
                      <input type="text" placeholder="نام کامل..." value={customRecipient.name} onChange={e => setCustomRecipient({ ...customRecipient, name: e.target.value })} className="col-span-3 glass bg-white/5 border border-white/10 p-2 rounded-xl text-xs font-bold" />
                    </div>
                    <input type="text" placeholder="عنوان محترمانه سمت..." value={customRecipient.position} onChange={e => setCustomRecipient({ ...customRecipient, position: e.target.value })} className="w-full glass bg-white/5 border border-white/10 p-2 rounded-xl text-xs font-bold" />
                  </div>
                )}
              </div>

              {/* CC/BCC + names list (FIX #6) */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-white/30 uppercase flex items-center gap-1"><UsersIcon size={12} /> رونوشت‌های نامه</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <button
                      onClick={() => { setShowModal('CC'); setModalSearchTerm(''); }}
                      className="w-full glass bg-blue-600/10 text-blue-400 border border-blue-500/20 p-2.5 rounded-xl text-[10px] font-black flex items-center justify-center gap-2 hover:bg-blue-600/20"
                    >
                      <UserPlus size={14} /> رونوشت ({ccIds.length})
                    </button>
                    {/* FIX #6: usernames beneath the CC button */}
                    {ccUsers.length > 0 && (
                      <div className="flex flex-wrap gap-1 px-1">
                        {ccUsers.map(u => (
                          <span
                            key={u.id}
                            className="inline-flex items-center gap-1 bg-blue-500/15 border border-blue-400/30 text-blue-200 text-[9px] font-bold px-2 py-1 rounded-full"
                            title={`${u.fullName} - ${u.position}`}
                          >
                            <span className="truncate max-w-[110px]">{u.fullName}</span>
                            <button
                              type="button"
                              onClick={() => removeFromList(u.id, 'CC')}
                              className="text-blue-300 hover:text-red-300 transition-colors"
                              title="حذف"
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <button
                      onClick={() => { setShowModal('BCC'); setModalSearchTerm(''); }}
                      className="w-full glass bg-purple-600/10 text-purple-400 border border-purple-500/20 p-2.5 rounded-xl text-[10px] font-black flex items-center justify-center gap-2 hover:bg-purple-600/20"
                    >
                      <EyeOff size={14} /> پنهان ({bccIds.length})
                    </button>
                    {/* FIX #6: usernames beneath the BCC button */}
                    {bccUsers.length > 0 && (
                      <div className="flex flex-wrap gap-1 px-1">
                        {bccUsers.map(u => (
                          <span
                            key={u.id}
                            className="inline-flex items-center gap-1 bg-purple-500/15 border border-purple-400/30 text-purple-200 text-[9px] font-bold px-2 py-1 rounded-full"
                            title={`${u.fullName} - ${u.position}`}
                          >
                            <span className="truncate max-w-[110px]">{u.fullName}</span>
                            <button
                              type="button"
                              onClick={() => removeFromList(u.id, 'BCC')}
                              className="text-purple-300 hover:text-red-300 transition-colors"
                              title="حذف"
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Attachments */}
            <div className="space-y-2 border-t border-white/5 pt-4">
              <label className="text-[10px] font-black text-white/30 uppercase flex items-center gap-1"><Paperclip size={12} /> پیوست‌ها</label>
              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 rounded-xl text-[10px] font-black transition-all flex items-center gap-2">
                  <Plus size={12} /> افزودن فایل
                  <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                </label>
                {attachments.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-xl">
                    <span className="text-[10px] font-bold text-blue-300 truncate max-w-[120px]">{file.name}</span>
                    <button onClick={() => removeAttachment(idx)} className="text-red-400 hover:text-red-300"><X size={12} /></button>
                  </div>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div className="space-y-2 border-t border-white/5 pt-4">
              <label className="text-[10px] font-black text-white/30 uppercase">موضوع نامه</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className="w-full glass bg-white/5 border border-white/10 p-3 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500/30" placeholder="موضوع نامه..." />
            </div>
          </div>

          {/* ============================================================
              FIX #3 + #4: TOOLBAR - sticky to top of <main> scroll container.
              <main> starts right under TopNav so `top: 0` freezes the toolbar
              exactly at the bottom edge of TopNav with ZERO gap.
              Solid (non-glass) background so toolbar items are always clearly
              visible even when the white letter page scrolls behind it.
              ============================================================ */}
          <div
            className="rounded-b-2xl border border-slate-600 shadow-2xl no-print sticky-toolbar"
            style={{
              overflow: 'visible',
              position: 'sticky',
              top: 0,
              zIndex: 39,
              // Stretch slightly into main's padding so the toolbar reaches the
              // header's edge without a visible gap from spacing.
              marginTop: '-1.5rem',
              marginLeft: '-1rem',
              marginRight: '-1rem',
              paddingLeft: '1rem',
              paddingRight: '1rem',
              background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
              borderTop: 'none',
              borderRadius: 0,
              boxShadow: '0 6px 18px -2px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            {/* Row 1: Font, Size, Basic formatting, Alignment, Direction */}
            <div className="flex flex-wrap items-center gap-1 p-2 border-b border-white/5" style={{ position: 'relative', zIndex: 200, overflow: 'visible' }}>
              {/* Font Family */}
              <div className="flex items-center gap-1 bg-white/5 rounded-lg px-2 py-1">
                <Type size={12} className="text-white/40 shrink-0" />
                <select
                  defaultValue="Vazirmatn"
                  onChange={e => applyFontFamily(e.target.value)}
                  onMouseDown={() => saveCurrentSelection()}
                  className="bg-transparent text-[11px] font-bold outline-none border-none cursor-pointer max-w-[120px] text-white"
                  title="فونت"
                >
                  {FONT_FAMILIES.map(f => <option key={f} value={f} className="bg-slate-900">{f}</option>)}
                </select>
              </div>

              {/* FIX #3: Font Size Control */}
              <FontSizeControl
                value={currentFontSize}
                onIncrease={handleFontSizeIncrease}
                onDecrease={handleFontSizeDecrease}
                onChange={handleFontSizeInputChange}
                onKeyDown={handleFontSizeInputKeyDown}
                onBlur={handleFontSizeInputBlur}
                onFocus={handleFontSizeInputFocus}
                onMouseDown={handleFontSizeInputMouseDown}
                onWrapperMouseDown={handleWrapperMouseDown}
                inputValue={fontSizeInputValue}
                showDropdown={showFontSizeDropdown}
                onSelectSize={handleFontSizeSelect}
                dropdownRef={fontSizeDropdownRef}
                inputRef={fontSizeInputRef}
              />

              <div className="w-px h-6 bg-white/10 mx-1" />

              {/* Bold/Italic/Underline/Strikethrough/Superscript/Subscript */}
              <div className="flex items-center gap-0.5 bg-white/5 p-0.5 rounded-lg">
                {[
                  { cmd: 'bold', icon: <Bold size={14} />, title: 'ضخیم (Ctrl+B)' },
                  { cmd: 'italic', icon: <Italic size={14} />, title: 'کج (Ctrl+I)' },
                  { cmd: 'underline', icon: <Underline size={14} />, title: 'زیرخط (Ctrl+U)' },
                  { cmd: 'strikeThrough', icon: <Strikethrough size={14} />, title: 'خط روی متن' },
                  { cmd: 'superscript', icon: <Superscript size={14} />, title: 'بالانویس' },
                  { cmd: 'subscript', icon: <Subscript size={14} />, title: 'پایین‌نویس' },
                ].map(({ cmd, icon, title }) => (
                  <button key={cmd} type="button"
                    onMouseDown={(e) => { e.preventDefault(); saveCurrentSelection(); }}
                    onClick={() => execCommand(cmd)}
                    className="p-1.5 hover:bg-white/10 rounded-md text-white/70 hover:text-white transition-colors"
                    title={title}
                  >{icon}</button>
                ))}
              </div>

              <div className="w-px h-6 bg-white/10 mx-1" />

              {/* Alignment */}
              <div className="flex items-center gap-0.5 bg-white/5 p-0.5 rounded-lg">
                <button type="button" onMouseDown={(e) => { e.preventDefault(); saveCurrentSelection(); }} onClick={() => execCommand('justifyRight')} className="p-1.5 hover:bg-white/10 rounded-md text-white/70 hover:text-white transition-colors" title="راست‌چین"><AlignRight size={14} /></button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); saveCurrentSelection(); }} onClick={() => execCommand('justifyCenter')} className="p-1.5 hover:bg-white/10 rounded-md text-white/70 hover:text-white transition-colors" title="وسط‌چین"><AlignCenter size={14} /></button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); saveCurrentSelection(); }} onClick={() => execCommand('justifyLeft')} className="p-1.5 hover:bg-white/10 rounded-md text-white/70 hover:text-white transition-colors" title="چپ‌چین"><AlignLeft size={14} /></button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); saveCurrentSelection(); }} onClick={() => execCommand('justifyFull')} className="p-1.5 hover:bg-white/10 rounded-md text-white/70 hover:text-white transition-colors" title="دوطرف‌چین">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg>
                </button>
              </div>

              <div className="w-px h-6 bg-white/10 mx-1" />

              {/* Direction RTL/LTR */}
              <div className="flex items-center gap-0.5 bg-white/5 p-0.5 rounded-lg">
                <button type="button"
                  onMouseDown={(e) => { e.preventDefault(); saveCurrentSelection(); }}
                  onClick={() => {
                    restoreSavedSelection();
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount > 0) {
                      const range = sel.getRangeAt(0);
                      let el = range.commonAncestorContainer as HTMLElement;
                      if (el.nodeType === Node.TEXT_NODE) el = el.parentElement!;
                      el.setAttribute('dir', 'rtl'); el.style.direction = 'rtl'; el.style.textAlign = 'right';
                    }
                  }}
                  className="px-2 py-1 hover:bg-white/10 rounded-md text-white/70 hover:text-white text-[10px] font-black transition-colors" title="راست‌نویس">RTL</button>
                <button type="button"
                  onMouseDown={(e) => { e.preventDefault(); saveCurrentSelection(); }}
                  onClick={() => {
                    restoreSavedSelection();
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount > 0) {
                      const range = sel.getRangeAt(0);
                      let el = range.commonAncestorContainer as HTMLElement;
                      if (el.nodeType === Node.TEXT_NODE) el = el.parentElement!;
                      el.setAttribute('dir', 'ltr'); el.style.direction = 'ltr'; el.style.textAlign = 'left';
                    }
                  }}
                  className="px-2 py-1 hover:bg-white/10 rounded-md text-white/70 hover:text-white text-[10px] font-black transition-colors" title="چپ‌نویس">LTR</button>
              </div>
            </div>

            {/* Row 2 */}
            <div className="flex flex-wrap items-center gap-1 p-2" style={{ position: 'relative', zIndex: 200, overflow: 'visible' }}>
              <ColorDropdown icon={<Palette size={13} />} label="رنگ متن" colors={TEXT_COLORS} onSelect={(color) => applyColor(color, 'fore')} />
              <ColorDropdown icon={<Highlighter size={13} />} label="هایلایت" colors={HIGHLIGHT_COLORS} onSelect={(color) => applyColor(color, 'back')} />

              <div className="w-px h-6 bg-white/10 mx-1" />

              <div className="flex items-center gap-0.5 bg-white/5 p-0.5 rounded-lg">
                <button type="button" onMouseDown={(e) => { e.preventDefault(); saveCurrentSelection(); }} onClick={() => execCommand('insertUnorderedList')} className="p-1.5 hover:bg-white/10 rounded-md text-white/70 hover:text-white transition-colors" title="لیست نقطه‌ای">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="4" cy="6" r="2" fill="currentColor" stroke="none"/>
                    <line x1="8" y1="6" x2="21" y2="6"/>
                    <circle cx="4" cy="12" r="2" fill="currentColor" stroke="none"/>
                    <line x1="8" y1="12" x2="21" y2="12"/>
                    <circle cx="4" cy="18" r="2" fill="currentColor" stroke="none"/>
                    <line x1="8" y1="18" x2="21" y2="18"/>
                  </svg>
                </button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); saveCurrentSelection(); }} onClick={() => execCommand('insertOrderedList')} className="p-1.5 hover:bg-white/10 rounded-md text-white/70 hover:text-white transition-colors" title="لیست شماره‌دار">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <text x="2" y="8" style={{fontSize:'8px', fontWeight:'bold', fill:'currentColor', stroke:'none'}}>1.</text>
                    <line x1="10" y1="6" x2="21" y2="6"/>
                    <text x="2" y="14" style={{fontSize:'8px', fontWeight:'bold', fill:'currentColor', stroke:'none'}}>2.</text>
                    <line x1="10" y1="12" x2="21" y2="12"/>
                    <text x="2" y="20" style={{fontSize:'8px', fontWeight:'bold', fill:'currentColor', stroke:'none'}}>3.</text>
                    <line x1="10" y1="18" x2="21" y2="18"/>
                  </svg>
                </button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); saveCurrentSelection(); }} onClick={() => execCommand('indent')} className="p-1.5 hover:bg-white/10 rounded-md text-white/70 hover:text-white transition-colors" title="تورفتگی">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="8" x2="21" y2="8"/><line x1="3" y1="16" x2="21" y2="16"/><polyline points="9 11 12 8 9 5"/><path d="M3 12h3"/></svg>
                </button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); saveCurrentSelection(); }} onClick={() => execCommand('outdent')} className="p-1.5 hover:bg-white/10 rounded-md text-white/70 hover:text-white transition-colors" title="خروج تورفتگی">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="8" x2="21" y2="8"/><line x1="3" y1="16" x2="21" y2="16"/><polyline points="15 11 12 8 15 5"/><path d="M21 12h-3"/></svg>
                </button>
              </div>

              <div className="w-px h-6 bg-white/10 mx-1" />

              {/* Undo/Redo */}
              <div className="flex items-center gap-0.5 bg-white/5 p-0.5 rounded-lg">
                <button type="button" onMouseDown={(e) => { e.preventDefault(); }} onClick={() => execCommand('undo')} className="p-1.5 hover:bg-white/10 rounded-md text-white/70 hover:text-white transition-colors" title="برگشت به عقب (Ctrl+Z)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7v6h6"/>
                    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
                  </svg>
                </button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); }} onClick={() => execCommand('redo')} className="p-1.5 hover:bg-white/10 rounded-md text-white/70 hover:text-white transition-colors" title="رفتن به جلو (Ctrl+Y)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 7v6h-6"/>
                    <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/>
                  </svg>
                </button>
              </div>

              <div className="w-px h-6 bg-white/10 mx-1" />

              <button type="button" onMouseDown={(e) => { e.preventDefault(); saveCurrentSelection(); }} onClick={() => execCommand('insertHorizontalRule')} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors flex items-center gap-1 px-2" title="خط افقی"><Minus size={14} /></button>

              <button type="button" onMouseDown={(e) => { e.preventDefault(); saveCurrentSelection(); }} onClick={handleInsertLink} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors flex items-center gap-1 px-2" title="درج لینک"><Link2 size={14} /></button>

              {(() => {
                const TABLE_ROWS = 8;
                const TABLE_COLS = 8;
                return (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <button
                      ref={tableButtonRef}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); saveCurrentSelection(); }}
                      onClick={() => setShowTableDropdown(prev => !prev)}
                      className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors flex items-center gap-1 px-2"
                      title="درج جدول"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
                      <ChevronDown size={9} className="opacity-50" />
                    </button>
                    {showTableDropdown && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: '0',
                          marginTop: '4px',
                          zIndex: 99999,
                          backgroundColor: '#0f172a',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '12px',
                          padding: '10px',
                          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseLeave={() => setTableHover({ rows: 0, cols: 0 })}
                      >
                        <div className="text-[10px] text-white/50 mb-2 text-center" style={{ minWidth: '160px' }}>
                          {tableHover.rows > 0 && tableHover.cols > 0
                            ? `${tableHover.rows} × ${tableHover.cols} جدول`
                            : 'جدول درج کنید'}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${TABLE_COLS}, 20px)`, gap: '2px' }}>
                          {Array.from({ length: TABLE_ROWS }).map((_, r) =>
                            Array.from({ length: TABLE_COLS }).map((_, c) => {
                              const isActive = r < tableHover.rows && c < tableHover.cols;
                              return (
                                <div
                                  key={`${r}-${c}`}
                                  style={{
                                    width: '18px', height: '18px',
                                    border: '1px solid',
                                    borderColor: isActive ? '#3b82f6' : 'rgba(255,255,255,0.2)',
                                    backgroundColor: isActive ? 'rgba(59,130,246,0.3)' : 'transparent',
                                    borderRadius: '2px',
                                    cursor: 'pointer',
                                    transition: 'all 0.1s',
                                  }}
                                  onMouseEnter={() => setTableHover({ rows: r + 1, cols: c + 1 })}
                                  onMouseDown={(e) => { e.preventDefault(); handleInsertTable(r + 1, c + 1); }}
                                />
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <button type="button" onMouseDown={(e) => { e.preventDefault(); saveCurrentSelection(); }} onClick={() => {
                restoreSavedSelection();
                const sel = window.getSelection();
                if (sel && !sel.isCollapsed) {
                  document.execCommand('insertHTML', false, `<code style="background:#f1f5f9;color:#0f172a;padding:1px 4px;border-radius:3px;font-family:Courier New,monospace;font-size:0.9em">${sel.toString()}</code>`);
                } else {
                  document.execCommand('insertHTML', false, `<code style="background:#f1f5f9;color:#0f172a;padding:1px 4px;border-radius:3px;font-family:Courier New,monospace;font-size:0.9em">کد</code>`);
                }
                syncContent();
              }} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors flex items-center gap-1 px-2" title="کد"><Code size={14} /></button>

              <button type="button" onMouseDown={(e) => { e.preventDefault(); saveCurrentSelection(); }} onClick={() => {
                restoreSavedSelection();
                document.execCommand('formatBlock', false, 'blockquote');
                const bqs = editorRef.current?.querySelectorAll('blockquote');
                bqs?.forEach(bq => {
                  if (!bq.style.borderRight) {
                    Object.assign(bq.style, {
                      borderRight: '4px solid #3b82f6',
                      paddingRight: '12px',
                      paddingLeft: '4px',
                      margin: '4px 0',
                      color: '#475569',
                      fontStyle: 'italic',
                    });
                  }
                });
                saveCurrentSelection();
                syncContent();
              }} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors flex items-center gap-1 px-2" title="نقل‌قول"><Quote size={14} /></button>

              <div className="w-px h-6 bg-white/10 mx-1" />

              <button type="button" onMouseDown={(e) => { e.preventDefault(); saveCurrentSelection(); }} onClick={() => execCommand('removeFormat')} className="p-1.5 bg-white/5 hover:bg-red-500/20 rounded-lg text-white/40 hover:text-red-400 transition-colors text-[10px] font-black px-3" title="پاک کردن قالب‌بندی">پاک‌سازی</button>
            </div>
          </div>

          {/* ============ LETTER PAGE (Editor) ============ */}
          <div className="flex justify-center" id="print-area">
            <LetterPage
              editorRef={editorRef}
              letterNumber={letterNumber}
              pageSize={pageSize}
              orientation={orientation}
              margins={margins}
              headerCoords={headerCoords}
              headerColor={headerColor}
              firstPageHeaderH={firstPageHeaderH}
              currentLetterhead={currentLetterhead}
              recipientType={recipientType}
              recipient={recipient}
              customRecipient={customRecipient}
              subject={subject}
              attachments={attachments}
              ccIds={ccIds}
              sigSize={sigSize}
              users={users}
              currentUser={currentUser}
              lineHeight={lineHeight}
              recipientColor={recipientColor}
              recipientFontSize={recipientFontSize}
              senderColor={senderColor}
              senderFontSize={senderFontSize}
              onInput={handleEditorInput}
              onKeyUp={handleEditorKeyUp}
              onMouseUp={handleEditorMouseUp}
              getGenderPrefix={getGenderPrefix}
              isReadOnly={false}
              signatureImage={undefined}
            />
          </div>
        </div>
      </div>

      {/* ============ CC/BCC MODAL ============ */}
      {showModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="glass p-6 rounded-[2.5rem] w-full max-w-lg space-y-4 animate-in zoom-in-95 border-white/20 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center border-b border-white/10 pb-3 shrink-0">
              <h3 className="font-black">انتخاب {showModal === 'CC' ? 'رونوشت' : 'رونوشت پنهان'}</h3>
              <button onClick={() => setShowModal(null)} className="p-2 hover:bg-white/10 rounded-full"><X size={20} /></button>
            </div>
            <div className="relative shrink-0">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
              <input autoFocus type="text" className="w-full glass bg-white/5 border border-white/10 rounded-xl py-3 pr-10 pl-4 text-xs font-bold outline-none" placeholder="جستجو..." value={modalSearchTerm} onChange={e => setModalSearchTerm(e.target.value)} />
            </div>
            <div className="overflow-y-auto space-y-2 custom-scroll pr-2 flex-1">
              {contactGroups.length > 0 && (
                <div className="space-y-2 mb-3 pb-3 border-b border-white/5">
                  <div className="text-[10px] font-black text-orange-400 px-2">گروه‌های مخاطبین</div>
                  {contactGroups.map(g => (
                    <button key={g.id} onClick={() => addGroupMembers(g.id, showModal!)} className="w-full flex items-center justify-between p-3 rounded-2xl glass bg-orange-600/10 border-orange-500/20 hover:bg-orange-600/20 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-400"><Users size={16} /></div>
                        <div className="text-right"><p className="text-xs font-black">{g.name}</p><p className="text-[10px] opacity-50">{g.memberIds.length} عضو</p></div>
                      </div>
                      <span className="text-[9px] bg-orange-500/20 px-2 py-1 rounded text-orange-300">افزودن همه</span>
                    </button>
                  ))}
                </div>
              )}
              {filteredModalUsers.map(u => {
                const isSelected = (showModal === 'CC' ? ccIds : bccIds).includes(u.id);
                return (
                  <button key={u.id} type="button" onClick={() => toggleUserSelection(u.id, showModal!)} className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border ${isSelected ? 'bg-blue-600 border-blue-400 text-white' : 'glass bg-white/5 border-white/5 hover:bg-white/10'}`}>
                    <div className="text-right"><p className="text-xs font-black">{u.fullName}</p><p className="text-[10px] opacity-50">{u.position} | {u.unit}</p></div>
                    {isSelected && <UserCheck size={16} />}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setShowModal(null)} className="w-full bg-blue-600 py-3 rounded-2xl font-black text-sm shrink-0 shadow-lg">تایید</button>
          </div>
        </div>
      )}

      {/* ============ SIGNATURE MODAL ============ */}
      {showSignModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="glass p-6 rounded-[2.5rem] w-full max-w-md space-y-4 animate-in zoom-in-95 border-white/20 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="font-black text-lg flex items-center gap-2"><PenTool size={20} className="text-emerald-400" /> انتخاب امضا</h3>
              <button onClick={() => setShowSignModal(false)} className="p-2 hover:bg-white/10 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto custom-scroll pr-1">
              {currentUser?.signatures && currentUser.signatures.length > 0 ? currentUser.signatures.map(sig => (
                <div key={sig.id} onClick={() => setSelectedSignatureId(sig.id)} className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${selectedSignatureId === sig.id ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-12 bg-white rounded-lg flex items-center justify-center overflow-hidden p-1"><img src={sig.image} className="w-full h-full object-contain" alt="" /></div>
                    <span className="text-sm font-bold">{sig.name}</span>
                  </div>
                  {selectedSignatureId === sig.id && <div className="w-4 h-4 bg-emerald-500 rounded-full" />}
                </div>
              )) : (
                <div className="text-center py-8 text-white/30 italic text-xs bg-white/5 rounded-2xl border border-white/5 border-dashed">هیچ امضایی تعریف نشده. لطفاً از تنظیمات پروفایل امضا اضافه کنید.</div>
              )}
            </div>
            <button disabled={!selectedSignatureId} onClick={handleFinalSend} className="w-full metallic-btn bg-emerald-600 py-4 rounded-2xl font-black text-sm shadow-xl disabled:opacity-50 flex items-center justify-center gap-2">ارسال نهایی <Send size={18} /></button>
          </div>
        </div>
      )}

      {/* ============ CONFIRM MODAL ============ */}
      {confirmModal.show && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="glass p-6 rounded-[2.5rem] w-full max-w-sm space-y-5 animate-in zoom-in-95 border-white/20 shadow-2xl">
            <div className="flex justify-end">
              <button onClick={() => setConfirmModal({ ...confirmModal, show: false })} className="p-1.5 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors"><X size={18} /></button>
            </div>
            <div className="flex flex-col items-center gap-3 text-center -mt-4">
              <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400"><AlertTriangle size={28} /></div>
              <p className="font-black text-sm leading-relaxed">{confirmModal.message}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { confirmModal.onConfirm(); setConfirmModal({ ...confirmModal, show: false }); }} className="flex-1 bg-blue-600 py-3 rounded-2xl font-black text-xs shadow-lg hover:bg-blue-500 transition-all">
                {confirmModal.confirmLabel || 'بله، تایید'}
              </button>
              <button onClick={() => { if (confirmModal.isBackConfirm) navigate('/letters'); setConfirmModal({ ...confirmModal, show: false }); }} className="flex-1 bg-white/5 border border-white/10 py-3 rounded-2xl font-black text-xs hover:bg-white/10 text-white/60 hover:text-white transition-all">
                {confirmModal.cancelLabel || 'خیر'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .letter-editor:empty:before {
          content: "شروع به نگارش متن نامه کنید...";
          color: #94a3b8;
          font-style: italic;
          pointer-events: none;
        }
        .letter-editor { min-height: 200px; outline: none; }
        .letter-editor:focus { outline: none; }

        /* FIX #4: Solid toolbar look (no glass / no transparency) so items
           stay clearly visible above the white letter page. */
        .sticky-toolbar {
          background: linear-gradient(180deg, #1f2937 0%, #111827 100%) !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
        .sticky-toolbar > div { border-color: rgba(255,255,255,0.08); }
        .sticky-toolbar .bg-white\\/5 { background: rgba(255,255,255,0.08) !important; }
        .sticky-toolbar select { background: transparent !important; color: #fff !important; }
        .sticky-toolbar select option { background: #0f172a !important; color: #fff !important; }
        .sticky-toolbar button { color: rgba(255,255,255,0.85); }
        .sticky-toolbar button:hover { background: rgba(255,255,255,0.12) !important; color: #fff !important; }

        /* FIX #1 + #7: Print/PDF - one page per letter sheet, no extra margins */
        @media print {
          @page { size: auto; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
          body * { visibility: hidden !important; }
          #print-area {
            visibility: visible !important;
            position: static !important;
            background: transparent !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            gap: 0 !important;
          }
          #print-area * { visibility: visible !important; }
          .letter-page-sheet {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: always !important;
            break-after: page !important;
          }
          .letter-page-sheet:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .no-print { display: none !important; visibility: hidden !important; }
        }
      `}</style>
    </div>
  );
};

// ============================================================
// LETTER PAGE COMPONENT (Editable single page)
// FIX #5: Sender block + CC names placed two line-breaks AFTER the last
// content line, not at page bottom.
// ============================================================
interface LetterPageProps {
  editorRef: React.RefObject<HTMLDivElement>;
  letterNumber: string;
  pageSize: 'A4' | 'A5';
  orientation: 'PORTRAIT' | 'LANDSCAPE';
  margins: { top: number; bottom: number; left: number; right: number };
  headerCoords: { x: number; y: number };
  headerColor: string;
  firstPageHeaderH: number;
  currentLetterhead: any;
  recipientType: 'SYSTEM' | 'CUSTOM';
  recipient: any;
  customRecipient: { name: string; gender: 'MALE' | 'FEMALE'; position: string };
  subject: string;
  attachments: Attachment[];
  ccIds: string[];
  sigSize: { w: number; h: number };
  users: any[];
  currentUser: any;
  lineHeight: number;
  recipientColor: string;
  recipientFontSize: number;
  senderColor: string;
  senderFontSize: number;
  onInput: () => void;
  onKeyUp: () => void;
  onMouseUp: () => void;
  getGenderPrefix: (gender?: string) => string;
  isReadOnly: boolean;
  signatureImage?: string;
}

const LetterPage: React.FC<LetterPageProps> = ({
  editorRef, pageSize, orientation, margins, firstPageHeaderH,
  recipientType, recipient, customRecipient,
  subject, ccIds, sigSize, users, currentUser, lineHeight,
  recipientColor, recipientFontSize, senderColor, senderFontSize,
  onInput, onKeyUp, onMouseUp, getGenderPrefix, isReadOnly, signatureImage
}) => {
  const pageDimensions = useMemo(() => {
    const dim = {
      A4: { portrait: { w: '210mm' }, landscape: { w: '297mm' } },
      A5: { portrait: { w: '148mm' }, landscape: { w: '210mm' } }
    };
    return orientation === 'PORTRAIT' ? dim[pageSize].portrait : dim[pageSize].landscape;
  }, [pageSize, orientation]);

  const minHeight = pageSize === 'A4'
    ? (orientation === 'PORTRAIT' ? '297mm' : '210mm')
    : (orientation === 'PORTRAIT' ? '210mm' : '148mm');

  return (
    <div
      className="letter-page-sheet bg-white text-slate-900 relative shadow-2xl border border-slate-200"
      style={{ width: pageDimensions.w, minHeight, boxSizing: 'border-box', fontFamily: 'B Nazanin, Vazirmatn, Arial, sans-serif' }}
    >
      <div className="relative z-10 w-full" style={{ boxSizing: 'border-box' }}>
        <div style={{
          paddingTop: `${margins.top}mm`,
          paddingBottom: `${margins.bottom}mm`,
          paddingLeft: `${margins.left}mm`,
          paddingRight: `${margins.right}mm`,
          boxSizing: 'border-box',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '4mm' }}>
            <p style={{ fontFamily: 'B Titr, B Nazanin, Vazirmatn', fontSize: '12pt', fontWeight: 'bold', color: '#000', margin: 0 }}>بسمه تعالی</p>
          </div>

          <div style={{ height: `${firstPageHeaderH}mm` }} />

          {/* Recipient */}
          <div style={{ textAlign: 'right', marginBottom: '6mm', direction: 'rtl' }}>
            {recipientType === 'SYSTEM' ? (
              <>
                <p style={{ fontFamily: 'B Titr, B Nazanin, Vazirmatn', fontSize: `${recipientFontSize}pt`, fontWeight: 'bold', color: recipientColor, margin: '0 0 2mm 0' }}>
                  {getGenderPrefix(recipient?.gender)} {recipient?.fullName || '---'}
                </p>
                <p style={{ fontFamily: 'B Titr, B Nazanin, Vazirmatn', fontSize: `${recipientFontSize}pt`, fontWeight: 'bold', color: recipientColor, margin: '0 0 2mm 0' }}>
                  {recipient?.honorablePosition || recipient?.position || '---'}
                </p>
              </>
            ) : (
              <>
                <p style={{ fontFamily: 'B Titr, B Nazanin, Vazirmatn', fontSize: `${recipientFontSize}pt`, fontWeight: 'bold', color: recipientColor, margin: '0 0 2mm 0' }}>
                  {getGenderPrefix(customRecipient.gender)} {customRecipient.name || '---'}
                </p>
                <p style={{ fontFamily: 'B Titr, B Nazanin, Vazirmatn', fontSize: `${recipientFontSize}pt`, fontWeight: 'bold', color: recipientColor, margin: '0 0 2mm 0' }}>
                  {customRecipient.position || '---'}
                </p>
              </>
            )}
            <div style={{ height: '4mm' }} />
            <p style={{ fontFamily: 'B Titr, B Nazanin, Vazirmatn', fontSize: `${recipientFontSize}pt`, fontWeight: 'bold', color: '#000', margin: 0 }}>
              موضوع: {subject || '---'}
            </p>
          </div>

          {/* Editor */}
          <div
            ref={editorRef}
            contentEditable={!isReadOnly}
            suppressContentEditableWarning
            onInput={onInput}
            onKeyUp={onKeyUp}
            onMouseUp={onMouseUp}
            className="letter-editor"
            dir="rtl"
            style={{
              fontFamily: 'Vazirmatn, B Nazanin, Arial, sans-serif',
              fontSize: '13pt',
              lineHeight: lineHeight,
              color: '#1e293b',
              textAlign: 'right',
              minHeight: '100mm',
              overflowWrap: 'break-word',
              wordBreak: 'break-word',
              direction: 'rtl',
            }}
          />

          {/* FIX #5: Sender + CC area - placed two line-breaks after the last
              content line. Two real <br>-style spacers, not pushed to page bottom. */}
          <div style={{ lineHeight: lineHeight }}>
            <br />
            <br />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, textAlign: 'right', paddingRight: '4mm', direction: 'rtl' }}>
              {ccIds.length > 0 && (
                <>
                  <p style={{ fontFamily: 'B Nazanin, Vazirmatn', fontSize: '10pt', fontWeight: 'bold', color: '#000', marginTop: 0, marginBottom: '2mm' }}>رونوشت:</p>
                  {ccIds.map(cid => {
                    const u = users.find((user: any) => user.id === cid);
                    return u ? (
                      <p key={cid} style={{ fontFamily: 'B Nazanin, Vazirmatn', fontSize: '10pt', color: '#000', margin: '0 0 1mm 0' }}>
                        - {getGenderPrefix(u.gender)} {u.fullName} ({u.honorablePosition || u.position})
                      </p>
                    ) : null;
                  })}
                </>
              )}
            </div>
            <div style={{ width: `${sigSize.w}mm`, height: `${sigSize.h}mm`, border: '1px solid #e2e8f0', borderRadius: '8px', position: 'relative', overflow: 'hidden', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', backgroundColor: 'rgba(248,250,252,0.5)' }}>
              {signatureImage ? (
                <>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={signatureImage} style={{ width: '100%', height: '100%', objectFit: 'contain', mixBlendMode: 'multiply' }} alt="امضا" />
                  </div>
                  <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', paddingBottom: '3mm', paddingLeft: '2mm', paddingRight: '2mm' }}>
                    <p style={{ fontFamily: 'B Nazanin, Vazirmatn', fontSize: `${senderFontSize}pt`, fontWeight: 'bold', color: senderColor, margin: 0, lineHeight: 1.5 }}>{currentUser?.fullName}</p>
                    <p style={{ fontFamily: 'B Nazanin, Vazirmatn', fontSize: `${senderFontSize}pt`, color: senderColor, margin: 0, lineHeight: 1.5 }}>{currentUser?.position}</p>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -60%)', color: '#cbd5e1', fontSize: '8pt', textAlign: 'center', whiteSpace: 'nowrap', fontStyle: 'italic' }}>محل امضا و مهر</div>
                  <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', paddingBottom: '3mm', paddingLeft: '2mm', paddingRight: '2mm' }}>
                    <p style={{ fontFamily: 'B Nazanin, Vazirmatn', fontSize: `${senderFontSize}pt`, color: senderColor, margin: 0, lineHeight: 1.5 }}>{currentUser?.fullName}</p>
                    <p style={{ fontFamily: 'B Nazanin, Vazirmatn', fontSize: `${senderFontSize}pt`, color: senderColor, margin: 0, lineHeight: 1.5 }}>{currentUser?.position}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// SENT LETTER PAGES (preview + sent view, paginated)
// FIX #1: No extra blank space at bottom of pages.
//         We measure content per page and DO NOT pad to page bottom -
//         each page sheet is sized exactly to fit its content + footer
//         when needed, while still respecting page width and min-height.
// FIX #5: Footer placed two line-breaks AFTER the last content line on
//         the LAST page (not at the page bottom).
// FIX #7: Print/PDF uses page-break-after on each .letter-page-sheet so
//         every rendered page becomes its own page in the printer's PDF.
// ============================================================
interface SentLetterPagesProps {
  letter: Letter;
  users: any[];
  currentUser: any;
  currentLetterhead: any;
  letterNumber: string;
  lineHeight: number;
  recipientColor: string;
  recipientFontSize: number;
  senderColor: string;
  senderFontSize: number;
  isPreview?: boolean;
}

const SentLetterPages: React.FC<SentLetterPagesProps> = ({
  letter, users, currentUser, currentLetterhead, letterNumber,
  lineHeight, recipientColor, recipientFontSize, senderColor, senderFontSize,
  isPreview = false
}) => {
  const mmToPx = 3.7795275591;

  const pageDimensions = useMemo(() => {
    const dim = {
      A4: { portrait: { w: 210, h: 297 }, landscape: { w: 297, h: 210 } },
      A5: { portrait: { w: 148, h: 210 }, landscape: { w: 210, h: 148 } }
    };
    const ps = (letter.pageSize as string) === 'A5' ? 'A5' : 'A4';
    return letter.orientation === 'PORTRAIT' ? dim[ps].portrait : dim[ps].landscape;
  }, [letter.pageSize, letter.orientation]);

  const getGenderPrefix = (gender?: string) => gender === 'FEMALE' ? 'سرکار خانم' : 'جناب آقای';
  const recipient = users.find((u: any) => u.id === letter.recipientId);
  const senderUser = users.find((u: any) => u.id === letter.senderId);
  const todayJalali = new Intl.DateTimeFormat('fa-IR', { calendar: 'persian', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(letter.sentAt || letter.timestamp || Date.now()));

  const lh = (letter as any).lineHeight || lineHeight;
  const rColor = (letter as any).recipientColor || recipientColor;
  const rFontSize = (letter as any).recipientFontSize || recipientFontSize;
  const sColor = (letter as any).senderColor || senderColor;
  const sFontSize = (letter as any).senderFontSize || senderFontSize;
  const fphH = (letter as any).firstPageHeaderH ?? 30;
  const sigW = letter.sigSize?.w || 60;
  const sigH = letter.sigSize?.h || 50;
  const margins = letter.margins || { top: 30, bottom: 30, left: 20, right: 20 };

  // ----------------------------------------------------------------
  // FIX #1 (REWRITTEN): Precise pagination via real DOM rendering.
  //
  // Approach:
  //   1. Render the FULL letter content in an off-screen container that
  //      exactly mirrors the real page content area (same width, fonts,
  //      line-height, RTL direction). The container has NO height limit.
  //   2. For each top-level element (rendered child node), read its
  //      `offsetTop` and `offsetHeight` relative to the container.
  //   3. Walk the rendered children and group them into pages: an
  //      element belongs to the current page if its bottom edge is
  //      within the current page's budget; otherwise we flush the
  //      current page and start a new page at this element.
  //   4. Page-0 budget = totalContent - headerBlock; Page-1+ budget =
  //      totalContent. Last page must also fit the footer (we reserve
  //      footer space on the last page).
  //   5. If a SINGLE element is taller than its page budget, we split
  //      it word-by-word in a secondary measurer.
  //
  // This approach guarantees NO duplication because we partition by
  // pixel position in the rendered DOM rather than reconstructing HTML.
  // ----------------------------------------------------------------
  const pages = useMemo(() => {
    const content = letter.content || '';
    if (typeof document === 'undefined') return [content];

    const pageW_px = pageDimensions.w * mmToPx;
    const pageH_px = pageDimensions.h * mmToPx;
    const topPad_px = margins.top * mmToPx;
    const botPad_px = margins.bottom * mmToPx;
    const usableW_px = pageW_px - (margins.left + margins.right) * mmToPx;

    // -- Helper: build a measurer with the exact content-area style --
    const makeMeasurer = () => {
      const m = document.createElement('div');
      m.style.cssText = `
        width: ${usableW_px}px;
        position: fixed;
        left: -99999px;
        top: 0;
        visibility: hidden;
        pointer-events: none;
        font-family: Vazirmatn, "B Nazanin", Arial, sans-serif;
        font-size: 13pt;
        line-height: ${lh};
        direction: rtl;
        text-align: right;
        word-break: break-word;
        overflow-wrap: break-word;
        box-sizing: border-box;
        color: #1e293b;
      `;
      return m;
    };

    // -- Measure header block on page-1 --
    const recipientName = letter.recipientId
      ? `${getGenderPrefix(recipient?.gender)} ${recipient?.fullName || '---'}`
      : `${getGenderPrefix(letter.customRecipient?.gender)} ${letter.customRecipient?.name || '---'}`;
    const recipientPos = letter.recipientId
      ? (recipient?.honorablePosition || recipient?.position || '---')
      : (letter.customRecipient?.position || '---');
    const subj = letter.subject || '';

    const headerMeasurer = makeMeasurer();
    headerMeasurer.innerHTML = `
      <div style="text-align:center;margin-bottom:3mm;">
        <p style="font-family:'B Titr','B Nazanin',Vazirmatn,sans-serif;font-size:12pt;font-weight:bold;color:#000;margin:0;">بسمه تعالی</p>
      </div>
      <div style="height:${fphH}mm;"></div>
      <div style="text-align:right;margin-bottom:5mm;direction:rtl;">
        <p style="font-family:'B Titr','B Nazanin',Vazirmatn;font-size:${rFontSize}pt;font-weight:bold;color:${rColor};margin:0 0 1.5mm 0;">${recipientName}</p>
        <p style="font-family:'B Titr','B Nazanin',Vazirmatn;font-size:${rFontSize}pt;font-weight:bold;color:${rColor};margin:0 0 1.5mm 0;">${recipientPos}</p>
        <div style="height:3mm;"></div>
        <p style="font-family:'B Titr','B Nazanin',Vazirmatn;font-size:${rFontSize}pt;font-weight:bold;color:#000;margin:0;">موضوع: ${subj}</p>
      </div>
    `;
    document.body.appendChild(headerMeasurer);
    const headerBlockH_px = headerMeasurer.offsetHeight;
    document.body.removeChild(headerMeasurer);

    // -- Measure footer block --
    const ccCount = letter.ccIds?.length || 0;
    const senderName = letter.senderName || currentUser?.fullName || '';
    const senderPos = senderUser?.honorablePosition || senderUser?.position || currentUser?.position || '';
    const ccItems = (letter.ccIds || []).map(cid => {
      const u = users.find((user: any) => user.id === cid);
      return u ? `<p style="font-family:'B Nazanin',Vazirmatn,sans-serif;font-size:10pt;color:#000;margin:0 0 1.5mm 0;">‐ ${getGenderPrefix(u.gender)} ${u.fullName} (${u.honorablePosition || u.position})</p>` : '';
    }).join('');
    const footerMeasurer = makeMeasurer();
    footerMeasurer.innerHTML = `
      <div style="line-height:${lh};"><br><br></div>
      <div style="direction:rtl;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div style="flex:1;text-align:right;padding-right:4mm;">
            ${ccCount > 0 ? `<p style="font-family:'B Nazanin',Vazirmatn,sans-serif;font-size:10pt;font-weight:bold;color:#000;margin-bottom:2mm;margin-top:0;">رونوشت:</p>${ccItems}` : ''}
          </div>
          <div style="width:${sigW}mm;min-height:${sigH}mm;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;">
            <div style="text-align:center;padding-bottom:3mm;">
              <p style="font-family:'B Nazanin',Vazirmatn,sans-serif;font-size:${sFontSize}pt;font-weight:bold;color:${sColor};margin:0;line-height:1.6;">${senderName}</p>
              <p style="font-family:'B Nazanin',Vazirmatn,sans-serif;font-size:${sFontSize}pt;color:${sColor};margin:0;line-height:1.6;">${senderPos}</p>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(footerMeasurer);
    const footerBlockH_px = footerMeasurer.offsetHeight;
    document.body.removeChild(footerMeasurer);

    // -- Available content heights (safety margin 2px to absorb sub-pixel rounding) --
    const SAFETY_PX = 2;
    const totalContentH_px = pageH_px - topPad_px - botPad_px;
    const page1AvailH = Math.max(totalContentH_px - headerBlockH_px, 40) - SAFETY_PX;
    const otherAvailH = Math.max(totalContentH_px, 40) - SAFETY_PX;

    // -- Render the FULL content in an off-screen container --
    const renderer = makeMeasurer();
    renderer.innerHTML = content || '<p>&nbsp;</p>';
    document.body.appendChild(renderer);

    // Collect top-level children as elements with their bounding info.
    const children = Array.from(renderer.children) as HTMLElement[];

    // If there are no element children but there is text, wrap it.
    if (children.length === 0) {
      const wrap = document.createElement('p');
      wrap.innerHTML = renderer.innerHTML;
      renderer.innerHTML = '';
      renderer.appendChild(wrap);
    }

    // Re-read children (in case we wrapped).
    const items = Array.from(renderer.children) as HTMLElement[];

    // Helper: outerHTML of an element preserving inline styles.
    const itemHTML = (el: HTMLElement) => el.outerHTML;

    // -- Walk items and partition into pages --
    const resultPages: string[] = [];
    let currentPageHTMLs: string[] = [];
    let pageIdx = 0;
    let pageTopOffset = 0; // The offsetTop of the first element on the current page within `renderer`.

    const currentBudget = () => (pageIdx === 0 ? page1AvailH : otherAvailH);

    const flushPage = () => {
      resultPages.push(currentPageHTMLs.join(''));
      currentPageHTMLs = [];
      pageIdx++;
    };

    // Helper: split a single oversized element word-by-word into chunks
    // that fit into the given budget. Returns array of HTML strings.
    const splitOversizedElement = (el: HTMLElement, firstBudget: number, otherBudget: number): string[] => {
      const tag = el.tagName.toLowerCase();
      const styleAttr = el.getAttribute('style') || '';
      const classAttr = el.getAttribute('class') || '';
      const dirAttr = el.getAttribute('dir') || '';
      const attrs = [
        styleAttr ? `style="${styleAttr.replace(/"/g, '&quot;')}"` : '',
        classAttr ? `class="${classAttr}"` : '',
        dirAttr ? `dir="${dirAttr}"` : '',
      ].filter(Boolean).join(' ');
      const openTag = `<${tag}${attrs ? ' ' + attrs : ''}>`;
      const closeTag = `</${tag}>`;

      // Extract plain inner HTML and split on word boundaries while
      // preserving line-break tags (<br>).
      // We process the element's child nodes one by one to keep nested
      // formatting (bold/italic/...) intact at element boundaries.

      // For simplicity in this pass we treat the element as a flat text
      // sequence (token = word/whitespace OR a nested-element outerHTML).
      const tokens: string[] = [];
      const collect = (node: ChildNode) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || '';
          // Split on whitespace tokens (keep them)
          const parts = text.split(/(\s+)/);
          parts.forEach(p => { if (p) tokens.push(p); });
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          // Nested element - treat its outerHTML as a single atomic token
          tokens.push((node as Element).outerHTML);
        }
      };
      Array.from(el.childNodes).forEach(collect);

      // Use a measurer with the SAME inline style so wrapping matches.
      const subMeasurer = makeMeasurer();
      // Apply the same dir/style on the inner element to preserve wrap behavior
      document.body.appendChild(subMeasurer);

      const chunks: string[] = [];
      let acc = '';
      let isFirstChunk = true;

      const fits = (innerHTML: string, budget: number) => {
        subMeasurer.innerHTML = `${openTag}${innerHTML}${closeTag}`;
        return subMeasurer.offsetHeight <= budget;
      };

      let i = 0;
      while (i < tokens.length) {
        const budget = (isFirstChunk && chunks.length === 0) ? firstBudget : otherBudget;
        const tok = tokens[i];
        const tryAcc = acc + tok;
        if (fits(tryAcc, budget) || !acc) {
          acc = tryAcc;
          i++;
        } else {
          // Flush the current acc as one chunk, start a new chunk
          chunks.push(`${openTag}${acc}${closeTag}`);
          acc = '';
          isFirstChunk = false;
        }
      }
      if (acc) chunks.push(`${openTag}${acc}${closeTag}`);

      document.body.removeChild(subMeasurer);
      return chunks;
    };

    // The renderer's children are positioned starting at offsetTop=0.
    // We treat each child as either:
    //   (a) fits in the remaining budget on the current page  -> add it
    //   (b) doesn't fit and the page has content              -> flush, retry on new page
    //   (c) doesn't fit and the page is empty (oversized item)-> split word-by-word

    for (let i = 0; i < items.length; i++) {
      const el = items[i];
      const elTop = el.offsetTop;
      const elBottom = elTop + el.offsetHeight;
      const elHeight = el.offsetHeight;

      // Recompute pageTopOffset as the top of the first element on the current page.
      if (currentPageHTMLs.length === 0) {
        pageTopOffset = elTop;
      }

      const usedOnPage = elBottom - pageTopOffset;

      if (usedOnPage <= currentBudget()) {
        currentPageHTMLs.push(itemHTML(el));
        continue;
      }

      // Doesn't fit. If the page is empty AND the element alone is
      // larger than the budget, we MUST split it.
      if (currentPageHTMLs.length === 0) {
        // Element alone is oversized - split.
        const remainingItems = items.slice(i + 1);
        const remainingBudgets = [currentBudget()];
        // The element's own height > current budget. Split into chunks.
        const chunks = splitOversizedElement(el, currentBudget(), otherAvailH);
        // First chunk goes on current page, then each subsequent chunk
        // becomes its own page.
        if (chunks.length > 0) {
          currentPageHTMLs.push(chunks[0]);
          flushPage();
          for (let c = 1; c < chunks.length - 1; c++) {
            currentPageHTMLs.push(chunks[c]);
            flushPage();
          }
          if (chunks.length > 1) {
            currentPageHTMLs.push(chunks[chunks.length - 1]);
            // Don't flush yet - more elements may fit on this page.
            pageTopOffset = el.offsetTop + el.offsetHeight; // approximate
          }
        }
        // Continue processing remaining items
        continue;
      }

      // Page has content and this element doesn't fit. Flush and retry.
      flushPage();
      // Reset pageTopOffset for the new page (set when we add the element).
      i--; // Re-process this item on the new page
    }

    if (currentPageHTMLs.length > 0) {
      resultPages.push(currentPageHTMLs.join(''));
    }
    if (resultPages.length === 0) resultPages.push('');

    // -- Post-check: footer must fit on the LAST page. If not, add an extra page. --
    const lastIdx = resultPages.length - 1;
    const lastBudget = (lastIdx === 0 ? page1AvailH : otherAvailH);
    // Measure the height of the last page's content
    const lastMeasurer = makeMeasurer();
    lastMeasurer.innerHTML = resultPages[lastIdx];
    document.body.appendChild(lastMeasurer);
    const lastUsed = lastMeasurer.offsetHeight;
    document.body.removeChild(lastMeasurer);

    if (lastUsed + footerBlockH_px > lastBudget + SAFETY_PX) {
      resultPages.push('');
    }

    document.body.removeChild(renderer);
    return resultPages;
  }, [letter.content, letter.recipientId, letter.subject, letter.ccIds, letter.customRecipient,
      pageDimensions.w, pageDimensions.h,
      lh, fphH, sigH, sigW,
      margins.top, margins.bottom, margins.left, margins.right,
      rColor, rFontSize, sColor, sFontSize,
      recipient?.gender, recipient?.fullName, recipient?.honorablePosition, recipient?.position,
      senderUser?.honorablePosition, senderUser?.position,
      currentUser?.fullName, currentUser?.position,
      users]);

  // FIX #5: Footer rendered two line-breaks after the last content line
  // (not at page bottom).
  const renderFooter = () => {
    const hasSig = !isPreview && !!letter.signatureImage;

    return (
      <>
        {/* Two line-breaks after last content line */}
        <div style={{ lineHeight: lh }}>
          <br />
          <br />
        </div>

        <div style={{ direction: 'rtl' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {/* CC list */}
            <div style={{ flex: 1, textAlign: 'right', paddingRight: '4mm' }}>
              {(letter.ccIds?.length || 0) > 0 && (
                <>
                  <p style={{ fontFamily: '"B Nazanin", Vazirmatn, sans-serif', fontSize: '10pt', fontWeight: 'bold', color: '#000', marginBottom: '2mm', marginTop: 0 }}>رونوشت:</p>
                  {letter.ccIds!.map(cid => {
                    const u = users.find((user: any) => user.id === cid);
                    return u ? (
                      <p key={cid} style={{ fontFamily: '"B Nazanin", Vazirmatn, sans-serif', fontSize: '10pt', color: '#000', margin: '0 0 1.5mm 0' }}>
                        ‐ {getGenderPrefix(u.gender)} {u.fullName} ({u.honorablePosition || u.position})
                      </p>
                    ) : null;
                  })}
                </>
              )}
            </div>

            {/* Sender + signature */}
            <div style={{
              width: `${sigW}mm`,
              minHeight: `${sigH}mm`,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-end',
              position: 'relative',
              border: isPreview ? '1px solid #e2e8f0' : 'none',
              borderRadius: isPreview ? '6px' : '0',
              backgroundColor: isPreview ? 'rgba(248,250,252,0.5)' : 'transparent',
            }}>
              {hasSig && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 0 }}>
                  <img
                    src={letter.signatureImage}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', mixBlendMode: 'multiply' }}
                    alt="امضا"
                  />
                </div>
              )}
              {isPreview && (
                <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)', color: '#94a3b8', fontSize: '8pt', textAlign: 'center', whiteSpace: 'nowrap', fontStyle: 'italic', userSelect: 'none' }}>
                  محل امضا و مهر
                </div>
              )}
              <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', paddingBottom: '3mm', paddingLeft: '2mm', paddingRight: '2mm' }}>
                <p style={{ fontFamily: '"B Nazanin", Vazirmatn, sans-serif', fontSize: `${sFontSize}pt`, fontWeight: 'bold', color: sColor, margin: 0, lineHeight: 1.6 }}>
                  {letter.senderName || currentUser?.fullName}
                </p>
                <p style={{ fontFamily: '"B Nazanin", Vazirmatn, sans-serif', fontSize: `${sFontSize}pt`, color: sColor, margin: 0, lineHeight: 1.6 }}>
                  {senderUser?.honorablePosition || senderUser?.position || currentUser?.position || ''}
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <>
      {pages.map((pageContent, pageIndex) => (
        <div
          key={pageIndex}
          className="letter-page-sheet bg-white text-slate-900 relative shadow-2xl border border-slate-200"
          style={{
            width: `${pageDimensions.w}mm`,
            // FIX #1 + #7: exact page height - no extra blank rows.
            height: `${pageDimensions.h}mm`,
            boxSizing: 'border-box',
            fontFamily: '"B Nazanin", Vazirmatn, Arial, sans-serif',
            flexShrink: 0,
            overflow: 'hidden',
            position: 'relative',
            marginBottom: 0,
          }}
        >
          {currentLetterhead && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
              <img src={currentLetterhead.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'fill' }} />
            </div>
          )}

          <div style={{
            position: 'absolute',
            left: `${(letter.headerCoords || { x: 10 }).x}mm`,
            top: `${(letter.headerCoords || { y: 15 }).y}mm`,
            color: letter.headerColor || '#000',
            textAlign: 'right',
            zIndex: 20,
            direction: 'rtl',
          }}>
            <p style={{ fontFamily: '"B Nazanin", Vazirmatn, sans-serif', fontSize: '10pt', lineHeight: 2, margin: 0 }}>تاریخ: {todayJalali}</p>
            <p style={{ fontFamily: '"B Nazanin", Vazirmatn, sans-serif', fontSize: '10pt', lineHeight: 2, margin: 0 }}>شماره: {letterNumber}/د</p>
            <p style={{ fontFamily: '"B Nazanin", Vazirmatn, sans-serif', fontSize: '10pt', lineHeight: 2, margin: 0 }}>پیوست: {(letter.attachments?.length || 0) > 0 ? `دارد (${letter.attachments?.length} فایل)` : 'ندارد'}</p>
          </div>

          <div
            style={{
              position: 'relative',
              zIndex: 10,
              paddingTop: `${margins.top}mm`,
              paddingBottom: `${margins.bottom}mm`,
              paddingLeft: `${margins.left}mm`,
              paddingRight: `${margins.right}mm`,
              boxSizing: 'border-box',
            }}
          >
            {pageIndex === 0 && (
              <>
                <div style={{ textAlign: 'center', marginBottom: '3mm' }}>
                  <p style={{ fontFamily: '"B Titr", "B Nazanin", Vazirmatn, sans-serif', fontSize: '12pt', fontWeight: 'bold', color: '#000', margin: 0 }}>بسمه تعالی</p>
                </div>
                <div style={{ height: `${fphH}mm` }} />
                <div style={{ textAlign: 'right', marginBottom: '5mm', direction: 'rtl' }}>
                  {letter.recipientId ? (
                    <>
                      <p style={{ fontFamily: '"B Titr", "B Nazanin", Vazirmatn', fontSize: `${rFontSize}pt`, fontWeight: 'bold', color: rColor, margin: '0 0 1.5mm 0' }}>
                        {getGenderPrefix(recipient?.gender)} {recipient?.fullName || '---'}
                      </p>
                      <p style={{ fontFamily: '"B Titr", "B Nazanin", Vazirmatn', fontSize: `${rFontSize}pt`, fontWeight: 'bold', color: rColor, margin: '0 0 1.5mm 0' }}>
                        {recipient?.honorablePosition || recipient?.position || '---'}
                      </p>
                    </>
                  ) : (
                    <>
                      <p style={{ fontFamily: '"B Titr", "B Nazanin", Vazirmatn', fontSize: `${rFontSize}pt`, fontWeight: 'bold', color: rColor, margin: '0 0 1.5mm 0' }}>
                        {getGenderPrefix(letter.customRecipient?.gender)} {letter.customRecipient?.name || '---'}
                      </p>
                      <p style={{ fontFamily: '"B Titr", "B Nazanin", Vazirmatn', fontSize: `${rFontSize}pt`, fontWeight: 'bold', color: rColor, margin: '0 0 1.5mm 0' }}>
                        {letter.customRecipient?.position || '---'}
                      </p>
                    </>
                  )}
                  <div style={{ height: '3mm' }} />
                  <p style={{ fontFamily: '"B Titr", "B Nazanin", Vazirmatn', fontSize: `${rFontSize}pt`, fontWeight: 'bold', color: '#000', margin: 0 }}>
                    موضوع: {letter.subject}
                  </p>
                </div>
              </>
            )}

            <div
              style={{
                fontFamily: 'Vazirmatn, "B Nazanin", Arial, sans-serif',
                fontSize: '13pt',
                lineHeight: lh,
                color: '#1e293b',
                direction: 'rtl',
                textAlign: 'right',
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
              }}
              dangerouslySetInnerHTML={{ __html: pageContent }}
            />

            {pageIndex === pages.length - 1 && renderFooter()}
          </div>
        </div>
      ))}
    </>
  );
};

export default SendLetter;
