-- Uma versão de invocação tem um único registro de aprovação no histórico.
-- Alterações precisam avançar a versão em vez de sobrescrever uma decisão anterior.
CREATE UNIQUE INDEX IF NOT EXISTS invocation_approval_version_unique_idx
  ON public.invocation_approval_requests (invocation_id, version_submitted);
