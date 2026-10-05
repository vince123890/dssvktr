import type { ProductMasterData } from "@/types/database";

/**
 * A product is a make + model; its rows are the quotable variants. Same
 * key as Price Estimate's make → model → type → variant cascade.
 */
export const productKey = (p: Pick<ProductMasterData, "make" | "model" | "name">) => ({
  make: p.make ?? "VKTR",
  model: p.model ?? p.name,
});

export const PRODUCT_BASE = "/master-data/product";

export const productHref = (make: string, model: string) =>
  `${PRODUCT_BASE}/${encodeURIComponent(make)}/${encodeURIComponent(model)}`;

export interface ProductGroup {
  make: string;
  model: string;
  variants: ProductMasterData[];
}

export function groupProducts(items: ProductMasterData[]): ProductGroup[] {
  const groups = new Map<string, ProductGroup>();
  for (const p of items) {
    const k = productKey(p);
    const id = `${k.make}|${k.model}`;
    if (!groups.has(id)) groups.set(id, { ...k, variants: [] });
    groups.get(id)!.variants.push(p);
  }
  return [...groups.values()];
}
