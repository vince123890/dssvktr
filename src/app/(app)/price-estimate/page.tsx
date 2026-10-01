import { createClient } from "@/lib/supabase/server";
import { requireMenu } from "@/lib/menuAccess";
import { isExternal } from "@/lib/rbac";
import { loadReleasedVersionsByProduct } from "@/lib/costStructure";
import { PriceEstimateClient, type EstimateProduct } from "./PriceEstimateClient";
import type { ProductMasterData } from "@/types/database";

export default async function PriceEstimatePage() {
  const me = await requireMenu("price_estimate");
  const supabase = await createClient();


  const [{ data }, released] = await Promise.all([
    supabase.from("product_master_data").select("*").eq("status", "ACTIVE").order("name"),
    loadReleasedVersionsByProduct(supabase),
  ]);

  // Only variants with a RELEASED cost structure can be estimated (sheet A step 2).
  const products: EstimateProduct[] = ((data ?? []) as ProductMasterData[])
    .filter((p) => released.has(p.id))
    .map((p) => ({
      id: p.id,
      make: p.make ?? "VKTR",
      model: p.model ?? p.name,
      type: p.variant_type ?? p.chassis_variant ?? "-",
      variant: p.variant ?? p.body_variant ?? p.name,
      description: p.document_description ?? p.name,
      loco: p.loco,
      buildType: p.build_type,
      highlights: Object.entries(p.spec_sheet ?? {})
        .slice(0, 4)
        .flatMap(([section, values]) =>
          Object.entries(values ?? {})
            .slice(0, 2)
            .map(([k, v]) => `${section} · ${k}: ${String(v)}`)
        ),
      inclusions: p.default_inclusions ?? [],
      exclusions: p.default_exclusions ?? [],
      imageUrl: p.image_urls?.[0] ?? null,
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Price Estimate (per Unit)</h1>
        <p className="mt-1 text-sm text-muted">
          Sales To Obtain Price Estimate — pilih make, model, type, dan variant kendaraan; estimasi harga per unit
          tampil seketika, excl. dan incl. VAT. Tidak memerlukan approval
          {isExternal(me) ? "." : " — untuk penawaran resmi, gunakan menu Official Quotation."}
        </p>
      </div>
      <PriceEstimateClient products={products} external={isExternal(me)} />
    </div>
  );
}
