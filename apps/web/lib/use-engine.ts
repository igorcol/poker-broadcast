"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { ClientMessage, GameState } from "@poker-broadcast/core"

import { connectEngine, type EngineClient } from "./engine-client.ts"

/**
 * Estado do engine dentro do React: conecta, guarda o último estado e expõe o envio.
 * Mantém o texto digitado fora daqui de propósito. Senão cada tecla re-renderiza a mesa.
 * O console não decide nada: só emite intenção e desenha o que voltar.
 */

const DEFAULT_URL = "ws://localhost:4000"

export function useEngine(url: string = DEFAULT_URL) {
  const [state, setState] = useState<GameState | null>(null)
  const [equity, setEquity] = useState<readonly (number | null)[]>([])
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const clientRef = useRef<EngineClient | null>(null)

  useEffect(() => {
    const client = connectEngine(url, {
      onMessage: (message) => {
        if (message.type === "state") {
          setState(message.state)
          setError(null)
        } else if (message.type === "equity") {
          setEquity(message.values)
        } else {
          setError(message.error)
        }
      },
      onStatus: setConnected,
    })

    clientRef.current = client
    return () => client.close()
  }, [url])

  const send = useCallback((message: ClientMessage) => clientRef.current?.send(message), [])

  return { state, equity, error, connected, send }
}