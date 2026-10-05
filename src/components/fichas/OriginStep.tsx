import { cn } from '@/lib/utils';
import { ORIGIN_SPECS, CLAN_DATA, CLANS, FAH_ANATOMIES, CAM_CORES, type ClanId } from '@/lib/origins';
import { AURA_APTITUDES } from '@/lib/auraAptitudes';
import { attrChoiceFor, type OriginChoices } from '@/lib/originEngine';
import { ORIGINS, type Origin } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Crown, Wind, Bone, Layers, BookOpen, Zap, Shield, TrendingUp } from 'lucide-react';

const ATTR_ABBR: Record<string, string> = {
  'Força': 'FOR', 'Destreza': 'DES', 'Constituição': 'CON',
  'Inteligência': 'INT', 'Sabedoria': 'SAB', 'Presença': 'PRE',
};

interface Props {
  origin: Origin;
  setOrigin: (o: Origin) => void;
  choices: OriginChoices;
  setChoices: (c: OriginChoices) => void;
  /** Quantas anatomias o jogador pode escolher (varia com o nível para FAH). */
  anatomyAllowed: number;
}

/** Detalhes longos de cada clã exibidos no painel rolável. */
const CLAN_LORE: Record<ClanId, {
  flavor: string;
  highlights: string[];
  progression: string[];
}> = {
  Gojo: {
    flavor: 'Os Gojo são um dos Três Grandes Clãs e a única linhagem que produz portadores dos Seis Olhos e do Vazio Infinito. Sua sintonia com Energia Amaldiçoada é tão profunda que a própria Reserva (PE) cresce continuamente conforme amadurecem.',
    highlights: [
      'Atributos: +2 em INT ou SAB (à escolha) e +1 no atributo restante.',
      'Perícias: 2 treinos entre Feitiçaria, Percepção ou Intuição — OU 1 Maestria em uma delas.',
      'Potencial Lendário: +1 PE máximo a cada nível PAR (2, 4, 6, 8...).',
      'Slots de Feitiço bônus nos níveis 1, 5, 10, 15 e 20 (cumulativos).',
    ],
    progression: [
      'Nv 1: +1 slot de feitiço.',
      'Nv 2,4,6,8...: +1 PE máximo (curva contínua).',
      'Nv 5: +1 slot adicional.',
      'Nv 10: +1 slot adicional.',
      'Nv 15: +1 slot adicional.',
      'Nv 20: +1 slot adicional.',
    ],
  },
  Inumaki: {
    flavor: 'Herdeiros das Palavras Amaldiçoadas, os Inumaki impõem comandos absolutos com a voz. Falam pouco — usam onigaras (recheios de onigiri) para evitar amaldiçoar aliados — mas, em combate, sua palavra é lei.',
    highlights: [
      'Atributos: +2 em INT ou PRE (à escolha) e +1 no atributo restante.',
      'Perícias: 2 treinos entre Feitiçaria, Percepção ou Intuição — OU 1 Maestria em uma delas.',
      'Olhos de Cobra e Presas: como Ação Bônus, concede uma Ação Bônus a um aliado, gasta como Reação por ele.',
      'Usos diários iguais ao seu Bônus de Treinamento (Maestria). Reset no descanso LONGO.',
    ],
    progression: [
      'Bônus de Treinamento aumenta com o nível (3 → 4 → 5 → 6) — usos diários acompanham.',
      'Sem progressão de PV/PE específica do clã.',
    ],
  },
  Kamo: {
    flavor: 'Tradição férrea entre os Três Grandes Clãs, os Kamo cultivam o sangue como instrumento de guerra. Disciplinados ao extremo, seus corpos são forjados para resistir além do limite humano.',
    highlights: [
      'Atributos: +2 em CON ou SAB (à escolha) e +1 no atributo restante.',
      'Perícias: 2 treinos entre Atletismo, Medicina ou Persuasão — OU 1 Maestria em uma delas.',
      'Valor do Sangue: +1 PV máximo em CADA subida de nível.',
      'Reroll de PV: se rolar abaixo da média, rerola e mantém o MAIOR.',
      'Nv 10: soma o MOD de CON ao PV total novamente.',
    ],
    progression: [
      'Nv 1+: +1 PV/nível (curva contínua).',
      'Nv 10: +MOD CON adicional ao PV máximo.',
      'Rolagem de PV: reroll automático abaixo da média em todos os níveis.',
    ],
  },
  Zenin: {
    flavor: 'Tradição militar implacável dos Três Grandes Clãs. Os Zenin valorizam força bruta e disciplina marcial: cada feiticeiro escolhe um Feitiço Focado e o aprimora a níveis chave.',
    highlights: [
      'Atributos: +2 em qualquer atributo (à escolha) e +1 em outro.',
      'Perícias: 2 treinos LIVRES — OU 1 Maestria livre.',
      'Foco no Poder: marca um feitiço como FOCADO e escolhe UM bônus permanente para ele.',
      'Bônus de Feitiço Focado: (a) +1 dado de DANO; (b) +1 dado de CURA; (c) DOBRO de ALCANCE; (d) +CD igual ao Bônus de Treinamento.',
    ],
    progression: [
      'Nv 1: marca o 1º Feitiço Focado.',
      'Nv 5: 2º Feitiço Focado.',
      'Nv 10: 3º Feitiço Focado.',
      'Nv 15: 4º Feitiço Focado.',
      'Nv 20: 5º Feitiço Focado.',
    ],
  },
};

/**
 * Step de Origem do CharacterWizard. Renderiza:
 *  - dropdown de origem
 *  - dropdown +2/+1
 *  - sub-menus condicionais (Clã, Aura, Anatomia, Núcleo)
 *  - painel detalhado com scroll para o clã selecionado
 */
export function OriginStep({ origin, setOrigin, choices, setChoices, anatomyAllowed }: Props) {
  const spec = ORIGIN_SPECS[origin];
  const attrChoice = attrChoiceFor(origin, choices.clan);

  const update = (patch: Partial<OriginChoices>) => setChoices({ ...choices, ...patch });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Origem
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Sua Origem injeta atributos, habilidades e Trackers automaticamente na ficha.
        </p>
      </div>

      {/* Seleção de origem */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground font-medium">Escolha sua Origem</label>
        <select
          value={origin}
          onChange={(e) => {
            // Reset escolhas dependentes ao trocar de origem
            setOrigin(e.target.value as Origin);
            setChoices({});
          }}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
        >
          {ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs text-muted-foreground">
          <strong className="text-primary">{spec.shortLabel}:</strong> {spec.description}
        </div>
      </div>

      {/* Sub-menu: Clã (Herdado) */}
      {origin === 'Herdado' && (
        <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <label className="text-sm font-bold text-primary flex items-center gap-1">
            <Crown className="h-3.5 w-3.5" /> Selecionar Clã
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CLANS.map(c => (
              <button
                key={c}
                onClick={() => update({ clan: c, primaryAttr: undefined, secondaryAttr: undefined })}
                className={cn(
                  'rounded-lg border px-3 py-2 text-xs font-bold transition-all text-left',
                  choices.clan === c
                    ? 'bg-primary/25 text-primary border-primary/60'
                    : 'bg-secondary/40 text-muted-foreground border-border hover:border-primary/40',
                )}
              >
                <div className="text-sm">{c}</div>
                <div className="text-xs font-normal mt-0.5 text-muted-foreground line-clamp-2">
                  {CLAN_DATA[c].description}
                </div>
              </button>
            ))}
          </div>

          {/* Painel detalhado do clã (rolável) */}
          {choices.clan && (
            <ScrollArea className="h-64 rounded-lg border border-primary/40 bg-background/60">
              <div className="p-3 space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-primary flex items-center gap-1.5">
                    <Crown className="h-3.5 w-3.5" /> Clã {choices.clan}
                  </h3>
                  <p className="text-xs text-muted-foreground italic mt-1 leading-relaxed">
                    {CLAN_LORE[choices.clan].flavor}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs uppercase tracking-wider font-bold text-accent flex items-center gap-1">
                    <Zap className="h-3 w-3" /> Bônus & Mecânicas
                  </div>
                  <ul className="space-y-1 text-xs text-foreground/90">
                    {CLAN_LORE[choices.clan].highlights.map((h, i) => (
                      <li key={i} className="flex gap-1.5 leading-snug">
                        <span className="text-primary mt-0.5">▸</span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs uppercase tracking-wider font-bold text-pe flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Progressão por Nível
                  </div>
                  <ul className="space-y-1 text-xs text-foreground/85">
                    {CLAN_LORE[choices.clan].progression.map((p, i) => (
                      <li key={i} className="flex gap-1.5 leading-snug">
                        <span className="text-pe mt-0.5">●</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs uppercase tracking-wider font-bold text-hp flex items-center gap-1">
                    <Shield className="h-3 w-3" /> Habilidades de Clã
                  </div>
                  {CLAN_DATA[choices.clan].abilities.map((a, i) => (
                    <div key={i} className="rounded border border-border bg-secondary/30 p-2">
                      <div className="text-xs font-bold text-foreground">{a.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{a.description}</div>
                    </div>
                  ))}
                </div>

                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1">
                    <BookOpen className="h-3 w-3" /> Perícias treináveis
                  </div>
                  <p className="text-xs text-foreground/80">
                    {CLAN_DATA[choices.clan].training.hint}
                  </p>
                </div>
              </div>
            </ScrollArea>
          )}
        </div>
      )}

      {/* Dropdown +2/+1 (depende da origem/clã) */}
      {attrChoice && (
        <div className="space-y-2 rounded-xl border border-accent/30 bg-accent/5 p-3">
          <label className="text-sm font-bold text-accent flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" /> Bônus de Atributo
          </label>
          <p className="text-xs text-muted-foreground">{attrChoice.hint}</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-primary font-bold">+2</label>
              <select
                value={choices.primaryAttr ?? ''}
                onChange={(e) => update({ primaryAttr: e.target.value as never })}
                className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs text-foreground"
              >
                <option value="">— escolher —</option>
                {(attrChoice.pickFrom ?? Object.keys(ATTR_ABBR)).map(a => (
                  <option key={a} value={a}>{ATTR_ABBR[a]} — {a}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-pe font-bold">+1</label>
              <select
                value={choices.secondaryAttr ?? ''}
                onChange={(e) => update({ secondaryAttr: e.target.value as never })}
                className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs text-foreground"
              >
                <option value="">— escolher —</option>
                {(attrChoice.secondaryPickFrom ?? Object.keys(ATTR_ABBR))
                  .filter(a => a !== choices.primaryAttr)
                  .map(a => (
                    <option key={a} value={a}>{ATTR_ABBR[a]} — {a}</option>
                  ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Sub-menu: Aptidão de Aura (Derivado) */}
      {origin === 'Derivado' && (() => {
        const auraList = AURA_APTITUDES.filter((a) => (a.family ?? 'AU') === 'AU');
        const fmtPrereqs = (a: typeof AURA_APTITUDES[number]): string[] => {
          const out: string[] = [];
          if (a.prerequisitesText) out.push(a.prerequisitesText);
          const p = a.prereqs;
          if (p) {
            if (p.minLevel) out.push(`Nível ≥ ${p.minLevel}`);
            if (p.minAU) out.push(`AU ≥ ${p.minAU}`);
            if (p.minCL) out.push(`CL ≥ ${p.minCL}`);
            if (p.minBAR) out.push(`BAR ≥ ${p.minBAR}`);
            if (p.minDOM) out.push(`DOM ≥ ${p.minDOM}`);
            if (p.minER) out.push(`ER ≥ ${p.minER}`);
            if (p.attrMin) {
              for (const [k, v] of Object.entries(p.attrMin)) {
                if (v) out.push(`${k} ≥ ${v}`);
              }
            }
            if (p.requiredSkillTrained?.length) out.push(`Treino: ${p.requiredSkillTrained.join(', ')}`);
            if (p.requiredClans?.length) out.push(`Clãs: ${p.requiredClans.join(', ')}`);
            if (p.requiresAuraIds?.length) out.push(`Requer: ${p.requiresAuraIds.join(', ')}`);
            if (p.requiresAptitudeIds?.length) out.push(`Requer: ${p.requiresAptitudeIds.join(', ')}`);
          }
          return out;
        };
        return (
          <div className="space-y-2 rounded-xl border border-pe/30 bg-pe/5 p-3">
            <label className="text-sm font-bold text-pe flex items-center gap-1">
              <Wind className="h-3.5 w-3.5" /> Aptidão Amaldiçoada de Aura
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {auraList.length} disponíveis
              </span>
            </label>
            <p className="text-xs text-muted-foreground">
              Escolha uma aptidão de Aura para iniciar como Derivado. Clique no card para selecionar.
            </p>
            <ScrollArea className="h-80 rounded-lg border border-pe/40 bg-background/40">
              <div className="grid grid-cols-1 gap-1.5 p-2">
                {auraList.map((a) => {
                  const selected = choices.auraAptitudeId === a.id;
                  const prereqs = fmtPrereqs(a);
                  return (
                    <button
                      key={a.id}
                      onClick={() => update({ auraAptitudeId: a.id })}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-left text-xs transition-all',
                        selected
                          ? 'bg-pe/20 border-pe/60 text-foreground'
                          : 'bg-secondary/40 border-border text-muted-foreground hover:border-pe/40',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-sm text-foreground">{a.name}</div>
                        {a.activation && (
                          <span className="text-xs uppercase tracking-wider rounded-full bg-pe/20 text-pe px-1.5 py-0.5 font-bold">
                            {a.activation}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 leading-relaxed text-xs opacity-90">{a.mechanic}</div>
                      {prereqs.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {prereqs.map((pr, i) => (
                            <span key={i} className="rounded border border-pe/40 bg-pe/10 px-1.5 py-0.5 text-xs text-pe">
                              {pr}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        );
      })()}

      {/* Sub-menu: Anatomia (FAH) */}
      {origin === 'Feto Amaldiçoada Híbrido (FAH)' && (
        <div className="space-y-2 rounded-xl border border-hp/30 bg-hp/5 p-3">
          <label className="text-sm font-bold text-hp flex items-center gap-1">
            <Bone className="h-3.5 w-3.5" /> Características de Anatomia
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {(choices.anatomyIds ?? []).length} / {anatomyAllowed}
            </span>
          </label>
          <p className="text-xs text-muted-foreground -mt-1">
            Slots abrem nos níveis 1, 5, 10, 15 e 20. Cada anatomia aplica modificadores passivos automáticos (HP, deslocamento, RD, perícias…).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {FAH_ANATOMIES.map(a => {
              const selected = (choices.anatomyIds ?? []).includes(a.id);
              const atLimit = (choices.anatomyIds ?? []).length >= anatomyAllowed;
              return (
                <button
                  key={a.id}
                  disabled={!selected && atLimit}
                  onClick={() => {
                    const cur = choices.anatomyIds ?? [];
                    update({
                      anatomyIds: selected ? cur.filter(x => x !== a.id) : [...cur, a.id],
                    });
                  }}
                  className={cn(
                    'rounded-lg border px-2 py-1.5 text-left text-xs transition-all',
                    selected
                      ? 'bg-hp/20 border-hp/60 text-foreground'
                      : 'bg-secondary/40 border-border text-muted-foreground hover:border-hp/40 disabled:opacity-30 disabled:cursor-not-allowed',
                  )}
                >
                  <div className="font-bold">{a.name}</div>
                  <div className="text-xs mt-0.5 opacity-80 line-clamp-2">{a.description}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-menu: Núcleo Primário (CAM) */}
      {origin === 'Corpo Amaldiçoado Mutante (CAM)' && (
        <div className="space-y-2 rounded-xl border border-accent/40 bg-accent/5 p-3">
          <label className="text-sm font-bold text-accent flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" /> Núcleo Primário
          </label>
          <p className="text-xs text-muted-foreground">
            O Núcleo Primário define seus PV e PE máximos. Você poderá realocar atributos por núcleo após criar a ficha.
          </p>
          <div className="grid grid-cols-1 gap-1.5">
            {CAM_CORES.map(c => (
              <button
                key={c.id}
                onClick={() => update({ primaryCoreId: c.id })}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left text-xs transition-all',
                  choices.primaryCoreId === c.id
                    ? 'bg-accent/20 border-accent/60 text-foreground'
                    : 'bg-secondary/40 border-border text-muted-foreground hover:border-accent/40',
                )}
              >
                <div className="font-bold text-sm">{c.name}</div>
                <div className="text-xs mt-0.5 opacity-80">{c.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
