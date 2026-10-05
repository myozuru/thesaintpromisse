# Etapa 5 — compatibilidade e migração dos scripts

Estado: contrato versionado e ponte explícita de leitura implementados. Os scripts e efeitos já usados no jogo continuam armazenados no formato legado atual; este adaptador ainda não substitui formatos existentes de entidades ou itens.

## Formato

Documento novo usa `{ formato: 'omni.script', versao, fonte }`. Sem versão persistida equivale a versão 1: a fonte é enviada ao `parseOmniScript` legado e preservada sem alteração. A versão 2 usa lexer/gramática natural apenas para diagnóstico e AST; é marcada como não executável até haver compilador/runtime próprio.

A migração de um texto legado apenas o envolve na versão 1. Não troca `@`, `->`, nomes, acentos, comandos ou pontuação. Script inválido fica intacto e recebe diagnóstico; a leitura não o marca executável. Versões desconhecidas são rejeitadas sem substituir a fonte. IDs de efeitos parseados podem ser novos a cada leitura; a estabilidade garantida é da fonte e do comportamento representado, não do ID efêmero de uma rolagem de parser.

O executor legado aceita somente versão 1. Assim, uma frase natural nunca cai no parser antigo por tentativa automática. Opções do parser permanecem parâmetros de execução e não são inseridas no documento da habilidade.

## Fronteira da entrega

Entidades Omni existentes guardam `CombatEffect[]`, e o parser legado produz esses efeitos. Este trabalho fornece o adaptador para texto versionado sem converter em massa esses dados estruturados. A interface que editar/persistir scripts em texto será conectada nas etapas de editor e integração; não se afirma que o app já grava a nova estrutura em cada habilidade.

## Validação

`npx vitest run src/test/omniDocumentoScript.test.ts src/test/omniScriptCompatibility.test.ts src/test/omniParser.test.ts src/test/omniGramaticaNatural.test.ts` — 4 arquivos, 60 testes aprovados. Casos incluem scripts antigos válidos, texto com separadores, defaults de alvo, origem sem versão, legado inválido, documento natural válido/inválido e versão futura.
