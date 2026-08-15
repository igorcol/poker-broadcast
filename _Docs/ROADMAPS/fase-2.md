# Fase 2 — Motor de jogo, console e overlay

## Goal

Sistema completo funcionando **sem visão nenhuma**: máquina de estado do Hold'em,
console do operador, equity e overlay no OBS. Ao fim da fase é possível transmitir
uma mesa real com o operador digitando tudo.

## Contexto

A Fase 1 entregou o `VisionCardSource` funcionando (1.501 leituras, 0,20% de erro por
frame, zero por peek). A visão não entra nesta fase — entra na 3.

Esta é a parte de valor garantido do projeto: funciona mesmo se a visão falhar
completamente. É também onde o TypeScript entra pela primeira vez.

---

## Ordem de construção

1. **Core** — tipos, baralho, máquina de estado, avaliador, side pots. Lógica pura, testável sem UI
2. **Harness de terminal** — jogar uma mão pelo terminal, validando o motor antes de existir interface
3. **Engine** — processo Node, `CardSource`, WebSocket
4. **Console** — cadastro pré-mão, atalhos, desfazer
5. **Equity** — Monte Carlo em worker
6. **Overlay** — Next.js transparente no OBS

**Justificativa:** o `plan.md` é explícito — "o motor deve ser testável sem câmera e sem
UI; a lógica que segura a acurácia vive aqui". Construir UI antes do motor inverte isso e
transforma teste de regra em clique de tela.

O harness de terminal (passo 2) existe para evitar o outro extremo: escrever quatro
etapas de motor sem nunca ver uma mão rodar. Ele é descartável, não é o console.

---

## Estrutura

```
poker-broadcast/
├── package.json          # npm workspaces
├── packages/
│   └── core/             # tipos, regras, avaliador, equity. Zero I/O
├── apps/
│   ├── engine/           # processo Node: estado + WebSocket
│   └── web/              # Next.js: /console e /overlay
└── services/vision/      # já existe, Python
```

`packages/core` separado porque os tipos do estado são consumidos pelo overlay e pelo
console. Tipo duplicado entre engine e web desincroniza — sempre.

---

## Etapas

### 2.1 — Tipos e baralho

**O que:** `Card`, `Rank`, `Suit`, `Deck`. Parse e format na notação de 2 caracteres
(`Ks`, `Td`, `7c`) — a mesma que o `capture-protocol.md` fixou e que o serviço de visão
já emite.

**Output:** baralho de 52 cartas, sem duplicata possível por construção.

**Testes:** roundtrip parse/format, baralho completo, rejeição de notação inválida.

---

### 2.2 — Máquina de estado

**O que:** o núcleo. Assentos, botão, blinds, ordem de ação, fases
(`preflop → flop → turn → river → showdown`), apostas e pote principal.

Ações: `fold`, `check`, `call`, `raise`, `all-in`. A máquina valida qual é legal em cada
estado — o console não precisa saber as regras, só emitir intenção.

**Output:** `applyAction(state, action) → state`. Estado imutável.

**Decisões:**
- **Estado imutável com histórico**, não undo reverso. Desfazer vira `pop()` numa pilha
  de estados; undo reverso exige inverter cada tipo de ação e é onde bugs moram
- Ações inválidas retornam erro tipado, nunca lançam silenciosamente

**Testes:** este é o ponto onde teste vale mais em todo o projeto. Sequências completas de
mão, ordem de ação com fold no meio, raise mínimo, big blind com opção de raise no preflop.

---

### 2.3 — Avaliador de mão

**O que:** 7 cartas → categoria e desempate comparável.

**Decisão a tomar:** implementar ou usar dependência. As libs JS conhecidas
(`pokersolver`, `poker-evaluator`) alocam objetos por avaliação, o que importa porque a
equity vai chamar isso ~1 milhão de vezes por cálculo.

Recomendação: **medir antes de decidir**. Implementar um avaliador por bitmask/lookup é
~200 linhas sem dependência; se uma lib der 100k avaliações em tempo aceitável, não vale
escrever. Benchmark antes de qualquer linha.

**Testes:** todas as 9 categorias, desempate por kicker, straight com ás baixo (`A2345`),
flush contra flush, full house contra full house.

---

### 2.4 — Side pots e showdown

**O que:** all-in com stacks desiguais, distribuição de pote principal e laterais,
split pot, odd chip.

Separado da 2.2 de propósito: side pot é a parte que implementação caseira erra com mais
frequência, e merece bateria própria.

**Testes:** three-way all-in com três stacks diferentes, split pot par e ímpar,
jogador all-in que ganha só o pote em que participou.

---

### 2.5 — Harness de terminal

**O que:** um REPL que joga uma mão pelo terminal. Digita ação, vê o estado.

**Não é o console.** É descartável, existe para provar o motor com a mão na massa antes
de construir interface. Se uma mão completa roda aqui, o núcleo está de pé.

---

### 2.6 — Engine como processo

**O que:** processo Node que segura o estado em memória e serve WebSocket para console e
overlay.

Interface `CardSource` com `ManualCardSource` implementado — a mesma interface que o
`VisionCardSource` vai satisfazer na Fase 3, sem o motor saber a diferença.

**Decisões:**
- Processo separado do Next: hot reload do dev server derruba o estado no meio de uma
  mão, e App Router não serve WebSocket nativo
- Mensagens JSON tipadas, com os tipos vindo de `packages/core` — sem contrato duplicado

---

### 2.7 — Console do operador

**O que:** cadastro pré-mão (nomes e stacks), entrada de cartas, atalhos de ação,
desfazer, correção de carta já commitada.

**Decisões:**
- Mapeamento de teclas: `F` fold, `C` call/check, `R` + valor raise, `A` all-in
- Entrada de carta na mesma notação de 2 caracteres do resto do sistema
- Correção de carta precisa propagar para a equity sem reiniciar a mão

**Resolve a Open Question 4** (entrada de nomes e stacks).

---

### 2.8 — Equity Monte Carlo

**O que:** ~100k iterações, conforme decisão 14.

**Decisões:**
- Roda em **worker thread**. Um milhão de avaliações na thread do WebSocket trava
  console e overlay ao mesmo tempo
- Recalcula a cada mudança de estado relevante — carta nova, fold, board

**Resolve a Open Question 1** (equity com assento não lido). Posição recomendada:
**esconder o número da mesa inteira** enquanto houver assento vivo sem carta commitada.
Estimar contra range apresenta inferência como fato na tela, que é o mesmo "errar em
silêncio" que a decisão 06 rejeita. Travar o jogo é inaceitável. O overlay mostra estado
de leitura pendente e volta com o número quando fecha.

---

### 2.9 — Overlay

**O que:** página Next.js de fundo transparente, servida em localhost, consumida pelo OBS
como Browser Source.

Mostra: nome e posição por assento, hole cards, comunitárias, ação da rodada, pote,
percentual de vitória.

**Decisões:** layout. Estado visual de "assento não lido" — precisa ser legível para o
operador sem parecer erro para o espectador.

---

## Edge cases

- **Operador erra a ação** → desfazer da última ação, via pilha de estados
- **Carta commitada errada** → correção sem reiniciar a mão, com recálculo de equity
- **Mão termina por fold** antes do showdown → pote vai direto, sem avaliar mãos
- **Split pot com odd chip** → regra de casa; definir e documentar
- **Jogador all-in por menos que a aposta** → side pot
- **Operador esquece uma ação** → o motor recusa a próxima por estar fora de ordem;
  precisa de mensagem clara em vez de silêncio
- **Engine cai no meio da mão** → estado em memória se perde. Aceitável na Fase 2;
  persistência é decisão adiada

---

## Decisões técnicas em aberto

1. **Test runner.** `node:test` é nativo desde o Node 18 e dispensa dependência.
   Recomendo ele até doer
2. **Avaliador: lib ou próprio.** Decidir por benchmark, não por preferência
3. **Odd chip em split pot.** Regra de casa varia; escolher uma e registrar

---

## Herdado do `plan.md`

**Decisão 11** ("gravar frame bruto de toda leitura desde o dia um") não se aplica aqui:
em modo manual puro não existe frame para gravar. Ela só começa a valer quando o
`VisionCardSource` entrar, na Fase 3.

**Open Question 3** (delay de segurança) tem solução que não custa código: aplicar o delay
no *output* do OBS, não no overlay. O OBS atrasa vídeo e overlay juntos, sincronia
preservada. O que sobra é procedimento — quem está na sala não pode ver o monitor de
programa.

---

## Success criteria

Do `plan.md`: "transmitir uma mesa real de ponta a ponta em modo manual, com overlay no
ar, sem travar o jogo."

Verificável:

- Uma mão completa, do cadastro ao showdown, sem o operador precisar corrigir estado à mão
- Overlay renderizando no OBS com fundo transparente e equity atualizando
- Motor com suíte de testes cobrindo ordem de ação, side pots e showdown
- Desfazer funcionando em qualquer ponto da mão
- Nenhuma regra de Hold'em vivendo fora de `packages/core`