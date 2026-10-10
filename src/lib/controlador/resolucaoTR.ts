import type { TestRequest } from '@/stores/useTestRequestStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { rollDiceGroups } from '@/lib/dice';
import { parseFormulaDanoInvocacao } from './rolagens';
import { causarDanoInvocacao } from './mapa';

/** Resolve o dano de uma ação de Shikigami depois que o alvo conclui o TR. */
export async function resolverDanoAposTRInvocacao(request: TestRequest): Promise<{
  passou: boolean;
  dano: number;
}> {
  const resolution = request.invocationResolution;
  const result = request.result;
  if (!resolution || !result || request.dc === undefined) {
    throw new Error('O pedido não contém resultado de TR com CD e efeito de invocação.');
  }
  const passou = result.forced
    ? result.forced.kind === 'success'
    : result.d20 !== 1 && result.total >= request.dc;
  let dano = 0;

  if (!passou || resolution.damageOnSuccess === 'metade') {
    const formula = parseFormulaDanoInvocacao(resolution.damageFormula);
    if (!formula) throw new Error(`Fórmula de dano inválida: ${resolution.damageFormula}`);
    const rolled = await rollDiceGroups(formula.dados, { label: `${resolution.sourceName} — dano após TR` });
    dano = Math.max(0, rolled.total + formula.fixo + (resolution.damageBonus ?? 0));
    if (passou) dano = Math.floor(dano / 2);
    if (dano > 0) {
      if (resolution.targetInvocation) {
        const aplicado = causarDanoInvocacao(
          resolution.targetInvocation.tokenId,
          dano,
          resolution.damageType,
          resolution.targetInvocation.invocationInstanceId,
        );
        if (!aplicado.ok) throw new Error(aplicado.motivo);
      } else {
        await useCharacterStore.getState().applyDamage(request.charId, dano, resolution.damageType, {
          attackerId: resolution.ownerCharacterId,
          source: 'omni',
        });
      }
    }
  }

  useLogStore.getState().addLog(
    'combat',
    `🛡️ ${request.charName} — ${request.testName}: d20 ${result.d20} + ${result.bonus} = ${result.total} vs CD ${request.dc} → ${passou ? 'sucesso' : 'falha'}. ${resolution.sourceName}: ${dano} ${resolution.damageType ?? 'DCO'} de dano aplicado.`,
  );
  return { passou, dano };
}
