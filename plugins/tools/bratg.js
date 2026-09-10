import { createSticker } from '../../utils/sticker.js'
import { fetchBuffer } from '../../utils/myfunction.js'

const handler = async (m, { conn, usedPrefix, command, args }) => {
    const text = (args || []).join(' ').trim()

    if (!text) {
        return await m.reply(
            `*Brat Girl Sticker*\n\n` +
            `Enter the text you want to turn into a Brat girl sticker.\n\n` +
            `Example:\n` +
            `${usedPrefix}${command} Example`
        )
    }

    const apiUrl = `https://api.deline.web.id/maker/cewekbrat?text=${encodeURIComponent(text)}`

    const imageBuffer = await fetchBuffer(apiUrl)
    const stickerBuffer = await createSticker(imageBuffer)
    
    return await conn.sendMessage(m.chat, { sticker: stickerBuffer }, { quoted: m })

}

handler.help = ['bratg <text>']
handler.tags = ['tools']
handler.command = ['bratg']

export default handler