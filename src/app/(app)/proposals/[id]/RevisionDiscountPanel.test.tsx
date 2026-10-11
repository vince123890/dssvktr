// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RevisionDiscountPanel } from "./RevisionDiscountPanel";
import * as actions from "./quotation-actions";

vi.mock("./quotation-actions", () => ({ saveRevisionDiscountAction: vi.fn(async () => ({ ok: true })) }));

const lines = [
  { id: "l1", productName: "LDT SWB", quantity: 4, discountMode: "PERCENTAGE" as const, discountAmount: 0, discountPct: 0, netPriceInclVat: 920_000_000 },
  { id: "l2", productName: "LDT MWB", quantity: 2, discountMode: "AMOUNT" as const, discountAmount: 1_000_000, discountPct: 0, netPriceInclVat: null },
];

beforeEach(() => vi.clearAllMocks());

describe("RevisionDiscountPanel (diskon Salesperson pada draft revisi)", () => {
  it("menampilkan harga per unit tanpa data biaya, GM, atau tier", () => {
    render(<RevisionDiscountPanel proposalId="p1" lines={lines} />);
    expect(screen.getByText("LDT SWB")).toBeInTheDocument();
    expect(screen.getByText(/harga\/unit incl. VAT/)).toBeInTheDocument();
    // queryAllBy: an explicit "no match at all" (queryBy would also throw on several matches).
    expect(screen.queryAllByText(/\bGM\b|\bTier\b|cost structure|biaya dasar|base cost/i)).toHaveLength(0);
  });

  it("menyimpan diskon per baris dengan satuan masing-masing", async () => {
    const user = userEvent.setup();
    render(<RevisionDiscountPanel proposalId="p1" lines={lines} />);
    const values = screen.getAllByRole("spinbutton");
    await user.clear(values[0]);
    await user.type(values[0], "5");
    await user.click(screen.getByRole("button", { name: "Simpan diskon" }));
    await waitFor(() => expect(actions.saveRevisionDiscountAction).toHaveBeenCalledTimes(1));
    expect(vi.mocked(actions.saveRevisionDiscountAction).mock.calls[0]).toEqual([
      "p1",
      { l1: { discountMode: "PERCENTAGE", discountValue: 5 }, l2: { discountMode: "AMOUNT", discountValue: 1_000_000 } },
    ]);
    expect(await screen.findByText(/Tersimpan/)).toBeInTheDocument();
  });

  it("menampilkan kesalahan dari server", async () => {
    vi.mocked(actions.saveRevisionDiscountAction).mockResolvedValueOnce({ ok: false, error: "Nilai diskon tidak valid." });
    const user = userEvent.setup();
    render(<RevisionDiscountPanel proposalId="p1" lines={lines} />);
    await user.click(screen.getByRole("button", { name: "Simpan diskon" }));
    expect(await screen.findByText("Nilai diskon tidak valid.")).toBeInTheDocument();
  });
});
