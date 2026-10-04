// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/lib/sounds', async original => Object.fromEntries(Object.keys(await original<Record<string, unknown>>()).map(k => [k, () => {}])));
import { ficha, montarMesa, pegarFicha, limparMesa, comoTela, esperar, forcarDados } from './helpers/mesaReal';
import { executarAcaoAtiva, modificadorPericiaAtiva } from '@/lib/omni/acaoAtiva';
import { inicioTurnoSustentacoesAtivas } from '@/lib/omni/custosAtivos';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useMapStore } from '@/stores/useMapStore';
import { useOmniRuntimeStore } from '@/stores/useOmniRuntimeStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useChronosStore } from '@/stores/useChronosStore';
import { ALL_CONDITIONS } from '@/types/conditions';
import { DICIONARIO_CONDICOES } from '@/lib/omni/constantesDoSistema';
import { novaEntidade, type AcaoAtivaConfig, type AcaoLogica } from '@/lib/omni/tipos';
import { executarGatilho } from '@/lib/omni/executor';
import { avaliarPredicadoEstado } from '@/lib/omni/condicionaisAtivos';
import { applyWeaponModel, setWeaponDamage } from '@/lib/omni/weaponModel';
import { findWeaponByName } from '@/lib/weapons';
const cfg=(p:Partial<AcaoAtivaConfig>={}):AcaoAtivaConfig=>({id:'c',nome:'Teste',acao:'comum',custoPE:'2',alcanceM:6,teste:'nenhum',dano:'4',...p});
const teleporte=()=>({tipo:'movimento' as const,movimento_tipo:'teleporte' as const,movimento_distancia:'6',movimento_alvo:'usuario' as const});
const point={id:'p',kind:'circle' as const,x:0,y:140,rotation:0,length:7,width:7,color:'#fff',opacity:1};
beforeEach(()=>{
  comoTela({profileId:null,role:'MASTER'}); useInventoryStore.setState({items:{}}); useOmniRuntimeStore.setState({efeitos:{}});useOmniEntidadesStore.setState({entidades:{}});
  useMapStore.setState({pendingMove:null,walls:[],activeSceneId:crypto.randomUUID()});
  montarMesa([ficha('u',{hpCurrent:40,hpMax:40,peCurrent:20,peMax:20,actionsCurrent:2,attributes:[],skills:[],trainingBonus:0,omniCounters:{rancor:3}}),ficha('a',{category:'INIMIGO',hpCurrent:100,hpMax:100,escCurrent:0,rd:0,ca:10,attributes:[],skills:[]})],{u:[0,0],a:[2,0]});
});
afterEach(async()=>{useMapStore.getState().resolveAoEPlacement(null);await esperar();limparMesa();});
async function pendingAction(p:Partial<AcaoAtivaConfig>={}){
  const action=executarAcaoAtiva('u',cfg({efeitos:[teleporte()],...p}),'a');
  await waitFor(()=>expect(useMapStore.getState().pendingAoEPlacement).not.toBeNull()); return {action};
}
describe('validação antes do pagamento',()=>{
  it.each(['@USUARIO.inexistente','1 / 0','-2','1d6','('])('custo legado %s não vira zero nem cobra',async custoPE=>{
    const before=pegarFicha('u');expect((await executarAcaoAtiva('u',cfg({custoPE}),'a')).ok).toBe(false);expect(pegarFicha('u')).toEqual(before);expect(pegarFicha('a').hpCurrent).toBe(100);
  });
  it('mantém arredondamento legado e prioridade de PE temporário',async()=>{
    useCharacterStore.getState().updateCharacter('u',{tempPE:1});await executarAcaoAtiva('u',cfg({custoPE:'2.4'}),'a');expect(pegarFicha('u').tempPE).toBe(0);expect(pegarFicha('u').peCurrent).toBe(19);
  });
  it('redutor genérico de PE participa do plano, com piso e sem cobrar ação gratuita',async()=>{
    useCharacterStore.getState().updateCharacter('u',{omniCostReduction:{pe:{reduce:5,min:1}}});
    await executarAcaoAtiva('u',cfg({custoPE:'4'}),'a');expect(pegarFicha('u').peCurrent).toBe(19);
    await executarAcaoAtiva('u',cfg({custoPE:'0'}),'a');expect(pegarFicha('u').peCurrent).toBe(19);
  });
  it('redutor de PE inválido não propaga NaN para a ficha',async()=>{
    useCharacterStore.getState().updateCharacter('u',{omniCostReduction:{pe:{reduce:NaN,min:1}}});
    expect((await executarAcaoAtiva('u',cfg(),'a')).ok).toBe(false);expect(pegarFicha('u').peCurrent).toBe(20);
  });
  it.each(['@USUARIO.inexistente','1d20','1/0'])('CD inválida %s não cobra',async cd=>{
    expect((await executarAcaoAtiva('u',cfg({teste:'tr',cd}),'a')).ok).toBe(false);expect(pegarFicha('u').peCurrent).toBe(20);
  });
  it('dano extra inválido em ramo de TR é rejeitado antes do dado e custo',async()=>{
    expect((await executarAcaoAtiva('u',cfg({teste:'tr',cd:'10',desfechosTR:{falha_critica:{dano_extra:'@ALVO.inexistente'}}}),'a')).ok).toBe(false);expect(pegarFicha('u').peCurrent).toBe(20);
  });
  it.each([{tipo:'condicao',condicao:'inexistente',rodadas:1},{tipo:'condicao',condicao:'caido',rodadas:-1},{tipo:'condicao',condicao:'caido',rodadas:1.5}])('condição inválida %j não cobra',async ef=>{
    expect((await executarAcaoAtiva('u',cfg({efeitos:[ef as never]}),'a')).ok).toBe(false);expect(pegarFicha('u').peCurrent).toBe(20);
  });
  it('predicado legado inválido não reduz crítico',async()=>{
    expect((await executarAcaoAtiva('u',cfg({margemCritico:{condicao:'@ALVO.inexistente == 0',reducao:2}}),'a')).ok).toBe(false);expect(pegarFicha('u').peCurrent).toBe(20);
  });
  it.each([NaN,Infinity,1.5])('saldo de cargas %s é rejeitado',async rancor=>{
    useCharacterStore.getState().updateCharacter('u',{omniCounters:{rancor}});
    expect((await executarAcaoAtiva('u',cfg({consumirContador:{nome:'rancor',minimo:1}}),'a')).ok).toBe(false);expect(pegarFicha('u').peCurrent).toBe(20);
  });
  it('mínimo NaN não permite gastar cargas',async()=>{
    expect((await executarAcaoAtiva('u',cfg({custo_recursos:{gastar_cargas:{nome:'rancor',quantidade:'1',minimo:NaN}}}),'a')).ok).toBe(false);
  });
  it('tipo de ação e saldo de PE inválidos não geram pagamento incompleto',async()=>{
    expect((await executarAcaoAtiva('u',cfg({acao:'errada' as never}),'a')).ok).toBe(false);
    useCharacterStore.getState().updateCharacter('u',{peCurrent:NaN});expect((await executarAcaoAtiva('u',cfg(),'a')).ok).toBe(false);expect(pegarFicha('u').actionsCurrent).toBe(2);
  });
});
describe('estado muda durante a seleção',()=>{
  it('alvo removido do mapa durante teleporte não cobra',async()=>{
    const {action}=await pendingAction();useMapStore.getState().removeEntities(['e-a']);useMapStore.getState().resolveAoEPlacement(point);
    expect((await action).ok).toBe(false);expect(pegarFicha('u').peCurrent).toBe(20);
  });
  it('trocar arma durante seleção impede usar o contexto antigo',async()=>{
    useCharacterStore.getState().updateCharacter('u',{mainHandWeaponName:'Espada Curta'});
    const {action}=await pendingAction({teste:'ataque'});useCharacterStore.getState().updateCharacter('u',{mainHandWeaponName:'Pistola'});useMapStore.getState().resolveAoEPlacement(point);
    expect((await action).ok).toBe(false);expect(pegarFicha('u').peCurrent).toBe(20);
  });
  it('área alterada enquanto escolhe teleporte não aplica a alvos que já saíram',async()=>{
    const action=executarAcaoAtiva('u',cfg({tipo_alvo:'area',filtro_alvo:'inimigos',area:{forma:'raio_em_si',tamanho_m:4},efeitos:[teleporte()]}),{ponto:{x:0,y:0}});
    await waitFor(()=>expect(useMapStore.getState().pendingAoEPlacement).not.toBeNull());useMapStore.getState().updateEntity('e-a',{x:1400});useMapStore.getState().resolveAoEPlacement(point);
    expect((await action).ok).toBe(false);expect(pegarFicha('u').peCurrent).toBe(20);expect(pegarFicha('a').hpCurrent).toBe(100);
  });
  it('configuração da declaração é preservada se o editor mudar durante seleção',async()=>{
    const c=cfg({efeitos:[teleporte()]});const action=executarAcaoAtiva('u',c,'a');
    await waitFor(()=>expect(useMapStore.getState().pendingAoEPlacement).not.toBeNull());c.custoPE='19';c.dano='99';useMapStore.getState().resolveAoEPlacement(point);
    expect((await action).ok).toBe(true);expect(pegarFicha('u').peCurrent).toBe(18);expect(pegarFicha('a').hpCurrent).toBe(96);
  });
  it('duplo uso não abre outro seletor nem cobra duas vezes; cancelar libera a trava',async()=>{
    const {action}=await pendingAction();expect((await executarAcaoAtiva('u',cfg(),'a')).ok).toBe(false);useMapStore.getState().resolveAoEPlacement(null);expect((await action).ok).toBe(false);
    expect((await executarAcaoAtiva('u',cfg(),'a')).ok).toBe(true);expect(pegarFicha('u').peCurrent).toBe(18);
  });
});
describe('resultados, armas, disputa e sustentação',()=>{
  it('1 natural é falha crítica mesmo se total alcançar CD baixa',async()=>{
    forcarDados(1);const r=await executarAcaoAtiva('u',cfg({teste:'tr',tr:'fortitude',cd:'0',metadeNoSucesso:true}),'a');expect(r.ok&&r.dano).toBe(4);expect(pegarFicha('a').hpCurrent).toBe(96);
  });
  it('buff ignora fórmulas de dano irrelevantes sem lançar exceção após pagar',async()=>{
    const r=await executarAcaoAtiva('u',cfg({tipo_efeito:'buff',dano:'@USUARIO.inexistente',dadosPorCarga:'@ALVO.inexistente',efeitos:[{tipo:'escudo',valor:'5',rodadas:1}]}),'a');
    expect(r.ok).toBe(true);expect(pegarFicha('a').escCurrent).toBe(5);expect(pegarFicha('a').hpCurrent).toBe(100);
  });
  it('herança ARMA.DANO respeita a fórmula personalizada do exemplar',async()=>{
    const e=setWeaponDamage(applyWeaponModel(novaEntidade('arma'),findWeaponByName('Espada Longa')!),'2d6 + @USUARIO.treino');e.nome='Lâmina';useInventoryStore.getState().add('u',e);useCharacterStore.getState().updateCharacter('u',{mainHandWeaponName:e.nome,trainingBonus:3});forcarDados(18,2,2);
    const r=await executarAcaoAtiva('u',cfg({dano:'@ARMA.DANO'}),'a',e);expect(r.ok&&r.dano).toBe(7);expect(pegarFicha('a').hpCurrent).toBe(93);
  });
  it('disputa incorpora bônus passivo equipado em perícia',()=>{
    useCharacterStore.getState().updateCharacter('u',{level:1,skills:[{id:'atletismo',name:'Atletismo',value:0,trained:false,mastery:false} as never]});const base=modificadorPericiaAtiva(pegarFicha('u'),'Atletismo')!;
    const e=novaEntidade('item');e.slotType='Anel' as never;e.bonusEquipado={pericias:{atletismo:2}};const i=useInventoryStore.getState().add('u',e);useInventoryStore.getState().equipItem(i.instanceId,'Anel');expect(modificadorPericiaAtiva(pegarFicha('u'),'Atletismo')).toBe(base+2);
  });
  it('sustentação pode manter condição configurada somente em ramo do TR',async()=>{
    forcarDados(1);const r=await executarAcaoAtiva('u',cfg({teste:'tr',cd:'10',custo_recursos:{tipo_acao:'sustentada',pe_por_turno:'2'},desfechosTR:{falha_critica:{efeitos:[{tipo:'condicao',condicao:'caido',rodadas:1}]}}}),'a');
    expect(r.ok).toBe(true);expect(pegarFicha('u').omniSustentacoes).toHaveLength(1);
  });
  it('purificar a última condição encerra sustentação antes de cobrar manutenção',async()=>{
    await executarAcaoAtiva('u',cfg({efeitos:[{tipo:'condicao',condicao:'caido',rodadas:1}],custo_recursos:{tipo_acao:'sustentada',pe_por_turno:'2'}}),'a');const ac=pegarFicha('a').activeConditions[0];useCharacterStore.getState().removeCondition('a',ac.id);inicioTurnoSustentacoesAtivas('u');expect(pegarFicha('u').peCurrent).toBe(18);expect(pegarFicha('u').omniSustentacoes).toEqual([]);
  });
});
function visual(acao:AcaoLogica['acao'],extra:Partial<AcaoLogica>={}){
  const e=novaEntidade('passiva');e.gatilhos=[{id:'g',evento:'aoEquipar',blocos:[{id:'b',modo:'todas',condicoes:[],acoes:[{id:'a',acao,alvoAplicacao:'ALVO',valor:{tipo:'fixo',valor:2},condicao:'caido',...extra}]}]}];
  executarGatilho(e,'aoEquipar',{usuario:pegarFicha('u'),alvo:pegarFicha('a')});
}
describe('condições visuais convergem com a ficha',()=>{
  it('aplicação fica visível aos predicados e registra a origem',()=>{
    visual('APLICAR_CONDICAO');expect(avaliarPredicadoEstado({tipo:'tem_condicao',nome:'Caído'},pegarFicha('a'),pegarFicha('u'))).toBe(true);expect(pegarFicha('a').activeConditions[0].sourceCharId).toBe('u');
  });
  it('expiração remove só a instância vinculada, preservando condição de outra fonte',()=>{
    visual('APLICAR_CONDICAO');const own=pegarFicha('a').activeConditions[0];useCharacterStore.getState().addCondition('a',{...own,id:'outra'});useChronosStore.getState().tick(13);useOmniRuntimeStore.getState().podarExpirados();expect(pegarFicha('a').activeConditions.map(c=>c.id)).toEqual(['outra']);
  });
  it('remoção visual também remove condição criada por ação ativa',async()=>{
    await executarAcaoAtiva('u',cfg({efeitos:[{tipo:'condicao',condicao:'caido',rodadas:2}]}),'a');visual('REMOVER_CONDICAO');expect(pegarFicha('a').activeConditions).toEqual([]);
  });
  it('imunidade bloqueia ficha e runtime, sem criar registro fantasma',()=>{
    useCharacterStore.getState().updateCharacter('a',{omniImmunities:['condicao:caido']});visual('APLICAR_CONDICAO');expect(pegarFicha('a').activeConditions).toEqual([]);expect(Object.values(useOmniRuntimeStore.getState().efeitos)).toEqual([]);
  });
  it('dicionário visual oferece todas as condições da ficha',()=>{
    for(const c of ALL_CONDITIONS) expect(DICIONARIO_CONDICOES).toContain(c.id);
  });
  it('Sangrando legado aplica Sangramento na ficha e purificação remove',()=>{
    visual('APLICAR_CONDICAO',{condicao:'sangrando'});expect(pegarFicha('a').activeConditions[0].conditionId).toBe('sangramento');
    visual('REMOVER_CONDICAO',{condicao:'sangrando'});expect(pegarFicha('a').activeConditions).toEqual([]);
  });
  it('remover todas limpa ficha e runtime sem afetar outra ficha',()=>{
    visual('APLICAR_CONDICAO');useCharacterStore.getState().addCondition('u',{...pegarFicha('a').activeConditions[0],id:'origem'});
    visual('REMOVER_CONDICAO',{condicao:'todas'});expect(pegarFicha('a').activeConditions).toEqual([]);expect(Object.values(useOmniRuntimeStore.getState().efeitos)).toEqual([]);expect(pegarFicha('u').activeConditions).toHaveLength(1);
  });
  it('subtrair vida no visual preserva tipo do dano e identidade da origem',async()=>{
    const source=novaEntidade('passiva');source.gatilhos=[{id:'g',evento:'aoCausarDano',blocos:[{id:'b',modo:'todas',condicoes:[],acoes:[{id:'c',acao:'INCREMENTAR_CONTADOR',alvoAplicacao:'USUARIO',caminhoAlvo:'acertos',valor:{tipo:'fixo',valor:1}}]}]}];
    useOmniEntidadesStore.setState({entidades:{[source.id]:source}});useCharacterStore.getState().updateCharacter('u',{omniAtivos:[{id:'v',entidadeId:source.id,categoria:'passiva',instanceId:'i',vinculadoEm:0}]});
    visual('SUBTRAIR',{caminhoAlvo:'vida_atual',valor:{tipo:'fixo',valor:4},tipoDano:'Psíquico'});
    await waitFor(()=>expect(pegarFicha('u').omniCounters?.acertos).toBe(1));expect(pegarFicha('a').hpCurrent).toBe(96);
  });
  it('duração dinâmica usa o valor da fórmula e dissipar remove a condição',()=>{
    visual('APLICAR_CONDICAO',{duracao:{tipo:'rodadas',valor:{tipo:'formula',expressao:'@USUARIO.rancor'}}});const e=Object.values(useOmniRuntimeStore.getState().efeitos)[0];expect(e.expiraEm!-e.iniciadoEm).toBe(18);useOmniRuntimeStore.getState().dissiparTodos('u');expect(pegarFicha('a').activeConditions).toEqual([]);
  });
});
