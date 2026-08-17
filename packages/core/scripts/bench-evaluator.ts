import { createDeck } from "../src/card.ts"
import { evaluate } from "../src/evaluator.ts"

/**
 * Mede quantas avaliações de 7 cartas o motor faz por segundo.
 * A meta vem da equity: ~1 milhão por cálculo, e o overlay não pode esperar meio segundo.
 * É script de medição, não de teste — não entra na suíte.
 */

const ITERATIONS = 200_000
const deck = createDeck()

// Sorteia uma vez e reusa: queremos medir a avaliação, não a geração de mãos
const hands = Array.from({ length: 1000 }, () => {
  const shuffled = [...deck].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 7)
})

const started = performance.now()
let checksum = 0
for (let index = 0; index < ITERATIONS; index += 1) {
  checksum += evaluate(hands[index % hands.length]!).score
}
const elapsed = performance.now() - started

console.log(`${ITERATIONS.toLocaleString("pt-BR")} avaliações em ${elapsed.toFixed(0)}ms`)
console.log(`${Math.round(ITERATIONS / (elapsed / 1000)).toLocaleString("pt-BR")} por segundo`)
console.log(`checksum ${checksum}`)