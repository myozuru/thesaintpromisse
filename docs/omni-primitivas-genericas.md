# Primitivas genéricas do OMNI — novo ciclo

Este ciclo sucede a auditoria das keys. Cada categoria é uma entrega independente diretamente na `main`.

| Etapa | Categoria | Situação |
| --- | --- | --- |
| 1 | Alvos e áreas | Implementada nas ações ativas, editor e painel de uso |
| 2 | Condicionais dinâmicas | Implementada: checagens de usuário/alvo, idade de condição, crítico, dano extra, vantagem e TR |
| 3 | Movimento | Implementada: puxar, empurrar, avançar, teleportar e trocar; fórmulas, obstáculos e destinos válidos |
| 4 | Custos flexíveis | Implementada: intensificação com teto, consumo parcial/total, PV, tipo de ação e manutenção de condições por turno |
| 5 | Reações interrompíveis | Implementada: cinco gatilhos, janelas entre sessões por perfil, defesa local, cancelamento e integração com ataques/conjurações/movimento |
| 6 | Graus de TR | Implementada: falha crítica, dano total/metade/nenhum, dano maximizado ou extra, duração e efeitos por grau |

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


## Contrato da etapa 5

Uma ação ativa pode ter o bloco opcional `reacao`. O construtor oferece os cinco gatilhos e muda o custo de ação inicial para reação ao habilitar o bloco. Depois, o Mestre pode configurar outro custo, inclusive livre com PE, sem códigos por habilidade.

| Campo de `reacao` | Semântica |
| --- | --- |
| `gatilho` | Um dos cinco eventos abaixo |
| `alcance_m` | Número positivo em metros; exige peças identificadas no mapa |
| `protegido` | `usuario`, `aliados` (inclui usuário), `todos`; usado nos eventos de ataque |
| `alvo` | `origem` (quem provocou), `protegido` (alvo do ataque) ou `usuario` |
| `defesa_bonus` | Bônus não negativo somado somente à Defesa do ataque pendente |
| `cancelar_evento` | Encerra a resolução pendente quando a reação passa por seu teste: ataque acerta, TR do alvo falha ou ação sem teste |

| Gatilho | Janela |
| --- | --- |
| `quando_alvo_declarar_ataque` | Antes do d20 de ataques com alvo identificado; também antes da fase de ataque dos feitiços da ficha |
| `quando_ataque_errar` | Após o resultado de erro de arma, antes de devolver a resolução ao chamador; nos feitiços, ao confirmar os resultados antes de aplicar o dano |
| `quando_inimigo_conjurar` | Antes de cobrar/aplicar feitiços da ficha ou ações de uma entidade OMNI da categoria `feitico` |
| `quando_inimigo_entrar_alcance` | Na confirmação do movimento comum, quando a posição inicial está fora e a final dentro do alcance |
| `quando_inimigo_sair_alcance` | Na confirmação do movimento comum, quando a posição inicial está dentro e a final fora; respeita Desengajar |

A origem deve ser inimiga do reagente, usando os mesmos lados da iniciativa/filtros das ações OMNI. Nos eventos de ataque, o alcance da oferta é medido até o protegido, permitindo interceptar ataques contra aliados. Nos demais eventos, é medido até a origem. A execução da reação ainda valida o alcance e o filtro da própria ação; nas saídas/entradas, vale a fronteira de alcance do evento para o alvo que se move.

### Resolução e custos

A janela funciona tanto na ficha quanto no mapa e aguarda uma escolha explícita: executar uma oferta ou passar. Perfis de jogadores recebem uma sondagem pelo Supabase Realtime; cada sessão procura as reações no inventário local do perfil, executa a escolha e devolve o resultado à sessão que pausou a ação. Assim, a ação e seus custos são aplicados na sessão proprietária, mesmo que o inventário não esteja replicado entre navegadores. Cada oferta é usada no máximo uma vez por janela. Ao aceitar, recursos, item, configuração, personagem e alcance são revalidados. Falhas de validação não cobram recursos e mostram a razão, permitindo continuar. Cliques duplicados são bloqueados durante a execução. Ofertas restantes são revalidadas depois de uma reação.

PE, PV, cargas e orçamento vêm da etapa 4; uma reação paga seus custos uma vez, mesmo se seu ataque errar ou o alvo passar no TR. Se usar orçamento de reação, também marca o controle compartilhado de reações da rodada. Defesa local e cancelamento só se aplicam quando o teste da reação permite seus efeitos. Cancelar não desfaz dano/erro já resolvido; `cancelar_evento` é útil nas janelas de declaração e movimento.

Ataques de arma interrompidos retornam `cancelled: true`, sem d20 nem dano. Custos que o atacante já havia pago não são devolvidos. Após a janela, o motor atualiza a ficha do atacante e a Defesa do alvo; se a reação mudou posições, revalida o alcance. Feitiços interrompidos na declaração não pagam PE nem ação. A defesa extra não fica registrada na ficha e não beneficia ataques futuros. Repetições de dados de um mesmo ataque não criam uma nova declaração.

A confirmação de movimento mantém a prévia visível enquanto aguarda; o orçamento só é consumido ao confirmar a continuação. Interromper reverte a prévia pelo mesmo caminho de patches já usado por Cancelar. Se a reação reposicionar a peça, preserva o novo posicionamento e encerra a confirmação antiga. A verificação compara a posição inicial e cada trecho do trajeto amostrado. A interseção com o alcance usa a mesma distância Chebyshev entre bordas; assim, uma passagem pelo alcance é detectada mesmo quando os extremos estão fora. Teleporte e movimento forçado das ações OMNI não abrem estas janelas. Teleporte e movimento forçado das ações OMNI não abrem estas janelas.

### Escopo operacional

A oferta automática executa uma ação de alvo único/próprio, sem intensificação opcional; área e múltiplos alvos continuam disponíveis para uso manual. Reações não abrem outras janelas, evitando ciclos de contra-ataques. Encerrar o combate cancela as janelas pendentes. Personagens vinculados a `profileId` recebem ofertas somente no perfil dono; os sem vínculo continuam na sessão local. Alterações de fichas e mapa seguem a sincronização existente.

O sistema específico de Zona de Risco continua disponível. O novo gatilho de entrada exige cruzar de fora para dentro; a habilidade antiga também reage a movimento que termina dentro de alcance mesmo se começou dentro, e mantém seu limite próprio por rodada. Estes comportamentos não foram fundidos.

Exemplo de defesa de um aliado (bloco da ação):

```json
{
  "acao": "reacao",
  "teste": "nenhum",
  "reacao": {
    "gatilho": "quando_alvo_declarar_ataque",
    "alcance_m": 6,
    "protegido": "aliados",
    "alvo": "usuario",
    "defesa_bonus": 3
  }
}
```


## Contrato da etapa 6

O bloco opcional `desfechosTR` existe somente nas ações com `teste: "tr"`. Ele permite definir independentemente `falha`, `sucesso` e `falha_critica`; cada ramo aceita:

| Campo | Semântica |
| --- | --- |
| `dano` | `total`, `metade` ou `nenhum` |
| `dano_extra` | Dados e/ou valores fixos somados ao dano configurado |
| `dano_maximizado` | Substitui a rolagem dos dados daquele ramo pelos valores máximos; valores fixos permanecem uma vez |
| `multiplicador_duracao` | Multiplica arredondando para cima as rodadas das condições aplicadas nesse ramo; condições indefinidas continuam indefinidas |
| `efeitos` | Lista de condições e movimentos exclusiva do ramo; uma lista vazia suprime os efeitos herdados |

A classificação usa o d20 escolhido depois de vantagem/desvantagem e o total do TR: natural 1 ou total pelo menos 5 abaixo da CD resulta em falha crítica; senão, atingir a CD resulta em sucesso; os demais resultados são falha. A regra do total 5 abaixo prevalece até quando o d20 é natural 20 com modificador negativo. Falhas por 5+, natural 1 e falhas comuns usam o ramo correspondente.

Configurações parciais usam a regra antiga do grau não configurado: falha completa mais efeitos legados, sucesso com metade ou nenhum conforme `metadeNoSucesso`, e nenhuma condição crítica inventada. Quando um ramo existe, campos omitidos herdam o dano/efeitos padrão desse grau; para desligar os efeitos de falha, defina `efeitos: []`. Sucesso sem efeitos configurados não herda os efeitos de falha.

O dano extra participa do dano antes da metade/metade de sucesso, resistências e aplicação de dano. Dano maximizado não solicita dados aleatórios para o dano daquele ramo. Um ramo sem dano ainda pode aplicar seus efeitos. Movimentos de qualquer ramo configurado são pré-validados antes de pagar a ação e só o movimento do resultado alcançado é aplicado. Escolher destino para esses efeitos acontece antes do TR, seguindo a mesma janela de preparação das ações ativas.

Exemplo:

```json
{
  "desfechosTR": {
    "falha": { "dano": "metade", "efeitos": [] },
    "sucesso": { "dano": "nenhum", "efeitos": [{ "tipo": "condicao", "condicao": "exposto", "rodadas": 1 }] },
    "falha_critica": {
      "dano_extra": "2d6",
      "dano_maximizado": true,
      "multiplicador_duracao": 2,
      "efeitos": [{ "tipo": "condicao", "condicao": "caido", "rodadas": 1 }]
    }
  }
}
```
# Expansão de suporte — etapa 1 de 10

As ações ativas aceitam `tipo_efeito: 'dano' | 'cura' | 'buff'`. Sem esse campo, continuam ofensivas como antes. `buff` aplica os efeitos secundários sem dano primário.

Para recuperação direta, configure `tipo_efeito: 'cura'`, `cura: '2d8 + @USUARIO.treino'` e `recurso_cura: 'pv' | 'pe'` (padrão: PV). A fórmula usa o parser OMNI, incluindo dados e contexto do usuário/alvo. O valor é arredondado para baixo, com mínimo zero; rolagens e recuperação efetiva ficam no histórico.

A recuperação exige `teste: 'nenhum'` e `tipo_alvo: 'proprio'` ou `filtro_alvo: 'aliados'`. Alvos únicos, múltiplos e áreas usam o seletor existente. Configurações inválidas são recusadas antes dos custos. O custo é pago uma vez por ação; a recuperação é calculada por alvo depois do pagamento. PV usa `applyHealing`, preservando limites especiais e eventos de cura; PE usa o máximo normal da ficha. Recuperação não reduz recursos que já excedem seu limite nem concede recursos temporários. Modificadores de dano e dados de intensificação de dano não aumentam a cura.

As etapas restantes são: (4) testes opostos; (5) munição e usos; (6) bônus passivos de perícias/TR; (7) mitigação e deslocamento passivos; (8) zonas persistentes; (9) trajetória intermediária; (10) duplicação e biblioteca de ações.

## Expansão de suporte — etapa 2 de 10

Os efeitos secundários aceitam três novos tipos, tanto em `efeitos` quanto nos ramos de `desfechosTR`:

```json
{
  "tipo_efeito": "buff",
  "teste": "nenhum",
  "tipo_alvo": "multiplo",
  "max_alvos": "3",
  "filtro_alvo": "aliados",
  "efeitos": [
    { "tipo": "pv_temporarios", "valor": "2d8 + @USUARIO.treino", "rodadas": 3 },
    { "tipo": "escudo", "valor": "5", "rodadas": 1 },
    { "tipo": "remover_condicao", "condicao": "sangramento" }
  ]
}
```

`valor` usa o parser de fórmulas e dados OMNI, com mínimo zero e arredondamento para baixo. `rodadas` é um inteiro não negativo: zero permanece até remover ou encerrar a cena; valores positivos decrementam ao finalizar cada rodada completa de combate, no mesmo relógio das condições. O multiplicador de duração do desfecho de TR também afeta concessões de proteção com prazo positivo. Fórmulas e durações inválidas são recusadas antes do custo. A recuperação pode incluir esses efeitos secundários mesmo quando o alvo já está com PV/PE completos.

PV temporários e escudo usam a reserva existente `escCurrent`, que absorve dano antes dos PV; as concessões somam, sem alterar `escMax`. `protecoesOmni` registra origem, tipo, prazo e saldo individual na ficha, preservados pela persistência e sincronização da ficha. O dano e reduções manuais consomem as concessões na ordem de criação antes da proteção de outras fontes; ao expirar, somente o saldo restante da concessão é retirado. Outras reservas ficam preservadas. Encerrar a cena ou descansar por longo período limpa a reserva e seus registros. O painel de ações mostra o saldo/prazo e permite remover cada concessão individualmente. Duração de proteção é independente da manutenção por PE das condições sustentadas existentes.

`remover_condicao` aceita o identificador de uma condição do catálogo ou seu nome, sem distinguir maiúsculas/minúsculas. Remove todas as instâncias daquele tipo, preservando as demais. `condicao: 'todas'` remove todas as condições ativas, inclusive benéficas; não remove buffs de outros sistemas. O construtor oferece os tipos e campos nos efeitos padrão e nos graus de TR; exportação/importação preservam esses campos.

## Expansão de suporte — etapa 3 de 10

O avaliador de fórmulas e o campo de dano das ações ativas podem acessar dados da arma selecionada (arma do item OMNI ou arma principal equipada):

| Token | Valor |
| --- | --- |
| `@ARMA.DANO` | Notação-base da arma, rolada como parte da fórmula e incluída entre os dados dobrados por crítico |
| `@ARMA.DADOS` | Quantidade total de dados-base da arma |
| `@ARMA.PASSO` | Lados do maior dado-base da arma |
| `@ARMA.CRITICO_MARGEM` | Face natural base que inicia um crítico, ou zero se indefinida |

Exemplo: `@ARMA.DANO + 2d8` herda o dano-base da arma e acrescenta 2d8. Também é possível montar um dado escalável com `(@ARMA.DADOS)d@ARMA.PASSO`. O campo existente `tipoDano` converte todo o dano da ação, incluindo a parcela herdada; sem conversão, o dano-base usa o tipo padrão da arma. `incluirArma` continua somando a rolagem completa de um ataque; ao usar `@ARMA.DANO` na fórmula da ação, a soma separada é suprimida para evitar duplicação. Fórmulas que pedem arma sem haver arma identificável são recusadas antes de pagar o custo.

O campo de dano do construtor indica os tokens disponíveis; eles também aparecem no autocomplete do OmniScript. A expressão do dano-base usa a resolução normal da arma versátil sem declarar empunhadura de duas mãos; `@ARMA.PASSO` representa o maior passo quando o dano-base contém tipos diferentes de dado.


## Plano complementar de lacunas

| Etapa | Categoria | Situação |
| --- | --- | --- |
| 6 | Bônus passivos de perícias e TR em equipamentos | Implementada |
| 7 | Resistências, vulnerabilidades e imunidades passivas de dano | Implementada |
| 8 | Modificador passivo de deslocamento | Implementada |
| 9 | Zonas persistentes de terreno | Implementada |
| 10 | Trajetória intermediária para reações e duplicação/presets de ações | Implementada |

## Contrato da etapa complementar 7 — mitigação passiva de dano

Itens e armas equipáveis podem declarar listas de `resistencias`, `vulnerabilidades` e `imunidades_dano` usando as chaves canônicas de tipo de dano. Só instâncias equipadas em um slot válido contam. A definição mais recente da entidade Omni prevalece sobre o snapshot do inventário.

- Imunidade anula o dano antes da RD e respeita `ignoresResistance`.
- A RD é aplicada antes da resistência ou vulnerabilidade. Resistência reduz pela metade; vulnerabilidade multiplica por 1,5; ambos arredondam para baixo.
- Resistência e vulnerabilidade do mesmo tipo se anulam. Imunidade prevalece.

O construtor no-code expõe seletores de tipos de dano, os painéis de detalhes listam as propriedades e a importação de pacote valida os tipos contra `DAMAGE_TYPES`.


## Contrato da etapa complementar 9 — zonas persistentes de terreno

Formas de mapa retangulares ou elípticas podem ser configuradas como zonas. A configuração guarda efeitos `CombatEffect[]`, gatilhos `entrada` e `fim_turno`, duração em rodadas ou duração permanente. O Mestre edita a zona na barra da entidade selecionada. Personagens com ficha vinculada disparam os efeitos ao entrar pela trajetória e ao encerrar o turno dentro da área; variáveis `USUARIO` e `ALVO` apontam para o personagem afetado. O Mestre executa os efeitos como autoridade da sessão, e a zona é removida quando a duração termina.


## Contrato da etapa complementar 10 — trajetória, duplicação e biblioteca

Ao confirmar um movimento arrastado, o mapa envia pontos intermediários amostrados a cada quarto de célula. As reações de entrada verificam se o caminho cruza o alcance, mesmo se começar e terminar fora dele. As reações de saída verificam se o caminho parte de dentro e sai do alcance. A interseção é calculada entre os segmentos do trajeto e a área de alcance, com distância Chebyshev entre bordas e dimensões reais das peças. Regras de Desengajar permanecem aplicadas às saídas. O gatilho legado de Zona de Risco segue independente.

No Editor de Ações Ativas, cada ação pode ser duplicada com configuração completa e ID novo; a cópia é inserida logo após a original. O ícone de salvar armazena a ação como preset e permite definir seu nome no campo da biblioteca. Um preset escolhido pode ser adicionado a outra entidade como uma ação independente, também com ID novo. A biblioteca usa armazenamento local do navegador e não sincroniza entre dispositivos ou perfis. Configurações de ação, custos, alvos, efeitos, condições e reações são preservados integralmente.
