"""Combate real (navegador) — chaves genéricas do OMNI: gatilho "aliado sofre dano" com distância
no mapa, contador com teto por aliado, consumo em dano real e condicao_rodadas. Fichas/peças/
passivas só no navegador (gravações e sockets bloqueados); somem ao fechar."""
import asyncio, json, os, pathlib
from playwright.async_api import async_playwright

S = "/tmp/browser/omni/"
pathlib.Path(S).mkdir(parents=True, exist_ok=True)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        c = await b.new_context(viewport={"width": 1280, "height": 1800})
        pg = await c.new_page(); blocked = []
        async def guard(route):
            r = route.request
            if r.method != "GET" and "supabase" in r.url and "/auth/" not in r.url:
                blocked.append(r.url); await route.abort()
            else: await route.continue_()
        await c.route("**/*", guard)
        await c.route_web_socket("**/*", lambda ws: ws.close())
        pg.on("console", lambda m: m.type == "error" and print("CONSOLE", m.text[:150]))
        await pg.goto("http://localhost:8080")
        await pg.evaluate(f"localStorage.setItem({json.dumps(os.environ['LOVABLE_BROWSER_SUPABASE_STORAGE_KEY'])},{json.dumps(os.environ['LOVABLE_BROWSER_SUPABASE_SESSION_JSON'])})")
        await pg.goto("http://localhost:8080"); await pg.wait_for_timeout(6000)
        
        out = await pg.evaluate("""async ()=>{
          const cs=window.__charStore, ms=window.__mapStore, os=window.__omniEntStore, cb=window.__combatStore;
          const D=(ms.getState().gridConfig.dpi||50), mpc=ms.getState().gridConfig.metersPerCell||1.5;
          const src=cs.getState().characters[0]||{};
          const base={...src,temporary:false,escCurrent:0,escMax:0,activeConditions:[],conditions:[],rd:0,isDead:false,dead:false,chosenSpecAbilities:[],omniCounters:{}};
          const pas=(id,efs)=>({id,versao:1,nome:id,categoria:'passiva',descricao:'',tags:[],duracao:{tipo:'permanente'},custos:[],gatilhos:[],combatData:{effectsPassive:efs}});
          const ef=(o)=>({id:crypto.randomUUID(),type:'ADICIONAR',target:'USUARIO',formula:'1',...o});
          os.setState({entidades:{...os.getState().entidades,
            'tst-rancor':pas('Retribuição (teste)',[ef({trigger:'aliado_sofrer_dano',condition:'@CENA.distancia <= 4.5',resourcePath:'contador_rancor',counterCap:'@USUARIO.treino',counterPerSource:true})]),
            'tst-corte':pas('Corte (teste)',[ef({trigger:'acertar',type:'SUBTRAIR',resourcePath:'contador_rancor',formula:'0'}),ef({trigger:'acertar',type:'SUBTRAIR',target:'ALVO',resourcePath:'vida_atual',formula:'(@CENA.consumido)d1'})]),
            'tst-cond':pas('Condenado (teste)',[ef({trigger:'acertar',condition:'@ALVO.condicao_rodadas_condenado > 3',resourcePath:'contador_margem'})]),
          }});
          const v=(id)=>({id:'v-'+id,entidadeId:id,categoria:'passiva',instanceId:'i-'+id});
          const mk=(id,o)=>({...base,id,name:'TESTE '+id,category:'PLAYER',hpCurrent:60,hpMax:60,level:9,...o});
          cs.setState({characters:[
            mk('portador',{omniAtivos:[v('tst-rancor'),v('tst-corte'),v('tst-cond')]}),
            mk('aliadoPerto'),mk('aliadoMeio'),mk('aliadoLonge'),
            mk('inimigo',{category:'INIMIGO',hpCurrent:200,hpMax:200}),
          ]});
          const at=(cid,cx,cy)=>({id:'e-'+cid,characterId:cid,type:'character',x:cx*D,y:cy*D,w:D,h:D});
          ms.setState({entities:{a:at('portador',0,0),b:at('aliadoPerto',1,0),c:at('aliadoMeio',3,0),d:at('aliadoLonge',8,0),e:at('inimigo',2,2)}});
          cb.setState({inCombat:true,combatId:'cb-omni',round:1,initiativeOrder:[{charId:'portador'},{charId:'inimigo'}],currentTurnIndex:0});
          const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
          const get=(id)=>cs.getState().characters.find(c=>c.id===id);
          const hit=async(id,atk)=>{cs.getState().applyDamage(id,2,undefined,{attackerId:atk,ignoresRD:true});await wait(150);};
          await hit('portador','inimigo'); cs.getState().updateCharacter('portador',{hpCurrent:60,omniCounters:{}});
          for(let i=0;i<60&&!window.__omniTrigger;i++) await wait(100);
          if(!window.__omniTrigger) return {erro:'sem hook', urls:performance.getEntriesByType('resource').map(e=>e.name).filter(n=>/omni\\/(eventBus|trigger|observ)/.test(n)), hp:get('portador').hpCurrent, log:window.__logStore.getState().logs.slice(-5).map(l=>l.message)};
          const {montarVariaveisDoPersonagem,dispararGatilhoEfeitosItens}=window.__omniTrigger;
          const treino=montarVariaveisDoPersonagem(get('portador'),'USUARIO').USUARIO_TREINO;
          const r={D,mpc,treino};
          for(let i=0;i<treino+2;i++) await hit('aliadoPerto','inimigo');
          await hit('aliadoMeio','inimigo'); await hit('aliadoLonge','inimigo'); await hit('inimigo','aliadoPerto');
          r.contadores={...get('portador').omniCounters};
          r.hpAntes=get('inimigo').hpCurrent;
          dispararGatilhoEfeitosItens('aoAcertarAtaque',{usuarioId:'portador',alvoId:'inimigo'}); await wait(200);
          r.hpDepois=get('inimigo').hpCurrent; r.rancorDepois=get('portador').omniCounters.rancor;
          cs.getState().updateCharacter('inimigo',{activeConditions:[{id:'c',conditionId:'condenado',name:'Condenado',icon:'',remainingTurns:-1,remainingRounds:2}]});
          dispararGatilhoEfeitosItens('aoAcertarAtaque',{usuarioId:'portador',alvoId:'inimigo'}); await wait(100);
          r.margemCom2=get('portador').omniCounters.margem??0;
          cs.getState().updateCharacter('inimigo',{activeConditions:[{id:'c',conditionId:'condenado',name:'Condenado',icon:'',remainingTurns:-1,remainingRounds:4}]});
          dispararGatilhoEfeitosItens('aoAcertarAtaque',{usuarioId:'portador',alvoId:'inimigo'}); await wait(100);
          r.margemCom4=get('portador').omniCounters.margem??0;
          r.log=window.__logStore.getState().logs.slice(-8).map(l=>l.message);
          return r;
        }""")
        print(json.dumps(out, ensure_ascii=False, indent=1))
        for nome in ["Mapa", "MAPA"]:
            t = pg.get_by_text(nome, exact=True)
            if await t.count(): await t.first.click(force=True); break
        await pg.wait_for_timeout(2500)
        await pg.screenshot(path=S+"1_mapa.png")
        print("gravações bloqueadas:", len(blocked))
        await b.close()

asyncio.run(main())
