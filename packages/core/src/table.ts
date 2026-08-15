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
}

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

/** Quantas comunitárias faltam na fase atual. Zero quando a fase não vira carta. */
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