import { createSticker } from '../../utils/sticker.js'
import { fetchBuffer, getWaitMessage } from '../../utils/myfunction.js'

const handler = async (m, { conn, text, usedPrefix, command }) => {
  // 1. GUARD — contextual explanation when input or pipe delimiter is missing.
  if (!text || !text.includes('|')) {
    return await m.reply(
      `*Fake XNXX Sticker*\n\n` +
      `Format: ${usedPrefix}${command} name|quote|likes|dislikes\n\n` +
      `Example:\n` +
      `${usedPrefix}${command} agas|sample quote|99|0\n\n` +
      `Note: likes & dislikes are optional (default 0)`
    )
  }

  // 2. VALIDATE — contextual explanation when mandatory parameters are empty.
  const [name, quote, likes, dislikes] = text.split('|').map((v) => v.trim())

  if (!name || !quote) {
    return await m.reply(
      `*Invalid Format*\n\n` +
      `Both name and quote are required.\n\n` +
      `Format: ${usedPrefix}${command} name|quote|likes|dislikes\n\n` +
      `Example:\n` +
      `${usedPrefix}${command} agas|sample quote|99|0`
    )
  }

  // 3. NOTIFY — required for slow external API rendering and ffmpeg conversion.
  await m.reply(getWaitMessage())

  // 4. WORK — no try/catch. Let failures throw to executePlugin.
  const apiUrl = `https://api.deline.web.id/maker/fake-xnxx?name=${encodeURIComponent(name)}&quote=${encodeURIComponent(quote)}&likes=${likes || 0}&dislikes=${dislikes || 0}`
  const imageBuffer = await fetchBuffer(apiUrl)
  const stickerBuffer = await createSticker(imageBuffer)

  // 5. DELIVER — return the send call.
  return await conn.sendMessage(m.chat, { sticker: stickerBuffer }, { quoted: m })
}

handler.help = ['fakexnxx name|quote|likes|dislikes']
handler.tags = ['fun']
handler.command = ['fakexnxx']

export default handler