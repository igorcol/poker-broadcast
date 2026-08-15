import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { applyAction, startHand, type Action } from "../betting.ts"
import type { GameState, HandConfig } from "../table.ts"

const THREE_HANDED: HandConfig = {
  seats: [
    { index: 0, name: "A", stack: 1000 },
    { index: 1, name: "B", stack: 1000 },
    { index: 2, name: "C", stack: 1000 },
  ],
  button: 0,
  smallBlind: 10,
  bigBlind: 20,
}

function play(state: GameState, actions: readonly Action[]): GameState {
  return actions.reduce((current, action) => {
    const result = applyAction(current, action)
    if (!result.ok) {
      throw new Error(`ação ${action.type} rejeitada: ${result.error}`)
    }
    return result.state
  }, state)
}

describe("startHand", () => {
  it("posta os blinds e abre a ação no UTG", () => {
    const state = startHand(THREE_HANDED)

    assert.equal(state.seats[1]?.committed, 10)
    assert.equal(state.seats[2]?.committed, 20)
    assert.equal(state.currentBet, 20)
    assert.equal(state.toAct, 0)
  })

  it("inverte os blinds em heads-up: botão paga o small e age primeiro", () => {
    const state = startHand({ ...THREE_HANDED, seats: THREE_HANDED.seats.slice(0, 2) })

    assert.equal(state.seats[0]?.committed, 10)
    assert.equal(state.seats[1]?.committed, 20)
    assert.equal(state.toAct, 0)
  })
})

describe("rodada de apostas", () => {
  it("dá ao big blind a opção de agir mesmo com todos pagando", () => {
    const state = play(startHand(THREE_HANDED), [{ type: "call" }, { type: "call" }])

    assert.equal(state.phase, "preflop", "não pode avançar antes do BB agir")
    assert.equal(state.toAct, 2)
  })

  it("avança para o flop quando o big blind fecha a rodada", () => {
    const state = play(startHand(THREE_HANDED), [
      { type: "call" },
      { type: "call" },
      { type: "check" },
    ])

    assert.equal(state.phase, "flop")
    assert.equal(state.pot, 60)
    assert.equal(state.currentBet, 0)
    assert.equal(state.toAct, 1, "pós-flop começa no primeiro ativo depois do botão")
  })

  it("reabre a ação para quem já tinha agido quando alguém sobe", () => {
    const state = play(startHand(THREE_HANDED), [{ type: "call" }, { type: "raise", to: 60 }])

    assert.equal(state.toAct, 2)
    assert.equal(state.seats[0]?.hasActed, false, "quem pagou precisa responder ao raise")
    assert.equal(state.minRaise, 40)
  })
})

describe("validação", () => {
  it("recusa check com aposta na mesa", () => {
    const result = applyAction(startHand(THREE_HANDED), { type: "check" })

    assert.equal(result.ok, false)
    assert.equal(result.ok === false && result.error, "cannot-check")
  })

  it("recusa raise abaixo do mínimo", () => {
    const result = applyAction(startHand(THREE_HANDED), { type: "raise", to: 30 })

    assert.equal(result.ok, false)
    assert.equal(result.ok === false && result.error, "raise-too-small")
  })

  it("recusa raise maior que o stack", () => {
    const result = applyAction(startHand(THREE_HANDED), { type: "raise", to: 5000 })

    assert.equal(result.ok, false)
    assert.equal(result.ok === false && result.error, "raise-exceeds-stack")
  })

  it("recusa ação com a mão encerrada", () => {
    const state = play(startHand(THREE_HANDED), [{ type: "fold" }, { type: "fold" }])

    assert.equal(state.phase, "complete")
    assert.equal(applyAction(state, { type: "fold" }).ok, false)
  })
})

describe("fim por fold", () => {
  it("encerra a mão quando sobra um só e recolhe o pote", () => {
    const state = play(startHand(THREE_HANDED), [{ type: "fold" }, { type: "fold" }])

    assert.equal(state.phase, "complete")
    assert.equal(state.pot, 30)
    assert.equal(state.toAct, null)
  })
})

describe("all-in", () => {
  it("marca o assento e segue a mão", () => {
    const short: HandConfig = {
      ...THREE_HANDED,
      seats: [
        { index: 0, name: "A", stack: 50 },
        { index: 1, name: "B", stack: 1000 },
        { index: 2, name: "C", stack: 1000 },
      ],
    }
    const state = play(startHand(short), [{ type: "allin" }])

    assert.equal(state.seats[0]?.status, "allin")
    assert.equal(state.seats[0]?.stack, 0)
    assert.equal(state.currentBet, 50)
  })
})

describe("conservação de fichas", () => {
  const total = THREE_HANDED.seats.reduce((sum, seat) => sum + seat.stack, 0)

  function assertConserved(state: GameState, label: string): void {
    const held = state.seats.reduce((sum, seat) => sum + seat.stack + seat.committed, 0)
    assert.equal(held + state.pot, total, `fichas não batem ${label}`)
  }

  it("mantém o total em toda transição de uma mão com raise e all-in", () => {
    let state = startHand(THREE_HANDED)
    assertConserved(state, "após os blinds")

    for (const action of [{ type: "raise" as const, to: 60 }, { type: "call" as const }, { type: "call" as const }]) {
      const result = applyAction(state, action)
      assert.ok(result.ok, `ação ${action.type} rejeitada`)
      state = result.state
      assertConserved(state, `após ${action.type}`)
    }

    assert.equal(state.phase, "flop")
    assert.equal(state.pot, 180)
  })

  it("mantém o total quando todos foldam menos um", () => {
    const state = play(startHand(THREE_HANDED), [{ type: "fold" }, { type: "fold" }])
    assertConserved(state, "após a mão encerrar por fold")
  })
})