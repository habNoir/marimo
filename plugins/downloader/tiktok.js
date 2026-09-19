import { fetchBuffer } from '../../utils/myfunction.js'

async function getTikTokMedia(url, mode) {
  // 1. Try ssstik.io scraping first
  const pageRes = await fetch('https://ssstik.io/id', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  })
  const html = await pageRes.text()
  const ttMatch = html.match(/s_tt\s*=\s*'([^']+)'/)
  const tt = ttMatch ? ttMatch[1] : 'WE5QTnFl'

  const params = new URLSearchParams()
  params.append('id', url)
  params.append('locale', 'id')
  params.append('tt', tt)

  const postRes = await fetch('https://ssstik.io/abc?url=dl', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'HX-Request': 'true',
      'HX-Trigger': '_gcaptcha_pt',
      'HX-Target': 'target',
      'HX-Current-URL': 'https://ssstik.io/id'
    },
    body: params.toString()
  })

  const resultHtml = await postRes.text()

  let mediaUrl = null
  let title = ''

  const titleMatch = resultHtml.match(/<p class="maintext">([^<]+)<\/p>/)
  if (titleMatch) title = titleMatch[1].trim()

  if (mode === 'mp3') {
    const audioMatch = resultHtml.match(/href="(https:\/\/[^"]+)"[^>]*>(?:[^\n<]*download mp3|unduh mp3)/i) || resultHtml.match(/href="(https:\/\/[^"]+mp3[^"]*)"/i)
    if (audioMatch) mediaUrl = audioMatch[1]
  } else {
    const videoMatch = resultHtml.match(/href="(https:\/\/[^"]+)"[^>]*>(?:[^\n<]*without watermark|tanpa tanda air)/i) || resultHtml.match(/href="(https:\/\/tikcdn[^"]+)"/i) || resultHtml.match(/href="(https:\/\/ssstik\.io\/ssstik[^"]+)"/i)
    if (videoMatch) mediaUrl = videoMatch[1]
  }

  // 2. Fallback to TikWM API if ssstik.io direct scrape yields no media URL
  if (!mediaUrl) {
    const tikRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`)
    const tikJson = await tikRes.json()
    if (tikJson.code === 0 && tikJson.data) {
      title = title || tikJson.data.title || ''
      if (mode === 'mp3') {
        mediaUrl = tikJson.data.music || tikJson.data.music_info?.play
      } else {
        mediaUrl = tikJson.data.play || tikJson.data.wmplay || tikJson.data.hdplay
      }
    }
  }

  if (!mediaUrl) {
    throw new Error('Failed to retrieve TikTok media download URL.')
  }

  return { mediaUrl, title }
}

const handler = async (m, { conn, args, text, command, usedPrefix }) => {
  const mode = (args[0] || '').toLowerCase()
  const url = args[1] || ''

  if (!mode || !['mp3', 'mp4'].includes(mode) || !url) {
    return await m.reply(
      `*TikTok Downloader*\n\n` +
      `Format: ${usedPrefix}${command} <mp3/mp4> <tiktok_url>\n\n` +
      `Example:\n` +
      `${usedPrefix}${command} mp4 https://vt.tiktok.com/ZSjXxQYXX/`
    )
  }

  const { mediaUrl, title } = await getTikTokMedia(url, mode)
  const buffer = await fetchBuffer(mediaUrl)

  if (mode === 'mp3') {
    return await conn.sendMessage(
      m.chat,
      {
        audio: buffer,
        mimetype: 'audio/mp4',
        ptt: false
      },
      { quoted: m }
    )
  }

  return await conn.sendMessage(
    m.chat,
    {
      video: buffer,
      caption: title ? `*TikTok Video*\n\n${title}` : '*TikTok Video*'
    },
    { quoted: m }
  )
}

handler.help = ['tt <mp3|mp4> <url>']
handler.tags = ['downloader']
handler.command = ['tt', 'tiktok', 'ttdl']

export default handler
