# Spec: pricing-engine
<!-- As-built per 2026-10-09. Sumber: src/lib/pricing/quotation.ts, currency.ts. Fungsi murni; satu-satunya tempat rumus harga/margin (config.md). -->

## Purpose
Satu set fungsi murni menghitung harga dari Cost Structure untuk semua jalur: rilis cost structure, Price Estimate, Official Quotation, DSS, dan seed. Tidak ada salinan logika margin di tempat lain. Area kritis (uang): perubahan di sini harus disertai tes.

## Requirements

### Requirement: Harga dasar dari cost structure
Sistem SHALL menghitung per unit (IDR): `base_cost` = Σ item COGS + Σ item ADD_ONS; `margin_amount` = base_cost × Σ(persen PROFITABILITY ÷ 100) + Σ nominal PROFITABILITY; `sales_cost` = Σ item SALES; `list_price_ex_vat` = base_cost + margin_amount + sales_cost; `standard_gm` = margin_amount ÷ (base_cost + margin_amount), atau 0 bila penyebut ≤ 0.

#### Scenario: Contoh hitung
- **WHEN** base_cost 100, margin 10% dari base_cost, sales_cost 5
- **THEN** margin_amount = 10, list_price_ex_vat = 115, standard_gm = 10 ÷ 110 = 9,09%

#### Scenario: Item bernilai CNY
- **WHEN** item berdenominasi CNY bernilai 1.000 dengan kurs terkunci 2.600
- **THEN** jumlahnya dalam IDR = 2.600.000
- **AND** item berdenominasi IDR tidak dikonversi

#### Scenario: Item tidak aktif atau turunan
- **WHEN** item `active` = false
- **THEN** item tidak ikut dihitung
- **AND** item turunan (is_derived, mis. FOB Price dalam IDR) hanya ditampilkan senilai total FOB COGS berdenominasi CNY dan tidak menambah total

#### Scenario: Exclusion — At cost
- **WHEN** item ada di himpunan excluded
- **THEN** nilainya dihitung 0

#### Scenario: Tanpa nilai
- **WHEN** item tidak punya nilai
- **THEN** dihitung 0

#### Scenario: Item profitability nominal dalam CNY
- **WHEN** item PROFITABILITY bertipe bukan PERCENTAGE berdenominasi CNY
- **THEN** nilainya dikonversi dengan kurs lalu ditambahkan ke margin_amount sebagai nominal tetap

### Requirement: Diskon dua mode
Sistem SHALL menerima diskon sebagai nominal (AMOUNT) atau persen (PERCENTAGE) dan mengonversi keduanya: persen = nominal ÷ list × 100; nominal = list × persen ÷ 100. Nilai negatif SHALL diperlakukan 0.

#### Scenario: Mode nominal
- **WHEN** list 1.000.000 dan diskon nominal 50.000
- **THEN** persen = 5

#### Scenario: Mode persen
- **WHEN** list 1.000.000 dan diskon 5%
- **THEN** nominal = 50.000

#### Scenario: List nol
- **WHEN** list_price = 0 pada mode AMOUNT
- **THEN** persen = 0 (tanpa pembagian nol)

#### Scenario: Diskon negatif
- **WHEN** diskon -100
- **THEN** diperlakukan 0

### Requirement: Harga dan GM per baris
Sistem SHALL menghitung `net_ex_vat` = list − diskon; `net_incl_vat` = net_ex_vat × (1 + PPN% ÷ 100); total baris = net × kuantitas dari harga tak dibulatkan; dan `gm` = (net − sales_cost − base_cost) ÷ (net − sales_cost), atau −1 bila (net − sales_cost) ≤ 0. GM SHALL selalu diukur atas harga excl. VAT setelah diskon, sales cost diperlakukan pass-through.

#### Scenario: Contoh dengan diskon
- **WHEN** list 115, base_cost 100, sales_cost 5, diskon 5%, PPN 11%, kuantitas 40
- **THEN** net_ex_vat = 109,25; net_incl_vat = 121,2675; total ex VAT = 4.370
- **AND** gm = (109,25 − 5 − 100) ÷ (109,25 − 5) = 4,08%

#### Scenario: Harga di bawah sales cost
- **WHEN** net ≤ sales_cost
- **THEN** gm = −1

### Requirement: GM tertimbang lintas baris
Sistem SHALL menghitung GM quotation = Σ((net − sales − base) × qty) ÷ Σ((net − sales) × qty), atau −1 bila penyebut ≤ 0.

#### Scenario: Dua varian
- **WHEN** baris A (qty 10, net 100, sales 0, base 90) dan baris B (qty 10, net 200, sales 0, base 160)
- **THEN** GM = (100 + 400) ÷ 3.000 = 16,67%

### Requirement: Resolusi tier margin
Sistem SHALL memilih tier pertama (urut nomor tier) yang interval GM-nya [lower, upper) memuat GM dalam persen, dengan batas null berarti tak terbatas. Bila tidak ada yang cocok SHALL jatuh ke tier terakhir (paling ketat); bila tangga kosong SHALL mengembalikan null.

#### Scenario: Batas tepat
- **WHEN** tier 1 = [15, ∞), tier 2 = [10, 15), tier 3 = (−∞, 10) dan GM = 15,00
- **THEN** tier 1

#### Scenario: Di bawah semua batas
- **WHEN** GM = −1 dan tidak ada tier yang memuat
- **THEN** tier terakhir

### Requirement: Resolusi quantity band
Sistem SHALL memilih band dengan min_qty ≤ qty ≤ max_qty (max null = tak terbatas) menurut urutan band, dan mode proses quotation SHALL mengikuti mode paling manual dari semua baris (AUTO < AUTO_WITH_MANUAL < MANUAL).

#### Scenario: Campuran band
- **WHEN** satu baris band AUTO dan satu baris MANUAL
- **THEN** mode proses quotation = MANUAL

#### Scenario: Kuantitas di luar semua band
- **WHEN** tidak ada band yang cocok
- **THEN** resolveBand mengembalikan null

### Requirement: Kurs CNY→IDR yang berlaku
Sistem SHALL memakai kurs baris `exchange_rate` (CNY→IDR) dengan `effective_from` terbaru yang belum melewati waktu acuan, dan mengembalikan null bila tidak ada.

#### Scenario: Kurs terbaru
- **WHEN** ada kurs 2.500 (kemarin) dan 2.600 (hari ini)
- **THEN** kurs yang berlaku = 2.600

#### Scenario: Kurs masa depan
- **WHEN** satu-satunya kurs berlaku mulai besok
- **THEN** hasil null

## Catatan as-built
- Nilai yang diketik disimpan apa adanya dan dikonversi hanya saat menghitung (nilai CNY tidak ditimpa).
- Pembulatan hanya di tampilan; total memakai harga tak dibulatkan (sesuai contoh Cost Estimate 40 × 35.309.397 = 1.412.375.872).
- Sales cost diperlakukan pass-through terhadap GM, menunggu konfirmasi Corporate Finance (Technical Logic §14 no. 9).
- Skema RENTAL: baris menyimpan tenor dan cicilan bulanan, tetapi formula rental menunggu VKTR (Technical Logic §3.5); belum ada perhitungan.
- Belum ada tes otomatis; contoh angka di atas adalah kandidat tes unit pertama.
