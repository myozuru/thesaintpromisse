import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useCharacterStore } from '../stores/useCharacterStore';
import { useLogStore } from '../stores/useLogStore';
import { useDice3DStore } from '../stores/useDice3DStore';

vi.mock('@/lib/omni/eventBus', () => ({
  emitirEvento: vi.fn(() => 0),
}));

describe('Grapple Engine — Fase C', () => {
  beforeEach(() => {
    useCharacterStore.setState({ characters: [] });
    useDice3DStore.setState({ enabled: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makePair() {
    const s = useCharacterStore.getState();
    s.addCharacter('Atacante', 'PLAYER', 'PLAYER');
    s.addCharacter('Alvo', 'NPC' as any, 'MASTER');
    const [att, tgt] = useCharacterStore.getState().characters;
    return { att, tgt };
  }

  it('agarrar bem-sucedido vincula bilateralmente', async () => {
    const { att, tgt } = makePair();
    // Forçar sucesso: rolls fixos altos para attacker, baixos para defesa.
    const seq = [20, 1]; // attacker roll, defender roll
    let i = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      // d20: floor(rand*20)+1 ⇒ rand=0.95 ⇒ 20; rand=0 ⇒ 1
      const v = seq[i++ % seq.length];
      return (v - 1) / 20 + 0.0001;
    });
    const r = await useCharacterStore.getState().grappleAttempt(att.id, tgt.id);
    expect(r.ok).toBe(true);
    expect(r.success).toBe(true);
    const after = useCharacterStore.getState().characters;
    const a = after.find(c => c.id === att.id)!;
    const t = after.find(c => c.id === tgt.id)!;
    expect(a.grappleState?.grappling).toContain(tgt.id);
    expect(t.grappleState?.grappledBy).toContain(att.id);
  });

  it('soltar libera o vínculo nos dois lados', () => {
    const { att, tgt } = makePair();
    // Setup direto sem rolar
    useCharacterStore.setState({
      characters: useCharacterStore.getState().characters.map(c => {
        if (c.id === att.id) return { ...c, grappleState: { grappling: [tgt.id] } };
        if (c.id === tgt.id) return { ...c, grappleState: { grappledBy: [att.id] } };
        return c;
      }),
    });
    useCharacterStore.getState().releaseGrapple(att.id, tgt.id);
    const after = useCharacterStore.getState().characters;
    expect(after.find(c => c.id === att.id)!.grappleState?.grappling).toEqual([]);
    expect(after.find(c => c.id === tgt.id)!.grappleState?.grappledBy).toEqual([]);
  });

  it('escapar bem-sucedido remove vínculo bilateral', async () => {
    const { att, tgt } = makePair();
    useCharacterStore.setState({
      characters: useCharacterStore.getState().characters.map(c => {
        if (c.id === att.id) return { ...c, grappleState: { grappling: [tgt.id] } };
        if (c.id === tgt.id) return { ...c, grappleState: { grappledBy: [att.id] } };
        return c;
      }),
    });
    // Defesa rola 20, agarrador rola 1 ⇒ defesa > ataque
    const seq = [20, 1];
    let i = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      const v = seq[i++ % seq.length];
      return (v - 1) / 20 + 0.0001;
    });
    const r = await useCharacterStore.getState().escapeGrapple(tgt.id, att.id, 'Atletismo');
    expect(r.ok).toBe(true);
    expect(r.success).toBe(true);
    const after = useCharacterStore.getState().characters;
    expect(after.find(c => c.id === att.id)!.grappleState?.grappling).toEqual([]);
    expect(after.find(c => c.id === tgt.id)!.grappleState?.grappledBy).toEqual([]);
  });

  it('releaseAllGrapplesOf libera múltiplos lados ao "morrer"', () => {
    const s = useCharacterStore.getState();
    s.addCharacter('A', 'PLAYER', 'PLAYER');
    s.addCharacter('B', 'PLAYER', 'PLAYER');
    s.addCharacter('C', 'PLAYER', 'PLAYER');
    const [A, B, C] = useCharacterStore.getState().characters;
    // A está agarrando B, e A está sendo agarrado por C.
    useCharacterStore.setState({
      characters: useCharacterStore.getState().characters.map(c => {
        if (c.id === A.id) return { ...c, grappleState: { grappling: [B.id], grappledBy: [C.id] } };
        if (c.id === B.id) return { ...c, grappleState: { grappledBy: [A.id] } };
        if (c.id === C.id) return { ...c, grappleState: { grappling: [A.id] } };
        return c;
      }),
    });
    useCharacterStore.getState().releaseAllGrapplesOf(A.id);
    const after = useCharacterStore.getState().characters;
    const a = after.find(c => c.id === A.id)!;
    const b = after.find(c => c.id === B.id)!;
    const cc = after.find(c => c.id === C.id)!;
    expect(a.grappleState?.grappling).toEqual([]);
    expect(a.grappleState?.grappledBy).toEqual([]);
    expect(b.grappleState?.grappledBy).toEqual([]);
    expect(cc.grappleState?.grappling).toEqual([]);
  });

  it('isGrappled reflete estado corretamente', () => {
    const { att, tgt } = makePair();
    expect(useCharacterStore.getState().isGrappled(tgt.id)).toBe(false);
    useCharacterStore.setState({
      characters: useCharacterStore.getState().characters.map(c =>
        c.id === tgt.id ? { ...c, grappleState: { grappledBy: [att.id] } } : c,
      ),
    });
    expect(useCharacterStore.getState().isGrappled(tgt.id)).toBe(true);
  });

  it('não permite agarrar a si mesmo', async () => {
    const { att } = makePair();
    const r = await useCharacterStore.getState().grappleAttempt(att.id, att.id);
    expect(r.ok).toBe(false);
  });

  it('não permite agarrar duas vezes o mesmo alvo', async () => {
    const { att, tgt } = makePair();
    useCharacterStore.setState({
      characters: useCharacterStore.getState().characters.map(c =>
        c.id === att.id ? { ...c, grappleState: { grappling: [tgt.id] } } : c,
      ),
    });
    const r = await useCharacterStore.getState().grappleAttempt(att.id, tgt.id);
    expect(r.ok).toBe(false);
  });

  // ─── Logs detalhados (rastro completo do ciclo) ─────────────────────────
  describe('Logs detalhados', () => {
    beforeEach(() => {
      useLogStore.setState({ logs: [] });
    });

    it('grappleAttempt: emite log [grapple/attempt] e [grapple/bind] ao acertar', async () => {
      const { att, tgt } = makePair();
      const seq = [20, 1];
      let i = 0;
      vi.spyOn(Math, 'random').mockImplementation(() => {
        const v = seq[i++ % seq.length];
        return (v - 1) / 20 + 0.0001;
      });
      await useCharacterStore.getState().grappleAttempt(att.id, tgt.id);
      const msgs = useLogStore.getState().logs.map(l => l.message);
      expect(msgs.some(m => m.includes('[grapple/attempt]'))).toBe(true);
      expect(msgs.some(m => m.includes('[grapple/bind]'))).toBe(true);
      expect(msgs.some(m => m.includes('Atacante') && m.includes('Alvo'))).toBe(true);
    });

    it('grappleAttempt: emite só [grapple/attempt] ao falhar', async () => {
      const { att, tgt } = makePair();
      const seq = [1, 20];
      let i = 0;
      vi.spyOn(Math, 'random').mockImplementation(() => {
        const v = seq[i++ % seq.length];
        return (v - 1) / 20 + 0.0001;
      });
      await useCharacterStore.getState().grappleAttempt(att.id, tgt.id);
      const msgs = useLogStore.getState().logs.map(l => l.message);
      expect(msgs.some(m => m.includes('[grapple/attempt]') && m.includes('falhou'))).toBe(true);
      expect(msgs.some(m => m.includes('[grapple/bind]'))).toBe(false);
    });

    it('escapeGrapple: emite [grapple/escape] e [grapple/unbind] ao escapar', async () => {
      const { att, tgt } = makePair();
      useCharacterStore.setState({
        characters: useCharacterStore.getState().characters.map(c => {
          if (c.id === att.id) return { ...c, grappleState: { grappling: [tgt.id] } };
          if (c.id === tgt.id) return { ...c, grappleState: { grappledBy: [att.id] } };
          return c;
        }),
      });
      const seq = [20, 1];
      let i = 0;
      vi.spyOn(Math, 'random').mockImplementation(() => {
        const v = seq[i++ % seq.length];
        return (v - 1) / 20 + 0.0001;
      });
      await useCharacterStore.getState().escapeGrapple(tgt.id, att.id, 'Atletismo');
      const msgs = useLogStore.getState().logs.map(l => l.message);
      expect(msgs.some(m => m.includes('[grapple/escape]'))).toBe(true);
      expect(msgs.some(m => m.includes('[grapple/unbind]'))).toBe(true);
    });

    it('releaseGrapple: emite [grapple/release] ao soltar voluntariamente', () => {
      const { att, tgt } = makePair();
      useCharacterStore.setState({
        characters: useCharacterStore.getState().characters.map(c => {
          if (c.id === att.id) return { ...c, grappleState: { grappling: [tgt.id] } };
          if (c.id === tgt.id) return { ...c, grappleState: { grappledBy: [att.id] } };
          return c;
        }),
      });
      useCharacterStore.getState().releaseGrapple(att.id, tgt.id);
      const msgs = useLogStore.getState().logs.map(l => l.message);
      expect(msgs.some(m => m.includes('[grapple/release]'))).toBe(true);
    });

    it('releaseAllGrapplesOf: emite [grapple/release-all] com listagem dos vínculos', () => {
      const s = useCharacterStore.getState();
      s.addCharacter('A', 'PLAYER', 'PLAYER');
      s.addCharacter('B', 'PLAYER', 'PLAYER');
      s.addCharacter('C', 'PLAYER', 'PLAYER');
      const [A, B, C] = useCharacterStore.getState().characters;
      useCharacterStore.setState({
        characters: useCharacterStore.getState().characters.map(c => {
          if (c.id === A.id) return { ...c, grappleState: { grappling: [B.id], grappledBy: [C.id] } };
          if (c.id === B.id) return { ...c, grappleState: { grappledBy: [A.id] } };
          if (c.id === C.id) return { ...c, grappleState: { grappling: [A.id] } };
          return c;
        }),
      });
      useCharacterStore.getState().releaseAllGrapplesOf(A.id);
      const msgs = useLogStore.getState().logs.map(l => l.message);
      const releaseAllMsg = msgs.find(m => m.includes('[grapple/release-all]'));
      expect(releaseAllMsg).toBeDefined();
      expect(releaseAllMsg).toContain('B');
      expect(releaseAllMsg).toContain('C');
    });

    it('releaseAllGrapplesOf: NÃO loga se não há vínculos', () => {
      const { att } = makePair();
      useCharacterStore.getState().releaseAllGrapplesOf(att.id);
      const msgs = useLogStore.getState().logs.map(l => l.message);
      expect(msgs.some(m => m.includes('[grapple/release-all]'))).toBe(false);
    });
  });

  // ─── Ordem de eventos: aoMorrer vê grappleState antes do release ──────
  describe('Ordem de eventos (aoMorrer + grapple)', () => {
    beforeEach(() => {
      useLogStore.setState({ logs: [] });
    });

    it('ao morrer: emite log de aviso ANTES da liberação e libera vínculos depois', async () => {
      const s = useCharacterStore.getState();
      s.addCharacter('Vitima', 'PLAYER', 'PLAYER');
      s.addCharacter('Carrasco', 'PLAYER', 'PLAYER');
      const [v, k] = useCharacterStore.getState().characters;
      useCharacterStore.setState({
        characters: useCharacterStore.getState().characters.map(c => {
          if (c.id === v.id) return { ...c, hpCurrent: 10, hpMax: 10, grappleState: { grappledBy: [k.id] } };
          if (c.id === k.id) return { ...c, grappleState: { grappling: [v.id] } };
          return c;
        }),
      });

      useCharacterStore.getState().applyDamage(v.id, 50, 'DCC');
      await new Promise(r => setTimeout(r, 20));

      const msgs = useLogStore.getState().logs.map(l => l.message);
      // 1) Aviso de morte com grapple deve estar presente.
      const dyingMsg = msgs.find(m => m.includes('🤼💀') && m.includes('Vitima'));
      expect(dyingMsg).toBeDefined();
      expect(dyingMsg).toContain('Carrasco');
      // 2) Log de release-all deve estar presente (chamado APÓS aoMorrer).
      const releaseMsg = msgs.find(m => m.includes('[grapple/release-all]') && m.includes('Vitima'));
      expect(releaseMsg).toBeDefined();
      // 3) Estado final: vínculos liberados.
      const after = useCharacterStore.getState().characters;
      expect(after.find(c => c.id === v.id)?.grappleState?.grappledBy ?? []).toEqual([]);
      expect(after.find(c => c.id === k.id)?.grappleState?.grappling ?? []).toEqual([]);
    });

    it('ao morrer SEM grapple ativo: não emite avisos de grapple', async () => {
      const s = useCharacterStore.getState();
      s.addCharacter('Solo', 'PLAYER', 'PLAYER');
      const [solo] = useCharacterStore.getState().characters;
      useCharacterStore.setState({
        characters: useCharacterStore.getState().characters.map(c =>
          c.id === solo.id ? { ...c, hpCurrent: 10, hpMax: 10 } : c,
        ),
      });
      useCharacterStore.getState().applyDamage(solo.id, 50, 'DCC');
      await new Promise(r => setTimeout(r, 20));
      const msgs = useLogStore.getState().logs.map(l => l.message);
      expect(msgs.some(m => m.includes('🤼💀'))).toBe(false);
      expect(msgs.some(m => m.includes('[grapple/release-all]'))).toBe(false);
    });
  });
});
