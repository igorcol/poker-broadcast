import type { Card } from "./card.ts"

/**
 * Fronteira entre quem observa carta e quem decide o que fazer com ela.
 * O motor não sabe se a carta veio do teclado do operador ou da câmera. Só recebe observação.
 * É o que permite trocar manual por visão sem tocar em regra de jogo.
 */

export interface CardObservation {
  /** `null` quando é carta comunitária. */
  readonly seat: number | null
  readonly cards: readonly Card[]
  readonly confidence: number
  readonly at: number
}

export type ObservationListener = (observation: CardObservation) => void

export interface CardSource {
  readonly kind: "manual" | "vision" | "video"
  start(listener: ObservationListener): void
  stop(): void
}