import { z } from 'zod';

const idSchema = z.string().trim().min(1).max(128);
const choiceSchema = z.object({
  optionId: idSchema,
  selectedId: idSchema,
}).strict();

/**
 * Pedido de ação do cliente para um resolvedor confiável.
 * Só contém identidade/opções declaradas pelo jogador; números de rolagem,
 * defesa, CD, dano, custos e modificadores são calculados no lado confiável.
 */
export const combatActionIntentSchema = z.object({
  protocolVersion: z.literal(1),
  requestId: z.string().uuid(),
  actorCharacterId: idSchema,
  actionKind: z.enum([
    'weapon_attack',
    'spell_cast',
    'omni_action',
    'saving_throw',
    'reaction',
  ]),
  actionId: idSchema,
  sourceInstanceId: idSchema.optional(),
  targetCharacterIds: z.array(idSchema).max(10),
  targetPoint: z.object({
    x: z.number().finite().min(-1_000_000).max(1_000_000),
    y: z.number().finite().min(-1_000_000).max(1_000_000),
  }).strict().optional(),
  choices: z.array(choiceSchema).max(20),
}).strict().superRefine((intent, context) => {
  if (new Set(intent.targetCharacterIds).size !== intent.targetCharacterIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['targetCharacterIds'],
      message: 'O mesmo alvo não pode ser enviado duas vezes.',
    });
  }
  if (new Set(intent.choices.map((choice) => choice.optionId)).size !== intent.choices.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['choices'],
      message: 'Cada opção da ação só pode ser escolhida uma vez.',
    });
  }
});

export type CombatActionIntent = z.infer<typeof combatActionIntentSchema>;

const publicTargetOutcomeSchema = z.object({
  characterId: idSchema,
  outcome: z.enum(['hit', 'miss', 'critical', 'critical_fail', 'save_success', 'save_failure', 'affected']),
  damage: z.object({
    total: z.number().int().nonnegative(),
    type: idSchema.optional(),
  }).strict().optional(),
  visibleConditions: z.array(idSchema).max(20).optional(),
}).strict();

/** Resultado replicável sem revelar a defesa/CD/fórmula usada na resolução. */
export const publicCombatResolutionSchema = z.discriminatedUnion('status', [
  z.object({
    protocolVersion: z.literal(1),
    requestId: z.string().uuid(),
    status: z.literal('resolved'),
    roll: z.object({
      natural: z.number().int().min(1).max(20),
      total: z.number().int(),
    }).strict().optional(),
    targets: z.array(publicTargetOutcomeSchema).max(10),
  }).strict(),
  z.object({
    protocolVersion: z.literal(1),
    requestId: z.string().uuid(),
    status: z.literal('rejected'),
    reason: z.enum([
      'actor_not_owned',
      'action_unavailable',
      'wrong_turn',
      'invalid_target',
      'out_of_range',
      'insufficient_resources',
      'request_expired',
      'invalid_state',
    ]),
  }).strict(),
]);

export type PublicCombatResolution = z.infer<typeof publicCombatResolutionSchema>;
