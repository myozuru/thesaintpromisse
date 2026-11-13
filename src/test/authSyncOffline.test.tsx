// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

const { getUser, onAuthStateChange } = vi.hoisted(() => ({ getUser: vi.fn(), onAuthStateChange: vi.fn() }));
vi.mock('@/integrations/supabase/workspaceCloudConfig', () => ({ hasWorkspaceCloud: false }));
vi.mock('@/lib/auth', () => ({ authDb: { auth: { getUser, onAuthStateChange } }, applyUser: vi.fn() }));

import { AuthSync } from '@/components/AuthSync';

it('não inicializa autenticação de nuvem quando a prévia não está configurada', () => {
  render(<AuthSync />);
  expect(getUser).not.toHaveBeenCalled();
  expect(onAuthStateChange).not.toHaveBeenCalled();
});
