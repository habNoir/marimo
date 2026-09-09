import { jidNormalizedUser } from '@rexxhayanasi/elaina-baileys'
import logger from './utils/logger.js'
import { executePlugin } from './utils/errorHandler.js'
import { smsg, getConfig } from './utils/myfunction.js'

const groupCache = new Map()

export async function handleMessages(sock, rawM, plugins) {
  if (!rawM.message && !rawM.key?.isViewOnce) return

  const chat = rawM.key.remoteJid || ''
  if (chat === 'status@broadcast') return

  const m = smsg(sock, rawM)
  const config = getConfig()

  let groupMetadata = null
  let isAdmin = false
  let isBotAdmin = false

  if (m.isGroup) {
    const cached = groupCache.get(chat)
    if (cached && Date.now() - cached.timestamp < 300000) {
      groupMetadata = cached.data
    } else {
      try {
        groupMetadata = await sock.groupMetadata(chat)
        groupCache.set(chat, { data: groupMetadata, timestamp: Date.now() })
      } catch {
        groupMetadata = null
      }
    }

    if (groupMetadata) {
      const participants = groupMetadata.participants || []
      const groupAdmins = participants
        .filter((p) => p.admin === 'admin' || p.admin === 'superadmin')
        .map((p) => jidNormalizedUser(p.id))

      const normalizedSender = jidNormalizedUser(m.sender)
      isAdmin = groupAdmins.includes(normalizedSender)
      isBotAdmin = groupAdmins.includes(m.botJid)
    }
  }

  m.isAdmin = isAdmin
  m.isBotAdmin = isBotAdmin
  m.groupMetadata = groupMetadata

  logger.message(rawM, sock, groupMetadata)

  const activePrefixes = config.prefix?.multi
    ? (Array.isArray(config.prefix?.list) && config.prefix.list.length > 0 ? config.prefix.list : ['!'])
    : [config.prefix?.single || '!']

  const trimmedBody = (m.body || '').trim()
  const matchedPrefix = activePrefixes.find((p) => trimmedBody.startsWith(p))
  if (!matchedPrefix) return

  const args = trimmedBody.slice(matchedPrefix.length).trim().split(/ +/)
  const command = args.shift().toLowerCase()
  const text = args.join(' ')

  let matchedPlugin = null
  for (const module of plugins.values()) {
    const fn = module.default || module
    const cmd = fn.command || module.command
    if (!cmd) continue

    let isMatch = false
    if (Array.isArray(cmd)) {
      isMatch = cmd.some((c) => (c instanceof RegExp ? c.test(command) : c?.toLowerCase() === command))
    } else if (typeof cmd === 'string') {
      isMatch = cmd.toLowerCase() === command
    } else if (cmd instanceof RegExp) {
      isMatch = cmd.test(command)
    }

    if (isMatch) {
      matchedPlugin = fn
      break
    }
  }

  if (!matchedPlugin) return

  m.isCommand = true
  m.commandName = command
  m.usedPrefix = matchedPrefix

  logger.command(m, {
    command,
    usedPrefix: matchedPrefix,
    args,
    groupMetadata
  })

  if (matchedPlugin.owner && !m.isOwner) {
    return await m.reply('[!] Access Denied: This command is reserved for the bot owner.')
  }
  if (matchedPlugin.group && !m.isGroup) {
    return await m.reply('[!] Invalid Context: This command can only be used inside a group.')
  }
  if (matchedPlugin.private && !m.isPrivate) {
    return await m.reply('[!] Invalid Context: This command can only be used in private chat.')
  }
  if (matchedPlugin.admin && !m.isAdmin) {
    return await m.reply('[!] Permission Required: You must be an administrator in this group.')
  }
  if (matchedPlugin.botAdmin && !m.isBotAdmin) {
    return await m.reply('[!] Bot Permission Required: habNoir must be promoted to admin.')
  }

  await executePlugin(matchedPlugin, m, {
    conn: sock,
    sock,
    args,
    text,
    command,
    usedPrefix: matchedPrefix,
    plugins
  })
}

export default {
  handleMessages
}