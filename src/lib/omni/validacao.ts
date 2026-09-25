/**
 * Validação Zod do pacote Omni importado.
 * Defesa contra JSON corrompido / vindo de outro sistema.
 */
import { z } from 'zod';

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
