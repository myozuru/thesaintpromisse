-- O aplicativo exige uma conta autenticada antes de abrir a mesa.
-- Remove leitura/escrita anônima que expunha o estado completo da campanha.
REVOKE ALL PRIVILEGES ON TABLE public.realtime_world FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.realtime_assets FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.realtime_world TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.realtime_assets TO authenticated;

DROP POLICY IF EXISTS "Mesa compartilhada: leitura" ON public.realtime_world;
DROP POLICY IF EXISTS "Mesa compartilhada: criar" ON public.realtime_world;
DROP POLICY IF EXISTS "Mesa compartilhada: atualizar" ON public.realtime_world;
DROP POLICY IF EXISTS "Imagens da mesa: leitura" ON public.realtime_assets;
DROP POLICY IF EXISTS "Imagens da mesa: criar" ON public.realtime_assets;
DROP POLICY IF EXISTS "Imagens da mesa: atualizar" ON public.realtime_assets;

CREATE POLICY "Mesa compartilhada: leitura autenticada"
  ON public.realtime_world FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Mesa compartilhada: criar autenticado"
  ON public.realtime_world FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Mesa compartilhada: atualizar autenticado"
  ON public.realtime_world FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Imagens da mesa: leitura autenticada"
  ON public.realtime_assets FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Imagens da mesa: criar autenticado"
  ON public.realtime_assets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Imagens da mesa: atualizar autenticado"
  ON public.realtime_assets FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Um usuário consulta o próprio papel. Um Mestre pode consultar papéis alheios
-- para administração; jogadores não podem enumerar quem tem papel de Mestre.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      _user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_roles caller
        WHERE caller.user_id = auth.uid() AND caller.role = 'master'
      )
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles target
      WHERE target.user_id = _user_id AND target.role = _role
    );
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
