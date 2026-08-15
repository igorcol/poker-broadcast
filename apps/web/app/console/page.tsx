"use client"

import { useState } from "react"

import { legalActions, totalPot } from "@poker-broadcast/core"

import { HandSetup } from "../../components/hand-setup.tsx"
import { SeatList } from "../../components/seat-list.tsx"
import { useEngine } from "../../lib/use-engine.ts"

/**
 * Tela de operação da mesa: cadastro pré-mão, estado da mão e ações disponíveis.
 * Alterna entre cadastro e mesa conforme houver mão em andamento no engine.
 * Reflete o engine em tempo real; qualquer divergência aqui é bug de transporte.
 */

export default function ConsolePage() {
  const { state, error, connected, send } = useEngine()
  const [forceSetup, setForceSetup] = useState(false)

  const handOver = state === null || state.phase === "complete"
  const showSetup = handOver || forceSetup

  return (
    <main className="console">
      <header className="console__header">
        <h1>console</h1>
        <span className={connected ? "status status--on" : "status status--off"}>
          {connected ? "conectado" : "reconectando…"}
        </span>
      </header>

      {error !== null && <p className="error">{error}</p>}

      {state !== null && (
        <>
          <section className="summary">
            <span>{state.phase}</span>
            <span>pote {totalPot(state)}</span>
            <span>board {state.board.length > 0 ? state.board.join(" ") : "—"}</span>
          </section>

          <SeatList state={state} />

          <footer className="legal">
            {legalActions(state).length > 0 ? legalActions(state).join(" · ") : "sem ação pendente"}
          </footer>
        </>
      )}

      {showSetup ? (
        <HandSetup
          onStart={(config) => {
            send({ type: "start-hand", config })
            setForceSetup(false)
          }}
          // Cancelar só faz sentido quando há mão viva pra voltar
          onCancel={handOver ? null : () => setForceSetup(false)}
        />
      ) : (
        <div className="setup__actions">
          <button type="button" onClick={() => setForceSetup(true)}>
            nova mão
          </button>
        </div>
      )}
    </main>
  )
}