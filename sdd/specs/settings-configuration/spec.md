# Spec: settings-configuration
<!-- As-built per 2026-10-09. Sumber: src/app/(app)/settings/actions.ts (saveTiersAction, saveBandsAction, saveGeneralSettingsAction), src/lib/settings.ts. Role/scope authority/akses menu: sdd/specs/access-control. Template workflow: sdd/specs/workflow-template-catalog. -->

## Purpose
System Admin mengatur parameter bisnis sebagai data: tangga tier margin, quantity band, dan setelan umum/dokumen (PPN, ambang deviasi, masa berlaku, penjaga duplikat, teks dokumen, daftar qualifier, blacklist). Perubahan berlaku tanpa deploy; setiap penyimpanan diaudit sebagai SETTINGS_CHANGE.

## Requirements

### Requirement: Hanya System Admin
Sistem SHALL menolak semua penyimpanan Settings dari non-admin dengan "Hanya System Admin yang dapat mengubah Settings." dan tidak mengubah data.

#### Scenario: Non-admin menyimpan
- **WHEN** role tanpa fungsi SYSTEM_ADMIN memanggil action Settings
- **THEN** ditolak dan tidak ada audit SETTINGS_CHANGE

### Requirement: Tangga tier margin
Sistem SHALL menyimpan per tier batas bawah dan atas GM (%; null = tak terbatas), slot pemutus (minimal satu), dan slot tembusan (CC). Slot berupa fungsi atau "role:<KODE>".

#### Scenario: Simpan tier
- **WHEN** admin menyimpan tier 2 = [10, 15) dengan slot COGS_OWNER
- **THEN** baris tier diperbarui dan audit mencatat rentang semua tier

#### Scenario: Tier tanpa pemutus
- **WHEN** decision_slots kosong
- **THEN** ditolak "Setiap tier butuh minimal satu pemutus"

#### Scenario: Seed bawaan
- **WHEN** sistem baru di-seed
- **THEN** tier 1 GM ≥ 15% (pemutus SALES_RELEASER, sehingga rilis langsung oleh Head of Sales), tier 2 GM 10–<15% (pemutus COGS_OWNER dan PROFITABILITY_OWNER, keduanya), tier 3 GM < 10% (pemutus role CCO dan role CFO; tembusan COGS_OWNER dan PROFITABILITY_OWNER)
- **AND** quantity band bawaan: 1 unit AUTO diskon 0%; 2–5 AUTO_WITH_MANUAL 2%; 6–9 AUTO_WITH_MANUAL 3%; ≥10 MANUAL 0%

### Requirement: Quantity band
Sistem SHALL menyimpan band berurutan (nomor, min_qty, max_qty, mode proses AUTO/AUTO_WITH_MANUAL/MANUAL, diskon default 0–100%) dengan band pertama mulai dari 1 unit, band sambung-menyambung tanpa celah atau tumpang tindih, dan band terakhir tanpa batas atas; seluruh band diganti sekaligus.

#### Scenario: Band valid
- **WHEN** band 1 = 1–1 AUTO, band 2 = 2–9, band 3 = 10–∞
- **THEN** tersimpan dan audit mencatat jumlah band

#### Scenario: Band pertama bukan 1
- **WHEN** band terendah mulai dari 2
- **THEN** ditolak "Band pertama harus mulai dari 1 unit."

#### Scenario: Celah
- **WHEN** band 1 berakhir di 5 dan band 2 mulai di 8
- **THEN** ditolak "Band 1 dan 2 harus bersambung tanpa celah/tumpang tindih."

#### Scenario: Band terakhir terbatas
- **WHEN** band terakhir punya max_qty
- **THEN** ditolak "Band terakhir harus tanpa batas atas."

### Requirement: Setelan umum dan dokumen
Sistem SHALL menyimpan pasangan kunci-nilai: tarif PPN (default 11, valid 0–50), ambang GM deviasi (default 10%), masa berlaku quotation (default 30 hari), batas penjaga duplikat per hari (default 1), judul dokumen ("COST ESTIMATE"), pola nomor dokumen (`{seq}/L/VKTR/{scheme}-{unit}/{MM}-{YYYY}`), kode unit ("EFS"), nama dan alamat penerbit, disclaimer, catatan khusus default, daftar qualifier (segmen B2G/B2B/B2C; industri; hubungan Reguler/Relasi khusus), dan daftar blacklist customer. Nilai yang belum ada SHALL memakai default sehingga baris yang hilang tidak merusak perhitungan.

#### Scenario: PPN di luar rentang
- **WHEN** tarif PPN < 0 atau > 50
- **THEN** ditolak "Tarif PPN tidak valid." dan tidak ada yang disimpan

#### Scenario: Kunci tidak dikenal
- **WHEN** payload memuat kunci di luar daftar
- **THEN** kunci itu diabaikan

#### Scenario: Baris setting hilang
- **WHEN** tabel `app_setting` tidak memuat suatu kunci
- **THEN** nilai default dipakai

#### Scenario: Perubahan PPN
- **WHEN** PPN diubah menjadi 12
- **THEN** perhitungan berikutnya (Price Estimate, generate/price quotation) memakai 12; quotation yang sudah dihitung baru berubah saat dihitung ulang

## Catatan as-built
- Menyimpan band menghapus semua band lalu menyisipkan ulang tanpa transaksi; kegagalan insert meninggalkan band kosong.
- Validasi setelan umum hanya untuk PPN; ambang deviasi, masa berlaku, dan batas harian tidak divalidasi rentangnya (nilai negatif atau teks diterima).
- Update tier tidak memeriksa kontinuitas rentang antar tier (celah/tumpang tindih diatasi `resolveTier` dengan jatuh ke tier terakhir).
- Pola nomor dokumen tidak divalidasi; pola tanpa `{seq}` menghasilkan nomor tidak unik.
- Belum ada tes otomatis.
