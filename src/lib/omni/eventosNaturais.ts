import { resolverGatilho } from "./gatilhoAliases";
import type { FraseNatural, PredicadoNatural } from "./gramaticaNatural";
import type { GatilhoId } from "./constantesDoSistema";

export interface FiltrosEventoNatural {
  /** Quem sofreu/causou o evento relativo ao portador da regra. */
  sujeito?: "usuario" | "outro_aliado" | "outro_inimigo";
  /** Relação do atacante/origem em relação ao usuário. */
  agressor?: "aliado" | "inimigo";
  raioMetros?: number;
  acerto?: "critico";
  tipoAtaque?: "corpo_a_corpo" | "a_distancia";
}
export interface EventoNaturalMapeado {
  evento: GatilhoId;
  filtros: FiltrosEventoNatural;
  fonte: string;
}
export interface ErroEventoNatural {
  codigo: "EVENTO_NAO_SUPORTADO" | "FILTRO_EVENTO_INVALIDO";
  mensagem: string;
  inicio: number;
  fim: number;
}
export type ResultadoEventoNatural =
  | { ok: true; eventos: EventoNaturalMapeado[] }
  | { ok: false; erros: ErroEventoNatural[] };

const limpar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b(?:cac|corpo a corpo|melee)\b/g, 'corpo_a_corpo').replace(/\b(?:a distancia|ranged)\b/g, 'a_distancia');
const eventosNaturaisLegados: Record<string, string> = {
  "ao iniciar combate": "inicio_combate",
  "ao entrar em combate": "entrar_combate",
  "ao iniciar rodada": "inicio_rodada",
  "ao iniciar rodada de combate": "ao_iniciar_rodada_combate",
  "ao finalizar rodada": "ao_finalizar_rodada",
  "ao finalizar rodada de combate": "ao_finalizar_rodada_combate",
  "ao finalizar combate": "ao_finalizar_combate",
  "ao sair do combate": "ao_sair_do_combate",
  "ao terminar combate": "ao_terminar_combate",
  "ao iniciar turno": "ao_iniciar_turno",
  "ao terminar turno": "ao_terminar_turno",
  "no inicio do turno": "no_inicio_do_turno",
  "no fim do turno": "no_fim_do_turno",
};

/** Mapeia apenas formas cujo sujeito e sentido podem ser expressos sem adivinhação. */
export function mapearAtomoEventoNatural(
  texto: string,
): EventoNaturalMapeado | undefined {
  const frase = limpar(texto),
    filtros: FiltrosEventoNatural = {};
  const tipoCorpo = /\bcorpo_a_corpo\b/.test(frase),
    tipoDist = /\ba_distancia\b/.test(frase);
  if (tipoCorpo && tipoDist) return;
  if (tipoCorpo) filtros.tipoAtaque = "corpo_a_corpo";
  if (tipoDist) filtros.tipoAtaque = "a_distancia";

  const critico = /\bcritico\b/.test(frase);
  const baseAcerto = frase.match(
    /^(?:ao )?acertar(?: ataque)?(?: critico)?(?: corpo_a_corpo| a_distancia)?$/,
  );
  if (baseAcerto) {
    const ev = resolverGatilho("ao_acertar_ataque");
    if (!ev) return;
    if (critico) filtros.acerto = "critico";
    return { evento: ev, filtros, fonte: texto };
  }
  if (
    /^(?:ao )?errar(?: ataque)?(?: corpo_a_corpo| a_distancia)?$/.test(frase)
  ) {
    const ev = resolverGatilho("ao_errar_ataque");
    return ev ? { evento: ev, filtros, fonte: texto } : undefined;
  }

  const sofreProprio = frase.match(
    /^(?:ao )?sofrer dano(?: de (inimigo|aliado))?$/,
  );
  if (sofreProprio) {
    const ev = resolverGatilho("ao_sofrer_dano");
    if (!ev) return;
    filtros.sujeito = "usuario";
    if (sofreProprio[1])
      filtros.agressor = sofreProprio[1] as "aliado" | "inimigo";
    return { evento: ev, filtros, fonte: texto };
  }

  const sofreOutro = frase.match(
    /^quando (aliado|inimigo)(?: ate ([\d.,]+)\s*(m|metros?))? sofrer dano(?: de (inimigo|aliado))?$/,
  );
  if (sofreOutro) {
    const [, _relacao, valor, unidade, agressor] = sofreOutro;
    const ev = resolverGatilho(
      _relacao === "aliado" ? "aliado_sofrer_dano" : "inimigo_sofrer_dano",
    );
    if (!ev) return;
    filtros.sujeito = _relacao === "aliado" ? "outro_aliado" : "outro_inimigo";
    if (valor !== undefined) {
      const parsed = Number(valor.replace(",", "."));
      if (
        !Number.isFinite(parsed) ||
        parsed < 0 ||
        !(unidade === "m" || unidade.startsWith("metro"))
      )
        return;
      filtros.raioMetros = parsed;
    }
    if (agressor) filtros.agressor = agressor as "aliado" | "inimigo";
    return { evento: ev, filtros, fonte: texto };
  }

  const causaOutro = frase.match(
    /^quando (aliado|inimigo) causar dano(?: de (inimigo|aliado))?$/,
  );
  if (causaOutro) {
    const ev = resolverGatilho(
      causaOutro[1] === "aliado" ? "aliado_causar_dano" : "inimigo_causar_dano",
    );
    if (!ev) return;
    filtros.sujeito =
      causaOutro[1] === "aliado" ? "outro_aliado" : "outro_inimigo";
    if (causaOutro[2]) filtros.agressor = causaOutro[2] as "aliado" | "inimigo";
    return { evento: ev, filtros, fonte: texto };
  }

  // Gatilhos simples do catálogo reaproveitam os aliases legados, sem inventar evento novo.
  const slug =
    eventosNaturaisLegados[frase] ??
    frase
      .replace(/^(?:ao |no |na )/, "")
      .replace(/\bdo\b/g, "")
      .replace(/\bda\b/g, "")
      .trim()
      .replace(/\s+/g, "_");
  const ev = resolverGatilho(slug);
  return ev ? { evento: ev, filtros, fonte: texto } : undefined;
}

function visitar(
  pred: PredicadoNatural,
  resultado: Array<Extract<PredicadoNatural, { tipo: "atomo" }>>,
) {
  if (pred.tipo === "atomo") {
    if (pred.classe === "evento") resultado.push(pred);
    return;
  }
  visitar(pred.esquerda, resultado);
  visitar(pred.direita, resultado);
}

/** Coleta eventos da AST; átomos não-evento continuam sendo predicados/condições. */
export function eventosDaFraseNatural(
  frase: FraseNatural,
): ResultadoEventoNatural {
  const atomos: Array<Extract<PredicadoNatural, { tipo: "atomo" }>> = [];
  visitar(frase.condicao, atomos);
  const eventos: EventoNaturalMapeado[] = [],
    erros: ErroEventoNatural[] = [];
  const vistos = new Set<string>();
  for (const atomo of atomos) {
    const evento = mapearAtomoEventoNatural(atomo.texto);
    if (!evento) {
      erros.push({
        codigo: "EVENTO_NAO_SUPORTADO",
        mensagem: `Este evento natural ainda não possui mapeamento seguro: "${atomo.texto}".`,
        ...atomo.intervalo,
      });
      continue;
    }
    const chave = JSON.stringify([evento.evento, evento.filtros]);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    eventos.push(evento);
  }
  return erros.length ? { ok: false, erros } : { ok: true, eventos };
}
