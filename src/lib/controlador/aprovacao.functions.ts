import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { forwardSupabaseFunctionAuth } from "@/integrations/supabase/forward-function-auth";
import {
  avaliarSubmissaoAprovacao,
  validarDecisaoAprovacao,
  type EstadoAprovacaoInvocacao,
} from "@/lib/controlador/aprovacao";

const idSchema = z.string().trim().min(1).max(128);
const submitSchema = z.object({
  requestId: z.string().uuid(),
  invocationId: idSchema,
  ownerCharacterId: idSchema,
  versionSubmitted: z.number().int().min(1),
  snapshot: z.record(z.string(), z.unknown()),
}).strict();

const reviewSchema = z.object({
  requestId: z.string().uuid(),
  decisao: z.enum(["aprovada", "rejeitada"]),
  motivo: z.string().trim().max(2000).optional(),
}).strict();

type AuthContext = {
  userId: string;
  supabase: SupabaseClient;
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

async function requesterIsMaster(context: AuthContext): Promise<boolean> {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "master",
  });
  if (error) throw new Error("Não foi possível validar o papel da conta.");
  return data === true;
}

/**
 * Salva um snapshot imutável da versão solicitada. O papel e o vínculo de dono
 * vêm do servidor; campos de perfil enviados dentro da ficha não autorizam a ação.
 */
export const submeterAprovacaoInvocacao = createServerFn({ method: "POST" })
  .middleware([forwardSupabaseFunctionAuth, requireSupabaseAuth])
  .validator((input: unknown) => submitSchema.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await getAdminClient();
    const isMaster = await requesterIsMaster(context);

    if (data.snapshot.id !== data.invocationId
      || data.snapshot.donoCharacterId !== data.ownerCharacterId) {
      throw new Error("O snapshot não corresponde à invocação e à ficha informadas.");
    }
    const snapshotPersistido: Record<string, unknown> = { ...data.snapshot };
    for (const campo of ["aprovacaoMestre", "versaoAprovada", "solicitacaoAprovacaoId", "motivoRejeicao"]) {
      delete snapshotPersistido[campo];
    }
    // O servidor fixa a versão do snapshot; estado de aprovação nunca vem do cliente.
    snapshotPersistido.versaoModelo = data.versionSubmitted;
    const snapshotJson = JSON.stringify(snapshotPersistido);
    if (!snapshotJson || snapshotJson.length > 100_000) {
      throw new Error("O snapshot da invocação excede o tamanho permitido.");
    }

    let ownerUserId: string | null = null;
    if (!isMaster) {
      const { data: owner, error: ownerError } = await admin
        .from("combat_character_owners")
        .select("owner_user_id")
        .eq("character_id", data.ownerCharacterId)
        .maybeSingle();
      if (ownerError) throw new Error("Não foi possível validar o dono da ficha.");
      ownerUserId = owner?.owner_user_id ?? null;
    }

    const policy = avaliarSubmissaoAprovacao({
      requesterUserId: context.userId,
      requesterIsMaster: isMaster,
      ownerUserId,
      ownerCharacterId: data.ownerCharacterId,
      invocationOwnerCharacterId: String(data.snapshot.donoCharacterId ?? ""),
    });
    if (!policy.ok) throw new Error(policy.motivo);

    const { data: existing, error: existingError } = await admin
      .from("invocation_approval_requests")
      .select("request_id,invocation_id,owner_character_id,version_submitted,snapshot,submitted_by,status,approved_version")
      .eq("request_id", data.requestId)
      .maybeSingle();
    if (existingError) throw new Error("Não foi possível consultar a solicitação existente.");
    if (existing) {
      const sameRequest = existing.submitted_by === context.userId
        && existing.invocation_id === data.invocationId
        && existing.owner_character_id === data.ownerCharacterId
        && existing.version_submitted === data.versionSubmitted
        && canonicalJson(existing.snapshot) === canonicalJson(snapshotPersistido);
      if (!sameRequest) throw new Error("Este identificador já foi usado por outra solicitação.");
      return {
        requestId: existing.request_id,
        status: existing.status as EstadoAprovacaoInvocacao,
        versaoAprovada: existing.approved_version as number | null,
        duplicate: true,
      };
    }

    if (policy.estado === "pendente") {
      const { data: pending, error: pendingError } = await admin
        .from("invocation_approval_requests")
        .select("request_id")
        .eq("invocation_id", data.invocationId)
        .eq("status", "pendente")
        .maybeSingle();
      if (pendingError) throw new Error("Não foi possível consultar a fila de aprovações.");
      if (pending) throw new Error("Esta invocação já tem uma solicitação pendente.");
    }

    const reviewedAt = policy.estado === "aprovada" ? new Date().toISOString() : null;
    const { data: created, error } = await admin
      .from("invocation_approval_requests")
      .insert({
        request_id: data.requestId,
        invocation_id: data.invocationId,
        owner_character_id: data.ownerCharacterId,
        version_submitted: data.versionSubmitted,
        snapshot: snapshotPersistido,
        submitted_by: context.userId,
        status: policy.estado,
        reviewed_by: policy.estado === "aprovada" ? context.userId : null,
        reviewed_at: reviewedAt,
        approved_version: policy.estado === "aprovada" ? data.versionSubmitted : null,
      })
      .select("request_id,status,approved_version")
      .single();

    if (error?.code === "23505") {
      throw new Error("Esta invocação já tem uma solicitação pendente.");
    }
    if (error || !created) throw new Error("Não foi possível registrar a solicitação de aprovação.");

    return {
      requestId: created.request_id,
      status: created.status as EstadoAprovacaoInvocacao,
      versaoAprovada: created.approved_version as number | null,
      duplicate: false,
    };
  });

/** Somente a conta com papel Mestre pode aprovar/rejeitar uma solicitação pendente. */
export const decidirAprovacaoInvocacao = createServerFn({ method: "POST" })
  .middleware([forwardSupabaseFunctionAuth, requireSupabaseAuth])
  .validator((input: unknown) => reviewSchema.parse(input))
  .handler(async ({ data, context }) => {
    const isMaster = await requesterIsMaster(context);
    if (!isMaster) throw new Error("Apenas o Mestre pode revisar uma invocação.");

    const admin = await getAdminClient();
    const { data: request, error: lookupError } = await admin
      .from("invocation_approval_requests")
      .select("request_id,version_submitted,status")
      .eq("request_id", data.requestId)
      .maybeSingle();
    if (lookupError) throw new Error("Não foi possível carregar a solicitação.");
    if (!request) throw new Error("Solicitação de aprovação não encontrada.");

    const policy = validarDecisaoAprovacao({
      requesterIsMaster: true,
      estadoAtual: request.status as EstadoAprovacaoInvocacao,
      decisao: data.decisao,
      motivo: data.motivo,
    });
    if (!policy.ok) throw new Error(policy.motivo);

    const reviewedAt = new Date().toISOString();
    const { data: updated, error } = await admin
      .from("invocation_approval_requests")
      .update({
        status: data.decisao,
        reviewed_by: context.userId,
        reviewed_at: reviewedAt,
        reason: data.decisao === "rejeitada" ? data.motivo!.trim() : null,
        approved_version: data.decisao === "aprovada" ? request.version_submitted : null,
      })
      .eq("request_id", data.requestId)
      .eq("status", "pendente")
      .select("request_id,status,approved_version,reason")
      .maybeSingle();

    if (error) throw new Error("Não foi possível salvar a decisão do Mestre.");
    if (!updated) throw new Error("A solicitação já foi revisada por outra ação.");
    return {
      requestId: updated.request_id,
      status: updated.status as EstadoAprovacaoInvocacao,
      versaoAprovada: updated.approved_version as number | null,
      motivo: updated.reason as string | null,
    };
  });
