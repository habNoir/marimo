import store from '../../utils/store.js'
import { fetchBuffer } from '../../utils/myfunction.js'

const handler = async (m, { conn, args, command, usedPrefix }) => {
  const subCmd = (args[0] || '').toLowerCase()

  // ─── SUBSCRIBER NOTIFICATION CONTROLLER ────────────────────────────────────
  if (['on', 'enable'].includes(subCmd)) {
    if (m.isGroup && !m.isAdmin && !m.isOwner) {
      return await m.reply(
        `*Permission Required*\n\n` +
        `You must be an administrator in this group to configure earthquake notifications.`
      )
    }

    store.setGempaNotify(m.chat, true)
    return await m.reply(
      `*Earthquake Alerts Activated*\n\n` +
      `Real-time BMKG earthquake notifications are now active for this chat.\n` +
      `You will receive immediate warnings whenever new seismic activity is detected.`
    )
  }

  if (['off', 'disable'].includes(subCmd)) {
    if (m.isGroup && !m.isAdmin && !m.isOwner) {
      return await m.reply(
        `*Permission Required*\n\n` +
        `You must be an administrator in this group to configure earthquake notifications.`
      )
    }

    store.setGempaNotify(m.chat, false)
    return await m.reply(
      `*Earthquake Alerts Deactivated*\n\n` +
      `Real-time BMKG earthquake notifications have been disabled for this chat.`
    )
  }

  if (subCmd === 'status') {
    const isEnabled = store.getGempaNotify(m.chat)
    return await m.reply(
      `*Earthquake Notification Status*\n\n` +
      `- Chat ID : ${m.chat}\n` +
      `- Alerts  : ${isEnabled ? 'Active (Subscribed)' : 'Inactive (Unsubscribed)'}\n\n` +
      `To toggle notifications, use:\n` +
      `${usedPrefix}${command} on\n` +
      `${usedPrefix}${command} off`
    )
  }

  // 1. NOTIFY — mandatory waiting notice before fetching remote data
  await m.reply(
    `*Fetching Earthquake Info*\n\n` +
    `Retrieving the latest earthquake report from BMKG Indonesia. This may take a moment.`
  )

  // 2. WORK — fetch official BMKG autogempa JSON payload (no local try/catch)
  const jsonBuffer = await fetchBuffer('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json')
  const data = JSON.parse(jsonBuffer.toString('utf-8'))
  const gempa = data?.Infogempa?.gempa

  if (!gempa) {
    throw new Error('Failed to parse BMKG earthquake data payload.')
  }

  // Fetch Shakemap infographic map image
  const shakemapUrl = `https://data.bmkg.go.id/DataMKG/TEWS/${gempa.Shakemap}`
  const imageBuffer = await fetchBuffer(shakemapUrl)

  // 3. DELIVER — send formatted infographic image with detailed caption
  const caption =
    `*BMKG Latest Earthquake Report*\n\n` +
    `- Date & Time: ${gempa.Tanggal} at ${gempa.Jam}\n` +
    `- Magnitude: ${gempa.Magnitude} SR\n` +
    `- Depth: ${gempa.Kedalaman}\n` +
    `- Coordinates: ${gempa.Coordinates} (${gempa.Lintang}, ${gempa.Bujur})\n` +
    `- Epicenter Location: ${gempa.Wilayah}\n` +
    `- Tsunami Potential: ${gempa.Potensi}\n` +
    `- Felt Areas: ${gempa.Dirasakan || 'Not specified'}\n\n` +
    `Source: BMKG Indonesia (Meteorology, Climatology, and Geophysical Agency)`

  return await conn.sendMessage(
    m.chat,
    { image: imageBuffer, caption },
    { quoted: m }
  )
}

handler.help = ['gempa', 'gempa <on|off|status>']
handler.tags = ['tools']
handler.command = ['gempa', 'bmkg', 'infogempa']

export default handler
