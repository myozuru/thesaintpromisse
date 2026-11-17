import { useState } from 'react';
import { cn } from '@/lib/utils';
import { SpellLevelGuide } from '@/components/fichas/SpellLevelGuide';
import type { SpellLevel } from '@/types';
import { SPELL_LEVELS } from '@/types';
import { Activity, BookOpen, ChevronLeft, ChevronRight, Flame, Heart, Shield, SlidersHorizontal, Swords, Target, Users, Wand2 } from 'lucide-react';
import { ModuleHeader } from '@/components/ui/module-header';

type GuiaTopic =
  | 'feiticos'
  | 'combate'
  | 'atributos'
  | 'trs'
  | 'condicoes'
  | 'recursos'
  | 'pvp'
  | 'dano'
  | 'alvos';

const TOPICS: { id: GuiaTopic; label: string; icon: typeof BookOpen }[] = [
  { id: 'feiticos', label: 'Sobre Feitiços', icon: Wand2 },
  { id: 'combate', label: 'Combate', icon: Swords },
  { id: 'atributos', label: 'Atributos & Perícias', icon: SlidersHorizontal },
  { id: 'trs', label: 'Testes de Resistência', icon: Shield },
  { id: 'condicoes', label: 'Condições', icon: Activity },
  { id: 'recursos', label: 'PV / PE / ESC', icon: Heart },
  { id: 'pvp', label: 'PvP', icon: Users },
  { id: 'dano', label: 'Tipos de Dano', icon: Flame },
  { id: 'alvos', label: 'Sistema de Alvos', icon: Target },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-2">
      <h3 className="text-sm font-bold text-primary uppercase tracking-wider">{title}</h3>
      <div className="text-sm text-muted-foreground space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <span className="text-foreground font-medium sm:min-w-[140px] sm:flex-shrink-0">{label}</span>
      <span className="break-words sm:flex-1 sm:text-right">{value}</span>
    </div>
  );
}

function Pill({ children, color = 'primary' }: { children: React.ReactNode; color?: string }) {
  const colorMap: Record<string, string> = {
    primary: 'bg-primary/20 text-primary border-primary/30',
    red: 'bg-hp/20 text-hp border-hp/30',
    green: 'bg-neon-green/20 text-neon-green border-neon-green/30',
    yellow: 'bg-neon-yellow/20 text-neon-yellow border-neon-yellow/30',
    pe: 'bg-pe/20 text-pe border-pe/30',
    shield: 'bg-shield/20 text-shield border-shield/30',
  };
  return (
    <span className={cn('rounded-full border px-2 py-0.5 text-xs font-bold', colorMap[color] ?? colorMap.primary)}>
      {children}
    </span>
  );
}

// ─── Feitiços ─────────────────────────────────────────────────
function TopicFeiticos() {
  const [guideLevel, setGuideLevel] = useState<SpellLevel | null>(null);

  return (
    <div className="space-y-4">
      {guideLevel && <SpellLevelGuide level={guideLevel} onClose={() => setGuideLevel(null)} />}

      <Section title="Pool de Trocas (Unidades de Câmbio)">
        <p>Cada feitiço recebe um saldo de pontos de câmbio baseado no nível e tipo de alvo. 1 unidade equivale a:</p>
        <ul className="list-disc list-inside space-y-1 mt-1">
          <li>+1 Dado de Dano</li>
          <li>+2 Bônus de Acerto</li>
          <li>+6m de Alcance (individual) <em>ou</em> +1,5m de Raio + Alcance (área)</li>
          <li>+4,5m de Comprimento (linha)</li>
          <li>+1 CD</li>
        </ul>
        <p className="mt-2 text-sm text-amber-400">⚠ O saldo mínimo após qualquer troca é 1 (não pode zerar tudo). Feitiços de dano têm budget de condições = base-1.</p>
      </Section>

      <Section title="Durações">
        <Row label="Imediata" value="1 rodada / 1 ataque. Pode ser usada como Reação." />
        <Row label="Duradoura" value="1 + Nível rodadas (travada)." />
        <Row label="Sustentada" value="Toda a cena. Custa 1 PE/rodada (Nv 1-2) ou 2 PE/rodada (Nv 3+). Apenas 1 ativo por vez." />
      </Section>

      <Section title="Requisito de Dificuldade">
        <Row label="Nenhum" value="Qualquer personagem pode usar." />
        <Row label="Treinado" value="Requer treinamento na perícia relevante." />
        <Row label="Maestria" value="Requer maestria na perícia relevante." />
        <Row label="Especialização" value="Requer especialização na área." />
      </Section>

      <Section title="Condições em Feitiços">
        <p>Feitiços de condição (Foco) têm um orçamento de dados igual ao nível do feitiço. Cada condição consome dados conforme raridade.</p>
        <p className="mt-1 text-sm">Feitiços de dano também podem adicionar condições usando o budget = dados base - 1.</p>
      </Section>

      <Section title="Guia por Nível">
        <div className="flex flex-wrap gap-2 mt-1">
          {SPELL_LEVELS.map(lv => (
            <button
              key={lv}
              onClick={() => setGuideLevel(lv)}
              className="rounded-lg bg-primary/20 border border-primary/30 px-3 py-1 text-xs text-primary font-bold hover:bg-primary/30 transition-colors"
            >
              Nv. {lv}
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ─── Combate ──────────────────────────────────────────────────
function TopicCombate() {
  return (
    <div className="space-y-4">
      <Section title="Ações por Turno">
        <Row label="Ação Comum (AC)" value="Atacar, lançar feitiço, usar item." />
        <Row label="Ação Bônus (AB)" value="Habilidades específicas ou feitiços rápidos." />
        <Row label="Reação (RÇ)" value="Resposta a evento externo." />
        <Row label="Ação Completa" value="Consome AC + AB. Necessário para certos feitiços poderosos." />
        <Row label="Oportunidade (AO)" value="Ataque ao inimigo que sai de alcance sem Recuar." />
      </Section>

      <Section title="Acerto e Acerto Crítico">
        <Row label="Rolagem" value="d20 + Bônus de Ataque vs CA do alvo." />
        <Row label="Acerto Crítico (Nat 20)" value="Dano crítico: dobragem de dados ou efeito especial." />
        <Row label="Falha Crítica (Nat 1)" value="Independente de modificadores." />
      </Section>

      <Section title="Iniciativa">
        <p>Rolagem de d20 + bônus de iniciativa. Define a ordem de atuação no turno.</p>
      </Section>

      <Section title="Flanquear e Vantagem">
        <p>Duas ou mais criaturas aliadas adjacentes ao mesmo inimigo: +2 no acerto.</p>
      </Section>
    </div>
  );
}

// ─── Atributos & Perícias ──────────────────────────────────────
function TopicAtributos() {
  return (
    <div className="space-y-4">
      <Section title="Atributos">
        <Row label="FOR (Força)" value="Corpo a corpo, carga, Atletismo." />
        <Row label="DES (Destreza)" value="Iniciativa, Acrobacia, Furtividade." />
        <Row label="CON (Constituição)" value="Resistência física, HP." />
        <Row label="INT (Inteligência)" value="Feitiçaria, Investigação, Tecnologia." />
        <Row label="SAB (Sabedoria)" value="Percepção, Medicina, Sobrevivência." />
        <Row label="CAR (Presença)" value="Persuasão, Intimidação, Enganação." />
        <p className="text-sm mt-2">Modificador = (Valor - 10) ÷ 2 (arredondado para baixo).</p>
      </Section>

      <Section title="Treinamento e Maestria">
        <Row label="Treinado (T)" value={<>Adiciona <Pill>+⌊nível/3⌋</Pill> à perícia.</>} />
        <Row label="Maestria (M)" value={<>Adiciona <Pill>+⌊nível/2⌋</Pill> à perícia.</>} />
        <Row label="Maestria em Feitiços" value={<><Pill>+2 + ⌊nível/5⌋</Pill> ao acerto e CD.</>} />
        <p className="text-sm mt-1 text-amber-400">⚠ Treinamento e Maestria não se acumulam — escolha um por perícia.</p>
      </Section>
    </div>
  );
}

// ─── TRs ──────────────────────────────────────────────────────
function TopicTRs() {
  return (
    <div className="space-y-4">
      <Section title="Testes de Resistência (TR)">
        <p>Usados para resistir efeitos: rolagem de d20 + bônus do TR vs CD do feitiço.</p>
        <Row label="Bônus Padrão" value="⌊nível/2⌋ (atribuído automaticamente ao criar personagem)." />
        <Row label="CD do Feitiço" value="CD Base + Bônus de CD do feitiço." />
      </Section>

      <Section title="Resultados">
        <Row label={<span className="text-neon-green">✨ Sucesso Crítico (Nat 20)</span>} value="Sem dano e sem condições." />
        <Row label={<span className="text-neon-green">✅ Sucesso (≥ CD)</span>} value="Metade do dano, sem condições." />
        <Row label={<span className="text-hp">{"❌ Falha (< CD)"}</span>} value="Dano total + condições aplicadas." />
        <Row label={<span className="text-hp">💀 Falha Crítica (Nat 1)</span>} value="Dano ×2 + condições + 1 rodada extra." />
      </Section>

      <Section title="Nota sobre Buffs">
        <p>Feitiços de Buff não exigem TR — são aplicados diretamente ao alvo selecionado.</p>
      </Section>
    </div>
  );
}

// ─── Condições ────────────────────────────────────────────────
function TopicCondicoes() {
  return (
    <div className="space-y-4">
      <Section title="Como Funcionam">
        <p>Condições são estados negativos (ou positivos) aplicados a personagens. Cada uma tem duração em Turnos (de combate completos) ou Rodadas (ações individuais).</p>
        <Row label="Duração ∞" value="Permanente até ser removida manualmente." />
      </Section>
      <Section title="Exemplos Comuns">
        <Row label="⛓ Condenado" value="Custos de PE +1 por feitiço." />
        <Row label="🩹 Sangrando" value="Perde HP a cada rodada." />
        <Row label="😵 Atordoado" value="Não pode agir." />
        <Row label="🔇 Silenciado" value="Não pode lançar feitiços com componente verbal." />
        <Row label="🌀 Lento" value="Movimento e ações reduzidos." />
        <Row label="⚡ Acelerado" value="Ação ou movimento extra por turno." />
      </Section>
    </div>
  );
}

// ─── Recursos ─────────────────────────────────────────────────
function TopicRecursos() {
  return (
    <div className="space-y-4">
      <Section title="Pontos de Vida (PV / HP)">
        <p>Representam a saúde do personagem. Quando chega a 0, o personagem fica inconsciente ou morre.</p>
        <Row label="Cura" value="Restaura HP até o máximo. Alguns personagens curam apenas metade." />
      </Section>
      <Section title="Pontos de Energia (PE)">
        <p>Necessários para lançar feitiços. Cada feitiço tem custo em PE. Feitiços sustentados consomem PE por rodada.</p>
        <Row label="Nv 1-2 Sustentado" value="1 PE/rodada." />
        <Row label="Nv 3+ Sustentado" value="2 PE/rodada." />
      </Section>
      <Section title="Escudo (ESC)">
        <p>Absorve dano antes do HP. Quando o escudo chega a 0, o dano restante vai para o HP.</p>
      </Section>
    </div>
  );
}

// ─── PvP ──────────────────────────────────────────────────────
function TopicPvP() {
  return (
    <div className="space-y-4">
      <Section title="Combate entre Jogadores (PvP)">
        <p>Quando um PLAYER causa dano a outro PLAYER:</p>
        <Row label="Redução" value={<><Pill color="red">-66%</Pill> do dano total.</>} />
        <p className="text-sm mt-1">Isso é aplicado automaticamente pelo sistema tanto no ataque direto quanto ao aplicar feitiços de dano.</p>
      </Section>
    </div>
  );
}

// ─── Tipos de Dano ────────────────────────────────────────────
function TopicDano() {
  const tipos = [
    { abbr: 'FIS', nome: 'Físico', desc: 'Corte, perfuração, impacto.' },
    { abbr: 'FOG', nome: 'Fogo', desc: 'Queimaduras, calor.' },
    { abbr: 'GEL', nome: 'Gelo', desc: 'Congelamento, frio.' },
    { abbr: 'ELT', nome: 'Elétrico', desc: 'Raios, eletricidade.' },
    { abbr: 'VEN', nome: 'Veneno', desc: 'Toxinas, ácidos.' },
    { abbr: 'PSI', nome: 'Psíquico', desc: 'Dano mental.' },
    { abbr: 'RDT', nome: 'Radiante', desc: 'Energia sagrada/solar.' },
    { abbr: 'TRV', nome: 'Trevas', desc: 'Energia sombria.' },
    { abbr: 'TRN', nome: 'Trovão', desc: 'Ondas de som e impacto.' },
    { abbr: 'FRC', nome: 'Força', desc: 'Energia pura, gravitacional.' },
    { abbr: 'CID', nome: 'Ácido', desc: 'Corrosão química.' },
    { abbr: 'MAL', nome: 'Maldição', desc: 'Energia maldita.' },
  ];

  return (
    <div className="space-y-4">
      <Section title="Tipos de Dano">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 mt-1">
          {tipos.map(t => (
            <div
              key={t.abbr}
              className="flex items-start gap-3 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2.5 transition-all duration-300 hover:border-primary/30 hover:bg-secondary/50 hover:shadow-sm hover:shadow-primary/5"
            >
              <span className="mt-0.5 flex-shrink-0 font-mono text-xs font-bold text-primary w-10 text-center" style={{ letterSpacing: '0.04em' }}>{t.abbr}</span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">{t.nome}</div>
                <div className="text-sm text-muted-foreground" style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Redução de Dano (RD)">
        <p>RD reduz o dano recebido. Se um tipo específico de RD for definido (ex: RD Fogo), apenas aquele tipo é reduzido. A RD geral se aplica a todos os tipos sem RD específica.</p>
        <Row label="Imunidade" value="Personagem não recebe dano daquele tipo." />
        <Row label="Vulnerabilidade" value="Dano daquele tipo é multiplicado por 1.5." />
      </Section>
    </div>
  );
}

// ─── Sistema de Alvos ─────────────────────────────────────────
function TopicAlvos() {
  return (
    <div className="space-y-4">
      <Section title="Modos de Alvo">
        <Row label="Ataque Individual" value="Rola acerto vs CA. Pode ter vantagem/desvantagem." />
        <Row label="TR Individual" value="Alvo faz teste de resistência vs CD do feitiço." />
        <Row label="Área (TR)" value="Todos na área fazem TR. Dano/condições por resultado." />
        <Row label="Linha (TR)" value="Linha reta; todos dentro fazem TR." />
      </Section>
      <Section title="Seleção de Alvos">
        <p>Ao usar um feitiço na ficha, o diálogo de aplicação permite selecionar múltiplos alvos e registrar os resultados de TR individualmente por alvo.</p>
        <p className="text-sm mt-1 text-amber-400">⚠ Buff direto não exige TR — é aplicado imediatamente ao alvo selecionado.</p>
      </Section>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────
export function GuiaModule() {
  const [activeTopic, setActiveTopic] = useState<GuiaTopic>('feiticos');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const renderContent = () => {
    switch (activeTopic) {
      case 'feiticos': return <TopicFeiticos />;
      case 'combate': return <TopicCombate />;
      case 'atributos': return <TopicAtributos />;
      case 'trs': return <TopicTRs />;
      case 'condicoes': return <TopicCondicoes />;
      case 'recursos': return <TopicRecursos />;
      case 'pvp': return <TopicPvP />;
      case 'dano': return <TopicDano />;
      case 'alvos': return <TopicAlvos />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <ModuleHeader
        icon={BookOpen}
        title="Guia"
        subtitle={TOPICS.find(t => t.id === activeTopic)?.label}
        description="Referência rápida das regras: feitiços, combate, condições e recursos."
      />

      {/* One content tree; navigation adapts to the available width. */}
      <div className={cn('lg:grid lg:items-start lg:gap-6', sidebarCollapsed ? 'lg:grid-cols-[60px_minmax(0,1fr)]' : 'lg:grid-cols-[220px_minmax(0,1fr)]')}>
        <aside className="hidden min-w-0 lg:sticky lg:top-24 lg:block">
          <div className="rounded-xl border border-border bg-card p-2 card-enigmatic">
            <div className={cn('flex items-center pb-2', sidebarCollapsed ? 'justify-center' : 'justify-between px-1')}>
              {!sidebarCollapsed && (
                <h2 className="px-2 text-sm font-bold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.06em' }}>
                  Tópicos
                </h2>
              )}
              <button
                type="button"
                aria-label={sidebarCollapsed ? 'Expandir tópicos do Guia' : 'Recolher tópicos do Guia'}
                aria-controls="guide-topic-navigation"
                aria-expanded={!sidebarCollapsed}
                onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              >
                {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </div>
            <nav id="guide-topic-navigation" className="space-y-1" aria-label="Tópicos do Guia">
              {TOPICS.map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={activeTopic === t.id}
                    aria-label={t.label}
                    title={sidebarCollapsed ? t.label : undefined}
                    onClick={() => setActiveTopic(t.id)}
                    className={cn(
                      'flex min-h-11 w-full items-center rounded-lg border py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70',
                      sidebarCollapsed ? 'justify-center px-1.5' : 'gap-3 px-3',
                      activeTopic === t.id
                        ? 'border-primary/30 bg-primary/15 text-primary shadow-sm shadow-primary/10'
                        : 'border-transparent text-muted-foreground hover:border-border/40 hover:bg-secondary/50 hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className={cn('truncate', sidebarCollapsed && 'sr-only')}>{t.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <nav className="mb-4 flex gap-1 overflow-x-auto pb-1 lg:hidden" role="group" aria-label="Tópicos do Guia">
          {TOPICS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={activeTopic === t.id}
                onClick={() => setActiveTopic(t.id)}
                className={cn(
                  'flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70',
                  activeTopic === t.id
                    ? 'border-primary/35 bg-primary/15 text-primary'
                    : 'border-border/50 text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 space-y-4 animate-fade-in lg:col-start-2 lg:row-start-1">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
