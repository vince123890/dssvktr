# Skenario Demo — VKTR-PriceCore POC (v2.0)

> **Status terhadap PRD v2.1.** Kebutuhan **multi-currency (toggle
> USD/IDR)** dan **Mineral Index HMA/HPM** sudah ditetapkan di
> [`PRD-VKTR-PriceCore.md`](PRD-VKTR-PriceCore.md) §FR-1.4 & Module 8
> serta dirancang di
> [`TECHNICAL-LOGIC-VKTR-PriceCore.md`](TECHNICAL-LOGIC-VKTR-PriceCore.md)
> §12–13, **namun belum dibangun di aplikasi**. Langkah-langkah di bawah
> masih memakai input IDR tanpa penyesuaian mineral — sesuai keadaan
> aplikasi saat ini. Lihat §7 untuk cara menyampaikannya saat demo.

Dokumen ini adalah panduan langkah-demi-langkah untuk mendemokan POC:
siapa login sebagai apa, data apa yang dimasukkan, ke mana alurnya, dan
hasil yang seharusnya terlihat di tiap tahap. Disusun agar satu sesi demo
menyentuh **seluruh modul inti** sesuai *Commercial Quotation Approval
System Requirement for VKTR*: COGS Validation (paralel), Release Gate,
Commercial Negotiation (delegated discount authority), Observability, dan
DSS.

> **Baru pertama kali?** Baca
> [`DEMO-FLOW-OVERVIEW.md`](DEMO-FLOW-OVERVIEW.md) lebih dulu — di sana ada
> peta besarnya: enam peran dalam satu halaman, diagram alur quotation dan
> negosiasi, serta urutan login sepanjang sesi. Dokumen ini adalah
> detail per-langkahnya.

Prasyarat: sudah menjalankan `npm run seed:demo` (lihat README §4–5) —
ini menyediakan 6 akun demo dan ±15 quotation historis untuk Win/Loss
Analytics.

> **Mengulang demo.** Sebelum sesi demo berikutnya, jalankan:
>
> ```bash
> npm run reset:demo
> ```
>
> Perintah ini menghapus quotation yang dibuat saat demo beserta workflow,
> negosiasi, dan audit log-nya, lalu mengembalikan 15 quotation historis ke
> posisi semula — sehingga skenario di bawah bisa dijalankan lagi dari
> Langkah 1 dengan hasil yang sama. Master data dan keenam akun demo
> **tidak** disentuh, jadi tidak perlu seed ulang atau menyentuh Supabase
> Dashboard.

---

## 0. Peta Peran & Kredensial

| Login sebagai | Email | Tugas dalam skenario |
|---|---|---|
| **Sales Officer** | sales@vktr.demo | Membuat quotation request, mengajukan diskon dalam batas wewenangnya, mencatat hasil tender |
| **Chief Sales** | chiefsales@vktr.demo | Merakit quotation final, meminta validasi COGS, menyetujui diskon menengah |
| **VP Finance** | vpfinance@vktr.demo | COGS Owner — margin, OPEX, komponen finansial |
| **VP Operations** | vpops@vktr.demo | COGS Owner — logistik, STNK, delivery, biaya operasional |
| **BOD** | bod@vktr.demo | Meninjau *commercial case* untuk diskon besar; Approve / Reject / Revise |
| **System Admin** | admin@vktr.demo | Kelola Master Data, Workflow, & Discount Authority Matrix |

Password semua akun: `PriceCore123!`

Karena ini POC single-browser, cara termudah berpindah peran: **logout
lewat tombol di sidebar, lalu login ulang** dengan akun berikutnya. Untuk
demo yang lebih mulus, buka beberapa jendela browser berbeda (atau mode
Incognito terpisah per peran) supaya semua sesi tetap aktif.

### Struktur wewenang diskon (seed default)

| Peran | Batas diskon |
|---|---|
| Sales Officer | ≤ 3% |
| Chief Sales | ≤ 8% |
| BOD | tanpa batas |

---

## 1. Skenario Utama: "30 Unit EV Bus — Dishub Provinsi Jawa Barat"

Skenario ini dirancang agar menyentuh **semua** kontrol kunci: validasi
COGS paralel oleh dua VP, release gate, guardrail margin, dan eskalasi
diskon sampai ke BOD.

### Langkah 1 — Sales Officer membuat quotation request

1. Login sebagai **sales@vktr.demo**.
2. Buka **Pricing Proposals → Proposal Baru**.
3. Isi:
   - Judul: `30 Unit EV Bus — Dishub Provinsi Jawa Barat`
   - Lini Bisnis: `B2G Tender Bus`
   - Customer: `Dishub Provinsi Jawa Barat`
   - Jumlah Unit: `30`
4. Klik **Buat Draft & Lanjut ke CBS Builder** → status `Drafting`, versi `v1.0`.

**Yang didemokan:** FR-1.3 Pricing Template — CBS otomatis mengikuti
template "B2G Tender Bus" tanpa Sales perlu tahu detail komponen biaya.

### Langkah 2 — Perlihatkan batasan RBAC

Selama `Drafting`, form cost line terbuka untuk siapa pun yang
menyiapkannya. Yang membedakan peran adalah *apa yang boleh dilihat*:
panel ringkasan menampilkan `••••` untuk GPM/EBITDA/Margin karena **Sales
Officer tidak boleh melihat raw margin** (`src/lib/rbac.ts`).

Jangan isi apa pun di sini — cukup tunjukkan `••••`-nya, lalu isi nilai
awal seperlunya agar quotation bisa disubmit (lihat Langkah 3).

> **Catatan urutan.** Setelah disubmit, form cost line hanya terbuka untuk
> **COGS Owner yang stepnya sedang aktif**. Karena validasi COGS berjalan
> paralel, VP Finance dan VP Operations sama-sama bisa mengisi bagiannya
> di waktu yang sama. Aturan ini ditegakkan di UI **dan** di server
> (`src/lib/workflow/editGate.ts`).

### Langkah 3 — Isi nilai awal & submit ke workflow

Masih sebagai Sales Officer, isi **Direct Costs** (nilai per unit):

| Item | Nilai/unit |
|---|---|
| Battery Pack (BOM) | 900.000.000 |
| Chassis (BOM) | 430.000.000 |
| Powertrain / Motor (BOM) | 320.000.000 |
| Karoseri / Body Building | 270.000.000 |
| Bea Masuk / Tarif Impor | 190.000.000 |
| Shipping & Logistics | 45.000.000 |

Klik **Simpan & Hitung Ulang Harga**, lalu **Submit untuk Approval**.

Status berubah ke `Pending COGS Validation`, dan panel workflow di kanan
menampilkan **dua step aktif bersamaan** — VP Finance dan VP Operations.

**Yang didemokan:** FR-2.0 — validasi COGS paralel, bukan berantai.

### Langkah 4 — VP Operations memvalidasi komponen operasional

1. Logout, login sebagai **vpops@vktr.demo**.
2. Buka quotation yang sama. Form terbuka karena stepnya aktif.
3. Isi komponen milik VP Operations:

   | Item | Nilai/unit |
   |---|---|
   | STNK / Vehicle Registration | 12.000.000 |
   | Delivery & Handling | 15.000.000 |
   | Testing & Homologasi | 35.000.000 |
   | Pengujian Tipe | 18.000.000 |
   | Warranty Provision | 40.000.000 |
   | After-Sales Maintenance Support | 20.000.000 |
   | Overheads Proyek | 25.000.000 |

4. **Simpan & Hitung Ulang Harga**, lalu klik **Approve**.

**Perhatikan:** quotation **tidak** langsung maju ke Chief Sales. Panel
menampilkan pesan bahwa sistem masih menunggu VP Finance — inilah
**AND-join** (FR-2.0). Ini poin demo penting.

### Langkah 5 — VP Finance memvalidasi & memicu Guardrail Alert

1. Logout, login sebagai **vpfinance@vktr.demo**.
2. Buka quotation yang sama.
3. **Untuk mendemokan Margin Guardrail (FR-4.2)**, isi margin sengaja rendah dulu:

   | Item | Nilai |
   |---|---|
   | OPEX / Overhead Allocation | 20.000.000 |
   | Cost of Funds | 3 (%) |
   | Financial Leasing Margin | 1 (%) |
   | Sales Commission | 1.5 (%) |
   | Contingency Buffer | 1 (%) |

4. **Simpan & Hitung Ulang Harga.**
5. Banner merah muncul: GPM di bawah ambang minimum 14% untuk lini bisnis ini.
6. Buka **DSS** di sidebar — quotation ini muncul di kartu **Intelligent
   Margin Guardrails**.

### Langkah 6 — VP Finance memperbaiki margin

1. Naikkan nilai margin:

   | Item | Nilai baru |
   |---|---|
   | Cost of Funds | 8 (%) |
   | Financial Leasing Margin | 4 (%) |
   | Sales Commission | 3 (%) |
   | Contingency Buffer | 3 (%) |

2. **Simpan & Hitung Ulang Harga** — banner merah hilang, GPM di atas 14%.

   > **Kenapa harus setinggi itu?** Margin factor dihitung sebagai
   > persentase *terhadap cost*, sedangkan GPM terhadap *harga jual*:
   > `GPM = s / (1 + s)`. Total margin 18% menghasilkan GPM ±15%, dan untuk
   > sekadar menyentuh 14% dibutuhkan total margin **16,28%**. Total 13,5%
   > (mis. 6/3/2/2.5) hanya memberi GPM ±11,9% — banner tidak akan hilang.

3. Karena VP Finance boleh melihat raw margin, tunjukkan angka GPM/EBITDA
   yang sebenarnya (bandingkan dengan `••••` saat login sebagai Sales
   Officer di Langkah 2).
4. Klik **Approve**.

Kedua COGS Owner kini approved → AND-join terpenuhi → status maju ke
`Pending Chief Sales Review`.

### Langkah 7 — Chief Sales merakit quotation final

1. Logout, login sebagai **chiefsales@vktr.demo**.
2. Buka quotation yang sama. Step Chief Sales kini aktif.
3. Klik **Approve**.

Karena ini step terakhir, sistem menjalankan **Release Gate**
(`src/lib/workflow/releaseGate.ts`) sebelum meloloskan quotation:

- seluruh komponen COGS mandatory terisi,
- seluruh COGS Owner sudah menyetujui,
- margin di atas ambang (atau ada persetujuan BOD).

Bila semuanya lolos → status `Quotation Released`.

**Yang didemokan:** FR-2.2 Release Gate — kontrol yang secara langsung
mencegah insiden *margin leakage* yang melatarbelakangi proyek ini.

> **Demo alternatif (opsional).** Untuk memperlihatkan gate ini menolak,
> kosongkan salah satu komponen mandatory sebelum Chief Sales approve —
> sistem akan menampilkan pesan "Komponen COGS mandatory belum lengkap"
> dan quotation **tidak** dirilis.

---

## 2. Skenario Negosiasi: Diskon Berjenjang sampai BOD

Panel **Commercial Negotiation** muncul di halaman quotation begitu
statusnya keluar dari `Drafting`, dan **tetap tersedia setelah quotation
dirilis** — memang di titik itulah pelanggan menerima harga lalu meminta
diskon.

> **Perhatikan angkanya.** Setelah Langkah 7, GPM quotation ini 15,25%
> dengan ambang 14% — jaraknya hanya **1,25 poin**. Karena diskon memotong
> harga jual sementara biaya tetap, **diskon 1% saja sudah cukup menekan
> GPM di bawah ambang**. Jadi jangan heran bila peringatan margin muncul
> bahkan pada diskon terkecil; justru itu yang ingin ditunjukkan — sistem
> memperlihatkan dampak profitabilitas *sebelum* approver memutuskan.

### Langkah 8 — Diskon kecil: wewenang Sales Officer

1. Login sebagai **sales@vktr.demo**, buka quotation tadi.
2. Di panel Commercial Negotiation, ajukan diskon **2%** dengan catatan
   *"Permintaan Dishub untuk penyesuaian anggaran"*.
3. Perhatikan: sistem menampilkan **Wewenang diperlukan: Sales Officer** —
   ditentukan otomatis, bukan dipilih pengaju.
4. Sistem menampilkan dampaknya: harga turun dari Rp 82,84 M ke
   **Rp 81,18 M**, GPM turun ke **13,52%** — di bawah ambang, sehingga
   muncul peringatan margin merah.
5. Karena diskon masih dalam wewenangnya, Sales Officer tetap dapat
   **Approve**. Tekankan bahwa peringatan ini *terlihat sebelum* keputusan
   diambil — inilah yang hilang pada proses manual dan menyebabkan
   *margin leakage*.

### Langkah 9 — Diskon menengah: eskalasi ke Chief Sales

1. Masih sebagai Sales Officer, ajukan diskon **6%**.
2. Sistem menandai **Wewenang diperlukan: Chief Sales**, dan Sales Officer
   **tidak** melihat tombol Approve — hanya keterangan bahwa keputusan ada
   di Chief Sales. Dampaknya: harga **Rp 77,87 M**, GPM **9,84%**.
3. Logout, login sebagai **chiefsales@vktr.demo** → tombol Approve/Reject/
   Revise muncul. Klik **Approve**.

**Yang didemokan:** FR-6.2 — eskalasi otomatis, *authority bypass*
mustahil karena approver dihitung di server.

### Langkah 10 — Diskon besar: BOD & Revise loop

1. Login sebagai **sales@vktr.demo**, ajukan diskon **15%**.
2. Sistem menandai **Wewenang diperlukan: BOD**, dan menampilkan
   **peringatan margin merah** — harga jatuh ke **Rp 70,41 M** dengan GPM
   tinggal **0,30%**, praktis tanpa laba. Ini contoh paling gamblang dari
   *margin leakage* yang ingin dicegah.
3. Logout, login sebagai **bod@vktr.demo**.
4. Alih-alih menyetujui, isi *counter* **7%** lalu klik **Revise**.
   - Request 15% menjadi `Superseded`.
   - Request baru 7% dibuat otomatis, dan **wewenangnya dievaluasi ulang**
     → jatuh ke Chief Sales, bukan otomatis disetujui.
5. Login sebagai **chiefsales@vktr.demo** → **Approve** request 7%.

**Yang didemokan:** FR-6.3 revision loop + FR-6.4 real-time margin
visibility. Perhatikan riwayat negosiasi tercatat lengkap di panel.

---

## 3. Skenario Pendukung: Observability & Audit

1. Login sebagai role manapun, buka **Lifecycle & Approvals**.
2. Tampilan **Kanban**: quotation berpindah kolom (Drafting → Pending COGS
   Validation → Pending Chief Sales Review → Quotation Released).
3. Klik toggle **Table** — tunjukkan filter by Lini Bisnis & Status.
4. Buka **Audit Trail** — setiap aksi tercatat: CREATE, RECALCULATE,
   APPROVE, NEGOTIATION_REQUEST, NEGOTIATION_DECISION. Tekankan: tabel ini
   **append-only** — RLS Postgres tidak mengizinkan `UPDATE`/`DELETE`
   (FR-3.3, lihat `supabase/migrations/0002_rls_policies.sql`).

---

## 4. Skenario Pendukung: Master Data & Admin

1. Login sebagai **admin@vktr.demo**.
2. **Master Data & CBS** — 3 kartu Pricing Template dengan GPM threshold
   masing-masing, lalu tabel cost item beserta **COGS Owner**-nya
   (VP Finance vs VP Operations). Coba tambah 1 cost item baru.
3. **Workflow Admin** — tunjukkan definisi workflow dengan dua step
   paralel pada tahap COGS Validation, sebagai representasi FR-2.1
   no-code configurator (di POC berupa view + toggle aktif/nonaktif,
   bukan drag-drop builder penuh).

---

## 5. Ringkasan Hasil yang Harus Terlihat di Akhir Demo

| Modul | Bukti yang terlihat |
|---|---|
| Master Data & CBS | Cost item dengan COGS Owner; template & threshold per lini bisnis |
| Dynamic Pricing Engine | GPM/EBITDA/BEP terhitung otomatis saat cost line diubah |
| COGS Validation (paralel) | Dua VP aktif bersamaan; quotation menunggu keduanya (AND-join) |
| Release Gate | Quotation tidak bisa dirilis bila COGS belum lengkap / margin di bawah ambang |
| Commercial Negotiation | Approver ditentukan sistem; eskalasi Sales → Chief Sales → BOD; Revise mengevaluasi ulang wewenang |
| Margin Visibility | Dampak diskon terhadap GPM tampil sebelum approver memutuskan |
| RBAC | Sales Officer melihat `••••`; VP Finance/BOD melihat angka asli |
| Observability | Kanban & Table real-time; Audit Trail immutable mencakup negosiasi |
| DSS | What-If slider; Guardrail alert; Win/Loss Optimal Price Band |

---

## 6. Catatan Batasan POC

- **Write lock per-step, belum per-field.** COGS Owner yang stepnya aktif
  bisa mengubah *semua* baris, bukan hanya kategori miliknya. Field-level
  lock per kategori adalah lapisan ABAC lanjutan.
- **Customer KYC & Opportunity Assessment (PRD Module 7) belum dibangun** —
  didokumentasikan sebagai requirement, tapi di POC nama pelanggan cukup
  diisi sebagai teks bebas.
- **Notifikasi SLA breach tidak terkirim** ke Email/Teams/WhatsApp — hanya
  divisualisasikan di UI (badge "SLA Breached").
- **Tidak ada ekspor ke ERP/CRM** — quotation `Released` berhenti di
  PriceCore.
- **Ambang diskon (3% / 8%) bersifat ilustratif** — angka sesungguhnya
  perlu dikonfirmasi ke Chief Sales & BOD (lihat Technical Logic §14).

---

## 7. Kebutuhan v2.1 — Sudah Dirancang, Belum Dibangun

Dua kebutuhan berikut sudah masuk PRD dan technical logic, tetapi **belum
ada di aplikasi** yang Anda demokan. Sampaikan apa adanya bila ditanya.

| Kebutuhan | Status dokumen | Status aplikasi |
|---|---|---|
| Toggle input **USD / IDR** + master kurs | PRD FR-1.4, Technical Logic §12 | Belum — seluruh input masih IDR |
| **HMA/HPM** mineral sebagai penyesuaian global | PRD Module 8, Technical Logic §13 | Belum — tidak ada faktor mineral pada kalkulasi |

### Cara membawakannya saat demo

Buka [`DEMO-FLOW-OVERVIEW.md`](DEMO-FLOW-OVERVIEW.md) §5 — di sana ada
diagram alur kedua faktor global tersebut beserta tabel HPM yang sudah
dihitung dari formula Kepmen. Gunakan itu untuk menjelaskan **rancangan**,
sambil menunjukkan aplikasi yang berjalan untuk bagian yang **sudah** ada.

Poin yang layak ditekankan:

1. **Fondasinya sudah ada.** Engine sekarang sudah menerapkan faktor FX
   terhadap komponen BOM impor. Faktor mineral memakai mekanisme yang
   sama persis — perbedaannya hanya sumber angkanya (HPM, bukan kurs).
2. **Nilai asli tidak akan ditimpa.** Rancangan multi-currency menyimpan
   angka yang diketik apa adanya beserta mata uangnya; konversi terjadi
   saat menghitung. Ini yang menjaga jejak audit ketika kurs bergerak.
3. **HPM bukan tebakan.** Formulanya diambil dari Kepmen ESDM
   No. 144.K/2026, dan angka pada tabel sudah diverifikasi terhadap file
   simulasi yang menjadi sumber.

### Yang masih perlu diputuskan

Sebelum dibangun, empat hal ini butuh jawaban dari VKTR (rinciannya di
Technical Logic §14):

- Sumber kurs USD/IDR — manual, API Bank Indonesia, atau penyedia lain;
  dan kurs mana (tengah / jual / pajak).
- Kadar Ni acuan VKTR — file simulasi memuat enam skenario (1,3%–1,8%).
- **Seberapa besar HPM memengaruhi harga battery pack.** POC merancang
  dampak proporsional penuh, tetapi bila mineral hanya menyusun sebagian
  biaya sel baterai, faktornya harus diredam. Ini yang paling berisiko
  bila diasumsikan keliru.
- Ambang kesegaran indeks — default rancangan 14 hari.
