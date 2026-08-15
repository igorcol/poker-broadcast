

# Rota A — detecção de texto clássica. 
E aqui eu preciso admitir que passei batido numa coisa óbvia.
Durante todo o pipeline clássico eu estava tentando achar a carta — contorno, cor, subtração de fundo, tudo focado em segmentar o retângulo. Falhou porque carta oclusa não fecha contorno.

Mas o alvo mudou (decisão 16): o alvo é o índice. E índice é texto. Tinta escura sobre papel claro, tamanho consistente, sempre um par vertical rank+naipe. Isso tem algoritmo dedicado que eu nunca testei: MSER — o padrão pra detecção de texto em cena natural.

Por que se encaixa melhor que tudo que tentamos:

Trabalha por estabilidade da região sob threshold variável, não por valor absoluto de brilho — é justamente o que quebrou na abordagem de cor
Seu recorte do K prova que o contraste local está lá
O par vertical (rank em cima, naipe logo abaixo, tamanhos proporcionais) é uma restrição geométrica forte, que mata falso positivo sem precisar de treino nenhum

Custo: um script, zero dataset, zero anotação. Roda nos frames que você já tem.


# Rota B — dataset sintético. 
Aquele repo do geaxgx que você trouxe no começo, e que eu tratei como se o valor fosse o modelo. O valor é o gerador: você fotografa as 52 cartas uma vez, e ele compõe milhares de cenas rotuladas automaticamente. Adaptando com warp perspectivo forte e oclusão sintética, você gera dataset do seu domínio sem anotar nada à mão.

Custo: fotografar o baralho + adaptar o gerador. Horas, não dias. E zero anotação manual — o que responde a sua objeção do passo anterior.