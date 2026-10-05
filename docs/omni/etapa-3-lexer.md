# Etapa 3 — lexer da sintaxe natural

Estado: lexer implementado e isolado. A Etapa 4 vai consumir esses tokens para montar a gramática; por enquanto, o parser/combat continuam inalterados.

## Contrato lexical entregue

- Palavras preservam grafia original, recebem forma normalizada sem acentos e mantêm posições UTF-16 para seleção do texto na interface.
- Termos compostos com underline, como `corpo_a_corpo`, `contador_rancor` e `arma_principal`, permanecem um token cada.
- Conectores `e`, `ou`, `então`/`entao` permanecem palavras; o lexer não decide precedência nem se `e` soma dados ou encadeia ações.
- `4.5m` e `4,5m` tornam-se valor numérico com unidade canônica metros. Decimais com vírgula exigem dígitos adjacentes; vírgula comum continua pontuação.
- Percentuais, segundos, minutos, distâncias, rodadas e turnos são reconhecidos lexicalmente. Uma unidade escrita separada do número continua token separado para o parser validar sua relação; `PE` e `PV` permanecem palavras quando soltos.
- Dados como `2d8`, `d6` e `1d20kh2` são tokens indivisíveis. Quantidade/lados zero, inteiros inseguros, infinito e notação inválida geram erro localizado.
- Texto entre aspas é opaco à gramática. IDs internos retêm maiúsculas e acentos originais; somente a forma auxiliar de comparação é normalizada.
- `@` e `->` geram diagnósticos explícitos na linguagem nova. O tokenizador legado de composição permanece separado.

## Validação

`npx vitest run src/test/omniLexerNatural.test.ts src/test/omniComposicaoLexer.test.ts src/test/omniConsultasNaturais.test.ts` — 3 arquivos e 24 testes aprovados. Cobrem offsets após acentos/Unicode, compostos, decimais, unidades, dados, texto citado e erros no formato antigo.

O lexer não autoriza keys, resolve sujeitos, calcula unidades, avalia condições, interpreta dados nem executa efeitos. Estas decisões pertencem ao parser, validador de catálogo e runtime das próximas etapas.
