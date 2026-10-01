"use client";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { FUNCTIONAL_ROLES, FUNCTIONAL_ROLE_LABEL } from "@/lib/rbac";
import type { AppSettings } from "@/lib/settings";
import type {
  AppRole,
  CostScope,
  FunctionalRole,
  MarginTierAuthority,
  QuantityBand,
  Scenario,
  ScopeAuthority,
  ScopeSegregationRule,
  StepActionKind,
} from "@/types/database";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import {
  assignUserRoleAction,
  saveBandsAction,
  saveGeneralSettingsAction,
  saveMenuAccessAction,
  saveRoleAction,
  saveScopeAuthorityAction,
  saveSegregationAction,
  saveTiersAction,
  saveWorkflowStepsAction,
} from "./actions";

function useSaver() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = (fn: () => Promise<{ ok: boolean; error?: string }>, okText = "Tersimpan.") =>
    startTransition(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: r.error ?? "Gagal menyimpan" });
      if (r.ok) router.refresh();
    });
  const feedback =
    msg ? <p className={`text-xs ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p> : null;
  return { isPending, save, feedback };
}

// ---------------------------------------------------------------------
// Roles & users
// ---------------------------------------------------------------------

export function RolesEditor({ roles }: { roles: AppRole[] }) {
  const [rows, setRows] = useState(roles);
  const [draft, setDraft] = useState<Pick<AppRole, "code" | "name" | "functional_roles" | "is_external" | "is_active" | "sort_order">>({
    code: "",
    name: "",
    functional_roles: [],
    is_external: false,
    is_active: true,
    sort_order: (roles.length + 1) * 10,
  });
  const { isPending, save, feedback } = useSaver();

  const toggleFn = (fns: FunctionalRole[], fn: FunctionalRole) =>
    fns.includes(fn) ? fns.filter((f) => f !== fn) : [...fns, fn];

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Role (sheet Actors)</CardTitle>
          <CardDescription>
            Nama role bebas diatur. Logika aplikasi hanya membaca <strong>fungsi</strong> yang dicentang — mis. role baru
            &quot;Corporate Finance Manager&quot; dengan fungsi Profitability Owner langsung ikut alur tanpa ubah kode.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-card-border text-left text-muted">
                <th className="py-2 pr-2 font-medium">Kode</th>
                <th className="py-2 pr-2 font-medium">Nama</th>
                <th className="py-2 pr-2 font-medium">Fungsi</th>
                <th className="py-2 pr-2 font-medium">Eksternal</th>
                <th className="py-2 pr-2 font-medium">Aktif</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.code} className="border-b border-card-border align-top last:border-0">
                  <td className="py-2 pr-2 font-mono">{r.code}</td>
                  <td className="py-2 pr-2">
                    <input className="pc-input" value={r.name} onChange={(e) => setRows((rs) => rs.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))} />
                  </td>
                  <td className="py-2 pr-2">
                    <div className="flex flex-wrap gap-1">
                      {FUNCTIONAL_ROLES.map((fn) => (
                        <button
                          key={fn}
                          type="button"
                          onClick={() => setRows((rs) => rs.map((x, i) => (i === idx ? { ...x, functional_roles: toggleFn(x.functional_roles, fn) } : x)))}
                          className={`rounded-full border px-2 py-0.5 text-[10px] ${r.functional_roles.includes(fn) ? "border-primary bg-blue-50 text-primary" : "border-card-border text-muted"}`}
                          title={FUNCTIONAL_ROLE_LABEL[fn]}
                        >
                          {fn}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 pr-2">
                    <input type="checkbox" checked={r.is_external} onChange={(e) => setRows((rs) => rs.map((x, i) => (i === idx ? { ...x, is_external: e.target.checked } : x)))} />
                  </td>
                  <td className="py-2 pr-2">
                    <input type="checkbox" checked={r.is_active} onChange={(e) => setRows((rs) => rs.map((x, i) => (i === idx ? { ...x, is_active: e.target.checked } : x)))} />
                  </td>
                  <td className="py-2">
                    <Button size="sm" variant="secondary" disabled={isPending} onClick={() => save(() => saveRoleAction(r), `Role ${r.code} tersimpan.`)}>
                      Simpan
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-dashed border-card-border p-3">
          <div className="mb-2 text-xs font-semibold">Tambah role baru</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <input className="pc-input" placeholder="KODE_ROLE" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} />
            <input className="pc-input md:col-span-2" placeholder="Nama role (mis. Corporate Finance Manager)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {FUNCTIONAL_ROLES.map((fn) => (
              <button
                key={fn}
                type="button"
                onClick={() => setDraft({ ...draft, functional_roles: toggleFn(draft.functional_roles, fn) })}
                className={`rounded-full border px-2 py-0.5 text-[10px] ${draft.functional_roles.includes(fn) ? "border-primary bg-blue-50 text-primary" : "border-card-border text-muted"}`}
              >
                {FUNCTIONAL_ROLE_LABEL[fn]}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <label className="flex items-center gap-1 text-xs text-muted">
              <input type="checkbox" checked={draft.is_external} onChange={(e) => setDraft({ ...draft, is_external: e.target.checked })} /> Eksternal (agensi)
            </label>
            <Button
              size="sm"
              disabled={isPending}
              onClick={() =>
                save(async () => {
                  const r = await saveRoleAction(draft);
                  if (r.ok) setRows((rs) => [...rs, { ...draft, created_at: "", updated_at: "" } as AppRole]);
                  return r;
                }, "Role baru ditambahkan.")
              }
            >
              <Plus size={13} /> Tambah role
            </Button>
          </div>
        </div>
        {feedback}
      </CardContent>
    </Card>
  );
}

export function UsersEditor({
  users,
  roles,
}: {
  users: { id: string; full_name: string; email: string; app_role_code: string | null }[];
  roles: AppRole[];
}) {
  const { isPending, save, feedback } = useSaver();
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>User → Role</CardTitle>
          <CardDescription>Akun dibuat lewat Supabase Auth / seed; di sini role-nya diatur.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border bg-slate-50 text-left text-muted">
              <th className="px-5 py-2 font-medium">Nama</th>
              <th className="px-5 py-2 font-medium">Email</th>
              <th className="px-5 py-2 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-card-border last:border-0">
                <td className="px-5 py-2 font-medium">{u.full_name}</td>
                <td className="px-5 py-2 text-muted">{u.email}</td>
                <td className="px-5 py-2">
                  <select
                    className="pc-input max-w-xs"
                    defaultValue={u.app_role_code ?? ""}
                    disabled={isPending}
                    onChange={(e) => e.target.value && save(() => assignUserRoleAction(u.id, e.target.value), `Role ${u.full_name} diperbarui.`)}
                  >
                    <option value="">— belum ada role —</option>
                    {roles.map((r) => (
                      <option key={r.code} value={r.code}>{r.name}{r.is_active ? "" : " (nonaktif)"}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-2">{feedback}</div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------
// Scope authority matrix
// ---------------------------------------------------------------------

const SCOPES: CostScope[] = ["COGS", "ADD_ONS", "MARGIN", "SALES"];
const SCENARIOS: Scenario[] = ["REGULAR", "DEVIATION"];

export function ScopeAuthorityEditor({
  roles,
  rows,
  rules,
  deviationThreshold,
}: {
  roles: AppRole[];
  rows: ScopeAuthority[];
  rules: ScopeSegregationRule[];
  deviationThreshold: number;
}) {
  const key = (r: string, s: CostScope, sc: Scenario) => `${r}|${s}|${sc}`;
  const [matrix, setMatrix] = useState<Record<string, { make: boolean; check: boolean; release: boolean }>>(() => {
    const m: Record<string, { make: boolean; check: boolean; release: boolean }> = {};
    for (const r of rows) m[key(r.app_role_code, r.scope, r.scenario)] = { make: r.can_make, check: r.can_check, release: r.can_release };
    return m;
  });
  const [seg, setSeg] = useState(rules);
  const { isPending, save, feedback } = useSaver();
  const internalRoles = roles.filter((r) => !r.is_external);

  const toggle = (k: string, field: "make" | "check" | "release") =>
    setMatrix((m) => {
      const cur = m[k] ?? { make: false, check: false, release: false };
      return { ...m, [k]: { ...cur, [field]: !cur[field] } };
    });

  function payload() {
    const out: { app_role_code: string; scope: CostScope; scenario: Scenario; can_make: boolean; can_check: boolean; can_release: boolean }[] = [];
    for (const r of internalRoles)
      for (const s of SCOPES)
        for (const sc of SCENARIOS) {
          const v = matrix[key(r.code, s, sc)];
          if (v) out.push({ app_role_code: r.code, scope: s, scenario: sc, can_make: v.make, can_check: v.check, can_release: v.release });
        }
    return out;
  }

  return (
    <div className="space-y-6">
      {SCENARIOS.map((sc) => (
        <Card key={sc}>
          <CardHeader>
            <div>
              <CardTitle>Scope Authority — skenario {sc === "REGULAR" ? `Regular (GM ≥ ${deviationThreshold}%)` : `Deviation (GM < ${deviationThreshold}%)`}</CardTitle>
              <CardDescription>M = Maker · C = Checker · R = Releaser (bentuk sama dengan sheet Actors)</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-card-border bg-slate-50 text-left text-muted">
                  <th className="px-4 py-2 font-medium">Role</th>
                  {SCOPES.map((s) => (
                    <th key={s} className="px-4 py-2 text-center font-medium">{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {internalRoles.map((r) => (
                  <tr key={r.code} className="border-b border-card-border last:border-0">
                    <td className="px-4 py-2 font-medium">{r.name}</td>
                    {SCOPES.map((s) => {
                      const k = key(r.code, s, sc);
                      const v = matrix[k] ?? { make: false, check: false, release: false };
                      return (
                        <td key={s} className="px-4 py-2 text-center">
                          <div className="inline-flex gap-1">
                            {(["make", "check", "release"] as const).map((f) => (
                              <button
                                key={f}
                                type="button"
                                onClick={() => toggle(k, f)}
                                className={`h-6 w-6 rounded border text-[10px] font-semibold ${v[f] ? "border-primary bg-primary text-white" : "border-card-border text-muted"}`}
                              >
                                {f[0].toUpperCase()}
                              </button>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}

      <div className="flex items-center gap-3">
        <Button disabled={isPending} onClick={() => save(() => saveScopeAuthorityAction(payload()), "Matriks Scope Authority tersimpan.")}>
          Simpan matriks
        </Button>
        <a href="/api/settings/scope-authority.csv" className="text-xs text-primary hover:underline">Export CSV (format sheet Actors)</a>
        {feedback}
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Pemisahan tugas (segregation of duties)</CardTitle>
            <CardDescription>
              Bila &quot;izinkan satu aktor&quot; aktif dan hanya satu orang memegang wewenang, orang itu boleh menjalankan
              Maker/Checker/Releaser sekaligus — ditandai &quot;single-actor release&quot; di audit trail.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {seg.map((r, idx) => (
            <div key={r.scope} className="flex flex-wrap items-center gap-4 text-xs">
              <span className="w-20 font-semibold">{r.scope}</span>
              {(["maker_ne_checker", "checker_ne_releaser", "allow_single_actor"] as const).map((f) => (
                <label key={f} className="flex items-center gap-1 text-muted">
                  <input type="checkbox" checked={r[f]} onChange={(e) => setSeg((s) => s.map((x, i) => (i === idx ? { ...x, [f]: e.target.checked } : x)))} />
                  {f === "maker_ne_checker" ? "Maker ≠ Checker" : f === "checker_ne_releaser" ? "Checker ≠ Releaser" : "Izinkan satu aktor bila pemegang tunggal"}
                </label>
              ))}
            </div>
          ))}
          <Button size="sm" variant="secondary" disabled={isPending} onClick={() => save(() => saveSegregationAction(seg), "Aturan pemisahan tugas tersimpan.")}>
            Simpan aturan
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------

export interface StepDraft {
  step_name: string;
  action_kind: StepActionKind;
  performer_function: FunctionalRole;
  skip_if_initiator_function: FunctionalRole | null;
  reject_to_step_order: number | null;
  sla_hours: number;
}

const KIND_LABEL: Record<StepActionKind, string> = {
  VALIDATE: "Validasi permintaan",
  APPROVE: "Persetujuan tambahan",
  GENERATE_QUOTATION: "Generate quotation (quantity band)",
  REVIEW_AND_ROUTE: "Review & rilis / rute tier",
};

export function WorkflowEditor({
  definitionId,
  name,
  version,
  steps: initial,
}: {
  definitionId: string;
  name: string;
  version: number;
  steps: StepDraft[];
}) {
  const [steps, setSteps] = useState(initial);
  const { isPending, save, feedback } = useSaver();
  const update = (idx: number, patch: Partial<StepDraft>) => setSteps((s) => s.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const move = (idx: number, dir: -1 | 1) =>
    setSteps((s) => {
      const n = [...s];
      const j = idx + dir;
      if (j < 0 || j >= n.length) return s;
      [n[idx], n[j]] = [n[j], n[idx]];
      return n;
    });

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{name} <Badge>v{version}</Badge></CardTitle>
          <CardDescription>
            Sheet Basic Workflow B. Langkah 1–3 (KYC, review, submit) selalu oleh Salesperson; langkah di bawah dapat
            diubah. Routing tier margin (≥15% / 10–15% / &lt;10%) selalu ditambahkan setelah Review — atur di tab Tier.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
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
        <div className="flex flex-wrap items-center gap-2">
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
          <Button size="sm" disabled={isPending} onClick={() => save(() => saveWorkflowStepsAction(definitionId, steps), "Workflow disimpan sebagai versi baru.")}>
            Simpan sebagai versi baru
          </Button>
          {feedback}
        </div>
      </CardContent>
    </Card>
  );
}

export function MenuAccessEditor({
  menus,
  access,
  roles,
}: {
  menus: { key: string; label: string; href: string; locked: boolean }[];
  access: Record<string, FunctionalRole[]>;
  roles: AppRole[];
}) {
  const [matrix, setMatrix] = useState(access);
  const { isPending, save, feedback } = useSaver();
  const toggle = (menu: string, fn: FunctionalRole) =>
    setMatrix((m) => {
      const cur = m[menu] ?? [];
      return { ...m, [menu]: cur.includes(fn) ? cur.filter((x) => x !== fn) : [...cur, fn] };
    });
  const rolesFor = (menu: string) =>
    roles.filter((r) => r.is_active && r.functional_roles.some((f) => (matrix[menu] ?? []).includes(f))).map((r) => r.name);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Akses Menu per Fungsi</CardTitle>
          <CardDescription>
            Menu yang tidak dicentang untuk suatu fungsi <strong>disembunyikan</strong> dari sidebar dan halamannya
            menjawab <strong>404</strong> bila dibuka lewat URL. Role mewarisi menu dari fungsi yang dimilikinya. Settings
            selalu hanya untuk System Admin.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-left text-muted">
              <th className="py-2 pr-2 font-medium">Menu</th>
              {FUNCTIONAL_ROLES.map((f) => (
                <th key={f} className="px-1 py-2 text-center text-[10px] font-medium" title={FUNCTIONAL_ROLE_LABEL[f]}>
                  {f.replaceAll("_", " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {menus.map((m) => (
              <tr key={m.key} className="border-b border-card-border align-top last:border-0">
                <td className="py-2 pr-2">
                  <div className="font-medium">{m.label}</div>
                  <div className="font-mono text-[10px] text-muted">{m.href}</div>
                  <div className="mt-0.5 text-[10px] text-muted">{rolesFor(m.key).join(", ") || "— tidak ada role —"}</div>
                </td>
                {FUNCTIONAL_ROLES.map((f) => (
                  <td key={f} className="px-1 py-2 text-center">
                    <input
                      type="checkbox"
                      disabled={m.locked}
                      checked={(matrix[m.key] ?? []).includes(f)}
                      onChange={() => toggle(m.key, f)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={isPending} onClick={() => save(() => saveMenuAccessAction(matrix), "Akses menu tersimpan.")}>
            Simpan akses menu
          </Button>
          {feedback}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------
// Tiers & bands
// ---------------------------------------------------------------------

export function TierEditor({ tiers, slotOptions }: { tiers: MarginTierAuthority[]; slotOptions: { value: string; label: string }[] }) {
  const [rows, setRows] = useState(tiers);
  const { isPending, save, feedback } = useSaver();
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Tier Margin (sheet Basic Workflow langkah 7)</CardTitle>
          <CardDescription>GM dihitung setelah diskon, dari harga excl. VAT. Semua pemutus dalam satu tier wajib setuju (AND-join).</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((t, idx) => (
          <div key={t.id} className="space-y-2 rounded-lg border border-card-border p-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <Badge tone={t.tier === 1 ? "success" : t.tier === 2 ? "warning" : "danger"}>Tier {t.tier}</Badge>
              <label className="flex items-center gap-1 text-muted">
                GM ≥
                <input className="pc-input w-20" type="number" step="0.01" value={t.gpm_lower_bound_pct ?? ""} placeholder="-∞"
                  onChange={(e) => setRows((r) => r.map((x, i) => (i === idx ? { ...x, gpm_lower_bound_pct: e.target.value === "" ? null : Number(e.target.value) } : x)))} />%
              </label>
              <label className="flex items-center gap-1 text-muted">
                dan &lt;
                <input className="pc-input w-20" type="number" step="0.01" value={t.gpm_upper_bound_pct ?? ""} placeholder="∞"
                  onChange={(e) => setRows((r) => r.map((x, i) => (i === idx ? { ...x, gpm_upper_bound_pct: e.target.value === "" ? null : Number(e.target.value) } : x)))} />%
              </label>
            </div>
            <div className="text-[11px] text-muted">Pemutus (wajib semua):</div>
            <div className="flex flex-wrap gap-1">
              {slotOptions.map((o) => (
                <button key={o.value} type="button"
                  onClick={() => setRows((r) => r.map((x, i) => (i === idx ? { ...x, decision_slots: toggle(x.decision_slots, o.value) } : x)))}
                  className={`rounded-full border px-2 py-0.5 text-[10px] ${t.decision_slots.includes(o.value) ? "border-primary bg-blue-50 text-primary" : "border-card-border text-muted"}`}>
                  {o.label}
                </button>
              ))}
            </div>
            <div className="text-[11px] text-muted">Tembusan (cc):</div>
            <div className="flex flex-wrap gap-1">
              {slotOptions.map((o) => (
                <button key={o.value} type="button"
                  onClick={() => setRows((r) => r.map((x, i) => (i === idx ? { ...x, cc_slots: toggle(x.cc_slots, o.value) } : x)))}
                  className={`rounded-full border px-2 py-0.5 text-[10px] ${t.cc_slots.includes(o.value) ? "border-sky-600 bg-sky-50 text-sky-700" : "border-card-border text-muted"}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={isPending}
            onClick={() => save(() => saveTiersAction(rows.map((t) => ({ id: t.id, gpm_lower_bound_pct: t.gpm_lower_bound_pct, gpm_upper_bound_pct: t.gpm_upper_bound_pct, decision_slots: t.decision_slots, cc_slots: t.cc_slots }))))}>
            Simpan tier
          </Button>
          {feedback}
        </div>
      </CardContent>
    </Card>
  );
}

export function BandEditor({ bands }: { bands: QuantityBand[] }) {
  const [rows, setRows] = useState(bands);
  const { isPending, save, feedback } = useSaver();
  const update = (idx: number, patch: Partial<QuantityBand>) => setRows((r) => r.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Quantity Band (sheet Basic Workflow langkah 5)</CardTitle>
          <CardDescription>1 unit otomatis · 2–5 & 6–9 otomatis + opsi manual (diskon default) · 10+ manual</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1 font-medium">Band</th>
              <th className="py-1 font-medium">Qty min</th>
              <th className="py-1 font-medium">Qty maks</th>
              <th className="py-1 font-medium">Mode</th>
              <th className="py-1 font-medium">Diskon default %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b, idx) => (
              <tr key={b.band}>
                <td className="py-1 pr-2 font-semibold">{b.band}</td>
                <td className="py-1 pr-2"><input className="pc-input w-20" type="number" min={1} value={b.min_qty} onChange={(e) => update(idx, { min_qty: Number(e.target.value) })} /></td>
                <td className="py-1 pr-2"><input className="pc-input w-20" type="number" value={b.max_qty ?? ""} placeholder="∞" onChange={(e) => update(idx, { max_qty: e.target.value === "" ? null : Number(e.target.value) })} /></td>
                <td className="py-1 pr-2">
                  <select className="pc-input" value={b.processing_mode} onChange={(e) => update(idx, { processing_mode: e.target.value as QuantityBand["processing_mode"] })}>
                    <option value="AUTO">Otomatis</option>
                    <option value="AUTO_WITH_MANUAL">Otomatis + opsi manual</option>
                    <option value="MANUAL">Manual</option>
                  </select>
                </td>
                <td className="py-1"><input className="pc-input w-24" type="number" step="0.1" min={0} value={b.default_discount_pct} onChange={(e) => update(idx, { default_discount_pct: Number(e.target.value) })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={isPending} onClick={() => save(() => saveBandsAction(rows))}>Simpan band</Button>
          {feedback}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------
// General settings
// ---------------------------------------------------------------------

export function GeneralSettingsEditor({ settings }: { settings: AppSettings }) {
  const [s, setS] = useState(settings);
  const { isPending, save, feedback } = useSaver();
  const num = (k: keyof AppSettings) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: Number(e.target.value) });
  const str = (k: keyof AppSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setS({ ...s, [k]: e.target.value });
  const lines = (k: keyof AppSettings) => (e: React.ChangeEvent<HTMLTextAreaElement>) => setS({ ...s, [k]: e.target.value.split("\n") });
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Umum — pajak, ambang, dokumen</CardTitle>
          <CardDescription>Nilai PPN, ambang Deviation, dan teks dokumen Cost Estimate (sampel PDF VKTR).</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <L label="Tarif PPN efektif (%)"><input className="pc-input" type="number" step="0.01" value={s.vatRatePct} onChange={num("vatRatePct")} /></L>
        <L label="Ambang skenario Deviation — GM (%)"><input className="pc-input" type="number" step="0.01" value={s.deviationGmThresholdPct} onChange={num("deviationGmThresholdPct")} /></L>
        <L label="Masa berlaku quotation (hari)"><input className="pc-input" type="number" value={s.quotationValidityDays} onChange={num("quotationValidityDays")} /></L>
        <L label="Fraud guard — maks. quotation/hari per customer+varian"><input className="pc-input" type="number" min={1} value={s.fraudGuardMaxPerDay} onChange={num("fraudGuardMaxPerDay")} /></L>
        <L label="Judul dokumen"><input className="pc-input" value={s.documentTitle} onChange={str("documentTitle")} /></L>
        <L label="Pola nomor ({seq} {scheme} {unit} {MM} {YYYY})"><input className="pc-input" value={s.documentNumberPattern} onChange={str("documentNumberPattern")} /></L>
        <L label="Kode unit penerbit"><input className="pc-input" value={s.documentUnitCode} onChange={str("documentUnitCode")} /></L>
        <L label="Nama penerbit"><input className="pc-input" value={s.issuerName} onChange={str("issuerName")} /></L>
        <L label="Alamat penerbit (per baris)"><textarea className="pc-input" rows={4} value={s.issuerAddress.join("\n")} onChange={lines("issuerAddress")} /></L>
        <L label="Disclaimer"><textarea className="pc-input" rows={4} value={s.documentDisclaimer} onChange={str("documentDisclaimer")} /></L>
        <L label="Special notes default (per baris)" className="md:col-span-2"><textarea className="pc-input" rows={3} value={s.defaultSpecialNotes.join("\n")} onChange={lines("defaultSpecialNotes")} /></L>
        <div className="flex items-center gap-2 md:col-span-2">
          <Button size="sm" disabled={isPending}
            onClick={() => save(() => saveGeneralSettingsAction({ ...s, issuerAddress: s.issuerAddress.filter(Boolean), defaultSpecialNotes: s.defaultSpecialNotes.filter(Boolean) }))}>
            Simpan
          </Button>
          {feedback}
        </div>
      </CardContent>
    </Card>
  );
}

function L({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block space-y-1 text-xs text-muted ${className ?? ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
