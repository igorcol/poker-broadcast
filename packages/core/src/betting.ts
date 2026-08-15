import type { Card } from "./card.ts"
import {
  nextActive,
  pendingBoardCards,
  roundIsComplete,
  seatToAct,
  type GameState,
  type HandConfig,
  type Phase,
  type Seat,
} from "./table.ts"

/**
 * Transições de uma mão de Texas Hold'em: blinds, ordem de ação, raise mínimo e fases.
 * Recebe a intenção do operador via `applyAction` e devolve o próximo estado ou erro tipado.
 * É a fonte da verdade das regras. 
 * ! Nenhuma regra de aposta vive fora daqui.
 */

export type Action =
  | { readonly type: "fold" }
  | { readonly type: "check" }
  | { readonly type: "call" }
  | { readonly type: "raise"; readonly to: number }
  | { readonly type: "allin" }

export type ActionError =
  | "hand-complete"
  | "no-seat-to-act"
  | "cannot-check"
  | "nothing-to-call"
  | "raise-too-small"
  | "raise-exceeds-stack"
  | "wrong-board-size"

export type ActionResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly error: ActionError }

const NEXT_PHASE: Record<Phase, Phase> = {
  preflop: "flop",
  flop: "turn",
  turn: "river",
  river: "showdown",
  showdown: "complete",
  complete: "complete",
}

function commit(seat: Seat, amount: number): Seat {
  const paid = Math.min(amount, seat.stack)
  const stack = seat.stack - paid
  return {
    ...seat,
    stack,
    committed: seat.committed + paid,
    status: stack === 0 ? "allin" : seat.status,
  }
}

function replace(seats: readonly Seat[], index: number, seat: Seat): Seat[] {
  return seats.map((current, position) => (position === index ? seat : current))
}

/** Heads-up inverte: o botão posta o small blind e age primeiro no preflop. */
function blindPositions(count: number, button: number): { small: number; big: number } {
  if (count === 2) {
    return { small: button, big: (button + 1) % count }
  }
  return { small: (button + 1) % count, big: (button + 2) % count }
}

/** Move o apostado da rodada para o pote e limpa o estado de aposta. */
function collect(state: GameState): GameState {
  return {
    ...state,
    seats: state.seats.map((seat) => ({ ...seat, committed: 0, hasActed: false })),
    pot: state.pot + state.seats.reduce((total, seat) => total + seat.committed, 0),
    currentBet: 0,
    minRaise: state.bigBlind,
  }
}

function advance(state: GameState): GameState {
  const contenders = state.seats.filter((seat) => seat.status !== "folded")
  if (contenders.length <= 1) {
    return { ...collect(state), phase: "complete", toAct: null }
  }

  if (!roundIsComplete(state)) {
    return { ...state, toAct: nextActive(state.seats, state.toAct ?? state.button) }
  }

  const collected = collect(state)
  const phase = NEXT_PHASE[state.phase]
  const first = nextActive(collected.seats, collected.button)

  // Todos all-in: não há mais o que apostar, corre direto pro showdown
  if (first === null || phase === "showdown" || phase === "complete") {
    return { ...collected, phase: phase === "complete" ? "complete" : "showdown", toAct: null }
  }

  return { ...collected, phase, toAct: first }
}

/** Aposta que reabre a rodada: todo mundo que já agiu precisa responder de novo. */
function applyAggression(state: GameState, position: number, seat: Seat, to: number): GameState {
  const raised = { ...commit(seat, to - seat.committed), hasActed: true }
  const seats = state.seats.map((current, index) =>
    index === position ? raised : { ...current, hasActed: false },
  )

  return { ...state, seats, currentBet: to, minRaise: to - state.currentBet }
}

export function startHand(config: HandConfig): GameState {
  const { small, big } = blindPositions(config.seats.length, config.button)

  const base: Seat[] = config.seats.map((seat) => ({
    ...seat,
    committed: 0,
    status: "active",
    hasActed: false,
  }))

  const withBlinds = base.map((seat, position) => {
    if (position === small) return commit(seat, config.smallBlind)
    if (position === big) return commit(seat, config.bigBlind)
    return seat
  })

  return {
    seats: withBlinds,
    button: config.button,
    phase: "preflop",
    board: [],
    pot: 0,
    currentBet: config.bigBlind,
    minRaise: config.bigBlind,
    // Depois do big blind: UTG com 3+, e o próprio botão em heads-up
    toAct: nextActive(withBlinds, big),
    bigBlind: config.bigBlind,
  }
}

export function applyAction(state: GameState, action: Action): ActionResult {
  if (state.phase === "complete" || state.phase === "showdown") {
    return { ok: false, error: "hand-complete" }
  }

  const position = state.toAct
  const seat = seatToAct(state)
  if (position === null || seat === null) {
    return { ok: false, error: "no-seat-to-act" }
  }

  const toCall = state.currentBet - seat.committed

  switch (action.type) {
    case "fold": {
      const seats = replace(state.seats, position, { ...seat, status: "folded", hasActed: true })
      return { ok: true, state: advance({ ...state, seats }) }
    }

    case "check": {
      if (toCall > 0) return { ok: false, error: "cannot-check" }
      const seats = replace(state.seats, position, { ...seat, hasActed: true })
      return { ok: true, state: advance({ ...state, seats }) }
    }

    case "call": {
      if (toCall <= 0) return { ok: false, error: "nothing-to-call" }
      const seats = replace(state.seats, position, { ...commit(seat, toCall), hasActed: true })
      return { ok: true, state: advance({ ...state, seats }) }
    }

    case "raise": {
      if (action.to < state.currentBet + state.minRaise) {
        return { ok: false, error: "raise-too-small" }
      }
      if (action.to - seat.committed > seat.stack) {
        return { ok: false, error: "raise-exceeds-stack" }
      }
      return { ok: true, state: advance(applyAggression(state, position, seat, action.to)) }
    }

    case "allin": {
      const total = seat.committed + seat.stack
      // All-in menor que o mínimo não reabre a ação: quem já agiu não volta a agir
      if (total <= state.currentBet) {
        const seats = replace(state.seats, position, { ...commit(seat, seat.stack), hasActed: true })
        return { ok: true, state: advance({ ...state, seats }) }
      }
      if (total < state.currentBet + state.minRaise) {
        const seats = replace(state.seats, position, { ...commit(seat, seat.stack), hasActed: true })
        return { ok: true, state: advance({ ...state, seats, currentBet: total }) }
      }
      return { ok: true, state: advance(applyAggression(state, position, seat, total)) }
    }
  }
}

export function dealBoard(state: GameState, cards: readonly Card[]): ActionResult {
  if (cards.length === 0 || cards.length !== pendingBoardCards(state)) {
    return { ok: false, error: "wrong-board-size" }
  }
  return { ok: true, state: { ...state, board: [...state.board, ...cards] } }
}

export function legalActions(state: GameState): Action["type"][] {
  const seat = seatToAct(state)
  if (seat === null) return []

  const toCall = state.currentBet - seat.committed
  const actions: Action["type"][] = ["fold", "allin"]

  if (toCall === 0) actions.push("check")
  if (toCall > 0 && seat.stack > 0) actions.push("call")
  if (seat.stack > toCall + state.minRaise) actions.push("raise")

  return actions
}