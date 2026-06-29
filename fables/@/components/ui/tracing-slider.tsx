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

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {(showLabel || label || labelRight) && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/50">{label}</span>
          {labelRight && <span className="text-white/30">{labelRight}</span>}
        </div>
      )}
      <div className="flex items-center gap-2">
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
          onChange={e => onChange(parseInt(e.target.value))}
          style={color ? { accentColor: color } : undefined}
          className={cn(
            "flex-1 h-2 rounded-full cursor-pointer disabled:opacity-50 disabled:cursor-default",
            !color && "accent-primary"
          )}
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
