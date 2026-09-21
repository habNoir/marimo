import fs from 'node:fs'
import path from 'node:path'
import {
  prepareWAMessageMedia,
  generateWAMessageFromContent
} from '@rexxhayanasi/elaina-baileys'
import {
  getSystemInfo,
  getTimeInfo,
  getConfig
} from '../../utils/myfunction.js'
import store from '../../utils/store.js'

let cachedVideoBuffer = null
let preUploadedVideo = null

const box = (title, rows) => {
  let text = `╭──⇒ ${title}\n│\n`
  for (const row of rows) {
    text += `│ ⇒ ${row}\n`
  }
  text += `╰────────────⇒`
  return text
}

const handler = async (m, { conn }) => {
  const config = getConfig()
  const sys = getSystemInfo()
  const time = getTimeInfo()

  const totalUsers = store.getUsersCount()
  const totalBlacklists = store.getBlacklistCount()
  const totalGroups = store.getGroupsCount()
  const totalContacts = store.getContactsCount()

  const botBox = box(`${config.botName} Statistics`, [
    `Bot Name     : ${config.botName}`,
    `Version      : ${config.botVersion}`,
    `Uptime       : ${sys.uptime}`,
    `Registered   : ${totalUsers} users`,
    `Blacklisted  : ${totalBlacklists} targets`,
    `Groups       : ${totalGroups} groups`,
    `Contacts     : ${totalContacts} contacts`,
    `Time         : ${time.timeString}`,
    `Date         : ${time.dateString}`
  ])

  const systemBox = box('Server Infrastructure', [
    `Baileys      : ${sys.baileyVersion}`,
    `Package      : ${sys.baileysName}`,
    `Platform     : ${sys.type} (${sys.arch})`,
    `CPU Model    : ${sys.cpuModel}`,
    `CPU Cores    : ${sys.cpuCores} Cores`,
    `RAM Usage    : ${sys.usedRam} / ${sys.totalRam}`,
    `Node.js      : ${sys.nodeVersion}`
  ])

  const caption = `${botBox}\n\n${systemBox}`

  const mediaDir = './media'

  if (!cachedVideoBuffer) {
    const targetVideo = [
      path.join(mediaDir, 'menu_gif.mp4'),
      path.join(mediaDir, 'menu.mp4')
    ].find((p) => fs.existsSync(p))

    if (targetVideo) {
      cachedVideoBuffer = fs.readFileSync(targetVideo)
    }
  }

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

    return await conn.relayMessage(m.chat, videoMsg.message, { messageId: videoMsg.key.id })
  }

  return await m.reply(caption)
}

handler.help = ['stats']
handler.tags = ['general']
handler.command = ['stats', 'botstats', 'status']

export default handler
