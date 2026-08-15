# Protocolo de Captura — Fase 0

Regras da sessão de gravação. O dataset da Fase 0 é o material de teste determinístico
do projeto inteiro — rótulo errado envenena o baseline da Fase 1 e você não descobre.

## Notação de carta

Sempre 2 caracteres: `<rank><suit>`

- Rank: `2 3 4 5 6 7 8 9 T J Q K A` — `T` para dez, nunca `10`
- Suit: `s` espadas, `h` copas, `d` ouros, `c` paus

Exemplos: `Ah` `Td` `7c` `Ks`

Largura fixa evita parsing ambíguo. Essa notação vale no sistema inteiro — visão, motor e overlay.

## Gravações

`data/recordings/peek_0001.mp4` — sequencial, sem metadado no nome.

Condição e rótulo vivem no manifesto. Nome de arquivo é chave, não banco de dados:
taxonomia codificada em nome obriga a renomear tudo quando a taxonomia muda.

- Formato: MP4 / H.264, 1080p, 30fps
- Duração: 3 a 6s — cartas na mesa, peek completo, cartas abaixadas
- Um peek por arquivo

## Manifesto

`data/labels/peeks.jsonl` — uma linha JSON por gravação, append durante a sessão.
JSONL porque o diff no git fica limpo (uma linha = uma gravação) e o Python lê linha a linha.

```json
{"file":"peek_0001.mp4","cards":["Ah","Kd"],"setup":"s1","light":"good","peek":"slow","overlap":"low","hand":"open","notes":""}
```

| campo | valores |
|---|---|
| `cards` | duas cartas, ordem: mais à esquerda primeiro (visão da câmera) |
| `setup` | id da montagem física (tabela abaixo) |
| `light` | `good` \| `dim` \| `harsh` |
| `peek` | `fast` \| `slow` |
| `overlap` | `low` (cartas separadas) \| `high` (a de trás parcialmente oclusa) |
| `hand` | `open` \| `closed` (mão cobrindo por cima) |

**Regra de ouro do rótulo:** anota a linha no manifesto *antes* de embaralhar.
Rotular de memória no fim da sessão é como o dataset apodrece.

## Cobertura mínima (30 clipes = 60 cartas)

Se gravar aleatório, cai tudo em luz boa e carta numérica — e o baseline não mede nada.

- **Todos os 13 ranks** ao menos 2x
- **J, Q, K ao menos 4x cada** — figuras não têm padrão de pips, é o caminho de risco do pipeline
- Cada naipe ao menos 10x
- `light`: mínimo 10 `good`, 10 `dim`, 6 `harsh`
- `peek`: mínimo 10 `fast`
- `overlap`: mínimo 10 `high`
- `hand`: mínimo 10 `closed`

Monta as duplas de propósito, não embaralhando. Cobertura é requisito, não sorte.

## Montagens físicas

Altura e distância são incógnitas da Fase 0 — provavelmente mais de uma montagem.
Registra cada uma e referencia pelo `setup` no manifesto.

| id | altura da lente | distância da carta | câmera | notas |
|---|---|---|---|---|
| s1 | | | | |