import { AlertTriangle } from "lucide-react";
import { Tooltip } from "./Tooltip";
import type { PriceStalenessInfo } from "@/lib/pricing/staleness";

/**
 * Bell-less by design: this is a single, specific warning ("the price
 * shown may be out of date"), not a general notification feed, so a
 * contextual triangle badge next to the price reads clearer than an
 * inbox-style bell.
 */
export function PriceStalenessBadge({ info }: { info: PriceStalenessInfo }) {
  if (!info.isStale) return null;

  const reasons: string[] = [];
  if (info.rateChanged && info.rateUsed != null && info.rateCurrent != null) {
    reasons.push(
      `Kurs USD→IDR berubah dari ${info.rateUsed.toLocaleString("id-ID")} menjadi ${info.rateCurrent.toLocaleString("id-ID")}.`
    );
  }
  if (info.mineralChanged && info.hpmUsed != null && info.hpmCurrent != null) {
    reasons.push(
      `HPM berubah dari ${info.hpmUsed.toFixed(2)} menjadi ${info.hpmCurrent.toFixed(2)} US$/WMT.`
    );
  }

  return (
    <Tooltip
      content={
        <div className="space-y-1.5">
          <p className="font-semibold text-warning">Harga mungkin sudah usang</p>
          <p>
            Nilai di atas dihitung dengan kurs dan/atau indeks mineral yang
            sudah diperbarui sejak saat itu:
          </p>
          <ul className="list-disc space-y-0.5 pl-4">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="text-muted">
            Klik &quot;Simpan &amp; Hitung Ulang Harga&quot; untuk memperbarui.
          </p>
        </div>
      }
    >
      <span
        aria-label="Harga mungkin sudah usang karena kurs atau indeks mineral berubah"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-warning-bg text-warning cursor-help"
      >
        <AlertTriangle size={13} />
      </span>
    </Tooltip>
  );
}
