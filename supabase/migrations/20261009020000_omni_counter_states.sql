-- Contadores OMNI são estado mutável por operação, não parte autoritativa do
-- snapshot completo de personagens. A tabela separada evita que um upsert
-- atrasado de `realtime_world.characters` reverta incremento ou consumo.
CREATE TABLE public.omni_counter_states (
  character_id text PRIMARY KEY CHECK (length(btrim(character_id)) BETWEEN 1 AND 128),
  counters jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(counters) = 'object'),
  source_usage jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(source_usage) = 'object'),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.omni_counter_operation_receipts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  character_id text NOT NULL,
  request jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, operation_id)
);

ALTER TABLE public.omni_counter_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omni_counter_operation_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.omni_counter_states FROM anon, authenticated;
REVOKE ALL ON TABLE public.omni_counter_operation_receipts FROM anon, authenticated;
GRANT SELECT ON TABLE public.omni_counter_states TO authenticated;

-- A política não consulta combat_character_owners diretamente porque essa
-- tabela é privada para clientes. A função retorna somente o resultado de
-- autorização da própria ficha, sem expor o mapa de proprietários.
CREATE OR REPLACE FUNCTION public.can_read_omni_counter_state(p_character_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'master'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.combat_character_owners AS owner_link
        WHERE owner_link.character_id = p_character_id
          AND owner_link.owner_user_id = auth.uid()
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_read_omni_counter_state(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_omni_counter_state(text) TO authenticated;

CREATE POLICY "Contadores OMNI: leitura autenticada"
  ON public.omni_counter_states FOR SELECT TO authenticated
  USING (
    public.can_read_omni_counter_state(character_id)
  );

-- Migra o estado atual uma única vez. Depois disso, apenas a RPC transacional
-- abaixo altera a fonte autoritativa dos contadores.
INSERT INTO public.omni_counter_states (character_id, counters, source_usage)
SELECT
  personagem->>'id',
  CASE WHEN jsonb_typeof(personagem->'omniCounters') = 'object' THEN personagem->'omniCounters' ELSE '{}'::jsonb END,
  CASE WHEN jsonb_typeof(personagem->'omniCounterSourceUsage') = 'object' THEN personagem->'omniCounterSourceUsage' ELSE '{}'::jsonb END
FROM public.realtime_world AS mundo
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(mundo.data) = 'array' THEN mundo.data ELSE '[]'::jsonb END
) AS itens(personagem)
WHERE mundo.slice = 'characters'
  AND jsonb_typeof(personagem) = 'object'
  AND length(btrim(coalesce(personagem->>'id', ''))) BETWEEN 1 AND 128
ON CONFLICT (character_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.apply_omni_counter_operation(
  p_operation_id uuid,
  p_character_id text,
  p_actor_character_id text,
  p_mutations jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_may_read boolean := false;
  v_may_write boolean := false;
  v_request jsonb;
  v_receipt public.omni_counter_operation_receipts%ROWTYPE;
  v_counters jsonb;
  v_usage jsonb;
  v_revision bigint;
  v_mutation jsonb;
  v_action text;
  v_name text;
  v_amount numeric;
  v_cap numeric;
  v_source_limit numeric;
  v_scope text;
  v_cycle text;
  v_source text;
  v_prefix text;
  v_total numeric;
  v_source_total numeric;
  v_untracked numeric;
  v_current numeric;
  v_used numeric;
  v_accepted numeric;
  v_consumed numeric;
  v_remaining numeric;
  v_temp numeric;
  v_round integer;
  v_key text;
  v_value numeric;
  v_source_row record;
  v_results jsonb := '[]'::jsonb;
  v_result jsonb;
  v_old_round integer;
  v_old_state public.omni_counter_states%ROWTYPE;
BEGIN
  IF v_user_id IS NULL OR coalesce(auth.role(), '') <> 'authenticated' THEN
    RAISE EXCEPTION 'Autenticação necessária para alterar contadores OMNI.' USING ERRCODE = '42501';
  END IF;
  IF p_operation_id IS NULL OR p_character_id IS NULL OR p_actor_character_id IS NULL
     OR length(btrim(p_character_id)) NOT BETWEEN 1 AND 128
     OR length(btrim(p_actor_character_id)) NOT BETWEEN 1 AND 128
     OR p_mutations IS NULL
     OR jsonb_typeof(p_mutations) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Operação de contador inválida.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_mutations) NOT BETWEEN 1 AND 64 THEN
    RAISE EXCEPTION 'Operação de contador inválida.' USING ERRCODE = '22023';
  END IF;
  v_may_write := public.has_role(v_user_id, 'master'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.combat_character_owners AS owner_link
      WHERE owner_link.character_id = p_actor_character_id
        AND owner_link.owner_user_id = v_user_id
    );
  IF NOT v_may_write THEN
    RAISE EXCEPTION 'A conta não controla a ficha que originou esta operação OMNI.' USING ERRCODE = '42501';
  END IF;
  v_may_read := public.can_read_omni_counter_state(p_character_id);

  -- Mesmo ID repetido aguarda a primeira transação e recebe o resultado já
  -- gravado. A trava é por usuário + ID; o hash só é usado como chave de lock.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_operation_id::text, 0)
  );
  v_request := jsonb_build_object(
    'character_id', p_character_id,
    'actor_character_id', p_actor_character_id,
    'mutations', p_mutations
  );
  SELECT * INTO v_receipt
  FROM public.omni_counter_operation_receipts
  WHERE user_id = v_user_id AND operation_id = p_operation_id;
  IF FOUND THEN
    IF v_receipt.character_id <> p_character_id OR v_receipt.request <> v_request THEN
      RAISE EXCEPTION 'operation_id já utilizado com conteúdo diferente.' USING ERRCODE = '22023';
    END IF;
    IF v_may_read THEN RETURN v_receipt.result; END IF;
    RETURN jsonb_build_object('characterId', p_character_id, 'revision', v_receipt.result->'revision', 'accepted', true);
  END IF;

  -- Inicializa estados ainda não migrados (por exemplo, personagens recém-criados)
  -- a partir do snapshot disponível, e depois serializa no lock da linha.
  INSERT INTO public.omni_counter_states (character_id, counters, source_usage)
  SELECT p_character_id,
    CASE WHEN jsonb_typeof(personagem->'omniCounters') = 'object' THEN personagem->'omniCounters' ELSE '{}'::jsonb END,
    CASE WHEN jsonb_typeof(personagem->'omniCounterSourceUsage') = 'object' THEN personagem->'omniCounterSourceUsage' ELSE '{}'::jsonb END
  FROM (SELECT data FROM public.realtime_world WHERE slice = 'characters') AS mundo
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(mundo.data) = 'array' THEN mundo.data ELSE '[]'::jsonb END
  ) AS itens(personagem)
  WHERE personagem->>'id' = p_character_id
  ON CONFLICT (character_id) DO NOTHING;
  INSERT INTO public.omni_counter_states (character_id) VALUES (p_character_id)
  ON CONFLICT (character_id) DO NOTHING;

  SELECT * INTO v_old_state
  FROM public.omni_counter_states
  WHERE character_id = p_character_id
  FOR UPDATE;
  v_counters := v_old_state.counters;
  v_usage := v_old_state.source_usage;
  v_revision := v_old_state.revision;

  FOR v_mutation IN SELECT value FROM jsonb_array_elements(p_mutations) AS item(value) LOOP
    IF jsonb_typeof(v_mutation) <> 'object' THEN
      RAISE EXCEPTION 'Mutação de contador inválida.' USING ERRCODE = '22023';
    END IF;
    v_action := upper(coalesce(v_mutation->>'action', ''));
    v_name := lower(btrim(coalesce(v_mutation->>'name', '')));
    v_amount := round(coalesce(nullif(v_mutation->>'amount', '')::numeric, 0));
    v_cap := CASE WHEN jsonb_typeof(v_mutation->'cap') = 'number' THEN greatest(0, round((v_mutation->>'cap')::numeric)) ELSE NULL END;
    v_source_limit := CASE WHEN jsonb_typeof(v_mutation->'sourceLimit') = 'number' THEN greatest(0, round((v_mutation->>'sourceLimit')::numeric)) ELSE NULL END;
    v_scope := coalesce(v_mutation->>'scope', 'global');
    v_cycle := coalesce(nullif(v_mutation->>'cycle', ''), 'sem_ciclo');
    v_source := coalesce(nullif(btrim(v_mutation->>'sourceId'), ''), 'geral');
    v_prefix := v_name || '__fonte__';
    v_consumed := 0;

    IF v_action IN ('DAMAGE_HISTORY', 'HEALING_HISTORY') THEN
      v_round := greatest(0, coalesce(nullif(v_mutation->>'round', '')::integer, 0));
      v_amount := greatest(0, coalesce(nullif(v_mutation->>'amount', '')::numeric, 0));
      v_old_round := coalesce(nullif(v_counters->>'__omni_rodada', '')::integer, -1);
      IF v_old_round <> v_round THEN
        v_counters := jsonb_set(v_counters, '{cura_recebida_nesta_rodada}', '0'::jsonb, true);
        v_counters := jsonb_set(v_counters, '{dano_recebido_nesta_rodada}', '0'::jsonb, true);
        v_counters := jsonb_set(v_counters, '{vida_perdida_nesta_rodada}', '0'::jsonb, true);
      END IF;
      v_counters := jsonb_set(v_counters, '{__omni_rodada}', to_jsonb(v_round), true);
      IF v_action = 'DAMAGE_HISTORY' THEN
        v_temp := greatest(0, coalesce(nullif(v_mutation->>'temporary', '')::numeric, 0));
        v_counters := jsonb_set(v_counters, '{ultimo_dano_recebido}', to_jsonb(v_amount), true);
        v_counters := jsonb_set(v_counters, '{dano_recebido_nesta_rodada}', to_jsonb(coalesce((v_counters->>'dano_recebido_nesta_rodada')::numeric, 0) + v_amount), true);
        v_counters := jsonb_set(v_counters, '{ultimo_dano_temporario}', to_jsonb(v_temp), true);
        v_counters := jsonb_set(v_counters, '{vida_perdida_nesta_rodada}', to_jsonb(coalesce((v_counters->>'vida_perdida_nesta_rodada')::numeric, 0) + greatest(0, v_amount - v_temp)), true);
      ELSE
        v_counters := jsonb_set(v_counters, '{cura_recebida}', to_jsonb(v_amount), true);
        v_counters := jsonb_set(v_counters, '{cura_recebida_nesta_rodada}', to_jsonb(coalesce((v_counters->>'cura_recebida_nesta_rodada')::numeric, 0) + v_amount), true);
      END IF;
      v_results := v_results || jsonb_build_array(jsonb_build_object('action', v_action, 'amount', v_amount));
      CONTINUE;
    END IF;

    IF v_name !~ '^[a-z0-9_]{1,100}$'
       OR v_action NOT IN ('INCREMENTAR_CONTADOR', 'CONSUMIR_CONTADOR', 'DEFINIR_CONTADOR', 'ZERAR_CONTADOR')
       OR v_amount < 0
       OR v_scope NOT IN ('global', 'porFonte') THEN
      RAISE EXCEPTION 'Mutação de contador inválida.' USING ERRCODE = '22023';
    END IF;
    IF v_source !~ '^[^[:cntrl:]]{1,128}$' OR position('__fonte__' IN v_source) > 0 THEN
      RAISE EXCEPTION 'Fonte de contador inválida.' USING ERRCODE = '22023';
    END IF;

    SELECT coalesce(sum(value::numeric), 0) INTO v_source_total
    FROM jsonb_each_text(v_counters)
    WHERE left(key, length(v_prefix)) = v_prefix;
    v_total := greatest(0, coalesce(nullif(v_counters->>v_name, '')::numeric, v_source_total));
    IF v_action = 'INCREMENTAR_CONTADOR' THEN
      IF coalesce((v_mutation->>'trackSource')::boolean, false)
         OR coalesce((v_mutation->>'exactSource')::boolean, false)
         OR v_source_total > 0 THEN
        v_untracked := greatest(0, v_total - v_source_total);
        IF v_untracked > 0 THEN
          v_key := v_prefix || 'geral';
          v_current := coalesce(nullif(v_counters->>v_key, '')::numeric, 0);
          v_counters := jsonb_set(v_counters, ARRAY[v_key], to_jsonb(v_current + v_untracked), true);
          v_source_total := v_source_total + v_untracked;
        END IF;
        v_key := v_prefix || v_source;
        v_current := coalesce(nullif(v_counters->>v_key, '')::numeric, 0);
        v_used := CASE
          WHEN coalesce(v_usage->v_name->v_source->>'ciclo', '') = v_cycle
            THEN coalesce(nullif(v_usage->v_name->v_source->>'usados', '')::numeric, 0)
          ELSE 0 END;
        v_accepted := v_amount;
        IF v_source_limit IS NOT NULL THEN v_accepted := least(v_accepted, greatest(0, v_source_limit - v_used)); END IF;
        IF v_cap IS NOT NULL AND v_scope <> 'porFonte' THEN v_accepted := least(v_accepted, greatest(0, v_cap - v_total)); END IF;
        IF v_accepted > 0 THEN
          v_counters := jsonb_set(v_counters, ARRAY[v_key], to_jsonb(v_current + v_accepted), true);
          IF v_source_limit IS NOT NULL THEN
            IF jsonb_typeof(v_usage->v_name) IS DISTINCT FROM 'object' THEN
              v_usage := jsonb_set(v_usage, ARRAY[v_name], '{}'::jsonb, true);
            END IF;
            v_usage := jsonb_set(v_usage, ARRAY[v_name, v_source], jsonb_build_object('ciclo', v_cycle, 'usados', v_used + v_accepted), true);
          END IF;
        END IF;
        IF v_cap IS NOT NULL THEN
          IF jsonb_typeof(v_usage->v_name) IS DISTINCT FROM 'object' THEN
            v_usage := jsonb_set(v_usage, ARRAY[v_name], '{}'::jsonb, true);
          END IF;
          v_usage := jsonb_set(v_usage, ARRAY[v_name, '__omni_meta_teto_global__'], jsonb_build_object('ciclo', '__omni_teto_global__', 'usados', v_cap), true);
        END IF;
        SELECT coalesce(sum(value::numeric), 0) INTO v_total
        FROM jsonb_each_text(v_counters)
        WHERE left(key, length(v_prefix)) = v_prefix;
        v_counters := jsonb_set(v_counters, ARRAY[v_name], to_jsonb(v_total), true);
      ELSE
        v_total := greatest(0, v_total + v_amount);
        IF v_cap IS NOT NULL THEN v_total := least(v_cap, v_total); END IF;
        v_counters := jsonb_set(v_counters, ARRAY[v_name], to_jsonb(v_total), true);
      END IF;
    ELSIF v_action = 'CONSUMIR_CONTADOR' THEN
      v_remaining := CASE WHEN v_amount > 0 THEN v_amount ELSE v_total END;
      IF coalesce((v_mutation->>'exactSource')::boolean, false) THEN
        v_key := v_prefix || v_source;
        v_current := coalesce(nullif(v_counters->>v_key, '')::numeric, 0);
        v_consumed := least(v_current, v_remaining);
        IF v_current > 0 THEN v_counters := jsonb_set(v_counters, ARRAY[v_key], to_jsonb(v_current - v_consumed), true); END IF;
      ELSIF v_source_total > 0 THEN
        FOR v_source_row IN
          SELECT key, value::numeric AS amount
          FROM jsonb_each_text(v_counters)
          WHERE left(key, length(v_prefix)) = v_prefix
          ORDER BY value::numeric DESC, key ASC
        LOOP
          EXIT WHEN v_remaining <= 0;
          v_consumed := least(v_source_row.amount, v_remaining);
          v_counters := jsonb_set(v_counters, ARRAY[v_source_row.key], to_jsonb(v_source_row.amount - v_consumed), true);
          v_remaining := v_remaining - v_consumed;
        END LOOP;
        v_consumed := CASE WHEN v_amount > 0 THEN least(v_total, v_amount) ELSE v_total END;
      ELSE
        v_consumed := least(v_total, v_remaining);
        v_total := greatest(0, v_total - v_consumed);
        v_counters := jsonb_set(v_counters, ARRAY[v_name], to_jsonb(v_total), true);
      END IF;
      IF v_source_total > 0 THEN
        SELECT coalesce(sum(value::numeric), 0) INTO v_total
        FROM jsonb_each_text(v_counters)
        WHERE left(key, length(v_prefix)) = v_prefix;
        v_counters := jsonb_set(v_counters, ARRAY[v_name], to_jsonb(v_total), true);
        IF v_total = 0 THEN
          FOR v_key IN SELECT key FROM jsonb_each(v_counters) WHERE left(key, length(v_prefix)) = v_prefix LOOP
            v_counters := v_counters - v_key;
          END LOOP;
        END IF;
      END IF;
      v_results := v_results || jsonb_build_array(jsonb_build_object('action', v_action, 'name', v_name, 'consumed', v_consumed, 'remaining', v_total));
      CONTINUE;
    ELSIF v_action = 'DEFINIR_CONTADOR' THEN
      v_total := v_amount;
      IF v_cap IS NOT NULL THEN v_total := least(v_cap, v_total); END IF;
      FOR v_key IN SELECT key FROM jsonb_each(v_counters) WHERE left(key, length(v_prefix)) = v_prefix LOOP
        v_counters := v_counters - v_key;
      END LOOP;
      v_counters := jsonb_set(v_counters, ARRAY[v_name], to_jsonb(v_total), true);
    ELSE
      v_total := 0;
      FOR v_key IN SELECT key FROM jsonb_each(v_counters) WHERE left(key, length(v_prefix)) = v_prefix LOOP
        v_counters := v_counters - v_key;
      END LOOP;
      v_counters := jsonb_set(v_counters, ARRAY[v_name], '0'::jsonb, true);
    END IF;
    v_results := v_results || jsonb_build_array(jsonb_build_object('action', v_action, 'name', v_name, 'remaining', v_total));
  END LOOP;

  v_revision := v_revision + 1;
  UPDATE public.omni_counter_states
  SET counters = v_counters, source_usage = v_usage, revision = v_revision, updated_at = now()
  WHERE character_id = p_character_id;

  v_result := jsonb_build_object(
    'characterId', p_character_id,
    'counters', v_counters,
    'sourceUsage', v_usage,
    'revision', v_revision,
    'results', v_results
  );
  INSERT INTO public.omni_counter_operation_receipts (user_id, operation_id, character_id, request, result)
  VALUES (v_user_id, p_operation_id, p_character_id, v_request, v_result);
  DELETE FROM public.omni_counter_operation_receipts
  WHERE user_id = v_user_id AND created_at < now() - interval '30 days';
  IF v_may_read THEN RETURN v_result; END IF;
  RETURN jsonb_build_object('characterId', p_character_id, 'revision', v_revision, 'accepted', true);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_omni_counter_operation(uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_omni_counter_operation(uuid, text, text, jsonb) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'omni_counter_states'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.omni_counter_states;
  END IF;
END;
$$;
