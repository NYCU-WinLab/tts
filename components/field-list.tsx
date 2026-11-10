import * as React from "react"

// One record's fields: the name in a muted column on the left, the value
// beside it; on a phone the value drops under its name. Rows are split by
// dividers and arrive one after another, like any list.
function FieldList({ children }: { children: React.ReactNode }) {
  return (
    <dl data-slot="field-list" className="flex stagger-rise flex-col">
      {children}
    </dl>
  )
}

function FieldRow({
  label,
  children,
}: {
  label: React.ReactNode
  /** The value; put tabular-nums on amounts. */
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-4 sm:flex-row sm:gap-6">
      <dt className="text-muted-foreground sm:w-40 sm:shrink-0">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

export { FieldList, FieldRow }
