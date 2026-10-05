/** Contexto explícito da linguagem natural. Não escolhe fichas ou tokens por nome. */
export type PapelNatural = 'usuario' | 'alvo' | 'atacante' | 'vitima';
export interface ParticipanteNatural { fichaId: string; tokenId?: string }
export interface ContextoNatural {
  execucaoId: string;
  participantes: Partial<Record<PapelNatural, ParticipanteNatural>> & { usuario: ParticipanteNatural };
  origem?: { habilidadeId: string; itemId?: string; armaId?: string };
  cargasGastas: Readonly<Record<string, number>>;
}
export interface DiagnosticoContextoNatural {
  codigo: 'PAPEL_AUSENTE' | 'FICHA_AUSENTE' | 'TOKEN_AUSENTE' | 'TOKEN_AMBIGUO' | 'TOKEN_DIVERGENTE' | 'IDENTIDADE_INVALIDA' | 'CONTADOR_INVALIDO';
  mensagem: string;
}
export type ResultadoContextoNatural<T> = { ok: true; valor: T } | { ok: false; erro: DiagnosticoContextoNatural };
const falhar = (codigo: DiagnosticoContextoNatural['codigo'], mensagem: string): ResultadoContextoNatural<never> => ({ ok: false, erro: { codigo, mensagem } });

export function criarContextoNatural(
  execucaoId: string,
  participantes: ContextoNatural['participantes'],
  origem?: ContextoNatural['origem'],
): ResultadoContextoNatural<ContextoNatural> {
  if (!execucaoId.trim() || !participantes.usuario?.fichaId?.trim()) return falhar('IDENTIDADE_INVALIDA', 'Execução e usuário exigem IDs persistentes.');
  for (const p of Object.values(participantes)) {
    if (p && (!p.fichaId.trim() || p.tokenId !== undefined && !p.tokenId.trim())) return falhar('IDENTIDADE_INVALIDA', 'Participante contém ID vazio.');
  }
  if (origem && (!origem.habilidadeId.trim() || origem.itemId !== undefined && !origem.itemId.trim() || origem.armaId !== undefined && !origem.armaId.trim())) return falhar('IDENTIDADE_INVALIDA', 'A origem exige IDs persistentes válidos.');
  return { ok: true, valor: {
    execucaoId,
    participantes: Object.fromEntries(Object.entries(participantes).filter(([, p]) => p).map(([papel, p]) => [papel, { ...p }])) as ContextoNatural['participantes'],
    ...(origem ? { origem: { ...origem } } : {}),
    cargasGastas: {},
  } };
}

/** Sem requisito espacial, ficha sem token é válida. Com requisito, token é explícito. */
export function resolverParticipanteNatural(
  contexto: ContextoNatural,
  papel: PapelNatural,
  fichas: readonly { id: string }[],
  tokens: readonly { id: string; fichaId: string }[],
  exigirToken = false,
): ResultadoContextoNatural<ParticipanteNatural> {
  const p = contexto.participantes[papel];
  if (!p) return falhar('PAPEL_AUSENTE', `O contexto não identifica ${papel}.`);
  if (!fichas.some(f => f.id === p.fichaId)) return falhar('FICHA_AUSENTE', `A ficha de ${papel} não existe.`);
  if (p.tokenId !== undefined) {
    const token = tokens.find(t => t.id === p.tokenId);
    if (!token) return falhar('TOKEN_AUSENTE', `O token de ${papel} não existe.`);
    if (token.fichaId !== p.fichaId) return falhar('TOKEN_DIVERGENTE', `O token de ${papel} pertence a outra ficha.`);
  } else if (exigirToken) {
    if (tokens.filter(t => t.fichaId === p.fichaId).length > 1) return falhar('TOKEN_AMBIGUO', `Selecione qual token representa ${papel} nesta execução.`);
    return falhar('TOKEN_AUSENTE', `A consulta espacial exige o token explícito de ${papel}.`);
  }
  return { ok: true, valor: { ...p } };
}

/** A relação é fornecida pelo adaptador de cena; categoria PLAYER/NPC não a substitui. */
export function outroAliadoNatural(usuarioId: string, candidatoId: string, relacao: 'aliado' | 'inimigo' | 'neutro' | undefined): boolean {
  return Boolean(usuarioId && candidatoId && usuarioId !== candidatoId && relacao === 'aliado');
}

/** Apenas registra gasto já confirmado; não realiza cobrança nem reinicia limites. */
export function registrarGastoNatural(contexto: ContextoNatural, contador: string, quantidade: number): ResultadoContextoNatural<ContextoNatural> {
  if (!/^contador_[a-z0-9_]+$/.test(contador) || !Number.isSafeInteger(quantidade) || quantidade < 0) return falhar('CONTADOR_INVALIDO', 'Gasto exige contador nominal e quantidade inteira não negativa.');
  const total = (contexto.cargasGastas[contador] ?? 0) + quantidade;
  if (!Number.isSafeInteger(total)) return falhar('CONTADOR_INVALIDO', 'Total gasto excede o intervalo seguro.');
  return { ok: true, valor: { ...contexto, cargasGastas: { ...contexto.cargasGastas, [contador]: total } } };
}
