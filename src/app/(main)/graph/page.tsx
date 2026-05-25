"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GitGraph, Loader2, ZoomIn, ZoomOut, RotateCw } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface GraphNode {
  id: string
  title: string
  slug: string
  tags: { id: string; name: string; color: string }[]
  x?: number
  y?: number
  vx?: number
  vy?: number
}

interface GraphEdge {
  source: string
  target: string
  label: string | null
}

interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export default function GraphPage() {
  const [data, setData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement>(null)
  const animRef = useRef<number | null>(null)
  const nodesRef = useRef<GraphNode[]>([])

  useEffect(() => {
    fetch("/api/graph")
      .then((r) => r.json())
      .then((d: GraphData) => {
        setData(d)
        // Initialize node positions in a circle
        const center = { x: 500, y: 350 }
        const radius = Math.min(400, d.nodes.length * 20)
        d.nodes.forEach((n, i) => {
          const angle = (2 * Math.PI * i) / d.nodes.length
          n.x = center.x + radius * Math.cos(angle)
          n.y = center.y + radius * Math.sin(angle)
          n.vx = 0
          n.vy = 0
        })
        nodesRef.current = d.nodes
        startSimulation(d)
      })
      .catch(() => setLoading(false))
      .finally(() => setLoading(false))
  }, [])

  const startSimulation = useCallback((graphData: GraphData) => {
    const nodes = graphData.nodes
    const edges = graphData.edges
    const nodeMap = new Map(nodes.map((n) => [n.id, n]))

    const tick = () => {
      // Forces
      const repulsion = 5000
      const attraction = 0.01
      const damping = 0.85

      for (const node of nodes) {
        // Repulsion between all nodes
        for (const other of nodes) {
          if (other.id === node.id) continue
          const dx = node.x! - other.x!
          const dy = node.y! - other.y!
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy))
          const force = repulsion / (dist * dist)
          node.vx! += (dx / dist) * force
          node.vy! += (dy / dist) * force
        }

        // Attraction along edges
        for (const edge of edges) {
          let target: GraphNode | undefined
          if (edge.source === node.id) target = nodeMap.get(edge.target)
          else if (edge.target === node.id) target = nodeMap.get(edge.source)
          if (!target) continue

          const dx = target.x! - node.x!
          const dy = target.y! - node.y!
          node.vx! += dx * attraction
          node.vy! += dy * attraction
        }

        // Center gravity
        node.vx! += (500 - node.x!) * 0.001
        node.vy! += (350 - node.y!) * 0.001
      }

      // Apply velocity
      for (const node of nodes) {
        node.vx! *= damping
        node.vy! *= damping
        node.x! += node.vx!
        node.y! += node.vy!
      }

      nodesRef.current = [...nodes]
      animRef.current = requestAnimationFrame(tick)
    }

    animRef.current = requestAnimationFrame(tick)
    // Stop simulation after 3 seconds
    setTimeout(() => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }, 3000)
  }, [])

  useEffect(() => {
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [])

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setZoom((z) => Math.max(0.2, Math.min(3, z - e.deltaY * 0.001)))
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as Element).classList.contains("bg-transparent")) {
      setDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
    }
  }

  const handleMouseUp = () => setDragging(false)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">知识图谱</h2>
          <p className="text-muted-foreground">可视化你的知识网络</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-24">
            <GitGraph className="h-16 w-16 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">知识图谱可视化</h3>
            <p className="mt-1 text-sm text-muted-foreground">创建笔记间的双向链接后，这里将展示你的知识网络</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const displayNodes = nodesRef.current.length > 0 ? nodesRef.current : data.nodes

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">知识图谱</h2>
          <p className="text-muted-foreground">
            {data.nodes.length} 个节点, {data.edges.length} 条连接
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={() => setZoom((z) => Math.min(3, z + 0.2))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setZoom((z) => Math.max(0.2, z - 0.2))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}>
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-hidden rounded-xl">
          <svg
            ref={svgRef}
            width="100%"
            height={600}
            className="bg-muted/20 cursor-grab"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: dragging ? "grabbing" : "grab" }}
          >
            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {/* Edges */}
              {data.edges.map((edge, i) => {
                const source = displayNodes.find((n) => n.id === edge.source)
                const target = displayNodes.find((n) => n.id === edge.target)
                if (!source || !target) return null
                return (
                  <line
                    key={`edge-${i}`}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke="currentColor"
                    strokeOpacity={0.3}
                    strokeWidth={1}
                  />
                )
              })}

              {/* Nodes */}
              {displayNodes.map((node) => {
                const isHovered = hoveredNode === node.id
                const radius = Math.max(8, Math.min(20, 8 + (data.edges.filter((e) => e.source === node.id || e.target === node.id).length) * 2))
                return (
                  <g key={node.id} transform={`translate(${node.x},${node.y})`}>
                    <circle
                      r={radius + 4}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                      onClick={() => window.open(`/notes/${node.id}`, "_self")}
                    />
                    <circle
                      r={radius}
                      fill={isHovered ? "var(--color-primary)" : "var(--color-primary)"}
                      fillOpacity={isHovered ? 1 : 0.7}
                      stroke="var(--color-primary)"
                      strokeOpacity={0.3}
                      strokeWidth={2}
                      className="cursor-pointer"
                    />
                    {isHovered && (
                      <g transform={`translate(0, ${-radius - 30})`}>
                        <rect
                          x={-node.title.length * 3.5}
                          y={-12}
                          width={node.title.length * 7}
                          height={24}
                          rx={4}
                          fill="var(--color-popover)"
                          stroke="var(--color-border)"
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="var(--color-foreground)"
                          fontSize={12}
                        >
                          {node.title.slice(0, 30)}
                        </text>
                      </g>
                    )}
                    {!isHovered && node.title.length <= 8 && (
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="var(--color-primary-foreground)"
                        fontSize={8}
                        className="pointer-events-none select-none"
                      >
                        {node.title.slice(0, 8)}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          </svg>
        </CardContent>
      </Card>
      <p className="text-center text-xs text-muted-foreground">
        滚轮缩放 | 拖拽平移 | 点击节点跳转到笔记 | 悬停查看标题
      </p>
    </div>
  )
}
