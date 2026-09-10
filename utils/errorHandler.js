import logger from './logger.js'

const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m'
}

export async function handlePluginError(err, { m, command, usedPrefix }) {
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

  const originLine = err?.stack ? err.stack.split('\n')[1]?.trim() : 'Unknown Origin'
  
  await m.reply(
    `[-]  EXECUTION FAULT OCCURRED\n\n` +
    `➜  Command : ${usedPrefix}${command}\n` +
    `➜  Reason  : ${err?.message || 'Unspecified Error'}\n` +
    `➜  Origin  : ${originLine}\n\n` +
    `[!] Error stack trace has been captured in terminal.`
  )
}

export async function executePlugin(plugin, m, extra) {
  try {
    logger.running(`Executing Command [${extra.usedPrefix}${extra.command}] from ${m.pushName || m.senderNumber}`)
    
    // Support both direct function and module.default
    if (typeof plugin === 'function') {
      await plugin(m, extra)
    } else if (typeof plugin?.default === 'function') {
      await plugin.default(m, extra)
    } else {
      throw new Error('Plugin entrypoint is not a valid callable function')
    }

    logger.success(`Command [${extra.usedPrefix}${extra.command}] executed cleanly.`)
  } catch (err) {
    await handlePluginError(err, {
      m,
      command: extra.command,
      usedPrefix: extra.usedPrefix
    })
  }
}

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
