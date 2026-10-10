# Etapa 12 — HUD do Shikigami e controle de movimento

**Data:** 10/10/2026
**Status:** implementada e validada localmente.

## Escopo entregue

- Ao selecionar uma instância no mapa, a HUD junto ao token mostra nome, PV, defesa, deslocamento e estado Caído.
- O painel do dono e o do Mestre mostram a ficha do Shikigami, seus próprios saldos de ação e recursos. O painel não debita nem executa uma habilidade ao selecionar alcance.
- O painel permite escolher o alcance do movimento ou de uma ação, selecionar um token visível como alvo e medir um ponto do mapa. O mapa desenha o raio e a distância; a medição usa as coordenadas centrais usadas pelo mapa.
- Quando a ficha configura saldo, recurso ou recarga com escopo manual, o painel oferece o reset manual apenas para aquela instância. O comando aplica somente os resets marcados como `manual` e limita recursos recuperados ao máximo configurado.
- O jogador pode arrastar a própria invocação fora de combate. Em combate, move no turno do dono, respeita o deslocamento configurado e gasta somente a Ação de Movimento da instância ao confirmar. Modo livre preserva o comportamento livre já existente.
- A prévia considera paredes, segmentos de terreno/neblina dinâmica e a ocupação de outros tokens. A confirmação revalida trajetória e distância; se a trajetória não for válida, o mapa reverte a prévia sem gastar ação. A posição aceita é publicada pelo mesmo canal de patches de entidade do mapa.
- Ações continuam sem execução pela HUD; ataques e demais habilidades seguem para as etapas 13 e 15. Janelas e execução de reação seguem para a Etapa 17.

## Limites conhecidos

- Seleção de alvo e medição são estados locais de interface e não representam uma ação de combate nem são sincronizados como estado de mesa.
- Sincronização server-side e locks autoritativos permanecem na Etapa 20.
- Os testes usam os stores e adaptadores em memória do projeto; não dependem do Supabase.

## Validação

- Testes direcionados: 3 arquivos, 45 testes aprovados.
- Suíte completa: 245 arquivos, 5.095 testes aprovados.
- `npx tsc --noEmit`: aprovado.
- `npm run build`: aprovado.
- `git diff --check`: aprovado.
