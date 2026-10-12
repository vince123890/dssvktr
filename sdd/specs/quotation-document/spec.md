# Spec: quotation-document
<!-- As-built per 2026-10-09. Sumber: src/app/print/proposals/[id]/page.tsx, .../cost-structure/page.tsx, src/app/print/PrintToolbar.tsx, settings umum (documentTitle dll). -->

## Purpose
Dokumen Cost Estimate untuk pelanggan (FR-1.5.3/1.5.4), mengikuti contoh "Cost Estimate — PT Siborong Nusa Gemilang", dan Cost Structure Sheet internal yang terpisah (sheet Basic Workflow 6b, "highly confidential"). Preview di layar dan cetak berasal dari halaman yang sama; PDF dibuat lewat dialog cetak browser.

## Requirements

### Requirement: Cost Estimate untuk pelanggan
Sistem SHALL menampilkan di `/print/proposals/[id]`: judul dokumen, penerbit dan alamat dari Settings, logo; blok "To" dari KYC (perusahaan, alamat resmi); nomor dokumen, tanggal rilis, tanggal kedaluwarsa; disclaimer bila diisi; tabel Sales/Account Person · Product · Prepared By; tabel baris (Quantity, Description berisi skema + deskripsi dokumen + ", incl. VAT", harga per unit, total); Inclusions; Exclusions berlabel "At cost"; Total; kontak account person pertama; Special Notes bila ada; blok tanda tangan penerimaan; lalu satu halaman Specification per varian.

#### Scenario: Skema pembelian
- **WHEN** baris berskema PURCHASE
- **THEN** harga per unit = net incl. VAT baris (dibulatkan tampilan `Rp x`) dan total = harga per unit × kuantitas (tak dibulatkan sebelum dikali)
- **AND** teks skema "Purchase"

#### Scenario: Skema rental
- **WHEN** ada baris RENTAL
- **THEN** kolom berjudul "Rental/Month Unit" dan "Rental/Month Total", harga per unit = `rental_monthly_incl_vat`, teks "Rental Scheme, <tahun>-year Contract" (tenor bulan ÷ 12 dibulatkan)

#### Scenario: Nomor draft
- **WHEN** quotation belum punya nomor dokumen
- **THEN** nomor tampil `DRAFT-<nomor proposal>` dan tanggal rilis/kedaluwarsa "—"

#### Scenario: Halaman spesifikasi
- **WHEN** varian punya `image_urls`
- **THEN** halaman Specification menampilkan gambar-gambar itu
- **WHEN** tidak punya gambar
- **THEN** menampilkan tabel `spec_sheet` per section

### Requirement: Watermark menurut status
Dokumen SHALL berwatermark "SUPERSEDED" bila status SUPERSEDED, "EXPIRED" bila EXPIRED, tanpa watermark bila QUOTATION_RELEASED, dan "DRAFT — NOT FOR CUSTOMER" untuk status lain. Toolbar SHALL menampilkan "Dokumen resmi — siap dikirim ke pelanggan" hanya tanpa watermark.

#### Scenario: Draft
- **WHEN** quotation masih dalam proses
- **THEN** watermark "DRAFT — NOT FOR CUSTOMER" tampil

### Requirement: Akses dokumen pelanggan
Sistem SHALL memberi 404 pada Cost Estimate bila: pengguna tidak punya akses menu quotation; quotation tidak terlihat oleh pengguna; pengguna eksternal; atau status belum rilis (bukan QUOTATION_RELEASED/EXPIRED/SUPERSEDED) dan pengguna tidak boleh melihat cost structure. Dokumen SHALL tidak pernah memuat struktur biaya.

#### Scenario: Salesperson sebelum rilis
- **WHEN** Sales Executive membuka dokumen quotation miliknya yang belum dirilis
- **THEN** 404

#### Scenario: Salesperson setelah rilis
- **WHEN** quotation sudah QUOTATION_RELEASED
- **THEN** dokumen tampil tanpa watermark

#### Scenario: Pricing role sebelum rilis
- **WHEN** Sales Operations membuka draft
- **THEN** dokumen tampil dengan watermark draft

### Requirement: Cost Structure Sheet internal
Sistem SHALL menampilkan di `/print/proposals/[id]/cost-structure` untuk role yang boleh melihat cost structure (dan memiliki akses menu cost_structure): nomor proposal, nomor dokumen, perusahaan, cap "HIGHLY CONFIDENTIAL", ringkasan GM · tier · skenario · band · total excl. VAT, dan per baris varian rincian item per scope (COGS, Add-Ons, Margin, Sales) dengan kurs terkunci.

#### Scenario: Role tanpa wewenang
- **WHEN** Salesperson membuka sheet
- **THEN** 404

#### Scenario: Pemisahan dokumen
- **WHEN** Cost Estimate dicetak
- **THEN** rincian struktur biaya tidak ada di dalamnya; sheet internal adalah dokumen terpisah dengan catatan "jangan dikirim ke pelanggan"

### Requirement: Pencetakan tercatat
Sistem SHALL menulis audit log PRINT setiap kali tombol "Print / Simpan PDF" ditekan ("Cetak / simpan PDF dokumen Cost Estimate" atau "Cetak Cost Structure Sheet (internal)") sebelum dialog cetak browser dibuka.

#### Scenario: Cetak
- **WHEN** pengguna menekan Print / Simpan PDF
- **THEN** satu audit PRINT tercatat dengan aktor dan quotation, lalu `window.print()` dipanggil

## Catatan as-built
- PDF tidak dibuat server-side (tanpa headless browser di Vercel); hasil bergantung pada dialog cetak browser.
- Pencatatan PRINT berasal dari klien; pemanggilan `window.print()` lewat shortcut browser (Ctrl+P) tidak tercatat.
- Pembulatan tampilan `Rp` per baris dapat berbeda 1 rupiah dari total tak dibulatkan; total grand dijumlahkan dari total baris.
- Logo diambil dari `/vktr-logo.png` statis; alamat penerbit, judul, dan disclaimer dari Settings → Umum & Dokumen.
- Belum ada tes visual atau tes angka untuk dokumen.

## Perubahan v5.0 (dikodekan 2026-10-11; migrasi 0018–0019 belum diverifikasi di database)
- **Dokumen untuk ditandatangani (opsional):** pada status PENDING_SIGNED_DOCUMENT ("Disetujui — menunggu rilis") dokumen sudah bernomor dan bertanggal (ditetapkan saat approval final) dan dicetak tanpa watermark; toolbar menjelaskan bahwa ia resmi setelah quotation dirilis, dengan atau tanpa lampiran bertanda tangan. Salesperson pemilik dapat membukanya pada status ini. Quotation dengan pilihan "tanpa approval" langsung berstatus Released. Watermark EXPIRED tetap berdasarkan status EXPIRED (otomatis atau override Admin).
