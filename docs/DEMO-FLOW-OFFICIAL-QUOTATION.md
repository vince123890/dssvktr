# Demo Flow B — Sales To Obtain Official Quotation

Skrip demo langkah demi langkah untuk **Workflow B** pada sheet *Basic
Workflow* (`docs/BTEL - Cost and Roles and Flow.xlsx`), sesuai build
v4.0 aplikasi. Dokumen keluaran mengikuti contoh *Cost Estimate — PT
Siborong Nusa Gemilang*. Durasi ± 35 menit untuk B1–B6; B7 opsional.

| Langkah di sheet | Yang terjadi di aplikasi | Demo |
|---|---|---|
| 1–3. Salesperson mengisi KYC (a–h), meninjau, submit | **Official Quotation → Baru**; KYC 8 field (6 wajib), varian & qty (boleh lebih dari satu) | B1 |
| 4a. Diajukan Sales Executive → Sales Lead memvalidasi | Langkah *Validasi Sales Lead* | B1, B3 |
| 4b. Diajukan Sales Lead → langsung Sales Operations | Langkah validasi **dilewati** otomatis | B2 |
| 5a. 1 unit → otomatis, harga dasar | Generate otomatis, langsung ke Head of Sales | B1 |
| 5b/5c. 2–5 / 6–9 unit → otomatis + opsi manual (diskon) | Diskon default band (2% / 3%), Sales Operations konfirmasi/ubah | B2 |
| 5d. 10+ unit → manual | Sales Operations menyusun diskon (Rp atau %), skema, inclusions/exclusions | B3 |
| 6. Ke Head of Sales: quotation + **detail cost structure** | Tabel harga + panel *Detail cost structure — Highly Confidential* + Cost Structure Sheet | B1–B3 |
| 7a. GM ≥ 15% → dirilis | *Accept* → langsung **Quotation Released** | B1, B2 |
| 7b. GM 10–15% → COGS & Profitability Owner; tolak → Sales Operations | Status *Tier 2*; dua persetujuan wajib | B3, B4 |
| 7c. GM < 10% → CCO & CFO, cc COGS & Profitability Owner; tolak → Sales Operations | Status *Tier 3*; tembusan tampil; penolakan kembali ke Sales Operations | B3 |

---

## 0. Persiapan

1. `npm run reset:demo` (quotation historis & cost structure v1 kembali
   seperti semula, kurs CNY/IDR 2.600).
2. Password semua akun `PriceCore123!`. Paling mudah: satu jendela
   Incognito per peran.

   | Akun | Role (sheet Actors) |
   |---|---|
   | `sales.exec@vktr.demo` | Sales Executive |
   | `sales.lead@vktr.demo` | Sales Lead |
   | `salesops@vktr.demo` | Sales Operations Manager |
   | `headsales@vktr.demo` | Head of Sales |
   | `procurement@vktr.demo` | Procurement Manager (COGS Owner) |
   | `headproc@vktr.demo` | Head of Procurement and Operations Control (COGS Owner) |
   | `headfinance@vktr.demo` | Head of Corporate Finance (Profitability Owner) |
   | `cco@vktr.demo` | Chief Commercial Officer (Pricing Committee) |
   | `cfo@vktr.demo` | Chief Finance Officer (Pricing Committee) |
   | `admin@vktr.demo` | System Admin |

3. Angka acuan varian **LDT 4x2 SWB Dumper 90 kWh** (per unit, kurs 2.600,
   PPN 11%): harga dasar excl. VAT **Rp 829.550.000**, GM standar
   **17,79%**. Diskon yang membuat GM tepat 15% = 3,264%; tepat 10% =
   8,598%.

---

## B1 — 1 unit: validasi Sales Lead → otomatis → Tier 1 → rilis & cetak

**Sales Executive — KYC (langkah 1–3)**

1. Login **sales.exec@vktr.demo** → **Official Quotation** → **Official
   Quotation Baru**.
2. Isi KYC:

   | Field | Isi |
   |---|---|
   | a. Nama perusahaan | `PT Tirta Hijau Logistik` |
   | a. Alamat resmi | `Jl. Raya Narogong KM 12, Bantar Gebang, Bekasi 17151` |
   | c. Jenis proyek / Nama proyek | Proyek baru / `Armada Dumper Bekasi` |
   | d. Aplikasi / Utilisasi | `Dumper` / `Pasir & batu split` |
   | e. Rute / Asal / Tujuan | `Quarry → proyek` / `Cileungsi` / `Bekasi` |
   | e. Produksi | `6` `trip` per hari |
   | f. Likelihood | 4 — Medium to High |
   | g. Gap identified | `Armada diesel tidak memenuhi target emisi proyek` |
   | Kualifikasi deal | Segmen `B2B` · Industri `Konstruksi` · Hubungan `Reguler` |
   | b. Varian & qty | LDT 4x2 SWB Dumper 90 kWh × **1** |

3. Kosongkan dulu **g** → **Simpan Draft & Tinjau** → pesan *"g. Gap
   identified wajib diisi"*. Isi kembali → simpan.
4. Halaman quotation terbuka sebagai **Draft (KYC)**. Tinjau KYC di layar.
   Perhatikan: **tidak ada harga maupun cost structure** yang tampil bagi
   Salesperson. Klik **Submit Official Quotation**.
5. Status: **Menunggu Validasi Sales Lead**.

**Sales Lead — validasi (langkah 4a)**

6. Login **sales.lead@vktr.demo** → Overview → *Menunggu tindakan Anda*
   → buka quotation → **Validasi & teruskan ke Sales Operations**.
7. Karena 1 unit (band 1), quotation **di-generate otomatis** dengan harga
   dasar dan langsung melompat ke **Review Head of Sales** — langkah Sales
   Operations tercatat *"Auto-generated — band 1 unit, harga dasar"*.

**Head of Sales — review & rilis (langkah 6–7a)**

8. Login **headsales@vktr.demo** → buka quotation. Terlihat:
   - tabel harga: dasar Rp 829.550.000, diskon 0, **incl. VAT Rp
     920.800.500**, GM **17,79%**, badge **Tier 1**
   - panel *Detail cost structure — Highly Confidential* (buka): COGS, Add-Ons
     (STNK & Insurance di sini), Margin, Sales, Delivery Service **Exclusion —
     At cost**
   - panel harga *Revise (Head of Sales)* dengan dampak margin real-time
9. Klik **Preview Dokumen (Draft)** → dokumen Cost Estimate dengan watermark
   **DRAFT — NOT FOR CUSTOMER** dan nomor `DRAFT-PRC-…`. Tutup tab.
10. Klik **Accept & rilis / rute** → GM ≥ 15% → **Quotation Released**.
    Header menampilkan nomor dokumen (mis. `0001/L/VKTR/PUR-EFS/09-2026`)
    dan tanggal berlaku (+30 hari).

**Salesperson — preview & cetak**

11. Login **sales.exec@vktr.demo** → buka quotation. Harga incl. VAT kini
    tampil (tanpa cost structure). Klik **Preview / Print Cost Estimate**:
    - *COST ESTIMATE*, penerbit PT VKTR Teknologi Mobilitas Tbk. + logo
    - Number, Release Date, Expiry Date · **To** dari KYC · Disclaimer
    - Sales/Account Person (Maria Kusuma) · Product · Prepared By
    - Tabel: 1 · *Purchase* · deskripsi varian *incl. VAT* · Rp 920,800,500
    - Inclusions · **Exclusions — At cost**: Delivery To Site, Maintenance,
      Other Requests · Total · Special Notes · blok tanda tangan
    - Halaman **Specification** (brosur, body application & sasis, tabel
      spesifikasi)
12. Klik **Print / Simpan PDF** → dialog cetak browser, pilih *Save as PDF*
    (A4). Audit Trail mencatat `PRINT`.

## B2 — 4 unit oleh Sales Lead: validasi dilewati, diskon default band

1. Login **sales.lead@vktr.demo** → Official Quotation baru:
   `PT Bumi Karya Konstruksi`, alamat bebas, proyek baru `Material Proyek
   Karawang`, KYC wajib lengkap, varian SWB Dumper × **4** → simpan →
   **Submit**.
2. **Perhatikan:** status langsung **Di Sales Operations**; di timeline,
   *Validasi Sales Lead* berstatus **Dilewati** (pengaju punya fungsi
   validator — kondisi lewati diatur di Settings → Workflow).
3. Login **salesops@vktr.demo** → quotation sudah **di-generate otomatis**
   dengan diskon default band 2–5 **2%** (Rp 16.591.000/unit). Panel
   dampak: net **Rp 812.959.000**/unit, GM **16,10%**, **Tier 1**.
   (Opsi manual: ubah diskon di sini; kembalikan ke 2%.)
4. Klik **Teruskan ke Head of Sales**.
5. Login **headsales@vktr.demo** → **Accept & rilis / rute** → Released.
   Total 4 unit incl. VAT **Rp 3.609.537.960**.

## B3 — 40 unit PT Siborong Nusa Gemilang: manual, Tier 3 ditolak, Tier 2 disetujui

**KYC & validasi**

1. **sales.exec@vktr.demo** → Official Quotation baru:

   | Field | Isi |
   |---|---|
   | a | `PT Siborong Nusa Gemilang` · `Belleza BSA, 1st Floor Unit 106, Jl. Letjen Soepeno, Kelurahan Grogol Utara, Kecamatan Kebayoran Lama, Jakarta Selatan 12210` |
   | c | Proyek baru · `Armada Dumper 5 Tahun` |
   | d–g | `Dumper` / `Material agregat`; `Site → stockpile`, `Site`, `Stockpile`; `10 trip per hari`; Likelihood 3; gap `Kebutuhan armada listrik jangka panjang` |
   | h | Skema diminta: **Rental** |
   | Kualifikasi | `B2B` · `Konstruksi` · `Reguler` (→ template Standard) |
   | b | LDT 4x2 SWB Dumper 90 kWh × **40** |

2. Submit → **sales.lead@vktr.demo** → Validasi.

**Sales Operations — manual (band ≥ 10)**

3. **salesops@vktr.demo** → quotation *tidak* diberi diskon otomatis (mode
   manual). Di panel harga, baris varian: diskon mode **Rp**, isi
   `80000000`. Dampak real-time: setara **9,644%**, net **Rp
   749.550.000**/unit, GM **8,95%**, **Tier 3 — Chief Commercial
   Officer + Chief Finance Officer · cc COGS Owner, Profitability
   Owner**.
4. Skema: biarkan **Purchase** untuk demo utama (lihat catatan Rental di
   bawah). Tambahkan Special Notes bila perlu → **Simpan harga &
   dokumen** → **Teruskan ke Head of Sales**.

**Head of Sales → Tier 3**

5. **headsales@vktr.demo** → buka **Cost Structure Sheet** (tab baru,
   dokumen internal *Highly Confidential*) untuk ditinjau → kembali →
   **Accept & rilis / rute**. Status: **Approval Tier — Pricing Committee (CCO &
   CFO)** (Tier 3).
6. **headproc@vktr.demo** dan **headfinance@vktr.demo** membuka quotation:
   panel alur menampilkan *Tembusan (cc): COGS Owner, Profitability
   Owner* — tanpa tombol keputusan.
7. **cco@vktr.demo** → **Approve**. Status **tetap** menunggu Pricing Committee — satu dari dua
   belum cukup (AND-join).
8. **cfo@vktr.demo** → catatan `Diskon terlalu dalam untuk kontrak 40 unit`
   → **Reject**. Quotation **kembali ke Sales Operations**; putaran tier
   dibatalkan.

**Revisi Sales Operations → Tier 2**

9. **salesops@vktr.demo** → ganti mode **%**, isi `4` (Rp 33.182.000/unit).
   Dampak: net **Rp 796.368.000**, GM **14,34%**, **Tier 2 — COGS Owner +
   Profitability Owner** → Simpan → Teruskan.
10. **headsales@vktr.demo** → **Accept** → status **Approval Tier — COGS &
    Profitability Owner** (Tier 2).
11. **procurement@vktr.demo** → **Approve** (mengisi slot COGS Owner).
    Status masih menunggu (Tier 2). (Bila **headproc@vktr.demo** mencoba juga, tidak
    ada slot tersisa untuknya.)
12. **headfinance@vktr.demo** → **Approve** → Release Gate lolos →
    **Quotation Released**. Total 40 unit: excl. VAT Rp 31.854.720.000,
    incl. VAT **Rp 35.358.739.200**.
13. **sales.exec@vktr.demo** → **Preview / Print Cost Estimate** —
    bandingkan dengan PDF contoh: susunan bagian identik.

> **Catatan skema Rental.** Pada langkah 4, skema **Rental** dapat dipilih
> dengan tenor (bulan) dan sewa per unit per bulan incl. VAT (contoh
> dokumen: 60 bulan, Rp 35.309.397). Layar menandai *"formula rental belum
> dikonfirmasi — sewa/bulan diinput manual"*; tier tetap dihitung dari
> harga Purchase setara. Dokumen mencetak *Rental Scheme, 5-year
> Contract* dengan kolom *Rental/Month Unit* dan *Rental/Month Total*.

## B4 — Negosiasi setelah rilis → quotation revisi (Project Identifier)

1. **sales.exec@vktr.demo** → quotation Siborong (Released) → panel *Aksi
   Anda* → alasan `Pelanggan minta tambahan diskon 1%` → **Buat Revisi**.
2. Quotation baru (Draft) terbuka dengan KYC & varian yang sama →
   **Submit**. Karena KYC tidak berubah, **validasi Sales Lead dilewati**
   dan quotation langsung ke Sales Operations.
3. **salesops@vktr.demo** → diskon awal terbawa 4% → ubah ke `5` → GM
   **13,44%**, Tier 2 → Simpan → Teruskan.
4. **headsales@vktr.demo** Accept → **procurement@vktr.demo** Approve →
   **headfinance@vktr.demo** Approve → Released (incl. VAT Rp
   34.990.419.000).
5. Buka quotation lama → status **Digantikan (Superseded)**; kartu
   *Linimasa Project Identifier* menampilkan keduanya. Cetak yang lama →
   watermark **SUPERSEDED**.

## B5 — Penerimaan pelanggan & kedaluwarsa

1. **sales.exec@vktr.demo** → quotation Tirta Hijau (B1) → *Hasil dari
   pelanggan* → isi URL salinan bertanda tangan (opsional) → **Diterima
   (WON)**.
2. Buka **Official Quotation** → quotation historis `4 Unit — CV Maju
   Jaya Konstruksi` kini berstatus **Kedaluwarsa** (dirilis > 30 hari
   tanpa jawaban). Tombol **Buat Revisi** tersedia untuk memperpanjang
   dengan harga terbaru.

## B6 — Fraud guard, antrean kerja & audit

1. **sales.exec@vktr.demo** → Official Quotation baru untuk `PT Tirta
   Hijau Logistik` + varian SWB lagi (hari yang sama) → ditolak *"Batas
   quotation harian untuk customer & varian ini sudah tercapai"*.
2. Setiap peran: **Overview → Menunggu tindakan Anda** berisi quotation
   yang langkah aktifnya dijalankan role tersebut.
3. **Lifecycle & Approvals** → Kanban: Draft → Validasi Sales Lead → Sales
   Operations → Review Head of Sales → Tier 2 → Tier 3 → Released.
4. **admin@vktr.demo** → **Audit Trail**: SUBMIT, VALIDATE, STEP_SKIPPED,
   GENERATE, UPDATE (diskon), TIER_ROUTE, TIER_CC, APPROVE, REJECT,
   RELEASE, SUPERSEDE, EXPIRE, PRINT, BLOCKED_DUPLICATE_ATTEMPT.

## B6c — Workflow Template Catalog: alur berbeda per jenis deal

1. **admin@vktr.demo** → **Settings → Workflow**: daftar bernomor berisi 6
   workflow (Standard, Blacklist, Relasi Khusus, Nilai Besar, B2G,
   Industri Tambang & Perkebunan) beserta qualifier, langkah, prioritas,
   dan tier masing-masing. **Klik baris B2G** → halaman detail: kapan
   dipakai, tier margin khusus (Tier 1 → CCO & CFO), alur langkah
   (KYC → Validasi Sales Lead → Verifikasi dokumen tender → Sales
   Operations → Review → tier), riwayat versi, dan quotation yang memakainya.
   **← Daftar workflow** untuk kembali.
2. Kartu **Uji pemilihan template**: Segmen `B2G` → **Uji** → terpilih
   *B2G Pemerintah*; ubah Hubungan ke `Relasi khusus` → terpilih *Relasi
   Khusus* (prioritas 20 > 10); centang Blacklist → *Customer Blacklist*.
3. **sales.exec@vktr.demo** → Official Quotation baru `Dinas Lingkungan
   Hidup Kota Bekasi`, Segmen **B2G**, Industri `Municipality`, 2 unit SWB
   → Submit. Panel alur menampilkan **Workflow Template: Official
   Quotation — B2G Pemerintah** + alasan. Setelah validasi Sales Lead,
   langkah *Verifikasi dokumen tender (Head of Sales)* muncul sebelum
   Sales Operations; saat Head of Sales Accept (GM 16,10%, Tier 1), quotation
   tetap ke **Pricing Committee (CCO & CFO)** — tier khusus B2G.
4. **Workflow baru tanpa kode**: Settings → Workflow → klik *Industri
   Tambang & Perkebunan* → **Duplikat** → nama `Official Quotation —
   Municipality`, pada qualifier Industri hapus `Pertambangan` &
   `Perkebunan` lalu pilih `Municipality`, prioritas `8` →
   **Buat workflow** → langsung terbuka halaman detailnya. **← Daftar
   workflow**: daftar kini berisi 7. (Alternatif: tombol **Tambah
   workflow** di atas daftar untuk mulai dari langkah template dasar.)
   Uji lagi: Industri `Municipality` (segmen B2B) → workflow baru terpilih.
5. Di detail *Municipality* → kartu Tier margin → **Buat tier khusus**
   (membuka Settings → Tier Margin untuk template ini) → **Buat
   tier khusus (salin global)** → ubah pemutus Tier 2 → simpan. Wewenang
   diskon kini berbeda untuk template ini saja.

## B6b — Menu & data hanya yang dipakai role (PRD FR-5.7)

1. Login bergantian dan bandingkan sidebar:
   - **sales.exec@vktr.demo**: Overview, Price Estimate, Official
     Quotation — tanpa Lifecycle, Cost Structure, DSS, Master Data,
     Audit, Settings.
   - **procurement@vktr.demo**: Overview, Official Quotation, Lifecycle,
     Cost Structure, DSS, Master Data & Kurs — tanpa Price Estimate,
     Product, Audit, Settings.
   - **product@vktr.demo**: langsung mendarat di **Product Master Data**
     (satu-satunya menu).
2. Sebagai **sales.exec@vktr.demo**, buka `/settings`, `/cost-structure`,
   dan `/audit-log` langsung lewat URL → semuanya **404**.
3. Sebagai **sales.exec@vktr.demo**, buka daftar Official Quotation →
   hanya quotation yang ia ajukan (B1, B3, revisi B4). Quotation B2
   (diajukan Sales Lead) tidak muncul, dan membuka URL-nya → **404**.
4. Sebagai **sales.lead@vktr.demo** → daftar memuat B2 (miliknya) dan
   permintaan Sales Executive yang ia validasi (B1, B3).

## B7 — (Opsional) Role & workflow diatur di aplikasi

1. **admin@vktr.demo** → **Settings → Workflow**: langkah *Validasi Sales
   Lead → Generate Official Quotation → Review & Rilis* tampil sebagai
   baris yang dapat diubah (pelaksana, kondisi lewati, tujuan tolak, SLA).
   Ubah SLA langkah 2 ke `8` → **Simpan sebagai versi baru** (quotation
   yang sedang berjalan tetap memakai versi lamanya).
2. **Settings → Tier Margin & Quantity Band**: ambang 15% / 10%, pemutus
   tiap tier, tembusan, dan band 1 / 2–5 / 6–9 / 10+ beserta diskon
   default — semuanya dapat diedit.
3. **Settings → Scope Authority (M/C/R)**: grid role × scope ×
   Maker/Checker/Releaser untuk skenario Regular dan Deviation, identik
   dengan sheet Actors → **Export CSV**.
4. **Settings → Roles & Users**: tambah role `CORP_FIN_MANAGER` *Corporate
   Finance Manager* dengan fungsi **Profitability Owner** → role langsung
   dapat dipilih di tabel User dan ikut menjadi pemutus Tier 2 — tanpa
   ubah kode.

---

## Ringkasan yang harus terlihat

| Kontrol | Bukti |
|---|---|
| KYC wajib (6 field) sebelum submit; multi-varian | B1 |
| Salesperson tidak pernah melihat cost structure | B1 langkah 4 & 11 |
| Validasi Sales Lead untuk Sales Executive; dilewati untuk Sales Lead | B1, B2 |
| Quantity band 1 / 2–5 / 10+ | B1, B2, B3 |
| Diskon Rp atau %, dampak GM & tier sebelum simpan | B3 |
| Head of Sales menerima detail cost structure | B1, B3 |
| Tier 1 rilis langsung; Tier 2 & 3 AND-join; cc Tier 3; tolak → Sales Operations | B1–B3 |
| Dokumen Cost Estimate: preview draft (watermark), cetak/PDF versi rilis, halaman spesifikasi | B1, B3 |
| Revisi via Project Identifier, lama SUPERSEDED | B4 |
| WON, kedaluwarsa 30 hari | B5 |
| Fraud guard, antrean per role, audit trail | B6 |
| Role & workflow dapat diatur di Settings | B7 |
| Menu di luar role tersembunyi & 404; quotation dibatasi per baris | B6b |
| Workflow Template Catalog: pemilihan otomatis, alur & tier per template, template baru tanpa kode | B6c |
