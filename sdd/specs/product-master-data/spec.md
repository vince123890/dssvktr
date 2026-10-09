# Spec: product-master-data
<!-- As-built: perilaku sistem saat ini, dibaca dari kode per 2026-10-09. Sumber: src/app/(app)/master-data/product/*, src/lib/rbac.ts. -->

## Purpose
Product Owner mengelola produk (make + model) dan variannya: spesifikasi, deskripsi dokumen, inklusi/eksklusi, gambar. Varian adalah unit yang dikutip; harganya berasal dari Cost Structure, bukan dari data ini (FR-1.5.1).

## Requirements

### Requirement: Akses kelola produk
Sistem SHALL mengizinkan menambah, mengubah, dan menonaktifkan produk/varian hanya bagi role yang memiliki fungsi PRODUCT_OWNER atau SYSTEM_ADMIN. Role lain SHALL melihat halaman read-only.

#### Scenario: Product Owner mengelola
- **WHEN** Product Owner membuka `/master-data/product`
- **THEN** tombol "Tambah Produk" tampil
- **AND** halaman detail menampilkan tautan "Ubah" dan tombol status per varian

#### Scenario: Role lain read-only
- **WHEN** role tanpa fungsi PRODUCT_OWNER/SYSTEM_ADMIN membuka daftar produk
- **THEN** tombol tambah/ubah tidak tampil dan muncul pemberitahuan read-only

#### Scenario: Akses ditolak di server
- **WHEN** role tanpa fungsi tersebut memanggil create/update/toggle action
- **THEN** action gagal dengan pesan "Hanya Product Owner / System Admin yang dapat mengelola produk."
- **AND** tidak ada data berubah

#### Scenario: Halaman tambah produk bagi non-pengelola
- **WHEN** non-pengelola membuka `/master-data/product/new`
- **THEN** sistem menampilkan 404

### Requirement: Daftar produk
Sistem SHALL menampilkan produk yang dikelompokkan per make + model (make kosong dianggap "VKTR", model kosong dianggap nama varian), dengan jumlah varian aktif dari total dan jumlah varian "siap dikutip".

#### Scenario: Siap dikutip
- **WHEN** daftar produk dimuat
- **THEN** varian dihitung siap dikutip bila ACTIVE dan punya cost structure berstatus RELEASED
- **AND** badge "siap dikutip" hijau hanya bila semua varian aktif siap dan jumlahnya > 0, selain itu kuning

#### Scenario: Belum ada produk
- **WHEN** tidak ada produk terdaftar
- **THEN** tabel menampilkan "Belum ada produk terdaftar."

### Requirement: Detail produk
Sistem SHALL menampilkan semua varian satu produk di `/master-data/product/[make]/[model]` beserta code, nama, type · variant, build · loco, status cost structure, dan status varian.

#### Scenario: Status cost structure per varian
- **WHEN** detail produk dimuat
- **THEN** varian dengan cost structure RELEASED menampilkan "v<n> RELEASED"
- **AND** varian tanpa RELEASED menampilkan "Belum ada — belum dapat dikutip"
- **AND** bila ada DRAFT, ditampilkan "Draft v<n> sedang disusun"

#### Scenario: Produk tidak ada
- **WHEN** URL menunjuk make/model yang tidak punya varian
- **THEN** sistem menampilkan 404

### Requirement: Tambah produk / varian
Sistem SHALL membuat varian baru berstatus ACTIVE dengan code unik dan nama minimal 2 karakter. Produk baru terdaftar lewat varian pertamanya; varian berikutnya ditambahkan dari halaman detail dengan make/model terisi.

#### Scenario: Tambah produk baru
- **WHEN** Product Owner mengisi code dan nama valid di `/master-data/product/new` lalu menyimpan
- **THEN** varian tersimpan dengan status ACTIVE dan `created_by` = pengguna
- **AND** audit log CREATE (code, name) tertulis
- **AND** pengguna diarahkan ke detail produk dengan pesan sukses

#### Scenario: Tambah varian ke produk yang ada
- **WHEN** Product Owner membuka `?new=variant` di detail produk dan menyimpan
- **THEN** varian baru muncul di tabel varian produk tersebut

#### Scenario: Input tidak valid
- **WHEN** code atau name kurang dari 2 karakter
- **THEN** penyimpanan ditolak dengan pesan error dan tidak ada baris dibuat

#### Scenario: Code duplikat
- **WHEN** code sudah dipakai varian lain
- **THEN** penyimpanan gagal dengan error dari database (kolom `code` UNIQUE)

#### Scenario: Varian baru belum dapat dikutip
- **WHEN** varian baru dibuat
- **THEN** varian tidak muncul di Price Estimate sampai cost structure-nya RELEASED
- **AND** di form Official Quotation varian tampil tetapi tidak dapat dipilih, berlabel "(cost structure belum released)"

### Requirement: Ubah varian
Sistem SHALL mengubah varian yang ada dengan code tetap (identitas), dan mencatat setiap field yang berubah ke audit trail.

#### Scenario: Perubahan tercatat
- **WHEN** Product Owner mengubah nama dan battery_kwh lalu menyimpan
- **THEN** audit log UPDATE memuat tepat dua field berubah dengan nilai lama dan baru
- **AND** nilai numerik dari Postgres (string) dibandingkan sebagai angka sehingga tidak dianggap berubah

#### Scenario: Tidak ada perubahan
- **WHEN** form disimpan tanpa perubahan nilai
- **THEN** action sukses tanpa menulis ke database dan tanpa audit log

#### Scenario: Kosongkan field opsional
- **WHEN** field opsional (mis. loco) dikosongkan
- **THEN** nilainya menjadi null

#### Scenario: Varian tidak ditemukan
- **WHEN** id varian tidak ada
- **THEN** action gagal dengan "Produk tidak ditemukan."

### Requirement: Aktifkan / hentikan varian
Sistem SHALL mengubah status varian antara ACTIVE dan DISCONTINUED dan mencatat audit log UPDATE.

#### Scenario: Hentikan varian
- **WHEN** Product Owner menghentikan varian ACTIVE
- **THEN** status menjadi DISCONTINUED dan varian tidak lagi ditawarkan di Price Estimate maupun form Official Quotation (keduanya memfilter status ACTIVE)

## Catatan as-built (celah terhadap niat spec, bukan keputusan)
- Audit log toggle status mencatat `old: null` (nilai lama status tidak diambil).
- `toggleProductStatusAction` melempar error biasa, tidak mengembalikan `ActionResult` seperti create/update.
- `spec_sheet` dibaca oleh Price Estimate (highlights) dan dokumen cetak, tetapi tidak ada UI untuk mengisinya; `brochure_url` tidak dipakai di kode; `image_urls` diisi sebagai teks satu URL per baris (tanpa upload).
- Tidak ada validasi format code atau pencegahan DISCONTINUED pada varian yang masih punya quotation berjalan.
- Belum ada tes otomatis untuk capability ini.
