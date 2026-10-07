/** Escolha de categorias de estabelecimento, com criação de novas categorias. */
import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useShopStore } from '@/stores/useShopStore';

interface Props { valor: string[]; onChange: (v: string[]) => void; rotulo?: string }

export function CategoriasPicker({ valor, onChange, rotulo }: Props) {
  const mapa = useShopStore((s) => s.categorias);
  const criar = useShopStore((s) => s.criarCategoria);
  const cats = useMemo(() => Object.values(mapa).filter((c) => !c.deletedAt).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [mapa]);
  const [nova, setNova] = useState('');
  const toggle = (id: string) => onChange(valor.includes(id) ? valor.filter((x) => x !== id) : [...valor, id]);
  const adicionar = () => {
    const c = criar(nova);
    if (c) { if (!valor.includes(c.id)) onChange([...valor, c.id]); setNova(''); }
  };
  return (
    <div className="space-y-2">
      {rotulo && <div className="text-xs font-medium text-muted-foreground">{rotulo}</div>}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={rotulo ?? 'Categorias'}>
        {cats.map((c) => {
          const on = valor.includes(c.id);
          return (
            <button key={c.id} type="button" aria-pressed={on} onClick={() => toggle(c.id)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${on ? 'border-primary bg-primary/20 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
              {c.nome}
            </button>
          );
        })}
      </div>
      <div className="flex gap-1">
        <input value={nova} onChange={(e) => setNova(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } }}
          placeholder="Nova categoria (ex.: Estábulo)" aria-label="Nova categoria"
          className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-xs" />
        <button type="button" onClick={adicionar} disabled={!nova.trim()} className="flex items-center gap-1 rounded border border-primary/50 px-2 py-1 text-xs text-primary disabled:opacity-50">
          <Plus className="h-3 w-3" /> Criar
        </button>
      </div>
    </div>
  );
}