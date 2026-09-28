import { generateWAMessageFromContent } from '@rexxhayanasi/elaina-baileys'
import { getConfig } from '../../utils/myfunction.js'

const ALLOWED_TYPES = ['list', 'buttons', 'card', 'interactive', 'location', 'contact', 'newsletter', 'order']

const handler = async (m, { conn, args, text, usedPrefix, command }) => {
  // 1. GUARD — contextual explanation when type or input is missing.
  if (!text || args.length === 0) {
    return await m.reply(
      `*Create Relay Message (CRM)*\n\n` +
      `Generate and transmit raw WhatsApp relay messages (List, Buttons, Native Flow Card, Location, VCard Contact, Newsletter Forward, and Order).\n\n` +
      `Format: ${usedPrefix}${command} <type> [text]\n\n` +
      `*Available Relay Types:*\n` +
      `- list       : Interactive List Message with sections and rows\n` +
      `- buttons    : Quick Reply Action Buttons\n` +
      `- card       : Native Flow Interactive Card\n` +
      `- location   : Custom Location Pin with coordinates\n` +
      `- contact    : VCard Contact Card\n` +
      `- newsletter : Channel Forwarded Card with custom newsletter ID\n` +
      `- order      : Product / Catalog Order Message\n\n` +
      `Example:\n` +
      `${usedPrefix}${command} buttons Hello World`
    )
  }

  // 2. VALIDATE — contextual explanation when an invalid relay type is specified.
  const type = (args[0] || '').toLowerCase()
  const payload = args.slice(1).join(' ').trim()

  if (!ALLOWED_TYPES.includes(type)) {
    return await m.reply(
      `*Invalid Relay Type*\n\n` +
      `The specified type "${type}" is not supported.\n\n` +
      `*Supported Relay Types:*\n` +
      `- ${ALLOWED_TYPES.join('\n- ')}\n\n` +
      `Example:\n` +
      `${usedPrefix}${command} list`
    )
  }

  // 3. WORK — construct raw relay message structure based on selected type.
  const config = getConfig()
  let msgContent = null

  if (type === 'list') {
    msgContent = {
      listMessage: {
        title: '*CRM Interactive List*',
        description: payload || 'Select an option from the menu below.',
        buttonText: 'Click to View Options',
        listType: 1,
        sections: [
          {
            title: 'Bot System Navigation',
            rows: [
              { title: 'Main Menu', rowId: `${usedPrefix}menu`, description: 'View all bot commands' },
              { title: 'System Stats', rowId: `${usedPrefix}stats`, description: 'View server resource usage' }
            ]
          },
          {
            title: 'Media Tools',
            rows: [
              { title: 'Sticker Maker', rowId: `${usedPrefix}sticker`, description: 'Convert image/video to sticker' },
              { title: 'Read View-Once', rowId: `${usedPrefix}rvo`, description: 'Reveal view-once media' }
            ]
          }
        ]
      }
    }
  } else if (type === 'buttons') {
    msgContent = {
      buttonsMessage: {
        contentText: payload || 'This is a test Relay Message with Interactive Quick Reply Buttons.',
        footerText: `${config.botName || 'habNoir'} - CRM Engine`,
        buttons: [
          { buttonId: `${usedPrefix}menu`, buttonText: { displayText: '📋 Main Menu' }, type: 1 },
          { buttonId: `${usedPrefix}stats`, buttonText: { displayText: '📊 System Stats' }, type: 1 }
        ],
        headerType: 1
      }
    }
  } else if (type === 'card' || type === 'interactive') {
    msgContent = {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            body: { text: payload || 'Custom Interactive Relay Card Message' },
            footer: { text: `${config.botName || 'habNoir'} v${config.botVersion || '1.5'}` },
            header: {
              title: '*Interactive Card Header*',
              hasVideoPlayback: false
            },
            nativeFlowMessage: {
              buttons: [
                {
                  name: 'quick_reply',
                  buttonParamsJson: JSON.stringify({
                    display_text: 'Open Menu',
                    id: `${usedPrefix}menu`
                  })
                },
                {
                  name: 'cta_url',
                  buttonParamsJson: JSON.stringify({
                    display_text: 'Official Channel',
                    url: `https://whatsapp.com/channel/${config.channelID || ''}`
                  })
                }
              ]
            }
          }
        }
      }
    }
  } else if (type === 'location') {
    msgContent = {
      locationMessage: {
        degreesLatitude: -6.2088,
        degreesLongitude: 106.8456,
        name: payload || 'Monumen Nasional (Monas)',
        address: 'Jakarta Pusat, DKI Jakarta, Indonesia'
      }
    }
  } else if (type === 'contact') {
    const contactName = payload || config.ownerName || 'habNoir'
    const contactNum = m.senderNumber || '628138174768'
    const vcard =
      `BEGIN:VCARD\n` +
      `VERSION:3.0\n` +
      `N:${contactName};;;;\n` +
      `FN:${contactName}\n` +
      `ORG:${config.botName || 'habNoir'} Developer;\n` +
      `TEL;type=CELL;type=VOICE;waid=${contactNum}:${contactNum}\n` +
      `END:VCARD`

    msgContent = {
      contactMessage: {
        displayName: contactName,
        vcard
      }
    }
  } else if (type === 'newsletter') {
    msgContent = {
      extendedTextMessage: {
        text: payload || 'This message is relayed with custom forwarded Newsletter Channel metadata.',
        contextInfo: {
          isForwarded: true,
          forwardingScore: 9999,
          forwardedNewsletterMessageInfo: {
            newsletterJid: config.channelID || '120363429995207955@newsletter',
            newsletterName: `${config.botName || 'habNoir'} - Official`,
            serverMessageId: 1
          }
        }
      }
    }
  } else if (type === 'order') {
    msgContent = {
      orderMessage: {
        orderId: `ORD-${Date.now()}`,
        thumbnail: Buffer.alloc(0),
        itemCount: 1,
        status: 1,
        surface: 1,
        message: payload || 'Sample Product Order Relay Message',
        orderTitle: `${config.botName || 'habNoir'} Premium Services`,
        sellerJid: conn.user.id,
        totalAmount1000: 50000000,
        totalCurrencyCode: 'IDR'
      }
    }
  }

  const generatedMsg = generateWAMessageFromContent(m.chat, msgContent, { quoted: m, userJid: conn.user.id })

  // 4. DELIVER — return the send call.
  return await conn.relayMessage(m.chat, generatedMsg.message, { messageId: generatedMsg.key.id })
}

handler.help = ['crm <type> [text]']
handler.tags = ['tools']
handler.command = ['crm', 'createrelay', 'relaymsg']

export default handler
