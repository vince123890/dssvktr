import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { NewProposalForm } from "./NewProposalForm";

export default function NewProposalPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Buat Quotation Baru</h1>
        <p className="text-sm text-muted mt-1">
          Pilih tipe transaksi (Pricing Template) — CBS dan alur approval
          akan otomatis mengikuti lini bisnis yang dipilih (FR-1.3).
        </p>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Detail Quotation</CardTitle>
            <CardDescription>Data ini akan menjadi header draft v1.0</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <NewProposalForm />
        </CardContent>
      </Card>
    </div>
  );
}
