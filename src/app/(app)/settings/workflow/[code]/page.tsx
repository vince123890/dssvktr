import { createClient } from "@/lib/supabase/server";
import { FUNCTIONAL_ROLE_LABEL, canManageSettings, slotLabel } from "@/lib/rbac";
import { requireMenu } from "@/lib/menuAccess";
import { BUSINESS_LINE_LABEL, STATUS_LABEL, STATUS_TONE, STEP_KIND_LABEL } from "@/lib/workflow/labels";
import { describeQualifiers, loadTemplateBundle } from "@/lib/workflow/templateCatalog";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TemplateActiveToggle } from "../../WorkflowCatalog";
import type { AppRole, FunctionalRole, MarginTierAuthority, PricingProposal } from "@/types/database";

type UsageRow = Pick<PricingProposal, "id" | "proposal_number" | "title" | "customer_name" | "current_status" | "workflow_definition_id">;

const pct = (v: number | null) => (v === null ? null : `${Number(v).toLocaleString("id-ID")}%`);

function tierRange(t: MarginTierAuthority): string {
  const lo = pct(t.gpm_lower_bound_pct);
  const hi = pct(t.gpm_upper_bound_pct);
  if (lo && hi) return `GM ${lo} – < ${hi}`;
  if (lo) return `GM ≥ ${lo}`;
  if (hi) return `GM < ${hi}`;
  return "Semua GM";
}

export default async function WorkflowDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const code = decodeURIComponent((await params).code);
  const { saved } = await searchParams;
  const me = await requireMenu("settings");
  if (!canManageSettings(me)) notFound();
  const supabase = await createClient();

  const bundle = await loadTemplateBundle(supabase, code);
  if (!bundle) notFound();
  const { latest: d, versions, steps } = bundle;
  const versionIds = versions.map((v) => v.id);

  const [{ data: roleRows }, { data: tierRows }, { data: usage, count: usageCount }] = await Promise.all([
    supabase.from("app_role").select("code, name"),
    supabase.from("margin_tier_authority").select("*").eq("is_active", true).order("tier"),
    supabase
      .from("pricing_proposal")
      .select("id, proposal_number, title, customer_name, current_status, workflow_definition_id", { count: "exact" })
      // Seeded history carries only the template code; live submits carry both.
      .or(`workflow_template_code.eq."${code}",workflow_definition_id.in.(${versionIds.join(",")})`)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const roles = (roleRows ?? []) as Pick<AppRole, "code" | "name">[];
  const tiers = (tierRows ?? []) as MarginTierAuthority[];
  const own = tiers.filter((t) => t.workflow_template_code === code);
  const ladder = own.length > 0 ? own : tiers.filter((t) => !t.workflow_template_code && t.business_line === null);
  const versionOf = new Map(versions.map((v) => [v.id, v.version]));
  const qualifiers = describeQualifiers(d, BUSINESS_LINE_LABEL);
  const fn = (f: FunctionalRole | null) => (f ? FUNCTIONAL_ROLE_LABEL[f] ?? f : "—");

  return (
    <div className="space-y-6">
      <Link href="/settings?tab=workflow" className="text-xs text-primary hover:underline">← Daftar workflow</Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{d.name}</h1>
            <Badge tone={d.is_active ? "success" : "default"}>{d.is_active ? "Aktif" : "Nonaktif"}</Badge>
            {d.is_fallback && <Badge tone="info">Workflow dasar</Badge>}
          </div>
          <p className="mt-1 font-mono text-xs text-muted">{code} · versi {d.version} · prioritas {d.priority}</p>
          {d.description && <p className="mt-2 max-w-2xl text-sm text-muted">{d.description}</p>}
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <Link href={`/settings/workflow/${encodeURIComponent(code)}/edit`}><Button size="sm">Ubah</Button></Link>
          <Link href={`/settings/workflow/new?from=${encodeURIComponent(code)}`}><Button size="sm" variant="secondary">Duplikat</Button></Link>
          <TemplateActiveToggle code={code} isActive={d.is_active} isFallback={d.is_fallback} />
        </div>
      </div>

      {saved && <p className="rounded-lg bg-success-bg px-3 py-2 text-xs text-success">Workflow tersimpan sebagai versi {d.version}.</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Kapan dipakai</CardTitle>
              <CardDescription>Semua syarat harus cocok saat quotation disubmit.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="text-sm">
            {d.is_fallback ? (
              <p>Dipakai bila tidak ada workflow aktif lain yang cocok dengan deal.</p>
            ) : qualifiers.length === 0 ? (
              <p className="text-muted">Tanpa qualifier — cocok untuk semua deal (sesuai prioritas).</p>
            ) : (
              <ul className="list-disc space-y-1 pl-5">{qualifiers.map((q) => <li key={q}>{q}</li>)}</ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Tier margin {own.length > 0 ? "(khusus workflow ini)" : "(global)"}</CardTitle>
              <CardDescription>Siapa yang menyetujui setelah Review, menurut GM quotation.</CardDescription>
            </div>
            <Link href={`/settings?tab=tier&scope=${encodeURIComponent(code)}`} className="text-xs text-primary hover:underline">
              {own.length > 0 ? "Ubah tier" : "Buat tier khusus"}
            </Link>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {ladder.map((t) => (
              <div key={t.id} className="rounded-lg border border-card-border p-2">
                <div className="flex justify-between font-medium">
                  <span>Tier {t.tier}</span>
                  <span className="text-muted">{tierRange(t)}</span>
                </div>
                <div className="mt-1">
                  {t.decision_slots.length
                    ? `Disetujui: ${t.decision_slots.map((s) => slotLabel(s, roles)).join(" + ")}`
                    : "Langsung rilis (tanpa approval tier)"}
                </div>
                {t.cc_slots.length > 0 && <div className="text-muted">Tembusan: {t.cc_slots.map((s) => slotLabel(s, roles)).join(", ")}</div>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Alur langkah</CardTitle>
            <CardDescription>Urutan yang dijalani quotation dengan workflow ini.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-card-border bg-slate-50 text-left text-muted">
                <th className="w-8 px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Langkah</th>
                <th className="px-4 py-2 font-medium">Jenis</th>
                <th className="px-4 py-2 font-medium">Pelaksana</th>
                <th className="px-4 py-2 font-medium">Dilewati bila pengaju</th>
                <th className="px-4 py-2 font-medium">Bila ditolak</th>
                <th className="px-4 py-2 font-medium">SLA</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-card-border text-muted">
                <td className="px-4 py-2">0</td>
                <td className="px-4 py-2">KYC &amp; submit</td>
                <td className="px-4 py-2">Pengajuan</td>
                <td className="px-4 py-2">Salesperson</td>
                <td className="px-4 py-2" colSpan={3}>Selalu ada</td>
              </tr>
              {steps.map((s) => (
                <tr key={s.id} className="border-b border-card-border">
                  <td className="px-4 py-2">{s.step_order}</td>
                  <td className="px-4 py-2 font-medium">{s.step_name ?? `Langkah ${s.step_order}`}</td>
                  <td className="px-4 py-2">{s.action_kind ? STEP_KIND_LABEL[s.action_kind] : "—"}</td>
                  <td className="px-4 py-2">{fn(s.performer_function)}</td>
                  <td className="px-4 py-2">{fn(s.skip_if_initiator_function)}</td>
                  <td className="px-4 py-2">{s.reject_to_step_order ? `Kembali ke langkah ${s.reject_to_step_order}` : "Kembali ke pengaju (draft)"}</td>
                  <td className="px-4 py-2">{s.sla_hours} jam</td>
                </tr>
              ))}
              <tr className="text-muted">
                <td className="px-4 py-2">{steps.length + 1}</td>
                <td className="px-4 py-2">Approval tier margin</td>
                <td className="px-4 py-2">Routing GM</td>
                <td className="px-4 py-2" colSpan={4}>Sesuai tier margin di atas, lalu quotation dirilis</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Riwayat versi ({versions.length})</CardTitle>
              <CardDescription>Quotation yang sedang berjalan tetap memakai versi saat disubmit.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center justify-between border-b border-card-border py-1 last:border-0">
                <span>v{v.version} — {v.name}</span>
                <span className="flex items-center gap-1 text-muted">
                  {formatDate(v.created_at)}
                  {v.is_active && <Badge tone="success">aktif</Badge>}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Pemakaian ({usageCount ?? 0} quotation)</CardTitle>
              <CardDescription>10 quotation terbaru yang memakai workflow ini.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            {(usage ?? []).length === 0 && <p className="text-muted">Belum dipakai.</p>}
            {((usage ?? []) as UsageRow[]).map((p) => (
              <Link
                key={p.id}
                href={`/proposals/${p.id}`}
                className="flex items-center justify-between gap-2 border-b border-card-border py-1 last:border-0 hover:bg-blue-50/40"
              >
                <span>
                  <span className="font-medium text-primary">{p.proposal_number}</span> · {p.customer_name ?? p.title}
                  {p.workflow_definition_id && versionOf.has(p.workflow_definition_id) && <span className="text-muted"> · v{versionOf.get(p.workflow_definition_id)}</span>}
                </span>
                <Badge tone={STATUS_TONE[p.current_status]}>{STATUS_LABEL[p.current_status]}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
