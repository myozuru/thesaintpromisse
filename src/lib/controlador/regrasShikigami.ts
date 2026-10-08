/** Regras-base retiradas de docs/regras/invocacoes_texto_original_2026-10-08.txt
 * Referência: "CLASSIFICAÇÃO", "DEFININDO OS ATRIBUTOS", "VIDA E DEFESA"
 * e "DESLOCAMENTO". O texto original não é modificado por estes cálculos.
 */
export const GRAUS_SHIKIGAMI = ['quarto','terceiro','segundo','primeiro','especial'] as const;
export type GrauShikigami = typeof GRAUS_SHIKIGAMI[number];
export const ATRIBUTOS_SHIKIGAMI = ['forca','destreza','constituicao','inteligencia','sabedoria','presenca'] as const;
export type AtributoShikigami = typeof ATRIBUTOS_SHIKIGAMI[number];
export type AtributosShikigami = Record<AtributoShikigami, number>;
const TABELA: Record<GrauShikigami,{ nivel: number; pontos: number; maximo: number; custo: number; pvBase: number; defesaBase: number; constInteira: boolean; fatorNivel: number }> = {
  quarto: { nivel: 1, pontos: 10, maximo: 16, custo: 2, pvBase: 10, defesaBase: 10, constInteira: false, fatorNivel: 1 },
  terceiro: { nivel: 5, pontos: 15, maximo: 20, custo: 4, pvBase: 25, defesaBase: 12, constInteira: false, fatorNivel: 1 },
  segundo: { nivel: 9, pontos: 20, maximo: 24, custo: 6, pvBase: 40, defesaBase: 16, constInteira: true, fatorNivel: 1 },
  primeiro: { nivel: 13, pontos: 30, maximo: 26, custo: 8, pvBase: 60, defesaBase: 20, constInteira: true, fatorNivel: 1.5 },
  especial: { nivel: 17, pontos: 40, maximo: 30, custo: 12, pvBase: 80, defesaBase: 24, constInteira: true, fatorNivel: 2 },
};
export function regrasGrau(grau: GrauShikigami){return TABELA[grau];}
export function grausDisponiveis(nivel: number): GrauShikigami[] {
  return GRAUS_SHIKIGAMI.filter(g=>nivel>=TABELA[g].nivel);
}
export function atributosIniciaisShikigami(): AtributosShikigami {
  return {forca:8,destreza:8,constituicao:8,inteligencia:8,sabedoria:8,presenca:8};
}
export function pontosRestantesShikigami(grau:GrauShikigami,atributos:AtributosShikigami):number {
  return TABELA[grau].pontos-ATRIBUTOS_SHIKIGAMI.reduce((acc,k)=>acc+(atributos[k]-8),0);
}
export function validarAtributosShikigami(grau:GrauShikigami,atributos:AtributosShikigami):string|null {
  for(const k of ATRIBUTOS_SHIKIGAMI) if(!Number.isInteger(atributos[k])||atributos[k]<6||atributos[k]>TABELA[grau].maximo)
    return 'Os atributos precisam estar entre 6 e '+TABELA[grau].maximo+'.';
  const pontos=pontosRestantesShikigami(grau,atributos);
  return pontos<0?'Pontos de atributos excedidos.':pontos>0?'Distribua todos os pontos disponíveis.':null;
}
export function valoresShikigami(grau:GrauShikigami,atributos:AtributosShikigami,nivel:number,treino:number){
  const r=TABELA[grau];
  const con=r.constInteira?atributos.constituicao:Math.floor(atributos.constituicao/2);
  const pv=Math.floor(r.pvBase+con+r.fatorNivel*nivel);
  const modDes=Math.floor((atributos.destreza-10)/2);
  return {pv,defesa:r.defesaBase+modDes+treino,deslocamentoM:9,custoPE:r.custo};
}
/** Livro: duas invocações no primeiro nível e mais uma a cada três níveis. */
export function invocacoesConhecidasPeloLivro(nivel:number):number{
  return 2+Math.floor((Math.max(1,nivel)-1)/3);
}
