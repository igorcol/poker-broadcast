"use client"

import { BoardPanel } from "../../components/overlay/board-panel.tsx"
import { PlayerCard } from "../../components/overlay/player-card.tsx"
import { useEngine } from "../../lib/use-engine.ts"

/**
 * Camada que o OBS compõe sobre o vídeo da mesa, servida em localhost com fundo transparente.
 * Coluna de jogadores à esquerda, comunitárias e pote no canto inferior direito.
 * Nunca envia nada ao engine: é leitura pura, o console é quem opera.
 */

export default function OverlayPage() {
  const { state, connected } = useEngine()

  return (
    <div className="overlay">
      {state !== null && (
        <>
          <div className="overlay__players">
            {state.seats.map((seat, position) =>
              seat.status === "folded" ? null : (
                <PlayerCard
                  key={seat.index}
                  seat={seat}
                  state={state}
                  acting={position === state.toAct}
                />
              ),
            )}
          </div>

          <BoardPanel state={state} />
        </>
      )}

      {!connected && <div className="overlay__offline">engine offline</div>}
    </div>
  )
}