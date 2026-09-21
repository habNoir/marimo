import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import {
  useSqliteAuthState,
  jidNormalizedUser
} from '@rexxhayanasi/elaina-baileys'

// ─── ENSURE TARGET DIRECTORY EXISTS ──────────────────────────────────────────
const DB_DIR = './database/session'
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true })
}

const DB_PATH = path.join(DB_DIR, 'session.db')

// ─── INITIALIZE SQLITE DATABASE (WAL MODE FOR HIGH CONCURRENCY) ───────────────
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

// ─── DDL: SCHEMA DEFINITIONS ──────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    jid TEXT PRIMARY KEY,
    name TEXT,
    notify TEXT,
    phone TEXT,
    updatedAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS lid_mappings (
    lid TEXT PRIMARY KEY,
    pn TEXT,
    updatedAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT,
    remoteJid TEXT,
    participant TEXT,
    fromMe INTEGER,
    message TEXT,
    timestamp INTEGER,
    PRIMARY KEY (remoteJid, id)
  );

  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    subject TEXT,
    metadata TEXT,
    updatedAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS users (
    jid TEXT PRIMARY KEY,
    name TEXT,
    age INTEGER,
    registeredAt INTEGER,
    warnedAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS blacklist (
    targetJid TEXT PRIMARY KEY,
    type TEXT,
    reason TEXT,
    blacklistedAt INTEGER,
    expiresAt INTEGER
  );
`)

// ─── PREPARED STATEMENTS ──────────────────────────────────────────────────────
const stmts = {
  upsertContact: db.prepare(`
    INSERT INTO contacts (jid, name, notify, phone, updatedAt)
    VALUES (@jid, @name, @notify, @phone, @updatedAt)
    ON CONFLICT(jid) DO UPDATE SET
      name = coalesce(excluded.name, contacts.name),
      notify = coalesce(excluded.notify, contacts.notify),
      phone = coalesce(excluded.phone, contacts.phone),
      updatedAt = excluded.updatedAt
  `),

  upsertLid: db.prepare(`
    INSERT INTO lid_mappings (lid, pn, updatedAt)
    VALUES (@lid, @pn, @updatedAt)
    ON CONFLICT(lid) DO UPDATE SET
      pn = excluded.pn,
      updatedAt = excluded.updatedAt
  `),

  insertMessage: db.prepare(`
    INSERT OR REPLACE INTO messages (id, remoteJid, participant, fromMe, message, timestamp)
    VALUES (@id, @remoteJid, @participant, @fromMe, @message, @timestamp)
  `),

  getMessage: db.prepare(`
    SELECT message FROM messages WHERE remoteJid = ? AND id = ? LIMIT 1
  `),

  upsertGroup: db.prepare(`
    INSERT INTO groups (id, subject, metadata, updatedAt)
    VALUES (@id, @subject, @metadata, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      subject = excluded.subject,
      metadata = excluded.metadata,
      updatedAt = excluded.updatedAt
  `),

  getContact: db.prepare(`SELECT * FROM contacts WHERE jid = ? LIMIT 1`),
  getGroup: db.prepare(`SELECT * FROM groups WHERE id = ? LIMIT 1`),
  getPnFromLid: db.prepare(`SELECT pn FROM lid_mappings WHERE lid = ? LIMIT 1`),
  getLidFromPn: db.prepare(`SELECT lid FROM lid_mappings WHERE pn = ? LIMIT 1`),

  registerUser: db.prepare(`
    INSERT INTO users (jid, name, age, registeredAt, warnedAt)
    VALUES (@jid, @name, @age, @registeredAt, @warnedAt)
    ON CONFLICT(jid) DO UPDATE SET
      name = excluded.name,
      age = excluded.age,
      registeredAt = excluded.registeredAt
  `),

  getUser: db.prepare(`SELECT * FROM users WHERE jid = ? LIMIT 1`),
  getUsersCount: db.prepare(`SELECT COUNT(*) as count FROM users`),
  setWarnedTime: db.prepare(`
    INSERT INTO users (jid, name, age, registeredAt, warnedAt)
    VALUES (?, NULL, NULL, NULL, ?)
    ON CONFLICT(jid) DO UPDATE SET warnedAt = excluded.warnedAt
  `),

  addBlacklist: db.prepare(`
    INSERT INTO blacklist (targetJid, type, reason, blacklistedAt, expiresAt)
    VALUES (@targetJid, @type, @reason, @blacklistedAt, @expiresAt)
    ON CONFLICT(targetJid) DO UPDATE SET
      type = excluded.type,
      reason = excluded.reason,
      blacklistedAt = excluded.blacklistedAt,
      expiresAt = excluded.expiresAt
  `),

  removeBlacklist: db.prepare(`DELETE FROM blacklist WHERE targetJid = ?`),
  getBlacklist: db.prepare(`SELECT * FROM blacklist WHERE targetJid = ? LIMIT 1`),
  listBlacklists: db.prepare(`SELECT * FROM blacklist ORDER BY blacklistedAt DESC`),
  getBlacklistCount: db.prepare(`SELECT COUNT(*) as count FROM blacklist`),
  getContactsCount: db.prepare(`SELECT COUNT(*) as count FROM contacts`),
  getGroupsCount: db.prepare(`SELECT COUNT(*) as count FROM groups`)
}

// ─── RETRY COUNTER CACHE (BAILEYS BUFFER GUARD) ──────────────────────────────
const msgRetryMap = new Map()
export const msgRetryCounterCache = {
  get: (key) => msgRetryMap.get(key),
  set: (key, value) => {
    msgRetryMap.set(key, value)
    if (msgRetryMap.size > 2000) {
      const firstKey = msgRetryMap.keys().next().value
      msgRetryMap.delete(firstKey)
    }
  },
  del: (key) => msgRetryMap.delete(key),
  flushAll: () => msgRetryMap.clear()
}

// ─── IN-MEMORY MESSAGE DEDUPLICATION ─────────────────────────────────────────
const processedMsgSet = new Set()
const MAX_PROCESSED_KEYS = 5000

export function isMessageProcessed(remoteJid, id) {
  if (!id) return false
  const key = `${remoteJid}:${id}`
  return processedMsgSet.has(key)
}

export function markMessageProcessed(remoteJid, id) {
  if (!id) return
  const key = `${remoteJid}:${id}`
  processedMsgSet.add(key)
  if (processedMsgSet.size > MAX_PROCESSED_KEYS) {
    const firstKey = processedMsgSet.keys().next().value
    processedMsgSet.delete(firstKey)
  }
}

// ─── STORE CONTROLLER ─────────────────────────────────────────────────────────
export const store = {
  db,
  msgRetryCounterCache,
  isMessageProcessed,
  markMessageProcessed,

  // 1. Session Storage via Elaina-Baileys built-in SQLite engine
  getAuthState: async () => {
    return await useSqliteAuthState({ database: db })
  },

  // Auto-prune obsolete signal pre-keys & expired messages
  pruneSessionKeys: async () => {
    try {
      const row = db.prepare("SELECT value FROM creds WHERE key = '__creds__' LIMIT 1").get()
      if (row) {
        const credsData = JSON.parse(row.value)
        const firstUnuploaded = credsData.firstUnuploadedPreKeyId || 0
        if (firstUnuploaded > 50) {
          const minKeepId = firstUnuploaded - 30
          db.prepare(`
            DELETE FROM signal_keys
            WHERE type = 'pre-key' AND CAST(id AS INTEGER) < ?
          `).run(minKeepId)
        }
      }

      const threeDaysAgo = Math.floor(Date.now() / 1000) - (3 * 24 * 60 * 60)
      db.prepare("DELETE FROM messages WHERE timestamp < ?").run(threeDaysAgo)
    } catch {
      // Ignore background pruning errors
    }
  },

  // 2. Bind Socket Events to SQLite tables
  bind: (ev) => {
    ev.on('contacts.upsert', (contacts) => {
      const now = Date.now()
      const tx = db.transaction((items) => {
        for (const c of items) {
          const jid = jidNormalizedUser(c.id)
          const phone = jid.endsWith('@s.whatsapp.net') ? jid.split('@')[0] : null
          stmts.upsertContact.run({
            jid,
            name: c.name || null,
            notify: c.notify || null,
            phone,
            updatedAt: now
          })
        }
      })
      tx(contacts)
    })

    ev.on('contacts.update', (updates) => {
      const now = Date.now()
      const tx = db.transaction((items) => {
        for (const c of items) {
          const jid = jidNormalizedUser(c.id)
          const phone = jid.endsWith('@s.whatsapp.net') ? jid.split('@')[0] : null
          stmts.upsertContact.run({
            jid,
            name: c.name || null,
            notify: c.notify || null,
            phone,
            updatedAt: now
          })
        }
      })
      tx(updates)
    })

    ev.on('lid-mapping.update', ({ lid, pn }) => {
      stmts.upsertLid.run({
        lid: jidNormalizedUser(lid),
        pn: jidNormalizedUser(pn),
        updatedAt: Date.now()
      })
    })

    ev.on('messages.upsert', ({ messages }) => {
      const tx = db.transaction((list) => {
        for (const m of list) {
          if (!m.message) continue
          stmts.insertMessage.run({
            id: m.key.id,
            remoteJid: m.key.remoteJid,
            participant: m.key.participant || null,
            fromMe: m.key.fromMe ? 1 : 0,
            message: JSON.stringify(m.message),
            timestamp: Number(m.messageTimestamp || Math.floor(Date.now() / 1000))
          })
        }
      })
      tx(messages)
    })

    ev.on('groups.upsert', (groups) => {
      const now = Date.now()
      const tx = db.transaction((list) => {
        for (const g of list) {
          stmts.upsertGroup.run({
            id: g.id,
            subject: g.subject || 'Unknown Group',
            metadata: JSON.stringify(g),
            updatedAt: now
          })
        }
      })
      tx(groups)
    })

    ev.on('groups.update', (updates) => {
      const now = Date.now()
      for (const g of updates) {
        if (!g.id) continue
        const existing = stmts.getGroup.get(g.id)
        const oldMeta = existing ? JSON.parse(existing.metadata) : {}
        const merged = { ...oldMeta, ...g }
        stmts.upsertGroup.run({
          id: g.id,
          subject: merged.subject || 'Unknown Group',
          metadata: JSON.stringify(merged),
          updatedAt: now
        })
      }
    })
  },

  // 3. Methods for reading data
  loadMessage: async (remoteJid, id) => {
    try {
      const row = stmts.getMessage.get(remoteJid, id)
      return row ? JSON.parse(row.message) : undefined
    } catch {
      return undefined
    }
  },

  getName: (jid) => {
    if (!jid) return 'Anonymous'
    const normalized = jidNormalizedUser(jid)
    const contact = stmts.getContact.get(normalized)
    return contact?.name || contact?.notify || contact?.phone || 'Anonymous'
  },

  getPn: (lid) => {
    const row = stmts.getPnFromLid.get(jidNormalizedUser(lid))
    return row?.pn || null
  },

  getLid: (pn) => {
    const row = stmts.getLidFromPn.get(jidNormalizedUser(pn))
    return row?.lid || null
  },

  getGroupMetadata: (groupId) => {
    const row = stmts.getGroup.get(groupId)
    return row ? JSON.parse(row.metadata) : null
  },

  // 4. User Management Methods
  registerUser: (jid, name, age) => {
    const normalized = jidNormalizedUser(jid)
    stmts.registerUser.run({
      jid: normalized,
      name: name || 'User',
      age: Number(age) || 0,
      registeredAt: Date.now(),
      warnedAt: null
    })
  },

  getUser: (jid) => {
    if (!jid) return null
    const normalized = jidNormalizedUser(jid)
    return stmts.getUser.get(normalized) || null
  },

  getUsersCount: () => {
    return stmts.getUsersCount.get()?.count || 0
  },

  setUserWarnedTime: (jid, timestamp) => {
    if (!jid) return
    const normalized = jidNormalizedUser(jid)
    stmts.setWarnedTime.run(normalized, timestamp)
  },

  getUserWarnedTime: (jid) => {
    if (!jid) return null
    const normalized = jidNormalizedUser(jid)
    const user = stmts.getUser.get(normalized)
    return user?.warnedAt || null
  },

  // 5. Blacklist Management Methods
  addBlacklist: (targetJid, type, reason, durationMs = 0) => {
    const normalized = jidNormalizedUser(targetJid)
    const now = Date.now()
    const expiresAt = durationMs > 0 ? now + durationMs : 0
    stmts.addBlacklist.run({
      targetJid: normalized,
      type: type || 'user',
      reason: reason || 'No reason specified',
      blacklistedAt: now,
      expiresAt
    })
  },

  removeBlacklist: (targetJid) => {
    if (!targetJid) return false
    const normalized = jidNormalizedUser(targetJid)
    const res = stmts.removeBlacklist.run(normalized)
    return res.changes > 0
  },

  getBlacklist: (targetJid) => {
    if (!targetJid) return null
    const normalized = jidNormalizedUser(targetJid)
    const row = stmts.getBlacklist.get(normalized)
    if (!row) return null

    if (row.expiresAt > 0 && Date.now() > row.expiresAt) {
      stmts.removeBlacklist.run(normalized)
      return null
    }

    return row
  },

  listBlacklists: () => {
    const rows = stmts.listBlacklists.all()
    const now = Date.now()
    const active = []
    for (const row of rows) {
      if (row.expiresAt > 0 && now > row.expiresAt) {
        stmts.removeBlacklist.run(row.targetJid)
      } else {
        active.push(row)
      }
    }
    return active
  },

  getBlacklistCount: () => {
    return stmts.getBlacklistCount.get()?.count || 0
  },

  getContactsCount: () => {
    return stmts.getContactsCount.get()?.count || 0
  },

  getGroupsCount: () => {
    return stmts.getGroupsCount.get()?.count || 0
  }
}

export default store