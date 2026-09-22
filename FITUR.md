# VeriPanen — Fitur, Isi, dan Guna (Laporan Lengkap)

## 0. Satu Paragraf: Ini Apa

VeriPanen adalah sistem **rekening bersama (escrow) untuk hasil panen** yang dinilai oleh **AI**, berjalan di **BNB Chain (opBNB Testnet, chain 5611; juga didukung Anvil/BNB Testnet 97)**. Masalah yang dipecahkan: petani dan pembeli di Indonesia sering tidak saling percaya. Pembeli takut barang tidak sesuai, petani takut tidak dibayar. VeriPanen menaruh uang pembeli di kontrak pintar, lalu dua tahap AI memeriksa: (1) kualitas panen saat didaftarkan, (2) apakah barang yang dikirim sama dengan yang dijanjikan. Kalau cocok, uang otomatis cair ke petani. Kalau tidak, sengketa dibuka.

---

## 1. Fitur Lengkap

### FITUR 1 — Pembuatan Listing (Petani)
**Apa:** Petani mendaftarkan panen: jenis tanaman, berat (kg), harga (tBNB), dan foto panen.
**Isi/Implementasi:** `frontend/src/components/farmer/CreateListingPanel.jsx`
- Foto di-hash SHA-256 di browser → jadi `photoHash` (sidik jari digital, tidak bisa diubah).
- Foto disimpan sebagai file lokal oleh agent (atau IPFS/Pinata kalau `PINATA_JWT` diisi).
- Panggil `createListing()` di kontrak.
**Guna:** Mengunci data awal sebagai titik referensi. Hash foto adalah bukti integritas — kalau foto diubah, hash beda, ketahuan.

### FITUR 2 — AI Grading Tahap 1 (Penilaian Panen)
**Apa:** AI melihat foto panen, kasih nilai **A / B / C** + tingkat keyakinan (0–100) + alasan.
**Isi/Implementasi:** `agent/src/grading/gradeHarvest.js`, `agent/src/flows.js` (`runGrading`)
- Grade A = bagus, B = sedang, C = buruk. Hanya A/B/C yang valid.
- Alasan harus array teks faktual (bukan opini).
- `confidence` integer 0–100.
**Guna:** Memberi pembeli penilaian objektif dan konsisten. AI tidak bisa "dibujuk" karena system prompt-nya tetap dan data user dipisah sebagai `<untrusted_listing_metadata>` (pertahanan prompt-injection).

### FITUR 3 — Ambang Keyakinan / Manual Review
**Apa:** Kalau AI kurang yakin (confidence di bawah `MIN_CONFIDENCE`), sistem **TIDAK menulis apa pun ke blockchain**. Listing masuk `MANUAL_REVIEW`.
**Isi/Implementasi:** `agent/src/flows.js` baris 39–50 dan 130–141; nilai di `agent/src/config.js` (`MIN_CONFIDENCE`)
**Guna:** Mencegah keputusan AI yang ragu masuk on-chain. Ini syarat non-negotiable spec (§3, §18). AI tidak boleh menebak saat ragu.
> **Nilai sekarang:** `MIN_CONFIDENCE=70` (default di `agent/src/config.js`, `resolveMinConfidence()`). Nilai <70 tetap boleh lewat env, tapi memicu warning ke stderr yang menandai itu khusus demo/testing.

### FITUR 4 — Escrow / Pendanaan (Pembeli)
**Apa:** Setelah listing punya grade, pembeli memasukkan uang sesuai harga. Uang ditahan kontrak, belum ke petani.
**Isi/Implementasi:** `HarvestEscrow.sol` fungsi `fundEscrow()` (baris 174). Wajib bayar **tepat** sesuai harga, kalau tidak → `IncorrectPayment`.
**Guna:** Uang aman ditahan. Petani tahu pembeli serius (uang sudah ada). Pembeli tahu uang tidak akan hilang sebelum barang terbukti.

### FITUR 5 — Penandaan Pengiriman (Petani)
**Apa:** Petani menandai barang sudah dikirim. Kontrak mulai hitung **tenggat 7 hari** (`DEFAULT_TIMEOUT`).
**Isi/Implementasi:** `HarvestEscrow.sol` `markShipped()` (baris 141). Set `deliveryDeadline = block.timestamp + 7 days`.
**Guna:** Memulai jam. Kalau pembeli tidak merespons dalam 7 hari, petani bisa ambil uangnya (Fitur 8).

### FITUR 6 — AI Verifikasi Pengiriman Tahap 2
**Apa:** Pembeli upload foto barang yang diterima. AI membandingkan **foto panen asli** vs **foto barang diterima** → `matched: true/false` + keyakinan + daftar perbedaan.
**Isi/Implementasi:** `agent/src/delivery/verifyDelivery.js`, `flows.js` (`runDeliveryVerification`)
- AI kirim DUA gambar sekaligus: (1) foto asli yang dinilai, (2) foto barang diterima.
- `matched=true` wajib punya `differences` kosong (dipaksa validasi).
- Foto asli diambil **dari blockchain**, bukan dari input pemanggil (anti-pemalsuan).
**Guna:** Membuktikan barang yang datang = barang yang dijanjikan. Ini inti kepercayaan — membandingkan "sebelum" dan "sesudah".

### FITUR 7 — Pencairan Otomatis / Sengketa
**Apa:** Kalau AI bilang `matched=true` → uang **otomatis** cair ke petani, status `Completed`. Kalau `false` → status `Disputed`, uang tetap ditahan.
**Isi/Implementasi:** `HarvestEscrow.sol` `postDeliveryVerification()` (baris 220). `_payout` hanya dipanggil kalau cocok.
**Guna:** Pembayaran otomatis tanpa perantara. Kalau tidak cocok, uang tidak hilang — masuk mekanisme sengketa.

### FITUR 8 — Klaim Setelah Tenggat (Perlindungan Petani)
**Apa:** Kalau sudah dikirim, lewat 7 hari, dan pembeli diam saja → petani bisa ambil uangnya.
**Isi/Implementasi:** `HarvestEscrow.sol` `claimAfterTimeout()` (baris 154).
**Guna:** Mencegah pembeli menahan uang selamanya dengan cara tidak merespons. Ada batas waktu yang jelas.

### FITUR 9 — Konfirmasi Terima (Perlindungan Pembeli)
**Apa:** Pembeli bisa langsung konfirmasi terima tanpa menunggu AI → uang cair ke petani.
**Isi/Implementasi:** `HarvestEscrow.sol` `confirmReceipt()` (baris 184).
**Guna:** Jalur cepat saat pembeli puas. Pembeli pegang kendali kapan dana dilepas.

### FITUR 10 — Penyelesaian Sengketa (Owner)
**Apa:** Saat `Disputed`, owner kontrak memutuskan: uang ke petani atau balik ke pembeli.
**Isi/Implementasi:** `HarvestEscrow.sol` `resolveDispute()` (baris 244).
**Guna:** Jalur terakhir kalau AI dan manusia tidak sepakat. Manusia tetap punya keputusan akhir.

### FITUR 11 — Buku Besar Publik (Public Ledger)
**Apa:** Halaman yang menampilkan semua listing + riwayat kejadian on-chain, bisa dilihat siapa saja.
**Isi/Implementasi:** `frontend/src/pages/PublicPage.jsx`, `LedgerTable.jsx`, `EventTimeline.jsx`, `ListingDetailPage.jsx`
**Guna:** Transparansi penuh. Semua pihak bisa memverifikasi riwayat. Ini kekuatan blockchain — catatan tidak bisa dihapus.

### FITUR 12 — Interface Pembeli
**Apa:** Halaman pembeli: lihat listing terbuka, danai, verifikasi pengiriman, lihat riwayat pembelian.
**Isi/Implementasi:** `frontend/src/pages/BuyerPage.jsx`, `OpenListingsPanel.jsx`, `MyPurchasesPanel.jsx`, `DeliveryVerificationForm.jsx`
**Guna:** Alur lengkap dari sisi pembeli tanpa perlu alat lain.

### FITUR 13 — Oracle Terpercaya & Rotasi Model AI
**Apa:** Hasil AI tidak boleh sembarang orang tulis. Hanya **alamat oracle** yang bisa posting. Kalau model AI utama error, sistem ganti ke model lain dari daftar (12 model).
**Isi/Implementasi:** `HarvestEscrow.sol` modifier `onlyOracle` (baris 97) + `setOracle()` (baris 259). `agent/src/ai/glm.js` rotasi model + backoff.
**Guna:** Keamanan (hanya oracle boleh menulis penilaian) + keandalan (gateway AI sering down, sistem tidak langsung mati).

### FITUR 14 — Pemisahan MIME Gambar (Deteksi Format dari Byte)
**Apa:** Mendeteksi format gambar asli (PNG/JPEG/GIF/WEBP) dari ciri byte pertama, bukan dari nama file.
**Isi/Implementasi:** `agent/src/ipfs/pinata.js` `sniffImageMime()`
**Guna:** Gateway AI menolak gambar kalau format yang dinyatakan tidak cocok dengan isi. Deteksi dari byte mencegah kegagalan ini.

### FITUR 15 — Pembersihan Input (Anti-Injection)
**Apa:** Semua teks dari user dibersihkan dan dibatasi panjangnya sebelum masuk ke AI.
**Isi/Implementasi:** `agent/src/validation/sanitize.js`, dipakai di kedua tugas AI. Bonus: system prompt tetap, data user di dalam blok `<untrusted_listing_metadata>`.
**Guna:** Mencegah orang menulis teks jahat di metadata untuk membelokkan AI.

### FITUR 16 — Preflight Wallet Sebelum Kirim Transaksi
**Apa:** Setiap transaksi tulis dari browser lewat satu gerbang pemeriksaan: chain benar, akun aktif benar, dan error nonce/RPC diterjemahkan jadi pesan yang bisa ditindaklanjuti.
**Isi/Implementasi:** `frontend/src/lib/txGuard.js` (logika murni + `describeTxError`), `frontend/src/lib/useWalletGuard.js` (hook, baca akun & chain live via `getAccount`/`getChainId` dari `@wagmi/core`). Dipakai di **semua** write: `CreateListingPanel`, `OpenListingsPanel`, `MyListingsPanel` (markShipped, claimAfterTimeout), `MyPurchasesPanel` (confirmReceipt), `ListingDetail` (Actions).
**Guna:** Menghentikan transaksi yang pasti gagal sebelum mencapai wallet (network salah → diblokir), dan mengubah error nonce yang membingungkan jadi instruksi jelas ("reset activity/nonce di MetaMask"). Akun dibaca ulang dari provider, jadi alamat lama yang basi tidak pernah dipakai untuk menandatangani.

---

## 2. Mesin Status Kontrak (Alur)

Status listing bergerak **hanya** lewat urutan ini (dipaksa oleh modifier `atStatus`):

```
Created  ──[AI grading Tahap 1]──>  Graded
Graded   ──[pembeli fundEscrow]──>  Funded
Funded   ──[petani markShipped]──>  Shipped
Shipped  ──[AI verifikasi Tahap 2: cocok]──>  Completed (uang cair)
Shipped  ──[AI verifikasi Tahap 2: tidak cocok]──>  Disputed
Shipped  ──[pembeli confirmReceipt]──>  Completed (uang cair)
Shipped  ──[petani claimAfterTimeout]──>  Completed (uang cair)
Disputed ──[owner resolveDispute]──>  Completed (uang ke salah satu pihak)
```

Setiap langkah salah urutan → revert `InvalidStatus`. Tidak ada jalan pintas.

---

## 3. Komponen Sistem

| Komponen | Teknologi | Lokasi | Fungsi |
|---|---|---|---|
| Kontrak pintar | Solidity 0.8.28, Foundry | `contract/src/HarvestEscrow.sol` | Menahan uang, menyimpan data, menegakkan aturan status |
| Agen AI | Node.js, viem | `agent/` | Menilai panen, verifikasi pengiriman, menulis hasil ke chain |
| API agen | HTTP di :8787 | `agent/src/server.js` | 4 endpoint: `/api/health`, `/api/upload`, `/api/grade`, `/api/verify-delivery` |
| Frontend | React 19, Vite, wagmi, RainbowKit | `frontend/` | 4 halaman: Petani, Pembeli, Ledger, Detail Listing |
| Penyimpanan gambar | File lokal agent (atau IPFS/Pinata) | `agent/src/ipfs/pinata.js` | Menyimpan foto; `file://` dipakai supaya URI on-chain tetap pendek |
| Penyedia AI | Gateway 9router (model `thirty/`) | `agent/src/ai/glm.js` | Akses model vision |

---

## 4. Data yang Disimpan On-Chain per Listing

Dari struct `Listing` di kontrak:
- `listingId`, `farmer`, `buyer` — identitas
- `cropType`, `weightKg`, `priceWei` — detail dagangan
- `photoHash`, `photoURI` — bukti foto + lokasi
- `grade`, `gradeReasonURI`, `gradeConfidence` — hasil AI Tahap 1
- `deliveryVerified`, `deliveryMatched`, `deliveryReasonURI`, `deliveryConfidence` — hasil AI Tahap 2
- `status`, `deliveryDeadline` — status & tenggat

---

## 5. Keamanan (Apa yang Dijaga & Bagaimana)

| Ancaman | Pertahanan |
|---|---|
| Orang palsu menulis nilai AI | Modifier `onlyOracle` — hanya alamat oracle |
| AI menebak saat ragu | Ambang keyakinan → `MANUAL_REVIEW`, tidak posting on-chain |
| Prompt injection lewat metadata | System prompt tetap + data user dalam blok tak-terpercaya + sanitasi |
| Palsukan foto jadi | `photoHash` SHA-256 dikunci saat listing dibuat |
| Pakai foto asli palsu saat verifikasi | Foto asli diambil dari blockchain, bukan dari pemanggil |
| Reentrancy (pembayaran berulang) | `ReentrancyGuard` OpenZeppelin di semua fungsi bayar |
| Pembeli tahan uang selamanya | Tenggat 7 hari + `claimAfterTimeout` |
| Pembayaran salah jumlah | `fundEscrow` wajib `msg.value == priceWei` |
| Beda jaringan | Resolusi chain (`frontend/src/config/chain.js`): (1) `VITE_CHAIN_ID` diset → itu yang menang; (2) RPC localhost/127.0.0.1 → Anvil 31337; (3) selain itu → default 97. **Untuk deploy opBNB Testnet, `VITE_CHAIN_ID=5611` WAJIB diset**, kalau tidak frontend jatuh ke 97 dan setiap transaksi gagal. Plus preflight frontend yang memblokir transaksi saat network wallet salah |

---

## 6. Bukti Sudah Berjalan (Verified)

| Aspek | Hasil |
|---|---|
| Tes kontrak (`forge test`) | **33 lulus, 0 gagal** |
| Tes agen (`node --test`) | **26 lulus, 0 gagal** |
| Tes frontend (`npm test`) | **16 lulus, 0 gagal** (preflight wallet, pemetaan error, validasi URI) |
| Demo end-to-end Anvil | Jalur sukses, sengketa, klaim timeout, oracle tak sah — semua lolos |
| AI Tahap 1 live | Grade `A`, keyakinan `88%`, tercatat on-chain |
| AI Tahap 2 live | `matched: true`, keyakinan `98%`, listing `Completed` |
| Deploy opBNB Testnet (5611) | Kontrak live di `0xE07e56Af882368bc604F047Ed092A0C139c72809` |
| Frontend build | Sukses, 4 halaman tampil |

---

## 7. Ringkasan Guna (Kenapa Ini Penting)

1. **Petani terlindungi** — barang sudah jalan, tapi ada jaminan bayar; ada klaim timeout kalau pembeli diam.
2. **Pembeli terlindungi** — uang ditahan; AI memverifikasi barang = janji; ada jalur sengketa.
3. **AI menggantikan penilai manusia** — murah, cepat, konsisten, tidak bisa disuap. Tapi hanya saat **yakin**; kalau ragu, serahkan ke manusia.
4. **Blockchain memberi bukti** — hash foto dan riwayat lengkap tidak bisa diubah atau dihapus. Sengketa diselesaikan dengan data, bukan tuduhan.
5. **Tanpa perantara bank** — dana cair otomatis lewat aturan kontrak, bukan lewat pihak ketiga.

Inti: **AI menilai, blockchain memegang uang, aturan yang mengikat keduanya, dan manusia tetap jadi hakim terakhir saat AI ragu atau pihak bersengketa.**
