import type { Metadata } from "next"
import {
  Inter,
  JetBrains_Mono,
  Noto_Sans_JP,
  Noto_Sans_TC,
} from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"

// The font variables the WinLab base expects; the stack order lives in
// globals.css.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto-sans-jp",
})
const notoSansTc = Noto_Sans_TC({
  subsets: ["latin"],
  variable: "--font-noto-sans-tc",
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
})

export const metadata: Metadata = {
  title: "WinLab TTS",
  description: "WinLab 實驗室的語音合成。",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-TW"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        inter.variable,
        notoSansJp.variable,
        notoSansTc.variable,
        jetbrainsMono.variable
      )}
    >
      <body>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
