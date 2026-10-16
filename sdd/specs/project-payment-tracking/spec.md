# Spec: project-payment-tracking
<!-- v5.0 — DIKODEKAN 2026-10-11 (src/app/(app)/projects, src/lib/projects.ts); migrasi 0019 belum diverifikasi di database. Sumber: docs/kebutuhan_baru_v2.md, PRD v5.0 Module 9, Technical Logic v5.0 §2.1 (tabel project*), §4.14. Belum diverifikasi manual terhadap database sungguhan. -->

## Purpose
Melanjutkan quotation yang Won secara sederhana: bukti PO, status pembayaran per termin, dan progres project. Semua input manual (tanpa integrasi bank, SAP, atau aplikasi project).

## Requirements

### Requirement: Project dari quotation Won
Sistem SHALL membuat satu Project untuk setiap quotation yang dinyatakan Won beserta bukti PO. Nilai project SHALL dibekukan dari `transaction_value` saat Won.

#### Scenario: Won dengan PO
- **WHEN** salesperson menyatakan Won dan mengunggah PO (PDF/PNG/JPG, dalam batas ukuran)
- **THEN** project dibuat tertaut ke quotation dan Project Identifier, audit tercatat

#### Scenario: Won diulang
- **WHEN** Won dipicu dua kali untuk quotation yang sama
- **THEN** tidak ada project ganda (satu quotation satu project)

### Requirement: Daftar dan detail project
Menu Projects SHALL hanya berisi quotation berstatus Won; menampilkan customer, nomor quotation/PO, nilai, status payment ringkas, dan status/progres. Salesperson melihat project miliknya; Sales Operations, Head of Sales, Finance, Tim Project, Executive, dan Admin melihat semua.

### Requirement: Penetapan termin (Salesperson)
Setiap quotation SHALL memiliki TOP standar 50–50 (DP 50%, Pelunasan 50%) sejak dibuat, pada alur dengan maupun tanpa approval Head of Sales, dan TOP SHALL tercetak di dokumen quotation. Salesperson pemilik SHALL dapat mengubahnya (total 100%) dengan tombol "Update TOP" sampai hasil Won/Lost dicatat; saat Won, termin SHALL disalin ke project.

#### Scenario: Quotation baru
- **WHEN** quotation dibuat tanpa mengisi TOP
- **THEN** TOP 50–50 sudah terpasang dan tercetak

#### Scenario: Update TOP
- **WHEN** salesperson mengubah TOP menjadi 40–30–30 lewat modal
- **THEN** tersimpan dan tercetak; total selain 100% ditolak

#### Scenario: Won
- **WHEN** quotation dinyatakan Won
- **THEN** project dibuat dengan termin yang sama dan masih dapat diubah di project

Salesperson pemilik project SHALL menetapkan daftar termin pembayaran (nomor, label, persentase atau jumlah, jatuh tempo). Perubahan termin setelah ada termin yang diterima SHALL ditolak (detail aturan disepakati saat implementasi).

#### Scenario: Salesperson menetapkan termin
- **WHEN** salesperson menambah termin 1 "DP" 30% dan termin 2 70%
- **THEN** dua termin berstatus Belum tersimpan, audit tercatat

#### Scenario: Role lain menetapkan termin
- **WHEN** Finance atau Tim Project mencoba menambah/mengubah termin
- **THEN** ditolak

### Requirement: Status payment termin (Finance)
Hanya role berfungsi FINANCE yang SHALL menandai termin diterima, mengisi jumlah dan tanggal, serta mengunggah bukti transfer.

#### Scenario: Termin diterima
- **WHEN** Finance menandai termin 1 diterima dengan bukti transfer
- **THEN** status RECEIVED, jumlah/tanggal/bukti tersimpan, audit tercatat
- **AND** Salesperson dan manajemen melihat statusnya (baca)

#### Scenario: Bukan Finance
- **WHEN** role lain mencoba menandai termin
- **THEN** ditolak

### Requirement: Tracking progres
Sistem SHALL menyimpan entri progres append-only (tanggal, status, progres 0–100%, catatan, dan lampiran foto/dokumen wajib berformat PDF, PNG, atau JPG hingga 10 MB) dan menampilkan entri terbaru di daftar. Hanya role berfungsi PROJECT_TEAM (Tim Project) yang SHALL menambah entri.

#### Scenario: Update progres
- **WHEN** Tim Project menyimpan entri "Proses produksi", 20%
- **THEN** status dan progres terbaru project ikut berubah, riwayat tetap

#### Scenario: Entri tanpa lampiran
- **WHEN** Tim Project menyimpan entri progres tanpa foto/dokumen, atau dengan format selain PDF/PNG/JPG
- **THEN** ditolak dan tidak ada entri tersimpan

#### Scenario: Role lain mengisi progres
- **WHEN** Salesperson atau Finance mencoba menambah entri progres
- **THEN** ditolak (keduanya hanya membaca)

## Catatan
- Salesperson menetapkan termin, Finance mengisi status payment, Tim Project mengisi progres (dikonfirmasi).
- Berkas disimpan di storage privat dengan URL bertanda tangan.
- Integrasi SAP/aplikasi project di luar lingkup fase ini.
