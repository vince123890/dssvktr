import { createClient } from "@/lib/supabase/server";
import { requireMenu } from "@/lib/menuAccess";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { canManageProductMasterData } from "@/lib/rbac";
import type { ProductMasterData } from "@/types/database";
import { Plus } from "lucide-react";
import { PRODUCT_BASE, groupProducts, productHref } from "./productGroups";

export default async function ProductListPage() {
  const profile = await requireMenu("product");
  const supabase = await createClient();

  const [{ data: rows }, { data: released }] = await Promise.all([
    supabase.from("product_master_data").select("*").order("created_at", { ascending: true }),
    supabase.from("cost_structure_version").select("product_id").eq("status", "RELEASED"),
  ]);
  const products = groupProducts((rows ?? []) as ProductMasterData[]);
  const quotable = new Set(((released ?? []) as { product_id: string }[]).map((r) => r.product_id));
  const canEdit = canManageProductMasterData(profile);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Product Master Data</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Produk (make · model) dan variannya — spesifikasi, gambar, dan brosur (FR-1.5), dikelola Product Owner,
            terpisah dari struktur biaya. Varian adalah unit yang dikutip; harganya berasal dari Cost Structure.
          </p>
          {!canEdit && (
            <p className="mt-2 inline-block rounded-lg bg-warning-bg px-3 py-1.5 text-xs text-warning">
              Anda login sebagai role non-Product Owner — halaman ini read-only.
            </p>
          )}
        </div>
        {canEdit && (
          <Link href={`${PRODUCT_BASE}/new`}>
            <Button size="sm"><Plus size={13} /> Tambah Produk</Button>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Daftar Produk ({products.length})</CardTitle>
            <CardDescription>Klik produk untuk melihat detail dan variannya, atau menambah varian.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-card-border bg-slate-50 text-left text-xs text-muted">
                <th className="w-8 px-5 py-2.5 font-medium">#</th>
                <th className="px-5 py-2.5 font-medium">Produk</th>
                <th className="px-5 py-2.5 font-medium">Varian</th>
                <th className="px-5 py-2.5 font-medium">Aktif</th>
                <th className="px-5 py-2.5 font-medium">Siap dikutip</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {products.map((g, i) => {
                const active = g.variants.filter((v) => v.status === "ACTIVE");
                const ready = active.filter((v) => quotable.has(v.id)).length;
                const href = productHref(g.make, g.model);
                return (
                  <tr key={href} className="border-b border-card-border align-top last:border-0 hover:bg-blue-50/40">
                    <td className="px-5 py-3 text-muted">{i + 1}</td>
                    <td className="px-5 py-3">
                      <Link href={href} className="font-medium text-primary hover:underline">{g.make} {g.model}</Link>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted">
                      {g.variants.map((v) => <div key={v.id}>{[v.variant_type, v.variant].filter(Boolean).join(" · ") || v.name}</div>)}
                    </td>
                    <td className="px-5 py-3">{active.length} / {g.variants.length}</td>
                    <td className="px-5 py-3">
                      <Badge tone={ready === active.length && ready > 0 ? "success" : "warning"}>{ready} / {active.length}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      <Link href={href} className="text-xs font-medium text-primary hover:underline">Detail →</Link>
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-muted">Belum ada produk terdaftar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted">
        <strong>Siap dikutip</strong> = varian aktif yang cost structure-nya sudah RELEASED oleh pemilik scope (menu Cost
        Structure); hanya varian ini yang muncul di Price Estimate dan Official Quotation.
      </p>
    </div>
  );
}
