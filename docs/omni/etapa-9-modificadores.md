# Etapa 9 — modificadores, acúmulo e expiração

Estado: implementada e coberta por testes direcionados. Esta etapa formaliza o cálculo dos bônus numéricos concorrentes e a validade dos modificadores que já usam o ledger `omniAdvMods`.

## Regra de acúmulo

- Para cada chave de atributo passivo da ficha — PV máximo, PE máximo, defesa, RD, esquiva, slots, perícias, TRs e deslocamento — fontes positivas concorrentes usam somente o maior valor. Valores negativos permanecem somados; a regra do maior bônus não reduz penalidades.
- Para uma rolagem, os modificadores fixos compatíveis com aquele contexto têm o mesmo tratamento: aplica-se o maior bônus positivo e somam-se as penalidades. Isso cobre efeitos amplos (`next_any`) junto com os específicos (`next_attack`, `next_skill` e equivalentes), quando mais de um alcança a rolagem.
- Vantagem e desvantagem continuam como estados separados e se cancelam mutuamente. Não são convertidas em bônus numéricos.
- As origens continuam registradas. Os agregadores marcam a contribuição aplicada; fichas e registros de defesa indicam quando uma fonte não acumulou.

## Ordem e consumo

1. O motor seleciona os modificadores cujo escopo corresponde à rolagem declarada.
2. Resolve os bônus e penalidades numéricos e o estado líquido de vantagem/desvantagem.
3. No momento da resolução, retira do ledger os modificadores `use` compatíveis e entrega o bônus calculado para aquela rolagem. Os outros bônus de uso único compatíveis também são consumidos, ainda que um valor maior tenha prevalecido.
4. Modificadores `turn` são limpos pelo fechamento de turno; `persistent` permanece até remoção explícita. `grantedBy` permite encerrar um efeito no ciclo de quem o concedeu.

Bônus de equipamento e passivas vinculadas são derivados das fontes atualmente equipadas/ativas. Desequipar ou desativar a fonte remove sua contribuição sem precisar subtrair valor gravado na ficha.

## Escopo desta etapa

A política acima vale para bônus numéricos da mesma chave passiva e para bônus fixos concorrentes na mesma rolagem. Ela não modifica soma de penalidades, cálculos de dano, custos de ação, bônus de categorias que o motor ainda não representa como modificadores ou contratos de scripts legados. A linguagem natural permanece não executável; este trabalho corrige e documenta os pontos existentes de ponte e rolagem.

## Evidência

- `src/lib/omni/omniBridge.ts`: totaliza fontes por chave; conserva todas as origens e marca as que não acumulam.
- `src/lib/omni/rollAdvantage.ts`: resolve bônus fixos concorrentes, mantém penalidades cumulativas e consome o escopo de uso único.
- `src/components/fichas/StatValue.tsx` e `CharacterCard.tsx`: exibem no detalhe da ficha quais bônus foram suprimidos pela regra.
- `src/lib/defenseCalc.ts`: informa no detalhamento de defesa quando uma fonte não se acumula.
- `src/test/omniBridgeE2E.test.ts` e `src/test/rollAdvantage.test.ts`: cobrem máximo entre fontes, penalidades, transparência do detalhe, consumo único e expiração de turno.

Validação executada: 5 arquivos direcionados, 121 testes passaram.
