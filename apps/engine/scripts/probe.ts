import { exit } from "node:process"

import type { ServerMessage } from "@poker-broadcast/core"

/**
 * Cliente mínimo pra verificar o engine sem console nem overlay.
 * Conecta, abre uma mão, aplica duas ações e imprime o estado que voltar.
 * Descartavel
 */

// npm start --workspace @poker-broadcast/engine

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
  { type: "action", action: { type: "fold" } },
  { type: "undo" },
]

let step = 0

socket.addEventListener("open", () => {
  socket.send(JSON.stringify(SCRIPT[step]))
})

socket.addEventListener("message", (event) => {
  const message: ServerMessage = JSON.parse(String(event.data))

  if (message.type === "error") {
    console.log(`erro: ${message.error}`)
  } else {
    const state = message.state
    console.log(
      state === null
        ? "sem mão"
        : `${state.phase} · pote ${state.pot} · toAct ${state.toAct} · seat0 ${JSON.stringify(state.seats[0]?.cards)}`,
    )
  }

  step += 1
  const next = SCRIPT[step]
  if (next === undefined) {
    socket.close()
    exit(0)
  }
  socket.send(JSON.stringify(next))
})