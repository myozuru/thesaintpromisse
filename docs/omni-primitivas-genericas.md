# Primitivas genéricas do OMNI — novo ciclo

Este ciclo sucede a auditoria das keys. Cada categoria é uma entrega independente diretamente na `main`.

| Etapa | Categoria | Situação |
| --- | --- | --- |
| 1 | Alvos e áreas | Implementada nas ações ativas, editor e painel de uso |
| 2 | Condicionais dinâmicas | Implementada: checagens de usuário/alvo, idade de condição, crítico, dano extra, vantagem e TR |
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

## Contrato da etapa 2

As ações têm `condicionais?: ModificadorCondicionalAtivo[]`. Cada bloco possui `se_alvo` e/ou `se_usuario`, listas de predicados. Todas as checagens das duas listas precisam passar (AND). Blocos distintos são avaliados independentemente; seus efeitos numéricos somam e as vantagens/desvantagens não se empilham em mais dados. Um bloco sem checagens é ignorado.

| Predicado (`tipo`) | Parâmetros | Semântica |
| --- | --- | --- |
| `tem_condicao` | `nome` | Nome ou ID da condição, ignorando caixa e acentos |
| `rodadas_condicao` | `nome`, `operador`, `valor` | Rodadas completas decorridas; usa a maior idade conhecida entre instâncias ativas da condição |
| `distancia` | `operador`, `valor` | Distância entre sujeito e outro participante em metros, segundo a mesma regra de grade usada pelos alvos; sem peças válidas, não passa |
| `pv_percentual` | `operador`, `valor` | PV atuais / PV máximos × 100, limitado a 0–100; exclui PV temporários; ficha sem PV válidos não passa |
| `cargas` | `nome`, `operador`, `valor` | Contador do sujeito; nome normalizado como nos custos e contador ausente vale zero |

Comparadores: `<`, `<=`, `==`, `!=`, `>=`, `>`. Valores desconhecidos não passam em nenhum comparador, inclusive `!=`. Esta API é estruturada e editável no construtor; não introduz funções de texto como `tem_condicao(...)` no parser de fórmulas.

| Efeito do bloco | Semântica |
| --- | --- |
| `margem_critico_mod` | Delta na margem do d20; −2 facilita o crítico. Soma à configuração legada de margem |
| `multiplicador_critico_mod` | Delta sobre x2; +1 resulta em x3. Multiplicador mínimo x1, somente em críticos e sobre dados da arma, da ação, por cargas e extras; modificadores fixos não multiplicam. A propriedade Mortal continua adicionando seu dado uma única vez e Fatal continua ajustando a face |
| `dano_extra` | Dados/fixo no formato existente, por exemplo `2d6` ou `1d8+2`; só gera dano quando o ataque acerta, ou segue o desfecho do TR |
| `mod_tr_alvo` | Delta numérico no TR, por exemplo −2 |
| `desvantagem_tr_alvo` | Desvantagem apenas nesse TR; cancela vantagens OMNI presentes, sem deixar flags para o próximo teste |
| `vantagem_acerto` | Vantagem apenas nesse ataque, combinada com o motor existente |

Checagens são avaliadas para cada alvo **antes de pagar os custos** e preservadas durante a execução daquele uso. Isso permite exigir cargas que a própria ação consumirá. Alterações no estado de um alvo não fazem outros alvos herdarem seus bônus. Os efeitos de TR também consomem vantagens/desvantagens e bônus fixos já concedidos para aquele teste, pelos helpers existentes.

O schema de importação JSON valida e preserva as ações ativas, incluindo alvos, áreas, condicionais e campos legados. A exportação e reimportação são cobertas por teste no store real.

### Idade de condições e compatibilidade

`addCondition` marca uma nova instância com `elapsedRounds: 0`. O tick de rodada completa incrementa esse campo junto ao tick de duração. O tick de turno não aumenta a idade. Remover e aplicar novamente cria uma instância com idade zero. Condições já salvas sem idade continuam sem idade; o sistema não a deduz da duração restante. Condições geradas diretamente como estado derivado também não ganham idade presumida.

A key existente `condicao_rodadas_<id>` continua representando **duração restante**, incluindo o sentinela 999 para duração indefinida. As novas keys, disponíveis no catálogo e nas fórmulas de USUARIO e ALVO, são:

- `condicao_idade_rodadas_<id>`: idade conhecida, ou −1 se ausente/desconhecida.
- `condicao_idade_conhecida_<id>`: 1 se há idade registrada, 0 caso contrário.

Nas fórmulas manuais com comparações como `< 3` ou `!= 3`, verifique também `condicao_idade_conhecida_<id>` para não tratar −1 como uma idade válida. As checagens estruturadas já fazem esse controle automaticamente.

Exemplo: margem −2 se o alvo está Condenado há três rodadas:

```json
{
  "id": "bonus-condicional",
  "se_alvo": [{ "tipo": "rodadas_condicao", "nome": "Condenado", "operador": ">=", "valor": 3 }],
  "margem_critico_mod": -2
}
```
