import { describe, expect, it } from "vitest";
import type { AcaoInvocacao } from "@/lib/invocacoes/schema";
import type { EntidadeOmni } from "@/lib/omni/tipos";
import { resolverAcaoOmniInvocacao } from "@/lib/controlador/omni";
import { getTabsForRole } from "@/components/Header";

function entidadeOmni(acao: Record<string, unknown>): EntidadeOmni {
  return {
    id: "ent-golpe",
    nome: "Golpe Omniversal",
    categoria: "talento",
    acoesAtivas: [
      {
        id: "acao-golpe",
        nome: "Lança Sombria",
        acao: "comum",
        custoPE: "2",
        alcanceM: 9,
        teste: "ataque",
        dano: "2d8+3",
        tipoDano: "DI",
        ...acao,
      },
    ],
  } as unknown as EntidadeOmni;
}

const referencia: AcaoInvocacao = {
  id: "inv-acao",
  nome: "Lança Sombria",
  tipoExecucao: "omni",
  tipoAtaque: "distancia",
  atributoAtaque: "destreza",
  entidadeOmniId: "ent-golpe",
  acaoOmniId: "acao-golpe",
};

describe("ações OMNI de invocação", () => {
  it("resolve ataque OMNI pelo contrato de combate do Shikigami", () => {
    const entidade = entidadeOmni({ mod_acerto: 2 });
    const resultado = resolverAcaoOmniInvocacao(referencia, { [entidade.id]: entidade });

    expect(resultado).toMatchObject({
      ok: true,
      acao: {
        teste: "ataque",
        tipo: "ataque",
        categoriaAcao: "acao_comum",
        custoPE: 2,
        alcanceM: 9,
        bonusAtaque: 2,
        dano: "2d8+3",
        tipoDano: "DI",
        tipoAtaque: "distancia",
        atributoAtaque: "destreza",
      },
    });
  });

  it("resolve teste de resistência e dano pela ficha do Shikigami", () => {
    const entidade = entidadeOmni({ teste: "tr", tr: "fortitude", metadeNoSucesso: true });
    const resultado = resolverAcaoOmniInvocacao(referencia, { [entidade.id]: entidade });

    expect(resultado).toMatchObject({
      ok: true,
      acao: {
        teste: "resistencia",
        resistenciaAlvo: "Fortitude",
        atributoCD: "presenca",
        danoNoSucesso: "metade",
      },
    });
  });

  it("recusa efeitos OMNI ainda não suportados sem descartar a limitação", () => {
    const entidade = entidadeOmni({
      efeitos: [{ tipo: "condicao", condicao: "agarrado", rodadas: 2 }],
    });
    const resultado = resolverAcaoOmniInvocacao(referencia, { [entidade.id]: entidade });

    expect(resultado).toEqual({
      ok: false,
      motivo:
        "A ação OMNI inclui custos, efeitos ou duração que o fluxo de invocação ainda não consegue resolver; nada foi executado.",
    });
  });

  it("recusa referências quebradas antes do comando", () => {
    const resultado = resolverAcaoOmniInvocacao(referencia, {});
    expect(resultado).toEqual({
      ok: false,
      motivo: 'A entidade OMNI "ent-golpe" não está mais no catálogo.',
    });
  });

  it("mostra Invocações como aba independente para jogador e mestre", () => {
    expect(getTabsForRole("PLAYER")).toContain("invocacoes");
    expect(getTabsForRole("MASTER")).toContain("invocacoes");
  });
});
