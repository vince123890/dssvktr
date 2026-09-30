# VKTR-PriceCore — POC

Proof-of-concept untuk **Enterprise Smart Pricing & Decision Support System**
(VKTR-PriceCore), dibangun mengikuti spesifikasi di [`docs/PRD-VKTR-PriceCore.md`](docs/PRD-VKTR-PriceCore.md)
dan [`docs/TECHNICAL-LOGIC-VKTR-PriceCore.md`](docs/TECHNICAL-LOGIC-VKTR-PriceCore.md)
**v4.0** — konfirmasi VKTR lewat `docs/BTEL - Cost and Roles and Flow.xlsx`
(sheet *Cost Structure*, *Actors*, *Basic Workflow*) dan contoh dokumen
`docs/Cost Estimate - PT Siborong Nusa Gemilang 20260906 (1).pdf`.

> **v4.0 highlights.**
> - **Role & wewenang sebagai data** — 12 role sheet *Actors* (Sales
>   Executive, Sales Lead, Sales Operations Manager, Head of Sales,
>   Procurement Manager, Head of Procurement and Operations Control, Head
>   of Corporate Finance, CCO, CFO, Authorized Agency, Product Owner,
>   System Admin) dan matriks Maker/Checker/Releaser per scope diatur di
>   **Settings**, bukan di kode.
> - **Cost structure per varian** dirilis per scope lewat Maker → Checker
>   → Releaser; STNK & Insurance dikoreksi ke Add-Ons.
> - **Dua Basic Workflow VKTR**: *Price Estimate* (termasuk agency, excl./
>   incl. VAT, tanpa approval) dan *Official Quotation* (KYC → validasi
>   Sales Lead → generate Sales Operations per quantity band → Head of
>   Sales → tier margin 15%/10%: Owner / CCO+CFO).
> - **Dokumen Cost Estimate** — preview draft (watermark), print / simpan
>   PDF, halaman spesifikasi, Cost Structure Sheet internal terpisah.
> - Workflow, tier, quantity band, PPN, dan teks dokumen dapat diubah di
>   Settings; perubahan workflow membuat versi baru.

Stack: **Next.js 16 (App Router) + Supabase (Postgres, Auth, RLS) + Vercel**.

> Integrasi eksternal (ERP SAP/Odoo, CRM Salesforce/HubSpot, WhatsApp/MS Teams)
> **sengaja di-skip** pada POC ini sesuai arahan — lihat §Out of Scope di
> bawah. Struktur data dan kontrak sudah disiapkan agar mudah ditambahkan.

---

## 1. Kenapa Supabase?

Untuk POC yang perlu dideploy cepat ke Vercel:

- **Postgres asli** — mendukung JSONB (breakdown kalkulasi, audit diff),
  index komposit, dan constraint yang dibutuhkan technical logic doc.
- **Row Level Security (RLS)** bawaan — dipakai untuk enforce prinsip
  "audit log append-only" langsung di level database (§6 technical logic),
  bukan hanya di kode aplikasi.
- **Auth bawaan** dengan `@supabase/ssr` — tidak perlu membangun sistem
  auth terpisah untuk POC.
- **Deploy gratis, cepat provisioning** — cocok untuk siklus demo/iterasi.

Trade-off: sedikit vendor lock-in pada syntax RLS/Auth Supabase. Untuk POC,
ini sepadan dengan kecepatan setup.

---

## 2. Cakupan Modul (PRD v4.0)

| Modul | Implementasi |
|---|---|
| **Settings** (FR-5.6, FR-2.1) | `/settings` — Roles & Users, Scope Authority (M/C/R Regular/Deviation + pemisahan tugas + export CSV), Workflow (langkah Official Quotation, akses Price Estimate), Tier Margin & Quantity Band, Umum & Dokumen (PPN, masa berlaku, nomor dokumen, teks). `src/lib/rbac.ts` hanya memeriksa **fungsi** role. |
| **Cost Structure** (FR-1.1.2) | `/cost-structure` — price book per varian, versi, kurs CNY dikunci, banner rate sensitivity; `/cost-structure/[versionId]` — 4 scope dengan Maker/Checker/Releaser (`src/lib/costStructure.ts`). |
| **Price Estimate** (Workflow A) | `/price-estimate` — make → model → type → variant, harga excl./incl. VAT, log & audit. |
| **Official Quotation** (Workflow B) | `/proposals/new` (KYC + multi-varian), `/proposals/[id]` (aksi per role, panel harga Rp/%, timeline, tier approval), engine di `src/lib/workflow/quotationEngine.ts`. |
| **Dokumen** (FR-1.5.3/1.5.4) | `/print/proposals/[id]` (Cost Estimate) dan `/print/proposals/[id]/cost-structure` (internal). |
| Master Data | `/master-data` (cost item 4 scope, kurs CNY/IDR, rate sensitivity, HMA referensi) · `/master-data/product` (varian produk). |
| Observability | `/` (antrean "menunggu tindakan Anda"), `/lifecycle` (Kanban/Table), `/audit-log`. |
| DSS | `/dss` — what-if kurs/FOB/diskon → GM & tier, guardrail 15%, win/loss. |

## 3. Keputusan Desain POC (vs Technical Logic Doc lengkap)

| Area | Spesifikasi Lengkap | Implementasi POC | Alasan |
|---|---|---|---|
| Formula Engine | Expression DSL + sandboxed evaluator (§3) | Satu set fungsi murni di `src/lib/pricing/quotation.ts` untuk semua jalur (cost structure, quotation, Price Estimate, DSS, seed) | Tidak ada logika margin ganda; struktur biaya tetap 100% data |
| Role & wewenang | Role sebagai data + slot fungsional (§2.1, §8) | Sama — `app_role` + `scope_authority`; kode hanya membaca fungsi. Kolom legacy `profile.role` dijaga sinkron untuk RLS lama | Role baru dari Settings langsung berlaku tanpa deploy |
| Workflow Template | Editor no-code (§4.1a) | Editor langkah di Settings (pelaksana, kondisi lewati, tujuan tolak, SLA); simpan = versi baru; tier margin selalu disisipkan engine | Template tidak dapat melemahkan wewenang margin |
| Dokumen | Render HTML → PDF server-side (§4.12) | Satu halaman `/print/...` untuk preview & cetak; PDF via dialog cetak browser | Tanpa headless browser di Vercel; isi preview = isi cetak |
| Kedaluwarsa | Job harian (§4.11) | Dievaluasi saat halaman dibuka (`expireStaleQuotations`) | Tanpa scheduler |
| Integrasi ERP/CRM/Notifikasi | API-first contracts (§9) | **Di-skip** | Sesuai arahan POC |
| Exchange Rate Auto-Pull (FR-1.4.2) | Job mingguan dari API bank | Kurs CNY/IDR diinput di `/master-data` | Scheduler di luar scope POC |

---

## 4. Setup Lokal

### 4.1 Prasyarat
- Node.js 20+
- Akun [Supabase](https://supabase.com) (tier gratis cukup)
- Supabase CLI (opsional, untuk `supabase db push`) — atau jalankan SQL
  manual via SQL Editor di Supabase Dashboard

### 4.2 Buat Project Supabase
1. Buat project baru di [supabase.com/dashboard](https://supabase.com/dashboard).
2. Buka **Project Settings → API** — catat `Project URL`, `anon public key`, dan `service_role key`.
3. Salin `.env.local.example` menjadi `.env.local` dan isi ketiga nilai tersebut:

```bash
cp .env.local.example .env.local
```

### 4.3 Jalankan Migration SQL
Tambahkan `SUPABASE_DB_URL` (Session pooler URI) ke `.env.local`, lalu
jalankan berurutan `npm run migrate -- supabase/migrations/000X_....sql`
(atau via SQL Editor Supabase):

1. `0001`–`0013` — skema dasar s.d. v3.0.
2. `0014_v4_enums.sql` — status & audit action v4.0 (harus terpisah:
   nilai enum baru tidak boleh dipakai di transaksi yang sama).
3. `0015_v4_structures.sql` — `app_role`, `scope_authority`,
   `cost_structure_*`, `quotation_line_item`, `tier_approval`,
   `app_setting`, `quantity_band_config`, RLS.
4. `0016_v4_seed_reset.sql` — konfigurasi sesuai attachment (role,
   matriks, tier 15%/10%, band, dua workflow, varian LDT) dan **reset data
   transaksional**.

### 4.4 Install & Jalankan
```bash
npm install
npm run seed:demo   # provisioning 8 demo user + ~15 historical proposal
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

---

## 5. Demo Accounts

Dibuat oleh `npm run seed:demo` (password semua: `PriceCore123!`):

| Email | Role (sheet Actors) |
|---|---|
| agency@vktr.demo | Authorized Agency (eksternal — hanya Price Estimate) |
| sales.exec@vktr.demo | Sales Executive |
| sales.lead@vktr.demo | Sales Lead |
| salesops@vktr.demo | Sales Operations Manager |
| headsales@vktr.demo | Head of Sales |
| procurement@vktr.demo | Procurement Manager (COGS Owner) |
| headproc@vktr.demo | Head of Procurement and Operations Control (COGS Owner) |
| headfinance@vktr.demo | Head of Corporate Finance (Profitability Owner) |
| cco@vktr.demo | Chief Commercial Officer (Pricing Committee) |
| cfo@vktr.demo | Chief Finance Officer (Pricing Committee) |
| product@vktr.demo | Product Owner |
| admin@vktr.demo | System Admin |

Akun v3.0 (sales@, vpops@, vpfinance@, chiefsales@, bod1@, bod2@) dihapus
oleh seed — perannya tidak ada di sheet *Actors*.

Dokumentasi demo:

- [`docs/DEMO-FLOW-PRICE-ESTIMATE.md`](docs/DEMO-FLOW-PRICE-ESTIMATE.md) — **Workflow A**, langkah demi langkah.
- [`docs/DEMO-FLOW-OFFICIAL-QUOTATION.md`](docs/DEMO-FLOW-OFFICIAL-QUOTATION.md) — **Workflow B**, langkah demi langkah.
- [`docs/DEMO-FLOW-OVERVIEW.md`](docs/DEMO-FLOW-OVERVIEW.md) — peta peran & diagram alur.
- [`docs/DEMO-SCENARIO.md`](docs/DEMO-SCENARIO.md) / [`docs/DEMO-SCENARIO-CNY.md`](docs/DEMO-SCENARIO-CNY.md) — skenario naratif lengkap (termasuk kurs CNY).

### Mengulang demo

```bash
npm run reset:demo
```

Menghapus quotation, log Price Estimate, dan audit trail buatan demo;
memulihkan cost structure v1 (RELEASED) dan quotation historis; bila kurs
CNY/IDR diubah saat demo, menambahkan baris baru 2.600. Settings, master
data, dan akun demo tidak disentuh.

---

## 6. Deploy ke Vercel

1. Push repo ini ke GitHub/GitLab.
2. Di [vercel.com/new](https://vercel.com/new), import repo tersebut.
3. Tambahkan Environment Variables (sama seperti `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (opsional untuk runtime app; hanya dipakai script seed — **jangan** expose ke client)
4. Deploy. Next.js App Router + Server Actions berjalan native di Vercel
   tanpa konfigurasi tambahan.
5. Jalankan `npm run seed:demo` dari mesin lokal (bukan dari Vercel) yang
   menunjuk ke project Supabase yang sama, agar demo data tersedia.

---

## 7. Struktur Proyek

```
src/
  app/
    login/                     # Auth (Supabase Auth)
    print/proposals/[id]/      # Dokumen Cost Estimate + Cost Structure Sheet (tanpa sidebar, siap cetak)
    (app)/                     # Protected route group (sidebar difilter per fungsi role)
      page.tsx                 # Overview + antrean "menunggu tindakan Anda"
      price-estimate/          # Workflow A — Price Estimate per unit
      proposals/               # Workflow B — KYC form (QuotationForm), list
        [id]/                  # detail, ActionPanel, PricingEditor, quotation-actions.ts
      cost-structure/          # Price book per varian + Maker/Checker/Releaser per scope
      settings/                # Roles & Users, Scope Authority, Workflow, Tier & Band, Umum
      lifecycle/ audit-log/ dss/ master-data/ (product/)
    api/simulate/              # What-if (stateless)
    api/settings/scope-authority.csv/  # Export matriks format sheet Actors
  lib/
    pricing/quotation.ts       # Engine murni: cost structure, diskon Rp/%, VAT, GM, tier, band
    pricing/currency.ts, mineral.ts
    costStructure.ts           # Loading versi, skenario, canPerformScopeAction (M/C/R + segregation)
    workflow/quotationEngine.ts  # State machine Official Quotation, tier routing, release gate, expiry
    workflow/duplicateGuard.ts, projectIdentifier.ts, proposalNumber.ts, labels.ts
    rbac.ts                    # Fungsi role (FunctionalRole), slot tier, visibilitas cost structure
    settings.ts, priceEstimateAccess.ts, auth.ts (requireInternal), audit.ts
supabase/migrations/           # 0001-0016 (v4.0 = 0014-0016)
scripts/
  demoData.ts                  # Akun, cost structure seed, quotation historis (dipakai seed & reset)
  seed-demo.ts / reset-demo.ts / run-migration.ts
docs/
  PRD-VKTR-PriceCore.md, TECHNICAL-LOGIC-VKTR-PriceCore.md   # v4.0
  DEMO-FLOW-PRICE-ESTIMATE.md, DEMO-FLOW-OFFICIAL-QUOTATION.md  # skrip demo per workflow
  DEMO-FLOW-OVERVIEW.md, DEMO-SCENARIO.md, DEMO-SCENARIO-CNY.md
  BTEL - Cost and Roles and Flow.xlsx, Cost Estimate - PT Siborong Nusa Gemilang 20260906 (1).pdf
```

---

## 8. Out of Scope (POC ini)

- Integrasi ERP (SAP/Odoo), CRM (Salesforce/HubSpot) — kontrak di §9
  technical logic.
- Notifikasi keluar (Email/MS Teams/WhatsApp) untuk SLA & tembusan tier —
  hanya tampil di UI.
- Tarik kurs otomatis mingguan dari API bank — kurs CNY/IDR diinput di
  Master Data; skema `source='bank-api'` sudah siap.
- PDF dibuat lewat dialog cetak browser (*Save as PDF*) dari halaman
  dokumen yang sama dengan preview — belum ada generator PDF server-side.
- **Formula skema Rental** belum diterima dari VKTR — sewa/bulan diinput
  manual oleh Sales Operations.
- **Penyimpangan cost line per deal** (FR-1.1.3) belum dibangun —
  penyesuaian harga per deal lewat diskon; nilai biaya berubah lewat versi
  cost structure baru.
- Pembuatan akun user dari Settings (akun dibuat lewat Supabase Auth /
  seed; Settings mengatur role-nya).
- Kedaluwarsa quotation dievaluasi saat halaman dibuka (bukan cron job).
- Verifikasi KYC pihak ketiga, e-signature, Global Adjustment HPM.
