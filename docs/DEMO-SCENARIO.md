# Skenario Demo — VKTR-PriceCore POC (v3.0)

> **Status terhadap PRD/Technical Logic v3.0.** Dokumen ini adalah
> revisi struktural penuh mengikuti hasil demo review POC v2.1
> (`transcribe.md`). Urutan aktor, struktur cost item, dan model
> discount authority di sini **berbeda secara fundamental** dari
> skenario yang sudah didemokan — lihat
> [`DEMO-FLOW-OVERVIEW.md`](DEMO-FLOW-OVERVIEW.md) §8 untuk ringkasan
> perubahan. Skenario ini adalah **blueprint untuk build berikutnya**,
> bukan catatan demo yang sudah dijalankan.

Dokumen ini adalah panduan langkah-demi-langkah untuk mendemokan build
v3.0: siapa login sebagai apa, data apa yang dimasukkan, ke mana
alurnya, dan hasil yang seharusnya terlihat di tiap tahap. Disusun agar
satu sesi demo menyentuh **seluruh modul inti**: cost structure riil
VKTR/BTEL, urutan aktor terkoreksi, Workflow Template Catalog, Release
Gate, Margin-Tier Negotiation, Project Identifier, Observability, dan
DSS.

> **Skenario kedua (CNY).** Untuk mendemokan input multi-currency dan
> Rate Sensitivity Threshold, lihat
> [`DEMO-SCENARIO-CNY.md`](DEMO-SCENARIO-CNY.md) — komponen impor
> (kelompok COGS) dengan input CNY (Renminbi/Yuan), basis riil FOB
> Price VKTR/BTEL.

> **Baru pertama kali?** Baca
> [`DEMO-FLOW-OVERVIEW.md`](DEMO-FLOW-OVERVIEW.md) lebih dulu — di sana
> ada peta besarnya: tujuh peran dalam satu halaman, diagram alur
> quotation dan negosiasi, Workflow Template Catalog, dan Project
> Identifier. Dokumen ini adalah detail per-langkahnya.

Prasyarat: `npm run seed:demo` (lihat README) menyediakan akun demo dan
quotation historis untuk Win/Loss Analytics. **Catatan**: skrip seed
perlu diperbarui mengikuti skema v3.0 (cost_item 4 kelompok,
margin_tier_authority, project_identifier) sebelum skenario ini dapat
dijalankan end-to-end.

> **Mengulang demo.**
>
> ```bash
> npm run reset:demo
> ```
>
> Menghapus quotation yang dibuat saat demo beserta workflow, negosiasi,
> dan audit log-nya, lalu mengembalikan quotation historis ke posisi
> semula. Master data dan akun demo **tidak** disentuh.

---

## 0. Peta Peran & Kredensial

| Login sebagai | Email | Tugas dalam skenario |
|---|---|---|
| **Sales Officer** | sales@vktr.demo | Input data customer/unit/qty/delivery/komisi makelar; isi kelompok **Sales**; mengajukan diskon |
| **VP Operations** | vpops@vktr.demo | COGS Owner — isi & validasi kelompok **COGS** dan **Add-Ons** (mengisi **lebih dulu**) |
| **VP Finance** | vpfinance@vktr.demo | COGS Owner — isi & validasi kelompok **Profitability**; approve diskon Tier 2 |
| **Product Owner** | product@vktr.demo | Kelola Product Master Data (spesifikasi, gambar, karoseri) |
| **Chief Sales** | chiefsales@vktr.demo | Meninjau hasil rakitan, approve tahap akhir; approve diskon Tier 2 |
| **BOD 1 & BOD 2** | bod1@vktr.demo, bod2@vktr.demo | Approve/Reject/Revise diskon Tier 3 — **wajib dua BOD berbeda** |
| **System Admin** | admin@vktr.demo | Kelola Master Data, Workflow Template Catalog, Margin Tier Authority |

Password semua akun: `PriceCore123!`

Karena ini POC single-browser, cara termudah berpindah peran: **logout
lewat tombol di sidebar, lalu login ulang** dengan akun berikutnya. Untuk
demo yang lebih mulus, buka beberapa jendela browser berbeda (atau mode
Incognito terpisah per peran) supaya semua sesi tetap aktif.

### Margin Tier Authority (seed default)

| Tier | Kondisi GPM akhir | Approver wajib |
|---|---|---|
| 1 — Auto | ≥ 15% | Tidak ada — harga *default* price list |
| 2 — Menengah | 12% – 15% | **3 pihak**: Sales Officer, VP Finance, Chief Sales (AND-join) |
| 3 — Kritis | < 12% | **2 orang BOD** (AND-join) |

> Angka ilustratif hasil rapat — wajib dikonfirmasi Finance/BOD sebelum
> go-live (lihat Technical Logic §14 no. 5).

---

## 1. Skenario Utama: "30 Unit EV Bus — Dishub Provinsi Jawa Barat"

Skenario ini dirancang agar menyentuh **semua** kontrol kunci: urutan
aktor terkoreksi, cost structure riil BTEL, validasi COGS sekuensial
(VP Operations wajib selesai lebih dulu, baru VP Finance terbuka),
release gate dengan `may_follow_later`, guardrail margin, dan eskalasi
diskon sampai ke 2 BOD.

### Langkah 0 — Product Owner menyiapkan Product Master Data

1. Login sebagai **product@vktr.demo**.
2. Buka **Product Master Data → Produk Baru**.
3. Isi: `EV Bus 12M Standard`, varian sasis `Standard Chassis`, unggah
   spesifikasi teknis & foto, status `ACTIVE`.
4. Simpan — produk ini akan dirujuk saat Sales menyusun quotation.

**Yang didemokan:** FR-1.5 — Product Master Data terpisah dari cost
structure, dikelola aktor tersendiri.

### Langkah 1 — Sales Officer membuat Project Identifier & quotation request

1. Login sebagai **sales@vktr.demo**.
2. Buka **Pricing Proposals → Proposal Baru**.
3. Isi:
   - Nama Customer: `Dishub Provinsi Jawa Barat`
   - Nama Proyek/Lokasi: `Pengadaan Bus Listrik Trans Jabar`
   - Sistem men-generate **Project Identifier**, mis. `PRJ-DJB-2026-001`
   - Lini Bisnis: `B2G Tender Bus`
   - Produk: pilih `EV Bus 12M Standard` (dari Langkah 0)
   - Jumlah Unit: `30`
   - Estimasi Tanggal Delivery: `+90 hari`
   - Komisi Makelar (bila ada): kosongkan untuk skenario ini
4. Klik **Buat Draft & Submit** → sistem menjalankan
   `resolveWorkflowTemplate` (qualifier: `business_line = B2G_TENDER`,
   `transaction_value` estimasi) dan mengunci Workflow Template
   terpilih. Status `Drafting` → `Pending COGS Validation`, versi `v1.0`.

**Yang didemokan:** FR-2.5 (Project Identifier), FR-2.0.1 (Workflow
Template Catalog dipilih otomatis, bukan hardcode).

### Langkah 2 — Perlihatkan batasan RBAC (Sales tanpa akses COGS)

Sebagai Sales Officer, buka kembali quotation ini. Panel cost line untuk
kelompok **COGS**, **Profitability**, dan **Add-Ons** **tidak
ditampilkan sama sekali** — bukan sekadar disamarkan `••••` seperti POC
lama, karena Sales memang tidak berwenang mengetahui strukturnya sama
sekali. Hanya kelompok **Sales** (STNK, Insurance, Incentive, Agency
Fee) dan ringkasan harga jual final yang terlihat.

> **Catatan urutan.** Setelah disubmit, form cost line kelompok
> COGS/Add-Ons/Profitability hanya terbuka untuk **COGS Owner yang
> stepnya sedang aktif** — dan sesuai urutan terkoreksi, **VP Operations
> aktif lebih dulu**. Ditegakkan di UI **dan** di server.

### Langkah 3 — VP Operations mengisi kelompok COGS & Add-Ons

1. Logout, login sebagai **vpops@vktr.demo**.
2. Buka quotation yang sama — step VP Operations aktif.
3. Isi kelompok **COGS** (nilai per unit, IDR):

   | Item | Nilai/unit |
   |---|---|
   | FOB Price in IDR | 780.000.000 |
   | Freight and Insurance | 35.000.000 |
   | Custom Duties | 62.000.000 |
   | Port Handling, Clearance, and Pre-Delivery Inspection | 18.000.000 |
   | Carrosserie Allocation | 210.000.000 |
   | Assembly Cost | 45.000.000 |
   | Local Parts | 28.000.000 |
   | Accessories | 9.000.000 |
   | Telematics | 6.000.000 |
   | Warehousing and Storage | 4.500.000 |
   | Warranty Cost | 32.000.000 |
   | Initial Energy Injection | 3.000.000 |
   | Administrative Cost | 5.500.000 |

4. Isi kelompok **Add-Ons**:

   | Item | Nilai/unit | Catatan |
   |---|---|---|
   | Processing Service | 4.000.000 | |
   | Delivery Service | *(kosongkan)* | `may_follow_later = true` — boleh disusulkan |
   | KEUR | 2.500.000 | |
   | Additional | 0 | |

5. Klik **Simpan & Hitung Ulang Harga** — harga dasar sudah dapat
   dihitung **meski Delivery Service masih kosong**, lalu klik
   **Approve**.

**Perhatikan:** quotation **tidak** langsung maju ke Chief Sales.
Setelah VP Operations approve, tahap berikutnya yang terbuka adalah
**VP Finance** (step_order 2) — bukan keduanya berjalan bersamaan.
Basic Workflow default v3.0 bersifat sekuensial penuh: VP Finance baru
bisa mulai mengisi setelah VP Operations benar-benar `APPROVED`.

**Yang didemokan:** FR-2.0 (urutan VP Operations lebih dulu, cost
structure riil BTEL), `may_follow_later` (FR-2.2 — Delivery Service
tidak menghambat harga dasar).

### Langkah 4 — VP Finance mengisi kelompok Profitability & memicu Guardrail

1. Logout, login sebagai **vpfinance@vktr.demo**.
2. Buka quotation yang sama.
3. **Untuk mendemokan Margin Guardrail**, isi margin sengaja rendah dulu:

   | Item | Nilai |
   |---|---|
   | VKTS Profit Before Tax | 15.000.000 |
   | VKTS Margin (%) | 3 |
   | VKTR Profit Before Financing Cost | 8.000.000 |
   | Financing Cost (%) | 2 |
   | VKTR Margin After Financing Cost (%) | 2 |

4. **Simpan & Hitung Ulang Harga.**
5. Banner merah muncul: GPM akhir jatuh ke **Tier 3** (di bawah 12%) —
   bila dirilis apa adanya, quotation memerlukan **2 approval BOD**
   sebelum rilis.
6. Buka **DSS** di sidebar — quotation ini muncul di kartu **Intelligent
   Margin Guardrails**.

### Langkah 5 — VP Finance memperbaiki margin ke Tier 1

1. Naikkan nilai margin:

   | Item | Nilai baru |
   |---|---|
   | VKTS Margin (%) | 9 |
   | Financing Cost (%) | 5 |
   | VKTR Margin After Financing Cost (%) | 6 |

2. **Simpan & Hitung Ulang Harga** — banner merah hilang, GPM akhir naik
   ke Tier 1 (≥15%), tidak memerlukan approval tambahan saat rilis.
3. Karena VP Finance boleh melihat raw margin, tunjukkan angka GPM/EBITDA
   yang sebenarnya (bandingkan dengan tampilan Sales Officer di Langkah 2
   yang sama sekali tidak menampilkan kelompok ini).
4. Klik **Approve**.

Kedua COGS Owner (VP Operations lebih dulu, lalu VP Finance) kini
approved secara berurutan → status maju ke `Pending Chief Sales
Review`.

### Langkah 6 — Chief Sales merakit quotation final

1. Logout, login sebagai **chiefsales@vktr.demo**.
2. Buka quotation yang sama. Step Chief Sales kini aktif — tinjau hasil
   rakitan seluruh COGS Owner (bukan menyusun dari awal seperti asumsi
   lama).
3. Klik **Approve**.

Karena ini step terakhir, sistem menjalankan **Release Gate**:

- seluruh komponen mandatory terisi (termasuk memeriksa apakah Delivery
  Service — yang `may_follow_later` — sudah dilengkapi; bila belum,
  gate menahan rilis meski harga dasar sudah bisa dihitung sejak
  Langkah 3),
- seluruh COGS Owner sudah menyetujui,
- Tier margin terpenuhi approvalnya (Tier 1 di sini — tidak perlu
  approval tambahan).

Bila semuanya lolos → status `Quotation Released`, dan sistem
menghasilkan **PDF via Format Quotation Template** (FR-1.5.3) yang
menyertakan spesifikasi/gambar dari Product Master Data (Langkah 0).

> **Demo alternatif (opsional).** Kembali ke VP Operations, isi Delivery
> Service, lalu tunjukkan bahwa sebelumnya Chief Sales approve akan
> ditahan Release Gate dengan pesan "Komponen mandatory belum lengkap:
> Delivery Service" — meski harga dasar sudah tampil sejak awal.

---

## 2. Skenario Negosiasi: Margin-Tier Discount Authority

Panel **Commercial Negotiation** muncul di halaman quotation begitu
statusnya keluar dari `Drafting`, dan **tetap tersedia setelah quotation
dirilis**.

> **Perhatikan angkanya.** Setelah Langkah 6, GPM akhir quotation ini
> berada tepat di ambang Tier 1 (≥15%) — jaraknya tipis terhadap batas
> Tier 2 (15%). Karena diskon memotong harga jual sementara biaya tetap,
> diskon kecil pun sudah cukup mendorong quotation ke Tier 2. Jadi
> jangan heran bila tier berubah bahkan pada diskon terkecil; justru itu
> yang ingin ditunjukkan — sistem memperlihatkan dampak profitabilitas
> *sebelum* approver memutuskan.

### Langkah 7 — Diskon kecil: tetap Tier 1

1. Login sebagai **sales@vktr.demo**, buka quotation tadi.
2. Di panel Commercial Negotiation, pilih mode input **Persentase**,
   ajukan diskon **1%** dengan catatan *"Permintaan Dishub untuk
   penyesuaian anggaran"*.
3. Sistem menghitung GPM akhir → masih **Tier 1** → **auto-release**,
   tidak ada approval tambahan. Sales melihat harga baru langsung
   berlaku.

**Yang didemokan:** FR-6.1.1 (dual-mode discount input) dan Tier 1
auto-release tanpa approval.

### Langkah 8 — Diskon menengah: eskalasi ke Tier 2 (3 pihak)

1. Masih sebagai Sales Officer, ajukan diskon **4%**, kali ini pilih
   mode input **Rupiah** (sistem otomatis menghitung persentase
   setaranya).
2. Sistem menandai **Tier 2 — 3 Pihak** dan menampilkan GPM akhir yang
   turun ke bawah 15%. Status: `PENDING_TIER2_APPROVAL`.
3. Login berturutan sebagai ketiga pihak untuk memberi ACK:
   - **sales@vktr.demo** → Approve (sebagai pengaju sekaligus salah
     satu pihak).
   - **vpfinance@vktr.demo** → Approve (sebagai Profitability Owner).
   - **chiefsales@vktr.demo** → Approve (sebagai Pricing Owner).
4. Setelah **ketiganya** approve (AND-join lengkap), status berubah
   `APPROVED` dan diskon diterapkan.

**Perhatikan:** bila baru 2 dari 3 pihak approve, status tetap
`PENDING_TIER2_APPROVAL` — tunjukkan ini sebagai bukti AND-join nyata,
bukan OR.

**Yang didemokan:** FR-6.2 (auto-escalation berbasis tier), AND-join
3 pihak (Technical Logic §11.2).

### Langkah 9 — Diskon besar: Tier 3 & Revise loop dengan 2 BOD

1. Login sebagai **sales@vktr.demo**, buka **quotation baru** hasil
   Langkah 8 (ingat: setelah quotation pertama rilis, negosiasi
   berikutnya yang disetujui menghasilkan quotation baru via Project
   Identifier — lihat §3 di bawah). Ajukan diskon besar, mis. **15%**.
2. Sistem menandai **Tier 3 — 2 BOD**, GPM akhir jatuh jauh di bawah
   12% — peringatan margin merah tampil.
3. Logout, login sebagai **bod1@vktr.demo**. Alih-alih menyetujui, isi
   *counter* **6%** lalu klik **Revise**.
   - Request 15% menjadi `Superseded`.
   - Request baru 6% dibuat otomatis, dan **tier dievaluasi ulang** →
     GPM akhir naik ke atas 12% → jatuh ke **Tier 2** (3 pihak), bukan
     otomatis disetujui BOD.
4. Lanjutkan seperti Langkah 8: Sales, VP Finance, dan Chief Sales
   masing-masing approve request 6% tersebut.

**Yang didemokan:** revision loop (Technical Logic §11.2) — tier
dihitung ulang dari GPM baru, bisa turun dari Tier 3 ke Tier 2. Bila
ingin mendemokan **AND-join dua BOD** secara utuh (tanpa Revise),
ulangi dengan diskon yang tetap di Tier 3 dan minta **bod1@vktr.demo**
approve lalu **bod2@vktr.demo** approve — tunjukkan status tetap
`PENDING_TIER3_BOD_APPROVAL` setelah baru satu BOD approve.

---

## 3. Skenario Pendukung: Project Identifier & Revisi Quotation

1. Sebagai **sales@vktr.demo**, buka quotation yang sudah
   `QUOTATION_RELEASED` dari §1–§2.
2. Klik **Buat Revisi** — pilih alasan *"Jumlah unit berubah dari 30
   menjadi 25"*.
3. Sistem membuat `pricing_proposal` baru dengan
   `project_identifier_id` yang **sama** (`PRJ-DJB-2026-001`) dan
   `supersedes_proposal_id` menunjuk ke quotation sebelumnya. Status
   dimulai dari `DRAFT` — ulangi alur Sales → VP Operations → VP
   Finance → Chief Sales.
4. Setelah revisi ini `QUOTATION_RELEASED`, buka **Lifecycle
   Dashboard** — quotation lama otomatis bertanda `SUPERSEDED`, dan
   keduanya tampil sebagai satu linimasa di bawah Project Identifier
   yang sama.

**Yang didemokan:** FR-2.5 — riwayat harga yang pernah dikirim ke
pelanggan tetap utuh, revisi tidak menimpa data lama.

---

## 4. Skenario Pendukung: Observability & Audit

1. Login sebagai role manapun, buka **Lifecycle & Approvals**.
2. Tampilan **Kanban**: quotation berpindah kolom (Drafting → Pending
   COGS Validation → Pending Chief Sales Review → Quotation Released),
   dikelompokkan per **Project Identifier**.
3. Klik toggle **Table** — tunjukkan filter by Lini Bisnis, Status, dan
   Project Identifier.
4. Buka **Audit Trail** — setiap aksi tercatat: CREATE, RECALCULATE,
   APPROVE, NEGOTIATION_REQUEST, NEGOTIATION_DECISION, SUPERSEDE,
   BLOCKED_DUPLICATE_ATTEMPT. Tekankan: tabel ini **append-only**.

---

## 5. Skenario Pendukung: Master Data, Workflow Catalog & Fraud Guard

1. Login sebagai **admin@vktr.demo**.
2. **Master Data & CBS** — tabel cost item tunggal dengan 4 kelompok
   (COGS/Profitability/Sales/Add-Ons) dan pengisi masing-masing. Coba
   tambah 1 cost item baru di kelompok Add-Ons.
3. **Workflow Template Catalog** — tunjukkan minimal dua Basic Workflow
   (Margin-Tier & Segmen Customer) dan cara menambah template ketiga
   tanpa mengubah kode.
4. **Margin Tier Authority** — tunjukkan tabel 3 tier dengan ambang GPM
   yang bisa diubah tanpa rilis ulang aplikasi.
5. **Fraud Guard Demo**: sebagai **sales@vktr.demo**, coba buat
   quotation kedua untuk customer + produk yang sama pada hari yang
   sama seperti Langkah 1 — sistem menolak dengan pesan "Batas
   quotation harian untuk customer & tipe unit ini sudah tercapai", dan
   percobaan ini tercatat di audit trail sebagai `BLOCKED_DUPLICATE_ATTEMPT`.

---

## 6. Ringkasan Hasil yang Harus Terlihat di Akhir Demo

| Modul | Bukti yang terlihat |
|---|---|
| Master Data & CBS (tunggal, struktur BTEL) | 4 kelompok cost dengan pengisi masing-masing; satu struktur untuk semua lini bisnis |
| Product Master Data | Spesifikasi/gambar terpisah dari cost, dirujuk quotation & PDF |
| Urutan aktor terkoreksi | Sales → VP Operations → VP Finance → Chief Sales; Sales tanpa akses breakdown COGS sama sekali |
| `may_follow_later` | Delivery Service tidak menghambat harga dasar, tetap wajib sebelum rilis |
| Workflow Template Catalog | Alur dipilih otomatis dari katalog; minimal 2 varian (Margin-Tier, Segmen Customer) |
| Release Gate | Quotation tidak bisa dirilis bila COGS belum lengkap / tier margin belum di-approve |
| Margin-Tier Negotiation | Tier dihitung dari GPM akhir; AND-join 3 pihak (Tier 2) & 2 BOD (Tier 3); dual-mode input Rupiah/% |
| Project Identifier | Revisi menghasilkan quotation baru, linked, quotation lama SUPERSEDED |
| Fraud Guard | Percobaan quotation ganda ditolak & tercatat |
| RBAC | Sales tidak melihat kelompok COGS/Profitability/Add-Ons sama sekali |
| Observability | Kanban per Project Identifier; Audit Trail immutable mencakup negosiasi & fraud attempt |
| DSS | What-If slider (FX aktif); Guardrail alert; Win/Loss Optimal Price Band |

---

## 7. Catatan Batasan & Open Items

- **Kepemilikan cost group masih asumsi** — pemetaan COGS/Add-Ons→VP
  Operations, Profitability→VP Finance, Sales→Sales Officer **belum
  dikonfirmasi eksplisit** oleh VKTR (Technical Logic §14 no. 12).
- **Struktur Format Quotation PDF** belum final — menunggu dokumen
  contoh dari tim Sales/Product VKTR (PRD FR-1.5.3).
- **Customer KYC & Opportunity Assessment (PRD Module 7) tetap belum
  dibangun** — nama pelanggan cukup diisi sebagai teks bebas pada
  Project Identifier.
- **Notifikasi SLA breach tidak terkirim** ke Email/Teams/WhatsApp —
  hanya divisualisasikan di UI.
- **Tidak ada ekspor ke ERP/CRM** — quotation `Released` berhenti di
  PriceCore.
- **Ambang Margin Tier (15%/12%) bersifat ilustratif** — perlu
  dikonfirmasi ke Chief Sales & BOD sebelum go-live.
- **Kurs & HMA**: kurs CNY/IDR (RMB) ditarik otomatis mingguan dari API
  bank (lihat DEMO-SCENARIO-CNY.md); HMA tetap input manual sebagai
  referensi saja.
- **Skrip seed/reset demo perlu pembaruan skema** sebelum skenario ini
  dapat dijalankan — lihat catatan di bagian Prasyarat.
