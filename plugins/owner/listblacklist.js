import store from '../../utils/store.js'

function formatRemaining(expiresAt) {
  if (!expiresAt || expiresAt <= 0) return 'Permanent'
  const diff = expiresAt - Date.now()
  if (diff <= 0) return 'Expired'

  const seconds = Math.floor((diff / 1000) % 60)
  const minutes = Math.floor((diff / (1000 * 60)) % 60)
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (seconds > 0) parts.push(`${seconds}s`)
  return parts.join(' ') || '<1s'
}

const handler = async (m) => {
  // 1. WORK — fetch active blacklists from SQLite store.
  const activeBlacklists = store.listBlacklists()

  // 2. DELIVER — return format list.
  if (activeBlacklists.length === 0) {
    return await m.reply(
      `*Active Blacklists*\n\n` +
      `There are currently no blacklisted users or chats.`
    )
  }

  let text = `*Active Blacklist Entries (${activeBlacklists.length})*\n\n`
  activeBlacklists.forEach((item, index) => {
    const remaining = formatRemaining(item.expiresAt)
    text += `${index + 1}. [${item.type.toUpperCase()}] ${item.targetJid}\n`
    text += `   - Duration : ${remaining}\n`
    text += `   - Reason   : ${item.reason}\n\n`
  })

  return await m.reply(text.trim())
}

handler.help = ['listblacklist']
handler.tags = ['owner']
handler.command = ['listblacklist', 'listban']
handler.owner = true

export default handler
