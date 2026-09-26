CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  nick text NOT NULL UNIQUE,
  avatar text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Perfis visiveis" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Criar proprio perfil" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Editar proprio perfil" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TYPE public.app_role AS ENUM ('master', 'player');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver proprios papeis" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- A primeira conta criada vira Mestre automaticamente.
CREATE OR REPLACE FUNCTION public.claim_first_master()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(424242);
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'master') THEN RETURN false; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'master');
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.set_master(_target uuid, _make boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'master') THEN RAISE EXCEPTION 'Apenas o Mestre pode fazer isso'; END IF;
  IF _make THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_target, 'master') ON CONFLICT DO NOTHING;
  ELSE
    IF _target = auth.uid() THEN RAISE EXCEPTION 'Você não pode remover seu próprio acesso de Mestre'; END IF;
    DELETE FROM public.user_roles WHERE user_id = _target AND role = 'master';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.list_masters()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id FROM public.user_roles WHERE role = 'master' AND public.has_role(auth.uid(), 'master')
$$;

REVOKE EXECUTE ON FUNCTION public.claim_first_master() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_master(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_masters() FROM anon;