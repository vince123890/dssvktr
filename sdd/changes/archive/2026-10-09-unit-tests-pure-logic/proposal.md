# Proposal: unit-tests-pure-logic

## Why
Aplikasi menghitung harga, margin, tier approval, dan wewenang (uang dan kontrol akses) tanpa satu pun tes otomatis. Spec as-built (sdd/specs) menyatakan perilaku saat ini, tetapi tidak ada yang menjaganya dari regresi. Perubahan berikutnya (transaksi, penomoran, audit) menyentuh logika ini; tes harus ada lebih dulu.

## What changes
- Menambah test runner Vitest (devDependency) dan script `npm test`.
- Menambah unit test untuk fungsi murni dan fungsi dengan dependensi database yang dapat difake: pricing-engine, pemilihan template workflow, perhitungan HPM/stale index, evaluasi cost structure, dan pemeriksaan fungsi role / akses menu.
- Tidak mengubah kode produksi dan tidak mengubah perilaku.

## Capabilities
- Terdampak (tes saja, tanpa delta spec): pricing-engine, workflow-template-catalog, master-data-and-rates, access-control, cost-structure.

## Non-goals
- Tes UI/E2E, tes RLS/database, tes server action penuh.
- Memperbaiki celah yang ditemukan tes: bug ditulis sebagai temuan, bukan ditambal di change ini.
- Mengubah ambang atau aturan bisnis.

## Assumptions
- Vitest dipilih user. Tes ditaruh berdampingan: `src/**/*.test.ts`.
- Contoh angka di spec pricing-engine adalah kontrak tes; bila kode menyimpang dari spec, tes mengikuti spec dan temuan dilaporkan.

## Open Questions
(tidak ada)
