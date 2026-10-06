import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { forwardSupabaseFunctionAuth } from "@/integrations/supabase/forward-function-auth";
import {
  combatActionIntentSchema,
  canControlCombatActor,
  publicCombatResolutionSchema,
  resolutionMatchesIntent,
  type CombatActionIntent,
  type PublicCombatResolution,
} from "@/lib/combat/actionProtocol";

const requestIdSchema = z.object({ requestId: z.string().uuid() }).strict();
const assignOwnerInputSchema = z
  .object({
    characterId: z.string().trim().min(1).max(128),
    ownerUserId: z.string().uuid().nullable(),
  })
  .strict();
const resolutionInputSchema = publicCombatResolutionSchema;

type AuthContext = {
  userId: string;
  supabase: SupabaseClient;
};

type ActionRequestRow = {
  request_id: string;
  submitted_by: string;
  actor_character_id: string;
  intent: unknown;
  status: "pending" | "processing" | "resolved" | "rejected" | "expired";
  result: unknown;
  created_at: string;
  expires_at: string;
  claimed_by: string | null;
  lease_expires_at: string | null;
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

async function getAdminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

async function requireMaster(context: AuthContext): Promise<void> {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "master",
  });
  if (error || data !== true) throw new Error("Forbidden: ação disponível apenas ao Mestre.");
}

async function requesterIsMaster(context: AuthContext): Promise<boolean> {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "master",
  });
  if (error) throw new Error("Não foi possível validar o papel da conta.");
  return data === true;
}

/**
 * O Mestre vincula a ficha ao UUID autenticado do jogador. O UUID do perfil
 * enviado dentro de `characters` nunca é usado como prova de propriedade.
 * `ownerUserId: null` remove o vínculo e bloqueia novas intenções do jogador.
 */
export const assignCombatCharacterOwner = createServerFn({ method: "POST" })
  .middleware([forwardSupabaseFunctionAuth, requireSupabaseAuth])
  .validator((input: unknown) => assignOwnerInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireMaster(context);
    const admin = await getAdminClient();

    if (data.ownerUserId === null) {
      const { error } = await admin
        .from("combat_character_owners")
        .delete()
        .eq("character_id", data.characterId);
      if (error) throw new Error("Não foi possível remover o vínculo da ficha.");
      return { characterId: data.characterId, ownerUserId: null };
    }

    const { data: target, error: userError } = await admin.auth.admin.getUserById(data.ownerUserId);
    if (userError || !target.user) throw new Error("A conta selecionada não existe.");

    const { error } = await admin.from("combat_character_owners").upsert(
      {
        character_id: data.characterId,
        owner_user_id: data.ownerUserId,
        assigned_by: context.userId,
      },
      { onConflict: "character_id" },
    );
    if (error) throw new Error("Não foi possível vincular a ficha à conta.");
    return { characterId: data.characterId, ownerUserId: data.ownerUserId };
  });

/** Somente o Mestre lê o mapeamento privado usado para autorizar atores. */
export const listCombatCharacterOwners = createServerFn({ method: "GET" })
  .middleware([forwardSupabaseFunctionAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireMaster(context);
    const admin = await getAdminClient();
    const { data, error } = await admin
      .from("combat_character_owners")
      .select("character_id,owner_user_id")
      .order("character_id", { ascending: true });
    if (error) throw new Error("Não foi possível carregar os vínculos das fichas.");
    return Object.fromEntries(
      (data ?? []).map((row) => [row.character_id, row.owner_user_id]),
    );
  });

/** Cria uma intenção pendente; não cobra recursos nem modifica fichas. */
export const submitCombatActionIntent = createServerFn({ method: "POST" })
  .middleware([forwardSupabaseFunctionAuth, requireSupabaseAuth])
  .validator((input: unknown) => combatActionIntentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await getAdminClient();
    const isMaster = await requesterIsMaster(context);
    if (!isMaster) {
      const { data: owner, error: ownerError } = await admin
        .from("combat_character_owners")
        .select("owner_user_id")
        .eq("character_id", data.actorCharacterId)
        .maybeSingle();
      if (ownerError) throw new Error("Não foi possível validar o controle desta ficha.");
      if (!canControlCombatActor(owner?.owner_user_id, context.userId, false))
        throw new Error("Você não tem controle desta ficha para enviar a ação.");
    }
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 2 * 60_000);

    // Repetir uma chamada após timeout deve retornar o pedido existente mesmo
    // quando o limite de pendências já foi atingido.
    const { data: existing, error: lookupError } = await admin
      .from("combat_action_requests")
      .select("request_id,status,created_at,expires_at,intent")
      .eq("submitted_by", context.userId)
      .eq("request_id", data.requestId)
      .maybeSingle();
    if (lookupError) throw new Error("Não foi possível consultar a solicitação existente.");
    if (existing) {
      if (canonicalJson(existing.intent) !== canonicalJson(data)) {
        throw new Error("Este requestId já foi usado para outra intenção.");
      }
      return {
        requestId: existing.request_id,
        status: existing.status,
        createdAt: existing.created_at,
        expiresAt: existing.expires_at,
        duplicate: true,
      };
    }

    const { count: pendingCount, error: countError } = await admin
      .from("combat_action_requests")
      .select("request_id", { count: "exact", head: true })
      .eq("submitted_by", context.userId)
      .eq("status", "pending")
      .gt("expires_at", now.toISOString());
    if (countError) throw new Error("Não foi possível verificar a fila de ações.");
    if ((pendingCount ?? 0) >= 8)
      throw new Error("Há muitas intenções pendentes; aguarde o Mestre resolver uma.");

    const { data: created, error } = await admin
      .from("combat_action_requests")
      .insert({
        request_id: data.requestId,
        submitted_by: context.userId,
        actor_character_id: data.actorCharacterId,
        intent: data,
        status: "pending",
        expires_at: expiresAt.toISOString(),
      })
      .select("request_id,status,created_at,expires_at")
      .single();

    if (error?.code === "23505") {
      // Outra requisição concorrente pode ter inserido o mesmo requestId.
      const { data: racedExisting, error: racedLookupError } = await admin
        .from("combat_action_requests")
        .select("request_id,status,created_at,expires_at,intent")
        .eq("submitted_by", context.userId)
        .eq("request_id", data.requestId)
        .maybeSingle();
      if (racedLookupError || !racedExisting)
        throw new Error("Não foi possível consultar a solicitação existente.");
      if (canonicalJson(racedExisting.intent) !== canonicalJson(data)) {
        throw new Error("Este requestId já foi usado para outra intenção.");
      }
      return {
        requestId: racedExisting.request_id,
        status: racedExisting.status,
        createdAt: racedExisting.created_at,
        expiresAt: racedExisting.expires_at,
        duplicate: true,
      };
    }
    if (error || !created) throw new Error("Não foi possível registrar a intenção de ação.");

    return {
      requestId: created.request_id,
      status: created.status,
      createdAt: created.created_at,
      expiresAt: created.expires_at,
      duplicate: false,
    };
  });

/** Retorna ao Mestre somente intenções ainda pendentes e dentro do prazo. */
export const listPendingCombatActionIntents = createServerFn({ method: "GET" })
  .middleware([forwardSupabaseFunctionAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireMaster(context);
    const admin = await getAdminClient();
    const now = new Date().toISOString();

    await admin
      .from("combat_action_requests")
      .update({ status: "expired", updated_at: now })
      .eq("status", "pending")
      .lte("expires_at", now);
    await admin
      .from("combat_action_requests")
      .update({ status: "expired", updated_at: now })
      .eq("status", "processing")
      .lte("expires_at", now);
    await admin
      .from("combat_action_requests")
      .update({
        status: "pending",
        claimed_by: null,
        claimed_at: null,
        lease_expires_at: null,
        updated_at: now,
      })
      .eq("status", "processing")
      .lte("lease_expires_at", now)
      .gt("expires_at", now);

    const { data, error } = await admin
      .from("combat_action_requests")
      .select("request_id,submitted_by,actor_character_id,intent,created_at,expires_at")
      .eq("status", "pending")
      .gt("expires_at", now)
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) throw new Error("Não foi possível carregar as intenções pendentes.");
    return (data ?? []).flatMap((row) => {
      const intent = combatActionIntentSchema.safeParse(row.intent);
      if (
        !intent.success ||
        intent.data.requestId !== row.request_id ||
        intent.data.actorCharacterId !== row.actor_character_id
      )
        return [];
      return [
        {
          requestId: row.request_id,
          submittedBy: row.submitted_by,
          actorCharacterId: row.actor_character_id,
          intent: intent.data,
          createdAt: row.created_at,
          expiresAt: row.expires_at,
        },
      ];
    });
  });

/** Reivindica uma intenção com lease; duas telas de Mestre não a resolvem juntas. */
export const claimCombatActionIntent = createServerFn({ method: "POST" })
  .middleware([forwardSupabaseFunctionAuth, requireSupabaseAuth])
  .validator((input: unknown) => requestIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireMaster(context);
    const admin = await getAdminClient();
    const now = new Date();
    const nowIso = now.toISOString();
    const leaseExpiresAt = new Date(now.getTime() + 90_000).toISOString();
    const claimedAt = nowIso;
    const common = {
      status: "processing",
      claimed_by: context.userId,
      claimed_at: claimedAt,
      lease_expires_at: leaseExpiresAt,
      updated_at: nowIso,
    };

    // Reivindicação recuperável após falha/desconexão do primeiro cliente Mestre.
    let result = await admin
      .from("combat_action_requests")
      .update(common)
      .eq("request_id", data.requestId)
      .eq("status", "processing")
      .lte("lease_expires_at", nowIso)
      .gt("expires_at", nowIso)
      .select("request_id,submitted_by,actor_character_id,intent,expires_at")
      .maybeSingle();

    if (!result.data && !result.error) {
      result = await admin
        .from("combat_action_requests")
        .update(common)
        .eq("request_id", data.requestId)
        .eq("status", "pending")
        .gt("expires_at", nowIso)
        .select("request_id,submitted_by,actor_character_id,intent,expires_at")
        .maybeSingle();
    }

    if (result.error) throw new Error("Não foi possível reivindicar a intenção.");
    const row = result.data as ActionRequestRow | null;
    if (!row) throw new Error("Intenção indisponível, expirada ou já reivindicada.");

    const intent = combatActionIntentSchema.safeParse(row.intent);
    if (
      !intent.success ||
      intent.data.requestId !== row.request_id ||
      intent.data.actorCharacterId !== row.actor_character_id
    ) {
      await admin
        .from("combat_action_requests")
        .update({
          status: "rejected",
          result: {
            protocolVersion: 1,
            requestId: row.request_id,
            status: "rejected",
            reason: "invalid_state",
          },
          updated_at: nowIso,
        })
        .eq("request_id", row.request_id)
        .eq("status", "processing")
        .eq("claimed_by", context.userId);
      throw new Error("Intenção inválida; foi recusada sem executar a ação.");
    }

    return {
      requestId: row.request_id,
      submittedBy: row.submitted_by,
      actorCharacterId: row.actor_character_id,
      intent: intent.data,
      expiresAt: row.expires_at,
      leaseExpiresAt,
    };
  });

/** Publica somente o DTO público e exige que a solicitação esteja reivindicada por este Mestre. */
export const publishCombatActionResolution = createServerFn({ method: "POST" })
  .middleware([forwardSupabaseFunctionAuth, requireSupabaseAuth])
  .validator((input: unknown) => resolutionInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireMaster(context);
    const admin = await getAdminClient();
    const now = new Date().toISOString();
    const { data: rowData, error: readError } = await admin
      .from("combat_action_requests")
      .select("request_id,intent,claimed_by,status,lease_expires_at")
      .eq("request_id", data.requestId)
      .eq("claimed_by", context.userId)
      .eq("status", "processing")
      .gt("lease_expires_at", now)
      .maybeSingle();

    if (readError || !rowData)
      throw new Error("A intenção não está reivindicada por esta sessão de Mestre.");
    const intent = combatActionIntentSchema.safeParse(rowData.intent);
    if (!intent.success || intent.data.requestId !== data.requestId)
      throw new Error("Intenção persistida inválida.");

    if (!resolutionMatchesIntent(intent.data, data))
      throw new Error("O resultado não corresponde à intenção reivindicada.");

    const nextStatus = data.status;
    const { data: updated, error } = await admin
      .from("combat_action_requests")
      .update({ status: nextStatus, result: data, updated_at: now })
      .eq("request_id", data.requestId)
      .eq("claimed_by", context.userId)
      .eq("status", "processing")
      .gt("lease_expires_at", now)
      .select("request_id,status")
      .maybeSingle();

    if (error || !updated)
      throw new Error("A reivindicação expirou antes de publicar o resultado.");
    return { requestId: updated.request_id, status: updated.status };
  });

/** Player consulta apenas o estado e o resultado público das próprias intenções. */
export const getMyCombatActionResult = createServerFn({ method: "GET" })
  .middleware([forwardSupabaseFunctionAuth, requireSupabaseAuth])
  .validator((input: unknown) => requestIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await getAdminClient();
    const { data: row, error } = await admin
      .from("combat_action_requests")
      .select("request_id,status,result,created_at,expires_at")
      .eq("request_id", data.requestId)
      .eq("submitted_by", context.userId)
      .maybeSingle();

    if (error) throw new Error("Não foi possível consultar o resultado.");
    if (!row) return null;
    const publicResult =
      row.result == null ? null : publicCombatResolutionSchema.safeParse(row.result);
    if (publicResult && !publicResult.success)
      throw new Error("Resultado armazenado fora do formato público.");

    return {
      requestId: row.request_id,
      status: row.status,
      result: publicResult?.success ? (publicResult.data as PublicCombatResolution) : null,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  });
