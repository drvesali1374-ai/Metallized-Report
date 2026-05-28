import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'pantask.db');

// Promise wrapper to get db instance
let dbInstance = null;
const dbPromise = new Promise((resolve) => {
  dbInstance = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('❌ Error connecting to database:', err.message);
    } else {
      console.log('✅ Database connected at:', DB_PATH);
      
      dbInstance.serialize(() => {
        dbInstance.run('PRAGMA journal_mode = WAL');
        dbInstance.run('PRAGMA foreign_keys = ON');
      });
      
      initDatabaseSchema();
    }
    resolve(dbInstance);
  });
});

// Get database instance
const getDb = () => dbInstance;

// Helper functions
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    dbInstance.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    dbInstance.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    dbInstance.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

// Create a prepare-like wrapper
const prepare = (sql) => ({
  run: (...params) => run(sql, params),
  get: (...params) => get(sql, params),
  all: (...params) => all(sql, params)
});

// Initialize database schema
const initDatabaseSchema = () => {

  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      fullName TEXT NOT NULL,
      personnelCode TEXT NOT NULL,
      gender TEXT DEFAULT 'MALE',
      email TEXT,
      phone TEXT,
      position TEXT NOT NULL DEFAULT '',
      honorablePosition TEXT,
      unit TEXT NOT NULL DEFAULT '',
      directManagerId TEXT,
      profileImage TEXT,
      profileZoom REAL DEFAULT 1,
      profilePosX REAL DEFAULT 0,
      profilePosY REAL DEFAULT 0,
      role TEXT DEFAULT 'USER',
      isFirstLogin INTEGER DEFAULT 1,
      lastVisit TEXT,
      signatures TEXT DEFAULT '[]',
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      priority INTEGER DEFAULT 0,
      requesterId TEXT NOT NULL,
      requesterName TEXT NOT NULL,
      performerId TEXT NOT NULL,
      performerName TEXT NOT NULL,
      performerPersonnelCode TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      performerNote TEXT,
      createdAt TEXT NOT NULL,
      deadlineDate TEXT NOT NULL,
      expectedProgress INTEGER DEFAULT 0,
      actualProgress INTEGER DEFAULT 0,
      isPerformerCompleted INTEGER DEFAULT 0,
      performerCompletedAt TEXT,
      isRequesterFinished INTEGER DEFAULT 0,
      requesterFinishedAt TEXT,
      comments TEXT DEFAULT '[]',
      type TEXT DEFAULT 'SINGLE',
      isParallel INTEGER DEFAULT 0,
      stations TEXT DEFAULT '[]',
      currentStationIndex INTEGER DEFAULT 0,
      labels TEXT DEFAULT '[]',
      updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      taskId TEXT,
      message TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      isRead INTEGER DEFAULT 0,
      userId TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      senderId TEXT NOT NULL,
      senderName TEXT NOT NULL,
      recipientIds TEXT DEFAULT '[]',
      ccIds TEXT DEFAULT '[]',
      bccIds TEXT DEFAULT '[]',
      subject TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS letters (
      id TEXT PRIMARY KEY,
      senderId TEXT NOT NULL,
      senderName TEXT NOT NULL,
      recipientId TEXT,
      ccIds TEXT DEFAULT '[]',
      bccIds TEXT DEFAULT '[]',
      customRecipient TEXT,
      letterheadId TEXT,
      subject TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      lastModified TEXT,
      sentAt TEXT,
      status TEXT DEFAULT 'DRAFT',
      pageSize TEXT DEFAULT 'A4',
      orientation TEXT DEFAULT 'PORTRAIT',
      margins TEXT DEFAULT '{"top":30,"bottom":30,"left":20,"right":20}',
      headerCoords TEXT DEFAULT '{"x":10,"y":15}',
      headerColor TEXT DEFAULT '#000000',
      attachments TEXT DEFAULT '[]',
      sigSize TEXT DEFAULT '{"w":60,"h":50}',
      signatureId TEXT,
      signatureImage TEXT,
      lineHeight REAL DEFAULT 2.0,
      recipientColor TEXT DEFAULT '#000000',
      recipientFontSize REAL DEFAULT 13,
      senderColor TEXT DEFAULT '#000000',
      senderFontSize REAL DEFAULT 12,
      firstPageHeaderH REAL DEFAULT 30
    );

    CREATE TABLE IF NOT EXISTS drafts (
      id TEXT PRIMARY KEY,
      senderId TEXT NOT NULL,
      senderName TEXT NOT NULL,
      recipientId TEXT,
      ccIds TEXT DEFAULT '[]',
      bccIds TEXT DEFAULT '[]',
      customRecipient TEXT,
      letterheadId TEXT,
      subject TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      lastModified TEXT,
      status TEXT DEFAULT 'DRAFT',
      pageSize TEXT DEFAULT 'A4',
      orientation TEXT DEFAULT 'PORTRAIT',
      margins TEXT DEFAULT '{"top":30,"bottom":30,"left":20,"right":20}',
      headerCoords TEXT DEFAULT '{"x":10,"y":15}',
      headerColor TEXT DEFAULT '#000000',
      attachments TEXT DEFAULT '[]',
      sigSize TEXT DEFAULT '{"w":60,"h":50}',
      signatureId TEXT,
      signatureImage TEXT,
      sentAt TEXT,
      lineHeight REAL DEFAULT 2.0,
      recipientColor TEXT DEFAULT '#000000',
      recipientFontSize REAL DEFAULT 13,
      senderColor TEXT DEFAULT '#000000',
      senderFontSize REAL DEFAULT 12,
      firstPageHeaderH REAL DEFAULT 30
    );

    CREATE TABLE IF NOT EXISTS contact_groups (
      id TEXT PRIMARY KEY,
      ownerId TEXT NOT NULL,
      name TEXT NOT NULL,
      memberIds TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS user_priorities (
      userId TEXT PRIMARY KEY,
      taskIds TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS user_labels (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_label_map (
      userId TEXT NOT NULL,
      taskId TEXT NOT NULL,
      labelId TEXT NOT NULL,
      PRIMARY KEY (userId, taskId, labelId)
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS units (
      name TEXT PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS positions (
      name TEXT PRIMARY KEY
    );
  `;
  
  dbInstance.exec(schema, async (err) => {
    if (err) {
      console.error('❌ SQL Error:', err.message);
      return;
    }
    console.log('✅ Tables created/verified');
    
    // Seed data
    try {
      const admin = await get('SELECT id FROM users WHERE username = ?', ['admin']);
      if (!admin) {
        await run(
          `INSERT INTO users (id, username, password, fullName, personnelCode, gender, position, unit, role, isFirstLogin)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ['admin-001', 'admin', 'admin', 'مدیر سیستم', '10001', 'MALE', 'مدیر عامل', 'مدیریت', 'ADMIN', 0]
        );
        
        const users = [
          ['user-002', 'user1', '1234', 'علی احمدی', '10002', 'MALE', 'کارشناس', 'فنی', 'USER', 1],
          ['user-003', 'user2', '1234', 'فاطمه محمدی', '10003', 'FEMALE', 'مدیر واحد', 'بازرگانی', 'USER', 1],
          ['user-004', 'user3', '1234', 'محمد رضایی', '10004', 'MALE', 'کارشناس', 'مالی', 'USER', 1],
        ];
        
        for (const u of users) {
          await run(
            `INSERT INTO users (id, username, password, fullName, personnelCode, gender, position, unit, role, isFirstLogin)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            u
          );
        }
      }

      const unitCount = await get('SELECT COUNT(*) as cnt FROM units');
      if (unitCount.cnt === 0) {
        const units = ['فنی', 'بازرگانی', 'مالی', 'منابع انسانی', 'مدیریت', 'فناوری اطلاعات'];
        for (const u of units) {
          await run('INSERT OR IGNORE INTO units (name) VALUES (?)', [u]);
        }
      }

      const posCount = await get('SELECT COUNT(*) as cnt FROM positions');
      if (posCount.cnt === 0) {
        const positions = ['کارشناس', 'کارشناس ارشد', 'مدیر واحد', 'معاونت', 'مدیر عامل', 'رئیس هیئت مدیره'];
        for (const p of positions) {
          await run('INSERT OR IGNORE INTO positions (name) VALUES (?)', [p]);
        }
      }

      const settingCount = await get('SELECT COUNT(*) as cnt FROM system_settings');
      if (settingCount.cnt === 0) {
        const settings = [
          ['appName', 'پن‌تسک'],
          ['appLogo', ''],
          ['holidays', '[]'],
          ['specialOccasions', '[]'],
          ['sampleProfileImages', '[]'],
          ['letterheads', '[]']
        ];
        for (const s of settings) {
          await run('INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)', s);
        }
      }
      
      console.log('✅ Database seeded successfully');
    } catch (e) {
      console.error('❌ Seeding error:', e.message);
    }
  });
};

// Export functions
const db = { 
  prepare,
  run, 
  get, 
  all,
  getDb
};

export default db;
