"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatIDR } from "@/lib/utils";
import { useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { getPriceEstimateAction, type PriceEstimateResult } from "./actions";

export interface EstimateProduct {
  id: string;
  make: string;
  model: string;
  type: string;
  variant: string;
  description: string;
  loco: string | null;
  buildType: string | null;
  highlights: string[];
  inclusions: string[];
  exclusions: string[];
  imageUrl: string | null;
}

const uniq = (xs: string[]) => [...new Set(xs)];

export function PriceEstimateClient({ products, external }: { products: EstimateProduct[]; external: boolean }) {
  const [make, setMake] = useState(products[0]?.make ?? "");
  const [model, setModel] = useState(products[0]?.model ?? "");
  const [type, setType] = useState(products[0]?.type ?? "");
  const [productId, setProductId] = useState("");
  const [result, setResult] = useState<PriceEstimateResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const makes = uniq(products.map((p) => p.make));
  const models = uniq(products.filter((p) => p.make === make).map((p) => p.model));
  const types = uniq(products.filter((p) => p.make === make && p.model === model).map((p) => p.type));
  const variants = products.filter((p) => p.make === make && p.model === model && p.type === type);
  const selected = useMemo(() => products.find((p) => p.id === productId) ?? null, [products, productId]);

  function choose(id: string) {
    setProductId(id);
    setResult(null);
    if (!id) return;
    startTransition(async () => setResult(await getPriceEstimateAction(id)));
  }

  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted">
          Belum ada varian dengan cost structure RELEASED.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader>
          <div>
            <CardTitle>1–2. Pilih kendaraan</CardTitle>
            <CardDescription>Make → model → type → variant</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select label="Make" value={make} options={makes} onChange={(v) => { setMake(v); setModel(""); setType(""); choose(""); }} />
          <Select label="Model" value={model} options={models} onChange={(v) => { setModel(v); setType(""); choose(""); }} />
          <Select label="Type" value={type} options={types} onChange={(v) => { setType(v); choose(""); }} />
          <label className="block space-y-1 text-xs text-muted">
            <span>Variant</span>
            <select className="pc-input" value={productId} onChange={(e) => choose(e.target.value)}>
              <option value="">Pilih variant...</option>
              {variants.map((p) => (
                <option key={p.id} value={p.id}>{p.variant}</option>
              ))}
            </select>
          </label>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <div>
            <CardTitle>3. Informasi di layar</CardTitle>
            <CardDescription>Harga dasar 1 unit, tanpa diskon — estimasi, bukan penawaran resmi</CardDescription>
          </div>
          {isPending && <Loader2 size={16} className="animate-spin text-muted" />}
        </CardHeader>
        <CardContent className="space-y-4">
          {!selected && <p className="py-8 text-center text-sm text-muted">Pilih variant untuk melihat estimasi harga.</p>}
          {selected && (
            <>
              <div>
                <div className="text-xs text-muted">a. Make · model · type · variant</div>
                <div className="font-semibold">{selected.description}</div>
                <div className="mt-1 flex gap-1.5">
                  {selected.buildType && <Badge>{selected.buildType}</Badge>}
                  {selected.loco && <Badge tone="info">loco {selected.loco}</Badge>}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted">b. Estimasi harga per unit</div>
                {result?.ok ? (
                  <div className="mt-1 grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-card-border p-3">
                      <div className="text-[11px] text-muted">excl. VAT</div>
                      <div className="text-lg font-semibold">{formatIDR(result.priceExVat ?? 0)}</div>
                    </div>
                    <div className="rounded-lg border border-primary/30 bg-blue-50 p-3">
                      <div className="text-[11px] text-muted">incl. VAT {result.vatRatePct}%</div>
                      <div className="text-lg font-semibold text-primary">{formatIDR(result.priceInclVat ?? 0)}</div>
                    </div>
                  </div>
                ) : result && !result.ok ? (
                  <p className="text-xs text-danger">{result.error}</p>
                ) : (
                  <p className="text-xs text-muted">Menghitung...</p>
                )}
              </div>

              <div>
                <div className="text-xs text-muted">c. Informasi tambahan</div>
                <ul className="ml-4 mt-1 list-disc text-xs">
                  {selected.highlights.map((h) => <li key={h}>{h}</li>)}
                </ul>
                {selected.inclusions.length > 0 && (
                  <p className="mt-2 text-xs"><strong>Termasuk:</strong> {selected.inclusions.join("; ")}</p>
                )}
                <p className="mt-1 text-xs"><strong>Tidak termasuk (at cost):</strong> Delivery to site{selected.exclusions.length ? `; ${selected.exclusions.join("; ")}` : ""}</p>
                <p className="mt-2 rounded bg-warning-bg px-2 py-1.5 text-[11px] text-warning">
                  Estimasi tidak mengikat. Harga resmi dan diskon volume hanya melalui Official Quotation
                  {external ? " yang diajukan sales internal VKTR." : "."}
                  {result?.ok && result.releasedAt && ` Basis harga: cost structure v${result.versionNo}, dirilis ${formatDate(result.releasedAt)}.`}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="block space-y-1 text-xs text-muted">
      <span>{label}</span>
      <select className="pc-input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Pilih...</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}
