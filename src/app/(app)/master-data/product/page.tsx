import { createClient } from "@/lib/supabase/server";
import { requireMenu } from "@/lib/menuAccess";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { canManageProductMasterData } from "@/lib/rbac";
import type { ProductMasterData } from "@/types/database";
import { ProductForm } from "./ProductForm";
import { ProductStatusButton } from "./ProductStatusButton";

export default async function ProductMasterDataPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; saved?: string }>;
}) {
  const { edit, saved } = await searchParams;
  const profile = await requireMenu("product");
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("product_master_data")
    .select("*")
    .order("created_at", { ascending: false });

  const items = (products ?? []) as ProductMasterData[];
  const canEdit = canManageProductMasterData(profile);
  const editing = canEdit && edit ? items.find((p) => p.id === edit) ?? null : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Product Master Data</h1>
        <p className="text-sm text-muted mt-1">
          Spesifikasi, varian sasis/karoseri, gambar, dan brosur produk
          (FR-1.5) — dikelola Product Owner, terpisah dari struktur biaya.
          Konten ini mengalir ke dokumen quotation (FR-1.5.2/FR-1.5.3), bukan
          menjadi cost item.
        </p>
        {!canEdit && (
          <p className="text-xs text-warning bg-warning-bg inline-block rounded-lg px-3 py-1.5 mt-2">
            Anda login sebagai role non-Product Owner — halaman ini read-only.
          </p>
        )}
      </div>

      {saved && !editing && (
        <p className="rounded-lg bg-success-bg px-3 py-2 text-xs text-success">Perubahan varian {saved} tersimpan dan tercatat di Audit Trail.</p>
      )}

      {editing ? (
        <Card className="ring-2 ring-primary/30">
          <CardHeader>
            <div>
              <CardTitle>Ubah Varian — {editing.name}</CardTitle>
              <CardDescription>Kode varian tetap; setiap field yang berubah tercatat di Audit Trail.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ProductForm product={editing} />
          </CardContent>
        </Card>
      ) : (
        canEdit && (
          <Card>
            <CardHeader>
              <CardTitle>Tambah Varian Baru</CardTitle>
            </CardHeader>
            <CardContent>
              <ProductForm />
            </CardContent>
          </Card>
        )
      )}

      <Card>
        <CardHeader>
          <CardTitle>Katalog Produk</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border bg-slate-50 text-left text-xs text-muted">
                <th className="px-5 py-2.5 font-medium">Code</th>
                <th className="px-5 py-2.5 font-medium">Name</th>
                <th className="px-5 py-2.5 font-medium">Model · Type · Variant</th>
                <th className="px-5 py-2.5 font-medium">Build · Loco</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
                {canEdit && <th className="px-5 py-2.5 font-medium" />}
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className={`border-b border-card-border last:border-0 ${editing?.id === p.id ? "bg-blue-50/60" : ""}`}>
                  <td className="px-5 py-2.5 font-mono text-xs text-muted">{p.code}</td>
                  <td className="px-5 py-2.5 font-medium">{p.name}</td>
                  <td className="px-5 py-2.5 text-muted">{[p.model, p.variant_type, p.variant].filter(Boolean).join(" · ") || p.chassis_variant || "—"}</td>
                  <td className="px-5 py-2.5 text-muted">{[p.build_type, p.loco && `loco ${p.loco}`].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-5 py-2.5">
                    <Badge tone={p.status === "ACTIVE" ? "success" : "default"}>
                      {p.status}
                    </Badge>
                  </td>
                  {canEdit && (
                    <td className="whitespace-nowrap px-5 py-2.5 text-right">
                      <Link href={`/master-data/product?edit=${p.id}`} className="mr-4 text-xs font-medium text-primary hover:underline">
                        Ubah
                      </Link>
                      <ProductStatusButton id={p.id} status={p.status} />
                    </td>
                  )}
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="px-5 py-6 text-center text-muted">
                    Belum ada produk terdaftar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
