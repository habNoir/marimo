import crypto from 'node:crypto'
import { proto } from '@rexxhayanasi/elaina-baileys'
import crmstore from '../../utils/crmstore.js'

const ignoredTags = new Set(['device-identity', 'quality_control', 'enc', 'hsm', 'verified_name', 'multicast', 'reporting', 'unavailable', 'rcat'])
const ignoredAttributes = new Set(['id', 'from', 'to', 'participant', 'recipient', 'type', 'sts', 'verified_level', 'notify', 'addressing_mode', 'verified_name', 'participant_pn', 't', 'count'])

const SECRET_CONTEXT = {
  EVENT_EDIT: 'Event Edit',
  MESSAGE_EDIT: 'Message Edit',
  POLL_EDIT: 'Poll Edit',
  POLL_ADD_OPTION: 'Poll Edit'
}

function loadBestNode(crmstore, messageId, chatId, msg) {
  if (!crmstore || !messageId) return null
  let node = null
  try {
    node = crmstore.loadNode(messageId, chatId)
  } catch {}

  if (node) return node

  const alternativeChats = [chatId, msg?.key?.remoteJid, msg?.key?.participant].filter(Boolean)
  for (const jid of [...new Set(alternativeChats)]) {
    if (jid === chatId) continue
    try {
      node = crmstore.loadNode(messageId, jid)
    } catch {}
    if (node) return node
  }

  try {
    const raw = crmstore.loadNode(messageId)
    if (raw) return raw
  } catch {}

  return null
}

function getNodeAttributes(node) {
  if (!node?.attrs || typeof node.attrs !== 'object' || Array.isArray(node.attrs)) return {}
  const attrs = { ...node.attrs }
  for (const key of ignoredAttributes) {
    delete attrs[key]
  }
  return attrs
}

function getNodeContent(node) {
  if (!node || !Array.isArray(node.content)) return []
  return node.content
}

function normalizeMessage(rmsg, crmstore, chat) {
  const normalized = proto.WebMessageInfo.toObject(proto.WebMessageInfo.fromObject(rmsg), {
    enums: Number,
    longs: Number,
    bytes: String,
    defaults: false
  })
  return decryptSecretEnvelope(normalized, crmstore, chat)
}

function decryptSecretEnvelope(msg, crmstore, chat) {
  const secret = msg?.message?.secretEncryptedMessage
  if (!secret) return msg

  const type = secretEncTypeName(secret.secretEncType)
  if (!['MESSAGE_EDIT', 'EVENT_EDIT', 'POLL_EDIT', 'POLL_ADD_OPTION'].includes(type)) return msg

  const targetKey = secret.targetMessageKey
  if (!targetKey?.id) return msg

  const target = loadTargetSecret(crmstore, chat, targetKey)
  if (!target) return msg

  const decrypted = decryptSecretMessage(secret, target, type)
  if (!decrypted) return msg

  return { ...msg, message: decrypted }
}

function secretEncTypeName(value) {
  if (typeof value === 'string') return value
  try {
    return proto.Message.SecretEncryptedMessage.SecretEncType[value] ?? value
  } catch {
    return value
  }
}

function getSecretContext(type) {
  return SECRET_CONTEXT[type] || null
}

function loadTargetSecret(crmstore, chat, targetKey) {
  try {
    const row = crmstore.loadMessage(targetKey.id, chat)
    if (!row) return null

    const normalized = proto.WebMessageInfo.toObject(proto.WebMessageInfo.fromObject(row), {
      enums: Number,
      longs: Number,
      bytes: String,
      defaults: false
    })

    const secretB64 = findMessageSecret(normalized.message)
    if (!secretB64) return null

    const key = normalized.key || {}
    const senderJid = key.participant || targetKey.participant || key.remoteJid || targetKey.remoteJid
    if (!senderJid) return null

    return { messageSecret: Buffer.from(secretB64, 'base64'), senderJid }
  } catch {
    return null
  }
}

function findMessageSecret(node, depth = 0, maxDepth = 12) {
  if (!node || typeof node !== 'object' || depth > maxDepth) return null
  if (node.messageContextInfo?.messageSecret) return node.messageContextInfo.messageSecret

  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') {
      const found = findMessageSecret(value, depth + 1, maxDepth)
      if (found) return found
    }
  }
  return null
}

function decryptSecretMessage(secretMsg, target, type) {
  try {
    const targetId = secretMsg?.targetMessageKey?.id
    if (!targetId || !secretMsg?.encPayload || !secretMsg?.encIv || !target?.messageSecret) return null

    const context = getSecretContext(type)
    if (!context) return null

    const messageSecret = target.messageSecret
    if (messageSecret.length !== 32) return null

    const senderJid = target.senderJid
    const info = Buffer.concat([
      Buffer.from(targetId, 'utf8'),
      Buffer.from(senderJid, 'utf8'),
      Buffer.from(senderJid, 'utf8'),
      Buffer.from(context, 'utf8')
    ])

    const key = crypto.hkdfSync('sha256', messageSecret, Buffer.alloc(0), info, 32)
    const encPayload = Buffer.from(secretMsg.encPayload, 'base64')
    const encIv = Buffer.from(secretMsg.encIv, 'base64')

    if (encIv.length !== 12 || encPayload.length < 16) return null

    const authTag = encPayload.subarray(-16)
    const ciphertext = encPayload.subarray(0, -16)

    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key), encIv)
    decipher.setAuthTag(authTag)

    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    const decoded = proto.Message.decode(plaintext)

    return proto.Message.toObject(decoded, { enums: Number, longs: Number, bytes: String, defaults: false })
  } catch {
    return null
  }
}

function filterAdditionalNodes(nodes) {
  return (nodes || []).filter((v) => !ignoredTags.has(v?.tag))
}

function getRelayOptions(node = null) {
  const additionalAttributes = getNodeAttributes(node)
  const additionalNodes = filterAdditionalNodes(getNodeContent(node))
  const options = {}
  if (Object.keys(additionalAttributes).length) options.additionalAttributes = additionalAttributes
  if (additionalNodes.length) options.additionalNodes = additionalNodes
  return options
}

function stringify(obj) {
  return JSON.stringify(
    obj,
    (key, value) => {
      if (Buffer.isBuffer(value)) return value.toString('base64')
      if (value?.type === 'Buffer' && Array.isArray(value.data)) return Buffer.from(value.data).toString('base64')
      return value
    },
    2
  )
}

function indentBlock(str, level = 1) {
  const pad = '  '.repeat(level)
  return str.split('\n').map((line, i) => (i === 0 ? line : pad + line)).join('\n')
}

function stringifySnippet(obj) {
  const json = JSON.stringify(
    obj,
    (key, value) => {
      if (Buffer.isBuffer(value)) return value.toString('base64')
      if (value?.type === 'Buffer' && Array.isArray(value.data)) return Buffer.from(value.data).toString('base64')
      return value
    },
    2
  )
  return json.replace(/^(\s*)"([^"]+)":/gm, (_, indent, key) => `${indent}${key}:`)
}

function buildRelayScript(snippetMessage, options) {
  return `=> conn.relayMessage(\n  m.chat,\n  ${indentBlock(snippetMessage)},\n  ${indentBlock(options)}\n)`
}

function buildSendMessageScript(msg) {
  const m = msg.message || {}
  let content = {}

  if (m.conversation || m.extendedTextMessage?.text) {
    content = { text: m.conversation || m.extendedTextMessage.text }
  } else if (m.imageMessage) {
    content = { image: { url: 'https://example.com/image.jpg' }, caption: m.imageMessage.caption || '' }
  } else if (m.videoMessage) {
    content = { video: { url: 'https://example.com/video.mp4' }, caption: m.videoMessage.caption || '' }
  } else if (m.audioMessage) {
    content = { audio: { url: 'https://example.com/audio.mp3' }, ptt: Boolean(m.audioMessage.ptt) }
  } else if (m.stickerMessage) {
    content = { sticker: { url: 'https://example.com/sticker.webp' } }
  } else if (m.documentMessage) {
    content = { document: { url: 'https://example.com/file.pdf' }, fileName: m.documentMessage.fileName || 'file.pdf', mimetype: m.documentMessage.mimetype || 'application/pdf' }
  } else if (m.locationMessage) {
    content = { location: { degreesLatitude: m.locationMessage.degreesLatitude, degreesLongitude: m.locationMessage.degreesLongitude, name: m.locationMessage.name || '' } }
  } else if (m.contactMessage) {
    content = { contacts: { displayName: m.contactMessage.displayName, vcard: m.contactMessage.vcard } }
  } else {
    content = m
  }

  return `=> conn.sendMessage(m.chat, ${stringifySnippet(content)}, { quoted: m })`
}

function buildProtoInspectScript(msg) {
  const m = msg.message || {}
  const keys = Object.keys(m)
  const info = keys.map((k) => {
    const val = m[k]
    const valType = typeof val
    let detail = ''
    if (valType === 'object' && val !== null) {
      detail = `[Object with ${Object.keys(val).length} fields: ${Object.keys(val).join(', ')}]`
    } else {
      detail = String(val)
    }
    return `- ${k} (${valType}): ${detail}`
  })
  return `*Protobuf Message Inspection*\n\nFields detected (${keys.length}):\n${info.join('\n')}`
}

function getLastChatRows(crmstore, m, limit) {
  return crmstore.db
    .prepare(
      `SELECT rowid, id, chat, sender, timestamp, data FROM messages WHERE chat = ? ORDER BY timestamp DESC, rowid DESC LIMIT ?`
    )
    .all(m.chat, limit)
    .reverse()
}

function formatTimestamp(timestamp) {
  if (!timestamp) return '--:--:--'
  const date = new Date(Number(timestamp) * 1000)
  if (Number.isNaN(date.getTime())) return '--:--:--'
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta'
  }).format(date)
}

function formatLastChat(rows) {
  const lines = [`╭─〔 LAST CHAT HISTORY • ${rows.length} MESSAGES 〕`, '│']

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    let message = null
    try {
      message = proto.WebMessageInfo.toObject(proto.WebMessageInfo.decode(row.data), { enums: Number, longs: Number, bytes: String, defaults: false })
    } catch {}

    const type = Object.keys(message?.message || {})[0] || '-'
    const sender = row.sender ? row.sender.split('@')[0] : 'Unknown'
    const textPreview = message?.message?.conversation || message?.message?.extendedTextMessage?.text || type

    lines.push(`│ ${String(i + 1).padStart(2, '0')}  ${formatTimestamp(row.timestamp)}  ${sender}`)
    lines.push(`│     ${type} • #${row.rowid}`)
    lines.push(`│     ${String(textPreview).replace(/\n/g, ' ').slice(0, 100)}`)
    if (i !== rows.length - 1) lines.push('│')
  }

  lines.push('│')
  lines.push(`╰─ Chat: ${rows[0]?.chat || '-'}`)
  return lines.join('\n')
}

const handler = async (m, { conn, text, command, usedPrefix }) => {
  const args = String(text || '').trim().split(/\s+/).filter(Boolean)

  if (command === 'lastchat') {
    const parsed = Number(args[0] || 10)
    const limit = Math.min(Math.max(Number.isFinite(parsed) ? parsed : 10, 1), 100)
    const rows = getLastChatRows(crmstore, m, limit)

    if (!rows.length) {
      return await m.reply('*Last Chat History*\n\nNo stored messages found in SQLite database.')
    }
    return await m.reply(formatLastChat(rows))
  }

  const rowMatch = args[0]?.match(/^#(\d+)$/)
  const rowid = rowMatch ? Number(rowMatch[1]) : null

  let chatId
  let targetId
  let msgSource
  let rmsg

  if (rowid !== null) {
    const row = crmstore.db.prepare(`SELECT rowid, id, chat, sender, timestamp, data FROM messages WHERE rowid = ? LIMIT 1`).get(rowid)
    if (!row) {
      return await m.reply(`*Message Not Found*\n\nNo message found with rowid #${rowid}.`)
    }
    rmsg = proto.WebMessageInfo.toObject(proto.WebMessageInfo.decode(row.data), { enums: Number, longs: Number, bytes: String, defaults: false })
    chatId = row.chat
    targetId = row.id
    msgSource = `rowid:#${rowid}`
  } else {
    if (!m.quoted) {
      return await m.reply(
        `*CRM Debug Suite (by Nixel / habNoir)*\n\n` +
        `Reply to any message or specify a rowid (#rowid) to inspect and debug WhatsApp payloads.\n\n` +
        `*Commands:*\n` +
        `- ${usedPrefix}crm       : Generate low-level conn.relayMessage code\n` +
        `- ${usedPrefix}fn        : Generate high-level conn.sendMessage function call\n` +
        `- ${usedPrefix}crm2      : Send raw payload & code via copyable snippets\n` +
        `- ${usedPrefix}insp      : Inspect raw JSON payload structure\n` +
        `- ${usedPrefix}proto     : Inspect Protobuf fields and enum schemas\n` +
        `- ${usedPrefix}adn       : Extract AdditionalNodes (XML stanza attributes)\n` +
        `- ${usedPrefix}relay     : Re-transmit/relay message directly\n` +
        `- ${usedPrefix}lastchat  : View recent chat history with #rowid\n\n` +
        `*Optional Flags:*\n` +
        `- -raw     : Export full raw JSON\n` +
        `- -file    : Send output as document file\n` +
        `- -snip    : Return output as formatted code snippet\n` +
        `- -nofilter: Keep unfiltered stanza nodes\n\n` +
        `Example:\n` +
        `Reply to a message with ${usedPrefix}crm\n` +
        `Or use: ${usedPrefix}crm #12`
      )
    }

    chatId = m.quoted.chat || m.chat
    targetId = m.quoted.id
    rmsg = crmstore.loadMessage(targetId, chatId) || m.quoted?.fakeObj
    msgSource = 'quotedObj'
  }

  let msg
  if (rmsg) {
    msg = normalizeMessage(rmsg, crmstore, chatId)
  }

  if (!msg?.message) {
    return await m.reply(`*Invalid Message Payload*\n\nThe selected message does not contain valid Protobuf structure.`)
  }

  const messageId = msg.key?.id || targetId
  const rawNode = loadBestNode(crmstore, messageId, chatId, msg)
  const nodeAttrs = getNodeAttributes(rawNode)
  const nodeContent = getNodeContent(rawNode)
  const type = Object.keys(msg.message).find((v) => !['messageContextInfo', 'senderKeyDistributionMessage'].includes(v)) || 'unknown'
  const additionalNodes = filterAdditionalNodes(nodeContent)
  const relayOptions = getRelayOptions(rawNode)

  if (command === 'relay') {
    const newParentId = await conn.relayMessage(m.chat, structuredClone(msg.message), relayOptions)
    return await m.reply(`*Message Relayed*\n\nNew Relay Message ID: ${newParentId}`)
  }

  const snippetMessage = stringifySnippet(msg.message)
  const relayCode = buildRelayScript(snippetMessage, stringifySnippet(relayOptions))
  const fnCode = buildSendMessageScript(msg)
  const protoReport = buildProtoInspectScript(msg)

  const metadata =
    `• Type      : ${type}\n` +
    `• Source    : ${msgSource || '-'}\n` +
    `• Chat      : ${chatId}\n` +
    `• ID        : ${messageId}\n` +
    `• Sender    : ${(msg.key?.participant || msg.key?.remoteJid || '-').split('@')[0]}\n` +
    `• Node Tag  : ${rawNode?.tag || '-'}\n` +
    `• Attrs     : ${Object.keys(nodeAttrs).length}`

  if (command === 'fn') {
    if (text.includes('-file')) {
      return await conn.sendMessage(
        m.chat,
        { document: Buffer.from(fnCode), fileName: `${type}_sendMessage.js`, mimetype: 'application/javascript', caption: metadata },
        { quoted: m }
      )
    }
    return await m.reply(`*SendMessage Function Snippet*\n\n${metadata}\n\n\`\`\`js\n${fnCode}\n\`\`\``)
  }

  if (command === 'proto') {
    return await m.reply(`${metadata}\n\n${protoReport}`)
  }

  if (command === 'insp') {
    const rawPayload = { message: msg, node: rawNode, additionalAttributes: nodeAttrs, additionalNodes }
    const jsonStr = stringify(rawPayload)

    if (text.includes('-file')) {
      return await conn.sendMessage(
        m.chat,
        { document: Buffer.from(jsonStr), fileName: `${type}.json`, mimetype: 'application/json', caption: metadata },
        { quoted: m }
      )
    }
    return await m.reply(`*Message Payload Inspection*\n\n${metadata}\n\n\`\`\`json\n${jsonStr.slice(0, 3500)}\n\`\`\``)
  }

  if (command === 'adn') {
    const adn = text.includes('-nofilter') ? additionalNodes : filterAdditionalNodes(additionalNodes)
    if (!adn.length) {
      return await m.reply(`*No Additional Nodes*\n\nNo XML stanza nodes captured for message #${messageId}.`)
    }
    const adnStr = stringifySnippet(adn)
    if (text.includes('-file')) {
      return await conn.sendMessage(
        m.chat,
        { document: Buffer.from(adnStr), fileName: 'additionalNodes.json', mimetype: 'application/json', caption: metadata },
        { quoted: m }
      )
    }
    return await m.reply(`*Stanza AdditionalNodes*\n\n${metadata}\n\n\`\`\`json\n${adnStr.slice(0, 3500)}\n\`\`\``)
  }

  if (command === 'crm2') {
    const rawStr = stringify(msg)
    const caption =
      `*CRM Message Inspection*\n\n` +
      `${metadata}\n\n` +
      `*Relay Snippet:*\n\`\`\`js\n${relayCode}\n\`\`\`\n\n` +
      `*SendMessage Snippet:*\n\`\`\`js\n${fnCode}\n\`\`\``

    return await conn.sendMessage(
      m.chat,
      {
        document: Buffer.from(relayCode),
        fileName: `${type}_relay.js`,
        mimetype: 'application/javascript',
        caption
      },
      { quoted: m }
    )
  }

  // Default command: !crm
  if (text.includes('-file')) {
    return await conn.sendMessage(
      m.chat,
      { document: Buffer.from(relayCode), fileName: `${type}.js`, mimetype: 'application/javascript', caption: metadata },
      { quoted: m }
    )
  }

  return await m.reply(`*Relay Script Output*\n\n${metadata}\n\n\`\`\`js\n${relayCode}\n\`\`\``)
}

handler.help = ['crm', 'crm2', 'insp', 'adn', 'relay', 'lastchat', 'fn', 'proto']
handler.tags = ['owner']
handler.command = ['crm', 'crm2', 'insp', 'adn', 'relay', 'lastchat', 'fn', 'proto']
handler.owner = true

export default handler
