import { rankOf, suitOf, type Card, type Rank, type Suit } from "@poker-broadcast/core"

/**
 * Carta desenhada como carta física: retângulo claro com rank e naipe coloridos.
 * Usa baralho de quatro cores — em vídeo, distinguir ♦ de ♥ pela forma não funciona.
 * `null` vira verso: é o estado de "ainda não li", não de erro.
 */

const SUIT_SYMBOLS: Record<Suit, string> = { s: "♠", h: "♥", d: "♦", c: "♣" }

export function PlayingCard({ card, size = "small" }: { readonly card: Card | null; readonly size?: "small" | "large" }) {
  if (card === null) {
    return <span className={`pcard pcard--back pcard--${size}`} />
  }

  const rank: Rank = rankOf(card)
  const suit: Suit = suitOf(card)

  return (
    <span className={`pcard pcard--face pcard--${size} pcard--${suit}`}>
      <b className="pcard__rank">{rank === "T" ? "10" : rank}</b>
      <b className="pcard__suit">{SUIT_SYMBOLS[suit]}</b>
    </span>
  )
}