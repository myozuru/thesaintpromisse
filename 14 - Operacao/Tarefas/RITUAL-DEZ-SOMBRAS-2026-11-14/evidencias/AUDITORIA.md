# Auditoria — Rituais das Dez Sombras

## Ambiente

- Branch: `feature/ritual-dez-sombras`, base `c015c26`.
- Preview offline: `http://127.0.0.1:5183/`.
- Servidor iniciado por `launch-preview-offline.mjs`; Supabase não configurado, dados de QA ficaram no navegador local.
- Portal Maestri: `Dez Sombras QA`.
- Detector Impeccable executado uma vez nos componentes de UI e CSS alterados.

## Fluxos verificados

- Player vê as abas Minhas invocações, Rituais e Criar ou editar. Não vê a aba Catálogo nem texto que mencione Catálogo.
- Player solicitou o ritual do Abismo; o pedido persistiu para o Mestre.
- Mestre iniciou resolução manual de Gama e concluiu a vitória. `domado` foi atualizado sem mudar o estado de aprovação.
- Para o Abismo, Gama não domado bloqueou a ação e anunciou requisitos pendentes. Após restaurar Gama como domado, Gama e Nue apareceram como requisitos satisfeitos e a ação liberou.
- Player solicitou o Abismo; Mestre resolveu manualmente e a forma ficou domada, mantendo `aprovacaoMestre: pendente`.
- Orochi foi preparado no mapa. O adversário apareceu com PV máximo, nome/Defesa e entrada de iniciativa vinculada. Registrar falha preservou `domado: false` e removeu apenas entidade/entrada daquele ritual.
- Elefante Máximo foi preparado no mapa e cancelado. `domado` continuou falso; entidade e entrada de iniciativa foram removidas.
- Nue foi preparado no mapa, teve vitória registrada e foi liberado. A trilha também conserva um cancelamento anterior.
- A fixture não usou servidor ou personagens de produção.

## Acessibilidade e responsividade

- Nav mobile: três abas Player e quatro abas Mestre permanecem legíveis em duas colunas; `overflow-wrap` evita corte.
- Player 390 px: a descrição não menciona Catálogo. Em 1024 px e desktop, cartões fluem em duas/três colunas sem overflow horizontal.
- Tab percorreu `Minhas invocações` → `Rituais` → `Criar ou editar`; botões nativos continuam operáveis por teclado.
- `prefers-reduced-motion: reduce` retornou `true` no Portal; as transições de aba usam `useReducedMotion`.
- No fim da lista móvel, o padding inferior de 72 px mais safe area mantém a última ação acima dos controles flutuantes.
- Logs de console do Portal: vazios na rodada final.

## Capturas

| Arquivo | Dimensão PNG | Viewport configurado no Portal |
|---|---:|---:|
| `rituais-desktop-1440x900.png` | 1440×900 | 1440×908 |
| `rituais-tablet-1024x768.png` | 1024×768 | 1024×776 |
| `rituais-player-mobile-390x844.png` | 390×844 | 390×852 |
| `rituais-player-mobile-bottom-390x844.png` | 390×844 | 390×852 |
| `mapa-desktop-1440x900.png` | 1440×900 | 1440×908 |

O screenshot do Portal saiu 8 px menor do que o viewport informado. A altura foi compensada em 8 px nas capturas; as dimensões de cada PNG foram conferidas pelo cabeçalho do arquivo. A captura mobile adicional registra o fim da lista após rolagem.

## Ferramentas de validação

- `rtk tsc --noEmit`: sem erros.
- `rtk npm run build`: sucesso. Permanecem warnings do bundler sobre imports dinâmicos ineficazes e tempo de plugins.
- `rtk git diff --check`: sem problemas.
- Testes automatizados: não executados, conforme instrução do projeto.

## Revisão independente

Claude Opus revisou arquitetura e correções finais em modo somente leitura; não encontrou achados P0–P2. Confirmou o listener de `app:navigate` em `src/pages/Index.tsx` e aprovou a margem inferior mobile.

O detector Impeccable apontou a cor literal do token temporário; ela foi substituída pela cor semântica `--primary`. Alertas de borda lateral no mesmo arquivo CSS são estilos de outras seções preexistentes; não pertencem à interface Rituais.
