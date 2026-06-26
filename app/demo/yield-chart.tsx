"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface YieldPoint {
  day: string;
  value: number;
}

/**
 * Read-only yield curve for the demo dashboard. Data is passed in from the
 * server; this client component only renders it (recharts needs the browser).
 */
export function YieldChart({ data }: { data: YieldPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="brota" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#059669" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickLine={false} axisLine={false} fontSize={12} width={48} />
          <Tooltip />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#059669"
            strokeWidth={2}
            fill="url(#brota)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
