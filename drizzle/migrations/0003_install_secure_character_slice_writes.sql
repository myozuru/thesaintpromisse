-- Toda gravação de personagens passa por uma RPC transacional que valida
-- identidade, vínculo de propriedade, revisão otimista e requestId.
ALTER TABLE public.realtime_world
  ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0);

CREATE OR REPLACE FUNCTION public.touch_realtime_world()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' THEN
    NEW.revision := OLD.revision + 1;
  ELSE
    NEW.revision := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS realtime_world_touch ON public.realtime_world;
CREATE TRIGGER realtime_world_touch
  BEFORE INSERT OR UPDATE ON public.realtime_world
  FOR EACH ROW EXECUTE FUNCTION public.touch_realtime_world();

CREATE TABLE IF NOT EXISTS public.character_slice_write_receipts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  request jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id)
);
ALTER TABLE public.character_slice_write_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.character_slice_write_receipts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.character_slice_write_receipts TO service_role;

-- Em fichas de jogador, qualquer modelo novo ou alterado precisa coincidir
-- com o snapshot registrado no fluxo de aprovação. Só hpAtual é runtime aqui.
CREATE OR REPLACE FUNCTION public.character_invocation_catalog_is_authorized(
  p_character_id text,
  p_current_character jsonb,
  p_proposed_character jsonb
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_current_catalog jsonb;
  v_proposed_catalog jsonb;
  v_candidate jsonb;
  v_previous jsonb;
  v_request public.invocation_approval_requests%ROWTYPE;
  v_id text;
  v_request_id text;
BEGIN
  IF jsonb_typeof(p_current_character) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_proposed_character) IS DISTINCT FROM 'object'
     OR p_proposed_character->'limiteInvocacoesConhecidas' IS DISTINCT FROM p_current_character->'limiteInvocacoesConhecidas'
     OR p_proposed_character->'limiteInvocacoesAtivas' IS DISTINCT FROM p_current_character->'limiteInvocacoesAtivas' THEN
    RETURN false;
  END IF;

  IF p_current_character ? 'invocacoesConhecidas'
     AND jsonb_typeof(p_current_character->'invocacoesConhecidas') IS DISTINCT FROM 'array' THEN
    RETURN false;
  END IF;
  IF p_proposed_character ? 'invocacoesConhecidas'
     AND jsonb_typeof(p_proposed_character->'invocacoesConhecidas') IS DISTINCT FROM 'array' THEN
    RETURN false;
  END IF;
  v_current_catalog := CASE WHEN jsonb_typeof(p_current_character->'invocacoesConhecidas') = 'array'
    THEN p_current_character->'invocacoesConhecidas' ELSE '[]'::jsonb END;
  v_proposed_catalog := CASE WHEN jsonb_typeof(p_proposed_character->'invocacoesConhecidas') = 'array'
    THEN p_proposed_character->'invocacoesConhecidas' ELSE '[]'::jsonb END;

  IF EXISTS (
       SELECT 1 FROM jsonb_array_elements(v_proposed_catalog) AS item(value)
       WHERE jsonb_typeof(value) IS DISTINCT FROM 'object'
          OR length(btrim(coalesce(value->>'id', ''))) NOT BETWEEN 1 AND 128
          OR value->>'donoCharacterId' IS DISTINCT FROM p_character_id
     )
     OR (SELECT count(*) FROM jsonb_array_elements(v_proposed_catalog)) <>
        (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(v_proposed_catalog) AS item(value)) THEN
    RETURN false;
  END IF;

  FOR v_candidate IN SELECT value FROM jsonb_array_elements(v_proposed_catalog) AS item(value) LOOP
    v_id := v_candidate->>'id';
    SELECT value INTO v_previous
    FROM jsonb_array_elements(v_current_catalog) AS item(value)
    WHERE value->>'id' = v_id;
    v_request_id := nullif(v_candidate->>'solicitacaoAprovacaoId', '');

    IF v_request_id IS NULL THEN
      -- Modelos legados podem manter apenas seu estado runtime; não podem ser
      -- editados ou receber uma aprovação forjada pelo cliente.
      IF v_previous IS NULL OR
         (v_candidate - 'hpAtual') IS DISTINCT FROM (v_previous - 'hpAtual') THEN
        RETURN false;
      END IF;
      CONTINUE;
    END IF;

    SELECT * INTO v_request
    FROM public.invocation_approval_requests
    WHERE request_id::text = v_request_id;
    IF NOT FOUND
       OR v_request.invocation_id IS DISTINCT FROM v_id
       OR v_request.owner_character_id IS DISTINCT FROM p_character_id
       OR v_request.version_submitted::text IS DISTINCT FROM v_candidate->>'versaoModelo'
       OR v_request.status IS DISTINCT FROM v_candidate->>'aprovacaoMestre'
       OR v_request.approved_version::text IS DISTINCT FROM v_candidate->>'versaoAprovada'
       OR v_request.reason IS DISTINCT FROM v_candidate->>'motivoRejeicao'
       OR (v_candidate - ARRAY['aprovacaoMestre', 'versaoAprovada', 'solicitacaoAprovacaoId', 'motivoRejeicao', 'hpAtual'])
         IS DISTINCT FROM (v_request.snapshot - 'hpAtual')
       OR EXISTS (
         SELECT 1 FROM public.invocation_approval_requests AS newer
         WHERE newer.invocation_id = v_id
           AND newer.version_submitted > v_request.version_submitted
       ) THEN
      RETURN false;
    END IF;
  END LOOP;

  FOR v_previous IN SELECT value FROM jsonb_array_elements(v_current_catalog) AS item(value) LOOP
    v_id := v_previous->>'id';
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_proposed_catalog) AS item(value)
      WHERE value->>'id' = v_id
    ) AND (
      v_previous->>'aprovacaoMestre' = 'pendente'
      OR v_previous->>'perdaPermanente' = 'true'
      OR EXISTS (
         SELECT 1 FROM jsonb_array_elements(
           CASE WHEN jsonb_typeof(p_current_character->'instanciasInvocacao') = 'array'
            THEN p_current_character->'instanciasInvocacao' ELSE '[]'::jsonb END
        ) AS instance(value)
        WHERE value->>'modeloId' = v_id AND coalesce(value->>'estado', '') <> 'dissipada'
      )
    ) THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.character_invocation_catalog_is_authorized(text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;

-- Gravações diretas da fatia characters ficam bloqueadas até no papel Master.
-- A RPC abaixo é a única escrita cliente autorizada para essa fatia.
DROP POLICY IF EXISTS "Mesa compartilhada: criar por fatia" ON public.realtime_world;
DROP POLICY IF EXISTS "Mesa compartilhada: atualizar por fatia" ON public.realtime_world;

CREATE POLICY "Mesa compartilhada: criar por fatia"
  ON public.realtime_world FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND slice <> 'characters'
    AND (
      slice NOT IN ('worldBosses', 'worldBossesMaster', 'worldMap', 'chronos', 'omniEntidades')
      OR public.has_role(auth.uid(), 'master'::public.app_role)
    )
  );

CREATE POLICY "Mesa compartilhada: atualizar por fatia"
  ON public.realtime_world FOR UPDATE TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND slice <> 'characters'
    AND (
      slice NOT IN ('worldBosses', 'worldBossesMaster', 'worldMap', 'chronos', 'omniEntidades')
      OR public.has_role(auth.uid(), 'master'::public.app_role)
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND slice <> 'characters'
    AND (
      slice NOT IN ('worldBosses', 'worldBossesMaster', 'worldMap', 'chronos', 'omniEntidades')
      OR public.has_role(auth.uid(), 'master'::public.app_role)
    )
  );

CREATE OR REPLACE FUNCTION public.write_owned_characters_slice(
  p_request_id uuid,
  p_expected_revision bigint,
  p_characters jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_master boolean;
  v_request jsonb;
  v_receipt public.character_slice_write_receipts%ROWTYPE;
  v_current jsonb;
  v_next jsonb := '[]'::jsonb;
  v_character jsonb;
  v_candidate jsonb;
  v_character_id text;
  v_owner_id uuid;
  v_revision bigint;
  v_next_revision bigint;
  v_row_exists boolean := false;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL OR coalesce(auth.role(), '') <> 'authenticated' THEN
    RAISE EXCEPTION 'Autenticação necessária para gravar personagens.' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision < 0
     OR p_characters IS NULL OR jsonb_typeof(p_characters) IS DISTINCT FROM 'array'
     OR pg_column_size(p_characters) > 8388608
     OR jsonb_array_length(p_characters) > 1000 THEN
    RAISE EXCEPTION 'Solicitação de personagens inválida.' USING ERRCODE = '22023';
  END IF;

  v_is_master := public.has_role(v_user_id, 'master'::public.app_role);
  v_request := jsonb_build_object(
    'expectedRevision', p_expected_revision,
    'characters', p_characters
  );

  -- Serializa todos os escritores da mesma fatia, inclusive a primeira
  -- inserção quando ainda não existe uma linha para bloquear com FOR UPDATE.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('realtime_world:characters', 0)
  );

  SELECT * INTO v_receipt
  FROM public.character_slice_write_receipts
  WHERE user_id = v_user_id AND request_id = p_request_id;
  IF FOUND THEN
    IF v_receipt.request <> v_request THEN
      RAISE EXCEPTION 'requestId já utilizado com conteúdo diferente.' USING ERRCODE = '22023';
    END IF;
    RETURN v_receipt.result || jsonb_build_object('duplicate', true);
  END IF;

  SELECT data, revision INTO v_current, v_revision
  FROM public.realtime_world
  WHERE slice = 'characters'
  FOR UPDATE;
  v_row_exists := FOUND;
  IF NOT v_row_exists THEN
    IF NOT v_is_master THEN
      RAISE EXCEPTION 'A fatia de personagens ainda não foi inicializada pelo Mestre.' USING ERRCODE = '42501';
    END IF;
    v_current := '[]'::jsonb;
    v_revision := 0;
  END IF;
  IF v_revision <> p_expected_revision THEN
    RAISE EXCEPTION 'A fatia de personagens mudou; carregue a revisão atual.' USING ERRCODE = '40001';
  END IF;
  IF jsonb_typeof(v_current) IS DISTINCT FROM 'array'
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(v_current) AS item(value)
       WHERE jsonb_typeof(value) IS DISTINCT FROM 'object'
          OR length(btrim(coalesce(value->>'id', ''))) NOT BETWEEN 1 AND 128
     )
     OR (SELECT count(*) FROM jsonb_array_elements(v_current)) <>
        (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(v_current) AS item(value)) THEN
    RAISE EXCEPTION 'A fatia atual de personagens está inválida.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_characters) AS item(value)
       WHERE jsonb_typeof(value) IS DISTINCT FROM 'object'
          OR length(btrim(coalesce(value->>'id', ''))) NOT BETWEEN 1 AND 128
     )
     OR (SELECT count(*) FROM jsonb_array_elements(p_characters)) <>
        (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(p_characters) AS item(value)) THEN
    RAISE EXCEPTION 'Cada ficha precisa ter um ID único e válido.' USING ERRCODE = '22023';
  END IF;

  IF v_is_master THEN
    v_next := p_characters;
  ELSE
    IF jsonb_array_length(v_current) <> jsonb_array_length(p_characters)
       OR EXISTS (
         SELECT 1 FROM jsonb_array_elements(v_current) AS current_item(value)
         WHERE NOT EXISTS (
           SELECT 1 FROM jsonb_array_elements(p_characters) AS proposed_item(value)
            WHERE proposed_item.value->>'id' = current_item.value->>'id'
         )
       )
       OR EXISTS (
         SELECT 1 FROM jsonb_array_elements(p_characters) AS proposed_item(value)
         WHERE NOT EXISTS (
           SELECT 1 FROM jsonb_array_elements(v_current) AS current_item(value)
           WHERE current_item.value->>'id' = proposed_item.value->>'id'
         )
       ) THEN
      RAISE EXCEPTION 'Jogadores não podem criar ou remover fichas pela fatia compartilhada.' USING ERRCODE = '42501';
    END IF;

    FOR v_character IN SELECT value FROM jsonb_array_elements(v_current) AS item(value) LOOP
      v_character_id := v_character->>'id';
      SELECT value INTO v_candidate
      FROM jsonb_array_elements(p_characters) AS item(value)
      WHERE value->>'id' = v_character_id;
      SELECT owner_user_id INTO v_owner_id
      FROM public.combat_character_owners
      WHERE character_id = v_character_id;
      IF v_owner_id = v_user_id THEN
        IF NOT public.character_invocation_catalog_is_authorized(v_character_id, v_character, v_candidate) THEN
          RAISE EXCEPTION 'Ficha de invocação alterada sem uma versão correspondente ao fluxo de aprovação.' USING ERRCODE = '42501';
        END IF;
        v_next := v_next || jsonb_build_array(v_candidate);
      ELSE
        -- Uma cópia antiga enviada pelo jogador nunca substitui fichas alheias.
        v_next := v_next || jsonb_build_array(v_character);
      END IF;
    END LOOP;
  END IF;

  IF v_next IS DISTINCT FROM v_current THEN
    IF v_row_exists THEN
      UPDATE public.realtime_world
      SET data = v_next
      RETURNING revision INTO v_next_revision;
    ELSE
      INSERT INTO public.realtime_world (slice, data)
      VALUES ('characters', v_next)
      RETURNING revision INTO v_next_revision;
    END IF;
  ELSE
    v_next_revision := v_revision;
  END IF;

  v_result := jsonb_build_object(
    'revision', v_next_revision,
    'data', v_next,
    'duplicate', false
  );
  INSERT INTO public.character_slice_write_receipts (user_id, request_id, request, result)
  VALUES (v_user_id, p_request_id, v_request, v_result);
  DELETE FROM public.character_slice_write_receipts
  WHERE user_id = v_user_id AND created_at < now() - interval '90 days';
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.write_owned_characters_slice(uuid, bigint, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.write_owned_characters_slice(uuid, bigint, jsonb) TO authenticated;

COMMENT ON FUNCTION public.write_owned_characters_slice(uuid, bigint, jsonb) IS
  'CAS idempotente para a fatia characters: Mestre grava a lista; jogador só altera fichas já vinculadas à sua conta.';
