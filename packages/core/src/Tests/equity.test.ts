import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { Card } from "../card.ts"
import { computeEquity } from "../equity.ts"

const AA: readonly [Card, Card] = ["As", "Ah"]
const KK: readonly [Card, Card] = ["Ks", "Kh"]

describe("board completo", () => {
  it("dá certeza absoluta ao vencedor", () => {
    const board: Card[] = ["Ad", "7c", "2h", "9s", "4d"]
    const [aces, kings] = computeEquity([AA, KK], board)

    assert.equal(aces, 1)
    assert.equal(kings, 0)
  })

  it("divide no empate exato", () => {
    const board: Card[] = ["Qd", "Jc", "Th", "9s", "8d"]
    const values = computeEquity([["2c", "3d"], ["4h", "5s"]], board)

    assert.deepEqual(values, [0.5, 0.5])
  })
})

describe("preflop", () => {
  it("põe AA na casa dos 80% contra KK", () => {
    const [aces] = computeEquity([AA, KK], [], 20_000)

    assert.ok(aces !== undefined && aces > 0.78 && aces < 0.87, `esperava ~0,82, veio ${aces}`)
  })

  it("soma 1 entre todas as mãos", () => {
    const values = computeEquity([AA, KK, ["7c", "7d"]], [], 10_000)
    const total = values.reduce((sum, value) => sum + value, 0)

    assert.ok(Math.abs(total - 1) < 1e-9, `soma deu ${total}`)
  })
})