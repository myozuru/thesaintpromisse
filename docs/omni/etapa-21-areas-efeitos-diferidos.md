# Etapa 21 — áreas e efeitos diferidos

## Corrigido

- Áreas persistentes de feitiços agora usam `applyOnEnter` em movimentos confirmados. O motor avalia os pontos da trajetória e não dispara durante prévias/cancelamentos.
- A oferta de TR guarda movimento e turno processados, evitando repetir a mesma resolução quando a confirmação chega por mais de um transporte ou quando o motor repete o mesmo tick.
- “Aceitar efeito sem rolar” resolve como falha de TR e aplica dano/condição; antes, o botão apenas fechava o aviso.
- `uma_vez` registra também uma falha: não oferece uma nova rolagem em cada turno e continua aplicando o efeito enquanto a criatura permanece exposta. `todo_round` registra falha na rodada para evitar múltiplos TRs na mesma rodada; sucesso mantém imunidade até a próxima.
- Condições de uma zona compartilham uma identidade de fonte estável por zona e alvo, evitando que cada aplicação gere uma condição duplicada.
- Ao avançar o turno, cada template persistente é salvo individualmente, incluindo duração e estado de alvos afetados.

## Validação

- `omniEspacialAuditoria.test.tsx`: inclui entrada em zona persistente e deduplicação do movimento confirmado.
- `omniEspacialAuditoria.test.tsx`, `zonasTerreno.test.ts`, `conditionStacking.test.ts` e `reactionBudget.test.ts`: 49 testes passaram.
- `tsc --noEmit` e `git diff --check` passaram.

## Limites observados

O dano dos ticks e dos efeitos residuais continua usando valor médio dos dados, como já fazia o motor. A entrada em zonas persistentes dispara apenas por movimento confirmado com ficha vinculada ao token; entidades sem vínculo de ficha não podem receber TR/dano no modelo atual.
