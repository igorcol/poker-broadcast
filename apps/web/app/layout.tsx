import type { ReactNode } from "react"

import "./globals.css"

export const metadata = { title: "poker-broadcast" }

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}