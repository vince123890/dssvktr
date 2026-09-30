# Skenario Demo 2 — FOB dalam CNY & Rate Sensitivity (v4.0)

> **Status terhadap PRD/Technical Logic v4.0.** Revisi mengikuti
> `BTEL - Cost and Roles and Flow.xlsx`. Perbedaan utama terhadap v3.0:
> FOB Price in CNY kini diinput **di cost structure varian** oleh COGS
> Owner lewat Maker → Checker → Releaser — bukan per quotation oleh VP
> Operations — dan **kurs dikunci per versi cost structure**. Peran,
> tier (15% / 10%), dan alur Official Quotation mengikuti
> [`DEMO-SCENARIO.md`](DEMO-SCENARIO.md).

Skenario ini menunjukkan tiga hal:

1. FOB Price diinput dalam **CNY (Renminbi/Yuan)**, dikonversi otomatis
   ke IDR dengan kurs yang **dikunci** pada versi cost structure.
2. **Rate Sensitivity Threshold** — pergerakan kurs di bawah ambang
   diabaikan; di atas ambang memunculkan banner dan **Release Gate
   menahan** quotation yang belum dihitung ulang.
3. Mengapa ini penting: tanpa ambang, harga tetap memakai kurs lama
   sementara biaya riil naik — GM bisa turun diam-diam ke tier yang
   seharusnya butuh approval.

| | |
|---|---|
| **Varian** | VKTR Light Duty Truck 4x2, Medium Wheelbase, Aluminium Box, Battery 132 kWh, CKD, loco Magelang |
| **Customer** | PT Nusantara Kargo Elektrik *(fiktif)* — B2B Commercial Fleet |
| **Kuantitas** | 12 unit → band ≥ 10, **manual** |
| **Kurs awal / ambang** | Rp 2.600 per CNY / **2%** |
| **PPN** | 11% efektif (ilustratif) |

Peran & akun sama dengan skenario 1 (§0 `DEMO-SCENARIO.md`). Password
semua akun: `PriceCore123!`.

---

## 1. Persiapan — Admin menetapkan kurs & ambang

1. Login sebagai **admin@vktr.demo** → **Settings → Exchange Rate**.
2. **CNY → IDR**: bila kurs berlaku bukan `2600`, simpan `2600` dengan
   `source = manual` (mensimulasikan override sebelum tarik otomatis
   Senin 00:01).
3. **Rate Sensitivity**: `threshold_pct = 2%`.
4. *(Opsional)* **Mineral Index**: HMA `NI` = 16.646 — hanya referensi
   (§8).

---

## 2. Cost Structure v1 dengan FOB dalam CNY

1. **procurement@vktr.demo** (Maker) → Cost Structure → varian *LDT 4x2
   MWB Aluminium Box 132 kWh* → **v1**. Scope **COGS**:

   | Item | Denominasi | Nilai |
   |---|---|---|
   | FOB Price in CNY | **CNY** | **¥ 205.000** |
   | FOB Price in IDR | *otomatis* | Rp 533.000.000 (¥205.000 × 2.600) |
   | Freight and Insurance | IDR | 20.000.000 |
   | Custom Duties | IDR | 27.000.000 |
   | Port Handling, Clearance, and PDI | IDR | 8.000.000 |
   | Carrosserie Allocation (Aluminium Box) | IDR | 78.000.000 |
   | Assembly Cost | IDR | 23.000.000 |
   | Local Parts | IDR | 13.000.000 |
   | Accessories | IDR | 4.500.000 |
   | Telematics | IDR | 3.500.000 |
   | Warehousing and Storage | IDR | 2.000.000 |
   | Warranty Cost | IDR | 18.000.000 |
   | Initial Energy Injection | IDR | 1.500.000 |
   | Administrative Cost | IDR | 3.000.000 |
   | **Total COGS** | | **Rp 734.500.000** |

   Scope **Add-Ons**: STNK 6.000.000 · KEUR 1.500.000 · Insurance
   10.000.000 · Processing Service 2.500.000 · Delivery Service
   **Exclusion — At cost** · Additional 0 → **Rp 20.000.000**.
2. **headproc@vktr.demo** → Check → Release (COGS & Add-Ons).
3. **headfinance@vktr.demo** → scope Margin sama dengan skenario 1 (Rp
   20 jt; 6%; Rp 25 jt; 4%; 5%) → Make/Check/Release.
4. **salesops@vktr.demo** → scope Sales (Rp 4 jt; 0; Rp 2 jt; 0) → Make;
   **headsales@vktr.demo** → Check/Release.

**Yang harus terlihat** (tampilan ganda CNY & IDR, PRD FR-1.4.4):

| | Nilai |
|---|---|
| Kurs terkunci v1 | 2.600 |
| Base cost | Rp 754.500.000 |
| Harga dasar excl. / incl. VAT | Rp 918.675.000 / Rp 1.019.729.250 |
| GM standar | 17,33% |

Angka **¥ 205.000** tersimpan apa adanya; hanya FOB in IDR yang
dihitung.

---

## 3. Official Quotation 12 unit — ditahan di Head of Sales

1. **sales.lead@vktr.demo** membuat Official Quotation: PT Nusantara
   Kargo Elektrik, varian MWB Box × **12**, KYC lengkap (aplikasi box
   logistik, rute gudang Cikarang → hub Jakarta, 2 siklus/hari,
   Likelihood 4). Submit → validasi dilewati (pengaju Sales Lead).
2. **salesops@vktr.demo** (manual, band ≥ 10) → diskon **2%**
   (Rp 18.373.500/unit): harga bersih Rp 900.301.500/unit, GM
   **15,63%**, tier **1**. Teruskan.
3. **headsales@vktr.demo** — **jangan Accept dulu**. Quotation dibiarkan
   di *Pending Head of Sales Review* untuk langkah berikut.

---

## 4. Kurs bergerak di bawah ambang — tidak ada banner

1. **admin@vktr.demo** set kurs **2.635** (naik 1,35% dari 2.600).
2. Buka cost structure v1 (sebagai headproc) dan quotation §3 (sebagai
   headsales): **tidak ada banner**. Harga tetap memakai 2.600.

**Yang didemokan:** PRD FR-1.4.6 — harga tidak "berkedip" pada
pergerakan kecil.

---

## 5. Kurs melewati ambang — banner & Release Gate menahan

1. **admin@vktr.demo** set kurs **2.705** (naik 4,04% dari kurs terkunci
   2.600).
2. Banner muncul di dua tempat:
   - **Cost structure v1** (untuk COGS Owner): *"Kurs CNY/IDR telah
     diperbarui menjadi 2.705 — melebihi ambang sensitivitas 2%. Buat
     versi baru."*
   - **Quotation §3** (untuk Sales Operations & Head of Sales): *"…
     Hitung Ulang diperlukan sebelum rilis."*
3. **headsales@vktr.demo** mencoba **Accept** → Release Gate menolak:
   *"Kurs bergerak melewati ambang — Hitung Ulang dulu"*.

**Kenapa ini penting — tunjukkan di panel dampak margin:** bila harga
tetap dari kurs 2.600 sementara biaya FOB riil sudah dari kurs 2.705,
GM quotation ini sebenarnya **13,23%** — jatuh ke **Tier 2** (butuh
COGS & Profitability Owner), padahal layar lama masih menampilkan
15,63% Tier 1. Tanpa ambang, *margin leakage* ini lolos diam-diam.

---

## 6. COGS Owner membuat Cost Structure v2

1. **procurement@vktr.demo** → pada banner klik **Buat Versi Baru** →
   **v2** dengan kurs terkunci **2.705**. FOB Price in CNY tetap
   **¥ 205.000**; FOB in IDR otomatis **Rp 554.525.000**.
2. Hanya scope **COGS** yang berubah → Make; **headproc@vktr.demo** →
   Check → Release. Scope Add-Ons, Margin, dan Sales disalin dari v1
   berstatus `RELEASED` (tidak perlu M/C/R ulang).
3. v2 **RELEASED**, v1 **RETIRED**.

| | v1 (2.600) | v2 (2.705) |
|---|---|---|
| FOB in IDR | Rp 533.000.000 | Rp 554.525.000 |
| Base cost | Rp 754.500.000 | Rp 776.025.000 |
| Harga dasar excl. VAT | Rp 918.675.000 | Rp 943.428.750 |
| GM standar | 17,33% | 17,22% |

4. **agency@vktr.demo** → Price Estimate varian ini → kini excl. VAT
   Rp 943.428.750 / incl. VAT Rp 1.047.205.913.

---

## 7. Hitung Ulang quotation terbuka → rilis

1. **salesops@vktr.demo** → quotation §3 → **Hitung Ulang**. Line item
   kini mengunci v2; diskon 2% tetap (Rp 18.868.575/unit).

   | | Nilai |
   |---|---|
   | Harga bersih excl. VAT / unit | Rp 924.560.175 |
   | GM | **15,52%** — tetap Tier 1 |
   | 12 unit excl. / incl. VAT | Rp 11.094.722.100 / **Rp 12.315.141.531** |

2. Versi quotation naik; versi lama tetap tersimpan (Rate Locking).
3. **headsales@vktr.demo** → **Accept** → Released → **Preview /
   Print**: dokumen Cost Estimate dengan deskripsi varian MWB Aluminium
   Box 132 kWh dan halaman spesifikasi kolom *Medium Wheelbase*.

---

## 8. Quotation yang sudah rilis tidak dihitung ulang

1. Buka quotation 1 unit dari skenario 1 (varian SWB, kurs 2.600) yang
   sudah **Released** → **tidak ada tombol Hitung Ulang**; harga tetap.
2. Bila perlu harga baru (mis. setelah EXPIRED), lakukan **Permintaan
   Revisi** → quotation baru pada Project Identifier yang sama, dihitung
   dari versi cost structure terbaru.

---

## 9. Mineral Index — referensi saja

1. **admin@vktr.demo** → Mineral Index → HMA `NI` **18.311** (+10%).
2. HPM referensi naik ±60,83 US$/WMT dan tampil di panel referensi cost
   structure & quotation, **tetapi** harga tidak berubah —
   `mineral_adjustment_factor` tetap 1,0. Hanya kurs CNY/IDR yang
   menggerakkan harga (tidak berubah dari v3.0).

---

## 10. Slider FX di DSS

1. **DSS** → pilih quotation §7.
2. Geser **FX Delta** +3% → GM simulasi turun dan panel menampilkan
   **tier yang akan berlaku** — kapan simulasi melewati 15% (Tier 2) atau
   10% (Tier 3).
3. Slider HMA tidak mengubah harga (referensi saja).

---

## 11. Ringkasan Perbandingan Dua Skenario

| | Skenario 1 | Skenario 2 (CNY) |
|---|---|---|
| Varian | LDT 4x2 SWB Dumper 90 kWh | LDT 4x2 MWB Aluminium Box 132 kWh |
| FOB | ¥ 185.000 | ¥ 205.000 |
| Kuantitas | 1 / 4 / 40 | 12 |
| Fitur khas | Settings, M/C/R, Price Estimate, KYC, band, tier 1–3, dokumen & cetak, revisi, Fraud Guard | Kurs terkunci per versi, ambang 2%, Release Gate menahan kurs basi, versi v2 hanya scope COGS |
| Tier | 17,79% → 16,10% → 8,95% → 14,34% → 13,44% | 15,63% → (tersembunyi 13,23%) → 15,52% |

---

## 12. Catatan Batasan & Open Items

- **Seed sudah menyediakan cost structure v1 RELEASED** untuk varian MWB
  dengan angka §2 — langkah §2 menjelaskan asalnya; mulai demo dari §3.
- Pada aplikasi, tombol pembuatan versi ada di kartu varian halaman
  **Cost Structure** (**Versi baru**), tepat di bawah banner kurs.
- **Angka biaya ilustratif** — bukan cost structure riil.
- **Sumber & jenis kurs** (tengah/jual/pajak; API kurs CNY BCA) masih
  perlu dikonfirmasi (Technical Logic §14).
- **Ambang 2%** ilustratif — konfirmasi Corporate Finance.
- **Denominasi item selain FOB** diasumsikan IDR; bila Freight &
  Insurance juga dikutip dalam CNY/USD, item tersebut ikut bergerak
  bersama kurs.
- **Mengganti denominasi item yang sudah bernilai** tidak mengonversi
  nilai lama (PRD FR-1.4.5).
