# Etapa 26 — matriz de privacidade de fichas

## Objetivo e regra de projeção

O transporte não deve enviar uma ficha completa e tentar escondê-la depois na
interface. O formato público passa a ser uma allowlist pequena de dados de
cena. Todo campo de `Character` fica privado por padrão, e somente dados
necessários à cena, explicitamente autorizados abaixo, podem ser projetados.

O papel `MASTER` recebe as fichas completas da mesa. O jogador autenticado
recebe a ficha completa do próprio personagem. Outros jogadores recebem dados
públicos de cena dos personagens e criaturas visíveis, nunca a ficha mecânica
completa. A autoria não é provada por `profileId`: esse identificador pertence
ao perfil local do navegador e pode ser alterado pelo cliente. A autorização de
propriedade deverá ser vinculada à identidade autenticada no backend.

## Matriz de audiência

| Dados | Mestre | Dono autenticado | Outros jogadores |
| --- | --- | --- | --- |
| Ficha completa de personagem de jogador | Sim | Sim, apenas a própria | Não |
| Ficha completa de inimigo/NPC | Sim | Não | Nunca |
| Identidade e representação pública de criatura visível | Sim | Sim | Sim |
| Nome ocultado ou criatura marcada `hiddenFromPlayers` | Sim | Não | Não recebe objeto, token referenciado nem ID identificável |
| PV/PE numéricos no mapa | Sim | Sim | Somente se `hideStats` do token permitir a exibição |
| Condições e outros estados táticos | Sim | Sim | Somente a apresentação pública aprovada; duração, fonte e IDs internos não são incluídos por padrão |
| Defesa, CD, bônus, atributos e regras de resolução de NPC/inimigo | Sim | Não | Nunca diretamente |
| Resultado observável de uma ação | Sim | Sim | Conforme o evento público da mesa; sem os valores secretos usados no cálculo |

Para inimigos visíveis, a presença em cena e a seleção como alvo não autorizam
acesso à ficha. `hiddenFromPlayers`, `hideName` e `hideStats` hoje são controles
de interface/mapa. Na arquitetura final, o produtor do payload deverá aplicar
os controles antes do envio; não basta verificar essas flags no componente.

## Campos que não entram em projeções públicas

Até haver uma regra explícita de divulgação, nenhum campo mecânico de
`Character` é público. Isso inclui os grupos abaixo e seus equivalentes
aninhados:

- **Cálculo de defesa e CD:** `ca`, `baseDC`, `specDC`, `dcLinkedAttr`,
  `cdIncrease`, `classCdBonus`, bônus de itens, passivas, buffs e modificadores
  de condição.
- **Rolagens e competência:** `attributes`, `skills`, `savingThrows`,
  `customHitBonus`, `meleeAttackBonus`, `rangedAttackBonus`,
  `cursedAttackBonus`, atributos vinculados, treinamento, maestria, iniciativa,
  penalidades e dados de dano.
- **Capacidades e build:** `passives`, `spells`, `chosenSpecAbilities`,
  `chosenAptitudes`, talentos, dotes, fundamentos, técnica, origem, clã,
  especialização, escolhas persistentes e escolhas pendentes.
- **Defesas e efeitos:** `rd`, `rdByType`, vulnerabilidades, imunidades,
  `activeBuffs`, dados completos de `activeConditions`, imunidades OMNI,
  flags/contadores OMNI, estados de reações e snapshots de efeitos.
- **Recursos e orçamento da criatura:** máximos de PV/PE/escudo, ações,
  reações, oportunidades, reservas, dados de vida, usos, cargas, cooldowns e
  custos de manutenção. Exceção visual: valores atuais e máximos de PV/PE só
  podem chegar à placa do token se o token estiver configurado para mostrar
  estatísticas.
- **Inventário e equipamento:** `equippedItems`, slots, armas empunhadas,
  IDs de cópias, munição, escudo, acessórios e os bônus/propriedades associados.
- **Estado privado e editorial:** `notes`, `votos`, `motivation`, tática,
  segredos, recompensas, fontes de condição/buff, IDs de conjuradores/fontes,
  flags de ocultação, autoria, `profileId` e metadados de geração/administração.
- **Estado interno e legado:** campos `__*`, snapshots de CAM e núcleos,
  trackers de progressão, `resourceHistory`, migração, carimbos de sincronização
  e campos depreciados. Eles não são necessários para identificar uma peça na
  cena e nunca são copiados para o DTO público.

O payload privado do dono pode conter as próprias escolhas e cálculos de ficha,
mas não deve carregar credenciais, role atribuída pelo cliente ou dados
privados de outro participante. O dono ainda só pode gravar os campos e
recursos que o backend autorizar.

## Contrato público de cena proposto

A projeção pública deve ser um tipo novo e explícito, não `Partial<Character>`:

- `sceneCharacterId`: identificador opaco para relacionar token, alvo e estado
  público; não reutilizar chaves internas de inventário/conta.
- `displayName` e representação visual, somente quando a criatura estiver
  visível e o nome não estiver oculto.
- `category` reduzida a uma categoria de apresentação necessária à mesa; não
  expor `createdBy`, `profileId` ou flags administrativas.
- posição/associação com token, obtidas do estado de mapa público, sujeitas à
  visibilidade da camada/token.
- PV e PE do nameplate somente quando `hideStats` for falso. Se ocultos, nem os
  valores atuais nem seus máximos vão no payload público, pois a razão também
  pode revelar informação.
- condições de cena somente como nome/ícone quando a regra de jogo as torna
  observáveis. Não enviar `sourceCharId`, `sourceEntityId`, aplicação por
  fonte, CD ou duração precisa sem divulgação explícita.
- nenhuma defesa, CD, bônus, resistência ou fórmula. O resultado de ataque é
  produzido pelo resolvedor autorizado e pode anunciar acerto/erro e efeitos
  observáveis sem incluir o número secreto comparado.

O mapa atual já tem controles `hideName` e `hideStats` e pode desenhar placas de
PV/PE em `EntityEngine`. A sincronização precisa filtrar os dados da placa
conforme o mesmo token/camada que o cliente pode ver. Não se deve incluir PV/PE
de todas as fichas em um lookup global e confiar que o canvas os ignore.

## Canais que também precisam obedecer à matriz

A separação da ficha não basta se o mesmo dado puder ser reconstruído a partir
de outra fatia. Durante as etapas seguintes, auditar também:

- `combat` e ordem de iniciativa, para remover fichas/valores de rolagem não
  divulgados;
- `mapScene`, `entity-patch`, nameplates e caches de assets, para impedir que
  tokens ocultos, nomes ou estatísticas ocultas reapareçam;
- logs e resultados de ataques/TR, para omitir CD/defesa secreta e mensagens
  privadas;
- ações e reações OMNI, para enviar intenção ao resolvedor e não sincronizar a
  ficha do alvo como contexto de execução.

## Critério de aceite desta definição

1. O cliente MASTER pode carregar e resolver qualquer ficha da mesa.
2. Um cliente PLAYER carrega a ficha mecânica completa somente do personagem
   que o backend associa à sua identidade autenticada.
3. Outro cliente PLAYER não recebe nem consegue buscar uma ficha mecânica de
   NPC/inimigo ou de outro jogador; recebe apenas projeções públicas.
4. `hideStats` suprime PV/PE atuais e máximos de todos os payloads que chegam
   ao navegador do Player, e `hideName`/ocultação excluem a identidade e as
   referências identificáveis.
5. Uma busca nos payloads, snapshots, broadcasts, banco e logs não encontra os
   campos privados removidos da projeção.

## Situação

Esta etapa fixa a política e a forma pública mínima. Ela não muda o transporte,
porque a aplicação atual ainda calcula ataques e feitiços no cliente usando
campos secretos do alvo. As etapas de protocolo autoritativo e servidor devem
vir antes da remoção desses campos do estado do Player. A propriedade também
depende de autenticação no servidor: `profileId` local não é prova de posse.
