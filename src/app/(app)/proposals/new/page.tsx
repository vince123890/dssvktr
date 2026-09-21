import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { NewProposalForm } from "./NewProposalForm";
import { createClient } from "@/lib/supabase/server";

export default async function NewProposalPage() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("product_master_data")
    .select("id, name, code")
    .eq("status", "ACTIVE")
    .order("name");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Buat Quotation Baru</h1>
        <p className="text-sm text-muted mt-1">
          Master data biaya bersifat tunggal untuk semua lini bisnis (FR-1.1) —
          lini bisnis hanya menentukan alur approval yang dipakai (Workflow
          Template).
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
          <NewProposalForm products={products ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
