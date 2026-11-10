"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

// Unstyled sonner, styled with the tokens only: a frosted layer-2 surface
// with p-6 around 40px action buttons, so it takes rounded-surface.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-success" />,
        info: <InfoIcon className="size-4 text-muted-foreground" />,
        warning: <TriangleAlertIcon className="size-4 text-warning" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: (
          <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
        ),
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-center gap-3 rounded-surface border border-border bg-overlay p-6 text-body text-foreground shadow-lg backdrop-blur-md",
          icon: "flex size-6 shrink-0 items-center justify-center self-start",
          content: "flex flex-1 flex-col",
          title: "font-medium",
          description: "text-muted-foreground",
          actionButton:
            "inline-flex h-10 shrink-0 items-center rounded-control bg-primary px-4 font-medium text-primary-foreground hover:bg-primary/90",
          cancelButton:
            "inline-flex h-10 shrink-0 items-center rounded-control border border-border px-4 font-medium hover:bg-muted",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
