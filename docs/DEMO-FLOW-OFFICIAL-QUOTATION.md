# Demo Flow B — Sales To Obtain Official Quotation (v5.0)

Skrip demo langkah demi langkah untuk **Workflow B** sesuai build v5.0
(hasil meeting *VKTR Req 2*). Dokumen keluaran mengikuti contoh *Cost
Estimate — PT Siborong Nusa Gemilang*. Durasi ± 45 menit untuk B1–B5;
B6–B9 dan Lampiran A opsional.

> **Yang berubah dari v4.x.** Hanya **satu workflow aktif** (`OQ-STANDARD`):
> KYC → submit → harga standar dihitung otomatis → **Head of Sales** approve
> → **Disetujui — menunggu rilis** → **Salesperson merilis**, dengan atau
> tanpa **lampiran dokumen bertanda tangan (opsional)**. Saat membuat
> quotation, **dropdown *Persetujuan Head of Sales*** dapat dipilih
> *Tanpa approval — langsung rilis* (tier margin tetap berlaku bila GM
> < 15%). Tidak ada langkah Validasi Sales Lead dan tidak ada
> antrean Sales Operations pada rilis awal. **Diskon** hanya lewat
> **Revisi** (Salesperson mengisi diskon di draft revisi) dan tetap melewati
> tier margin. Setelah rilis: **Won** (bukti PO) → **Project** → termin,
> payment, progres → **Dashboard**. Seluruh aplikasi **responsif**.

| Langkah | Yang terjadi di aplikasi | Demo |
|---|---|---|
| 1–3. Salesperson mengisi KYC (a–h), meninjau, submit | **Official Quotation → Baru**; KYC 8 field (6 wajib), varian & qty (boleh lebih dari satu) | B1 |
| 4–5. Validasi & generate | Tidak ada validasi Sales Lead; *Generate* otomatis (semua band, diskon default 0%) | B1, B2 |
| 6. Head of Sales menerima quotation + **detail cost structure** | Tabel harga + panel *Detail cost structure — Highly Confidential* + Cost Structure Sheet | B1 |
| 7a. GM ≥ 15% | *Approve* → **Disetujui — menunggu rilis** (nomor & tanggal terbit) | B1 |
| 7b. GM 10–15% → COGS & Profitability Owner; tolak → Sales Operations | Tier 2, dua persetujuan wajib | B3 |
| 7c. GM < 10% → CCO & CFO, cc COGS & Profitability Owner | Tier 3, tembusan tampil | B3 |
| 8. Rilis | Salesperson **merilis tanpa lampiran** (B2) atau **melampirkan dokumen bertanda tangan & merilis** (B1); lampiran dapat ditambah setelah rilis | B1, B2 |
| Tanpa approval | Dropdown *Tanpa approval Head of Sales* → **langsung Released**; tier margin tetap berlaku bila GM < 15% | B2b |
| Diskon pelanggan | **Revisi**; Salesperson isi diskon; tier dihitung dari GM setelah diskon | B3 |
| Setelah rilis | Warna kuning/merah, Won/Lost, Expired otomatis (override Admin) | B5 |
| Won | Bukti PO → **Project**: termin (Salesperson), payment (Finance), progres (Tim Project) | B4 |

---

## 0. Persiapan

1. Migrasi `0018` lalu `0019` sudah dijalankan di Supabase (0019 membuat
   satu workflow aktif, band Otomatis dengan diskon default 0%, role baru,
   tabel project, dan bucket berkas privat).
2. `npm run reset:demo` — **menghapus semua quotation** dan memulihkan data
   demo (cost structure v1, quotation historis berikut project dari yang
   Won, kurs CNY/IDR 2.600). Untuk akun baru jalankan `npm run seed:demo`
   sekali.
3. Password semua akun `PriceCore123!`. Paling mudah: satu jendela
   Incognito per peran.

   | Akun | Role | Dipakai di |
   |---|---|---|
   | `sales.exec@vktr.demo` | Sales Executive | KYC, submit, rilis (lampiran TTD opsional), revisi, Won/Lost, termin |
   | `sales.lead@vktr.demo` | Sales Lead | sama seperti Sales Executive (tidak ada langkah validasi lagi) |
   | `salesops@vktr.demo` | Sales Operations Manager | menyusun ulang bila tier ditolak |
   | `headsales@vktr.demo` | Head of Sales | review, approve, batalkan approve final |
   | `procurement@vktr.demo` | Procurement Manager (COGS Owner) | approver Tier 2 |
   | `headproc@vktr.demo` | Head of Procurement and Operations Control | tembusan Tier 3 |
   | `headfinance@vktr.demo` | Head of Corporate Finance (Profitability Owner) | approver Tier 2 |
   | `cco@vktr.demo` / `cfo@vktr.demo` | Pricing Committee | approver Tier 3 |
   | `finance@vktr.demo` | Finance | status payment termin |
   | `projectteam@vktr.demo` | Tim Project | progres project |
   | `chief@vktr.demo` | Chief / Direksi | dashboard executive |
   | `admin@vktr.demo` | System Admin | Settings, override Expired, Audit |
   | `product@vktr.demo`, `agency@vktr.demo` | Product Owner, Authorized Agency | Lampiran A, Price Estimate |

4. **Cek konfigurasi** (admin@vktr.demo → Settings → Workflow): hanya
   *Official Quotation — Standard* yang aktif dengan dua langkah *Generate*
   dan *Review & Rilis*; Settings → Tier Margin & Quantity Band: semua band
   **Otomatis** dengan diskon default **0%**.
5. Angka acuan varian **LDT 4x2 SWB Dumper 90 kWh** (per unit, kurs 2.600,
   PPN 11%): harga dasar excl. VAT **Rp 829.550.000**, incl. VAT **Rp
   920.800.500**, GM standar **17,79%**. Diskon yang membuat GM tepat 15% =
   3,264%; tepat 10% = 8,598%.
6. Tier margin: GM ≥ 15% Tier 1 (Head of Sales); 10–< 15% Tier 2 (COGS Owner
   **dan** Profitability Owner); < 10% Tier 3 (CCO **dan** CFO, cc COGS &
   Profitability Owner). Tolak di tier → kembali ke Sales Operations.

---

## B1 — 1 unit: harga standar → approve → rilis dengan lampiran tanda tangan

**Sales Executive — KYC & submit**

1. Login **sales.exec@vktr.demo** → **Official Quotation → Official
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
   | Lini bisnis | **B2B Commercial Fleet** |
   | Kualifikasi deal | Segmen `B2B` · Industri `Konstruksi` · Hubungan `Reguler` |
   | b. Varian & qty | LDT 4x2 SWB Dumper 90 kWh × **1** |

3. Kosongkan dulu **g** → **Simpan Draft & Tinjau** → pesan *"g. Gap
   identified wajib diisi"*. Isi kembali → simpan.
4. Quotation terbuka sebagai **Draft (KYC)**. Perhatikan: **tidak ada harga
   maupun cost structure** bagi Salesperson, dan tidak ada tempat mengisi
   diskon (draft awal = harga standar). Dropdown **Persetujuan Head of Sales**
   di form masih **Perlu approval Head of Sales** (default). Klik **Submit
   Official Quotation**.
5. Status langsung **Review Head of Sales**. Panel alur menampilkan
   **Workflow Template: Official Quotation — Standard**; langkah *Generate*
   tercatat *"Auto-generated — band 1 unit, harga dasar"*. Tidak ada
   validasi Sales Lead.

**Head of Sales — review & approve**

6. Login **headsales@vktr.demo** → Overview → *Menunggu tindakan Anda* →
   buka quotation. Terlihat:
   - tabel harga: dasar Rp 829.550.000, diskon 0, **incl. VAT Rp
     920.800.500**, GM **17,79%**, badge **Tier 1**
   - panel *Detail cost structure — Highly Confidential* (buka): COGS,
     Add-Ons (STNK & Insurance), Margin, Sales, Delivery Service
     **Exclusion — At cost**
7. Klik **Preview Dokumen (Draft)** → dokumen Cost Estimate dengan watermark
   **DRAFT — NOT FOR CUSTOMER**. Tutup tab.
8. Klik **Approve & rute tier** → GM ≥ 15% → status **Disetujui —
   menunggu rilis**. Header kini menampilkan **nomor dokumen** (mis.
   `0001/L/VKTR/PUR-EFS/10-2026`), tanggal dokumen, dan berlaku s.d. (+30
   hari). Quotation **belum Released**.

**Salesperson — cetak, tanda tangan, lampirkan (opsional), rilis**

9. Login **sales.exec@vktr.demo** → buka quotation. Harga incl. VAT kini
   tampil (tanpa cost structure). Daftar quotation menampilkan status
   *Disetujui — menunggu rilis*; Overview menampilkan *"Rilis quotation
   (lampiran dokumen bertanda tangan opsional)"*. Panel *Aksi Anda* berisi satu form
   **Rilis** dengan dropdown: *Tanpa lampiran dokumen* (default) atau *Dengan
   lampiran dokumen bertanda tangan*, lalu tombol **Rilis**.
10. Klik **Cetak untuk ditandatangani** → dokumen bernomor **tanpa
    watermark**: *COST ESTIMATE*, penerbit + logo, Number, tanggal & Expiry
    Date, **To** dari KYC, Sales/Account Person (Maria Kusuma), tabel (1 ·
    *Purchase* · incl. VAT · Rp 920,800,500), Inclusions, **Exclusions — At
    cost**, Special Notes, blok tanda tangan, halaman **Specification**.
    Pilih *Save as PDF* (A4). Audit Trail mencatat `PRINT`.
11. (Anggap Head of Sales menandatangani di luar aplikasi.) Pada dropdown
    **Rilis** pilih *Dengan lampiran dokumen bertanda tangan* → kolom berkas
    muncul → pilih PDF/PNG/JPG (≤ 10 MB) → **Rilis**. Status menjadi
    **Quotation Released**; kartu *Dokumen & Hasil* menampilkan tautan *Buka
    lampiran*; badge **hijau · 0 hari sejak rilis**. (Jalan tanpa lampiran
    diperagakan di B2.)
12. Login **headsales@vktr.demo** → buka quotation yang sama: **tidak ada**
    tombol rilis maupun unggah (hanya Salesperson pemilik atau Admin).
    Kembali sebagai **sales.exec@**: panel kini menawarkan **Ganti lampiran**
    (lampiran opsional tetap dapat diganti sesudah rilis; tanggal rilis tidak
    berubah).

## B2 — 4 unit oleh Sales Lead: tetap harga standar

1. Login **sales.lead@vktr.demo** → Official Quotation baru: `PT Bumi Karya
   Konstruksi`, alamat bebas, proyek baru `Material Proyek Karawang`, KYC
   wajib lengkap, Lini bisnis **B2B Commercial Fleet**, Kualifikasi `B2B` ·
   `Konstruksi` · `Reguler`, SWB Dumper × **4** → simpan → **Submit**.
2. Sama seperti B1: langsung **Review Head of Sales** (Sales Lead hanyalah
   Salesperson lain). Diskon default band 2–5 kini **0%**, sehingga harga
   tetap standar.
3. **headsales@** Approve → status *Disetujui — menunggu rilis*. **sales.lead@**
   memilih *Tanpa lampiran dokumen* pada dropdown **Rilis** lalu menekan
   **Rilis** → **Released** (kartu *Dokumen & Hasil* tanpa
   tautan lampiran; audit RELEASE "tanpa lampiran"). Total 4 unit incl. VAT
   **Rp 3.683.202.000** (4 × 920.800.500), GM 17,79%.
4. Lampiran tetap opsional sesudahnya: panel menawarkan **Lampirkan** bila
   dokumen yang ditandatangani menyusul.

## B2b — Tanpa approval Head of Sales: langsung rilis (tier margin tetap berlaku)

1. **sales.exec@vktr.demo** → Official Quotation baru: `PT Cepat Rilis
   Logistik`, KYC wajib lengkap, B2B · Konstruksi · Reguler, SWB Dumper × **1**.
   Pada dropdown **Persetujuan Head of Sales** pilih **Tanpa approval Head of
   Sales — langsung rilis**; keterangan di bawahnya berubah (*"dirilis otomatis
   setelah submit... GM akhir di bawah 15%... tetap diperlukan"*). **Submit**.
2. Status langsung **Quotation Released**: nomor dokumen terisi, badge
   **Tanpa approval Head of Sales**, tanpa antrean apa pun. Di panel alur
   langkah *Review & Rilis (Head of Sales)* berstatus **Dilewati**; Audit
   Trail memuat `STEP_SKIPPED`, `APPROVE` ("dirilis otomatis"), dan `RELEASE`.
   Head of Sales tidak pernah menerima quotation ini.
3. **Tier tetap berlaku.** **sales.exec@** → **Buat Revisi** → di kartu
   *Diskon negosiasi (revisi)* isi Rupiah `80000000` → Simpan → **Submit**
   (pilihan tanpa approval terbawa). GM turun ke **8,95%** (Tier 3), sehingga
   quotation **tidak** langsung rilis: status **Approval Tier — Pricing
   Committee (CCO & CFO)**. **cco@** + **cfo@** Approve → **Released**
   langsung (tidak ada review Head of Sales dan tidak ada langkah rilis
   manual); quotation awal menjadi Superseded.
4. Bila rilis otomatis tertahan (mis. kurs basi), quotation diteruskan ke
   **Review Head of Sales** dan audit mencatat *"Rilis otomatis ... gagal"* —
   tidak tersangkut.

## B3 — Diskon lewat Revisi: 40 unit PT Siborong Nusa Gemilang (Tier 3 ditolak → Tier 2)

**3a. Rilis awal pada harga standar**

1. **sales.exec@vktr.demo** → quotation baru:

   | Field | Isi |
   |---|---|
   | a | `PT Siborong Nusa Gemilang` · `Belleza BSA, 1st Floor Unit 106, Jl. Letjen Soepeno, Kelurahan Grogol Utara, Kecamatan Kebayoran Lama, Jakarta Selatan 12210` |
   | c | Proyek baru · `Armada Dumper 5 Tahun` |
   | d–g | `Dumper` / `Material agregat`; `Site → stockpile`, `Site`, `Stockpile`; `10 trip per hari`; Likelihood 3; gap `Kebutuhan armada listrik jangka panjang` |
   | h | Skema diminta: **Rental** |
   | Lini bisnis / Kualifikasi | **B2B Commercial Fleet** · `B2B` · `Konstruksi` · `Reguler` |
   | b | LDT 4x2 SWB Dumper 90 kWh × **40** |

2. Submit → **headsales@** Approve (Tier 1, tanpa diskon) → **sales.exec@**
   merilis (lampiran opsional) → **Released** (40 × Rp 920.800.500 =
   Rp 36.832.020.000 incl. VAT).

**3b. Pelanggan minta diskon → Revisi**

3. **sales.exec@** buka quotation Siborong → alasan `Pelanggan minta diskon
   untuk kontrak 40 unit` → **Buat Revisi**. Quotation baru (Draft) terbuka
   dengan KYC dan varian yang sama.
4. Kartu **Diskon negosiasi (revisi)** hanya ada di draft revisi (draft awal
   tidak punya). Pilih satuan **Rupiah (per unit)**, isi `80000000` → **Simpan
   diskon**. Layar menampilkan harga/unit incl. VAT yang baru, **tanpa GM,
   tier, atau cost structure**. Klik **Submit**.
5. **headsales@vktr.demo** → buka **Cost Structure Sheet** (dokumen internal)
   → kembali → lihat GM **8,95%** (setara diskon 9,644%), **Tier 3 — CCO +
   CFO · cc COGS Owner, Profitability Owner** → **Approve & rute tier**.
   Status **Approval Tier — Pricing Committee (CCO & CFO)**.
6. **headproc@** dan **headfinance@** membuka quotation: panel alur
   menampilkan *Tembusan (cc)* tanpa tombol keputusan.
7. **cco@vktr.demo** → **Approve**. Status **tetap** menunggu — satu dari dua
   belum cukup (AND-join).
8. **cfo@vktr.demo** → catatan `Diskon terlalu dalam untuk kontrak 40 unit`
   → **Reject**. Quotation **kembali ke Sales Operations**; putaran tier
   dibatalkan.

**3c. Disusun ulang → Tier 2**

9. **salesops@vktr.demo** → panel harga: ganti mode **%**, isi `4` (Rp
   33.182.000/unit). Dampak: net **Rp 796.368.000**/unit, GM **14,34%**,
   **Tier 2 — COGS Owner + Profitability Owner** → **Simpan harga &
   dokumen** → **Teruskan ke Head of Sales**.
10. **headsales@** → **Approve & rute tier** → **Approval Tier — COGS &
    Profitability Owner** (Tier 2).
11. **procurement@** → **Approve** (slot COGS Owner; **headproc@** tidak
    punya slot tersisa). **headfinance@** → **Approve** → Release Gate
    lolos → status **Disetujui — menunggu rilis** (nomor baru).
12. **sales.exec@** → cetak, lalu dropdown **Rilis** → *Dengan lampiran* (atau
    *Tanpa lampiran*) → **Rilis**. Total 40 unit:
    excl. VAT Rp 31.854.720.000, incl. VAT **Rp 35.358.739.200**.
13. Buka quotation awal (3a) → **Digantikan (Superseded)**; kartu *Linimasa
    Project Identifier* menampilkan keduanya. Cetak yang lama → watermark
    **SUPERSEDED**.

> **Catatan skema Rental.** Skema **Rental** dapat dipilih dengan tenor (bulan)
> dan sewa per unit per bulan incl. VAT (contoh dokumen: 60 bulan, Rp
> 35.309.397). Layar menandai *"formula rental belum dikonfirmasi —
> sewa/bulan diinput manual"* (oleh Sales Operations/Head of Sales); tier
> tetap dihitung dari harga Purchase setara.

## B4 — Won → Project → Payment → Progres → Dashboard

1. **sales.exec@** → quotation Tirta Hijau (B1, Released) → panel *Aksi
   Anda* → **Diterima (Won)**. Tanpa berkas PO form menolak (server juga:
   *"Bukti PO wajib diunggah."*). Isi `PO-TH-001`, tanggal PO,
   unggah berkas PO → **Simpan Won & buat project**. Kartu *Dokumen & Hasil*
   menampilkan Nomor PO, *Buka bukti PO*, dan tautan **Buka project**.
2. Menu **Projects** (data seed: project dari quotation historis yang Won
   sudah ada). Buka project Tirta Hijau. **sales.exec@** menetapkan termin:
   *DP* 30% dan *Pelunasan* 70% (total persen tidak boleh > 100%).
3. **finance@vktr.demo** (login terpisah; sidebar hanya **Projects**):
   termin *DP* → **Tandai diterima** → jumlah, tanggal, unggah screenshot
   transfer → **Simpan & centang diterima**. Finance **tidak** dapat
   menambah/menghapus termin. Setelah ada yang diterima, termin **terkunci**
   untuk Salesperson.
4. **projectteam@vktr.demo** → tab **Tracking** → tambah entri `PO diterima`
   5%, lalu `Proses produksi` 20% (catatan opsional). Bilah progres terisi;
   Tim Project tidak dapat mengubah termin.
5. **sales.exec@** membuka project yang sama: payment dan progres **hanya
   dibaca**.
6. **chief@vktr.demo** → mendarat di **Dashboard** (executive): quotation
   terkirim/Won/Lost, jumlah PO dan total nilai project, termin diterima vs
   belum, status project. Menu lain (Cost Structure, Settings) tidak tampil
   dan **404** bila dibuka lewat URL.
7. **sales.exec@** → **Dashboard**: KPI miliknya (terkirim, Won, Lost,
   kuning/merah). **salesops@** / **headsales@**: pilih Salesperson atau
   lihat tabel *Per Salesperson*.

## B5 — Hasil, warna umur, Expired, dan membatalkan approve final

1. **Lost.** **sales.exec@** pada quotation Released (mis. Bumi Karya, B2)
   → **Ditolak (Lost)** → simpan tanpa alasan ditolak; isi alasan →
   tersimpan, badge **Lost** merah.
2. **Warna dari tanggal rilis.** Quotation baru = **hijau** (hari ke-0).
   Seed historis berumur > 30 hari sehingga merah/Expired. Untuk
   memperlihatkan **kuning**, mundurkan tanggal rilis salah satu quotation
   Released (SQL Editor Supabase, hanya di database demo):

   ```sql
   update pricing_proposal set released_at = now() - interval '16 days'
   where document_number = '<nomor quotation Bumi Karya>';
   ```

   Daftar Official Quotation → badge **kuning · 16 hr**; filter
   *Kuning (follow up)*; Overview menampilkan *"Follow up pelanggan
   (kuning)"*. Ubah ke `35 days` → **merah**. Ambang (14/30 hari) dapat
   diubah di **Settings → Umum**.
3. **Expired otomatis.** Quotation historis `4 Unit — CV Maju Jaya
   Konstruksi` melewati masa berlaku → status **Kedaluwarsa** saat daftar
   dibuka (audit `EXPIRE`); tombol **Buat Revisi** tersedia.
4. **Override Admin.** **admin@vktr.demo** → quotation Released yang belum
   Won → panel *Aksi Anda*: **Nyatakan Expired** (alasan wajib) → status
   Expired. Pada quotation Expired: **Batalkan Expired** → wajib alasan dan
   tanggal berlaku **baru** (> hari ini) → kembali **Released**. Kartu
   *Dokumen & Hasil* mencatat siapa, kapan, dan alasannya. Sales Executive
   tidak melihat aksi ini; quotation **Won tidak dapat** di-Expired.
5. **Batalkan approve final.** Buat quotation baru (mis. `PT Contoh Batal
   Approval`, 1 unit) → submit → **headsales@** Approve → status *Disetujui —
   menunggu rilis*. **headsales@** → **Batalkan approval final**
   dengan alasan `Harga perlu direvisi` → kembali **Review Head of Sales**,
   nomor dokumen **kosong**, panel harga *Revise* aktif. Approve lagi →
   **nomor baru**. Audit memuat nomor lama dan alasan. Setelah **Released**,
   tombol ini tidak ada — koreksi hanya lewat Revisi.

## B6 — Fraud guard, antrean kerja & audit

1. **sales.exec@vktr.demo** → Official Quotation baru untuk `PT Tirta Hijau
   Logistik` + varian SWB lagi (hari yang sama) → ditolak *"Batas quotation
   harian untuk customer & varian ini sudah tercapai"* (revisi dikecualikan).
2. **Overview → Menunggu tindakan Anda** per peran: Head of Sales = review;
   Salesperson = draft, *Rilis quotation (lampiran opsional)*, follow up
   kuning/merah; approver tier = slot tier.
3. **Lifecycle & Approvals** → Kanban: Draft → Review Head of Sales → Tier 2
   → Tier 3 → **Disetujui — menunggu rilis** → Released. Di handphone
   kolom bergeser horizontal.
4. **admin@vktr.demo** → **Audit Trail**: SUBMIT, GENERATE, UPDATE (diskon,
   Won/Lost, termin, progres, batal approval), TIER_ROUTE, TIER_CC, APPROVE,
   REJECT, RELEASE, SUPERSEDE, EXPIRE, PRINT, BLOCKED_DUPLICATE_ATTEMPT.

## B7 — Menu & data hanya yang dipakai role (PRD FR-5.7)

1. Bandingkan sidebar:
   - **sales.exec@**: Overview, **Dashboard**, Price Estimate, Official
     Quotation, **Projects** — tanpa Lifecycle, Cost Structure, DSS, Master
     Data, Audit, Settings.
   - **finance@** dan **projectteam@**: hanya **Projects**.
   - **chief@**: **Dashboard** dan **Projects** (baca).
   - **procurement@**: Overview, Official Quotation, Lifecycle, Cost
     Structure, DSS, Master Data & Kurs.
   - **product@**: langsung ke **Product Master Data**.
2. Sebagai **sales.exec@**, buka `/settings`, `/cost-structure`, dan
   `/audit-log` lewat URL → **404**.
3. Daftar Official Quotation Salesperson hanya memuat quotation miliknya;
   quotation Bumi Karya (diajukan sales.lead@) tidak muncul dan URL-nya
   **404**. Project Salesperson lain juga tidak terlihat.

## B8 — Tampilan di handphone dan iPad (PRD FR-5.8)

Buka aplikasi di DevTools (lebar **375**, **768**, **1280**) atau di
handphone, login **sales.exec@**:

1. < 1024 px: sidebar hilang, muncul **top bar** dengan tombol hamburger;
   drawer menutup dengan Esc, tombol ✕, ketuk di luar, atau setelah pindah
   halaman; halaman di belakangnya tidak ikut bergulir.
2. **Official Quotation** dan **Projects**: daftar berbentuk **kartu**;
   tabel lebar (rincian harga, Settings, Master Data) **digeser ke samping**
   di dalam kartunya, halaman tidak ikut bergeser.
3. Form KYC, panel aksi, dan form termin/progres satu kolom; kolom Kanban
   bergeser dan berhenti per kolom; input tidak membuat iOS memperbesar
   layar.

## B9 — (Opsional) Admin: Settings dan variasi workflow

1. **Settings → Roles & Users**: role dan fungsinya data (Finance, Tim Project,
   Chief/Direksi termasuk). Tambah role `CORP_FIN_MANAGER` *Corporate Finance
   Manager* dengan fungsi **Profitability Owner** → langsung dapat dipilih di
   tabel User dan ikut menjadi pemutus Tier 2 tanpa ubah kode.
2. **Settings → Scope Authority (M/C/R)**: grid role × scope ×
   Maker/Checker/Releaser (Regular/Deviation), identik dengan sheet Actors →
   **Export CSV**. **Segregation**: Maker ≠ Checker aktif untuk COGS,
   Add-Ons, Sales; scope Margin boleh satu aktor.
3. **Settings → Tier Margin & Quantity Band**: ambang 15%/10%, pemutus tiap
   tier, tembusan, band dan diskon default (kini semua Otomatis/0%). Tier
   sengaja **terpisah dari template**. **Settings → Umum & Dokumen**: PPN
   11%, judul/pola nomor/masa berlaku dokumen, **ambang kuning/merah**.
4. **Settings → Workflow**: daftar berisi **satu workflow**, *Standard* (aktif;
   template contoh Blacklist, Relasi Khusus, Nilai Besar, B2G, dan Industri
   dihapus dari seed oleh migrasi 0021). Klik
   *Standard* → detail: dua langkah, riwayat versi (versi lama yang punya
   Validasi Sales Lead nonaktif). **Ubah** → SLA langkah ke `8` → **Simpan
   sebagai versi baru** (quotation berjalan memakai versi lamanya).
5. **Menambah workflow tanpa kode (kemampuan mesin, bukan konfigurasi
   go-live).** Klik *Standard* → **Duplikat** → nama `Official Quotation — B2G
   Pemerintah`, qualifier **Segmen = B2G**, prioritas `10`, tambahkan langkah
   *Validasi Sales Lead* sebelum *Generate* → **Buat workflow**. Kartu **Uji
   pemilihan template**: Segmen `B2G` → **Uji** → workflow baru terpilih;
   segmen B2B tetap ke *Standard*. Quotation B2G baru (`Dinas Lingkungan
   Hidup Kota Bekasi`, Lini bisnis **B2G / Pemerintah**, Segmen B2G ·
   Municipality · Reguler, 2 unit) → panel alur menampilkan template dan
   alasannya, dan langkah Validasi Sales Lead muncul. Setelah selesai,
   **Nonaktifkan** workflow tambahan itu supaya demo berikutnya kembali satu
   workflow.

---

## Lampiran A — Data awal: Product Master Data & Cost Structure v1 (M/C/R)

`npm run seed:demo`/`reset:demo` sudah mengisi bagian ini; jalankan manual
hanya bila ingin memperagakan lapisan 0 (varian baru memerlukan cost
structure RELEASED sebelum muncul di Price Estimate/Official Quotation).

**A1. Product Owner (product@vktr.demo → Product Master Data).** Daftar
Produk menampilkan make·model beserta jumlah varian dan yang siap dikutip →
**VKTR Light Duty Truck** → **Tambah Varian**: Type `4x2 Short Wheelbase`,
Variant `Dumper, Battery 90 kWh`, build `CKD`, loco `Magelang`, deskripsi
dokumen *VKTR Light Duty Truck 4x2, Short Wheelbase, with Dumper, Battery 90
kWh, CKD, loco Magelang, incl. VAT*; unggah 3 halaman spesifikasi; Inclusions
default *Onsite training during initial deployment, 2 week · Online training
refreshment 1x (first year) · On-call technical support*; Exclusions default
*Maintenance · Other Requests* → simpan (`ACTIVE`). Varian belum muncul di
pilihan Sales (cost structure belum dirilis). **Ubah varian**: Audit Trail
mencatat `UPDATE` nilai lama dan baru; Inclusions baru hanya terbawa ke
quotation baru.

**A2. COGS & Add-Ons (procurement@ = Maker; headproc@ = Checker & Releaser).**
Cost Structure → LDT 4x2 SWB Dumper 90 kWh → v1 (Draft):

| COGS (per unit) | Nilai | Add-Ons | Nilai |
|---|---|---|---|
| FOB Price in CNY | ¥ 185.000 (→ Rp 481.000.000 @2.600, kurs terkunci) | STNK *(Add-Ons, bukan Sales)* | 6.000.000 |
| Freight and Insurance | 18.000.000 | KEUR | 1.500.000 |
| Custom Duties | 24.000.000 | Insurance *(Add-Ons)* | 9.000.000 |
| Port Handling, Clearance, PDI | 7.500.000 | Processing Service | 2.500.000 |
| Carrosserie Allocation | 65.000.000 | Delivery Service | **Exclusion — At cost** |
| Assembly Cost | 22.000.000 | Additional | 0 |
| Local Parts | 12.000.000 | **Total Add-Ons** | **Rp 19.000.000** |
| Accessories / Telematics / Warehousing | 4.000.000 / 3.500.000 / 2.000.000 | | |
| Warranty / Initial Energy Injection / Administrative | 15.000.000 / 1.000.000 / 3.000.000 | | |
| **Total COGS** | **Rp 658.000.000** | | |

**Submit (Make)** kedua scope; coba **Check** sebagai Maker → ditolak
*"Checker harus berbeda dari Maker"*; **headproc@** → **Check** lalu
**Release**.

**A3. Margin (headfinance@).** VKTS Profit Before Tax Rp 20.000.000 · VKTS
Margin 6% · VKTR Profit Before Financing Cost Rp 25.000.000 · Financing Cost
4% · VKTR Margin After Financing Cost 5% (Margin = 677.000.000 × 15% +
45.000.000 = **Rp 146.550.000**). Make → Check → Release oleh orang yang sama
diizinkan (pemegang scope tunggal) dan ditandai **single-actor release**.

**A4. Sales (salesops@ = Maker; headsales@ = Checker & Releaser).** Incentive
Internal 4.000.000 · Incentive External 0 · Sales Processing Cost 2.000.000 ·
Agency Fee 0.

**Hasil:** empat scope `RELEASED` → **Cost Structure v1 RELEASED**: harga
dasar excl. VAT **Rp 829.550.000**, GM **17,79%** (GM = (harga bersih excl.
VAT − Sales − base cost) ÷ (harga bersih excl. VAT − Sales)). Scope
independen — urutan A2/A3/A4 boleh ditukar atau paralel.

---

## Ringkasan yang harus terlihat

| Kontrol | Bukti |
|---|---|
| KYC wajib (6 field) sebelum submit; multi-varian | B1 |
| Salesperson tidak pernah melihat cost structure, GM, atau tier | B1, B3 langkah 4 |
| Satu workflow aktif; tanpa validasi Sales Lead; Generate otomatis; harga standar | B1, B2, B9 |
| Head of Sales approve → dokumen bernomor → **Salesperson merilis; lampiran TTD opsional** (dengan atau tanpa) | B1, B2 |
| Dropdown *Tanpa approval Head of Sales* → langsung Released; tier margin tetap berlaku (GM < 15%) | B2b |
| Hanya Salesperson pemilik/Admin yang dapat merilis/melampirkan; lampiran dapat ditambah/diganti setelah rilis | B1 langkah 12 |
| Head of Sales menerima detail cost structure | B1, B3 |
| Diskon hanya lewat Revisi (Salesperson); Tier 2 & 3 AND-join; cc Tier 3; tolak → Sales Operations | B3 |
| Dokumen Cost Estimate: preview draft (watermark), cetak untuk ditandatangani, halaman spesifikasi | B1 |
| Revisi via Project Identifier, lama SUPERSEDED | B3 |
| Won wajib bukti PO → Project; Lost wajib alasan | B4, B5 |
| Termin oleh Salesperson, payment oleh Finance, progres oleh Tim Project | B4 |
| Dashboard Sales dan Executive | B4 |
| Badge hijau/kuning/merah dari tanggal rilis; Expired otomatis + override Admin | B5 |
| Batalkan approve final sebelum rilis | B5 langkah 5 |
| Fraud guard, antrean per role, audit trail | B6 |
| Menu di luar role tersembunyi & 404; data dibatasi per baris | B7 |
| Responsif handphone/iPad | B8 |
| Role, wewenang, tier, band, workflow dapat diatur di Settings; template lain tinggal diaktifkan | B9 |
