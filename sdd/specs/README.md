# Indeks spec as-built — VKTR-PriceCore

Dibaca dari kode per 2026-10-09 (branch `main`, commit dd6bb93). Spec ini mendeskripsikan perilaku **saat ini**, bukan hasil wawancara intent; bagian "Catatan as-built" di tiap spec mencatat celah yang ditemukan. Konteks proyek: [../config.md](../config.md). Sumber niat bisnis: `docs/PRD-VKTR-PriceCore.md` dan `docs/TECHNICAL-LOGIC-VKTR-PriceCore.md`.

| Capability | Cakupan | Kekritisan |
|---|---|---|
| [pricing-engine](pricing-engine/spec.md) | Rumus harga, diskon, GM, tier, band, kurs | Tinggi |
| [cost-structure](cost-structure/spec.md) | Versi price book, Maker/Checker/Releaser, pemisahan tugas, rilis | Tinggi |
| [official-quotation](official-quotation/spec.md) | KYC, submit, langkah workflow, routing tier, release gate, dokumen bertanda tangan, rilis, revisi | Tinggi |
| [workflow-template-catalog](workflow-template-catalog/spec.md) | Pemilihan dan pengelolaan template workflow | Menengah |
| [access-control](access-control/spec.md) | Role berbasis fungsi, scope authority, akses menu, visibilitas | Tinggi |
| [price-estimate](price-estimate/spec.md) | Estimasi harga per unit (Workflow A) | Menengah |
| [product-master-data](product-master-data/spec.md) | Produk dan varian | Menengah |
| [master-data-and-rates](master-data-and-rates/spec.md) | Item biaya, kurs CNY/IDR, HMA/HPM | Menengah |
| [settings-configuration](settings-configuration/spec.md) | Tier margin, quantity band, setelan umum/dokumen | Menengah |
| [quotation-document](quotation-document/spec.md) | Cost Estimate, Cost Structure Sheet, cetak | Menengah |
| [dss-and-observability](dss-and-observability/spec.md) | What-if, guardrail, win/loss, overview, lifecycle, audit | Rendah–menengah |

## Rencana v5.0 (meeting *VKTR Req 2*)
Spec berikut berisi bagian **"Perubahan v5.0"** (sudah dikodekan 2026-10-11, migrasi 0018–0019 belum diverifikasi di database): official-quotation, workflow-template-catalog, settings-configuration, access-control, dss-and-observability. Capability baru [project-payment-tracking](project-payment-tracking/spec.md) baru, dikodekan di `src/app/(app)/projects`. Sumber: `docs/kebutuhan_baru_v2.md`, PRD dan Technical Logic v5.0. Urutan change yang diusulkan: (1) UI responsif sebagai pondasi, (2) approval final + lampiran tanda tangan, status berwarna, Won/Lost manual, diskon salesperson pada draft revisi, override Expired Admin, (3) Projects + payment + tracking, (4) Dashboard Sales/Executive. Konfigurasi satu workflow aktif tidak butuh change kode (migrasi seed atau Settings).

## Celah lintas-capability (kandidat change berikutnya)
Urut prioritas yang saya usulkan; tiap butir layak menjadi satu change SDD tersendiri lewat wawancara intent.

1. ~~Tidak ada tes otomatis.~~ **Sebagian selesai** (2026-10-09, change unit-tests-pure-logic): 72 unit test untuk fungsi murni. Masih terbuka: tes engine/aksi yang menulis DB (`checkReleaseGate`, `routeAfterReview`, `releaseQuotation`, aksi cost structure).
2. **Tidak ada transaksi.** Alur multi-langkah (submit, advance, release, simpan template/band/matriks scope, buat versi cost structure) berupa rangkaian update; kegagalan di tengah meninggalkan state parsial. Pertimbangkan fungsi Postgres/RPC.
3. **Penomoran "tertinggi + 1" tanpa kunci** (proposal, dokumen) rawan bentrok pada rilis serentak.
4. **Audit tidak menggagalkan aksi** bila gagal tulis, dan semua pengguna login dapat membaca audit lewat API (RLS read terbuka).
5. **Lifecycle/DSS tidak menyaring per kepemilikan quotation**; aman hanya pada matriks menu default.
6. **Inkonsistensi kecil**: audit toggle status/aktif mencatat nilai lama keliru; action produk/item biaya melempar error alih-alih `ActionResult`; ambang 15%/10% di-hardcode di DSS dan Overview.
7. **Fitur yang disebut PRD tetapi belum ada**: tarik kurs otomatis (FR-1.4.2), formula rental, UI `spec_sheet`/brosur, notifikasi eksternal, eskalasi SLA otomatis.
