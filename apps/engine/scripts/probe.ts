import { exit } from "node:process"

import type { ServerMessage } from "@poker-broadcast/core"

/**
 * Cliente mínimo pra verificar o engine sem console nem overlay.
 * Espera o estado inicial, roda um roteiro de mensagens e imprime o que voltar de cada uma.
 * É descartável — some quando o console da 2.7 existir.
 */

const socket = new WebSocket("ws://localhost:4000")

const SCRIPT = [
  {
    type: "start-hand",
    config: {
      seats: [
        { index: 0, name: "P0", stack: 1000 },
        { index: 1, name: "P1", stack: 1000 },
        { index: 2, name: "P2", stack: 1000 },
      ],
      button: 0,
      smallBlind: 10,
      bigBlind: 20,
    },
  },
  { type: "action", action: { type: "raise", to: 60 } },
  { type: "set-cards", seat: 0, cards: ["Ks", "Qh"] },
  { type: "set-cards", seat: 1, cards: ["Ks", "2d"] },
  { type: "action", action: { type: "fold" } },
  { type: "undo" },
]

let step = -1

function describe(message: ServerMessage): string {
  if (message.type === "error") return `erro: ${message.error}`

  const state = message.state
  if (state === null) return "sem mão"
  return `${state.phase} · pote ${state.pot} · toAct ${state.toAct} · seat0 ${JSON.stringify(state.seats[0]?.cards)}`
}

socket.addEventListener("message", (event) => {
  const message: ServerMessage = JSON.parse(String(event.data))
  console.log(`${step < 0 ? "conexão" : SCRIPT[step]?.type}: ${describe(message)}`)

  step += 1
  const next = SCRIPT[step]
  if (next === undefined) {
    socket.close()
    exit(0)
  }
  socket.send(JSON.stringify(next))
})