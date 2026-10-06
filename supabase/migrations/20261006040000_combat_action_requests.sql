-- Fila autenticada de intenções. Nenhum cliente escreve diretamente aqui;
-- somente Server Functions com service role executam as transições.
CREATE TABLE public.combat_action_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_character_id text NOT NULL,
  intent jsonb NOT NULL CHECK (jsonb_typeof(intent) = 'object'),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'resolved', 'rejected', 'expired')),
  result jsonb,
  claimed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 minutes'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submitted_by, request_id),
  CHECK ((status IN ('resolved', 'rejected')) = (result IS NOT NULL))
);

CREATE INDEX combat_action_requests_pending_idx
  ON public.combat_action_requests (status, expires_at, created_at)
  WHERE status IN ('pending', 'processing');
CREATE INDEX combat_action_requests_owner_idx
  ON public.combat_action_requests (submitted_by, created_at DESC);

ALTER TABLE public.combat_action_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.combat_action_requests FROM anon, authenticated;
GRANT SELECT ON TABLE public.combat_action_requests TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.combat_action_requests TO service_role;

CREATE POLICY "Solicitante ou Mestre le pedidos de combate"
  ON public.combat_action_requests FOR SELECT TO authenticated
  USING (
    submitted_by = auth.uid()
    OR public.has_role(auth.uid(), 'master'::public.app_role)
  );

COMMENT ON TABLE public.combat_action_requests IS
  'Fila de intenções autenticadas; payloads não confiáveis, sem valores de resolução. Somente Server Functions alteram status/result.';
