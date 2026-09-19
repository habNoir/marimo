# Marimo Changelog Archive

This document maintains the complete, chronological technical changelog history of **Marimo** (habNoir), built on top of `@rexxhayanasi/elaina-baileys`.

---

## 🚀 Marimo v1.0

Hey everyone,

Finally shipped it — **Marimo**, a WhatsApp Multi-Device bot built from scratch on top of **elaina-baileys** as the socket engine. Main focus was speed and connection stability.

**A few technical bits worth knowing in v1.0:**

- Login via Pairing Code (8-char) or QR Code, pick whichever on first run
- Menu media (video/voice note) gets cached in RAM and uploaded to the CDN only once, so responses feel instant, no re-upload on every call
- View-once detector that unwraps up to 10 layers of nested containers (`ephemeralMessage`, `viewOnceMessageV2`, etc.), so detection is more reliable
- Signal key store wrapped with in-memory caching, cutting down disk I/O during E2EE decryption
- Auto-reconnect on unexpected disconnects, plus automatic session cleanup on logout
- Modular plugin system — commands are auto-loaded from subfolders under `./plugins/<category>/`, just drop a new `.js` file and it gets picked up
- Prefix mode (single or multi-array) configurable straight from `config.json`, no code changes needed
- Built-in permission guards for commands (owner, group, admin, botAdmin, etc.)

Everything's open source, feel free to dig through it, learn from it, or build on top of it.

🔗 Repo: https://github.com/habNoir/marimo/

Found a bug or have a feature idea? Open an issue on the repo. Big thanks to everyone who supported the development process 🙏

> habNoir

---

## ✧ Marimo ── v1.5 ✧
› Comprehensive Technical Changelog / v1.0 to v1.5 Migration Audit

This changelog documents the complete architectural transformation of Marimo from the initial v1.0 baseline (https://github.com/habNoir/marimo) to version 1.5. Key focuses include replacing file-based state with an ACID-compliant SQLite relational store, eliminating media dispatch latency via pre-uploaded CDN relays, deep protocol envelope unwrapping, and expanding the plugin ecosystem.

✧ Detailed Technical Breakdown ✧

[+] 1. Database & State Layer Migration (better-sqlite3 WAL Mode)
    › Replaced useMultiFileAuthState with useSqliteAuthState backed by better-sqlite3 v13.
    › Relocated database storage to ./database/session/session.db with WAL (Write-Ahead Logging) pragma enabled, eliminating thousands of loose JSON pre-key files and resolving Windows NTFS I/O file-locking bottlenecks.
    › Implemented a unified relational SQLite store in ./utils/store.js featuring compiled Prepared Statements and atomic Transactions:
      - contacts: Ingress storage for JIDs, contact names, push names, and phone numbers with ON CONFLICT upsert rules.
      - lid_mappings: Bidirectional index mapping between modern WhatsApp @lid identifiers and phone-number @s.whatsapp.net addresses.
      - messages: Ingress and egress message persistence integrated directly into sock.getMessage, enabling automated E2EE decryption retry handling to rescue messages previously stalled in "Waiting for this message" state.
      - groups: Persistent group metadata caching integrated into cachedGroupMetadata to minimize redundant server IQ queries.

[+] 2. Authentication & Startup Lifecycle Stabilization (hab.js)
    › Patched the Cold-Restart Authentication Loop:
      - Root Cause: WhatsApp Web Companion protocol identifies active logins via creds.me without consistently flipping the legacy mobile SMS flag creds.registered to true.
      - Fix: Refactored startup gate in hab.js to evaluate Boolean(state.creds.me?.id || state.creds.registered), preventing redundant QR/pairing code CLI prompts when credentials already exist in the database.
      - State Synchronization: Automatically enforces state.creds.registered = true upon creds.update whenever state.creds.me.id is populated.
    › Startup Queue Tuning: Configured syncFullHistory: false, shouldSyncHistoryMessage: () => false, fireInitQueries: false, and maxRetryQueueSize: 32 to discard legacy message backlogs and achieve instantaneous socket readiness.
    › Silent Session Suppressor: Retained global console interceptor to block hardcoded libsignal raw SessionEntry byte buffer dumps from cluttering the terminal.

[+] 3. Zero-Upload-Latency Media Engine (.menu & myfunction.js)
    › Pre-Uploaded CDN Caching:
      - Addressed the 3-6 second upload latency caused by re-encrypting and uploading 2MB MP4 files to WhatsApp servers on every command execution.
      - Video and audio buffers are uploaded exactly once to WhatsApp CDN servers via prepareWAMessageMedia and cached in memory (RAM).
      - Subsequent .menu calls dispatch the cached CDN media tokens directly via relayMessage, dropping delivery latency globally to sub-100ms across all chats.
    › Fixed FFmpeg Video Bloat: Replaced H.264 baseline transcoding with stream copying (-c:v copy -an), preserving original 2MB file size and preventing 10MB inflation.
    › PTT Voice Note Playback Fix:
      - Enforced strict WhatsApp Voice Note encoding: 48kHz Mono Libopus (-ar 48000 -ac 1 -b:a 48k).
      - Stripped container tags and album art via -map_metadata -1 and synced timestamps with -avoid_negative_ts make_zero, resolving 0:00 duration freezes on mobile clients.
      - Implemented getAudioDuration to extract exact millisecond durations from FFmpeg stderr streams without requiring external ffprobe binaries.
      - Audio PTT is dispatched standalone without quoting the caller's message.
    › Layout & Attribution: Structured .menu output using the box(title, rows) visual format and attached verified channel attribution headers (forwardedNewsletterMessageInfo).

[+] 4. Deep Protocol Unwrapping & View Once Detection (myfunction.js)
    › Multi-Tiered View Once Detection (detectViewOnce):
      - Evaluates key.isViewOnce flags set directly during Baileys stanza decryption.
      - Inspects nested protobuf wrappers (viewOnceMessage, viewOnceMessageV2, viewOnceMessageV2Extension).
      - Performs deep JSON token inspection to prevent single-view media from being bypassed.
    › Recursive Payload Extraction (getMessageContent):
      - Recursively unrolls up to 10 layers of nested containers (ephemeralMessage, viewOnceMessageV2, documentWithCaptionMessage, associatedChildMessage) so the inner media node remains intact.
    › Logger Safeguard: Updated ./utils/logger.js to append the [VIEW ONCE / 1X] tag and eliminated early returns that previously discarded View Once packets with empty caption text.

[+] 5. Ingress & Channel Routing Unblocked
    › Removed the @newsletter ignore filter across hab.js (shouldIgnoreJid), handler.js, and ./utils/logger.js.
    › Added m.isNewsletter flag in smsg to distinguish broadcast channels from private chats and groups.
    › Channel posts, newsletter reactions, and admin metadata updates are now actively captured and displayed in the terminal event log.

[+] 6. Core Function Refactoring & Utilities (./utils/myfunction.js)
    › Relocated myfunction.js from project root to ./utils/myfunction.js and updated all relative module import graphs across handler.js, logger.js, and plugin files.
    › Fixed ESM Scope ReferenceError: Replaced broken CommonJS require() calls in getSystemInfo() with safe fs.readFileSync JSON ingestion for @rexxhayanasi/elaina-baileys metadata.
    › Enhanced getTimeInfo() to compute dynamic UTC timezone offsets (e.g. UTC+7 / UTC+8).
    › Added downloadMedia: Automatically inspects and unwraps inner media nodes (imageMessage, videoMessage, stickerMessage, audioMessage, documentMessage) and validates directPath and URL presence, resolving the "No valid media URL or directPath present" exception.
    › Added fetchBuffer: Native fetch abstraction for streaming remote API image buffers with automated HTTP error status checks.

[+] 7. Subsystem Tools & Sticker Generation Expansion (./plugins/tools/)
    › Added ./plugins/tools/sticker.js: Full-scale WebP sticker generator powered by wa-sticker-formatter (StickerTypes.FULL, medium quality compression, 9-second video threshold).
    › Added ./plugins/tools/brat.js: Text-to-sticker generator powered by external API streaming via fetchBuffer.
    › Added ./plugins/tools/bratg.js: Brat Girl variant text-to-sticker generator.
    › Added ./plugins/tools/fakeXNXX.js: Parameterized quote sticker generator with pipe-delimited argument parsing (name|quote|likes|dislikes).
    › Clean UX Formatting: Standardized tool responses into clean plain English Markdown without heavy unicode frames.

[+] 8. Error Barriers & Command Telemetry
    › Fixed Plugin Command Matching in handler.js: Corrected lookup logic to evaluate module.default.command and module.command across Arrays, Strings, and Regular Expressions.
    › Centralized Error Interceptor (errorHandler.js): Enclosed all plugin executions in an automated fault wrapper that catches exceptions, prints formatted stack traces to the console, and alerts the chat without crashing the Node.js process.
    › Distinct Command Logging: Added logger.command in ./utils/logger.js to separate regular chat events from executed commands.
    › Config-Driven Prefix Controller: Integrated config.json prefix engine allowing seamless runtime switching between single-prefix mode and multi-prefix arrays.

✧ File Modification Matrix (v1.0 vs v1.5) ✧

› .gitignore                ➜ Added database/, *.db, *.db-shm, *.db-wal.
› package.json              ➜ Added better-sqlite3 (^13.0.3) and wa-sticker-formatter (^4.4.4).
› config.json               ➜ Added stickerData and channelID parameters; updated prefix rules.
› hab.js                    ➜ Migrated auth to SQLite store; resolved session loop; unblocked channels.
› handler.js                ➜ Updated myfunction path; unblocked channels; fixed command matching.
› ./utils/store.js          ➜ NEW: SQLite database schema, WAL pragma, and event bindings.
› ./utils/myfunction.js     ➜ Relocated; added downloadMedia, fetchBuffer, detectViewOnce, getMessageContent.
› ./utils/logger.js         ➜ Updated import paths; unblocked channels; enhanced View Once logging.
› ./utils/errorHandler.js   ➜ Centralized plugin execution wrapper and global uncaught trap.
› ./utils/sticker.js        ➜ NEW: wa-sticker-formatter abstraction.
› ./plugins/general/menu.js ➜ Added pre-uploaded CDN relay, box layout, and PTT voice note.
› ./plugins/general/ping.js ➜ Verified execution benchmark.
› ./plugins/tools/sticker.js➜ NEW: Full-scale static & animated sticker creator.
› ./plugins/tools/brat.js   ➜ NEW: Brat text sticker generator.
› ./plugins/tools/bratg.js  ➜ NEW: Brat girl sticker generator.
› ./plugins/tools/fakeXNXX.js➜ NEW: Parameterized quote sticker generator.

✧ Technical Stack Summary ✧

› Baileys : @rexxhayanasi/elaina-baileys
› Persistence : SQLite (better-sqlite3 v13 / WAL Mode)
› Runtime     : Node.js (Native ESM, >= 20.0.0)
› Media Core  : FFmpeg (ffmpeg-static) & wa-sticker-formatter
› Developer   : habNoir

> habNoir

---

## ✧ Marimo ── v1.5.2 ✧
› Patch Release / Execution Lifecycle & Telemetry

This patch enhances command execution observability by introducing an automated message reaction lifecycle and real-time in-chat exception reporting.

✧ Technical Changes ✧

[+] Automated Command Reaction Lifecycle
    › Implemented m.react helper in ./utils/myfunction.js utilizing native Baileys reaction protocol stanzas ({ react: { text, key } }) with silent fault tolerance.
    › Integrated execution state transitions directly into executePlugin (./utils/errorHandler.js):
      - Ingress State  : Dispatches pending indicator (⌛) immediately upon command match.
      - Resolved State : Updates reaction to success indicator (✔️) upon clean completion.
      - Rejected State : Updates reaction to failure indicator (✖️) when a fault is caught.
    › Global Enforcement: Operates centrally across all current and future plugins without requiring boilerplate code in individual handlers.

[+] In-Chat Fault Telemetry & Traceability
    › Enhanced handlePluginError in ./utils/errorHandler.js to extract exact file origins and line numbers from caught Error.stack traces.
    › Automated Chat Reporting: When a plugin encounters a runtime fault, a structured diagnostic notice is dispatched directly to the active chat context:
      - Command Trigger
      - Exception Reason
      - Origin File & Line Reference
    › Dual Telemetry: Preserves detailed terminal stack traces while providing immediate debugging context directly within WhatsApp.

> habNoir

---

## ✧ Marimo ── v1.5.3 ✧
› Release Type : Minor
› Build Target : Node.js (Native ESM)

This release focuses on adding robust View Once message handling and plugin support so hidden or ephemeral media can be detected, cached, and processed without disrupting normal message flow.

✧ Changes ✧

[+] Added
    › Added a dedicated View Once detection and cache system to identify ephemeral media wrapped in nested message containers
    › Added support for reading View Once content through the plugin system, including the `readvo` / `rvo` / `viewonce` command flow
    › Added plugin-friendly handling for View Once payloads so commands can react to hidden media while preserving standard command execution
    › Added deeper detection coverage for `ephemeralMessage`, `viewOnceMessage`, `viewOnceMessageV2`, and related encrypted payload variants

[!] Fixed
    › Fixed handling for encrypted and nested View Once messages that previously failed to be recognized properly
    › Fixed message classification issues where hidden one-time media could be misread or skipped by the dispatcher
    › Fixed plugin execution reliability when a message arrived as a View Once payload instead of a normal direct message
    › Fixed stale or invalid cached View Once entries by enforcing TTL-based cleanup

[^] Performance
    › Optimized View Once cache pruning to reduce memory waste and keep message processing efficient
    › Reduced unnecessary work in the message pipeline by short-circuiting non-media or non-ephemeral paths earlier
    › Improved dispatch efficiency through centralized message normalization and event filtering

[~] Refactored
    › Refactored message preprocessing to normalize View Once state before plugin matching and command execution
    › Reorganized shared utility logic so View Once detection, media extraction, and cache handling are managed in a single consistent layer
    › Cleaned up plugin and handler integration to support dynamic subfolder-based plugin loading more consistently
    › Improved logging output for View Once traffic so hidden media events are easier to trace in runtime logs

[-] Deprecated
    › Deprecated legacy assumptions that only direct, non-ephemeral message objects were valid for normal plugin dispatch
    › Removed reliance on fragile one-off message handling patterns that were not resilient to nested WhatsApp ephemeral wrappers

✧ Metadata ✧

› Version : 1.5.3
› Engine  : @rexxhayanasi/elaina-baileys
› Storage : SQLite (WAL Mode)
› Author  : habNoir

> habNoir

---

## ✧ Marimo ── v1.5.4 ✧
› Maintenance & Patch Release / Session Protocol, Buffer Guards, & Downloader Subsystem

This release addresses core Baileys protocol-level session buffering, eliminates duplicate command re-executions during socket reconnections, automates SQLite signal pre-key garbage collection, stabilizes authentication gates, and introduces a native TikTok downloader plugin.

✧ Detailed Technical Breakdown ✧

[+] 1. Protocol Retry Buffer & Key Leak Guard (utils/store.js & hab.js)
    › Integrated custom msgRetryCounterCache adapter into makeWASocket options, delivering persistent in-memory E2EE decryption retry tracking.
    › Configured maxMsgRetryCount: 5 to cap decryption retries, preventing infinite request loops when WhatsApp re-transmits pre-keys, completely resolving session buffering stalls.

[+] 2. Automated SQLite Signal Pre-Key Garbage Collection (utils/store.js & hab.js)
    › Implemented store.pruneSessionKeys() to automatically prune obsolete Signal pre-keys from signal_keys table where CAST(id AS INTEGER) < (firstUnuploadedPreKeyId - 30).
    › Eliminated libsignal search stalls ("Closing open session in favor of incoming prekey bundle" & raw byte buffer dumps) caused by pre-key bloat.
    › Automated purge of stored messages older than 3 days during startup, connection open, and hourly background cycles.

[+] 3. Message Deduplication & Timestamp Age Guard (handler.js)
    › In-Memory Deduplication: Bound a 5,000-key sliding window Set (isMessageProcessed & markMessageProcessed) to guarantee every message ID (remoteJid:id) is executed at most once.
    › Message Timestamp Guard: Enforced a 60-second age limit (now - msgTimestamp > 60s) and startup threshold (msgTimestamp < BOT_START_TIME - 15s).
    › Offline Sync Filtering: Bypasses buffered stanzas and legacy offline sync payloads received during socket reconnection, preventing duplicate command re-execution ("resend command loop").

[+] 4. Session Startup Gate & Cold-Restart Pairing Fix (hab.js)
    › Refactored startup gate to evaluate Boolean(state.creds.registered || state.creds.me?.id).
    › Auto-Connection Priority: Ensures existing SQLite session database automatically connects without prompting CLI user for pairing code / QR code.
    › Strict Prompt Triggering: Restricted CLI pairing/QR prompts exclusively to clean/empty database states or explicit DisconnectReason.loggedOut (401) events.

[+] 5. Downloader Subsystem Expansion (./plugins/downloader/tiktok.js)
    › Added ./plugins/downloader/tiktok.js: High-speed TikTok video and audio downloader plugin (`.tt`, `.tiktok`, `.ttdl`).
    › Dual Scraping Engine: Implements primary ssstik.io direct HTML parsing with fallback to TikWM API (`https://www.tikwm.com/api/`).
    › Audio & Video Modes: Supports mp3 audio extraction (dispatched via native WhatsApp audio stanza) and mp4 video download.

✧ File Modification Matrix (v1.5.3 vs v1.5.4) ✧

› package.json                  ➜ Bumped version to 1.5.4.
› .gitignore                    ➜ Appended agent workspace rules.
› hab.js                        ➜ Integrated msgRetryCounterCache; added pruneSessionKeys; fixed auth gate.
› handler.js                    ➜ Added BOT_START_TIME, message timestamp age filter, and deduplication guard.
› ./utils/store.js              ➜ Added msgRetryCounterCache, isMessageProcessed, markMessageProcessed, and pruneSessionKeys.
› ./plugins/downloader/tiktok.js➜ NEW: Dual-engine TikTok mp3/mp4 downloader plugin.

✧ Metadata ✧

› Version : 1.5.4
› Engine  : @rexxhayanasi/elaina-baileys
› Storage : SQLite (WAL Mode)
› Author  : habNoir

> habNoir
