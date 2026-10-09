# Spec: master-data-and-rates
<!-- As-built per 2026-10-09. Sumber: src/app/(app)/master-data/{page,actions,RateAndIndexPanel,CostItemForm}.tsx, src/lib/pricing/{currency,mineral}.ts. Produk varian: sdd/specs/product-master-data. -->

## Purpose
System Admin mengelola master item biaya (cost item), kurs CNY→IDR, ambang sensitivitas kurs, dan indeks mineral (HMA → HPM). Kurs menjadi satu-satunya jalur dampak pasar mineral ke harga VKTR; HPM hanya referensi.

## Requirements

### Requirement: Akses master data
Sistem SHALL menampilkan menu Master Data menurut matriks akses menu (default COGS_OWNER, PROFITABILITY_OWNER, PRICING_COMMITTEE, SYSTEM_ADMIN), dan hanya SYSTEM_ADMIN SHALL dapat mengubah. Role lain read-only.

#### Scenario: Non-admin
- **WHEN** COGS Owner membuka `/master-data`
- **THEN** semua panel tampil tanpa form tambah/ubah

#### Scenario: Server menolak
- **WHEN** non-admin memanggil action master data
- **THEN** gagal dengan pesan "Hanya System Admin yang …"

### Requirement: Item biaya
Sistem SHALL menyimpan item biaya dengan code (≥ 2), nama (≥ 2), kategori (DIRECT/INDIRECT/MARGIN_FACTOR), grup (COGS/PROFITABILITY/SALES/ADD_ONS), subkategori, departemen pemilik, tipe unit (FIXED/PER_UNIT/PERCENTAGE), denominasi (IDR default, atau CNY), flag `may_follow_later` dan `is_mandatory`, dan deskripsi opsional.

#### Scenario: Tambah item
- **WHEN** System Admin menyimpan item valid
- **THEN** item dibuat dan dilampirkan ke semua CBS template aktif dengan urutan sort berikutnya
- **AND** audit CREATE memuat setiap field

#### Scenario: Input tidak valid
- **WHEN** code < 2 karakter atau enum di luar daftar
- **THEN** penyimpanan ditolak (error validasi) dan tidak ada baris dibuat

#### Scenario: Nonaktifkan item
- **WHEN** System Admin menonaktifkan item
- **THEN** `active` = false, audit UPDATE mencatat nilai lama dan baru, dan item tidak ikut dihitung di pricing-engine dan tidak dimuat oleh `loadCostItems`

#### Scenario: Id departemen seed
- **WHEN** id departemen berupa UUID tidak baku RFC 4122 (id seed)
- **THEN** diterima; keabsahan ditentukan oleh foreign key database

### Requirement: Kurs CNY→IDR append-only
Sistem SHALL menambah kurs baru sebagai baris baru (`effective_from` = sekarang, sumber default "manual") dan tidak mengedit baris lama, sehingga kurs historis tetap dapat dijelaskan. Kurs SHALL positif.

#### Scenario: Update kurs
- **WHEN** System Admin menyimpan kurs 2.700
- **THEN** baris baru dibuat dan audit RATE_UPDATE dengan field rate
- **AND** `resolveExchangeRate` mengembalikan kurs ini sebagai yang berlaku

#### Scenario: Kurs nol atau negatif
- **WHEN** kurs ≤ 0
- **THEN** ditolak dengan error validasi dan tidak ada baris dibuat

### Requirement: Ambang sensitivitas kurs
Sistem SHALL menyimpan ambang persentase (0–100) pergerakan kurs yang memicu peringatan dan menahan rilis (default 2 bila belum dikonfigurasi). Mengubah ambang tidak menghitung ulang apa pun.

#### Scenario: Ubah ambang
- **WHEN** System Admin menyimpan ambang 3
- **THEN** konfigurasi aktif diperbarui (atau dibuat bila belum ada)
- **AND** banner kurs di Cost Structure dan detail quotation serta Release Gate memakai 3

#### Scenario: Di luar rentang
- **WHEN** ambang < 0 atau > 100
- **THEN** ditolak

### Requirement: Indeks mineral (HMA) append-only
Sistem SHALL mencatat HMA periodik dengan kode mineral (disimpan huruf besar), nilai ≥ 0, periode mulai dan akhir, dan referensi regulasi opsional, sebagai baris baru.

#### Scenario: Catat HMA
- **WHEN** System Admin menyimpan HMA NI periode valid
- **THEN** snapshot dibuat dengan sumber "manual" dan audit MINERAL_INDEX_UPDATE

#### Scenario: Periode terbalik
- **WHEN** periode akhir lebih awal dari periode mulai
- **THEN** gagal "Periode akhir tidak boleh lebih awal dari periode mulai."

### Requirement: Perhitungan HPM referensi
Sistem SHALL menghitung HPM dari parameter `hpm_parameter` aktif (Kepmen ESDM 144.K/2026): CF_Ni = anchor_cf + (kadar_Ni − anchor_kadar) × slope; nilai_Ni = kadar_Ni × CF_Ni × HMA_Ni; bonus_Co = kadar_Co × CF_Co × HMA_Co; total kering = nilai_Ni + bonus_Co; HPM basah = total kering × (1 − kadar air). Semua konstanta SHALL berasal dari tabel parameter, bukan kode.

#### Scenario: Tanpa HMA companion
- **WHEN** snapshot mineral pendamping (Co) tidak ada
- **THEN** HMA_Co dianggap 0

#### Scenario: Tanpa snapshot atau parameter
- **WHEN** parameter aktif atau snapshot utama tidak ada
- **THEN** HPM = null dan indeks dianggap kedaluwarsa

### Requirement: HPM tidak memengaruhi harga
Faktor penyesuaian mineral SHALL selalu bernilai 1 (nonaktif sejak v3.0); HPM hanya tampil sebagai konteks pasar bagi approver.

#### Scenario: Harga berubah karena HMA
- **WHEN** HMA baru dicatat
- **THEN** harga quotation dan cost structure tidak berubah; dampak ke harga hanya lewat perubahan kurs

### Requirement: Indeks kedaluwarsa
Sistem SHALL menganggap indeks kedaluwarsa bila snapshot tidak ada atau `period_end` lebih dari 14 hari lalu, menampilkan peringatan dengan umur dalam hari, dan tidak memblokir pembuatan quotation.

#### Scenario: HMA berumur 20 hari
- **WHEN** snapshot NI terakhir berakhir 20 hari lalu
- **THEN** panel menampilkan "Indeks kedaluwarsa. HMA terakhir berumur 20 hari." dan quotation tetap dapat dibuat

#### Scenario: Belum ada HMA
- **WHEN** tidak ada snapshot
- **THEN** peringatan "Belum ada HMA tercatat."

## Catatan as-built
- Action item biaya (create/toggle) melempar error biasa, tidak mengembalikan `ActionResult` seperti kurs/ambang/HMA.
- Tidak ada UI untuk mengubah `hpm_parameter`; hanya lewat SQL.
- Tarik kurs otomatis mingguan (FR-1.4.2) tidak diimplementasikan; kurs diinput manual.
- Pembuatan item + penautan ke template tidak dalam satu transaksi; kegagalan penautan meninggalkan item tanpa template.
- Audit toggle item mencatat nilai lama sebagai kebalikan dari nilai baru, bukan nilai terbaca.
- USD hanya mata uang tampilan masa depan; basis perhitungan CNY.
