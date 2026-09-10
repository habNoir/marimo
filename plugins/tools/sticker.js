import { createSticker } from '../../utils/sticker.js'
import { downloadMedia } from '../../utils/myfunction.js'

const handler = async (m, { conn, usedPrefix, command }) => {
  // 1. Resolve quoted or direct media context
  const quoted = m.quoted
  const targetMsg = quoted ? quoted.msg : m.msg
  const targetType = quoted ? quoted.type : m.type

  // Detect image / video presence across raw nodes or wrappers
  const hasImage = targetType === 'imageMessage' || Boolean(targetMsg?.imageMessage)
  const hasVideo = targetType === 'videoMessage' || Boolean(targetMsg?.videoMessage)

  if (!hasImage && !hasVideo) {
    return await m.reply(
      `*Sticker Generator*\n\n` +
      `Send or reply to an image, video, or GIF with *${usedPrefix}${command}*.\n\n` +
      `*Specifications:*\n` +
      `- Supported formats: JPG, PNG, GIF, MP4\n` +
      `- Max video duration: 9 seconds\n` +
      `- Quality: Medium (optimized size)\n` +
      `- Crop: Full scale (no crop)`
    )
  }

  // 2. Validate video duration limit for animated stickers
  const videoNode = targetMsg?.videoMessage || targetMsg
  if (hasVideo && (videoNode?.seconds || 0) > 10) {
    return await m.reply(
      `*Conversion Failed*\n\n` +
      `The video length exceeds the allowable limit.\n` +
      `Please provide a video that is 9 seconds or shorter.`
    )
  }

    // 3. Download media buffer cleanly
    const mediaType = hasVideo ? 'video' : 'image'
    const mediaBuffer = await downloadMedia(targetMsg, mediaType)

    // 4. Convert to full-dimension WebP sticker
    const stickerBuffer = await createSticker(mediaBuffer)

    // 5. Dispatch sticker
    await conn.sendMessage(m.chat, { sticker: stickerBuffer }, { quoted: m })
  } 

handler.help = ['sticker', 's']
handler.tags = ['tools']
handler.command = ['sticker', 's']

export default handler