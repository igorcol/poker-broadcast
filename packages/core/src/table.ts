import type { Card } from "./card.ts"

/**
 * Interfaces do estado de uma mesa em andamento: assentos, fases, pote e board.
 * Define as estruturas e as consultas que apenas leem. Quem age agora, se a rodada fechou.
 * É o que overlay e console importam pra renderizar, sem tocar em regra de aposta.
 */

export type Phase = "preflop" | "flop" | "turn" | "river" | "showdown" | "complete"
export type SeatStatus = "active" | "folded" | "allin"

export interface Seat {
  readonly index: number
  readonly name: string
  readonly stack: number
  readonly committed: number
  readonly status: SeatStatus
  readonly hasActed: boolean
  /** `null` enquanto não lida — estado válido, o operador ou a visão preenche depois. */
  readonly cards: readonly [Card, Card] | null
}

/** Resultado de qualquer transição: novo estado ou erro tipado, nunca throw. */
export type Result<E extends string> =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly error: E }

export interface GameState {
  readonly seats: readonly Seat[]
  readonly button: number
  readonly phase: Phase
  readonly board: readonly Card[]
  readonly pot: number
  readonly currentBet: number
  readonly minRaise: number
  readonly toAct: number | null
  readonly bigBlind: number
}

export interface SeatConfig {
  readonly index: number
  readonly name: string
  readonly stack: number
}

export interface HandConfig {
  readonly seats: readonly SeatConfig[]
  readonly button: number
  readonly smallBlind: number
  readonly bigBlind: number
}

const BOARD_SIZE: Partial<Record<Phase, number>> = { flop: 3, turn: 4, river: 5 }

export function seatToAct(state: GameState): Seat | null {
  return state.toAct === null ? null : (state.seats[state.toAct] ?? null)
}

/** Toda carta já comprometida na mão — base da restrição de baralho. */
export function usedCards(state: GameState): Card[] {
  return [...state.board, ...state.seats.flatMap((seat) => seat.cards ?? [])]
}

/** Pote total incluindo o apostado na rodada corrente — é o número que vai pra tela. */
export function totalPot(state: GameState): number {
  return state.pot + state.seats.reduce((total, seat) => total + seat.committed, 0)
}

/** Quantas comunitárias faltam na fase atual — zero quando a fase não vira carta. */
export function pendingBoardCards(state: GameState): number {
  const expected = BOARD_SIZE[state.phase] ?? state.board.length
  return Math.max(0, expected - state.board.length)
}

export function nextActive(seats: readonly Seat[], from: number): number | null {
  for (let step = 1; step <= seats.length; step += 1) {
    const position = (from + step) % seats.length
    if (seats[position]?.status === "active") {
      return position
    }
  }
  return null
}

export function roundIsComplete(state: GameState): boolean {
  return state.seats
    .filter((seat) => seat.status === "active")
    .every((seat) => seat.hasActed && seat.committed === state.currentBet)
}