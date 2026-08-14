import React, { useEffect, useRef, useState } from "react"

type Props = React.InputHTMLAttributes<HTMLInputElement>

// A "0" that appears because the field was just cleared isn't a real value —
// but every consumer here is a controlled input computing its next value with
// `parseInt(e.target.value) || 0` on every keystroke, so the instant the box
// goes empty the parent commits 0 and the DOM snaps straight back to "0"
// before the user can type their next digit. NumInput keeps its own draft
// text while focused so the box can sit empty like a normal text field, and
// only asks the caller to commit once it's blurred — an empty field commits
// as "0" (via a minimal synthetic change event, since every consumer here
// only ever reads `e.target.value`), matching what `parseInt("") || 0`
// already resolved to, so no caller needs to change anything.
export function NumInput({ className, value, onChange, onFocus, onBlur, ...props }: Props) {
  const [draft, setDraft] = useState(() => (value == null ? "" : String(value)))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setDraft(value == null ? "" : String(value))
  }, [value])

  return (
    <input
      type="number"
      {...props}
      value={draft}
      onFocus={e => {
        focused.current = true
        onFocus?.(e)
      }}
      onChange={e => {
        setDraft(e.target.value)
        if (e.target.value.trim() !== "") onChange?.(e)
      }}
      onBlur={e => {
        focused.current = false
        if (e.target.value.trim() === "") {
          setDraft("0")
          onChange?.({ target: { value: "0" } } as React.ChangeEvent<HTMLInputElement>)
        }
        onBlur?.(e)
      }}
      className={`[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${className ?? ""}`}
    />
  )
}
