import type { GameState, Seat } from "@poker-broadcast/core"

import { PlayingCard } from "./playing-card.tsx"

/**
 * Card de um jogador na coluna do overlay: foto, stack, cartas, nome e ação corrente.
 * A linha de ação é derivada do estado — quanto falta pagar, ou o valor do all-in.
 * Assento foldado não chega aqui: quem saiu da mão some da tela.
 */

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
}: {
  readonly seat: Seat
  readonly state: GameState
  readonly acting: boolean
}) {
  const action = actionLabel(seat, state)
  const [first, second] = seat.cards ?? [null, null]

  return (
    <div className={`pl${acting ? " pl--acting" : ""}`}>
      <div className="pl__avatar">
        <span className="pl__initial">{seat.name.charAt(0).toUpperCase()}</span>
        <span className="pl__stack">{seat.stack}</span>
      </div>

      <div className="pl__body">
        <div className="pl__cards">
          <PlayingCard card={first} />
          <PlayingCard card={second} />
        </div>
        <div className="pl__name">{seat.name.toUpperCase()}</div>
        {action !== null && <div className={`pl__action pl__action--${action.tone}`}>{action.text}</div>}
      </div>
    </div>
  )
}