"use client"

import { useState } from "react"

import { parseCards, type Card } from "@poker-broadcast/core"

/**
 * Campo de entrada de cartas na notação de 2 caracteres, aceitando `KsQh` ou `Ks Qh`.
 * Só entrega quando a quantidade bate e todas são válidas; erro de baralho vem do engine.
 * Serve tanto pro board quanto pras hole cards de um assento.
 */

export function CardInput({
  expected,
  placeholder,
  current,
  onSubmit,
}: {
  readonly expected: number
  readonly placeholder: string
  readonly current: readonly Card[] | null
  readonly onSubmit: (cards: readonly Card[]) => void
}) {
  const [value, setValue] = useState("")

  const parsed = parseCards(value)
  const valid = parsed !== null && parsed.length === expected

  function submit(): void {
    if (parsed !== null && parsed.length === expected) {
      onSubmit(parsed)
      setValue("")
    }
  }

  return (
    <input
      className={`card-input${value !== "" && !valid ? " card-input--bad" : ""}`}
      value={value}
      placeholder={current !== null && current.length > 0 ? current.join(" ") : placeholder}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") submit()
        if (event.key === "Escape") setValue("")
      }}
      aria-label={placeholder}
    />
  )
}