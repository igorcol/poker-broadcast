import { describeHand, evaluate, type Card, type GameState, type Seat } from "@poker-broadcast/core"

import { PlayingCard } from "./playing-card.tsx"

/**
 * Card de um jogador na coluna do overlay: avatar, stack, cartas, nome e ação corrente.
 * A linha de ação é derivada do estado — quanto falta pagar, ou o valor do all-in.
 * Assento foldado não chega aqui: quem saiu da mão some da tela.
 */


/** Menos de cinco cartas não formam mão — no preflop não há o que anunciar. */
const MIN_CARDS = 5

function handLabel(seat: Seat, board: readonly Card[]): string | null {
  if (seat.cards === null) return null

  const known = [...seat.cards, ...board]
  return known.length < MIN_CARDS ? null : describeHand(evaluate(known))
}

function actionLabel(seat: Seat, state: GameState): { text: string; tone: string } | null {
  if (seat.status === "allin") return { text: `ALL IN ${seat.committed}`, tone: "allin" }

  const toCall = state.currentBet - seat.committed
  if (state.toAct !== null && state.seats[state.toAct]?.index === seat.index && toCall > 0) {
    return { text: `${toCall} TO CALL`, tone: "call" }
  }
  if (seat.committed > 0) return { text: `${seat.committed}`, tone: "bet" }

  return null
}

export function PlayerCard({
  seat,
  state,
  acting,
  equity,
}: {
  readonly seat: Seat
  readonly state: GameState
  readonly acting: boolean
  readonly equity?: number
}) {
  const action = actionLabel(seat, state)
  const hand = handLabel(seat, state.board)
  const [first, second] = seat.cards ?? [null, null]

  return (
    // O slot anima a entrada; o `.pl` guarda o transform do jogador da vez, senão um sobrescreve o outro
    <div className="pl-slot">
      <div className={`pl${acting ? " pl--acting" : ""}`}>
        <div className="pl__avatar">
          <span className="pl__initial">{seat.name.charAt(0).toUpperCase()}</span>
          <span className="pl__stack">{seat.stack}</span>
        </div>

        <div className="pl__body">
          <div className="pl__top">
            {/* A key muda quando a carta é revelada. O que dispara o flip */}
            <PlayingCard key={`0-${first ?? "back"}`} card={first} />
            <PlayingCard key={`1-${second ?? "back"}`} card={second} />
            {equity !== undefined && (
              <span className="pl__equity">
                <span>{Math.round(equity * 100)}%</span>
              </span>
            )}
          </div>

          <div className="pl__line">
            <div className="pl__name">
              <span>{seat.name.toUpperCase()}</span>
            </div>

            {action !== null && (
              <div key={action.text} className={`pl__action pl__action--${action.tone}`}>
                <span>{action.text}</span>
              </div>
            )}
          </div>

          {hand !== null && (
            <div key={hand} className="pl__hand">
              <span>{hand}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}