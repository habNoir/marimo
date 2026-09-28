import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import ffmpegPath from 'ffmpeg-static'
import { prepareWAMessageMedia, generateWAMessageFromContent } from '@rexxhayanasi/elaina-baileys'
import { downloadMedia, getWaitMessage } from '../../utils/myfunction.js'

const execFileAsync = promisify(execFile)
const FFMPEG_BIN = ffmpegPath || 'ffmpeg'

async function optimizeVideoForLivePhoto(videoBuffer) {
  const tmpIn = path.join(os.tmpdir(), `lv_in_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`)
  const tmpOut = path.join(os.tmpdir(), `lv_out_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`)

  try {
    fs.writeFileSync(tmpIn, videoBuffer)
    // Re-encode to H.264 30fps yuv420p with faststart to prevent frame drops in WhatsApp Live Photo player
    await execFileAsync(FFMPEG_BIN, [
      '-y',
      '-i', tmpIn,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '20',
      '-pix_fmt', 'yuv420p',
      '-r', '30',
      '-movflags', '+faststart',
      '-c:a', 'aac',
      '-b:a', '128k',
      tmpOut
    ])
    return fs.readFileSync(tmpOut)
  } catch {
    // Fallback to original buffer if re-encoding fails
    return videoBuffer
  } finally {
    if (fs.existsSync(tmpIn)) {
      try { fs.unlinkSync(tmpIn) } catch {}
    }
    if (fs.existsSync(tmpOut)) {
      try { fs.unlinkSync(tmpOut) } catch {}
    }
  }
}

async function extractFirstFrame(videoBuffer) {
  const tmpVideo = path.join(os.tmpdir(), `lv_vid_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`)
  const tmpThumb = path.join(os.tmpdir(), `lv_thm_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`)

  try {
    fs.writeFileSync(tmpVideo, videoBuffer)
    await execFileAsync(FFMPEG_BIN, ['-y', '-i', tmpVideo, '-vframes', '1', '-q:v', '2', tmpThumb])
    return fs.readFileSync(tmpThumb)
  } finally {
    if (fs.existsSync(tmpVideo)) {
      try { fs.unlinkSync(tmpVideo) } catch {}
    }
    if (fs.existsSync(tmpThumb)) {
      try { fs.unlinkSync(tmpThumb) } catch {}
    }
  }
}

const handler = async (m, { conn, usedPrefix, command }) => {
  // 1. GUARD — contextual explanation when no valid video is attached or quoted.
  const quoted = m.quoted
  const targetMsg = quoted ? quoted.msg : m.msg
  const targetType = quoted ? quoted.type : m.type

  const hasVideo = targetType === 'videoMessage' || Boolean(targetMsg?.videoMessage)

  if (!hasVideo) {
    return await m.reply(
      `*Live Photo Generator*\n\n` +
      `Send or reply to a video message to convert it into a WhatsApp Live Photo.\n\n` +
      `Example:\n` +
      `Reply to a video message with ${usedPrefix}${command}`
    )
  }

  // 2. VALIDATE — contextual explanation when video duration is excessive.
  const videoNode = targetMsg?.videoMessage || targetMsg
  if ((videoNode?.seconds || 0) > 30) {
    return await m.reply(
      `*Conversion Failed*\n\n` +
      `The video length exceeds the allowable limit.\n` +
      `Please provide a video that is 30 seconds or shorter.`
    )
  }

  // 3. NOTIFY — required for video downloading, thumbnail extraction, and media upload.
  await m.reply(getWaitMessage())

  // 4. WORK — no try/catch. Let failures throw to executePlugin.
  const rawVideoBuffer = await downloadMedia(targetMsg, 'video')
  const videoBuffer = await optimizeVideoForLivePhoto(rawVideoBuffer)
  const thumbBuffer = await extractFirstFrame(videoBuffer)

  // 5. DELIVER — native Baileys imgvid (motion photo) sending
  return await conn.sendMessage(
    m.chat,
    {
      image: thumbBuffer,
      video: videoBuffer,
      caption: '*Live Photo Result*'
    },
    { quoted: m }
  )
}

handler.help = ['fotolive', 'livephoto', 'livepic']
handler.tags = ['tools']
handler.command = ['fotolive', 'livephoto', 'livepic']

export default handler
