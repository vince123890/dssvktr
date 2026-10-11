# Spec: workflow-template-catalog
<!-- As-built per 2026-10-09. Sumber: src/lib/workflow/templateCatalog.ts, src/app/(app)/settings/actions.ts, src/app/(app)/settings/workflow/*, WorkflowCatalog.tsx. -->

## Purpose
VKTR memperkirakan ±30 variasi workflow setelah go-live. Qualifier deal bersifat statis (segmen, industri, hubungan, lini bisnis, kuantitas, estimasi nilai, blacklist) sedangkan katalog template bertambah lewat Settings tanpa mengubah kode. Saat submit, deal mendapat template aktif yang paling spesifik. Tier margin selalu disisipkan engine setelah langkah terakhir dan tidak dapat dihapus template.

## Requirements

### Requirement: Pemilihan template untuk sebuah deal
Sistem SHALL mengevaluasi semua template aktif berjenis OFFICIAL_QUOTATION. Qualifier yang kosong/null dianggap tidak aktif (tidak membatasi dan tidak menambah kespesifikan); qualifier aktif SHALL cocok bila: nilai deal ada di daftar (segmen, industri, hubungan, lini bisnis), kuantitas dalam [q_min_qty, q_max_qty], estimasi nilai dalam [min_value, max_value], dan flag blacklist sama dengan q_blacklist. Template cocok hanya bila semua qualifier aktifnya cocok. Kandidat non-fallback SHALL diurutkan prioritas tertinggi, lalu jumlah qualifier cocok terbanyak, lalu versi terbaru.

#### Scenario: Satu template spesifik cocok
- **WHEN** deal B2G pertambangan 50 unit dan satu template mensyaratkan segmen B2G + industri Pertambangan
- **THEN** template itu terpilih dengan alasan "Cocok: segmen B2G, industri Pertambangan (prioritas <n>)"

#### Scenario: Prioritas mengalahkan kespesifikan
- **WHEN** dua template cocok, A prioritas 100 dengan 1 qualifier dan B prioritas 50 dengan 3 qualifier
- **THEN** A terpilih

#### Scenario: Prioritas sama
- **WHEN** prioritas sama
- **THEN** template dengan qualifier cocok lebih banyak terpilih; bila masih sama, versi lebih baru

#### Scenario: Tidak ada yang cocok
- **WHEN** tidak ada template non-fallback yang cocok
- **THEN** template fallback aktif terpilih dengan alasan "Tidak ada template spesifik yang cocok — memakai template dasar"

#### Scenario: Tanpa fallback
- **WHEN** tidak ada template cocok dan tidak ada fallback aktif
- **THEN** hasil null dengan alasan "Tidak ada template aktif (CONFIG_ERROR)"

#### Scenario: Nilai qualifier deal tidak diketahui
- **WHEN** template mensyaratkan segmen tertentu tetapi deal tidak punya segmen (null)
- **THEN** template tidak cocok

#### Scenario: Blacklist
- **WHEN** nama perusahaan deal sama dengan entri blacklist (tanpa beda huruf besar/kecil dan spasi ganda)
- **THEN** deal berflag blacklist sehingga hanya template `q_blacklist = true` (atau tanpa qualifier itu) yang cocok

### Requirement: Daftar dan detail template
Sistem SHALL menampilkan daftar template di `/settings` (tab Workflow) dengan tombol tambah, dan halaman detail `/settings/workflow/[kode]` berisi qualifier, alur langkah, tier, riwayat versi, dan pemakaian. Hanya SYSTEM_ADMIN SHALL mengakses (menu Settings terkunci).

#### Scenario: Non-admin
- **WHEN** non-admin membuka `/settings/workflow/...`
- **THEN** 404

### Requirement: Menyimpan template = versi baru
Sistem SHALL menyimpan setiap perubahan template sebagai versi baru (versi lama dinonaktifkan, tidak pernah diedit), sehingga quotation yang sedang berjalan tetap memakai langkah salinan instance-nya. Template baru SHALL mendapat kode `OQ-<SLUG nama, maks 32>` (diberi akhiran waktu bila bentrok).

#### Scenario: Ubah template
- **WHEN** admin menyimpan perubahan pada template v2
- **THEN** v3 dibuat aktif, v2 dinonaktifkan, dan audit SETTINGS_CHANGE mencatat nama, kode, dan versi

#### Scenario: Template baru
- **WHEN** admin menyimpan template tanpa kode
- **THEN** template dibuat v1 aktif dengan lini bisnis dasar B2B_COMMERCIAL_FLEET dan fungsi pengaju SALESPERSON

#### Scenario: Gagal menyimpan langkah
- **WHEN** penyisipan langkah gagal
- **THEN** definisi yang baru dibuat dihapus dan error dikembalikan

### Requirement: Validasi template
Sistem SHALL menolak template yang: nama < 3 karakter; memiliki < 2 langkah; tidak punya tepat satu langkah GENERATE_QUOTATION dan tepat satu REVIEW_AND_ROUTE; langkah terakhirnya bukan REVIEW_AND_ROUTE; tujuan tolak (reject_to_step_order) bukan langkah sebelumnya; kondisi lewati pada langkah selain VALIDATE/APPROVE; qty minimum > maksimum; nilai minimum > maksimum; SLA di luar 1–720 jam; prioritas di luar 0–1000; atau (selain fallback) tanpa satu pun qualifier. Setiap fungsi pelaksana langkah SHALL dipegang minimal satu user pada role aktif.

#### Scenario: Langkah terakhir salah
- **WHEN** langkah terakhir berjenis VALIDATE
- **THEN** gagal "Langkah terakhir harus Review & Rilis — routing tier margin selalu setelahnya."

#### Scenario: Pelaksana tanpa user
- **WHEN** tidak ada user aktif dengan fungsi pelaksana suatu langkah
- **THEN** gagal "Tidak ada user aktif dengan fungsi <fungsi> (langkah "<nama>")."

#### Scenario: Template non-dasar tanpa qualifier
- **WHEN** template bukan fallback tidak punya qualifier
- **THEN** gagal "Template non-dasar wajib memiliki minimal satu qualifier …"

#### Scenario: Tolak ke langkah berikutnya
- **WHEN** langkah i menolak ke langkah ≥ i
- **THEN** gagal "Langkah <i>: tujuan tolak harus langkah sebelumnya."

### Requirement: Aktif/nonaktif
Sistem SHALL mengaktifkan atau menonaktifkan versi terbaru template, dan template fallback SHALL tidak dapat dinonaktifkan.

#### Scenario: Nonaktifkan fallback
- **WHEN** admin menonaktifkan template fallback
- **THEN** gagal "Template dasar (fallback) tidak boleh dinonaktifkan."

### Requirement: Uji pemilihan
Sistem SHALL menyediakan uji yang menerima atribut deal dan menampilkan template terpilih, alasan, serta daftar semua template aktif berurut prioritas dengan status cocok dan qualifier yang gagal.

#### Scenario: Uji oleh non-admin
- **WHEN** non-admin memanggil uji
- **THEN** gagal "Hanya System Admin."

### Requirement: Tangga tier per template
Sistem SHALL memungkinkan template memiliki tangga tier margin sendiri (salinan tangga global saat dibuat) dan menghapusnya (menonaktifkan) agar kembali ke tangga global; tangga SHALL dipilih dengan urutan: milik template, lini bisnis, global.

#### Scenario: Buat tier khusus
- **WHEN** admin membuat tier khusus untuk template tanpa tier khusus
- **THEN** salinan tier global aktif dibuat dengan `workflow_template_code` template

#### Scenario: Sudah punya tier khusus
- **WHEN** template sudah punya tier khusus aktif
- **THEN** gagal "Template ini sudah memiliki tier khusus."

## Catatan as-built
- `saveTemplateAction` tidak transaksional: penonaktifan versi lama setelah penyisipan dapat gagal diam-diam (hasil update tidak diperiksa).
- Kode template ber-akhiran `Date.now()` bila slug bentrok, tidak deterministik.
- Pemetaan kind→status proposal tetap (VALIDATE→PENDING_SALES_LEAD_VALIDATION, GENERATE_QUOTATION→PENDING_SALES_OPERATIONS, REVIEW_AND_ROUTE→PENDING_HEAD_OF_SALES_REVIEW, APPROVE→PENDING_ADDITIONAL_APPROVAL).
- Jenis dokumen workflow lain (Price Estimate) bukan bagian katalog ini.
- Belum ada tes otomatis untuk `resolveTemplate`; skenario di atas adalah kandidat tes unit murni.

## Perubahan v5.0 (dikodekan 2026-10-11; migrasi 0018–0019 belum diverifikasi di database)
<!-- Sumber: PRD v5.0 FR-2.0.2, Technical Logic v5.0 §4.1a. Konfigurasi, bukan perubahan kode. -->

### Requirement: Satu template aktif pada go-live
Sistem SHALL berjalan dengan tepat satu template OFFICIAL_QUOTATION aktif, `OQ-STANDARD` (fallback), berisi langkah GENERATE_QUOTATION lalu REVIEW_AND_ROUTE (Head of Sales). Template lain (`OQ-BLACKLIST`, `OQ-RELASI-KHUSUS`, `OQ-NILAI-BESAR`, `OQ-B2G`, `OQ-INDUSTRI-BERAT`) SHALL dinonaktifkan, tidak dihapus, dan dapat diaktifkan kembali kelak. Mesin pemilihan, validasi template (minimal 2 langkah, tepat satu Generate dan satu Review), dan versioning SHALL tidak berubah.

#### Scenario: Semua deal jatuh ke template dasar
- **WHEN** deal B2G pertambangan 50 unit disubmit saat hanya `OQ-STANDARD` aktif
- **THEN** template terpilih `OQ-STANDARD` dengan alasan "Tidak ada template spesifik yang cocok — memakai template dasar"

#### Scenario: Menghapus langkah validasi
- **WHEN** admin menyimpan `OQ-STANDARD` tanpa langkah Validasi Sales Lead
- **THEN** dibuat versi baru, versi lama dinonaktifkan, dan quotation berjalan tetap memakai salinan langkahnya

#### Scenario: Mengaktifkan kembali template lain
- **WHEN** admin mengaktifkan `OQ-B2G`
- **THEN** template itu kembali dipertimbangkan sesuai prioritas dan qualifier-nya, tanpa perubahan kode
