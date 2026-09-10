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
  getLidFromPn: db.prepare(`SELECT lid FROM lid_mappings WHERE pn = ? LIMIT 1`)
}

// ─── STORE CONTROLLER ─────────────────────────────────────────────────────────
export const store = {
  db,

  // 1. Session Storage via Elaina-Baileys built-in SQLite engine
  getAuthState: async () => {
    return await useSqliteAuthState({ database: db })
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
  }
}

export default store