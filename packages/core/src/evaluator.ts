import { createDeck, rankOf, rankValue, suitOf, type Card } from "./card.ts"

/**
 * Avalia uma mão de poker e devolve um valor comparável por número.
 * Conta ranks e naipes uma vez e classifica por bitmask — sem testar as 21 combinações de 5.
 * É a base do showdown e do Monte Carlo da equity, que chama isso aos milhões.
 */

export type HandCategory =
  | "high-card"
  | "pair"
  | "two-pair"
  | "trips"
  | "straight"
  | "flush"
  | "full-house"
  | "quads"
  | "straight-flush"

const CATEGORY_RANK: Record<HandCategory, number> = {
  "high-card": 0,
  pair: 1,
  "two-pair": 2,
  trips: 3,
  straight: 4,
  flush: 5,
  "full-house": 6,
  quads: 7,
  "straight-flush": 8,
}

export interface HandValue {
  readonly category: HandCategory
  /** Categoria e até 5 desempates num inteiro: maior é melhor, comparação é subtração. */
  readonly score: number
}

const SUIT_INDEX = { s: 0, h: 1, d: 2, c: 3 } as const

/** Carta pré-decodificada em `(rank << 2) | naipe`: evita parse de string no caminho quente. */
const CARD_CODE: ReadonlyMap<string, number> = new Map(
  createDeck().map((card) => [card, (rankValue(rankOf(card)) << 2) | SUIT_INDEX[suitOf(card)]]),
)

// Reusados entre chamadas: alocar por avaliação era o gargalo da versão anterior
const rankCounts = new Int8Array(15)
const suitMasks = new Int32Array(4)

function encode(category: HandCategory, tiebreakers: readonly number[]): number {
  let score = CATEGORY_RANK[category] << 20
  for (let index = 0; index < 5; index += 1) {
    score |= (tiebreakers[index] ?? 0) << (16 - index * 4)
  }
  return score
}

function straightHigh(mask: number): number {
  for (let high = 14; high >= 6; high -= 1) {
    const needed = 0b11111 << (high - 4)
    if ((mask & needed) === needed) return high
  }
  // Roda: 5-4-3-2 mais o ás valendo 1
  const wheel = (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5)
  return (mask & wheel) === wheel && (mask & (1 << 14)) !== 0 ? 5 : 0
}

function topRanks(mask: number, count: number, skipA = 0, skipB = 0): number[] {
  const ranks: number[] = []
  for (let rank = 14; rank >= 2 && ranks.length < count; rank -= 1) {
    if ((mask & (1 << rank)) !== 0 && rank !== skipA && rank !== skipB) ranks.push(rank)
  }
  return ranks
}

export function evaluate(cards: readonly Card[]): HandValue {
  rankCounts.fill(0)
  suitMasks.fill(0)
  let rankMask = 0

  for (const card of cards) {
    const code = CARD_CODE.get(card)
    if (code === undefined) throw new Error(`carta inválida na avaliação: ${card}`)

    const rank = code >> 2
    const suit = code & 0b11
    rankCounts[rank] = (rankCounts[rank] ?? 0) + 1
    rankMask |= 1 << rank
    suitMasks[suit] = (suitMasks[suit] ?? 0) | (1 << rank)
  }

  let flushSuit = -1
  for (let suit = 0; suit < 4; suit += 1) {
    const mask = suitMasks[suit] ?? 0
    // popcount: conta quantos ranks daquele naipe estão presentes
    let bits = 0
    for (let value = mask; value !== 0; value &= value - 1) bits += 1
    if (bits >= 5) flushSuit = suit
  }

  if (flushSuit >= 0) {
    const high = straightHigh(suitMasks[flushSuit] ?? 0)
    if (high > 0) return { category: "straight-flush", score: encode("straight-flush", [high]) }
  }

  let quad = 0
  let trips = 0
  let tripsLow = 0
  let pair = 0
  let pairLow = 0

  for (let rank = 14; rank >= 2; rank -= 1) {
    const count = rankCounts[rank] ?? 0
    if (count === 4) quad = quad === 0 ? rank : quad
    else if (count === 3) {
      if (trips === 0) trips = rank
      else if (tripsLow === 0) tripsLow = rank
    } else if (count === 2) {
      if (pair === 0) pair = rank
      else if (pairLow === 0) pairLow = rank
    }
  }

  if (quad > 0) {
    return { category: "quads", score: encode("quads", [quad, ...topRanks(rankMask, 1, quad)]) }
  }

  // Duas trincas viram full house: a menor conta como par
  const fullPair = pair > 0 ? Math.max(pair, tripsLow) : tripsLow
  if (trips > 0 && fullPair > 0) {
    return { category: "full-house", score: encode("full-house", [trips, fullPair]) }
  }

  if (flushSuit >= 0) {
    return { category: "flush", score: encode("flush", topRanks(suitMasks[flushSuit] ?? 0, 5)) }
  }

  const high = straightHigh(rankMask)
  if (high > 0) return { category: "straight", score: encode("straight", [high]) }

  if (trips > 0) {
    return { category: "trips", score: encode("trips", [trips, ...topRanks(rankMask, 2, trips)]) }
  }

  if (pair > 0 && pairLow > 0) {
    return {
      category: "two-pair",
      score: encode("two-pair", [pair, pairLow, ...topRanks(rankMask, 1, pair, pairLow)]),
    }
  }

  if (pair > 0) {
    return { category: "pair", score: encode("pair", [pair, ...topRanks(rankMask, 3, pair)]) }
  }

  return { category: "high-card", score: encode("high-card", topRanks(rankMask, 5)) }
}

export function compare(a: HandValue, b: HandValue): number {
  return a.score - b.score
}

const RANK_SINGULAR: Record<number, string> = {
  2: "DOIS", 3: "TRÊS", 4: "QUATRO", 5: "CINCO", 6: "SEIS", 7: "SETE", 8: "OITO",
  9: "NOVE", 10: "DEZ", 11: "VALETE", 12: "DAMA", 13: "REI", 14: "ÁS",
}

const RANK_PLURAL: Record<number, string> = {
  2: "DOIS", 3: "TRÊS", 4: "QUATRO", 5: "CINCO", 6: "SEIS", 7: "SETE", 8: "OITO",
  9: "NOVE", 10: "DEZ", 11: "VALETES", 12: "DAMAS", 13: "REIS", 14: "ASES",
}

/** Lê um desempate de volta do score — só usado pra exibir, nunca no caminho quente. */
function tiebreakerAt(score: number, position: number): number {
  return (score >> (16 - position * 4)) & 0xf
}

export function describeHand(value: HandValue): string {
  const first = tiebreakerAt(value.score, 0)
  const second = tiebreakerAt(value.score, 1)

  switch (value.category) {
    case "straight-flush":
      return first === 14 ? "ROYAL FLUSH" : `STRAIGHT FLUSH ATÉ ${RANK_SINGULAR[first]}`
    case "quads":
      return `QUADRA DE ${RANK_PLURAL[first]}`
    case "full-house":
      return `FULL HOUSE ${RANK_PLURAL[first]}`
    case "flush":
      return `FLUSH ${RANK_SINGULAR[first]} ALTO`
    case "straight":
      return `STRAIGHT ATÉ ${RANK_SINGULAR[first]}`
    case "trips":
      return `TRINCA DE ${RANK_PLURAL[first]}`
    case "two-pair":
      return `DOIS PARES ${RANK_PLURAL[first]} E ${RANK_PLURAL[second]}`
    case "pair":
      return `PAR DE ${RANK_PLURAL[first]}`
    case "high-card":
      return `${RANK_SINGULAR[first]} ALTO`
  }
}