import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

/**
 * TanStack Server Functions do not inherit Supabase's local-storage session.
 * Forward only its access token as a header; `requireSupabaseAuth` verifies
 * the JWT with Supabase before deriving the requester's identity.
 */
export const forwardSupabaseFunctionAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    // Client middleware also runs during SSR. There is no browser session in
    // that environment, so the server auth middleware will reject the request.
    if (typeof window === "undefined") return next();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? next({ headers: { Authorization: `Bearer ${token}` } }) : next();
  },
);
