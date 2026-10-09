# Design: unit-tests-pure-logic

## Decisions
- **Vitest, environment node.** Config `vitest.config.ts` dengan alias `@` -> `src` agar import `@/lib/...` jalan. Rationale: dipilih user; paling sedikit konfigurasi untuk TypeScript. Alternatif: node:test+tsx, Jest.
- **Tes berdampingan** (`src/lib/pricing/quotation.test.ts` dst.). Rationale: dekat dengan kode, tidak menyentuh folder app Next.
- **Fake Supabase minimal** untuk `canPerformScopeAction`, `loadLadder`, dan `resolveExchangeRate`: objek query-builder berantai yang mengembalikan data tabel tetap. Tidak memakai library mock.
- **Tes tidak menyalin logika produksi**; nilai harapan dihitung tangan dan ditulis literal.
- **Tidak ada perubahan kode produksi.** Fungsi yang tidak diekspor tidak dites.

## Verification plan
Kekritisan tinggi (pricing, tier, wewenang): tiap scenario di spec pricing-engine dan cost-structure (pemisahan tugas) punya satu tes. Menengah: pemilihan template, HPM, akses menu.

## Penyimpangan saat apply
- Vitest 5.0.3 (terbaru) menolak terpasang karena peer opsional `@types/node ^22||>=24` bentrok dengan `@types/node ^20` proyek. Dipakai `vitest@^3` tanpa `--force` dan tanpa mengubah `@types/node`.
