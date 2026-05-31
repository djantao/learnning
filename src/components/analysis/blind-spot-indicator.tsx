import { AlertTriangle } from "lucide-react"

interface BlindSpotIndicatorProps {
  weakCount: number
  highSeverityCount: number
}

export function BlindSpotIndicator({ weakCount, highSeverityCount }: BlindSpotIndicatorProps) {
  if (weakCount === 0) return null
  return (
    <span className="inline-flex items-center gap-1 text-[10px]" title={`${weakCount} 个薄弱知识点`}>
      <AlertTriangle className={`h-3 w-3 ${highSeverityCount > 0 ? "text-red-500" : "text-amber-500"}`} />
      {weakCount}
    </span>
  )
}
