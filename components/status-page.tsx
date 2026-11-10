import * as React from "react"

// A page that only says what happened and the way out: not found, an error,
// no access, signed out. Put it in app-shell's spotlight layout. The title
// says it all ("找不到這個頁面"); the action is a verb ("回到首頁", "重試").
function StatusPage({
  title,
  action,
}: {
  title: string
  action?: React.ReactNode
}) {
  return (
    <div
      data-slot="status-page"
      className="flex flex-col items-center gap-12 text-center"
    >
      <h1 className="text-title font-medium">{title}</h1>
      {action}
    </div>
  )
}

export { StatusPage }
