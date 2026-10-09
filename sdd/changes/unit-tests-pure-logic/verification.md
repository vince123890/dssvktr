# Verification: unit-tests-pure-logic

## Terverifikasi
- `npm test`: 6 file, 72 tes lulus (vitest 3.2.7). `tsc --noEmit` dan `eslint src/test src/lib vitest.config.ts` bersih.
- Tes bisa gagal: mengubah `>=` menjadi `>` pada batas bawah `resolveTier` membuat 2 tes gagal; kode dikembalikan (git diff kosong).
- Contoh angka di spec pricing-engine (115, 9,09%, 109,25, 121,2675, 4.370, 4,08%, 16,67%) dan semua scenario resolveTier/resolveBand/strictestMode lulus tanpa menyesuaikan kode; spec as-built terkonfirmasi untuk bagian ini.

## Pemetaan scenario -> tes
- pricing-engine: quotation.test.ts (harga dasar, diskon, per baris, GM tertimbang, tier, band), currency.test.ts (konversi, kurs berlaku).
- cost-structure: costStructure.test.ts (skenario REGULAR/DEVIATION, pemisahan tugas, pemegang tunggal, aturan default, tanpa role/wewenang).
- workflow-template-catalog: templateCatalog.test.ts (pemilihan, prioritas, fallback, qualifier, blacklist).
- master-data-and-rates: mineral.test.ts (HPM, faktor 1, kedaluwarsa 14 hari).
- access-control: access.test.ts (fungsi role, slot, akses menu, landing, visibilitas quotation, legacyRoleFor).

## Belum terverifikasi
- Alur server action dan engine yang menulis ke database: submit, advance, routeAfterReview, decideTier, checkReleaseGate, releaseQuotation, nomor dokumen, penjaga duplikat, aksi cost structure. Butuh fake yang mendukung tulis atau database uji; dijadikan change terpisah.
- Validasi zod di action, RLS, dan UI.
- `computeCostStructure`: kombinasi item profitability persen + nominal sekaligus hanya diuji terpisah.

## Diterima atas dasar kepercayaan
- Fake Supabase (`src/test/fakeDb.ts`) hanya meniru builder baca; perilaku nyata filter PostgREST tidak diuji.

## Diff sanity
Hanya menambah: vitest.config.ts, src/test/fakeDb.ts, 6 file *.test.ts, script `test`, devDependency vitest ^3.2.7. Tidak ada perubahan kode produksi. Vitest 5 tidak dipakai karena peer opsional bentrok dengan @types/node 20.
