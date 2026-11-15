# QA e adjudicação das revisões — HUD Dez Sombras

Data: 2026-11-15  
Branch: `feature/dez-sombras-hud-mapa`, base `bb6f36a`  
Método visual: Playwright headless sobre harness sintético; não alterou campanhas nem dados de jogadores.

## Capturas completas

| Arquivo | Viewport real | Estado |
|---|---:|---|
| `desktop-invocar.png` | 1440×900 | HUD / Invocar |
| `desktop-em-campo.png` | 1440×900 | HUD / Em campo |
| `desktop-rituais.png` | 1440×900 | HUD / Rituais |
| `tablet-master-rituais.png` | 1024×768 | HUD Mestre / Rituais; layout intermediário |
| `mobile-player-hud-actionbar.png` | 390×844 | HUD Player junto da barra de ações |
| `mobile-player-rituais.png` | 390×844 | HUD Player / Rituais |

Resultados registrados: sem erros de console, sem overflow horizontal, HUD fecha com Escape, respeita `prefers-reduced-motion`. Em mobile, a altura real do PlayerActionBar é observada com ResizeObserver; a folga medida entre barra e HUD é 12px.

## Testes e código

- `npm run test:dez-sombras`: 217 testes em 9 suítes aprovados.
- Testes focados de HUD/rituais/combate/itens: 51 testes em 10 suítes aprovados.
- Build de produção: aprovado.
- `npx tsc --noEmit`: aprovado.
- Testes específicos do HUD/ritual também devem ser executados antes do commit final.

## Revalidação da revisão combinada e revisão final

- Vínculos de ritual no mapa (`ownerCharId`, invocação/instância e iniciativa), limpeza da entidade e vínculo de `combateId` já estão presentes.
- A troca do token pela lista do HUD sincroniza a origem; mensagens `masterControlled` são distintas para Player e Mestre.
- A folga mobile é variável dinâmica, não `58px` fixos.
- 1024×768 usa layout intermediário de 761–1100px, usável; o HUD está dentro de `[data-map-viewport]`, portanto `top/left` não colidem com MapTopBar ou ToolRail.
- Captura de pointer no painel impede pan sob controles interativos por decisão de UX; não foi reproduzido como defeito.
- `jogadorBloqueadoPorControleMestre` mantém tokens temporários de ritual sob autoridade do Mestre; a revisão combinada classificou esse comportamento como falso positivo fora do combate.
- Revisão independente do Claude refez a classificação após examinar o código customizado de Aetheris e Lança; não há P0 de runtime no HUD. O parecer está em `../../FERRAMENTAS-AMALDICOADAS-OMNI-2026-11-15/revisoes/OMNI_CURSED_TOOLS_HUD_REVIEW_2026-11-15.md`; a versão combinada original está em `revisoes/`.

## Capturas antigas de portal

Arquivos em `parciais/` têm altura menor que o viewport nominal: desktop 1440×892, tablet 1024×760 e mobile 390×836. Foram preservados como histórico, mas não servem como prova de viewport completo.
