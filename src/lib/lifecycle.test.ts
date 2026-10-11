import { describe, expect, it } from "vitest";
import {
  DEFAULT_AGE_CONFIG,
  ageConfigFrom,
  countAgeStates,
  daysBetween,
  quotationAgeState,
  type AgeInput,
} from "./lifecycle";

const NOW = new Date("2026-10-30T09:00:00Z");
const released = (daysAgo: number, over: Partial<AgeInput> = {}): AgeInput => ({
  outcome: "PENDING",
  current_status: "QUOTATION_RELEASED",
  released_at: new Date(NOW.getTime() - daysAgo * 86400000).toISOString(),
  ...over,
});

describe("daysBetween", () => {
  it("menghitung hari kalender UTC", () => {
    expect(daysBetween("2026-10-16T23:59:00Z", NOW)).toBe(14);
    expect(daysBetween("2026-10-30T00:01:00Z", NOW)).toBe(0);
  });
  it("tidak pernah negatif", () => {
    expect(daysBetween("2026-12-01T00:00:00Z", NOW)).toBe(0);
  });
});

describe("quotationAgeState (dari tanggal rilis)", () => {
  it("hijau di bawah 14 hari", () => {
    expect(quotationAgeState(released(0), NOW)).toBe("GREEN");
    expect(quotationAgeState(released(13), NOW)).toBe("GREEN");
  });
  it("kuning mulai 14 hari", () => {
    expect(quotationAgeState(released(14), NOW)).toBe("YELLOW");
    expect(quotationAgeState(released(29), NOW)).toBe("YELLOW");
  });
  it("merah mulai 30 hari", () => {
    expect(quotationAgeState(released(30), NOW)).toBe("RED");
    expect(quotationAgeState(released(90), NOW)).toBe("RED");
  });
  it("Won menghentikan hitungan walau sudah lewat 30 hari", () => {
    expect(quotationAgeState(released(60, { outcome: "WON" }), NOW)).toBe("WON");
  });
  it("Lost dan Expired tampil sebagai kondisi sendiri", () => {
    expect(quotationAgeState(released(3, { outcome: "LOST" }), NOW)).toBe("LOST");
    expect(quotationAgeState(released(40, { current_status: "EXPIRED" }), NOW)).toBe("EXPIRED");
  });
  it("Won menang atas Expired", () => {
    expect(quotationAgeState(released(40, { outcome: "WON", current_status: "EXPIRED" }), NOW)).toBe("WON");
  });
  it("belum rilis (termasuk menunggu dokumen bertanda tangan) tidak dihitung", () => {
    expect(quotationAgeState(released(10, { current_status: "PENDING_SIGNED_DOCUMENT" }), NOW)).toBe("NONE");
    expect(quotationAgeState(released(10, { current_status: "DRAFT" }), NOW)).toBe("NONE");
    expect(quotationAgeState(released(10, { released_at: null }), NOW)).toBe("NONE");
  });
  it("ambang dapat diatur", () => {
    const cfg = { yellowDays: 7, redDays: 10 };
    expect(quotationAgeState(released(7), NOW, cfg)).toBe("YELLOW");
    expect(quotationAgeState(released(10), NOW, cfg)).toBe("RED");
  });
});

describe("ageConfigFrom", () => {
  it("memakai nilai setelan yang valid", () => {
    expect(ageConfigFrom({ quotationYellowDays: 10, quotationRedDays: 20 })).toEqual({ yellowDays: 10, redDays: 20 });
  });
  it("kembali ke default bila setelan rusak atau merah <= kuning", () => {
    expect(ageConfigFrom({ quotationYellowDays: NaN, quotationRedDays: NaN })).toEqual(DEFAULT_AGE_CONFIG);
    expect(ageConfigFrom({ quotationYellowDays: 20, quotationRedDays: 20 }).redDays).toBeGreaterThan(20);
  });
});

describe("countAgeStates", () => {
  it("menghitung per kondisi dan mengabaikan yang belum rilis", () => {
    const rows: AgeInput[] = [
      released(1),
      released(15),
      released(31),
      released(5, { outcome: "WON" }),
      released(5, { outcome: "LOST" }),
      released(40, { current_status: "EXPIRED" }),
      released(2, { current_status: "PENDING_SIGNED_DOCUMENT" }),
    ];
    expect(countAgeStates(rows, NOW)).toEqual({
      released: 6,
      green: 1,
      yellow: 1,
      red: 1,
      won: 1,
      lost: 1,
      expired: 1,
    });
  });
});
