"use client";

import { useTransition } from "react";
import { toggleProductStatusAction } from "./actions";

export function ProductStatusButton({
  id,
  status,
}: {
  id: string;
  status: "ACTIVE" | "DISCONTINUED";
}) {
  const [isPending, startTransition] = useTransition();
  const nextStatus = status === "ACTIVE" ? "DISCONTINUED" : "ACTIVE";

  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(() => toggleProductStatusAction(id, nextStatus))}
      className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
    >
      {status === "ACTIVE" ? "Discontinue" : "Aktifkan"}
    </button>
  );
}
