# Technical Logic & System Design Document

## VKTR-PriceCore — Enterprise Smart Pricing & Decision Support System

| | |
|---|---|
| **Document Version** | 2.0 (Commercial Quotation Alignment) |
| **Companion Document** | `PRD-VKTR-PriceCore.md` v2.0 |
| **Purpose** | Menerjemahkan requirement fungsional PRD menjadi logika data, state machine, dan arsitektur teknis yang dapat langsung dieksekusi oleh tim engineering. |

> **Perubahan utama v2.0** (mengikuti PRD v2.0):
> 1. **Aktor & workflow** — Procurement/Engineering diganti oleh **COGS Owner**
>    (VP Finance ∥ VP Operations) yang bekerja **paralel** (AND-join), dengan
>    Chief Sales sebagai penyusun quotation dan BOD sebagai otoritas tertinggi.
> 2. **Commercial Negotiation Engine** (§11) — state machine terpisah untuk
>    permintaan diskon berbasis *delegated authority matrix*.
> 3. **Release gate** — `QUOTATION_RELEASED` hanya tercapai bila seluruh
>    komponen COGS mandatory tervalidasi.

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

```
Organization ──< Department ──< User ──< Role ──< Permission

CostItem (master) ──< CostItemVersion
    │
    ▼
CBSTemplate ──< CBSTemplateNode (tree: parent_id self-ref)
    │                   │
    │                   └─> references CostItem
    ▼
PricingProposal ──< PricingProposalVersion (v1.0, v1.1, ...)
    │                   │
    │                   ├─< ProposalCostLine (snapshot value per CostItem)
    │                   ├─< ProposalMarginFactor
    │                   └─< ProposalCalculationResult (GPM, EBITDA, BEP)
    │
    ├─< WorkflowInstance ──< WorkflowStepInstance ──< ApprovalAction
    │         │
    │         └─> WorkflowDefinition (config, versi berlaku saat instance dibuat)
    │
    ├─< AuditLogEntry (who, what, when, why, before/after diff)
    │
    └─< ExternalSyncRecord (ERP/CRM push-pull status)

FormulaDefinition ──> digunakan oleh CBSTemplate / PricingProposal
ExternalRateSnapshot (FX, commodity) ──> dipakai saat kalkulasi & simulasi

DiscountAuthority (role → max_discount_pct, per business_line)
    │
    ▼
NegotiationRequest ──< NegotiationDecision (APPROVE/REJECT/REVISE)
    │
    └─> milik satu PricingProposal (quotation)
```

### 2.1 Tabel Inti (ringkas)

**`cost_item`** (Master Cost Item — FR-1.1)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| code | varchar unique | e.g. `BOM-BATT-001` |
| name | varchar | |
| category | enum | `DIRECT`, `INDIRECT`, `MARGIN_FACTOR` |
| subcategory | varchar | e.g. `BOM`, `Bea Masuk`, `Warranty`, `Cost of Funds` |
| owner_department_id | FK Department | **COGS Owner** — fungsi penanggung jawab validasi item ini (`VP_FINANCE` / `VP_OPERATIONS`). Menggerakkan gatekeeping FR-2.2 & re-verifikasi FR-2.4 |
| unit_type | enum | `FIXED`, `PER_UNIT`, `PERCENTAGE`, `FORMULA` |
| is_mandatory | boolean | dipakai gatekeeping FR-2.2 |
| active | boolean | soft-disable, bukan delete |

**`cbs_template`** dan **`cbs_template_node`** (FR-1.1, FR-1.3)
- `cbs_template`: id, name, business_line (`B2G_TENDER`, `B2B_FLEET`, `CHARGING_INFRA`), version, status (`draft`/`active`/`archived`).
- `cbs_template_node`: id, template_id, parent_node_id (nullable, self-referencing → membentuk *tree*), cost_item_id (nullable jika node adalah grouping), sort_order, default_formula_id.

**`formula_definition`** (FR-1.2)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| business_line | varchar | scoping rumus per lini bisnis |
| expression | text | DSL ekspresi, lihat §3 |
| input_variables | jsonb | daftar variabel yang dibutuhkan (cost items, FX rate, dll) |
| version | int | |
| created_by / created_at | | untuk audit |

**`pricing_proposal`** (root transaksi)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| proposal_number | varchar unique | human-readable, e.g. `PRC-2026-0042` |
| business_line | varchar | |
| customer_ref | varchar | referensi ke CRM (opsional) |
| current_version_id | FK → pricing_proposal_version | pointer ke versi aktif |
| current_status | enum | lihat state machine §4 |
| transaction_value | numeric | dipakai untuk eskalasi threshold |
| created_by, created_at | | |

**`pricing_proposal_version`** (Row-Level Versioning — FR-5 NFR, FR-2.4)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| proposal_id | FK | |
| version_label | varchar | `v1.0`, `v1.1` |
| parent_version_id | FK nullable | untuk *diff/side-by-side* |
| snapshot_cbs_template_id | FK | template yang dipakai saat versi ini dibuat (immutability terhadap perubahan template di masa depan) |
| cost_lines | jsonb / relasi `proposal_cost_line` | snapshot nilai tiap cost item |
| calculation_result | jsonb | GPM, EBITDA, BEP, total price |
| created_by, created_at, change_reason | | mendukung *why* di audit trail |

**`workflow_definition`** & **`workflow_step_definition`** (FR-2.1)
- `workflow_definition`: id, business_line, min_value, max_value (untuk *escalation bucket*), is_active, version.
- `workflow_step_definition`: id, workflow_definition_id, step_order, department_id, mode (`SEQUENTIAL`/`PARALLEL_GROUP`), parallel_group_id (nullable), is_mandatory_gate (boolean), sla_hours.

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
| rate_type | enum (`FX_USD_IDR`, `FX_CNY_IDR`, `COMMODITY_LITHIUM`, ...) |
| value | numeric |
| source | varchar |
| effective_at | timestamptz |

**`discount_authority`** (FR-6.1 — matriks wewenang diskon, *master config*)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| role | enum user_role | `SALES_OFFICER`, `CHIEF_SALES`, `BOD` |
| business_line | enum nullable | `null` = berlaku untuk semua lini bisnis |
| max_discount_pct | numeric(5,2) | batas atas diskon yang boleh disetujui peran ini; `BOD` bernilai 100 (tanpa batas praktis) |
| escalation_order | int | urutan eskalasi: 1 = Sales Officer, 2 = Chief Sales, 3 = BOD |
| is_active | boolean | |

> Ambang batas **tidak boleh hardcode** — perubahan kebijakan diskon
> dilakukan lewat data, bukan rilis ulang aplikasi (FR-6.1).

**`negotiation_request`** (FR-6.2 — permintaan diskon dari pelanggan)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| proposal_id | FK pricing_proposal | quotation yang dinegosiasikan |
| requested_discount_pct | numeric(5,2) | besaran diskon yang diminta pelanggan |
| customer_note | text | konteks/alasan permintaan |
| required_role | enum user_role | **dihitung sistem**, bukan dipilih pengaju (anti *authority bypass*) |
| status | enum | `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `REVISED`, `SUPERSEDED` |
| price_before | numeric(18,2) | harga sebelum diskon (snapshot) |
| price_after | numeric(18,2) | harga setelah diskon (snapshot) |
| gpm_after | numeric(8,5) | GPM setelah diskon — dasar peringatan margin (FR-6.4) |
| is_below_gpm_threshold | boolean | penanda pelanggaran guardrail |
| parent_request_id | FK nullable | terisi bila request ini hasil `REVISE` dari request sebelumnya |
| requested_by / created_at | | |

**`negotiation_decision`** (FR-6.3, FR-6.5 — append-only)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| negotiation_request_id | FK | |
| actor_id | FK profile | pengambil keputusan |
| decision | enum | `APPROVE`, `REJECT`, `REVISE` |
| counter_discount_pct | numeric(5,2) nullable | wajib diisi bila `decision = REVISE` |
| note | text | |
| created_at | timestamptz | |

---

## 3. Dynamic Formula Engine (FR-1.2)

### 3.1 Kebutuhan
Formula harus bisa dikonfigurasi per lini bisnis tanpa redeploy, mendukung referensi ke cost item, margin factor, dan variabel eksternal (FX, komoditas), serta bisa disimulasikan langsung.

### 3.2 Pendekatan: Expression DSL + Safe Evaluator

Gunakan bahasa ekspresi terbatas (bukan `eval()` bebas) yang di-*parse* menjadi AST dan dievaluasi oleh interpreter kustom (atau library sandboxed seperti `expr-eval`/`mathjs` dengan whitelist fungsi). **Jangan pernah mengeksekusi kode arbitrer dari input pengguna** (risiko RCE) — semua formula divalidasi terhadap whitelist variabel yang terdaftar di `input_variables`.

Contoh definisi formula (`formula_definition.expression`):

```
base_cost = SUM(direct_costs) + SUM(indirect_costs)
fx_adjusted_cost = base_cost * (1 + FX_USD_IDR_DELTA_PCT)
margin_amount = fx_adjusted_cost * (cost_of_funds_pct + leasing_margin_pct)
final_price = fx_adjusted_cost + margin_amount + sales_commission_amount + contingency_buffer_amount
```

Variabel `direct_costs`, `indirect_costs` dsb. di-resolve dari `cbs_template_node` yang ter-tag kategori terkait; `FX_USD_IDR_DELTA_PCT` di-resolve dari `external_rate_snapshot` atau dari *slider* simulasi DSS.

### 3.3 Evaluation Pipeline

```
1. Load CBSTemplate (tree) untuk business_line proposal
2. Resolve seluruh cost_item leaf-node → ambil ProposalCostLine (input user)
3. Resolve FormulaDefinition aktif untuk business_line
4. Build variable context: { cost_items..., margin_factors..., fx_rates..., commodity_rates... }
5. Parse expression → AST (cached per formula version)
6. Evaluate AST dengan variable context → hasil per node (bottom-up melalui tree)
7. Aggregate ke top-level: total_cost, total_margin, final_price
8. Compute derived metrics: GPM = (final_price - total_cost) / final_price
                             EBITDA_contribution = final_price - total_cost - fixed_overhead_alloc
                             BEP (units) = fixed_cost / (unit_price - unit_variable_cost)
9. Persist sebagai ProposalCalculationResult (immutable snapshot per version)
```

Untuk **What-If Simulator (FR-4.1)**, langkah 4–8 dijalankan ulang secara *stateless* (tanpa persist) dengan variable context yang dimodifikasi oleh nilai slider — endpoint terpisah `POST /simulations/what-if` yang idempotent dan tidak menyentuh `pricing_proposal_version`.

### 3.4 Validasi Formula saat Disimpan
- Cek semua variabel dalam ekspresi terdaftar di `input_variables` (no undefined ref).
- Cek tidak ada *circular reference* antar node CBS (topological sort pada tree; tolak jika ada siklus).
- Uji unit: jalankan dengan data dummy untuk memastikan tidak ada divide-by-zero pada BEP.

---

## 4. Workflow State Machine (FR-2.1 – FR-2.4)

### 4.1 Status Utama Proposal (`pricing_proposal.current_status`)

```
DRAFT
  → PENDING_COGS_VALIDATION           ← satu status, DUA step paralel:
      ├── VP_FINANCE     (margin, OPEX, financial components)
      └── VP_OPERATIONS  (logistics, STNK, delivery, operational cost)
                  │ AND-join: kedua step harus APPROVED
                  ▼
    → PENDING_CHIEF_SALES_REVIEW      ← Chief Sales merakit quotation final
        → QUOTATION_RELEASED          ← release gate: semua COGS mandatory terisi
QUOTATION_RELEASED → EXPORTED_TO_ERP

(kondisional, dipicu dari Negotiation Engine §11):
    → PENDING_BOD_APPROVAL            ← bila diskon melebihi wewenang Chief Sales

(dari state manapun sebelum QUOTATION_RELEASED):
  → REJECTED_TARGETED(target)  → kembali ke step target, status proposal kembali ke
                                  status milik step tersebut tanpa mereset versi/draft
```

Urutan step konkret **tidak** hardcoded — diturunkan dari `workflow_definition` yang aktif untuk `business_line` + `transaction_value` bucket milik proposal tersebut (mendukung FR-2.1 no-code configurator).

**Catatan status paralel.** `PENDING_COGS_VALIDATION` adalah satu status
proposal yang menaungi dua `workflow_step_instance` dengan `step_order`
sama dan `parallel_group_id` identik. UI menampilkan progres per COGS
Owner secara terpisah (FR-3.1), sementara state machine memperlakukan
keduanya sebagai satu gerbang.

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
maju setelah **semua** anggota grup `APPROVED` (AND-join) — inilah yang
memodelkan "VP Finance dan VP Operations bekerja paralel, quotation
menunggu keduanya".

### 4.2.1 Release Gate (FR-2.2 — penjaga *margin leakage*)

Sebelum proposal boleh berpindah ke `QUOTATION_RELEASED`, dijalankan
validasi menyeluruh — bukan hanya per departemen:

```pseudo
function canReleaseQuotation(proposal):
    # 1. Seluruh komponen mandatory di CBS template harus terisi,
    #    apa pun pemiliknya (bukan hanya milik step terakhir).
    allMandatory = proposal.cbs_template.items.filter(i => i.is_mandatory)
    missing = allMandatory.filter(i => !hasValue(proposal.cost_lines, i))
    if missing.length > 0:
        return false, "COGS belum lengkap: " + missing

    # 2. Seluruh COGS Owner harus sudah memberi persetujuan.
    if instance.steps.any(s => s.status not in [APPROVED, APPROVED_WITH_CONDITIONS]):
        return false, "Masih ada COGS Owner yang belum menyetujui"

    # 3. Margin akhir (setelah diskon negosiasi, bila ada) tidak boleh
    #    di bawah ambang tanpa persetujuan BOD.
    if result.gpm < businessLine.min_gpm_threshold and not proposal.has_bod_approval:
        return false, "Margin di bawah ambang — perlu persetujuan BOD"

    return true
```

Tiga pemeriksaan ini dijalankan di **service layer**, sehingga tidak dapat
dilewati lewat pemanggilan API langsung.

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

Saat proposal disubmit atau `transaction_value` berubah:
```
workflowDef = SELECT * FROM workflow_definition
              WHERE business_line = proposal.business_line
                AND proposal.transaction_value BETWEEN min_value AND max_value
                AND is_active = true
              ORDER BY version DESC LIMIT 1
```
Jika tidak ada `workflow_definition` yang cocok (gap konfigurasi) → proposal masuk status `CONFIG_ERROR`, memicu alert ke Admin (bukan default ke workflow sembarangan — mencegah *silent bypass*).

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
- **Role** (RBAC): melekat pada User — `SALES_OFFICER`, `CHIEF_SALES`, `VP_FINANCE`, `VP_OPERATIONS`, `BOD`, `SYSTEM_ADMIN`.
- **Attribute-based rule** (ABAC) di atas RBAC untuk kasus field-level: contoh rule "Sales Officer dapat GET `pricing_proposal_version` tapi field `cost_lines[].raw_margin_pct` di-mask menjadi `null` kecuali role termasuk `{VP_FINANCE, BOD, SYSTEM_ADMIN}`".
- Implementasi: response serializer menerapkan *field-level masking* berdasarkan claim role di JWT, bukan filtering di client (agar tidak bisa dibypass via DevTools).

### 8.2 Contoh Permission Matrix (ringkas)

| Resource/Field | Sales Officer | Chief Sales | VP Finance | VP Operations | BOD | Admin |
|---|---|---|---|---|---|---|
| Operational cost items (logistics, STNK, delivery) | – | R | R | **RW** | R | RW (config) |
| Financial/margin factors (OPEX, CoF, margin policy) | – | R | **RW** | R | R | RW (config) |
| `final_price` (quotation) | R | R | R | R | R | R |
| `raw_margin_pct` | **masked** | R | RW | R | R | R |
| Ajukan permintaan diskon | RW | RW | – | – | – | RW |
| Setujui diskon | ≤ batas wewenang | ≤ batas wewenang | – | – | **tanpa batas** | – |
| Workflow definition & discount authority | – | – | – | – | – | RW |
| Audit log | R (own actions) | R (own actions) | R (own actions) | R (own actions) | R (all) | R (all) |

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

- Job terjadwal (misal setiap jam) menarik kurs USD/IDR, CNY/IDR dan harga acuan lithium/komoditas baterai dari provider eksternal (mis. central bank API / commodity data provider), disimpan sebagai `external_rate_snapshot`.
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

## 11. Commercial Negotiation Engine (FR-6.1 – FR-6.5)

State machine terpisah dari workflow COGS, namun terikat pada satu
`pricing_proposal`. Menjawab *"limited visibility of actual profitability
during commercial negotiations"* pada dokumen kebutuhan.

### 11.1 Authority Resolution — siapa yang berwenang menyetujui

Aturan inti: **pengaju tidak pernah memilih approver**. Sistem menghitungnya
dari besaran diskon, sehingga *authority bypass* mustahil dilakukan dari klien.

```pseudo
function resolveRequiredRole(discountPct, businessLine):
    # Ambil tangga wewenang, terurut dari yang paling rendah
    ladder = SELECT * FROM discount_authority
             WHERE is_active
               AND (business_line = businessLine OR business_line IS NULL)
             ORDER BY escalation_order ASC

    for level in ladder:
        if discountPct <= level.max_discount_pct:
            return level.role          # peran terendah yang masih berwenang

    return 'BOD'                        # melampaui seluruh batas → naik ke BOD
```

Contoh konfigurasi (ilustratif, wajib dikonfirmasi Finance/BOD):

| Role | escalation_order | max_discount_pct |
|---|---|---|
| `SALES_OFFICER` | 1 | 3.00 |
| `CHIEF_SALES` | 2 | 8.00 |
| `BOD` | 3 | 100.00 |

Diskon 2% → Sales Officer. Diskon 6% → Chief Sales. Diskon 12% → BOD.

### 11.2 Alur State

```
                 Customer minta diskon
                          │
                          ▼
              resolveRequiredRole(discount)
                          │
                          ▼
                 PENDING_APPROVAL
                    (required_role)
                          │
        ┌─────────────────┼──────────────────┐
        ▼                 ▼                  ▼
    APPROVE            REJECT             REVISE
        │                 │                  │
        ▼                 ▼                  ▼
   APPROVED           REJECTED      request lama → SUPERSEDED
        │              (harga                  │
        │               tetap)      request baru dgn counter_discount_pct
        │                                      │
        ▼                                      └──► kembali ke resolveRequiredRole
  diskon diterapkan ke proposal                     (tangga wewenang dievaluasi ULANG)
  → QUOTATION_RELEASED
```

**`REVISE` memicu evaluasi wewenang ulang.** Bila BOD menurunkan diskon dari
12% menjadi 5%, request baru jatuh ke wewenang Chief Sales — bukan otomatis
disetujui. Ini menjaga konsistensi matriks wewenang di seluruh siklus
negosiasi.

### 11.3 Margin Impact Calculation (FR-6.4)

Dihitung **saat request dibuat** dan disimpan sebagai snapshot pada
`negotiation_request`, sehingga approver melihat angka yang sama dengan yang
dilihat pengaju (tidak berubah akibat perubahan FX di antara pengajuan dan
persetujuan):

```pseudo
priceBefore = latestCalculationResult.final_price
priceAfter  = priceBefore * (1 - discountPct / 100)
baseCost    = totalDirectCost + totalIndirectCost      # tidak berubah oleh diskon
gpmAfter    = (priceAfter - baseCost) / priceAfter
isBelowThreshold = gpmAfter < businessLine.min_gpm_threshold
```

Perhitungan ini memakai ulang **Pricing Engine (§3)** dengan parameter
`volume_discount_pct` — identik dengan jalur What-If Simulator (§7.1),
sehingga tidak ada logika margin ganda di sistem.

> **Peringatan wajib.** Bila `isBelowThreshold` bernilai true, UI approver
> **harus** menampilkan peringatan eksplisit sebelum tombol Approve dapat
> ditekan. Inilah mekanisme yang mencegah pengulangan insiden *margin
> leakage* yang melatarbelakangi proyek ini.

### 11.4 Interaksi dengan Release Gate

- Selama ada `negotiation_request` berstatus `PENDING_APPROVAL`, proposal
  **tidak boleh** mencapai `QUOTATION_RELEASED`.
- Diskon yang `APPROVED` diterapkan sebagai `volume_discount_pct` pada
  kalkulasi final, menghasilkan `proposal_calculation_result` baru (snapshot
  immutable, §3.3 langkah 9).
- Bila diskon menyebabkan GPM di bawah ambang, `canReleaseQuotation` (§4.2.1)
  hanya meloloskannya bila persetujuan berasal dari **BOD** — persetujuan
  Sales Officer/Chief Sales tidak cukup untuk menembus guardrail margin.

### 11.5 Audit (FR-6.5)

Setiap `negotiation_request` dan `negotiation_decision` menulis
`audit_log_entry` dengan `entity_type = 'negotiation_request'` dan
`proposal_id` terisi, sehingga riwayat negosiasi muncul dalam satu linimasa
audit yang sama dengan riwayat perubahan harga.

---

## 12. Open Technical Decisions (Perlu Konfirmasi Tim)

1. **Bahasa/Platform backend** — belum ditentukan di dokumen sumber (Node.js/NestJS, Java/Spring, atau .NET). Rekomendasi: pilih yang selaras dengan stack tim internal VKTR/mitra existing ERP.
2. **Pilihan library formula evaluator** — custom parser vs library (`mathjs`, `expr-eval`, `jsonata`). Rekomendasi awal: `jsonata` atau `mathjs` dengan sandboxing ketat untuk mempercepat Phase 1.
3. **SAP vs Odoo** — dokumen menyebut keduanya sebagai opsi; kontrak integrasi (§9.1) perlu disesuaikan begitu ERP final dikonfirmasi (SAP umumnya via IDoc/OData, Odoo via XML-RPC/JSON-RPC — signature endpoint akan berbeda).
4. **Threshold nilai eskalasi & GPM guardrail** — angka contoh (Rp 50 Miliar, dsb.) di PRD bersifat ilustratif; perlu ditetapkan bersama Finance/BOD sebagai *master config*, bukan angka hardcode.
5. **Ambang wewenang diskon (§11.1)** — angka 3% / 8% adalah ilustrasi. Batas sesungguhnya per peran, dan apakah berbeda per lini bisnis (B2G vs B2B), **wajib dikonfirmasi ke Chief Sales & BOD** sebelum go-live.
6. **Kewenangan approve diskon oleh COGS Owner** — dokumen sumber tidak menyebut VP Finance/VP Operations sebagai approver diskon. Asumsi saat ini: mereka **tidak** berwenang menyetujui diskon (hanya memvalidasi komponen biaya). Perlu konfirmasi apakah VP Finance perlu dilibatkan saat diskon menembus ambang margin.
7. **Perlakuan quotation yang sudah dirilis lalu dinegosiasikan ulang** — apakah menghasilkan versi baru (`v1.1`) atau memperbarui versi berjalan. Rekomendasi: versi baru, agar riwayat harga yang pernah diberikan ke pelanggan tetap utuh untuk audit.

---

## 13. Traceability Matrix (FR → Technical Component)

| FR | Modul Teknis |
|---|---|
| FR-1.1 (CBS + COGS Ownership), FR-1.2, FR-1.3 | Master Data Service + Formula Engine (§2, §3) |
| FR-2.0 (alur quotation), FR-2.1 – FR-2.4 | Workflow Engine + State Machine, parallel AND-join (§4) |
| FR-2.2 (release gate) | `canReleaseQuotation` (§4.2.1) |
| FR-3.1 – FR-3.3 | Observability Dashboard + SLA Job + Audit Log (§5, §6) |
| FR-4.1 – FR-4.3 | DSS/Simulation Engine (§7) |
| **FR-6.1 (authority matrix)** | `discount_authority` (§2.1) + `resolveRequiredRole` (§11.1) |
| **FR-6.2 (auto-escalation)** | Negotiation State Machine (§11.2) |
| **FR-6.3 (approve/reject/revise)** | `negotiation_decision` + revision loop (§11.2) |
| **FR-6.4 (margin impact)** | Margin Impact Calculation (§11.3), reuse Pricing Engine (§3) |
| **FR-6.5 (negotiation audit)** | Audit integration (§11.5) |
| FR-7.1 – FR-7.3 (KYC) | *Belum diimplementasikan pada POC — lihat PRD §8* |
| NFR Security | RBAC/ABAC Layer (§8) |
| NFR Integrasi | ERP/CRM/FX Integration Contracts (§9) |
