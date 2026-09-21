import { jidNormalizedUser } from '@rexxhayanasi/elaina-baileys'
import store from '../../utils/store.js'

const handler = async (m, { args, usedPrefix, command }) => {
  let targetJid = null

  if (m.quoted) {
    targetJid = m.quoted.sender
  } else if (m.mentionedJid && m.mentionedJid.length > 0) {
    targetJid = m.mentionedJid[0]
  } else if (args[0] && /^[0-9]{6,16}$/.test(args[0].replace(/[^0-9]/g, ''))) {
    targetJid = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net'
  } else if (args[0] && args[0].endsWith('@g.us')) {
    targetJid = args[0]
  } else if (m.isGroup) {
    targetJid = m.chat
  }

  // 1. GUARD — contextual explanation when target cannot be resolved.
  if (!targetJid) {
    return await m.reply(
      `*Unblacklist Management*\n\n` +
      `Remove a user or group chat from the blacklist.\n\n` +
      `*Target Methods:*\n` +
      `- Reply to user's message\n` +
      `- Tag user (@mention)\n` +
      `- Type phone number (e.g. 628123456789)\n` +
      `- Type group JID or execute command inside a group\n\n` +
      `Format: ${usedPrefix}${command} [target]\n\n` +
      `Example:\n` +
      `${usedPrefix}${command} 628123456789`
    )
  }

  const normalizedTarget = jidNormalizedUser(targetJid)

  // 2. WORK — remove target from SQLite blacklist database.
  const removed = store.removeBlacklist(normalizedTarget)

  if (!removed) {
    return await m.reply(
      `*Target Not Found*\n\n` +
      `Target ${normalizedTarget} is not currently blacklisted.`
    )
  }

  // 3. DELIVER — return send call.
  return await m.reply(
    `*Unblacklist Successful*\n\n` +
    `Target ${normalizedTarget} has been removed from the blacklist.`
  )
}

handler.help = ['unblacklist [target]']
handler.tags = ['owner']
handler.command = ['unblacklist', 'unban', 'unblockchat']
handler.owner = true

export default handler
