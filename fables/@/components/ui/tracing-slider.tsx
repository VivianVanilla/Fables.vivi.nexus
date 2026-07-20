"use client"

import * as React from "react"
import { useRef } from "react"
import { cn } from "@/lib/utils"

interface TracingSliderProps {
  value: number
  max: number
  disabled?: boolean
  color?: string
  showButtons?: boolean
  showLabel?: boolean
  label?: React.ReactNode
  labelRight?: React.ReactNode
  buttonSize?: "sm" | "md"
  className?: string
  onChange: (value: number) => void
}

function TracingSlider({
  value,
  max,
  disabled = false,
  color,
  showButtons = false,
  showLabel = false,
  label,
  labelRight,
  buttonSize = "md",
  className,
  onChange,
}: TracingSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const fill = color ?? "hsl(var(--primary))"
  const pct  = max > 0 ? Math.min(100, (value / max) * 100) : 0

  const btnBase = "rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-bold flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-default shrink-0"
  const btnSz   = buttonSize === "sm" ? "size-6 rounded-md" : "size-7"

  function valueFromPointer(clientX: number): number {
    if (!trackRef.current) return value
    const rect = trackRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(ratio * max)
  }

  // Dragging only starts from the thumb itself — clicking elsewhere on the
  // track no longer jumps the value straight there, it has to be grabbed.
  function handleThumbPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handleThumbPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled || !e.buttons) return
    onChange(valueFromPointer(e.clientX))
  }

  return (
    <div className={cn("flex flex-col gap-1.5 w-full min-w-0", className)}>
      {(showLabel || label || labelRight) && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/50">{label}</span>
          {labelRight && <span className="text-white/30">{labelRight}</span>}
        </div>
      )}

      <div className="flex items-center gap-2 min-w-0">
        {showButtons && (
          <button
            type="button"
            disabled={disabled || value <= 0}
            onClick={() => onChange(Math.max(0, value - 1))}
            className={cn(btnBase, btnSz)}
          >
            −
          </button>
        )}

        {/* Custom animated track — display only, no longer click-to-jump */}
        <div
          ref={trackRef}
          className="relative flex-1 min-w-0 h-5 flex items-center"
        >
          {/* Track background */}
          <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/10">
            {/* Animated fill */}
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${pct}%`,
                background: fill,
                transition: "width 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
              }}
            />
          </div>

          {/* Draggable thumb — hit area is bigger than the visible 12px dot
              (easier to grab, especially on touch) but must be held to move;
              the track around it no longer responds to pointer events at all. */}
          <div
            onPointerDown={handleThumbPointerDown}
            onPointerMove={handleThumbPointerMove}
            className={cn(
              "absolute size-5 rounded-full flex items-center justify-center touch-none",
              disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing"
            )}
            style={{
              left: `${pct}%`,
              transform: "translateX(-50%)",
              transition: "left 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            }}
          >
            <div className="size-3 rounded-full bg-white shadow pointer-events-none" />
          </div>
        </div>

        {showButtons && (
          <button
            type="button"
            disabled={disabled || value >= max}
            onClick={() => onChange(Math.min(max, value + 1))}
            className={cn(btnBase, btnSz)}
          >
            +
          </button>
        )}
      </div>
    </div>
  )
}

export { TracingSlider }
export type { TracingSliderProps }
