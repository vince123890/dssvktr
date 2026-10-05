"use client";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { FUNCTIONAL_ROLES, FUNCTIONAL_ROLE_LABEL } from "@/lib/rbac";
import { BUSINESS_LINE_LABEL } from "@/lib/workflow/labels";
import { formatIDR } from "@/lib/utils";
import type { FunctionalRole, StepActionKind } from "@/types/database";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  saveTemplateAction,
  setTemplateActiveAction,
  testTemplateResolutionAction,
  type TemplateInput,
  type TemplateTestResult,
} from "./actions";

/**
 * Workflow Template Catalog (PRD FR-2.0.1 v4.1). VKTR expects ~30
 * templates to grow organically after go-live (transcribe.md): the
 * qualifiers are fixed, the catalog keeps growing — all of it here,
 * without code changes.
 */

export interface StepDraft {
  step_name: string;
  action_kind: StepActionKind;
  performer_function: FunctionalRole;
  skip_if_initiator_function: FunctionalRole | null;
  reject_to_step_order: number | null;
  sla_hours: number;
}

export interface TemplateRow {
  code: string;
  name: string;
  description: string | null;
  version: number;
  isActive: boolean;
  isFallback: boolean;
  priority: number;
  qualifiers: string[];
  stepNames: string[];
  hasOwnLadder: boolean;
}

export interface QualifierLists {
  segments: string[];
  industries: string[];
  relationships: string[];
  businessLines: string[];
}

const KIND_LABEL: Record<StepActionKind, string> = {
  VALIDATE: "Validasi permintaan",
  APPROVE: "Persetujuan tambahan",
  GENERATE_QUOTATION: "Generate quotation (quantity band)",
  REVIEW_AND_ROUTE: "Review & rilis / rute tier",
};

export function CatalogTable({ rows }: { rows: TemplateRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const active = rows.filter((r) => r.isActive).length;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Katalog Workflow Template — Official Quotation</CardTitle>
          <CardDescription>
            {active} template aktif dari {rows.length}. Saat quotation disubmit, sistem memilih template aktif yang
            qualifier-nya cocok dengan deal (prioritas tertinggi → paling spesifik); bila tidak ada, dipakai template
            dasar. Pengaju tidak memilih alur sendiri.
          </CardDescription>
        </div>
        <Link href="/settings?tab=workflow&edit=new">
          <Button size="sm"><Plus size={13} /> Template baru</Button>
        </Link>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border bg-slate-50 text-left text-muted">
              <th className="px-4 py-2 font-medium">Template</th>
              <th className="px-4 py-2 font-medium">Qualifier</th>
              <th className="px-4 py-2 font-medium">Langkah</th>
              <th className="px-4 py-2 font-medium">Prioritas</th>
              <th className="px-4 py-2 font-medium">Tier margin</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} className="border-b border-card-border align-top last:border-0">
                <td className="px-4 py-2">
                  <div className="font-medium">{r.name} <span className="font-normal text-muted">v{r.version}</span></div>
                  <div className="font-mono text-[10px] text-muted">{r.code}</div>
                  {r.description && <div className="mt-0.5 max-w-xs text-[11px] text-muted">{r.description}</div>}
                </td>
                <td className="px-4 py-2">
                  {r.isFallback ? <Badge>Dasar (fallback)</Badge> : r.qualifiers.map((q) => <div key={q}>{q}</div>)}
                </td>
                <td className="px-4 py-2">
                  <ol className="list-decimal pl-4">{r.stepNames.map((s, i) => <li key={i}>{s}</li>)}</ol>
                  <div className="text-[10px] text-muted">+ routing tier margin</div>
                </td>
                <td className="px-4 py-2">{r.priority}</td>
                <td className="px-4 py-2">
                  <Link href={`/settings?tab=tier&scope=${encodeURIComponent(r.code)}`} className="text-primary hover:underline">
                    {r.hasOwnLadder ? "Khusus template" : "Global"}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  <Badge tone={r.isActive ? "success" : "default"}>{r.isActive ? "Aktif" : "Nonaktif"}</Badge>
                </td>
                <td className="space-y-1 px-4 py-2 text-right">
                  <Link href={`/settings?tab=workflow&edit=${encodeURIComponent(r.code)}`} className="block text-primary hover:underline">Ubah</Link>
                  <Link href={`/settings?tab=workflow&edit=new&from=${encodeURIComponent(r.code)}`} className="block text-primary hover:underline">Duplikat</Link>
                  {!r.isFallback && (
                    <button
                      type="button"
                      disabled={isPending}
                      className="block w-full text-right text-muted hover:text-foreground"
                      onClick={() =>
                        startTransition(async () => {
                          const res = await setTemplateActiveAction(r.code, !r.isActive);
                          if (res.ok) router.refresh();
                          else setError(res.error ?? "Gagal");
                        })
                      }
                    >
                      {r.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {error && <p className="px-4 py-2 text-xs text-danger">{error}</p>}
      </CardContent>
    </Card>
  );
}

function MultiPick({ label, options, value, onChange, render }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void; render?: (v: string) => string }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] text-muted">{label} <span className="text-[10px]">(kosong = semua)</span></div>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])}
            className={`rounded-full border px-2 py-0.5 text-[11px] ${value.includes(o) ? "border-primary bg-blue-50 text-primary" : "border-card-border text-muted"}`}
          >
            {render ? render(o) : o}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TemplateEditor({
  templateCode,
  initial,
  lists,
  isFallback,
}: {
  templateCode: string | null;
  initial: TemplateInput;
  lists: QualifierLists;
  isFallback: boolean;
}) {
  const router = useRouter();
  const [t, setT] = useState(initial);
  const steps = t.steps as StepDraft[];
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const set = (patch: Partial<TemplateInput>) => setT((x) => ({ ...x, ...patch }));
  const setSteps = (fn: (s: StepDraft[]) => StepDraft[]) => setT((x) => ({ ...x, steps: fn(x.steps as StepDraft[]) }));
  const update = (idx: number, patch: Partial<StepDraft>) => setSteps((s) => s.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const move = (idx: number, dir: -1 | 1) =>
    setSteps((s) => {
      const n = [...s];
      const j = idx + dir;
      if (j < 0 || j >= n.length) return s;
      [n[idx], n[j]] = [n[j], n[idx]];
      return n;
    });
  const num = (v: string) => (v === "" ? null : Number(v));

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{templateCode ? `Ubah template ${templateCode}` : "Template baru"}</CardTitle>
          <CardDescription>
            Simpan = versi baru; quotation yang sedang berjalan tetap memakai versi lamanya. Langkah KYC & submit
            selalu oleh Salesperson; routing tier margin selalu setelah Review.
          </CardDescription>
        </div>
        <Link href="/settings?tab=workflow" className="text-xs text-primary hover:underline">← Katalog</Link>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="space-y-1 text-[11px] text-muted md:col-span-2">
            <span>Nama template</span>
            <input className="pc-input" value={t.name} onChange={(e) => set({ name: e.target.value })} placeholder="Official Quotation — Municipality" />
          </label>
          <label className="space-y-1 text-[11px] text-muted">
            <span>Prioritas (lebih tinggi menang)</span>
            <input className="pc-input" type="number" min={0} value={t.priority} onChange={(e) => set({ priority: Number(e.target.value) })} />
          </label>
          <div className="text-[11px] text-muted">{isFallback && <Badge>Template dasar — dipakai bila tidak ada yang cocok</Badge>}</div>
          <label className="space-y-1 text-[11px] text-muted md:col-span-4">
            <span>Deskripsi</span>
            <input className="pc-input" value={t.description ?? ""} onChange={(e) => set({ description: e.target.value })} />
          </label>
        </div>

        <div className="space-y-3 rounded-lg border border-card-border p-3">
          <div className="text-xs font-semibold">Qualifier — kapan template ini dipakai</div>
          {isFallback && <p className="text-[11px] text-muted">Template dasar tidak memakai qualifier.</p>}
          {!isFallback && (
            <>
              <MultiPick label="Segmen customer" options={lists.segments} value={t.q_segments} onChange={(v) => set({ q_segments: v })} />
              <MultiPick label="Industri / bidang usaha" options={lists.industries} value={t.q_industries} onChange={(v) => set({ q_industries: v })} />
              <MultiPick label="Hubungan pelanggan" options={lists.relationships} value={t.q_relationships} onChange={(v) => set({ q_relationships: v })} />
              <MultiPick label="Lini bisnis" options={lists.businessLines} value={t.q_business_lines} onChange={(v) => set({ q_business_lines: v })} render={(v) => BUSINESS_LINE_LABEL[v] ?? v} />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <label className="space-y-1 text-[11px] text-muted">
                  <span>Qty min</span>
                  <input className="pc-input" type="number" min={1} value={t.q_min_qty ?? ""} onChange={(e) => set({ q_min_qty: num(e.target.value) })} />
                </label>
                <label className="space-y-1 text-[11px] text-muted">
                  <span>Qty maks</span>
                  <input className="pc-input" type="number" min={1} value={t.q_max_qty ?? ""} onChange={(e) => set({ q_max_qty: num(e.target.value) })} />
                </label>
                <label className="space-y-1 text-[11px] text-muted">
                  <span>Estimasi nilai min (Rp)</span>
                  <input className="pc-input" type="number" min={0} value={t.min_value} onChange={(e) => set({ min_value: Number(e.target.value) || 0 })} />
                </label>
                <label className="space-y-1 text-[11px] text-muted">
                  <span>Estimasi nilai maks (Rp)</span>
                  <input className="pc-input" type="number" min={0} value={t.max_value ?? ""} onChange={(e) => set({ max_value: num(e.target.value) })} />
                </label>
                <label className="space-y-1 text-[11px] text-muted">
                  <span>Customer blacklist</span>
                  <select className="pc-input" value={t.q_blacklist === null ? "" : t.q_blacklist ? "yes" : "no"} onChange={(e) => set({ q_blacklist: e.target.value === "" ? null : e.target.value === "yes" })}>
                    <option value="">Semua</option>
                    <option value="yes">Hanya blacklist</option>
                    <option value="no">Hanya non-blacklist</option>
                  </select>
                </label>
              </div>
            </>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold">Langkah approval</div>
          {steps.map((s, idx) => (
            <div key={idx} className="grid grid-cols-1 gap-2 rounded-lg border border-card-border p-3 md:grid-cols-12">
              <div className="flex items-center gap-1 md:col-span-1">
                <span className="text-sm font-semibold">{idx + 1}</span>
                <button type="button" onClick={() => move(idx, -1)} className="text-muted hover:text-foreground" aria-label="Naik"><ArrowUp size={13} /></button>
                <button type="button" onClick={() => move(idx, 1)} className="text-muted hover:text-foreground" aria-label="Turun"><ArrowDown size={13} /></button>
              </div>
              <label className="space-y-1 text-[11px] text-muted md:col-span-3">
                <span>Nama langkah</span>
                <input className="pc-input" value={s.step_name} onChange={(e) => update(idx, { step_name: e.target.value })} />
              </label>
              <label className="space-y-1 text-[11px] text-muted md:col-span-2">
                <span>Jenis aksi</span>
                <select className="pc-input" value={s.action_kind} onChange={(e) => update(idx, { action_kind: e.target.value as StepActionKind })}>
                  {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-[11px] text-muted md:col-span-2">
                <span>Pelaksana (fungsi)</span>
                <select className="pc-input" value={s.performer_function} onChange={(e) => update(idx, { performer_function: e.target.value as FunctionalRole })}>
                  {FUNCTIONAL_ROLES.map((f) => <option key={f} value={f}>{FUNCTIONAL_ROLE_LABEL[f]}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-[11px] text-muted md:col-span-2">
                <span>Lewati bila pengaju punya fungsi</span>
                <select className="pc-input" value={s.skip_if_initiator_function ?? ""} onChange={(e) => update(idx, { skip_if_initiator_function: (e.target.value || null) as FunctionalRole | null })}>
                  <option value="">— tidak dilewati —</option>
                  {FUNCTIONAL_ROLES.map((f) => <option key={f} value={f}>{FUNCTIONAL_ROLE_LABEL[f]}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-[11px] text-muted md:col-span-1">
                <span>Bila ditolak</span>
                <select className="pc-input" value={s.reject_to_step_order ?? ""} onChange={(e) => update(idx, { reject_to_step_order: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Salesperson (draft)</option>
                  {steps.slice(0, idx).map((p, j) => <option key={j} value={j + 1}>Langkah {j + 1}</option>)}
                </select>
              </label>
              <div className="flex items-end gap-1 md:col-span-1">
                <label className="space-y-1 text-[11px] text-muted">
                  <span>SLA (jam)</span>
                  <input className="pc-input" type="number" min={1} value={s.sla_hours} onChange={(e) => update(idx, { sla_hours: Number(e.target.value) })} />
                </label>
                <button type="button" onClick={() => setSteps((st) => st.filter((_, i) => i !== idx))} className="mb-1.5 text-muted hover:text-danger" aria-label="Hapus langkah">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              setSteps((s) => [
                ...s.slice(0, Math.max(0, s.length - 1)),
                { step_name: "Persetujuan tambahan", action_kind: "APPROVE", performer_function: "SALES_RELEASER", skip_if_initiator_function: null, reject_to_step_order: null, sla_hours: 24 },
                ...s.slice(Math.max(0, s.length - 1)),
              ])
            }
          >
            <Plus size={13} /> Tambah langkah
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-card-border pt-3">
          <Button
            size="sm"
            loading={isPending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const res = await saveTemplateAction(templateCode, t);
                if (res.ok && res.templateCode) router.push(`/settings?tab=workflow&saved=${encodeURIComponent(res.templateCode)}`);
                else setError(res.error ?? "Gagal menyimpan");
              })
            }
          >
            {templateCode ? "Simpan sebagai versi baru" : "Buat template"}
          </Button>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function TemplateTester({ lists }: { lists: QualifierLists }) {
  const [attrs, setAttrs] = useState({
    segment: lists.segments[1] ?? lists.segments[0] ?? "",
    industry: lists.industries[0] ?? "",
    relationship: lists.relationships[0] ?? "",
    businessLine: lists.businessLines[0] ?? "",
    quantity: 1,
    estimatedValue: 829550000,
    isBlacklisted: false,
  });
  const [result, setResult] = useState<TemplateTestResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const sel = (key: "segment" | "industry" | "relationship" | "businessLine", options: string[], label: string) => (
    <label className="space-y-1 text-[11px] text-muted">
      <span>{label}</span>
      <select className="pc-input" value={attrs[key]} onChange={(e) => setAttrs({ ...attrs, [key]: e.target.value })}>
        {options.map((o) => <option key={o} value={o}>{key === "businessLine" ? BUSINESS_LINE_LABEL[o] ?? o : o}</option>)}
      </select>
    </label>
  );

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Uji pemilihan template</CardTitle>
          <CardDescription>Simulasikan atribut deal untuk melihat template mana yang akan dipakai saat submit.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-7">
          {sel("segment", lists.segments, "Segmen")}
          {sel("industry", lists.industries, "Industri")}
          {sel("relationship", lists.relationships, "Hubungan")}
          {sel("businessLine", lists.businessLines, "Lini bisnis")}
          <label className="space-y-1 text-[11px] text-muted">
            <span>Qty</span>
            <input className="pc-input" type="number" min={1} value={attrs.quantity} onChange={(e) => setAttrs({ ...attrs, quantity: Number(e.target.value) })} />
          </label>
          <label className="space-y-1 text-[11px] text-muted">
            <span>Estimasi nilai (Rp)</span>
            <input className="pc-input" type="number" min={0} value={attrs.estimatedValue} onChange={(e) => setAttrs({ ...attrs, estimatedValue: Number(e.target.value) })} />
          </label>
          <label className="flex items-end gap-1 pb-2 text-[11px] text-muted">
            <input type="checkbox" checked={attrs.isBlacklisted} onChange={(e) => setAttrs({ ...attrs, isBlacklisted: e.target.checked })} /> Blacklist
          </label>
        </div>
        <Button size="sm" variant="secondary" loading={isPending} onClick={() => startTransition(async () => setResult(await testTemplateResolutionAction(attrs)))}>
          Uji
        </Button>
        {result?.ok && (
          <div className="space-y-2 text-xs">
            <div className="rounded-lg bg-blue-50 px-3 py-2">
              Terpilih: <strong>{result.templateName}</strong> — {result.reason}
              <div className="text-muted">Estimasi nilai {formatIDR(attrs.estimatedValue)}</div>
            </div>
            <table className="w-full">
              <tbody>
                {result.rows?.map((r) => (
                  <tr key={r.name} className="border-b border-card-border last:border-0">
                    <td className="py-1">{r.name}</td>
                    <td className="py-1">{r.matched ? <Badge tone="success">cocok</Badge> : <Badge>tidak</Badge>}</td>
                    <td className="py-1 text-muted">{r.failed.length ? `gagal: ${r.failed.join(", ")}` : ""}</td>
                    <td className="py-1 text-right text-muted">prioritas {r.priority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {result && !result.ok && <p className="text-xs text-danger">{result.error}</p>}
      </CardContent>
    </Card>
  );
}
