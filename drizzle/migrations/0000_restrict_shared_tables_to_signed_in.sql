DROP POLICY IF EXISTS "Mesa compartilhada: atualizar" ON public.realtime_world;
DROP POLICY IF EXISTS "Mesa compartilhada: criar" ON public.realtime_world;
DROP POLICY IF EXISTS "Mesa compartilhada: leitura" ON public.realtime_world;
CREATE POLICY "Mesa compartilhada: leitura" ON public.realtime_world FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Mesa compartilhada: criar" ON public.realtime_world FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Mesa compartilhada: atualizar" ON public.realtime_world FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
REVOKE ALL ON public.realtime_world FROM anon;

DROP POLICY IF EXISTS "Imagens da mesa: atualizar" ON public.realtime_assets;
DROP POLICY IF EXISTS "Imagens da mesa: criar" ON public.realtime_assets;
DROP POLICY IF EXISTS "Imagens da mesa: leitura" ON public.realtime_assets;
CREATE POLICY "Imagens da mesa: leitura" ON public.realtime_assets FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Imagens da mesa: criar" ON public.realtime_assets FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Imagens da mesa: atualizar" ON public.realtime_assets FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
REVOKE ALL ON public.realtime_assets FROM anon;

DROP POLICY IF EXISTS "Perfis visiveis" ON public.profiles;
CREATE POLICY "Perfis visiveis" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.profiles FROM anon;

CREATE OR REPLACE FUNCTION public.nick_em_uso(_nick text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE nick = _nick)
$$;
GRANT EXECUTE ON FUNCTION public.nick_em_uso(text) TO anon, authenticated;