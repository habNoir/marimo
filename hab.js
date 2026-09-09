// ─── SUPPRESS NOISY LIBSIGNAL SESSION DUMPS ──────────────────────────────────
const originalConsoleLog = console.log
console.log = (...args) => {
  const firstArg = typeof args[0] === 'string' ? args[0] : ''
  if (
    firstArg.includes('Closing open session in favor of incoming prekey bundle') ||
    firstArg.includes('Closing session: SessionEntry') ||
    firstArg.includes('SessionEntry {')
  ) {
    return
  }
  originalConsoleLog(...args)
}

import makeWASocket, {
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  jidNormalizedUser
} from '@rexxhayanasi/elaina-baileys'
import pino from 'pino'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import qrcode from 'qrcode-terminal'
import logger from './utils/logger.js'
import { initGlobalErrorTrap } from './utils/errorHandler.js'
import { handleMessages } from './handler.js'

// ─── MOUNT GLOBAL PROCESS ERROR INTERCEPTOR ───────────────────────────────────
initGlobalErrorTrap()

const SESSION_DIR = './session'
const PLUGINS_DIR = './plugins'
const plugins = new Map()

// ─── RECURSIVE PLUGIN LOADER ──────────────────────────────────────────────────
async function loadPlugins(dir = PLUGINS_DIR) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    return
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      await loadPlugins(fullPath)
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      try {
        const fileUrl = pathToFileURL(path.resolve(fullPath)).href + `?update=${Date.now()}`
        const module = await import(fileUrl)
        plugins.set(fullPath, module)
        logger.info(`Mounted Plugin ➜ ${entry.name}`)
      } catch (err) {
        logger.error(`Plugin Import Failure [${entry.name}]`, err)
      }
    }
  }
}

// ─── CLI PROMPT ───────────────────────────────────────────────────────────────
async function promptInput(questionText) {
  const rl = readline.createInterface({ input, output })
  try {
    return await rl.question(questionText)
  } finally {
    rl.close()
  }
}

let pairingCodeRequested = false

// ─── SOCKET CORE ──────────────────────────────────────────────────────────────
async function connectToWhatsApp(state, saveCreds, authMethod, phoneNumber) {
  const pinoLogger = pino({ level: 'silent' })

  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pinoLogger)
    },
    logger: pinoLogger,
    browser: ['Mac OS', 'Chrome', '14.4.1'],
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: false,

    // ─── SETTING KONEKSI RINGAN & BUKA AKSES SALURAN ────────────────────────
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    shouldIgnoreJid: (jid) => jid === 'status@broadcast', // Saluran (@newsletter) diizinkan
    fireInitQueries: false,
    maxRetryQueueSize: 32
  })

  sock.ev.on('creds.update', saveCreds)

  if (!state.creds.registered && authMethod === '1' && !pairingCodeRequested) {
    pairingCodeRequested = true
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(phoneNumber)
        logger.pairingCode(phoneNumber, code)
      } catch (err) {
        logger.failed(`Failed to generate pairing code: ${err.message}`)
        pairingCodeRequested = false
      }
    }, 3000)
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr && authMethod === '2' && !state.creds.registered) {
      logger.info('Scan visual QR matrix below:')
      console.log('')
      qrcode.generate(qr, { small: true })
      console.log('\n  Open WhatsApp ❯ Linked Devices ❯ Link a Device\n')
    }

    if (connection === 'connecting') {
      logger.process('Initiating cryptographic handshake with WhatsApp server...')
    }

    if (connection === 'open') {
      const botJid = jidNormalizedUser(sock.user.id)
      logger.connected(botJid)
      logger.success(`habNoir Core ready with [${plugins.size}] mounted plugins.`)
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode
      const reason = lastDisconnect?.error?.message || 'Unknown'
      const isLoggedOut = statusCode === DisconnectReason.loggedOut

      if (statusCode === DisconnectReason.restartRequired) {
        logger.info('Initial registration handshake (515: Restart Required). Reconnecting...')
      } else if (!isLoggedOut) {
        logger.warn(`Connection dropped [${statusCode || 'ERR'}] ➜ ${reason}`)
        logger.running('Re-establishing socket connection automatically...')
      }

      if (!isLoggedOut) {
        setTimeout(async () => {
          const freshAuth = await useMultiFileAuthState(SESSION_DIR)
          connectToWhatsApp(freshAuth.state, freshAuth.saveCreds, authMethod, phoneNumber)
        }, 1500)
      } else {
        logger.failed('Session revoked or logged out from device.')
        logger.info(`Purging storage directory '${SESSION_DIR}'...`)

        try {
          fs.rmSync(SESSION_DIR, { recursive: true, force: true })
          logger.success('Session cleared. Restart application to authenticate again.')
        } catch {
          logger.warn(`Please remove the '${SESSION_DIR}' folder manually.`)
        }
        process.exit(0)
      }
    }
  })

  // Messages Event Listener
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    for (const m of messages) {
      if (!m.message && !m.key?.isViewOnce) continue
      await handleMessages(sock, m, plugins)
    }
  })

  return sock
}

// ─── INITIALIZATION ───────────────────────────────────────────────────────────
async function main() {
  logger.banner()

  logger.process('Mounting system plugins from ./plugins/**...')
  await loadPlugins()
  logger.success(`Plugin subsystem loaded. Total: ${plugins.size} plugins active.\n`)

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
  let authMethod = null
  let phoneNumber = ''

  if (!state.creds.registered) {
    logger.info('Authentication credentials required.')
    console.log('  Select initialization protocol:\n')
    console.log('  [1] Pairing Code   ── 8-character pairing code')
    console.log('  [2] QR Code        ── Visual terminal QR matrix\n')

    while (!['1', '2'].includes(authMethod)) {
      authMethod = (await promptInput('❯ Select method [1/2]: ')).trim()
    }

    if (authMethod === '1') {
      console.log('\n  Format: International code without + or 0 (e.g. 628123456789)')
      while (true) {
        phoneNumber = (await promptInput('❯ Enter phone number: ')).replace(/[^0-9]/g, '')
        if (phoneNumber.startsWith('0')) {
          logger.failed('Invalid format. Do not use leading 0 (use country code like 62).')
          continue
        }
        if (phoneNumber.length < 6 || phoneNumber.length > 15) {
          logger.failed('Invalid length. Phone number must be between 6 and 15 digits.')
          continue
        }
        break
      }
      logger.process('Negotiating pairing code allocation...\n')
    }
  }

  await connectToWhatsApp(state, saveCreds, authMethod, phoneNumber)
}

process.on('SIGINT', () => {
  console.log('')
  logger.failed('Terminating habNoir core process...')
  process.exit(0)
})

main().catch((err) => {
  logger.error('Fatal Core Startup Exception', err)
})