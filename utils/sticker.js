import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import sharp from 'sharp'
import webp from 'node-webpmux'
import { getConfig } from './myfunction.js'

const execPromise = promisify(exec)

// ─── RESOLVE FFMPEG BINARY PATH ──────────────────────────────────────────────
let ffmpegCmd = 'ffmpeg'
try {
  const ffmpegModule = await import('ffmpeg-static')
  if (ffmpegModule?.default) {
    ffmpegCmd = `"${ffmpegModule.default}"`
  }
} catch {
  ffmpegCmd = 'ffmpeg'
}

/**
 * Converts static images to sharp 512x512 WebP via Sharp
 */
export async function imageToWebp(mediaBuffer) {
  return await sharp(mediaBuffer)
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .webp({ quality: 75 })
    .toBuffer()
}

/**
 * Encodes crisp 15 FPS animated WebP at full 512x512 scale
 * Preserves high visual fidelity while staying safely under WhatsApp 1MB chat limit
 */
export async function videoToWebp(mediaBuffer) {
  const uniqueId = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  const tmpIn = path.join(os.tmpdir(), `stick_in_${uniqueId}.mp4`)
  const tmpOut = path.join(os.tmpdir(), `stick_out_${uniqueId}.webp`)

  fs.writeFileSync(tmpIn, mediaBuffer)

  try {
    // Batas aman pesan stiker WhatsApp (950 KB dari batas 1 MB)
    const MAX_ALLOWED_BYTES = 950 * 1024

    // Helper eksekusi: FPS rata 15, skala penuh 512x512 dengan Lanczos tajam
    const runEncode = async (quality) => {
      const videoFilter = `scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,fps=15,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000`
      await execPromise(
        `${ffmpegCmd} -y -i "${tmpIn}" -vf "${videoFilter}" -c:v libwebp -lossless 0 -compression_level 4 -q:v ${quality} -loop 0 -preset default -an -vsync 0 "${tmpOut}"`
      )
      return fs.statSync(tmpOut).size
    }

    // ─── PASS 1: KUALITAS JERNIH & TAJAM (q:v 52, 15 FPS) ────────────────────
    let currentSize = await runEncode(52)

    // ─── PASS 2: PENYESUAIAN LEMBUT HANYA JIKA MELEBIHI 950 KB ───────────────
    // Jika video sangat panjang/padat dan tembus 950 KB, turunkan q:v secukupnya (tetap tajam)
    if (currentSize > MAX_ALLOWED_BYTES) {
      currentSize = await runEncode(42)
    }

    // ─── PASS 3: BATAS MINIMAL AMAN (TIDAK PERNAH DI BAWAH 35) ───────────────
    if (currentSize > MAX_ALLOWED_BYTES) {
      currentSize = await runEncode(35)
    }

    return fs.readFileSync(tmpOut)
  } catch (err) {
    throw new Error(`Crisp animated sticker conversion failed: ${err.message}`)
  } finally {
    if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn)
    if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut)
  }
}

export async function addExif(webpBuffer, packname, author) {
  const img = new webp.Image()
  await img.load(webpBuffer)

  const json = {
    'sticker-pack-id': crypto.randomBytes(16).toString('hex'),
    'sticker-pack-name': packname,
    'sticker-pack-publisher': author,
    'emojis': ['']
  }

  const exifAttr = Buffer.from([
    0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x16, 0x00, 0x00, 0x00
  ])

  const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8')
  const exif = Buffer.concat([exifAttr, jsonBuff])
  exif.writeUIntLE(jsonBuff.length, 14, 4)

  img.exif = exif
  return await img.save(null)
}

export async function createSticker(mediaBuffer, customOptions = {}) {
  const config = getConfig()
  const packname = customOptions.pack || config.stickerData?.packname || 'Marimo'
  const author = customOptions.author || config.stickerData?.author || 'habNoir'

  const isVideo =
    customOptions.isVideo ||
    mediaBuffer.slice(4, 8).toString() === 'ftyp' ||
    mediaBuffer.slice(0, 4).toString('hex') === '1a45dfa3'

  let rawWebp = null
  if (isVideo) {
    rawWebp = await videoToWebp(mediaBuffer)
  } else {
    rawWebp = await imageToWebp(mediaBuffer)
  }

  return await addExif(rawWebp, packname, author)
}

export default {
  createSticker,
  imageToWebp,
  videoToWebp,
  addExif
}