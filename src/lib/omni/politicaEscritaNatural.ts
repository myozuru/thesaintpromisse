import { RECURSOS_SUPORTADOS } from "./aplicarEfeito";
import { canonicalizarChave } from "./keyAliases";
import { destinoComposto } from "./componentes/escrita";
import type { NoComposicao } from "./componentes/composicao";
import { interpretarComposicao } from "./componentes/interpretar";

export type CanalEscritaNatural =
  "vida" | "protecao" | "recurso" | "contador" | "flag" | "pericia";
export type ResultadoDestinoNatural =
  | { ok: true; caminho: string; canal: CanalEscritaNatural }
  | {
      ok: false;
      codigo: "DERIVADO_SOMENTE_LEITURA" | "DESTINO_NAO_SUPORTADO";
      mensagem: string;
    };

const derivadosSomenteLeitura = new Set([
  "vida_pct",
  "vida_faltante",
  "vida_faltante_pct",
  "vida_total",
  "vida_temp_pct",
  "pe_pct",
  "energia_pct",
  "pe_faltante",
  "pe_faltante_pct",
  "reserva_pe_disponivel",
  "reserva_pe_recuperavel",
  "pe_pct_abaixo_50",
  "pe_pct_abaixo_25",
  "vida_pct_abaixo_50",
  "vida_pct_abaixo_25",
  "bloodied",
  "criticamente_ferido",
  "pode_ser_curado",
  "morrendo",
  "morto",
  "inconsciente",
]);

const componentesDerivados = new Set([
  "percentual",
  "porcentagem",
  "faltante",
  "total",
  "recuperavel",
  "disponivel",
]);

function contemComponenteDerivado(no: NoComposicao): boolean {
  if (
    no.tipo === "operacao" ||
    no.tipo === "filtro" ||
    no.tipo === "qualificador"
  ) {
    return (
      componentesDerivados.has(no.componente) ||
      contemComponenteDerivado(no.entrada)
    );
  }
  if (no.tipo === "vinculo")
    return (
      contemComponenteDerivado(no.entrada) ||
      contemComponenteDerivado(no.referencia)
    );
  if (no.tipo === "comparacao")
    return (
      contemComponenteDerivado(no.esquerdo) ||
      contemComponenteDerivado(no.direito)
    );
  return false;
}

/**
 * Valida um destino numérico pelo caminho que o executor atual realmente grava.
 * Não aplica o efeito. Métricas calculadas continuam consultáveis, mas nunca editáveis.
 */
export function validarDestinoEscritaNatural(
  texto: string,
): ResultadoDestinoNatural {
  const fonte = texto
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (!fonte)
    return {
      ok: false,
      codigo: "DESTINO_NAO_SUPORTADO",
      mensagem: "Informe um recurso de destino.",
    };

  const composicao = destinoComposto(fonte);
  const bruto = fonte.replace(/^(usuario|alvo|area)\./, "");
  const chave = composicao?.caminho ?? canonicalizarChave(bruto);

  if (
    derivadosSomenteLeitura.has(chave) ||
    derivadosSomenteLeitura.has(bruto)
  ) {
    return {
      ok: false,
      codigo: "DERIVADO_SOMENTE_LEITURA",
      mensagem: `"${texto}" é um valor calculado e só pode ser consultado.`,
    };
  }

  // Alguns aliases compostos que são métricas não viram destinos; reconhecer
  // a árvore permite apresentar o erro correto sem adicionar setters.
  const referencia = composicao
    ? undefined
    : interpretarComposicao(fonte).referencia;
  if (referencia && contemComponenteDerivado(referencia.consulta)) {
    return {
      ok: false,
      codigo: "DERIVADO_SOMENTE_LEITURA",
      mensagem: `"${texto}" é um valor calculado e só pode ser consultado.`,
    };
  }

  if (/^contador_[a-z0-9_]+$/.test(chave))
    return { ok: true, caminho: chave, canal: "contador" };
  if (
    /^flag_[a-z0-9_]+$/.test(chave) ||
    ["bloqueio_total", "dano_pendente"].includes(chave)
  ) {
    return { ok: true, caminho: chave, canal: "flag" };
  }
  if (chave.startsWith("pericia_") && RECURSOS_SUPORTADOS.includes(chave)) {
    return { ok: true, caminho: chave, canal: "pericia" };
  }
  if (!RECURSOS_SUPORTADOS.includes(chave)) {
    return {
      ok: false,
      codigo: "DESTINO_NAO_SUPORTADO",
      mensagem: `O executor atual não grava "${texto}" como recurso.`,
    };
  }
  if (chave === "vida") return { ok: true, caminho: chave, canal: "vida" };
  if (chave === "vida_temp" || chave === "pe_temp")
    return { ok: true, caminho: chave, canal: "protecao" };
  return { ok: true, caminho: chave, canal: "recurso" };
}
