<div align="center">

```
┌─────────────────────────────────────────────────────────────┐
│  Marimo ── v1.0                                              │
│  WhatsApp Multi-Device Autonomous Engine                     │
│  Built on Elaina-Baileys Modernized Socket Architecture      │
└─────────────────────────────────────────────────────────────┘
```

<p align="center">
<img src="https://img.shields.io/badge/Node.js-%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js Version" />
<img src="https://img.shields.io/badge/Module-ESM-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="ESM" />
<img src="https://img.shields.io/badge/Engine-Elaina--Baileys-7F5AF0?style=flat-square" alt="Elaina Baileys" />
<img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="MIT License" />
</p>

</div>

## Overview

Marimo is a lightweight, high-performance WhatsApp Multi-Device bot built on top of [`elaina-baileys`](https://github.com/rexxzyid/elaina-baileys). It focuses on low-latency message dispatch, resilient socket lifecycle management, deep protocol envelope unwrapping, and a dynamic modular plugin architecture.

## Key Features

| Feature | Technical Description |
|---|---|
| Dual Connection Gateway | Supports 8-character pairing codes with international number validation, plus a terminal-rendered QR code for linking. |
| Zero-Delay Media Relay | Uses `prepareWAMessageMedia` and `relayMessage` to cache uploaded CDN tokens in RAM, avoiding repeated re-uploads for menu media (video and voice note). |
| Deep View-Once Inspector | Recursively unwraps nested message containers (`ephemeralMessage`, `viewOnceMessage`, `viewOnceMessageV2`, `viewOnceMessageV2Extension`, and more) up to 10 levels deep to reliably detect view-once media. |
| PTT / Audio Utilities | Ships with FFmpeg-based helpers to transcode audio to 48kHz Mono Opus (via `convertToOpus`) and to read accurate audio duration for playback metadata. |
| Signal Key In-Memory Caching | Wraps the authentication key store with `makeCacheableSignalKeyStore` to minimize disk I/O during E2EE ratchet decryption. |
| Auto-Reconnect Socket Core | Automatically reconnects on unexpected disconnects, detects the initial "restart required" handshake, and cleanly purges the session folder on logout. |
| Centralized Error Trap | Captures uncaught exceptions and unhandled promise rejections globally, and reports plugin execution errors back to the chat with a readable stack trace. |
| Dynamic Subfolder Plugins | Recursively discovers and mounts command modules from any subdirectory inside `./plugins/`, using the immediate subfolder name as the command category. |
| Config-Driven Prefix Engine | Switches instantly between single-prefix mode and multi-prefix array mode via `config.json`, no code changes required. |
| Group-Aware Permissions | Resolves group metadata (with a 5-minute in-memory cache) to determine sender and bot admin status for permission-gated commands. |

## Directory Structure

```
marimo/
├── config.json               # Global bot configuration & prefix rules
├── package.json               # Dependencies and ESM module declaration
├── hab.js                     # Main gateway, socket controller & startup engine
├── handler.js                 # Message dispatcher, permission checks & command parser
├── media/
│   ├── menu_gif.mp4           # Menu video asset (sent as a GIF-style video)
│   └── menu_voice.ogg         # Menu voice note asset (48kHz Mono Opus)
├── utils/
│   ├── logger.js               # Unicode status reporter & event/command inspector
│   ├── errorHandler.js         # Centralized execution interceptor & crash barrier
│   └── myfunction.js           # Core helpers: config loader, system info, media utilities
└── plugins/
    └── general/
        └── menu.js             # Interactive, categorized bot menu
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
| `ffmpeg-static` | Bundled FFmpeg binary for audio/video processing |
| `fluent-ffmpeg` | Fluent wrapper for FFmpeg operations |
| `pino` | Structured logger used internally by the socket engine |
| `qrcode-terminal` | Renders the WhatsApp linking QR code in the terminal |
| `sharp` | Image processing utility |

**3. Configure the bot**

Edit `config.json` to match your deployment:

```json
{
  "botName": "Marimo",
  "ownerName": "habNoir",
  "botVersion": "1.0",
  "ownerNumbers": [
    "628138174768"
  ],
  "channelID": "120363429995207955@newsletter",
  "prefix": {
    "multi": false,
    "single": "!",
    "list": ["!", ".", "/", "#", "?"]
  }
}
```

| Field | Description |
|---|---|
| `botName` | Display name shown in the menu and logs |
| `ownerName` | Owner display name |
| `botVersion` | Version string shown in the menu |
| `ownerNumbers` | Array of phone numbers (digits only, with country code) granted owner-level access |
| `channelID` | WhatsApp Channel/Newsletter JID used for forwarded-message attribution in the menu |
| `prefix.multi` | `true` enables multiple prefixes from `prefix.list`; `false` uses only `prefix.single` |
| `prefix.single` | The single command prefix used when `multi` is `false` |
| `prefix.list` | Array of accepted prefixes used when `multi` is `true` |

## Running the Bot

Start the core engine:

```bash
node hab.js
```

On the first run without an active session, choose an authentication method:

1. **Pairing Code** — enter your phone number in international format, without a leading `+` or `0` (e.g. `628123456789`)
2. **QR Code** — scan the code shown in the terminal from **WhatsApp → Linked Devices → Link a Device**

If the connection drops unexpectedly, the bot reconnects automatically. If the session is revoked or logged out from the device, the local session folder is purged and the bot exits, so it can be re-authenticated on the next start.

## Available Commands

| Command | Category | Description |
|---|---|---|
| `menu` / `help` | general | Shows the interactive bot menu (bot info, system info, and category list), together with the menu video and voice note. Use `menu <category>` to list commands within a specific category. |

> This project currently ships with a single built-in plugin (`menu`). There is no `ping` command included by default — add one yourself under `./plugins/<category>/` if needed, following the plugin specification below.

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
