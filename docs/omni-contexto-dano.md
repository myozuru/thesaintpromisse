# Contexto de dano do Omni

`applyDamage` fornece um snapshot numérico do golpe às fórmulas `@DANO.*`.
Os valores são locais a cada resolução, inclusive quando vários golpes chegam
antes dos callbacks dos eventos. Não são flags persistentes da ficha.

| Chave | Valor |
| --- | --- |
| `@DANO.valor_inicial` | Dano recebido por esta chamada de `applyDamage`, limitado a pelo menos zero, antes do pre-hook e da mitigação. |
| `@DANO.valor_final` | Dano resolvido após pre-hook, RD, imunidade e vulnerabilidade. Inclui dano absorvido pelos PVT e, no CAM, dano à alma. |
| `@DANO.absorvido` | `max(0, valor_inicial - valor_final)`. Inclui reduções do pre-hook e imunidade; não mede somente RD. Vulnerabilidade pode tornar o final maior que o inicial, deixando absorvido em zero. |
| `@DANO.id_origem` | 1 quando o golpe informa `attackerId`; 0 quando não informa. É indicador de presença, não ID textual. |
| `@DANO.id_alvo` | 1 quando a ficha alvo existe; 0 caso contrário. É indicador de presença, não ID textual. |

Os scripts de itens/passivas em `aoSofrerDano` rodam **antes** da mitigação
para poderem alterar `dano_recebido`. Nesse pre-hook, apenas `valor_inicial`
e os indicadores de origem/alvo estão disponíveis. `valor_final` e
`absorvido` ainda não existem: consultar esses campos produz o diagnóstico
de chave ausente do avaliador, com seu fallback numérico zero.

Depois da resolução, o snapshot completo chega aos blocos lógicos de
`aoSofrerDano`, aos blocos e scripts de `aoCausarDano`, aos eventos de morte
por dano e aos respectivos observadores. O observador recebe o mesmo golpe,
mesmo que seus papéis `USUARIO` e `ALVO` sejam diferentes. Os scripts reativos
do alvo não são executados novamente após o golpe.

`@CENA.dano` mantém seu significado anterior, com o valor anterior à RD
(após eventual redução do pre-hook). Use `@DANO.valor_final` para calcular
cargas com o dano resolvido. Somar zero a um contador agora soma zero;
o incremento padrão de uma ação lógica sem valor explícito continua em 1.

Bloqueio total e anulação no pre-hook mantêm o retorno antecipado existente:
não criam eventos posteriores de dano. Quando a RD ou imunidade reduzem um
golpe a zero durante a resolução normal, os eventos existentes recebem
`valor_final = 0`.

Uma reação que reaplica dano por outra chamada de `applyDamage` inicia sua
própria resolução; `valor_inicial` descreve essa chamada, não uma rolagem
original que o motor não tenha preservado.

## Metadados de ataques

`applyDamage` aceita `opts.attack` com campos opcionais `critical`,
`criticalFail`, `isSneak`, `isOpportunity` e `kind` (`melee`, `ranged`,
`cursed`). Somente os campos informados viram keys: desconhecido continua
ausente, enquanto `false` informado vira zero válido.

| Chave | Valor |
| --- | --- |
| `@DANO.foi_critico` | 1/0 do resultado crítico informado pelo produtor. |
| `@DANO.foi_falha_critica` | 1/0 do resultado de falha crítica informado. Um ataque que erra não cria evento de dano. |
| `@DANO.foi_furtivo` | 1/0 da informação de furtividade preservada pelo produtor. |
| `@DANO.foi_ataque_oportunidade` | 1/0 da marcação do golpe como AdO. Ter uma concessão na store não implica ter executado AdO. |
| `@DANO.tipo_ataque` | 1=CaC, 2=distância, 3=amaldiçoado. `attack.kind` prevalece sobre `isMelee`; sem ambos, fica ausente. |
| `@DANO.alcance` | Distância real entre as peças no início da resolução, em metros, seguindo a mesma regra de alcance do motor. Sem peças, fica ausente. |

O painel principal preserva `escondidoDe` antes de revelar o atacante e
preserva a marcação **Ataque de oportunidade** antes de rolar. A marcação
vale para uma tentativa e é desativada ao iniciar a rolagem; não concede
nem consome permissões/reação. A resolução das AdOs continua manual, como
no fluxo existente. Furtividade aqui significa a ocultação relativa do
sistema `escondidoDe`, não qualquer condição Desprevenido.

Crítico/falha crítica vêm do resultado efetivo do motor, incluindo o
crítico automático. Golpe Amplo, ataques extras, Arremesso Ágil, Disparos
Sincronizados e a diferença do reroll de dano também informam o resultado.
No dano combinado de Disparos Sincronizados, crítico significa que ao menos
um tiro foi crítico; isso não altera os cálculos do dano combinado.

Esses metadados chegam tanto ao pre-hook quanto aos eventos posteriores e
aos observadores, usando a mesma propagação da etapa de valores de dano.
O alcance não é recalculado depois do pre-hook ou nos callbacks assíncronos.
Chamadas antigas sem metadados continuam funcionando; não ganham flags
fictícias. Reações que repassam `opts` preservam os metadados; caminhos que
reconstroem opções ainda podem perdê-los.

Ainda pendentes: definir a representação numérica de `tipo` e `fonte` e
integrar produtores de feitiços/ações Omni e caminhos que não informam
metadados de ataque. O campo `kind: cursed` é aceito, mas a classificação
automática dos produtores de feitiços fica para a próxima etapa.
