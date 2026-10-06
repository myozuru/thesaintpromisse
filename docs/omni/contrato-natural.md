# OMNI natural — contrato e entregas

Estado: etapas 1–9 concluídas no escopo documentado em cada etapa. A linguagem natural ainda não executa no jogo nem está conectada ao salvamento de habilidades. Base inicial examinada: main d2ef673b0e2a92918fa9fd7fac0095733c5b1d68, especificação Texto colado(4) e correções aprovadas na conversa de 05/10/2026. Evidências complementares em inventario-natural.md, diagnostico-execucao.md e etapa-2-contexto.md a etapa-9-modificadores.md.

## Fontes de verdade

- Atributos: `projetarPersonagemParaOmni` e `somaAtr` em `src/lib/omni/resolvedor.ts`. Preservar o valor resolvido; não introduzir fórmula de modificador de outro sistema. Tetos atuais usam `shownHpMax`/`shownPeMax`, os auxiliares existentes da ficha.
- Condições: `src/types/conditions.ts` e implementação dos efeitos. Não substituir regras por descrições do rascunho.
- Danos: `DAMAGE_TYPES` e `DAMAGE_TYPE_LABELS` em `src/types/index.ts`.
- Perícias e TRs: `src/lib/omni/constantesDoSistema.ts`. TRs: Astúcia, Fortitude, Integridade, Reflexos e Vontade. Perícias nunca viram TRs.
- Dinheiro: moedas e carteiras configuradas em `useMoneyStore`.
- Role local: `PLAYER | MASTER | null`; autorização de persistência precisa de verificação independente do cliente.
- Scripts existentes continuam compatíveis. Receitas específicas não se tornam primitivas novas.

## Linguagem e contexto

Superfície nova: gatilho ou condição, `então`, ações. Aceitar acentos e aliases registrados, sem reescrever strings ou IDs. Gramática precisa distinguir `e`/`ou` em predicados, encadeamento e fórmulas, com agrupamento explícito.

Cada entrada do catálogo deve declarar: nome canônico, aliases, consulta/comando/receita, tipo, unidade, sujeito, contexto obrigatório, escrita permitida, autorização, validade, implementação, etapa e exemplo verificável.

Contexto deve separar usuário, atacante, vítima, alvo, item de origem, arma do ataque e tokens. Ausência de contexto obrigatório é erro, não zero. IDs persistentes identificam fontes; nomes são apresentação. Aliado exclui o próprio usuário e depende da relação na cena, não da categoria da ficha.

Campos derivados são somente leitura. Benefícios têm validade explícita; `enquanto_equipado` é condicional, não duração finita. Auras concedem modificadores reversíveis, nunca incrementos repetidos. Maior valor vale para bônus concorrentes conforme categoria; não aplicar essa política indiscriminadamente a penalidades, custos ou dano. Substituição temporal requer declaração explícita.

## Modificadores e duração

Para uma mesma chave passiva de ficha ou categoria de rolagem, bônus numéricos positivos concorrentes usam somente o maior valor. Penalidades numéricas permanecem cumulativas. O maior bônus não apaga as demais origens: elas continuam disponíveis para auditoria e a interface identifica quais não entraram no total. Vantagem e desvantagem mantêm a regra própria de cancelamento mútuo.

Em modificadores numéricos temporários, todo efeito cujo escopo corresponda à rolagem é resolvido antes do dado: o bônus positivo aplicado é o maior; penalidades aplicáveis são somadas. Os efeitos de uso único que corresponderam à rolagem são consumidos juntos, inclusive um bônus suprimido por outro maior, para não deixar um recurso declarado como “próximo teste” aguardando uma segunda rolagem. O log indica quais bônus não acumularam.

`use` expira após a primeira rolagem compatível; `turn` expira pelo encerramento de turno existente; `persistent` não expira por inferência. `grantedBy` registra quem concedeu o efeito e permite removê-lo quando o turno desse concedente se encerra. Bônus derivados de equipamento/passiva são recalculados a partir das fontes ativas, sem mutação permanente da ficha. A ordem não altera custos, parcelas de dano ou outras regras fora do cálculo numérico do modificador.

## Contadores

`contador_<nome>` mantém namespace próprio. `até treino` limita o total. Escala exige contador nominal: `por contador_rancor` ou `por contador_rancor gasto`, com equivalentes unificados.

`teto_aliado 1 por rodada` reinicia na virada global da rodada. `teto_aliado 1 por descanso` reinicia em descanso curto/longo concluído para o participante. Gastar cargas não reinicia contribuições do ciclo. Registrar saldo e histórico de contribuição separadamente.

Gastos são registrados por nome na execução: `contexto.cargasGastas[nome]`. Outro gasto não sobrescreve o anterior. Custos são validados juntos antes da declaração; erro no ataque não devolve custos. Cancelamento antes da declaração não cobra. Falhas técnicas exigem recuperação idempotente, não repetição cega.

## Dano, condições e reações

Preservar parcelas tipadas, aplicar mitigação individual e consolidar em uma ocorrência com janela defensiva única antes da aplicação final. PV são descontados uma vez. Reações alteram a execução pendente. Rancor consulta perda real de PV: absorção integral, dano zero e consumo exclusivo de proteções não geram carga.

Crítico usa multiplicador efetivo da arma nos dados; valores fixos permanecem. Diferenciar dados da arma de resultado já rolado para impedir inclusão duplicada. `ataque_tem_tipo(tipo)` consulta a ocorrência; `parcela_tipo` exige contexto de parcela.

Condenado: idade contínua independente de duração restante; reaplicação usa maior duração e preserva idade. Isso não impõe política universal às demais condições. Preservar proveniência necessária a medo, marcas e remoção por fonte.

Turno pertence à criatura; rodada é global. Momento de decremento e de captura de valores deve ser explícito. Ataques concedidos não geram outros ataques extras, mas mantêm demais efeitos permitidos.

## Receita de referência: lâmina e Corte

Passiva vinculada ao item empunhado: sofrer perda real de PV causada por inimigo concede uma carga; perda de PV de outro aliado até 4,5m também concede conforme limite individual configurado. Total máximo: treino. Ataques com esta arma recebem 1d4 Psíquico por carga disponível no momento definido de leitura.

Corte da Injustiça: ação comum, 10 PE e todas as cargas, pagos na declaração mesmo se errar. No acerto: dano base da arma + 2d8 de Corte + 1d8 por carga gasta. Tipo desta última parcela é escolhido explicitamente na ação dentre os tipos reais; não inferir pelo portador. Margem reduzida em 2 quando idade de Condenado é estritamente maior que 3 rodadas. Não acrescentar aplicação de Condenado à receita sem regra própria.

Esta descrição é referência funcional, não exemplo de script já suportado.

## Entregas e critérios mínimos

| Etapa | Entrega                          | Evidência de conclusão                                                                                      |
| ----- | -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1     | Contrato e inventário individual | Cada entrada classificada; lacunas e decisões abertas explicitadas                                          |
| 2     | Papéis e contexto                | Usuário, vítima e atacante diferentes; falta de contexto rejeitada                                          |
| 3     | Lexer                            | Acentos, compostos, unidades e posições de erros sem corromper IDs                                          |
| 4     | Gramática e AST                  | Precedência, condições e ações sem interpretações conflitantes                                              |
| 5     | Compatibilidade                  | Scripts antigos preservados e conversão estruturada                                                         |
| 6     | Eventos                          | Mapeamento explícito para gatilhos existentes, papéis e filtros; deduplicação de seletores iguais por regra |
| 7     | Atributos e sobrevivência        | Seis atributos lidos pelo resolvedor; PV/PE e estados lidos das fontes atuais, inclusive tetos efetivos     |
| 8     | Recursos e proteções             | Destinos apoiados, métricas somente leitura, tetos de fome/exaustão e canais protetivos distintos           |
| 9     | Modificadores e ações            | Ordem definida, fontes, expiração e orçamento respeitados                                                   |
| 10    | Estados e auras                  | Entrada/saída reversível, sem incremento ou evento persistente                                              |
| 11    | Contadores                       | Teto global, ciclos independentes do saldo e gastos nominais                                                |
| 12    | Perícias e TRs                   | Catálogo real; disputa e resistência distintos                                                              |
| 13    | Armas e custos                   | IDs, mãos, munição, usos e pagamento completo ou nenhum                                                     |
| 14    | Condições                        | Proveniência, idade, renovação, término e remoção canônicos                                                 |
| 15    | Dano e cura                      | Parcelas, multiplicador, proteções e ocorrência consolidada                                                 |
| 16    | Espaço e movimento               | Tokens inequívocos; seleção e execução usam mesma geometria                                                 |
| 17    | Reações                          | Uma janela; cancelamento/interceptação altera execução pendente                                             |
| 18    | Históricos, economia e tempo     | Reinícios válidos, transferências autorizadas e unidades                                                    |
| 19    | Ataques adicionais               | Sem geração recursiva; demais efeitos continuam válidos                                                     |
| 20    | Magias                           | Custos, concentração e sustentação conforme regras existentes                                               |
| 21    | Áreas e efeitos diferidos        | Fonte, duração e retomada sem reaplicar efeitos concluídos                                                  |
| 22    | Mestre e autorização             | Cliente e backend verificados; informação oculta protegida                                                  |
| 23    | Editor e guia                    | Catálogo com suporte real, exemplos específicos, texto mínimo 13px                                          |
| 24    | Integração                       | Combate, multiplayer, reconexão, concorrência e desempenho                                                  |

## Rastreabilidade dos 19 riscos adicionais

| Risco                       | Etapas responsáveis |
| --------------------------- | ------------------- |
| 1 IDs das fontes            | 2, 13               |
| 2 Sujeitos do evento        | 2, 6, 24            |
| 3 Relações entre criaturas  | 6, 16, 24           |
| 4 Vários tokens por ficha   | 2, 16, 24           |
| 5 Medição espacial          | 16                  |
| 6 Ordem de modificadores    | 9, 15, 20           |
| 7 Momento de leitura        | 2, 11, 15, 17       |
| 8 PV e proteções            | 8, 15               |
| 9 Fontes das condições      | 14                  |
| 10 Renovação por condição   | 14                  |
| 11 Descanso válido          | 11, 18              |
| 12 Recursão seletiva        | 19                  |
| 13 Reações alteram execução | 17                  |
| 14 Informação secreta       | 22, 23              |
| 15 Carteiras autorizadas    | 18, 22              |
| 16 Limites técnicos         | 3, 4, 24            |
| 17 Migração                 | 5                   |
| 18 Persistência e retomada  | 11, 14, 21, 24      |
| 19 Catálogo verificável     | 1, 23               |

Cinco riscos anteriores: colisão de aliases (3/5), precedência (4), unidades (3/18), idempotência e concorrência (24), cancelamento e recuperação (13/17/24). A etapa 6 deduplica descritores iguais numa regra, mas não garante disparo único no combate; isso exige IDs de ocorrência estáveis e integração idempotente no barramento na etapa 24.

## Evidências iniciais e trabalho ainda aberto

- `componentes/lexer.ts` já normaliza componentes e preserva posições; isso não constitui parser completo de eventos naturais.
- `componentes/contexto.ts` transporta escopos compostos efêmeros; persistência e papéis do evento exigem contrato adicional.
- `contadores.ts` distingue teto global de teto por fonte. O novo limite por ciclo deve ser independente do saldo consumível.
- `planejarDano` em `acaoAtiva.ts` agrupa dados e valores fixos; não representa sozinho parcelas com tipos distintos.
- `triggerEfeitos.ts` registra um consumido genérico; a nova linguagem exige mapa nominal por execução.

Inventário individual e sondagens publicados. As lacunas estão explicitadas em diagnostico-execucao.md, incluindo políticas backend permissivas nas migrations versionadas. Seletores persistidos, ordem e momentos de modificadores, medição espacial, penalidades e recuperação técnica serão aprofundados nas etapas responsáveis. Não anunciar essas garantias como implementadas antes de evidência e testes.
