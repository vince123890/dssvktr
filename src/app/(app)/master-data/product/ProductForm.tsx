"use client";

import { Button } from "@/components/ui/Button";
import type { ProductMasterData } from "@/types/database";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createProductAction, updateProductAction } from "./actions";

/**
 * FR-1.5.1 — a product VARIANT (make → model → type → variant) with the
 * attributes the Cost Estimate prints: document description, loco,
 * build type, inclusions/exclusions and specification pages.
 * Without `product` it adds a variant; with it, it edits that variant.
 */
export function ProductForm({ product }: { product?: ProductMasterData }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(product);
  const p = product;

  return (
    <form
      ref={formRef}
      key={p?.id ?? "new"}
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = p ? await updateProductAction(p.id, formData) : await createProductAction(formData);
          if (!result.ok) setError(result.error ?? "Gagal menyimpan produk");
          else if (p) router.push(`/master-data/product?saved=${encodeURIComponent(p.code)}`);
          else formRef.current?.reset();
        });
      }}
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
    >
      <Field label={editing ? "Code (tetap)" : "Code *"}>
        <input
          name="code"
          required
          readOnly={editing}
          defaultValue={p?.code}
          placeholder="LDT-4X2-SWB-DMP-90-CKD-MGL"
          className={`pc-input ${editing ? "bg-slate-50 text-muted" : ""}`}
        />
      </Field>
      <Field label="Nama varian *" className="lg:col-span-3"><input name="name" required defaultValue={p?.name} placeholder="VKTR Light Duty Truck 4x2 SWB Dumper 90 kWh" className="pc-input" /></Field>
      <Field label="Make"><input name="make" defaultValue={p ? p.make ?? "" : "VKTR"} className="pc-input" /></Field>
      <Field label="Model"><input name="model" defaultValue={p?.model ?? ""} placeholder="Light Duty Truck" className="pc-input" /></Field>
      <Field label="Type"><input name="variant_type" defaultValue={p?.variant_type ?? ""} placeholder="4x2 Short Wheelbase" className="pc-input" /></Field>
      <Field label="Variant"><input name="variant" defaultValue={p?.variant ?? ""} placeholder="Dumper, Battery 90 kWh" className="pc-input" /></Field>
      <Field label="Wheelbase"><input name="wheelbase" defaultValue={p?.wheelbase ?? ""} placeholder="Short Wheelbase" className="pc-input" /></Field>
      <Field label="Baterai (kWh)"><input name="battery_kwh" type="number" step="any" defaultValue={p?.battery_kwh ?? ""} placeholder="90" className="pc-input" /></Field>
      <Field label="Aplikasi bodi"><input name="body_application" defaultValue={p?.body_application ?? ""} placeholder="Dumper" className="pc-input" /></Field>
      <Field label="Build type">
        <select name="build_type" className="pc-input" defaultValue={p?.build_type ?? "CKD"}>
          <option value="CKD">CKD</option>
          <option value="CBU">CBU</option>
        </select>
      </Field>
      <Field label="Loco (titik penyerahan)"><input name="loco" defaultValue={p ? p.loco ?? "" : "Magelang"} className="pc-input" /></Field>
      <Field label="Deskripsi di dokumen" className="lg:col-span-3">
        <input name="document_description" defaultValue={p?.document_description ?? ""} placeholder="VKTR Light Duty Truck 4x2, Short Wheelbase, with Dumper, Battery 90 kWh, CKD, loco Magelang" className="pc-input" />
      </Field>
      <Field label="Inclusions default (per baris)" className="lg:col-span-2">
        <textarea
          name="default_inclusions"
          rows={3}
          className="pc-input"
          defaultValue={p ? p.default_inclusions.join("\n") : "Onsite training during initial deployment, 2 week\nOnline training refreshment 1x (first year)\nOn-call technical support"}
        />
      </Field>
      <Field label="Exclusions default — at cost (per baris)" className="lg:col-span-2">
        <textarea name="default_exclusions" rows={3} className="pc-input" defaultValue={p ? p.default_exclusions.join("\n") : "Maintenance\nOther Requests"} />
      </Field>
      <Field label="URL halaman spesifikasi (per baris)" className="lg:col-span-4">
        <textarea name="image_urls" rows={2} className="pc-input" defaultValue={p?.image_urls.join("\n") ?? ""} placeholder="/products/ldt-spec-1-features.jpg" />
      </Field>

      {editing && (
        <p className="col-span-2 rounded-lg bg-warning-bg px-3 py-2 text-xs text-warning lg:col-span-4">
          Nama, deskripsi di dokumen, dan halaman spesifikasi langsung berlaku di semua cetakan — termasuk quotation
          yang sudah dirilis bila dicetak ulang. Inclusions/exclusions default hanya berlaku untuk quotation baru.
          Harga tidak diatur di sini, melainkan di Cost Structure.
        </p>
      )}
      {error && <p className="col-span-2 text-xs text-danger lg:col-span-4">{error}</p>}
      <div className="col-span-2 flex items-center justify-end gap-3 lg:col-span-4">
        {editing && <Link href="/master-data/product" className="text-xs text-muted hover:underline">Batal</Link>}
        <Button type="submit" loading={isPending} size="sm">
          {isPending ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Tambah Varian"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block space-y-1 text-xs text-muted ${className ?? ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
