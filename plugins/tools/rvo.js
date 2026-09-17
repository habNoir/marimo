import { downloadMedia, getViewOnceCache } from '../../utils/myfunction.js'

const handler = async (m, { conn, usedPrefix, command }) => {
    const target = m.quoted

    if (!target || !target.isViewOnce) {
        return await m.reply(
            `*Read View Once*\n\n` +
            `Reply to a view-once photo, video, or voice note with this command to reveal it.\n\n` +
            `Example:\n` +
            `${usedPrefix}${command} (reply to a view-once message)`
        )
    }

    const stanzaId = target.key?.id

    try {
        let buffer, mediaType, mimetype, caption

        // Try the cache first (media is downloaded as soon as it arrives,
        // so it still works even after WhatsApp marks it as opened)
        const cached = getViewOnceCache(stanzaId)

        if (cached) {
            buffer = cached.buffer
            mediaType = cached.mediaType
            mimetype = cached.mimetype
            caption = cached.caption
        } else {
            // Fallback: download directly from the quoted message if it wasn't cached in time
            const type = target.type
            mediaType = (type || '').replace('Message', '') || 'image'
            buffer = await downloadMedia(target.msg, mediaType)
            mimetype = target.msg?.[type]?.mimetype
            caption = target.msg?.[type]?.caption || ''
        }

        if (mediaType === 'video') {
            await conn.sendMessage(
                m.chat,
                { video: buffer, mimetype: mimetype || 'video/mp4', caption },
                { quoted: m }
            )
        } else if (mediaType === 'audio') {
            await conn.sendMessage(
                m.chat,
                { audio: buffer, mimetype: mimetype || 'audio/mp4', ptt: true },
                { quoted: m }
            )
        } else {
            await conn.sendMessage(
                m.chat,
                { image: buffer, caption },
                { quoted: m }
            )
        }
    } catch (err) {
        console.error('ReadViewOnce Error:', err.message)
        return await m.reply('[!] Failed to reveal the view-once message. It may have expired or is unsupported.')
    }
}

handler.help = ['readvo <reply to view-once message>']
handler.tags = ['tools']
handler.command = ['readvo', 'rvo', 'viewonce']

export default handler