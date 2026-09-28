import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { proto, jidNormalizedUser } from '@rexxhayanasi/elaina-baileys'

const dbPath = './database/crmdb.db'

fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')
db.pragma('busy_timeout = 5000')

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    rowid INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL,
    chat TEXT NOT NULL,
    sender TEXT,
    timestamp INTEGER,
    data BLOB NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat);
  CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender);
  CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);

  CREATE TABLE IF NOT EXISTS nodes (
    id TEXT NOT NULL,
    chat TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    PRIMARY KEY(id, chat)
  );

  CREATE INDEX IF NOT EXISTS idx_nodes_chat ON nodes(chat);
  CREATE INDEX IF NOT EXISTS idx_nodes_id ON nodes(id);
`)

function serializeNode(value) {
  return JSON.stringify(value, (_, val) => {
    if (Buffer.isBuffer(val)) {
      return { type: 'Buffer', data: val.toString('base64') }
    }
    if (val instanceof Uint8Array) {
      return { type: 'Buffer', data: Buffer.from(val).toString('base64') }
    }
    return val
  })
}

function deserializeNode(value) {
  if (!value) return null
  return JSON.parse(value, (_, val) => {
    if (val && val.type === 'Buffer') {
      if (typeof val.data === 'string') return Buffer.from(val.data, 'base64')
      if (Array.isArray(val.data)) return Buffer.from(val.data)
    }
    return val
  })
}

const insertMessage = db.prepare(`
  INSERT INTO messages (id, chat, sender, timestamp, data)
  VALUES (?, ?, ?, ?, ?)
`)

const getMessage = db.prepare(`
  SELECT data FROM messages WHERE id = ? AND chat = ? ORDER BY rowid DESC LIMIT 1
`)

const getMessageById = db.prepare(`
  SELECT data FROM messages WHERE id = ? ORDER BY rowid DESC LIMIT 1
`)

const insertNodeStmt = db.prepare(`
  INSERT INTO nodes (id, chat, data) VALUES (?, ?, ?)
  ON CONFLICT(id, chat) DO UPDATE SET data = excluded.data, created_at = strftime('%s','now')
`)

const getNodeStmt = db.prepare(`
  SELECT data FROM nodes WHERE id = ? AND chat = ? ORDER BY created_at DESC LIMIT 1
`)

const getNodeByIdStmt = db.prepare(`
  SELECT data FROM nodes WHERE id = ? ORDER BY created_at DESC LIMIT 1
`)

export function saveMessage(message, chat) {
  if (!message || !chat) return false
  try {
    const id = message?.key?.id
    if (!id) return false

    const encoded = proto.WebMessageInfo.encode(message).finish()
    const sender = message.participant || message.key?.participant || message.key?.remoteJid || null

    insertMessage.run(
      id,
      chat,
      sender,
      Number(message.messageTimestamp || Math.floor(Date.now() / 1000)),
      Buffer.from(encoded)
    )
    return true
  } catch {
    return false
  }
}

export function loadMessage(id, chat) {
  if (!id) return null
  try {
    const row = chat ? getMessage.get(id, chat) : getMessageById.get(id)
    if (!row?.data) return null
    return proto.WebMessageInfo.decode(row.data)
  } catch {
    return null
  }
}

export function loadMessageById(id) {
  if (!id) return null
  try {
    const row = getMessageById.get(id)
    if (!row?.data) return null
    return proto.WebMessageInfo.decode(row.data)
  } catch {
    return null
  }
}

export function saveNode(id, chat, node) {
  if (!id || !chat || !node) return false
  try {
    insertNodeStmt.run(String(id), String(chat), serializeNode(node))
    return true
  } catch {
    return false
  }
}

export function loadNode(messageId, jid) {
  if (!messageId) return null
  try {
    let row = jid ? getNodeStmt.get(String(messageId), String(jid)) : null
    if (!row?.data) row = getNodeByIdStmt.get(String(messageId))
    if (!row?.data) return null
    return deserializeNode(row.data)
  } catch {
    return null
  }
}

export function saveAdditionalNode(id, chat, content, attrs = {}) {
  if (!id || !chat) return false
  try {
    const existing = getNodeStmt.get(String(id), String(chat))
    if (existing?.data) {
      const node = deserializeNode(existing.data)
      if (node && typeof node === 'object') {
        node.content = content
        node.attrs = { ...node.attrs, ...attrs }
        insertNodeStmt.run(String(id), String(chat), serializeNode(node))
        return true
      }
    }
    insertNodeStmt.run(
      String(id),
      String(chat),
      serializeNode({
        tag: 'message',
        attrs: {
          id: String(id),
          from: String(chat),
          t: String(Math.floor(Date.now() / 1000)),
          type: 'text',
          ...attrs
        },
        content
      })
    )
    return true
  } catch {
    return false
  }
}

if (!global.__crmStoreBoundConns) {
  global.__crmStoreBoundConns = new WeakSet()
}

export function bind(conn) {
  if (!conn) return conn
  if (global.__crmStoreBoundConns.has(conn)) return conn

  global.__crmStoreBoundConns.add(conn)

  conn.ev.on('messages.upsert', ({ messages }) => {
    try {
      for (const message of messages || []) {
        if (!message?.key?.id) continue
        const chat = message.key.remoteJid
        if (!chat) continue
        saveMessage(message, chat)
      }
    } catch {}
  })

  return conn
}

export const crmstore = {
  db,
  saveMessage,
  loadMessage,
  loadMessageById,
  saveNode,
  loadNode,
  saveAdditionalNode,
  bind
}

export default crmstore
