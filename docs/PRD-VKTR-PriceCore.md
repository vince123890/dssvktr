# Product Requirement Document (PRD)

## Enterprise Smart Pricing & Decision Support System (VKTR-PriceCore)

| | |
|---|---|
| **Document Version** | 3.0 (Post-Demo Revision — Single Master Data, Workflow Templates, Margin-Based Discount Authority) |
| **Target Entity** | PT VKTR Teknologi Mobilitas Tbk |
| **Domain** | Commercial EV & Mobility Solutions (EV Bus, EV Truck, Battery Systems, Charging Infrastructure & Aftermarket) |
| **Source Materials** | **Commercial Quotation Approval System Requirement for VKTR.pdf (authoritative)**, **transcribe.md (demo review session, hasil POC v2.1)**, Simulasi_HPM_Nikel_Kepmen_2026.xlsx, ConceptDSSpricingVKTR.pdf, VKTR-PriceCore Strategic Pricing Architecture.pdf, Timeline & Effort Detail.pdf |

> **Catatan revisi v2.0.** Dokumen *Commercial Quotation Approval System
> Requirement for VKTR* menetapkan SOP quotation dan hierarki approval
> yang berlaku di VKTR. Struktur approval di v1.1 (Procurement →
> Engineering → Finance → C-Level) merupakan asumsi awal dan **digantikan
> seluruhnya** oleh alur COGS Owner yang sesungguhnya (Sales Officer →
> Chief Sales → VP Finance ∥ VP Operations → BOD). Ditambahkan pula
> **Commercial Negotiation Process** berbasis *delegated discount
> authority* yang sebelumnya tidak tercakup.

> **Catatan revisi v2.1.** Dua kebutuhan baru:
> 1. **Multi-currency (FR-1.4)** — komponen biaya banyak yang berdenominasi
>    USD (BOM impor), sehingga input harus dapat dilakukan dalam **USD
>    maupun IDR** lewat *toggle*, dengan **master data nilai tukar** sebagai
>    dasar konversi. Sebelumnya seluruh input diasumsikan IDR.
> 2. **Mineral Index Adjustment (Module 8)** — Harga Mineral Acuan (HMA)
>    yang ditetapkan Kementerian ESDM menjadi dasar perhitungan Harga
>    Patokan Mineral (HPM). Nilainya diperbarui berkala (mingguan/dua
>    mingguan) dan dipakai sebagai **penyesuaian global** terhadap komponen
>    biaya berbahan mineral saat quotation disusun.

> **Catatan revisi v3.0.** POC v2.1 telah didemokan ke Chief Sales, VP
> Operations, dan VP Finance VKTR (lihat `transcribe.md`). Hasil review
> tersebut mengoreksi sejumlah asumsi struktural v2.0–v2.1:
> 1. **Master data COGS benar-benar tunggal (single source), bukan per
>    lini bisnis.** "Sampai keluar dari mesin produksi, semua sama" —
>    komponen dan nilai COGS tidak berbeda antara B2G/B2B/B2C. Yang
>    membedakan lini bisnis hanyalah **workflow approval** dan *add-on*
>    biaya di atas COGS dasar (FR-1.1 direvisi total, lihat §3 Module 1).
> 2. **Workflow tidak lagi satu alur baku, melainkan katalog *workflow
>    template*** yang di-*assign* ke kombinasi karakteristik deal
>    (customer segment × business type). VKTR memperkirakan akan ada
>    puluhan varian workflow yang tumbuh organik pasca go-live — sistem
>    harus mendukung penambahan template tanpa mengubah kode (FR-2.0
>    direvisi, lihat Module 2).
> 3. **Urutan pengisi cost line dikoreksi** dari asumsi awal. Urutan
>    sesungguhnya: **Sales Officer** (data customer & unit, tanpa akses
>    breakdown biaya) → **VP Operations** (biaya operasional, delivery
>    boleh menyusul) → **VP Finance** (OPEX, margin policy) → **Chief
>    Sales** (approve & rilis). Ditambahkan aktor keempat: **Product
>    Owner** (master data produk/spesifikasi/gambar untuk kebutuhan
>    dokumen quotation).
> 4. **Discount Authority direvisi dari tangga persentase diskon menjadi
>    tangga berbasis GPM akhir** (Module 6) — tiga tingkat: margin di
>    atas target (auto-release), margin turun sampai batas menengah (3
>    pihak: Sales, Profitability Owner, Pricing Owner), margin di bawah
>    batas menengah (2 BOD). Diskon dapat diinput dalam **Rupiah atau
>    persentase**.
> 5. **Quotation versioning berbasis Project/Customer Identifier** —
>    revisi quotation untuk deal yang sama (mis. karena qty berubah)
>    menghasilkan quotation baru yang ter-*link* ke identifier yang sama,
>    bukan quotation independen maupun edit in-place (Module 2, FR baru).
> 6. **Exchange rate**: ditarik otomatis (mingguan, Senin 00:01) dari API
>    bank rekanan, dengan **ambang sensitivitas berbasis persentase**
>    (bukan pilihan re-kalkulasi manual semata) yang menentukan kapan
>    quotation perlu dihitung ulang (FR-1.4 direvisi).
> 7. **Guard anomali/fraud**: satu Sales Officer dibatasi maksimal satu
>    quotation baru per hari untuk kombinasi customer + tipe unit yang
>    sama (Module 2, FR baru).
> 8. **HMA/Mineral Index dikonfirmasi hanya berdampak melalui pergerakan
>    kurs** — bukan feed independen yang memengaruhi harga secara
>    terpisah dari FX. Module 8 disederhanakan mengikuti temuan ini.
> 9. Module 7 (Customer KYC) **tetap Out of Scope pada POC** — lihat §8.
> 10. **Basis kurs dikoreksi dari USD ke CNY/RMB (Renminbi).** Diskusi
>     rate sensitivity threshold BOD (`transcribe.md`) eksplisit
>     membahas **RMB** (kurs ilustratif Rp 2.500–2.700/RMB), bukan USD —
>     konsisten dengan komponen impor VKTR (FOB Price) yang dikutip
>     vendor **dalam CNY**, karena sumber BOM berasal dari Cina. FR-1.4
>     dan seluruh referensi "USD" pada v2.1 **diganti menjadi CNY/RMB**
>     sebagai mata uang asing utama untuk komponen impor dan basis
>     Exchange Rate Master Data. USD tetap tersedia sebagai *pilihan
>     tampilan/toggle* quotation ke customer (terpisah dari basis FOB),
>     bila dibutuhkan pada fase lanjutan.

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

> **Prinsip kunci hasil demo review.** Komponen dan nilai COGS (biaya yang
> terbentuk sampai unit "keluar dari mesin produksi") bersifat **sama
> untuk semua segmen pelanggan** — satu master data tunggal, bukan
> berbeda-beda per lini bisnis. Yang bervariasi antar segmen (B2G Tender,
> B2B Fleet, B2C, dst.) hanyalah **alur approval** dan **komponen
> tambahan di atas COGS dasar** (mis. karoseri custom, komisi makelar,
> biaya akuisisi customer tertentu). Prinsip ini menyederhanakan Module 1
> namun menuntut Module 2 (Workflow) jauh lebih fleksibel — VKTR
> memperkirakan puluhan varian workflow akan muncul secara organik dalam
> 6 bulan pertama pasca go-live, seiring ditemukannya kombinasi segmen ×
> tipe deal baru.

**Tujuan akhir:** memastikan setiap quotation yang dirilis ke pelanggan telah melalui validasi biaya yang lengkap, memuat seluruh komponen harga yang dipersyaratkan, dan melindungi target margin perusahaan — sehingga risiko *margin leakage* akibat informasi harga yang tidak lengkap atau miskomunikasi dapat dihilangkan.

---

## 2. System Objectives & Strategic Outcomes

| Objective | Deskripsi |
|---|---|
| **Complete COGS Validation** | Tidak ada quotation yang dapat dirilis sebelum **seluruh komponen COGS mandatory** divalidasi oleh *COGS Owner* masing-masing (VP Finance & VP Operations). |
| **100% Process Compliance** | Mengunci alur pembentukan harga sehingga tidak ada tahap approval yang dapat dilewati (*zero bypass*). |
| **Delegated Authority Enforcement** | Permintaan diskon otomatis dirutekan sesuai *approval authority* berjenjang berbasis **dampak margin akhir** (Sales Officer/Profitability Owner/Pricing Owner → 2 BOD), tanpa bergantung pada ingatan atau koordinasi manual. |
| **Margin Leakage Prevention** | Sistem menolak/menandai quotation yang melanggar target margin perusahaan sebelum dirilis ke pelanggan. |
| **Single Master Data** | Satu Cost Breakdown Structure & satu set komponen biaya berlaku untuk **seluruh lini bisnis** — bukan CBS terpisah per segmen. Variasi antar segmen ditangani di lapisan *workflow* dan *add-on cost*, bukan di master data. |
| **Agile & Configurable Workflow Catalog** | Kemampuan menambah, mengubah, dan meng-*assign* *workflow template* baru ke kombinasi segmen/tipe deal tanpa *hard-coding* atau rilis ulang aplikasi — mengantisipasi pertumbuhan organik jumlah varian workflow. |
| **Executive DSS** | Menyediakan simulasi dampak perubahan parameter eksternal (kurs, harga material, diskon volume) terhadap *Gross Margin* secara *real-time*. |
| **Auditability** | Setiap perubahan angka harga, diskon, dan approval harus dapat ditelusuri (*who, what, when, why*) untuk kebutuhan audit internal maupun kepatuhan sebagai perusahaan Tbk. |

### Target Pengguna (Personas)

Peran berikut mengikuti SOP quotation VKTR, dikoreksi berdasarkan hasil
demo review (`transcribe.md`). **Urutan pengisian cost line yang benar
adalah Sales Officer → VP Operations → VP Finance → Chief Sales** —
bukan Chief Sales yang menyusun di awal seperti asumsi v2.0.

| Persona | Fungsi | Kebutuhan Utama |
|---|---|---|
| **Sales Officer** | Commercial | Input data customer, karakteristik deal (unit, qty, estimasi delivery, komisi makelar/perantara bila ada); **tidak memiliki akses** ke breakdown COGS/margin; mengajukan permintaan diskon dan meng-approve diskon dalam batas wewenangnya sendiri |
| **VP Operations** | COGS Owner | Mengisi & memvalidasi komponen operasional (logistik, STNK, delivery — boleh disusulkan belakangan tanpa menghambat harga dasar, dan biaya operasional lain) |
| **VP Finance** | COGS Owner / Profitability Owner | Mengisi & memvalidasi komponen finansial & margin policy (OPEX, cost of funds, sales commission, contingency buffer); pihak yang di-*remind* berkala untuk menjaga data biaya tetap segar |
| **Chief Sales** | Commercial / Pricing Owner | Meninjau hasil rakitan seluruh COGS Owner, approve tahap akhir untuk merilis quotation, menyetujui diskon pada tingkat menengah (bersama Profitability Owner) |
| **Product Owner** | Commercial Support | Mengelola master data produk: spesifikasi, gambar/foto, brosur, varian karoseri/bak — konten yang tampil di dokumen quotation/PDF, bukan komponen biaya |
| **BOD / Direksi** | Executive | Meninjau *commercial case* saat margin akhir jatuh di bawah batas menengah; keputusan memerlukan **dua BOD**; Approve / Reject / Revise |
| **System Admin** | IT/Operations | Konfigurasi katalog *workflow template* & *assignment*-nya, master data, ambang margin/wewenang diskon, dan hak akses |

> **Catatan kepemilikan istilah.** Dokumen sumber menyebut tiga pihak
> dalam governance harga: **pemilik COGS** (VP Operations & VP Finance),
> **pemilik profitabilitas** (VP Finance, dalam konteks margin policy),
> dan **pemilik harga jual final** (Chief Sales). Ketiganya dipakai
> konsisten di seluruh dokumen ini sebagai *COGS Owner*, *Profitability
> Owner*, dan *Pricing Owner*.

---

## 3. Detailed Functional Requirements (FR)

### Module 1 — Dynamic Pricing Component & Master Data Engine (Data Engineering Layer)

*Modul ini memetakan seluruh struktur komponen biaya dan margin secara hierarkis dan terpusat.*

> **Revisi v3.0 — master data tunggal.** Demo review mengoreksi asumsi
> "CBS berbeda per lini bisnis" (v2.0/v2.1). Kenyataannya: **komponen dan
> nilai COGS sampai unit selesai diproduksi adalah sama untuk semua
> segmen pelanggan.** Yang bervariasi hanyalah workflow approval-nya
> (Module 2) dan *add-on cost* yang ditambahkan **di atas** COGS dasar
> untuk deal tertentu (mis. komisi makelar, biaya custom karoseri,
> acquisition cost pelanggan spesifik). FR-1.1 dan FR-1.3 direvisi untuk
> mencerminkan ini; kebutuhan *dynamic formula per lini bisnis* pada
> FR-1.2 v2.1 **dicabut** karena rumus dasarnya sama untuk semua lini.

- **FR-1.1 Mappable Cost Breakdown Structure (CBS) — Satu Master Data untuk Semua Lini Bisnis**

  Setiap item biaya **wajib** memiliki *COGS Owner* — fungsi yang bertanggung jawab memvalidasinya. Kepemilikan inilah yang menggerakkan *gatekeeping* di Module 2. **CBS ini bersifat tunggal (single source)** — tidak ada CBS terpisah per B2G/B2B/B2C; struktur berikut berlaku sama untuk seluruh transaksi.

  > **Struktur riil (sumber: `BTEL-CostStructure.xlsx`).** Menggantikan
  > daftar item ilustratif pada v2.0/v2.1 (Battery/Chassis/Powertrain
  > generik). Struktur berikut adalah cost structure aktual VKTR/BTEL,
  > dengan 4 kelompok besar. **Kepemilikan (COGS Owner) per kelompok
  > mengikuti pola fungsi masing-masing dan masih perlu dikonfirmasi
  > final ke VKTR sebelum implementasi** — ditandai `(asumsi)` di bawah.

  | Kelompok | Item | COGS Owner *(asumsi)* |
  |---|---|---|
  | **COGS** | FOB Price in CNY, FOB Price in IDR, Freight and Insurance, Custom Duties, Port Handling/Clearance/Pre-Delivery Inspection, Carrosserie Allocation, Assembly Cost, Local Parts, Accessories, Telematics, Warehousing and Storage, Warranty Cost, Initial Energy Injection, Administrative Cost | **VP Operations** |
  | **Profitability** | VKTS Profit Before Tax, VKTS Margin, VKTR Profit Before Financing Cost, Financing Cost, VKTR Margin After Financing Cost | **VP Finance** (Profitability Owner) |
  | **Sales** | STNK, Insurance, Incentive Internal, Incentive External, Sales Processing Cost, Agency Fee | **Sales Officer** — konsisten dengan FR-1.1.1, biaya yang melekat pada proses akuisisi/komersial per deal, bukan biaya produksi |
  | **Add-Ons** | Processing Service, Delivery Service, KEUR, Additional | **VP Operations** — bersifat operasional pelengkap; **Delivery Service boleh disusulkan** (lihat FR-2.0), tidak menghambat harga dasar |

  - Item bertanda `is_mandatory` tidak boleh kosong saat quotation hendak dirilis (FR-2.2). Item pada kelompok **Add-Ons** yang ditandai *boleh menyusul* (mis. Delivery Service) dikecualikan dari gate harga dasar namun tetap wajib terisi sebelum `Final Quotation Released` (FR-2.2).
  - Penambahan item baru di tengah proses memicu *re-verification* ke COGS Owner terkait (FR-2.4).
  - Field-field CBS diasumsikan **stabil dalam jangka panjang** (VKTR
    menyebut "tidak berubah sampai 10 tahun ke depan") — struktur pohon
    CBS sendiri jarang berubah; yang dinamis hanyalah *nilai* tiap item
    per quotation.
  - **Klasifikasi Direct/Indirect Cost** tetap dipertahankan sebagai
    kategori pelaporan terpisah untuk kebutuhan Finance, independen dari
    struktur kelompok/COGS Owner di atas — dipetakan silang (mis. item
    kelompok **COGS** umumnya *Direct Cost*, item **Add-Ons**/**Sales**
    umumnya *Indirect Cost*), pemetaan detailnya perlu dikonfirmasi
    bersama Finance.
  - **Role/aktor pengisi tiap kelompok belum secara eksplisit
    dikonfirmasi** oleh VKTR pada `BTEL-CostStructure.xlsx` — kolom
    "COGS Owner" di atas adalah pemetaan awal PriceCore mengikuti nama
    kelompok, dan **wajib divalidasi** bersama VP Operations/VP
    Finance/Chief Sales sebelum dipakai sebagai gatekeeping resmi (lihat
    §14 Open Technical Decisions pada Technical Logic).

- **FR-1.1.1 Sales Add-On Cost (Non-COGS, Non-Profitability)**

  Klarifikasi atas kelompok **Sales** pada `BTEL-CostStructure.xlsx` di
  atas — biaya yang muncul dari proses akuisisi pelanggan tertentu,
  bukan bagian dari COGS produksi maupun margin policy — diinput oleh
  **Sales Officer**, contoh dari demo review: komisi makelar/perantara,
  biaya entertainment/perjalanan terkait deal, insentif internal khusus
  proyek (selaras dengan item Agency Fee, Incentive Internal/External,
  Sales Processing Cost pada struktur riil). Item pada kelompok ini:
  - Dimiliki (COGS Owner) oleh **Sales**, tidak memerlukan validasi VP
    Operations/VP Finance.
  - Ditambahkan sebagai *add-on* di atas harga dasar yang sudah
    ditentukan dari CBS + margin, sebelum harga jual final terbentuk.
  - Tetap tunduk pada FR-2.4 (Dynamic Form Adjustment) bila ditambahkan
    setelah workflow berjalan.

- **FR-1.2 Formula Engine (Satu Formula Dasar untuk Semua Lini Bisnis)**
  - Rumus perhitungan harga dasar (COGS → margin → harga jual) **sama
    untuk seluruh lini bisnis** — mengikuti prinsip master data tunggal
    di FR-1.1. Variasi harga antar segmen dihasilkan oleh *add-on cost*
    (FR-1.1.1) dan parameter workflow (Module 2), bukan oleh rumus yang
    berbeda-beda.
  - Integrasi data parameter eksternal (kurs CNY/IDR, faktor penyesuaian
    mineral — lihat Module 8).
  - Kemampuan *test/simulate* rumus secara *on-the-fly* sebelum disimpan
    sebagai perubahan master config (bukan per lini bisnis).
  - *Dynamic per-lini-bisnis formula builder* (versi No-Code penuh)
    **ditunda** ke fase lanjutan — tidak dibutuhkan selama rumus dasar
    tunggal berlaku; dicatat sebagai kemungkinan kebutuhan masa depan
    bila VKTR menemukan lini bisnis dengan struktur harga yang benar-benar
    berbeda (bukan sekadar workflow berbeda).
- **FR-1.3 Pricing Template Management**
  - Satu template dasar (CBS items + margin factors) yang dipakai ulang
    untuk seluruh transaksi, terlepas dari tipe deal.
  - "Preset per tipe transaksi" pada v2.1 (Penjualan Unit vs *EV Fleet
    Lease* vs *Charging Infra*) digantikan oleh *workflow template*
    (Module 2) yang mengatur alur approval — bukan oleh template CBS
    yang berbeda.

- **FR-1.4 Multi-Currency Input & Exchange Rate Master Data (basis CNY/RMB)**

  > **Koreksi v3.0.** Demo review mengoreksi asumsi v2.1 bahwa komponen
  > impor VKTR berdenominasi USD **dan** bahwa BOM dipecah jadi item
  > terpisah (Battery/Chassis/Powertrain). Kenyataannya, unit VKTR
  > dibeli dari BTEL sebagai **satu barang jadi (FOB)** — sudah dirakit
  > sebelum masuk ke PriceCore, bukan dirakit dari sub-komponen di dalam
  > sistem ini (lihat catatan "keluar dari mesin produksi" pada FR-1.1).
  > Karena itu struktur CBS riil hanya punya **satu item "FOB Price in
  > CNY/IDR"** yang mewakili harga beli unit jadi tersebut, bukan
  > rincian Battery + Chassis + Powertrain sebagai item terpisah.
  > FOB Price ini dikutip vendor **dalam CNY (Yuan/Renminbi)**, karena
  > BTEL/sumber unit berasal dari Cina. Diskusi *rate sensitivity
  > threshold* pada demo review eksplisit membahas **RMB** dengan kurs
  > ilustratif Rp 2.500–2.700/RMB — bukan USD/IDR (yang berkisar
  > Rp 16.000-an). **Basis Exchange Rate Master Data diganti dari
  > USD→IDR menjadi CNY→IDR.** USD tetap dapat dipertahankan sebagai
  > *pilihan tampilan* quotation ke customer (mis. untuk klien yang
  > minta penawaran dalam USD), namun ini terpisah dari basis konversi
  > FOB Price yang riil.

  Komponen biaya terbesar VKTR berdenominasi **CNY** — yaitu **FOB Price** (harga beli unit jadi dari BTEL, satu angka gabungan, bukan rincian per sub-komponen mesin), sementara komponen lokal (karoseri, STNK, delivery) berdenominasi **IDR**. Memaksa seluruh input ke satu mata uang membuat pengisi harus mengonversi manual — sumber kesalahan dan hilangnya jejak angka asli dari vendor.

  - **FR-1.4.1 Currency Toggle per Quotation** — Saat quotation dibuat, penyusun memilih mata uang input untuk komponen impor: **CNY** atau **IDR**. Seluruh cost line pada quotation tersebut diinput dalam mata uang terpilih. *(Opsional, fase lanjutan)*: toggle tampilan **USD** untuk ringkasan harga ke customer, independen dari basis CNY di atas.
  - **FR-1.4.2 Exchange Rate Master Data — Sumber Otomatis Mingguan**

    Direvisi dari "input manual saja" (v2.1) — hasil demo mengonfirmasi
    kurs ditarik **otomatis dari API bank rekanan** (mis. BCA, yang
    memiliki API kurs), bukan semata input manual Admin.
    - Kurs **CNY→IDR** ditarik otomatis pada **awal minggu (Senin pukul
      00:01)** dan disimpan sebagai baris master data baru dengan
      *effective date*. Nilai lama tetap tersimpan untuk audit.
    - Admin tetap dapat melakukan **override manual** kapan saja bila
      diperlukan (mis. API tidak tersedia); baris manual dicatat dengan
      `source = manual` untuk membedakan dari `source = bank-api`.
    - Frekuensi tarik (mingguan) adalah **master config**, dapat diubah
      ke harian/dua-mingguan tanpa rilis ulang.
    - Kurs USD→IDR (bila toggle tampilan USD diaktifkan) dikelola
      sebagai baris master data **terpisah**, tidak memengaruhi basis
      kalkulasi COGS.
  - **FR-1.4.3 Rate Locking & Reproducibility** — Kurs yang berlaku **saat kalkulasi dijalankan** disimpan bersama hasil perhitungan. Harga yang sudah disetujui tidak boleh berubah hanya karena kurs bergerak esok hari; setiap angka final harus dapat dijelaskan memakai kurs yang mana.
  - **FR-1.4.4 Dual Display** — Ringkasan harga menampilkan **kedua mata uang** (CNY dan IDR) beserta kurs yang dipakai, sehingga approver dari fungsi berbeda tidak perlu menghitung sendiri.
  - **FR-1.4.5 Currency Change Guard** — Mengubah mata uang quotation setelah cost line terisi wajib memicu konfirmasi eksplisit; nilai lama **tidak** dikonversi otomatis agar tidak ada angka yang berubah diam-diam.
  - **FR-1.4.6 Rate Sensitivity Threshold (baru)**

    Pergerakan kurs tidak serta-merta mengubah harga quotation yang
    sedang berjalan — hanya bila pergerakannya melebihi ambang yang
    dikonfigurasi.
    - Admin menetapkan **ambang sensitivitas dalam persentase** (mis.
      2%) terhadap kurs CNY→IDR yang dipakai terakhir kali quotation
      dihitung.
    - Selama pergerakan kurs terbaru **berada dalam ambang**, harga
      quotation yang sudah ada **tidak berubah** — sistem tetap memakai
      kurs lama sampai quotation dihitung ulang secara eksplisit.
    - Begitu pergerakan **melebihi ambang**, sistem menampilkan
      **notifikasi visual** di halaman quotation (mis. banner: *"Kurs
      CNY/IDR (RMB) telah diperbarui menjadi X per [tanggal, jam] —
      melebihi ambang sensitivitas"*) kepada Sales Officer maupun
      approver yang sedang membuka quotation tersebut.
    - Quotation **tidak dihitung ulang secara otomatis** saat ambang
      terlampaui — penyusun/approver wajib menekan tombol **"Hitung
      Ulang"** secara eksplisit agar harga final ikut bergerak. Ini
      mencegah harga berubah diam-diam tanpa disadari pengisi.
    - Ambang, sumber kurs yang dipakai (tengah/jual/pajak), dan frekuensi
      tarik adalah **master config**, bukan hardcode.

- **FR-1.5 Product Master Data & Quotation Document Template (baru)**

  Menjawab kebutuhan aktor keempat, **Product Owner**, yang muncul di
  demo review: quotation VKTR bukan hanya angka, melainkan juga dokumen
  komersial (dengan brosur/spesifikasi/gambar produk) yang dikirim ke
  pelanggan — dan produk yang ditawarkan (varian sasis, karoseri, opsi)
  terus berubah seiring linimasa produk VKTR.

  - **FR-1.5.1 Product Master Data** — Katalog produk (model kendaraan,
    varian sasis/karoseri, spesifikasi teknis, foto/gambar, brosur)
    dikelola terpisah dari CBS biaya, oleh **Product Owner**. Setiap
    produk berstatus `active`/`discontinued` (soft-disable, bukan
    delete) agar quotation lama tetap dapat merujuk data produk yang
    berlaku saat itu.
  - **FR-1.5.2 Quotation Item Linking** — Saat menyusun quotation, Sales
    memilih produk dari Product Master Data; spesifikasi & gambar
    otomatis terbawa ke dokumen quotation tanpa perlu dicari ulang.
  - **FR-1.5.3 Format Quotation (Template PDF)** — Sistem menghasilkan
    dokumen quotation final (PDF) mengikuti **template baku** yang
    memuat: identitas customer & Project Identifier (FR-2.5), rincian
    unit & harga per unit, spesifikasi/gambar produk dari Product Master
    Data, syarat pembayaran, serta metadata approval (siapa approve,
    kapan, nomor quotation). Template dapat memiliki **variasi tampilan
    per lini bisnis** (mis. B2G vs B2B) namun **data sumbernya sama**
    (konsisten dengan prinsip master data tunggal, FR-1.1).
  - Struktur field template PDF final **perlu dikonfirmasi** bersama
    tim Sales/Product (dokumen contoh disebutkan akan dibagikan pasca
    demo) — dicatat sebagai *Open Technical Decision* (lihat Technical
    Logic §14).

### Module 2 — Quotation Approval Workflow Engine (COGS Validation)

*Engine otomatisasi proses untuk memastikan governance, validasi COGS lengkap, dan pelacakan status quotation.*

> **Revisi v3.0 — dari satu alur baku menjadi katalog *workflow
> template*.** Demo review mengoreksi asumsi bahwa satu alur (VP Finance
> ∥ VP Operations → Chief Sales) berlaku universal. Kenyataannya: alur
> approval **bervariasi menurut kombinasi karakteristik deal** (segmen
> customer B2G/B2B/B2C, hubungan khusus/relasi, bidang usaha, dll.), dan
> VKTR memperkirakan akan menemukan **puluhan varian** dalam 6 bulan
> pertama pasca go-live. FR-2.0 dan FR-2.1 direvisi agar sistem
> mendukung **banyak workflow template** yang di-*assign* ke deal
> berdasarkan *qualifier* yang bersifat statis, sementara katalog
> template itu sendiri terus bertambah tanpa perlu rilis ulang aplikasi.

- **FR-2.0 Alur Quotation Baku (Urutan Pengisi Cost Line — Dikoreksi)**

  Urutan pengisian cost line yang sesungguhnya berjalan **sekuensial**
  antar fungsi (bukan Chief Sales menyusun di awal seperti asumsi v2.0),
  dengan validasi paralel tetap terjadi di dalam tahap COGS:

  ```
  Sales Officer          VP Operations         VP Finance            Chief Sales
  ─────────────          ─────────────         ──────────            ───────────
  Input data customer,   Isi & validasi        Isi & validasi        Tinjau hasil rakitan,
  unit, qty, estimasi    komponen              komponen              approve →
  delivery, komisi       operasional           finansial &           memicu Release Gate
  makelar (bila ada)     (delivery cost        margin policy
  — TANPA akses          boleh menyusul,       (OPEX, cost of
  breakdown COGS         tidak jadi stopper    funds, sales
        │                harga dasar)          commission,
        │                      │               contingency buffer)
        │                      │                     │
        └──────────────────────┴──────────┬──────────┘
                                          ▼
                          Harga dasar (COGS + margin) terbentuk,
                          add-on sales cost (FR-1.1.1) ditambahkan
                                          ▼
                              Chief Sales approve → Release Gate
                                          ▼
                                Final Quotation Released
  ```

  - **VP Operations mengisi lebih dulu**, diikuti **VP Finance** —
    keduanya dapat bekerja **paralel** bila urutan bisnis tidak
    mensyaratkan sekuensial (AND-join tetap berlaku sebagai syarat
    lanjut ke Chief Sales); harga dasar sudah dapat dihitung begitu
    komponen utama (BOM, karoseri, bea masuk) terisi, sementara
    komponen pelengkap seperti **biaya pengiriman/delivery boleh
    disusulkan** tanpa menghentikan penyusunan harga.
  - Quotation hanya dapat dirilis setelah **seluruh** COGS Owner
    menyetujui (*AND-join*) — prinsip ini tidak berubah dari v2.0.
  - **Sales Officer tidak memiliki akses melihat breakdown COGS/margin**
    di tahap manapun (ditegakkan lewat RBAC/ABAC, lihat Module 5) — ia
    hanya melihat karakteristik input yang mempengaruhi harga (mis. tier
    diskon volume) dan harga jual final.

- **FR-2.0.1 Workflow Template Catalog & Assignment (baru)**

  Menggantikan gagasan "satu workflow baku" dengan **katalog workflow
  template** yang tumbuh dari waktu ke waktu:
  - Setiap **Workflow Template** mendefinisikan: urutan/tahapan approval,
    *parallel group*, SLA per tahap, dan aturan eskalasi — persis
    seperti `workflow_definition` pada versi sebelumnya, namun kini
    eksplisit sebagai **satu dari banyak** template yang bisa dipilih.
  - **Qualifier** (kriteria pemilihan template) bersifat **statis** dan
    dikonfigurasi sebagai master config, contoh: segmen customer
    (B2G/B2B/B2C), status *blacklist*, ambang nilai transaksi, indikasi
    relasi khusus. Qualifier inilah yang tidak sering berubah — yang
    bertambah adalah **jumlah template** dan pemetaannya ke qualifier.
  - Saat quotation dibuat, sistem **otomatis memilih Workflow Template**
    yang cocok berdasarkan qualifier deal tersebut — pengaju tidak
    memilih workflow secara manual (konsisten dengan prinsip *no
    authority bypass* di Module 6).
  - Admin dapat **menambah Workflow Template baru** dan mengubah
    pemetaan qualifier → template kapan saja, tanpa memengaruhi
    quotation yang sedang berjalan di template lama (setiap
    `workflow_instance` mengunci template versi saat quotation dibuat).
  - Ditujukan untuk mengakomodasi pertumbuhan organik: dimulai dari
    beberapa template dasar (mis. B2G Tender, B2B Fleet Standard), lalu
    bertambah seiring ditemukannya kasus khusus di lapangan.

- **FR-2.0.2 Basic Workflow — Minimal Dua Varian untuk POC/Go-Live Awal**

  Agar katalog (FR-2.0.1) tidak kosong saat go-live, PriceCore
  menyediakan **minimal dua workflow template dasar**, mewakili dua
  sumbu variasi yang disebut eksplisit pada demo review:

  1. **Berdasarkan Profitability/Margin Tier** — alur approval mengikuti
     tiga tingkat pada Discount Authority Engine (Module 6): rilis
     otomatis di atas target margin, 3-pihak (Sales, Profitability
     Owner, Pricing Owner) pada tingkat menengah, 2 BOD pada tingkat
     terendah. Workflow ini **dipicu oleh hasil kalkulasi margin**, bukan
     oleh identitas customer.
  2. **Berdasarkan Industri/Segmen Customer (B2B/B2G/B2C)** — alur
     approval mengikuti kompleksitas administratif segmen, contoh: B2G
     mensyaratkan tahap approval tambahan/dokumentasi lebih ketat
     dibanding B2B/B2C standar, terlepas dari besaran margin.

  Kedua varian ini adalah **starting point**, bukan daftar akhir — Admin
  dapat menambah workflow template lain (kombinasi keduanya, atau sumbu
  baru sama sekali) kapan saja lewat FR-2.0.1/FR-2.1 tanpa rilis ulang.

- **FR-2.1 No-Code/Low-Code Workflow Configurator**
  - Admin dapat membentuk dan mengubah alur persetujuan (sekuensial maupun **paralel**) sesuai matriks otorisasi perusahaan, untuk **setiap Workflow Template** dalam katalog (FR-2.0.1).
  - Mendukung *parallel group*: beberapa approver dalam satu tahap yang harus selesai semua sebelum lanjut.
  - Eskalasi otomatis berdasarkan nilai transaksi maupun **dampak margin akhir** (lihat Module 6 — direvisi dari "besaran diskon" murni).
- **FR-2.2 Strict Gatekeeping & State Locking**
  - Quotation tidak dapat maju ke tahap berikutnya sebelum seluruh *mandatory COGS component* milik tahap tersebut divalidasi oleh pemiliknya.
  - **Release gate**: `Final Quotation Released` mustahil tercapai selama masih ada komponen mandatory yang belum tervalidasi — ini adalah penjaga utama terhadap *margin leakage*.
  - Komponen yang ditandai **boleh menyusul** (mis. delivery cost — FR-2.0) dikecualikan dari gate harga dasar, namun tetap wajib terisi sebelum *Final Quotation Released* tercapai.
- **FR-2.3 Rejection & Routing Logic**
  - **Approve with Conditions**: Persetujuan dengan catatan khusus yang tercatat di log hingga fase eksekusi.
  - **Targeted Rejection**: Penolakan dapat dikembalikan langsung ke pihak spesifik (misal: Reject dari VP Finance dikembalikan ke Chief Sales) tanpa membatalkan *draft* dari awal.
- **FR-2.4 Dynamic Form Adjustment**
  - Jika terdapat komponen biaya baru yang ditambahkan di tengah proses, alur kerja secara otomatis mengarahkan formulir ke **COGS Owner** pemilik komponen tersebut untuk diverifikasi ulang.
  - Berlaku juga untuk **Sales Add-On Cost** (FR-1.1.1) yang ditambahkan setelah quotation disubmit — diarahkan kembali ke Sales Officer, tanpa memicu re-verifikasi COGS Owner lain.

- **FR-2.5 Project/Customer Identifier & Quotation Versioning (baru)**

  Menjawab kebutuhan melacak riwayat quotation untuk deal yang sama saat
  terjadi revisi (mis. qty berubah dari negosiasi), tanpa kehilangan
  jejak harga yang pernah diberikan ke pelanggan.
  - Setiap quotation request **wajib** dikaitkan dengan satu **Project
    Identifier** — kode alfanumerik unik yang merepresentasikan
    kombinasi customer + proyek/lokasi (mis. dua proyek berbeda untuk
    customer yang sama tetap mendapat identifier berbeda).
  - Sales Officer cukup memasukkan **nama customer** dan **nama
    proyek/lokasi**; sistem yang men-generate Project Identifier secara
    konsisten (bukan diketik manual oleh Sales), sehingga penamaan tetap
    terstandardisasi.
  - Revisi terhadap deal yang sama (unit berubah, harga dinegosiasi
    ulang setelah rilis, dst.) **menghasilkan quotation baru** yang
    ter-*link* ke Project Identifier yang sama — **bukan** edit in-place
    dan **bukan** adendum, agar histori harga yang pernah dikirim ke
    pelanggan tetap utuh untuk audit.
  - Quotation lama pada Project Identifier yang sama otomatis ditandai
    `SUPERSEDED` ketika quotation baru untuk project tersebut dirilis.
  - Dashboard (Module 3) dapat mengelompokkan seluruh quotation dalam
    satu Project Identifier sebagai satu linimasa (`Quotation #1 dasar →
    #2 revisi qty → #3 revisi harga`, dst.).

- **FR-2.6 Duplicate/Fraud Guard — Batas Quotation Harian (baru)**

  Mencegah penyalahgunaan sistem untuk menerbitkan quotation secara
  serampangan (anomali dibandingkan pola penjualan riil, di mana satu
  sales jarang menerbitkan lebih dari satu quotation per hari untuk
  customer yang sama).
  - Sistem membatasi **satu Sales Officer** membuat maksimal **satu
    quotation baru per hari** untuk kombinasi **customer yang sama +
    tipe unit yang sama**.
  - Batas ini adalah **master config** (jumlah maksimum & jendela waktu
    dapat diubah oleh Admin), bukan hardcode.
  - Percobaan yang melampaui batas ditolak di *service layer* dengan
    pesan eksplisit, dan tercatat di audit trail sebagai kandidat
    anomali untuk ditinjau System Admin/Chief Sales.

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
    - Dampak fluktuasi kurs (misal: CNY/IDR naik 3%).
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

### Module 6 — Commercial Negotiation & Margin-Based Discount Authority

*Modul yang mendigitalkan proses negosiasi harga dengan pelanggan sesuai hierarki wewenang diskon.*

> **Revisi v3.0 — dari tangga persentase diskon menjadi tangga berbasis
> margin akhir.** Demo review mengoreksi model v2.0/v2.1 (Sales Officer
> ≤3% → Chief Sales ≤8% → BOD): wewenang persetujuan **sesungguhnya
> ditentukan oleh GPM akhir hasil kalkulasi**, bukan oleh besaran diskon
> mentah. VKTR menjelaskan tiga tingkat baku: (1) margin ≥ target →
> harga *default* per unit sudah tertentu, tanpa approval tambahan; (2)
> margin turun sampai batas menengah (ilustrasi rapat: sampai ~10–12%)
> → cukup disetujui **3 pihak** (Sales/Customer Owner, Profitability
> Owner, Pricing Owner) — bahkan berpotensi *bypass* BOD di titik ini
> bila ada pelimpahan wewenang eksplisit dari BOD, namun keputusan rapat
> tetap **mengunci batas aman di 12%** sebagai pagar; (3) margin di
> bawah itu (ilustrasi: ~8,5–9%) → wajib **dua orang BOD**. FR-6.1–FR-6.4
> direvisi total mengikuti model ini; **input diskon kini mendukung
> Rupiah maupun persentase** (FR-6.1.1, baru).

- **FR-6.0 Alur Negosiasi Baku (Margin-Tier)**

  ```
  Customer Requests Price Negotiation
  (Sales input dalam Rupiah ATAU persentase — FR-6.1.1)
                 │
                 ▼
  Hitung ulang GPM hasil akhir bila diskon diterapkan
                 │
                 ▼
  GPM akhir ≥ Tier 1 threshold (target margin)?  ──YES──► Auto-release,
                 │ NO                                       tanpa approval tambahan
                 ▼
  GPM akhir ≥ Tier 2 threshold (batas menengah,
  ilustrasi 12%)?                                ──YES──► 3 pihak approve:
                 │ NO                                       Sales/Customer Owner ∥
                 │                                          Profitability Owner ∥
                 │                                          Pricing Owner (semua ACK)
                 ▼
        Wajib 2 (dua) orang BOD
                 │
                 ▼
        Approve / Reject / Revise
                 │
                 ▼
        Final Quotation Released
  ```

  - **Tier ditentukan oleh hasil GPM setelah diskon diterapkan**, bukan
    oleh persentase diskon itu sendiri — dua quotation dengan diskon %
    yang sama bisa jatuh ke tier berbeda bila margin dasarnya berbeda.
  - Ambang tiap tier (target margin, batas menengah, batas terendah)
    adalah **master config per lini bisnis/segmen**, bukan angka
    hardcode — dikonfirmasi bersama Finance/BOD sebelum go-live
    (angka ilustratif rapat: ≥15% Tier 1, ~10–12% Tier 2, <~8,5–9% Tier
    3; **12% disepakati sebagai batas aman yang tidak boleh dilewati**
    meski secara historis ada pelimpahan *bypass* BOD di titik ini).

- **FR-6.1 Margin Tier Authority Matrix (Configurable)**
  - Admin menetapkan **3 tingkat berbasis GPM akhir** per lini
    bisnis/segmen:
    | Tier | Kondisi GPM akhir | Approver wajib |
    |---|---|---|
    | **1 — Auto** | ≥ target margin lini bisnis | Tidak ada — harga *default* sudah ditentukan di price list |
    | **2 — Menengah** | Di bawah target, tetapi ≥ batas aman (ilustrasi 12%) | **3 pihak**: Sales/Customer Owner, Profitability Owner (VP Finance), Pricing Owner (Chief Sales) — seluruhnya harus menyetujui |
    | **3 — Kritis** | < batas aman | **2 (dua) orang BOD** |
  - Ambang tiap tier adalah *master config* — dapat diubah tanpa rilis
    ulang aplikasi, dan dapat di-*scope* per lini bisnis (mis. ambang
    B2G berbeda dengan B2B, konsisten dengan ambang GPM guardrail pada
    Module 4).
  - Tier 2 mendukung opsi konfigurasi **"BOD delegation"** — bila
    diaktifkan, keputusan tier 2 dapat mem-*bypass* eskalasi ke BOD atas
    dasar pelimpahan wewenang yang tercatat; dinonaktifkan secara
    default karena berisiko mengaburkan batas aman 12% bila disalahgunakan.

- **FR-6.1.1 Dual-Mode Discount Input (Rupiah / Persentase) (baru)**
  - Sales Officer dapat memasukkan permintaan diskon dalam **nilai
    Rupiah absolut** atau **persentase** — keduanya saling
    terkonversi otomatis berdasarkan harga jual sebelum diskon, dan
    nilai yang tersimpan mencatat **mode asli yang diinput** (audit
    trail memuat baik Rupiah maupun % yang setara).
  - Tampilan approval menampilkan kedua representasi (Rupiah dan %)
    agar seluruh pihak yang meninjau (Sales, Profitability Owner,
    Pricing Owner, BOD) melihat dasar yang sama.

- **FR-6.2 Automatic Escalation Routing**
  - Saat permintaan diskon diajukan, sistem **otomatis menghitung GPM
    akhir** dan **menentukan tier** — pengaju tidak dapat memilih
    approver sendiri (mencegah *authority bypass*).
  - Tier 2 memerlukan **AND-join tiga pihak** (mirip pola COGS
    Validation di Module 2) — seluruh pihak harus menyetujui, bukan
    salah satu saja.
  - Tier 3 memerlukan **AND-join dua BOD** — satu persetujuan BOD saja
    tidak cukup.
- **FR-6.3 Negotiation Decision & Revision Loop**
  - Approver pada tier manapun dapat memilih **Approve**, **Reject**,
    atau **Revise** (mengajukan diskon tandingan/*counter-offer*).
  - Keputusan `Revise` mengembalikan kasus ke pengaju dengan nilai
    diskon usulan baru, memulai **evaluasi tier ulang** dari GPM akhir
    yang baru — bisa turun tier (mis. dari Tier 3/2-BOD ke Tier 2/3-pihak
    bila counter-offer menaikkan margin).
  - **Loop dibatasi pada quotation yang sama**: begitu quotation pertama
    ter-*publish* (dirilis ke pelanggan), permintaan diskon berikutnya
    yang disetujui **menghasilkan quotation baru** yang ter-*link* ke
    Project Identifier yang sama (FR-2.5) — bukan negosiasi berlapis
    tanpa batas pada satu quotation. Ini konsisten dengan prinsip
    versioning per project.
- **FR-6.4 Real-Time Margin Impact Visibility**
  - Saat besaran diskon diinput (Rupiah maupun %), sistem langsung
    menampilkan dampaknya terhadap *final price*, **GPM akhir**, **tier
    yang berlaku**, dan status *margin guardrail* — menjawab tantangan
    *"limited visibility of actual profitability during commercial
    negotiations"*.
  - Diskon yang mendorong quotation ke Tier 2/3 ditandai secara
    eksplisit kepada approver sebelum keputusan diambil.
- **FR-6.5 Negotiation Audit Trail**
  - Seluruh riwayat permintaan diskon (Rupiah & % setara), tier yang
    dihitung, eskalasi, dan keputusan tercatat *append-only* dan
    tertaut ke quotation serta Project Identifier terkait.

### Module 7 — Customer Qualification (KYC & Opportunity Assessment)

*Tahap kualifikasi awal sebelum quotation request dibuat.*

- **FR-7.1 Customer KYC Record** — Pencatatan identitas & legalitas pelanggan (nama entitas, NPWP, tipe pelanggan B2G/B2B, PIC).
- **FR-7.2 Opportunity Assessment** — Estimasi nilai peluang, lini bisnis, kebutuhan unit, indikasi kompetitor.
- **FR-7.3 Qualification Gate** — Quotation request hanya dapat dibuat untuk pelanggan berstatus *Qualified*; status ditetapkan oleh Sales Officer.

> **Catatan implementasi POC.** Module 7 didokumentasikan sebagai requirement
> resmi namun **tidak dibangun** pada POC saat ini (lihat §8 Out of Scope) —
> fokus POC ada pada pricing governance, COGS validation, dan negotiation
> authority. Data pelanggan pada POC cukup berupa field bebas di quotation.
>
> **Klarifikasi proses bisnis (demo review, tidak mengubah status
> scope).** Sesi demo menjelaskan detail SOP KYC yang berlaku di luar
> sistem saat ini: dua field wajib diisi Sales sebelum quotation dapat
> diajukan — **estimasi jumlah unit yang akan dibeli** (memengaruhi tier
> volume/harga) dan **metode pembayaran** (tunai vs *financing* —
> memengaruhi kebutuhan *upsizing* harga untuk menutup DP pada skema
> *financing*). Proses ini **tidak memerlukan validasi pihak ketiga**;
> cukup wajib diisi. Bila Module 7 dibangun pada fase lanjutan, kedua
> field ini menjadi kandidat *qualification gate* pertama.

### Module 8 — Mineral Index Adjustment (HMA → IDR via Kurs)

*Penyesuaian harga mineral resmi pemerintah, yang di VKTR berdampak melalui pergerakan kurs — bukan sebagai feed independen terhadap harga.*

> **Revisi v3.0 — HMA berdampak hanya lewat kurs.** Demo review
> mengonfirmasi bahwa acuan harga battery pack VKTR merujuk pasar mineral
> internasional (bukan publikasi domestik langsung), dan **satu-satunya
> jalur dampaknya ke harga quotation adalah melalui pergerakan kurs
> CNY/IDR (RMB)** (Module 1, FR-1.4.6) — komponen mineral-linked itu
> sendiri relatif stabil dalam CNY (dikutip vendor Cina). Ini
> **menyederhanakan** kebutuhan v2.1:
> Module 8 tidak lagi memerlukan faktor penyesuaian global terpisah dari
> FX; HMA/HPM tetap dicatat sebagai referensi & transparansi (FR-8.1,
> FR-8.4), namun **mekanisme adjustment otomatisnya (FR-8.3 versi lama)
> dicabut** karena jalur dampak riilnya sudah tercakup oleh
> FR-1.4.6 (Rate Sensitivity Threshold). Bagian di bawah dipertahankan
> sebagai referensi formula dan katalog historis, dengan status
> *adjustment* diperbarui.

Komponen terbesar biaya kendaraan listrik adalah **battery pack**, yang harganya bergerak mengikuti harga bahan baku mineral (nikel, kobalt, lithium). Pemerintah menetapkan **Harga Mineral Acuan (HMA)** melalui Kementerian ESDM sebagai dasar perhitungan **Harga Patokan Mineral (HPM)**. Nilai ini diperbarui berkala dan menjadi rujukan resmi transaksi mineral di Indonesia.

Tanpa mekanisme ini, quotation disusun memakai asumsi harga baterai yang bisa jadi sudah usang beberapa minggu — persis jenis *blind spot* yang menghasilkan margin di bawah target. Namun berdasarkan konfirmasi demo review, **jalur transmisinya ke harga VKTR adalah kurs**, bukan faktor HPM yang berdiri sendiri (lihat catatan revisi di atas).

- **FR-8.1 HMA Master Data (Periodic Input)**
  - Pencatatan HMA per jenis mineral (Nikel, Kobalt, Lithium, dst.) dalam **USD per dry metric ton (dmt)**.
  - Diperbarui **mingguan atau dua mingguan** mengikuti terbitan Kepmen ESDM; setiap nilai memiliki *periode berlaku* dan referensi regulasi.
  - Riwayat lengkap tersimpan — nilai lama tidak ditimpa, sehingga quotation lama tetap dapat direkonstruksi.

- **FR-8.2 HPM Calculator (Formula Kepmen)**

  Sistem menghitung HPM dari HMA memakai formula resmi. Mengacu pada *Kepmen ESDM No. 144.K/2026* untuk nikel dengan komponen mineral ikutan kobalt:

  ```
  CF(Ni)        = 0,30 + ((kadar_Ni − 0,016) × 10)
  Nilai Ni      = kadar_Ni × CF(Ni) × HMA_Ni
  Bonus Co      = kadar_Co × CF(Co) × HMA_Co
  Total kering  = Nilai Ni + Bonus Co            [US$/dmt]
  HPM (basah)   = Total kering × (1 − Moisture Content)   [US$/WMT]
  ```

  - Kadar nikel **1,6%** adalah *anchor* dengan CF **30%**; setiap perubahan 0,1% kadar menyesuaikan CF sebesar 1,0%.
  - Hasil akhir dikalikan `(1 − MC)` untuk memperoleh nilai basah (WMT) yang ditransaksikan di lapangan.
  - Parameter (kadar Co, CF Co, Moisture Content) adalah **master config**, bukan angka *hardcode*.

- **FR-8.3 Global Adjustment saat Penyusunan Quotation — *Status: Dicabut, digantikan FR-1.4.6***

  > **Diperbarui v3.0.** Mekanisme faktor penyesuaian HPM independen di
  > bawah ini **tidak lagi dipakai sebagai jalur adjustment harga**.
  > Demo review mengonfirmasi dampak HMA ke harga VKTR berjalan melalui
  > kurs (FR-1.4.6), sehingga menduplikasi jalur adjustment lewat HPM
  > berisiko menghitung dampak yang sama dua kali. Spesifikasi berikut
  > dipertahankan sebagai referensi bila di kemudian hari ditemukan
  > komponen mineral yang **benar-benar** bergerak independen dari kurs.
  - Saat quotation disusun, sistem membandingkan HPM periode berjalan terhadap **HPM baseline** yang tersimpan pada quotation.
  - Selisihnya menghasilkan **faktor penyesuaian** yang *dapat* diterapkan ke komponen biaya bertanda *mineral-linked* — dalam struktur riil VKTR/BTEL, ini berarti item **FOB Price** (satu-satunya item yang mengandung nilai battery pack, karena unit dibeli sebagai barang jadi, bukan sub-komponen terpisah) — **dinonaktifkan secara default** pada v3.0.
  - Bila diaktifkan, penyesuaian bersifat **global dan otomatis** — dianggap sudah disetujui secara sistem, tidak memerlukan approval terpisah, namun **tetap tercatat di audit trail** beserta nilai HMA/HPM yang dipakai.

- **FR-8.4 Transparansi Dasar Perhitungan (Referensi, bukan Adjustment)**
  - Halaman quotation tetap menampilkan HMA & HPM yang sedang berlaku, periodenya, dan referensi Kepmen — sebagai **konteks informasi pasar mineral**, bukan sebagai dasar faktor pengali otomatis (lihat FR-8.3).
  - Berguna bagi Profitability Owner/BOD untuk menilai kewajaran pergerakan kurs terhadap tren mineral internasional saat meninjau quotation.

- **FR-8.5 Stale Index Warning**
  - Bila HMA terakhir sudah melewati batas kesegaran (mis. > 14 hari), sistem menandai quotation dengan peringatan bahwa dasar harga mineral perlu diperbarui.

---

## 4. High-Level Data & Process Flow

```
[ Master Data CBS Tunggal + COGS Owner ] ─┐
[ Exchange Rate (CNY↔IDR), auto mingguan]─┤
[ Product Master Data ]                  ─┼──> [ Pricing Engine (satu formula) ] ──> [ DSS ]
[ Project/Customer Identifier ]          ─┤              │
[ Workflow Template Catalog ]            ─┘              │
   (dipilih otomatis dari qualifier deal)                │
                                                          ▼
                          [ Quotation Workflow State Machine ]
                          (instance dari Workflow Template terpilih)
                                                          │
              Sales Officer input data customer/unit ─────┤ (tanpa akses COGS)
                                                          ▼
                          ┌─────────────────────┴─────────────────────┐
                          ▼                                           ▼
                  VP Operations validates                    VP Finance validates
                  (COGS, Add-Ons operasional,                (Profitability, margin
                   delivery boleh menyusul)                   policy, OPEX)
                          └─────────────────────┬─────────────────────┘
                                                ▼  (AND-join: semua COGS approved)
                                    [ Chief Sales review & approve ]
                                                │
                                                ▼
                                    [ Quotation Ready to Release ]
                                                │
                          ┌─────────────────────┴─────────────────────┐
                          ▼                                           ▼
              [ Tanpa negosiasi ]                        [ Customer minta diskon ]
                          │                                           │
                          │                    [ Margin-Tier Discount Authority Engine ]
                          │                     Tier 1 Auto / Tier 2 3-Pihak / Tier 3 2-BOD
                          │                                           │
                          └─────────────────────┬─────────────────────┘
                                                ▼
                          [ Final Quotation Released — PDF via Format Template (FR-1.5.3) ]
                                                │
                             (link ke Project Identifier untuk versi berikutnya)
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
| **Multi-Currency** | Nilai asli input disimpan apa adanya beserta mata uang dan kurs yang berlaku saat kalkulasi. Konversi terjadi di lapisan perhitungan, bukan dengan menimpa angka yang diketik pengguna. |
| **Reproducibility Harga** | Setiap hasil kalkulasi menyimpan kurs CNY/IDR (RMB) **dan** HMA/HPM yang dipakai, sehingga harga final selalu dapat direkonstruksi dan dijelaskan saat audit. |
| **UI/UX** | Konsep *modern spreadsheet* agar departemen operasional tetap familiar dalam menginput angka, namun didukung kontrol database yang ketat. |
| **Auditability** | Log perubahan bersifat *immutable* (append-only), mendukung kebutuhan audit sebagai perusahaan Tbk. |
| **Performance** | Kalkulasi *what-if simulation* dan *price calculation* harus real-time (< 2 detik response untuk perubahan slider). |
| **Availability** | Target uptime 99.5% untuk *production environment*, mengingat sistem menjadi gerbang wajib (*mandatory gate*) proses pricing. |

---

## 6. Implementation Phasing Roadmap

| Fase | Fokus Utama | Target Deliverables |
|---|---|---|
| **Phase 1: Core Governance** | Master Data CBS Tunggal + COGS Ownership, Product Master Data, Quotation Workflow (Workflow Template Catalog — minimal 2 varian dasar, paralel VP Operations ∥ VP Finance), Release Gate, Project Identifier & Versioning, SLA Tracking, ERP Integration. | Eliminasi *process bypass* & jaminan validasi COGS lengkap sebelum rilis. |
| **Phase 2: Negotiation & Tracking** | Margin-Tier Commercial Negotiation Engine (3-pihak/2-BOD), Dynamic Workflow Builder (tambah template baru), Format Quotation PDF, Targeted Rejection, Audit Trail, Dashboard Observabilitas, Duplicate/Fraud Guard. | Kepatuhan hierarki wewenang berbasis margin & transparansi status *real-time*. |
| **Phase 3: DSS & Analytics** | What-If Simulation Engine, Margin Guardrails, AI Outlier Detection, Win/Loss Analytics. | Kecepatan dan ketepatan pengambilan keputusan harga oleh manajemen. |

---

## 7. Module → Feature → Task Breakdown (Reference)

Ringkasan hasil pemetaan detail effort (lihat *Timeline & Effort Detail*); pembaruan v3.0 ditandai **baru/direvisi**:

| Module | Fitur Utama |
|---|---|
| Auth & User Management | Login, User Management (CRUD), RBAC/ABAC Permission, Access Audit Log |
| Master Data | Master Cost Item **tunggal** (struktur riil: COGS/Profitability/Sales/Add-Ons) + COGS Owner (+ Import Excel bulk), **Product Master Data & Quotation PDF Template (baru)**, Margin & Financial Factor, **Margin Tier Authority Matrix (direvisi dari Discount Authority Matrix %)**, **Exchange Rate otomatis mingguan + Rate Sensitivity Threshold (direvisi)**, HMA Mineral Index (referensi, bukan adjustment) |
| Dynamic Pricing | CBS Builder (tree, tunggal), Formula Engine (satu formula dasar), **Multi-Currency Input (toggle CNY/IDR, basis FOB — direvisi dari USD)**, Price Calculation (GPM/EBITDA/BEP), Row-Level Versioning, **Project/Customer Identifier & Quotation Linking (baru)**, Export PDF |
| Quotation Approval Workflow | **Workflow Template Catalog & Assignment (baru, menggantikan alur tunggal)**, **Basic Workflow minimal 2 varian: margin-tier & segmen customer (baru)**, **Parallel COGS Validation — VP Operations ∥ VP Finance (AND-join)**, Strict Gatekeeping & Release Gate, Rejection & Routing, Dynamic Form Adjustment, **Duplicate/Fraud Guard harian (baru)** |
| **Commercial Negotiation** | **Margin-Tier Discount Request (Rupiah/%), Tier Evaluation (Auto/3-Pihak/2-BOD), Auto-Escalation Routing, BOD Approve/Reject/Revise, Real-Time Margin Impact (semua direvisi ke basis margin)** |
| State Tracking & Observability | Quotation Lifecycle Dashboard (Kanban+Table, **dikelompokkan per Project Identifier**), SLA Timer & Escalation Notif, Immutable Audit Trail |
| DSS & Simulation | What-If Sensitivity Simulator, Margin Guardrails & Anomaly Detection, Win/Loss Pricing Analytics |
| **Mineral Index** | HMA Master Data (periodik, referensi), HPM Calculator (formula Kepmen), **Global Adjustment Factor (dicabut — digantikan Rate Sensitivity Threshold)**, Stale Index Warning |
| Customer Qualification | Customer KYC Record, Opportunity Assessment, Qualification Gate — **tetap Out of Scope POC** |
| Integrasi Eksternal | ERP Integration (SAP/Odoo), CRM Integration (Salesforce/HubSpot), Notifikasi MS Teams |

Detail task-level effort sizing tersedia di dokumen sumber `[Timeline & Effort] VKTR - Price Core`.

---

## 8. Out of Scope (Asumsi Fase Awal)

- Payment processing / invoicing langsung (tetap di ERP eksisting; PriceCore hanya mengekspor harga final).
- Manajemen inventori fisik BOM (data ditarik read-only dari ERP, bukan dikelola di PriceCore).
- Aplikasi mobile native (fase awal berbasis web responsive).
- **Module 7 (Customer KYC & Opportunity Assessment)** — didokumentasikan sebagai requirement, namun tidak dibangun pada POC. Kualifikasi pelanggan diasumsikan sudah dilakukan di luar sistem; quotation cukup mencatat nama pelanggan sebagai referensi. Dikonfirmasi kembali tetap Out of Scope pada revisi v3.0 meskipun demo review menjelaskan detail proses bisnisnya (lihat catatan di Module 7).
- **Global Adjustment Factor berbasis HPM independen (FR-8.3 versi lama)** — dicabut dari jalur adjustment aktif; HMA/HPM tetap tercatat sebagai referensi (lihat Module 8).
- **Dynamic Formula Builder per lini bisnis (No-Code penuh)** — ditunda; rumus dasar tunggal berlaku untuk semua lini bisnis pada v3.0 (lihat FR-1.2).

---

## 9. Success Metrics

| Metrik | Target |
|---|---|
| Quotation dirilis dengan komponen COGS tidak lengkap | **0 insiden** — dijamin oleh *release gate* (FR-2.2) |
| *Bypass* COGS Owner (VP Operations / VP Finance) | 0 insiden setelah Phase 1 |
| Diskon/margin disetujui di luar tier wewenang | **0 insiden** — dijamin oleh Margin Tier Authority Engine (FR-6.2) |
| *Quotation turnaround time* (end-to-end) | Turun ≥ 40% dibanding proses manual |
| Insiden *margin leakage* (margin final < Tier 3 tanpa persetujuan 2 BOD) | 0 insiden |
| Adopsi *What-If Simulator* / margin impact saat negosiasi | ≥ 80% kasus negosiasi menampilkan dampak margin sebelum keputusan |
| Kesalahan konversi mata uang pada quotation | **0 insiden** — konversi dilakukan sistem, bukan manual |
| Quotation memakai HMA kedaluwarsa (> 14 hari) tanpa peringatan | 0 insiden |
| Quotation ganda (duplicate) untuk customer + tipe unit yang sama dalam sehari | **0 insiden** — dijamin oleh Duplicate/Fraud Guard (FR-2.6) |
| Quotation revisi yang tidak ter-*link* ke Project Identifier asalnya | 0 insiden — dijamin oleh FR-2.5 |
| Akurasi data biaya vs ERP (setelah sinkronisasi) | Selisih < 1% |

---

## 10. References

- `transcribe.md` — **Sumber otoritatif v3.0**: transkrip sesi demo review POC v2.1 bersama Chief Sales, VP Operations, dan VP Finance VKTR; dasar seluruh revisi pada dokumen ini
- `BTEL-CostStructure.xlsx` — **Sumber struktur CBS riil v3.0**: daftar item cost structure aktual VKTR/BTEL (kelompok COGS/Profitability/Sales/Add-Ons), menggantikan daftar item ilustratif pada FR-1.1 versi sebelumnya
- `Commercial Quotation Approval System Requirement for VKTR.pdf` — **Sumber otoritatif v2.0**: SOP quotation, hierarki COGS Owner, dan proses negosiasi berbasis delegated discount authority
- `Simulasi_HPM_Nikel_Kepmen_2026.xlsx` — **Sumber formula HPM v2.1**: struktur perhitungan HMA → HPM nikel dengan komponen kobalt sesuai Kepmen ESDM No. 144.K/2026
- `ConceptDSSpricingVKTR (1).pdf` — Draft PRD v1.0 asli
- `VKTR-PriceCore_Strategic_Pricing_Architecture.pdf` — Ringkasan Aplikasi/Analitik/Impact per modul
- `[Timeline & Effort] VKTR - Price Core - Copy of Detail - VKTR.pdf` — Breakdown modul/fitur/task untuk estimasi effort
- `image (2).png` — Diagram ringkas Applications → Analytics/Visualization → Impact
