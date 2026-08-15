import { exit } from "node:process"

import type { ServerMessage } from "@poker-broadcast/core"

/**
 * Cliente mínimo pra verificar o engine sem console nem overlay.
 * Roda um roteiro que mistura mensagens válidas e malformadas, pra sondar a fronteira de entrada.
 * É descartável — some quando o console da 2.7 existir.
 */

const socket = new WebSocket("ws://localhost:4000")

// Tipado como registro solto de propósito: metade do roteiro é lixo que o cliente não deveria mandar
const SCRIPT: readonly Record<string, unknown>[] = [
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
  { type: "action", action: { type: "raise", to: "abc" } },
  { type: "action", action: { type: "raise", to: null } },
  { type: "action", action: { type: "raise", to: -500 } },
  { type: "set-cards", seat: -1, cards: ["2h", "3h"] },
  { type: "action", action: { type: "raise", to: 60 } },
  { type: "set-cards", seat: 0, cards: ["Ks", "Qh"] },
  { type: "undo" },
]

let step = -1

function describe(message: ServerMessage): string {
  if (message.type === "error") return `erro: ${message.error}`

  const state = message.state
  if (state === null) return "sem mão"

  const stacks = state.seats.map((seat) => seat.stack).join("/")
  return `${state.phase} · pote ${state.pot} · bet ${state.currentBet} · stacks ${stacks} · toAct ${state.toAct}`
}

socket.addEventListener("message", (event) => {
  const message: ServerMessage = JSON.parse(String(event.data))
  const label = step < 0 ? "conexão" : String(SCRIPT[step]?.["type"])
  console.log(`${label.padEnd(12)} ${describe(message)}`)

  step += 1
  const next = SCRIPT[step]
  if (next === undefined) {
    socket.close()
    exit(0)
  }
  socket.send(JSON.stringify(next))
})