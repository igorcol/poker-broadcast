"use client"

import type { Card, ClientMessage, GameState } from "@poker-broadcast/core"

import { CardInput } from "./card-input.tsx"

/**
 * Lista de assentos com stack, aposta da rodada, cartas e marcadores de botão e vez.
 * Cada linha traz o campo de hole cards do próprio assento — o operador digita onde enxerga.
 * Só desenha e emite intenção: quem valida carta repetida é o engine.
 */

export function SeatList({
  state,
  send,
}: {
  readonly state: GameState
  readonly send: (message: ClientMessage) => void
}) {
  function setCards(seat: number, cards: readonly Card[]): void {
    const [first, second] = cards
    if (first !== undefined && second !== undefined) {
      send({ type: "set-cards", seat, cards: [first, second] })
    }
  }

  return (
    <ul className="seats">
      {state.seats.map((seat, position) => (
        <li
          key={seat.index}
          className={`seat seat--${seat.status}${position === state.toAct ? " seat--acting" : ""}`}
        >
          <span className="seat__marks">
            {position === state.toAct ? "▸" : " "}
            {position === state.button ? "D" : " "}
          </span>
          <span className="seat__name">{seat.name}</span>
          <span className="seat__stack">{seat.stack}</span>
          <span className="seat__bet">{seat.committed > 0 ? seat.committed : ""}</span>
          <CardInput
            expected={2}
            placeholder="— —"
            current={seat.cards}
            onSubmit={(cards) => setCards(position, cards)}
          />
          <span className="seat__status">{seat.status === "active" ? "" : seat.status}</span>
        </li>
      ))}
    </ul>
  )
}