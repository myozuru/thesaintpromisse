# Auditoria OMNI — etapa 3 de 10

Base revisada: `a5729d4d4c7f02d22676e86eeffa7f4a0a4e1e24`.
Escopo: recursos numéricos, contadores, tetos, origem das cargas e notificações de consumo.

## Erros reproduzidos e corrigidos

| ID | Antes | Depois |
| --- | --- | --- |
| C01 | Teto zero equivalia a ausência de teto. | Teto zero permite zero cargas; apenas teto ausente significa ilimitado. Tetos negativos são limitados a zero. |
| C02 | Definir o total de um contador ignorava o teto informado. | Definição e incremento respeitam o teto. |
| C03 | Passar de cargas globais para cargas por fonte podia descartar as cargas anteriores; incrementos globais não atualizavam as parcelas existentes. | Cargas sem atribuição ficam na parcela `geral`; incrementos e consumos mantêm total e parcelas coerentes. |
| C04 | Consumir uma quantidade positiva pequena em uma fonte específica podia consumir a fonte inteira após arredondar a quantidade para zero. | Quantidade positiva arredondada para zero consome zero. A convenção existente de quantidade não positiva para consumo total foi preservada. |
| C05 | O Rancor gerado ao próprio portador sofrer dano era atribuído ao agressor, enquanto o Rancor do aliado era atribuído à vítima. | No dano próprio, a fonte é o portador; no dano observado, a fonte é o aliado ferido. Scripts e primitivas do construtor usam a mesma regra. |
| C06 | Escritas pelo terminal e consumo de cargas por ações ativas não emitiam `aoAtualizarContador`; primitivas visuais notificavam mesmo sem mudança. | Os três caminhos compartilham a notificação. Uma atualização por contador alterado, com `CENA.contador_anterior` e `CENA.contador_valor`. Nenhuma atualização ao repetir incremento já limitado pelo teto. |
| C07 | `acao_bonus` podia receber mais ações do que `bonusActionsMax`. | O efeito respeita o máximo da ficha, como os outros orçamentos de ações. |

O cálculo puro também rejeita valores/tetos não finitos sem contaminar o estado. O pagamento da ação ativa continua antes da rolagem; a correção não altera os valores de cargas capturados para calcular o dano daquela ação.

## Evidências funcionais

### Painéis reais, com cliques e stores reais

Em `omniAttackMetadata.test.tsx`:

- Selecionar alvo no mapa → Rolar Ataque → Rolar Dano: o acerto acrescenta uma carga, o evento de atualização restaura um PE; um segundo ataque no teto não repete o evento.
- Botão Usar → alvo no mapa: a ação custa exatamente duas cargas de três, deixa uma, causa seu dano e emite uma atualização com anterior 3 e valor 1. A habilidade que escuta essa atualização restaura um PE.
- Selecionar alvo → ataque e dano: efeitos de acerto restauram PV e PE e concedem ação bônus sem exceder os máximos da ficha.

Apenas os dados físicos são determinísticos; painel, seleção, motor e stores são reais. O ambiente de teste usa nuvem/socket falsos e não acessa uma campanha online.

### Verificações complementares

- `omniContadoresAuditoria.test.ts`: teto zero/positivo/ausente, definição, preservação de cargas ao mudar de escopo, soma das parcelas, consumo parcial/total, fração positiva e valores/tetos não finitos.
- `omniContadoresObservadores.test.ts`: o dano aplicado pelo store ao portador registra a parcela do portador; o dano ao aliado registra a parcela do aliado. O agressor não recebe a atribuição dessas cargas.
- O mesmo arquivo verifica diretamente uma primitiva do construtor visual: fonte correta e apenas uma atualização após duas execuções com teto um. Esse teste é do executor; não é um teste de criação da habilidade pela interface do construtor.
- Mantidos os testes de limites de cadeias de eventos, custos ativos, recursos temporários, contadores por fonte, consumo e compatibilidade dos scripts.

## Resultado da validação

Suíte completa: **184 arquivos e 3.927 testes passaram**. TypeScript e build concluídos.

## Compatibilidade e limites explícitos

- `contador rancor` e `contador_rancor` continuam aceitos. Nenhuma chave pública foi renomeada.
- Teto explícito zero agora é um limite real. Para um contador ilimitado, omita o teto.
- A parcela `geral` preserva cargas cujo histórico não permite atribuir a uma criatura. As atribuições antigas ao agressor não são reescritas retroativamente.
- A notificação conserva o orçamento da cadeia de eventos nas importações assíncronas. As primitivas visuais preservam a opção anterior de incluir passivas do catálogo; terminal e ação ativa notificam com seus vínculos/scripts de itens normais.
- A cobertura de notificações se refere aos três caminhos corrigidos. Alterações diretas de `omniCounters` por outras rotinas, reinicializações e dados antigos incoerentes não foram declaradas corrigidas automaticamente.
- A03 (ausência de atualização nos contadores do terminal) e A04 (origem inconsistente por fonte), identificadas na etapa 1, foram resolvidas neste escopo. A01 e A02 continuam para revisão de gatilhos, auras e mapa nas etapas 6/7.
- Watchers e diagnósticos de fórmulas do construtor visual continuam pendentes da revisão funcional dos gatilhos e ações nas etapas 6/8. Esta etapa não certifica os fallbacks de todos os chamadores do parser.
- Bônus de equipamentos, mitigação de dano, efeitos persistentes, regras de recuperação e sincronização entre clientes permanecem nas etapas correspondentes. Os testes de recursos desta etapa não certificam todos esses domínios.

## Reprodução

```sh
npx vitest run src/test/omniContadoresAuditoria.test.ts src/test/omniContadoresObservadores.test.ts src/test/omniAttackMetadata.test.tsx
npx vitest run
npx tsc --noEmit
npm run build
```

Etapa 3 concluída dentro desse escopo. Próxima: armas e equipamentos. Faltam 7 etapas.
