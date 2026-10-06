# Etapa 16 — Espaço e movimento

## Geometria de alcance

A seleção do mapa e a validação de execução agora compartilham a mesma medida e as mesmas peças elegíveis. Ações OMNI usam distância circular entre centros; ataques com armas usam distância borda a borda, igual à regra de alcance do motor de combate. Alcance `0` continua significando livre no construtor e não vira um círculo de raio zero.

Quando o alcance da ação está em zero e ela pertence a uma arma — ou declara teste de ataque — a seleção e a revalidação herdam o alcance da arma. A revalidação recalcula esse limite depois da escolha, antes de pagar custos, para não executar um alvo que tenha saído do alcance durante a seleção.

Fichas podem ter mais de um token válido. A mira e a validação consideram os pares de tokens visíveis ligados às fichas; o token clicado precisa estar ele próprio dentro do alcance. Tokens ocultos, carregados, em outra camada ou em camada desativada não entram na escolha.

## Trajetória e oportunidade

Ataque de Oportunidade agora inspeciona os segmentos da trajetória confirmada. Se a peça entra no alcance ameaçado e sai durante o deslocamento, o gatilho acontece mesmo terminando fora dele. Segmentos são testados analiticamente contra a área adjacente, sem criar milhares de amostras para movimentos longos. Curvas mantêm os waypoints registrados no arraste.

Teleporte permanece sem provocar Ataque de Oportunidade; mudanças de posição só produzem efeitos após confirmação. A seleção espacial existente de círculos, cones, linhas, colisão de tokens e áreas continua apoiada por testes analíticos.

## Arquivos e validação

- `src/lib/mapa/tokenDaFicha.ts` e `alcanceCircular.ts`: resolução de todos os tokens elegíveis e medidas por ficha.
- `src/stores/useAlvoMapaStore.ts`, `src/lib/omni/alvosAtivos.ts`, `src/lib/omni/acaoAtiva.ts` e `src/components/fichas/AcoesAtivasSection.tsx`: mesma faixa entre mira, revalidação e execução.
- `src/components/mapa/opportunityEngine.ts` e `src/components/mapa/ui/PendingMoveOverlay.tsx`: saída de alcance detectada ao longo dos waypoints.
- `src/lib/omni/movimentosAtivos.ts`: movimentos OMNI exigem token visível e elegível.
- Testes focados em mira, ações OMNI, alcance de armas, movimento OMNI e trajetória: **97 testes passaram em 7 arquivos**.
- `npx tsc --noEmit` e `git diff --check` passaram para esta versão.

A seleção de áreas OMNI centradas em si ainda usa um token canônico como origem para desenhar a forma. A semântica de múltiplas origens para áreas centradas em uma ficha com vários tokens fica em aberto para integração multiplayer e de mesa na Etapa 24.
