-- A propriedade da ficha é uma relação privada e definida pelo Mestre.
-- profileId dentro do snapshot `characters` é dado controlado pelo cliente e
-- nunca serve como prova de autorização para uma intenção de combate.
CREATE TABLE public.combat_character_owners (
  character_id text PRIMARY KEY CHECK (length(btrim(character_id)) BETWEEN 1 AND 128),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES auth.users(id),
  assigned_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX combat_character_owners_user_idx
  ON public.combat_character_owners (owner_user_id);

ALTER TABLE public.combat_character_owners ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.combat_character_owners FROM anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.combat_character_owners TO service_role;

COMMENT ON TABLE public.combat_character_owners IS
  'Vínculo privado entre uma ficha e a conta Supabase que pode enviar intenções em seu nome; gravado somente por Server Functions autorizadas ao Mestre.';
