import { getContentType } from '@rexxhayanasi/elaina-baileys'
import { detectViewOnce, getMessageContent } from './myfunction.js'

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m'
}

export const logger = {
  success: (text) => console.log(`${c.green}[+]  Success${c.reset}    ${c.dim}➜${c.reset} ${text}`),
  failed:  (text) => console.log(`${c.red}[-]  Failed${c.reset}     ${c.dim}➜${c.reset} ${text}`),
  warn:    (text) => console.log(`${c.yellow}[!]  Warning${c.reset}    ${c.dim}➜${c.reset} ${text}`),
  info:    (text) => console.log(`${c.cyan}[*]  Info${c.reset}       ${c.dim}➜${c.reset} ${text}`),
  process: (text) => console.log(`${c.magenta}[~]  Processing${c.reset} ${c.dim}➜${c.reset} ${text}`),
  running: (text) => console.log(`${c.white}[>]  Running${c.reset}    ${c.dim}➜${c.reset} ${text}`),

  error: (title, err) => {
    console.log(`\n${c.red}┌─ [-]  CRITICAL EXCEPTION ────────────────────────────────────${c.reset}`)
    console.log(`${c.gray}│${c.reset}  Context ➜ ${c.yellow}${title}${c.reset}`)
    console.log(`${c.gray}│${c.reset}  Message ➜ ${c.red}${err?.message || err}${c.reset}`)
    if (err?.stack) {
      const stackLines = err.stack.split('\n').slice(1, 4)
      for (const line of stackLines) {
        console.log(`${c.gray}│${c.reset}  ${c.dim}${line.trim()}${c.reset}`)
      }
    }
    console.log(`${c.red}└─────────────────────────────────────────────────────────────┘${c.reset}\n`)
  },

  banner: () => {
    console.clear()
    console.log(`${c.gray}┌─────────────────────────────────────────────────────────────┐${c.reset}`)
    console.log(`${c.gray}│${c.reset}  ${c.bold}${c.white}◈ habNoir${c.reset} ${c.dim}v1.5${c.reset}                                          ${c.gray}│${c.reset}`)
    console.log(`${c.gray}│${c.reset}  ${c.cyan}✦ WhatsApp Multi-Device Autonomous Core Engine${c.reset}             ${c.gray}│${c.reset}`)
    console.log(`${c.gray}│${c.reset}  ${c.dim}Built on Elaina-Baileys Modernized Socket Architecture${c.reset}     ${c.gray}│${c.reset}`)
    console.log(`${c.gray}└─────────────────────────────────────────────────────────────┘${c.reset}\n`)
  },

  pairingCode: (phoneNumber, code) => {
    const formattedCode = code?.match(/.{1,4}/g)?.join(' - ') || code
    console.log(`${c.gray}┌─────────────────────────────────────────────────────────────┐${c.reset}`)
    console.log(`${c.gray}│${c.reset}  ${c.bold}${c.white}❖ WHATSAPP PAIRING CODE${c.reset}                                    ${c.gray}│${c.reset}`)
    console.log(`${c.gray}├─────────────────────────────────────────────────────────────┤${c.reset}`)
    console.log(`${c.gray}│${c.reset}  Target : ${c.cyan}+${phoneNumber}${c.reset}${' '.repeat(Math.max(0, 48 - phoneNumber.length))} ${c.gray}│${c.reset}`)
    console.log(`${c.gray}│${c.reset}  Code   : ${c.bold}${c.green}${formattedCode}${c.reset}${' '.repeat(Math.max(0, 48 - formattedCode.length))} ${c.gray}│${c.reset}`)
    console.log(`${c.gray}├─────────────────────────────────────────────────────────────┤${c.reset}`)
    console.log(`${c.gray}│${c.reset}  ${c.dim}Open WhatsApp ❯ Linked Devices ❯ Link with phone number${c.reset}    ${c.gray}│${c.reset}`)
    console.log(`${c.gray}└─────────────────────────────────────────────────────────────┘${c.reset}\n`)
  },

  connected: (botJid) => {
    console.log(`\n${c.gray}┌─────────────────────────────────────────────────────────────┐${c.reset}`)
    console.log(`${c.gray}│${c.reset}  ${c.bold}${c.green}[+]  STATUS : CONNECTED${c.reset}                                    ${c.gray}│${c.reset}`)
    console.log(`${c.gray}│${c.reset}  Client : ${c.white}habNoir v1.5${c.reset}                                        ${c.gray}│${c.reset}`)
    console.log(`${c.gray}│${c.reset}  ID     : ${c.cyan}${botJid}${c.reset}${' '.repeat(Math.max(0, 50 - botJid.length))} ${c.gray}│${c.reset}`)
    console.log(`${c.gray}│${c.reset}  Core   : ${c.dim}Socket active & dispatching event payloads${c.reset}          ${c.gray}│${c.reset}`)
    console.log(`${c.gray}└─────────────────────────────────────────────────────────────┘${c.reset}\n`)
  },

  message: (m, sock, groupMetadata = null) => {
    const key = m.key || {}
    const remoteJid = key.remoteJid || ''
    if (remoteJid === 'status@broadcast') return

    const isViewOnce = detectViewOnce(m)
    const voBadge = isViewOnce ? `${c.bold}${c.magenta}[VIEW ONCE / 1X]${c.reset} ` : ''

    let chatType = 'Private Chat'
    if (remoteJid.endsWith('@g.us')) chatType = 'Group Chat'
    else if (remoteJid.endsWith('@newsletter')) chatType = 'Newsletter / Channel'
    else if (remoteJid.endsWith('@broadcast')) chatType = 'Broadcast'

    const isFromMe = Boolean(key.fromMe)
    const direction = isFromMe ? `${c.magenta}[Outgoing / Self]${c.reset}` : `${c.cyan}[Incoming]${c.reset}`

    let senderJid = isFromMe
      ? (sock?.user?.id || 'bot@s.whatsapp.net')
      : (chatType === 'Group Chat' ? key.participant : remoteJid)

    let phoneNumber = 'N/A'
    let lidAddress = 'N/A'

    if (senderJid && senderJid.endsWith('@s.whatsapp.net')) {
      phoneNumber = '+' + senderJid.split('@')[0].split(':')[0]
      lidAddress = key.participantAlt || key.remoteJidAlt || 'N/A'
    } else if (senderJid && senderJid.endsWith('@lid')) {
      lidAddress = senderJid
      const alt = key.participantAlt || key.remoteJidAlt
      if (alt && alt.endsWith('@s.whatsapp.net')) {
        phoneNumber = '+' + alt.split('@')[0].split(':')[0]
      }
    }

    const pushName = isFromMe ? (sock?.user?.name || 'habNoir Bot') : (m.pushName || 'Anonymous')
    const content = getMessageContent(m) || {}
    const rawContent = m.message || {}
    const contentType = getContentType(content) || (isViewOnce ? 'viewOnceMessage' : 'Unknown Type')

    let displayType = (isViewOnce && !contentType.includes('viewOnce') ? 'viewOnceMessage ➜ ' : '') + contentType
    let textPayload = ''
    let extraDetails = []

    if (rawContent?.protocolMessage || content?.protocolMessage) {
      const proto = rawContent?.protocolMessage || content?.protocolMessage
      if (proto.type === 0 || proto.type === 'REVOKE') {
        displayType = 'protocolMessage ➜ REVOKE'
        textPayload = `${c.red}✖ [Message Deleted / Revoked by Sender]${c.reset}`
        extraDetails.push(`Target ID : ${proto.key?.id || 'Unknown'}`)
      } else if (proto.type === 14) {
        displayType = 'protocolMessage ➜ EDIT'
        textPayload = `${c.yellow}✎ [Message Edited]${c.reset}`
      } else {
        return
      }
    } else if (rawContent?.reactionMessage || content?.reactionMessage) {
      const reaction = rawContent?.reactionMessage || content?.reactionMessage
      displayType = 'reactionMessage'
      const emoji = reaction.text || `${c.dim}(Reaction Removed)${c.reset}`
      textPayload = `${c.yellow}[Reaction]${c.reset} ${emoji}`
      extraDetails.push(`Target ID : ${reaction.key?.id || 'Unknown'}`)
    } else if (content?.imageMessage) {
      textPayload = `${voBadge}${c.green}[Photo / Image]${c.reset}`
      if (content.imageMessage.caption) extraDetails.push(`Caption   : "${content.imageMessage.caption}"`)
    } else if (content?.videoMessage) {
      const isGif = content.videoMessage.gifPlayback ? ' (GIF)' : ''
      textPayload = `${voBadge}${c.green}[Video${isGif}]${c.reset}`
      if (content.videoMessage.caption) extraDetails.push(`Caption   : "${content.videoMessage.caption}"`)
    } else if (content?.audioMessage) {
      const isVoice = content.audioMessage.ptt ? ' [Voice Note / PTT]' : ' [Audio File]'
      textPayload = `${voBadge}${c.magenta}${isVoice}${c.reset} ${c.dim}(${content.audioMessage.seconds || 0}s)${c.reset}`
    } else if (content?.stickerMessage) {
      displayType = 'stickerMessage'
      textPayload = `${c.yellow}[Sticker]${c.reset} ${content.stickerMessage.isAnimated ? '(Animated)' : '(Static)'}`
    } else if (content?.documentMessage) {
      displayType = 'documentMessage'
      const fileName = content.documentMessage.fileName || 'Untitled Document'
      textPayload = `${c.cyan}[Document: ${fileName}]${c.reset}`
      if (content.documentMessage.caption) extraDetails.push(`Caption   : "${content.documentMessage.caption}"`)
    } else if (content?.conversation || content?.extendedTextMessage?.text) {
      const txt = content.conversation || content.extendedTextMessage.text
      textPayload = `${voBadge}${txt}`
    } else if (isViewOnce) {
      textPayload = `${voBadge}${c.yellow}[Encrypted View Once Media Payload]${c.reset}`
      if (m.messageStubParameters) {
        extraDetails.push(`Stub Info : ${m.messageStubParameters.join(', ')}`)
      }
    }

    if (!textPayload && extraDetails.length === 0) return

    const time = new Date().toLocaleTimeString()
    console.log(`${c.gray}┌─${c.reset} ${c.cyan}[*]  EVENT${c.reset} ${c.dim}➜${c.reset} ${direction} ${c.dim}↔${c.reset} ${c.white}${chatType}${c.reset} ${c.gray}[${time}]${c.reset}`)
    console.log(`${c.gray}│${c.reset}  User    ${c.dim}➜${c.reset} ${c.bold}${pushName}${c.reset}`)
    console.log(`${c.gray}│${c.reset}  Phone   ${c.dim}➜${c.reset} ${c.green}${phoneNumber}${c.reset}`)
    console.log(`${c.gray}│${c.reset}  LID     ${c.dim}➜${c.reset} ${c.dim}${lidAddress}${c.reset}`)
    
    if (chatType === 'Group Chat') {
      const groupName = groupMetadata?.subject || 'Resolving Subject...'
      console.log(`${c.gray}│${c.reset}  Group   ${c.dim}➜${c.reset} ${c.yellow}${groupName}${c.reset} ${c.dim}(${remoteJid})${c.reset}`)
    } else if (chatType === 'Newsletter / Channel') {
      console.log(`${c.gray}│${c.reset}  Channel ${c.dim}➜${c.reset} ${c.yellow}${remoteJid}${c.reset}`)
    }

    console.log(`${c.gray}│${c.reset}  Type    ${c.dim}➜${c.reset} ${c.magenta}${displayType}${c.reset}`)
    console.log(`${c.gray}│${c.reset}  Payload ${c.dim}➜${c.reset} ${textPayload}`)
    for (const detail of extraDetails) {
      console.log(`${c.gray}│${c.reset}  ${detail}`)
    }
    console.log(`${c.gray}└─────────────────────────────────────────────────────────────┘${c.reset}\n`)
  },

  command: (m, { command, usedPrefix, args = [], groupMetadata = null }) => {
    const time = new Date().toLocaleTimeString()
    const chatType = m.isGroup ? 'Group Chat' : 'Private Chat'
    const targetGroup = m.isGroup ? `${groupMetadata?.subject || 'Group'} (${m.chat})` : 'Direct Message'
    const argumentText = args.length ? `[${args.join(', ')}]` : `${c.dim}(none)${c.reset}`

    console.log(`${c.green}┌─ [>]  COMMAND TRIGGERED ────────────────────────────────────${c.reset}`)
    console.log(`${c.gray}│${c.reset}  Trigger ➜ ${c.bold}${c.green}${usedPrefix}${command}${c.reset}`)
    console.log(`${c.gray}│${c.reset}  Caller  ➜ ${c.bold}${c.white}${m.pushName}${c.reset} ${c.dim}(+${m.senderNumber})${c.reset}`)
    console.log(`${c.gray}│${c.reset}  LID     ➜ ${c.dim}${m.key?.participantAlt || m.key?.remoteJidAlt || 'N/A'}${c.reset}`)
    console.log(`${c.gray}│${c.reset}  Context ➜ ${c.cyan}${chatType}${c.reset} ${c.dim}➜${c.reset} ${c.yellow}${targetGroup}${c.reset}`)
    console.log(`${c.gray}│${c.reset}  Params  ➜ ${argumentText}`)
    console.log(`${c.gray}│${c.reset}  Time    ➜ ${c.gray}${time}${c.reset}`)
    console.log(`${c.green}└─────────────────────────────────────────────────────────────┘${c.reset}\n`)
  }
}

export default logger
