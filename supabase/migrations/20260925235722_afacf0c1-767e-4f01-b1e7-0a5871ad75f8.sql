CREATE TABLE public.realtime_world (
  slice text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.realtime_assets (
  id text PRIMARY KEY,
  mime text NOT NULL DEFAULT 'application/octet-stream',
  data_base64 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.realtime_world TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.realtime_assets TO anon, authenticated;
GRANT ALL ON public.realtime_world TO service_role;
GRANT ALL ON public.realtime_assets TO service_role;
ALTER TABLE public.realtime_world ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realtime_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mesa compartilhada: leitura" ON public.realtime_world FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Mesa compartilhada: criar" ON public.realtime_world FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Mesa compartilhada: atualizar" ON public.realtime_world FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Imagens da mesa: leitura" ON public.realtime_assets FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Imagens da mesa: criar" ON public.realtime_assets FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Imagens da mesa: atualizar" ON public.realtime_assets FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE OR REPLACE FUNCTION public.touch_realtime_world() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER realtime_world_touch BEFORE UPDATE ON public.realtime_world FOR EACH ROW EXECUTE FUNCTION public.touch_realtime_world();
ALTER PUBLICATION supabase_realtime ADD TABLE public.realtime_world;
ALTER PUBLICATION supabase_realtime ADD TABLE public.realtime_assets;