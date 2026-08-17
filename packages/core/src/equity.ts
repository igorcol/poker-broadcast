import { createDeck, type Card } from "./card.ts"
import { evaluateScore } from "./evaluator.ts"

/**
 * Probabilidade de cada mão viva vencer, por amostragem do board que ainda falta.
 * Empate divide o crédito entre os empatados — split pot vale meia vitória, não nenhuma.
 * Se qualquer mão viva for desconhecida, não devolve número: estimar seria inventar.
 */

const BOARD_SIZE = 5
export const DEFAULT_ITERATIONS = 30_000

export function computeEquity(
  hands: readonly (readonly [Card, Card])[],
  board: readonly Card[],
  iterations: number = DEFAULT_ITERATIONS,
): number[] {
  if (hands.length === 0) return []
  if (hands.length === 1) return [1]

  const used = new Set<Card>([...board, ...hands.flat()])
  const deck = createDeck().filter((card) => !used.has(card))
  const missing = BOARD_SIZE - board.length

  // Board completo é determinístico: uma passada basta, amostrar seria repetir o mesmo resultado
  const rounds = missing === 0 ? 1 : iterations

  const wins = new Float64Array(hands.length)
  const full: Card[] = [...board, ...new Array<Card>(missing)]
  const hand: Card[] = new Array(7)
  const winners: number[] = []

  for (let round = 0; round < rounds; round += 1) {
    // Fisher-Yates parcial: embaralha só o que vai usar, reaproveitando o mesmo array
    for (let index = 0; index < missing; index += 1) {
      const pick = index + Math.floor(Math.random() * (deck.length - index))
      const swap = deck[index]!
      deck[index] = deck[pick]!
      deck[pick] = swap
      full[board.length + index] = deck[index]!
    }

    let best = -1
    winners.length = 0

    for (let seat = 0; seat < hands.length; seat += 1) {
      const cards = hands[seat]!
      hand[0] = cards[0]
      hand[1] = cards[1]
      for (let index = 0; index < BOARD_SIZE; index += 1) hand[2 + index] = full[index]!

      const score = evaluateScore(hand)
      if (score > best) {
        best = score
        winners.length = 0
        winners.push(seat)
      } else if (score === best) {
        winners.push(seat)
      }
    }

    const share = 1 / winners.length
    for (const seat of winners) wins[seat] = (wins[seat] ?? 0) + share
  }

  return Array.from(wins, (value) => value / rounds)
}