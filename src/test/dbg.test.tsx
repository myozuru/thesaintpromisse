// @vitest-environment jsdom
import { it, vi, afterEach } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('@/test/helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('@/test/helpers/mesaReal')).nuvemFalsa }));
import { render, cleanup } from '@testing-library/react';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { ficha, montarMesa, limparMesa, comoTela } from '@/test/helpers/mesaReal';

afterEach(() => { cleanup(); limparMesa(); });

it('debug', () => {
  const a = ficha('ana', { profileId: 'p-ana', mainHandWeaponName: 'Espada Longa' } as never);
  const b = ficha('bruno', { category: 'INIMIGO' } as never);
  montarMesa([a, b], { ana: [0, 0], bruno: [1, 0] });
  comoTela({ profileId: 'p-ana', role: 'PLAYER' });
  const { container } = render(<AttackPanel character={a} />);
  const selects = container.querySelectorAll('select');
  console.log('num selects:', selects.length);
  selects.forEach((s, i) => console.log(i, Array.from(s.options).map((o) => `${o.value}=${o.textContent}`).join(' | ')));
});
