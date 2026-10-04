import { useState } from 'react';
import { CATALOGO_COMPONENTES_UI } from '@/lib/omni/componentes/catalogoUI';
import { EXEMPLOS_COMPONENTES_UI } from '@/lib/omni/componentes/exemplosUI';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function GuiaComponentes({ inserir }: { inserir: (texto: string) => void }) {
  const [busca, setBusca] = useState(''), [modo, setModo] = useState<'keys' | 'composicoes'>('keys');
  const [pagina, setPagina] = useState(0);
  const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filtro = normalizar(busca), tamanho = 24;
  const keys = CATALOGO_COMPONENTES_UI.filter(c => normalizar(`${c.key} ${c.funcao} ${c.exemplo}`).includes(filtro));
  const composicoes = EXEMPLOS_COMPONENTES_UI.filter(c => normalizar(`${c.modelo} ${c.origem} ${c.explicacao}`).includes(filtro));
  const total = modo === 'keys' ? keys.length : composicoes.length;
  const inicio = Math.min(pagina, Math.max(0, Math.ceil(total / tamanho) - 1)) * tamanho;
  return <div className="space-y-4">
    <p className="text-sm leading-relaxed">Cada termo reconhecido é um componente reutilizável. Combinações válidas seguem a gramática do motor; uma palavra isolada nem sempre produz um valor ou aceita escrita. <code>arma_principal leve</code> combina um seletor e uma propriedade. <code>corpo_a_corpo</code> permanece um componente completo.</p>
    <p className="text-sm leading-relaxed">As fórmulas são efeitos. Configure quando executar, quem é o alvo e quais custos pagar no construtor. Um teste precisa de dado mais bônus; somar um bônus não define sua duração. Dano em vida passa pela mitigação do motor.</p>
    <div className="flex flex-wrap gap-2">
      <Button variant={modo === 'keys' ? 'default' : 'outline'} onClick={() => { setModo('keys'); setPagina(0); }}>303 componentes</Button>
      <Button variant={modo === 'composicoes' ? 'default' : 'outline'} onClick={() => { setModo('composicoes'); setPagina(0); }}>335 composições e exemplos</Button>
    </div>
    <Input aria-label="Buscar componentes e exemplos" placeholder="Buscar key, regra ou cenário…" value={busca} onChange={e => { setBusca(e.target.value); setPagina(0); }} />
    <p className="text-xs text-muted-foreground">{total} resultados. Nomes e IDs dos exemplos devem corresponder ao conteúdo da sua mesa.</p>
    <div className="grid gap-3 lg:grid-cols-2">
      {modo === 'keys' ? keys.slice(inicio, inicio + tamanho).map(c => <article key={c.id} className="space-y-2 rounded-lg border border-border bg-card/70 p-4">
        <button className="break-words text-left font-mono text-sm font-semibold text-primary" onClick={() => inserir(c.key)}>{c.key}</button>
        <p className="text-xs text-muted-foreground">{c.papel}</p>
        <p className="text-sm leading-relaxed">{c.funcao}</p>
        <p className="text-sm leading-relaxed text-foreground/85"><strong>Exemplo específico: </strong>{c.exemplo}</p>
        <div className="flex flex-wrap gap-1">{c.contextosPorConversao.slice(0, 6).map(id => {
          const ex = EXEMPLOS_COMPONENTES_UI.find(e => e.id === id);
          return ex && <button key={id} className="rounded border border-border px-2 py-1 text-xs hover:bg-muted" onClick={() => { setModo('composicoes'); setBusca(ex.modelo); setPagina(0); }}>{ex.modelo}</button>;
        })}</div>
      </article>) : composicoes.slice(inicio, inicio + tamanho).map(c => <article key={c.id} className="space-y-3 rounded-lg border border-border bg-card/70 p-4">
        <h3 className="break-words font-mono text-sm font-semibold text-primary">{c.modelo}</h3>
        <p className="text-xs text-muted-foreground">Origem histórica: <code>{c.origem}</code></p>
        <button onClick={() => inserir(c.formula)} className="w-full whitespace-pre-wrap break-words rounded border border-primary/25 bg-muted/70 p-3 text-left font-mono text-sm leading-relaxed hover:bg-primary/10">{c.formula}</button>
        <p className="text-sm leading-relaxed"><strong>Como funciona: </strong>{c.explicacao}</p>
      </article>)}
    </div>
    <div className="flex items-center justify-between gap-2">
      <Button variant="outline" disabled={inicio === 0} onClick={() => setPagina(Math.max(0, pagina - 1))}>Anterior</Button>
      <span className="text-xs text-muted-foreground">{total ? inicio + 1 : 0}–{Math.min(inicio + tamanho, total)} de {total}</span>
      <Button variant="outline" disabled={inicio + tamanho >= total} onClick={() => setPagina(pagina + 1)}>Próxima</Button>
    </div>
  </div>;
}
