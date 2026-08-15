import {
  applyAction,
  dealBoard,
  setSeatCards,
  startHand,
  type Action,
  type Card,
  type GameState,
  type HandConfig,
} from "@poker-broadcast/core"

/**
 * Guarda o estado da mão corrente e o histórico para desfazer.
 * Toda transição empilha um estado novo; `undo` é um pop, não uma inversão de ação.
 * Única coisa mutável da engine. O resto é transporte.
 */

export type Outcome = { readonly ok: true } | { readonly ok: false; readonly error: string }

const NO_HAND: Outcome = { ok: false, error: "no-hand-in-progress" }

export class Session {
  private history: GameState[] = []

  get current(): GameState | null {
    return this.history.at(-1) ?? null
  }

  start(config: HandConfig): Outcome {
    this.history = [startHand(config)]
    return { ok: true }
  }

  apply(action: Action): Outcome {
    const state = this.current
    if (state === null) return NO_HAND

    const result = applyAction(state, action)
    if (!result.ok) return { ok: false, error: result.error }

    this.history.push(result.state)
    return { ok: true }
  }

  deal(cards: readonly Card[]): Outcome {
    const state = this.current
    if (state === null) return NO_HAND

    const result = dealBoard(state, cards)
    if (!result.ok) return { ok: false, error: result.error }

    this.history.push(result.state)
    return { ok: true }
  }

  setCards(seat: number, cards: readonly [Card, Card]): Outcome {
    const state = this.current
    if (state === null) return NO_HAND

    const result = setSeatCards(state, seat, cards)
    if (!result.ok) return { ok: false, error: result.error }

    this.history.push(result.state)
    return { ok: true }
  }

  /** Mantém o estado inicial da mão: desfazer não pode apagar a própria mão. */
  undo(): Outcome {
    if (this.history.length <= 1) return { ok: false, error: "nothing-to-undo" }

    this.history.pop()
    return { ok: true }
  }
}