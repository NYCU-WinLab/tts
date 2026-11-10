"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MenuIcon } from "lucide-react"
import { cn } from "@/lib/utils"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Every corner item has a tip, required so none is forgotten. It says what
// the label leaves out (where a link goes, what a page holds, whose account
// it is); it never repeats the label.
type Crumb = { label: string; href: string; tip: string }
type NavItem = { label: string; href: string; tip: string }
// Signed in, the account can open a menu instead of a page: the member's
// name, then items such as 登出 (DropdownMenuItem children).
type AccountMenu = { label: string; tip: string; menu: React.ReactNode }

// The build running: the short commit, the build time and the CD run.
type Build = { sha?: string; time?: string; url?: string }

// The chrome of every WinLab app is its four corners. By default each corner
// has one job, filled from the props below; an app that needs something else
// in a corner passes it in `corners`, built from CornerLink and CornerTip so
// it keeps the corner's look.
//   top left     where you are: breadcrumb back to the lab and the app
//   top right    where you can go: this app's pages, then its actions (such
//                as 搜尋 or 上傳, opening over any page), then the account
//                (登入 when signed out, the member's name when signed in).
//                Below md the pages fold into one menu button; the actions
//                and the account stay.
//   bottom left  which build: the commit this build came from
//   bottom right the copyright year; the tip names the owner
// Every item can carry a tip, opening toward the page and lined up with the
// corner's outer edge so it never leaves the viewport.
// Three page layouts:
//   column     read top to bottom: home, lists, tables, long forms
//   spotlight  one thing, centered between the corners: a detail, sign-in,
//              a result, an empty state; taller content scrolls as a column
//   wide       a grid that needs every pixel, such as a two-week timetable:
//              the full width between the corners' outer edges
function AppShell({
  breadcrumb = [],
  nav = [],
  actions,
  account,
  layout = "column",
  corners,
  footer = true,
  build,
  children,
}: {
  breadcrumb?: Crumb[]
  nav?: NavItem[]
  /** After the pages in the top right: buttons that work on any page, built
   * from cornerLinkClassName. */
  actions?: React.ReactNode
  /** Last in the top right: { label: "登入", href: "/sign-in" } signed out;
   * signed in, the member's name linking to their page, or opening `menu`. */
  account?: NavItem | AccountMenu
  corners?: Partial<
    Record<
      "topLeft" | "topRight" | "bottomLeft" | "bottomRight",
      React.ReactNode
    >
  >
  layout?: "column" | "spotlight" | "wide"
  /** false drops both bottom corners: a page that fills the screen, such as
   * a meeting, keeps its own controls there. */
  footer?: boolean
  /** The build running, read on the server at run time (see BuildVersion).
   * Without it the corner falls back to NEXT_PUBLIC_BUILD_*. */
  build?: Build
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isCurrent = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)

  return (
    <TooltipProvider>
      {/* Content scrolling under the corners fades into frosted glass. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-40 h-16 mask-b-from-0% backdrop-blur-md"
      />
      {footer && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 bottom-0 z-40 h-16 mask-t-from-0% backdrop-blur-md"
        />
      )}

      <header className="fixed top-4 left-4 z-50 flex items-center gap-4">
        {corners?.topLeft ?? (
          <nav aria-label="位置" className="flex items-center gap-2">
            {breadcrumb.map((crumb, index) => {
              const last = index === breadcrumb.length - 1
              return (
                <React.Fragment key={crumb.href}>
                  {index > 0 && (
                    <span aria-hidden className="text-muted-foreground">
                      /
                    </span>
                  )}
                  <CornerTip tip={crumb.tip} corner="top-left">
                    <Link
                      href={crumb.href}
                      prefetch
                      aria-current={last ? "page" : undefined}
                      className={cn(
                        cornerLinkClassName,
                        last && "text-foreground"
                      )}
                    >
                      {crumb.label}
                    </Link>
                  </CornerTip>
                </React.Fragment>
              )
            })}
          </nav>
        )}
      </header>

      <div className="fixed top-4 right-4 z-50 flex items-center gap-4">
        {corners?.topRight ?? (
          <>
            {nav.length > 0 && <PageNav nav={nav} isCurrent={isCurrent} />}
            {actions}
            {account && <Account account={account} isCurrent={isCurrent} />}
          </>
        )}
      </div>

      {footer && (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-4">
          {corners?.bottomLeft ?? <BuildVersion build={build} />}
        </div>
      )}

      {footer && (
        <div className="fixed right-4 bottom-4 z-50 flex items-center gap-4">
          {corners?.bottomRight ?? (
            <CornerTip tip="NYCU WinLab" corner="bottom-right">
              <span
                tabIndex={0}
                className={cn(cornerLinkClassName, "cursor-default")}
              >
                © {new Date().getFullYear()}
              </span>
            </CornerTip>
          )}
        </div>
      )}

      {layout === "spotlight" ? (
        <main className="flex min-h-svh w-full items-center justify-center px-6 py-24">
          <div className="w-full max-w-2xl">{children}</div>
        </main>
      ) : layout === "wide" ? (
        <main className="w-full px-4 pt-24 pb-24">{children}</main>
      ) : (
        <main className="mx-auto w-full max-w-4xl px-6 pt-24 pb-24">
          {children}
        </main>
      )}
    </TooltipProvider>
  )
}

// Wide screens list the pages; narrow ones fold them into a menu of the same
// links, so an app with five pages still fits beside the breadcrumb.
function PageNav({
  nav,
  isCurrent,
}: {
  nav: NavItem[]
  isCurrent: (href: string) => boolean
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <nav aria-label="頁面" className="hidden items-center gap-4 md:flex">
        {nav.map((item) => (
          <CornerTip key={item.href} tip={item.tip} corner="top-right">
            <Link
              href={item.href}
              // Pages are per member and dynamic, so Next only prefetches
              // them when asked; then switching between them needs no
              // round trip.
              prefetch
              aria-current={isCurrent(item.href) ? "page" : undefined}
              className={cn(
                cornerLinkClassName,
                isCurrent(item.href) && "text-foreground"
              )}
            >
              {item.label}
            </Link>
          </CornerTip>
        ))}
      </nav>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-label="頁面選單"
          className={cn(cornerLinkClassName, "cursor-pointer md:hidden")}
        >
          <MenuIcon className="size-5" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-1">
          <nav aria-label="頁面" className="flex flex-col">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isCurrent(item.href) ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex h-10 items-center rounded-control px-3 text-muted-foreground transition-colors duration-state outline-none hover:bg-muted hover:text-foreground focus-visible:bg-muted",
                  isCurrent(item.href) && "text-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </PopoverContent>
      </Popover>
    </>
  )
}

// The account is a link (登入, or the member's page) or a menu under the
// member's name. It is never prefetched: /sign-in can start a sign-in.
function Account({
  account,
  isCurrent,
}: {
  account: NavItem | AccountMenu
  isCurrent: (href: string) => boolean
}) {
  if ("menu" in account) {
    return (
      <DropdownMenu>
        <CornerTip tip={account.tip} corner="top-right">
          <DropdownMenuTrigger
            className={cn(cornerLinkClassName, "max-w-40 cursor-pointer")}
          >
            <span className="truncate">{account.label}</span>
          </DropdownMenuTrigger>
        </CornerTip>
        <DropdownMenuContent align="end">{account.menu}</DropdownMenuContent>
      </DropdownMenu>
    )
  }
  return (
    <CornerTip tip={account.tip} corner="top-right">
      <Link
        href={account.href}
        prefetch={false}
        aria-current={isCurrent(account.href) ? "page" : undefined}
        className={cn(
          cornerLinkClassName,
          isCurrent(account.href) && "text-foreground"
        )}
      >
        {account.label}
      </Link>
    </CornerTip>
  )
}

type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right"

function CornerTip({
  tip,
  corner,
  children,
}: {
  tip?: string
  corner: Corner
  children: React.ReactElement
}) {
  if (!tip) return children
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent
        side={corner.startsWith("top") ? "bottom" : "top"}
        align={corner.endsWith("left") ? "start" : "end"}
      >
        {tip}
      </TooltipContent>
    </Tooltip>
  )
}

// The look of a corner item, for custom corner content that is not a link.
const cornerLinkClassName =
  "relative inline-flex h-6 items-center text-muted-foreground transition-colors duration-state outline-none after:absolute after:-inset-2 hover:text-foreground focus-visible:text-foreground"

// Which build is running: the short commit, linking to the CD run that built
// it, with the build time as its tip. CI builds the image on the pull
// request and merging only retags it, so the commit is not known at build
// time: a server app reads it at run time and passes `build`. A static site
// builds with NEXT_PUBLIC_BUILD_* instead. Without a commit (local dev) the
// corner says "dev".
function BuildVersion({ build }: { build?: Build }) {
  const sha = build?.sha ?? process.env.NEXT_PUBLIC_BUILD_SHA
  const time = build?.time ?? process.env.NEXT_PUBLIC_BUILD_TIME
  const url = build?.url ?? process.env.NEXT_PUBLIC_BUILD_URL
  if (!sha) {
    return <span className={cornerLinkClassName}>dev</span>
  }
  const label = <span className="font-mono">{sha}</span>
  return (
    <CornerTip tip={time ? `建置於 ${time}` : undefined} corner="bottom-left">
      {url ? (
        <a href={url} className={cornerLinkClassName}>
          {label}
        </a>
      ) : (
        <span
          tabIndex={0}
          className={cn(cornerLinkClassName, "cursor-default")}
        >
          {label}
        </span>
      )}
    </CornerTip>
  )
}

// A link styled for a corner, for custom corner content.
function CornerLink({
  className,
  ...props
}: React.ComponentProps<typeof Link>) {
  return <Link className={cn(cornerLinkClassName, className)} {...props} />
}

export type { Build }
export { AppShell, BuildVersion, CornerLink, CornerTip, cornerLinkClassName }
