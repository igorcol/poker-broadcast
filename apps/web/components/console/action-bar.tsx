"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import {
  legalActions,
  seatToAct,
  type Action,
  type ClientMessage,
  type GameState,
} from "@poker-broadcast/core"

/**
 * Botões de ação do operador, com atalho de teclado e campo de valor para o raise.
 * Habilita apenas o que o engine considera legal — o console nunca decide regra.
 * Atalhos ficam inertes enquanto o foco está num campo, pra não engolir digitação.
 */

export function ActionBar({
  state,
  send,
}: {
  readonly state: GameState
  readonly send: (message: ClientMessage) => void
}) {
  const [raising, setRaising] = useState(false)
  const [amount, setAmount] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const legal = legalActions(state)
  const seat = seatToAct(state)
  const toCall = seat === null ? 0 : state.currentBet - seat.committed
  const minRaise = state.currentBet + state.minRaise

  const act = useCallback(
    (action: Action) => {
      send({ type: "action", action })
      setRaising(false)
    },
    [send],
  )

  const openRaise = useCallback(() => {
    setAmount(String(minRaise))
    setRaising(true)
  }, [minRaise])

  useEffect(() => {
    if (raising) inputRef.current?.select()
  }, [raising])

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return

      const key = event.key.toLowerCase()
      if (key === "f" && legal.includes("fold")) act({ type: "fold" })
      else if (key === "c" && legal.includes("check")) act({ type: "check" })
      else if (key === "c" && legal.includes("call")) act({ type: "call" })
      else if (key === "a" && legal.includes("allin")) act({ type: "allin" })
      else if (key === "r" && legal.includes("raise")) openRaise()
      else if (key === "u") send({ type: "undo" })
      else return

      event.preventDefault()
    }

    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [legal, act, openRaise, send])

  function confirmRaise(): void {
    const to = Number(amount)
    if (Number.isInteger(to) && to > 0) act({ type: "raise", to })
  }

  return (
    <div className="actions">
      <button type="button" onClick={() => act({ type: "fold" })} disabled={!legal.includes("fold")}>
        <u>f</u>old
      </button>

      {legal.includes("check") ? (
        <button type="button" onClick={() => act({ type: "check" })}>
          <u>c</u>heck
        </button>
      ) : (
        <button type="button" onClick={() => act({ type: "call" })} disabled={!legal.includes("call")}>
          <u>c</u>all {toCall > 0 ? toCall : ""}
        </button>
      )}

      {raising ? (
        <span className="actions__raise">
          <input
            ref={inputRef}
            type="number"
            value={amount}
            min={minRaise}
            onChange={(event) => setAmount(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") confirmRaise()
              if (event.key === "Escape") setRaising(false)
            }}
            aria-label="valor do raise"
          />
          <button type="button" className="primary" onClick={confirmRaise}>
            ok
          </button>
          <button type="button" onClick={() => setRaising(false)}>
            esc
          </button>
        </span>
      ) : (
        <button type="button" onClick={openRaise} disabled={!legal.includes("raise")}>
          <u>r</u>aise
        </button>
      )}

      <button type="button" onClick={() => act({ type: "allin" })} disabled={!legal.includes("allin")}>
        <u>a</u>ll-in
      </button>

      <button type="button" className="actions__undo" onClick={() => send({ type: "undo" })}>
        <u>u</u>ndo
      </button>
    </div>
  )
}