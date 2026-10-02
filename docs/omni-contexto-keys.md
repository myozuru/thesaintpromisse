# Keys de contexto do Omni

As fórmulas aceitam `@DANO`, `@ACAO`, `@TESTE` e `@EFEITO` além dos escopos de ficha, cena e item. Cada contexto pertence ao evento atual. Uma key conhecida sem contexto produz um aviso `sem_contexto`; uma referência desconhecida produz `desconhecida`. O valor numérico de fallback continua sendo zero para compatibilidade. O terminal apresenta esses avisos.

## Dano

- `@antes_sofrer_dano`: permite modificar `dano_recebido`/`dano_pendente` antes de aplicar o dano.
- `@depois_sofrer_dano`: recebe o resultado após RD, imunidade, vulnerabilidade e bloqueios, inclusive quando o dano final é zero.
- O gatilho legado `@sofrer_dano` mantém o comportamento anterior: scripts de itens são executados antes, gatilhos lógicos depois.
- `@CENA.dano` mantém o valor legado; fórmulas que precisam do dano resolvido usam `@DANO.valor_final`.

| Key | Significado |
|---|---|
| `@DANO.valor_inicial` | Dano de entrada, antes das reduções |
| `@DANO.valor_final` | Dano resolvido, incluindo o que atinge escudo/PV |
| `@DANO.absorvido` | `max(0, inicial - final)` |
| `@DANO.resolvido` | 0 antes da aplicação, 1 depois |
| `@DANO.foi_critico` / `foi_falha_critica` | Indicadores do ataque, quando fornecidos pelo chamador |
| `@DANO.foi_furtivo` / `foi_ataque_oportunidade` | Indicadores das tags `furtivo` / `ado` |
| `@DANO.alcance` | Distância de toque entre atacante e alvo no mapa, capturada para o evento; indisponível sem peças |
| `@DANO.tipo_ataque` | 1 corpo a corpo, 2 distância, 3 feitiço, 0 sem informação |
| `@DANO.id_origem` / `id_alvo` / `fonte` | Indicadores numéricos de presença de origem/alvo; os IDs reais ficam no contexto do evento |
| `@DANO.tipo` | 1 DCO, 2 DP, 3 DI, 4 DA, 5 DCG, 6 DCC, 7 DQ, 8 DS, 9 DAL, 10 DNR, 11 DE, 12 DPS, 13 DR, 14 DN, 15 DV; 0 desconhecido |

`valor_final` e `absorvido` ficam disponíveis após resolver o dano. Os observadores espaciais também recebem esse contexto. As ações lógicas de dano e os efeitos numéricos passam por `applyDamage`.

```text
@antes_sofrer_dano -> se @DANO.foi_critico igual a 1 entao reduzir 5 em dano_recebido
@depois_sofrer_dano -> somar @DANO.valor_final em contador_dano_sofrido
```

## Ação e teste

`@ACAO.eh_ataque`, `eh_feitico`, `eh_cac`, `eh_distancia` e `eh_segunda_arma` descrevem a ação realmente usada. Os ataques com alvo identificado do motor de combate publicam `aoResolverTeste` e o evento de acerto/erro. Rerolagens auxiliares sem alvo identificado somente retornam o contexto, para evitar novas ativações de gatilhos.

`@TESTE.valor_natural`, `total`, `dt`, `sucesso`, `margem` e `eh_tr` estão disponíveis no resultado do ataque e no TR das ações ativas Omni. `margem = total - dt`; `sucesso` considera as regras de acerto/crítico do motor. No TR, o `USUARIO` do evento é quem rolou a resistência; o `ALVO` é o autor da ação.

```text
@resolver_teste -> se @TESTE.sucesso igual a 0 entao somar 1 em contador_testes_falhos
```

`@USUARIO.falhas_morte` lê `deathFails`; `limite_falhas_morte` expõe o limite atual de 3. Também funcionam em `@ALVO`. A entrada/saída do estado de morrendo mantém as regras e o reset existentes.

## Efeitos ativos

Nos gatilhos de uma entidade com instâncias no runtime:

- `@EFEITO.pilhas`: quantidade de instâncias ativas dessa entidade no portador do evento; usa o alvo quando não há instâncias no portador.
- `@EFEITO.pilhas_do_usuario`: instâncias desse grupo aplicadas pelo `USUARIO`.
- `@EFEITO.aplicado_por_usuario`: 1 quando pelo menos uma instância do grupo veio do `USUARIO`.
- `@EFEITO.duracao_restante`: maior duração restante do grupo, em segundos; -1 para permanente/até dissipar.
- `@EFEITO.permanente`: 1 quando alguma instância do grupo é permanente.

Consultas de ficha: `qtd_efeitos_ativos`, `efeito_pilhas_<id>` e `efeito_duracao_<id>`. Instâncias expiradas ficam fora das consultas, mesmo antes da poda do runtime. As pilhas contam instâncias do runtime existente.

## Cooldowns e usos

O editor de ações Omni permite definir `cooldownTurnos`. A execução bem-sucedida paga o custo e registra o intervalo por ficha/ID da ação, inclusive quando o teste erra. A tentativa durante o intervalo é bloqueada antes de gastar recursos. `tickBuffs` decrementa o intervalo a cada turno do portador; os resets de descanso existentes também o limpam.

- `@USUARIO.cooldown_<id>`: turnos restantes de feitiço ou ação Omni; 0 quando disponível.
- `@ITEM.cooldown_restante`: maior intervalo das ações desse item. Cópias com o mesmo ID de ação compartilham o intervalo do portador.
- `@USUARIO.usos_habilidade_<id>` / `usos_habilidade_max_<id>`: restante e máximo efetivo das habilidades de especialização adquiridas com limite de usos, conforme o catálogo e `specAbilityUsage`.

Nas keys dinâmicas, normalize o ID: hífens viram underscores, acentos são removidos. Ex.: `lut-puxar-um-ar` → `@USUARIO.usos_habilidade_lut_puxar_um_ar`.

Os pacotes importados preservam as ações e seus cooldowns. `cooldownTurnos` aceita inteiros não negativos.
