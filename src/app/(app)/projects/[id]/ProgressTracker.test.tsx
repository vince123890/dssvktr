// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProgressTracker } from "./ProgressTracker";
import * as actions from "../actions";

vi.mock("../actions", () => ({ addProgressEntryAction: vi.fn(async () => ({ ok: true })) }));

const entries = [
  { id: "e2", entryDate: "2026-10-20", statusLabel: "Proses produksi", progressPct: 20, note: "Unit pertama", author: "Eko", attachmentUrl: "https://files.test/foto.jpg" },
  { id: "e1", entryDate: "2026-10-10", statusLabel: "PO diterima", progressPct: 5, note: null, author: "Eko", attachmentUrl: null },
];

beforeEach(() => vi.clearAllMocks());

describe("ProgressTracker: diisi Tim Project, dibaca yang lain", () => {
  it("menampilkan progres terbaru dan riwayat", () => {
    render(<ProgressTracker projectId="pr1" entries={entries} canRecord={false} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "20");
    expect(screen.getByText("PO diterima")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Simpan progres" })).not.toBeInTheDocument();
  });

  it("Tim Project menambah entri progres", async () => {
    const user = userEvent.setup();
    render(<ProgressTracker projectId="pr1" entries={entries} canRecord />);
    await user.type(screen.getByRole("spinbutton"), "35");
    await user.type(screen.getByPlaceholderText("mis. Proses produksi"), "Pengiriman");
    const fileInput = screen.getByLabelText("Foto / dokumen bukti (PDF, PNG, JPG)") as HTMLInputElement;
    expect(fileInput).toBeRequired();
    expect(fileInput.accept).toBe("application/pdf,image/png,image/jpeg");
    await user.upload(fileInput, new File(["x"], "foto.jpg", { type: "image/jpeg" }));
    expect(fileInput.files?.[0].name).toBe("foto.jpg");
    // jsdom does not count user-event uploads for `required`; the browser does.
    fileInput.form!.noValidate = true;
    await user.click(screen.getByRole("button", { name: "Simpan progres" }));
    await waitFor(() => expect(actions.addProgressEntryAction).toHaveBeenCalledTimes(1));
    const [id, form] = vi.mocked(actions.addProgressEntryAction).mock.calls[0];
    expect(id).toBe("pr1");
    expect(form).toBeInstanceOf(FormData);
    expect(form.get("status_label")).toBe("Pengiriman");
    expect(form.get("progress_pct")).toBe("35");
    expect(form.has("file")).toBe(true);
  });

  it("menampilkan tautan lampiran pada riwayat", () => {
    render(<ProgressTracker projectId="pr1" entries={entries} canRecord={false} />);
    const links = screen.getAllByRole("link", { name: "Lihat lampiran" });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "https://files.test/foto.jpg");
  });

  it("menampilkan kesalahan dari server", async () => {
    vi.mocked(actions.addProgressEntryAction).mockResolvedValueOnce({ ok: false, error: "Progres harus bilangan bulat 0–100." });
    const user = userEvent.setup();
    render(<ProgressTracker projectId="pr1" entries={[]} canRecord />);
    await user.type(screen.getByRole("spinbutton"), "50");
    await user.type(screen.getByPlaceholderText("mis. Proses produksi"), "X");
    screen.getByLabelText("Foto / dokumen bukti (PDF, PNG, JPG)").closest("form")!.noValidate = true;
    await user.click(screen.getByRole("button", { name: "Simpan progres" }));
    expect(await screen.findByText(/bilangan bulat 0–100/)).toBeInTheDocument();
  });
});
