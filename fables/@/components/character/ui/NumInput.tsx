import React from "react"

type Props = React.InputHTMLAttributes<HTMLInputElement>

export function NumInput({ className, ...props }: Props) {
  return (
    <input
      type="number"
      {...props}
      className={`[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${className ?? ""}`}
    />
  )
}
