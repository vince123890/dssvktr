import { createClient } from "@/lib/supabase/server";
import { requireMenu } from "@/lib/menuAccess";
import { canInitiateQuotation } from "@/lib/rbac";
import { loadQuotationFormOptions } from "@/lib/quotationOptions";
import { QuotationForm } from "../QuotationForm";
import { Card, CardContent } from "@/components/ui/Card";

export default async function NewQuotationPage() {
  const profile = await requireMenu("quotations");
  const supabase = await createClient();

  if (!canInitiateQuotation(profile)) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted">
          Official Quotation hanya diajukan oleh sales internal (Sales Executive / Sales Lead).
          Gunakan menu <strong>Price Estimate</strong> untuk estimasi harga per unit.
        </CardContent>
      </Card>
    );
  }

  const { products, projects } = await loadQuotationFormOptions(supabase);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Official Quotation Baru</h1>
        <p className="text-sm text-muted mt-1">
          Sales To Obtain Official Quotation — isi KYC dan varian kendaraan, tinjau di layar, lalu
          simpan sebagai draft. Setelah submit, permintaan Sales Executive divalidasi Sales Lead
          sebelum diproses Sales Operations. Anda tidak akan melihat struktur biaya di tahap mana pun.
        </p>
      </div>
      <QuotationForm products={products} projects={projects} />
    </div>
  );
}
