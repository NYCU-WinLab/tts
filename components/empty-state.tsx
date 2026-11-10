import * as React from "react"

import { Button } from "@/components/ui/button"
import { TableCell, TableRow } from "@/components/ui/table"

type EmptyStateProps = {
  /** What the list holds: "收據", "訂單". The sentence is built from it, so
   * every app says it the same way. */
  noun: string
  /** The search that found nothing. Without it the list is simply empty. */
  query?: string
  /** Shown with a query: a button that clears it. */
  onClearQuery?: () => void
  /** Shown without a query: the action that adds the first one. */
  action?: React.ReactNode
}

function emptyText(noun: string, query?: string) {
  return query ? `找不到符合「${query}」的${noun}` : `還沒有${noun}`
}

// What a list shows when it has no rows: "還沒有收據" when there is nothing
// yet, "找不到符合「…」的收據" when a search came up empty.
function EmptyState({ noun, query, onClearQuery, action }: EmptyStateProps) {
  const next = query
    ? onClearQuery && (
        <Button key="clear" variant="outline" onClick={onClearQuery}>
          清除搜尋
        </Button>
      )
    : action

  return (
    <div
      data-slot="empty-state"
      className="flex flex-col items-center gap-4 py-12 text-center"
    >
      <p className="text-muted-foreground">{emptyText(noun, query)}</p>
      {next}
    </div>
  )
}

type TableEmptyProps = Pick<EmptyStateProps, "noun" | "query"> & {
  /** The table's column count. */
  colSpan: number
}

// The same sentence as one row spanning a table, under its header.
function TableEmpty({ noun, query, colSpan }: TableEmptyProps) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell
        colSpan={colSpan}
        className="py-12 text-center text-muted-foreground"
      >
        {emptyText(noun, query)}
      </TableCell>
    </TableRow>
  )
}

export { EmptyState, TableEmpty }
