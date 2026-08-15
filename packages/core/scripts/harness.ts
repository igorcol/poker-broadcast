import { createInterface } from "node:readline/promises";
import { argv, stdin, stdout } from "node:process";

import { applyAction, legalActions, startHand, type Action } from "../src/betting.ts"
import { dealBoard } from "../src/dealing.ts"
import { createDeck, parseCard, type Card } from "../src/card.ts";
import {
  pendingBoardCards,
  totalPot,
  type GameState,
  type HandConfig,
} from "../src/table.ts";

/**
 * Harness de terminal pra jogar uma mão à mão e ver a máquina de estado funcionando.
 * Lê comandos curtos, aplica no motor e imprime o estado a cada transição.
 * Descartável - existe pra validar o motor antes do console, e sai quando o console entrar.
 */

// --- RODAR ---
// Três jogadores:
// npm run harness --workspace @poker-broadcast/core

// Heads-up:
// npm run harness --workspace @poker-broadcast/core -- 2

// npm test --workspace @poker-broadcast/core

const STACK = 1000;
const SMALL_BLIND = 10;
const BIG_BLIND = 20;

function render(state: GameState): string {
  const board = state.board.length > 0 ? state.board.join(" ") : "—";
  const waitingBoard = pendingBoardCards(state) > 0;
  const lines = [
    "",
    `── ${state.phase.toUpperCase()} ──  pote ${totalPot(state)}  ·  board ${board}`,
    "",
  ];

  state.seats.forEach((seat, position) => {
    const acting = !waitingBoard && position === state.toAct ? ">" : " ";
    const marks = `${acting}${position === state.button ? "D" : " "}`;
    const bet = seat.committed > 0 ? `  apostou ${seat.committed}` : "";
    const status = seat.status === "active" ? "" : `  ${seat.status}`;
    lines.push(
      `${marks} ${seat.name.padEnd(4)} ${String(seat.stack).padStart(6)}${bet}${status}`,
    );
  });

  return lines.join("\n");
}

/** `c` vira check ou call conforme o estado. */
function parseAction(input: string, state: GameState): Action | "quit" | null {
  // Aceita `r40` além de `r 40`: no meio de uma mão ninguém digita o espaço
  const [command = "", value] = input
    .trim()
    .toLowerCase()
    .replace(/^([a-z])(\d)/, "$1 $2")
    .split(/\s+/);

  switch (command) {
    case "q":
      return "quit";
    case "f":
      return { type: "fold" };
    case "a":
      return { type: "allin" };
    case "c":
      return legalActions(state).includes("check")
        ? { type: "check" }
        : { type: "call" };
    case "r": {
      const to = Number(value);
      return Number.isFinite(to) && to > 0 ? { type: "raise", to } : null;
    }
    default:
      return null;
  }
}

/** Sorteia do que sobrou do baralho — o harness testa aposta, não entrada de carta. */
function drawRandom(used: readonly Card[], count: number): Card[] {
  const available = createDeck().filter((card) => !used.includes(card));
  const drawn: Card[] = [];

  while (drawn.length < count && available.length > 0) {
    const [card] = available.splice(
      Math.floor(Math.random() * available.length),
      1,
    );
    if (card !== undefined) drawn.push(card);
  }

  return drawn;
}

function parseBoard(
  input: string,
  expected: number,
  used: readonly Card[],
): Card[] | null {
  if (input.trim() === "") {
    return drawRandom(used, expected);
  }

  const cards = input
    .trim()
    .split(/\s+/)
    .map(parseCard)
    .filter((card): card is Card => card !== null);

  const unique = new Set(cards);
  if (cards.length !== expected || unique.size !== expected) return null;
  return cards.some((card) => used.includes(card)) ? null : cards;
}

async function main(): Promise<void> {
  const seatCount = Math.min(9, Math.max(2, Number(argv[2] ?? 3)));
  const config: HandConfig = {
    seats: Array.from({ length: seatCount }, (_, index) => ({
      index,
      name: `P${index}`,
      stack: STACK,
    })),
    button: 0,
    smallBlind: SMALL_BLIND,
    bigBlind: BIG_BLIND,
  };

  let state = startHand(config);
  const terminal = createInterface({ input: stdin, output: stdout });

  console.log(
    `${seatCount} jogadores · stack ${STACK} · blinds ${SMALL_BLIND}/${BIG_BLIND}`,
  );
  console.log(
    "comandos:  f fold  ·  c check/call  ·  r <valor> raise  ·  a all-in  ·  q sair",
  );

  try {
    while (true) {
      console.log(render(state));
      if (
        state.phase === "complete" ||
        (state.toAct === null && pendingBoardCards(state) === 0)
      ) {
        break;
      }

      const pending = pendingBoardCards(state);
      if (pending > 0) {
        const prompt = `\n${pending} carta(s) do board — ex "Kh 7d 2s", ou enter pra sortear > `;
        const cards = parseBoard(
          await terminal.question(prompt),
          pending,
          state.board,
        );
        if (cards === null) {
          console.log(
            `informe ${pending} carta(s) distintas e ainda não no board`,
          );
          continue;
        }

        const dealt = dealBoard(state, cards);
        if (!dealt.ok) {
          console.log(`recusado: ${dealt.error}`);
          continue;
        }
        state = dealt.state;
        continue;
      }

      console.log(`\nlegais: ${legalActions(state).join(", ")}`);
      const action = parseAction(await terminal.question("> "), state);
      if (action === "quit") break;
      if (action === null) {
        console.log("comando não reconhecido");
        continue;
      }

      const result = applyAction(state, action);
      if (!result.ok) {
        console.log(`recusado: ${result.error}`);
        continue;
      }
      state = result.state;
    }
  } finally {
    terminal.close();
  }

  console.log(`\nmão encerrada em ${state.phase} — pote ${totalPot(state)}`);
}

await main();
