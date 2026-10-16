// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentTermsModal } from "./PaymentTermsModal";
import * as actions from "./quotation-actions";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("./quotation-actions", () => ({ updateQuotationTermsAction: vi.fn(async () => ({ ok: true })) }));

const terms = [{ label: "DP", pct: 50 }, { label: "Pelunasan", pct: 50 }];

beforeEach(() => vi.clearAllMocks());

describe("PaymentTermsModal: Update TOP", () => {
  it("membuka modal dengan TOP standar 50-50", async () => {
    const user = userEvent.setup();
    render(<PaymentTermsModal proposalId="p1" terms={terms} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Update TOP/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Nama termin 1")).toHaveValue("DP");
    expect(screen.getByLabelText("Persen termin 2")).toHaveValue(50);
    expect(screen.getByText("Total 100%")).toBeInTheDocument();
  });

  it("menyimpan 40-30-30 lalu menutup modal dan menyegarkan halaman", async () => {
    const user = userEvent.setup();
    render(<PaymentTermsModal proposalId="p1" terms={terms} />);
    await user.click(screen.getByRole("button", { name: /Update TOP/ }));
    const pct1 = screen.getByLabelText("Persen termin 1");
    await user.clear(pct1);
    await user.type(pct1, "40");
    const pct2 = screen.getByLabelText("Persen termin 2");
    await user.clear(pct2);
    await user.type(pct2, "30");
    await user.click(screen.getByRole("button", { name: /Tambah termin/ }));
    await user.type(screen.getByLabelText("Nama termin 3"), "Serah terima");
    await user.type(screen.getByLabelText("Persen termin 3"), "30");
    expect(screen.getByText("Total 100%")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Simpan TOP" }));
    await waitFor(() => expect(actions.updateQuotationTermsAction).toHaveBeenCalledTimes(1));
    expect(actions.updateQuotationTermsAction).toHaveBeenCalledWith("p1", [
      { label: "DP", pct: 40 },
      { label: "Pelunasan", pct: 30 },
      { label: "Serah terima", pct: 30 },
    ]);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(refresh).toHaveBeenCalled();
  });

  it("menolak total bukan 100% tanpa memanggil server", async () => {
    const user = userEvent.setup();
    render(<PaymentTermsModal proposalId="p1" terms={terms} />);
    await user.click(screen.getByRole("button", { name: /Update TOP/ }));
    const pct1 = screen.getByLabelText("Persen termin 1");
    await user.clear(pct1);
    await user.type(pct1, "40");
    await user.click(screen.getByRole("button", { name: "Simpan TOP" }));
    expect(await screen.findByText(/Total persentase harus 100%/)).toBeInTheDocument();
    expect(actions.updateQuotationTermsAction).not.toHaveBeenCalled();
  });

  it("menampilkan kesalahan dari server dan tetap terbuka", async () => {
    vi.mocked(actions.updateQuotationTermsAction).mockResolvedValueOnce({ ok: false, error: "TOP quotation tidak dapat diubah lagi." });
    const user = userEvent.setup();
    render(<PaymentTermsModal proposalId="p1" terms={terms} />);
    await user.click(screen.getByRole("button", { name: /Update TOP/ }));
    await user.click(screen.getByRole("button", { name: "Simpan TOP" }));
    expect(await screen.findByText(/tidak dapat diubah lagi/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
