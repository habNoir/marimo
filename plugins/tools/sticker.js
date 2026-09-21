import { createSticker } from '../../utils/sticker.js'
import { downloadMedia } from '../../utils/myfunction.js'

const handler = async (m, { conn, usedPrefix, command }) => {
  // 1. GUARD — contextual explanation when no valid image or video is attached or quoted.
  const quoted = m.quoted
  const targetMsg = quoted ? quoted.msg : m.msg
  const targetType = quoted ? quoted.type : m.type

  const hasImage = targetType === 'imageMessage' || Boolean(targetMsg?.imageMessage)
  const hasVideo = targetType === 'videoMessage' || Boolean(targetMsg?.videoMessage)

  if (!hasImage && !hasVideo) {
    return await m.reply(
      `*Sticker Generator*\n\n` +
      `Send or reply to an image or video to convert it into a sticker.\n\n` +
      `Example:\n` +
      `Reply to a media message with ${usedPrefix}${command}\n\n` +
      `*Specifications:*\n` +
      `- Supported formats: JPG, PNG, GIF, MP4\n` +
      `- Max video duration: 9 seconds`
    )
  }

  // 2. VALIDATE — contextual explanation when video length limit is exceeded.
  const videoNode = targetMsg?.videoMessage || targetMsg
  if (hasVideo && (videoNode?.seconds || 0) > 10) {
    return await m.reply(
      `*Conversion Failed*\n\n` +
      `The video length exceeds the allowable limit.\n` +
      `Please provide a video that is 9 seconds or shorter.`
    )
  }

  // 3. NOTIFY — required for media downloading and ffmpeg webp conversion.
  await m.reply(
    `*Converting Media*\n\n` +
    `Your media is being converted into a sticker. This may take a moment.`
  )

  // 4. WORK — no try/catch. Let failures throw to executePlugin.
  const mediaType = hasVideo ? 'video' : 'image'
  const mediaBuffer = await downloadMedia(targetMsg, mediaType)
  const stickerBuffer = await createSticker(mediaBuffer)

  // 5. DELIVER — return the send call.
  return await conn.sendMessage(m.chat, { sticker: stickerBuffer }, { quoted: m })
}

handler.help = ['sticker', 's']
handler.tags = ['tools']
handler.command = ['sticker', 's']

export default handler