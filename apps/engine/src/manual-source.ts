import type { CardObservation, CardSource, ObservationListener } from "@poker-broadcast/core"

/**
 * Fonte de cartas alimentada pelo teclado do operador, via console.
 * Não observa nada sozinha. O servidor chama `submit` quando chega mensagem do console.
 */

export class ManualCardSource implements CardSource {
  readonly kind = "manual" as const

  private listener: ObservationListener | null = null

  start(listener: ObservationListener): void {
    this.listener = listener
  }

  stop(): void {
    this.listener = null
  }

  submit(observation: CardObservation): void {
    this.listener?.(observation)
  }
}