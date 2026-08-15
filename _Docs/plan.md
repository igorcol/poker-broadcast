# poker-broadcast — Plano e Decisões

## Goal

Construir um sistema de transmissão de poker que leia cartas por câmera embutida no rail, com operador humano para ações, entregando overlay profissional via OBS — e determinar, com número medido, se leitura de hole card sem RFID é viável.

## Context

Projeto pessoal de estudo do Igor, com intenção de virar ferramenta para campeonatos locais e casas de poker médias sem estrutura RFID. O incumbente (PokerGFX) resolve o problema com hardware caro e, na ausência dele, cai para digitação manual — ou seja, a leitura de hole card por câmera é problema em aberto no mercado. Restrições assumidas: um único PC no desenvolvimento, stack base Next.js/TypeScript/Node, sem hardware especializado.

---

## Process Overview

1. Montar harness de captura e gravar dataset real de peeks no ângulo do rail
2. Rodar pipeline OpenCV clássico offline sobre as gravações e obter o número de baseline
3. Construir motor de estado, console do operador, equity e overlay — sistema completo em modo manual
4. Plugar o `VisionCardSource` no motor com gate temporal e voto de frames
5. Expandir para múltiplos assentos, delay de segurança e empacotamento

**Ordem justificada:** o desconhecido vem primeiro. Fases 1 e 2 matam ou confirmam a tese de visão sem depender de nada construído. Fase 3 é a parte de valor garantido — funciona mesmo se a visão falhar.

---

## Detailed Steps

### Fase 0: Harness de captura e dataset

**O que acontece:** Montagem física improvisada de uma câmera na altura da mesa, atrás das cartas, simulando posição de rail. Gravação de 20 a 30 peeks reais em condições variadas: luz boa, luz ruim, mão fechada, mão aberta, peek rápido, peek lento, cartas mais e menos sobrepostas.

**Input:** Webcam do PC, baralho, mesa ou superfície equivalente.

**Output:** Biblioteca de vídeos rotulados manualmente (qual carta era, em cada gravação). Este é o material de teste determinístico do projeto inteiro.

**Decisões:** Altura exata e distância da câmera. Registrar o que funcionou — vira especificação de instalação depois.

**Notas:** Sem este passo, toda iteração de visão exige reencenar captura com baralho na mão. É a diferença entre iterar às 3h da manhã e depender de logística.

---

### Fase 1: Pipeline OpenCV clássico e número de baseline

**O que acontece:** Serviço Python processando os vídeos da Fase 0, offline, sem motor de jogo. Pipeline:

1. Detecção de movimento no ROI fixo dispara o processamento (evita rodar rede em 30fps)
2. Detecção de contorno → quadrilátero de cada carta
3. Homografia → warp para retângulo canônico
4. Template match de valor e naipe pelo padrão de pips
5. Score de confiança por leitura

**Input:** Gravações da Fase 0.

**Output:** Um número. "X% dos peeks lidos corretamente, Y% não lidos, Z% lidos errado."

**Decisões:** Limiar de confiança inicial. A taxa de **leitura errada** é a métrica crítica — não a de acerto.

**Notas:** Mesmo que o clássico não vá para produção, a detecção de quadrilátero e a homografia são reaproveitadas por qualquer pipeline de ML futuro.

---

### Fase 2: Motor de jogo, console e overlay (modo manual)

**O que acontece:** Sistema completo funcionando sem visão nenhuma.

- Máquina de estado do Texas Hold'em NL cash, até 9 assentos: ordem de assento, blinds, de quem é a vez, fases, pote, side pots
- Console do operador com atalhos de teclado: início de mão, F/C/R+valor/A
- Motor de equity em Monte Carlo, ~100 mil iterações
- Overlay em Next.js com fundo transparente, servido em localhost
- Interface `CardSource` com `ManualCardSource` implementado

**Input:** Regras do Hold'em, decisões de UX do console.

**Output:** Produto utilizável. Já dá para transmitir uma mesa real com operador digitando tudo.

**Decisões:** Layout do overlay. Mapeamento exato de teclas. Estrutura do estado do jogo.

**Notas:** O motor deve ser testável sem câmera e sem UI — a lógica que segura a acurácia vive aqui e precisa de testes diretos. Gravação bruta de frame em toda entrada manual começa nesta fase.

---

### Fase 3: Integração da visão

**O que acontece:** Serviço Python passa a emitir observações ao vivo por WebSocket local. O motor aplica:

- Gate temporal por fase do jogo (preflop espera 2 hole cards por assento; flop espera 3 comunitárias e ignora hole card)
- Restrição de baralho — nenhuma carta duplicada, nunca
- Voto de N frames consistentes antes de commitar
- Rejeição abaixo do limiar → sinaliza "assento não lido" e pede operador

**Input:** Fases 1 e 2 concluídas.

**Output:** Leitura automática de hole card de um assento, com fallback manual funcionando.

**Decisões:** N do voto temporal. Limiar de commit. Comportamento do overlay durante leitura pendente.

**Notas:** Python reporta observação, TypeScript decide. Nenhuma regra de jogo do lado Python.

---

### Fase 4: Multi-assento e produto

**O que acontece:** `IpCameraSource` para validar dois streams simultâneos (celular como segunda câmera), binding câmera→assento na UI, delay de segurança, empacotamento em Electron ou Tauri.

**Notas:** Teste de encanamento, não de visão. Só faz sentido depois que um assento funciona bem.

---

## Edge Cases and Failure Modes

- **Carta não lida** → sistema sinaliza o assento e o operador digita. Nunca chuta
- **Carta lida errada** → falha mais grave do sistema. Operador precisa de correção rápida de carta já commitada, com propagação para a equity
- **Carta de trás oclusa pela da frente** → resolvido pelo voto temporal ao longo do peek; se falhar, cai no manual
- **Duplicata detectada** → rejeição automática pela restrição de baralho, sem chegar na tela
- **Operador erra a ação** → precisa de desfazer de última ação no console
- **Serviço de visão cai** → console e overlay seguem de pé, transmissão continua em modo manual
- **Assento vivo não lido no showdown** → afeta a equity de toda a mesa, não só a dele (ver Open Questions)
- **Player não levanta a carta o suficiente** → peek nunca captura, cai no manual. Aceitável

---

## Dependencies and Requirements

- Python com OpenCV
- Node + TypeScript, Next.js
- OBS Studio com Browser Source
- Webcam, baralho, superfície de mesa
- Montagem física improvisada para posicionar a câmera na altura do feltro

---

## Open Questions

1. **Equity com assento não lido.** Se o assento 5 falhar, o percentual de todos na tela fica incorreto. Esconder o número, estimar contra range, ou travar até o operador digitar? Decidir na Fase 2.
2. **Câmera por assento no produto final.** Nove câmeras é banda USB, cabeamento, sincronia e custo por mesa. Se forem celulares, a arquitetura vira ingestão em rede — outro projeto. Decidir na Fase 4.
3. **Delay de segurança.** Se o sistema conhece hole cards em tempo real, é vetor de trapaça. Todo broadcast sério roda com atraso e o incumbente tem recurso dedicado a isso. Requisito de integridade, não feature. Definir antes de qualquer uso real com dinheiro na mesa.
4. **Entrada de nomes e stacks dos players.** Cadastro pré-mão no console, presumivelmente. Não discutido.
5. **Binding câmera→assento na UI.** Como o operador associa cada dispositivo ao lugar. Não discutido.
6. **Nome do projeto.** "poker-broadcast" é placeholder.

---

## Success Criteria

**Fase 1 (o marco que decide o projeto):** existir um número de acurácia medido sobre gravações reais. Meta prática: acima de 85% de peeks lidos corretamente **com taxa de leitura errada próxima de zero.** Leitura errada é pior que não ler.

**Fase 2:** transmitir uma mesa real de ponta a ponta em modo manual, com overlay no ar, sem travar o jogo.

**Fase 3:** uma sessão completa em que a maioria das hole cards de um assento entra sozinha e o operador só corrige exceções.

**Projeto:** casa de poker média conseguir transmitir com qualidade de tela comparável à referência do mercado, sem comprar hardware especializado.

---

## Registro de Decisões

| #   | Decisão                                           | Razão                                                                  |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------- |
| 01  | Projeto de estudo primeiro, produto depois        | Alvo é casa sem estrutura, e o problema técnico ainda não está provado |
| 02  | RFID fora de escopo                               | Hardware caro contradiz o público-alvo                                 |
| 03  | Hole card é o primeiro alvo da visão              | É o problema que vale dinheiro; falhar cedo tem valor                  |
| 04  | Câmera no rail, altura da mesa, atrás das cartas  | Único ângulo que o player não bloqueia; o peek já é o gesto            |
| 05  | Sem gesto predefinido                             | Ritual não pega em casa média; dealer não cobra                        |
| 06  | Visão lê apenas cartas                            | Detecção de ação e fichas é projeto separado e não confiável           |
| 07  | Operador humano com atalhos de teclado            | Torna o escopo factível; máquina de estado deduz o resto               |
| 08  | Overlay como Browser Source no OBS                | Padrão da indústria, é o próprio stack, desacopla o visual             |
| 09  | Texas Hold'em NL, cash, até 9 assentos            | Torneio adiciona blinds/ante/timer/eliminação                          |
| 10  | OpenCV clássico antes de ML                       | Zero dataset, resultado em dias, gera o baseline                       |
| 11  | Gravar frame bruto de toda leitura desde o dia um | Modo manual vira máquina de rotulagem para ML futuro                   |
| 12  | Python e Node separados via WebSocket local       | Python observa, TS decide; isolamento de falha                         |
| 13  | Sem Electron por enquanto                         | Distribuição não existe antes do produto; custo em toda iteração       |
| 14  | Equity em Monte Carlo, ~100k iterações            | Exato é caro com 9 assentos; erro na terceira casa é invisível         |
| 15  | `VideoFileSource` como fonte de primeira classe   | Iteração determinística e repetível sem mesa montada                   |
