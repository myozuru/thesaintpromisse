/** Exemplos do Guia OMNI em texto natural — todos compilam (ver omniExemplosNaturais.test.ts). */
export interface ExemploNatural { grupo: string; titulo: string; frase: string; explicacao: string }

export const EXEMPLOS_NATURAIS: ExemploNatural[] = [
  { grupo: 'Ataque', titulo: 'Condição ao acertar corpo a corpo', frase: 'ao acertar cac então aplicar condição condenado por 2 rodadas', explicacao: 'Todo acerto corpo a corpo deixa o alvo Condenado por 2 rodadas. "cac", "corpo a corpo" e "corpo_a_corpo" valem igual.' },
  { grupo: 'Ataque', titulo: 'Sangramento no crítico', frase: 'ao acertar crítico então aplicar sangramento por 2 rodadas', explicacao: 'Só dispara quando o ataque é crítico.' },
  { grupo: 'Ataque', titulo: 'Dano extra à distância', frase: 'ao acertar a distância então causar 1d6 de dano perfurante', explicacao: 'Soma 1d6 perfurante em acertos à distância. Ataques corpo a corpo não disparam.' },
  { grupo: 'Ataque', titulo: 'Duas coisas no mesmo acerto', frase: 'ao acertar crítico então aplicar sangramento por 2 rodadas e causar 2d6 de dano psíquico', explicacao: 'Use "e" para encadear ações no mesmo evento.' },
  { grupo: 'Ataque', titulo: 'Tirar uma condição do alvo', frase: 'ao acertar ataque então remover condenado do alvo', explicacao: 'Remove Condenado do alvo quando acerta.' },
  { grupo: 'Cargas', titulo: 'Ganhar carga ao sofrer dano', frase: 'ao sofrer dano de inimigo então acumular 1 em contador_rancor até treino', explicacao: 'Cada dano de inimigo dá 1 Rancor, com teto igual ao bônus de treinamento.' },
  { grupo: 'Cargas', titulo: 'Carga quando aliado próximo apanha', frase: 'quando aliado até 4.5m sofrer dano de inimigo então acumular 1 em contador_rancor até treino por_aliado teto_aliado 1 por rodada', explicacao: 'Aliado a até 4,5m sofre dano → +1 Rancor. Cada aliado só gera 1 carga por rodada.' },
  { grupo: 'Cargas', titulo: 'Dano por carga', frase: 'ao acertar corpo_a_corpo então causar 1d4 de dano psíquico por contador_rancor', explicacao: 'Com 3 cargas causa 3d4. Escrevendo 2d6, cada carga vale 2d6.' },
  { grupo: 'Cargas', titulo: 'Gastar todas as cargas', frase: 'ao acertar ataque então gastar tudo contador_rancor', explicacao: 'Zera o Rancor ao acertar.' },
  { grupo: 'Turno', titulo: 'Regenerar vida', frase: 'ao iniciar turno então curar 1d6 de vida em usuario', explicacao: 'No começo de cada turno, cura 1d6 de vida de quem tem a passiva.' },
  { grupo: 'Turno', titulo: 'Recuperar energia', frase: 'ao iniciar turno então recuperar 1 de pe em usuario', explicacao: 'No começo de cada turno, recupera 1 PE.' },
];