import type { Card } from "./card.ts";
import {
  pendingBoardCards,
  usedCards,
  type GameState,
  type Result,
} from "./table.ts";

/**
 * Entrada de cartas na mão: comunitárias e hole cards de cada assento.
 * Aplica a restrição de baralho — carta repetida é recusada antes de tocar no estado.
 * Não sabe de onde a carta veio; serve igual pro operador digitando e pra visão lendo.
 */

export type DealError =
  | "wrong-board-size"
  | "duplicate-card"
  | "unknown-seat"
  | "hand-complete";

export type DealResult = Result<DealError>;

function hasDuplicate(
  existing: readonly Card[],
  incoming: readonly Card[],
): boolean {
  const seen = new Set(existing);
  return incoming.some((card) => seen.has(card) || !seen.add(card));
}

export function dealBoard(
  state: GameState,
  cards: readonly Card[],
): DealResult {
  if (state.phase === "complete") return { ok: false, error: "hand-complete" };
  if (cards.length === 0 || cards.length !== pendingBoardCards(state)) {
    return { ok: false, error: "wrong-board-size" };
  }
  if (hasDuplicate(usedCards(state), cards)) {
    return { ok: false, error: "duplicate-card" };
  }

  return { ok: true, state: { ...state, board: [...state.board, ...cards] } };
}

export function setSeatCards(
  state: GameState,
  position: number,
  cards: readonly [Card, Card],
): DealResult {
  const seat = state.seats[position];
  if (seat === undefined) return { ok: false, error: "unknown-seat" };
  if (state.phase === "complete") return { ok: false, error: "hand-complete" };

  // As cartas atuais do próprio assento saem da checagem: corrigir carta não é duplicar
  const own: readonly Card[] = seat.cards ?? [];
  const others = usedCards(state).filter((card) => !own.includes(card));
  if (hasDuplicate(others, cards)) {
    return { ok: false, error: "duplicate-card" };
  }

  return {
    ok: true,
    state: {
      ...state,
      seats: state.seats.map((s, i) => (i === position ? { ...s, cards } : s)),
    },
  };
}
