-- Registro autoritativo das solicitações de aquisição de invocações.
-- A ficha local continua sendo um cache; somente Server Functions com service_role
-- podem criar ou transicionar solicitações.
CREATE TABLE public.invocation_approval_requests (
  request_id uuid PRIMARY KEY,
  invocation_id text NOT NULL CHECK (length(btrim(invocation_id)) BETWEEN 1 AND 128),
  owner_character_id text NOT NULL CHECK (length(btrim(owner_character_id)) BETWEEN 1 AND 128),
  version_submitted integer NOT NULL CHECK (version_submitted >= 1),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  submitted_by uuid NOT NULL REFERENCES auth.users(id),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('pendente', 'aprovada', 'rejeitada')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  reason text,
  approved_version integer CHECK (approved_version IS NULL OR approved_version >= 1),
  CONSTRAINT invocation_approval_review_state_check CHECK (
    (status = 'pendente' AND reviewed_by IS NULL AND reviewed_at IS NULL AND approved_version IS NULL)
    OR
    (status = 'aprovada' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND approved_version = version_submitted)
    OR
    (status = 'rejeitada' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND approved_version IS NULL AND length(btrim(coalesce(reason, ''))) > 0)
  )
);

CREATE INDEX invocation_approval_owner_idx
  ON public.invocation_approval_requests (owner_character_id, submitted_at DESC);

CREATE INDEX invocation_approval_pending_idx
  ON public.invocation_approval_requests (submitted_at)
  WHERE status = 'pendente';

CREATE UNIQUE INDEX invocation_approval_one_pending_per_invocation_idx
  ON public.invocation_approval_requests (invocation_id)
  WHERE status = 'pendente';

ALTER TABLE public.invocation_approval_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.invocation_approval_requests FROM anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.invocation_approval_requests TO service_role;

COMMENT ON TABLE public.invocation_approval_requests IS
  'Snapshot imutável da versão submetida para aquisição de uma invocação; transições executadas por Server Functions autorizadas.';
