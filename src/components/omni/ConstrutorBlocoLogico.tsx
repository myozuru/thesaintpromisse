/**
 * Construtor visual de uma CondicaoLogica (uma frase "Se X OP Y").
 */
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import type { CondicaoLogica, Operando } from '@/lib/omni/tipos';
import { interpretarComposicao } from '@/lib/omni/componentes/interpretar';
import {
  ALVOS_REFERENCIA, OPERADORES_LOGICOS, DICIONARIO_CONDICOES,
  listarCaminhosNumericos, type AlvoRefId, type OperadorId,
} from '@/lib/omni/constantesDoSistema';

interface Props {
  condicao: CondicaoLogica;
  onChange: (c: CondicaoLogica) => void;
  onRemove: () => void;
}

function OperandoEditor({
  op, onChange, permitirCondicao,
}: { op: Operando; onChange: (o: Operando) => void; permitirCondicao?: boolean }) {
  const caminhos = listarCaminhosNumericos();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Select value={op.tipo} onValueChange={(v) => {
        if (v === 'fixo') onChange({ tipo: 'fixo', valor: 0 });
        else if (v === 'ref') onChange({ tipo: 'ref', ref: { alvo: 'USUARIO', caminho: caminhos[0].caminho } });
        else if (v === 'formula') onChange({ tipo: 'formula', expressao: '@TREINO' });
        else onChange({ tipo: 'condicao', condicao: DICIONARIO_CONDICOES[0] });
      }}>
        <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="ref">Referência</SelectItem>
          <SelectItem value="fixo">Número</SelectItem>
          <SelectItem value="formula">Fórmula</SelectItem>
          {permitirCondicao && <SelectItem value="condicao">Condição</SelectItem>}
        </SelectContent>
      </Select>

      {op.tipo === 'ref' && (
        <>
          <Select value={op.ref.alvo} onValueChange={(v) => onChange({ ...op, ref: { ...op.ref, alvo: v as AlvoRefId, composicao: op.ref.composicao ? { ...op.ref.composicao, contexto: v as AlvoRefId } : undefined } })}>
            <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(ALVOS_REFERENCIA) as AlvoRefId[]).map((k) => (
                <SelectItem key={k} value={k}>{ALVOS_REFERENCIA[k].ui}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={op.ref.caminho} onValueChange={(v) => onChange({ ...op, ref: { ...op.ref, caminho: v, composicao: undefined } })}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {caminhos.map((c) => (
                <SelectItem key={c.caminho} value={c.caminho}>{c.rotulo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input aria-label="Consulta por componentes" value={op.ref.caminho}
            placeholder="vida temporaria maximo" className="h-8 min-w-56 flex-1 text-sm font-mono"
            onChange={e => {
              const caminho = e.target.value;
              const r = interpretarComposicao(caminho, op.ref.alvo);
              onChange({ ...op, ref: { ...op.ref, caminho,
                composicao: r.referencia && !r.erro && r.consumido === caminho.length ? r.referencia : undefined } });
            }} />
        </>
      )}
      {op.tipo === 'fixo' && (
        <Input type="number" value={op.valor} onChange={(e) => onChange({ tipo: 'fixo', valor: Number(e.target.value) || 0 })}
          className="w-20 h-8 text-xs" />
      )}
      {op.tipo === 'formula' && (
        <Input value={op.expressao} onChange={(e) => onChange({ tipo: 'formula', expressao: e.target.value })}
          className="w-44 h-8 text-xs font-mono" placeholder="@TREINO * 2" />
      )}
      {op.tipo === 'condicao' && (
        <Select value={op.condicao} onValueChange={(v) => onChange({ tipo: 'condicao', condicao: v as typeof op.condicao })}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DICIONARIO_CONDICOES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

export function ConstrutorBlocoLogico({ condicao, onChange, onRemove }: Props) {
  const isCondOp = condicao.operador === 'TEM_CONDICAO' || condicao.operador === 'NAO_TEM_CONDICAO';

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-background/40 p-2">
      <span className="text-xs uppercase tracking-wider text-primary/80">Se</span>
      <OperandoEditor op={condicao.esquerdo} onChange={(o) => onChange({ ...condicao, esquerdo: o })} />
      <Select value={condicao.operador} onValueChange={(v) => onChange({ ...condicao, operador: v as OperadorId })}>
        <SelectTrigger className="w-52 h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.keys(OPERADORES_LOGICOS) as OperadorId[]).map((k) => (
            <SelectItem key={k} value={k}>{OPERADORES_LOGICOS[k].ui}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <OperandoEditor
        op={condicao.direito}
        onChange={(o) => onChange({ ...condicao, direito: o })}
        permitirCondicao={isCondOp}
      />
      <Button type="button" size="sm" variant="ghost" onClick={onRemove} className="ml-auto h-8 w-8 p-0">
        <Trash2 className="h-4 w-4 text-destructive/70" />
      </Button>
    </div>
  );
}
