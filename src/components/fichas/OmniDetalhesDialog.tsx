/**
 * Diálogo somente-leitura que mostra todos os detalhes legíveis de uma
 * EntidadeOmni vinculada à ficha: descrição, custos, duração, alcance,
 * gatilhos com seus blocos lógicos, scripts ativos/passivos e bônus.
 *
 * Usado pela `OmniVinculadosList` quando o jogador clica em uma linha
 * (passiva, talento, aura, feitiço, condição) para entender o que ela faz.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ROTULOS_GATILHOS,
  OPERADORES_LOGICOS,
  ACOES_EFEITO,
  ALVOS_REFERENCIA,
} from '@/lib/omni/constantesDoSistema';
import type { EntidadeOmni, ValorDinamico, Operando, BlocoLogico, CombatEffect } from '@/lib/omni/tipos';
import { normalizarCombatData } from '@/lib/omni/tipos';
import { frasePlanoExecucao, humanizarWatcher } from '@/lib/omni/omniScript';
import { DAMAGE_TYPE_LABELS } from '@/types';

const CATEGORIA_LABEL: Record<string, string> = {
  feitico: 'Feitiço',
  talento: 'Talento',
  passiva: 'Passiva',
  aura: 'Aura',
  condicao: 'Condição',
  item: 'Item',
};

function fmtValor(v?: ValorDinamico): string {
  if (!v) return '—';
  if (v.tipo === 'fixo') return String(v.valor);
  return v.expressao || '—';
}

function fmtOperando(op: Operando): string {
  switch (op.tipo) {
    case 'ref': {
      const alvo = ALVOS_REFERENCIA[op.ref.alvo]?.ctx ?? op.ref.alvo;
      return `${alvo}.${op.ref.caminho}`;
    }
    case 'fixo': return String(op.valor);
    case 'condicao': return `condição: ${op.condicao}`;
    case 'formula': return op.expressao || '—';
  }
}

function BlocoView({ bloco }: { bloco: BlocoLogico }) {
  const conector = bloco.modo === 'todas' ? ' E ' : ' OU ';
  return (
    <div className="rounded-md border border-border/60 bg-background/40 p-2 space-y-1.5">
      {bloco.condicoes.length > 0 ? (
        <div className="text-xs">
          <span className="font-semibold text-muted-foreground">SE </span>
          {bloco.condicoes.map((c, i) => (
            <span key={c.id}>
              {i > 0 && <span className="text-muted-foreground">{conector}</span>}
              <span className="text-foreground">{fmtOperando(c.esquerdo)}</span>{' '}
              <span className="text-amber-300">{OPERADORES_LOGICOS[c.operador]?.ui ?? c.operador}</span>{' '}
              <span className="text-foreground">{fmtOperando(c.direito)}</span>
            </span>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground italic">Sempre (sem condição)</div>
      )}
      <div className="text-xs">
        <span className="font-semibold text-muted-foreground">ENTÃO </span>
        <ul className="ml-3 list-disc space-y-0.5">
          {bloco.acoes.map((a) => {
            const acaoLbl = ACOES_EFEITO[a.acao]?.ui ?? a.acao;
            const alvoLbl = ALVOS_REFERENCIA[a.alvoAplicacao]?.ui ?? a.alvoAplicacao;
            return (
              <li key={a.id} className="text-foreground">
                <span className="text-emerald-300">{acaoLbl}</span>
                {' → '}<span className="text-sky-300">{alvoLbl}</span>
                {a.caminhoAlvo && <span className="text-muted-foreground">.{a.caminhoAlvo}</span>}
                {a.valor && <> <span className="text-muted-foreground">com</span> <span className="text-foreground">{fmtValor(a.valor)}</span></>}
                {a.condicao && <> <span className="text-muted-foreground">(cond:</span> {a.condicao}<span className="text-muted-foreground">)</span></>}
                {a.duracao && a.duracao.tipo !== 'instantaneo' && (
                  <> <span className="text-muted-foreground">por</span> {a.duracao.tipo}{a.duracao.valor ? ` (${fmtValor(a.duracao.valor)})` : ''}</>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entidade: EntidadeOmni | null;
}

export function OmniDetalhesDialog({ open, onOpenChange, entidade }: Props) {
  if (!entidade) return null;
  const cd = normalizarCombatData(entidade.combatData);
  const dur = entidade.duracao;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>{entidade.icone ?? '✨'}</span>
            <span>{entidade.nome}</span>
            <Badge variant="outline" className="text-xs">{CATEGORIA_LABEL[entidade.categoria] ?? entidade.categoria}</Badge>
          </DialogTitle>
          {entidade.tags.length > 0 && (
            <DialogDescription className="flex flex-wrap gap-1 pt-1">
              {entidade.tags.map((t) => (
                <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">#{t}</span>
              ))}
            </DialogDescription>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-3">
          <div className="space-y-4 text-sm">
            {entidade.descricao && (
              <section>
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Descrição</h4>
                <p className="whitespace-pre-wrap text-foreground/90">{entidade.descricao}</p>
              </section>
            )}

            <section className="grid grid-cols-2 gap-2">
              <div className="rounded border border-border/60 bg-background/40 p-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Duração</div>
                <div className="text-sm">{dur.tipo}{dur.valor ? ` (${fmtValor(dur.valor)})` : ''}</div>
              </div>
              {entidade.alcance && (
                <div className="rounded border border-border/60 bg-background/40 p-2">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Alcance</div>
                  <div className="text-sm">{fmtValor(entidade.alcance)} m</div>
                </div>
              )}
              {entidade.areaRaio && (
                <div className="rounded border border-border/60 bg-background/40 p-2">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Raio de Área</div>
                  <div className="text-sm">{fmtValor(entidade.areaRaio)} m</div>
                </div>
              )}
              {entidade.usos && (
                <div className="rounded border border-border/60 bg-background/40 p-2">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Usos</div>
                  <div className="text-sm">{entidade.usos.total} / recarga {entidade.usos.recarga}</div>
                </div>
              )}
            </section>

            {entidade.custos.length > 0 && (
              <section>
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Custos</h4>
                <ul className="space-y-1">
                  {entidade.custos.map((c, i) => (
                    <li key={i} className="text-xs rounded border border-border/60 bg-background/40 px-2 py-1">
                      <span className="text-amber-300">{fmtValor(c.valor)}</span>{' de '}
                      <span className="text-muted-foreground">{c.caminhoRecurso}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {entidade.bonusEquipado && (
              <section>
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Bônus quando equipado</h4>
                <div className="flex flex-wrap gap-1">
                  {(['hp','pe','ca','rd','esc','slots'] as const).map((key) => {
                    const value = entidade.bonusEquipado?.[key] ?? 0;
                    return value ? <Badge key={key} variant="outline">{key.toUpperCase()}: {value > 0 ? '+' : ''}{value}</Badge> : null;
                  })}
                  {Object.entries(entidade.bonusEquipado.pericias ?? {}).map(([key, value]) => value ? <Badge key={`p-${key}`} variant="outline">{key.replace(/_/g, ' ')}: {value > 0 ? '+' : ''}{value}</Badge> : null)}
                  {Object.entries(entidade.bonusEquipado.trs ?? {}).map(([key, value]) => value ? <Badge key={`tr-${key}`} variant="outline">TR {key}: {value > 0 ? '+' : ''}{value}</Badge> : null)}
                  {entidade.bonusEquipado.deslocamento ? <Badge variant="outline">Deslocamento: {entidade.bonusEquipado.deslocamento > 0 ? '+' : ''}{entidade.bonusEquipado.deslocamento} m</Badge> : null}
                </div>
              </section>
            )}

            {(entidade.resistencias?.length || entidade.vulnerabilidades?.length || entidade.imunidades_dano?.length) ? (
              <section>
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Mitigação de dano quando equipado</h4>
                <div className="flex flex-wrap gap-1">
                  {entidade.resistencias?.map((tipo) => <Badge key={`res-${tipo}`} variant="outline">Resiste: {DAMAGE_TYPE_LABELS[tipo]}</Badge>)}
                  {entidade.vulnerabilidades?.map((tipo) => <Badge key={`vul-${tipo}`} variant="outline">Vulnerável: {DAMAGE_TYPE_LABELS[tipo]}</Badge>)}
                  {entidade.imunidades_dano?.map((tipo) => <Badge key={`im-${tipo}`} variant="outline">Imune: {DAMAGE_TYPE_LABELS[tipo]}</Badge>)}
                </div>
              </section>
            ) : null}

            {entidade.bonusEquipadoFormula && Object.values(entidade.bonusEquipadoFormula).some((v) => v) && (
              <section>
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Bônus dinâmicos (fórmula)</h4>
                <ul className="space-y-1 text-xs">
                  {Object.entries(entidade.bonusEquipadoFormula).map(([k, v]) =>
                    v ? <li key={k}><span className="text-sky-300">{k.toUpperCase()}</span>: <code className="text-muted-foreground">{typeof v === "string" ? v : JSON.stringify(v)}</code></li> : null
                  )}
                </ul>
              </section>
            )}

            {cd && ((cd.effectsPassive?.length ?? 0) > 0 || (cd.effectsActive?.length ?? 0) > 0) && (
              <section className="space-y-3">
                {(cd.effectsPassive?.length ?? 0) > 0 && (
                  <div>
                    <h4 className="text-xs uppercase tracking-wider text-sky-300 mb-1">🛡 Script Passivo (sempre ativo)</h4>
                    <ul className="space-y-1">
                      {cd.effectsPassive!.map((eff: CombatEffect, i: number) => (
                        <li key={eff.id ?? i} className="text-xs rounded border border-sky-500/30 bg-sky-500/5 px-2 py-1">
                          <span className="text-sky-200">#{i + 1}</span>{' '}
                          <span className="text-foreground">{frasePlanoExecucao(eff)}</span>
                          {eff.condition && <div className="text-xs text-muted-foreground">se {eff.condition}</div>}
                          {eff.watcher && <div className="text-xs text-amber-300">⚡ {humanizarWatcher(eff.watcher)}</div>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(cd.effectsActive?.length ?? 0) > 0 && (
                  <div>
                    <h4 className="text-xs uppercase tracking-wider text-emerald-300 mb-1">⚔ Script Ativo (ao usar)</h4>
                    <ul className="space-y-1">
                      {cd.effectsActive!.map((eff: CombatEffect, i: number) => (
                        <li key={eff.id ?? i} className="text-xs rounded border border-emerald-500/30 bg-emerald-500/5 px-2 py-1">
                          <span className="text-emerald-200">#{i + 1}</span>{' '}
                          <span className="text-foreground">{frasePlanoExecucao(eff)}</span>
                          {eff.condition && <div className="text-xs text-muted-foreground">se {eff.condition}</div>}
                          {eff.watcher && <div className="text-xs text-amber-300">⚡ {humanizarWatcher(eff.watcher)}</div>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Crítico: {cd.critRange}+ (×{cd.critMultiplier}){cd.actionCost ? ` • Custo: ${cd.actionCost}` : ''}
                </div>
              </section>
            )}

            {entidade.gatilhos.length > 0 && (
              <section>
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Gatilhos & Lógica</h4>
                <div className="space-y-2">
                  {entidade.gatilhos.map((g) => (
                    <div key={g.id} className="rounded-md border border-border/60 p-2 space-y-1.5">
                      <div className="text-xs font-semibold text-violet-300">▸ {ROTULOS_GATILHOS[g.evento] ?? g.evento}</div>
                      <div className="space-y-1.5 pl-2">
                        {g.blocos.length === 0 && <div className="text-xs text-muted-foreground italic">(sem blocos lógicos)</div>}
                        {g.blocos.map((b) => <BlocoView key={b.id} bloco={b} />)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {entidade.gatilhos.length === 0 && !(cd?.effectsActive?.length || cd?.effectsPassive?.length) && (
              <p className="text-xs text-muted-foreground italic">Esta entidade não possui efeitos mecânicos configurados.</p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

