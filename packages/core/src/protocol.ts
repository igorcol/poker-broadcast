import type { Action } from "./betting.ts"
import type { Card } from "./card.ts"
import type { GameState, HandConfig } from "./table.ts"

/**
 * Contrato de mensagens entre engine, console e overlay.
 * Define o que cada lado pode enviar e o formato do estado que trafega no WebSocket.
 * Vive no core porque os três dependem dele. Contrato duplicado desincroniza sempre.
 */

export type ClientMessage =
  | { readonly type: "start-hand"; readonly config: HandConfig }
  | { readonly type: "action"; readonly action: Action }
  | { readonly type: "deal-board"; readonly cards: readonly Card[] }
  | { readonly type: "set-cards"; readonly seat: number; readonly cards: readonly [Card, Card] }
  | { readonly type: "undo" }

export type ServerMessage =
  | { readonly type: "state"; readonly state: GameState | null }
  | { readonly type: "error"; readonly error: string }
  /** Indexado por posição de assento. `null` = sem número pra mostrar. */
  | { readonly type: "equity"; readonly values: readonly (number | null)[] }