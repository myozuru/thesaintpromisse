/**
 * ============================================================================
 *  SPEC ACTIONS PANEL — Bloco B (5 Modais Ativos do Especialista em Técnica)
 * ============================================================================
 *  Ações ativas: cada botão aplica side-effects determinísticos (PE, flags)
 *  e gera log narrativo. Filosofia idêntica ao SpecReactionsPanel/FahPanel —
 *  limites e gatilhos manuais ficam sob administração do jogador.
 *
 *  Cobre:
 *    B1 tec-finta-amaldicoada       → Fintar (Logro/Enganação) com Mod_Chave
 *    B2 tec-mira-aperfeicoada       → Mirar (próximo ataque amaldiçoado +TB)
 *    B3 tec-ritualista / -naturalidade → Ritual com +2 conjuração, +⌊TB/2⌋ melhorias
 *    B4 tec-imbuir-com-tecnica      → −2 PE: armazena feitiço em arma; libera no próximo CaC
 *    B6 tec-versatilidade-em-fundamentos → log de troca de Mudança de Fundamento (descanso longo)
 * ============================================================================
 */
import { useState } from 'react';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { getSpecKeyMod } from '@/lib/specKeyMod';
import { rollD20Com } from '@/lib/dice';
import { Eye, Crosshair, BookOpen, Swords, Repeat, Sparkles, X } from 'lucide-react';

interface Props {
  character: Character;
}

const ACTION_IDS = [
  'tec-finta-amaldicoada',
  'tec-mira-aperfeicoada',
  'tec-ritualista',
  'tec-naturalidade-com-rituais',
  'tec-imbuir-com-tecnica',
  'tec-versatilidade-em-fundamentos',
] as const;

export function SpecActionsPanel({ character: c }: Props) {
  const updateCharacter = useCharacterStore((s) => s.updateCharacter);
  const addLog = useLogStore((s) => s.addLog);
  const [imbuir, setImbuir] = useState('');

  const chosen = new Set((c.chosenSpecAbilities ?? []).map((a) => a.abilityId));
  const has = (id: string) => chosen.has(id);
  const anyVisible = ACTION_IDS.some((id) => chosen.has(id));
  if (!anyVisible) return null;

  const tb = getTrainingBonusByLevel(c.level);
  const keyMod = getSpecKeyMod(c);
  const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  const fmtRoll = async (label: string) => {
    const nat = await rollD20Com(c.id);
    const total = nat + tb + keyMod;
    addLog(
      'combat',
      `🎲 ${c.name}: ${label} → d20(${nat}) + TB(${tb}) + Mod_Chave(${sign(keyMod)}) = ${total}.`,
    );
  };

  const spendPE = (cost: number): boolean => {
    const t0 = c.tempPE ?? 0;
    const fromTemp = Math.min(t0, cost);
    const fromMain = cost - fromTemp;
    if (c.peCurrent < fromMain) {
      addLog('combat', `⚠️ ${c.name}: PE insuficiente (precisa ${cost}).`);
      return false;
    }
    updateCharacter(c.id, {
      tempPE: t0 - fromTemp,
      peCurrent: c.peCurrent - fromMain,
    });
    return true;
  };

  const handleFinta = () => fmtRoll('Finta Amaldiçoada (Logro/Enganação · Mod_Chave)');
  const handleMira = () =>
    addLog(
      'combat',
      `🎯 ${c.name}: Mirando — próximo ataque amaldiçoado ganha +${tb} no acerto (Técnica Precisa +${has('tec-mira-aperfeicoada') ? 1 : 0}). Custo: Ação Padrão.`,
    );
  const handleRitual = () => {
    const livre = Math.floor(tb / 2);
    const usaInt = has('tec-naturalidade-com-rituais');
    addLog(
      'combat',
      `📖 ${c.name}: Conduzindo Ritual — +2 na conjuração${
        livre > 0 ? `, ${livre} melhoria(s) grátis` : ''
      }${usaInt ? ', Prestidigitação usa Mod_Chave' : ''}.`,
    );
  };
  const handleImbuir = () => {
    const name = imbuir.trim();
    if (!name) {
      addLog('combat', `⚠️ ${c.name}: informe o feitiço a imbuir.`);
      return;
    }
    if (c.imbuedSpell) {
      addLog('combat', `⚠️ ${c.name}: já há feitiço imbuído (${c.imbuedSpell}). Libere antes.`);
      return;
    }
    if (!spendPE(2)) return;
    updateCharacter(c.id, { imbuedSpell: name });
    addLog('combat', `🔮 ${c.name}: Imbuiu "${name}" na arma (−2 PE). Liberar no próximo ataque CaC.`);
    setImbuir('');
  };
  const handleLiberar = () => {
    if (!c.imbuedSpell) return;
    const name = c.imbuedSpell;
    updateCharacter(c.id, { imbuedSpell: undefined });
    addLog('combat', `⚔️ ${c.name}: Liberou "${name}" da arma no ataque CaC (efeito direto se TR aplicável).`);
  };
  const handleVersatilidade = () =>
    addLog(
      'combat',
      `🔄 ${c.name}: Descanso Longo — trocou 1 Mudança de Fundamento conhecida por outra.`,
    );

  return (
    <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-3 space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-4 w-4 text-cyan-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
          Ações — Especialista em Técnica
        </span>
        <span className="ml-auto text-xs text-muted-foreground font-mono">
          TB {tb} · Mod_Chave {sign(keyMod)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        {has('tec-finta-amaldicoada') && (
          <ActionRow
            icon={Eye}
            name="Finta Amaldiçoada"
            hint="Rola Logro/Enganação usando Mod_Chave"
            onClick={handleFinta}
          />
        )}
        {has('tec-mira-aperfeicoada') && (
          <ActionRow
            icon={Crosshair}
            name="Mirar (Amaldiçoado)"
            hint={`+${tb} no próximo ataque amaldiçoado · Ação Padrão`}
            onClick={handleMira}
          />
        )}
        {(has('tec-ritualista') || has('tec-naturalidade-com-rituais')) && (
          <ActionRow
            icon={BookOpen}
            name="Conduzir Ritual"
            hint={`+2 conjuração${has('tec-ritualista') ? `, ${Math.floor(tb / 2)} melhoria(s) grátis` : ''}${has('tec-naturalidade-com-rituais') ? ' · Prestidig. usa Mod_Chave' : ''}`}
            onClick={handleRitual}
          />
        )}
        {has('tec-imbuir-com-tecnica') && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-2.5 py-1.5">
            <Swords className="h-3.5 w-3.5 flex-shrink-0 text-cyan-400" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold truncate">Imbuir com Técnica</div>
              <div className="text-xs text-muted-foreground truncate">
                {c.imbuedSpell ? `Imbuído: ${c.imbuedSpell}` : '−2 PE · armazena feitiço na arma'}
              </div>
            </div>
            {c.imbuedSpell ? (
              <button
                onClick={handleLiberar}
                className="rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase tracking-wider px-2.5 py-1 transition-colors flex items-center gap-1"
                title="Liberar feitiço no ataque CaC"
              >
                <X className="h-3 w-3" /> Liberar
              </button>
            ) : (
              <>
                <input
                  type="text"
                  value={imbuir}
                  onChange={(e) => setImbuir(e.target.value)}
                  placeholder="Nome do feitiço"
                  className="h-6 w-32 rounded border border-input bg-background px-1.5 text-xs"
                />
                <button
                  onClick={handleImbuir}
                  className="rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase tracking-wider px-2.5 py-1 transition-colors"
                >
                  Imbuir
                </button>
              </>
            )}
          </div>
        )}
        {has('tec-versatilidade-em-fundamentos') && (
          <ActionRow
            icon={Repeat}
            name="Trocar Fundamento"
            hint="Descanso Longo · troca 1 Mudança de Fundamento conhecida"
            onClick={handleVersatilidade}
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground italic">
        Limites de uso e gatilhos contextuais ficam sob administração manual.
      </p>
    </div>
  );
}

function ActionRow({
  icon: Icon,
  name,
  hint,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-2.5 py-1.5">
      <Icon className="h-3.5 w-3.5 flex-shrink-0 text-cyan-400" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold truncate">{name}</div>
        <div className="text-xs text-muted-foreground truncate">{hint}</div>
      </div>
      <button
        onClick={onClick}
        className="rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase tracking-wider px-2.5 py-1 transition-colors flex-shrink-0"
      >
        Ativar
      </button>
    </div>
  );
}
