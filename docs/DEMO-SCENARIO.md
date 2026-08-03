# Skenario Demo — VKTR-PriceCore POC

Dokumen ini adalah panduan langkah-demi-langkah untuk mendemokan POC:
siapa login sebagai apa, data apa yang dimasukkan, ke mana alurnya, dan
hasil yang seharusnya terlihat di tiap tahap. Disusun agar satu sesi demo
menyentuh **semua 4 modul inti** (Master Data/CBS, Workflow Approval,
Observability Dashboard, DSS).

Prasyarat: sudah menjalankan `npm run seed:demo` (lihat README §4–5) —
ini menyediakan 6 akun demo dan ±15 proposal historis untuk Win/Loss
Analytics.

---

## 0. Peta Peran & Kredensial

| Login sebagai | Email | Tugas dalam skenario |
|---|---|---|
| **Sales Manager** | sales@vktr.demo | Membuat proposal baru, mencatat hasil tender (Won/Lost) |
| **Procurement Analyst** | procurement@vktr.demo | Mengisi biaya BOM/Karoseri/Bea Masuk/Logistik, approve step 1 |
| **Cost Engineer** | engineering@vktr.demo | Mengisi biaya Testing/Warranty, approve step 2 |
| **Finance Controller** | finance@vktr.demo | Mengisi margin & cost of funds, approve step 3, melihat raw margin |
| **C-Level / BOD** | clevel@vktr.demo | Sign-off transaksi besar (step 4), pakai What-If Simulator |
| **System Admin** | admin@vktr.demo | Kelola Master Data & Workflow Definition |

Password semua akun: `PriceCore123!`

Karena ini POC single-browser, cara termudah berpindah peran: **logout
lewat tombol di sidebar, lalu login ulang** dengan akun berikutnya. Untuk
demo yang lebih mulus, buka beberapa jendela browser berbeda (atau mode
Incognito terpisah per peran) supaya semua sesi tetap aktif.

---

## 1. Skenario Utama: "20 Unit EV Bus untuk Dishub — Large Deal"

Skenario ini sengaja dibuat **di atas threshold eskalasi Rp 50 Miliar**
(FR-2.1) sehingga workflow-nya mencakup 4 step lengkap (Procurement →
Engineering → Finance → C-Level), dan nilainya diset agar **awalnya
melanggar margin guardrail** (FR-4.2) supaya alert-nya bisa didemokan,
lalu direvisi agar lolos.

### Langkah 1 — Sales membuat draft proposal

1. Login sebagai **sales@vktr.demo**.
2. Buka **Pricing Proposals → Proposal Baru**.
3. Isi:
   - Judul: `30 Unit EV Bus — Dishub Provinsi Jawa Barat`
   - Lini Bisnis: `B2G Tender Bus`
   - Customer: `Dishub Provinsi Jawa Barat`
   - Jumlah Unit: `30`
4. Klik **Buat Draft & Lanjut ke CBS Builder** → diarahkan ke halaman
   detail proposal, status `Drafting`, versi `v1.0`.

**Yang didemokan:** FR-1.3 Pricing Template — CBS otomatis mengikuti
template "B2G Tender Bus" tanpa Sales perlu tahu detail komponen biaya.

### Langkah 2 — Sales mencoba isi CBS sendiri (perlihatkan batasan RBAC)

Di halaman proposal, tunjukkan bahwa Sales **bisa mengisi form** cost
line (POC tidak mengunci input per-field berdasarkan departemen — lihat
§Catatan Batasan di bawah), tapi setelah dihitung, panel ringkasan
menampilkan `••••` untuk GPM/EBITDA/Margin karena **role Sales tidak
boleh melihat raw margin** (NFR RBAC, `src/lib/rbac.ts`). Ini poin
demo penting untuk FR NFR Security.

Untuk alur realistis, cukup isi 2–3 nilai kecil lalu **serahkan ke
Procurement** (langkah berikutnya) yang akan mengisi lengkap.

### Langkah 3 — Procurement mengisi Direct Costs

1. Logout, login sebagai **procurement@vktr.demo**.
2. Buka proposal yang sama dari **Pricing Proposals**.
3. Isi kolom **Direct Costs** (nilai per unit, dalam Rupiah):

   | Item | Nilai/unit |
   |---|---|
   | Battery Pack (BOM) | 900.000.000 |
   | Chassis (BOM) | 430.000.000 |
   | Powertrain / Motor (BOM) | 320.000.000 |
   | Karoseri / Body Building | 270.000.000 |
   | Bea Masuk / Tarif Impor | 190.000.000 |
   | Shipping & Logistics | 45.000.000 |

4. Klik **Simpan & Hitung Ulang Harga**.

**Yang didemokan:** FR-1.1 Mappable CBS — biaya langsung terisi dan
langsung memicu kalkulasi (meskipun margin belum diisi, hasil sementara
tetap muncul).

### Langkah 4 — Procurement submit ke workflow

1. Klik **Submit untuk Approval**.
2. Perhatikan: status berubah ke `Pending Procurement` (karena nilai
   transaksi awal — hanya direct+indirect cost, margin belum masuk —
   biasanya masih di bawah Rp 50M, jadi bisa masuk workflow "Standard").
   *(Jika ingin memastikan large-deal path, isi juga Indirect Cost dan
   Margin terlebih dahulu sebelum submit — lihat Langkah 5–6 dulu, baru
   submit di akhir Langkah 6.)*
3. Panel **Multi-Department Approval Workflow** muncul di kanan,
   menampilkan step 1 (Procurement) berstatus `In Progress` dengan SLA
   timer 24 jam.
4. Karena role Procurement cocok dengan departemen step aktif, tombol
   **Approve / Approve with Conditions / Reject / Targeted Reject**
   muncul. Klik **Approve**.

**Yang didemokan:** FR-2.2 Strict Gatekeeping — step 2 (Engineering)
otomatis berubah ke `In Progress` hanya setelah step 1 disetujui; tidak
bisa di-skip.

### Langkah 5 — Engineering mengisi Indirect Costs

1. Logout, login sebagai **engineering@vktr.demo**.
2. Buka proposal yang sama.
3. Isi kolom **Indirect Costs**:

   | Item | Nilai/unit |
   |---|---|
   | Testing & Homologasi | 35.000.000 |
   | Pengujian Tipe | 18.000.000 |
   | Overheads Proyek | 25.000.000 |
   | Warranty Provision | 40.000.000 |
   | After-Sales Maintenance Support | 20.000.000 |

4. **Simpan & Hitung Ulang Harga**, lalu klik **Approve** pada step
   Engineering yang kini aktif.

### Langkah 6 — Finance mengisi Margin & memicu Guardrail Alert

1. Logout, login sebagai **finance@vktr.demo**.
2. Buka proposal yang sama.
3. **Untuk mendemokan Margin Guardrail Alert (FR-4.2)**, isi margin
   sengaja rendah dulu:

   | Item | Nilai |
   |---|---|
   | Cost of Funds | 3 (%) |
   | Financial Leasing Margin | 1 (%) |
   | Sales Commission | 1.5 (%) |
   | Contingency Buffer | 1 (%) |

4. **Simpan & Hitung Ulang Harga.**
5. Perhatikan banner merah di atas ringkasan kalkulasi:
   *"Margin Guardrail Alert (FR-4.2): GPM proyek ini (±6–7%) berada di
   bawah threshold minimum 14% untuk lini bisnis ini."*
6. Buka **DSS → Decision Support System** di sidebar, lihat proposal
   ini muncul di kartu **Intelligent Margin Guardrails**.

**Yang didemokan:** FR-4.2 secara langsung — sistem mendeteksi kombinasi
biaya yang membuat margin di bawah ambang batas manajemen, sebelum
proposal lolos ke approval berikutnya.

### Langkah 7 — Finance memperbaiki margin agar lolos threshold

1. Masih sebagai Finance, naikkan nilai margin:

   | Item | Nilai baru |
   |---|---|
   | Cost of Funds | 6 (%) |
   | Financial Leasing Margin | 3 (%) |
   | Sales Commission | 2 (%) |
   | Contingency Buffer | 2.5 (%) |

2. **Simpan & Hitung Ulang Harga** — banner merah harus hilang, GPM kini
   di atas 14%.
3. Karena Finance dapat melihat raw margin, tunjukkan panel ringkasan
   sekarang menampilkan angka GPM/EBITDA yang sebenarnya (bandingkan
   dengan tampilan `••••` saat login sebagai Sales di Langkah 2).
4. Klik **Approve** pada step Finance.

**Kalau nilai transaksi final sekarang > Rp 50 Miliar**, status proposal
akan otomatis menjadi `Pending C-Level Sign-off` (step ke-4 muncul). Jika
di bawah threshold, workflow akan langsung `Final Approved` setelah step
Finance — keduanya adalah demonstrasi valid dari FR-2.1 (eskalasi
otomatis berbasis nilai transaksi).

### Langkah 8a — Jika masuk C-Level Sign-off

1. Logout, login sebagai **clevel@vktr.demo**.
2. Sebelum approve, buka **DSS → What-If Sensitivity Simulator**,
   pilih proposal ini, geser slider:
   - **Fluktuasi Kurs USD/IDR**: +5%
   - **Perubahan Harga Material**: +8%
   - **Volume Discount**: 3%
3. Tunjukkan panel Base Case vs Simulated Case berubah **real-time**
   (< 1 detik, tanpa reload) — final price naik, GPM turun, dan jika
   turun di bawah threshold akan muncul warning merah di simulator itu
   sendiri (§FR-4.1).
4. Kembali ke halaman proposal, klik **Approve** (atau **Approve with
   Conditions** dengan catatan, misal: *"Disetujui dengan syarat lock
   kurs maksimum +3% saat kontrak ditandatangani"*).

**Yang didemokan:** FR-4.1 What-If Simulator sebagai alat negosiasi
eksekutif sebelum sign-off — persis skenario yang disebut di PRD §FR-4.1.

### Langkah 8b — Jika ingin mendemokan Targeted Rejection

Sebagai variasi (bisa dilakukan sebagai proposal terpisah, atau ulangi
alur di atas untuk unit kedua):

1. Saat berperan sebagai Finance/C-Level dan melihat ada kesalahan pada
   *biaya* (bukan margin), klik **Targeted Reject → pilih "Procurement"**
   dari dropdown, isi catatan: *"Harga Bea Masuk sepertinya belum
   termasuk PPN impor, mohon direvisi"*, klik **Kirim**.
2. Login kembali sebagai **procurement@vktr.demo** — proposal kembali
   muncul dengan status `Pending Procurement`, tanpa proposal ter-reset
   ke draft awal (versi & data yang sudah diisi departemen lain tetap
   ada).
3. Procurement revisi nilai Bea Masuk, **Approve** lagi — proposal
   otomatis lanjut kembali ke step Engineering → Finance seperti semula
   (state machine hanya membuka ulang step yang di antara target dan
   step saat penolakan terjadi).

**Yang didemokan:** FR-2.3 Targeted Rejection persis seperti contoh di
PRD ("Reject dari Finance dikembalikan ke Procurement").

### Langkah 9 — Proposal Final Approved, catat hasil tender

1. Setelah step terakhir di-approve, status proposal menjadi
   `Final Approved` (badge hijau).
2. Panel baru **Tender Outcome** muncul di atas ringkasan kalkulasi.
   Login sebagai **sales@vktr.demo** (atau tetap sebagai C-Level — kedua
   role diizinkan), klik **Tandai Won**.

**Yang didemokan:** FR-4.3 — outcome ini akan langsung menambah titik
data baru ke scatter chart Win/Loss Analytics di halaman DSS.

---

## 2. Skenario Pendukung: Observability Dashboard

Tidak perlu data baru — cukup lakukan setelah Skenario 1 berjalan
sebagian (ada proposal di berbagai status):

1. Login sebagai role manapun, buka **Lifecycle & Approvals**.
2. Tampilan default **Kanban**: tunjukkan proposal baru Anda berpindah
   kolom (Drafting → Pending Procurement → ... → Final Approved)
   seiring alur di Skenario 1 dilakukan bertahap.
3. Klik toggle **Table** — tunjukkan filter by Lini Bisnis & Status.
4. Buka **Audit Trail** — tunjukkan setiap aksi (CREATE, RECALCULATE,
   APPROVE, TARGETED_REJECT) tercatat dengan waktu, aktor, dan detail
   perubahan field. Tekankan: **tabel ini append-only** — tidak ada
   tombol edit/hapus di UI karena RLS Postgres memang tidak mengizinkan
   `UPDATE`/`DELETE` pada tabel `audit_log_entry` (FR-3.3, lihat
   `supabase/migrations/0002_rls_policies.sql`).

---

## 3. Skenario Pendukung: Master Data & Workflow Admin

1. Login sebagai **admin@vktr.demo**.
2. Buka **Master Data & CBS** — tunjukkan 3 kartu Pricing Template (satu
   per lini bisnis) dengan GPM threshold & eskalasi masing-masing, lalu
   3 tabel cost item (Direct/Indirect/Margin) yang mendasari CBS di
   Skenario 1. Coba tambah 1 cost item baru (mis. `Asuransi Pengiriman`,
   kategori Direct, owner Procurement) lewat form di atas tabel.
3. Buka **Workflow Admin** — tunjukkan bucket "B2G Standard (< Rp 50M)"
   vs "B2G Large Deal (>= Rp 50M)" dan step-step approval masing-masing,
   sebagai representasi FR-2.1 no-code workflow configurator (di POC
   ini berupa view + toggle aktif/nonaktif, bukan drag-drop builder
   penuh — lihat README §3 untuk penjelasan batasan ini).

---

## 4. Ringkasan Hasil yang Harus Terlihat di Akhir Demo

| Modul | Bukti yang terlihat |
|---|---|
| Master Data & CBS | Cost item baru tampil di tabel; template & threshold per lini bisnis |
| Dynamic Pricing Engine | GPM/EBITDA/BEP terhitung otomatis saat cost line diubah, versi v1.0 |
| Workflow Approval | Proposal berpindah status sesuai step, gatekeeping mencegah lompat step, targeted-reject mengembalikan ke dept spesifik tanpa reset draft |
| RBAC | Sales melihat `••••` untuk margin, Finance/C-Level melihat angka asli |
| Observability | Kanban & Table menunjukkan posisi real-time; Audit Trail mencatat semua aksi immutable |
| DSS — What-If | Slider mengubah GPM/EBITDA/BEP secara instan tanpa mengubah data resmi |
| DSS — Guardrail | Alert muncul saat GPM di bawah threshold, hilang setelah margin diperbaiki |
| DSS — Win/Loss | Scatter chart bertambah titik baru setelah outcome dicatat; Optimal Price Band per lini bisnis terlihat dari data historis seed |

---

## 5. Catatan Batasan POC

- **Input CBS tidak dikunci per-departemen di level UI** — siapa pun bisa
  mengetik nilai cost line di form manapun (perbedaan hak akses yang
  ditegakkan adalah *melihat* raw margin, dan *siapa yang boleh klik
  Approve* pada step aktif). Di build produksi, field-level write lock
  per kategori (misal Sales tidak bisa mengisi Margin Factor) akan
  ditambahkan sebagai lapisan ABAC lanjutan.
- **Notifikasi SLA breach tidak terkirim ke Email/Teams/WhatsApp** —
  hanya divisualisasikan di UI (badge "SLA Breached" pada
  WorkflowPanel/Lifecycle).
- **Tidak ada ekspor ke ERP/CRM** — proposal `Final Approved` berhenti
  di PriceCore; tidak ada tombol "Export to ERP" pada POC ini.
