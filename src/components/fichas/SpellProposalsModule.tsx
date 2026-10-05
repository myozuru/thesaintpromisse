import { useMemo, useState } from 'react';
import { useSpellProposalStore, SpellProposal, SpellDiffEntry } from '@/stores/useSpellProposalStore';
import { usePassiveProposalStore, PassiveProposal, PassiveDiffEntry } from '@/stores/usePassiveProposalStore';
import { useOmniProposalStore, OmniProposal, OmniDiffEntry } from '@/stores/useOmniProposalStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import type { EntidadeOmni } from '@/lib/omni/tipos';
import { ConstrutorEntidade } from '@/components/omni/ConstrutorEntidade';
import { OmniItemDescription } from '@/components/omni/OmniItemDescription';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useLogStore } from '@/stores/useLogStore';
import { useSpellLibraryStore } from '@/stores/useSpellLibraryStore';
import { usePassiveLibraryStore } from '@/stores/usePassiveLibraryStore';
import { useItemStore } from '@/stores/useItemStore';
import { Spell, Passive, Item, createEmptyRdByType } from '@/types';
import { Wand2, Check, X, MessageSquare, Edit, Clock, ChevronDown, Star, Sparkles, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SpellCreationAssistant } from './SpellCreationAssistant';
import { PassiveEditor } from './PassiveEditor';
import { usePendingDebates } from '@/hooks/usePendingDebates';
import { ACOES_EFEITO, ALVOS_REFERENCIA, OPERADORES_LOGICOS, ROTULOS_GATILHOS } from '@/lib/omni/constantesDoSistema';
import { humanizarFormula, nomeAmigavelRecurso } from '@/lib/omni/omniScript';

function fmtVal(v: any): string {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

function DiffList({ diff }: { diff: SpellDiffEntry[] }) {
  if (!diff || diff.length === 0) {
    return <p className="text-xs italic text-muted-foreground">Sem alterações em relação à revisão anterior.</p>;
  }
  return (
    <ul className="space-y-1">
      {diff.map((d, i) => (
        <li key={i} className="rounded-md border border-border bg-secondary/30 px-2 py-1 text-xs">
          <span className="font-semibold text-foreground">{d.label}: </span>
          <span className="text-hp line-through">{fmtVal(d.before)}</span>
          <span className="mx-1 text-muted-foreground">→</span>
          <span className="text-neon-green font-semibold">{fmtVal(d.after)}</span>
        </li>
      ))}
    </ul>
  );
}

function PassiveDiffList({ diff }: { diff: PassiveDiffEntry[] }) {
  if (!diff || diff.length === 0) {
    return <p className="text-xs italic text-muted-foreground">Sem alterações em relação à revisão anterior.</p>;
  }
  return (
    <ul className="space-y-1">
      {diff.map((d, i) => (
        <li key={i} className="rounded-md border border-border bg-secondary/30 px-2 py-1 text-xs">
          <span className="font-semibold text-foreground">{d.label}: </span>
          <span className="text-hp line-through">{fmtVal(d.before)}</span>
          <span className="mx-1 text-muted-foreground">→</span>
          <span className="text-neon-green font-semibold">{fmtVal(d.after)}</span>
        </li>
      ))}
    </ul>
  );
}

function PassiveSummary({ p }: { p: Passive }) {
  return (
    <div className="rounded-md border border-border bg-background/50 p-2 text-xs space-y-0.5">
      <div className="font-bold text-primary">{p.name}</div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="text-muted-foreground">Nv {p.spellLevel ?? '1'}</span>
        {p.bonusHP ? <span className="text-hp">HP {p.bonusHP >= 0 ? '+' : ''}{p.bonusHP}</span> : null}
        {p.bonusPE ? <span className="text-pe">PE {p.bonusPE >= 0 ? '+' : ''}{p.bonusPE}</span> : null}
        {p.bonusESC ? <span className="text-shield">ESC {p.bonusESC >= 0 ? '+' : ''}{p.bonusESC}</span> : null}
        {p.bonusCA ? <span className="text-primary">CA {p.bonusCA >= 0 ? '+' : ''}{p.bonusCA}</span> : null}
        {p.bonusRD ? <span className="text-pe">RD {p.bonusRD >= 0 ? '+' : ''}{p.bonusRD}</span> : null}
        {p.bonusSlots ? <span>Slots {p.bonusSlots >= 0 ? '+' : ''}{p.bonusSlots}</span> : null}
      </div>
      {p.description && <div className="text-muted-foreground italic">{p.description}</div>}
    </div>
  );
}

function PassiveProposalCard({ proposal, asMaster }: { proposal: PassiveProposal; asMaster: boolean }) {
  const characters = useCharacterStore((s) => s.characters);
  const addPassive = useCharacterStore((s) => s.addPassive);
  const addLog = useLogStore((s) => s.addLog);
  const { approve, reject, counterByMaster, acceptMasterCounter, rejectMasterCounter, remove } =
    usePassiveProposalStore();
  const [open, setOpen] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [counterMode, setCounterMode] = useState(false);
  const [note, setNote] = useState('');

  const character = characters.find((c) => c.id === proposal.characterId);
  const last = proposal.revisions[proposal.revisions.length - 1];

  const apply = (passive: Passive) => {
    if (!character) return;
    addPassive(character.id, passive);
    // Também registra no Catálogo do Mestre para reutilização futura.
    usePassiveLibraryStore.getState().registrar(passive, proposal.characterName);
  };

  const handleApprove = () => {
    if (asMaster) {
      approve(proposal.id, apply);
      addLog('system', `✅ Mestre aprovou a passiva "${last.passive.name}" de ${proposal.characterName}.`);
    } else {
      acceptMasterCounter(proposal.id, apply);
      addLog('system', `✅ ${proposal.characterName} aceitou a contraproposta da passiva "${last.passive.name}".`);
    }
  };
  const handleReject = () => {
    const r = note.trim() || undefined;
    if (asMaster) {
      reject(proposal.id, r);
      addLog('system', `❌ Mestre recusou a passiva "${last.passive.name}" de ${proposal.characterName}.${r ? ` Motivo: ${r}` : ''}`);
    } else {
      rejectMasterCounter(proposal.id, r);
      addLog('system', `❌ ${proposal.characterName} recusou a contraproposta da passiva "${last.passive.name}".${r ? ` Motivo: ${r}` : ''}`);
    }
    setNote('');
  };
  const handleCounter = (newPassive: Passive) => {
    const r = note.trim() || undefined;
    counterByMaster(proposal.id, newPassive, r);
    addLog('system', `✏️ Mestre fez uma contraproposta para a passiva "${newPassive.name}" (${proposal.characterName}).`);
    setCounterMode(false);
    setNote('');
  };

  const statusBadge = {
    pending: { label: 'Aguardando Mestre', cn: 'bg-neon-yellow/20 text-neon-yellow border-neon-yellow/40' },
    counter_master: { label: 'Contraproposta do Mestre', cn: 'bg-primary/20 text-primary border-primary/40' },
    approved: { label: 'Aprovada', cn: 'bg-neon-green/20 text-neon-green border-neon-green/40' },
    rejected: { label: 'Recusada', cn: 'bg-hp/20 text-hp border-hp/40' },
  }[proposal.status];

  const canAct =
    proposal.status !== 'approved' && proposal.status !== 'rejected'
    && ((asMaster && proposal.status === 'pending')
      || (!asMaster && proposal.status === 'counter_master'));

  return (
    <div className="rounded-xl border-2 border-primary/30 bg-card/80 p-3 space-y-2">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 text-left">
        <Star className="h-4 w-4 text-primary" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground truncate">{last.passive.name}</div>
          <div className="text-xs text-muted-foreground">
            {proposal.characterName} · {new Date(proposal.updatedAt).toLocaleString()}
          </div>
        </div>
        <span className={cn('rounded-full border px-2 py-0.5 text-xs font-bold uppercase', statusBadge.cn)}>
          {statusBadge.label}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="space-y-2 pt-1">
          <PassiveSummary p={last.passive} />
          {last.note && (
            <div className="rounded-md border border-border bg-secondary/30 px-2 py-1 text-xs">
              <span className="font-bold text-muted-foreground">Comentário ({last.by === 'PLAYER' ? 'Player' : 'Mestre'}): </span>
              {last.note}
            </div>
          )}
          {last.diff.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Mudanças desta revisão</div>
              <PassiveDiffList diff={last.diff} />
            </div>
          )}
          {proposal.revisions.length > 1 && (
            <button onClick={() => setShowHistory(!showHistory)} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
              <Clock className="h-3 w-3" /> {showHistory ? 'Ocultar' : 'Ver'} histórico ({proposal.revisions.length} revisões)
            </button>
          )}
          {showHistory && (
            <div className="space-y-2 border-l-2 border-border pl-2">
              {proposal.revisions.slice(0, -1).map((rev, i) => (
                <div key={i} className="space-y-1">
                  <div className="text-xs font-bold uppercase text-muted-foreground">
                    Revisão {i + 1} · {rev.by === 'PLAYER' ? 'Player' : 'Mestre'} · {new Date(rev.createdAt).toLocaleString()}
                  </div>
                  {rev.note && <div className="text-xs italic text-muted-foreground">"{rev.note}"</div>}
                  {rev.diff.length > 0 && <PassiveDiffList diff={rev.diff} />}
                </div>
              ))}
            </div>
          )}
          {canAct && !counterMode && (
            <div className="space-y-2 pt-1 border-t border-border">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Comentário (opcional, recomendado para contraproposta/recusa)…"
                rows={2}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground"
              />
              <div className="flex gap-1 flex-wrap">
                <button onClick={handleApprove} className="flex-1 rounded-lg bg-neon-green/20 px-3 py-1.5 text-xs font-bold text-neon-green hover:bg-neon-green/30">
                  <Check className="inline h-3 w-3 mr-1" /> Aprovar
                </button>
                {asMaster && (
                  <button onClick={() => setCounterMode(true)} className="flex-1 rounded-lg bg-primary/20 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/30">
                    <Edit className="inline h-3 w-3 mr-1" /> Contraproposta
                  </button>
                )}
                <button onClick={handleReject} className="flex-1 rounded-lg bg-hp/20 px-3 py-1.5 text-xs font-bold text-hp hover:bg-hp/30">
                  <X className="inline h-3 w-3 mr-1" /> Recusar
                </button>
              </div>
            </div>
          )}
          {counterMode && (
            <div className="border-t border-border pt-2">
              <div className="mb-2 text-xs text-muted-foreground">
                <MessageSquare className="inline h-3 w-3 mr-1" />
                Edite a passiva abaixo. Ao enviar, as mudanças serão destacadas para o player.
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Explique o que mudou e por quê (recomendado)…"
                rows={2}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground mb-2"
              />
              <PassiveEditor
                initial={last.passive}
                onSubmit={(p) => handleCounter({ ...p, id: last.passive.id })}
                onCancel={() => { setCounterMode(false); setNote(''); }}
                submitLabel="Enviar contraproposta"
              />
            </div>
          )}
          {(proposal.status === 'approved' || proposal.status === 'rejected') && (
            <div className="flex justify-end">
              <button onClick={() => remove(proposal.id)} className="text-xs text-muted-foreground hover:text-hp">
                Remover do histórico
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SpellSummary({ spell }: { spell: Spell }) {
  return (
    <div className="rounded-md border border-border bg-background/50 p-2 text-xs space-y-0.5">
      <div className="font-bold text-primary">{spell.name}</div>
      <div className="text-muted-foreground">
        Nv {spell.spellLevel} · {spell.spellType} · {spell.actionType} · {spell.targetMode ?? '—'}
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="text-pe">PE: {spell.costPE}</span>
        {spell.damageDice && <span className="text-hp">{spell.damageDice}{spell.damageBonus ? `+${spell.damageBonus}` : ''}</span>}
        <span>Alc: {spell.range}</span>
        {spell.bonusDC ? <span className="text-neon-yellow">CD{spell.bonusDC >= 0 ? '+' : ''}{spell.bonusDC}</span> : null}
      </div>
      {spell.description && <div className="text-muted-foreground italic">{spell.description}</div>}
    </div>
  );
}

function ProposalCard({ proposal, asMaster }: { proposal: SpellProposal; asMaster: boolean }) {
  const characters = useCharacterStore((s) => s.characters);
  const addSpell = useCharacterStore((s) => s.addSpell);
  const updateSpell = useCharacterStore((s) => s.updateSpell);
  const addLog = useLogStore((s) => s.addLog);
  const { approve, reject, counterByMaster, counterByPlayer, acceptMasterCounter, rejectMasterCounter, remove } =
    useSpellProposalStore();
  const [open, setOpen] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [counterMode, setCounterMode] = useState(false);
  const [note, setNote] = useState('');

  const character = characters.find((c) => c.id === proposal.characterId);
  const last = proposal.revisions[proposal.revisions.length - 1];

  const apply = (spell: Spell) => {
    if (!character) return;
    const exists = character.spells.some((s) => s.id === spell.id);
    if (exists) updateSpell(character.id, spell);
    else addSpell(character.id, spell);
    // Também registra no Catálogo do Mestre para reutilização futura.
    useSpellLibraryStore.getState().registrar(spell, proposal.characterName);
  };

  const handleApprove = () => {
    if (asMaster) {
      approve(proposal.id, apply);
      addLog('system', `✅ Mestre aprovou o feitiço "${last.spell.name}" de ${proposal.characterName}.`);
    } else {
      acceptMasterCounter(proposal.id, apply);
      addLog('system', `✅ ${proposal.characterName} aceitou a contraproposta do Mestre para "${last.spell.name}".`);
    }
  };
  const handleReject = () => {
    const r = note.trim() || undefined;
    if (asMaster) {
      reject(proposal.id, r);
      addLog('system', `❌ Mestre recusou o feitiço "${last.spell.name}" de ${proposal.characterName}.${r ? ` Motivo: ${r}` : ''}`);
    } else {
      rejectMasterCounter(proposal.id, r);
      addLog('system', `❌ ${proposal.characterName} recusou a contraproposta do Mestre para "${last.spell.name}".${r ? ` Motivo: ${r}` : ''}`);
    }
    setNote('');
  };

  const handleCounter = (newSpell: Spell) => {
    const r = note.trim() || undefined;
    if (asMaster) {
      counterByMaster(proposal.id, newSpell, r);
      addLog('system', `✏️ Mestre fez uma contraproposta para "${newSpell.name}" (${proposal.characterName}).`);
    } else {
      counterByPlayer(proposal.id, newSpell, r);
      addLog('system', `✏️ ${proposal.characterName} fez uma contraproposta para "${newSpell.name}".`);
    }
    setCounterMode(false);
    setNote('');
  };

  const statusBadge = {
    pending: { label: 'Aguardando Mestre', cn: 'bg-neon-yellow/20 text-neon-yellow border-neon-yellow/40' },
    counter_master: { label: 'Contraproposta do Mestre', cn: 'bg-primary/20 text-primary border-primary/40' },
    counter_player: { label: 'Contraproposta do Player', cn: 'bg-accent/20 text-accent-foreground border-accent/40' },
    approved: { label: 'Aprovado', cn: 'bg-neon-green/20 text-neon-green border-neon-green/40' },
    rejected: { label: 'Recusado', cn: 'bg-hp/20 text-hp border-hp/40' },
  }[proposal.status];

  // Pode agir? Mestre age em pending/counter_player. Player age em counter_master.
  const canAct = proposal.status !== 'approved' && proposal.status !== 'rejected'
    && ((asMaster && (proposal.status === 'pending' || proposal.status === 'counter_player'))
      || (!asMaster && proposal.status === 'counter_master'));

  return (
    <div className="rounded-xl border-2 border-primary/30 bg-card/80 p-3 space-y-2">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 text-left">
        <Wand2 className="h-4 w-4 text-primary" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground truncate">{last.spell.name}</div>
          <div className="text-xs text-muted-foreground">
            {proposal.characterName} · {new Date(proposal.updatedAt).toLocaleString()}
          </div>
        </div>
        <span className={cn('rounded-full border px-2 py-0.5 text-xs font-bold uppercase', statusBadge.cn)}>
          {statusBadge.label}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="space-y-2 pt-1">
          <SpellSummary spell={last.spell} />
          {last.note && (
            <div className="rounded-md border border-border bg-secondary/30 px-2 py-1 text-xs">
              <span className="font-bold text-muted-foreground">Comentário ({last.by === 'PLAYER' ? 'Player' : 'Mestre'}): </span>
              {last.note}
            </div>
          )}

          {last.diff.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Mudanças desta revisão
              </div>
              <DiffList diff={last.diff} />
            </div>
          )}

          {proposal.revisions.length > 1 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
            >
              <Clock className="h-3 w-3" /> {showHistory ? 'Ocultar' : 'Ver'} histórico ({proposal.revisions.length} revisões)
            </button>
          )}

          {showHistory && (
            <div className="space-y-2 border-l-2 border-border pl-2">
              {proposal.revisions.slice(0, -1).map((rev, i) => (
                <div key={i} className="space-y-1">
                  <div className="text-xs font-bold uppercase text-muted-foreground">
                    Revisão {i + 1} · {rev.by === 'PLAYER' ? 'Player' : 'Mestre'} · {new Date(rev.createdAt).toLocaleString()}
                  </div>
                  {rev.note && <div className="text-xs italic text-muted-foreground">"{rev.note}"</div>}
                  {rev.diff.length > 0 && <DiffList diff={rev.diff} />}
                </div>
              ))}
            </div>
          )}

          {canAct && !counterMode && (
            <div className="space-y-2 pt-1 border-t border-border">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Comentário (opcional, recomendado para contraproposta/recusa)…"
                rows={2}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground"
              />
              <div className="flex gap-1 flex-wrap">
                <button
                  onClick={handleApprove}
                  className="flex-1 rounded-lg bg-neon-green/20 px-3 py-1.5 text-xs font-bold text-neon-green hover:bg-neon-green/30"
                >
                  <Check className="inline h-3 w-3 mr-1" /> Aprovar
                </button>
                <button
                  onClick={() => setCounterMode(true)}
                  className="flex-1 rounded-lg bg-primary/20 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/30"
                >
                  <Edit className="inline h-3 w-3 mr-1" /> Contraproposta
                </button>
                <button
                  onClick={handleReject}
                  className="flex-1 rounded-lg bg-hp/20 px-3 py-1.5 text-xs font-bold text-hp hover:bg-hp/30"
                >
                  <X className="inline h-3 w-3 mr-1" /> Recusar
                </button>
              </div>
            </div>
          )}

          {counterMode && character && (
            <div className="border-t border-border pt-2">
              <div className="mb-2 text-xs text-muted-foreground">
                <MessageSquare className="inline h-3 w-3 mr-1" />
                Edite o feitiço abaixo. Ao enviar, as mudanças serão destacadas para a outra parte.
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Explique o que mudou e por quê (recomendado)…"
                rows={2}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground mb-2"
              />
              <SpellCreationAssistant
                onAdd={(s) => handleCounter({ ...s, id: last.spell.id })}
                onCancel={() => { setCounterMode(false); setNote(''); }}
                charLevel={character.level}
                currentSpellCount={0}
                maxSpells={999}
                initialSpell={last.spell}
                isMaster={asMaster}
                hasTecnicaMaxima={(character.chosenAuraAptitudes || []).includes('special-tecnica-maxima')}
                hasTecnicaReversa={(character.chosenAuraAptitudes || []).includes('special-reversao-de-tecnica')}
                forceMasterMode
              />
            </div>
          )}

          {(proposal.status === 'approved' || proposal.status === 'rejected') && (
            <div className="flex justify-end">
              <button
                onClick={() => remove(proposal.id)}
                className="text-xs text-muted-foreground hover:text-hp"
              >
                Remover do histórico
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OmniDiffList({ diff }: { diff: OmniDiffEntry[] }) {
  if (!diff || diff.length === 0) {
    return <p className="text-xs italic text-muted-foreground">Sem alterações em relação à revisão anterior.</p>;
  }
  return (
    <ul className="space-y-1">
      {diff.map((d, i) => (
        <li key={i} className="rounded-md border border-border bg-secondary/30 px-2 py-1 text-xs">
          <span className="font-semibold text-foreground">{d.label}: </span>
          <span className="text-hp line-through">{fmtVal(d.before)}</span>
          <span className="mx-1 text-muted-foreground">→</span>
          <span className="text-neon-green font-semibold">{fmtVal(d.after)}</span>
        </li>
      ))}
    </ul>
  );
}

function valorOmniTexto(valor: unknown): string {
  const limpar = (texto: string) => texto
    .replace(/@/g, '')
    .replace(/×/g, ' vezes ')
    .replace(/÷/g, ' dividido por ')
    .replace(/[*/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!valor || typeof valor !== 'object') return '—';
  const v = valor as { tipo?: string; valor?: number; expressao?: string; condicao?: string; ref?: { alvo?: string; caminho?: string } };
  if (v.tipo === 'fixo') return String(v.valor ?? 0);
  if (v.tipo === 'formula') return limpar(humanizarFormula(v.expressao ?? '0'));
  if (v.tipo === 'condicao') return v.condicao ?? 'Condição';
  if (v.tipo === 'ref') {
    const alvo = v.ref?.alvo ? `${ALVOS_REFERENCIA[v.ref.alvo as keyof typeof ALVOS_REFERENCIA]?.ui ?? v.ref.alvo}: ` : '';
    return `${alvo}${nomeAmigavelRecurso(v.ref?.caminho)}`;
  }
  return '—';
}

function OmniSummary({ ent }: { ent: EntidadeOmni }) {
  const blocos = ent.gatilhos.reduce((s, g) => s + g.blocos.length, 0);
  const temEfeitosCombate = (ent.combatData?.effects?.length ?? 0) > 0;
  return (
    <div className="rounded-md border border-border bg-background/50 p-2 text-xs space-y-2">
      <div>
        <div className="font-bold text-primary">◇ {ent.nome}</div>
        <div className="text-muted-foreground capitalize">
          {ent.categoria} · Duração: {ent.duracao.tipo} · {ent.gatilhos.length} gatilho(s) · {blocos} bloco(s)
        </div>
      </div>
      {ent.descricao && <div className="text-muted-foreground italic whitespace-pre-wrap leading-relaxed">{ent.descricao}</div>}
      {ent.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {ent.tags.map((tag) => (
            <span key={tag} className="rounded border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
              {tag === 'rascunho-conceito' ? 'Aguardando mecânica amaldiçoada' : tag}
            </span>
          ))}
        </div>
      )}
      {temEfeitosCombate && <OmniItemDescription effects={ent.combatData!.effects} variante="bloco" />}
      {ent.custos.length > 0 && (
        <div className="rounded-md border border-neon-yellow/30 bg-neon-yellow/5 p-2 space-y-1">
          <div className="text-xs font-bold uppercase tracking-wider text-neon-yellow">Custos</div>
          {ent.custos.map((c, i) => (
            <div key={i} className="text-foreground/90">Consumir {valorOmniTexto(c.valor)} de {nomeAmigavelRecurso(c.caminhoRecurso)}</div>
          ))}
        </div>
      )}
      {ent.gatilhos.length > 0 && (
        <div className="rounded-md border border-primary/25 bg-primary/5 p-2 space-y-1.5">
          <div className="text-xs font-bold uppercase tracking-wider text-primary">Gatilhos e lógica</div>
          {ent.gatilhos.map((g) => (
            <div key={g.id} className="space-y-1">
              <div className="font-semibold text-foreground">{ROTULOS_GATILHOS[g.evento] ?? g.evento}</div>
              {g.blocos.length === 0 ? (
                <div className="text-muted-foreground italic">Sem ações configuradas neste gatilho.</div>
              ) : g.blocos.map((b, bi) => (
                <div key={b.id} className="rounded border border-border/50 bg-background/50 px-2 py-1 space-y-0.5">
                  {b.condicoes.length > 0 && (
                    <div className="text-muted-foreground">
                      Se {b.condicoes.map((c) => `${valorOmniTexto(c.esquerdo)} ${OPERADORES_LOGICOS[c.operador]?.ui.toLowerCase() ?? c.operador} ${valorOmniTexto(c.direito)}`).join(b.modo === 'todas' ? ' e ' : ' ou ')}
                    </div>
                  )}
                  {b.acoes.length === 0 ? (
                    <div className="text-muted-foreground italic">Bloco {bi + 1} sem ações.</div>
                  ) : b.acoes.map((a) => (
                    <div key={a.id} className="text-foreground/90">
                      Então {ACOES_EFEITO[a.acao]?.ui ?? a.acao} {a.valor ? valorOmniTexto(a.valor) : a.condicao ?? ''}
                      {a.caminhoAlvo ? ` em ${nomeAmigavelRecurso(a.caminhoAlvo)}` : ''}
                      {a.alvoAplicacao ? ` (${ALVOS_REFERENCIA[a.alvoAplicacao]?.ui ?? a.alvoAplicacao})` : ''}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OmniProposalCard({ proposal, asMaster }: { proposal: OmniProposal; asMaster: boolean }) {
  const addLog = useLogStore((s) => s.addLog);
  const setStateOmni = useOmniEntidadesStore.setState;
  const { approve, reject, counterByMaster, counterByPlayer, acceptMasterCounter, rejectMasterCounter, remove } =
    useOmniProposalStore();
  const [open, setOpen] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [counterMode, setCounterMode] = useState(false);
  const [note, setNote] = useState('');

  const last = proposal.revisions[proposal.revisions.length - 1];

  const apply = (ent: EntidadeOmni) => {
    // Insere/sobrescreve na biblioteca global de entidades Omni.
    setStateOmni((s) => ({
      entidades: { ...s.entidades, [ent.id]: { ...ent, atualizadoEm: Date.now() } },
    }));
    // Entidades aprovadas vão direto para o Banco de Itens central (aba "Itens"),
    // não para o inventário do personagem que propôs. O Mestre distribui depois.
    const novoItem: Item = {
      id: `omni-${ent.id}-${Date.now().toString(36)}`,
      name: ent.nome,
      category: ent.categoria,
      description: ent.descricao || '',
      weight: 0,
      cost: 0,
      slots: 1,
      quantity: 1,
      slotType: 'nenhum',
      bonusHP: 0,
      bonusPE: 0,
      bonusESC: 0,
      bonusRD: 0,
      bonusRdByType: createEmptyRdByType(),
      bonusSlots: 0,
      bonusCA: 0,
      bonusDC: 0,
      bonusActions: 0,
      bonusBonusActions: 0,
      bonusReactions: 0,
      bonusOpportunity: 0,
      rollBonuses: [],
      assignedTo: [],
    };
    useItemStore.getState().addItem(novoItem);
  };

  const handleApprove = () => {
    if (asMaster) {
      approve(proposal.id, apply);
      addLog('system', `✅ Mestre aprovou a entidade Omni "${last.entidade.nome}" de ${proposal.characterName}.`);
    } else {
      acceptMasterCounter(proposal.id, apply);
      addLog('system', `✅ ${proposal.characterName} aceitou a contraproposta da entidade "${last.entidade.nome}".`);
    }
  };
  const handleReject = () => {
    const r = note.trim() || undefined;
    if (asMaster) {
      reject(proposal.id, r);
      addLog('system', `❌ Mestre recusou a entidade "${last.entidade.nome}" de ${proposal.characterName}.${r ? ` Motivo: ${r}` : ''}`);
    } else {
      rejectMasterCounter(proposal.id, r);
      addLog('system', `❌ ${proposal.characterName} recusou a contraproposta da entidade "${last.entidade.nome}".${r ? ` Motivo: ${r}` : ''}`);
    }
    setNote('');
  };
  const handleCounter = (novaEntidade: EntidadeOmni) => {
    const r = note.trim() || undefined;
    if (asMaster) {
      counterByMaster(proposal.id, novaEntidade, r);
      addLog('system', `✏️ Mestre fez uma contraproposta para "${novaEntidade.nome}" (${proposal.characterName}).`);
    } else {
      counterByPlayer(proposal.id, novaEntidade, r);
      addLog('system', `✏️ ${proposal.characterName} fez uma contraproposta para "${novaEntidade.nome}".`);
    }
    setCounterMode(false);
    setNote('');
  };

  const statusBadge = {
    pending: { label: 'Aguardando Mestre', cn: 'bg-neon-yellow/20 text-neon-yellow border-neon-yellow/40' },
    counter_master: { label: 'Contraproposta do Mestre', cn: 'bg-primary/20 text-primary border-primary/40' },
    counter_player: { label: 'Contraproposta do Player', cn: 'bg-accent/20 text-accent-foreground border-accent/40' },
    approved: { label: 'Aprovada', cn: 'bg-neon-green/20 text-neon-green border-neon-green/40' },
    rejected: { label: 'Recusada', cn: 'bg-hp/20 text-hp border-hp/40' },
  }[proposal.status];

  const canAct =
    proposal.status !== 'approved' && proposal.status !== 'rejected'
    && ((asMaster && (proposal.status === 'pending' || proposal.status === 'counter_player'))
      || (!asMaster && proposal.status === 'counter_master'));

  return (
    <div className="rounded-xl border-2 border-primary/30 bg-card/80 p-3 space-y-2">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 text-left">
        <Sparkles className="h-4 w-4 text-primary" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground truncate">{last.entidade.nome}</div>
          <div className="text-xs text-muted-foreground">
            {proposal.characterName} · {last.entidade.categoria} · {new Date(proposal.updatedAt).toLocaleString()}
          </div>
        </div>
        <span className={cn('rounded-full border px-2 py-0.5 text-xs font-bold uppercase', statusBadge.cn)}>
          {statusBadge.label}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="space-y-2 pt-1">
          <OmniSummary ent={last.entidade} />
          {last.note && (
            <div className="rounded-md border border-border bg-secondary/30 px-2 py-1 text-xs">
              <span className="font-bold text-muted-foreground">Comentário ({last.by === 'PLAYER' ? 'Player' : 'Mestre'}): </span>
              {last.note}
            </div>
          )}
          {last.diff.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Mudanças desta revisão</div>
              <OmniDiffList diff={last.diff} />
            </div>
          )}
          {proposal.revisions.length > 1 && (
            <button onClick={() => setShowHistory(!showHistory)} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
              <Clock className="h-3 w-3" /> {showHistory ? 'Ocultar' : 'Ver'} histórico ({proposal.revisions.length} revisões)
            </button>
          )}
          {showHistory && (
            <div className="space-y-2 border-l-2 border-border pl-2">
              {proposal.revisions.slice(0, -1).map((rev, i) => (
                <div key={i} className="space-y-1">
                  <div className="text-xs font-bold uppercase text-muted-foreground">
                    Revisão {i + 1} · {rev.by === 'PLAYER' ? 'Player' : 'Mestre'} · {new Date(rev.createdAt).toLocaleString()}
                  </div>
                  {rev.note && <div className="text-xs italic text-muted-foreground">"{rev.note}"</div>}
                  {rev.diff.length > 0 && <OmniDiffList diff={rev.diff} />}
                </div>
              ))}
            </div>
          )}
          {canAct && !counterMode && (
            <div className="space-y-2 pt-1 border-t border-border">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Comentário (opcional, recomendado para contraproposta/recusa)…"
                rows={2}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground"
              />
              <div className="flex gap-1 flex-wrap">
                <button onClick={handleApprove} className="flex-1 rounded-lg bg-neon-green/20 px-3 py-1.5 text-xs font-bold text-neon-green hover:bg-neon-green/30">
                  <Check className="inline h-3 w-3 mr-1" /> Aprovar
                </button>
                <button onClick={() => setCounterMode(true)} className="flex-1 rounded-lg bg-primary/20 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/30">
                  <Edit className="inline h-3 w-3 mr-1" /> Contraproposta
                </button>
                <button onClick={handleReject} className="flex-1 rounded-lg bg-hp/20 px-3 py-1.5 text-xs font-bold text-hp hover:bg-hp/30">
                  <X className="inline h-3 w-3 mr-1" /> Recusar
                </button>
              </div>
            </div>
          )}
          {counterMode && (
            <div className="border-t border-border pt-2">
              <div className="mb-2 text-xs text-muted-foreground">
                <MessageSquare className="inline h-3 w-3 mr-1" />
                Edite a entidade abaixo no construtor visual. Ao salvar, vira contraproposta com diff destacado.
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Explique o que mudou e por quê (recomendado)…"
                rows={2}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground mb-2"
              />
              <ConstrutorEntidade
                aberto
                onClose={() => { setCounterMode(false); setNote(''); }}
                entidadeInicial={last.entidade}
                onSalvar={(e) => handleCounter({ ...e, id: last.entidade.id })}
              />
            </div>
          )}
          {(proposal.status === 'approved' || proposal.status === 'rejected') && (
            <div className="flex justify-end">
              <button onClick={() => remove(proposal.id)} className="text-xs text-muted-foreground hover:text-hp">
                Remover do histórico
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SpellProposalsModule() {
  const role = useRoleStore((s) => s.role);
  const isMaster = role === 'MASTER';
  const proposals = useSpellProposalStore((s) => s.proposals);
  const passiveProposals = usePassiveProposalStore((s) => s.proposals);
  const omniProposals = useOmniProposalStore((s) => s.proposals);
  const characters = useCharacterStore((s) => s.characters);
  const pending = usePendingDebates();
  const [filter, setFilter] = useState<'pending' | 'all' | 'closed'>('pending');

  const visible = useMemo(() => {
    let list = proposals;
    if (!isMaster) {
      // Player vê apenas as propostas de fichas que ele criou (createdBy === 'PLAYER').
      const playerCharIds = new Set(
        characters.filter((c) => c.createdBy !== 'MASTER').map((c) => c.id),
      );
      list = list.filter((p) => playerCharIds.has(p.characterId));
    }
    if (filter === 'pending') list = list.filter((p) => p.status === 'pending' || p.status === 'counter_master' || p.status === 'counter_player');
    else if (filter === 'closed') list = list.filter((p) => p.status === 'approved' || p.status === 'rejected');
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [proposals, isMaster, characters, filter]);

  const visiblePassives = useMemo(() => {
    let list = passiveProposals;
    if (!isMaster) {
      const playerCharIds = new Set(
        characters.filter((c) => c.createdBy !== 'MASTER').map((c) => c.id),
      );
      list = list.filter((p) => playerCharIds.has(p.characterId));
    }
    if (filter === 'pending') list = list.filter((p) => p.status === 'pending' || p.status === 'counter_master');
    else if (filter === 'closed') list = list.filter((p) => p.status === 'approved' || p.status === 'rejected');
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [passiveProposals, isMaster, characters, filter]);

  const visibleOmni = useMemo(() => {
    let list = omniProposals;
    if (!isMaster) {
      const playerCharIds = new Set(
        characters.filter((c) => c.createdBy !== 'MASTER').map((c) => c.id),
      );
      list = list.filter((p) => playerCharIds.has(p.characterId));
    }
    if (filter === 'pending') {
      list = list.filter(
        (p) => p.status === 'pending' || p.status === 'counter_master' || p.status === 'counter_player',
      );
    } else if (filter === 'closed') {
      list = list.filter((p) => p.status === 'approved' || p.status === 'rejected');
    }
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [omniProposals, isMaster, characters, filter]);

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2" style={{ fontFamily: "'Cinzel', serif" }}>
          <MessageSquare className="h-6 w-6" />
          Debates de Propostas
          {pending.total > 0 && (
            <span
              title={`${pending.total} item(ns) aguardando você`}
              className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-hp px-2 text-xs font-extrabold text-white shadow-[0_0_10px_rgba(239,68,68,0.7)] animate-pulse"
            >
              !{pending.total > 1 ? pending.total : ''}
            </span>
          )}
        </h1>
        <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
          {(['pending', 'all', 'closed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-bold transition-colors',
                filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {f === 'pending' ? 'Pendentes' : f === 'closed' ? 'Encerrados' : 'Todos'}
            </button>
          ))}
        </div>
      </header>

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1">
        {isMaster ? (
          <>
            <p className="text-sm text-foreground/90 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>
                <strong className="text-primary">Central de debates do Mestre.</strong> Aqui chegam todas as criações dos jogadores
                — feitiços, passivas e entidades Omni (itens, talentos, auras, condições). Avalie cada uma:
                <span className="text-neon-green font-semibold"> aprove</span> para aplicar na ficha,
                <span className="text-primary font-semibold"> contraproponha</span> ajustando valores, ou
                <span className="text-hp font-semibold"> recuse</span> com um comentário explicando o motivo.
              </span>
            </p>
            {pending.total > 0 && (
              <p className="text-xs text-hp/90 font-semibold pl-6">
                ⚠️ {pending.total} proposta(s) aguardando sua decisão
                {pending.spells > 0 && ` · ${pending.spells} feitiço(s)`}
                {pending.passives > 0 && ` · ${pending.passives} passiva(s)`}
                {pending.omni > 0 && ` · ${pending.omni} entidade(s) Omni`}
                .
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-foreground/90 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <span>
              <strong className="text-primary">Suas propostas em análise.</strong> Acompanhe o que você enviou ao Mestre.
              Quando ele devolver uma <span className="text-primary font-semibold">contraproposta</span>, você pode
              aceitar, recusar ou enviar uma nova versão com seus ajustes.
            </span>
          </p>
        )}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Wand2 className="h-4 w-4" /> Feitiços {visible.length > 0 && <span className="text-primary">({visible.length})</span>}
          {pending.spells > 0 && (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-hp px-1.5 text-xs font-extrabold text-white animate-pulse">
              !{pending.spells > 1 ? pending.spells : ''}
            </span>
          )}
        </h2>
        {visible.length === 0 ? (
          <div className="rounded-xl border border-border bg-card/50 p-4 text-center text-xs text-muted-foreground">
            Nenhum feitiço {filter === 'pending' ? 'pendente' : filter === 'closed' ? 'encerrado' : ''}.
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((p) => (
              <ProposalCard key={p.id} proposal={p} asMaster={isMaster} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Star className="h-4 w-4" /> Passivas {visiblePassives.length > 0 && <span className="text-primary">({visiblePassives.length})</span>}
          {pending.passives > 0 && (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-hp px-1.5 text-xs font-extrabold text-white animate-pulse">
              !{pending.passives > 1 ? pending.passives : ''}
            </span>
          )}
        </h2>
        {visiblePassives.length === 0 ? (
          <div className="rounded-xl border border-border bg-card/50 p-4 text-center text-xs text-muted-foreground">
            Nenhuma passiva {filter === 'pending' ? 'pendente' : filter === 'closed' ? 'encerrada' : ''}.
          </div>
        ) : (
          <div className="space-y-3">
            {visiblePassives.map((p) => (
              <PassiveProposalCard key={p.id} proposal={p} asMaster={isMaster} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> Entidades Omni {visibleOmni.length > 0 && <span className="text-primary">({visibleOmni.length})</span>}
          {pending.omni > 0 && (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-hp px-1.5 text-xs font-extrabold text-white animate-pulse">
              !{pending.omni > 1 ? pending.omni : ''}
            </span>
          )}
        </h2>
        <p className="text-xs text-muted-foreground italic">
          Itens, magias, talentos, auras e condições criadas pelos jogadores no Omni-Engine.
          Inclui também <strong className="text-violet-300/90">conceitos sem mecânica</strong> (modo preguiça) —
          nesses casos o Mestre pode abrir e completar a lógica antes de aprovar.
        </p>
        {visibleOmni.length === 0 ? (
          <div className="rounded-xl border border-border bg-card/50 p-4 text-center text-xs text-muted-foreground">
            Nenhuma entidade {filter === 'pending' ? 'pendente' : filter === 'closed' ? 'encerrada' : ''}.
          </div>
        ) : (
          <div className="space-y-3">
            {visibleOmni.map((p) => (
              <OmniProposalCard key={p.id} proposal={p} asMaster={isMaster} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
