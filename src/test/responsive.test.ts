import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Static guard for PRD FR-5.8 (responsive UI). jsdom has no layout engine,
 * so these tests read the source and enforce the rules the responsive
 * pass established — a new wide table or rigid grid fails here instead of
 * being discovered on a phone.
 */

const ROOT = path.resolve(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".tsx") && !full.endsWith(".test.tsx")) out.push(full);
  }
  return out;
}

// The print routes are paper layouts, deliberately not responsive.
const appFiles = [...walk(path.join(ROOT, "app")), ...walk(path.join(ROOT, "components"))].filter(
  (f) => !f.includes(`${path.sep}print${path.sep}`)
);
const rel = (f: string) => path.relative(ROOT, f).replaceAll("\\", "/");
const lines = (f: string) => readFileSync(f, "utf8").split(/\r?\n/);

describe("tabel", () => {
  it("setiap <table> berada di pembungkus yang dapat digeser dan punya lebar minimum", () => {
    const problems: string[] = [];
    for (const f of appFiles) {
      const ls = lines(f);
      ls.forEach((line, i) => {
        if (!/<table[\s>]/.test(line)) return;
        // Compact key/value tables (text-[11px]) sit inside a two-column detail grid and never get wide.
        if (/text-\[11px\]/.test(line)) return;
        const above = ls.slice(Math.max(0, i - 12), i + 1).join("\n");
        const scrolls = /TableScroll|overflow-x-auto/.test(above);
        const hasMin = /min-w-\[/.test(line);
        if (!scrolls) problems.push(`${rel(f)}:${i + 1} tanpa pembungkus scroll horizontal`);
        else if (!hasMin) problems.push(`${rel(f)}:${i + 1} tanpa min-w-[...]`);
      });
    }
    expect(problems).toEqual([]);
  });

  it("daftar utama (quotation, project) punya tampilan kartu untuk layar sempit", () => {
    for (const f of ["app/(app)/proposals/page.tsx", "app/(app)/projects/page.tsx"]) {
      const src = readFileSync(path.join(ROOT, f), "utf8");
      expect(src, f).toMatch(/md:hidden/);
      expect(src, f).toMatch(/hidden[^"]*md:block/);
    }
  });
});

describe("grid dan lebar tetap", () => {
  it("grid 3+ kolom selalu berawalan breakpoint (kecuali blok meta kecil)", () => {
    const problems: string[] = [];
    for (const f of appFiles) {
      lines(f).forEach((line, i) => {
        for (const m of line.matchAll(/(?<![\w:-])grid-cols-([3-9]|1[0-2])\b/g)) {
          if (/grid-cols-3 gap-2 text-\[11px\]/.test(line)) continue; // ScopeCard footer: three short numbers
          problems.push(`${rel(f)}:${i + 1} grid-cols-${m[1]} tanpa breakpoint`);
        }
      });
    }
    expect(problems).toEqual([]);
  });

  it("tidak ada lebar piksel tetap pada input atau kolom konten", () => {
    const problems: string[] = [];
    for (const f of appFiles) {
      lines(f).forEach((line, i) => {
        if (/pc-input[^"]*(?<![\w:-])w-(56|60|64|72|80|96)\b/.test(line)) problems.push(`${rel(f)}:${i + 1} input berlebar tetap`);
      });
    }
    expect(problems).toEqual([]);
  });
});

describe("shell aplikasi", () => {
  const layout = readFileSync(path.join(ROOT, "app/(app)/layout.tsx"), "utf8");
  const sidebar = readFileSync(path.join(ROOT, "components/layout/Sidebar.tsx"), "utf8");

  it("halaman mengalir sebagai dokumen di layar kecil (bukan h-screen + overflow-hidden)", () => {
    expect(layout).not.toMatch(/h-screen[^"]*overflow-hidden|overflow-hidden[^"]*h-screen/);
    expect(layout).toMatch(/lg:flex/);
  });

  it("sidebar: top bar dan hamburger hanya di bawah lg; kolom tetap dari lg", () => {
    expect(sidebar).toMatch(/lg:hidden/);
    expect(sidebar).toMatch(/lg:sticky/);
    expect(sidebar).toMatch(/-translate-x-full/);
    expect(sidebar).toMatch(/aria-expanded/);
  });
});

describe("CSS global", () => {
  const css = readFileSync(path.join(ROOT, "app/globals.css"), "utf8");
  it("input 16px di layar sentuh agar iOS tidak zoom saat fokus", () => {
    expect(css).toMatch(/@media \(max-width: 1023px\)[\s\S]*\.pc-input[\s\S]*font-size: 1rem/);
  });
});
