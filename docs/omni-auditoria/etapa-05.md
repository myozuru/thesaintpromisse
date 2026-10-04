# Auditoria OMNI — etapa 5 de 10

Base revisada: `7f46e892e8783fc7d86de8d3407b97829bf70730`.
Escopo: ataque comum pelo painel, dano de arma OMNI, crítico, fórmulas de dano de ações ativas e continuidade dos metadados.

## Erros reproduzidos e corrigidos

| ID | Antes | Depois |
| --- | --- | --- |
| E01 | Armas derivadas de um modelo continuavam rolando o dado do catálogo, ignorando o dano personalizado. | A fórmula ofensiva personalizada passa ao motor; dados e parcelas fixas são preservados. A fórmula padrão de um modelo versátil mantém a escolha de uma/duas mãos. |
| E02 | O multiplicador de crítico da entidade não chegava ao ataque comum; ações ativas também partiam sempre de x2. | O multiplicador configurado é a base, acrescida dos modificadores locais. Multiplica dados, não a parcela fixa. |
| E03 | O tipo configurado na arma não chegava à aplicação do ataque comum. | O resultado carrega o tipo OMNI reconhecido; RD e metadados usam esse tipo. Ações ativas também herdam o tipo personalizado quando configuradas para herdar a arma. |
| E04 | O planejador ativo descartava parcelas como `@USUARIO.treino`; fórmulas inválidas podiam virar dano parcial sem aviso. | Um planejador compartilhado resolve parcelas escalares, grupos de dados, quantidades dinâmicas e agrupamentos. Referências inválidas e operações sobre dados que não são suportadas recebem erro, em vez de desaparecer. |
| E05 | Uma ação com referência inexistente na fórmula de dano podia cobrar PE e executar parcialmente. | Fórmula principal, dados por carga, dano por intensificação e fórmula personalizada da arma em ataques são verificados antes de pagar. Bônus de dano de condicionais selecionadas também são verificados antes do pagamento. |
| E06 | Ações com `@ARMA.DANO`, ou sem herança de arma, rolavam dano da arma no ataque e depois descartavam esse resultado. | O motor pode resolver somente acerto/crítico; o dano é rolado pelo plano efetivamente usado. Um erro continua gastando o custo declarado, sem rolar/aplicar dano. |
| E07 | Contexto de arma das ações ativas usava a fórmula de uma mão mesmo com a arma configurada para duas mãos. | Tokens e ataque ativo consideram a empunhadura. A fórmula padrão da Espada Longa configurada para duas mãos usa 1d10. |
| E08 | Leitura/edição do dano-base assumia que o primeiro efeito era o golpe; podia editar um custo pessoal. | A leitura e edição procuram o efeito ofensivo de subtração da vida do alvo, sem gatilho, preservando custos e efeitos não ofensivos. |
| E09 | O evento de acerto não informava o tipo conhecido do golpe. | Informa o tipo da arma ou o declarado/herdado pela ação. Uma ação sem tipo/herança não recebe um tipo inventado. O evento não inventa `valor_final` antes da aplicação do dano. |

Não houve renomeação de keys públicas. Os campos acrescentados à representação interna da arma transportam a configuração existente do OMNI até o motor.

## Evidência funcional

`src/test/omniDanoAuditoria.test.tsx` adiciona doze testes. Dados físicos são determinísticos; painel, seleção no mapa, motor, inventário e stores são reais, com nuvem/socket falsos.

- **Ataque comum:** selecionar alvo → Rolar Ataque → Rolar Dano com Lâmina do Eco, `2d6+3`, Psíquico e crítico x3: rola `6d6`, soma 3 uma vez e aplica 15 PV. Antes de clicar Rolar Dano, os PV permanecem intactos.
- **Mitigação:** arma configurada como Fogo enfrenta RD Cortante 30 e RD Fogo 1. Um acerto de 4 aplica 3 PV, usando a RD de Fogo.
- **Ação ativa:** Usar → alvo no mapa, `(@ARMA.DANO)+@USUARIO.treino`, crítico x3: uma rolagem `6d6`, mais o bônus fixo 4, total 16. Não há uma primeira rolagem de dano descartada.
- **Sem herança:** ação com `1d4` e crítico x3 rola apenas `3d4`; não rola os dados-base da arma.
- **Erro:** 1 natural paga 2 PE, sem rolar dano nem alterar os PV do alvo.
- **Referência inválida:** fórmula principal inválida não cobra PE, não rola acerto e não causa dano.
- **Metadados:** evento de acerto informa Psíquico quando conhecido, mantém dano final ausente e preserva tipo desconhecido quando a ação não herda nem declara um.
- **Parcela negativa:** `2d6-3` com crítico x3 rola `6d6` e subtrai 3 uma vez.
- **Cargas:** três cargas consumidas, `1d8+treino`, mais `1d8` por carga e crítico x3: rola `3d8` e `9d8`, soma treino 4 uma vez e zera o contador.
- **Duas mãos:** token de uma Espada Longa configurada para duas mãos rola `1d10`.
- **Complementar, sem interação de editor:** editar o dano de uma lista cujo primeiro efeito é um custo pessoal preserva esse custo e altera o golpe correto.

Mantidos os testes de aliases/tipos de dano, contexto de arma, metadados, cadeias de eventos, mitigações, TRs, condições, acertos e erros existentes. O teste de registro de dano agora aguarda o despacho assíncrono do motor antes de encerrar o ambiente; a rodada final não apresentou rejeições assíncronas pendentes.

## Validação

Suíte completa: **186 arquivos e 3.946 testes passaram**, sem erros assíncronos. TypeScript e build concluídos. Uma tentativa de build encontrou conflito ao limpar a saída gerada; após mover essa saída temporária e reconstruir, o build concluiu.

## Semântica e limites explícitos

- O plano de dano aceita soma de grupos, parcelas escalares com fórmulas e quantidades dinâmicas, incluindo agrupamentos. Não é uma certificação de todas as expressões do parser matemático sobre dados. Por exemplo, multiplicação de um grupo rolado e subtração de grupos precisam de um plano próprio; não são silenciosamente convertidas em mais dados.
- `@ARMA.DANO` representa a fórmula-base da arma; `incluirArma` pode usar o dano completo do ataque, com os bônus do motor. A presença do token evita somar esse ataque completo novamente.
- Uma ação ativa ainda aplica um tipo ao total de seu bloco de dano. Parcelas de tipos diferentes exigem efeitos separados; o planejamento de múltiplos tipos por parcela não foi implementado nesta etapa.
- Atributos públicos mantêm a semântica anterior do resolvedor. O motor nativo calcula o modificador D&D a partir do valor do atributo; a key `for` expõe o valor projetado, não ganhou conversão automática. Quando a ficha usa valor 14, o modificador correspondente pode ser expresso como `floor((@USUARIO.for-10)/2)`. Essa diferença deve ficar explícita nos exemplos finais do guia.
- A validação antecipada do dano não certifica todas as condições, watchers, graus de TR e efeitos secundários; esses caminhos continuam nas etapas 6/8.
- O caminho especial de ataque em área do painel tem execução própria; acerto, fórmula, tipo e alvos desse caminho serão revisados com áreas/mapa e ações nas etapas 7/8. Os testes desta etapa não o certificam.
- Mudanças de alvo/arma entre seleção, revelação e dano, e distinção entre exemplares com nomes idênticos, permanecem na revisão de identidade/persistência da etapa 9.
- Não houve teste manual em campanha online ou duas sessões reais. A aplicação demonstrada é pelo fluxo real em memória.

## Reprodução

```sh
npx vitest run src/test/omniDanoAuditoria.test.tsx src/test/omniArmaContexto.test.tsx src/test/omniAttackMetadata.test.tsx
npx vitest run
npx tsc --noEmit
npm run build
```

Etapa 5 concluída dentro desse escopo. Próxima: gatilhos e reações. Faltam 5 etapas.
