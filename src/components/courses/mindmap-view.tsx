"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, ArrowDownUp, ArrowLeftRight } from "lucide-react"
import { toast } from "sonner"

interface MindNode {
  title: string
  children?: MindNode[]
}

interface MindMapData {
  root: string
  children: MindNode[]
}

function VerticalTree({ root, children }: MindMapData) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
      <div style={{
        background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white",
        padding: "12px 24px", borderRadius: 12, fontSize: 16, fontWeight: 700,
      }}>{root}</div>
      <div style={{ width: 2, height: 24, background: "#6366f1" }} />
      <div style={{
        display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap",
        borderTop: "2px solid #6366f1", paddingTop: 8,
      }}>
        {children.map((group, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: 2, height: 14, background: "#4f46e5" }} />
            <div style={{
              background: "#1e293b", border: "2px solid #4f46e5",
              padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
            }}>{group.title}</div>
            {(group.children?.length ?? 0) > 0 && (
              <>
                <div style={{ width: 2, height: 12, background: "#334155" }} />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                  {group.children?.map((kp, j) => (
                    <div key={j} style={{
                      background: "#1e293b", border: "1px solid #334155",
                      padding: "5px 10px", borderRadius: 8, fontSize: 11, color: "#94a3b8",
                    }}>{kp.title}</div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function HorizontalTree({ root, children }: MindMapData) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      <div style={{
        background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white",
        padding: "12px 20px", borderRadius: 12, fontSize: 16, fontWeight: 700, whiteSpace: "nowrap",
      }}>{root}</div>
      <div style={{ height: 2, width: 32, background: "#6366f1" }} />
      <div style={{
        display: "flex", flexDirection: "column", gap: 12,
        borderLeft: "2px solid #6366f1", paddingLeft: 12,
      }}>
        {children.map((group, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ height: 2, width: 16, background: "#4f46e5" }} />
            <div style={{
              background: "#1e293b", border: "2px solid #4f46e5",
              padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
            }}>{group.title}</div>
            {(group.children?.length ?? 0) > 0 && (
              <>
                <div style={{ height: 2, width: 12, background: "#334155" }} />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {group.children?.map((kp, j) => (
                    <div key={j} style={{
                      background: "#1e293b", border: "1px solid #334155",
                      padding: "5px 10px", borderRadius: 8, fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap",
                    }}>{kp.title}</div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function MindMapView({ moduleId }: { moduleId: string }) {
  const [data, setData] = useState<MindMapData | null>(null)
  const [layout, setLayout] = useState<"vertical" | "horizontal">("vertical")
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => { loadExisting() }, [moduleId])

  async function loadExisting() {
    setLoading(true)
    try {
      const res = await fetch(`/api/modules/${moduleId}`)
      const mod = await res.json()
      if (mod.mindMap?.data) {
        setData(JSON.parse(mod.mindMap.data))
        setLayout(mod.mindMap.layout || "vertical")
      }
    } catch { /* no mindmap yet */ }
    setLoading(false)
  }

  async function generate() {
    setGenerating(true)
    try {
      const res = await fetch("/api/ai/generate-mindmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId }),
      })
      const result = await res.json()
      if (result.data) {
        setData(result.data)
        toast.success("思维导图已生成")
      } else {
        toast.error(result.error || "生成失败")
      }
    } catch { toast.error("生成失败") }
    setGenerating(false)
  }

  async function updateLayout(l: "vertical" | "horizontal") {
    setLayout(l)
    try {
      await fetch(`/api/modules/${moduleId}/mindmap`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout: l }),
      })
    } catch { /* non-critical */ }
  }

  return (
    <div style={{ maxHeight: "70vh", overflow: "auto", padding: 8, background: "#0f172a", borderRadius: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 4 }}>
          <Button variant={layout === "vertical" ? "secondary" : "ghost"} size="sm" onClick={() => updateLayout("vertical")}>
            <ArrowDownUp className="h-3.5 w-3.5 mr-1" />纵向
          </Button>
          <Button variant={layout === "horizontal" ? "secondary" : "ghost"} size="sm" onClick={() => updateLayout("horizontal")}>
            <ArrowLeftRight className="h-3.5 w-3.5 mr-1" />横向
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={generate} disabled={generating}>
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
          重新生成
        </Button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </div>
      ) : data ? (
        <div style={{ padding: "20px 0", overflow: "auto" }}>
          {layout === "vertical"
            ? <VerticalTree root={data.root} children={data.children} />
            : <HorizontalTree root={data.root} children={data.children} />
          }
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: 40 }}>
          <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 12 }}>还没有思维导图</p>
          <Button onClick={generate} disabled={generating}>
            {generating && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            AI 生成思维导图
          </Button>
        </div>
      )}
    </div>
  )
}
