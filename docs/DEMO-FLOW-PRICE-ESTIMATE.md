# Demo Flow A — Sales To Obtain Price Estimate (per Unit)

Skrip demo langkah demi langkah untuk **Workflow A** pada sheet *Basic
Workflow* (`docs/BTEL - Cost and Roles and Flow.xlsx`), sesuai build
v4.0 aplikasi. Durasi ± 10 menit.

| Langkah di sheet | Yang terjadi di aplikasi |
|---|---|
| 1. Salesperson mengakses aplikasi — *semua level, termasuk authorized agency* | Login sebagai Authorized Agency, Sales Executive, atau Sales Lead → menu **Price Estimate** |
| 2. Memilih *make, model, type, variant* | Empat dropdown berjenjang; hanya varian dengan cost structure **RELEASED** yang muncul |
| 3a. Varian kendaraan | Deskripsi varian, build type (CKD), titik *loco* |
| 3b. Estimasi harga per unit **excl. & incl. VAT** | Dua angka, dihitung dari cost structure RELEASED — tanpa diskon, 1 unit |
| 3c. Informasi tambahan | Sorotan spesifikasi, inclusions/exclusions, catatan "tidak mengikat" |

Tidak ada approval. Setiap estimasi tercatat (Audit Trail
`PRICE_ESTIMATE`, tabel `price_estimate_log`).

---

## 0. Persiapan

1. Pastikan data demo segar:

   ```bash
   npm run reset:demo
   ```

2. Akun yang dipakai (password semua `PriceCore123!`):

   | Akun | Role | Dipakai untuk |
   |---|---|---|
   | `agency@vktr.demo` | Authorized Agency (eksternal) | Langkah A1–A3 |
   | `sales.exec@vktr.demo` | Sales Executive | Langkah A4 |
   | `admin@vktr.demo` | System Admin | Langkah A5–A6 |
   | `procurement@vktr.demo`, `headproc@vktr.demo` | COGS Owner | Langkah A7 (opsional) |

3. Angka acuan (kurs Rp 2.600/CNY, PPN efektif 11% — ilustratif):

   | Varian | Harga dasar excl. VAT | incl. VAT |
   |---|---|---|
   | LDT 4x2 Short Wheelbase — Dumper, Battery 90 kWh | **Rp 829.550.000** | **Rp 920.800.500** |
   | LDT 4x2 Medium Wheelbase — Aluminium Box, Battery 132 kWh | **Rp 918.675.000** | **Rp 1.019.729.250** |

---

## A1 — Agency hanya melihat Price Estimate

1. Login sebagai **agency@vktr.demo**.
2. **Perhatikan:** aplikasi langsung membuka **Price Estimate**. Sidebar
   hanya berisi satu menu itu.
3. Ketik manual alamat `/proposals` di browser → dialihkan kembali ke
   Price Estimate. Official Quotation adalah *"only internal sales"*
   (sheet Basic Workflow B, langkah 1).

**Yang dibuktikan:** Authorized Agency boleh mengakses langkah 1 Workflow
A, tetapi tidak dapat masuk ke Official Quotation maupun melihat cost
structure.

## A2 — Pilih varian & lihat estimasi

1. Pilih **Make** `VKTR` → **Model** `Light Duty Truck` → **Type**
   `4x2 Short Wheelbase` → **Variant** `Dumper, Battery 90 kWh`.
2. Panel kanan menampilkan:
   - **a.** *VKTR Light Duty Truck 4x2, Short Wheelbase, with Dumper,
     Battery 90 kWh, CKD, loco Magelang*, badge `CKD` dan `loco Magelang`
   - **b.** excl. VAT **Rp 829.550.000** · incl. VAT 11% **Rp 920.800.500**
   - **c.** sorotan spesifikasi (dimensi, baterai CATL LFP 90 kWh, jarak
     tempuh s.d. 120 km, dst.), *Termasuk*: onsite training 2 minggu,
     online training refreshment, on-call technical support; *Tidak
     termasuk (at cost)*: delivery to site, maintenance, other requests
   - catatan kuning: estimasi tidak mengikat; basis harga cost structure
     v1 beserta tanggal rilisnya
3. Buka DevTools → Network: respons server hanya berisi harga excl./incl.
   VAT dan info varian — **tidak ada elemen cost structure**.

## A3 — Varian kedua

1. Ganti **Type** ke `4x2 Medium Wheelbase` → **Variant** `Aluminium Box,
   Battery 132 kWh`.
2. Tampil **Rp 918.675.000** excl. VAT · **Rp 1.019.729.250** incl. VAT.

## A4 — Sales internal memakai fitur yang sama

1. Logout, login sebagai **sales.exec@vktr.demo** → menu **Price
   Estimate**.
2. Pilih varian SWB Dumper → angka sama persis dengan A2.
3. Perhatikan teks di bawah judul: untuk penawaran resmi, pakai menu
   **Official Quotation** (lanjut ke `DEMO-FLOW-OFFICIAL-QUOTATION.md`).

## A5 — Siapa yang boleh memakai Price Estimate diatur di Settings

1. Login sebagai **admin@vktr.demo** → **Settings → Workflow**.
2. Kartu **Price Estimate (per Unit)** menampilkan fungsi yang diizinkan:
   *Salesperson* dan *Authorized Agency*.
3. Nonaktifkan *Authorized Agency (eksternal)* → **Simpan akses**.
4. (Jendela lain) login **agency@vktr.demo** → Price Estimate kini
   menampilkan *"Role Anda tidak memiliki akses Price Estimate"*.
5. Kembali sebagai admin, aktifkan lagi *Authorized Agency* → **Simpan
   akses**.

**Yang dibuktikan:** workflow dari attachment dapat diatur di aplikasi
tanpa ubah kode (PRD FR-2.1).

## A6 — Jejak audit

1. Masih sebagai admin → **Audit Trail**.
2. Terlihat baris `PRICE_ESTIMATE` untuk setiap estimasi pada A2–A4
   (aktor, varian, versi cost structure) dan `SETTINGS_CHANGE` dari A5.

## A7 — (Opsional) Dari mana harganya: Maker → Checker → Releaser

> Langkah ini **mengubah harga dasar varian SWB**. Jalankan
> `npm run reset:demo` sesudahnya sebelum melanjutkan ke demo Official
> Quotation, agar angka di dokumen itu tetap cocok.

1. Login **procurement@vktr.demo** → **Cost Structure** → kartu *LDT 4x2
   SWB Dumper 90 kWh* → **Versi baru**, alasan `Harga aksesori naik` →
   **Buat**.
2. Versi v2 (Draft) terbuka. Keempat scope disalin berstatus **Released**
   dari v1 karena kurs tidak berubah. Pada kartu **COGS** klik **Buka
   untuk perubahan**.
3. Ubah **Accessories** dari `4000000` menjadi `5000000` → **Submit
   (Maker)**. Status COGS: *Menunggu Checker*.
4. Masih sebagai Procurement Manager, tombol **Check** tidak muncul —
   aturan *Maker ≠ Checker* (Settings → Scope Authority → Pemisahan
   tugas).
5. Login **headproc@vktr.demo** → buka v2 → **Check** → **Release**.
   Keempat scope Released → v2 **RELEASED**, v1 **RETIRED**.
6. Login **agency@vktr.demo** → Price Estimate SWB kini **Rp 830.700.000**
   excl. VAT / **Rp 922.077.000** incl. VAT, basis *cost structure v2*.

**Yang dibuktikan:** harga estimasi selalu berasal dari cost structure
yang sudah dirilis pemilik scope-nya (PRD FR-1.1.2); tidak ada angka yang
diketik langsung di Price Estimate.

---

## Ringkasan yang harus terlihat

| Kontrol | Bukti |
|---|---|
| Semua level salesperson + agency dapat mengakses | A1, A4 |
| Pilihan berjenjang make → model → type → variant | A2 |
| Harga per unit excl. & incl. VAT | A2, A3 |
| Tanpa approval, tanpa cost structure di layar/respons | A2 |
| Akses dapat diatur di Settings | A5 |
| Tercatat di Audit Trail | A6 |
| Harga berasal dari cost structure RELEASED (M/C/R) | A7 |
