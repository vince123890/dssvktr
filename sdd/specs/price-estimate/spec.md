# Spec: price-estimate
<!-- As-built per 2026-10-09. Sumber: src/app/(app)/price-estimate/*, src/lib/priceEstimateAccess.ts. -->

## Purpose
Workflow A (Sales To Obtain Price Estimate per Unit): pengguna memilih make → model → type → variant dan langsung melihat harga dasar per unit excl. dan incl. VAT tanpa approval. Authorized Agency (eksternal) hanya boleh melihat angka ini, tanpa unsur struktur biaya.

## Requirements

### Requirement: Akses
Sistem SHALL mengizinkan halaman dan action Price Estimate hanya bagi role yang diizinkan matriks akses menu "price_estimate" (default EXTERNAL_AGENCY, SALESPERSON, SALES_OPERATIONS, SALES_RELEASER, SYSTEM_ADMIN). Halaman dan action memakai kebijakan yang sama.

#### Scenario: Role di luar matriks
- **WHEN** role tanpa akses membuka `/price-estimate`
- **THEN** sistem menjawab 404

#### Scenario: Action dipanggil langsung
- **WHEN** role tanpa akses memanggil `getPriceEstimateAction`
- **THEN** gagal "Role Anda tidak memiliki akses Price Estimate." dan tidak ada log dibuat

### Requirement: Pilihan varian
Sistem SHALL menawarkan hanya varian berstatus ACTIVE yang punya cost structure RELEASED, dikelompokkan make → model → type → variant (make kosong dianggap "VKTR", model kosong dianggap nama varian), dengan deskripsi, loco, build type, hingga 4 section × 2 sorotan spesifikasi, inklusi, eksklusi, dan gambar pertama.

#### Scenario: Varian belum released
- **WHEN** varian ACTIVE tanpa cost structure RELEASED
- **THEN** varian tidak muncul

#### Scenario: Varian dihentikan
- **WHEN** varian berstatus DISCONTINUED
- **THEN** varian tidak muncul

#### Scenario: Tidak ada varian
- **WHEN** tidak ada varian yang memenuhi syarat
- **THEN** tampil "Belum ada varian dengan cost structure RELEASED."

### Requirement: Estimasi harga per unit
Sistem SHALL mengembalikan harga dasar excl. VAT (list price dari cost structure RELEASED terbaru, 1 unit, tanpa diskon), harga incl. VAT = excl. × (1 + PPN% ÷ 100), tarif PPN, nomor versi, dan waktu rilis versi.

#### Scenario: Estimasi
- **WHEN** pengguna memilih varian dengan list price 100.000.000 dan PPN 11%
- **THEN** hasil excl. VAT 100.000.000 dan incl. VAT 111.000.000
- **AND** UI menampilkan "excl. VAT" dan "incl. VAT 11%"

#### Scenario: Belum released saat dipanggil langsung
- **WHEN** action dipanggil untuk varian tanpa versi RELEASED
- **THEN** gagal "Varian ini belum memiliki cost structure RELEASED."

### Requirement: Tidak membocorkan struktur biaya
Respons action SHALL berisi hanya harga excl./incl. VAT, tarif PPN, nomor versi, dan waktu rilis (allow-list). Base cost, margin, sales cost, dan GM SHALL tidak pernah dikirim.

#### Scenario: Agency memanggil
- **WHEN** Authorized Agency meminta estimasi
- **THEN** respons tidak memuat field selain yang di atas

### Requirement: Pencatatan permintaan
Setiap estimasi berhasil SHALL ditulis ke `price_estimate_log` (pengguna, varian, versi cost structure, harga excl./incl.) dan audit log PRICE_ESTIMATE.

#### Scenario: Log
- **WHEN** estimasi berhasil
- **THEN** satu baris log dan satu audit PRICE_ESTIMATE ("Estimasi harga per unit (cost structure v<n>)") tercatat

#### Scenario: Gagal
- **WHEN** estimasi gagal
- **THEN** tidak ada log yang ditulis

### Requirement: Teks halaman menurut jenis pengguna
Sistem SHALL menampilkan arahan "untuk penawaran resmi, gunakan menu Official Quotation" hanya bagi pengguna internal, bukan agency eksternal.

#### Scenario: Agency
- **WHEN** pengguna eksternal membuka halaman
- **THEN** teks pengantar berakhir tanpa arahan ke Official Quotation

## Catatan as-built
- Eksklusi di UI selalu menambahkan "Delivery to site" sebagai at cost, hard-coded di komponen klien.
- Kegagalan insert `price_estimate_log` tidak diperiksa errornya.
- Estimasi memakai kurs terkunci versi, bukan kurs hari ini; tidak ada peringatan kurs di halaman ini.
- Belum ada tes otomatis.
