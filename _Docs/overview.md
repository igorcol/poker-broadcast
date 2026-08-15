# poker-broadcast — Visão Geral

> Sistema de transmissão de poker ao vivo com leitura de cartas por câmera.
> Codinome provisório.

---

## O que é

Software que transforma uma mesa de poker física em transmissão com overlay profissional: nome e posição de cada player, cartas na mão, cartas comunitárias, ação da rodada, pote e percentual de vitória em tempo real.

A diferença em relação ao que existe: **as cartas são lidas por câmera, não por hardware RFID.**

---

## O problema

Produzir transmissão de poker com cara de TV hoje exige mesa RFID — baralho com chip, antenas embutidas, tabletop dedicado. Custo alto, importação, instalação. Fora do alcance de campeonato local e casa de poker média.

Sem isso, a alternativa é overlay estático ou digitação manual de tudo, com resultado amador.

## O público

Clubes e casas de poker de porte médio, campeonatos locais, streamers de poker no Brasil. Perfil definido por uma característica só: **não têm estrutura RFID e não vão ter.**

## Estado atual do mercado

O incumbente é **PokerGFX**, ativo desde 2011, motor por trás da maioria das transmissões de poker do mundo. Windows, RFID proprietário, licença anual em dólar com renovação automática.

Dois fatos relevantes:

- **Há dor de preço documentada.** Reclamação recorrente em comunidade de poker sobre aumento contínuo e migração para assinatura.
- **Nem o líder lê hole card por câmera.** O sistema deles garante 100% de leitura em menos de 0,4s — via RFID. Quando a mesa não tem RFID, eles caem para **digitação manual das hole cards.**

O segundo ponto é a tese e o risco do projeto ao mesmo tempo: ninguém resolveu leitura de hole card sem hardware. Se o poker-broadcast resolver com acurácia utilizável, existe produto. Se não resolver, ainda sobra um sistema de overlay + motor de jogo com operação manual — inferior à tese, mas vendável ao público-alvo.

---

## A abordagem

### Câmera no rail, olhando para cima

Uma câmera fixa por assento, embutida no trilho da mesa, na altura do feltro, atrás das cartas. Quando o player levanta as cartas para espiar, apresenta a face inteira para a câmera sem saber.

Isso resolve três problemas de uma vez:

- **Oclusão.** O player esconde a carta de cima e dos lados, nunca de baixo. Câmera aérea ou frontal está exatamente onde ele bloqueia.
- **Atrito zero.** Nenhuma mudança de comportamento na mesa. O peek natural já é o gesto de captura.
- **Atribuição de assento.** Campo de visão de centímetros. Câmera 3 fisicamente não enxerga a carta do assento 4. Assento vira geometria, não inferência.

Nesse ângulo o índice do canto fica exposto e livre da mão — o player segura pelo topo
e pela lateral. É o alvo de leitura: na sobreposição em leque, a carta de trás não mostra
mais nada além do índice, porque o baralho é desenhado exatamente pra isso.
A carta da frente entrega índice e pips, e os pips entram como voto de confirmação.

### O gate temporal carrega a acurácia

O ganho principal não vem do modelo de visão. Vem de saber **o que é legal ler naquele instante**:

- Fase PREFLOP: espera exatamente 2 cartas por assento, zero comunitárias
- Fase FLOP: espera 3 comunitárias, ignora hole card (já travadas)
- Restrição de baralho: 52 cartas, zero duplicata, sempre

Somado a voto de N frames consistentes antes de commitar, isso converte um classificador de ~90% por frame em decisão de alta confiabilidade. É lógica de estado, não visão computacional.

### O sistema nunca chuta

Confiança abaixo do limiar não vira carta. Vira sinalização de "assento não lido" e o operador digita. Errar em silêncio destrói a credibilidade da transmissão. Não ler e avisar é apenas o fallback trabalhando.

### Operador humano é premissa, não falha

Visão computacional lê **apenas cartas**. Início de mão, ações (fold/call/raise/all-in), valores e pote são entrada de teclado do operador. Detecção de fichas e de ação por câmera é projeto separado e não confiável.

Essa decisão é o que torna o escopo factível.

---

## Arquitetura conceitual

Três processos independentes, sem monolito:

**Serviço de Visão (Python + OpenCV)**
Captura, detecta o quadrilátero da carta, corrige perspectiva por homografia, classifica. Emite observações — carta, confiança, assento, timestamp. **Não decide nada.**

**Motor de Jogo (Node + TypeScript)**
Máquina de estado do Texas Hold'em. Recebe observações da visão e comandos do operador, aplica gate temporal e restrição de baralho, commita cartas, calcula equity. É a fonte da verdade.

**Overlay (Next.js, servido em localhost)**
Página web com fundo transparente, consumida pelo OBS como Browser Source. O OBS compõe sobre o vídeo. Sem captura de janela, sem encode próprio, sem competir com suíte de broadcast.

Fronteira visão↔motor: WebSocket local, JSON.

Consequência prática: se o serviço de visão cair, console e overlay continuam de pé, operador digita, transmissão não cai.

### Fontes de carta plugáveis

Uma interface, implementações intercambiáveis. O motor não sabe de onde a carta veio.

| Fonte              | Papel                                                                          |
| ------------------ | ------------------------------------------------------------------------------ |
| `ManualCardSource` | Operador digita. Baseline e botão de pânico. Nunca deixa de existir            |
| `VisionCardSource` | Câmera ao vivo. Onde mora o estudo                                             |
| `VideoFileSource`  | Replay de gravação como se fosse ao vivo. Cavalo de batalha do desenvolvimento |

RFID está fora de escopo por decisão.

### O modo manual é a máquina de rotulagem

Toda falha de visão corrigida pelo operador gera um par frame + rótulo correto, vindo de uso real, exatamente nos casos difíceis. Gravar o frame bruto de todo evento de leitura desde o primeiro dia — acertando ou errando — constrói o dataset sozinho. A visão clássica de hoje financia o modelo treinado de amanhã.

---

## Escopo

**Dentro:** Texas Hold'em No Limit, cash game, até 9 assentos.

**Fora por enquanto:** torneio (níveis de blind, ante, timer, eliminação), outras variantes, contagem de fichas por visão, switching automático de câmera, encode e stream próprio.

---

## Trajetória

Projeto pessoal de estudo primeiro. O objetivo imediato é descobrir se o ângulo do rail entrega acurácia utilizável — com número medido, não com opinião.

Se entregar, o caminho natural é campeonato local e casa média, onde não existe alternativa acessível.
