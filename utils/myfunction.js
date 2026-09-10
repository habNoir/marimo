import {
  normalizeMessageContent,
  getContentType,
  jidNormalizedUser
} from '@rexxhayanasi/elaina-baileys'
import fs from 'node:fs'
import os from 'node:os'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execPromise = promisify(exec)

// ─── RESOLVE FFMPEG BINARY ────────────────────────────────────────────────────
let ffmpegCmd = 'ffmpeg'
try {
  const ffmpegModule = await import('ffmpeg-static')
  if (ffmpegModule?.default) {
    ffmpegCmd = `"${ffmpegModule.default}"`
  }
} catch {
  ffmpegCmd = 'ffmpeg'
}

export function getConfig() {
  try {
    return JSON.parse(fs.readFileSync('./config.json', 'utf8'))
  } catch {
    return {
      botName: 'habNoir',
      ownerNumbers: [],
      prefix: { multi: true, single: '!', list: ['!', '.', '/', '#'] }
    }
  }
}

export function formatRuntime(seconds) {
  seconds = Number(seconds)
  const d = Math.floor(seconds / (3600 * 24))
  const h = Math.floor((seconds % (3600 * 24)) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const dDisplay = d > 0 ? `${d}d ` : ''
  const hDisplay = h > 0 ? `${h}h ` : ''
  const mDisplay = m > 0 ? `${m}m ` : ''
  const sDisplay = `${s}s`
  return (dDisplay + hDisplay + mDisplay + sDisplay).trim()
}

export function formatSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

let cachedBaileysPkg = null
function getBaileysPkgInfo() {
  if (cachedBaileysPkg) return cachedBaileysPkg
  try {
    const pkgPath = './node_modules/@rexxhayanasi/elaina-baileys/package.json'
    if (fs.existsSync(pkgPath)) {
      const data = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
      cachedBaileysPkg = { name: data.name || 'elaina-baileys', version: data.version }
      return cachedBaileysPkg
    }
  } catch {}
  cachedBaileysPkg = { name: '@rexxhayanasi/elaina-baileys', version: 'Latest' }
  return cachedBaileysPkg
}

import { downloadContentFromMessage } from '@rexxhayanasi/elaina-baileys'

/**
 * Downloads media buffer from message node (handles both raw node and parent wrappers)
 */
export async function downloadMedia(msgNode, mediaType = 'image') {
  if (!msgNode) throw new Error('No media node provided')

  // Ekstrak node media terdalam jika masih terbungkus objek parent
  let target = msgNode
  let cleanType = mediaType.replace('Message', '')

  if (target.imageMessage) {
    target = target.imageMessage
    cleanType = 'image'
  } else if (target.videoMessage) {
    target = target.videoMessage
    cleanType = 'video'
  } else if (target.stickerMessage) {
    target = target.stickerMessage
    cleanType = 'sticker'
  } else if (target.audioMessage) {
    target = target.audioMessage
    cleanType = 'audio'
  } else if (target.documentMessage) {
    target = target.documentMessage
    cleanType = 'document'
  }

  // Validasi keberadaan directPath / url
  if (!target.directPath && !target.url) {
    throw new Error('No valid directPath or media URL found in target media node')
  }

  const stream = await downloadContentFromMessage(target, cleanType)
  let buffer = Buffer.from([])
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk])
  }
  return buffer
}

export async function fetchBuffer(url, options = {}) {
  const res = await fetch(url, options)
  if (!res.ok) {
    throw new Error(`Fetch gagal: ${res.status} ${res.statusText}`)
  }

  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export function getSystemInfo() {
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem
  const procMem = process.memoryUsage()
  const baileys = getBaileysPkgInfo()

  const cpus = os.cpus()
  const cpuModel = cpus && cpus[0] ? cpus[0].model.trim() : 'Unknown Architecture'
  const cpuCores = cpus ? cpus.length : 1

  return {
    platform: os.platform(),
    release: os.release(),
    type: os.type(),
    arch: os.arch(),
    baileyVersion: baileys.version,
    baileysName: baileys.name,
    cpuModel,
    cpuCores,
    totalRam: formatSize(totalMem),
    usedRam: formatSize(usedMem),
    freeRam: formatSize(freeMem),
    heapUsed: formatSize(procMem.heapUsed),
    rss: formatSize(procMem.rss),
    nodeVersion: process.version,
    uptime: formatRuntime(process.uptime()),
    osUptime: formatRuntime(os.uptime())
  }
}

export function getTimeInfo() {
  const now = new Date()
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ]

  const dayName = days[now.getDay()]
  const date = now.getDate()
  const monthName = months[now.getMonth()]
  const year = now.getFullYear()

  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')

  const offsetMinutes = now.getTimezoneOffset()
  const offsetSign = offsetMinutes <= 0 ? '+' : '-'
  const absOffset = Math.abs(offsetMinutes)
  const offsetHours = Math.floor(absOffset / 60)

  return {
    dayName,
    dateString: `${monthName} ${date}, ${year}`,
    timeString: `${hours}:${minutes}:${seconds} UTC${offsetSign}${offsetHours}`
  }
}

export async function convertToOpus(inputPath, outputPath) {
  try {
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath)
    }

    await execPromise(
      `${ffmpegCmd} -y -i "${inputPath}" -vn -sn -dn -map_metadata -1 -c:a libopus -b:a 48k -ar 48000 -ac 1 -avoid_negative_ts make_zero "${outputPath}"`
    )
    return outputPath
  } catch (err) {
    console.error('FFmpeg PTT Conversion Error:', err.message)
    return inputPath
  }
}

export async function getAudioDuration(filePath) {
  try {
    const { stderr } = await execPromise(`${ffmpegCmd} -i "${filePath}"`).catch((e) => e)
    const match = (stderr || '').match(/Duration:\s*(\d+):(\d+):(\d+(\.\d+)?)/i)
    if (match) {
      const hours = parseInt(match[1], 10)
      const minutes = parseInt(match[2], 10)
      const seconds = parseFloat(match[3])
      return Math.round(hours * 3600 + minutes * 60 + seconds)
    }
  } catch {}
  return 0
}

export async function convertToGifVideo(inputPath, outputPath) {
  try {
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath)
    }

    await execPromise(
      `${ffmpegCmd} -y -i "${inputPath}" -c:v copy -an "${outputPath}"`
    )
    return outputPath
  } catch (err) {
    console.error('FFmpeg Video Stream Copy Error:', err.message)
    return inputPath
  }
}

export function detectViewOnce(rawMessage) {
  if (!rawMessage) return false
  if (rawMessage.key?.isViewOnce === true || rawMessage.isViewOnce === true) return true

  const msg = rawMessage.message || rawMessage.msg || rawMessage
  if (!msg || typeof msg !== 'object') return false

  if (msg.viewOnceMessage || msg.viewOnceMessageV2 || msg.viewOnceMessageV2Extension) return true
  if (msg.ephemeralMessage?.message) return detectViewOnce(msg.ephemeralMessage.message)

  try {
    const str = JSON.stringify(msg)
    return (
      str.includes('"viewOnceMessage"') ||
      str.includes('"viewOnceMessageV2"') ||
      str.includes('"viewOnceMessageV2Extension"') ||
      str.includes('"viewOnce":true') ||
      str.includes('"viewOnce":1') ||
      str.includes('"isViewOnce":true')
    )
  } catch {
    return false
  }
}

export function getMessageContent(rawMessage) {
  if (!rawMessage) return null
  let content = rawMessage.message || rawMessage.msg || rawMessage

  let depth = 0
  while (depth < 10) {
    if (content?.ephemeralMessage?.message) {
      content = content.ephemeralMessage.message
    } else if (content?.viewOnceMessage?.message) {
      content = content.viewOnceMessage.message
    } else if (content?.viewOnceMessageV2?.message) {
      content = content.viewOnceMessageV2.message
    } else if (content?.viewOnceMessageV2Extension?.message) {
      content = content.viewOnceMessageV2Extension.message
    } else if (content?.documentWithCaptionMessage?.message) {
      content = content.documentWithCaptionMessage.message
    } else if (content?.associatedChildMessage?.message) {
      content = content.associatedChildMessage.message
    } else {
      break
    }
    depth++
  }

  return normalizeMessageContent(content) || content
}

export function smsg(sock, m) {
  if (!m) return m

  const config = getConfig()
  const key = m.key || {}
  m.chat = key.remoteJid || ''
  m.isGroup = m.chat.endsWith('@g.us')
  m.isNewsletter = m.chat.endsWith('@newsletter')
  m.isPrivate = !m.isGroup && !m.isNewsletter && m.chat !== 'status@broadcast'
  m.isFromMe = Boolean(key.fromMe)

  const botJid = jidNormalizedUser(sock.user.id)
  m.botJid = botJid
  m.sender = m.isFromMe ? botJid : (m.isGroup ? key.participant : m.chat)
  m.senderNumber = m.sender ? m.sender.replace(/[^0-9]/g, '') : ''
  m.isOwner = config.ownerNumbers.includes(m.senderNumber) || m.isFromMe
  m.pushName = m.pushName || (m.isFromMe ? config.botName : 'Anonymous')

  m.isViewOnce = detectViewOnce(m)
  m.msg = getMessageContent(m) || {}
  m.type = getContentType(m.msg) || Object.keys(m.msg || {})[0] || (m.isViewOnce ? 'viewOnceMessage' : 'unknown')

  m.body =
    m.msg?.conversation ||
    m.msg?.extendedTextMessage?.text ||
    m.msg?.imageMessage?.caption ||
    m.msg?.videoMessage?.caption ||
    m.msg?.documentMessage?.caption ||
    m.msg?.buttonsResponseMessage?.selectedButtonId ||
    m.msg?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    m.msg?.templateButtonReplyMessage?.selectedId ||
    ''

  const context = m.msg?.extendedTextMessage?.contextInfo || m.msg?.[m.type]?.contextInfo
  if (context && context.quotedMessage) {
    const quotedRaw = getMessageContent(context.quotedMessage) || {}
    const quotedType = getContentType(quotedRaw) || Object.keys(quotedRaw || {})[0]

    m.quoted = {
      key: {
        remoteJid: m.chat,
        fromMe: jidNormalizedUser(context.participant) === botJid,
        id: context.stanzaId,
        participant: context.participant
      },
      sender: jidNormalizedUser(context.participant),
      senderNumber: context.participant ? context.participant.replace(/[^0-9]/g, '') : '',
      msg: quotedRaw,
      type: quotedType,
      isViewOnce: detectViewOnce(context.quotedMessage),
      text:
        quotedRaw?.conversation ||
        quotedRaw?.extendedTextMessage?.text ||
        quotedRaw?.imageMessage?.caption ||
        quotedRaw?.videoMessage?.caption ||
        quotedRaw?.documentMessage?.caption ||
        ''
    }
  } else {
    m.quoted = null
  }

  m.react = async (text) => {
    try {
      return await sock.sendMessage(m.chat, {
        react: {
          text: text || '',
          key: m.key
        }
      })
    } catch {
      return null
    }
  }

  m.reply = async (text, options = {}) => {
    return await sock.sendMessage(m.chat, { text, ...options }, { quoted: m })
  }

  return m
}

export default {
  smsg,
  getConfig,
  detectViewOnce,
  getMessageContent,
  getSystemInfo,
  getTimeInfo,
  formatRuntime,
  formatSize,
  convertToOpus,
  getAudioDuration,
  convertToGifVideo,
  downloadMedia,
  fetchBuffer
}