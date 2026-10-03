/**
 * Validação Zod do pacote Omni importado.
 * Defesa contra JSON corrompido / vindo de outro sistema.
 */
import { z } from 'zod';
import { DAMAGE_TYPES } from '@/types';
const DamageTypeSchema = z.enum(DAMAGE_TYPES);

const ValorDinamicoSchema = z.union([
  z.object({ tipo: z.literal('fixo'), valor: z.number() }),
  z.object({ tipo: z.literal('formula'), expressao: z.string() }),
]);

const RefSchema = z.object({
  alvo: z.enum(['USUARIO', 'ALVO', 'CENA']),
  caminho: z.string(),
});

const OperandoSchema = z.union([
  z.object({ tipo: z.literal('ref'), ref: RefSchema }),
  z.object({ tipo: z.literal('fixo'), valor: z.number() }),
  z.object({ tipo: z.literal('condicao'), condicao: z.string() }),
  z.object({ tipo: z.literal('formula'), expressao: z.string() }),
]);

const CondicaoLogicaSchema = z.object({
  id: z.string(),
  esquerdo: OperandoSchema,
  operador: z.string(),
  direito: OperandoSchema,
});

const AcaoLogicaSchema = z.object({
  id: z.string(),
  acao: z.string(),
  alvoAplicacao: z.enum(['USUARIO', 'ALVO', 'CENA']),
  caminhoAlvo: z.string().optional(),
  valor: ValorDinamicoSchema.optional(),
  condicao: z.string().optional(),
  duracao: z
    .object({
      tipo: z.string(),
      valor: ValorDinamicoSchema.optional(),
    })
    .optional(),
});

const BlocoLogicoSchema = z.object({
  id: z.string(),
  condicoes: z.array(CondicaoLogicaSchema),
  modo: z.enum(['todas', 'qualquer']),
  acoes: z.array(AcaoLogicaSchema),
});

const GatilhoSchema = z.object({
  id: z.string(),
  evento: z.string(),
  blocos: z.array(BlocoLogicoSchema),
});

const OperadorEstadoSchema = z.enum(['<', '<=', '==', '!=', '>=', '>']);
const comparacao = { operador: OperadorEstadoSchema, valor: z.number().finite() };
const PredicadoEstadoSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('tem_condicao'), nome: z.string().min(1) }),
  z.object({ tipo: z.literal('rodadas_condicao'), nome: z.string().min(1), ...comparacao }),
  z.object({ tipo: z.literal('cargas'), nome: z.string().min(1), ...comparacao }),
  z.object({ tipo: z.literal('distancia'), ...comparacao }),
  z.object({ tipo: z.literal('pv_percentual'), ...comparacao }),
]);
const CondicionalAtivoSchema = z.object({
  id: z.string(), se_alvo: z.array(PredicadoEstadoSchema).optional(), se_usuario: z.array(PredicadoEstadoSchema).optional(),
  margem_critico_mod: z.number().finite().optional(), multiplicador_critico_mod: z.number().finite().optional(),
  dano_extra: z.string().optional(), mod_tr_alvo: z.number().finite().optional(),
  desvantagem_tr_alvo: z.boolean().optional(), vantagem_acerto: z.boolean().optional(),
});
const EfeitoSecundarioSchema = z.union([
  z.object({ tipo: z.literal('remover_condicao'), condicao: z.string().min(1) }),
  z.object({ tipo: z.enum(['pv_temporarios', 'escudo']), valor: z.string().min(1), rodadas: z.number().finite().int().nonnegative() }),
  z.object({ tipo: z.literal('condicao'), condicao: z.string(), rodadas: z.number().finite() }),
  z.object({ tipo: z.enum(['puxar', 'empurrar']), metros: z.number().finite() }),
  z.object({ tipo: z.literal('movimento'), movimento_tipo: z.enum(['puxar', 'empurrar', 'avancar_ate', 'teleporte', 'trocar_posicao']), movimento_distancia: z.string(), movimento_alvo: z.enum(['usuario', 'alvo']).optional() }),
]);
const DesfechoTRSchema = z.object({
  dano: z.enum(['total', 'metade', 'nenhum']).optional(), dano_extra: z.string().optional(),
  dano_maximizado: z.boolean().optional(), multiplicador_duracao: z.number().finite().positive().optional(),
  efeitos: z.array(EfeitoSecundarioSchema).optional(),
});
const AcaoAtivaSchema = z.object({
  tipo_efeito: z.enum(['dano', 'cura', 'buff']).optional(),
  cura: z.string().optional(), recurso_cura: z.enum(['pv', 'pe']).optional(),
  desfechosTR: z.object({ falha: DesfechoTRSchema.optional(), sucesso: DesfechoTRSchema.optional(), falha_critica: DesfechoTRSchema.optional() }).optional(),
  reacao: z.object({
    gatilho: z.enum(['quando_inimigo_entrar_alcance', 'quando_inimigo_sair_alcance', 'quando_alvo_declarar_ataque', 'quando_ataque_errar', 'quando_inimigo_conjurar']),
    alcance_m: z.number().finite().positive(), protegido: z.enum(['usuario', 'aliados', 'todos']),
    alvo: z.enum(['origem', 'protegido', 'usuario']), cancelar_evento: z.boolean().optional(), defesa_bonus: z.number().finite().nonnegative().optional(),
  }).optional(),
  id: z.string(), nome: z.string(), acao: z.enum(['comum', 'bonus', 'reacao', 'livre']),
  custo_recursos: z.object({
    pe_base: z.string().optional(), pe_por_intensificacao: z.string().optional(),
    max_intensificacoes: z.string().optional(), limite_pe: z.string().optional(),
    dano_por_intensificacao: z.string().optional(), custo_pv: z.string().optional(),
    municao: z.number().int().nonnegative().optional(), usos_item: z.number().int().nonnegative().optional(),
    gastar_cargas: z.object({ nome: z.string().trim().min(1), quantidade: z.string().min(1), minimo: z.number().int().positive().optional() }).optional(),
    tipo_acao: z.enum(['comum', 'bonus', 'reacao', 'livre', 'sustentada']).optional(), pe_por_turno: z.string().optional(),
  }).optional(),
  mod_acerto: z.number().finite().optional(),
  custoPE: z.string(), alcanceM: z.number().finite().nonnegative(), teste: z.enum(['tr', 'ataque', 'disputa', 'nenhum']),
  pericia_usuario: z.string().optional(), pericias_alvo: z.array(z.string()).optional(),
  tipo_alvo: z.enum(['unico', 'multiplo', 'area', 'proprio']).optional(),
  filtro_alvo: z.enum(['inimigos', 'aliados', 'todos', 'todos_exceto_si']).optional(), max_alvos: z.string().optional(),
  area: z.object({ forma: z.enum(['cone', 'linha', 'raio_em_si', 'raio_no_ponto']), tamanho_m: z.number().finite().positive(), largura_m: z.number().finite().positive().optional() }).optional(),
  tr: z.enum(['astucia', 'fortitude', 'integridade', 'reflexos', 'vontade']).optional(), cd: z.string().optional(),
  metadeNoSucesso: z.boolean().optional(), dano: z.string().optional(), dadosPorCarga: z.string().optional(),
  tipoDano: z.string().optional(), incluirArma: z.boolean().optional(),
  consumirContador: z.object({ nome: z.string(), minimo: z.number().finite() }).optional(),
  margemCritico: z.object({ condicao: z.string(), reducao: z.number().finite() }).optional(),
  efeitos: z.array(EfeitoSecundarioSchema).optional(),
  condicionais: z.array(CondicionalAtivoSchema).optional(),
});

const EntidadeSchema = z.object({
  id: z.string(),
  versao: z.literal(1),
  nome: z.string(),
  categoria: z.enum(['item', 'arma', 'feitico', 'talento', 'aura', 'passiva', 'condicao', 'voto']),
  descricao: z.string(),
  icone: z.string().optional(),
  tags: z.array(z.string()),
  duracao: z.object({
    tipo: z.string(),
    valor: ValorDinamicoSchema.optional(),
  }),
  custos: z.array(z.object({
    caminhoRecurso: z.string(),
    valor: ValorDinamicoSchema,
  })),
  alcance: ValorDinamicoSchema.optional(),
  areaRaio: ValorDinamicoSchema.optional(),
  gatilhos: z.array(GatilhoSchema),
  slotType: z.string().optional(),
  bonusEquipado: z.object({
    hp: z.number().finite().optional(), pe: z.number().finite().optional(), ca: z.number().finite().optional(),
    rd: z.number().finite().optional(), esc: z.number().finite().optional(), slots: z.number().finite().optional(),
    pericias: z.record(z.string(), z.number().finite()).optional(),
    trs: z.object({ astucia: z.number().finite().optional(), fortitude: z.number().finite().optional(), integridade: z.number().finite().optional(), reflexos: z.number().finite().optional(), vontade: z.number().finite().optional() }).optional(),
  }).optional(),
  bonusEquipadoFormula: z.object({
    hp: z.string().optional(), pe: z.string().optional(), ca: z.string().optional(), rd: z.string().optional(), esc: z.string().optional(), slots: z.string().optional(),
  }).optional(),
  resistencias: z.array(DamageTypeSchema).optional(),
  vulnerabilidades: z.array(DamageTypeSchema).optional(),
  imunidades_dano: z.array(DamageTypeSchema).optional(),
  acoesAtivas: z.array(AcaoAtivaSchema).optional(),
  comercio: z
    .object({
      basePrice: z.number(),
      hiddenTags: z.array(z.string()),
      isBought: z.boolean(),
    })
    .optional(),
  criadoEm: z.number(),
  atualizadoEm: z.number(),
});

export const PacoteOmniSchema = z.object({
  formato: z.literal('omni-engine.v1'),
  nome: z.string(),
  autor: z.string().optional(),
  geradoEm: z.number(),
  entidades: z.array(EntidadeSchema),
});

export type PacoteOmniValidado = z.infer<typeof PacoteOmniSchema>;
