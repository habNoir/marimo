import store from '../../utils/store.js'
import { getConfig } from '../../utils/myfunction.js'

const handler = async (m, { text, usedPrefix, command }) => {
  // 1. GUARD — check if user is already registered.
  const registeredUser = store.getUser(m.sender)
  if (registeredUser && registeredUser.registeredAt) {
    const config = getConfig()
    return await m.reply(
      config.messages?.permission?.registered ||
      `*Already Registered*\n\nYou are already registered in the system.`
    )
  }

  // contextual explanation when registration input is missing.
  if (!text) {
    return await m.reply(
      `*User Registration*\n\n` +
      `Register your account to access habNoir bot commands.\n\n` +
      `Format: ${usedPrefix}${command} name.age\n\n` +
      `Example:\n` +
      `${usedPrefix}${command} habNoir.20`
    )
  }

  // 2. VALIDATE — contextual explanation when name or age input is invalid.
  const rawParts = text.includes('.') ? text.split('.') : text.trim().split(/ +/)
  const name = (rawParts[0] || '').trim()
  const age = parseInt(rawParts[1] || '', 10)

  if (!name || isNaN(age) || age < 5 || age > 100) {
    return await m.reply(
      `*Invalid Registration Format*\n\n` +
      `Please provide a valid name and age (between 5 and 100).\n\n` +
      `Format: ${usedPrefix}${command} name.age\n\n` +
      `Example:\n` +
      `${usedPrefix}${command} habNoir.20`
    )
  }

  // 3. WORK — register user profile in SQLite database.
  store.registerUser(m.sender, name, age)

  // 4. DELIVER — return the send call.
  return await m.reply(
    `*Registration Successful*\n\n` +
    `User Account Details:\n` +
    `- Name   : ${name}\n` +
    `- Age    : ${age}\n` +
    `- Status : Registered Member\n\n` +
    `You can now access all habNoir bot commands!`
  )
}

handler.help = ['register <name>.<age>']
handler.tags = ['user']
handler.command = ['register', 'reg']
handler.private = true
handler.unregistered = true

export default handler
