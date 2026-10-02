# Primitivas genéricas do OMNI — novo ciclo

Este ciclo sucede a auditoria das keys. Cada categoria é uma entrega independente diretamente na `main`.

| Etapa | Categoria | Situação |
| --- | --- | --- |
| 1 | Alvos e áreas | Implementada nas ações ativas, editor e painel de uso |
| 2 | Condicionais dinâmicas | Pendente: idade de condição, modificadores condicionais de crítico, dano e TR |
| 3 | Movimento | Puxar/empurrar já existem; pendem obstáculos, avanço, teleporte, troca e distância por fórmula |
| 4 | Custos flexíveis | Fórmula de PE e consumo total já existem; pendem intensificação, consumo parcial, PV e sustentação |
| 5 | Reações interrompíveis | Há infraestrutura de eventos e prompts; falta unificar os gatilhos propostos e sua janela de interrupção |
| 6 | Graus de TR | Sucesso/falha e metade já existem; pendem falha crítica e desfechos configuráveis |

## Contrato da etapa 1

Os campos são opcionais em `AcaoAtivaConfig`. Itens antigos mantêm alvo único diferente do usuário, sem migração destrutiva.

| Campo | Valores / significado |
| --- | --- |
| `tipo_alvo` | `unico`, `multiplo`, `area`, `proprio` |
| `filtro_alvo` | `inimigos`, `aliados`, `todos`, `todos_exceto_si` |
| `max_alvos` | Fórmula inteira arredondada para baixo, por exemplo `3` ou `@USUARIO.treino`; padrão 1 |
| `area.forma` | `cone`, `linha`, `raio_em_si`, `raio_no_ponto` |
| `area.tamanho_m` | Raio para círculos; comprimento para cones e linhas |
| `area.largura_m` | Largura da linha, padrão 1,5 m |
| `alcanceM` | Nos alvos pontuais, distância de toque da grade; no raio no ponto, distância do centro do usuário até o centro da área; 0 = livre |

Cones e linhas ficam ancorados no usuário e permitem escolher a direção no seletor existente do mapa. O raio em si é automático. O raio no ponto permite escolher um ponto livre no mapa. As entidades tocadas pelo template são calculadas pela mesma geometria usada por armas e feitiços. Tokens ocultos e camadas que não são de tokens são ignorados; fichas com tokens duplicados são atingidas uma vez.

Os lados explícitos da iniciativa prevalecem: `pc` e `ally` pertencem ao mesmo grupo, `enemy` ao grupo inimigo e `neutral` é neutro. Sem marcação, `PLAYER` é do grupo, `INIMIGO` é inimigo e `NPC` é neutro. A relação é relativa ao usuário, inclusive quando ele é inimigo. Neutros entram em `todos` e `todos_exceto_si`, mas não se tornam aliados ou inimigos por suposição. O próprio usuário entra em `aliados` e `todos`; filtros contraditórios com `proprio` impedem o uso. Sem filtro, o padrão é `todos_exceto_si`, exceto para `proprio`, cujo padrão é `todos`.

Toda a seleção é validada antes de pagar PE, ação e contador. Custos e cargas são pagos **uma vez por uso**, mesmo com múltiplos alvos. TR, ataque, crítico, dano e efeitos secundários são resolvidos separadamente por alvo, preservando a mitigação de `applyDamage` e os metadados de origem OMNI. Um ataque que erra não encerra a resolução dos outros alvos. `ResultadoAtiva.dano` soma os danos solicitados antes da mitigação, mantendo a semântica anterior para um único alvo.

Cancelar o posicionamento, escolher uma área vazia, extrapolar o número de alvos ou incluir um alvo inválido não gasta recursos. Nas novas ações pontuais com alcance limitado, usuário e alvo precisam estar no mapa; o comportamento permissivo das configurações legadas fora do mapa permanece. A seleção espacial não implementa ainda bloqueio por paredes ou linha de visão. Esta etapa adiciona seleção para efeitos existentes; cura por ação ativa e zonas persistentes não fazem parte desta entrega.

Exemplos de configuração:

```json
{ "tipo_alvo": "area", "filtro_alvo": "inimigos", "area": { "forma": "cone", "tamanho_m": 6 } }
{ "tipo_alvo": "area", "filtro_alvo": "aliados", "area": { "forma": "raio_em_si", "tamanho_m": 4.5 } }
{ "tipo_alvo": "multiplo", "filtro_alvo": "inimigos", "max_alvos": "3", "alcanceM": 18 }
```

## Cuidado para a etapa 2

A key existente `condicao_rodadas_<id>` representa **duração restante**, não rodadas transcorridas desde a aplicação. Condições indefinidas usam um sentinela. A idade deverá ser registrada e consultada separadamente, sem reinterpretar a key antiga nem inventar idade para condições já salvas sem esse histórico.
