import { createClient } from "@/lib/supabase/server";
import { requireMenu } from "@/lib/menuAccess";
import { canManageProductMasterData } from "@/lib/rbac";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import type { ProductMasterData } from "@/types/database";
import { ProductForm } from "../../ProductForm";
import { ProductStatusButton } from "../../ProductStatusButton";
import { PRODUCT_BASE, groupProducts, productHref } from "../../productGroups";

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ make: string; model: string }>;
  searchParams: Promise<{ new?: string; edit?: string; saved?: string }>;
}) {
  const { make: rawMake, model: rawModel } = await params;
  const decode = (s: string) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  };
  const make = decode(rawMake);
  const model = decode(rawModel);
  const { new: adding, edit, saved } = await searchParams;
  const profile = await requireMenu("product");
  const supabase = await createClient();

  const [{ data: rows }, { data: versions }] = await Promise.all([
    supabase.from("product_master_data").select("*").order("created_at", { ascending: true }),
    supabase.from("cost_structure_version").select("product_id, version_no, status").in("status", ["RELEASED", "DRAFT"]),
  ]);
  const groups = groupProducts((rows ?? []) as ProductMasterData[]);
  const product = groups.find((g) => g.make === make && g.model === model);
  if (!product) notFound();

  const csOf = (id: string) => {
    const vs = ((versions ?? []) as { product_id: string; version_no: number; status: string }[]).filter((v) => v.product_id === id);
    return { released: vs.find((v) => v.status === "RELEASED") ?? null, draft: vs.find((v) => v.status === "DRAFT") ?? null };
  };

  const canEdit = canManageProductMasterData(profile);
  const here = productHref(make, model);
  const editing = canEdit && edit ? product.variants.find((v) => v.id === edit) ?? null : null;
  const showAdd = canEdit && adding === "variant" && !editing;
  const models = groups.map((g) => g.model);

  return (
    <div className="space-y-6">
      <Link href={PRODUCT_BASE} className="text-xs text-primary hover:underline">← Daftar produk</Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{make} {model}</h1>
          <p className="mt-1 text-sm text-muted">
            {product.variants.length} varian · {product.variants.filter((v) => v.status === "ACTIVE").length} aktif
          </p>
        </div>
        {canEdit && !showAdd && !editing && (
          <Link href={`${here}?new=variant`}>
            <Button size="sm"><Plus size={13} /> Tambah Varian</Button>
          </Link>
        )}
      </div>

      {saved && !showAdd && !editing && (
        <p className="rounded-lg bg-success-bg px-3 py-2 text-xs text-success">
          Varian {saved} tersimpan dan tercatat di Audit Trail. Varian baru dapat dikutip setelah cost structure-nya
          dirilis pemilik scope di menu Cost Structure.
        </p>
      )}

      {(showAdd || editing) && (
        <Card className="ring-2 ring-primary/30">
          <CardHeader>
            <div>
              <CardTitle>{editing ? `Ubah Varian — ${editing.name}` : `Tambah Varian — ${make} ${model}`}</CardTitle>
              <CardDescription>
                {editing
                  ? "Kode varian tetap; setiap field yang berubah tercatat di Audit Trail."
                  : "Make & Model sudah terisi sesuai produk ini; lengkapi data varian."}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ProductForm
              key={editing?.id ?? "new-variant"}
              product={editing ?? undefined}
              preset={{ make, model }}
              models={models}
              cancelHref={here}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Varian</CardTitle>
            <CardDescription>Setiap varian punya cost structure sendiri; harga diatur pemilik scope di menu Cost Structure.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-card-border bg-slate-50 text-left text-xs text-muted">
                <th className="px-5 py-2.5 font-medium">Code</th>
                <th className="px-5 py-2.5 font-medium">Varian</th>
                <th className="px-5 py-2.5 font-medium">Type · Variant</th>
                <th className="px-5 py-2.5 font-medium">Build · Loco</th>
                <th className="px-5 py-2.5 font-medium">Cost structure</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
                {canEdit && <th className="px-5 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {product.variants.map((p) => {
                const cs = csOf(p.id);
                return (
                  <tr key={p.id} className={`border-b border-card-border align-top last:border-0 ${editing?.id === p.id ? "bg-blue-50/60" : ""}`}>
                    <td className="px-5 py-3 font-mono text-xs text-muted">{p.code}</td>
                    <td className="px-5 py-3">
                      <div className="font-medium">{p.name}</div>
                      {p.document_description && <div className="mt-0.5 text-[11px] text-muted">{p.document_description}</div>}
                    </td>
                    <td className="px-5 py-3 text-muted">{[p.variant_type, p.variant].filter(Boolean).join(" · ") || p.chassis_variant || "—"}</td>
                    <td className="px-5 py-3 text-muted">{[p.build_type, p.loco && `loco ${p.loco}`].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="px-5 py-3 text-xs">
                      {cs.released ? (
                        <Badge tone="success">v{cs.released.version_no} RELEASED</Badge>
                      ) : (
                        <Badge tone="warning">Belum ada — belum dapat dikutip</Badge>
                      )}
                      {cs.draft && <div className="mt-1 text-[11px] text-muted">Draft v{cs.draft.version_no} sedang disusun</div>}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={p.status === "ACTIVE" ? "success" : "default"}>{p.status}</Badge>
                    </td>
                    {canEdit && (
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        <Link href={`${here}?edit=${p.id}`} className="mr-4 text-xs font-medium text-primary hover:underline">
                          Ubah
                        </Link>
                        <ProductStatusButton id={p.id} status={p.status} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
