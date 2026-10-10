-- Marca como a solicitação entrou no registro autoritativo, incluindo fichas legadas
-- cuja pendência existia apenas no cache antes da fila do servidor.
ALTER TABLE public.invocation_approval_requests
  ADD COLUMN IF NOT EXISTS submission_origin text NOT NULL DEFAULT 'jogador';

ALTER TABLE public.invocation_approval_requests
  ADD CONSTRAINT invocation_approval_submission_origin_check
  CHECK (submission_origin IN ('jogador', 'mestre', 'legado'));
