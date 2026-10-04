# Auditoria OMNI — etapa 10 de 10

Base revisada: `6ece0f08fdcd017ef3041e33fe585118b6aa2def`.

Escopo: guia, exemplos e regressão final dos caminhos auditados. Os nomes das keys, aliases, IDs do contrato e dados salvos foram preservados. Esta etapa conclui o plano local de 10 etapas; não elimina as pendências distribuídas documentadas na etapa 9.

## O que foi corrigido no guia

- **44 exemplos revisados individualmente**, com cenários, números, limites e resultados próprios. As 22 perícias e os 5 TRs agora distinguem bônus de resultado: a comparação simples inclui o d20. As disputas simples usam dados independentes e empate a favor do defensor. Para desfechos críticos e integração com o HUD, o guia recomenda a modalidade nativa da ação ativa.
- Exemplos de RD passaram a fornecer dano bruto ao motor, com tipo explícito; não descontam RD manualmente e depois chamam um caminho que mitiga novamente.
- Exemplos de rodada usam eventos de turno com condições de cena. O exemplo de Vida do alvo é um efeito condicionado de ataque já acertado, sem prometer que um watcher observe continuamente a vítima.
- ID `sh-leve` é inserido entre aspas. O hífen pertence ao identificador e não pode ser tratado como operador de subtração.
- Os cards de perícia e TR tiveram suas descrições corrigidas para refletir o dado mais bônus. A presença de uma key de leitura não concede permissão de escrita.
- **Fonte única para os exemplos**: os cards históricos consultam os mesmos exemplos compostos. O mapa duplicado de exemplos no componente React foi removido. A busca por origem usa índice, evitando varrer todas as composições em cada card.
- **34 gatilhos têm exemplos completos e explicações específicas**, em vez de apenas `@evento ->`. As aliases continuam inserindo um fragmento de gatilho para composição. Os exemplos explicam quem é afetado, quando executar e o que a fórmula não automatiza.
- **Quatro configurações completas** na aba Ações: golpe com arma e teste de ataque; cura de até três aliados; cone com TR Reflexos e metade no sucesso; derrubar por disputa de perícias. São configurações do construtor, não JSON colado como fórmula.
- As 38 operações visuais não são apresentadas como comandos completos do terminal. O exemplo `subtrair em vida` é rotulado como efeito de dano, acompanhado da orientação para configurar o teste de acerto.

Revisões editoriais ficam em `docs/omni-componentes/revisoes-guia.json` e `revisoes-componentes.json`. O gerador aplica essas revisões depois de validar o SHA da especificação aprovada, para não restaurar os exemplos antigos ao regenerar. O contrato original continua com seu hash e IDs.

## Falhas funcionais encontradas ao avaliar os exemplos

O parser aceitar uma fórmula não comprovava que seus operandos tinham dados. A avaliação individual revelou lacunas de projeção e de valores ausentes:

| Lacuna | Correção |
| --- | --- |
| `ITEM.usos restantes` / `usos maximos` sem contexto composto | O parser projeta os usos enviados pelo produtor do efeito para o domínio ITEM. Sem contexto de item, mantém diagnóstico. |
| Extras parciais de CENA apagavam valores existentes com `undefined` | Mesclagem preserva campos definidos e incorpora os fatos novos da execução. Contagens já presentes permanecem disponíveis. |
| Consulta composta de contador ainda não criado | Saldo inicial é zero, sem inventar uma carga. Recurso realmente inexistente continua diagnosticado. |
| Item e condição ausentes | Projeção tem presença falsa explícita; condição ausente tem idade sentinela -1 e idade conhecida falsa. Não se confunde presença com existência de um objeto de fallback. |
| Origem/especialização, suporte nível 2 e percentual sacrificado | Grandezas da ficha são projetadas nos seletores genéricos, preservando leitura, sem criar frases como novas keys. |
| Quantidade de reações usadas | O registro conserva valor e quantidade para a operação genérica de contagem. |
| Dano do evento e mapa em CENA | Campos do evento são projetados no contexto correspondente. |

A revisão não relaxa o tratamento de uma expressão inválida para zero. Os valores padrão acima pertencem a domínios declarados: saldo ainda não criado ou presença ausente. Um nome arbitrário de recurso, ausência do contexto de item e dado não finito continuam produzindo diagnósticos.

## Receitas corrigidas

- Drenagem usa `aoCausarDano` e metade do **dano final**, com arredondamento para baixo. Não inicia outro ataque nem usa o dano bruto como cura efetiva.
- Choque encadeado é duas descargas no mesmo ALVO. `AREA` não serve de atalho para seleção múltipla nesse executor; a área real pertence à ação ativa.
- A receita percentual usa um tipo Energético reconhecido e não promete ignorar mitigação por declarar um tipo chamado Verdadeiro.
- Proteção pela Força usa o atributo como escala de PV temporários; não promete alterar um atributo por um destino sem suporte.
- Vitalidade explica reaplicação e diferença entre alteração da ficha e bônus derivado de equipamento. Sacrifício explica que dano autoaplicado passa por mitigação; custo sacrificial usa `custo_pv` da ação.
- Receitas que usam `RESULTADO_1` explicam a necessidade de uma cadeia que forneça esse resultado; o guia não promete que todo produtor disponibilize resultados anteriores.

## Validação

Novo arquivo `src/test/omniGuiaAuditoria.test.tsx`: **414 casos**, incluindo:

- as 335 fórmulas avaliadas individualmente com fichas, cena, item, dano e resultados anteriores apropriados, sem diagnóstico de referência ausente ou valor não finito;
- correspondência dos cards históricos e aplicação das revisões individuais;
- d20 mais bônus, variação de sucesso/falha, IDs com hífen e contexto parcial;
- valores positivos de origem, especialização, suporte, reações e percentual sacrificado;
- presença falsa de condição ausente, saldo zero de contador ainda não criado e diagnóstico de recurso inexistente;
- os 34 scripts completos de gatilhos, com evento preservado;
- combate real nas stores: drenagem após RD, mitigação uma vez, ataque que erra pagando o custo e cura múltipla cobrando PE uma vez.

O teste do Interceptador aguarda as notificações assíncronas antes de encerrar o ambiente. Rejeições de teardown não foram ignoradas.

Resultado final: **191 arquivos e 4.499 testes aprovados; TypeScript e build de produção aprovados.** O verificador estrutural confirma 303 componentes, 335 conversões, 10 parâmetros e 81 aliases históricos do contrato.

## O que esta conclusão significa

Não restam etapas do plano local de auditoria. Sintaxe, referências e cenários de domínio têm regressão; isso não certifica qualquer combinação arbitrária das palavras nem uma campanha online real.

Continuam pendentes: transações atômicas entre sessões; eleição de um Mestre executor único; autorização/RLS no servidor; ensaio online de reconexão e concorrência; política segura de retenção de tombstones; eventual migração das mãos da ficha de nomes para IDs de exemplares. Os detalhes e riscos estão na [etapa 9](etapa-09.md).
