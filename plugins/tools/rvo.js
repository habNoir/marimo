import { downloadMedia, getViewOnceCache, getWaitMessage } from '../../utils/myfunction.js'

const handler = async (m, { conn, usedPrefix, command }) => {
  // 1. GUARD — contextual explanation when quoted target is not a view-once message.
  const target = m.quoted

  if (!target || !target.isViewOnce) {
    return await m.reply(
      `*Read View Once*\n\n` +
      `Reply to a view-once photo, video, or voice note with this command to reveal it.\n\n` +
      `Example:\n` +
      `Reply to a view-once message with ${usedPrefix}${command}`
    )
  }

  // 2. NOTIFY — required for media extraction & downloading.
  await m.reply(getWaitMessage())

  // 3. WORK — no try/catch or console.error. Let failures throw to executePlugin.
  const stanzaId = target.key?.id
  let buffer, mediaType, mimetype, caption

  const cached = getViewOnceCache(stanzaId)

  if (cached) {
    buffer = cached.buffer
    mediaType = cached.mediaType
    mimetype = cached.mimetype
    caption = cached.caption
  } else {
    const type = target.type
    mediaType = (type || '').replace('Message', '') || 'image'
    buffer = await downloadMedia(target.msg, mediaType)
    mimetype = target.msg?.[type]?.mimetype
    caption = target.msg?.[type]?.caption || ''
  }

  // 4. DELIVER — return the send call.
  if (mediaType === 'video') {
    return await conn.sendMessage(
      m.chat,
      { video: buffer, mimetype: mimetype || 'video/mp4', caption },
      { quoted: m }
    )
  }

  if (mediaType === 'audio') {
    return await conn.sendMessage(
      m.chat,
      { audio: buffer, mimetype: mimetype || 'audio/mp4', ptt: true },
      { quoted: m }
    )
  }

  return await conn.sendMessage(
    m.chat,
    { image: buffer, caption },
    { quoted: m }
  )
}

handler.help = ['readvo <reply to view-once message>']
handler.tags = ['tools']
handler.command = ['readvo', 'rvo', 'viewonce']

export default handler