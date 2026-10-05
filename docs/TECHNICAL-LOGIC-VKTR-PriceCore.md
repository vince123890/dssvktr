# Technical Logic & System Design Document

## VKTR-PriceCore — Enterprise Smart Pricing & Decision Support System

| | |
|---|---|
| **Document Version** | 4.0 (Konfirmasi VKTR — Configurable Roles & Scope Authority, Cost Structure Maker/Checker/Releaser, Basic Workflow Price Estimate & Official Quotation, Dokumen Cost Estimate) |
| **Companion Document** | `PRD-VKTR-PriceCore.md` v4.0 |
| **Purpose** | Menerjemahkan requirement fungsional PRD menjadi logika data, state machine, dan arsitektur teknis yang dapat langsung dieksekusi oleh tim engineering. |

> **Perubahan utama v2.0** (mengikuti PRD v2.0):
> 1. **Aktor & workflow** — Procurement/Engineering diganti oleh **COGS Owner**
>    (VP Finance ∥ VP Operations) yang bekerja **paralel** (AND-join), dengan
>    Chief Sales sebagai penyusun quotation dan BOD sebagai otoritas tertinggi.
> 2. **Commercial Negotiation Engine** (§11) — state machine terpisah untuk
>    permintaan diskon berbasis *delegated authority matrix*.
> 3. **Release gate** — `QUOTATION_RELEASED` hanya tercapai bila seluruh
>    komponen COGS mandatory tervalidasi.
>
> **Perubahan v2.1** (mengikuti PRD v2.1):
> 4. **Multi-currency** (§12) — cost line dapat diinput dalam USD atau IDR;
>    nilai asli disimpan apa adanya, konversi terjadi di lapisan kalkulasi
>    memakai kurs dari master data.
> 5. **Mineral Index Adjustment** (§13) — HMA dari Kepmen ESDM dihitung
>    menjadi HPM, lalu dipakai sebagai faktor penyesuaian global terhadap
>    komponen biaya *mineral-linked*.
>
> **Perubahan v3.0** (mengikuti PRD v3.0, hasil demo review —
> `transcribe.md`):
> 6. **Master data CBS tunggal** — struktur item diganti memakai cost
>    structure riil VKTR/BTEL (`BTEL-CostStructure.xlsx`): kelompok
>    COGS/Profitability/Sales/Add-Ons, satu master data untuk semua lini
>    bisnis (§2.1).
> 7. **Workflow Template Catalog** (§4) — `workflow_definition` kini
>    eksplisit sebagai satu dari banyak template yang dipilih otomatis
>    berdasarkan *qualifier* deal, bukan satu alur tunggal. Urutan
>    pengisi cost line dikoreksi: Sales Officer → VP Operations → VP
>    Finance → Chief Sales.
> 8. **Margin-Tier Discount Authority** (§11) — `discount_authority`
>    diganti dari tangga persentase diskon menjadi tangga **GPM akhir**
>    (Tier 1 Auto / Tier 2 3-Pihak / Tier 3 2-BOD); input diskon
>    mendukung Rupiah maupun persentase.
> 9. **Project/Customer Identifier & Versioning** (§4.6, baru) — quotation
>    revisi untuk deal yang sama ter-*link* ke satu identifier, dengan
>    quotation lama otomatis `SUPERSEDED`.
> 10. **Rate Sensitivity Threshold** (§12.5, baru) — exchange rate ditarik
>     otomatis mingguan; perubahan harga hanya dipicu bila pergerakan
>     kurs melebihi ambang persentase, dan tetap memerlukan aksi
>     eksplisit "Hitung Ulang".
> 11. **Mineral Index disederhanakan** (§13) — HPM dikonfirmasi berdampak
>     ke harga VKTR hanya melalui kurs; faktor adjustment independen
>     (v2.1) dicabut dari jalur aktif, dipertahankan sebagai referensi.
> 12. **Duplicate/Fraud Guard** (§4.7, baru) — satu Sales Officer dibatasi
>     satu quotation baru per hari untuk kombinasi customer + tipe unit.
> 13. **Product Master Data & Quotation PDF Template** (§2.1, baru) —
>     entitas baru untuk aktor Product Owner.
> 14. **Basis kurs dikoreksi dari USD ke CNY/RMB** (§2.1, §12) — diskusi
>     *rate sensitivity threshold* pada demo review eksplisit membahas
>     **RMB** (kurs ilustratif Rp 2.500–2.700/RMB), konsisten dengan FOB
>     Price komponen impor VKTR yang dikutip vendor **dalam CNY** (BOM
>     bersumber dari Cina). Seluruh entitas dan pseudocode `exchange_rate`,
>     Multi-Currency Engine (§12), dan pipeline formula (§3) diganti dari
>     basis `USD→IDR` menjadi `CNY→IDR`.
>
> **Perubahan v4.0** (mengikuti PRD v4.0 — sumber:
> `BTEL - Cost and Roles and Flow.xlsx` dan contoh dokumen
> `Cost Estimate - PT Siborong Nusa Gemilang 20260906.pdf`):
> 15. **Role menjadi data, bukan enum** (§2.1 `app_role`,
>     `functional_role`, `user_role_assignment`; §8) — role sheet
>     *Actors* dikelola lewat Settings (PRD FR-5.6). Enum `UserRole` v3.0
>     (7 nilai) digantikan.
> 16. **Scope Authority Matrix** (§2.1 `scope_authority`, §4.8) — role ×
>     scope × skenario (Regular/Deviation) × Maker/Checker/Releaser.
> 17. **Cost Structure per varian berversi** (§2.1
>     `cost_structure_version`, `cost_structure_scope_state`) — dirilis
>     per scope lewat Maker→Checker→Releaser; quotation mengunci versi
>     yang dipakainya. Menggantikan pengisian cost line per quotation
>     secara berurutan (VP Operations → VP Finance).
> 18. **Koreksi cost group**: STNK & Insurance = `ADD_ONS`, bukan
>     `SALES` (§2.1). Kepemilikan scope terkonfirmasi (menutup §14 no. 12
>     v3.0).
> 19. **State machine Official Quotation baru** (§4.0, §4.1) — KYC →
>     validasi Sales Lead (dapat dilewati) → Sales Operations *generate*
>     (quantity band, §4.10) → Head of Sales → routing tier margin →
>     rilis. Persetujuan tier **menjadi bagian state machine quotation**;
>     state machine negosiasi terpisah v3.0 dilebur (§11).
> 20. **Tier margin 15% / 10%**, approver COGS+Profitability Owner /
>     CCO+CFO, tembusan, tolak → Sales Operations (§11.1).
> 21. **KYC** (§2.1 `customer_kyc`), **multi-line item** (§2.1
>     `quotation_line_item`), **Price Estimate** (§4.9), **quantity
>     band** (§4.10), **PPN** (§2.1 `tax_rate`, §3), **skema
>     Purchase/Rental** (§3.5), **masa berlaku & penomoran** (§4.11).
> 22. **Release gate**: item `may_follow_later` boleh dirilis sebagai
>     *Exclusion — At cost* eksplisit (§4.2.1).
> 23. **Dokumen, preview & cetak** (§4.12) — template "Cost Estimate",
>     render dari *snapshot*, watermark draft, Print/Download PDF.
> 24. **Workflow step dapat dikonfigurasi penuh** (§2.1
>     `workflow_step_definition`, §4.1a) — role pelaksana, jenis aksi,
>     kondisi lewati, tujuan tolak, cc.
> 25. **Menu & data access per role** (§8.4, §8.5) — matriks menu →
>     fungsi (`app_setting.menu_access`), menu di luar matriks disembunyikan
>     dan halamannya 404; quotation dibatasi per baris.
> 26. **Workflow Template Catalog multi-template** (§2.1, §4.1a, §11.1 —
>     v4.1) — qualifier statis per template, pemilihan berdasar
>     prioritas → spesifisitas, tier margin per template, katalog awal 6
>     template; target ±30 template (transcribe.md).

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Client (Web SPA)                             │
│   Spreadsheet-like Grid UI · Kanban Board · Slider-based DSS UI     │
└───────────────────────────────┬───────────────────────────────────┘
                                 │ REST/GraphQL (JWT + RBAC claims)
┌───────────────────────────────▼───────────────────────────────────┐
│                          API Gateway Layer                          │
│         AuthN/AuthZ · Rate Limiting · Request Validation            │
└───────────────────────────────┬───────────────────────────────────┘
        ┌────────────┬──────────┼───────────┬───────────────┐
        ▼            ▼          ▼           ▼               ▼
 ┌───────────┐ ┌───────────┐ ┌────────┐ ┌──────────┐ ┌─────────────┐
 │ Master    │ │ Pricing   │ │Workflow│ │   DSS/   │ │Notification │
 │ Data Svc  │ │ Engine    │ │ Engine │ │Simulation│ │  Service     │
 │ (CBS,     │ │ (Formula, │ │(State  │ │  Engine  │ │(Email/Teams/ │
 │ Template) │ │ Calc,     │ │Machine)│ │          │ │  WhatsApp)   │
 │           │ │ Versioning│ │        │ │          │ │              │
 └─────┬─────┘ └─────┬─────┘ └───┬────┘ └────┬─────┘ └──────┬──────┘
       │             │            │           │              │
       └─────────────┴─────┬──────┴───────────┴──────────────┘
                            ▼
                 ┌───────────────────────┐
                 │   Core Database        │
                 │ (PostgreSQL, ACID)     │
                 │ + Audit Log (append)   │
                 │ + Event Outbox         │
                 └──────────┬────────────┘
                            │ CDC / Scheduled Sync / Webhook
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ ERP (SAP/│  │ CRM      │  │ FX/Comm-  │
        │  Odoo)   │  │(Salesforce│ │odity Rate │
        │          │  │/HubSpot) │  │ Provider  │
        └──────────┘  └──────────┘  └──────────┘
```

**Prinsip desain kunci:**

1. **API-first & event-driven** — semua integrasi eksternal lewat kontrak API eksplisit + *outbox pattern* agar sinkronisasi ERP/CRM tidak memblokir transaksi utama.
2. **Config-over-code** — struktur CBS, formula, dan workflow disimpan sebagai data (JSON/DSL) di database, bukan *hardcoded* di aplikasi, agar Admin bisa mengubah tanpa deploy ulang (FR-1.2, FR-2.1).
3. **Append-only audit** — tabel transaksi inti tidak pernah di-*UPDATE* untuk field bernilai finansial; setiap perubahan menghasilkan baris baru (event sourcing ringan) demi *Immutable Audit Trail* (FR-3.3).
4. **State machine eksplisit** — status pricing proposal dikelola oleh mesin status terpusat, bukan tersebar sebagai flag di banyak tempat, untuk menjamin *strict gatekeeping* (FR-2.2).

---

## 2. Core Data Model (Conceptual ERD)

> **Revisi v4.0.** Tiga pergeseran utama: (1) **role dan wewenang
> menjadi data** yang diatur lewat Settings — bukan enum di kode;
> (2) **biaya dipelihara per varian produk** sebagai
> `cost_structure_version` yang dirilis per scope lewat
> Maker→Checker→Releaser, lalu dikunci oleh quotation; (3) **quotation
> berisi KYC dan banyak line item**, dengan persetujuan tier margin
> sebagai langkah di state machine quotation itu sendiri.

```
Organization ──< Department ──< User ──< UserRoleAssignment >── AppRole
                                                                   │
                                          FunctionalRole ──<───────┘
                                          (SALESPERSON, COGS_OWNER, PROFITABILITY_OWNER,
                                           SALES_PRICING_OWNER, PRICING_COMMITTEE, ...)

ScopeAuthority (app_role × scope × scenario × can_make/can_check/can_release)
SegregationRule (per scope: maker≠checker, checker≠releaser)

CostItem (master, scope: COGS / ADD_ONS / PROFITABILITY / SALES)
    │
ProductVariant (Product Master Data: make/model/type/variant, spec pages,
    │           default inclusions/exclusions, loco)
    ▼
CostStructureVersion (per varian, v1, v2, …; locked_fx_rate, tax_rate)
    ├─< CostStructureLine (nilai per CostItem)
    └─< CostStructureScopeState (per scope: DRAFT → MADE → CHECKED → RELEASED,
                                  maker_id, checker_id, releaser_id)

ProjectIdentifier (customer + proyek/lokasi)
    │
CustomerKyc (per customer; disalin sebagai snapshot ke quotation)
    │
PricingProposal (Official Quotation)
    ├─ kyc_snapshot, initiator_role, quantity_band, processing_mode,
    │  valid_until, document_number, current_status
    ├─< QuotationLineItem (varian, qty, skema Purchase/Rental, tenor,
    │     cost_structure_version_id terkunci, diskon, harga excl/incl VAT, GM)
    ├─< QuotationCostOverride (penyimpangan per deal, per scope → M/C/R)
    ├─< PricingProposalVersion (snapshot hasil kalkulasi & dokumen)
    ├─< WorkflowInstance ──< WorkflowStepInstance ──< ApprovalAction
    │         └─> WorkflowDefinition (katalog; langkah configurable)
    ├─< TierApproval (baris per approver tier + cc, bagian state machine)
    ├─< CustomerRequest (permintaan revisi pasca-rilis → quotation revisi)
    ├─< DocumentRender (PRINT / DOWNLOAD_PDF, template_version, hash)
    └─< AuditLogEntry

PriceEstimateLog (user, varian, harga excl/incl VAT, cost_structure_version)

MarginTierAuthority (tier → ambang GM, approver functional roles, cc roles,
                     reject_target)
QuantityBandConfig (min_qty, max_qty, mode, default_discount_pct)
TaxRate (PPN, effective_from)
QuotationDocumentTemplate (layout, judul, pola nomor, masa berlaku default)

ExchangeRate (CNY→IDR, bank-api|manual) ──> dikunci ke CostStructureVersion
    └─> RateSensitivityCheck (banner; tidak auto-recalculate)
MineralIndexSnapshot / HpmParameter (referensi saja — §13)
```

### 2.1 Tabel Inti (ringkas)

**`app_role`**, **`functional_role`**, **`user_role_assignment`** (PRD FR-5.6 — **baru v4.0, menggantikan enum `UserRole`**)

> Role sheet *Actors* dikelola sebagai data lewat **Settings → Roles &
> Authorities**. Kode aplikasi **tidak pernah** membandingkan nama role
> spesifik (mis. `role === 'HEAD_OF_SALES'`); ia membaca
> `functional_role` dan `scope_authority`, sehingga role baru dapat
> ditambah tanpa rilis ulang.

| Tabel | Kolom | Keterangan |
|---|---|---|
| `functional_role` | code (PK), name | Tetap (seed): `SALESPERSON`, `SALES_VALIDATOR`, `SALES_OPERATIONS`, `SALES_RELEASER`, `COGS_OWNER`, `PROFITABILITY_OWNER`, `SALES_PRICING_OWNER`, `PRICING_COMMITTEE`, `PRODUCT_OWNER`, `EXTERNAL_AGENCY`, `SYSTEM_ADMIN` — "slot" yang dirujuk logika |
| `app_role` | id, code unique, name, is_external, is_active, created_by/at | Diatur Admin. Seed dari sheet *Actors*: Sales Executive, Sales Lead, Sales Operations Manager, Head of Sales, Procurement Manager, Head of Procurement and Operations Control, Head of Corporate Finance, Chief Commercial Officer, Chief Finance Officer, Authorized Agency, Product Owner, System Admin |
| `app_role_functional_role` | app_role_id, functional_role_code | Satu role dapat mengisi beberapa slot (mis. Head of Sales = `SALES_RELEASER` + `SALES_PRICING_OWNER`) |
| `user_role_assignment` | user_id, app_role_id, valid_from, valid_to | Satu user dapat memegang >1 role; `valid_to` untuk akun agensi |

Seed pemetaan role → slot fungsional:

| app_role | functional_role |
|---|---|
| Sales Executive | `SALESPERSON` |
| Sales Lead | `SALESPERSON`, `SALES_VALIDATOR` |
| Sales Operations Manager | `SALES_OPERATIONS`, `SALES_PRICING_OWNER` |
| Head of Sales | `SALES_RELEASER`, `SALES_PRICING_OWNER` |
| Procurement Manager | `COGS_OWNER` |
| Head of Procurement and Operations Control | `COGS_OWNER` |
| Head of Corporate Finance | `PROFITABILITY_OWNER` |
| Chief Commercial Officer | `PRICING_COMMITTEE` |
| Chief Finance Officer | `PRICING_COMMITTEE` |
| Authorized Agency | `EXTERNAL_AGENCY` |
| Product Owner | `PRODUCT_OWNER` |
| System Admin | `SYSTEM_ADMIN` |

**`scope_authority`** (PRD FR-1.1.2, FR-1.1.3, FR-5.6 — **baru**, bentuk identik sheet *Actors*)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| app_role_id | FK app_role | |
| scope | enum | `COGS`, `ADD_ONS`, `MARGIN` (= `cost_group PROFITABILITY`), `SALES` |
| scenario | enum | `REGULAR` (GM ≥ ambang), `DEVIATION` (GM < ambang) |
| can_make / can_check / can_release | boolean | Centang Maker / Checker / Releaser |
| config_version | int | Setiap simpan membuat versi baru (audit) |

Seed (sheet *Actors*) — `✓✓✓` = Maker, Checker, Releaser:

| app_role | COGS | ADD_ONS | MARGIN | SALES | Skenario |
|---|---|---|---|---|---|
| Head of Procurement and Operations Control | ✓✓✓ | ✓✓✓ | – | – | Regular & Deviation |
| Procurement Manager | ✓✓✓ | ✓✓✓ | – | – | Regular & Deviation |
| Head of Corporate Finance | – | – | ✓✓✓ | – | Regular & Deviation |
| Head of Sales | – | – | – | ✓✓✓ | Regular & Deviation |
| Sales Operations Manager | – | – | – | ✓✓✓ | Regular & Deviation |
| Chief Commercial Officer | ✓✓✓ | ✓✓✓ | ✓✓✓ | ✓✓✓ | **Deviation saja** |
| Chief Finance Officer | ✓✓✓ | ✓✓✓ | ✓✓✓ | ✓✓✓ | **Deviation saja** |

**`scope_segregation_rule`** (FR-1.1.2): scope, `maker_ne_checker` (default `true`), `checker_ne_releaser` (default `false`), `allow_single_actor_when_only_one_holder` (default `true`, menandai audit `SINGLE_ACTOR_RELEASE`). Konfigurasi ini menjawab kasus scope `MARGIN` yang hanya dipegang satu role — **perlu konfirmasi VKTR** (§14).

**`app_setting` key `menu_access`** (PRD FR-5.7 — **baru**): JSON
`{ menu_key: FunctionalRole[] }` yang menimpa default di kode
(`src/lib/menuAccess.ts`). Menu `settings` tidak pernah dibaca dari sini
(terkunci `SYSTEM_ADMIN`).

**`scenario_config`**: `deviation_gm_threshold_pct` (default `10.00`) — ambang pemisah Regular/Deviation, sama dengan batas Tier 2/Tier 3 (§11.1).

**`cost_item`** (Master Cost Item — FR-1.1, **kepemilikan terkonfirmasi v4.0**)

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| code | varchar unique | e.g. `COGS-FOB-CNY`, `ADDON-STNK`, `SALES-AGENCY-FEE` |
| name | varchar | e.g. `FOB Price in CNY`, `STNK`, `Agency Fee` |
| cost_group | enum | **`COGS`**, **`ADD_ONS`**, **`PROFITABILITY`**, **`SALES`** — sekaligus menjadi `scope` Maker/Checker/Releaser (`PROFITABILITY` ↔ scope `MARGIN`) |
| category | enum | `DIRECT`, `INDIRECT` — pelaporan Finance, independen dari `cost_group` |
| owner_department_id | FK Department | **dihapus dari peran gatekeeping v4.0** — kepemilikan kini dibaca dari `scope_authority` berdasarkan `cost_group`; kolom boleh dipertahankan sebagai label |
| unit_type | enum | `FIXED`, `PER_UNIT`, `PERCENTAGE`, `FORMULA` |
| denomination | enum | `CNY`, `IDR` |
| is_derived | boolean | **baru** — `true` untuk `FOB Price in IDR` (= FOB CNY × kurs terkunci), tidak dapat diinput |
| is_mandatory | boolean | gatekeeping rilis cost structure & quotation |
| may_follow_later | boolean | boleh kosong pada cost structure standar; di quotation wajib **bernilai atau** ditandai `EXCLUDED_AT_COST` (§4.2.1) |
| exclusion_label | varchar nullable | **baru** — teks di bagian *Exclusions* dokumen bila item dikecualikan, mis. `Delivery To Site` |
| active | boolean | soft-disable |

Isi per `cost_group` (sheet *Cost Structure*):

| cost_group | Item | Pemilik (via `scope_authority`) |
|---|---|---|
| `COGS` | FOB Price in CNY, FOB Price in IDR (*derived*), Freight and Insurance, Custom Duties, Port Handling & Clearance & PDI, Carrosserie Allocation, Assembly Cost, Local Parts, Accessories, Telematics, Warehousing and Storage, Warranty Cost, Initial Energy Injection, Administrative Cost | COGS Owner |
| `ADD_ONS` | **STNK**, KEUR, **Insurance**, Processing Service, Delivery Service (`may_follow_later`, `exclusion_label = 'Delivery To Site'`), Additional | COGS Owner |
| `PROFITABILITY` | VKTS Profit Before Tax, VKTS Margin, VKTR Profit Before Financing Cost, Financing Cost, VKTR Margin After Financing Cost | Profitability Owner |
| `SALES` | Incentive Internal, Incentive External, Sales Processing Cost, Agency Fee | Sales Pricing Owner |

> **Koreksi v4.0.** STNK dan Insurance sebelumnya ditulis di `SALES`
> (dan di-*seed* demikian pada migrasi `0013_v3_seed_reset.sql`). Kedua
> sheet sumber menempatkannya di `ADD_ONS`. Migrasi berikutnya harus
> memindahkan `cost_group`-nya; karena `ADD_ONS` masuk `base_cost`,
> **GM quotation yang ada akan turun** setelah koreksi (§3.3).

**`cost_structure_version`** (PRD FR-1.1.2 — **baru**, *price book* per varian)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| product_variant_id | FK product_master_data | |
| version_no | int | naik setiap perubahan |
| status | enum | `DRAFT` (ada scope belum rilis), `RELEASED` (keempat scope `RELEASED`), `RETIRED` (digantikan versi lebih baru) |
| locked_fx_rate_id / locked_fx_rate | FK exchange_rate / numeric | kurs CNY→IDR yang dikunci saat versi dibuat (FR-1.4.3) |
| tax_rate_id | FK tax_rate | PPN yang berlaku saat rilis |
| standard_gm_pct | numeric | GM harga dasar 1 unit (tanpa diskon) — dasar Price Estimate |
| released_at | timestamptz | saat scope terakhir dirilis |
| parent_version_id | FK nullable | untuk *diff* antar versi |

**`cost_structure_line`**: cost_structure_version_id, cost_item_id, value, denomination, is_excluded_at_cost (boolean). Immutable setelah scope pemiliknya `RELEASED`.

**`cost_structure_scope_state`** (M/C/R per scope per versi)
| Kolom | Tipe | Keterangan |
|---|---|---|
| cost_structure_version_id | FK | |
| scope | enum | `COGS`, `ADD_ONS`, `MARGIN`, `SALES` |
| status | enum | `DRAFT` → `MADE` → `CHECKED` → `RELEASED`; `RETURNED` (Checker/Releaser mengembalikan ke Maker) |
| scenario | enum | `REGULAR` / `DEVIATION` — dievaluasi dari `standard_gm_pct` saat submit |
| maker_id, made_at | | |
| checker_id, checked_at, check_note | | |
| releaser_id, released_at | | |
| single_actor_flag | boolean | `true` bila Maker = Checker = Releaser diizinkan oleh `scope_segregation_rule` |

**`cbs_template`** dan **`cbs_template_node`** (FR-1.1, FR-1.3 — **efektif tunggal v3.0**)
- `cbs_template`: id, name, version, status (`draft`/`active`/`archived`). **Kolom `business_line` v2.1 dihapus** dari peran "memilih CBS berbeda" — CBS kini satu untuk semua lini bisnis. Bila kolom dipertahankan secara teknis untuk kompatibilitas, nilainya harus selalu sama di semua baris aktif (guard di service layer).
- `cbs_template_node`: id, template_id, parent_node_id (nullable, self-referencing → membentuk *tree*), cost_item_id (nullable jika node adalah grouping oleh `cost_group`), sort_order, default_formula_id.

**`formula_definition`** (FR-1.2 — **satu formula dasar v3.0**)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| scope | enum | `GLOBAL` (default v3.0) atau `BUSINESS_LINE` (disediakan untuk fase lanjutan bila ditemukan lini bisnis dengan struktur harga benar-benar berbeda — lihat PRD FR-1.2) |
| expression | text | DSL ekspresi, lihat §3 |
| input_variables | jsonb | daftar variabel yang dibutuhkan (cost items, FX rate, dll) |
| version | int | |
| created_by / created_at | | untuk audit |

**`product_master_data`** (FR-1.5.1 — dikelola Product Owner, **atribut varian v4.0**)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| code | varchar unique | e.g. `LDT-4X2-SWB-DMP-90-CKD-MGL` |
| make, model, type, variant | varchar | hierarki pemilihan Basic Workflow ("make model type variants"); mis. VKTR / Light Duty Truck / 4x2 Short Wheelbase / Dumper 90 kWh |
| wheelbase | enum | `SHORT`, `MEDIUM`, … |
| battery_kwh | numeric | 90 / 132 / 169 |
| body_application | varchar | Dump, Aluminium & Steel Box, Load Bak, Compactor, Manhaul, Flat Bed, Refrigerated Box, Tanker, Arm Roll |
| build_type | enum | `CKD`, `CBU` |
| loco | varchar | titik penyerahan harga, mis. `Magelang` |
| document_description | text | teks baris *Product*/*Description* di dokumen |
| spec_sheet | jsonb | tabel spesifikasi terstruktur (dimensi, baterai, performa, berat, rangka, charging, motor, PTO, axle, suspensi, rem, kabin) |
| spec_pages | text[] | gambar halaman *Specification* (brosur, *multi body application*, gambar sasis) — dicetak setelah halaman 1 |
| default_inclusions / default_exclusions | text[] | mis. `Onsite training 2 weeks` / `Maintenance`, `Other Requests` |
| status | enum | `ACTIVE`, `DISCONTINUED` |

**`quotation_document_template`** (FR-1.5.3, FR-1.5.4 — **struktur dari contoh "Cost Estimate"**)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| name, version, is_active | | |
| applies_to | jsonb nullable | scoping per lini bisnis / skema (`PURCHASE`/`RENTAL`) |
| document_title | varchar | contoh: `COST ESTIMATE` |
| issuer_block | jsonb | nama, alamat, logo penerbit |
| number_pattern | varchar | contoh `{seq:4}/L/VKTR/{scheme_code}-{unit_code}/{MM}-{YYYY}` → `0001/L/VKTR/RNT-EFS/09-2026`; arti segmen perlu konfirmasi (§14) |
| validity_days | int | default `30` |
| disclaimer_text | text | teks kerahasiaan |
| default_special_notes | text[] | mis. "Cost Estimate is not binding, the actual pricing to be confirmed post assessment" |
| acceptance_block | boolean | cetak blok "sign here and return" (Name, Title, Date) |
| price_display | enum | `INCL_VAT` (contoh), `EXCL_VAT`, `BOTH` |
| rounding_rule | jsonb | pembulatan per unit & total (total dari nilai belum dibulatkan) |
| layout_schema | jsonb | urutan bagian: header → To/Disclaimer → Sales/Product/Prepared By → tabel item → Inclusions → Exclusions → Kontak/Total → Special Notes → Penerimaan → Specification pages |

**`project_identifier`** (FR-2.5)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| identifier_code | varchar unique | *generated* sistem |
| customer_name | varchar | |
| project_name | varchar | nama proyek/lokasi |
| created_by, created_at | | |

**`customer_kyc`** (PRD FR-7.1 — **baru v4.0, Module 7 masuk scope**)
| Kolom | Tipe | Wajib | Field KYC |
|---|---|---|---|
| id | uuid PK | | |
| company_name | varchar | ✓ | a |
| official_address | text | ✓ | a |
| project_type | enum `NEW_PROJECT`, `ADDITIONAL_RUNNING_PROJECT`, `REPLACEMENT` | | c |
| application_body | varchar | ✓ | d — aplikasi (bodi) |
| utilization_content | varchar | ✓ | d — utilisasi (muatan) |
| route_description | text | ✓ | e |
| origin, destination | varchar | ✓ | e |
| production_value, production_unit, production_period | numeric, varchar, enum `TRIP`/`CYCLE`/`DAY`/`MONTH`/`OTHER` | ✓ | e |
| likelihood | smallint 1–5 | ✓ | f — 5 High, 4 Medium to High, 3 Medium, 2 Medium to Low, 1 Low |
| gap_identified | text | ✓ | g |
| other_information | text | | h — termasuk skema diminta & metode pembayaran |
| updated_by, updated_at | | | |

Field b (varian & qty) disimpan sebagai `quotation_line_item`. Saat
submit, isi `customer_kyc` disalin ke `pricing_proposal.kyc_snapshot`
(jsonb) sehingga dokumen & audit tidak berubah bila KYC customer diedit
kemudian.

**`pricing_proposal`** (root Official Quotation — **direvisi v4.0**)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| proposal_number | varchar unique | nomor internal, mis. `PRC-2026-0042` |
| document_number | varchar nullable unique | **baru** — nomor dokumen resmi dari `number_pattern`, diisi saat `QUOTATION_RELEASED` |
| project_identifier_id | FK | FR-2.5 |
| customer_kyc_id / kyc_snapshot | FK / jsonb | **baru** |
| business_line | varchar | qualifier pemilihan Workflow Template |
| initiator_id, initiator_app_role_id | FK | **baru** — dasar kondisi lewati validasi Sales Lead |
| account_person_ids | uuid[] | **baru** — *Sales/Account Person* di dokumen (≥ 1) |
| prepared_by | FK user nullable | **baru** — Sales Operations yang *generate* |
| quantity_band | smallint | **baru** — band efektif quotation (§4.10) |
| processing_mode | enum `AUTO`, `AUTO_WITH_MANUAL`, `MANUAL` | **baru** |
| scenario | enum `REGULAR`, `DEVIATION` | **baru** — dari GM akhir |
| margin_tier | smallint | **baru** — 1/2/3 hasil `resolveMarginTier` terakhir |
| current_status | enum | lihat §4.1 |
| supersedes_proposal_id | FK nullable | FR-2.5 |
| released_at, valid_until | timestamptz / date | **baru** — FR-2.9 |
| special_notes, inclusions, exclusions | text[] | **baru** — *default* dari varian & template, dapat diubah Sales Operations/Head of Sales |
| outcome | enum `PENDING`, `WON`, `LOST`, `CANCELLED` | FR-2.10 |
| accepted_document_url | text nullable | salinan bertanda tangan pelanggan |
| transaction_value | numeric | total excl. VAT |
| created_by, created_at | | Duplicate/Fraud Guard (§4.7) |

**`quotation_line_item`** (KYC b, FR-1.7 — **baru**, menggantikan satu `product_master_data_id` per proposal)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| proposal_id | FK | |
| product_variant_id | FK product_master_data | |
| quantity | int | |
| cost_structure_version_id | FK | **dikunci** saat *generate*; tidak berubah kecuali "Hitung Ulang" eksplisit |
| scheme | enum `PURCHASE`, `RENTAL` | |
| rental_tenor_months | int nullable | mis. `60` |
| list_price_ex_vat | numeric(18,2) | per unit, sebelum diskon |
| discount_input_mode | enum `AMOUNT`, `PERCENTAGE` | FR-6.1.1 |
| discount_amount / discount_pct | numeric | keduanya disimpan |
| discount_source | enum `BAND_DEFAULT`, `SALES_OPS_MANUAL`, `HEAD_OF_SALES_REVISE` | |
| net_price_ex_vat, net_price_incl_vat | numeric(18,2) | per unit |
| rental_monthly_incl_vat | numeric(18,2) nullable | skema Rental; manual sampai formula dikonfirmasi (§3.5) |
| line_total_ex_vat, line_total_incl_vat | numeric(18,2) | dari nilai per unit **sebelum** pembulatan |
| gm_pct | numeric(8,5) | GM line (§3.3) |

**`quotation_cost_override`** (FR-1.1.3 — **baru**, penyimpangan per deal)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| line_item_id | FK | |
| cost_item_id | FK | |
| standard_value / override_value | numeric | nilai *price book* vs nilai deal |
| is_excluded_at_cost | boolean | untuk item `may_follow_later` (§4.2.1) |
| scope | enum | turunan dari `cost_item.cost_group` |
| status, maker_id, checker_id, releaser_id (+ timestamp) | | siklus M/C/R sama seperti §4.8, wewenang dibaca dengan `scenario` quotation |

**`pricing_proposal_version`** (snapshot)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| proposal_id | FK | |
| version_label | varchar | `v1.0`, `v1.1` — versi naik setiap *generate*/revise/Hitung Ulang |
| line_items_snapshot | jsonb | seluruh line item, override, diskon |
| calculation_result | jsonb | per line & total: base cost, margin, sales, list, diskon, net excl/incl VAT, GM, tier, kurs, PPN |
| document_snapshot | jsonb | data render dokumen (§4.12) |
| created_by, created_at, change_reason | | |

**`workflow_definition`** & **`workflow_step_definition`** (FR-2.0.1, FR-2.1 — **langkah configurable penuh v4.0**)
- `workflow_definition`: id, template_name (`"Price Estimate"`, `"Official Quotation — Standard"`, …), workflow_kind (`PRICE_ESTIMATE`, `OFFICIAL_QUOTATION`), qualifier (business_line, min_value, max_value — nullable), is_active, version.
- `workflow_step_definition`:

  | Kolom | Tipe | Keterangan |
  |---|---|---|
  | id, workflow_definition_id, step_order | | |
  | step_name | varchar | mis. "Validasi Sales Lead" |
  | action_kind | enum | `FILL_KYC`, `VALIDATE`, `GENERATE_QUOTATION`, `REVIEW_AND_ROUTE`, `APPROVE` |
  | performer_functional_role | FK functional_role | siapa yang boleh bertindak (bukan nama role spesifik) |
  | skip_condition | jsonb nullable | mis. `{"initiator_has_functional_role": "SALES_VALIDATOR"}` → step `SKIPPED_NOT_APPLICABLE` |
  | reject_target_step_order | int nullable | tujuan bila ditolak; `null` = kembali ke inisiator (`DRAFT`) |
  | proposal_status_on_enter | enum | status proposal saat step aktif (§4.1) |
  | mode, parallel_group_id | | `SEQUENTIAL` / `PARALLEL_GROUP` |
  | cc_functional_roles | jsonb | penerima tembusan |
  | sla_hours | int | |

- Seed "Official Quotation — Standard" (sheet *Basic Workflow* B):

  | step_order | step_name | action_kind | performer | skip_condition | reject_target | status |
  |---|---|---|---|---|---|---|
  | 1 | Isi KYC & submit | `FILL_KYC` | `SALESPERSON` | – | – | `DRAFT` |
  | 2 | Validasi Sales Lead | `VALIDATE` | `SALES_VALIDATOR` | initiator punya `SALES_VALIDATOR` | 1 | `PENDING_SALES_LEAD_VALIDATION` |
  | 3 | Generate Official Quotation | `GENERATE_QUOTATION` | `SALES_OPERATIONS` | – (band 1 auto-selesai, §4.10) | – | `PENDING_SALES_OPERATIONS` |
  | 4 | Review & rilis/rute | `REVIEW_AND_ROUTE` | `SALES_RELEASER` | – | 3 | `PENDING_HEAD_OF_SALES_REVIEW` |

  Langkah approval tier **tidak** disimpan di template — disisipkan
  dinamis setelah step `REVIEW_AND_ROUTE` dari `margin_tier_authority`
  (§11.2).
- **Kolom katalog v4.1 (migrasi 0017)** pada `workflow_definition`:

  | Kolom | Keterangan |
  |---|---|
  | `template_code` | Kode stabil template; semua versi berbagi kode ini, hanya satu versi `is_active` |
  | `description`, `priority` | Prioritas lebih tinggi menang saat lebih dari satu template cocok |
  | `q_segments`, `q_industries`, `q_relationships`, `q_business_lines` | `text[]`; kosong = semua |
  | `q_min_qty`, `q_max_qty` | Rentang kuantitas total (null = tanpa batas) |
  | `min_value`, `max_value` | Rentang **estimasi nilai** (harga dasar × qty, excl. VAT) |
  | `q_blacklist` | `null` semua · `true` hanya customer blacklist · `false` hanya non-blacklist |
  | `is_fallback` | Template dasar, dipakai bila tidak ada yang cocok; tidak dapat dinonaktifkan |

  `pricing_proposal` menambah `workflow_template_code`,
  `workflow_selection_reason`, `estimated_value`, `is_blacklisted`;
  qualifier deal (`customer_segment`, `industry`, `relationship`)
  disimpan di `kyc` (jsonb). `margin_tier_authority` menambah
  `workflow_template_code` (tangga tier per template). Daftar nilai
  qualifier & blacklist: `app_setting` `qualifier_segments`,
  `qualifier_industries`, `qualifier_relationships`, `customer_blacklist`.
- Seed "Price Estimate": **tanpa step approval**. Baris `workflow_definition` dengan `workflow_kind = PRICE_ESTIMATE` hanya menyimpan slot yang berhak (`SALESPERSON`, `EXTERNAL_AGENCY`) dan aturan varian yang tampil (§4.9), agar keduanya dapat diatur dari Settings.

**`workflow_instance`** & **`workflow_step_instance`**
- `workflow_instance`: id, proposal_version_id, workflow_definition_id (snapshot reference), status, current_step_order.
- `workflow_step_instance`: id, workflow_instance_id, step_definition_id, status (`PENDING`,`IN_PROGRESS`,`APPROVED`,`APPROVED_WITH_CONDITIONS`,`REJECTED`,`SKIPPED_NOT_APPLICABLE`), started_at, sla_due_at, completed_at, actor_id, decision_note.

**`audit_log_entry`** (FR-3.3, append-only, no update/delete permission at DB role level)
| Kolom | Tipe |
|---|---|
| id | uuid PK |
| entity_type | varchar (`proposal_version`, `cbs_template`, `workflow_definition`, ...) |
| entity_id | uuid |
| actor_id | FK User |
| action | varchar (`CREATE`,`UPDATE`,`SUBMIT`,`APPROVE`,`REJECT`,`ESCALATE`,`SYNC`; v4.0: `MAKE`,`CHECK`,`RELEASE`,`RETURN`,`STEP_SKIPPED`,`TIER_ROUTE`,`TIER_CC`,`EXPIRE`,`PRINT`,`DOWNLOAD_PDF`,`SETTINGS_CHANGE`) |
| field_changes | jsonb (`{field, old_value, new_value}[]`) |
| reason | text nullable |
| supporting_doc_url | text nullable |
| created_at | timestamptz |

**`external_rate_snapshot`** (FX & komoditas — FR-1.2, FR-4.1)
| Kolom | Tipe |
|---|---|
| id | uuid PK |
| rate_type | enum (**`FX_CNY_IDR`** — basis utama, dipakai kalkulasi COGS; `FX_USD_IDR` — opsional, hanya untuk toggle tampilan quotation ke customer; `COMMODITY_LITHIUM`, ...) |
| value | numeric |
| source | varchar |
| effective_at | timestamptz |

**`margin_tier_authority`** (FR-6.1 — **direvisi v4.0**: 15%/10%, approver per slot fungsional, tembusan, tujuan tolak)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| tier | int | `1`, `2`, `3` |
| business_line | enum nullable | `null` = semua lini bisnis |
| gpm_lower_bound_pct / gpm_upper_bound_pct | numeric(6,4) nullable | batas GM (setelah diskon, excl. VAT) |
| decision_functional_roles | jsonb | slot yang **wajib** memutus (AND-join antar slot); satu persetujuan per slot |
| cc_functional_roles | jsonb | penerima tembusan (informasi, bukan persetujuan) |
| reject_target | enum | `SALES_OPERATIONS` (seed) |
| scenario | enum | `REGULAR` / `DEVIATION` — menentukan matriks wewenang yang berlaku untuk penyimpangan (§4.8) |
| is_active, config_version | | diatur lewat Settings (PRD FR-2.1) |

Seed (sheet *Basic Workflow* langkah 7):

| tier | lower | upper | decision_functional_roles | cc_functional_roles | scenario |
|---|---|---|---|---|---|
| 1 | 15.00 | – | `["SALES_RELEASER"]` (Head of Sales merilis) | `[]` | REGULAR |
| 2 | 10.00 | 15.00 | `["COGS_OWNER", "PROFITABILITY_OWNER"]` | `[]` | REGULAR |
| 3 | – | 10.00 | `["PRICING_COMMITTEE#CCO", "PRICING_COMMITTEE#CFO"]` — dua orang berbeda, masing-masing dari role CCO dan CFO | `["COGS_OWNER", "PROFITABILITY_OWNER"]` | DEVIATION |

> Kolom `allow_bod_delegation` dan `required_roles = [BOD, BOD]` v3.0
> **dihapus**. Notasi `SLOT#ROLE` pada Tier 3 menyatakan bahwa kedua
> persetujuan harus datang dari role berbeda di dalam slot yang sama
> (CCO **dan** CFO), bukan dua user sembarang dari slot tersebut.

**`tier_approval`** (**baru** — menggantikan `negotiation_decision` sebagai jejak persetujuan tier)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| proposal_id, proposal_version_id | FK | persetujuan melekat pada versi — perubahan diskon/cost line membuat versi baru dan membatalkan persetujuan lama |
| tier | int | |
| slot | varchar | mis. `COGS_OWNER`, `PRICING_COMMITTEE#CFO` |
| kind | enum | `DECISION`, `CC` |
| actor_id | FK nullable | terisi saat diputus |
| decision | enum nullable | `APPROVE`, `REJECT` |
| note | text | |
| notified_at, decided_at | timestamptz | |

**`quantity_band_config`** (FR-2.8 — **baru**, diatur lewat Settings dengan Maker/Checker/Releaser scope `SALES`)
| band | min_qty | max_qty | processing_mode | default_discount_pct |
|---|---|---|---|---|
| 1 | 1 | 1 | `AUTO` | `0` (harga dasar) |
| 2 | 2 | 5 | `AUTO_WITH_MANUAL` | *(konfirmasi VKTR; demo: 2%)* |
| 3 | 6 | 9 | `AUTO_WITH_MANUAL` | *(konfirmasi VKTR; demo: 3%)* |
| 4 | 10 | – | `MANUAL` | – |

**`tax_rate`** (FR-1.6 — **baru**): id, tax_code (`PPN`), rate_pct, taxable_base_factor (untuk tarif efektif, mis. DPP nilai lain), effective_from, source_regulation. Tidak di-*update in place*.

**`price_estimate_log`** (FR-2.7 — **baru**): id, user_id, is_external, product_variant_id, cost_structure_version_id, price_ex_vat, price_incl_vat, created_at.

**`customer_request`** (FR-6.3 — **menggantikan `negotiation_request` v3.0**): id, proposal_id, project_identifier_id, request_kind (`DISCOUNT`, `QUANTITY_CHANGE`, `SCHEME_CHANGE`, `RENEWAL`, `OTHER`), requested_discount_amount/pct (nullable, informasi dari pelanggan), note, requested_by, created_at, resulting_proposal_id (quotation revisi yang dibuat). Keputusan atas diskon **tidak** lagi di tabel ini — ia mengikuti langkah 3–4 + tier quotation revisi.

**`document_render`** (FR-1.5.4 — **baru**): id, proposal_version_id, template_id + template_version, render_kind (`PREVIEW`, `PRINT`, `DOWNLOAD_PDF`, `COST_STRUCTURE_SHEET`), watermark (`DRAFT`/`SUPERSEDED`/`EXPIRED`/none), content_hash, actor_id, created_at.

**`exchange_rate`** (FR-1.4.2 — master data nilai tukar, **basis CNY, sumber otomatis v3.0**)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| base_currency | enum | **`CNY`** (mata uang sumber utama, basis FOB Price — dikoreksi dari `USD` pada v2.1); `USD` tersedia sebagai baris terpisah hanya untuk toggle tampilan (FR-1.4.1) |
| quote_currency | enum | `IDR` (mata uang tujuan) |
| rate | numeric(18,4) | berapa IDR per 1 CNY (ilustrasi hasil rapat: kisaran Rp 2.500–2.700/RMB) |
| source | varchar | **`bank-api`** (default, ditarik otomatis mingguan — FR-1.4.2) atau `manual` (override Admin) |
| effective_from | timestamptz | awal masa berlaku |
| pulled_at | timestamptz nullable | **baru** — waktu tarik otomatis, untuk membedakan dari `effective_from` bila ada jeda |
| created_by / created_at | | `created_by` nullable bila `source = bank-api` (sistem, bukan user) |

> Kurs **tidak pernah di-*update in place***. Perubahan menghasilkan baris
> baru dengan `effective_from` lebih baru, sehingga quotation lama tetap
> dapat direkonstruksi memakai kurs yang berlaku saat itu (FR-1.4.3).

**`rate_sensitivity_config`** (FR-1.4.6 — baru, master config ambang notifikasi)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| threshold_pct | numeric(6,4) | ambang pergerakan kurs (mis. `0.02` = 2%) sebelum notifikasi dipicu |
| is_active | boolean | |

**`mineral_index_snapshot`** (FR-8.1 — HMA periodik, **referensi/transparansi saja pada v3.0**, lihat §13)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| mineral_code | varchar | `NI` (nikel), `CO` (kobalt), `LI` (lithium), … |
| hma_value | numeric(18,4) | **US$ per dmt** |
| period_start / period_end | date | periode berlaku (mingguan / dua mingguan) |
| regulation_ref | varchar | mis. `Kepmen ESDM No. 144.K/2026` |
| source | varchar | `esdm-publication`, `manual` |
| created_by / created_at | | |

**`hpm_parameter`** (FR-8.2 — parameter formula, *master config*)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| mineral_code | varchar | mineral yang diatur parameter ini |
| ni_content_pct | numeric(6,4) | kadar Ni yang dipakai (mis. `0.016` = 1,6%) |
| anchor_content_pct | numeric(6,4) | kadar *anchor*, default `0.016` |
| anchor_cf_pct | numeric(6,4) | CF pada anchor, default `0.30` |
| cf_slope | numeric(8,4) | perubahan CF per satuan kadar, default `10` |
| co_content_pct | numeric(6,4) | kadar kobalt tetap, mis. `0.001` |
| co_cf_pct | numeric(6,4) | CF kobalt, mis. `0.20` |
| moisture_content_pct | numeric(6,4) | kadar air, mis. `0.35` |
| is_active | boolean | |

> Seluruh angka pada formula HPM berada di tabel ini — **tidak ada
> konstanta di kode**. Ketika Kepmen berubah, yang diubah adalah data.

**Perubahan pada tabel yang sudah ada:**

`cost_item` — menambah penanda komponen berbahan mineral (**dipertahankan sebagai referensi, tidak aktif menjadi faktor pengali — lihat §13**):

| Kolom baru | Tipe | Keterangan |
|---|---|---|
| is_mineral_linked | boolean | `true` untuk item **FOB Price** (satu-satunya item kelompok `COGS` yang mengandung nilai battery pack — unit VKTR dibeli sebagai barang jadi dari BTEL, bukan dirakit dari sub-komponen terpisah di PriceCore). Pada v3.0 hanya dipakai untuk **tampilan referensi** (FR-8.4), bukan faktor pengali aktif |
| mineral_code | varchar nullable | mineral rujukan bila `is_mineral_linked` |

`pricing_proposal` — mata uang:

| Kolom baru | Tipe | Keterangan |
|---|---|---|
| input_currency | enum | `CNY` / `IDR` — mata uang seluruh cost line quotation ini (FR-1.4.1); `USD` tersedia terpisah hanya sebagai *display_currency* opsional untuk ringkasan ke customer |
| last_calculated_rate_id | FK → exchange_rate | **baru** — kurs yang dipakai pada kalkulasi terakhir; dibandingkan dengan kurs terbaru untuk RateSensitivityCheck (FR-1.4.6, §12.5) |

> Kolom `baseline_hpm_value`/`baseline_hpm_snapshot_id` pada v2.1
> **dihapus dari peran aktif** — HPM tidak lagi jadi baseline faktor
> pengali (§13). Bila skema sudah terlanjur memiliki kolom ini, cukup
> biarkan `null` dan jangan diisi oleh pipeline baru.

`proposal_calculation_result` — jejak reproducibility:

| Kolom baru | Tipe | Keterangan |
|---|---|---|
| exchange_rate_used | numeric(18,4) | kurs yang dipakai saat kalkulasi ini |
| exchange_rate_id | FK nullable | baris `exchange_rate` yang dirujuk |
| hpm_value_used | numeric(18,4) nullable | HPM periode berjalan saat kalkulasi — **disimpan untuk referensi/transparansi (FR-8.4), tidak memengaruhi hasil kalkulasi** |
| mineral_adjustment_factor | numeric(10,6) | **selalu `1.0` pada v3.0** (adjustment factor dicabut dari jalur aktif — §13); kolom dipertahankan untuk kompatibilitas skema |
| total_direct_cost_idr / total_direct_cost_usd | numeric | hasil dalam kedua mata uang (FR-1.4.4) |
| margin_tier | int | **baru** — tier (1/2/3) hasil evaluasi `resolveMarginTier` (§11.1), disimpan untuk audit meski quotation belum dinegosiasikan |

---

## 3. Formula Engine (FR-1.2 — Satu Formula Dasar untuk Semua Lini Bisnis)

### 3.1 Kebutuhan

> **Revisi v3.0.** Rumus dasar (COGS → margin → harga jual) **sama untuk
> seluruh lini bisnis** — bukan dikonfigurasi berbeda per lini bisnis
> seperti asumsi v2.0/v2.1. Formula harus tetap bisa diubah tanpa
> redeploy (mis. saat struktur cost_group berubah), mendukung referensi
> ke cost item, margin factor, dan variabel eksternal (FX), serta bisa
> disimulasikan langsung. Variasi harga antar lini bisnis dihasilkan
> oleh **Sales Add-On Cost** (kelompok `SALES` pada `cost_item`, PRD
> FR-1.1.1) dan **Workflow Template** (§4.1a) — bukan oleh cabang rumus
> yang berbeda-beda.
> `scope = BUSINESS_LINE` pada `formula_definition` tetap disediakan
> secara skema untuk fase lanjutan, namun **tidak dipakai pada POC/Phase
> 1** selama tidak ditemukan lini bisnis dengan struktur harga yang
> benar-benar berbeda (PRD Open Technical Decision).

### 3.2 Pendekatan: Expression DSL + Safe Evaluator

Gunakan bahasa ekspresi terbatas (bukan `eval()` bebas) yang di-*parse* menjadi AST dan dievaluasi oleh interpreter kustom (atau library sandboxed seperti `expr-eval`/`mathjs` dengan whitelist fungsi). **Jangan pernah mengeksekusi kode arbitrer dari input pengguna** (risiko RCE) — semua formula divalidasi terhadap whitelist variabel yang terdaftar di `input_variables`.

Contoh definisi formula (`formula_definition.expression`):

```
base_cost = SUM(direct_costs) + SUM(indirect_costs)
fx_adjusted_cost = base_cost * (1 + FX_CNY_IDR_DELTA_PCT)
margin_amount = fx_adjusted_cost * (cost_of_funds_pct + leasing_margin_pct)
final_price = fx_adjusted_cost + margin_amount + sales_commission_amount + contingency_buffer_amount
```

Variabel `direct_costs`, `indirect_costs` dsb. di-resolve dari `cbs_template_node` yang ter-tag kategori terkait; `FX_CNY_IDR_DELTA_PCT` (basis komponen impor FOB — dikoreksi dari `FX_USD_IDR_DELTA_PCT`) di-resolve dari `external_rate_snapshot` atau dari *slider* simulasi DSS.

### 3.3 Evaluation Pipeline (v4.0 — per line item, setelah diskon, excl. VAT)

```
A. Saat versi cost structure disiapkan (per varian, §4.8):
   1. Kunci kurs CNY→IDR (resolveRate) dan PPN (tax_rate) pada versi
   2. Hitung FOB Price in IDR = FOB CNY × kurs terkunci (item is_derived)
   3. base_cost     = Σ COGS + Σ ADD_ONS                (IDR/unit; item
                      EXCLUDED_AT_COST bernilai 0)
   4. margin_amount = base_cost × Σ PROFITABILITY(%) + Σ PROFITABILITY(Rp)
   5. sales_cost    = Σ SALES
   6. list_price_ex_vat = base_cost + margin_amount + sales_cost
   7. standard_gm   = margin_amount / (base_cost + margin_amount)
      → disimpan sebagai cost_structure_version.standard_gm_pct
        (dasar skenario Regular/Deviation saat rilis versi)

B. Saat Official Quotation di-generate / direvisi / Hitung Ulang:
   untuk setiap quotation_line_item:
   1. Ambil cost_structure_version terkunci line tsb
   2. Terapkan quotation_cost_override yang sudah RELEASED (FR-1.1.3)
      → ulangi langkah A3–A6 dengan nilai override
   3. discount = normalizeDiscountInput(mode, amount, pct, list_price_ex_vat)  (§11.1.1)
   4. net_price_ex_vat   = list_price_ex_vat − discount
   5. gm_line = (net_price_ex_vat − sales_cost − base_cost)
                ÷ (net_price_ex_vat − sales_cost)
   6. net_price_incl_vat = net_price_ex_vat × (1 + rate_pct × taxable_base_factor)
   7. line_total_* = net_price_* × quantity  (dihitung dari nilai belum dibulatkan;
                     pembulatan tampilan mengikuti template.rounding_rule)

   agregat quotation:
   8. GM_quotation = Σ(net_ex_vat − sales_cost − base_cost)·qty
                     ÷ Σ(net_ex_vat − sales_cost)·qty      (rata-rata tertimbang)
   9. margin_tier = resolveMarginTier(GM_quotation, business_line)  (§11.1)
      scenario    = GM_quotation < deviation_gm_threshold ? DEVIATION : REGULAR
  10. Persist sebagai pricing_proposal_version baru (immutable snapshot)
```

- **Kelompok SALES sebagai *pass-through*.** GM tidak dinaikkan maupun
  diturunkan oleh `sales_cost` — konsisten dengan engine v3.0
  (`src/lib/pricing/engine.ts`). Engine v3.0 menghitung GPM **sebelum**
  diskon; v4.0 mewajibkan GM **setelah** diskon karena tier ditentukan
  darinya. Definisi ini dan perlakuan profit VKTS perlu konfirmasi
  Corporate Finance (§14).
- **Tier dievaluasi pada agregat quotation.** Apakah juga perlu batas GM
  minimum per line (agar satu varian ber-GM rendah tidak tersembunyi di
  rata-rata) adalah keputusan terbuka (§14); sistem tetap menyimpan
  `gm_pct` per line dan menampilkannya ke approver.
- **Contoh angka** (varian demo LDT 4x2 SWB Dumper 90 kWh, kurs 2.600,
  PPN efektif 11% — ilustratif): base_cost Rp 677.000.000; margin
  Rp 146.550.000; sales Rp 6.000.000; list excl. VAT Rp 829.550.000
  (GM 17,79%). Diskon 2% → GM 16,10% (Tier 1); 4% → 14,34% (Tier 2);
  Rp 80.000.000 (9,64%) → 8,95% (Tier 3). Ambang tepat: GM 15% pada
  diskon 3,264%, GM 10% pada diskon 8,598%.

Untuk **What-If Simulator (FR-4.1)**, langkah B3–B9 dijalankan ulang secara *stateless* dengan variable context yang dimodifikasi slider — endpoint terpisah yang idempotent dan tidak menyentuh `pricing_proposal_version`. **Price Estimate** (§4.9) memakai langkah A tanpa diskon, 1 unit.

### 3.4 Validasi Formula saat Disimpan
- Cek semua variabel dalam ekspresi terdaftar di `input_variables` (no undefined ref).
- Cek tidak ada *circular reference* antar node CBS (topological sort pada tree; tolak jika ada siklus).
- Uji unit: jalankan dengan data dummy untuk memastikan tidak ada divide-by-zero pada BEP.

### 3.5 Skema Rental (FR-1.7 — formula menunggu VKTR)

Dokumen contoh memuat *Rental Scheme, 5-year Contract*: Rp 35.309.397
per unit per bulan (incl. VAT), 40 unit, total Rp 1.412.375.872 per
bulan. Formula yang menghasilkan angka ini **belum diterima**.

```pseudo
function rentalMonthly(line):
    if not config.rental_formula_confirmed:
        # Sementara: nilai diinput Sales Operations (jalur MANUAL saja),
        # ditandai "formula belum dikonfirmasi" di UI & audit.
        require line.processing_mode == MANUAL
        require line.rental_monthly_incl_vat is not null
        # Tier margin tetap dievaluasi dari harga PURCHASE setara varian
        # (langkah B3–B9 §3.3), bukan dari nilai sewa.
        return line.rental_monthly_incl_vat
    else:
        return evaluateFormula('RENTAL_MONTHLY', {
            net_price_ex_vat, financing_cost_pct, tenor_months,
            residual_value_pct, included_services, tax_rate })   # parameter menunggu konfirmasi
```

- **Pembulatan**: 35.309.397 × 40 = 1.412.375.880, sedangkan total
  tercetak 1.412.375.872 — total dihitung dari nilai per unit sebelum
  dibulatkan (≈ 35.309.396,8). `rounding_rule` template mereplikasi
  perilaku ini.
- Cara menghitung GM deal rental (nilai kini arus sewa vs biaya) adalah
  keputusan terbuka (§14).

---

## 4. Workflow State Machine (FR-2.0.1, FR-2.1 – FR-2.4)

### 4.0 Lapisan Proses & Sumber Konfigurasinya (v4.0)

> **Revisi v4.0.** Model "tiga fase, dua state machine independen" v3.0
> (Pembuatan hardcoded → Approval COGS via template → Negosiasi via
> `negotiation_request`) **digantikan**. Sheet *Basic Workflow* VKTR
> menempatkan routing margin di **langkah 7 Official Quotation** —
> bagian jalur rilis, bukan proses terpisah pasca-rilis. Sekarang ada
> **dua state machine** dengan objek berbeda: cost structure (per
> varian) dan Official Quotation (per deal).

| Lapisan | Objek & field status | Siapa menentukan alurnya | Diatur di Settings? |
|---|---|---|---|
| **0. Cost Structure** | `cost_structure_scope_state.status` per scope (`DRAFT → MADE → CHECKED → RELEASED`); `cost_structure_version.status` | `scope_authority` + `scope_segregation_rule` (§4.8) | **Ya** — Roles & Authorities |
| **A. Price Estimate** | Tidak ada status — hanya `price_estimate_log` | `workflow_definition (PRICE_ESTIMATE)`: siapa boleh & varian mana | **Ya** — Workflow |
| **B. Official Quotation, langkah 1–6** | `pricing_proposal.current_status` | `workflow_definition (OFFICIAL_QUOTATION)` + `workflow_step_definition` (§4.1a) + `quantity_band_config` (§4.10) | **Ya** — Workflow & Quantity Band |
| **C. Official Quotation, langkah 7** | `pricing_proposal.current_status` + `tier_approval` | `margin_tier_authority` (§11) — disisipkan dinamis, **tidak** dari template | **Ya** — Tier Margin (terpisah dari template) |

**Kenapa langkah 7 tidak berasal dari Workflow Template.** Template
dapat dibuat bebas oleh Admin untuk segmen baru; bila tier ikut di
template, sebuah template dapat (sengaja atau tidak) menghilangkan
approval CCO/CFO untuk GM < 10%. Dengan menyisipkan langkah tier dari
`margin_tier_authority` setelah step `REVIEW_AND_ROUTE`, semua template
Official Quotation otomatis tunduk pada matriks margin yang sama.

**Kenapa Fase 1 v3.0 ("Pembuatan", hardcoded) hilang.** Langkah isi
KYC kini adalah step 1 template (`FILL_KYC`) — tetap selalu pertama
(validasi template menolak template Official Quotation yang tidak
diawali `FILL_KYC`), namun nama langkah, SLA, dan kondisinya dapat
diatur.

### 4.1 Status Official Quotation (`pricing_proposal.current_status`)

```
DRAFT                                  ← Salesperson isi KYC (8 field) + line item
  │ submit (qualification gate FR-7.3, fraud guard §4.7)
  ▼
PENDING_SALES_LEAD_VALIDATION          ← dilewati (SKIPPED_NOT_APPLICABLE) bila
  │  tolak → DRAFT                        pengaju punya slot SALES_VALIDATOR
  ▼
PENDING_SALES_OPERATIONS               ← generate per quantity band (§4.10):
  │                                       band 1 auto-selesai; band 2–3 auto +
  │                                       konfirmasi; band 4 manual. Override
  │                                       cost line → M/C/R pemilik scope (§4.8)
  ▼
PENDING_HEAD_OF_SALES_REVIEW           ← Head of Sales lihat quotation + detail
  │  revise → hitung ulang, tetap di sini  cost structure; accept →
  │  kembalikan → PENDING_SALES_OPERATIONS  resolveMarginTier (§11.1)
  │
  ├─ Tier 1 (GM ≥ 15%) ─────────────────────────────────────────┐
  ├─ Tier 2 → PENDING_OWNER_APPROVAL                            │
  │           (COGS_OWNER ∧ PROFITABILITY_OWNER)                │
  │           tolak → PENDING_SALES_OPERATIONS                  │
  └─ Tier 3 → PENDING_PRICING_COMMITTEE_APPROVAL                │
              (CCO ∧ CFO; cc COGS & Profitability Owner)        │
              tolak → PENDING_SALES_OPERATIONS                  │
                              │ semua setuju                    │
                              ▼                                 ▼
                      canReleaseQuotation (§4.2.1) ──lolos──► QUOTATION_RELEASED
                                                               │ (document_number,
                                                               │  valid_until, PDF)
QUOTATION_RELEASED → SUPERSEDED     ← revisi pada Project Identifier yang sama dirilis
QUOTATION_RELEASED → EXPIRED        ← valid_until terlewati tanpa outcome WON (§4.11)
QUOTATION_RELEASED → EXPORTED_TO_ERP
CONFIG_ERROR                        ← tidak ada template/tier yang cocok (§4.5)
```

- `outcome` (`WON`/`LOST`) adalah field terpisah dari `current_status`
  (FR-2.10); quotation `WON` tidak dapat menjadi `EXPIRED`.
- Status v3.0 yang **dihapus**: `PENDING_COGS_VALIDATION`,
  `PENDING_CHIEF_SALES_REVIEW`, `PENDING_BOD_APPROVAL`. Migrasi data POC:
  quotation berjalan dengan status lama ditutup sebagai `CANCELLED` atau
  diselesaikan di alur lama sebelum *cut-over* (§14).
- Setiap perubahan diskon atau override setelah routing tier membuat
  `pricing_proposal_version` baru, **membatalkan** seluruh baris
  `tier_approval` versi sebelumnya, dan mengembalikan status ke
  `PENDING_HEAD_OF_SALES_REVIEW`.

### 4.1a Workflow Template Resolution (FR-2.0.1 — direvisi v4.1)

VKTR memperkirakan ±30 variasi workflow (transcribe.md): *qualifier*
statis, katalog template bertambah. Pemilihan dijalankan saat submit
(`submitQuotationAction`) oleh fungsi murni
`src/lib/workflow/templateCatalog.ts`:

```pseudo
function resolveTemplate(templates, deal):
    # deal = { segment, industry, relationship, businessLine (KYC),
    #          quantity = Σ qty line, estimatedValue = Σ list_price_ex_vat × qty
    #          dari cost structure RELEASED, isBlacklisted = nama ∈ blacklist }
    for t in templates where t.is_active and kind = OFFICIAL_QUOTATION:
        checks = qualifier yang terisi pada t (segmen, industri, relasi,
                 lini bisnis, rentang qty, rentang nilai, blacklist)
        t.matched     = semua checks terpenuhi
        t.specificity = jumlah checks
    candidates = matched and not is_fallback
                 order by priority desc, specificity desc, version desc
    if candidates: return candidates[0], "Cocok: <qualifier> (prioritas p)"
    return fallback ?? CONFIG_ERROR
```

- Hasil disimpan: `workflow_definition_id`, `workflow_template_code`,
  `workflow_selection_reason`, `estimated_value`, `is_blacklisted`;
  langkah template **disalin** ke `workflow_step_instance` sehingga
  perubahan template berikutnya tidak memengaruhi quotation berjalan.
- **Prioritas** dipakai sebagai kebijakan eksplisit Admin (mis.
  Blacklist 100 selalu menang atas B2G 10); spesifisitas hanya pemecah
  seri. Alat **Uji pemilihan template** di Settings menampilkan hasil &
  alasan untuk atribut apa pun.
- **Katalog awal (migrasi 0017)**:

| Template (kode) | Qualifier | Prioritas | Langkah setelah KYC | Tier margin |
|---|---|---|---|---|
| Official Quotation — Standard (`OQ-STANDARD`) | — (dasar/fallback) | 0 | Validasi Sales Lead* → Generate → Review & Rilis | Global |
| Official Quotation — Customer Blacklist (`OQ-BLACKLIST`) | Customer di blacklist | 100 | Validasi Sales Lead → **Persetujuan Pricing Committee** → Generate → Review | Khusus: semua tier diputus CCO + CFO |
| Official Quotation — Relasi Khusus (`OQ-RELASI-KHUSUS`) | Hubungan = Relasi khusus | 20 | Generate → Review (tanpa validasi Sales Lead) | Khusus: GM < 15% langsung CCO + CFO |
| Official Quotation — Nilai Besar (`OQ-NILAI-BESAR`) | Estimasi nilai ≥ Rp 50 M | 15 | Validasi* → **Persetujuan kelayakan deal (Pricing Committee)** → Generate → Review | Global |
| Official Quotation — B2G Pemerintah (`OQ-B2G`) | Segmen = B2G | 10 | Validasi* → **Verifikasi dokumen tender (Head of Sales)** → Generate → Review (SLA 48 jam) | Khusus: setiap tier sampai CCO + CFO |
| Official Quotation — Industri Tambang & Perkebunan (`OQ-INDUSTRI-BERAT`) | Industri = Pertambangan / Perkebunan | 5 | Validasi* → Generate → **Review aplikasi & karoseri (COGS Owner)** → Review | Global |

\* dilewati bila pengaju Sales Lead.

- Validasi template saat disimpan (`saveTemplateAction`): tepat satu
  `GENERATE_QUOTATION` dan satu `REVIEW_AND_ROUTE` (terakhir); tujuan
  tolak menunjuk langkah sebelumnya; kondisi lewati hanya pada langkah
  `VALIDATE`/`APPROVE`; setiap pelaksana dimiliki ≥ 1 user aktif;
  template non-dasar wajib punya ≥ 1 qualifier. Simpan = versi baru
  (versi lama dinonaktifkan, tidak diedit).

```pseudo
function activateNextStep(instance):
    for step in instance.steps ordered by step_order where status == PENDING:
        if evaluateSkip(step.skip_if_initiator_function, initiator) or
           (revisi tanpa perubahan KYC/varian and step.action_kind == VALIDATE):
            step.status = SKIPPED_NOT_APPLICABLE; continue
        step.status = IN_PROGRESS; proposal.current_status = step.status_label
        if step.action_kind == GENERATE_QUOTATION: price (quantity band); band 1 → auto-selesai
        return
```

### 4.2 Strict Gatekeeping (FR-2.2)

Aturan inti tetap: *step N tidak boleh `IN_PROGRESS` sebelum step N-1
berstatus `APPROVED`/`APPROVED_WITH_CONDITIONS`/`SKIPPED_NOT_APPLICABLE`*.
Gate tambahan v4.0:

```pseudo
function canSubmitQuotation(proposal):                    # step FILL_KYC
    missing = KYC_MANDATORY_FIELDS.filter(f => isEmpty(proposal.kyc, f))
    if missing: return false, "KYC belum lengkap: " + missing
    if proposal.line_items.isEmpty(): return false, "Minimal satu varian & kuantitas"
    for line in proposal.line_items:
        if activeReleasedVersion(line.product_variant_id) is null:
            return false, "Cost structure varian " + line.variant + " belum RELEASED"
    return canCreateNewQuotation(...)                     # fraud guard §4.7

function canGenerate(proposal):                           # step GENERATE_QUOTATION
    # semua override cost line (FR-1.1.3) harus sudah RELEASED oleh pemilik scope
    pending = proposal.cost_overrides.filter(o => o.status != RELEASED)
    if pending: return false, "Penyimpangan menunggu M/C/R: " + pending.scopes
    return true
```

**Mode PARALLEL_GROUP** tetap tersedia untuk template yang
membutuhkannya (AND-join dalam satu `step_order`); tidak dipakai seed
v4.0.

### 4.2.1 Release Gate (FR-2.2 — penjaga *margin leakage*)

```pseudo
function canReleaseQuotation(proposal, version):
    # 1. Item mandatory bernilai di cost structure terkunci + override
    missing = mandatoryItems(version).filter(i => !hasValue(version, i))
    if missing: return false, "Komponen mandatory belum lengkap: " + missing

    # 2. may_follow_later: bernilai ATAU eksplisit EXCLUDED_AT_COST
    for i in itemsWithFlag(may_follow_later):
        if !hasValue(version, i) and !isExcludedAtCost(version, i):
            return false, i.name + " harus dinilai atau dinyatakan 'Exclusion — At cost'"

    # 3. Seluruh step template selesai, termasuk validasi Sales Lead (atau skipped)
    if instance.steps.any(s => s.status not in [APPROVED, APPROVED_WITH_CONDITIONS,
                                                SKIPPED_NOT_APPLICABLE]):
        return false, "Masih ada langkah workflow yang belum selesai"

    # 4. Tier margin: seluruh slot DECISION pada versi ini APPROVE (AND-join)
    tier = resolveMarginTier(version.gm_quotation, proposal.business_line)
    if not allDecisionSlotsApproved(proposal, version, tier):
        return false, "Tier " + tier.tier + " — menunggu " + pendingSlots(...)

    # 5. Kurs: tidak ada banner sensitivitas yang belum di-"Hitung Ulang"
    if checkRateSensitivity(proposal).needsAttention:
        return false, "Kurs bergerak melewati ambang — Hitung Ulang dulu (§12.5)"

    return true
```

Pada rilis: `document_number` di-*generate* (§4.11), `valid_until`
ditetapkan, item `EXCLUDED_AT_COST` ditambahkan ke `exclusions` dengan
`exclusion_label` + "At cost", snapshot dokumen dibekukan (§4.12), dan
quotation pendahulu (bila ada) menjadi `SUPERSEDED`. Seluruh
pemeriksaan berjalan di **service layer**.

### 4.3 Rejection & Routing Logic (FR-2.3)

| Aksi | Oleh | Efek |
|---|---|---|
| `REJECT` pada validasi | Sales Lead | step → `REJECTED`; proposal → `DRAFT` (kembali ke Salesperson), KYC utuh; `reject_target_step_order = 1` |
| `REVISE` | Head of Sales | ubah diskon / nilai scope `SALES` (dengan M/C/R scope Sales, §4.8) → versi baru, tetap `PENDING_HEAD_OF_SALES_REVIEW` |
| `RETURN` | Head of Sales | kembali ke `PENDING_SALES_OPERATIONS` dengan catatan |
| `REJECT` tier 2/3 | COGS/Profitability Owner, CCO/CFO | seluruh `tier_approval` versi ini ditutup; proposal → `PENDING_SALES_OPERATIONS` (`margin_tier_authority.reject_target`); versi tidak dihapus |
| `APPROVE_WITH_CONDITIONS` | approver mana pun | `decision_note` wajib; dapat ditandai "tampil di Special Notes" |

### 4.4 Dynamic Form Adjustment (FR-2.4)

```pseudo
on CostOverrideProposed(proposal, line, costItem, value):   # FR-1.1.3
    scope = scopeOf(costItem.cost_group)
    scenario = proposal.scenario                   # REGULAR / DEVIATION dari GM terkini
    override = INSERT quotation_cost_override(status: DRAFT, scope, ...)
    # siklus M/C/R sama dengan cost structure (§4.8), wewenang dibaca
    # dengan scenario quotation — pada DEVIATION, CCO/CFO ikut berwenang
    notify(rolesWith(scope, scenario, can_check))

on CostItemAddedToMaster(costItem):
    # tidak mengubah versi RELEASED; membuat DRAFT versi baru untuk setiap
    # varian aktif, scope costItem.cost_group dibuka untuk Maker
    for variant in activeVariants():
        createDraftVersion(variant, openScopes: [scopeOf(costItem.cost_group)])
```

Quotation yang sudah berjalan tetap memakai versi terkuncinya; hanya
quotation baru (atau "Hitung Ulang" eksplisit) yang memakai versi baru.

### 4.5 Eskalasi Otomatis Berbasis Nilai (FR-2.1)

Saat proposal disubmit atau `transaction_value` berubah, `resolveWorkflowTemplate`
(§4.1a) dijalankan ulang menggunakan qualifier terbaru. Jika tidak ada
`workflow_definition` yang cocok (gap konfigurasi) → proposal masuk status
`CONFIG_ERROR`, memicu alert ke Admin (bukan default ke workflow
sembarangan — mencegah *silent bypass*).

### 4.6 Project Identifier & Quotation Versioning (FR-2.5 — baru)

Menjawab kebutuhan melacak revisi quotation untuk deal yang sama (mis.
qty berubah setelah negosiasi) tanpa kehilangan jejak harga yang pernah
dikirim ke pelanggan.

```pseudo
function createProjectIdentifier(customerName, projectName):
    # Sistem yang men-generate kode, bukan diketik Sales, agar konsisten.
    code = generateAlphanumericCode(customerName, projectName)
    return INSERT INTO project_identifier (identifier_code: code, customer_name: customerName, project_name: projectName)

function resolveProjectForKyc(kyc, selectedIdentifierId):
    # KYC item c (v4.0) menentukan kaitan Project Identifier
    if kyc.project_type == NEW_PROJECT:
        return createProjectIdentifier(kyc.company_name, kyc.project_name)
    # ADDITIONAL_RUNNING_PROJECT / REPLACEMENT → wajib pilih identifier yang ada
    require selectedIdentifierId is not null
    return selectedIdentifierId

function createRevisionQuotation(existingProposal, changeReason):
    # Dipanggil saat quotation yang SUDAH RELEASED perlu direvisi (diskon
    # pelanggan, qty berubah, perpanjangan setelah EXPIRED) — §11.4.
    newProposal = INSERT INTO pricing_proposal (
        project_identifier_id: existingProposal.project_identifier_id,
        supersedes_proposal_id: existingProposal.id,
        business_line: existingProposal.business_line,
        kyc_snapshot: existingProposal.kyc_snapshot,   # disalin, dapat diubah
        line_items: copy(existingProposal.line_items), # cost_structure_version
                                                       # di-resolve ulang saat generate
        current_status: DRAFT,
        ...
    )
    # Quotation lama ditandai SUPERSEDED begitu quotation baru RELEASED —
    # bukan seketika saat draft dibuat, agar harga lama tetap berlaku
    # sampai penggantinya benar-benar sah.
    return newProposal

on QuotationReleased(proposal):
    if proposal.supersedes_proposal_id is not null:
        UPDATE pricing_proposal
        SET current_status = SUPERSEDED
        WHERE id = proposal.supersedes_proposal_id
        writeAuditLog(action: 'SUPERSEDE', entity: proposal.supersedes_proposal_id,
                      reason: "Digantikan oleh " + proposal.proposal_number)
```

- Dashboard (Module 3) mengelompokkan seluruh `pricing_proposal` dengan
  `project_identifier_id` yang sama sebagai satu linimasa, terurut dari
  `supersedes_proposal_id` (FR-2.5).
- Revisi **tidak pernah** mengedit `pricing_proposal_version` dari
  quotation yang sudah `QUOTATION_RELEASED` — selalu `pricing_proposal`
  baru, agar riwayat yang pernah dikirim ke pelanggan tetap utuh untuk
  audit.

### 4.7 Duplicate/Fraud Guard (FR-2.6 — baru)

Mencegah penerbitan quotation yang serampangan untuk customer + tipe
unit yang sama dalam rentang waktu singkat.

```pseudo
function canCreateNewQuotation(salespersonId, customerKycId, variantIds):
    windowStart = startOfDay(now())  # jendela waktu = master config, default: hari kalender
    # v4.0: dicek per varian pada line item (quotation bisa multi-varian)
    countToday = SELECT COUNT(DISTINCT p.id) FROM pricing_proposal p
                 JOIN quotation_line_item li ON li.proposal_id = p.id
                 WHERE p.created_by = salespersonId
                   AND p.customer_kyc_id = customerKycId
                   AND li.product_variant_id IN variantIds
                   AND p.supersedes_proposal_id IS NULL   # revisi dikecualikan
                   AND p.created_at >= windowStart

    maxPerWindow = getMasterConfig('fraud_guard.max_quotations_per_window')  # default 1
    if countToday >= maxPerWindow:
        writeAuditLog(action: 'BLOCKED_DUPLICATE_ATTEMPT', actor: salesOfficerId,
                      reason: "Melebihi batas " + maxPerWindow + " quotation/hari untuk customer+produk ini")
        return false, "Batas quotation harian untuk customer & tipe unit ini sudah tercapai"

    return true
```

- Pemeriksaan ini dijalankan di **service layer** sebelum
  `pricing_proposal` baru dibuat — bukan hanya validasi UI.
- Revisi quotation via `createRevisionQuotation` (§4.6) **dikecualikan**
  dari guard ini karena bukan quotation baru yang independen, melainkan
  kelanjutan Project Identifier yang sama.
- Percobaan yang diblokir tercatat di audit trail sebagai kandidat
  anomali untuk ditinjau System Admin/Head of Sales, bukan sekadar
  ditolak diam-diam.

### 4.8 Maker → Checker → Releaser Engine (FR-1.1.2, FR-1.1.3)

Satu engine dipakai untuk dua objek: scope pada `cost_structure_version`
(standar per varian) dan `quotation_cost_override` (penyimpangan per
deal).

```pseudo
function canPerform(user, action, scope, scenario, record):
    roles = activeAppRoles(user)
    auth  = SELECT * FROM scope_authority
            WHERE app_role_id IN roles AND scope = scope AND scenario = scenario
    if not auth.any(a => a['can_' + action]):          # make / check / release
        return false, "Tidak berwenang " + action + " pada scope " + scope

    rule = scope_segregation_rule[scope]
    if action == 'check' and rule.maker_ne_checker and user == record.maker_id:
        if not (rule.allow_single_actor_when_only_one_holder
                and holdersOf(scope, scenario, 'check') == [user]):
            return false, "Checker harus berbeda dari Maker"
        record.single_actor_flag = true
    if action == 'release' and rule.checker_ne_releaser and user == record.checker_id:
        ... # pola sama
    return true

transitions:
    DRAFT   --make-->    MADE      (Maker mengisi/ubah nilai scope)
    MADE    --check-->   CHECKED   | --return--> RETURNED → DRAFT (catatan wajib)
    CHECKED --release--> RELEASED  | --return--> RETURNED → DRAFT
```

- **Skenario** dievaluasi saat `make`: untuk cost structure dari
  `standard_gm_pct` hasil nilai yang diusulkan; untuk override dari GM
  quotation setelah override. Bila skenario berubah (mis. override
  membuat GM < 10%) di tengah siklus, siklus diulang dari `DRAFT` dengan
  matriks `DEVIATION`.
- `cost_structure_version.status = RELEASED` ketika keempat
  `cost_structure_scope_state` `RELEASED`; versi `RELEASED` sebelumnya
  menjadi `RETIRED`. Scope yang tidak berubah dari versi sebelumnya
  dapat disalin berstatus `RELEASED` (tidak perlu M/C/R ulang) — hanya
  scope yang nilainya berubah yang diproses.
- Scope diproses **independen** (COGS dan MARGIN dapat berjalan
  bersamaan), menggantikan urutan wajib VP Operations → VP Finance v3.0.
- Audit: setiap transisi menulis `audit_log_entry` (`action = MAKE /
  CHECK / RELEASE / RETURN`, `scope`, `scenario`, `single_actor_flag`).

### 4.9 Price Estimate (FR-2.7)

```pseudo
function getPriceEstimate(user, variantId):
    require userHasFunctionalRole(user, ['SALESPERSON', 'EXTERNAL_AGENCY'])
    v = activeReleasedVersion(variantId)
    if v is null: return NOT_AVAILABLE          # varian tidak ditampilkan di pilihan
    exVat   = v.list_price_ex_vat                # langkah A §3.3, 1 unit, tanpa diskon
    inclVat = exVat × (1 + taxRate(v).effective)
    INSERT price_estimate_log(user, variantId, v.id, exVat, inclVat)
    return { variant: describe(variantId), price_ex_vat: exVat,
             price_incl_vat: inclVat, info: additionalInfo(variantId) }
             # TIDAK ada elemen cost structure, GM, atau tier di respons
```

- Response serializer untuk endpoint ini memakai *allow-list* field
  (bukan *deny-list*) sehingga penambahan kolom cost structure di masa
  depan tidak bocor ke agensi.
- Rate limit per user (anti-scraping katalog harga oleh akun agensi)
  adalah master config; tidak ada batas bisnis per hari.

### 4.10 Quantity Band Resolution (FR-2.8)

```pseudo
function resolveBand(qty):
    return SELECT * FROM quantity_band_config
           WHERE qty >= min_qty AND (max_qty IS NULL OR qty <= max_qty)

on StepActivated(step.action_kind == GENERATE_QUOTATION, proposal):
    for line in proposal.line_items:
        line.band = resolveBand(line.quantity)
    proposal.quantity_band   = max(line.band.band for line in lines)
    proposal.processing_mode = modeOf(proposal.quantity_band)   # band 4 di mana pun → MANUAL

    for line in lines:
        line.cost_structure_version_id = activeReleasedVersion(line.variant).id
        if line.band.processing_mode != MANUAL:
            applyDiscount(line, mode: PERCENTAGE, pct: line.band.default_discount_pct,
                          source: BAND_DEFAULT)
    calculate(proposal)                                          # §3.3 B

    if proposal.processing_mode == AUTO:                         # semua line band 1
        completeStep(step, actor: SYSTEM, note: "Auto-generated (band 1, harga dasar)")
        # langsung ke PENDING_HEAD_OF_SALES_REVIEW
    else:
        # AUTO_WITH_MANUAL: draft siap, Sales Operations konfirmasi/ubah diskon
        # MANUAL: Sales Operations menyusun (diskon, skema, override, in/exclusions)
        keep step IN_PROGRESS for SALES_OPERATIONS
```

- `prepared_by` diisi Sales Operations yang menyelesaikan step (atau
  akun sistem + Sales Operations penanggung jawab antrean pada band 1 —
  nama yang dicetak di dokumen perlu konfirmasi).
- Aturan "band terbesar menentukan mode quotation" untuk multi-varian
  adalah asumsi PriceCore (§14).

### 4.11 Penomoran, Masa Berlaku & Kedaluwarsa (FR-2.9)

```pseudo
on QuotationReleased(proposal):
    tpl = proposal.document_template
    proposal.document_number = renderPattern(tpl.number_pattern, {
        seq: nextSequence(scope: tpl.sequence_scope),   # mis. per bulan per kode unit
        scheme_code: schemeCode(proposal),               # mis. RNT untuk Rental (konfirmasi)
        unit_code: salesUnitCode(proposal),              # mis. EFS (konfirmasi)
        MM, YYYY: released_at })
    proposal.valid_until = released_at::date + tpl.validity_days   # 6 Sep → 6 Okt

scheduled_job expireQuotations():   # harian 00:05
    UPDATE pricing_proposal SET current_status = 'EXPIRED'
    WHERE current_status = 'QUOTATION_RELEASED' AND outcome = 'PENDING'
      AND valid_until < today()
    # audit EXPIRE; notifikasi ke Salesperson untuk opsi revisi/perpanjangan
```

Sequence dibuat dengan `SELECT … FOR UPDATE` / sequence DB agar tidak
ada nomor ganda saat dua rilis bersamaan; nomor yang sudah terbit tidak
pernah dipakai ulang.

### 4.12 Dokumen, Preview & Cetak (FR-1.5.3, FR-1.5.4)

```pseudo
function renderQuotationDocument(proposalVersion, kind):
    p = proposalVersion.proposal
    require canViewDocument(currentUser, p, kind)    # §8.2
    data = proposalVersion.document_snapshot ?? buildSnapshot(proposalVersion)
    watermark = p.current_status in [QUOTATION_RELEASED, EXPORTED_TO_ERP] ? none
              : p.current_status == SUPERSEDED ? 'SUPERSEDED'
              : p.current_status == EXPIRED    ? 'EXPIRED'
              : 'DRAFT — NOT FOR CUSTOMER'
    html = template(p.document_template_version).render(data, watermark)
    INSERT document_render(proposalVersion, kind, watermark, hash(html), currentUser)
    return kind == DOWNLOAD_PDF ? htmlToPdf(html, A4) : html

function buildSnapshot(version):
    # HANYA field yang boleh dilihat pelanggan — allow-list
    return { title, issuer, document_number (atau "DRAFT"), release_date, expiry_date,
             to: kyc.company_name + kyc.official_address, disclaimer,
             account_persons, product_description, prepared_by,
             items: [{qty, description (skema + deskripsi varian), unit_price, total}],
             inclusions, exclusions (+ "At cost"), contact, grand_total,
             special_notes, acceptance_block, spec_pages }
```

- **Satu renderer** untuk preview layar, print (CSS `@page A4`, header/
  footer berulang, nomor halaman) dan PDF (render HTML → PDF di server,
  mis. headless Chromium) — tidak ada dua tata letak berbeda yang bisa
  menyimpang.
- `document_snapshot` dibekukan saat rilis; cetak ulang versi rilis
  memakai snapshot + versi template saat itu → hasil identik
  (`content_hash` sama).
- **Cost Structure Sheet** (render_kind `COST_STRUCTURE_SHEET`) adalah
  template terpisah bertanda *Highly Confidential*, hanya untuk slot
  `SALES_OPERATIONS`, `SALES_RELEASER`, pemilik scope, dan
  `PRICING_COMMITTEE`; tidak pernah digabung ke PDF pelanggan.
- **Status POC**: `QuotationPreview.tsx` sudah menampilkan dokumen dan
  memanggil `window.print()`, tetapi memakai layout v3.0 (bukan *Cost
  Estimate*), tanpa halaman spesifikasi, watermark, penomoran resmi,
  maupun PDF server-side.

---

## 5. SLA Timer & Escalation (FR-3.2)

- Saat step berpindah ke `IN_PROGRESS`: set `sla_due_at = now() + step_definition.sla_hours`.
- **Scheduled job (cron, misal setiap 15 menit)**:
  ```sql
  SELECT * FROM workflow_step_instance
  WHERE status = 'IN_PROGRESS'
    AND sla_due_at < now()
    AND escalation_sent_at IS NULL
  ```
  Untuk tiap baris: kirim notifikasi (Email/Teams webhook/WhatsApp API) ke actor step + eskalasi ke atasan department (`department.escalation_contact_id`), set `escalation_sent_at = now()`.
- Gunakan **idempotent job** dengan `escalation_sent_at` sebagai guard agar tidak double-notify saat cron overlap.
- Rekomendasi: gunakan *outbox table* (`notification_outbox`) agar pengiriman notifikasi dipisah dari transaksi utama dan bisa di-retry tanpa mengganggu state workflow.

---

## 6. Immutable Audit Trail (FR-3.3)

**Prinsip implementasi:**
1. Tabel `audit_log_entry` **tidak memiliki** grant `UPDATE`/`DELETE` di level database role aplikasi — hanya `INSERT`. Ini dijamin di level DB (bukan hanya di level aplikasi) agar benar-benar *immutable*.
2. Setiap mutasi pada `pricing_proposal_version`, `cbs_template`, `workflow_definition`, `cost_item` dibungkus dalam service-layer transaction yang **wajib** menulis satu baris `audit_log_entry` sebelum commit (enforced via application-level transaction wrapper, didukung oleh DB trigger sebagai pengaman kedua/*defense in depth*).
3. `field_changes` disimpan sebagai diff granular (`[{field: "sales_commission_pct", old: 0.02, new: 0.025}]`) agar bisa direkonstruksi *side-by-side* dengan `pricing_proposal_version` untuk keperluan versioning (FR row-level versioning).
4. Query audit menyediakan filter kompleks (actor, entity, date range, field name) — perlu index komposit pada `(entity_type, entity_id, created_at)` dan `(actor_id, created_at)`.

---

## 7. Decision Support System — Simulation Engine (FR-4.1 – FR-4.3)

### 7.1 What-If Sensitivity Simulator

Endpoint stateless, tidak menulis ke `pricing_proposal_version`:

```
POST /api/proposals/{id}/versions/{versionId}/simulate
Body: {
  "fx_cny_idr_delta_pct": 3.0,
  "commodity_lithium_delta_pct": -5.0,
  "volume_discount_pct": 2.0
}
Response: {
  "base_case": { "gpm": 18.4, "ebitda_contribution": 4200000000, "bep_units": 42 },
  "simulated_case": { "gpm": 15.1, "ebitda_contribution": 3650000000, "bep_units": 47 },
  "delta": { "gpm_pct_points": -3.3, ... }
}
```
Implementasi memakai ulang **Formula Engine (§3)** dengan variable context yang dioverride oleh input slider — tidak ada logika kalkulasi duplikat antara "kalkulasi resmi" dan "simulasi".

### 7.2 Intelligent Margin Guardrails & Anomaly Detection (FR-4.2)

- **Guardrail check** dijalankan otomatis setiap kali `ProposalCalculationResult` baru dihasilkan (baik saat submit maupun re-kalkulasi):
  ```pseudo
  if result.gpm < businessLine.min_gpm_threshold:
      raise ProposalAlert(type="MARGIN_BELOW_THRESHOLD", severity="BLOCKING" | "WARNING")
  ```
  Tergantung konfigurasi, alert bisa bersifat *blocking* (mencegah submit ke step berikutnya) atau *warning* (submit boleh lanjut tapi ter-flag untuk approver).
- **Cost Outlier Alert**: bandingkan setiap `ProposalCostLine` baru terhadap distribusi historis cost item sejenis (per `cost_item_id` + `business_line`) memakai statistik sederhana (misal z-score terhadap mean/stddev N proyek terakhir, atau IQR method). Jika di luar `mean ± k*stddev` (k dikonfigurasi, default 2), tandai sebagai `COST_OUTLIER` dan tampilkan ke approver terkait.

### 7.3 Win/Loss Pricing Analytics (FR-4.3)

- Data historis (`pricing_proposal` dengan `outcome` = `WON`/`LOST`/`CANCELLED`, diisi manual oleh Sales pasca-tender atau ditarik dari CRM) di-agregasi per `business_line` + rentang waktu.
- Model rekomendasi awal (non-ML, statistik deskriptif): hitung *price band* dari distribusi `final_price / unit_cost` (markup ratio) proyek yang `WON`, bandingkan dengan yang `LOST` (biasanya markup lebih tinggi). Tampilkan sebagai rentang rekomendasi (`Optimal Price Band: markup 12%–16%`).
- Desain terbuka untuk migrasi ke model prediktif (logistic regression / gradient boosting atas fitur: markup ratio, business_line, competitor count, contract size) pada fase lanjutan — namun **bukan** kebutuhan Phase 1–3 sesuai roadmap.

---

## 8. Security & Access Control (RBAC/ABAC — NFR)

### 8.1 Model (v4.0 — role sebagai data)

- **Role** (`app_role`) dikelola di Settings dan dipetakan ke **slot
  fungsional** (`functional_role`). Seluruh pemeriksaan wewenang di kode
  memakai slot fungsional + `scope_authority`, **tidak pernah** nama role
  — sehingga menambah/mengganti nama role tidak memerlukan deploy.
- **ABAC field-level**: cost structure (seluruh `cost_group`, GM, tier,
  override) hanya diserialisasi untuk slot `SALES_OPERATIONS`,
  `SALES_RELEASER`, `SALES_PRICING_OWNER`, `COGS_OWNER`,
  `PROFITABILITY_OWNER`, `PRICING_COMMITTEE`, `SYSTEM_ADMIN`. Slot
  `SALESPERSON` dan `EXTERNAL_AGENCY` hanya menerima harga jual final.
  Pemilik scope dapat **menulis** hanya scope miliknya (per
  `scope_authority`), namun dapat **membaca** seluruh cost structure
  quotation yang sedang meminta persetujuannya.
- Serializer memakai *allow-list* per slot, bukan masking di klien.
- **Klaim JWT** hanya memuat `user_id`; role & wewenang dibaca dari DB
  per request (dengan cache pendek) agar perubahan di Settings berlaku
  seketika dan pencabutan akses agensi tidak menunggu token kedaluwarsa.

### 8.2 Permission Matrix (seed; diubah lewat Settings)

| Resource / Aksi | Salesperson (SE/SL) | Authorized Agency | Sales Ops Mgr | Head of Sales | COGS Owner | Profitability Owner | CCO / CFO | Product Owner | Admin |
|---|---|---|---|---|---|---|---|---|---|
| Price Estimate (harga excl./incl. VAT) | R | R | R | R | R | R | R | R | R |
| KYC & submit Official Quotation | RW | – | R | R | – | – | R | – | – |
| Validasi Sales Lead | Sales Lead saja | – | – | – | – | – | – | – | – |
| Generate quotation, diskon (band/manual) | – | – | **RW** | R | – | – | R | – | – |
| Revise & rilis / rute (langkah 7) | – | – | – | **RW** | – | – | – | – | – |
| Cost structure scope `COGS`, `ADD_ONS` | – | – | R | R | **M/C/R** | R | R (M/C/R saat Deviation) | – | config |
| Cost structure scope `MARGIN` | – | – | R | R | R | **M/C/R** | R (M/C/R saat Deviation) | – | config |
| Cost structure scope `SALES`, quantity band | – | – | **M/C/R** | **M/C/R** | R | R | R (M/C/R saat Deviation) | – | config |
| GM & tier quotation | – | – | R | R | R | R | R | – | R |
| Approval Tier 2 | – | – | – | – | **RW** | **RW** | – | – | – |
| Approval Tier 3 | – | – | – | – | cc | cc | **RW (keduanya)** | – | – |
| Preview dokumen draft | – | – | R | R | R* | R* | R* | – | R |
| Print / Download PDF versi rilis | **R** | – | R | R | R | R | R | – | R |
| Cost Structure Sheet (internal) | – | – | R | R | R | R | R | – | R |
| Product Master Data | R | R (ringkas) | R | R | R | – | R | **RW** | config |
| Settings: Roles & Authorities, Workflow, Tier, PPN, Template | – | – | – | – | – | – | – | – | **RW** |
| Audit log | own | – | own | own | own | own | all | own | all |

\* hanya untuk quotation yang sedang/pernah meminta persetujuannya.

### 8.3 Enforcement Layers
1. **API Gateway**: autentikasi & akses endpoint kasar (agensi hanya ke endpoint Price Estimate & katalog).
2. **Service layer**: `canPerform` (§4.8), gate workflow (§4.2), serializer *allow-list* per slot.
3. **Database**: Postgres RLS sebagai *defense in depth* — kebijakan RLS membaca tabel `user_role_assignment`/`scope_authority`, bukan kolom `role` enum.

### 8.4 Menu Access Matrix — sembunyikan & 404 (PRD FR-5.7)

Matriks default (menu → fungsi); turunan per role ada di PRD FR-5.7.

| Menu | Fungsi default yang boleh membuka |
|---|---|
| Overview | SALESPERSON, SALES_OPERATIONS, SALES_RELEASER, COGS_OWNER, PROFITABILITY_OWNER, PRICING_COMMITTEE, SYSTEM_ADMIN |
| Price Estimate | EXTERNAL_AGENCY, SALESPERSON, SALES_OPERATIONS, SALES_RELEASER, SYSTEM_ADMIN |
| Official Quotation | SALESPERSON, SALES_OPERATIONS, SALES_RELEASER, COGS_OWNER, PROFITABILITY_OWNER, PRICING_COMMITTEE, SYSTEM_ADMIN |
| Lifecycle & Approvals, DSS | SALES_OPERATIONS, SALES_RELEASER, COGS_OWNER, PROFITABILITY_OWNER, PRICING_COMMITTEE, SYSTEM_ADMIN |
| Cost Structure | SALES_PRICING_OWNER, COGS_OWNER, PROFITABILITY_OWNER, PRICING_COMMITTEE, SYSTEM_ADMIN |
| Master Data & Kurs | COGS_OWNER, PROFITABILITY_OWNER, PRICING_COMMITTEE, SYSTEM_ADMIN |
| Product Master Data | PRODUCT_OWNER, SYSTEM_ADMIN |
| Audit Trail | SALES_RELEASER, PRICING_COMMITTEE, SYSTEM_ADMIN |
| Settings | SYSTEM_ADMIN (terkunci, tidak dapat diubah) |

```pseudo
function loadMenuAccess():
    access = DEFAULT_MENU_ACCESS
    overrides = app_setting['menu_access']           # Settings → Akses Menu
    for menu in MENUS where not menu.locked:
        if overrides[menu] exists: access[menu] = overrides[menu]
    return access

function canAccessMenu(actor, menu, access):
    return any(fn in actor.app_role.functional_roles for fn in access[menu])

# Server layout — sidebar hanya menerima menu yang diizinkan
layout: menus = MENUS.filter(m => canAccessMenu(actor, m, access))

# Setiap page server memanggil guard sebelum memuat data apa pun
function requireMenu(menu):
    if not canAccessMenu(actor, menu, access):
        if menu == 'overview': redirect(landingHref(actor))   # menu pertama yang diizinkan
        notFound()                                             # 404 — halaman "tidak ada"
```

| Lapisan | Penegakan |
|---|---|
| Sidebar | Item yang tidak diizinkan tidak dirender (bukan disabled) |
| Halaman (`page.tsx`) | `requireMenu(key)` → `notFound()` (404) |
| Route API | `/api/simulate` → 404 tanpa menu DSS; export CSV → 404 tanpa fungsi SYSTEM_ADMIN |
| Server action | Pemeriksaan fungsi/langkah seperti sebelumnya + `canViewQuotation`; menolak dengan pesan "tidak ditemukan" |
| Halaman awal | `/` mengarahkan role tanpa menu Overview ke menu pertamanya; role tanpa menu → `/no-access` |

**Pemetaan halaman → menu**: `/` overview · `/price-estimate` ·
`/proposals`, `/proposals/new`, `/proposals/[id]`, `/proposals/[id]/edit`,
`/print/proposals/[id]` → quotations · `/lifecycle` · `/cost-structure`,
`/cost-structure/[id]`, `/print/proposals/[id]/cost-structure` →
cost_structure · `/dss` · `/master-data` · `/master-data/product` →
product · `/audit-log` → audit · `/settings` (dan `/admin` lama) →
settings.

### 8.5 Row-Level Quotation Visibility (PRD FR-5.7)

```pseudo
SEES_ALL = [SALES_OPERATIONS, SALES_RELEASER, COGS_OWNER,
            PROFITABILITY_OWNER, PRICING_COMMITTEE, SYSTEM_ADMIN]

function canViewQuotation(actor, q):
    if actor has any SEES_ALL: return true
    if q.created_by == actor.id or actor.id in q.account_person_ids: return true
    if actor has SALES_VALIDATOR:
        # POC tanpa hierarki tim: semua permintaan dari role Salesperson
        # yang tidak punya fungsi validator (Sales Executive)
        return q.initiator_role_code in rolesWith(SALESPERSON) - rolesWith(SALES_VALIDATOR)
    return false
```

Dipakai oleh daftar quotation, Overview (antrean & aktivitas), detail,
edit draft, dokumen Cost Estimate, dan server action quotation. Kanban
Lifecycle hanya dapat dibuka peran `SEES_ALL`. *Defense in depth* RLS
Postgres untuk aturan baris ini dicatat sebagai pekerjaan lanjutan —
pada POC, penegakan berada di service layer.

## 9. Integration Contracts (NFR — API-First)

### 9.1 ERP (SAP/Odoo) — Sinkronisasi Master BOM & Costing

| Arah | Endpoint/Mekanisme | Payload Kunci |
|---|---|---|
| ERP → PriceCore (pull) | Scheduled job `GET /erp/bom/{sku}` atau webhook `POST /webhooks/erp/bom-updated` | `sku, component_list[], unit_cost, currency, effective_date` |
| ERP → PriceCore (pull) | `GET /erp/costing/{project_id}` | actual cost realization untuk validasi historis (mendukung Cost Outlier Alert) |
| PriceCore → ERP (push) | `POST /erp/pricing/final` setelah `QUOTATION_RELEASED` (dan/atau `outcome = WON`) | `proposal_number, final_price, cost_breakdown[], approved_by, approved_at` |
| Fallback | Batch dump CSV/table export terjadwal jika ERP tidak expose API real-time | Mapping manual per tabel, di-load via ETL job harian |

**Idempotency**: setiap push ke ERP menyertakan `proposal_number` + `version_label` sebagai *idempotency key* agar retry tidak menyebabkan duplikasi entri finansial di ERP.

### 9.2 CRM (Salesforce/HubSpot)

| Arah | Endpoint/Mekanisme | Payload Kunci |
|---|---|---|
| CRM → PriceCore (pull) | `GET /crm/opportunities/{id}` saat proposal dibuat dari opportunity | `customer_name, deal_value_estimate, business_line, competitor_info` |
| PriceCore → CRM (push) | `POST /crm/opportunities/{id}/pricing` setelah `QUOTATION_RELEASED` | `final_price, pdf_url, approved_at` — memicu update stage opportunity di CRM |

### 9.3 FX & Commodity Rate Provider

- Job terjadwal (mingguan, Senin 00:01 — FR-1.4.2) menarik kurs **CNY/IDR** (basis utama, dipakai kalkulasi COGS) dari API bank rekanan (mis. BCA); kurs USD/IDR **opsional** ditarik terpisah hanya untuk toggle tampilan, dan harga acuan lithium/komoditas baterai dari provider eksternal (mis. commodity data provider — dipakai sebagai referensi HMA/HPM, §13), disimpan sebagai `external_rate_snapshot`.
- Formula Engine selalu memakai snapshot **terbaru pada saat kalkulasi resmi dijalankan** (bukan real-time streaming) — nilai rate dicatat di `pricing_proposal_version` untuk *reproducibility* audit (harga final harus bisa dijelaskan memakai rate yang mana).

### 9.4 Notifikasi

- **Email**: SMTP/transactional email provider, template per event (`SLA_BREACH`, `TARGETED_REJECT`, `ESCALATION_REQUIRED`).
- **MS Teams**: incoming webhook per department/channel, payload Adaptive Card.
- **WhatsApp**: melalui WhatsApp Business API (official), dipakai untuk eskalasi C-Level/BOD yang butuh respons cepat.

---

## 10. Non-Functional Implementation Notes

| Aspek | Pendekatan Teknis |
|---|---|
| **Real-time simulation (< 2 detik)** | Formula AST di-cache in-memory per `formula_definition.version`; evaluasi murni in-process (no external call) saat slider digeser; hasil FX/commodity dari snapshot ter-cache, bukan panggilan API eksternal per keystroke. |
| **Row-Level Versioning & Diff** | Setiap `pricing_proposal_version` immutable setelah dibuat; UI diff side-by-side dihitung on-the-fly dari dua snapshot `cost_lines`/`calculation_result` (tidak perlu tabel diff terpisah). |
| **Modern Spreadsheet UI** | Grid component (mis. berbasis canvas/virtualized table) dengan validasi inline; setiap cell edit memicu *optimistic update* + kalkulasi ulang formula ter-scope, bukan full page reload. |
| **Zero-bypass guarantee** | Validasi `canAdvanceToStep` dijalankan di **service layer**, bukan hanya di UI — mencegah bypass via direct API call. |
| **High Availability (99.5%)** | Stateless API layer (horizontal scale), workflow state di DB (bukan in-memory), notification via outbox+retry agar gangguan provider notifikasi tidak menjatuhkan transaksi utama. |
| **Auditability untuk Tbk compliance** | Audit log terpisah secara fisik (schema/database berbeda opsional) agar tidak bisa terhapus akibat kesalahan operasional pada schema transaksi utama. |

---

## 11. Margin-Tier Approval Engine (FR-6.0 – FR-6.5)

> **Revisi v4.0.** Engine negosiasi v3.0 (state machine terpisah pada
> `negotiation_request`, tier 15%/12%, Tier 2 = Sales Officer + VP
> Finance + Chief Sales, Tier 3 = 2 BOD) **digantikan**. Sheet *Basic
> Workflow* langkah 7 menempatkan routing margin sebagai bagian jalur
> rilis Official Quotation. Nama yang berubah: `negotiation_request` →
> `customer_request` (hanya intake permintaan pelanggan) dan
> `negotiation_decision` → `tier_approval`.

### 11.1 Tier Resolution — dari GM akhir

**Tangga yang dipakai (v4.1)**: tangga milik Workflow Template quotation
(`margin_tier_authority.workflow_template_code = proposal.workflow_template_code`)
bila ada; jika tidak, tangga per lini bisnis; jika tidak, tangga global.
Status persetujuan ditentukan dari slot pemutus: ada slot Pricing
Committee (CCO/CFO) → `PENDING_PRICING_COMMITTEE_APPROVAL`, selain itu
`PENDING_OWNER_APPROVAL` — sehingga template yang mewajibkan CCO & CFO
bahkan di Tier 1 (mis. B2G) tetap berlabel benar.


```pseudo
function resolveMarginTier(gm, businessLine):
    tiers = SELECT * FROM margin_tier_authority
            WHERE is_active AND (business_line = businessLine OR business_line IS NULL)
            ORDER BY (business_line IS NULL), tier ASC   # spesifik menang atas umum
    for t in tiers:
        if (t.lower IS NULL or gm >= t.lower) and (t.upper IS NULL or gm < t.upper):
            return t
    return tiers.last()        # GM negatif/ekstrem → tier tertinggi
```

| GM akhir | Tier | Keputusan | Tembusan | Tolak → |
|---|---|---|---|---|
| 17,79% | 1 | Head of Sales (saat *accept*) | – | – |
| 14,34% | 2 | COGS Owner **dan** Profitability Owner | – | Sales Operations |
| 8,95% | 3 | CCO **dan** CFO | COGS Owner, Profitability Owner | Sales Operations |

### 11.1.1 Dual-Mode Discount Input (FR-6.1.1)

```pseudo
function normalizeDiscountInput(mode, amount, pct, listPriceExVat):
    if mode == 'AMOUNT': pct = amount / listPriceExVat * 100
    else:                amount = listPriceExVat * pct / 100
    return { amount, pct }    # keduanya disimpan di quotation_line_item
```

Diinput oleh Sales Operations (step `GENERATE_QUOTATION`) atau Head of
Sales (`REVISE`); Salesperson tidak memiliki aksi ini.

### 11.2 Routing setelah Head of Sales *accept*

```pseudo
on HeadOfSalesAccept(proposal, version):
    tier = resolveMarginTier(version.gm_quotation, proposal.business_line)
    proposal.margin_tier = tier.tier
    proposal.scenario    = tier.scenario
    if tier.tier == 1:
        return tryRelease(proposal, version)                      # §4.2.1
    for slot in tier.decision_functional_roles:
        INSERT tier_approval(version, tier, slot, kind: DECISION)
    for slot in tier.cc_functional_roles:
        INSERT tier_approval(version, tier, slot, kind: CC, notified_at: now())
        notify(slot, template: 'TIER_CC')                         # informasi saja
    proposal.current_status = tier.tier == 2 ? PENDING_OWNER_APPROVAL
                                             : PENDING_PRICING_COMMITTEE_APPROVAL

on TierDecision(user, proposal, version, slot, decision, note):
    row = tier_approval(version, slot, kind: DECISION, decision IS NULL)
    require userFillsSlot(user, slot)                 # mis. user ber-role CFO untuk PRICING_COMMITTEE#CFO
    require user not already decided another slot on this version   # satu orang = satu slot
    if decision == REJECT:
        closeAll(version); proposal.current_status = PENDING_SALES_OPERATIONS
        return
    row.decision = APPROVE
    if all DECISION rows of version approved:         # AND-join
        tryRelease(proposal, version)
```

- **AND-join antar slot**: Tier 2 tidak lolos dengan hanya COGS Owner;
  Tier 3 tidak lolos dengan hanya CCO.
- **"Satu orang = satu slot"** mencegah user yang memegang dua role
  (mis. Head of Procurement yang juga ditunjuk sebagai Profitability
  Owner sementara) memenuhi dua persetujuan sendirian.
- **Persetujuan melekat pada versi**: perubahan diskon/override membuat
  versi baru → baris `tier_approval` lama tidak berlaku (§4.1).

### 11.3 Margin Impact (FR-6.4)

Dihitung lewat Pricing Engine (§3.3 B) setiap kali diskon/override
diubah, **sebelum** disimpan, dan ditampilkan ke Sales Operations & Head
of Sales: harga per unit & total (excl./incl. VAT), GM per line & agregat,
tier yang akan berlaku, dan siapa yang akan diminta persetujuan. Approver
Tier 2/3 melihat peringatan eksplisit (tier & GM) sebelum tombol Approve
aktif.

### 11.4 Negosiasi Setelah Rilis (FR-6.3)

```pseudo
function handleCustomerRequest(released, request):
    INSERT customer_request(...)
    kycChanged = request.kind in [QUANTITY_CHANGE] or request.changes_variants
    rev = createRevisionQuotation(released, reason: request.note)      # §4.6
    rev.workflow_instance.startAt = kycChanged ? 'VALIDATE' : 'GENERATE_QUOTATION'
    request.resulting_proposal_id = rev.id
```

Quotation asal tetap `QUOTATION_RELEASED` sampai `rev` dirilis, lalu
`SUPERSEDED`. Tidak ada loop negosiasi di dalam satu quotation.

### 11.5 Audit (FR-6.5)

Setiap perubahan diskon, penentuan tier, keputusan, dan tembusan menulis
`audit_log_entry` dengan `proposal_id`, `proposal_version_id`,
`project_identifier_id`, tier, GM, serta nilai diskon Rupiah & %.

## 12. Multi-Currency Engine (FR-1.4 — basis CNY/RMB)

> **Koreksi v3.0.** Basis mata uang asing utama diganti dari **USD**
> (asumsi v2.1) menjadi **CNY (Renminbi/Yuan)** — demo review
> mengonfirmasi FOB Price komponen impor VKTR dikutip vendor dalam CNY
> (BOM bersumber dari Cina), dan diskusi *rate sensitivity threshold*
> BOD eksplisit membahas RMB (kurs ilustratif Rp 2.500–2.700/RMB). USD
> tetap dapat didukung sebagai *display_currency* opsional untuk
> ringkasan ke customer, terpisah dari basis kalkulasi berikut.

### 12.1 Prinsip: simpan yang diketik, konversi saat menghitung

Nilai yang diketik pengguna **tidak pernah ditimpa** hasil konversi.
`proposal_cost_line.value` menyimpan angka apa adanya, dan
`pricing_proposal.input_currency` menyatakan mata uangnya. Konversi hanya
terjadi di lapisan kalkulasi.

Alasannya menyangkut audit: bila nilai asli ditimpa, angka yang dikirim
vendor dalam CNY akan hilang jejaknya begitu kurs berubah, dan tidak ada
cara membuktikan angka mana yang sesungguhnya dikutip.

### 12.2 Pipeline Konversi

```pseudo
function resolveRate(asOf):
    # Kurs yang berlaku pada suatu waktu = baris terbaru yang
    # effective_from-nya belum melewati waktu tersebut.
    return SELECT rate FROM exchange_rate
           WHERE base_currency = 'CNY' AND quote_currency = 'IDR'
             AND effective_from <= asOf
           ORDER BY effective_from DESC
           LIMIT 1

function toBaseCurrency(value, inputCurrency, rate):
    # Perhitungan internal seluruhnya dilakukan dalam IDR agar konsisten
    # dengan threshold, bucket eskalasi, dan data historis.
    if inputCurrency == 'IDR': return value
    if inputCurrency == 'CNY': return value * rate
```

Seluruh nilai dikonversi ke **IDR sebagai mata uang internal** sebelum
masuk formula pricing (§3). Konsekuensinya: ambang GPM, bucket eskalasi
nilai transaksi, dan statistik *cost outlier* tetap memakai satu satuan —
tidak perlu diubah oleh kehadiran multi-currency.

Untuk **tampilan** (FR-1.4.4), hasil akhir disajikan dalam keduanya:

```pseudo
display_idr = result_idr
display_cny = result_idr / rate_used
# Opsional: bila display_currency = 'USD' diaktifkan pada proposal,
# hitung terpisah memakai baris exchange_rate (base_currency='USD')
# yang berdiri sendiri — TIDAK menggantikan rate_used (CNY) di atas.
display_usd = result_idr / resolveRate(asOf, base='USD')
```

### 12.3 Rate Locking (FR-1.4.3)

> **Revisi v4.0 — kurs dikunci dua tingkat.** (1) Saat
> `cost_structure_version` dibuat, kurs berlaku disimpan di
> `locked_fx_rate` — dipakai Price Estimate dan setiap quotation baru
> dari versi itu. (2) Saat quotation di-*generate*, versi (beserta
> kursnya) dikunci per line item; `pricing_proposal.last_calculated_rate_id`
> menunjuk kurs versi tersebut. `checkRateSensitivity` (§12.5)
> dijalankan terhadap **keduanya**: banner pada versi cost structure
> aktif (aksi: COGS Owner membuat versi baru lewat M/C/R) dan pada
> quotation yang belum rilis (aksi: Sales Operations "Hitung Ulang",
> yang me-*resolve* versi `RELEASED` terbaru). Quotation yang sudah
> rilis tidak pernah dihitung ulang — perubahan harga lewat revisi.
> Contoh demo: FOB ¥185.000 pada kurs 2.600 = Rp 481.000.000; bila
> harga tetap memakai 2.600 sementara biaya riil bergerak ke 2.700, GM
> varian demo turun dari 17,79% ke 15,55% — inilah alasan ambang
> sensitivitas.

`exchange_rate_used` disimpan pada setiap `proposal_calculation_result`.
Kalkulasi ulang di kemudian hari akan memakai kurs terbaru dan
menghasilkan baris hasil **baru** — baris lama tetap utuh. Harga yang
sudah disetujui tidak berubah hanya karena kurs bergerak.

### 12.4 Currency Change Guard (FR-1.4.5)

Mengganti `input_currency` saat cost line sudah terisi **tidak** boleh
mengonversi nilai secara diam-diam:

```pseudo
on ChangeInputCurrency(proposal, newCurrency):
    if proposal has cost lines with value > 0:
        require explicit user confirmation
        # Angka lama TETAP apa adanya — kini dibaca sebagai mata uang baru.
        # Mengonversi otomatis akan mengubah harga tanpa disadari pengisi.
        writeAuditLog(action: 'UPDATE', field: 'input_currency',
                      old: proposal.input_currency, new: newCurrency)
```

### 12.5 Automatic Weekly Pull & Rate Sensitivity Threshold (FR-1.4.2, FR-1.4.6 — baru)

> **Revisi v3.0.** Kurs tidak lagi murni input manual — ditarik otomatis
> dari API bank rekanan setiap awal minggu, dan pergerakannya hanya
> memicu **notifikasi**, bukan re-kalkulasi otomatis.

**Job terjadwal (setiap Senin 00:01, atau frekuensi dari master config):**

```pseudo
scheduled_job pullWeeklyExchangeRate():
    rate = fetchFromBankApi('CNY', 'IDR')  # mis. BCA
    if rate is not null:
        INSERT INTO exchange_rate (base_currency: 'CNY', quote_currency: 'IDR',
                                    rate: rate, source: 'bank-api',
                                    effective_from: now(), pulled_at: now())
    else:
        alertAdmin("Gagal menarik kurs otomatis — fallback ke kurs terakhir/manual")
        # TIDAK membuat baris baru bila fetch gagal — quotation tetap
        # memakai kurs lama sampai Admin melakukan override manual.

    # Opsional: bila display_currency USD diaktifkan di master config,
    # tarik juga baris terpisah untuk tampilan (tidak memengaruhi COGS).
    if isDisplayCurrencyEnabled('USD'):
        usdRate = fetchFromBankApi('USD', 'IDR')
        if usdRate is not null:
            INSERT INTO exchange_rate (base_currency: 'USD', quote_currency: 'IDR',
                                        rate: usdRate, source: 'bank-api',
                                        effective_from: now(), pulled_at: now())
```

**Pemeriksaan sensitivitas (dijalankan tiap quotation dibuka, atau via job setelah pull baru):**

```pseudo
function checkRateSensitivity(proposal):
    lastRate = proposal.last_calculated_rate_id.rate  # kurs saat proposal terakhir dihitung
    currentRate = resolveRate(now())
    movementPct = abs(currentRate - lastRate) / lastRate

    threshold = getActiveConfig('rate_sensitivity_config').threshold_pct

    if movementPct > threshold:
        return {
            needsAttention: true,
            message: "Kurs CNY/IDR (RMB) telah diperbarui menjadi " + currentRate +
                     " — melebihi ambang sensitivitas " + threshold*100 + "%"
        }
    return { needsAttention: false }
    # PENTING: proposal.calculation_result TIDAK diubah oleh fungsi ini.
    # Harga quotation tetap memakai lastRate sampai pengguna menekan
    # tombol "Hitung Ulang" secara eksplisit (lihat di bawah).
```

- UI menampilkan **banner notifikasi** pada halaman quotation bila
  `needsAttention = true`, terlihat oleh Sales Officer maupun approver
  manapun yang sedang membuka quotation tersebut.
- Tombol **"Hitung Ulang"** memanggil ulang pipeline kalkulasi (§3.3)
  dengan `resolveRate(now())` — menghasilkan `proposal_calculation_result`
  baru dengan `exchange_rate_used` yang diperbarui. Baris lama tetap
  utuh (konsisten dengan §12.3 Rate Locking).
- Selama pergerakan **di bawah** ambang, sistem **tidak** menampilkan
  notifikasi maupun mengubah `last_calculated_rate_id` — harga quotation
  diam-diam tetap konsisten dengan kurs saat terakhir dihitung, sesuai
  maksud FR-1.4.6 (mencegah harga "berkedip" pada pergerakan kurs kecil).

---

## 13. Mineral Index Engine — HMA → HPM, Referensi Saja (FR-8.1 – FR-8.5)

> **Revisi v3.0 — dampak HMA hanya lewat kurs.** Demo review
> mengonfirmasi bahwa satu-satunya jalur dampak HMA/HPM ke harga
> quotation VKTR adalah **pergerakan kurs CNY/IDR (RMB)** (ditangani oleh
> Rate Sensitivity Threshold, §12.5) — bukan faktor pengali independen.
> §13.1 (formula) dan §13.4 (stale warning) **tetap berlaku** sebagai
> referensi/transparansi (FR-8.4). §13.2 (Global Adjustment Factor)
> **dinonaktifkan dari jalur kalkulasi aktif** — dipertahankan di bawah
> sebagai spesifikasi cadangan bila di masa depan ditemukan komponen
> mineral yang bergerak independen dari kurs.

### 13.1 Formula HPM (Kepmen ESDM No. 144.K/2026) — Referensi Aktif

Diturunkan dari `Simulasi_HPM_Nikel_Kepmen_2026.xlsx`. Seluruh parameter
berasal dari `hpm_parameter`, bukan konstanta di kode.

```pseudo
function computeHpm(param, hmaNi, hmaCo):
    # Correction Factor bergerak linear terhadap kadar Ni, berpusat pada
    # kadar anchor 1,6% dengan CF 30%.
    cf_ni      = param.anchor_cf_pct
               + ((param.ni_content_pct - param.anchor_content_pct) * param.cf_slope)

    value_ni   = param.ni_content_pct * cf_ni * hmaNi
    bonus_co   = param.co_content_pct * param.co_cf_pct * hmaCo

    total_dry  = value_ni + bonus_co                       # US$/dmt
    hpm_wet    = total_dry * (1 - param.moisture_content_pct)   # US$/WMT

    return { cf_ni, value_ni, bonus_co, total_dry, hpm_wet }
```

**Nilai acuan** dengan HMA Ni = US$ 16.646/dmt, HMA Co = US$ 28.500/dmt,
MC = 35%, kadar Co = 0,10%, CF Co = 20% — sesuai skenario di file simulasi:

| Skenario | Kadar Ni | CF | Nilai Ni ($/dmt) | Bonus Co | Total kering | **HPM ($/WMT)** |
|---|---|---|---|---|---|---|
| Limonit 1 | 1,3% | 27,0% | 58,43 | 5,70 | 64,13 | **41,68** |
| Limonit 2 | 1,4% | 28,0% | 65,25 | 5,70 | 70,95 | **46,12** |
| Limonit 3 | 1,5% | 29,0% | 72,41 | 5,70 | 78,11 | **50,77** |
| **Saprolit Basis (anchor)** | **1,6%** | **30,0%** | **79,90** | **5,70** | **85,60** | **55,64** |
| Saprolit Premium 1 | 1,7% | 31,0% | 87,72 | 5,70 | 93,42 | **60,73** |
| Saprolit Premium 2 | 1,8% | 32,0% | 95,88 | 5,70 | 101,58 | **66,03** |

Bonus kobalt bernilai konstan (US$ 5,70/dmt) selama kadar & CF kobalt
tidak berubah — ia tidak bergantung pada kadar nikel.

### 13.2 Global Adjustment Factor (FR-8.3) — *Status: Nonaktif pada v3.0*

> Dipertahankan sebagai spesifikasi cadangan. **Tidak dipanggil oleh
> pipeline kalkulasi aktif (§13.3)** — lihat catatan revisi di awal §13.

```pseudo
function mineralAdjustmentFactor(proposal, currentHpm):
    if proposal.baseline_hpm_value is null or proposal.baseline_hpm_value == 0:
        return 1.0                      # belum ada baseline → tanpa penyesuaian

    return currentHpm / proposal.baseline_hpm_value
```

Faktor ini *dapat* diterapkan pada cost item bertanda `is_mineral_linked`
bersamaan dengan penyesuaian FX, bila diaktifkan kembali di masa depan:

```pseudo
if item.is_mineral_linked and mineralAdjustmentEnabled:
    amount = amount * mineralAdjustmentFactor
```

Contoh (ilustratif, bukan perilaku aktif): baseline HPM 55,64 dan HPM
periode berjalan 60,73 menghasilkan faktor **1,0915** — bila diaktifkan,
item **FOB Price** (yang mengandung nilai battery pack) akan naik 9,15%
secara otomatis.

**Bila di masa depan diaktifkan**, penyesuaian tidak memerlukan approval
terpisah (dianggap sudah disetujui secara sistem), namun
`mineral_adjustment_factor`, `hpm_value_used`, dan snapshot HMA yang
dipakai tetap wajib tercatat pada hasil kalkulasi dan audit trail.

### 13.3 Urutan Penerapan pada Pipeline Kalkulasi (v3.0 — HPM referensi saja)

Memperbarui §3.3 langkah 4:

```
4. Build variable context
   4a. resolveRate(now)                  → kurs CNY/IDR berlaku (§12.2)
   4b. konversi seluruh cost line ke IDR (§12.2)
   4c. resolveCurrentHpm(mineral_code)   → HPM periode berjalan (§13.1),
       DISIMPAN untuk tampilan/transparansi (FR-8.4), TIDAK dikalikan
       ke cost line manapun
   4d. mineral_adjustment_factor = 1.0   → tetap ditulis ke hasil kalkulasi
       untuk kompatibilitas skema, selalu bernilai netral
5. Evaluasi formula seperti biasa (hanya faktor FX yang aktif memengaruhi
   item impor/BOM — lihat §12)
```

Bila `mineralAdjustmentEnabled` diaktifkan kembali di masa depan, urutan
tetap penting: **konversi mata uang lebih dulu, baru penyesuaian
faktor** — mengalikan faktor pada angka yang belum satu satuan akan
menghasilkan nilai yang salah tanpa terlihat salah.

### 13.4 Stale Index Warning (FR-8.5)

```pseudo
function isIndexStale(snapshot, maxAgeDays = 14):
    return snapshot is null or (now() - snapshot.period_end) > maxAgeDays
```

Quotation dengan indeks kedaluwarsa **tidak diblokir** — hanya ditandai,
karena menghentikan proses komersial akibat keterlambatan publikasi
regulasi akan lebih merugikan daripada risikonya. Penanda ini muncul di
halaman quotation dan pada panel approver.

### 13.5 Interaksi dengan DSS

What-If Simulator (§7.1) memperoleh slider tambahan:

| Slider | Efek |
|---|---|
| `fx_delta_pct` | menggeser kurs CNY/IDR (RMB) → menggeser hasil konversi input CNY **dan** menjadi satu-satunya jalur dampak pergerakan mineral internasional ke harga (§12.5) |
| `hma_delta_pct` | *(nonaktif v3.0)* — tersedia secara skema untuk menggeser HPM referensi (tampilan saja), **tidak** mengubah `final_price` selama `mineralAdjustmentEnabled = false` (§13.2) |

Keduanya memakai ulang fungsi yang sama dengan kalkulasi resmi — tidak
ada logika ganda antara simulasi dan perhitungan sesungguhnya.

---

## 14. Open Technical Decisions (Perlu Konfirmasi Tim)

### 14.1 Terjawab oleh sumber v4.0

| No. v3.0 | Topik | Jawaban | Sumber |
|---|---|---|---|
| 5 | Ambang tier margin | **15% / 10%** (bukan 15% / 12%); approver Tier 3 = CCO + CFO, bukan 2 BOD; `allow_bod_delegation` dihapus | Sheet *Basic Workflow* langkah 7, sheet *Actors* (Regular ≥ 10% / Deviation < 10%) |
| 6 | Keterlibatan pemilik biaya operasional dalam approval diskon | **Ya** — COGS Owner (bersama Profitability Owner) memutus Tier 2 | Sheet *Basic Workflow* 7b |
| 12 | Kepemilikan cost group | COGS & Add-Ons → COGS Owner; Margin → Profitability Owner; Sales → Sales Pricing Owner. STNK & Insurance = Add-Ons | Sheet *Actors* & *Cost Structure* |
| 13 | Struktur Format Quotation PDF | Struktur *Cost Estimate* (§2.1 `quotation_document_template`, §4.12) | PDF *Cost Estimate — PT Siborong Nusa Gemilang* |
| 14 | Daftar Workflow Template dasar | Price Estimate & Official Quotation | Sheet *Basic Workflow* |

### 14.2 Masih terbuka (dari v3.0)

1. **Bahasa/Platform backend produksi** — POC memakai Next.js + Supabase; keputusan platform produksi belum ditetapkan.
2. **Library formula evaluator** — custom parser vs `mathjs`/`jsonata`.
3. **SAP vs Odoo** — kontrak integrasi (§9.1) disesuaikan setelah ERP final.
4. **Threshold eskalasi nilai transaksi** — belum ada angka dari VKTR.
5. **Sumber & jenis kurs CNY/IDR** (tengah/jual/pajak; ketersediaan API kurs CNY dari BCA).
6. **Kadar Ni acuan & ambang kesegaran HMA** — urgensi rendah (HPM referensi saja).
7. **Qualifier Workflow Template** — v4.1 menyediakan qualifier segmen, industri, relasi, lini bisnis, qty, estimasi nilai, blacklist (daftar dapat diubah di Settings). **Masih perlu VKTR**: definisi operasional "relasi khusus" (siapa yang berhak menandai), sumber resmi daftar blacklist, dan daftar ±30 template beserta langkah & wewenang diskonnya.

### 14.3 Baru di v4.0

8. **Formula skema Rental** (§3.5) — turunan sewa bulanan dari harga unit (peran Financing Cost, tenor, nilai sisa, layanan termasuk) dan cara menghitung GM deal rental.
9. **Definisi GM untuk tier** (§3.3) — kelompok Sales sebagai *pass-through* atau pengurang; profit VKTS sebagai biaya antar-entitas atau bagian margin VKTR.
10. **Pemisahan Maker/Checker/Releaser** (§2.1 `scope_segregation_rule`) — sheet memberi ketiga wewenang ke setiap aktor; apakah wajib orang berbeda, dan siapa aktor kedua scope Margin (saat ini hanya Head of Corporate Finance).
11. **Penyimpangan per deal lewat M/C/R** (FR-1.1.3, §4.4) — interpretasi PriceCore bahwa wewenang sheet *Actors* juga berlaku untuk penyesuaian cost line per quotation (jalur manual), bukan hanya *price book*.
12. **Tingkat diskon *default*** band 2–5 dan 6–9 (§2.1 `quantity_band_config`); aturan band untuk quotation multi-varian (§4.10); apakah band 2–3 perlu konfirmasi Sales Operations atau langsung diteruskan seperti band 1.
13. **Satu atau dua COGS Owner** yang memutus Tier 2 (seed: salah satu cukup).
14. **Tier pada agregat vs per line** untuk quotation multi-varian (§3.3).
15. **Tarif PPN** yang dipakai dan dasar pengenaannya (§2.1 `tax_rate`).
16. **Dokumen**: arti segmen nomor `L`, `RNT`, `EFS` dan cakupan urutan nomor; judul resmi ("Cost Estimate" vs "Official Quotation"); pernyataan "*not binding … confirmed post assessment*" berarti ada tahap *assessment* setelah dokumen ini — apakah perlu dokumen kedua (quotation mengikat) di sistem.
17. **Nama *Prepared By*** untuk quotation band 1 yang di-*generate* otomatis.
18. **Revisi yang mengubah KYC** wajib validasi Sales Lead ulang? (seed: ya).
19. **Pemegang peran Product Owner** — tidak ada di sheet *Actors*.
20. **Migrasi POC → v4.0**: quotation berjalan pada status v3.0 (`PENDING_COGS_VALIDATION`, `PENDING_CHIEF_SALES_REVIEW`, `PENDING_BOD_APPROVAL`) ditutup atau diselesaikan dengan alur lama sebelum *cut-over*; koreksi STNK/Insurance ke `ADD_ONS` menurunkan GM data historis — perlu keputusan apakah data demo historis dihitung ulang.

---

## 15. Traceability Matrix (FR → Technical Component)

| FR | Modul Teknis |
|---|---|
| FR-1.1 (CBS tunggal, kepemilikan terkonfirmasi), FR-1.1.1 (Sales group) | `cost_item` (§2.1) |
| **FR-1.1.2 (Cost Structure per varian + M/C/R)** | `cost_structure_version`, `cost_structure_scope_state`, `scope_authority`, `scope_segregation_rule` (§2.1), engine §4.8 |
| **FR-1.1.3 (penyimpangan per deal, Deviation)** | `quotation_cost_override` (§2.1), §4.4, §4.8 |
| FR-1.2 (formula, GM setelah diskon excl. VAT) | Formula Engine §3.3 |
| FR-1.4 (multi-currency CNY, rate locking per versi, sensitivity) | `exchange_rate`, `cost_structure_version.locked_fx_rate` (§2.1), §12 |
| FR-1.5.1–1.5.2 (Product Master Data varian) | `product_master_data` (§2.1) |
| **FR-1.5.3 (format Cost Estimate)** | `quotation_document_template` (§2.1), §4.12 |
| **FR-1.5.4 (preview & cetak)** | `renderQuotationDocument`, `document_render` (§4.12) |
| **FR-1.6 (PPN)** | `tax_rate` (§2.1), §3.3 B6 |
| **FR-1.7 (Purchase/Rental)** | `quotation_line_item.scheme` (§2.1), §3.5 |
| **FR-2.0.1 v4.1 (katalog multi-template, qualifier, tier per template)** | `templateCatalog.ts` (`resolveTemplate`), migrasi 0017, Settings → Workflow (daftar `WorkflowCatalog.tsx`; detail/tambah/ubah `settings/workflow/[code]`, `new`, `[code]/edit`; `loadTemplateBundle`, `describeQualifiers`), `saveTemplateAction`, `loadLadder(templateCode)` (§4.1a, §11.1) |
| FR-2.0, FR-2.0.1, FR-2.0.2, **FR-2.1 (workflow configurable)** | `workflow_definition`, `workflow_step_definition` (§2.1), §4.1, §4.1a |
| FR-2.2 (gate & release gate, Exclusion At cost) | `canSubmitQuotation`, `canGenerate`, `canReleaseQuotation` (§4.2, §4.2.1) |
| FR-2.3, FR-2.4 | §4.3, §4.4 |
| FR-2.5 (Project Identifier, kaitan KYC c) | `project_identifier`, `createRevisionQuotation` (§4.6) |
| FR-2.6 (Fraud Guard) | `canCreateNewQuotation` (§4.7) |
| **FR-2.7 (Price Estimate)** | `getPriceEstimate`, `price_estimate_log` (§4.9) |
| **FR-2.8 (Quantity Band)** | `quantity_band_config` (§2.1), `resolveBand` (§4.10) |
| **FR-2.9 (nomor, masa berlaku, EXPIRED)** | §4.11 |
| **FR-2.10 (penerimaan pelanggan)** | `pricing_proposal.outcome`, `accepted_document_url` (§2.1) |
| FR-3.1 – FR-3.3 | Dashboard (status §4.1 & antrean M/C/R), SLA Job §5, Audit §6 |
| FR-4.1 – FR-4.3 | DSS §7 (+ tier yang berlaku, Likelihood KYC) |
| **FR-5.7 (Menu & data access per role, 404)** | `src/lib/menuAccess.ts` (`MENUS`, `requireMenu`, `canViewQuotation`), `app_setting.menu_access`, Settings → Akses Menu (§8.4, §8.5) |
| **FR-5.6 (Roles & Authorities Settings)** | `app_role`, `functional_role`, `user_role_assignment`, `scope_authority` (§2.1), §8 |
| **FR-6.0 – FR-6.5 (diskon & tier 15/10)** | `margin_tier_authority`, `tier_approval`, `customer_request` (§2.1), §11 |
| **FR-7.1 – FR-7.4 (KYC)** | `customer_kyc`, `pricing_proposal.kyc_snapshot` (§2.1), `canSubmitQuotation` (§4.2) |
| FR-8.1 – FR-8.5 (Mineral Index, referensi) | §13 |
| NFR Security | RBAC/ABAC berbasis data (§8) |
| NFR Integrasi | §9 |
