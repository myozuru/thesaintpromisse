# OMNI: contratos dos componentes — etapa 1 de 15

Fonte de nomenclatura: `Analise_Keys_OMNI_Componentes(1).txt`, versão 3.0.
Código conferido: `main`, commit `a69aa2eb4ca734f7102832407ead362997a8813e`.

## Entrega e limites

O `catalogo.json` registra 303 componentes independentes, 10 marcadores de
parâmetro, 3 literais, 335 correspondências antigas e 81 ocorrências de aliases
históricos. As correspondências referenciam componentes pelo ID; não contêm
funções exclusivas para cada frase. Os IDs K são referências de documentação,
não sintaxe que o usuário precisa escrever.

Esta etapa estabelece os contratos e as decisões para a implementação.
O catálogo ainda não habilita a nova escrita no motor. A representação
executável será implementada na etapa 2 e a composição na etapa 4.

## Contrato de componentes

- Um seletor conserva a seleção: `arma_principal` seleciona um equipamento;
  `vida` seleciona um recurso; `feiticos` seleciona uma coleção.
- Uma operação recebe seleção compatível: `quantidade` conta uma coleção;
  `maximo` consulta capacidade ou extremo conforme o domínio.
- Um filtro restringe o objeto ou a coleção: `leve`, `sustentados`, `adjacentes`.
- Um conector estabelece vínculo: `nesta` associa uma janela; o `e` em
  `outro e voce` faz parte do teste de identidade.
- Um identificador de opção não é um campo numérico. `acrobacia` identifica
  uma perícia; `25%` é um literal; `<nome>` é marcador de parâmetro.
- Contexto, unidade e permissão pertencem ao resultado da composição. Um
  fragmento isolado não ganha setter. O catálogo lista contextos das origens,
  sem autorizar automaticamente reutilização em outros contextos.

Os papéis, explicações, exemplos e usos de cada componente estão registrados
individualmente no JSON. `bonus`, `dia`, `distancia`, `total`, `nivel` e outros
componentes com vários papéis exigem resolução tipada pela composição.

Exemplos de contratos compartilhados:

| Composição | Partes independentes | Resultado |
| --- | --- | --- |
| `arma_principal leve` | seleção de equipamento + teste de propriedade | 1/0 |
| `arma_principal versatil` | a mesma seleção + outro teste | 1/0 |
| `margem_critico arma_principal` | informação solicitada + seleção | número natural |
| `quantidade buffs sustentados` | contagem + coleção + filtro | inteiro não negativo |
| `cura recebida nesta rodada` | grandeza + direção + vínculo + janela | PV acumulados |
| `contador brasas fonte reliquia_lunar` | registro + nome + seleção de origem + ID | parcela numérica |

`+` nas decomposições do documento significa composição, não adição.
Uma composição deve conservar as partes na representação interna e aplicar
operações reutilizáveis. As 335 correspondências são a cobertura exigida;
não autorizam todas as permutações entre os 303 componentes.

## Gramática e parâmetros

1. Preservar grafia e ordem da lista: inclusive `duração`, `max`, `maximo`,
   `maximos`, `percentual`, `porcentagem`, singular e plural.
2. Conceitos completos continuam atômicos: `corpo_a_corpo`, `margem_critico`,
   `dado_vida`, `linha_de_visao`, `vigor_maldito`, entre outros da fonte.
3. ID de conteúdo é argumento inteiro. Não dividir `bola_de_fogo` nem
   `reliquia_lunar` em componentes. Argumentos com espaços ou palavras
   reservadas devem ter delimitação explícita por aspas.
4. Reconhecer composição e argumentos antes de traduzir conectores ou aplicar
   auto-`@`. Não transformar o `e` de `outro e voce` em soma/E lógico, nem
   inserir outra referência no `nivel` de `suporte nivel 2`.
5. Preservar o escopo da referência completa: USUARIO, ALVO, CENA, DANO e ITEM.
   `DANO` escalar e o contexto DANO são contratos diferentes.
6. Um fragmento incompleto ou combinação sem contrato deve gerar diagnóstico;
   não deve virar um contador arbitrário nem retornar zero silenciosamente.
7. Limites da consulta, da comparação e do comando precisam ser separados.
   O `ate` em `vida ate 25%` não é o teto do comando de contador.

## Decisões conferidas no código

### D01 — Percentuais

`VIDA_PCT`, `PE_PCT`, `VIDA_TEMP_PCT`, `PE_FALTANTE_PCT`,
`VIDA_FALTANTE_PCT`, `SLOTS_DESCANSO_CURTO_PCT` e `SACRIFICIO_PCT`
usam 0–100, `Math.round` e zero com máximo zero no resolvedor atual.
O documento contém exemplos em 0–1 que divergem desse código.

Contrato novo: proporções dessas consultas usam pontos percentuais 0–100.
O literal `25%` representa o limiar 25/100 na comparação com o recurso bruto.
Os atalhos `vida ate 25%`/`50%` e PE usam comparação inclusiva da razão sem
arredondar primeiro. Não transformar 25,4% em 25% para aprovar um limiar.
Preservar a execução das fórmulas antigas; não substituir seus números
automaticamente. Corrigir os exemplos novos para a unidade real na etapa 14.

### D02 — Índice de turno

`CENA_TURNO_INDICE` retorna -1 sem combate/entrada válida. `TURNO_ATUAL_INDEX`
usa `currentTurnIndex ?? 0`. Ambos são índices globais; não são a posição
individual de uma criatura. Manter a diferença de ausência por contexto nos
adaptadores. `posicao iniciativa` continua base um, com zero fora da ordem.

### D03 — Contagem de sustentados

`QTD_SUSTENTADOS` conta `isSustained === true || durationRounds === -1`.
`QTD_BUFFS_SUSTENTADOS` conta apenas `isSustained` verdadeiro.
Não são aliases equivalentes em todos os estados.

Contrato novo: o filtro `sustentados` testa sustentação declarada. Duração
indefinida sozinha não implica sustentação. O adaptador de `qtd_sustentados`
conserva seu filtro antigo mediante perfil de compatibilidade da origem.
Esse perfil é metadado interno; não vira outra key exigida na autoria.

### D04 — Grupo da arma

`ARMA_GRUPO_<grupo>` considera arma principal e secundária no resolvedor.
Contrato novo `arma_principal grupo <grupo>` considera somente a principal.
Preservar a seleção das duas mãos no alias antigo. Não anunciar equivalência
automática entre os dois contratos.

### D05 — Escudo

`ESCUDO_EQUIPADO` atualmente lê `talentos.shieldProficient`.
`ESCUDO_ID_EQUIPADO` lê a presença de `equippedShieldId`.
`ESCUDO_PROFICIENTE` lê proficiência.

Contrato novo: `escudo equipado` testa equipamento presente;
`escudo <id> equipado` testa identidade do equipamento;
`proficiencia escudo` testa proficiência. O `[id]` do documento é marcador
de argumento, não uma propriedade booleana com o nome literal `[id]`.
Aliases antigos preservam a consulta atual até migração explícita.

### D06 — Distância e rodada com número

As composições selecionam grandeza e parâmetro de condição. A comparação
precisa conservar seu operador: `distancia <= 3` e `rodada >= 3`.
Não converter silenciosamente para igualdade nem inferir um operador de uma
forma incompleta como `rodada 3`. O construtor deve guardar o operador e o
limiar separadamente; o terminal deve solicitar comparação explícita quando
ela não estiver definida.

### D07 — Fonte e tipo do dano

`contextoDano.ts` já define os códigos estáveis de tipos e fontes.
As consultas novas parametrizadas retornam 1/0 para teste do argumento.
As referências antigas sem argumento conservam os códigos numéricos.
Tipo/fonte desconhecidos não devem ser reinterpretados como zero conhecido.
Não consultar a categoria da criatura para deduzir a fonte do golpe.

### D08 — Acumuladores de cura e dano

O resolvedor lê os históricos em `omniCounters`; a leitura não implementa
atualização ou reset. A busca nas fontes atuais não encontrou produtores
automáticos dos contadores de cura/dano da rodada.

Contrato novo: última cura/dano = evento aplicado à entidade; acumulado da
rodada = soma das quantidades efetivamente restauradas/perdidas na rodada
global. Cura excedente não entra; dano mitigado não entra. Guardar a camada
de PV temporários afetada separadamente no evento para não confundir dano
aplicado com perda de PV comuns. Integrar produtores e reset na etapa 10/11,
conservando os contadores legados existentes durante a compatibilidade.

### D09 — Dados de Vida

`DADO_VIDA` e `SLOTS_DESCANSO_CURTO` leem `hitDiceCurrent`.
Os máximos leem `hitDiceMax`. Compartilhar a leitura é permitido.
Consumo/reposição passam pelo recurso e seus limites na etapa 11; o
aplicador de OmniScript atual não fornece setter para essas keys.

### D10 — Rodadas

`RODADA` e `CENA_RODADA` usam `round`. `CENA_RODADAS_EM_COMBATE`
retorna zero fora de combate. Manter o contexto e a política de ausência;
não unificar por semelhança textual com duração de condição ou turno.

### D11 — Contadores

`contador <nome>` seleciona total; `fonte <id>` seleciona parcela.
`calcularContador` mantém fontes e total. Uma escrita por fonte deve atualizar
a parcela e recompor o total uma vez. A ponte atual de aplicação aceita
`contador_<nome>`, mas não oferece a mesma escrita para nomes nus ou para
`<nome>__fonte__<id>`; esses exemplos exigem a integração da etapa 11.
Conservar ID de origem e teto global/por fonte. A seleção explícita `contador`
evita confundir um contador chamado `vida` com o recurso vida.

### D12 — Transferências e escrita

`recuperavel reserva pe` é a quantidade que cabe no PE faltante. Capturar
o valor uma vez antes do débito e crédito; validar os dois destinos e aplicar
a transferência sem recalcular entre mutações. Semântica transacional entra
na etapa 11. Consulta de saldo não efetua pagamento.

O JSON identifica suporte **atual no aplicador OmniScript**, não autorização
universal nem garantia em todos os executores. O executor lógico usa outra
ponte de escrita e também precisa da integração da etapa 11. Perícias escrevem
no bônus Omni, não sobrescrevem o modificador total. As demais consultas não
ganham setter automaticamente. Operações de domínio podem criar/remover
efeitos; isso exige ações próprias e não um setter de `quantidade` ou `tem`.

## Referências de implementação

- `src/lib/omni/resolvedor.ts`: valores, unidades, sentinelas e filtros.
- `src/lib/omni/contextoDano.ts`: códigos e metadados de golpe.
- `src/lib/omni/aplicarEfeito.ts`, `executor.ts`, `contadores.ts`: escrita.
- `src/lib/omni/parser.ts`, `omniScript.ts`: fórmulas e comandos.
- `src/lib/omni/simplificarKeys.ts` e `src/stores/useOmniEntidadesStore.ts`:
  normalização, importação, reidratação e armazenamento.
- `src/lib/omni/constantesDoSistema.ts`, `guiaDados.ts`,
  `dicionarioAutocomplete.ts`: catálogo e apresentação.

## Critérios de continuidade

Etapa 1: catálogo independente, cobertura das origens e aliases, contratos e
diferenças registrados. Etapa 2: estrutura tipada que conserva seleção,
operação, filtros, parâmetros, contexto e perfil de compatibilidade.
Etapa 3: reconhecimento lexical. Etapa 4: composição genérica.
Etapas 5–11: integração com fórmulas e domínios, seguida de escrita e resets.
Etapa 12: compatibilidade e migração. Etapa 13: construtor/autocomplete.
Etapa 14: guia individual. Etapa 15: comparação integrada e desempenho.

Verificação do catálogo: `node scripts/verificar-componentes-omni.mjs`.
