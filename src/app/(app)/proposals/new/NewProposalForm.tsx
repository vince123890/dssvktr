"use client";

import { Button } from "@/components/ui/Button";
import { useState, useTransition } from "react";
import { createProposalAction } from "../actions";

export function NewProposalForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          try {
            await createProposalAction(formData);
          } catch (e) {
            // redirect() signals success by throwing NEXT_REDIRECT; only a
            // real failure should surface as an error message here.
            if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
            if (
              typeof e === "object" &&
              e !== null &&
              "digest" in e &&
              String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
            ) {
              throw e;
            }
            setError(e instanceof Error ? e.message : "Gagal membuat proposal");
          }
        });
      }}
      className="space-y-4"
    >
      <Field label="Judul Proposal">
        <input
          name="title"
          required
          disabled={isPending}
          placeholder="Pengadaan 20 Unit EV Bus — Dishub DKI Jakarta"
          className="w-full rounded-lg border border-card-border px-3 py-2.5 text-sm bg-white disabled:bg-slate-50 disabled:text-muted"
        />
      </Field>

      <Field label="Lini Bisnis (Pricing Template)">
        <select
          name="business_line"
          required
          disabled={isPending}
          className="w-full rounded-lg border border-card-border px-3 py-2.5 text-sm bg-white disabled:bg-slate-50 disabled:text-muted"
        >
          <option value="B2G_TENDER_BUS">B2G Tender Bus</option>
          <option value="B2B_COMMERCIAL_FLEET">B2B Commercial Fleet</option>
          <option value="CHARGING_INFRA_BUILDOUT">
            Charging Infrastructure Buildout
          </option>
        </select>
      </Field>

      <Field label="Nama Customer (opsional)">
        <input
          name="customer_name"
          disabled={isPending}
          placeholder="Dinas Perhubungan DKI Jakarta"
          className="w-full rounded-lg border border-card-border px-3 py-2.5 text-sm bg-white disabled:bg-slate-50 disabled:text-muted"
        />
      </Field>

      <Field label="Jumlah Unit">
        <input
          name="unit_quantity"
          type="number"
          min={1}
          defaultValue={1}
          required
          disabled={isPending}
          className="w-full rounded-lg border border-card-border px-3 py-2.5 text-sm bg-white disabled:bg-slate-50 disabled:text-muted"
        />
      </Field>

      {error && (
        <p className="rounded-lg border border-danger/20 bg-danger-bg px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      <div className="flex justify-end pt-2">
        <Button type="submit" loading={isPending}>
          {isPending ? "Membuat draft..." : "Buat Draft & Lanjut ke CBS Builder"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-muted space-y-1.5">
      <span>{label}</span>
      {children}
    </label>
  );
}
