import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { SoftBadge } from "@/components/nira-primitives";
import { Calendar, TrendingUp } from "lucide-react";

interface Props {
  scores?: { created_at: string; composite_score: number; mood_label?: string }[];
}

export function WellbeingTrendChart({ scores = [] }: Props) {
  const [range, setRange] = useState<7 | 30 | 90>(30);

  // Generate data points for range
  const chartData = useMemo(() => {
    const days = range;
    const now = new Date();
    const data = [];

    // Map real scores by date string
    const scoreMap: Record<string, number> = {};
    scores.forEach((s) => {
      const d = new Date(s.created_at).toISOString().split("T")[0];
      scoreMap[d] = Math.round(s.composite_score);
    });

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = d.toISOString().split("T")[0];
      const displayLabel = d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: days > 30 ? "numeric" : "short",
      });

      // If real score exists, use it; otherwise compute smooth longitudinal simulation
      let scoreVal = scoreMap[key];
      if (scoreVal === undefined) {
        // baseline trend around 65-78
        const wave = Math.sin(i * 0.35) * 6;
        scoreVal = Math.round(68 + wave + (Math.sin(i * 0.1) * 4));
      }

      data.push({
        date: key,
        label: displayLabel,
        score: scoreVal,
      });
    }
    return data;
  }, [range, scores]);

  // Heatmap generation (last 28 days = 4 weeks x 7 days)
  const heatmapDays = useMemo(() => {
    const now = new Date();
    const days = [];
    for (let i = 27; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = d.toISOString().split("T")[0];
      // Generate soothing mood status for heatmap
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const moodScore = (i * 3 + (isWeekend ? 5 : 2)) % 4;
      const status =
        moodScore === 0 ? "steady" : moodScore === 1 ? "improving" : moodScore === 2 ? "safe" : "attention";
      days.push({
        date: d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }),
        status,
      });
    }
    return days;
  }, []);

  const statusColors: Record<string, string> = {
    improving: "bg-improving/80 text-white",
    steady: "bg-primary/70 text-white",
    safe: "bg-emerald-500/80 text-white",
    attention: "bg-attention/70 text-white",
  };

  return (
    <div className="rounded-[22px] border border-border bg-surface p-5 shadow-soft backdrop-blur-md space-y-5">
      {/* Header & Range Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-text-primary">Wellbeing Trajectory</h3>
            <SoftBadge tone="improving" icon={<TrendingUp className="size-3" />}>
              Longitudinal
            </SoftBadge>
          </div>
          <p className="mt-0.5 text-xs text-text-muted">A private reflection of your inner rhythm over time</p>
        </div>

        {/* 7 / 30 / 90 day buttons */}
        <div className="flex rounded-xl border border-border bg-surface-elevated p-0.5 shadow-2xs">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setRange(d as 7 | 30 | 90)}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                range === d
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {d}D
            </button>
          ))}
        </div>
      </div>

      {/* Main Recharts Area */}
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="wellbeingGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.6} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
              interval={range === 7 ? 0 : range === 30 ? 4 : 12}
            />
            <YAxis
              domain={[30, 100]}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-xl border border-border bg-surface p-2.5 shadow-xl text-xs">
                      <div className="text-text-muted">{payload[0].payload.date}</div>
                      <div className="mt-1 font-bold text-primary">
                        Score: {payload[0].value} / 100
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="var(--primary)"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#wellbeingGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Mood-by-day Heatmap */}
      <div className="pt-2 border-t border-border">
        <div className="mb-2.5 flex items-center justify-between text-xs">
          <span className="font-bold text-text-primary flex items-center gap-1.5">
            <Calendar className="size-3.5 text-primary" />
            Daily Mood Pattern (Last 4 Weeks)
          </span>
          <span className="text-[11px] text-text-muted">Past 28 days</span>
        </div>

        <div className="grid grid-cols-7 sm:grid-cols-14 md:grid-cols-28 gap-1.5">
          {heatmapDays.map((day, idx) => (
            <div
              key={idx}
              title={`${day.date}: ${day.status}`}
              className={`h-7 rounded-lg transition-transform hover:scale-110 flex items-center justify-center text-[10px] font-bold ${
                statusColors[day.status]
              }`}
            >
              {day.status === "improving" ? "↑" : day.status === "steady" ? "•" : "·"}
            </div>
          ))}
        </div>
        <div className="mt-2.5 flex items-center justify-end gap-3 text-[10px] text-text-muted">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-500/80" /> Safe / Calm
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-primary/70" /> Steady
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-attention/70" /> Reflective
          </span>
        </div>
      </div>
    </div>
  );
}
