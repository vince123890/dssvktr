# Skenario Demo — VKTR-PriceCore (v4.0)

> **Status terhadap PRD/Technical Logic v4.0.** Revisi mengikuti
> `BTEL - Cost and Roles and Flow.xlsx` (sheet *Cost Structure*,
> *Actors*, *Basic Workflow*) dan contoh dokumen `Cost Estimate - PT
> Siborong Nusa Gemilang 20260906.pdf`. Peran, alur, tier, dan format
> dokumen di sini **sudah dibangun** di aplikasi v4.0 — perbedaan
> terhadap v3.0 ada di [`DEMO-FLOW-OVERVIEW.md`](DEMO-FLOW-OVERVIEW.md) §9.
>
> **Skrip klik-demi-klik yang cocok persis dengan layar aplikasi** ada di
> [`DEMO-FLOW-PRICE-ESTIMATE.md`](DEMO-FLOW-PRICE-ESTIMATE.md) (Workflow A)
> dan [`DEMO-FLOW-OFFICIAL-QUOTATION.md`](DEMO-FLOW-OFFICIAL-QUOTATION.md)
> (Workflow B). Dokumen ini adalah skenario naratif lengkapnya.

Panduan langkah demi langkah: siapa login sebagai apa, data apa yang
dimasukkan, dan hasil yang harus terlihat. Satu sesi demo menyentuh
seluruh modul inti v4.0: **Settings role & workflow**, cost structure
**Maker → Checker → Releaser**, **Price Estimate**, **KYC**, Official
Quotation per **quantity band**, **tier 15% / 10%**, **preview & cetak
dokumen Cost Estimate**, revisi via Project Identifier, dan Fraud Guard.

> **Skenario kedua (CNY).** Untuk kurs CNY terkunci per versi cost
> structure dan Rate Sensitivity Threshold, lihat
> [`DEMO-SCENARIO-CNY.md`](DEMO-SCENARIO-CNY.md).

Prasyarat: skema v4.0 sudah dimigrasi dan `npm run seed:demo` versi
v4.0 sudah dijalankan (akun demo, Settings awal sesuai attachment,
quotation historis). Seed sudah menyediakan varian LDT dan **cost
structure v1 RELEASED** dengan angka di §3 — §2 dan §3 di bawah
menjelaskan asal data itu; untuk mendemokan Maker/Checker/Releaser secara
langsung, buat versi baru (lihat `DEMO-FLOW-PRICE-ESTIMATE.md` A7).

> **Mengulang demo.** `npm run reset:demo` menghapus quotation buatan
> demo beserta workflow, persetujuan tier, dan audit log-nya, serta
> mengembalikan versi cost structure seed. Settings, master data, dan
> akun demo tidak disentuh.

---

## 0. Peta Peran, Kredensial & Angka Acuan

| Login sebagai | Email | Tugas dalam skenario |
|---|---|---|
| **System Admin** | admin@vktr.demo | Menunjukkan Settings: role & wewenang, workflow, tier, quantity band, PPN, template |
| **Product Owner** | product@vktr.demo | Menyiapkan varian & halaman spesifikasi |
| **Procurement Manager** | procurement@vktr.demo | Maker scope COGS & Add-Ons; approver Tier 2 |
| **Head of Procurement and Operations Control** | headproc@vktr.demo | Checker & Releaser scope COGS & Add-Ons; tembusan Tier 3 |
| **Head of Corporate Finance** | headfinance@vktr.demo | Maker/Checker/Releaser scope Margin; approver Tier 2 |
| **Sales Operations Manager** | salesops@vktr.demo | Maker scope Sales; *generate* quotation, atur diskon |
| **Head of Sales** | headsales@vktr.demo | Checker & Releaser scope Sales; review, *accept/revise*, rilis |
| **Authorized Agency** | agency@vktr.demo | Price Estimate saja |
| **Sales Executive** | sales.exec@vktr.demo | KYC & submit Official Quotation |
| **Sales Lead** | sales.lead@vktr.demo | Validasi permintaan Sales Executive; submit sendiri tanpa validasi |
| **Chief Commercial Officer** | cco@vktr.demo | Approver Tier 3 |
| **Chief Finance Officer** | cfo@vktr.demo | Approver Tier 3 |

Password semua akun: `PriceCore123!`. Cara termudah berpindah peran:
buka jendela Incognito terpisah per peran, atau logout/login ulang.

### Tier margin & quantity band (seed Settings)

| GM akhir (setelah diskon, excl. VAT) | Tier | Keputusan | Bila ditolak |
|---|---|---|---|
| ≥ 15% | 1 | Head of Sales merilis | — |
| 10% – < 15% | 2 | COGS Owner **dan** Profitability Owner | Kembali ke Sales Operations |
| < 10% | 3 | CCO **dan** CFO, cc COGS & Profitability Owner | Kembali ke Sales Operations |

| Kuantitas | Mode | Diskon *default* |
|---|---|---|
| 1 | Otomatis | 0 |
| 2–5 | Otomatis + opsi manual | 2% *(angka demo — menunggu VKTR)* |
| 6–9 | Otomatis + opsi manual | 3% *(angka demo — menunggu VKTR)* |
| ≥ 10 | Manual | per deal |

### Angka acuan varian demo (per unit, kurs Rp 2.600/CNY, PPN efektif 11% — ilustratif)

| | Nilai |
|---|---|
| Base cost (COGS + Add-Ons) | Rp 677.000.000 |
| Margin (kelompok Profitability) | Rp 146.550.000 |
| Sales | Rp 6.000.000 |
| **Harga dasar excl. VAT** | **Rp 829.550.000** |
| **Harga dasar incl. VAT** | **Rp 920.800.500** |
| **GM standar** | **17,79%** |
| Diskon yang membuat GM tepat 15% / 10% | 3,264% / 8,598% |

GM = (harga bersih excl. VAT − Sales − base cost) ÷ (harga bersih excl.
VAT − Sales) — Technical Logic §3.3.

---

## 1. Persiapan — System Admin menunjukkan Settings

Tujuan: membuktikan bahwa **role dan workflow dari attachment dapat
diatur di aplikasi**, bukan tertanam di kode.

### Langkah 1a — Roles & Authorities

1. Login sebagai **admin@vktr.demo** → **Settings → Roles &
   Authorities**.
2. Tab **Roles**: tunjukkan 12 role hasil seed sheet *Actors* beserta
   peran fungsionalnya (Salesperson, COGS Owner, Profitability Owner,
   Sales Pricing Owner, Pricing Committee, Authorized Agency, dst.).
3. Tab **Scope Authority**: grid role × scope (COGS, Add-Ons, Margin,
   Sales) × skenario dengan centang **Maker / Checker / Releaser** —
   tunjukkan bahwa bentuknya sama persis dengan sheet *Actors*:
   - CCO & CFO tidak punya centang pada skenario **Regular (≥ 10%)**,
     dan punya ketiganya di semua scope pada skenario **Deviation
     (< 10%)**.
4. Tab **Segregation**: "Maker ≠ Checker" aktif untuk COGS, Add-Ons,
   Sales. Untuk Margin, opsi "izinkan satu aktor bila pemegang hanya
   satu" aktif — karena di sheet *Actors* scope Margin hanya dipegang
   Head of Corporate Finance.
5. Klik **Export CSV** — kolomnya mengikuti sheet *Actors* (Actor,
   Scope, Regular M/C/R, Deviation M/C/R) untuk ditinjau di spreadsheet.
   *(Import kembali dari spreadsheet belum dibangun.)*

**Yang didemokan:** PRD FR-5.6.

### Langkah 1b — Workflow, Quantity Band, Tier, PPN

0. **Settings → Workflow** menampilkan **katalog** Workflow Template
   (Standard + 5 contoh: Blacklist, Relasi Khusus, Nilai Besar, B2G,
   Industri Tambang & Perkebunan) — VKTR memperkirakan ±30 template;
   detail di `DEMO-FLOW-OFFICIAL-QUOTATION.md` B6c.
1. **Settings → Workflow** → buka template **Official Quotation —
   Standard**. Tunjukkan langkahnya:

   | # | Langkah | Pelaksana | Kondisi lewati | Bila ditolak | SLA |
   |---|---|---|---|---|---|
   | 1 | Isi KYC & submit | Salesperson | – | – | – |
   | 2 | Validasi Sales Lead | Sales Lead | Pengaju = Sales Lead | Kembali ke langkah 1 | 24 jam |
   | 3 | Generate Official Quotation | Sales Operations | – | – | 24 jam |
   | 4 | Review & rilis/rute | Head of Sales | – | Kembali ke langkah 3 | 24 jam |

2. Ubah SLA langkah 3 dari 24 menjadi **8 jam** → **Simpan**. Tunjukkan
   bahwa versi template naik dan perubahan tercatat di audit trail;
   quotation yang sedang berjalan tetap memakai versi lama.
3. Buka template **Price Estimate** — tanpa langkah approval; hanya
   mengatur siapa yang boleh (Salesperson, Authorized Agency).
4. **Settings → Tier Margin & Quantity Band** — tabel
   di §0 tampil dan **dapat diedit**. Tekankan: tier sengaja **terpisah
   dari template**, sehingga template baru tidak dapat menghilangkan
   approval CCO/CFO.
5. **Settings → Umum & Dokumen** — tarif PPN efektif 11% (ilustratif,
   menunggu Corporate Finance), dan template "Cost Estimate": judul, pola
   nomor `{seq}/L/VKTR/{skema}-{unit}/{MM}-{YYYY}`, masa berlaku 30 hari,
   disclaimer, *special notes default*.

**Yang didemokan:** PRD FR-2.1, FR-2.8, FR-6.1, FR-1.6, FR-1.5.3.

---

## 2. Product Owner menyiapkan varian

1. Login sebagai **product@vktr.demo** → **Product Master Data → Varian
   Baru**.
2. Isi:
   - Make/Model: `VKTR Light Duty Truck`; Type: `4x2 Short Wheelbase`;
     Variant: `Dumper, Battery 90 kWh`
   - Build type `CKD`, loco `Magelang`
   - Deskripsi dokumen: *VKTR Light Duty Truck 4x2, Short Wheelbase,
     with Dumper, Battery 90 kWh, CKD, loco Magelang, incl. VAT*
   - Unggah 3 halaman spesifikasi (brosur fitur, *multi body
     application* & gambar sasis, tabel spesifikasi SWB/MWB)
   - Inclusions *default*: Onsite training during initial deployment,
     2 week · Online training refreshment 1x (first year) · On-call
     technical support
   - Exclusions *default*: Maintenance · Other Requests
3. Simpan (`ACTIVE`).

**Perhatikan:** varian belum muncul di pilihan Price Estimate maupun
Official Quotation — cost structure-nya belum dirilis.

---

## 3. Cost Structure v1 — Maker → Checker → Releaser

### Langkah 3a — COGS & Add-Ons (COGS Owner)

1. Login sebagai **procurement@vktr.demo** (Maker) → **Cost Structure →
   LDT 4x2 SWB Dumper 90 kWh → v1 (Draft)**.
2. Isi scope **COGS** (per unit):

   | Item | Nilai |
   |---|---|
   | FOB Price in CNY | ¥ 185.000 |
   | FOB Price in IDR | *otomatis* Rp 481.000.000 (kurs terkunci 2.600) |
   | Freight and Insurance | 18.000.000 |
   | Custom Duties | 24.000.000 |
   | Port Handling, Clearance, and Pre-Delivery Inspection | 7.500.000 |
   | Carrosserie Allocation | 65.000.000 |
   | Assembly Cost | 22.000.000 |
   | Local Parts | 12.000.000 |
   | Accessories | 4.000.000 |
   | Telematics | 3.500.000 |
   | Warehousing and Storage | 2.000.000 |
   | Warranty Cost | 15.000.000 |
   | Initial Energy Injection | 1.000.000 |
   | Administrative Cost | 3.000.000 |
   | **Total COGS** | **Rp 658.000.000** |

3. Isi scope **Add-Ons**:

   | Item | Nilai | Catatan |
   |---|---|---|
   | STNK | 6.000.000 | *Add-Ons, bukan Sales* |
   | KEUR | 1.500.000 | |
   | Insurance | 9.000.000 | *Add-Ons, bukan Sales* |
   | Processing Service | 2.500.000 | |
   | Delivery Service | **Exclusion — At cost** | Harga *loco Magelang*; tercetak sebagai "Delivery To Site — At cost" |
   | Additional | 0 | |
   | **Total Add-Ons** | **Rp 19.000.000** | |

4. Klik **Submit (Make)** untuk kedua scope.
5. Masih sebagai Procurement Manager, coba klik **Check** → ditolak:
   *"Checker harus berbeda dari Maker"*.
6. Login sebagai **headproc@vktr.demo** → **Check** lalu **Release**
   kedua scope.

### Langkah 3b — Margin (Profitability Owner)

1. Login sebagai **headfinance@vktr.demo**. Isi scope **Margin**:

   | Item | Nilai |
   |---|---|
   | VKTS Profit Before Tax | Rp 20.000.000 |
   | VKTS Margin | 6% |
   | VKTR Profit Before Financing Cost | Rp 25.000.000 |
   | Financing Cost | 4% |
   | VKTR Margin After Financing Cost | 5% |

   Margin = 677.000.000 × 15% + 45.000.000 = **Rp 146.550.000**.
2. **Make → Check → Release** oleh orang yang sama. Sistem mengizinkan
   (pemegang scope Margin hanya satu) dan menandai **single-actor
   release** di audit trail.

### Langkah 3c — Sales (Sales Pricing Owner)

1. Login sebagai **salesops@vktr.demo** (Maker). Isi scope **Sales**:
   Incentive Internal 4.000.000 · Incentive External 0 · Sales
   Processing Cost 2.000.000 · Agency Fee 0 → **Make**.
2. Login sebagai **headsales@vktr.demo** → **Check** → **Release**.

**Hasil:** keempat scope `RELEASED` → **Cost Structure v1 RELEASED**,
harga dasar excl. VAT **Rp 829.550.000**, GM standar **17,79%**. Scope
diproses independen — urutan 3a/3b/3c boleh ditukar atau paralel.

**Yang didemokan:** PRD FR-1.1 (kepemilikan terkonfirmasi, STNK &
Insurance di Add-Ons), FR-1.1.2 (Maker/Checker/Releaser, pemisahan
tugas).

---

## 4. Price Estimate — Authorized Agency

1. Login sebagai **agency@vktr.demo** → **Price Estimate**.
2. Pilih *VKTR Light Duty Truck → 4x2 Short Wheelbase → Dumper, Battery
   90 kWh*.
3. Layar menampilkan:
   - Harga per unit **excl. VAT Rp 829.550.000** dan **incl. VAT
     Rp 920.800.500**
   - Deskripsi varian, spesifikasi ringkas, inclusions/exclusions,
     catatan *"estimasi tidak mengikat"*
4. **Tidak ada** menu Official Quotation, dan tidak ada elemen cost
   structure/GM di layar (cek juga respons API di DevTools).

**Yang didemokan:** PRD FR-2.7 (sheet *Basic Workflow* A).

---

## 5. Official Quotation A — 1 unit, otomatis (Sales Executive)

### Langkah 5a — Sales Executive mengisi KYC

1. Login sebagai **sales.exec@vktr.demo** → **Official Quotation →
   Baru**.
2. Isi KYC:

   | Field | Isi |
   |---|---|
   | a. Nama & alamat resmi | `PT Tirta Hijau Logistik`, alamat lengkap |
   | b. Varian & kuantitas | LDT 4x2 SWB Dumper 90 kWh × **1** |
   | c. Jenis proyek | Proyek baru → sistem generate Project Identifier |
   | d. Aplikasi / utilisasi | Dumper / pasir & batu split |
   | e. Rute & produksi | Rute quarry–proyek, Cileungsi → Bekasi, 6 trip/hari |
   | f. Likelihood | 4 — Medium to High |
   | g. Gap identified | Armada diesel tidak memenuhi target emisi proyek |
   | h. Informasi lain | Skema Purchase |

3. Coba **Submit** dengan field g kosong → ditolak *"KYC belum lengkap:
   Gap identified"*. Lengkapi, tinjau di layar, **Submit**.

### Langkah 5b — Sales Lead memvalidasi

1. Login sebagai **sales.lead@vktr.demo** → antrean **Validasi** →
   **Validate**.

### Langkah 5c — Sales Operations (otomatis) → Head of Sales

1. Karena 1 unit (band 1), quotation **di-*generate* otomatis** dengan
   harga dasar dan langsung masuk antrean Head of Sales — antrean Sales
   Operations tidak perlu bertindak (tercatat *auto-generated*).
2. Login sebagai **headsales@vktr.demo**. Buka quotation: terlihat
   quotation **dan detail cost structure** (*Highly Confidential*), GM
   **17,79%**, tier yang akan berlaku **1**.
3. Klik **Preview Dokumen** → dokumen bertanda watermark **"DRAFT — NOT
   FOR CUSTOMER"**, nomor masih "DRAFT".
4. Klik **Accept** → Tier 1 → Release Gate lolos → **Quotation
   Released**.

### Langkah 5d — Preview & cetak dokumen (Salesperson)

1. Login sebagai **sales.exec@vktr.demo**, buka quotation yang sama.
   Tidak ada cost structure; yang terlihat hanya status dan harga
   jual.
2. Klik **Preview** — dokumen **Cost Estimate** tanpa watermark:
   - Number mengikuti pola template (mis. `0002/L/VKTR/PUR-EFS/09-2026`
     — kode skema `PUR` ilustratif, arti segmen menunggu VKTR), Release
     Date hari ini, Expiry Date +30 hari
   - To: PT Tirta Hijau Logistik + alamat dari KYC
   - Sales/Account Person: Sales Executive; Prepared By: Sales
     Operations Manager
   - Tabel: 1 × *VKTR Light Duty Truck 4x2, Short Wheelbase, with
     Dumper, Battery 90 kWh, CKD, loco Magelang, incl. VAT* ×
     **Rp 920.800.500**
   - Inclusions; **Exclusions — At cost**: Delivery To Site,
     Maintenance, Other Requests
   - Special Notes, blok tanda tangan
   - Halaman 2–4: **Specification**
3. Klik **Print** (A4) dan **Download PDF**. Cetak ulang sekali lagi →
   isi identik (audit trail mencatat `PRINT`, `DOWNLOAD_PDF`).

**Yang didemokan:** sheet *Basic Workflow* B langkah 1–7a, PRD FR-7
(KYC), FR-2.8 band 1, FR-1.5.3 & FR-1.5.4 (format & cetak).

---

## 6. Official Quotation B — 4 unit, otomatis + opsi manual (Sales Lead)

1. Login sebagai **sales.lead@vktr.demo**, buat Official Quotation:
   `PT Bumi Karya Konstruksi`, varian yang sama × **4**, KYC lengkap.
   **Submit**.
2. **Perhatikan:** langkah validasi Sales Lead **dilewati**
   (`SKIPPED_NOT_APPLICABLE`) karena pengaju adalah Sales Lead —
   quotation langsung ke Sales Operations.
3. Login sebagai **salesops@vktr.demo**: quotation sudah
   di-*generate* otomatis dengan diskon *default* band 2–5 **2%**
   (Rp 16.591.000/unit). Panel dampak margin: harga bersih excl. VAT
   **Rp 812.959.000**/unit, GM **16,10%**, tier **1**. Klik
   **Konfirmasi & Teruskan**.
4. Login sebagai **headsales@vktr.demo** → **Accept** → Released. Total
   4 unit: excl. VAT Rp 3.251.836.000, incl. VAT **Rp 3.609.537.960**.

**Yang didemokan:** kondisi lewati langkah (PRD FR-2.0.1), band 2–5
(FR-2.8).

---

## 7. Official Quotation C — 40 unit, manual, Tier 3 lalu Tier 2

Kasus ini mereproduksi dokumen contoh **Cost Estimate — PT Siborong
Nusa Gemilang**.

### Langkah 7a — KYC & validasi

1. **sales.exec@vktr.demo** membuat Official Quotation:

   | Field | Isi |
   |---|---|
   | a | `PT Siborong Nusa Gemilang`, Belleza BSA, 1st Floor Unit 106, Jl. Letjen Soepeno, Kel. Grogol Utara, Kec. Kebayoran Lama, Jakarta Selatan 12210 |
   | b | LDT 4x2 SWB Dumper 90 kWh × **40** |
   | c | Proyek baru |
   | d–g | *(ilustratif)* Dumper / material agregat; rute site–stockpile, 10 trip/hari; Likelihood 3; gap: kebutuhan armada listrik 5 tahun |
   | h | Pelanggan meminta skema **Rental 5 tahun** |

2. **sales.lead@vktr.demo** → **Validate**.

### Langkah 7b — Sales Operations menyusun manual (band ≥ 10)

1. **salesops@vktr.demo**: quotation **tidak** di-*generate* otomatis —
   mode **Manual**.
2. Input diskon dalam mode **Rupiah**: **Rp 80.000.000/unit**. Panel
   dampak margin langsung menunjukkan: setara **9,64%**, harga bersih
   Rp 749.550.000/unit, GM **8,95%**, tier **3 — CCO & CFO**.
3. Tambah *Special Notes*: "Delivery time and maintenance service
   contract details will be discussed". Pastikan Exclusions memuat
   Delivery To Site (dari Add-Ons *At cost*), Maintenance, Other
   Requests. **Teruskan**.

### Langkah 7c — Head of Sales → Tier 3

1. **headsales@vktr.demo** membuka quotation + detail cost structure →
   **Accept**. Status: **Pending Pricing Committee Approval**.
2. Login sebagai **headproc@vktr.demo** dan **headfinance@vktr.demo** —
   keduanya menerima **tembusan** (tanpa tombol Approve).
3. **cco@vktr.demo** → **Approve**. **Perhatikan:** status tetap
   *Pending Pricing Committee Approval* — satu dari dua belum cukup
   (AND-join).
4. **cfo@vktr.demo** → **Reject** dengan catatan *"Diskon terlalu dalam
   untuk kontrak 40 unit"*. Quotation **kembali ke Sales Operations**;
   persetujuan CCO pada versi itu gugur.

### Langkah 7d — Sales Operations merevisi → Tier 2

1. **salesops@vktr.demo** ganti mode **Persentase**: **4%**
   (Rp 33.182.000/unit). Harga bersih Rp 796.368.000/unit, GM
   **14,34%**, tier **2**. **Teruskan**.
2. **headsales@vktr.demo** → **Accept**. Status: **Pending Owner
   Approval**.
3. **procurement@vktr.demo** → **Approve** (memenuhi slot COGS Owner).
   Status masih pending.
4. **headfinance@vktr.demo** → **Approve**. Kedua slot lengkap → Release
   Gate → **Quotation Released**.

   | | Nilai |
   |---|---|
   | 40 unit excl. VAT | Rp 31.854.720.000 |
   | 40 unit incl. VAT | **Rp 35.358.739.200** |

5. **sales.exec@vktr.demo** → **Preview / Print / Download PDF**.
   Bandingkan dengan PDF contoh: susunan bagian identik (header, Number,
   Release/Expiry, To, Disclaimer, Sales/Account Person, Product,
   Prepared By, tabel, Inclusions, Exclusions — At cost, kontak, Total,
   Special Notes, tanda tangan, Specification).

> **Demo alternatif — skema Rental (opsional, formula belum ada).**
> Pada langkah 7b pilih skema **Rental**, tenor **60 bulan**, lalu isi
> sewa per unit per bulan secara manual (contoh dokumen:
> Rp 35.309.397 incl. VAT). Layar menandai *"formula rental belum
> dikonfirmasi"*, tier tetap dievaluasi dari harga Purchase setara.
> Dokumen mencetak *"Rental Scheme, 5-year Contract"*, kolom
> *Rental/Month Unit* dan *Rental/Month Total* (contoh: 40 unit →
> Rp 1.412.375.872/bulan, total dihitung dari nilai per unit sebelum
> dibulatkan).

> **Demo alternatif — wewenang Deviation (opsional).** Saat quotation
> berada di Tier 3 (langkah 7c), CFO dapat membuka override cost line
> (mis. Processing Service) dan menjalankan Make/Check/Release —
> wewenang yang tidak ia miliki pada skenario Regular.

**Yang didemokan:** band ≥ 10 manual, dual-mode diskon (PRD FR-6.1.1),
Tier 3 AND-join + tembusan, tolak → Sales Operations (FR-2.3), Tier 2
AND-join, format dokumen riil.

---

## 8. Revisi Setelah Rilis — Project Identifier

1. Pelanggan Siborong meminta tambahan diskon 1%. **sales.exec@vktr.demo**
   membuka quotation rilis → **Permintaan Revisi** → jenis *Diskon*,
   catatan permintaan.
2. Sistem membuat **quotation #2** pada Project Identifier yang sama.
   Karena KYC tidak berubah, #2 **mulai di Sales Operations** (tanpa
   validasi Sales Lead).
3. **salesops@vktr.demo** set diskon **5%** → GM **13,44%**, Tier 2.
   Ulangi **Accept** (Head of Sales) → **Approve** (Procurement Manager,
   Head of Corporate Finance) → Released. Total 40 unit incl. VAT
   Rp 34.990.419.000.
4. Quotation #1 otomatis **SUPERSEDED**. Buka **Lifecycle** → keduanya
   tampil dalam satu linimasa Project Identifier. Cetak #1 → dokumen
   bertanda **SUPERSEDED**.

**Yang didemokan:** PRD FR-2.5, FR-6.3.

---

## 9. Masa Berlaku & Kedaluwarsa

1. Buka quotation historis seed yang dirilis lebih dari 30 hari lalu
   tanpa penerimaan → status **EXPIRED** (job harian).
2. Cetak → watermark **EXPIRED**. Tombol **Buat Revisi** membuat
   quotation baru yang dihitung ulang dari cost structure & kurs terbaru.

**Yang didemokan:** PRD FR-2.9.

---

## 10. Penerimaan Pelanggan

1. **sales.exec@vktr.demo** pada quotation Tirta Hijau (§5) → isi URL
   salinan bertanda tangan → **Diterima (WON)**.
2. DSS → Win/Loss: quotation tampil sebagai *won*, dengan Likelihood KYC
   4 sebagai pembanding.

**Yang didemokan:** PRD FR-2.10.

---

## 11. Fraud Guard & Observability

1. **sales.exec@vktr.demo** mencoba membuat Official Quotation baru untuk
   `PT Tirta Hijau Logistik` + varian yang sama pada hari yang sama →
   ditolak *"Batas quotation harian untuk customer & varian ini sudah
   tercapai"*, tercatat `BLOCKED_DUPLICATE_ATTEMPT`.
2. **Lifecycle** (Kanban): kolom Draft → Pending Sales Lead → Pending
   Sales Operations → Pending Head of Sales → Pending Owner / Pending
   Pricing Committee → Released / Expired / Superseded, dikelompokkan per
   Project Identifier. Tab **Cost Structure** menampilkan antrean
   Maker/Checker/Releaser per scope.
3. **Audit Trail**: MAKE, CHECK, RELEASE (termasuk *single-actor
   release*), SUBMIT, STEP_SKIPPED, TIER_ROUTE, TIER_CC, APPROVE,
   REJECT, SUPERSEDE, PRINT, DOWNLOAD_PDF, SETTINGS_CHANGE,
   BLOCKED_DUPLICATE_ATTEMPT — *append-only*.

---

## 12. Settings Live — Menambah Role Tanpa Ubah Kode (opsional)

1. **admin@vktr.demo** → Settings → Roles → **Tambah Role**:
   `Corporate Finance Manager`, peran fungsional Profitability Owner.
2. Scope Authority: centang **Maker** pada scope Margin (Regular &
   Deviation). Petakan satu user demo ke role ini.
3. Tunjukkan bahwa scope Margin kini punya dua pemegang → aturan
   "Maker ≠ Checker" otomatis berlaku; *single-actor release* tidak lagi
   diizinkan untuk versi cost structure berikutnya.
4. Tidak ada deploy atau perubahan kode — hanya baris konfigurasi
   berversi di audit trail.

**Yang didemokan:** PRD FR-5.6 dan salah satu jawaban atas open item
pemisahan tugas scope Margin.

---

## 13. Ringkasan Hasil yang Harus Terlihat

| Modul | Bukti yang terlihat |
|---|---|
| Settings Roles & Authorities | 12 role & matriks M/C/R identik sheet *Actors*; tambah role tanpa deploy |
| Settings Workflow / Band / Tier / PPN / Template | Basic Workflow VKTR tampil sebagai langkah yang dapat diedit; tier terpisah dari template |
| Cost Structure M/C/R | Maker ≠ Checker ditegakkan; single-actor Margin ditandai; varian tidak tampil sebelum 4 scope rilis |
| STNK & Insurance | Berada di Add-Ons, masuk base cost |
| Price Estimate | Agency melihat Rp 829.550.000 / Rp 920.800.500, nol cost structure |
| KYC | Submit ditolak bila field wajib kosong |
| Validasi Sales Lead | Berjalan untuk Sales Executive, dilewati untuk Sales Lead |
| Quantity band | 1 unit otomatis; 4 unit diskon 2% otomatis; 40 unit manual |
| Tier 15% / 10% | 17,79% & 16,10% rilis; 14,34% → COGS + Profitability Owner; 8,95% → CCO + CFO (+cc) |
| AND-join & tolak | 1 dari 2 tidak cukup; tolak kembali ke Sales Operations |
| Delivery Service | Tercetak "Delivery To Site — At cost" |
| Dokumen | Format Cost Estimate + Specification; watermark DRAFT/SUPERSEDED/EXPIRED; Print & PDF; cetak ulang identik |
| Project Identifier | Revisi #2 mulai di Sales Operations; #1 SUPERSEDED |
| Masa berlaku & penerimaan | EXPIRED setelah 30 hari; unggah tanda tangan → WON |
| Fraud Guard | Quotation ganda harian ditolak & tercatat |

---

## 14. Catatan Batasan & Open Items

- **PDF lewat dialog cetak browser** (*Save as PDF*) dari halaman dokumen
  yang sama dengan preview — belum ada generator PDF server-side.
- **Penyimpangan cost line per deal** (FR-1.1.3) belum dibangun — harga
  per deal diatur lewat diskon; nilai biaya berubah lewat versi cost
  structure baru.
- **Kedaluwarsa** dievaluasi saat halaman dibuka, bukan cron harian.
- **Angka biaya varian demo ilustratif** — bukan cost structure riil
  BTEL/VKTR.
- **Tingkat diskon *default* band 2–5 (2%) dan 6–9 (3%)** adalah angka
  demo — menunggu VKTR.
- **PPN efektif 11%** ilustratif — menunggu Corporate Finance.
- **Formula skema Rental** belum diterima — Rental hanya jalur manual.
- **Definisi GM** (Sales *pass-through*, perlakuan profit VKTS) menunggu
  konfirmasi Corporate Finance.
- **Pemisahan Maker/Checker/Releaser** dan aktor kedua scope Margin
  menunggu keputusan VKTR.
- **Arti segmen nomor dokumen** (`L`, kode skema, kode unit) dan judul
  resmi dokumen ("Cost Estimate") menunggu konfirmasi.
- **Notifikasi** (SLA, tembusan Tier 3) hanya tampil di UI pada POC —
  belum terkirim ke Email/Teams/WhatsApp.
- **Tidak ada ekspor ke ERP/CRM** pada POC.
