// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
import { ficha, montarMesa, pegarFicha, comoTela } from './helpers/mesaReal';
import { useMapStore, type Entity } from '@/stores/useMapStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useOmniRuntimeStore } from '@/stores/useOmniRuntimeStore';
import { useOmniSpatialStore } from '@/stores/useOmniSpatialStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { novaEntidade, type AcaoAtivaConfig } from '@/lib/omni/tipos';
import { findEntitiesInTemplate, resolveAreaTargetCharacters } from '@/lib/mapAoE';
import { TemplateEngine, type MapTemplate } from '@/components/mapa/TemplateEngine';
import { selecionarAlvosAtivos } from '@/lib/omni/alvosAtivos';
import { iniciarEngineZonasTerreno } from '@/lib/mapa/engineZonasTerreno';
import { confirmarMovimentoMapa, comPreviaMovimento, receberMovimentoConfirmado } from '@/lib/mapa/movimentoConfirmado';
import { recalcularAuras } from '@/lib/omni/auras';
import { segmentoEntraNaZona, zonaEstaAtiva } from '@/lib/mapa/zonaTerreno';
const token = (p: Partial<Entity> = {}): Entity => ({ id:'t', x:0,y:0,w:100,h:100,rotation:0,shape:'RECT',layer:'tokens',...p } as Entity);
const template = (p: Partial<MapTemplate> = {}): MapTemplate => ({ id:'a',kind:'circle',x:20,y:20,rotation:0,length:1,width:1,color:'#fff',opacity:1,...p });
const cfg = (p: Partial<AcaoAtivaConfig> = {}): AcaoAtivaConfig => ({ id:'c',nome:'teste',acao:'comum',custoPE:'0',alcanceM:3,teste:'nenhum',...p } as AcaoAtivaConfig);
beforeEach(() => {
  comoTela({ profileId:null,role:'MASTER' });
  useOmniEntidadesStore.setState({ entidades:{} }); useOmniRuntimeStore.setState({ efeitos:{} }); useOmniSpatialStore.setState({ posicoes:{} });
  useMapStore.setState({ entities:{},pendingMove:null,activeSceneId:crypto.randomUUID() });
  montarMesa(['u','a'].map(id=>ficha(id,{hpCurrent:50,hpMax:50,peCurrent:5,peMax:20,rd:0,escCurrent:0,attributes:[],trainingBonus:3,omniAtivos:[]})),{u:[0,0],a:[6,0]});
  iniciarEngineZonasTerreno();
});
function zone(extra: Partial<Entity['terrainZone']> = {}) {
  const z=token({id:'z',x:200,y:0,w:10,h:100,layer:'map',terrainZone:{duracaoRodadas:null,rodadasRestantes:null,gatilhos:['entrada'],efeitos:[{id:'e',type:'ADICIONAR',target:'ALVO',resourcePath:'pe',formula:'1'}],...extra}});
  useMapStore.setState(s=>({entities:{...s.entities,z}})); return z;
}
function move(x:number, trail:{x:number;y:number}[]=[], teleport=false) {
  const t=useMapStore.getState().entities['e-a'], de={x:t.x,y:t.y};
  comPreviaMovimento(()=>useMapStore.getState().updateEntity(t.id,{x,y:0}));
  confirmarMovimentoMapa(t.id,de,trail,teleport);
}
describe('geometria de áreas sem amostragem de nove pontos',()=>{
  it('detecta círculo pequeno inteiramente dentro de token grande',()=>expect(findEntitiesInTemplate(template(),{t:token()})).toEqual(['t']));
  it('detecta faixa fina atravessando a borda sem tocar centros ou cantos',()=>expect(findEntitiesInTemplate(template({kind:'line',x:-100,y:20,length:200,width:.1}),{t:token()})).toEqual(['t']));
  it('não inclui o canto vazio da caixa de uma elipse',()=>expect(findEntitiesInTemplate(template({x:48,y:48}),{t:token({shape:'ELLIPSE'})})).toEqual([]));
  it('círculo tangente e polígono dentro de elipse contam como interseção',()=>{
    expect(findEntitiesInTemplate(template({x:51,y:0}),{t:token({shape:'ELLIPSE'})})).toEqual(['t']);
    expect(findEntitiesInTemplate(template({kind:'square'}),{t:token({shape:'ELLIPSE'})})).toEqual(['t']);
  });
  it('não seleciona peça oculta ou dimensões inválidas',()=>expect(findEntitiesInTemplate(template(),{a:token({hidden:true}),b:token({w:NaN})})).toEqual([]));
  it.each(['cone','cone_attached'] as const)('hit-test de %s respeita a base desenhada',kind=>{
    const t=template({kind,x:0,y:0,length:100}); const offset=kind==='cone'?-50:0;
    expect(TemplateEngine.hitTest({x:offset+89,y:0},t)).toBe(true);
    expect(TemplateEngine.hitTest({x:offset+95,y:0},t)).toBe(false);
  });
});
describe('resolução dos alvos das áreas',()=>{
  it('converte token ligado direto à ficha em alvo',()=>{
    const entities={t:token({characterId:'alvo'})};
    expect(resolveAreaTargetCharacters(['t'],entities,[ficha('alvo')],'origem'))
      .toEqual({entityIds:['t'],characterIds:['alvo']});
  });
  it('resolve token do jogador ligado só pelo perfil',()=>{
    const entities={t:token({ownerProfileId:'perfil-alvo'})};
    expect(resolveAreaTargetCharacters(['t'],entities,[ficha('alvo',{profileId:'perfil-alvo'})],'origem'))
      .toEqual({entityIds:['t'],characterIds:['alvo']});
  });
  it('deduplica tokens da ficha, exclui o token do conjurador e evita perfis ambíguos',()=>{
    const entities={caster:token({id:'caster',characterId:'origem'}),a:token({id:'a',avatarProfileId:'perfil'}),b:token({id:'b',ownerProfileId:'perfil'})};
    expect(resolveAreaTargetCharacters(['caster','a','b'],entities,[ficha('origem'),ficha('alvo',{profileId:'perfil'}),ficha('outro',{profileId:'perfil'})],'origem','caster'))
      .toEqual({entityIds:['a','b'],characterIds:[]});
  });
});
describe('alcances e seleção',()=>{
  it('legado também exige mapa quando há alcance definido',async()=>{
    useMapStore.setState({entities:{}});
    expect((await selecionarAlvosAtivos('u',cfg(),'a')).ok).toBe(false);
  });
  it.each([NaN,Infinity,-1])('rejeita alcance inválido %s',async alcanceM=>expect((await selecionarAlvosAtivos('u',cfg({alcanceM}),'a')).ok).toBe(false));
  it('não transforma variável desconhecida nem dados em teto válido',async()=>{
    for(const max_alvos of ['@USUARIO.inexistente + 3','1d4']) expect((await selecionarAlvosAtivos('u',cfg({tipo_alvo:'multiplo',max_alvos,alcanceM:0}),['a'])).ok).toBe(false);
  });
  it('deduplica alvo repetido antes de contar o limite',async()=>expect(await selecionarAlvosAtivos('u',cfg({tipo_alvo:'multiplo',max_alvos:'1',alcanceM:0}),['a','a'])).toEqual({ok:true,ids:['a']}));
});
describe('zonas e movimento confirmado',()=>{
  it('prévia e cancelamento não aplicam efeito; confirmação aplica uma vez',()=>{
    zone(); const de={x:420,y:0};
    comPreviaMovimento(()=>useMapStore.getState().updateEntity('e-a',{x:200})); expect(pegarFicha('a').peCurrent).toBe(5);
    comPreviaMovimento(()=>useMapStore.getState().updateEntity('e-a',de)); expect(pegarFicha('a').peCurrent).toBe(5);
    move(200); expect(pegarFicha('a').peCurrent).toBe(6);
  });
  it('trajeto curvo cruza zona mesmo com extremos do mesmo lado',()=>{
    zone(); move(420,[{x:200,y:0},{x:420,y:0}]); expect(pegarFicha('a').peCurrent).toBe(6);
  });
  it('teleporte atravessa sem efeito, mas entrada no destino dispara',()=>{
    zone(); move(0,[],true); expect(pegarFicha('a').peCurrent).toBe(5);
    move(200,[],true); expect(pegarFicha('a').peCurrent).toBe(6);
  });
  it('retransmissão do mesmo commit não duplica efeitos e outra cena é recusada',()=>{
    zone(); const m={id:crypto.randomUUID(),sceneId:useMapStore.getState().activeSceneId,entityId:'e-a',characterId:'a',de:{x:420,y:0},para:{x:200,y:0},trajetoria:[],teleporte:false};
    expect(receberMovimentoConfirmado({...m,sceneId:'outra'})).toBe(false);
    expect(receberMovimentoConfirmado(m)).toBe(true); expect(receberMovimentoConfirmado(m)).toBe(false); expect(pegarFicha('a').peCurrent).toBe(6);
  });
  it('condição com variável inválida não vira comparação verdadeira contra zero',()=>{
    zone({efeitos:[{id:'e',type:'ADICIONAR',target:'ALVO',resourcePath:'pe',formula:'1',condition:'@ALVO.inexistente == 0'}]}); move(200); expect(pegarFicha('a').peCurrent).toBe(5);
  });
  it('fórmula usa o autor configurado em USUARIO e o atingido em ALVO',()=>{
    useCharacterStore.getState().updateCharacter('u',{peCurrent:3});
    zone({sourceCharId:'u',efeitos:[{id:'e',type:'ADICIONAR',target:'ALVO',resourcePath:'pe',formula:'@USUARIO.pe'}]}); move(200); expect(pegarFicha('a').peCurrent).toBe(8);
  });
  it('interseção analítica detecta zona muito fina em segmento longo',()=>{
    const z=token({w:.0001,h:2,x:.123});
    expect(segmentoEntraNaZona(z,{x:-10000,y:0},{x:10000,y:0})).toBe(true);
    expect(segmentoEntraNaZona({...z,w:NaN},{x:-1,y:0},{x:1,y:0})).toBe(false);
  });
  it('duração inválida nunca ativa zona',()=>expect(zonaEstaAtiva({duracaoRodadas:NaN,rodadasRestantes:2,gatilhos:[],efeitos:[]})).toBe(false));
});
describe('aura acompanha o dono no mapa',()=>{
  it('mover somente o dono detecta entrada de outros e respeita metros por casa',()=>{
    const e=novaEntidade('aura');e.areaRaio={tipo:'fixo',valor:3};
    e.combatData={critRange:20,critMultiplier:2,effects:[],effectsPassive:[{id:'e',type:'ADICIONAR',target:'ALVO',resourcePath:'pe',formula:'2',trigger:'entrar_aura'}]};
    useOmniEntidadesStore.setState({entidades:{[e.id]:e}});
    useCharacterStore.getState().updateCharacter('u',{omniAtivos:[{id:'v',entidadeId:e.id,categoria:'aura',instanceId:'i',vinculadoEm:0}]});
    recalcularAuras(); expect(pegarFicha('a').peCurrent).toBe(5);
    useMapStore.getState().updateEntity('e-u',{x:350}); expect(pegarFicha('a').peCurrent).toBe(7);
    recalcularAuras(); expect(pegarFicha('a').peCurrent).toBe(7);
  });
});
