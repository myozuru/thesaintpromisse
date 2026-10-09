-- As políticas de fatia anteriores restringem apenas conteúdo privado de
-- chefes. Também exigimos Mestre para estado de relógio, mapa-múndi, catálogo
-- público de chefes e catálogo de regras OMNI. O cliente pode ler essas fatias;
-- somente uma conta com papel Master pode criá-las ou alterá-las.
DROP POLICY IF EXISTS "Mesa compartilhada: criar por fatia" ON public.realtime_world;
DROP POLICY IF EXISTS "Mesa compartilhada: atualizar por fatia" ON public.realtime_world;

CREATE POLICY "Mesa compartilhada: criar por fatia"
  ON public.realtime_world FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      slice NOT IN ('worldBosses', 'worldBossesMaster', 'worldMap', 'chronos', 'omniEntidades')
      OR public.has_role(auth.uid(), 'master'::public.app_role)
    )
  );

CREATE POLICY "Mesa compartilhada: atualizar por fatia"
  ON public.realtime_world FOR UPDATE TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (
      slice NOT IN ('worldBosses', 'worldBossesMaster', 'worldMap', 'chronos', 'omniEntidades')
      OR public.has_role(auth.uid(), 'master'::public.app_role)
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      slice NOT IN ('worldBosses', 'worldBossesMaster', 'worldMap', 'chronos', 'omniEntidades')
      OR public.has_role(auth.uid(), 'master'::public.app_role)
    )
  );

COMMENT ON POLICY "Mesa compartilhada: criar por fatia" ON public.realtime_world IS
  'Fatias administrativas e o catálogo OMNI só podem ser publicadas por uma conta Master.';
COMMENT ON POLICY "Mesa compartilhada: atualizar por fatia" ON public.realtime_world IS
  'Fatias administrativas e o catálogo OMNI só podem ser alteradas por uma conta Master.';
