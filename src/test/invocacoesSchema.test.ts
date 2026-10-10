import { describe, expect, it } from "vitest";
import {
  auditarInventarioLegadoInvocacao,
  InstanciaInvocacaoSchema,
  normalizarInstanciaInvocacao,
  normalizarModeloInvocacao,
  validarReferenciasModeloInstancia,
} from "@/lib/invocacoes/schema";

function modeloLegado(overrides: Record<string, unknown> = {}) {
  return {
    id: "invocacao-1",
    donoCharacterId: "personagem-1",
    nome: "Cão Divino",
    tipo: "shikigami",
    origem: { tipo: "grimorio", entidadeId: "criatura-lobo" },
    hpAtual: 12,
    hpMaximo: 20,
    defesa: 14,
    deslocamentoM: 9,
    porte: "Médio",
    atributos: { forca: 14, destreza: 16 },
    custoInvocacaoPE: 3,
    custoSustentacaoPE: 1,
    acoes: [
      {
        id: "mordida",
        nome: "Mordida",
        tipo: "ataque",
        dano: "1d6",
        entidadeOmniId: "entidade-omni-1",
      },
    ],
    ...overrides,
  };
}

function tokenLegado(overrides: Record<string, unknown> = {}) {
  return {
    id: "token-1",
    ownerCharId: "personagem-1",
    invocationId: "invocacao-1",
    hp: 0,
    hpMax: 20,
    ...overrides,
  };
}

describe("contratos e migração legada de invocações", () => {
  it("preserva snapshot, IDs, valores e ações sem mudar os dados de origem", () => {
    const original = modeloLegado();
    const antes = structuredClone(original);
    const resultado = normalizarModeloInvocacao(original);

    expect(resultado.ok).toBe(true);
    expect(resultado.original).toBe(original);
    expect(original).toEqual(antes);

    const modelo = resultado.dados!;
    expect(modelo.id).toBe("invocacao-1");
    expect(modelo.donoCharacterId).toBe("personagem-1");
    expect(modelo.nome).toBe("Cão Divino");
    expect(modelo.origem).toEqual(original.origem);
    expect(modelo.atributos).toEqual(original.atributos);
    expect(modelo.estadoLegado).toMatchObject({
      hpAtual: 12,
      hpMaximo: 20,
      defesa: 14,
      deslocamentoM: 9,
      custoInvocacaoPE: 3,
      custoSustentacaoPE: 1,
    });
    expect(modelo.valoresDerivados?.hpMaximo).toMatchObject({
      modo: "revisao_necessaria",
      valorPreservado: 20,
    });
    expect(modelo.valoresDerivados?.defesa?.modo).toBe("revisao_necessaria");
    expect(modelo.snapshotLegado).toEqual(original);
    expect(modelo.aquisicao).toEqual({
      estado: "aprovada",
      fonte: "legado",
      inferida: true,
    });
    expect(modelo.tempoAdicional).toBeUndefined();
    expect(modelo.intermediario).toBeUndefined();
    expect(resultado.avisos.map((item) => item.codigo)).toContain("tempo_nao_configurado");

    // O vínculo e o payload OMNI antigo permanecem disponíveis, mas não se inventa
    // um ID de ação OMNI nem se declara equivalência semântica.
    expect(modelo.acoes?.[0]).toMatchObject({
      id: "mordida",
      tipoExecucao: "legada",
      entidadeOmniId: "entidade-omni-1",
      payloadLegado: {
        id: "mordida",
        nome: "Mordida",
        tipo: "ataque",
        dano: "1d6",
        entidadeOmniId: "entidade-omni-1",
      },
    });
    expect(modelo.acoes?.[0].acaoOmniId).toBeUndefined();
  });

  it.each([
    ["pendente", "pendente"],
    ["aprovada", "aprovada"],
    ["rejeitada", "rejeitada"],
  ] as const)("mantém o estado legado de aprovação %s", (legado, esperado) => {
    const resultado = normalizarModeloInvocacao(modeloLegado({ aprovacaoMestre: legado }));

    expect(resultado.ok).toBe(true);
    expect(resultado.dados?.aquisicao.estado).toBe(esperado);
    expect(resultado.dados?.aquisicao.inferida).toBe(false);
  });

  it("não converte registros incompletos nem versões desconhecidas", () => {
    const semId = modeloLegado({ id: undefined });
    const falha = normalizarModeloInvocacao(semId);
    expect(falha.ok).toBe(false);
    expect(falha.original).toBe(semId);
    expect(falha.avisos.map((item) => item.codigo)).toContain("id_ausente");

    const futura = modeloLegado({ schemaVersion: 99 });
    const versaoDesconhecida = normalizarModeloInvocacao(futura);
    expect(versaoDesconhecida.ok).toBe(false);
    expect(versaoDesconhecida.avisos.map((item) => item.codigo)).toContain("schema_version_desconhecida");
  });

  it("migra PV zero como caída, mantendo token e sem inventar saldo ou tempo", () => {
    const modelo = normalizarModeloInvocacao(modeloLegado()).dados!;
    const original = tokenLegado();
    const antes = structuredClone(original);
    const resultado = normalizarInstanciaInvocacao(original, modelo);

    expect(resultado.ok).toBe(true);
    expect(resultado.original).toBe(original);
    expect(original).toEqual(antes);
    expect(resultado.dados).toMatchObject({
      id: "legacy-instance-token-1",
      modeloId: "invocacao-1",
      donoCharacterId: "personagem-1",
      tokenId: "token-1",
      estado: "caida",
      hpAtual: 0,
      hpMaximoAtual: 20,
    });
    expect(resultado.dados?.economiaAcoes).toBeUndefined();
    expect(resultado.dados?.contribuicaoTempo).toBeUndefined();
    expect(resultado.avisos.map((item) => item.codigo)).toContain("economia_ausente");
    expect(resultado.avisos.map((item) => item.codigo)).toContain("tempo_instancia_ausente");
  });

  it("marca derrota definitiva no limiar ou abaixo dele e recusa PV acima do máximo", () => {
    const modelo = normalizarModeloInvocacao(modeloLegado()).dados!;
    const derrotaNoLimiar = normalizarInstanciaInvocacao(tokenLegado({ hp: -20 }), modelo);
    expect(derrotaNoLimiar.ok).toBe(true);
    expect(derrotaNoLimiar.dados?.estado).toBe("derrotada");

    const derrotaAbaixoDoLimiar = normalizarInstanciaInvocacao(tokenLegado({ hp: -25 }), modelo);
    expect(derrotaAbaixoDoLimiar.ok).toBe(true);
    expect(derrotaAbaixoDoLimiar.dados).toMatchObject({ estado: "derrotada", hpAtual: -25 });

    const acimaDoMaximo = normalizarInstanciaInvocacao(tokenLegado({ hp: 21 }), modelo);
    expect(acimaDoMaximo.ok).toBe(false);
    expect(acimaDoMaximo.original).toMatchObject({ id: "token-1", hp: 21 });
    expect(acimaDoMaximo.avisos.map((item) => item.codigo)).toContain("pv_instancia_acima_do_maximo");
  });

  it("não interpreta versão futura de instância como registro legado", () => {
    const modelo = normalizarModeloInvocacao(modeloLegado()).dados!;
    const futura = tokenLegado({ schemaVersion: 99 });
    const resultado = normalizarInstanciaInvocacao(futura, modelo);

    expect(resultado.ok).toBe(false);
    expect(resultado.original).toBe(futura);
    expect(resultado.avisos.map((item) => item.codigo)).toContain("schema_version_desconhecida");
  });

  it("rejeita instância atual ligada a outro modelo ou dono", () => {
    const modelo = normalizarModeloInvocacao(modeloLegado()).dados!;
    const atual = {
      schemaVersion: 1,
      version: 1,
      id: "instance-atual",
      modeloId: "outro-modelo",
      donoCharacterId: "personagem-1",
      tokenId: "token-atual",
      estado: "ativa",
      hpAtual: 10,
      hpMaximoAtual: 20,
    };
    const resultado = normalizarInstanciaInvocacao(atual, modelo);

    expect(resultado.ok).toBe(false);
    expect(resultado.avisos.map((item) => item.codigo)).toContain("modelo_instancia_invalido");

    const donoDivergente = normalizarInstanciaInvocacao({
      ...atual,
      modeloId: modelo.id,
      donoCharacterId: "outro-personagem",
    }, modelo);
    expect(donoDivergente.ok).toBe(false);
    expect(donoDivergente.avisos.map((item) => item.codigo)).toContain("dono_instancia_invalido");
  });

  it("mantém tempo legado só no snapshot para revisão, sem configurar duração", () => {
    const resultado = normalizarModeloInvocacao(modeloLegado({ tempoExtraSegundos: 30 }));

    expect(resultado.ok).toBe(true);
    expect(resultado.dados?.tempoAdicional).toBeUndefined();
    expect(resultado.dados?.snapshotLegado?.tempoExtraSegundos).toBe(30);
    expect(resultado.avisos.map((item) => item.codigo)).toContain("tempo_legado_requer_revisao");
  });

  it("valida o limiar de PV da instância materializada", () => {
    const base = {
      schemaVersion: 1,
      version: 1,
      id: "instance-1",
      modeloId: "invocacao-1",
      donoCharacterId: "personagem-1",
      tokenId: "token-1",
      estado: "ativa",
      hpAtual: 0,
      hpMaximoAtual: 20,
    };
    expect(InstanciaInvocacaoSchema.safeParse(base).success).toBe(false);
    expect(InstanciaInvocacaoSchema.safeParse({
      ...base,
      estado: "derrotada",
      hpAtual: -19,
    }).success).toBe(false);
    expect(InstanciaInvocacaoSchema.safeParse({
      ...base,
      estado: "derrotada",
      hpAtual: -20,
    }).success).toBe(true);
  });

  it("reporta modelos duplicados, tokens duplicados e órfãos sem remover registros", () => {
    const modeloValido = modeloLegado({ id: "modelo-valido" });
    const duplicadoA = modeloLegado({ id: "modelo-duplicado" });
    const duplicadoB = modeloLegado({ id: "modelo-duplicado", nome: "Outro nome" });
    const tokenA = tokenLegado({
      id: "token-duplicado",
      invocationId: "modelo-valido",
      hp: 10,
    });
    const tokenB = tokenLegado({
      id: "token-duplicado",
      invocationId: "modelo-valido",
      hp: 8,
    });
    const orfao = tokenLegado({
      id: "token-orfao",
      invocationId: "modelo-inexistente",
    });
    const catalogoOriginal = [modeloValido, duplicadoA, duplicadoB];
    const tokensOriginais = [tokenA, tokenB, orfao];

    const auditoria = auditarInventarioLegadoInvocacao(catalogoOriginal, tokensOriginais);

    expect(auditoria.originais.catalogo).toBe(catalogoOriginal);
    expect(auditoria.originais.tokens).toBe(tokensOriginais);
    expect(auditoria.modelos).toHaveLength(3);
    expect(auditoria.instancias).toHaveLength(3);
    expect(auditoria.avisos.map((item) => item.codigo)).toContain("id_modelo_duplicado");
    expect(auditoria.avisos.map((item) => item.codigo)).toContain("id_token_duplicado");
    expect(auditoria.avisos.map((item) => item.codigo)).toContain("token_orfao");
    expect(tokensOriginais).toEqual([tokenA, tokenB, orfao]);
  });

  it("confere vínculo entre IDs e dono do modelo e da instância", () => {
    const modelo = normalizarModeloInvocacao(modeloLegado()).dados!;
    const instancia = {
      schemaVersion: 1 as const,
      version: 1,
      id: "instance-1",
      modeloId: "invocacao-1",
      donoCharacterId: "outro-personagem",
      tokenId: "token-1",
      estado: "ativa" as const,
      hpAtual: 10,
      hpMaximoAtual: 20,
    };

    const avisos = validarReferenciasModeloInstancia([modelo], [instancia]);

    expect(avisos.map((item) => item.codigo)).toContain("dono_instancia_divergente");
  });
});
