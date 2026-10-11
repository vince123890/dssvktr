# Spec: dss-and-observability
<!-- As-built per 2026-10-09. Sumber: src/app/(app)/dss/*, src/app/api/simulate/route.ts, src/app/(app)/lifecycle/*, src/app/(app)/audit-log/page.tsx, src/app/(app)/page.tsx, src/lib/audit.ts. -->

## Purpose
Memberi pengelola harga dan approver (a) simulasi what-if, guardrail margin, dan analitik win/loss (DSS, FR-4.x), (b) pelacakan status quotation (Overview, Lifecycle, FR-3.1), dan (c) jejak audit append-only (FR-3.3).

## Requirements

### Requirement: Akses DSS
Sistem SHALL membuka DSS dan endpoint `/api/simulate` hanya bagi role yang boleh melihat cost structure DAN diizinkan matriks akses menu "dss". Selain itu SHALL menjawab 404.

#### Scenario: Salesperson
- **WHEN** Sales Executive membuka `/dss` atau memanggil `/api/simulate`
- **THEN** 404 dan tidak ada data dikembalikan

### Requirement: Simulasi what-if
Sistem SHALL, tanpa menulis apa pun, menghitung ulang quotation terpilih dengan slider: pergeseran kurs CNY/IDR (%) pada kurs terkunci tiap baris, pergeseran harga FOB (%) pada item berdenominasi CNY, dan diskon tambahan (%) pada net price. Harga yang sudah dikutip SHALL tetap; yang bergerak adalah biaya dan diskon. Hasil: base case dan simulated case (total excl. VAT, GM, margin, tier) serta delta (poin persen GM, margin, total).

#### Scenario: Tanpa pergeseran
- **WHEN** semua slider 0
- **THEN** simulated case sama dengan base case dan delta nol

#### Scenario: Kurs naik
- **WHEN** fxDeltaPct = +5
- **THEN** base_cost baris dihitung ulang dengan kurs ×1,05 memakai fungsi pricing-engine yang sama, GM turun, dan tier dievaluasi ulang dengan tangga tier quotation (template, lini bisnis, global)

#### Scenario: Diskon tambahan
- **WHEN** extraDiscountPct = 2
- **THEN** net price tiap baris × 0,98 dan GM dihitung dari net baru

#### Scenario: Quotation tidak ada
- **WHEN** proposalId tidak ditemukan
- **THEN** 404 "Quotation not found"

#### Scenario: Baris tanpa cost structure
- **WHEN** baris belum punya versi cost structure
- **THEN** baris dilewati dari perhitungan

#### Scenario: Body tidak valid
- **WHEN** proposalId kosong
- **THEN** validasi zod gagal

### Requirement: Guardrail margin
Sistem SHALL menampilkan alert untuk quotation berharga dengan GM < 15%, status bukan SUPERSEDED/EXPIRED/REJECTED, dan outcome PENDING, berisi nomor (dokumen bila ada), judul, GM, ambang 15%, total excl. VAT, dan waktu pembaruan.

#### Scenario: Ada alert
- **WHEN** satu quotation aktif berGM 12%
- **THEN** alert tampil dan lencana menghitung jumlah alert

#### Scenario: Sudah WON
- **WHEN** quotation outcome WON atau LOST
- **THEN** tidak masuk alert

### Requirement: Analitik win/loss
Sistem SHALL menghitung per quotation berhasil/gagal (outcome WON/LOST) markup = (Σ (net − sales) × qty − Σ base × qty) ÷ Σ base × qty, dan per lini bisnis: rentang dan rata-rata markup WON, rata-rata markup LOST (null bila tidak ada), serta ukuran sampel. Quotation dengan base ≤ 0 SHALL dikecualikan.

#### Scenario: Satu lini bisnis campuran
- **WHEN** lini B2G punya 2 WON (markup 0,10 dan 0,20) dan 1 LOST (0,35)
- **THEN** wonMin 0,10; wonMax 0,20; wonAvg 0,15; lostAvg 0,35; sampleSize 3

### Requirement: Overview
Sistem SHALL menampilkan kartu: jumlah quotation dalam proses dan pipeline excl. VAT, jumlah Released berlaku, jumlah menunggu approval tier, dan jumlah langkah yang melewati SLA; daftar "Menunggu tindakan Anda" (langkah aktif yang fungsinya dimiliki pengguna, slot tier yang dapat diisi pengguna pada putaran saat ini, dan draft milik pengguna); serta 8 aktivitas terbaru — semua terbatas pada quotation yang boleh dilihat pengguna. Tautan cepat disesuaikan fungsi pengguna.

#### Scenario: Antrean Head of Sales
- **WHEN** langkah REVIEW_AND_ROUTE IN_PROGRESS dengan performer SALES_RELEASER
- **THEN** Head of Sales melihat quotation itu di antrean dengan nama langkah

#### Scenario: Draft sendiri
- **WHEN** salesperson punya DRAFT
- **THEN** antrean menampilkan "Draft — lengkapi & submit"

#### Scenario: Antrean kosong
- **WHEN** tidak ada pekerjaan
- **THEN** "Tidak ada yang menunggu Anda."

### Requirement: Lifecycle
Sistem SHALL menampilkan quotation dalam tampilan Kanban per kolom status dan Table, dengan filter lini bisnis (dan status pada Table), diurut berdasarkan pembaruan terakhir.

#### Scenario: Filter lini bisnis
- **WHEN** filter diatur ke satu lini bisnis
- **THEN** kolom dan tabel hanya memuat quotation lini itu

### Requirement: Jejak audit append-only
Sistem SHALL mencatat who, what, when, why (aktor, aksi, entity, perubahan field, alasan, waktu) untuk setiap aksi bisnis lewat satu fungsi tulis; tabel audit hanya memiliki kebijakan INSERT dan SELECT bagi pengguna terautentikasi (tanpa UPDATE/DELETE). Halaman Audit Trail SHALL menampilkan 200 entri terbaru dengan filter entity type.

#### Scenario: Entri tidak dapat diubah
- **WHEN** klien mencoba UPDATE atau DELETE entri audit
- **THEN** ditolak oleh RLS

#### Scenario: Tampilan
- **WHEN** halaman audit dibuka
- **THEN** tiap baris menampilkan waktu, nama aktor ("System" bila tanpa aktor), aksi berlencana, entity type + 8 karakter id, hingga 3 perubahan field (lama → baru), dan alasan

#### Scenario: Filter entity
- **WHEN** entity type dipilih
- **THEN** hanya entri tipe itu yang tampil

#### Scenario: Akses menu
- **WHEN** role di luar matriks (default SALES_RELEASER, PRICING_COMMITTEE, SYSTEM_ADMIN) membuka `/audit-log`
- **THEN** 404

## Catatan as-built
- `writeAuditLog` hanya `console.error` saat gagal; aksi bisnis tetap sukses tanpa jejak audit (kegagalan audit tidak membatalkan aksi).
- Kebijakan RLS "authenticated read" membiarkan semua pengguna login membaca seluruh audit lewat API Supabase; pembatasan hanya di level menu.
- Halaman Lifecycle dan DSS tidak menyaring per `canViewQuotation`; aman pada default (semua role pemegang menu melihat semua quotation) tetapi bocor bila admin membuka menu itu untuk role salesperson.
- Parameter `actor` pada URL Audit Trail diproses server tetapi tidak ada kontrolnya di form.
- Pesan ambang 15%/10% pada guardrail dan kartu Overview di-hardcode; tidak mengikuti tier yang diubah di Settings.
- Pengecekan SLA hanya menandai langkah yang melewati batas; tidak ada eskalasi otomatis atau notifikasi.
- Belum ada tes otomatis.

## Perubahan v5.0 (dikodekan 2026-10-11; migrasi 0018–0019 belum diverifikasi di database)
<!-- Sumber: PRD v5.0 FR-3.4, Module 10; Technical Logic v5.0 §4.13, §4.15. -->
- **Daftar quotation Salesperson:** badge warna hijau/kuning/merah/Won/Lost/Expired, umur dalam hari, dan filter per kondisi (lihat official-quotation, "Status berwarna dari tanggal rilis"); Expired tampil merah seperti Lost.
- **Dashboard Sales (baru):** per Salesperson jumlah Released (terkirim = setelah lampiran bertanda tangan diunggah), Won, Lost, Expired, dan jumlah kuning/merah beserta nilai; Sales Ops/Head of Sales dapat memilih Salesperson atau melihat gabungan.
- **Dashboard Executive (baru, read-only):** Released vs Won, jumlah PO dan total nilai project, ringkasan termin diterima vs belum, project per status dan rata-rata progres. Tidak memuat cost structure, GM, atau tier.
- **Overview/Lifecycle:** pada konfigurasi satu workflow, status antara yang tampil hanya Draft, Pending Head of Sales Review, status approval tier bila ada diskon, dan Menunggu dokumen bertanda tangan.
