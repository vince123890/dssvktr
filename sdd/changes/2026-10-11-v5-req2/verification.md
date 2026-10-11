# Verification: v5-req2

## Terverifikasi
- `tsc --noEmit`, `eslint src`, `next build` bersih; `vitest run`: 17 file, 155 tes lulus.
- Migrasi 0018 dan 0019 berhasil dijalankan di Supabase oleh pengguna. 0019 sempat gagal (FK `workflow_step_instance` ke langkah yang dihapus) dan diperbaiki: sekarang membuat versi baru `OQ-STANDARD`, bukan menghapus langkah.
- Tes engine (`quotationEngine.v5.test.ts`, fake DB yang dapat menulis): `attachSignedDocument`, `cancelFinalApproval`, `overrideExpired`. Mutasi disengaja pada `cancelFinalApproval` membuat tes gagal; kode dikembalikan.
- Tes komponen (jsdom + Testing Library): Sidebar drawer (buka/tutup, Esc, overlay, tutup setelah pindah halaman, kunci scroll), ActionPanel (lampiran, batalkan approval, Won/Lost, override Expired, approve, revisi), RevisionDiscountPanel, PaymentTerms, ProgressTracker. Mutasi pada handler Esc dan kebocoran teks GM/Tier membuat tes gagal; kode dikembalikan.
- Penjaga responsif statis (`responsive.test.ts`): setiap tabel punya pembungkus scroll + `min-w`, grid 3+ kolom berbreakpoint, input 16px di layar sentuh, shell tidak `h-screen overflow-hidden`. Penjaga ini menemukan 5 tabel Settings tanpa `min-w` dan semuanya diperbaiki.
- Tes menangkap beberapa cacat sendiri: `safeFileName("....")`, dan 2 asersi tes yang salah (jsdom tidak membawa berkas user-event ke FormData; selektor `aria-hidden` mengenai ikon).

## Belum terverifikasi
- Alur penuh terhadap database dan Storage sungguhan (approval final -> lampiran -> Released, Won + project, termin, progres, override Expired): server action memakai klien Supabase dan belum diuji end-to-end.
- Tampilan sebenarnya di peramban/handphone: jsdom tidak punya layout, jadi tes hanya memastikan struktur, kelas, dan perilaku; bukan tampilan piksel.
- `seed:demo` / `reset:demo` dengan akun dan project baru (skrip menghapus semua quotation; tidak dijalankan di database pengguna).

## Risiko yang diketahui
- Kebijakan RLS project hanya "authenticated"; pembatasan peran ada di server action.
- Penomoran dokumen masih "nomor tertinggi + 1" tanpa kunci (celah lama); setelah approval final dibatalkan, nomor lama dapat diterbitkan lagi bila itu nomor tertinggi.
