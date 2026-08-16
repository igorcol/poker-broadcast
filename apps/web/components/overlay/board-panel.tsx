import { totalPot, type GameState } from "@poker-broadcast/core"

import { PlayingCard } from "./playing-card.tsx"

/**
 * Painel das comunitárias e do pote, no canto inferior direito.
 * Mostra sempre cinco posições: as que faltam ficam como verso, não somem.
 * O pote inclui o apostado na rodada corrente — é o número que o espectador espera ver.
 */

const BOARD_SLOTS = 5

export function BoardPanel({ state }: { readonly state: GameState }) {
  return (
    <div className="board">
      <div className="board__cards">
        {Array.from({ length: BOARD_SLOTS }, (_, index) => (
          <PlayingCard key={index} card={state.board[index] ?? null} size="large" />
        ))}
      </div>
      <div className="board__pot">
        <span className="board__pot-label">POT</span>
        <span className="board__pot-value">{totalPot(state)}</span>
      </div>
    </div>
  )
}