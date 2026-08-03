"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatPercent } from "@/lib/utils";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";

export interface WinLossPoint {
  proposalNumber: string;
  businessLine: string;
  markupRatio: number; // (finalPrice - cost) / cost
  outcome: "WON" | "LOST" | "CANCELLED";
}

export interface OptimalBand {
  businessLine: string;
  wonMin: number;
  wonMax: number;
  wonAvg: number;
  lostAvg: number | null;
  sampleSize: number;
}

export function WinLossAnalytics({
  points,
  bands,
}: {
  points: WinLossPoint[];
  bands: OptimalBand[];
}) {
  const chartData = points.map((p, i) => ({ ...p, x: i, y: p.markupRatio * 100 }));

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Win/Loss Pricing Analytics</CardTitle>
          <CardDescription>
            FR-4.3 — markup ratio historis tender yang menang vs kalah, untuk
            merekomendasikan Optimal Price Band.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {points.length === 0 ? (
          <p className="text-sm text-muted text-center py-6">
            Belum ada proposal dengan outcome WON/LOST yang tercatat.
          </p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="x" type="number" tick={false} label={{ value: "Proposal (kronologis)", position: "insideBottom", offset: -2, fontSize: 11 }} />
                <YAxis
                  dataKey="y"
                  type="number"
                  tick={{ fontSize: 11 }}
                  label={{ value: "Markup %", angle: -90, position: "insideLeft", fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(1)}%`, "Markup"]}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.proposalNumber ?? ""
                  }
                />
                <Scatter data={chartData}>
                  {chartData.map((d, i) => (
                    <Cell
                      key={i}
                      fill={
                        d.outcome === "WON"
                          ? "#16a34a"
                          : d.outcome === "LOST"
                            ? "#dc2626"
                            : "#94a3b8"
                      }
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2 justify-center text-[11px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success inline-block" /> Won
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-danger inline-block" /> Lost
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-400 inline-block" /> Cancelled
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {bands.map((b) => (
            <div key={b.businessLine} className="rounded-lg border border-card-border p-3">
              <div className="text-xs font-medium">{b.businessLine.replaceAll("_", " ")}</div>
              <div className="mt-2">
                <Badge tone="success">
                  Optimal Band: {formatPercent(b.wonMin, 0)}–{formatPercent(b.wonMax, 0)}
                </Badge>
              </div>
              <div className="text-[11px] text-muted mt-2 space-y-0.5">
                <div>Rata-rata markup WON: {formatPercent(b.wonAvg)}</div>
                {b.lostAvg !== null && <div>Rata-rata markup LOST: {formatPercent(b.lostAvg)}</div>}
                <div>Sample: {b.sampleSize} tender</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
