/**
 * 🎯 Seletor de Recurso (Omni-Target Selector).
 *
 * Combobox pesquisável e categorizado para escolher qual chave da ficha
 * o efeito vai afetar. Aceita:
 *   • chaves do dicionário oficial (Atributos, Recursos, Combate, Progressão);
 *   • chaves customizadas digitadas pelo Mestre (ex: "status.loucura").
 *
 * Não acopla nenhuma lógica de aplicação — só devolve a string selecionada
 * via `onChange`. Quem aplica o efeito é `aplicarEfeitoNoPersonagem`.
 */
import * as React from 'react';
import { Check, ChevronsUpDown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  ORDEM_PERICIAS,
  SISTEMA_PERICIAS,
  ROTULOS_PERICIAS,
} from '@/lib/omni/constantesDoSistema';

interface CategoriaRecurso {
  grupo: string;
  cor: string;
  itens: Array<{ id: string; label: string; hint?: string }>;
}

/** Itens de perícia já no formato técnico `pericia_<x>`, na ordem da ficha. */
const PERICIAS_ITENS = ORDEM_PERICIAS.map((k) => ({
  id: SISTEMA_PERICIAS[k].replace(/^pericias\./, 'pericia_'),
  label: ROTULOS_PERICIAS[k],
}));

/** Catálogo organizado por grupos visuais (espelha systemConstants). */
export const CATEGORIAS_RECURSO: CategoriaRecurso[] = [
  { grupo: 'Recursos por componentes', cor: 'text-emerald-300', itens: [
    { id: 'vida temporaria', label: 'PV temporários', hint: 'Concede ou consome proteção até o limite configurado.' },
    { id: 'vida temporaria maximo', label: 'Limite dos PV temporários' },
    { id: 'vida maximo', label: 'Vida máxima' }, { id: 'pe maximo', label: 'PE máximo' },
    { id: 'reserva pe', label: 'Reserva de PE' }, { id: 'dado_vida restante', label: 'Dados de Vida restantes' },
    { id: 'sorte maximo', label: 'Sorte máxima' }, { id: 'acao bonus', label: 'Ações Bônus' },
  ] },
  {
    grupo: 'Recursos Vitais', cor: 'text-emerald-300',
    itens: [
      { id: 'vida_atual',  label: 'Vida Atual',     hint: 'HP corrente — usa applyDamage/Healing' },
      { id: 'vida_max',    label: 'Vida Máxima',    hint: 'Limite de HP do personagem' },
      { id: 'energia',     label: 'Energia Atual',  hint: 'Mana / energia amaldiçoada atual' },
      { id: 'energia_max', label: 'Energia Máxima', hint: 'Limite de energia' },
    ],
  },
  {
    grupo: 'Atributos', cor: 'text-sky-300',
    itens: [
      { id: 'forca',         label: 'FOR — Força' },
      { id: 'destreza',      label: 'DES — Destreza' },
      { id: 'constituicao',  label: 'CON — Constituição' },
      { id: 'inteligencia',  label: 'INT — Inteligência' },
      { id: 'sabedoria',     label: 'SAB — Sabedoria' },
      { id: 'presenca',      label: 'PRE — Presença' },
    ],
  },
  {
    grupo: '🛡️ Testes de Resistência', cor: 'text-violet-300',
    itens: [
      { id: 'astucia',     label: 'TR — Astúcia' },
      { id: 'fortitude',   label: 'TR — Fortitude' },
      { id: 'integridade', label: 'TR — Integridade' },
      { id: 'reflexos',    label: 'TR — Reflexos' },
      { id: 'vontade',     label: 'TR — Vontade' },
    ],
  },
  {
    grupo: 'Combate', cor: 'text-rose-300',
    itens: [
      { id: 'defesa',      label: 'Defesa (CA)' },
      { id: 'esquiva',     label: 'Esquiva' },
      { id: 'acerto',      label: 'Acerto (mod. ataque)' },
      { id: 'resistencia', label: 'Resistência (RD)' },
    ],
  },
  {
    grupo: 'Progressão', cor: 'text-amber-300',
    itens: [
      { id: 'treino', label: 'Bônus de Treinamento' },
      { id: 'nivel',  label: 'Nível' },
    ],
  },
  {
    grupo: '🥋 Perícias', cor: 'text-orange-300',
    itens: PERICIAS_ITENS,
  },
];

function ehChaveOficial(valor: string): boolean {
  const v = valor.toLowerCase();
  return CATEGORIAS_RECURSO.some((c) => c.itens.some((i) => i.id === v));
}

interface Props {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
}

export function SeletorRecurso({ value, onChange, placeholder = 'Selecionar recurso…', className }: Props) {
  const [open, setOpen] = React.useState(false);
  const [busca, setBusca] = React.useState('');

  const valorLower = (value || '').toLowerCase().trim();
  const customAtual = valorLower && !ehChaveOficial(valorLower);

  const buscaLower = busca.toLowerCase().trim();
  const buscaEhCustom = buscaLower.length > 0 && !ehChaveOficial(buscaLower);

  const selecionar = (id: string) => {
    onChange(id);
    setOpen(false);
    setBusca('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('h-8 justify-between text-xs font-mono', className)}
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')} style={!value ? { fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' } : undefined}>
            {value || placeholder}
          </span>
          {customAtual && (
            <Sparkles className="h-3 w-3 text-violet-400 mr-1" aria-label="chave customizada" />
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command shouldFilter>
          <CommandInput
            placeholder="Buscar ou digitar chave customizada…"
            value={busca}
            onValueChange={setBusca}
            className="h-8 text-xs"
          />
          <CommandList className="max-h-[260px]">
            <CommandEmpty className="px-2 py-3 text-xs text-muted-foreground">
              Nenhuma chave oficial. Use o botão abaixo para criar.
            </CommandEmpty>

            {/* Atalho: usar a busca como chave customizada. */}
            {buscaEhCustom && (
              <CommandGroup heading="Customizada">
                <CommandItem
                  value={`__custom__${buscaLower}`}
                  onSelect={() => selecionar(busca.trim())}
                  className="text-xs"
                >
                  <Sparkles className="h-3 w-3 text-violet-400 mr-2" />
                  Usar <code className="font-mono mx-1 text-violet-300">{buscaLower}</code> como chave nova
                </CommandItem>
              </CommandGroup>
            )}

            {CATEGORIAS_RECURSO.map((cat) => (
              <CommandGroup key={cat.grupo} heading={cat.grupo}>
                {cat.itens.map((it) => (
                  <CommandItem
                    key={it.id}
                    value={`${cat.grupo} ${it.id} ${it.label}`}
                    onSelect={() => selecionar(it.id)}
                    className="text-xs"
                  >
                    <Check className={cn('h-3 w-3 mr-2', valorLower === it.id ? 'opacity-100' : 'opacity-0')} />
                    <code className={cn('font-mono mr-2', cat.cor)}>{it.id}</code>
                    <span className="text-muted-foreground truncate">{it.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
