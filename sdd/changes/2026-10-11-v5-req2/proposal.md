# Proposal: v5-req2

## Why
Meeting "VKTR Req 2" (docs/kebutuhan_baru_v2.md) mengubah cara aplikasi dipakai: approval pembuatan quotation dipangkas menjadi satu langkah Head of Sales, quotation baru dinyatakan rilis setelah dokumen yang ditandatangani dilampirkan, Salesperson perlu melihat kondisi quotation yang ia kirim, quotation yang Won berlanjut ke project dan pembayaran, direksi butuh dashboard, dan aplikasi akan dibuka di handphone.

## What changes
- Satu workflow aktif (`OQ-STANDARD`: Generate otomatis -> Review Head of Sales); band kuantitas AUTO dengan diskon default 0% (migrasi 0019, tanpa mengubah mesin workflow).
- Status `PENDING_SIGNED_DOCUMENT` (tampil "Disetujui — menunggu rilis"): approval final Head of Sales menetapkan nomor/tanggal dokumen; Salesperson merilis **dengan atau tanpa** lampiran dokumen bertanda tangan (opsional, dapat menyusul setelah rilis).
- Dropdown *Persetujuan Head of Sales* per quotation (`approval_mode`, migrasi 0020): `NONE` melewati review dan langsung merilis; tier margin tetap berlaku untuk GM < 15%.
- Salesperson mengisi diskon pada draft Revisi (sumber `SALESPERSON_REVISION`).
- Won (bukti PO wajib) dan Lost (alasan) manual; Expired tetap otomatis dengan override Admin.
- Badge hijau/kuning/merah dari tanggal rilis (14/30 hari, dapat diatur), filter di daftar quotation.
- Modul Projects: project dari Won, termin (Salesperson), status payment + bukti transfer (Finance), progres (Tim Project).
- Dashboard Sales (KPI per Salesperson) dan Executive.
- Role Finance, Tim Project, Chief/Direksi; menu `projects` dan `dashboard`.
- UI responsif menyeluruh: sidebar drawer, tabel/kartu adaptif, kanban geser, input 16px.

## Capabilities
- Terdampak: official-quotation, workflow-template-catalog, settings-configuration, access-control, quotation-document, dss-and-observability.
- Baru: project-payment-tracking.

## Non-goals
- Integrasi SAP, bank, aplikasi project.
- E-signature.
- Tes E2E di peramban dan tes server action terhadap database sungguhan.

## Assumptions
- Nomor, tanggal dokumen, dan `valid_until` ditetapkan saat approval final; `released_at` (dasar warna dan KPI "terkirim") saat lampiran diunggah.
- Kurs yang bergerak sesudah approval final tidak menahan rilis.
- RLS tabel project mengikuti pola tabel v4.x (authenticated); kewenangan ditegakkan di server action.
- Nama role Finance / Tim Project / Chief-Direksi dapat diganti di Settings.

## Open Questions
- SLA/pengingat menunggu lampiran; perubahan termin setelah ada termin diterima; apakah Chief/Direksi juga melihat Lifecycle (PRD §10 no. 18-20).
