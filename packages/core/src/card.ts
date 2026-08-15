/**
 * Carta e baralho na notação de 2 caracteres (`Ks`, `Td`, `7c`) usada em todo o sistema.
 * Faz parse tolerante da entrada do operador e valida as 52 combinações em tempo de compilação.
 * É o vocabulário compartilhado entre visão, motor e overlay — nada de carta se define fora daqui.
 */

export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"] as const
export const SUITS = ["s", "h", "d", "c"] as const

export type Rank = (typeof RANKS)[number]
export type Suit = (typeof SUITS)[number]

/** As 52 strings válidas, verificadas em tempo de compilação. `"Xz"` não compila. */
export type Card = `${Rank}${Suit}`

const RANK_SET: ReadonlySet<string> = new Set(RANKS)
const SUIT_SET: ReadonlySet<string> = new Set(SUITS)
const RANK_VALUES: ReadonlyMap<Rank, number> = new Map(RANKS.map((rank, index) => [rank, index + 2]))

export function isCard(value: string): value is Card {
  return value.length === 2 && RANK_SET.has(value.charAt(0)) && SUIT_SET.has(value.charAt(1))
}

/** `null` em vez de throw: entrada de operador digitando rápido não é caso excepcional. */
export function parseCard(value: string): Card | null {
  // Aceita "10s" e "ks" — o operador não vai lembrar da notação canônica no meio de uma mão
  const normalized = value.trim().replace(/^10/, "T")
  if (normalized.length !== 2) return null

  const candidate = normalized.charAt(0).toUpperCase() + normalized.charAt(1).toLowerCase()
  return isCard(candidate) ? candidate : null
}

// Os casts são seguros por construção: o template literal type garante os dois caracteres
export function rankOf(card: Card): Rank {
  return card.charAt(0) as Rank
}

export function suitOf(card: Card): Suit {
  return card.charAt(1) as Suit
}

/** 2 vale 2, A vale 14 — ordem de força para desempate. */
export function rankValue(rank: Rank): number {
  return RANK_VALUES.get(rank) ?? 0
}

export function createDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank): Card => `${rank}${suit}`))
}