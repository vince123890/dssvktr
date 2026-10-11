import { describe, expect, it } from "vitest";
import { MAX_FILE_BYTES, buildStoragePath, safeFileName, validateUpload } from "./files";

describe("validateUpload", () => {
  const ok = { name: "ttd.pdf", size: 1000, type: "application/pdf" };
  it("menerima PDF, PNG, JPG", () => {
    expect(validateUpload(ok)).toBeNull();
    expect(validateUpload({ ...ok, type: "image/png" })).toBeNull();
    expect(validateUpload({ ...ok, type: "image/jpeg" })).toBeNull();
  });
  it("menolak berkas kosong atau tidak ada", () => {
    expect(validateUpload(null)).toMatch(/Pilih berkas/);
    expect(validateUpload({ ...ok, size: 0 })).toMatch(/Pilih berkas/);
  });
  it("menolak ukuran > 10 MB dan format lain", () => {
    expect(validateUpload({ ...ok, size: MAX_FILE_BYTES + 1 })).toMatch(/10 MB/);
    expect(validateUpload({ ...ok, type: "application/zip" })).toMatch(/Format/);
  });
});

describe("nama dan path berkas", () => {
  it("membersihkan karakter berbahaya dan mempertahankan ekstensi", () => {
    expect(safeFileName("Bukti TTD (Final) #1.PDF")).toBe("bukti-ttd-final-1.pdf");
    expect(safeFileName("../../etc/passwd")).not.toContain("/");
    expect(safeFileName("....")).toBe("berkas");
  });
  it("path memuat jenis, pemilik, dan cap waktu", () => {
    expect(buildStoragePath("signed", "abc", "TTD.pdf", 1700000000000)).toBe("signed/abc/1700000000000-ttd.pdf");
  });
});
