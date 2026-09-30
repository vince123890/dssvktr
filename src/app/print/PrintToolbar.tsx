"use client";

import { Button } from "@/components/ui/Button";
import { Printer } from "lucide-react";
import { logDocumentRenderAction } from "@/app/(app)/proposals/[id]/quotation-actions";

/**
 * Print / Save as PDF (PRD FR-1.5.4). The browser's print dialog
 * produces the PDF from the same page shown on screen, so preview and
 * printout can never diverge. Each print is written to the audit trail.
 */
export function PrintToolbar({
  proposalId,
  kind,
  backHref,
  note,
}: {
  proposalId: string;
  kind: "PRINT" | "COST_STRUCTURE_SHEET";
  backHref: string;
  note?: string;
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-card-border bg-white/95 px-6 py-3 backdrop-blur print:hidden">
      <a href={backHref} className="text-xs text-primary hover:underline">
        ← Kembali ke quotation
      </a>
      {note && <span className="text-xs text-muted">{note}</span>}
      <Button
        size="sm"
        onClick={async () => {
          await logDocumentRenderAction(proposalId, kind);
          window.print();
        }}
      >
        <Printer size={14} /> Print / Simpan PDF
      </Button>
    </div>
  );
}
