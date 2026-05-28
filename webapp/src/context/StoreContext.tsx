
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Task, AppNotification, AppTheme, SystemSettings, PersonalLabel, Message, Letter, Letterhead, ContactGroup } from '../types';
import { getTehranTime } from '../utils/jalali';
import { apiService } from '../services/apiService';
import { socketService } from '../services/socketService';

interface StoreContextType {
  users: User[];
  tasks: Task[];
  notifications: AppNotification[];
  currentUser: User | null;
  currentTheme: AppTheme;
  systemSettings: SystemSettings;
  units: string[];
  positions: string[];
  isLoading: boolean;
  userPriorityList: string[];
  personalLabels: PersonalLabel[];
  taskLabelMap: Record<string, string[]>;
  messages: Message[];
  letters: Letter[];
  drafts: Letter[];
  contactGroups: ContactGroup[];
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  addUser: (user: User) => Promise<boolean>;
  updateUser: (user: User) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  upsertTask: (task: Task) => Promise<void>;
  markNotificationRead: (id: string) => void;
  setTheme: (theme: AppTheme) => void;
  updateSettings: (settings: Partial<SystemSettings>) => void;
  addUnit: (name: string) => void;
  removeUnit: (name: string) => void;
  addPosition: (name: string) => void;
  toggleUserPriority: (taskId: string) => void;
  reorderUserPriorities: (newTaskIds: string[]) => void;
  addPersonalLabel: (label: PersonalLabel) => void;
  removePersonalLabel: (id: string) => void;
  assignLabelToTask: (taskId: string, labelId: string) => void;
  unassignLabelFromTask: (taskId: string, labelId: string) => void;
  sendMessage: (msg: Omit<Message, 'id' | 'timestamp' | 'senderId' | 'senderName'>) => void;
  sendLetter: (letter: Letter) => void;
  createDraft: (subject: string) => void;
  updateDraft: (draft: Letter) => void;
  deleteDraft: (id: string) => void;
  addLetterhead: (lh: Omit<Letterhead, 'id'>) => void;
  removeLetterhead: (id: string) => void;
  addContactGroup: (name: string, memberIds: string[]) => void;
  removeContactGroup: (id: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userPriorityList, setUserPriorityList] = useState<string[]>([]);
  const [personalLabels, setPersonalLabels] = useState<PersonalLabel[]>([]);
  const [taskLabelMap, setTaskLabelMap] = useState<Record<string, string[]>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [drafts, setDrafts] = useState<Letter[]>([]);
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({ 
    appName: 'پن‌تسک', 
    appLogo: '', 
    holidays: [], 
    specialOccasions: [], 
    sampleProfileImages: [],
    letterheads: []
  });

  const [units, setUnits] = useState<string[]>(['فنی', 'بازرگانی', 'مالی', 'منابع انسانی']);
  const [positions, setPositions] = useState<string[]>(['کارشناس', 'مدیر واحد', 'معاونت', 'مدیر عامل']);

  const [currentTheme, setCurrentTheme] = useState<AppTheme>(() => {
    return (localStorage.getItem('pt_theme') as AppTheme) || 'dark';
  });

  // Load user-specific data from DB
  const loadUserData = useCallback(async (user: User) => {
    try {
      const [priorities, labels, labelMap, msgs, ltrs, drfts, groups, notifs] = await Promise.all([
        apiService.getUserPriorities(user.id).catch(() => []),
        apiService.getUserLabels(user.id).catch(() => []),
        apiService.getTaskLabelMap(user.id).catch(() => ({})),
        apiService.getMessages(user.id).catch(() => []),
        apiService.getLetters(user.id).catch(() => []),
        apiService.getDrafts(user.id).catch(() => []),
        apiService.getContactGroups(user.id).catch(() => []),
        apiService.getNotifications(user.id).catch(() => []),
      ]);
      setUserPriorityList(priorities);
      setPersonalLabels(labels);
      setTaskLabelMap(labelMap);
      setMessages(msgs);
      setLetters(ltrs);
      setDrafts(drfts);
      setContactGroups(groups);
      setNotifications(notifs);
    } catch (e) {
      console.error('Failed to load user data:', e);
    }
  }, []);

  // Initial app load
  useEffect(() => {
    const init = async () => {
      try {
        const [u, t, settings, unitList, posList] = await Promise.all([
          apiService.getUsers().catch(() => []),
          apiService.getTasks().catch(() => []),
          apiService.getSettings().catch(() => null),
          apiService.getUnits().catch(() => []),
          apiService.getPositions().catch(() => []),
        ]);
        setUsers(u);
        setTasks(t);
        if (settings && Object.keys(settings).length > 0) {
          setSystemSettings({
            appName: settings.appName || 'پن‌تسک',
            appLogo: settings.appLogo || '',
            holidays: settings.holidays || [],
            specialOccasions: settings.specialOccasions || [],
            sampleProfileImages: settings.sampleProfileImages || [],
            letterheads: settings.letterheads || [],
          });
        }
        if (unitList.length > 0) setUnits(unitList);
        if (posList.length > 0) setPositions(posList);
        
        const savedUser = sessionStorage.getItem('pt_current_user');
        if (savedUser) {
          const userObj = JSON.parse(savedUser);
          // Re-fetch latest user data
          try {
            const freshUser = await apiService.getUser(userObj.id);
            setCurrentUser(freshUser);
            await loadUserData(freshUser);
          } catch {
            setCurrentUser(userObj);
            await loadUserData(userObj);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };
    init();

    const unsubscribe = socketService.onNotification((n) => {
      setNotifications(prev => [n, ...prev]);
    });
    return () => unsubscribe();
  }, [loadUserData]);

  const login = async (username: string, password: string) => {
    try {
      const { user, token } = await apiService.login(username, password);
      const updatedUser = { ...user, lastVisit: getTehranTime().toISOString() };
      // Save updated last visit
      try { await apiService.saveUser(updatedUser); } catch {}
      setCurrentUser(updatedUser);
      sessionStorage.setItem('pt_current_user', JSON.stringify(updatedUser));
      sessionStorage.setItem('pt_token', token);
      await loadUserData(updatedUser);
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setUserPriorityList([]);
    setPersonalLabels([]);
    setTaskLabelMap({});
    setMessages([]);
    setLetters([]);
    setDrafts([]);
    setContactGroups([]);
    setNotifications([]);
    sessionStorage.removeItem('pt_current_user');
    sessionStorage.removeItem('pt_token');
  };

  const addUser = async (newUser: User) => {
    try {
      const saved = await apiService.saveUser(newUser);
      setUsers(prev => [...prev.filter(u => u.id !== saved.id), saved]);
      return true;
    } catch {
      return false;
    }
  };

  const updateUser = async (user: User) => {
    const saved = await apiService.saveUser(user);
    setUsers(prev => prev.map(u => u.id === saved.id ? saved : u));
    if (currentUser?.id === saved.id) {
      setCurrentUser(saved);
      sessionStorage.setItem('pt_current_user', JSON.stringify(saved));
    }
  };

  const deleteUser = async (id: string) => {
    await apiService.deleteUser(id);
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  const upsertTask = async (task: Task) => {
    const saved = await apiService.saveTask(task);
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === saved.id);
      if (idx > -1) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
    socketService.emit('task_updated', saved);
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    apiService.markNotificationRead(id).catch(console.error);
  };

  const setTheme = (theme: AppTheme) => {
    setCurrentTheme(theme);
    localStorage.setItem('pt_theme', theme);
  };

  const updateSettings = async (s: Partial<SystemSettings>) => {
    const newSettings = { ...systemSettings, ...s };
    setSystemSettings(newSettings);
    try {
      await apiService.saveSettings(newSettings);
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  };
  
  const addUnit = (name: string) => {
    if (!name || name.trim() === "") return;
    const trimmed = name.trim();
    setUnits(prev => prev.includes(trimmed) ? prev : [trimmed, ...prev]);
    apiService.addUnit(trimmed).catch(console.error);
  };
  
  const removeUnit = (name: string) => {
    setUnits(prev => prev.filter(u => u !== name));
    apiService.deleteUnit(name).catch(console.error);
  };

  const addPosition = (name: string) => {
    setPositions(prev => prev.includes(name) ? prev : [name, ...prev]);
    apiService.addPosition(name).catch(console.error);
  };

  const toggleUserPriority = (taskId: string) => {
    if (!currentUser) return;
    setUserPriorityList(prev => {
      const next = prev.includes(taskId) ? prev.filter(id => id !== taskId) : [taskId, ...prev];
      apiService.saveUserPriorities(currentUser.id, next).catch(console.error);
      return next;
    });
  };

  const reorderUserPriorities = (newTaskIds: string[]) => {
    if (!currentUser) return;
    setUserPriorityList(newTaskIds);
    apiService.saveUserPriorities(currentUser.id, newTaskIds).catch(console.error);
  };

  const addPersonalLabel = (label: PersonalLabel) => {
    if (!currentUser) return;
    setPersonalLabels(prev => [...prev, label]);
    apiService.saveLabel({ ...label, userId: currentUser.id }).catch(console.error);
  };

  const removePersonalLabel = (id: string) => {
    setPersonalLabels(prev => prev.filter(l => l.id !== id));
    apiService.deleteLabel(id).catch(console.error);
  };

  const assignLabelToTask = (taskId: string, labelId: string) => {
    if (!currentUser) return;
    setTaskLabelMap(prev => {
      const current = prev[taskId] || [];
      if (current.includes(labelId)) return prev;
      return { ...prev, [taskId]: [...current, labelId] };
    });
    apiService.assignLabel(currentUser.id, taskId, labelId).catch(console.error);
  };

  const unassignLabelFromTask = (taskId: string, labelId: string) => {
    if (!currentUser) return;
    setTaskLabelMap(prev => ({
      ...prev,
      [taskId]: (prev[taskId] || []).filter(id => id !== labelId)
    }));
    apiService.unassignLabel(currentUser.id, taskId, labelId).catch(console.error);
  };

  const sendMessage = (msg: Omit<Message, 'id' | 'timestamp' | 'senderId' | 'senderName'>) => {
    if (!currentUser) return;
    const newMsg: Message = {
      ...msg,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: getTehranTime().toISOString(),
      senderId: currentUser.id,
      senderName: currentUser.fullName
    };
    setMessages(prev => [newMsg, ...prev]);
    apiService.sendMessage(newMsg).catch(console.error);
  };

  const sendLetter = (letter: Letter) => {
    const sentLetter: Letter = {
      ...letter,
      status: 'SENT',
      sentAt: getTehranTime().toISOString(),
    };
    setLetters(prev => [sentLetter, ...prev]);
    setDrafts(prev => prev.filter(d => d.id !== letter.id));
    apiService.saveLetter(sentLetter).catch(console.error);
    apiService.deleteDraft(letter.id).catch(console.error);
  };

  const createDraft = (subject: string) => {
    if (!currentUser) return;
    const now = getTehranTime().toISOString();
    const newDraft: Letter = {
      id: Math.random().toString(36).substr(2, 9),
      senderId: currentUser.id,
      senderName: currentUser.fullName,
      subject,
      content: '',
      timestamp: now,
      createdAt: now,
      lastModified: now,
      status: 'DRAFT',
      pageSize: 'A4',
      orientation: 'PORTRAIT',
      margins: { top: 30, bottom: 30, left: 20, right: 20 },
      headerCoords: { x: 10, y: 15 },
      sigSize: { w: 60, h: 50 },
      attachments: []
    };
    setDrafts(prev => [newDraft, ...prev]);
    apiService.saveDraft(newDraft).catch(console.error);
  };

  const updateDraft = (draft: Letter) => {
    const updatedDraft = { ...draft, lastModified: getTehranTime().toISOString() };
    setDrafts(prev => prev.map(d => d.id === draft.id ? updatedDraft : d));
    apiService.saveDraft(updatedDraft).catch(console.error);
  };

  const deleteDraft = (id: string) => {
    setDrafts(prev => prev.filter(d => d.id !== id));
    apiService.deleteDraft(id).catch(console.error);
  };

  const addLetterhead = (lh: Omit<Letterhead, 'id'>) => {
    const newLh: Letterhead = { ...lh, id: Math.random().toString(36).substr(2, 9) };
    updateSettings({ letterheads: [...systemSettings.letterheads, newLh] });
  };

  const removeLetterhead = (id: string) => {
    updateSettings({ letterheads: systemSettings.letterheads.filter(l => l.id !== id) });
  };

  const addContactGroup = (name: string, memberIds: string[]) => {
    if (!currentUser) return;
    const newGroup: ContactGroup = {
      id: Math.random().toString(36).substr(2, 9),
      ownerId: currentUser.id,
      name,
      memberIds
    };
    setContactGroups(prev => [...prev, newGroup]);
    apiService.saveContactGroup(newGroup).catch(console.error);
  };

  const removeContactGroup = (id: string) => {
    setContactGroups(prev => prev.filter(g => g.id !== id));
    apiService.deleteContactGroup(id).catch(console.error);
  };

  return (
    <StoreContext.Provider value={{
      users, tasks, notifications, currentUser, currentTheme, systemSettings, units, positions, isLoading,
      userPriorityList, personalLabels, taskLabelMap, messages, letters, drafts, contactGroups,
      login, logout, addUser, updateUser, deleteUser, upsertTask, markNotificationRead, setTheme,
      updateSettings, addUnit, removeUnit, addPosition, toggleUserPriority, reorderUserPriorities,
      addPersonalLabel, removePersonalLabel, assignLabelToTask, unassignLabelFromTask,
      sendMessage, sendLetter, createDraft, updateDraft, deleteDraft, addLetterhead, removeLetterhead, addContactGroup, removeContactGroup
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within StoreProvider');
  return context;
};
