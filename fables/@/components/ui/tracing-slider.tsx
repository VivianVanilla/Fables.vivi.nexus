"use client"

import * as React from "react"
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
  const btnBase =
    "rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-bold flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-default shrink-0"
  const btnSz = buttonSize === "sm" ? "size-6 rounded-md" : "size-7"
  const pct   = max > 0 ? (value / max) * 100 : 0
  const fill  = color ?? "hsl(var(--primary))"

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
        <input
          type="range"
          min={0}
          max={max}
          value={value}
          disabled={disabled}
          onChange={e => onChange(Number(e.target.value))}
          className="flex-1 min-w-0 w-full h-1.5 rounded-full appearance-none cursor-pointer disabled:cursor-default
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:size-3
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:shadow
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-125
            [&::-webkit-slider-thumb]:active:scale-110
            [&::-moz-range-thumb]:size-3
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-white
            [&::-moz-range-thumb]:border-0"
          style={{
            background: `linear-gradient(to right, ${fill} ${pct}%, rgba(255,255,255,0.1) ${pct}%)`,
          }}
        />
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
