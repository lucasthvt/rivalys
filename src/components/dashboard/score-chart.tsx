"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MONO_STACK } from "@/components/tasks/priority";

export interface ScorePoint {
  score: number;
  recorded_at: string;
}

export function ScoreChart({ points }: { points: ScorePoint[] }) {
  if (points.length < 2) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-1 border border-dashed border-surface-border px-6 text-center">
        <p className="text-sm font-medium text-foreground">
          {points.length === 0 ? "Pas encore de score enregistré" : "Un seul relevé pour l'instant"}
        </p>
        <p className="max-w-xs text-xs text-foreground-muted">
          L&apos;évolution s&apos;affiche dès qu&apos;au moins deux analyses ont été effectuées.
        </p>
      </div>
    );
  }

  const data = points.map((p) => ({
    date: new Date(p.recorded_at).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    }),
    score: p.score,
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="#232a38" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="#8890a0"
            fontSize={11}
            fontFamily={MONO_STACK}
            tickLine={false}
            axisLine={{ stroke: "#232a38" }}
          />
          <YAxis
            domain={[0, 100]}
            stroke="#8890a0"
            fontSize={11}
            fontFamily={MONO_STACK}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={{
              background: "#161a24",
              border: "1px solid #232a38",
              borderRadius: 0,
              fontSize: 12,
              fontFamily: MONO_STACK,
            }}
            labelStyle={{ color: "#b4b9c6" }}
            itemStyle={{ color: "#fbfbfc" }}
          />
          <Line
            type="monotone"
            dataKey="score"
            name="Score"
            stroke="#49D6A8"
            strokeWidth={2}
            dot={{ r: 3, fill: "#49D6A8", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
