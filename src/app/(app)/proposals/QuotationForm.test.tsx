// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuotationForm } from "./QuotationForm";
import * as actions from "./actions";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./actions", () => ({
  createQuotationAction: vi.fn(async () => ({ ok: true, proposalId: "new1" })),
  updateQuotationDraftAction: vi.fn(async () => ({ ok: true, proposalId: "p1" })),
}));

const props = {
  products: [{ id: "prod1", name: "LDT SWB", description: "LDT SWB", hasReleasedCost: true }],
  projects: [],
  qualifiers: { segments: ["B2B"], industries: ["Konstruksi"], relationships: ["Reguler"] },
};

const dropdown = () => screen.getByRole("combobox", { name: /Persetujuan Head of Sales/ });

beforeEach(() => vi.clearAllMocks());

describe("QuotationForm: dropdown persetujuan Head of Sales", () => {
  it("default: perlu approval Head of Sales", () => {
    render(<QuotationForm {...props} />);
    expect(dropdown()).toHaveValue("HEAD_OF_SALES");
    expect(screen.getByText(/lampiran dokumen bertanda tangan bersifat opsional/)).toBeInTheDocument();
  });

  it("memilih tanpa approval menjelaskan rilis langsung dan tier margin tetap berlaku", async () => {
    const user = userEvent.setup();
    render(<QuotationForm {...props} />);
    await user.selectOptions(dropdown(), "NONE");
    expect(screen.getByText(/dirilis otomatis setelah submit/)).toBeInTheDocument();
    expect(screen.getByText(/di bawah 15%/)).toBeInTheDocument();
  });

  it("pilihan ikut terkirim ke server saat disimpan", async () => {
    const user = userEvent.setup();
    render(<QuotationForm {...props} />);
    await user.selectOptions(dropdown(), "NONE");
    await user.click(screen.getByRole("button", { name: /Simpan Draft/ }));
    await waitFor(() => expect(actions.createQuotationAction).toHaveBeenCalledTimes(1));
    expect(vi.mocked(actions.createQuotationAction).mock.calls[0][0]).toMatchObject({ approval_mode: "NONE" });
  });

  it("draft yang diubah memuat pilihan tersimpan", async () => {
    const user = userEvent.setup();
    render(
      <QuotationForm
        {...props}
        proposalId="p1"
        initial={{ businessLine: "B2B_COMMERCIAL_FLEET", kyc: { project_type: "NEW_PROJECT" } as never, lines: [{ product_id: "prod1", quantity: 1 }], approvalMode: "NONE" }}
      />
    );
    expect(dropdown()).toHaveValue("NONE");
    await user.click(screen.getByRole("button", { name: /Simpan Perubahan Draft/ }));
    await waitFor(() => expect(actions.updateQuotationDraftAction).toHaveBeenCalled());
    expect(vi.mocked(actions.updateQuotationDraftAction).mock.calls[0][1]).toMatchObject({ approval_mode: "NONE" });
  });
});
