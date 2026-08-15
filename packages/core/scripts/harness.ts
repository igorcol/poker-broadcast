import { createInterface } from "node:readline/promises"
import { argv, stdin, stdout } from "node:process"

import { applyAction, dealBoard, legalActions, startHand, type Action } from "../src/betting.ts"
import { parseCard, type Card } from "../src/card.ts"
import { pendingBoardCards, type GameState, type HandConfig } from "../src/table.ts"

/**
 * Harness de terminal pra jogar uma mão à mão e ver a máquina de estado funcionando.
 * Lê comandos curtos, aplica no motor e imprime o estado a cada transição.
 * Descartável - existe pra validar o motor antes do console, e sai quando o console entrar.
 */

// --- RODAR ---
// Três jogadores:
// npm run harness --workspace @poker-broadcast/core

// Heads-up:
// npm run harness --workspace @poker-broadcast/core -- 2

// npm test --workspace @poker-broadcast/core

const STACK = 1000
const SMALL_BLIND = 10
const BIG_BLIND = 20

function render(state: GameState): string {
  const board = state.board.length > 0 ? state.board.join(" ") : "—"
  const lines = ["", `── ${state.phase.toUpperCase()} ──  pote ${state.pot}  ·  board ${board}`, ""]

  state.seats.forEach((seat, position) => {
    const marks = `${position === state.toAct ? ">" : " "}${position === state.button ? "D" : " "}`
    const bet = seat.committed > 0 ? `  apostou ${seat.committed}` : ""
    const status = seat.status === "active" ? "" : `  ${seat.status}`
    lines.push(`${marks} ${seat.name.padEnd(4)} ${String(seat.stack).padStart(6)}${bet}${status}`)
  })

  return lines.join("\n")
}

/** `c` vira check ou call conforme o estado. */
function parseAction(input: string, state: GameState): Action | "quit" | null {
  const [command = "", value] = input.trim().toLowerCase().split(/\s+/)

  switch (command) {
    case "q":
      return "quit"
    case "f":
      return { type: "fold" }
    case "a":
      return { type: "allin" }
    case "c":
      return legalActions(state).includes("check") ? { type: "check" } : { type: "call" }
    case "r": {
      const to = Number(value)
      return Number.isFinite(to) && to > 0 ? { type: "raise", to } : null
    }
    default:
      return null
  }
}

function parseBoard(input: string, expected: number): Card[] | null {
  const cards = input
    .trim()
    .split(/\s+/)
    .map(parseCard)
    .filter((card): card is Card => card !== null)

  return cards.length === expected && new Set(cards).size === expected ? cards : null
}

async function main(): Promise<void> {
  const seatCount = Math.min(9, Math.max(2, Number(argv[2] ?? 3)))
  const config: HandConfig = {
    seats: Array.from({ length: seatCount }, (_, index) => ({
      index,
      name: `P${index}`,
      stack: STACK,
    })),
    button: 0,
    smallBlind: SMALL_BLIND,
    bigBlind: BIG_BLIND,
  }

  let state = startHand(config)
  const terminal = createInterface({ input: stdin, output: stdout })

  console.log(`${seatCount} jogadores · stack ${STACK} · blinds ${SMALL_BLIND}/${BIG_BLIND}`)
  console.log("comandos:  f fold  ·  c check/call  ·  r <valor> raise  ·  a all-in  ·  q sair")

  try {
    while (state.phase !== "complete") {
      console.log(render(state))

      const pending = pendingBoardCards(state)
      if (pending > 0) {
        const cards = parseBoard(await terminal.question(`\n${pending} carta(s) do board > `), pending)
        if (cards === null) {
          console.log("cartas inválidas ou repetidas")
          continue
        }

        const dealt = dealBoard(state, cards)
        if (!dealt.ok) {
          console.log(`recusado: ${dealt.error}`)
          continue
        }
        state = dealt.state
        continue
      }

      if (state.toAct === null) break

      console.log(`\nlegais: ${legalActions(state).join(", ")}`)
      const action = parseAction(await terminal.question("> "), state)
      if (action === "quit") break
      if (action === null) {
        console.log("comando não reconhecido")
        continue
      }

      const result = applyAction(state, action)
      if (!result.ok) {
        console.log(`recusado: ${result.error}`)
        continue
      }
      state = result.state
    }
  } finally {
    terminal.close()
  }

  console.log(render(state))
  console.log(`\nmão encerrada em ${state.phase} — pote ${state.pot}`)
}

await main()