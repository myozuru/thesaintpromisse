# Resultado da auditoria OMNI — outubro de 2026

Concluído o plano local de **10 etapas**, com correções na main de `myozuru/thesaintpromisse`.

## Resultado verificável

| Verificação | Resultado |
| --- | --- |
| Contrato de composição | 303 componentes, 335 conversões, 10 parâmetros e 81 aliases históricos; IDs preservados |
| Guia | 335 fórmulas avaliadas individualmente nos contextos previstos; 44 exemplos corrigidos, fonte única entre abas |
| Eventos | 34 gatilhos com exemplos completos e explicações próprias |
| Construtor | 38 primitivas identificadas como operações visuais; quatro configurações completas de ações no guia |
| Suíte final | 191 arquivos, 4.499 testes aprovados |
| TypeScript | `tsc --noEmit` aprovado |
| Produção | `npm run build` aprovado |

Essas contagens representam registros diferentes e não devem ser somadas como número de keys. Nomes livres de contadores, IDs e composições válidas não formam uma lista finita de frases.

## Etapas e evidências

1. [Inventário, declarações e aliases](omni-auditoria/etapa-01.md)
2. [Parser e composição](omni-auditoria/etapa-02.md)
3. [Contextos e referências](omni-auditoria/etapa-03.md)
4. [Escrita e recursos](omni-auditoria/etapa-04.md)
5. [Dano, arma e resolução](omni-auditoria/etapa-05.md)
6. [Eventos e observadores](omni-auditoria/etapa-06.md), com [complemento](omni-auditoria/etapa-06a.md)
7. [Mapa, alvos e áreas](omni-auditoria/etapa-07.md)
8. [Ações ativas e custos](omni-auditoria/etapa-08.md)
9. [Persistência, identidade e multiplayer](omni-auditoria/etapa-09.md)
10. [Guia e regressão final](omni-auditoria/etapa-10.md)

Os relatórios individuais descrevem exatamente o escopo, as falhas e os limites de cada etapa. A etapa 10 não é uma renomeação das keys e não reescreve os scripts salvos.

## Pendências reais

A auditoria local terminou; a garantia distribuída não está concluída. Leitura, mesclagem e upsert no cliente não substituem transações atômicas. Duas sessões ainda podem disputar custos da mesma ficha, e dois Mestres podem executar automações globais. Autorização do remetente/RLS e eleição de um único executor exigem trabalho no servidor.

Também faltam ensaio online com reconexão/concorrência, retenção coordenada de tombstones e migração completa da identidade de empunhadura para IDs, caso a mesa precise distinguir duas cópias de mesmo nome nas mãos. Atualizar todas as telas antes de usar o envelope de sincronização novo. Veja a etapa 9 para detalhes.

Os testes usam nuvem/socket simulados e stores reais em memória; não fazem alterações em uma campanha de produção. Cobertura sintática e de referências não prova o funcionamento de qualquer combinação arbitrária dos componentes. Condicionais simples com dados não substituem o fluxo nativo de TR/disputa e seus graus de sucesso.

A implementação de composição em 15 etapas e a revisão anterior de 02/10 são histórico distinto deste plano de 10 etapas. Seus números devem ser lidos com a data e o escopo daquela verificação.
