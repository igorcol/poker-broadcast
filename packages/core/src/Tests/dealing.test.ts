import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { startHand } from "../betting.ts"
import { dealBoard, setSeatCards } from "../dealing.ts"
import type { HandConfig } from "../table.ts"

const CONFIG: HandConfig = {
  seats: [
    { index: 0, name: "A", stack: 1000 },
    { index: 1, name: "B", stack: 1000 },
    { index: 2, name: "C", stack: 1000 },
  ],
  button: 0,
  smallBlind: 10,
  bigBlind: 20,
}

describe("setSeatCards", () => {
  it("guarda as cartas do assento", () => {
    const result = setSeatCards(startHand(CONFIG), 0, ["Ks", "Qh"])

    assert.ok(result.ok)
    assert.deepEqual(result.state.seats[0]?.cards, ["Ks", "Qh"])
  })

  it("recusa carta já usada por outro assento", () => {
    const first = setSeatCards(startHand(CONFIG), 0, ["Ks", "Qh"])
    assert.ok(first.ok)

    const second = setSeatCards(first.state, 1, ["Ks", "2d"])

    assert.equal(second.ok, false)
    assert.equal(second.ok === false && second.error, "duplicate-card")
  })

  it("recusa a mesma carta duas vezes no próprio assento", () => {
    const result = setSeatCards(startHand(CONFIG), 0, ["Ks", "Ks"])

    assert.equal(result.ok, false)
    assert.equal(result.ok === false && result.error, "duplicate-card")
  })

  it("permite corrigir a carta do próprio assento", () => {
    const first = setSeatCards(startHand(CONFIG), 0, ["Ks", "Qh"])
    assert.ok(first.ok)

    const corrected = setSeatCards(first.state, 0, ["Ks", "Jd"])

    assert.ok(corrected.ok, "trocar uma das duas não pode colidir consigo mesmo")
    assert.deepEqual(corrected.state.seats[0]?.cards, ["Ks", "Jd"])
  })

  it("recusa assento inexistente", () => {
    const result = setSeatCards(startHand(CONFIG), 9, ["Ks", "Qh"])

    assert.equal(result.ok, false)
    assert.equal(result.ok === false && result.error, "unknown-seat")
  })
})

describe("dealBoard", () => {
  it("recusa carta que já está na mão de um assento", () => {
    const withCards = setSeatCards(startHand(CONFIG), 0, ["Ks", "Qh"])
    assert.ok(withCards.ok)

    const flopped = dealBoard({ ...withCards.state, phase: "flop" }, ["Ks", "7d", "2c"])

    assert.equal(flopped.ok, false)
    assert.equal(flopped.ok === false && flopped.error, "duplicate-card")
  })

  it("recusa quantidade errada de cartas", () => {
    const result = dealBoard({ ...startHand(CONFIG), phase: "flop" }, ["Ks", "7d"])

    assert.equal(result.ok, false)
    assert.equal(result.ok === false && result.error, "wrong-board-size")
  })
})