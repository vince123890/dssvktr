"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  createQuotationAction,
  updateQuotationDraftAction,
  type QuotationInput,
} from "./actions";
import { LIKELIHOOD_LABEL, PERIOD_LABEL, PROJECT_TYPE_LABEL } from "@/lib/workflow/labels";
import type { QuotationKyc } from "@/types/database";

export interface ProductOption {
  id: string;
  name: string;
  description: string;
  hasReleasedCost: boolean;
}

export interface QualifierOptions {
  segments: string[];
  industries: string[];
  relationships: string[];
}

export interface ProjectOption {
  id: string;
  code: string;
  customer: string;
  project: string;
}

/**
 * Sheet "Basic Workflow" B, steps 2–3: the KYC form (a–h) plus the
 * vehicles to quote. Mandatory fields follow the sheet exactly; the
 * Salesperson reviews everything on screen before saving.
 */
export function QuotationForm({
  products,
  projects,
  qualifiers,
  initial,
  proposalId,
}: {
  products: ProductOption[];
  projects: ProjectOption[];
  qualifiers: QualifierOptions;
  initial?: { businessLine: string; kyc: QuotationKyc; lines: { product_id: string; quantity: number }[] };
  proposalId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [kyc, setKyc] = useState<QuotationKyc & { existing_project_identifier_id?: string }>(
    initial?.kyc ?? {
      project_type: "NEW_PROJECT",
      production_period: "DAY",
      likelihood: 3,
      requested_scheme: "PURCHASE",
      customer_segment: qualifiers.segments.includes("B2B") ? "B2B" : qualifiers.segments[0],
      relationship: qualifiers.relationships[0],
    }
  );
  const [businessLine, setBusinessLine] = useState(initial?.businessLine ?? "B2B_COMMERCIAL_FLEET");
  const [lines, setLines] = useState<{ product_id: string; quantity: number }[]>(
    initial?.lines ?? [{ product_id: products.find((p) => p.hasReleasedCost)?.id ?? "", quantity: 1 }]
  );

  const set = <K extends keyof typeof kyc>(key: K, value: (typeof kyc)[K]) =>
    setKyc((k) => ({ ...k, [key]: value }));

  function submit() {
    setError(null);
    const payload: QuotationInput = {
      business_line: businessLine as QuotationInput["business_line"],
      kyc: kyc as QuotationInput["kyc"],
      lines,
    };
    startTransition(async () => {
      const result = proposalId
        ? await updateQuotationDraftAction(proposalId, payload)
        : await createQuotationAction(payload);
      if (result.ok && result.proposalId) {
        router.push(`/proposals/${result.proposalId}`);
      } else {
        setError(result.error ?? "Gagal menyimpan");
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Formulir KYC</CardTitle>
            <CardDescription>
              Sheet Basic Workflow B langkah 2 — field bertanda * wajib diisi.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="a. Nama perusahaan *">
            <input className="pc-input" value={kyc.company_name ?? ""} onChange={(e) => set("company_name", e.target.value)} placeholder="PT Siborong Nusa Gemilang" />
          </Field>
          <Field label="Lini bisnis">
            <select className="pc-input" value={businessLine} onChange={(e) => setBusinessLine(e.target.value)}>
              <option value="B2B_COMMERCIAL_FLEET">B2B Commercial Fleet</option>
              <option value="B2G_TENDER_BUS">B2G / Pemerintah</option>
              <option value="CHARGING_INFRA_BUILDOUT">Charging Infrastructure</option>
            </select>
          </Field>
          <Field label="a. Alamat resmi lengkap *" className="md:col-span-2">
            <textarea className="pc-input" rows={2} value={kyc.official_address ?? ""} onChange={(e) => set("official_address", e.target.value)} placeholder="Jalan, kelurahan, kecamatan, kota, kode pos" />
          </Field>
          <Field label="c. Jenis proyek">
            <select className="pc-input" value={kyc.project_type} onChange={(e) => set("project_type", e.target.value as QuotationKyc["project_type"])}>
              {Object.entries(PROJECT_TYPE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
          {kyc.project_type === "NEW_PROJECT" ? (
            <Field label="Nama proyek / lokasi *">
              <input className="pc-input" value={kyc.project_name ?? ""} onChange={(e) => set("project_name", e.target.value)} placeholder="Armada Dumper Site Sumatera Utara" />
            </Field>
          ) : (
            <Field label="Project Identifier proyek berjalan *">
              <select
                className="pc-input"
                value={kyc.existing_project_identifier_id ?? ""}
                onChange={(e) => {
                  const p = projects.find((x) => x.id === e.target.value);
                  setKyc((k) => ({ ...k, existing_project_identifier_id: e.target.value, project_name: p?.project ?? k.project_name }));
                }}
              >
                <option value="">Pilih proyek...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.customer}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="d. Aplikasi (bodi) *">
            <input className="pc-input" value={kyc.application_body ?? ""} onChange={(e) => set("application_body", e.target.value)} placeholder="Dumper / Box / Compactor ..." />
          </Field>
          <Field label="d. Utilisasi (muatan) *">
            <input className="pc-input" value={kyc.utilization_content ?? ""} onChange={(e) => set("utilization_content", e.target.value)} placeholder="Material agregat, pasir ..." />
          </Field>
          <Field label="e. Rute *" className="md:col-span-2">
            <input className="pc-input" value={kyc.route_description ?? ""} onChange={(e) => set("route_description", e.target.value)} placeholder="Quarry → stockpile proyek" />
          </Field>
          <Field label="e. Asal *">
            <input className="pc-input" value={kyc.origin ?? ""} onChange={(e) => set("origin", e.target.value)} />
          </Field>
          <Field label="e. Tujuan *">
            <input className="pc-input" value={kyc.destination ?? ""} onChange={(e) => set("destination", e.target.value)} />
          </Field>
          <div className="grid grid-cols-3 gap-2 md:col-span-2">
            <Field label="e. Produksi *">
              <input className="pc-input" type="number" min={0} value={kyc.production_value ?? ""} onChange={(e) => set("production_value", Number(e.target.value))} />
            </Field>
            <Field label="Satuan *">
              <input className="pc-input" value={kyc.production_unit ?? ""} onChange={(e) => set("production_unit", e.target.value)} placeholder="trip / ton / km" />
            </Field>
            <Field label="Periode">
              <select className="pc-input" value={kyc.production_period} onChange={(e) => set("production_period", e.target.value as QuotationKyc["production_period"])}>
                {Object.entries(PERIOD_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="f. Likelihood *">
            <select className="pc-input" value={kyc.likelihood} onChange={(e) => set("likelihood", Number(e.target.value))}>
              {[5, 4, 3, 2, 1].map((v) => (
                <option key={v} value={v}>{LIKELIHOOD_LABEL[v]}</option>
              ))}
            </select>
          </Field>
          <Field label="h. Skema yang diminta pelanggan">
            <select className="pc-input" value={kyc.requested_scheme} onChange={(e) => set("requested_scheme", e.target.value as "PURCHASE" | "RENTAL")}>
              <option value="PURCHASE">Purchase (beli)</option>
              <option value="RENTAL">Rental (sewa)</option>
            </select>
          </Field>
          <Field label="g. Gap identified *" className="md:col-span-2">
            <textarea className="pc-input" rows={2} value={kyc.gap_identified ?? ""} onChange={(e) => set("gap_identified", e.target.value)} placeholder="Kebutuhan pelanggan yang belum terpenuhi" />
          </Field>
          <Field label="h. Informasi lain" className="md:col-span-2">
            <textarea className="pc-input" rows={2} value={kyc.other_information ?? ""} onChange={(e) => set("other_information", e.target.value)} placeholder="Metode pembayaran, kompetitor, jadwal, dsb." />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Kualifikasi deal *</CardTitle>
            <CardDescription>
              Menentukan Workflow Template yang dipakai (segmen, industri, hubungan pelanggan). Template dipilih
              otomatis saat submit — Anda tidak memilih alur approval sendiri.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Segmen customer *">
            <select className="pc-input" value={kyc.customer_segment ?? ""} onChange={(e) => set("customer_segment", e.target.value)}>
              <option value="">Pilih...</option>
              {qualifiers.segments.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Industri / bidang usaha *">
            <select className="pc-input" value={kyc.industry ?? ""} onChange={(e) => set("industry", e.target.value)}>
              <option value="">Pilih...</option>
              {qualifiers.industries.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Hubungan pelanggan *">
            <select className="pc-input" value={kyc.relationship ?? ""} onChange={(e) => set("relationship", e.target.value)}>
              <option value="">Pilih...</option>
              {qualifiers.relationships.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>b. Varian kendaraan &amp; kuantitas *</CardTitle>
            <CardDescription>Boleh lebih dari satu varian. Hanya varian dengan cost structure RELEASED yang dapat dikutip.</CardDescription>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setLines((ls) => [...ls, { product_id: "", quantity: 1 }])}
          >
            <Plus size={13} /> Tambah varian
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {lines.map((line, idx) => (
            <div key={idx} className="flex items-end gap-2">
              <Field label={`Varian #${idx + 1}`} className="flex-1">
                <select
                  className="pc-input"
                  value={line.product_id}
                  onChange={(e) =>
                    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, product_id: e.target.value } : l)))
                  }
                >
                  <option value="">Pilih make · model · type · variant...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id} disabled={!p.hasReleasedCost}>
                      {p.name}
                      {!p.hasReleasedCost ? " (cost structure belum released)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Qty" className="w-24">
                <input
                  className="pc-input"
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) =>
                    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, quantity: Number(e.target.value) } : l)))
                  }
                />
              </Field>
              <Button
                size="sm"
                variant="ghost"
                disabled={lines.length === 1}
                onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
                aria-label="Hapus varian"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {error && <p className="rounded-lg bg-danger-bg px-3 py-2 text-xs text-danger">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button onClick={submit} loading={isPending}>
          {proposalId ? "Simpan Perubahan Draft" : "Simpan Draft & Tinjau"}
        </Button>
      </div>
    </div>
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
