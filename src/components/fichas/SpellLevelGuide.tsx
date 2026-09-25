import { useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SpellLevel, ALL_CONDITIONS, CONDITION_CATEGORIES } from '@/types';

interface Props {
  level: SpellLevel;
  onClose: () => void;
}

/* ───────── collapsible section ───────── */
function S({ title, children, open: defaultOpen = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border last:border-0">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 py-2 text-left hover:bg-secondary/30 transition-colors">
        <ChevronDown className={cn('h-3.5 w-3.5 text-primary transition-transform duration-200', open && 'rotate-180')} />
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </button>
      {open && <div className="pb-3 pl-5 pr-2 text-sm text-muted-foreground space-y-2">{children}</div>}
    </div>
  );
}

function T({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto mt-1">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>{headers.map((h, i) => <th key={i} className="text-left px-2 py-1 font-bold text-foreground bg-secondary/50 border border-border">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>{row.map((cell, j) => <td key={j} className="px-2 py-1 border border-border">{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="inline-block rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-semibold text-primary mr-1 mb-1">{children}</span>;
}

/* ═══════════════ DATA ═══════════════ */

const LVL_LABELS: Record<string, string> = {
  '0': 'Nível 0', '1': 'Nível 1', '2': 'Nível 2', '3': 'Nível 3',
  '4': 'Nível 4', '5': 'Nível 5', 'Técnica Máxima': 'Técnica Máxima', 'Técnica Reversa': 'Técnica Reversa',
};

/* PE costs (base, from the book's auxiliary multi-effect examples) */
const PE_COST: Record<string, string> = {
  '0': '0 PE (não consome energia ativa)', '1': '~2 PE', '2': '~5 PE', '3': '~8 PE',
  '4': '~12 PE', '5': '~16 PE', 'Técnica Máxima': '15–30+ PE (ou todo o PE restante)',
  'Técnica Reversa': '1.5×–2× o custo da técnica original',
};

/* ── Damage tables (from the book) ── */
const DMG_SINGLE_TR = [
  ['Nível 0', '1d10', '5'],
  ['Nível 1', '3d8', '14'],
  ['Nível 2', '7d8', '31'],
  ['Nível 3', '12d8', '54'],
  ['Nível 4', '14d10', '77'],
  ['Nível 5', '18d12', '116'],
  ['Técnica Máxima', '26d12', '169'],
];
const DMG_SINGLE_ATK = [
  ['Nível 0', '1d10', '5'],
  ['Nível 1', '4d8', '18'],
  ['Nível 2', '8d8', '36'],
  ['Nível 3', '14d8', '63'],
  ['Nível 4', '16d10', '88'],
  ['Nível 5', '20d12', '129'],
  ['Técnica Máxima', '28d12', '182'],
];
const DMG_AREA_TR = [
  ['Nível 1', '2d8', '9'],
  ['Nível 2', '4d8', '18'],
  ['Nível 3', '5d12', '32'],
  ['Nível 4', '10d10', '55'],
  ['Nível 5', '12d12', '78'],
  ['Técnica Máxima', '22d10', '120'],
];
const RANGE_TABLE = [
  ['Nível 0', '9m'], ['Nível 1', '12m'], ['Nível 2', '18m'], ['Nível 3', '24m'],
  ['Nível 4', '30m'], ['Nível 5', '48m'], ['Técnica Máxima', '60m'],
];
const AREA_TABLE = [
  ['Nível 1', '4,5m'], ['Nível 2', '6m'], ['Nível 3', '9m'],
  ['Nível 4', '12m'], ['Nível 5', '18m'], ['Técnica Máxima', '24m'],
];

/* ── Condition levels ── */
const COND_WEAK = ['Abalado', 'Caído', 'Desorientado', 'Desprevenido', 'Sangramento (variável)'];
const COND_MEDIUM = ['Agarrado', 'Amedrontado', 'Condenado', 'Confuso', 'Enfeitiçado', 'Enjoado', 'Enredado', 'Envenenado', 'Imóvel', 'Lento', 'Sofrendo', 'Surdo', 'Surpreso'];
const COND_STRONG = ['Aterrorizado', 'Cego', 'Engasgando', 'Exposto', 'Fragilizado'];
const COND_EXTREME = ['Atordoado', 'Inconsciente', 'Paralisado', 'Desmembramento'];

const COND_DMG_REDUCTION = [
  ['Fraca', '−1 dado'],
  ['Média', '−3 dados'],
  ['Forte', '−5 dados'],
  ['Extrema', '−8 dados'],
];

const COND_DURATION = [
  ['Nível 1', '1 rd', '—', '—', '—'],
  ['Nível 2', '2 rd', '1 rd', '—', '—'],
  ['Nível 3', '3 rd', '2 rd', '1 rd', '—'],
  ['Nível 4', '4 rd', '3 rd', '2 rd', '1 rd'],
  ['Nível 5', '5 rd', '4 rd', '3 rd', '1 rd'],
  ['Téc. Máxima', 'Cena', '5 rd', '4 rd', '1 rd'],
];

/* ── Bleeding ── */
const BLEEDING = [
  ['Fraco', '2d6'],
  ['Médio', '3d8'],
  ['Forte', '4d10'],
  ['Extremo', '6d10'],
];

/* ── Heal ── */
const HEAL_SINGLE = [
  ['Nível 1', '3d6', '10'], ['Nível 2', '6d6', '21'], ['Nível 3', '7d8', '31'],
  ['Nível 4', '10d10', '55'], ['Nível 5', '16d10', '87'], ['Técnica Máxima', '24d10', '132'],
];
const HEAL_AREA = [
  ['Nível 1', '2d6', '7'], ['Nível 2', '4d6', '14'], ['Nível 3', '4d10', '22'],
  ['Nível 4', '7d10', '38'], ['Nível 5', '12d10', '66'], ['Técnica Máxima', '20d10', '99'],
];

/* ── Auxiliary tables ── */
const AUX_DEFENSE = [
  ['Nível 0', '+1', '—', '—'],
  ['Nível 1', '+2', '+1', '—'],
  ['Nível 2', '+4', '+2', '+1'],
  ['Nível 3', '+6', '+4', '+2'],
  ['Nível 4', '+9', '+6', '+4'],
  ['Nível 5', 'Esquiva Garantida', '+9', '+7'],
  ['Téc. Máxima', '2 Esquivas Garantidas', '+12', '+10'],
];
const AUX_RD = [
  ['Nível 0', '3', '2', '2'],
  ['Nível 1', '5', '4', '4'],
  ['Nível 2', '10', '8', '7'],
  ['Nível 3', '14', '11', '10'],
  ['Nível 4', '18', '14', '12'],
  ['Nível 5', '25', '20', '18'],
  ['Téc. Máxima', '35', '27', '23'],
];
const AUX_ATTRIBUTE = [
  ['Nível 2', '—', '6 pts', '4 pts'],
  ['Nível 3', '—', '8 pts', '6 pts'],
  ['Nível 4', '—', '10 pts', '8 pts'],
  ['Nível 5', '—', '14 pts', '12 pts'],
  ['Téc. Máxima', '—', '18 pts', '16 pts'],
];
const AUX_SAVING = [
  ['Nível 0', '+1', '—', '—'],
  ['Nível 1', '+2', '+1', '—'],
  ['Nível 2', '+4', '+2', '+1'],
  ['Nível 3', '+6', '+4', '+2'],
  ['Nível 4', '+9', '+6', '+4'],
  ['Nível 5', '+12', '+9', '+7'],
  ['Téc. Máxima', 'Sucesso Crítico', '+12', '+10'],
];
const AUX_ROLL = [
  ['Nível 0', '+1', '—', '—'],
  ['Nível 1', '+2', '+1', '—'],
  ['Nível 2', '+4', '+2', '+1'],
  ['Nível 3', '+6', '+4', '+2'],
  ['Nível 4', '+9', '+6', '+4'],
  ['Nível 5', '+12', '+9', '+7'],
  ['Téc. Máxima', 'Garantido', '+12', '+10'],
];
const AUX_MOVE = [
  ['Nível 0', '4,5m', '3m', '3m'],
  ['Nível 1', '6m', '4,5m', '4,5m'],
  ['Nível 2', '9m', '7,5m', '6m'],
  ['Nível 3', '15m', '13,5m', '12m'],
  ['Nível 4', '18m', '16,5m', '15m'],
  ['Nível 5', '21m', '19,5m', '18m'],
  ['Téc. Máxima', '27m', '24m', '21m'],
];
const AUX_DMG_DURING = [
  ['Nível 0', '1d8', '—', '1d6'],
  ['Nível 1', '2d6', '—', '1d10'],
  ['Nível 2', '3d8', '—', '2d8'],
  ['Nível 3', '3d10', '—', '3d8'],
  ['Nível 4', '4d10', '—', '3d10'],
  ['Nível 5', '5d12', '—', '4d12'],
  ['Téc. Máxima', '6d12', '—', '5d12'],
];
const AUX_DMG_AFTER = [
  ['Nível 0', '1d12', '—', '1d8'],
  ['Nível 1', '2d12', '—', '2d6'],
  ['Nível 2', '3d12', '—', '2d12'],
  ['Nível 3', '4d12', '—', '3d12'],
  ['Nível 4', '5d12', '—', '4d12'],
  ['Nível 5', '7d12', '—', '5d12'],
  ['Téc. Máxima', '9d12', '—', '6d12'],
];
const AUX_DMG_FIXED = [
  ['Nível 0', '+6', '—', '+4'],
  ['Nível 1', '+12', '—', '+8'],
  ['Nível 2', '+21', '—', '+15'],
  ['Nível 3', '+28', '—', '+21'],
  ['Nível 4', '+35', '—', '+28'],
  ['Nível 5', '+50', '—', '+35'],
  ['Téc. Máxima', '+62', '—', '+42'],
];
const AUX_DMG_LEVELS = [
  ['Nível 0', '1 Nível', '—', '—'],
  ['Nível 1', '2 Níveis', '—', '1 Nível'],
  ['Nível 2', '4 Níveis', '—', '2 Níveis'],
  ['Nível 3', '6 Níveis', '—', '3 Níveis'],
  ['Nível 4', '8 Níveis', '—', '4 Níveis'],
  ['Nível 5', '12 Níveis', '—', '6 Níveis'],
  ['Téc. Máxima', '16 Níveis', '—', '8 Níveis'],
];
const AUX_CRIT = [
  ['Nível 2', '+1', '—', '—'],
  ['Nível 3', '+2', '—', '+1'],
  ['Nível 4', '+4', '—', '+2'],
  ['Nível 5', '+6', '—', '+3'],
  ['Téc. Máxima', '+8', '—', '+4'],
];
const AUX_RD_NEG = [
  ['Nível 0', '−3', '−2', '−2'],
  ['Nível 1', '−5', '−4', '−4'],
  ['Nível 2', '−10', '−8', '−7'],
  ['Nível 3', '−14', '−11', '−10'],
  ['Nível 4', '−18', '−14', '−12'],
  ['Nível 5', '−25', '−20', '−18'],
  ['Téc. Máxima', '−35', '−27', '−23'],
];
const AUX_CD = [
  ['Nível 0', '+1 CD', '—', '—'],
  ['Nível 1', '+2 CD', '+1 CD', '—'],
  ['Nível 2', '+4 CD', '+2 CD', '+1 CD'],
  ['Nível 3', '+6 CD', '+4 CD', '+2 CD'],
  ['Nível 4', '+8 CD', '+6 CD', '+4 CD'],
  ['Nível 5', '+12 CD', '+9 CD', '+7 CD'],
  ['Téc. Máxima', 'Falha Garantida', '+12 CD', '+10 CD'],
];
const AUX_PENALTY = [
  ['Nível 0', '−1', '—', '—'],
  ['Nível 1', '−2', '−1', '—'],
  ['Nível 2', '−4', '−2', '−1'],
  ['Nível 3', '−6', '−4', '−2'],
  ['Nível 4', '−8', '−6', '−4'],
  ['Nível 5', '−12', '−9', '−7'],
  ['Téc. Máxima', 'Falha Garantida', '−12', '−10'],
];
const AUX_ATK_BONUS = [
  ['Nível 0', '+1', '—', '—'],
  ['Nível 1', '+2', '+1', '—'],
  ['Nível 2', '+4', '+2', '+1'],
  ['Nível 3', '+6', '+4', '+2'],
  ['Nível 4', '+8', '+6', '+4'],
  ['Nível 5', 'Garantido', '+9', '+6'],
  ['Téc. Máxima', '2 Garantidos', '+12', '+10'],
];
const AUX_MELEE_RANGE = [
  ['Nível 0', '+3m', '+1,5m', '—'],
  ['Nível 1', '+6m', '+3m', '+1,5m'],
  ['Nível 2', '+9m', '+4,5m', '+3m'],
  ['Nível 3', '+12m', '+6m', '+4,5m'],
  ['Nível 4', '+18m', '+9m', '+7,5m'],
  ['Nível 5', 'Cena', '+15m', '+12m'],
  ['Téc. Máxima', 'Global', '+19,5m', '+15m'],
];
const AUX_RANGED_RANGE = [
  ['Nível 0', '+6m', '+3m', '+1,5m'],
  ['Nível 1', '+9m', '+6m', '+3m'],
  ['Nível 2', '+12m', '+9m', '+6m'],
  ['Nível 3', '+15m', '+12m', '+9m'],
  ['Nível 4', '+21m', '+16,5m', '+12m'],
  ['Nível 5', 'Cena', '+21m', '+15m'],
  ['Téc. Máxima', 'Global', 'Mapa', '+18m'],
];

/* Which rows to highlight per level */
function filterByLevel(table: string[][], level: string): string[][] {
  const label = LVL_LABELS[level];
  if (!label) return table;
  // For "Técnica Reversa", show all
  if (level === 'Técnica Reversa') return table;
  return table.filter(r => r[0] === label || r[0] === label.replace('Nível', 'Nível') || r[0] === 'Téc. Máxima' && level === 'Técnica Máxima');
}

function getRow(table: string[][], level: string): string[] | undefined {
  const label = LVL_LABELS[level];
  if (!label) return undefined;
  const shortLabel = label === 'Técnica Máxima' ? 'Téc. Máxima' : label;
  return table.find(r => r[0] === label || r[0] === shortLabel);
}

/* ═══════════════ COMPONENT ═══════════════ */

export function SpellLevelGuide({ level, onClose }: Props) {
  const isReversa = level === 'Técnica Reversa';
  const isMaxima = level === 'Técnica Máxima';
  const isNv0 = false; // SpellLevel type doesn't include '0'
  const numLevel = parseInt(level) || 0;

  const allowedCondLevels = numLevel === 0 ? 'Nenhuma' :
    numLevel === 1 ? 'Apenas Fracas' :
    numLevel === 2 ? 'Fracas e Médias' :
    numLevel === 3 ? 'Fracas, Médias e Fortes' :
    numLevel >= 4 ? 'Todas (Fracas, Médias, Fortes e Extremas)' :
    isMaxima ? 'Todas (sem restrição de duração)' : 'Baseado no nível equivalente da técnica original';

  const maxCondCount = isNv0 ? '0' : isMaxima || isReversa ? 'Sem limite prático' : `Até ${numLevel} condição(ões)`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-[95vw] max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border border-primary/30 bg-background shadow-2xl shadow-primary/10" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur px-4 py-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">📖 Guia Completo — {LVL_LABELS[level] ?? level}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Regras oficiais de criação de feitiços baseadas no Livro Básico</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-4 space-y-0">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="rounded-lg border border-pe/20 bg-pe/5 p-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Custo PE</span>
              <p className="text-sm font-bold text-pe">{PE_COST[level] ?? '—'}</p>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Condições Max</span>
              <p className="text-sm font-bold text-primary">{maxCondCount}</p>
            </div>
            <div className="rounded-lg border border-hp/20 bg-hp/5 p-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Níveis Permitidos</span>
              <p className="text-sm font-bold text-hp">{allowedCondLevels}</p>
            </div>
          </div>

          {/* ─── Nível 0 special ─── */}
          {isNv0 && (
            <S title="🌱 Feitiços de Nível 0 — Regras Especiais" open>
              <p>Feitiços de nível 0 <strong className="text-foreground">não consomem PE ativamente</strong>. Representam um gasto tão mínimo que não impacta.</p>
              <p>Normalmente são <strong className="text-foreground">Feitiços Passivos</strong> (bônus ou características únicas) ou <strong className="text-foreground">Feitiços ativos simples</strong> ligados a um funcionamento mais avançado da técnica (ex: criar marcas necessárias para outros feitiços).</p>
              <p><strong className="text-foreground">NÃO podem aplicar condições.</strong></p>
              <p><strong className="text-foreground">NÃO podem curar</strong> (por padrão).</p>
              <p>Dano (caso TR): <Pill>1d10 (Média 5)</Pill> — se o alvo passar no TR, <strong className="text-foreground">anula todo o dano</strong> (diferente de níveis superiores que reduzem à metade).</p>
              <p>Alcance com alvo: <Pill>9 metros</Pill></p>
              <p className="text-xs italic">Exemplo: "Conexão Telepática" — AB, 9m, estabelece conexão telepática com pássaros negros. Apenas uso narrativo.</p>
            </S>
          )}

          {/* ─── Técnica Reversa ─── */}
          {isReversa && (
            <S title="🔄 Técnica Reversa — Regras" open>
              <p>Uma versão <strong className="text-foreground">invertida</strong> de uma técnica existente do personagem que produz efeito oposto ou distorcido.</p>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong className="text-foreground">Deve ser baseada em uma técnica que o personagem JÁ POSSUI.</strong></li>
                <li>Requer justificativa narrativa para a "inversão".</li>
                <li>Custo em PE: <strong className="text-foreground">1.5×–2× a técnica original.</strong></li>
                <li>Tipo de dano frequentemente muda para <Pill>Energia Reversa (DNR)</Pill> ou <Pill>Necrótico (DN)</Pill>.</li>
                <li>Condições seguem as regras do <strong className="text-foreground">nível equivalente da técnica base</strong>, com +1 nível de flexibilidade.</li>
                <li>Efeitos podem ser "invertidos": buff de defesa → debuff no inimigo; cura → dano; etc.</li>
                <li><strong className="text-foreground">Não-Feiticeiro NÃO podem criar Técnicas Reversas.</strong></li>
                <li>Nem toda técnica pode ser revertida (aprovação do narrador).</li>
              </ul>
              <p className="text-xs italic mt-2">Exemplos: "Cura Reversa: Toque Necrótico" — a base curava, agora causa dano Necrótico equivalente. "Escudo Reverso: Fragmentação" — a base era +CA, agora reduz CA do inimigo.</p>
            </S>
          )}

          {/* ─── FEITIÇOS DE DANO ─── */}
          {!isNv0 && (
            <S title="⚔️ Feitiços de Dano — Tabelas Oficiais" open={!isReversa}>
              <p className="font-semibold text-foreground">Dano em Alvo Único — Teste de Resistência</p>
              <p className="text-xs">Se o alvo <strong>passa</strong> no TR: dano <strong>reduzido à metade</strong> (nível 1+). Se <strong>falha</strong>: dano total.</p>
              <T headers={['Nível', 'Dano', 'Média']} rows={DMG_SINGLE_TR} />

              <p className="font-semibold text-foreground mt-3">Dano em Alvo Único — Teste de Ataque</p>
              <p className="text-xs">Acerto: dano total. Erro: nenhum dano.</p>
              <T headers={['Nível', 'Dano', 'Média']} rows={DMG_SINGLE_ATK} />

              <p className="font-semibold text-foreground mt-3">Dano em Alvos Múltiplos/Área — Teste de Resistência</p>
              <p className="text-xs">Sucesso: metade. Falha: dano completo. <strong>Não existe Nível 0 em área.</strong></p>
              <T headers={['Nível', 'Dano', 'Média']} rows={DMG_AREA_TR} />

              <div className="rounded-lg bg-secondary/40 border border-border p-2 mt-2 text-xs space-y-1">
                <p className="font-bold text-foreground">Modificadores de Ação:</p>
                <p>• <strong>Ação Completa:</strong> +nível do Feitiço em dados de dano.</p>
                <p>• <strong>Ação Bônus:</strong> −(1 + nível do Feitiço) em dados de dano.</p>
                <p>• <strong>Reação:</strong> Feitiço de dano <strong>NÃO pode</strong> ser reduzido para reação.</p>
                <p>• Mínimo de <strong>1 dado de dano</strong> obrigatório.</p>
              </div>
            </S>
          )}

          {/* ─── ALCANCE E ÁREA ─── */}
          {!isNv0 && (
            <S title="📏 Alcance e Área">
              <p className="font-semibold text-foreground">Alcance — Feitiços com Alvo</p>
              <T headers={['Nível', 'Alcance']} rows={RANGE_TABLE} />

              <p className="font-semibold text-foreground mt-3">Área Afetada — Feitiços em Área</p>
              <T headers={['Nível', 'Área']} rows={AREA_TABLE} />

              <div className="rounded-lg bg-secondary/40 border border-border p-2 mt-2 text-xs space-y-1">
                <p className="font-bold text-foreground">Tipos de Área:</p>
                <p>• <strong>Cilindro:</strong> Surge na interseção de 4 quadrados, estende pela largura e sobe pela altura.</p>
                <p>• <strong>Cone:</strong> Adjacente a você, alarga com a distância.</p>
                <p>• <strong>Esfera:</strong> Interseção de 4 quadrados, estende em todas as direções.</p>
                <p>• <strong>Linha:</strong> Adjacente a você, reta até o alcance. Largura padrão: 1,5m.</p>
                <p>• <strong>Quadrado/Cubo:</strong> Quadrados escolhidos. Cubo afeta altura.</p>
              </div>

              <div className="rounded-lg bg-secondary/40 border border-border p-2 mt-2 text-xs space-y-1">
                <p className="font-bold text-foreground">Regras de Linha:</p>
                <p>• A área da linha é <strong>1,5× a área base</strong>.</p>
                <p>• Feitiço em linha causa <strong>dados de dano adicionais</strong>: Nv1 = +1d; Nv2–3 = +2d; Nv4–5 = +4d. (Não contam pro limite.)</p>
                <p>• Para aumentar largura: −4,5m de área por cada +1,5m de largura.</p>
              </div>

              <div className="rounded-lg bg-primary/10 border border-primary/20 p-2 mt-2 text-xs space-y-1">
                <p className="font-bold text-foreground">⚖️ Sistema de Proporções (Trocas):</p>
                <p className="text-foreground font-semibold">+1d = +2 de acerto = 6m de alcance = +1 CD</p>
                <p>Você pode reduzir um para aumentar outro. Exemplos:</p>
                <p>• −6m de alcance → +1d de dano (ou vice-versa)</p>
                <p>• −2 de acerto → +1d de dano</p>
                <p>• Para área: reduz −6m alcance E −1,5m área → +1d (linhas: −4,5m área)</p>
                <p>• Para trocar alcance por área: −12m alcance → +1,5m área (e vice-versa)</p>
                <p>• Alcance "Cena" ou superior <strong>não pode ser reduzido</strong> para ganhar efeitos.</p>
              </div>

              <div className="rounded-lg bg-secondary/40 border border-border p-2 mt-2 text-xs space-y-1">
                <p className="font-bold text-foreground">Limites das Proporções:</p>
                <p>• Máx. aumento/redução em dados: <strong>1 + nível do Feitiço</strong>.</p>
                <p>• Máx. bônus/prejuízo no acerto: <strong>dobro do nível do Feitiço</strong>.</p>
                <p>• Máx. aumento/redução na CD: <strong>1 + nível do Feitiço</strong>.</p>
                <p>• O custo de PE <strong>NÃO pode</strong> ser reduzido ou aumentado como parte da criação.</p>
              </div>

              <div className="rounded-lg bg-secondary/40 border border-border p-2 mt-2 text-xs">
                <p className="font-bold text-foreground">Empurrão:</p>
                <p>Para Feitiços de dano que empurram: +6m por dado. Sempre requer TR (mesmo em Feitiço de ataque), metade caso passe.</p>
              </div>
            </S>
          )}

          {/* ─── REQUISITOS ─── */}
          <S title="📋 Requisitos de Feitiços">
            <p>Algumas técnicas possuem requisitos para utilização completa. A dificuldade define PE/dados adicionais para "Múltiplos Efeitos":</p>
            <T headers={['Dificuldade', 'PE Adicionais', 'Dados Adicionais']} rows={[
              ['Fácil', '+2', '+1d'],
              ['Médio', '+4', '+2d'],
              ['Difícil', '+6', '+3d'],
              ['Impossível', '+10', '+5d'],
            ]} />
            <div className="text-xs space-y-1 mt-2">
              <p><strong className="text-foreground">Fácil:</strong> Mecânica simples, depende de coisas que aliados podem fazer.</p>
              <p><strong className="text-foreground">Médio:</strong> Mais complexo, ex: "aliado com menos de 50% de vida" ou "obrigatoriamente debaixo do chão".</p>
              <p><strong className="text-foreground">Difícil:</strong> Preparação necessária, ex: "após aplicar marcas com outra habilidade", "ao derrubar, agarrar e causar sangramento".</p>
              <p><strong className="text-foreground">Impossível:</strong> Super específico/sorte, ex: "durante um eclipse", "após 2 falhas nas portas da morte e voltar à vida máxima".</p>
            </div>
            <p className="text-xs mt-2 italic">Os PEs adicionais servem para "Múltiplos Efeitos" — não aumentam o custo do Feitiço em si.</p>
          </S>

          {/* ─── CONDIÇÕES ─── */}
          {!isNv0 && (
            <S title="⚠️ Aplicando Condições — Regras Completas">
              <p>Condições podem ser adicionadas a um Feitiço de dano (reduzindo dados) ou criando um Feitiço focado em condições (sem dano).</p>

              <p className="font-semibold text-foreground mt-2">Redução de Dados por Condição:</p>
              <T headers={['Nível da Condição', 'Redução']} rows={COND_DMG_REDUCTION} />

              <p className="font-semibold text-foreground mt-2">Máximo de Condições = Nível do Feitiço</p>
              <div className="text-xs space-y-0.5">
                <p>• Nível 0: <strong className="text-hp">NÃO pode aplicar condições</strong></p>
                <p>• Nível 1: Apenas condições <strong>Fracas</strong> (máx. 1)</p>
                <p>• Nível 2: Fracas e <strong>Médias</strong> (máx. 2)</p>
                <p>• Nível 3: Fracas, Médias e <strong>Fortes</strong> (máx. 3)</p>
                <p>• Nível 4–5: <strong>Todas</strong> (máx. 4 ou 5)</p>
                <p>• Técnica Máxima: Todas, sem restrição de duração (Fraca = Cena)</p>
              </div>

              <p className="font-semibold text-foreground mt-2">Duração Padrão das Condições:</p>
              <T headers={['Nível', 'Fraca', 'Média', 'Forte', 'Extrema']} rows={COND_DURATION} />
              <p className="text-xs mt-1">A criatura pode se livrar ao <strong>passar no TR (mesma CD)</strong> no final de cada turno dela após a aplicação.</p>
              <p className="text-xs"><strong>Exceções:</strong> Desmembramento é permanente. Caído exige ação de movimento. Sangramento exige sucesso em TR.</p>

              <p className="font-semibold text-foreground mt-2">Como a condição é aplicada:</p>
              <div className="text-xs space-y-0.5">
                <p>• <strong>Feitiço de TR:</strong> A criatura recebe as condições se <strong>falhar</strong> no teste.</p>
                <p>• <strong>Feitiço de Ataque:</strong> Ao ser acertado, o alvo faz um <strong>TR adicional</strong>; recebe a condição se falhar.</p>
              </div>

              <p className="font-semibold text-foreground mt-3">Feitiço Focado em Condições (Sem Dano):</p>
              <div className="text-xs space-y-0.5">
                <p>• Conta como <strong>1 nível superior</strong> para escolha de condições (pode burlar limitação, mas apenas <strong>1 condição de nível superior</strong> por Feitiço).</p>
                <p>• Duração padrão <strong>+1 rodada</strong> (exceto Extremas).</p>
                <p>• Se a condição é de nível superior ao máximo comum, ela dura <strong>apenas 1 rodada</strong>.</p>
              </div>

              <p className="font-semibold text-foreground mt-3">Classificação das Condições:</p>
              <div className="mt-1 space-y-1.5">
                <div>
                  <span className="text-xs font-bold text-primary">FRACAS (−1d):</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">{COND_WEAK.map(c => <Pill key={c}>{c}</Pill>)}</div>
                </div>
                <div>
                  <span className="text-xs font-bold text-accent-foreground">MÉDIAS (−3d):</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">{COND_MEDIUM.map(c => <Pill key={c}>{c}</Pill>)}</div>
                </div>
                <div>
                  <span className="text-xs font-bold text-destructive">FORTES (−5d):</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">{COND_STRONG.map(c => <Pill key={c}>{c}</Pill>)}</div>
                </div>
                <div>
                  <span className="text-xs font-bold text-hp">EXTREMAS (−8d):</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">{COND_EXTREME.map(c => <Pill key={c}>{c}</Pill>)}</div>
                </div>
              </div>
            </S>
          )}

          {/* ─── SANGRAMENTO ─── */}
          {!isNv0 && (
            <S title="🩸 Sangramento — Referência Especial">
              <p>Sangramento é uma condição variável (fraco a extremo). Define a perda de vida:</p>
              <T headers={['Nível', 'Perda de Vida']} rows={BLEEDING} />
              <div className="text-xs space-y-0.5 mt-1">
                <p>• Ignora a tabela de duração normal. Encerra quando a criatura <strong>passar no TR</strong>.</p>
                <p>• Sangramento Extremo: precisa de <strong>sucesso crítico</strong> no TR para se livrar.</p>
                <p>• Pode-se criar condições próprias que causam danos constantes seguindo o mesmo padrão (trocando perda de vida por tipo de dano, ex: Queimante).</p>
              </div>
            </S>
          )}

          {/* ─── TIPOS ESPECIAIS DE DANO ─── */}
          {!isNv0 && (
            <S title="💥 Tipos Especiais de Feitiços de Dano">
              <p className="text-xs italic mb-2">Feitiços de Dano Especiais NÃO podem ser combinados entre si.</p>

              <p className="font-semibold text-foreground">🔴 Feitiços Destrutivos (Nível 4+, apenas área)</p>
              <div className="text-xs space-y-0.5 ml-2">
                <p>• Sempre <strong>Ação Completa</strong> (com bônus de AC).</p>
                <p>• Demora <strong>2 rodadas</strong> para afetar a área demarcada.</p>
                <p>• Recebe <strong>+nível em dados de dano</strong> e <strong>1.5× a área</strong>.</p>
                <p>• Vantagem/Desvantagem no Acerto/TR.</p>
                <p>• Área se torna <strong>Terreno Difícil</strong> após aplicação.</p>
                <p>• Não pode receber "Feitiço Cuidadoso" ou "Feitiço Rápido".</p>
                <p>• Pode reduzir 2→1 rodada removendo nível em dados OU um efeito (Vantagem ou área aumentada).</p>
                <p>• Se instantâneo: <strong>corte o alcance pela metade</strong>.</p>
                <p className="mt-1 font-semibold text-foreground">Efeitos Destrutivos Adicionais:</p>
                <p>• <strong>Ignora Resistências:</strong> Ignora RD e resistências. Custo: <strong>−4 dados</strong>.</p>
                <p>• <strong>Morte Direta:</strong> 0 HP = morte imediata. <strong>Apenas Nv5+ / Técnica Máxima.</strong> Custo: <strong>−2 dados</strong>.</p>
              </div>

              <p className="font-semibold text-foreground mt-3">☢️ Feitiços Cataclísmicos (Nível 5+, apenas área)</p>
              <div className="text-xs space-y-0.5 ml-2">
                <p>• Sempre Ação Completa. Causa <strong>⅓ (33%) do dano como perda de vida em você</strong>.</p>
                <p>• Recebe <strong>1.5× nível em dados de dano</strong>.</p>
                <p>• Acerta o <strong>mapa inteiro</strong>. Raio de 45m vira Terreno Difícil.</p>
                <p>• <strong>Ignora Resistências e RD.</strong></p>
                <p>• <strong>NÃO podem ser modificados de nenhuma forma.</strong></p>
                <p>• Pode matar aliados e destruir completamente o terreno.</p>
              </div>

              <p className="font-semibold text-foreground mt-3">🔥 Feitiços de Dano Contínuo (Nível 1+)</p>
              <div className="text-xs space-y-0.5 ml-2">
                <p>• Escolha: <strong>Sustentado</strong> (custo = nível/rodada) ou <strong>Concentrado</strong> (dura até concentração cessar).</p>
                <p>• Reduz <strong>nível do Feitiço em dados</strong> do golpe principal.</p>
                <p>• Dano contínuo = <strong>metade dos dados originais</strong>.</p>
                <p>• Exemplo Nv2 (TR): 5d8 golpe + 2d8/rodada se falhar no teste.</p>
                <p>• Em área: não precisa falhar no TR; a área fica nociva (dano no início do turno).</p>
                <p>• Dano contínuo <strong>não se acumula</strong>; mantém-se o maior.</p>
                <p>• Pode causar condições, mas condições NÃO são reaplicadas pelo dano contínuo.</p>
              </div>

              <p className="font-semibold text-foreground mt-3">🧛 Feitiços Vampíricos</p>
              <div className="text-xs space-y-0.5 ml-2">
                <p>• <strong>NÃO podem usar Ação Bônus.</strong></p>
                <p>• Dano reduzido em <strong>nível do Feitiço</strong>.</p>
                <p>• Cura = <strong>⅓ do dano causado</strong> (após RD/Resistências/Imunidades).</p>
                <p>• Sem Energia Reversa: recebe <strong>⅓ como vida temporária acumulável</strong>.</p>
                <p>• Criaturas robóticas: vida não pode ser roubada.</p>
                <p>• <strong>1 vez por rodada</strong>, sem repetição.</p>
              </div>

              <p className="font-semibold text-foreground mt-3">🎯 Feitiços de Múltiplos Disparos</p>
              <div className="text-xs space-y-0.5 ml-2">
                <p>• Sempre <strong>Teste de Ataque</strong>. Nunca em área.</p>
                <p>• Divide dados (arredondado para baixo) até <strong>máx. nível + 1</strong> alvos.</p>
                <p>• Mínimo de 1 dado por disparo.</p>
                <p>• Pode concentrar múltiplos disparos no mesmo alvo → <strong>dano concentrado, 1 rolagem de ataque</strong>.</p>
                <p>• Exemplo Nv2: 3 rajadas de 2d8 ou 2 rajadas de 4d8 ou 1 alvo com 8d8.</p>
                <p>• Cada disparo aplica efeitos como Conjuração Aprimorada, mas disparos concentrados aplicam apenas <strong>1 vez</strong>.</p>
                <p>• Contam como <strong>Feitiços em área</strong> para todos os efeitos.</p>
              </div>
            </S>
          )}

          {/* ─── FEITIÇOS AUXILIARES ─── */}
          {!isNv0 && (
            <S title="🔮 Feitiços Auxiliares — Tabelas Completas">
              <p>Feitiços auxiliares concedem benefícios. Três tipos de duração:</p>
              <div className="text-xs space-y-0.5 mb-2">
                <p>• <strong className="text-foreground">Imediata:</strong> Dura 1 ataque ou 1 rodada. Valor superior.</p>
                <p>• <strong className="text-foreground">Duradoura:</strong> Quantidade específica de rodadas (máx. 1 + nível). Valor = bônus ÷ (nº rodadas − ⌈nível/2⌉).</p>
                <p>• <strong className="text-foreground">Sustentada:</strong> Dura cena toda, mas custa PE por rodada (Nv0–2: 1PE; Nv3–5: 2PE). Máx. 1 sustentada ativa.</p>
              </div>
              <div className="text-xs rounded bg-secondary/40 border border-border p-2 mb-2 space-y-0.5">
                <p><strong className="text-foreground">Múltiplos alvos:</strong> Divida o bônus entre alvos. Concentração adiciona ½ nível alvos extras.</p>
                <p><strong className="text-foreground">Alcance "própria":</strong> Apenas em si mesmo, mas recebe nível em PE para "Múltiplos Efeitos".</p>
                <p><strong className="text-foreground">Concentração + Auxiliar:</strong> Pode adicionar 1 efeito auxiliar adicional do mesmo nível.</p>
                <p><strong className="text-foreground">Ação Completa (sem outros aumentos):</strong> Ao invés de bônus, recebe PE = 2× nível para "Múltiplos Efeitos".</p>
              </div>

              <p className="font-semibold text-foreground">Aumento de Defesa</p>
              <p className="text-xs">Usa ação comum. Imediata dura 1 rodada. Reação: ×1.5 mas só 1 golpe. AB: reduz em nível. Esquiva Garantida sempre é reação.</p>
              <T headers={['Nível', 'Imediata', 'Duradoura', 'Sustentada']} rows={AUX_DEFENSE} />

              <p className="font-semibold text-foreground mt-3">Redução de Dano (RD)</p>
              <p className="text-xs">Ação comum. Contra 1 tipo de dano (exceto Alma/En.Reversa). Cada tipo extra: −2 RD. AB: −nível. Reação: ×1.3 mas 1 golpe.</p>
              <T headers={['Nível', 'Imediata', 'Duradoura', 'Sustentada']} rows={AUX_RD} />

              <p className="font-semibold text-foreground mt-3">Aumento de Atributo (Nível 2+)</p>
              <p className="text-xs">AB. Pontos divididos entre atributos. Máx. por atributo = nível. Máx. absoluto: 30. Não afeta HP/DEF base.</p>
              <T headers={['Nível', 'Imediata', 'Duradoura', 'Sustentada']} rows={AUX_ATTRIBUTE} />

              <p className="font-semibold text-foreground mt-3">Bônus em TR</p>
              <p className="text-xs">Para 1 tipo de TR. Duradoura/Sustentada: AB. Imediata: Reação. AC: +nível−1. Pode dividir entre 2 TRs.</p>
              <T headers={['Nível', 'Imediata', 'Duradoura', 'Sustentada']} rows={AUX_SAVING} />

              <p className="font-semibold text-foreground mt-3">Bônus em Rolagem de Perícia</p>
              <p className="text-xs">AB. Cada ação acima de AB: +nível−1 (mín. 1). Imediata: próximo teste apenas.</p>
              <T headers={['Nível', 'Imediata', 'Duradoura', 'Sustentada']} rows={AUX_ROLL} />

              <p className="font-semibold text-foreground mt-3">Aumento de Movimento</p>
              <p className="text-xs">AB. Qualquer tipo de movimento exceto Teleporte. Imediata dura 1 rodada.</p>
              <T headers={['Nível', 'Imediata', 'Duradoura', 'Sustentada']} rows={AUX_MOVE} />

              <p className="font-semibold text-foreground mt-3">Dano Adicional — Durante Ataque</p>
              <p className="text-xs">AB. Multiplicado por crítico. Imediata: 1 rodada (ou 1 ataque com dados dobrados). AC: +nível÷2 dados. Não combina com Após/Fixo/Níveis.</p>
              <T headers={['Nível', 'Imediata', 'Duradoura', 'Sustentada']} rows={AUX_DMG_DURING} />

              <p className="font-semibold text-foreground mt-3">Dano Adicional — Após Ataque</p>
              <p className="text-xs">AB. NÃO multiplicado por crítico (instância separada, mas conta no total). Mesmas regras de duração.</p>
              <T headers={['Nível', 'Imediata', 'Duradoura', 'Sustentada']} rows={AUX_DMG_AFTER} />

              <p className="font-semibold text-foreground mt-3">Dano Adicional — Fixo</p>
              <p className="text-xs">AB. Imediata: 1 rodada (1 ataque = dobrado). AC: +nível×2. Não combina com Durante/Após/Níveis.</p>
              <T headers={['Nível', 'Imediata', 'Duradoura', 'Sustentada']} rows={AUX_DMG_FIXED} />

              <p className="font-semibold text-foreground mt-3">Níveis de Dano Adicionais</p>
              <p className="text-xs">AB. Imediata: 1 rodada (1 ataque = ×1.5 níveis). AC: +nível. Não combina com Durante/Após/Fixo.</p>
              <T headers={['Nível', 'Imediata', 'Duradoura', 'Sustentada']} rows={AUX_DMG_LEVELS} />

              <p className="font-semibold text-foreground mt-3">Margem de Crítico (Nível 2+)</p>
              <p className="text-xs">AB. Imediata: 1 rodada (1 ataque = dobrado; Nv5 = garantido; TM = 3 golpes críticos). Não pode virar AC, mas pode virar Completa.</p>
              <T headers={['Nível', 'Imediata', 'Duradoura', 'Sustentada']} rows={AUX_CRIT} />

              <p className="font-semibold text-foreground mt-3">Negação de RD</p>
              <p className="text-xs">AC. Ataques ignoram a RD especificada. AB: −nível. Cada tipo extra: −4. Alvo faz TR; sucesso = metade. Imediata: 1 rodada.</p>
              <T headers={['Nível', 'Imediata', 'Duradoura', 'Sustentada']} rows={AUX_RD_NEG} />

              <p className="font-semibold text-foreground mt-3">Aumento de CD</p>
              <p className="text-xs">AB. Imediata: próxima técnica de TR apenas. AC: +nível−1.</p>
              <T headers={['Nível', 'Imediata', 'Duradoura', 'Sustentada']} rows={AUX_CD} />

              <p className="font-semibold text-foreground mt-3">Prejuízo em Rolagem</p>
              <p className="text-xs">AC. Alvo faz TR; sucesso = metade. "Falha Garantida" = sem TR. Imediata: próxima rolagem.</p>
              <T headers={['Nível', 'Imediata', 'Duradoura', 'Sustentada']} rows={AUX_PENALTY} />

              <p className="font-semibold text-foreground mt-3">Bônus em Teste de Ataque</p>
              <p className="text-xs">AB. Imediata: próximo ataque. "Garantido" = acerto certo (não é crítico, ainda rola). Duradoura/Sustentada: AC → +2 por ação acima.</p>
              <T headers={['Nível', 'Imediata', 'Duradoura', 'Sustentada']} rows={AUX_ATK_BONUS} />

              <p className="font-semibold text-foreground mt-3">Bônus Alcance Corpo a Corpo</p>
              <p className="text-xs">AB. Imediata: próximo golpe. "Cena" = mapa inteiro (com linha de visão). "Global" = mundo (precisa justificativa). Golpeadores: metade.</p>
              <T headers={['Nível', 'Imediata', 'Duradoura', 'Sustentada']} rows={AUX_MELEE_RANGE} />

              <p className="font-semibold text-foreground mt-3">Bônus Alcance a Distância</p>
              <p className="text-xs">AB. Mesmas regras. Técnicas de Dano Especiais NÃO recebem este aumento.</p>
              <T headers={['Nível', 'Imediata', 'Duradoura', 'Sustentada']} rows={AUX_RANGED_RANGE} />
            </S>
          )}

          {/* ─── AUXILIARES ENFRAQUECEDORES ─── */}
          {!isNv0 && (
            <S title="⚖️ Feitiços Enfraquecedores e Múltiplos Efeitos">
              <p className="font-semibold text-foreground">Feitiços Enfraquecedores</p>
              <p>Auxiliares podem enfraquecer o usuário para melhorar efeitos. Máx. redução = bônus original.</p>
              <div className="text-xs space-y-0.5 mt-1">
                <p>• <strong>Perícia por Perícia:</strong> −2 em uma perícia = +1 em outra (mesmo atributo ou semelhança narrativa). Ex: −4 Atletismo → +2 Acrobacia extra.</p>
                <p>• <strong>Defesa ↔ RD:</strong> −2 DEF → +1 RD (ou −2 RD → +1 DEF). Máx: 2× nível. Precisa ter DEF/RD suficiente (DEF não pode cair abaixo de 10+mod destreza).</p>
                <p>• <strong>Acerto ↔ Margem:</strong> −3 acerto → +1 margem (e vice-versa). Máx redução acerto: nível × 3. Pode ser combinado com Feitiço de margem, mas NÃO com Feitiço de acerto.</p>
              </div>

              <p className="font-semibold text-foreground mt-3">Feitiços com Múltiplos Efeitos</p>
              <p>Combine benefícios cujos níveis somem ao custo total em PE. Ex: Nv3 (8PE) = efeito Nv2 (5PE) + efeito Nv1 (~3PE).</p>
              <p className="text-xs mt-1">Efeito Nv0 conta como 1 PE para evitar efeitos infinitos.</p>
            </S>
          )}

          {/* ─── CURA ─── */}
          {!isNv0 && (
            <S title="💚 Feitiços Curativos">
              <p>Requerem <strong className="text-foreground">Energia Reversa</strong>. Suportes recebem no Nv6; outras specs no Nv8. Sem Energia Reversa: substitua cura por <strong className="text-foreground">vida temporária</strong>.</p>
              <p className="text-xs">Nível 0 <strong>NÃO pode curar</strong>. Segue mesma proporção de trocas (alcance por dados, etc.).</p>

              <p className="font-semibold text-foreground mt-2">Cura em Alvo Único</p>
              <T headers={['Nível', 'Cura', 'Média']} rows={HEAL_SINGLE} />

              <p className="font-semibold text-foreground mt-2">Cura em Múltiplos/Área</p>
              <T headers={['Nível', 'Cura', 'Média']} rows={HEAL_AREA} />

              <p className="font-semibold text-foreground mt-2">Curando Condições</p>
              <div className="text-xs space-y-0.5">
                <p>• Segue a mesma lógica de aplicar condições em dano: <strong>reduz dados de cura</strong> baseado no nível da condição removida.</p>
                <p>• Feitiço que cura <strong>todas as condições</strong>: mínimo Nível 5, com 13d de cura removidos.</p>
                <p>• Este efeito cura apenas 1 Ferimento Complexo; pode ser feito só para Ferimentos Persistentes (custo reduzido).</p>
              </div>
            </S>
          )}

          {/* ─── REFERÊNCIA DE CONDIÇÕES ─── */}
          <S title="📚 Referência Completa de Condições">
            <div className="space-y-2">
              {CONDITION_CATEGORIES.map(cat => {
                const catConds = ALL_CONDITIONS.filter(c => c.category === cat);
                if (!catConds.length) return null;
                return (
                  <div key={cat}>
                    <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-1">{cat}</h4>
                    <div className="space-y-0.5">
                      {catConds.map(cond => (
                        <div key={cond.id} className="rounded bg-secondary/30 px-2 py-1 text-xs">
                          <span className="font-semibold text-foreground">{cond.icon} {cond.name}</span>
                          <span className="text-muted-foreground ml-1">— {cond.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </S>
        </div>
      </div>
    </div>
  );
}
