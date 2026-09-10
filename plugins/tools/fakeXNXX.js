import { createSticker } from '../../utils/sticker.js'
import { fetchBuffer } from '../../utils/myfunction.js'

const handler = async (m, { conn, usedPrefix, command, args }) => {
    const text = (args || []).join(' ').trim()

    if (!text || !text.includes('|')) {
        return await m.reply(
            `*Fake XNXX Sticker*\n\n` +
            `Format: ${usedPrefix}${command} name|quote|likes|dislikes\n\n` +
            `Example:\n` +
            `${usedPrefix}${command} agas|anjir emak teman gua|99|0\n\n` +
            `Note: likes & dislikes are optional (default 0)`
        )
    }

    const [name, quote, likes, dislikes] = text.split('|').map(v => v.trim())

    if (!name || !quote) {
        return await m.reply(
            `Name and quote are required.\n` +
            `Format: ${usedPrefix}${command} name|quote|likes|dislikes`
        )
    }

    try {
        const apiUrl = `https://api.deline.web.id/maker/fake-xnxx?name=${encodeURIComponent(name)}&quote=${encodeURIComponent(quote)}&likes=${likes || 0}&dislikes=${dislikes || 0}`

        const imageBuffer = await fetchBuffer(apiUrl)
        const stickerBuffer = await createSticker(imageBuffer)

        return await conn.sendMessage(m.chat, { sticker: stickerBuffer }, { quoted: m })
    } catch (err) {
        return await m.reply(`Failed to create sticker: ${err.message}`)
    }
}

handler.help = ['fakexnxx name|quote|likes|dislikes']
handler.tags = ['tools']
handler.command = ['fakexnxx']

export default handler