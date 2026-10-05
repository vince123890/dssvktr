# Product Requirement Document (PRD)

## Enterprise Smart Pricing & Decision Support System (VKTR-PriceCore)

| | |
|---|---|
| **Document Version** | 4.0 (Konfirmasi VKTR — Aktor & Wewenang Maker/Checker/Releaser, Basic Workflow *Price Estimate* & *Official Quotation*, Format Dokumen Cost Estimate) |
| **Target Entity** | PT VKTR Teknologi Mobilitas Tbk |
| **Domain** | Commercial EV & Mobility Solutions (EV Bus, EV Truck, Battery Systems, Charging Infrastructure & Aftermarket) |
| **Source Materials** | **`BTEL - Cost and Roles and Flow.xlsx` (otoritatif v4.0 — sheet *Cost Structure*, *Actors*, *Basic Workflow*)**, **`Cost Estimate - PT Siborong Nusa Gemilang 20260906.pdf` (contoh dokumen keluaran riil)**, `transcribe.md` (demo review POC v2.1), Commercial Quotation Approval System Requirement for VKTR.pdf, Simulasi_HPM_Nikel_Kepmen_2026.xlsx, ConceptDSSpricingVKTR.pdf, VKTR-PriceCore Strategic Pricing Architecture.pdf, Timeline & Effort Detail.pdf |

> **Catatan revisi v4.0.** Dua dokumen dari VKTR menjawab sebagian besar
> *open item* v3.0 dan mengoreksi beberapa asumsi strukturalnya:
>
> 1. **Aktor & peran dikonfirmasi** (sheet *Actors*). Peran asumsi v3.0
>    (VP Operations, VP Finance, Chief Sales, BOD) diganti peran riil:
>    **Head of Procurement and Operations Control** & **Procurement
>    Manager** (*COGS Owner*), **Head of Corporate Finance**
>    (*Profitability Owner*), **Head of Sales** & **Sales Operations
>    Manager** (*Sales Pricing Owner*), serta **Chief Commercial Officer**
>    & **Chief Finance Officer** (*Pricing Committee*). Inisiator adalah
>    **Salesperson** (Sales Executive / Sales Lead); *Price Estimate* juga
>    dapat diakses **Authorized Agency**. Pemetaan lama → baru ada di §2.
> 2. **Kepemilikan cost group dikonfirmasi** — menutup Technical Logic
>    §14 no. 12 v3.0. Sekaligus **koreksi dokumentasi**: STNK dan
>    Insurance adalah kelompok **Add-Ons**, bukan Sales. Baik
>    `BTEL-CostStructure.xlsx` lama maupun file baru menempatkannya di
>    Add-Ons; PRD/Technical Logic/Demo v3.0 salah memindahkannya ke Sales.
> 3. **Wewenang Maker–Checker–Releaser per scope** (baru). Setiap scope
>    (COGS, Add-Ons, Margin, Sales) punya pemilik dengan wewenang *Maker*,
>    *Checker*, dan *Releaser*. Wewenang berbeda antara **skenario
>    Regular (margin ≥ 10%)** dan **skenario Deviation (margin < 10%)** —
>    pada Deviation, Pricing Committee ikut berwenang atas semua scope.
> 4. **Validasi COGS berpindah dari "per quotation berurutan" ke "cost
>    structure per varian yang dirilis".** Basic Workflow VKTR
>    meng-*generate* Official Quotation secara otomatis untuk 1–9 unit
>    dan menampilkan *estimate price* seketika — artinya cost structure
>    per varian sudah terisi dan tervalidasi **sebelum** quotation dibuat.
>    Urutan pengisian per quotation v3.0 (Sales → VP Operations → VP
>    Finance → Chief Sales) **digantikan**: cost structure dipelihara &
>    dirilis lewat Maker–Checker–Releaser (FR-1.1.2), lalu dipakai oleh
>    seluruh quotation. Penyimpangan per deal tetap melewati
>    Maker–Checker–Releaser pemilik scope-nya (FR-1.1.3).
> 5. **Basic Workflow resmi VKTR** (sheet *Basic Workflow*) menggantikan
>    dua template asumsi v3.0 (Margin-Tier & Segmen Customer):
>    (a) **Sales To Obtain Price Estimate (per Unit)** — *self-service*,
>    tanpa approval; (b) **Sales To Obtain Official Quotation** — KYC →
>    validasi Sales Lead → *generate* oleh Sales Operations berdasar
>    **kuantitas** → review Head of Sales → *routing* berbasis margin.
> 6. **Tier margin dikoreksi menjadi 15% / 10%**, bukan 15% / 12%:
>    GM ≥ 15% dirilis Head of Sales; 10%–15% perlu approval **COGS Owner
>    + Profitability Owner**; < 10% perlu approval **CCO + CFO** dengan
>    tembusan (cc) ke COGS & Profitability Owner. Penolakan dikembalikan
>    ke **Sales Operations**. Approval 2 BOD dan opsi *BOD delegation*
>    v3.0 dicabut.
> 7. **Negosiasi dilebur ke jalur rilis.** Diskon ditetapkan Sales
>    Operations (default per *quantity band*, dapat diubah manual), Head
>    of Sales dapat merevisi, lalu tier dihitung dari GM **setelah
>    diskon** pada langkah rilis. Negosiasi setelah quotation dirilis
>    menghasilkan **quotation revisi** (FR-2.5) yang mengulang langkah
>    *generate* → review → routing margin. State machine negosiasi
>    terpisah v3.0 (Fase 3) tidak lagi dibutuhkan.
> 8. **KYC (Module 7) masuk scope.** Sebelumnya *Out of Scope* POC; kini
>    menjadi langkah 2 wajib Official Quotation dengan 8 field (6 wajib).
> 9. **Quantity band** (baru): 1 unit → *auto-generate* harga dasar;
>    2–5 dan 6–9 unit → *auto-generate* dengan opsi manual (tingkat
>    diskon dapat diatur); 10+ unit → diproses manual.
> 10. **Multi-line item** — satu quotation dapat berisi lebih dari satu
>     varian kendaraan beserta kuantitasnya (KYC item b).
> 11. **Format dokumen keluaran riil** (PDF *Cost Estimate*) — menutup
>     sebagian Technical Logic §14 no. 13: nomor dokumen, tanggal rilis &
>     kedaluwarsa (30 hari), blok *To* dari KYC, Sales/Account Person,
>     *Prepared By*, tabel Quantity/Description/Unit/Total,
>     *Inclusions*, *Exclusions (At cost)*, *Special Notes*, blok
>     penerimaan (tanda tangan), serta halaman spesifikasi dari Product
>     Master Data (FR-1.5.3).
> 12. **PPN/VAT** (baru) — harga ditampilkan *excl.* dan *incl. VAT*; GM
>     & tier dihitung dari harga *excl. VAT* (FR-1.6).
> 13. **Skema komersial Purchase vs Rental** (baru) — dokumen contoh
>     adalah *Rental Scheme, 5-year Contract* dengan harga per bulan
>     (FR-1.7). Formula rental **belum diterima** dari VKTR.
> 14. **Delivery Service boleh dirilis sebagai *Exclusion — At cost***.
>     Dokumen contoh berbasis *loco Magelang* dan mencantumkan *Delivery
>     To Site — At cost* sebagai pengecualian. Item `may_follow_later`
>     kini harus **bernilai atau dinyatakan eksplisit sebagai
>     pengecualian**, bukan otomatis memblokir rilis (FR-2.2).
> 15. **Masa berlaku quotation** (baru) — `valid_until` & status
>     `EXPIRED` (FR-2.9).
> 16. **Atribut varian produk** diperjelas (make/model/type/variant,
>     wheelbase, kapasitas baterai, aplikasi bodi, CKD/CBU, titik *loco*).
>     Nuansa terhadap v3.0: FOB Price mencakup **kit CKD** yang dirakit di
>     Magelang (karena itu ada Assembly Cost & Local Parts), bukan unit
>     jadi siap pakai.
> 17. **Role, wewenang, dan workflow dari attachment wajib dapat diatur
>     di aplikasi** (permintaan eksplisit VKTR pasca-review). Seluruh isi
>     sheet *Actors* dan *Basic Workflow* adalah **data konfigurasi**
>     yang dikelola System Admin lewat menu Settings — bukan
>     *hardcode* — termasuk menambah role, memetakan user ke role,
>     matriks scope × Maker/Checker/Releaser × skenario, ambang dan
>     approver tier, quantity band, serta langkah workflow (FR-5.6,
>     FR-2.1).
> 18. **Preview & cetak quotation** (FR-1.5.4) — hasil quotation dapat
>     ditampilkan di layar dan dicetak/diunduh PDF dalam format *Cost
>     Estimate* (FR-1.5.3), termasuk halaman spesifikasi, untuk setiap
>     versi yang pernah dirilis.
> 19. **Menu & akses data dibatasi per role** (FR-5.7, permintaan VKTR
>     pasca-review). Setiap role hanya melihat menu yang ia pakai; menu
>     lain **disembunyikan**, dan halamannya menjawab **404** bila dibuka
>     lewat URL. Data quotation juga dibatasi per baris (Salesperson
>     hanya melihat quotation miliknya). Matriks diatur di Settings →
>     Akses Menu.
> 20. **Workflow Template Catalog benar-benar banyak template** (FR-2.0.1,
>     v4.1). Demo review: VKTR memperkirakan **±30 variasi workflow**
>     muncul setelah aplikasi berjalan; *qualifier*-nya statis (segmen
>     B2G/B2B/B2C, relasi khusus, industri, ambang harga, blacklist),
>     jumlah template-nya yang terus bertambah, masing-masing dengan
>     alur approval, rute tolak, dan wewenang diskon sendiri. Settings
>     kini menyediakan katalog (buat, duplikat, ubah, aktif/nonaktif),
>     qualifier per template, tier margin khusus per template, dan alat
>     uji pemilihan template; enam template contoh disediakan.

### Riwayat Revisi Sebelumnya (ringkas)

| Versi | Sumber | Inti perubahan | Status di v4.0 |
|---|---|---|---|
| 2.0 | Commercial Quotation Approval System Requirement | COGS Owner, release gate, negosiasi berbasis *delegated discount authority* | Prinsip release gate & *zero bypass* tetap; aktor & tangga diskon diganti |
| 2.1 | Kebutuhan multi-currency & HMA | Input USD/IDR, Mineral Index Adjustment | Basis diganti CNY (v3.0); adjustment HMA nonaktif (v3.0) — tetap |
| 3.0 | `transcribe.md` (demo review POC v2.1) | Master data tunggal, Workflow Template Catalog, tier berbasis GPM, Project Identifier, kurs CNY otomatis + *rate sensitivity*, Fraud Guard, Product Master Data | Sebagian besar tetap. **Dikoreksi v4.0**: aktor, urutan validasi COGS, tier 12%→10%, 2 BOD→CCO+CFO, Sales group (STNK/Insurance), KYC masuk scope |

Teks lengkap catatan revisi v2.0–v3.0 tersedia di riwayat git dokumen
ini.

---

## 1. Executive Summary & Problem Context

Sebagai manufaktur dan penyedia solusi kendaraan listrik komersial, VKTR beroperasi dengan struktur biaya (*Cost Breakdown Structure*) yang kompleks — terdiri dari harga beli kit kendaraan (FOB, dalam CNY), bea masuk, perakitan lokal di Magelang, karoseri, garansi, hingga biaya registrasi dan layanan pelengkap.

Inisiatif ini dipicu oleh **transaksi komersial nyata yang mengungkap celah teknis pada proses penyusunan quotation**, yang berujung pada *final selling price* tidak sejalan dengan target profitabilitas perusahaan. Kejadian tersebut menegaskan kebutuhan akan sistem terpusat yang memvalidasi seluruh komponen harga dan persyaratan approval **sebelum** quotation dirilis ke pelanggan.

Saat ini, pembentukan harga di VKTR menghadapi tantangan berikut:

1. **Validasi Komponen Biaya Tidak Lengkap** — Quotation dapat dirilis sebelum seluruh komponen biaya divalidasi oleh pemiliknya (*COGS Owner*, *Profitability Owner*, *Sales Pricing Owner*), sehingga sebagian biaya luput dari perhitungan.
2. **Miskomunikasi Commercial ↔ Pemilik Biaya** — Koordinasi manual antara tim komersial dan pemilik komponen biaya (Procurement & Operations Control, Corporate Finance) rawan salah paham saat penyusunan harga.
3. **Proses Approval Manual** — Persetujuan berantai secara manual memperpanjang *quotation turnaround time*.
4. **Visibilitas Profitabilitas Rendah saat Negosiasi** — Saat pelanggan meminta diskon, tidak ada alat yang menampilkan dampak diskon terhadap margin secara langsung.
5. **Risiko *Margin Leakage*** — Gabungan dari poin di atas berpotensi menghasilkan quotation dengan margin jauh di bawah target.
6. **Ketiadaan Decision Support System (DSS)** — Manajemen tidak memiliki alat simulasi harga (*What-If Analysis*) yang tangkas saat bernegosiasi atau menghadapi fluktuasi variabel eksternal (kurs CNY/IDR, diskon volume).

VKTR-PriceCore hadir sebagai sistem terpusat yang menggabungkan *dynamic pricing engine*, *cost structure governance (Maker–Checker–Releaser)*, *quotation approval workflow*, *observability dashboard*, dan *decision support system* dalam satu platform, terintegrasi dengan ERP dan CRM eksisting.

> **Prinsip kunci.**
> 1. **Satu master data cost structure** untuk semua segmen pelanggan
>    (demo review v3.0) — yang bervariasi hanyalah alur approval dan
>    komponen di atas biaya dasar.
> 2. **Cost structure dipelihara per varian produk dan dirilis lewat
>    Maker–Checker–Releaser** sebelum boleh dipakai (v4.0). Karena itu
>    Salesperson dapat melihat *estimate price* seketika dan quotation
>    1–9 unit dapat di-*generate* otomatis — tanpa menunggu pengisian
>    biaya per quotation.
> 3. **Salesperson dan Authorized Agency tidak pernah melihat cost
>    structure.** Detail cost structure hanya mengalir ke Sales
>    Operations, Head of Sales ("*highly confidential*"), pemilik scope,
>    dan Pricing Committee.

**Tujuan akhir:** memastikan setiap quotation yang dirilis ke pelanggan dihitung dari cost structure yang lengkap dan sudah dirilis, memuat seluruh komponen harga yang dipersyaratkan, dan melindungi target margin perusahaan — sehingga risiko *margin leakage* akibat informasi harga yang tidak lengkap atau miskomunikasi dapat dihilangkan.

---

## 2. System Objectives & Strategic Outcomes

| Objective | Deskripsi |
|---|---|
| **Complete Cost Validation** | Tidak ada quotation yang dapat di-*generate* dari cost structure yang belum **dirilis** di keempat scope (COGS, Add-Ons, Margin, Sales), dan tidak ada quotation yang dapat dirilis sebelum seluruh penyimpangan per deal disetujui pemilik scope-nya. |
| **Segregation of Duties** | Setiap perubahan cost structure melewati tahap *Maker*, *Checker*, dan *Releaser* sesuai matriks wewenang per scope & skenario (Regular/Deviation). |
| **100% Process Compliance** | Mengunci alur pembentukan harga sehingga tidak ada tahap approval yang dapat dilewati (*zero bypass*). |
| **Margin-Based Authority Enforcement** | Quotation otomatis dirutekan sesuai GM akhir setelah diskon (≥ 15% → Head of Sales; 10–15% → COGS & Profitability Owner; < 10% → CCO & CFO), tanpa bergantung pada ingatan atau koordinasi manual. |
| **Margin Leakage Prevention** | Sistem menolak/menandai quotation yang melanggar target margin perusahaan sebelum dirilis ke pelanggan. |
| **Complete Customer Context** | Tidak ada Official Quotation tanpa KYC lengkap (field wajib), sehingga harga selalu dapat dikaitkan dengan aplikasi, rute, dan peluang deal yang sebenarnya. |
| **Single Master Data** | Satu struktur cost item berlaku untuk **seluruh lini bisnis**. Variasi antar segmen ditangani di lapisan *workflow* dan penyimpangan per deal, bukan di master data. |
| **Agile & Configurable Workflow Catalog** | Kemampuan menambah dan meng-*assign* *workflow template* baru tanpa *hard-coding* atau rilis ulang aplikasi. |
| **Executive DSS** | Simulasi dampak perubahan parameter eksternal (kurs, harga material, diskon volume) terhadap *Gross Margin* secara *real-time*. |
| **Auditability** | Setiap perubahan angka harga, diskon, dan approval dapat ditelusuri (*who, what, when, why*) untuk audit internal maupun kepatuhan perusahaan Tbk. |

### Target Pengguna (Personas)

Peran berikut mengikuti sheet *Actors* dan *Basic Workflow* pada
`BTEL - Cost and Roles and Flow.xlsx`.

| Persona | Peran (Role) | Scope | Fungsi dalam sistem |
|---|---|---|---|
| **Authorized Agency** | — (eksternal) | — | Hanya **Price Estimate** (FR-2.7): memilih varian, melihat estimasi harga per unit *excl./incl. VAT*. Tidak dapat mengajukan Official Quotation ("*only internal sales*"). |
| **Sales Executive** | Salesperson | — | Inisiator Price Estimate & Official Quotation; mengisi KYC; tidak melihat cost structure. Permintaannya wajib divalidasi Sales Lead. |
| **Sales Lead** | Salesperson | — | Inisiator; **memvalidasi** permintaan Sales Executive sebelum diteruskan ke Sales Operations. Permintaan yang diajukan Sales Lead sendiri langsung ke Sales Operations. |
| **Sales Operations Manager** | Sales Pricing Owner | Sales | ***Generate*** Official Quotation sesuai *quantity band* (FR-2.8), menetapkan tingkat diskon, memproses manual 10+ unit; Maker/Checker/Releaser scope Sales. Tercantum sebagai *Prepared By* pada dokumen. |
| **Head of Sales** | Sales Pricing Owner | Sales | Menerima quotation **beserta detail cost structure**, *accept* atau *revise*, lalu merilis (GM ≥ 15%) atau meneruskan ke approver tier; Maker/Checker/Releaser scope Sales. |
| **Procurement Manager** | COGS Owner | COGS, Add-Ons | Maker/Checker/Releaser scope COGS & Add-Ons; approver GM 10–15%. |
| **Head of Procurement and Operations Control** | COGS Owner | COGS, Add-Ons | Maker/Checker/Releaser scope COGS & Add-Ons; approver GM 10–15%; menerima tembusan GM < 10%. |
| **Head of Corporate Finance** | Profitability Owner | Margin | Maker/Checker/Releaser scope Margin (kelompok Profitability); approver GM 10–15%; menerima tembusan GM < 10%. |
| **Chief Commercial Officer (CCO)** | Pricing Committee | Semua scope (hanya Deviation) | Approver GM < 10% (bersama CFO); pada skenario Deviation berwenang Maker/Checker/Releaser di semua scope. |
| **Chief Finance Officer (CFO)** | Pricing Committee | Semua scope (hanya Deviation) | Sama seperti CCO — keduanya wajib menyetujui. |
| **Product Owner** | Commercial Support | Product Master Data | Mengelola varian produk, spesifikasi, gambar, brosur, dan *default* inclusions/exclusions yang tampil di dokumen. *Tidak tercantum di sheet Actors — dipertahankan dari demo review v3.0; pemegang peran perlu dikonfirmasi.* |
| **System Admin** | IT/Operations | Konfigurasi | Katalog workflow template, matriks wewenang scope, tier margin, *quantity band*, PPN, template dokumen, hak akses. |

**Pemetaan terhadap v3.0** (peran asumsi yang digantikan):

| Peran v3.0 | Diganti oleh (v4.0) | Catatan |
|---|---|---|
| Sales Officer | Sales Executive / Sales Lead (Salesperson) | Tidak lagi mengisi cost line apa pun — kelompok Sales kini dimiliki Sales Pricing Owner |
| — | Sales Operations Manager | Peran baru: *generate* quotation |
| VP Operations | Procurement Manager + Head of Procurement and Operations Control | COGS Owner |
| VP Finance | Head of Corporate Finance | Profitability Owner |
| Chief Sales | Head of Sales | Review & rilis; tidak lagi approver diskon tier menengah |
| BOD (2 orang) | CCO + CFO (Pricing Committee) | Approver GM < 10% |
| — | Authorized Agency | Peran eksternal baru, hanya Price Estimate |

> **Istilah kepemilikan.** Dokumen ini memakai empat istilah sesuai
> sheet *Actors*: **COGS Owner** (scope COGS & Add-Ons), **Profitability
> Owner** (scope Margin = kelompok Profitability), **Sales Pricing Owner**
> (scope Sales), dan **Pricing Committee** (semua scope, hanya pada
> skenario Deviation).

---

## 3. Detailed Functional Requirements (FR)

### Module 1 — Dynamic Pricing Component & Master Data Engine

*Modul ini memetakan seluruh struktur komponen biaya dan margin secara hierarkis, terpusat, dan terkendali lewat Maker–Checker–Releaser.*

- **FR-1.1 Mappable Cost Breakdown Structure — Satu Master Data, Kepemilikan Terkonfirmasi**

  Setiap item biaya **wajib** memiliki *scope* dan pemilik scope —
  kepemilikan inilah yang menggerakkan Maker–Checker–Releaser (FR-1.1.2)
  dan *gatekeeping* (Module 2). Struktur item bersifat **tunggal** untuk
  seluruh lini bisnis (B2G/B2B/B2C).

  > **Sumber: sheet *Cost Structure* & *Actors*.** Kepemilikan kini
  > **terkonfirmasi**, tidak lagi asumsi seperti v3.0.

  | Kelompok (Scope) | Item | Pemilik scope |
  |---|---|---|
  | **COGS** | FOB Price in CNY, FOB Price in IDR, Freight and Insurance, Custom Duties, Port Handling/Clearance/Pre-Delivery Inspection, Carrosserie Allocation, Assembly Cost, Local Parts, Accessories, Telematics, Warehousing and Storage, Warranty Cost, Initial Energy Injection, Administrative Cost | **COGS Owner** — Procurement Manager, Head of Procurement and Operations Control |
  | **Add-Ons** | **STNK**, KEUR, **Insurance**, Processing Service, Delivery Service, Additional | **COGS Owner** — Procurement Manager, Head of Procurement and Operations Control |
  | **Profitability** (scope *Margin*) | VKTS Profit Before Tax, VKTS Margin, VKTR Profit Before Financing Cost, Financing Cost, VKTR Margin After Financing Cost | **Profitability Owner** — Head of Corporate Finance |
  | **Sales** | Incentive Internal, Incentive External, Sales Processing Cost, Agency Fee | **Sales Pricing Owner** — Head of Sales, Sales Operations Manager |

  - **Koreksi v4.0:** STNK dan Insurance berada di **Add-Ons** (dimiliki
    COGS Owner), bukan di Sales seperti tertulis di v3.0. Konsekuensinya
    kedua item ini masuk **biaya dasar** dan ikut memengaruhi GM
    (FR-1.2).
  - **FOB Price in IDR** adalah hasil konversi FOB Price in CNY dengan
    kurs yang dikunci (FR-1.4), bukan input terpisah.
  - Item bertanda `is_mandatory` tidak boleh kosong saat cost structure
    dirilis. **Delivery Service** bertanda *boleh menyusul/dikecualikan*
    (`may_follow_later`): boleh kosong pada cost structure standar
    karena harga berbasis *loco* (mis. *loco Magelang*), namun pada
    quotation wajib **bernilai atau dinyatakan eksplisit sebagai
    *Exclusion — At cost*** (FR-2.2).
  - Struktur item dianggap stabil jangka panjang; yang dinamis adalah
    *nilai* per varian produk dan penyimpangan per deal.
  - **Klasifikasi Direct/Indirect Cost** dipertahankan sebagai kategori
    pelaporan Finance, independen dari scope — pemetaan detail
    dikonfirmasi bersama Corporate Finance.

- **FR-1.1.1 Kelompok Sales (Non-COGS, Non-Profitability)**

  Biaya yang muncul dari proses akuisisi pelanggan — Incentive Internal,
  Incentive External, Sales Processing Cost, Agency Fee — **dimiliki
  Sales Pricing Owner** (Head of Sales / Sales Operations Manager),
  **bukan** Salesperson. Salesperson dan Authorized Agency tidak mengisi
  maupun melihat nilai kelompok ini.
  - Agency Fee dan Incentive External relevan untuk deal yang bersumber
    dari **Authorized Agency** (FR-2.7).
  - Nilai standar per varian dipelihara di cost structure (FR-1.1.2);
    penyesuaian per deal (mis. agency fee proyek tertentu) mengikuti
    FR-1.1.3.

- **FR-1.1.2 Cost Structure per Varian & Maker–Checker–Releaser (baru)**

  Cost structure dipelihara **per varian produk** (FR-1.5.1) sebagai
  *price book* berversi. Sebuah versi baru dapat dipakai oleh Price
  Estimate dan Official Quotation hanya setelah **keempat scope-nya
  berstatus `RELEASED`**.

  - Setiap scope pada satu versi melewati tiga tahap berurutan:
    **Maker** (mengisi/mengubah nilai) → **Checker** (memeriksa, dapat
    mengembalikan ke Maker) → **Releaser** (merilis nilai scope
    tersebut). Scope diproses **independen** satu sama lain — COGS dan
    Margin dapat berjalan bersamaan.
  - Matriks wewenang (sheet *Actors*) — skenario **Regular (margin ≥ 10%)**:

    | Aktor | Scope | Wewenang |
    |---|---|---|
    | Head of Procurement and Operations Control | COGS, Add-Ons | Maker, Checker, Releaser |
    | Procurement Manager | COGS, Add-Ons | Maker, Checker, Releaser |
    | Head of Corporate Finance | Margin | Maker, Checker, Releaser |
    | Head of Sales | Sales | Maker, Checker, Releaser |
    | Sales Operations Manager | Sales | Maker, Checker, Releaser |
    | Chief Commercial Officer | — | *(tidak berwenang pada skenario Regular)* |
    | Chief Finance Officer | — | *(tidak berwenang pada skenario Regular)* |

  - **Pemisahan tugas.** Sheet *Actors* memberi setiap aktor ketiga
    wewenang sekaligus. Sistem **mencatat ketiga tahap sebagai aksi
    terpisah** (siapa, kapan) pada setiap perubahan. Aturan default:
    **Maker dan Checker harus orang berbeda** bila scope memiliki ≥ 2
    aktor berwenang (COGS, Add-Ons, Sales). Scope **Margin hanya punya
    satu aktor** (Head of Corporate Finance), sehingga pada skenario
    Regular satu orang menjalankan ketiga tahap; sistem mengizinkan
    namun menandai sebagai *single-actor release* di audit trail. Aturan
    ini adalah *master config* dan **perlu dikonfirmasi** (Technical
    Logic §14).
  - Versi yang sudah dirilis bersifat **immutable**; perubahan nilai
    selalu membuat versi baru. Quotation mengunci versi cost structure
    yang dipakainya.
  - Perubahan yang menurunkan GM standar varian ke bawah 10% hanya dapat
    dirilis dengan wewenang skenario **Deviation** (FR-1.1.3).

- **FR-1.1.3 Penyimpangan per Deal & Skenario Deviation (baru)**

  Nilai cost structure standar dapat disesuaikan **per quotation**
  (mis. karoseri khusus, agency fee proyek, *processing service*
  tambahan) pada jalur manual/opsi manual (FR-2.8) atau saat Head of
  Sales merevisi.
  - Setiap penyesuaian cost line pada quotation mengikuti Maker–Checker–
    Releaser **pemilik scope item tersebut**, sama seperti FR-1.1.2,
    namun berlaku hanya untuk quotation itu (tidak mengubah *price
    book*). *Interpretasi PriceCore atas sheet Actors — perlu
    konfirmasi.*
  - Bila GM quotation (setelah diskon) **< 10%**, quotation masuk
    **skenario Deviation**: selain pemilik scope, **CCO dan CFO**
    (Pricing Committee) berwenang Maker/Checker/Releaser di **semua**
    scope untuk quotation tersebut, dan persetujuan akhirnya ada pada
    mereka (FR-6.1).
  - Diskon **bukan** penyimpangan cost line — diskon ditetapkan Sales
    Operations/Head of Sales dan diatur Module 6.

- **FR-1.2 Formula Engine (Satu Formula untuk Semua Lini Bisnis)**

  Rumus dasar sama untuk seluruh lini bisnis:

  ```
  base_cost          = Σ COGS + Σ Add-Ons                 (dalam IDR, per unit)
  margin_amount      = base_cost × Σ Profitability(%) + Σ Profitability(Rp)
  sales_cost         = Σ Sales
  list_price_ex_vat  = base_cost + margin_amount + sales_cost
  net_price_ex_vat   = list_price_ex_vat − discount
  GM                 = (net_price_ex_vat − sales_cost − base_cost)
                       ÷ (net_price_ex_vat − sales_cost)
  price_incl_vat     = net_price_ex_vat × (1 + tarif PPN)
  ```

  - **GM dihitung setelah diskon dan dari harga *excl. VAT*** — inilah
    dasar tier (Module 6). Kelompok Sales diperlakukan sebagai
    *pass-through* (tidak menambah maupun mengurangi GM), konsisten
    dengan engine v3.0. Definisi ini, dan apakah profit VKTS diperlakukan
    sebagai biaya antar-entitas bagi VKTR, **perlu dikonfirmasi**
    Corporate Finance (Technical Logic §14).
  - Integrasi parameter eksternal: kurs CNY/IDR (FR-1.4), tarif PPN
    (FR-1.6).
  - *Test/simulate* rumus *on-the-fly* sebelum disimpan sebagai master
    config.
  - *Dynamic formula builder* per lini bisnis **ditunda** (tetap sama
    dengan v3.0).

- **FR-1.3 Pricing Template Management**
  - Satu struktur cost item dipakai ulang untuk seluruh varian dan
    transaksi; yang berbeda antar varian adalah **nilai** pada *price
    book* (FR-1.1.2).
  - Alur approval diatur Workflow Template (Module 2), bukan template
    biaya yang berbeda.

- **FR-1.4 Multi-Currency Input & Exchange Rate Master Data (basis CNY/RMB)**

  Tetap seperti v3.0: FOB Price dikutip vendor dalam **CNY**; komponen
  lokal dalam **IDR**. Penyesuaian v4.0 hanya pada titik penguncian kurs,
  karena biaya kini dipelihara di *price book*:

  - **FR-1.4.1 Denominasi per Item** — setiap cost item punya
    denominasi (CNY/IDR). FOB Price in CNY diinput dalam CNY oleh COGS
    Owner; FOB Price in IDR dihitung sistem. *(Opsional, fase
    lanjutan)*: tampilan USD untuk ringkasan ke customer.
  - **FR-1.4.2 Exchange Rate Master Data — Otomatis Mingguan** — kurs
    **CNY→IDR** ditarik otomatis dari API bank rekanan setiap **Senin
    00:01**; Admin dapat *override* manual (`source = manual`).
    Frekuensi adalah master config.
  - **FR-1.4.3 Rate Locking** — kurs dikunci **saat versi cost structure
    dirilis** (FR-1.1.2) dan disalin ke setiap quotation yang
    di-*generate* dari versi tersebut. Harga yang sudah dirilis tidak
    berubah hanya karena kurs bergerak.
  - **FR-1.4.4 Dual Display** — tampilan internal (COGS Owner, Head of
    Sales, approver) menampilkan CNY dan IDR beserta kurs yang dipakai.
  - **FR-1.4.5 Currency Change Guard** — mengubah denominasi item yang
    sudah bernilai memerlukan konfirmasi eksplisit; nilai lama tidak
    dikonversi diam-diam.
  - **FR-1.4.6 Rate Sensitivity Threshold** — bila kurs terbaru bergerak
    melebihi ambang (%) terhadap kurs terkunci:
    - banner tampil pada **versi cost structure aktif** (untuk COGS
      Owner) dan pada **quotation yang belum dirilis**;
    - harga **tidak** dihitung ulang otomatis — COGS Owner membuat versi
      cost structure baru lewat Maker–Checker–Releaser, dan quotation
      terbuka memerlukan aksi **"Hitung Ulang"** eksplisit oleh Sales
      Operations;
    - ambang, jenis kurs (tengah/jual/pajak), dan frekuensi tarik adalah
      master config.

- **FR-1.5 Product Master Data & Dokumen Quotation**

  - **FR-1.5.1 Product Master Data (varian)** — dikelola Product Owner,
    terpisah dari biaya. Hierarki mengikuti istilah Basic Workflow:
    **make → model → type → variant**. Atribut varian minimal (sesuai
    dokumen contoh):

    | Atribut | Contoh |
    |---|---|
    | Make / Model | VKTR Light Duty Truck |
    | Konfigurasi | 4x2 |
    | Wheelbase | Short Wheelbase / Medium Wheelbase |
    | Baterai | 90 kWh (SWB); 90 / 132 / 169 kWh (MWB) |
    | Aplikasi bodi | Dump(er), Aluminium & Steel Box, Load Bak, Compactor, Manhaul, Flat Bed, Refrigerated Box, Tanker, Arm Roll |
    | Build type | CKD / CBU |
    | Titik penyerahan (*loco*) | Magelang |
    | Deskripsi produk (tampil di dokumen) | "VKTR Light Duty Truck 4x2, Short Wheelbase, with Dumper, Battery 90 kWh, CKD, loco Magelang, incl. VAT" |
    | Halaman spesifikasi | brosur fitur, *multi body application*, gambar sasis, tabel spesifikasi (dimensi, baterai, performa, berat, rangka, charging, motor, PTO, axle, suspensi, rem, kabin) |
    | *Default* Inclusions / Exclusions | mis. *Onsite training 2 minggu*, *Online training refreshment 1x*, *On-call technical support* / *Delivery To Site*, *Maintenance*, *Other Requests* (At cost) |

    Status `ACTIVE`/`DISCONTINUED` (soft-disable) agar quotation lama
    tetap merujuk data yang berlaku saat itu.
  - **FR-1.5.2 Quotation Item Linking** — Salesperson memilih varian
    dari Product Master Data (satu atau lebih, FR-2.0 KYC b);
    spesifikasi, deskripsi, dan *default* inclusions/exclusions terbawa
    otomatis ke dokumen.
  - **FR-1.5.3 Format Dokumen Official Quotation (dari contoh riil)**

    Sistem menghasilkan PDF mengikuti **template baku** yang strukturnya
    diambil dari dokumen contoh *Cost Estimate — PT Siborong Nusa
    Gemilang*:

    | Bagian | Isi | Sumber data |
    |---|---|---|
    | Judul | "COST ESTIMATE" pada contoh — judul adalah konfigurasi template | Template |
    | Identitas penerbit | Nama & alamat lengkap PT VKTR Teknologi Mobilitas Tbk., logo | Master config |
    | Nomor | mis. `0001/L/VKTR/RNT-EFS/09-2026` — pola: nomor urut / kode / VKTR / kode skema-kode unit / bulan-tahun | Generator nomor (FR-2.9) |
    | Release Date / Expiry Date | 6 September 2026 / 6 October 2026 (masa berlaku 30 hari) | Tanggal rilis + masa berlaku (FR-2.9) |
    | To | Nama perusahaan & alamat resmi lengkap customer | **KYC a** (FR-7.1) |
    | Disclaimer | Kerahasiaan dokumen, larangan diedarkan tanpa persetujuan tertulis VKTR | Template |
    | Sales/Account Person | Satu atau lebih nama Salesperson | Pengaju + anggota tim akun |
    | Product | Deskripsi varian | Product Master Data |
    | Prepared By | Nama penyusun | Sales Operations Manager yang *generate* |
    | Tabel item | Quantity · Description (skema + deskripsi produk) · harga per unit · total | Line item quotation, skema komersial (FR-1.7) |
    | Inclusions | Daftar layanan yang termasuk | *Default* varian, dapat disesuaikan Sales Operations |
    | Exclusions — At cost | mis. Delivery To Site, Maintenance, Other Requests | *Default* varian + item `may_follow_later` yang tidak dinilai (FR-2.2) |
    | Kontak | Nama, email, telepon Salesperson | Profil pengguna |
    | Total | Total seluruh line item (*incl. VAT* pada contoh) | Kalkulasi |
    | Special Notes or Arrangements | mis. "Delivery time and maintenance service contract details will be discussed", "Cost Estimate is not binding, the actual pricing to be confirmed post assessment" | *Default* template + catatan Head of Sales/Sales Operations |
    | Penerimaan | "To accept this quotation, sign here and return" — Name, Title, Date | Template (FR-2.10) |
    | Halaman Specification | Brosur & tabel spesifikasi varian | Product Master Data |

    - **Detail cost structure tidak pernah tercetak** di dokumen
      pelanggan.
    - Template dapat memiliki variasi tampilan per lini bisnis atau per
      skema (Purchase/Rental), namun **sumber datanya sama**.
    - Belum dikonfirmasi: arti setiap segmen nomor dokumen (`L`, `RNT`,
      `EFS`), dan apakah judul Official Quotation memang "Cost Estimate"
      (lihat Technical Logic §14).

  - **FR-1.5.4 Preview & Cetak Quotation (baru)**

    Hasil quotation harus dapat **ditampilkan dan dicetak** dari
    aplikasi dalam format FR-1.5.3:
    - **Preview di layar** — tampilan halaman dokumen persis seperti
      hasil cetak (halaman 1 penawaran + halaman *Specification*),
      tersedia sejak quotation di-*generate* Sales Operations.
    - **Cetak & unduh PDF** — tombol *Print* dan *Download PDF*. Hasil
      cetak berukuran A4 dengan header/logo, nomor halaman, dan
      disclaimer kerahasiaan di setiap halaman.
    - **Watermark status** — quotation yang belum `QUOTATION_RELEASED`
      tercetak dengan watermark **"DRAFT — NOT FOR CUSTOMER"** dan tanpa
      nomor dokumen resmi; hanya versi rilis yang bernomor dan bersih.
    - **Hak akses** — Salesperson dapat mencetak versi rilis untuk
      dikirim ke pelanggan; Sales Operations, Head of Sales, dan approver
      tier dapat melihat preview draft. Authorized Agency tidak dapat
      mencetak Official Quotation (hanya melihat Price Estimate).
    - **Cetak ulang identik** — dokumen versi rilis dibangun dari
      *snapshot* quotation (harga, kurs, PPN, data produk, template versi
      saat rilis), sehingga cetak ulang kapan pun menghasilkan isi yang
      sama; quotation `SUPERSEDED`/`EXPIRED` tetap dapat dicetak dengan
      penanda status.
    - **Lampiran internal terpisah** — Head of Sales dan approver dapat
      mencetak *Cost Structure Sheet* (detail cost structure, bertanda
      *Highly Confidential*) sebagai dokumen terpisah; tidak pernah
      digabung dengan dokumen pelanggan.
    - Setiap aksi cetak/unduh dicatat di audit trail (`PRINT`,
      `DOWNLOAD_PDF`).

    > **Status aplikasi saat ini.** POC sudah memiliki tombol *Preview
    > Quotation* dengan cetak lewat browser (Ctrl+P), namun tata letaknya
    > masih format lama (bukan *Cost Estimate*), tanpa halaman
    > spesifikasi, watermark draft, maupun nomor dokumen resmi. Gap ini
    > menjadi pekerjaan Phase 1.

- **FR-1.6 PPN / VAT (baru)**
  - Tarif PPN adalah **master config** berlaku per tanggal (tidak
    *hardcode*), dengan catatan dasar pengenaan pajak bila tarif efektif
    berbeda dari tarif nominal — tarif yang dipakai VKTR **dikonfirmasi
    Corporate Finance**.
  - Price Estimate menampilkan harga per unit **excl. VAT dan incl.
    VAT** (Basic Workflow langkah 3b).
  - Official Quotation menyimpan kedua nilai; dokumen menampilkan sesuai
    template (contoh: *incl. VAT*).
  - **GM, tier, dan guardrail selalu dihitung dari harga excl. VAT.**

- **FR-1.7 Skema Komersial — Purchase vs Rental (baru)**
  - Setiap line item memiliki skema: **Purchase** (harga per unit) atau
    **Rental** (harga sewa per unit per bulan, dengan tenor kontrak dalam
    bulan — contoh: *Rental Scheme, 5-year Contract*,
    Rp 35.309.397/unit/bulan, 40 unit, total Rp 1.412.375.872/bulan).
  - **Formula konversi harga unit → sewa bulanan belum diterima dari
    VKTR** (mis. peran Financing Cost, nilai sisa, tenor, layanan yang
    termasuk). Sampai dikonfirmasi: skema Rental hanya tersedia pada
    jalur **manual** (FR-2.8), nilai sewa bulanan diinput Sales
    Operations dengan label "formula belum dikonfirmasi", dan tier
    margin dievaluasi dari **harga Purchase setara** varian tersebut.
  - Pembulatan: dokumen contoh menunjukkan total dihitung dari nilai
    per unit **sebelum dibulatkan** (35.309.397 × 40 = 1.412.375.880,
    sedangkan total tercetak 1.412.375.872). Aturan pembulatan adalah
    master config.

### Module 2 — Quotation Workflow Engine

*Engine otomatisasi proses untuk memastikan governance, kelengkapan data, dan pelacakan status quotation.*

- **FR-2.0 Basic Workflow VKTR (sheet *Basic Workflow*)**

  VKTR menetapkan **dua workflow dasar**. Keduanya menjadi isi awal
  Workflow Template Catalog (FR-2.0.1).

  **A. Sales To Obtain Price Estimate (per Unit)** — inisiator:
  Salesperson di semua level, **termasuk Authorized Agency**.

  | # | Langkah | Catatan |
  |---|---|---|
  | 1 | Salesperson mengakses aplikasi | Semua level, termasuk agensi resmi |
  | 2 | Memilih *make, model, type, variant* kendaraan | Hanya varian dengan cost structure `RELEASED` |
  | 3 | Menerima informasi di layar: (a) varian kendaraan; (b) estimasi harga per unit *excl.* dan *incl. VAT*; (c) informasi tambahan | Tanpa approval; lihat FR-2.7 |

  **B. Sales To Obtain Official Quotation** — inisiator: Salesperson
  (Sales Executive atau Sales Lead), **hanya sales internal**.

  | # | Langkah | Aktor | Catatan |
  |---|---|---|---|
  | 1 | Mengakses aplikasi | Salesperson | Hanya internal |
  | 2 | Mengisi **formulir KYC** (FR-7.1) | Salesperson | 8 field, 6 wajib |
  | 3 | Meninjau & memverifikasi seluruh data di layar; dapat merevisi sebelum submit | Salesperson | |
  | 4 | Validasi permintaan: (a) diajukan Sales Executive → **Sales Lead** memvalidasi, lalu ke Sales Operations; (b) diajukan Sales Lead → langsung ke Sales Operations | Sales Lead | Langkah 4a otomatis dilewati untuk pengaju Sales Lead |
  | 5 | **Sales Operations *generate* Official Quotation** sesuai *quantity band* (FR-2.8): 1 unit → otomatis, harga dasar; 2–5 unit → otomatis + opsi manual, tingkat diskon dapat diatur; 6–9 unit → otomatis + opsi manual, tingkat diskon dapat diatur; 10+ unit → manual | Sales Operations Manager | |
  | 6 | Official Quotation diteruskan ke **Head of Sales** berisi (a) quotation dan (b) **detail cost structure** (*highly confidential*) | Sistem | |
  | 7 | Head of Sales *accept* atau *revise*, lalu: (a) GM ≥ 15% → **dirilis** ke Salesperson; (b) GM 10–15% → approval **COGS Owner & Profitability Owner** — setuju: dirilis; tolak: kembali ke Sales Operations; (c) GM < 10% → approval **CCO & CFO**, tembusan ke COGS & Profitability Owner — setuju: dirilis; tolak: kembali ke Sales Operations | Head of Sales → approver tier | Module 6 |

  ```
  Salesperson ──► KYC ──► review & submit
                              │
               (Sales Executive)│(Sales Lead: lewati)
                              ▼
                     Sales Lead validates ──tolak──► kembali ke Salesperson
                              │
                              ▼
          Sales Operations generate (quantity band, diskon)
                              │
                              ▼
          Head of Sales (quotation + detail cost structure)
                   accept / revise
                              │
            ┌─────────────────┼──────────────────┐
         GM ≥ 15%        10% ≤ GM < 15%        GM < 10%
            │                 │                   │
            │      COGS Owner + Profitability   CCO + CFO
            │      Owner (keduanya)             (keduanya; cc COGS &
            │                 │                  Profitability Owner)
            │           setuju│tolak          setuju│tolak
            │                 │  └──► Sales Operations ◄──┘
            ▼                 ▼                   ▼
                    QUOTATION RELEASED → Salesperson
                    (PDF format Cost Estimate, FR-1.5.3)
  ```

  - **Salesperson tidak memiliki akses ke cost structure** di tahap
    mana pun (Module 5); ia hanya melihat data KYC, status, dan harga
    jual final yang dirilis kepadanya.
  - **Validasi biaya tidak lagi terjadi per quotation secara berurutan**
    (v3.0: VP Operations → VP Finance). Biaya divalidasi saat cost
    structure varian dirilis (FR-1.1.2); pada quotation, pemilik scope
    hanya terlibat bila ada penyimpangan cost line (FR-1.1.3) atau bila
    GM jatuh ke tier yang memerlukan persetujuan mereka.

- **FR-2.0.1 Workflow Template Catalog & Assignment (direvisi v4.1)**

  > **Dasar (transcribe.md).** *"Ternyata kita menemukan ada 30 variasi
  > workflow ... di asumsi saya ada 30 workflow standar ... baru habis itu
  > kita bisa assign untuk deal tipe apa ke workflow yang mana"* dan
  > *"yang bisa statis justru qualifier-nya"*. Workflow per segmen juga
  > menentukan *"reject ke mana"* dan *"kalau persentase berapa
  > negosiasinya siapa yang approve"*.

  Alur Official Quotation disimpan sebagai **katalog Workflow Template**
  yang terus bertambah (target awal ±30), bukan satu alur:

  - **Qualifier statis** — atribut deal yang dicatat Salesperson saat
    KYC dan dihitung sistem saat submit:

    | Qualifier | Sumber | Contoh nilai (daftar diatur di Settings → Umum) |
    |---|---|---|
    | Segmen customer | KYC (wajib) | B2G, B2B, B2C |
    | Industri / bidang usaha | KYC (wajib) | Pertambangan, Perkebunan, On-road Logistics, Express Logistics, Municipality, Konstruksi, Lainnya |
    | Hubungan pelanggan | KYC (wajib) | Reguler, Relasi khusus |
    | Lini bisnis | Form quotation | B2G/Pemerintah, B2B Commercial Fleet, Charging Infrastructure |
    | Kuantitas | Varian & qty (KYC b) | rentang min–maks |
    | Estimasi nilai | Sistem: harga dasar cost structure RELEASED × qty (excl. VAT) | rentang Rp |
    | Blacklist | Sistem: nama perusahaan dicocokkan ke daftar blacklist | ya / tidak / semua |

  - **Setiap template** memiliki: nama, deskripsi, qualifier (kosong =
    semua), prioritas, langkah approval (pelaksana, kondisi lewati,
    tujuan tolak, SLA), dan **opsional tier margin sendiri** (wewenang
    diskon per template; tanpa itu memakai tier global).
  - **Pemilihan otomatis saat submit** — template aktif yang **seluruh**
    qualifier-nya cocok; bila lebih dari satu: **prioritas tertinggi**,
    lalu **paling spesifik** (jumlah qualifier), lalu versi terbaru.
    Tidak ada yang cocok → **template dasar** (fallback). Pengaju tidak
    memilih alur sendiri. Template terpilih dan alasannya tercatat di
    quotation dan audit trail.
  - **Versi terkunci** — setiap simpan membuat versi baru; quotation
    yang sedang berjalan memakai langkah dari versi saat ia disubmit.
  - Langkah dapat memiliki **kondisi lewati** berbasis fungsi pengaju,
    langkah *generate* membaca **quantity band** (FR-2.8), dan **routing
    tier margin selalu ditambahkan setelah langkah Review** — template
    dapat memperketat wewenang (tier khusus) tetapi tidak dapat
    menghapus routing margin.

- **FR-2.0.2 Basic Workflow & Katalog Awal Saat Go-Live**

  Dua workflow dasar dari sheet *Basic Workflow*: **Price Estimate**
  (FR-2.0 A, tanpa approval) dan **Official Quotation — Standard**
  (FR-2.0 B, template dasar). Katalog awal berisi lima template contoh
  yang mewakili setiap sumbu qualifier dari demo review — titik awal,
  bukan daftar final; VKTR menambah sisanya lewat Settings:

| Template (kode) | Qualifier | Prioritas | Langkah setelah KYC | Tier margin |
|---|---|---|---|---|
| Official Quotation — Standard (`OQ-STANDARD`) | — (dasar/fallback) | 0 | Validasi Sales Lead* → Generate → Review & Rilis | Global |
| Official Quotation — Customer Blacklist (`OQ-BLACKLIST`) | Customer di blacklist | 100 | Validasi Sales Lead → **Persetujuan Pricing Committee** → Generate → Review | Khusus: semua tier diputus CCO + CFO |
| Official Quotation — Relasi Khusus (`OQ-RELASI-KHUSUS`) | Hubungan = Relasi khusus | 20 | Generate → Review (tanpa validasi Sales Lead) | Khusus: GM < 15% langsung CCO + CFO |
| Official Quotation — Nilai Besar (`OQ-NILAI-BESAR`) | Estimasi nilai ≥ Rp 50 M | 15 | Validasi* → **Persetujuan kelayakan deal (Pricing Committee)** → Generate → Review | Global |
| Official Quotation — B2G Pemerintah (`OQ-B2G`) | Segmen = B2G | 10 | Validasi* → **Verifikasi dokumen tender (Head of Sales)** → Generate → Review (SLA 48 jam) | Khusus: setiap tier sampai CCO + CFO |
| Official Quotation — Industri Tambang & Perkebunan (`OQ-INDUSTRI-BERAT`) | Industri = Pertambangan / Perkebunan | 5 | Validasi* → Generate → **Review aplikasi & karoseri (COGS Owner)** → Review | Global |

\* dilewati bila pengaju Sales Lead.

- **FR-2.1 No-Code Workflow Configurator (Settings → Workflow)**
  - **Daftar workflow** (`/settings?tab=workflow`): tabel bernomor seluruh
    template (qualifier, jumlah langkah, prioritas, tier, status) dengan
    tombol **Tambah workflow**; klik baris membuka halaman detail.
  - **Halaman detail** (`/settings/workflow/[kode]`): kapan dipakai
    (qualifier), tier margin yang berlaku (khusus atau global), alur
    langkah lengkap (KYC → langkah template → tier), riwayat versi, dan
    quotation yang memakainya; tombol **Ubah**, **Duplikat**,
    **Aktifkan/Nonaktifkan** (template dasar tidak dapat dinonaktifkan).
  - **Editor template** (`/settings/workflow/new`, `…/[kode]/edit`): qualifier (pilihan dari daftar statis, rentang
    qty & nilai, blacklist), prioritas, dan langkah — nama, jenis aksi
    (validasi / persetujuan tambahan / generate / review & rute), fungsi
    pelaksana (FR-5.6), kondisi lewati, tujuan bila ditolak, SLA.
  - **Uji pemilihan template**: masukkan atribut deal → tampil template
    yang akan terpilih beserta alasan, dan template mana yang tidak
    cocok serta sebabnya.
  - **Tier margin per template** (Settings → Tier Margin → pilih
    template): buat tier khusus (salinan global) atau kembali ke global.
  - Validasi saat simpan: tepat satu langkah Generate dan satu Review
    (Review terakhir); tujuan tolak harus langkah sebelumnya; setiap
    pelaksana dimiliki minimal satu user aktif; template non-dasar wajib
    memiliki minimal satu qualifier.
  - Setiap perubahan membuat **versi baru** dan tercatat di audit trail.
  - Daftar nilai qualifier (segmen, industri, relasi) dan blacklist
    customer diatur di **Settings → Umum & Dokumen**.

- **FR-2.2 Strict Gatekeeping & Release Gate**
  - Quotation hanya dapat di-*generate* dari varian dengan cost
    structure versi `RELEASED` di keempat scope.
  - Quotation tidak dapat disubmit sebelum **seluruh field KYC wajib**
    terisi (FR-7.3).
  - **Release gate**: `QUOTATION_RELEASED` mustahil tercapai bila:
    1. ada item mandatory tanpa nilai;
    2. ada item `may_follow_later` (Delivery Service) yang **tidak
       bernilai dan tidak dinyatakan sebagai *Exclusion — At cost***;
    3. ada penyimpangan cost line (FR-1.1.3) yang belum dirilis pemilik
       scope-nya;
    4. persetujuan tier margin (Module 6) belum lengkap (AND-join);
    5. quotation sudah melewati masa berlaku data harga (kurs melewati
       ambang tanpa "Hitung Ulang", FR-1.4.6).
  - Item yang dinyatakan *Exclusion — At cost* otomatis tercetak di
    bagian **Exclusions** dokumen, sehingga tidak ada biaya yang hilang
    tanpa disadari pelanggan maupun VKTR.

- **FR-2.3 Rejection & Routing Logic**
  - **Sales Lead menolak** → quotation kembali ke Salesperson (status
    Draft) dengan catatan; data KYC tidak dihapus.
  - **Head of Sales *revise*** → Head of Sales dapat mengubah diskon dan
    scope Sales, atau mengembalikan ke Sales Operations dengan catatan.
  - **Approver tier (COGS & Profitability Owner, atau CCO & CFO)
    menolak** → quotation **kembali ke Sales Operations** (langkah 5),
    bukan dibatalkan; Sales Operations menyusun ulang lalu alur berjalan
    lagi dari langkah 6.
  - **Approve with Conditions** tetap tersedia; catatan terbawa ke
    dokumen (*Special Notes*) bila ditandai untuk pelanggan.

- **FR-2.4 Dynamic Form Adjustment**
  - Penyesuaian cost line pada quotation diarahkan ke Maker–Checker–
    Releaser **pemilik scope item tersebut** (FR-1.1.3).
  - Penambahan cost item baru ke master memicu versi cost structure baru
    yang harus dirilis ulang di scope terkait sebelum dipakai quotation
    baru; quotation yang sudah berjalan tetap memakai versi lamanya.

- **FR-2.5 Project/Customer Identifier & Quotation Versioning**

  Tetap seperti v3.0, dengan kaitan langsung ke KYC:
  - Setiap Official Quotation **wajib** terkait satu **Project
    Identifier** yang di-*generate* sistem dari nama customer + nama
    proyek/lokasi.
  - **KYC item c** menentukan kaitannya: **Proyek baru** → identifier
    baru; **Tambahan untuk proyek berjalan** atau **Penggantian
    (*replacement*)** → Salesperson memilih identifier yang sudah ada.
  - Revisi (qty berubah, harga dinegosiasi ulang, kedaluwarsa)
    **menghasilkan quotation baru** yang ter-*link* ke identifier yang
    sama — bukan edit in-place. Quotation lama otomatis `SUPERSEDED`
    ketika penggantinya dirilis.
  - Revisi yang **mengubah data KYC** (termasuk varian/qty) melewati
    validasi Sales Lead lagi; revisi **harga/diskon saja** mulai dari
    langkah Sales Operations.
  - Dashboard menampilkan seluruh quotation satu identifier sebagai satu
    linimasa.

- **FR-2.6 Duplicate/Fraud Guard — Batas Quotation Harian**

  Tetap seperti v3.0: satu Salesperson maksimal **satu Official
  Quotation baru per hari** untuk kombinasi **customer + varian** yang
  sama (master config). Percobaan berlebih ditolak di *service layer*
  dan tercatat sebagai `BLOCKED_DUPLICATE_ATTEMPT`. Revisi via FR-2.5
  dikecualikan. **Price Estimate tidak dibatasi** namun setiap
  permintaan tercatat (FR-2.7).

- **FR-2.7 Price Estimate Self-Service (baru)**
  - Tersedia untuk Sales Executive, Sales Lead, dan **Authorized
    Agency**.
  - Pengguna memilih varian; sistem menampilkan **harga dasar per unit
    (1 unit, tanpa diskon) excl. dan incl. VAT**, deskripsi varian, dan
    informasi tambahan (spesifikasi ringkas, *default* inclusions/
    exclusions, catatan "estimasi tidak mengikat").
  - Hanya varian dengan cost structure `RELEASED` yang tampil; tidak ada
    approval; **tidak ada elemen cost structure yang ditampilkan**.
  - Setiap estimasi dicatat (pengguna, varian, harga, versi cost
    structure, waktu) untuk analitik permintaan dan audit.
  - Price Estimate **bukan** dokumen penawaran; tidak bernomor dan tidak
    dapat dikirim sebagai quotation resmi.

- **FR-2.8 Quantity Band Processing (baru)**

  | Band | Kuantitas | Mode *generate* | Diskon |
  |---|---|---|---|
  | 1 | 1 unit | **Otomatis**, harga dasar | Tidak ada |
  | 2 | 2–5 unit | **Otomatis + opsi manual** | Tingkat diskon *default* band, dapat diatur & diperbarui Sales Operations |
  | 3 | 6–9 unit | **Otomatis + opsi manual** | Tingkat diskon *default* band, dapat diatur & diperbarui Sales Operations |
  | 4 | ≥ 10 unit | **Manual** oleh Sales Operations | Ditetapkan per deal |

  - Batas band dan tingkat diskon *default* adalah **master config**,
    dikelola Sales Pricing Owner lewat Maker–Checker–Releaser.
  - Band 1: quotation di-*generate* dan diteruskan otomatis ke Head of
    Sales. Band 2–3: quotation di-*generate* otomatis lalu menunggu
    konfirmasi/penyesuaian Sales Operations. Band 4: Sales Operations
    menyusun quotation (diskon, skema, inclusions/exclusions,
    penyimpangan cost line) sebelum meneruskan.
  - Untuk quotation multi-varian: band ditentukan **per line item**
    (kuantitas varian tersebut); bila ada satu line item di band 4,
    seluruh quotation diproses manual. *Aturan ini perlu konfirmasi
    VKTR.*

- **FR-2.9 Masa Berlaku, Penomoran & Kedaluwarsa (baru)**
  - Nomor dokumen di-*generate* saat rilis mengikuti pola master config
    (contoh: `0001/L/VKTR/RNT-EFS/09-2026`).
  - `valid_until` = tanggal rilis + masa berlaku (*default* 30 hari,
    sesuai contoh 6 Sep → 6 Okt 2026), master config.
  - Quotation yang melewati `valid_until` tanpa diterima berubah status
    menjadi **`EXPIRED`**; perpanjangan dilakukan dengan revisi (FR-2.5)
    agar harga dihitung ulang dari cost structure & kurs terbaru.

- **FR-2.10 Penerimaan Pelanggan (baru)**
  - Dokumen memuat blok tanda tangan penerimaan (Name, Title, Date).
  - Salesperson mengunggah salinan yang ditandatangani pelanggan →
    quotation berstatus diterima (`outcome = WON`), menjadi data Win/Loss
    Analytics (FR-4.3). Penolakan pelanggan dicatat sebagai `LOST`
    beserta alasan.
  - E-signature *Out of Scope* (§8).

### Module 3 — State Tracking & Observability Dashboard

*Sistem pelacakan transparan untuk visibilitas posisi penawaran harga.*

- **FR-3.1 Quotation Lifecycle Tracker (Kanban & Table View)**
  - Status Official Quotation: *Draft (KYC)*, *Pending Sales Lead
    Validation*, *Pending Sales Operations*, *Pending Head of Sales
    Review*, *Pending Owner Approval (GM 10–15%)*, *Pending Pricing
    Committee Approval (GM < 10%)*, *Quotation Released*, *Expired*,
    *Superseded*.
  - Status cost structure per varian: per scope *Draft → Checked →
    Released*, sehingga COGS Owner, Profitability Owner, dan Sales
    Pricing Owner melihat antrean masing-masing.
  - Pengelompokan per **Project Identifier**; filter berdasarkan status,
    varian, quantity band, tier margin, tanggal, dan nilai transaksi.
- **FR-3.2 SLA Timer & Automated Escalation**
  - Indikator durasi di setiap tahapan (termasuk Maker–Checker–Releaser
    cost structure). Notifikasi (Email, MS Teams, atau WhatsApp API) bila
    tertahan melebihi SLA (mis. > 24 jam). Tembusan (cc) tier GM < 10%
    ke COGS & Profitability Owner dikirim lewat kanal yang sama.
- **FR-3.3 Immutable Audit Trail**
  - Pencatatan riwayat perubahan (*who, what, when, why*): Maker,
    Checker, Releaser tiap perubahan cost structure; siapa mengubah
    diskon; siapa menyetujui tier. Log *append-only*.

### Module 4 — Decision Support System (DSS) & Simulation Engine

- **FR-4.1 "What-If" Sensitivity Simulator**
  - *Slider control*: fluktuasi kurs CNY/IDR, perubahan harga FOB/material
    impor, dan diskon volume terhadap margin.
  - Output instan: *Gross Margin*, *EBITDA Contribution*, *Break-Even
    Point*, serta **tier margin** yang akan berlaku.
- **FR-4.2 Intelligent Margin Guardrails & Anomaly Detection**
  - Peringatan bila kombinasi biaya/diskon menurunkan GM di bawah 15%
    (butuh approval Owner) atau 10% (butuh Pricing Committee).
  - Deteksi lonjakan biaya tak wajar dibanding versi cost structure
    sebelumnya dan historis deal sejenis (*Cost Outlier Alert*).
- **FR-4.3 Win/Loss Pricing Analytics**
  - Analisis harga historis yang diterima vs ditolak (FR-2.10) untuk
    rekomendasi *Optimal Price Band*; *Likelihood* KYC (FR-7.1)
    dibandingkan dengan hasil aktual.

### Module 5 — Auth, User Management & Enterprise Integration

- **FR-5.1 Authentication & User Management** — Login, validasi akun, manajemen pengguna (CRUD), *activity log*. Termasuk **akun eksternal Authorized Agency** dengan masa berlaku dan pemutusan akses terkendali.
- **FR-5.2 RBAC/ABAC Permission Engine** — Hak akses granular berbasis peran, **scope cost structure**, dan wewenang Maker/Checker/Releaser per skenario (Regular/Deviation). Salesperson & Authorized Agency tidak dapat membaca cost structure apa pun.
- **FR-5.3 API-First ERP Integration** (SAP/Odoo) — Sinkronisasi data *costing* dua arah; *fallback* dump data per tabel bila API tidak tersedia.
- **FR-5.4 CRM Integration** (Salesforce/HubSpot) — Penarikan data pra-penjualan dan push quotation yang dirilis kembali ke CRM.
- **FR-5.5 Notification Integration** — Email, MS Teams webhook, WhatsApp API.
- **FR-5.6 Role & Authority Settings (baru)**

  Isi sheet *Actors* dikelola sebagai data lewat menu **Settings →
  Roles & Authorities**, bukan daftar role *hardcode*:
  - **Role** — Admin dapat menambah, mengubah nama, dan menonaktifkan
    role (mis. Sales Executive, Sales Lead, Sales Operations Manager,
    Head of Sales, Procurement Manager, Head of Procurement and
    Operations Control, Head of Corporate Finance, CCO, CFO, Authorized
    Agency, Product Owner). Role dikelompokkan ke **peran fungsional**
    (Salesperson, COGS Owner, Profitability Owner, Sales Pricing Owner,
    Pricing Committee) yang dirujuk workflow dan tier.
  - **Pemetaan user → role** — satu user dapat memegang lebih dari satu
    role; akun Authorized Agency ditandai eksternal.
  - **Matriks Scope Authority** — grid role × scope (COGS, Add-Ons,
    Margin, Sales) × skenario (Regular / Deviation) dengan centang
    **Maker / Checker / Releaser**, persis bentuk sheet *Actors*.
    Ambang pemisah skenario (default 10%) juga dapat diubah.
  - **Aturan pemisahan tugas** — pilihan "Maker ≠ Checker", "Checker ≠
    Releaser" per scope (FR-1.1.2).
  - **Hak akses layar** — siapa dapat melihat cost structure, Price
    Estimate, preview/cetak quotation, dan Settings.
  - **Import/Export** matriks dalam format Excel yang sama dengan sheet
    *Actors*, agar VKTR dapat meninjau di spreadsheet lalu mengunggah
    kembali (dengan preview perubahan sebelum diterapkan).
  - Perubahan berlaku untuk aksi berikutnya, tercatat di audit trail,
    dan tidak mengubah jejak persetujuan yang sudah terjadi.

  > **Status aplikasi saat ini.** Role POC masih berupa daftar tetap
  > di kode (7 role v3.0: Sales Officer, Chief Sales, VP Finance, VP
  > Operations, Product Owner, BOD, System Admin) tanpa UI pengaturan.
  > Migrasi ke role sheet *Actors* sekaligus membuatnya dapat diatur
  > adalah pekerjaan Phase 1.

- **FR-5.7 Menu & Data Access per Role — sembunyikan & 404 (baru)**

  Prinsip: **setiap role hanya melihat menu yang ia gunakan**. Menu di
  luar matriks tidak tampil di sidebar, dan halamannya — termasuk bila
  dibuka langsung lewat URL, link lama, atau bookmark — menjawab
  **404 Not Found** (bukan pesan "tidak berwenang"), sehingga keberadaan
  halaman pun tidak terungkap. Aksi server di belakangnya ikut menolak.

  Matriks default per role (sheet *Actors* + *Basic Workflow*):

| Menu | Authorized Agency | Sales Executive | Sales Lead | Sales Ops Mgr | Head of Sales | Procurement Mgr | Head of Proc & Ops Control | Head of Corp Finance | CCO | CFO | Product Owner | System Admin |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Overview (antrean "menunggu tindakan Anda") | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ |
| Price Estimate | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | – | – | – | – | ✓ |
| Official Quotation | – | ✓ ¹ | ✓ ² | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ |
| Lifecycle & Approvals | – | – | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ |
| Cost Structure (M/C/R) | – | – | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ |
| Decision Support (DSS) | – | – | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ |
| Master Data & Kurs | – | – | – | – | – | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ |
| Product Master Data | – | – | – | – | – | – | – | – | – | – | ✓ | ✓ |
| Audit Trail | – | – | – | – | ✓ | – | – | – | ✓ | ✓ | – | ✓ |
| Settings | – | – | – | – | – | – | – | – | – | – | – | ✓ (terkunci) |
| **Halaman awal setelah login** | Price Estimate | Overview | Overview | Overview | Overview | Overview | Overview | Overview | Overview | Overview | Product Master Data | Overview |

¹ Hanya quotation yang ia ajukan / ia menjadi Sales/Account Person.
² Quotation miliknya + permintaan Sales Executive yang ia validasi (POC belum mengenal struktur tim, sehingga semua permintaan Sales Executive).

  - **Dasar matriks adalah fungsi, bukan nama role.** Matriks disimpan
    sebagai *menu → fungsi* (lihat Technical Logic §8.4); role mewarisi
    menu dari fungsi yang dicentang di Settings → Roles. Role baru
    (mis. *Corporate Finance Manager* dengan fungsi Profitability Owner)
    otomatis mendapat menu Profitability Owner.
  - **Dapat diatur** di **Settings → Akses Menu** (grid menu × fungsi).
    Menu **Settings** terkunci untuk System Admin agar admin tidak
    mengunci dirinya sendiri.
  - **Halaman awal** setelah login = menu pertama yang diizinkan
    (Authorized Agency → Price Estimate, Product Owner → Product Master
    Data). Role tanpa menu apa pun mendapat halaman "belum memiliki
    akses".
  - **Pembatasan per baris (data scope)** untuk Official Quotation:
    Salesperson hanya melihat quotation yang ia ajukan atau ia menjadi
    Sales/Account Person; Sales Lead menambah permintaan Sales Executive
    yang ia validasi; peran penentu harga & approver (Sales Operations,
    Head of Sales, COGS/Profitability Owner, Pricing Committee, Admin)
    melihat semua. Quotation di luar cakupan tidak muncul di daftar,
    Overview, maupun Kanban, dan detail/dokumennya menjawab 404.
  - **Dokumen**: Cost Estimate mengikuti hak lihat quotation (Salesperson
    hanya setelah rilis); Cost Structure Sheet mengikuti menu Cost
    Structure.
  - Akses Price Estimate tidak lagi diatur terpisah di Workflow — satu
    sumber kebijakan, yaitu matriks menu ini.

### Module 6 — Discount & Margin-Tier Approval

*Mendigitalkan penetapan diskon dan hierarki wewenang berbasis margin sesuai langkah 5–7 Basic Workflow Official Quotation.*

> **Revisi v4.0.** Tier dikoreksi menjadi **15% / 10%** dan approver
> diganti sesuai sheet *Basic Workflow* langkah 7. Persetujuan tier kini
> **bagian dari jalur rilis quotation**, bukan state machine negosiasi
> terpisah pasca-rilis seperti v3.0. Opsi *BOD delegation* dicabut.

- **FR-6.0 Penetapan Diskon**
  - Diskon ditetapkan **Sales Operations** pada langkah 5: *default*
    per quantity band (FR-2.8), dapat diubah pada band 2–4.
  - **Head of Sales** dapat merevisi diskon pada langkah 7 sebelum
    merilis/meneruskan.
  - Salesperson **tidak** menetapkan diskon; permintaan diskon pelanggan
    disampaikan Salesperson sebagai catatan/permintaan revisi (FR-6.3).

- **FR-6.1 Margin Tier Authority Matrix (Configurable)**

  | Tier | GM akhir (setelah diskon, excl. VAT) | Keputusan | Bila ditolak |
  |---|---|---|---|
  | **1** | ≥ 15% | **Head of Sales** merilis | — |
  | **2** | 10% – < 15% | **COGS Owner dan Profitability Owner** — keduanya wajib menyetujui | Kembali ke Sales Operations |
  | **3** | < 10% (skenario Deviation) | **CCO dan CFO** — keduanya wajib menyetujui; **tembusan** ke COGS Owner & Profitability Owner | Kembali ke Sales Operations |

  - Ambang tier adalah **master config** dan dapat di-*scope* per lini
    bisnis; nilai 15%/10% berasal dari sheet *Basic Workflow* dan
    sejalan dengan batas skenario Regular/Deviation di sheet *Actors*.
  - Pada Tier 2, "COGS Owner" terpenuhi oleh persetujuan **salah satu**
    pemegang peran COGS Owner (Procurement Manager atau Head of
    Procurement and Operations Control). Aturan ini perlu konfirmasi.
  - Tembusan Tier 3 bersifat **informasi**, bukan persetujuan.
  - Head of Sales tetap harus *accept* terlebih dahulu pada Tier 2/3
    sebelum quotation diteruskan ke approver tier.

- **FR-6.1.1 Dual-Mode Discount Input (Rupiah / Persentase)**
  - Sales Operations dan Head of Sales dapat memasukkan diskon dalam
    **Rupiah** atau **persentase**; keduanya terkonversi otomatis
    terhadap harga excl. VAT sebelum diskon, dan mode asli tercatat.
  - Tampilan approval menampilkan kedua representasi.

- **FR-6.2 Automatic Tier Routing**
  - Sistem menghitung GM akhir dan menentukan tier secara otomatis —
    tidak ada pihak yang memilih approver sendiri.
  - Tier 2 & 3 adalah **AND-join**: satu persetujuan tidak cukup.
  - **Tier per Workflow Template (v4.1)**: template dapat memiliki tangga
    tier sendiri (mis. B2G — setiap tier sampai CCO & CFO; Relasi Khusus
    — GM < 15% langsung CCO & CFO). Tanpa tangga khusus, berlaku tier
    global. Status persetujuan mengikuti siapa pemutusnya (Owner atau
    Pricing Committee), bukan nomor tier.
  - Perubahan diskon atau cost line setelah routing **membatalkan
    persetujuan yang sudah ada** dan memicu evaluasi tier ulang.

- **FR-6.3 Negosiasi Setelah Rilis**
  - Permintaan pelanggan setelah quotation dirilis (diskon tambahan,
    qty berubah, skema berubah) dicatat Salesperson sebagai **permintaan
    revisi** pada Project Identifier.
  - Sistem membuat **quotation revisi** (FR-2.5) yang mengulang langkah
    5–7 (atau 4–7 bila data KYC berubah). Tier dihitung ulang dari GM
    baru — dapat naik maupun turun tier.
  - Quotation asal tetap berlaku sampai revisinya dirilis, lalu menjadi
    `SUPERSEDED`.

- **FR-6.4 Real-Time Margin Impact Visibility**
  - Saat diskon diinput (Rupiah maupun %), Sales Operations dan Head of
    Sales langsung melihat harga akhir, **GM akhir**, dan **tier yang
    akan berlaku** sebelum meneruskan.
  - Approver Tier 2/3 melihat peringatan eksplisit (tier & GM) sebelum
    tombol Approve dapat ditekan.

- **FR-6.5 Discount & Approval Audit Trail**
  - Seluruh perubahan diskon (Rupiah & % setara), tier yang dihitung,
    persetujuan/penolakan, dan tembusan tercatat *append-only* dan
    tertaut ke quotation serta Project Identifier.

### Module 7 — Customer Qualification (KYC)

*Langkah 2 Basic Workflow Official Quotation.*

> **Revisi v4.0 — masuk scope.** Sheet *Basic Workflow* menempatkan KYC
> sebagai langkah wajib sebelum permintaan Official Quotation dapat
> disubmit. Module 7 tidak lagi *Out of Scope*.

- **FR-7.1 Formulir KYC**

  | # | Field | Wajib | Keterangan |
  |---|---|---|---|
  | a | Nama perusahaan & alamat resmi lengkap | **Ya** | Tercetak di blok *To* dokumen |
  | b | *Make, model, type, variant* dan kuantitas kendaraan | **Ya** | **Boleh lebih dari satu** — menjadi line item quotation |
  | c | Jenis proyek: proyek baru / tambahan untuk proyek berjalan / penggantian | Tidak | Menentukan kaitan Project Identifier (FR-2.5) |
  | d | Aplikasi (bodi) dan utilisasi (muatan) | **Ya** | mis. Dumper — muatan tanah/pasir |
  | e | Rute, asal–tujuan, dan produksi (per trip / siklus / hari / bulan / lainnya) | **Ya** | Nilai produksi + satuan + periode |
  | f | *Likelihood* | **Ya** | Skala 5: High (5), Medium to High (4), Medium (3), Medium to Low (2), Low (1) |
  | g | *Gap identified* | **Ya** | Kesenjangan kebutuhan pelanggan yang teridentifikasi |
  | h | Informasi lain | Tidak | Termasuk skema yang diminta (Purchase/Rental) & metode pembayaran bila diketahui |
| — | **Kualifikasi deal**: segmen customer, industri/bidang usaha, hubungan pelanggan (v4.1) | **Ya** | Menentukan Workflow Template (FR-2.0.1); daftar pilihan diatur di Settings |

- **FR-7.2 Review & Verifikasi** — Salesperson meninjau seluruh data di
  layar dan dapat merevisi sebelum submit (langkah 3).
- **FR-7.3 Qualification Gate** — Submit ditolak bila field wajib belum
  lengkap. **Tidak ada validasi pihak ketiga** (sesuai demo review);
  validasi bisnis dilakukan Sales Lead (langkah 4).
- **FR-7.4 Penggunaan Ulang** — data KYC tersimpan per customer dan
  dapat dipakai ulang untuk quotation berikutnya; perubahan tercatat di
  audit trail.

### Module 8 — Mineral Index Adjustment (HMA → IDR via Kurs)

*Referensi harga mineral resmi pemerintah; dampaknya ke harga VKTR berjalan melalui kurs CNY/IDR.*

Tidak berubah dari v3.0. Ringkasnya:

- **FR-8.1 HMA Master Data** — HMA per mineral (US$/dmt), periode
  berlaku, referensi Kepmen; riwayat tidak ditimpa.
- **FR-8.2 HPM Calculator (Kepmen ESDM No. 144.K/2026)**

  ```
  CF(Ni)        = 0,30 + ((kadar_Ni − 0,016) × 10)
  Nilai Ni      = kadar_Ni × CF(Ni) × HMA_Ni
  Bonus Co      = kadar_Co × CF(Co) × HMA_Co
  Total kering  = Nilai Ni + Bonus Co            [US$/dmt]
  HPM (basah)   = Total kering × (1 − Moisture Content)   [US$/WMT]
  ```

  Parameter adalah master config.
- **FR-8.3 Global Adjustment** — *dicabut*, digantikan FR-1.4.6; spesifikasi
  cadangan tetap di Technical Logic §13.2.
- **FR-8.4 Transparansi** — HMA/HPM tampil sebagai konteks pada halaman
  cost structure (COGS Owner) dan quotation (approver).
- **FR-8.5 Stale Index Warning** — tandai bila HMA > 14 hari.

---

## 4. High-Level Data & Process Flow

### 4.1 Empat Lapisan Proses

| Lapisan | Deskripsi | Aktor | Diatur oleh |
|---|---|---|---|
| **0. Cost Structure (per varian)** | Nilai COGS, Add-Ons, Margin, Sales per varian dipelihara & dirilis lewat Maker–Checker–Releaser; kurs dikunci saat rilis | COGS Owner, Profitability Owner, Sales Pricing Owner (+ Pricing Committee pada Deviation) | Matriks wewenang scope (FR-1.1.2) |
| **A. Price Estimate** | Harga dasar per unit excl./incl. VAT, seketika | Salesperson, Authorized Agency | Workflow Template "Price Estimate" |
| **B. Official Quotation — permintaan & penyusunan** | KYC → validasi Sales Lead → *generate* Sales Operations (quantity band, diskon, penyimpangan) → review Head of Sales | Salesperson, Sales Lead, Sales Operations, Head of Sales | Workflow Template "Official Quotation" (FR-2.0.1) |
| **C. Official Quotation — routing margin & rilis** | Tier dari GM akhir → rilis / approval Owner / approval Pricing Committee → Release Gate → dokumen | Head of Sales, COGS & Profitability Owner, CCO & CFO | Matriks tier margin (Module 6) — **tidak** dapat diubah template |

Negosiasi setelah rilis tidak membuka mesin persetujuan baru; ia
menghasilkan **quotation revisi** yang kembali melewati lapisan B–C.

```
[ Product Master Data (varian) ]──┐
[ Exchange Rate CNY→IDR (mingguan) ]─┤
                                  ▼
        [ Cost Structure per varian — Maker → Checker → Releaser ]
          COGS & Add-Ons: COGS Owner · Margin: Profitability Owner
          Sales: Sales Pricing Owner · (Deviation: + CCO/CFO)
                                  │  RELEASED (kurs & PPN terkunci)
               ┌──────────────────┴──────────────────┐
               ▼                                     ▼
   [ A. Price Estimate ]                 [ B. Official Quotation ]
   Salesperson / Agency                  KYC (Module 7)
   harga/unit excl. & incl. VAT          → Sales Lead validates (SE saja)
   (tanpa approval)                      → Sales Operations generate
                                           (quantity band, diskon,
                                            penyimpangan per deal)
                                         → Head of Sales accept/revise
                                                     │
                                         [ C. Margin-tier routing ]
                                   ≥15% rilis · 10–15% COGS+Profit Owner
                                   · <10% CCO+CFO (cc Owners)
                                                     │  tolak → Sales Ops
                                                     ▼
                                   [ Release Gate ] → QUOTATION RELEASED
                                   PDF "Cost Estimate" (FR-1.5.3)
                                                     │
                          ┌──────────────────────────┼────────────────────┐
                          ▼                          ▼                    ▼
               Pelanggan tanda tangan      Permintaan revisi      Lewat valid_until
               → WON (Win/Loss)            → quotation baru,      → EXPIRED
                                             Project Identifier
                                             sama (FR-2.5)
                                                     │
                                            (Export ke ERP/CRM)
```

---

## 5. Non-Functional Requirements (NFR)

| Kategori | Requirement |
|---|---|
| **Integrasi** | *API-First Architecture*. ERP (SAP/Odoo) untuk sinkronisasi *costing*; CRM (Salesforce/HubSpot) untuk data pra-penjualan. |
| **Menu & Data Access** | Menu di luar matriks role disembunyikan dan halamannya menjawab 404 (FR-5.7); kebijakan yang sama dipakai sidebar, halaman, route API, dan server action. |
| **Security & Access** | RBAC/ABAC berbasis peran, scope, dan skenario. Salesperson & Authorized Agency tidak dapat membaca cost structure; detail cost structure hanya untuk Sales Operations, Head of Sales, pemilik scope, dan Pricing Committee. Wewenang ditegakkan di *service layer*. |
| **Segregation of Duties** | Maker, Checker, Releaser dicatat terpisah; aturan orang berbeda ditegakkan server sesuai master config. |
| **Kerahasiaan Dokumen** | Dokumen pelanggan tidak pernah memuat cost structure; watermark/disclaimer kerahasiaan sesuai template. |
| **Versioning** | Cost structure per varian berversi & immutable setelah rilis; quotation revisi sebagai entitas baru pada Project Identifier. |
| **Multi-Currency** | Nilai asli input disimpan apa adanya beserta mata uang dan kurs yang dikunci. |
| **Pajak** | Tarif PPN berlaku per tanggal; GM selalu dari harga excl. VAT. |
| **Reproducibility Harga** | Setiap quotation menyimpan versi cost structure, kurs, tarif PPN, dan diskon yang dipakai sehingga harga final selalu dapat direkonstruksi. |
| **UI/UX** | Konsep *modern spreadsheet* untuk pengisi cost structure; formulir KYC ringkas untuk Salesperson; Price Estimate responsif untuk agensi di lapangan. |
| **Auditability** | Log *immutable* (append-only). |
| **Performance** | Price Estimate dan kalkulasi *what-if* < 2 detik. |
| **Availability** | Target uptime 99.5% untuk *production*. |

---

## 6. Implementation Phasing Roadmap

| Fase | Fokus Utama | Target Deliverables |
|---|---|---|
| **Phase 1: Core Governance** | **Settings: Roles & Authorities (FR-5.6) dan Workflow/Quantity Band/Tier (FR-2.1)** yang diisi awal sesuai attachment, Master cost item (4 scope, kepemilikan terkonfirmasi), **Cost Structure per varian + Maker–Checker–Releaser**, Product Master Data (varian), PPN, **Price Estimate**, **KYC**, **Official Quotation workflow langkah 1–7** (validasi Sales Lead, quantity band, review Head of Sales, tier 15%/10%), Release Gate, **Format dokumen Cost Estimate + Preview & Cetak/PDF (FR-1.5.4)**, Project Identifier, SLA Tracking. | Role & workflow VKTR berjalan dari konfigurasi; quotation dapat dicetak dalam format resmi; tidak ada rilis tanpa approval tier. |
| **Phase 2: Revision & Tracking** | Quotation revisi & negosiasi pasca-rilis, Masa berlaku & `EXPIRED`, Penerimaan pelanggan (upload tanda tangan), Workflow Template builder (varian segmen), Duplicate/Fraud Guard, Dashboard observabilitas, Audit Trail, **skema Rental** (setelah formula dikonfirmasi), ERP/CRM integration. | Siklus penuh quotation → penerimaan → revisi terlacak. |
| **Phase 3: DSS & Analytics** | What-If Simulation Engine, Margin Guardrails, AI Outlier Detection, Win/Loss Analytics (dengan *Likelihood* KYC). | Keputusan harga yang lebih cepat dan tepat. |

---

## 7. Module → Feature → Task Breakdown (Reference)

Pembaruan v4.0 ditandai **baru/direvisi**:

| Module | Fitur Utama |
|---|---|
| Auth & User Management | **Matriks Akses Menu per fungsi + 404 + pembatasan data quotation per baris (baru, FR-5.7)**, Login, User Management (CRUD) **+ akun eksternal Authorized Agency (baru)**, RBAC/ABAC **per scope & skenario (direvisi)**, **Settings Roles & Authorities: CRUD role, user→role, matriks Scope × M/C/R × skenario, aturan pemisahan tugas, import/export Excel (baru)**, Access Audit Log |
| Settings Workflow | **Editor langkah Basic Workflow (role, aksi, kondisi lewati, tujuan tolak, SLA, cc), editor Quantity Band, editor Tier Margin, versioning konfigurasi (baru)** |
| Master Data | Master Cost Item 4 scope (**kepemilikan terkonfirmasi, STNK/Insurance di Add-Ons — direvisi**), **Cost Structure per Varian + Maker–Checker–Releaser (baru)**, **Scope Authority Matrix Regular/Deviation (baru)**, Product Master Data (**atribut varian, inclusions/exclusions — direvisi**), **Quantity Band Config (baru)**, **PPN Config (baru)**, Margin Tier Authority (**15%/10% — direvisi**), Exchange Rate CNY otomatis + Rate Sensitivity, HMA (referensi) |
| Dynamic Pricing | Formula Engine (**GM setelah diskon, excl. VAT — direvisi**), Multi-Currency (kurs dikunci per versi cost structure), **Multi-line item (baru)**, **Skema Purchase/Rental (baru)**, Project Identifier, Export PDF |
| Price Estimate | **Pilih varian, harga excl./incl. VAT, log estimasi (baru)** |
| Customer Qualification (KYC) | **Formulir KYC 8 field, review, qualification gate, penggunaan ulang (baru — sebelumnya Out of Scope)** |
| Official Quotation Workflow | **Workflow Template Catalog multi-template: qualifier statis, prioritas, editor, duplikat, aktif/nonaktif, uji pemilihan, tier per template (v4.1)**, Workflow Template Catalog (**step dengan kondisi lewati — direvisi**), **Validasi Sales Lead (baru)**, **Generate Sales Operations per quantity band (baru)**, **Review Head of Sales + detail cost structure (baru)**, Release Gate (**termasuk Exclusion — At cost — direvisi**), Rejection → Sales Operations (**direvisi**), Duplicate/Fraud Guard, **Masa berlaku & penomoran (baru)**, **Penerimaan pelanggan (baru)** |
| Discount & Margin-Tier Approval | Penetapan diskon Sales Operations/Head of Sales (Rp/%), **Tier routing 15%/10% (direvisi)**, **Approval COGS+Profitability Owner / CCO+CFO + tembusan (direvisi)**, Margin impact, **Negosiasi pasca-rilis via revisi (direvisi)** |
| Document Output | **Template "Cost Estimate": nomor, rilis/kedaluwarsa, To, Sales/Account Person, Prepared By, tabel item, Inclusions/Exclusions, Special Notes, blok penerimaan, halaman spesifikasi (direvisi dari placeholder)**, **Preview di layar, Print, Download PDF, watermark DRAFT, cetak ulang identik dari snapshot, Cost Structure Sheet internal terpisah (baru)** |
| State Tracking & Observability | Kanban+Table per Project Identifier (**status baru**), **antrean Maker–Checker–Releaser (baru)**, SLA Timer & notifikasi, Immutable Audit Trail |
| DSS & Simulation | What-If Simulator (**+ tier yang berlaku**), Margin Guardrails 15%/10%, Win/Loss Analytics |
| Mineral Index | HMA (referensi), HPM Calculator, Stale Index Warning |
| Integrasi Eksternal | ERP, CRM, Notifikasi MS Teams |

---

## 8. Out of Scope (Asumsi Fase Awal)

- Payment processing / invoicing (tetap di ERP).
- Manajemen inventori fisik (read-only dari ERP).
- Aplikasi mobile native (fase awal web responsive — termasuk untuk
  Authorized Agency).
- **Verifikasi KYC oleh pihak ketiga** (mis. cek legalitas/NPWP
  otomatis) — KYC cukup wajib diisi dan divalidasi Sales Lead.
- **E-signature** penerimaan pelanggan — penerimaan lewat unggah
  dokumen bertanda tangan (FR-2.10).
- **Global Adjustment Factor berbasis HPM independen** — tetap dicabut
  (Module 8).
- **Dynamic Formula Builder per lini bisnis** — ditunda.
- **Formula skema Rental otomatis** — menunggu definisi dari VKTR
  (FR-1.7); sampai saat itu Rental hanya pada jalur manual.

---

## 9. Success Metrics

| Metrik | Target |
|---|---|
| Quotation di-*generate* dari cost structure yang belum `RELEASED` penuh | **0 insiden** — dijamin FR-2.2 |
| Perubahan cost structure dirilis tanpa tahap Maker–Checker–Releaser lengkap | **0 insiden** — dijamin FR-1.1.2 |
| Official Quotation disubmit dengan KYC wajib tidak lengkap | **0 insiden** — dijamin FR-7.3 |
| Quotation dirilis dengan GM < 15% tanpa approval tier yang sesuai | **0 insiden** — dijamin FR-6.2 |
| Biaya pengiriman hilang tanpa dinilai atau dinyatakan *At cost* | **0 insiden** — dijamin FR-2.2 |
| *Quotation turnaround time* 1–9 unit (submit → rilis) | Turun ≥ 60% dibanding proses manual |
| *Quotation turnaround time* ≥ 10 unit | Turun ≥ 40% dibanding proses manual |
| Quotation kedaluwarsa yang diterima tanpa revisi | **0 insiden** — dijamin FR-2.9 |
| Kesalahan konversi mata uang / PPN pada quotation | **0 insiden** |
| Quotation ganda untuk customer + varian yang sama dalam sehari | **0 insiden** — FR-2.6 |
| Quotation revisi tidak ter-*link* ke Project Identifier asal | 0 insiden — FR-2.5 |
| Akurasi data biaya vs ERP | Selisih < 1% |
| Perubahan role/wewenang/workflow yang membutuhkan rilis ulang aplikasi | **0** — seluruhnya lewat Settings (FR-5.6, FR-2.1) |
| Halaman di luar matriks menu yang dapat dibuka suatu role (termasuk lewat URL langsung) | **0** — dijawab 404 (FR-5.7) |
| Varian workflow baru yang membutuhkan perubahan kode | **0** — ditambah sebagai template di katalog (FR-2.0.1) |
| Quotation yang alurnya dipilih manual oleh pengaju | **0** — template dipilih sistem dari qualifier |
| Quotation milik Salesperson lain yang terlihat oleh Salesperson | **0 insiden** — FR-5.7 |
| Dokumen pelanggan tercetak memuat cost structure, atau versi draft tercetak tanpa watermark | **0 insiden** — FR-1.5.4 |

---

## 10. Keputusan yang Masih Dibutuhkan dari VKTR

Daftar lengkap dengan konteks teknis ada di Technical Logic §14.
Ringkasan yang memengaruhi PRD:

1. **Formula skema Rental** (FR-1.7) — cara menurunkan sewa bulanan dari
   harga unit, peran Financing Cost, nilai sisa, dan layanan yang
   termasuk; serta cara menghitung GM deal rental.
2. **Definisi GM untuk tier** (FR-1.2) — perlakuan kelompok Sales
   (*pass-through* atau pengurang) dan profit VKTS (biaya antar-entitas
   atau bagian margin).
3. **Pemisahan Maker/Checker/Releaser** (FR-1.1.2) — apakah wajib orang
   berbeda, dan siapa aktor kedua untuk scope Margin.
4. **Tingkat diskon *default*** band 2–5 dan 6–9 (FR-2.8), serta aturan
   band untuk quotation multi-varian.
5. **Tarif PPN** yang dipakai dan dasar pengenaannya (FR-1.6).
6. **Arti segmen nomor dokumen** dan judul dokumen resmi ("Cost
   Estimate" vs "Official Quotation") (FR-1.5.3).
7. **Pemegang peran Product Owner** — tidak ada di sheet *Actors*.
8. **Siapa di antara COGS Owner** yang menyetujui Tier 2 (salah satu
   atau keduanya).
9. **Daftar ±30 Workflow Template** yang dimaksud demo review — beserta
   qualifier, langkah, dan wewenang diskon masing-masing. Katalog awal
   berisi 6 template contoh (FR-2.0.2); sisanya diisi VKTR lewat Settings.
10. **Definisi operasional qualifier** "relasi khusus" (siapa yang
    berhak menandai) dan sumber daftar blacklist (saat ini dikelola
    manual di Settings).

---

## 11. References

- `BTEL - Cost and Roles and Flow.xlsx` — **Sumber otoritatif v4.0**: sheet *Cost Structure* (4 scope), *Actors* (aktor, peran, scope, wewenang Maker/Checker/Releaser skenario Regular & Deviation), *Basic Workflow* (Price Estimate & Official Quotation). Menggantikan `BTEL-CostStructure.xlsx`.
- `Cost Estimate - PT Siborong Nusa Gemilang 20260906 (1).pdf` — **Contoh dokumen keluaran riil v4.0**: format Cost Estimate, skema Rental 5 tahun, *loco Magelang*, inclusions/exclusions, halaman spesifikasi VKTR Light Duty Truck.
- `transcribe.md` — Sumber otoritatif v3.0: transkrip demo review POC v2.1.
- `Commercial Quotation Approval System Requirement for VKTR.pdf` — Sumber otoritatif v2.0.
- `Simulasi_HPM_Nikel_Kepmen_2026.xlsx` — Sumber formula HPM.
- `ConceptDSSpricingVKTR (1).pdf` — Draft PRD v1.0 asli.
- `VKTR-PriceCore_Strategic_Pricing_Architecture.pdf` — Ringkasan Aplikasi/Analitik/Impact per modul.
- `[Timeline & Effort] VKTR - Price Core - Copy of Detail - VKTR.pdf` — Breakdown modul/fitur/task untuk estimasi effort (**perlu diperbarui** untuk modul baru v4.0: Cost Structure M/C/R, Price Estimate, KYC, Document Output).
- `image (2).png` — Diagram ringkas Applications → Analytics/Visualization → Impact.
