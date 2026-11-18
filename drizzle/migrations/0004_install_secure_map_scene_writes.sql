-- Gravações do mapa passam por uma RPC autenticada. Jogadores enviam apenas
-- posições de tokens existentes ligados às próprias fichas; o Mestre publica
-- a cena completa com revisão otimista.
CREATE TABLE IF NOT EXISTS public.map_scene_write_receipts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  request jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id)
);
ALTER TABLE public.map_scene_write_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.map_scene_write_receipts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.map_scene_write_receipts TO service_role;

-- Bloqueia também gravações diretas do Mestre: clientes usam a RPC versionada.
DROP POLICY IF EXISTS "Mesa compartilhada: criar por fatia" ON public.realtime_world;
DROP POLICY IF EXISTS "Mesa compartilhada: atualizar por fatia" ON public.realtime_world;

CREATE POLICY "Mesa compartilhada: criar por fatia"
  ON public.realtime_world FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND slice NOT IN ('characters', 'mapScene')
    AND (
      slice NOT IN ('worldBosses', 'worldBossesMaster', 'worldMap', 'chronos', 'omniEntidades')
      OR public.has_role(auth.uid(), 'master'::public.app_role)
    )
  );

CREATE POLICY "Mesa compartilhada: atualizar por fatia"
  ON public.realtime_world FOR UPDATE TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND slice NOT IN ('characters', 'mapScene')
    AND (
      slice NOT IN ('worldBosses', 'worldBossesMaster', 'worldMap', 'chronos', 'omniEntidades')
      OR public.has_role(auth.uid(), 'master'::public.app_role)
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND slice NOT IN ('characters', 'mapScene')
    AND (
      slice NOT IN ('worldBosses', 'worldBossesMaster', 'worldMap', 'chronos', 'omniEntidades')
      OR public.has_role(auth.uid(), 'master'::public.app_role)
    )
  );

CREATE OR REPLACE FUNCTION public.write_owned_map_scene(
  p_request_id uuid,
  p_expected_revision bigint,
  p_map_scene jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_master boolean;
  v_request jsonb;
  v_receipt public.map_scene_write_receipts%ROWTYPE;
  v_current jsonb;
  v_next jsonb;
  v_scene_id text;
  v_scene jsonb;
  v_entity_id text;
  v_entity jsonb;
  v_candidate jsonb;
  v_next_entity jsonb;
  v_owner_character_id text;
  v_owner_user_id uuid;
  v_x numeric;
  v_y numeric;
  v_revision bigint;
  v_next_revision bigint;
  v_row_exists boolean := false;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL OR coalesce(auth.role(), '') <> 'authenticated' THEN
    RAISE EXCEPTION 'Autenticação necessária para gravar o mapa.' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision < 0
     OR p_map_scene IS NULL OR jsonb_typeof(p_map_scene) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_map_scene->'scenes') IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_map_scene->'sceneOrder') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_map_scene->'activeSceneId') IS DISTINCT FROM 'string'
     OR jsonb_typeof(p_map_scene->'layerVisible') IS DISTINCT FROM 'object'
     OR pg_column_size(p_map_scene) > 8388608
     OR jsonb_object_length(p_map_scene->'scenes') > 200 THEN
    RAISE EXCEPTION 'Solicitação de mapa inválida.' USING ERRCODE = '22023';
  END IF;

  v_is_master := public.has_role(v_user_id, 'master'::public.app_role);
  v_request := jsonb_build_object(
    'expectedRevision', p_expected_revision,
    'mapScene', p_map_scene
  );

  -- Protege a primeira inserção e serializa alterações concorrentes à mesma cena.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('realtime_world:mapScene', 0)
  );

  SELECT * INTO v_receipt
  FROM public.map_scene_write_receipts
  WHERE user_id = v_user_id AND request_id = p_request_id;
  IF FOUND THEN
    IF v_receipt.request <> v_request THEN
      RAISE EXCEPTION 'requestId já utilizado com conteúdo diferente.' USING ERRCODE = '22023';
    END IF;
    RETURN v_receipt.result || jsonb_build_object('duplicate', true);
  END IF;

  SELECT data, revision INTO v_current, v_revision
  FROM public.realtime_world
  WHERE slice = 'mapScene'
  FOR UPDATE;
  v_row_exists := FOUND;
  IF NOT v_row_exists THEN
    IF NOT v_is_master THEN
      RAISE EXCEPTION 'O Mestre precisa inicializar o mapa antes da movimentação dos jogadores.' USING ERRCODE = '42501';
    END IF;
    v_current := NULL;
    v_revision := 0;
  ELSIF jsonb_typeof(v_current) IS DISTINCT FROM 'object'
     OR jsonb_typeof(v_current->'scenes') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'A cena atual do mapa está inválida.' USING ERRCODE = '22023';
  END IF;

  IF p_expected_revision > v_revision THEN
    RAISE EXCEPTION 'A revisão informada é posterior à revisão do mapa.' USING ERRCODE = '40001';
  END IF;
  IF v_is_master AND p_expected_revision <> v_revision THEN
    RAISE EXCEPTION 'O mapa mudou; carregue a revisão atual.' USING ERRCODE = '40001';
  END IF;

  IF v_is_master THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_each(p_map_scene->'scenes') AS scene_item(key, value)
      WHERE jsonb_typeof(value) IS DISTINCT FROM 'object'
         OR (value ? 'entities' AND jsonb_typeof(value->'entities') IS DISTINCT FROM 'object')
    ) OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_map_scene->'sceneOrder') AS item(value)
      WHERE jsonb_typeof(value) IS DISTINCT FROM 'string'
         OR NOT ((p_map_scene->'scenes') ? (value #>> '{}'))
    ) OR (SELECT count(*) FROM jsonb_array_elements(p_map_scene->'sceneOrder')) <>
         (SELECT count(DISTINCT value #>> '{}') FROM jsonb_array_elements(p_map_scene->'sceneOrder') AS item(value))
       OR (jsonb_object_length(p_map_scene->'scenes') > 0 AND
           NOT ((p_map_scene->'scenes') ? (p_map_scene->>'activeSceneId'))) THEN
      RAISE EXCEPTION 'A cena enviada pelo Mestre tem estrutura inválida.' USING ERRCODE = '22023';
    END IF;
    v_next := p_map_scene;
  ELSE
    IF NOT v_row_exists THEN
      RAISE EXCEPTION 'O Mestre precisa inicializar o mapa antes da movimentação dos jogadores.' USING ERRCODE = '42501';
    END IF;
    v_next := v_current;
    FOR v_scene_id, v_scene IN
      SELECT key, value FROM jsonb_each(v_current->'scenes') ORDER BY key
    LOOP
      IF jsonb_typeof(v_scene->'entities') IS DISTINCT FROM 'object' THEN
        CONTINUE;
      END IF;
      FOR v_entity_id, v_entity IN
        SELECT key, value FROM jsonb_each(v_scene->'entities') ORDER BY key
      LOOP
        v_owner_character_id := coalesce(
          nullif(v_entity->>'ownerCharId', ''),
          nullif(v_entity->>'characterId', '')
        );
        IF v_owner_character_id IS NULL OR v_entity->>'locked' = 'true' THEN
          CONTINUE;
        END IF;
        SELECT owner_user_id INTO v_owner_user_id
        FROM public.combat_character_owners
        WHERE character_id = v_owner_character_id;
        IF v_owner_user_id IS DISTINCT FROM v_user_id THEN
          CONTINUE;
        END IF;

        v_candidate := p_map_scene #> ARRAY['scenes', v_scene_id, 'entities', v_entity_id];
        IF v_candidate IS NULL THEN
          CONTINUE;
        END IF;
        IF jsonb_typeof(v_candidate) IS DISTINCT FROM 'object'
           OR jsonb_typeof(v_candidate->'x') IS DISTINCT FROM 'number'
           OR jsonb_typeof(v_candidate->'y') IS DISTINCT FROM 'number' THEN
          RAISE EXCEPTION 'A posição de um token precisa conter coordenadas numéricas.' USING ERRCODE = '22023';
        END IF;
        v_x := (v_candidate->>'x')::numeric;
        v_y := (v_candidate->>'y')::numeric;
        IF abs(v_x) > 10000000 OR abs(v_y) > 10000000 THEN
          RAISE EXCEPTION 'A posição excede os limites do mapa.' USING ERRCODE = '22023';
        END IF;
        IF v_entity->'x' IS DISTINCT FROM v_candidate->'x'
           OR v_entity->'y' IS DISTINCT FROM v_candidate->'y' THEN
          v_next_entity := jsonb_set(
            jsonb_set(v_entity, '{x}', v_candidate->'x', true),
            '{y}', v_candidate->'y', true
          );
          v_next := jsonb_set(
            v_next,
            ARRAY['scenes', v_scene_id, 'entities', v_entity_id],
            v_next_entity,
            false
          );
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  IF NOT v_row_exists THEN
    INSERT INTO public.realtime_world (slice, data)
    VALUES ('mapScene', v_next)
    RETURNING revision INTO v_next_revision;
  ELSIF v_next IS DISTINCT FROM v_current THEN
    UPDATE public.realtime_world
    SET data = v_next
    WHERE slice = 'mapScene'
    RETURNING revision INTO v_next_revision;
  ELSE
    v_next_revision := v_revision;
  END IF;

  v_result := jsonb_build_object(
    'revision', v_next_revision,
    'data', v_next,
    'duplicate', false,
    'changed', v_next IS DISTINCT FROM v_current,
    'role', CASE WHEN v_is_master THEN 'master' ELSE 'player' END
  );
  INSERT INTO public.map_scene_write_receipts (user_id, request_id, request, result)
  VALUES (v_user_id, p_request_id, v_request, v_result);
  DELETE FROM public.map_scene_write_receipts
  WHERE user_id = v_user_id AND created_at < now() - interval '90 days';
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.write_owned_map_scene(uuid, bigint, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.write_owned_map_scene(uuid, bigint, jsonb) TO authenticated;

COMMENT ON FUNCTION public.write_owned_map_scene(uuid, bigint, jsonb) IS
  'CAS idempotente: Mestre grava mapScene; jogador só define x/y de tokens existentes vinculados às próprias fichas.';
