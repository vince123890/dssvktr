import { createClient } from "@/lib/supabase/server";
import { requireMenu } from "@/lib/menuAccess";
import { canManageProductMasterData } from "@/lib/rbac";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ProductMasterData } from "@/types/database";
import { ProductForm } from "../ProductForm";
import { PRODUCT_BASE, groupProducts } from "../productGroups";

export default async function NewProductPage() {
  const profile = await requireMenu("product");
  if (!canManageProductMasterData(profile)) notFound();
  const supabase = await createClient();
  const { data: rows } = await supabase.from("product_master_data").select("*");
  const models = groupProducts((rows ?? []) as ProductMasterData[]).map((g) => g.model);

  return (
    <div className="space-y-4">
      <Link href={PRODUCT_BASE} className="text-xs text-primary hover:underline">← Daftar produk</Link>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Tambah Produk Baru</CardTitle>
            <CardDescription>
              Isi Make &amp; Model produk baru (mis. Bus, Medium Duty Truck) beserta varian pertamanya — produk terdaftar
              lewat variannya. Varian berikutnya ditambahkan dari halaman detail produk.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ProductForm models={models} preset={{ make: "VKTR", model: "" }} />
        </CardContent>
      </Card>
    </div>
  );
}
