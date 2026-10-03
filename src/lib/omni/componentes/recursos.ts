import type { DadoComposto, DadosComposicao, RegistroComposto } from './avaliar';

/** Uma estrutura de recurso serve para vida, PE, sorte e qualquer outro saldo limitado. */
export function recursoComposto(valor: number, maximo: number, campos: Record<string, DadoComposto> = {}): RegistroComposto {
  const faltante = Math.max(0, maximo - valor);
  return { valor, campos: { max: maximo, maximo, maximos: maximo, restante: valor, restantes: valor,
    disponivel: valor > 0, faltante: { valor: faltante, campos: { max: maximo, maximo } }, ...campos } };
}

/** Projeta grandezas da ficha; nenhuma entrada registra uma frase composta como chave. */
export function dadosRecursos(bag: Record<string, number>): DadosComposicao {
  const n = (chave: string) => bag[chave] ?? 0;
  const vida = n('VIDA'), maxVida = n('VIDA_MAX'), pe = n('PE'), maxPE = n('PE_MAX');
  const temporaria = recursoComposto(n('VIDA_TEMP'), n('VIDA_TEMP_MAX'));
  const selecoes: Record<string, DadoComposto> = {
    vida: recursoComposto(vida, maxVida, { temporaria, temporarios: temporaria, total: vida + n('VIDA_TEMP'),
      sacrificada: recursoComposto(n('HP_SACRIFICADO'), maxVida), recuperavel: n('PODE_SER_CURADO') }),
    pe: recursoComposto(pe, maxPE, { temporario: n('PE_TEMP'), temporaria: n('PE_TEMP') }),
    sorte: recursoComposto(n('SORTE'), n('SORTE_MAX')),
    dado_vida: recursoComposto(n('DADO_VIDA'), n('DADO_VIDA_MAX')),
    reserva: { campos: { pe: recursoComposto(n('RESERVA_PE'), n('RESERVA_PE_MAX'), { recuperavel: n('RESERVA_PE_RECUPERAVEL') }) } },
    vigor_maldito: recursoComposto(n('VIGOR_MALDITO_USOS'), n('VIGOR_MALDITO_MAX'), { usos: n('VIGOR_MALDITO_USOS') }),
    slots: { campos: { descanso: { campos: { curto: recursoComposto(n('SLOTS_DESCANSO_CURTO'), n('SLOTS_DESCANSO_CURTO_MAX')) } } } },
    exaustao: { valor: n('EXAUSTAO'), campos: { nivel: n('EXAUSTAO') } },
    fome: { valor: n('FOME'), campos: { nivel: n('FOME') } },
    atributo: { campos: {} }, pericia: { campos: {} }, tr: { campos: {} },
  };
  const atributos: Record<string, DadoComposto> = {};
  for (const k of ['for', 'des', 'con', 'int', 'sab', 'pre']) { atributos[k] = n(k.toUpperCase()); selecoes[k] = atributos[k]; }
  selecoes.atributo = { campos: atributos };
  const pericias: Record<string, DadoComposto> = {};
  for (const [k, v] of Object.entries(bag)) if (k.startsWith('PERICIA_')) { pericias[k.slice(8).toLowerCase()] = v; }
  selecoes.pericia = { campos: pericias };
  const trs: Record<string, DadoComposto> = {};
  for (const k of ['fortitude', 'reflexos', 'integridade', 'astucia', 'vontade']) { trs[k] = n(k.toUpperCase()); selecoes[k] = trs[k]; }
  selecoes.tr = { campos: trs };
  for (const [componente, origem] of Object.entries({ treino: 'TREINO', nivel: 'NIVEL', morto: 'MORTO', morrendo: 'MORRENDO', inconsciente: 'INCONSCIENTE', tamanho: 'TAMANHO', categoria: 'CATEGORIA' })) selecoes[componente] = n(origem);
  return { selecoes };
}
