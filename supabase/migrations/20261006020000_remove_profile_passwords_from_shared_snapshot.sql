-- Senhas de perfil são credenciais locais e não podem ser distribuídas pela
-- fatia compartilhada `profiles`.
UPDATE public.realtime_world AS world
SET data = COALESCE(
  (
    SELECT jsonb_agg(entry.profile - 'password')
    FROM jsonb_array_elements(world.data) AS entry(profile)
  ),
  '[]'::jsonb
)
WHERE world.slice = 'profiles'
  AND jsonb_typeof(world.data) = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(world.data) AS entry(profile)
    WHERE entry.profile ? 'password'
  );
