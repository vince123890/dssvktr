# Project Context (sdd/config.md)

## Domain
VKTR-PriceCore: sistem harga dan persetujuan Commercial Quotation untuk VKTR (kendaraan niaga/EV). Dua workflow utama:
- **Price Estimate** (Workflow A): estimasi cepat per varian, excl./incl. PPN, tanpa approval, dipakai Authorized Agency dan Sales.
- **Official Quotation** (Workflow B): KYC, validasi Sales Lead, generate Sales Operations per quantity band, Head of Sales, lalu tier margin (15%/10%) yang menentukan approver.

Istilah: **varian** = unit yang dikutip (make → model → type → variant); **Cost Structure** = harga per varian dalam 4 scope (M/C/R: Maker → Checker → Releaser); **scope authority** = matriks wewenang role per scope; **tier margin** = ambang GM yang menentukan approver; **quantity band** = rentang kuantitas; **HMA/HPM** = indeks mineral referensi (Kepmen ESDM 144.K/2026); **kurs CNY/IDR** dikunci per proposal.

Sumber lengkap: `docs/PRD-VKTR-PriceCore.md` dan `docs/TECHNICAL-LOGIC-VKTR-PriceCore.md` (v4.0/v4.1). Spec di `sdd/specs/` adalah perilaku as-built hasil pembacaan kode; bila beda dengan PRD, catat di bagian "Catatan as-built" spec terkait.

## Tech Stack
Next.js 16.2 (App Router, Server Actions) · React 19.2 · TypeScript · Tailwind 4 · Supabase (Postgres, Auth, RLS) lewat `@supabase/ssr` · zod 4 · recharts · @dnd-kit · Vercel (region `hnd1`, sama dengan database).
**Next.js proyek ini punya breaking changes**: baca `node_modules/next/dist/docs/` sebelum menulis kode (lihat AGENTS.md).

## Konvensi
- Struktur kode: `src/app/(app)/<menu>` halaman + `actions.ts` (server action) per menu; `src/lib/` logika murni (`pricing/`, `workflow/`, `rbac.ts`, `menuAccess.ts`); migrasi di `supabase/migrations/NNNN_*.sql` berurutan.
- Role dan wewenang adalah **data** (`app_role`, `scope_authority`), bukan kode. Kode hanya memeriksa *fungsi* role lewat `src/lib/rbac.ts`.
- Satu set fungsi murni di `src/lib/pricing/quotation.ts` untuk semua jalur kalkulasi; jangan menduplikasi logika margin.
- Server action mengembalikan `ActionResult` (`src/lib/actionResult.ts`), dan setiap perubahan data bisnis menulis audit log (`writeAuditLog`).
- Perintah: dev `npm run dev` · build `npm run build` · lint `npm run lint` · migrasi `npm run migrate -- <file.sql>` · seed `npm run seed:demo` · reset demo `npm run reset:demo`. Belum ada test runner di `package.json`.

## Kekritisan & Verifikasi
- Default kekritisan: menengah. Tinggi untuk kalkulasi harga/margin, tier approval, dan wewenang (uang dan kontrol akses).
- Area kritis: `src/lib/pricing/*`, `src/lib/workflow/quotationEngine.ts`, `src/lib/costStructure.ts`, `src/lib/rbac.ts`, `src/lib/menuAccess.ts`, RLS di migrasi.
- Lapisan tes: belum ada tes otomatis. Verifikasi saat ini lewat skenario demo di `docs/DEMO-*.md` dan akun seed. Change berikutnya sebaiknya menambah unit test untuk fungsi murni `src/lib/pricing` dan `src/lib/workflow`.

## Batasan Non-Fungsional
- Audit trail append-only (RLS). Menu di luar wewenang role disembunyikan di sidebar dan 404 lewat URL.
- Performa action: tanpa `router.refresh()` setelah action (cukup `revalidatePath`), query independen paralel.
- Integrasi ERP/CRM/notifikasi eksternal sengaja di luar scope POC.
