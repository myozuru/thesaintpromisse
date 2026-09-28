# Arena 3D reativa por proximidade

## Objetivo
Fazer os limites físicos da bandeja surgirem apenas perto dos dados, com uma resposta futurista e suave que acompanhe o movimento sem alterar a física.

## Alterações
- Compartilhar as posições atuais de todos os dados com a arena visual diretamente no ciclo 3D, sem renderizações extras da interface.
- Substituir a visibilidade constante da grade e das paredes por campos locais de proximidade:
  - o piso acende em círculos suaves ao redor de cada dado;
  - paredes e contornos aparecem progressivamente quando um dado se aproxima;
  - impactos produzem um pulso breve, preservando as cores de cada nível de drama.
- Manter uma luminosidade-base muito discreta para que o formato da bandeja continue compreensível sem poluir a cena.
- Limitar o número de dados enviado ao efeito e reutilizar materiais/uniformes para manter bom desempenho.

## Validação
- Testar a matemática de distância e intensidade para piso, paredes, cantos e múltiplos dados.
- Confirmar que a arena física continua exatamente do mesmo tamanho.
- Verificar no navegador que o efeito acompanha o dado, não pisca ao redimensionar e não gera erros.

## Detalhes técnicos
A arena usará materiais 3D leves com posições atualizadas por referência a cada quadro. A intensidade será calculada por distância com transição suavizada e tempo limitado por quadro; nenhuma posição será enviada para estado React durante o movimento.
