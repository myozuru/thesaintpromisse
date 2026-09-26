import { describe, it, expect, beforeEach } from 'vitest';
import { reduceAmizadeMessage, viewerSeesAmizade } from '@/lib/suporteNivel2';
import { createFakeMesa, type FakeClient } from './helpers/fakeMesa';

type Prompt = { supporterId: string; friendId: string } | null;
// dono de cada ficha (simula o que o Mestre escolheu em "Dono de cada ficha")
let owners: Record<string, string | null> = {};

const mesa = createFakeMesa<{ prompt: Prompt }>(() => ({ prompt: null }), {
  amizade: (c: FakeClient<{ prompt: Prompt }>, msg) => {
    const r = reduceAmizadeMessage(msg as never, c.id, (sid) => viewerSeesAmizade(owners[sid], c.viewer));
    if (r.type === 'open') c.state.prompt = { supporterId: r.supporterId, friendId: r.friendId };
    if (r.type === 'close') c.state.prompt = null;
  },
});
const mestre = mesa.join({ name: 'Mestre', role: 'MASTER', profileId: 'p-mestre' });
const ana = mesa.join({ name: 'Ana (Suporte)', role: 'PLAYER', profileId: 'p-ana' });
const bruno = mesa.join({ name: 'Bruno', role: 'PLAYER', profileId: 'p-bruno' });

beforeEach(() => { mesa.reset(); owners = { sup: 'p-ana', semDono: null }; });

describe('Amizade Inquebrável entre várias telas', () => {
  it('Mestre encerra o turno: a pergunta aparece só para a dona do Suporte', () => {
    mestre.send('amizade', { kind: 'open', supporterId: 'sup', friendId: 'amigo' });
    expect(ana.state.prompt).toEqual({ supporterId: 'sup', friendId: 'amigo' });
    expect(bruno.state.prompt).toBeNull();
    expect(mestre.state.prompt).toBeNull();
  });

  it('Ficha sem dono: todos os jogadores veem, o Mestre não', () => {
    mestre.send('amizade', { kind: 'open', supporterId: 'semDono', friendId: 'amigo' });
    expect(ana.state.prompt).not.toBeNull();
    expect(bruno.state.prompt).not.toBeNull();
    expect(mestre.state.prompt).toBeNull();
  });

  it('Quando alguém responde, a pergunta fecha em todas as telas', () => {
    mestre.send('amizade', { kind: 'open', supporterId: 'semDono', friendId: 'amigo' });
    ana.send('amizade', { kind: 'close' });
    expect(bruno.state.prompt).toBeNull();
    expect(ana.state.prompt).not.toBeNull(); // quem respondeu fecha localmente, não pelo canal
  });

  it('Mensagem da própria tela ou incompleta é ignorada', () => {
    expect(reduceAmizadeMessage({ clientId: 'x', kind: 'open', supporterId: 's', friendId: 'f' }, 'x', () => true).type).toBe('ignore');
    expect(reduceAmizadeMessage({ clientId: 'y', kind: 'open' }, 'x', () => true).type).toBe('ignore');
    expect(reduceAmizadeMessage(null, 'x', () => true).type).toBe('ignore');
  });

  it('Dono trocado pelo Mestre: a próxima pergunta segue o novo dono', () => {
    owners.sup = 'p-bruno';
    mestre.send('amizade', { kind: 'open', supporterId: 'sup', friendId: 'amigo' });
    expect(bruno.state.prompt).not.toBeNull();
    expect(ana.state.prompt).toBeNull();
  });
});
