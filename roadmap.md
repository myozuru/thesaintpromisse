# Roadmap

- [x] Migrate TP Fichas source and bundled assets into the current app.
- [x] Adapt the app shell, route, metadata, and Tailwind v4 theme.
- [x] Install the source application's required runtime packages.
- [ ] Verify build and core desktop/mobile flows.
- [ ] Keep original database records, users, and multiplayer service pending until exports/configuration are supplied.
- [x] Add adjustable circular framing to PNG characters and verify creation, editing, and persistence.
- [x] Allow circular character tokens to switch back to free images and add a themed double border.
- [x] Share temporary-sheet templates through the cloud while preserving legacy browser-saved models.
- [x] Bind personal money wallets to each player's linked sheet and let the Master create assigned wallets.
- [x] Turn Master test requests into a draggable/docked overlay without leaving the map.
- [x] Center the real 3D dice tray inside the player's received test flow.
- [x] Redesign Master and player test requests with the approved Obsidian Arcana direction.
- [x] Make Legendary rolls physically faster and bouncier without reducing slow motion, with player-screen colors per drama level.
- [x] Increase the dice's physical rotation, with progressively stronger spins through Legendary drama.
- [x] Launch dice diagonally across the tray with transverse rotation so they roll farther without stalling.
- [x] Expand the 3D arena, throw from varying edges, and add optional single-die cinematic focus for player tests.

- [x] Corrigir zoom, sincronização e composição compacta do resultado no foco cinematográfico.
- [x] Conter a arena, reforçar a rolagem lateral e manter o dado enquadrado desde o lançamento.
- [x] Suavizar impactos para não inverter ou cancelar bruscamente a rotação dos dados.
- [x] Adaptar a câmera ao formato da bandeja para o dado nunca nascer fora da visão.
- [x] Aproximar bastante a visão dos dados e compactar a arena sem cortar lançamentos nas bordas.
- [x] Ampliar os dados em mais 50% na visão e reduzir proporcionalmente a arena 3D.
- [x] Repetir a ampliação de 50% e compactar novamente toda a área física da bandeja.
- [x] Recuar somente o zoom da bandeja em 10% para comparação visual.
- [x] Aproximar em 20% o zoom de teste sem alterar a arena física.
- [x] Suavizar a aproximação final e alinhar a face sorteada para leitura inequívoca, incluindo 6 e 9.
- [x] Estabilizar o dado durante a redução final e tornar os limites físicos da bandeja visíveis.
- [x] Revelar a arena futurista apenas ao redor dos dados conforme eles se aproximam do piso e das paredes.
- [x] Evitar a reconstrução dos corpos físicos ao soltar um ou muitos dados.
- [x] Aumentar somente a altura dos quiques por drama e centralizar sem flick o foco final do dado.
- [x] Manter o dado no centro desde o primeiro quadro da aproximação cinematográfica.
- [x] Sincronizar câmera e bandeja durante toda a redução final para o dado não ser recortado nem saltar de posição.

## Pendências de regras
- [ ] Suporte Nv 4 — "No Último Segundo": implementar junto com os testes da Porta da Morte (contador de fracassos). Lembrar o usuário quando a Porta da Morte for feita.

## Pendências de mapa (regras definidas, aguardando início)
- [x] Cena própria por tela: trocar de cena não arrasta mais as outras telas. (Pendente: Mestre enviar jogadores para uma cena.)
- [ ] Movimento por cômodos: jogador vê só o cômodo onde está; setas nas portas levam ao próximo cômodo (só na visão dele). Em combate, só na vez dele e limitado por metros percorridos; fora de combate, livre. Portas trancadas exigem chave (puzzles depois).
- [ ] Aba "Mapa do Mundo": vários mundos com troca; marcadores; ícone redondo de boss com as bordas temáticas; cartão do boss (ND, Patamar, Fraquezas, Resistências, RDs e campos livres) com visibilidade por campo definida pelo Mestre; estado do boss; Mestre oculta/revela qualquer coisa aos jogadores.
- [ ] Ideia guardada (não fazer ainda): ligar boss do mapa-múndi à batalha.
- [x] Corrigir sobreposição do HUD e limitar a barra clicável da ficha aos controles de expansão.

## Especialista em Combate — Repertório do Especialista
- [x] Base: estilo no Nv 1 (criação), +1 no Nv 6 e +1 no Nv 12 (retroativo), painel na ficha e aba "Estilos" no combate; Adepto de Combate usa a mesma lista.
- [x] Estilo Defensivo (CA +2, +1 em 4/8/12/16).
- [x] Duelista · [x] Distante · [x] Arremessador · [x] Duplo (+1 dano; atributo na 2ª arma PENDENTE — aguardando regra do ataque com a 2ª arma) · [x] Massivo · [x] Protetor · [x] Interceptador (Nd10 + mod. do atributo-chave)

## Especialista em Combate — Artes do Combate (Nv 1)
- [x] Pontos de Preparo = nível + Mod. SAB; aba "Artes" no combate + toggles no painel de Ataque.
- [x] Arremesso Ágil (1 PP): ataque extra com arma de arremesso em 2º alvo após acertar CaC.
- [x] Distração Letal (1 PP): no acerto, −(SAB/2, mín 1) Defesa do alvo por 1 rodada.
- [x] Execução Silenciosa (1 PP): vs Desprevenido, +1d6 + 1d6 a cada +2 de SAB.
- [x] Golpe Descendente (1 PP): no acerto CaC, +(SAB/2, mín 1) Defesa própria até o próximo turno.
- [x] Investida Imediata (2 PP): aproxima SAB×1,5 m sem AdO antes de atacar (cobre alcance).
- [x] Recuperação: eliminar inimigo +1; ação "Analisar o campo" +2; descanso curto metade; longo total.
- [ ] Decisões assumidas (confirmar com o usuário): metade do SAB arredonda para baixo; "Desprevenido" = condição desprevenido/agarrado/atordoado na ficha do alvo.

- [x] Especialista nv 4: Golpe Especial + Implemento Marcial

## Especialista em Combate — Habilidades de 2º nível
- [x] Progressão geral conferida; catálogo de habilidades do Especialista criado
- [x] Arremessos Potentes (+1 nível de dano; 1 PE ignora RD = treinamento) — dano do ataque agora desconta da vida do alvo
- [x] Arsenal Cíclico
- [x] Assumir Postura — base + 8 posturas (Sol, Lua com pergunta/Andar/Desengajar, Terra, Dragão, Fortuna, Devastação, Tempestade, Céu)

## OMNI — Reações e Testes com Resistência
- [x] Ataque com arma pode pedir TR do alvo ao acertar (TR e CD configuráveis; CD vazia usa a CD de Especialização)
- [x] Reações em 15 gatilhos: entrar/sair do alcance, declarar ataque, errar, acertar, crítico, sofrer dano, causar dano, reduzido a 0 PV, derrubar inimigo, alvo/falhou/passou em TR, alvo de perícia, inimigo conjurando
- [x] Proteção a aliados e janela única de reação (efeitos de uma reação nunca abrem outra reação)
- [x] Testar no navegador com peças no mapa: dentro/fora do alcance, casos inválidos, dano + TR + condição (`python tests/browser/omni_reacoes.py` — 10 casos: dentro/fora do alcance, protegido aliado vs próprio, sem reação, PE insuficiente, dano mínimo, passar a vez, TR ramificado)
- [x] Corrigir a janela de reação, que ficava escondida sob a bandeja 3D de dados no canto inferior direito e não podia ser clicada enquanto houvesse rolagem na tela
- [x] Reações nos testes pedidos pelo Mestre: campo "Quem força o teste" (TR/perícia); testado no navegador
- [x] Texto natural: aceitar "cac"/"corpo a corpo", "aplicar condição <nome>" e dano escalado por contador
- [x] Guia OMNI: aba "Texto simples" com exemplos testados; painel abre inteiro na tela (já era redimensionável e com abas)
