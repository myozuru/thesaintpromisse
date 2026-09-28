/**
 * Regras puras da Origem Derivado (Energia Antinatural + Desenvolvimento Inesperado).
 */
import { AURA_APTITUDES } from './auraAptitudes';
import type { Character } from '@/types';

const ATTR_KEY_TO_NAME: Record<string, string> = {
  FOR: 'Força', DES: 'Destreza', CON: 'Constituição',
  INT: 'Inteligência', SAB: 'Sabedoria', PRE: 'Presença',
};

/**
 * Requisitos da Aptidão de Aura que o Derivado ainda NÃO atende.
 * Checa atributos (mín e "qualquer um"), nível e perícias treinadas.
 * Lista vazia = pode escolher.
 */
export function derivadoAuraPrereqIssues(
  aptitudeId: string | undefined,
  attrs: Record<string, number>,
  level: number,
  trainedSkills: string[] = [],
): string[] {
  if (!aptitudeId) return [];
  const apt = AURA_APTITUDES.find((a) => a.id === aptitudeId);
  const p = apt?.prereqs;
  if (!p) return [];
  const out: string[] = [];
  if (p.minLevel && level < p.minLevel) out.push(`Nível ${p.minLevel}`);
  if (p.attrMin) {
    for (const [k, v] of Object.entries(p.attrMin)) {
      const name = ATTR_KEY_TO_NAME[k] ?? k;
      if (v && (attrs[name] ?? 10) < v) out.push(`${name} ${v}`);
    }
  }
  if (p.attrMinAny) {
    const entries = Object.entries(p.attrMinAny).filter(([, v]) => !!v);
    if (entries.length && !entries.some(([k, v]) => (attrs[ATTR_KEY_TO_NAME[k] ?? k] ?? 10) >= (v as number))) {
      out.push(entries.map(([k, v]) => `${ATTR_KEY_TO_NAME[k] ?? k} ${v}`).join(' ou '));
    }
  }
  if (p.requiredSkillTrained?.length) {
    const lower = trainedSkills.map((s) => s.toLowerCase());
    for (const s of p.requiredSkillTrained) {
      if (!lower.includes(s.toLowerCase())) out.push(`Treinado em ${s}`);
    }
  }
  return out;
}

/** Valida se a Recuperação de Emergência pode ser usada agora. */
export function checkDerivadoEmergency(c: Character | undefined, inCombat: boolean): { ok: boolean; reason?: string } {
  if (!c) return { ok: false, reason: 'Personagem não encontrado.' };
  if (c.origin !== 'Derivado') return { ok: false, reason: 'Apenas a origem Derivado possui Recuperação de Emergência.' };
  if (!inCombat) return { ok: false, reason: 'Só pode ser usada dentro de combate.' };
  if (c.derivadoEmergencyUsed) return { ok: false, reason: 'Já utilizada hoje. Reseta no Descanso Longo.' };
  if ((c.bonusActionsCurrent ?? 0) <= 0) return { ok: false, reason: 'Ação Bônus insuficiente.' };
  return { ok: true };
}
