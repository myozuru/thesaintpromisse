# Artes do Combate (Especialista em Combate — nível 1)

## O que será construído

A habilidade **Artes do Combate**, recebida no nível 1 do Especialista em Combate, com Pontos de Preparo e cinco artes:

### Pontos de Preparo
- Máximo = nível de Especialista em Combate + Modificador de Sabedoria.
- Recuperação automática:
  - Eliminar um inimigo: +1 ponto.
  - Ação comum "Analisar o campo de batalha": +2 pontos (botão no painel, gasta a ação comum).
  - Descanso curto: recupera metade do máximo; descanso longo: recupera tudo (integrado aos descansos já existentes).

### As cinco artes
1. **Arremesso Ágil** (1 ponto) — ao atacar corpo a corpo, como ação livre, um ataque extra com arma de arremesso contra um segundo alvo.
2. **Distração Letal** (1 ponto) — ao atacar, se acertar, a Defesa do alvo cai em metade do Mod. de Sabedoria (mínimo 1, arredonda para baixo) por 1 rodada.
3. **Execução Silenciosa** (1 ponto) — ao atacar criatura com a condição **Desprevenido** (já existe no sistema de condições), +1d6 de dano, +1d6 a cada +2 no Mod. de Sabedoria.
4. **Golpe Descendente** (1 ponto) — ao acertar ataque corpo a corpo, sua Defesa sobe em metade do Mod. de Sabedoria (mínimo 1) até o começo do seu próximo turno.
5. **Investida Imediata** (2 pontos) — na ação de ataque, aproxima-se Mod. de Sabedoria × 1,5 m do alvo (sem ataque de oportunidade) e ataca em seguida.

### Onde aparece (conforme escolhido: os dois)
- **Nova aba "Artes" na barra de combate**: contador de Pontos de Preparo, botão "Analisar campo de batalha" e a lista das cinco artes com descrições e custos.
- **Integradas ao painel de Ataque**: ao rolar um ataque, as artes aplicáveis aparecem como opções (ex: marcar Distração Letal antes de rolar), gastando o preparo no momento.

## Detalhes técnicos
- Novo módulo `src/lib/artesCombate.ts` (pontos, custos, efeitos, escalas por Mod. de Sabedoria).
- Estado na ficha: `preparoAtual`/`preparoMax` e efeitos temporários (redução de Defesa do alvo por 1 rodada; bônus de Defesa próprio até o próximo turno) — seguindo o padrão dos efeitos temporários já usados no Protetor/Interceptador.
- `combatEngine.ts`: ganchos no ataque para aplicar Distração Letal, Execução Silenciosa, Golpe Descendente, Arremesso Ágil e Investida Imediata; recuperação ao eliminar inimigo.
- `useCharacterStore.ts` / descansos: recuperação de preparo no descanso curto (metade) e longo (total).
- UI: `ArtesCombatePanel.tsx` (aba na `PlayerActionBar`) + opções no `AttackPanel`.
- Investida Imediata move a peça no mapa até o alcance do alvo respeitando o limite de movimento em combate.

## Testes (regra permanente: teste em combate de cada habilidade)
Testes em mesa simulada (`mesaReal.ts`) com peças no mapa e cliques reais, para cada arte:
- Gasto e limite de Pontos de Preparo (não pode ficar negativo).
- Distração Letal: Defesa do alvo reduzida por 1 rodada e depois restaurada.
- Execução Silenciosa: só aplica com a condição Desprevenido; escala de dados por Mod. de Sabedoria.
- Golpe Descendente: bônus de Defesa some no início do próximo turno.
- Arremesso Ágil: ataque extra em segundo alvo, respeitando alcance da arma de arremesso.
- Investida Imediata: movimento correto em metros, sem gastar ação de movimento, e bloqueio com preparo insuficiente.
- Recuperações: eliminar inimigo (+1), análise (+2, gasta ação comum), descanso curto (metade) e longo (total).
- Typecheck + suíte completa de testes.
