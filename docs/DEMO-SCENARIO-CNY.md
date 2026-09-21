# Skenario Demo 2 — Quotation Berdenominasi CNY & Rate Sensitivity (v3.0)

> **Status terhadap PRD/Technical Logic v3.0.** Revisi struktural penuh
> mengikuti hasil demo review (`transcribe.md`). Menggantikan mekanisme
> "Mineral Index Global Adjustment" (v2.1) — dikonfirmasi bahwa dampak
> HMA/HPM ke harga VKTR berjalan **hanya lewat kurs**, sehingga fokus
> skenario ini bergeser ke **Rate Sensitivity Threshold** (FR-1.4.6):
> exchange rate otomatis mingguan, notifikasi saat kurs bergerak
> melebihi ambang, dan tombol Hitung Ulang eksplisit.
>
> **Koreksi mata uang (baru).** Skenario ini sebelumnya bernama
> `DEMO-SCENARIO-USD.md` dengan basis USD. Demo review mengoreksi hal
> ini: FOB Price komponen impor VKTR dikutip vendor **dalam CNY**
> (BOM bersumber dari Cina), dan diskusi *rate sensitivity threshold*
> BOD eksplisit membahas **RMB** (kurs ilustratif Rp 2.500–2.700/RMB) —
> bukan USD/IDR (Rp 16.000-an). Seluruh angka pada dokumen ini kini
> memakai basis **CNY→IDR**. USD tetap tersedia sebagai *toggle
> tampilan opsional* ke customer, terpisah dari basis kalkulasi.

Skenario kedua untuk mendemokan kemampuan v3.0: **input multi-currency
(CNY)** pada komponen impor kelompok **COGS** (FOB Price in CNY), dan
**Rate Sensitivity Threshold** yang menggantikan adjustment mineral
independen.

Berbeda dari [`DEMO-SCENARIO.md`](DEMO-SCENARIO.md) yang memakai lini
B2G dengan input Rupiah, skenario ini memakai **B2B Commercial Fleet
dengan input CNY** — mencerminkan kenyataan bahwa FOB Price dikutip
vendor dalam Renminbi (Yuan China).

| | |
|---|---|
| **Lini bisnis** | B2B Commercial Fleet |
| **Mata uang input** | CNY (Renminbi/Yuan) |
| **Margin Tier Authority** | Sama seperti skenario 1 (Tier 1 ≥15%, Tier 2 12–15%, Tier 3 <12%) — dapat di-*scope* berbeda per lini bisnis bila dikonfirmasi VKTR |
| **Fitur yang disorot** | FR-1.4 (multi-currency, basis CNY), FR-1.4.6 (Rate Sensitivity Threshold), FR-8 (Mineral Index — referensi saja), Module 6 (margin-tier negotiation) |

> **Prasyarat.** Skema v3.0 (`cost_item` 4 kelompok, `exchange_rate`
> dengan `base_currency = CNY` dan `source = bank-api`,
> `rate_sensitivity_config`) sudah di-migrasi, dan `npm run seed:demo`
> sudah dijalankan. Untuk mengulang skenario, gunakan `npm run reset:demo`.

---

## 0. Peran yang Dipakai

| Login sebagai | Email | Tugas |
|---|---|---|
| **System Admin** | admin@vktr.demo | Menetapkan kurs CNY awal & ambang sensitivitas sebelum demo dimulai |
| **Sales Officer** | sales@vktr.demo | Membuat quotation CNY, mengajukan diskon |
| **VP Operations** | vpops@vktr.demo | Mengisi kelompok COGS & Add-Ons (dalam CNY) |
| **VP Finance** | vpfinance@vktr.demo | Mengisi kelompok Profitability |
| **Chief Sales** | chiefsales@vktr.demo | Approve akhir (memicu Release Gate) |
| **BOD 1 & BOD 2** | bod1@vktr.demo, bod2@vktr.demo | Memutus diskon Tier 3 |

Password semua akun: `PriceCore123!`

---

## 1. Persiapan — Admin menetapkan kurs CNY awal & ambang sensitivitas

Seluruh angka pada dokumen ini dihitung dengan **kurs awal 2.600**
(Rp per 1 CNY/RMB) dan **ambang sensitivitas 2%** — konsisten dengan
angka ilustratif yang didiskusikan BOD pada demo review (kisaran
2.500–2.700).

1. Login sebagai **admin@vktr.demo** → **Master Data & Exchange Rate**.
2. Panel **Nilai Tukar CNY → IDR**: bila kurs berlaku bukan `2600`,
   simpan kurs baru `2600` dengan `source = manual` (mensimulasikan
   override sebelum job otomatis pertama berjalan).
3. Panel **Rate Sensitivity Config**: pastikan `threshold_pct = 2%`.
4. *(Opsional)* Panel **Nilai Tukar USD → IDR** — kurs tampilan
   terpisah, tidak memengaruhi kalkulasi COGS. Boleh dilewati bila
   toggle USD tidak didemokan.
5. *(Opsional, untuk konteks)* Panel **Harga Mineral Acuan (HMA)** tetap
   ada sebagai referensi — pastikan HMA `NI` terisi `16646`, periode
   hari ini. **Catat**: nilai ini **tidak lagi memengaruhi kalkulasi
   harga** pada v3.0 (lihat §5).

> Bila kurs Anda berbeda, seluruh angka Rupiah di bawah akan bergeser
> proporsional. Angka **CNY** dan **GPM** tetap sama karena tidak
> bergantung pada kurs.

---

## 2. Langkah 1 — Sales Officer membuat quotation CNY

1. Login sebagai **sales@vktr.demo** → **Pricing Proposals → Proposal Baru**.
2. Isi:
   - Nama Customer: `PT Anteraja Logistik`
   - Nama Proyek/Lokasi: `Armada EV Truck Jabodetabek`
   - Sistem generate Project Identifier, mis. `PRJ-AAL-2026-004`
   - Lini Bisnis: **B2B Commercial Fleet**
   - Jumlah Unit: `12`
   - **Mata Uang Input: CNY (Renminbi/Yuan)** ← inti skenario ini
3. Klik **Buat Draft & Submit** → `resolveWorkflowTemplate` memilih
   Workflow Template untuk `B2B_FLEET`.

**Yang harus terlihat:** pada CBS Cost Line, kolom nilai kelompok COGS
bertuliskan **`¥ / unit`** (CNY) — bukan `Rp / unit`. Kelompok Sales
tetap dalam IDR (STNK, insurance, dsb. berdenominasi lokal) — dua mata
uang hidup berdampingan pada satu quotation sesuai `denomination` per
`cost_item` (Technical Logic §2.1).

---

## 3. Langkah 2 — VP Operations mengisi kelompok COGS & Add-Ons (CNY)

Masih mengikuti urutan aktor terkoreksi: **VP Operations mengisi lebih
dulu**, bukan Sales.

1. Logout, login sebagai **vpops@vktr.demo**, buka quotation yang sama.
2. Isi kelompok **COGS** — **nilai dalam CNY (¥) per unit**:

   | Item | Nilai (¥/unit) |
   |---|---|
   | FOB Price in CNY | 283.000 |
   | FOB Price in IDR *(dikonversi sistem, tidak diinput manual)* | *auto* |
   | Freight and Insurance | 13.600 |
   | Custom Duties | 20.800 |
   | Port Handling, Clearance, and Pre-Delivery Inspection | 6.200 |
   | Carrosserie Allocation | 76.700 |
   | Assembly Cost | 16.900 |
   | Local Parts | 9.700 |
   | Accessories | 3.100 |
   | Telematics | 2.100 |
   | Warehousing and Storage | 1.550 |
   | Warranty Cost | 12.000 |
   | Initial Energy Injection | 1.050 |
   | Administrative Cost | 1.950 |

3. Isi kelompok **Add-Ons**:

   | Item | Nilai (¥/unit) | Catatan |
   |---|---|---|
   | Processing Service | 1.350 | |
   | Delivery Service | *(kosongkan)* | `may_follow_later` |
   | KEUR | 900 | |
   | Additional | 0 | |

4. **Simpan & Hitung Ulang Harga**, lalu **Approve**.

**Yang didemokan (FR-1.4.1):** angka yang diketik tersimpan **apa
adanya dalam CNY**. Konversi ke Rupiah hanya terjadi saat menghitung —
`last_calculated_rate_id` pada proposal dicatat sebagai kurs 2.600
yang dipakai saat ini (Technical Logic §12.2, §12.5).

---

## 4. Langkah 3 — VP Finance mengisi kelompok Profitability

1. Logout, login sebagai **vpfinance@vktr.demo**.
2. Isi margin **sengaja rendah** dulu untuk mendemokan guardrail:

   | Item | Nilai |
   |---|---|
   | VKTS Profit Before Tax (¥/unit) | 5.800 |
   | VKTS Margin (%) | 2 |
   | VKTR Profit Before Financing Cost (¥/unit) | 3.200 |
   | Financing Cost (%) | 1,5 |
   | VKTR Margin After Financing Cost (%) | 1,5 |

3. **Simpan & Hitung Ulang Harga** → banner merah muncul: GPM akhir
   jatuh ke **Tier 3** (di bawah 12%).
4. Perbaiki margin:

   | Item | Nilai baru |
   |---|---|
   | VKTS Margin (%) | 8 |
   | Financing Cost (%) | 6 |
   | VKTR Margin After Financing Cost (%) | 5 |

5. **Simpan & Hitung Ulang Harga** → banner hilang, GPM akhir naik ke
   **Tier 1** (≥15%).
6. Klik **Approve**.

### Angka yang harus terlihat

| | Nilai |
|---|---|
| Total biaya per unit (kelompok COGS + Add-Ons) | ± ¥ 451.000 |
| **Final Price** | **Rp x.xxx M** ≈ **¥ y.yyy** (dua mata uang tampil sekaligus, FR-1.4.4) |
| **GPM akhir** | ≥ 15% (Tier 1) |
| **Tier margin** | 1 — Auto |
| **Kurs yang dipakai** | 2.600 (tercatat di `proposal_calculation_result.exchange_rate_used`) |

---

## 5. Langkah 4 — Chief Sales merilis quotation

1. Logout, login sebagai **chiefsales@vktr.demo**.
2. Klik **Approve** → **Release Gate** berjalan (komponen mandatory
   lengkap kecuali Delivery Service yang `may_follow_later`, seluruh
   COGS Owner setuju, Tier margin terpenuhi).
3. Status menjadi **`Quotation Released`**, PDF dibuat via Format
   Quotation Template.

---

## 6. Langkah 5 — Kurs bergerak: Rate Sensitivity Threshold beraksi

Inti skenario v3.0, menggantikan mekanisme HMA/HPM adjustment lama.
Angka di bawah mengikuti pola diskusi BOD pada demo review: kurs
bergerak dari sekitar 2.500 ke 2.700, dengan ambang 2% menentukan kapan
harga perlu disesuaikan.

### 6a. Pergerakan di bawah ambang (2%) — tidak ada notifikasi

1. Login sebagai **admin@vktr.demo**, ubah kurs manual menjadi
   **2.635** (naik ±1,3% dari 2.600).
2. Buka kembali quotation dari §4 sebagai peran manapun.
3. **Tidak ada banner** yang muncul — pergerakan 1,3% berada **di
   bawah** ambang 2%. Harga quotation tetap memakai kurs 2.600 lama.

**Yang didemokan:** FR-1.4.6 — sistem tidak "berkedip" mengubah harga
pada pergerakan kurs kecil.

### 6b. Pergerakan melebihi ambang — notifikasi & Hitung Ulang eksplisit

1. Sebagai **admin@vktr.demo**, ubah kurs lagi menjadi **2.705** (naik
   ±4% dari kurs terakhir yang dipakai quotation, 2.600).
2. Buka kembali quotation yang sama sebagai **sales@vktr.demo**.
3. **Banner muncul**: *"Kurs CNY/IDR (RMB) telah diperbarui menjadi
   2.705 — melebihi ambang sensitivitas 2%"*. Terlihat oleh siapa pun
   yang membuka quotation ini (Sales, VP Finance, Chief Sales).
4. **Harga tetap tidak berubah** sampai seseorang menekan tombol
   **"Hitung Ulang"** secara eksplisit.
5. Klik **Hitung Ulang** — `proposal_calculation_result` baru dibuat
   dengan `exchange_rate_used = 2.705`; harga IDR naik proporsional,
   angka CNY tidak berubah, GPM tidak berubah (biaya & harga jual dalam
   CNY tetap konsisten, hanya representasi IDR-nya bergeser).

**Tiga hal yang layak ditekankan:**

1. **Notifikasi bukan auto-recalculate** — perubahan harga selalu butuh
   aksi eksplisit, mencegah harga bergerak diam-diam di belakang Sales.
2. **Baris lama tetap utuh** (`proposal_calculation_result` sebelumnya
   tidak ditimpa) — konsisten dengan Rate Locking (§12.3).
3. **Job otomatis mingguan** (Senin 00:01) menjalankan pull yang sama
   dari API bank tanpa intervensi Admin — override manual di atas hanya
   untuk mensimulasikan pergerakan kurs saat demo. Ini juga
   mempraktikkan langsung ilustrasi BOD: "kalau di-*in between*, kita
   ambil yang bawah — sekarang RMB 2.635, berarti pakai 2.600; tapi
   saat 2.705, baru naik ke 2.700".

---

## 7. Langkah 6 — Mineral Index sebagai referensi, bukan adjustment

Berbeda dari POC v2.1 (di mana perubahan HMA otomatis mengalikan faktor
ke FOB Price, item yang mengandung nilai battery pack), pada v3.0
**HMA/HPM murni informasi**.

1. Login sebagai **admin@vktr.demo** → **Master Data → Mineral Index**.
2. Ubah HMA `NI` menjadi **18.311** (naik 10%).
3. HPM berjalan naik menjadi ±**60,83 US$/WMT** — **ditampilkan** di
   panel referensi (HMA/HPM tetap dalam US$, standar internasional
   Kepmen ESDM — tidak terkait dengan basis CNY di atas).
4. Buka quotation dari §4 → panel **Mineral Index (Referensi)**
   menampilkan HPM baru dan HMA yang dipakai, **namun**:
   - `mineral_adjustment_factor` pada hasil kalkulasi tetap **1.0**.
   - **Final Price TIDAK berubah** akibat perubahan HMA ini semata.
   - Hanya perubahan **kurs CNY/IDR** (§6) yang benar-benar
     menggerakkan harga.

**Yang didemokan:** FR-8.3 status *dicabut/nonaktif* (Technical Logic
§13) — mencegah dampak ganda (kurs + faktor mineral independen)
terhadap komponen impor yang sama.

---

## 8. Langkah 7 — Negosiasi diskon pada quotation CNY (Margin-Tier)

1. Sebagai **sales@vktr.demo**, ajukan diskon **1%** (mode Persentase)
   → sistem menghitung GPM akhir, masih **Tier 1** → auto-release.
2. Ajukan **5%** (mode Rupiah kali ini) → GPM akhir turun ke bawah 15%
   → **Tier 2**, status `PENDING_TIER2_APPROVAL`. Login berturutan
   sebagai **sales@vktr.demo**, **vpfinance@vktr.demo**,
   **chiefsales@vktr.demo** untuk memberi ACK — ketiganya wajib approve
   (AND-join).
3. Pada **quotation revisi berikutnya** (via Project Identifier yang
   sama), ajukan diskon besar (mis. **12%**) → GPM akhir jatuh ke
   **Tier 3**. Login sebagai **bod1@vktr.demo**, pilih **Revise**
   dengan counter **6%** → tier dievaluasi ulang, jatuh ke Tier 2 (3
   pihak) — bukan otomatis disetujui.

**Yang didemokan:** model tier yang sama berlaku lintas lini bisnis
(B2G maupun B2B) — hanya ambang GPM per tier yang berpotensi berbeda
bila dikonfigurasi per `business_line` (Technical Logic §2.1
`margin_tier_authority.business_line`).

---

## 9. Langkah 8 — Slider FX di DSS

1. Buka **Decision Support (DSS)**, pilih quotation ini.
2. Geser slider **FX Delta (%)** — Base Case vs Simulated Case berubah
   seketika: GPM, EBITDA, BEP menyesuaikan konversi CNY→IDR.
3. Slider **HMA Delta (%)** tersedia namun **tidak mengubah Final
   Price** — hanya menggeser angka HPM referensi (§7), konsisten dengan
   status nonaktifnya faktor adjustment mineral pada v3.0.

**Yang didemokan:** simulasi memakai **engine yang sama** dengan
kalkulasi resmi, dan **hanya FX (basis CNY) yang aktif memengaruhi
harga** — tidak ada kejutan simulasi vs kenyataan.

---

## 10. Ringkasan Perbandingan Dua Skenario

| | Skenario 1 (B2G, IDR) | Skenario 2 (CNY) |
|---|---|---|
| Lini bisnis | B2G Tender Bus | B2B Commercial Fleet |
| Mata uang input kelompok COGS | IDR | **CNY (Renminbi/Yuan)** |
| Urutan aktor | Sales → VP Ops → VP Finance → Chief Sales | Sama |
| Jumlah unit | 30 | 12 |
| Fitur khas | Fraud Guard, Project Identifier revisi | **Rate Sensitivity Threshold, Mineral Index sebagai referensi** |
| Margin-Tier Negotiation | Tier 1→2→3 dengan Revise loop | Tier 1→2→3, ambang sama (dapat di-*scope* beda per lini bisnis) |

---

## 11. Catatan Batasan & Open Items

- **Kurs ditarik otomatis mingguan dari API bank** (BCA disebut
  eksplisit di demo review) — override manual tetap tersedia untuk
  Admin. Kurs mana yang dipakai (tengah/jual/pajak), dan apakah BCA
  menyediakan API kurs CNY (bukan hanya USD), masih perlu dikonfirmasi
  (Technical Logic §14 no. 8).
- **Ambang sensitivitas 2% bersifat ilustratif** — perlu dikonfirmasi
  bersama Finance/BOD sebelum go-live.
- **Mineral Index Global Adjustment (v2.1) dinonaktifkan** — dicatat
  sebagai spesifikasi cadangan (Technical Logic §13.2) bila di masa
  depan ditemukan komponen mineral yang bergerak independen dari kurs.
- **Mengganti mata uang setelah cost line terisi tidak mengonversi
  nilai lama** — Angka tetap apa adanya dan kini dibaca sebagai mata
  uang baru (FR-1.4.5), tidak berubah dari v2.1.
- **Kepemilikan cost group (COGS/Add-Ons → VP Operations) masih
  asumsi**, sama seperti skenario 1 — lihat Technical Logic §14 no. 12.
- **Toggle tampilan USD** (opsional, FR-1.4.1) belum didemokan pada
  skenario ini — bila dibutuhkan untuk klien yang minta penawaran
  dalam USD, perlu skenario tambahan yang menunjukkan kedua kurs (CNY
  basis kalkulasi, USD tampilan) berjalan berdampingan.
