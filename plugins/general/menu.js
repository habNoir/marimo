import fs from 'node:fs'
import path from 'node:path'
import {
  prepareWAMessageMedia,
  generateWAMessageFromContent
} from '@rexxhayanasi/elaina-baileys'
import {
  getSystemInfo,
  getTimeInfo,
  getConfig,
  getAudioDuration
} from '../../utils/myfunction.js'

// ─── RAM CACHE: BUFFER & PRE-UPLOADED CDN TOKEN ───────────────────────────────
let cachedVideoBuffer = null
let cachedAudioBuffer = null
let cachedAudioDuration = 0
let preUploadedVideo = null
let preUploadedAudio = null

const box = (title, rows) => {
  let text = `╭──⊷ ${title}\n│\n`
  for (const row of rows) {
    text += `│ ▢ ${row}\n`
  }
  text += `╰────────────⊷`
  return text
}

const handler = async (m, { conn, args, usedPrefix, plugins }) => {
  const config = getConfig()
  const sys = getSystemInfo()
  const time = getTimeInfo()

  const pluginsRoot = './plugins'
  let categories = []

  if (fs.existsSync(pluginsRoot)) {
    categories = fs
      .readdirSync(pluginsRoot, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name.toLowerCase())
  }

  const categoryMap = new Map()
  for (const cat of categories) {
    categoryMap.set(cat, [])
  }

  for (const [pluginPath, module] of plugins.entries()) {
    const fn = module.default || module
    const rawCmd = fn.command || module.command
    if (!rawCmd) continue

    const relativePath = path.relative(pluginsRoot, pluginPath)
    const folderCategory = relativePath.split(path.sep)[0]?.toLowerCase()

    if (folderCategory && categoryMap.has(folderCategory)) {
      const cmdList = Array.isArray(rawCmd) ? rawCmd : [rawCmd]
      const stringCmds = cmdList.filter((c) => typeof c === 'string')
      categoryMap.get(folderCategory).push(...stringCmds)
    }
  }

  const requestedCategory = args[0]?.toLowerCase()

  // ─── PER-CATEGORY VIEW (.menu <category>) ─────────────────────────────────
  if (requestedCategory && categoryMap.has(requestedCategory)) {
    const cmds = [...new Set(categoryMap.get(requestedCategory))]
    const catTitle = requestedCategory.charAt(0).toUpperCase() + requestedCategory.slice(1)

    const rows = cmds.length === 0
      ? ['(no commands yet)']
      : cmds.map((cmd) => `${usedPrefix}${cmd}`)

    return await m.reply(box(`${catTitle} Menu`, rows))
  }

  // ─── MAIN VIEW (.menu) ──────────────────────────────────────────────────────
  const prefixMode = config.prefix?.multi
    ? `Multi [ ${config.prefix.list.join(' , ')} ]`
    : `Single [ ${config.prefix.single} ]`

  const botBox = box(config.botName, [
    `Bot Name  : ${config.botName}`,
    `Version   : ${config.botVersion}`,
    `Prefix    : ${prefixMode}`,
    `Runtime   : ${sys.uptime}`,
    `Time      : ${time.timeString}`,
    `Date      : ${time.dateString}`
  ])

  const systemBox = box('System Info', [
    `Baileys   : ${sys.baileyVersion}`,
    `Package   : ${sys.baileysName}`,
    `Platform  : ${sys.type} (${sys.arch})`,
    `CPU Model : ${sys.cpuModel}`,
    `CPU Cores : ${sys.cpuCores} Cores`,
    `Memory    : ${sys.usedRam} / ${sys.totalRam}`,
    `Node.js   : ${sys.nodeVersion}`
  ])

  const menuBox = box('Menu Categories', categories.map((cat) => `${usedPrefix}menu ${cat}`))

  const caption = `${botBox}\n\n${systemBox}\n\n${menuBox}`

  const mediaDir = './media'

  // 1. Muat buffer video ke RAM jika belum ada
  if (!cachedVideoBuffer) {
    const targetVideo = [
      path.join(mediaDir, 'menu_gif.mp4'),
      path.join(mediaDir, 'menu.mp4')
    ].find((p) => fs.existsSync(p))

    if (targetVideo) {
      cachedVideoBuffer = fs.readFileSync(targetVideo)
    }
  }

  // 2. Muat buffer audio ke RAM jika belum ada
  if (!cachedAudioBuffer) {
    const targetAudio = [
      path.join(mediaDir, 'menu_voice.ogg'),
      path.join(mediaDir, 'menu.opus')
    ].find((p) => fs.existsSync(p))

    if (targetAudio) {
      cachedAudioBuffer = fs.readFileSync(targetAudio)
      cachedAudioDuration = await getAudioDuration(targetAudio)
    }
  }

  // ─── KIRIM VIDEO INSTAN VIA PRE-UPLOAD CACHE ──────────────────────────────
  if (cachedVideoBuffer) {
    if (!preUploadedVideo) {
      const media = await prepareWAMessageMedia(
        { video: cachedVideoBuffer, gifPlayback: true },
        { upload: conn.waUploadToServer }
      )
      preUploadedVideo = media.videoMessage
    }

    const videoMsg = generateWAMessageFromContent(
      m.chat,
      {
        videoMessage: {
          ...preUploadedVideo,
          caption: caption,
          contextInfo: {
            isForwarded: true,
            forwardingScore: 9999,
            forwardedNewsletterMessageInfo: {
              newsletterJid: config.channelID,
              newsletterName: `${config.botName} - v${config.botVersion}`,
              serverMessageId: 1
            }
          }
        }
      },
      { userJid: conn.user.id, quoted: m }
    )

    await conn.relayMessage(m.chat, videoMsg.message, { messageId: videoMsg.key.id })
  } else {
    await m.reply(caption)
  }

  // ─── KIRIM AUDIO PTT INSTAN VIA PRE-UPLOAD CACHE ──────────────────────────
  if (cachedAudioBuffer) {
    if (!preUploadedAudio) {
      const media = await prepareWAMessageMedia(
        {
          audio: cachedAudioBuffer,
          mimetype: 'audio/ogg; codecs=opus',
          ptt: true
        },
        { upload: conn.waUploadToServer }
      )
      preUploadedAudio = media.audioMessage
    }

    const audioMsg = generateWAMessageFromContent(
      m.chat,
      {
        audioMessage: {
          ...preUploadedAudio,
          seconds: cachedAudioDuration || preUploadedAudio.seconds || 0
        }
      },
      { userJid: conn.user.id }
    )

    await conn.relayMessage(m.chat, audioMsg.message, { messageId: audioMsg.key.id })
  }
}

handler.help = ['menu']
handler.tags = ['general']
handler.command = ['menu', 'help']

export default handler