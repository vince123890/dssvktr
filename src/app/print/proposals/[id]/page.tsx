import { createClient } from "@/lib/supabase/server";
import { canViewQuotation, loadValidatorVisibleRoles, requireMenu } from "@/lib/menuAccess";
import { canSeeCostStructure, isExternal } from "@/lib/rbac";
import { loadSettings } from "@/lib/settings";
import { loadLines } from "@/lib/workflow/quotationEngine";
import { notFound } from "next/navigation";
import { PrintToolbar } from "../../PrintToolbar";
import type { PricingProposal, ProductMasterData, Profile } from "@/types/database";

/**
 * Cost Estimate document (PRD FR-1.5.3 / FR-1.5.4), laid out after the
 * sample "Cost Estimate — PT Siborong Nusa Gemilang": issuer block,
 * number & release/expiry dates, To (from KYC), disclaimer, Sales/Account
 * Person · Product · Prepared By, the item table, inclusions, exclusions
 * (At cost), total, special notes, acceptance block, then one
 * Specification page per variant. The cost structure never appears here.
 */

const rupiah = (v: number) => `Rp ${Math.round(v).toLocaleString("en-US")}`;
const longDate = (d: string | Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(
    typeof d === "string" ? new Date(d) : d
  );

export default async function CostEstimateDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMenu("quotations");
  const supabase = await createClient();

  const { data: row } = await supabase.from("pricing_proposal").select("*").eq("id", id).maybeSingle();
  if (!row) notFound();
  const p = row as PricingProposal;
  if (!canViewQuotation(me, p, await loadValidatorVisibleRoles(supabase))) notFound();

  const released = ["QUOTATION_RELEASED", "EXPIRED", "SUPERSEDED"].includes(p.current_status);
  // Salesperson sees the document only once released; drafts are for pricing roles (FR-1.5.4, FR-5.7).
  if (isExternal(me) || (!released && !canSeeCostStructure(me))) notFound();

  const [settings, lines] = await Promise.all([loadSettings(supabase), loadLines(supabase, id)]);
  const personIds = [...new Set([...(p.account_person_ids ?? []), p.created_by, p.prepared_by].filter(Boolean) as string[])];
  const [{ data: productRows }, { data: people }] = await Promise.all([
    supabase.from("product_master_data").select("*").in("id", lines.map((l) => l.product_id)),
    supabase.from("profile").select("id, full_name, email").in("id", personIds),
  ]);
  const products = new Map(((productRows ?? []) as ProductMasterData[]).map((x) => [x.id, x]));
  const person = (pid: string | null) => ((people ?? []) as Pick<Profile, "id" | "full_name" | "email">[]).find((x) => x.id === pid);

  const accountPersons = (p.account_person_ids?.length ? p.account_person_ids : [p.created_by]).map((pid) => person(pid)).filter(Boolean);
  const primary = accountPersons[0];
  const watermark =
    p.current_status === "SUPERSEDED"
      ? "SUPERSEDED"
      : p.current_status === "EXPIRED"
        ? "EXPIRED"
        : released
          ? null
          : "DRAFT — NOT FOR CUSTOMER";
  const isRental = lines.some((l) => l.scheme === "RENTAL");
  const productSummary = lines
    .map((l) => products.get(l.product_id)?.document_description ?? products.get(l.product_id)?.name)
    .filter(Boolean)
    .join("; ");

  const rows = lines.map((l) => {
    const prod = products.get(l.product_id);
    const rental = l.scheme === "RENTAL";
    const unit = rental ? Number(l.rental_monthly_incl_vat ?? 0) : Number(l.net_price_incl_vat);
    const years = l.rental_tenor_months ? Math.round(l.rental_tenor_months / 12) : null;
    return {
      id: l.id,
      qty: l.quantity,
      schemeText: rental ? `Rental Scheme, ${years ?? "-"}-year Contract` : "Purchase",
      description: `${prod?.document_description ?? prod?.name ?? ""}, incl. VAT`,
      unit,
      total: unit * l.quantity,
    };
  });
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <PrintToolbar
        proposalId={p.id}
        kind="PRINT"
        backHref={`/proposals/${p.id}`}
        note={watermark ? `Watermark: ${watermark}` : "Dokumen resmi — siap dikirim ke pelanggan"}
      />

      <article className="relative mx-auto my-6 w-[210mm] bg-white px-[14mm] py-[12mm] text-[11px] leading-snug text-slate-900 shadow print:my-0 print:w-auto print:px-0 print:py-0 print:shadow-none">
        {watermark && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
            <span className="rotate-[-30deg] text-6xl font-bold tracking-widest text-red-500/15">{watermark}</span>
          </div>
        )}

        <header className="flex items-start justify-between border-b-2 border-slate-900 pb-3">
          <div>
            <div className="text-2xl font-bold tracking-wide">{settings.documentTitle}</div>
            <div className="mt-2 font-semibold">{settings.issuerName}</div>
            {settings.issuerAddress.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/vktr-logo.png" alt="VKTR" className="h-14 w-auto" />
        </header>

        <section className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase text-slate-500">To</div>
            <div className="font-semibold">{p.kyc.company_name}</div>
            <div className="whitespace-pre-line">{p.kyc.official_address}</div>
          </div>
          <table className="self-start text-[11px]">
            <tbody>
              <tr><td className="pr-3 text-slate-500">Number</td><td className="font-mono font-semibold">{p.document_number ?? `DRAFT-${p.proposal_number}`}</td></tr>
              <tr><td className="pr-3 text-slate-500">Release Date</td><td>{p.released_at ? longDate(p.released_at) : "—"}</td></tr>
              <tr><td className="pr-3 text-slate-500">Expiry Date</td><td>{p.valid_until ? longDate(p.valid_until) : "—"}</td></tr>
            </tbody>
          </table>
        </section>

        {settings.documentDisclaimer && (
          <section className="mt-3 rounded border border-slate-300 p-2">
            <div className="text-[10px] font-semibold uppercase text-slate-500">Disclaimer</div>
            <div>{settings.documentDisclaimer}</div>
          </section>
        )}

        <table className="mt-3 w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-slate-900 text-left text-white">
              <th className="p-1.5 font-semibold">Sales/Account Person</th>
              <th className="p-1.5 font-semibold">Product</th>
              <th className="p-1.5 font-semibold">Prepared By</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border border-slate-300 align-top">
              <td className="p-1.5">{accountPersons.map((a) => <div key={a!.id}>{a!.full_name}</div>)}</td>
              <td className="p-1.5">{productSummary}</td>
              <td className="p-1.5">{person(p.prepared_by)?.full_name ?? "Sales Operations"}</td>
            </tr>
          </tbody>
        </table>

        <table className="mt-3 w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-slate-900 text-left text-white">
              <th className="w-16 p-1.5 font-semibold">Quantity</th>
              <th className="p-1.5 font-semibold">Description</th>
              <th className="w-36 p-1.5 text-right font-semibold">{isRental ? "Rental/Month Unit" : "Price/Unit"}</th>
              <th className="w-40 p-1.5 text-right font-semibold">{isRental ? "Rental/Month Total" : "Total"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border border-slate-300 align-top">
                <td className="p-1.5">{r.qty}</td>
                <td className="p-1.5">
                  <div className="font-semibold">{r.schemeText}</div>
                  <div>{r.description}</div>
                </td>
                <td className="p-1.5 text-right">{rupiah(r.unit)}</td>
                <td className="p-1.5 text-right">{rupiah(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <div className="font-semibold">Inclusions:</div>
            <ul className="ml-4 list-disc">{p.inclusions.map((x) => <li key={x}>{x}</li>)}</ul>
            <div className="mt-2 font-semibold">Exclusions: <span className="font-normal italic">At cost</span></div>
            <ul className="ml-4 list-disc">{p.exclusions.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
          <div className="flex flex-col justify-between">
            <div className="flex justify-between border-y-2 border-slate-900 py-1.5 text-sm font-bold">
              <span>Total</span>
              <span>{rupiah(grandTotal)}</span>
            </div>
            <div className="mt-2 text-[10px]">
              If you have questions concerning this quotation, please contact:
              <br />
              {primary?.full_name} | {primary?.email}
            </div>
          </div>
        </section>

        {p.special_notes.length > 0 && (
          <section className="mt-3">
            <div className="font-semibold">Special Notes or Arrangements</div>
            <ul className="ml-4 list-disc">{p.special_notes.map((x) => <li key={x}>{x}</li>)}</ul>
          </section>
        )}

        <section className="mt-5 w-72 rounded border border-slate-300 p-2">
          <div className="font-semibold">To accept this quotation, sign here and return:</div>
          <div className="mt-6 border-b border-slate-400" />
          <div className="mt-1">Name:</div>
          <div>Title:</div>
          <div>Date:</div>
        </section>

        {lines.map((l) => {
          const prod = products.get(l.product_id);
          if (!prod) return null;
          const pages = prod.image_urls ?? [];
          return (
            <section key={`spec-${l.id}`} className="print-page-break mt-8 print:mt-0">
              <div className="border-b-2 border-slate-900 pb-1 text-lg font-bold">SPECIFICATION — {prod.name}</div>
              {pages.length > 0 ? (
                pages.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt={`Spesifikasi ${prod.name}`} className="mx-auto mt-3 max-h-[250mm] w-auto print:break-inside-avoid" />
                ))
              ) : (
                <table className="mt-3 w-full text-[11px]">
                  <tbody>
                    {Object.entries(prod.spec_sheet ?? {}).map(([section, values]) => (
                      <tr key={section} className="border-b border-slate-200 align-top">
                        <td className="w-40 py-1 font-semibold">{section}</td>
                        <td className="py-1">
                          {Object.entries(values ?? {}).map(([k, v]) => (
                            <div key={k}>{k}: {String(v)}</div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          );
        })}
      </article>
    </div>
  );
}
