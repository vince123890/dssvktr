"use client";

import { Button } from "@/components/ui/Button";
import { useRef, useState, useTransition } from "react";
import { createProductAction } from "./actions";

export function ProductForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      ref={formRef}
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await createProductAction(formData);
          if (result.ok) {
            formRef.current?.reset();
          } else {
            setError(result.error ?? "Gagal menyimpan produk");
          }
        });
      }}
      className="grid grid-cols-2 gap-3 lg:grid-cols-3"
    >
      <Field label="Code">
        <input name="code" required placeholder="EVBUS-12M-STD" className="input" />
      </Field>
      <Field label="Name" className="lg:col-span-2">
        <input name="name" required placeholder="EV Bus 12M Standard" className="input" />
      </Field>
      <Field label="Varian Sasis">
        <input name="chassis_variant" placeholder="Standard Chassis" className="input" />
      </Field>
      <Field label="Varian Karoseri">
        <input name="body_variant" placeholder="Standard Body" className="input" />
      </Field>
      <Field label="URL Gambar (opsional)">
        <input name="image_url" type="url" placeholder="https://…" className="input" />
      </Field>
      <Field label="URL Brosur (opsional)" className="lg:col-span-2">
        <input name="brochure_url" type="url" placeholder="https://…" className="input" />
      </Field>

      {error && (
        <p className="col-span-2 lg:col-span-3 text-xs text-danger">{error}</p>
      )}

      <div className="col-span-2 lg:col-span-3 flex justify-end">
        <Button type="submit" loading={isPending} size="sm">
          {isPending ? "Menyimpan..." : "Tambah Produk"}
        </Button>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border: 1px solid var(--card-border);
          border-radius: 0.5rem;
          padding: 0.5rem 0.65rem;
          font-size: 0.8rem;
          background: white;
        }
      `}</style>
    </form>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-xs text-muted space-y-1 ${className ?? ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
