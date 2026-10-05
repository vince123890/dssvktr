import { createClient } from "@/lib/supabase/server";
import { requireMenu } from "@/lib/menuAccess";
import { loadQuotationFormOptions } from "@/lib/quotationOptions";
import { QuotationForm } from "../../QuotationForm";
import { notFound, redirect } from "next/navigation";
import type { PricingProposal, QuotationLineItem } from "@/types/database";

export default async function EditQuotationDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireMenu("quotations");
  const supabase = await createClient();

  const { data } = await supabase.from("pricing_proposal").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const proposal = data as PricingProposal;
  if (proposal.created_by !== profile.id) notFound();
  if (proposal.current_status !== "DRAFT" || proposal.created_by !== profile.id) {
    redirect(`/proposals/${id}`);
  }

  const [{ data: lines }, options] = await Promise.all([
    supabase.from("quotation_line_item").select("*").eq("proposal_id", id).order("sort_order"),
    loadQuotationFormOptions(supabase),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Ubah Draft {proposal.proposal_number}</h1>
        <p className="text-sm text-muted mt-1">Perbaiki KYC atau varian, lalu submit ulang dari halaman quotation.</p>
      </div>
      <QuotationForm
        products={options.products}
        projects={options.projects}
        qualifiers={options.qualifiers}
        proposalId={id}
        initial={{
          businessLine: proposal.business_line,
          kyc: { ...proposal.kyc, existing_project_identifier_id: proposal.project_identifier_id } as never,
          lines: ((lines ?? []) as QuotationLineItem[]).map((l) => ({ product_id: l.product_id, quantity: l.quantity })),
        }}
      />
    </div>
  );
}
