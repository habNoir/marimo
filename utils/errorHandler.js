import logger from './logger.js'

const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m'
}

// ─── ERROR REPORTER (CONSOLE + WHATSAPP CHAT) ─────────────────────────────────
export async function handlePluginError(err, { m, command, usedPrefix }) {
  // 1. Cetak rincian error lengkap ke terminal
  console.log(`\n${c.red}┌─ [-]  PLUGIN FAULT DETECTED ────────────────────────────────${c.reset}`)
  console.log(`${c.gray}│${c.reset}  Command ➜ ${c.yellow}${usedPrefix}${command}${c.reset}`)
  console.log(`${c.gray}│${c.reset}  Caller  ➜ ${c.yellow}${m.pushName || m.senderNumber}${c.reset} (${m.sender})`)
  console.log(`${c.gray}│${c.reset}  Message ➜ ${c.red}${err?.message || err}${c.reset}`)

  if (err?.stack) {
    const stackLines = err.stack.split('\n').slice(1, 4)
    for (const line of stackLines) {
      console.log(`${c.gray}│${c.reset}  ${c.dim}${line.trim()}${c.reset}`)
    }
  }
  console.log(`${c.red}└─────────────────────────────────────────────────────────────┘${c.reset}\n`)

  // 2. Ambil baris file penyebab error (origin trace)
  const originLine = err?.stack ? err.stack.split('\n')[1]?.trim() : 'Unknown Origin'

  // 3. Kirim rincian error langsung ke ruang chat WhatsApp
  try {
    await m.reply(
      `*Execution Fault Occurred*\n\n` +
      `- Command : ${usedPrefix}${command}\n` +
      `- Error   : ${err?.message || 'Unspecified Exception'}\n` +
      `- Origin  : ${originLine}\n\n` +
      `Detailed traceback logged to console.`
    )
  } catch {}
}

// ─── AUTOMATED REACTION & EXECUTION LIFECYCLE ─────────────────────────────────
export async function executePlugin(plugin, m, extra) {
  try {
    // 1. Reaksi Awal: Wait (⌛)
    if (m.react) {
      await m.react('⌛')
    }

    logger.running(`Executing Command [${extra.usedPrefix}${extra.command}] from ${m.pushName || m.senderNumber}`)

    // 2. Eksekusi Plugin
    if (typeof plugin === 'function') {
      await plugin(m, extra)
    } else if (typeof plugin?.default === 'function') {
      await plugin.default(m, extra)
    } else {
      throw new Error('Plugin entrypoint is not a valid callable function')
    }

    // 3. Reaksi Sukses: Success (✔️)
    if (m.react) {
      await m.react('✔️')
    }

    logger.success(`Command [${extra.usedPrefix}${extra.command}] executed cleanly.`)
  } catch (err) {
    // 4. Reaksi Gagal: Failed (✖️)
    if (m.react) {
      await m.react('✖️')
    }

    // 5. Laporkan ke console dan kirim pesan error ke chat
    await handlePluginError(err, {
      m,
      command: extra.command,
      usedPrefix: extra.usedPrefix
    })
  }
}

// ─── GLOBAL UNCAUGHT PROCESS TRAP ─────────────────────────────────────────────
export function initGlobalErrorTrap() {
  process.on('uncaughtException', (err) => {
    logger.error('Global Uncaught Exception Trapped', err)
  })

  process.on('unhandledRejection', (reason) => {
    logger.error('Global Unhandled Promise Rejection', reason)
  })
}

export default {
  handlePluginError,
  executePlugin,
  initGlobalErrorTrap
}