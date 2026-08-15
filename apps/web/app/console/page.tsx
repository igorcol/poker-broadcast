"use client"

import { legalActions, totalPot } from "@poker-broadcast/core"

import { SeatList } from "../../components/seat-list.tsx"
import { useEngine } from "../../lib/use-engine.ts"

/**
 * Tela de operação da mesa: estado da mão, assentos e ações disponíveis.
 * Reflete o engine em tempo real; qualquer divergência aqui é bug de transporte.
 * TODO:: Nesta etapa é somente leitura. Cadastro e comandos entram em breve.
 */

export default function ConsolePage() {
  const { state, error, connected } = useEngine()

  return (
    <main className="console">
      <header className="console__header">
        <h1>console</h1>
        <span className={connected ? "status status--on" : "status status--off"}>
          {connected ? "conectado" : "reconectando…"}
        </span>
      </header>

      {error !== null && <p className="error">{error}</p>}

      {state === null ? (
        <p className="empty">nenhuma mão em andamento</p>
      ) : (
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
    </main>
  )
}