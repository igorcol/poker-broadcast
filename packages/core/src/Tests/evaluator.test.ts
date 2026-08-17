import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { Card } from "../card.ts"
import { compare, evaluate } from "../evaluator.ts"

function hand(notation: string): Card[] {
  return notation.split(" ") as Card[]
}

describe("categorias", () => {
  const cases: readonly [string, string][] = [
    ["As Ks Qs Js Ts", "straight-flush"],
    ["9h 9d 9s 9c 2h", "quads"],
    ["8h 8d 8s 3c 3h", "full-house"],
    ["Ah 9h 6h 4h 2h", "flush"],
    ["9h 8d 7s 6c 5h", "straight"],
    ["Qh Qd Qs 7c 2h", "trips"],
    ["Jh Jd 4s 4c 9h", "two-pair"],
    ["Th Td 8s 5c 2h", "pair"],
    ["Ah Jd 8s 5c 2h", "high-card"],
  ]

  for (const [notation, expected] of cases) {
    it(`${expected}: ${notation}`, () => {
      assert.equal(evaluate(hand(notation)).category, expected)
    })
  }
})

describe("straight com ás baixo", () => {
  it("reconhece 5-4-3-2-A", () => {
    assert.equal(evaluate(hand("5h 4d 3s 2c Ah")).category, "straight")
  })

  it("perde para 6-5-4-3-2", () => {
    const wheel = evaluate(hand("5h 4d 3s 2c Ah"))
    const six = evaluate(hand("6h 5d 4s 3c 2h"))
    assert.ok(compare(six, wheel) > 0, "a roda é o straight mais fraco")
  })

  it("não confunde com straight-flush do ás alto", () => {
    assert.equal(evaluate(hand("Ah Kh Qh Jh Th")).category, "straight-flush")
  })
})

describe("desempate", () => {
  it("compara kicker no high-card", () => {
    const better = evaluate(hand("Ah Kd 8s 5c 2h"))
    const worse = evaluate(hand("Ah Qd 8s 5c 2h"))
    assert.ok(compare(better, worse) > 0)
  })

  it("compara par pelo kicker quando o par empata", () => {
    const better = evaluate(hand("9h 9d Ks 5c 2h"))
    const worse = evaluate(hand("9h 9d Qs 5c 2h"))
    assert.ok(compare(better, worse) > 0)
  })

  it("compara two-pair pelo par mais alto antes do segundo", () => {
    const better = evaluate(hand("Kh Kd 3s 3c 9h"))
    const worse = evaluate(hand("Qh Qd Js Jc 9h"))
    assert.ok(compare(better, worse) > 0)
  })

  it("compara full house pela trinca antes do par", () => {
    const better = evaluate(hand("Kh Kd Ks 2c 2h"))
    const worse = evaluate(hand("Qh Qd Qs Ac Ah"))
    assert.ok(compare(better, worse) > 0)
  })

  it("reconhece empate exato", () => {
    assert.equal(compare(evaluate(hand("Ah Kd 8s 5c 2h")), evaluate(hand("As Kh 8d 5s 2c"))), 0)
  })
})

describe("melhor de sete", () => {
  it("acha o flush escondido entre sete cartas", () => {
    const value = evaluate(hand("2h 5h 9h Kh 3h 7c As"))
    assert.equal(value.category, "flush")
  })

  it("não vê flush com só quatro do naipe", () => {
    assert.equal(evaluate(hand("2h 5h 9h Kh 3d 7c As")).category, "high-card")
  })

  it("usa a trinca menor como par quando há duas trincas", () => {
    const value = evaluate(hand("8h 8d 8s 3h 3d 3c 9h"))
    assert.equal(value.category, "full-house")
    assert.ok(compare(value, evaluate(hand("8h 8d 8s 2h 2d 5c 9h"))) > 0)
  })

  it("prefere o full house ao flush quando os dois existem", () => {
    const value = evaluate(hand("8h 8d 8s 3h 3d 5h 9h"))
    assert.equal(value.category, "full-house")
  })

  it("acha straight que atravessa cartas do board", () => {
    assert.equal(evaluate(hand("7c 8d 9h Ts Jc 2h 3d")).category, "straight")
  })
})