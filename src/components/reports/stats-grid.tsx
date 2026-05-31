interface StatItem { label: string; value: string | number; change?: number }

export function StatsGrid({ stats }: { stats: StatItem[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {stats.map((s, i) => (
        <div key={i} className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold">{s.value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          {s.change !== undefined && (
            <span className={`text-[10px] ${s.change >= 0 ? "text-green-500" : "text-red-500"}`}>
              {s.change >= 0 ? "+" : ""}{s.change}%
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
