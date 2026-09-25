/**
 * Seletor multi-valor compacto para o Construtor No-Code.
 * Recebe uma lista de opções `{id,label}` e um valor CSV ("a,b,c").
 * Devolve a string CSV atualizada via onChange.
 */
import { useMemo } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface MultiOption { id: string; label: string }

interface Props {
  opcoes: MultiOption[];
  /** CSV ("furtividade,acrobacia"). Vazio = nenhum. */
  valor: string;
  onChange: (csv: string) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelectChips({ opcoes, valor, onChange, placeholder = 'Selecionar…', className = '' }: Props) {
  const selecionados = useMemo(
    () => valor.split(',').map((s) => s.trim()).filter(Boolean),
    [valor],
  );

  const toggle = (id: string) => {
    const set = new Set(selecionados);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange(Array.from(set).join(','));
  };

  const labelTrigger = selecionados.length === 0
    ? placeholder
    : selecionados.length === 1
      ? (opcoes.find((o) => o.id === selecionados[0])?.label ?? selecionados[0])
      : `${selecionados.length} selecionados`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`h-8 text-xs justify-between gap-2 font-normal ${className}`}
        >
          <span className="truncate">{labelTrigger}</span>
          <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1 max-h-72 overflow-auto">
        {selecionados.length > 0 && (
          <div className="flex flex-wrap gap-1 p-1.5 border-b border-border/40 mb-1">
            {selecionados.map((id) => {
              const op = opcoes.find((o) => o.id === id);
              return (
                <Badge
                  key={id}
                  variant="secondary"
                  className="text-[10px] cursor-pointer hover:bg-destructive/20"
                  onClick={() => toggle(id)}
                  title="Remover"
                >
                  {op?.label ?? id} ✕
                </Badge>
              );
            })}
          </div>
        )}
        {opcoes.map((o) => {
          const ativo = selecionados.includes(o.id);
          return (
            <button
              type="button"
              key={o.id}
              onClick={() => toggle(o.id)}
              className={`w-full flex items-center justify-between text-xs px-2 py-1.5 rounded hover:bg-accent ${ativo ? 'bg-accent/40' : ''}`}
            >
              <span className="truncate">{o.label}</span>
              {ativo && <Check className="h-3 w-3 text-primary" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
