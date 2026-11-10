"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

type FormDialogProps = {
  /** The button that opens it. Leave out and pass open / onOpenChange to
   * open it from elsewhere. */
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  size?: "default" | "wide"
  /** The verb on the submit button: "新增", "儲存". */
  submitLabel: string
  /** Shown while onSubmit runs; defaults to the verb + "中…". */
  pendingLabel?: string
  /** Runs with the form's data while every field and button is locked.
   * Resolve to close; throw to stay open with the input kept (report the
   * error yourself, in a toast). */
  onSubmit: (data: FormData) => void | Promise<void>
  /** FormField rows. */
  children: React.ReactNode
}

// A short form called up over the page: title, fields, then Cancel and the
// submit verb. Closes only once the submit has finished.
function FormDialog({
  trigger,
  open: openProp,
  onOpenChange,
  title,
  size,
  submitLabel,
  pendingLabel = `${submitLabel}中…`,
  onSubmit,
  children,
}: FormDialogProps) {
  const [openState, setOpenState] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const open = openProp ?? openState

  function setOpen(next: boolean) {
    if (openProp === undefined) setOpenState(next)
    onOpenChange?.(next)
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    startTransition(async () => {
      try {
        await onSubmit(data)
        setOpen(false)
      } catch (error) {
        console.error(error)
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) setOpen(next)
      }}
    >
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent size={size} showCloseButton={false}>
        <form onSubmit={submit} className="flex flex-col gap-6">
          <DialogHeader className="pr-0">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <fieldset disabled={pending} className="flex min-w-0 flex-col gap-4">
            {children}
          </fieldset>
          <DialogFooter>
            <DialogClose
              disabled={pending}
              render={<Button type="button" variant="outline" />}
            >
              取消
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? pendingLabel : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type FormFieldProps = {
  label: string
  /** Marks the label and the control as required. */
  required?: boolean
  /** One control: Input, Textarea, a select trigger. It receives the id the
   * label points at. */
  children: React.ReactElement<{ id?: string; required?: boolean }>
}

// A label over its control. No helper text below: say it in the label.
function FormField({ label, required, children }: FormFieldProps) {
  const id = React.useId()
  const controlId = children.props.id ?? id

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={controlId} className="gap-1">
        {label}
        {required && (
          <span aria-hidden className="text-destructive">
            *
          </span>
        )}
      </Label>
      {React.cloneElement(children, { id: controlId, required })}
    </div>
  )
}

export { FormDialog, FormField }
