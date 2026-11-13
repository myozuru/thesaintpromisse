# Sistema de design — The Saint Promisse — TP Fichas

> Este arquivo operacional complementa o DESIGN.md existente, usado como referência da identidade e das preferências visuais aprovadas. src/styles.css é a fonte dos valores e estilos implementados. Este documento organiza decisões, verificação e critérios; não abre uma segunda paleta.

## Identidade e direção artística

A direção existente é um “grimório digital para a mesa de campanha”: escura, mística e cerimonial, com superfícies em ameixa profundo, violeta para ações e seleção, dourado em acentos pontuais, tipografia serifada e painéis em camadas. A interface serve à operação de uma campanha compartilhada por Mestre e jogadores. A clareza das tarefas e dos dados tem prioridade sobre ornamento.

Preservar a identidade atual e as preferências aprovadas. Não substituir o tema por uma estética SaaS genérica, nem ampliar papel-pergaminho, brilho ou efeitos dramáticos para toda a aplicação. O brilho reforça ação, foco ou seleção. O dourado continua secundário.

## Paleta configurável

A paleta semântica implementada está em HSL nas variáveis de src/styles.css, dentro de :root e .dark. DESIGN.md documenta a direção e a função semântica existente; consulte o CSS para os valores ativos. Alterar valores implementados apenas após decisão visual aprovada e não criar uma paleta paralela neste arquivo.

- Superfícies e texto: background, foreground, card, card-foreground, popover, muted, border e input.
- Ação e foco: primary, primary-foreground e ring; accent e accent-foreground para o acento dourado.
- Recursos e estados de jogo: hp, pe, shield-color, neon-green, neon-red, neon-yellow e neon-orange.
- Casos especializados: relic, cores de dados, mapa e abertura permanecem localizados nos componentes correspondentes.

Use o token pelo papel semântico, não por semelhança de matiz. Não declare contraste AA sem medir a combinação real de texto e fundo. Cor e brilho nunca carregam estado sozinhos.

## Tipografia, hierarquia e espaçamento

- Títulos de identidade: Cinzel Decorative, com Cinzel e serif como fallback.
- Títulos de módulo e navegação: Cinzel.
- Leitura e descrição: Cormorant Garamond, Georgia e serif, peso base 500.
- Dados, tempos e rótulos técnicos: JetBrains Mono.
- Manter papéis distintos para display, título, corpo e dados; respeitar os tamanhos responsivos já implementados e evitar rótulos ilegíveis.

A escala de referência documentada usa espaçamentos de 8, 16 e 24 px e raios de 6, 8, 10 e 14 px. DESIGN.md serve como referência visual; confira a implementação atual em CSS e componentes antes de alterar ritmo ou raios. Não transformar cada distância local em token global.

## Componentes reutilizáveis e interação

DESIGN.md descreve os padrões compartilhados existentes: botões místico e dourado, botões secundários, chips, cartões, campos, navegação, cabeçalho de módulo e painel de sessão. Antes de criar outra variante ou componente, localizar e reutilizar o componente ativo existente.

Cada controle precisa de estados discerníveis: repouso, hover quando há ponteiro, foco de teclado, pressionado, selecionado, desabilitado, carregando e erro/sucesso quando aplicável. Foco deve permanecer visível. Em controles escondidos ou recolhidos, remover também semântica e parada de teclado; opacidade zero, altura zero ou recorte visual sozinhos não bastam.

## Movimento e feedback visual

src/styles.css já contém animações de abertura, swirl, brilho, entrada e estados de conquista, além de regras para prefers-reduced-motion. As regras específicas da splash e da autenticação não são uma duração global: por exemplo, ações da autenticação usam 160 ms, linhas de formulário 220 ms e a abertura tem animações entre 420 e 820 ms.

Usar movimento quando explicar transição de estado ou resposta a uma ação. Preferir transform e opacity para microinterações; reservar pulsação contínua e cintilação para casos intencionais e aprovados. Respeitar prefers-reduced-motion, removendo movimento decorativo e mantendo feedback imediato e compreensível. Não reduzir todo movimento a tempos imperceptíveis.

## Responsividade e acessibilidade

O layout compartilhado documentado em DESIGN.md inclui barra superior de 56 px, navegação de módulos com rolagem horizontal e painel de sessão que pode ter 256 px, recolher para 40 px ou virar painel sobreposto em telas estreitas. Layouts específicos variam por módulo; confirmar no código e no Portal do alvo real antes de afirmar comportamento geral.

Para cada mudança visual relevante, capturar e inspecionar 1440×900, 1024×768 e 390×844 CSS px, mais qualquer viewport limítrofe afetado. Confirmar conteúdo visível, ausência de overflow indevido, rolagem, hierarquia, tamanho de texto, foco e alvos de toque. A viewport emulada valida layout, mas não prova gesto físico.

Critérios mínimos de acessibilidade:
- Usar elementos semânticos, rótulos vinculados aos campos, mensagens de erro identificáveis e nomes acessíveis para controles com ícone.
- Percorrer com teclado, conferir ordem, operação e indicador de foco; controles recolhidos não podem receber foco invisível.
- Não comunicar estado apenas por cor, glow, posição ou animação.
- Medir contraste de texto e controles quando houver mudança de tokens; registrar combinações e resultado em vez de presumir conformidade.
- Exercitar reduced-motion e ampliação de texto quando o componente depende de dimensões ou transições.

## Referências e limites da evidência

Fontes do projeto ativo:
- DESIGN.md — referência da direção artística aprovada e dos padrões de tipografia, layout e componentes; não editar sem autorização explícita.
- src/styles.css — fonte atual dos tokens HSL implementados, declarações de fontes, sombras, animações, hover e reduced-motion.
- src/components/AuthScreen.tsx — tela pública de acesso/criação.
- PRODUCT.md — usuários, uso e limites do produto.
- AGENTS.md — arquitetura e proteção de comportamento.

Em 2026-10-19, o Portal Maestri The Saint Promisse mostrou somente a autenticação pública. A tela foi capturada em desktop, tablet e celular; ela não comprova as telas autenticadas do Mestre ou do jogador. Os arquivos e métricas dessa inspeção estão em 14 - Operacao/Tarefas/TAREFA-024/evidencias e AUDITORIA.md. Não extrapolar o resultado para outros módulos.

## Critérios de aceitação visual

Uma entrega de interface só recebe aprovação quando todos os pontos aplicáveis tiverem evidência:

1. A identidade usa tokens e padrões existentes; não introduz um tema concorrente nem muda regras, stores, contratos, fichas ou dados da campanha.
2. A tela renderizada foi aberta no Portal para a URL/versão correta e observada nos viewports aplicáveis. Registrar URL, viewport, autenticação e limites.
3. Capturas mostram as regiões relevantes; uma inspeção da imagem confirma alinhamento, espaçamento, hierarquia, legibilidade e ausência de sobreposição/corte.
4. O fluxo e os controles alterados foram exercitados com mouse e teclado; estados, foco, mensagens e rolagem correspondem ao comportamento esperado.
5. A11y, console e problemas de layout foram revisados. Registrar problemas por gravidade, região, impacto, evidência e próximo passo. Não chamar uma tela inacessível de aprovada só porque compila.
6. Um agente diferente do implementador faz a auditoria independente. Correções voltam ao Portal e são verificadas de novo; executar no máximo três rodadas de refinamento por entrega.
7. STATUS.txt, HANDOFF.txt, CONTEXTO.json, auditoria e capturas ficam no diretório da tarefa. Nenhum defeito P0/P1 conhecido da interface alterada permanece; se persistir, registrar bloqueio e não aprovar essa interface.

O protocolo reutilizável, a equipe, as notas e os Portais estão descritos em 14 - Operacao/Partituras/Maestri Visual Studio.md e na nota Maestri Visual Studio — Partitura no canvas.
## Integridade das capturas

Após cada screenshot, comparar as dimensões reais do PNG com o viewport CSS informado pelo Portal. Em 2026-10-19, os três PNGs retornados pelo Portal ficaram 204 px mais baixos que a altura solicitada e cortaram o topo; esses arquivos são evidência parcial. Quando isso ocorrer, registrar a diferença e obter captura completa por método alternativo antes da aprovação visual. Métricas DOM e árvore acessível complementam a imagem, mas não substituem a captura completa.
