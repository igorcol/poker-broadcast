import { RANKS, SUITS, createDeck, isCard, parseCard, rankOf, rankValue, suitOf } from "../card.ts"
import { describe, it } from "node:test"
import assert from "assert"

describe("isCard", () => {
  it("aceita as 52 combinações válidas", () => {
    for (const rank of RANKS) {
      for (const suit of SUITS) {
        assert.ok(isCard(`${rank}${suit}`), `${rank}${suit} deveria ser válida`)
      }
    }
  })

  it("rejeita notação inválida", () => {
    for (const value of ["", "K", "Kss", "1s", "Kx", "ks", "10s", " Ks"]) {
      assert.equal(isCard(value), false, `${value} não deveria ser válida`)
    }
  })
})

describe("parseCard", () => {
  it("normaliza caixa e o dez escrito como 10", () => {
    assert.equal(parseCard("ks"), "Ks")
    assert.equal(parseCard("KS"), "Ks")
    assert.equal(parseCard(" Ks "), "Ks")
    assert.equal(parseCard("10s"), "Ts")
    assert.equal(parseCard("10H"), "Th")
  })

  it("devolve null para entrada inválida", () => {
    for (const value of ["", "K", "Kss", "1s", "Kx", "11s"]) {
      assert.equal(parseCard(value), null, `${value} deveria falhar`)
    }
  })

  it("faz roundtrip com rankOf e suitOf", () => {
    const card = parseCard("Td")
    if (card === null) {
      throw new Error("Td deveria parsear")
    }

    assert.equal(rankOf(card), "T")
    assert.equal(suitOf(card), "d")
  })
})

describe("createDeck", () => {
  it("tem 52 cartas sem duplicata", () => {
    const deck = createDeck()
    assert.equal(deck.length, 52)
    assert.equal(new Set(deck).size, 52)
  })

  it("cobre todo rank em todo naipe", () => {
    const deck = new Set(createDeck())
    for (const rank of RANKS) {
      for (const suit of SUITS) {
        assert.ok(deck.has(`${rank}${suit}`), `falta ${rank}${suit}`)
      }
    }
  })
})

describe("rankValue", () => {
  it("ordena do 2 ao ás", () => {
    assert.equal(rankValue("2"), 2)
    assert.equal(rankValue("T"), 10)
    assert.equal(rankValue("A"), 14)
  })

  it("é estritamente crescente na ordem de RANKS", () => {
    const values = RANKS.map(rankValue)
    assert.deepEqual(values, [...values].sort((a, b) => a - b))
    assert.equal(new Set(values).size, RANKS.length)
  })
})