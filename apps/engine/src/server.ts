import { env } from "node:process";

import {
  isCard,
  type Card,
  type CardObservation,
  type ClientMessage,
  type ServerMessage,
} from "@poker-broadcast/core";
import { WebSocketServer, type WebSocket } from "ws";

import { ManualCardSource } from "./manual-source.ts";
import { Session, type Outcome } from "./session.ts";

/**
 * Processo que segura o estado da mão e serve console e overlay por WebSocket local.
 * Recebe intenção do operador, delega ao core e retransmite o estado a todos os clientes.
 * Vive fora do Next de propósito: hot reload derrubaria o estado no meio de uma mão.
 */

const PORT = Number(env["ENGINE_PORT"] ?? 4000);

function isCardArray(value: unknown): value is Card[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && isCard(item))
  );
}

/** Valida só o suficiente pra não passar lixo ao core. O core devolve erro tipado no resto. */
function parseMessage(raw: string): ClientMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof value !== "object" || value === null || !("type" in value))
    return null;
  const message = value as Record<string, unknown>;

  switch (message["type"]) {
    case "start-hand":
      return typeof message["config"] === "object" && message["config"] !== null
        ? (message as unknown as ClientMessage)
        : null;

    case "action":
      return typeof message["action"] === "object" && message["action"] !== null
        ? (message as unknown as ClientMessage)
        : null;

    case "deal-board":
      return isCardArray(message["cards"])
        ? (message as unknown as ClientMessage)
        : null;

    case "set-cards":
      return typeof message["seat"] === "number" &&
        isCardArray(message["cards"]) &&
        message["cards"].length === 2
        ? (message as unknown as ClientMessage)
        : null;

    case "undo":
      return { type: "undo" };

    default:
      return null;
  }
}

const session = new Session();
const cardSource = new ManualCardSource();
const server = new WebSocketServer({ port: PORT });

function send(socket: WebSocket, message: ServerMessage): void {
  socket.send(JSON.stringify(message));
}

function broadcastState(): void {
  const payload = JSON.stringify({
    type: "state",
    state: session.current,
  } satisfies ServerMessage);
  for (const client of server.clients) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
}

/** Caminho único de entrada de carta — vale pro teclado do operador e pra visão na Fase 3. */
function applyObservation(observation: CardObservation): Outcome {
  if (observation.seat === null) {
    return session.deal(observation.cards);
  }

  const [first, second] = observation.cards;
  if (first === undefined || second === undefined) {
    return { ok: false, error: "invalid-observation" };
  }
  return session.setCards(observation.seat, [first, second]);
}

// A visão empurra observação sem socket nenhum; aqui o erro só tem onde ir pro log
cardSource.start((observation) => {
  const outcome = applyObservation(observation);
  if (outcome.ok) broadcastState();
  else console.error(`observação recusada: ${outcome.error}`);
});

server.on("connection", (socket) => {
  send(socket, { type: "state", state: session.current });

  socket.on("message", (raw) => {
    const message = parseMessage(raw.toString());
    if (message === null) {
      send(socket, { type: "error", error: "malformed-message" });
      return;
    }

    const outcome = (() => {
      switch (message.type) {
        case "start-hand":
          return session.start(message.config);
        case "action":
          return session.apply(message.action);
        case "undo":
          return session.undo();
        case "deal-board":
          return applyObservation({
            seat: null,
            cards: message.cards,
            confidence: 1,
            at: Date.now(),
          });
        case "set-cards":
          return applyObservation({
            seat: message.seat,
            cards: message.cards,
            confidence: 1,
            at: Date.now(),
          });
      }
    })();

    if (!outcome.ok) {
      send(socket, { type: "error", error: outcome.error });
      return;
    }
    broadcastState();
  });
});

console.log(`engine ouvindo em ws://localhost:${PORT}`);
