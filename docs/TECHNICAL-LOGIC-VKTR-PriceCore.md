# Technical Logic & System Design Document

## VKTR-PriceCore — Enterprise Smart Pricing & Decision Support System

| | |
|---|---|
| **Document Version** | 3.0 (Post-Demo Revision — Single Master Data, Workflow Templates, Margin-Tier Authority) |
| **Companion Document** | `PRD-VKTR-PriceCore.md` v3.0 |
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

> **Revisi v3.0.** `CBSTemplate` kini bersifat **tunggal secara efektif**
> (satu template aktif per waktu, bukan satu per lini bisnis) — struktur
> ERD tidak berubah bentuk, namun makna `business_line` pada
> `cbs_template` bergeser dari *kunci pemilihan CBS* menjadi *kunci
> pemilihan Workflow Template* (lihat §2.1 & §4.1a). Ditambahkan
> `ProjectIdentifier`, `ProductMasterData`, dan `WorkflowTemplateQualifier`
> sebagai entitas baru.

```
Organization ──< Department ──< User ──< Role ──< Permission

CostItem (master, grup: COGS/Profitability/Sales/AddOns) ──< CostItemVersion
    │
    ▼
CBSTemplate (efektif tunggal) ──< CBSTemplateNode (tree: parent_id self-ref)
    │                   │
    │                   └─> references CostItem
    ▼
ProjectIdentifier (customer + project/lokasi)
    │
    ▼
PricingProposal ──< PricingProposalVersion (v1.0, v1.1, ...)
    │                   │
    │                   ├─< ProposalCostLine (snapshot value per CostItem)
    │                   ├─< ProposalMarginFactor
    │                   ├─< ProposalCalculationResult (GPM, EBITDA, BEP)
    │                   └─> ProductMasterData (produk yang di-quote)
    │
    ├─< WorkflowInstance ──< WorkflowStepInstance ──< ApprovalAction
    │         │
    │         └─> WorkflowDefinition (satu dari banyak template dalam katalog,
    │             dipilih via WorkflowTemplateQualifier — FR-2.0.1)
    │
    ├─< AuditLogEntry (who, what, when, why, before/after diff)
    │
    └─< ExternalSyncRecord (ERP/CRM push-pull status)

FormulaDefinition ──> satu formula dasar, dipakai oleh CBSTemplate / PricingProposal
ExternalRateSnapshot (FX, commodity) ──> dipakai saat kalkulasi & simulasi

WorkflowTemplateQualifier (business_line, min_value, max_value, dll.)
    │
    ▼
WorkflowDefinition (katalog — banyak baris, terus bertambah)

MarginTierAuthority (tier 1/2/3 → gpm_threshold, required_approvers[])
    │
    ▼
NegotiationRequest ──< NegotiationDecision (APPROVE/REJECT/REVISE)
    │
    └─> milik satu PricingProposal (quotation)

ExchangeRate (CNY→IDR, effective_from, source: bank-api|manual)  ──> dipakai saat konversi & kalkulasi
    │
    ├─> di-snapshot ke ProposalCalculationResult
    └─> RateSensitivityCheck (ambang %, memicu notifikasi — tidak auto-recalculate)

MineralIndexSnapshot (HMA per mineral, periode + ref Kepmen) ── referensi/transparansi saja (§13)
    │
    ▼
HpmParameter (kadar, CF, moisture content — master config)
    │
    ▼
HPM terhitung (ditampilkan, TIDAK dipakai sebagai adjustment factor aktif pada v3.0)
```

### 2.1 Tabel Inti (ringkas)

**`cost_item`** (Master Cost Item — FR-1.1, **struktur riil v3.0**)

> Menggantikan daftar item ilustratif v2.0/v2.1. `cost_group` mengikuti
> 4 kelompok pada `BTEL-CostStructure.xlsx`; `owner_department_id` per
> kelompok adalah **asumsi PriceCore, wajib dikonfirmasi VKTR** sebelum
> dipakai sebagai gatekeeping resmi (lihat PRD §14 no. 12 baru).

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| code | varchar unique | e.g. `COGS-FOB-CNY`, `SALES-AGENCY-FEE` |
| name | varchar | e.g. `FOB Price in CNY`, `Agency Fee` |
| cost_group | enum | **`COGS`**, **`PROFITABILITY`**, **`SALES`**, **`ADD_ONS`** — 4 kelompok riil VKTR/BTEL |
| category | enum | `DIRECT`, `INDIRECT` — klasifikasi pelaporan Finance, independen dari `cost_group` |
| owner_department_id | FK Department | **COGS Owner** *(asumsi, perlu konfirmasi)*: `COGS`→VP_OPERATIONS, `PROFITABILITY`→VP_FINANCE, `SALES`→SALES_OFFICER, `ADD_ONS`→VP_OPERATIONS. Menggerakkan gatekeeping FR-2.2 & re-verifikasi FR-2.4 |
| unit_type | enum | `FIXED`, `PER_UNIT`, `PERCENTAGE`, `FORMULA` |
| denomination | enum | `CNY`, `IDR` — item BOM/impor (mis. FOB Price in CNY dikonversi via kurs CNY→IDR, item lokal dalam IDR); dipakai bersama `pricing_proposal.input_currency` (§12) |
| is_mandatory | boolean | dipakai gatekeeping FR-2.2 |
| may_follow_later | boolean | **baru** — item boleh diisi belakangan tanpa menghentikan penyusunan harga dasar (mis. Delivery Service pada kelompok `ADD_ONS`); tetap wajib terisi sebelum `QUOTATION_RELEASED` |
| active | boolean | soft-disable, bukan delete |

Contoh isi per `cost_group` (referensi lengkap: PRD §3 Module 1 FR-1.1):

| cost_group | Contoh item |
|---|---|
| `COGS` | FOB Price in CNY/IDR, Freight and Insurance, Custom Duties, Port Handling & Clearance & PDI, Carrosserie Allocation, Assembly Cost, Local Parts, Accessories, Telematics, Warehousing and Storage, Warranty Cost, Initial Energy Injection, Administrative Cost |
| `PROFITABILITY` | VKTS Profit Before Tax, VKTS Margin, VKTR Profit Before Financing Cost, Financing Cost, VKTR Margin After Financing Cost |
| `SALES` | STNK, Insurance, Incentive Internal, Incentive External, Sales Processing Cost, Agency Fee |
| `ADD_ONS` | Processing Service, Delivery Service (`may_follow_later = true`), KEUR, Additional |

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

**`product_master_data`** (FR-1.5 — baru, dikelola Product Owner)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| code | varchar unique | e.g. `EVBUS-12M-STD` |
| name | varchar | nama model/varian |
| chassis_variant, body_variant | varchar | varian sasis/karoseri |
| spec_sheet | jsonb | spesifikasi teknis terstruktur |
| image_urls | text[] | foto/gambar produk |
| brochure_url | text nullable | |
| status | enum | `ACTIVE`, `DISCONTINUED` — soft-disable agar quotation lama tetap merujuk data yang berlaku saat itu |
| created_by / updated_at | | actor = Product Owner |

**`quotation_document_template`** (FR-1.5.3 — baru)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| name | varchar | |
| applies_to | varchar nullable | opsional scoping tampilan per lini bisnis (data sumber tetap sama, lihat FR-1.5.3) |
| layout_schema | jsonb | definisi field & urutan tampil pada PDF |
| version | int | |
| is_active | boolean | |

**`project_identifier`** (FR-2.5 — baru)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| identifier_code | varchar unique | alfanumerik, *generated* sistem (bukan diketik Sales) |
| customer_name | varchar | |
| project_name | varchar | nama proyek/lokasi — membedakan >1 proyek untuk customer yang sama |
| created_by, created_at | | |

**`pricing_proposal`** (root transaksi)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| proposal_number | varchar unique | human-readable, e.g. `PRC-2026-0042` |
| project_identifier_id | FK → project_identifier | **baru** — mengaitkan quotation ke satu project untuk keperluan versioning (FR-2.5) |
| business_line | varchar | kini murni untuk **pemilihan Workflow Template** (§4.1a), bukan pemilihan CBS |
| customer_ref | varchar | referensi ke CRM (opsional) |
| current_version_id | FK → pricing_proposal_version | pointer ke versi aktif |
| current_status | enum | lihat state machine §4; termasuk `SUPERSEDED` (baru, FR-2.5) |
| supersedes_proposal_id | FK nullable | **baru** — quotation sebelumnya pada Project Identifier yang sama, bila ada |
| transaction_value | numeric | dipakai untuk eskalasi threshold |
| created_by, created_at | | dipakai juga oleh Duplicate/Fraud Guard (FR-2.6, §4.7) |

**`pricing_proposal_version`** (Row-Level Versioning — FR-5 NFR, FR-2.4)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| proposal_id | FK | |
| version_label | varchar | `v1.0`, `v1.1` |
| parent_version_id | FK nullable | untuk *diff/side-by-side* |
| snapshot_cbs_template_id | FK | template yang dipakai saat versi ini dibuat (immutability terhadap perubahan template di masa depan) |
| product_master_data_id | FK nullable | **baru** — produk yang di-*quote*, dari FR-1.5 |
| cost_lines | jsonb / relasi `proposal_cost_line` | snapshot nilai tiap cost item |
| calculation_result | jsonb | GPM, EBITDA, BEP, total price |
| created_by, created_at, change_reason | | mendukung *why* di audit trail |

**`workflow_definition`** & **`workflow_step_definition`** (FR-2.0.1, FR-2.1 — **katalog v3.0**)
- `workflow_definition`: id, **template_name** (baru, mis. `"B2G Tender — Standard"`, `"Margin Tier Escalation"`), qualifier_type (enum: `BUSINESS_LINE`, `MARGIN_TIER`, `CUSTOM`), business_line (nullable), min_value, max_value (untuk *escalation bucket*), is_active, version. **Bukan lagi satu baris per lini bisnis** — katalog dapat memiliki banyak baris aktif sekaligus, dipilih oleh `resolveWorkflowTemplate` (§4.1a).
- `workflow_step_definition`: id, workflow_definition_id, step_order, department_id, mode (`SEQUENTIAL`/`PARALLEL_GROUP`), parallel_group_id (nullable), is_mandatory_gate (boolean), sla_hours.
- Dua baris minimum yang wajib ada saat go-live (PRD FR-2.0.2 — *Basic Workflow*): satu dengan `qualifier_type = MARGIN_TIER`, satu dengan `qualifier_type = BUSINESS_LINE`.

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
| action | varchar (`CREATE`,`UPDATE`,`APPROVE`,`REJECT`,`ESCALATE`,`SYNC`) |
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

**`margin_tier_authority`** (FR-6.1 — **menggantikan `discount_authority`**, matriks wewenang berbasis GPM akhir, *master config*)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| tier | int | `1` (Auto), `2` (3-Pihak), `3` (2-BOD) |
| business_line | enum nullable | `null` = berlaku untuk semua lini bisnis |
| gpm_lower_bound_pct | numeric(6,4) nullable | batas bawah GPM untuk tier ini (`null` pada tier 3 = tanpa batas bawah) |
| gpm_upper_bound_pct | numeric(6,4) nullable | batas atas GPM untuk tier ini (`null` pada tier 1 = tanpa batas atas) |
| required_roles | jsonb (`user_role[]`) | tier 1: `[]`; tier 2: `["SALES_OFFICER","VP_FINANCE","CHIEF_SALES"]` (AND-join); tier 3: `["BOD","BOD"]` (dua approver berperan sama, lihat §11.1) |
| allow_bod_delegation | boolean | opsi *bypass* tier 2→BOD via pelimpahan wewenang tercatat; default `false` (PRD FR-6.1) |
| is_active | boolean | |

> Ambang batas **tidak boleh hardcode** — perubahan kebijakan tier
> dilakukan lewat data, bukan rilis ulang aplikasi (FR-6.1). Nilai
> ilustratif hasil rapat: Tier 1 ≥ 15%, Tier 2 antara 12%–15%, Tier 3
> < 12% (batas aman 12% dikunci meski `allow_bod_delegation` aktif).

**`negotiation_request`** (FR-6.2 — permintaan diskon dari pelanggan, **direvisi ke basis tier margin**)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| proposal_id | FK pricing_proposal | quotation yang dinegosiasikan |
| discount_input_mode | enum | **baru** — `AMOUNT` (Rupiah) atau `PERCENTAGE`, sesuai mode yang diinput Sales (FR-6.1.1) |
| requested_discount_amount | numeric(18,2) nullable | terisi bila `discount_input_mode = AMOUNT` |
| requested_discount_pct | numeric(6,4) | selalu dihitung/disimpan sebagai % setara, terlepas dari mode input |
| customer_note | text | konteks/alasan permintaan |
| required_tier | int | **baru, menggantikan `required_role`** — dihitung sistem dari GPM akhir (anti *authority bypass*) |
| required_roles_snapshot | jsonb | salinan `required_roles` dari `margin_tier_authority` saat request dibuat, untuk audit bila master config berubah kemudian |
| status | enum | `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `REVISED`, `SUPERSEDED` |
| price_before | numeric(18,2) | harga sebelum diskon (snapshot) |
| price_after | numeric(18,2) | harga setelah diskon (snapshot) |
| gpm_after | numeric(8,5) | GPM setelah diskon — dasar penentuan tier (FR-6.2) & peringatan margin (FR-6.4) |
| parent_request_id | FK nullable | terisi bila request ini hasil `REVISE` dari request sebelumnya |
| requested_by / created_at | | |

**`negotiation_decision`** (FR-6.3, FR-6.5 — append-only)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| negotiation_request_id | FK | |
| actor_id | FK profile | pengambil keputusan — pada tier 2, satu baris per anggota AND-join (Sales/VP Finance/Chief Sales); pada tier 3, satu baris per BOD |
| decision | enum | `APPROVE`, `REJECT`, `REVISE` |
| counter_discount_amount | numeric(18,2) nullable | alternatif Rupiah untuk counter-offer |
| counter_discount_pct | numeric(6,4) nullable | wajib diisi salah satu (Rupiah/%) bila `decision = REVISE` |
| note | text | |
| created_at | timestamptz | |

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

### 3.3 Evaluation Pipeline

```
1. Load CBSTemplate (tree) — tunggal, tidak lagi per business_line
2. Resolve seluruh cost_item leaf-node → ambil ProposalCostLine (input user),
   dikelompokkan per cost_group (COGS / PROFITABILITY / SALES / ADD_ONS)
3. Resolve FormulaDefinition aktif dengan scope=GLOBAL (default v3.0)
4. Build variable context: { cost_items..., margin_factors..., fx_rate... }
5. Parse expression → AST (cached per formula version)
6. Evaluate AST dengan variable context → hasil per node (bottom-up melalui tree)
7. Aggregate ke top-level: total_cost (COGS + Add-Ons), total_margin (Profitability),
   sales_addon_total (Sales, FR-1.1.1), final_price
8. Compute derived metrics: GPM = (final_price - total_cost) / final_price
                             EBITDA_contribution = final_price - total_cost - fixed_overhead_alloc
                             BEP (units) = fixed_cost / (unit_price - unit_variable_cost)
9. resolveMarginTier(GPM, business_line) → margin_tier (§11.1), disimpan di hasil
   meski quotation belum dinegosiasikan (dasar Tier saat rilis)
10. Persist sebagai ProposalCalculationResult (immutable snapshot per version)
```

Untuk **What-If Simulator (FR-4.1)**, langkah 4–8 dijalankan ulang secara *stateless* (tanpa persist) dengan variable context yang dimodifikasi oleh nilai slider — endpoint terpisah `POST /simulations/what-if` yang idempotent dan tidak menyentuh `pricing_proposal_version`.

### 3.4 Validasi Formula saat Disimpan
- Cek semua variabel dalam ekspresi terdaftar di `input_variables` (no undefined ref).
- Cek tidak ada *circular reference* antar node CBS (topological sort pada tree; tolak jika ada siklus).
- Uji unit: jalankan dengan data dummy untuk memastikan tidak ada divide-by-zero pada BEP.

---

## 4. Workflow State Machine (FR-2.0.1, FR-2.1 – FR-2.4)

### 4.0 Tiga Fase Lifecycle — Batas Tegas antar State Machine

Seluruh siklus hidup satu quotation berjalan lewat **tiga fase**, dan
tiap fase punya state machine sendiri dengan field status yang berbeda
di database. Ini penting dipahami sebelum §4.1–§4.7 karena banyak
kebingungan "workflow mana yang dikonfigurasi Admin" berasal dari
menyamakan ketiganya:

| Fase | Field status | Siapa menentukan alurnya | Bisa dikonfigurasi via `/admin`? |
|---|---|---|---|
| **1. Pembuatan** | `pricing_proposal.current_status = 'DRAFT'` | Hardcoded di kode (Sales Officer selalu mengisi lebih dulu) | **Tidak** — bukan bagian dari `workflow_definition` sama sekali, tidak ada `workflow_step_definition` untuk fase ini |
| **2. Approval (COGS Validation)** | `pricing_proposal.current_status` (`PENDING_COGS_VALIDATION` → `PENDING_CHIEF_SALES_REVIEW` → `QUOTATION_RELEASED`) | `workflow_definition` + `workflow_step_definition` terpilih (§4.1a) | **Ya** — inilah yang diatur lewat Create Workflow Template |
| **3. Negosiasi + Approval** | `negotiation_request.status` (`PENDING_APPROVAL` → `APPROVED`/`REJECTED`/`REVISED`) — **field terpisah, bukan sub-status `pricing_proposal.current_status`** | `margin_tier_authority` (tier GPM → role wajib, §11) | Sebagian — tier terlihat di `/admin`, belum ada form edit ambang |

**Kenapa Fase 1 tidak masuk Workflow Template.** Fase ini adalah
prasyarat data (harga tidak dapat dihitung tanpa input customer/unit
dari Sales), bukan proses approval — tidak ada aktor yang perlu
menyetujui/menolak input Sales di titik ini. Karena itu tidak ada
baris `workflow_step_definition` untuknya, dan Admin tidak bisa
mengubah "siapa mengisi duluan" lewat UI Workflow Template.

**Kenapa Fase 3 adalah mesin state terpisah dari Fase 2, bukan
kelanjutannya.** `pricing_proposal.current_status` **tidak pernah**
berubah menjadi status "sedang negosiasi" — begitu mencapai
`QUOTATION_RELEASED`, nilai `current_status` proposal tidak berubah
lagi kecuali menjadi `SUPERSEDED` (§4.6). Proses negosiasi berjalan
sepenuhnya di tabel `negotiation_request`/`negotiation_decision` yang
menunjuk balik ke proposal via `pricing_proposal_id`, tapi tidak
menuliskan statusnya ke `current_status`. Ini yang membuat Fase 2 dan
Fase 3 dapat dikonfigurasi secara **independen** — mengubah Workflow
Template (Fase 2) tidak memengaruhi tier margin (Fase 3), dan
sebaliknya. Kombinasi keduanya (varian Workflow Template × varian
tier margin) adalah sumber utama mengapa jumlah "workflow" yang
dipersepsikan pengguna bisnis bisa terasa lebih dari selusin, padahal
secara struktural hanya ada dua mesin state.

> **Koreksi v3.0.1.** Versi draf sebelumnya (§4.1 di bawah) sempat
> menuliskan `PENDING_TIER2_APPROVAL`/`PENDING_TIER3_BOD_APPROVAL`
> seolah nilai `pricing_proposal.current_status`. Ini tidak sesuai
> implementasi — `ProposalStatus` di `database.ts` tidak memiliki nilai
> tersebut. Status tier berjalan di `negotiation_request.status`
> sesuai tabel di atas; diagram §4.1 telah diperbaiki.

### 4.1 Status Utama Proposal (`pricing_proposal.current_status`)

> **Revisi v3.0 — urutan aktor dikoreksi.** Sales Officer mengisi
> **lebih dulu** (data customer/unit, tanpa akses breakdown biaya), lalu
> **VP Operations wajib menyelesaikan approval-nya lebih dulu**, baru
> **VP Finance** terbuka untuk diisi (**sekuensial, dua `step_order`
> terpisah** — bukan satu `parallel_group_id` seperti asumsi v2.0/v2.1),
> baru **Chief Sales** merakit & merilis. Ini mengoreksi dua hal
> sekaligus: urutan v2.0 yang menempatkan Chief Sales sebagai penyusun
> awal, dan asumsi v2.0/v2.1 bahwa VP Operations ∥ VP Finance berjalan
> paralel. Mekanisme `PARALLEL_GROUP` (§4.2) tetap tersedia sebagai
> kapabilitas Workflow Template lain yang mungkin dibutuhkan di masa
> depan (lihat §4.1a), tapi **Basic Workflow default v3.0 sekuensial
> penuh**.

```
DRAFT                                 ← Sales Officer input data customer,
                                         unit, qty, estimasi delivery,
                                         komisi makelar (FR-2.0). TIDAK
                                         mengisi/melihat breakdown COGS.
  → PENDING_COGS_VALIDATION           ← satu status, step_order berurutan
                                         (bukan paralel) sesuai Workflow
                                         Template terpilih (§4.1a), default:
      1. VP_OPERATIONS  (COGS, Add-Ons operasional — delivery may_follow_later)
      2. VP_FINANCE     (Profitability, margin policy, OPEX) — terbuka
                          HANYA setelah step 1 APPROVED
                  │ Setiap step harus APPROVED sebelum step berikutnya
                  │ dibuka (canAdvanceToStep, §4.2)
                  ▼
    → PENDING_CHIEF_SALES_REVIEW      ← Chief Sales meninjau hasil rakitan & approve
        → QUOTATION_RELEASED          ← release gate: semua COGS mandatory terisi (FR-2.2)
QUOTATION_RELEASED → EXPORTED_TO_ERP
QUOTATION_RELEASED → SUPERSEDED       ← saat quotation baru pada Project Identifier
                                         yang sama dirilis (FR-2.5, §4.6)

(negosiasi diskon berjalan sebagai state machine TERPISAH — §4.0, §11 —
 `pricing_proposal.current_status` TIDAK berubah menjadi status tier;
 yang berubah adalah `negotiation_request.status`):
    negotiation_request.status = PENDING_APPROVAL  ← GPM akhir menentukan tier (1/2/3)
                                                       via margin_tier_authority (§11.1)
    negotiation_request.status = APPROVED | REJECTED | REVISED

(dari state manapun sebelum QUOTATION_RELEASED, §4.3):
  → TARGETED_REJECT(target)    → kembali ke step target, status proposal kembali ke
                                  status milik step tersebut tanpa mereset versi/draft
```

Urutan step konkret **tidak** hardcoded — diturunkan dari
**Workflow Template** yang dipilih otomatis untuk proposal tersebut
(§4.1a), bukan lagi sekadar `business_line` + `transaction_value`
bucket seperti v2.1 (mendukung FR-2.0.1/FR-2.1 no-code configurator).

**Catatan status `PENDING_COGS_VALIDATION`.** Status ini adalah satu
label proposal yang menaungi **dua `step_order` berurutan** (VP
Operations = 1, VP Finance = 2) pada Basic Workflow default v3.0 —
**bukan** satu `step_order` bersama dengan `parallel_group_id` identik
seperti asumsi v2.0/v2.1. UI menampilkan progres per COGS Owner secara
terpisah (FR-3.1) sehingga tetap terlihat sebagai satu fase besar bagi
pengguna, namun state machine di baliknya menegakkan urutan sekuensial:
step VP Finance baru `IN_PROGRESS` setelah step VP Operations
`APPROVED`. Mekanisme `parallel_group_id` (AND-join dalam satu
`step_order`, §4.2) tetap ada di skema dan dapat dipakai Workflow
Template *lain* yang dibuat lewat `/admin` bila suatu saat dibutuhkan.

### 4.1a Workflow Template Resolution (FR-2.0.1 — baru)

Menggantikan pemilihan `workflow_definition` tunggal per `business_line`
(v2.1) dengan pemilihan dari **katalog** berdasarkan *qualifier*:

```pseudo
function resolveWorkflowTemplate(proposal):
    # Qualifier bersifat statis (jarang berubah); yang bertambah adalah
    # jumlah baris workflow_definition dalam katalog.
    candidates = SELECT * FROM workflow_definition
                 WHERE is_active = true
                   AND (business_line IS NULL OR business_line = proposal.business_line)
                   AND (min_value IS NULL OR proposal.transaction_value >= min_value)
                   AND (max_value IS NULL OR proposal.transaction_value <= max_value)
                 ORDER BY specificity DESC, version DESC
                 # specificity: baris dengan qualifier lebih spesifik menang
                 # atas baris generik (mis. business_line spesifik > NULL)

    if candidates.isEmpty():
        return CONFIG_ERROR  # gap konfigurasi — alert Admin, bukan default diam-diam (§4.5)

    return candidates.first()  # dikunci sebagai workflow_definition_id pada workflow_instance
```

- **Basic Workflow minimal dua varian** (PRD FR-2.0.2) tersedia sejak
  go-live: satu qualifier berbasis `MARGIN_TIER` (workflow eskalasi
  mengikuti tier margin, dipakai bersama Negotiation Engine §11), satu
  berbasis `BUSINESS_LINE` (mis. B2G mensyaratkan tahap tambahan
  dibanding B2B/B2C). Keduanya dapat aktif bersamaan untuk proposal yang
  sama — satu mengatur *approval COGS*, satu lagi mengatur *approval
  diskon* (Module 6 tetap punya state machine sendiri, §11).
- Admin menambah baris `workflow_definition` baru kapan saja; proposal
  yang sedang berjalan **tidak terpengaruh** karena `workflow_instance`
  mengunci `workflow_definition_id` saat instance dibuat.
- Bila ditemukan >1 kandidat dengan spesifisitas sama, sistem memilih
  yang paling baru (`version DESC`) dan mencatat *warning* ke Admin
  bahwa qualifier tumpang tindih perlu dirapikan.

### 4.2 Strict Gatekeeping (FR-2.2)

Aturan inti: *step N tidak boleh berpindah ke `IN_PROGRESS` sebelum step N-1 berstatus `APPROVED`/`APPROVED_WITH_CONDITIONS`, dan seluruh `is_mandatory_gate` cost item untuk step tersebut sudah terisi.*

```pseudo
function canAdvanceToStep(instance, targetStepOrder):
    # AND-join: SEMUA step dengan step_order lebih kecil harus selesai,
    # termasuk seluruh anggota parallel group sebelumnya.
    priorSteps = instance.steps.filter(s => s.step_order < targetStepOrder)
    blocking = priorSteps.filter(s => s.status not in [APPROVED, APPROVED_WITH_CONDITIONS])
    if blocking.length > 0:
        return false, "Menunggu: " + blocking.map(s => s.department.name)

    return true

# Gate per COGS Owner sebelum ia boleh menyetujui stepnya sendiri
function canApproveStep(step, proposal):
    mandatoryItems = getMandatoryCostItems(step.department_id, proposal.cbs_template)
    missing = mandatoryItems.filter(item => !hasValue(proposal.cost_lines, item))
    if missing.length > 0:
        return false, "Komponen COGS mandatory belum lengkap: " + missing
    return true
```

**Mode PARALLEL_GROUP.** Seluruh step dalam `parallel_group_id` yang sama
di-set `IN_PROGRESS` bersamaan saat grup dibuka. Step berikutnya baru bisa
maju setelah **semua** anggota grup `APPROVED` (AND-join). Mekanisme ini
**tidak dipakai Basic Workflow default v3.0** — VP Operations dan VP
Finance di sana adalah dua `step_order` sekuensial, bukan satu
`parallel_group_id` — tapi tersedia sebagai kapabilitas skema untuk
Workflow Template lain yang di masa depan benar-benar memerlukan
beberapa approver bekerja bersamaan pada satu tahap.

### 4.2.1 Release Gate (FR-2.2 — penjaga *margin leakage*)

Sebelum proposal boleh berpindah ke `QUOTATION_RELEASED`, dijalankan
validasi menyeluruh — bukan hanya per departemen:

```pseudo
function canReleaseQuotation(proposal):
    # 1. Seluruh komponen mandatory di CBS template harus terisi,
    #    apa pun pemiliknya (bukan hanya milik step terakhir).
    #    Item bertanda may_follow_later (mis. Delivery Service) TETAP
    #    termasuk di sini — ia hanya dikecualikan dari gate "harga dasar
    #    dapat dihitung" (lihat catatan di bawah), bukan dari release gate.
    allMandatory = proposal.cbs_template.items.filter(i => i.is_mandatory)
    missing = allMandatory.filter(i => !hasValue(proposal.cost_lines, i))
    if missing.length > 0:
        return false, "COGS belum lengkap: " + missing

    # 2. Seluruh COGS Owner harus sudah memberi persetujuan.
    if instance.steps.any(s => s.status not in [APPROVED, APPROVED_WITH_CONDITIONS]):
        return false, "Masih ada COGS Owner yang belum menyetujui"

    # 3. Tier margin (§11.1) — Tier 2 & 3 memerlukan persetujuan
    #    sesuai required_roles pada margin_tier_authority sebelum rilis.
    tier = resolveMarginTier(result.gpm, proposal.business_line)
    if tier > 1 and not proposal.hasAllRequiredApprovalsForTier(tier):
        return false, "Margin jatuh ke Tier " + tier + " — menunggu approval sesuai matriks wewenang"

    return true
```

Tiga pemeriksaan ini dijalankan di **service layer**, sehingga tidak dapat
dilewati lewat pemanggilan API langsung.

> **Catatan `may_follow_later` (FR-2.0, FR-2.2).** Item seperti Delivery
> Service pada kelompok `ADD_ONS` dikecualikan dari gate "harga dasar
> dapat dihitung dan ditampilkan ke Sales/Chief Sales" — perhitungan
> `ProposalCalculationResult` awal dapat berjalan tanpa item ini. Namun
> item tersebut **tetap termasuk** dalam `allMandatory` di atas bila
> ditandai `is_mandatory = true`, sehingga `QUOTATION_RELEASED` tidak
> tercapai sampai VP Operations melengkapinya — mencegah quotation rilis
> dengan biaya pengiriman yang belum diketahui.

### 4.3 Rejection & Routing Logic (FR-2.3)

| Aksi | Efek pada State Machine |
|---|---|
| `APPROVE` | step → `APPROVED`; trigger evaluasi step berikutnya (`canAdvanceToStep`) |
| `APPROVE_WITH_CONDITIONS` | step → `APPROVED_WITH_CONDITIONS`; `decision_note` wajib diisi; catatan dibawa terus hingga `FINAL_APPROVED` dan muncul di PDF/handoff ke eksekusi |
| `REJECT` (generic) | step → `REJECTED`; proposal → `DRAFT`; notifikasi ke submitter |
| `TARGETED_REJECT(target)` | current step → `REJECTED`; **semua step di antara target dan step saat ini di-reset ke `PENDING`** (bukan seluruh workflow); proposal.current_status → status milik step target; versi proposal **tidak** berubah (revisi terjadi di versi yang sama sampai disubmit ulang). Contoh: VP Finance menolak dan mengembalikan ke Chief Sales karena komponen harga perlu disusun ulang |

### 4.4 Dynamic Form Adjustment (FR-2.4)

Trigger: penambahan `cost_item` baru ke `cbs_template_node` sebuah proposal setelah workflow berjalan.

```pseudo
on CostItemAddedToProposal(proposal_version, new_cost_item):
    ownerDept = new_cost_item.owner_department_id
    ownerStep = findStepForDepartment(workflow_instance, ownerDept)

    if ownerStep.status == APPROVED:
        # step pemilik sudah lewat — perlu re-verifikasi
        ownerStep.status = PENDING
        # step-step setelah ownerStep otomatis kembali ke PENDING (cascading)
        resetSubsequentSteps(workflow_instance, after: ownerStep)
        proposal.current_status = "PENDING_" + ownerDept.code
        notifyDepartment(ownerDept, reason: "New cost item requires re-verification")
    else:
        # step pemilik belum diproses — cukup tandai item baru di form, tidak perlu reset
        attachCostItemToStep(ownerStep, new_cost_item)
```

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

function createRevisionQuotation(existingProposal, changeReason):
    # Dipanggil saat Sales/Chief Sales perlu merevisi quotation yang
    # SUDAH RELEASED (bukan sekadar edit draft) — mis. unit berubah.
    newProposal = INSERT INTO pricing_proposal (
        project_identifier_id: existingProposal.project_identifier_id,
        supersedes_proposal_id: existingProposal.id,
        business_line: existingProposal.business_line,
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
function canCreateNewQuotation(salesOfficerId, customerName, productId):
    windowStart = startOfDay(now())  # jendela waktu = master config, default: hari kalender
    countToday = SELECT COUNT(*) FROM pricing_proposal p
                 JOIN pricing_proposal_version v ON v.proposal_id = p.id
                 WHERE p.created_by = salesOfficerId
                   AND p.customer_ref = customerName
                   AND v.product_master_data_id = productId
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
  anomali untuk ditinjau System Admin/Chief Sales, bukan sekadar
  ditolak diam-diam.

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
  "fx_usd_idr_delta_pct": 3.0,
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

### 8.1 Model
- **Role** (RBAC): melekat pada User — `SALES_OFFICER`, `CHIEF_SALES`, `VP_FINANCE`, `VP_OPERATIONS`, `PRODUCT_OWNER` (baru), `BOD`, `SYSTEM_ADMIN`.
- **Attribute-based rule** (ABAC) di atas RBAC untuk kasus field-level: contoh rule "Sales Officer dapat GET `pricing_proposal_version` tapi field `cost_lines[].raw_margin_pct` di-mask menjadi `null` kecuali role termasuk `{VP_FINANCE, BOD, SYSTEM_ADMIN}`". Sales Officer juga **tidak** memiliki akses baca ke `cost_lines` kelompok `COGS`/`PROFITABILITY`/`ADD_ONS` sama sekali (bukan hanya margin) — ia hanya mengisi kelompok `SALES` (FR-1.1.1) dan melihat harga jual final.
- Implementasi: response serializer menerapkan *field-level masking* berdasarkan claim role di JWT, bukan filtering di client (agar tidak bisa dibypass via DevTools).

### 8.2 Contoh Permission Matrix (ringkas)

| Resource/Field | Sales Officer | Chief Sales | VP Finance | VP Operations | Product Owner | BOD | Admin |
|---|---|---|---|---|---|---|---|
| Kelompok `COGS`, `ADD_ONS` (BOM, freight, custom duties, processing, delivery, dll.) | – | R | R | **RW** | – | R | RW (config) |
| Kelompok `PROFITABILITY` (VKTS/VKTR margin, financing cost) | – | R | **RW** | R | – | R | RW (config) |
| Kelompok `SALES` (STNK, insurance, incentive, agency fee) | **RW** | R | R | – | – | R | RW (config) |
| Product Master Data (spesifikasi, gambar, brosur) | R | R | – | – | **RW** | R | RW (config) |
| `final_price` (quotation) | R | R | R | R | R | R | R |
| `raw_margin_pct` / GPM aktual | **masked** | R | RW | R | – | R | R |
| Ajukan permintaan diskon (Rupiah/%) | RW | RW | – | – | – | – | RW |
| Setujui diskon Tier 1 (Auto) | – | – | – | – | – | – | – (tidak perlu approval) |
| Setujui diskon Tier 2 (3-Pihak) | RW (sebagai salah satu pihak) | RW (sebagai salah satu pihak) | RW (sebagai salah satu pihak) | – | – | – | – |
| Setujui diskon Tier 3 (2-BOD) | – | – | – | – | – | **RW (wajib 2 approver)** | – |
| Workflow Template Catalog & Margin Tier Authority | – | – | – | – | – | – | RW |
| Audit log | R (own actions) | R (own actions) | R (own actions) | R (own actions) | R (own actions) | R (all) | R (all) |

### 8.3 Enforcement Layers
1. **API Gateway**: cek role punya akses ke endpoint (coarse-grained).
2. **Service layer**: cek ABAC rule per-field sebelum serialize response & sebelum accept write payload.
3. **Database**: row-level security opsional sebagai *defense in depth* untuk tabel finansial sensitif (Postgres RLS).

---

## 9. Integration Contracts (NFR — API-First)

### 9.1 ERP (SAP/Odoo) — Sinkronisasi Master BOM & Costing

| Arah | Endpoint/Mekanisme | Payload Kunci |
|---|---|---|
| ERP → PriceCore (pull) | Scheduled job `GET /erp/bom/{sku}` atau webhook `POST /webhooks/erp/bom-updated` | `sku, component_list[], unit_cost, currency, effective_date` |
| ERP → PriceCore (pull) | `GET /erp/costing/{project_id}` | actual cost realization untuk validasi historis (mendukung Cost Outlier Alert) |
| PriceCore → ERP (push) | `POST /erp/pricing/final` setelah `FINAL_APPROVED` | `proposal_number, final_price, cost_breakdown[], approved_by, approved_at` |
| Fallback | Batch dump CSV/table export terjadwal jika ERP tidak expose API real-time | Mapping manual per tabel, di-load via ETL job harian |

**Idempotency**: setiap push ke ERP menyertakan `proposal_number` + `version_label` sebagai *idempotency key* agar retry tidak menyebabkan duplikasi entri finansial di ERP.

### 9.2 CRM (Salesforce/HubSpot)

| Arah | Endpoint/Mekanisme | Payload Kunci |
|---|---|---|
| CRM → PriceCore (pull) | `GET /crm/opportunities/{id}` saat proposal dibuat dari opportunity | `customer_name, deal_value_estimate, business_line, competitor_info` |
| PriceCore → CRM (push) | `POST /crm/opportunities/{id}/pricing` setelah `FINAL_APPROVED` | `final_price, pdf_url, approved_at` — memicu update stage opportunity di CRM |

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

## 11. Commercial Negotiation Engine — Margin-Tier Authority (FR-6.0 – FR-6.5)

> **Revisi v3.0.** Seluruh engine ini diganti dari basis **persentase
> diskon** (v2.0/v2.1: Sales ≤3% → Chief Sales ≤8% → BOD) menjadi basis
> **GPM akhir hasil kalkulasi** — demo review mengonfirmasi bahwa
> wewenang persetujuan sesungguhnya ditentukan oleh margin akhir, bukan
> besaran diskon mentah. Nama fungsi/tabel yang berubah:
> `resolveRequiredRole` → `resolveMarginTier`, `discount_authority` →
> `margin_tier_authority` (§2.1).

State machine terpisah dari workflow COGS, namun terikat pada satu
`pricing_proposal`. Menjawab *"limited visibility of actual profitability
during commercial negotiations"* pada dokumen kebutuhan.

### 11.1 Authority Resolution — Tier ditentukan oleh GPM akhir

Aturan inti: **pengaju tidak pernah memilih approver**. Sistem menghitung
**tier** dari GPM akhir hasil diskon, sehingga *authority bypass* mustahil
dilakukan dari klien.

```pseudo
function resolveMarginTier(gpmAfter, businessLine):
    # Ambil tangga tier, terurut dari yang paling tinggi GPM-nya
    tiers = SELECT * FROM margin_tier_authority
            WHERE is_active
              AND (business_line = businessLine OR business_line IS NULL)
            ORDER BY tier ASC

    for t in tiers:
        lowerOk = (t.gpm_lower_bound_pct IS NULL) OR (gpmAfter >= t.gpm_lower_bound_pct)
        upperOk = (t.gpm_upper_bound_pct IS NULL) OR (gpmAfter < t.gpm_upper_bound_pct)
        if lowerOk and upperOk:
            return t                      # tier & required_roles yang berlaku

    return HIGHEST_TIER                   # fallback: GPM sangat rendah/negatif → Tier 3
```

Contoh konfigurasi (ilustratif hasil rapat, wajib dikonfirmasi Finance/BOD):

| Tier | gpm_lower_bound_pct | gpm_upper_bound_pct | required_roles |
|---|---|---|---|
| 1 (Auto) | 15.00 | *(null, tanpa batas atas)* | `[]` — harga *default* price list, tanpa approval |
| 2 (3-Pihak) | 12.00 | 15.00 | `[SALES_OFFICER, VP_FINANCE, CHIEF_SALES]` (AND-join) |
| 3 (2-BOD) | *(null)* | 12.00 | `[BOD, BOD]` (AND-join, dua approver berbeda) |

GPM akhir 16% → Tier 1 (auto). GPM akhir 13% → Tier 2 (3 pihak). GPM
akhir 7% → Tier 3 (2 BOD). **Batas aman 12% dikunci** sebagai pemisah
Tier 2/Tier 3 meski `allow_bod_delegation` diaktifkan pada Tier 2 (PRD
FR-6.1) — pelimpahan wewenang tidak boleh menggeser batas ini sendiri,
hanya melewatkan eskalasi eksplisit ke BOD *dalam* Tier 2.

### 11.1.1 Dual-Mode Discount Input (FR-6.1.1)

```pseudo
function normalizeDiscountInput(mode, amount, pct, priceBeforeDiscount):
    if mode == 'AMOUNT':
        pct = amount / priceBeforeDiscount * 100
    else:  # mode == 'PERCENTAGE'
        amount = priceBeforeDiscount * (pct / 100)
    return { amount, pct }   # keduanya disimpan pada negotiation_request
```

Baik mode `AMOUNT` (Rupiah) maupun `PERCENTAGE` menghasilkan `requested_discount_pct`
yang identik untuk keperluan `resolveMarginTier` — pilihan mode murni
kenyamanan input Sales, tidak memengaruhi logika tier.

### 11.2 Alur State

```
                 Customer minta diskon (Rupiah atau %)
                          │
                          ▼
              Hitung ulang GPM akhir (Pricing Engine §3)
                          │
                          ▼
              resolveMarginTier(gpmAfter, businessLine)
                          │
        ┌─────────────────┼──────────────────┐
        ▼                 ▼                  ▼
     TIER 1            TIER 2              TIER 3
   (auto, tanpa     PENDING_TIER2       PENDING_TIER3_BOD
    approval)        _APPROVAL           _APPROVAL
        │            (AND-join 3         (AND-join 2 BOD)
        │             pihak)                  │
        │                 │                   │
        │        ┌────────┼────────┐          │
        │        ▼        ▼        ▼          ▼
        │    APPROVE   REJECT   REVISE   APPROVE/REJECT/REVISE
        │        │        │        │          │
        ▼        ▼        ▼        ▼          ▼
   diskon    APPROVED  REJECTED  request   (sama seperti Tier 2 —
  diterapkan  (semua   (harga    lama →     REVISE mengevaluasi
             pihak      tetap)   SUPERSEDED,  ulang tier dari GPM baru)
             ACK)                request
                                  baru →
                                  resolveMarginTier ULANG
```

**`REVISE` memicu evaluasi tier ulang.** Bila BOD menurunkan diskon
sehingga GPM akhir naik dari 7% menjadi 13%, request baru jatuh ke
**Tier 2** (3 pihak) — bukan otomatis disetujui hanya karena BOD yang
mengusulkan. Ini menjaga konsistensi matriks wewenang di seluruh siklus
negosiasi.

**AND-join di dalam satu tier.** Tier 2 memerlukan **ketiga** pihak
(Sales/Customer Owner, VP Finance selaku Profitability Owner, Chief
Sales selaku Pricing Owner) meng-ACK — satu pihak menyetujui saja tidak
memindahkan status. Tier 3 memerlukan **dua** approval BOD berbeda —
pola AND-join yang sama dengan COGS Validation (§4.2), diimplementasikan
lewat baris `negotiation_decision` per anggota tier, dicek lengkap
sebelum status berpindah ke `APPROVED`.

**Loop dibatasi pada satu quotation** (PRD FR-6.3). Begitu quotation
pertama `QUOTATION_RELEASED`, permintaan diskon berikutnya yang disetujui
tidak menulis ulang quotation yang sama — ia memicu
`createRevisionQuotation` (§4.6) yang menghasilkan quotation baru
ter-*link* ke Project Identifier yang sama.

### 11.3 Margin Impact Calculation (FR-6.4)

Dihitung **saat request dibuat** dan disimpan sebagai snapshot pada
`negotiation_request`, sehingga approver melihat angka yang sama dengan yang
dilihat pengaju (tidak berubah akibat perubahan FX di antara pengajuan dan
persetujuan):

```pseudo
priceBefore = latestCalculationResult.final_price
priceAfter  = priceBefore - discountAmount    # discountAmount dari normalizeDiscountInput (§11.1.1)
baseCost    = totalDirectCost + totalIndirectCost      # tidak berubah oleh diskon
gpmAfter    = (priceAfter - baseCost) / priceAfter
tier        = resolveMarginTier(gpmAfter, proposal.business_line)
```

Perhitungan ini memakai ulang **Pricing Engine (§3)** — identik dengan
jalur What-If Simulator (§7.1), sehingga tidak ada logika margin ganda
di sistem.

> **Peringatan wajib.** Bila `tier > 1`, UI approver **harus**
> menampilkan peringatan eksplisit (tier & GPM akhir) sebelum tombol
> Approve dapat ditekan. Inilah mekanisme yang mencegah pengulangan
> insiden *margin leakage* yang melatarbelakangi proyek ini.

### 11.4 Interaksi dengan Release Gate

- Selama ada `negotiation_request` berstatus `PENDING_TIER2_APPROVAL`
  atau `PENDING_TIER3_BOD_APPROVAL`, proposal **tidak boleh** mencapai
  `QUOTATION_RELEASED`.
- Diskon yang `APPROVED` diterapkan pada kalkulasi final, menghasilkan
  `proposal_calculation_result` baru (snapshot immutable, §3.3 langkah
  10) dengan `margin_tier` tercatat.
- `canReleaseQuotation` (§4.2.1) memverifikasi seluruh approval **sesuai
  tier** sudah lengkap (AND-join penuh) — Tier 2 tidak lolos dengan 2
  dari 3 pihak; Tier 3 tidak lolos dengan 1 dari 2 BOD.

### 11.5 Audit (FR-6.5)

Setiap `negotiation_request` dan `negotiation_decision` menulis
`audit_log_entry` dengan `entity_type = 'negotiation_request'`,
`proposal_id`, dan **`project_identifier_id`** (baru — memudahkan audit
lintas-versi quotation pada satu project) terisi, sehingga riwayat
negosiasi muncul dalam satu linimasa audit yang sama dengan riwayat
perubahan harga. Baik nilai Rupiah maupun persentase diskon dicatat
(FR-6.1.1), demikian pula tier yang dihitung pada setiap request.

---

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

1. **Bahasa/Platform backend** — belum ditentukan di dokumen sumber (Node.js/NestJS, Java/Spring, atau .NET). Rekomendasi: pilih yang selaras dengan stack tim internal VKTR/mitra existing ERP.
2. **Pilihan library formula evaluator** — custom parser vs library (`mathjs`, `expr-eval`, `jsonata`). Rekomendasi awal: `jsonata` atau `mathjs` dengan sandboxing ketat untuk mempercepat Phase 1.
3. **SAP vs Odoo** — dokumen menyebut keduanya sebagai opsi; kontrak integrasi (§9.1) perlu disesuaikan begitu ERP final dikonfirmasi (SAP umumnya via IDoc/OData, Odoo via XML-RPC/JSON-RPC — signature endpoint akan berbeda).
4. **Threshold nilai eskalasi & GPM guardrail** — angka contoh (Rp 50 Miliar, dsb.) di PRD bersifat ilustratif; perlu ditetapkan bersama Finance/BOD sebagai *master config*, bukan angka hardcode.
5. **Ambang tier margin (§11.1)** — angka 15% / 12% / 8,5–9% adalah ilustrasi hasil rapat. Batas sesungguhnya, dan apakah berbeda per lini bisnis (B2G vs B2B), **wajib dikonfirmasi ke Chief Sales & BOD** sebelum go-live. Termasuk keputusan final soal `allow_bod_delegation` pada Tier 2 (§2.1, PRD FR-6.1).
6. **Kewenangan approve diskon oleh COGS Owner** — dikonfirmasi sebagian oleh demo review: VP Finance **eksplisit** menjadi salah satu dari 3 pihak pada Tier 2 (sebagai Profitability Owner). VP Operations **tidak** disebut sebagai approver diskon di tier manapun — perlu konfirmasi apakah ini final atau perlu dilibatkan pada kasus tertentu (mis. diskon yang berdampak pada komponen operasional).
7. **Perlakuan quotation yang sudah dirilis lalu dinegosiasikan ulang** — **dikonfirmasi oleh demo review**: menghasilkan quotation baru ter-*link* ke Project Identifier yang sama (FR-2.5, §4.6), bukan versi in-place. Keputusan v2.1 (rekomendasi "versi baru") kini menjadi requirement resmi, bukan lagi rekomendasi terbuka.
8. **Sumber kurs CNY/IDR (RMB)** — **dikonfirmasi sebagian**: basis mata uang dikoreksi dari USD ke CNY (FOB Price komponen impor dikutip vendor Cina dalam CNY; diskusi BOD soal *rate sensitivity threshold* eksplisit membahas RMB, kurs ilustratif Rp 2.500–2.700/RMB); ditarik otomatis dari API bank rekanan (BCA disebut eksplisit di demo, karena memiliki API kurs), mingguan (Senin 00:01). **Masih perlu dikonfirmasi**: kurs mana yang dipakai (tengah/jual/pajak), penyedia API final (BCA vs Bank Indonesia vs lainnya) — termasuk apakah BCA menyediakan API kurs CNY, bukan hanya USD — dan apakah toggle tampilan USD (FR-1.4.1) benar-benar dibutuhkan di luar basis CNY.
9. **Kadar Ni yang dipakai VKTR** — file simulasi memuat enam skenario (1,3%–1,8%). Kadar mana yang menjadi acuan default perlu dikonfirmasi ke tim Procurement/Engineering. **Catatan v3.0**: nilai HPM kini bersifat referensi saja (§13), sehingga urgensinya menurun dibanding saat masih menjadi faktor pengali aktif.
10. **Hubungan HPM ke harga battery pack** — **berubah status pada v3.0**: demo review mengonfirmasi dampak riil berjalan lewat kurs, bukan faktor HPM independen (§13). Pertanyaan lama soal "proporsional penuh vs sebagian" menjadi kurang relevan — dipertahankan sebagai referensi bila mekanisme adjustment independen suatu saat diaktifkan kembali.
11. **Ambang kesegaran indeks** — default 14 hari; perlu disesuaikan dengan ritme terbit Kepmen ESDM yang sesungguhnya.
12. **Kepemilikan (COGS Owner) per kelompok pada `BTEL-CostStructure.xlsx`** *(baru)* — pemetaan `COGS`→VP_OPERATIONS, `PROFITABILITY`→VP_FINANCE, `SALES`→SALES_OFFICER, `ADD_ONS`→VP_OPERATIONS pada §2.1 adalah **asumsi PriceCore** mengikuti nama kelompok, **belum dikonfirmasi eksplisit** oleh VKTR. Wajib divalidasi bersama VP Operations/VP Finance/Chief Sales sebelum dipakai sebagai gatekeeping resmi.
13. **Struktur field Format Quotation PDF** *(baru)* — PRD FR-1.5.3 mencatat template PDF final perlu dikonfirmasi; VKTR disebutkan akan membagikan dokumen contoh pasca demo. Layout `quotation_document_template.layout_schema` (§2.1) belum bisa difinalisasi sebelum dokumen tersebut diterima.
14. **Daftar lengkap Workflow Template di luar 2 varian dasar** *(baru)* — PRD FR-2.0.2 hanya menetapkan starting point (margin-tier & segmen customer). VKTR memperkirakan puluhan varian akan muncul organik; belum ada daftar definitif di luar dua varian dasar tersebut saat dokumen ini ditulis.
15. **Qualifier presisi untuk Workflow Template Catalog** *(baru)* — PRD FR-2.0.1 menyebut qualifier seperti status *blacklist* dan "indikasi relasi khusus" sebagai contoh, namun definisi operasional & sumber data qualifier tersebut (mis. bagaimana "relasi khusus" direpresentasikan sebagai field, bukan sekadar catatan informal) belum ditetapkan.

---

## 15. Traceability Matrix (FR → Technical Component)

| FR | Modul Teknis |
|---|---|
| FR-1.1 (CBS tunggal + COGS Ownership, struktur BTEL), FR-1.1.1 (Sales Add-On) | Master Data Service (§2.1) |
| FR-1.2 (Formula Engine, satu formula dasar) | Formula Engine (§3) |
| FR-1.3 (Pricing Template — tunggal) | `cbs_template` (§2.1) |
| **FR-1.4.1 – FR-1.4.5 (multi-currency)** | `exchange_rate` (§2.1) + Multi-Currency Engine (§12.1–12.4) |
| **FR-1.4.6 (rate sensitivity threshold, baru)** | `rate_sensitivity_config` + `checkRateSensitivity` (§12.5) |
| **FR-1.5 (Product Master Data & Quotation PDF, baru)** | `product_master_data`, `quotation_document_template` (§2.1) |
| **FR-2.0 (alur quotation, urutan aktor dikoreksi)**, FR-2.1 | Workflow Engine + State Machine, parallel AND-join (§4.1) |
| **FR-2.0.1 (Workflow Template Catalog, baru)**, FR-2.0.2 (Basic Workflow 2 varian) | `resolveWorkflowTemplate` (§4.1a) |
| FR-2.2 (release gate, termasuk `may_follow_later`) | `canReleaseQuotation` (§4.2.1) |
| FR-2.3, FR-2.4 (rejection, dynamic form adjustment) | §4.3, §4.4 |
| **FR-2.5 (Project Identifier & Versioning, baru)** | `project_identifier`, `createRevisionQuotation` (§4.6) |
| **FR-2.6 (Duplicate/Fraud Guard, baru)** | `canCreateNewQuotation` (§4.7) |
| FR-3.1 – FR-3.3 | Observability Dashboard + SLA Job + Audit Log (§5, §6) |
| FR-4.1 – FR-4.3 | DSS/Simulation Engine (§7) |
| **FR-6.1 (margin tier authority matrix, direvisi)** | `margin_tier_authority` (§2.1) + `resolveMarginTier` (§11.1) |
| **FR-6.1.1 (dual-mode discount input, baru)** | `normalizeDiscountInput` (§11.1.1) |
| **FR-6.2 (auto-escalation berbasis tier)** | Negotiation State Machine (§11.2) |
| **FR-6.3 (approve/reject/revise, loop dibatasi per quotation)** | `negotiation_decision` + revision loop (§11.2) |
| **FR-6.4 (margin impact)** | Margin Impact Calculation (§11.3), reuse Pricing Engine (§3) |
| **FR-6.5 (negotiation audit)** | Audit integration (§11.5) |
| **FR-8.1 (HMA master data, referensi)** | `mineral_index_snapshot` (§2.1) |
| **FR-8.2 (HPM calculator, referensi)** | `computeHpm` + `hpm_parameter` (§13.1) |
| **FR-8.3 (global adjustment — dicabut/nonaktif)** | `mineralAdjustmentFactor` (§13.2, nonaktif), pipeline §13.3 |
| **FR-8.4 (transparansi)** | Snapshot pada `proposal_calculation_result` (§2.1) |
| **FR-8.5 (stale warning)** | `isIndexStale` (§13.4) |
| FR-7.1 – FR-7.3 (KYC) | *Belum diimplementasikan pada POC — lihat PRD §8, tetap Out of Scope pada v3.0* |
| NFR Security | RBAC/ABAC Layer (§8, ditambah Product Owner) |
| NFR Integrasi | ERP/CRM/FX Integration Contracts (§9) |
