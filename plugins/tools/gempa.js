import { fetchBuffer } from '../../utils/myfunction.js'

const handler = async (m, { conn, command, usedPrefix }) => {
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

handler.help = ['gempa', 'bmkg', 'infogempa']
handler.tags = ['tools']
handler.command = ['gempa', 'bmkg', 'infogempa']

export default handler
