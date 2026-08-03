# Product Requirement Document (PRD)

## Enterprise Smart Pricing & Decision Support System (VKTR-PriceCore)

| | |
|---|---|
| **Document Version** | 1.1 (Consolidated) |
| **Target Entity** | PT VKTR Teknologi Mobilitas Tbk |
| **Domain** | Commercial EV & Mobility Solutions (EV Bus, EV Truck, Battery Systems, Charging Infrastructure & Aftermarket) |
| **Source Materials** | ConceptDSSpricingVKTR.pdf, VKTR-PriceCore Strategic Pricing Architecture.pdf, Timeline & Effort Detail.pdf |

---

## 1. Executive Summary & Problem Context

Sebagai manufaktur dan penyedia solusi kendaraan listrik komersial, VKTR beroperasi dengan struktur biaya (*Cost Breakdown Structure*) yang kompleks — terdiri dari komponen *import/BOM*, bea masuk, karoseri, sistem baterai, instalasi infrastruktur pengisian daya, hingga garansi layanan jangka panjang.

Saat ini, pembentukan harga di VKTR menghadapi empat tantangan utama:

1. **Fragmentasi Departemen** — Proses input komponen biaya (*cost*) dan margin terpecah di berbagai departemen (Procurement, Engineering, Finance, Sales) tanpa sistem terpusat. Setiap departemen memiliki spreadsheet-nya sendiri, sehingga tidak ada *single source of truth*.
2. **Process Bypass (Governance Risk)** — Alur penetapan harga sering kali melewati (*skip*) departemen tertentu secara tidak sengaja atau sengaja, berpotensi memicu *underquoting* atau *untracked risk* yang baru diketahui setelah kontrak berjalan.
3. **Unmapped Cost Structure** — Item-item pembentuk harga belum terpetakan dalam skema *master data* yang terstandarisasi, sehingga perhitungan antar proyek tidak *apple-to-apple* dan sulit diaudit.
4. **Ketiadaan Decision Support System (DSS)** — Manajemen tidak memiliki alat simulasi harga (*What-If Analysis*) yang tangkas dan presisi saat bernegosiasi atau menghadapi fluktuasi variabel eksternal (kurs, harga komoditas baterai/lithium, diskon volume).

VKTR-PriceCore hadir sebagai sistem terpusat yang menggabungkan *dynamic pricing engine*, *configurable approval workflow*, *observability dashboard*, dan *decision support system* dalam satu platform, terintegrasi dengan ERP dan CRM eksisting.

---

## 2. System Objectives & Strategic Outcomes

| Objective | Deskripsi |
|---|---|
| **100% Process Compliance** | Mengunci alur pembentukan harga sehingga tidak ada departemen yang dapat dilewati (*zero bypass*). |
| **Single Source of Truth** | Digitalisasi seluruh komponen biaya dan margin ke dalam satu *Dynamic Cost Engine* terpusat. |
| **Agile & Configurable Workflow** | Fleksibilitas mengubah alur persetujuan, komponen biaya, dan parameter tanpa *hard-coding* atau rilis ulang aplikasi. |
| **Executive DSS** | Menyediakan simulasi dampak perubahan parameter eksternal (kurs, harga material, diskon volume) terhadap *Gross Margin* secara *real-time*. |
| **Auditability** | Setiap perubahan angka harga dan margin harus dapat ditelusuri (*who, what, when, why*) untuk kebutuhan audit internal maupun kepatuhan sebagai perusahaan Tbk. |

### Target Pengguna (Personas)

| Persona | Departemen | Kebutuhan Utama |
|---|---|---|
| Procurement Analyst | Procurement | Input & update biaya vendor, BOM, komponen impor |
| Cost Engineer | Engineering | Validasi biaya teknis, testing, homologasi |
| Finance Controller | Finance | Menetapkan margin, *cost of funds*, validasi *threshold* |
| Sales/Account Manager | Sales | Menyusun penawaran, melihat *final price target* (tanpa *raw margin*) |
| C-Level / BOD | Executive | Approval transaksi besar, simulasi *what-if*, keputusan strategis |
| System Admin | IT/Operations | Konfigurasi *workflow*, *master data*, dan hak akses |

---

## 3. Detailed Functional Requirements (FR)

### Module 1 — Dynamic Pricing Component & Master Data Engine (Data Engineering Layer)

*Modul ini memetakan seluruh struktur komponen biaya dan margin secara hierarkis dan terpusat.*

- **FR-1.1 Mappable Cost Breakdown Structure (CBS)**
  - **Direct Costs**: BOM (Battery, Chassis, Powertrain), Karoseri/Body Building, Bea Masuk/Tarif Impor, Shipping & Logistics.
  - **Indirect Costs**: Testing & Homologasi, Pengujian Tipe, Overheads Proyek, Warranty Provision, After-Sales Maintenance Support.
  - **Margin & Financial Factors**: Cost of Funds, Financial Leasing Margin, Sales Commission, Contingency Buffer.
- **FR-1.2 Dynamic Formula Builder**
  - Kemampuan menyusun rumus kustom per lini bisnis (misal: B2G Tender Bus vs B2B Commercial Fleet).
  - Integrasi data parameter eksternal (misal: kurs USD/CNY ke IDR, harga acuan komoditas baterai/lithium).
  - Kemampuan *test/simulate* rumus secara *on-the-fly* sebelum disimpan sebagai template.
- **FR-1.3 Pricing Template Management**
  - Penyediaan *preset template* pembentukan harga berdasarkan tipe transaksi (Penjualan Unit, *EV Fleet Lease*, *Charging Infrastructure Buildout*).
  - Template terdiri dari kombinasi CBS items + margin factors yang dapat digunakan ulang.

### Module 2 — Configurable Multi-Department Workflow Engine

*Engine otomatisasi proses untuk memastikan governance dan pelacakan status penawaran.*

- **FR-2.1 No-Code/Low-Code Workflow Configurator**
  - Admin dapat membentuk dan mengubah alur persetujuan (sekuensial maupun paralel) sesuai matriks otorisasi perusahaan.
  - Eskalasi otomatis berdasarkan nilai transaksi (misal: Proyek > Rp 50 Miliar memerlukan approval dari C-Level/BOD).
- **FR-2.2 Strict Gatekeeping & State Locking**
  - Suatu departemen tidak dapat memproses penawaran sebelum departemen sebelumnya melengkapi *mandatory cost items*.
- **FR-2.3 Rejection & Routing Logic**
  - **Approve with Conditions**: Persetujuan dengan catatan khusus yang tercatat di log hingga fase eksekusi.
  - **Targeted Rejection**: Penolakan dapat dikembalikan langsung ke departemen spesifik (misal: Reject dari Finance dikembalikan ke Procurement) tanpa membatalkan *draft* dari awal.
- **FR-2.4 Dynamic Form Adjustment**
  - Jika terdapat komponen biaya baru yang ditambahkan di tengah proses, alur kerja secara otomatis mengarahkan formulir ke departemen pemilik komponen tersebut untuk diverifikasi.

### Module 3 — State Tracking & Observability Dashboard

*Sistem pelacakan transparan untuk visibilitas posisi penawaran harga.*

- **FR-3.1 Pricing Lifecycle Tracker (Kanban & Table View)**
  - Pelacakan status penawaran secara visual (*Drafting*, *Pending Procurement*, *Pending Engineering Review*, *Finance Approval*, *C-Level Sign-off*, *Final Approved*).
  - Filter kompleks: berdasarkan departemen, status, tanggal, dan nilai transaksi.
- **FR-3.2 SLA Timer & Automated Escalation**
  - Indikator durasi di setiap tahapan. Integrasi notifikasi (Email, MS Teams, atau WhatsApp API) jika *review* tertahan melebihi batas SLA (misal: > 24 jam).
- **FR-3.3 Immutable Audit Trail**
  - Pencatatan riwayat perubahan (*who, what, when, why*): siapa yang mengubah angka margin, kapan variabel biaya berubah, beserta dokumen pendukungnya. Log bersifat *append-only*, tidak dapat diedit atau dihapus.

### Module 4 — Decision Support System (DSS) & Simulation Engine

*Modul analitis berbasis data untuk membantu manajemen menetapkan harga secara presisi.*

- **FR-4.1 "What-If" Sensitivity Simulator**
  - Simulasi langsung pada antarmuka manajemen dengan *slider control*:
    - Dampak fluktuasi kurs (misal: USD/IDR naik 3%).
    - Dampak perubahan harga material baterai/komponen impor.
    - Dampak pemberian *volume discount* terhadap margin profitabilitas.
  - Output instan: visualisasi *Gross Profit Margin (GPM)*, *EBITDA Contribution*, dan *Break-Even Point (BEP)*.
- **FR-4.2 Intelligent Margin Guardrails & Anomaly Detection**
  - Peringatan otomatis (*alert*) jika kombinasi biaya menyebabkan margin proyek berada di bawah batas ambang (*threshold*) yang ditetapkan manajemen.
  - Deteksi lonjakan biaya tak wajar dibanding historis proyek sejenis (*Cost Outlier Alert*).
- **FR-4.3 Win/Loss Pricing Analytics**
  - Analisis tren harga penawaran historis yang berhasil dimenangkan vs kalah dalam tender untuk memberikan rekomendasi *Optimal Price Band*.

### Module 5 — Auth, User Management & Enterprise Integration

- **FR-5.1 Authentication & User Management** — Login, validasi akun, manajemen pengguna (CRUD), *activity log* login/aksi user.
- **FR-5.2 RBAC/ABAC Permission Engine** — Hak akses granular berbasis peran & departemen.
- **FR-5.3 API-First ERP Integration** (SAP/Odoo) — Sinkronisasi *master BOM* dan data *costing* dua arah; *fallback* dump data per tabel bila API tidak tersedia.
- **FR-5.4 CRM Integration** (Salesforce/HubSpot) — Penarikan data pra-penjualan (*pre-sales pull*) dan push *approved pricing* kembali ke CRM.
- **FR-5.5 Notification Integration** — Email, MS Teams webhook, WhatsApp API.

---

## 4. High-Level Data & Process Flow

```
[ Master Data CBS ] ─────┐
[ Ext. FX & Commodity ] ──┼──> [ Dynamic Pricing Engine ] ──> [ DSS ]
[ Dept Cost Inputs ] ─────┘             │
                                        ▼
                          [ Workflow State Machine ]
                                        │
                    ┌───────────────────┴───────────────────┐
              [ Approved ]                            [ Rejected ]
                    │                                       │
          (Export to ERP/CRM)                    (Route to Targeted Dept)
```

---

## 5. Non-Functional Requirements (NFR)

| Kategori | Requirement |
|---|---|
| **Integrasi** | *API-First Architecture*. Terhubung ke ERP (SAP/Odoo) untuk sinkronisasi *master BOM* dan *costing*, serta CRM (Salesforce/HubSpot) untuk data pra-penjualan. |
| **Security & Access** | RBAC/ABAC — Sales tidak dapat melihat persentase *raw margin* milik Procurement/Finance, namun dapat melihat *final price target*. |
| **Versioning** | *Row-Level Versioning* — setiap revisi proposal memiliki snapshot (v1.0, v1.1) yang dapat dibandingkan *side-by-side*. |
| **UI/UX** | Konsep *modern spreadsheet* agar departemen operasional tetap familiar dalam menginput angka, namun didukung kontrol database yang ketat. |
| **Auditability** | Log perubahan bersifat *immutable* (append-only), mendukung kebutuhan audit sebagai perusahaan Tbk. |
| **Performance** | Kalkulasi *what-if simulation* dan *price calculation* harus real-time (< 2 detik response untuk perubahan slider). |
| **Availability** | Target uptime 99.5% untuk *production environment*, mengingat sistem menjadi gerbang wajib (*mandatory gate*) proses pricing. |

---

## 6. Implementation Phasing Roadmap

| Fase | Fokus Utama | Target Deliverables |
|---|---|---|
| **Phase 1: Core Governance** | Dynamic CBS Engine, Fixed Multi-Dept Workflow, SLA Tracking, ERP Integration. | Eliminasi *process bypass* & standardisasi struktur biaya. |
| **Phase 2: Agility & Tracking** | Dynamic Workflow Builder, Targeted Rejection Engine, Audit Trail, Dashboard Observabilitas. | Fleksibilitas alur kerja & transparansi status *real-time*. |
| **Phase 3: DSS & Analytics** | What-If Simulation Engine, Margin Guardrails, AI Outlier Detection, Win/Loss Analytics. | Kecepatan dan ketepatan pengambilan keputusan harga oleh manajemen. |

---

## 7. Module → Feature → Task Breakdown (Reference)

Ringkasan hasil pemetaan detail effort (lihat *Timeline & Effort Detail*):

| Module | Fitur Utama |
|---|---|
| Auth & User Management | Login, User Management (CRUD), RBAC/ABAC Permission, Access Audit Log |
| Master Data | Master Cost Item (+ Import Excel bulk), Margin & Financial Factor, Pricing Template |
| Dynamic Pricing | CBS Builder (tree), Dynamic Formula Builder, Price Calculation (GPM/EBITDA/BEP), Row-Level Versioning, Export PDF |
| Workflow (Multi-Dept Approval) | Workflow Configurator (No-Code), Strict Gatekeeping, Rejection & Routing, Dynamic Form Adjustment, Eskalasi Otomatis |
| State Tracking & Observability | Pricing Lifecycle Dashboard (Kanban+Table), SLA Timer & Escalation Notif, Immutable Audit Trail |
| DSS & Simulation | What-If Sensitivity Simulator, Margin Guardrails & Anomaly Detection, Win/Loss Pricing Analytics |
| Integrasi Eksternal | ERP Integration (SAP/Odoo), CRM Integration (Salesforce/HubSpot), Notifikasi MS Teams |

Detail task-level effort sizing tersedia di dokumen sumber `[Timeline & Effort] VKTR - Price Core`.

---

## 8. Out of Scope (Asumsi Fase Awal)

- Payment processing / invoicing langsung (tetap di ERP eksisting; PriceCore hanya mengekspor harga final).
- Manajemen inventori fisik BOM (data ditarik read-only dari ERP, bukan dikelola di PriceCore).
- Aplikasi mobile native (fase awal berbasis web responsive).

---

## 9. Success Metrics

| Metrik | Target |
|---|---|
| Proses *bypass* departemen | 0 insiden setelah Phase 1 |
| Waktu siklus persetujuan penawaran (*end-to-end*) | Turun ≥ 40% dibanding proses manual/spreadsheet |
| Insiden *underquoting* akibat margin di bawah threshold | 0 insiden lolos ke *final approved* |
| Adopsi *What-If Simulator* oleh manajemen dalam negosiasi | ≥ 80% transaksi besar (> Rp 10M) menggunakan simulasi sebelum sign-off |
| Akurasi data biaya vs ERP (setelah sinkronisasi) | Selisih < 1% |

---

## 10. References

- `ConceptDSSpricingVKTR (1).pdf` — Draft PRD v1.0 asli
- `VKTR-PriceCore_Strategic_Pricing_Architecture.pdf` — Ringkasan Aplikasi/Analitik/Impact per modul
- `[Timeline & Effort] VKTR - Price Core - Copy of Detail - VKTR.pdf` — Breakdown modul/fitur/task untuk estimasi effort
- `image (2).png` — Diagram ringkas Applications → Analytics/Visualization → Impact
