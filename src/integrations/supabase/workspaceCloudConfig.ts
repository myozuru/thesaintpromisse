const env = (typeof import.meta !== 'undefined' ? import.meta.env : undefined) as
  | Record<string, string | undefined>
  | undefined;

export const workspaceCloudConfig = {
  url: env?.VITE_SUPABASE_URL,
  key: env?.VITE_SUPABASE_PUBLISHABLE_KEY,
};

export const hasWorkspaceCloud = Boolean(
  workspaceCloudConfig.url && workspaceCloudConfig.key,
);
