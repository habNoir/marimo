import { jidNormalizedUser } from '@rexxhayanasi/elaina-baileys'
import store from '../../utils/store.js'

function parseDuration(str) {
  if (!str) return 0
  const clean = str.trim().toLowerCase()
  if (clean === '0' || clean === 'perm' || clean === 'permanent') return 0

  const match = clean.match(/^(\d+)([smhd])$/)
  if (!match) return null

  const val = parseInt(match[1], 10)
  const unit = match[2]

  switch (unit) {
    case 's': return val * 1000
    case 'm': return val * 60 * 1000
    case 'h': return val * 60 * 60 * 1000
    case 'd': return val * 24 * 60 * 60 * 1000
    default: return null
  }
}

function formatDuration(ms) {
  if (ms <= 0) return 'Permanent'
  const seconds = Math.floor((ms / 1000) % 60)
  const minutes = Math.floor((ms / (1000 * 60)) % 60)
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24)
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))

  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (seconds > 0) parts.push(`${seconds}s`)
  return parts.join(' ') || '0s'
}

const handler = async (m, { args, text, usedPrefix, command }) => {
  let targetJid = null
  let type = 'user'
  let durationArg = null
  let reasonArg = ''

  // 1. Resolve target JID & duration argument
  if (m.quoted) {
    targetJid = m.quoted.sender
    durationArg = args[0]
    reasonArg = args.slice(1).join(' ')
  } else if (m.mentionedJid && m.mentionedJid.length > 0) {
    targetJid = m.mentionedJid[0]
    durationArg = args[1]
    reasonArg = args.slice(2).join(' ')
  } else if (args[0] && /^[0-9]{6,16}$/.test(args[0].replace(/[^0-9]/g, ''))) {
    targetJid = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net'
    durationArg = args[1]
    reasonArg = args.slice(2).join(' ')
  } else if (args[0] && args[0].endsWith('@g.us')) {
    targetJid = args[0]
    type = 'chat'
    durationArg = args[1]
    reasonArg = args.slice(2).join(' ')
  } else if (m.isGroup) {
    targetJid = m.chat
    type = 'chat'
    durationArg = args[0]
    reasonArg = args.slice(1).join(' ')
  }

  // 2. GUARD — contextual explanation when target cannot be resolved.
  if (!targetJid) {
    return await m.reply(
      `*Blacklist Management*\n\n` +
      `Add a user or group chat to the blacklist.\n\n` +
      `*Target Methods:*\n` +
      `- Reply to user's message\n` +
      `- Tag user (@mention)\n` +
      `- Type phone number (e.g. 628123456789)\n` +
      `- Type group JID or execute command inside a group\n\n` +
      `Format: ${usedPrefix}${command} [target] [duration] [reason]\n` +
      `Duration Units: s (seconds), m (minutes), h (hours), d (days). Omit for Permanent.\n\n` +
      `Examples:\n` +
      `${usedPrefix}${command} (inside group ➔ Permanent group blacklist)\n` +
      `${usedPrefix}${command} 30m spamming (inside group ➔ 30-min group blacklist)\n` +
      `${usedPrefix}${command} 628123456789 1d spamming\n` +
      `${usedPrefix}${command} @user 2h`
    )
  }

  const normalizedTarget = jidNormalizedUser(targetJid)
  const parsedMs = parseDuration(durationArg)

  if (parsedMs === null) {
    return await m.reply(
      `*Invalid Duration Format*\n\n` +
      `Supported units: s (seconds), m (minutes), h (hours), d (days), or 0/perm for Permanent.\n\n` +
      `Example:\n` +
      `${usedPrefix}${command} 30m spamming`
    )
  }

  const reason = reasonArg || 'No reason specified'

  // 3. WORK — save blacklist to SQLite database.
  store.addBlacklist(normalizedTarget, type, reason, parsedMs)

  const durationText = parsedMs > 0 ? formatDuration(parsedMs) : 'Permanent'

  // 4. DELIVER — return send call.
  return await m.reply(
    `*Blacklist Added Successfully*\n\n` +
    `Blacklist Details:\n` +
    `- Target   : ${normalizedTarget}\n` +
    `- Type     : ${type.toUpperCase()}\n` +
    `- Duration : ${durationText}\n` +
    `- Reason   : ${reason}`
  )
}

handler.help = ['blacklist [target] [duration] [reason]']
handler.tags = ['owner']
handler.command = ['blacklist', 'ban', 'blockchat']
handler.owner = true

export default handler
