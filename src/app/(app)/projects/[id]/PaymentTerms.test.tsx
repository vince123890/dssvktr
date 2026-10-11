// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentTerms, type TermView } from "./PaymentTerms";
import * as actions from "../actions";

vi.mock("../actions", () => ({
  addPaymentTermAction: vi.fn(async () => ({ ok: true })),
  deletePaymentTermAction: vi.fn(async () => ({ ok: true })),
  markTermReceivedAction: vi.fn(async () => ({ ok: true })),
}));

const pending: TermView = {
  id: "t1", termNo: 1, label: "DP", plannedPct: 30, plannedAmount: null, dueDate: null,
  status: "PENDING", receivedAmount: null, receivedAt: null, proofUrl: null,
};
const received: TermView = {
  ...pending, id: "t2", termNo: 2, label: "Pelunasan", plannedPct: 70, status: "RECEIVED",
  receivedAmount: 700_000, receivedAt: "2026-10-20", proofUrl: "https://files/bukti.pdf",
};

beforeEach(() => vi.clearAllMocks());

describe("PaymentTerms: Salesperson menetapkan, Finance mengisi status", () => {
  it("Salesperson pemilik menambah termin (persen)", async () => {
    const user = userEvent.setup();
    render(<PaymentTerms projectId="pr1" terms={[]} contractValueExVat={1_000_000} canSet canUpdateStatus={false} />);
    await user.type(screen.getByPlaceholderText("mis. DP"), "DP");
    await user.type(screen.getByRole("spinbutton"), "30");
    await user.click(screen.getByRole("button", { name: "Tambah termin" }));
    await waitFor(() =>
      expect(actions.addPaymentTermAction).toHaveBeenCalledWith("pr1", {
        label: "DP", plannedPct: 30, plannedAmount: null, dueDate: null,
      })
    );
  });

  it("pengguna lain hanya membaca: tanpa form tambah dan tanpa tombol Finance", () => {
    render(<PaymentTerms projectId="pr1" terms={[pending]} contractValueExVat={1_000_000} canSet={false} canUpdateStatus={false} />);
    expect(screen.getByText(/Termin 1 — DP/)).toBeInTheDocument();
    expect(screen.queryByText("Tambah termin")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tandai diterima" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hapus" })).not.toBeInTheDocument();
  });

  it("Finance menandai diterima dengan jumlah dan bukti transfer", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PaymentTerms projectId="pr1" terms={[pending]} contractValueExVat={1_000_000} canSet={false} canUpdateStatus />
    );
    await user.click(screen.getByRole("button", { name: "Tandai diterima" }));
    const proof = container.querySelector('input[name="proof_file"]') as HTMLInputElement;
    await user.upload(proof, new File(["x"], "bukti.png", { type: "image/png" }));
    expect(proof.files?.[0].name).toBe("bukti.png");
    proof.form!.noValidate = true;
    await user.click(screen.getByRole("button", { name: /Simpan & centang diterima/ }));
    await waitFor(() => expect(actions.markTermReceivedAction).toHaveBeenCalledTimes(1));
    const [projectId, termId, form] = vi.mocked(actions.markTermReceivedAction).mock.calls[0];
    expect([projectId, termId]).toEqual(["pr1", "t1"]);
    expect(form.get("received_amount")).toBe("300000");
    expect(form.has("proof_file")).toBe(true);
  });

  it("termin terkunci setelah ada yang diterima; bukti transfer dapat dibuka", () => {
    render(<PaymentTerms projectId="pr1" terms={[pending, received]} contractValueExVat={1_000_000} canSet canUpdateStatus={false} />);
    expect(screen.getByText(/Termin terkunci/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hapus" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "bukti transfer" })).toHaveAttribute("href", "https://files/bukti.pdf");
  });
});
