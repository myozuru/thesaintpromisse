# Auditoria OMNI — etapa 2 de 10

Base revisada: `59c9097cdeead98d1a569bd34fe5c4ecedbb9c3d`.
Escopo: interpretação de fórmulas, compatibilidade de referências, operadores, dados dinâmicos e apresentação/tratamento de diagnósticos.

## Erros reproduzidos e corrigidos

### B01 — igualdade simples aceita na autoria, mas inválida na avaliação

Antes: `se @USUARIO.contador rancor = 3 entao ...` compilava sem erro; o avaliador matemático exige `==`, retornava zero e registrava expressão inválida. O usuário via o script aceito, mas a condição nunca ativava.

Depois: a igualdade simples é traduzida para `==` apenas na avaliação, assim como a tradução já existente de `&&`/`||` para `and`/`or`. `<=`, `>=`, `!=` e `==` permanecem intactos. O processamento preserva strings literais. A expressão digitada permanece disponível para edição.

Evidência: teste de `=`, `==` e `igual a`; comparação verdadeira/falsa com dados compostos; teste pelo painel real de ataque, usando igualdade simples e conjunção, com aplicação do dano de Rancor ao alvo.

### B02 — gatilhos de scripts ignoravam diagnósticos numéricos

O avaliador mantém um fallback numérico legado, acompanhado de diagnósticos. Os gatilhos de itens usavam apenas o valor retornado:

- `se @USUARIO.key_inexistente == 0`: a chave inexistente virava zero e podia ativar o efeito.
- `subtrair @USUARIO.key_inexistente + 5 ...`: o efeito podia causar 5 de dano apesar da referência inválida.
- `... ate @USUARIO.key_inexistente`: o teto virava zero, que atualmente é tratado pelo contador como ausência de limite.

Depois: o executor de scripts valida diagnósticos da condição, fórmula e teto antes de aplicar aquele efeito. Registra a referência problemática no log. O efeito inválido não causa dano, não altera o contador e não consome um uso do item. Outros efeitos válidos do mesmo item podem continuar; isto não é uma transação integral de todos os efeitos.

Evidência: três testes pelo fluxo real de selecionar alvo → Rolar Ataque → Rolar Dano, com arma empunhada. O dano normal da arma continua, o bônus inválido não aplica, o contador permanece igual e os usos do item permanecem disponíveis.

### B03 — prévia do terminal não avaliava condição nem teto

Antes: o terminal só mostrava diagnósticos da fórmula de valor. Uma condição ou teto com referência inexistente podia ficar sem aviso.

Depois: quando há personagem de prévia, o terminal apresenta também os diagnósticos da condição e do teto, identificando o campo. Contexto de alvo/cena indisponível é mostrado como prévia incompleta; isto não significa que a regra está necessariamente errada na execução real.

Evidência: renderização do terminal real com os dois casos, verificando mensagens visíveis em `role=status`.

## Verificações complementares

- As 172 entradas registradas em `ATALHOS_PT_BR` foram verificadas na leitura com namespace de usuário e valores conhecidos.
- `exaustao_nivel` também passa pela canonicalização central para `exaustao`; sua bag de teste preserva os dois campos, como o resolvedor real. A diferença entre o nome do registro e o caminho efetivo não foi tratada como um novo bug do jogo.
- Notações dinâmicas `(@USUARIO.contador rancor)d4` e `(@USUARIO.contador_rancor)d4` são verificadas com dados compostos disponíveis, três cargas e zero cargas.
- Quantidade fracionária/negativa de dados recebe diagnóstico; não foi introduzido arredondamento implícito.
- Mantidos os testes existentes de aliases, referências ausentes, zero legítimo, valores não finitos, variáveis nuas, notação da arma, operadores, composição, escopos e compilação dos 335 exemplos do guia.

Esses testes de parser são complementares. A leitura de um alias em uma bag controlada e a compilação de um exemplo não certificam a habilidade completa, custos, reação, mapa ou multiplayer.

## Resultado da validação

Suíte completa: **183 arquivos e 3.915 testes passaram**. TypeScript e build concluídos. A suíte inclui os novos testes pelo painel e terminal reais, além das verificações complementares do parser.

## Limites e pendências explícitas

- As lacunas A01–A04 da etapa 1 continuam abertas nos respectivos domínios.
- O tratamento de diagnósticos foi corrigido nos gatilhos de scripts de itens e no terminal. Outros caminhos, como watchers, fórmulas de primitivas visuais e o uso legado de itens pela ficha, também possuem chamadas ao avaliador. Eles ainda precisam de testes funcionais e de revisão do tratamento dos diagnósticos nas etapas 3, 6 e 8; não são certificados por esta mudança.
- Teto numericamente válido igual a zero ainda precisa de definição/teste na etapa 3. A correção B02 trata referência inválida, não altera a semântica do teto zero.
- A leitura/escrita de cada componente, requisitos de contexto de arma/área e disponibilidade dos gatilhos continuam nas etapas correspondentes.

## Reprodução

```sh
npx vitest run src/test/omniParserAuditoria.test.ts src/test/omniTerminalDiagnostics.test.tsx src/test/omniAttackMetadata.test.tsx
npx vitest run
npx tsc --noEmit
npm run build
```

Etapa 2 concluída dentro desse escopo. Próxima: recursos, contadores, tetos, fontes e consumo. Faltam 8 etapas.
