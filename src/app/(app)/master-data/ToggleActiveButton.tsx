"use client";

import { useTransition } from "react";
import { toggleCostItemActiveAction } from "./actions";

export function ToggleActiveButton({ id, active }: { id: string; active: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(() => toggleCostItemActiveAction(id, !active))}
      className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
    >
      {active ? "Disable" : "Enable"}
    </button>
  );
}
