# Spec: access-control
<!-- As-built per 2026-10-09. Sumber: src/lib/rbac.ts, src/lib/menuAccess.ts, src/lib/auth.ts, src/app/(app)/settings/actions.ts, RLS di supabase/migrations. -->

## Purpose
Role dan wewenang adalah data (Settings), bukan kode. Kode hanya memeriksa *fungsi* yang dibawa role. Setiap role hanya melihat menu dan data yang menjadi pekerjaannya; menu di luar wewenang disembunyikan di sidebar dan menjawab 404 lewat URL (FR-5.6, FR-5.7).

## Requirements

### Requirement: Role berbasis fungsi
Sistem SHALL menentukan hak pengguna dari fungsi (SALESPERSON, SALES_VALIDATOR, SALES_OPERATIONS, SALES_RELEASER, SALES_PRICING_OWNER, COGS_OWNER, PROFITABILITY_OWNER, PRICING_COMMITTEE, PRODUCT_OWNER, EXTERNAL_AGENCY, SYSTEM_ADMIN) yang dibawa app role aktif miliknya. Role tidak aktif atau tidak ada SHALL tidak memberi fungsi apa pun.

#### Scenario: Role nonaktif
- **WHEN** app role pengguna `is_active` = false
- **THEN** pengguna tidak memiliki fungsi dan dialihkan ke halaman tanpa akses

#### Scenario: Role baru dari Settings
- **WHEN** admin membuat role "Corporate Finance Manager" dengan fungsi PROFITABILITY_OWNER
- **THEN** pemegangnya langsung memiliki menu dan wewenang fungsi itu tanpa deploy

### Requirement: Mengelola role
Sistem SHALL menyimpan role (upsert per kode) dengan kode huruf besar/angka/underscore 2–40 karakter, nama ≥ 2 karakter, daftar fungsi, flag eksternal dan aktif, dan urutan; hanya oleh SYSTEM_ADMIN. Setiap perubahan SHALL diaudit sebagai SETTINGS_CHANGE.

#### Scenario: Kode tidak valid
- **WHEN** kode berisi huruf kecil atau spasi
- **THEN** ditolak "Kode role: huruf besar/angka/underscore"

#### Scenario: Sinkron enum lama
- **WHEN** role disimpan atau di-assign ke user
- **THEN** kolom `profile.role` (enum lama untuk RLS v1–v3) diperbarui sesuai fungsi (SYSTEM_ADMIN > PRODUCT_OWNER > PRICING_COMMITTEE→BOD > PROFITABILITY_OWNER→VP_FINANCE > COGS_OWNER→VP_OPERATIONS > SALES_RELEASER/SALES_OPERATIONS→CHIEF_SALES > selain itu SALES_OFFICER)

#### Scenario: Non-admin
- **WHEN** non-admin menyimpan role
- **THEN** gagal "Hanya System Admin yang dapat mengubah Settings."

### Requirement: Menugaskan role ke user
Sistem SHALL menetapkan `app_role_code` user oleh SYSTEM_ADMIN.

#### Scenario: Role tidak ada
- **WHEN** kode role tidak ditemukan
- **THEN** gagal "Role tidak ditemukan."

### Requirement: Matriks Scope Authority
Sistem SHALL menyimpan matriks wewenang Maker/Checker/Releaser per role × scope (COGS, ADD_ONS, MARGIN, SALES) × skenario (REGULAR, DEVIATION), mengganti seluruh matriks sekaligus, dan menolak penyimpanan bila ada kombinasi scope+skenario tanpa satu pun Releaser.

#### Scenario: Scope tanpa releaser
- **WHEN** matriks tidak punya Releaser untuk scope SALES skenario DEVIATION
- **THEN** gagal "Scope SALES skenario DEVIATION tidak punya Releaser sama sekali." dan matriks lama tetap

#### Scenario: Baris kosong
- **WHEN** baris tanpa can_make/can_check/can_release
- **THEN** baris dibuang saat simpan

### Requirement: Aturan pemisahan tugas
Sistem SHALL menyimpan per scope flag `maker_ne_checker`, `checker_ne_releaser`, `allow_single_actor` (upsert per scope) oleh SYSTEM_ADMIN. Pemakaiannya diatur di sdd/specs/cost-structure.

#### Scenario: Simpan aturan
- **WHEN** admin menyimpan aturan untuk scope COGS dengan maker_ne_checker = true
- **THEN** baris `scope_segregation_rule` COGS diperbarui dan audit SETTINGS_CHANGE tercatat

#### Scenario: Non-admin
- **WHEN** non-admin menyimpan aturan
- **THEN** ditolak "Hanya System Admin yang dapat mengubah Settings."

### Requirement: Matriks akses menu
Sistem SHALL memetakan menu (overview, price_estimate, quotations, lifecycle, cost_structure, dss, master_data, product, audit, settings) ke fungsi yang boleh membukanya, dengan default bawaan yang dapat diganti admin; menu Settings SHALL terkunci pada SYSTEM_ADMIN dan tidak dapat diubah. Menu di luar wewenang SHALL disembunyikan di sidebar dan halamannya menjawab 404.

Default: overview — SALESPERSON, SALES_OPERATIONS, SALES_RELEASER, COGS_OWNER, PROFITABILITY_OWNER, PRICING_COMMITTEE, SYSTEM_ADMIN · price_estimate — EXTERNAL_AGENCY, SALESPERSON, SALES_OPERATIONS, SALES_RELEASER, SYSTEM_ADMIN · quotations — SALESPERSON, SALES_OPERATIONS, SALES_RELEASER, COGS_OWNER, PROFITABILITY_OWNER, PRICING_COMMITTEE, SYSTEM_ADMIN · lifecycle, dss — SALES_OPERATIONS, SALES_RELEASER, COGS_OWNER, PROFITABILITY_OWNER, PRICING_COMMITTEE, SYSTEM_ADMIN · cost_structure — SALES_PRICING_OWNER, COGS_OWNER, PROFITABILITY_OWNER, PRICING_COMMITTEE, SYSTEM_ADMIN · master_data — COGS_OWNER, PROFITABILITY_OWNER, PRICING_COMMITTEE, SYSTEM_ADMIN · product — PRODUCT_OWNER, SYSTEM_ADMIN · audit — SALES_RELEASER, PRICING_COMMITTEE, SYSTEM_ADMIN · settings — SYSTEM_ADMIN.

#### Scenario: Akses lewat URL
- **WHEN** Sales Executive membuka `/cost-structure`
- **THEN** sidebar tidak menampilkan menu itu dan halaman menjawab 404

#### Scenario: Override admin
- **WHEN** admin menyimpan akses menu `dss` untuk PRODUCT_OWNER
- **THEN** pemegang fungsi itu melihat menu DSS; override disimpan di `app_setting` key `menu_access` dan diaudit

#### Scenario: Menu terkunci
- **WHEN** payload mencoba mengubah akses `settings`
- **THEN** perubahan diabaikan dan Settings tetap SYSTEM_ADMIN

#### Scenario: Halaman Overview tanpa akses
- **WHEN** role tanpa akses Overview membuka `/`
- **THEN** diarahkan ke menu pertama yang diizinkan, atau `/no-access` bila tidak ada

#### Scenario: Landing setelah login
- **WHEN** pengguna login
- **THEN** diarahkan ke menu pertama (urutan sidebar) yang diizinkan baginya

### Requirement: Visibilitas struktur biaya
Sistem SHALL menampilkan struktur biaya, GM, dan tier hanya kepada role berfungsi SALES_OPERATIONS, SALES_RELEASER, SALES_PRICING_OWNER, COGS_OWNER, PROFITABILITY_OWNER, PRICING_COMMITTEE, atau SYSTEM_ADMIN.

#### Scenario: Salesperson
- **WHEN** Sales Executive melihat daftar quotation
- **THEN** kolom GM · Tier tidak tampil dan total incl. VAT hanya terlihat setelah QUOTATION_RELEASED

### Requirement: Akun eksternal
Sistem SHALL memperlakukan role `is_external` atau berfungsi EXTERNAL_AGENCY sebagai eksternal; akun eksternal hanya menjangkau Price Estimate menurut matriks default.

#### Scenario: Agency membuka menu lain
- **WHEN** Authorized Agency membuka `/proposals` atau `/cost-structure`
- **THEN** 404 karena fungsi EXTERNAL_AGENCY tidak ada di matriks menu itu

#### Scenario: Dokumen pelanggan
- **WHEN** pengguna eksternal membuka dokumen Cost Estimate
- **THEN** 404

### Requirement: Wewenang fungsional operasional
Sistem SHALL memberikan: inisiasi quotation — SALESPERSON; kelola master data/kurs/item biaya/Settings — SYSTEM_ADMIN; kelola produk — PRODUCT_OWNER atau SYSTEM_ADMIN; catat WON/LOST — SALESPERSON, SALES_RELEASER, atau SYSTEM_ADMIN. Slot keputusan tier berupa fungsi ("COGS_OWNER") atau satu role spesifik ("role:CCO").

#### Scenario: Slot role spesifik
- **WHEN** slot keputusan "role:CFO" dan aktor berfungsi PRICING_COMMITTEE tetapi role-nya CCO
- **THEN** aktor tidak mengisi slot CFO

## Catatan as-built
- Wewenang kolom `profile.role` (enum lama) masih dipakai RLS v1–v3; harus dijaga sinkron oleh `legacyRoleFor` (risiko drift bila role diubah lewat SQL).
- Menyimpan matriks scope authority menghapus semua baris lalu menyisipkan ulang tanpa transaksi; kegagalan insert meninggalkan matriks kosong.
- Tidak ada UI atau validasi untuk mencegah admin menghapus fungsi SYSTEM_ADMIN dari seluruh role.
- `canViewQuotation` untuk validator memakai daftar role salesperson non-validator (tanpa hierarki tim).
- Belum ada tes otomatis untuk pemeriksaan fungsi, matriks menu, atau RLS.
