import { useEffect, useMemo, useState } from 'react';
import { Tag, Percent, Coins, Calendar as CalendarIcon, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  useDiscountStore,
  type Discount,
  type DiscountTargetType,
  type DiscountKind,
} from '@/stores/useDiscountStore';
import { useChronosStore } from '@/stores/useChronosStore';
import { chronosToAbsDay } from '@/lib/discounts';
import { playClickSound, playSuccessSound } from '@/lib/sounds';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: DiscountTargetType;
  targetId: string;
  targetName: string;
  parentEstId?: string;
  parentMenuId?: string;
}

/**
 * Dialog do Mestre para criar / editar / remover descontos em
 * estabelecimento, cardapio ou item.
 *
 * Lista os descontos já aplicados ao alvo e permite cadastrar novos.
 */
export function DiscountDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
  targetName,
  parentEstId,
  parentMenuId,
}: Props) {
  const discounts = useDiscountStore((s) => s.discounts);
  const addDiscount = useDiscountStore((s) => s.addDiscount);
  const updateDiscount = useDiscountStore((s) => s.updateDiscount);
  const removeDiscount = useDiscountStore((s) => s.removeDiscount);

  const day = useChronosStore((s) => s.day);
  const month = useChronosStore((s) => s.month);
  const year = useChronosStore((s) => s.year);

  const existing = useMemo(
    () => discounts.filter((d) => d.targetType === targetType && d.targetId === targetId),
    [discounts, targetType, targetId],
  );

  const [kind, setKind] = useState<DiscountKind>('percent');
  const [value, setValue] = useState<string>('10');
  const [label, setLabel] = useState<string>('');
  const [hasWindow, setHasWindow] = useState(false);
  const [startDay, setStartDay] = useState<string>(String(day));
  const [startMonth, setStartMonth] = useState<string>(String(month));
  const [startYear, setStartYear] = useState<string>(String(year));
  const [endDay, setEndDay] = useState<string>(String(day));
  const [endMonth, setEndMonth] = useState<string>(String(month));
  const [endYear, setEndYear] = useState<string>(String(year));

  useEffect(() => {
    if (open) {
      setKind('percent');
      setValue('10');
      setLabel('');
      setHasWindow(false);
      setStartDay(String(day));
      setStartMonth(String(month));
      setStartYear(String(year));
      setEndDay(String(day));
      setEndMonth(String(month));
      setEndYear(String(year));
    }
  }, [open, day, month, year]);

  const targetTypeLabel =
    targetType === 'establishment'
      ? 'Estabelecimento'
      : targetType === 'menu'
        ? 'Cardápio'
        : 'Item';

  const handleAdd = () => {
    const numValue = Number(value);
    if (!Number.isFinite(numValue) || numValue <= 0) return;
    if (kind === 'percent' && numValue > 100) return;

    let startAbsDay: number | null = null;
    let endAbsDay: number | null = null;
    if (hasWindow) {
      startAbsDay = chronosToAbsDay(Number(startYear) || 1, Number(startMonth) || 1, Number(startDay) || 1);
      endAbsDay = chronosToAbsDay(Number(endYear) || 1, Number(endMonth) || 1, Number(endDay) || 1);
      if (endAbsDay < startAbsDay) {
        const tmp = startAbsDay;
        startAbsDay = endAbsDay;
        endAbsDay = tmp;
      }
    }

    addDiscount({
      targetType,
      targetId,
      parentEstId,
      parentMenuId,
      kind,
      value: numValue,
      label: label.trim() || undefined,
      startAbsDay,
      endAbsDay,
    });
    playSuccessSound();
    setValue('10');
    setLabel('');
    setHasWindow(false);
  };

  const formatDiscount = (d: Discount): string => {
    if (d.kind === 'percent') return `-${d.value}%`;
    return `-${d.value}`;
  };

  const formatWindow = (d: Discount): string => {
    if (d.startAbsDay == null && d.endAbsDay == null) return 'Permanente';
    const fmt = (abs: number) => {
      const y = Math.floor(abs / 360);
      const rest = abs - y * 360;
      const m = Math.floor(rest / 30) + 1;
      const dd = (rest % 30) || 30;
      return `${dd}/${m}/${y}`;
    };
    const s = d.startAbsDay != null ? fmt(d.startAbsDay) : '—';
    const e = d.endAbsDay != null ? fmt(d.endAbsDay) : '—';
    return `${s} → ${e}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-accent" /> Descontos — {targetTypeLabel}
          </DialogTitle>
          <DialogDescription className="truncate">
            Aplicando em: <span className="font-semibold text-foreground">{targetName}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Lista de descontos existentes */}
        {existing.length > 0 && (
          <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-md border border-border/60 p-2 bg-card/40">
            {existing.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-2 rounded bg-background/60 px-2 py-1.5 text-xs"
              >
                <span className="rounded-full bg-accent/15 border border-accent/30 px-2 py-0.5 font-bold text-accent">
                  {formatDiscount(d)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">
                    {d.label || (d.kind === 'percent' ? 'Percentual' : 'Valor fixo')}
                  </div>
                  <div className="text-muted-foreground">{formatWindow(d)}</div>
                </div>
                <button
                  onClick={() => {
                    playClickSound();
                    removeDiscount(d.id);
                  }}
                  className="rounded p-1 text-muted-foreground hover:bg-hp/20 hover:text-hp"
                  title="Remover desconto"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Form de novo desconto */}
        <div className="space-y-3 rounded-md border border-border/60 p-3 bg-card/40">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Novo desconto
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setKind('percent')}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-xs font-semibold transition-all',
                kind === 'percent'
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border bg-background/40 text-muted-foreground hover:border-accent/40',
              )}
            >
              <Percent className="h-3.5 w-3.5" /> Percentual
            </button>
            <button
              type="button"
              onClick={() => setKind('flat')}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-xs font-semibold transition-all',
                kind === 'flat'
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border bg-background/40 text-muted-foreground hover:border-accent/40',
              )}
            >
              <Coins className="h-3.5 w-3.5" /> Valor fixo
            </button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              {kind === 'percent' ? 'Porcentagem (1–100)' : 'Valor a subtrair'}
            </Label>
            <Input
              type="number"
              min={0}
              max={kind === 'percent' ? 100 : undefined}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Rótulo (opcional)</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex.: Promoção de inverno"
              className="h-8 text-sm"
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border/60 px-2 py-2 bg-background/40">
            <div className="flex items-center gap-2 text-xs">
              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-foreground">Janela de tempo (Chronos)</span>
            </div>
            <Switch checked={hasWindow} onCheckedChange={setHasWindow} />
          </div>

          {hasWindow && (
            <div className="space-y-2 rounded-md bg-background/40 p-2 border border-border/40">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Início (dia / mês / ano)
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <Input type="number" value={startDay} onChange={(e) => setStartDay(e.target.value)} className="h-7 text-xs" />
                  <Input type="number" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} className="h-7 text-xs" />
                  <Input type="number" value={startYear} onChange={(e) => setStartYear(e.target.value)} className="h-7 text-xs" />
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Fim (dia / mês / ano)
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <Input type="number" value={endDay} onChange={(e) => setEndDay(e.target.value)} className="h-7 text-xs" />
                  <Input type="number" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} className="h-7 text-xs" />
                  <Input type="number" value={endYear} onChange={(e) => setEndYear(e.target.value)} className="h-7 text-xs" />
                </div>
              </div>
              <p className="text-[10px] italic text-muted-foreground">
                Hoje no Chronos: {day}/{month}/{year}.
              </p>
            </div>
          )}

          <Button onClick={handleAdd} className="w-full h-8 text-xs">
            Adicionar desconto
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
