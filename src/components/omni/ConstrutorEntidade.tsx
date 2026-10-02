import { DAMAGE_TYPES as TIPOS_DANO_MOTOR, DAMAGE_TYPE_LABELS } from '@/types';
import { resolverTipoDano } from '@/lib/omni/contextoDano';
/**
 * Modal No-Code para criar/editar uma EntidadeOmni.
 * Abas: Geral | Efeitos | Custos | Gatilhos.
 * Inclui Simulador Preview lateral.
 */
import { PORTES_REPLICA, custosDoPorte, replicaPadrao } from '@/lib/replicas';
import { EditorAcoesAtivas } from './EditorAcoesAtivas';
import type { ReplicaPorte } from '@/lib/omni/tipos';
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, BookOpen } from 'lucide-react';
import type {
  AcaoLogica, BlocoLogico, CategoriaEntidade, CondicaoLogica,
  EntidadeOmni, GatilhoEntidade, CombatData, CombatEffect,
} from '@/lib/omni/tipos';
import { novoBloco, novoEfeitoCombate, normalizarCombatData, ehCategoriaSempreAtiva } from '@/lib/omni/tipos';
import { descreverAcaoEfeito, descreverImpactoEfeito } from '@/lib/omni/aplicarEfeito';
import {
  ACOES_EFEITO, ALVOS_REFERENCIA, DICIONARIO_CONDICOES, GATILHOS_EVENTOS,
  ROTULOS_GATILHOS, TIPOS_DURACAO, DAMAGE_TYPES, SYSTEM_ACTIONS, RANGE_TYPES,
  AOE_SHAPES, listarCaminhosNumericos, ALIASES_FORMULA,
  DICIONARIO_CHAVES_OMNI, ESCOPOS_VANTAGEM,
  ROTULOS_TR, ORDEM_TR, ROTULOS_PERICIAS, ORDEM_PERICIAS,
  SISTEMA_ATRIBUTOS, ROTULOS_ATRIBUTOS,
  type AcaoEfeitoId, type AlvoRefId, type GatilhoId, type DuracaoTipo,
} from '@/lib/omni/constantesDoSistema';
import { ConstrutorBlocoLogico } from './ConstrutorBlocoLogico';
import { SmartDropdown } from './SmartDropdown';
import { MultiSelectChips } from './MultiSelectChips';
import { SimuladorPreview } from './SimuladorPreview';
import { GuiaFormulasDialog } from './GuiaFormulasDialog';
import { SeletorRecurso } from './SeletorRecurso';
import { OmniScriptTerminal } from './OmniScriptTerminal';
import { efeitosParaScript, parseOmniScript } from '@/lib/omni/omniScript';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { ITEM_SLOT_LABELS, type ItemSlotType } from '@/types';
import { ALL_CONDITIONS, CONDITION_CATEGORIES } from '@/types/conditions';
import { listWeaponModels, applyWeaponModel, getWeaponMeta, setPrefixedTag, setWeaponDamage } from '@/lib/omni/weaponModel';
import { ALL_WEAPONS } from '@/lib/weapons';
import { GENERAL_TALENTS, ORIGIN_TALENTS } from '@/lib/talents';
import { AURA_APTITUDES } from '@/lib/auraAptitudes';

interface Props {
  aberto: boolean;
  onClose: () => void;
  entidadeInicial: EntidadeOmni;
  onSalvar: (e: EntidadeOmni) => void;
  /**
   * Quando fornecido, exibe o botão "Propor Apenas Conceito" (Modo Preguiça).
   * Recebe a entidade marcada como rascunho/conceito (apenas Nome + Descrição
   * + tag `rascunho-conceito`). Útil para jogadores que querem registrar
   * uma ideia e deixar a mecânica para o Mestre.
   */
  onProporConceito?: (e: EntidadeOmni) => void;
  /**
   * Aba inicial a abrir. Útil para o Mestre cair direto no Terminal
   * Omni-Script ao revisar um conceito do jogador.
   */
  abaInicial?: 'geral' | 'custos' | 'duracao' | 'gatilhos' | 'combate' | 'comercio';
}

const CATEGORIAS: { id: CategoriaEntidade; label: string }[] = [
  { id: 'item', label: 'Item' },
  { id: 'arma', label: 'Arma' },
  { id: 'feitico', label: 'Feitiço' },
  { id: 'talento', label: 'Talento' },
  { id: 'aura', label: 'Aura' },
  { id: 'passiva', label: 'Passiva' },
  { id: 'condicao', label: 'Condição' },
  { id: 'voto', label: 'Voto' },
];

export function ConstrutorEntidade({ aberto, onClose, entidadeInicial, onSalvar, onProporConceito, abaInicial }: Props) {
  const [ent, setEnt] = useState<EntidadeOmni>(entidadeInicial);
  useEffect(() => setEnt(entidadeInicial), [entidadeInicial]);

  // Modal "Modo Preguiça" — captura Nome + Descrição com explicação dedicada.
  const [conceitoAberto, setConceitoAberto] = useState(false);
  const [conceitoNome, setConceitoNome] = useState('');
  const [conceitoDesc, setConceitoDesc] = useState('');
  // Pré-preenche com o que já existe no construtor sempre que o diálogo abre.
  useEffect(() => {
    if (conceitoAberto) {
      setConceitoNome(ent.nome === `Nova ${ent.categoria}` ? '' : ent.nome);
      setConceitoDesc(ent.descricao ?? '');
    }
  }, [conceitoAberto, ent.nome, ent.descricao, ent.categoria]);

  // Aba ativa controlada — permite "abrir direto no Terminal" para conceitos
  // pendentes ou pular para a aba pedida pelo chamador.
  const abaPadrao = abaInicial
    ?? (entidadeInicial.tags?.includes('rascunho-conceito') ? 'combate' : 'geral');
  const [abaAtiva, setAbaAtiva] = useState<string>(abaPadrao);
  useEffect(() => { setAbaAtiva(abaPadrao); }, [abaPadrao]);

  const caminhosNum = useMemo(() => listarCaminhosNumericos(), []);
  const entidades = useOmniEntidadesStore((s) => s.entidades);
  const entidadesDisponiveis = useMemo(
    () => Object.values(entidades).filter((e) => e.id !== ent.id),
    [entidades, ent.id],
  );

  // Painel flutuante "Omni-Helper" — compartilhado por todos os EffectCards.
  const [helperAberto, setHelperAberto] = useState(false);
  // ID do efeito cujo campo de fórmula recebeu foco por último — alvo das inserções via Helper.
  const [efeitoAtivoId, setEfeitoAtivoId] = useState<string | null>(null);
  // Modo de construção: "simples" (Semantic Builder) vs "avancado" (fórmula).
  // Conceitos pendentes (rascunho do jogador) caem direto no Terminal.
  const [modoEfeitos, setModoEfeitos] = useState<'simples' | 'avancado'>('avancado');
  // 🛡️ Script Passivo (Ao Equipar) e ⚔️ Script Ativo (Ação/Uso) — dois
  // textos independentes. Itens podem ter os dois ao mesmo tempo (híbridos).
  const [scriptPassivo, setScriptPassivo] = useState<string>('');
  const [scriptAtivo, setScriptAtivo] = useState<string>('');
  useEffect(() => {
    const cd = normalizarCombatData(entidadeInicial.combatData);
    setScriptPassivo(efeitosParaScript(cd?.effectsPassive ?? []));
    setScriptAtivo(efeitosParaScript(cd?.effectsActive ?? []));
  }, [entidadeInicial]);

  const atualizarGatilho = (id: string, patch: Partial<GatilhoEntidade>) =>
    setEnt((p) => ({ ...p, gatilhos: p.gatilhos.map((g) => g.id === id ? { ...g, ...patch } : g) }));

  const atualizarBloco = (gatilhoId: string, bloco: BlocoLogico) =>
    atualizarGatilho(gatilhoId, {
      blocos: ent.gatilhos.find((g) => g.id === gatilhoId)!.blocos.map((b) => b.id === bloco.id ? bloco : b),
    });

  const addCondicao = (gatilhoId: string, blocoId: string) => {
    const g = ent.gatilhos.find((x) => x.id === gatilhoId)!;
    const b = g.blocos.find((x) => x.id === blocoId)!;
    const nova: CondicaoLogica = {
      id: crypto.randomUUID(),
      esquerdo: { tipo: 'ref', ref: { alvo: 'ALVO', caminho: 'status.vida.atual' } },
      operador: 'MENOR_IGUAL',
      direito: { tipo: 'fixo', valor: 10 },
    };
    atualizarBloco(gatilhoId, { ...b, condicoes: [...b.condicoes, nova] });
  };

  const addAcao = (gatilhoId: string, blocoId: string) => {
    const g = ent.gatilhos.find((x) => x.id === gatilhoId)!;
    const b = g.blocos.find((x) => x.id === blocoId)!;
    const nova: AcaoLogica = {
      id: crypto.randomUUID(),
      acao: 'DANO',
      alvoAplicacao: 'ALVO',
      valor: { tipo: 'fixo', valor: 0 },
    };
    atualizarBloco(gatilhoId, { ...b, acoes: [...b.acoes, nova] });
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
        // Impede que cliques no Omni-Helper (renderizado via portal no body)
        // sejam interpretados como "clique fora" e fechem o Construtor.
        onPointerDownOutside={(e) => {
          const originalTarget = (e.detail?.originalEvent?.target ?? e.target) as HTMLElement | null;
          if (helperAberto || originalTarget?.closest('[data-omni-helper]')) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          const originalTarget = (e.detail?.originalEvent?.target ?? e.target) as HTMLElement | null;
          if (helperAberto || originalTarget?.closest('[data-omni-helper]')) e.preventDefault();
        }}
        onFocusOutside={(e) => {
          const originalTarget = (e.detail?.originalEvent?.target ?? e.target) as HTMLElement | null;
          if (helperAberto || originalTarget?.closest('[data-omni-helper]')) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-primary">◇</span>
            Construtor No-Code
            <span className="text-xs text-muted-foreground font-normal ml-2">
              {CATEGORIAS.find((c) => c.id === ent.categoria)?.label}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 overflow-hidden">
          <div className="overflow-y-auto pr-2">
            <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="geral">Geral</TabsTrigger>
                <TabsTrigger value="custos">Custos</TabsTrigger>
                <TabsTrigger value="duracao">Duração & Alcance</TabsTrigger>
                <TabsTrigger value="gatilhos">Gatilhos & Efeitos</TabsTrigger>
                <TabsTrigger value="combate">Efeitos e Combate</TabsTrigger>
                <TabsTrigger value="comercio">Comércio</TabsTrigger>
                <TabsTrigger value="ativas">Ações Ativas</TabsTrigger>
              </TabsList>

              {/* GERAL */}
              <TabsContent value="geral" className="space-y-3 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nome</Label>
                    <Input value={ent.nome} onChange={(e) => setEnt({ ...ent, nome: e.target.value })} />
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    <Select value={ent.categoria} onValueChange={(v) => {
                      const novaCat = v as CategoriaEntidade;
                      // Categorias sempre-ativas (passiva/aura/talento/condição)
                      // não têm duração própria — força permanente.
                      const novaDur = ehCategoriaSempreAtiva(novaCat)
                        ? { tipo: 'permanente' as DuracaoTipo }
                        : ent.duracao;
                      setEnt({ ...ent, categoria: novaCat, duracao: novaDur });
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea value={ent.descricao} onChange={(e) => setEnt({ ...ent, descricao: e.target.value })} rows={4} />
                </div>
                <div>
                  <Label>Tags (separadas por vírgula)</Label>
                  <Input
                    value={ent.tags.join(', ')}
                    onChange={(e) => setEnt({ ...ent, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
                  />
                </div>
                {(ent.categoria === 'item' || ent.categoria === 'arma') && (
                  <div>
                    <Label>Tipo de Equipamento</Label>
                    <Select
                      value={ent.slotType ?? (ent.categoria === 'arma' ? 'maos' : 'nenhum')}
                      onValueChange={(v) => {
                        const novoSlot = v as ItemSlotType;
                        // Acessório: força duração permanente (slot é sempre passivo enquanto equipado).
                        const ehAcessorio = novoSlot !== 'nenhum';
                        const novaDuracao = ehAcessorio
                          ? { ...ent.duracao, tipo: 'permanente' as DuracaoTipo }
                          : ent.duracao;
                        setEnt({ ...ent, slotType: novoSlot, duracao: novaDuracao });
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {/* Armas → slot Mãos. Itens → Acessórios (colar/anel/pulseira). */}
                        {(ent.categoria === 'arma'
                          ? (['maos', 'nenhum'] as ItemSlotType[])
                          : (['nenhum', 'colar', 'anel', 'pulseira'] as ItemSlotType[])
                        ).map((s) => (
                          <SelectItem key={s} value={s}>
                            {s === 'nenhum'
                              ? (ent.categoria === 'arma' ? 'Nenhum (não equipável)' : 'Nenhum (Item comum / Mochila)')
                              : ITEM_SLOT_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {ent.categoria === 'arma' ? (
                        <>Armas ocupam o slot <strong>Mãos</strong> da ficha. Configure dano, crítico e propriedades na aba <strong>Combate</strong>.</>
                      ) : (
                        <>Define em qual slot da ficha este item poderá ser equipado.
                        Limites por personagem: <strong>1 Colar · 4 Anéis · 2 Pulseiras</strong>.
                        Itens passivos (sem ataque ativo) ficam automaticamente com duração <strong>Permanente</strong>.</>
                      )}
                    </p>
                  </div>
                )}

                {ent.categoria === 'arma' && (
                  <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-primary">
                      Modelo Base (Tipo de Arma)
                    </Label>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Selecione um dos 52 modelos do livro para preencher
                      automaticamente <strong>nome</strong>, <strong>descrição</strong>,
                      <strong> dano</strong>, <strong>margem de crítico</strong>,
                      <strong> alcance</strong> e <strong>tags</strong> de grupo/propriedades.
                      Você pode editar tudo depois.
                    </p>
                    <Select
                      value={ent.tags.find((t) => t.startsWith('modelo:'))?.slice(7) ?? ''}
                      onValueChange={(weaponId) => {
                        const w = listWeaponModels().find((x) => x.id === weaponId);
                        if (!w) return;
                        setEnt((prev) => applyWeaponModel(prev, w));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Escolher modelo de arma…" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[60vh]">
                        {(['Faca','Espada','Bastão','Pugilato','Haste','Machado','Martelo','Chicote','Arco','Besta','Tiro','Dardo'] as const).map((grupo) => {
                          const armas = listWeaponModels().filter((w) => w.group === grupo);
                          if (armas.length === 0) return null;
                          return (
                            <div key={grupo}>
                              <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40">
                                {grupo}
                              </div>
                              {armas.map((w) => (
                                <SelectItem key={w.id} value={w.id}>
                                  {w.name}
                                  <span className="text-muted-foreground text-[10px] ml-2">
                                    ({w.category === 'simples' ? 'S' : 'C'} · {w.range === 'melee' ? 'Cac' : w.range === 'ranged' ? 'Dist' : 'Arr'})
                                  </span>
                                </SelectItem>
                              ))}
                            </div>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {ent.categoria === 'arma' && getWeaponMeta(ent).modeloId && (() => {
                  const meta = getWeaponMeta(ent);
                  const isRanged = ent.tags.includes('ranged') || ent.tags.includes('thrown');
                  const isVersatil = ent.tags.includes('prop:versatil');
                  const isDuasMaos = ent.tags.includes('prop:duas_maos');
                  return (
                    <div className="rounded-md border border-border/60 bg-background/40 p-3 space-y-3">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                        Ajustes do Modelo (substituem os valores do livro)
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Dano (fórmula)</Label>
                          <Input
                            value={meta.dano ?? ''}
                            onChange={(e) => setEnt(setWeaponDamage(ent, e.target.value))}
                            placeholder="ex.: 1d8 + @USUARIO.forca"
                          />
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Aceita dados (XdY), atributos e fórmulas Omni.
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs">Espaços no inventário</Label>
                          <Input
                            type="number"
                            min={1}
                            value={meta.espacos ?? 1}
                            onChange={(e) => {
                              const n = Math.max(1, parseInt(e.target.value, 10) || 1);
                              setEnt(setPrefixedTag(ent, 'espacos:', String(n)));
                            }}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">
                            Empunhadura
                            {isDuasMaos && (
                              <span className="ml-1 text-[10px] text-amber-500">
                                (esta arma exige duas mãos — bloqueado)
                              </span>
                            )}
                            {isVersatil && !isDuasMaos && (
                              <span className="ml-1 text-[10px] text-primary/70">
                                (Versátil — pode alternar)
                              </span>
                            )}
                          </Label>
                          <Select
                            value={String(meta.maos ?? (isDuasMaos ? 2 : 1))}
                            onValueChange={(v) => setEnt(setPrefixedTag(ent, 'mao:', v))}
                            disabled={isDuasMaos}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 Mão (ocupa 1 slot Mãos)</SelectItem>
                              <SelectItem value="2">2 Mãos (ocupa ambos os slots)</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Definido automaticamente pelo modelo. Ao equipar, o sistema reserva os slots correspondentes.
                          </p>
                        </div>
                        {isRanged && (
                          <div>
                            <Label className="text-xs">Alcance (curto / longo, em metros)</Label>
                            <div className="flex gap-1 items-center">
                              <Input
                                type="number"
                                min={0}
                                value={meta.alcanceCurto ?? 0}
                                onChange={(e) => {
                                  const c = Math.max(0, parseInt(e.target.value, 10) || 0);
                                  const l = meta.alcanceLongo ?? c * 3;
                                  setEnt(setPrefixedTag(ent, 'alcance:', `${c}/${l}`));
                                }}
                              />
                              <span className="text-muted-foreground text-xs">/</span>
                              <Input
                                type="number"
                                min={0}
                                value={meta.alcanceLongo ?? 0}
                                onChange={(e) => {
                                  const l = Math.max(0, parseInt(e.target.value, 10) || 0);
                                  const c = meta.alcanceCurto ?? Math.floor(l / 3);
                                  setEnt(setPrefixedTag(ent, 'alcance:', `${c}/${l}`));
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {(ent.categoria === 'item' || ent.categoria === 'arma') && ent.slotType && ent.slotType !== 'nenhum' && (
                  <div className="rounded-md border border-dashed border-border/60 bg-background/40 p-3 space-y-1">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Bônus do acessório
                    </Label>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Configure os bônus deste acessório na aba <strong>Efeitos e Combate</strong> usando
                      o terminal do Omni-Script. Itens passivos aplicam automaticamente seus efeitos
                      em <code className="text-foreground/80">@USUARIO</code> ao serem equipados, e você
                      pode adicionar quantos efeitos quiser (ex.: <code className="text-foreground/80">+2 em vida_max</code>,
                      <code className="text-foreground/80"> +(@USUARIO.treino) em ca</code>).
                    </p>
                  </div>
                )}
              </TabsContent>

              {/* CUSTOS */}
              <TabsContent value="custos" className="space-y-3 pt-3">
                {/* Bloco Usos & Recarga (Pilar de Recursos) */}
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-amber-600">
                    Usos limitados
                  </Label>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Se preenchido, cada cópia no inventário ganha um contador.
                    Use <code className="text-foreground/80">@ITEM.usos_restantes</code> e
                    <code className="text-foreground/80"> @ITEM.usos_totais</code> nas fórmulas.
                    Deixe em <strong>0</strong> para uso ilimitado.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Quantidade de Usos</Label>
                      <Input
                        type="number"
                        min={0}
                        value={ent.usos?.total ?? 0}
                        onChange={(e) => {
                          const total = Math.max(0, parseInt(e.target.value, 10) || 0);
                          if (total === 0) {
                            const { usos: _, ...rest } = ent;
                            setEnt(rest);
                          } else {
                            setEnt({
                              ...ent,
                              usos: { total, recarga: ent.usos?.recarga ?? 'diaria' },
                            });
                          }
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Tipo de Recarga</Label>
                      <Select
                        value={ent.usos?.recarga ?? 'diaria'}
                        onValueChange={(v) => {
                          if (!ent.usos) return;
                          setEnt({
                            ...ent,
                            usos: { ...ent.usos, recarga: v as 'diaria' | 'porCena' | 'descansoCurto' | 'manual' },
                          });
                        }}
                        disabled={!ent.usos}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="diaria">Diária (vira o dia)</SelectItem>
                          <SelectItem value="porCena">Por Cena</SelectItem>
                          <SelectItem value="descansoCurto">Descanso Curto</SelectItem>
                          <SelectItem value="manual">Manual (Mestre)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                {(ent.categoria === 'arma' || ent.categoria === 'item') && (
                  <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2" data-testid="omni-replica-bloco">
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                      <input
                        type="checkbox"
                        data-testid="omni-replica-toggle"
                        checked={!!ent.replica}
                        onChange={(e) => {
                          if (e.target.checked) setEnt({ ...ent, replica: replicaPadrao('medio') });
                          else { const { replica: _r, ...rest } = ent; setEnt(rest); }
                        }}
                      />
                      Réplica / Item Materializável
                    </label>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      O jogador escolhe quando materializar no combate: paga o PE de invocação,
                      a arma surge na mão e, no começo de cada turno dele, paga a sustentação ou deixa ela se desfazer.
                    </p>
                    {ent.replica && (
                      <div className="space-y-2">
                        <div>
                          <Label className="text-xs">Porte (preenche a tabela)</Label>
                          <Select
                            value={ent.replica.porte}
                            onValueChange={(v) => {
                              const p = custosDoPorte(v as ReplicaPorte);
                              setEnt({ ...ent, replica: { ...ent.replica!, porte: p.id, peInvocacao: p.invocacao, peSustentacao: p.sustentacao } });
                            }}
                          >
                            <SelectTrigger data-testid="omni-replica-porte"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {PORTES_REPLICA.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.label} — {p.invocacao} PE / {p.sustentacao} PE por rodada</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">PE para Materializar</Label>
                            <Input
                              type="number" min={0} data-testid="omni-replica-invocacao"
                              value={ent.replica.peInvocacao}
                              onChange={(e) => setEnt({ ...ent, replica: { ...ent.replica!, peInvocacao: Math.max(0, parseInt(e.target.value, 10) || 0) } })}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">PE de Sustentação (por rodada)</Label>
                            <Input
                              type="number" min={0} data-testid="omni-replica-sustentacao"
                              value={ent.replica.peSustentacao}
                              onChange={(e) => setEnt({ ...ent, replica: { ...ent.replica!, peSustentacao: Math.max(0, parseInt(e.target.value, 10) || 0) } })}
                            />
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-xs">
                          <input type="checkbox" checked={ent.replica.desintegrarAoSoltar}
                            onChange={(e) => setEnt({ ...ent, replica: { ...ent.replica!, desintegrarAoSoltar: e.target.checked } })} />
                          Desintegrar ao soltar / ser desarmado
                        </label>
                        <label className="flex items-center gap-2 text-xs">
                          <input type="checkbox" checked={ent.replica.cobrarPorRodada}
                            onChange={(e) => setEnt({ ...ent, replica: { ...ent.replica!, cobrarPorRodada: e.target.checked } })} />
                          Cobrar sustentação no começo de cada turno
                        </label>
                      </div>
                    )}
                  </div>
                )}
                {ent.custos.map((c, i) => (
                  <div key={i} className="rounded-md border border-border/60 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Select value={c.caminhoRecurso} onValueChange={(v) => {
                        const nx = [...ent.custos]; nx[i] = { ...c, caminhoRecurso: v }; setEnt({ ...ent, custos: nx });
                      }}>
                        <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {caminhosNum.map((o) => (
                            <SelectItem key={o.caminho} value={o.caminho}>{o.rotulo}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" onClick={() => {
                        setEnt({ ...ent, custos: ent.custos.filter((_, j) => j !== i) });
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive/70" />
                      </Button>
                    </div>
                    <SmartDropdown
                      valor={c.valor}
                      onChange={(v) => {
                        const nx = [...ent.custos]; nx[i] = { ...c, valor: v }; setEnt({ ...ent, custos: nx });
                      }}
                      rotulo="Quantidade"
                    />
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => {
                  setEnt({ ...ent, custos: [...ent.custos, { caminhoRecurso: 'status.energiaAmaldicoada.atual', valor: { tipo: 'fixo', valor: 1 } }] });
                }}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar Custo
                </Button>
              </TabsContent>

              {/* DURAÇÃO */}
              <TabsContent value="duracao" className="space-y-3 pt-3">
                {ehCategoriaSempreAtiva(ent.categoria) ? (
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-primary">
                      Duração: Permanente (sempre ativa)
                    </Label>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      <strong>{CATEGORIAS.find((c) => c.id === ent.categoria)?.label}</strong> é uma fonte
                      sempre-ativa: ela existe enquanto estiver atribuída ao personagem
                      (talento na ficha, item equipado para auras, condição aplicada).
                      A duração não pertence à entidade — pertence aos <em>efeitos individuais</em>
                      configurados nos gatilhos abaixo (ex.: "Aplicar condição por 3 rodadas",
                      "Conceder reroll por 1 turno"). Configure isso na aba <strong>Gatilhos & Efeitos</strong>.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <Label>Tipo de Duração</Label>
                      <Select value={ent.duracao.tipo} onValueChange={(v) => setEnt({ ...ent, duracao: { ...ent.duracao, tipo: v as DuracaoTipo } })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.values(TIPOS_DURACAO).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                        Define quanto tempo a entidade-fonte permanece ativa no mundo
                        após ser usada (ex.: feitiço de 10 minutos, poção instantânea).
                        Para efeitos persistentes específicos disparados pelos gatilhos,
                        use o campo "Duração" de cada ação.
                      </p>
                    </div>
                    {ent.duracao.tipo !== 'instantaneo' && ent.duracao.tipo !== 'permanente' && ent.duracao.tipo !== 'ateDissipar' && (
                      <SmartDropdown
                        valor={ent.duracao.valor ?? { tipo: 'fixo', valor: 1 }}
                        onChange={(v) => setEnt({ ...ent, duracao: { ...ent.duracao, valor: v } })}
                        rotulo={`Quantidade de ${ent.duracao.tipo}`}
                      />
                    )}
                  </>
                )}
                <SmartDropdown
                  valor={ent.alcance ?? { tipo: 'fixo', valor: 0 }}
                  onChange={(v) => setEnt({ ...ent, alcance: v })}
                  rotulo="Alcance (metros)"
                />
                <SmartDropdown
                  valor={ent.areaRaio ?? { tipo: 'fixo', valor: 0 }}
                  onChange={(v) => setEnt({ ...ent, areaRaio: v })}
                  rotulo="Raio da área / aura (metros)"
                />
              </TabsContent>

              {/* GATILHOS */}
              <TabsContent value="gatilhos" className="space-y-3 pt-3">
                {ent.gatilhos.map((g) => (
                  <div key={g.id} className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Quando:</Label>
                      <Select value={g.evento} onValueChange={(v) => atualizarGatilho(g.id, { evento: v as GatilhoId })}>
                        <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.values(GATILHOS_EVENTOS).map((ev) => (
                            <SelectItem key={ev} value={ev}>{ROTULOS_GATILHOS[ev]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" className="ml-auto" onClick={() => {
                        setEnt({ ...ent, gatilhos: ent.gatilhos.filter((x) => x.id !== g.id) });
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive/70" />
                      </Button>
                    </div>

                    {g.blocos.map((b) => (
                      <div key={b.id} className="rounded-md border border-border/60 bg-background/40 p-3 space-y-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">Conectivo:</span>
                          <Select value={b.modo} onValueChange={(v) => atualizarBloco(g.id, { ...b, modo: v as 'todas' | 'qualquer' })}>
                            <SelectTrigger className="h-7 w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todas">Todas verdadeiras</SelectItem>
                              <SelectItem value="qualquer">Qualquer verdadeira</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={() => {
                            atualizarGatilho(g.id, { blocos: g.blocos.filter((x) => x.id !== b.id) });
                          }}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
                          </Button>
                        </div>

                        {/* Condições */}
                        <div className="space-y-1.5">
                          {b.condicoes.map((c) => (
                            <ConstrutorBlocoLogico
                              key={c.id}
                              condicao={c}
                              onChange={(nc) => atualizarBloco(g.id, { ...b, condicoes: b.condicoes.map((x) => x.id === c.id ? nc : x) })}
                              onRemove={() => atualizarBloco(g.id, { ...b, condicoes: b.condicoes.filter((x) => x.id !== c.id) })}
                            />
                          ))}
                          <Button size="sm" variant="outline" onClick={() => addCondicao(g.id, b.id)} className="h-7 text-xs">
                            <Plus className="h-3 w-3 mr-1" /> Adicionar Condição (Se)
                          </Button>
                        </div>

                        {/* Ações */}
                        <div className="space-y-1.5 pt-2 border-t border-border/40">
                          <div className="text-xs uppercase tracking-wider text-primary/80">Então</div>
                          {b.acoes.map((a) => (
                            <div key={a.id} className="flex flex-wrap items-center gap-1.5 rounded-md border border-border/60 bg-background/60 p-2">
                              <Select value={a.acao} onValueChange={(v) => atualizarBloco(g.id, {
                                ...b, acoes: b.acoes.map((x) => x.id === a.id ? { ...x, acao: v as AcaoEfeitoId } : x),
                              })}>
                                <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {(Object.keys(ACOES_EFEITO) as AcaoEfeitoId[]).map((k) => (
                                    <SelectItem key={k} value={k}>{ACOES_EFEITO[k].ui}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select value={a.alvoAplicacao} onValueChange={(v) => atualizarBloco(g.id, {
                                ...b, acoes: b.acoes.map((x) => x.id === a.id ? { ...x, alvoAplicacao: v as AlvoRefId } : x),
                              })}>
                                <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {(Object.keys(ALVOS_REFERENCIA) as AlvoRefId[]).map((k) => (
                                    <SelectItem key={k} value={k}>{ALVOS_REFERENCIA[k].ui}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {a.acao === 'DANO' && (
                                <label className="flex items-center gap-1.5 text-xs">
                                  Tipo de dano
                                  <select className="h-8 rounded-md border border-input bg-background px-2" value={resolverTipoDano(a.tipoDano) ?? a.tipoDano ?? ''}
                                    onChange={(e) => atualizarBloco(g.id, { ...b, acoes: b.acoes.map((x) => x.id === a.id ? { ...x, tipoDano: e.target.value || undefined } : x) })}>
                                    <option value="">Sem tipo específico</option>
                                    {TIPOS_DANO_MOTOR.map((tipo) => <option key={tipo} value={tipo}>{DAMAGE_TYPE_LABELS[tipo]}</option>)}
                                    {a.tipoDano && !resolverTipoDano(a.tipoDano) && <option value={a.tipoDano}>{a.tipoDano} (sem equivalência)</option>}
                                  </select>
                                </label>
                              )}
                              {(a.acao === 'APLICAR_CONDICAO' || a.acao === 'REMOVER_CONDICAO') ? (
                                <Select value={a.condicao ?? DICIONARIO_CONDICOES[0]} onValueChange={(v) => atualizarBloco(g.id, {
                                  ...b, acoes: b.acoes.map((x) => x.id === a.id ? { ...x, condicao: v as typeof a.condicao } : x),
                                })}>
                                  <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {DICIONARIO_CONDICOES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              ) : a.acao === 'DISPARAR_GATILHO' ? (
                                <>
                                  <Select
                                    value={a.caminhoAlvo ?? ''}
                                    onValueChange={(v) => atualizarBloco(g.id, {
                                      ...b, acoes: b.acoes.map((x) => x.id === a.id ? { ...x, caminhoAlvo: v } : x),
                                    })}
                                  >
                                    <SelectTrigger className="w-52 h-8 text-xs">
                                      <SelectValue placeholder="Entidade alvo…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {entidadesDisponiveis.length === 0 && (
                                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                          Nenhuma outra entidade cadastrada
                                        </div>
                                      )}
                                      {entidadesDisponiveis.map((e) => (
                                        <SelectItem key={e.id} value={e.id}>
                                          {e.nome} <span className="text-muted-foreground">({e.categoria})</span>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Select
                                    value={a.condicao ?? 'aoEquipar'}
                                    onValueChange={(v) => atualizarBloco(g.id, {
                                      ...b, acoes: b.acoes.map((x) => x.id === a.id ? { ...x, condicao: v as typeof a.condicao } : x),
                                    })}
                                  >
                                    <SelectTrigger className="w-44 h-8 text-xs">
                                      <SelectValue placeholder="Evento…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Object.values(GATILHOS_EVENTOS).map((ev) => (
                                        <SelectItem key={ev} value={ev}>{ROTULOS_GATILHOS[ev]}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </>
                              ) : (a.acao === 'CONCEDER_IMUNIDADE' || a.acao === 'REMOVER_IMUNIDADE') ? (() => {
                                const raw = a.caminhoAlvo ?? '';
                                const [escopo, alvosCsv] = raw.includes(':') ? raw.split(':') : [raw || 'todas', ''];
                                const setEscopo = (newEscopo: string, newAlvosCsv?: string) => {
                                  const novo = newEscopo === 'todas' ? 'todas' : `${newEscopo}:${newAlvosCsv ?? ''}`;
                                  atualizarBloco(g.id, {
                                    ...b, acoes: b.acoes.map((x) => x.id === a.id ? { ...x, caminhoAlvo: novo } : x),
                                  });
                                };
                                return (
                                  <div className="flex flex-1 min-w-[240px] gap-1.5 flex-wrap">
                                    <Select value={escopo} onValueChange={(v) => setEscopo(v, '')}>
                                      <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="todas">Todas</SelectItem>
                                        <SelectItem value="categoria">Categoria(s)</SelectItem>
                                        <SelectItem value="condicao">Condição(ões)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    {escopo === 'categoria' && (
                                      <MultiSelectChips
                                        className="flex-1 min-w-[180px]"
                                        valor={alvosCsv}
                                        onChange={(csv) => setEscopo('categoria', csv)}
                                        opcoes={CONDITION_CATEGORIES.map((c) => ({ id: c, label: c }))}
                                        placeholder="Categorias…"
                                      />
                                    )}
                                    {escopo === 'condicao' && (
                                      <MultiSelectChips
                                        className="flex-1 min-w-[180px]"
                                        valor={alvosCsv}
                                        onChange={(csv) => setEscopo('condicao', csv)}
                                        opcoes={ALL_CONDITIONS.map((c) => ({ id: c.id, label: `${c.icon} ${c.name}` }))}
                                        placeholder="Condições…"
                                      />
                                    )}
                                  </div>
                                );
                              })() : (a.acao === 'CONCEDER_VANTAGEM' || a.acao === 'CONCEDER_DESVANTAGEM' || a.acao === 'LIMPAR_VANT_DESV') ? (() => {
                                const raw = a.caminhoAlvo ?? '';
                                const [escopoV, alvoV] = raw.includes(':') ? raw.split(':') : [raw || 'next_any', ''];
                                const precisaTexto = escopoV.endsWith('_specific') || escopoV === 'attack_weapon_group' || escopoV === 'attack_weapon_name';
                                const setVant = (newEsc: string, newAlvo?: string) => {
                                  const v = newAlvo !== undefined ? `${newEsc}:${newAlvo}` : newEsc;
                                  atualizarBloco(g.id, {
                                    ...b, acoes: b.acoes.map((x) => x.id === a.id ? { ...x, caminhoAlvo: v } : x),
                                  });
                                };
                                return (
                                  <div className="flex flex-1 min-w-[240px] gap-1.5">
                                    <Select value={escopoV} onValueChange={(v) => setVant(v, v.endsWith('_specific') || v === 'attack_weapon_group' || v === 'attack_weapon_name' ? '' : undefined)}>
                                      <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        {(Object.keys(ESCOPOS_VANTAGEM) as Array<keyof typeof ESCOPOS_VANTAGEM>).map((k) => (
                                          <SelectItem key={k} value={k}>{ESCOPOS_VANTAGEM[k]}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    {precisaTexto && (() => {
                                      const grupos = Array.from(new Set(ALL_WEAPONS.map((w) => w.group))).sort();
                                      let opcoes: { id: string; label: string }[] = [];
                                      if (escopoV === 'attack_weapon_group') opcoes = grupos.map((g) => ({ id: g, label: g }));
                                      else if (escopoV === 'attack_weapon_name') opcoes = ALL_WEAPONS.map((w) => ({ id: w.name, label: w.name }));
                                      else if (escopoV === 'save_specific') opcoes = ORDEM_TR.map((k) => ({ id: ROTULOS_TR[k], label: ROTULOS_TR[k] }));
                                      else if (escopoV === 'skill_specific') opcoes = ORDEM_PERICIAS.map((k) => ({ id: ROTULOS_PERICIAS[k], label: ROTULOS_PERICIAS[k] }));
                                      else if (escopoV === 'attribute_specific') opcoes = (Object.keys(SISTEMA_ATRIBUTOS) as Array<keyof typeof SISTEMA_ATRIBUTOS>).map((k) => ({ id: k, label: `${ROTULOS_ATRIBUTOS[k]} (${k})` }));
                                      return (
                                        <MultiSelectChips
                                          className="w-52"
                                          opcoes={opcoes}
                                          valor={alvoV}
                                          onChange={(csv) => setVant(escopoV, csv)}
                                          placeholder="Escolher…"
                                        />
                                      );
                                    })()}
                                  </div>
                                );
                              })() : (a.acao === 'ATIVAR_FLAG' || a.acao === 'DESATIVAR_FLAG' || a.acao === 'ALTERNAR_FLAG') ? (
                                <Input
                                  className="flex-1 min-w-[240px] h-8 text-xs font-mono"
                                  placeholder="nome_da_flag (ex.: descoberto, modo_furia)"
                                  value={a.caminhoAlvo ?? ''}
                                  onChange={(e) => atualizarBloco(g.id, {
                                    ...b, acoes: b.acoes.map((x) => x.id === a.id ? { ...x, caminhoAlvo: e.target.value } : x),
                                  })}
                                />
                              ) : (a.acao === 'INCREMENTAR_CONTADOR' || a.acao === 'ZERAR_CONTADOR' || a.acao === 'DEFINIR_CONTADOR') ? (
                                <>
                                  <Input
                                    className="w-44 h-8 text-xs font-mono"
                                    placeholder="nome_contador (ex.: fadiga)"
                                    value={a.caminhoAlvo ?? ''}
                                    onChange={(e) => atualizarBloco(g.id, {
                                      ...b, acoes: b.acoes.map((x) => x.id === a.id ? { ...x, caminhoAlvo: e.target.value } : x),
                                    })}
                                  />
                                  {a.acao !== 'ZERAR_CONTADOR' && (
                                    <div className="flex-1 min-w-[180px]">
                                      <SmartDropdown
                                        valor={a.valor ?? { tipo: 'fixo', valor: 1 }}
                                        onChange={(v) => atualizarBloco(g.id, {
                                          ...b, acoes: b.acoes.map((x) => x.id === a.id ? { ...x, valor: v } : x),
                                        })}
                                      />
                                    </div>
                                  )}
                                </>
                              ) : (a.acao === 'CONCEDER_TALENTO' || a.acao === 'REMOVER_TALENTO') ? (() => {
                                const opcoes = [...GENERAL_TALENTS, ...ORIGIN_TALENTS].map((t) => ({ id: t.id, label: t.name }));
                                return (
                                  <Select value={a.condicao ?? ''} onValueChange={(v) => atualizarBloco(g.id, {
                                    ...b, acoes: b.acoes.map((x) => x.id === a.id ? { ...x, condicao: v as typeof a.condicao } : x),
                                  })}>
                                    <SelectTrigger className="flex-1 min-w-[240px] h-8 text-xs"><SelectValue placeholder="Talento…" /></SelectTrigger>
                                    <SelectContent className="max-h-72">
                                      {opcoes.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                );
                              })() : a.acao === 'MODIFICAR_USOS_APTIDAO' ? (
                                <>
                                  <Select value={a.condicao ?? ''} onValueChange={(v) => atualizarBloco(g.id, {
                                    ...b, acoes: b.acoes.map((x) => x.id === a.id ? { ...x, condicao: v as typeof a.condicao } : x),
                                  })}>
                                    <SelectTrigger className="w-52 h-8 text-xs"><SelectValue placeholder="Aptidão de Aura…" /></SelectTrigger>
                                    <SelectContent className="max-h-72">
                                      {AURA_APTITUDES.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                  <div className="flex-1 min-w-[140px]">
                                    <SmartDropdown
                                      valor={a.valor ?? { tipo: 'fixo', valor: 0 }}
                                      onChange={(v) => atualizarBloco(g.id, {
                                        ...b, acoes: b.acoes.map((x) => x.id === a.id ? { ...x, valor: v } : x),
                                      })}
                                    />
                                  </div>
                                </>
                              ) : a.acao === 'RECARREGAR_HABILIDADE' ? (
                                <Input
                                  className="flex-1 min-w-[240px] h-8 text-xs font-mono"
                                  placeholder="id_habilidade_spec (ex.: golpe_mortal)"
                                  value={a.condicao ?? ''}
                                  onChange={(e) => atualizarBloco(g.id, {
                                    ...b, acoes: b.acoes.map((x) => x.id === a.id ? { ...x, condicao: e.target.value as typeof a.condicao } : x),
                                  })}
                                />
                              ) : a.acao === 'MODIFICAR_CUSTO_ACAO' ? (
                                <>
                                  <Input
                                    className="w-44 h-8 text-xs font-mono"
                                    placeholder="id_habilidade (ex.: acao_a)"
                                    value={a.caminhoAlvo ?? ''}
                                    onChange={(e) => atualizarBloco(g.id, {
                                      ...b, acoes: b.acoes.map((x) => x.id === a.id ? { ...x, caminhoAlvo: e.target.value } : x),
                                    })}
                                  />
                                  <Select value={a.condicao ?? 'action_standard'} onValueChange={(v) => atualizarBloco(g.id, {
                                    ...b, acoes: b.acoes.map((x) => x.id === a.id ? { ...x, condicao: v as typeof a.condicao } : x),
                                  })}>
                                    <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {Object.values(SYSTEM_ACTIONS).map((s) => (
                                        <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <div className="flex-1 min-w-[140px]">
                                    <SmartDropdown
                                      valor={a.valor ?? { tipo: 'fixo', valor: 0 }}
                                      onChange={(v) => atualizarBloco(g.id, {
                                        ...b, acoes: b.acoes.map((x) => x.id === a.id ? { ...x, valor: v } : x),
                                      })}
                                    />
                                  </div>
                                </>
                              ) : (a.acao === 'REDUZIR_CUSTO' || a.acao === 'LIMPAR_REDUTOR_CUSTO' || a.acao === 'CONSUMIR_RECURSO' ||
                                   a.acao === 'SOMAR' || a.acao === 'SUBTRAIR' || a.acao === 'MULTIPLICAR' || a.acao === 'DIVIDIR' ||
                                   a.acao === 'DEFINIR' || a.acao === 'CURAR' || a.acao === 'DANO') ? (() => {
                                const opcoes = listarCaminhosNumericos();
                                const valorAtual = a.caminhoAlvo ?? opcoes[0]?.chave ?? '';
                                const ehKnown = opcoes.some((o) => o.chave === valorAtual || o.caminho === valorAtual);
                                return (
                                  <>
                                    <Select value={ehKnown ? valorAtual : '__custom__'} onValueChange={(v) => {
                                      if (v === '__custom__') return;
                                      atualizarBloco(g.id, {
                                        ...b, acoes: b.acoes.map((x) => x.id === a.id ? { ...x, caminhoAlvo: v } : x),
                                      });
                                    }}>
                                      <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Recurso/Atributo…" /></SelectTrigger>
                                      <SelectContent>
                                        {opcoes.map((o) => (
                                          <SelectItem key={o.chave} value={o.chave}>{o.rotulo} ({o.chave})</SelectItem>
                                        ))}
                                        <SelectItem value="__custom__">— Personalizado —</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    {!ehKnown && (
                                      <Input
                                        className="w-32 h-8 text-xs font-mono"
                                        placeholder="chave"
                                        value={valorAtual}
                                        onChange={(e) => atualizarBloco(g.id, {
                                          ...b, acoes: b.acoes.map((x) => x.id === a.id ? { ...x, caminhoAlvo: e.target.value } : x),
                                        })}
                                      />
                                    )}
                                    {a.acao !== 'LIMPAR_REDUTOR_CUSTO' && (
                                      <div className="flex-1 min-w-[160px]">
                                        <SmartDropdown
                                          valor={a.valor ?? { tipo: 'fixo', valor: 1 }}
                                          onChange={(v) => atualizarBloco(g.id, {
                                            ...b, acoes: b.acoes.map((x) => x.id === a.id ? { ...x, valor: v } : x),
                                          })}
                                        />
                                      </div>
                                    )}
                                  </>
                                );
                              })() : (
                                <div className="flex-1 min-w-[240px]">
                                  <SmartDropdown
                                    valor={a.valor ?? { tipo: 'fixo', valor: 0 }}
                                    onChange={(v) => atualizarBloco(g.id, {
                                      ...b, acoes: b.acoes.map((x) => x.id === a.id ? { ...x, valor: v } : x),
                                    })}
                                  />
                                </div>
                              )}
                              <Button size="sm" variant="ghost" className="ml-auto h-8 w-8 p-0" onClick={() => atualizarBloco(g.id, {
                                ...b, acoes: b.acoes.filter((x) => x.id !== a.id),
                              })}>
                                <Trash2 className="h-4 w-4 text-destructive/70" />
                              </Button>

                              {/* Duração POR AÇÃO — só faz sentido em ações que produzem efeito persistente. */}
                              {(a.acao === 'APLICAR_CONDICAO' || a.acao === 'REROLL') && (
                                <div className="basis-full flex flex-wrap items-center gap-1.5 mt-1 pt-1 border-t border-border/40">
                                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                    ⏱ Duração do efeito
                                  </Label>
                                  <Select
                                    value={a.duracao?.tipo ?? 'rodadas'}
                                    onValueChange={(v) => {
                                      const tipo = v as DuracaoTipo;
                                      const precisaValor = tipo !== 'instantaneo' && tipo !== 'permanente' && tipo !== 'ateDissipar';
                                      const novaDur = {
                                        tipo,
                                        valor: precisaValor
                                          ? (a.duracao?.valor ?? { tipo: 'fixo' as const, valor: 1 })
                                          : undefined,
                                      };
                                      atualizarBloco(g.id, {
                                        ...b, acoes: b.acoes.map((x) => x.id === a.id ? { ...x, duracao: novaDur } : x),
                                      });
                                    }}
                                  >
                                    <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {Object.values(TIPOS_DURACAO).map((t) => (
                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {a.duracao && a.duracao.tipo !== 'instantaneo' && a.duracao.tipo !== 'permanente' && a.duracao.tipo !== 'ateDissipar' && (
                                    <Input
                                      type="number"
                                      className="w-20 h-7 text-xs"
                                      value={a.duracao.valor && a.duracao.valor.tipo === 'fixo' ? a.duracao.valor.valor : 1}
                                      onChange={(e) => {
                                        const v = Math.max(1, Number(e.target.value) || 1);
                                        atualizarBloco(g.id, {
                                          ...b, acoes: b.acoes.map((x) => x.id === a.id
                                            ? { ...x, duracao: { ...(x.duracao ?? { tipo: 'rodadas' as DuracaoTipo }), valor: { tipo: 'fixo', valor: v } } }
                                            : x),
                                        });
                                      }}
                                    />
                                  )}
                                  {!a.duracao && (
                                    <span className="text-[10px] text-muted-foreground italic">
                                      (padrão: 1 rodada)
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                          <Button size="sm" variant="outline" onClick={() => addAcao(g.id, b.id)} className="h-7 text-xs">
                            <Plus className="h-3 w-3 mr-1" /> Adicionar Ação (Então)
                          </Button>
                        </div>
                      </div>
                    ))}

                    <Button size="sm" variant="secondary" onClick={() => {
                      atualizarGatilho(g.id, { blocos: [...g.blocos, novoBloco()] });
                    }}>
                      <Plus className="h-3 w-3 mr-1" /> Adicionar Bloco Se/Então
                    </Button>
                  </div>
                ))}
                <Button variant="outline" onClick={() => setEnt({
                  ...ent,
                  gatilhos: [...ent.gatilhos, { id: crypto.randomUUID(), evento: 'aoEquipar', blocos: [] }],
                })}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar Gatilho
                </Button>
              </TabsContent>

              {/* COMBATE — Dano nativo (Pilar de Dano) */}
              <TabsContent value="combate" className="space-y-3 pt-3">
                {/* Toolbar: modo + Omni-Helper -------------------------- */}
                <div className="flex flex-wrap items-center gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className={`h-8 text-xs gap-1 transition-all ${
                      helperAberto
                        ? 'border-violet-300 bg-violet-500/30 text-violet-50 shadow-[0_0_22px_rgba(124,58,237,0.85)] ring-2 ring-violet-300/60'
                        : 'border-violet-500/60 bg-violet-500/10 text-violet-200 hover:bg-violet-500/25 hover:text-violet-100 shadow-[0_0_14px_rgba(124,58,237,0.45)]'
                    }`}
                    onClick={() => setHelperAberto((v) => !v)}
                    aria-pressed={helperAberto}
                    title={helperAberto ? 'Fechar Omni-Helper' : 'Abrir Omni-Helper'}
                  >
                    <BookOpen className={`h-3.5 w-3.5 ${helperAberto ? 'fill-violet-200/30' : ''}`} />
                    {helperAberto ? 'Omni-Helper ✓' : 'Omni-Helper'}
                  </Button>
                </div>
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
                  ✦ Preencha para que esta entidade aplique um <span className="text-primary font-semibold">efeito direto</span>
                  {' '}(dano, cura ou modificador). Itens com efeitos exibem botões de ação no inventário.
                  <br />
                  <span className="text-foreground/70">
                    💡 Use <code>@RESULTADO_N</code> em um efeito posterior para reaproveitar o valor de um anterior
                    (ex.: lifesteal → <code>@RESULTADO_1 / 2</code>).
                  </span>
                </div>
                {(() => {
                  const cd: CombatData = normalizarCombatData(ent.combatData) ?? {
                    effects: [],
                    effectsPassive: [],
                    effectsActive: [],
                    critRange: 20,
                    critMultiplier: 2,
                    actionCost: SYSTEM_ACTIONS.PADRAO.id,
                    rangeType: 'ranged',
                    aoeShape: 'single',
                    aoeSize: 0,
                  };
                  const passiveEffects = cd.effectsPassive ?? [];
                  const activeEffects = cd.effectsActive ?? [];
                  const ativo = activeEffects.length > 0;

                  const merge = (patch: Partial<CombatData>) => {
                    const next: CombatData = { ...cd, ...patch };
                    // Mantém a união sempre coerente (back-compat).
                    next.effectsPassive = next.effectsPassive ?? [];
                    next.effectsActive = next.effectsActive ?? [];
                    next.effects = [...next.effectsPassive, ...next.effectsActive];
                    next.isActive = next.effectsActive.length > 0;
                    setEnt({ ...ent, combatData: next });
                  };

                  const setPassive = (effs: CombatEffect[]) =>
                    merge({ effectsPassive: effs });
                  const setActive = (effs: CombatEffect[]) =>
                    merge({ effectsActive: effs });

                  const needsAoeSize = cd.aoeShape && cd.aoeShape !== 'single';
                  const needsRangeMeters = cd.rangeType === 'ranged';
                  const ehAcessorio = (ent.categoria === 'item' || ent.categoria === 'arma')
                    && ent.slotType
                    && ent.slotType !== 'nenhum';

                  return (
                    <>
                      {/* ========== 🛡️ SCRIPT PASSIVO (Ao Equipar) ========== */}
                      <section className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 space-y-2">
                        <header className="flex items-baseline justify-between gap-2 flex-wrap">
                          <div>
                            <div className="text-xs uppercase tracking-wider text-emerald-300 font-semibold">
                              🛡️ Script Passivo (Ao Equipar)
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-snug">
                              Roda automaticamente quando o item vai para um slot de equipamento.
                              Duração sempre <strong>permanente</strong>. Ideal para bônus em
                              <code className="mx-1 text-foreground/80">vida_max</code>,
                              <code className="text-foreground/80">defesa</code>,
                              <code className="text-foreground/80">esquiva</code>, etc.
                            </p>
                          </div>
                          <span className="text-[10px] text-emerald-300/80">
                            {passiveEffects.length} efeito(s)
                          </span>
                        </header>
                        <OmniScriptTerminal
                          valor={scriptPassivo}
                          onChange={(s) => {
                            setScriptPassivo(s);
                            const { efeitos } = parseOmniScript(s, { defaultTarget: 'USUARIO' });
                            setPassive(efeitos);
                          }}
                          ativoParaInsercao
                          defaultTarget="USUARIO"
                        />
                        {ehAcessorio && (
                          <div className="text-[10px] text-amber-200/90 flex items-start gap-1.5">
                            <span>📌</span>
                            <span>
                              Aplicado enquanto equipado em{' '}
                              <strong>{ITEM_SLOT_LABELS[ent.slotType!]}</strong>.
                            </span>
                          </div>
                        )}
                      </section>

                      {/* ========== ⚔️ SCRIPT ATIVO (Ação/Uso) ============== */}
                      <section className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
                        <header className="flex items-baseline justify-between gap-2 flex-wrap">
                          <div>
                            <div className="text-xs uppercase tracking-wider text-amber-300 font-semibold">
                              ⚔️ Script Ativo (Ação/Uso)
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-snug">
                              Roda apenas quando o jogador clica em <strong>Usar / Atacar</strong>{' '}
                              durante o jogo. Habilita Margem de Crítico, Custo de Ação, Alcance e Área.
                              Deixe vazio se for apenas um acessório passivo.
                            </p>
                          </div>
                          <span className="text-[10px] text-amber-300/80">
                            {activeEffects.length} efeito(s)
                          </span>
                        </header>
                        <OmniScriptTerminal
                          valor={scriptAtivo}
                          onChange={(s) => {
                            setScriptAtivo(s);
                            const { efeitos } = parseOmniScript(s, { defaultTarget: 'ALVO' });
                            setActive(efeitos);
                          }}
                          ativoParaInsercao
                          defaultTarget="ALVO"
                        />
                        <div className="rounded-md border border-border/40 bg-background/40 p-2 text-[10px] text-muted-foreground leading-relaxed">
                          💡 <strong className="text-violet-300">Dica:</strong>{' '}
                          <code className="mx-1 text-foreground/80">subtrair 1d8 + forca em alvo.vida_atual</code>{' '}
                          ou <code className="text-foreground/80">somar 2d4 em vida_atual</code> para curar o usuário.
                        </div>

                        {/* Campos só fazem sentido com efeitos ativos --------- */}
                        {ativo && (
                          <div className="space-y-3 pt-2 border-t border-amber-500/20">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label>Margem de Crítico (≥)</Label>
                                <Input
                                  type="number" min={2} max={20}
                                  value={cd.critRange}
                                  onChange={(e) => merge({ critRange: Math.max(2, Math.min(20, Number(e.target.value) || 20)) })}
                                />
                              </div>
                              <div>
                                <Label>Multiplicador de Crítico</Label>
                                <Input
                                  type="number" min={1} step={0.5}
                                  value={cd.critMultiplier}
                                  onChange={(e) => merge({ critMultiplier: Math.max(1, Number(e.target.value) || 2) })}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label>Custo de Ação</Label>
                                <Select
                                  value={cd.actionCost ?? SYSTEM_ACTIONS.PADRAO.id}
                                  onValueChange={(v) => merge({ actionCost: v })}
                                >
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {Object.values(SYSTEM_ACTIONS).map((a) => (
                                      <SelectItem key={a.id} value={a.id}>{a.label} (custo {a.cost})</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label>Tipo de Alcance</Label>
                                <Select
                                  value={cd.rangeType ?? 'ranged'}
                                  onValueChange={(v) => merge({ rangeType: v })}
                                >
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {RANGE_TYPES.map((r) => (
                                      <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label>Forma de Área</Label>
                                <Select
                                  value={cd.aoeShape ?? 'single'}
                                  onValueChange={(v) => merge({ aoeShape: v })}
                                >
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {AOE_SHAPES.map((s) => (
                                      <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              {(needsAoeSize || needsRangeMeters) && (
                                <div>
                                  <Label>
                                    {needsAoeSize ? 'Raio / Tamanho (metros)' : 'Distância (metros)'}
                                  </Label>
                                  <Input
                                    type="number" min={0}
                                    value={cd.aoeSize ?? 0}
                                    onChange={(e) => merge({ aoeSize: Math.max(0, Number(e.target.value) || 0) })}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </section>
                    </>
                  );
                })()}
                {ent.combatData && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEnt({ ...ent, combatData: undefined })}
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Remover dados de combate
                  </Button>
                )}
                {/* Painel flutuante (Receitas + Guia) -------------------- */}
                <GuiaFormulasDialog
                  aberto={helperAberto}
                  onClose={() => setHelperAberto(false)}
                  modo="flutuante"
                  onAplicarReceita={(efeitos) => {
                    const cdAtual = normalizarCombatData(ent.combatData) ?? {
                      effects: [],
                      critRange: 20,
                      critMultiplier: 2,
                    };
                    setEnt({
                      ...ent,
                      combatData: { ...cdAtual, effects: [...cdAtual.effects, ...efeitos] },
                    });
                  }}
                  onInserirFormula={(trecho) => {
                    const cdAtual = normalizarCombatData(ent.combatData);
                    if (!cdAtual) return;
                    const alvoId = efeitoAtivoId ?? cdAtual.effects[cdAtual.effects.length - 1]?.id;
                    if (!alvoId) return;
                    const alvo = cdAtual.effects.find((e) => e.id === alvoId);
                    if (!alvo) return;
                    const atual = alvo.formula || '';
                    const sep = atual && !atual.endsWith(' ') && !atual.endsWith('(') ? ' ' : '';
                    const novaFormula = atual + sep + trecho;
                    setEnt({
                      ...ent,
                      combatData: {
                        ...cdAtual,
                        effects: cdAtual.effects.map((e) =>
                          e.id === alvoId ? { ...e, formula: novaFormula } : e,
                        ),
                      },
                    });
                  }}
                  onSelecionarRecurso={(chave) => {
                    // Preenche o seletor "Afetar Recurso" do efeito em edição.
                    const cdAtual = normalizarCombatData(ent.combatData);
                    if (!cdAtual) return;
                    const alvoId = efeitoAtivoId ?? cdAtual.effects[cdAtual.effects.length - 1]?.id;
                    if (!alvoId) return;
                    setEnt({
                      ...ent,
                      combatData: {
                        ...cdAtual,
                        effects: cdAtual.effects.map((e) =>
                          e.id === alvoId ? { ...e, resourcePath: chave } : e,
                        ),
                      },
                    });
                  }}
                />
              </TabsContent>

              {/* COMÉRCIO (visível só para Mestre — este construtor já é restrito) */}
              <TabsContent value="ativas" className="space-y-3 pt-3">
                <EditorAcoesAtivas ent={ent} setEnt={setEnt} />
              </TabsContent>
              <TabsContent value="comercio" className="space-y-3 pt-3">
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
                  ⚠ Esta camada é <span className="text-primary font-semibold">privada do Mestre</span>.
                  Jogadores nunca veem <code>hiddenTags</code> nem o flag <code>isBought</code> na ficha.
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Preço base (moedas)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={ent.comercio?.basePrice ?? 0}
                      onChange={(e) => setEnt({
                        ...ent,
                        comercio: {
                          basePrice: Math.max(0, Number(e.target.value) || 0),
                          hiddenTags: ent.comercio?.hiddenTags ?? [],
                          isBought: ent.comercio?.isBought ?? false,
                        },
                      })}
                    />
                  </div>
                  <div>
                    <Label>Origem do item</Label>
                    <Select
                      value={ent.comercio?.isBought ? 'comprado' : 'criado'}
                      onValueChange={(v) => setEnt({
                        ...ent,
                        comercio: {
                          basePrice: ent.comercio?.basePrice ?? 0,
                          hiddenTags: ent.comercio?.hiddenTags ?? [],
                          isBought: v === 'comprado',
                        },
                      })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="criado">Criado pelo Mestre (vendável)</SelectItem>
                        <SelectItem value="comprado">Comprado em loja (não revendável)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Tags ocultas (separadas por vírgula)</Label>
                  <Input
                    placeholder="amaldicoado, reliquia, ilegal"
                    value={(ent.comercio?.hiddenTags ?? []).join(', ')}
                    onChange={(e) => setEnt({
                      ...ent,
                      comercio: {
                        basePrice: ent.comercio?.basePrice ?? 0,
                        hiddenTags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                        isBought: ent.comercio?.isBought ?? false,
                      },
                    })}
                  />
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(ent.comercio?.hiddenTags ?? []).map((t) => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Lojas só compram este item se uma de suas <em>acceptedTags</em> bater com alguma tag oculta acima.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Painel lateral de simulação */}
          <div className="hidden lg:block overflow-y-auto">
            <SimuladorPreview entidade={ent} />
          </div>
        </div>

        <div className="flex flex-wrap justify-end items-center gap-2 pt-3 border-t border-border">
          {onProporConceito && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setConceitoAberto(true)}
              className="mr-auto h-9 gap-1 border-amber-500/60 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 hover:text-amber-100"
              title="Envia apenas Nome + Descrição. O Mestre completa a mecânica depois."
            >
              💡 Propor Apenas Conceito
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => { onSalvar(ent); onClose(); }} className="bg-primary hover:bg-primary/90">
            Salvar Entidade
          </Button>
        </div>

        {/* === Diálogo do Modo Preguiça (Propor Apenas Conceito) ============ */}
        {onProporConceito && (
          <Dialog open={conceitoAberto} onOpenChange={setConceitoAberto}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-amber-300">
                  💡 Propor Apenas Conceito
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Modo Preguiça — envie só a ideia.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-[12px] text-amber-100/95 leading-relaxed space-y-1.5">
                  <p>
                    <strong>Como funciona:</strong> você não precisa preencher fórmulas, gatilhos
                    ou mecânica. Basta escrever <em>nome</em> e <em>descrição</em> da sua ideia.
                  </p>
                  <ul className="list-disc pl-5 space-y-0.5 text-amber-100/85">
                    <li>O conceito vai para o <strong>Catálogo do Mestre</strong> com o aviso{' '}
                      <span className="px-1 rounded bg-amber-500/25 border border-amber-500/40 text-amber-50 text-[11px]">
                        Aguardando mecânica amaldiçoada
                      </span>.
                    </li>
                    <li>O Mestre abre seu conceito e escreve a lógica no <strong>Terminal Omni-Script</strong>.</li>
                    <li>Quando finalizar, o item pode ser <strong>entregue ao seu personagem</strong>.</li>
                  </ul>
                </div>

                <div>
                  <Label htmlFor="conceito-nome">Nome do Conceito</Label>
                  <Input
                    id="conceito-nome"
                    autoFocus
                    value={conceitoNome}
                    onChange={(e) => setConceitoNome(e.target.value)}
                    placeholder="Ex.: Adaga Sussurrante"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="conceito-desc">Descrição (o que você imagina que faz)</Label>
                  <Textarea
                    id="conceito-desc"
                    value={conceitoDesc}
                    onChange={(e) => setConceitoDesc(e.target.value)}
                    placeholder="Ex.: Uma adaga que suga vitalidade do alvo e devolve metade ao usuário."
                    rows={4}
                    className="mt-1"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1 italic">
                    Quanto mais detalhes do efeito desejado, mais fácil para o Mestre traduzir em mecânica.
                  </p>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="ghost" onClick={() => setConceitoAberto(false)}>
                  Cancelar
                </Button>
                <Button
                  disabled={!conceitoNome.trim() || !conceitoDesc.trim()}
                  className="bg-amber-500 text-amber-950 hover:bg-amber-400"
                  onClick={() => {
                    const tagsBase = (ent.tags ?? []).filter((t) => t !== 'rascunho-conceito');
                    const conceito: EntidadeOmni = {
                      ...ent,
                      nome: conceitoNome.trim(),
                      descricao: conceitoDesc.trim(),
                      // Conceito puro: sem lógica de combate definida.
                      combatData: undefined,
                      tags: [...tagsBase, 'rascunho-conceito'],
                      atualizadoEm: Date.now(),
                    };
                    onProporConceito(conceito);
                    setConceitoAberto(false);
                    onClose();
                  }}
                >
                  💡 Enviar Conceito ao Mestre
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}

// === Card de um efeito de combate ===========================================
function EffectCard({
  indice,
  efeito,
  onChange,
  onRemove,
  modo = 'avancado',
  onAbrirHelper,
  helperAtivo,
  onFocoFormula,
  ativoParaInsercao,
}: {
  indice: number;
  efeito: CombatEffect;
  onChange: (patch: Partial<CombatEffect>) => void;
  onRemove: () => void;
  modo?: 'simples' | 'avancado';
  onAbrirHelper?: () => void;
  helperAtivo?: boolean;
  onFocoFormula?: () => void;
  ativoParaInsercao?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const aliases = Object.keys(ALIASES_FORMULA);
  const insertAlias = (alias: string) =>
    onChange({ formula: (efeito.formula || '') + (efeito.formula && !efeito.formula.endsWith(' ') ? ' ' : '') + `@${alias}` });

  const cor =
    efeito.type === 'ADICIONAR'
      ? 'border-emerald-500/40 bg-emerald-500/5'
      : efeito.type === 'MODIFICADOR'
        ? 'border-violet-500/40 bg-violet-500/5'
        : 'border-destructive/40 bg-destructive/5';
  const icone = efeito.type === 'ADICIONAR' ? '🟢' : efeito.type === 'MODIFICADOR' ? '🟣' : '🔴';
  // ─── Rótulo dinâmico baseado em (Ação + Recurso) ────────────────────
  // Ex.: SOMAR + vida_max → "Aumentar Vida Máxima"
  //      SOMAR + vida_atual → "Curar"
  //      SOMAR + forca → "Buff de Força"
  const rotuloTipo = descreverAcaoEfeito(efeito.type, efeito.resourcePath);
  const rotuloAlvo = efeito.target === 'USUARIO' ? 'Usuário' : efeito.target === 'AREA' ? 'Área' : 'Alvo';

  return (
    <div className={`rounded-md border ${cor}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span className="text-xs font-mono text-muted-foreground">#{indice}</span>
        <span className="text-base">{icone}</span>
        <span className="text-xs font-semibold text-foreground">
          {rotuloTipo} <span className="text-muted-foreground">→ {rotuloAlvo}</span>
        </span>
        <code className="ml-auto text-[10px] text-muted-foreground font-mono truncate max-w-[40%]">
          {efeito.formula || '— sem fórmula —'}
        </code>
        <Trash2
          className="h-4 w-4 text-destructive/70 ml-2 shrink-0"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/40">
          {/* Tríade obrigatória: Ação (tipo) + Alvo + Recurso afetado.
              Visível em AMBOS os modos (Simples e Avançado) para eliminar
              a ambiguidade entre dano e cura. */}
          <div className="grid gap-2 pt-2 grid-cols-1 md:grid-cols-3">
            <div>
              <Label className="text-[11px]">Tipo de Ação</Label>
              <Select
                value={efeito.type}
                onValueChange={(v) => onChange({ type: v as CombatEffect['type'] })}
              >
                <SelectTrigger
                  className={`h-8 text-xs ${
                    efeito.type === 'SUBTRAIR'
                      ? 'border-destructive/60 bg-destructive/10 text-destructive'
                      : efeito.type === 'ADICIONAR'
                        ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400'
                        : 'border-violet-500/60 bg-violet-500/10 text-violet-300'
                  }`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADICIONAR">🟢 SOMAR (Aumentar / Buff) — Recurso + Resultado</SelectItem>
                  <SelectItem value="SUBTRAIR">🔴 SUBTRAIR (Reduzir / Dano) — Recurso − Resultado</SelectItem>
                  <SelectItem value="MODIFICADOR">🟣 DEFINIR (Fixar / Set) — Recurso = Resultado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px]">Alvo do Efeito</Label>
              <Select
                value={efeito.target}
                onValueChange={(v) => onChange({ target: v as CombatEffect['target'] })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALVO">🎯 Alvo</SelectItem>
                  <SelectItem value="USUARIO">🧙 Usuário</SelectItem>
                  <SelectItem value="AREA">◯ Área</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px]">Afetar Recurso</Label>
              <SeletorRecurso
                value={efeito.resourcePath ?? ''}
                onChange={(v) => onChange({ resourcePath: v })}
                placeholder="ex: vida_atual, vida_max…"
                className="w-full"
              />
            </div>
          </div>

          {/* Legenda dinâmica: explica em linguagem natural o que vai acontecer */}
          <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 p-2 text-[11px] leading-relaxed text-muted-foreground">
            <span className="text-primary/80 font-semibold mr-1">ⓘ</span>
            {descreverImpactoEfeito(efeito.type, efeito.resourcePath)}
          </div>

          {/* Resumo da regra (Ação + Recurso + Fórmula) ----------------- */}
          <div className="rounded-md border border-border/50 bg-background/60 p-2 text-[11px] leading-relaxed">
            <span className="text-muted-foreground">Regra: </span>
            <span
              className={
                efeito.type === 'SUBTRAIR'
                  ? 'text-destructive font-semibold'
                  : efeito.type === 'ADICIONAR'
                    ? 'text-emerald-400 font-semibold'
                    : 'text-violet-300 font-semibold'
              }
            >
              {efeito.type === 'SUBTRAIR' ? 'SUBTRAIR' : efeito.type === 'ADICIONAR' ? 'SOMAR' : 'DEFINIR'}
            </span>
            <span className="text-muted-foreground"> em </span>
            <code className="font-mono text-primary">
              {efeito.target === 'USUARIO' ? '@USUARIO' : efeito.target === 'AREA' ? '@AREA' : '@ALVO'}.{efeito.resourcePath || 'vida_atual'}
            </code>
            <span className="text-muted-foreground"> ← </span>
            <code className="font-mono text-foreground/90">{efeito.formula || '—'}</code>
            <div className="mt-1 text-[10px] text-muted-foreground italic">
              ⇒ {rotuloTipo} <span className="text-foreground/70">→ {rotuloAlvo}</span>
            </div>
          </div>

          {/* Tipo de Dano (apenas Modo Simples, para descrever a natureza) */}
          {modo === 'simples' && (
            <div>
              <Label className="text-[11px]">Tipo de Dano</Label>
              <Select
                value={efeito.damageType ?? 'Cortante'}
                onValueChange={(v) => onChange({ damageType: v })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAMAGE_TYPES.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {modo === 'avancado' && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-[10px] text-amber-200/90 leading-snug">
              ⚠ <strong>Modo Avançado:</strong> a tríade <em>Ação + Alvo + Recurso</em> acima é obrigatória —
              ela elimina a ambiguidade entre dano e cura. A fórmula calcula o <em>Resultado</em> que será
              aplicado segundo a Ação escolhida (Dano subtrai, Cura soma, Modificar fixa).
            </div>
          )}

          {modo === 'simples' ? (
            <SemanticBuilder efeito={efeito} onChange={onChange} />
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[11px]">Fórmula de Efeito</Label>
                {onAbrirHelper && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={`h-6 text-[10px] gap-1 transition-all ${
                      helperAtivo
                        ? 'border-violet-300 bg-violet-500/30 text-violet-50 shadow-[0_0_14px_rgba(124,58,237,0.85)] ring-1 ring-violet-300/60'
                        : 'border-violet-500/60 bg-violet-500/10 text-violet-200 hover:bg-violet-500/25 hover:text-violet-100 shadow-[0_0_10px_rgba(124,58,237,0.45)]'
                    }`}
                    aria-pressed={!!helperAtivo}
                    title={helperAtivo ? 'Fechar Omni-Helper' : 'Abrir Omni-Helper'}
                    onClick={onAbrirHelper}
                  >
                    <BookOpen className="h-3 w-3" />
                    {helperAtivo ? 'Omni-Helper ✓' : 'Omni-Helper'}
                  </Button>
                )}
              </div>
              <Input
                value={efeito.formula}
                onChange={(e) => onChange({ formula: e.target.value })}
                onFocus={() => onFocoFormula?.()}
                placeholder={indice > 1
                  ? `Ex: @USUARIO.FOR + 1d8  ·  ou  @RESULTADO_${indice - 1} / 2`
                  : 'Ex: @USUARIO.FOR + 1d8  ·  ou  @ALVO.vida / 2'}
                className={`font-mono h-8 text-xs transition-shadow ${ativoParaInsercao ? 'ring-2 ring-primary/60 border-primary/60' : ''}`}
              />
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Inserir @contexto — sempre AZUL (referência) */}
                <Select value="" onValueChange={(v) => v && insertAlias(v)}>
                  <SelectTrigger className="h-7 w-40 text-xs border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20">
                    <SelectValue placeholder="@ Contexto…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[420px]">
                    {/* Dicionário agrupado: Atributos / Recursos / Progressão / Combate / Globais / Cena */}
                    {DICIONARIO_CHAVES_OMNI.map((cat) => (
                      <div key={cat.grupo}>
                        {cat.escopos.map((esc) => (
                          <div key={`${cat.grupo}-${esc}`}>
                            <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                              {esc === 'NENHUM' ? cat.grupo : `${cat.grupo} · ${esc === 'USUARIO' ? 'Usuário' : 'Alvo'}`}
                            </div>
                            {cat.itens.map((it) => {
                              const value = esc === 'NENHUM' ? it.id : `${esc}.${it.id}`;
                              return (
                                <SelectItem key={`${esc}-${value}`} value={value}>
                                  <span className="font-mono text-sky-300">@{value}</span>
                                  {it.hint && <span className="ml-2 text-[10px] text-muted-foreground">{it.hint}</span>}
                                </SelectItem>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    ))}
                    {/* Encadeamento de efeitos */}
                    {indice > 1 && (
                      <>
                        <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Encadeamento</div>
                        {Array.from({ length: indice - 1 }).map((_, i) => (
                          <SelectItem key={`r${i + 1}`} value={`RESULTADO_${i + 1}`}>
                            <span className="font-mono text-amber-300">@RESULTADO_{i + 1}</span>
                            <span className="ml-2 text-[10px] text-muted-foreground">Resultado do efeito #{i + 1}</span>
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Dados:</span>
                {[
                  { d: '1d4', cls: 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25' },
                  { d: '1d6', cls: 'bg-orange-500/15 border-orange-500/40 text-orange-300 hover:bg-orange-500/25' },
                  { d: '1d8', cls: 'bg-rose-500/15 border-rose-500/40 text-rose-300 hover:bg-rose-500/25' },
                  { d: '1d10', cls: 'bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-300 hover:bg-fuchsia-500/25' },
                  { d: '1d12', cls: 'bg-violet-500/15 border-violet-500/40 text-violet-300 hover:bg-violet-500/25' },
                  { d: '2d6', cls: 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25' },
                ].map(({ d, cls }) => (
                  <button
                    key={d}
                    type="button"
                    title={`Inserir ${d}`}
                    onClick={() => onChange({
                      formula: (efeito.formula || '') + (efeito.formula && !efeito.formula.endsWith(' ') ? ' + ' : '') + d,
                    })}
                    className={`h-8 w-10 rounded-lg border-2 font-bold text-[11px] font-mono shadow-sm transition-all hover:scale-105 hover:shadow-md ${cls}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// === Modo Simples — Intuitive Builder (frases naturais) ====================
/**
 * Construtor de frases em linguagem natural.
 *
 * Estrutura: opcionalmente [Se: <Sujeito>] [<Operador> <Limite>] [Então: <Ação>]
 * + sempre [Base + Operação + Valor].
 *
 * Tudo via `Select` — zero digitação livre. A cada mudança a fórmula é
 * regenerada automaticamente em `efeito.formula`.
 */
const SUJEITOS_CONDICAO: { id: string; label: string; expr: string; max?: string }[] = [
  { id: 'vida-alvo', label: 'Vida do Alvo', expr: '@ALVO.vida', max: '@ALVO.vida_max' },
  { id: 'vida-usuario', label: 'Vida do Usuário', expr: '@USUARIO.vida', max: '@USUARIO.vida_max' },
  { id: 'energia-alvo', label: 'Energia do Alvo', expr: '@ALVO.energia', max: '@ALVO.energia_max' },
  { id: 'distancia', label: 'Distância (m)', expr: '@CENA.distancia' },
  { id: 'rodada', label: 'Rodada Atual', expr: '@CENA.rodada' },
];

const OPERADORES_CONDICAO: { id: string; label: string; op: string }[] = [
  { id: 'menor', label: 'menor que', op: '<' },
  { id: 'menor-igual', label: 'menor ou igual a', op: '<=' },
  { id: 'maior', label: 'maior que', op: '>' },
  { id: 'maior-igual', label: 'maior ou igual a', op: '>=' },
  { id: 'igual', label: 'igual a', op: '==' },
];

const LIMITES_CONDICAO: { id: string; label: string; build: (sujeito?: typeof SUJEITOS_CONDICAO[number]) => string }[] = [
  { id: '25-pct', label: '25% do máximo', build: (s) => s?.max ? `(${s.max} / 4)` : '25' },
  { id: '50-pct', label: '50% do máximo (metade)', build: (s) => s?.max ? `(${s.max} / 2)` : '50' },
  { id: '75-pct', label: '75% do máximo', build: (s) => s?.max ? `(${s.max} * 0.75)` : '75' },
  { id: '5', label: 'valor fixo: 5', build: () => '5' },
  { id: '10', label: 'valor fixo: 10', build: () => '10' },
  { id: '20', label: 'valor fixo: 20', build: () => '20' },
];

const ACOES_CONDICIONAIS: { id: string; label: string; transform: (base: string) => string }[] = [
  { id: 'normal', label: 'manter o resultado normal', transform: (b) => b },
  { id: 'dobrar', label: 'dobrar o resultado', transform: (b) => `(${b} * 2)` },
  { id: 'triplicar', label: 'triplicar o resultado', transform: (b) => `(${b} * 3)` },
  { id: 'metade', label: 'reduzir o resultado pela metade', transform: (b) => `(${b} / 2)` },
  { id: 'zerar', label: 'anular o resultado (0)', transform: () => '0' },
];

const CTX_OPCOES: { id: string; label: string; expr: string }[] = [
  { id: 'forca-usuario', label: 'Força do Usuário', expr: '@USUARIO.forca' },
  { id: 'destreza-usuario', label: 'Destreza do Usuário', expr: '@USUARIO.destreza' },
  { id: 'inteligencia-usuario', label: 'Inteligência do Usuário', expr: '@USUARIO.inteligencia' },
  { id: 'nivel-usuario', label: 'Nível do Usuário', expr: '@USUARIO.nivel' },
  { id: 'treino-usuario', label: 'Treino do Usuário', expr: '@USUARIO.treino' },
  { id: 'vida-max-usuario', label: 'Vida Máxima do Usuário', expr: '@USUARIO.vida_max' },
  { id: 'metade-vida-alvo', label: 'Metade da Vida do Alvo', expr: '(@ALVO.vida / 2)' },
  { id: 'vida-max-alvo', label: 'Vida Máxima do Alvo', expr: '@ALVO.vida_max' },
  { id: 'd6', label: 'Rolar 1d6', expr: '1d6' },
  { id: '2d6', label: 'Rolar 2d6', expr: '2d6' },
  { id: 'd8', label: 'Rolar 1d8', expr: '1d8' },
  { id: 'fixo', label: 'Valor Fixo (sem contexto)', expr: '' },
];

const ACAO_OPCOES = [
  { id: 'somar', label: '+ Somar valor', op: '+' },
  { id: 'multiplicar', label: '× Multiplicar por', op: '*' },
  { id: 'porcentagem', label: '% da quantidade (decimal)', op: '*' },
  { id: 'nenhuma', label: 'Sem operação extra', op: '' },
] as const;

function SemanticBuilder({
  efeito, onChange,
}: {
  efeito: CombatEffect;
  onChange: (patch: Partial<CombatEffect>) => void;
}) {
  // Linha base
  const [ctx, setCtx] = useState<string>('forca-usuario');
  const [acao, setAcao] = useState<typeof ACAO_OPCOES[number]['id']>('somar');
  const [valor, setValor] = useState<string>('5');
  // Condicional opcional
  const [usarCondicao, setUsarCondicao] = useState<boolean>(false);
  const [sujeitoId, setSujeitoId] = useState<string>('vida-alvo');
  const [operadorId, setOperadorId] = useState<string>('menor');
  const [limiteId, setLimiteId] = useState<string>('50-pct');
  const [acaoCondicaoId, setAcaoCondicaoId] = useState<string>('dobrar');

  const construirFormula = (
    pCtx = ctx, pAcao = acao, pValor = valor,
    pUsarCond = usarCondicao, pSuj = sujeitoId, pOp = operadorId,
    pLim = limiteId, pAcaoCond = acaoCondicaoId,
  ): string => {
    // 1) Base
    const ctxOp = CTX_OPCOES.find((c) => c.id === pCtx)!;
    const acaoOp = ACAO_OPCOES.find((a) => a.id === pAcao)!;
    let base = ctxOp.expr;
    if (pAcao !== 'nenhuma' && pValor.trim()) {
      const v = pAcao === 'porcentagem'
        ? String(Math.max(0, Number(pValor) || 0) / 100)
        : pValor.trim();
      base = base ? `${base} ${acaoOp.op} ${v}` : v;
    }
    if (!base) base = '0';

    // 2) Condicional opcional → if(cond, modificado, base)
    if (!pUsarCond) return base;
    const sujeito = SUJEITOS_CONDICAO.find((s) => s.id === pSuj);
    const operador = OPERADORES_CONDICAO.find((o) => o.id === pOp);
    const limite = LIMITES_CONDICAO.find((l) => l.id === pLim);
    const acaoCond = ACOES_CONDICIONAIS.find((a) => a.id === pAcaoCond);
    if (!sujeito || !operador || !limite || !acaoCond) return base;
    const cond = `${sujeito.expr} ${operador.op} ${limite.build(sujeito)}`;
    const ramoVerdadeiro = acaoCond.transform(`(${base})`);
    return `if(${cond}, ${ramoVerdadeiro}, (${base}))`;
  };

  // Sincroniza fórmula com cada mudança
  const atualizar = (patch: {
    ctx?: string; acao?: typeof acao; valor?: string;
    usarCondicao?: boolean; sujeitoId?: string; operadorId?: string;
    limiteId?: string; acaoCondicaoId?: string;
  }) => {
    if (patch.ctx !== undefined) setCtx(patch.ctx);
    if (patch.acao !== undefined) setAcao(patch.acao);
    if (patch.valor !== undefined) setValor(patch.valor);
    if (patch.usarCondicao !== undefined) setUsarCondicao(patch.usarCondicao);
    if (patch.sujeitoId !== undefined) setSujeitoId(patch.sujeitoId);
    if (patch.operadorId !== undefined) setOperadorId(patch.operadorId);
    if (patch.limiteId !== undefined) setLimiteId(patch.limiteId);
    if (patch.acaoCondicaoId !== undefined) setAcaoCondicaoId(patch.acaoCondicaoId);

    const formula = construirFormula(
      patch.ctx ?? ctx,
      patch.acao ?? acao,
      patch.valor ?? valor,
      patch.usarCondicao ?? usarCondicao,
      patch.sujeitoId ?? sujeitoId,
      patch.operadorId ?? operadorId,
      patch.limiteId ?? limiteId,
      patch.acaoCondicaoId ?? acaoCondicaoId,
    );
    onChange({ formula });
  };

  return (
    <div className="space-y-3 rounded-md border border-border/40 bg-background/40 p-2.5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        Construtor de Frase Natural
      </div>

      {/* Linha BASE: [Base] [Ação] [Valor] ----------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div>
          <Label className="text-[10px] text-sky-400">① Base / Contexto</Label>
          <Select value={ctx} onValueChange={(v) => atualizar({ ctx: v })}>
            <SelectTrigger className="h-8 text-xs border-sky-500/40 bg-sky-500/5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CTX_OPCOES.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] text-primary">② Operação</Label>
          <Select value={acao} onValueChange={(v) => atualizar({ acao: v as typeof acao })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACAO_OPCOES.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px]">③ Valor</Label>
          <Input
            type="number"
            value={valor}
            onChange={(e) => atualizar({ valor: e.target.value })}
            className="h-8 text-xs"
            disabled={acao === 'nenhuma'}
          />
        </div>
      </div>

      {/* Toggle: usar condição? --------------------------------------------- */}
      <div className="flex items-center gap-2 pt-1 border-t border-border/40">
        <button
          type="button"
          onClick={() => atualizar({ usarCondicao: !usarCondicao })}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            usarCondicao ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
              usarCondicao ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
        <Label className="text-[11px] cursor-pointer" onClick={() => atualizar({ usarCondicao: !usarCondicao })}>
          Aplicar uma condição (Se… então…)
        </Label>
      </div>

      {/* Condicional ------------------------------------------------------- */}
      {usarCondicao && (
        <div className="space-y-2 rounded border border-amber-500/30 bg-amber-500/5 p-2">
          <div className="text-[10px] uppercase tracking-wider text-amber-300/90 font-semibold">
            Se a condição for verdadeira…
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px]">Se: Sujeito</Label>
              <Select value={sujeitoId} onValueChange={(v) => atualizar({ sujeitoId: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUJEITOS_CONDICAO.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">For: Operador</Label>
              <Select value={operadorId} onValueChange={(v) => atualizar({ operadorId: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OPERADORES_CONDICAO.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Limite</Label>
              <Select value={limiteId} onValueChange={(v) => atualizar({ limiteId: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LIMITES_CONDICAO.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-[10px]">Ação: então…</Label>
            <Select value={acaoCondicaoId} onValueChange={(v) => atualizar({ acaoCondicaoId: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACOES_CONDICIONAIS.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Pré-visualização da fórmula gerada -------------------------------- */}
      <div className="rounded border border-border/40 bg-card/60 px-2 py-1.5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
          Fórmula gerada
        </div>
        <code className="text-[11px] font-mono text-primary break-all">
          {efeito.formula || '— vazio —'}
        </code>
      </div>
      <p className="text-[10px] text-muted-foreground italic">
        💡 Tudo aqui é construído com cliques. Para encadeamentos com
        <code> @RESULTADO_N </code>ou funções avançadas (<code>floor</code>, <code>ceil</code>),
        use o Modo Avançado.
      </p>
    </div>
  );
}

