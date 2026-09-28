# CHANGELOG habNoir v1.6.1

All notable changes, new features, bug fixes, and infrastructure upgrades in this release.

---

### 🚀 New Features & Plugins

- 🎨 **Animated Brat Sticker (`!brat2`)**
  - Native local canvas & FFmpeg rendering without external API dependencies.
  - Supports emojis, themes, custom hold durations, and animated webp output.

- 📸 **Live Photo / Motion Photo (`!livephoto` / `!fotolive` / `!livepic`)**
  - Native `@rexxhayanasi/elaina-baileys` Motion Photo pairing (`AssociationType.MOTION_PHOTO`).
  - H.264 30fps `yuv420p` + `+faststart` video optimization for zero frame drops on iOS/Android.

- 🛠️ **Create Relay Messages (`!crm`)**
  - Interactive relay generator for Lists, Quick Reply Buttons, Native Flow Cards, Location, VCards, Newsletters, and Orders.

- 🔬 **CRM Debugger Suite (`!crm`, `!fn`, `!crm2`, `!insp`, `!proto`, `!adn`, `!relay`, `!lastchat`)**
  - High-level Baileys `conn.sendMessage` code generator (`!fn`).
  - Protobuf schema field inspector (`!proto`).
  - SQLite chat history browser (`!lastchat`).
  - HKDF AES-256-GCM secret encrypted message decryption & stanza XML inspector (`!adn`).

---

### ⚡ Core & System Enhancements

- ⚙️ **Configurable System Messages**
  - Centralized 12 sarcastic wait messages (`config.messages.wait`) & custom permission responses (`config.messages.permission`).
  - Integrated `getWaitMessage()` helper across all media & download plugins.

- 📊 **Comprehensive System Stats (`!stats`)**
  - Enhanced statistics covering Bot Profile, SQLite DB sizes (`session.db` & `crmdb.db`), Node.js Process Memory footprint, CPU topology, and Server Infrastructure.

- 📸 **High Quality Media & Link Previews**
  - Enabled `generateHighQualityLinkPreview: true` and `linkPreviewImageThumbnailWidth: 640` for HD image preview cards.

- 🔒 **User Registration & Security Guard**
  - Updated `!register` to prevent duplicate user registrations with custom permission response.

---

### 🐛 Bug Fixes & Stability

- 🛠️ **FFmpeg Stdin Pipe Fix**
  - Replaced `execFile` with `spawn` stream piping in FFmpeg frame extraction to eliminate `write EOF` / `EPIPE` stream hangs.

- 🧹 **Atomic Temp File Cleanup**
  - Guaranteed temporary file unlinking inside `finally` blocks for zero disk space leaks.
