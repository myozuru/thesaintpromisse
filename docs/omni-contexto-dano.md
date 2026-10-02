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

Ainda pendentes de integração com os produtores de ataques: `tipo`, `fonte`,
`foi_critico`, `foi_falha_critica`, `alcance`, `foi_ataque_oportunidade`,
`foi_furtivo` e `tipo_ataque`. Esta etapa não fornece valores inventados
para esses metadados.
