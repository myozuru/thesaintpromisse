// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
import { ficha, montarMesa, pegarFicha, forcarDados, esperar } from './helpers/mesaReal';
import { useCombatStore } from '@/stores/useCombatStore';
import { executarAcaoAtiva } from '@/lib/omni/acaoAtiva';
import { testeEfetivoAtivo } from '@/lib/omni/testeAtivo';
import type { AcaoAtivaConfig } from '@/lib/omni/tipos';
const base: AcaoAtivaConfig={id:'corte',nome:'Corte da injustiça',acao:'comum',custoPE:'10',alcanceM:3,teste:'nenhum',dano:'@ARMA.dano + 2d8',consumirContador:{nome:'rancor',minimo:1},dadosPorCarga:'1d8',efeitos:[]};
afterEach(async()=>{await esperar(10);vi.restoreAllMocks();});
it.each([false,true])('dano da arma exige acerto e erro não causa dano (incluirArma=%s)',async incluirArma=>{
  useCombatStore.setState({inCombat:false});
  montarMesa([ficha('u',{mainHandWeaponName:'Adaga',peCurrent:20,peMax:20,actionsCurrent:2,omniCounters:{rancor:3},attributes:[],skills:[],omniAtivos:[]}),ficha('a',{category:'INIMIGO',hpCurrent:50,hpMax:50,ca:10,rd:0,escCurrent:0,omniAtivos:[]})],{u:[0,0],a:[1,0]});
  forcarDados(1);
  const r=await executarAcaoAtiva('u',{...base,incluirArma},'a',undefined,{ignorarReacoes:true});
  expect(r.ok).toBe(true);
  if(!r.ok) throw new Error(r.reason);
  expect(r.detalhe).toContain('ERROU');
  expect(r.dano).toBe(0);
  expect(pegarFicha('a').hpCurrent).toBe(50);
  expect(pegarFicha('u').peCurrent).toBe(10);
  expect(pegarFicha('u').omniCounters?.rancor??0).toBe(0);
});
it('acerto libera o dano do golpe e dados por carga',async()=>{
  useCombatStore.setState({inCombat:false});
  montarMesa([ficha('u',{mainHandWeaponName:'Adaga',peCurrent:20,peMax:20,actionsCurrent:2,omniCounters:{rancor:3},attributes:[],skills:[],omniAtivos:[]}),ficha('a',{category:'INIMIGO',hpCurrent:100,hpMax:100,ca:10,rd:0,escCurrent:0,omniAtivos:[]})],{u:[0,0],a:[1,0]});
  forcarDados(20,4,4,4,4,4,4,4,4);
  const r=await executarAcaoAtiva('u',base,'a',undefined,{ignorarReacoes:true});
  expect(r.ok).toBe(true);
  if(!r.ok) throw new Error(r.reason);
  expect(r.detalhe).toContain('CRÍTICO');
  expect(r.dano).toBeGreaterThan(0);
  expect(pegarFicha('a').hpCurrent).toBeLessThan(100);
});
it('preserva cura, áreas, TR, disputa e dano direto sem arma',()=>{
  for(const cfg of [{...base,tipo_efeito:'cura'},{...base,tipo_alvo:'area'},{...base,tipo_alvo:'proprio'},{...base,filtro_alvo:'aliados'},{...base,dano:'2d8'},{...base,teste:'tr'},{...base,teste:'disputa'}] as AcaoAtivaConfig[]) expect(testeEfetivoAtivo(cfg)).toBe(cfg.teste);
  expect(testeEfetivoAtivo({...base,dano:'2d8',incluirArma:true})).toBe('ataque');
});
