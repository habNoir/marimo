import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  prepareWAMessageMedia,
  generateWAMessageFromContent
} from '@rexxhayanasi/elaina-baileys'
import {
  getSystemInfo,
  getTimeInfo,
  getConfig,
  formatSize
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

function getPathSize(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return formatSize(fs.statSync(filePath).size)
    }
  } catch {}
  return '0 B'
}

const handler = async (m, { conn }) => {
  const start = Date.now()
  const config = getConfig()
  const sys = getSystemInfo()
  const time = getTimeInfo()
  const procMem = process.memoryUsage()
  const latency = Date.now() - start

  const totalUsers = store.getUsersCount()
  const totalBlacklists = store.getBlacklistCount()
  const totalGroups = store.getGroupsCount()
  const totalContacts = store.getContactsCount()

  const sessionDbSize = getPathSize('./database/session/session.db')
  const crmDbSize = getPathSize('./database/crmdb.db')

  const totalMemBytes = os.totalmem()
  const freeMemBytes = os.freemem()
  const usedMemBytes = totalMemBytes - freeMemBytes
  const ramUsagePct = ((usedMemBytes / totalMemBytes) * 100).toFixed(1)

  const loadAvg = os.loadavg()
  const loadStr = loadAvg[0] > 0 ? loadAvg.map((n) => n.toFixed(2)).join(', ') : 'N/A (Windows Kernel)'

  const botBox = box(`${config.botName} System Profile`, [
    `Bot Name     : ${config.botName}`,
    `Bot Version  : v${config.botVersion}`,
    `Bot Owner    : ${config.ownerName || 'habNoir'}`,
    `Bot Uptime   : ${sys.uptime}`,
    `Host Uptime  : ${sys.osUptime}`,
    `Ping Latency : ${latency} ms`,
    `Active Prefix: ${config.prefix?.single || '!'}`,
    `Day & Time   : ${time.dayName}, ${time.timeString}`,
    `Date         : ${time.dateString}`
  ])

  const dbBox = box('Database & Storage Metrics', [
    `Registered   : ${totalUsers} Users`,
    `Blacklists   : ${totalBlacklists} Targets`,
    `Active Groups: ${totalGroups} Groups`,
    `Saved Contact: ${totalContacts} Contacts`,
    `Session DB   : ${sessionDbSize}`,
    `CRM Store DB : ${crmDbSize}`
  ])

  const memBox = box('Process & Memory Footprint', [
    `Node.js      : ${sys.nodeVersion}`,
    `Process RSS  : ${sys.rss}`,
    `Heap Used    : ${sys.heapUsed}`,
    `Heap Total   : ${formatSize(procMem.heapTotal)}`,
    `External Mem : ${formatSize(procMem.external)}`,
    `ArrayBuffers : ${formatSize(procMem.arrayBuffers || 0)}`
  ])

  const systemBox = box('Server Infrastructure Specs', [
    `Engine       : ${sys.baileysName} (v${sys.baileyVersion})`,
    `OS Platform  : ${sys.type} ${sys.release} (${sys.arch})`,
    `CPU Model    : ${sys.cpuModel}`,
    `CPU Topology : ${sys.cpuCores} Cores`,
    `System Load  : ${loadStr}`,
    `RAM Usage    : ${sys.usedRam} / ${sys.totalRam} (${ramUsagePct}%)`,
    `Free Memory  : ${sys.freeRam}`
  ])

  const caption = `${botBox}\n\n${dbBox}\n\n${memBox}\n\n${systemBox}`

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
handler.command = ['stats', 'botstats', 'status', 'ping']

export default handler
