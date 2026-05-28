import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import db from './database.js';

const app = express();
const PORT = 3001;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

// Wrapper for async route handlers
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ============================================================
// AUTH
// ============================================================
app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const user = await db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  
  const userObj = parseUser(user);
  const token = `token-${user.id}-${Date.now()}`;
  res.json({ user: userObj, token });
}));

// ============================================================
// USERS
// ============================================================
app.get('/api/users', asyncHandler(async (req, res) => {
  const users = await db.all('SELECT * FROM users');
  res.json(users.map(parseUser));
}));

app.get('/api/users/:id', asyncHandler(async (req, res) => {
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(parseUser(user));
}));

app.post('/api/users', asyncHandler(async (req, res) => {
  const u = req.body;
  const id = u.id || randomUUID();
  
  const existing = await db.get('SELECT id FROM users WHERE id = ?', [id]);
  if (existing) {
    await db.run(`UPDATE users SET username=?, password=?, fullName=?, personnelCode=?, gender=?, email=?, phone=?, position=?, honorablePosition=?, unit=?, directManagerId=?, profileImage=?, profileZoom=?, profilePosX=?, profilePosY=?, role=?, isFirstLogin=?, lastVisit=?, signatures=? WHERE id=?`, [
      u.username, u.password || '', u.fullName, u.personnelCode, u.gender || 'MALE', u.email || null, u.phone || null, u.position, u.honorablePosition || null, u.unit, u.directManagerId || null, u.profileImage || null, u.profileZoom || 1, u.profilePosX || 0, u.profilePosY || 0, u.role || 'USER', u.isFirstLogin ? 1 : 0, u.lastVisit || null, JSON.stringify(u.signatures || []), id
    ]);
  } else {
    await db.run(`INSERT INTO users (id, username, password, fullName, personnelCode, gender, email, phone, position, honorablePosition, unit, directManagerId, profileImage, profileZoom, profilePosX, profilePosY, role, isFirstLogin, lastVisit, signatures) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      id, u.username, u.password || '', u.fullName, u.personnelCode, u.gender || 'MALE', u.email || null, u.phone || null, u.position, u.honorablePosition || null, u.unit, u.directManagerId || null, u.profileImage || null, u.profileZoom || 1, u.profilePosX || 0, u.profilePosY || 0, u.role || 'USER', u.isFirstLogin ? 1 : 0, u.lastVisit || null, JSON.stringify(u.signatures || [])
    ]);
  }
  
  const saved = await db.get('SELECT * FROM users WHERE id = ?', [id]);
  res.json(parseUser(saved));
}));

app.delete('/api/users/:id', asyncHandler(async (req, res) => {
  await db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ success: true });
}));

// ============================================================
// TASKS
// ============================================================
app.get('/api/tasks', asyncHandler(async (req, res) => {
  const tasks = await db.all('SELECT * FROM tasks ORDER BY createdAt DESC');
  res.json(tasks.map(parseTask));
}));

app.post('/api/tasks', asyncHandler(async (req, res) => {
  const t = req.body;
  const id = t.id || randomUUID();
  const now = new Date().toISOString();
  
  const existing = await db.get('SELECT id FROM tasks WHERE id = ?', [id]);
  if (existing) {
    await db.run(`
      UPDATE tasks SET priority=?, requesterId=?, requesterName=?, performerId=?, performerName=?,
      performerPersonnelCode=?, title=?, description=?, performerNote=?, deadlineDate=?,
      expectedProgress=?, actualProgress=?, isPerformerCompleted=?, performerCompletedAt=?,
      isRequesterFinished=?, requesterFinishedAt=?, comments=?, type=?, isParallel=?,
      stations=?, currentStationIndex=?, labels=?, updatedAt=?
      WHERE id=?
    `, [
      t.priority || 0, t.requesterId, t.requesterName, t.performerId, t.performerName,
      t.performerPersonnelCode, t.title, t.description, t.performerNote || null,
      t.deadlineDate, t.expectedProgress || 0, t.actualProgress || 0,
      t.isPerformerCompleted ? 1 : 0, t.performerCompletedAt || null,
      t.isRequesterFinished ? 1 : 0, t.requesterFinishedAt || null,
      JSON.stringify(t.comments || []), t.type || 'SINGLE', t.isParallel ? 1 : 0,
      JSON.stringify(t.stations || []), t.currentStationIndex || 0,
      JSON.stringify(t.labels || []), now, id
    ]);
  } else {
    await db.run(`
      INSERT INTO tasks (id, priority, requesterId, requesterName, performerId, performerName,
      performerPersonnelCode, title, description, performerNote, createdAt, deadlineDate,
      expectedProgress, actualProgress, isPerformerCompleted, performerCompletedAt,
      isRequesterFinished, requesterFinishedAt, comments, type, isParallel, stations,
      currentStationIndex, labels, updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      id, t.priority || 0, t.requesterId, t.requesterName, t.performerId, t.performerName,
      t.performerPersonnelCode, t.title, t.description, t.performerNote || null,
      t.createdAt || now, t.deadlineDate, t.expectedProgress || 0, t.actualProgress || 0,
      t.isPerformerCompleted ? 1 : 0, t.performerCompletedAt || null,
      t.isRequesterFinished ? 1 : 0, t.requesterFinishedAt || null,
      JSON.stringify(t.comments || []), t.type || 'SINGLE', t.isParallel ? 1 : 0,
      JSON.stringify(t.stations || []), t.currentStationIndex || 0,
      JSON.stringify(t.labels || []), now
    ]);
  }
  
  const saved = await db.get('SELECT * FROM tasks WHERE id = ?', [id]);
  res.json(parseTask(saved));
}));

app.delete('/api/tasks/:id', asyncHandler(async (req, res) => {
  await db.run('DELETE FROM tasks WHERE id = ?', [req.params.id]);
  res.json({ success: true });
}));

// ============================================================
// MESSAGES
// ============================================================
app.get('/api/messages', asyncHandler(async (req, res) => {
  const { userId } = req.query;
  let msgs;
  if (userId) {
    msgs = await db.all(`SELECT * FROM messages WHERE senderId=? OR recipientIds LIKE ? OR ccIds LIKE ? ORDER BY timestamp DESC`, [userId, `%"${userId}"%`, `%"${userId}"%`]);
  } else {
    msgs = await db.all('SELECT * FROM messages ORDER BY timestamp DESC');
  }
  res.json(msgs.map(parseMessage));
}));

app.post('/api/messages', asyncHandler(async (req, res) => {
  const m = req.body;
  const id = m.id || randomUUID();
  await db.run(`
    INSERT OR REPLACE INTO messages (id, senderId, senderName, recipientIds, ccIds, bccIds, subject, content, timestamp)
    VALUES (?,?,?,?,?,?,?,?,?)
  `, [
    id, m.senderId, m.senderName,
    JSON.stringify(m.recipientIds || []), JSON.stringify(m.ccIds || []), JSON.stringify(m.bccIds || []),
    m.subject, m.content, m.timestamp || new Date().toISOString()
  ]);
  const saved = await db.get('SELECT * FROM messages WHERE id = ?', [id]);
  res.json(parseMessage(saved));
}));

// ============================================================
// LETTERS (SENT)
// ============================================================
app.get('/api/letters', asyncHandler(async (req, res) => {
  const { userId } = req.query;
  let rows;
  if (userId) {
    rows = await db.all(`SELECT * FROM letters WHERE senderId=? OR recipientId=? ORDER BY sentAt DESC, timestamp DESC`, [userId, userId]);
  } else {
    rows = await db.all('SELECT * FROM letters ORDER BY sentAt DESC');
  }
  res.json(rows.map(parseLetter));
}));

app.post('/api/letters', asyncHandler(async (req, res) => {
  const l = req.body;
  const id = l.id || randomUUID();
  await upsertLetter(id, l, 'letters');
  const saved = await db.get('SELECT * FROM letters WHERE id = ?', [id]);
  res.json(parseLetter(saved));
}));

app.delete('/api/letters/:id', asyncHandler(async (req, res) => {
  await db.run('DELETE FROM letters WHERE id = ?', [req.params.id]);
  res.json({ success: true });
}));

// ============================================================
// DRAFTS
// ============================================================
app.get('/api/drafts', asyncHandler(async (req, res) => {
  const { userId } = req.query;
  let rows;
  if (userId) {
    rows = await db.all('SELECT * FROM drafts WHERE senderId=? ORDER BY lastModified DESC, createdAt DESC', [userId]);
  } else {
    rows = await db.all('SELECT * FROM drafts ORDER BY lastModified DESC');
  }
  res.json(rows.map(parseLetter));
}));

app.post('/api/drafts', asyncHandler(async (req, res) => {
  const d = req.body;
  const id = d.id || randomUUID();
  await upsertLetter(id, d, 'drafts');
  const saved = await db.get('SELECT * FROM drafts WHERE id = ?', [id]);
  res.json(parseLetter(saved));
}));

app.delete('/api/drafts/:id', asyncHandler(async (req, res) => {
  await db.run('DELETE FROM drafts WHERE id = ?', [req.params.id]);
  res.json({ success: true });
}));

// ============================================================
// CONTACT GROUPS
// ============================================================
app.get('/api/contact-groups', asyncHandler(async (req, res) => {
  const { userId } = req.query;
  let rows;
  if (userId) {
    rows = await db.all('SELECT * FROM contact_groups WHERE ownerId=?', [userId]);
  } else {
    rows = await db.all('SELECT * FROM contact_groups');
  }
  res.json(rows.map(g => ({ ...g, memberIds: JSON.parse(g.memberIds || '[]') })));
}));

app.post('/api/contact-groups', asyncHandler(async (req, res) => {
  const g = req.body;
  const id = g.id || randomUUID();
  await db.run('INSERT OR REPLACE INTO contact_groups (id, ownerId, name, memberIds) VALUES (?,?,?,?)', [
    id, g.ownerId, g.name, JSON.stringify(g.memberIds || [])
  ]);
  res.json({ id, ownerId: g.ownerId, name: g.name, memberIds: g.memberIds || [] });
}));

app.delete('/api/contact-groups/:id', asyncHandler(async (req, res) => {
  await db.run('DELETE FROM contact_groups WHERE id = ?', [req.params.id]);
  res.json({ success: true });
}));

// ============================================================
// USER PRIORITIES
// ============================================================
app.get('/api/user-priorities/:userId', asyncHandler(async (req, res) => {
  const row = await db.get('SELECT taskIds FROM user_priorities WHERE userId=?', [req.params.userId]);
  res.json(row ? JSON.parse(row.taskIds) : []);
}));

app.post('/api/user-priorities/:userId', asyncHandler(async (req, res) => {
  const { taskIds } = req.body;
  await db.run('INSERT OR REPLACE INTO user_priorities (userId, taskIds) VALUES (?,?)', [
    req.params.userId, JSON.stringify(taskIds || [])
  ]);
  res.json({ success: true });
}));

// ============================================================
// PERSONAL LABELS
// ============================================================
app.get('/api/user-labels/:userId', asyncHandler(async (req, res) => {
  const rows = await db.all('SELECT * FROM user_labels WHERE userId=?', [req.params.userId]);
  res.json(rows);
}));

app.post('/api/user-labels', asyncHandler(async (req, res) => {
  const label = req.body;
  const id = label.id || randomUUID();
  await db.run('INSERT OR REPLACE INTO user_labels (id, userId, name, color) VALUES (?,?,?,?)', [
    id, label.userId, label.name, label.color
  ]);
  res.json({ id, ...label });
}));

app.delete('/api/user-labels/:id', asyncHandler(async (req, res) => {
  await db.run('DELETE FROM user_labels WHERE id=?', [req.params.id]);
  res.json({ success: true });
}));

// ============================================================
// TASK LABEL MAP
// ============================================================
app.get('/api/task-label-map/:userId', asyncHandler(async (req, res) => {
  const rows = await db.all('SELECT taskId, labelId FROM task_label_map WHERE userId=?', [req.params.userId]);
  const map = {};
  for (const row of rows) {
    if (!map[row.taskId]) map[row.taskId] = [];
    map[row.taskId].push(row.labelId);
  }
  res.json(map);
}));

app.post('/api/task-label-map', asyncHandler(async (req, res) => {
  const { userId, taskId, labelId } = req.body;
  await db.run('INSERT OR IGNORE INTO task_label_map (userId, taskId, labelId) VALUES (?,?,?)', [userId, taskId, labelId]);
  res.json({ success: true });
}));

app.delete('/api/task-label-map', asyncHandler(async (req, res) => {
  const { userId, taskId, labelId } = req.body;
  await db.run('DELETE FROM task_label_map WHERE userId=? AND taskId=? AND labelId=?', [userId, taskId, labelId]);
  res.json({ success: true });
}));

// ============================================================
// NOTIFICATIONS
// ============================================================
app.get('/api/notifications', asyncHandler(async (req, res) => {
  const { userId } = req.query;
  let rows;
  if (userId) {
    rows = await db.all('SELECT * FROM notifications WHERE userId=? ORDER BY timestamp DESC', [userId]);
  } else {
    rows = await db.all('SELECT * FROM notifications ORDER BY timestamp DESC');
  }
  res.json(rows.map(n => ({ ...n, isRead: !!n.isRead })));
}));

app.post('/api/notifications', asyncHandler(async (req, res) => {
  const n = req.body;
  const id = n.id || randomUUID();
  await db.run('INSERT OR REPLACE INTO notifications (id, taskId, message, timestamp, isRead, userId) VALUES (?,?,?,?,?,?)', [
    id, n.taskId || null, n.message, n.timestamp || new Date().toISOString(), n.isRead ? 1 : 0, n.userId
  ]);
  res.json({ ...n, id });
}));

app.patch('/api/notifications/:id/read', asyncHandler(async (req, res) => {
  await db.run('UPDATE notifications SET isRead=1 WHERE id=?', [req.params.id]);
  res.json({ success: true });
}));

// ============================================================
// SYSTEM SETTINGS
// ============================================================
app.get('/api/settings', asyncHandler(async (req, res) => {
  const rows = await db.all('SELECT key, value FROM system_settings');
  const settings = {};
  for (const row of rows) {
    try {
      settings[row.key] = JSON.parse(row.value);
    } catch {
      settings[row.key] = row.value;
    }
  }
  res.json(settings);
}));

app.post('/api/settings', asyncHandler(async (req, res) => {
  const settings = req.body;
  for (const [key, value] of Object.entries(settings)) {
    await db.run('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?,?)', [
      key, typeof value === 'string' ? value : JSON.stringify(value)
    ]);
  }
  res.json({ success: true });
}));

// ============================================================
// UNITS & POSITIONS
// ============================================================
app.get('/api/units', asyncHandler(async (req, res) => {
  const rows = await db.all('SELECT name FROM units');
  res.json(rows.map(r => r.name));
}));

app.post('/api/units', asyncHandler(async (req, res) => {
  const { name } = req.body;
  await db.run('INSERT OR IGNORE INTO units (name) VALUES (?)', [name]);
  res.json({ success: true });
}));

app.delete('/api/units/:name', asyncHandler(async (req, res) => {
  await db.run('DELETE FROM units WHERE name=?', [decodeURIComponent(req.params.name)]);
  res.json({ success: true });
}));

app.get('/api/positions', asyncHandler(async (req, res) => {
  const rows = await db.all('SELECT name FROM positions');
  res.json(rows.map(r => r.name));
}));

app.post('/api/positions', asyncHandler(async (req, res) => {
  const { name } = req.body;
  await db.run('INSERT OR IGNORE INTO positions (name) VALUES (?)', [name]);
  res.json({ success: true });
}));

// ============================================================
// HELPERS
// ============================================================
function parseUser(u) {
  return {
    ...u,
    isFirstLogin: !!u.isFirstLogin,
    profileZoom: u.profileZoom || 1,
    profilePosX: u.profilePosX || 0,
    profilePosY: u.profilePosY || 0,
    signatures: JSON.parse(u.signatures || '[]'),
    password: u.password,
  };
}

function parseTask(t) {
  return {
    ...t,
    isPerformerCompleted: !!t.isPerformerCompleted,
    isRequesterFinished: !!t.isRequesterFinished,
    isParallel: !!t.isParallel,
    comments: JSON.parse(t.comments || '[]'),
    stations: JSON.parse(t.stations || '[]'),
    labels: JSON.parse(t.labels || '[]'),
  };
}

function parseMessage(m) {
  return {
    ...m,
    recipientIds: JSON.parse(m.recipientIds || '[]'),
    ccIds: JSON.parse(m.ccIds || '[]'),
    bccIds: JSON.parse(m.bccIds || '[]'),
  };
}

function parseLetter(l) {
  return {
    ...l,
    ccIds: JSON.parse(l.ccIds || '[]'),
    bccIds: JSON.parse(l.bccIds || '[]'),
    customRecipient: l.customRecipient ? JSON.parse(l.customRecipient) : undefined,
    margins: JSON.parse(l.margins || '{"top":30,"bottom":30,"left":20,"right":20}'),
    headerCoords: JSON.parse(l.headerCoords || '{"x":10,"y":15}'),
    attachments: JSON.parse(l.attachments || '[]'),
    sigSize: JSON.parse(l.sigSize || '{"w":60,"h":50}'),
  };
}

async function upsertLetter(id, l, table) {
  const existing = await db.get(`SELECT id FROM ${table} WHERE id=?`, [id]);
  const cols = [
    'id', 'senderId', 'senderName', 'recipientId', 'ccIds', 'bccIds', 'customRecipient',
    'letterheadId', 'subject', 'content', 'timestamp', 'createdAt', 'lastModified', 'sentAt',
    'status', 'pageSize', 'orientation', 'margins', 'headerCoords', 'headerColor',
    'attachments', 'sigSize', 'signatureId', 'signatureImage',
    'lineHeight', 'recipientColor', 'recipientFontSize', 'senderColor', 'senderFontSize', 'firstPageHeaderH'
  ];
  const vals = [
    id, l.senderId, l.senderName, l.recipientId || null,
    JSON.stringify(l.ccIds || []), JSON.stringify(l.bccIds || []),
    l.customRecipient ? JSON.stringify(l.customRecipient) : null,
    l.letterheadId || null, l.subject, l.content,
    l.timestamp || new Date().toISOString(), l.createdAt || new Date().toISOString(),
    l.lastModified || new Date().toISOString(), l.sentAt || null,
    l.status || 'DRAFT', l.pageSize || 'A4', l.orientation || 'PORTRAIT',
    JSON.stringify(l.margins || { top: 30, bottom: 30, left: 20, right: 20 }),
    JSON.stringify(l.headerCoords || { x: 10, y: 15 }),
    l.headerColor || '#000000',
    JSON.stringify(l.attachments || []),
    JSON.stringify(l.sigSize || { w: 60, h: 50 }),
    l.signatureId || null, l.signatureImage || null,
    l.lineHeight || 2.0, l.recipientColor || '#000000',
    l.recipientFontSize || 13, l.senderColor || '#000000',
    l.senderFontSize || 12, l.firstPageHeaderH || 30
  ];
  
  if (existing) {
    const setClauses = cols.slice(1).map(c => `${c}=?`).join(',');
    await db.run(`UPDATE ${table} SET ${setClauses} WHERE id=?`, [...vals.slice(1), id]);
  } else {
    const placeholders = cols.map(() => '?').join(',');
    await db.run(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`, vals);
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`✅ API Server running on http://localhost:${PORT}`);
});
