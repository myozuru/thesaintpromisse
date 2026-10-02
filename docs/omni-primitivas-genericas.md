# Primitivas genéricas do OMNI — novo ciclo

Este ciclo sucede a auditoria das keys. Cada categoria é uma entrega independente diretamente na `main`.

| Etapa | Categoria | Situação |
| --- | --- | --- |
| 1 | Alvos e áreas | Implementada nas ações ativas, editor e painel de uso |
| 2 | Condicionais dinâmicas | Implementada: checagens de usuário/alvo, idade de condição, crítico, dano extra, vantagem e TR |
| 3 | Movimento | Implementada: puxar, empurrar, avançar, teleportar e trocar; fórmulas, obstáculos e destinos válidos |
| 4 | Custos flexíveis | Implementada: intensificação com teto, consumo parcial/total, PV, tipo de ação e manutenção de condições por turno |
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

## Contrato da etapa 3

O novo efeito secundário `tipo: "movimento"` usa os campos abaixo. Efeitos legados `{tipo: "puxar" | "empurrar", metros: N}` continuam funcionando e são preservados no JSON; editar sua distância no construtor converte explicitamente para o formato genérico.

| Campo | Significado |
| --- | --- |
| `movimento_tipo` | `puxar`, `empurrar`, `avancar_ate`, `teleporte`, `trocar_posicao` |
| `movimento_distancia` | Metros como string numérica ou fórmula, por exemplo `4.5` ou `3 * @USUARIO.foco`; não usar sufixo textual `m`; dados aleatórios, negativos, infinito e keys sem valor são rejeitados |
| `movimento_alvo` | Para teleporte: `usuario` (padrão) ou `alvo`. Puxar/empurrar sempre movem o alvo; avanço sempre move o usuário; troca envolve os dois |

As fórmulas usam USUARIO/ALVO e são avaliadas antes de consumir cargas e PE. Distâncias seguem a grade Chebyshev (diagonal conta como uma casa). Puxar, empurrar e avanço usam casas completas, arredondando a distância máxima para baixo; o contato com obstáculos e a adjacência podem gerar deslocamento parcial. Nenhum modo consome o orçamento de movimento comum.

| Modo | Comportamento |
| --- | --- |
| `puxar` | Linha reta em direção ao usuário, até a adjacência (considera tamanho das duas peças) ou o primeiro obstáculo |
| `empurrar` | Linha reta para longe do usuário, até o limite ou primeiro obstáculo |
| `avancar_ate` | Usuário aproxima-se do alvo até uma posição adjacente; se o limite ou obstáculo impedir, o avanço é parcial |
| `teleporte` | Jogador escolhe um ponto no mapa antes dos custos. Valida alcance a partir da peça movida e o espaço ocupado pelo token e sua carga; atravessa o trajeto instantaneamente sem AdO |
| `trocar_posicao` | Troca os centros das duas peças em um único `updateEntities`, desde que ambas caibam nos destinos e a separação seja menor ou igual ao limite; ignora obstáculos entre os pontos, como um reposicionamento instantâneo sem AdO |

### Colisão e aplicação

A geometria usada anteriormente dentro de `MapaModule` foi extraída para `src/lib/mapCollision.ts`, mantendo as funções existentes do arraste. O executor OMNI reutiliza as mesmas footprints retangulares/elípticas, com rotação e tamanho, e os mesmos segmentos de parede/fog. As regras existentes de segmentos se mantêm: portas abertas deixam passar (inclusive aberturas em paredes), portas fechadas bloqueiam; janelas não bloqueiam, terreno segue o bloqueio de visão usado pelo arraste. Peças da camada tokens também bloqueiam o reposicionamento, inclusive ocultas. Contato de bordas entre peças é permitido; sobreposição não. O teste de ocupação de elipses usa o contorno poligonal de 24 segmentos do motor do mapa.

Movimentos forçados param no primeiro contato, sem deslizar ao longo da parede. Teleporte e troca validam apenas os destinos, não o trajeto. A posição é validada antes de cobrar os custos e novamente na aplicação após as rolagens. Se outra ação ocupar o ponto durante a rolagem, o movimento é recusado e registrado no log; o restante da ação já resolvida e seus custos permanecem.

A imunidade existente a movimento forçado bloqueia puxar, empurrar, teleporte do alvo e troca involuntária. Não elimina o dano nem a condição do mesmo golpe. Avanço e teleporte do próprio usuário são voluntários. Os movimentos continuam sendo efeitos secundários: aplicados em acerto de ataque, falha de TR ou ação sem teste; não acontecem no sucesso do TR nem em ataque que erra.

Peças carregadas acompanham o portador pelas APIs existentes do mapa e têm seu espaço validado junto a ele. Uma peça que está sendo carregada deve ser solta antes de ser reposicionada independentemente. As atualizações usam `updateEntity`/`updateEntities`, preservando o caminho existente de sincronização por patches. Não iniciam o fluxo de movimento comum nem criam prompts de AdO; zonas e auras podem continuar reagindo à posição final segundo suas regras existentes.

Para integrações e testes, o quinto argumento de `executarAcaoAtiva` aceita `destinosMovimento`, com chave `"alvoId:índiceDoEfeito"` e valor `{x,y}` em coordenadas-mundo. Sem esse argumento, o jogador escolhe cada destino no seletor de mapa. Em múltiplos alvos, cada efeito é resolvido na ordem da lista por alvo; o usuário pode ser movido repetidas vezes se o efeito estiver configurado para isso.

Exemplos:

```json
{ "tipo": "movimento", "movimento_tipo": "empurrar", "movimento_distancia": "3" }
{ "tipo": "movimento", "movimento_tipo": "avancar_ate", "movimento_distancia": "6" }
{ "tipo": "movimento", "movimento_tipo": "teleporte", "movimento_distancia": "3 * @USUARIO.foco", "movimento_alvo": "usuario" }
```


## Contrato da etapa 4

`custo_recursos` é opcional. Ações sem o bloco continuam usando `custoPE`, `acao` e `consumirContador`. Não há migração automática nem regra por nome de habilidade.

| Campo de `custo_recursos` | Semântica |
| --- | --- |
| `pe_base` | Fórmula; substitui `custoPE` quando presente |
| `pe_por_intensificacao` | PE por incremento; padrão 0 |
| `max_intensificacoes` | Teto de incrementos, fórmula como `4` ou `@USUARIO.treino`; padrão 0 |
| `limite_pe` | Teto opcional do PE total, como `@USUARIO.treino`; o limite de treinamento precisa ser configurado explicitamente |
| `dano_por_intensificacao` | Dados e/ou inteiros por incremento, como `1d6+2`; dados também recebem o multiplicador de crítico, fixos não |
| `gastar_cargas` | `{nome, quantidade: "todas" ou fórmula, minimo?: N}`; substitui o contador legado quando presente, preservando os saldos por fonte |
| `custo_pv` | PV reais sacrificados, sem mitigação ou absorção por escudo; deve deixar ao menos 1 PV |
| `tipo_acao` | `comum`, `bonus`, `reacao`, `livre` ou `sustentada`; padrão `acao` legado |
| `pe_por_turno` | Fórmula de manutenção para `sustentada`; exige custo positivo |

As novas fórmulas usam USUARIO antes dos pagamentos, rejeitam keys desconhecidas, valores negativos/não finitos e dados aleatórios. Valores fracionários arredondam para cima. A intensificação escolhida pelo jogador é inteira, entre zero e o teto. O painel mostra o total antes de usar e permite alterar a intensidade por ação/instância. Integrações podem passar `{intensificacoes: N}` no quinto argumento de `executarAcaoAtiva`, junto das opções de movimento.

PE temporários são gastos primeiro. PE, PV, cargas e orçamento de ação são validados antes de qualquer pagamento e revalidados depois da seleção de destinos. Custos são pagos uma vez para a ação inteira, mesmo com vários alvos; erros e sucessos em TR não devolvem recursos. `dadosPorCarga` usa exatamente a quantidade consumida. Quantidade específica zero nunca significa consumir todas: é rejeitada.

`mod_acerto` é um modificador numérico opcional da ação, somado pelo motor de ataque apenas naquela execução. Permite gastar uma carga por ataque para obter +2 no acerto sem deixar um bônus na ficha para ataques futuros.

### Sustentação

O modo `sustentada` mantém **condições aplicadas pela própria ação**. A ação inicial usa o campo `acao` e seus custos normais; cada início subsequente de turno cobra o PE de manutenção registrado na ativação. As condições ficam com duração indefinida até o encerramento. É obrigatório configurar ao menos um efeito de condição; ataque que erra, TR bem-sucedido ou imunidade não geram manutenção vazia.

O jogador pode encerrar no painel, inclusive depois de remover o item do inventário. Sem PE para a próxima manutenção, o efeito termina sem cobrança parcial nem saldo negativo. Apenas os IDs das condições criadas por aquela ativação são removidos; outras fontes da mesma condição permanecem. Dano e movimento são instantâneos e não são repetidos na manutenção. Esse contrato não substitui os sistemas existentes de buffs sustentados e réplicas.

Exemplos do bloco de custos:

```json
{ "pe_base": "2", "pe_por_intensificacao": "1", "max_intensificacoes": "4", "dano_por_intensificacao": "1d6" }
{ "pe_base": "0", "custo_pv": "5" }
{ "gastar_cargas": { "nome": "foco", "quantidade": "1" } }
{ "tipo_acao": "sustentada", "pe_por_turno": "1" }
```
