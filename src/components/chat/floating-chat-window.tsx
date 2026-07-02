"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { MessageCircle, X, Minus, Maximize2, Minimize2, GripVertical } from "lucide-react"
import { ChatPanel } from "@/components/chat/chat-panel"

interface FloatingChatWindowProps {
  courseId?: string
  knowledgePointId?: string
  kpTitle?: string
  onClose: () => void
}

export function FloatingChatWindow({ courseId, knowledgePointId, kpTitle, onClose }: FloatingChatWindowProps) {
  const [isMinimized, setIsMinimized] = useState(false)
  const [position, setPosition] = useState({ x: 20, y: 80 })
  const [size, setSize] = useState({ width: 380, height: 520 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 })
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 })
  const windowRef = useRef<HTMLDivElement>(null)

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    }
  }, [position])

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    }
  }, [size])

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (isDragging) {
        const deltaX = e.clientX - dragStartRef.current.x
        const deltaY = e.clientY - dragStartRef.current.y
        const newX = Math.max(0, Math.min(window.innerWidth - size.width, dragStartRef.current.posX + deltaX))
        const newY = Math.max(0, Math.min(window.innerHeight - 40, dragStartRef.current.posY + deltaY))
        setPosition({ x: newX, y: newY })
      }
      if (isResizing) {
        const deltaX = e.clientX - resizeStartRef.current.x
        const deltaY = e.clientY - resizeStartRef.current.y
        const newWidth = Math.max(300, Math.min(800, resizeStartRef.current.width + deltaX))
        const newHeight = Math.max(300, Math.min(800, resizeStartRef.current.height + deltaY))
        setSize({ width: newWidth, height: newHeight })
      }
    }

    function handleMouseUp() {
      setIsDragging(false)
      setIsResizing(false)
    }

    if (isDragging || isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, isResizing, size.width])

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed z-50 flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-105"
        style={{ left: position.x, top: position.y, padding: "10px 16px" }}
      >
        <MessageCircle className="h-5 w-5" />
        <span className="text-sm font-medium">AI 老师</span>
      </button>
    )
  }

  return (
    <div
      ref={windowRef}
      className={cn(
        "fixed z-50 flex flex-col rounded-lg border bg-card shadow-2xl overflow-hidden",
        isDragging && "cursor-grabbing",
        isResizing && "cursor-se-resize"
      )}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
      }}
    >
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2 border-b bg-muted/30 select-none",
          !isDragging && "cursor-grab"
        )}
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">AI 老师</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); setIsMinimized(true) }}
            onMouseDown={(e) => e.stopPropagation()}
            title="最小化"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onClose() }}
            onMouseDown={(e) => e.stopPropagation()}
            title="关闭"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden min-w-0">
        <ChatPanel
          conversations={[]}
          courseId={courseId}
          knowledgePointId={knowledgePointId}
          kpTitle={kpTitle}
          borderless
        />
      </div>

      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
        onMouseDown={handleResizeStart}
        style={{
          background: "linear-gradient(135deg, transparent 50%, hsl(var(--muted)) 50%)",
        }}
      />
    </div>
  )
}
