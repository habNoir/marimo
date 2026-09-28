import { createSticker } from '../../utils/sticker.js'
import { fetchBuffer, getWaitMessage } from '../../utils/myfunction.js'

const handler = async (m, { conn, text, usedPrefix, command }) => {
  // 1. GUARD — contextual explanation when text input is missing.
  if (!text) {
    return await m.reply(
      `*Brat Girl Sticker*\n\n` +
      `Convert your text into a Brat girl style sticker.\n\n` +
      `Example:\n` +
      `${usedPrefix}${command} sample text`
    )
  }

  // 2. VALIDATE — contextual explanation when input length limit is exceeded.
  if (text.length > 100) {
    return await m.reply(
      `*Input Too Long*\n\n` +
      `The text must not exceed 100 characters.\n` +
      `Your input contains ${text.length} characters.`
    )
  }

  // 3. NOTIFY — required for slow external API rendering and ffmpeg conversion.
  await m.reply(getWaitMessage())

  // 4. WORK — no try/catch. Let failures throw.
  const apiUrl = `https://api.deline.web.id/maker/cewekbrat?text=${encodeURIComponent(text)}`
  const imageBuffer = await fetchBuffer(apiUrl)
  const stickerBuffer = await createSticker(imageBuffer)

  // 5. DELIVER — return the send call.
  return await conn.sendMessage(m.chat, { sticker: stickerBuffer }, { quoted: m })
}

handler.help = ['bratg <text>']
handler.tags = ['fun']
handler.command = ['bratg']

export default handler