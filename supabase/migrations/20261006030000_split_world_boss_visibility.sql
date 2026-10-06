-- Mantém a ficha completa do Chefe disponível às contas Master e retira os
-- valores ocultos da linha pública que jogadores recebem por Realtime.
INSERT INTO public.realtime_world (slice, data)
SELECT 'worldBossesMaster', data
FROM public.realtime_world
WHERE slice = 'worldBosses'
ON CONFLICT (slice) DO NOTHING;

UPDATE public.realtime_world
SET data = jsonb_build_object('bosses', '{}'::jsonb, 'worldMarkers', '[]'::jsonb)
WHERE slice = 'worldBosses';

DROP POLICY IF EXISTS "Mesa compartilhada: leitura autenticada" ON public.realtime_world;
DROP POLICY IF EXISTS "Mesa compartilhada: criar autenticado" ON public.realtime_world;
DROP POLICY IF EXISTS "Mesa compartilhada: atualizar autenticado" ON public.realtime_world;

CREATE POLICY "Mesa compartilhada: leitura por fatia"
  ON public.realtime_world FOR SELECT TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (slice <> 'worldBossesMaster' OR public.has_role(auth.uid(), 'master'::public.app_role))
  );
CREATE POLICY "Mesa compartilhada: criar por fatia"
  ON public.realtime_world FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      slice NOT IN ('worldBosses', 'worldBossesMaster')
      OR public.has_role(auth.uid(), 'master'::public.app_role)
    )
  );
CREATE POLICY "Mesa compartilhada: atualizar por fatia"
  ON public.realtime_world FOR UPDATE TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (
      slice NOT IN ('worldBosses', 'worldBossesMaster')
      OR public.has_role(auth.uid(), 'master'::public.app_role)
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      slice NOT IN ('worldBosses', 'worldBossesMaster')
      OR public.has_role(auth.uid(), 'master'::public.app_role)
    )
  );

COMMENT ON COLUMN public.realtime_world.slice IS
  'worldBosses contém apenas projeção pública; worldBossesMaster é legível e gravável apenas por usuários Master.';
