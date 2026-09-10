import { Sticker, StickerTypes } from 'wa-sticker-formatter'
import { getConfig } from '../utils/myfunction.js'

/**
 * Creates WhatsApp sticker buffer from Image or Video
 * @param {Buffer} mediaBuffer 
 * @param {object} customOptions 
 * @returns {Promise<Buffer>}
 */
export async function createSticker(mediaBuffer, customOptions = {}) {
  const config = getConfig()
  const packname = customOptions.pack || config.stickerData?.packname || 'Marimo'
  const author = customOptions.author || config.stickerData?.author || 'habNoir'

  const sticker = new Sticker(mediaBuffer, {
    pack: packname,
    author: author,
    type: StickerTypes.FULL, // Gambar full tanpa terpotong (no crop)
    quality: 60,             // Kualitas sedang (optimal untuk gambar & video agar ukuran < 1MB)
    background: '#00000000'
  })

  return await sticker.toBuffer()
}

export default {
  createSticker
}