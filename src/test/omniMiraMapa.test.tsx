// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
import { ficha, montarMesa } from './helpers/mesaReal';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useMapStore } from '@/stores/useMapStore';
import { resolverTokenDaFicha } from '@/lib/mapa/tokenDaFicha';
import { useCombatStore } from '@/stores/useCombatStore';
import { novaEntidade, type AcaoAtivaConfig } from '@/lib/omni/tipos';
import { AcoesAtivasSection } from '@/components/fichas/AcoesAtivasSection';
import { AlvoMapaOverlay } from '@/components/mapa/ui/AlvoMapaOverlay';
import { alvosNoAlcance, clicarAlvoMapa, pedirAlvoMapa, terminarAlvoMapa, useAlvoMapaStore } from '@/stores/useAlvoMapaStore';
import { selecionarAlvosAtivos } from '@/lib/omni/alvosAtivos';
const cfg: AcaoAtivaConfig = { id:'c',nome:'Corte radial',acao:'livre',custoPE:'0',alcanceM:4.5,teste:'nenhum',efeitos:[],custo_recursos:{usos_item:1} };
beforeEach(() => {
  terminarAlvoMapa(null);
  useInventoryStore.setState({items:{},deleted:{}});
  useOmniEntidadesStore.setState({entidades:{}});
  useCombatStore.setState({inCombat:false});
  montarMesa([ficha('u',{mainHandWeaponName:'Katana'}),ficha('a'),ficha('b')],{u:[0,0],a:[3,0],b:[4.5,4.5]});
});
afterEach(() => { cleanup(); terminarAlvoMapa(null); vi.restoreAllMocks(); });
it('exclui o canto do antigo quadrado tanto na mira quanto na execução',async()=>{
  expect(alvosNoAlcance({usuarioId:'u',label:'Teste',maxRangeMeters:4.5}).map(c=>c.id)).toEqual(['a']);
  expect((await selecionarAlvosAtivos('u',cfg,'b')).ok).toBe(false);
  expect((await selecionarAlvosAtivos('u',cfg,'a')).ok).toBe(true);
});
it('clique fora do círculo mantém a seleção; cancelar limpa a mira',async()=>{
  const p=pedirAlvoMapa({usuarioId:'u',label:'Teste',maxRangeMeters:4.5});
  clicarAlvoMapa('e-b');
  expect(useAlvoMapaStore.getState().pending).not.toBeNull();
  expect(useAlvoMapaStore.getState().erro).toBeTruthy();
  terminarAlvoMapa(null);
  expect(await p).toBeNull();
});
it.each(['direto', 'avatarProfileId', 'ownerProfileId'] as const)('Usar executa sem abrir ficha com vínculo %s',async vinculo=>{
  if (vinculo !== 'direto') {
    montarMesa([ficha('u',{profileId:'p-u',mainHandWeaponName:'Katana'}),ficha('a',{profileId:'p-a'})],{u:[0,0],a:[3,0]});
    useMapStore.setState(s=>({entities:Object.fromEntries(Object.entries(s.entities).map(([id,e])=>[id,{...e,characterId:undefined,[vinculo]:e.characterId==='u'?'p-u':'p-a'}]))}));
  }
  const ent={...novaEntidade('arma'),nome:'Katana',acoesAtivas:[cfg],usos:{total:3,recarga:'diaria' as const}};
  const item=useInventoryStore.getState().add('u',ent);
  const tabs:string[]=[];
  const onNavigate=(e:Event)=>tabs.push((e as CustomEvent).detail);
  window.addEventListener('app:navigate',onNavigate);
  try {
    render(<AcoesAtivasSection charId="u" />);
    fireEvent.click(screen.getByRole('button',{name:'Usar'}));
    expect(useAlvoMapaStore.getState().pending).not.toBeNull();
    act(()=>{ clicarAlvoMapa('e-a'); });
    await waitFor(()=>expect(useInventoryStore.getState().items[item.instanceId].usosRestantes).toBe(2));
    expect(tabs).toEqual(['mapa']);
    expect(useAlvoMapaStore.getState().pending).toBeNull();
  } finally { window.removeEventListener('app:navigate',onNavigate); }
});
it('a instrução não oferece seleção por nomes e mantém confirmação múltipla',async()=>{
  const p=pedirAlvoMapa({usuarioId:'u',label:'Teste',maxRangeMeters:4.5,maxAlvos:2});
  render(<AlvoMapaOverlay />);
  expect(screen.queryByRole('button',{name:'a'})).toBeNull();
  act(()=>{ clicarAlvoMapa('e-a'); });
  fireEvent.click(screen.getByRole('button',{name:'Confirmar (1/2)'}));
  expect(await p).toEqual(['a']);
});

it('vínculo de perfil não toma token de outra ficha, oculto ou em camada desativada',()=>{
  const ms=useMapStore.getState();
  const t=ms.entities['e-u'];
  const char={id:'nova',profileId:'p'};
  expect(resolverTokenDaFicha(char,{t:{...t,characterId:'outra',ownerProfileId:'p'}},ms.layerVisible)).toBeUndefined();
  expect(resolverTokenDaFicha(char,{t:{...t,characterId:undefined,ownerProfileId:'p',hidden:true}},ms.layerVisible)).toBeUndefined();
  expect(resolverTokenDaFicha(char,{t:{...t,characterId:undefined,ownerProfileId:'p'}},{...ms.layerVisible,tokens:false})).toBeUndefined();
});
