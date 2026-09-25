/**
 * SmartDropdown: campo que alterna entre Valor Fixo e Fórmula Escalável.
 * Na aba Fórmula oferece construtor visual: [Atributo/Recurso] [Operador] [Número].
 */
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { ValorDinamico } from '@/lib/omni/tipos';
import { listarCaminhosNumericos, ALIASES_FORMULA } from '@/lib/omni/constantesDoSistema';

interface Props {
  valor: ValorDinamico;
  onChange: (v: ValorDinamico) => void;
  rotulo?: string;
}

// Mapa inverso: caminho → alias curto (ex: "status.bonusTreinamento" → "TREINO")
const CAMINHO_TO_ALIAS: Record<string, string> = Object.fromEntries(
  Object.entries(ALIASES_FORMULA).map(([alias, caminho]) => [caminho, alias])
);

export function SmartDropdown({ valor, onChange, rotulo }: Props) {
  const opcoes = useMemo(() => listarCaminhosNumericos(), []);
  const modo = valor.tipo;

  // Estado local do construtor de fórmula (quando em modo fórmula)
  const [builderCaminho, setBuilderCaminho] = useState<string>(
    opcoes.find((o) => o.chave === 'TREINO')?.caminho ?? opcoes[0]?.caminho ?? ''
  );
  const [builderOp, setBuilderOp] = useState<'*' | '+' | '-' | '/'>('*');
  const [builderNum, setBuilderNum] = useState<string>('2');

  const aplicarBuilder = () => {
    const alias = CAMINHO_TO_ALIAS[builderCaminho] ?? builderCaminho;
    const expr = `@${alias} ${builderOp} ${builderNum}`;
    onChange({ tipo: 'formula', expressao: expr });
  };

  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
      {rotulo && (
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{rotulo}</div>
      )}
      <div className="inline-flex rounded-md border border-border/60 p-0.5 text-xs">
        <button
          type="button"
          onClick={() => onChange({ tipo: 'fixo', valor: 0 })}
          className={`px-3 py-1 rounded ${modo === 'fixo' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Valor Fixo
        </button>
        <button
          type="button"
          onClick={() => onChange({ tipo: 'formula', expressao: '@TREINO * 2' })}
          className={`px-3 py-1 rounded ${modo === 'formula' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Fórmula Escalável
        </button>
      </div>

      {modo === 'fixo' ? (
        <Input
          type="number"
          value={valor.valor}
          onChange={(e) => onChange({ tipo: 'fixo', valor: Number(e.target.value) || 0 })}
          className="w-32"
        />
      ) : (
        <div className="space-y-2">
          {/* Construtor visual */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={builderCaminho} onValueChange={setBuilderCaminho}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {opcoes.map((o) => (
                  <SelectItem key={o.caminho} value={o.caminho}>
                    <span className="text-muted-foreground mr-1">[{o.grupo}]</span>{o.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={builderOp} onValueChange={(v) => setBuilderOp(v as typeof builderOp)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="*">Multiplicado por</SelectItem>
                <SelectItem value="+">Somado com</SelectItem>
                <SelectItem value="-">Subtraído de</SelectItem>
                <SelectItem value="/">Dividido por</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              value={builderNum}
              onChange={(e) => setBuilderNum(e.target.value)}
              className="w-24"
            />
            <Button type="button" size="sm" variant="secondary" onClick={aplicarBuilder}>
              Aplicar fórmula
            </Button>
          </div>
          <Input
            value={valor.expressao}
            onChange={(e) => onChange({ tipo: 'formula', expressao: e.target.value })}
            placeholder="Ex: @TREINO * 2 + 1d6"
            className="font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground">
            Aliases: @FOR @DES @CON @INT @AST @VON @TREINO @NIVEL @VIDA @PE. Dados: 1d8, 2d6!, 1d20kh2, 1d6r1.
          </p>
        </div>
      )}
    </div>
  );
}
