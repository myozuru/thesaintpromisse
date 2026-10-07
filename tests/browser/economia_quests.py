"""Lojas por NPC (1,5 m), pechincha secreta, mural de quests (aceitar, arrastar cartaz),
conclusão com divisão igual e item no chão, e prazo no tempo do mundo.
Tudo só no navegador (gravações e sockets bloqueados)."""
import asyncio, json, os, pathlib
from playwright.async_api import async_playwright
S = "/tmp/browser/eco/"; pathlib.Path(S).mkdir(parents=True, exist_ok=True)

SETUP = """async (dist)=>{
  const cs=window.__charStore, ms=window.__mapStore;
  const {useShopStore}=await import('/src/stores/useShopStore.ts');
  const {useQuestStore}=await import('/src/stores/useQuestStore.ts');
  const {useRoleStore}=await import('/src/stores/useRoleStore.ts');
  const os=window.__omniEntStore;
  const D=ms.getState().gridConfig.dpi||50, pid=window.__profileStore.getState().activeProfileId;
  const src=cs.getState().characters[0];
  const mk=(id,o)=>({...src,temporary:false,id,conditions:[],activeConditions:[],...o});
  cs.setState({characters:[mk('p1',{name:'TESTE Ana',profileId:pid,category:'PLAYER',level:5,
     skills:[{id:'s1',name:'Persuasão',value:0,linkedAttribute:'Carisma',trained:true}]}),
     mk('p2',{name:'TESTE Bruno',profileId:'outro',category:'PLAYER'})]});
  os.setState({entidades:{...os.getState().entidades,'esp':{id:'esp',versao:1,nome:'Espada Teste',categoria:'arma',descricao:'',tags:[],duracao:{tipo:'permanente'},custos:[],gatilhos:[],
     comercio:{basePrice:100,hiddenTags:[],isBought:false,categoriasAceitas:['ferreiro']}}}});
  ms.setState({entities:{e1:{id:'e1',characterId:'p1',type:'character',x:0,y:0,w:D,h:D,label:'Ana'},
     e2:{id:'e2',characterId:'p2',type:'character',x:0,y:3*D,w:D,h:D,label:'Bruno'},
     npc:{id:'npc',shape:'RECT',x:dist*D,y:0,w:D,h:D,label:'Ferreiro Gorn',layer:'tokens',locked:true,rotation:0,color:'#888'},
     mur:{id:'mur',shape:'RECT',x:dist*D,y:D,w:D,h:D,label:'Mural',layer:'tokens',locked:true,rotation:0,color:'#888'}}, selectedIds:[]});
  useRoleStore.setState({role:'MASTER'});
  const s=useShopStore.getState().criar('Forja do Gorn');
  useShopStore.getState().atualizar(s.id,{npcEntityId:'npc',categorias:['ferreiro'],inventory:['esp'],pechincha:{ativa:true,cd:5,humor:'neutro',pericias:['Persuasão'],descontoSucesso:10,descontoSucessoMaior:20,descontoCritico:30,aumentoFalhaCritica:15,tentativasPorDia:1}});
  const m=useQuestStore.getState().criarMural('Mural da Vila'); useQuestStore.getState().atualizarMural(m.id,{entityId:'mur'});
  const q=useQuestStore.getState().criarQuest('Caçar o lobo'); useQuestStore.getState().atualizarQuest(q.id,{descricao:'Um lobo ronda a vila.',recompensa:{valor:101,currencyId:'yen',itens:['esp']}});
  const q2=useQuestStore.getState().criarQuest('Segredo'); useQuestStore.getState().atualizarQuest(q2.id,{mascarada:true,descricao:'Procure-me à noite.',objetivoReal:'Matar o prefeito',icone:'caveira'});
  useRoleStore.setState({role:'PLAYER'});
  return {shop:s.id,quest:q.id,quest2:q2.id};
}"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True); c = await b.new_context(viewport={"width": 1280, "height": 1800}); pg = await c.new_page()
        async def guard(route):
            r = route.request
            if r.method != "GET" and "supabase" in r.url and "/auth/" not in r.url: await route.abort()
            else: await route.continue_()
        await c.route("**/*", guard); await c.route_web_socket("**/*", lambda ws: ws.close())
        await pg.goto("http://localhost:8080")
        await pg.evaluate(f"localStorage.setItem({json.dumps(os.environ['LOVABLE_BROWSER_SUPABASE_STORAGE_KEY'])},{json.dumps(os.environ['LOVABLE_BROWSER_SUPABASE_SESSION_JSON'])})")
        await pg.goto("http://localhost:8080"); await pg.wait_for_timeout(6000)
        await pg.mouse.click(640, 400); await pg.wait_for_timeout(2000)
        mapa = pg.get_by_text("Mapa", exact=True)
        if await mapa.count(): await mapa.first.click(force=True); await pg.wait_for_timeout(2000)
        ids = await pg.evaluate(SETUP, 4); await pg.wait_for_timeout(1200)
        await pg.screenshot(path=S + "1_longe.png")
        # Longe: clicar no NPC não abre
        await pg.evaluate("window.__mapStore.setState({selectedIds:['npc']})"); await pg.wait_for_timeout(600)
        print("longe aviso:", await pg.locator("[data-npc-overlay] [role=alert]").inner_text() if await pg.locator("[data-npc-overlay] [role=alert]").count() else None)
        print("loja abriu longe:", await pg.get_by_text("Pechinchar").count())
        # Perto
        await pg.evaluate("()=>{const ms=window.__mapStore,D=ms.getState().gridConfig.dpi||50;const e=ms.getState().entities;ms.setState({selectedIds:[],entities:{...e,npc:{...e.npc,x:D},mur:{...e.mur,x:D}}})}")
        await pg.wait_for_timeout(400)
        await pg.evaluate("window.__mapStore.setState({selectedIds:['npc']})"); await pg.wait_for_timeout(1000)
        print("loja abriu perto:", await pg.get_by_text("Pechinchar").count() > 0)
        await pg.screenshot(path=S + "2_loja.png")
        print("CD visível ao jogador:", await pg.get_by_text("CD").count())
        await pg.get_by_role("button", name="Rolar Persuasão").click(); await pg.wait_for_timeout(2500)
        for _ in range(6):
            t = pg.get_by_text("Clique ou segure")
            if await t.count(): await t.first.click(force=True); await pg.wait_for_timeout(3500)
        await pg.wait_for_timeout(1000)
        print("resultado pechincha:", await pg.locator("[data-pechincha] [role=status]").inner_text() if await pg.locator("[data-pechincha] [role=status]").count() else None)
        print("botão bloqueado após tentativa:", await pg.get_by_role("button", name="Rolar Persuasão").is_disabled())
        await pg.screenshot(path=S + "3_pechincha.png")
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(600)
        # Mural
        await pg.evaluate("window.__mapStore.setState({selectedIds:['mur']})"); await pg.wait_for_timeout(1000)
        await pg.screenshot(path=S + "4_mural.png")
        print("cartaz mascarado mostra ???:", await pg.locator(f"[data-cartaz='{ids['quest2']}']").inner_text())
        box = await pg.locator(f"[data-cartaz='{ids['quest']}']").bounding_box()
        await pg.mouse.move(box["x"] + 20, box["y"] + 20); await pg.mouse.down(); await pg.mouse.move(box["x"] + 200, box["y"] + 120, steps=8); await pg.mouse.up()
        await pg.wait_for_timeout(500)
        print("cartaz movido:", await pg.evaluate(f"(async()=>{{const m=await import('/src/stores/useQuestStore.ts');return m.useQuestStore.getState().quests['{ids['quest']}'].poster}})()"))
        await pg.locator(f"[data-cartaz='{ids['quest']}']").click(); await pg.wait_for_timeout(500)
        await pg.get_by_role("button", name="Aceitar quest").click(); await pg.wait_for_timeout(500)
        await pg.screenshot(path=S + "5_aceita.png")
        await pg.keyboard.press("Escape")
        # Mestre conclui
        r = await pg.evaluate(f"""async()=>{{
          const {{useRoleStore}}=await import('/src/stores/useRoleStore.ts');
          const {{useQuestStore}}=await import('/src/stores/useQuestStore.ts');
          const a=await import('/src/lib/economia/acoesQuest.ts');
          const {{useMoneyStore}}=await import('/src/stores/useMoneyStore.ts');
          useRoleStore.setState({{role:'MASTER'}});
          useQuestStore.getState().atualizarQuest('{ids['quest']}',{{aceitaPor:['p1','p2']}});
          const ms=useMoneyStore.getState(); const w1=ms.ensurePersonalWallet('p1','Ana'), w2=ms.ensurePersonalWallet('p2','Bruno');
          const bal=(w)=>useMoneyStore.getState().wallets.find(x=>x.id===w).balances.yen||0; const b1=bal(w1),b2=bal(w2);
          a.concluirQuest('{ids['quest']}');
          let dup=null; try{{a.concluirQuest('{ids['quest']}')}}catch(e){{dup=e.message}}
          const chao=Object.values(window.__mapStore.getState().entities).filter(e=>e.groundItem).map(e=>e.label);
          // prazo
          const q3=useQuestStore.getState().criarQuest('Prazo'); useQuestStore.getState().atualizarQuest(q3.id,{{prazoFim:a.agoraMundo()+3600}});
          window.__chronosStore?.getState?.(); const {{useChronosStore}}=await import('/src/stores/useChronosStore.ts');
          a.processarQuestsMestre(); const antes=useQuestStore.getState().quests[q3.id].status;
          useChronosStore.getState().tick(3601,'manual'); a.processarQuestsMestre();
          return {{ana:bal(w1)-b1,bruno:bal(w2)-b2,dup,chao,status:useQuestStore.getState().quests['{ids['quest']}'].status,prazoAntes:antes,prazoDepois:useQuestStore.getState().quests[q3.id].status}};
        }}""")
        print("conclusão:", json.dumps(r, ensure_ascii=False))
        await b.close()

asyncio.run(main())
