import { parseOmniScript, type OmniScriptParseOpts, type OmniScriptResultado } from './omniScript';
import { analisarFraseNatural, type FraseNatural, type ErroGramaticaNatural } from './gramaticaNatural';

export const FORMATO_DOCUMENTO_OMNI = 'omni.script' as const;
export type VersaoDocumentoOmni = 1 | 2;
export interface DocumentoScriptOmni {
  formato: typeof FORMATO_DOCUMENTO_OMNI;
  versao: VersaoDocumentoOmni;
  /** Fonte é preservada literalmente. Migração não reescreve nem reordena o script. */
  fonte: string;
}
export interface DiagnosticoDocumentoOmni { codigo: string; mensagem: string; inicio?: number; fim?: number }
export type ResultadoLeituraScriptOmni =
  | { ok:true; documento: DocumentoScriptOmni; linguagem:'legada'; executavel:boolean; parse:OmniScriptResultado; diagnosticos: DiagnosticoDocumentoOmni[] }
  | { ok:true; documento: DocumentoScriptOmni; linguagem:'natural'; executavel:false; ast?:FraseNatural; diagnosticos:DiagnosticoDocumentoOmni[] }
  | { ok:false; diagnosticos:DiagnosticoDocumentoOmni[] };

/** Encapsula um script antigo sem mudar um único caractere nem inferir sintaxe nova. */
export function migrarScriptLegadoOmni(fonte: string): DocumentoScriptOmni {
  return { formato: FORMATO_DOCUMENTO_OMNI, versao: 1, fonte };
}

/** Para registros sem versão, a regra é retrocompatível: são scripts legados. */
export function normalizarDocumentoOmni(valor: string | DocumentoScriptOmni): ResultadoLeituraScriptOmni {
  const documento = typeof valor === 'string' ? migrarScriptLegadoOmni(valor) : valor;
  if (!documento || documento.formato !== FORMATO_DOCUMENTO_OMNI || typeof documento.fonte !== 'string') {
    return { ok:false, diagnosticos:[{ codigo:'DOCUMENTO_INVALIDO', mensagem:'Documento OMNI inválido; a fonte foi mantida sem migração automática.' }] };
  }
  if (documento.versao === 1) {
    const parse = parseOmniScript(documento.fonte);
    return { ok:true, documento:{ ...documento }, linguagem:'legada', executavel:parse.erros.length === 0, parse,
      diagnosticos:parse.erros.map(e => ({ codigo:'LEGADO_NAO_INTERPRETADO', mensagem:e.mensagem, inicio:e.posicao, fim:e.posicao + e.trecho.length })) };
  }
  if (documento.versao === 2) {
    const resultado = analisarFraseNatural(documento.fonte);
    return { ok:true, documento:{ ...documento }, linguagem:'natural', executavel:false, ast:resultado.ast,
      diagnosticos:resultado.erros.map(e => ({ codigo:'NATURAL_INVALIDO', mensagem:e.mensagem, inicio:e.inicio, fim:e.fim })) };
  }
  return { ok:false, diagnosticos:[{ codigo:'VERSAO_DESCONHECIDA', mensagem:'Versão de script OMNI não reconhecida; a fonte original deve permanecer intacta.' }] };
}

/** Escreve dados de novo sem trocar versão nem fonte; usado ao abrir/salvar editor. */
export function preservarDocumentoOmni(valor: string | DocumentoScriptOmni): DocumentoScriptOmni | undefined {
  const leitura = normalizarDocumentoOmni(valor);
  return leitura.ok ? { ...leitura.documento } : undefined;
}

/** Chamada explícita do runtime legado; documentos naturais não podem cair no parser antigo. */
export function executarParseLegadoOmni(documento: DocumentoScriptOmni, opcoes?: OmniScriptParseOpts): OmniScriptResultado | DiagnosticoDocumentoOmni {
  if (documento.formato !== FORMATO_DOCUMENTO_OMNI || documento.versao !== 1) {
    return { codigo:'LINGUAGEM_NAO_EXECUTAVEL', mensagem:'Somente documento OMNI versão 1 pode ser enviado ao executor legado.' };
  }
  return parseOmniScript(documento.fonte, opcoes);
}
