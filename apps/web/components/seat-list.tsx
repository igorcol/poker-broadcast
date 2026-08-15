import type { GameState } from "@poker-broadcast/core"

/**
 * Lista de assentos com stack, aposta da rodada, cartas e marcadores de botão e vez.
 * É a leitura principal do operador durante a mão. Precisa ser escaneável de relance.
 * Só desenha: quem decide quem age é o engine.
 */

export function SeatList({ state }: { readonly state: GameState }) {
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
          <span className="seat__cards">{seat.cards?.join(" ") ?? "—"}</span>
          <span className="seat__status">{seat.status === "active" ? "" : seat.status}</span>
        </li>
      ))}
    </ul>
  )
}