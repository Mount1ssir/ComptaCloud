"use client"

import * as React from "react"
import { Check } from "lucide-react"

export interface CheckboxProps {
  id?: string
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ id, checked, onCheckedChange, disabled, className, ...props }, ref) => {
    return (
      <button
        type="button"
        id={id}
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => {
          if (!disabled && onCheckedChange) {
            onCheckedChange(!checked)
          }
        }}
        className={`peer h-4 w-4 shrink-0 rounded-xs border border-primary ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center transition-colors ${
          checked ? "bg-primary text-primary-foreground" : "bg-background"
        } ${className || ""}`}
      >
        {checked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
      </button>
    )
  }
)
Checkbox.displayName = "Checkbox"
