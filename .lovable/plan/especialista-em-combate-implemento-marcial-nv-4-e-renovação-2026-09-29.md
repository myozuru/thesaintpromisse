# Especialista em Combate — Implemento Marcial (Nv 4) e Renovação pelo Sangue (Nv 6)

## O que já existe

- **Implemento Marcial** já está implementado em `src/lib/golpeEspecial.ts` (`implementoMarcialBonus`: +2 no nv 4, +3 no nv 8, +4 no nv 16) e já entra na **CD de Especialização** exibida na ficha.
- O que falta verificar/garantir: o bônus também chegar à **CD de Feitiços e Aptidões Amaldiçoadas** (hoje o `SpellApplyDialog` usa `classCdBonus`, que é preenchido pela progressão do Lutador — precisa ser preenchido também para o Especialista em Combate).

## 1. Implemento Marcial — completar a aplicação

- Garantir que `classCdBonus` (ou equivalente) do Especialista em Combate inclua `implementoMarcialBonus(c)` nas CDs de:
  - Habilidades de Especialização (já funciona);
  - Feitiços (SpellApplyDialog);
  - Aptidões Amaldiçoadas (mesmo fluxo de CD).
- Escalonamento: +2 (nv 4), +3 (nv 8), +4 (nv 16) — já correto em `implementoMarcialBonus`.

## 2. Renovação pelo Sangue (Nv 6) — novo

Regra: ao **acertar um ataque crítico** em um inimigo **ou reduzir os PV do inimigo a 0**, recupera **1 PE** (sem ultrapassar o máximo).

Implementação:

- `src/lib/renovacaoSangue.ts` (novo):
  - `renovacaoSangueAtiva(c)`: true se Especialista em Combate nv ≥ 6.
  - `aplicarRenovacao(c)`: `peCurrent = min(peMax, peCurrent + 1)`, retorna se houve recuperação.
- `src/components/fichas/AttackPanel.tsx`:
  - Após `applyDamage` no alvo: se crítico **ou** PV do alvo chegou a 0 → `aplicarRenovacao` + log de combate (`🩸 Renovação pelo Sangue: +1 PE`).
  - Mesmo gancho nos ataques extras (Golpe Amplo, Arremesso Ágil) e no ataque do Golpe Especial.
  - Sem efeito se PE já estiver no máximo (log informativo opcional).
- Sem custo, sem limite de usos — dispara toda vez que a condição ocorre.

## 3. Testes (regra permanente: combate real com peças no mapa)

- `src/test/renovacaoSangue.test.ts`: regras puras (nv 5 não ativa, nv 6 ativa, teto de PE respeitado).
- `src/test/renovacaoSangueCombate.test.tsx`: harness real com peças no mapa e cliques:
  - Crítico forçado (d20=20) → +1 PE;
  - Acerto comum que zera PV do alvo → +1 PE;
  - Acerto comum sem zerar PV → sem recuperação;
  - PE no máximo → não ultrapassa;
  - Personagem nv 4 (sem a habilidade) → sem recuperação.
- Teste de CD: `implementoMarcialBonus` refletido na CD de feitiço/aptidão nos níveis 4/8/16.
- Rodar suíte completa + typecheck + `git diff --check`.

## Detalhes técnicos

- Arquivos: `src/lib/renovacaoSangue.ts` (novo), `src/lib/golpeEspecial.ts` (já tem o bônus), `src/components/fichas/AttackPanel.tsx`, `src/components/fichas/SpellApplyDialog.tsx` (se precisar), `src/lib/lutadorProgression.ts` ou progressão do Especialista (preencher `classCdBonus`).
- O gancho de Renovação fica no pós-dano do AttackPanel, onde `applyDamage` já atualiza os PV do alvo — leitura fresca do store para saber se chegou a 0.
