import { describe, expect, it } from "vitest";
import {
  combatActionIntentSchema,
  publicCombatResolutionSchema,
  resolutionMatchesIntent,
} from "@/lib/combat/actionProtocol";

const validIntent = () => ({
  protocolVersion: 1 as const,
  requestId: "03dce277-7ba8-4bd3-8f6b-010ae9a74fe1",
  actorCharacterId: "player-character-1",
  actionKind: "weapon_attack" as const,
  actionId: "attack-main-hand",
  sourceInstanceId: "inventory-copy-7",
  targetCharacterIds: ["enemy-1"],
  choices: [{ optionId: "attack-mode", selectedId: "normal" }],
});

describe("protocolo de intenção de combate", () => {
  it("aceita IDs, alvo e escolhas sem enviar valores calculados", () => {
    expect(combatActionIntentSchema.safeParse(validIntent()).success).toBe(true);
  });

  it.each(["naturalRoll", "attackBonus", "targetDefense", "targetCd", "damage", "peCost"])(
    "rejeita o campo calculado ou secreto enviado pelo cliente: %s",
    (field) => {
      expect(combatActionIntentSchema.safeParse({ ...validIntent(), [field]: 99 }).success).toBe(
        false,
      );
    },
  );

  it("rejeita alvos duplicados e coordenadas fora do limite", () => {
    expect(
      combatActionIntentSchema.safeParse({
        ...validIntent(),
        targetCharacterIds: ["enemy-1", "enemy-1"],
      }).success,
    ).toBe(false);
    expect(
      combatActionIntentSchema.safeParse({
        ...validIntent(),
        targetPoint: { x: Number.POSITIVE_INFINITY, y: 0 },
      }).success,
    ).toBe(false);
  });
});

describe("resultado público de combate", () => {
  it("aceita resultado observável sem incluir CD ou defesa do alvo", () => {
    expect(
      publicCombatResolutionSchema.safeParse({
        protocolVersion: 1,
        requestId: "03dce277-7ba8-4bd3-8f6b-010ae9a74fe1",
        status: "resolved",
        roll: { natural: 17, total: 24 },
        targets: [{ characterId: "enemy-1", outcome: "hit", damage: { total: 12, type: "DCO" } }],
      }).success,
    ).toBe(true);
  });

  it("rejeita defesa, CD ou fórmulas no resultado enviado aos jogadores", () => {
    expect(
      publicCombatResolutionSchema.safeParse({
        protocolVersion: 1,
        requestId: "03dce277-7ba8-4bd3-8f6b-010ae9a74fe1",
        status: "resolved",
        targets: [{ characterId: "enemy-1", outcome: "miss", targetDefense: 26, targetCd: 19 }],
      }).success,
    ).toBe(false);
  });

  it("correlaciona o resultado à intenção e limita os alvos declarados", () => {
    const intent = combatActionIntentSchema.parse(validIntent());
    const result = publicCombatResolutionSchema.parse({
      protocolVersion: 1,
      requestId: intent.requestId,
      status: "resolved",
      targets: [{ characterId: "enemy-2", outcome: "hit" }],
    });
    if (result.status !== "resolved")
      throw new Error("Resultado de teste deveria estar resolvido.");
    expect(resolutionMatchesIntent(intent, result)).toBe(false);
    expect(
      resolutionMatchesIntent(intent, {
        ...result,
        targets: [{ characterId: "enemy-1", outcome: "hit" }],
      }),
    ).toBe(true);
    expect(
      resolutionMatchesIntent(intent, {
        ...result,
        requestId: "e12363b1-5b72-4bb7-bd18-60e8e3b9a40e",
      }),
    ).toBe(false);
  });
});
