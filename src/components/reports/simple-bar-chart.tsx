interface BarChartData { label: string; value: number }

export function SimpleBarChart({ data, maxValue }: { data: BarChartData[]; maxValue?: number }) {
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div className="w-full bg-primary/60 hover:bg-primary rounded-t transition-colors"
            style={{ height: `${Math.max(4, (d.value / max) * 100)}%` }}
            title={`${d.label}: ${d.value}`} />
          <span className="text-[9px] text-muted-foreground truncate w-full text-center">{d.label.slice(5)}</span>
        </div>
      ))}
    </div>
  )
}
