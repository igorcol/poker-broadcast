"use client"

import { useEffect, useState } from "react"

import type { HandConfig } from "@poker-broadcast/core"

/**
 * Cadastro dos jogadores antes da mão: nomes, stacks, blinds e posição do botão.
 * >> Guarda os valores no navegador. Ninguém redigita nove nomes a cada mão.
 * Só monta a configuração e entrega; validar de verdade é do engine.
 */

const STORAGE_KEY = "poker-broadcast:setup"
const MAX_SEATS = 9

interface SetupSeat {
  name: string
  stack: number
}

interface SetupValues {
  seats: SetupSeat[]
  smallBlind: number
  bigBlind: number
  button: number
}

const DEFAULT_VALUES: SetupValues = {
  seats: [
    { name: "P0", stack: 1000 },
    { name: "P1", stack: 1000 },
    { name: "P2", stack: 1000 },
  ],
  smallBlind: 10,
  bigBlind: 20,
  button: 0,
}

export function HandSetup({
  onStart,
  onCancel,
}: {
  readonly onStart: (config: HandConfig) => void
  readonly onCancel: (() => void) | null
}) {
  const [values, setValues] = useState<SetupValues>(DEFAULT_VALUES)

  // localStorage não existe no servidor: carrega depois da hidratação
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === null) return
    try {
      setValues(JSON.parse(stored) as SetupValues)
    } catch {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  function updateSeat(position: number, patch: Partial<SetupSeat>): void {
    setValues((current) => ({
      ...current,
      seats: current.seats.map((seat, index) => (index === position ? { ...seat, ...patch } : seat)),
    }))
  }

  function addSeat(): void {
    setValues((current) =>
      current.seats.length >= MAX_SEATS
        ? current
        : { ...current, seats: [...current.seats, { name: `P${current.seats.length}`, stack: 1000 }] },
    )
  }

  function removeSeat(): void {
    setValues((current) =>
      current.seats.length <= 2
        ? current
        : {
            ...current,
            seats: current.seats.slice(0, -1),
            button: Math.min(current.button, current.seats.length - 2),
          },
    )
  }

  const invalid =
    values.seats.some((seat) => seat.name.trim() === "" || seat.stack <= 0) ||
    values.smallBlind <= 0 ||
    values.bigBlind <= values.smallBlind

  function start(): void {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values))
    onStart({
      seats: values.seats.map((seat, index) => ({ index, name: seat.name.trim(), stack: seat.stack })),
      button: values.button,
      smallBlind: values.smallBlind,
      bigBlind: values.bigBlind,
    })
  }

  return (
    <section className="setup">
      <h2>nova mão</h2>

      {values.seats.map((seat, position) => (
        <div key={position} className="setup__seat">
          <span>{position}</span>
          <input
            value={seat.name}
            onChange={(event) => updateSeat(position, { name: event.target.value })}
            aria-label={`nome do assento ${position}`}
          />
          <input
            type="number"
            value={seat.stack}
            onChange={(event) => updateSeat(position, { stack: Number(event.target.value) })}
            aria-label={`stack do assento ${position}`}
          />
        </div>
      ))}

      <div className="setup__actions">
        <button type="button" onClick={removeSeat} disabled={values.seats.length <= 2}>
          − assento
        </button>
        <button type="button" onClick={addSeat} disabled={values.seats.length >= MAX_SEATS}>
          + assento
        </button>
      </div>

      <div className="setup__blinds">
        <label htmlFor="sb">SB</label>
        <input
          id="sb"
          type="number"
          value={values.smallBlind}
          onChange={(event) => setValues((c) => ({ ...c, smallBlind: Number(event.target.value) }))}
        />
        <label htmlFor="bb">BB</label>
        <input
          id="bb"
          type="number"
          value={values.bigBlind}
          onChange={(event) => setValues((c) => ({ ...c, bigBlind: Number(event.target.value) }))}
        />
        <label htmlFor="btn">botão</label>
        <select
          id="btn"
          value={values.button}
          onChange={(event) => setValues((c) => ({ ...c, button: Number(event.target.value) }))}
        >
          {values.seats.map((seat, position) => (
            <option key={position} value={position}>
              {position} · {seat.name}
            </option>
          ))}
        </select>
      </div>

      <div className="setup__actions">
        <button type="button" className="primary" onClick={start} disabled={invalid}>
          iniciar mão
        </button>
        {onCancel !== null && (
          <button type="button" onClick={onCancel}>
            cancelar
          </button>
        )}
      </div>
    </section>
  )
}