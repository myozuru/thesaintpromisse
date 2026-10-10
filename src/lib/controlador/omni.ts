import { DAMAGE_TYPES, DEFAULT_SAVING_THROWS, type DamageType } from "@/types";
import type { AcaoAtivaConfig, EntidadeOmni } from "@/lib/omni/tipos";
import { parseFormulaDanoInvocacao } from "./rolagens";
import type { InvocacaoControlador } from "./tipos";

type AcaoCatalogoInvocacao = InvocacaoControlador["acoes"][number];

const CATEGORIAS: Record<
  AcaoAtivaConfig["acao"],
  NonNullable<AcaoCatalogoInvocacao["categoriaAcao"]>
> = {
  comum: "acao_comum",
  bonus: "acao_bonus",
  movimento: "movimento",
  livre: "livre",
  reacao: "reacao",
};

const TRS: Record<NonNullable<AcaoAtivaConfig["tr"]>, string> = {
  astucia: "Astúcia",
  fortitude: "Fortitude",
  integridade: "Integridade",
  reflexos: "Reflexos",
  vontade: "Vontade",
};

export type ResultadoResolucaoOmniInvocacao =
  | { ok: true; acao: AcaoCatalogoInvocacao; entidade: EntidadeOmni; config: AcaoAtivaConfig }
  | { ok: false; motivo: string };

/**
 * Resolve uma referência OMNI para o contrato de ataque/TR que o controlador
 * já executa com estatísticas, alcance, custos e economia próprios do Shikigami.
 * Configurações fora desse contrato são recusadas antes de gastar recursos.
 */
export function resolverAcaoOmniInvocacao(
  acao: AcaoCatalogoInvocacao,
  entidades: Record<string, EntidadeOmni>,
): ResultadoResolucaoOmniInvocacao {
  if (acao.tipoExecucao !== "omni" && acao.tipoExecucao !== "referencia_omni") {
    return { ok: false, motivo: "Esta ação não é uma referência OMNI." };
  }
  const entidadeId = acao.entidadeOmniId?.trim();
  const acaoOmniId = acao.acaoOmniId?.trim();
  if (!entidadeId || !acaoOmniId)
    return { ok: false, motivo: "A referência OMNI precisa de entidade e ação." };
  const entidade = entidades[entidadeId];
  if (!entidade)
    return { ok: false, motivo: `A entidade OMNI "${entidadeId}" não está mais no catálogo.` };
  const config = entidade.acoesAtivas?.find((item) => item.id === acaoOmniId);
  if (!config)
    return {
      ok: false,
      motivo: `A ação OMNI "${acaoOmniId}" não existe mais em "${entidade.nome}".`,
    };

  if (config.teste !== "ataque" && config.teste !== "tr") {
    return {
      ok: false,
      motivo: "Esta versão de Invocações executa ações OMNI de Ataque ou Teste de Resistência.",
    };
  }
  if (config.acao === "reacao")
    return {
      ok: false,
      motivo: "Ações OMNI de reação ainda não podem ser comandadas manualmente por uma invocação.",
    };
  if (config.tipo_efeito && config.tipo_efeito !== "dano")
    return {
      ok: false,
      motivo: "A ação OMNI precisa ter efeito de dano para usar o fluxo de ataque/TR da invocação.",
    };
  if (config.tipo_alvo && config.tipo_alvo !== "unico")
    return {
      ok: false,
      motivo:
        "A ação OMNI precisa ter alvo único; áreas e múltiplos alvos ainda não estão disponíveis para invocações.",
    };
  if (config.filtro_alvo && config.filtro_alvo !== "todos_exceto_si")
    return {
      ok: false,
      motivo:
        "O filtro OMNI desta ação não pode ser representado pelo seletor de alvos da invocação.",
    };
  if (config.max_alvos && config.max_alvos.trim() !== "1")
    return { ok: false, motivo: "O limite OMNI precisa ser um alvo único." };
  if (!Number.isFinite(config.alcanceM) || config.alcanceM <= 0)
    return { ok: false, motivo: "Defina um alcance OMNI positivo para esta ação." };
  if (!/^(?:\d+)(?:\.\d+)?$/.test(config.custoPE.trim()))
    return {
      ok: false,
      motivo:
        "A ação OMNI usa custo de PE dinâmico; configure um custo fixo para executá-la pela invocação.",
    };
  if (
    config.custo_recursos ||
    config.efeitos?.length ||
    config.condicionais?.length ||
    config.continuo ||
    config.assistencia_dano ||
    config.dadosPorCarga ||
    config.incluirArma ||
    config.margemCritico ||
    config.tr_apos_acerto ||
    config.desfechosTR ||
    config.reacao ||
    config.cura?.trim()
  ) {
    return {
      ok: false,
      motivo:
        "A ação OMNI inclui custos, efeitos ou duração que o fluxo de invocação ainda não consegue resolver; nada foi executado.",
    };
  }
  if (config.cd?.trim())
    return {
      ok: false,
      motivo:
        "A ação OMNI tem uma CD personalizada; configure o atributo de CD na ficha do Shikigami.",
    };
  if (config.pericia_usuario || config.pericias_alvo?.length)
    return {
      ok: false,
      motivo: "Testes de perícia/disputa do OMNI ainda não estão disponíveis para invocações.",
    };
  if (config.mod_acerto !== undefined && !Number.isFinite(config.mod_acerto))
    return { ok: false, motivo: "O bônus de acerto OMNI não é válido." };
  if (config.tipoDano && !DAMAGE_TYPES.includes(config.tipoDano as DamageType))
    return { ok: false, motivo: `Tipo de dano OMNI desconhecido: ${config.tipoDano}.` };
  if (!parseFormulaDanoInvocacao(config.dano ?? ""))
    return {
      ok: false,
      motivo: "Configure dano OMNI fixo usando dados e bônus inteiros, por exemplo 2d8+3.",
    };

  let resistenciaAlvo: string | undefined;
  if (config.teste === "tr") {
    resistenciaAlvo = config.tr ? TRS[config.tr] : undefined;
    if (!resistenciaAlvo || !DEFAULT_SAVING_THROWS.includes(resistenciaAlvo)) {
      return { ok: false, motivo: "Selecione um Teste de Resistência OMNI reconhecido." };
    }
  }

  const categoriaAcao = CATEGORIAS[config.acao];
  const custoPE = Number(config.custoPE);
  if (!Number.isFinite(custoPE) || custoPE < 0)
    return { ok: false, motivo: "O custo de PE OMNI precisa ser fixo e não negativo." };
  const tipoDano = config.tipoDano as DamageType | undefined;
  const acaoResolvida: AcaoCatalogoInvocacao = {
    ...acao,
    nome: config.nome,
    tipo: config.teste === "ataque" ? "ataque" : "habilidade",
    teste: config.teste === "ataque" ? "ataque" : "resistencia",
    categoriaAcao,
    custoPE,
    alcanceM: config.alcanceM,
    bonusAtaque: config.teste === "ataque" ? (config.mod_acerto ?? 0) : acao.bonusAtaque,
    dano: config.dano!,
    ...(tipoDano ? { tipoDano } : {}),
    ...(resistenciaAlvo
      ? { resistenciaAlvo, atributoCD: acao.atributoCD ?? "presenca" }
      : {}),
    ...(config.teste === "tr"
      ? { danoNoSucesso: config.metadeNoSucesso ? "metade" : "nenhum" }
      : {}),
  };

  return { ok: true, acao: acaoResolvida, entidade, config };
}
