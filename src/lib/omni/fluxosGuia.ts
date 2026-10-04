import type { AcaoAtivaConfig } from "./tipos";

/** Configurações do construtor, distintas de trechos do terminal. */
export const FLUXOS_ACOES_GUIA: {
  titulo: string;
  comoFunciona: string;
  acao: AcaoAtivaConfig;
}[] = [
  {
    titulo: "Golpe com arma e acerto",
    comoFunciona:
      "Selecione uma arma empunhada. Ao usar, escolha um inimigo a até 1,5 m; o motor testa ataque contra Defesa. Erro não aplica dano. Acerto combina o dano da arma com 2d8 + o modificador de Força. O custo é 10 PE e uma ação comum. Força é atributo; o tipo adicional é Cortante.",
    acao: {
      id: "guia-golpe",
      nome: "Golpe com arma",
      acao: "comum",
      custoPE: "10",
      alcanceM: 1.5,
      tipo_alvo: "unico",
      filtro_alvo: "inimigos",
      teste: "ataque",
      incluirArma: true,
      dano: "2d8 + @USUARIO.for",
      tipoDano: "DCO",
    },
  },
  {
    titulo: "Curar até três aliados",
    comoFunciona:
      "Ação comum de 4 PE, alcance 4,5 m e filtro Aliados. Configure alvo Múltiplo com máximo 3, efeito Cura e recurso PV. Cada aliado selecionado recebe 2d8, limitado à sua Vida Máxima; a ação não faz teste de ataque. Não use subtrair em vida para representar cura.",
    acao: {
      id: "guia-cura",
      nome: "Socorro coletivo",
      acao: "comum",
      custoPE: "4",
      alcanceM: 4.5,
      tipo_alvo: "multiplo",
      max_alvos: "3",
      filtro_alvo: "aliados",
      teste: "nenhum",
      tipo_efeito: "cura",
      recurso_cura: "pv",
      cura: "2d8",
    },
  },
  {
    titulo: "Explosão com resistência",
    comoFunciona:
      "Configure uma área de cone de 6 m, filtro Inimigos, 3 PE e TR Reflexos CD 14. Dano bruto 3d6 de Fogo: falha aplica total; sucesso aplica metade. A resistência é d20 + o modificador do alvo. O construtor resolve os desfechos, depois o motor aplica mitigação ao dano correspondente.",
    acao: {
      id: "guia-cone",
      nome: "Sopro de fogo",
      acao: "comum",
      custoPE: "3",
      alcanceM: 6,
      tipo_alvo: "area",
      filtro_alvo: "inimigos",
      area: { forma: "cone", tamanho_m: 6 },
      teste: "tr",
      tr: "reflexos",
      cd: "14",
      dano: "3d6",
      tipoDano: "DQ",
      desfechosTR: { falha: { dano: "total" }, sucesso: { dano: "metade" } },
    },
  },
  {
    titulo: "Derrubar com perícias opostas",
    comoFunciona:
      "Configure Disputa: Atletismo do usuário contra Atletismo ou Acrobacia do alvo, alcance 1,5 m e filtro Inimigos. Sem PE e com ação comum. Vitória aplica Caído por uma rodada e não causa dano. Empate favorece o defensor. A comparação é entre resultados rolados, não apenas bônus de ficha.",
    acao: {
      id: "guia-disputa",
      nome: "Derrubar",
      acao: "comum",
      custoPE: "0",
      alcanceM: 1.5,
      tipo_alvo: "unico",
      filtro_alvo: "inimigos",
      teste: "disputa",
      pericia_usuario: "atletismo",
      pericias_alvo: ["atletismo", "acrobacia"],
      dano: "0",
      efeitos: [{ tipo: "condicao", condicao: "caido", rodadas: 1 }],
    },
  },
];
