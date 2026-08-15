import type { ClientMessage, ServerMessage } from "@poker-broadcast/core"

/**
 * Conexão WebSocket com o engine, com reconexão automática.
 * Reconectar não é conveniência: pedir F5 ao operador no meio de uma mão não é opção.
 * Não interpreta nada. Repassa mensagem crua pra quem assinar.
 */

const RECONNECT_DELAY_MS = 1000

export interface EngineHandlers {
  readonly onMessage: (message: ServerMessage) => void
  readonly onStatus: (connected: boolean) => void
}

export interface EngineClient {
  send(message: ClientMessage): void
  close(): void
}

export function connectEngine(url: string, handlers: EngineHandlers): EngineClient {
  let socket: WebSocket | null = null
  let retry: ReturnType<typeof setTimeout> | null = null
  let closed = false

  function open(): void {
    socket = new WebSocket(url)

    socket.addEventListener("open", () => handlers.onStatus(true))

    socket.addEventListener("message", (event) => {
      try {
        handlers.onMessage(JSON.parse(String(event.data)) as ServerMessage)
      } catch {
        // Mensagem ilegível do engine não derruba o console: ignora e segue
      }
    })

    socket.addEventListener("close", () => {
      handlers.onStatus(false)
      if (!closed) retry = setTimeout(open, RECONNECT_DELAY_MS)
    })

    socket.addEventListener("error", () => socket?.close())
  }

  open()

  return {
    send(message) {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
    },
    close() {
      closed = true
      if (retry !== null) clearTimeout(retry)
      socket?.close()
    },
  }
}