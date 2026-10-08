import { EXEMPLOS_COMPONENTES_UI } from "./componentes/exemplosUI";
import type { ChaveGuia } from "./guiaDados";

const porOrigem = new Map<string, (typeof EXEMPLOS_COMPONENTES_UI)[number]>(
  EXEMPLOS_COMPONENTES_UI.map((exemplo) => [exemplo.origem, exemplo]),
);

type ExemploContextual = {
  origem: string;
  modelo: string;
  formula: string;
  explicacao: string;
};

const exemplosDeContexto: Record<string, ExemploContextual> = {
  "DANO.vida_perdida": {
    origem: "DANO.vida_perdida",
    modelo: "vida realmente perdida",
    formula:
      "se @DANO.vida_perdida > 0 entao somar 1 em @USUARIO.contador rancor ate @USUARIO.treino",
    explicacao:
      "Use esta condição dentro do gatilho Ao Sofrer Dano quando uma passiva só deve reagir à perda real de PV. Se o golpe resolver 12 de dano, mas escudo e vida temporária absorverem tudo, vida_perdida vale 0 e Rancor não aumenta. Se 5 PV forem retirados da Vida normal, a condição passa e soma 1 carga, respeitando o teto de Treino. O valor mede PV removidos, não o dano bruto nem o dano que só atingiu proteções.",
  },
};


// Consultas separadas de imunidade, resistência e vulnerabilidade para cada tipo
// de dano. Estes exemplos consultam propriedades já calculadas pela ficha;
// não tentam reaplicar dano nem contornar a mitigação do motor.
const nomesDano: Record<string, string> = {
  dco: 'Cortante', dp: 'Perfurante', di: 'Impactante', da: 'Ácido',
  dcg: 'Congelante', dcc: 'Chocante', dq: 'Queimante', ds: 'Sônico',
  dal: 'na Alma', dnr: 'Energia Reversa', de: 'Energético',
  dps: 'Psíquico', dr: 'Radiante', dn: 'Necrótico', dv: 'Venenoso',
};
const consultasDefesa = [
  { prefixo: 'imunidade', rotulo: 'imunidade', efeito: 'anularia completamente a parcela desse tipo de dano' },
  { prefixo: 'resistencia', rotulo: 'resistência', efeito: 'reduziria a parcela desse tipo de dano conforme a regra de resistência' },
  { prefixo: 'vulnerabilidade', rotulo: 'vulnerabilidade', efeito: 'aumentaria a parcela desse tipo de dano conforme a regra de vulnerabilidade' },
];
for (const { prefixo, rotulo, efeito } of consultasDefesa) {
  for (const [codigo, nome] of Object.entries(nomesDano)) {
    const id = `${prefixo}_${codigo}`;
    exemplosDeContexto[id] = {
      origem: id,
      modelo: `${rotulo} a dano ${nome}`,
      formula: `se @USUARIO.${id} > 0 entao somar 1 em @USUARIO.contador verificacoes`,
      explicacao: `Durante a inspeção de um ataque ${nome} (${codigo.toUpperCase()}), esta expressão consulta se o personagem tem ${rotulo} ativa: 1 significa presente e 0, ausente. Se presente, soma uma marca de verificação ao contador, sem aplicar outro ataque. Uma ocorrência real de dano ${nome} ${efeito}. Isso é calculado automaticamente no motor de dano antes da perda de escudo e PV; consultar a chave não concede, remove nem ativa a proteção.`,
    };
  }
}

/** Cards históricos e compostos consultam o mesmo exemplo, sem varrer o catálogo a cada render. */
export function exemploCompostoDaChave(
  chave: Pick<ChaveGuia, "id" | "aliases">,
) {
  const contextual = exemplosDeContexto[chave.id];
  if (contextual) return contextual;
  const principal = porOrigem.get(chave.id);
  if (principal) return principal;
  for (const alias of chave.aliases) {
    const exemplo = porOrigem.get(alias);
    if (exemplo) return exemplo;
  }
  return undefined;
}
