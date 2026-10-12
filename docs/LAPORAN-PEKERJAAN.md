# Laporan Pekerjaan — VKTR-PriceCore

Periode: 3 Agustus 2026 – 6 Oktober 2026 (disusun dari riwayat git, 43 commit di branch `main`).

VKTR-PriceCore adalah aplikasi web (Next.js + Supabase) untuk penetapan harga dan persetujuan Commercial Quotation: struktur biaya, estimasi harga, workflow approval berjenjang, dan dokumen quotation.

## Ringkasan per tahap

| Tahap | Periode | Hasil utama |
|---|---|---|
| POC | 3–4 Agu | Pricing engine, workflow approval, DSS, dashboard; penyesuaian ke requirement Commercial Quotation VKTR |
| Multi-currency & indeks mineral | 12 Agu | Input multi-mata uang, penyesuaian indeks mineral (HMA), panel rate/indeks |
| v3.0 | 16–22 Sep | Skenario demo USD, notifikasi harga stale, UI Workflow Template, preview dokumen quotation |
| v4.0 | 30 Sep – 1 Okt | Role & workflow yang bisa dikonfigurasi, cost structure M/C/R, Price Estimate, Official Quotation, Cost Estimate yang bisa dicetak, pembatasan menu per role |
| v4.1 | 5 Okt | Workflow Template Catalog (list + detail), optimasi performa action, perbaikan tampilan Quotation detail |
| Product Master Data & Cost Structure | 6 Okt | Master produk/varian, perubahan Cost Structure dari halaman versi |
| Spec as-built & unit test | 9 Okt | Spec SDD 11 capability, Vitest dengan 72 unit test fungsi murni |
| v5.0 (Req 2) | 11 Okt | Dokumen kebutuhan dan kode disesuaikan dengan meeting *VKTR Req 2*: satu workflow, dokumen bertanda tangan, Won/Lost, Projects, Dashboard, responsif |

## Rincian

### 1. POC dan penyesuaian awal (3–4 Agustus)
- Inisialisasi proyek dari Create Next App.
- Membangun POC: pricing engine, workflow approval, DSS (decision support), dan dashboard.
- Perbaikan: kolom `pricing_proposal.current_version_id` yang hilang, pencarian versi proposal saat `current_version_id` null, entri biaya di tengah workflow, perhitungan di skenario demo.
- Penomoran proposal setelah penghapusan diperbaiki; ditambah reset demo yang bisa diulang dan seed demo yang bisa dijalankan ulang.
- Penyelarasan sistem dengan requirement Commercial Quotation approval dari VKTR.
- Release gate tidak lagi memblokir approver yang memicunya; permintaan diskon dibolehkan pada quotation yang sudah released.
- Tombol diberi umpan balik saat ditekan/loading, dan error saat membuat proposal ditampilkan.

### 2. Multi-currency dan indeks mineral (12 Agustus)
- Spesifikasi dan implementasi input multi-mata uang serta penyesuaian indeks mineral.
- Panel rate dan indeks mineral memakai lebar halaman penuh.
- Item biaya baru otomatis dilampirkan ke template CBS yang memakainya.

### 3. Versi 3.0 (16–22 September)
- Dokumen skenario demo USD; label Owner Dept untuk direct cost diperbaiki.
- Notifikasi ke Sales saat harga quotation stale setelah perubahan rate/HMA.
- Dokumen dan aplikasi direvisi ke v3.0 berdasarkan masukan review demo.
- UI untuk membuat Workflow Template tanpa SQL, dengan penjagaan terhadap urutan step yang tidak masuk akal.
- Preview dokumen quotation di layar.
- Dokumentasi tiga fase siklus hidup beserta batas state machine-nya; redaksi validasi COGS (sequential vs parallel) diperjelas.
- Perbaikan validasi UUID yang salah menolak id seed department/product.
- Eskalasi final dua tingkat Chief Sales → BOD diizinkan di Workflow Template.

### 4. Versi 4.0 (30 September – 1 Oktober)
- PRD, Technical Logic, dan dokumen demo direvisi ke v4.0 berdasarkan lampiran VKTR.
- Build v4.0: role dan workflow yang bisa dikonfigurasi, cost structure M/C/R, Price Estimate, Official Quotation, dan Cost Estimate yang bisa dicetak (93 file berubah).
- Menu dan data quotation dibatasi per role: disembunyikan di sidebar dan 404 jika diakses lewat URL.

### 5. Versi 4.1 (5 Oktober)
- Workflow Template Catalog: banyak template dipetakan lewat qualifier statis, dengan halaman list (tombol Add) dan halaman detail per workflow.
- Dokumen demo: lini bisnis dan deal qualifier per skenario, satu deal per workflow (B8), langkah demo membuka workflow dari list dan mengedit lewat halaman detail.
- Performa: fungsi dijalankan dekat database dan render ganda dihilangkan.
- Quotation detail: tabel harga menggulir di dalam card dan kolom varian dilebarkan.

### 6. Product Master Data dan Cost Structure (6 Oktober)
- Product Owner dapat mengedit varian yang sudah ada.
- Daftar produk, detail produk, serta penambahan produk/varian.
- Cost Structure dapat diubah dari halaman detail versi, dan draft dapat dibatalkan.

### 7. Spec as-built dan unit test (9 Oktober)
- Spec SDD as-built untuk 11 capability di `sdd/specs/`, plus konfigurasi proyek `sdd/config.md`.
- Vitest dengan 72 unit test untuk logika murni (pricing, tier, authority, template, akses); change diarsipkan di `sdd/changes/archive/`.

### 8. v5.0 — meeting *VKTR Req 2* (11 Oktober)
Sumber: transkrip meeting (`docs/kebutuhan_baru_v2.md`).
- **Dokumen:** PRD dan Technical Logic v5.0, README, skenario demo, spec `sdd/` (spec baru `project-payment-tracking`).
- **Keputusan:** satu workflow aktif; Head of Sales approve di aplikasi lalu Salesperson merilis (lampiran dokumen bertanda tangan opsional); approval Head of Sales dapat dimatikan per quotation lewat dropdown (langsung rilis, tier margin tetap berlaku); diskon tetap lewat Revisi + tier dan Salesperson boleh mengisi diskon pada draft Revisi; warna kuning (14 hari) / merah (30 hari) dari tanggal rilis; Won/Lost manual, Expired tetap otomatis dengan override Admin; termin ditetapkan Salesperson, status payment oleh Finance, progres oleh Tim Project.
- **Kode:** migrasi `0018`–`0019`; status `PENDING_SIGNED_DOCUMENT`; lampiran dan Won (bukti PO) lewat storage privat; menu Projects dan Dashboard; role Finance / Tim Project / Chief-Direksi; override Expired; diskon revisi oleh Salesperson; Sidebar drawer dan tabel/kartu adaptif di seluruh halaman aplikasi; fungsi murni `lifecycle`, `dashboard`, `projects`, `files` dengan unit test (172 tes).
- **Terverifikasi:** `tsc`, `eslint`, `next build`, `vitest` lulus.
- **Belum diverifikasi:** migrasi di database sungguhan, alur unggah berkas ke Supabase Storage, dan tampilan di peramban/handphone (tidak ada tes UI). Butir terbuka kecil ada di PRD §10 no. 18–20.

## Dokumentasi yang dihasilkan
Folder [docs/](.): PRD, Technical Logic (keduanya v5.0), DEMO-FLOW (Overview, Price Estimate, Official Quotation), DEMO-SCENARIO-CNY (kurs), `kebutuhan_baru_v2.md` (sumber v5.0), serta dokumen referensi dari VKTR. Spec as-built ada di [sdd/specs/](../sdd/specs/).

## Catatan
- Dokumen ini disusun dari pesan commit; detail fungsional tiap fitur ada di PRD dan Technical Logic.
- Spesifikasi SDD ada di `sdd/` (as-built per 9 Oktober). Perubahan v5.0 dicatat sebagai "Perubahan terencana" di spec terkait dan belum menjadi perilaku as-built.
