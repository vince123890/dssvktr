# VKTR-PriceCore — POC

Proof-of-concept untuk **Enterprise Smart Pricing & Decision Support System**
(VKTR-PriceCore), dibangun mengikuti spesifikasi di [`docs/PRD-VKTR-PriceCore.md`](docs/PRD-VKTR-PriceCore.md)
dan [`docs/TECHNICAL-LOGIC-VKTR-PriceCore.md`](docs/TECHNICAL-LOGIC-VKTR-PriceCore.md)
(v3.0 — hasil demo review, lihat `docs/transcribe.md`).

> **v3.0 highlights.** Master data CBS kini tunggal untuk semua lini
> bisnis (struktur riil VKTR/BTEL: COGS/Profitability/Sales/Add-Ons —
> lihat `docs/BTEL-CostStructure.xlsx`); urutan pengisi cost line
> dikoreksi menjadi Sales Officer → VP Operations → VP Finance → Chief
> Sales; discount authority diganti dari tangga persentase diskon
> menjadi **Margin Tier** berbasis GPM akhir (Tier 1 Auto / Tier 2
> 3-Pihak / Tier 3 2-BOD); basis kurs dikoreksi dari USD ke **CNY
> (Renminbi/Yuan)** — mata uang riil FOB Price; ditambahkan Project
> Identifier (revisi quotation ter-link), Product Owner, dan Rate
> Sensitivity Threshold.

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

## 2. Cakupan Modul (mengikuti PRD Module 1–8, v3.0)

| Modul PRD | Implementasi POC |
|---|---|
| **Module 1** — Dynamic Pricing & Master Data | `/master-data` (CBS **tunggal**: COGS/Profitability/Sales/Add-Ons — bukan lagi Direct/Indirect/Margin per lini bisnis) dan `/master-data/product` (Product Master Data, dikelola Product Owner). Formula: **satu fungsi generik untuk semua lini bisnis** (`src/lib/pricing/engine.ts`) — lihat §Keputusan Desain. |
| **Module 2** — Configurable Multi-Dept Workflow | `/proposals/[id]` (submit, approve/reject/targeted-reject, urutan VP Operations → VP Finance → Chief Sales) + `/admin` (Workflow Template Catalog, `src/lib/workflow/templateResolution.ts`). Project Identifier & revision (`src/lib/workflow/projectIdentifier.ts`), Duplicate/Fraud Guard (`src/lib/workflow/duplicateGuard.ts`). |
| **Module 3** — State Tracking & Observability | `/lifecycle` (Kanban + Table view, SLA breach indicator) dan `/audit-log` (immutable audit trail, filterable). |
| **Module 4** — DSS & Simulation | `/dss` (What-If slider simulator real-time — FX/CNY aktif, HMA referensi saja; Margin Guardrail alerts, Win/Loss Analytics). |
| **Module 5** — Auth & RBAC | Supabase Auth + 7 role (Sales Officer/VP Operations/VP Finance/Chief Sales/Product Owner/BOD/Admin). Sales Officer **tidak melihat** kelompok COGS/Profitability/Add-Ons sama sekali (`src/lib/rbac.ts`). |
| **Module 6** — Commercial Negotiation | `NegotiationPanel.tsx` — Margin-Tier Discount Authority (`src/lib/negotiation/marginTier.ts`): Tier 1 auto, Tier 2 AND-join 3 pihak, Tier 3 AND-join 2 BOD berbeda. Input diskon Rupiah atau persentase. |
| **Module 8** — Mineral Index | HMA/HPM ditampilkan sebagai referensi (`src/lib/pricing/mineral.ts`) — dampak riil ke harga berjalan lewat kurs CNY/IDR, faktor pengali independen dinonaktifkan. |

---

## 3. Keputusan Desain POC (vs Technical Logic Doc lengkap)

| Area | Spesifikasi Lengkap | Implementasi POC | Alasan |
|---|---|---|---|
| Formula Engine | Expression DSL + sandboxed evaluator (§3) | Satu formula generik di kode TS untuk semua lini bisnis (FR-1.2, v3.0) — cost items & template tetap 100% data-driven | Menghindari kompleksitas parser/sandboxing custom untuk scope POC, tanpa mengorbankan "no hardcoded cost structure" |
| Workflow Template Catalog | Full no-code drag-drop builder (§4) | Workflow Definition & Steps dikonfigurasi via SQL seed / halaman `/admin` (view + toggle active + qualifier_type), bukan drag-drop UI | State machine, gatekeeping, dan `resolveWorkflowTemplate` logic tetap penuh — hanya UI authoring yang disederhanakan |
| RBAC/ABAC | Field masking di response serializer (§8) | Sama — masking diterapkan di komponen React saat render (`maskBreakdownForRole`), didampingi RLS row-level di Postgres | Tetap mengikuti prinsip "masking di server/layer sebelum sampai client" |
| Format Quotation PDF (FR-1.5.3) | Generator PDF dengan template dinamis | Data model `quotation_document_template` tersedia, **tanpa generator PDF aktif** | Menunggu contoh dokumen dari tim Sales/Product VKTR; prioritas iterasi ini ke governance/pricing/negotiation core |
| Integrasi ERP/CRM/Notifikasi | API-first contracts (§9) | **Di-skip** — cost line & harga final tidak diekspor kemana pun | Sesuai instruksi; struktur `pricing_proposal_version` sudah siap untuk ditambahkan endpoint export |
| SLA Escalation Notification | Email/Teams/WhatsApp push (§5) | SLA breach dihitung & ditampilkan di UI (`isSlaBreached`), tapi tidak ada pengiriman notifikasi keluar | Cron job pengirim notifikasi adalah pekerjaan infra terpisah di luar scope POC |
| Exchange Rate Auto-Pull (FR-1.4.2) | Job terjadwal mingguan dari API bank | Kurs CNY/IDR diinput manual via `/master-data` (`createExchangeRateAction`); struktur `exchange_rate.pulled_at`/`source='bank-api'` sudah siap | Job scheduler adalah pekerjaan infra terpisah di luar scope POC |

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
Buka **SQL Editor** di Supabase Dashboard, jalankan berurutan (atau pakai
`npm run migrate -- supabase/migrations/000X_....sql` jika `SUPABASE_DB_URL`
sudah diset di `.env.local`):

1. `supabase/migrations/0001_init_schema.sql` — tabel, enum, index
2. `supabase/migrations/0002_rls_policies.sql` — RLS policies
3. `supabase/migrations/0003_seed_data.sql` — departemen, cost items, CBS template, workflow definition, FX snapshot
4. `supabase/migrations/0004_auth_trigger.sql` — trigger auto-create `profile` saat signup
5. `supabase/migrations/0005_fix_current_version_id.sql` – `0010_currency_and_mineral_structures.sql` — perbaikan bug & v2.0/v2.1 (COGS Owner workflow, multi-currency, mineral index)
6. `supabase/migrations/0011_v3_revision_enums.sql` — enum baru v3.0 (`cost_group`, `CNY`, `SUPERSEDED`, `PRODUCT_OWNER`, dst.)
7. `supabase/migrations/0012_v3_revision_structures.sql` — tabel & kolom baru v3.0 (`project_identifier`, `product_master_data`, `margin_tier_authority`, `rate_sensitivity_config`, dst.)
8. `supabase/migrations/0013_v3_seed_reset.sql` — **reset total** master data & data transaksional lama ke struktur riil VKTR/BTEL (lihat catatan di kepala file — proposal/cost item lama dihapus, tidak dimigrasikan)

### 4.4 Install & Jalankan
```bash
npm install
npm run seed:demo   # provisioning 8 demo user + ~15 historical proposal
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

---

## 5. Demo Accounts

Dibuat otomatis oleh `npm run seed:demo` (password sama untuk semua: `PriceCore123!`):

| Email | Role | Peran dalam alur |
|---|---|---|
| sales@vktr.demo | Sales Officer | Membuat quotation (data customer/unit, tanpa akses COGS), mengajukan diskon |
| vpops@vktr.demo | VP Operations | COGS Owner — mengisi lebih dulu: kelompok COGS & Add-Ons |
| vpfinance@vktr.demo | VP Finance | COGS Owner — kelompok Profitability; salah satu approver Tier 2 |
| chiefsales@vktr.demo | Chief Sales | Meninjau & approve rilis; salah satu approver Tier 2 |
| product@vktr.demo | Product Owner | Kelola Product Master Data (spesifikasi, gambar, brosur) |
| bod1@vktr.demo | BOD | Approver Tier 3 (wajib 2 BOD berbeda) |
| bod2@vktr.demo | BOD | Approver Tier 3 (wajib 2 BOD berbeda) |
| admin@vktr.demo | System Admin | Master data, Workflow Template Catalog, Margin Tier Authority |

Dokumentasi demo:

- [`docs/DEMO-FLOW-OVERVIEW.md`](docs/DEMO-FLOW-OVERVIEW.md) — **mulai di
  sini**: peta peran, diagram alur quotation & negosiasi, urutan login.
- [`docs/DEMO-SCENARIO.md`](docs/DEMO-SCENARIO.md) — langkah-demi-langkah
  beserta angka yang harus diinput dan hasil yang diharapkan.
- [`docs/DEMO-SCENARIO-CNY.md`](docs/DEMO-SCENARIO-CNY.md) — skenario
  kedua: quotation berdenominasi **CNY (Renminbi)** dengan Rate
  Sensitivity Threshold.

### Mengulang demo

```bash
npm run reset:demo
```

Mengembalikan aplikasi ke kondisi sebelum demo: proposal yang dibuat saat
demo dihapus (beserta versi, cost line, hasil kalkulasi, workflow, dan
audit log-nya), sementara 15 proposal historis dikembalikan ke posisi awal
agar grafik Win/Loss Analytics tetap terisi.

Master data dan akun demo tidak disentuh — **tidak perlu** menjalankan
ulang migration SQL atau `seed:demo`, dan tidak perlu membuka Supabase
Dashboard sama sekali. Aman dijalankan berkali-kali.

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
    login/                 # Auth (Supabase Auth)
    (app)/                 # Protected route group (sidebar layout)
      page.tsx             # Executive overview dashboard
      proposals/           # Module 1+2: create, CBS input, calculation, approval
        [id]/
          negotiation-actions.ts  # Module 6: margin-tier discount request/decision
          revision-actions.ts     # Module 2: Hitung Ulang, Buat Revisi (Project Identifier)
      lifecycle/           # Module 3: Kanban + Table lifecycle view
      audit-log/           # Module 3: immutable audit trail
      dss/                 # Module 4: What-If, Guardrails, Win/Loss
      master-data/         # Module 1: Cost Items (COGS/Profitability/Sales/Add-Ons), CBS tunggal
        product/            # Module 1 (FR-1.5): Product Master Data (Product Owner)
      admin/                # Module 2/6: Workflow Template Catalog + Margin Tier Authority
    api/simulate/          # Stateless what-if calculation endpoint
  lib/
    pricing/
      engine.ts            # Pricing Engine — satu formula untuk semua lini bisnis
      currency.ts           # Multi-currency, basis CNY/IDR
      rateSensitivity.ts     # FR-1.4.6 threshold check (banner, bukan auto-recalculate)
      mineral.ts             # HMA/HPM — referensi saja, faktor dormant (FR-8.3)
    workflow/
      stateMachine.ts        # Gatekeeping, approve/reject/targeted-reject
      releaseGate.ts          # 3 syarat rilis, termasuk margin tier AND-join
      templateResolution.ts    # FR-2.0.1 Workflow Template Catalog resolution
      projectIdentifier.ts      # FR-2.5 Project Identifier & revision proposal
      duplicateGuard.ts          # FR-2.6 Duplicate/Fraud Guard
    negotiation/
      marginTier.ts          # FR-6.1 Margin Tier Authority, AND-join checks
    rbac.ts                 # Field-level masking rules (per cost_group)
    audit.ts                 # Append-only audit log writer
    supabase/                # browser/server/middleware/admin clients
supabase/migrations/         # SQL schema, RLS, seed data (0001-0013)
scripts/
  seed-demo.ts                # 8 demo users + historical proposals (struktur BTEL)
  reset-demo.ts                # Reset ke state pasca-seed
docs/
  PRD-VKTR-PriceCore.md              # v3.0
  TECHNICAL-LOGIC-VKTR-PriceCore.md   # v3.0
  BTEL-CostStructure.xlsx              # Sumber struktur CBS riil
  transcribe.md                         # Transkrip demo review (sumber revisi v3.0)
  DEMO-FLOW-OVERVIEW.md         # Peta peran + flow besar
  DEMO-SCENARIO.md              # Langkah demi langkah (IDR)
  DEMO-SCENARIO-CNY.md          # Skenario 2 (CNY/RMB + Rate Sensitivity)
```

---

## 8. Out of Scope (POC ini)

- **Customer KYC & Opportunity Assessment (PRD Module 7)** — tetap tidak
  dibangun; nama customer cukup field bebas pada Project Identifier.
- Integrasi ERP (SAP/Odoo), CRM (Salesforce/HubSpot) — lihat §9 technical
  logic doc untuk kontrak yang sudah dirancang dan siap diimplementasikan.
- Notifikasi keluar (Email/MS Teams/WhatsApp) untuk SLA breach — breach
  hanya divisualisasikan di UI.
- Full no-code drag-drop workflow builder — konfigurasi via data seed/admin toggle.
- Full expression-DSL formula editor — satu formula generik di kode untuk
  semua lini bisnis (FR-1.2).
- **Exchange rate auto-pull mingguan dari API bank** (FR-1.4.2) — kurs
  CNY/IDR diinput manual; skema `source='bank-api'`/`pulled_at` sudah
  siap untuk job scheduler.
- **Generator PDF Format Quotation** (FR-1.5.3) — data model
  `quotation_document_template` tersedia, belum ada rendering PDF aktif.
- **Mineral Index Global Adjustment Factor** (FR-8.3) — dinonaktifkan
  secara sengaja; HMA/HPM tampil sebagai referensi, dampak riil ke harga
  berjalan lewat kurs CNY/IDR (lihat Technical Logic §13).
