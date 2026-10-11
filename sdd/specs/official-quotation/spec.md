# Spec: official-quotation
<!-- As-built per 2026-10-09. Sumber: src/lib/workflow/quotationEngine.ts, src/app/(app)/proposals/**, duplicateGuard.ts, projectIdentifier.ts, proposalNumber.ts. Rumus: sdd/specs/pricing-engine. Pemilihan template: sdd/specs/workflow-template-catalog. -->

## Purpose
Workflow B (Basic Workflow VKTR): Sales Executive/Sales Lead mengisi KYC dan varian, lalu quotation divalidasi, di-generate Sales Operations per quantity band, direview Head of Sales, dirutekan menurut tier margin, dan dirilis sebagai dokumen resmi. Seluruh aturan berjalan di server; UI hanya mencerminkan.

## Status
DRAFT → PENDING_SALES_LEAD_VALIDATION → PENDING_SALES_OPERATIONS → PENDING_HEAD_OF_SALES_REVIEW → (PENDING_OWNER_APPROVAL | PENDING_PRICING_COMMITTEE_APPROVAL) → QUOTATION_RELEASED → EXPIRED | SUPERSEDED. Status tambahan: PENDING_ADDITIONAL_APPROVAL (langkah template ekstra), CONFIG_ERROR. Label status tiap langkah berasal dari definisi langkah template.

## Requirements

### Requirement: Pengajuan draft (KYC dan varian)
Sistem SHALL membuat quotation DRAFT hanya oleh role berfungsi SALESPERSON, dengan KYC lengkap dan minimal satu varian berkuantitas bulat ≥ 1. Nomor proposal SHALL berformat `PRC-<tahun>-<seq 4 digit>` dengan seq = nomor tertinggi tahun itu + 1.

#### Scenario: Draft valid
- **WHEN** Sales Executive mengisi semua field wajib dan satu baris varian lalu menyimpan
- **THEN** pricing_proposal berstatus DRAFT dengan judul "<total unit> Unit — <perusahaan>", versi v1.0 aktif, dan `account_person_ids` = [pengaju]
- **AND** audit log CREATE mencatat nomor proposal, perusahaan, dan jumlah baris
- **AND** kurs input = CNY

#### Scenario: KYC tidak lengkap
- **WHEN** field wajib kosong atau di bawah batas (nama perusahaan < 2, alamat < 5 karakter, production_value ≤ 0, likelihood di luar 1–5, segmen/industri/hubungan kosong, dll.)
- **THEN** penyimpanan ditolak dengan pesan semua isu yang digabung " · " dan tidak ada data dibuat

#### Scenario: Role bukan salesperson
- **WHEN** role tanpa fungsi SALESPERSON membuat quotation
- **THEN** gagal "Official Quotation hanya dapat diajukan oleh sales internal (Sales Executive / Sales Lead)."

#### Scenario: Proyek baru vs berjalan
- **WHEN** project_type NEW_PROJECT
- **THEN** sistem membuat Project Identifier `PRJ-<customer 12>-<proyek 12>-<tahun>-<seq 3 digit>` (huruf besar, tanpa aksen)
- **WHEN** project_type ADDITIONAL_RUNNING_PROJECT atau REPLACEMENT tanpa memilih identifier berjalan
- **THEN** gagal "c. Pilih Project Identifier proyek berjalan yang ditambah/diganti."

#### Scenario: Ubah draft
- **WHEN** pengaju mengubah quotation berstatus DRAFT
- **THEN** KYC dan baris varian diganti seluruhnya dan audit log UPDATE tercatat
- **AND** selain DRAFT, atau oleh selain pengaju, ditolak ("Hanya quotation DRAFT yang dapat diubah." / "Hanya pengaju yang dapat mengubah draft ini.")

### Requirement: Penjaga duplikat / fraud
Sistem SHALL membatasi satu salesperson pada `fraud_guard_max_per_day` (default 1) quotation baru per hari untuk customer (nama perusahaan sama persis) dan varian yang sama. Revisi dikecualikan. Kegagalan query penjaga SHALL tidak memblokir pekerjaan.

#### Scenario: Melebihi batas
- **WHEN** salesperson membuat quotation ke-(N+1) hari ini untuk customer dan varian yang sama
- **THEN** ditolak "Batas quotation harian … sudah tercapai …"
- **AND** audit log BLOCKED_DUPLICATE_ATTEMPT tercatat

#### Scenario: Varian berbeda
- **WHEN** customer sama tetapi varian tidak beririsan
- **THEN** diizinkan

### Requirement: Submit dan pemilihan workflow
Sistem SHALL men-submit hanya DRAFT milik pengaju yang punya minimal satu baris dan semua variannya punya cost structure RELEASED; memilih Workflow Template aktif untuk deal (segmen, industri, hubungan, lini bisnis, total kuantitas, estimasi nilai = Σ harga dasar × qty, status blacklist); menyalin definisi langkah ke instance; lalu membuka langkah pertama.

#### Scenario: Submit berhasil
- **WHEN** pengaju men-submit DRAFT valid
- **THEN** workflow_instance RUNNING dibuat dengan salinan langkah dan quotation mencatat template, alasan pemilihan, estimasi nilai, dan flag blacklist
- **AND** audit log SUBMIT memuat nama dan versi template serta alasan pemilihan

#### Scenario: Pengaju Sales Lead
- **WHEN** langkah validasi memiliki `skip_if_initiator_function` yang dimiliki role pengaju
- **THEN** langkah berstatus SKIPPED_NOT_APPLICABLE ("Dilewati — pengaju memiliki wewenang validasi sendiri.") dan audit STEP_SKIPPED, lalu langkah berikutnya terbuka

#### Scenario: Varian tanpa cost structure RELEASED
- **WHEN** salah satu varian belum punya versi RELEASED
- **THEN** submit gagal "Ada varian tanpa cost structure RELEASED — tidak dapat disubmit."

#### Scenario: Tidak ada template aktif
- **WHEN** tidak ada template aktif yang cocok maupun fallback
- **THEN** status menjadi CONFIG_ERROR dan submit gagal

#### Scenario: Template tanpa langkah Generate
- **WHEN** template terpilih tidak memiliki langkah GENERATE_QUOTATION
- **THEN** submit gagal "Workflow Template tidak memiliki langkah Generate (Sales Operations)."

#### Scenario: Bukan DRAFT atau bukan pengaju
- **WHEN** status bukan DRAFT atau pengguna bukan pengaju
- **THEN** gagal ("Hanya quotation DRAFT yang dapat disubmit." / "Hanya pengaju yang dapat submit quotation ini.")

#### Scenario: Revisi tanpa perubahan
- **WHEN** quotation hasil revisi di-submit dengan KYC dan pasangan (varian, kuantitas) sama dengan pendahulunya
- **THEN** langkah VALIDATE dilewati ("Dilewati — revisi tanpa perubahan KYC/varian.")

### Requirement: Langkah validasi/persetujuan
Sistem SHALL memproses keputusan APPROVE/REJECT pada langkah aktif berjenis VALIDATE atau APPROVE hanya oleh role yang memiliki `performer_function` langkah itu.

#### Scenario: Setuju
- **WHEN** Sales Lead menyetujui langkah validasi
- **THEN** langkah APPROVED dengan aktor dan catatan, audit VALIDATE, dan langkah berikutnya terbuka

#### Scenario: Tolak tanpa catatan
- **WHEN** keputusan REJECT dengan catatan kosong
- **THEN** gagal "Catatan wajib diisi saat menolak."

#### Scenario: Tolak dengan tujuan default
- **WHEN** langkah ditolak dan tidak punya `reject_to_step_order` ke langkah Generate
- **THEN** instance REJECTED dan quotation kembali DRAFT dengan KYC utuh

#### Scenario: Tolak ke Sales Operations
- **WHEN** `reject_to_step_order` menunjuk langkah GENERATE_QUOTATION
- **THEN** langkah Generate dibuka ulang dengan catatan dan semua langkah sesudahnya di-reset ke PENDING

#### Scenario: Bukan pelaksana
- **WHEN** role tanpa `performer_function` langkah mengambil keputusan
- **THEN** gagal "Role Anda bukan pelaksana langkah ini."

### Requirement: Generate oleh Sales Operations
Saat langkah GENERATE_QUOTATION terbuka, sistem SHALL menghitung harga setiap baris dari cost structure RELEASED terbaru, menetapkan quantity band dan mode proses, dan menerapkan diskon default band pada baris yang belum diedit manual (mode MANUAL berdiskon 0). Bila mode proses AUTO (band 1 unit), langkah SHALL selesai otomatis ("Auto-generated — band 1 unit, harga dasar.").

#### Scenario: Mode AUTO
- **WHEN** quotation 1 unit di-generate
- **THEN** langkah Generate APPROVED otomatis dan langkah berikutnya terbuka tanpa tindakan Sales Operations
- **AND** audit GENERATE mencatat mode

#### Scenario: Mode bukan AUTO
- **WHEN** band memerlukan pemrosesan manual
- **THEN** langkah tetap IN_PROGRESS menunggu Sales Operations

#### Scenario: Varian tanpa cost structure RELEASED saat generate
- **WHEN** salah satu varian tidak punya versi RELEASED
- **THEN** perhitungan gagal "Cost structure untuk varian "<nama>" belum RELEASED — COGS/Profitability/Sales Owner harus merilisnya dulu."

#### Scenario: Quotation tanpa baris
- **WHEN** quotation tidak punya baris
- **THEN** gagal "Quotation belum memiliki varian kendaraan."

### Requirement: Mengubah harga
Sistem SHALL mengizinkan perubahan diskon (nominal atau persen), skema, serta teks inklusi/eksklusi/catatan khusus hanya oleh pelaksana langkah GENERATE_QUOTATION atau REVIEW_AND_ROUTE yang sedang aktif, dengan sumber diskon SALES_OPS_MANUAL atau HEAD_OF_SALES_REVISE, dan menghitung ulang GM dan tier.

#### Scenario: Sales Operations mengubah diskon
- **WHEN** Sales Operations menyimpan diskon 5% pada satu baris
- **THEN** net, total, GM, dan tier dihitung ulang dan disimpan; audit UPDATE memuat GM dan tier

#### Scenario: Head of Sales merevisi
- **WHEN** Head of Sales menyimpan perubahan pada langkah review
- **THEN** sumber diskon = HEAD_OF_SALES_REVISE dan audit REVISE

#### Scenario: Diskon tidak valid
- **WHEN** diskon negatif atau NaN
- **THEN** gagal "Nilai diskon tidak valid."

#### Scenario: Bukan pelaksana atau bukan langkah harga
- **WHEN** role lain atau langkah lain mencoba
- **THEN** gagal "Harga hanya dapat diubah oleh Sales Operations (generate) atau Head of Sales (revise)."

### Requirement: Hitung Ulang
Sistem SHALL memungkinkan pelaksana langkah Generate/Review memilih ulang cost structure RELEASED terbaru untuk semua baris tanpa menimpa diskon default.

#### Scenario: Setelah cost structure baru dirilis
- **WHEN** Sales Operations menekan Hitung Ulang
- **THEN** tiap baris memakai versi dan kurs terkunci terbaru, GM/tier dihitung ulang, audit RECALCULATE

### Requirement: Teruskan ke Head of Sales
Sistem SHALL meneruskan quotation dari langkah Generate ke langkah berikutnya hanya oleh Sales Operations, mencatat `prepared_by`.

#### Scenario: Teruskan
- **WHEN** Sales Operations meneruskan
- **THEN** langkah Generate APPROVED dan langkah review terbuka

#### Scenario: Bukan Sales Operations
- **WHEN** role lain mencoba
- **THEN** gagal "Hanya Sales Operations pada langkah Generate yang dapat meneruskan."

### Requirement: Keputusan review Head of Sales
Pada langkah REVIEW_AND_ROUTE, Head of Sales SHALL dapat ACCEPT (lanjut routing tier) atau RETURN ke Sales Operations dengan catatan wajib.

#### Scenario: Return
- **WHEN** RETURN dengan catatan
- **THEN** langkah REJECTED, audit RETURN, Generate dibuka ulang

#### Scenario: Return tanpa catatan
- **WHEN** catatan kosong
- **THEN** gagal "Catatan wajib diisi saat mengembalikan ke Sales Operations."

#### Scenario: Accept tetapi release gate gagal pada Tier 1
- **WHEN** routing langsung merilis namun release gate menolak
- **THEN** langkah review dikembalikan ke IN_PROGRESS dan error alasan gate ditampilkan

### Requirement: Routing tier margin
Setelah ACCEPT, sistem SHALL menentukan tier dari GM tertimbang dengan tangga tier milik template (bila ada), lalu tangga lini bisnis, lalu tangga global. Bila semua slot keputusan tier dipenuhi oleh aktor yang meng-ACCEPT (atau tidak ada slot), quotation SHALL langsung dirilis. Selain itu sistem SHALL membuka satu baris DECISION per slot (AND-join) dan baris CC (tembusan, otomatis tercatat) pada putaran baru, mem-void putaran sebelumnya.

#### Scenario: GM ≥ 15% (Tier 1)
- **WHEN** GM 16% dan tier 1 tanpa slot keputusan
- **THEN** quotation langsung QUOTATION_RELEASED

#### Scenario: GM 12% (Tier 2)
- **WHEN** GM 12% dan tier 2 (seed) memiliki slot COGS_OWNER dan PROFITABILITY_OWNER
- **THEN** status PENDING_OWNER_APPROVAL, `tier_round` bertambah 1, dan dua baris DECISION dibuat; keduanya harus APPROVE (AND-join)
- **AND** audit TIER_ROUTE memuat GM, tier, dan slot yang ditunggu

#### Scenario: Tier 3 butuh dua orang
- **WHEN** slot keputusan "role:CCO" dan "role:CFO" (seed tier 3, tembusan COGS_OWNER dan PROFITABILITY_OWNER)
- **THEN** status PENDING_PRICING_COMMITTEE_APPROVAL dan masing-masing slot hanya dapat diisi role CCO dan CFO
- **AND** baris CC dibuat langsung berstatus tercatat (`decided_at` terisi) dan audit TIER_CC mencatat tembusan

#### Scenario: Tangga belum dikonfigurasi
- **WHEN** tidak ada tier yang dapat ditentukan
- **THEN** gagal "Margin Tier Authority belum dikonfigurasi (CONFIG_ERROR)."

### Requirement: Keputusan tier
Sistem SHALL menerima APPROVE/REJECT pada slot tier yang menunggu dan cocok dengan aktor, satu orang hanya mengisi satu slot per putaran. Semua slot DECISION APPROVE SHALL merilis quotation; satu REJECT SHALL mem-void putaran dan mengembalikan ke Sales Operations.

#### Scenario: Semua setuju
- **WHEN** slot terakhir di-APPROVE
- **THEN** quotation dirilis dan audit APPROVE/RELEASE tercatat

#### Scenario: Satu menolak
- **WHEN** salah satu slot REJECT dengan catatan
- **THEN** semua baris putaran di-void dan Generate dibuka ulang dengan catatan "Ditolak pada Tier <n>: <catatan>"

#### Scenario: Orang yang sama dua slot
- **WHEN** aktor yang sudah memutus mencoba memutus lagi
- **THEN** gagal "Anda sudah memberi keputusan pada putaran ini — satu orang mengisi satu slot."

#### Scenario: Tidak ada slot untuk aktor
- **WHEN** tidak ada slot menunggu yang cocok
- **THEN** gagal "Tidak ada slot persetujuan tier yang menunggu keputusan Anda."

#### Scenario: Bukan status tier
- **WHEN** status bukan PENDING_OWNER_APPROVAL/PENDING_PRICING_COMMITTEE_APPROVAL
- **THEN** gagal "Quotation tidak sedang menunggu persetujuan tier."

### Requirement: Release gate
Sebelum rilis, sistem SHALL memeriksa: ada baris; setiap baris punya versi cost structure; setiap item non-turunan yang `may_follow_later` bernilai atau dinyatakan "Exclusion — At cost"; setiap item mandatory bernilai (≠ 0); kurs aktif tidak bergerak lebih dari ambang rate sensitivity (default 2%) dari kurs terkunci baris; dan untuk tier > 1, semua baris DECISION putaran saat ini APPROVE.

#### Scenario: Kurs bergerak melewati ambang
- **WHEN** kurs terkunci 2.600 dan kurs aktif 2.700 (3,85% > 2%)
- **THEN** rilis ditolak "Kurs CNY/IDR bergerak melewati ambang 2% sejak cost structure dikunci — Hitung Ulang dulu."

#### Scenario: Komponen mandatory kosong
- **WHEN** item mandatory bernilai 0 pada versi cost structure baris
- **THEN** rilis ditolak "Komponen mandatory belum bernilai: <nama>."

#### Scenario: Item may_follow_later
- **WHEN** item belum bernilai dan tidak di-exclude
- **THEN** rilis ditolak "<nama> harus dinilai atau dinyatakan "Exclusion — At cost"."

#### Scenario: Tier belum lengkap
- **WHEN** tier > 1 dan ada slot belum APPROVE
- **THEN** rilis ditolak "Tier <n> belum disetujui lengkap (AND-join)."

#### Scenario: Peringatan kurs di halaman
- **WHEN** quotation dalam proses (bukan DRAFT/RELEASED/EXPIRED/SUPERSEDED/REJECTED) dan kurs bergerak melewati ambang
- **THEN** banner peringatan tampil menjelaskan alurnya (COGS Owner merilis versi baru, lalu Hitung Ulang) dan bahwa Release Gate menahan rilis

### Requirement: Rilis dokumen
Saat rilis, sistem SHALL memberi nomor dokumen sesuai pola Settings (default `{seq}/L/VKTR/{scheme}-{unit}/{MM}-{YYYY}`, seq = nomor tertinggi bulan itu + 1, 4 digit; scheme RNT bila ada baris RENTAL, selain itu PUR), mengisi masa berlaku = tanggal rilis + `quotationValidityDays` (default 30), menyelesaikan instance, dan menandai quotation pendahulu (`supersedes_proposal_id`) sebagai SUPERSEDED.

#### Scenario: Rilis pertama bulan ini
- **WHEN** rilis di Oktober 2026 dan belum ada nomor bulan itu
- **THEN** nomor dokumen berawalan 0001 dan berakhiran `/10-2026`
- **AND** `valid_until` = hari ini + 30 hari

#### Scenario: Revisi dirilis
- **WHEN** revisi dirilis
- **THEN** pendahulu menjadi SUPERSEDED dengan audit SUPERSEDE yang menyebut nomor revisi dan dokumen

#### Scenario: Retry rilis
- **WHEN** semua putaran tier sudah APPROVE tetapi rilis gagal (mis. kurs basi) dan Head of Sales memicu ulang
- **THEN** rilis dicoba lagi; role selain SALES_RELEASER ditolak "Hanya Head of Sales yang dapat merilis."

### Requirement: Kedaluwarsa
Sistem SHALL mengubah quotation QUOTATION_RELEASED dengan outcome PENDING dan `valid_until` lebih awal dari hari ini menjadi EXPIRED saat daftar quotation atau detailnya dibuka, dengan audit EXPIRE.

#### Scenario: Lewat masa berlaku
- **WHEN** daftar quotation dibuka sesudah tanggal berlaku
- **THEN** quotation EXPIRED dan audit EXPIRE "Masa berlaku … habis — perpanjang lewat revisi."

#### Scenario: Sudah WON
- **WHEN** outcome WON
- **THEN** quotation tidak diubah menjadi EXPIRED

### Requirement: Hasil dan revisi pasca-rilis
Sistem SHALL mencatat hasil WON/LOST pada quotation QUOTATION_RELEASED oleh SALESPERSON, SALES_RELEASER, atau SYSTEM_ADMIN, dan membuat revisi (quotation baru pada Project Identifier yang sama) dari quotation RELEASED atau EXPIRED oleh SALESPERSON dengan alasan wajib.

#### Scenario: Catat hasil
- **WHEN** salesperson mencatat WON dengan URL dokumen penerimaan
- **THEN** outcome WON dan URL tersimpan; audit UPDATE memuat perubahan outcome

#### Scenario: Hasil bukan untuk status lain
- **WHEN** status bukan QUOTATION_RELEASED
- **THEN** gagal "Hasil hanya dicatat untuk quotation yang masih berlaku (Released)."

#### Scenario: Revisi
- **WHEN** salesperson membuat revisi dengan alasan
- **THEN** quotation DRAFT baru dengan nomor proposal baru, `supersedes_proposal_id` = asal, KYC/baris/teks dan diskon negosiasi disalin sebagai titik awal
- **AND** audit CREATE "Revisi dari <nomor>: <alasan>"

#### Scenario: Revisi ditolak
- **WHEN** alasan kosong, status bukan RELEASED/EXPIRED, atau pengguna bukan salesperson
- **THEN** gagal dengan pesan masing-masing ("Isi alasan/permintaan pelanggan." dsb.)

### Requirement: Visibilitas baris quotation
Sistem SHALL menampilkan semua quotation kepada role SALES_OPERATIONS, SALES_RELEASER, COGS_OWNER, PROFITABILITY_OWNER, PRICING_COMMITTEE, SYSTEM_ADMIN; kepada salesperson hanya yang mereka buat atau yang menjadikan mereka account person; dan kepada SALES_VALIDATOR tambahan quotation dari role salesperson yang tidak berwenang validasi. Aksi pada quotation tak terlihat SHALL menjawab "Quotation tidak ditemukan." GM, tier, dan struktur biaya SHALL hanya tampil bagi role yang boleh melihat cost structure; harga incl. VAT bagi role lain hanya setelah RELEASED.

#### Scenario: Salesperson lain
- **WHEN** Sales Executive A membuka quotation milik Sales Executive B
- **THEN** quotation tidak muncul di daftar dan aksi apa pun gagal "Quotation tidak ditemukan."

## Catatan as-built
- Banyak operasi (submit, advance, price, release) berupa rangkaian update tanpa transaksi; kegagalan tengah jalan dapat meninggalkan state parsial. `releaseQuotation` memeriksa gate sebelum menulis, tetapi tidak atomik.
- Penomoran proposal dan dokumen berbasis "nomor tertinggi + 1" tanpa kunci; dua rilis serentak dapat bentrok pada batasan unik.
- `checkReleaseGate` memuat versi dan baris cost structure per baris quotation secara berurutan (N+1).
- Pencocokan nama customer untuk penjaga duplikat adalah kesamaan persis (peka huruf besar/kecil).
- Status v3.0 (PENDING_COGS_VALIDATION, PENDING_CHIEF_SALES_REVIEW, PENDING_BOD_APPROVAL) masih ada di enum, tidak lagi dihasilkan.
- Rental: skema dan field tersimpan, tanpa formula (lihat pricing-engine).
- Belum ada tes otomatis; skenario demo di docs/DEMO-FLOW-OFFICIAL-QUOTATION.md adalah satu-satunya verifikasi.

## Perubahan v5.0 (dikodekan 2026-10-11; migrasi 0018–0019 belum diverifikasi di database)
<!-- Sumber: docs/kebutuhan_baru_v2.md dan tanggapan lanjutan, PRD v5.0 (FR-2.9, FR-2.10, FR-2.11, FR-3.4, FR-6.0, FR-9.1), Technical Logic v5.0 §4.11, §4.13, §4.14, §4.17. Bagian di atas tetap menjelaskan perilaku saat ini. -->

### Tanpa perubahan kode
- Alur Submit sampai approval tier tidak berubah. Yang berubah adalah **konfigurasi**: hanya template `OQ-STANDARD` aktif dengan langkah Generate + Review & Rilis, semua quantity band bermode AUTO dengan diskon default 0%, langkah Validasi Sales Lead dihapus (lihat workflow-template-catalog dan settings-configuration). Akibatnya Generate selesai otomatis dan satu-satunya antrean manusia sebelum tier adalah Head of Sales.
- Routing tier, Release Gate, dan Revisi **tidak berubah**. Rilis awal harga standar jatuh ke Tier 1.
- Expired otomatis (requirement "Kedaluwarsa" di atas) **dipertahankan**.

### Requirement: Approval final → dokumen bertanda tangan → Released
Setelah routing tier dan Release Gate lolos, sistem SHALL menetapkan nomor dokumen, tanggal dokumen, dan `valid_until`, lalu mengubah status menjadi PENDING_SIGNED_DOCUMENT ("Menunggu dokumen bertanda tangan") alih-alih langsung QUOTATION_RELEASED. Salesperson pengaju (account person) atau Admin SHALL mengunggah lampiran dokumen yang sudah ditandatangani Head of Sales; unggahan itu SHALL mengubah status menjadi QUOTATION_RELEASED dan mengisi `released_at`.

#### Scenario: Approval final harga standar
- **WHEN** Head of Sales meng-ACCEPT quotation Tier 1 dan Release Gate lolos
- **THEN** status PENDING_SIGNED_DOCUMENT, `document_number/document_date/valid_until` terisi, audit APPROVE tercatat
- **AND** quotation belum dihitung terkirim dan dokumen belum berstatus "siap dikirim ke pelanggan"

#### Scenario: Lampiran diunggah
- **WHEN** salesperson pengaju mengunggah PDF/PNG/JPG bertanda tangan
- **THEN** status QUOTATION_RELEASED, `released_at` = saat unggah, lampiran tersimpan, audit RELEASE tercatat
- **AND** quotation pendahulu (revisi) menjadi SUPERSEDED pada saat ini

#### Scenario: Bukan pengaju
- **WHEN** Head of Sales, approver tier, atau salesperson lain mencoba mengunggah
- **THEN** ditolak

#### Scenario: Perubahan setelah approval
- **WHEN** harga/diskon diubah atau approval dibatalkan sebelum lampiran diunggah
- **THEN** approval final dibatalkan dan status kembali ke PENDING_HEAD_OF_SALES_REVIEW

### Requirement: Won/Lost manual; Expired otomatis dengan override Admin
Salesperson (pemilik/account person), SALES_RELEASER, atau SYSTEM_ADMIN SHALL menyatakan **WON** atau **LOST** pada quotation QUOTATION_RELEASED (aturan as-built dipertahankan). Expired SHALL tetap otomatis seperti requirement "Kedaluwarsa"; SYSTEM_ADMIN SHALL dapat menyatakan atau membatalkan Expired secara manual dengan alasan, tercatat di audit. Quotation WON tidak dapat di-Expired.

#### Scenario: Won butuh bukti PO
- **WHEN** salesperson menyatakan WON tanpa mengunggah bukti PO
- **THEN** ditolak "Bukti PO wajib diunggah."
- **AND** dengan PO valid: outcome WON, `po_number/po_document_url/po_received_at` tersimpan, satu Project dibuat (lihat project-payment-tracking)

#### Scenario: Lost butuh alasan
- **WHEN** hasil LOST dinyatakan tanpa alasan
- **THEN** ditolak

#### Scenario: Admin menyatakan Expired lebih awal
- **WHEN** Admin menyatakan EXPIRED pada quotation Released sebelum `valid_until` dengan alasan
- **THEN** status EXPIRED, `expired_override_*` terisi, audit UPDATE tercatat

#### Scenario: Admin membatalkan Expired
- **WHEN** Admin membatalkan Expired dan memberi `valid_until` baru
- **THEN** status kembali QUOTATION_RELEASED; tanpa `valid_until` baru ditolak (agar tidak segera di-Expired ulang)

#### Scenario: Non-admin mencoba override Expired
- **WHEN** salesperson mencoba mengubah status Expired
- **THEN** ditolak

### Requirement: Status berwarna dari tanggal rilis
Sistem SHALL menurunkan kondisi tampilan quotation Released tanpa hasil dari umur sejak `released_at`: hijau (< 14 hari), kuning (≥ 14 hari), merah (≥ 30 hari). Won menghentikan penghitungan; Lost dan Expired tampil merah. Ambang adalah setelan (default 14 dan 30).

#### Scenario: Batas hari
- **WHEN** rilis 14 hari lalu tanpa hasil
- **THEN** kondisi kuning; 30 hari lalu → merah; 13 hari → hijau

#### Scenario: Sudah Won
- **WHEN** outcome WON
- **THEN** kondisi WON, tidak kuning/merah meskipun umur > 30 hari

### Requirement: Diskon oleh salesperson pada draft Revisi
Sistem SHALL mengizinkan salesperson pengaju mengubah diskon (Rp/%) pada quotation berstatus DRAFT yang merupakan revisi (`supersedes_proposal_id` terisi), dengan sumber diskon `SALESPERSON_REVISION`. Draft awal (bukan revisi) SHALL tetap harga standar dan tidak dapat diberi diskon oleh salesperson. Diskon tetap melewati routing tier. Salesperson SHALL tidak menerima GM, tier, atau cost structure.

#### Scenario: Revisi dengan diskon
- **WHEN** salesperson pengaju menyimpan diskon 5% pada draft revisi lalu submit
- **THEN** harga dihitung ulang, sumber diskon SALESPERSON_REVISION, audit UPDATE; routing tier dihitung dari GM setelah diskon

#### Scenario: Draft awal
- **WHEN** salesperson mencoba mengubah diskon pada draft yang bukan revisi
- **THEN** ditolak ("Harga hanya dapat diubah oleh …" sesuai requirement "Mengubah harga")

#### Scenario: Bukan pengaju
- **WHEN** salesperson lain mencoba mengubah diskon draft revisi
- **THEN** gagal "Quotation tidak ditemukan." atau ditolak

### Requirement: Membatalkan approval final
Head of Sales (SALES_RELEASER) atau Admin SHALL dapat membatalkan approval final hanya selama status PENDING_SIGNED_DOCUMENT, dengan alasan wajib. Langkah review SHALL dibuka kembali, putaran tier aktif di-void, dan nomor/tanggal dokumen serta `valid_until` dikosongkan; audit SHALL mencatat nomor lama dan alasan.

#### Scenario: Batal sebelum lampiran
- **WHEN** Head of Sales membatalkan approval final dengan alasan "Harga salah"
- **THEN** status kembali ke PENDING_HEAD_OF_SALES_REVIEW, `document_number` kosong, langkah review IN_PROGRESS, workflow RUNNING

#### Scenario: Sudah dirilis atau tanpa alasan
- **WHEN** status QUOTATION_RELEASED, atau alasan kosong
- **THEN** ditolak (koreksi setelah rilis lewat Revisi)
