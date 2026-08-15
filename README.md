# Poker Broadcast

Transmissão de poker ao vivo com leitura de hole cards por câmera embutida no rail.

Uma câmera fixa por assento, na altura do feltro, atrás das cartas. Quando o player
levanta as cartas para espiar, apresenta a face à câmera. 

**Status:** Fase 1 concluída - leitura por visão validada com número medido.
Fase 2 (motor de jogo, console e overlay) - não iniciada.

## Resultado medido

1.501 leituras sobre 7 clipes gravados no ângulo do rail:

| origem | leituras | erradas |
|---|---|---|
| 3 peeks reais | 431 | 0 |
| 3 clipes cobrindo os 13 ranks | 705 | 3 |
| 1 clipe cobrindo os 4 naipes | 365 | 0 |
| **total** | **1.501** | **3 - 0,20%** |

Os três erros são o mesmo caso: `A♣` lido como `A♠` em 3 frames de 52, isolados e não
consecutivos. Com voto de maioria por peek, que é como o motor consome as observações.
O erro vai a **zero**.

Errar em silêncio destrói a credibilidade da transmissão. Não ler e avisar é o fallback
funcionando. O sistema nunca chuta: confiança abaixo do limiar vira "assento não lido"
e o operador digita.

Escopo do medido: 1 baralho, 1 setup, 1 condição de luz. Suficiente para instalação
fixa, que é o caso de uso; não valida generalização entre baralhos.

## Como funciona

O alvo de leitura é o **índice do canto**, não a carta inteira. Com duas cartas
sobrepostas em leque, a de trás não expõe mais nada. O baralho é desenhado
exatamente para isso.

Pipeline, todo em OpenCV clássico:

1. **MSER** encontra regiões de intensidade estável - o algoritmo padrão para texto em
   cena natural, e o único que não depende de contorno fechado nem de brilho absoluto
2. **Pareamento geométrico** filtra os candidatos: índice é um par vertical, rank em cima
   e naipe logo abaixo, mesmo eixo, tamanhos comparáveis
3. **Recorte em resolução nativa** - sem o downscale que um detector treinado aplicaria
4. **Binarização por Otsu** e separação dos dois glifos, fundindo blocos lado a lado
   (o `10` é o único rank escrito com dois glifos)
5. **Cor da tinta** elimina metade dos naipes: vermelho descarta ♠/♣, preto descarta ♥/♦
6. **Template matching por IoU** contra 13 templates de rank e 4 de naipe
7. **Limiar simultâneo** em rank e naipe - abaixo dele não vira carta

Sem treino, sem GPU, sem dataset anotado. O banco de 17 templates saiu de uma sessão
de captura de meia hora.

## O caminho até aqui

Duas famílias de abordagem falharam antes desta funcionar.

**Segmentar a carta inteira** - detecção de contorno, segmentação por cor e subtração de
fundo. Todas quebram pelo mesmo motivo: durante o peek a mão cobre o topo da carta, então
o contorno nunca fecha, e não existe threshold de cor que sobreviva a sombra projetada.

**Modelos YOLO pré-treinados** - nenhum foi treinado no ângulo rasante do rail, e a
degradação aparece tanto na localização quanto na classificação:

| abordagem | índices localizados (de 6) | pior erro observado |
|---|---|---|
| YOLOv8 pré-treinado (Hugging Face) | 1 | nunca detectou a segunda carta |
| YOLO pré-treinado (Roboflow) | 3 | `6♠` lido como `6♣` com 0,91 de confiança |
| **MSER + template matching** | **6** | nenhum |

O segundo caso é o modo de falha mais perigoso para uma transmissão: leitura errada com
confiança alta, que nenhum limiar filtra.

Um detector treinado no domínio ainda é caminho válido, e o pipeline atual serviria de
gerador de rótulos para ele. Mas com 0,20% de erro por frame e zero por peek, o custo
de dataset e treino não se justifica hoje.

## Arquitetura

Três processos independentes, sem monolito:

- **Serviço de visão** (Python + OpenCV) - emite observações: carta, confiança, assento,
  timestamp. Não decide nada.
- **Motor de jogo** (Node + TypeScript) - máquina de estado do Hold'em, gate temporal,
  restrição de baralho, voto de frames, equity. É a fonte da verdade. *Fase 2.*
- **Overlay** (Next.js) - página transparente consumida pelo OBS como Browser Source. *Fase 2.*

Se o serviço de visão cair, console e overlay continuam de pé, o operador digita, e a
transmissão não cai.

## Rodar

```bash
python -m venv services/vision/.venv
services\vision\.venv\Scripts\Activate.ps1
pip install -r services/vision/requirements.txt
```

Ler as cartas de um vídeo, frame a frame:
```
python services/vision/read_cards.py data/recordings/peek_0001.mp4 --show
```
Ler as cartas de uma WEBCAM:
```
python services/vision/read_cards.py --webcam 0 --show
```

Aceita `.mp4`, PNG solto ou diretório de PNGs. `--verbose` mostra os scores e os segundos
colocados de cada índice — útil para investigar margem.

Leitura ao vivo pela webcam, com as detecções desenhadas e as cartas no HUD:

```bash
python services/vision/read_cards.py --webcam 0 --show
```

O `--show` funciona em vídeo também, para revisar um clipe anotado em vez de abrir
centenas de PNGs.

O pipeline roda a 25–30 fps em 848×478, em CPU. Tempo real sem GPU.

Estrutura
```
services/vision/
├── read_cards.py       # pipeline completo: imagem → cartas
├── detection.py        # MSER e pareamento de índice
├── classification.py   # templates e matching
├── glyphs.py           # recorte, binarização, split, normalização, cor
├── detect_mser.py      # inspeção visual das detecções
├── crop_index.py       # inspeção manual de recorte
└── extract_frames.py   # extração de frames de vídeo

data/
├── templates/          # 17 templates de rank e naipe (versionado)
├── recordings/         # clipes de captura (fora do git)
└── labels/             # manifesto de rótulos
```

Documentação
Visão geral - o problema, a abordagem, a arquitetura
Plano e decisões - fases, edge cases, registro de decisões
Protocolo de captura - como gravar material novo
Escopo
Dentro: Texas Hold'em No Limit, cash game, até 9 assentos.

Fora por enquanto: torneio, outras variantes, contagem de fichas por visão,
switching automático de câmera, encode e stream próprio.
