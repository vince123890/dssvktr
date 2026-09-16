# Skenario Demo 2 — Quotation Berdenominasi USD

Skenario kedua untuk mendemokan kemampuan v2.1: **input multi-currency
(USD)** dan **penyesuaian Harga Mineral Acuan (HMA → HPM)**.

Berbeda dari [`DEMO-SCENARIO.md`](DEMO-SCENARIO.md) yang memakai lini
B2G dengan input Rupiah, skenario ini memakai **B2B Commercial Fleet
dengan input USD** — mencerminkan kenyataan bahwa komponen impor VKTR
(battery pack, chassis, powertrain) dikutip vendor dalam dolar.

| | |
|---|---|
| **Lini bisnis** | B2B Commercial Fleet |
| **Mata uang input** | USD |
| **Ambang GPM** | 16,0% |
| **Fitur yang disorot** | FR-1.4 (multi-currency), Module 8 (HMA/HPM), FR-6 (negosiasi) |

> **Prasyarat.** Migration `0009` & `0010` sudah dijalankan, dan
> `npm run seed:demo` sudah pernah dijalankan. Untuk mengulang skenario,
> gunakan `npm run reset:demo`.

---

## 0. Peran yang Dipakai

| Login sebagai | Email | Tugas |
|---|---|---|
| **System Admin** | admin@vktr.demo | Menetapkan kurs & HMA sebelum demo dimulai |
| **Sales Officer** | sales@vktr.demo | Membuat quotation USD, mengajukan diskon |
| **VP Operations** | vpops@vktr.demo | Memvalidasi 13 komponen operasional |
| **VP Finance** | vpfinance@vktr.demo | Memvalidasi 5 komponen finansial & margin |
| **Chief Sales** | chiefsales@vktr.demo | Approve akhir (memicu Release Gate) |
| **BOD** | bod@vktr.demo | Memutus diskon di luar wewenang Chief Sales |

Password semua akun: `PriceCore123!`

---

## 1. Persiapan — Admin menetapkan kurs & HMA

Seluruh angka pada dokumen ini dihitung dengan **kurs 16.350** dan
**HMA Ni 16.646 US$/dmt**. Pastikan keduanya berlaku sebelum mulai.

1. Login sebagai **admin@vktr.demo** → **Master Data & CBS**.
2. Panel **Nilai Tukar USD → IDR**: bila kurs berlaku bukan `16350`,
   simpan kurs baru `16350`.
3. Panel **Harga Mineral Acuan (HMA)**: bila HMA `NI` bukan `16646`,
   simpan HMA baru — mineral `NI`, nilai `16646`, periode hari ini,
   referensi `Kepmen ESDM No. 144.K/2026`.
4. Perhatikan HPM berjalan menunjukkan **55,64 US$/WMT** dengan CF Nikel
   30,0%.

> Bila kurs atau HMA Anda berbeda, seluruh angka Rupiah di bawah akan
> bergeser proporsional. Angka **USD**, **GPM**, dan **faktor mineral**
> tetap sama karena tidak bergantung pada kurs.

---

## 2. Langkah 1 — Sales Officer membuat quotation USD

1. Login sebagai **sales@vktr.demo** → **Pricing Proposals → Proposal Baru**.
2. Isi:
   - Judul: `12 Unit EV Truck — PT Anteraja Logistik (USD)`
   - Lini Bisnis: **B2B Commercial Fleet**
   - Customer: `PT Anteraja Logistik`
   - Jumlah Unit: `12`
   - **Mata Uang Input: US Dollar (USD)** ← inti skenario ini
3. Klik **Buat Draft & Lanjut ke CBS Builder**.

**Yang harus terlihat:** pada CBS Cost Line, kolom nilai bertuliskan
**`US$ / unit`** — bukan `Rp / unit`. Komponen **Battery Pack** bertanda
**⛏ HPM NI**, penanda bahwa ia mengikuti harga mineral.

---

## 3. Langkah 2 — Sales Officer mengisi Direct Costs (USD)

Masih sebagai Sales Officer, isi komponen berikut. **Semua nilai dalam
US$ per unit.**

| Item | Nilai (US$/unit) |
|---|---|
| Battery Pack (BOM) | 42.000 |
| Chassis (BOM) | 21.000 |
| Powertrain / Motor (BOM) | 15.500 |
| Karoseri / Body Building | 11.000 |
| Bea Masuk / Tarif Impor | 7.800 |
| Shipping & Logistics | 2.400 |

Klik **Simpan & Hitung Ulang Harga**, lalu **Submit untuk Approval**.

Status berubah menjadi `Pending COGS Validation` dengan **dua step aktif
bersamaan** — VP Finance dan VP Operations.

**Yang didemokan:** angka yang diketik tersimpan **apa adanya dalam USD**.
Konversi ke Rupiah hanya terjadi saat menghitung — inilah yang menjaga
jejak angka asli dari vendor tetap utuh saat kurs bergerak (FR-1.4.1).

---

## 4. Langkah 3 — VP Operations memvalidasi komponen operasional

1. Logout, login sebagai **vpops@vktr.demo**, buka quotation yang sama.
2. Isi komponen milik VP Operations (US$ per unit):

   | Item | Nilai (US$/unit) |
   |---|---|
   | STNK / Vehicle Registration | 750 |
   | Delivery & Handling | 900 |
   | Testing & Homologasi | 1.900 |
   | Pengujian Tipe | 1.100 |
   | Warranty Provision | 2.300 |
   | Overheads Proyek | 1.500 |
   | After-Sales Maintenance Support | 1.200 |

3. **Simpan & Hitung Ulang Harga**, lalu **Approve**.

**Perhatikan:** quotation **tidak** langsung maju. Panel menampilkan bahwa
sistem masih menunggu VP Finance — **AND-join**. VP Operations memiliki
**13 komponen** pada lini B2B ini.

---

## 5. Langkah 4 — VP Finance memicu Guardrail, lalu memperbaikinya

1. Logout, login sebagai **vpfinance@vktr.demo**.
2. Isi OPEX dan margin **sengaja rendah** dulu:

   | Item | Nilai |
   |---|---|
   | OPEX / Overhead Allocation | 1.250 (US$/unit) |
   | Cost of Funds | 3 (%) |
   | Financial Leasing Margin | 1 (%) |
   | Sales Commission | 1,5 (%) |
   | Contingency Buffer | 1 (%) |

3. **Simpan & Hitung Ulang Harga** → banner merah muncul:
   **GPM 6,10%**, jauh di bawah ambang **16,0%** untuk B2B.

4. Perbaiki margin:

   | Item | Nilai baru |
   |---|---|
   | Cost of Funds | 9 (%) |
   | Financial Leasing Margin | 5 (%) |
   | Sales Commission | 4 (%) |
   | Contingency Buffer | 3 (%) |

5. **Simpan & Hitung Ulang Harga** → banner hilang. **GPM 17,36%**.

   > **Kenapa 21%, bukan 18%?** Margin dihitung terhadap *cost*,
   > sedangkan GPM terhadap *harga jual*: `GPM = s / (1 + s)`. Ambang B2B
   > 16% menuntut total margin **19,05%**. Total 18% hanya memberi GPM
   > 15,25% — **tidak lolos**. Perhatikan ambang B2B (16%) lebih ketat
   > daripada B2G (14%) pada skenario pertama.

6. Klik **Approve**.

### Angka yang harus terlihat

| | Nilai |
|---|---|
| Total biaya per unit | US$ 110.600 |
| Total Direct Cost | Rp 19,885 M |
| Total Indirect Cost | Rp 1,815 M |
| **Final Price** | **Rp 26,257 M** ≈ **US$ 1.605.912** |
| **GPM** | **17,36%** |

**Yang didemokan (FR-1.4.4):** kartu Final Price menampilkan **dua mata
uang** — Rupiah sebagai angka utama, `≈ US$…` di bawahnya. Di bawah
ringkasan ada keterangan kurs yang dipakai, tersimpan bersama hasil
perhitungan.

---

## 6. Langkah 5 — Chief Sales merilis quotation

1. Logout, login sebagai **chiefsales@vktr.demo**.
2. Klik **Approve** → **Release Gate** berjalan (komponen COGS lengkap,
   semua COGS Owner setuju, margin di atas ambang).
3. Status menjadi **`Quotation Released`**.

---

## 7. Langkah 6 — HMA berubah, harga menyesuaikan otomatis

Inti dari Module 8. Simulasikan terbitnya Kepmen ESDM periode baru.

1. Login sebagai **admin@vktr.demo** → **Master Data & CBS**.
2. Pada panel **HMA**, simpan nilai baru:
   - Mineral: `NI`
   - HMA: **18.644** (naik 12% dari 16.646)
   - Periode: hari ini
   - Referensi: `Kepmen ESDM No. 144.K/2026 (periode berikutnya)`
3. HPM berjalan naik dari **55,64** menjadi **61,87 US$/WMT**.

Sekarang buka quotation tadi:

4. Panel **Mineral Index Adjustment** menampilkan faktor **1,1120**
   (+11,20%).
5. Klik **Simpan & Hitung Ulang Harga** pada quotation.

### Dampaknya

| | Sebelum | Sesudah |
|---|---|---|
| Total Direct Cost | Rp 19,885 M | **Rp 20,808 M** |
| Total Indirect Cost | Rp 1,815 M | Rp 1,815 M *(tidak berubah)* |
| Final Price | Rp 26,257 M | **Rp 27,373 M** |
| GPM | 17,36% | 17,36% *(tetap)* |

**Tiga hal yang layak ditekankan:**

1. **Hanya Battery Pack yang naik.** Chassis, karoseri, dan seluruh
   komponen indirect tidak tersentuh — faktor mineral hanya mengenai item
   bertanda `is_mineral_linked`.
2. **GPM tidak berubah.** Kenaikan biaya diteruskan ke harga jual, bukan
   ditelan margin. Inilah tujuannya: melindungi profitabilitas saat harga
   bahan baku bergerak.
3. **Tanpa approval terpisah,** tetapi faktor dan dasar perhitungannya
   (HMA, CF, HPM, referensi Kepmen) tampil terbuka dan tercatat di audit
   trail — kenaikan harga selalu bisa dijelaskan asal-usulnya (FR-8.4).

> **Catatan.** Quotation yang dibuat **setelah** HMA diperbarui memakai
> HMA baru sebagai baseline, sehingga faktornya 1,0. Memang begitu
> maksudnya: penyesuaian hanya mengukur pergerakan **sejak** quotation
> disusun.

---

## 8. Langkah 7 — Negosiasi diskon pada quotation USD

Ambang B2B yang lebih ketat (16%) membuat ruang diskon jauh lebih sempit
daripada B2G — poin bagus untuk didiskusikan dengan VKTR.

| Diskon | Final Price | GPM | Wewenang | Di bawah ambang? |
|---|---|---|---|---|
| 2% | Rp 25,732 M | 15,67% | Sales Officer | **ya** |
| 5% | Rp 24,944 M | 13,01% | Chief Sales | **ya** |
| 12% | Rp 23,106 M | 6,09% | BOD | **ya** |

1. Sebagai **sales@vktr.demo**, ajukan diskon **2%** → sistem menandai
   wewenang **Sales Officer**, tetapi **peringatan margin merah muncul**
   karena GPM jatuh ke 15,67%.
2. Ajukan **5%** → eskalasi otomatis ke **Chief Sales**.
3. Ajukan **12%** → naik ke **BOD**. Sebagai BOD, pilih **Revise** dengan
   counter **6%** → wewenang **dihitung ulang** dan jatuh ke Chief Sales,
   bukan otomatis disetujui.

**Yang didemokan:** dengan GPM awal 17,36% dan ambang 16%, jarak amannya
hanya **1,36 poin** — bahkan diskon 2% menembusnya. Peringatan yang muncul
sejak diskon terkecil bukan kelemahan; justru itu yang dulu tidak terlihat
pada proses manual dan menyebabkan *margin leakage*.

---

## 9. Langkah 8 — Slider HMA di DSS

1. Buka **Decision Support (DSS)**, pilih quotation ini.
2. Geser slider **Harga Mineral Acuan (HMA)**.
3. Base Case vs Simulated Case berubah seketika — HPM bergerak, komponen
   mineral ikut, GPM menyesuaikan.

**Yang didemokan:** simulasi memakai **engine yang sama** dengan
kalkulasi resmi, sehingga simulasi dan kenyataan tidak mungkin berbeda
hasil.

---

## 10. Ringkasan Perbandingan Dua Skenario

| | Skenario 1 (B2G) | Skenario 2 (USD) |
|---|---|---|
| Lini bisnis | B2G Tender Bus | B2B Commercial Fleet |
| Mata uang input | IDR | **USD** |
| Ambang GPM | 14,0% | **16,0%** |
| Jumlah unit | 30 | 12 |
| Final Price | Rp 82,84 M | Rp 26,257 M (US$ 1,61 jt) |
| GPM tercapai | 15,25% | 17,36% |
| Jarak ke ambang | 1,25 poin | 1,36 poin |
| Fitur khas | COGS paralel, Release Gate, negosiasi | **Multi-currency, HMA/HPM** |

---

## 11. Catatan Batasan

- **Kurs dan HMA diinput manual** oleh Admin — belum ditarik otomatis dari
  API Bank Indonesia maupun publikasi ESDM.
- **Dampak HPM diperlakukan proporsional penuh** terhadap komponen
  berbahan mineral. Bila mineral hanya menyusun sebagian biaya sel
  baterai, faktornya perlu diredam — perlu divalidasi tim teknis VKTR
  (Technical Logic §14 no. 10).
- **Mengganti mata uang setelah cost line terisi tidak mengonversi nilai
  lama.** Angka tetap apa adanya dan kini dibaca sebagai mata uang baru.
  Ini disengaja: konversi diam-diam akan mengubah harga tanpa disadari
  pengisi (FR-1.4.5).
- **BEP tampil sangat kecil** pada skenario ini karena Overheads Proyek
  bertipe per-unit, bukan biaya tetap sesungguhnya. Untuk POC hal ini
  tidak memengaruhi GPM maupun alur approval.
