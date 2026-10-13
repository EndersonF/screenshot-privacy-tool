# Identidade do ícone

## Decisão aprovada

O ícone oficial é o **B1: imagem ocultada**, resultado da exploração de screenshot + tarja sólida. O arquivo definitivo é [app-icon.svg](../public/app-icon.svg).

O símbolo combina um quadrado preto arredondado, um frame branco horizontal, uma indicação simplificada de imagem e uma tarja preta opaca. Mantém a linguagem geométrica e a sobriedade da interface, sem cadeados ou escudos.

## Por que B1

Na exploração inicial, A privilegiava a tarja central, mas podia lembrar um sinal de menos; C enfatizava a seleção, com risco de parecer recorte ou scanner. B ofereceu a associação mais explícita entre imagem e ocultação e foi aprovado como conceito.

A rodada final comparou B1 e B2. B1 preservou a diagonal e o ponto, ajustando o frame e a leitura do ponto em tamanhos pequenos. B2 removeu o ponto e aumentou a tarja, mas a diagonal isolada podia lembrar uma seta. B1 foi aprovado como identidade oficial. Essas observações são avaliações visuais, não resultados de pesquisa de reconhecimento com usuários.

## Geometria preservada

- Canvas de 32 × 32 unidades, com cantos externos de raio 8.
- Frame branco de 24 × 20 unidades, em (4, 6), com raio 4.
- Diagonal com traço de 2 unidades e ponto com raio 2.
- Tarja de 16 × 4 unidades, em (8, 18).
- Somente preto e branco, sem sombras, gradientes, animações ou recursos externos.

Em 16 px, a tarja tem 2 px de altura e o ponto tem 2 px de diâmetro. O mesmo SVG atende 16, 32 e 64 px; não há variantes de desenho por tamanho.

## Integração

`index.html` referencia `/app-icon.svg` como favicon. O componente `Brand` usa o mesmo arquivo em 26 × 26 px, preservando nome, espaçamento e alinhamento existentes. A imagem é decorativa junto ao nome e usa texto alternativo vazio.

O SVG contém somente as formas necessárias e não inclui scripts, fontes ou referências externas. A Content Security Policy existente permite seu carregamento pela própria origem, sem alterações.

As alternativas, o favicon provisório e o preview temporário foram removidos. Há um único arquivo de produção para o símbolo; a aplicação não publica uma página de comparação visual.
