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

## Ringkasan

Marimo adalah bot WhatsApp Multi-Device yang ringan dan berperforma tinggi, dibangun dari dasar menggunakan `@rexxhayanasi/elaina-baileys`. Dirancang khusus untuk pengiriman pesan dengan latensi rendah, manajemen siklus hidup koneksi yang stabil, pembongkaran envelope protokol secara mendalam, serta arsitektur plugin modular yang dinamis.

## Keunggulan Arsitektur

| Fitur | Deskripsi Teknis |
|---|---|
| Gateway Koneksi Ganda | Mendukung kode pairing 8 karakter dengan validasi nomor internasional dan tampilan QR code di terminal. |
| Relay Media Tanpa Jeda | Menggunakan `prepareWAMessageMedia` dan `relayMessage` untuk menyimpan token CDN yang diunggah di memori (RAM), menghilangkan proses unggah ulang (respons di bawah 100ms). |
| Pemeriksa View Once Mendalam | Membongkar hingga 10 lapisan container bersarang (`ephemeralMessage`, `viewOnceMessageV2`, dan lainnya) untuk mendeteksi media sekali lihat secara akurat. |
| Transcoding PTT yang Ketat | Meng-encode audio melalui FFmpeg ke format 48kHz Mono Libopus dengan penghapusan metadata penuh (`-map_metadata -1`) agar waveform dan pemutaran tetap sinkron. |
| Caching Kunci Sinyal di Memori | Membungkus penyimpanan kunci autentikasi menggunakan `makeCacheableSignalKeyStore` untuk meminimalkan operasi baca-tulis disk saat proses dekripsi ratchet E2EE. |
| Penangkap Error Terpusat | Manajemen kesalahan global yang menangkap exception tak tertangani dan error plugin, lengkap dengan stack trace di terminal dan notifikasi otomatis ke chat. |
| Plugin Subfolder Dinamis | Menemukan dan memuat modul command secara dinamis dari subdirektori di dalam `./plugins/`. |
| Mesin Prefix Berbasis Konfigurasi | Mendukung pergantian instan antara mode prefix tunggal dan array multi-prefix langsung melalui `config.json`. |

## Struktur Direktori

```
marimo/
├── config.json              # Konfigurasi global bot & aturan prefix
├── package.json             # Daftar dependencies dan deklarasi modul ESM
├── hab.js                   # Gateway utama, kontrol socket & mesin startup
├── handler.js                # Dispatcher pesan, pengecekan izin & parser command
├── myfunction.js             # Utilitas inti, info sistem & konverter media
├── media/
│   ├── menu_gif.mp4          # Aset video GIF utama
│   └── menu_voice.ogg        # Aset suara 48kHz Mono Opus utama
├── utils/
│   ├── logger.js              # Pelapor status Unicode & pemeriksa event
│   └── errorHandler.js        # Interceptor eksekusi terpusat & pencegah crash
└── plugins/
    └── general/
        ├── ping.js            # Utilitas benchmark ping
        └── menu.js            # Menu kategori interaktif dan dinamis
```

## Prasyarat

- **Node.js**: versi 20.0.0 atau lebih baru (disarankan Node.js 22+)
- **FFmpeg**: ditangani otomatis melalui `ffmpeg-static` (atau binary yang sudah terpasang di sistem)
- **Git**

## Instalasi

**1. Clone Repository**

```bash
git clone https://github.com/habNoir/marimo.git
cd marimo
```

**2. Install Dependencies**

```bash
npm install
```

**3. Konfigurasi Environment**

Sesuaikan `config.json` dengan kebutuhan deployment kamu:

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
    "multi": true,
    "single": "!",
    "list": ["!", ".", "/", "#", "?"]
  }
}
```

## Menjalankan Bot

Jalankan mesin utama:

```bash
node hab.js
```

Saat pertama kali dijalankan tanpa sesi aktif, pilih salah satu:

1. **Pairing Code** — masukkan nomor telepon tanpa tanda `+` dan angka `0` di depan
2. **QR Code** — pindai melalui menu Perangkat Tertaut di aplikasi WhatsApp

## Spesifikasi Plugin

Plugin berupa modul ES yang ditempatkan di dalam `./plugins/<kategori>/<namafile>.js`. Handler akan otomatis memetakan kategori berdasarkan nama subfolder.

```javascript
const handler = async (m, { conn, args, usedPrefix, command }) => {
  await m.reply('Operational confirmation payload.')
}

handler.help = ['example']
handler.tags = ['general']
handler.command = ['example', 'test']

// Guard Izin (opsional):
// handler.owner = true      // Hanya untuk owner bot yang terdaftar
// handler.group = true      // Hanya berlaku di dalam grup
// handler.private = true    // Hanya berlaku di chat pribadi
// handler.admin = true      // Pengirim harus admin grup
// handler.botAdmin = true   // Bot harus memiliki hak admin grup

export default handler
```

## Standar Logging Terminal

Terminal menggunakan format Unicode khusus dengan indikator berikut:

| Simbol | Arti | Keterangan |
|---|---|---|
| `[+]` | Success | Operasi dan koneksi berhasil |
| `[-]` | Failed | Error dan exception yang tertangkap |
| `[!]` | Warning | Peringatan, rate-limit, atau penolakan izin |
| `[*]` | Info | Notifikasi operasional umum |
| `[~]` | Process | Tugas latar belakang dan proses handshake kriptografi |
| `[>]` | Running | Status dispatch dan eksekusi command |

## Lisensi

Proyek ini dilisensikan di bawah **MIT License**.

<div align="center">

─────────────────────────────────────────────────────────────

*Dikembangkan oleh habNoir — dibangun untuk kecepatan dan keandalan.*

─────────────────────────────────────────────────────────────

</div>
