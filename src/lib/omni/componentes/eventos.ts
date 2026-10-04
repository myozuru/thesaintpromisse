import type { Character } from '@/types';
import { CODIGOS_FONTE_DANO, CODIGOS_TIPO_DANO } from '../contextoDano';
import type { DadoComposto, DadosComposicao } from './avaliar';

export function registrarHistorico(counters: Record<string, number> | undefined, tipo: 'cura' | 'dano', valor: number, rodada: number, temporario = 0): Record<string, number> {
  const out = { ...counters };
  if (out.__omni_rodada !== rodada) {
    out.cura_recebida_nesta_rodada = 0;
    out.dano_recebido_nesta_rodada = 0;
    out.vida_perdida_nesta_rodada = 0;
  }
  out.__omni_rodada = rodada;
  const quantidade = Number.isFinite(valor) ? Math.max(0, valor) : 0;
  if (tipo === 'cura') {
    out.cura_recebida = quantidade;
    out.cura_recebida_nesta_rodada += quantidade;
  } else {
    out.ultimo_dano_recebido = quantidade;
    out.dano_recebido_nesta_rodada += quantidade;
    out.ultimo_dano_temporario = Math.max(0, temporario);
    out.vida_perdida_nesta_rodada += Math.max(0, quantidade - temporario);
  }
  return out;
}

export function dadosHistorico(c: Character, rodada: number): DadosComposicao {
  const cs = c.omniCounters ?? {}, atual = cs.__omni_rodada === undefined || cs.__omni_rodada === rodada;
  const nomes = [...new Set(Object.keys(cs).map(k => k.split('__fonte__')[0]))];
  const contador = Object.fromEntries(nomes.map(nome => [nome, { valor: cs[nome] ?? 0, campos: {
    fonte: { registros: Object.fromEntries(Object.entries(cs).filter(([k]) => k.startsWith(`${nome}__fonte__`)).map(([k, v]) => [k.slice(nome.length + 9), v])) },
  } }]));
  return { selecoes: {
    contador: { registros: contador, padrao: { valor: 0, existe: false, campos: { fonte: { registros: {}, padrao: 0 } } } },
    cura: { campos: { recebida: { valor: cs.cura_recebida ?? 0, campos: { rodada: atual ? cs.cura_recebida_nesta_rodada ?? 0 : 0 } } } },
    dano: { campos: { recebido: { valor: cs.ultimo_dano_recebido ?? 0, campos: { rodada: atual ? cs.dano_recebido_nesta_rodada ?? 0 : 0 } } } },
  } };
}

export function dadosEventoDano(bag: Record<string, number>): DadosComposicao {
  const n = (k: string) => bag[`DANO_${k}`];
  const campos: Record<string, DadoComposto> = {};
  for (const [componente, legado] of Object.entries({ base: 'VALOR_BASE', inicial: 'VALOR_INICIAL', bruto: 'VALOR_BRUTO', final: 'VALOR_FINAL', absorvido: 'ABSORVIDO', distancia: 'DISTANCIA' })) if (n(legado) !== undefined) campos[componente] = n(legado);
  campos.tipo = { valor: n('TIPO'), registros: Object.fromEntries(Object.entries(CODIGOS_TIPO_DANO).map(([k, v]) => [k, v === n('TIPO')])), campos: { ataque: n('TIPO_ATAQUE') } };
  if (n('FONTE') !== undefined) campos.fonte = { valor: n('FONTE'), registros: Object.fromEntries(Object.entries(CODIGOS_FONTE_DANO).map(([k, v]) => [k, v === n('FONTE')])) };
  const foiCampos: Record<string, DadoComposto> = {};
  for (const [k, legado] of Object.entries({ critico: 'FOI_CRITICO', falha_critica: 'FOI_FALHA_CRITICA', furtivo: 'FOI_FURTIVO', oportunidade: 'FOI_ATAQUE_OPORTUNIDADE' })) if (n(legado) !== undefined) foiCampos[k] = n(legado);
  campos.foi = { campos: { ...foiCampos, ataque: { campos: foiCampos } } };
  return { selecoes: { dano: { campos }, foi: { campos: { ...foiCampos, dano: { campos: foiCampos }, ataque: { campos: foiCampos } } },
    distancia: { campos: { ataque: n('ALCANCE') } },
    atacante: n('ID_ORIGEM') === undefined ? undefined : Boolean(n('ID_ORIGEM')),
    alvo: n('ID_ALVO') === undefined ? undefined : Boolean(n('ID_ALVO')) } };
}
