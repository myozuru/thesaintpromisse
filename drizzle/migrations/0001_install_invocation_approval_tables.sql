CREATE TABLE IF NOT EXISTS public.combat_character_owners (
  character_id text PRIMARY KEY CHECK (length(btrim(character_id)) BETWEEN 1 AND 128),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES auth.users(id),
  assigned_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS combat_character_owners_user_idx ON public.combat_character_owners (owner_user_id);
REVOKE ALL PRIVILEGES ON TABLE public.combat_character_owners FROM anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.combat_character_owners TO service_role;
ALTER TABLE public.combat_character_owners ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.invocation_approval_requests (
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
  submission_origin text NOT NULL DEFAULT 'jogador' CHECK (submission_origin IN ('jogador', 'mestre', 'legado')),
  CONSTRAINT invocation_approval_review_state_check CHECK (
    (status = 'pendente' AND reviewed_by IS NULL AND reviewed_at IS NULL AND approved_version IS NULL)
    OR (status = 'aprovada' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND approved_version = version_submitted)
    OR (status = 'rejeitada' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND approved_version IS NULL AND length(btrim(coalesce(reason, ''))) > 0)
  )
);
CREATE INDEX IF NOT EXISTS invocation_approval_owner_idx ON public.invocation_approval_requests (owner_character_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS invocation_approval_pending_idx ON public.invocation_approval_requests (submitted_at) WHERE status = 'pendente';
CREATE UNIQUE INDEX IF NOT EXISTS invocation_approval_one_pending_per_invocation_idx ON public.invocation_approval_requests (invocation_id) WHERE status = 'pendente';
CREATE UNIQUE INDEX IF NOT EXISTS invocation_approval_version_unique_idx ON public.invocation_approval_requests (invocation_id, version_submitted);
REVOKE ALL PRIVILEGES ON TABLE public.invocation_approval_requests FROM anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.invocation_approval_requests TO service_role;
ALTER TABLE public.invocation_approval_requests ENABLE ROW LEVEL SECURITY;