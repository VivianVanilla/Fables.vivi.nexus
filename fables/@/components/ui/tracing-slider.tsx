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

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    onChange(valueFromPointer(e.clientX))
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
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

        {/* Custom animated track */}
        <div
          ref={trackRef}
          className={cn(
            "relative flex-1 min-w-0 h-5 flex items-center",
            disabled ? "cursor-default" : "cursor-pointer"
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
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

          {/* Animated thumb */}
          <div
            className="absolute size-3 rounded-full bg-white shadow pointer-events-none"
            style={{
              left: `${pct}%`,
              transform: "translateX(-50%)",
              transition: "left 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            }}
          />
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
