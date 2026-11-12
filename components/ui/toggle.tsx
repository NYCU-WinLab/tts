"use client"

import * as React from "react"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// A button that stays on or off: an icon (the default size) or a word, such
// as a weekday or a tag (size "text"). Its state
// never rests on color alone: the fill changes, and with `offIcon` the icon
// changes too, one icon shrinking out as the other grows in.
//
// default: a feature that is off until someone turns it on (captions, a
// side panel). On is the primary fill; off looks like an outline button.
// alert: a device that is expected to be on (a microphone, a camera). On
// looks like an outline button; off is the destructive tint, so "you are
// muted" is the state that stands out.
const toggleVariants = cva(
  "group/toggle inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-control border text-body font-medium whitespace-nowrap transition-colors duration-state outline-none select-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-border bg-background hover:bg-muted focus-visible:ring-ring/50 data-pressed:border-transparent data-pressed:bg-primary data-pressed:text-primary-foreground data-pressed:hover:bg-primary/90 data-pressed:focus-visible:ring-primary/50",
        alert:
          "border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-destructive/20 data-pressed:border-border data-pressed:bg-background data-pressed:text-foreground data-pressed:hover:bg-muted data-pressed:focus-visible:ring-ring/50",
      },
      size: {
        icon: "w-10",
        text: "px-4",
      },
    },
    defaultVariants: { variant: "default", size: "icon" },
  }
)

const face =
  "col-start-1 row-start-1 flex items-center justify-center transition-all duration-state motion-reduce:scale-100 motion-reduce:transition-opacity"

function Toggle({
  className,
  variant,
  size,
  offIcon,
  children,
  ...props
}: TogglePrimitive.Props &
  VariantProps<typeof toggleVariants> & {
    /** The icon while off; `children` is the icon while on. */
    offIcon?: React.ReactNode
  }) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    >
      {offIcon === undefined ? (
        children
      ) : (
        // Both icons share one cell, so the button never changes size.
        <span aria-hidden className="grid">
          <span
            className={cn(
              face,
              "scale-50 opacity-0 group-data-pressed/toggle:scale-100 group-data-pressed/toggle:opacity-100"
            )}
          >
            {children}
          </span>
          <span
            className={cn(
              face,
              "group-data-pressed/toggle:scale-50 group-data-pressed/toggle:opacity-0 motion-reduce:group-data-pressed/toggle:scale-100"
            )}
          >
            {offIcon}
          </span>
        </span>
      )}
    </TogglePrimitive>
  )
}

export { Toggle, toggleVariants }
