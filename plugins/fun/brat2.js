import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import ffmpegPath from 'ffmpeg-static'
import { createSticker } from '../../utils/sticker.js'
import { getWaitMessage } from '../../utils/myfunction.js'

const execFileAsync = promisify(execFile)
const FFMPEG_BIN = process.env.FFMPEG_PATH || ffmpegPath || 'ffmpeg'

const FONT_URL = 'https://cdn.jsdelivr.net/gh/Napoleon-Fibonacci/assets@main/font/impact.ttf'
const EMOJI_JSON_URL = 'https://media.githubusercontent.com/media/Ditzzx-vibecoder/entahlah/main/emoji-apple.json'

const MEDIA_DIR = './media'
const FONT_PATH = path.join(MEDIA_DIR, 'impact.ttf')
const EMOJI_JSON_PATH = path.join(MEDIA_DIR, 'emoji-apple.json')

const THEMES = {
  black: { bg: '#000000', text: '#ffffff' },
  white: { bg: '#ffffff', text: '#000000' },
  green: { bg: '#8ace00', text: '#000000' }
}

let emojiMap = null
const emojiImageCache = new Map()

async function downloadFile(url, dest) {
  const dir = path.dirname(dest)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download resource from ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(dest, buf)
  return buf
}

async function ensureFont() {
  if (!fs.existsSync(FONT_PATH)) await downloadFile(FONT_URL, FONT_PATH)
  GlobalFonts.registerFromPath(FONT_PATH, 'Impact')
}

function emojiToUnicode(emoji) {
  return [...emoji].map((c) => c.codePointAt(0).toString(16).padStart(4, '0')).join('-')
}

async function loadEmojiMap() {
  if (emojiMap) return emojiMap
  if (!fs.existsSync(EMOJI_JSON_PATH)) await downloadFile(EMOJI_JSON_URL, EMOJI_JSON_PATH)
  emojiMap = JSON.parse(fs.readFileSync(EMOJI_JSON_PATH, 'utf-8'))
  return emojiMap
}

async function getEmojiImage(emoji) {
  if (emojiImageCache.has(emoji)) return emojiImageCache.get(emoji)
  const map = await loadEmojiMap()
  const base = emojiToUnicode(emoji)
  const variants = [
    base,
    base.replace(/-fe0f/gi, ''),
    `${base.replace(/-fe0f/gi, '')}-fe0f`,
    base.toUpperCase(),
    base.replace(/-fe0f/gi, '').toUpperCase(),
    base.replace(/-fe0f/gi, '').toUpperCase() + '-FE0F'
  ]
  let b64 = null
  for (const v of variants) {
    if (map[v]) {
      b64 = map[v]
      break
    }
  }
  if (!b64) return null
  const img = await loadImage(Buffer.from(b64, 'base64'))
  emojiImageCache.set(emoji, img)
  return img
}

async function drawAppleEmoji(ctx, emoji, x, y, size) {
  const img = await getEmojiImage(emoji)
  if (!img) {
    ctx.fillText(emoji, x, y)
    return
  }
  ctx.drawImage(img, x, y, size, size)
}

const EMOJI_REGEX = /(\p{Emoji_Modifier_Base}\p{Emoji_Modifier}|\p{Emoji_Presentation}\uFE0F?|\p{Emoji}\uFE0F|[\u{1F1E0}-\u{1F1FF}]{2}|\p{Extended_Pictographic}\uFE0F?)/gu

function measureTextCustom(ctx, text, fontSize) {
  const parts = text.split(EMOJI_REGEX)
  let w = 0
  for (const part of parts) {
    if (!part) continue
    EMOJI_REGEX.lastIndex = 0
    if (EMOJI_REGEX.test(part)) w += fontSize
    else w += ctx.measureText(part).width
    EMOJI_REGEX.lastIndex = 0
  }
  return w
}

async function drawTextWithEmojis(ctx, text, x, y, fontSize) {
  const parts = text.split(EMOJI_REGEX)
  let curX = x
  for (const part of parts) {
    if (!part) continue
    EMOJI_REGEX.lastIndex = 0
    if (EMOJI_REGEX.test(part)) {
      await drawAppleEmoji(ctx, part, curX, y, fontSize)
      curX += fontSize
    } else {
      ctx.fillText(part, curX, y)
      curX += ctx.measureText(part).width
    }
    EMOJI_REGEX.lastIndex = 0
  }
}

function wrapText(ctx, text, maxWidth, fontSize) {
  ctx.font = `${fontSize}px Impact`
  const words = text.split(' ')
  const lines = []
  let cur = ''
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word
    if (measureTextCustom(ctx, test, fontSize) > maxWidth && cur) {
      lines.push(cur)
      cur = word
    } else {
      cur = test
    }
  }
  if (cur) lines.push(cur)
  return lines
}

function fitsAt(ctx, text, fontSize, maxWidth, maxHeight, lineGap) {
  const lines = wrapText(ctx, text, maxWidth, fontSize)
  const longestWord = Math.max(...text.split(' ').map((w) => measureTextCustom(ctx, w, fontSize)))
  const totalHeight = lines.length * (fontSize + lineGap) - lineGap
  return longestWord <= maxWidth && totalHeight <= maxHeight
}

function findBestFontSize(ctx, text, maxWidth, maxHeight, lineGap) {
  let lo = 10
  let hi = 350
  let best = lo

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (fitsAt(ctx, text, mid, maxWidth, maxHeight, lineGap)) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return best
}

function easeOutBack(x) {
  const c1 = 1.4
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

function calculateWordLayout(ctx, fullText, maxWidth, maxHeight, lineGap, margin, padding, boxSize) {
  const fontSize = findBestFontSize(ctx, fullText, maxWidth, maxHeight, lineGap)
  ctx.font = `${fontSize}px Impact`
  const defaultSpaceWidth = ctx.measureText(' ').width

  const fullLines = wrapText(ctx, fullText, maxWidth, fontSize)
  const totalTextHeight = fullLines.length * (fontSize + lineGap) - lineGap
  const startY = margin + (boxSize - totalTextHeight) / 2

  const wordLayouts = []
  let currentY = startY

  for (let l = 0; l < fullLines.length; l++) {
    const line = fullLines[l]
    const lineWords = line.split(' ').filter(Boolean)
    const isLastLine = l === fullLines.length - 1

    const totalWordsW = lineWords.reduce((acc, w) => acc + measureTextCustom(ctx, w, fontSize), 0)

    let spaceBetween = defaultSpaceWidth
    if (!isLastLine && lineWords.length > 1) {
      spaceBetween = (maxWidth - totalWordsW) / (lineWords.length - 1)
    }

    let currentX = margin + padding

    for (const word of lineWords) {
      const wordW = measureTextCustom(ctx, word, fontSize)
      wordLayouts.push({
        text: word,
        x: currentX,
        y: currentY,
        w: wordW,
        h: fontSize
      })
      currentX += wordW + spaceBetween
    }
    currentY += fontSize + lineGap
  }

  return { fontSize, wordLayouts }
}

async function renderCanvas({
  wordLayouts,
  fontSize,
  wordStates,
  theme,
  blurAmount,
  highlightProgress = 0,
  margin = 35,
  size = 512
}) {
  const selectedTheme = THEMES[theme] || THEMES.white
  const boxSize = size - margin * 2
  const x = margin
  const y = margin

  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = selectedTheme.bg
  ctx.fillRect(0, 0, size, size)

  if (!wordLayouts || wordLayouts.length === 0) return canvas

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, boxSize, boxSize)
  ctx.clip()

  ctx.fillStyle = selectedTheme.text
  ctx.font = `${fontSize}px Impact`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  if (blurAmount > 0) ctx.filter = `blur(${blurAmount}px)`

  for (let idx = 0; idx < wordLayouts.length; idx++) {
    const item = wordLayouts[idx]
    const state = wordStates[idx] || { scale: 0, alpha: 0, visible: false }

    if (!state.visible) continue

    const centerX = item.x + item.w / 2
    const centerY = item.y + fontSize / 2

    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, state.alpha))

    if (state.scale !== 1.0) {
      ctx.translate(centerX, centerY)
      ctx.scale(state.scale, state.scale)
      ctx.translate(-centerX, -centerY)
    }

    await drawTextWithEmojis(ctx, item.text, item.x, item.y, fontSize)
    ctx.restore()
  }

  if (highlightProgress > 0 && highlightProgress <= 1) {
    const totalDist = boxSize * 2.8
    const curr = margin - boxSize * 1.0 + highlightProgress * totalDist
    const sweepW = boxSize * 0.95

    const grad = ctx.createLinearGradient(curr, curr, curr + sweepW, curr + sweepW)

    grad.addColorStop(0.00, 'rgba(255, 255, 255, 0)')
    grad.addColorStop(0.10, 'rgba(255, 255, 255, 0.35)')
    grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.95)')
    grad.addColorStop(0.38, 'rgba(255, 255, 255, 0.35)')

    grad.addColorStop(0.45, 'rgba(255, 255, 255, 0.05)')
    grad.addColorStop(0.52, 'rgba(255, 255, 255, 0.05)')

    grad.addColorStop(0.60, 'rgba(255, 255, 255, 0.35)')
    grad.addColorStop(0.75, 'rgba(255, 255, 255, 0.95)')
    grad.addColorStop(0.88, 'rgba(255, 255, 255, 0.35)')
    grad.addColorStop(1.00, 'rgba(255, 255, 255, 0)')

    ctx.fillStyle = grad
    ctx.fillRect(margin, margin, boxSize, boxSize)
  }

  ctx.restore()

  return canvas
}

async function generateBratVideoBuffer({ text = '', theme = 'white', blur = 0, holdDuration = 1.2 } = {}) {
  const blurAmount = [0, 1, 2, 3].includes(blur) ? blur : 0

  await ensureFont()
  await loadEmojiMap()

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'brat2-'))

  const FPS = 30
  const frameStepTime = 1 / FPS
  const tasks = []

  const size = 512
  const margin = 35
  const padding = 20
  const boxSize = size - margin * 2
  const lineGap = 8
  const maxWidth = boxSize - padding * 2
  const maxHeight = boxSize - padding * 2

  const dummyCanvas = createCanvas(size, size)
  const dummyCtx = dummyCanvas.getContext('2d')

  const { fontSize, wordLayouts } = calculateWordLayout(
    dummyCtx, text, maxWidth, maxHeight, lineGap, margin, padding, boxSize
  )

  const totalWords = wordLayouts.length

  tasks.push({
    wordStates: wordLayouts.map(() => ({ scale: 0, alpha: 0, visible: false })),
    highlightProgress: 0,
    duration: 0.1
  })

  const staggerFrames = 3
  const bounceFramesCount = 18
  const totalBounceFrames = (totalWords - 1) * staggerFrames + bounceFramesCount

  for (let f = 0; f < totalBounceFrames; f++) {
    const wordStates = wordLayouts.map((_, i) => {
      const startFrame = i * staggerFrames
      const currentFrame = f - startFrame

      if (currentFrame < 0) {
        return { scale: 0, alpha: 0, visible: false }
      } else if (currentFrame >= bounceFramesCount) {
        return { scale: 1.0, alpha: 1.0, visible: true }
      } else {
        const prog = currentFrame / (bounceFramesCount - 1)
        const bounceFactor = easeOutBack(prog)
        const scale = 0.2 + (1.0 - 0.2) * bounceFactor
        const alpha = Math.min(1.0, prog * 1.8)
        return { scale, alpha, visible: true }
      }
    })

    const highlightProgress = (f + 1) / totalBounceFrames

    tasks.push({
      wordStates,
      highlightProgress,
      duration: frameStepTime
    })
  }

  const secondHighlightFrames = 20
  const allVisibleStates = wordLayouts.map(() => ({ scale: 1.0, alpha: 1.0, visible: true }))

  for (let hf = 0; hf < secondHighlightFrames; hf++) {
    const highlightProgress = (hf + 1) / secondHighlightFrames
    tasks.push({
      wordStates: allVisibleStates,
      highlightProgress,
      duration: frameStepTime
    })
  }

  tasks.push({
    wordStates: allVisibleStates,
    highlightProgress: 0,
    duration: holdDuration
  })

  const framePaths = await Promise.all(
    tasks.map(async (task, index) => {
      const canvas = await renderCanvas({
        wordLayouts,
        fontSize,
        wordStates: task.wordStates,
        theme,
        blurAmount,
        highlightProgress: task.highlightProgress,
        margin,
        size
      })
      const buffer = await canvas.encode('png')
      const framePath = path.join(tmpDir, `frame-${String(index + 1).padStart(5, '0')}.png`)
      fs.writeFileSync(framePath, buffer)
      return { path: framePath, duration: task.duration }
    })
  )

  const manifestLines = []
  for (let i = 0; i < framePaths.length; i++) {
    manifestLines.push(`file '${framePaths[i].path.replace(/'/g, "'\\''")}'`)
    manifestLines.push(`duration ${framePaths[i].duration}`)
  }
  manifestLines.push(`file '${framePaths[framePaths.length - 1].path.replace(/'/g, "'\\''")}'`)

  const concatPath = path.join(tmpDir, 'concat.txt')
  fs.writeFileSync(concatPath, manifestLines.join('\n'))

  const outPath = path.join(tmpDir, `brat-${Date.now()}.mp4`)

  await execFileAsync(FFMPEG_BIN, [
    '-y',
    '-f', 'concat', '-safe', '0', '-i', concatPath,
    '-vf', 'fps=30,scale=512:512',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outPath
  ])

  const videoBuffer = fs.readFileSync(outPath)
  fs.rmSync(tmpDir, { recursive: true, force: true })

  return videoBuffer
}

const handler = async (m, { conn, text, usedPrefix, command }) => {
  // 1. GUARD — contextual explanation when text input is missing.
  if (!text) {
    return await m.reply(
      `*Animated Brat Sticker*\n\n` +
      `Generate an animated Brat sticker directly on the server without external APIs.\n\n` +
      `Example:\n` +
      `${usedPrefix}${command} BIG MONEY NEVER COMES CLEAN 💸💸`
    )
  }

  // 2. VALIDATE — contextual explanation when input text is too long.
  if (text.length > 80) {
    return await m.reply(
      `*Input Too Long*\n\n` +
      `The text must not exceed 80 characters.\n` +
      `Your input contains ${text.length} characters.`
    )
  }

  // 3. NOTIFY — required for local canvas rendering & ffmpeg video generation.
  await m.reply(getWaitMessage())

  // 4. WORK — no try/catch. Let failures throw to executePlugin.
  const videoBuffer = await generateBratVideoBuffer({ text: text.trim() })
  const stickerBuffer = await createSticker(videoBuffer, {
    packname: 'habNoir',
    author: m.pushName || 'habNoir'
  })

  // 5. DELIVER — return the send call.
  return await conn.sendMessage(m.chat, { sticker: stickerBuffer }, { quoted: m })
}

handler.help = ['brat2 <text>']
handler.tags = ['fun']
handler.command = ['brat2', 'abrat', 'animbrat']

export default handler
