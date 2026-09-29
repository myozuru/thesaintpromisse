# Especialista em Combate — Nível 4: Golpe Especial e Implemento Marcial

## O que o jogador vai ver
- A partir do nível 4 de Especialista em Combate, o painel de Ataque ganha a seção **Golpe Especial**. Nela o jogador monta o ataque marcando as propriedades e vê o **custo total em PE** (mínimo 1) antes de rolar.
- Também funciona junto com as Artes do Combate que envolvem ataque (Distração, Execução, Golpe Descendente, Investida, Arremesso Ágil).
- O PE só é gasto depois que todas as checagens passam (alcance, alvos, PE suficiente).
- A ficha mostra "Implemento Marcial +2/+3/+4" e o bônus entra na CD.

## Propriedades
| Propriedade | Custo | Regra implementada |
|---|---|---|
| Amplo | +2 | Escolhe um 2º alvo **dentro do alcance da arma** (medido no mapa); acerto e dano rolados **separadamente** contra ele |
| Atroz | +1 | No acerto, +1 dado de dano da arma |
| Impactante | +1 | Empurra o alvo 1,5 m para cada 15 de dano, afastando-o do atacante no mapa; teste de Fortitude bem-sucedido corta pela metade |
| Letal | +2 | Margem de crítico diminui em 1 |
| Longo | +1 | +1,5 m corpo a corpo / +9 m à distância (vale para a checagem de alcance) |
| Penetrante | +2 | Ignora RD igual a metade do nível do personagem |
| Preciso | +1 / +2 | Vantagem no acerto; custa 2 PE depois do 1º uso **no próprio turno** e volta a 1 PE no turno seguinte |
| Sanguinário (x1 ou x2) | +2 cada | Alvo atingido sofre sangramento leve (1x) ou médio (2x), CD de Especialização |
| Lento | −2 | Ação completa: gasta ação padrão, ação bônus e movimento do turno; bloqueia se já tiverem sido usados |
| Sacrifício | −1 | O atacante recebe 15 de dano ao atacar |
| Desfocado (até 3x) | −1 cada | −4 no acerto por vez |

## Implemento Marcial
+2 na CD de Habilidades de Especialização, Feitiços e Aptidões Amaldiçoadas; +3 no nível 8 e +4 no nível 16 de Especialista em Combate.

## Testes (obrigatórios, combate real simulado)
- Regras: cálculo de custo (mínimo 1, descontos, Preciso escalando por turno, Sanguinário x2, Desfocado x3), nível abaixo de 4 bloqueado, Implemento em 4/8/16.
- Combate com peças no mapa e cliques reais: Amplo com 2º alvo dentro e fora do alcance; Longo liberando um alvo que antes estava fora; Atroz/Letal/Penetrante com dados forçados; Impactante empurrando no mapa com e sem Fortitude; Sanguinário aplicando a condição; Lento bloqueando depois de uma ação já usada; Sacrifício tirando PV; PE insuficiente não gasta nada nem move peças; combinação com Investida.
- Depois: typecheck, suíte completa e build.

## Detalhes técnicos
- Novo módulo `src/lib/golpeEspecial.ts` (catálogo, `custoGolpeEspecial`, `implementoMarcialBonus`, contador de Preciso por turno) seguindo o padrão de `artesCombate.ts`.
- UI `GolpeEspecialSection.tsx` embutida em `AttackPanel.tsx`; validações/gasto integrados ao fluxo `handleRoll` já existente das Artes.
- `combatEngine.ts`: novos campos em `AttackSituation` (dado extra, margem de crítico, ignorar RD, penalidade, vantagem).
- CD: somar `implementoMarcialBonus` onde a CD de especialização/feitiços/aptidões é calculada.
- Ação completa usa o estado de ações do turno existente no combate; sangramento usa as condições existentes (verificar nomes leve/médio no catálogo e criar se faltarem).
