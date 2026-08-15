"use client"

import { totalPot } from "@poker-broadcast/core"

import { useEngine } from "../../lib/use-engine.ts"

/**
 * Camada que o OBS compõe sobre o vídeo da mesa, servida em localhost com fundo transparente.
 * Nunca envia nada ao engine: leitura pura, o console é quem opera.
 */

export default function OverlayPage() {
  const { state, connected } = useEngine()

  return (
    <div className="overlay">
      {state === null ? (
        <p className="overlay__muted">sem mão</p>
      ) : (
        <>
          <p className="overlay__line">
            {state.phase} · pote {totalPot(state)}
          </p>
          <p className="overlay__line">
            board {state.board.length > 0 ? state.board.join(" ") : "—"}
          </p>
          {state.seats.map((seat, position) => (
            <p key={seat.index} className="overlay__line">
              {position === state.toAct ? "▸ " : "  "}
              {seat.name} · {seat.stack} · {seat.cards?.join(" ") ?? "??"}
              {seat.status !== "active" && ` · ${seat.status}`}
            </p>
          ))}
        </>
      )}

      {!connected && <div className="overlay__offline">engine offline</div>}
    </div>
  )
}