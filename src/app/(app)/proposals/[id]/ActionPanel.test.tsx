// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionPanel, type ActionCapabilities } from "./ActionPanel";
import * as actions from "./quotation-actions";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./quotation-actions", () => {
  const ok = async () => ({ ok: true });
  return {
    adminExpiredOverrideAction: vi.fn(ok),
    attachSignedDocumentAction: vi.fn(ok),
    releaseWithoutSignedDocumentAction: vi.fn(ok),
    cancelFinalApprovalAction: vi.fn(ok),
    createRevisionAction: vi.fn(async () => ({ ok: true, newProposalId: "new1" })),
    forwardToReviewAction: vi.fn(ok),
    markLostAction: vi.fn(ok),
    markWonAction: vi.fn(ok),
    retryReleaseAction: vi.fn(ok),
    reviewDecisionAction: vi.fn(ok),
    stepDecisionAction: vi.fn(ok),
    submitQuotationAction: vi.fn(ok),
    tierDecisionAction: vi.fn(ok),
    updateQuotationTermsAction: vi.fn(ok),
  };
});

const none: ActionCapabilities = {
  canSubmit: false,
  canEditDraft: false,
  stepKind: null,
  stepName: null,
  tierDecision: null,
  canRetryRelease: false,
  awaitingRelease: false,
  canAttachSigned: false,
  hasSignedDocument: false,
  canCancelApproval: false,
  canRecordOutcome: false,
  canRevise: false,
  adminExpired: null,
  waitingFor: null,
};
const caps = (over: Partial<ActionCapabilities>): ActionCapabilities => ({ ...none, ...over });
const pdf = () => new File(["x"], "ttd.pdf", { type: "application/pdf" });

beforeEach(() => vi.clearAllMocks());

describe("ActionPanel", () => {
  it("tanpa aksi: menjelaskan siapa yang ditunggu", () => {
    render(<ActionPanel proposalId="p1" caps={caps({ waitingFor: "Head of Sales" })} />);
    expect(screen.getByText(/Tidak ada aksi untuk role Anda/)).toBeInTheDocument();
    expect(screen.getByText("Head of Sales")).toBeInTheDocument();
  });

  const releaseSelect = () => screen.getByRole("combobox", { name: /Rilis/ });

  it("setelah approve: satu form Rilis dengan dropdown, default tanpa lampiran dan tanpa kolom berkas", async () => {
    const { container } = render(<ActionPanel proposalId="p1" caps={caps({ awaitingRelease: true, canAttachSigned: true })} />);
    expect(releaseSelect()).toHaveValue("WITHOUT");
    expect(screen.getByRole("button", { name: "Rilis" })).toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(screen.getAllByText(/opsional/i).length).toBeGreaterThan(0);
  });

  it("pilih 'Tanpa lampiran' lalu Rilis: langsung dirilis tanpa berkas", async () => {
    const user = userEvent.setup();
    render(<ActionPanel proposalId="p1" caps={caps({ awaitingRelease: true, canAttachSigned: true })} />);
    await user.click(screen.getByRole("button", { name: "Rilis" }));
    await waitFor(() => expect(actions.releaseWithoutSignedDocumentAction).toHaveBeenCalledWith("p1"));
    expect(actions.attachSignedDocumentAction).not.toHaveBeenCalled();
  });

  it("pilih 'Dengan lampiran': kolom berkas muncul, lalu Rilis mengirim berkas", async () => {
    const user = userEvent.setup();
    const { container } = render(<ActionPanel proposalId="p1" caps={caps({ awaitingRelease: true, canAttachSigned: true })} />);
    await user.selectOptions(releaseSelect(), "WITH");
    const input = container.querySelector('input[type="file"][name="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    await user.upload(input, pdf());
    expect(input.files?.[0].name).toBe("ttd.pdf");
    input.form!.noValidate = true; // jsdom does not count user-event uploads for `required`
    await user.click(screen.getByRole("button", { name: "Rilis" }));
    await waitFor(() => expect(actions.attachSignedDocumentAction).toHaveBeenCalledTimes(1));
    const [id, form] = vi.mocked(actions.attachSignedDocumentAction).mock.calls[0];
    expect(id).toBe("p1");
    expect(form.has("file")).toBe(true); // jsdom FormData does not carry user-event files; the input check above does
    expect(actions.releaseWithoutSignedDocumentAction).not.toHaveBeenCalled();
  });

  it("kembali ke 'Tanpa lampiran' menyembunyikan kolom berkas", async () => {
    const user = userEvent.setup();
    const { container } = render(<ActionPanel proposalId="p1" caps={caps({ awaitingRelease: true, canAttachSigned: true })} />);
    await user.selectOptions(releaseSelect(), "WITH");
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
    await user.selectOptions(releaseSelect(), "WITHOUT");
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });

  it("menampilkan pesan kesalahan dari server saat rilis dengan lampiran", async () => {
    vi.mocked(actions.attachSignedDocumentAction).mockResolvedValueOnce({
      ok: false,
      error: "Format berkas harus PDF, PNG, atau JPG.",
    });
    const user = userEvent.setup();
    const { container } = render(<ActionPanel proposalId="p1" caps={caps({ awaitingRelease: true, canAttachSigned: true })} />);
    await user.selectOptions(releaseSelect(), "WITH");
    const file = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(file, pdf());
    file.form!.noValidate = true;
    await user.click(screen.getByRole("button", { name: "Rilis" }));
    expect(await screen.findByText(/Format berkas harus PDF/)).toBeInTheDocument();
  });

  it("tidak ada form rilis bagi yang bukan pemilik quotation", () => {
    render(<ActionPanel proposalId="p1" caps={caps({ waitingFor: "Salesperson merilis" })} />);
    expect(screen.queryByRole("button", { name: "Rilis" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Lampirkan/ })).not.toBeInTheDocument();
  });

  it("setelah rilis lampiran tetap dapat ditambahkan, lalu diganti (tanpa form Rilis)", () => {
    const { rerender } = render(<ActionPanel proposalId="p1" caps={caps({ canAttachSigned: true })} />);
    expect(screen.getByText(/dapat ditambahkan setelah rilis/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lampirkan" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rilis" })).not.toBeInTheDocument();
    rerender(<ActionPanel proposalId="p1" caps={caps({ canAttachSigned: true, hasSignedDocument: true })} />);
    expect(screen.getByRole("button", { name: "Ganti lampiran" })).toBeInTheDocument();
  });

  it("Head of Sales membatalkan approval final dengan alasan", async () => {
    const user = userEvent.setup();
    render(<ActionPanel proposalId="p1" caps={caps({ canCancelApproval: true })} />);
    await user.type(screen.getByPlaceholderText("Alasan pembatalan (wajib)"), "Harga salah");
    await user.click(screen.getByRole("button", { name: "Batalkan approval final" }));
    await waitFor(() => expect(actions.cancelFinalApprovalAction).toHaveBeenCalledWith("p1", "Harga salah"));
  });

  it("Won meminta nomor PO dan berkas PO", async () => {
    const user = userEvent.setup();
    const { container } = render(<ActionPanel proposalId="p1" caps={caps({ canRecordOutcome: true })} />);

    await user.click(screen.getByRole("button", { name: "Diterima (Won)" }));
    await user.type(screen.getByPlaceholderText("Nomor PO"), "PO-77");
    const po = container.querySelector('input[name="po_file"]') as HTMLInputElement;
    await user.upload(po, pdf());
    expect(po.files?.[0].name).toBe("ttd.pdf");
    po.form!.noValidate = true;
    await user.click(screen.getByRole("button", { name: /Simpan Won/ }));
    await waitFor(() => expect(actions.markWonAction).toHaveBeenCalledTimes(1));
    const form = vi.mocked(actions.markWonAction).mock.calls[0][1];
    expect(form.get("po_number")).toBe("PO-77");
    expect(form.has("po_file")).toBe(true);
  });

  it("Lost mengirim alasan", async () => {
    const user = userEvent.setup();
    render(<ActionPanel proposalId="p1" caps={caps({ canRecordOutcome: true })} />);
    await user.click(screen.getByRole("button", { name: "Ditolak (Lost)" }));
    await user.type(screen.getByPlaceholderText("Alasan Lost (wajib)"), "Harga terlalu tinggi");
    await user.click(screen.getByRole("button", { name: "Simpan Lost" }));
    await waitFor(() => expect(actions.markLostAction).toHaveBeenCalledWith("p1", "Harga terlalu tinggi"));
  });

  it("Admin: nyatakan Expired lebih awal", async () => {
    const user = userEvent.setup();
    render(<ActionPanel proposalId="p1" caps={caps({ adminExpired: "EXPIRE" })} />);
    await user.type(screen.getByPlaceholderText(/Alasan \(wajib/), "Pelanggan batal");
    await user.click(screen.getByRole("button", { name: "Nyatakan Expired" }));
    await waitFor(() =>
      expect(actions.adminExpiredOverrideAction).toHaveBeenCalledWith("p1", "EXPIRE", "Pelanggan batal", "")
    );
  });

  it("Admin: batalkan Expired dengan tanggal berlaku baru", async () => {
    const user = userEvent.setup();
    const { container } = render(<ActionPanel proposalId="p1" caps={caps({ adminExpired: "CLEAR" })} />);
    await user.type(screen.getByPlaceholderText(/Alasan \(wajib/), "Salah tanggal");
    await user.type(container.querySelector('input[type="date"]') as HTMLInputElement, "2030-01-31");
    await user.click(screen.getByRole("button", { name: "Batalkan Expired" }));
    await waitFor(() =>
      expect(actions.adminExpiredOverrideAction).toHaveBeenCalledWith("p1", "CLEAR", "Salah tanggal", "2030-01-31")
    );
  });

  it("Head of Sales: approve mengirim keputusan ACCEPT", async () => {
    const user = userEvent.setup();
    render(<ActionPanel proposalId="p1" caps={caps({ stepKind: "REVIEW_AND_ROUTE", stepName: "Review" })} />);
    await user.click(screen.getByRole("button", { name: /Approve & rute tier/ }));
    await waitFor(() => expect(actions.reviewDecisionAction).toHaveBeenCalledWith("p1", "ACCEPT", ""));
  });

  it("revisi: tombol Buat Revisi mengirim alasan", async () => {
    const user = userEvent.setup();
    render(<ActionPanel proposalId="p1" caps={caps({ canRevise: true })} />);
    await user.type(screen.getByPlaceholderText("Alasan / permintaan pelanggan"), "Minta diskon 5%");
    await user.click(screen.getByRole("button", { name: "Buat Revisi" }));
    await waitFor(() => expect(actions.createRevisionAction).toHaveBeenCalledWith("p1", "Minta diskon 5%"));
  });
  it("TOP: ringkasan dan tombol Update TOP ada di panel Aksi, dekat Won/Lost", async () => {
    const user = userEvent.setup();
    render(
      <ActionPanel
        proposalId="p1"
        caps={caps({ canRecordOutcome: true, termsEditable: true, paymentTerms: [{ label: "DP", pct: 50 }, { label: "Pelunasan", pct: 50 }] })}
      />
    );
    expect(screen.getByText("DP 50% · Pelunasan 50%")).toBeInTheDocument();
    expect(screen.queryByText(/Tidak ada aksi/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Update TOP/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("TOP: tanpa hak mengubah, tombol tidak tampil", () => {
    render(<ActionPanel proposalId="p1" caps={caps({ termsEditable: false, paymentTerms: [{ label: "DP", pct: 100 }] })} />);
    expect(screen.queryByRole("button", { name: /Update TOP/ })).not.toBeInTheDocument();
  });
});
