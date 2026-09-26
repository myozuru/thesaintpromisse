REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_first_master() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_master(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_masters() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_first_master() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_master(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_masters() TO authenticated;