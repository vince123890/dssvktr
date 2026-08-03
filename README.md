# VKTR-PriceCore — POC

Proof-of-concept untuk **Enterprise Smart Pricing & Decision Support System**
(VKTR-PriceCore), dibangun mengikuti spesifikasi di [`docs/PRD-VKTR-PriceCore.md`](docs/PRD-VKTR-PriceCore.md)
dan [`docs/TECHNICAL-LOGIC-VKTR-PriceCore.md`](docs/TECHNICAL-LOGIC-VKTR-PriceCore.md).

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

## 2. Cakupan Modul (mengikuti PRD Module 1–5)

| Modul PRD | Implementasi POC |
|---|---|
| **Module 1** — Dynamic Pricing & Master Data | `/master-data` (CBS Builder: Direct/Indirect/Margin cost items, Pricing Template per lini bisnis). Formula: **fixed per business line di TypeScript** (`src/lib/pricing/engine.ts`), bukan full expression-DSL editor — lihat §Keputusan Desain. |
| **Module 2** — Configurable Multi-Dept Workflow | `/proposals/[id]` (submit, approve/reject/targeted-reject) + `/admin` (lihat & toggle Workflow Definition per value-bucket). State machine di `src/lib/workflow/stateMachine.ts`. |
| **Module 3** — State Tracking & Observability | `/lifecycle` (Kanban + Table view, SLA breach indicator) dan `/audit-log` (immutable audit trail, filterable). |
| **Module 4** — DSS & Simulation | `/dss` (What-If slider simulator real-time, Margin Guardrail alerts, Win/Loss Analytics dengan scatter chart + Optimal Price Band). |
| **Module 5** — Auth & RBAC | Supabase Auth + 6 role (Procurement/Engineering/Finance/Sales/C-Level/Admin). Field-level masking raw margin dari Sales (`src/lib/rbac.ts`). |

---

## 3. Keputusan Desain POC (vs Technical Logic Doc lengkap)

| Area | Spesifikasi Lengkap | Implementasi POC | Alasan |
|---|---|---|---|
| Formula Engine | Expression DSL + sandboxed evaluator (§3) | Formula fixed per business line di kode TS, tapi cost items & template tetap 100% data-driven | Menghindari kompleksitas parser/sandboxing custom untuk scope POC, tanpa mengorbankan "no hardcoded cost structure" |
| Workflow Configurator | Full no-code drag-drop builder (§4) | Workflow Definition & Steps dikonfigurasi via SQL seed / halaman `/admin` (view + toggle active), bukan drag-drop UI | State machine & gatekeeping logic tetap penuh — hanya UI authoring yang disederhanakan |
| RBAC/ABAC | Field masking di response serializer (§8) | Sama — masking diterapkan di komponen React saat render (`maskBreakdownForRole`), didampingi RLS row-level di Postgres | Tetap mengikuti prinsip "masking di server/layer sebelum sampai client" |
| Integrasi ERP/CRM/Notifikasi | API-first contracts (§9) | **Di-skip** — cost line & harga final tidak diekspor kemana pun | Sesuai instruksi; struktur `pricing_proposal_version` sudah siap untuk ditambahkan endpoint export |
| SLA Escalation Notification | Email/Teams/WhatsApp push (§5) | SLA breach dihitung & ditampilkan di UI (`isSlaBreached`), tapi tidak ada pengiriman notifikasi keluar | Cron job pengirim notifikasi adalah pekerjaan infra terpisah di luar scope POC |

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
`supabase db push` jika sudah link project via CLI):

1. `supabase/migrations/0001_init_schema.sql` — tabel, enum, index
2. `supabase/migrations/0002_rls_policies.sql` — RLS policies
3. `supabase/migrations/0003_seed_data.sql` — departemen, cost items, CBS template, workflow definition, FX snapshot
4. `supabase/migrations/0004_auth_trigger.sql` — trigger auto-create `profile` saat signup

### 4.4 Install & Jalankan
```bash
npm install
npm run seed:demo   # provisioning 6 demo user + ~15 historical proposal
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

---

## 5. Demo Accounts

Dibuat otomatis oleh `npm run seed:demo` (password sama untuk semua: `PriceCore123!`):

| Email | Role | Departemen |
|---|---|---|
| procurement@vktr.demo | Procurement Analyst | Procurement |
| engineering@vktr.demo | Cost Engineer | Engineering |
| finance@vktr.demo | Finance Controller | Finance |
| sales@vktr.demo | Sales Manager | Sales |
| clevel@vktr.demo | C-Level / BOD | Executive |
| admin@vktr.demo | System Admin | IT/Operations |

Lihat [`docs/DEMO-SCENARIO.md`](docs/DEMO-SCENARIO.md) untuk skenario demo
langkah-demi-langkah (siapa login sebagai apa, data apa yang diinput, alur
approval, dan hasil yang diharapkan).

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
      lifecycle/           # Module 3: Kanban + Table lifecycle view
      audit-log/           # Module 3: immutable audit trail
      dss/                 # Module 4: What-If, Guardrails, Win/Loss
      master-data/         # Module 1: Cost Items, CBS Templates
      admin/                # Module 2: Workflow Definition viewer
    api/simulate/          # Stateless what-if calculation endpoint
  lib/
    pricing/engine.ts      # Dynamic Pricing Engine (formula logic)
    workflow/stateMachine.ts  # Gatekeeping, approve/reject/targeted-reject
    rbac.ts                 # Field-level masking rules
    audit.ts                 # Append-only audit log writer
    supabase/                # browser/server/middleware/admin clients
supabase/migrations/         # SQL schema, RLS, seed data
scripts/seed-demo.ts          # Demo users + historical proposals
docs/
  PRD-VKTR-PriceCore.md
  TECHNICAL-LOGIC-VKTR-PriceCore.md
  DEMO-SCENARIO.md
```

---

## 8. Out of Scope (POC ini)

- Integrasi ERP (SAP/Odoo), CRM (Salesforce/HubSpot) — lihat §9 technical
  logic doc untuk kontrak yang sudah dirancang dan siap diimplementasikan.
- Notifikasi keluar (Email/MS Teams/WhatsApp) untuk SLA breach — breach
  hanya divisualisasikan di UI.
- Full no-code drag-drop workflow builder — konfigurasi via data seed/admin toggle.
- Full expression-DSL formula editor — formula fixed per business line di kode.
