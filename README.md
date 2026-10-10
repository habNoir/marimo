<div align="center">

```
┌─────────────────────────────────────────────────────────────┐
│  Marimo ── v1.6.2                                           │
│  WhatsApp Multi-Device Autonomous Engine                     │
│  Built on Elaina-Baileys Modernized Socket Architecture      │
└─────────────────────────────────────────────────────────────┘
```

<p align="center">
<img src="https://img.shields.io/badge/Node.js-%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js Version" />
<img src="https://img.shields.io/badge/Module-ESM-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="ESM" />
<img src="https://img.shields.io/badge/Engine-Elaina--Baileys-7F5AF0?style=flat-square" alt="Elaina Baileys" />
<img src="https://img.shields.io/badge/Database-SQLite_(WAL)-003B57?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite" />
<img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="MIT License" />
</p>

</div>

## Overview

Marimo is a lightweight, high-performance WhatsApp Multi-Device bot built on top of [`elaina-baileys`](https://github.com/rexxzyid/elaina-baileys). It focuses on low-latency message dispatch, resilient socket lifecycle management, deep protocol envelope unwrapping, ACID-compliant SQLite WAL persistence, and a dynamic modular plugin architecture.

## Key Features

| Feature | Technical Description |
|---|---|
| Dual Connection Gateway | Supports 8-character pairing codes with international number validation, plus a terminal-rendered QR code for linking. |
| SQLite WAL Relational Store | Persists session keys, contacts, LID mappings, groups, users, and blacklists via `better-sqlite3` in WAL mode, avoiding NTFS I/O bottlenecks. |
| Zero-Delay Media Relay | Uses `prepareWAMessageMedia` and `relayMessage` to cache uploaded CDN tokens in RAM, delivering repeated menu/stats media in under 100ms. |
| Deep View-Once Inspector | Recursively unwraps nested message containers (`ephemeralMessage`, `viewOnceMessageV2`, etc.) up to 10 levels deep to reliably cache and reveal one-time media. |
| PTT / Audio Transcoding | Transcodes audio to 48kHz Mono Opus with metadata stripping and timestamp synchronization to prevent playback duration freezes. |
| Live Photo / Motion Photo | Generates native WhatsApp Motion Photos (ImgVid) with H.264 30fps `yuv420p` encoding and faststart stream flags. |
| BMKG Realtime Earthquake Alerts | Fetches official live seismic data from BMKG TEWS API and dispatches detailed reports with Shakemap infographics. |
| Local Canvas Brat Animations | Renders multi-frame animated text stickers locally with Apple emojis using `@napi-rs/canvas` and FFmpeg. |
| High-Speed TikTok Downloader | Dual scraping engine (SSSTik + TikWM fallback) for downloading watermark-free TikTok videos and MP3 audio. |
| Mandatory User Registration | Restricts commands to registered members via private chat (`!register name.age`) with a 24-hour daily warning rate limiter. |
| Granular Blacklist Engine | Empowers bot owners to ban abusive users or groups temporarily (`10m`, `2h`, `1d`) or permanently. |
| CRM Debugger Suite | Forensic toolset for inspecting raw Protobuf schemas, decrypted secret envelopes, XML stanzas, and SQLite message history. |
| Centralized Error Trap | Wraps all plugin executions with an automated reaction lifecycle (`⌛` ➔ `✔️` / `✖️`) and reports file origin stack traces to chat without crashing. |
| Dynamic Subfolder Plugins | Recursively discovers and mounts command modules from any subdirectory inside `./plugins/`, using the immediate subfolder name as the command category. |

## Directory Structure

```
marimo/
├── config.json               # Global bot configuration, wait messages, and permissions
├── package.json               # Dependencies and ESM module declaration
├── hab.js                     # Main gateway, socket controller & startup engine
├── handler.js                 # Message dispatcher, deduplication, registration & permissions
├── database/
│   ├── session/               # SQLite session storage (session.db)
│   └── crmdb.db               # SQLite audit message store & CRM node database
├── media/
│   ├── emoji-apple.json       # Apple emoji dataset for local Canvas Brat2 rendering
│   ├── impact.ttf             # Impact font typography asset
│   ├── menu_gif.mp4           # Menu video asset (sent as GIF-style video)
│   └── menu_voice.ogg         # Menu voice note asset (48kHz Mono Opus)
├── utils/
│   ├── logger.js               # Unicode status reporter & event/command inspector
│   ├── errorHandler.js         # Centralized execution interceptor & crash barrier
│   ├── store.js                # SQLite session, contacts, groups, users & blacklist store
│   ├── crmstore.js             # SQLite protobuf message & node persistence
│   ├── sticker.js              # Sharp & FFmpeg Lanczos 3-pass WebP sticker engine
│   └── myfunction.js           # Core helpers: config loader, system info, media utilities
└── plugins/
    ├── downloader/            # TikTok mp3/mp4 downloader
    ├── fun/                   # Brat, Brat2 (Canvas animated), BratG, FakeXNXX
    ├── general/               # Menu, Stats / System Telemetry
    ├── owner/                 # Blacklist manager, CRM Debugger Suite
    ├── tools/                 # Gempa (BMKG), LivePhoto, RVO, Sticker, CRM Relay
    └── user/                  # Member Registration
```

> The plugin loader mounts **any** `.js` file placed inside a subfolder of `./plugins/`, so this structure will grow as more command modules are added.

## Prerequisites

- **Node.js**: v20.0.0 or newer (Node.js 22+ recommended)
- **FFmpeg**: handled automatically through `ffmpeg-static`, or a system-installed binary can be used instead
- **Git**

## Installation

**1. Clone the repository**

```bash
git clone https://github.com/habNoir/marimo.git
cd marimo
```

**2. Install dependencies**

```bash
npm install
```

Core dependencies used by the project:

| Package | Purpose |
|---|---|
| [`elaina-baileys`](https://github.com/rexxzyid/elaina-baileys) | WhatsApp Multi-Device socket engine (the core connection library) |
| `better-sqlite3` | High-performance C++ SQLite driver for ACID-compliant WAL persistence |
| `@napi-rs/canvas` | Node.js Canvas implementation for local sticker and image generation |
| `sharp` | High-performance image processing and WebP conversion utility |
| `node-webpmux` | WebP EXIF metadata reader and injector for custom sticker attribution |
| `ffmpeg-static` | Bundled static FFmpeg binary for audio/video transcoding |
| `fluent-ffmpeg` | Fluent Node.js wrapper for FFmpeg commands and filters |
| `axios` | HTTP client for remote data streams and media fetching |
| `qrcode-terminal` | Renders the WhatsApp pairing QR matrix in the terminal |
| `pino` | High-speed structured logger used by the Baileys socket core |

**3. Configure the bot**

Edit `config.json` to match your deployment:

```json
{
  "botName": "Marimo",
  "ownerName": "habNoir",
  "botVersion": "1.6.2",
  "ownerNumbers": [
    "628138174768"
  ],
  "stickerData": {
    "packname": "Marimo",
    "author": "habNoir"
  },
  "channelID": "120363429995207955@newsletter",
  "prefix": {
    "multi": false,
    "single": "!",
    "list": ["!", ".", "/", "#", "?"]
  },
  "messages": {
    "wait": [
      "⏳ Processing your request. Please wait..."
    ],
    "permission": {
      "owner": "[!] Access Denied. Reserved for the bot owner.",
      "group": "[!] Invalid Context. This command only works in groups.",
      "private": "[!] Invalid Context. This command can only be used in private chat."
    }
  }
}
```

| Field | Description |
|---|---|
| `botName` | Display name shown in the menu, stickers, and logs |
| `ownerName` | Owner display name |
| `botVersion` | Version string shown in the menu and system telemetry |
| `ownerNumbers` | Array of phone numbers granted owner-level privileges |
| `stickerData` | Default sticker pack name and author attribution |
| `channelID` | WhatsApp Channel JID used for forwarded attribution cards |
| `prefix.multi` | `true` enables multiple prefixes; `false` uses only `prefix.single` |
| `messages.wait` | Array of dynamic status messages dispatched during long operations |

## Running the Bot

Start the core engine:

```bash
node hab.js
```

On the first run without an active session, choose an authentication method:

1. **Pairing Code** — enter your phone number in international format, without a leading `+` or `0` (e.g. `628123456789`)
2. **QR Code** — scan the code shown in the terminal from **WhatsApp → Linked Devices → Link a Device**

If the connection drops unexpectedly, the bot reconnects automatically. If the session is revoked or logged out from the device, the local session folder is purged and the bot exits cleanly.

## Available Commands

| Command | Category | Description | Context / Access |
|---|---|---|---|
| `menu` / `help` | general | Interactive menu categorized with zero-delay CDN media relay | All Users |
| `stats` / `botstats` / `ping` | general | System telemetry (Uptime, RAM, CPU, SQLite database sizes) | All Users |
| `tt` / `tiktok` / `ttdl` | downloader | Download TikTok videos (without watermark) or extract MP3 audio | Registered Users |
| `gempa` / `bmkg` / `infogempa` | tools | Live BMKG earthquake report with official Shakemap infographic | Registered Users |
| `fotolive` / `livephoto` | tools | Converts video into native WhatsApp Motion Photo (ImgVid) | Registered Users |
| `readvo` / `rvo` / `viewonce` | tools | Reveals and downloads incoming ephemeral View-Once media | Registered Users |
| `sticker` / `s` | tools | Creates static or animated WebP stickers with custom EXIF pack | Registered Users |
| `crm` | tools | Interactive message relay generator (Lists, Flow Cards, Buttons) | Registered Users |
| `brat` / `bratg` | fun | Text-to-sticker generator inspired by Brat typography | Registered Users |
| `brat2` | fun | Local Canvas multi-frame animated Brat sticker with Apple emojis | Registered Users |
| `fakexnxx` | fun | Parameterized quote sticker generator (`name\|quote\|likes`) | Registered Users |
| `register` / `reg` | user | Registers user account profile (`!register name.age`) | Private Chat Only |
| `blacklist` / `unblacklist` | owner | Manages temporary or permanent user & group bans | Bot Owner Only |
| `listblacklist` | owner | Displays all currently active blacklist records and expiration dates | Bot Owner Only |
| `fn` / `proto` / `lastchat` / `adn` | owner | Forensic CRM debugging suite for inspecting Protobuf & SQLite stanzas | Bot Owner Only |

## Plugin Specification

Plugins are ES modules placed inside `./plugins/<category>/<filename>.js`. The handler automatically maps each plugin's category from its immediate subfolder name.

```javascript
const handler = async (m, { conn, args, usedPrefix, command }) => {
  await m.reply('Operational confirmation payload.')
}

handler.help = ['example']
handler.tags = ['general']
handler.command = ['example', 'test']

// Optional permission guards:
// handler.owner = true      // Restricted to configured bot owners
// handler.group = true      // Restricted to group contexts
// handler.private = true    // Restricted to private direct messages
// handler.admin = true      // Requires the sender to be a group admin
// handler.botAdmin = true   // Requires the bot to hold group admin privileges

export default handler
```

`command` may be a string, an array of strings, or a `RegExp` (or an array mixing strings and `RegExp`). The first plugin whose `command` matches the parsed input is executed.

## Terminal Logging Standard

The terminal uses a dedicated Unicode-based format with the following indicators:

| Symbol | Meaning | Description |
|---|---|---|
| `[+]` | Success | Successful operations and connections |
| `[-]` | Failed | Errors and caught execution exceptions |
| `[!]` | Warning | Warnings, rate-limits, or permission rejections |
| `[*]` | Info | General operational notices |
| `[~]` | Process | Background tasks and cryptographic handshakes |
| `[>]` | Running | Command dispatch and execution states |

## Acknowledgements

- **Allah SWT**, for making the development of this project possible
- **My parents**, for their endless support and prayers
- **AI**, for assisting with development and documentation
- **[elaina-baileys](https://github.com/rexxzyid/elaina-baileys)**, the library this project is built on
- **My friends**, for their support, ideas, and encouragement
- **Everyone else** who contributed, directly or indirectly, to this project

## License

This project is licensed under the **MIT License**.

<div align="center">

─────────────────────────────────────────────────────────────

*Developed by habNoir — built for speed and reliability.*

─────────────────────────────────────────────────────────────

</div>
