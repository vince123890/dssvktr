# Product Requirement Document (PRD)

## Enterprise Smart Pricing & Decision Support System (VKTR-PriceCore)

| | |
|---|---|
| **Document Version** | 2.0 (Commercial Quotation Alignment) |
| **Target Entity** | PT VKTR Teknologi Mobilitas Tbk |
| **Domain** | Commercial EV & Mobility Solutions (EV Bus, EV Truck, Battery Systems, Charging Infrastructure & Aftermarket) |
| **Source Materials** | **Commercial Quotation Approval System Requirement for VKTR.pdf (authoritative)**, ConceptDSSpricingVKTR.pdf, VKTR-PriceCore Strategic Pricing Architecture.pdf, Timeline & Effort Detail.pdf |

> **Catatan revisi v2.0.** Dokumen *Commercial Quotation Approval System
> Requirement for VKTR* menetapkan SOP quotation dan hierarki approval
> yang berlaku di VKTR. Struktur approval di v1.1 (Procurement →
> Engineering → Finance → C-Level) merupakan asumsi awal dan **digantikan
> seluruhnya** oleh alur COGS Owner yang sesungguhnya (Sales Officer →
> Chief Sales → VP Finance ∥ VP Operations → BOD). Ditambahkan pula
> **Commercial Negotiation Process** berbasis *delegated discount
> authority* yang sebelumnya tidak tercakup.

---

## 1. Executive Summary & Problem Context

Sebagai manufaktur dan penyedia solusi kendaraan listrik komersial, VKTR beroperasi dengan struktur biaya (*Cost Breakdown Structure*) yang kompleks — terdiri dari komponen *import/BOM*, bea masuk, karoseri, sistem baterai, instalasi infrastruktur pengisian daya, hingga garansi layanan jangka panjang.

Inisiatif ini dipicu oleh **transaksi komersial nyata yang mengungkap celah teknis pada proses penyusunan quotation**, yang berujung pada *final selling price* tidak sejalan dengan target profitabilitas perusahaan. Kejadian tersebut menegaskan kebutuhan akan sistem terpusat yang memvalidasi seluruh komponen harga dan persyaratan approval **sebelum** quotation dirilis ke pelanggan.

Saat ini, pembentukan harga di VKTR menghadapi tantangan berikut:

1. **Validasi Komponen Biaya Tidak Lengkap** — Quotation dapat dirilis sebelum seluruh komponen COGS divalidasi oleh pemiliknya (*COGS Owner*), sehingga sebagian biaya luput dari perhitungan.
2. **Miskomunikasi Commercial ↔ COGS Owner** — Koordinasi manual antara tim komersial dan pemilik komponen biaya (VP Finance, VP Operations) rawan salah paham saat penyusunan harga.
3. **Proses Approval Manual** — Persetujuan berantai secara manual memperpanjang *quotation turnaround time*.
4. **Visibilitas Profitabilitas Rendah saat Negosiasi** — Saat pelanggan meminta diskon, tidak ada alat yang menampilkan dampak diskon terhadap margin secara langsung.
5. **Risiko *Margin Leakage*** — Gabungan dari poin di atas berpotensi menghasilkan quotation dengan margin jauh di bawah target.
6. **Ketiadaan Decision Support System (DSS)** — Manajemen tidak memiliki alat simulasi harga (*What-If Analysis*) yang tangkas dan presisi saat bernegosiasi atau menghadapi fluktuasi variabel eksternal (kurs, harga komoditas baterai/lithium, diskon volume).

VKTR-PriceCore hadir sebagai sistem terpusat yang menggabungkan *dynamic pricing engine*, *COGS validation & approval workflow*, *commercial negotiation engine*, *observability dashboard*, dan *decision support system* dalam satu platform, terintegrasi dengan ERP dan CRM eksisting.

**Tujuan akhir:** memastikan setiap quotation yang dirilis ke pelanggan telah melalui validasi biaya yang lengkap, memuat seluruh komponen harga yang dipersyaratkan, dan melindungi target margin perusahaan — sehingga risiko *margin leakage* akibat informasi harga yang tidak lengkap atau miskomunikasi dapat dihilangkan.

---

## 2. System Objectives & Strategic Outcomes

| Objective | Deskripsi |
|---|---|
| **Complete COGS Validation** | Tidak ada quotation yang dapat dirilis sebelum **seluruh komponen COGS mandatory** divalidasi oleh *COGS Owner* masing-masing (VP Finance & VP Operations). |
| **100% Process Compliance** | Mengunci alur pembentukan harga sehingga tidak ada tahap approval yang dapat dilewati (*zero bypass*). |
| **Delegated Authority Enforcement** | Permintaan diskon otomatis dirutekan sesuai *approval authority* berjenjang (Sales Officer → Chief Sales → BOD), tanpa bergantung pada ingatan atau koordinasi manual. |
| **Margin Leakage Prevention** | Sistem menolak/menandai quotation yang melanggar target margin perusahaan sebelum dirilis ke pelanggan. |
| **Single Source of Truth** | Digitalisasi seluruh komponen biaya dan margin ke dalam satu *Dynamic Cost Engine* terpusat. |
| **Agile & Configurable Workflow** | Fleksibilitas mengubah alur persetujuan, komponen biaya, ambang diskon, dan parameter tanpa *hard-coding* atau rilis ulang aplikasi. |
| **Executive DSS** | Menyediakan simulasi dampak perubahan parameter eksternal (kurs, harga material, diskon volume) terhadap *Gross Margin* secara *real-time*. |
| **Auditability** | Setiap perubahan angka harga, diskon, dan approval harus dapat ditelusuri (*who, what, when, why*) untuk kebutuhan audit internal maupun kepatuhan sebagai perusahaan Tbk. |

### Target Pengguna (Personas)

Peran berikut mengikuti SOP quotation VKTR pada dokumen sumber.

| Persona | Fungsi | Kebutuhan Utama |
|---|---|---|
| **Sales Officer** | Commercial | Melakukan Customer KYC, mengajukan *quotation request*, menegosiasikan diskon dalam batas wewenangnya |
| **Chief Sales** | Commercial | Menyusun quotation berdasarkan approval seluruh COGS Owner, meminta validasi COGS, menyetujui diskon di atas wewenang Sales Officer |
| **VP Finance** | COGS Owner | Memvalidasi komponen biaya komersial & finansial: margin policy, OPEX/*overhead allocation*, *financial components* |
| **VP Operations** | COGS Owner | Memvalidasi komponen biaya operasional: logistik, STNK/registrasi kendaraan, *delivery*, biaya operasional lain |
| **BOD / Direksi** | Executive | Meninjau *commercial case* untuk diskon di luar wewenang Chief Sales; Approve / Reject / Revise |
| **System Admin** | IT/Operations | Konfigurasi *workflow*, *master data*, ambang wewenang diskon, dan hak akses |

---

## 3. Detailed Functional Requirements (FR)

### Module 1 — Dynamic Pricing Component & Master Data Engine (Data Engineering Layer)

*Modul ini memetakan seluruh struktur komponen biaya dan margin secara hierarkis dan terpusat.*

- **FR-1.1 Mappable Cost Breakdown Structure (CBS) dengan COGS Ownership**

  Setiap item biaya **wajib** memiliki *COGS Owner* — fungsi yang bertanggung jawab memvalidasinya. Kepemilikan inilah yang menggerakkan *gatekeeping* di Module 2.

  | Kelompok | Item | COGS Owner |
  |---|---|---|
  | **Direct Costs (Unit)** | BOM (Battery, Chassis, Powertrain), Karoseri/Body Building, Bea Masuk/Tarif Impor | VP Operations |
  | **Operational Costs** | Logistics & Shipping, STNK / Vehicle Registration, Delivery & Handling, Operational Cost lain | **VP Operations** |
  | **Indirect Costs** | Testing & Homologasi, Pengujian Tipe, Warranty Provision, After-Sales Maintenance Support | VP Operations |
  | **Financial & Overhead** | OPEX / Overhead Allocation, Cost of Funds, Financial Leasing Margin, *Financial Components* lain | **VP Finance** |
  | **Margin Policy** | Target Margin, Sales Commission, Contingency Buffer | **VP Finance** |

  - Item bertanda `is_mandatory` tidak boleh kosong saat quotation hendak dirilis (FR-2.2).
  - Penambahan item baru di tengah proses memicu *re-verification* ke COGS Owner terkait (FR-2.4).
- **FR-1.2 Dynamic Formula Builder**
  - Kemampuan menyusun rumus kustom per lini bisnis (misal: B2G Tender Bus vs B2B Commercial Fleet).
  - Integrasi data parameter eksternal (misal: kurs USD/CNY ke IDR, harga acuan komoditas baterai/lithium).
  - Kemampuan *test/simulate* rumus secara *on-the-fly* sebelum disimpan sebagai template.
- **FR-1.3 Pricing Template Management**
  - Penyediaan *preset template* pembentukan harga berdasarkan tipe transaksi (Penjualan Unit, *EV Fleet Lease*, *Charging Infrastructure Buildout*).
  - Template terdiri dari kombinasi CBS items + margin factors yang dapat digunakan ulang.

### Module 2 — Quotation Approval Workflow Engine (COGS Validation)

*Engine otomatisasi proses untuk memastikan governance, validasi COGS lengkap, dan pelacakan status quotation.*

- **FR-2.0 Alur Quotation Baku**

  ```
  Sales Officer                     Chief Sales
  ─────────────                     ───────────
  Customer Qualification    ──►     Quotation Request  ──►  Request COGS Validation
  (KYC & Opportunity                                                   │
   Assessment)                            ┌──────────────────────────┴──────────────────────────┐
                                          ▼                                                     ▼
                                   VP Finance                                            VP Operations
                                   · Margin                                              · Logistics
                                   · OPEX                                                · STNK
                                   · Financial Components                                · Delivery
                                                                                         · Operational Cost
                                          └──────────────────────────┬──────────────────────────┘
                                                                     ▼
                                                            Semua COGS Approved
                                                                     ▼
                                                        Final Quotation Released
  ```

  - **VP Finance dan VP Operations bekerja paralel** — keduanya dapat memvalidasi bersamaan, tidak saling menunggu.
  - Quotation hanya dapat dirilis setelah **seluruh** COGS Owner menyetujui (*AND-join*).

- **FR-2.1 No-Code/Low-Code Workflow Configurator**
  - Admin dapat membentuk dan mengubah alur persetujuan (sekuensial maupun **paralel**) sesuai matriks otorisasi perusahaan.
  - Mendukung *parallel group*: beberapa approver dalam satu tahap yang harus selesai semua sebelum lanjut.
  - Eskalasi otomatis berdasarkan nilai transaksi maupun **besaran diskon** (lihat Module 6).
- **FR-2.2 Strict Gatekeeping & State Locking**
  - Quotation tidak dapat maju ke tahap berikutnya sebelum seluruh *mandatory COGS component* milik tahap tersebut divalidasi oleh pemiliknya.
  - **Release gate**: `Final Quotation Released` mustahil tercapai selama masih ada komponen mandatory yang belum tervalidasi — ini adalah penjaga utama terhadap *margin leakage*.
- **FR-2.3 Rejection & Routing Logic**
  - **Approve with Conditions**: Persetujuan dengan catatan khusus yang tercatat di log hingga fase eksekusi.
  - **Targeted Rejection**: Penolakan dapat dikembalikan langsung ke pihak spesifik (misal: Reject dari VP Finance dikembalikan ke Chief Sales) tanpa membatalkan *draft* dari awal.
- **FR-2.4 Dynamic Form Adjustment**
  - Jika terdapat komponen biaya baru yang ditambahkan di tengah proses, alur kerja secara otomatis mengarahkan formulir ke **COGS Owner** pemilik komponen tersebut untuk diverifikasi ulang.

### Module 3 — State Tracking & Observability Dashboard

*Sistem pelacakan transparan untuk visibilitas posisi penawaran harga.*

- **FR-3.1 Quotation Lifecycle Tracker (Kanban & Table View)**
  - Pelacakan status quotation secara visual (*Drafting*, *Pending COGS Validation*, *Pending Chief Sales Review*, *Pending BOD Approval*, *Quotation Released*).
  - Menampilkan status per COGS Owner secara terpisah saat tahap paralel berjalan (mis. VP Finance ✔ / VP Operations ⏳).
  - Filter kompleks: berdasarkan pemilik COGS, status, tanggal, dan nilai transaksi.
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

### Module 6 — Commercial Negotiation & Delegated Discount Authority

*Modul yang mendigitalkan proses negosiasi harga dengan pelanggan sesuai hierarki wewenang diskon.*

- **FR-6.0 Alur Negosiasi Baku**

  ```
  Customer Requests Price Negotiation
                 │
                 ▼
  Diskon ≤ batas wewenang Sales Officer? ──YES──► Sales Officer Approves & Issue Quotation
                 │ NO
                 ▼
  Diskon ≤ batas wewenang Chief Sales?   ──YES──► Chief Sales Approves & Issue Quotation
                 │ NO
                 ▼
        BOD Reviews Commercial Case
                 │
                 ▼
        Approve / Reject / Revise
                 │
                 ▼
        Final Quotation Released
  ```

- **FR-6.1 Discount Authority Matrix (Configurable)**
  - Admin menetapkan batas wewenang diskon maksimum per peran, contoh: Sales Officer ≤ 3%, Chief Sales ≤ 8%, di atas itu wajib BOD.
  - Ambang batas adalah *master config* — dapat diubah tanpa rilis ulang aplikasi.
  - Dapat di-*scope* per lini bisnis (mis. batas diskon B2G berbeda dengan B2B).
- **FR-6.2 Automatic Escalation Routing**
  - Saat permintaan diskon diajukan, sistem **otomatis menentukan** siapa approver yang berwenang berdasarkan besaran diskon — pengaju tidak dapat memilih approver sendiri (mencegah *authority bypass*).
  - Jika diskon melebihi wewenang tertinggi non-BOD, kasus otomatis naik ke BOD sebagai *commercial case*.
- **FR-6.3 Negotiation Decision & Revision Loop**
  - BOD dapat memilih **Approve**, **Reject**, atau **Revise** (mengajukan diskon tandingan/*counter-offer*).
  - Keputusan `Revise` mengembalikan kasus ke pengaju dengan nilai diskon usulan baru, memulai evaluasi wewenang ulang.
- **FR-6.4 Real-Time Margin Impact Visibility**
  - Saat besaran diskon diinput, sistem langsung menampilkan dampaknya terhadap *final price*, GPM, dan status *margin guardrail* — menjawab tantangan *"limited visibility of actual profitability during commercial negotiations"*.
  - Diskon yang menembus ambang margin minimum ditandai secara eksplisit kepada approver sebelum keputusan diambil.
- **FR-6.5 Negotiation Audit Trail**
  - Seluruh riwayat permintaan diskon, eskalasi, dan keputusan tercatat *append-only* dan tertaut ke quotation terkait.

### Module 7 — Customer Qualification (KYC & Opportunity Assessment)

*Tahap kualifikasi awal sebelum quotation request dibuat.*

- **FR-7.1 Customer KYC Record** — Pencatatan identitas & legalitas pelanggan (nama entitas, NPWP, tipe pelanggan B2G/B2B, PIC).
- **FR-7.2 Opportunity Assessment** — Estimasi nilai peluang, lini bisnis, kebutuhan unit, indikasi kompetitor.
- **FR-7.3 Qualification Gate** — Quotation request hanya dapat dibuat untuk pelanggan berstatus *Qualified*; status ditetapkan oleh Sales Officer.

> **Catatan implementasi POC.** Module 7 didokumentasikan sebagai requirement
> resmi namun **tidak dibangun** pada POC saat ini (lihat §8 Out of Scope) —
> fokus POC ada pada pricing governance, COGS validation, dan negotiation
> authority. Data pelanggan pada POC cukup berupa field bebas di quotation.

---

## 4. High-Level Data & Process Flow

```
[ Master Data CBS + COGS Owner ] ─┐
[ Ext. FX & Commodity ]          ─┼──> [ Dynamic Pricing Engine ] ──> [ DSS ]
[ COGS Owner Cost Inputs ]       ─┘             │
                                                ▼
                             [ Quotation Workflow State Machine ]
                                                │
                          ┌─────────────────────┴─────────────────────┐
                          ▼                                           ▼
                  VP Finance validates                       VP Operations validates
                  (margin, OPEX, financial)                  (logistics, STNK, delivery)
                          └─────────────────────┬─────────────────────┘
                                                ▼  (AND-join: semua COGS approved)
                                    [ Quotation Ready to Release ]
                                                │
                          ┌─────────────────────┴─────────────────────┐
                          ▼                                           ▼
              [ Tanpa negosiasi ]                        [ Customer minta diskon ]
                          │                                           │
                          │                            [ Discount Authority Engine ]
                          │                              Sales Officer / Chief Sales / BOD
                          │                                           │
                          └─────────────────────┬─────────────────────┘
                                                ▼
                                  [ Final Quotation Released ]
                                                │
                                     (Export to ERP/CRM)
```

---

## 5. Non-Functional Requirements (NFR)

| Kategori | Requirement |
|---|---|
| **Integrasi** | *API-First Architecture*. Terhubung ke ERP (SAP/Odoo) untuk sinkronisasi *master BOM* dan *costing*, serta CRM (Salesforce/HubSpot) untuk data pra-penjualan. |
| **Security & Access** | RBAC/ABAC — Sales Officer tidak dapat melihat *raw margin* milik VP Finance, namun dapat melihat *final price target*. Batas wewenang diskon ditegakkan di *service layer*, tidak dapat dilewati dari klien. |
| **Versioning** | *Row-Level Versioning* — setiap revisi proposal memiliki snapshot (v1.0, v1.1) yang dapat dibandingkan *side-by-side*. |
| **UI/UX** | Konsep *modern spreadsheet* agar departemen operasional tetap familiar dalam menginput angka, namun didukung kontrol database yang ketat. |
| **Auditability** | Log perubahan bersifat *immutable* (append-only), mendukung kebutuhan audit sebagai perusahaan Tbk. |
| **Performance** | Kalkulasi *what-if simulation* dan *price calculation* harus real-time (< 2 detik response untuk perubahan slider). |
| **Availability** | Target uptime 99.5% untuk *production environment*, mengingat sistem menjadi gerbang wajib (*mandatory gate*) proses pricing. |

---

## 6. Implementation Phasing Roadmap

| Fase | Fokus Utama | Target Deliverables |
|---|---|---|
| **Phase 1: Core Governance** | Dynamic CBS Engine + COGS Ownership, Quotation Workflow (paralel VP Finance ∥ VP Operations), Release Gate, SLA Tracking, ERP Integration. | Eliminasi *process bypass* & jaminan validasi COGS lengkap sebelum rilis. |
| **Phase 2: Negotiation & Tracking** | Commercial Negotiation Engine (delegated discount authority), Dynamic Workflow Builder, Targeted Rejection, Audit Trail, Dashboard Observabilitas. | Kepatuhan hierarki wewenang diskon & transparansi status *real-time*. |
| **Phase 3: DSS & Analytics** | What-If Simulation Engine, Margin Guardrails, AI Outlier Detection, Win/Loss Analytics. | Kecepatan dan ketepatan pengambilan keputusan harga oleh manajemen. |

---

## 7. Module → Feature → Task Breakdown (Reference)

Ringkasan hasil pemetaan detail effort (lihat *Timeline & Effort Detail*):

| Module | Fitur Utama |
|---|---|
| Auth & User Management | Login, User Management (CRUD), RBAC/ABAC Permission, Access Audit Log |
| Master Data | Master Cost Item + COGS Owner (+ Import Excel bulk), Margin & Financial Factor, Pricing Template, **Discount Authority Matrix** |
| Dynamic Pricing | CBS Builder (tree), Dynamic Formula Builder, Price Calculation (GPM/EBITDA/BEP), Row-Level Versioning, Export PDF |
| Quotation Approval Workflow | Workflow Configurator (No-Code), **Parallel COGS Validation (AND-join)**, Strict Gatekeeping & Release Gate, Rejection & Routing, Dynamic Form Adjustment |
| **Commercial Negotiation** | **Discount Request, Authority Matrix Evaluation, Auto-Escalation Routing, BOD Approve/Reject/Revise, Real-Time Margin Impact** |
| State Tracking & Observability | Quotation Lifecycle Dashboard (Kanban+Table), SLA Timer & Escalation Notif, Immutable Audit Trail |
| DSS & Simulation | What-If Sensitivity Simulator, Margin Guardrails & Anomaly Detection, Win/Loss Pricing Analytics |
| Customer Qualification | Customer KYC Record, Opportunity Assessment, Qualification Gate |
| Integrasi Eksternal | ERP Integration (SAP/Odoo), CRM Integration (Salesforce/HubSpot), Notifikasi MS Teams |

Detail task-level effort sizing tersedia di dokumen sumber `[Timeline & Effort] VKTR - Price Core`.

---

## 8. Out of Scope (Asumsi Fase Awal)

- Payment processing / invoicing langsung (tetap di ERP eksisting; PriceCore hanya mengekspor harga final).
- Manajemen inventori fisik BOM (data ditarik read-only dari ERP, bukan dikelola di PriceCore).
- Aplikasi mobile native (fase awal berbasis web responsive).
- **Module 7 (Customer KYC & Opportunity Assessment)** — didokumentasikan sebagai requirement, namun tidak dibangun pada POC. Kualifikasi pelanggan diasumsikan sudah dilakukan di luar sistem; quotation cukup mencatat nama pelanggan sebagai referensi.

---

## 9. Success Metrics

| Metrik | Target |
|---|---|
| Quotation dirilis dengan komponen COGS tidak lengkap | **0 insiden** — dijamin oleh *release gate* (FR-2.2) |
| *Bypass* COGS Owner (VP Finance / VP Operations) | 0 insiden setelah Phase 1 |
| Diskon disetujui di luar batas wewenang | **0 insiden** — dijamin oleh Discount Authority Engine (FR-6.2) |
| *Quotation turnaround time* (end-to-end) | Turun ≥ 40% dibanding proses manual |
| Insiden *margin leakage* (margin final < target tanpa persetujuan BOD) | 0 insiden |
| Adopsi *What-If Simulator* / margin impact saat negosiasi | ≥ 80% kasus negosiasi menampilkan dampak margin sebelum keputusan |
| Akurasi data biaya vs ERP (setelah sinkronisasi) | Selisih < 1% |

---

## 10. References

- `Commercial Quotation Approval System Requirement for VKTR.pdf` — **Sumber otoritatif v2.0**: SOP quotation, hierarki COGS Owner, dan proses negosiasi berbasis delegated discount authority
- `ConceptDSSpricingVKTR (1).pdf` — Draft PRD v1.0 asli
- `VKTR-PriceCore_Strategic_Pricing_Architecture.pdf` — Ringkasan Aplikasi/Analitik/Impact per modul
- `[Timeline & Effort] VKTR - Price Core - Copy of Detail - VKTR.pdf` — Breakdown modul/fitur/task untuk estimasi effort
- `image (2).png` — Diagram ringkas Applications → Analytics/Visualization → Impact
