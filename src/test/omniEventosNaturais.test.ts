import { describe, expect, it } from "vitest";
import {
  eventosDaFraseNatural,
  mapearAtomoEventoNatural,
} from "@/lib/omni/eventosNaturais";
import { analisarFraseNatural } from "@/lib/omni/gramaticaNatural";

function compilarEventos(source: string) {
  const parsed = analisarFraseNatural(source);
  expect(parsed.erros).toEqual([]);
  expect(parsed.ast).toBeDefined();
  return eventosDaFraseNatural(parsed.ast!);
}

describe("mapeamento de eventos da sintaxe natural OMNI", () => {
  it("preserva vítima, agressor e raio em dano a aliado", () => {
    expect(
      compilarEventos(
        "quando aliado até 4.5m sofrer dano de inimigo então acumular 1 contador_rancor",
      ),
    ).toMatchObject({
      ok: true,
      eventos: [
        {
          evento: "aoAliadoSofrerDano",
          filtros: {
            sujeito: "outro_aliado",
            agressor: "inimigo",
            raioMetros: 4.5,
          },
        },
      ],
    });
  });

  it("não conta o portador como aliado e filtra dano recebido pelo usuário", () => {
    expect(mapearAtomoEventoNatural("ao sofrer dano de inimigo")).toMatchObject(
      {
        evento: "aoSofrerDano",
        filtros: { sujeito: "usuario", agressor: "inimigo" },
      },
    );
    expect(mapearAtomoEventoNatural("quando aliado sofrer dano")).toMatchObject(
      {
        evento: "aoAliadoSofrerDano",
        filtros: { sujeito: "outro_aliado" },
      },
    );
  });

  it("mantém filtros de crítico e categoria do ataque", () => {
    expect(
      mapearAtomoEventoNatural("ao acertar crítico corpo_a_corpo"),
    ).toMatchObject({
      evento: "aoAcertarAtaque",
      filtros: { acerto: "critico", tipoAtaque: "corpo_a_corpo" },
    });
    expect(mapearAtomoEventoNatural("ao errar a_distancia")).toMatchObject({
      evento: "aoErrarAtaque",
      filtros: { tipoAtaque: "a_distancia" },
    });
  });

  it.each([
    ["ao iniciar combate", "aoIniciarCombate"],
    ["no início do turno", "noInicioDoTurno"],
    ["ao finalizar rodada de combate", "aoFinalizarRodadaCombate"],
  ])(
    "resolve variação natural do gatilho %s para o ID existente",
    (source, event) => {
      expect(mapearAtomoEventoNatural(source)?.evento).toBe(event);
    },
  );

  it("deduplica seletores iguais na mesma condição sem prometer idempotência de execução", () => {
    expect(
      compilarEventos(
        "ao acertar e ao acertar então causar 1d4 de dano psiquico",
      ),
    ).toMatchObject({
      ok: true,
      eventos: [{ evento: "aoAcertarAtaque" }],
    });
  });

  it("não converte estados em eventos", () => {
    expect(
      compilarEventos("se alvo_caido então causar 1d4 de dano impactante"),
    ).toEqual({ ok: true, eventos: [] });
  });

  it("rejeita eventos sem mapeamento seguro com intervalo da fonte", () => {
    const result = compilarEventos("ao abater inimigo então recuperar 1 pe");
    expect(result).toMatchObject({
      ok: false,
      erros: [
        {
          codigo: "EVENTO_NAO_SUPORTADO",
          mensagem: expect.stringContaining("ao abater inimigo"),
          inicio: 0,
        },
      ],
    });
  });
});
