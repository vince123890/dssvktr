import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createProposalAction } from "../actions";

export default function NewProposalPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Buat Pricing Proposal Baru</h1>
        <p className="text-sm text-muted mt-1">
          Pilih tipe transaksi (Pricing Template) — CBS dan alur approval
          akan otomatis mengikuti lini bisnis yang dipilih (FR-1.3).
        </p>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Detail Proposal</CardTitle>
            <CardDescription>Data ini akan menjadi header draft v1.0</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form action={createProposalAction} className="space-y-4">
            <Field label="Judul Proposal">
              <input
                name="title"
                required
                placeholder="Pengadaan 20 Unit EV Bus — Dishub DKI Jakarta"
                className="input"
              />
            </Field>

            <Field label="Lini Bisnis (Pricing Template)">
              <select name="business_line" required className="input">
                <option value="B2G_TENDER_BUS">B2G Tender Bus</option>
                <option value="B2B_COMMERCIAL_FLEET">B2B Commercial Fleet</option>
                <option value="CHARGING_INFRA_BUILDOUT">
                  Charging Infrastructure Buildout
                </option>
              </select>
            </Field>

            <Field label="Nama Customer (opsional)">
              <input name="customer_name" placeholder="Dinas Perhubungan DKI Jakarta" className="input" />
            </Field>

            <Field label="Jumlah Unit">
              <input
                name="unit_quantity"
                type="number"
                min={1}
                defaultValue={1}
                required
                className="input"
              />
            </Field>

            <div className="flex justify-end pt-2">
              <Button type="submit">Buat Draft &amp; Lanjut ke CBS Builder</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <style>{`
        .input {
          width: 100%;
          border: 1px solid var(--card-border);
          border-radius: 0.5rem;
          padding: 0.55rem 0.75rem;
          font-size: 0.85rem;
          background: white;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-muted space-y-1.5">
      <span>{label}</span>
      {children}
    </label>
  );
}
