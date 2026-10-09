# Spec: cost-structure
<!-- As-built per 2026-10-09. Sumber: src/lib/costStructure.ts, src/app/(app)/cost-structure/*. Rumus harga ada di sdd/specs/pricing-engine. -->

## Purpose
Setiap varian punya price book berversi (Cost Structure) dalam 4 scope: COGS, Add-Ons, Margin (Profitability), Sales. Tiap scope dirilis oleh pemiliknya lewat Maker → Checker → Releaser. Hanya versi yang keempat scope-nya RELEASED yang dipakai Price Estimate dan Official Quotation (FR-1.1.2).

## Requirements

### Requirement: Akses menu Cost Structure
Sistem SHALL menampilkan menu Cost Structure hanya bagi role yang menurut matriks akses menu mengizinkannya DAN memiliki salah satu fungsi SALES_OPERATIONS, SALES_RELEASER, SALES_PRICING_OWNER, COGS_OWNER, PROFITABILITY_OWNER, PRICING_COMMITTEE, atau SYSTEM_ADMIN. Selain itu halaman SHALL menjawab 404.

#### Scenario: Salesperson tidak melihat struktur biaya
- **WHEN** role dengan fungsi SALESPERSON saja membuka `/cost-structure`
- **THEN** sistem menjawab 404

### Requirement: Membuat versi baru
Sistem SHALL membuat versi DRAFT baru (nomor = versi terakhir + 1) hanya oleh role dengan fungsi COGS_OWNER, PROFITABILITY_OWNER, SALES_PRICING_OWNER, PRICING_COMMITTEE, atau SYSTEM_ADMIN, dan mengunci kurs CNY/IDR aktif saat itu pada versi.

#### Scenario: Versi pertama untuk varian baru
- **WHEN** pemilik scope membuat versi untuk varian tanpa versi RELEASED
- **THEN** versi v1 berstatus DRAFT dibuat dengan `locked_fx_rate` = kurs aktif
- **AND** keempat scope berstatus DRAFT tanpa baris nilai
- **AND** audit log CREATE mencatat nomor versi dan kurs terkunci

#### Scenario: Versi turunan menyalin dari versi RELEASED
- **WHEN** pemilik scope membuat versi baru dan ada versi RELEASED
- **THEN** semua nilai baris disalin dari versi RELEASED
- **AND** scope ADD_ONS, MARGIN, dan SALES berstatus RELEASED dengan `carried_over` = true dan catatan "Disalin dari v<n>"
- **AND** scope COGS ikut RELEASED hanya bila kurs aktif sama dengan kurs terkunci versi induk; bila berbeda COGS dibuka ulang (DRAFT) karena FOB Price dalam IDR berubah

#### Scenario: Draft sudah terbuka
- **WHEN** varian sudah punya versi DRAFT dan pengguna membuat versi baru
- **THEN** sistem mengembalikan versi DRAFT yang ada dan tidak membuat versi kedua

#### Scenario: Kurs belum tersedia
- **WHEN** tidak ada kurs CNY/IDR di Master Data
- **THEN** pembuatan versi gagal dengan "Kurs CNY/IDR belum tersedia di Master Data."

#### Scenario: Tanpa wewenang
- **WHEN** role tanpa salah satu fungsi di atas membuat versi
- **THEN** gagal dengan "Hanya pemilik scope yang dapat membuat versi cost structure."

### Requirement: Mengisi nilai scope
Sistem SHALL menyimpan nilai item biaya satu scope hanya saat versi DRAFT dan scope berstatus DRAFT atau RETURNED, oleh role yang berwenang MAKE pada scope dan skenario tersebut.

#### Scenario: Simpan nilai
- **WHEN** Maker menyimpan nilai item scope COGS yang semuanya ≥ 0
- **THEN** baris tersimpan (upsert per versi dan item), status scope tetap/kembali DRAFT
- **AND** audit log UPDATE tercatat

#### Scenario: Nilai negatif atau bukan angka
- **WHEN** nilai suatu item negatif atau NaN
- **THEN** gagal dengan "Nilai <nama item> tidak valid." dan tidak ada baris berubah

#### Scenario: Item di luar scope
- **WHEN** payload memuat item dari scope lain atau item turunan (derived)
- **THEN** gagal dengan "Nilai di luar scope ini tidak dapat diubah dari sini."

#### Scenario: Scope sedang diperiksa/dirilis
- **WHEN** scope berstatus MADE, CHECKED, atau RELEASED
- **THEN** simpan nilai ditolak; Maker harus RETURN/REOPEN dulu

#### Scenario: Versi sudah dirilis
- **WHEN** versi berstatus RELEASED atau RETIRED
- **THEN** simpan nilai ditolak dengan "Versi ini sudah dirilis — buat versi baru untuk mengubah nilai."

#### Scenario: "Exclusion — At cost"
- **WHEN** item bertanda `may_follow_later` ditandai excluded
- **THEN** item bernilai 0 dalam perhitungan
- **AND** tanda excluded diabaikan untuk item yang tidak `may_follow_later`

### Requirement: Alur Maker → Checker → Releaser
Sistem SHALL menjalankan transisi scope MAKE (DRAFT/RETURNED→MADE), CHECK (MADE→CHECKED), RELEASE (CHECKED→RELEASED), RETURN (MADE/CHECKED→RETURNED), REOPEN (RELEASED→DRAFT), hanya dari status asal yang sah dan hanya oleh role yang memiliki wewenang `can_make`/`can_check`/`can_release` pada scope dan skenario (REGULAR/DEVIATION) versi itu di `scope_authority`. REOPEN memakai wewenang make; RETURN memakai wewenang check.

#### Scenario: Alur normal
- **WHEN** Maker, Checker, lalu Releaser (orang berbeda) menjalankan MAKE, CHECK, RELEASE pada scope
- **THEN** status berturut-turut MADE, CHECKED, RELEASED dengan `maker_id`/`checker_id`/`releaser_id` dan waktu tercatat
- **AND** tiap transisi menulis audit log (action MAKE/CHECK/RELEASE) berisi scope dan skenario

#### Scenario: Status asal salah
- **WHEN** aksi dijalankan dari status yang tidak sah (mis. RELEASE pada scope MADE)
- **THEN** gagal dengan "Aksi <X> tidak berlaku untuk status <Y>."

#### Scenario: Tanpa wewenang pada scope
- **WHEN** role tidak punya wewenang aksi itu di scope dan skenario berlaku
- **THEN** gagal dengan "Role Anda tidak memiliki wewenang <AKSI> pada scope <scope> (skenario <skenario>)."

#### Scenario: Akun tanpa role
- **WHEN** pengguna tidak punya `app_role_code`
- **THEN** semua aksi scope ditolak dengan "Akun Anda belum memiliki role."

#### Scenario: Return wajib catatan
- **WHEN** Checker/Releaser RETURN dengan catatan kosong
- **THEN** gagal dengan "Catatan wajib diisi saat mengembalikan ke Maker."
- **AND** pada RETURN yang sah, checker_id dan checked_at dikosongkan dan status RETURNED

#### Scenario: Reopen
- **WHEN** scope RELEASED (pada versi DRAFT) di-REOPEN
- **THEN** status DRAFT, `carried_over` false, maker/checker/releaser dan waktunya dikosongkan

### Requirement: Pemisahan tugas
Sistem SHALL menolak Checker yang sama dengan Maker bila aturan `maker_ne_checker` aktif untuk scope, dan Releaser yang sama dengan Checker bila `checker_ne_releaser` aktif. Bila `allow_single_actor` aktif dan tidak ada pemegang wewenang lain, sistem SHALL mengizinkan dan menandai `single_actor_flag`.

#### Scenario: Maker mencoba Check
- **WHEN** pengguna yang sama menjadi Maker lalu Checker dan ada pemegang wewenang check lain
- **THEN** ditolak "Checker harus orang yang berbeda dari Maker (pemisahan tugas)."

#### Scenario: Releaser sama dengan Checker
- **WHEN** `checker_ne_releaser` aktif dan Checker mencoba RELEASE
- **THEN** ditolak "Releaser harus orang yang berbeda dari Checker (pemisahan tugas)."

#### Scenario: Pemegang tunggal
- **WHEN** aturan dilanggar tetapi pengguna adalah satu-satunya pemegang wewenang itu dan `allow_single_actor` aktif
- **THEN** aksi diizinkan dan `single_actor_flag` = true
- **AND** audit log memuat "single-actor release"

#### Scenario: Aturan tidak terdefinisi
- **WHEN** scope tidak punya baris di `scope_segregation_rule`
- **THEN** berlaku default maker≠checker, checker boleh = releaser, single-actor diizinkan

### Requirement: Skenario REGULAR / DEVIATION
Sistem SHALL menentukan skenario versi dari GM standar: DEVIATION bila GM standar (%) < ambang `deviationGmThresholdPct` di Settings, selain itu REGULAR; bila nilai margin ≤ 0 skenario REGULAR.

#### Scenario: Margin belum diisi
- **WHEN** scope Margin belum bernilai (marginAmount ≤ 0)
- **THEN** skenario REGULAR

#### Scenario: GM di bawah ambang
- **WHEN** GM standar 12% dan ambang 15%
- **THEN** skenario DEVIATION dan wewenang scope dibaca dari baris `scenario = DEVIATION`

### Requirement: Rilis versi
Sistem SHALL menjadikan versi RELEASED hanya saat keempat scope-nya RELEASED; saat itu versi RELEASED sebelumnya untuk varian yang sama menjadi RETIRED.

#### Scenario: Scope terakhir dirilis
- **WHEN** scope keempat berstatus RELEASED
- **THEN** versi induk RELEASED lama menjadi RETIRED dan versi ini RELEASED dengan `released_at`
- **AND** audit log RELEASE memuat harga dasar excl. VAT dan GM standar
- **AND** halaman /price-estimate dan Cost Structure diperbarui

#### Scenario: Belum semua scope
- **WHEN** hanya sebagian scope RELEASED
- **THEN** versi tetap DRAFT dan versi lama tetap berlaku

### Requirement: Membatalkan draft
Sistem SHALL menghapus versi DRAFT (beserta baris dan state scope) atas permintaan pemilik scope dengan alasan wajib, tanpa mengubah versi RELEASED yang berlaku.

#### Scenario: Batalkan draft
- **WHEN** pemilik scope membatalkan DRAFT dengan alasan terisi
- **THEN** versi terhapus dan audit log UPDATE (status DRAFT → DIBATALKAN) tercatat dengan alasan
- **AND** varian dapat membuat draft baru

#### Scenario: Alasan kosong atau versi bukan DRAFT
- **WHEN** alasan kosong, atau status versi bukan DRAFT
- **THEN** gagal ("Alasan pembatalan wajib diisi." / "Hanya versi DRAFT yang dapat dibatalkan.")

### Requirement: Ringkasan dan peringatan kurs
Halaman daftar SHALL menampilkan per varian semua versi dengan status, kurs terkunci, harga dasar excl. VAT, dan GM standar (kecuali versi RETIRED), serta peringatan bila kurs aktif bergerak lebih dari ambang rate sensitivity (default 2%) dari kurs terkunci versi RELEASED.

#### Scenario: Kurs bergeser melewati ambang
- **WHEN** kurs terkunci 2.600, kurs aktif 2.700 (3,85%), ambang 2%
- **THEN** banner peringatan tampil menyebut persentase pergerakan dan menyarankan membuat versi baru

#### Scenario: Varian tanpa versi
- **WHEN** varian belum punya versi
- **THEN** tampil "Belum ada cost structure — varian ini belum dapat dikutip."

## Catatan as-built
- Pembuatan versi, tulis nilai, dan transisi scope tidak dibungkus transaksi database; kegagalan di tengah dapat meninggalkan state scope parsial.
- Hasil `update` pada state scope dan pemensiunan versi lama tidak diperiksa errornya.
- `saveScopeValuesAction` hanya mengaudit 20 baris pertama perubahan.
- Daftar halaman menghitung ringkasan harga dengan satu query baris per versi (N+1).
- Belum ada tes otomatis, termasuk untuk `canPerformScopeAction`.
