
const BASE_URL = '/api';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const apiService = {
  // Auth
  login: (username: string, password: string) =>
    fetchJSON<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  // Users
  getUsers: () => fetchJSON<any[]>('/users'),
  getUser: (id: string) => fetchJSON<any>(`/users/${id}`),
  saveUser: (user: any) =>
    fetchJSON<any>('/users', { method: 'POST', body: JSON.stringify(user) }),
  deleteUser: (id: string) =>
    fetchJSON<any>(`/users/${id}`, { method: 'DELETE' }),

  // Tasks
  getTasks: () => fetchJSON<any[]>('/tasks'),
  saveTask: (task: any) =>
    fetchJSON<any>('/tasks', { method: 'POST', body: JSON.stringify(task) }),
  deleteTask: (id: string) =>
    fetchJSON<any>(`/tasks/${id}`, { method: 'DELETE' }),

  // Messages
  getMessages: (userId: string) =>
    fetchJSON<any[]>(`/messages?userId=${userId}`),
  sendMessage: (msg: any) =>
    fetchJSON<any>('/messages', { method: 'POST', body: JSON.stringify(msg) }),

  // Letters
  getLetters: (userId: string) =>
    fetchJSON<any[]>(`/letters?userId=${userId}`),
  saveLetter: (letter: any) =>
    fetchJSON<any>('/letters', { method: 'POST', body: JSON.stringify(letter) }),
  deleteLetter: (id: string) =>
    fetchJSON<any>(`/letters/${id}`, { method: 'DELETE' }),

  // Drafts
  getDrafts: (userId: string) =>
    fetchJSON<any[]>(`/drafts?userId=${userId}`),
  saveDraft: (draft: any) =>
    fetchJSON<any>('/drafts', { method: 'POST', body: JSON.stringify(draft) }),
  deleteDraft: (id: string) =>
    fetchJSON<any>(`/drafts/${id}`, { method: 'DELETE' }),

  // Contact groups
  getContactGroups: (userId: string) =>
    fetchJSON<any[]>(`/contact-groups?userId=${userId}`),
  saveContactGroup: (group: any) =>
    fetchJSON<any>('/contact-groups', { method: 'POST', body: JSON.stringify(group) }),
  deleteContactGroup: (id: string) =>
    fetchJSON<any>(`/contact-groups/${id}`, { method: 'DELETE' }),

  // User priorities
  getUserPriorities: (userId: string) =>
    fetchJSON<string[]>(`/user-priorities/${userId}`),
  saveUserPriorities: (userId: string, taskIds: string[]) =>
    fetchJSON<any>(`/user-priorities/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ taskIds }),
    }),

  // Personal labels
  getUserLabels: (userId: string) =>
    fetchJSON<any[]>(`/user-labels/${userId}`),
  saveLabel: (label: any) =>
    fetchJSON<any>('/user-labels', { method: 'POST', body: JSON.stringify(label) }),
  deleteLabel: (id: string) =>
    fetchJSON<any>(`/user-labels/${id}`, { method: 'DELETE' }),

  // Task label map
  getTaskLabelMap: (userId: string) =>
    fetchJSON<Record<string, string[]>>(`/task-label-map/${userId}`),
  assignLabel: (userId: string, taskId: string, labelId: string) =>
    fetchJSON<any>('/task-label-map', {
      method: 'POST',
      body: JSON.stringify({ userId, taskId, labelId }),
    }),
  unassignLabel: (userId: string, taskId: string, labelId: string) =>
    fetchJSON<any>('/task-label-map', {
      method: 'DELETE',
      body: JSON.stringify({ userId, taskId, labelId }),
    }),

  // Notifications
  getNotifications: (userId: string) =>
    fetchJSON<any[]>(`/notifications?userId=${userId}`),
  saveNotification: (n: any) =>
    fetchJSON<any>('/notifications', { method: 'POST', body: JSON.stringify(n) }),
  markNotificationRead: (id: string) =>
    fetchJSON<any>(`/notifications/${id}/read`, { method: 'PATCH' }),

  // Settings
  getSettings: () => fetchJSON<any>('/settings'),
  saveSettings: (settings: any) =>
    fetchJSON<any>('/settings', { method: 'POST', body: JSON.stringify(settings) }),

  // Units
  getUnits: () => fetchJSON<string[]>('/units'),
  addUnit: (name: string) =>
    fetchJSON<any>('/units', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteUnit: (name: string) =>
    fetchJSON<any>(`/units/${encodeURIComponent(name)}`, { method: 'DELETE' }),

  // Positions
  getPositions: () => fetchJSON<string[]>('/positions'),
  addPosition: (name: string) =>
    fetchJSON<any>('/positions', { method: 'POST', body: JSON.stringify({ name }) }),
};
